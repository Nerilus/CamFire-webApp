from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from db.database import get_db
from db.models import User, EmergencyContact
from schemas.contact_schema import ContactCreate, ContactResponse
from routers.auth import get_current_user

router = APIRouter(
    prefix="/contacts",
    tags=["Emergency Contacts"]
)

@router.get("/", response_model=List[ContactResponse])
def get_contacts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    contacts = db.query(EmergencyContact).filter(EmergencyContact.user_id == current_user.id).all()
    return contacts

@router.post("/", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
def add_contact(contact_in: ContactCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_contact = EmergencyContact(
        user_id=current_user.id,
        name=contact_in.name,
        phone=contact_in.phone,
        role=contact_in.role
    )
    db.add(new_contact)
    db.commit()
    db.refresh(new_contact)
    return new_contact

@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(contact_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    contact = db.query(EmergencyContact).filter(EmergencyContact.id == contact_id, EmergencyContact.user_id == current_user.id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact d'urgence non trouvé ou vous n'avez pas l'autorisation de le supprimer")
    
    db.delete(contact)
    db.commit()
    return None
