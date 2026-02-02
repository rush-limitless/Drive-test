import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Checkbox,
  FormControl,
  Select,
  MenuItem,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  ButtonGroup,
} from '@mui/material';
import {
  Search,
  RefreshCw,
  Smartphone,
  Info,
  Play,
  Tag,
  Bookmark,
  BookmarkCheck,
  RotateCcw,
  Power,
  FileText,
  NotebookPen,
  GitBranch,
  Square,
  CheckSquare,
} from 'lucide-react';

import Layout from '../components/Layout';
import { useDevices } from '../hooks/useDevices';
import { Device } from '@types';
import { deviceApi } from '../services/deviceApi';
import {
  readDeviceRegistry,
  syncDevicesToRegistry,
  DEVICE_REGISTRY_EVENT,
  DEVICE_REGISTRY_STORAGE_KEY,
  DeviceRegistryEntry,
} from '../utils/deviceRegistry';
import { resolveBaseUrl, fetchWithRetry } from '../services/utils';
import {
  getAllDeviceActivities,
  getDeviceActivity,
  DEVICE_ACTIVITY_EVENT,
  DEVICE_ACTIVITY_STORAGE_KEY,
  DeviceActivityEntry,
} from '../utils/deviceActivity';
import {
  DeviceMetadata,
  DeviceMetadataMap,
  DEFAULT_DEVICE_METADATA,
  normalizeDeviceMetadata,
  readDeviceMetadata,
  writeDeviceMetadata,
} from '../utils/deviceMetadata';

interface DeviceManagerProps {
  backendUrl: string;
}

type ManagedDevice = Device & {
  __historical?: boolean;
  __registry?: DeviceRegistryEntry | null;
};

const normalizeStatusValue = (status?: string | null): string =>
  status ? status.toLowerCase() : 'unknown';

const isDeviceInactive = (device: ManagedDevice): boolean => {
  if (device.__historical === true) {
    return true;
  }
  const normalized = normalizeStatusValue(device.status);
  return ['disconnected', 'offline', 'unknown'].includes(normalized);
};

const formatTimestamp = (value?: string | null) => {
  if (!value) {
    return 'Unknown';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  return date.toLocaleString();
};

const isWithinRange = (timestamp: string | null | undefined, range: 'any' | '24h' | '7d' | '30d'): boolean => {
  if (range === 'any') {
    return true;
  }
  if (!timestamp) {
    return false;
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const diff = Date.now() - date.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (range === '24h') {
    return diff <= dayMs;
  }
  if (range === '7d') {
    return diff <= 7 * dayMs;
  }
  return diff <= 30 * dayMs;
};

const DeviceManager: React.FC<DeviceManagerProps> = ({ backendUrl }) => {
  const { devices, status, refresh, applyDevicePatch } = useDevices({ backendUrl, pollMs: 5000 });
  const [refreshingDevices, setRefreshingDevices] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [metadata, setMetadata] = useState<DeviceMetadataMap>(() => readDeviceMetadata());
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
  const [registryVersion, setRegistryVersion] = useState(0);
  const [activityVersion, setActivityVersion] = useState(0);
  const [activityDialog, setActivityDialog] = useState<{ deviceId: string; name: string } | null>(null);
  const [activityDialogEvents, setActivityDialogEvents] = useState<DeviceActivityEntry[]>([]);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [filterHasHistory, setFilterHasHistory] = useState<'all' | 'historical' | 'live'>('all');
  const [filterDateRange, setFilterDateRange] = useState<'any' | '24h' | '7d' | '30d'>('any');
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});
  const [exportStart, setExportStart] = useState<string>('');
  const [exportEnd, setExportEnd] = useState<string>('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyTagFilter, setHistoryTagFilter] = useState<string>('all');
  const [historyPage, setHistoryPage] = useState(0);
  const historyPageSize = 10;

  const getStatusColor = (status?: string) => {
    const normalized = normalizeStatusValue(status);
    switch (normalized) {
      case 'connected':
        return { bg: '#EEF2FF', color: '#2563EB' };
      case 'online':
        return { bg: '#ECFDF5', color: '#16A34A' };
      case 'offline':
        return { bg: '#FEF2F2', color: '#DC2626' };
      case 'busy':
        return { bg: '#FEF3C7', color: '#B45309' };
      default:
        return { bg: '#F1F5F9', color: '#64748B' };
    }
  };

  const handleDeviceAction = async (deviceId: string, action: string) => {
    try {
      const optimisticMap: Record<string, Partial<Device>> = {
        disconnect: { status: 'disconnecting' },
        reboot: { status: 'restarting' },
        test: { status: 'testing' },
        logs: { status: 'collecting_logs' },
      };
      const patch = optimisticMap[action];
      if (patch) {
        applyDevicePatch(deviceId, {
          ...patch,
          last_seen: new Date().toISOString(),
        });
      }
      const response = await fetchWithRetry(`${backendUrl}/api/v1/devices/${deviceId}/${action}`, {
        method: 'POST',
      });
      if (response.ok) {
        refresh();
      }
    } catch (error) {
      console.error(`Error ${action} device:`, error);
    }
  };

  useEffect(() => {
    writeDeviceMetadata(metadata);
  }, [metadata]);

  useEffect(() => {
    const handleRegistryUpdate = () => setRegistryVersion((prev) => prev + 1);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === DEVICE_REGISTRY_STORAGE_KEY) {
        handleRegistryUpdate();
      }
    };
    window.addEventListener(DEVICE_REGISTRY_EVENT, handleRegistryUpdate);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(DEVICE_REGISTRY_EVENT, handleRegistryUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    const handleActivityUpdate = () => setActivityVersion((prev) => prev + 1);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === DEVICE_ACTIVITY_STORAGE_KEY) {
        handleActivityUpdate();
      }
    };
    window.addEventListener(DEVICE_ACTIVITY_EVENT, handleActivityUpdate);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(DEVICE_ACTIVITY_EVENT, handleActivityUpdate);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    syncDevicesToRegistry(devices);
  }, [devices]);

  const updateDeviceMetadata = (
    deviceId: string,
    patch: Partial<DeviceMetadata> | ((current: DeviceMetadata) => Partial<DeviceMetadata>)
  ) => {
    setMetadata((prev) => {
      const current = normalizeDeviceMetadata(prev[deviceId] ?? DEFAULT_DEVICE_METADATA);
      const resolvedPatch = typeof patch === 'function' ? patch(current) : patch;
      const next = normalizeDeviceMetadata({ ...current, ...resolvedPatch });
      return {
        ...prev,
        [deviceId]: next,
      };
    });
  };

  const handleAliasChange = (deviceId: string, value: string) => {
    updateDeviceMetadata(deviceId, { alias: value });
  };

  const handleAddTag = (deviceId: string) => {
    const value = (tagInputs[deviceId] ?? '').trim();
    if (!value) {
      return;
    }
    updateDeviceMetadata(deviceId, (current) => ({
      tags: current.tags.includes(value) ? current.tags : [...current.tags, value],
    }));
    setTagInputs((prev) => ({ ...prev, [deviceId]: '' }));
  };

  const handleRemoveTag = (deviceId: string, tag: string) => {
    updateDeviceMetadata(deviceId, (current) => ({
      tags: current.tags.filter((existing) => existing !== tag),
    }));
  };

  const handleTagInputChange = (deviceId: string, value: string) => {
    setTagInputs((prev) => ({ ...prev, [deviceId]: value }));
  };

  const togglePin = (deviceId: string) => {
    updateDeviceMetadata(deviceId, (current) => ({ pinned: !current.pinned }));
  };

  const openActivityDialog = (device: ManagedDevice) => {
    const alias = metadata[device.id]?.alias?.trim();
    const name = alias || device.model || device.id;
    setActivityDialog({ deviceId: device.id, name });
    setActivityDialogEvents(getDeviceActivity(device.id));
  };

  const closeActivityDialog = () => {
    setActivityDialog(null);
    setActivityDialogEvents([]);
  };

  const toggleManagedDeviceSelection = (deviceId: string, checked: boolean) => {
    setSelectedDeviceIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(deviceId);
      } else {
        next.delete(deviceId);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = (checked: boolean, devicesSubset: ManagedDevice[]) => {
    if (checked) {
      setSelectedDeviceIds((prev) => {
        const next = new Set(prev);
        devicesSubset.forEach((device) => {
          if (!isDeviceInactive(device)) {
            next.add(device.id);
          }
        });
        return next;
      });
    } else {
      setSelectedDeviceIds((prev) => {
        const next = new Set(prev);
        devicesSubset.forEach((device) => next.delete(device.id));
        return next;
      });
    }
  };

  const clearSelection = () => setSelectedDeviceIds(new Set());

  const handleScanDevices = async () => {
    if (refreshingDevices) {
      return;
    }
    setRefreshingDevices(true);
    try {
      if (backendUrl) {
        await deviceApi.scanDevices(backendUrl);
      }
      await refresh();
    } catch (error) {
      console.error('Device scan failed', error);
    } finally {
      setRefreshingDevices(false);
    }
  };

  const handleBulkAction = async (action: 'disconnect' | 'reboot' | 'logs' | 'pin' | 'unpin') => {
    const ids = Array.from(selectedDeviceIds);
    if (ids.length === 0) {
      return;
    }
    if (action === 'pin' || action === 'unpin') {
      ids.forEach((deviceId) => updateDeviceMetadata(deviceId, { pinned: action === 'pin' }));
      return;
    }
    await Promise.all(ids.map((deviceId) => handleDeviceAction(deviceId, action).catch(() => null)));
    clearSelection();
  };

  const handleNotesChange = (deviceId: string, value: string) => {
    setNotesDrafts((prev) => ({ ...prev, [deviceId]: value }));
  };

  const persistNotes = (deviceId: string) => {
    const value = notesDrafts[deviceId];
    updateDeviceMetadata(deviceId, { notes: value ?? '' });
    setNotesDrafts((prev) => {
      const next = { ...prev };
      delete next[deviceId];
      return next;
    });
  };

  const toggleChecklistItem = (deviceId: string, itemId: string) => {
    updateDeviceMetadata(deviceId, (current) => {
      const checklist = current.checklist ?? [];
      const nextChecklist = checklist.map((item) =>
        item.id === itemId ? { ...item, done: !item.done } : item
      );
      return { checklist: nextChecklist };
    });
  };

  const registryEntries = useMemo(() => readDeviceRegistry(), [registryVersion]);
  const activityMap = useMemo(() => getAllDeviceActivities(), [activityVersion]);

  const managedDevices = useMemo<ManagedDevice[]>(() => {
    const map = new Map<string, ManagedDevice>();
    devices.forEach((device) => {
      map.set(device.id, {
        ...device,
        __historical: false,
        __registry: registryEntries[device.id] ?? null,
      });
    });
    Object.values(registryEntries).forEach((entry) => {
        if (!map.has(entry.id)) {
        map.set(entry.id, {
          id: entry.id,
          model: entry.model ?? 'Unknown Device',
          connection_type: entry.connectionType,
          status: 'offline',
          last_seen: entry.lastSeen,
          __historical: true,
          __registry: entry,
        } as ManagedDevice);
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      const aHistorical = a.__historical ? 1 : 0;
      const bHistorical = b.__historical ? 1 : 0;
      if (aHistorical !== bHistorical) {
        return aHistorical - bHistorical;
      }
      const aTime = a.last_seen || a.__registry?.lastSeen || '';
      const bTime = b.last_seen || b.__registry?.lastSeen || '';
      return (bTime || '').localeCompare(aTime || '');
    });
  }, [devices, registryEntries]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    Object.values(metadata).forEach((meta) => meta?.tags?.forEach((tag) => set.add(tag)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [metadata]);

  const filteredDevices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return managedDevices.filter((device) => {
      const meta = metadata[device.id];
      const registryMeta = (device as ManagedDevice).__registry;
      const haystack = [
        device.model,
        device.id,
        device.os_version,
        meta?.alias,
        ...(meta?.tags ?? []),
        registryMeta?.model,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      if (!matchesSearch) {
        return false;
      }
      if (
        filterStatus !== 'all' &&
        normalizeStatusValue(device.status) !== filterStatus &&
        !(filterStatus === 'offline' && normalizeStatusValue(device.status) === 'unknown')
      ) {
        return false;
      }
      if (filterTag !== 'all' && !meta?.tags?.includes(filterTag)) {
        return false;
      }
      if (filterHasHistory === 'historical' && !device.__historical) {
        return false;
      }
      if (filterHasHistory === 'live' && device.__historical) {
        return false;
      }
      if (!isWithinRange(device.last_seen || registryMeta?.lastSeen, filterDateRange)) {
        return false;
      }
      return true;
    });
  }, [managedDevices, metadata, searchQuery, filterStatus, filterTag, filterHasHistory, filterDateRange]);

  const pinnedDevices = useMemo(
    () => managedDevices.filter((device) => metadata[device.id]?.pinned),
    [managedDevices, metadata]
  );

  const tagUsage = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(metadata).forEach((meta) => {
      meta?.tags?.forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [metadata]);

  const recentActivity = useMemo(() => {
    const entries: Array<DeviceActivityEntry & { deviceId: string }> = [];
    Object.entries(activityMap).forEach(([deviceId, events]) => {
      events.slice(0, 3).forEach((event) => entries.push({ ...event, deviceId }));
    });
    return entries.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')).slice(0, 5);
  }, [activityMap]);

  const filteredHistoryEvents = useMemo(() => {
    let list = activityDialogEvents;
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      list = list.filter((evt) => {
        const hay = [evt.label, evt.referenceId, evt.details]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    if (historyTagFilter !== 'all') {
      const tags = metadata[activityDialog?.deviceId || '']?.tags || [];
      if (!tags.includes(historyTagFilter)) {
        list = [];
      }
    }
    return list;
  }, [activityDialog?.deviceId, activityDialogEvents, historySearch, historyTagFilter, metadata]);

  const pagedHistoryEvents = useMemo(() => {
    const start = historyPage * historyPageSize;
    return filteredHistoryEvents.slice(start, start + historyPageSize);
  }, [filteredHistoryEvents, historyPage, historyPageSize]);

  const usageAnalytics = useMemo(() => {
    let workflowCount = 0;
    let moduleCount = 0;
    const deviceFrequency: Record<string, number> = {};
    Object.entries(activityMap).forEach(([deviceId, events]) => {
      events.forEach((event) => {
        if (event.type === 'workflow') {
          workflowCount += 1;
        } else {
          moduleCount += 1;
        }
      });
      deviceFrequency[deviceId] = events.length;
    });
    const mostActiveDeviceId = Object.entries(deviceFrequency).sort((a, b) => b[1] - a[1])[0]?.[0];
    const mostActiveDevice =
      mostActiveDeviceId &&
      (metadata[mostActiveDeviceId]?.alias ||
        managedDevices.find((device) => device.id === mostActiveDeviceId)?.model ||
        mostActiveDeviceId);
    return {
      workflowCount,
      moduleCount,
      mostActiveDevice,
    };
  }, [activityMap, metadata, managedDevices]);

  const handleViewModeChange = (_event: React.MouseEvent<HTMLElement>, next: 'cards' | 'table' | null) => {
    if (next) {
      setViewMode(next);
    }
  };

  const selectionCount = selectedDeviceIds.size;
  const allFilteredSelected =
    filteredDevices.length > 0 && filteredDevices.every((device) => selectedDeviceIds.has(device.id));

  const statusOptions = [
    { value: 'all', label: 'All statuses' },
    { value: 'connected', label: 'Connected' },
    { value: 'online', label: 'Online' },
    { value: 'busy', label: 'Busy' },
    { value: 'offline', label: 'Offline' },
  ];

  const historyOptions: Array<{ value: 'all' | 'live' | 'historical'; label: string }> = [
    { value: 'all', label: 'All devices' },
    { value: 'live', label: 'Live only' },
    { value: 'historical', label: 'History only' },
  ];

  const dateRangeOptions = [
    { value: 'any', label: 'Any time' },
    { value: '24h', label: 'Last 24h' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
  ];

  const renderChecklist = (deviceId: string, checklist?: DeviceMetadata['checklist']) => {
    if (!checklist || checklist.length === 0) {
      return null;
    }
    return (
      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        {checklist.map((item) => (
          <Chip
            key={`${deviceId}-${item.id}`}
            label={item.label}
            icon={item.done ? <CheckSquare size={12} /> : <Square size={12} />}
            onClick={() => toggleChecklistItem(deviceId, item.id)}
            sx={{
              backgroundColor: item.done ? '#DCFCE7' : '#F1F5F9',
              color: item.done ? '#15803D' : '#475569',
              '& .MuiChip-icon': {
                color: item.done ? '#15803D' : '#94A3B8',
              },
            }}
          />
        ))}
      </Stack>
    );
  };

  const renderDeviceCard = (device: ManagedDevice) => {
    const registryMeta = device.__registry;
    const isHistorical = device.__historical === true;
    const isInactive = isDeviceInactive(device);
    const deviceMeta = metadata[device.id] ?? DEFAULT_DEVICE_METADATA;
    const alias = deviceMeta.alias?.trim();
    const displayName = alias || device.model || registryMeta?.model || 'Unknown Device';
    const deviceTags = deviceMeta.tags ?? [];
    const tagInputValue = tagInputs[device.id] ?? '';
    const isPinned = Boolean(deviceMeta.pinned);
    const lastSeenDisplay = device.last_seen || registryMeta?.lastSeen || registryMeta?.firstSeen || null;
    const connectionLabel = device.connection_type || registryMeta?.connectionType || 'Unknown';
    const statusStyle = isHistorical ? { bg: '#F3F4F6', color: '#6B7280' } : getStatusColor(device.status);
    const activityEntries = (activityMap[device.id] ?? []).slice(0, 3);
    const moduleRuns = activityEntries.filter((entry) => entry.type === 'module').length;
    const workflowRuns = activityEntries.filter((entry) => entry.type === 'workflow').length;
    const hasActivity = (activityMap[device.id] ?? []).length > 0;
    const notesValue = notesDrafts[device.id] ?? deviceMeta.notes ?? '';

    return (
      <Grid item xs={12} md={6} key={device.id}>
        <Card
          sx={{
            backgroundColor: '#F8FAFC',
            border: selectedDeviceIds.has(device.id) ? '2px solid #2563EB' : '1px solid #E5E7EB',
            borderRadius: '12px',
            transition: 'all 0.2s',
            '&:hover': {
              boxShadow: '0 4px 8px rgba(16, 24, 40, 0.12)',
              borderColor: '#2563EB',
            },
          }}
        >
          <CardContent sx={{ padding: '20px' }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
              <Box display="flex" alignItems="center" gap={1}>
                <Checkbox
                  checked={selectedDeviceIds.has(device.id)}
                  onChange={(event) => toggleManagedDeviceSelection(device.id, event.target.checked)}
                  disabled={isInactive}
                />
                <Chip
                  label={isHistorical ? 'History' : device.status || 'Unknown'}
                  size="small"
                  sx={{
                    backgroundColor: statusStyle.bg,
                    color: statusStyle.color,
                    fontWeight: 600,
                    textTransform: 'capitalize',
                  }}
                />
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Tooltip title={isPinned ? 'Unpin device' : 'Pin device'}>
                  <IconButton
                    size="small"
                    onClick={() => togglePin(device.id)}
                    disabled={isInactive}
                    sx={{
                      backgroundColor: isPinned ? '#FFE4E6' : '#F1F5F9',
                      color: isPinned ? '#BE123C' : '#475569',
                      width: 32,
                      height: 32,
                      opacity: isInactive ? 0.5 : 1,
                    }}
                  >
                    {isPinned ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={hasActivity ? 'View timeline' : 'No activity yet'}>
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => openActivityDialog(device)}
                      disabled={!hasActivity || isInactive}
                      sx={{ width: 32, height: 32 }}
                    >
                      <NotebookPen size={16} />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Box>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Box
                sx={{
                  backgroundColor: statusStyle.bg,
                  borderRadius: '12px',
                  p: 1.5,
                  color: statusStyle.color,
                }}
              >
                <Smartphone size={24} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
                  {displayName}
                </Typography>
                <Typography variant="body2" sx={{ color: '#6B7280', fontSize: '12px' }}>
                  {device.model && device.model !== displayName ? `${device.model} â€¢ ` : ''}
                  {device.id}
                </Typography>
              </Box>
            </Box>
            <Box display="flex" alignItems="center" gap={1.5} sx={{ mb: 2 }}>
              <Info size={16} color="#6B7280" />
              <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                Android {device.os_version || 'Unknown'}
              </Typography>
            </Box>
            <TextField
              size="small"
              label="Alias"
              fullWidth
              value={deviceMeta.alias ?? ''}
              onChange={(e) => handleAliasChange(device.id, e.target.value)}
              disabled={isInactive}
              sx={{ mb: 1.5 }}
            />
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
              {deviceTags.length === 0 ? (
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                  No tags yet
                </Typography>
              ) : (
                deviceTags.map((tag) => (
                  <Chip
                    key={`${device.id}-${tag}`}
                    label={`#${tag}`}
                    size="small"
                    onDelete={() => handleRemoveTag(device.id, tag)}
                    sx={{ backgroundColor: '#E0E7FF', color: '#1E3A8A' }}
                  />
                ))
              )}
            </Stack>
            <TextField
              size="small"
              placeholder="Add tag (enter)"
              value={tagInputValue}
              onChange={(e) => handleTagInputChange(device.id, e.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAddTag(device.id);
                }
              }}
              disabled={isInactive}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => handleAddTag(device.id)} disabled={isInactive}>
                      <Tag size={14} />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
            {renderChecklist(device.id, deviceMeta.checklist)}
            <TextField
              label="Notes"
              size="small"
              fullWidth
              multiline
              minRows={2}
              value={notesValue}
              onChange={(event) => handleNotesChange(device.id, event.target.value)}
              onBlur={() => persistNotes(device.id)}
              disabled={isInactive}
              sx={{ mb: 2 }}
            />
            <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
              Last seen: {formatTimestamp(lastSeenDisplay)} â€¢ Connection: {connectionLabel}
            </Typography>
            <Typography variant="caption" sx={{ color: '#475569', fontSize: '12px', display: 'block', mb: 2 }}>
              {workflowRuns} workflow{workflowRuns === 1 ? '' : 's'} â€¢ {moduleRuns} module{moduleRuns === 1 ? '' : 's'}
              {activityEntries[0]?.timestamp ? ` â€¢ Last activity: ${formatTimestamp(activityEntries[0].timestamp)}` : ''}
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1}>
                <Tooltip title={isHistorical ? 'Unavailable for historical devices' : 'Disconnect from ADB'}>
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => handleDeviceAction(device.id, 'disconnect')}
                      disabled={isInactive}
                      sx={{
                        backgroundColor: '#FFF7ED',
                        color: '#C2410C',
                        width: 32,
                        height: 32,
                        opacity: isInactive ? 0.5 : 1,
                      }}
                    >
                      <Power size={16} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={isHistorical ? 'Unavailable for historical devices' : 'Reboot device'}>
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => handleDeviceAction(device.id, 'reboot')}
                      disabled={isInactive}
                      sx={{
                        backgroundColor: '#E0F2FE',
                        color: '#0369A1',
                        width: 32,
                        height: 32,
                        opacity: isInactive ? 0.5 : 1,
                      }}
                    >
                      <RotateCcw size={16} />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title={isHistorical ? 'Unavailable for historical devices' : 'Capture logs'}>
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => handleDeviceAction(device.id, 'logs')}
                      disabled={isInactive}
                      sx={{
                        backgroundColor: '#EEF2FF',
                        color: '#4338CA',
                        width: 32,
                        height: 32,
                        opacity: isInactive ? 0.5 : 1,
                      }}
                    >
                      <FileText size={16} />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Tooltip title="Device Info">
                  <IconButton
                    size="small"
                    disabled={isInactive}
                    sx={{
                      backgroundColor: '#F1F5F9',
                      color: '#475569',
                      width: 32,
                      height: 32,
                      opacity: isInactive ? 0.5 : 1,
                    }}
                  >
                    <Info size={16} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={isHistorical ? 'Unavailable for historical devices' : 'Run quick test'}>
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => handleDeviceAction(device.id, 'test')}
                      disabled={isInactive}
                      sx={{
                        backgroundColor: '#2563EB',
                        color: 'white',
                        width: 32,
                        height: 32,
                        opacity: isInactive ? 0.5 : 1,
                      }}
                    >
                      <Play size={16} />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    );
  };

  const renderTableView = () => (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Checkbox
          checked={allFilteredSelected}
          indeterminate={selectedDeviceIds.size > 0 && !allFilteredSelected}
          onChange={(event) => toggleSelectAllFiltered(event.target.checked, filteredDevices)}
        />
        <Typography sx={{ color: '#475569', fontSize: '14px' }}>Select all</Typography>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" />
            <TableCell>Device</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Last seen</TableCell>
            <TableCell>Tags</TableCell>
            <TableCell align="right">Workflows</TableCell>
            <TableCell align="right">Modules</TableCell>
            <TableCell align="right">Timeline</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredDevices.map((device) => {
            const managedDevice = device as ManagedDevice;
            const registryMeta = managedDevice.__registry;
            const isHistorical = managedDevice.__historical === true;
            const isInactive = isDeviceInactive(managedDevice);
            const deviceMeta = metadata[device.id] ?? DEFAULT_DEVICE_METADATA;
            const alias = deviceMeta.alias?.trim();
            const displayName = alias || device.model || registryMeta?.model || device.id;
            const statusStyle = isHistorical ? { bg: '#F3F4F6', color: '#6B7280' } : getStatusColor(device.status);
            const activityEntries = activityMap[device.id] ?? [];
            const moduleRuns = activityEntries.filter((entry) => entry.type === 'module').length;
            const workflowRuns = activityEntries.filter((entry) => entry.type === 'workflow').length;
            const hasActivity = activityEntries.length > 0;
            return (
              <TableRow key={`${device.id}-table`}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedDeviceIds.has(device.id)}
                    onChange={(event) => toggleManagedDeviceSelection(device.id, event.target.checked)}
                    disabled={isInactive}
                  />
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontWeight: 600, color: '#0F172A' }}>{displayName}</Typography>
                  <Typography sx={{ fontSize: '12px', color: '#6B7280' }}>{device.id}</Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={isHistorical ? 'History' : device.status || 'Unknown'}
                    size="small"
                    sx={{
                      backgroundColor: statusStyle.bg,
                      color: statusStyle.color,
                      fontWeight: 600,
                      textTransform: 'capitalize',
                    }}
                  />
                </TableCell>
                <TableCell>{formatTimestamp(device.last_seen || registryMeta?.lastSeen)}</TableCell>
                <TableCell>
                  {(deviceMeta.tags ?? []).length === 0
                    ? '-'
                    : (deviceMeta.tags ?? []).map((tag) => `#${tag}`).join(', ')}
                </TableCell>
                <TableCell align="right">{workflowRuns}</TableCell>
                <TableCell align="right">{moduleRuns}</TableCell>
                <TableCell align="right">
                  <Tooltip title={hasActivity ? 'View activity history' : 'No activity yet'}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => openActivityDialog(managedDevice)}
                        disabled={!hasActivity}
                      >
                        <NotebookPen size={16} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );

  return (
    <Layout>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 4,
        }}
      >
        <Typography variant="h1" sx={{ fontSize: '28px', lineHeight: '36px', fontWeight: 700, color: '#0F172A' }}>
          Device Manager
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField
            placeholder="Search devices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{
              width: 280,
              '& .MuiOutlinedInput-root': {
                height: 40,
                borderRadius: '10px',
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={20} color="#6B7280" />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            startIcon={<RefreshCw size={20} />}
            onClick={handleScanDevices}
            disabled={refreshingDevices}
            sx={{
              height: 40,
              borderRadius: '10px',
              backgroundColor: '#2563EB',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            {refreshingDevices ? 'Scanning...' : 'Scan Devices'}
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <Select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
            {statusOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <Select value={filterTag} onChange={(event) => setFilterTag(event.target.value)}>
            <MenuItem value="all">All tags</MenuItem>
            {allTags.map((tag) => (
              <MenuItem key={tag} value={tag}>
                #{tag}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <Select value={filterHasHistory} onChange={(event) => setFilterHasHistory(event.target.value as any)}>
            {historyOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <Select value={filterDateRange} onChange={(event) => setFilterDateRange(event.target.value as any)}>
            {dateRangeOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={viewMode}
          onChange={handleViewModeChange}
          sx={{ ml: 'auto' }}
        >
          <ToggleButton value="table">Table</ToggleButton>
          <ToggleButton value="cards">Cards</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {selectionCount > 0 && (
        <Card sx={{ mb: 3, border: '1px solid #2563EB', backgroundColor: '#EEF2FF' }}>
          <CardContent sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 600, color: '#1E3A8A' }}>
              {selectionCount} device{selectionCount === 1 ? '' : 's'} selected
            </Typography>
            <ButtonGroup size="small" variant="contained">
              <Button onClick={() => handleBulkAction('disconnect')}>Disconnect</Button>
              <Button onClick={() => handleBulkAction('reboot')}>Reboot</Button>
              <Button onClick={() => handleBulkAction('logs')}>Logs</Button>
              <Button onClick={() => handleBulkAction('pin')}>Pin</Button>
              <Button onClick={() => handleBulkAction('unpin')}>Unpin</Button>
            </ButtonGroup>
            <Button size="small" onClick={clearSelection} sx={{ textTransform: 'none' }}>
              Clear selection
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary cards removed per request */}

      <Card
        sx={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '16px',
          boxShadow: '0 1px 2px rgba(16, 24, 40, 0.06)',
        }}
      >
        <CardContent sx={{ padding: '20px 24px' }}>
          <Typography sx={{ fontSize: '16px', lineHeight: '24px', fontWeight: 600, color: '#0F172A', mb: 3 }}>
            Devices ({filteredDevices.length}
            {filteredDevices.length !== managedDevices.length ? ` / ${managedDevices.length}` : ''})
          </Typography>
          {filteredDevices.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                py: 8,
              }}
            >
              <Smartphone size={56} color="#6B7280" style={{ marginBottom: 16 }} />
              <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', mb: 1 }}>
                {managedDevices.length === 0
                  ? 'No devices recorded yet'
                  : devices.length === 0
                    ? 'No devices connected'
                    : 'No devices match this filter'}
              </Typography>
              <Typography sx={{ fontSize: '14px', color: '#6B7280', mb: 3, maxWidth: 320 }}>
                {managedDevices.length === 0
                  ? 'Connect a device once to start building its history.'
                  : devices.length === 0
                    ? 'Connect an Android device via USB and enable USB debugging.'
                    : 'Try adjusting your search or tags to see other devices.'}
              </Typography>
              <Button
                variant="contained"
                startIcon={<RefreshCw size={16} />}
                onClick={handleScanDevices}
                disabled={refreshingDevices}
                sx={{
                  height: 44,
                  borderRadius: '12px',
                  backgroundColor: '#2563EB',
                  textTransform: 'none',
                  fontWeight: 600,
                }}
              >
                {refreshingDevices ? 'Scanning...' : 'Scan Again'}
              </Button>
            </Box>
          ) : viewMode === 'table' ? (
            renderTableView()
          ) : (
            <Grid container spacing={3}>
              {filteredDevices.map((device) => renderDeviceCard(device as ManagedDevice))}
            </Grid>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(activityDialog)} onClose={closeActivityDialog} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, color: '#0F172A' }}>
          Device History - {activityDialog?.name || ''}
        </DialogTitle>
        <DialogContent dividers>
          <Stack direction="row" spacing={2} mb={2} flexWrap="wrap" rowGap={2}>
            <TextField
              label="Start date/time"
              type="datetime-local"
              size="small"
              value={exportStart}
              onChange={(e) => setExportStart(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End date/time"
              type="datetime-local"
              size="small"
              value={exportEnd}
              onChange={(e) => setExportEnd(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Search history"
              size="small"
              value={historySearch}
              onChange={(e) => {
                setHistorySearch(e.target.value);
                setHistoryPage(0);
              }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={historyTagFilter}
                displayEmpty
                onChange={(e) => {
                  setHistoryTagFilter(e.target.value);
                  setHistoryPage(0);
                }}
              >
                <MenuItem value="all">All tags</MenuItem>
                {(metadata[activityDialog?.deviceId || '']?.tags || []).map((tag) => (
                  <MenuItem key={tag} value={tag}>
                    {tag}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<FileText size={16} />}
              onClick={async () => {
                if (!activityDialog) return;
                const startTs = exportStart ? new Date(exportStart).getTime() : Number.NEGATIVE_INFINITY;
                const endTs = exportEnd ? new Date(exportEnd).getTime() : Number.POSITIVE_INFINITY;
                const filtered = filteredHistoryEvents.filter((evt) => {
                  const ts = new Date(evt.timestamp).getTime();
                  return ts >= startTs && ts <= endTs;
                });
                const body = {
                  device_alias: metadata[activityDialog.deviceId]?.alias,
                  device_tags: metadata[activityDialog.deviceId]?.tags ?? [],
                  start: exportStart || null,
                  end: exportEnd || null,
                  entries: filtered.map((evt) => ({
                    timestamp: new Date(evt.timestamp).toLocaleString(),
                    type: evt.type,
                    label: evt.label,
                    referenceId: evt.referenceId ?? '',
                    status: evt.status ?? '',
                    details: evt.details ?? '',
                  })),
                };
                try {
                  const url = resolveBaseUrl(backendUrl);
                  const encodedId = encodeURIComponent(activityDialog.deviceId);
                  const endpoints = [
                    `${url}/api/v1/devices/${encodedId}/history/export`,
                    `${url}/api/devices/${encodedId}/history/export`, // legacy prefix fallback
                  ];
                  let lastError: string | null = null;
                  for (const endpoint of endpoints) {
                    const resp = await fetchWithRetry(endpoint, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(body),
                    });
                    if (resp.ok) {
                      const blob = await resp.blob();
                      const dlUrl = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = dlUrl;
                      a.download = `device_history_${activityDialog.deviceId}.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(dlUrl);
                      return;
                    }
                    const text = await resp.text();
                    lastError = text || `HTTP ${resp.status}`;
                  }
                  throw new Error(lastError || 'Unknown error');
                } catch (err) {
                  alert(`Failed to export PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
                }
              }}
            >
              Export PDF
            </Button>
          </Stack>
          {activityDialogEvents.length === 0 ? (
            <Typography sx={{ color: '#6B7280', fontSize: '14px' }}>
              No recorded workflows or modules for this device yet.
            </Typography>
          ) : (
            <Box sx={{ position: 'relative', pl: 3 }}>
              <Box
                sx={{
                  position: 'absolute',
                  left: 6,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  backgroundColor: '#E5E7EB',
                }}
              />
              <Stack spacing={2}>
                {pagedHistoryEvents.map((event) => {
                  const statusColor = event.status === 'success' ? '#16A34A' : '#DC2626';
                  const icon = event.type === 'workflow' ? <GitBranch size={16} /> : <Play size={16} />;
                  return (
                    <Box key={event.id} sx={{ position: 'relative', pl: 2 }}>
                      <Box
                        sx={{
                          position: 'absolute',
                          left: -9,
                          top: 2,
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          backgroundColor: '#fff',
                          border: `2px solid ${statusColor}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: statusColor,
                        }}
                      >
                        {icon}
                      </Box>
                      <Typography sx={{ fontWeight: 600, color: '#0F172A' }}>
                        {event.label}{' '}
                        <Chip
                          label={event.status === 'success' ? 'Success' : 'Failed'}
                          size="small"
                          sx={{ ml: 1, backgroundColor: `${statusColor}1A`, color: statusColor, fontWeight: 600 }}
                        />
                      </Typography>
                      <Typography sx={{ fontSize: '12px', color: '#6B7280' }}>
                        {event.type === 'workflow' ? 'Workflow' : 'Module'} â€¢ {formatTimestamp(event.timestamp)}
                      </Typography>
                      {event.details ? (
                        <Typography sx={{ fontSize: '12px', color: '#475569' }}>{event.details}</Typography>
                      ) : null}
                    </Box>
                  );
                })}
                {filteredHistoryEvents.length > historyPageSize && (
                  <Box display="flex" justifyContent="space-between" alignItems="center" pt={1}>
                    <Typography variant="body2" sx={{ color: '#475569' }}>
                      Page {historyPage + 1} / {Math.ceil(filteredHistoryEvents.length / historyPageSize)}
                    </Typography>
                    <ButtonGroup size="small" variant="outlined">
                      <Button
                        onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
                        disabled={historyPage === 0}
                      >
                        Prev
                      </Button>
                      <Button
                        onClick={() =>
                          setHistoryPage((p) =>
                            p + 1 < Math.ceil(filteredHistoryEvents.length / historyPageSize) ? p + 1 : p
                          )
                        }
                        disabled={historyPage + 1 >= Math.ceil(filteredHistoryEvents.length / historyPageSize)}
                      >
                        Next
                      </Button>
                    </ButtonGroup>
                  </Box>
                )}
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeActivityDialog} sx={{ textTransform: 'none' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default DeviceManager;

