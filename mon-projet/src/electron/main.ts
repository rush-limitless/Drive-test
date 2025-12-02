/**
 * Electron main process with backend integration.
 */

import { app, BrowserWindow, BrowserWindowConstructorOptions, ipcMain } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';

const parsedPort = Number(process.env.TELCO_SIMPLE_PORT);
const BACKEND_PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 8007;
const BACKEND_HOST = process.env.TELCO_SIMPLE_HOST || '127.0.0.1';
const RENDER_HOST = BACKEND_HOST === '0.0.0.0' ? '127.0.0.1' : BACKEND_HOST;

const customUserData = path.join(app.getPath('userData'), 'mobiq-dev');
if (!fs.existsSync(customUserData)) {
  fs.mkdirSync(customUserData, { recursive: true });
}
app.setPath('userData', customUserData);

function resolveBackendExecutable(): { executable: string; args: string[]; cwd: string; env?: any } {
  const sharedEnv = {
    ...process.env,
    TELCO_SIMPLE_PORT: String(BACKEND_PORT),
    TELCO_SIMPLE_HOST: BACKEND_HOST,
    LOG_LEVEL: process.env.LOG_LEVEL || 'DEBUG',
  };

  if (app.isPackaged) {
    // backend packagé (PyInstaller) copié dans resources/backend/server
    const backendDir = path.join(process.resourcesPath, 'backend', 'server');
    return {
      executable: path.join(backendDir, 'TelcoADBServer.exe'),
      args: [],
      cwd: backendDir,
      env: sharedEnv,
    };
  }

  // Mode développement : lancer simple-server.py via python local
  const projectRoot = path.join(__dirname, '..', '..', '..');
  const scriptPath = path.join(projectRoot, 'simple-server.py');
  return {
    executable: 'python',
    args: [scriptPath],
    cwd: projectRoot,
    env: {
      ...sharedEnv,
      PYTHONPATH: `${projectRoot}\\src;${projectRoot}\\src\\backend`,
    },
  };
}



let mainWindow: BrowserWindow;
let backendProcess: ChildProcess | null = null;
let backendManagedExternally = false;

const isDev = process.env.NODE_ENV === 'development';

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
    console.log(`[renderer][level=${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[electron] Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[electron] Renderer finished loading');
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[electron] Renderer process gone:', details);
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.error('[electron] Renderer became unresponsive');
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    const rendererEntry = app.isPackaged
      ? path.join(process.resourcesPath, 'frontend', 'build', 'index.html')
      : path.resolve(__dirname, '..', '..', 'frontend', 'build', 'index.html');
    if (!fs.existsSync(rendererEntry)) {
      console.error(`[electron] Renderer entry not found at ${rendererEntry}`);
    }
    mainWindow.loadFile(rendererEntry);
  }

  mainWindow.on('closed', () => {
    mainWindow = null as any;
  });
}

function checkBackendAlreadyRunning(): Promise<boolean> {
  const healthEndpoints = [
    `/api/v1/health/adb`,
    `/api/health/adb`,
    `/health`,
  ].map((suffix) => `http://${RENDER_HOST}:${BACKEND_PORT}${suffix}`);

  return new Promise((resolve) => {
    const tryEndpoint = (index: number) => {
      if (index >= healthEndpoints.length) {
        resolve(false);
        return;
      }
      const url = healthEndpoints[index];
      const req = http.get(url, (res) => {
        res.resume();
        const status = res.statusCode ?? 500;
        if (status === 404) {
          tryEndpoint(index + 1);
        } else {
          resolve(true);
        }
      });
      req.on('error', () => tryEndpoint(index + 1));
      req.setTimeout(1500, () => {
        req.destroy();
        tryEndpoint(index + 1);
      });
    };
    tryEndpoint(0);
  });
}

function startBackendServer(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    if (process.env.SKIP_BACKEND && process.env.SKIP_BACKEND !== '0' && process.env.SKIP_BACKEND.toLowerCase() !== 'false') {
      backendManagedExternally = true;
      console.log(`[electron] SKIP_BACKEND set. Assuming backend already running at http://${RENDER_HOST}:${BACKEND_PORT}`);
      resolve();
      return;
    }

    const alreadyRunning = await checkBackendAlreadyRunning();
    if (alreadyRunning) {
      backendManagedExternally = true;
      console.log(`[electron] Backend already running at http://${RENDER_HOST}:${BACKEND_PORT}, skipping spawn.`);
      resolve();
      return;
    }

    const backend = resolveBackendExecutable();

    if (!fs.existsSync(backend.cwd)) {
      console.error('Backend path not found:', backend.cwd);
      reject(new Error(`Backend path not found: ${backend.cwd}`));
      return;
    }

    console.log('[electron] Starting backend:', backend.executable, backend.args.join(' '), 'cwd:', backend.cwd);

    backendProcess = spawn(backend.executable, backend.args, {
      cwd: backend.cwd,
      env: backend.env || process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    backendManagedExternally = false;

    backendProcess.stdout?.on('data', (data) => {
      console.log(`Backend: ${data}`);
      if (data.toString().includes('Uvicorn running')) {
        resolve();
      }
    });

    backendProcess.stderr?.on('data', (data) => {
      console.error(`Backend Error: ${data}`);
    });

    backendProcess.on('error', (error) => {
      console.error('Failed to start backend:', error);
      reject(error);
    });

    backendProcess.on('close', (code) => {
      console.log(`Backend process exited with code ${code}`);
      backendProcess = null;
    });

    setTimeout(() => {
      resolve();
    }, 3000);
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
    console.error('Failed to start application:', error);
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
  console.log('[telemetry]', name, payload);
});
