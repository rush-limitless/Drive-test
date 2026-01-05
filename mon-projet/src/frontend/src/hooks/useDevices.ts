import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deviceApi } from '../services/deviceApi';
import { Device } from '@types';
import { readDeviceCache, writeDeviceCache } from '../utils/deviceCache';
import { resolveBaseUrl } from '../services/utils';
import { webSocketService } from '../services/websocket';
import type { DeviceStatusUpdate } from '../services/websocket';

type Status = 'idle' | 'loading' | 'success' | 'error';

export interface UseDevicesOptions {
  backendUrl?: string;
  scopeId?: string;
  pollMs?: number;
  autoRefresh?: boolean;
}

export interface UseDevicesResult {
  devices: Device[];
  status: Status;
  error: Error | null;
  refresh: () => Promise<void>;
  isEmpty: boolean;
  lastUpdated: number | null;
  applyDevicePatch: (deviceId: string, patch: Partial<Device>) => void;
}

export const useDevices = (options: UseDevicesOptions = {}): UseDevicesResult => {
  const { backendUrl, scopeId, pollMs = 15000, autoRefresh = true } = options;

  const initialCache = useMemo(() => readDeviceCache(scopeId), [scopeId]);
  const [devices, setDevicesState] = useState<Device[]>(initialCache?.devices ?? []);
  const [status, setStatus] = useState<Status>(initialCache ? 'success' : 'idle');
  const [lastUpdated, setLastUpdated] = useState<number | null>(initialCache?.timestamp ?? null);
  const [error, setError] = useState<Error | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const devicesRef = useRef<Device[]>(initialCache?.devices ?? []);
  const backendRef = useRef<string | null>(null);

  const setDevices = useCallback((updater: (prev: Device[]) => Device[]) => {
    setDevicesState((prev) => {
      const next = updater(prev);
      devicesRef.current = next;
      return next;
    });
  }, []);

  const fetchDevices = useCallback(async (opts?: { showLoader?: boolean }) => {
    const showLoader = opts?.showLoader ?? devicesRef.current.length === 0;
    try {
      if (showLoader) {
        setStatus('loading');
      }
      const result = await deviceApi.getDevices(backendUrl, scopeId);
      setDevices(() => result);
      setStatus('success');
      setError(null);
      setLastUpdated(Date.now());
      writeDeviceCache(scopeId, result);
    } catch (err) {
      const typed = err instanceof Error ? err : new Error('Failed to load devices');
      setError(typed);
      if (devicesRef.current.length === 0) {
        setStatus('error');
      } else {
        setStatus('success');
      }
    }
  }, [backendUrl, scopeId]);

  const applyDevicePatch = useCallback(
    (deviceId: string, patch: Partial<Device>) => {
      if (!deviceId) {
        return;
      }
      setDevices((prev) => {
        let found = false;
        const next = prev.map((device) => {
          if (device.id === deviceId) {
            found = true;
            return { ...device, ...patch };
          }
          return device;
        });
        if (!found) {
          next.push({
            id: deviceId,
            model: patch.model || 'Unknown device',
            ...patch,
          } as Device);
        }
        return next;
      });
    },
    [setDevices]
  );

  useEffect(() => {
    fetchDevices({ showLoader: devicesRef.current.length === 0 });

    if (!autoRefresh || pollMs <= 0) {
      return undefined;
    }

    pollRef.current = setInterval(fetchDevices, pollMs);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [fetchDevices, autoRefresh, pollMs]);

  useEffect(() => {
    if (!backendUrl) {
      backendRef.current = null;
      return;
    }

    const resolved = resolveBaseUrl(backendUrl);
    backendRef.current = resolved;
    webSocketService.acquireDevicesConnection(resolved);

    const unsubscribe = webSocketService.subscribeToDeviceUpdates((update: DeviceStatusUpdate) => {
      applyDevicePatch(update.device_id, {
        status: update.status,
        last_seen: update.last_seen ?? update.timestamp,
      });
    });

    return () => {
      unsubscribe();
      webSocketService.releaseDevicesConnection();
    };
  }, [backendUrl, applyDevicePatch]);

  const memoisedDevices = useMemo(() => devices, [devices]);

  return {
    devices: memoisedDevices,
    status,
    error,
    refresh: () => fetchDevices({ showLoader: true }),
    isEmpty: memoisedDevices.length === 0,
    lastUpdated,
    applyDevicePatch,
  };
};
