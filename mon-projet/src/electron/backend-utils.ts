import * as path from 'path';

export type BackendExecutable = {
  executable: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
};

export type BackendRuntimeOptions = {
  isPackaged: boolean;
  resourcesPath: string;
  projectRoot: string;
  env?: NodeJS.ProcessEnv;
  port: number;
  host: string;
};

export const resolveBackendExecutable = (options: BackendRuntimeOptions): BackendExecutable => {
  const baseEnv = options.env ?? {};
  const sharedEnv: NodeJS.ProcessEnv = {
    ...baseEnv,
    TELCO_SIMPLE_PORT: String(options.port),
    TELCO_SIMPLE_HOST: options.host,
    LOG_LEVEL: baseEnv.LOG_LEVEL || 'DEBUG',
  };

  if (options.isPackaged) {
    const backendDir = path.join(options.resourcesPath, 'backend', 'server');
    const platformToolsDir = path.join(backendDir, '_internal', 'platform-tools');
    const packagedAdbDir = path.join(options.resourcesPath, 'adb');
    const mergedPath = [platformToolsDir, packagedAdbDir, sharedEnv.PATH || baseEnv.PATH || '']
      .filter(Boolean)
      .join(path.delimiter);
    return {
      executable: path.join(backendDir, 'TelcoADBServer.exe'),
      args: [],
      cwd: backendDir,
      env: {
        ...sharedEnv,
        PATH: mergedPath,
      },
    };
  }

  const devPlatformTools = path.join(options.projectRoot, 'platform-tools');
  const devEmbeddedAdb = path.join(options.projectRoot, 'src', 'electron', 'resources', 'adb');
  const mergedDevPath = [devPlatformTools, devEmbeddedAdb, sharedEnv.PATH || baseEnv.PATH || '']
    .filter(Boolean)
    .join(path.delimiter);
  const scriptPath = path.join(options.projectRoot, 'simple-server.py');
  return {
    executable: 'python',
    args: [scriptPath],
    cwd: options.projectRoot,
    env: {
      ...sharedEnv,
      PYTHONPATH: `${options.projectRoot}\\src;${options.projectRoot}\\src\\backend`,
      PATH: mergedDevPath,
    },
  };
};
