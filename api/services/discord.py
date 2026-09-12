import httpx
from core.config import DISCORD_WEBHOOK_URL
import asyncio

async def send_discord_alert(alert_type: str, location: str, confidence: float, image_url: str = None):
    if not DISCORD_WEBHOOK_URL:
        return

    color = 0x00FF00
    title = "Alerte CamFire"
    
    if alert_type == "fire":
        color = 0xFF0000
        title = "🔥 ALERTE INCENDIE DÉTECTÉE"
    elif alert_type == "warn":
        color = 0x0000FF
        title = "👤 INTRUSION DÉTECTÉE"
    elif alert_type == "tamper":
        color = 0xFFA500
        title = "⚠️ COUPURE DE SIGNAL (SABOTAGE)"

    description = f"**Lieu :** {location}\n**Confiance :** {confidence}%"

    embed = {
        "title": title,
        "description": description,
        "color": color
    }

    if image_url:
        # Note: image_url from the backend is a local path like /static/captures/...
        # Discord cannot access localhost. We can only pass external URLs.
        pass
        
    payload = {
        "embeds": [embed]
    }

    try:
        async with httpx.AsyncClient() as client:
            await client.post(DISCORD_WEBHOOK_URL, json=payload)
    except Exception as e:
        print(f"Erreur lors de l'envoi de la notification Discord: {e}")

def send_discord_alert_sync(alert_type: str, location: str, confidence: float, image_url: str = None):
    if not DISCORD_WEBHOOK_URL:
        return
        
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(send_discord_alert(alert_type, location, confidence, image_url))
    except RuntimeError:
        asyncio.run(send_discord_alert(alert_type, location, confidence, image_url))

def send_discord_ticket_sync(client_name: str, location: str, device_id: str, camera_name: str, description: str = None, created_at=None):
    from core.config import DISCORD_TICKET_WEBHOOK_URL
    if not DISCORD_TICKET_WEBHOOK_URL:
        return
        
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(send_discord_ticket(client_name, location, device_id, camera_name, description, created_at))
    except RuntimeError:
        asyncio.run(send_discord_ticket(client_name, location, device_id, camera_name, description, created_at))

async def send_discord_ticket(client_name: str, location: str, device_id: str, camera_name: str, description: str = None, created_at=None):
    from core.config import DISCORD_TICKET_WEBHOOK_URL
    if not DISCORD_TICKET_WEBHOOK_URL:
        return

    from datetime import datetime
    title = "🛠️ NOUVEAU TICKET DE RÉPARATION"
    color = 0xFF8C00 # Dark Orange

    # Format de la date (identique au format frontend "11/09/2026 15:39:48")
    if created_at is None:
        created_at = datetime.utcnow()
    date_str = created_at.strftime("%d/%m/%Y %H:%M:%S")

    desc = f"**Date de soumission :** {date_str}\n\n**Client :** {client_name}\n**Localisation :** {location}\n**Nom Caméra :** {camera_name}\n**Numéro (ID) :** {device_id}"
    if description:
        desc += f"\n\n**Description :**\n{description}"

    embed = {
        "title": title,
        "description": desc,
        "color": color
    }

    payload = {
        "embeds": [embed]
    }

    try:
        async with httpx.AsyncClient() as client:
            await client.post(DISCORD_TICKET_WEBHOOK_URL, json=payload)
    except Exception as e:
        print(f"Erreur lors de l'envoi du ticket Discord: {e}")

