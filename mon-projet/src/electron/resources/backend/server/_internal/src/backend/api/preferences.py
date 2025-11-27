"""User preferences API."""
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.security import require_api_key
from core.database import get_db
from models.user_preference import UserPreference

router = APIRouter(
    prefix="/preferences",
    tags=["preferences"],
    dependencies=[Depends(require_api_key)],
)


class PreferencePayload(BaseModel):
    value: Optional[Any] = None


@router.get("/", response_model=Dict[str, Any])
async def list_preferences(db: Session = Depends(get_db)):
    """Return all stored preferences as a dict."""
    prefs = db.query(UserPreference).all()
    return {pref.key: pref.value for pref in prefs}


@router.get("/{key}", response_model=Dict[str, Any])
async def get_preference(key: str, db: Session = Depends(get_db)):
    pref = db.query(UserPreference).filter(UserPreference.key == key).first()
    if not pref:
        raise HTTPException(status_code=404, detail="Preference not found")
    return {"key": key, "value": pref.value}


@router.put("/{key}", response_model=Dict[str, Any])
async def upsert_preference(key: str, payload: PreferencePayload, db: Session = Depends(get_db)):
    pref = db.query(UserPreference).filter(UserPreference.key == key).first()
    if pref:
        pref.value = payload.value
    else:
        pref = UserPreference(key=key, value=payload.value)
        db.add(pref)
    db.commit()
    return {"key": key, "value": pref.value}


@router.delete("/{key}", response_model=Dict[str, Any])
async def delete_preference(key: str, db: Session = Depends(get_db)):
    pref = db.query(UserPreference).filter(UserPreference.key == key).first()
    if not pref:
        raise HTTPException(status_code=404, detail="Preference not found")
    db.delete(pref)
    db.commit()
    return {"key": key, "deleted": True}
