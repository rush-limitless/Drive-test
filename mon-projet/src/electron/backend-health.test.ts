import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'events';
import { buildHealthUrls, checkBackendAlreadyRunning } from './backend-health';

const buildGet = (responses: Array<number | Error>) => {
  return (_url: string, cb: (res: { statusCode?: number; resume: () => void }) => void) => {
    const entry = responses.shift() ?? new Error('missing');
    const req = new EventEmitter() as any;
    req.setTimeout = (_ms: number, _cb: () => void) => req;
    req.destroy = () => undefined;

    if (entry instanceof Error) {
      process.nextTick(() => req.emit('error', entry));
    } else {
      process.nextTick(() => cb({ statusCode: entry, resume: () => undefined }));
    }
    return req;
  };
};

describe('buildHealthUrls', () => {
  it('builds all health urls', () => {
    const urls = buildHealthUrls('127.0.0.1', 8007);
    expect(urls).toHaveLength(3);
    expect(urls[0]).toContain('http://127.0.0.1:8007');
  });
});

describe('checkBackendAlreadyRunning', () => {
  it('returns true on first non-404 response', async () => {
    const result = await checkBackendAlreadyRunning('127.0.0.1', 8007, buildGet([200]));
    expect(result).toBe(true);
  });

  it('skips 404 and succeeds later', async () => {
    const result = await checkBackendAlreadyRunning('127.0.0.1', 8007, buildGet([404, 200]));
    expect(result).toBe(true);
  });

  it('returns false when all endpoints error', async () => {
    const result = await checkBackendAlreadyRunning(
      '127.0.0.1',
      8007,
      buildGet([new Error('fail'), new Error('fail'), new Error('fail')])
    );
    expect(result).toBe(false);
  });
});
