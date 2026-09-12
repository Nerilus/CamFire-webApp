from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import jwt
import secrets
import hashlib
import hmac

from db.database import get_db
from db.models import User, Device, UserDevice
from schemas.user_schema import (
    UserCreate,
    UserResponse,
    Token,
    UserUpdate,
    PasswordUpdate,
    LoginResponse,
    Verify2FARequest,
    Resend2FARequest,
    TwoFactorToggleRequest,
    Disable2FARequest,
)
from core.security import verify_password, get_password_hash, create_access_token
from core.config import SECRET_KEY, ALGORITHM, OTP_EXPIRE_MINUTES, CAMERA_URL
from services.email import (
    send_otp_email,
    send_login_notification_email,
    send_device_paired_email,
    send_welcome_email,
    send_owner_secondary_registration_alert_email,
)

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

# Indique à FastAPI comment récupérer le token (Bearer Token) dans les headers
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def mask_email(email: str) -> str:
    """Masque partiellement l'adresse e-mail pour l'affichage de sécurité (ex: j***e@example.com)."""
    try:
        user_part, domain = email.split("@", 1)
        if len(user_part) <= 2:
            masked_user = user_part[0] + "***"
        else:
            masked_user = user_part[0] + "***" + user_part[-1]
        return f"{masked_user}@{domain}"
    except Exception:
        return "***"

def get_client_ip(request: Request) -> str:
    """Extrait l'adresse IP réelle du client (gère X-Forwarded-For derrière proxy/Docker)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "Inconnue"


# Dépendance pour extraire et valider le token de l'utilisateur connecté
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Identifiants ou token invalides",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        # Empêche l'utilisation d'un jeton temporaire 2FA_pending pour accéder aux routes protégées
        if email is None or payload.get("scope") == "2fa_pending":
            raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception
        
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    device = None
    if user_in.pair_device:
        if not user_in.device_id or not user_in.pairing_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="L'identifiant matériel et le code secret d'appairage sont requis pour lier un appareil."
            )
        device = db.query(Device).filter(Device.device_id == user_in.device_id.strip()).first()
        if not device:
            if len(user_in.pairing_code.strip()) >= 4:
                device = Device(
                    device_id=user_in.device_id.strip(),
                    name=user_in.device_name.strip() if user_in.device_name else "Raspberry 4",
                    hashed_pairing_code=get_password_hash(user_in.pairing_code.strip()),
                    stream_url=CAMERA_URL,
                    code_expires_at=datetime.utcnow() + timedelta(hours=24),
                    is_paired=False
                )
                db.add(device)
                db.commit()
                db.refresh(device)
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Matériel '{user_in.device_id}' introuvable. Vérifiez l'ID matériel ou lancez le script agent sur le Raspberry Pi."
                )
        # Un même appareil physique peut être lié à plusieurs comptes avec son code secret
        if not verify_password(user_in.pairing_code.strip(), device.hashed_pairing_code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Code secret d'appairage incorrect pour ce Raspberry Pi."
            )

    user = db.query(User).filter(User.email == user_in.email).first()
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cet email est déjà utilisé."
        )
    hashed_password = get_password_hash(user_in.password)
    # Par défaut, la double authentification par e-mail est activée pour renforcer la sécurité
    new_user = User(email=user_in.email, hashed_password=hashed_password, is_2fa_enabled=True)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    if device:
        custom_name = user_in.device_name.strip() if user_in.device_name else device.name

        # Détermination du rôle (Premier arrivant = owner, suivants = member)
        existing_owner_ud = db.query(UserDevice).filter(
            UserDevice.device_id == device.id,
            UserDevice.role == "owner"
        ).first()
        existing_members_count = db.query(UserDevice).filter(UserDevice.device_id == device.id).count()

        is_first_owner = (existing_members_count == 0 or not existing_owner_ud)
        assigned_role = "owner" if is_first_owner else "member"
        owner_user = existing_owner_ud.user if existing_owner_ud else None

        new_ud = UserDevice(
            user_id=new_user.id,
            device_id=device.id,
            custom_name=custom_name,
            role=assigned_role,
            paired_at=datetime.utcnow()
        )
        db.add(new_ud)
        device.is_paired = True
        if is_first_owner:
            device.user_id = new_user.id
            device.paired_at = datetime.utcnow()
        db.commit()
        db.refresh(new_user)

    send_welcome_email(new_user.email)
    if device:
        if assigned_role == "member" and owner_user:
            new_member_name = f"{new_user.firstname or ''} {new_user.lastname or ''}".strip() or None
            send_owner_secondary_registration_alert_email(
                owner_email=owner_user.email,
                device_name=device.name,
                device_id=device.device_id,
                new_member_email=new_user.email,
                new_member_name=new_member_name
            )
            send_device_paired_email(
                recipient=new_user.email,
                device_name=custom_name,
                device_id=device.device_id,
                role="member",
                owner_email=owner_user.email
            )
        else:
            send_device_paired_email(
                recipient=new_user.email,
                device_name=custom_name,
                device_id=device.device_id,
                role="owner"
            )

    return new_user

@router.post("/login", response_model=LoginResponse)
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Si la double authentification (2FA) est activée pour ce compte
    if getattr(user, "is_2fa_enabled", True):
        # Génération d'un code numérique aléatoire à 6 chiffres
        otp_code = f"{secrets.randbelow(1000000):06d}"
        otp_hash = hashlib.sha256(otp_code.encode()).hexdigest()
        
        user.otp_code_hash = otp_hash
        user.otp_expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES)
        user.otp_attempts = 0
        db.commit()

        # Envoi asynchrone du code de vérification par e-mail (+ log console pour le dev)
        send_otp_email(user.email, otp_code, expire_minutes=OTP_EXPIRE_MINUTES)

        # Jeton temporaire limité à l'étape 2FA (validité 15 minutes)
        temp_token_payload = {
            "sub": user.email,
            "scope": "2fa_pending",
            "exp": datetime.utcnow() + timedelta(minutes=15)
        }
        temp_token = jwt.encode(temp_token_payload, SECRET_KEY, algorithm=ALGORITHM)

        return LoginResponse(
            requires_2fa=True,
            temp_token=temp_token,
            email_masked=mask_email(user.email),
            expires_in_seconds=OTP_EXPIRE_MINUTES * 60,
        )

    # Si 2FA désactivé : délivrance directe du JWT d'accès complet + notification par e-mail
    access_token = create_access_token(data={"sub": user.email})
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "Inconnu")
    send_login_notification_email(user.email, ip_address=client_ip, user_agent=user_agent)

    return LoginResponse(
        requires_2fa=False,
        access_token=access_token,
        token_type="bearer"
    )

@router.post("/verify-2fa", response_model=Token)
def verify_2fa(request: Request, payload: Verify2FARequest, db: Session = Depends(get_db)):
    """Valide le code OTP à 6 chiffres reçu par e-mail et délivre le token d'accès final."""
    invalid_session_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Session de vérification expirée ou invalide. Veuillez vous reconnecter.",
    )
    try:
        decoded = jwt.decode(payload.temp_token, SECRET_KEY, algorithms=[ALGORITHM])
        email = decoded.get("sub")
        scope = decoded.get("scope")
        if not email or scope != "2fa_pending":
            raise invalid_session_exc
    except jwt.InvalidTokenError:
        raise invalid_session_exc

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise invalid_session_exc

    # Vérification du nombre de tentatives (protection anti-bruteforce)
    if (user.otp_attempts or 0) >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trop de tentatives infructueuses. Veuillez vous reconnecter pour obtenir un nouveau code.",
        )

    # Vérification de l'expiration du code OTP
    if not user.otp_expires_at or user.otp_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le code de vérification a expiré. Veuillez cliquer sur 'Renvoyer un code'.",
        )

    # Hachage du code fourni et comparaison constante
    provided_hash = hashlib.sha256(payload.code.strip().encode()).hexdigest()
    if not user.otp_code_hash or not hmac.compare_digest(user.otp_code_hash, provided_hash):
        user.otp_attempts = (user.otp_attempts or 0) + 1
        db.commit()
        remaining = max(0, 5 - user.otp_attempts)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Code de vérification incorrect. ({remaining} essai(s) restant(s))",
        )

    # Succès : réinitialisation des métadonnées OTP
    user.otp_code_hash = None
    user.otp_expires_at = None
    user.otp_attempts = 0
    db.commit()

    # Génération du JWT d'accès complet
    access_token = create_access_token(data={"sub": user.email})

    # Envoi de l'e-mail de notification de nouvelle connexion avec l'IP réelle et le navigateur
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "Inconnu")
    send_login_notification_email(user.email, ip_address=client_ip, user_agent=user_agent)

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/resend-2fa")
def resend_2fa(payload: Resend2FARequest, db: Session = Depends(get_db)):
    """Génère et renvoie un nouveau code OTP si le précédent a expiré."""
    invalid_session_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Session de vérification expirée ou invalide. Veuillez vous reconnecter.",
    )
    try:
        decoded = jwt.decode(payload.temp_token, SECRET_KEY, algorithms=[ALGORITHM])
        email = decoded.get("sub")
        scope = decoded.get("scope")
        if not email or scope != "2fa_pending":
            raise invalid_session_exc
    except jwt.InvalidTokenError:
        raise invalid_session_exc

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise invalid_session_exc

    # Génération d'un nouveau code
    otp_code = f"{secrets.randbelow(1000000):06d}"
    user.otp_code_hash = hashlib.sha256(otp_code.encode()).hexdigest()
    user.otp_expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES)
    user.otp_attempts = 0
    db.commit()

    send_otp_email(user.email, otp_code, expire_minutes=OTP_EXPIRE_MINUTES)

    return {
        "message": f"Nouveau code de vérification envoyé à {mask_email(user.email)}.",
        "expires_in_seconds": OTP_EXPIRE_MINUTES * 60,
    }

@router.post("/forgot-password")
def forgot_password(email: str, db: Session = Depends(get_db)):
    from datetime import timedelta
    from services.email import send_reset_password_email
    import random

    user = db.query(User).filter(User.email == email).first()
    if user:
        code = str(random.randint(100000, 999999))
        user.reset_code = code
        user.reset_code_expires_at = datetime.utcnow() + timedelta(minutes=30)
        db.commit()
        send_reset_password_email(user.email, code)
    return {"message": "Si cet email existe, un code de réinitialisation a été envoyé."}


@router.post("/reset-password")
def reset_password(email: str, code: str, new_password: str, db: Session = Depends(get_db)):
    from core.security import get_password_hash

    user = db.query(User).filter(User.email == email).first()
    if not user or user.reset_code != code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code invalide.")
    if user.reset_code_expires_at is None or datetime.utcnow() > user.reset_code_expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Code expiré.")

    user.hashed_password = get_password_hash(new_password)
    user.reset_code = None
    user.reset_code_expires_at = None
    db.commit()
    return {"message": "Mot de passe réinitialisé avec succès."}


@router.get("/me", response_model=UserResponse)
def auth_me(current_user: User = Depends(get_current_user)):
    """Renvoie les données de l'utilisateur actuellement authentifié"""
    return current_user

@router.put("/me", response_model=UserResponse)
def update_user_profile(user_update: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Met à jour le prénom et le nom de l'utilisateur"""
    if user_update.firstname is not None:
        current_user.firstname = user_update.firstname
    if user_update.lastname is not None:
        current_user.lastname = user_update.lastname
    
    db.commit()
    db.refresh(current_user)
    return current_user

@router.post("/me/2fa/request-disable")
def request_disable_2fa(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Génère et envoie un code de vérification à l'utilisateur pour autoriser la désactivation du 2FA."""
    if not getattr(current_user, "is_2fa_enabled", True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La double authentification n'est pas activée sur ce compte.",
        )

    # Génération d'un code OTP éphémère à 6 chiffres
    otp_code = f"{secrets.randbelow(1000000):06d}"
    current_user.otp_code_hash = hashlib.sha256(otp_code.encode()).hexdigest()
    current_user.otp_expires_at = datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES)
    current_user.otp_attempts = 0
    db.commit()

    # Envoi par mail spécifique au motif "disable_2fa"
    send_otp_email(current_user.email, otp_code, expire_minutes=OTP_EXPIRE_MINUTES, purpose="disable_2fa")

    return {
        "message": "Un code de confirmation vous a été envoyé par e-mail.",
        "email_masked": mask_email(current_user.email),
        "expires_in_seconds": OTP_EXPIRE_MINUTES * 60,
    }

@router.post("/me/2fa/confirm-disable")
def confirm_disable_2fa(payload: Disable2FARequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Valide le code OTP reçu par e-mail et désactive le 2FA si le code est correct."""
    if not getattr(current_user, "is_2fa_enabled", True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La double authentification est déjà désactivée.",
        )

    # Vérification du nombre de tentatives
    if (current_user.otp_attempts or 0) >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trop de tentatives infructueuses. Veuillez refaire une demande de code.",
        )

    # Vérification de l'expiration
    if not current_user.otp_expires_at or current_user.otp_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le code de confirmation a expiré. Veuillez en demander un nouveau.",
        )

    # Vérification cryptographique
    provided_hash = hashlib.sha256(payload.code.strip().encode()).hexdigest()
    if not current_user.otp_code_hash or not hmac.compare_digest(current_user.otp_code_hash, provided_hash):
        current_user.otp_attempts = (current_user.otp_attempts or 0) + 1
        db.commit()
        remaining = max(0, 5 - current_user.otp_attempts)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Code de confirmation incorrect. ({remaining} essai(s) restant(s))",
        )

    # Succès : désactivation et réinitialisation des champs OTP
    current_user.is_2fa_enabled = False
    current_user.otp_code_hash = None
    current_user.otp_expires_at = None
    current_user.otp_attempts = 0
    db.commit()

    return {
        "message": "Double authentification désactivée avec succès.",
        "is_2fa_enabled": False,
    }

@router.post("/me/2fa/enable")
def enable_2fa(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Active la double authentification par e-mail pour le compte de l'utilisateur."""
    current_user.is_2fa_enabled = True
    current_user.otp_code_hash = None
    current_user.otp_expires_at = None
    current_user.otp_attempts = 0
    db.commit()
    return {
        "message": "Double authentification activée avec succès.",
        "is_2fa_enabled": True,
    }

@router.put("/me/2fa")
def toggle_2fa(payload: TwoFactorToggleRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Route de compatibilité pour basculer le 2FA (bloque la désactivation directe sans code)."""
    if not payload.is_2fa_enabled and getattr(current_user, "is_2fa_enabled", True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pour des raisons de sécurité, la désactivation du 2FA nécessite une confirmation par code e-mail.",
        )
    current_user.is_2fa_enabled = payload.is_2fa_enabled
    db.commit()
    return {
        "message": f"Double authentification {'activée' if payload.is_2fa_enabled else 'désactivée'} avec succès.",
        "is_2fa_enabled": current_user.is_2fa_enabled,
    }


@router.put("/me/password", response_model=dict)
def update_user_password(password_update: PasswordUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Met à jour le mot de passe de l'utilisateur"""
    if not verify_password(password_update.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="L'ancien mot de passe est incorrect"
        )
    
    current_user.hashed_password = get_password_hash(password_update.new_password)
    db.commit()
    return {"message": "Mot de passe mis à jour avec succès"}