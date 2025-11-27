const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let mainWindow;
let backendProcess = null;

const BACKEND_PORT = 8007;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'ADB Framework Telco Automation'
  });

  // Load the frontend from web server
  console.log('Loading from URL: http://localhost:8007');
  mainWindow.loadURL('http://localhost:8007');
  
  // Add error handling
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
    // Try to reload after a delay
    setTimeout(() => {
      console.log('Retrying to load...');
      mainWindow.loadURL('http://localhost:8007');
    }, 2000);
  });
  
  mainWindow.webContents.on('crashed', (event) => {
    console.error('Renderer process crashed');
  });
  
  mainWindow.on('unresponsive', () => {
    console.error('Window became unresponsive');
  });
  
  // Open DevTools for debugging
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackend() {
  const backendPath = path.join(__dirname, 'src/backend');
  const pythonPath = path.join(__dirname, '.venv/Scripts/python.exe');
  
  const python = fs.existsSync(pythonPath) ? pythonPath : 'python';
  
  backendProcess = spawn(python, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', BACKEND_PORT.toString()], {
    cwd: backendPath,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`);
  });

  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data}`);
  });

  backendProcess.on('close', (code) => {
    console.log(`Backend exited with code ${code}`);
  });
  
  backendProcess.on('error', (error) => {
    console.error('Backend process error:', error);
  });
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
    backendProcess = null;
  }
}

app.whenReady().then(() => {
  startBackend();
  
  // Check if backend is ready before opening window
  const checkBackend = () => {
    const http = require('http');
    const options = {
      hostname: '127.0.0.1',
      port: 8007,
      path: '/health',
      method: 'GET',
      timeout: 1000
    };
    
    const req = http.request(options, (res) => {
      console.log('Backend is ready, opening window');
      createWindow();
    });
    
    req.on('error', (err) => {
      console.log('Backend not ready yet, retrying in 1 second...');
      setTimeout(checkBackend, 1000);
    });
    
    req.on('timeout', () => {
      console.log('Backend health check timeout, retrying...');
      req.destroy();
      setTimeout(checkBackend, 1000);
    });
    
    req.end();
  };
  
  // Start checking after 2 seconds
  setTimeout(checkBackend, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackend();
});