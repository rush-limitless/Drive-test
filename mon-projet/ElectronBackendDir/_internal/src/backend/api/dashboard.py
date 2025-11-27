"""
Dashboard API endpoints aligned with Spec 008.
"""

from collections import deque, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pymongo.errors import PyMongoError
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError

from core.database import db_manager, get_db
from models.device import Device, DeviceStatus
from models.execution import Execution, ExecutionStatus
from models.execution_device import ExecutionDevice
from models.flow import Flow
from models.flow_module import FlowModule

router = APIRouter()

_SEARCH_RATE_LIMIT_WINDOW_SECONDS = 10
_SEARCH_RATE_LIMIT_MAX_REQUESTS = 10
_search_request_log = defaultdict(deque)


def _relative_time(timestamp: Optional[datetime]) -> str:
    if not timestamp:
        return "Unknown time"
    delta = datetime.now(timezone.utc) - timestamp
    seconds = int(delta.total_seconds())
    if seconds < 60:
        return f"{seconds} seconds ago"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} minutes ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} hours ago"
    days = hours // 24
    if days < 7:
        return f"{days} days ago"
    weeks = days // 7
    return f"{weeks} weeks ago"


@router.get("/dashboard/summary")
def get_dashboard_summary(
    scope: str = Query(default="all"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Return aggregated metrics for the dashboard cards.

    Scope filtering is reserved for future enhancements (currently a no-op).
    """
    # Devices - Use ADB directly instead of database
    devices_payload: Dict[str, Any]
    try:
        import subprocess
        result = subprocess.run(['adb', 'devices'], capture_output=True, text=True)
        adb_devices = []
        for line in result.stdout.split('\n')[1:]:
            if line.strip() and '\t' in line:
                device_id, status = line.strip().split('\t')
                adb_devices.append({"id": device_id, "status": status})
        
        total_devices = len(adb_devices)
        connected_devices = len([d for d in adb_devices if d["status"] == "device"])
        
        devices_payload = {
            "connected": connected_devices,
            "total": total_devices,
            "error": None,
        }
    except Exception as exc:
        devices_payload = {
            "connected": 0,
            "total": 0,
            "error": {"code": "device_query_failed", "message": str(exc)},
        }

    # Workflow stats (Mongo)
    workflows_payload = {"total": 0, "active": 0, "draft": 0}
    try:
        workflows_collection = db_manager.get_collection("workflows")
        workflow_docs = list(workflows_collection.find({}))
        workflows_payload["total"] = len(workflow_docs)
        workflows_payload["active"] = sum(1 for doc in workflow_docs if doc.get("status") == "active")
        workflows_payload["draft"] = sum(1 for doc in workflow_docs if doc.get("status") == "draft")
    except PyMongoError:
        # Fallback to SQL flows when Mongo not available
        total_flows = db.query(Flow).count()
        workflows_payload["total"] = total_flows
        # Assume flows with `is_template=False` are active, others considered draft
        workflows_payload["active"] = db.query(Flow).filter(Flow.is_template == False).count()  # noqa: E712
        workflows_payload["draft"] = total_flows - workflows_payload["active"]

    quick_actions = [
        {"id": "quick-test", "label": "Quick Test", "href": "/run/quick", "icon": "rocket"},
        {"id": "workflows", "label": "Workflows", "href": "/workflows", "icon": "flow"},
        {"id": "modules", "label": "Modules", "href": "/modules", "icon": "cube"},
    ]

    scopes = [
        {"id": "all", "label": "All Devices", "count": devices_payload.get("total", 0)}
    ]

    return {
        "scope": scope,
        "scopes": scopes,
        "devices": devices_payload,
        "workflows": workflows_payload,
        "quickActions": quick_actions,
    }


@router.get("/dashboard/activity/recent")
def get_recent_activity(
    limit: int = Query(default=10, ge=1, le=25),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return recent activity items derived from executions."""
    try:
        executions = (
            db.query(Execution)
            .order_by(Execution.updated_at.desc().nullslast(), Execution.start_time.desc().nullslast())
            .limit(limit)
            .all()
        )
    except OperationalError:
        return {"items": []}

    items: List[Dict[str, Any]] = []
    for execution in executions:
        flow_name = execution.flow.name if execution.flow else execution.flow_id
        status = execution.status.value
        icon = {
            ExecutionStatus.COMPLETED.value: "check",
            ExecutionStatus.FAILED.value: "warning",
            ExecutionStatus.RUNNING.value: "loader",
            ExecutionStatus.CANCELLED.value: "ban",
        }.get(status, "info")

        timestamp = execution.updated_at or execution.end_time or execution.start_time
        items.append(
            {
                "id": str(execution.id),
                "icon": icon,
                "title": f"{flow_name} {status}",
                "ts": timestamp.isoformat() if timestamp else None,
                "meta": _relative_time(timestamp),
            }
        )

    return {"items": items}


@router.get("/search")
def global_search(
    request: Request,
    q: str = Query(min_length=1),
    limit: int = Query(default=8, ge=1, le=25),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Unified search across modules, workflows, and devices."""
    client_id = request.client.host if request.client else "unknown"
    now = datetime.now(timezone.utc).timestamp()
    log = _search_request_log[client_id]
    while log and now - log[0] > _SEARCH_RATE_LIMIT_WINDOW_SECONDS:
        log.popleft()
    if len(log) >= _SEARCH_RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(status_code=429, detail="Too many search requests, please slow down.")
    log.append(now)

    query = q.strip().lower()
    if not query:
        return {"results": []}

    results: List[Dict[str, Any]] = []

    # Modules (distinct module IDs from flow modules)
    module_rows = (
        db.query(FlowModule.module_id)
        .filter(func.lower(FlowModule.module_id).contains(query))
        .distinct()
        .limit(limit)
        .all()
    )
    for (module_id,) in module_rows:
        label = module_id.replace("_", " ").title()
        results.append(
            {
                "type": "module",
                "id": module_id,
                "label": label,
                "href": f"/modules/{module_id}",
            }
        )
        if len(results) >= limit:
            return {"results": results}

    # Workflows (Mongo + SQL fallback)
    try:
        workflows_collection = db_manager.get_collection("workflows")
        workflow_docs = list(
            workflows_collection.find({"name": {"$regex": query, "$options": "i"}}).limit(limit)
        )
        for doc in workflow_docs:
            results.append(
                {
                    "type": "workflow",
                    "id": str(doc["_id"]),
                    "label": doc.get("name", "Unnamed Workflow"),
                    "href": f"/workflows/{doc['_id']}",
                }
            )
            if len(results) >= limit:
                return {"results": results}
    except PyMongoError:
        sql_flows = (
            db.query(Flow)
            .filter(or_(func.lower(Flow.name).contains(query), func.lower(Flow.description).contains(query)))
            .limit(limit)
            .all()
        )
        for flow in sql_flows:
            results.append(
                {
                    "type": "workflow",
                    "id": str(flow.id),
                    "label": flow.name,
                    "href": f"/workflows/{flow.id}",
                }
            )
            if len(results) >= limit:
                return {"results": results}

    # Devices
    device_rows = (
        db.query(Device)
        .filter(
            or_(
                func.lower(Device.id).contains(query),
                func.lower(Device.model).contains(query),
            )
        )
        .limit(limit)
        .all()
    )
    for device in device_rows:
        label = f"{device.model} • {device.status.value}"
        results.append(
            {
                "type": "device",
                "id": device.id,
                "label": label,
                "href": f"/devices/{device.id}",
            }
        )
        if len(results) >= limit:
            break

    return {"results": results[:limit]}
