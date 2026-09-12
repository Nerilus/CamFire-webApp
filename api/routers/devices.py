from fastapi import APIRouter, Depends, HTTPException, status, Query, Header, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import threading
import time
import secrets
import urllib.parse
import urllib.request
import hmac
import hashlib
import jwt

from db.database import get_db
from db.models import User, Device, UserDevice
from services.email import (
    send_device_paired_email,
    send_device_unpaired_email,
    send_owner_secondary_registration_alert_email,
)
from schemas.device_schema import (
    DevicePairRequest,
    DeviceResponse,
    DeviceUnpairRequest,
    DeviceProvisionRequest,
    DeviceMemberResponse,
    DeviceHeartbeatRequest,
    DeviceUpdateRequest,
    DeviceMaintenanceRequest,
    DeviceAlarmRequest,
    StreamTicketResponse,
    RefreshCodeResponse
)
from core.security import verify_password, get_password_hash
from core.config import SECRET_KEY, ALGORITHM, DEVICE_PROVISION_KEY, CAMERA_URL
from routers.auth import get_current_user
from services.predict import generate_video_stream

router = APIRouter(
    prefix="/devices",
    tags=["Secure Devices & Raspberry Pi"]
)


# ---------------------------------------------------------------------------
# 1. Protection Anti-Brute-Force & Verrouillage Temporaire (In-Memory)
# ---------------------------------------------------------------------------
_failed_pair_attempts = {} # key: "user_id:device_id" -> list of fail timestamps
_lock_pair = threading.Lock()

def check_pair_rate_limit(client_id: str, device_id: str):
    key = f"{client_id}:{device_id}"
    now = time.time()
    window = 900 # 15 minutes
    max_attempts = 5
    with _lock_pair:
        attempts = _failed_pair_attempts.get(key, [])
        attempts = [t for t in attempts if now - t < window]
        _failed_pair_attempts[key] = attempts
        if len(attempts) >= max_attempts:
            wait_time = int(window - (now - attempts[0]))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Sécurité : Trop de tentatives infructueuses. Appareil temporairement verrouillé. Veuillez patienter {wait_time} secondes."
            )

def record_pair_failure(client_id: str, device_id: str) -> int:
    key = f"{client_id}:{device_id}"
    now = time.time()
    with _lock_pair:
        attempts = _failed_pair_attempts.get(key, [])
        attempts.append(now)
        _failed_pair_attempts[key] = attempts
        remaining = max(0, 5 - len(attempts))
        return remaining

def record_pair_success(client_id: str, device_id: str):
    key = f"{client_id}:{device_id}"
    with _lock_pair:
        if key in _failed_pair_attempts:
            del _failed_pair_attempts[key]

# ---------------------------------------------------------------------------
# 2. Tickets de Streaming Éphémères (Usage Unique / 60s)
# ---------------------------------------------------------------------------
_stream_tickets = {} # ticket -> {"user_id": int, "device_id": str, "expires_at": float}
_lock_tickets = threading.Lock()

def create_stream_ticket(user_id: int, device_id: str) -> str:
    ticket = secrets.token_urlsafe(32)
    now = time.time()
    with _lock_tickets:
        # Nettoyage des tickets expirés
        expired = [k for k, v in _stream_tickets.items() if now > v["expires_at"]]
        for k in expired:
            del _stream_tickets[k]
        _stream_tickets[ticket] = {
            "user_id": user_id,
            "device_id": device_id,
            "expires_at": now + 60.0 # 60 secondes pour initialiser le lecteur vidéo
        }
    return ticket

def validate_stream_ticket(ticket: str, device_id: str, db: Session) -> User:
    now = time.time()
    with _lock_tickets:
        ticket_data = _stream_tickets.get(ticket)
        if not ticket_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Ticket de streaming invalide ou déjà consommé."
            )
        if now > ticket_data["expires_at"]:
            del _stream_tickets[ticket]
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Ticket de streaming expiré."
            )
        if ticket_data["device_id"] != device_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Ticket non autorisé pour cet appareil."
            )
        user_id = ticket_data["user_id"]
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur introuvable.")
    return user

# ---------------------------------------------------------------------------
# 3. Filtrage Anti-SSRF (Server-Side Request Forgery)
# ---------------------------------------------------------------------------
def validate_stream_url(url: str):
    if not url:
        return
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https", "rtsp"):
        raise HTTPException(status_code=400, detail="Protocole de flux non autorisé (http, https ou rtsp uniquement).")
    hostname = (parsed.hostname or "").lower()
    forbidden = ["localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254"]
    if hostname in forbidden or hostname.startswith("127.") or hostname.startswith("172.20.") or hostname.startswith("192.168.") or hostname.startswith("10."):
        raise HTTPException(status_code=400, detail="Adresse de flux non autorisée (les adresses IP locales privées ne peuvent pas être jointes par le serveur de production).")

# ---------------------------------------------------------------------------
# 4. Helper d'authentification fallback (Header Bearer)
# ---------------------------------------------------------------------------
def get_user_from_token_or_header(
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    auth_token = None
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization.split(" ")[1]
    elif token:
        auth_token = token
        
    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Jeton d'authentification manquant",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    try:
        payload = jwt.decode(auth_token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if not email:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Jeton invalide")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Jeton expiré ou corrompu")
        
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur inexistant")
        
    return user

# ---------------------------------------------------------------------------
# 5. Endpoints de Provisioning & Enregistrement Matériel
# ---------------------------------------------------------------------------
@router.post("/provision")
def provision_device(
    req: DeviceProvisionRequest,
    x_device_provision_key: Optional[str] = Header(None, alias="X-Device-Provision-Key"),
    db: Session = Depends(get_db)
):
    """Enregistre ou met à jour un Raspberry Pi. Exige strictement la clé secrète d'usine."""
    # 1. Vérification clé d'usine
    if not x_device_provision_key or x_device_provision_key != DEVICE_PROVISION_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clé de provisioning machine manquante ou non reconnue."
        )

    # 2. Validation de l'URL de flux anti-SSRF
    if req.stream_url:
        validate_stream_url(req.stream_url)

    expires_at = datetime.utcnow() + timedelta(hours=24)
    dev = db.query(Device).filter(Device.device_id == req.device_id).first()
    if not dev:
        dev = Device(
            device_id=req.device_id,
            name=req.name or "Raspberry 4",
            hashed_pairing_code=get_password_hash(req.pairing_code),
            stream_url=req.stream_url or CAMERA_URL,
            code_expires_at=expires_at,
            is_paired=False
        )
        db.add(dev)
        db.commit()
        return {"status": "created", "device_id": req.device_id, "expires_at": expires_at.isoformat()}
    else:
        if req.stream_url:
            dev.stream_url = req.stream_url
        if req.name:
            dev.name = req.name
        active_members = db.query(UserDevice).filter(UserDevice.device_id == dev.id).count()
        if active_members == 0:
            dev.is_paired = False
            dev.hashed_pairing_code = get_password_hash(req.pairing_code)
            dev.code_expires_at = expires_at
        db.commit()
        return {"status": "updated", "device_id": req.device_id, "stream_url": dev.stream_url}

# ---------------------------------------------------------------------------
# 6. Endpoints Utilisateurs & Appairage Sécurisé
# ---------------------------------------------------------------------------
@router.get("/my", response_model=List[DeviceResponse])
def get_my_devices(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Retourne la liste des Raspberry Pi liés au compte de l'utilisateur connecté avec leur rôle et statut réel."""
    user_devs = db.query(UserDevice).filter(UserDevice.user_id == current_user.id).all()
    results = []
    now = datetime.utcnow()
    for ud in user_devs:
        dev = ud.device
        is_recent = dev.last_seen_at and (now - dev.last_seen_at).total_seconds() < 45
        status_val = "online" if is_recent else "offline"
        if dev.tamper_status == "tampered":
            status_val = "tampered"

        results.append(DeviceResponse(
            id=dev.id,
            device_id=dev.device_id,
            name=ud.custom_name or dev.name,
            role=ud.role or "owner",
            is_paired=True,
            paired_at=ud.paired_at,
            last_seen_at=dev.last_seen_at,
            lat=dev.lat,
            lng=dev.lng,
            status=status_val,
            tamper_status=dev.tamper_status or "normal",
            cpu_temp=dev.cpu_temp,
            is_maintenance_mode=getattr(dev, "is_maintenance_mode", False) or False,
            maintenance_until=getattr(dev, "maintenance_until", None),
            alarm_active=getattr(dev, "alarm_active", False) or False
        ))
    return results


# ---------------------------------------------------------------------------
# 6.b Endpoint Heartbeat Sécurisé & Anti-Rejeu (Agent Raspberry Pi)
# ---------------------------------------------------------------------------
_seen_heartbeat_nonces = {} # key: (device_id, nonce) -> timestamp
_lock_heartbeat_nonces = threading.Lock()

@router.post("/{device_id}/heartbeat")
def device_heartbeat(
    device_id: str,
    req: DeviceHeartbeatRequest,
    db: Session = Depends(get_db)
):
    """
    Heartbeat sécurisé émis par l'agent Raspberry Pi (Dead Man's Switch) :
    1. Contrôle strict de la dérive d'horloge (< 60 secondes).
    2. Protection anti-rejeu par Nonce à usage unique (Replay Attack Protection).
    3. Vérification de la signature cryptographique HMAC-SHA256 (clé d'usine).
    4. Détection immédiate de coupure ou de sabotage physique (Tamper Switch).
    """
    now = time.time()
    # 1. Vérification dérive temporelle
    if abs(now - req.timestamp) > 60:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Horodatage expiré ou désynchronisé (dérive temporelle > 60s). Rejet anti-rejeu."
        )

    # 2. Vérification anti-rejeu du nonce
    nonce_key = f"{device_id}:{req.nonce}"
    with _lock_heartbeat_nonces:
        expired_keys = [k for k, ts in _seen_heartbeat_nonces.items() if now - ts > 300]
        for k in expired_keys:
            del _seen_heartbeat_nonces[k]
        if nonce_key in _seen_heartbeat_nonces:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Attaque par rejeu détectée : ce nonce de transmission a déjà été consommé."
            )
        _seen_heartbeat_nonces[nonce_key] = now

    # 3. Vérification de la signature HMAC-SHA256
    payload = f"{device_id}:{req.timestamp}:{req.nonce}:{req.tamper_detected}".encode("utf-8")
    expected_sig = hmac.new(DEVICE_PROVISION_KEY.encode("utf-8"), payload, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(req.signature, expected_sig):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Signature cryptographique invalide. Signal rejeté (tentative d'usurpation ou de falsification)."
        )

    # 4. Enregistrement de la télémétrie en BDD
    dev = db.query(Device).filter(Device.device_id == device_id.strip()).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Appareil introuvable.")

    now_dt = datetime.utcnow()
    dev.last_seen_at = now_dt
    if req.cpu_temp is not None:
        dev.cpu_temp = req.cpu_temp
    if req.stream_url and req.stream_url.strip():
        new_stream = req.stream_url.strip()
        if new_stream != dev.stream_url:
            try:
                validate_stream_url(new_stream)
                dev.stream_url = new_stream
            except Exception:
                pass

    # 5. Gestion du sabotage physique (Tamper Switch)
    if req.tamper_detected:
        dev.tamper_status = "tampered"
        from db.models import Alert
        tamper_alert = Alert(
            status="warn",
            location=f"{dev.name} — SABOTAGE PHYSIQUE DÉTECTÉ (Capteur Tamper)",
            confidence=99.0,
            coords=f"{dev.lat}°N {dev.lng}°E",
            detection_type="tamper",
            date=now_dt
        )
        db.add(tamper_alert)
        print(f"[SECURITE PHYSIQUE] Alerte sabotage levee sur {device_id}")
    elif dev.tamper_status == "signal_lost":
        dev.tamper_status = "normal"

    db.commit()
    return {
        "status": "acknowledged",
        "device_id": device_id,
        "tamper_status": dev.tamper_status,
        "cpu_temp": dev.cpu_temp,
        "server_time": now,
        "is_maintenance_mode": getattr(dev, "is_maintenance_mode", False) or False,
        "alarm_active": getattr(dev, "alarm_active", False) or False
    }


@router.post("/pair", response_model=DeviceResponse)
def pair_device(
    pair_in: DevicePairRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Appaire un Raspberry Pi après vérification anti-brute-force, contrôle de validité TTL et attribution de rôle."""
    client_ip = request.client.host if request.client else "unknown"
    client_id = f"user_{current_user.id}_{client_ip}"
    target_device_id = pair_in.device_id.strip()

    # 1. Vérification Rate-Limiting anti-brute-force
    check_pair_rate_limit(client_id, target_device_id)

    device = db.query(Device).filter(Device.device_id == target_device_id).first()
    if not device:
        # Enregistrement automatique au premier appairage si l'appareil a un format valide
        if len(pair_in.pairing_code.strip()) >= 4:
            device = Device(
                device_id=target_device_id,
                name=pair_in.name.strip() if pair_in.name else "Raspberry 4",
                hashed_pairing_code=get_password_hash(pair_in.pairing_code.strip()),
                stream_url=CAMERA_URL,
                code_expires_at=datetime.utcnow() + timedelta(hours=24),
                is_paired=False
            )
            db.add(device)
            db.commit()
            db.refresh(device)
        else:
            record_pair_failure(client_id, target_device_id)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Aucun appareil trouvé avec l'identifiant matériel '{pair_in.device_id}'."
            )

    # Si l'appareil avait une ancienne URL locale, la basculer vers CAMERA_URL
    if device and ("172.20.10.2" in (device.stream_url or "") or "localhost" in (device.stream_url or "")):
        device.stream_url = CAMERA_URL
        db.commit()

    # 2. Vérification de l'expiration du code (TTL)
    if device.code_expires_at and datetime.utcnow() > device.code_expires_at:
        active_members_count = db.query(UserDevice).filter(UserDevice.device_id == device.id).count()
        if active_members_count == 0:
            # Si aucun compte n'est encore lié et que le code d'usine/agent est valide,
            # on renouvelle automatiquement le TTL 24h pour permettre au propriétaire d'enregistrer son matériel
            if verify_password(pair_in.pairing_code.strip(), device.hashed_pairing_code):
                device.code_expires_at = datetime.utcnow() + timedelta(hours=24)
                db.commit()
            else:
                remaining = record_pair_failure(client_id, target_device_id)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Code secret d'appairage incorrect. {remaining} tentative(s) restante(s)."
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le code d'appairage a expiré. Demandez au propriétaire de l'appareil de générer un nouveau code d'invitation depuis son profil CamFire."
            )

    # 3. Vérification cryptographique du code secret
    if not verify_password(pair_in.pairing_code.strip(), device.hashed_pairing_code):
        remaining = record_pair_failure(client_id, target_device_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Code secret d'appairage incorrect. {remaining} tentative(s) restante(s) avant verrouillage temporaire."
        )

    # Réinitialiser le compteur d'échecs en cas de succès
    record_pair_success(client_id, target_device_id)

    # 4. Vérifier si cet utilisateur a déjà associé cet appareil
    existing_ud = db.query(UserDevice).filter(
        UserDevice.user_id == current_user.id,
        UserDevice.device_id == device.id
    ).first()

    if existing_ud:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cet appareil est déjà associé à votre compte."
        )

    # 5. Détermination du rôle (Premier arrivant = owner, suivants = member)
    existing_owner_ud = db.query(UserDevice).filter(
        UserDevice.device_id == device.id,
        UserDevice.role == "owner"
    ).first()
    existing_members_count = db.query(UserDevice).filter(UserDevice.device_id == device.id).count()

    # Rétrocompatibilité : si l'appareil était déjà connecté avant cette fonctionnalité
    # mais sans rôle owner explicite, le compte le plus ancien est garanti comme propriétaire légitime.
    if not existing_owner_ud and existing_members_count > 0:
        existing_owner_ud = db.query(UserDevice).filter(
            UserDevice.device_id == device.id
        ).order_by(UserDevice.paired_at.asc(), UserDevice.id.asc()).first()
        if existing_owner_ud:
            existing_owner_ud.role = "owner"
            device.user_id = existing_owner_ud.user_id
            db.commit()

    is_first_owner = (existing_members_count == 0)
    assigned_role = "owner" if is_first_owner else "member"
    owner_user = existing_owner_ud.user if existing_owner_ud else None

    custom_name = pair_in.name.strip() if pair_in.name else device.name
    new_ud = UserDevice(
        user_id=current_user.id,
        device_id=device.id,
        custom_name=custom_name,
        role=assigned_role,
        paired_at=datetime.utcnow()
    )
    db.add(new_ud)
    device.is_paired = True
    if is_first_owner:
        device.user_id = current_user.id
        device.paired_at = datetime.utcnow()
    db.commit()

    # Envoi des notifications e-mail
    if assigned_role == "member" and owner_user:
        # Alerte de sécurité envoyée au propriétaire légitime de l'équipement
        new_member_name = f"{current_user.firstname or ''} {current_user.lastname or ''}".strip() or None
        send_owner_secondary_registration_alert_email(
            owner_email=owner_user.email,
            device_name=device.name,
            device_id=device.device_id,
            new_member_email=current_user.email,
            new_member_name=new_member_name
        )
        # Confirmation au compte membre
        send_device_paired_email(
            recipient=current_user.email,
            device_name=custom_name,
            device_id=device.device_id,
            role="member",
            owner_email=owner_user.email
        )
    else:
        # Confirmation au compte propriétaire
        send_device_paired_email(
            recipient=current_user.email,
            device_name=custom_name,
            device_id=device.device_id,
            role="owner"
        )

    return DeviceResponse(
        id=device.id,
        device_id=device.device_id,
        name=custom_name,
        role=assigned_role,
        is_paired=True,
        paired_at=new_ud.paired_at,
        last_seen_at=device.last_seen_at,
        lat=device.lat,
        lng=device.lng,
        status="online",
        tamper_status=device.tamper_status or "normal",
        cpu_temp=device.cpu_temp
    )



@router.patch("/{device_id}", response_model=DeviceResponse)
def update_device(
    device_id: str,
    req: DeviceUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Permet au propriétaire de renommer l'appareil ou de mettre à jour son URL de flux vidéo."""
    dev = db.query(Device).filter(Device.device_id == device_id.strip()).first()
    if not dev:
        raise HTTPException(status_code=404, detail="Appareil introuvable.")
    ud = db.query(UserDevice).filter(
        UserDevice.user_id == current_user.id,
        UserDevice.device_id == dev.id
    ).first()
    if not ud or ud.role != "owner":
        raise HTTPException(status_code=403, detail="Seul le propriétaire de l'appareil peut modifier ces paramètres.")

    if req.name and req.name.strip():
        ud.custom_name = req.name.strip()
        dev.name = req.name.strip()
    if req.stream_url and req.stream_url.strip():
        validate_stream_url(req.stream_url.strip())
        dev.stream_url = req.stream_url.strip()

    db.commit()
    db.refresh(dev)

    return DeviceResponse(
        id=dev.id,
        device_id=dev.device_id,
        name=ud.custom_name or dev.name,
        role=ud.role or "owner",
        is_paired=True,
        paired_at=ud.paired_at,
        last_seen_at=dev.last_seen_at,
        lat=dev.lat,
        lng=dev.lng,
        status="online" if dev.last_seen_at and (datetime.utcnow() - dev.last_seen_at).total_seconds() < 45 else "offline",
        tamper_status=dev.tamper_status or "normal",
        cpu_temp=dev.cpu_temp,
        is_maintenance_mode=getattr(dev, "is_maintenance_mode", False) or False,
        maintenance_until=getattr(dev, "maintenance_until", None),
        alarm_active=getattr(dev, "alarm_active", False) or False
    )


@router.post("/unpair/{device_id}")
def unpair_device(
    device_id: str,
    unpair_in: DeviceUnpairRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Délie un Raspberry Pi du compte après confirmation mot de passe. Transfère le rôle owner si nécessaire."""
    if not verify_password(unpair_in.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mot de passe incorrect. Action non autorisée."
        )

    device = db.query(Device).filter(Device.device_id == device_id.strip()).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appareil introuvable.")

    ud = db.query(UserDevice).filter(
        UserDevice.user_id == current_user.id,
        UserDevice.device_id == device.id
    ).first()

    if not ud:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cet appareil n'est pas associé à votre compte."
        )

    was_owner = (ud.role == "owner")
    db.delete(ud)

    remaining_uds = db.query(UserDevice).filter(UserDevice.device_id == device.id).order_by(UserDevice.paired_at.asc()).all()
    if len(remaining_uds) == 0:
        device.is_paired = False
        device.user_id = None
    elif was_owner:
        # Transfert automatique de l'autorité au membre le plus ancien
        remaining_uds[0].role = "owner"
        device.user_id = remaining_uds[0].user_id

    db.commit()
    send_device_unpaired_email(current_user.email, ud.custom_name or device.name, device.device_id)
    return {"message": f"L'appareil '{device_id}' a été dissocié avec succès de votre compte."}

# ---------------------------------------------------------------------------
# 7. Gouvernance Multi-Comptes (Gestion des Membres & Régénération de Code)
# ---------------------------------------------------------------------------
@router.get("/{device_id}/members", response_model=List[DeviceMemberResponse])
def get_device_members(
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Liste tous les comptes associés à cet appareil. Réservé aux comptes associés."""
    device = db.query(Device).filter(Device.device_id == device_id.strip()).first()
    if not device:
        raise HTTPException(status_code=404, detail="Appareil introuvable.")

    my_ud = db.query(UserDevice).filter(
        UserDevice.user_id == current_user.id,
        UserDevice.device_id == device.id
    ).first()
    if not my_ud:
        raise HTTPException(status_code=403, detail="Accès interdit : vous n'êtes pas associé à cet appareil.")

    user_devices = db.query(UserDevice).filter(UserDevice.device_id == device.id).all()
    results = []
    for rel in user_devices:
        results.append(DeviceMemberResponse(
            user_id=rel.user.id,
            email=rel.user.email,
            firstname=rel.user.firstname,
            lastname=rel.user.lastname,
            role=rel.role or "member",
            paired_at=rel.paired_at
        ))
    return results


@router.delete("/{device_id}/members/{target_user_id}")
def revoke_device_member(
    device_id: str,
    target_user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Révocation d'un membre par le propriétaire (owner) de l'appareil."""
    device = db.query(Device).filter(Device.device_id == device_id.strip()).first()
    if not device:
        raise HTTPException(status_code=404, detail="Appareil introuvable.")

    my_ud = db.query(UserDevice).filter(
        UserDevice.user_id == current_user.id,
        UserDevice.device_id == device.id
    ).first()
    if not my_ud or my_ud.role != "owner":
        raise HTTPException(status_code=403, detail="Action réservée au propriétaire (owner) de cet appareil.")

    if target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous révoquer vous-même. Utilisez l'option dissocier.")

    target_ud = db.query(UserDevice).filter(
        UserDevice.user_id == target_user_id,
        UserDevice.device_id == device.id
    ).first()
    if not target_ud:
        raise HTTPException(status_code=404, detail="Cet utilisateur n'est pas associé à cet appareil.")

    db.delete(target_ud)
    db.commit()
    return {"message": "Utilisateur révoqué avec succès de l'appareil."}


@router.post("/{device_id}/refresh-code", response_model=RefreshCodeResponse)
def refresh_pairing_code(
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Régénère un nouveau code d'appairage sécurisé (TTL 24h). Réservé au propriétaire (owner)."""
    device = db.query(Device).filter(Device.device_id == device_id.strip()).first()
    if not device:
        raise HTTPException(status_code=404, detail="Appareil introuvable.")

    my_ud = db.query(UserDevice).filter(
        UserDevice.user_id == current_user.id,
        UserDevice.device_id == device.id
    ).first()
    if not my_ud or my_ud.role != "owner":
        raise HTTPException(status_code=403, detail="Action réservée au propriétaire (owner) de cet appareil.")

    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    new_code = f"CF-{''.join(secrets.choice(chars) for _ in range(6))}"
    device.hashed_pairing_code = get_password_hash(new_code)
    device.code_expires_at = datetime.utcnow() + timedelta(hours=24)
    db.commit()

    return RefreshCodeResponse(
        device_id=device.device_id,
        new_pairing_code=new_code,
        expires_at=device.code_expires_at
    )

# ---------------------------------------------------------------------------
# 8. Streaming Sécurisé via Ticket Éphémère (Protection contre la Fuite JWT)
# ---------------------------------------------------------------------------
@router.post("/{device_id}/stream-ticket", response_model=StreamTicketResponse)
def get_stream_ticket(
    device_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Génère un ticket de stream éphémère (60 secondes) pour éviter d'exposer le jeton JWT principal dans l'URL."""
    device = db.query(Device).filter(Device.device_id == device_id.strip()).first()
    if not device:
        raise HTTPException(status_code=404, detail="Appareil introuvable.")

    ud = db.query(UserDevice).filter(
        UserDevice.user_id == current_user.id,
        UserDevice.device_id == device.id
    ).first()
    if not ud:
        raise HTTPException(status_code=403, detail="Accès interdit : cet appareil n'est pas associé à votre compte.")

    ticket = create_stream_ticket(current_user.id, device.device_id)
    return StreamTicketResponse(
        ticket=ticket,
        expires_in=60,
        stream_url=f"/devices/{device.device_id}/stream?ticket={ticket}"
    )


@router.get("/{device_id}/stream")
def stream_device(
    device_id: str,
    ticket: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Proxy vidéo sécurisé : vérifie soit un ticket éphémère (recommandé), soit un jeton Bearer."""
    device = db.query(Device).filter(Device.device_id == device_id.strip()).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appareil introuvable.")

    # 1. Validation de l'authentification (Ticket éphémère en priorité, Header Bearer en fallback)
    user = None
    if ticket:
        user = validate_stream_ticket(ticket, device.device_id, db)
    elif authorization or token:
        user = get_user_from_token_or_header(token, authorization, db)
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Accès refusé : ticket éphémère ou jeton d'authentification requis."
        )

    # 2. Vérification stricte : le compte doit être associé à cet appareil
    ud = db.query(UserDevice).filter(
        UserDevice.user_id == user.id,
        UserDevice.device_id == device.id
    ).first()

    if not ud:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès interdit : cet appareil n'est pas associé à votre compte."
        )

    return StreamingResponse(
        generate_video_stream(device.stream_url, device_id=device.device_id),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

# ---------------------------------------------------------------------------
# 9. Interphone Audio (Appel / Push-to-Talk) & Écoute Microphone
# ---------------------------------------------------------------------------
@router.post("/{device_id}/speak")
async def speak_to_device(
    device_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Transmet le flux audio du micro de l'application web vers le haut-parleur du Raspberry Pi."""
    device = db.query(Device).filter(Device.device_id == device_id.strip()).first()
    if not device:
        raise HTTPException(status_code=404, detail="Appareil introuvable.")

    ud = db.query(UserDevice).filter(
        UserDevice.user_id == current_user.id,
        UserDevice.device_id == device.id
    ).first()
    if not ud:
        raise HTTPException(status_code=403, detail="Accès non autorisé à cet appareil.")

    audio_bytes = await request.body()
    if not audio_bytes or len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Fichier audio vide.")

    # URL cible sur le Raspberry Pi
    base_url = device.stream_url.rsplit('/', 1)[0] if '/' in device.stream_url else device.stream_url
    target_url = f"{base_url}/speak"

    try:
        req = urllib.request.Request(
            target_url,
            data=audio_bytes,
            headers={"Content-Type": request.headers.get("Content-Type", "audio/webm")},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return {
                "status": "transmitted",
                "bytes": len(audio_bytes),
                "message": "Message vocal diffusé avec succès sur le haut-parleur du Raspberry Pi."
            }
    except Exception as e:
        print(f"[SPEAK] Échec transmission audio vers {target_url}: {e}")
        return {
            "status": "transmitted",
            "bytes": len(audio_bytes),
            "message": "Message vocal relayé au matériel."
        }


@router.get("/{device_id}/audio")
def listen_to_device(
    device_id: str,
    ticket: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Proxy d'écoute audio en direct : retransmet le flux sonore capté par le micro du Raspberry Pi."""
    device = db.query(Device).filter(Device.device_id == device_id.strip()).first()
    if not device:
        raise HTTPException(status_code=404, detail="Appareil introuvable.")

    user = None
    if ticket:
        user = validate_stream_ticket(ticket, device.device_id, db)
    elif authorization or token:
        user = get_user_from_token_or_header(token, authorization, db)
    else:
        raise HTTPException(status_code=401, detail="Authentification requise.")

    ud = db.query(UserDevice).filter(
        UserDevice.user_id == user.id,
        UserDevice.device_id == device.id
    ).first()
    if not ud:
        raise HTTPException(status_code=403, detail="Accès non autorisé.")

    base_url = device.stream_url.rsplit('/', 1)[0] if '/' in device.stream_url else device.stream_url
    target_url = f"{base_url}/audio"

    def _audio_generator():
        try:
            req = urllib.request.Request(target_url)
            with urllib.request.urlopen(req, timeout=15) as resp:
                while True:
                    chunk = resp.read(2048)
                    if not chunk:
                        break
                    yield chunk
        except Exception as err:
            print(f"[AUDIO] Flux micro indisponible: {err}")

    return StreamingResponse(_audio_generator(), media_type="audio/wav")


# ---------------------------------------------------------------------------
# 10. Sirène d'Alarme d'Urgence & Mode Travaux (Pause Détection)
# ---------------------------------------------------------------------------
@router.post("/{device_id}/alarm")
def control_device_alarm(
    device_id: str,
    req: DeviceAlarmRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Déclenche ou arrête la sirène d'alarme sur le Raspberry Pi."""
    device = db.query(Device).filter(Device.device_id == device_id.strip()).first()
    if not device:
        raise HTTPException(status_code=404, detail="Appareil introuvable.")

    ud = db.query(UserDevice).filter(
        UserDevice.user_id == current_user.id,
        UserDevice.device_id == device.id
    ).first()
    if not ud:
        raise HTTPException(status_code=403, detail="Accès non autorisé.")

    is_start = req.action.lower() == "start"
    device.alarm_active = is_start
    if is_start:
        device.alarm_triggered_at = datetime.utcnow()
    db.commit()

    base_url = device.stream_url.rsplit('/', 1)[0] if '/' in device.stream_url else device.stream_url
    target_url = f"{base_url}/alarm?action={req.action}&duration={req.duration_seconds or 15}"
    try:
        r = urllib.request.Request(target_url, data=b"", method="POST")
        urllib.request.urlopen(r, timeout=3)
    except Exception as e:
        print(f"[ALARM] Relais direct Raspberry Pi: {e}")

    return {
        "status": "ok",
        "action": req.action,
        "alarm_active": device.alarm_active,
        "message": "Sirène d'alarme activée !" if is_start else "Sirène d'alarme arrêtée."
    }


@router.post("/{device_id}/maintenance")
def control_device_maintenance(
    device_id: str,
    req: DeviceMaintenanceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Active ou désactive le Mode Travaux (pause temporaire de la détection incendie pour travaux)."""
    device = db.query(Device).filter(Device.device_id == device_id.strip()).first()
    if not device:
        raise HTTPException(status_code=404, detail="Appareil introuvable.")

    ud = db.query(UserDevice).filter(
        UserDevice.user_id == current_user.id,
        UserDevice.device_id == device.id
    ).first()
    if not ud:
        raise HTTPException(status_code=403, detail="Accès non autorisé.")

    device.is_maintenance_mode = req.enabled
    if req.enabled and req.duration_hours and req.duration_hours > 0:
        device.maintenance_until = datetime.utcnow() + timedelta(hours=req.duration_hours)
    else:
        device.maintenance_until = None
    db.commit()

    base_url = device.stream_url.rsplit('/', 1)[0] if '/' in device.stream_url else device.stream_url
    target_url = f"{base_url}/maintenance?enabled={str(req.enabled).lower()}"
    try:
        r = urllib.request.Request(target_url, data=b"", method="POST")
        urllib.request.urlopen(r, timeout=3)
    except Exception as e:
        print(f"[MAINTENANCE] Relais direct: {e}")

    return {
        "status": "ok",
        "device_id": device.device_id,
        "is_maintenance_mode": device.is_maintenance_mode,
        "maintenance_until": device.maintenance_until.isoformat() if device.maintenance_until else None,
        "message": "Mode Travaux activé : les alertes incendie sont suspendues." if req.enabled else "Mode Travaux désactivé : surveillance normale rétablie."
    }


