import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  IconButton,
  Snackbar,
  Alert,
  CircularProgress,
  Paper,
  Checkbox,
  Tooltip,
  Menu,
  MenuItem,
  Stack,
} from '@mui/material';
import { 
  Search,
  Grid3X3,
  Smartphone,
  RefreshCw,
  Zap,
  Puzzle,
  CheckCircle,
  Wifi,
  AlertTriangle,
  Battery,
  Square,
  CheckSquare,
  Signal,
  ChevronLeft,
  ChevronRight,
  Info,
  GitBranch,
  Play,
  Pencil
} from 'lucide-react';

import { useDevices } from '../hooks/useDevices';
import { getStoredWorkflows, WORKFLOWS_STORAGE_EVENT, StoredWorkflow } from '../utils/workflows';
import {
  readSelectedDeviceIds,
  writeSelectedDeviceIds,
  toggleSelectedDeviceId,
  SELECTED_DEVICES_EVENT,
} from '../utils/deviceSelection';
import { resolveBaseUrl, fetchWithRetry } from '../services/utils';
import { deviceApi } from '../services/deviceApi';
import { Device } from '../types';
import { MODULE_CATALOG } from '../data/modules';
import { getAllDeviceWorkflowHistories, DEVICE_HISTORY_EVENT, clearDeviceWorkflowHistory } from '../utils/deviceHistory';
import {
  readDeviceAliasMap,
  readDeviceMetadata,
  writeDeviceMetadata,
  normalizeDeviceMetadata,
  DEFAULT_DEVICE_METADATA,
  DEVICE_METADATA_EVENT,
  DEVICE_METADATA_STORAGE_KEY,
} from '../utils/deviceMetadata';
import { syncDevicesToRegistry } from '../utils/deviceRegistry';
import { dashboardTheme } from '../styles/dashboardTheme';
import { telemetry } from '../utils/telemetry';
import { APP_VERSION } from '../version';

const SEARCH_DEBOUNCE_MS = 350;
const ACTIVITY_PAGE_SIZE = 4;
const MAX_ACTIVITY_ENTRIES = 20;
const ACTIVITY_POLL_MS = 30000;
const HEALTH_POLL_MS = 20000;
const DISCONNECTED_DEVICES_STORAGE_KEY = 'dashboardDisconnectedDevices';
const ACTIVITY_CLEAR_THRESHOLD_STORAGE_KEY = 'dashboardActivityClearedAt';
const AUTO_SELECT_STORAGE_KEY = 'dashboardAutoSelectDisabled';
const tokens = dashboardTheme;
const cardBaseSx = {
  backgroundColor: tokens.colors.panel,
  border: `1px solid ${tokens.colors.border}`,
  borderRadius: `${tokens.radius}px`,
  boxShadow: tokens.shadows.card,
  transition: 'all 0.2s ease-in-out',
};
const hoverableCardSx = {
  '&:hover': {
    boxShadow: tokens.shadows.cardHover,
    transform: 'translateY(-2px)',
  },
};
const sectionTitleSx = {
  fontSize: '16px',
  lineHeight: '24px',
  fontWeight: 600,
  color: tokens.colors.text,
};
const subtextSx = {
  fontSize: '12px',
  color: tokens.colors.subtext,
};

type SearchResultItem = {
  type: string;
  id: string;
  label: string;
  href?: string;
};

type ActivityItem = {
  id: string;
  icon?: string;
  title: string;
  meta?: string;
  ts?: string | null;
};

type ExecutionRecord = {
  id?: string;
  type?: string;
  workflow_id?: string;
  workflow_name?: string;
  status?: string;
  device_id?: string;
  device_name?: string;
  started_at?: string;
  completed_at?: string | null;
};

type HealthCheck = {
  ok?: boolean;
  latency_ms?: number;
  error?: string;
};

type HealthSnapshot = {
  status?: string;
  version?: string;
  checks?: {
    adb?: HealthCheck;
    database?: HealthCheck;
  };
};

type QuickAction = {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  path: string;
};

const normalizeExecutionsPayload = (payload: unknown): ExecutionRecord[] => {
  if (Array.isArray(payload)) {
    return payload as ExecutionRecord[];
  }
  if (payload && typeof payload === 'object') {
    const record = payload as { executions?: unknown };
    if (Array.isArray(record.executions)) {
      return record.executions as ExecutionRecord[];
    }
  }
  return [];
};

const readStoredDisconnectedDevices = (): Set<string> => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(DISCONNECTED_DEVICES_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((value): value is string => typeof value === 'string'));
    }
  } catch (error) {
    console.warn('[Dashboard] Failed to read disconnected devices cache', error);
  }
  return new Set();
};

const persistDisconnectedDevices = (devices: Set<string>) => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    if (devices.size === 0) {
      window.localStorage.removeItem(DISCONNECTED_DEVICES_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        DISCONNECTED_DEVICES_STORAGE_KEY,
        JSON.stringify(Array.from(devices.values()))
      );
    }
  } catch (error) {
    console.warn('[Dashboard] Failed to persist disconnected devices cache', error);
  }
};

const readActivityClearThreshold = (): number | null => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(ACTIVITY_CLEAR_THRESHOLD_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
};

const persistActivityClearThreshold = (value: number | null): void => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    if (value === null) {
      window.localStorage.removeItem(ACTIVITY_CLEAR_THRESHOLD_STORAGE_KEY);
    } else {
      window.localStorage.setItem(ACTIVITY_CLEAR_THRESHOLD_STORAGE_KEY, String(value));
    }
  } catch (error) {
    console.warn('[Dashboard] Failed to persist activity clear threshold', error);
  }
};

const readAutoSelectDisabled = (): boolean => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(AUTO_SELECT_STORAGE_KEY) === 'true';
  } catch (error) {
    console.warn('[Dashboard] Failed to read auto-select setting', error);
    return false;
  }
};

const writeAutoSelectDisabled = (value: boolean) => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(AUTO_SELECT_STORAGE_KEY, value ? 'true' : 'false');
  } catch (error) {
    console.warn('[Dashboard] Failed to persist auto-select setting', error);
  }
};

const filterActivitiesByThreshold = (items: ActivityItem[], threshold: number | null): ActivityItem[] => {
  if (!threshold) {
    return items;
  }
  return items.filter((item) => {
    if (!item.ts) {
      return false;
    }
    const timestamp = new Date(item.ts).getTime();
    if (Number.isNaN(timestamp)) {
      return false;
    }
    return timestamp > threshold;
  });
};

const parseDisconnectedDevicesValue = (value: string | null): Set<string> => {
  if (!value) {
    return new Set();
  }
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((item): item is string => typeof item === 'string'));
    }
  } catch {
    // ignore malformed storage values
  }
  return new Set();
};

type AppMenuAction = 'about' | 'faq' | 'updates' | 'manual';
const DEFAULT_VERSION_LABEL =
  (import.meta as any).env?.VITE_APP_VERSION ||
  (import.meta as any).env?.VITE_REACT_APP_APP_VERSION ||
  (typeof process !== 'undefined' ? process.env.REACT_APP_APP_VERSION : undefined) ||
  APP_VERSION;

const buildLocalSearchResults = (
  query: string,
  devices: Device[],
  aliasMap: Record<string, string> = {}
): SearchResultItem[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  const results: SearchResultItem[] = [];

  const matchedDevices = devices
    .filter((device) => {
      const alias = aliasMap[device.id];
      const tokens = [
        alias,
        device.model,
        device.id,
        device.network_operator,
        device.network_technology,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      return tokens.some((token) => token.includes(normalized));
    })
    .slice(0, 4)
    .map((device) => {
      const alias = aliasMap[device.id];
      const baseLabel = device.model || device.id;
      const statusLabel = device.status ?? 'unknown';
      return {
        type: 'device',
        id: device.id,
        label: alias ? `${alias} - ${baseLabel} (${statusLabel})` : `${baseLabel} (${statusLabel})`,
        href: `/devices/${device.id}`,
      };
    });

  results.push(...matchedDevices);
  return results.slice(0, 8);
};

interface DashboardProps {
  backendUrl?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ backendUrl }) => {
  const { devices, status, error, refresh } = useDevices({ backendUrl, pollMs: 2000 });
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const [disconnectedDevices, setDisconnectedDevices] = useState<Set<string>>(() => readStoredDisconnectedDevices());
  const [selectedDeviceDetails, setSelectedDeviceDetails] = useState<Device | null>(null);
  const [showDeviceDetails, setShowDeviceDetails] = useState(false);
  const [workflows, setWorkflows] = useState<StoredWorkflow[]>(() => getStoredWorkflows());
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(() => readSelectedDeviceIds());
  const autoSelectDisabledRef = useRef(readAutoSelectDisabled());
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityPage, setActivityPage] = useState(0);
  const [activityViewAll, setActivityViewAll] = useState(false);
  const [activityClearThreshold, setActivityClearThreshold] = useState<number | null>(() =>
    typeof window === 'undefined' ? null : readActivityClearThreshold()
  );
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false);
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [bugReportNotes, setBugReportNotes] = useState('');
  const [bugReportSubmitting, setBugReportSubmitting] = useState(false);
  const [deviceSetupLoading, setDeviceSetupLoading] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [refreshingDevices, setRefreshingDevices] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [appMenuAnchor, setAppMenuAnchor] = useState<null | HTMLElement>(null);
  const [deviceAliases, setDeviceAliases] = useState<Record<string, string>>(() => readDeviceAliasMap());
  const [aliasEditor, setAliasEditor] = useState<{ deviceId: string; value: string; name: string } | null>(null);
  const [aliasSaving, setAliasSaving] = useState(false);
  const [activityLastUpdated, setActivityLastUpdated] = useState<number | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [healthSnapshot, setHealthSnapshot] = useState<HealthSnapshot | null>(null);
  const normalizedBackendUrl = useMemo(() => (backendUrl ? resolveBaseUrl(backendUrl) : null), [backendUrl]);

  const handleExportLogs = useCallback(async () => {
    const electronAPI = (window as typeof window & { electronAPI?: { exportLogs?: () => Promise<any>; openPath?: (targetPath: string) => Promise<any> } }).electronAPI;
    if (!electronAPI?.exportLogs) {
      setSnackbar({ severity: 'warning', message: 'Log export is only available in the desktop app.' });
      return;
    }
    try {
      const result = await electronAPI.exportLogs();
      if (result?.cancelled) {
        return;
      }
      if (result?.success && result?.path) {
        if (electronAPI.openPath) {
          await electronAPI.openPath(result.path);
        }
        setSnackbar({ severity: 'success', message: `Logs exported to ${result.path}` });
      } else {
        setSnackbar({ severity: 'error', message: result?.error || 'Failed to export logs.' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export logs.';
      setSnackbar({ severity: 'error', message });
    }
  }, []);

  const handleOpenBugReport = useCallback(() => {
    setBugReportNotes('');
    setBugReportOpen(true);
  }, []);

  const handleSubmitBugReport = useCallback(async () => {
    const electronAPI = (window as typeof window & { electronAPI?: { createBugReport?: (payload: any) => Promise<any>; openPath?: (targetPath: string) => Promise<any> } }).electronAPI;
    if (!electronAPI?.createBugReport) {
      setSnackbar({ severity: 'warning', message: 'Bug report is only available in the desktop app.' });
      return;
    }
    setBugReportSubmitting(true);
    try {
      const payload = {
        notes: bugReportNotes.trim(),
        route: location.pathname,
        selectedDeviceIds,
        backendUrl: normalizedBackendUrl ?? undefined,
      };
      const result = await electronAPI.createBugReport(payload);
      if (result?.cancelled) {
        setBugReportOpen(false);
        return;
      }
      if (result?.success && result?.path) {
        if (electronAPI.openPath) {
          await electronAPI.openPath(result.path);
        }
        setSnackbar({ severity: 'success', message: `Bug report created at ${result.path}` });
      } else {
        setSnackbar({ severity: 'error', message: result?.error || 'Failed to create bug report.' });
      }
      setBugReportOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create bug report.';
      setSnackbar({ severity: 'error', message });
    } finally {
      setBugReportSubmitting(false);
    }
  }, [bugReportNotes, location.pathname, normalizedBackendUrl, selectedDeviceIds]);

  useEffect(() => {
    syncDevicesToRegistry(devices);
  }, [devices]);

  useEffect(() => {
    telemetry.track('dashboard_viewed', { scopeId: 'default' });
  }, []);

  useEffect(() => {
    persistDisconnectedDevices(disconnectedDevices);
  }, [disconnectedDevices]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const syncAliases = () => setDeviceAliases(readDeviceAliasMap());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === DEVICE_METADATA_STORAGE_KEY) {
        syncAliases();
      }
    };
    window.addEventListener(DEVICE_METADATA_EVENT, syncAliases);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(DEVICE_METADATA_EVENT, syncAliases);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === DISCONNECTED_DEVICES_STORAGE_KEY) {
        setDisconnectedDevices(parseDisconnectedDevicesValue(event.newValue));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const searchTimeoutRef = useRef<number | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const lastSearchTrackedRef = useRef<string | null>(null);
  const activityLoadingRef = useRef(false);
  const activityHasLoadedRef = useRef(false);
  const deviceWorkflowHistories = useMemo(() => getAllDeviceWorkflowHistories(), [historyVersion]);

  const resolveApiKey = useCallback((): string | null => {
    const envKey =
      (import.meta as any).env?.VITE_API_KEY ||
      (import.meta as any).env?.VITE_REACT_APP_API_KEY ||
      (typeof process !== 'undefined' ? process.env.REACT_APP_API_KEY || process.env.API_KEY : undefined);
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('API_KEY') : null;
    return (stored && stored.trim()) || (envKey && envKey.trim()) || null;
  }, []);

  const authHeaders = useCallback((): HeadersInit => {
    const key = resolveApiKey();
    return key ? { 'X-API-Key': key } : {};
  }, [resolveApiKey]);

  const recordSearchTelemetry = useCallback((query: string, results: SearchResultItem[]) => {
    const trimmed = query.trim();
    if (!trimmed || lastSearchTrackedRef.current === trimmed) {
      return;
    }
    lastSearchTrackedRef.current = trimmed;
    telemetry.track('search_used', {
      queryLength: trimmed.length,
      resultTypeTop: results[0]?.type ?? 'none',
    });
  }, []);

  const updateSelectedDeviceIds = useCallback((updater: (prev: string[]) => string[]) => {
    setSelectedDeviceIds((prev) => {
      const next = updater(prev);
      const prevKey = prev.join(',');
      const nextKey = next.join(',');
      if (prevKey !== nextKey) {
        writeSelectedDeviceIds(next);
        return next;
      }
      return prev;
    });
  }, []);

  const persistAliasForDevice = useCallback((deviceId: string, aliasValue: string) => {
    const metadata = readDeviceMetadata();
    const current = normalizeDeviceMetadata(metadata[deviceId] ?? DEFAULT_DEVICE_METADATA);
    const nextMetadata = {
      ...metadata,
      [deviceId]: normalizeDeviceMetadata({ ...current, alias: aliasValue }),
    };
    writeDeviceMetadata(nextMetadata);
    setDeviceAliases((prev) => {
      const next = { ...prev };
      const trimmed = aliasValue.trim();
      if (trimmed) {
        next[deviceId] = trimmed;
      } else {
        delete next[deviceId];
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const syncWorkflows = () => setWorkflows(getStoredWorkflows());
    syncWorkflows();
    window.addEventListener(WORKFLOWS_STORAGE_EVENT, syncWorkflows);
    return () => {
      window.removeEventListener(WORKFLOWS_STORAGE_EVENT, syncWorkflows);
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<string[]>;
      if (Array.isArray(custom.detail)) {
        setSelectedDeviceIds((prev) => {
          const prevKey = prev.join(',');
          const nextKey = custom.detail.join(',');
          return prevKey === nextKey ? prev : custom.detail;
        });
      } else {
        setSelectedDeviceIds(readSelectedDeviceIds());
      }
    };
    window.addEventListener(SELECTED_DEVICES_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(SELECTED_DEVICES_EVENT, handler as EventListener);
    };
  }, []);

  useEffect(() => {
    const handleHistoryUpdate = () => {
      setHistoryVersion((prev) => prev + 1);
    };
    window.addEventListener(DEVICE_HISTORY_EVENT, handleHistoryUpdate);
    return () => {
      window.removeEventListener(DEVICE_HISTORY_EVENT, handleHistoryUpdate);
    };
  }, []);

  const mapActivityItems = (items: any[]): ActivityItem[] =>
    (Array.isArray(items) ? items : []).map((item, index) => {
      const ts = item?.ts ?? null;
      return {
        id: item?.id ?? `activity-${index}`,
        icon: item?.icon ?? 'info',
        title: item?.title ?? 'Workflow update',
        ts,
        meta: item?.meta ?? (ts ? formatRelativeTime(ts) : undefined),
      };
    });

  const mapExecutionActivityItems = (executions: ExecutionRecord[]): ActivityItem[] => {
    const iconForStatus = (status: string) => {
      const normalized = (status || '').toLowerCase();
      if (normalized === 'completed' || normalized === 'success') {
        return 'check';
      }
      if (normalized === 'failed' || normalized === 'error') {
        return 'warning';
      }
      if (normalized === 'cancelled') {
        return 'ban';
      }
      return 'loader';
    };

    return (Array.isArray(executions) ? executions : [])
      .map((execution, index) => {
        const status = execution?.status ?? 'completed';
        const flowName = execution?.workflow_name || execution?.workflow_id || 'Workflow';
        const devicePart = execution?.device_id ? ` on ${execution.device_id}` : '';
        const ts = execution?.completed_at || execution?.started_at || null;
        return {
          id: execution?.execution_id ?? execution?.id ?? `exec-${index}`,
          icon: iconForStatus(status),
          title: `${flowName} ${String(status).toLowerCase()}${devicePart}`,
          ts,
          meta: ts ? formatRelativeTime(ts) : undefined,
        };
      })
      .sort((a, b) => {
        const aTime = a.ts ? new Date(a.ts).getTime() : 0;
        const bTime = b.ts ? new Date(b.ts).getTime() : 0;
        return bTime - aTime;
      });
  };


  const buildLocalActivityItems = useCallback((): ActivityItem[] => {
    const entries: ActivityItem[] = [];

    Object.entries(deviceWorkflowHistories).forEach(([deviceId, history]) => {
      history.forEach((run, index) => {
        if (!run.executedAt) {
          return;
        }
        const activityId = `history-${deviceId}-${index}-${run.executedAt}`;
        entries.push({
          id: activityId,
          icon: 'check',
          title: `${run.workflowName || 'Workflow'} on ${deviceId}`,
          ts: run.executedAt,
          meta: formatRelativeTime(run.executedAt),
        });
      });
    });

    workflows.forEach((workflow) => {
      if (!workflow.lastRunAt) {
        return;
      }
      entries.push({
        id: `workflow-${workflow.id}-${workflow.lastRunAt}`,
        icon: 'info',
        title: `${workflow.name} executed`,
        ts: workflow.lastRunAt,
        meta: formatRelativeTime(workflow.lastRunAt),
      });
    });

    entries.sort((a, b) => {
      const aTime = a.ts ? new Date(a.ts).getTime() : 0;
      const bTime = b.ts ? new Date(b.ts).getTime() : 0;
      return bTime - aTime;
    });

    return entries;
  }, [deviceWorkflowHistories, workflows]);

  const loadActivities = useCallback(
    async (signal?: AbortSignal) => {
      if (activityLoadingRef.current) {
        return;
      }
      activityLoadingRef.current = true;
      setActivityLoading(true);
      setActivityError(null);
      let nextItems: ActivityItem[] | null = null;
      let usedRemote = false;

      const fetchRecentActivity = async (): Promise<ActivityItem[] | null> => {
        if (!normalizedBackendUrl) {
          return null;
        }
        try {
          const response = await fetchWithRetry(`${normalizedBackendUrl}/api/dashboard/activity/recent`, {
            signal,
            headers: authHeaders(),
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const data = await response.json();
          return mapActivityItems(data.items || []);
        } catch (error) {
          if (!signal?.aborted) {
            console.warn('[Dashboard] Failed to fetch /activity/recent', error);
          }
        }
        return null;
      };

    const fetchExecutionActivity = async (): Promise<ActivityItem[] | null> => {
      if (!normalizedBackendUrl) {
        return null;
      }
      try {
        const response = await fetchWithRetry(`${normalizedBackendUrl}/api/v1/executions`, {
          signal,
          headers: authHeaders(),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return mapExecutionActivityItems(normalizeExecutionsPayload(data));
      } catch (error) {
        if (!signal?.aborted) {
          console.warn('[Dashboard] Failed to fetch executions for activity', error);
        }
      }
      return null;
      };

      if (normalizedBackendUrl) {
        usedRemote = true;
        nextItems = await fetchRecentActivity();
        if ((!nextItems || nextItems.length === 0) && !signal?.aborted) {
          nextItems = await fetchExecutionActivity();
        }
      }

      if ((!nextItems || nextItems.length === 0) && !signal?.aborted) {
        nextItems = buildLocalActivityItems();
        if (usedRemote) {
          setActivityError('Using local activity cache');
        }
      }

      if (!signal?.aborted) {
        const filteredItems = filterActivitiesByThreshold(nextItems ?? [], activityClearThreshold);
        const limitedItems =
          filteredItems.length > MAX_ACTIVITY_ENTRIES
            ? filteredItems.slice(0, MAX_ACTIVITY_ENTRIES)
            : filteredItems;
        setActivityItems(limitedItems);
        if (!activityHasLoadedRef.current) {
          setActivityPage(0);
          setActivityViewAll(false);
          activityHasLoadedRef.current = true;
        }
        setActivityLastUpdated(Date.now());
        setActivityLoading(false);
      }
      activityLoadingRef.current = false;
    },
    [normalizedBackendUrl, buildLocalActivityItems, activityClearThreshold, authHeaders]
  );

  useEffect(() => {
    if (!normalizedBackendUrl) {
      loadActivities();
      return;
    }
    const controller = new AbortController();
    loadActivities(controller.signal);
    const intervalId = window.setInterval(() => {
      loadActivities(controller.signal);
    }, ACTIVITY_POLL_MS);
    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [normalizedBackendUrl, loadActivities]);

  useEffect(() => {
    if (activityViewAll) {
      return;
    }
    setActivityPage((prev) => {
      const maxPage = Math.max(0, Math.ceil(activityItems.length / ACTIVITY_PAGE_SIZE) - 1);
      return prev > maxPage ? maxPage : prev;
    });
  }, [activityItems.length, activityViewAll]);

  const loadHealth = useCallback(
    async (signal?: AbortSignal) => {
      if (!normalizedBackendUrl) {
        return;
      }
      try {
        const response = await fetchWithRetry(
          `${normalizedBackendUrl}/api/health/`,
          { signal, headers: authHeaders() },
          { retries: 1, backoffMs: 300 }
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        setHealthSnapshot(data);
      } catch (error) {
        if (!signal?.aborted) {
          console.warn('[Dashboard] Failed to fetch /health', error);
        }
      }
    },
    [normalizedBackendUrl, authHeaders]
  );

  useEffect(() => {
    if (!normalizedBackendUrl) {
      setHealthSnapshot(null);
      return;
    }
    const controller = new AbortController();
    loadHealth(controller.signal);
    const intervalId = window.setInterval(() => {
      loadHealth(controller.signal);
    }, HEALTH_POLL_MS);
    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [normalizedBackendUrl, loadHealth]);


  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      if (!searchContainerRef.current) {
        return;
      }
      if (!searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickAway);
    return () => document.removeEventListener('mousedown', handleClickAway);
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current !== null) {
      window.clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
      searchAbortRef.current = null;
    }

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setShowSearchResults(false);
      setSearchLoading(false);
      lastSearchTrackedRef.current = null;
      return;
    }

    setShowSearchResults(true);

    if (!normalizedBackendUrl) {
      setSearchLoading(false);
      const localResults = buildLocalSearchResults(trimmed, devices, deviceAliases);
      setSearchResults(localResults);
      recordSearchTelemetry(trimmed, localResults);
      return;
    }

    setSearchLoading(true);
    const controller = new AbortController();
    searchAbortRef.current = controller;

    searchTimeoutRef.current = window.setTimeout(async () => {
      try {
        const response = await fetchWithRetry(
          `${normalizedBackendUrl}/api/dashboard/search?q=${encodeURIComponent(trimmed)}&limit=8`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const rawResults: SearchResultItem[] = Array.isArray(data.results) ? data.results : [];
        const deviceResults = rawResults.filter((item) => (item?.type ?? 'device') === 'device');
        if (deviceResults.length > 0) {
          setSearchResults(deviceResults);
          recordSearchTelemetry(trimmed, deviceResults);
        } else {
          const localResults = buildLocalSearchResults(trimmed, devices, deviceAliases);
          setSearchResults(localResults);
          recordSearchTelemetry(trimmed, localResults);
        }
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        console.warn('[Dashboard] Search failed, falling back to local results', err);
        const localResults = buildLocalSearchResults(trimmed, devices, deviceAliases);
        setSearchResults(localResults);
        recordSearchTelemetry(trimmed, localResults);
      } finally {
        if (!controller.signal.aborted) {
          setSearchLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      if (searchTimeoutRef.current !== null) {
        window.clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
    };
  }, [searchQuery, normalizedBackendUrl, devices, recordSearchTelemetry, deviceAliases]);

  const normalizeStatus = (status?: string) => (status ? status.toLowerCase() : 'unknown');
  const connectedStatuses = ['connected', 'online', 'busy'];
  const idleStatuses = ['idle'];

  const sanitizeOperatorValue = (value?: string | null): string | null => {
    if (!value) {
      return null;
    }
    const trimmed = String(value).trim();
    if (!trimmed || trimmed.toLowerCase() === 'unknown') {
      return null;
    }
    if (
      trimmed.includes('NetworkRegistrationInfo') ||
      trimmed.includes('mOperatorAlphaShort') ||
      trimmed.startsWith('null')
    ) {
      return null;
    }
    const firstSegment = trimmed.split(',')[0].trim();
    if (!firstSegment || firstSegment.toLowerCase() === 'null') {
      return null;
    }
    return firstSegment;
  };

  const resolveOperatorLabel = (device: Device) => {
    if (device.airplane_mode) {
      return 'Unknown';
    }
    const candidates = [device.network_operator_live, device.network_operator, device.carrier, device?.sim_info?.carrier];
    for (const candidate of candidates) {
      const sanitized = sanitizeOperatorValue(candidate);
      if (sanitized) {
        return sanitized;
      }
    }
    return 'Not detected';
  };
  const stableOperatorCache = useRef<Record<string, string>>({});
  const resolveStableOperatorLabel = useCallback(
    (device: Device) => {
      if (device.airplane_mode) {
        return 'Unknown';
      }
      const current = resolveOperatorLabel(device);
      if (current && current !== 'Unknown' && current !== 'Not detected') {
        stableOperatorCache.current[device.id] = current;
        return current;
      }
      const cached = stableOperatorCache.current[device.id];
      return cached ?? current;
    },
    [resolveOperatorLabel]
  );

  const resolveSimSlotLines = (device: Device): string[] | null => {
    if (!device.sim_slots || device.sim_slots.length === 0) {
      return null;
    }
    return device.sim_slots.map((slot, index) => {
      const slotIndex = slot.slot_index ?? index;
      const slotName = `SIM${slotIndex + 1}`;
      const operator = device.airplane_mode
        ? 'Unknown'
        : sanitizeOperatorValue(slot.operator) || slot.operator_numeric || 'Unknown';
      const tech = device.airplane_mode
        ? 'Unknown'
        : slot.network_technology
          ? formatNetworkTechnology(slot.network_technology)
          : null;
      return tech ? `${slotName}: ${operator} - ${tech}` : `${slotName}: ${operator}`;
    });
  };

  const resolveNetworkTechnologyLabel = (device: Device): string => {
    if (device.airplane_mode) {
      return 'Unknown';
    }
    if (device.network_technology) {
      return formatNetworkTechnology(device.network_technology);
    }
    if (device.sim_slots && device.sim_slots.length > 0) {
      const slotTech = device.sim_slots
        .map((slot) => slot.network_technology)
        .find((value) => typeof value === 'string' && value.trim().length > 0);
      if (slotTech) {
        return formatNetworkTechnology(slotTech);
      }
    }
    return 'Unknown';
  };

  const formatNetworkTechnology = (value?: string | null): string => {
    if (!value) {
      return 'Unknown';
    }

    const normalized = value.toLowerCase();
    const mapping: Record<string, string> = {
      lte: '4G',
      'lte-ca': '4G+',
      gsm: '2G',
      gprs: '2G',
      edge: '2G',
      'cdma-evdo': '3G',
      evdo: '3G',
      evdo0: '3G',
      evdoa: '3G',
      evdob: '3G',
      e_hrpd: '3G',
      umts: '3G',
      wcdma: '3G',
      hspa: '3G',
      hsupa: '3G',
      hsupa_: '3G',
      hsdpa: '3G',
      hspap: '3G',
      tdscdma: '3G',
      nr: '5G',
      'nr-nsa': '5G',
      'nr-sa': '5G',
      'nr/mmwave': '5G',
    };

    const alias = mapping[normalized];
    if (alias) {
      return `${alias} (${value.toUpperCase()})`;
    }

    if (/^(2g|3g|4g|5g|6g)$/i.test(value)) {
      return value.toUpperCase();
    }

    return value.toUpperCase();
  };

  const activityTotalPages = useMemo(() => {
    const pages = Math.ceil(activityItems.length / ACTIVITY_PAGE_SIZE);
    return Math.max(1, pages || 0);
  }, [activityItems.length]);

  const displayedActivityItems = useMemo(() => {
    if (activityViewAll) {
      return activityItems;
    }
    const start = activityPage * ACTIVITY_PAGE_SIZE;
    return activityItems.slice(start, start + ACTIVITY_PAGE_SIZE);
  }, [activityItems, activityPage, activityViewAll]);

  const canGoPrevActivity = !activityViewAll && activityPage > 0;
  const canGoNextActivity =
    !activityViewAll && (activityPage + 1) * ACTIVITY_PAGE_SIZE < activityItems.length;
  const activityPageStart = activityPage * ACTIVITY_PAGE_SIZE;
  const activityPageEnd = Math.min(activityItems.length, activityPageStart + ACTIVITY_PAGE_SIZE);
  const activityPageCount = Math.max(0, activityPageEnd - activityPageStart);

  const orderedDevices = useMemo(() => {
    const statusRank = (status?: string) => {
      const normalized = normalizeStatus(status);
      if (connectedStatuses.includes(normalized)) return 0;
      if (idleStatuses.includes(normalized)) return 1;
      return 2;
    };
    return [...devices].sort((a, b) => {
      const diff = statusRank(a.status) - statusRank(b.status);
      if (diff !== 0) {
        return diff;
      }
      const aTime = a.last_seen ? new Date(a.last_seen).getTime() : 0;
      const bTime = b.last_seen ? new Date(b.last_seen).getTime() : 0;
      if (aTime !== bTime) {
        return bTime - aTime;
      }
      return a.id.localeCompare(b.id);
    });
  }, [devices]);

  const visibleDevices = useMemo(
    () =>
      orderedDevices.filter((device) => {
        const normalizedStatusValue = normalizeStatus(device.status);
        return connectedStatuses.includes(normalizedStatusValue) || idleStatuses.includes(normalizedStatusValue);
      }),
    [orderedDevices]
  );

  const setupCandidates = useMemo<Device[]>(
    () => devices.filter((device) => device.requires_setup === true),
    [devices]
  );

  const handleAddDevicesClick = () => {
    telemetry.track('add_devices_clicked', {
      requiresSetup: setupCandidates.length,
    });
    setSetupDialogOpen(true);
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredDevices = visibleDevices.filter((device) => {
    if (!normalizedSearch) {
      return true;
    }
    const alias = deviceAliases[device.id]?.toLowerCase() ?? '';
    return (
      alias.includes(normalizedSearch) ||
      device.model?.toLowerCase().includes(normalizedSearch) ||
      device.id?.toLowerCase().includes(normalizedSearch)
    );
  });

  const readyDevices = useMemo(
    () => visibleDevices.filter((device) => !disconnectedDevices.has(device.id)),
    [visibleDevices, disconnectedDevices]
  );
  const readyDeviceIds = useMemo(() => readyDevices.map((device) => device.id), [readyDevices]);

  const selectedDeviceIdsSet = useMemo(() => new Set(selectedDeviceIds), [selectedDeviceIds]);
  const visibleDeviceIds = useMemo(() => visibleDevices.map((device) => device.id), [visibleDevices]);
  const allVisibleSelected =
    visibleDeviceIds.length > 0 && visibleDeviceIds.every((id) => selectedDeviceIdsSet.has(id));
  const partiallySelected =
    visibleDeviceIds.some((id) => selectedDeviceIdsSet.has(id)) && !allVisibleSelected;

  const handleToggleSelectAllVisible = () => {
    updateSelectedDeviceIds((prev) => {
      let nextIds = prev;
      if (visibleDeviceIds.length === 0) {
        return prev;
      }
      if (allVisibleSelected) {
        const visibleSet = new Set(visibleDeviceIds);
        nextIds = prev.filter((id) => !visibleSet.has(id));
      } else {
        const nextSet = new Set(prev);
        visibleDeviceIds.forEach((id) => nextSet.add(id));
        nextIds = Array.from(nextSet);
      }
      const disableAutoSelect = nextIds.length === 0;
      autoSelectDisabledRef.current = disableAutoSelect;
      writeAutoSelectDisabled(disableAutoSelect);
      return nextIds;
    });
  };
  const handleClearSelection = () => {
    autoSelectDisabledRef.current = true;
    writeAutoSelectDisabled(true);
    updateSelectedDeviceIds(() => []);
  };

  const formatRelativeTime = (value?: string | number | Date | null): string => {
    if (!value) {
      return 'Just now';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Just now';
    }
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) {
      return seconds <= 1 ? 'Just now' : `${seconds} seconds ago`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    }
    const days = Math.floor(hours / 24);
    if (days < 7) {
      return days === 1 ? '1 day ago' : `${days} days ago`;
    }
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  };

  const activeDevicesCount = readyDevices.filter((device) =>
    connectedStatuses.includes(normalizeStatus(device.status))
  ).length;
  const totalVisibleDevices = visibleDevices.length;
  const workflowsActiveCount = workflows.filter((workflow) => workflow.runCount > 0).length;
  const workflowsDraftCount = workflows.length - workflowsActiveCount;
  const workflowExecutionCount = workflows.reduce((total, workflow) => total + (workflow.runCount || 0), 0);
  const appVersion = useMemo(() => {
    const fromHealth = healthSnapshot?.version?.trim();
    if (fromHealth) {
      return fromHealth;
    }
    return DEFAULT_VERSION_LABEL || null;
  }, [healthSnapshot?.version]);
  const versionLabel = appVersion ? `v${appVersion}` : 'development build';
  const activityUpdatedLabel = activityLastUpdated
    ? `Updated ${formatRelativeTime(activityLastUpdated)}`
    : 'Not updated yet';

  const handleDisconnect = async (device: Device) => {
    const isDisconnected = disconnectedDevices.has(device.id);
    if (isDisconnected) {
      setDisconnectedDevices((prev) => {
        const next = new Set(prev);
        next.delete(device.id);
        return next;
      });
      setSnackbar({ severity: 'info', message: `${device.model || device.id} reconnected.` });
      if (backendUrl) {
        deviceApi.scanDevices(backendUrl).catch((err) => {
          console.warn('[Dashboard] Failed to rescan devices after reconnect', err);
        });
      }
      return;
    }

    setDisconnectedDevices((prev) => new Set(prev).add(device.id));
    updateSelectedDeviceIds((prev) => prev.filter((id) => id !== device.id));

    if (backendUrl) {
      try {
        const response = await deviceApi.disconnectDevice(device.id, backendUrl);
        setSnackbar({
          severity: response.success ? 'success' : 'error',
          message: response.message || `Disconnect request ${response.success ? 'sent' : 'failed'}.`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error while disconnecting device.';
        setSnackbar({ severity: 'error', message });
      }
    } else {
      setSnackbar({ severity: 'info', message: `${device.model || device.id} marked as disconnected locally.` });
    }
  };

  const handleToggleDeviceSelection = (device: Device) => {
    if (disconnectedDevices.has(device.id)) {
      setSnackbar({ severity: 'error', message: 'Reconnect the device before using it for tests.' });
      return;
    }
    updateSelectedDeviceIds((prev) => {
      const next = toggleSelectedDeviceId(prev, device.id);
      const disableAutoSelect = next.length === 0;
      autoSelectDisabledRef.current = disableAutoSelect;
      writeAutoSelectDisabled(disableAutoSelect);
      return next;
    });
  };

  useEffect(() => {
    if (status !== 'success') {
      return;
    }

    const readySet = new Set(readyDeviceIds);
    if (selectedDeviceIds.length > 0) {
      const filteredSelection = selectedDeviceIds.filter((id) => readySet.has(id));
      if (filteredSelection.length !== selectedDeviceIds.length) {
        const removedCount = selectedDeviceIds.length - filteredSelection.length;
        setSnackbar({
          severity: filteredSelection.length === 0 ? 'warning' : 'info',
          message:
            filteredSelection.length === 0
              ? 'Active device disconnected. Selection cleared.'
              : `Removed ${removedCount} disconnected device${removedCount > 1 ? 's' : ''} from the selection.`,
        });
        updateSelectedDeviceIds(() => filteredSelection);
        return;
      }
    }

    if (!autoSelectDisabledRef.current && selectedDeviceIds.length === 0 && readyDeviceIds.length === 1) {
      const autoId = readyDeviceIds[0];
      const device = readyDevices.find((entry) => entry.id === autoId);
      if (device) {
        setSnackbar({
          severity: 'info',
          message: `${device.model || device.id} automatically selected as the active device.`,
        });
      }
      updateSelectedDeviceIds(() => [autoId]);
    }
  }, [readyDeviceIds, readyDevices, selectedDeviceIds, status, updateSelectedDeviceIds]);

  const handleShowDetails = (device: Device) => {
    setSelectedDeviceDetails(device);
    setShowDeviceDetails(true);
  };

  const handleConfigureDevice = async (device: Device) => {
    if (!normalizedBackendUrl) {
      setSnackbar({
        severity: 'error',
        message: 'Backend is required to configure devices automatically.',
      });
      return;
    }
    setDeviceSetupLoading(device.id);
    try {
      const response = await deviceApi.configureDevice(device.id, backendUrl);
      setSnackbar({
        severity: response.success ? 'success' : 'error',
        message: response.message || (response.success ? 'Device configured.' : 'Configuration failed.'),
      });
      await refresh();
    } catch (err) {
      if (err instanceof Error) {
        setSnackbar({ severity: 'error', message: err.message });
      } else {
        setSnackbar({ severity: 'error', message: 'Unexpected error while configuring device.' });
      }
    } finally {
      setDeviceSetupLoading(null);
    }
  };

  const handleViewAllActivity = () => {
    if (activityItems.length === 0) {
      return;
    }
    setActivityViewAll((prev) => {
      const next = !prev;
      if (!next) {
        setActivityPage(0);
      }
      return next;
    });
  };

  const handleClearActivity = () => {
    if (activityItems.length === 0 && !activityLoading) {
      return;
    }
    const clearedAt = Date.now();
    setActivityItems([]);
    setActivityPage(0);
    setActivityViewAll(false);
    setActivityClearThreshold(clearedAt);
    persistActivityClearThreshold(clearedAt);
    clearDeviceWorkflowHistory();
    setSnackbar({ severity: 'info', message: 'Recent activity cleared.' });
    telemetry.track('dashboard_activity_cleared', { scopeId: 'default' });
  };

  const handleRefreshActivity = useCallback(() => {
    loadActivities();
  }, [loadActivities]);

  const handleNextActivityPage = () => {
    setActivityPage((prev) => Math.min(prev + 1, activityTotalPages - 1));
  };

  const handlePrevActivityPage = () => {
    setActivityPage((prev) => Math.max(prev - 1, 0));
  };

  const handleOpenAppMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAppMenuAnchor(event.currentTarget);
  };

  const handleCloseAppMenu = () => setAppMenuAnchor(null);

  const handleAppMenuSelect = (action: AppMenuAction) => {
    handleCloseAppMenu();
    if (action === 'about') {
      setAboutDialogOpen(true);
      return;
    }

    const resourceLinks: Record<Exclude<AppMenuAction, 'about'>, string> = {
      faq: 'https://github.com/Specpapers/ADB-automation-tool/wiki/FAQ',
      updates: 'https://github.com/Specpapers/ADB-automation-tool/releases',
      manual: 'https://github.com/Specpapers/ADB-automation-tool/wiki/User-Manual',
    };

    if (action === 'updates') {
      setSnackbar({ severity: 'info', message: 'Opening the releases page in a new tab.' });
    }

    const target = resourceLinks[action];
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  const describeSetupRequirements = (device: Device): string => {
    const reasons: string[] = [];
    if (device.developer_mode_enabled === false) {
      reasons.push('Enable developer options');
    }
    if (device.usb_debugging_enabled === false) {
      reasons.push('Enable USB debugging');
    }
    const statusHints = [
      device.raw_status,
      device.raw_adb_status,
      device.adb_status,
      device.status,
    ]
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.toLowerCase());

    if (statusHints.some((value) => value.includes('unauthorized'))) {
      reasons.push('Authorize this computer');
    }
    if (statusHints.some((value) => value.includes('offline'))) {
      reasons.push('Reconnect the device');
    }
    return reasons.length > 0 ? reasons.join(' - ') : 'Device not ready';
  };

  const formatBatteryLevel = (value: Device['battery_level']) => {
    if (value === null || value === undefined || value === '') {
      return 'N/A';
    }
    if (typeof value === 'number') {
      return `${value}%`;
    }
    const text = String(value);
    return text.endsWith('%') ? text : `${text}%`;
  };

  const formatAndroidVersion = (device: Device) => {
    return device.android_version || device.os_version || 'Unknown';
  };

  const formatLastSeen = (value: Device['last_seen']) => {
    if (!value) {
      return 'Unknown';
    }
    const normalized = String(value).trim();
    if (!normalized || normalized.toLowerCase() === 'invalid date') {
      return 'Unknown';
    }
    if (normalized.toLowerCase() === 'now') {
      return new Date().toLocaleString(undefined, { timeZoneName: 'short' });
    }
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString(undefined, { timeZoneName: 'short' });
    }
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) {
      const numericDate = new Date(numeric);
      if (!Number.isNaN(numericDate.getTime())) {
        return numericDate.toLocaleString(undefined, { timeZoneName: 'short' });
      }
    }
    return `${normalized} UTC`;
  };

  const parseBatteryLevel = (value: Device['battery_level']): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.min(100, Math.round(value)));
    }
    if (typeof value === 'string') {
      const numeric = parseInt(value.replace('%', '').trim(), 10);
      if (Number.isFinite(numeric)) {
        return Math.max(0, Math.min(100, numeric));
      }
    }
    return null;
  };

  const batteryStats = useMemo(() => {
    const readings = devices
      .map((device) => {
        const level = parseBatteryLevel(device.battery_level);
        return level === null ? null : { device, level };
      })
      .filter(Boolean) as { device: Device; level: number }[];

    if (readings.length === 0) {
      return { average: null as number | null, count: 0, lowest: [] as { device: Device; level: number }[] };
    }

    const average = Math.round(
      readings.reduce((total, entry) => total + entry.level, 0) / readings.length
    );
    const lowest = [...readings].sort((a, b) => a.level - b.level).slice(0, 3);
    return { average, count: readings.length, lowest };
  }, [devices]);

  const handleManualRefresh = async (origin: 'header' | 'empty' = 'header') => {
    if (refreshingDevices) {
      return;
    }
    telemetry.track('scan_again_clicked', {
      origin,
      deviceCount: devices.length,
    });
    setRefreshingDevices(true);
    try {
      if (backendUrl) {
        await deviceApi.scanDevices(backendUrl);
      }
      await refresh();
      setSnackbar({ severity: 'success', message: 'Devices synchronized with the backend.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh devices.';
      setSnackbar({ severity: 'error', message });
    } finally {
      setRefreshingDevices(false);
    }
  };

  const renderActivityIcon = (item: ActivityItem) => {
    switch (item.icon) {
      case 'check':
        return <CheckCircle size={20} />;
      case 'warning':
        return <AlertTriangle size={20} />;
      case 'loader':
        return <RefreshCw size={20} />;
      case 'info':
      default:
        return <Wifi size={20} />;
    }
  };

  const handleSearchResultClick = (item: SearchResultItem) => {
    setShowSearchResults(false);
    if (item.type === 'device') {
      const target = devices.find((device) => device.id === item.id);
      if (target) {
        handleShowDetails(target);
      }
    }
    if (item.href) {
      navigate(item.href);
    }
  };

  const quickActions: QuickAction[] = useMemo(
    () => [
      {
        icon: <Play size={16} />,
        label: `Quick Test (${selectedDeviceIds.length} selected)`,
        active: selectedDeviceIds.length > 0,
        path: '/modules',
      },
      { icon: <GitBranch size={16} />, label: 'Workflows', active: false, path: '/workflows' },
      { icon: <Puzzle size={16} />, label: 'Modules', active: false, path: '/modules' },
    ],
    [selectedDeviceIds.length]
  );

  const openAliasEditor = useCallback(
    (device: Device) => {
      setAliasEditor({
        deviceId: device.id,
        value: deviceAliases[device.id] ?? '',
        name: deviceAliases[device.id] || device.model || device.id,
      });
    },
    [deviceAliases]
  );

  const handleAliasDialogClose = useCallback(() => {
    if (!aliasSaving) {
      setAliasEditor(null);
    }
  }, [aliasSaving]);

  const handleAliasSave = useCallback(() => {
    if (!aliasEditor) {
      return;
    }
    const trimmed = aliasEditor.value.trim();
    setAliasSaving(true);
    try {
      persistAliasForDevice(aliasEditor.deviceId, trimmed);
      setSnackbar({
        severity: 'success',
        message: trimmed ? `Alias saved for ${aliasEditor.name}.` : `Alias removed for ${aliasEditor.name}.`,
      });
      setAliasEditor(null);
    } catch (error) {
      console.warn('[Dashboard] Failed to persist alias', error);
      setSnackbar({ severity: 'error', message: 'Unable to save alias. Please try again.' });
    } finally {
      setAliasSaving(false);
    }
  }, [aliasEditor, persistAliasForDevice]);

  const handleAliasInputChange = useCallback((value: string) => {
    setAliasEditor((prev) => (prev ? { ...prev, value } : prev));
  }, []);

  return (
    <Box sx={{ 
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: tokens.colors.bg,
      fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Sidebar */}
      <Box sx={{
        width: 280,
        background: 'linear-gradient(180deg, #0D1B2A 0%, #152238 100%)',
        padding: '16px 12px',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        height: '100vh'
      }}>
        {/* Brand */}
        <Box
          sx={{
            mb: 4,
            pb: 2.5,
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0EA5E9 0%, #22D3EE 100%)',
                boxShadow: '0 10px 18px rgba(14, 165, 233, 0.3)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '6px',
                  border: '2px solid rgba(255, 255, 255, 0.85)',
                  boxShadow: '0 0 10px rgba(255, 255, 255, 0.35)',
                }}
              />
            </Box>
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  fontSize: '18px',
                  lineHeight: '22px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#F8FAFC',
                }}
              >
                MOBIQ
              </Typography>
              <Box
                sx={{
                  width: 36,
                  height: 3,
                  borderRadius: 999,
                  background: 'linear-gradient(90deg, #38BDF8 0%, #0EA5E9 100%)',
                  opacity: 0.9,
                  mt: 0.4,
                }}
              />
            </Box>
          </Box>
          <Typography
            variant="caption"
            sx={{
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            The Future of Telecom Automation
          </Typography>
        </Box>

        {/* Navigation */}
        <Box sx={{ flex: 1 }}>
          {[
            { label: 'Dashboard', icon: <Grid3X3 size={20} />, path: '/dashboard' },
            { label: 'Modules', icon: <Puzzle size={20} />, path: '/modules' },
            { label: 'Workflows', icon: <Zap size={20} />, path: '/workflows' },
            { label: 'Device Manager', icon: <Smartphone size={20} />, path: '/devices' }
          ].map((item, index) => {
            const isActive = location.pathname === item.path;
            return (
              <Box
                key={index}
                onClick={() => navigate(item.path)}
                sx={{
                  height: 48,
                  borderRadius: '12px',
                  padding: '0 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  mb: 1,
                  cursor: 'pointer',
                  backgroundColor: isActive ? '#1E3A8A' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#D1D5DB',
                  '&:hover': {
                    backgroundColor: isActive ? '#1E3A8A' : '#11253F',
                    color: isActive ? '#FFFFFF' : '#E5E7EB'
                  }
                }}
              >
                <Box sx={{ color: isActive ? '#FFFFFF' : '#93C5FD' }}>
                  {item.icon}
                </Box>
                <Typography sx={{ 
                  fontSize: '14px',
                  fontWeight: 500
                }}>
                  {item.label}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* Footer */}
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            <Chip 
              label={`MOBIQ ${versionLabel}`}
              size="small"
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '11px'
              }}
            />
            <IconButton
              size="small"
              onClick={handleOpenAppMenu}
              sx={{ color: 'rgba(255, 255, 255, 0.8)' }}
            >
              <Info size={16} />
            </IconButton>
          </Box>
          <Menu
            anchorEl={appMenuAnchor}
            open={Boolean(appMenuAnchor)}
            onClose={handleCloseAppMenu}
            anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          >
            <MenuItem onClick={() => handleAppMenuSelect('about')}>About</MenuItem>
            <MenuItem onClick={() => handleAppMenuSelect('faq')}>FAQ</MenuItem>
            <MenuItem onClick={() => handleAppMenuSelect('updates')}>Check for updates</MenuItem>
            <MenuItem onClick={() => handleAppMenuSelect('manual')}>User manual</MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ 
        flex: 1,
        padding: '24px 28px',
        maxWidth: 1320,
        margin: '0 auto'
      }}>
        {/* Header */}
        <Box sx={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 4
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                height: 48,
                width: 48,
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #0F172A 0%, #0EA5E9 50%, #7C3AED 100%)',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 10px 30px rgba(14, 165, 233, 0.28)',
              }}
            >
              <Grid3X3 size={22} color="#FFFFFF" />
            </Box>
            <Typography
              variant="h1"
              sx={{
                fontSize: '28px',
                lineHeight: '36px',
                fontWeight: 800,
                color: '#0F172A',
                letterSpacing: '-0.01em',
              }}
            >
              Dashboard
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box ref={searchContainerRef} sx={{ position: 'relative', width: 460 }}>
              <TextField
                placeholder="Search devices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.trim() && setShowSearchResults(true)}
                sx={{
                  width: '100%',
                  '& .MuiOutlinedInput-root': {
                    height: 40,
                    borderRadius: '10px',
                    '& fieldset': {
                      borderColor: '#E5E7EB'
                    }
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={20} color="#6B7280" />
                    </InputAdornment>
                  )
                }}
              />
              {showSearchResults && (
                <Paper
                  elevation={3}
                  sx={{
                    position: 'absolute',
                    top: 44,
                    left: 0,
                    right: 0,
                    borderRadius: '12px',
                    overflow: 'hidden',
                    zIndex: 20,
                    maxHeight: 320,
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  {searchLoading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, padding: '12px 16px' }}>
                      <CircularProgress size={18} />
                      <Typography sx={{ fontSize: '14px', color: '#475569' }}>Searching...</Typography>
                    </Box>
                  ) : searchResults.length === 0 ? (
                    <Box sx={{ padding: '12px 16px' }}>
                      <Typography sx={{ fontSize: '14px', color: '#6B7280' }}>No devices found.</Typography>
                    </Box>
                  ) : (
                    searchResults.map((item) => (
                      <Box
                        key={`${item.type}-${item.id}`}
                        onClick={() => handleSearchResultClick(item)}
                        sx={{
                          padding: '12px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0.5,
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: '#EEF2FF'
                          }
                        }}
                      >
                        <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
                          {item.label}
                        </Typography>
                        <Typography sx={{ fontSize: '12px', color: '#6B7280' }}>
                          Device
                        </Typography>
                      </Box>
                    ))
                  )}
                </Paper>
              )}
            </Box>
            
            <Button
              variant="contained"
              startIcon={<RefreshCw size={18} />}
              onClick={() => handleManualRefresh('header')}
              disabled={refreshingDevices}
              sx={{
                height: 40,
                borderRadius: '12px',
                backgroundColor: refreshingDevices ? '#94A3B8' : '#1E293B',
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': {
                  backgroundColor: refreshingDevices ? '#94A3B8' : '#0F172A'
                }
              }}
            >
              {refreshingDevices ? 'Refreshing...' : 'Refresh'}
            </Button>

            <Button
              variant="contained"
              startIcon={<Grid3X3 size={20} />}
              onClick={handleAddDevicesClick}
              sx={{
                height: 40,
                borderRadius: '12px',
                backgroundColor: 'linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)',
                background: 'linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)',
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  background: 'linear-gradient(135deg, #1E40AF 0%, #1E3A8A 100%)',
                  boxShadow: '0 6px 16px rgba(37, 99, 235, 0.4)',
                  transform: 'translateY(-1px)'
                }
              }}
            >
              Add Devices
            </Button>
          </Box>
        </Box>

        {/* Top Summary Cards */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 3,
          mb: 3
        }}>
          {/* Connected Devices Card */}
          <Card sx={{ ...cardBaseSx, ...hoverableCardSx }}>
            <CardContent sx={{ padding: `${tokens.card.padding}px ${tokens.spacing}px` }}>
              <Typography sx={{
                fontSize: '16px',
                lineHeight: '24px',
                fontWeight: 600,
                color: tokens.colors.text,
                mb: 2
              }}>
                Connected Devices
              </Typography>
              <Typography sx={{
                fontSize: '48px',
                fontWeight: 700,
                color: tokens.colors.text,
                lineHeight: 1
              }}>
                {activeDevicesCount}/{totalVisibleDevices}
              </Typography>
              <Typography sx={{
                fontSize: '12px',
                lineHeight: '18px',
                fontWeight: 500,
                color: tokens.colors.subtext,
                mt: 1
              }}>
                {activeDevicesCount} active
              </Typography>
            </CardContent>
          </Card>

          {/* Workflows Card */}
          <Card sx={{ ...cardBaseSx, ...hoverableCardSx }}>
            <CardContent sx={{ padding: `${tokens.card.padding}px ${tokens.spacing}px` }}>
              <Typography sx={{
                fontSize: '16px',
                lineHeight: '24px',
                fontWeight: 600,
                color: tokens.colors.text,
                mb: 2
              }}>
                Workflows
              </Typography>
              <Typography sx={{
                fontSize: '48px',
                fontWeight: 700,
                color: tokens.colors.text,
                lineHeight: 1
              }}>
                {workflows.length}
              </Typography>
              <Typography sx={{
                fontSize: '12px',
                lineHeight: '18px',
                fontWeight: 500,
                color: tokens.colors.subtext,
                mt: 1
              }}>
                {workflowsActiveCount} active | {workflowsDraftCount} draft | {workflowExecutionCount} run{workflowExecutionCount === 1 ? '' : 's'}
              </Typography>
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          <Card sx={{ ...cardBaseSx, ...hoverableCardSx }}>
            <CardContent sx={{ padding: `${tokens.card.padding}px ${tokens.spacing}px` }}>
              <Typography sx={{
                fontSize: '16px',
                lineHeight: '24px',
                fontWeight: 600,
                color: tokens.colors.text,
                mb: 2
              }}>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {quickActions.map((action, index) => (
                  <Box
                    key={index}
                    onClick={() => action.path && navigate(action.path)}
                    sx={{
                      height: 44,
                      borderRadius: '12px',
                      padding: '0 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      cursor: 'pointer',
                      backgroundColor: action.active ? tokens.colors.accent : 'transparent',
                      color: action.active ? tokens.colors.primary : tokens.colors.text,
                      border: `1px solid ${action.active ? tokens.colors.primary : tokens.colors.border}`,
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        backgroundColor: action.active ? tokens.colors.accent : tokens.colors.panel,
                        boxShadow: tokens.shadows.card,
                      }
                    }}
                  >
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        backgroundColor: action.active ? tokens.colors.primary : tokens.colors.accent,
                        color: action.active ? '#FFFFFF' : tokens.colors.primary,
                      }}
                    >
                      {action.icon}
                    </Box>
                    <Typography sx={{ 
                      fontSize: '14px',
                      fontWeight: 500,
                      flex: 1
                    }}>
                      {action.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>

        </Box>



        {/* Middle Row */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 3
        }}>
          {/* Connected Devices Panel */}
          <Card sx={{ ...cardBaseSx, ...hoverableCardSx, minHeight: 420 }}>
            <CardContent sx={{ padding: `${tokens.card.padding}px ${tokens.spacing}px` }}>
              <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 3
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography sx={sectionTitleSx}>
                Connected Devices
              </Typography>
                  <Chip
                    label={`${selectedDeviceIds.length} device${selectedDeviceIds.length === 1 ? '' : 's'} selected`}
                    size="small"
                    sx={{
                      backgroundColor: tokens.colors.accent,
                      color: tokens.colors.primary,
                      fontWeight: 600,
                      height: 24
                    }}
                  />
                </Box>
                {visibleDevices.length > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Checkbox
                      size="small"
                      checked={allVisibleSelected && visibleDeviceIds.length > 0}
                      indeterminate={partiallySelected}
                      onChange={handleToggleSelectAllVisible}
                      sx={{ padding: 0 }}
                    />
                    <Typography sx={{ fontSize: '12px', color: tokens.colors.primary, fontWeight: 600 }}>
                      Select all
                    </Typography>
                    <Button
                      variant="text"
                      size="small"
                      onClick={handleClearSelection}
                      disabled={selectedDeviceIds.length === 0}
                      sx={{
                        minWidth: 'auto',
                        padding: '2px 6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'none',
                        color: tokens.colors.subtext,
                      }}
                    >
                      Clear
                    </Button>
                  </Box>
                )}
              </Box>
              
              {visibleDevices.length === 0 ? (
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  py: 8
                }}>
                  <Smartphone size={56} color="#6B7280" style={{ marginBottom: 16 }} />
                  <Typography sx={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: tokens.colors.text,
                    mb: 1
                  }}>
                    No devices connected
                  </Typography>
                  <Typography sx={{
                    fontSize: '14px',
                    color: tokens.colors.subtext,
                    mb: 3,
                    maxWidth: 280
                  }}>
                    Connect an Android device via USB and enable USB debugging
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<RefreshCw size={16} />}
                    onClick={() => handleManualRefresh('empty')}
                    disabled={refreshingDevices}
                    sx={{
                      height: 44,
                      borderRadius: '12px',
                      backgroundColor: refreshingDevices ? '#94A3B8' : tokens.colors.primary,
                      textTransform: 'none',
                      fontWeight: 600,
                      '&:hover': {
                        backgroundColor: refreshingDevices ? '#94A3B8' : '#1E48C7'
                      }
                    }}
                  >
                    {refreshingDevices ? 'Scanning...' : 'Scan Again'}
                  </Button>
                </Box>
              ) : (
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 2
                }}>
                  {filteredDevices.slice(0, 12).map((device) => {
                    const isSelected = selectedDeviceIdsSet.has(device.id);
                    const isDisconnected = disconnectedDevices.has(device.id);
                    const requiresSetup = device.requires_setup === true;
                    const canSelect = !isDisconnected;
                    const deviceAlias = deviceAliases[device.id]?.trim() || '';
                    const primaryName = device.model || device.id;
                    const secondaryLabel = deviceAlias || device.id;

                    const normalizedStatusValue = normalizeStatus(device.status);
                    const statusLabel = isDisconnected
                      ? 'Disconnected'
                      : normalizedStatusValue === 'busy'
                        ? 'Busy'
                        : (device.status || 'Connected').toString();
                    const statusColor = isDisconnected
                      ? tokens.colors.danger
                      : normalizedStatusValue === 'busy'
                        ? tokens.colors.warning
                        : tokens.colors.success;

                    const borderColor = isSelected
                      ? '#2563EB'
                      : isDisconnected
                        ? '#DC2626'
                        : '#E5E7EB';

                    return (
                      <Box
                        key={device.id}
                        sx={{
                          p: 2,
                          background: '#F8FAFC',
                          borderRadius: '10px',
                          border: `2px solid ${borderColor}`,
                          boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.15)' : 'none',
                          transition: 'all 0.2s ease-in-out',
                          opacity: isDisconnected ? 0.6 : 1,
                          '&:hover': {
                            boxShadow: '0 2px 8px rgba(16, 24, 40, 0.1)',
                            transform: 'translateY(-1px)'
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Chip
                            label={statusLabel}
                            size="small"
                            sx={{
                              backgroundColor: `${statusColor}1A`,
                              color: statusColor,
                              fontSize: '10px',
                              fontWeight: 600,
                              textTransform: 'capitalize'
                            }}
                          />
                          {requiresSetup && (
                            <Tooltip title="Developer options or USB debugging disabled">
                              <Chip
                                label="Setup"
                                size="small"
                                sx={{
                                  backgroundColor: '#FEF3C7',
                                  color: '#B45309',
                                  fontSize: '9px',
                                  fontWeight: 600,
                                  textTransform: 'uppercase'
                                }}
                              />
                            </Tooltip>
                          )}
                          <Tooltip
                            title={
                              !canSelect
                                ? 'Device unavailable'
                                : isSelected
                                  ? 'Active target'
                                  : 'Set as active target'
                            }
                          >
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleToggleDeviceSelection(device)}
                                disabled={!canSelect}
                                sx={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: '6px',
                                  backgroundColor: isSelected ? '#2563EB' : '#FFFFFF',
                                  border: `1px solid ${isSelected ? '#2563EB' : '#CBD5F5'}`,
                                  color: isSelected ? '#FFFFFF' : '#64748B',
                                  '&:hover': {
                                    backgroundColor: canSelect ? '#1E48C7' : '#FFFFFF',
                                    color: canSelect ? '#FFFFFF' : '#94A3B8'
                                  }
                                }}
                              >
                                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <Box sx={{
                            background: !isDisconnected ? '#ECFDF5' : '#FEF2F2',
                            borderRadius: '6px',
                            p: 0.5,
                            color: !isDisconnected ? '#16A34A' : '#DC2626'
                          }}>
                            <Smartphone size={16} />
                          </Box>
                          <Box
                            flex={1}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              justifyContent: 'space-between',
                            }}
                          >
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                              <Typography
                                sx={{
                                  fontSize: '14px',
                                  fontWeight: 600,
                                  color: '#0F172A',
                                }}
                              >
                                {primaryName}
                              </Typography>
                              <Typography
                                sx={{
                                  fontSize: '11px',
                                  color: '#6B7280',
                                  fontWeight: deviceAlias ? 600 : 400,
                                }}
                              >
                                {secondaryLabel}
                              </Typography>
                            </Box>
                            <Tooltip title={deviceAlias ? 'Edit alias' : 'Add alias'}>
                              <IconButton
                                size="small"
                                onClick={() => openAliasEditor(device)}
                                sx={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: '6px',
                                  backgroundColor: '#F1F5F9',
                                  color: '#475569',
                                  ml: 'auto',
                                  '&:hover': { backgroundColor: '#E2E8F0' },
                                }}
                              >
                                <Pencil size={14} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>

                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                            gap: 1.5,
                            mb: 2
                          }}
                        >
                          <Box>
                            <Typography
                              sx={{
                                fontSize: '9px',
                                color: '#6B7280',
                                mb: 0.25,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em'
                              }}
                            >
                              Network Operator
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                              {resolveSimSlotLines(device) ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                                  {resolveSimSlotLines(device)?.map((line, index) => (
                                    <Typography
                                      key={`${device.id}-sim-${index}`}
                                      sx={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        color: '#0F172A'
                                      }}
                                    >
                                      {line}
                                    </Typography>
                                  ))}
                                </Box>
                              ) : (
                                <Typography
                                  sx={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: '#0F172A'
                                  }}
                                >
                                  {resolveStableOperatorLabel(device)}
                                </Typography>
                              )}
                              <Chip
                                label={resolveNetworkTechnologyLabel(device)}
                                size="small"
                                icon={<Signal size={12} />}
                                sx={{
                                  height: 22,
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  color: '#1E3A8A',
                                  backgroundColor: '#E0E7FF',
                                  '& .MuiChip-icon': {
                                    color: '#2563EB',
                                    ml: 0.5
                                  }
                                }}
                              />
                            </Box>
                          </Box>

                          <Box>
                            <Typography
                              sx={{
                                fontSize: '9px',
                                color: '#6B7280',
                                mb: 0.25,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em'
                              }}
                            >
                              Serial Number
                            </Typography>
                            <Typography
                              sx={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#111827',
                                fontFamily: 'inherit',
                                backgroundColor: '#E0E7FF',
                                borderRadius: '6px',
                                padding: '2px 6px',
                                display: 'inline-block',
                                wordBreak: 'break-all'
                              }}
                            >
                              {device.serial || device.id}
                            </Typography>
                          </Box>

                          <Box>
                            <Typography
                              sx={{
                                fontSize: '9px',
                                color: '#6B7280',
                                mb: 0.25,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em'
                              }}
                            >
                              Connection
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  backgroundColor: device.connection_type === 'WiFi' ? '#2563EB' : '#16A34A',
                                  borderRadius: '50%',
                                  boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)'
                                }}
                              />
                              <Typography
                                sx={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: '#0F172A'
                                }}
                              >
                                {device.connection_type || 'USB'}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleDisconnect(device)}
                            sx={{
                              fontSize: '10px',
                              height: 24,
                              flex: 1,
                              borderRadius: '6px',
                              borderColor: isDisconnected ? '#16A34A' : '#DC2626',
                              color: isDisconnected ? '#16A34A' : '#DC2626',
                              '&:hover': { 
                                backgroundColor: isDisconnected ? '#16A34A' : '#DC2626',
                                color: '#FFFFFF'
                              }
                            }}
                          >
                            {isDisconnected ? 'Connect' : 'Disconnect'}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleShowDetails(device)}
                            sx={{
                              fontSize: '10px',
                              height: 24,
                              flex: 1,
                              borderRadius: '6px',
                              borderColor: '#2563EB',
                              color: '#2563EB',
                              '&:hover': { 
                                backgroundColor: '#2563EB',
                                color: '#FFFFFF'
                              }
                            }}
                          >
                            Details
                          </Button>
                        </Box>
                      </Box>
                    );
                  })}
                  {filteredDevices.length > 10 && (
                    <Typography sx={{
                      fontSize: '12px',
                      color: tokens.colors.subtext,
                      textAlign: 'center',
                      mt: 2
                    }}>
                      +{filteredDevices.length - 10} more devices
                    </Typography>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity Panel */}
          <Card sx={{ ...cardBaseSx, ...hoverableCardSx }}>
            <CardContent sx={{ padding: `${tokens.card.padding}px ${tokens.spacing}px` }}>
              <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2
              }}>
                <Box>
                  <Typography sx={{
                    fontSize: '16px',
                    lineHeight: '24px',
                    fontWeight: 600,
                    color: tokens.colors.text
                  }}>
                    Live Activity
                  </Typography>
                  <Typography sx={{ fontSize: '12px', color: tokens.colors.subtext }}>
                    {activityLoading ? 'Refreshing activity...' : activityError || activityUpdatedLabel}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    variant="text"
                    onClick={handleViewAllActivity}
                    disabled={activityItems.length === 0}
                    sx={{
                      height: 30,
                      color: tokens.colors.subtext,
                      textTransform: 'none',
                      fontSize: '12px'
                    }}
                  >
                    {activityViewAll ? 'Show Recent' : 'View All'}
                  </Button>
                  <Button
                    variant="text"
                    onClick={handleClearActivity}
                    disabled={activityItems.length === 0 && !activityLoading}
                    sx={{
                      height: 30,
                      color: tokens.colors.subtext,
                      textTransform: 'none',
                      fontSize: '12px'
                    }}
                  >
                    Clean All
                  </Button>
                </Stack>
              </Box>

              <List sx={{ padding: 0 }}>
                {activityLoading ? (
                  <ListItem
                    sx={{
                      height: 56,
                      borderRadius: '10px',
                      border: `1px solid ${tokens.colors.border}`,
                      mb: 1,
                      padding: '0 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2
                    }}
                  >
                    <CircularProgress size={18} />
                    <Typography sx={{ fontSize: '14px', color: tokens.colors.subtext }}>Loading activity...</Typography>
                  </ListItem>
                ) : activityItems.length === 0 ? (
                  <ListItem
                    sx={{
                      height: 56,
                      borderRadius: '10px',
                      border: `1px solid ${tokens.colors.border}`,
                      padding: '0 16px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <Typography sx={{ fontSize: '14px', color: tokens.colors.subtext }}>
                      No recent executions yet.
                    </Typography>
                  </ListItem>
                ) : (
                  displayedActivityItems.map((activity, index) => {
                    const iconColor =
                      activity.icon === 'check'
                        ? tokens.colors.success
                        : activity.icon === 'warning'
                          ? tokens.colors.warning
                          : tokens.colors.primary;
                    const timestamp = activity.meta || (activity.ts ? new Date(activity.ts).toLocaleString() : 'Just now');
                    const isLast = index === displayedActivityItems.length - 1;
                    return (
                      <ListItem
                        key={activity.id}
                        sx={{
                          borderRadius: '10px',
                          border: `1px solid ${tokens.colors.border}`,
                          mb: 1,
                          padding: '12px 16px',
                          '&:last-child': { mb: 0 }
                        }}
                      >
                        <Box sx={{
                          display: 'grid',
                          gridTemplateColumns: '32px 1fr',
                          gap: 2,
                          alignItems: 'center',
                          width: '100%'
                        }}>
                          <Box sx={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Box sx={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              display: 'grid',
                              placeItems: 'center',
                              backgroundColor: `${iconColor}1A`,
                              color: iconColor
                            }}>
                              {renderActivityIcon(activity)}
                            </Box>
                            {!isLast && (
                              <Box sx={{
                                position: 'absolute',
                                top: 28,
                                bottom: -20,
                                width: 2,
                                backgroundColor: tokens.colors.border
                              }} />
                            )}
                          </Box>
                          <Box>
                            <Typography sx={{
                              fontSize: '14px',
                              fontWeight: 500,
                              color: tokens.colors.text
                            }}>
                              {activity.title}
                            </Typography>
                            <Typography sx={{
                              fontSize: '12px',
                              color: tokens.colors.subtext
                            }}>
                              {timestamp}
                            </Typography>
                          </Box>
                        </Box>
                      </ListItem>
                    );
                  })
                )}
              </List>

              {activityItems.length > ACTIVITY_PAGE_SIZE && (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mt: 2,
                  }}
                >
                  {!activityViewAll ? (
                    <>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={handlePrevActivityPage}
                          disabled={!canGoPrevActivity}
                          sx={{ border: `1px solid ${tokens.colors.border}` }}
                        >
                          <ChevronLeft size={16} />
                        </IconButton>
                        <Typography sx={{ fontSize: '12px', color: tokens.colors.subtext }}>
                          Page {activityPage + 1} / {activityTotalPages}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={handleNextActivityPage}
                          disabled={!canGoNextActivity}
                          sx={{ border: `1px solid ${tokens.colors.border}` }}
                        >
                          <ChevronRight size={16} />
                        </IconButton>
                      </Box>
                      <Typography sx={{ fontSize: '12px', color: '#94A3B8' }}>
                        Showing {activityPageCount} of {activityItems.length}
                      </Typography>
                    </>
                  ) : (
                    <Typography sx={{ fontSize: '12px', color: '#94A3B8' }}>
                      Showing all {activityItems.length} activities
                    </Typography>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Setup Dialog */}
      <Dialog
        open={setupDialogOpen}
        onClose={() => setSetupDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600, color: '#0F172A' }}>
          Devices Requiring Setup
        </DialogTitle>
        <DialogContent dividers>
          {setupCandidates.length === 0 ? (
            <Typography sx={{ color: '#475569', fontSize: '14px' }}>
              All detected devices are ready to use. Connect a new device or refresh to rescan.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {setupCandidates.map((device) => (
                <Paper
                  key={device.id}
                  variant="outlined"
                  sx={{ padding: '12px 16px', borderRadius: '10px', borderColor: '#E2E8F0' }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box>
                      <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
                        {device.model || device.id}
                      </Typography>
                      <Typography sx={{ fontSize: '12px', color: '#6B7280' }}>
                        {describeSetupRequirements(device)}
                      </Typography>
                    </Box>
                    <Chip
                      label={device.raw_adb_status || device.adb_status || device.raw_status || device.status || 'unknown'}
                      size="small"
                      sx={{ textTransform: 'capitalize', backgroundColor: '#F3F4F6', color: '#475569' }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleConfigureDevice(device)}
                      disabled={deviceSetupLoading === device.id}
                      startIcon={
                        deviceSetupLoading === device.id ? <CircularProgress size={14} sx={{ color: '#FFFFFF' }} /> : undefined
                      }
                      sx={{
                        textTransform: 'none',
                        borderRadius: '8px',
                        backgroundColor: '#2563EB',
                        '&:hover': { backgroundColor: '#1E40AF' }
                      }}
                    >
                      {deviceSetupLoading === device.id ? 'Configuring...' : 'Configure automatically'}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleShowDetails(device)}
                      sx={{
                        textTransform: 'none',
                        borderRadius: '8px',
                        borderColor: '#1E293B',
                        color: '#1E293B',
                        '&:hover': { backgroundColor: '#1E293B', color: '#FFFFFF' }
                      }}
                    >
                      View details
                    </Button>
                  </Box>
                </Paper>
              ))}
              <Typography sx={{ fontSize: '12px', color: '#64748B' }}>
                Tip: Ensure the device is unlocked, developer options are enabled, and USB debugging is allowed.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSetupDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Alias Editor */}
      <Dialog
        open={Boolean(aliasEditor)}
        onClose={handleAliasDialogClose}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600, color: '#0F172A' }}>
          {aliasEditor?.value ? 'Edit alias' : 'Add alias'}
        </DialogTitle>
        <DialogContent dividers>
          <TextField
            autoFocus
            label="Alias"
            value={aliasEditor?.value ?? ''}
            onChange={(event) => handleAliasInputChange(event.target.value)}
            placeholder="e.g. QA Pixel 8"
            fullWidth
            size="small"
            helperText="Visible across dashboard, Device Manager, and workflows."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAliasDialogClose} disabled={aliasSaving} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={handleAliasSave}
            disabled={!aliasEditor || aliasSaving}
            variant="contained"
            sx={{ textTransform: 'none' }}
          >
            {aliasSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Device Details Modal */}
      <Dialog
        open={showDeviceDetails}
        onClose={() => setShowDeviceDetails(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{
          fontSize: '20px',
          fontWeight: 600,
          color: '#0F172A',
          borderBottom: '1px solid #E5E7EB'
        }}>
          Device Details - {selectedDeviceDetails?.model || selectedDeviceDetails?.id}
        </DialogTitle>
        <DialogContent sx={{ padding: '24px' }}>
          {selectedDeviceDetails && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 3 }}>
              <Box>
                <Typography sx={{ fontSize: '14px', color: '#6B7280', mb: 1 }}>Device Model</Typography>
                <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', mb: 2 }}>
                  {selectedDeviceDetails.model}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '14px', color: '#6B7280', mb: 1 }}>Serial Number</Typography>
                <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', mb: 2 }}>
                  {selectedDeviceDetails.serial || selectedDeviceDetails.id}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '14px', color: '#6B7280', mb: 1 }}>Android Version</Typography>
                <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', mb: 2 }}>
                  {formatAndroidVersion(selectedDeviceDetails)}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '14px', color: '#6B7280', mb: 1 }}>Network Operator</Typography>
                <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', mb: 2 }}>
                  {resolveStableOperatorLabel(selectedDeviceDetails)}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '14px', color: '#6B7280', mb: 1 }}>Network Technology</Typography>
                <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', mb: 2 }}>
                  {resolveNetworkTechnologyLabel(selectedDeviceDetails)}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '14px', color: '#6B7280', mb: 1 }}>Battery Level</Typography>
                <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', mb: 2 }}>
                  {formatBatteryLevel(selectedDeviceDetails.battery_level)}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '14px', color: '#6B7280', mb: 1 }}>Connection Type</Typography>
                <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', mb: 2 }}>
                  {selectedDeviceDetails.connection_type || 'USB'}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '14px', color: '#6B7280', mb: 1 }}>Status</Typography>
                <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', mb: 2 }}>
                  {selectedDeviceDetails.status}
                </Typography>
              </Box>
              <Box sx={{ gridColumn: 'span 2' }}>
                <Typography sx={{ fontSize: '14px', color: '#6B7280', mb: 1 }}>Last Seen</Typography>
                <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', mb: 2 }}>
                  {formatLastSeen(selectedDeviceDetails.last_seen)}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB' }}>
          <Button
            onClick={() => setShowDeviceDetails(false)}
            sx={{
              color: '#6B7280',
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* About Dialog */}
      <Dialog open={aboutDialogOpen} onClose={() => setAboutDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{`About MOBIQ ${versionLabel}`}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body1">
              {`MOBIQ ${versionLabel} centralizes the Android automation backend, React dashboard, and Electron shell into a single`}
              desktop experience tailored for field teams. It streams live device telemetry, runs scripted modules, and
              orchestrates repeatable workflows without juggling multiple CLI tools.
            </Typography>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Highlights</Typography>
              <List dense sx={{ pl: 2 }}>
                <ListItem sx={{ pl: 0 }}>
                  <ListItemText primary="Live device intelligence: operator, radio access, battery, and debug status." />
                </ListItem>
                <ListItem sx={{ pl: 0 }}>
                  <ListItemText primary="Prebuilt telco modules (airplane mode, call tests, ping, registration checks)." />
                </ListItem>
                <ListItem sx={{ pl: 0 }}>
                  <ListItemText primary="Workflow composer with local storage, execution history, and retry controls." />
                </ListItem>
                <ListItem sx={{ pl: 0 }}>
                  <ListItemText primary="Offline-ready installer (Electron + PyInstaller) for Windows field laptops." />
                </ListItem>
              </List>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>Build information</Typography>
              <Typography variant="body2">
                {`Version ${appVersion ?? 'unknown'} - Electron 28 - React 18 - Python 3.x. Documentation and updates live in the project wiki and`}
                release notes. For incidents or feature requests, open an issue in the repository or contact the support channel.
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleOpenBugReport} sx={{ textTransform: 'none' }}>
            Create Bug Report
          </Button>
          <Button onClick={handleExportLogs} sx={{ textTransform: 'none' }}>
            Export Logs
          </Button>
          <Button onClick={() => setAboutDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bugReportOpen} onClose={() => setBugReportOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Bug Report</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" sx={{ color: '#64748B' }}>
              Add a short description of the issue. Logs and context will be bundled automatically.
            </Typography>
            <TextField
              label="What happened?"
              placeholder="Steps to reproduce, expected vs actual behavior..."
              multiline
              minRows={4}
              value={bugReportNotes}
              onChange={(event) => setBugReportNotes(event.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBugReportOpen(false)} disabled={bugReportSubmitting} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmitBugReport}
            disabled={bugReportSubmitting}
            variant="contained"
            sx={{ textTransform: 'none' }}
          >
            {bugReportSubmitting ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;

