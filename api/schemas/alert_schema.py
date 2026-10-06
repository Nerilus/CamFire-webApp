from pydantic import BaseModel, Field
from typing import Optional, List


class AlertResponse(BaseModel):
    id: str = Field(..., description="Identifiant unique de l'alerte (format chaîne)")
    status: str = Field(..., description="Statut de l'alerte : fire ou warn")
    location: str = Field(..., description="Localisation ou désignation de l'appareil")
    date: str = Field(..., description="Date et heure de l'incident (format ISO 8601)")
    confidence: Optional[float] = Field(None, description="Indice de confiance de l'IA en %")
    coords: Optional[str] = Field(None, description="Coordonnées GPS de la zone")
    image_url: Optional[str] = Field(None, description="URL de la photo snapshot liée")
    detection_type: str = Field("fire", description="Type de détection : fire, smoke, person, manual")

    class Config:
        from_attributes = True


class AlertEmailResponse(BaseModel):
    status: str = Field(..., description="Statut de l'envoi : success ou error")
    recipients: List[str] = Field(..., description="Liste des adresses e-mails notifiées")
    message: str = Field(..., description="Message explicatif de la réponse")
