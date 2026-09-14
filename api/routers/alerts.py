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


@router.post("/{alert_id}/send-email")
def send_alert_report_email(
    alert_id: int,
    db: Session = Depends(get_db)
):
    """Envoie par e-mail le rapport officiel certifié (PDF) de l'incident avec photo attachée."""
    from fastapi import HTTPException
    import os
    from db.models import User
    from services.email import send_fire_emergency_alert_email

    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alerte introuvable")

    # Récupérer les utilisateurs ayant configuré les alertes
    all_users = db.query(User).all()
    target_emails = []
    for u in all_users:
        if getattr(u, "emergency_alerts_enabled", True):
            raw_emails = getattr(u, "emergency_alert_email", None) or ""
            for em in raw_emails.replace(";", ",").split(","):
                if em.strip() and "@" in em:
                    clean = em.strip()
                    if clean.endswith("@gnail.com"):
                        clean = clean.replace("@gnail.com", "@gmail.com")
                    if clean not in target_emails:
                        target_emails.append(clean)
            if u.email and u.email.strip() and "@" in u.email:
                clean_primary = u.email.strip()
                if clean_primary not in target_emails:
                    target_emails.append(clean_primary)

    if not target_emails:
        target_emails = ["nerilus.h@gmail.com"]

    img_path = None
    if alert.image_url:
        filename = alert.image_url.split('/')[-1]
        static_dir = os.path.join(os.path.dirname(__file__), "..", "static", "captures")
        candidate = os.path.join(static_dir, filename)
        if os.path.exists(candidate):
            img_path = candidate

    sent_list = []
    for em in target_emails:
        send_fire_emergency_alert_email(
            recipient=em,
            device_name=alert.location or "Caméra CamFire",
            location=alert.location or "Zone de Surveillance",
            confidence=float(alert.confidence or 0.0),
            image_path=img_path
        )
        sent_list.append(em)

    return {
        "status": "success",
        "recipients": sent_list,
        "message": f"Rapport officiel PDF d'incident envoyé avec succès à {', '.join(sent_list)}."
    }

