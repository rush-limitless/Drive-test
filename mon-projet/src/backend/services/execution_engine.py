"""Execution engine for running flows on devices."""

import asyncio
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import logging
import os

from core.database import get_db
from core.config import settings
from models.execution import Execution, ExecutionStatus
from models.execution_device import ExecutionDevice, ExecutionDeviceStatus
from models.execution_step import ExecutionStep, StepStatus
from models.flow import Flow
from services.device_manager import device_manager
from services.adb_manager import adb_manager
from services.module_loader import module_loader
from api.websocket import connection_manager
from core.logging import get_execution_logger

logger = logging.getLogger(__name__)


class ExecutionEngine:
    """Engine for executing flows on devices."""
    
    def __init__(self):
        self.active_executions: Dict[str, asyncio.Task] = {}
        
    async def start_execution(self, execution_id: str) -> bool:
        """Start flow execution."""
        if execution_id in self.active_executions:
            logger.warning(f"Execution {execution_id} is already running")
            return False
            
        # Create execution task
        task = asyncio.create_task(self._execute_flow(execution_id))
        self.active_executions[execution_id] = task
        
        return True
        
    async def cancel_execution(self, execution_id: str) -> bool:
        """Cancel running execution."""
        if execution_id not in self.active_executions:
            return False
            
        task = self.active_executions[execution_id]
        task.cancel()
        
        try:
            await task
        except asyncio.CancelledError:
            pass
            
        del self.active_executions[execution_id]
        
        # Update execution status in database
        db = next(get_db())
        try:
            execution = db.query(Execution).filter(Execution.id == execution_id).first()
            if execution:
                execution.cancel_execution()
                db.commit()
        finally:
            db.close()
            
        return True
        
    async def _execute_flow(self, execution_id: str):
        """Execute flow on assigned devices."""
        exec_logger = get_execution_logger(execution_id)
        db = next(get_db())
        
        try:
            # Load execution details
            execution = db.query(Execution).filter(Execution.id == execution_id).first()
            if not execution:
                raise ValueError(f"Execution {execution_id} not found")
                
            flow = execution.flow
            if not flow:
                raise ValueError(f"Flow not found for execution {execution_id}")
                
            exec_logger.info(f"Starting execution of flow '{flow.name}' with {len(execution.devices)} devices")
            
            # Start execution
            execution.start_execution()
            db.commit()
            
            # Notify via WebSocket
            await connection_manager.send_execution_progress(
                execution_id,
                {
                    "progress_percentage": 0,
                    "current_step": "Starting execution",
                    "status": "running"
                }
            )
            
            # Execute on each device in parallel
            device_tasks = []
            for exec_device in execution.devices:
                task = asyncio.create_task(
                    self._execute_on_device(execution_id, exec_device.id, exec_logger)
                )
                device_tasks.append(task)
                
            # Wait for all devices to complete
            results = await asyncio.gather(*device_tasks, return_exceptions=True)
            
            # Check results and update execution status
            failed_devices = sum(1 for result in results if isinstance(result, Exception))
            total_devices = len(device_tasks)
            
            if failed_devices == 0:
                execution.complete_execution()
                exec_logger.info("Execution completed successfully on all devices")
            elif failed_devices < total_devices:
                execution.complete_execution()
                exec_logger.warning(f"Execution completed with {failed_devices} device failures")
            else:
                execution.fail_execution("Execution failed on all devices")
                exec_logger.error("Execution failed on all devices")
                
            db.commit()
            
            # Final progress update
            await connection_manager.send_execution_progress(
                execution_id,
                {
                    "progress_percentage": 100,
                    "current_step": "Execution completed",
                    "status": execution.status.value
                }
            )
            
        except asyncio.CancelledError:
            exec_logger.info("Execution cancelled")
            execution.cancel_execution()
            db.commit()
            raise
        except Exception as e:
            exec_logger.error(f"Execution failed: {e}")
            execution.fail_execution(str(e))
            db.commit()
            raise
        finally:
            db.close()
            if execution_id in self.active_executions:
                del self.active_executions[execution_id]
                
    async def _execute_on_device(self, execution_id: str, execution_device_id: str, exec_logger):
        """Execute flow on single device."""
        db = next(get_db())
        
        try:
            # Load execution device
            exec_device = db.query(ExecutionDevice).filter(
                ExecutionDevice.id == execution_device_id
            ).first()
            
            if not exec_device:
                raise ValueError(f"ExecutionDevice {execution_device_id} not found")
                
            device_logger = get_execution_logger(execution_id, exec_device.device_id)
            device_logger.info(f"Starting execution on device {exec_device.device_id}")
            
            # Mark device as busy
            await device_manager.set_device_busy(exec_device.device_id)
            
            # Start device execution
            exec_device.start_execution()
            db.commit()
            
            # Get flow modules in order
            flow = exec_device.execution.flow
            ordered_modules = flow.get_ordered_modules()
            
            # Execute each module step by step
            for i, flow_module in enumerate(ordered_modules):
                try:
                    await self._execute_module_step(
                        execution_id, execution_device_id, flow_module, i, device_logger, db
                    )
                except Exception as e:
                    if not flow_module.continue_on_failure:
                        raise
                    device_logger.warning(f"Module {flow_module.module_id} failed but continuing: {e}")
                    
            # Complete device execution
            exec_device.complete_execution()
            device_logger.info("Device execution completed successfully")
            
        except Exception as e:
            device_logger.error(f"Device execution failed: {e}")
            exec_device.fail_execution(str(e))
            raise
        finally:
            # Mark device as available
            await device_manager.set_device_available(exec_device.device_id)
            db.commit()
            db.close()
            
    async def _execute_module_step(self, execution_id: str, execution_device_id: str, 
                                 flow_module, step_index: int, device_logger, db: Session):
        """Execute single module step."""
        # Create execution step record
        exec_step = ExecutionStep(
            execution_id=execution_id,
            execution_device_id=execution_device_id,
            module_id=flow_module.module_id,
            step_index=step_index,
            input_data=flow_module.input_parameters
        )
        db.add(exec_step)
        db.commit()
        
        try:
            # Load module
            module = await module_loader.get_module(flow_module.module_id)
            if not module:
                raise ValueError(f"Module {flow_module.module_id} not found")
                
            device_logger.step_started(module.metadata.name, step_index)
            
            # Start step
            exec_step.start_step()
            db.commit()
            
            # Notify via WebSocket
            await connection_manager.send_step_completed(
                execution_id,
                {
                    "step_id": str(exec_step.id),
                    "device_id": exec_step.execution_device.device_id,
                    "module_id": flow_module.module_id,
                    "status": "running",
                    "step_index": step_index
                }
            )
            
            # Execute module
            exec_device = db.query(ExecutionDevice).filter(
                ExecutionDevice.id == execution_device_id
            ).first()
            
            result = await module.execute(
                exec_device.device_id,
                flow_module.input_parameters or {}
            )
            
            # Capture screenshot if available
            screenshot_path = None
            if result.get('screenshot_path'):
                screenshot_path = result['screenshot_path']
            else:
                # Capture screenshot after step
                timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
                filename = f"{exec_device.device_id}_{execution_id}_{step_index}_{timestamp}.png"
                screenshot_path = os.path.join(settings.SCREENSHOTS_DIR, filename)
                await adb_manager.capture_screenshot(exec_device.device_id, screenshot_path)
                
            # Complete step
            exec_step.complete_step(
                output_data=result,
                stdout=result.get('stdout', '')
            )
            exec_step.screenshot_path = screenshot_path
            
            duration = (exec_step.end_time - exec_step.start_time).total_seconds()
            device_logger.step_completed(module.metadata.name, step_index, duration)
            
            # Notify completion via WebSocket
            await connection_manager.send_step_completed(
                execution_id,
                {
                    "step_id": str(exec_step.id),
                    "device_id": exec_device.device_id,
                    "module_id": flow_module.module_id,
                    "status": "completed",
                    "step_index": step_index,
                    "duration_seconds": duration,
                    "screenshot_url": f"/api/v1/artifacts/screenshots/{os.path.basename(screenshot_path)}" if screenshot_path else None
                }
            )
            
        except Exception as e:
            # Handle step failure
            exec_step.fail_step(error_code="MODULE_EXECUTION_ERROR", stderr=str(e))
            device_logger.step_failed(flow_module.module_id, step_index, str(e))
            
            # Check if retry is needed
            if exec_step.retry_attempt < flow_module.retry_count:
                device_logger.info(f"Retrying step {step_index}, attempt {exec_step.retry_attempt + 1}")
                exec_step.retry_step()
                db.commit()
                # Recursive retry
                await self._execute_module_step(
                    execution_id, execution_device_id, flow_module, step_index, device_logger, db
                )
            else:
                raise
        finally:
            db.commit()


# Global execution engine instance
execution_engine = ExecutionEngine()
