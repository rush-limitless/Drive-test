"""Call test module for testing voice call functionality."""

import asyncio
from typing import Dict, Any

from ..base_module import BaseModule, ModuleMetadata, ModuleStep


class CallTestModule(BaseModule):
    """Module for testing voice call functionality."""
    
    def __init__(self):
        metadata = ModuleMetadata(
            id="call_test_module",
            name="Call Test",
            description="Test voice call functionality by dialing a number and monitoring call status",
            version="1.0.0",
            category="telephony",
            steps=[
                ModuleStep("dial_number", "Dial the specified phone number", 30),
                ModuleStep("wait_connection", "Wait for call to connect", 15),
                ModuleStep("monitor_call", "Monitor call status and quality", 60),
                ModuleStep("end_call", "End the call", 10)
            ],
            input_schema={
                "type": "object",
                "properties": {
                    "phone_number": {
                        "type": "string",
                        "description": "Phone number to dial"
                    },
                    "call_duration": {
                        "type": "integer",
                        "description": "Call duration in seconds",
                        "default": 30
                    }
                },
                "required": ["phone_number"]
            },
            output_schema={
                "type": "object",
                "properties": {
                    "call_successful": {"type": "boolean"},
                    "call_duration": {"type": "number"},
                    "call_quality": {"type": "string"}
                }
            },
            timeout_seconds=120
        )
        super().__init__(metadata)
        
    async def validate_input(self, input_params: Dict[str, Any]) -> bool:
        return "phone_number" in input_params
        
    async def execute(self, device_id: str, input_params: Dict[str, Any]) -> Dict[str, Any]:
        phone_number = input_params["phone_number"]
        call_duration = input_params.get("call_duration", 30)
        
        # Simulate call test
        await asyncio.sleep(2)
        
        return {
            "success": True,
            "call_successful": True,
            "call_duration": call_duration,
            "call_quality": "good"
        }