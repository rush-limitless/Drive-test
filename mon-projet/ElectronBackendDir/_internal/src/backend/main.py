"""FastAPI application factory and main entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional
import uvicorn
import os
import logging
import re
from core.adb_path import ADB_EXECUTABLE

try:
    from pymongo.errors import PyMongoError
except ImportError:
    PyMongoError = Exception

from core.config import settings, ensure_directories
try:
    from core.database import db_manager, engine
except ImportError:
    db_manager = None
    engine = None
from core.logging import setup_logging
from models.base import Base
from api.devices import router as devices_router
from api.modules import router as modules_router
from api.flows import router as flows_router
from api.executions import router as executions_router
from api.websocket_router import router as websocket_router
from api.dashboard import router as dashboard_router
from api.reports import router as reports_router
from api.workflows import router as workflows_router, start_workflow_scheduler, stop_workflow_scheduler
from api.health import router as health_router
from services.device_manager import device_manager

logger = logging.getLogger(__name__)

NETWORK_TYPE_CODE_MAP = {
    0: None,   # NETWORK_TYPE_UNKNOWN
    1: "GPRS",
    2: "EDGE",
    3: "UMTS",
    4: "CDMA",
    5: "EVDO_0",
    6: "EVDO_A",
    7: "1XRTT",
    8: "HSDPA",
    9: "HSUPA",
    10: "HSPA",
    11: "IDEN",
    12: "EVDO_B",
    13: "LTE",
    14: "EHRPD",
    15: "HSPAP",
    16: "GSM",
    17: "TD_SCDMA",
    18: "IWLAN",
    19: "LTE_CA",
    20: "NR",
    21: "NR",
    22: "NR",
}

NETWORK_TYPE_PATTERNS = [
    re.compile(r"mDataNetworkType\s*=\s*(\d+)", re.IGNORECASE),
    re.compile(r"mVoiceNetworkType\s*=\s*(\d+)", re.IGNORECASE),
    re.compile(r"mNetworkType\s*=\s*(\d+)", re.IGNORECASE),
]


def _network_label_from_code(code: int) -> Optional[str]:
    """Return a human-readable radio technology for a TelephonyManager network type code."""
    label = NETWORK_TYPE_CODE_MAP.get(code)
    if not label:
        return None
    # Collapse LTE_CA into LTE so the UI can group it as 4G+
    if label == "LTE_CA":
        return "LTE-CA"
    return label


def _parse_network_type_from_dumpsys(dump: str) -> Optional[str]:
    """Extract the current radio technology from `dumpsys telephony.registry` output."""
    if not dump:
        return None
    for pattern in NETWORK_TYPE_PATTERNS:
        match = pattern.search(dump)
        if match:
            try:
                code = int(match.group(1))
            except ValueError:
                continue
            label = _network_label_from_code(code)
            if label:
                return label
    return None


def _import_all_models() -> None:
    """Ensure all SQLAlchemy models are imported before metadata creation."""
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
    ]

    for module_path in model_modules:
        importlib.import_module(module_path)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    setup_logging()
    ensure_directories()
    _import_all_models()
    if engine:
        Base.metadata.create_all(bind=engine)
    if db_manager:
        try:
            db_manager.create_collections()
        except (PyMongoError, NameError, AttributeError) as exc:
            logger.warning("Skipping MongoDB collection setup: %s", exc)
    await device_manager.start_monitoring()
    start_workflow_scheduler()
    yield
    # Shutdown
    stop_workflow_scheduler()
    await device_manager.stop_monitoring()


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    app = FastAPI(
        title="Telco ADB Automation API",
        description="REST API for Telco ADB Automation Desktop Framework",
        version="1.0.0",
        lifespan=lifespan
    )
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include API routers
    app.include_router(devices_router, prefix="/api/v1")
    app.include_router(modules_router, prefix="/api/v1")
    app.include_router(flows_router, prefix="/api/v1")
    app.include_router(executions_router, prefix="/api/v1")
    app.include_router(websocket_router, prefix="/api/v1")
    app.include_router(dashboard_router, prefix="/api/v1")
    app.include_router(reports_router, prefix="/api/v1")
    app.include_router(workflows_router, prefix="/api/v1")
    app.include_router(health_router, prefix="/api/v1")
    
    # Legacy endpoints for compatibility
    app.include_router(devices_router, prefix="/api")
    app.include_router(modules_router, prefix="/api")
    app.include_router(flows_router, prefix="/api")
    app.include_router(executions_router, prefix="/api")
    app.include_router(dashboard_router, prefix="/api")
    app.include_router(workflows_router, prefix="/api")
    
    # Serve static files
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    if os.path.exists(static_dir):
        app.mount("/static", StaticFiles(directory=static_dir), name="static")
    
    return app


app = create_app()


@app.get("/")
async def root():
    """Serve the web UI."""
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "Telco ADB Automation API is running"}


@app.get("/health")
async def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "service": "telco-adb-automation-api"
    }


@app.get("/api/devices")
async def get_devices_simple():
    """Simple devices endpoint for UI compatibility."""
    try:
        import subprocess

        result = subprocess.run([ADB_EXECUTABLE, 'devices'], capture_output=True, text=True)
        devices = []
        for line in result.stdout.split('\n')[1:]:
            if line.strip() and '\t' in line:
                device_id, adb_status = line.strip().split('\t')
                
                # Get device model if possible
                model = "Unknown"
                try:
                    model_result = subprocess.run([ADB_EXECUTABLE, '-s', device_id, 'shell', 'getprop', 'ro.product.model'], 
                                                capture_output=True, text=True, timeout=5)
                    if model_result.returncode == 0 and model_result.stdout.strip():
                        model = model_result.stdout.strip()
                except:
                    pass
                
                devices.append({
                    "id": device_id,
                    "model": model,
                    "android_version": "Unknown",
                    "connection_type": "USB",
                    "status": "online" if adb_status == "device" else adb_status,
                    "adb_status": adb_status,
                    "last_seen": "now",
                    "battery_level": "Unknown",
                    "network_operator": "Not detected"
                })
        return devices
    except Exception as e:
        logger.error(f"Error getting devices: {e}")
        return []


@app.get("/api/devices/stats")
async def get_device_stats_simple():
    """Simple device stats endpoint."""
    try:
        import subprocess
        adb_result = subprocess.run([ADB_EXECUTABLE, 'devices'], capture_output=True, text=True)
        adb_devices = []
        for line in adb_result.stdout.split('\n')[1:]:
            if line.strip() and '\t' in line:
                device_id, status = line.strip().split('\t')
                adb_devices.append({"id": device_id, "status": status})
        
        # Count devices by status
        device_status = [d["status"] for d in adb_devices]
        ready_devices = len([s for s in device_status if s == "device"])
        unauthorized = len([s for s in device_status if s == "unauthorized"])
        offline = len([s for s in device_status if s == "offline"])
        total_connected = len(adb_devices)
        
        return {
            "ready_devices": ready_devices,
            "total_connected": total_connected,
            "devices_needing_setup": unauthorized + offline,
            "unauthorized_devices": unauthorized,
            "offline_devices": offline,
            "device_details": adb_devices
        }
    except Exception as e:
        logger.error(f"Error getting device stats: {e}")
        return {
            "ready_devices": 0,
            "total_connected": 0,
            "devices_needing_setup": 0,
            "error": str(e)
        }


@app.get("/api/v1/devices")
@app.get("/api/v1/devices/")
async def get_devices_v1():
    """V1 devices endpoint for frontend compatibility."""
    try:
        import subprocess

        def adb_shell(device_id: str, *args: str, timeout: int = 5) -> str:
            """Execute an adb shell command and return stdout."""
            try:
                completed = subprocess.run(
                    [ADB_EXECUTABLE, '-s', device_id, 'shell', *args],
                    capture_output=True,
                    text=True,
                    timeout=timeout
                )
                if completed.returncode == 0:
                    return completed.stdout.strip()
            except Exception:
                pass
            return ""

        def normalize_network_prop(value: Optional[str]) -> Optional[str]:
            if not value:
                return None
            primary = value.split(',')[0].strip().upper()
            if not primary or primary in {'UNKNOWN', 'N/A', 'NONE'}:
                return None
            return primary

        def resolve_network_from_dumpsys(device_id: str) -> Optional[str]:
            dump = adb_shell(device_id, 'dumpsys', 'telephony.registry')
            return _parse_network_type_from_dumpsys(dump)

        result = subprocess.run([ADB_EXECUTABLE, 'devices'], capture_output=True, text=True)
        devices = []

        for line in result.stdout.split('\n')[1:]:
            if not line.strip() or '\t' not in line:
                continue

            device_id, adb_status = line.strip().split('\t')
            is_online = adb_status == 'device'

            model = "Unknown"
            android_version = "Unknown"
            connection_type = "USB"
            battery_level = "Unknown"
            network_operator = "Not detected"
            network_technology = None
            developer_mode_enabled = None
            usb_debugging_enabled = None

            if is_online:
                model = adb_shell(device_id, 'getprop', 'ro.product.model') or model
                android_version = adb_shell(device_id, 'getprop', 'ro.build.version.release') or android_version
                # Battery level
                battery_dump = adb_shell(device_id, 'dumpsys', 'battery')
                if battery_dump:
                    for dump_line in battery_dump.splitlines():
                        if 'level:' in dump_line:
                            battery_level = dump_line.split(':', 1)[1].strip()
                            if not battery_level.endswith('%'):
                                battery_level = f"{battery_level}%"
                            break

                # Connection type
                route_info = adb_shell(device_id, 'ip', 'route') or ""
                if 'wlan0' in route_info or 'wlan' in route_info.lower():
                    connection_type = 'WiFi'

                # Network operator and technology
                operator_props = [
                    ('gsm.operator.alpha',),
                    ('gsm.sim.operator.alpha',),
                    ('gsm.operator.alpha.1',),
                    ('gsm.operator.alpha.2',),
                ]
                for prop_args in operator_props:
                    value = adb_shell(device_id, 'getprop', *prop_args)
                    if value:
                        network_operator = value
                        break

                network_type_raw = adb_shell(device_id, 'getprop', 'gsm.network.type')
                network_technology = normalize_network_prop(network_type_raw)
                if not network_technology:
                    network_technology = resolve_network_from_dumpsys(device_id)

                # Developer mode / USB debugging flags
                developer_raw = adb_shell(device_id, 'settings', 'get', 'global', 'development_settings_enabled')
                if developer_raw == "":
                    developer_raw = adb_shell(device_id, 'settings', 'get', 'secure', 'development_settings_enabled')
                if developer_raw:
                    developer_mode_enabled = developer_raw.strip() in {'1', 'true', 'enabled', 'on'}

                usb_raw = adb_shell(device_id, 'settings', 'get', 'global', 'adb_enabled')
                if usb_raw == "":
                    usb_raw = adb_shell(device_id, 'settings', 'get', 'secure', 'adb_enabled')
                if usb_raw:
                    usb_debugging_enabled = usb_raw.strip() in {'1', 'true', 'enabled', 'on'}

            devices.append({
                "id": device_id,
                "model": model,
                "android_version": android_version,
                "connection_type": connection_type,
                "status": "online" if is_online else adb_status,
                "adb_status": adb_status,
                "last_seen": datetime.now(timezone.utc).isoformat(),
                "battery_level": battery_level,
                "network_operator": network_operator,
                "network_technology": network_technology,
                "developer_mode_enabled": developer_mode_enabled,
                "usb_debugging_enabled": usb_debugging_enabled,
                "requires_setup": not (
                    (developer_mode_enabled is None or developer_mode_enabled)
                    and (usb_debugging_enabled is None or usb_debugging_enabled)
                    and is_online
                ),
            })

        return devices
    except Exception as e:
        logger.error(f"Error getting devices: {e}")
        return []


@app.post("/api/v1/devices/{device_id}/setup")
async def configure_device(device_id: str):
    """Attempt to enable developer options and USB debugging on the target device."""
    import subprocess

    setup_commands = [
        [ADB_EXECUTABLE, '-s', device_id, 'shell', 'settings', 'put', 'global', 'development_settings_enabled', '1'],
        [ADB_EXECUTABLE, '-s', device_id, 'shell', 'settings', 'put', 'global', 'adb_enabled', '1'],
        [ADB_EXECUTABLE, '-s', device_id, 'shell', 'setprop', 'persist.service.adb.enable', '1'],
        [ADB_EXECUTABLE, '-s', device_id, 'shell', 'setprop', 'persist.sys.usb.config', 'mtp,adb'],
        [ADB_EXECUTABLE, '-s', device_id, 'shell', 'svc', 'usb', 'setFunctions', 'mtp,adb'],
    ]

    steps = []
    for command in setup_commands:
        try:
            completed = subprocess.run(command, capture_output=True, text=True, timeout=8)
            steps.append({
                "command": " ".join(command[3:]),
                "return_code": completed.returncode,
                "stdout": completed.stdout.strip(),
                "stderr": completed.stderr.strip(),
                "success": completed.returncode == 0,
            })
            if completed.returncode not in (0,):
                return {
                    "success": False,
                    "message": f"Failed while executing {' '.join(command[3:])}",
                    "steps": steps,
                }
        except subprocess.TimeoutExpired:
            steps.append({
                "command": " ".join(command[3:]),
                "success": False,
                "error": "Command timed out",
            })
            return {
                "success": False,
                "message": "Timed out while configuring device. Ensure the device is connected and unlocked.",
                "steps": steps,
            }
        except Exception as exc:
            steps.append({
                "command": " ".join(command[3:]),
                "success": False,
                "error": str(exc),
            })
            return {
                "success": False,
                "message": f"Unexpected error while configuring device: {exc}",
                "steps": steps,
            }

    return {
        "success": True,
        "message": "Developer options and USB debugging commands dispatched successfully.",
        "steps": steps,
    }


@app.get("/api/v1/modules")
async def get_modules_simple():
    """Simple modules endpoint."""
    return [
        {"id": "voice_call_test", "name": "Voice Call Test", "description": "Test voice call functionality", "editable": True},
        {"id": "airplane_mode_toggle", "name": "Airplane Mode Toggle", "description": "Toggle airplane mode", "editable": False}
    ]


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
