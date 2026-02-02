/**
 * Electron main process with backend integration.
 */

import { app, BrowserWindow, BrowserWindowConstructorOptions, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import { checkBackendAlreadyRunning } from './backend-health';
import { resolveBackendExecutable } from './backend-utils';

const parsedPort = Number(process.env.TELCO_SIMPLE_PORT);
const BACKEND_PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 8007;
const BACKEND_HOST = process.env.TELCO_SIMPLE_HOST || '127.0.0.1';
const RENDER_HOST = BACKEND_HOST === '0.0.0.0' ? '127.0.0.1' : BACKEND_HOST;

const customUserData = path.join(app.getPath('userData'), 'mobiq-dev');
const customCache = path.join(customUserData, 'cache');
const customTemp = path.join(customUserData, 'temp');
for (const dir of [customUserData, customCache, customTemp]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
app.setPath('userData', customUserData);
app.setPath('cache', customCache);
app.setPath('temp', customTemp);
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const LOG_DIR = path.join(app.getPath('userData'), 'logs');
const MAIN_LOG_FILE = path.join(LOG_DIR, 'electron-main.log');
const MAX_LOG_BYTES = 5 * 1024 * 1024;

const ensureLogDir = (): void => {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
};

const serializeMeta = (meta: unknown): string => {
  if (meta instanceof Error) {
    return meta.stack || meta.message;
  }
  if (typeof meta === 'string') {
    return meta;
  }
  try {
    return JSON.stringify(meta);
  } catch {
    return String(meta);
  }
};

const rotateLogIfNeeded = (): void => {
  if (!fs.existsSync(MAIN_LOG_FILE)) {
    return;
  }
  try {
    const stats = fs.statSync(MAIN_LOG_FILE);
    if (stats.size < MAX_LOG_BYTES) {
      return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotated = MAIN_LOG_FILE.replace('.log', `-${stamp}.log`);
    fs.renameSync(MAIN_LOG_FILE, rotated);
  } catch {
    // Ignore rotation errors to avoid breaking startup.
  }
};

const writeLog = (level: LogLevel, message: string, meta?: unknown): void => {
  try {
    ensureLogDir();
    rotateLogIfNeeded();
    const ts = new Date().toISOString();
    const metaText = meta === undefined ? '' : ` | ${serializeMeta(meta)}`;
    const line = `${ts} [${level}] ${message}${metaText}\n`;
    fs.appendFileSync(MAIN_LOG_FILE, line, { encoding: 'utf-8' });
  } catch {
    // Intentionally ignore file logging errors.
  }
};

let mainWindow: BrowserWindow;
let backendProcess: ChildProcess | null = null;
let backendManagedExternally = false;

const isDev = process.env.NODE_ENV === 'development';

const safeLog = (level: 'log' | 'warn' | 'error', message: string, meta?: unknown): void => {
  try {
    if (meta !== undefined) {
      console[level](message, meta);
    } else {
      console[level](message);
    }
    const fileLevel: LogLevel = level === 'log' ? 'info' : level;
    writeLog(fileLevel, message, meta);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    const code = err?.code;
    const messageText = err?.message || '';
    if (code !== 'EPIPE' && !messageText.includes('EPIPE')) {
      throw error;
    }
  }
};

const guardStdIo = (): void => {
  const guard = (stream?: NodeJS.WriteStream) => {
    if (!stream) {
      return;
    }
    stream.on('error', (error: NodeJS.ErrnoException) => {
      const messageText = error?.message || '';
      if (error?.code === 'EPIPE' || messageText.includes('EPIPE')) {
        return;
      }
      throw error;
    });
  };
  guard(process.stdout);
  guard(process.stderr);
};

guardStdIo();
writeLog('info', '[electron] Logging initialized', { file: MAIN_LOG_FILE });

const resolveBackendLogsDir = (): string => {
  if (app.isPackaged) {
    const baseDir = process.env.LOCALAPPDATA || process.env.APPDATA || app.getPath('home');
    return path.join(baseDir, 'TelcoADB', 'artifacts', 'logs');
  }
  const projectRoot = path.join(__dirname, '..', '..', '..');
  return path.join(projectRoot, 'artifacts', 'logs');
};

const buildReportText = (payload: Record<string, unknown>): string => {
  const lines: string[] = [];
  const push = (label: string, value: unknown) => {
    if (value === undefined || value === null) {
      return;
    }
    lines.push(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
  };

  push('timestamp', new Date().toISOString());
  push('app_version', app.getVersion());
  push('platform', process.platform);
  push('arch', process.arch);
  push('electron', process.versions.electron);
  push('node', process.versions.node);
  push('is_packaged', app.isPackaged);
  push('user_data', app.getPath('userData'));
  push('route', payload.route);
  push('backend_url', payload.backendUrl);
  push('selected_devices', payload.selectedDeviceIds);
  push('workflow_id', payload.workflowId);
  push('notes', payload.notes);

  return `${lines.join('\n')}\n`;
};

const copyLogDirectory = (sourceDir: string, targetDir: string): string[] => {
  if (!fs.existsSync(sourceDir)) {
    return [];
  }
  fs.mkdirSync(targetDir, { recursive: true });
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  const copied: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const from = path.join(sourceDir, entry.name);
    const to = path.join(targetDir, entry.name);
    fs.copyFileSync(from, to);
    copied.push(entry.name);
  }
  return copied;
};

process.on('uncaughtException', (error) => {
  safeLog('error', '[electron] Uncaught exception', error);
});

process.on('unhandledRejection', (reason) => {
  safeLog('error', '[electron] Unhandled rejection', reason);
});

function createWindow(): void {
  const windowOptions: BrowserWindowConstructorOptions = {
    height: 900,
    width: 1400,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'MOBIQ',
    show: true,
    autoHideMenuBar: false
  };

  const candidateIcon = path.join(__dirname, 'icon.png');
  if (fs.existsSync(candidateIcon)) {
    windowOptions.icon = candidateIcon;
  }

  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    safeLog('log', `[renderer][level=${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    safeLog('error', `[electron] Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    safeLog('log', '[electron] Renderer finished loading');
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    safeLog('error', '[electron] Renderer process gone:', details);
  });

  mainWindow.webContents.on('unresponsive', () => {
    safeLog('error', '[electron] Renderer became unresponsive');
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    const rendererEntry = app.isPackaged
      ? path.join(process.resourcesPath, 'frontend', 'build', 'index.html')
      : path.resolve(__dirname, '..', '..', 'frontend', 'build', 'index.html');
    if (!fs.existsSync(rendererEntry)) {
      safeLog('error', `[electron] Renderer entry not found at ${rendererEntry}`);
    }
    mainWindow.loadFile(rendererEntry);
  }

  mainWindow.on('closed', () => {
    mainWindow = null as any;
  });
}

function startBackendServer(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    let resolved = false;
    let healthInterval: NodeJS.Timeout | null = null;
    let readyTimeout: NodeJS.Timeout | null = null;

    const markReady = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      if (healthInterval) {
        clearInterval(healthInterval);
        healthInterval = null;
      }
      if (readyTimeout) {
        clearTimeout(readyTimeout);
        readyTimeout = null;
      }
      resolve();
    };

    if (process.env.SKIP_BACKEND && process.env.SKIP_BACKEND !== '0' && process.env.SKIP_BACKEND.toLowerCase() !== 'false') {
      backendManagedExternally = true;
      safeLog('log', `[electron] SKIP_BACKEND set. Assuming backend already running at http://${RENDER_HOST}:${BACKEND_PORT}`);
      markReady();
      return;
    }

    const alreadyRunning = await checkBackendAlreadyRunning(RENDER_HOST, BACKEND_PORT);
    if (alreadyRunning) {
      backendManagedExternally = true;
      safeLog('log', `[electron] Backend already running at http://${RENDER_HOST}:${BACKEND_PORT}, skipping spawn.`);
      markReady();
      return;
    }

    const projectRoot = path.join(__dirname, '..', '..', '..');
    const backend = resolveBackendExecutable({
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      projectRoot,
      env: process.env,
      port: BACKEND_PORT,
      host: BACKEND_HOST,
    });

    if (!fs.existsSync(backend.cwd)) {
      safeLog('error', 'Backend path not found:', backend.cwd);
      reject(new Error(`Backend path not found: ${backend.cwd}`));
      return;
    }

    safeLog('log', `[electron] Starting backend: ${backend.executable} ${backend.args.join(' ')} cwd: ${backend.cwd}`);

    backendProcess = spawn(backend.executable, backend.args, {
      cwd: backend.cwd,
      env: backend.env || process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    backendManagedExternally = false;
    const readyPattern = /Uvicorn running|Application startup complete/i;

    backendProcess.stdout?.on('data', (data) => {
      const text = data.toString();
      safeLog('log', `Backend: ${text}`);
      if (readyPattern.test(text)) {
        markReady();
      }
    });

    backendProcess.stderr?.on('data', (data) => {
      const text = data.toString();
      safeLog('error', `Backend Error: ${text}`);
      if (readyPattern.test(text)) {
        markReady();
      }
    });

    backendProcess.on('error', (error) => {
      safeLog('error', 'Failed to start backend:', error);
      reject(error);
    });

    backendProcess.on('close', (code) => {
      safeLog('log', `Backend process exited with code ${code}`);
      backendProcess = null;
    });

    healthInterval = setInterval(async () => {
      try {
        const healthy = await checkBackendAlreadyRunning(RENDER_HOST, BACKEND_PORT);
        if (healthy) {
          markReady();
        }
      } catch {
        // Ignore errors while the backend is still starting.
      }
    }, 1000);

    readyTimeout = setTimeout(() => {
      safeLog('warn', '[electron] Backend readiness timeout reached; continuing startup.');
      markReady();
    }, 15000);
  });
}

function stopBackendServer(): void {
  if (backendManagedExternally) {
    return;
  }
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
    backendProcess = null;
  }
}

app.whenReady().then(async () => {
  try {
    if (!isDev) {
      await startBackendServer();
    }
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    safeLog('error', 'Failed to start application:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopBackendServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackendServer();
});

// IPC handlers
ipcMain.handle('get-backend-url', () => `http://${RENDER_HOST}:${BACKEND_PORT}`);
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('restart-backend', async () => {
  stopBackendServer();
  if (!isDev) {
    await startBackendServer();
  }
  return true;
});

ipcMain.on('telemetry-event', (_event, data: { name?: string; payload?: Record<string, unknown> }) => {
  const name = data?.name ?? 'unknown';
  const payload = data?.payload ?? {};
  safeLog('log', `[telemetry] ${name}`, payload);
});

ipcMain.on('renderer-log', (_event, payload: { level?: string; message?: string; meta?: unknown }) => {
  const level = payload?.level === 'error' || payload?.level === 'warn' || payload?.level === 'debug'
    ? payload.level
    : 'info';
  const message = payload?.message ? `[renderer] ${payload.message}` : '[renderer] log';
  writeLog(level as LogLevel, message, payload?.meta);
});

ipcMain.handle('export-logs', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Export Logs',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, cancelled: true };
    }

    const baseDir = result.filePaths[0];
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportDir = path.join(baseDir, `mobiq-logs-${stamp}`);
    fs.mkdirSync(exportDir, { recursive: true });

    const electronTarget = path.join(exportDir, 'electron');
    const backendTarget = path.join(exportDir, 'backend');

    const electronFiles = copyLogDirectory(LOG_DIR, electronTarget);
    const backendFiles = copyLogDirectory(resolveBackendLogsDir(), backendTarget);

    safeLog('log', '[electron] Logs exported', { exportDir, electronFiles, backendFiles });
    return {
      success: true,
      path: exportDir,
      counts: { electron: electronFiles.length, backend: backendFiles.length },
    };
  } catch (error) {
    safeLog('error', '[electron] Failed to export logs', error);
    return { success: false, error: (error as Error).message || 'Failed to export logs' };
  }
});

ipcMain.handle('create-bug-report', async (_event, payload: { notes?: string; route?: string; selectedDeviceIds?: string[]; workflowId?: string; backendUrl?: string }) => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Create Bug Report',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, cancelled: true };
    }

    const baseDir = result.filePaths[0];
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportDir = path.join(baseDir, `mobiq-bugreport-${stamp}`);
    fs.mkdirSync(reportDir, { recursive: true });

    const reportText = buildReportText(payload || {});
    fs.writeFileSync(path.join(reportDir, 'report.txt'), reportText, { encoding: 'utf-8' });
    fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify(payload || {}, null, 2), { encoding: 'utf-8' });

    const electronTarget = path.join(reportDir, 'electron');
    const backendTarget = path.join(reportDir, 'backend');

    const electronFiles = copyLogDirectory(LOG_DIR, electronTarget);
    const backendFiles = copyLogDirectory(resolveBackendLogsDir(), backendTarget);

    safeLog('log', '[electron] Bug report created', { reportDir, electronFiles, backendFiles });
    return {
      success: true,
      path: reportDir,
      counts: { electron: electronFiles.length, backend: backendFiles.length },
    };
  } catch (error) {
    safeLog('error', '[electron] Failed to create bug report', error);
    return { success: false, error: (error as Error).message || 'Failed to create bug report' };
  }
});

ipcMain.handle('open-path', async (_event, targetPath: string) => {
  if (!targetPath || typeof targetPath !== 'string') {
    return { success: false, error: 'No path provided.' };
  }
  try {
    const result = await shell.openPath(targetPath);
    if (result) {
      return { success: false, error: result };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message || 'Failed to open path.' };
  }
});
