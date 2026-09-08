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
    devices: List[DeviceResponse] = []

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str