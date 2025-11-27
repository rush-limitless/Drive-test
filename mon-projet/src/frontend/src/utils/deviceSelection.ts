export const SELECTED_DEVICES_STORAGE_KEY = 'selectedDeviceIds';
const LEGACY_SELECTED_DEVICE_KEY = 'selectedDeviceId';
export const SELECTED_DEVICES_EVENT = 'selected-devices:updated';

const normalizeIds = (value: unknown): string[] => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return normalizeIds(parsed);
      }
    } catch {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return [trimmed];
      }
    }
  }
  return [];
};

export const readSelectedDeviceIds = (): string[] => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return [];
  }
  try {
    const stored = window.localStorage.getItem(SELECTED_DEVICES_STORAGE_KEY);
    const ids = normalizeIds(stored);
    if (ids.length > 0) {
      return Array.from(new Set(ids));
    }
    const legacy = window.localStorage.getItem(LEGACY_SELECTED_DEVICE_KEY);
    const legacyIds = normalizeIds(legacy);
    if (legacyIds.length > 0) {
      writeSelectedDeviceIds(legacyIds);
      window.localStorage.removeItem(LEGACY_SELECTED_DEVICE_KEY);
      return legacyIds;
    }
  } catch (error) {
    console.warn('[deviceSelection] Failed to read selected devices', error);
  }
  return [];
};

export const writeSelectedDeviceIds = (ids: string[]) => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    const uniqueIds = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.trim().length > 0)));
    window.localStorage.setItem(SELECTED_DEVICES_STORAGE_KEY, JSON.stringify(uniqueIds));
    window.dispatchEvent(new CustomEvent(SELECTED_DEVICES_EVENT, { detail: uniqueIds }));
  } catch (error) {
    console.warn('[deviceSelection] Failed to persist selected devices', error);
  }
};

export const clearSelectedDeviceIds = () => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(SELECTED_DEVICES_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(SELECTED_DEVICES_EVENT, { detail: [] }));
  } catch (error) {
    console.warn('[deviceSelection] Failed to clear selected devices', error);
  }
};

export const toggleSelectedDeviceId = (ids: string[], deviceId: string): string[] => {
  const set = new Set(ids);
  if (set.has(deviceId)) {
    set.delete(deviceId);
  } else {
    set.add(deviceId);
  }
  return Array.from(set);
};
