"""Redis connection manager for task queue and caching."""

import redis.asyncio as redis
from typing import Optional
import json
import logging

from .config import settings

logger = logging.getLogger(__name__)


class RedisManager:
    """Redis connection and operations manager."""
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        
    async def connect(self):
        """Establish Redis connection."""
        try:
            self.redis_client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
            # Test connection
            await self.redis_client.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
            
    async def disconnect(self):
        """Close Redis connection."""
        if self.redis_client:
            await self.redis_client.close()
            logger.info("Redis connection closed")
            
    async def set_json(self, key: str, value: dict, expire: int = None):
        """Store JSON data in Redis."""
        if not self.redis_client:
            raise RuntimeError("Redis not connected")
        
        json_data = json.dumps(value)
        await self.redis_client.set(key, json_data, ex=expire)
        
    async def get_json(self, key: str) -> Optional[dict]:
        """Retrieve JSON data from Redis."""
        if not self.redis_client:
            raise RuntimeError("Redis not connected")
            
        data = await self.redis_client.get(key)
        if data:
            return json.loads(data)
        return None
        
    async def publish(self, channel: str, message: dict):
        """Publish message to Redis channel."""
        if not self.redis_client:
            raise RuntimeError("Redis not connected")
            
        json_message = json.dumps(message)
        await self.redis_client.publish(channel, json_message)
        
    async def enqueue_task(self, queue_name: str, task_data: dict):
        """Add task to Redis queue."""
        if not self.redis_client:
            raise RuntimeError("Redis not connected")
            
        json_task = json.dumps(task_data)
        await self.redis_client.lpush(queue_name, json_task)
        
    async def dequeue_task(self, queue_name: str, timeout: int = 0) -> Optional[dict]:
        """Remove and return task from Redis queue."""
        if not self.redis_client:
            raise RuntimeError("Redis not connected")
            
        result = await self.redis_client.brpop(queue_name, timeout=timeout)
        if result:
            _, task_json = result
            return json.loads(task_json)
        return None


# Global Redis manager instance
redis_manager = RedisManager()