import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithRetry, resolveBaseUrl } from './utils';

describe('resolveBaseUrl', () => {
  it('returns default when empty', () => {
    expect(resolveBaseUrl()).toBe('http://127.0.0.1:8007');
    expect(resolveBaseUrl('')).toBe('http://127.0.0.1:8007');
    expect(resolveBaseUrl('   ')).toBe('http://127.0.0.1:8007');
  });

  it('trims and removes trailing slash', () => {
    expect(resolveBaseUrl(' http://localhost:8000/ ')).toBe('http://localhost:8000');
  });
});

describe('fetchWithRetry', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries on retryable status codes', async () => {
    const retryResponse = { ok: false, status: 503 } as Response;
    const okResponse = { ok: true, status: 200 } as Response;

    fetchMock.mockResolvedValueOnce(retryResponse).mockResolvedValueOnce(okResponse);

    const promise = fetchWithRetry('https://example.test');
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response).toBe(okResponse);
  });

  it('retries on network errors then succeeds', async () => {
    const okResponse = { ok: true, status: 200 } as Response;

    fetchMock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(okResponse);

    const promise = fetchWithRetry('https://example.test', undefined, { retries: 1 });
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response).toBe(okResponse);
  });

  it('fails after exhausting retries', async () => {
    fetchMock.mockRejectedValue(new Error('network'));

    const promise = fetchWithRetry('https://example.test', undefined, { retries: 1 });
    const assertion = expect(promise).rejects.toThrow('network');
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
