from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import jwt

from db.database import get_db
from db.models import User
from schemas.user_schema import UserCreate, UserResponse, Token, UserUpdate, PasswordUpdate
from core.security import verify_password, get_password_hash, create_access_token
from core.config import SECRET_KEY, ALGORITHM
from services.email import send_device_paired_email, send_welcome_email

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

# Indique à FastAPI comment récupérer le token (Bearer Token) dans les headers
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

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
        if email is None:
            raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception
        
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

from datetime import datetime
from db.models import User, Device, UserDevice

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
    new_user = User(email=user_in.email, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    if device:
        custom_name = user_in.device_name.strip() if user_in.device_name else device.name
        new_ud = UserDevice(
            user_id=new_user.id,
            device_id=device.id,
            custom_name=custom_name,
            paired_at=datetime.utcnow()
        )
        db.add(new_ud)
        device.is_paired = True
        db.commit()
        db.refresh(new_user)

    send_welcome_email(new_user.email)
    if device:
        send_device_paired_email(new_user.email, custom_name, device.device_id)

    return new_user

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

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