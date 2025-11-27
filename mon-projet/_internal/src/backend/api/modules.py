"""Modules API endpoints for compatibility."""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

# Import compatible both from backend cwd and project root
try:
    from modules.telco_modules import TelcoModules, DEFAULT_WRONG_APN
except ImportError:  # pragma: no cover
    from src.backend.modules.telco_modules import TelcoModules, DEFAULT_WRONG_APN  # type: ignore

logger = logging.getLogger(__name__)

router = APIRouter()


class ModuleExecute(BaseModel):
    device_id: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)


def _base_module_fields(module: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure modules carry the shape expected by the frontend service."""
    default_fields = {
        "version": "1.0.0",
        "steps": [],
        "input_schema": {},
        "output_schema": {},
        "timeout_seconds": 120,
        "requires_root": False,
        "device_compatibility": {},
        "status": "active",
    }
    enriched = {**default_fields, **module}
    return enriched


modules_db: List[Dict[str, Any]] = [
    {
        "id": "voice_call_test",
        "name": "Voice Call Test",
        "description": "Test voice call functionality and quality",
        "category": "communication",
        "complexity": "simple",
        "duration_estimate": "30-45s",
        "parameters": {
            "number": {"type": "string", "required": True, "default": "+1234567890"},
            "duration": {"type": "integer", "required": False, "default": 10},
            "call_count": {"type": "integer", "required": False, "default": 1},
        },
        "requirements": ["microphone", "speaker"],
        "last_run": "2m ago",
        "success_rate": 95.5,
        "total_runs": 127,
    },
    {
        "id": "enable_airplane_mode",
        "name": "Airplane Mode On",
        "description": "Enable airplane mode to suspend radios",
        "category": "device",
        "complexity": "simple",
        "duration_estimate": "<30s",
        "parameters": {},
        "requirements": ["adb"],
        "last_run": None,
        "success_rate": 0,
        "total_runs": 0,
        "device_required": True,
    },
    {
        "id": "disable_airplane_mode",
        "name": "Airplane Mode Off",
        "description": "Disable airplane mode to restore connectivity",
        "category": "device",
        "complexity": "simple",
        "duration_estimate": "<30s",
        "parameters": {},
        "requirements": ["adb"],
        "last_run": None,
        "success_rate": 0,
        "total_runs": 0,
        "device_required": True,
    },
    {
        "id": "ping",
        "name": "Ping",
        "description": "Ping a target IP or domain from the device for a specified duration",
        "category": "network",
        "complexity": "simple",
        "duration_estimate": "<60s",
        "parameters": {
            "target": {"type": "string", "required": False, "default": "8.8.8.8"},
            "duration": {"type": "integer", "required": False, "default": 10},
            "interval": {"type": "number", "required": False, "default": 1.0}
        },
        "requirements": ["adb"],
        "last_run": None,
        "success_rate": 0,
        "total_runs": 0,
        "device_required": True,
    },
    {
        "id": "activate_data",
        "name": "Activate Mobile Data",
        "description": "Ensure mobile data connectivity is enabled on the device.",
        "category": "network",
        "complexity": "simple",
        "duration_estimate": "<30s",
        "parameters": {},
        "requirements": ["adb"],
        "device_required": True,
    },
    {
        "id": "wrong_apn_configuration",
        "name": "Wrong APN Configuration",
        "description": "Force the device APN to an invalid value to simulate data failures.",
        "category": "device",
        "complexity": "simple",
        "duration_estimate": "<30s",
        "parameters": {
            "apn_value": {"type": "string", "required": False, "default": DEFAULT_WRONG_APN},
        },
        "requirements": ["adb"],
        "device_required": True,
    },
    {
        "id": "pull_device_logs",
        "name": "Log Pull",
        "description": "Collect /sdcard/log files from the device to a chosen directory on the host.",
        "category": "diagnostics",
        "complexity": "simple",
        "duration_estimate": "1-2m",
        "parameters": {
            "destination": {"type": "string", "required": True, "default": "./device_logs"},
        },
        "requirements": ["adb"],
        "device_required": True,
    },
    {
        "id": "start_rf_logging",
        "name": "Start RF Logging",
        "description": "Start RF logging via SysDump/secret code (best effort).",
        "category": "diagnostics",
        "complexity": "simple",
        "duration_estimate": "<30s",
        "parameters": {},
        "requirements": ["adb"],
        "device_required": True,
    },
    {
        "id": "stop_rf_logging",
        "name": "Stop RF Logging",
        "description": "Stop RF logging via SysDump (best effort).",
        "category": "diagnostics",
        "complexity": "simple",
        "duration_estimate": "<30s",
        "parameters": {},
        "requirements": ["adb"],
        "device_required": True,
    },
    {
        "id": "pull_rf_logs",
        "name": "Pull RF Logs",
        "description": "Pull RF log files from the device to the host for analysis.",
        "category": "diagnostics",
        "complexity": "simple",
        "duration_estimate": "1-2m",
        "parameters": {
            "destination": {"type": "string", "required": True, "default": "./rf_logs"},
        },
        "requirements": ["adb"],
        "device_required": True,
    },
    {
        "id": "dial_secret_code",
        "name": "Dial USSD Code",
        "description": "Dial a secret/USSD code (e.g., *#9900#) and trigger the associated menu.",
        "category": "automation",
        "complexity": "simple",
        "duration_estimate": "<30s",
        "parameters": {
            "code": {"type": "string", "required": True, "default": "*#9900#"},
        },
        "requirements": ["adb"],
        "device_required": True,
    },
]
modules_db = [_base_module_fields(entry) for entry in modules_db]

DEVICE_REQUIRED_MODULES = {
    "voice_call_test",
    "enable_airplane_mode",
    "disable_airplane_mode",
    "ping",
    "activate_data",
    "wrong_apn_configuration",
    "pull_device_logs",
    "start_rf_logging",
    "stop_rf_logging",
    "pull_rf_logs",
    "dial_secret_code",
}


@router.get("/modules")
async def get_modules(category: Optional[str] = None, active_only: bool = True):
    """Return modules; optionally filter by category. active_only is currently informational."""
    items = modules_db
    if category:
        items = [m for m in items if m.get("category") == category]
    # active_only is accepted for compatibility; all modules are active for now
    return items


@router.get("/modules/categories")
async def list_categories():
    """Return distinct module categories."""
    return sorted({m.get("category", "uncategorized") for m in modules_db})


@router.get("/modules/{module_id}")
async def get_module(module_id: str):
    module = next((m for m in modules_db if m["id"] == module_id), None)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return module


@router.post("/modules/{module_id}/validate")
async def validate_module_input(module_id: str, params: Dict[str, Any]):
    """Basic passthrough validation placeholder for frontend compatibility."""
    module = next((m for m in modules_db if m["id"] == module_id), None)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return {"module_id": module_id, "valid": True, "input_params": params or {}}


@router.post("/modules/{module_id}/execute")
async def execute_module(module_id: str, execution: ModuleExecute, background_tasks: BackgroundTasks):
    module = next((m for m in modules_db if m["id"] == module_id), None)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    executor = TelcoModules(execution.device_id)

    if module_id in DEVICE_REQUIRED_MODULES and not execution.device_id:
        raise HTTPException(status_code=400, detail="device_id is required for this module")

    if module_id == "voice_call_test":
        params = execution.parameters or {}
        number = params.get("number")
        if not number or not isinstance(number, str):
            raise HTTPException(status_code=400, detail="Parameter 'number' is required")

        try:
            duration = int(params.get("duration", 10))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Parameter 'duration' must be an integer")

        try:
            call_count = int(params.get("call_count", 1))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Parameter 'call_count' must be an integer")

        if duration <= 0:
            raise HTTPException(status_code=400, detail="Parameter 'duration' must be greater than 0")
        if call_count < 1:
            raise HTTPException(status_code=400, detail="Parameter 'call_count' must be at least 1")

        try:
            result = executor.voice_call_test(number, duration, call_count)
        except Exception as exc:  # pragma: no cover - logging only
            logger.exception("Voice call test failed: %s", exc)
            raise HTTPException(status_code=500, detail=str(exc) or "Voice call test failed.")

        success = result.get("success", True)

        return {
            "execution_id": f"exec_{module_id}",
            "module_id": module_id,
            "module_name": module["name"],
            "device_id": execution.device_id,
            "parameters": {
                "number": number,
                "duration": duration,
                "call_count": call_count,
            },
            "status": "completed" if success else "failed",
            "success": success,
            "result": result,
        }

    if module_id in {"enable_airplane_mode", "disable_airplane_mode"}:
        if module_id == "enable_airplane_mode":
            result = executor.enable_airplane_mode()
        else:
            result = executor.disable_airplane_mode()
        success = result.get("success", True)
        return {
            "execution_id": f"exec_{module_id}",
            "module_id": module_id,
            "module_name": module["name"],
            "device_id": execution.device_id,
            "parameters": execution.parameters or {},
            "status": "completed" if success else "failed",
            "success": success,
            "result": result,
        }

    if module_id == "ping":
        params = execution.parameters or {}
        target = params.get("target", "8.8.8.8")
        duration = params.get("duration", 10)
        interval = params.get("interval", 1.0)
        result = executor.ping_target(target=target, duration_seconds=duration, interval_seconds=interval)
        return {
            "execution_id": f"exec_{module_id}",
            "module_id": module_id,
            "module_name": module["name"],
            "device_id": execution.device_id,
            "parameters": {
                "target": target,
                "duration": duration,
                "interval": interval,
            },
            "status": "completed" if result.get("success", True) else "failed",
            "success": result.get("success", True),
            "result": result,
        }

    if module_id == "activate_data":
        result = executor.enable_mobile_data()
        success = result.get("success", True)
        return {
            "execution_id": f"exec_{module_id}",
            "module_id": module_id,
            "module_name": module["name"],
            "device_id": execution.device_id,
            "parameters": {},
            "status": "completed" if success else "failed",
            "success": success,
            "result": result,
        }

    if module_id == "wrong_apn_configuration":
        params = execution.parameters or {}
        apn_value = params.get("apn_value") or DEFAULT_WRONG_APN
        use_ui_flow = bool(params.get("use_ui_flow", True))
        result = executor.configure_wrong_apn(apn_value, use_ui_flow=use_ui_flow)
        success = result.get("success", True)
        return {
            "execution_id": f"exec_{module_id}",
            "module_id": module_id,
            "module_name": module["name"],
            "device_id": execution.device_id,
            "parameters": {"apn_value": apn_value, "use_ui_flow": use_ui_flow},
            "status": "completed" if success else "failed",
            "success": success,
            "result": result,
        }

    if module_id == "pull_device_logs":
        params = execution.parameters or {}
        destination = params.get("destination")
        if not destination or not isinstance(destination, str):
            raise HTTPException(status_code=400, detail="Parameter 'destination' is required.")
        result = executor.pull_device_logs(destination)
        success = result.get("success", True)
        return {
            "execution_id": f"exec_{module_id}",
            "module_id": module_id,
            "module_name": module["name"],
            "device_id": execution.device_id,
            "parameters": {"destination": destination},
            "status": "completed" if success else "failed",
            "success": success,
            "result": result,
        }

    if module_id in {"start_rf_logging", "stop_rf_logging"}:
        if module_id == "start_rf_logging":
            result = executor.start_rf_logging()
        else:
            result = executor.stop_rf_logging()
        success = result.get("success", True)
        return {
            "execution_id": f"exec_{module_id}",
            "module_id": module_id,
            "module_name": module["name"],
            "device_id": execution.device_id,
            "parameters": {},
            "status": "completed" if success else "failed",
            "success": success,
            "result": result,
        }

    if module_id == "pull_rf_logs":
        params = execution.parameters or {}
        destination = params.get("destination")
        if not destination or not isinstance(destination, str):
            raise HTTPException(status_code=400, detail="Parameter 'destination' is required.")
        result = executor.pull_rf_logs(destination)
        success = result.get("success", True)
        return {
            "execution_id": f"exec_{module_id}",
            "module_id": module_id,
            "module_name": module["name"],
            "device_id": execution.device_id,
            "parameters": {"destination": destination},
            "status": "completed" if success else "failed",
            "success": success,
            "result": result,
        }

    if module_id == "dial_secret_code":
        params = execution.parameters or {}
        code = params.get("code")
        if not code or not isinstance(code, str):
            raise HTTPException(status_code=400, detail="Parameter 'code' is required.")
        result = executor.dial_secret_code(code)
        success = result.get("success", True)
        return {
            "execution_id": f"exec_{module_id}",
            "module_id": module_id,
            "module_name": module["name"],
            "device_id": execution.device_id,
            "parameters": {"code": code},
            "status": "completed" if success else "failed",
            "success": success,
            "result": result,
        }

    execution_id = f"exec_{module_id}"
    return {
        "execution_id": execution_id,
        "module_id": module_id,
        "module_name": module["name"],
        "device_id": execution.device_id,
        "parameters": execution.parameters,
        "status": "started",
        "message": f"Module '{module['name']}' execution started",
    }
