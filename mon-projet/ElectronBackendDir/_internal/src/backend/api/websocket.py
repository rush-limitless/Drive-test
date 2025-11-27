"""WebSocket connection manager for real-time updates."""

from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List, Set
import json
import logging
import asyncio
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections for real-time updates."""
    
    def __init__(self):
        # Active connections by execution ID
        self.execution_connections: Dict[str, List[WebSocket]] = {}
        # Device subscriptions by connection
        self.device_subscriptions: Dict[WebSocket, Set[str]] = {}
        # All active connections
        self.active_connections: List[WebSocket] = []
        
    async def connect(self, websocket: WebSocket, execution_id: str = None):
        """Accept new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        self.device_subscriptions[websocket] = set()
        
        if execution_id:
            if execution_id not in self.execution_connections:
                self.execution_connections[execution_id] = []
            self.execution_connections[execution_id].append(websocket)
            
        logger.info(f"WebSocket connected for execution: {execution_id}")
        
    def disconnect(self, websocket: WebSocket):
        """Remove WebSocket connection."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            
        # Remove from device subscriptions
        if websocket in self.device_subscriptions:
            del self.device_subscriptions[websocket]
            
        # Remove from execution connections
        for execution_id, connections in self.execution_connections.items():
            if websocket in connections:
                connections.remove(websocket)
                if not connections:
                    del self.execution_connections[execution_id]
                break
                
        logger.info("WebSocket disconnected")
        
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send message to specific WebSocket connection."""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Failed to send personal message: {e}")
            
    async def broadcast_to_execution(self, execution_id: str, message: dict):
        """Broadcast message to all connections for an execution."""
        if execution_id in self.execution_connections:
            connections = self.execution_connections[execution_id].copy()
            for connection in connections:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Failed to broadcast to execution {execution_id}: {e}")
                    self.disconnect(connection)
                    
    async def broadcast_device_update(self, device_id: str, message: dict):
        """Broadcast device update to subscribed connections."""
        for websocket, subscribed_devices in self.device_subscriptions.items():
            if device_id in subscribed_devices:
                try:
                    await websocket.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Failed to broadcast device update: {e}")
                    self.disconnect(websocket)
                    
    def subscribe_to_device(self, websocket: WebSocket, device_id: str):
        """Subscribe connection to device updates."""
        if websocket in self.device_subscriptions:
            self.device_subscriptions[websocket].add(device_id)
            logger.info(f"WebSocket subscribed to device: {device_id}")
            
    def unsubscribe_from_device(self, websocket: WebSocket, device_id: str):
        """Unsubscribe connection from device updates."""
        if websocket in self.device_subscriptions:
            self.device_subscriptions[websocket].discard(device_id)
            logger.info(f"WebSocket unsubscribed from device: {device_id}")
            
    async def send_execution_progress(self, execution_id: str, progress_data: dict):
        """Send execution progress update."""
        message = {
            "type": "execution_progress",
            "execution_id": execution_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **progress_data
        }
        await self.broadcast_to_execution(execution_id, message)
        
    async def send_step_completed(self, execution_id: str, step_data: dict):
        """Send step completion notification."""
        message = {
            "type": "step_completed",
            "execution_id": execution_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **step_data
        }
        await self.broadcast_to_execution(execution_id, message)
        
    async def send_device_status(self, device_id: str, status_data: dict):
        """Send device status update."""
        message = {
            "type": "device_status",
            "device_id": device_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **status_data
        }
        await self.broadcast_device_update(device_id, message)


# Global connection manager instance
connection_manager = ConnectionManager()
