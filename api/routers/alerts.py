from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import Alert

router = APIRouter(prefix="/alerts", tags=["Alerts"])

@router.get("/")
def get_all_alerts(db: Session = Depends(get_db)):
    alerts = db.query(Alert).order_by(Alert.date.desc()).all()
    return [
        {
            "id": str(alert.id),
            "status": alert.status,
            "location": alert.location,
            "date": alert.date.isoformat(),
            "confidence": alert.confidence,
            "coords": alert.coords,
            "image_url": alert.image_url,
            "detection_type": alert.detection_type or "fire"
        }
        for alert in alerts
    ]


@router.get("/{alert_id}/pdf")
def get_alert_pdf_report(alert_id: int, db: Session = Depends(get_db)):
    """Génère et télécharge le rapport d'incident officiel au format PDF."""
    from fastapi import HTTPException
    from fastapi.responses import FileResponse
    import os
    from services.pdf_report import generate_incident_pdf

    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerte introuvable")

    img_path = None
    if alert.image_url:
        filename = alert.image_url.split('/')[-1]
        static_dir = os.path.join(os.path.dirname(__file__), "..", "static", "captures")
        candidate = os.path.join(static_dir, filename)
        if os.path.exists(candidate):
            img_path = candidate

    incident_ref = f"CF-ALERT-{alert.id:04d}"
    pdf_path = generate_incident_pdf(
        incident_id=incident_ref,
        device_name=alert.location or "Caméra CamFire",
        location=alert.location or "Zone de Surveillance",
        confidence=float(alert.confidence or 0.0),
        detection_type="Feu / Flammes" if alert.status == "fire" else "Avertissement / Fumée",
        image_path=img_path,
        alert_date=alert.date
    )

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"Rapport_Incident_CamFire_{incident_ref}.pdf"
    )
