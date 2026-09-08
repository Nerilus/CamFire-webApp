from fastapi import APIRouter, Depends, HTTPException, status, Query, Header, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import threading
import time
import secrets
import urllib.parse
import jwt

from db.database import get_db
from db.models import User, Device, UserDevice
from schemas.device_schema import (
    DevicePairRequest,
    DeviceResponse,
    DeviceUnpairRequest,
    DeviceProvisionRequest,
    DeviceMemberResponse,
    StreamTicketResponse,
    RefreshCodeResponse
)
from core.security import verify_password, get_password_hash
from core.config import SECRET_KEY, ALGORITHM, DEVICE_PROVISION_KEY
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
    if hostname in forbidden or hostname.startswith("127."):
        raise HTTPException(status_code=400, detail="Adresse de flux non autorisée (cibles locales ou métadonnées interdites).")

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
            stream_url=req.stream_url or "http://172.20.10.2:8080/",
            code_expires_at=expires_at,
            is_paired=False
        )
        db.add(dev)
        db.commit()
        return {"status": "created", "device_id": req.device_id, "expires_at": expires_at.isoformat()}
    elif not dev.is_paired:
        dev.hashed_pairing_code = get_password_hash(req.pairing_code)
        dev.code_expires_at = expires_at
        if req.stream_url:
            dev.stream_url = req.stream_url
        if req.name:
            dev.name = req.name
        db.commit()
        return {"status": "updated", "device_id": req.device_id, "expires_at": expires_at.isoformat()}
    else:
        return {"status": "already_paired", "device_id": req.device_id}

# ---------------------------------------------------------------------------
# 6. Endpoints Utilisateurs & Appairage Sécurisé
# ---------------------------------------------------------------------------
@router.get("/my", response_model=List[DeviceResponse])
def get_my_devices(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Retourne la liste des Raspberry Pi liés au compte de l'utilisateur connecté avec leur rôle."""
    user_devs = db.query(UserDevice).filter(UserDevice.user_id == current_user.id).all()
    results = []
    for ud in user_devs:
        dev = ud.device
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
            status="online"
        ))
    return results


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
        record_pair_failure(client_id, target_device_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Aucun appareil trouvé avec l'identifiant matériel '{pair_in.device_id}'."
        )

    # 2. Vérification de l'expiration du code (TTL)
    if device.code_expires_at and datetime.utcnow() > device.code_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le code d'appairage a expiré. Demandez au propriétaire de l'appareil de générer un nouveau code."
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
    existing_members_count = db.query(UserDevice).filter(UserDevice.device_id == device.id).count()
    assigned_role = "owner" if existing_members_count == 0 else "member"

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
    db.commit()

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
        status="online"
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
    elif was_owner:
        # Transfert automatique de l'autorité au membre le plus ancien
        remaining_uds[0].role = "owner"

    db.commit()
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
        generate_video_stream(device.stream_url),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

