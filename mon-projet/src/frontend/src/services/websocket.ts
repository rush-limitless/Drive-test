/**
 * WebSocket service for real-time updates (native WebSocket).
 */

// Using browser/Web API WebSocket to match FastAPI native WS endpoints

export interface DeviceStatusUpdate {
  type: 'device_status';
  device_id: string;
  status: string;
  last_seen: string;
  timestamp: string;
}

export interface ExecutionProgressUpdate {
  type: 'execution_progress';
  execution_id: string;
  progress_percentage: number;
  current_step: string;
  timestamp: string;
}

export interface StepCompletedUpdate {
  type: 'step_completed';
  execution_id: string;
  device_id: string;
  step_id: string;
  module_id: string;
  status: string;
  duration_seconds: number;
  screenshot_url?: string;
  timestamp: string;
}

export interface LogEntry {
  type: 'log_entry';
  execution_id: string;
  device_id: string;
  level: string;
  message: string;
  module_id?: string;
  timestamp: string;
}

export type WebSocketMessage = 
  | DeviceStatusUpdate 
  | ExecutionProgressUpdate 
  | StepCompletedUpdate 
  | LogEntry;

class WebSocketService {
  private executionSocket: WebSocket | null = null;
  private devicesSocket: WebSocket | null = null;
  private backendUrl: string = '';
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private connectionListeners: Set<(state: 'connected' | 'disconnected') => void> = new Set();
  private pendingDeviceSubscriptions: Set<string> = new Set();
  private devicesReconnectTimer: number | null = null;
  private executionReconnectTimer: number | null = null;
  private devicesReconnectAttempts = 0;
  private executionReconnectAttempts = 0;
  private shouldReconnectDevices = true;
  private shouldReconnectExecution = true;
  private devicesConnectionRefs = 0;
  private devicesHeartbeatTimer: number | null = null;
  private readonly heartbeatIntervalMs = 15000;

  private toWs(baseHttpUrl: string): string {
    return baseHttpUrl.replace(/^http/, 'ws');
  }

  connectExecution(backendUrl: string, executionId: string): void {
    if (!backendUrl) {
      console.warn('WebSocketService: backendUrl is empty, skipping execution WS connection');
      return;
    }
    this.backendUrl = backendUrl;
    this.shouldReconnectExecution = true;
    const wsUrl = `${this.toWs(backendUrl)}/api/v1/ws/executions/${executionId}`;
    if (this.executionSocket && this.executionSocket.readyState <= 1) return;

    this.executionSocket = new WebSocket(wsUrl);
    this.executionSocket.onopen = () => {
      console.log('WS (execution) connected');
      this.executionReconnectAttempts = 0;
      this.notifyConnection();
    };
    this.executionSocket.onclose = () => {
      console.log('WS (execution) disconnected');
      this.notifyConnection();
      this.scheduleExecutionReconnect(executionId);
    };
    this.executionSocket.onerror = (e) => console.error('WS (execution) error:', e);
    this.executionSocket.onmessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data) as WebSocketMessage;
        this.handleMessage(msg);
      } catch (e) {
        console.error('Invalid WS (execution) message:', ev.data);
      }
    };
  }

  disconnectExecution(): void {
    this.shouldReconnectExecution = false;
    if (this.executionReconnectTimer !== null) {
      window.clearTimeout(this.executionReconnectTimer);
      this.executionReconnectTimer = null;
    }
    if (this.executionSocket) {
      this.executionSocket.close();
      this.executionSocket = null;
    }
    this.notifyConnection();
  }

  connectDevices(backendUrl: string): void {
    if (!backendUrl) {
      console.warn('WebSocketService: backendUrl is empty, skipping device WS connection');
      return;
    }
    this.backendUrl = backendUrl;
    this.shouldReconnectDevices = true;
    const wsUrl = `${this.toWs(backendUrl)}/api/v1/ws/devices`;
    if (this.devicesSocket && this.devicesSocket.readyState <= 1) return;

    this.devicesSocket = new WebSocket(wsUrl);
    this.devicesSocket.onopen = () => {
      console.log('WS (devices) connected');
      this.devicesReconnectAttempts = 0;
      this.notifyConnection();
      this.startDevicesHeartbeat();
      // Flush pending subscriptions when the socket becomes available
      this.pendingDeviceSubscriptions.forEach((deviceId) => {
        this.sendDeviceSubscription('subscribe_device', deviceId);
      });
    };
    this.devicesSocket.onclose = () => {
      console.log('WS (devices) disconnected');
      this.notifyConnection();
      this.stopDevicesHeartbeat();
      this.scheduleDevicesReconnect();
    };
    this.devicesSocket.onerror = (e) => console.error('WS (devices) error:', e);
    this.devicesSocket.onmessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);
        const messages = Array.isArray(data) ? data : [data];
        messages.forEach((msg) => {
          if (msg && typeof msg === 'object' && 'type' in msg) {
            this.handleMessage(msg as WebSocketMessage);
          } else {
            console.warn('WS (devices) ignored message without type:', msg);
          }
        });
      } catch (e) {
        console.error('Invalid WS (devices) message:', ev.data);
      }
    };
  }

  acquireDevicesConnection(backendUrl: string): void {
    this.devicesConnectionRefs += 1;
    this.connectDevices(backendUrl);
  }

  releaseDevicesConnection(): void {
    this.devicesConnectionRefs = Math.max(0, this.devicesConnectionRefs - 1);
    if (this.devicesConnectionRefs === 0) {
      this.disconnectDevices();
    }
  }

  disconnectDevices(): void {
    this.shouldReconnectDevices = false;
    if (this.devicesReconnectTimer !== null) {
      window.clearTimeout(this.devicesReconnectTimer);
      this.devicesReconnectTimer = null;
    }
    this.stopDevicesHeartbeat();
    if (this.devicesSocket) {
      this.devicesSocket.close();
      this.devicesSocket = null;
    }
    this.notifyConnection();
  }

  disconnectAll(): void {
    this.disconnectExecution();
    this.disconnectDevices();
    this.listeners.clear();
  }

  private handleMessage(message: WebSocketMessage): void {
    // Notify type-specific listeners
    const typeListeners = this.listeners.get(message.type);
    if (typeListeners) {
      typeListeners.forEach(callback => callback(message));
    }

    // Notify general listeners
    const generalListeners = this.listeners.get('*');
    if (generalListeners) {
      generalListeners.forEach(callback => callback(message));
    }
  }

  // Subscribe to specific message types
  subscribe(messageType: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, new Set());
    }
    
    this.listeners.get(messageType)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(messageType);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(messageType);
        }
      }
    };
  }

  // Subscribe to device status updates
  subscribeToDeviceUpdates(callback: (update: DeviceStatusUpdate) => void): () => void {
    return this.subscribe('device_status', callback);
  }

  // Subscribe to execution progress
  subscribeToExecutionProgress(callback: (update: ExecutionProgressUpdate) => void): () => void {
    return this.subscribe('execution_progress', callback);
  }

  // Subscribe to step completion
  subscribeToStepCompletion(callback: (update: StepCompletedUpdate) => void): () => void {
    return this.subscribe('step_completed', callback);
  }

  // Subscribe to log entries
  subscribeToLogs(callback: (log: LogEntry) => void): () => void {
    return this.subscribe('log_entry', callback);
  }

  // Subscribe to all messages
  subscribeToAll(callback: (message: WebSocketMessage) => void): () => void {
    return this.subscribe('*', callback);
  }

  // Send messages to server (for device-related commands)
  subscribeToDevice(deviceId: string): void {
    this.pendingDeviceSubscriptions.add(deviceId);
    this.sendDeviceSubscription('subscribe_device', deviceId);
  }

  unsubscribeFromDevice(deviceId: string): void {
    this.pendingDeviceSubscriptions.delete(deviceId);
    this.sendDeviceSubscription('unsubscribe_device', deviceId);
  }

  private sendDeviceSubscription(action: 'subscribe_device' | 'unsubscribe_device', deviceId: string) {
    if (this.devicesSocket && this.devicesSocket.readyState === this.devicesSocket.OPEN) {
      this.devicesSocket.send(JSON.stringify({ type: action, device_id: deviceId }));
    }
  }

  private startDevicesHeartbeat(): void {
    this.stopDevicesHeartbeat();
    this.devicesHeartbeatTimer = window.setInterval(() => {
      if (this.devicesSocket && this.devicesSocket.readyState === this.devicesSocket.OPEN) {
        this.devicesSocket.send(JSON.stringify({ type: 'ping' }));
      }
    }, this.heartbeatIntervalMs);
  }

  private stopDevicesHeartbeat(): void {
    if (this.devicesHeartbeatTimer !== null) {
      window.clearInterval(this.devicesHeartbeatTimer);
      this.devicesHeartbeatTimer = null;
    }
  }

  startLivePreview(deviceId: string, quality: 'low' | 'medium' | 'high' = 'medium'): void {
    if (this.devicesSocket && this.devicesSocket.readyState === this.devicesSocket.OPEN) {
      this.devicesSocket.send(JSON.stringify({ type: 'start_preview', device_id: deviceId, quality }));
    }
  }

  stopLivePreview(deviceId: string): void {
    if (this.devicesSocket && this.devicesSocket.readyState === this.devicesSocket.OPEN) {
      this.devicesSocket.send(JSON.stringify({ type: 'stop_preview', device_id: deviceId }));
    }
  }

  // Connection status
  isConnected(): boolean {
    const execOpen = this.executionSocket?.readyState === this.executionSocket?.OPEN;
    const devOpen = this.devicesSocket?.readyState === this.devicesSocket?.OPEN;
    return Boolean(execOpen || devOpen);
  }

  // Get connection state
  getConnectionState(): string {
    if (this.isConnected()) return 'connected';
    return 'disconnected';
  }

  // Connection status subscriptions
  subscribeConnectionStatus(callback: (state: 'connected' | 'disconnected') => void): () => void {
    this.connectionListeners.add(callback);
    return () => {
      this.connectionListeners.delete(callback);
    };
  }

  private notifyConnection(): void {
    const state = (this.getConnectionState() as 'connected' | 'disconnected');
    this.connectionListeners.forEach(cb => cb(state));
  }

  private scheduleDevicesReconnect(): void {
    if (!this.shouldReconnectDevices || !this.backendUrl) {
      return;
    }
    if (this.devicesReconnectTimer !== null) {
      return;
    }
    const delay = Math.min(10000, 500 * Math.pow(2, this.devicesReconnectAttempts));
    this.devicesReconnectAttempts += 1;
    this.devicesReconnectTimer = window.setTimeout(() => {
      this.devicesReconnectTimer = null;
      this.connectDevices(this.backendUrl);
    }, delay);
  }

  private scheduleExecutionReconnect(executionId: string): void {
    if (!this.shouldReconnectExecution || !this.backendUrl) {
      return;
    }
    if (this.executionReconnectTimer !== null) {
      return;
    }
    const delay = Math.min(10000, 500 * Math.pow(2, this.executionReconnectAttempts));
    this.executionReconnectAttempts += 1;
    this.executionReconnectTimer = window.setTimeout(() => {
      this.executionReconnectTimer = null;
      this.connectExecution(this.backendUrl, executionId);
    }, delay);
  }
}

export const webSocketService = new WebSocketService();
