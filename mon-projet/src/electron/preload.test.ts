import { beforeEach, describe, expect, it, vi } from 'vitest';

const exposeInMainWorld = vi.fn();
const invoke = vi.fn();
const send = vi.fn();

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke, send },
}));

describe('preload', () => {
  beforeEach(() => {
    exposeInMainWorld.mockClear();
    invoke.mockClear();
    send.mockClear();
    vi.resetModules();
  });

  it('exposes the expected API', async () => {
    await import('./preload');

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
    const [_key, api] = exposeInMainWorld.mock.calls[0];

    expect(typeof api.getBackendUrl).toBe('function');
    expect(typeof api.getAppVersion).toBe('function');
    expect(typeof api.restartBackend).toBe('function');
    expect(typeof api.trackEvent).toBe('function');
  });

  it('forwards telemetry events', async () => {
    await import('./preload');
    const [_key, api] = exposeInMainWorld.mock.calls[0];

    api.trackEvent('session-start', { ok: true });

    expect(send).toHaveBeenCalledWith('telemetry-event', {
      name: 'session-start',
      payload: { ok: true },
    });
  });
});
