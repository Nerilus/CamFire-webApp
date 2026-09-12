from pydantic import BaseModel, EmailStr
from typing import Optional, List
from schemas.device_schema import DeviceResponse

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    pair_device: bool = False
    device_id: Optional[str] = None
    pairing_code: Optional[str] = None
    device_name: Optional[str] = None

class UserUpdate(BaseModel):
    firstname: Optional[str] = None
    lastname: Optional[str] = None

class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    is_2fa_enabled: bool = True
    devices: List[DeviceResponse] = []

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class LoginResponse(BaseModel):
    requires_2fa: bool = False
    access_token: Optional[str] = None
    token_type: Optional[str] = None
    temp_token: Optional[str] = None
    email_masked: Optional[str] = None
    expires_in_seconds: Optional[int] = None

class Verify2FARequest(BaseModel):
    temp_token: str
    code: str

class Resend2FARequest(BaseModel):
    temp_token: str

class TwoFactorToggleRequest(BaseModel):
    is_2fa_enabled: bool

class Disable2FARequest(BaseModel):
    code: str

class EmergencyAlertSettings(BaseModel):
    emergency_alert_emails: List[str] = []
    emergency_alerts_enabled: bool = True