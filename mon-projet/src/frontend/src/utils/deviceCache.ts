import { Device } from '@types';

type CacheStore = Record<
  string,
  {
    devices: Device[];
    timestamp: number;
  }
>;

const CACHE_KEY = 'devices-cache';
const DEFAULT_SCOPE = '__default__';

const safeParse = (value: string | null): CacheStore => {
  if (!value) {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      return parsed as CacheStore;
    }
  } catch (error) {
    console.warn('[deviceCache] Failed to parse cache', error);
  }
  return {};
};

const writeStore = (store: CacheStore) => {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch (error) {
    console.warn('[deviceCache] Failed to persist cache', error);
  }
};

const getScopeKey = (scopeId?: string) => scopeId ?? DEFAULT_SCOPE;

export const readDeviceCache = (scopeId?: string): { devices: Device[]; timestamp: number } | null => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return null;
  }
  const store = safeParse(window.localStorage.getItem(CACHE_KEY));
  const scoped = store[getScopeKey(scopeId)];
  if (!scoped) {
    return null;
  }
  return {
    devices: Array.isArray(scoped.devices) ? scoped.devices : [],
    timestamp: typeof scoped.timestamp === 'number' ? scoped.timestamp : Date.now(),
  };
};

export const writeDeviceCache = (scopeId: string | undefined, devices: Device[]) => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  const store = safeParse(window.localStorage.getItem(CACHE_KEY));
  store[getScopeKey(scopeId)] = {
    devices,
    timestamp: Date.now(),
  };
  writeStore(store);
};

export const clearDeviceCache = (scopeId?: string) => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  const store = safeParse(window.localStorage.getItem(CACHE_KEY));
  const key = getScopeKey(scopeId);
  if (store[key]) {
    delete store[key];
    writeStore(store);
  }
};
