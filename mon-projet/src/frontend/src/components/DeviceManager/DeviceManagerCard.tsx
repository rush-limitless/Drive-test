/**
 * Device Manager card for displaying individual device information.
 */

import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  Box,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Smartphone as PhoneIcon,
  Refresh as RefreshIcon,
  CameraAlt as ScreenshotIcon,
  SignalCellular4Bar as SignalIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

import { Device } from '@types';

interface DeviceManagerCardProps {
  device: Device;
  onRefresh: () => void;
  onScreenshot: () => void;
  onViewDetails: () => void;
  workflowCount?: number;
}

const formatNetworkTechnology = (technology?: string | null): string => {
  if (!technology) {
    return 'Unknown';
  }
  const normalized = technology.toLowerCase();
  const map: Record<string, string> = {
    lte: '4G',
    'lte-ca': '4G+',
    gprs: '2G',
    edge: '2G',
    gsm: '2G',
    umts: '3G',
    wcdma: '3G',
    hspa: '3G',
    hspap: '3G',
    tdscdma: '3G',
    nr: '5G',
    'nr-nsa': '5G',
    'nr-sa': '5G',
  };
  const alias = map[normalized];
  return alias ? `${alias} (${technology.toUpperCase()})` : technology.toUpperCase();
};

const formatBatteryLevel = (battery: Device['battery_level']): string => {
  if (battery === null || battery === undefined) {
    return 'N/A';
  }
  if (typeof battery === 'number') {
    return `${battery}%`;
  }
  const trimmed = battery.toString().trim();
  return trimmed.endsWith('%') ? trimmed : `${trimmed}%`;
};

function DeviceManagerCard({
  device,
  onRefresh,
  onScreenshot,
  onViewDetails,
  workflowCount = 0,
}: DeviceManagerCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'success';
      case 'busy':
        return 'warning';
      case 'disconnected':
        return 'error';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'busy':
        return 'Busy';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const formatLastSeen = (lastSeen: string) => {
    if (!lastSeen) {
      return 'Unknown';
    }
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  };

  const isActionable = device.status === 'connected' || device.status === 'busy';

  return (
    <Card 
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        opacity: device.status === 'disconnected' ? 0.7 : 1,
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box display="flex" alignItems="center">
            <PhoneIcon sx={{ mr: 1, color: 'text.secondary' }} />
            <Typography variant="h6" component="div" noWrap>
              {device.model}
            </Typography>
          </Box>
          <Chip
            label={getStatusText(device.status)}
            color={getStatusColor(device.status) as any}
            size="small"
          />
          <Chip
            label={`${workflowCount} workflow${workflowCount === 1 ? '' : 's'}`}
            size="small"
            variant="outlined"
            sx={{ ml: 1 }}
          />
        </Box>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          ID: {device.id}
        </Typography>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          Android {device.os_version}
        </Typography>

        {device.phone_number && (
          <Box display="flex" alignItems="center" mt={1}>
            <SignalIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              {device.phone_number}
            </Typography>
          </Box>
        )}

        {device.network_technology && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Network: {formatNetworkTechnology(device.network_technology)}
          </Typography>
        )}

        {device.sim_info && (device.sim_info.mcc || device.sim_info.mnc) && (
          <Typography variant="body2" color="text.secondary">
            SIM: {device.sim_info.mcc}-{device.sim_info.mnc}
          </Typography>
        )}

        {device.battery_level !== undefined && (
          <Typography variant="body2" color="text.secondary">
            Battery: {formatBatteryLevel(device.battery_level)}
          </Typography>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Last seen: {formatLastSeen(device.last_seen)}
        </Typography>
      </CardContent>

      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
        <Box>
          <Tooltip title="Refresh device info">
            <IconButton size="small" onClick={onRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Capture screenshot">
            <span>
              <IconButton 
                size="small" 
                onClick={onScreenshot}
                disabled={!isActionable}
              >
                <ScreenshotIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        <Tooltip title="Device details">
          <IconButton size="small" onClick={onViewDetails}>
            <InfoIcon />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  );
}

export default DeviceManagerCard;
