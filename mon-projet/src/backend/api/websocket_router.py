"""WebSocket router for real-time communication."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
import logging

from api.websocket import connection_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["websocket"])


@router.websocket("/executions/{execution_id}")
async def websocket_execution(websocket: WebSocket, execution_id: str):
    """WebSocket endpoint for execution updates."""
    await connection_manager.connect(websocket, execution_id)
    
    try:
        while True:
            # Receive messages from client
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                await handle_client_message(websocket, message)
            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON received: {data}")
            except Exception as e:
                logger.error(f"Error handling client message: {e}")
                
    except WebSocketDisconnect:
        connection_manager.disconnect(websocket)
        logger.info(f"WebSocket disconnected for execution: {execution_id}")


@router.websocket("/devices")
async def websocket_devices(websocket: WebSocket):
    """WebSocket endpoint for device updates."""
    await connection_manager.connect(websocket)
    
    try:
        while True:
            # Receive messages from client
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                await handle_client_message(websocket, message)
            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON received: {data}")
            except Exception as e:
                logger.error(f"Error handling client message: {e}")
                
    except WebSocketDisconnect:
        connection_manager.disconnect(websocket)
        logger.info("WebSocket disconnected for devices")


async def handle_client_message(websocket: WebSocket, message: dict):
    """Handle incoming client messages."""
    message_type = message.get("type")
    
    if message_type == "subscribe_device":
        device_id = message.get("device_id")
        if device_id:
            connection_manager.subscribe_to_device(websocket, device_id)
            
    elif message_type == "unsubscribe_device":
        device_id = message.get("device_id")
        if device_id:
            connection_manager.unsubscribe_from_device(websocket, device_id)
            
    elif message_type == "start_preview":
        device_id = message.get("device_id")
        quality = message.get("quality", "medium")
        if device_id:
            # TODO: Start live preview
            logger.info(f"Start preview requested for device {device_id} with quality {quality}")
            
    elif message_type == "stop_preview":
        device_id = message.get("device_id")
        if device_id:
            # TODO: Stop live preview
            logger.info(f"Stop preview requested for device {device_id}")
            
    else:
        logger.warning(f"Unknown message type: {message_type}")
