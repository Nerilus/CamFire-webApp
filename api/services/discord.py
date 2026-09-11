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
