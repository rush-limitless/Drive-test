"""Task queue service for managing execution tasks."""

import asyncio
import json
from typing import Dict, Any, Optional
from datetime import datetime
import logging

from core.redis import redis_manager
from core.config import settings

logger = logging.getLogger(__name__)


class TaskQueue:
    """Redis-based task queue for execution management."""
    
    def __init__(self):
        self.queue_name = "execution_tasks"
        self.processing_tasks: Dict[str, asyncio.Task] = {}
        
    async def enqueue_execution(self, execution_id: str, flow_data: Dict[str, Any]) -> bool:
        """Enqueue execution task."""
        try:
            task_data = {
                "type": "execution",
                "execution_id": execution_id,
                "flow_data": flow_data,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "priority": 1
            }
            
            await redis_manager.enqueue_task(self.queue_name, task_data)
            logger.info(f"Enqueued execution task: {execution_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to enqueue execution {execution_id}: {e}")
            return False
            
    async def dequeue_task(self, timeout: int = 0) -> Optional[Dict[str, Any]]:
        """Dequeue next task from queue."""
        try:
            task_data = await redis_manager.dequeue_task(self.queue_name, timeout)
            if task_data:
                logger.info(f"Dequeued task: {task_data.get('execution_id')}")
            return task_data
            
        except Exception as e:
            logger.error(f"Failed to dequeue task: {e}")
            return None
            
    async def get_queue_size(self) -> int:
        """Get current queue size."""
        try:
            if not redis_manager.redis_client:
                return 0
            return await redis_manager.redis_client.llen(self.queue_name)
        except Exception as e:
            logger.error(f"Failed to get queue size: {e}")
            return 0
            
    async def clear_queue(self) -> bool:
        """Clear all tasks from queue."""
        try:
            if not redis_manager.redis_client:
                return False
            await redis_manager.redis_client.delete(self.queue_name)
            logger.info("Task queue cleared")
            return True
        except Exception as e:
            logger.error(f"Failed to clear queue: {e}")
            return False


# Global task queue instance
task_queue = TaskQueue()
