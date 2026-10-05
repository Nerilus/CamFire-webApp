import logging
from enum import Enum
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path as FastPath, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Capture
from schemas.capture_schema import CaptureCreate, CaptureResponse

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/captures",
    tags=["Captures & Photos"]
)

# Confinement strict du stockage physique pour prévenir toute attaque par Path Traversal
BASE_STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
CAPTURES_DIR = (BASE_STATIC_DIR / "captures").resolve()
CAPTURES_DIR.mkdir(parents=True, exist_ok=True)


class DetectionTypeFilter(str, Enum):
    ALL = "all"
    PERSON = "person"
    FIRE = "fire"
    SMOKE = "smoke"
    MANUAL = "manual"


def _safe_unlink_capture_file(image_url: Optional[str]) -> bool:
    """
    Supprime de manière sécurisée le fichier physique associé à une capture.
    
    Garanties de sécurité et résilience :
    - Vérifie que le chemin résolu reste strictement confiné dans CAPTURES_DIR (anti Path Traversal).
    - Idempotence : Ne lève pas d'exception si le fichier a déjà été supprimé ou n'existe pas.
    - Évite l'interruption du service si le fichier est verrouillé par l'OS.
    """
    if not image_url or "/static/captures/" not in image_url:
        return False

    raw_filename = Path(image_url).name
    target_path = (CAPTURES_DIR / raw_filename).resolve()

    # Sécurité critique : confinement dans le répertoire racine des captures
    if not target_path.is_relative_to(CAPTURES_DIR):
        logger.warning(
            "Tentative potentielle de Path Traversal détectée et bloquée",
            extra={"image_url": image_url, "resolved_path": str(target_path)}
        )
        return False

    try:
        target_path.unlink(missing_ok=True)
        logger.info("Fichier snapshot physique supprimé du disque", extra={"filepath": str(target_path)})
        return True
    except OSError as err:
        logger.error(
            "Échec de suppression physique du fichier snapshot sur le disque",
            extra={"filepath": str(target_path), "error": str(err)},
            exc_info=True
        )
        return False


@router.get(
    "/",
    response_model=List[CaptureResponse],
    summary="Lister et filtrer les captures photo",
    description="Récupère l'historique paginé des détections avec filtrage optionnel par catégorie."
)
def get_captures(
    detection_type: Optional[DetectionTypeFilter] = Query(
        default=None,
        description="Filtrer par type de détection (person, fire, smoke, manual)"
    ),
    limit: int = Query(
        default=60,
        ge=1,
        le=200,
        description="Nombre maximum d'éléments à retourner (pagination)"
    ),
    offset: int = Query(
        default=0,
        ge=0,
        description="Décalage pour la pagination"
    ),
    db: Session = Depends(get_db)
) -> List[Capture]:
    """Récupère l'ensemble des captures enregistrées avec application des filtres et pagination."""
    query = db.query(Capture)

    # Filtrage sémantique : regroupe feu et fumée sous une même catégorie d'alerte incendie
    if detection_type and detection_type != DetectionTypeFilter.ALL:
        if detection_type in (DetectionTypeFilter.FIRE, DetectionTypeFilter.SMOKE):
            query = query.filter(Capture.detection_type.in_(["fire", "smoke"]))
        else:
            query = query.filter(Capture.detection_type == detection_type.value)

    return (
        query
        .order_by(Capture.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.delete(
    "/{capture_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Supprimer une capture",
    description="Supprime l'entrée en base de données de manière transactionnelle puis détruit le fichier disque."
)
def delete_capture(
    capture_id: int = FastPath(..., ge=1, description="Identifiant unique de la capture"),
    db: Session = Depends(get_db)
) -> None:
    """
    Supprime une capture avec garantie d'atomicité :
    La transaction SQL est validée (commit) AVANT la suppression du fichier disque.
    Si le commit SQL échoue, le fichier physique est préservé, évitant ainsi un état corrompu.
    """
    capture = db.query(Capture).filter(Capture.id == capture_id).first()
    if not capture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Capture #{capture_id} introuvable."
        )

    image_url_to_cleanup = capture.image_url

    try:
        db.delete(capture)
        db.commit()
    except SQLAlchemyError as db_err:
        db.rollback()
        logger.error(
            "Échec de la transaction SQL lors de la suppression de la capture",
            extra={"capture_id": capture_id, "error": str(db_err)},
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur interne lors de la suppression en base de données."
        ) from db_err

    # Nettoyage physique du stockage uniquement après confirmation du commit SQL
    _safe_unlink_capture_file(image_url_to_cleanup)
    return None


@router.post(
    "/manual",
    response_model=CaptureResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer une capture manuelle",
    description="Enregistre une capture initiée manuellement par l'opérateur avec validation transactionnelle."
)
def create_manual_capture(
    data: CaptureCreate,
    db: Session = Depends(get_db)
) -> Capture:
    """Valide et persiste une capture manuelle dans la base de données."""
    new_capture = Capture(
        user_id=data.user_id,
        device_id=data.device_id,
        detection_type=data.detection_type,
        status=data.status,
        confidence=data.confidence,
        location=data.location,
        image_url=data.image_url
    )

    try:
        db.add(new_capture)
        db.commit()
        db.refresh(new_capture)
        logger.info(
            "Nouvelle capture manuelle créée avec succès",
            extra={"capture_id": new_capture.id, "location": new_capture.location}
        )
        return new_capture
    except SQLAlchemyError as db_err:
        db.rollback()
        logger.error(
            "Échec d'enregistrement de la capture manuelle en base de données",
            extra={"payload": data.model_dump(), "error": str(db_err)},
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Impossible d'enregistrer la capture manuelle."
        ) from db_err

