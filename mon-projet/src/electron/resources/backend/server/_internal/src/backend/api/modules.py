"""Modules API endpoints for compatibility."""

import asyncio
import json
import logging
import time
import inspect
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException


def _ensure_backend_import_path() -> None:
    import sys
    backend_root = Path(__file__).resolve().parents[1]
    repo_root = backend_root.parent
    for candidate in (backend_root, repo_root):
        candidate_str = str(candidate)
        if candidate_str not in sys.path:
            sys.path.insert(0, candidate_str)
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

# Import compatible both from backend cwd and project root
try:
    from modules.telco_modules import TelcoModules, DEFAULT_WRONG_APN
except ImportError:  # pragma: no cover
    _ensure_backend_import_path()
    try:
        from modules.telco_modules import TelcoModules, DEFAULT_WRONG_APN
    except ImportError:
        from src.backend.modules.telco_modules import TelcoModules, DEFAULT_WRONG_APN  # type: ignore

try:
    from services.module_catalog import (
        ModuleDefinition,
        ModuleExecutionError,
        ModuleNotFoundError,
        module_catalog,
    )
except ImportError:  # pragma: no cover
    _ensure_backend_import_path()
    try:
        from services.module_catalog import (
            ModuleDefinition,
            ModuleExecutionError,
            ModuleNotFoundError,
            module_catalog,
        )
    except ImportError:
        from src.backend.services.module_catalog import (  # type: ignore
            ModuleDefinition,
            ModuleExecutionError,
            ModuleNotFoundError,
            module_catalog,
        )

from api.websocket import connection_manager
from core.database import get_db
from models.module_run import ModuleRun, ModuleRunStatus

logger = logging.getLogger(__name__)

router = APIRouter()


def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


module_status_entries: Dict[str, Dict[str, Any]] = {}
module_latest_status: Dict[str, str] = {}
module_cancel_events: Dict[str, threading.Event] = {}


DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
RETRY_QUEUE_PATH = DATA_DIR / "module_retry_queue.json"
RETRY_BASE_DELAY_SECONDS = 5
MAX_RETRY_ATTEMPTS = 3
module_retry_queue: Optional["ModuleRetryQueue"] = None


def _emit_module_status(entry: Dict[str, Any]):
    snapshot = dict(entry)
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        logger.debug("No running event loop; skipping module status emit.")
        return
    loop.create_task(
        connection_manager.send_module_status(
            snapshot.get("execution_id", f"exec_{snapshot.get('module_id', '')}"),
            snapshot.get("module_id", ""),
            snapshot,
        )
    )


class ModuleExecute(BaseModel):
    device_id: Optional[str] = None
    device_ids: List[str] = Field(default_factory=list)
    parameters: Dict[str, Any] = Field(default_factory=dict)
    parameters_by_device: Dict[str, Dict[str, Any]] = Field(default_factory=dict)


class ModuleCancelRequest(BaseModel):
    status_id: str


class ModuleRetryQueue:
    """Persistent queue that retries failed legacy module runs."""

    def __init__(self, persistence_path: Path):
        self.path = persistence_path
        self.lock = threading.Lock()
        self.queue: List[Dict[str, Any]] = []
        self._load()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def _load(self):
        if not self.path.exists():
            self.queue = []
            return
        try:
            with open(self.path, 'r', encoding='utf-8') as f:
                self.queue = json.load(f)
        except Exception:
            logger.exception("Failed to load module retry queue, starting fresh.")
            self.queue = []

    def _persist(self):
        try:
            with open(self.path, 'w', encoding='utf-8') as f:
                json.dump(self.queue, f, ensure_ascii=False, indent=2)
        except Exception:
            logger.exception("Failed to persist module retry queue.")

    def schedule_retry(
        self,
        module_id: str,
        device_ids: List[str],
        parameters: Dict[str, Any],
        parameters_by_device: Optional[Dict[str, Dict[str, Any]]],
        status_id: str,
        summary: str,
    ):
        with self.lock:
            if any(entry.get("status_id") == status_id for entry in self.queue):
                return
            entry = {
                "module_id": module_id,
                "device_ids": list(device_ids),
                "parameters": dict(parameters or {}),
                "parameters_by_device": dict(parameters_by_device or {}),
                "status_id": status_id,
                "next_retry": time.time() + RETRY_BASE_DELAY_SECONDS,
                "attempts": 0,
                "max_attempts": MAX_RETRY_ATTEMPTS,
                "summary": summary,
                "last_error": None,
            }
            self.queue.append(entry)
            self._persist()

    def _run(self):
        while True:
            entry = self._next_entry()
            if entry:
                self._attempt(entry)
            else:
                time.sleep(2)

    def _next_entry(self) -> Optional[Dict[str, Any]]:
        now = time.time()
        with self.lock:
            for entry in self.queue:
                if entry.get("running"):
                    continue
                if entry.get("next_retry", 0) <= now:
                    entry["running"] = True
                    return entry
        return None

    def _attempt(self, entry: Dict[str, Any]):
        try:
            execution = ModuleExecute(
                device_ids=entry.get("device_ids", []),
                parameters={**entry.get("parameters", {}), "_retrying": True, "_retry_attempt": entry.get("attempts", 0) + 1},
                parameters_by_device=entry.get("parameters_by_device", {}) or {},
            )
            result = _execute_legacy_module(entry["module_id"], execution, schedule_retry=False)
            success = bool(result.get("success"))
            failure_reason = (
                (result.get("result") or {}).get("stage_message")
                or (result.get("result") or {}).get("summary")
                or result.get("error")
            )
            if failure_reason:
                entry["last_error"] = failure_reason
        except Exception as exc:  # pragma: no cover - best effort
            logger.exception("Retry execution for %s failed", entry["module_id"])
            success = False
            entry["last_error"] = str(exc)
        with self.lock:
            if success or entry.get("attempts", 0) + 1 >= entry.get("max_attempts", MAX_RETRY_ATTEMPTS):
                self.queue = [item for item in self.queue if item.get("status_id") != entry.get("status_id")]
            else:
                entry["attempts"] = entry.get("attempts", 0) + 1
                entry["running"] = False
                entry["last_error"] = entry.get("last_error")
                entry["next_retry"] = time.time() + min(600, (2 ** entry["attempts"]) * RETRY_BASE_DELAY_SECONDS)
            self._persist()
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


legacy_modules_db: List[Dict[str, Any]] = [
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
        "id": "preflight_check",
        "name": "Preflight Check",
        "description": "Verify ADB, Wi-Fi and network services before running workflows.",
        "category": "diagnostics",
        "complexity": "simple",
        "duration_estimate": "<45s",
        "parameters": {},
        "requirements": ["adb"],
        "device_required": True,
    },
    {
        "id": "launch_app",
        "name": "Smart App Launcher",
        "description": "Launch Google or YouTube to generate data usage.",
        "category": "automation",
        "complexity": "simple",
        "duration_estimate": "<30s",
        "parameters": {
                "app": {
                    "type": "string",
                    "required": True,
                    "default": "youtube",
                "enum": ["youtube", "maps", "chrome_news"],
                },
            "duration_seconds": {
                "type": "integer",
                "required": False,
                "default": 15,
            },
        },
        "requirements": ["adb"],
        "last_run": None,
        "success_rate": 0,
        "total_runs": 0,
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
legacy_modules_db = [_base_module_fields(entry) for entry in legacy_modules_db]
LEGACY_MODULE_IDS = {entry["id"] for entry in legacy_modules_db}


def _serialize_catalog_definition(definition: ModuleDefinition) -> Dict[str, Any]:
    parameters: Dict[str, Dict[str, Any]] = {}
    for name, details in (definition.inputs or {}).items():
        parameters[name] = {
            "type": details.get("type"),
            "required": bool(details.get("required", False)),
            "default": details.get("default"),
            "example": details.get("example"),
            "min": details.get("min"),
            "max": details.get("max"),
        }

    payload = {
        "id": definition.id,
        "name": definition.name,
        "description": definition.description,
        "category": definition.category,
        "parameters": parameters,
        "artifacts": definition.artifacts,
        "version": definition.version,
        "timeout_seconds": definition.timeout_sec,
        "source": "spec-catalog",
    }
    return _base_module_fields(payload)


def _catalog_definitions() -> List[ModuleDefinition]:
    try:
        return module_catalog.list_modules()
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("Failed to load Spec modules: %s", exc)
        return []


def _catalog_module_payloads() -> List[Dict[str, Any]]:
    return [_serialize_catalog_definition(item) for item in _catalog_definitions()]


def _merged_modules() -> Dict[str, Dict[str, Any]]:
    merged: Dict[str, Dict[str, Any]] = {}
    for entry in _catalog_module_payloads():
        merged[entry["id"]] = entry
    for entry in legacy_modules_db:
        merged.setdefault(entry["id"], entry)
    return merged


def _get_catalog_definition(module_id: str) -> Optional[ModuleDefinition]:
    try:
        return module_catalog.get_module(module_id)
    except ModuleNotFoundError:
        return None
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("Failed to resolve module %s from catalog: %s", module_id, exc)
        return None


def _validate_catalog_parameters(definition: ModuleDefinition, params: Dict[str, Any]) -> None:
    params = params or {}
    missing = [
        name
        for name, details in (definition.inputs or {}).items()
        if details.get("required") and params.get(name) in (None, "")
    ]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required parameter(s): {', '.join(missing)}",
        )

DEVICE_REQUIRED_MODULES = {
    "voice_call_test",
    "enable_airplane_mode",
    "disable_airplane_mode",
    "ping",
    "activate_data",
    "launch_app",
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
    modules = list(_merged_modules().values())
    if category:
        modules = [m for m in modules if m.get("category") == category]
    return modules


@router.get("/modules/categories")
async def list_categories():
    """Return distinct module categories."""
    return sorted({m.get("category", "uncategorized") for m in _merged_modules().values()})

@router.get("/modules/status")
async def get_module_status(
    module_id: Optional[str] = None,
    status_id: Optional[str] = None,
):
    """Expose the latest status report for legacy modules (per module or status id)."""
    if status_id:
        entry = module_status_entries.get(status_id)
        if entry:
            return entry
        raise HTTPException(status_code=404, detail="Module status not found")
    if module_id:
        latest_key = module_latest_status.get(module_id)
        if latest_key:
            entry = module_status_entries.get(latest_key)
            if entry:
                return entry
        raise HTTPException(status_code=404, detail="Module status not found")
    sorted_entries = sorted(
        module_status_entries.values(),
        key=lambda value: value.get("started_at") or "",
        reverse=True,
    )
    return {"entries": sorted_entries}


@router.get("/modules/runs")
async def list_module_runs(
    module_id: Optional[str] = None,
    device_id: Optional[str] = None,
    status: Optional[ModuleRunStatus] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """Return historical module runs for reporting/diagnostics."""
    query = db.query(ModuleRun)
    if module_id:
        query = query.filter(ModuleRun.module_id == module_id)
    if device_id:
        query = query.filter(ModuleRun.device_id == device_id)
    if status:
        query = query.filter(ModuleRun.status == status)

    total = query.count()
    runs = (
        query.order_by(ModuleRun.created_at.desc())
        .offset(max(offset, 0))
        .limit(max(min(limit, 200), 1))
        .all()
    )
    return {
        "items": [_serialize_run(run) for run in runs],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/modules/runs/{run_id}")
async def get_module_run(run_id: str, db: Session = Depends(get_db)):
    run = db.query(ModuleRun).filter(ModuleRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return _serialize_run(run)


@router.get("/modules/{module_id}")
async def get_module(module_id: str):
    module = _merged_modules().get(module_id)
    if module:
        return module
    raise HTTPException(status_code=404, detail="Module not found")


@router.post("/modules/{module_id}/validate")
async def validate_module_input(module_id: str, params: Dict[str, Any]):
    """Basic passthrough validation placeholder for frontend compatibility."""
    definition = _get_catalog_definition(module_id)
    if definition:
        _validate_catalog_parameters(definition, params or {})
        return {"module_id": module_id, "valid": True, "input_params": params or {}}

    module = _merged_modules().get(module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return {"module_id": module_id, "valid": True, "input_params": params or {}}


@router.post("/modules/{module_id}/execute")
async def execute_module(module_id: str, execution: ModuleExecute, db: Session = Depends(get_db)):
    if module_id in LEGACY_MODULE_IDS:
        return await asyncio.to_thread(_execute_legacy_module, module_id, execution)
    definition = _get_catalog_definition(module_id)
    if definition:
        return _execute_catalog_module(definition, execution, db)
    return await asyncio.to_thread(_execute_legacy_module, module_id, execution)


@router.post("/modules/{module_id}/cancel")
async def cancel_module_execution(module_id: str, payload: ModuleCancelRequest):
    """Cancel a running legacy module execution (best effort)."""
    status_id = payload.status_id
    entry = module_status_entries.get(status_id)
    if not entry or entry.get("module_id") != module_id:
        raise HTTPException(status_code=404, detail="Module status not found")
    if entry.get("state") != "running":
        return {"status_id": status_id, "cancelled": False, "message": "Execution is not running"}
    cancel_event = module_cancel_events.get(status_id)
    if cancel_event:
        cancel_event.set()
    entry.update(
        {
            "state": "cancelled",
            "completed_at": _now_iso(),
            "pending_device_ids": [],
            "success": False,
            "stage_message": "Execution cancelled by user",
            "summary": "Execution cancelled by user",
            "last_update": _now_iso(),
        }
    )
    _emit_module_status(entry)
    return {"status_id": status_id, "cancelled": True}


def _execute_catalog_module(definition: ModuleDefinition, execution: ModuleExecute, db: Session) -> Dict[str, Any]:
    """Execute a Spec-defined module and persist a run record."""
    targets = _collect_device_targets(execution)
    if targets:
        device_results: List[Dict[str, Any]] = []
        success_count = 0
        failure_count = 0
        for device_id in targets:
            per_device_params = dict(execution.parameters or {})
            per_device_params.update(execution.parameters_by_device.get(device_id) or {})
            try:
                _validate_catalog_parameters(definition, per_device_params)
            except HTTPException as exc:
                failure_count += 1
                device_results.append({
                    "device_id": device_id,
                    "success": False,
                    "result": {"error": exc.detail},
                    "error": exc.detail,
                })
                continue

            run = ModuleRun(
                module_id=definition.id,
                module_name=definition.name,
                device_id=device_id,
                parameters_json=json.dumps(per_device_params or {}),
            )
            db.add(run)
            db.commit()
            db.refresh(run)

            run.mark_running()
            db.commit()

            try:
                result = module_catalog.execute_module(
                    definition.id,
                    device_id=device_id,
                    parameters=per_device_params or {},
                )
            except ModuleExecutionError as exc:
                run.mark_failed(str(exc))
                db.commit()
                failure_count += 1
                device_results.append({
                    "device_id": device_id,
                    "success": False,
                    "result": {"error": str(exc)},
                    "error": str(exc),
                })
                continue
            except Exception as exc:  # pragma: no cover - defensive logging
                run.mark_failed(str(exc))
                db.commit()
                failure_count += 1
                device_results.append({
                    "device_id": device_id,
                    "success": False,
                    "result": {"error": "Module execution failed"},
                    "error": "Module execution failed",
                })
                continue

            run.mark_completed(
                success=result.success,
                result_json=json.dumps(result.result),
                duration_ms=int(result.duration_ms),
            )
            db.commit()
            db.refresh(run)

            if result.success:
                success_count += 1
            else:
                failure_count += 1
            device_results.append({
                "device_id": device_id,
                "success": result.success,
                "result": result.result,
            })

        summary = _default_stage_message(definition.name, success_count, failure_count)
        return {
            "module_id": definition.id,
            "module_name": definition.name,
            "success": failure_count == 0 and success_count > 0,
            "device_results": device_results,
            "result": {"device_results": device_results},
            "summary": summary,
        }

    _validate_catalog_parameters(definition, execution.parameters or {})

    run = ModuleRun(
        module_id=definition.id,
        module_name=definition.name,
        device_id=execution.device_id,
        parameters_json=json.dumps(execution.parameters or {}),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    run.mark_running()
    db.commit()

    try:
        result = module_catalog.execute_module(
            definition.id,
            device_id=execution.device_id,
            parameters=execution.parameters or {},
        )
    except ModuleExecutionError as exc:
        run.mark_failed(str(exc))
        db.commit()
        raise HTTPException(status_code=500, detail=str(exc) or "Module execution failed") from exc
    except Exception as exc:  # pragma: no cover - defensive logging
        run.mark_failed(str(exc))
        db.commit()
        raise HTTPException(status_code=500, detail="Module execution failed") from exc

    run.mark_completed(
        success=result.success,
        result_json=json.dumps(result.result),
        duration_ms=int(result.duration_ms),
    )
    db.commit()
    db.refresh(run)

    return {
        "run_id": run.id,
        "module_id": definition.id,
        "module_name": definition.name,
        "device_id": execution.device_id,
        "status": run.status.value,
        "success": run.success,
        "result": result.result,
        "parameters": execution.parameters or {},
        "duration_ms": run.duration_ms,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "entry_point": definition.entry_point,
    }


def _serialize_run(run: ModuleRun) -> Dict[str, Any]:
    payload = run.to_dict()
    payload["parameters"] = json.loads(run.parameters_json or "{}")
    payload["result"] = json.loads(run.result_json) if run.result_json else None
    payload["status"] = run.status.value
    payload.pop("parameters_json", None)
    payload.pop("result_json", None)
    return payload


def _collect_device_targets(execution: ModuleExecute) -> List[str]:
    targets: List[str] = []
    for device_id in execution.device_ids or []:
        cleaned = (device_id or "").strip()
        if cleaned:
            targets.append(cleaned)
    if not targets and execution.device_id:
        cleaned = execution.device_id.strip()
        if cleaned:
            targets.append(cleaned)
    # Deduplicate while preserving order
    seen = set()
    unique_targets: List[str] = []
    for device_id in targets:
        if device_id not in seen:
            seen.add(device_id)
            unique_targets.append(device_id)
    return unique_targets


def _default_stage_message(module_name: str, success_count: int, failure_count: int) -> str:
    if success_count + failure_count == 0:
        return f"{module_name} was not executed: no devices targeted."
    if failure_count == 0:
        plural = "s" if success_count != 1 else ""
        return f"{module_name} executed successfully on {success_count} device{plural}."
    success_label = "success" if success_count == 1 else "successes"
    failure_label = "failure" if failure_count == 1 else "failures"
    return (
        f"{module_name} completed: {success_count} {success_label}, {failure_count} {failure_label}."
    )


def _run_legacy_module_on_devices_with_params(
    module: Dict[str, Any],
    module_id: str,
    device_ids: List[str],
    worker: Callable[[TelcoModules, Dict[str, Any]], Dict[str, Any]],
    *,
    parameters: Dict[str, Any],
    parameters_by_device: Dict[str, Dict[str, Any]],
    stage_message: Optional[str] = None,
    schedule_retry: bool = True,
) -> Dict[str, Any]:
    status_id = f"{module_id}_{int(time.time() * 1000)}"
    execution_id = f"exec_{module_id}"
    cancel_event = threading.Event()
    module_cancel_events[status_id] = cancel_event
    module_status_entries[status_id] = {
        "status_id": status_id,
        "execution_id": execution_id,
        "module_id": module_id,
        "module_name": module.get("name") or module_id,
        "state": "running",
        "started_at": _now_iso(),
        "device_ids": list(device_ids),
        "pending_device_ids": list(device_ids),
        "device_results": [],
        "stage_message": stage_message,
        "summary": stage_message or "",
        "success": None,
    }
    _emit_module_status(module_status_entries[status_id])
    module_latest_status[module_id] = status_id

    def resolve_params(device_id: str) -> Dict[str, Any]:
        merged = dict(parameters or {})
        per_device = parameters_by_device.get(device_id) or {}
        merged.update(per_device)
        return merged

    results: List[Dict[str, Any]] = []
    pool_size = max(1, len(device_ids))
    try:
        with ThreadPoolExecutor(max_workers=pool_size) as executor:
            future_to_device = {
                executor.submit(
                    _run_worker_for_device_with_params,
                    worker,
                    device_id,
                    resolve_params(device_id),
                    cancel_event,
                ): device_id
                for device_id in device_ids
            }
            for future in as_completed(future_to_device):
                device_id = future_to_device[future]
                try:
                    value = future.result()
                    results.append(
                        {
                            "device_id": device_id,
                            "success": bool(value.get("success", True)),
                            "result": value,
                        }
                    )
                except Exception as exc:
                    results.append(
                        {
                            "device_id": device_id,
                            "success": False,
                            "error": str(exc),
                        }
                    )
    finally:
        module_cancel_events.pop(status_id, None)

    cancelled = cancel_event.is_set()
    overall_success = False if cancelled else all(entry.get("success", False) for entry in results)
    success_count = sum(1 for entry in results if entry.get("success"))
    failure_count = len(results) - success_count
    summary = "Execution cancelled by user" if cancelled else (
        stage_message or _default_stage_message(module.get("name") or module_id, success_count, failure_count)
    )

    entry = module_status_entries.get(status_id)
    if entry:
        entry.update(
            {
                "state": "cancelled" if cancelled else "completed",
                "completed_at": _now_iso(),
                "device_results": results,
                "pending_device_ids": [],
                "success": overall_success,
                "stage_message": summary,
                "summary": summary,
                "success_count": success_count,
                "failure_count": failure_count,
                "last_update": _now_iso(),
            }
        )
        _emit_module_status(entry)
        if failure_count > 0 and schedule_retry and module_retry_queue:
            module_retry_queue.schedule_retry(
                module_id,
                device_ids,
                parameters,
                parameters_by_device,
                status_id,
                summary,
            )

    return {
        "execution_id": execution_id,
        "module_id": module_id,
        "module_name": module.get("name"),
        "device_id": device_ids[0] if device_ids else None,
        "device_ids": device_ids,
        "status": "completed" if overall_success else "failed",
        "success": overall_success,
        "parameters": parameters,
        "parameters_by_device": parameters_by_device,
        "result": {
            "stage": "completed",
            "stage_message": summary,
            "summary": summary,
            "device_results": results,
            "success_count": success_count,
            "failure_count": failure_count,
        },
        "status_id": status_id,
    }


def _run_worker_for_device_with_params(
    worker: Callable[[TelcoModules, Dict[str, Any]], Dict[str, Any]],
    device_id: str,
    params: Dict[str, Any],
    cancel_event: Optional[threading.Event] = None,
) -> Dict[str, Any]:
    if cancel_event and cancel_event.is_set():
        return {"success": False, "cancelled": True, "error": "Execution cancelled"}
    executor = TelcoModules(device_id)
    try:
        signature = inspect.signature(worker)
        if len(signature.parameters) >= 3:
            result = worker(executor, params, cancel_event)
        else:
            result = worker(executor, params)
    except (TypeError, ValueError):
        result = worker(executor, params)
    if not isinstance(result, dict):
        result = {"result": result}
    result.setdefault("success", True)
    return result


def _run_legacy_module_on_devices(
    module: Dict[str, Any],
    module_id: str,
    device_ids: List[str],
    worker: Callable[[TelcoModules], Dict[str, Any]],
    *,
    parameters: Dict[str, Any],
    stage_message: Optional[str] = None,
    schedule_retry: bool = True,
) -> Dict[str, Any]:
    status_id = f"{module_id}_{int(time.time() * 1000)}"
    execution_id = f"exec_{module_id}"
    cancel_event = threading.Event()
    module_cancel_events[status_id] = cancel_event
    module_status_entries[status_id] = {
        "status_id": status_id,
        "execution_id": execution_id,
        "module_id": module_id,
        "module_name": module.get("name") or module_id,
        "state": "running",
        "started_at": _now_iso(),
        "device_ids": list(device_ids),
        "pending_device_ids": list(device_ids),
        "device_results": [],
        "stage_message": stage_message,
        "summary": stage_message or "",
        "success": None,
    }
    _emit_module_status(module_status_entries[status_id])
    module_latest_status[module_id] = status_id

    try:
        aggregation = TelcoModules.execute_on_multiple_devices(
            device_ids,
            worker,
            module_name=module.get("name") or module_id,
            cancel_event=cancel_event,
        )
    finally:
        module_cancel_events.pop(status_id, None)
    device_results = aggregation.get("device_results") or []
    cancelled = cancel_event.is_set()
    success_count = sum(1 for entry in device_results if entry.get("success"))
    failure_count = len(device_results) - success_count
    summary = "Execution cancelled by user" if cancelled else (
        stage_message or _default_stage_message(module.get("name") or module_id, success_count, failure_count)
    )
    entry = module_status_entries.get(status_id)
    if entry:
        entry.update(
            {
                "state": "cancelled" if cancelled else "completed",
                "completed_at": _now_iso(),
                "device_results": device_results,
                "pending_device_ids": [],
                "success": False if cancelled else aggregation.get("success", False),
                "stage_message": summary,
                "summary": summary,
                "success_count": success_count,
                "failure_count": failure_count,
                "last_update": _now_iso(),
            }
        )
        _emit_module_status(entry)
        if failure_count > 0 and schedule_retry and module_retry_queue:
            module_retry_queue.schedule_retry(
                module_id,
                device_ids,
                parameters,
                {},
                status_id,
                summary,
            )
    return {
        "execution_id": execution_id,
        "module_id": module_id,
        "module_name": module.get("name"),
        "device_id": device_ids[0] if device_ids else None,
        "device_ids": device_ids,
        "status": "completed" if aggregation.get("success") else "failed",
        "success": aggregation.get("success", False),
        "parameters": parameters,
        "result": {
            "stage": "completed",
            "stage_message": summary,
            "summary": summary,
            "device_results": device_results,
            "success_count": success_count,
            "failure_count": failure_count,
            "error": aggregation.get("error"),
        },
        "status_id": status_id,
    }


def _with_stage(result: Dict[str, Any], stage: str, message: Optional[str] = None) -> Dict[str, Any]:
    wrapped = dict(result)
    wrapped["stage"] = stage
    if message:
        wrapped["stage_message"] = message
    return wrapped


def _execute_legacy_module(module_id: str, execution: ModuleExecute, schedule_retry: bool = True) -> Dict[str, Any]:
    module = next((m for m in legacy_modules_db if m["id"] == module_id), None)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    parameters = execution.parameters or {}
    parameters_by_device = execution.parameters_by_device or {}
    targets = _collect_device_targets(execution)

    if module_id in DEVICE_REQUIRED_MODULES and not targets:
        raise HTTPException(status_code=400, detail="device_id or device_ids is required for this module")

    def run_for_devices(
        worker: Callable[[TelcoModules], Dict[str, Any]],
        params: Optional[Dict[str, Any]] = None,
        stage_message: Optional[str] = None,
        schedule_retry_override: Optional[bool] = None,
        worker_with_params: Optional[Callable[[TelcoModules, Dict[str, Any]], Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        start_at = time.time() + 1.0
        if params is not None:
            params = dict(params)
            params["start_at"] = start_at
        schedule_flag = schedule_retry if schedule_retry_override is None else schedule_retry_override
        def wrap_worker(executor: TelcoModules) -> Dict[str, Any]:
            wait_seconds = max(0.0, start_at - time.time())
            if wait_seconds:
                time.sleep(wait_seconds)
            return worker(executor)
        def wrap_worker_with_params(executor: TelcoModules, worker_params: Dict[str, Any]) -> Dict[str, Any]:
            start_target = worker_params.get("start_at")
            if isinstance(start_target, (int, float)):
                wait_seconds = max(0.0, start_target - time.time())
                if wait_seconds:
                    time.sleep(wait_seconds)
            return worker_with_params(executor, worker_params)
        if parameters_by_device and worker_with_params:
            return _run_legacy_module_on_devices_with_params(
                module,
                module_id,
                targets,
                wrap_worker_with_params,
                parameters=params if params is not None else parameters,
                parameters_by_device=parameters_by_device,
                stage_message=stage_message,
                schedule_retry=schedule_flag,
            )
        return _run_legacy_module_on_devices(
            module,
            module_id,
            targets,
            wrap_worker,
            parameters=params if params is not None else parameters,
            stage_message=stage_message,
            schedule_retry=schedule_flag,
        )

    if module_id == "voice_call_test":
        params = execution.parameters or {}

        def voice_call_worker(executor: TelcoModules, worker_params: Dict[str, Any]) -> Dict[str, Any]:
            number = worker_params.get("number")
            if not number or not isinstance(number, str):
                return {"success": False, "error": "Parameter 'number' is required"}
            try:
                duration = int(worker_params.get("duration", 10))
            except (TypeError, ValueError):
                return {"success": False, "error": "Parameter 'duration' must be an integer"}
            try:
                call_count = int(worker_params.get("call_count", 1))
            except (TypeError, ValueError):
                return {"success": False, "error": "Parameter 'call_count' must be an integer"}
            if duration <= 0:
                return {"success": False, "error": "Parameter 'duration' must be greater than 0"}
            if call_count < 1:
                return {"success": False, "error": "Parameter 'call_count' must be at least 1"}
            return executor.voice_call_test(number, duration, call_count)

        if not parameters_by_device:
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

        return run_for_devices(
            lambda executor: voice_call_worker(executor, params),
            params=params,
            worker_with_params=voice_call_worker,
        )

    if module_id in {"enable_airplane_mode", "disable_airplane_mode"}:
        return run_for_devices(
            lambda executor: executor.enable_airplane_mode()
            if module_id == "enable_airplane_mode"
            else executor.disable_airplane_mode(),
            params=parameters,
            stage_message="Airplane mode toggled",
        )

    if module_id == "launch_app":
        params = execution.parameters or {}

        def launch_app_worker(executor: TelcoModules, worker_params: Dict[str, Any]) -> Dict[str, Any]:
            app_choice = str(worker_params.get("app", "youtube")).lower()
            duration_raw = worker_params.get("duration_seconds")
            duration_seconds: Optional[int] = None
            if duration_raw is not None:
                try:
                    duration_seconds = int(duration_raw)
                except (TypeError, ValueError):
                    return {"success": False, "error": "Parameter 'duration_seconds' must be an integer"}
                if duration_seconds <= 0:
                    return {"success": False, "error": "Parameter 'duration_seconds' must be greater than 0"}

            target_sequence: List[Dict[str, Any]] = []
            raw_sequence = worker_params.get("targets")
            if isinstance(raw_sequence, list):
                for entry in raw_sequence:
                    if not entry or not isinstance(entry, dict):
                        continue
                    candidate_app = entry.get("app")
                    if not candidate_app:
                        continue
                    candidate_duration = entry.get("duration_seconds")
                    parsed_duration: Optional[int] = None
                    if candidate_duration is not None:
                        try:
                            parsed_duration = int(candidate_duration)
                            if parsed_duration <= 0:
                                parsed_duration = None
                        except (TypeError, ValueError):
                            parsed_duration = None
                    target_sequence.append(
                        {"app": str(candidate_app).lower(), "duration_seconds": parsed_duration}
                    )

            if not target_sequence:
                target_sequence = [{"app": app_choice, "duration_seconds": duration_seconds}]

            return executor.launch_app(
                app=None,
                duration_seconds=None,
                targets=target_sequence,
            )

        return run_for_devices(
            lambda executor: launch_app_worker(executor, params),
            params=params,
            stage_message="Launching apps",
            worker_with_params=launch_app_worker,
        )

    if module_id == "ping":
        params = execution.parameters or {}

        def ping_worker(executor: TelcoModules, worker_params: Dict[str, Any]) -> Dict[str, Any]:
            target = worker_params.get("target", "8.8.8.8")
            duration = worker_params.get("duration", 10)
            interval = worker_params.get("interval", 1.0)
            return executor.ping_target(target=target, duration_seconds=duration, interval_seconds=interval)

        return run_for_devices(
            lambda executor: ping_worker(executor, params),
            params=params,
            stage_message="Ping completed",
            worker_with_params=ping_worker,
        )

    if module_id == "activate_data":
        return run_for_devices(
            lambda executor: executor.enable_mobile_data(),
            params={},
            stage_message="Mobile data activated",
        )

    if module_id == "preflight_check":
        return run_for_devices(
            lambda executor: executor.preflight_check(),
            params={},
            stage_message="Preflight checks completed",
        )

    if module_id == "wrong_apn_configuration":
        params = execution.parameters or {}

        def wrong_apn_worker(executor: TelcoModules, worker_params: Dict[str, Any]) -> Dict[str, Any]:
            apn_value = worker_params.get("apn_value") or DEFAULT_WRONG_APN
            use_ui_flow = bool(worker_params.get("use_ui_flow", True))
            return executor.configure_wrong_apn(apn_value, use_ui_flow=use_ui_flow)

        return run_for_devices(
            lambda executor: wrong_apn_worker(executor, params),
            params=params,
            stage_message="Wrong APN configuration applied",
            worker_with_params=wrong_apn_worker,
        )

    if module_id == "pull_device_logs":
        params = execution.parameters or {}

        def log_pull_worker(executor: TelcoModules, worker_params: Dict[str, Any]) -> Dict[str, Any]:
            destination = worker_params.get("destination")
            if not destination or not isinstance(destination, str):
                return {"success": False, "error": "Parameter 'destination' is required."}
            return executor.pull_device_logs(destination)

        if not parameters_by_device:
            destination = params.get("destination")
            if not destination or not isinstance(destination, str):
                raise HTTPException(status_code=400, detail="Parameter 'destination' is required.")

        return run_for_devices(
            lambda executor: log_pull_worker(executor, params),
            params=params,
            stage_message="Device logs collected",
            worker_with_params=log_pull_worker,
        )

    if module_id in {"start_rf_logging", "stop_rf_logging"}:
        message = "RF logging started" if module_id == "start_rf_logging" else "RF logging stopped"
        def rf_logging_worker(executor: TelcoModules, cancel_event: Optional[threading.Event] = None) -> Dict[str, Any]:
            return executor.start_rf_logging(cancel_event=cancel_event) if module_id == "start_rf_logging" else executor.stop_rf_logging(cancel_event=cancel_event)
        return run_for_devices(
            rf_logging_worker,
            params={},
            stage_message=message,
        )

    if module_id == "pull_rf_logs":
        params = execution.parameters or {}

        def rf_log_pull_worker(executor: TelcoModules, worker_params: Dict[str, Any]) -> Dict[str, Any]:
            destination = worker_params.get("destination")
            if not destination or not isinstance(destination, str):
                return {"success": False, "error": "Parameter 'destination' is required."}
            return executor.pull_rf_logs(destination)

        if not parameters_by_device:
            destination = params.get("destination")
            if not destination or not isinstance(destination, str):
                raise HTTPException(status_code=400, detail="Parameter 'destination' is required.")

        return run_for_devices(
            lambda executor: rf_log_pull_worker(executor, params),
            params=params,
            stage_message="RF logs downloaded",
            worker_with_params=rf_log_pull_worker,
        )

    if module_id == "dial_secret_code":
        params = execution.parameters or {}

        def dial_code_worker(executor: TelcoModules, worker_params: Dict[str, Any]) -> Dict[str, Any]:
            code = worker_params.get("code")
            if not code or not isinstance(code, str):
                return {"success": False, "error": "Parameter 'code' is required."}
            return executor.dial_secret_code(code)

        if not parameters_by_device:
            code = params.get("code")
            if not code or not isinstance(code, str):
                raise HTTPException(status_code=400, detail="Parameter 'code' is required.")

        return run_for_devices(
            lambda executor: dial_code_worker(executor, params),
            params=params,
            stage_message="USSD code dialed",
            worker_with_params=dial_code_worker,
        )

    execution_id = f"exec_{module_id}"
    return {
        "execution_id": execution_id,
        "module_id": module_id,
        "module_name": module["name"],
        "device_id": execution.device_id,
        "parameters": execution.parameters,
        "status": "started",
        "message": f"Module '{module['name']}' execution started",
        "result": {"stage": "requested", "message": "Request queued"},
    }


module_retry_queue = ModuleRetryQueue(RETRY_QUEUE_PATH)
