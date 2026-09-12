from pydantic import BaseModel
from typing import Optional

class ContactBase(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    role: str

class ContactCreate(ContactBase):
    pass

class ContactResponse(ContactBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True
