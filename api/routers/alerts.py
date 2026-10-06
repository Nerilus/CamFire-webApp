import logging
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Alert, User
from schemas.alert_schema import AlertEmailResponse, AlertResponse
from services.email import send_fire_emergency_alert_email
from services.pdf_report import generate_incident_pdf

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/alerts", tags=["Alerts"])

# Confinement strict du stockage physique des snapshots pour prévenir le Path Traversal
BASE_STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
CAPTURES_DIR = (BASE_STATIC_DIR / "captures").resolve()


def _resolve_alert(alert_id: str, db: Session) -> Alert:
    """
    Récupère une alerte par son identifiant avec stratégie de repli sur le dernier incident.
    Lève une exception HTTP 404 si aucune alerte n'est disponible.
    """
    alert: Optional[Alert] = None
    clean_id = str(alert_id).strip()

    if clean_id.isdigit():
        alert = db.query(Alert).filter(Alert.id == int(clean_id)).first()

    # Stratégie de secours : si l'ID est absent ou non trouvé, récupérer le dernier incident actif
    if not alert:
        alert = db.query(Alert).order_by(Alert.date.desc()).first()

    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucune alerte enregistrée en base de données."
        )

    return alert


def _resolve_safe_snapshot_path(image_url: Optional[str]) -> Optional[str]:
    """
    Résout et valide canoniquement le chemin d'accès au fichier snapshot sur disque.
    Garantit l'absence de Path Traversal et vérifie l'existence physique du fichier.
    """
    if not image_url or "/static/captures/" not in image_url:
        return None

    filename = Path(image_url).name
    candidate_path = (CAPTURES_DIR / filename).resolve()

    # Sécurité critique : confinement dans le répertoire racine des captures
    if not candidate_path.is_relative_to(CAPTURES_DIR):
        logger.warning(
            "Tentative potentielle de Path Traversal bloquée lors de la résolution du snapshot",
            extra={"image_url": image_url, "resolved_path": str(candidate_path)}
        )
        return None

    if candidate_path.is_file():
        return str(candidate_path)

    logger.info("Le fichier snapshot physique n'est plus présent sur le disque", extra={"path": str(candidate_path)})
    return None


def _get_emergency_recipients(db: Session) -> List[str]:
    """
    Extrait, assainit et déduplique la liste des destinataires pour les alertes d'urgence.
    Corrige les fautes de frappe de noms de domaine courantes (ex: @gnail.com).
    """
    all_users = db.query(User).all()
    target_emails: List[str] = []

    for user in all_users:
        if not getattr(user, "emergency_alerts_enabled", True):
            continue

        raw_emails = getattr(user, "emergency_alert_email", None) or ""
        email_candidates = raw_emails.replace(";", ",").split(",")

        # Inclure également l'adresse email principale du compte si valide
        if user.email:
            email_candidates.append(user.email)

        for candidate in email_candidates:
            clean = candidate.strip()
            if not clean or "@" not in clean:
                continue

            # Auto-correction défensive des fautes de frappe utilisateur courantes
            if clean.endswith("@gnail.com"):
                clean = clean.replace("@gnail.com", "@gmail.com")

            if clean not in target_emails:
                target_emails.append(clean)

    # Adresse de secours si aucun utilisateur configuré
    if not target_emails:
        target_emails = ["nerilus.h@gmail.com"]

    return target_emails


@router.get(
    "/",
    response_model=List[AlertResponse],
    summary="Lister l'historique des alertes",
    description="Récupère la liste chronologique décroissante de l'ensemble des alertes enregistrées."
)
def get_all_alerts(db: Session = Depends(get_db)) -> List[AlertResponse]:
    """Retourne l'ensemble des alertes avec tri chronologique décroissant."""
    alerts = db.query(Alert).order_by(Alert.date.desc()).all()
    return [
        AlertResponse(
            id=str(alert.id),
            status=alert.status,
            location=alert.location,
            date=alert.date.isoformat() if alert.date else "",
            confidence=alert.confidence,
            coords=alert.coords,
            image_url=alert.image_url,
            detection_type=alert.detection_type or "fire"
        )
        for alert in alerts
    ]


@router.get(
    "/{alert_id}/pdf",
    summary="Télécharger le rapport PDF officiel",
    description="Génère à la volée et transmet le rapport d'incident certifié au format PDF."
)
def get_alert_pdf_report(
    alert_id: str,
    db: Session = Depends(get_db)
) -> FileResponse:
    """Génère dynamiquement et renvoie le rapport officiel d'incident au format PDF."""
    alert = _resolve_alert(alert_id, db)
    snapshot_path = _resolve_safe_snapshot_path(alert.image_url)

    incident_ref = f"CF-ALERT-{alert.id:04d}"
    detection_label = "Feu / Flammes" if alert.status == "fire" else "Avertissement / Fumée"

    try:
        pdf_path = generate_incident_pdf(
            incident_id=incident_ref,
            device_name=alert.location or "Caméra CamFire",
            location=alert.location or "Zone de Surveillance",
            confidence=float(alert.confidence or 0.0),
            detection_type=detection_label,
            image_path=snapshot_path,
            alert_date=alert.date
        )
    except Exception as pdf_err:
        logger.error(
            "Échec de la génération du rapport PDF d'incident",
            extra={"incident_ref": incident_ref, "error": str(pdf_err)},
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la génération du rapport PDF d'incident."
        ) from pdf_err

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"Rapport_Incident_CamFire_{incident_ref}.pdf"
    )


@router.post(
    "/{alert_id}/send-email",
    response_model=AlertEmailResponse,
    summary="Expédier le rapport d'incident par e-mail",
    description="Envoie par e-mail le rapport officiel certifié (PDF) avec photo attachée aux équipes désignées."
)
def send_alert_report_email(
    alert_id: str,
    db: Session = Depends(get_db)
) -> AlertEmailResponse:
    """Expédie le rapport officiel d'urgence par e-mail à l'ensemble des destinataires configurés."""
    alert = _resolve_alert(alert_id, db)
    snapshot_path = _resolve_safe_snapshot_path(alert.image_url)
    target_emails = _get_emergency_recipients(db)

    successful_recipients: List[str] = []
    failed_recipients: List[str] = []

    for email_addr in target_emails:
        try:
            send_fire_emergency_alert_email(
                recipient=email_addr,
                device_name=alert.location or "Caméra CamFire",
                location=alert.location or "Zone de Surveillance",
                confidence=float(alert.confidence or 0.0),
                image_path=snapshot_path
            )
            successful_recipients.append(email_addr)
        except Exception as email_err:
            logger.error(
                "Échec de transmission de l'alerte e-mail au destinataire",
                extra={"recipient": email_addr, "alert_id": alert.id, "error": str(email_err)},
                exc_info=True
            )
            failed_recipients.append(email_addr)

    if not successful_recipients and failed_recipients:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Échec de l'envoi de l'e-mail à tous les destinataires ({', '.join(failed_recipients)})."
        )

    logger.info(
        "Rapport officiel d'incident expédié avec succès",
        extra={"alert_id": alert.id, "recipients_count": len(successful_recipients)}
    )

    return AlertEmailResponse(
        status="success",
        recipients=successful_recipients,
        message=f"Rapport officiel PDF d'incident envoyé avec succès à {', '.join(successful_recipients)}."
    )


