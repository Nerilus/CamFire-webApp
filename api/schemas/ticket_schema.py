from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TicketCreateRequest(BaseModel):
    client_name: str
    description: Optional[str] = None
    device_id: int

class TicketResponse(BaseModel):
    id: int
    device_id: Optional[int]
    client_name: str
    location: Optional[str]
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
