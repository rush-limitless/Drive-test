/**
 * Electron preload script for secure IPC communication.
 */

import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  restartBackend: () => ipcRenderer.invoke('restart-backend'),
  trackEvent: (name: string, payload?: Record<string, unknown>) =>
    ipcRenderer.send('telemetry-event', { name, payload }),
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      getBackendUrl: () => Promise<string>;
      getAppVersion: () => Promise<string>;
      restartBackend: () => Promise<boolean>;
      trackEvent: (name: string, payload?: Record<string, unknown>) => void;
    };
  }
}
