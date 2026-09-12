from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from fastapi.responses import StreamingResponse
from typing import Dict, Any
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import User, UserDevice
from routers.auth import get_current_user
from routers.devices import get_user_from_token_or_header
from services.predict import process_image, generate_video_stream

from core.config import CAMERA_URL

router = APIRouter(
    prefix="/scan",
    tags=["Scan & AI"]
)

@router.get("/stream")
async def stream_camera(
    user: User = Depends(get_user_from_token_or_header),
    db: Session = Depends(get_db)
):
    """Flux vidéo sécurisé : interdit si aucun appareil n'est connecté au compte."""
    user_device = db.query(UserDevice).filter(UserDevice.user_id == user.id).first()
    if not user_device or not user_device.device:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès interdit : aucun appareil n'est connecté à votre compte."
        )
    target_url = user_device.device.stream_url or CAMERA_URL
    device_id = user_device.device.device_id if user_device.device else None
    return StreamingResponse(
        generate_video_stream(target_url, device_id=device_id),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@router.get("/status")
async def get_stream_status():
    from services.predict import latest_detection
    return latest_detection

@router.get("/debug")
async def debug_camera():
    import httpx
    camera_url = "http://192.168.1.90/axis-cgi/mjpg/video.cgi"
    try:
        # Test Basic Auth first
        with httpx.Client(auth=httpx.BasicAuth("root", "root")) as client:
            resp = client.get(camera_url, timeout=5.0)
            if resp.status_code == 401:
                # Test Digest Auth
                with httpx.Client(auth=httpx.DigestAuth("root", "root")) as client2:
                    resp = client2.get(camera_url, timeout=5.0)
            
            return {
                "status_code": resp.status_code,
                "headers": dict(resp.headers),
                "content_preview": repr(resp.content[:100]) if resp.content else "None"
            }
    except Exception as e:
        return {"error": str(e)}

@router.post("/predict")
async def predict_fire(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Seules les images sont supportées")
    
    try:
        contents = await file.read()
        result = process_image(contents)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'analyse : {str(e)}")
