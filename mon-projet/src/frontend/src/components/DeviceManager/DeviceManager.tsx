/**
 * Device Manager component for displaying and managing connected devices.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Button,
  Alert,
  CircularProgress,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  TextField,
  List,
  ListItem,
  ListItemText,
  Stack,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';

import DeviceManagerCard from './DeviceManagerCard';
import { deviceApi } from '../../services/deviceApi';
import { webSocketService } from '../../services/websocket';
import { Device } from '@types';
import {
  DEVICE_HISTORY_EVENT,
  DeviceWorkflowRun,
  getAllDeviceWorkflowHistories,
  getDeviceWorkflowHistory,
} from '../../utils/deviceHistory';

interface DeviceManagerProps {
  backendUrl: string;
}

function DeviceManager({ backendUrl }: DeviceManagerProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [selectedDeviceHistory, setSelectedDeviceHistory] = useState<DeviceWorkflowRun[]>([]);
  const [deviceWorkflowCounts, setDeviceWorkflowCounts] = useState<Record<string, number>>({});
  const defaultRange = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    const toInput = (d: Date) => d.toISOString().slice(0, 16);
    return { start: toInput(start), end: toInput(end) };
  }, []);
  const [reportFrom, setReportFrom] = useState<string>(defaultRange.start);
  const [reportTo, setReportTo] = useState<string>(defaultRange.end);
  const [reportPreset, setReportPreset] = useState<'24h' | '7d' | '30d' | null>('24h');
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const BATCH_LIMIT = 10;

  const refreshWorkflowCounts = useCallback(() => {
    const histories = getAllDeviceWorkflowHistories();
    const counts: Record<string, number> = {};
    Object.entries(histories).forEach(([deviceId, runs]) => {
      counts[deviceId] = runs.length;
    });
    setDeviceWorkflowCounts(counts);
  }, []);

  const loadDevices = useCallback(async () => {
    if (!backendUrl) {
      return;
    }
    try {
      setError(null);
      setInfoMessage(null);
      const deviceList = await deviceApi.getDevices(backendUrl);
      setDevices(deviceList);
      refreshWorkflowCounts();
      // Subscribe to device updates for each device
      deviceList.forEach(d => webSocketService.subscribeToDevice(d.id));
    } catch (err) {
      setError('Failed to load devices. Make sure ADB is running and devices are connected.');
      console.error('Error loading devices:', err);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, refreshWorkflowCounts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await deviceApi.scanDevices(backendUrl);
      await loadDevices();
    } catch (err) {
      setError('Failed to refresh devices');
      console.error('Error refreshing devices:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeviceRefresh = async (deviceId: string) => {
    try {
      await deviceApi.refreshDevice(backendUrl, deviceId);
      await loadDevices();
    } catch (err) {
      setError(`Failed to refresh device ${deviceId}`);
      console.error('Error refreshing device:', err);
    }
  };

  const handleScreenshot = async (deviceId: string) => {
    try {
      const result = await deviceApi.captureScreenshot(backendUrl, deviceId);
      // TODO: Show screenshot or download link
      console.log('Screenshot captured:', result);
    } catch (err) {
      setError(`Failed to capture screenshot for device ${deviceId}`);
      console.error('Error capturing screenshot:', err);
    }
  };

  const handleViewDetails = (device: Device) => {
    setSelectedDevice(device);
    setSelectedDeviceHistory(getDeviceWorkflowHistory(device.id));
    setReportFrom(defaultRange.start);
    setReportTo(defaultRange.end);
  };

  const handleCloseDetails = () => {
    setSelectedDevice(null);
    setSelectedDeviceHistory([]);
  };

  const handleDownloadReport = async () => {
    if (!selectedDevice) return;
    try {
      const fromIso = new Date(reportFrom).toISOString();
      const toIso = new Date(reportTo).toISOString();
      const nextSet = new Set(downloadingIds);
      nextSet.add(selectedDevice.id);
      setDownloadingIds(nextSet);
      await deviceApi.downloadDeviceReport(selectedDevice.id, {
        baseUrl: backendUrl,
        from: fromIso,
        to: toIso,
      });
      setInfoMessage(`Download completed for ${selectedDevice.id}`);
      const cleared = new Set(nextSet);
      cleared.delete(selectedDevice.id);
      setDownloadingIds(cleared);
    } catch (err) {
      console.error('Error downloading report', err);
      setError('Failed to download PDF report');
      const cleared = new Set(downloadingIds);
      cleared.delete(selectedDevice?.id || '');
      setDownloadingIds(cleared);
    }
  };

  const handlePresetChange = (_event: React.MouseEvent<HTMLElement>, value: '24h' | '7d' | '30d' | null) => {
    if (!value) return;
    setReportPreset(value);
    const end = new Date();
    const start = new Date(end.getTime() - (value === '24h' ? 1 : value === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000);
    const toInput = (d: Date) => d.toISOString().slice(0, 16);
    setReportFrom(toInput(start));
    setReportTo(toInput(end));
  };

  const handleBatchDownload = async () => {
    const fromIso = new Date(reportFrom).toISOString();
    const toIso = new Date(reportTo).toISOString();
    const ids = devices.slice(0, BATCH_LIMIT).map((d) => d.id);
    if (devices.length > BATCH_LIMIT) {
      setInfoMessage(`Batch limited to ${BATCH_LIMIT} devices (out of ${devices.length}).`);
    } else {
      setInfoMessage(null);
    }
    const next = new Set(downloadingIds);
    ids.forEach((id) => next.add(id));
    setDownloadingIds(next);
    for (const id of ids) {
      try {
        await deviceApi.downloadDeviceReport(id, { baseUrl: backendUrl, from: fromIso, to: toIso });
      } catch (err) {
        console.error(`Error downloading report for ${id}`, err);
        setError(`Failed to download PDF for ${id}`);
      } finally {
        const cleared = new Set(next);
        cleared.delete(id);
        setDownloadingIds(cleared);
      }
    }
    setInfoMessage('Batch completed');
  };

  const formatTimestamp = (value?: string) => {
    if (!value) {
      return 'Unknown';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return `${value} UTC`;
    }
    return parsed.toLocaleString(undefined, { timeZoneName: 'short' });
  };

  const formatNetworkTechnology = (technology?: string | null) => {
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
      nr: '5G',
      'nr-nsa': '5G',
      'nr-sa': '5G',
    };
    const alias = map[normalized];
    return alias ? `${alias} (${technology.toUpperCase()})` : technology.toUpperCase();
  };

  const formatBoolean = (value?: boolean) => {
    if (value === true) {
      return 'Enabled';
    }
    if (value === false) {
      return 'Disabled';
    }
    return 'Unknown';
  };

  const formatBatteryLevel = (battery: Device['battery_level']) => {
    if (battery === null || battery === undefined || battery === '') {
      return 'Unknown';
    }
    if (typeof battery === 'number') {
      return `${battery}%`;
    }
    const trimmed = battery.toString().trim();
    return trimmed.endsWith('%') ? trimmed : `${trimmed}%`;
  };

  useEffect(() => {
    if (!backendUrl) {
      return;
    }

    webSocketService.acquireDevicesConnection(backendUrl);
    void loadDevices();
    // Real-time device status updates
    const unsub = webSocketService.subscribeToDeviceUpdates((update) => {
      setDevices(prev => {
        const idx = prev.findIndex(d => d.id === update.device_id);
        if (idx === -1) {
          // Unknown device: trigger a lazy refresh
          setTimeout(() => { void loadDevices(); }, 0);
          return prev;
        }
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          status: update.status as any,
          last_seen: update.last_seen,
        };
        return next;
      });
    });

    return () => {
      unsub();
      webSocketService.releaseDevicesConnection();
    };
  }, [backendUrl, loadDevices]);

  useEffect(() => {
    refreshWorkflowCounts();

    const handler: EventListener = () => {
      refreshWorkflowCounts();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(DEVICE_HISTORY_EVENT, handler);
      window.addEventListener('storage', handler);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(DEVICE_HISTORY_EVENT, handler);
        window.removeEventListener('storage', handler);
      }
    };
  }, [refreshWorkflowCounts]);

  const sortedDevices = useMemo(() => {
    const weight = (status?: string) => {
      switch ((status || '').toLowerCase()) {
        case 'connected':
          return 0;
        case 'busy':
          return 1;
        case 'disconnected':
          return 2;
        default:
          return 3;
      }
    };
    return [...devices].sort((a, b) => {
      const diff = weight(a.status) - weight(b.status);
      if (diff !== 0) {
        return diff;
      }
      const aTime = a.last_seen ? new Date(a.last_seen).getTime() : 0;
      const bTime = b.last_seen ? new Date(b.last_seen).getTime() : 0;
      return bTime - aTime;
    });
  }, [devices]);

  const statusCounts = useMemo(() => {
    return devices.reduce(
      (acc, device) => {
        const status = (device.status || '').toLowerCase();
        if (status === 'connected') {
          acc.connected += 1;
        } else if (status === 'busy') {
          acc.busy += 1;
        } else if (status === 'disconnected') {
          acc.disconnected += 1;
        } else {
          acc.unknown += 1;
        }
        return acc;
      },
      { connected: 0, busy: 0, disconnected: 0, unknown: 0 }
    );
  }, [devices]);

  useEffect(() => {
    if (selectedDevice) {
      setSelectedDeviceHistory(getDeviceWorkflowHistory(selectedDevice.id));
    }
  }, [selectedDevice, deviceWorkflowCounts]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading devices...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          Device Manager
        </Typography>
        <Button
          variant="outlined"
          startIcon={refreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? 'Scanning...' : 'Refresh Devices'}
        </Button>
      </Box>

      {(error || infoMessage) && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error || infoMessage}
        </Alert>
      )}

      {devices.length === 0 ? (
        <Alert severity="info">
          No devices found. Make sure ADB is running and devices are connected via USB with debugging enabled.
        </Alert>
      ) : (
        <Box>
          <Stack direction="row" spacing={1} mb={3} flexWrap="wrap">
            <Chip label={`Connected: ${statusCounts.connected}`} color="success" variant="outlined" />
            <Chip label={`Busy: ${statusCounts.busy}`} color="warning" variant="outlined" />
            <Chip label={`Disconnected: ${statusCounts.disconnected}`} color="error" variant="outlined" />
            {statusCounts.unknown > 0 && (
              <Chip label={`Unknown: ${statusCounts.unknown}`} variant="outlined" />
            )}
          </Stack>

          <Grid container spacing={2}>
            {sortedDevices.map((device) => (
              <Grid item xs={12} sm={6} md={4} key={device.id}>
                <DeviceManagerCard
                  device={device}
                  onRefresh={() => handleDeviceRefresh(device.id)}
                  onScreenshot={() => handleScreenshot(device.id)}
                  onViewDetails={() => handleViewDetails(device)}
                  workflowCount={deviceWorkflowCounts[device.id] ?? 0}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Floating Action Button for Quick Scan */}
      <Fab
        color="primary"
        aria-label="scan devices"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={handleRefresh}
        disabled={refreshing}
      >
        {refreshing ? <CircularProgress size={24} color="inherit" /> : <RefreshIcon />}
      </Fab>

      <Dialog open={Boolean(selectedDevice)} onClose={handleCloseDetails} maxWidth="md" fullWidth>
        <DialogTitle>Device Information</DialogTitle>
        <DialogContent dividers>
          {selectedDevice && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 2, mb: 3 }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Model</Typography>
                <Typography variant="body1">{selectedDevice.model || 'Unknown'}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Android Version</Typography>
                <Typography variant="body1">{selectedDevice.android_version || selectedDevice.os_version || 'Unknown'}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Connection Type</Typography>
                <Typography variant="body1">{selectedDevice.connection_type || 'Unknown'}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Network Operator</Typography>
                <Typography variant="body1">
                  {selectedDevice.network_operator_live || selectedDevice.network_operator || selectedDevice.carrier || 'Unknown'}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Network Technology</Typography>
                <Typography variant="body1">{formatNetworkTechnology(selectedDevice.network_technology)}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Battery Level</Typography>
                <Typography variant="body1">
                  {formatBatteryLevel(selectedDevice.battery_level)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Developer Mode</Typography>
                <Typography variant="body1">{formatBoolean(selectedDevice.developer_mode_enabled)}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">USB Debugging</Typography>
                <Typography variant="body1">{formatBoolean(selectedDevice.usb_debugging_enabled)}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Last Seen</Typography>
                <Typography variant="body1">{formatTimestamp(selectedDevice.last_seen)}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                <Typography variant="body1">{selectedDevice.status || 'Unknown'}</Typography>
              </Box>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" sx={{ mb: 1 }}>
            Workflow History
          </Typography>

          {selectedDeviceHistory.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              This device has not executed any workflows yet.
            </Typography>
          ) : (
            <List dense>
              {selectedDeviceHistory.map((entry, index) => (
                <ListItem key={`${entry.workflowId}-${index}`} disablePadding>
                  <ListItemText
                    primary={entry.workflowName || entry.workflowId}
                    secondary={formatTimestamp(entry.executedAt)}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <ToggleButtonGroup
            size="small"
            value={reportPreset}
            exclusive
            onChange={handlePresetChange}
            aria-label="report preset"
          >
            <ToggleButton value="24h">24h</ToggleButton>
            <ToggleButton value="7d">7j</ToggleButton>
            <ToggleButton value="30d">30j</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            label="From"
            type="datetime-local"
            size="small"
            value={reportFrom}
            onChange={(e) => setReportFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To"
            type="datetime-local"
            size="small"
            value={reportTo}
            onChange={(e) => setReportTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Button
            variant="contained"
            onClick={handleDownloadReport}
            disabled={!selectedDevice || downloadingIds.has(selectedDevice.id)}
          >
            {downloadingIds.has(selectedDevice?.id || '') ? 'Downloading...' : 'Download PDF'}
          </Button>
          <Button
            variant="outlined"
            onClick={handleBatchDownload}
            disabled={devices.length === 0 || downloadingIds.size > 0}
          >
            Download all (sequential)
          </Button>
          <Button onClick={handleCloseDetails}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default DeviceManager;
