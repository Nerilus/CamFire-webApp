import os
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from db.database import get_db
from db.models import Capture
from schemas.capture_schema import CaptureResponse, CaptureCreate

router = APIRouter(
    prefix="/captures",
    tags=["Captures & Photos"]
)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")
CAPTURES_DIR = os.path.join(STATIC_DIR, "captures")

@router.get("/", response_model=List[CaptureResponse])
def get_captures(
    detection_type: Optional[str] = Query(None, description="Filtrer par type : person, fire, manual"),
    limit: int = Query(60, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Récupère l'ensemble des vraies captures photo enregistrées par l'IA et l'utilisateur."""
    query = db.query(Capture)
    if detection_type:
        if detection_type in ("fire", "smoke"):
            query = query.filter(Capture.detection_type.in_(["fire", "smoke"]))
        else:
            query = query.filter(Capture.detection_type == detection_type)
    captures = query.order_by(Capture.created_at.desc()).limit(limit).all()
    return captures

@router.delete("/{capture_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_capture(
    capture_id: int,
    db: Session = Depends(get_db)
):
    """Supprime une capture photo en base de données et supprime le fichier JPEG sur le disque."""
    capture = db.query(Capture).filter(Capture.id == capture_id).first()
    if not capture:
        raise HTTPException(status_code=404, detail="Capture introuvable")
    
    # Suppression du fichier sur disque si dans /static/captures/
    if capture.image_url and "/static/captures/" in capture.image_url:
        filename = os.path.basename(capture.image_url)
        filepath = os.path.join(CAPTURES_DIR, filename)
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception as e:
                print(f"Erreur suppression fichier image {filepath}: {e}")

    db.delete(capture)
    db.commit()
    return None

@router.post("/manual", response_model=CaptureResponse, status_code=status.HTTP_201_CREATED)
def create_manual_capture(
    data: CaptureCreate,
    db: Session = Depends(get_db)
):
    """Enregistre manuellement une capture photo."""
    capture = Capture(
        user_id=data.user_id,
        device_id=data.device_id,
        detection_type=data.detection_type,
        status=data.status,
        confidence=data.confidence,
        location=data.location,
        image_url=data.image_url
    )
    db.add(capture)
    db.commit()
    db.refresh(capture)
    return capture
