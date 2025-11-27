const DEVICE_HISTORY_STORAGE_KEY = 'deviceWorkflowHistory';
export const DEVICE_HISTORY_EVENT = 'device-history:updated';

export interface DeviceWorkflowRun {
  workflowId: string;
  workflowName: string;
  executedAt: string;
}

type DeviceWorkflowHistory = Record<string, DeviceWorkflowRun[]>;

const emitHistoryUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DEVICE_HISTORY_EVENT));
  }
};

const readHistory = (): DeviceWorkflowHistory => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(DEVICE_HISTORY_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as DeviceWorkflowHistory;
    }
  } catch (error) {
    console.warn('[deviceHistory] Failed to read history', error);
  }
  return {};
};

const persistHistory = (history: DeviceWorkflowHistory) => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(DEVICE_HISTORY_STORAGE_KEY, JSON.stringify(history));
    emitHistoryUpdate();
  } catch (error) {
    console.warn('[deviceHistory] Failed to persist history', error);
  }
};

export const recordDeviceWorkflowRun = (
  deviceId: string,
  workflowId: string,
  workflowName: string,
  executedAt: string
): void => {
  if (!deviceId) {
    return;
  }
  const history = readHistory();
  const entries = history[deviceId] ? [...history[deviceId]] : [];
  entries.unshift({ workflowId, workflowName, executedAt });
  history[deviceId] = entries.slice(0, 20); // keep last 20 runs
  persistHistory(history);
};

export const getDeviceWorkflowHistory = (deviceId: string): DeviceWorkflowRun[] => {
  if (!deviceId) {
    return [];
  }
  const history = readHistory();
  return history[deviceId] ? [...history[deviceId]] : [];
};

export const getAllDeviceWorkflowHistories = (): DeviceWorkflowHistory => {
  return readHistory();
};

export const clearDeviceWorkflowHistory = (): void => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(DEVICE_HISTORY_STORAGE_KEY);
    emitHistoryUpdate();
  } catch (error) {
    console.warn('[deviceHistory] Failed to clear history', error);
  }
};
