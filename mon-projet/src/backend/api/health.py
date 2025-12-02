"""Health endpoints (ADB + infrastructure)."""
import subprocess
import time
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import text

from api.security import require_api_key
from core.config import settings
from core.database import engine
from core.adb_path import ADB_EXECUTABLE

router = APIRouter(prefix="/health", tags=["health"], dependencies=[Depends(require_api_key)])


def _resolve_adb_cli() -> str:
    """Return the most appropriate adb command for the current runtime."""
    configured = (settings.ADB_PATH or "").strip()
    if configured and configured.lower() != "adb":
        return configured
    return ADB_EXECUTABLE


def _check_adb() -> Dict[str, Any]:
    payload: Dict[str, Any] = {"ok": False}
    start = time.perf_counter()
    adb_cli = _resolve_adb_cli()
    try:
        result = subprocess.run([adb_cli, "devices"], capture_output=True, text=True, timeout=5)
        payload["latency_ms"] = round((time.perf_counter() - start) * 1000, 1)
        payload["stdout"] = result.stdout
        if result.returncode != 0:
            payload["error"] = result.stderr or "ADB returned non-zero exit code"
            return payload
        payload["ok"] = True
        return payload
    except Exception as exc:  # pragma: no cover - defensive
        payload["error"] = str(exc)
        return payload


def _check_database() -> Dict[str, Any]:
    payload: Dict[str, Any] = {"ok": False}
    if engine is None:
        payload["error"] = "Engine not initialised"
        return payload
    start = time.perf_counter()
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        payload["ok"] = True
        payload["latency_ms"] = round((time.perf_counter() - start) * 1000, 1)
        return payload
    except Exception as exc:  # pragma: no cover - defensive
        payload["error"] = str(exc)
        return payload


@router.get("/")
async def health_summary():
    """Combined health summary with backend version + infra checks."""
    adb = _check_adb()
    database = _check_database()
    overall_ok = adb.get("ok") and database.get("ok")
    return {
        "status": "ok" if overall_ok else "degraded",
        "version": settings.APP_VERSION,
        "checks": {
            "adb": adb,
            "database": database,
        },
    }


@router.get("/adb")
async def adb_health():
    """Check ADB availability by running 'adb devices'."""
    adb_result = _check_adb()
    if not adb_result.get("ok"):
        raise HTTPException(status_code=500, detail=adb_result.get("error", "ADB check failed"))
    return {"status": "ok", "stdout": adb_result.get("stdout"), "latency_ms": adb_result.get("latency_ms")}
