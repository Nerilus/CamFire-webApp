from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DevicePairRequest(BaseModel):
    device_id: str
    pairing_code: str
    name: Optional[str] = None

class DeviceProvisionRequest(BaseModel):
    device_id: str
    pairing_code: str
    stream_url: Optional[str] = "https://safely-virgin-mistress-staying.trycloudflare.com/stream.mjpg"
    name: Optional[str] = "Raspberry 4"

class DeviceUnpairRequest(BaseModel):
    password: str

class DeviceHeartbeatRequest(BaseModel):
    timestamp: float
    nonce: str
    cpu_temp: Optional[float] = None
    tamper_detected: bool = False
    signature: str
    stream_url: Optional[str] = None

class DeviceUpdateRequest(BaseModel):
    name: Optional[str] = None
    stream_url: Optional[str] = None

class DeviceResponse(BaseModel):
    id: int
    device_id: str
    name: str
    is_paired: bool
    role: Optional[str] = "owner"
    paired_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    status: str = "online"
    tamper_status: Optional[str] = "normal"
    cpu_temp: Optional[float] = None

    class Config:
        from_attributes = True


class DeviceMemberResponse(BaseModel):
    user_id: int
    email: str
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    role: str
    paired_at: Optional[datetime] = None

class StreamTicketResponse(BaseModel):
    ticket: str
    expires_in: int = 60
    stream_url: str

class RefreshCodeResponse(BaseModel):
    device_id: str
    new_pairing_code: str
    expires_at: Optional[datetime] = None

