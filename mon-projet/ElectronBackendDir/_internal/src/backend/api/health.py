"""Health endpoints (ADB)."""
import subprocess
from fastapi import APIRouter, HTTPException, Depends

from api.security import require_api_key

router = APIRouter(prefix="/health", tags=["health"], dependencies=[Depends(require_api_key)])


@router.get("/adb")
async def adb_health():
    """Check ADB availability by running 'adb devices'."""
    try:
        result = subprocess.run(["adb", "devices"], capture_output=True, text=True, timeout=5)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"ADB check failed: {exc}")
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr or "ADB returned non-zero")
    return {"status": "ok", "stdout": result.stdout}
