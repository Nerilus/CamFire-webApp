from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Union
import math
import re
import logging
import httpx

from db.database import get_db
from db.models import User, Device, UserDevice, Site, TacticalPoint
from schemas.site_schema import (
    SiteCreate, SiteUpdate, SiteResponse, SiteDeviceSummary, SiteAssignDeviceRequest,
    TacticalPointCreate, TacticalPointResponse,
    OsmHydrantItem, OsmHydrantScanResponse, OsmHydrantImportRequest, OsmHydrantImportResponse
)
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


# ---------- Points d'Intérêt DFCI (Réserves d'eau & Accès Pompiers) ----------

@router.get("/{site_id}/tactical-points", response_model=List[TacticalPointResponse])
def get_site_tactical_points(
    site_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retourne l'ensemble des points d'intérêt tactiques DFCI pour un site donné."""
    site = db.query(Site).filter(Site.id == site_id, Site.user_id == current_user.id).first()
    if not site:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site introuvable.")

    return db.query(TacticalPoint).filter(TacticalPoint.site_id == site_id).order_by(TacticalPoint.created_at.asc()).all()


@router.post("/{site_id}/tactical-points", response_model=TacticalPointResponse, status_code=status.HTTP_201_CREATED)
def create_site_tactical_point(
    site_id: int,
    pt_in: TacticalPointCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Ajoute un point d'eau, bouche incendie, barrière ou accès DFCI sur le site."""
    site = db.query(Site).filter(Site.id == site_id, Site.user_id == current_user.id).first()
    if not site:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site introuvable.")

    new_point = TacticalPoint(
        site_id=site_id,
        name=pt_in.name.strip(),
        point_type=pt_in.point_type.strip(),
        lat=pt_in.lat,
        lng=pt_in.lng,
        capacity_liters=pt_in.capacity_liters,
        notes=pt_in.notes.strip() if pt_in.notes else None
    )
    db.add(new_point)
    db.commit()
    db.refresh(new_point)
    return new_point


@router.delete("/tactical-points/{point_id}")
def delete_tactical_point(
    point_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Supprime un point d'intérêt tactique DFCI."""
    pt = db.query(TacticalPoint).join(Site).filter(
        TacticalPoint.id == point_id,
        Site.user_id == current_user.id
    ).first()
    if not pt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Point tactique introuvable.")

    db.delete(pt)
    db.commit()
    return {"message": "Point tactique supprimé avec succès."}


# ---------- Intégration API OpenData SDIS & OpenStreetMap (PEI / DFCI) ----------

logger = logging.getLogger(__name__)

OVERPASS_SERVERS = [
    "https://overpass.openstreetmap.fr/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
]

def calculate_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    """Calcule la distance géodésique en mètres entre deux coordonnées GPS."""
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return int(R * c)


async def fetch_osm_water_points(lat: float, lng: float, radius: int) -> list:
    """Interroge les serveurs Overpass API pour récupérer les bornes incendie et cuves DFCI."""
    query = f"""
    [out:json][timeout:15];
    (
      node["emergency"="fire_hydrant"](around:{radius},{lat},{lng});
      node["emergency"="water_tank"](around:{radius},{lat},{lng});
      node["emergency"="suction_point"](around:{radius},{lat},{lng});
      node["amenity"="fire_hydrant"](around:{radius},{lat},{lng});
      node["water_source"](around:{radius},{lat},{lng});
    );
    out body 100;
    """
    headers = {
        "User-Agent": "CamFire-App/2.0 (TacticalDFCI; contact@camfire.fr)"
    }

    async with httpx.AsyncClient(timeout=14.0, verify=False) as client:
        for server in OVERPASS_SERVERS:
            try:
                resp = await client.post(server, data={"data": query}, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    elements = data.get("elements", [])
                    logger.info(f"Overpass {server}: {len(elements)} éléments trouvés")
                    return elements
                else:
                    logger.warning(f"Overpass {server} a répondu avec code {resp.status_code}")
            except Exception as e:
                logger.warning(f"Overpass {server} erreur: {e}")
                continue
    return []


def parse_osm_node_to_item(el: dict, center_lat: float, center_lng: float) -> dict:
    """Convertit un nœud brut OpenStreetMap en objet structuré DFCI."""
    osm_id = el.get("id")
    lat = float(el.get("lat"))
    lng = float(el.get("lon"))
    tags = el.get("tags", {})

    emergency = tags.get("emergency", "")
    amenity = tags.get("amenity", "")
    water_source = tags.get("water_source", "")

    if emergency == "water_tank" or water_source in ["water_tank", "reservoir"]:
        point_type = "water_tank"
        default_name = "Citerne DFCI"
    elif emergency == "suction_point" or water_source in ["pond", "lake"]:
        point_type = "pool"
        default_name = "Point d'aspiration PEI"
    else:
        point_type = "hydrant"
        default_name = "Poteau Incendie PEI"

    ref = tags.get("ref") or tags.get("fire_hydrant:ref") or tags.get("name")
    if ref:
        name = f"{default_name} #{ref}"
    else:
        name = f"{default_name} ({str(osm_id)[-4:]})"

    capacity_liters = None
    raw_cap = tags.get("capacity") or tags.get("fire_hydrant:flow")
    if raw_cap:
        nums = re.findall(r'\d+', str(raw_cap))
        if nums:
            val = int(nums[0])
            if "m3" in str(raw_cap).lower() or val <= 500:
                capacity_liters = val * 1000
            else:
                capacity_liters = val
    elif point_type == "hydrant":
        capacity_liters = 60000
    elif point_type == "water_tank":
        capacity_liters = 30000

    notes_parts = []
    h_type = tags.get("fire_hydrant:type")
    if h_type:
        notes_parts.append(f"Type: {h_type}")
    h_diam = tags.get("fire_hydrant:diameter")
    if h_diam:
        notes_parts.append(f"Diamètre: DN{h_diam}")
    h_press = tags.get("fire_hydrant:pressure")
    if h_press:
        notes_parts.append(f"Pression: {h_press}")
    h_pos = tags.get("fire_hydrant:position")
    if h_pos:
        notes_parts.append(f"Position: {h_pos}")
    operator = tags.get("operator")
    if operator:
        notes_parts.append(f"SDIS / Gestionnaire: {operator}")
    notes_parts.append("Source: OpenData SDIS/OSM")

    dist = calculate_distance_meters(center_lat, center_lng, lat, lng)

    return {
        "osm_id": osm_id,
        "name": name[:120],
        "point_type": point_type,
        "lat": lat,
        "lng": lng,
        "distance_meters": dist,
        "capacity_liters": capacity_liters,
        "notes": " · ".join(notes_parts)[:250]
    }


@router.get("/{site_id}/scan-osm-hydrants", response_model=OsmHydrantScanResponse)
async def scan_osm_hydrants(
    site_id: int,
    radius: int = 2500,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Scanne les bornes incendie et cuves DFCI répertoriées en OpenData (SDIS / OpenStreetMap) autour du site."""
    site = db.query(Site).filter(Site.id == site_id, Site.user_id == current_user.id).first()
    if not site:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site introuvable.")

    radius = max(200, min(radius, 20000))
    elements = await fetch_osm_water_points(site.lat, site.lng, radius)

    existing_pts = db.query(TacticalPoint).filter(TacticalPoint.site_id == site_id).all()

    items = []
    for el in elements:
        try:
            item_dict = parse_osm_node_to_item(el, site.lat, site.lng)
            is_already = any(
                calculate_distance_meters(pt.lat, pt.lng, item_dict["lat"], item_dict["lng"]) < 15
                for pt in existing_pts
            )
            item_dict["already_imported"] = is_already
            items.append(OsmHydrantItem(**item_dict))
        except Exception:
            continue

    items.sort(key=lambda x: x.distance_meters)
    return OsmHydrantScanResponse(
        total_found=len(items),
        radius_meters=radius,
        items=items
    )


@router.post("/{site_id}/import-osm-hydrants", response_model=OsmHydrantImportResponse)
async def import_osm_hydrants(
    site_id: int,
    req: OsmHydrantImportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Importe automatiquement les bornes incendie officielles détectées autour du site comme points DFCI."""
    site = db.query(Site).filter(Site.id == site_id, Site.user_id == current_user.id).first()
    if not site:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site introuvable.")

    radius = max(200, min(req.radius_meters, 20000))
    elements = await fetch_osm_water_points(site.lat, site.lng, radius)

    existing_pts = db.query(TacticalPoint).filter(TacticalPoint.site_id == site_id).all()

    imported_list = []
    already_existing_count = 0

    selected_set = set(req.selected_osm_ids) if req.selected_osm_ids else None

    for el in elements:
        osm_id = el.get("id")
        if selected_set is not None and osm_id not in selected_set:
            continue

        try:
            item_dict = parse_osm_node_to_item(el, site.lat, site.lng)

            is_already = any(
                calculate_distance_meters(pt.lat, pt.lng, item_dict["lat"], item_dict["lng"]) < 15
                for pt in existing_pts
            )
            if is_already:
                already_existing_count += 1
                continue

            new_pt = TacticalPoint(
                site_id=site_id,
                name=item_dict["name"],
                point_type=item_dict["point_type"],
                lat=item_dict["lat"],
                lng=item_dict["lng"],
                capacity_liters=item_dict["capacity_liters"],
                notes=item_dict["notes"]
            )
            db.add(new_pt)
            existing_pts.append(new_pt)
            imported_list.append(new_pt)
        except Exception:
            continue

    if imported_list:
        db.commit()
        for p in imported_list:
            db.refresh(p)

    return OsmHydrantImportResponse(
        imported_count=len(imported_list),
        already_existing=already_existing_count,
        total_found=len(elements),
        points=imported_list
    )

