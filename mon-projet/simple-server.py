"""Simple FastAPI server without complex dependencies."""

import asyncio
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import logging
import yaml
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator


def _ensure_backend_on_path() -> Path:
    """Ensure packaged src/backend modules stay importable when frozen."""
    current_dir = Path(__file__).resolve().parent
    candidate_roots = [
        current_dir,
        getattr(sys, "_MEIPASS", current_dir),
    ]

    for root in candidate_roots:
        src_dir = root / "src"
        backend_dir = src_dir / "backend"
        if backend_dir.exists():
            for path in (backend_dir, src_dir):
                path_str = str(path)
                if path_str not in sys.path:
                    sys.path.insert(0, path_str)
            return backend_dir
    raise RuntimeError("Unable to locate src/backend for dynamic imports.")


_ensure_backend_on_path()
# Configure logging early
from src.backend.core.logging import setup_logging  # noqa: E402
setup_logging()

# Import ADB modules
from src.backend.modules.flow_executor import FlowExecutor
from src.backend.modules.adb_executor import ADBExecutor
from src.backend.modules.telco_modules import TelcoModules
from src.backend.core.config import ensure_directories
from src.backend.core.database import ensure_sql_schema

# Import API routers
from src.backend.api.devices_legacy import router as devices_router_legacy
from src.backend.api.devices import router as devices_router_v1
from src.backend.api.dashboard import router as dashboard_router
from src.backend.api.workflows import (
    router as workflows_router,
    start_workflow_scheduler,
    stop_workflow_scheduler,
)
from src.backend.api.modules import router as modules_router
from src.backend.api.executions import router as executions_router
from src.backend.api.reports import router as reports_router
from src.backend.api.preferences import router as preferences_router
from src.backend.api.websocket_router import router as websocket_router
from src.backend.api.health import router as health_router, adb_health as backend_adb_health
from src.backend.services.device_manager import device_manager

def _import_all_models() -> None:
    import importlib

    model_modules = [
        "models.device",
        "models.device_log",
        "models.flow",
        "models.flow_module",
        "models.execution",
        "models.execution_device",
        "models.execution_step",
        "models.report",
        "models.workflow_models",
        "models.user_preference",
    ]

    for module_path in model_modules:
        importlib.import_module(module_path)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background services (like the workflow scheduler) for the simple server."""
    _import_all_models()
    ensure_directories()
    ensure_sql_schema()
    start_workflow_scheduler()
    await device_manager.start_monitoring()
    # Prime the cache immediately so the UI sees connected devices without manual refresh.
    try:
        await device_manager.scan_and_update_devices()
    except Exception as exc:
        logging.getLogger(__name__).warning("Initial device scan failed: %s", exc)
    try:
        yield
    finally:
        await device_manager.stop_monitoring()
        stop_workflow_scheduler()


app = FastAPI(title="Telco ADB Automation", lifespan=lifespan)

# Allow renderer (file://) + localhost origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def include_all_routes(prefix: str) -> None:
    """Mount every router under the provided prefix."""
    # Expose both legacy and full devices router (includes PDF export)
    app.include_router(devices_router_legacy, prefix=prefix, tags=["devices_legacy"])
    app.include_router(devices_router_v1, prefix=prefix, tags=["devices"])
    app.include_router(dashboard_router, prefix=prefix, tags=["dashboard"])
    app.include_router(workflows_router, prefix=prefix, tags=["workflows"])
    app.include_router(modules_router, prefix=prefix, tags=["modules"])
    app.include_router(executions_router, prefix=prefix, tags=["executions"])
    app.include_router(reports_router, prefix=prefix, tags=["reports"])
    app.include_router(websocket_router, prefix=prefix, tags=["websocket"])
    app.include_router(preferences_router, prefix=prefix, tags=["preferences"])
    app.include_router(health_router, prefix=prefix, tags=["health"])

# REST endpoints available under /api and /api/v1 to mirror the full backend
include_all_routes("/api")
include_all_routes("/api/v1")

# Global flow executor
flow_executor = FlowExecutor()
executions = {}  # Store execution results

class FlowExecutionRequest(BaseModel):
    device_selector: str = "any"
    device_id: Optional[str] = None
    module_id: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    repeat_count: int = 1
    duration_seconds: int = 0

    @field_validator("repeat_count", mode="before")
    def validate_repeat_count(cls, value):
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            parsed = 1
        return max(1, parsed)

    @field_validator("duration_seconds", mode="before")
    def validate_duration_seconds(cls, value):
        if value is None:
            return 0
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            parsed = 0
        return max(0, parsed)

# Serve static files
static_dir = os.path.join(os.path.dirname(__file__), "src", "backend", "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/api/health/adb")
async def proxy_adb_health():
    """Expose adb health check for legacy clients."""
    return await backend_adb_health()


@app.get("/api/v1/health/adb")
async def proxy_adb_health_v1():
    """Expose adb health check with /api/v1 prefix."""
    return await backend_adb_health()

@app.get("/")
async def root():
    """Serve the web UI."""
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "Telco ADB Automation API"}

@app.get("/api/devices")
async def get_devices():
    """Get connected devices with detailed info."""
    try:
        result = subprocess.run(['adb', 'devices'], capture_output=True, text=True)
        devices = []
        for line in result.stdout.split('\n')[1:]:
            if line.strip() and '\t' in line:
                device_id, status = line.strip().split('\t')
                
                # Get device info
                model = "Unknown"
                android_version = "Unknown"
                battery_level = "Unknown"
                network_operator = "Unknown"
                
                try:
                    # Get model
                    model_result = subprocess.run(
                        ['adb', '-s', device_id, 'shell', 'getprop', 'ro.product.model'],
                        capture_output=True, text=True, timeout=3
                    )
                    if model_result.returncode == 0:
                        model = model_result.stdout.strip()
                    
                    # Get Android version
                    version_result = subprocess.run(
                        ['adb', '-s', device_id, 'shell', 'getprop', 'ro.build.version.release'],
                        capture_output=True, text=True, timeout=3
                    )
                    if version_result.returncode == 0:
                        android_version = version_result.stdout.strip()
                    
                    # Get battery level - try multiple methods
                    try:
                        # Method 1: cat /sys/class/power_supply/battery/capacity
                        battery_result = subprocess.run(
                            ['adb', '-s', device_id, 'shell', 'cat', '/sys/class/power_supply/battery/capacity'],
                            capture_output=True, text=True, timeout=3
                        )
                        if battery_result.returncode == 0 and battery_result.stdout.strip().isdigit():
                            battery_level = battery_result.stdout.strip() + '%'
                            print(f"Battery level (method 1) for {device_id}: {battery_level}")
                        else:
                            # Method 2: dumpsys battery
                            battery_result = subprocess.run(
                                ['adb', '-s', device_id, 'shell', 'dumpsys', 'battery'],
                                capture_output=True, text=True, timeout=5
                            )
                            if battery_result.returncode == 0:
                                for line in battery_result.stdout.split('\n'):
                                    if 'level:' in line:
                                        level_value = line.split(':')[1].strip()
                                        battery_level = level_value + '%'
                                        print(f"Battery level (method 2) for {device_id}: {battery_level}")
                                        break
                    except Exception as e:
                        print(f"Battery level error for {device_id}: {e}")
                    
                    # Get network operator
                    operator_result = subprocess.run(
                        ['adb', '-s', device_id, 'shell', 'getprop', 'gsm.operator.alpha'],
                        capture_output=True, text=True, timeout=3
                    )
                    if operator_result.returncode == 0 and operator_result.stdout.strip():
                        network_operator = operator_result.stdout.strip()
                    else:
                        # Fallback to numeric operator
                        numeric_result = subprocess.run(
                            ['adb', '-s', device_id, 'shell', 'getprop', 'gsm.operator.numeric'],
                            capture_output=True, text=True, timeout=3
                        )
                        if numeric_result.returncode == 0 and numeric_result.stdout.strip():
                            network_operator = numeric_result.stdout.strip()
                
                except Exception as e:
                    print(f"Error getting device info for {device_id}: {e}")
                
                devices.append({
                    "id": device_id,
                    "model": model,
                    "android_version": android_version,
                    "connection_type": "USB",
                    "status": "online" if status == "device" else status,
                    "last_seen": "now",
                    "battery_level": battery_level,
                    "network_operator": network_operator
                })
        return devices
    except Exception as e:
        print(f"Error getting devices: {e}")
        return []

@app.get("/api/devices/stats")
async def get_device_stats():
    """Get device connection statistics."""
    try:
        # Get ADB devices
        adb_result = subprocess.run(['adb', 'devices'], capture_output=True, text=True)
        adb_devices = []
        for line in adb_result.stdout.split('\n')[1:]:
            if line.strip() and '\t' in line:
                device_id, status = line.strip().split('\t')
                adb_devices.append({"id": device_id, "status": status})
        
        # Count ready devices (status = "device")
        ready_devices = len([d for d in adb_devices if d["status"] == "device"])
        
        # Total connected includes all ADB-visible devices
        total_connected = len(adb_devices)
        
        return {
            "ready_devices": ready_devices,
            "total_connected": total_connected,
            "devices_needing_setup": total_connected - ready_devices
        }
    except Exception as e:
        return {
            "ready_devices": 0,
            "total_connected": 0,
            "devices_needing_setup": 0,
            "error": str(e)
        }

@app.get("/api/v1/devices")
async def get_devices_v1():
    """Legacy endpoint for v1 API."""
    devices = await get_devices()
    return devices

@app.post("/api/devices/{device_id}/disconnect")
async def disconnect_device(device_id: str):
    """Disconnect a specific device."""
    try:
        print(f"Attempting to disconnect device: {device_id}")
        
        # First try to disconnect if it's a network device
        if ':' in device_id:  # Network device (IP:PORT)
            result = subprocess.run(
                ['adb', 'disconnect', device_id],
                capture_output=True, text=True, timeout=10
            )
            print(f"ADB disconnect result: {result.returncode}, stdout: {result.stdout}, stderr: {result.stderr}")
        else:
            # For USB devices, we can't really disconnect them, but we can kill the server
            result = subprocess.run(
                ['adb', 'kill-server'],
                capture_output=True, text=True, timeout=10
            )
            print(f"ADB kill-server result: {result.returncode}, stdout: {result.stdout}, stderr: {result.stderr}")
            
            # Restart ADB server
            subprocess.run(['adb', 'start-server'], capture_output=True, text=True, timeout=10)
        
        return {"success": True, "message": f"Device {device_id} disconnected successfully", "output": result.stdout}
        
    except Exception as e:
        print(f"Disconnect error: {e}")
        return {"success": False, "message": f"Disconnect failed: {str(e)}"}

@app.post("/api/v1/flows/single_module/execute")
async def execute_single_module(request: FlowExecutionRequest, background_tasks: BackgroundTasks):
    """Execute a single module."""
    module_id = request.module_id or 'call_test'
    print(f"DEBUG: Received request with module_id: {request.module_id}")
    print(f"DEBUG: Using module_id: {module_id}")
    
    # Create a simple flow with just this module
    step_config = {'module': module_id}
    if request.parameters:
        step_config['with'] = request.parameters
        print(f"DEBUG: Using custom parameters: {request.parameters}")
    
    flow_config = {
        'id': f'single_{module_id}',
        'name': f'Single Module: {module_id}',
        'steps': [step_config],
        'policy': {'stop_on_failure': True}
    }
    
    print(f"DEBUG: Created flow config with steps: {flow_config['steps']}")
    
    # Get device
    device_id = request.device_id
    if not device_id and request.device_selector == "any":
        devices = flow_executor.get_available_devices()
        online_devices = [d for d in devices if d['status'] == 'online']
        if online_devices:
            device_id = online_devices[0]['id']
    
    # Determine scheduling strategy
    repeat_count = request.repeat_count
    duration_seconds = request.duration_seconds
    execution_id = f"exec_single_{module_id}_{len(executions) + 1}"
    multi_run = repeat_count > 1 or duration_seconds > 0

    if multi_run:
        executions[execution_id] = {
            "execution_id": execution_id,
            "status": "scheduled",
            "flow_id": flow_config.get('id', f"single_{module_id}"),
            "flow_name": flow_config.get('name', module_id),
            "device_id": device_id,
            "repeat_count": repeat_count,
            "duration_seconds": duration_seconds,
            "runs_completed": 0,
            "runs": [],
            "started_at": None
        }
        background_tasks.add_task(
            run_repeated_flow,
            execution_id,
            flow_config,
            device_id,
            repeat_count,
            duration_seconds
        )
    else:
        executions[execution_id] = {
            "execution_id": execution_id,
            "status": "starting",
            "flow_id": f"single_{module_id}",
            "flow_name": flow_config.get('name', module_id),
            "device_id": device_id
        }
        background_tasks.add_task(run_flow_execution, execution_id, flow_config, device_id)
    
    print(f"DEBUG: Returning execution_id: {execution_id} for module: {module_id}")
    
    return {
        "execution_id": execution_id,
        "status": "started",
        "module_id": module_id,
        "device_id": device_id,
        "repeat_count": repeat_count,
        "duration_seconds": duration_seconds
    }

@app.post("/api/v1/flows/{flow_id}/execute")
async def execute_flow(flow_id: str, request: FlowExecutionRequest, background_tasks: BackgroundTasks):
    """Execute a flow."""
    # Load flow configurations dynamically
    flow_configs = load_all_flows()
    
    # Add default flows if not found
    if 'daily_smoke' not in flow_configs:
        flow_configs['daily_smoke'] = {
            'id': 'daily_smoke',
            'name': 'Daily Smoke (Voice+SMS+Data)',
            'steps': [
                {'module': 'network_check'},
                {'module': 'call_test', 'with': {'number': '*123#', 'calls': 2}},
                {'module': 'sms_test', 'with': {'recipient': '+237695029469', 'count': 3}},
                {'module': 'network_perf', 'with': {'server_ip': '192.168.0.100'}}
            ],
            'policy': {'stop_on_failure': False}
        }
    
    if flow_id not in flow_configs:
        return JSONResponse(
            status_code=404,
            content={"error": f"Flow {flow_id} not found"}
        )
    
    flow_config = flow_configs[flow_id]
    
    # Get device
    device_id = request.device_id
    if not device_id and request.device_selector == "any":
        devices = flow_executor.get_available_devices()
        online_devices = [d for d in devices if d['status'] == 'online']
        if online_devices:
            device_id = online_devices[0]['id']
    
    repeat_count = request.repeat_count
    duration_seconds = request.duration_seconds
    multi_run = repeat_count > 1 or duration_seconds > 0

    execution_id = f"exec_{flow_id}_{len(executions) + 1}"
    if multi_run:
        executions[execution_id] = {
            "execution_id": execution_id,
            "status": "scheduled",
            "flow_id": flow_id,
            "flow_name": flow_config.get('name', flow_id),
            "device_id": device_id,
            "repeat_count": repeat_count,
            "duration_seconds": duration_seconds,
            "runs_completed": 0,
            "runs": [],
            "started_at": None
        }
        background_tasks.add_task(
            run_repeated_flow,
            execution_id,
            flow_config,
            device_id,
            repeat_count,
            duration_seconds
        )
    else:
        executions[execution_id] = {
            "execution_id": execution_id,
            "status": "starting",
            "flow_id": flow_id,
            "flow_name": flow_config.get('name', flow_id),
            "device_id": device_id
        }
        background_tasks.add_task(run_flow_execution, execution_id, flow_config, device_id)
    
    return {
        "execution_id": execution_id,
        "status": "started",
        "flow_id": flow_id,
        "device_id": device_id,
        "repeat_count": repeat_count,
        "duration_seconds": duration_seconds
    }

async def run_repeated_flow(
    parent_execution_id: str,
    flow_config: Dict[str, Any],
    device_id: Optional[str],
    repeat_count: int,
    duration_seconds: int
):
    """Run a flow repeatedly according to repeat/duration settings."""
    parent_execution = executions.get(parent_execution_id)
    if not parent_execution:
        executions[parent_execution_id] = {
            "execution_id": parent_execution_id,
            "status": "failed",
            "error": "Parent execution missing for repeated run"
        }
        return

    parent_execution["status"] = "running"
    parent_execution["started_at"] = parent_execution.get("started_at") or time.time()
    total_runs_required = max(1, repeat_count)
    duration_limit = max(0, duration_seconds)
    start_monotonic = time.monotonic()
    runs_completed = 0
    any_failures = False
    policy = flow_config.get('policy', {})

    while True:
        runs_completed += 1
        current_run_id = f"{parent_execution_id}_run{runs_completed}"
        parent_execution.setdefault("runs", []).append(current_run_id)
        parent_execution["current_run"] = runs_completed
        parent_execution["runs_completed"] = runs_completed

        await run_flow_execution(current_run_id, flow_config, device_id)
        child_result = executions.get(current_run_id, {})
        child_status = child_result.get("status", "unknown")
        parent_execution["last_child_execution"] = current_run_id
        parent_execution["last_run_status"] = child_status

        if child_status == "failed":
            any_failures = True
            if policy.get('stop_on_failure'):
                break

        elapsed = time.monotonic() - start_monotonic
        need_more_by_count = runs_completed < total_runs_required
        need_more_by_duration = duration_limit > 0 and elapsed < duration_limit

        if not (need_more_by_count or need_more_by_duration):
            break

        await asyncio.sleep(0.1)

    parent_execution["status"] = "failed" if any_failures else "completed"
    parent_execution["completed_at"] = time.time()

async def run_flow_execution(execution_id: str, flow_config: Dict[str, Any], device_id: Optional[str]):
    """Run flow execution in background."""
    try:
        # Handle voice_call_test module specially
        if len(flow_config.get('steps', [])) == 1:
            step = flow_config['steps'][0]
            if step.get('module') == 'voice_call_test':
                # Execute voice call test directly
                telco = TelcoModules()
                params = step.get('with', {})
                result = telco.voice_call_test(
                    number=params.get('number', '*123#'),
                    duration=params.get('duration', 10),
                    call_count=params.get('call_count', 1)
                )
                
                executions[execution_id] = {
                    "execution_id": execution_id,
                    "status": "completed" if result['success'] else "failed",
                    "flow_id": flow_config.get('id', 'unknown'),
                    "device_id": device_id,
                    "step_results": [{
                        "step_number": 1,
                        "module": "voice_call_test",
                        "success": result['success'],
                        "duration": result['duration'],
                        "error": result.get('error'),
                        "number": result.get('number'),
                        "call_duration": result.get('call_duration'),
                        "call_count": result.get('call_count'),
                        "successful_calls": result.get('successful_calls'),
                        "results": result.get('results', [])
                    }],
                    "steps_completed": 1,
                    "total_steps": 1
                }
                return
            # Handle call_test with new parameters
            elif step.get('module') == 'call_test':
                telco = TelcoModules()
                params = step.get('with', {})
                if 'duration' in params or 'call_count' in params:
                    # Use voice_call_test for advanced parameters
                    result = telco.voice_call_test(
                        number=params.get('number', '*123#'),
                        duration=params.get('duration', 10),
                        call_count=params.get('call_count', 1)
                    )
                else:
                    # Use simple call test
                    result = telco.call_test(
                        number=params.get('number', '*123#'),
                        calls=params.get('calls', 1)
                    )
                
                executions[execution_id] = {
                    "execution_id": execution_id,
                    "status": "completed" if result['success'] else "failed",
                    "flow_id": flow_config.get('id', 'unknown'),
                    "device_id": device_id,
                    "step_results": [{
                        "step_number": 1,
                        "module": "call_test",
                        "success": result['success'],
                        "duration": result['duration'],
                        "error": result.get('error'),
                        "total_calls": result.get('call_count', result.get('total_calls', 1)),
                        "successful_calls": result.get('successful_calls', 1 if result['success'] else 0),
                        "results": result.get('results', [])
                    }],
                    "steps_completed": 1,
                    "total_steps": 1
                }
                return
        
        # Default flow execution
        result = flow_executor.execute_flow(flow_config, device_id)
        executions[execution_id] = result
    except Exception as e:
        executions[execution_id] = {
            "execution_id": execution_id,
            "status": "failed",
            "error": str(e)
        }

@app.get("/api/v1/executions/{execution_id}")
async def get_execution(execution_id: str):
    """Get execution status and results."""
    if execution_id not in executions:
        return JSONResponse(
            status_code=404,
            content={"error": "Execution not found"}
        )
    
    return executions[execution_id]

@app.get("/api/v1/executions")
async def list_executions():
    """List all executions."""
    return list(executions.values())

@app.get("/api/v1/reports")
async def get_reports():
    """Get recent reports."""
    # Convert executions to reports format
    reports = []
    for exec_id, execution in executions.items():
        if execution.get('status') in ['completed', 'failed']:
            reports.append({
                "id": exec_id,
                "flow_name": execution.get('flow_name', 'Unknown'),
                "status": execution.get('status'),
                "created_at": execution.get('start_time', 0),
                "device_id": execution.get('device_id'),
                "steps_completed": execution.get('steps_completed', 0),
                "total_steps": execution.get('total_steps', 0)
            })
    
    return sorted(reports, key=lambda x: x['created_at'], reverse=True)[:10]

def load_all_flows() -> Dict[str, Any]:
    """Load all flow configurations from YAML files."""
    flows = {
        # Default English workflows
        'daily_smoke': {
            'id': 'daily_smoke',
            'name': 'Daily Smoke Test',
            'description': 'Comprehensive daily test suite covering voice, SMS, and data functionality',
            'steps': [
                {'module': 'network_check'},
                {'module': 'voice_call_test', 'with': {'number': '*123#', 'duration': 10}},
                {'module': 'sms_test', 'with': {'recipient': '+237695029469', 'message': 'Test SMS'}},
                {'module': 'network_speed_test'}
            ],
            'policy': {'stop_on_failure': False}
        },
        'network_validation': {
            'id': 'network_validation',
            'name': 'Network Validation Suite',
            'description': 'Complete network connectivity and performance validation',
            'steps': [
                {'module': 'check_signal_strength'},
                {'module': 'check_ip'},
                {'module': 'network_speed_test'}
            ],
            'policy': {'stop_on_failure': True}
        },
        'device_health_check': {
            'id': 'device_health_check',
            'name': 'Device Health Check',
            'description': 'Comprehensive device hardware and system validation',
            'steps': [
                {'module': 'battery_info'},
                {'module': 'device_info'},
                {'module': 'storage_info'},
                {'module': 'memory_test'},
                {'module': 'sensor_test'}
            ],
            'policy': {'stop_on_failure': False}
        },
        'connectivity_test': {
            'id': 'connectivity_test',
            'name': 'Connectivity Test Suite',
            'description': 'Test all device connectivity features and toggles',
            'steps': [
                {'module': 'wifi_toggle'},
                {'module': 'bluetooth_toggle'},
                {'module': 'mobile_data_toggle'},
                {'module': 'airplane_mode_toggle'},
                {'module': 'location_toggle'}
            ],
            'policy': {'stop_on_failure': False}
        }
    }
    
    # Load from current directory YAML files
    yaml_files = ['flux_exemples.yaml', 'specs/flow.daily_smoke.yaml']
    
    for yaml_file in yaml_files:
        if os.path.exists(yaml_file):
            try:
                with open(yaml_file, 'r', encoding='utf-8') as f:
                    content = yaml.safe_load(f)
                    if isinstance(content, dict):
                        # Handle multiple flows in one file
                        for key, value in content.items():
                            if isinstance(value, dict) and 'id' in value:
                                flows[value['id']] = value
                            elif isinstance(value, dict) and key not in ['version', 'metadata']:
                                # Single flow file
                                value['id'] = key
                                flows[key] = value
                    elif isinstance(content, list):
                        # Handle list of flows
                        for flow in content:
                            if isinstance(flow, dict) and 'id' in flow:
                                flows[flow['id']] = flow
            except Exception as e:
                print(f"Error loading {yaml_file}: {e}")
    
    return flows

@app.get("/api/v1/flows")
async def get_flows():
    """Get all available flows."""
    flows = load_all_flows()
    return [{
        'id': flow['id'],
        'name': flow.get('name', flow['id']),
        'description': flow.get('description', ''),
        'steps_count': len(flow.get('steps', [])),
        'policy': flow.get('policy', {})
    } for flow in flows.values()]

@app.get("/api/v1/flows/{flow_id}")
async def get_flow(flow_id: str):
    """Get a specific flow."""
    flows = load_all_flows()
    if flow_id not in flows:
        return JSONResponse(
            status_code=404,
            content={"error": f"Flow {flow_id} not found"}
        )
    return flows[flow_id]

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "Telco ADB Automation"}

if __name__ == "__main__":
    import uvicorn
    from src.backend.init_db import init_database

    if "--init-db" in sys.argv:
        _import_all_models()
        ensure_directories()
        init_database()
        print("Runtime database initialized successfully.")
        raise SystemExit(0)

    host = os.environ.get("TELCO_SIMPLE_HOST", "0.0.0.0")
    port = int(os.environ.get("TELCO_SIMPLE_PORT", "8007"))

    print("Starting Telco ADB Automation")
    print(f"Interface: http://{host if host not in {'0.0.0.0', '::'} else 'localhost'}:{port}")
    print(f"API Documentation: http://{host if host not in {'0.0.0.0', '::'} else 'localhost'}:{port}/docs")

    try:
        uvicorn.run(app, host=host, port=port)
    except OSError as exc:
        winerror = getattr(exc, "winerror", None)
        if winerror == 10048 or exc.errno in {48, 98}:
            print(
                f"[error] Port {port} is already in use. Stop the existing backend or set TELCO_SIMPLE_PORT "
                "to a free port before relaunching."
            )
            raise SystemExit(1) from exc
        raise
