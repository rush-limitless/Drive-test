"""
Executions API endpoints for ADB Framework
"""
from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import json

router = APIRouter()

class ExecutionFilter(BaseModel):
    status: Optional[str] = None
    device_id: Optional[str] = None
    workflow_id: Optional[str] = None
    module_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None

# Mock executions data
executions_db = [
    {
        "id": "exec_001",
        "type": "workflow",
        "workflow_id": "wf_001",
        "workflow_name": "Voice Call Test Suite",
        "device_id": "SM-A426U1",
        "device_name": "Samsung Galaxy A42 5G",
        "status": "completed",
        "started_at": "2024-01-20T14:30:00Z",
        "completed_at": "2024-01-20T14:32:15Z",
        "duration": "2m 15s",
        "success_rate": 100,
        "total_steps": 3,
        "completed_steps": 3,
        "failed_steps": 0,
        "results": {
            "voice_call_test": {"status": "success", "duration": "45s"},
            "call_quality_check": {"status": "success", "duration": "30s"},
            "audio_test": {"status": "success", "duration": "60s"}
        }
    },
    {
        "id": "exec_002",
        "type": "module",
        "module_id": "network_test",
        "module_name": "Network Connectivity Test",
        "device_id": "M2101K7AG",
        "device_name": "Xiaomi Redmi Note 10",
        "status": "running",
        "started_at": "2024-01-20T14:25:00Z",
        "completed_at": None,
        "duration": "1m 23s",
        "progress": 65,
        "current_step": "Latency test",
        "results": {}
    },
    {
        "id": "exec_003",
        "type": "workflow",
        "workflow_id": "wf_002",
        "workflow_name": "Network Performance Suite",
        "device_id": "SM-A426U1",
        "device_name": "Samsung Galaxy A42 5G",
        "status": "failed",
        "started_at": "2024-01-20T13:15:00Z",
        "completed_at": "2024-01-20T13:17:30Z",
        "duration": "2m 30s",
        "success_rate": 33,
        "total_steps": 3,
        "completed_steps": 1,
        "failed_steps": 2,
        "error": "Device connection lost",
        "results": {
            "network_test": {"status": "success", "duration": "45s"},
            "speed_test": {"status": "failed", "error": "Timeout"},
            "latency_test": {"status": "failed", "error": "Connection lost"}
        }
    }
]

@router.get("/executions")
async def get_executions(
    status: Optional[str] = None,
    device_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """Get execution history with filters"""
    filtered_executions = executions_db
    
    if status:
        filtered_executions = [e for e in filtered_executions if e["status"] == status]
    
    if device_id:
        filtered_executions = [e for e in filtered_executions if e["device_id"] == device_id]
    
    # Sort by started_at descending
    filtered_executions.sort(key=lambda x: x["started_at"], reverse=True)
    
    return {
        "executions": filtered_executions[offset:offset + limit],
        "total": len(filtered_executions),
        "limit": limit,
        "offset": offset
    }

@router.get("/executions/{execution_id}")
async def get_execution(execution_id: str):
    """Get specific execution details"""
    execution = next((e for e in executions_db if e["id"] == execution_id), None)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    return execution

@router.post("/executions/{execution_id}/stop")
async def stop_execution(execution_id: str):
    """Stop a running execution"""
    execution = next((e for e in executions_db if e["id"] == execution_id), None)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    if execution["status"] != "running":
        raise HTTPException(status_code=400, detail="Execution is not running")
    
    execution["status"] = "stopped"
    execution["completed_at"] = datetime.now().isoformat()
    
    return {
        "success": True,
        "message": "Execution stopped",
        "execution_id": execution_id
    }

@router.delete("/executions/{execution_id}")
async def delete_execution(execution_id: str):
    """Delete execution record"""
    global executions_db
    original_count = len(executions_db)
    executions_db = [e for e in executions_db if e["id"] != execution_id]
    
    if len(executions_db) == original_count:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    return {"success": True, "message": "Execution deleted"}

@router.get("/executions/{execution_id}/logs")
async def get_execution_logs(execution_id: str):
    """Get execution logs"""
    execution = next((e for e in executions_db if e["id"] == execution_id), None)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    # Mock log data
    logs = [
        {
            "timestamp": "2024-01-20T14:30:00Z",
            "level": "INFO",
            "message": "Execution started",
            "component": "executor"
        },
        {
            "timestamp": "2024-01-20T14:30:05Z",
            "level": "INFO", 
            "message": "Device connected successfully",
            "component": "device_manager"
        },
        {
            "timestamp": "2024-01-20T14:30:10Z",
            "level": "INFO",
            "message": "Starting voice_call_test module",
            "component": "module_executor"
        }
    ]
    
    return {"logs": logs}

@router.get("/executions/{execution_id}/artifacts")
async def get_execution_artifacts(execution_id: str):
    """Get execution artifacts (screenshots, logs, reports)"""
    execution = next((e for e in executions_db if e["id"] == execution_id), None)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    # Mock artifacts
    artifacts = [
        {
            "type": "screenshot",
            "name": "call_screen.png",
            "size": "245 KB",
            "created_at": "2024-01-20T14:30:30Z",
            "download_url": f"/api/executions/{execution_id}/artifacts/call_screen.png"
        },
        {
            "type": "log",
            "name": "execution.log",
            "size": "12 KB", 
            "created_at": "2024-01-20T14:32:15Z",
            "download_url": f"/api/executions/{execution_id}/artifacts/execution.log"
        },
        {
            "type": "report",
            "name": "test_report.json",
            "size": "8 KB",
            "created_at": "2024-01-20T14:32:15Z",
            "download_url": f"/api/executions/{execution_id}/artifacts/test_report.json"
        }
    ]
    
    return {"artifacts": artifacts}

@router.get("/executions/stats/summary")
async def get_execution_stats():
    """Get execution statistics summary"""
    total_executions = len(executions_db)
    successful = len([e for e in executions_db if e["status"] == "completed"])
    failed = len([e for e in executions_db if e["status"] == "failed"])
    running = len([e for e in executions_db if e["status"] == "running"])
    
    return {
        "total_executions": total_executions,
        "successful": successful,
        "failed": failed,
        "running": running,
        "success_rate": (successful / total_executions * 100) if total_executions > 0 else 0,
        "avg_duration": "2m 15s",
        "executions_today": 5,
        "executions_this_week": 23
    }

@router.post("/executions/bulk-delete")
async def bulk_delete_executions(execution_ids: List[str]):
    """Delete multiple executions"""
    global executions_db
    original_count = len(executions_db)
    executions_db = [e for e in executions_db if e["id"] not in execution_ids]
    deleted_count = original_count - len(executions_db)
    
    return {
        "success": True,
        "message": f"Deleted {deleted_count} executions",
        "deleted_count": deleted_count
    }