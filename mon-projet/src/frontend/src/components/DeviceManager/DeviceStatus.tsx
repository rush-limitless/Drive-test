/**
 * Device Status component for displaying device status indicators.
 */

import React from 'react';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import {
  CheckCircle as ConnectedIcon,
  Error as ErrorIcon,
  Warning as BusyIcon,
  Cancel as DisconnectedIcon,
} from '@mui/icons-material';

interface DeviceStatusProps {
  status: 'connected' | 'disconnected' | 'busy' | 'error';
  lastSeen?: string;
  compact?: boolean;
}

function DeviceStatus({ status, lastSeen, compact = false }: DeviceStatusProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'connected':
        return {
          label: 'Connected',
          color: 'success' as const,
          icon: <ConnectedIcon />,
          description: 'Device is connected and available for automation'
        };
      case 'busy':
        return {
          label: 'Busy',
          color: 'warning' as const,
          icon: <BusyIcon />,
          description: 'Device is currently executing automation tasks'
        };
      case 'disconnected':
        return {
          label: 'Disconnected',
          color: 'error' as const,
          icon: <DisconnectedIcon />,
          description: 'Device is not connected or ADB connection lost'
        };
      case 'error':
        return {
          label: 'Error',
          color: 'error' as const,
          icon: <ErrorIcon />,
          description: 'Device encountered an error and may need attention'
        };
      default:
        return {
          label: 'Unknown',
          color: 'default' as const,
          icon: <ErrorIcon />,
          description: 'Device status is unknown'
        };
    }
  };

  const config = getStatusConfig(status);

  const formatLastSeen = (lastSeen: string) => {
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    return date.toLocaleDateString();
  };

  if (compact) {
    return (
      <Tooltip title={`${config.description}${lastSeen ? ` (Last seen: ${formatLastSeen(lastSeen)})` : ''}`}>
        <Chip
          icon={config.icon}
          label={config.label}
          color={config.color}
          size="small"
          variant="outlined"
        />
      </Tooltip>
    );
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={1}>
        <Chip
          icon={config.icon}
          label={config.label}
          color={config.color}
          variant="outlined"
        />
      </Box>
      
      <Typography variant="body2" color="text.secondary">
        {config.description}
      </Typography>
      
      {lastSeen && (
        <Typography variant="caption" color="text.secondary">
          Last seen: {formatLastSeen(lastSeen)}
        </Typography>
      )}
    </Box>
  );
}

export default DeviceStatus;