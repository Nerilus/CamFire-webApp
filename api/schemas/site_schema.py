from pydantic import BaseModel, Field
from typing import Optional, Union
from datetime import datetime

class SiteDeviceSummary(BaseModel):
    id: int
    device_id: str
    name: str
    stream_url: Optional[str] = None
    is_online: bool = True

    class Config:
        from_attributes = True

class SiteBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Nom du site")
    description: Optional[str] = Field(None, description="Description du site ou de la parcelle")
    lat: float = Field(..., description="Latitude géographique")
    lng: float = Field(..., description="Longitude géographique")
    radius: float = Field(500.0, ge=50, le=50000, description="Rayon de couverture en mètres")
    device_id: Optional[Union[int, str]] = Field(None, description="Identifiant numérique ou code matériel du Raspberry Pi associé")

class SiteCreate(SiteBase):
    pass

class SiteUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius: Optional[float] = None
    device_id: Optional[Union[int, str]] = None

class SiteAssignDeviceRequest(BaseModel):
    device_id: Optional[Union[int, str]] = None

class SiteResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str] = None
    lat: float
    lng: float
    radius: float
    device_id: Optional[int] = None
    device: Optional[SiteDeviceSummary] = None
    created_at: datetime

    class Config:
        from_attributes = True
