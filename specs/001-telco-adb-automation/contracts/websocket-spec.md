# WebSocket API Specification

## Connection Endpoints

### `/ws/executions/{execution_id}`
Real-time updates for a specific execution.

**Connection Parameters**:
- `execution_id` (UUID): The execution to monitor

**Authentication**: 
- Token-based authentication via query parameter `?token=<auth_token>` (server mode)
- No authentication required (standalone mode)

## Message Types

### Client → Server Messages

#### Subscribe to Device Updates
```json
{
  "type": "subscribe_device",
  "device_id": "emulator-5554"
}
```

#### Unsubscribe from Device Updates
```json
{
  "type": "unsubscribe_device", 
  "device_id": "emulator-5554"
}
```

#### Request Live Preview
```json
{
  "type": "start_preview",
  "device_id": "emulator-5554",
  "quality": "medium"
}
```

#### Stop Live Preview
```json
{
  "type": "stop_preview",
  "device_id": "emulator-5554"
}
```

### Server → Client Messages

#### Execution Progress Update
```json
{
  "type": "execution_progress",
  "execution_id": "550e8400-e29b-41d4-a716-446655440000",
  "progress_percentage": 45,
  "current_step": "sms_test_module",
  "timestamp": "2025-01-27T10:30:00Z"
}
```

#### Device Status Change
```json
{
  "type": "device_status",
  "device_id": "emulator-5554",
  "status": "busy",
  "last_seen": "2025-01-27T10:30:00Z"
}
```

#### Step Completion
```json
{
  "type": "step_completed",
  "execution_id": "550e8400-e29b-41d4-a716-446655440000",
  "device_id": "emulator-5554",
  "step_id": "550e8400-e29b-41d4-a716-446655440001",
  "module_id": "call_test_module",
  "status": "completed",
  "duration_seconds": 12.5,
  "screenshot_url": "/api/v1/artifacts/screenshots/step_001.png",
  "timestamp": "2025-01-27T10:30:15Z"
}
```

#### Step Failed
```json
{
  "type": "step_failed",
  "execution_id": "550e8400-e29b-41d4-a716-446655440000",
  "device_id": "emulator-5554", 
  "step_id": "550e8400-e29b-41d4-a716-446655440002",
  "module_id": "data_test_module",
  "error_code": "ADB_TIMEOUT",
  "error_message": "ADB command timed out after 30 seconds",
  "retry_attempt": 1,
  "will_retry": true,
  "timestamp": "2025-01-27T10:31:00Z"
}
```

#### Live Log Entry
```json
{
  "type": "log_entry",
  "execution_id": "550e8400-e29b-41d4-a716-446655440000",
  "device_id": "emulator-5554",
  "level": "INFO",
  "message": "Executing ADB command: adb shell input tap 500 800",
  "module_id": "ui_interaction_module",
  "timestamp": "2025-01-27T10:30:30Z"
}
```

#### Live Preview Frame
```json
{
  "type": "preview_frame",
  "device_id": "emulator-5554",
  "frame_data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
  "width": 1080,
  "height": 1920,
  "timestamp": "2025-01-27T10:30:30.500Z"
}
```

#### Execution Completed
```json
{
  "type": "execution_completed",
  "execution_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "duration_seconds": 180,
  "total_steps": 15,
  "successful_steps": 14,
  "failed_steps": 1,
  "report_url": "/api/v1/reports/550e8400-e29b-41d4-a716-446655440000?format=pdf",
  "timestamp": "2025-01-27T10:33:00Z"
}
```

#### Error Message
```json
{
  "type": "error",
  "code": "DEVICE_DISCONNECTED",
  "message": "Device emulator-5554 disconnected during execution",
  "execution_id": "550e8400-e29b-41d4-a716-446655440000",
  "device_id": "emulator-5554",
  "timestamp": "2025-01-27T10:32:00Z"
}
```

## Connection Lifecycle

### Connection Established
1. Client connects to WebSocket endpoint
2. Server sends initial execution state (if execution exists)
3. Client can subscribe to specific device updates
4. Server begins sending real-time updates

### During Execution
1. Server sends progress updates every 1-2 seconds
2. Step completion/failure messages sent immediately
3. Log entries streamed in real-time
4. Live preview frames sent at 10-15 FPS (if requested)

### Connection Closed
1. Client unsubscribes from all device updates
2. Live preview streams stopped
3. Connection gracefully terminated

## Error Handling

### Connection Errors
- `INVALID_EXECUTION_ID`: Execution not found
- `UNAUTHORIZED`: Invalid or missing authentication token
- `EXECUTION_NOT_ACTIVE`: Cannot monitor completed/cancelled executions

### Runtime Errors
- `DEVICE_DISCONNECTED`: Device lost during execution
- `MODULE_TIMEOUT`: Module execution exceeded timeout
- `PREVIEW_UNAVAILABLE`: Cannot start live preview for device

## Rate Limiting

### Message Frequency Limits
- Progress updates: Maximum 1 per second per execution
- Log entries: Maximum 100 per second per device
- Preview frames: Maximum 15 FPS per device
- Status updates: No limit (event-driven)

### Connection Limits
- Maximum 10 concurrent WebSocket connections per client
- Maximum 5 live preview streams per connection
- Automatic disconnection after 1 hour of inactivity

## Quality of Service

### Message Delivery
- Progress updates: Best effort delivery
- Step completion: Guaranteed delivery with acknowledgment
- Error messages: Guaranteed delivery with acknowledgment
- Log entries: Best effort delivery (may be dropped under high load)

### Reconnection Handling
- Client should implement exponential backoff for reconnection
- Server maintains execution state for 5 minutes after disconnection
- Missed messages during disconnection are not replayed