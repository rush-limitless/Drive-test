import { describe, expect, it } from 'vitest';
import { resolveBackendExecutable } from './backend-utils';
import * as path from 'path';

describe('resolveBackendExecutable', () => {
  it('builds dev backend command', () => {
    const projectRoot = path.join('C:', 'repo', 'mobiq');
    const result = resolveBackendExecutable({
      isPackaged: false,
      resourcesPath: path.join('C:', 'resources'),
      projectRoot,
      env: { PATH: 'C:\\bin' },
      port: 8007,
      host: '127.0.0.1',
    });

    expect(result.executable).toBe('python');
    expect(result.args[0]).toContain('simple-server.py');
    expect(result.cwd).toBe(projectRoot);
    expect(result.env?.TELCO_SIMPLE_PORT).toBe('8007');
    expect(result.env?.TELCO_SIMPLE_HOST).toBe('127.0.0.1');
    expect(result.env?.PYTHONPATH).toContain(`${projectRoot}\\src`);
    expect(result.env?.PATH).toContain('platform-tools');
  });

  it('builds packaged backend command', () => {
    const resourcesPath = path.join('C:', 'resources');
    const result = resolveBackendExecutable({
      isPackaged: true,
      resourcesPath,
      projectRoot: path.join('C:', 'repo', 'mobiq'),
      env: { PATH: 'C:\\bin' },
      port: 9000,
      host: '0.0.0.0',
    });

    expect(result.executable).toContain(path.join('backend', 'server', 'TelcoADBServer.exe'));
    expect(result.cwd).toContain(path.join('backend', 'server'));
    expect(result.env?.TELCO_SIMPLE_PORT).toBe('9000');
    expect(result.env?.TELCO_SIMPLE_HOST).toBe('0.0.0.0');
    expect(result.env?.PATH).toContain(path.join('backend', 'server', '_internal', 'platform-tools'));
  });
});
