/**
 * Main React application component.
 */

import React, { Suspense, useState, useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, CircularProgress } from '@mui/material';
import { WorkflowEngineProvider } from './context/WorkflowEngineContext';

const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const FlowComposer = React.lazy(() => import('./pages/FlowComposer'));
const Reports = React.lazy(() => import('./pages/Reports'));
const TestModules = React.lazy(() => import('./pages/TestModules'));
const DeviceManager = React.lazy(() => import('./pages/DeviceManager'));
const Presentation = React.lazy(() => import('./pages/Presentation'));

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  const [backendUrl, setBackendUrl] = useState<string>('');
  const [appVersion, setAppVersion] = useState<string>('');
  const isElectron = typeof window !== 'undefined' && Boolean((window as any).electronAPI);
  const RouterComponent = isElectron ? HashRouter : BrowserRouter;

  useEffect(() => {
    // Get backend URL and app version from Electron
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      electronAPI.getBackendUrl().then(setBackendUrl);
      electronAPI.getAppVersion().then(setAppVersion);
    } else {
      // Fallback for web development
      setBackendUrl('http://127.0.0.1:8007');
      setAppVersion('1.0.0-dev');
    }
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterComponent>
        <WorkflowEngineProvider>
          <Suspense
          fallback={
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                flexDirection: 'column',
                gap: 2,
                color: '#0F172A',
              }}
            >
              <CircularProgress />
              Loading interface…
            </Box>
          }
          >
            <Routes>
              <Route path="/" element={<Navigate to="/presentation" replace />} />
              <Route path="/presentation" element={<Presentation />} />
              <Route path="/dashboard" element={<Dashboard backendUrl={backendUrl} />} />
              <Route path="/modules" element={<TestModules backendUrl={backendUrl} />} />
              <Route path="/workflows" element={<FlowComposer backendUrl={backendUrl} />} />
              <Route path="/devices" element={<DeviceManager backendUrl={backendUrl} />} />
              <Route path="/reports" element={<Reports backendUrl={backendUrl} />} />
            </Routes>
          </Suspense>
        </WorkflowEngineProvider>
      </RouterComponent>
    </ThemeProvider>
  );
}

export default App;
