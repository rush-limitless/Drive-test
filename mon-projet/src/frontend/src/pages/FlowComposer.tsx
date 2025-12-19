import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Stack,
  Menu,
} from '@mui/material';
import {
  Search,
  ChevronDown,
  Plus,
  Play,
  Pause,
  Settings,
  Zap,
  Clock,
  CheckCircle,
  Edit,
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
  StopCircle,
  Copy,
  Download,
  Tag,
} from 'lucide-react';

import Layout from '../components/Layout';
import { MODULE_CATALOG, ModuleMetadata } from '../data/modules';
import {
  addStoredWorkflow,
  deleteStoredWorkflow,
  getStoredWorkflows,
  recordWorkflowRun,
  updateStoredWorkflow,
  WORKFLOWS_STORAGE_EVENT,
  StoredWorkflow,
} from '../utils/workflows';
import { recordDeviceWorkflowRun } from '../utils/deviceHistory';
import { recordDeviceActivity } from '../utils/deviceActivity';
import { readSelectedDeviceIds, SELECTED_DEVICES_EVENT } from '../utils/deviceSelection';
import { CallTestValues } from '../types/callTest';

type WorkflowEditorData = {
  name: string;
  description: string;
  modules: ModuleMetadata[];
  repeatSettings: RepeatDurationSettings;
  tags: string[];
};

type WorkflowExecutionDeviceResult = {
  deviceId: string;
  success: boolean;
  message?: string;
};

type WorkflowExecutionStep = {
  step: number;
  module: string | null;
  success: boolean;
  deviceResults: WorkflowExecutionDeviceResult[];
};

type WorkflowExecutionReport = {
  executionId: string;
  timestamp: string;
  status: string;
  workflowName: string;
  deviceIds: string[];
  successCount: number;
  failureCount: number;
  results: WorkflowExecutionStep[];
};

type WorkflowPreflightReport = {
  timestamp: string;
  success: boolean;
  deviceResults: WorkflowExecutionDeviceResult[];
};

interface FlowComposerProps {
  backendUrl: string;
}

const CALL_TEST_STORAGE_KEY = 'callTestParams';
const GLOBAL_CALL_TEST_KEY = '__global__';
const WORKFLOW_BACKEND_MAP_KEY = 'workflowBackendMap';
const CALL_TEST_DEFAULTS: CallTestValues = {
  countryCode: '+237',
  phoneNumber: '691234567',
  duration: 30,
  callCount: 1,
};
const WAITING_TIME_MODULE_ID = 'waiting_time';
const DEFAULT_WAIT_DURATION_SECONDS = 5;
const MIN_WAIT_DURATION_SECONDS = 1;
const MAX_WAIT_DURATION_SECONDS = 600;
const WAITING_TIME_STORAGE_KEY = 'waitingTimeDurationSeconds';

const REPEAT_UNIT_TO_SECONDS = {
  minutes: 60,
  hours: 3600,
  days: 86400,
} as const;

type DurationUnit = keyof typeof REPEAT_UNIT_TO_SECONDS;

interface RepeatDurationSettings {
  repeatCount: number;
  durationValue: number;
  durationUnit: DurationUnit;
}

const DEFAULT_REPEAT_SETTINGS: RepeatDurationSettings = {
  repeatCount: 1,
  durationValue: 0,
  durationUnit: 'minutes',
};

const convertDurationToSeconds = (value: number, unit: DurationUnit): number => {
  const normalizedValue = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  return normalizedValue * REPEAT_UNIT_TO_SECONDS[unit];
};


type StoredCallTestValues = CallTestValues;

type BackendWorkflowSchedule = {
  id: string;
  workflow_id: string;
  workflow_name: string;
  device_id: string;
  run_at: string;
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
  updated_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  result?: Record<string, unknown> | null;
};

type WorkflowScheduleSummary = {
  deviceIds: string[];
  scheduleIds: string[];
  nextRunAt: string;
};

const sanitizeCallTestValues = (values: Partial<StoredCallTestValues>): StoredCallTestValues => {
  const countryDigits = (values.countryCode ?? CALL_TEST_DEFAULTS.countryCode).replace(/[^0-9]/g, '');
  const countryCode = countryDigits ? `+${countryDigits}` : CALL_TEST_DEFAULTS.countryCode;
  const phoneNumber =
    (values.phoneNumber ?? CALL_TEST_DEFAULTS.phoneNumber).replace(/[^0-9]/g, '') ||
    CALL_TEST_DEFAULTS.phoneNumber;
  const duration = Math.max(1, Math.min(600, Number(values.duration ?? CALL_TEST_DEFAULTS.duration)));
  const callCount = Math.max(1, Math.min(10, Number(values.callCount ?? CALL_TEST_DEFAULTS.callCount)));
  return { countryCode, phoneNumber, duration, callCount };
};

const readCallTestStorageMap = (): Record<string, StoredCallTestValues> => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(CALL_TEST_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const entries: Record<string, StoredCallTestValues> = {};
      Object.entries(parsed).forEach(([key, value]) => {
        if (value && typeof value === 'object') {
          entries[key] = sanitizeCallTestValues(value as Partial<StoredCallTestValues>);
        }
      });
      return entries;
    }
  } catch (error) {
    console.warn('[FlowComposer] Failed to read Call Test storage map', error);
  }
  return {};
};

const resolveCallTestValuesForDevice = (deviceId?: string | null): StoredCallTestValues => {
  const map = readCallTestStorageMap();
  if (deviceId && map[deviceId]) {
    return map[deviceId];
  }
  if (map[GLOBAL_CALL_TEST_KEY]) {
    return map[GLOBAL_CALL_TEST_KEY];
  }
  return CALL_TEST_DEFAULTS;
};

const buildModuleParametersForDevice = (module: ModuleMetadata, deviceId?: string | null): Record<string, any> | undefined => {
  if (module.id === 'call_test') {
    const values = resolveCallTestValuesForModule(module, deviceId);
    const internationalNumber = `${values.countryCode}${values.phoneNumber}`.replace(/\s+/g, '');
    return {
      number: internationalNumber,
      duration: values.duration,
      call_count: values.callCount,
      calls: values.callCount,
    };
  }
  return undefined;
};

const resolveModuleExecutionId = (moduleId: string): string | null => {
  if (moduleId === 'call_test') {
    return 'voice_call_test';
  }
  if (moduleId === WAITING_TIME_MODULE_ID) {
    return null;
  }
  return moduleId;
};

const resolveCallTestValuesForModule = (module: ModuleMetadata, deviceId?: string | null): StoredCallTestValues => {
  if (module.id === 'call_test' && module.callTestParams) {
    return sanitizeCallTestValues(module.callTestParams);
  }
  return resolveCallTestValuesForDevice(deviceId);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isWaitingModule = (module?: ModuleMetadata | null): boolean => module?.id === WAITING_TIME_MODULE_ID;

const formatCallTestNumber = (values: StoredCallTestValues): string => {
  const compactCountry = values.countryCode.replace(/\s+/g, '');
  const localNumber = values.phoneNumber.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  return [compactCountry, localNumber].filter(Boolean).join(' ').trim();
};

const describeCallTestModule = (module: ModuleMetadata): string => {
  const values = resolveCallTestValuesForModule(module);
  const numberLabel = formatCallTestNumber(values);
  const attempts = Math.max(1, values.callCount ?? 1);
  const attemptLabel = attempts > 1 ? `${attempts} appels` : '1 appel';
  return `Appel vers ${numberLabel} â€¢ ${attemptLabel}`;
};

const describeWaitingModule = (module: ModuleMetadata): string =>
  `Attente de ${module.waitDurationSeconds ?? DEFAULT_WAIT_DURATION_SECONDS} seconde(s)`;

const getModuleTooltipLabel = (module: ModuleMetadata): string | undefined => {
  if (module.id === 'call_test') {
    return describeCallTestModule(module);
  }
  if (isWaitingModule(module)) {
    return describeWaitingModule(module);
  }
  if (typeof module.description === 'string' && module.description.trim().length > 0) {
    return module.description.trim();
  }
  return undefined;
};

type ModuleTooltipWrapperProps = {
  title?: string;
  children: React.ReactElement;
};

const ModuleTooltipWrapper: React.FC<ModuleTooltipWrapperProps> = ({ title, children }) => {
  if (!title) {
    return children;
  }
  return <Tooltip title={title}>{children}</Tooltip>;
};

const sanitizeWaitDurationSeconds = (value?: number | string): number => {
  const candidate = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(candidate)) {
    return DEFAULT_WAIT_DURATION_SECONDS;
  }
  const rounded = Math.round(candidate);
  return Math.min(MAX_WAIT_DURATION_SECONDS, Math.max(MIN_WAIT_DURATION_SECONDS, rounded));
};

const getStoredWaitingTimeDuration = (): number => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return DEFAULT_WAIT_DURATION_SECONDS;
  }
  try {
    const raw = window.localStorage.getItem(WAITING_TIME_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_WAIT_DURATION_SECONDS;
    }
    const parsed = Number(raw);
    return sanitizeWaitDurationSeconds(parsed);
  } catch {
    return DEFAULT_WAIT_DURATION_SECONDS;
  }
};

const cloneModuleForWorkflow = (module: ModuleMetadata): ModuleMetadata => {
  let cloned: ModuleMetadata = { ...module };
  if (isWaitingModule(module)) {
    const effectiveDuration =
      typeof module.waitDurationSeconds === 'number'
        ? module.waitDurationSeconds
        : getStoredWaitingTimeDuration();
    cloned = {
      ...cloned,
      waitDurationSeconds: sanitizeWaitDurationSeconds(effectiveDuration),
    };
  }
  if (module.id === 'call_test' && module.callTestParams) {
    cloned = {
      ...cloned,
      callTestParams: { ...module.callTestParams },
    };
  } else if (module.id === 'call_test' && !module.callTestParams) {
    const values = resolveCallTestValuesForDevice();
    cloned = {
      ...cloned,
      callTestParams: { ...values },
    };
  }
  return cloned;
};

const readWorkflowBackendMap = (): Record<string, string> => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(WORKFLOW_BACKEND_MAP_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const map: Record<string, string> = {};
      Object.entries(parsed).forEach(([localId, backendId]) => {
        if (typeof localId === 'string' && typeof backendId === 'string') {
          map[localId] = backendId;
        }
      });
      return map;
    }
  } catch (error) {
    console.warn('[FlowComposer] Failed to read backend workflow map', error);
  }
  return {};
};

const FlowComposer: React.FC<FlowComposerProps> = ({ backendUrl }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [workflows, setWorkflows] = useState<StoredWorkflow[]>(() => getStoredWorkflows());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<StoredWorkflow | null>(null);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(() => readSelectedDeviceIds());
  const [runningWorkflows, setRunningWorkflows] = useState<Record<string, boolean>>({});
  const [workflowRunStatus, setWorkflowRunStatus] = useState<Record<string, string>>({});
  const [workflowActiveModuleIndex, setWorkflowActiveModuleIndex] = useState<Record<string, number | null>>({});
  const [workflowCompletedModules, setWorkflowCompletedModules] = useState<Record<string, number[]>>({});
  const [workflowPauseRequests, setWorkflowPauseRequests] = useState<Record<string, boolean>>({});
  const workflowPauseRef = useRef<Record<string, boolean>>({});
  const [workflowRepeatSettings, setWorkflowRepeatSettings] = useState<Record<string, RepeatDurationSettings>>({});
  const [workflowCancelRequests, setWorkflowCancelRequests] = useState<Record<string, boolean>>({});
  const workflowCancelControllers = useRef<Record<string, AbortController>>({});
  const [serverSchedules, setServerSchedules] = useState<BackendWorkflowSchedule[]>([]);
  const [scheduleFetchError, setScheduleFetchError] = useState<string | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleTargetWorkflow, setScheduleTargetWorkflow] = useState<StoredWorkflow | null>(null);
  const [scheduleDelayMinutes, setScheduleDelayMinutes] = useState('10');
  const [scheduleDialogError, setScheduleDialogError] = useState<string | null>(null);
  const [scheduleDeviceIds, setScheduleDeviceIds] = useState<string[]>([]);
  const [workflowBackendMap, setWorkflowBackendMap] = useState<Record<string, string>>(() => readWorkflowBackendMap());
  const [backendWorkflowIds, setBackendWorkflowIds] = useState<string[]>([]);
  const [workflowExecutionReports, setWorkflowExecutionReports] = useState<Record<string, WorkflowExecutionReport>>({});
  const [preflightReports, setPreflightReports] = useState<Record<string, WorkflowPreflightReport | null>>({});
  const [workflowTagFilter, setWorkflowTagFilter] = useState<string>('all');
  const [exportMenuAnchor, setExportMenuAnchor] = useState<HTMLElement | null>(null);
  const [exportMenuWorkflow, setExportMenuWorkflow] = useState<StoredWorkflow | null>(null);
  const moduleCatalogMap = useMemo(() => new Map(MODULE_CATALOG.map((m) => [m.id, m])), []);
  const normalizedBackendUrl = useMemo(() => (backendUrl ? backendUrl.replace(/\/$/, '') : ''), [backendUrl]);
  const schedulePreviewTime = useMemo(() => {
    const minutes = Number(scheduleDelayMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return null;
    }
    const future = new Date(Date.now() + minutes * 60 * 1000);
    return future.toLocaleString([], { hour: '2-digit', minute: '2-digit' });
  }, [scheduleDelayMinutes]);

  const availableWorkflowTags = useMemo(() => {
    const tagSet = new Set<string>();
    workflows.forEach((workflow) => {
      (workflow.tags ?? []).forEach((tag) => {
        if (tag && tag.trim().length > 0) {
          tagSet.add(tag.trim());
        }
      });
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [workflows]);

  const handleCloneWorkflow = useCallback(
    (workflow: StoredWorkflow) => {
      const cloneName = `${workflow.name} (Copy)`;
      addStoredWorkflow({
        name: cloneName,
        description: workflow.description,
        modules: workflow.modules,
        runCount: 0,
        lastRunAt: null,
        tags: workflow.tags ?? [],
      });
      setWorkflows(getStoredWorkflows());
      setSnackbar({ severity: 'success', message: `Workflow "${cloneName}" created.` });
    },
    []
  );

  useEffect(() => {
    const syncWorkflows = () => setWorkflows(getStoredWorkflows());
    syncWorkflows();
    window.addEventListener(WORKFLOWS_STORAGE_EVENT, syncWorkflows);
    return () => {
      window.removeEventListener(WORKFLOWS_STORAGE_EVENT, syncWorkflows);
    };
  }, []);

  useEffect(() => {
    const syncSelection = (event: Event) => {
      const detail = (event as CustomEvent<string[]>).detail;
      if (Array.isArray(detail)) {
        setSelectedDeviceIds(detail);
      } else {
        setSelectedDeviceIds(readSelectedDeviceIds());
      }
    };
    window.addEventListener(SELECTED_DEVICES_EVENT, syncSelection as EventListener);
    return () => {
      window.removeEventListener(SELECTED_DEVICES_EVENT, syncSelection as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!scheduleDialogOpen) {
      setScheduleDeviceIds(selectedDeviceIds);
    }
  }, [selectedDeviceIds, scheduleDialogOpen]);

  useEffect(() => {
    workflowPauseRef.current = workflowPauseRequests;
  }, [workflowPauseRequests]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(WORKFLOW_BACKEND_MAP_KEY, JSON.stringify(workflowBackendMap));
    } catch (error) {
      console.warn('[FlowComposer] Failed to persist backend workflow map', error);
    }
  }, [workflowBackendMap]);


  const getRepeatSettingsForWorkflow = (workflowId: string): RepeatDurationSettings =>
    workflowRepeatSettings[workflowId] ?? DEFAULT_REPEAT_SETTINGS;

  const updateRepeatSettingsForWorkflow = useCallback(
    (workflowId: string, patch: Partial<RepeatDurationSettings>) => {
      setWorkflowRepeatSettings((prev) => ({
        ...prev,
        [workflowId]: {
          ...(prev[workflowId] ?? DEFAULT_REPEAT_SETTINGS),
          ...patch,
        },
      }));
    },
    []
  );

  const setWorkflowPaused = useCallback((workflowId: string, paused: boolean) => {
    setWorkflowPauseRequests((prev) => {
      const next = { ...prev };
      if (paused) {
        next[workflowId] = true;
      } else {
        delete next[workflowId];
      }
      return next;
    });
  }, []);

  const isWorkflowPaused = useCallback(
    (workflowId: string) => Boolean(workflowPauseRequests[workflowId]),
    [workflowPauseRequests]
  );

  const markWorkflowCancelled = useCallback((workflowId: string) => {
    setWorkflowCancelRequests((prev) => ({ ...prev, [workflowId]: true }));
  }, []);

  const clearWorkflowCancellation = useCallback((workflowId: string) => {
    setWorkflowCancelRequests((prev) => {
      const next = { ...prev };
      delete next[workflowId];
      return next;
    });
    if (workflowCancelControllers.current[workflowId]) {
      delete workflowCancelControllers.current[workflowId];
    }
  }, []);

  const isWorkflowCancelled = useCallback(
    (workflowId: string) => workflowCancelRequests[workflowId] === true,
    [workflowCancelRequests]
  );

  const handleStopWorkflow = useCallback((workflowId: string) => {
    markWorkflowCancelled(workflowId);
    setWorkflowPaused(workflowId, false);
    const controller = workflowCancelControllers.current[workflowId];
    if (controller) {
      controller.abort();
    }
  }, [markWorkflowCancelled, setWorkflowPaused]);

  const sortedModuleCatalog = useMemo(
    () => [...MODULE_CATALOG].sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const sortedWorkflows = useMemo(
    () => [...workflows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [workflows]
  );
  const totalWorkflows = workflows.length;
  const activeWorkflows = workflows.filter((workflow) => workflow.status === 'active');
  const draftWorkflows = workflows.filter((workflow) => workflow.status === 'draft');
  const totalExecutions = workflows.reduce((sum, workflow) => sum + (workflow.runCount || 0), 0);
  const mostRecentRunAt = workflows.reduce<string | null>((latest, workflow) => {
    if (!workflow.lastRunAt) {
      return latest;
    }
    return !latest || workflow.lastRunAt > latest ? workflow.lastRunAt : latest;
  }, null);
  const mostRecentRunLabel = useMemo(() => {
    if (!mostRecentRunAt) {
      return null;
    }
    const parsed = new Date(mostRecentRunAt);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toLocaleString();
  }, [mostRecentRunAt]);

  const filteredWorkflows = sortedWorkflows.filter((workflow) => {
    const matchesStatus = filterStatus === 'all' ? true : workflow.status === filterStatus;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      workflow.name.toLowerCase().includes(query) ||
      (workflow.description || '').toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return { bg: '#EEF2FF', color: '#2563EB' };
      case 'draft': return { bg: '#F1F5F9', color: '#64748B' };
      default: return { bg: '#F1F5F9', color: '#64748B' };
    }
  };

  const fetchWorkflowSchedules = useCallback(
    async (signal?: AbortSignal) => {
      if (!normalizedBackendUrl) {
        setServerSchedules([]);
        setScheduleFetchError(null);
        return;
      }
      try {
        const response = await fetch(`${normalizedBackendUrl}/api/workflows/schedules`, { signal });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Failed to load schedules (HTTP ${response.status})`);
        }
        const payload = await response.json();
        if (!Array.isArray(payload)) {
          throw new Error('Unexpected schedule payload.');
        }
        setServerSchedules(payload as BackendWorkflowSchedule[]);
        setScheduleFetchError(null);
      } catch (error) {
        if (signal?.aborted) {
          return;
        }
        setScheduleFetchError(
          error instanceof Error ? error.message : 'Unable to load workflow schedules from the backend.'
        );
      } finally {
        // no cleanup needed
      }
    },
    [normalizedBackendUrl]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchWorkflowSchedules(controller.signal);
    const interval = window.setInterval(() => fetchWorkflowSchedules(), 15000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [fetchWorkflowSchedules]);

  const scheduleSummaries = useMemo(() => {
    const grouped: Record<string, WorkflowScheduleSummary> = {};
    const backendToLocal = Object.entries(workflowBackendMap).reduce<Record<string, string>>((acc, [localId, backendId]) => {
      acc[backendId] = localId;
      return acc;
    }, {});
    serverSchedules.forEach((entry) => {
      if (entry.status !== 'scheduled') {
        return;
      }
      const localWorkflowId = backendToLocal[entry.workflow_id];
      if (!localWorkflowId) {
        return;
      }
      const bucket =
        grouped[localWorkflowId] ??
        {
          deviceIds: [] as string[],
          scheduleIds: [] as string[],
          nextRunAt: entry.run_at,
        };
      bucket.deviceIds.push(entry.device_id);
      bucket.scheduleIds.push(entry.id);
      if (!bucket.nextRunAt || new Date(entry.run_at).getTime() < new Date(bucket.nextRunAt).getTime()) {
        bucket.nextRunAt = entry.run_at;
      }
      grouped[localWorkflowId] = bucket;
    });
    return grouped;
  }, [serverSchedules, workflowBackendMap]);

  const ensureBackendWorkflow = useCallback(
    async (workflow: StoredWorkflow): Promise<string> => {
      if (!normalizedBackendUrl) {
        throw new Error('Backend unavailable: no URL configured.');
      }

      const existing = workflowBackendMap[workflow.id];
      if (existing) {
        try {
          const response = await fetch(`${normalizedBackendUrl}/api/workflows/${existing}`);
          if (response.ok) {
            return existing;
          }
          if (response.status !== 404) {
            const text = await response.text();
            throw new Error(
              text || `Failed to validate workflow "${workflow.name}" on backend (HTTP ${response.status})`
            );
          }
          setWorkflowBackendMap((prev) => {
            const next = { ...prev };
            delete next[workflow.id];
            return next;
          });
        } catch (error) {
          if (error instanceof Error) {
            throw error;
          }
          throw new Error('Unable to validate workflow on backend.');
        }
      }

      const response = await fetch(`${normalizedBackendUrl}/api/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workflow.name,
          description: workflow.description,
          modules: workflow.modules.map((module) => module.id),
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Failed to register workflow on backend (HTTP ${response.status})`);
      }
      const payload = await response.json();
      if (!payload?.id) {
        throw new Error('Backend did not return a workflow identifier.');
      }
      setWorkflowBackendMap((prev) => ({
        ...prev,
        [workflow.id]: payload.id,
      }));
      return payload.id as string;
    },
    [normalizedBackendUrl, workflowBackendMap]
  );

  useEffect(() => {
    if (!normalizedBackendUrl) {
      setBackendWorkflowIds([]);
      return;
    }
    const controller = new AbortController();
    const syncBackendState = async () => {
      try {
        const response = await fetch(`${normalizedBackendUrl}/api/workflows`, { signal: controller.signal });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `Failed to read backend workflows (HTTP ${response.status})`);
        }
        const payload = await response.json();
        if (!Array.isArray(payload)) {
          throw new Error('Unexpected backend workflow payload.');
        }
        const ids = payload
          .map((wf) => (wf && typeof wf === 'object' ? (wf as { id?: string }).id : null))
          .filter((id): id is string => typeof id === 'string');
        setBackendWorkflowIds(ids);
        setWorkflowBackendMap((prev) => {
          const backendIdSet = new Set(ids);
          let changed = false;
          const next = { ...prev };
          Object.entries(prev).forEach(([localId, backendId]) => {
            if (!backendIdSet.has(backendId)) {
              delete next[localId];
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn('[FlowComposer] Failed to sync backend workflows', error);
        }
      }
    };
    syncBackendState();
    return () => controller.abort();
  }, [normalizedBackendUrl]);

  useEffect(() => {
    if (!normalizedBackendUrl) {
      return;
    }
    const backendIdSet = new Set(backendWorkflowIds);
    const missing = workflows.filter((workflow) => {
      const backendId = workflowBackendMap[workflow.id];
      return !backendId || !backendIdSet.has(backendId);
    });
    if (missing.length === 0) {
      return;
    }
    let cancelled = false;
    (async () => {
      for (const workflow of missing) {
        if (cancelled) {
          break;
        }
        try {
          await ensureBackendWorkflow(workflow);
        } catch (error) {
          console.warn('[FlowComposer] Failed to register workflow on backend', error);
          break;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureBackendWorkflow, normalizedBackendUrl, backendWorkflowIds, workflowBackendMap, workflows]);

  const handleOpenScheduleDialog = useCallback(
    (workflow: StoredWorkflow) => {
      const devices = selectedDeviceIds.length > 0 ? selectedDeviceIds : readSelectedDeviceIds();
      if (devices.length === 0) {
        setSnackbar({
          severity: 'error',
          message: 'Select one or more devices on the dashboard before scheduling a workflow.',
        });
        return;
      }
      setScheduleTargetWorkflow(workflow);
      setScheduleDeviceIds(devices);
      setScheduleDelayMinutes('10');
      setScheduleDialogError(null);
      setScheduleDialogOpen(true);
    },
    [selectedDeviceIds]
  );

  const handleScheduleDialogClose = useCallback(() => {
    setScheduleDialogOpen(false);
    setScheduleTargetWorkflow(null);
    setScheduleDialogError(null);
  }, []);

  const handleScheduleSave = useCallback(async () => {
    if (!scheduleTargetWorkflow) {
      return;
    }
    if (!normalizedBackendUrl) {
      setScheduleDialogError('Backend unavailable: no URL configured.');
      return;
    }
    const parsedMinutes = Number(scheduleDelayMinutes);
    if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
      setScheduleDialogError('Delay must be at least 1 minute.');
      return;
    }
    if (scheduleDeviceIds.length === 0) {
      setScheduleDialogError('Select one or more devices on the dashboard before scheduling.');
      return;
    }
    const runAtIso = new Date(Date.now() + parsedMinutes * 60 * 1000).toISOString();
    try {
      const attemptSchedule = async (workflowId: string) => {
        const response = await fetch(`${normalizedBackendUrl}/api/workflows/${workflowId}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_ids: scheduleDeviceIds,
            run_at: runAtIso,
          }),
        });
        if (!response.ok) {
          const text = await response.text();
          const message = text || `Scheduling failed (HTTP ${response.status})`;
          if (response.status === 404 && message.toLowerCase().includes('workflow not found')) {
            return { retry: true, message };
          }
          throw new Error(message);
        }
        return { retry: false };
      };

      let backendWorkflowId = await ensureBackendWorkflow(scheduleTargetWorkflow);
      let scheduleResult = await attemptSchedule(backendWorkflowId);

      if (scheduleResult.retry) {
        setWorkflowBackendMap((prev) => {
          const next = { ...prev };
          delete next[scheduleTargetWorkflow.id];
          return next;
        });
        backendWorkflowId = await ensureBackendWorkflow(scheduleTargetWorkflow);
        scheduleResult = await attemptSchedule(backendWorkflowId);
      }

      if (!scheduleResult.retry) {
        setSnackbar({
          severity: 'success',
          message: `Workflow "${scheduleTargetWorkflow.name}" scheduled for ${new Date(runAtIso).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}.`,
        });
        setScheduleDialogOpen(false);
        setScheduleTargetWorkflow(null);
        setScheduleDialogError(null);
        await fetchWorkflowSchedules();
      }
    } catch (error) {
      setScheduleDialogError(error instanceof Error ? error.message : 'Unable to schedule workflow.');
    }
  }, [
    ensureBackendWorkflow,
    fetchWorkflowSchedules,
    normalizedBackendUrl,
    scheduleDelayMinutes,
    scheduleDeviceIds,
    scheduleTargetWorkflow,
  ]);

  const handleCancelSchedule = useCallback(
    async (workflowId: string) => {
      const summary = scheduleSummaries[workflowId];
      if (!summary || summary.scheduleIds.length === 0) {
        return;
      }
      if (!normalizedBackendUrl) {
        setSnackbar({ severity: 'error', message: 'Backend unavailable: no URL configured.' });
        return;
      }
      try {
        await Promise.all(
          summary.scheduleIds.map((scheduleId) =>
            fetch(`${normalizedBackendUrl}/api/workflows/schedules/${scheduleId}`, { method: 'DELETE' })
          )
        );
        setSnackbar({ severity: 'info', message: 'Scheduled workflow run cancelled.' });
        await fetchWorkflowSchedules();
      } catch (error) {
        setSnackbar({
          severity: 'error',
          message: error instanceof Error ? error.message : 'Unable to cancel scheduled workflow.',
        });
      }
    },
    [fetchWorkflowSchedules, normalizedBackendUrl, scheduleSummaries]
  );

  const formatScheduleLabel = useCallback((iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return iso;
    }
    return date.toLocaleString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const handleCloseEditor = () => {
    setEditorOpen(false);
    setEditingWorkflow(null);
  };

  const handleNewWorkflow = () => {
    setEditingWorkflow(null);
    setEditorOpen(true);
  };

  const handleDeleteWorkflow = (workflow: StoredWorkflow) => {
    if (runningWorkflows[workflow.id]) {
      setSnackbar({
        severity: 'warning',
        message: `Stop workflow "${workflow.name}" before deleting it.`,
      });
      return;
    }
    const confirmDelete = window.confirm(`Delete workflow "${workflow.name}"?`);
    if (!confirmDelete) {
      return;
    }
    deleteStoredWorkflow(workflow.id);
    setWorkflows(getStoredWorkflows());
    setSnackbar({ severity: 'success', message: `Workflow "${workflow.name}" deleted.` });
  };

  const handleEditorSubmit = (data: WorkflowEditorData, workflowId?: string) => {
    if (!data.name.trim()) {
      setSnackbar({ severity: 'error', message: 'Workflow name is required.' });
      return;
    }
    if (data.modules.length === 0) {
      setSnackbar({ severity: 'error', message: 'Select at least one module.' });
      return;
    }

    const normalizedDescription = data.description?.trim() ?? '';
    const description = normalizedDescription.length > 0 ? normalizedDescription : '';

    const sanitizedRepeat: RepeatDurationSettings = {
      repeatCount: Math.max(1, Math.trunc(data.repeatSettings.repeatCount)),
      durationValue: Math.max(0, Math.trunc(data.repeatSettings.durationValue)),
      durationUnit: data.repeatSettings.durationUnit,
    };

    if (workflowId) {
      const updated = updateStoredWorkflow(workflowId, {
        name: data.name.trim(),
        description,
        modules: data.modules,
      });
      if (!updated) {
        setSnackbar({ severity: 'error', message: 'Workflow not found.' });
        return;
      }
      updateRepeatSettingsForWorkflow(workflowId, sanitizedRepeat);
      setSnackbar({ severity: 'success', message: `Workflow "${data.name}" updated.` });
    } else {
      const created = addStoredWorkflow({
        name: data.name.trim(),
        description,
        modules: data.modules,
        tags: data.tags ?? [],
      });
      setWorkflowRepeatSettings((prev) => ({
        ...prev,
        [created.id]: sanitizedRepeat,
      }));
      setSnackbar({ severity: 'success', message: `Workflow "${data.name}" created.` });
    }

    setWorkflows(getStoredWorkflows());
    handleCloseEditor();
  };

  const performPreflightCheck = useCallback(
    async (workflowId: string, deviceIds: string[]) => {
      if (!normalizedBackendUrl) {
        throw new Error('Backend unavailable: no URL configured.');
      }
      const response = await fetch(`${normalizedBackendUrl}/api/modules/preflight_check/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_ids: deviceIds }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Preflight check failed for workflow ${workflowId}.`);
      }
      const data = await response.json();
      const deviceResults: WorkflowExecutionDeviceResult[] = (data.result?.device_results ?? []).map((entry: any) => ({
        deviceId: entry.device_id,
        success: Boolean(entry.success),
        message: entry.result?.stage_message || entry.result?.summary || entry.result?.message || entry.error || '',
      }));
      const success = Boolean(data.success) && deviceResults.every((result) => result.success);
      return {
        timestamp: new Date().toISOString(),
        success,
        deviceResults,
      };
    },
    [normalizedBackendUrl]
  );

  const executeModuleForDevices = useCallback(
    async (
      workflow: StoredWorkflow,
      module: ModuleMetadata,
      deviceIds: string[],
      normalizedBackendUrl: string,
      repeatCountMeta: number,
      durationSecondsMeta: number,
      runIteration: number,
      abortSignal?: AbortSignal
    ) => {
      if (isWaitingModule(module)) {
        const waitSeconds = sanitizeWaitDurationSeconds(module.waitDurationSeconds);
        if (waitSeconds > 0) {
          await sleep(waitSeconds * 1000);
        }
        return { successes: deviceIds, failures: [] };
      }
      const apiModuleId = resolveModuleExecutionId(module.id);
      if (!apiModuleId) {
        return {
          successes: [],
          failures: deviceIds.map((deviceId) => ({
            deviceId,
            reason: `Module "${module.name}" not supported for workflows.`,
          })),
        };
      }

      const buildGroupedRequests = () => {
        const groupedRequests = new Map<string, { parameters: Record<string, any>; deviceIds: string[] }>();
        deviceIds.forEach((deviceId) => {
          const parameters = buildModuleParametersForDevice(module, deviceId) ?? {};
          const key = JSON.stringify(parameters);
          const existing = groupedRequests.get(key);
          if (existing) {
            existing.deviceIds.push(deviceId);
          } else {
            groupedRequests.set(key, { parameters, deviceIds: [deviceId] });
          }
        });
        return groupedRequests;
      };

      const executeGroupedRequests = async () => {
        const groupedRequests = buildGroupedRequests();
        return Promise.allSettled(
          Array.from(groupedRequests.values()).map(async ({ parameters, deviceIds: groupDeviceIds }) => {
            if (abortSignal?.aborted) {
              throw { deviceIds: groupDeviceIds, message: 'Execution cancelled' };
            }

            try {
              const response = await fetch(`${normalizedBackendUrl}/api/modules/${apiModuleId}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  device_ids: groupDeviceIds,
                  parameters,
                  workflow_id: workflow.id,
                  workflow_name: workflow.name,
                  module_id: module.id,
                  repeat_count: repeatCountMeta,
                  duration_seconds: durationSecondsMeta,
                  run_iteration: runIteration,
                }),
                signal: abortSignal,
              });

              if (!response.ok) {
                const text = await response.text();
                throw { deviceIds: groupDeviceIds, message: text || `Backend failure (HTTP ${response.status})` };
              }

              const data = await response.json();
              const deviceResults = data?.result?.device_results;
              if (Array.isArray(deviceResults)) {
                return deviceResults.map((entry: any) => ({
                  deviceId: entry.device_id ?? entry.deviceId ?? 'unknown',
                  success: Boolean(entry.success),
                  message:
                    entry.result?.stage_message ||
                    entry.result?.summary ||
                    entry.result?.message ||
                    entry.error ||
                    '',
                }));
              }

              const dataStatus = typeof data.status === 'string' ? data.status.toLowerCase() : 'completed';
              const success =
                typeof data.success === 'boolean' ? data.success : dataStatus !== 'failed' && dataStatus !== 'error';
              const message = data.error || data.message || data.result?.stage_message || data.result?.summary || '';

              return groupDeviceIds.map((deviceId) => ({
                deviceId,
                success,
                message,
              }));
            } catch (error: any) {
              if (error?.name === 'AbortError') {
                throw { deviceIds: groupDeviceIds, message: 'Execution cancelled' };
              }
              throw error;
            }
          })
        );
      };

      const parametersByDevice: Record<string, Record<string, any>> = {};
      deviceIds.forEach((deviceId) => {
        parametersByDevice[deviceId] = buildModuleParametersForDevice(module, deviceId) ?? {};
      });

      let results: PromiseSettledResult<{ deviceId: string; success: boolean; message?: string }[]>[] | null = null;
      try {
        const response = await fetch(`${normalizedBackendUrl}/api/modules/${apiModuleId}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_ids: deviceIds,
            parameters_by_device: parametersByDevice,
            workflow_id: workflow.id,
            workflow_name: workflow.name,
            module_id: module.id,
            repeat_count: repeatCountMeta,
            duration_seconds: durationSecondsMeta,
            run_iteration: runIteration,
          }),
          signal: abortSignal,
        });

        if (!response.ok) {
          const text = await response.text();
          if (response.status === 422 || (response.status === 400 && text.toLowerCase().includes('parameters_by_device'))) {
            results = await executeGroupedRequests();
          } else {
            throw new Error(text || `Backend failure (HTTP ${response.status})`);
          }
        } else {
          const data = await response.json();
          const deviceResults = data?.result?.device_results;
          if (Array.isArray(deviceResults)) {
            results = [
              {
                status: 'fulfilled',
                value: deviceResults.map((entry: any) => ({
                  deviceId: entry.device_id ?? entry.deviceId ?? 'unknown',
                  success: Boolean(entry.success),
                  message:
                    entry.result?.stage_message ||
                    entry.result?.summary ||
                    entry.result?.message ||
                    entry.error ||
                    '',
                })),
              },
            ];
          } else {
            const dataStatus = typeof data.status === 'string' ? data.status.toLowerCase() : 'completed';
            const success =
              typeof data.success === 'boolean' ? data.success : dataStatus !== 'failed' && dataStatus !== 'error';
            const message = data.error || data.message || data.result?.stage_message || data.result?.summary || '';
            results = [
              {
                status: 'fulfilled',
                value: deviceIds.map((deviceId) => ({
                  deviceId,
                  success,
                  message,
                })),
              },
            ];
          }
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          throw { deviceIds, message: 'Execution cancelled' };
        }
        results = await executeGroupedRequests();
      }

      const successes: string[] = [];
      const failures: { deviceId: string; reason: string }[] = [];

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          result.value.forEach((entry: { deviceId: string; success: boolean; message?: string }) => {
            if (entry.success) {
              successes.push(entry.deviceId);
            } else {
              failures.push({
                deviceId: entry.deviceId,
                reason: entry.message || `Module "${module.name}" execution failed.`,
              });
            }
          });
        } else {
          const deviceIds = (result.reason && result.reason.deviceIds) || ['unknown'];
          const reason =
            (result.reason && result.reason.message) ||
            (result.reason instanceof Error ? result.reason.message : `Module "${module.name}" execution failed.`);
          deviceIds.forEach((deviceId: string) => {
            failures.push({ deviceId, reason });
          });
        }
      });

      return { successes, failures };
    },
    []
  );

  const executeBackendWorkflow = useCallback(
    async (backendWorkflowId: string, deviceIds: string[], signal?: AbortSignal) => {
      if (!normalizedBackendUrl) {
        throw new Error('Backend unavailable: no URL configured.');
      }
      const response = await fetch(`${normalizedBackendUrl}/api/workflows/${backendWorkflowId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_ids: deviceIds }),
        signal,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Workflow execution failed (HTTP ${response.status}).`);
      }
      return response.json();
    },
    [normalizedBackendUrl]
  );

  const buildExecutionReport = useCallback(
    (workflow: StoredWorkflow, result: any, deviceIds: string[]): WorkflowExecutionReport => {
      const deviceOutcomes: Record<string, { success: boolean; reasons: string[] }> = {};
      deviceIds.forEach((deviceId) => {
        deviceOutcomes[deviceId] = { success: true, reasons: [] };
      });
      const resultsList: WorkflowExecutionStep[] = (result.results ?? []).map((step: any) => {
        const deviceResults: WorkflowExecutionDeviceResult[] = (step.device_results ?? []).map((deviceResult: any) => {
          const message = deviceResult.result?.stage_message || deviceResult.result?.summary || deviceResult.result?.message || deviceResult.result?.error || '';
          if (!deviceResult.success && deviceOutcomes[deviceResult.device_id]) {
            deviceOutcomes[deviceResult.device_id].success = false;
            if (message) {
              deviceOutcomes[deviceResult.device_id].reasons.push(message);
            } else {
              deviceOutcomes[deviceResult.device_id].reasons.push('Execution failed.');
            }
          }
          return {
            deviceId: deviceResult.device_id,
            success: Boolean(deviceResult.success),
            message,
          };
        });
        return {
          step: step.step ?? 0,
          module: step.module ?? null,
          success: Boolean(step.success),
          deviceResults,
        };
      });
      const successCount = deviceIds.filter((deviceId) => deviceOutcomes[deviceId]?.success !== false).length;
      return {
        executionId: result.execution_id,
        timestamp: new Date().toISOString(),
        status: result.status || 'unknown',
        workflowName: workflow.name,
        deviceIds,
        successCount,
        failureCount: deviceIds.length - successCount,
        results: resultsList,
      };
    },
    []
  );

  const openExportMenu = (event: React.MouseEvent<HTMLElement>, workflow: StoredWorkflow) => {
    setExportMenuAnchor(event.currentTarget);
    setExportMenuWorkflow(workflow);
  };

  const closeExportMenu = () => {
    setExportMenuAnchor(null);
    setExportMenuWorkflow(null);
  };

  const handleExportWorkflowReport = useCallback(
    async (format: 'csv' | 'pdf') => {
      if (!exportMenuWorkflow || !normalizedBackendUrl) {
        closeExportMenu();
        if (!normalizedBackendUrl) {
          setSnackbar({ severity: 'error', message: 'Backend unavailable: no URL configured.' });
        }
        return;
      }
      try {
        let backendWorkflowId = workflowBackendMap[exportMenuWorkflow.id];
        if (!backendWorkflowId) {
          backendWorkflowId = await ensureBackendWorkflow(exportMenuWorkflow);
        }
        const response = await fetch(
          `${normalizedBackendUrl}/api/workflows/${backendWorkflowId}/runs/latest/export/${format}`
        );
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || 'Unable to export workflow run.');
        }
        const blob = await response.blob();
        const extension = format === 'csv' ? 'csv' : 'pdf';
        const filename = `${exportMenuWorkflow.name.replace(/\\s+/g, '_').toLowerCase()}_latest.${extension}`;
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 5000);
        setSnackbar({ severity: 'success', message: `Downloaded ${format.toUpperCase()} report.` });
      } catch (error) {
        setSnackbar({ severity: 'error', message: error instanceof Error ? error.message : 'Unable to export report.' });
      } finally {
        closeExportMenu();
      }
    },
    [exportMenuWorkflow, ensureBackendWorkflow, normalizedBackendUrl, workflowBackendMap]
  );

  const handleRunWorkflow = async (workflow: StoredWorkflow) => {
    if (!backendUrl) {
      setSnackbar({ severity: 'error', message: 'Backend unavailable: no URL configured.' });
      return;
    }

    const deviceIds = selectedDeviceIds.length > 0 ? selectedDeviceIds : readSelectedDeviceIds();
    if (deviceIds.length === 0) {
      setSnackbar({
        severity: 'error',
        message: 'Select one or more devices on the dashboard before running a workflow.',
      });
      return;
    }

    const workflowSummary =
      workflow.modules.map((module) => module.name).filter(Boolean).join(' â†’ ') || workflow.name;
    const repeatSettings = getRepeatSettingsForWorkflow(workflow.id);
    const normalizedRepeatCount = Number.isFinite(repeatSettings.repeatCount)
      ? Math.max(1, Math.trunc(repeatSettings.repeatCount))
      : 1;
    const durationUnit: DurationUnit = repeatSettings.durationUnit ?? 'minutes';
    const durationSeconds = convertDurationToSeconds(repeatSettings.durationValue ?? 0, durationUnit);

    if (workflowCancelControllers.current[workflow.id]) {
      workflowCancelControllers.current[workflow.id].abort();
      delete workflowCancelControllers.current[workflow.id];
    }
    const workflowController = new AbortController();
    workflowCancelControllers.current[workflow.id] = workflowController;
    setWorkflowCancelRequests((prev) => ({ ...prev, [workflow.id]: false }));

    setRunningWorkflows((prev) => ({ ...prev, [workflow.id]: true }));
    setWorkflowActiveModuleIndex((prev) => ({
      ...prev,
      [workflow.id]: workflow.modules.length > 0 ? 0 : null,
    }));
    setWorkflowCompletedModules((prev) => ({ ...prev, [workflow.id]: [] }));
    setWorkflowRunStatus((prev) => ({
      ...prev,
      [workflow.id]: `Planning workflow (${workflowSummary}) for ${deviceIds.length} device${deviceIds.length === 1 ? '' : 's'}â€¦`,
    }));
    setSnackbar({
      severity: 'info',
      message: `Workflow "${workflow.name}" started (${workflowSummary}).`,
    });

    const sessionStart = Date.now();
    const durationWindowMs = durationSeconds * 1000;
    let runCounter = 0;
    let completedRuns = 0;
    let cancelled = false;

    const waitWhilePaused = async () => {
      if (!workflowPauseRef.current[workflow.id]) {
        return;
      }
      setWorkflowRunStatus((prev) => ({
        ...prev,
        [workflow.id]: `Workflow "${workflow.name}" paused. Click resume to continue.`,
      }));
      while (workflowPauseRef.current[workflow.id]) {
        await sleep(500);
      }
      setWorkflowRunStatus((prev) => ({
        ...prev,
        [workflow.id]: `Resuming workflow "${workflow.name}"â€¦`,
      }));
    };

    try {
      while (true) {
        await waitWhilePaused();
        if (isWorkflowCancelled(workflow.id)) {
          cancelled = true;
          break;
        }

        runCounter += 1;
        const runLabel = `Run #${runCounter}`;

        setWorkflowCompletedModules((prev) => ({ ...prev, [workflow.id]: [] }));
        setWorkflowActiveModuleIndex((prev) => ({
          ...prev,
          [workflow.id]: workflow.modules.length > 0 ? 0 : null,
        }));
        setWorkflowRunStatus((prev) => ({
          ...prev,
          [workflow.id]: `Starting ${runLabel} (${workflowSummary}) on ${deviceIds.length} device${deviceIds.length === 1 ? '' : 's'}â€¦`,
        }));

        const deviceOutcomes: Record<string, { success: boolean; reasons: string[] }> = {};
        deviceIds.forEach((deviceId) => {
          deviceOutcomes[deviceId] = { success: true, reasons: [] };
        });

        for (let index = 0; index < workflow.modules.length; index += 1) {
          await waitWhilePaused();
          const module = workflow.modules[index];
          if (isWorkflowCancelled(workflow.id)) {
            cancelled = true;
            break;
          }
          setWorkflowActiveModuleIndex((prev) => ({ ...prev, [workflow.id]: index }));
          setWorkflowRunStatus((prev) => ({
            ...prev,
            [workflow.id]: `${runLabel}: running "${module.name}" on ${deviceIds.length} device${deviceIds.length === 1 ? '' : 's'}â€¦`,
          }));

        const { failures } = await executeModuleForDevices(
            workflow,
            module,
            deviceIds,
            normalizedBackendUrl,
            normalizedRepeatCount,
            durationSeconds,
            runCounter,
            workflowController.signal
          );
          failures.forEach(({ deviceId, reason }) => {
            if (!deviceOutcomes[deviceId]) {
              deviceOutcomes[deviceId] = { success: false, reasons: [reason] };
            } else {
              deviceOutcomes[deviceId].success = false;
              deviceOutcomes[deviceId].reasons.push(`${module.name}: ${reason}`);
            }
          });

          setWorkflowCompletedModules((prev) => {
            const previous = prev[workflow.id] || [];
            if (previous.includes(index)) {
              return prev;
            }
            return {
              ...prev,
              [workflow.id]: [...previous, index],
            };
          });

          const nextModule = workflow.modules[index + 1];
          const shouldDelayBeforeNext =
            index < workflow.modules.length - 1 &&
            !isWaitingModule(module) &&
            !isWaitingModule(nextModule);
          if (shouldDelayBeforeNext) {
            await sleep(2000);
          }
        }
        if (cancelled) {
          break;
        }

        const successes = deviceIds.filter((deviceId) => deviceOutcomes[deviceId]?.success !== false);
        const failedDevices = deviceIds
          .filter((deviceId) => deviceOutcomes[deviceId]?.success === false)
          .map((deviceId) => ({
            deviceId,
            reason: deviceOutcomes[deviceId].reasons.join(' | ') || 'Execution failed.',
          }));

        const timestamp = new Date().toISOString();
        if (successes.length > 0) {
          recordWorkflowRun(workflow.id, timestamp);
          successes.forEach((deviceId) => recordDeviceWorkflowRun(deviceId, workflow.id, workflow.name, timestamp));
        } else {
          updateStoredWorkflow(workflow.id, { lastRunAt: timestamp });
        }
        successes.forEach((deviceId) =>
          recordDeviceActivity({
            deviceId,
            type: 'workflow',
            label: workflow.name,
            status: 'success',
            referenceId: workflow.id,
            timestamp,
          })
        );
        failedDevices.forEach(({ deviceId, reason }) =>
          recordDeviceActivity({
            deviceId,
            type: 'workflow',
            label: workflow.name,
            status: 'failure',
            referenceId: workflow.id,
            details: reason,
            timestamp,
          })
        );
        setWorkflows(getStoredWorkflows());

        if (failedDevices.length === 0) {
          setSnackbar({
            severity: 'success',
            message: `${runLabel} of "${workflow.name}" completed on ${successes.length} device${successes.length === 1 ? '' : 's'}.`,
          });
        } else if (successes.length > 0) {
          const failedList = failedDevices.map((failure) => `${failure.deviceId}`).join(', ');
          setSnackbar({
            severity: 'warning',
            message: `${runLabel} of "${workflow.name}" completed with warnings. Failed for: ${failedList}.`,
          });
        } else {
          const failureReasons = failedDevices.map((failure) => `${failure.deviceId}: ${failure.reason}`).join(' | ');
          setSnackbar({
            severity: 'error',
            message: `${runLabel} of "${workflow.name}" failed on all devices. ${failureReasons}`,
          });
        }
        setWorkflowRunStatus((prev) => ({
          ...prev,
          [workflow.id]:
            failedDevices.length === 0
              ? `${runLabel} completed successfully.`
              : successes.length > 0
                ? `${runLabel} completed with warnings.`
                : `${runLabel} failed.`,
        }));

        completedRuns = runCounter;

        const elapsedMs = Date.now() - sessionStart;
        const needMoreByCount = runCounter < normalizedRepeatCount;
        const needMoreByDuration = durationSeconds > 0 && elapsedMs < durationWindowMs;
        if (!(needMoreByCount || needMoreByDuration)) {
          break;
        }

        setWorkflowRunStatus((prev) => ({
          ...prev,
          [workflow.id]: `${runLabel} completed. Preparing next runâ€¦`,
        }));
        await sleep(1200);
      }

      if (cancelled) {
        setWorkflowRunStatus((prev) => ({
          ...prev,
          [workflow.id]: `Workflow "${workflow.name}" cancelled after ${completedRuns} completed run${completedRuns === 1 ? '' : 's'}.`,
        }));
      } else {
        setWorkflowRunStatus((prev) => ({
          ...prev,
          [workflow.id]: `Workflow "${workflow.name}" completed after ${completedRuns} run${completedRuns === 1 ? '' : 's'}.`,
        }));
      }
      await sleep(1200);
    } catch (error) {
      cancelled = cancelled || isWorkflowCancelled(workflow.id);
      if (cancelled) {
        setSnackbar({
          severity: 'info',
          message: `Workflow "${workflow.name}" cancelled after ${completedRuns} completed run${completedRuns === 1 ? '' : 's'}.`,
        });
        setWorkflowRunStatus((prev) => ({
          ...prev,
          [workflow.id]: `Workflow "${workflow.name}" cancelled after ${completedRuns} completed run${completedRuns === 1 ? '' : 's'}.`,
        }));
      } else {
        const message = error instanceof Error ? error.message : 'Unknown error while communicating with the backend.';
        setSnackbar({ severity: 'error', message: `Failed to run workflow "${workflow.name}": ${message}` });
        setWorkflowRunStatus((prev) => ({
          ...prev,
          [workflow.id]: `Workflow "${workflow.name}" failed${runCounter > 0 ? ` during run #${runCounter}` : ''}: ${message}`,
        }));
      }
      await sleep(1200);
    } finally {
      clearWorkflowCancellation(workflow.id);
      setWorkflowPauseRequests((prev) => {
        const next = { ...prev };
        delete next[workflow.id];
        return next;
      });
      setRunningWorkflows((prev) => {
        const next = { ...prev };
        delete next[workflow.id];
        return next;
      });
      setWorkflowActiveModuleIndex((prev) => {
        const next = { ...prev };
        delete next[workflow.id];
        return next;
      });
      setWorkflowCompletedModules((prev) => {
        const next = { ...prev };
        delete next[workflow.id];
        return next;
      });
      setWorkflowRunStatus((prev) => {
        const next = { ...prev };
        delete next[workflow.id];
        return next;
      });
    }
  };

  const handlePauseWorkflow = (workflowId: string) => {
    setWorkflowPaused(workflowId, true);
  };

  const handleResumeWorkflow = (workflowId: string) => {
    setWorkflowPaused(workflowId, false);
  };
  const formatLastRun = (timestamp: string | null) => {
    if (!timestamp) {
      return 'Never';
    }
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) {
      return 'Never';
    }
    return parsed.toLocaleString();
  };

  return (
    <Layout>
      {/* Header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        mb: 4
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h1" sx={{
            fontSize: '28px',
            lineHeight: '36px',
            fontWeight: 700,
            color: '#0F172A',
            mr: 2
          }}>
            Workflows
          </Typography>
          
          <FormControl size="small">
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              sx={{
                height: 36,
                borderRadius: '10px',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#E5E7EB'
                }
              }}
              IconComponent={ChevronDown}
            >
              <MenuItem value="all">All Workflows ({totalWorkflows})</MenuItem>
              <MenuItem value="active">Active ({activeWorkflows.length})</MenuItem>
              <MenuItem value="draft">Draft ({draftWorkflows.length})</MenuItem>
            </Select>
          </FormControl>

          <Chip
            label={`${selectedDeviceIds.length} device${selectedDeviceIds.length === 1 ? '' : 's'} selected`}
            size="small"
            sx={{
              backgroundColor: '#EEF2FF',
              color: '#2563EB',
              fontWeight: 600
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{
              width: 300,
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
          
          <Button
            variant="contained"
            startIcon={<Plus size={20} />}
            onClick={handleNewWorkflow}
            sx={{
              height: 40,
              borderRadius: '10px',
              backgroundColor: '#2563EB',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: '#1E48C7'
              }
            }}
          >
            New Workflow
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6}>
          <Card sx={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '16px',
            boxShadow: '0 1px 2px rgba(16, 24, 40, 0.06)'
          }}>
            <CardContent sx={{ padding: '20px 24px' }}>
              <Typography sx={{
                fontSize: '16px',
                lineHeight: '24px',
                fontWeight: 600,
                color: '#0F172A',
                mb: 2
              }}>
                Total Workflows
              </Typography>
              <Typography sx={{
                fontSize: '48px',
                fontWeight: 700,
                color: '#0F172A',
                lineHeight: 1
              }}>
                {totalWorkflows}
              </Typography>
              <Typography sx={{
                fontSize: '12px',
                lineHeight: '18px',
                fontWeight: 500,
                color: '#6B7280',
                mt: 1
              }}>
                {activeWorkflows.length} active, {draftWorkflows.length} draft
              </Typography>
            </CardContent>
          </Card>
        </Grid>



        <Grid item xs={12} sm={6}>
          <Card sx={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '16px',
            boxShadow: '0 1px 2px rgba(16, 24, 40, 0.06)'
          }}>
            <CardContent sx={{ padding: '20px 24px' }}>
              <Typography sx={{
                fontSize: '16px',
                lineHeight: '24px',
                fontWeight: 600,
                color: '#0F172A',
                mb: 2
              }}>
                Total Executions
              </Typography>
              <Typography sx={{
                fontSize: '48px',
                fontWeight: 700,
                color: '#0F172A',
                lineHeight: 1
              }}>
                {totalExecutions}
              </Typography>
              <Typography sx={{
                fontSize: '12px',
                lineHeight: '18px',
                fontWeight: 500,
                color: '#6B7280',
                mt: 1
              }}>
                {mostRecentRunLabel ? `Last run ${mostRecentRunLabel}` : 'No runs recorded yet'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Workflows List */}
      <Card sx={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '16px',
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.06)'
      }}>
        <CardContent sx={{ padding: '20px 24px' }}>
          <Typography sx={{
            fontSize: '16px',
            lineHeight: '24px',
            fontWeight: 600,
            color: '#0F172A',
            mb: 3
          }}>
            Workflows
          </Typography>
          {scheduleFetchError && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {scheduleFetchError}
            </Alert>
          )}

          <Grid container spacing={3}>
            {filteredWorkflows.map((workflow) => {
              const statusStyle = getStatusColor(workflow.status);
              const modulesCount = workflow.modules.length;
              const estimatedDuration = `${Math.max(1, modulesCount * 2)}-${Math.max(1, modulesCount * 3)}m`;
              const description = workflow.description && workflow.description.trim().length > 0
                ? workflow.description
                : 'No description provided.';
              const modulePreview = workflow.modules.slice(0, 4).map((module, index) => {
                const base = moduleCatalogMap.get(module.id);
                const label = base?.name || module.name || module.id;
                const paramCount = module.callTestParams ? Object.keys(module.callTestParams).length : 0;
                const suffix = paramCount > 0 ? ` Â· ${paramCount} param${paramCount > 1 ? 's' : ''}` : '';
                return `${index + 1}. ${label}${suffix}`;
              });
              const extraModules = workflow.modules.length - modulePreview.length;
              const isRunning = Boolean(runningWorkflows[workflow.id]);
              const runStatusMessage = workflowRunStatus[workflow.id];
              const activeModuleIndex = workflowActiveModuleIndex[workflow.id];
              const completedModules = workflowCompletedModules[workflow.id] || [];
              const repeatSettings = getRepeatSettingsForWorkflow(workflow.id);
              return (
                <Grid item xs={12} key={workflow.id}>
                  <Card sx={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    transition: 'all 0.2s',
                    '&:hover': {
                      boxShadow: '0 4px 8px rgba(16, 24, 40, 0.12)',
                      borderColor: '#2563EB'
                    }
                  }}>
                    <CardContent sx={{ padding: '16px 20px' }}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box flex={1}>
                          <Box display="flex" alignItems="center" gap={2} mb={1}>
                            <Typography variant="h6" sx={{
                              fontSize: '16px',
                              fontWeight: 600,
                              color: '#0F172A'
                            }}>
                              {workflow.name}
                            </Typography>
                            <Chip
                              label={workflow.status}
                              size="small"
                              sx={{
                                backgroundColor: statusStyle.bg,
                                color: statusStyle.color,
                                fontWeight: 600,
                                fontSize: '11px',
                                textTransform: 'capitalize'
                              }}
                            />
                          </Box>
                          
                          <Typography variant="body2" sx={{
                            color: '#6B7280',
                            mb: 2,
                            fontSize: '14px'
                          }}>
                          {description}
                        </Typography>

                        {scheduleSummaries[workflow.id] && (
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1.5,
                              backgroundColor: '#E0F2FE',
                              borderRadius: '10px',
                              padding: '8px 12px',
                              mb: 2,
                            }}
                          >
                            <Typography sx={{ fontSize: '13px', color: '#0369A1', flex: 1 }}>
                              Scheduled for {formatScheduleLabel(scheduleSummaries[workflow.id].nextRunAt)} â€¢{' '}
                              {scheduleSummaries[workflow.id].deviceIds.length} device
                              {scheduleSummaries[workflow.id].deviceIds.length === 1 ? '' : 's'}
                            </Typography>
                            <Button
                              size="small"
                              variant="text"
                              color="warning"
                              onClick={() => handleCancelSchedule(workflow.id)}
                              sx={{ textTransform: 'none' }}
                            >
                              Cancel
                            </Button>
                          </Box>
                        )}

                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 2 }}>
                          {workflow.modules.map((module, moduleIndex) => {
                            const isActive = activeModuleIndex === moduleIndex;
                            const isCompleted = completedModules.includes(moduleIndex);
                            const backgroundColor = isActive
                              ? '#2563EB'
                              : isCompleted
                                ? '#D1FAE5'
                                : '#E0E7FF';
                            const color = isActive ? '#FFFFFF' : isCompleted ? '#065F46' : '#1E3A8A';
                            const moduleLabel = `${moduleIndex + 1}. ${module.name}`;
                            const uniqueKey = `${workflow.id}-${module.id}-${moduleIndex}`;
                            const moduleTooltip = getModuleTooltipLabel(module);
                            const chip = (
                              <Chip
                                label={moduleLabel}
                                size="small"
                                sx={{
                                  backgroundColor,
                                  color,
                                  mb: 1,
                                  fontWeight: isActive ? 700 : 500,
                                }}
                              />
                            );
                            return (
                              <ModuleTooltipWrapper key={uniqueKey} title={moduleTooltip}>
                                {chip}
                              </ModuleTooltipWrapper>
                            );
                          })}
                        </Stack>

                          <Box display="flex" gap={4}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Settings size={16} color="#6B7280" />
                              <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                                {modulesCount} module{modulesCount === 1 ? '' : 's'}
                              </Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Clock size={16} color="#6B7280" />
                              <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                                {estimatedDuration}
                              </Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                              <CheckCircle size={16} color={workflow.runCount > 0 ? '#16A34A' : '#94A3B8'} />
                              <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                                {workflow.runCount} run{workflow.runCount === 1 ? '' : 's'}
                              </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ color: '#6B7280', fontSize: '12px' }}>
                              Last run: {formatLastRun(workflow.lastRunAt)}
                            </Typography>
                          </Box>
                          {runStatusMessage && (
                            <Typography variant="caption" sx={{ color: '#2563EB', display: 'block', mt: 1 }}>
                              {runStatusMessage}
                            </Typography>
                          )}
                        </Box>

                        <Box display="flex" flexDirection="column" alignItems="flex-end" gap={1.5}>
                          <Box display="flex" gap={1}>
                            <Tooltip title="Clone Workflow">
                              <IconButton
                                onClick={() => handleCloneWorkflow(workflow)}
                                sx={{
                                  backgroundColor: '#E2E8F0',
                                  color: '#0F172A',
                                  width: 36,
                                  height: 36,
                                  '&:hover': {
                                    backgroundColor: '#CBD5E1'
                                  }
                                }}
                              >
                                <Copy size={16} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Schedule Workflow">
                              <IconButton
                                onClick={() => handleOpenScheduleDialog(workflow)}
                                sx={{
                                  backgroundColor: '#E0E7FF',
                                  color: '#1E3A8A',
                                  width: 36,
                                  height: 36,
                                  '&:hover': {
                                    backgroundColor: '#C7D2FE'
                                  }
                                }}
                              >
                                <Clock size={16} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip
                              title={
                                !isRunning
                                  ? 'Run Workflow'
                                  : isWorkflowPaused(workflow.id)
                                    ? 'Resume Workflow'
                                    : 'Pause Workflow'
                              }
                            >
                              <IconButton
                                onClick={() => {
                                  if (!isRunning) {
                                    handleRunWorkflow(workflow);
                                  } else if (isWorkflowPaused(workflow.id)) {
                                    handleResumeWorkflow(workflow.id);
                                  } else {
                                    handlePauseWorkflow(workflow.id);
                                  }
                                }}
                                sx={{
                                  backgroundColor: !isRunning
                                    ? '#2563EB'
                                    : isWorkflowPaused(workflow.id)
                                      ? '#DCFCE7'
                                      : '#FEF3C7',
                                  color: !isRunning
                                    ? '#FFFFFF'
                                    : isWorkflowPaused(workflow.id)
                                      ? '#15803D'
                                      : '#B45309',
                                  width: 36,
                                  height: 36,
                                  '&:hover': {
                                    backgroundColor: !isRunning
                                      ? '#1E48C7'
                                      : isWorkflowPaused(workflow.id)
                                        ? '#BBF7D0'
                                        : '#FDE68A',
                                  },
                                }}
                              >
                                {!isRunning ? <Play size={16} /> : isWorkflowPaused(workflow.id) ? <Play size={16} /> : <Pause size={16} />}
                              </IconButton>
                            </Tooltip>
                            {isRunning && (
                            <Tooltip title="Cancel Workflow">
                              <IconButton
                                onClick={() => handleStopWorkflow(workflow.id)}
                                aria-label="Cancel workflow"
                                sx={{
                                  backgroundColor: '#FEE2E2',
                                  color: '#B91C1C',
                                  width: 36,
                                    height: 36,
                                    '&:hover': {
                                      backgroundColor: '#FECACA'
                                    }
                                  }}
                                >
                                  <StopCircle size={16} />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Edit Workflow">
                              <IconButton
                                onClick={() => {
                                  setEditingWorkflow(workflow);
                                  setEditorOpen(true);
                                }}
                                sx={{
                                  backgroundColor: '#F1F5F9',
                                  color: '#475569',
                                  width: 36,
                                  height: 36,
                                  '&:hover': {
                                    backgroundColor: '#E2E8F0'
                                  }
                                }}
                              >
                                <Edit size={16} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Workflow">
                              <IconButton
                                onClick={() => handleDeleteWorkflow(workflow)}
                                disabled={isRunning}
                                sx={{
                                  backgroundColor: '#FEF2F2',
                                  color: '#DC2626',
                                  width: 36,
                                  height: 36,
                                  '&:hover': {
                                    backgroundColor: '#FEE2E2'
                                  }
                                }}
                              >
                                <Trash2 size={16} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
      </CardContent>
    </Card>

      <Dialog open={scheduleDialogOpen} onClose={handleScheduleDialogClose} fullWidth maxWidth="xs">
        <DialogTitle>Schedule Workflow</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography sx={{ color: '#0F172A', fontWeight: 600 }}>
              {scheduleTargetWorkflow?.name ?? 'Select a workflow'}
            </Typography>
            <TextField
              label="Delay before run (minutes)"
              type="number"
              value={scheduleDelayMinutes}
              onChange={(event) => {
                setScheduleDelayMinutes(event.target.value);
                setScheduleDialogError(null);
              }}
              inputProps={{ min: 1 }}
            />
            {schedulePreviewTime && (
              <Typography variant="caption" sx={{ color: '#475569' }}>
                Will run around {schedulePreviewTime}.
              </Typography>
            )}
            <Typography variant="body2" sx={{ color: '#475569' }}>
              Devices targeted: {scheduleDeviceIds.length}
            </Typography>
            {scheduleDialogError && <Alert severity="error">{scheduleDialogError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleScheduleDialogClose}>Close</Button>
          <Button variant="contained" onClick={handleScheduleSave}>
            Schedule
          </Button>
        </DialogActions>
      </Dialog>

  <WorkflowEditorDialog
        open={editorOpen}
        workflow={editingWorkflow}
        modulesCatalog={sortedModuleCatalog}
        onClose={handleCloseEditor}
        onSubmit={handleEditorSubmit}
        repeatSettings={
          editingWorkflow ? getRepeatSettingsForWorkflow(editingWorkflow.id) : DEFAULT_REPEAT_SETTINGS
        }
      />

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {snackbar ? (
          <Alert severity={snackbar.severity} onClose={() => setSnackbar(null)} sx={{ borderRadius: '8px' }}>
            {snackbar.message}
          </Alert>
        ) : null}
      </Snackbar>
  </Layout>
);
};

interface WorkflowEditorDialogProps {
  open: boolean;
  workflow: StoredWorkflow | null;
  modulesCatalog: ModuleMetadata[];
  onClose: () => void;
  onSubmit: (data: WorkflowEditorData, workflowId?: string) => void;
  repeatSettings: RepeatDurationSettings;
}

const WorkflowEditorDialog: React.FC<WorkflowEditorDialogProps> = ({
  open,
  workflow,
  modulesCatalog,
  onClose,
  onSubmit,
  repeatSettings: repeatSettingsProp,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedModules, setSelectedModules] = useState<ModuleMetadata[]>([]);
  const [moduleToAdd, setModuleToAdd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [repeatCountInput, setRepeatCountInput] = useState<string>(String(repeatSettingsProp.repeatCount));
  const [durationValueInput, setDurationValueInput] = useState<string>(String(repeatSettingsProp.durationValue));
  const [durationUnit, setDurationUnit] = useState<DurationUnit>(repeatSettingsProp.durationUnit);
  const [draggingModuleIndex, setDraggingModuleIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setName(workflow?.name ?? '');
    setDescription(workflow?.description ?? '');
    setSelectedModules((workflow?.modules ?? []).map((module) => cloneModuleForWorkflow(module)));
    setModuleToAdd('');
    setError(null);
    setRepeatCountInput(String(repeatSettingsProp.repeatCount));
    setDurationValueInput(String(repeatSettingsProp.durationValue));
    setDurationUnit(repeatSettingsProp.durationUnit);
  }, [open, workflow, repeatSettingsProp]);

  const availableModules = useMemo(() => modulesCatalog, [modulesCatalog]);

  const handleAddModule = () => {
    if (!moduleToAdd) {
      return;
    }
    const module = modulesCatalog.find((item) => item.id === moduleToAdd);
    if (!module) {
      return;
    }
    const hydratedModule =
      module.id === WAITING_TIME_MODULE_ID
        ? { ...module, waitDurationSeconds: getStoredWaitingTimeDuration() }
        : module;
    setSelectedModules((prev) => [...prev, cloneModuleForWorkflow(hydratedModule)]);
    setModuleToAdd('');
  };

  const handleRemoveModule = (indexToRemove: number) => {
    setSelectedModules((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const moveModule = (index: number, direction: -1 | 1) => {
    setSelectedModules((prev) => {
      const newModules = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= newModules.length) {
        return prev;
      }
      const temp = newModules[index];
      newModules[index] = newModules[targetIndex];
      newModules[targetIndex] = temp;
      return newModules;
    });
  };

  const reorderSelectedModulePositions = useCallback((sourceIndex: number, targetIndex: number) => {
    setSelectedModules((prev) => {
      if (
        sourceIndex === targetIndex ||
        sourceIndex < 0 ||
        targetIndex < 0 ||
        sourceIndex >= prev.length ||
        targetIndex > prev.length
      ) {
        return prev;
      }
      const next = [...prev];
      const [removed] = next.splice(sourceIndex, 1);
      let destinationIndex = targetIndex;
      if (sourceIndex < targetIndex) {
        destinationIndex = Math.max(0, targetIndex - 1);
      }
      destinationIndex = Math.min(destinationIndex, next.length);
      next.splice(destinationIndex, 0, removed);
      return next;
    });
  }, []);

  const handleModuleDragStart = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.dataTransfer.setData('text/plain', String(index));
    event.dataTransfer.effectAllowed = 'move';
    setDraggingModuleIndex(index);
  };

  const handleModuleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleModuleDrop = (event: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    event.preventDefault();
    const sourceIndexString = event.dataTransfer.getData('text/plain');
    const sourceIndex = sourceIndexString !== '' ? Number(sourceIndexString) : draggingModuleIndex;
    if (sourceIndex === null || Number.isNaN(sourceIndex)) {
      setDraggingModuleIndex(null);
      return;
    }
    reorderSelectedModulePositions(sourceIndex, targetIndex);
    setDraggingModuleIndex(null);
  };

  const handleModuleDragEnd = () => {
    setDraggingModuleIndex(null);
  };

  const handleWaitDurationChange = (index: number, value: number) => {
    setSelectedModules((prev) => {
      const next = [...prev];
      if (!next[index]) {
        return prev;
      }
      next[index] = {
        ...next[index],
        waitDurationSeconds: sanitizeWaitDurationSeconds(value),
      };
      return next;
    });
  };

  const handleSave = () => {
    if (!name.trim()) {
      setError('Workflow name is required.');
      return;
    }
    if (selectedModules.length === 0) {
      setError('Add at least one module.');
      return;
    }
    setError(null);
    const normalizedDescription = description.trim();
    const descriptionValue = normalizedDescription.length > 0 ? normalizedDescription : '';
    const parsedRepeat = Number.parseInt(repeatCountInput, 10);
    const parsedDuration = Number.parseInt(durationValueInput, 10);
    const normalizedRepeat = Number.isFinite(parsedRepeat) && parsedRepeat >= 1 ? Math.trunc(parsedRepeat) : 1;
    const normalizedDuration =
      Number.isFinite(parsedDuration) && parsedDuration >= 0 ? Math.trunc(parsedDuration) : 0;

    onSubmit(
      {
        name: name.trim(),
        description: descriptionValue,
        modules: selectedModules.map((module) => cloneModuleForWorkflow(module)),
        tags: workflow?.tags ?? [],
        repeatSettings: {
          repeatCount: normalizedRepeat,
          durationValue: normalizedDuration,
          durationUnit,
        },
      },
      workflow?.id
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{workflow ? 'Edit Workflow' : 'New Workflow'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Workflow name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            fullWidth
            autoFocus
          />
          <TextField
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <Typography variant="subtitle2" sx={{ color: '#0F172A' }}>
            Repeat
          </Typography>
          <TextField
            label="Repeat count"
            type="number"
            value={repeatCountInput}
            onChange={(event) => {
              setRepeatCountInput(event.target.value);
            }}
            inputProps={{ min: 1 }}
            fullWidth
          />

          <Typography variant="subtitle2" sx={{ color: '#0F172A' }}>
            Duration
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              label="Keep running"
              type="number"
              value={durationValueInput}
              onChange={(event) => {
                setDurationValueInput(event.target.value);
              }}
              inputProps={{ min: 0 }}
              sx={{ flex: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <Select
                value={durationUnit}
                onChange={(event) => setDurationUnit(event.target.value as DurationUnit)}
              >
                <MenuItem value="minutes">Minutes</MenuItem>
                <MenuItem value="hours">Hours</MenuItem>
                <MenuItem value="days">Days</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <Typography variant="subtitle2" sx={{ color: '#0F172A' }}>
            Modules
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">
            <FormControl fullWidth size="small">
              <Select
                value={moduleToAdd}
                onChange={(event) => setModuleToAdd(event.target.value)}
                displayEmpty
              >
                <MenuItem value="" disabled>
                  Select module
                </MenuItem>
                {availableModules.map((module) => (
                  <MenuItem key={module.id} value={module.id}>
                    {module.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              onClick={handleAddModule}
              disabled={!moduleToAdd}
              sx={{ textTransform: 'none' }}
            >
              Add
            </Button>
          </Stack>

          {selectedModules.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#6B7280' }}>
              No modules selected yet.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {selectedModules.map((module, index) => {
                const moduleTooltip = getModuleTooltipLabel(module);
                const row = (
                  <Box
                    draggable
                    onDragStart={(event) => handleModuleDragStart(event, index)}
                    onDragOver={handleModuleDragOver}
                    onDrop={(event) => handleModuleDrop(event, index)}
                    onDragEnd={handleModuleDragEnd}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 2,
                      backgroundColor: '#F8FAFC',
                      border: `1px ${draggingModuleIndex === index ? 'dashed' : 'solid'} #E5E7EB`,
                      borderRadius: '8px',
                      padding: '8px 12px',
                      cursor: 'grab',
                      opacity: draggingModuleIndex === index ? 0.85 : 1,
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 500, color: '#0F172A' }}>
                        {index + 1}. {module.name}
                      </Typography>
                      {isWaitingModule(module) ? (
                        <Typography variant="caption" sx={{ color: '#475569' }}>
                          Wait {module.waitDurationSeconds ?? DEFAULT_WAIT_DURATION_SECONDS} second(s)
                        </Typography>
                      ) : null}
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {isWaitingModule(module) ? (
                        <TextField
                          size="small"
                          type="number"
                          label="Seconds"
                          value={module.waitDurationSeconds ?? DEFAULT_WAIT_DURATION_SECONDS}
                          onChange={(event) => {
                            const parsed = Number(event.target.value);
                            if (Number.isFinite(parsed)) {
                              handleWaitDurationChange(index, parsed);
                            }
                          }}
                          inputProps={{ min: MIN_WAIT_DURATION_SECONDS, max: MAX_WAIT_DURATION_SECONDS }}
                          sx={{ width: 120 }}
                        />
                      ) : null}
                      <IconButton
                        size="small"
                        onClick={() => moveModule(index, -1)}
                        disabled={index === 0}
                      >
                        <ArrowUp size={16} />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => moveModule(index, 1)}
                        disabled={index === selectedModules.length - 1}
                      >
                        <ArrowDown size={16} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleRemoveModule(index)}>
                        <X size={16} />
                      </IconButton>
                    </Stack>
                  </Box>
                );
                return (
                  <ModuleTooltipWrapper key={`${module.id}-${index}`} title={moduleTooltip}>
                    {row}
                  </ModuleTooltipWrapper>
                );
              })}
              <Box
                sx={{
                  border: draggingModuleIndex === null ? '1px dashed transparent' : '1px dashed #CBD5F5',
                  borderRadius: '8px',
                  padding: '6px',
                  textAlign: 'center',
                  color: '#94A3B8',
                  fontSize: '12px',
                  transition: 'border-color 0.2s ease, color 0.2s ease',
                }}
                onDragOver={handleModuleDragOver}
                onDrop={(event) => handleModuleDrop(event, selectedModules.length)}
              >
                {draggingModuleIndex === null ? 'Drag to reorder modules' : 'Drop here to move to the end'}
              </Box>
            </Stack>
          )}

          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} sx={{ textTransform: 'none' }}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FlowComposer;
