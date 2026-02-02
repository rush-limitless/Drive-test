/**
 * Simplified Electron main process.
 */

import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';

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
    // Ignore rotation errors.
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
    // Ignore file logging errors.
  }
};

const safeLog = (level: LogLevel, message: string, meta?: unknown): void => {
  if (meta !== undefined) {
    const method = level === 'debug' ? 'log' : level;
    console[method](message, meta);
  } else {
    const method = level === 'debug' ? 'log' : level;
    console[method](message);
  }
  writeLog(level, message, meta);
};

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

function resolveBackendExecutable(): { executable: string; args: string[]; cwd: string; env?: any } {
  if (app.isPackaged) {
    const backendDir = path.join(process.resourcesPath, 'backend', 'server');
    return {
      executable: path.join(backendDir, 'TelcoADBServer.exe'),
      args: [],
      cwd: backendDir,
    };
  }

  const projectRoot = path.join(__dirname, '..', '..', '..');
  const scriptPath = path.join(projectRoot, 'simple-server.py');
  return {
    executable: 'python',
    args: [scriptPath],
    cwd: projectRoot,
    env: {
      ...process.env,
      PYTHONPATH: `${projectRoot}\\src;${projectRoot}\\src\\backend`,
    },
  };
}

let mainWindow: BrowserWindow;
let backendProcess: ChildProcess | null = null;

const isDev = process.env.NODE_ENV === 'development';
const BACKEND_PORT = 8007;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    height: 900,
    width: 1400,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'ADB Framework Telco Automation',
    icon: path.join(__dirname, 'icon.ico'),
    show: true,
    autoHideMenuBar: false
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    const rendererEntry = app.isPackaged
      ? path.join(process.resourcesPath, 'frontend', 'build', 'index.html')
      : path.resolve(__dirname, '..', '..', 'frontend', 'build', 'index.html');
    
    if (fs.existsSync(rendererEntry)) {
      mainWindow.loadFile(rendererEntry);
    } else {
      safeLog('error', 'Frontend not found at:', rendererEntry);
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null as any;
  });
}

function startBackendServer(): Promise<void> {
  return new Promise((resolve) => {
    const backend = resolveBackendExecutable();

    safeLog('info', 'Starting backend:', backend.executable);

    backendProcess = spawn(backend.executable, backend.args, {
      cwd: backend.cwd,
      env: backend.env || process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    backendProcess.stdout?.on('data', (data) => {
      safeLog('info', `Backend: ${data}`);
    });

    backendProcess.stderr?.on('data', (data) => {
      safeLog('error', `Backend Error: ${data}`);
    });

    backendProcess.on('error', (error) => {
      safeLog('error', 'Backend error:', error);
    });

    // Wait 3 seconds then resolve
    setTimeout(resolve, 3000);
  });
}

function stopBackendServer(): void {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
    backendProcess = null;
  }
}

app.whenReady().then(async () => {
  try {
    writeLog('info', '[electron] Logging initialized', { file: MAIN_LOG_FILE });
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
ipcMain.handle('get-backend-url', () => `http://127.0.0.1:${BACKEND_PORT}`);
ipcMain.handle('get-app-version', () => app.getVersion());
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

    safeLog('info', '[electron] Logs exported', { exportDir, electronFiles, backendFiles });
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

    safeLog('info', '[electron] Bug report created', { reportDir, electronFiles, backendFiles });
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
