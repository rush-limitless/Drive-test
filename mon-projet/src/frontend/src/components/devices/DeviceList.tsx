import React from 'react';
import { Box, CircularProgress, Grid, Typography } from '@mui/material';

import { useDevices, UseDevicesOptions } from '@hooks/useDevices';
import DeviceCard from '@components/devices/DeviceCard';
import { DeviceCardProps } from '@components/devices/DeviceCard/types';

interface DeviceListProps extends UseDevicesOptions {
  cardProps?: Partial<Omit<DeviceCardProps, 'device'>>;
}

const DeviceList: React.FC<DeviceListProps> = ({ backendUrl, scopeId, pollMs, autoRefresh, cardProps }) => {
  const { devices, status, error, refresh, isEmpty } = useDevices({ backendUrl, scopeId, pollMs, autoRefresh });

  if (status === 'loading' && devices.length === 0) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" flexDirection="column" gap={1.5} py={4} textAlign="center">
        <Typography variant="h6" color="error">
          Unable to load devices
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {error.message}
        </Typography>
        <Typography
          component="button"
          onClick={refresh}
          sx={{
            border: 'none',
            background: 'transparent',
            color: '#2563EB',
            cursor: 'pointer',
            textDecoration: 'underline',
            fontSize: 14,
          }}
        >
          Retry
        </Typography>
      </Box>
    );
  }

  if (isEmpty) {
    return (
      <Box
        sx={{
          border: '1px dashed rgba(148, 163, 184, 0.4)',
          borderRadius: '20px',
          backgroundColor: '#F8FAFF',
          textAlign: 'center',
          py: 6,
        }}
      >
        <Typography variant="h6" sx={{ color: '#0F172A', mb: 1 }}>
          No devices detected
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748B' }}>
          Connect a device via USB and run a scan to populate this list.
        </Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={3}>
      {devices.map((device) => (
        <Grid item xs={12} sm={6} key={device.id}>
          <DeviceCard device={device} {...cardProps} />
        </Grid>
      ))}
    </Grid>
  );
};

export default DeviceList;
