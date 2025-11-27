// Simple working Electron main process
try {
  const electron = require('electron');
  console.log('Electron loaded successfully');
  
  // Try different ways to access app and BrowserWindow
  let app, BrowserWindow;
  
  if (electron.app) {
    app = electron.app;
    BrowserWindow = electron.BrowserWindow;
  } else if (electron.default && electron.default.app) {
    app = electron.default.app;
    BrowserWindow = electron.default.BrowserWindow;
  } else {
    console.error('Cannot find app in electron object');
    console.log('Available properties:', Object.getOwnPropertyNames(electron));
    process.exit(1);
  }
  
  const { spawn } = require('child_process');
  const path = require('path');
  
  let mainWindow;
  let backendProcess = null;
  
  function startBackend() {
    const backendPath = path.join(__dirname, 'src/backend');
    backendProcess = spawn('python', ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8007'], {
      cwd: backendPath,
      stdio: 'inherit'
    });
  }
  
  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      },
      title: 'ADB Framework Telco Automation'
    });
    
    // Load the app
    mainWindow.loadURL('http://localhost:8007');
    
    // Keep DevTools open for debugging
    mainWindow.webContents.openDevTools();
  }
  
  app.whenReady().then(() => {
    startBackend();
    
    // Wait for backend to start
    setTimeout(() => {
      createWindow();
    }, 3000);
  });
  
  app.on('window-all-closed', () => {
    if (backendProcess) {
      backendProcess.kill();
    }
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
  
} catch (error) {
  console.error('Error loading Electron:', error);
  process.exit(1);
}