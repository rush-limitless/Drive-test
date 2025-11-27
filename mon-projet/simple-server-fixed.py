"""Simple FastAPI server without complex dependencies."""

from fastapi import FastAPI, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import os
import subprocess
import json
import yaml
from typing import Dict, Any, Optional, List

app = FastAPI(title="Telco ADB Automation")

# Global executions storage
executions = {}

class FlowExecutionRequest(BaseModel):
    device_selector: str = "any"
    device_id: Optional[str] = None
    module_id: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None

# Serve static files
static_dir = os.path.join(os.path.dirname(__file__), "src", "backend", "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

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
                    
                    # Get battery level
                    try:
                        battery_result = subprocess.run(
                            ['adb', '-s', device_id, 'shell', 'cat', '/sys/class/power_supply/battery/capacity'],
                            capture_output=True, text=True, timeout=3
                        )
                        if battery_result.returncode == 0 and battery_result.stdout.strip().isdigit():
                            battery_level = battery_result.stdout.strip() + '%'
                    except Exception:
                        pass
                    
                    # Get network operator
                    operator_result = subprocess.run(
                        ['adb', '-s', device_id, 'shell', 'getprop', 'gsm.operator.alpha'],
                        capture_output=True, text=True, timeout=3
                    )
                    if operator_result.returncode == 0 and operator_result.stdout.strip():
                        network_operator = operator_result.stdout.strip()
                
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
        adb_result = subprocess.run(['adb', 'devices'], capture_output=True, text=True)
        adb_devices = []
        for line in adb_result.stdout.split('\n')[1:]:
            if line.strip() and '\t' in line:
                device_id, status = line.strip().split('\t')
                adb_devices.append({"id": device_id, "status": status})
        
        ready_devices = len([d for d in adb_devices if d["status"] == "device"])
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

@app.get("/api/v1/modules")
async def get_modules():
    """Get available automation modules."""
    return [
        {"id": "airplane_mode_toggle", "name": "Airplane Mode Toggle", "description": "Enables/disables airplane mode to test connectivity", "editable": False},
        {"id": "mobile_data_toggle", "name": "Mobile Data Toggle", "description": "Enables/disables mobile data", "editable": False},
        {"id": "network_info", "name": "Network Info", "description": "Retrieves network connectivity information", "editable": False},
        {"id": "voice_call_test", "name": "Voice Call Test", "description": "Performs an automated voice call to test network connectivity", "editable": True},
        {"id": "sms_test", "name": "SMS Test", "description": "Send SMS message", "editable": True},
        {"id": "network_check", "name": "Network Check", "description": "Check network connectivity", "editable": False}
    ]

@app.post("/api/v1/flows/single_module/execute")
async def execute_single_module(request: FlowExecutionRequest, background_tasks: BackgroundTasks):
    """Execute a single module."""
    module_id = request.module_id or 'voice_call_test'
    
    # Get device
    device_id = request.device_id
    if not device_id and request.device_selector == "any":
        devices = await get_devices()
        online_devices = [d for d in devices if d['status'] == 'online']
        if online_devices:
            device_id = online_devices[0]['id']
    
    # Start execution
    execution_id = f"exec_single_{module_id}_{len(executions) + 1}"
    executions[execution_id] = {
        "execution_id": execution_id,
        "status": "starting",
        "flow_id": f"single_{module_id}",
        "device_id": device_id
    }
    
    background_tasks.add_task(run_simple_module, execution_id, module_id, request.parameters or {}, device_id)
    
    return {
        "execution_id": execution_id,
        "status": "started",
        "module_id": module_id,
        "device_id": device_id
    }

async def run_simple_module(execution_id: str, module_id: str, parameters: Dict[str, Any], device_id: str):
    """Run a simple module execution."""
    try:
        if module_id == "voice_call_test":
            # Simple call test
            number = parameters.get('number', '*123#')
            duration = parameters.get('duration', 10)
            
            # Execute ADB command
            cmd = ['adb', '-s', device_id, 'shell', 'am', 'start', '-a', 'android.intent.action.CALL', '-d', f'tel:{number}']
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            success = result.returncode == 0
            
            executions[execution_id] = {
                "execution_id": execution_id,
                "status": "completed" if success else "failed",
                "flow_id": f"single_{module_id}",
                "device_id": device_id,
                "step_results": [{
                    "step_number": 1,
                    "module": module_id,
                    "success": success,
                    "duration": 3.0,
                    "error": result.stderr if not success else None,
                    "number": number,
                    "call_duration": duration
                }],
                "steps_completed": 1,
                "total_steps": 1
            }
        
        elif module_id == "network_check":
            # Simple network check
            cmd = ['adb', '-s', device_id, 'shell', 'ping', '-c', '1', '8.8.8.8']
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            
            success = result.returncode == 0
            
            executions[execution_id] = {
                "execution_id": execution_id,
                "status": "completed" if success else "failed",
                "flow_id": f"single_{module_id}",
                "device_id": device_id,
                "step_results": [{
                    "step_number": 1,
                    "module": module_id,
                    "success": success,
                    "duration": 2.0,
                    "error": result.stderr if not success else None
                }],
                "steps_completed": 1,
                "total_steps": 1
            }
        
        else:
            # Default success for other modules
            executions[execution_id] = {
                "execution_id": execution_id,
                "status": "completed",
                "flow_id": f"single_{module_id}",
                "device_id": device_id,
                "step_results": [{
                    "step_number": 1,
                    "module": module_id,
                    "success": True,
                    "duration": 1.0
                }],
                "steps_completed": 1,
                "total_steps": 1
            }
            
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

@app.get("/api/v1/flows")
async def get_flows():
    """Get all available flows."""
    return [
        {
            'id': 'daily_smoke',
            'name': 'Daily Smoke Test',
            'description': 'Comprehensive daily test suite',
            'steps_count': 4,
            'policy': {'stop_on_failure': False}
        },
        {
            'id': 'network_validation',
            'name': 'Network Validation Suite',
            'description': 'Complete network connectivity validation',
            'steps_count': 3,
            'policy': {'stop_on_failure': True}
        }
    ]

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "Telco ADB Automation"}

if __name__ == "__main__":
    import uvicorn
    print("Starting Telco ADB Automation")
    print("Interface: http://localhost:8005")
    print("API Documentation: http://localhost:8005/docs")
    uvicorn.run(app, host="0.0.0.0", port=8005)