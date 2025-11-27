"""SMS test module for testing SMS functionality."""

import asyncio
from typing import Dict, Any

from ..base_module import BaseModule, ModuleMetadata, ModuleStep


class SMSTestModule(BaseModule):
    """Module for testing SMS functionality."""
    
    def __init__(self):
        metadata = ModuleMetadata(
            id="sms_test_module",
            name="SMS Test",
            description="Test SMS functionality by sending and receiving messages",
            version="1.0.0",
            category="messaging",
            steps=[
                ModuleStep("compose_sms", "Compose SMS message", 10),
                ModuleStep("send_sms", "Send SMS message", 15),
                ModuleStep("verify_sent", "Verify message was sent", 10)
            ],
            input_schema={
                "type": "object",
                "properties": {
                    "recipient": {"type": "string"},
                    "message": {"type": "string"}
                },
                "required": ["recipient", "message"]
            },
            output_schema={
                "type": "object",
                "properties": {
                    "sms_sent": {"type": "boolean"},
                    "message_id": {"type": "string"}
                }
            },
            timeout_seconds=60
        )
        super().__init__(metadata)
        
    async def validate_input(self, input_params: Dict[str, Any]) -> bool:
        return "recipient" in input_params and "message" in input_params
        
    async def execute(self, device_id: str, input_params: Dict[str, Any]) -> Dict[str, Any]:
        recipient = input_params["recipient"]
        message = input_params["message"]
        
        # Simulate SMS test
        await asyncio.sleep(1)
        
        return {
            "success": True,
            "sms_sent": True,
            "message_id": f"msg_{device_id}_{int(asyncio.get_event_loop().time())}"
        }