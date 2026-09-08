from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class CaptureBase(BaseModel):
    detection_type: str = Field("person", description="Type de détection : person, fire, manual")
    status: str = Field("warn", description="Statut : warn, fire, safe")
    confidence: Optional[float] = Field(None, description="Confiance de détection en %")
    location: Optional[str] = Field("Raspberry 4", description="Localisation ou nom de l'appareil")
    image_url: str = Field(..., description="URL ou chemin de l'image")

class CaptureCreate(CaptureBase):
    user_id: Optional[int] = None
    device_id: Optional[int] = None

class CaptureResponse(CaptureBase):
    id: int
    user_id: Optional[int] = None
    device_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
