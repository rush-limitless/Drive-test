import React from 'react';
import { Paper, Stack, Typography, Chip, IconButton, Tooltip, Box } from '@mui/material';
import { Ban, PlugZap, Waves, RadioTower, Info } from 'lucide-react';

import { Device } from '@types';
import { DeviceCardProps, DeviceMeta } from './types';

const getMeta = (device: Device): DeviceMeta => {
  const name = device.name || device.model || device.id;
  const model = device.model || 'Unknown';
  const status = (device.status || 'unknown').toUpperCase();
  const connectionType = (device.connection_type || 'usb').toUpperCase();
  const simLabel = device.sim_info?.carrier || device.sim_info?.mnc || 'SIM N/A';
  const network = device.network_operator_live || device.network_operator || 'Unknown';
  const lastSeen = device.last_seen || 'Unknown';

  return {
    name,
    model,
    status,
    connectionType,
    simLabel,
    network,
    lastSeen,
  };
};

const DeviceCard: React.FC<DeviceCardProps> = ({ device, onDisconnect, onDetails, isDisconnecting }) => {
  const meta = React.useMemo(() => getMeta(device), [device]);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.4,
        borderRadius: '18px',
        border: '1px solid rgba(148, 163, 199, 0.35)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(248,250,255,0.95) 100%)',
        boxShadow: '0 18px 36px rgba(15, 23, 42, 0.12)',
        backdropFilter: 'blur(14px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.75,
        minHeight: 210,
      }}
    >
      <Stack direction="row" spacing={1.5} justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={1.5} alignItems="center" minWidth={0}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #E0E7FF 0%, #DBEAFE 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1E3A8A',
              flexShrink: 0,
              fontWeight: 700,
            }}
          >
            {meta.name.slice(0, 2).toUpperCase()}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#0F172A' }} noWrap>
              {meta.name}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }} noWrap>
              {meta.model}
            </Typography>
          </Box>
        </Stack>
        <Chip
          label={meta.status}
          size="small"
          sx={{
            borderRadius: '999px',
            fontWeight: 600,
            backgroundColor: meta.status === 'CONNECTED' ? '#DCFCE7' : '#FEE2E2',
            color: meta.status === 'CONNECTED' ? '#166534' : '#991B1B',
          }}
        />
      </Stack>

      <Stack spacing={1.2} sx={{ flexGrow: 1 }}>
        <InfoItem icon={<PlugZap size={16} />} title="Connection" value={meta.connectionType} />
        <InfoItem icon={<RadioTower size={16} />} title="Network" value={meta.network} />
        <InfoItem icon={<Waves size={16} />} title="SIM" value={meta.simLabel} />
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="caption" sx={{ color: '#94A3B8' }}>
          Last seen: {meta.lastSeen}
        </Typography>
        <Stack direction="row" spacing={0.5}>
          {onDisconnect && (
            <Tooltip title={isDisconnecting ? 'Disconnecting…' : 'Disconnect'}>
              <span>
                <IconButton
                  onClick={() => onDisconnect(device)}
                  disabled={isDisconnecting}
                  size="small"
                  sx={{
                    borderRadius: '10px',
                    border: '1px solid rgba(220, 38, 38, 0.35)',
                    color: '#DC2626',
                    bgcolor: 'rgba(254, 226, 226, 0.6)',
                    '&:hover': { bgcolor: 'rgba(248, 113, 113, 0.25)' },
                  }}
                >
                  <Ban size={16} />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {onDetails && (
            <Tooltip title="Details">
              <IconButton
                onClick={() => onDetails(device)}
                size="small"
                sx={{
                  borderRadius: '10px',
                  border: '1px solid rgba(37, 99, 235, 0.4)',
                  color: '#1E3A8A',
                  bgcolor: 'rgba(219, 234, 254, 0.7)',
                  '&:hover': { bgcolor: 'rgba(191, 219, 254, 0.8)' },
                }}
              >
                <Info size={16} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
};

interface InfoItemProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  badgeColor?: string;
}

const InfoItem: React.FC<InfoItemProps> = ({ icon, title, value, badgeColor }) => (
  <Stack direction="row" spacing={1} alignItems="center" minWidth={0}>
    <Box
      sx={{
        width: 34,
        height: 34,
        borderRadius: '12px',
        backgroundColor: badgeColor || '#E0E7FF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {icon}
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" sx={{ color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ color: '#0F172A' }}>
        {value}
      </Typography>
    </Box>
  </Stack>
);

export default DeviceCard;
export type { DeviceCardProps, DeviceCardActions } from './types';
