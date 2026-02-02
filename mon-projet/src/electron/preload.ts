/**
 * Electron preload script for secure IPC communication.
 */

import { contextBridge, ipcRenderer } from 'electron';

const sendRendererLog = (level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: unknown) => {
  try {
    ipcRenderer.send('renderer-log', { level, message, meta });
  } catch {
    // Ignore IPC failures to avoid breaking the renderer.
  }
};

const serializeReason = (reason: unknown): string => {
  if (reason instanceof Error) {
    return reason.stack || reason.message;
  }
  if (typeof reason === 'string') {
    return reason;
  }
  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    sendRendererLog('error', event.message || 'Renderer error', {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    sendRendererLog('error', 'Unhandled promise rejection', {
      reason: serializeReason(event.reason),
    });
  });
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  restartBackend: () => ipcRenderer.invoke('restart-backend'),
  exportLogs: () => ipcRenderer.invoke('export-logs'),
  createBugReport: (payload: { notes?: string; route?: string; selectedDeviceIds?: string[]; workflowId?: string; backendUrl?: string }) =>
    ipcRenderer.invoke('create-bug-report', payload),
  openPath: (targetPath: string) => ipcRenderer.invoke('open-path', targetPath),
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
      exportLogs: () => Promise<{
        success: boolean;
        path?: string;
        cancelled?: boolean;
        error?: string;
        counts?: { electron?: number; backend?: number };
      }>;
      createBugReport: (payload: {
        notes?: string;
        route?: string;
        selectedDeviceIds?: string[];
        workflowId?: string;
        backendUrl?: string;
      }) => Promise<{
        success: boolean;
        path?: string;
        cancelled?: boolean;
        error?: string;
        counts?: { electron?: number; backend?: number };
      }>;
      openPath: (targetPath: string) => Promise<{ success: boolean; error?: string }>;
      trackEvent: (name: string, payload?: Record<string, unknown>) => void;
    };
  }
}
