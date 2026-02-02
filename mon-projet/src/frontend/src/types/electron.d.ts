export {};

declare global {
  interface Window {
    electronAPI?: {
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
