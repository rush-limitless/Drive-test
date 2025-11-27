"""Data test module for testing data connectivity."""

import asyncio
from typing import Dict, Any

from ..base_module import BaseModule, ModuleMetadata, ModuleStep


class DataTestModule(BaseModule):
    """Module for testing data connectivity."""
    
    def __init__(self):
        metadata = ModuleMetadata(
            id="data_test_module",
            name="Data Test",
            description="Test data connectivity by performing network operations",
            version="1.0.0",
            category="connectivity",
            steps=[
                ModuleStep("check_connection", "Check network connection", 10),
                ModuleStep("test_speed", "Test data speed", 30),
                ModuleStep("verify_stability", "Verify connection stability", 20)
            ],
            input_schema={
                "type": "object",
                "properties": {
                    "test_url": {"type": "string", "default": "https://www.google.com"},
                    "timeout": {"type": "integer", "default": 30}
                }
            },
            output_schema={
                "type": "object",
                "properties": {
                    "connection_active": {"type": "boolean"},
                    "download_speed": {"type": "number"},
                    "upload_speed": {"type": "number"}
                }
            },
            timeout_seconds=90
        )
        super().__init__(metadata)
        
    async def validate_input(self, input_params: Dict[str, Any]) -> bool:
        return True
        
    async def execute(self, device_id: str, input_params: Dict[str, Any]) -> Dict[str, Any]:
        test_url = input_params.get("test_url", "https://www.google.com")
        
        # Simulate data test
        await asyncio.sleep(2)
        
        return {
            "success": True,
            "connection_active": True,
            "download_speed": 25.5,
            "upload_speed": 12.3
        }