import { Device } from '../types';
import { resolveBaseUrl, fetchWithRetry } from './utils';

const resolveApiKey = (): string | null => {
  // Prefer env (build-time) then localStorage override if set by user/admin
  const envKey =
    (import.meta as any).env?.VITE_API_KEY ||
    (import.meta as any).env?.VITE_REACT_APP_API_KEY ||
    (typeof process !== 'undefined' ? process.env.REACT_APP_API_KEY || process.env.API_KEY : undefined);
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem('API_KEY') : null;
  return (stored && stored.trim()) || (envKey && envKey.trim()) || null;
};

const authHeaders = (): HeadersInit => {
  const key = resolveApiKey();
  return key ? { 'X-API-Key': key } : {};
};

const extractDevices = (payload: unknown): any[] => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    const devices = (payload as { devices?: unknown }).devices;
    if (Array.isArray(devices)) {
      return devices;
    }
  }
  return [];
};

const normalizeStatus = (status: unknown): Device['status'] => {
  if (typeof status !== 'string') {
    return 'disconnected';
  }
  const normalized = status.toLowerCase();
  if (['device', 'online', 'connected'].includes(normalized)) {
    return 'connected';
  }
  if (['busy', 'in_use'].includes(normalized)) {
    return 'busy';
  }
  if (['disconnected', 'offline', 'unauthorized'].includes(normalized)) {
    return 'disconnected';
  }
  return normalized;
};

const normalizeDevices = (payload: unknown): Device[] => {
  return extractDevices(payload).map((device: any) => {
    const rawStatus = typeof device?.status === 'string' ? device.status : undefined;
    const rawAdbStatus = typeof device?.adb_status === 'string' ? device.adb_status : undefined;
    const normalizedStatus = normalizeStatus(rawStatus);
    const normalizedAdbStatus = normalizeStatus(rawAdbStatus);
    const developerModeFlag = device?.developer_mode_enabled;
    const usbDebuggingFlag = device?.usb_debugging_enabled;
    const backendRequiresSetup =
      typeof device?.requires_setup === 'boolean' ? device.requires_setup : undefined;

    let requiresSetup =
      backendRequiresSetup !== undefined
        ? backendRequiresSetup
        : normalizedAdbStatus !== 'connected' ||
          normalizedStatus === 'disconnected' ||
          device?.developer_mode_enabled === false ||
          device?.usb_debugging_enabled === false;

    const statusIndicatesReady = ['connected', 'busy'].includes(normalizedStatus);
    const adbIndicatesReady = normalizedAdbStatus === 'connected' || rawAdbStatus === undefined;

    const shouldAutoApprove =
      statusIndicatesReady &&
      adbIndicatesReady &&
      developerModeFlag !== false &&
      usbDebuggingFlag !== false;

    if (shouldAutoApprove) {
      requiresSetup = false;
    }

    return {
      ...device,
      status: normalizedStatus,
      raw_status: rawStatus,
      raw_adb_status: rawAdbStatus,
      requires_setup: requiresSetup,
    };
  });
};

export const deviceApi = {
  async getDevices(baseUrl?: string, scopeId?: string): Promise<Device[]> {
    try {
      const resolvedBase = resolveBaseUrl(baseUrl);
      const url = new URL(`${resolvedBase}/api/v1/devices/`);
      if (scopeId && scopeId !== 'all') {
        url.searchParams.set('scope', scopeId);
      }
      const response = await fetchWithRetry(url.toString(), { headers: authHeaders() });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const payload = await response.json();
      return normalizeDevices(payload);
    } catch (error) {
      console.error('Error fetching devices:', error);
      // Fallback to legacy endpoint
      try {
        const resolvedBase = resolveBaseUrl(baseUrl);
        const response = await fetchWithRetry(`${resolvedBase}/api/devices/`, { headers: authHeaders() });
        if (response.ok) {
          const payload = await response.json();
          return normalizeDevices(payload);
        }
      } catch (fallbackError) {
        console.error('Fallback API also failed:', fallbackError);
      }
      return [];
    }
  },

  async scanDevices(baseUrl?: string, scopeId?: string): Promise<void> {
    const resolvedBase = resolveBaseUrl(baseUrl);
    const url = new URL(`${resolvedBase}/api/v1/devices/scan`);
    if (scopeId && scopeId !== 'all') {
      url.searchParams.set('scope', scopeId);
    }
    await fetchWithRetry(url.toString(), { method: 'POST', headers: authHeaders() }).catch((error) => {
      console.error('Error scanning devices:', error);
    });
  },

  async refreshDevice(baseUrl: string | undefined, deviceId: string): Promise<void> {
    const resolvedBase = resolveBaseUrl(baseUrl);
    await fetchWithRetry(`${resolvedBase}/api/v1/devices/${deviceId}/refresh`, { method: 'POST', headers: authHeaders() }).catch((error) => {
      console.error('Error refreshing device:', error);
    });
  },

  async captureScreenshot(baseUrl: string | undefined, deviceId: string): Promise<any> {
    try {
      const resolvedBase = resolveBaseUrl(baseUrl);
      const response = await fetchWithRetry(`${resolvedBase}/api/v1/devices/${deviceId}/screenshot`, { method: 'POST', headers: authHeaders() });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      throw error;
    }
  },

  async testDevice(deviceId: string, baseUrl?: string): Promise<{ success: boolean; message: string }> {
    const resolvedBase = resolveBaseUrl(baseUrl);
    const response = await fetchWithRetry(`${resolvedBase}/api/v1/devices/${deviceId}/test`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return await response.json();
  },

  async rebootDevice(deviceId: string, baseUrl?: string): Promise<{ success: boolean; message: string }> {
    const resolvedBase = resolveBaseUrl(baseUrl);
    const response = await fetchWithRetry(`${resolvedBase}/api/v1/devices/${deviceId}/reboot`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return await response.json();
  },

  async disconnectDevice(deviceId: string, baseUrl?: string): Promise<{ success: boolean; message: string }> {
    const resolvedBase = resolveBaseUrl(baseUrl);
    const response = await fetchWithRetry(`${resolvedBase}/api/v1/devices/${deviceId}/disconnect`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return await response.json();
  },

  async configureDevice(deviceId: string, baseUrl?: string): Promise<any> {
    const resolvedBase = resolveBaseUrl(baseUrl);
    const response = await fetchWithRetry(`${resolvedBase}/api/v1/devices/${deviceId}/setup`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }
    return response.json();
  },

  async downloadDeviceReport(
    deviceId: string,
    opts: { from?: string; to?: string; baseUrl?: string }
  ): Promise<string> {
    const resolvedBase = resolveBaseUrl(opts.baseUrl);
    const url = new URL(`${resolvedBase}/api/v1/devices/${deviceId}/report`);
    if (opts.from) {
      url.searchParams.set('from_ts', opts.from);
    }
    if (opts.to) {
      url.searchParams.set('to_ts', opts.to);
    }
    const response = await fetchWithRetry(url.toString(), { headers: authHeaders() });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
    const filename = match?.[1] || `device-report-${deviceId}.pdf`;
    const link = document.createElement('a');
    const objectUrl = window.URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(objectUrl);
    return filename;
  }
};

