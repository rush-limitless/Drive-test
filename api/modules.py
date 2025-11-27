"""
Fallback Modules API so backend boot succeeds.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

router = APIRouter()


class ModuleExecute(BaseModel):
    device_id: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = {}


modules_db = [
    {
        "id": "call_test",
        "name": "Call Test",
        "description": "Quickly test voice call and audio quality.",
        "category": "communication",
        "complexity": "simple",
        "duration_estimate": "30-45s",
        "parameters": {
            "phone_number": {"type": "string", "required": True, "default": "+1234567890"},
            "call_duration": {"type": "integer", "required": False, "default": 10},
        },
        "requirements": ["microphone", "speaker"],
        "last_run": "2m ago",
        "success_rate": 95.5,
        "total_runs": 127,
    },
    {
        "id": "network_check",
        "name": "Network Check",
        "description": "Check main network indicators and connectivity.",
        "category": "network",
        "complexity": "simple",
        "duration_estimate": "1-2m",
        "parameters": {
            "test_url": {"type": "string", "required": False, "default": "https://google.com"},
            "timeout": {"type": "integer", "required": False, "default": 30},
        },
        "requirements": ["internet_connection"],
        "last_run": "10m ago",
        "success_rate": 92.1,
        "total_runs": 156,
    },
    {
        "id": "airplane_mode_on",
        "name": "Airplane Mode On",
        "description": "Enable airplane mode to test network recovery.",
        "category": "device",
        "complexity": "simple",
        "duration_estimate": "10-15s",
        "parameters": {},
        "requirements": [],
        "last_run": "15m ago",
        "success_rate": 97.3,
        "total_runs": 74,
    },
]


@router.get("/modules")
async def get_modules():
    return modules_db


@router.get("/modules/{module_id}")
async def get_module(module_id: str):
    module = next((m for m in modules_db if m["id"] == module_id), None)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return module


@router.post("/modules/{module_id}/execute")
async def execute_module(module_id: str, execution: ModuleExecute):
    module = next((m for m in modules_db if m["id"] == module_id), None)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
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
