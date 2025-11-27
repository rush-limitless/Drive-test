# Backend Architecture Guide

## Overview

The ADB Framework backend is built with FastAPI, providing a robust, scalable, and well-documented REST API. The backend follows clean architecture principles with clear separation of concerns across multiple layers.

## Project Structure

```
src/backend/
├── api/                    # API route handlers
│   ├── __init__.py
│   ├── dashboard.py        # Dashboard endpoints
│   ├── devices.py          # Device management API
│   ├── devices_v2.py       # Enhanced device API
│   ├── executions.py       # Test execution API
│   ├── flows.py            # Workflow management API
│   ├── modules.py          # Test module API
│   ├── reports.py          # Report generation API
│   ├── websocket.py        # WebSocket handlers
│   ├── websocket_router.py # WebSocket routing
│   └── workflows.py        # Workflow execution API
├── core/                   # Core configuration and utilities
│   ├── config.py           # Application configuration
│   ├── database.py         # Database connection and setup
│   ├── logging.py          # Logging configuration
│   └── redis.py            # Redis connection and utilities
├── models/                 # Database models (SQLAlchemy)
│   ├── base.py             # Base model class
│   ├── device.py           # Device model
│   ├── device_log.py       # Device logging model
│   ├── execution.py        # Execution model
│   ├── execution_device.py # Execution-device relationship
│   ├── execution_step.py   # Individual step model
│   ├── flow.py             # Workflow model
│   ├── flow_module.py      # Flow-module relationship
│   ├── report.py           # Report model
│   └── workflow_models.py  # Workflow-related models
├── modules/                # Business logic modules
│   ├── adb_executor.py     # ADB command execution
│   ├── flow_executor.py    # Workflow execution engine
│   └── telco_modules.py    # Telco test modules
├── services/               # Service layer
│   ├── adb_manager.py      # ADB device management
│   ├── device_manager.py   # Device lifecycle management
│   ├── execution_engine.py # Test execution orchestration
│   └── task_queue.py       # Background task management
├── static/                 # Static files (React build)
├── tests/                  # Test suite
├── main.py                 # FastAPI application entry point
├── simple_main.py          # Simplified entry point
└── requirements.txt        # Python dependencies
```

## Core Components

### 1. FastAPI Application (`main.py`)

```python
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await startup_event()
    yield
    # Shutdown
    await shutdown_event()

app = FastAPI(
    title="ADB Framework Telco Automation API",
    description="Comprehensive telecommunications testing platform",
    version="1.0.0",
    lifespan=lifespan
)

# Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files serving
app.mount("/static", StaticFiles(directory="static"), name="static")

# API routes
app.include_router(devices.router, prefix="/api/v1", tags=["devices"])
app.include_router(executions.router, prefix="/api/v1", tags=["executions"])
app.include_router(flows.router, prefix="/api/v1", tags=["flows"])
app.include_router(reports.router, prefix="/api/v1", tags=["reports"])
app.include_router(websocket_router.router, prefix="/ws", tags=["websocket"])
```

### 2. Database Models

#### Device Model (`models/device.py`)
```python
from sqlalchemy import Column, String, DateTime, Boolean, Text, Integer
from sqlalchemy.orm import relationship
from .base import Base

class Device(Base):
    __tablename__ = "devices"
    
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    model = Column(String)
    android_version = Column(String)
    api_level = Column(Integer)
    status = Column(String, default="disconnected")
    ip_address = Column(String)
    connection_type = Column(String, default="usb")
    last_seen = Column(DateTime)
    is_active = Column(Boolean, default=True)
    capabilities = Column(Text)  # JSON string
    metadata = Column(Text)      # JSON string
    
    # Relationships
    executions = relationship("ExecutionDevice", back_populates="device")
    logs = relationship("DeviceLog", back_populates="device")
```

#### Execution Model (`models/execution.py`)
```python
from sqlalchemy import Column, String, DateTime, Text, Integer, Float
from sqlalchemy.orm import relationship
from .base import Base

class Execution(Base):
    __tablename__ = "executions"
    
    id = Column(String, primary_key=True)
    flow_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    status = Column(String, default="pending")
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    duration = Column(Float)
    success_rate = Column(Float)
    total_steps = Column(Integer, default=0)
    completed_steps = Column(Integer, default=0)
    failed_steps = Column(Integer, default=0)
    configuration = Column(Text)  # JSON string
    
    # Relationships
    devices = relationship("ExecutionDevice", back_populates="execution")
    steps = relationship("ExecutionStep", back_populates="execution")
    reports = relationship("Report", back_populates="execution")
```

### 3. Service Layer

#### Device Manager (`services/device_manager.py`)
```python
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from ..models.device import Device
from ..core.database import get_db
from ..services.adb_manager import ADBManager

class DeviceManager:
    def __init__(self):
        self.adb_manager = ADBManager()
    
    async def discover_devices(self) -> List[Dict]:
        """Discover connected ADB devices"""
        devices = await self.adb_manager.list_devices()
        return [self._parse_device_info(device) for device in devices]
    
    async def connect_device(self, device_id: str) -> Device:
        """Connect to a specific device"""
        device_info = await self.adb_manager.get_device_info(device_id)
        
        with get_db() as db:
            device = db.query(Device).filter(Device.id == device_id).first()
            if not device:
                device = Device(
                    id=device_id,
                    name=device_info.get("name", f"Device-{device_id}"),
                    model=device_info.get("model"),
                    android_version=device_info.get("android_version"),
                    api_level=device_info.get("api_level")
                )
                db.add(device)
            
            device.status = "connected"
            device.last_seen = datetime.utcnow()
            db.commit()
            db.refresh(device)
            
        return device
    
    async def disconnect_device(self, device_id: str) -> bool:
        """Disconnect from a device"""
        with get_db() as db:
            device = db.query(Device).filter(Device.id == device_id).first()
            if device:
                device.status = "disconnected"
                db.commit()
                return True
        return False
    
    async def get_device_status(self, device_id: str) -> Dict:
        """Get comprehensive device status"""
        status = await self.adb_manager.get_device_status(device_id)
        return {
            "device_id": device_id,
            "connection_status": status.get("connection"),
            "battery_level": status.get("battery"),
            "network_status": status.get("network"),
            "memory_usage": status.get("memory"),
            "cpu_usage": status.get("cpu"),
            "storage_usage": status.get("storage")
        }
```

#### Execution Engine (`services/execution_engine.py`)
```python
from typing import List, Dict, Optional
from asyncio import create_task, gather
from ..models.execution import Execution
from ..models.execution_step import ExecutionStep
from ..modules.flow_executor import FlowExecutor

class ExecutionEngine:
    def __init__(self):
        self.flow_executor = FlowExecutor()
        self.active_executions: Dict[str, Execution] = {}
    
    async def start_execution(
        self, 
        flow_id: str, 
        device_ids: List[str],
        configuration: Dict = None
    ) -> Execution:
        """Start a new test execution"""
        
        execution = Execution(
            id=generate_uuid(),
            flow_id=flow_id,
            name=f"Execution-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
            status="running",
            start_time=datetime.utcnow(),
            configuration=json.dumps(configuration or {})
        )
        
        # Save to database
        with get_db() as db:
            db.add(execution)
            db.commit()
            db.refresh(execution)
        
        # Track active execution
        self.active_executions[execution.id] = execution
        
        # Start execution in background
        task = create_task(self._execute_flow(execution, device_ids))
        
        return execution
    
    async def _execute_flow(self, execution: Execution, device_ids: List[str]):
        """Execute the flow across multiple devices"""
        try:
            # Load flow definition
            flow = await self._load_flow(execution.flow_id)
            
            # Create execution tasks for each device
            tasks = []
            for device_id in device_ids:
                task = create_task(
                    self._execute_on_device(execution, flow, device_id)
                )
                tasks.append(task)
            
            # Wait for all device executions to complete
            results = await gather(*tasks, return_exceptions=True)
            
            # Process results and update execution status
            await self._finalize_execution(execution, results)
            
        except Exception as e:
            await self._handle_execution_error(execution, e)
        finally:
            # Remove from active executions
            self.active_executions.pop(execution.id, None)
    
    async def _execute_on_device(
        self, 
        execution: Execution, 
        flow: Dict, 
        device_id: str
    ):
        """Execute flow on a specific device"""
        
        device_results = []
        
        for step_config in flow["steps"]:
            step = ExecutionStep(
                id=generate_uuid(),
                execution_id=execution.id,
                device_id=device_id,
                module_name=step_config["module"],
                status="running",
                start_time=datetime.utcnow()
            )
            
            try:
                # Execute the step
                result = await self.flow_executor.execute_step(
                    device_id, 
                    step_config
                )
                
                step.status = "completed" if result["success"] else "failed"
                step.result = json.dumps(result)
                step.end_time = datetime.utcnow()
                
                device_results.append(result)
                
            except Exception as e:
                step.status = "error"
                step.error_message = str(e)
                step.end_time = datetime.utcnow()
                
            finally:
                # Save step to database
                with get_db() as db:
                    db.add(step)
                    db.commit()
        
        return device_results
```

### 4. ADB Integration

#### ADB Manager (`services/adb_manager.py`)
```python
import asyncio
import subprocess
from typing import List, Dict, Optional

class ADBManager:
    def __init__(self):
        self.adb_path = "adb"  # Assumes ADB is in PATH
    
    async def list_devices(self) -> List[str]:
        """List all connected ADB devices"""
        try:
            result = await self._run_command(["devices"])
            lines = result.stdout.strip().split('\n')[1:]  # Skip header
            devices = []
            
            for line in lines:
                if line.strip() and '\t' in line:
                    device_id = line.split('\t')[0]
                    status = line.split('\t')[1]
                    if status == "device":
                        devices.append(device_id)
            
            return devices
        except Exception as e:
            raise Exception(f"Failed to list devices: {str(e)}")
    
    async def get_device_info(self, device_id: str) -> Dict:
        """Get detailed device information"""
        commands = {
            "model": ["shell", "getprop", "ro.product.model"],
            "android_version": ["shell", "getprop", "ro.build.version.release"],
            "api_level": ["shell", "getprop", "ro.build.version.sdk"],
            "manufacturer": ["shell", "getprop", "ro.product.manufacturer"],
            "serial": ["shell", "getprop", "ro.serialno"]
        }
        
        device_info = {"id": device_id}
        
        for key, command in commands.items():
            try:
                result = await self._run_command(["-s", device_id] + command)
                device_info[key] = result.stdout.strip()
            except Exception:
                device_info[key] = "Unknown"
        
        return device_info
    
    async def execute_command(
        self, 
        device_id: str, 
        command: List[str]
    ) -> Dict:
        """Execute ADB command on specific device"""
        try:
            full_command = ["-s", device_id] + command
            result = await self._run_command(full_command)
            
            return {
                "success": True,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "return_code": result.returncode
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "return_code": -1
            }
    
    async def _run_command(self, command: List[str]) -> subprocess.CompletedProcess:
        """Run ADB command asynchronously"""
        full_command = [self.adb_path] + command
        
        process = await asyncio.create_subprocess_exec(
            *full_command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        return subprocess.CompletedProcess(
            args=full_command,
            returncode=process.returncode,
            stdout=stdout.decode('utf-8'),
            stderr=stderr.decode('utf-8')
        )
```

### 5. Telco Test Modules

#### Network Check Module (`modules/telco_modules.py`)
```python
from typing import Dict, Any
from .adb_executor import ADBExecutor

class NetworkCheckModule:
    def __init__(self):
        self.adb = ADBExecutor()
    
    async def execute(self, device_id: str, config: Dict[str, Any]) -> Dict:
        """Execute network connectivity check"""
        
        results = {
            "module": "network_check",
            "device_id": device_id,
            "timestamp": datetime.utcnow().isoformat(),
            "success": False,
            "data": {}
        }
        
        try:
            # Check network registration
            registration = await self._check_network_registration(device_id)
            results["data"]["registration"] = registration
            
            # Check signal strength
            signal = await self._check_signal_strength(device_id)
            results["data"]["signal"] = signal
            
            # Check data connectivity
            connectivity = await self._check_data_connectivity(device_id)
            results["data"]["connectivity"] = connectivity
            
            # Determine overall success
            results["success"] = (
                registration.get("registered", False) and
                signal.get("strength", 0) > -100 and
                connectivity.get("connected", False)
            )
            
        except Exception as e:
            results["error"] = str(e)
        
        return results
    
    async def _check_network_registration(self, device_id: str) -> Dict:
        """Check network registration status"""
        command = ["shell", "dumpsys", "telephony.registry"]
        result = await self.adb.execute_command(device_id, command)
        
        if result["success"]:
            output = result["stdout"]
            # Parse registration status from dumpsys output
            registered = "mServiceState=IN_SERVICE" in output
            operator = self._extract_operator(output)
            network_type = self._extract_network_type(output)
            
            return {
                "registered": registered,
                "operator": operator,
                "network_type": network_type
            }
        
        return {"registered": False, "error": result.get("error")}
    
    async def _check_signal_strength(self, device_id: str) -> Dict:
        """Check signal strength"""
        command = ["shell", "dumpsys", "telephony.registry"]
        result = await self.adb.execute_command(device_id, command)
        
        if result["success"]:
            output = result["stdout"]
            # Parse signal strength from dumpsys output
            strength = self._extract_signal_strength(output)
            
            return {
                "strength": strength,
                "quality": self._categorize_signal_quality(strength)
            }
        
        return {"strength": -999, "error": result.get("error")}
    
    async def _check_data_connectivity(self, device_id: str) -> Dict:
        """Check data connectivity"""
        # Test with ping command
        command = ["shell", "ping", "-c", "3", "8.8.8.8"]
        result = await self.adb.execute_command(device_id, command)
        
        if result["success"]:
            output = result["stdout"]
            # Parse ping results
            packet_loss = self._extract_packet_loss(output)
            avg_latency = self._extract_avg_latency(output)
            
            return {
                "connected": packet_loss < 100,
                "packet_loss": packet_loss,
                "latency": avg_latency
            }
        
        return {"connected": False, "error": result.get("error")}
```

### 6. WebSocket Integration

#### WebSocket Handler (`api/websocket.py`)
```python
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List
import json
import asyncio

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.device_subscribers: Dict[str, List[WebSocket]] = {}
        self.execution_subscribers: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        # Remove from all subscriptions
        for device_id, subscribers in self.device_subscribers.items():
            if websocket in subscribers:
                subscribers.remove(websocket)
        for execution_id, subscribers in self.execution_subscribers.items():
            if websocket in subscribers:
                subscribers.remove(websocket)
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)
    
    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                # Connection closed, remove it
                self.active_connections.remove(connection)
    
    async def send_to_device_subscribers(self, device_id: str, message: Dict):
        if device_id in self.device_subscribers:
            message_str = json.dumps(message)
            for websocket in self.device_subscribers[device_id]:
                try:
                    await websocket.send_text(message_str)
                except:
                    self.device_subscribers[device_id].remove(websocket)
    
    def subscribe_to_device(self, device_id: str, websocket: WebSocket):
        if device_id not in self.device_subscribers:
            self.device_subscribers[device_id] = []
        self.device_subscribers[device_id].append(websocket)
    
    def subscribe_to_execution(self, execution_id: str, websocket: WebSocket):
        if execution_id not in self.execution_subscribers:
            self.execution_subscribers[execution_id] = []
        self.execution_subscribers[execution_id].append(websocket)

manager = ConnectionManager()

@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message["type"] == "subscribe_device":
                manager.subscribe_to_device(message["device_id"], websocket)
            elif message["type"] == "subscribe_execution":
                manager.subscribe_to_execution(message["execution_id"], websocket)
            elif message["type"] == "ping":
                await manager.send_personal_message(
                    json.dumps({"type": "pong"}), 
                    websocket
                )
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
```

## Configuration Management

### Application Configuration (`core/config.py`)
```python
from pydantic import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Application
    app_name: str = "ADB Framework Telco Automation"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # Database
    database_url: str = "sqlite:///./telco_framework.db"
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # Security
    secret_key: str = "your-secret-key-here"
    access_token_expire_minutes: int = 30
    
    # ADB
    adb_path: str = "adb"
    adb_timeout: int = 30
    
    # File Storage
    upload_dir: str = "./uploads"
    report_dir: str = "./reports"
    log_dir: str = "./logs"
    
    # API
    api_v1_prefix: str = "/api/v1"
    cors_origins: list = ["*"]
    
    class Config:
        env_file = ".env"

settings = Settings()
```

## Testing Strategy

### Unit Tests (`tests/test_devices_v2.py`)
```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from ..main import app
from ..core.database import get_db, Base

# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

class TestDevicesAPI:
    def test_get_devices_empty(self):
        response = client.get("/api/v1/devices")
        assert response.status_code == 200
        assert response.json() == []
    
    def test_create_device(self):
        device_data = {
            "id": "test_device_001",
            "name": "Test Device",
            "model": "Test Model",
            "android_version": "11",
            "api_level": 30
        }
        response = client.post("/api/v1/devices", json=device_data)
        assert response.status_code == 201
        assert response.json()["id"] == "test_device_001"
    
    def test_get_device_by_id(self):
        response = client.get("/api/v1/devices/test_device_001")
        assert response.status_code == 200
        assert response.json()["name"] == "Test Device"
    
    def test_update_device_status(self):
        update_data = {"status": "connected"}
        response = client.patch("/api/v1/devices/test_device_001", json=update_data)
        assert response.status_code == 200
        assert response.json()["status"] == "connected"
```

## Performance Considerations

### 1. Database Optimization
- Connection pooling with SQLAlchemy
- Indexed columns for frequent queries
- Lazy loading for relationships
- Query optimization with proper joins

### 2. Caching Strategy
- Redis for session data and temporary results
- In-memory caching for frequently accessed data
- Cache invalidation strategies

### 3. Async Processing
- FastAPI async/await for I/O operations
- Background tasks for long-running operations
- Connection pooling for external services

### 4. Resource Management
- Proper cleanup of ADB connections
- Memory management for large datasets
- File cleanup for temporary files

---

**Next**: [Frontend Guide](../frontend/README.md) | **Previous**: [Architecture Overview](../architecture/README.md)