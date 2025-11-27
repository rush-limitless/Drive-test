/**
 * Simplified Electron main process.
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';

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
      console.error('Frontend not found at:', rendererEntry);
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null as any;
  });
}

function startBackendServer(): Promise<void> {
  return new Promise((resolve) => {
    const backend = resolveBackendExecutable();

    console.log('Starting backend:', backend.executable);

    backendProcess = spawn(backend.executable, backend.args, {
      cwd: backend.cwd,
      env: backend.env || process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    backendProcess.stdout?.on('data', (data) => {
      console.log(`Backend: ${data}`);
    });

    backendProcess.stderr?.on('data', (data) => {
      console.error(`Backend Error: ${data}`);
    });

    backendProcess.on('error', (error) => {
      console.error('Backend error:', error);
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