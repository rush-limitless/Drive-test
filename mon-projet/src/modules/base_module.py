"""Base module interface for Telco automation modules."""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import json
import logging

logger = logging.getLogger(__name__)


@dataclass
class ModuleStep:
    """Individual step within a module."""
    name: str
    description: str
    timeout_seconds: int = 30


@dataclass
class ModuleMetadata:
    """Module metadata and configuration."""
    id: str
    name: str
    description: str
    version: str
    category: str
    steps: List[ModuleStep]
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]
    timeout_seconds: int = 300
    requires_root: bool = False
    device_compatibility: Dict[str, Any] = None


class BaseModule(ABC):
    """Abstract base class for all Telco automation modules."""
    
    def __init__(self, metadata: ModuleMetadata):
        self.metadata = metadata
        self.logger = logging.getLogger(f"module.{metadata.id}")
        
    @abstractmethod
    async def execute(self, device_id: str, input_params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the module on specified device with given parameters.
        
        Args:
            device_id: ADB device identifier
            input_params: Module-specific input parameters
            
        Returns:
            Dictionary containing execution results and artifacts
        """
        pass
        
    @abstractmethod
    async def validate_input(self, input_params: Dict[str, Any]) -> bool:
        """Validate input parameters against module schema.
        
        Args:
            input_params: Parameters to validate
            
        Returns:
            True if valid, False otherwise
        """
        pass
        
    async def cleanup(self, device_id: str) -> None:
        """Cleanup any resources or temporary files on device.
        
        Args:
            device_id: ADB device identifier
        """
        pass
        
    def get_step_count(self) -> int:
        """Get total number of steps in this module."""
        return len(self.metadata.steps)
        
    def get_step_description(self, step_index: int) -> str:
        """Get description for specific step."""
        if 0 <= step_index < len(self.metadata.steps):
            return self.metadata.steps[step_index].description
        return f"Step {step_index + 1}"
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert module metadata to dictionary."""
        return {
            "id": self.metadata.id,
            "name": self.metadata.name,
            "description": self.metadata.description,
            "version": self.metadata.version,
            "category": self.metadata.category,
            "steps": [
                {
                    "name": step.name,
                    "description": step.description,
                    "timeout_seconds": step.timeout_seconds
                }
                for step in self.metadata.steps
            ],
            "input_schema": self.metadata.input_schema,
            "output_schema": self.metadata.output_schema,
            "timeout_seconds": self.metadata.timeout_seconds,
            "requires_root": self.metadata.requires_root,
            "device_compatibility": self.metadata.device_compatibility or {}
        }


class ModuleExecutionContext:
    """Context for module execution with progress tracking."""
    
    def __init__(self, module: BaseModule, device_id: str, execution_id: str):
        self.module = module
        self.device_id = device_id
        self.execution_id = execution_id
        self.current_step = 0
        self.step_results: List[Dict[str, Any]] = []
        self.start_time = None
        self.end_time = None
        
    async def execute_step(self, step_index: int, step_function, *args, **kwargs) -> Dict[str, Any]:
        """Execute a single step with progress tracking."""
        from datetime import datetime
        
        step_start = datetime.utcnow()
        self.current_step = step_index
        
        try:
            result = await step_function(*args, **kwargs)
            step_end = datetime.utcnow()
            
            step_result = {
                "step_index": step_index,
                "step_name": self.module.get_step_description(step_index),
                "status": "completed",
                "start_time": step_start.isoformat(),
                "end_time": step_end.isoformat(),
                "duration_seconds": (step_end - step_start).total_seconds(),
                "result": result
            }
            
            self.step_results.append(step_result)
            return step_result
            
        except Exception as e:
            step_end = datetime.utcnow()
            
            step_result = {
                "step_index": step_index,
                "step_name": self.module.get_step_description(step_index),
                "status": "failed",
                "start_time": step_start.isoformat(),
                "end_time": step_end.isoformat(),
                "duration_seconds": (step_end - step_start).total_seconds(),
                "error": str(e)
            }
            
            self.step_results.append(step_result)
            raise
            
    def get_progress_percentage(self) -> int:
        """Calculate current progress percentage."""
        total_steps = self.module.get_step_count()
        if total_steps == 0:
            return 100
        return int((self.current_step / total_steps) * 100)