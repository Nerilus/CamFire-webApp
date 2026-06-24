from pydantic import BaseModel

class ContactBase(BaseModel):
    name: str
    phone: str
    role: str

class ContactCreate(ContactBase):
    pass

class ContactResponse(ContactBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True
