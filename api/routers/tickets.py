from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from db.database import get_db
from db.models import Ticket, Device, User
from routers.auth import get_current_user
from schemas.ticket_schema import TicketCreateRequest, TicketResponse
from services.discord import send_discord_ticket_sync

router = APIRouter(
    prefix="/tickets",
    tags=["Tickets"]
)

@router.post("", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(ticket_in: TicketCreateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Vérifier que le device existe et appartient (ou est accessible) à l'utilisateur
    # Pour simplifier, on vérifie juste que le device existe
    device = db.query(Device).filter(Device.id == ticket_in.device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Caméra introuvable")

    # Déterminer la localisation via les sites ou les coordonnées
    location = "Inconnue"
    if device.sites:
        location = device.sites[0].name
    else:
        location = f"{device.lat}°N {device.lng}°E"

    new_ticket = Ticket(
        device_id=device.id,
        client_name=ticket_in.client_name,
        location=location,
        description=ticket_in.description
    )
    
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)

    # Envoi au webhook Discord
    send_discord_ticket_sync(
        client_name=new_ticket.client_name,
        location=new_ticket.location,
        device_id=device.device_id,
        camera_name=device.name,
        description=new_ticket.description,
        created_at=new_ticket.created_at
    )

    return new_ticket

@router.get("", response_model=List[TicketResponse])
def get_tickets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Récupérer tous les tickets (pour simplifier, on prend tous les tickets. 
    # En prod, on filtrerait probablement par les caméras de l'utilisateur)
    tickets = db.query(Ticket).order_by(Ticket.created_at.desc()).all()
    return tickets

