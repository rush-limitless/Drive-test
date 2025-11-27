# API Reference Documentation

## Overview

The ADB Framework Telco Automation API is built with FastAPI, providing a comprehensive REST API for device management, test execution, and system integration. The API follows OpenAPI 3.0 specifications and includes automatic interactive documentation.

## Base Information

- **Base URL**: `http://localhost:8000/api/v1`
- **API Version**: 1.0.0
- **Documentation**: Available at `/docs` (Swagger UI) and `/redoc` (ReDoc)
- **OpenAPI Spec**: Available at `/openapi.json`

## Authentication

### JWT Token Authentication
```http
Authorization: Bearer <jwt_token>
```

### API Key Authentication
```http
X-API-Key: <api_key>
```

## Core Endpoints

### 1. Device Management

#### List All Devices
```http
GET /api/v1/devices
```

**Response:**
```json
[
  {
    "id": "device_001",
    "name": "Samsung Galaxy S21",
    "model": "SM-G991B",
    "manufacturer": "Samsung",
    "android_version": "11",
    "api_level": 30,
    "status": "connected",
    "ip_address": "192.168.1.100",
    "connection_type": "wifi",
    "last_seen": "2025-01-15T10:30:00Z",
    "is_active": true,
    "capabilities": {
      "has_camera": true,
      "has_gps": true,
      "has_nfc": true,
      "has_bluetooth": true,
      "has_wifi": true,
      "has_cellular": true,
      "screen_resolution": "2400x1080",
      "ram_size": 8192,
      "storage_size": 256000
    },
    "metadata": {
      "serial_number": "R58M123456",
      "imei": "123456789012345",
      "phone_number": "+1234567890",
      "carrier": "Verizon",
      "network_type": "LTE",
      "battery_level": 85,
      "temperature": 32.5,
      "cpu_usage": 15.2,
      "memory_usage": 4096
    },
    "created_at": "2025-01-15T09:00:00Z",
    "updated_at": "2025-01-15T10:30:00Z"
  }
]
```

#### Get Device by ID
```http
GET /api/v1/devices/{device_id}
```

**Parameters:**
- `device_id` (string, required): Unique device identifier

**Response:**
```json
{
  "id": "device_001",
  "name": "Samsung Galaxy S21",
  "status": "connected",
  // ... full device object
}
```

#### Create New Device
```http
POST /api/v1/devices
```

**Request Body:**
```json
{
  "id": "device_002",
  "name": "iPhone 13 Pro",
  "model": "A2483",
  "connection_type": "usb",
  "ip_address": "192.168.1.101"
}
```

**Response:**
```json
{
  "id": "device_002",
  "name": "iPhone 13 Pro",
  "status": "disconnected",
  "created_at": "2025-01-15T11:00:00Z"
}
```

#### Update Device
```http
PATCH /api/v1/devices/{device_id}
```

**Request Body:**
```json
{
  "name": "Updated Device Name",
  "status": "connected",
  "metadata": {
    "battery_level": 90
  }
}
```

#### Delete Device
```http
DELETE /api/v1/devices/{device_id}
```

**Response:**
```json
{
  "message": "Device deleted successfully"
}
```

#### Connect Device
```http
POST /api/v1/devices/{device_id}/connect
```

**Response:**
```json
{
  "id": "device_001",
  "status": "connected",
  "connected_at": "2025-01-15T11:15:00Z"
}
```

#### Disconnect Device
```http
POST /api/v1/devices/{device_id}/disconnect
```

#### Get Device Status
```http
GET /api/v1/devices/{device_id}/status
```

**Response:**
```json
{
  "device_id": "device_001",
  "connection_status": "connected",
  "battery_level": 85,
  "network_status": {
    "type": "LTE",
    "strength": -75,
    "operator": "Verizon"
  },
  "memory_usage": {
    "total": 8192,
    "used": 4096,
    "available": 4096
  },
  "cpu_usage": 15.2,
  "storage_usage": {
    "total": 256000,
    "used": 128000,
    "available": 128000
  },
  "last_updated": "2025-01-15T11:20:00Z"
}
```

#### Execute Command on Device
```http
POST /api/v1/devices/{device_id}/execute
```

**Request Body:**
```json
{
  "command": ["shell", "getprop", "ro.build.version.release"],
  "timeout": 30
}
```

**Response:**
```json
{
  "success": true,
  "stdout": "11\n",
  "stderr": "",
  "return_code": 0,
  "execution_time": 0.245
}
```

#### Discover Devices
```http
POST /api/v1/devices/discover
```

**Response:**
```json
[
  {
    "id": "new_device_001",
    "name": "Discovered Device",
    "connection_type": "usb",
    "status": "available"
  }
]
```

### 2. Test Execution Management

#### List Executions
```http
GET /api/v1/executions
```

**Query Parameters:**
- `status` (string, optional): Filter by execution status
- `flow_id` (string, optional): Filter by flow ID
- `device_id` (string, optional): Filter by device ID
- `limit` (integer, optional): Number of results to return (default: 50)
- `offset` (integer, optional): Number of results to skip (default: 0)

**Response:**
```json
{
  "executions": [
    {
      "id": "exec_001",
      "flow_id": "flow_network_test",
      "name": "Network Connectivity Test",
      "description": "Comprehensive network testing suite",
      "status": "completed",
      "start_time": "2025-01-15T10:00:00Z",
      "end_time": "2025-01-15T10:15:00Z",
      "duration": 900.0,
      "success_rate": 95.5,
      "total_steps": 20,
      "completed_steps": 19,
      "failed_steps": 1,
      "devices": [
        {
          "device_id": "device_001",
          "status": "completed",
          "success_rate": 100.0
        }
      ],
      "configuration": {
        "timeout": 300,
        "retry_count": 3,
        "parallel_execution": true
      }
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

#### Get Execution by ID
```http
GET /api/v1/executions/{execution_id}
```

**Response:**
```json
{
  "id": "exec_001",
  "flow_id": "flow_network_test",
  "status": "completed",
  "steps": [
    {
      "id": "step_001",
      "device_id": "device_001",
      "module_name": "network_check",
      "status": "completed",
      "start_time": "2025-01-15T10:00:00Z",
      "end_time": "2025-01-15T10:02:00Z",
      "duration": 120.0,
      "result": {
        "success": true,
        "data": {
          "registration": {
            "registered": true,
            "operator": "Verizon",
            "network_type": "LTE"
          },
          "signal": {
            "strength": -75,
            "quality": "good"
          },
          "connectivity": {
            "connected": true,
            "packet_loss": 0,
            "latency": 25.5
          }
        }
      }
    }
  ]
}
```

#### Start New Execution
```http
POST /api/v1/executions
```

**Request Body:**
```json
{
  "flow_id": "flow_network_test",
  "name": "Custom Network Test",
  "description": "Testing network connectivity",
  "device_ids": ["device_001", "device_002"],
  "configuration": {
    "timeout": 300,
    "retry_count": 3,
    "parallel_execution": true,
    "custom_parameters": {
      "test_duration": 600,
      "ping_count": 10
    }
  }
}
```

**Response:**
```json
{
  "id": "exec_002",
  "status": "running",
  "start_time": "2025-01-15T11:30:00Z",
  "estimated_duration": 900
}
```

#### Stop Execution
```http
POST /api/v1/executions/{execution_id}/stop
```

**Response:**
```json
{
  "id": "exec_002",
  "status": "stopped",
  "stop_time": "2025-01-15T11:35:00Z"
}
```

#### Get Execution Logs
```http
GET /api/v1/executions/{execution_id}/logs
```

**Query Parameters:**
- `level` (string, optional): Log level filter (debug, info, warning, error)
- `device_id` (string, optional): Filter logs by device
- `limit` (integer, optional): Number of log entries to return

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2025-01-15T10:00:05Z",
      "level": "info",
      "device_id": "device_001",
      "module": "network_check",
      "message": "Starting network registration check",
      "details": {
        "step_id": "step_001",
        "execution_id": "exec_001"
      }
    }
  ]
}
```

### 3. Flow Management

#### List Flows
```http
GET /api/v1/flows
```

**Response:**
```json
[
  {
    "id": "flow_network_test",
    "name": "Network Connectivity Test",
    "description": "Comprehensive network testing workflow",
    "version": "1.0.0",
    "category": "network",
    "tags": ["network", "connectivity", "basic"],
    "estimated_duration": 900,
    "modules": [
      {
        "id": "module_001",
        "name": "network_check",
        "order": 1,
        "configuration": {
          "timeout": 60,
          "retry_count": 3
        }
      }
    ],
    "created_at": "2025-01-15T09:00:00Z",
    "updated_at": "2025-01-15T09:00:00Z"
  }
]
```

#### Get Flow by ID
```http
GET /api/v1/flows/{flow_id}
```

#### Create New Flow
```http
POST /api/v1/flows
```

**Request Body:**
```json
{
  "name": "Custom Test Flow",
  "description": "Custom testing workflow",
  "category": "custom",
  "modules": [
    {
      "name": "network_check",
      "order": 1,
      "configuration": {
        "timeout": 60
      }
    },
    {
      "name": "signal_check",
      "order": 2,
      "configuration": {
        "min_strength": -90
      }
    }
  ]
}
```

#### Update Flow
```http
PUT /api/v1/flows/{flow_id}
```

#### Delete Flow
```http
DELETE /api/v1/flows/{flow_id}
```

### 4. Module Management

#### List Available Modules
```http
GET /api/v1/modules
```

**Response:**
```json
[
  {
    "name": "network_check",
    "display_name": "Network Registration Check",
    "description": "Verify cellular network registration status",
    "category": "network",
    "version": "1.0.0",
    "parameters": [
      {
        "name": "timeout",
        "type": "integer",
        "default": 60,
        "description": "Command timeout in seconds"
      }
    ],
    "outputs": [
      {
        "name": "registration_status",
        "type": "boolean",
        "description": "Network registration status"
      },
      {
        "name": "operator",
        "type": "string",
        "description": "Network operator name"
      }
    ]
  }
]
```

#### Get Module Details
```http
GET /api/v1/modules/{module_name}
```

#### Execute Single Module
```http
POST /api/v1/modules/{module_name}/execute
```

**Request Body:**
```json
{
  "device_id": "device_001",
  "configuration": {
    "timeout": 60,
    "retry_count": 3
  }
}
```

**Response:**
```json
{
  "module": "network_check",
  "device_id": "device_001",
  "timestamp": "2025-01-15T11:45:00Z",
  "success": true,
  "execution_time": 45.2,
  "data": {
    "registration": {
      "registered": true,
      "operator": "Verizon",
      "network_type": "LTE"
    }
  }
}
```

### 5. Report Management

#### List Reports
```http
GET /api/v1/reports
```

**Query Parameters:**
- `execution_id` (string, optional): Filter by execution ID
- `format` (string, optional): Filter by report format
- `start_date` (string, optional): Filter by creation date (ISO 8601)
- `end_date` (string, optional): Filter by creation date (ISO 8601)

**Response:**
```json
[
  {
    "id": "report_001",
    "execution_id": "exec_001",
    "name": "Network Test Report",
    "format": "pdf",
    "status": "completed",
    "file_path": "/reports/report_001.pdf",
    "file_size": 2048576,
    "created_at": "2025-01-15T10:20:00Z",
    "metadata": {
      "page_count": 15,
      "chart_count": 8,
      "device_count": 2
    }
  }
]
```

#### Generate Report
```http
POST /api/v1/reports
```

**Request Body:**
```json
{
  "execution_id": "exec_001",
  "format": "pdf",
  "template": "executive_summary",
  "options": {
    "include_charts": true,
    "include_logs": false,
    "include_screenshots": true
  }
}
```

#### Download Report
```http
GET /api/v1/reports/{report_id}/download
```

**Response:** Binary file download

#### Delete Report
```http
DELETE /api/v1/reports/{report_id}
```

### 6. Dashboard and Analytics

#### Get Dashboard Overview
```http
GET /api/v1/dashboard/overview
```

**Response:**
```json
{
  "summary": {
    "total_devices": 25,
    "connected_devices": 18,
    "active_executions": 3,
    "completed_executions_today": 12,
    "success_rate_today": 94.5
  },
  "device_status": {
    "connected": 18,
    "disconnected": 5,
    "error": 2
  },
  "execution_stats": {
    "running": 3,
    "completed": 45,
    "failed": 2,
    "stopped": 1
  },
  "recent_activity": [
    {
      "timestamp": "2025-01-15T11:50:00Z",
      "type": "execution_completed",
      "description": "Network test completed successfully",
      "execution_id": "exec_003"
    }
  ]
}
```

#### Get Performance Metrics
```http
GET /api/v1/dashboard/metrics
```

**Query Parameters:**
- `period` (string): Time period (1h, 24h, 7d, 30d)
- `metric_type` (string): Metric type (execution_time, success_rate, device_count)

**Response:**
```json
{
  "period": "24h",
  "metrics": [
    {
      "timestamp": "2025-01-15T10:00:00Z",
      "execution_count": 5,
      "success_rate": 95.0,
      "avg_execution_time": 450.5,
      "active_devices": 20
    }
  ]
}
```

## WebSocket API

### Connection
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/client_id');
```

### Event Types

#### Device Status Updates
```json
{
  "type": "device_status",
  "data": {
    "device_id": "device_001",
    "status": "connected",
    "battery_level": 85,
    "timestamp": "2025-01-15T12:00:00Z"
  }
}
```

#### Execution Progress
```json
{
  "type": "execution_progress",
  "data": {
    "execution_id": "exec_001",
    "progress": 75.5,
    "current_step": "signal_check",
    "completed_steps": 15,
    "total_steps": 20
  }
}
```

#### System Notifications
```json
{
  "type": "system_notification",
  "data": {
    "level": "info",
    "message": "New device discovered",
    "details": {
      "device_id": "device_003"
    }
  }
}
```

## Error Handling

### Standard Error Response
```json
{
  "error": {
    "code": "DEVICE_NOT_FOUND",
    "message": "Device with ID 'device_001' not found",
    "details": {
      "device_id": "device_001",
      "timestamp": "2025-01-15T12:05:00Z"
    }
  }
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Validation Error
- `500` - Internal Server Error

### Common Error Codes
- `DEVICE_NOT_FOUND` - Device does not exist
- `DEVICE_DISCONNECTED` - Device is not connected
- `EXECUTION_NOT_FOUND` - Execution does not exist
- `FLOW_NOT_FOUND` - Flow does not exist
- `MODULE_NOT_FOUND` - Module does not exist
- `VALIDATION_ERROR` - Request validation failed
- `AUTHENTICATION_FAILED` - Authentication failed
- `PERMISSION_DENIED` - Insufficient permissions

## Rate Limiting

### Default Limits
- **General API**: 1000 requests per hour per IP
- **Device Commands**: 100 requests per minute per device
- **Execution Start**: 10 requests per minute per user
- **Report Generation**: 5 requests per minute per user

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642248000
```

## SDK and Client Libraries

### Python SDK
```python
from adb_framework_client import ADBFrameworkClient

client = ADBFrameworkClient(
    base_url="http://localhost:8000",
    api_key="your_api_key"
)

# List devices
devices = client.devices.list()

# Start execution
execution = client.executions.start(
    flow_id="flow_network_test",
    device_ids=["device_001"]
)
```

### JavaScript SDK
```javascript
import { ADBFrameworkClient } from 'adb-framework-client';

const client = new ADBFrameworkClient({
  baseURL: 'http://localhost:8000',
  apiKey: 'your_api_key'
});

// List devices
const devices = await client.devices.list();

// Start execution
const execution = await client.executions.start({
  flowId: 'flow_network_test',
  deviceIds: ['device_001']
});
```

---

**Next**: [Deployment Guide](../deployment/README.md) | **Previous**: [Frontend Guide](../frontend/README.md)