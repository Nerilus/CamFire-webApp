from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from typing import Dict, Any
from db.models import User
from routers.auth import get_current_user
from services.predict import process_image

router = APIRouter(
    prefix="/scan",
    tags=["Scan & AI"]
)

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
