"""
Workflows API endpoints for ADB Framework
"""
from fastapi import APIRouter, HTTPException, Response
from typing import List, Dict, Any, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
from pydantic import BaseModel, Field
import json
import csv
from datetime import datetime
import time
import threading
from pathlib import Path
from uuid import uuid4
import io

def _ensure_backend_import_path() -> None:
    import sys
    backend_root = Path(__file__).resolve().parents[1]
    repo_root = backend_root.parent
    for candidate in (backend_root, repo_root):
        candidate_str = str(candidate)
        if candidate_str not in sys.path:
            sys.path.insert(0, candidate_str)


try:
    from modules.telco_modules import TelcoModules
    from modules.flow_executor import FlowExecutor
except ImportError:  # pragma: no cover
    _ensure_backend_import_path()
    try:
        from modules.telco_modules import TelcoModules
        from modules.flow_executor import FlowExecutor
    except ImportError:
        from src.backend.modules.telco_modules import TelcoModules  # type: ignore
        from src.backend.modules.flow_executor import FlowExecutor  # type: ignore

try:
    from fpdf import FPDF
except ImportError:  # pragma: no cover - fallback if fpdf2 not present
    FPDF = None  # type: ignore

router = APIRouter()

class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    modules: List[str] = []
    tags: List[str] = Field(default_factory=list)

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    modules: Optional[List[str]] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None


class WorkflowModuleEntry(BaseModel):
    id: Optional[str] = None
    module: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None


class WorkflowRunRequest(BaseModel):
    device_id: Optional[str] = None
    device_ids: List[str] = Field(default_factory=list)
    name: Optional[str] = None
    modules: List[WorkflowModuleEntry]


class WorkflowScheduleCreate(BaseModel):
    """Payload used to schedule a workflow run at a future time."""

    device_ids: List[str]
    run_at: datetime

WORKFLOW_STORAGE_PATH = Path(__file__).resolve().parent.parent / "data" / "workflows.json"


def _default_workflows() -> List[Dict[str, Any]]:
    voice_suite_modules = [
        {"id": "call_test"},
        {"id": "enable_airplane_mode"},
    ]
    network_suite_modules = [
        {"id": "enable_airplane_mode"},
        {"id": "disable_airplane_mode"},
    ]
    return [
        {
            "id": "wf_001",
            "name": "Voice Call Test Suite",
            "description": "Complete voice call testing workflow",
            "modules": voice_suite_modules,
            "steps_count": len(voice_suite_modules),
            "tags": ["voice", "call"],
            "status": "active",
            "created_at": "2024-01-15T10:00:00Z",
            "last_run": "2024-01-20T14:30:00Z",
            "success_rate": 95.5,
            "total_runs": 45
        },
        {
            "id": "wf_002", 
            "name": "Network Performance Suite",
            "description": "Network connectivity and performance tests",
            "modules": network_suite_modules,
            "steps_count": len(network_suite_modules),
            "tags": ["network", "performance"],
            "status": "active",
            "created_at": "2024-01-10T09:00:00Z",
            "last_run": "2024-01-20T13:15:00Z",
            "success_rate": 88.2,
            "total_runs": 32
        }
    ]


def _load_workflows() -> List[Dict[str, Any]]:
    WORKFLOW_STORAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not WORKFLOW_STORAGE_PATH.exists():
        data = _default_workflows()
        with WORKFLOW_STORAGE_PATH.open("w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2)
        return data
    try:
        with WORKFLOW_STORAGE_PATH.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        data = _default_workflows()
    if isinstance(data, list):
        return data
    return _default_workflows()


def _persist_workflows() -> None:
    WORKFLOW_STORAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with WORKFLOW_STORAGE_PATH.open("w", encoding="utf-8") as handle:
        json.dump(workflows_db, handle, indent=2)


workflows_db = _load_workflows()

WORKFLOW_RUN_HISTORY_PATH = Path(__file__).resolve().parent.parent / "data" / "workflow_runs.json"
MAX_WORKFLOW_RUN_HISTORY = 120


def _load_workflow_run_history() -> List[Dict[str, Any]]:
    WORKFLOW_RUN_HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not WORKFLOW_RUN_HISTORY_PATH.exists():
        return []
    try:
        with WORKFLOW_RUN_HISTORY_PATH.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return []
    if isinstance(payload, list):
        return payload
    return []


def _persist_workflow_run_history(entries: List[Dict[str, Any]]) -> None:
    WORKFLOW_RUN_HISTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    with WORKFLOW_RUN_HISTORY_PATH.open("w", encoding="utf-8") as handle:
        json.dump(entries[:MAX_WORKFLOW_RUN_HISTORY], handle, indent=2)


def _record_workflow_run(workflow_id: str, workflow_name: str, payload: Dict[str, Any]) -> None:
    history = _load_workflow_run_history()
    entry = {
        "execution_id": payload.get("execution_id"),
        "workflow_id": workflow_id,
        "workflow_name": workflow_name,
        "timestamp": datetime.utcnow().isoformat(),
        "status": payload.get("status") or payload.get("result", {}).get("stage"),
        "success": bool(payload.get("success")),
        "device_ids": payload.get("device_ids") or [],
        "results": payload.get("results") or [],
    }
    history.insert(0, entry)
    if len(history) > MAX_WORKFLOW_RUN_HISTORY:
        history = history[:MAX_WORKFLOW_RUN_HISTORY]
    _persist_workflow_run_history(history)


def _get_latest_workflow_run(workflow_id: str) -> Optional[Dict[str, Any]]:
    history = _load_workflow_run_history()
    for entry in history:
        if entry.get("workflow_id") == workflow_id:
            return entry
    return None


def _generate_run_csv(entry: Dict[str, Any]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(['Execution ID', 'Step', 'Module', 'Device ID', 'Status', 'Message'])
    for step in entry.get('results', []):
        module_label = step.get('module') or f"Step {step.get('step')}"
        for device_result in step.get('device_results', []):
            result_payload = device_result.get('result') or {}
            message = result_payload.get('stage_message') or result_payload.get('summary') or result_payload.get('message') or ''
            status = 'success' if device_result.get('success') else 'failure'
            writer.writerow([
                entry.get('execution_id'),
                step.get('step'),
                module_label,
                device_result.get('device_id'),
                status,
                message,
            ])
    return buffer.getvalue()


def _generate_run_pdf(entry: Dict[str, Any]) -> bytes:
    if FPDF is None:  # pragma: no cover
        raise HTTPException(status_code=400, detail="fpdf2 is required to generate PDF exports.")
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(True, margin=15)
    pdf.set_font("Helvetica", size=14, style="B")
    pdf.cell(0, 10, "Workflow Run Report", ln=1)
    pdf.set_font("Helvetica", size=11)
    pdf.cell(0, 8, f"Workflow: {entry.get('workflow_name', 'unknown')}", ln=1)
    pdf.cell(0, 8, f"Execution: {entry.get('execution_id', 'n/a')}", ln=1)
    pdf.cell(0, 8, f"Status: {entry.get('status', 'unknown')}", ln=1)
    device_ids = entry.get('device_ids', [])
    if device_ids:
        pdf.cell(0, 8, f"Devices: {', '.join(device_ids)}", ln=1)
    pdf.cell(0, 6, f"Timestamp: {entry.get('timestamp', '')}", ln=1)
    pdf.ln(4)

    for step in entry.get('results', []):
        module_label = step.get('module') or f"Step {step.get('step')}"
        step_status = "Success" if step.get('success') else "Failure"
        pdf.set_font("Helvetica", size=12, style="B")
        pdf.cell(0, 7, f"{step.get('step')}. {module_label} - {step_status}", ln=1)
        pdf.set_font("Helvetica", size=10)
        for device_result in step.get('device_results', []):
            result_payload = device_result.get('result') or {}
            message = result_payload.get('stage_message') or result_payload.get('summary') or result_payload.get('message') or ''
            device_status = "OK" if device_result.get('success') else "Fail"
            pdf.multi_cell(0, 6, f"  - {device_result.get('device_id')}: {device_status} {message}")
        pdf.ln(2)

    return pdf.output(dest="S").encode("latin-1")


SCHEDULE_STORAGE_PATH = Path(__file__).resolve().parent.parent / "data" / "workflow_schedules.json"


from datetime import timezone


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_workflows_pdf(workflows: List[Dict[str, Any]]) -> bytes:
    """Generate a simple PDF export of workflows (name, description, modules, status, last_run)."""
    if FPDF is None:  # pragma: no cover
        raise RuntimeError("fpdf2 is required to export workflows as PDF.")

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=14, style="B")
    pdf.cell(0, 10, "Workflows", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", size=10)
    pdf.cell(0, 8, f"Exported at: {datetime.utcnow().isoformat()}Z", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    pdf.set_font("Helvetica", size=11, style="B")
    pdf.cell(60, 8, "Name", border=1)
    pdf.cell(70, 8, "Description", border=1)
    pdf.cell(20, 8, "Modules", border=1)
    pdf.cell(20, 8, "Status", border=1, new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", size=9)
    for wf in workflows:
        name = str(wf.get("name", "N/A"))[:40]
        desc = str(wf.get("description", ""))[:60]
        modules_len = len(wf.get("modules", []))
        status = str(wf.get("status", "N/A"))
        pdf.cell(60, 8, name, border=1)
        pdf.cell(70, 8, desc, border=1)
        pdf.cell(20, 8, str(modules_len), border=1)
        pdf.cell(20, 8, status, border=1, new_x="LMARGIN", new_y="NEXT")

    return pdf.output(dest="S").encode("latin-1")


class WorkflowScheduler:
    """Simple file-backed workflow scheduler with a background dispatcher."""

    def __init__(self, storage_path: Path):
        self.storage_path = storage_path
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self.stop_event = threading.Event()
        self.thread: Optional[threading.Thread] = None
        self.schedules: Dict[str, Dict[str, Any]] = {}
        self._load()

    def _load(self) -> None:
        if not self.storage_path.exists():
            self.schedules = {}
            return
        try:
            with self.storage_path.open("r", encoding="utf-8") as handle:
                data = json.load(handle)
        except (OSError, json.JSONDecodeError):
            self.schedules = {}
            return

        schedules: Dict[str, Dict[str, Any]] = {}
        if isinstance(data, list):
            for entry in data:
                if isinstance(entry, dict) and "id" in entry:
                    schedules[entry["id"]] = entry
        elif isinstance(data, dict):
            schedules = {key: value for key, value in data.items() if isinstance(value, dict)}
        self.schedules = schedules

    def _persist_locked(self) -> None:
        payload = [self._serialize_entry(entry, include_internal=True) for entry in self.schedules.values()]
        with self.storage_path.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)

    def start(self) -> None:
        if self.thread and self.thread.is_alive():
            return
        self.stop_event.clear()
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()

    def stop(self) -> None:
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=2.0)
            self.thread = None

    def _run_loop(self) -> None:
        while not self.stop_event.is_set():
            due_ids: List[str] = []
            now_ts = time.time()
            with self.lock:
                for schedule_id, entry in self.schedules.items():
                    if entry.get("status") == "scheduled" and entry.get("run_at_ts", 0) <= now_ts:
                        entry["status"] = "running"
                        entry["started_at"] = _utc_now_iso()
                        due_ids.append(schedule_id)
                if due_ids:
                    self._persist_locked()
            for schedule_id in due_ids:
                self._execute_schedule(schedule_id)
            self.stop_event.wait(5)

    def list_schedules(self) -> List[Dict[str, Any]]:
        with self.lock:
            return [self._serialize_entry(entry) for entry in self.schedules.values()]

    def add_schedule(self, workflow_id: str, workflow_name: str, device_id: str, run_at: datetime) -> Dict[str, Any]:
        run_at_ts = run_at.timestamp()
        if run_at_ts <= time.time():
            raise ValueError("run_at must be in the future.")
        schedule_id = uuid4().hex
        entry = {
            "id": schedule_id,
            "workflow_id": workflow_id,
            "workflow_name": workflow_name,
            "device_id": device_id,
            "run_at": run_at.isoformat(),
            "run_at_ts": run_at_ts,
            "status": "scheduled",
            "created_at": _utc_now_iso(),
            "updated_at": None,
            "started_at": None,
            "completed_at": None,
            "result": None,
        }
        with self.lock:
            self.schedules[schedule_id] = entry
            self._persist_locked()
            return self._serialize_entry(entry)

    def cancel_schedule(self, schedule_id: str) -> Optional[Dict[str, Any]]:
        with self.lock:
            entry = self.schedules.get(schedule_id)
            if not entry:
                return None
            if entry.get("status") != "scheduled":
                return None
            entry["status"] = "cancelled"
            entry["updated_at"] = _utc_now_iso()
            self._persist_locked()
            return self._serialize_entry(entry)

    def _serialize_entry(self, entry: Dict[str, Any], include_internal: bool = False) -> Dict[str, Any]:
        data = dict(entry)
        if not include_internal:
            data.pop("run_at_ts", None)
        return data

    def _mark_failure(self, schedule_id: str, message: str) -> None:
        with self.lock:
            entry = self.schedules.get(schedule_id)
            if not entry:
                return
            entry["status"] = "failed"
            entry["error"] = message
            entry["completed_at"] = _utc_now_iso()
            self._persist_locked()

    def _mark_success(self, schedule_id: str, result: Dict[str, Any]) -> None:
        with self.lock:
            entry = self.schedules.get(schedule_id)
            if not entry:
                return
            success = result.get("status") == "completed" and result.get("success", True)
            entry["status"] = "completed" if success else "failed"
            entry["completed_at"] = _utc_now_iso()
            entry["result"] = {
                "success": success,
                "execution_id": result.get("execution_id"),
            }
            if not success:
                entry["error"] = result.get("error") or result.get("results")
            self._persist_locked()

    def _execute_schedule(self, schedule_id: str) -> None:
        with self.lock:
            entry = self.schedules.get(schedule_id)
            if not entry:
                return
            workflow_id = entry.get("workflow_id")
            device_id = entry.get("device_id")
        workflow = next((w for w in workflows_db if w["id"] == workflow_id), None)
        if not workflow:
            self._mark_failure(schedule_id, "Workflow definition not found.")
            return
        if not device_id:
            self._mark_failure(schedule_id, "No device specified for scheduled run.")
            return

        module_entries: List[WorkflowModuleEntry] = []
        for module in workflow.get("modules", []):
            if isinstance(module, dict):
                module_entries.append(
                    WorkflowModuleEntry(
                        id=module.get("id") or module.get("module"),
                        parameters=module.get("parameters") or module.get("with") or {},
                    )
                )
            else:
                module_entries.append(WorkflowModuleEntry(id=str(module)))

        if not module_entries:
            self._mark_failure(schedule_id, "Workflow has no modules to execute.")
            return

        try:
            result = _run_workflow_modules(
                modules=module_entries,
                device_id=device_id,
                workflow_name=workflow.get("name") or workflow_id,
                workflow_id=workflow_id or "scheduled",
            )
        except Exception as exc:  # pragma: no cover - runtime safety
            self._mark_failure(schedule_id, str(exc))
            return
        self._mark_success(schedule_id, result)


workflow_scheduler = WorkflowScheduler(SCHEDULE_STORAGE_PATH)


def start_workflow_scheduler() -> None:
    workflow_scheduler.start()


def stop_workflow_scheduler() -> None:
    workflow_scheduler.stop()

@router.get("/workflows")
async def get_workflows():
    """Get all workflows"""
    return workflows_db


@router.get("/workflows/schedules")
async def list_workflow_schedules():
    """Return all workflow schedules (upcoming and historical)."""
    return workflow_scheduler.list_schedules()


@router.delete("/workflows/schedules/{schedule_id}")
async def cancel_workflow_schedule(schedule_id: str):
    """Cancel a scheduled workflow run if it has not started yet."""
    result = workflow_scheduler.cancel_schedule(schedule_id)
    if not result:
        raise HTTPException(status_code=404, detail="Schedule not found or already running.")
    return {"success": True, "schedule": result}

@router.get("/workflows/{workflow_id}")
async def get_workflow(workflow_id: str):
    """Get specific workflow"""
    workflow = next((w for w in workflows_db if w["id"] == workflow_id), None)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow

@router.post("/workflows")
async def create_workflow(workflow: WorkflowCreate):
    """Create new workflow"""
    new_workflow = {
        "id": f"wf_{len(workflows_db) + 1:03d}",
        "name": workflow.name,
        "description": workflow.description,
        "modules": workflow.modules,
        "tags": workflow.tags,
        "steps_count": len(workflow.modules),
        "status": "draft",
        "created_at": datetime.now().isoformat(),
        "last_run": None,
        "success_rate": 0,
        "total_runs": 0
    }
    workflows_db.append(new_workflow)
    _persist_workflows()
    return new_workflow

@router.put("/workflows/{workflow_id}")
async def update_workflow(workflow_id: str, workflow: WorkflowUpdate):
    """Update workflow"""
    existing = next((w for w in workflows_db if w["id"] == workflow_id), None)
    if not existing:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    if workflow.name:
        existing["name"] = workflow.name
    if workflow.description is not None:
        existing["description"] = workflow.description
    if workflow.modules:
        existing["modules"] = workflow.modules
        existing["steps_count"] = len(workflow.modules)
    if workflow.status:
        existing["status"] = workflow.status
    if workflow.tags is not None:
        existing["tags"] = workflow.tags
    _persist_workflows()
    return existing

@router.delete("/workflows/{workflow_id}")
async def delete_workflow(workflow_id: str):
    """Delete workflow"""
    global workflows_db
    workflows_db = [w for w in workflows_db if w["id"] != workflow_id]
    _persist_workflows()
    return {"success": True, "message": "Workflow deleted"}

@router.post("/workflows/{workflow_id}/execute")
async def execute_workflow(workflow_id: str, request: WorkflowRunRequest):
    """Execute a stored workflow sequentially."""
    workflow = next((w for w in workflows_db if w["id"] == workflow_id), None)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    module_entries = []
    for entry in workflow.get("modules", []):
        if isinstance(entry, dict):
            module_entries.append(WorkflowModuleEntry(
                id=entry.get("id") or entry.get("module"),
                parameters=entry.get("parameters") or entry.get("with") or {}
            ))
        else:
            module_entries.append(WorkflowModuleEntry(id=str(entry)))

    device_targets = _resolve_workflow_targets(request)
    return _run_workflow_modules(
        modules=module_entries,
        device_id=request.device_id,
        device_ids=device_targets,
        workflow_name=workflow["name"],
        workflow_id=workflow_id,
    )

@router.post("/workflows/{workflow_id}/duplicate")
async def duplicate_workflow(workflow_id: str):
    """Duplicate workflow"""
    original = next((w for w in workflows_db if w["id"] == workflow_id), None)
    if not original:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    duplicate = {
        **original,
        "id": f"wf_{len(workflows_db) + 1:03d}",
        "name": f"{original['name']} (Copy)",
        "status": "draft",
        "tags": original.get("tags", []),
        "created_at": datetime.now().isoformat(),
        "last_run": None,
        "success_rate": 0,
        "total_runs": 0
    }
    workflows_db.append(duplicate)
    _persist_workflows()
    return duplicate


@router.post("/workflows/{workflow_id}/schedule")
async def schedule_workflow_run(workflow_id: str, payload: WorkflowScheduleCreate):
    """Schedule a workflow to run at a future time for the provided devices."""
    workflow = next((w for w in workflows_db if w["id"] == workflow_id), None)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # Ensure the background dispatcher is running even if the host app forgot to start it.
    start_workflow_scheduler()

    device_ids = [device_id.strip() for device_id in payload.device_ids if device_id and device_id.strip()]
    if not device_ids:
        raise HTTPException(status_code=400, detail="At least one device_id is required.")

    try:
        entries = [
            workflow_scheduler.add_schedule(
                workflow_id=workflow_id,
                workflow_name=workflow["name"],
                device_id=device_id,
                run_at=payload.run_at,
            )
            for device_id in device_ids
        ]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return entries


@router.post("/workflows/execute")
async def execute_custom_workflow(request: WorkflowRunRequest):
    """Execute an ad-hoc workflow defined by the client."""
    if not request.modules:
        raise HTTPException(status_code=400, detail="No modules provided")

    device_targets = _resolve_workflow_targets(request)
    return _run_workflow_modules(
        modules=request.modules,
        device_id=request.device_id,
        device_ids=device_targets,
        workflow_name=request.name or "Custom Workflow",
        workflow_id="custom",
    )

@router.get("/workflows/{workflow_id}/export")
async def export_workflow(workflow_id: str):
    """Export workflow configuration"""
    workflow = next((w for w in workflows_db if w["id"] == workflow_id), None)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    export_data = {
        "name": workflow["name"],
        "description": workflow["description"],
        "modules": workflow["modules"],
        "export_date": datetime.now().isoformat(),
        "version": "1.0"
    }
    
    return {
        "filename": f"{workflow['name'].replace(' ', '_').lower()}.json",
        "content": json.dumps(export_data, indent=2),
        "content_type": "application/json"
    }



@router.get("/workflows/{workflow_id}/runs")
def list_workflow_runs(workflow_id: str, limit: int = 10):
    normalized_limit = max(1, min(limit, 50))
    runs = [entry for entry in _load_workflow_run_history() if entry.get("workflow_id") == workflow_id]
    return runs[:normalized_limit]


@router.get("/workflows/{workflow_id}/runs/latest")
def get_latest_workflow_run(workflow_id: str):
    entry = _get_latest_workflow_run(workflow_id)
    if not entry:
        raise HTTPException(status_code=404, detail="No run history available")
    return entry


@router.get("/workflows/{workflow_id}/runs/latest/export/csv")
def export_latest_workflow_run_csv(workflow_id: str):
    entry = _get_latest_workflow_run(workflow_id)
    if not entry:
        raise HTTPException(status_code=404, detail="No run history available")
    payload = _generate_run_csv(entry)
    filename = f"{entry.get('workflow_name', 'workflow').replace(' ', '_').lower()}_latest.csv"
    return Response(
        content=payload,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/workflows/{workflow_id}/runs/latest/export/pdf")
def export_latest_workflow_run_pdf(workflow_id: str):
    entry = _get_latest_workflow_run(workflow_id)
    if not entry:
        raise HTTPException(status_code=404, detail="No run history available")
    payload = _generate_run_pdf(entry)
    filename = f"{entry.get('workflow_name', 'workflow').replace(' ', '_').lower()}_latest.pdf"
    return Response(
        content=payload,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@router.get("/workflows/export/pdf")
def export_workflows_pdf() -> Response:
    """Export the current workflow catalog to PDF."""
    try:
        payload = _build_workflows_pdf(workflows_db)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {exc}")
    filename = f"workflows_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.pdf"
    return Response(
        content=payload,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename=\"{filename}\"'},
    )


def _resolve_module_entry(entry: WorkflowModuleEntry) -> Tuple[Optional[str], Dict[str, Any]]:
    module_id = entry.id or entry.module
    params = entry.parameters or {}
    return module_id, params


def _resolve_workflow_targets(request: WorkflowRunRequest) -> List[str]:
    targets: List[str] = []
    for device_id in request.device_ids or []:
        cleaned = (device_id or "").strip()
        if cleaned:
            targets.append(cleaned)
    if not targets and request.device_id:
        cleaned = request.device_id.strip()
        if cleaned:
            targets.append(cleaned)
    return targets


def _run_workflow_modules(
    modules: List[WorkflowModuleEntry],
    device_id: Optional[str],
    device_ids: List[str],
    workflow_name: str,
    workflow_id: str,
) -> Dict[str, Any]:
    flow_executor = FlowExecutor()

    results = []
    success = True
    module_count = len(modules)
    targets = [did.strip() for did in (device_ids or []) if did and did.strip()]
    if not targets and device_id:
        targets = [device_id]
    # deduplicate while preserving order
    seen = set()
    device_targets = []
    for did in targets:
        if did not in seen:
            seen.add(did)
            device_targets.append(did)
    if not device_targets:
        raise HTTPException(status_code=400, detail="At least one device_id is required to run workflows.")

    for index, entry in enumerate(modules, start=1):
        module_id, params = _resolve_module_entry(entry)
        if not module_id:
            results.append({
                "step": index,
                "module": None,
                "success": False,
                "error": "Module identifier missing",
            })
            success = False
            continue

        device_results = []

        def run_on_device(device_id: str) -> Dict[str, Any]:
            executor_for_device = flow_executor.get_executor(device_id)
            return flow_executor.execute_module(executor_for_device, module_id, params)

        with ThreadPoolExecutor(max_workers=len(device_targets)) as executor_pool:
            future_to_device = {
                executor_pool.submit(run_on_device, device_id): device_id for device_id in device_targets
            }
            for future in as_completed(future_to_device):
                device_id = future_to_device[future]
                try:
                    result = future.result()
                except Exception as exc:
                    result = {"module": module_id, "success": False, "error": str(exc)}
                device_results.append({
                    "device_id": device_id,
                    "success": bool(result.get("success", False)),
                    "result": result,
                })

        step_success = all(item["success"] for item in device_results)
        step_result = {
            "step": index,
            "module": module_id,
            "success": step_success,
            "device_results": device_results,
        }
        results.append(step_result)

        if not step_success:
            success = False

        if index < module_count:
            time.sleep(2)

    execution_id = f"exec_{workflow_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    run_payload = {
        "execution_id": execution_id,
        "workflow_id": workflow_id,
        "workflow_name": workflow_name,
        "device_id": device_id,
        "device_ids": device_targets,
        "status": "completed" if success else "failed",
        "success": success,
        "results": results,
    }
    _record_workflow_run(workflow_id, workflow_name, run_payload)
    return run_payload
