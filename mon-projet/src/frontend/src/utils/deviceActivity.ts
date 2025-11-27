export type DeviceActivityType = 'module' | 'workflow';

export interface DeviceActivityEntry {
  id: string;
  type: DeviceActivityType;
  label: string;
  status: 'success' | 'failure';
  timestamp: string;
  referenceId?: string;
  details?: string;
}

export type DeviceActivityLog = Record<string, DeviceActivityEntry[]>;

export const DEVICE_ACTIVITY_STORAGE_KEY = 'deviceActivityLog';
export const DEVICE_ACTIVITY_EVENT = 'deviceActivity:updated';
const MAX_EVENTS_PER_DEVICE = 40;

const emitUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DEVICE_ACTIVITY_EVENT));
  }
};

const readLog = (): DeviceActivityLog => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(DEVICE_ACTIVITY_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as DeviceActivityLog;
    }
  } catch (error) {
    console.warn('[deviceActivity] Failed to read log', error);
  }
  return {};
};

const persistLog = (log: DeviceActivityLog) => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(DEVICE_ACTIVITY_STORAGE_KEY, JSON.stringify(log));
    emitUpdate();
  } catch (error) {
    console.warn('[deviceActivity] Failed to persist log', error);
  }
};

export const recordDeviceActivity = ({
  deviceId,
  type,
  label,
  status,
  referenceId,
  details,
  timestamp,
}: {
  deviceId: string;
  type: DeviceActivityType;
  label: string;
  status: 'success' | 'failure';
  referenceId?: string;
  details?: string;
  timestamp?: string;
}): void => {
  if (!deviceId) {
    return;
  }
  const log = readLog();
  const entries = log[deviceId] ? [...log[deviceId]] : [];
  const entry: DeviceActivityEntry = {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    label,
    status,
    timestamp: timestamp ?? new Date().toISOString(),
    referenceId,
    details,
  };
  entries.unshift(entry);
  log[deviceId] = entries.slice(0, MAX_EVENTS_PER_DEVICE);
  persistLog(log);
};

export const getDeviceActivity = (deviceId: string): DeviceActivityEntry[] => {
  if (!deviceId) {
    return [];
  }
  const log = readLog();
  return log[deviceId] ? [...log[deviceId]] : [];
};

export const getAllDeviceActivities = (): DeviceActivityLog => {
  return readLog();
};
