// Test simple pour diagnostiquer Electron
try {
  console.log('Testing Electron import...');
  const electron = require('electron');
  console.log('Electron imported successfully');
  console.log('Type of electron:', typeof electron);
  console.log('Electron constructor:', electron.constructor.name);
  
  // Test different access methods
  console.log('Direct app access:', typeof electron.app);
  console.log('Direct BrowserWindow access:', typeof electron.BrowserWindow);
  
  if (electron.app && electron.BrowserWindow) {
    console.log('SUCCESS: Found app and BrowserWindow');
    
    const { app, BrowserWindow } = electron;
    
    app.whenReady().then(() => {
      console.log('App is ready');
      const win = new BrowserWindow({ width: 800, height: 600 });
      win.loadURL('https://www.google.com');
    });
    
    app.on('window-all-closed', () => {
      app.quit();
    });
    
  } else {
    console.log('ERROR: Cannot find app or BrowserWindow');
    console.log('Available properties:', Object.getOwnPropertyNames(electron));
  }
  
} catch (error) {
  console.error('Error:', error.message);
}