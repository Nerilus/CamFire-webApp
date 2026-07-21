from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from typing import Dict, Any
from db.models import User
from routers.auth import get_current_user
from services.predict import process_image, generate_video_stream

router = APIRouter(
    prefix="/scan",
    tags=["Scan & AI"]
)

@router.get("/stream")
async def stream_camera():
    camera_url = "http://root:root@192.168.1.90/axis-cgi/mjpg/video.cgi"
    return StreamingResponse(
        generate_video_stream(camera_url),
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
