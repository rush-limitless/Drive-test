/**
 * WebSocket connection status indicator.
 */

import React, { useEffect, useState } from 'react';
import { Chip, Tooltip } from '@mui/material';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import { webSocketService } from '../services/websocket';

function WebSocketStatus() {
  const [status, setStatus] = useState<'connected' | 'disconnected'>(
    (webSocketService.getConnectionState() as 'connected' | 'disconnected')
  );

  useEffect(() => {
    const unsub = webSocketService.subscribeConnectionStatus((state) => {
      setStatus(state);
    });
    return () => unsub();
  }, []);

  const isConnected = status === 'connected';

  return (
    <Tooltip title={`WebSocket ${status}`} placement="bottom">
      <Chip
        size="small"
        icon={isConnected ? <CloudDoneIcon /> : <CloudOffIcon />}
        label={`WS: ${status}`}
        color={isConnected ? 'success' : 'default'}
        variant={isConnected ? 'filled' : 'outlined'}
        sx={{ ml: 1 }}
      />
    </Tooltip>
  );
}

export default WebSocketStatus;

