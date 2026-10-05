import httpx
from core.config import DISCORD_WEBHOOK_URL
import asyncio

import os
import json
from datetime import datetime

async def send_discord_alert(alert_type: str, location: str, confidence: float, image_url: str = None, image_path: str = None):
    if not DISCORD_WEBHOOK_URL:
        print("[DISCORD] DISCORD_WEBHOOK_URL non configuré, notification annulée.")
        return

    color = 0x00FF00
    title = "Alerte CamFire"
    
    if alert_type == "fire":
        color = 0xFF0000
        title = "🚨 ALERTE INCENDIE CRITIQUE DÉTECTÉE"
    elif alert_type == "warn":
        color = 0x0000FF
        title = "👤 INTRUSION / PRÉSENCE HUMAINE DÉTECTÉE"
    elif alert_type == "tamper":
        color = 0xFFA500
        title = "⚠️ COUPURE DE SIGNAL (SABOTAGE SUSPECTÉ)"

    now_str = datetime.now().strftime("%d/%m/%Y à %H:%M:%S")
    description = (
        f"**Source / Équipement :** {location}\n"
        f"**Indice de confiance IA :** {confidence:.1f}%\n"
        f"**Date et heure :** {now_str}\n\n"
        f"🚨 **Action requise :** Sinistre suspecté. Vérifiez immédiatement la zone ou contactez les secours (**18 / 112**)."
    )

    embed = {
        "title": title,
        "description": description,
        "color": color,
        "footer": {
            "text": "Système de Sécurité CamFire AI • Alerte Automatique"
        },
        "timestamp": datetime.utcnow().isoformat()
    }

    try:
        # Envoi multipart avec photo si le fichier existe sur disque
        if image_path and os.path.exists(image_path):
            embed["image"] = {"url": "attachment://incident.jpg"}
            payload_data = {"embeds": [embed]}
            with open(image_path, "rb") as f:
                img_data = f.read()

            files = {
                "files[0]": ("incident.jpg", img_data, "image/jpeg")
            }
            data = {
                "payload_json": json.dumps(payload_data)
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(DISCORD_WEBHOOK_URL, data=data, files=files)
                if resp.status_code in (200, 204):
                    print(f"[DISCORD] Notification avec photo envoyée ! (status: {resp.status_code})")
                else:
                    print(f"[DISCORD] Réponse Discord: {resp.status_code} - {resp.text}")
                return

        # Envoi JSON standard si pas de photo
        payload = {"embeds": [embed]}
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(DISCORD_WEBHOOK_URL, json=payload)
            if resp.status_code in (200, 204):
                print(f"[DISCORD] Notification texte envoyée ! (status: {resp.status_code})")
            else:
                print(f"[DISCORD] Réponse Discord: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"[DISCORD] Erreur lors de l'envoi de la notification Discord: {e}")

def send_discord_alert_sync(alert_type: str, location: str, confidence: float, image_url: str = None, image_path: str = None):
    if not DISCORD_WEBHOOK_URL:
        return
        
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(send_discord_alert(alert_type, location, confidence, image_url, image_path))
    except RuntimeError:
        asyncio.run(send_discord_alert(alert_type, location, confidence, image_url, image_path))

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
    title = "NOUVEAU TICKET DE RÉPARATION"
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

