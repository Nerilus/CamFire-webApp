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
            "coords": alert.coords
        }
        for alert in alerts
    ]
