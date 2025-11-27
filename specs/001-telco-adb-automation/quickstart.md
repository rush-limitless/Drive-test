# Quickstart Guide: Telco ADB Automation Desktop Framework

**Date**: 2025-01-27
**Feature**: 001-telco-adb-automation

## Development Environment Setup

### Prerequisites
- **Python 3.11+** with pip and virtual environment support
- **Node.js 18+** with npm or yarn
- **Android SDK** with ADB tools in PATH
- **Git** for version control
- **Redis** (for server mode) or Docker for containerized Redis

### Required Android Permissions
- USB Debugging enabled on target devices
- Developer Options unlocked
- ADB authorization granted for development machine

## Project Structure Overview

```text
telco-adb-automation/
├── src/
│   ├── electron/           # Electron main process
│   ├── frontend/           # React UI application  
│   ├── backend/            # FastAPI server
│   └── modules/            # Telco automation modules
├── tests/                  # Test suites
├── build/                  # Build artifacts
├── docs/                   # Documentation
└── scripts/                # Development scripts
```

## Quick Start (Development Mode)

### 1. Clone and Setup
```bash
git clone <repository-url>
cd telco-adb-automation
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
npm install
```

### 2. Start Backend Services
```bash
# Terminal 1: Start Redis (if using server mode)
redis-server

# Terminal 2: Start FastAPI backend
cd src/backend
uvicorn main:app --reload --port 8000

# Terminal 3: Start React development server
cd src/frontend  
npm start
```

### 3. Start Electron Application
```bash
# Terminal 4: Start Electron
npm run electron:dev
```

### 4. Connect Test Devices
1. Connect Android devices via USB
2. Verify ADB connection: `adb devices`
3. Launch application - devices should appear in Device Manager

## Core Workflows

### Creating Your First Flow

1. **Open Flow Builder**
   - Click "New Flow" in main dashboard
   - Enter flow name and description

2. **Add Modules**
   - Browse module catalog in left panel
   - Drag modules to flow canvas
   - Configure module parameters

3. **Set Execution Order**
   - Arrange modules in desired sequence
   - Configure retry and failure handling options

4. **Save Flow**
   - Click "Save Flow" 
   - Choose visibility (private/shared/public)

### Executing a Flow

1. **Select Target Devices**
   - Choose connected devices from Device Manager
   - Verify device status is "connected"

2. **Start Execution**
   - Click "Execute Flow"
   - Monitor progress in Execution Dashboard

3. **Monitor Progress**
   - View real-time logs and screenshots
   - Enable live device preview if needed
   - Track completion percentage

4. **Review Results**
   - Generate execution report
   - Export in PDF/CSV/HTML format
   - Analyze failed steps and errors

## Module Development

### Creating a Custom Module

1. **Module Structure**
```python
# src/modules/my_custom_module/module.py
from modules.base_module import BaseModule

class MyCustomModule(BaseModule):
    def __init__(self):
        super().__init__(
            id="my_custom_module",
            name="My Custom Module",
            description="Custom automation for specific test case",
            version="1.0.0",
            timeout_seconds=60
        )
    
    def execute(self, device_id: str, input_params: dict) -> dict:
        # Your automation logic here
        result = self.run_adb_command(device_id, "shell input tap 500 800")
        screenshot = self.capture_screenshot(device_id)
        
        return {
            "success": True,
            "output": result,
            "screenshot_path": screenshot
        }
```

2. **Register Module**
```python
# src/modules/__init__.py
from .my_custom_module.module import MyCustomModule

AVAILABLE_MODULES = [
    MyCustomModule(),
    # ... other modules
]
```

3. **Test Module**
```bash
python -m pytest tests/unit/modules/test_my_custom_module.py
```

## Configuration

### Environment Variables
```bash
# .env file
DATABASE_URL=sqlite:///./telco_automation.db  # or postgresql://...
REDIS_URL=redis://localhost:6379
ADB_PATH=/usr/local/bin/adb
SCRCPY_PATH=/usr/local/bin/scrcpy
LOG_LEVEL=INFO
MAX_CONCURRENT_DEVICES=20
```

### Application Settings
```json
// src/backend/config/settings.json
{
  "execution": {
    "default_timeout_seconds": 300,
    "max_retry_attempts": 3,
    "screenshot_quality": "medium"
  },
  "preview": {
    "default_fps": 15,
    "max_concurrent_streams": 5
  },
  "storage": {
    "artifact_retention_days": 30,
    "max_artifact_size_mb": 100
  }
}
```

## Testing

### Unit Tests
```bash
# Backend tests
cd src/backend
python -m pytest tests/unit/ -v

# Frontend tests  
cd src/frontend
npm test

# Module tests
python -m pytest tests/unit/modules/ -v
```

### Integration Tests
```bash
# Start test environment
docker-compose -f docker-compose.test.yml up -d

# Run integration tests with emulators
python -m pytest tests/integration/ -v

# Cleanup
docker-compose -f docker-compose.test.yml down
```

### End-to-End Tests
```bash
# Start full application stack
npm run start:all

# Run E2E tests
npm run test:e2e

# Generate test report
npm run test:report
```

## Deployment

### Standalone Desktop Build
```bash
# Build for current platform
npm run build:desktop

# Build for all platforms
npm run build:desktop:all

# Installers created in build/installers/
```

### Server Deployment
```bash
# Build backend container
docker build -t telco-adb-backend src/backend/

# Deploy with docker-compose
docker-compose -f docker-compose.prod.yml up -d

# Deploy frontend to CDN/static hosting
npm run build:frontend
```

## Troubleshooting

### Common Issues

**ADB Connection Problems**
```bash
# Check ADB status
adb devices

# Restart ADB server
adb kill-server && adb start-server

# Check USB debugging
adb shell settings get global adb_enabled
```

**Module Execution Failures**
- Check module timeout settings
- Verify device permissions
- Review execution logs in dashboard
- Test module independently

**Performance Issues**
- Reduce concurrent device count
- Lower screenshot capture frequency
- Disable live preview for unused devices
- Check system resource usage

### Debug Mode
```bash
# Enable debug logging
export LOG_LEVEL=DEBUG

# Start with debug flags
npm run electron:dev -- --debug

# View detailed logs
tail -f logs/telco-automation.log
```

## Next Steps

1. **Explore Sample Flows**: Check `examples/` directory for pre-built flows
2. **Module Development**: Create custom modules for your test scenarios  
3. **Integration**: Connect with existing test frameworks and CI/CD pipelines
4. **Scaling**: Deploy in server mode for team collaboration
5. **Monitoring**: Set up alerts and metrics for production usage

For detailed documentation, see the full specification files in this directory.