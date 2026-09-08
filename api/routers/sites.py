from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Union

from db.database import get_db
from db.models import User, Device, UserDevice, Site
from schemas.site_schema import SiteCreate, SiteUpdate, SiteResponse, SiteDeviceSummary, SiteAssignDeviceRequest
from routers.auth import get_current_user

router = APIRouter(
    prefix="/sites",
    tags=["Sites de Surveillance & Cartographie"]
)

def resolve_device_id(device_identifier: Optional[Union[int, str]], user_id: int, db: Session) -> Optional[int]:
    """Valide et résout un identifiant d'appareil (id numérique ou device_id chaîne) pour l'utilisateur connecté."""
    if device_identifier is None or device_identifier == "" or device_identifier == 0:
        return None

    dev = None
    if isinstance(device_identifier, int):
        dev = db.query(Device).filter(Device.id == device_identifier).first()
    elif isinstance(device_identifier, str):
        if device_identifier.isdigit():
            dev = db.query(Device).filter(Device.id == int(device_identifier)).first()
        if not dev:
            dev = db.query(Device).filter(Device.device_id == device_identifier.strip()).first()

    if not dev:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Appareil '{device_identifier}' introuvable."
        )

    # Vérification stricte des droits sur l'appareil
    ud = db.query(UserDevice).filter(
        UserDevice.user_id == user_id,
        UserDevice.device_id == dev.id
    ).first()
    if not ud:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cet appareil n'est pas associé à votre compte."
        )

    return dev.id

def build_site_response(site: Site, db: Session) -> SiteResponse:
    device_summary = None
    if site.device_id and site.device:
        ud = db.query(UserDevice).filter(
            UserDevice.user_id == site.user_id,
            UserDevice.device_id == site.device.id
        ).first()
        custom_name = ud.custom_name if ud and ud.custom_name else site.device.name
        device_summary = SiteDeviceSummary(
            id=site.device.id,
            device_id=site.device.device_id,
            name=custom_name,
            stream_url=f"/devices/{site.device.device_id}/stream",
            is_online=True
        )

    return SiteResponse(
        id=site.id,
        user_id=site.user_id,
        name=site.name,
        description=site.description,
        lat=site.lat,
        lng=site.lng,
        radius=site.radius,
        device_id=site.device_id,
        device=device_summary,
        created_at=site.created_at
    )


@router.get("", response_model=List[SiteResponse])
def get_my_sites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retourne la liste de tous les sites sur le plan de l'utilisateur avec le Raspberry Pi associé."""
    sites = db.query(Site).filter(Site.user_id == current_user.id).order_by(Site.created_at.desc()).all()
    return [build_site_response(s, db) for s in sites]


@router.post("", response_model=SiteResponse, status_code=status.HTTP_201_CREATED)
def create_site(
    site_in: SiteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Crée un nouveau site de surveillance sur le plan et l'associe facultativement à un Raspberry Pi."""
    resolved_id = resolve_device_id(site_in.device_id, current_user.id, db)

    new_site = Site(
        user_id=current_user.id,
        name=site_in.name.strip(),
        description=site_in.description.strip() if site_in.description else None,
        lat=site_in.lat,
        lng=site_in.lng,
        radius=site_in.radius,
        device_id=resolved_id
    )
    db.add(new_site)
    db.commit()
    db.refresh(new_site)

    return build_site_response(new_site, db)


@router.get("/{site_id}", response_model=SiteResponse)
def get_site(
    site_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retourne les informations d'un site spécifique."""
    site = db.query(Site).filter(Site.id == site_id, Site.user_id == current_user.id).first()
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site introuvable."
        )
    return build_site_response(site, db)


@router.put("/{site_id}", response_model=SiteResponse)
def update_site(
    site_id: int,
    site_update: SiteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Met à jour les informations d'un site ou modifie le Raspberry Pi associé."""
    site = db.query(Site).filter(Site.id == site_id, Site.user_id == current_user.id).first()
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site introuvable."
        )

    if site_update.name is not None:
        site.name = site_update.name.strip()
    if site_update.description is not None:
        site.description = site_update.description.strip()
    if site_update.lat is not None:
        site.lat = site_update.lat
    if site_update.lng is not None:
        site.lng = site_update.lng
    if site_update.radius is not None:
        site.radius = site_update.radius

    if "device_id" in site_update.__fields_set__:
        site.device_id = resolve_device_id(site_update.device_id, current_user.id, db)

    db.commit()
    db.refresh(site)
    return build_site_response(site, db)


@router.post("/{site_id}/assign", response_model=SiteResponse)
def assign_device_to_site(
    site_id: int,
    req: SiteAssignDeviceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Associe ou dissocie un Raspberry Pi 4 à ce site."""
    site = db.query(Site).filter(Site.id == site_id, Site.user_id == current_user.id).first()
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site introuvable."
        )

    site.device_id = resolve_device_id(req.device_id, current_user.id, db)
    db.commit()
    db.refresh(site)
    return build_site_response(site, db)


@router.delete("/{site_id}")
def delete_site(
    site_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Supprime un site du plan."""
    site = db.query(Site).filter(Site.id == site_id, Site.user_id == current_user.id).first()
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site introuvable."
        )

    db.delete(site)
    db.commit()
    return {"message": f"Le site '{site.name}' a été supprimé avec succès du plan."}
