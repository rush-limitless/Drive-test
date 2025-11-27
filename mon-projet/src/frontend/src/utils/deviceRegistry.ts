import { Device } from '@types';

export interface DeviceRegistryEntry {
  id: string;
  model?: string;
  connectionType?: string;
  lastStatus?: string;
  firstSeen: string;
  lastSeen: string;
}

export type DeviceRegistryMap = Record<string, DeviceRegistryEntry>;

export const DEVICE_REGISTRY_STORAGE_KEY = 'deviceRegistry';
export const DEVICE_REGISTRY_EVENT = 'deviceRegistry:updated';

const emitRegistryUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DEVICE_REGISTRY_EVENT));
  }
};

const readRegistryInternal = (): DeviceRegistryMap => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(DEVICE_REGISTRY_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as DeviceRegistryMap;
    }
  } catch (error) {
    console.warn('[deviceRegistry] Failed to read registry', error);
  }
  return {};
};

const persistRegistry = (registry: DeviceRegistryMap) => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(DEVICE_REGISTRY_STORAGE_KEY, JSON.stringify(registry));
    emitRegistryUpdate();
  } catch (error) {
    console.warn('[deviceRegistry] Failed to persist registry', error);
  }
};

export const readDeviceRegistry = (): DeviceRegistryMap => {
  return readRegistryInternal();
};

const entriesEqual = (a: DeviceRegistryEntry, b: DeviceRegistryEntry): boolean => {
  return (
    a.model === b.model &&
    a.connectionType === b.connectionType &&
    a.lastStatus === b.lastStatus &&
    a.firstSeen === b.firstSeen &&
    a.lastSeen === b.lastSeen
  );
};

export const syncDevicesToRegistry = (devices: Device[]): void => {
  if (!devices || devices.length === 0) {
    return;
  }
  const registry = readRegistryInternal();
  let changed = false;
  const now = new Date().toISOString();

  devices.forEach((device) => {
    if (!device?.id) {
      return;
    }
    const existing = registry[device.id];
    const entry: DeviceRegistryEntry = {
      id: device.id,
      model: device.model || existing?.model,
      connectionType: device.connection_type || existing?.connectionType,
      lastStatus: device.status || existing?.lastStatus,
      firstSeen: existing?.firstSeen ?? now,
      lastSeen: now,
    };
    if (!existing || !entriesEqual(existing, entry)) {
      registry[device.id] = entry;
      changed = true;
    }
  });

  if (changed) {
    persistRegistry(registry);
  }
};
