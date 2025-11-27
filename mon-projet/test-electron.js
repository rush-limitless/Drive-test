console.log('Testing Electron import...');

try {
  const electron = require('electron');
  console.log('Electron imported:', typeof electron);
  console.log('App available:', typeof electron.app);
  
  if (electron.app) {
    console.log('App methods:', Object.getOwnPropertyNames(electron.app));
  }
} catch (error) {
  console.error('Error importing electron:', error);
}

console.log('Process versions:', process.versions);