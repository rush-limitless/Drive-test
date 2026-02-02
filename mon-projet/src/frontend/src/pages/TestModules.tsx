import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  Chip,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  Play,
  StopCircle,
  Pencil,
  Timer,
  Search,
  Star,
  StarOff,
  Airplay,
  AirVent,
  Wifi,
  Smartphone,
  AlertTriangle,
  FilePlus,
  Radio as RadioIcon,
  PhoneCall,
  Activity,
  SignalHigh,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

import Layout from '../components/Layout';
import CallTestDialog, { CallTestMode } from '../components/CallTestDialog';
import { MODULE_CATALOG, ModuleMetadata } from '../data/modules';
import { addStoredWorkflow } from '../utils/workflows';
import { readSelectedDeviceIds, SELECTED_DEVICES_EVENT } from '../utils/deviceSelection';
import { useDevices } from '../hooks/useDevices';
import { recordDeviceActivity } from '../utils/deviceActivity';
import { CallTestValues } from '../types/callTest';
import { resolveBaseUrl, fetchWithRetry } from '../services/utils';

interface TestModulesProps {
  backendUrl: string;
}

const scriptPath = (file: string) => `adb_scripts/${file}`;

type SnackbarSeverity = 'success' | 'info' | 'error' | 'warning';

const CALL_TEST_STORAGE_KEY = 'callTestParams';
const GLOBAL_CALL_TEST_KEY = '__global__';

const CALL_TEST_DEFAULTS: CallTestValues = {
  countryCode: '+237',
  phoneNumber: '691234567',
  duration: 30,
  callCount: 1,
};
const WAITING_TIME_STORAGE_KEY = 'waitingTimeDurationSeconds';
const PING_CONFIG_STORAGE_KEY = 'pingModuleConfig';
const WORKFLOW_BUILDER_STORAGE_KEY = 'workflowBuilderDraft';
const FAVORITES_STORAGE_KEY = 'moduleFavorites';
const RECENTS_STORAGE_KEY = 'moduleRecents';
const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_DIAL_SECRET_CODE = '*#9900#';
interface PingConfig {
  target: string;
  duration: number;
  interval: number;
}

interface PingDialogState {
  target: string;
  duration: string;
  interval: string;
}

interface WorkflowBuilderDraftModule {
  id: string;
  waitDurationSeconds?: number;
  callTestParams?: CallTestValues;
  secretCode?: string;
  appLaunchTarget?: string;
  appLaunchDurationSeconds?: number;
  pingTarget?: string;
  pingDurationSeconds?: number;
  pingIntervalSeconds?: number;
  wrongApnValue?: string;
  logPullDestination?: string;
}

interface WorkflowBuilderDraft {
  name: string;
  description: string;
  showBuilder: boolean;
  modules: WorkflowBuilderDraftModule[];
}

const resolveModuleFailureReason = (payload: unknown): string | undefined => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const candidateError = (payload as Record<string, unknown>).error;
  if (typeof candidateError === 'string' && candidateError.trim().length > 0) {
    return candidateError.trim();
  }
  const candidateDetail = (payload as Record<string, unknown>).detail;
  if (typeof candidateDetail === 'string' && candidateDetail.trim().length > 0) {
    return candidateDetail.trim();
  }
  const candidateMessage = (payload as Record<string, unknown>).message;
  if (typeof candidateMessage === 'string' && candidateMessage.trim().length > 0) {
    return candidateMessage.trim();
  }
  const candidateOutput = (payload as Record<string, unknown>).output;
  if (typeof candidateOutput === 'string' && candidateOutput.trim().length > 0) {
    return candidateOutput.trim();
  }
  return undefined;
};

const normalizeModuleError = (value?: string): string | undefined => {
  if (!value || !value.trim()) {
    return undefined;
  }
  const trimmed = value.trim();
  const lowered = trimmed.toLowerCase();
  if (lowered.includes('chrome package not installed')) {
    return 'Chrome is not installed on this device. Install Chrome or select another target.';
  }
  return trimmed;
};


const chunkDeviceIds = (deviceIds: string[], size: number) => {
  const safeSize = Math.max(1, size);
  const chunks: string[][] = [];
  for (let index = 0; index < deviceIds.length; index += safeSize) {
    chunks.push(deviceIds.slice(index, index + safeSize));
  }
  return chunks;
};


const formatExecutionError = (error: unknown): { message: string; action?: string } => {
  if (error && typeof error === 'object') {
    const status = (error as { status?: number }).status;
    const rawText = (error as { text?: unknown }).text;
    const text = typeof rawText === 'string' ? rawText.trim().slice(0, 200) : '';
    if (typeof status === 'number') {
      const message = text ? `Backend error (HTTP ${status}): ${text}` : `Backend error (HTTP ${status}).`;
      const action =
        status >= 500
          ? 'Check backend logs and retry.'
          : status === 401 || status === 403
            ? 'Verify credentials and permissions.'
            : 'Check request parameters and retry.';
      return { message, action };
    }
  }
  if (error instanceof Error) {
    const lowered = error.message.toLowerCase();
    if (lowered.includes('failed to fetch') || lowered.includes('network') || lowered.includes('load failed')) {
      return {
        message: 'Network error while contacting the backend.',
        action: 'Check connectivity and backend status, then retry.',
      };
    }
    return {
      message: error.message || 'Backend error during module execution.',
      action: 'Retry. If it persists, check backend logs.',
    };
  }
  return {
    message: 'Unexpected error while running the module.',
    action: 'Retry. If it persists, check backend logs.',
  };
};

type DeviceModuleResult = {
  deviceId: string;
  success: boolean;
  response?: Record<string, unknown>;
  error?: string;
};

type DeviceNotification = {
  id: string;
  moduleId: string;
  deviceId: string;
  success: boolean;
  message: string;
};

type DeviceModuleRunSnapshot = {
  moduleId: string;
  timestamp: string;
  results: DeviceModuleResult[];
};


const MODULE_ICON_MAP: Record<string, React.ComponentType<any>> = {
  enable_airplane_mode: Airplay,
  disable_airplane_mode: AirVent,
  ping: SignalHigh,
  activate_data: Wifi,
  launch_app: Smartphone,
  wrong_apn_configuration: AlertTriangle,
  pull_device_logs: FilePlus,
  pull_rf_logs: RadioIcon,
  start_rf_logging: RadioIcon,
  stop_rf_logging: RadioIcon,
  dial_secret_code: PhoneCall,
  default: Activity,
};

type ModuleStatusEntry = {
  status_id: string;
  execution_id: string;
  module_id: string;
  module_name?: string;
  state: 'running' | 'completed';
  device_ids: string[];
  pending_device_ids: string[];
  device_results: DeviceModuleResult[];
  success?: boolean;
  started_at: string;
  completed_at?: string;
  summary?: string;
  stage_message?: string;
  success_count?: number;
  failure_count?: number;
};

const formatDeviceMessage = (result: DeviceModuleResult): string => {
  const payload = (result.response as any)?.result ?? result.response;
  const candidateMessage =
    (payload && typeof payload.message === 'string' && payload.message.trim()) ||
    (payload && typeof payload.stage_message === 'string' && payload.stage_message.trim()) ||
    (payload && typeof payload.summary === 'string' && payload.summary.trim());
  if (result.error) {
    return result.error;
  }
  if (candidateMessage) {
    return candidateMessage;
  }
  if (payload && typeof payload === 'object') {
    const serialized = JSON.stringify(payload);
    return serialized.length > 80 ? `${serialized.slice(0, 80)}...` : serialized;
  }
  return 'No details available';
};

const buildDeviceNotificationMessage = (results: DeviceModuleResult[]): string => {
  const entries = results
    .map((result) => {
      const stateLabel = result.success ? 'Success' : 'Failed';
      return `${result.deviceId}: ${stateLabel}`;
    })
    .filter((entry) => entry && entry.trim().length > 0);
  return entries.join(' | ');
};

const resolveApiKey = (): string | null => {
  const envKey =
    (import.meta as any).env?.VITE_API_KEY ||
    (import.meta as any).env?.VITE_REACT_APP_API_KEY ||
    (typeof process !== 'undefined' ? process.env.REACT_APP_API_KEY || process.env.API_KEY : undefined);
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem('API_KEY') : null;
  return (stored && stored.trim()) || (envKey && envKey.trim()) || null;
};

const authHeaders = () => {
  const key = resolveApiKey();
  return key ? { 'X-API-Key': key } : {};
};

const parseDurationEstimateMs = (value?: string): number | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.includes('varies')) {
    return null;
  }
  const rangeMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  const singleMatch = trimmed.match(/(\d+(?:\.\d+)?)/);
  const toNumber = (match?: RegExpMatchArray | null, index = 1) =>
    match ? Number.parseFloat(match[index]) : Number.NaN;
  const unit = trimmed.includes('hour') || trimmed.includes('hr') ? 'h' : trimmed.includes('min') ? 'm' : 's';
  let valueSeconds: number | null = null;
  if (rangeMatch) {
    const low = toNumber(rangeMatch, 1);
    const high = toNumber(rangeMatch, 2);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      valueSeconds = (low + high) / 2;
    }
  } else if (singleMatch) {
    const single = toNumber(singleMatch, 1);
    if (Number.isFinite(single)) {
      valueSeconds = single;
    }
  }
  if (!valueSeconds) {
    return null;
  }
  if (unit === 'h') {
    return valueSeconds * 60 * 60 * 1000;
  }
  if (unit === 'm') {
    return valueSeconds * 60 * 1000;
  }
  return valueSeconds * 1000;
};

const createWorkflowInstance = (module: ModuleMetadata): WorkflowModuleInstance => ({
  instanceId: `${module.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  module,
});

const parseDragPayload = (
  value: string | null
): { source: 'catalog' | 'builder'; id: string } | null => {
  if (!value) {
    return null;
  }
  if (value.startsWith('catalog:')) {
    return { source: 'catalog', id: value.replace('catalog:', '') };
  }
  if (value.startsWith('builder:')) {
    return { source: 'builder', id: value.replace('builder:', '') };
  }
  return null;
};

const DEFAULT_PING_CONFIG: PingConfig = {
  target: '8.8.8.8',
  duration: 10,
  interval: 1.0,
};
type AppLauncherOption = 'youtube' | 'maps' | 'chrome_news';

const APP_LAUNCHER_STORAGE_KEY = 'appLauncherSelection';
const APP_LAUNCHER_OPTIONS: AppLauncherOption[] = ['youtube', 'maps', 'chrome_news'];
const APP_LAUNCHER_DISPLAY: Record<AppLauncherOption, string> = {
  youtube: 'YouTube',
  maps: 'Maps navigation',
  chrome_news: 'Chrome news site',
};

const readAppLauncherSelection = (): AppLauncherOption => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return 'youtube';
  }
  const stored = window.localStorage.getItem(APP_LAUNCHER_STORAGE_KEY) as AppLauncherOption | null;
  if (stored && APP_LAUNCHER_DISPLAY[stored]) {
    return stored;
  }
  return 'youtube';
};
const WAITING_TIME_DEFAULT_DURATION = 5;
const WAITING_TIME_MIN_DURATION = 1;
const WAITING_TIME_MAX_DURATION = 600;

const IPV4_SEGMENT = '(?:25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})';
const IPV4_REGEX = new RegExp(`^(?:${IPV4_SEGMENT}\\.){3}${IPV4_SEGMENT}$`);
const HOSTNAME_SEGMENT_REGEX = /^[a-zA-Z0-9-]{1,63}$/;

const isValidIpv4 = (value: string): boolean => IPV4_REGEX.test(value);
const isValidHostnameSegment = (segment: string): boolean =>
  HOSTNAME_SEGMENT_REGEX.test(segment) && !segment.startsWith('-') && !segment.endsWith('-');

const isValidHostname = (value: string): boolean => {
  if (!value || value.length > 253) {
    return false;
  }
  if (value === 'localhost') {
    return true;
  }
  const segments = value.split('.');
  if (segments.length < 2) {
    return false;
  }
  return segments.every((segment) => isValidHostnameSegment(segment));
};

const isValidPingTarget = (value: string): boolean => isValidIpv4(value) || isValidHostname(value);

const readFavorites = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((v) => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
};

const persistFavorites = (favorites: Set<string>) => {
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favorites)));
  } catch {
    // ignore
  }
};

const readRecents = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((v) => typeof v === 'string').slice(0, 8) : [];
  } catch {
    return [];
  }
};

const persistRecents = (recents: string[]) => {
  try {
    window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(recents.slice(0, 8)));
  } catch {
    // ignore
  }
};

const CUSTOM_CODE_KEY = 'dialSecretCode';
const readStoredCustomCode = (): string => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return DEFAULT_DIAL_SECRET_CODE;
  }
  const stored = window.localStorage.getItem(CUSTOM_CODE_KEY);
  const trimmed = stored ? stored.trim() : '';
  return trimmed || DEFAULT_DIAL_SECRET_CODE;
};

const persistCustomCode = (value: string) => {
  try {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      window.localStorage.setItem(CUSTOM_CODE_KEY, value || '');
    }
  } catch {
    // ignore
  }
};

const sanitizeSecretCode = (value: string): string =>
  value.replace(/[^0-9*#]/g, '').trim();

const validatePingTarget = (raw: string): string | null => {
  const value = raw.trim();
  if (!value) {
    return 'Target is required.';
  }
  if (!isValidPingTarget(value)) {
    return 'Enter a valid IP address or domain (e.g. 8.8.8.8 or example.com).';
  }
  return null;
};

const PING_TARGET_HELPER_TEXT = 'e.g. 8.8.8.8 or example.com';

const toPingDraft = (config: PingConfig): PingDialogState => ({
  target: config.target,
  duration: String(config.duration),
  interval: String(config.interval),
});


const READY_DEVICE_STATUSES = new Set(['connected', 'online', 'busy', 'in_use', 'idle']);

const isDeviceSelectable = (status?: string | null): boolean => {
  if (!status || typeof status !== 'string') {
    return false;
  }
  return READY_DEVICE_STATUSES.has(status.toLowerCase());
};

const sanitizeCallTestValues = (values: CallTestValues): CallTestValues => {
  const countryDigits = values.countryCode.replace(/[^0-9]/g, '');
  const normalizedCountry = countryDigits ? `+${countryDigits}` : CALL_TEST_DEFAULTS.countryCode;
  const normalizedPhone = values.phoneNumber.replace(/[^0-9]/g, '') || CALL_TEST_DEFAULTS.phoneNumber;

  return {
    countryCode: normalizedCountry,
    phoneNumber: normalizedPhone,
    duration: Math.max(1, Math.min(600, Math.trunc(values.duration))),
    callCount: Math.max(1, Math.min(10, Math.trunc(values.callCount))),
  };
};

const isStoredCallTestValues = (value: unknown): value is CallTestValues => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.countryCode === 'string' &&
    typeof candidate.phoneNumber === 'string' &&
    typeof candidate.duration === 'number' &&
    typeof candidate.callCount === 'number'
  );
};

const readCallTestStorageMap = (): Record<string, CallTestValues> => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return {};
  }
  try {
    const stored = window.localStorage.getItem(CALL_TEST_STORAGE_KEY);
    if (!stored) {
      return {};
    }
    const parsed = JSON.parse(stored);
    if (isStoredCallTestValues(parsed)) {
      return { [GLOBAL_CALL_TEST_KEY]: sanitizeCallTestValues(parsed) };
    }
    if (parsed && typeof parsed === 'object') {
      const next: Record<string, CallTestValues> = {};
      Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
        if (isStoredCallTestValues(value)) {
          next[key] = sanitizeCallTestValues(value);
        }
      });
      return next;
    }
  } catch (error) {
    console.warn('[CallTest] Failed to load stored parameters map', error);
  }
  return {};
};

const resolveStoredCallTestValues = (deviceId?: string | null): CallTestValues => {
  const map = readCallTestStorageMap();
  if (deviceId && map[deviceId]) {
    return map[deviceId];
  }
  if (map[GLOBAL_CALL_TEST_KEY]) {
    return map[GLOBAL_CALL_TEST_KEY];
  }
  return CALL_TEST_DEFAULTS;
};

const DEVICE_MODULE_IDS = new Set([
  'enable_airplane_mode',
  'disable_airplane_mode',
  'ping',
  'activate_data',
  'launch_app',
  'wrong_apn_configuration',
  'pull_device_logs',
  'start_rf_logging',
  'stop_rf_logging',
  'pull_rf_logs',
  'dial_secret_code',
]);

const sanitizeWaitingTimeDuration = (value: number): number => {
  if (!Number.isFinite(value)) {
    return WAITING_TIME_DEFAULT_DURATION;
  }
  const rounded = Math.round(value);
  return Math.min(WAITING_TIME_MAX_DURATION, Math.max(WAITING_TIME_MIN_DURATION, rounded));
};

const readStoredPingConfig = (): PingConfig => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return DEFAULT_PING_CONFIG;
  }
  try {
    const raw = window.localStorage.getItem(PING_CONFIG_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_PING_CONFIG;
    }
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.target === 'string' &&
      typeof parsed?.duration === 'number' &&
      typeof parsed?.interval === 'number'
    ) {
      return {
        target: parsed.target || DEFAULT_PING_CONFIG.target,
        duration: Math.max(1, Math.round(parsed.duration)),
        interval: Math.min(5, Math.max(0.2, Number(parsed.interval))),
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_PING_CONFIG;
};

const persistPingConfig = (config: PingConfig) => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(PING_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.warn('[PingConfig] Failed to persist configuration', error);
  }
};

const readStoredWaitingTimeDuration = (): number => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return WAITING_TIME_DEFAULT_DURATION;
  }
  try {
    const raw = window.localStorage.getItem(WAITING_TIME_STORAGE_KEY);
    if (!raw) {
      return WAITING_TIME_DEFAULT_DURATION;
    }
    const parsed = Number(raw);
    return sanitizeWaitingTimeDuration(parsed);
  } catch {
    return WAITING_TIME_DEFAULT_DURATION;
  }
};

const persistWaitingTimeDuration = (value: number) => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(WAITING_TIME_STORAGE_KEY, String(value));
  } catch (error) {
    console.warn('[WaitingTime] Failed to persist duration', error);
  }
};

const WRONG_APN_STORAGE_KEY = 'module.wrongApnValue';
const DEFAULT_WRONG_APN = 'arnaud';
const LOG_PULL_STORAGE_KEY = 'module.logPullDestination';
const DEFAULT_LOG_PULL_DESTINATION = 'C:\\\\Users\\\\rush\\\\Documents\\\\logs';

const readStoredWrongApn = (): string => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return DEFAULT_WRONG_APN;
  }
  try {
    const raw = window.localStorage.getItem(WRONG_APN_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_WRONG_APN;
    }
    const value = raw.trim();
    return value.length > 0 ? value : DEFAULT_WRONG_APN;
  } catch {
    return DEFAULT_WRONG_APN;
  }
};

const persistWrongApn = (value: string) => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(WRONG_APN_STORAGE_KEY, value);
  } catch (error) {
    console.warn('[WrongAPN] Failed to persist value', error);
  }
};

const readStoredLogDestination = (): string => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return DEFAULT_LOG_PULL_DESTINATION;
  }
  try {
    const raw = window.localStorage.getItem(LOG_PULL_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_LOG_PULL_DESTINATION;
    }
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : DEFAULT_LOG_PULL_DESTINATION;
  } catch {
    return DEFAULT_LOG_PULL_DESTINATION;
  }
};

const persistLogDestination = (value: string) => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(LOG_PULL_STORAGE_KEY, value);
  } catch (error) {
    console.warn('[LogPull] Failed to persist destination', error);
  }
};


const cloneModuleForBuilderDraft = (module: ModuleMetadata): ModuleMetadata => {
  let cloned: ModuleMetadata = { ...module };
  if (module.id === 'waiting_time') {
    const effectiveDuration =
      typeof module.waitDurationSeconds === 'number'
        ? module.waitDurationSeconds
        : readStoredWaitingTimeDuration();
    cloned = {
      ...cloned,
      waitDurationSeconds: sanitizeWaitingTimeDuration(effectiveDuration),
    };
  }
  if (module.id === 'call_test') {
    const params = module.callTestParams
      ? sanitizeCallTestValues(module.callTestParams)
      : resolveStoredCallTestValues(null);
    cloned = {
      ...cloned,
      callTestParams: { ...params },
    };
  }
  if (module.id === 'dial_secret_code') {
    const code = typeof module.secretCode === 'string' ? module.secretCode : readStoredCustomCode();
    cloned = {
      ...cloned,
      secretCode: code,
    };
  }
  if (module.id === 'launch_app') {
    cloned = {
      ...cloned,
      appLaunchTarget: typeof module.appLaunchTarget === 'string' ? module.appLaunchTarget : readAppLauncherSelection(),
      appLaunchDurationSeconds:
        typeof module.appLaunchDurationSeconds === 'number' ? module.appLaunchDurationSeconds : 15,
    };
  }
  if (module.id === 'ping') {
    const config = readStoredPingConfig();
    cloned = {
      ...cloned,
      pingTarget: typeof module.pingTarget === 'string' ? module.pingTarget : config.target,
      pingDurationSeconds:
        typeof module.pingDurationSeconds === 'number' ? module.pingDurationSeconds : config.duration,
      pingIntervalSeconds:
        typeof module.pingIntervalSeconds === 'number' ? module.pingIntervalSeconds : config.interval,
    };
  }
  if (module.id === 'wrong_apn_configuration') {
    cloned = {
      ...cloned,
      wrongApnValue: typeof module.wrongApnValue === 'string' ? module.wrongApnValue : readStoredWrongApnValue(),
    };
  }
  if (module.id === 'pull_device_logs' || module.id === 'pull_rf_logs') {
    cloned = {
      ...cloned,
      logPullDestination:
        typeof module.logPullDestination === 'string' ? module.logPullDestination : readStoredLogDestination(),
    };
  }
  return cloned;
};

type WorkflowModuleInstance = {
  instanceId: string;
  module: ModuleMetadata;
};

const readWorkflowBuilderDraft = (): WorkflowBuilderDraft | null => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(WORKFLOW_BUILDER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const modules: WorkflowBuilderDraftModule[] = Array.isArray(parsed.modules)
      ? parsed.modules
          .map((entry: any) => {
            if (!entry || typeof entry.id !== 'string') {
              return null;
            }
            const draftModule: WorkflowBuilderDraftModule = { id: entry.id };
            if (typeof entry.waitDurationSeconds === 'number') {
              draftModule.waitDurationSeconds = entry.waitDurationSeconds;
            }
            if (isStoredCallTestValues((entry as any).callTestParams)) {
              draftModule.callTestParams = sanitizeCallTestValues((entry as any).callTestParams);
            }
            if (typeof (entry as any).secretCode === 'string') {
              draftModule.secretCode = (entry as any).secretCode;
            }
            if (typeof (entry as any).appLaunchTarget === 'string') {
              draftModule.appLaunchTarget = (entry as any).appLaunchTarget;
            }
            if (typeof (entry as any).appLaunchDurationSeconds === 'number') {
              draftModule.appLaunchDurationSeconds = (entry as any).appLaunchDurationSeconds;
            }
            if (typeof (entry as any).pingTarget === 'string') {
              draftModule.pingTarget = (entry as any).pingTarget;
            }
            if (typeof (entry as any).pingDurationSeconds === 'number') {
              draftModule.pingDurationSeconds = (entry as any).pingDurationSeconds;
            }
            if (typeof (entry as any).pingIntervalSeconds === 'number') {
              draftModule.pingIntervalSeconds = (entry as any).pingIntervalSeconds;
            }
            if (typeof (entry as any).wrongApnValue === 'string') {
              draftModule.wrongApnValue = (entry as any).wrongApnValue;
            }
            if (typeof (entry as any).logPullDestination === 'string') {
              draftModule.logPullDestination = (entry as any).logPullDestination;
            }
            return draftModule;
          })
          .filter((entry): entry is WorkflowBuilderDraftModule => Boolean(entry))
      : [];
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      description: typeof parsed.description === 'string' ? parsed.description : '',
      showBuilder: Boolean(parsed.showBuilder),
      modules,
    };
  } catch (error) {
    console.warn('[WorkflowBuilderDraft] Failed to read draft', error);
    return null;
  }
};

const persistWorkflowBuilderDraft = (draft: WorkflowBuilderDraft | null) => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    if (
      !draft ||
      (draft.modules.length === 0 && !draft.showBuilder && !draft.name && !draft.description)
    ) {
      window.localStorage.removeItem(WORKFLOW_BUILDER_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(WORKFLOW_BUILDER_STORAGE_KEY, JSON.stringify(draft));
  } catch (error) {
    console.warn('[WorkflowBuilderDraft] Failed to persist draft', error);
  }
};

const hydrateWorkflowBuilderDraft = (draft: WorkflowBuilderDraft): WorkflowModuleInstance[] => {
  const timestamp = Date.now();
  return draft.modules
    .map((entry, index) => {
      const baseModule = MODULE_CATALOG.find((module) => module.id === entry.id);
      if (!baseModule) {
        return null;
      }
      let hydrated: ModuleMetadata = { ...baseModule };
      if (typeof entry.waitDurationSeconds === 'number') {
        hydrated = { ...hydrated, waitDurationSeconds: entry.waitDurationSeconds };
      }
      if (entry.callTestParams) {
        hydrated = {
          ...hydrated,
          callTestParams: sanitizeCallTestValues(entry.callTestParams),
        };
      }
      if (typeof entry.secretCode === 'string') {
        hydrated = { ...hydrated, secretCode: entry.secretCode };
      }
      if (typeof entry.appLaunchTarget === 'string') {
        hydrated = { ...hydrated, appLaunchTarget: entry.appLaunchTarget };
      }
      if (typeof entry.appLaunchDurationSeconds === 'number') {
        hydrated = { ...hydrated, appLaunchDurationSeconds: entry.appLaunchDurationSeconds };
      }
      if (typeof entry.pingTarget === 'string') {
        hydrated = { ...hydrated, pingTarget: entry.pingTarget };
      }
      if (typeof entry.pingDurationSeconds === 'number') {
        hydrated = { ...hydrated, pingDurationSeconds: entry.pingDurationSeconds };
      }
      if (typeof entry.pingIntervalSeconds === 'number') {
        hydrated = { ...hydrated, pingIntervalSeconds: entry.pingIntervalSeconds };
      }
      if (typeof entry.wrongApnValue === 'string') {
        hydrated = { ...hydrated, wrongApnValue: entry.wrongApnValue };
      }
      if (typeof entry.logPullDestination === 'string') {
        hydrated = { ...hydrated, logPullDestination: entry.logPullDestination };
      }
      return {
        instanceId: `draft-${entry.id}-${timestamp}-${index}-${Math.random().toString(36).slice(2, 6)}`,
        module: cloneModuleForBuilderDraft(hydrated),
      };
    })
    .filter((entry): entry is WorkflowModuleInstance => Boolean(entry));
};

const TestModules: React.FC<TestModulesProps> = ({ backendUrl }) => {
  const [snackbar, setSnackbar] = useState<{ message: string; severity: SnackbarSeverity }>();
  const [selectedModules, setSelectedModules] = useState<WorkflowModuleInstance[]>([]);
  const [showWorkflowBuilder, setShowWorkflowBuilder] = useState(false);
  const [workflowDraftLoaded, setWorkflowDraftLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const [workflowName, setWorkflowName] = useState('');

  const [moduleCategoryFilter, setModuleCategoryFilter] = useState<string>('all');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [appLauncherSelection, setAppLauncherSelection] = useState<AppLauncherOption>(readAppLauncherSelection);
  const [appLauncherDuration, setAppLauncherDuration] = useState<number>(15);
  const [appLauncherDialogSelection, setAppLauncherDialogSelection] = useState<AppLauncherOption>(readAppLauncherSelection);
  const [appLauncherDialogDuration, setAppLauncherDialogDuration] = useState<string>('15');
  const [appLauncherDialogOpen, setAppLauncherDialogOpen] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(APP_LAUNCHER_STORAGE_KEY, appLauncherSelection);
    } catch {
      // best effort persistence
    }
  }, [appLauncherSelection]);
  const [favorites, setFavorites] = useState<Set<string>>(() => readFavorites());
  const [moduleFilterMode, setModuleFilterMode] = useState<'all' | 'favorites' | 'recents'>('all');
  const [recents, setRecents] = useState<string[]>(() => readRecents());
  const [showRecents, setShowRecents] = useState(true);

  const [callTestDialogOpen, setCallTestDialogOpen] = useState(false);
  const [callTestMode, setCallTestMode] = useState<CallTestMode>('run');
  const [callTestDialogInitialValues, setCallTestDialogInitialValues] = useState<CallTestValues>(CALL_TEST_DEFAULTS);
  const [currentCallTestDeviceId, setCurrentCallTestDeviceId] = useState<string | null>(null);
  const [callTestTotalSteps, setCallTestTotalSteps] = useState(0);
  const [callTestTargets, setCallTestTargets] = useState<string[]>([]);
  const [callTestStepIndex, setCallTestStepIndex] = useState(0);
  const [callTestPendingValues, setCallTestPendingValues] = useState<Record<string, CallTestValues>>({});
  const runResultsRef = React.useRef<{ success: string[]; failure: { deviceId: string; reason: string }[] }>({
    success: [],
    failure: [],
  });
  const waitingTimeInitialRef = React.useRef(readStoredWaitingTimeDuration());
  const [waitingTimeDuration, setWaitingTimeDuration] = useState<number>(waitingTimeInitialRef.current);
  const [waitingTimeDialogOpen, setWaitingTimeDialogOpen] = useState(false);
  const [waitingTimeDraft, setWaitingTimeDraft] = useState<string>(String(waitingTimeInitialRef.current));
  const [waitingTimeDialogError, setWaitingTimeDialogError] = useState<string | null>(null);
  const [pingDialogOpen, setPingDialogOpen] = useState(false);
  const [pingConfig, setPingConfig] = useState<PingConfig>(() => readStoredPingConfig());
  const [pingDraft, setPingDraft] = useState<PingDialogState>(() => toPingDraft(readStoredPingConfig()));
  const [pingDialogError, setPingDialogError] = useState<string | null>(null);
  const [pingTargetError, setPingTargetError] = useState<string | null>(null);
  const [pingTargetTouched, setPingTargetTouched] = useState(false);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(() => readSelectedDeviceIds());
  const [wrongApnValue, setWrongApnValue] = useState<string>(() => readStoredWrongApn());
  const [logPullDestination, setLogPullDestination] = useState<string>(() => readStoredLogDestination());
  const [customCode, setCustomCode] = useState<string>(() => readStoredCustomCode());
  const [wrongApnDialogOpen, setWrongApnDialogOpen] = useState(false);
  const [wrongApnDraft, setWrongApnDraft] = useState(wrongApnValue);
  const [logPullDialogOpen, setLogPullDialogOpen] = useState(false);
  const [logPullDraft, setLogPullDraft] = useState(logPullDestination);
  const [logPullDialogError, setLogPullDialogError] = useState<string | null>(null);
  const [customScriptDialogOpen, setCustomScriptDialogOpen] = useState(false);
  const [customScriptDraft, setCustomScriptDraft] = useState(customCode);
  const [customScriptDialogError, setCustomScriptDialogError] = useState<string | null>(null);
  const [moduleRunStatuses, setModuleRunStatuses] = useState<Record<string, 'idle' | 'running'>>({});
  const [moduleStatusEnabled, setModuleStatusEnabled] = useState<Record<string, boolean>>({});
  const [moduleRunProgress, setModuleRunProgress] = useState<Record<string, number>>({});
  const [moduleStatusIds, setModuleStatusIds] = useState<Record<string, string>>({});
  const [moduleStatusEntries, setModuleStatusEntries] = useState<
    Record<string, ModuleStatusEntry>
  >({});
  const moduleProgressMeta = useRef<Record<string, { startedAt: number; expectedMs: number | null }>>({});
  const [deviceNotifications, setDeviceNotifications] = useState<DeviceNotification[]>([]);
  const executionSockets = useRef<Record<string, WebSocket | null>>({});
  const { devices: discoveredDevices, status: devicesStatus } = useDevices({ backendUrl });
  const readyBackendDeviceIds = useMemo(
    () =>
      discoveredDevices
        .filter((device) => isDeviceSelectable(device.status))
        .map((device) => device.id),
    [discoveredDevices]
  );
  const progressIntervals = useRef<Record<string, number>>({});
  const readyBackendDeviceSet = useMemo(() => new Set(readyBackendDeviceIds), [readyBackendDeviceIds]);
  const hasWorkflowDraft =
    workflowDraftLoaded &&
    (selectedModules.length > 0 || workflowName.trim().length > 0 || workflowDescription.trim().length > 0);
  const findModuleById = useCallback(
    (moduleId: string) => MODULE_CATALOG.find((module) => module.id === moduleId),
    []
  );

  useEffect(() => {
    const draft = readWorkflowBuilderDraft();
    if (draft) {
      const hydratedModules = hydrateWorkflowBuilderDraft(draft);
      if (hydratedModules.length > 0) {
        setSelectedModules(hydratedModules);
      }
      setShowWorkflowBuilder(Boolean(draft.showBuilder));
      setWorkflowName(draft.name ?? '');
      setWorkflowDescription(draft.description ?? '');
    }
    setWorkflowDraftLoaded(true);
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const liveSelectedDeviceIds = useMemo(
    () => selectedDeviceIds.filter((deviceId) => readyBackendDeviceSet.has(deviceId)),
    [readyBackendDeviceSet, selectedDeviceIds]
  );
  const hasStaleSelection = selectedDeviceIds.length > 0 && liveSelectedDeviceIds.length === 0;
  const hasSelectedDevices = liveSelectedDeviceIds.length > 0;
  const [callTestMap, setCallTestMap] = useState<Record<string, CallTestValues>>({});
  const selectionReminderVisible =
    devicesStatus === 'success' && (readyBackendDeviceIds.length === 0 || !hasSelectedDevices);
  const selectionReminderSeverity =
    readyBackendDeviceIds.length === 0 ? 'error' : hasStaleSelection ? 'warning' : 'info';
  const selectionReminderMessage =
    readyBackendDeviceIds.length === 0
      ? 'No devices are ready. Connect a phone and mark it active from the Dashboard before running modules.'
      : hasStaleSelection
        ? 'The previously selected device is no longer connected. Open the Dashboard to choose another one.'
        : 'Select an active device from the Dashboard before running modules.';
  const [draggingModuleId, setDraggingModuleId] = useState<string | null>(null);
  const [draggingCatalogModuleId, setDraggingCatalogModuleId] = useState<string | null>(null);
  const [hoveredBuilderTarget, setHoveredBuilderTarget] = useState<
    { id: string; insertAfter: boolean } | null
  >(null);
  const [lastDeviceModuleRun, setLastDeviceModuleRun] = useState<DeviceModuleRunSnapshot | null>(null);

  useEffect(() => {
    const storedIds = readSelectedDeviceIds();
    setSelectedDeviceIds(storedIds);
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<string[]>).detail;
      if (Array.isArray(detail)) {
        setSelectedDeviceIds(detail);
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
    persistWrongApn(wrongApnValue);
  }, [wrongApnValue]);

  useEffect(() => {
    persistLogDestination(logPullDestination);
  }, [logPullDestination]);

  useEffect(() => {
    if (!workflowDraftLoaded) {
      return;
    }
    const shouldPersist =
      showWorkflowBuilder ||
      selectedModules.length > 0 ||
      workflowName.trim().length > 0 ||
      workflowDescription.trim().length > 0;
    if (!shouldPersist) {
      persistWorkflowBuilderDraft(null);
      return;
    }
    persistWorkflowBuilderDraft({
      name: workflowName,
      description: workflowDescription,
      showBuilder: showWorkflowBuilder,
      modules: selectedModules.map((entry) => {
        const serialized: WorkflowBuilderDraftModule = { id: entry.module.id };
        if (typeof entry.module.waitDurationSeconds === 'number') {
          serialized.waitDurationSeconds = entry.module.waitDurationSeconds;
        }
        if (entry.module.callTestParams) {
          serialized.callTestParams = { ...entry.module.callTestParams };
        }
        if (typeof entry.module.secretCode === 'string') {
          serialized.secretCode = entry.module.secretCode;
        }
        if (typeof entry.module.appLaunchTarget === 'string') {
          serialized.appLaunchTarget = entry.module.appLaunchTarget;
        }
        if (typeof entry.module.appLaunchDurationSeconds === 'number') {
          serialized.appLaunchDurationSeconds = entry.module.appLaunchDurationSeconds;
        }
        if (typeof entry.module.pingTarget === 'string') {
          serialized.pingTarget = entry.module.pingTarget;
        }
        if (typeof entry.module.pingDurationSeconds === 'number') {
          serialized.pingDurationSeconds = entry.module.pingDurationSeconds;
        }
        if (typeof entry.module.pingIntervalSeconds === 'number') {
          serialized.pingIntervalSeconds = entry.module.pingIntervalSeconds;
        }
        if (typeof entry.module.wrongApnValue === 'string') {
          serialized.wrongApnValue = entry.module.wrongApnValue;
        }
        if (typeof entry.module.logPullDestination === 'string') {
          serialized.logPullDestination = entry.module.logPullDestination;
        }
        return serialized;
      }),
    });
  }, [workflowDraftLoaded, showWorkflowBuilder, selectedModules, workflowName, workflowDescription]);

  useEffect(() => {
    setCallTestMap(readCallTestStorageMap());
  }, []);

  const updateCallTestMap = useCallback((deviceKey: string, values: CallTestValues) => {
    const sanitized = sanitizeCallTestValues(values);
    setCallTestMap((prev) => {
      const next = { ...prev, [deviceKey]: sanitized };
      try {
        localStorage.setItem(CALL_TEST_STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        console.warn('[CallTest] Failed to persist parameters', error);
      }
      return next;
    });
  }, []);

  const getCallTestValuesForDevice = useCallback(
    (deviceId?: string | null): CallTestValues => {
      if (deviceId && callTestMap[deviceId]) {
        return callTestMap[deviceId];
      }
      if (callTestMap[GLOBAL_CALL_TEST_KEY]) {
        return callTestMap[GLOBAL_CALL_TEST_KEY];
      }
      return CALL_TEST_DEFAULTS;
    },
    [callTestMap]
  );

  const executeCallTestForDevice = useCallback(
    async (deviceId: string, values: CallTestValues) => {
      const sanitized = sanitizeCallTestValues(values);
      const fullNumber = `${sanitized.countryCode}${sanitized.phoneNumber}`;

      if (!backendUrl) {
        throw new Error('Backend unavailable: no URL configured.');
      }

      connectExecutionSocket(module.id);
      const normalizedBackendUrl = backendUrl.replace(/\/$/, '');
      try {
        const response = await fetchWithRetry(`${normalizedBackendUrl}/api/modules/voice_call_test/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify({
            device_id: deviceId,
            parameters: {
              number: fullNumber,
              duration: sanitized.duration,
              call_count: sanitized.callCount,
            },
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          let detail = text.trim();
          if (!detail) {
            detail = `Backend failure (HTTP ${response.status})`;
          }
          try {
            const parsed = JSON.parse(text);
            detail = resolveModuleFailureReason(parsed) ?? detail;
          } catch {
            // ignore parse errors
          }
          throw new Error(detail);
        }

        await response.json().catch(() => undefined);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unknown error while communicating with the backend.';
        throw new Error(message);
      }

      if ((window as any).electronAPI?.runScript) {
        try {
          (window as any).electronAPI.runScript(scriptPath('call_control.sh'));
        } catch (ipcError) {
          console.warn('[CallTest] runScript unavailable', ipcError);
        }
      } else {
        console.info(
          `Call Test placeholder for ${fullNumber} (device: ${deviceId}) (${sanitized.callCount} call(s) / ${sanitized.duration}s).`
        );
      }

      return { sanitized, fullNumber };
    },
    [backendUrl]
  );

  const runCallTestBatch = useCallback(
    async (targets: string[], overrides: Record<string, CallTestValues> = {}) => {
      const uniqueTargets = Array.from(new Set(targets));
      if (uniqueTargets.length === 0) {
        setSnackbar({
          severity: 'error',
          message: 'Select at least one device on the dashboard before launching the Call Test.',
        });
        return;
      }

      if (!backendUrl) {
        setSnackbar({
          severity: 'error',
          message: 'Backend unavailable: no URL configured.',
        });
        return;
      }

      const normalizedBackendUrl = backendUrl.replace(/\/$/, '');
      const parametersByDevice: Record<string, Record<string, any>> = {};
      const effectiveValues: Record<string, CallTestValues> = {};

      uniqueTargets.forEach((deviceId) => {
        const override = overrides[deviceId];
        const stored =
          callTestMap[deviceId] ??
          callTestMap[GLOBAL_CALL_TEST_KEY] ??
          CALL_TEST_DEFAULTS;
        const values = override ?? stored;
        const sanitized = sanitizeCallTestValues(values);
        const fullNumber = `${sanitized.countryCode}${sanitized.phoneNumber}`;
        effectiveValues[deviceId] = sanitized;
        parametersByDevice[deviceId] = {
          number: fullNumber,
          duration: sanitized.duration,
          call_count: sanitized.callCount,
        };
      });

      const runLocalCallScript = () => {
        if ((window as any).electronAPI?.runScript) {
          uniqueTargets.forEach(() => {
            try {
              (window as any).electronAPI.runScript(scriptPath('call_control.sh'));
            } catch (ipcError) {
              console.warn('[CallTest] runScript unavailable', ipcError);
            }
          });
        }
      };

      let results: PromiseSettledResult<unknown>[] | null = null;
      try {
        connectExecutionSocket('voice_call_test');
        const response = await fetchWithRetry(`${normalizedBackendUrl}/api/modules/voice_call_test/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify({
            device_ids: uniqueTargets,
            parameters_by_device: parametersByDevice,
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          if (response.status === 422 || (response.status === 400 && text.toLowerCase().includes('parameters_by_device'))) {
            results = await Promise.allSettled(
              uniqueTargets.map((deviceId) => executeCallTestForDevice(deviceId, effectiveValues[deviceId]))
            );
          } else {
            throw new Error(text || `Backend failure (HTTP ${response.status})`);
          }
        } else {
          await response.json().catch(() => undefined);
          runLocalCallScript();
          results = uniqueTargets.map(() => ({ status: 'fulfilled', value: undefined }));
        }
      } catch (error) {
        results = await Promise.allSettled(
          uniqueTargets.map((deviceId) => executeCallTestForDevice(deviceId, effectiveValues[deviceId]))
        );
      }

      const successes: string[] = [];
      const failures: { deviceId: string; reason: string }[] = [];

      results.forEach((result, index) => {
        const deviceId = uniqueTargets[index];
        if (result.status === 'fulfilled') {
          successes.push(deviceId);
        } else {
          const reason =
            result.reason instanceof Error
              ? result.reason.message
              : typeof result.reason === 'string'
                ? result.reason
                : 'Execution failed.';
          failures.push({ deviceId, reason });
        }
      });

      if (failures.length === 0) {
        setSnackbar({
          severity: 'success',
          message: `Call Test launched on ${successes.length} device${successes.length === 1 ? '' : 's'}.`,
        });
      } else if (successes.length > 0) {
        const failedList = failures.map((item) => item.deviceId).join(', ');
        setSnackbar({
          severity: 'warning',
          message: `Call Test partially launched. Failed for: ${failedList}.`,
        });
      } else {
        const reasons = failures.map((item) => `${item.deviceId}: ${item.reason}`).join(' | ');
        setSnackbar({
          severity: 'error',
          message: `Call Test failed on all selected devices. ${reasons}`,
        });
      }

      runResultsRef.current = { success: successes, failure: failures };
    },
    [backendUrl, callTestMap, executeCallTestForDevice]
  );

  const handleCallTestSubmit = useCallback(
    async (submitted: CallTestValues) => {
      const sanitized = sanitizeCallTestValues(submitted);
      const isLastStep =
        callTestTotalSteps <= 1 || callTestStepIndex >= callTestTotalSteps - 1;

      if (callTestMode === 'run') {
        const activeDeviceId = currentCallTestDeviceId;
        if (!activeDeviceId) {
          setSnackbar({
            severity: 'error',
            message: 'No active device selected for Call Test.',
          });
          return;
        }

        updateCallTestMap(activeDeviceId, sanitized);
        updateCallTestMap(GLOBAL_CALL_TEST_KEY, sanitized);

        const nextPending = { ...callTestPendingValues, [activeDeviceId]: sanitized };
        setCallTestPendingValues(nextPending);

        if (!isLastStep) {
          const nextIndex = callTestStepIndex + 1;
          const nextDevice = callTestTargets[nextIndex];
          if (nextDevice) {
            setCallTestStepIndex(nextIndex);
            setCurrentCallTestDeviceId(nextDevice);
            const initialValues = nextPending[nextDevice] ?? getCallTestValuesForDevice(nextDevice);
            setCallTestDialogInitialValues(initialValues);
            return;
          }
        }

        setCallTestDialogOpen(false);
        setCurrentCallTestDeviceId(null);
        setCallTestStepIndex(0);
        setCallTestTotalSteps(0);
        const targetsToRun = [...callTestTargets];
        setCallTestTargets([]);
        await runCallTestBatch(targetsToRun, nextPending);
        setCallTestPendingValues({});
        return;
      }

      const targetKey = currentCallTestDeviceId ?? GLOBAL_CALL_TEST_KEY;
      updateCallTestMap(targetKey, sanitized);

      if (!isLastStep) {
        const nextIndex = callTestStepIndex + 1;
        const nextDevice = callTestTargets[nextIndex];
        if (nextDevice) {
          setCallTestStepIndex(nextIndex);
          setCurrentCallTestDeviceId(nextDevice);
          const nextValues = getCallTestValuesForDevice(nextDevice === GLOBAL_CALL_TEST_KEY ? null : nextDevice);
          setCallTestDialogInitialValues(nextValues);
          return;
        }
      }

      setCallTestDialogOpen(false);
      setCurrentCallTestDeviceId(null);
      setCallTestStepIndex(0);
      setCallTestTotalSteps(0);
      setCallTestTargets([]);
      setSnackbar({ severity: 'success', message: 'Call Test parameters saved.' });
      runResultsRef.current = { success: [], failure: [] };
    },
    [
      callTestMode,
      callTestTargets,
      currentCallTestDeviceId,
      getCallTestValuesForDevice,
      runCallTestBatch,
      callTestPendingValues,
      callTestStepIndex,
      callTestTotalSteps,
      updateCallTestMap,
    ]
  );

  const handleCallTestPrevious = useCallback(() => {
    if (callTestStepIndex <= 0) {
      return;
    }
    const prevIndex = callTestStepIndex - 1;
    const prevDevice = callTestTargets[prevIndex];
    if (!prevDevice) {
      return;
    }
    setCallTestStepIndex(prevIndex);
    setCurrentCallTestDeviceId(prevDevice);
    const initial =
      callTestPendingValues[prevDevice] ??
      getCallTestValuesForDevice(prevDevice === GLOBAL_CALL_TEST_KEY ? null : prevDevice);
    setCallTestDialogInitialValues(initial);
  }, [callTestStepIndex, callTestTargets, callTestPendingValues, getCallTestValuesForDevice]);

  const moduleCategories = useMemo(() => {
    const unique = new Set<string>();
    MODULE_CATALOG.forEach((module) => unique.add(module.category));
    return ['all', ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, []);
  const callTestDialogTarget =
    currentCallTestDeviceId === GLOBAL_CALL_TEST_KEY ? null : currentCallTestDeviceId;

  const sortedModules = useMemo(() => {
    const base = MODULE_CATALOG.filter((module) => module.hiddenInModulesPage !== true);
    return base.sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const filteredModules = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase();
    const recencyRank = (id: string) => {
      const index = recents.indexOf(id);
      return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    };
    const filtered = sortedModules.filter((module) => {
      const matchesSearch =
        module.name.toLowerCase().includes(lowerQuery) ||
        module.description.toLowerCase().includes(lowerQuery);
      const matchesCategory = moduleCategoryFilter === 'all' || module.category === moduleCategoryFilter;
      const matchesFavorites = moduleFilterMode !== 'favorites' || favorites.has(module.id);
      const matchesRecents = moduleFilterMode !== 'recents' || recents.includes(module.id);
      return matchesSearch && matchesCategory && matchesFavorites && matchesRecents;
    });

    // Sort: alphabetical order (already sorted in sortedModules), except in "recents" mode where we sort by recency.
    if (moduleFilterMode === 'recents') {
      return [...filtered].sort((a, b) => recencyRank(a.id) - recencyRank(b.id));
    }
    return filtered;
  }, [favorites, moduleCategoryFilter, recents, searchQuery, moduleFilterMode, sortedModules]);

  const resolveRunTargets = useCallback(() => {
    if (liveSelectedDeviceIds.length > 0) {
      return liveSelectedDeviceIds;
    }
    const fallback = readSelectedDeviceIds();
    if (fallback.length === 0) {
      return [];
    }
    return fallback.filter((deviceId) => readyBackendDeviceSet.has(deviceId));
  }, [liveSelectedDeviceIds, readyBackendDeviceSet]);

  const fetchModuleStatus = useCallback(
    async ({
      moduleId,
      statusId,
      signal,
    }: {
      moduleId?: string;
      statusId?: string;
      signal?: AbortSignal;
    }) => {
      if (!backendUrl) {
        return null;
      }
      const normalizedBackendUrl = backendUrl.replace(/\/$/, '');
      const params = new URLSearchParams();
      if (moduleId) {
        params.append('module_id', moduleId);
      }
      if (statusId) {
        params.append('status_id', statusId);
      }
      if (!params.toString()) {
        return null;
      }
      try {
        const response = await fetchWithRetry(`${normalizedBackendUrl}/api/modules/status?${params.toString()}`, {
          headers: {
            ...authHeaders(),
          },
          signal,
        });
        if (!response.ok) {
          return null;
        }
        const payload = await response.json();
        if (!payload || typeof payload !== 'object') {
          return null;
        }
        return payload as ModuleStatusEntry;
      } catch {
        return null;
      }
    },
    [backendUrl]
  );

  const showDeviceNotifications = useCallback((entries: Omit<DeviceNotification, 'id'>[]) => {
    entries.forEach((entry) => {
      const id = `${entry.moduleId}-${entry.deviceId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const notification: DeviceNotification = { id, ...entry };
      setDeviceNotifications((prev) => [...prev, notification]);
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          setDeviceNotifications((prev) => prev.filter((item) => item.id !== id));
        }, 4200);
      }
    });
  }, []);

  const runningModuleIds = useMemo(
    () =>
      Object.entries(moduleRunStatuses)
        .filter(([moduleId, status]) => status === 'running' && moduleStatusEnabled[moduleId])
        .map(([moduleId]) => moduleId),
    [moduleRunStatuses, moduleStatusEnabled]
  );
  const runningModulesKey = runningModuleIds.join(',');

  const estimateModuleDurationMs = useCallback(
    (module: ModuleMetadata): number | null => {
      if (module.id === 'ping') {
        return Math.max(1, Math.round(pingConfig.duration)) * 1000;
      }
      if (module.id === 'waiting_time') {
        const waitSeconds = module.waitDurationSeconds ?? WAITING_TIME_DEFAULT_DURATION;
        return Math.max(1, Math.round(waitSeconds)) * 1000;
      }
      return parseDurationEstimateMs(
        module.avg_duration ||
          module.duration_estimate ||
          module.durationEstimate ||
          module.avgDuration
      );
    },
    [pingConfig.duration]
  );

  const startProgress = useCallback(
    (module: ModuleMetadata) => {
      const moduleId = module.id;
      const expectedMs = estimateModuleDurationMs(module);
      moduleProgressMeta.current[moduleId] = { startedAt: Date.now(), expectedMs };
      setModuleRunProgress((prev) => ({ ...prev, [moduleId]: 0 }));
      if (progressIntervals.current[moduleId]) {
        window.clearInterval(progressIntervals.current[moduleId]);
      }
      progressIntervals.current[moduleId] = window.setInterval(() => {
        setModuleRunProgress((prev) => {
          const current = prev[moduleId] ?? 0;
          const meta = moduleProgressMeta.current[moduleId];
          let nextValue = current;
          if (meta?.expectedMs) {
            const elapsed = Date.now() - meta.startedAt;
            const estimated = Math.min(99, Math.round((elapsed / meta.expectedMs) * 100));
            nextValue = Math.max(current, estimated);
          } else {
            nextValue = Math.min(95, current + 5);
          }
          return { ...prev, [moduleId]: nextValue };
        });
      }, 500);
    },
    [estimateModuleDurationMs]
  );

  const stopProgress = useCallback((moduleId: string) => {
    if (progressIntervals.current[moduleId]) {
      window.clearInterval(progressIntervals.current[moduleId]);
      delete progressIntervals.current[moduleId];
    }
    delete moduleProgressMeta.current[moduleId];
    setModuleRunProgress((prev) => ({ ...prev, [moduleId]: 100 }));
    window.setTimeout(() => {
      setModuleRunProgress((prev) => {
        const next = { ...prev };
        delete next[moduleId];
        return next;
      });
    }, 1200);
  }, []);

  useEffect(() => {
    return () => {
      Object.values(progressIntervals.current).forEach((intervalId) => {
        window.clearInterval(intervalId);
      });
    };
  }, []);

  const websocketBase = useMemo(() => {
    if (!backendUrl) {
      return null;
    }
    if (backendUrl.startsWith('https://')) {
      return backendUrl.replace(/^https:/, 'wss:');
    }
    if (backendUrl.startsWith('http://')) {
      return backendUrl.replace(/^http:/, 'ws:');
    }
    return backendUrl;
  }, [backendUrl]);

  const connectExecutionSocket = useCallback(
    (moduleId: string) => {
      const base = websocketBase;
      if (!base || executionSockets.current[moduleId]) {
        return;
      }
      const executionId = `exec_${moduleId}`;
      try {
        const socket = new WebSocket(`${base}/ws/executions/${executionId}`);
            socket.addEventListener('message', ({ data }) => {
              try {
                const payload = JSON.parse(data);
                if (payload?.type === 'module_status' && payload.module_id === moduleId) {
                  const entry = payload.status as ModuleStatusEntry;
                  if (entry) {
                    setModuleStatusEntries((prev) => ({ ...prev, [moduleId]: entry }));
                  }
                  if (Array.isArray(payload.device_notifications) && payload.device_notifications.length > 0) {
                    showDeviceNotifications(
                      payload.device_notifications.map((item: any) => ({
                        moduleId,
                        deviceId: item.device_id ?? 'unknown',
                        success: Boolean(item.success),
                        message: item.message ?? 'No details available',
                      }))
                    );
                  }
                }
              } catch {
                // ignore invalid payloads
              }
            });
        socket.addEventListener('close', () => {
          if (executionSockets.current[moduleId] === socket) {
            executionSockets.current[moduleId] = null;
          }
        });
        executionSockets.current[moduleId] = socket;
      } catch {
        // websocket unavailable
      }
    },
    [websocketBase, showDeviceNotifications]
  );

  useEffect(() => {
    return () => {
      Object.values(executionSockets.current).forEach((socket) => {
        if (socket) {
          socket.close();
        }
      });
    };
  }, []);

  useEffect(() => {
    if (!backendUrl || runningModuleIds.length === 0) {
      return;
    }
    const controller = new AbortController();
    const fetchStatuses = async () => {
      const entries: ModuleStatusEntry[] = [];
      await Promise.all(
        runningModuleIds.map(async (moduleId) => {
          const entry = await fetchModuleStatus({ moduleId, signal: controller.signal });
          if (entry) {
            entries.push(entry);
          }
        })
      );
      if (entries.length === 0) {
        return;
      }
      setModuleStatusEntries((prev) => {
        const next = { ...prev };
        entries.forEach((entry) => {
          if (entry.module_id) {
            next[entry.module_id] = entry;
          }
        });
        return next;
      });
    };

    void fetchStatuses();
    const interval = setInterval(() => {
      void fetchStatuses();
    }, 1500);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [backendUrl, fetchModuleStatus, runningModulesKey]);

  const runDeviceModule = useCallback(
    async (module: ModuleMetadata, options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      const targets = resolveRunTargets();
      if (targets.length === 0) {
        setSnackbar({
          severity: 'error',
          message: `Select at least one device on the dashboard before running ${module.name}.`,
        });
        return;
      }

      if (!backendUrl) {
        setSnackbar({
          severity: 'error',
          message: 'Backend unavailable: no URL configured.',
        });
        return;
      }

      const normalizedBackendUrl = backendUrl.replace(/\/$/, '');
      const sharedParameters: Record<string, any> = {};

      if (module.id === 'launch_app') {
        sharedParameters.app = appLauncherSelection;
        sharedParameters.duration_seconds = appLauncherDuration;
      }
      if (module.id === 'wrong_apn_configuration') {
        sharedParameters.apn_value = (wrongApnValue || DEFAULT_WRONG_APN).trim() || DEFAULT_WRONG_APN;
        sharedParameters.use_ui_flow = true;
      } else if (module.id === 'pull_device_logs' || module.id === 'pull_rf_logs') {
        const destination = logPullDestination.trim();
        if (!destination) {
          setSnackbar({
            severity: 'error',
            message: 'Specify a destination path before running the Log Pull module.',
          });
          return;
        }
        sharedParameters.destination = destination;
      } else if (module.id === 'dial_secret_code') {
        const code = customCode.trim();
        if (!code) {
          setSnackbar({
            severity: 'error',
            message: 'Enter a secret/USSD code before running.',
          });
          return;
        }
        sharedParameters.code = code;
      }

      const buildDeviceResult = (entry: Record<string, any>, fallbackReason?: string): DeviceModuleResult => {
        const success = Boolean(entry.success);
        const payload = entry.result ?? entry;
        const deviceId =
          (typeof entry.device_id === 'string' && entry.device_id) ||
          (typeof entry.deviceId === 'string' && entry.deviceId) ||
          'unknown';
        const normalizedEntryError =
          typeof entry.error === 'string' ? normalizeModuleError(entry.error) : undefined;
        const failureReason =
          success
            ? undefined
            : normalizedEntryError ??
              normalizeModuleError(resolveModuleFailureReason(entry.result ?? entry)) ??
              fallbackReason ??
              'Execution failed.';
        return {
          deviceId,
          success,
          response: payload,
          ...(failureReason ? { error: failureReason } : {}),
        };
      };

      setModuleRunStatuses((prev) => ({ ...prev, [module.id]: 'running' }));
      setModuleStatusEnabled((prev) => ({ ...prev, [module.id]: false }));
      setModuleStatusIds((prev) => {
        const next = { ...prev };
        delete next[module.id];
        return next;
      });
      setModuleStatusEntries((prev) => {
        const next = { ...prev };
        delete next[module.id];
        return next;
      });
      startProgress(module);
      const runStartedAt = Date.now();
      try {
        console.log(
          `[runDeviceModule] requesting ${module.id} on ${targets.length} device${targets.length === 1 ? '' : 's'} at ${new Date().toISOString()}`
        );

        const executeRequest = async (payload: Record<string, any>) => {
          const response = await fetchWithRetry(
            `${normalizedBackendUrl}/api/modules/${module.id}/execute`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...authHeaders(),
              },
              body: JSON.stringify(payload),
            },
            { retries: 3, backoffMs: 600, retryOn: [408, 429, 500, 502, 503, 504] }
          );
          if (!response.ok) {
            const text = await response.text();
            throw { status: response.status, text };
          }
          return response.json();
        };

        const batches = chunkDeviceIds(targets, DEFAULT_BATCH_SIZE);
        const aggregatedResults: DeviceModuleResult[] = [];
        const statusIds: string[] = [];

        for (const batch of batches) {
          const parametersByDevice: Record<string, Record<string, any>> = {};
          batch.forEach((deviceId) => {
            parametersByDevice[deviceId] = { ...sharedParameters };
          });

          let data: any;
          try {
            data = await executeRequest({
              device_ids: batch,
              parameters_by_device: parametersByDevice,
            });
          } catch (error: any) {
            const text = typeof error?.text === 'string' ? error.text : '';
            if (error?.status === 422 || (error?.status === 400 && text.toLowerCase().includes('parameters_by_device'))) {
              data = await executeRequest({
                device_ids: batch,
                parameters: sharedParameters,
              });
            } else {
              const formatted = formatExecutionError(error);
              const message = formatted.action ? `${formatted.message} Action: ${formatted.action}` : formatted.message;
              batch.forEach((deviceId) => {
                aggregatedResults.push({
                  deviceId,
                  success: false,
                  response: {},
                  error: message,
                });
              });
              continue;
            }
          }

          const statusIdFromServer =
            typeof data.status_id === 'string' && data.status_id ? data.status_id : undefined;
          if (statusIdFromServer) {
            statusIds.push(statusIdFromServer);
            setModuleStatusIds((prev) => ({ ...prev, [module.id]: statusIdFromServer }));
          }

          const rawDeviceEntries: Record<string, any>[] = Array.isArray(data?.result?.device_results)
            ? data.result.device_results
            : Array.isArray(data?.device_results)
              ? data.device_results
              : [];

          let batchResults: DeviceModuleResult[] = rawDeviceEntries.map((entry) =>
            buildDeviceResult(entry, resolveModuleFailureReason(data))
          );
          if (batchResults.length === 0) {
            const fallbackReason = resolveModuleFailureReason(data) ?? 'Execution result unavailable for devices.';
            batchResults = batch.map((deviceId) => ({
              deviceId,
              success: false,
              response: data,
              error: fallbackReason,
            }));
          }

          aggregatedResults.push(...batchResults);
        }

        const deviceResults = aggregatedResults;

        if (statusIds.length > 0) {
          setModuleStatusEnabled((prev) => ({ ...prev, [module.id]: true }));
          const finalStatus = await fetchModuleStatus({ statusId: statusIds[statusIds.length - 1] });
          if (finalStatus?.module_id) {
            setModuleStatusEntries((prev) => ({
              ...prev,
              [finalStatus.module_id]: finalStatus,
            }));
            if (finalStatus.status_id) {
              setModuleStatusIds((prev) => ({ ...prev, [finalStatus.module_id]: finalStatus.status_id }));
            }
          }
        } else {
          setModuleStatusEnabled((prev) => ({ ...prev, [module.id]: false }));
        }

        console.log(
          `[runDeviceModule] completed ${module.id} (${deviceResults.length} device results) at ${new Date().toISOString()}`
        );

        const successes = deviceResults.filter((result) => result.success).map((result) => result.deviceId);
        const failures = deviceResults
          .filter((result) => !result.success)
          .map((result) => ({
            deviceId: result.deviceId,
            reason: result.error ?? 'Execution failed.',
          }));
        const detailMessage = buildDeviceNotificationMessage(deviceResults);
        const detailSuffix = detailMessage ? ` Details: ${detailMessage}` : '';

        setLastDeviceModuleRun({
          moduleId: module.id,
          timestamp: new Date().toISOString(),
          results: deviceResults,
        });

        const activityTimestamp = new Date().toISOString();
        deviceResults.forEach((result) => {
          recordDeviceActivity({
            deviceId: result.deviceId,
            type: 'module',
            label: module.name,
            status: result.success ? 'success' : 'failure',
            referenceId: module.id,
            details: result.error,
            timestamp: activityTimestamp,
          });
        });

        if (!silent) {
          const alreadyActiveDevices: string[] = [];
          const alreadyDesiredDevices: string[] = [];

          deviceResults.forEach((item) => {
            const payload = (item.response as any)?.result ?? (item.response as any);
            if (!payload) {
              return;
            }
            const alreadyActive = Boolean(payload.already_active || payload.already_on || payload.already_enabled);
            const alreadyDesired = Boolean(
              payload.already_off || payload.already_disabled || payload.already_configured || payload.already_in_state
            );
            if (alreadyActive) {
              alreadyActiveDevices.push(item.deviceId);
            } else if (alreadyDesired) {
              alreadyDesiredDevices.push(item.deviceId);
            }
          });

          if (failures.length === 0) {
            if (alreadyActiveDevices.length === deviceResults.length) {
              setSnackbar({
                severity: 'info',
                message: `${module.name}: already active/running on ${alreadyActiveDevices.join(', ')}.${detailSuffix}`,
              });
              return;
            }
            if (alreadyDesiredDevices.length === deviceResults.length) {
              setSnackbar({
                severity: 'info',
                message: `${module.name}: device already in desired state (${alreadyDesiredDevices.join(', ')}).${detailSuffix}`,
              });
              return;
            }
            if (alreadyActiveDevices.length > 0 || alreadyDesiredDevices.length > 0) {
              const activeNote =
                alreadyActiveDevices.length > 0
                  ? ` Already active: ${alreadyActiveDevices.join(', ')}.`
                  : '';
              const desiredNote =
                alreadyDesiredDevices.length > 0
                  ? ` Already in desired state: ${alreadyDesiredDevices.join(', ')}.`
                  : '';
              setSnackbar({
                severity: 'success',
                message: `${module.name} executed successfully on ${successes.length} device${
                  successes.length === 1 ? '' : 's'
                }.${activeNote}${desiredNote}${detailSuffix}`,
              });
              return;
            }
            setSnackbar({
              severity: 'success',
              message: `${module.name} executed successfully on ${successes.length} device${successes.length === 1 ? '' : 's'}.${detailSuffix}`,
            });
          }
        } else if (successes.length > 0) {
          const alreadyOnStatuses = deviceResults.filter((result) => result.success).filter((result) => {
            const payload = (result.response as any)?.result ?? (result.response as any);
            return Boolean(payload?.already_on || payload?.already_active);
          });
          if (module.id === 'activate_data' && alreadyOnStatuses.length === deviceResults.length) {
            setSnackbar({
              severity: 'error',
              message: `${module.name}: Mobile data is already enabled.${detailSuffix}`,
            });
          } else {
            const failedList = failures.map((item) => item.deviceId).join(', ');
            setSnackbar({
              severity: 'warning',
              message: `${module.name} executed on ${successes.length} device${successes.length === 1 ? '' : 's'}. Failed for: ${failedList}.${detailSuffix}`,
            });
          }
        } else {
          const reasons = failures.map((item) => `${item.deviceId}: ${item.reason}`).join(' | ');
          setSnackbar({
            severity: 'error',
            message: `${module.name} failed on all selected devices. ${reasons}.${detailSuffix}`,
          });
        }
      } catch (err) {
        const detail = formatExecutionError(err);
        const actionSuffix = detail.action ? ` Action: ${detail.action}` : '';
        setSnackbar({
          severity: 'error',
          message: `${module.name} execution aborted. ${detail.message}${actionSuffix}`,
        });
      } finally {
        stopProgress(module.id);
        setModuleRunStatuses((prev) => {
          const next = { ...prev };
          delete next[module.id];
          return next;
        });
      }
    },
    [
      backendUrl,
      resolveRunTargets,
      pingConfig,
      wrongApnValue,
      logPullDestination,
      customCode,
      appLauncherSelection,
      appLauncherDuration,
      fetchModuleStatus,
    ]
  );

  const cancelModuleRun = useCallback(
    async (module: ModuleMetadata) => {
      if (!backendUrl) {
        setSnackbar({ severity: 'error', message: 'Backend unavailable: no URL configured.' });
        return;
      }
      let statusId = moduleStatusEntries[module.id]?.status_id || moduleStatusIds[module.id];
      if (!statusId) {
        const latestStatus = await fetchModuleStatus({ moduleId: module.id });
        if (latestStatus?.status_id) {
          statusId = latestStatus.status_id;
          setModuleStatusEntries((prev) => ({ ...prev, [module.id]: latestStatus }));
          setModuleStatusIds((prev) => ({ ...prev, [module.id]: latestStatus.status_id }));
        }
      }
      if (!statusId) {
        setSnackbar({
          severity: 'error',
          message: 'Unable to cancel yet: status not available. Please retry in a few seconds.',
        });
        return;
      }
      const normalizedBackendUrl = resolveBaseUrl(backendUrl);
      try {
        const response = await fetchWithRetry(
          `${normalizedBackendUrl}/api/modules/${module.id}/cancel`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders(),
            },
            body: JSON.stringify({ status_id: statusId }),
          },
          { retries: 1, backoffMs: 400, retryOn: [408, 429, 500, 502, 503, 504] }
        );
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `HTTP ${response.status}`);
        }
        setSnackbar({ severity: 'info', message: `${module.name} cancellation requested.` });
      } catch (error) {
        const detail = formatExecutionError(error);
        setSnackbar({
          severity: 'error',
          message: `${module.name} cancellation failed. ${detail.message}`,
        });
      }
    },
    [backendUrl, fetchModuleStatus, moduleStatusEntries, moduleStatusIds]
  );

  const handleRun = (module: ModuleMetadata) => {
    setLastDeviceModuleRun(null);
    if (module.id === 'waiting_time') {
      setSnackbar({
        severity: 'info',
        message: 'Waiting Time is only available inside custom workflows.',
      });
      return;
    }
    if (module.id === 'call_test') {
      const targets = resolveRunTargets();
      if (targets.length === 0) {
        setSnackbar({
          severity: 'error',
          message: 'Select at least one device on the dashboard before running the Call Test.',
        });
        return;
      }
      runResultsRef.current = { success: [], failure: [] };
      void runCallTestBatch(targets);
      return;
    }

    if (module.id === 'ping') {
      setSnackbar({
        severity: 'warning',
        message: 'Ping requires mobile data. Enable data first if this test fails.',
      });
    }

    if (DEVICE_MODULE_IDS.has(module.id)) {
      runDeviceModule(module, { silent: module.id === 'ping' });
      return;
    }

    if ((window as any).electronAPI?.runScript) {
      (window as any).electronAPI.runScript(scriptPath(module.script));
      setSnackbar({ message: `Running ${module.name}...`, severity: 'success' });
      return;
    }
    console.info(`Run requested for ${module.script}`);
    setSnackbar({ message: `Run placeholder: ${module.script}`, severity: 'info' });
  };

  const closeAppLauncherDialog = () => {
    setAppLauncherDialogSelection(appLauncherSelection);
    setAppLauncherDialogDuration(String(appLauncherDuration));
    setAppLauncherDialogOpen(false);
  };

  const handleAppLauncherDialogSave = () => {
    const parsed = Number(appLauncherDialogDuration.trim());
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setSnackbar({
        severity: 'error',
        message: 'Enter a duration greater than 0 seconds.',
      });
      return;
    }
    const normalized = Math.round(parsed);
    setAppLauncherSelection(appLauncherDialogSelection);
    setAppLauncherDuration(normalized);
    setAppLauncherDialogOpen(false);
    setSnackbar({
      severity: 'success',
      message: `Smart App Launcher will target ${APP_LAUNCHER_DISPLAY[appLauncherDialogSelection]} for ${normalized}s.`,
    });
  };

  const handleEdit = (module: ModuleMetadata) => {
    if (moduleRunStatuses[module.id] === 'running') {
      setSnackbar({
        severity: 'info',
        message: 'This module is running and cannot be edited right now.',
      });
      return;
    }
    if (module.id === 'call_test') {
      const sequence = liveSelectedDeviceIds.length > 0 ? liveSelectedDeviceIds : [GLOBAL_CALL_TEST_KEY];
      setCallTestMode('edit');
      setCallTestTargets(sequence);
      setCallTestTotalSteps(sequence.length);
      setCallTestStepIndex(0);
      const first = sequence[0];
      setCurrentCallTestDeviceId(first);
      setCallTestDialogInitialValues(getCallTestValuesForDevice(first === GLOBAL_CALL_TEST_KEY ? null : first));
      setCallTestPendingValues({});
      runResultsRef.current = { success: [], failure: [] };
      setCallTestDialogOpen(true);
      return;
    }
    if (module.id === 'launch_app') {
      setAppLauncherDialogSelection(appLauncherSelection);
      setAppLauncherDialogDuration(String(appLauncherDuration));
      setAppLauncherDialogOpen(true);
      return;
    }

    if (module.id === 'waiting_time') {
      setWaitingTimeDraft(String(waitingTimeDuration));
      setWaitingTimeDialogError(null);
      setWaitingTimeDialogOpen(true);
      return;
    }

    if (module.id === 'ping') {
      setPingDraft(toPingDraft(pingConfig));
      setPingDialogError(null);
      setPingTargetError(null);
      setPingTargetTouched(false);
      setPingDialogOpen(true);
      return;
    }

    if (module.id === 'wrong_apn_configuration') {
      setWrongApnDraft(wrongApnValue);
      setWrongApnDialogOpen(true);
      return;
    }

    if (module.id === 'pull_device_logs' || module.id === 'pull_rf_logs') {
      setLogPullDraft(logPullDestination);
      setLogPullDialogError(null);
      setLogPullDialogOpen(true);
      return;
    }

    if (module.id === 'dial_secret_code') {
      setCustomScriptDraft(customCode);
      setCustomScriptDialogError(null);
      setCustomScriptDialogOpen(true);
      return;
    }

    if ((window as any).electronAPI?.openFile) {
      (window as any).electronAPI.openFile(scriptPath(module.script));
      setSnackbar({ message: `Opening ${module.name} in editor...`, severity: 'success' });
      return;
    }
    setSnackbar({ message: `Script path: ${scriptPath(module.script)}`, severity: 'info' });
  };

  const insertModuleInstance = useCallback(
    (module: ModuleMetadata | null, targetId: string | null, insertAfterTarget: boolean = false) => {
      if (!module) {
        return;
      }
      const instance = createWorkflowInstance(module);
      setSelectedModules((prev) => {
        if (targetId) {
          const targetIndex = prev.findIndex((entry) => entry.instanceId === targetId);
          if (targetIndex === -1) {
            return [...prev, instance];
          }
          const next = [...prev];
          const insertionIndex = Math.min(next.length, targetIndex + (insertAfterTarget ? 1 : 0));
          next.splice(insertionIndex, 0, instance);
          return next;
        }
        return [...prev, instance];
      });
      setShowWorkflowBuilder(true);
    },
    []
  );

  const handleAddModule = (module: ModuleMetadata) => {
    let hydratedModule =
      module.id === 'waiting_time'
        ? { ...module, waitDurationSeconds: waitingTimeDuration }
        : { ...module };
    if (module.id === 'call_test') {
      const preferredDeviceId = liveSelectedDeviceIds[0] ?? null;
      const snapshot = { ...getCallTestValuesForDevice(preferredDeviceId) };
      hydratedModule = {
        ...hydratedModule,
        callTestParams: snapshot,
      };
    }
    if (module.id === 'dial_secret_code') {
      hydratedModule = {
        ...hydratedModule,
        secretCode: customCode.trim() || DEFAULT_DIAL_SECRET_CODE,
      };
    }
    if (module.id === 'launch_app') {
      hydratedModule = {
        ...hydratedModule,
        appLaunchTarget: appLauncherSelection,
        appLaunchDurationSeconds: appLauncherDuration,
      };
    }
    if (module.id === 'ping') {
      hydratedModule = {
        ...hydratedModule,
        pingTarget: pingConfig.target,
        pingDurationSeconds: pingConfig.duration,
        pingIntervalSeconds: pingConfig.interval,
      };
    }
    if (module.id === 'wrong_apn_configuration') {
      hydratedModule = {
        ...hydratedModule,
        wrongApnValue,
      };
    }
    if (module.id === 'pull_device_logs' || module.id === 'pull_rf_logs') {
      hydratedModule = {
        ...hydratedModule,
        logPullDestination,
      };
    }
    insertModuleInstance(hydratedModule, null);
    setSnackbar({ message: `Added ${module.name} to workflow`, severity: 'success' });
    setRecents((prev) => {
      const next = [module.id, ...prev.filter((id) => id !== module.id)].slice(0, 8);
      persistRecents(next);
      return next;
    });
  };

  const handleRemoveModule = (instanceId: string) => {
    setSelectedModules((prev) => prev.filter((m) => m.instanceId !== instanceId));
  };

  const closeWaitingTimeDialog = () => {
    setWaitingTimeDialogOpen(false);
    setWaitingTimeDialogError(null);
  };

  const handleWaitingTimeSave = () => {
    const parsed = Number(waitingTimeDraft);
    if (!Number.isFinite(parsed)) {
      setWaitingTimeDialogError('Enter a value between 1 and 600 seconds.');
      return;
    }
    const sanitized = sanitizeWaitingTimeDuration(parsed);
    setWaitingTimeDuration(sanitized);
    persistWaitingTimeDuration(sanitized);
    setWaitingTimeDraft(String(sanitized));
    setSnackbar({
      severity: 'success',
      message: `Waiting time set to ${sanitized} second${sanitized > 1 ? 's' : ''}.`,
    });
    closeWaitingTimeDialog();
  };

  const handleWrongApnClose = () => {
    setWrongApnDialogOpen(false);
  };

  const handleWrongApnSave = () => {
    const sanitized = (wrongApnDraft || '')
      .trim()
      .replace(/[^A-Za-z0-9._-]/g, '');
    const finalValue = sanitized.length > 0 ? sanitized : DEFAULT_WRONG_APN;
    setWrongApnValue(finalValue);
    setWrongApnDraft(finalValue);
    setSnackbar({
      severity: 'success',
      message: `Wrong APN value set to "${finalValue}".`,
    });
    setWrongApnDialogOpen(false);
  };

  const toggleFavorite = useCallback((moduleId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      persistFavorites(next);
      return next;
    });
  }, []);

  const handleLogPullClose = () => {
    setLogPullDialogOpen(false);
    setLogPullDialogError(null);
  };

  const handleLogPullSave = () => {
    const trimmed = (logPullDraft || '').trim();
    if (!trimmed) {
      setLogPullDialogError('Destination path is required.');
      return;
    }
    setLogPullDestination(trimmed);
    setSnackbar({
      severity: 'success',
      message: `Log pull destination set to "${trimmed}".`,
    });
    setLogPullDialogError(null);
    setLogPullDialogOpen(false);
  };

  const renderPingDetails = (response?: Record<string, unknown>) => {
    if (!response) {
      return null;
    }
    const packetsTx = typeof response.packets_transmitted === 'number' ? response.packets_transmitted : undefined;
    const packetsRx = typeof response.packets_received === 'number' ? response.packets_received : undefined;
    const packetLoss =
      typeof response.packet_loss_percent === 'number' ? `${response.packet_loss_percent.toFixed(2)}%` : undefined;
    const rtt = response.rtt && typeof response.rtt === 'object' ? (response.rtt as Record<string, unknown>) : null;
    const rttSummary =
      rtt && typeof rtt.avg_ms === 'number'
        ? `avg ${rtt.avg_ms.toFixed(2)} ms (min ${Number(rtt.min_ms ?? 0).toFixed(2)} - max ${Number(rtt.max_ms ?? 0).toFixed(2)})`
        : null;
    return (
      <Stack spacing={0.5} sx={{ mt: 1 }}>
        {typeof response.target === 'string' && (
          <Typography variant="body2" sx={{ color: '#475569' }}>
            Target: <Box component="span" sx={{ fontWeight: 600 }}>{response.target}</Box>
          </Typography>
        )}
        {(packetsTx !== undefined || packetsRx !== undefined) && (
          <Typography variant="body2" sx={{ color: '#475569' }}>
            Packets: {packetsTx ?? '-'} sent / {packetsRx ?? '-'} received
          </Typography>
        )}
        {packetLoss && (
          <Typography variant="body2" sx={{ color: '#475569' }}>
            Packet loss: {packetLoss}
          </Typography>
        )}
        {rttSummary && (
          <Typography variant="body2" sx={{ color: '#475569' }}>
            RTT: {rttSummary}
          </Typography>
        )}
      </Stack>
    );
  };

  const reorderSelectedModules = (
    draggedId: string,
    targetId: string | null,
    insertAfterTarget: boolean = false
  ) => {
    if (draggedId === targetId) {
      return;
    }
    setSelectedModules((prev) => {
      const draggedIndex = prev.findIndex((entry) => entry.instanceId === draggedId);
      if (draggedIndex === -1) {
        return prev;
      }
      const next = [...prev];
      const [removed] = next.splice(draggedIndex, 1);
      if (!targetId) {
        next.push(removed);
      } else {
        const targetIndex = next.findIndex((entry) => entry.instanceId === targetId);
    if (targetIndex === -1) {
      return prev;
    }
    const insertionIndex = Math.min(next.length, targetIndex + (insertAfterTarget ? 1 : 0));
    next.splice(insertionIndex, 0, removed);
      }
      return next;
    });
  };

  const shouldInsertAfterTarget = (
    event: React.DragEvent<HTMLDivElement>,
    targetId: string | null
  ) => {
    if (!targetId) {
      return true;
    }
    const element = event.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();
    return event.clientX > rect.left + rect.width / 2;
  };

  const swapHoverState = useCallback(
    (targetId: string | null, insertAfter: boolean) => {
      if (!targetId) {
        setHoveredBuilderTarget(null);
        return;
      }
      setHoveredBuilderTarget({ id: targetId, insertAfter });
    },
    []
  );

  const handleModuleDragStart = (event: React.DragEvent<HTMLDivElement>, moduleId: string) => {
    event.dataTransfer.setData('text/plain', `builder:${moduleId}`);
    event.dataTransfer.effectAllowed = 'move';
    setDraggingModuleId(moduleId);
    setDraggingCatalogModuleId(null);
    setHoveredBuilderTarget(null);
  };

  const handleModuleDragOver = (event: React.DragEvent<HTMLDivElement>, targetId: string | null) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const insertAfter = shouldInsertAfterTarget(event, targetId);
    swapHoverState(targetId, insertAfter);
  };

  const handleModuleDrop = (event: React.DragEvent<HTMLDivElement>, targetId: string | null) => {
    event.preventDefault();
    const payload = parseDragPayload(event.dataTransfer.getData('text/plain'));
    const resolvedTargetId = targetId ?? hoveredBuilderTarget?.id ?? null;
    const insertAfterTarget =
      targetId !== null ? shouldInsertAfterTarget(event, targetId) : hoveredBuilderTarget?.insertAfter ?? true;
    if (payload?.source === 'builder') {
      reorderSelectedModules(payload.id, resolvedTargetId, insertAfterTarget);
    } else if (payload?.source === 'catalog') {
      const module = findModuleById(payload.id);
      insertModuleInstance(module ?? null, resolvedTargetId, insertAfterTarget);
    }
    setDraggingModuleId(null);
    setDraggingCatalogModuleId(null);
    setHoveredBuilderTarget(null);
  };

  const moveSelectedModule = useCallback((instanceId: string, direction: -1 | 1) => {
    setSelectedModules((prev) => {
      const index = prev.findIndex((entry) => entry.instanceId === instanceId);
      if (index === -1) {
        return prev;
      }
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }, []);

  const handleModuleDragEnd = () => {
    setDraggingModuleId(null);
    setDraggingCatalogModuleId(null);
  };

  const handleCatalogDragStart = (event: React.DragEvent<HTMLDivElement>, module: ModuleMetadata) => {
    event.dataTransfer.setData('text/plain', `catalog:${module.id}`);
    event.dataTransfer.effectAllowed = 'copyMove';
    setDraggingCatalogModuleId(module.id);
  };

  const handleCatalogDragEnd = () => {
    setDraggingCatalogModuleId(null);
  };

  const handleCatalogAreaDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (draggingModuleId) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    }
  };

  const handleCatalogAreaDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!draggingModuleId) {
      return;
    }
    event.preventDefault();
    const payload = parseDragPayload(event.dataTransfer.getData('text/plain'));
    const targetId = payload?.source === 'builder' ? payload.id : draggingModuleId;
    if (targetId) {
      handleRemoveModule(targetId);
    }
    setDraggingModuleId(null);
  };

  const handleBuildWorkflow = () => {
    if (selectedModules.length === 0 || !workflowName.trim()) {
      setSnackbar({ severity: 'error', message: 'Select modules and provide a workflow name before saving.' });
      return;
    }

    addStoredWorkflow({
      name: workflowName.trim(),
      description: workflowDescription.trim(),
      modules: selectedModules.map((item) => item.module),
      tags: [],
    });

    setSnackbar({ message: `Workflow "${workflowName}" created with ${selectedModules.length} module(s)`, severity: 'success' });
    setSelectedModules([]);
    setShowWorkflowBuilder(false);
    setWorkflowName('');
    setWorkflowDescription('');
  };

  return (
    <Layout>
      {deviceNotifications.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            top: 96,
            right: 24,
            zIndex: 1400,
            width: 320,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {deviceNotifications.map((notification) => (
            <Alert
              key={notification.id}
              severity={notification.success ? 'success' : 'error'}
              variant="filled"
              sx={{ boxShadow: 3 }}
              onClose={() =>
                setDeviceNotifications((prev) => prev.filter((item) => item.id !== notification.id))
              }
            >
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {notification.moduleId} - {notification.deviceId}
              </Typography>
              <Typography variant="body2">{notification.message}</Typography>
            </Alert>
          ))}
        </Box>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, gap: 2 }}>
        <Typography variant="h1" sx={{
          fontSize: '28px',
          lineHeight: '36px',
          fontWeight: 700,
          color: '#0F172A'
        }}>
          Modules
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TextField
            placeholder="Search modules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            inputRef={searchInputRef}
            sx={{
              width: 260,
              '& .MuiOutlinedInput-root': {
                height: 40,
                borderRadius: '10px'
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
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <Select
              value={moduleCategoryFilter}
              onChange={(event) => setModuleCategoryFilter(event.target.value as string)}
              displayEmpty
            >
              {moduleCategories.map((category) => (
                <MenuItem key={category} value={category}>
                  {category === 'all' ? 'All' : category}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <ToggleButtonGroup
            size="small"
            value={
              moduleFilterMode === 'favorites'
                ? 'favorites'
                : moduleFilterMode === 'recents'
                  ? 'recents'
                  : null
            }
            exclusive
          >
            <ToggleButton
              value="favorites"
              sx={{ gap: 0.5 }}
              selected={moduleFilterMode === 'favorites'}
              onClick={() => setModuleFilterMode((prev) => (prev === 'favorites' ? 'all' : 'favorites'))}
            >
              <Star size={16} /> Favorites
            </ToggleButton>
            <ToggleButton
              value="recents"
              selected={moduleFilterMode === 'recents'}
              onClick={() => setModuleFilterMode((prev) => (prev === 'recents' ? 'all' : 'recents'))}
            >
              Recents
            </ToggleButton>
          </ToggleButtonGroup>
        <Chip
          label={
            hasSelectedDevices
              ? `${liveSelectedDeviceIds.length} active device${liveSelectedDeviceIds.length === 1 ? '' : 's'}`
              : 'No active device'
            }
            size="small"
            sx={{
              backgroundColor: '#EEF2FF',
              color: '#2563EB',
              fontWeight: 600
            }}
          />
        </Box>
      </Box>

      {/* Recents chips section removed per request */}

      {!showWorkflowBuilder && hasWorkflowDraft && (
        <Alert
          severity="info"
          sx={{ mb: 3 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setShowWorkflowBuilder(true);
                setSnackbar({ severity: 'info', message: 'Workflow draft restored.' });
              }}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Continue
            </Button>
          }
        >
          A draft workflow was not saved. Click Continue to resume editing.
        </Alert>
      )}

      {selectionReminderVisible && (
        <Alert severity={selectionReminderSeverity} sx={{ mb: 3 }}>
          {selectionReminderMessage}
        </Alert>
      )}

      {/* Workflow Builder */}
      {showWorkflowBuilder && (
        <Card sx={{
          backgroundColor: '#F8FAFC',
          border: '2px solid #2563EB',
          borderRadius: '16px',
          mb: 4,
          transition: 'all 0.2s ease-in-out'
        }}>
          <CardContent sx={{ padding: '20px 24px' }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h6" sx={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#0F172A'
              }}>
                Custom Workflow Builder ({selectedModules.length} modules)
              </Typography>
              <Box display="flex" gap={2} alignItems="center">
                <TextField
                  placeholder="Workflow name"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  size="small"
                  sx={{ width: 200 }}
                />
                <TextField
                  placeholder="Description (optional)"
                  value={workflowDescription}
                  onChange={(e) => setWorkflowDescription(e.target.value)}
                  size="small"
                  sx={{ width: 260 }}
                />
                <Button
                  variant="contained"
                  onClick={handleBuildWorkflow}
                  disabled={selectedModules.length === 0 || !workflowName.trim()}
                  sx={{
                    backgroundColor: '#16A34A',
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontWeight: 600,
                    '&:hover': { backgroundColor: '#15803D' }
                  }}
                >
                  Build Workflow
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => { setSelectedModules([]); setShowWorkflowBuilder(false); setWorkflowName(''); setWorkflowDescription(''); }}
                  sx={{
                    borderColor: '#6B7280',
                    color: '#6B7280',
                    borderRadius: '8px',
                    textTransform: 'none'
                  }}
                >
                  Cancel
                </Button>
              </Box>
            </Box>
            
            <Box
              display="flex"
              flexWrap="wrap"
              gap={1}
              onDragOver={(event) => handleModuleDragOver(event, null)}
              onDrop={(event) => handleModuleDrop(event, null)}
              sx={{
                minHeight: 64,
                border: draggingCatalogModuleId ? '1px dashed #2563EB' : '1px dashed transparent',
                borderRadius: '12px',
                padding: 1,
                backgroundColor: draggingCatalogModuleId ? '#EEF2FF' : 'transparent',
                transition: 'border-color 0.2s ease, background-color 0.2s ease',
              }}
            >
              {selectedModules.map((entry, index) => {
                const isFirst = index === 0;
                const isLast = index === selectedModules.length - 1;
                const running = moduleRunStatuses[entry.module.id] === 'running';
                return (
                  <Box
                    key={entry.instanceId}
                    draggable
                    onDragStart={(event) => handleModuleDragStart(event, entry.instanceId)}
                    onDragOver={(event) => handleModuleDragOver(event, entry.instanceId)}
                    onDrop={(event) => handleModuleDrop(event, entry.instanceId)}
                    onDragEnd={handleModuleDragEnd}
                    sx={{ cursor: 'grab', display: 'inline-flex' }}
                  >
                    <Box
                      display="flex"
                      alignItems="center"
                      gap={0.5}
                      sx={{
                        backgroundColor: draggingModuleId === entry.instanceId ? '#DBEAFE' : '#EEF2FF',
                        borderRadius: '12px',
                        padding: '4px 6px',
                        border: draggingModuleId === entry.instanceId ? '1px dashed #2563EB' : 'none'
                      }}
                    >
                      <IconButton
                        size="small"
                        disabled={isFirst || running}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          moveSelectedModule(entry.instanceId, -1);
                        }}
                      >
                        <ArrowLeft size={16} />
                      </IconButton>
                      <Chip
                        label={`${index + 1}. ${entry.module.name}`}
                        onDelete={() => handleRemoveModule(entry.instanceId)}
                        sx={{ color: '#2563EB', borderRadius: '8px' }}
                      />
                      <IconButton
                        size="small"
                        disabled={isLast || running}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          moveSelectedModule(entry.instanceId, 1);
                        }}
                      >
                        <ArrowRight size={16} />
                      </IconButton>
                    </Box>
                  </Box>
                );
              })}
              {selectedModules.length === 0 && (
                <Typography sx={{ color: '#6B7280', fontStyle: 'italic' }}>
                  No modules selected. Click the + button on modules below to add them.
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      <Box
        onDragOver={handleCatalogAreaDragOver}
        onDrop={handleCatalogAreaDrop}
      >
      <Grid container spacing={3}>
        {filteredModules.map((module) => {
          const moduleRunning = moduleRunStatuses[module.id] === 'running';
          const moduleStatusEntry = moduleStatusEntries[module.id];
          const isPingRunning = module.id === 'ping' && moduleRunning;
          const runButtonBackground = isPingRunning ? '#16A34A' : '#2563EB';
          const runButtonHover = isPingRunning ? '#15803D' : '#1E48C7';
          const totalDevices = moduleStatusEntry?.device_ids.length ?? 0;
          const pendingDevices = moduleStatusEntry?.pending_device_ids.length ?? 0;
          const runningLabel =
            totalDevices > 0 && pendingDevices > 0
              ? `Running (${totalDevices - pendingDevices}/${totalDevices})`
              : 'Running';
          const moduleDurationLabel = module.duration_estimate ?? module.durationEstimate;
          const avgDurationLabel = module.avg_duration ?? module.avgDuration;
          const prerequisites = module.prerequisites ?? [];
          const impactLabel = module.impact ? module.impact.toUpperCase() : null;
          return (
          <Grid item xs={12} sm={6} lg={4} key={module.id}>
            <Card
              draggable
              onDragStart={(event) => handleCatalogDragStart(event, module)}
              onDragEnd={handleCatalogDragEnd}
              sx={{
              backgroundColor: '#FFFFFF',
              border: draggingCatalogModuleId === module.id ? '1px dashed #2563EB' : '1px solid #E5E7EB',
              borderRadius: '16px',
              boxShadow: '0 1px 2px rgba(16, 24, 40, 0.06)',
              height: '100%',
              transition: 'all 0.2s',
              '&:hover': {
                boxShadow: '0 4px 8px rgba(16, 24, 40, 0.12)'
              }
            }}>
              <CardContent sx={{ padding: '20px 24px' }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Box>
                    <Box display="flex" alignItems="center" gap={1}>
                      {(() => {
                        const ModuleIcon = MODULE_ICON_MAP[module.id] || MODULE_ICON_MAP.default;
                        return <ModuleIcon size={18} color="#2563EB" />;
                      })()}
                      <Typography variant="h6" sx={{ 
                        fontWeight: 600, 
                        color: '#0F172A',
                        fontSize: '16px',
                        lineHeight: '24px'
                      }}>
                        {module.name}
                      </Typography>
                    </Box>
                    <Chip
                      label={module.category}
                      size="small"
                      sx={{
                        mt: 0.5,
                        backgroundColor: '#E0F2FE',
                        color: '#0369A1',
                        fontWeight: 600,
                        fontSize: '10px'
                      }}
                    />
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      onClick={() => toggleFavorite(module.id)}
                      size="small"
                      sx={{ color: favorites.has(module.id) ? '#F59E0B' : '#94A3B8' }}
                    >
                      {favorites.has(module.id) ? <Star size={18} fill="#F59E0B" /> : <StarOff size={18} />}
                    </IconButton>
                    <IconButton
                      onClick={() => handleAddModule(module)}
                      sx={{
                        width: 28,
                        height: 28,
                        backgroundColor: '#2563EB',
                        color: '#FFFFFF',
                        borderRadius: '6px',
                        '&:hover': {
                          backgroundColor: '#1E48C7'
                        }
                      }}
                    >
                      +
                    </IconButton>
                  </Stack>
                </Box>

                <Typography variant="body2" sx={{ 
                  color: '#6B7280', 
                  mb: 2,
                  fontSize: '14px',
                  lineHeight: '22px'
                }}>
                  {module.description}
                </Typography>
                {module.id === 'launch_app' && (
                  <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600, mb: 1 }}>
                    Target: {APP_LAUNCHER_DISPLAY[appLauncherSelection]}
                  </Typography>
                )}

                <Box display="flex" gap={2} flexDirection="column" mb={3}>
                  {moduleDurationLabel && (
                    <Box display="flex" alignItems="center" gap={1}>
                      <Timer size={16} color="#6B7280" />
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#6B7280',
                          fontSize: '12px',
                          lineHeight: '18px',
                          fontWeight: 500,
                        }}
                      >
                        {moduleDurationLabel}
                      </Typography>
                    </Box>
                  )}
                  {(typeof moduleRunProgress[module.id] === 'number') && (
                    <Box display="flex" alignItems="center" gap={1} sx={{ mt: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={moduleRunProgress[module.id]}
                        sx={{ flex: 1, height: 6, borderRadius: 3 }}
                      />
                      <Typography
                        variant="caption"
                        sx={{ color: '#64748B', fontSize: '11px', minWidth: 32, textAlign: 'right' }}
                      >
                        {Math.min(100, Math.round(moduleRunProgress[module.id]))}%
                      </Typography>
                    </Box>
                  )}
                </Box>

                <Box display="flex" gap={2}>
                  <Tooltip title={hasSelectedDevices ? (moduleRunning ? 'Stop module' : 'Run module') : 'Select at least one device'}>
                    <span style={{ flex: 1 }}>
                      {moduleRunning ? (
                        <Button
                          variant="outlined"
                          startIcon={<StopCircle size={16} />}
                          onClick={() => cancelModuleRun(module)}
                          disabled={!hasSelectedDevices}
                          sx={{
                            width: '100%',
                            borderRadius: '8px',
                            height: 40,
                            fontWeight: 600,
                            textTransform: 'none',
                            fontSize: '14px',
                            borderColor: '#DC2626',
                            color: '#DC2626',
                            '&:hover': {
                              borderColor: '#B91C1C',
                              backgroundColor: 'rgba(220, 38, 38, 0.08)'
                            }
                          }}
                        >
                          Stop
                        </Button>
                      ) : (
                        <Button
                          variant="contained"
                          startIcon={<Play size={16} />}
                          onClick={() => handleRun(module)}
                          disabled={!hasSelectedDevices || moduleRunning}
                          sx={{
                            width: '100%',
                            backgroundColor: runButtonBackground,
                            borderRadius: '8px',
                            height: 40,
                            fontWeight: 600,
                            textTransform: 'none',
                            fontSize: '14px',
                            '&:hover': {
                              backgroundColor: runButtonHover
                            },
                            '&.Mui-disabled': {
                              backgroundColor: '#94A3B8'
                            }
                          }}
                        >
                          Run
                        </Button>
                      )}
                    </span>
                  </Tooltip>
                  <Tooltip
                    title={
                      moduleRunning
                        ? 'Module running'
                        : module.id === 'call_test'
                          ? 'Edit parameters'
                          : module.editable
                            ? 'Edit script'
                            : 'Not editable'
                    }
                  >
                    <span>
                    <IconButton
                      onClick={() => handleEdit(module)}
                      disabled={moduleRunning || (!module.editable && module.id !== 'call_test')}
                      sx={{
                          backgroundColor: '#F1F5F9',
                          color: '#475569',
                          border: '1px solid #E2E8F0',
                          borderRadius: '8px',
                          width: 40,
                          height: 40,
                          '&:hover': {
                            backgroundColor: '#E2E8F0'
                          },
                          '&.Mui-disabled': {
                            opacity: 0.4,
                            borderColor: '#E2E8F0'
                          }
                        }}
                      >
                      <Pencil size={16} />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
              </CardContent>
            </Card>
          </Grid>
        );
        })}
          </Grid>
      </Box>



      <Dialog open={waitingTimeDialogOpen} onClose={closeWaitingTimeDialog} fullWidth maxWidth="xs">
        <DialogTitle>Waiting Time</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#475569', mb: 2 }}>
            Define how many seconds to wait between workflow modules.
          </Typography>
          <TextField
            label="Duration (seconds)"
            type="text"
            inputMode="numeric"
            value={waitingTimeDraft}
            onChange={(event) => {
              setWaitingTimeDraft(event.target.value);
              setWaitingTimeDialogError(null);
            }}
            fullWidth
            inputProps={{ min: WAITING_TIME_MIN_DURATION, max: WAITING_TIME_MAX_DURATION }}
            error={Boolean(waitingTimeDialogError)}
            helperText={waitingTimeDialogError ?? 'Between 1 and 600 seconds'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeWaitingTimeDialog} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleWaitingTimeSave} sx={{ textTransform: 'none' }}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={pingDialogOpen} onClose={() => setPingDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Ping configuration</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#475569', mb: 2 }}>
            Define the target host, duration (seconds), and interval between packets.
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Target (IP or domain)"
              value={pingDraft.target}
              onChange={(event) => {
                const nextValue = event.target.value;
                setPingDraft((prev) => ({ ...prev, target: nextValue }));
                if (pingTargetTouched) {
                  setPingTargetError(validatePingTarget(nextValue));
                }
                setPingDialogError(null);
              }}
              onBlur={() => {
                setPingTargetTouched(true);
                setPingTargetError(validatePingTarget(pingDraft.target));
              }}
              error={Boolean(pingTargetError)}
              helperText={pingTargetError ?? PING_TARGET_HELPER_TEXT}
              fullWidth
            />
            <TextField
              label="Duration (seconds)"
              type="number"
              value={pingDraft.duration}
              onChange={(event) => {
                setPingDraft((prev) => ({ ...prev, duration: event.target.value }));
                setPingDialogError(null);
              }}
              inputProps={{ min: 1, max: 600 }}
              fullWidth
            />
            <TextField
              label="Interval (seconds)"
              type="number"
              value={pingDraft.interval}
              onChange={(event) => {
                setPingDraft((prev) => ({ ...prev, interval: event.target.value }));
                setPingDialogError(null);
              }}
              inputProps={{ min: 0.2, max: 5, step: 0.1 }}
              fullWidth
            />
            {pingDialogError ? <Alert severity="error">{pingDialogError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPingDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            sx={{ textTransform: 'none' }}
            onClick={() => {
              const targetError = validatePingTarget(pingDraft.target);
              setPingTargetTouched(true);
              setPingTargetError(targetError);
              if (targetError) {
                setPingDialogError(null);
                return;
              }
              const durationValue = Number.parseFloat(pingDraft.duration);
              if (!Number.isFinite(durationValue) || durationValue < 1) {
                setPingDialogError('Duration must be a positive number.');
                return;
              }
              const intervalValue = Number.parseFloat(pingDraft.interval);
              if (!Number.isFinite(intervalValue) || intervalValue < 0.2) {
                setPingDialogError('Interval must be at least 0.2 seconds.');
                return;
              }
              const sanitized: PingConfig = {
                target: pingDraft.target.trim(),
                duration: Math.max(1, Math.round(durationValue)),
                interval: Math.min(5, Math.max(0.2, intervalValue)),
              };
              setPingConfig(sanitized);
              persistPingConfig(sanitized);
              setPingDraft(toPingDraft(sanitized));
              setPingDialogError(null);
              setPingTargetError(null);
              setPingTargetTouched(false);
              setPingDialogOpen(false);
              setSnackbar({ severity: 'success', message: 'Ping configuration saved.' });
            }}
          >
            Save
          </Button>
      </DialogActions>
    </Dialog>

      <Dialog open={wrongApnDialogOpen} onClose={handleWrongApnClose} fullWidth maxWidth="xs">
        <DialogTitle>Wrong APN Configuration</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="Wrong APN value"
            fullWidth
            value={wrongApnDraft}
            onChange={(event) => setWrongApnDraft(event.target.value)}
            helperText='Used by the "Wrong APN Configuration" module (default "arnaud").'
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleWrongApnClose}>Cancel</Button>
          <Button variant="contained" onClick={handleWrongApnSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={appLauncherDialogOpen} onClose={closeAppLauncherDialog} fullWidth maxWidth="xs">
        <DialogTitle>Smart App Launcher</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#475569', mb: 2 }}>
            Choose the target to exercise: YouTube plays a random video, Maps opens navigation, and Chrome News opens a curated tab.
          </Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="app-launcher-select-label">Target application</InputLabel>
            <Select
              labelId="app-launcher-select-label"
              label="Target application"
              value={appLauncherDialogSelection}
              onChange={(event) => setAppLauncherDialogSelection(event.target.value as AppLauncherOption)}
            >
              {APP_LAUNCHER_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {APP_LAUNCHER_DISPLAY[option]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Duration (seconds)"
            type="text"
            inputMode="numeric"
            fullWidth
            value={appLauncherDialogDuration}
            onChange={(event) => {
              setAppLauncherDialogDuration(event.target.value);
            }}
            helperText="App stays open for the duration before being closed automatically."
            sx={{ mb: 1 }}
          />
        </DialogContent>
          <DialogActions>
            <Button onClick={closeAppLauncherDialog} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button variant="contained" onClick={handleAppLauncherDialogSave} sx={{ textTransform: 'none' }}>
              Save
            </Button>
          </DialogActions>
      </Dialog>

      <Dialog open={logPullDialogOpen} onClose={handleLogPullClose} fullWidth maxWidth="sm">
        <DialogTitle>Log Pull Destination</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="Log pull destination (PC path)"
            fullWidth
            value={logPullDraft}
            onChange={(event) => setLogPullDraft(event.target.value)}
            error={Boolean(logPullDialogError)}
            helperText={logPullDialogError || 'Directory where /sdcard/log content will be copied (per device subfolder).'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleLogPullClose}>Cancel</Button>
          <Button variant="contained" onClick={handleLogPullSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      

      <Dialog open={customScriptDialogOpen} onClose={() => setCustomScriptDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Dial Secret/USSD Code</DialogTitle>
        <DialogContent>
          <TextField
            margin="dense"
            label="Code to dial (e.g., *#9900#)"
            fullWidth
            value={customScriptDraft}
            onChange={(event) => setCustomScriptDraft(sanitizeSecretCode(event.target.value))}
            error={Boolean(customScriptDialogError)}
            helperText={
              customScriptDialogError ||
              'Only digits, * and # are supported; the code will be typed then CALL sent.'
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomScriptDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              const trimmed = sanitizeSecretCode(customScriptDraft || '');
              if (!trimmed) {
                setCustomScriptDialogError('Enter a code to dial.');
                return;
              }
              setCustomCode(trimmed);
              persistCustomCode(trimmed);
              setSelectedModules((prev) =>
                prev.map((entry) =>
                  entry.module.id === 'dial_secret_code'
                    ? { ...entry, module: { ...entry.module, secretCode: trimmed } }
                    : entry
                )
              );
              setCustomScriptDialogError(null);
              setCustomScriptDialogOpen(false);
              setSnackbar({ severity: 'success', message: 'Code saved.' });
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <CallTestDialog
        open={callTestDialogOpen}
        mode={callTestMode}
        initialValues={callTestDialogInitialValues}
        targetDeviceId={callTestDialogTarget}
        stepIndex={callTestTotalSteps === 0 ? undefined : callTestStepIndex + 1}
        totalSteps={callTestTotalSteps}
        canGoBack={callTestStepIndex > 0}
        onPrevious={handleCallTestPrevious}
        onCancel={() => {
          setCallTestDialogOpen(false);
          setCurrentCallTestDeviceId(null);
          setCallTestStepIndex(0);
          setCallTestTotalSteps(0);
          setCallTestTargets([]);
          setCallTestPendingValues({});
          runResultsRef.current = { success: [], failure: [] };
          if (callTestMode === 'run') {
            setSnackbar({ severity: 'info', message: 'Call Test cancelled.' });
          }
        }}
        onSubmit={handleCallTestSubmit}
      />

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={8000}
        onClose={() => setSnackbar(undefined)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {snackbar ? (
          <Alert
            severity={snackbar.severity}
            variant="filled"
            onClose={() => setSnackbar(undefined)}
            sx={{
              borderRadius: '10px',
              fontWeight: 600,
              boxShadow: '0 10px 24px rgba(0, 0, 0, 0.25)',
            }}
          >
            {snackbar.message}
          </Alert>
        ) : null}
      </Snackbar>
    </Layout>
  );
};

export default TestModules;

