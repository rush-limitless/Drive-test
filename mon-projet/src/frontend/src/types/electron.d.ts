export {};

declare global {
  interface Window {
    electronAPI?: {
      getBackendUrl: () => Promise<string>;
      getAppVersion: () => Promise<string>;
      restartBackend: () => Promise<boolean>;
      trackEvent: (name: string, payload?: Record<string, unknown>) => void;
    };
  }
}
