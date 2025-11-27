# Frontend Architecture Guide

## Overview

The ADB Framework frontend is built with React 18+ and TypeScript, providing a modern, responsive, and intuitive user interface for telecommunications testing. The application follows component-based architecture with state management, real-time updates, and comprehensive testing capabilities.

## Project Structure

```
src/frontend/
├── public/                     # Static assets
│   ├── index.html             # HTML template
│   ├── manifest.json          # PWA manifest
│   └── favicon.ico            # Application icon
├── src/
│   ├── components/            # Reusable UI components
│   │   ├── common/           # Common components
│   │   │   ├── Button/       # Button component
│   │   │   ├── Modal/        # Modal component
│   │   │   ├── Table/        # Data table component
│   │   │   └── Loading/      # Loading indicators
│   │   ├── layout/           # Layout components
│   │   │   ├── Header/       # Application header
│   │   │   ├── Sidebar/      # Navigation sidebar
│   │   │   ├── Footer/       # Application footer
│   │   │   └── Layout/       # Main layout wrapper
│   │   ├── devices/          # Device management components
│   │   │   ├── DeviceList/   # Device listing
│   │   │   ├── DeviceCard/   # Individual device card
│   │   │   ├── DeviceStatus/ # Device status display
│   │   │   └── DeviceModal/  # Device configuration modal
│   │   ├── executions/       # Test execution components
│   │   │   ├── ExecutionList/    # Execution history
│   │   │   ├── ExecutionCard/    # Execution summary card
│   │   │   ├── ExecutionDetails/ # Detailed execution view
│   │   │   └── ExecutionLogs/    # Execution logs viewer
│   │   ├── flows/            # Workflow components
│   │   │   ├── FlowBuilder/  # Visual workflow builder
│   │   │   ├── FlowList/     # Workflow listing
│   │   │   ├── FlowCard/     # Workflow summary card
│   │   │   └── FlowEditor/   # Workflow editor
│   │   ├── reports/          # Report components
│   │   │   ├── ReportList/   # Report listing
│   │   │   ├── ReportViewer/ # Report display
│   │   │   ├── ReportChart/  # Chart components
│   │   │   └── ReportExport/ # Export functionality
│   │   └── dashboard/        # Dashboard components
│   │       ├── Overview/     # System overview
│   │       ├── Metrics/      # Performance metrics
│   │       ├── Charts/       # Data visualization
│   │       └── Widgets/      # Dashboard widgets
│   ├── pages/                # Page components
│   │   ├── Dashboard/        # Dashboard page
│   │   ├── Devices/          # Device management page
│   │   ├── Executions/       # Test execution page
│   │   ├── Flows/            # Workflow management page
│   │   ├── Reports/          # Reports page
│   │   └── Settings/         # Application settings
│   ├── hooks/                # Custom React hooks
│   │   ├── useDevices.ts     # Device management hook
│   │   ├── useExecutions.ts  # Execution management hook
│   │   ├── useWebSocket.ts   # WebSocket connection hook
│   │   ├── useApi.ts         # API interaction hook
│   │   └── useLocalStorage.ts # Local storage hook
│   ├── services/             # API and external services
│   │   ├── api.ts            # API client configuration
│   │   ├── deviceService.ts  # Device API service
│   │   ├── executionService.ts # Execution API service
│   │   ├── flowService.ts    # Flow API service
│   │   ├── reportService.ts  # Report API service
│   │   └── websocketService.ts # WebSocket service
│   ├── store/                # State management
│   │   ├── index.ts          # Store configuration
│   │   ├── deviceSlice.ts    # Device state slice
│   │   ├── executionSlice.ts # Execution state slice
│   │   ├── flowSlice.ts      # Flow state slice
│   │   ├── uiSlice.ts        # UI state slice
│   │   └── authSlice.ts      # Authentication state
│   ├── styles/               # Styling and themes
│   │   ├── globals.css       # Global styles
│   │   ├── variables.css     # CSS variables
│   │   ├── components.css    # Component styles
│   │   └── dashboardTheme.ts # Material-UI theme
│   ├── types/                # TypeScript type definitions
│   │   ├── api.ts            # API response types
│   │   ├── device.ts         # Device types
│   │   ├── execution.ts      # Execution types
│   │   ├── flow.ts           # Flow types
│   │   ├── report.ts         # Report types
│   │   └── electron.d.ts     # Electron types
│   ├── utils/                # Utility functions
│   │   ├── api.ts            # API utilities
│   │   ├── date.ts           # Date formatting utilities
│   │   ├── validation.ts     # Form validation
│   │   ├── deviceActivity.ts # Device activity tracking
│   │   ├── deviceCache.ts    # Device data caching
│   │   ├── deviceMetadata.ts # Device metadata handling
│   │   ├── deviceRegistry.ts # Device registry management
│   │   └── telemetry.ts      # Telemetry and analytics
│   ├── App.tsx               # Main application component
│   ├── index.tsx             # Application entry point
│   └── setupTests.ts         # Test configuration
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── tailwind.config.js        # Tailwind CSS configuration
└── jest.config.js            # Jest testing configuration
```

## Core Technologies

### 1. React 18+ with TypeScript
```typescript
// App.tsx - Main application component
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import { store } from './store';
import { theme } from './styles/dashboardTheme';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Executions from './pages/Executions';
import Flows from './pages/Flows';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/devices" element={<Devices />} />
              <Route path="/executions" element={<Executions />} />
              <Route path="/flows" element={<Flows />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        </Router>
      </ThemeProvider>
    </Provider>
  );
};

export default App;
```

### 2. State Management with Redux Toolkit

#### Store Configuration (`store/index.ts`)
```typescript
import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';

import deviceReducer from './deviceSlice';
import executionReducer from './executionSlice';
import flowReducer from './flowSlice';
import uiReducer from './uiSlice';
import authReducer from './authSlice';

export const store = configureStore({
  reducer: {
    devices: deviceReducer,
    executions: executionReducer,
    flows: flowReducer,
    ui: uiReducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

#### Device State Slice (`store/deviceSlice.ts`)
```typescript
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Device, DeviceStatus } from '../types/device';
import { deviceService } from '../services/deviceService';

interface DeviceState {
  devices: Device[];
  selectedDevice: Device | null;
  loading: boolean;
  error: string | null;
  connectionStatus: Record<string, DeviceStatus>;
}

const initialState: DeviceState = {
  devices: [],
  selectedDevice: null,
  loading: false,
  error: null,
  connectionStatus: {},
};

// Async thunks
export const fetchDevices = createAsyncThunk(
  'devices/fetchDevices',
  async (_, { rejectWithValue }) => {
    try {
      const devices = await deviceService.getDevices();
      return devices;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const connectDevice = createAsyncThunk(
  'devices/connectDevice',
  async (deviceId: string, { rejectWithValue }) => {
    try {
      const device = await deviceService.connectDevice(deviceId);
      return device;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const disconnectDevice = createAsyncThunk(
  'devices/disconnectDevice',
  async (deviceId: string, { rejectWithValue }) => {
    try {
      await deviceService.disconnectDevice(deviceId);
      return deviceId;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const deviceSlice = createSlice({
  name: 'devices',
  initialState,
  reducers: {
    setSelectedDevice: (state, action: PayloadAction<Device | null>) => {
      state.selectedDevice = action.payload;
    },
    updateDeviceStatus: (state, action: PayloadAction<{
      deviceId: string;
      status: DeviceStatus;
    }>) => {
      const { deviceId, status } = action.payload;
      state.connectionStatus[deviceId] = status;
      
      // Update device in devices array
      const deviceIndex = state.devices.findIndex(d => d.id === deviceId);
      if (deviceIndex !== -1) {
        state.devices[deviceIndex].status = status.connection_status;
      }
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch devices
      .addCase(fetchDevices.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDevices.fulfilled, (state, action) => {
        state.loading = false;
        state.devices = action.payload;
      })
      .addCase(fetchDevices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Connect device
      .addCase(connectDevice.fulfilled, (state, action) => {
        const updatedDevice = action.payload;
        const index = state.devices.findIndex(d => d.id === updatedDevice.id);
        if (index !== -1) {
          state.devices[index] = updatedDevice;
        }
      })
      // Disconnect device
      .addCase(disconnectDevice.fulfilled, (state, action) => {
        const deviceId = action.payload;
        const index = state.devices.findIndex(d => d.id === deviceId);
        if (index !== -1) {
          state.devices[index].status = 'disconnected';
        }
      });
  },
});

export const { setSelectedDevice, updateDeviceStatus, clearError } = deviceSlice.actions;
export default deviceSlice.reducer;
```

### 3. API Services

#### Device Service (`services/deviceService.ts`)
```typescript
import { Device, DeviceStatus, CreateDeviceRequest } from '../types/device';
import { apiClient } from './api';

class DeviceService {
  async getDevices(): Promise<Device[]> {
    const response = await apiClient.get('/devices');
    return response.data;
  }

  async getDevice(deviceId: string): Promise<Device> {
    const response = await apiClient.get(`/devices/${deviceId}`);
    return response.data;
  }

  async createDevice(deviceData: CreateDeviceRequest): Promise<Device> {
    const response = await apiClient.post('/devices', deviceData);
    return response.data;
  }

  async updateDevice(deviceId: string, updates: Partial<Device>): Promise<Device> {
    const response = await apiClient.patch(`/devices/${deviceId}`, updates);
    return response.data;
  }

  async deleteDevice(deviceId: string): Promise<void> {
    await apiClient.delete(`/devices/${deviceId}`);
  }

  async connectDevice(deviceId: string): Promise<Device> {
    const response = await apiClient.post(`/devices/${deviceId}/connect`);
    return response.data;
  }

  async disconnectDevice(deviceId: string): Promise<void> {
    await apiClient.post(`/devices/${deviceId}/disconnect`);
  }

  async getDeviceStatus(deviceId: string): Promise<DeviceStatus> {
    const response = await apiClient.get(`/devices/${deviceId}/status`);
    return response.data;
  }

  async discoverDevices(): Promise<Device[]> {
    const response = await apiClient.post('/devices/discover');
    return response.data;
  }

  async executeCommand(
    deviceId: string, 
    command: string[]
  ): Promise<{ success: boolean; output: string; error?: string }> {
    const response = await apiClient.post(`/devices/${deviceId}/execute`, {
      command
    });
    return response.data;
  }
}

export const deviceService = new DeviceService();
```

### 4. Custom Hooks

#### Device Management Hook (`hooks/useDevices.ts`)
```typescript
import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchDevices,
  connectDevice,
  disconnectDevice,
  setSelectedDevice,
  updateDeviceStatus,
} from '../store/deviceSlice';
import { useWebSocket } from './useWebSocket';

export const useDevices = () => {
  const dispatch = useAppDispatch();
  const { devices, selectedDevice, loading, error, connectionStatus } = useAppSelector(
    (state) => state.devices
  );

  const { subscribe, unsubscribe } = useWebSocket();

  // Fetch devices on mount
  useEffect(() => {
    dispatch(fetchDevices());
  }, [dispatch]);

  // Subscribe to device status updates
  useEffect(() => {
    const handleDeviceStatusUpdate = (data: any) => {
      dispatch(updateDeviceStatus({
        deviceId: data.device_id,
        status: data.status
      }));
    };

    subscribe('device_status', handleDeviceStatusUpdate);

    return () => {
      unsubscribe('device_status', handleDeviceStatusUpdate);
    };
  }, [dispatch, subscribe, unsubscribe]);

  const handleConnectDevice = useCallback(async (deviceId: string) => {
    try {
      await dispatch(connectDevice(deviceId)).unwrap();
    } catch (error) {
      console.error('Failed to connect device:', error);
    }
  }, [dispatch]);

  const handleDisconnectDevice = useCallback(async (deviceId: string) => {
    try {
      await dispatch(disconnectDevice(deviceId)).unwrap();
    } catch (error) {
      console.error('Failed to disconnect device:', error);
    }
  }, [dispatch]);

  const handleSelectDevice = useCallback((device: Device | null) => {
    dispatch(setSelectedDevice(device));
  }, [dispatch]);

  const refreshDevices = useCallback(() => {
    dispatch(fetchDevices());
  }, [dispatch]);

  return {
    devices,
    selectedDevice,
    loading,
    error,
    connectionStatus,
    connectDevice: handleConnectDevice,
    disconnectDevice: handleDisconnectDevice,
    selectDevice: handleSelectDevice,
    refreshDevices,
  };
};
```

#### WebSocket Hook (`hooks/useWebSocket.ts`)
```typescript
import { useEffect, useRef, useCallback } from 'react';
import { useAppDispatch } from '../store';

type WebSocketEventHandler = (data: any) => void;

export const useWebSocket = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const eventHandlers = useRef<Map<string, Set<WebSocketEventHandler>>>(new Map());
  const dispatch = useAppDispatch();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/frontend-client`;
    
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
    };

    wsRef.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type, data } = message;

        // Notify all handlers for this event type
        const handlers = eventHandlers.current.get(type);
        if (handlers) {
          handlers.forEach(handler => handler(data));
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket disconnected');
      // Attempt to reconnect after 3 seconds
      setTimeout(connect, 3000);
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const subscribe = useCallback((eventType: string, handler: WebSocketEventHandler) => {
    if (!eventHandlers.current.has(eventType)) {
      eventHandlers.current.set(eventType, new Set());
    }
    eventHandlers.current.get(eventType)!.add(handler);
  }, []);

  const unsubscribe = useCallback((eventType: string, handler: WebSocketEventHandler) => {
    const handlers = eventHandlers.current.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        eventHandlers.current.delete(eventType);
      }
    }
  }, []);

  const send = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return {
    subscribe,
    unsubscribe,
    send,
    connect,
    disconnect,
  };
};
```

### 5. Component Architecture

#### Device List Component (`components/devices/DeviceList/DeviceList.tsx`)
```typescript
import React, { useState } from 'react';
import {
  Box,
  Grid,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Chip,
  Alert,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
} from '@mui/icons-material';

import { useDevices } from '../../../hooks/useDevices';
import DeviceCard from '../DeviceCard/DeviceCard';
import DeviceModal from '../DeviceModal/DeviceModal';
import LoadingSpinner from '../../common/Loading/LoadingSpinner';

const DeviceList: React.FC = () => {
  const {
    devices,
    loading,
    error,
    refreshDevices,
    connectDevice,
    disconnectDevice,
  } = useDevices();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredDevices = devices.filter(device => {
    const matchesSearch = device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const statusCounts = devices.reduce((acc, device) => {
    acc[device.status] = (acc[device.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading && devices.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Device Management
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={refreshDevices}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsModalOpen(true)}
          >
            Add Device
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Box display="flex" gap={2} mb={3} alignItems="center">
        <TextField
          placeholder="Search devices..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 300 }}
        />
        
        <Box display="flex" gap={1}>
          <Chip
            label={`All (${devices.length})`}
            onClick={() => setStatusFilter('all')}
            color={statusFilter === 'all' ? 'primary' : 'default'}
            variant={statusFilter === 'all' ? 'filled' : 'outlined'}
          />
          <Chip
            label={`Connected (${statusCounts.connected || 0})`}
            onClick={() => setStatusFilter('connected')}
            color={statusFilter === 'connected' ? 'success' : 'default'}
            variant={statusFilter === 'connected' ? 'filled' : 'outlined'}
          />
          <Chip
            label={`Disconnected (${statusCounts.disconnected || 0})`}
            onClick={() => setStatusFilter('disconnected')}
            color={statusFilter === 'disconnected' ? 'error' : 'default'}
            variant={statusFilter === 'disconnected' ? 'filled' : 'outlined'}
          />
        </Box>
      </Box>

      {/* Device Grid */}
      <Grid container spacing={3}>
        {filteredDevices.map((device) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={device.id}>
            <DeviceCard
              device={device}
              onConnect={() => connectDevice(device.id)}
              onDisconnect={() => disconnectDevice(device.id)}
            />
          </Grid>
        ))}
      </Grid>

      {/* Empty State */}
      {filteredDevices.length === 0 && !loading && (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          py={8}
        >
          <Typography variant="h6" color="textSecondary" gutterBottom>
            No devices found
          </Typography>
          <Typography variant="body2" color="textSecondary" mb={2}>
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Connect a device or add one manually to get started'
            }
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsModalOpen(true)}
          >
            Add Device
          </Button>
        </Box>
      )}

      {/* Add Device Modal */}
      <DeviceModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          refreshDevices();
        }}
      />
    </Box>
  );
};

export default DeviceList;
```

### 6. Material-UI Theme Configuration

#### Dashboard Theme (`styles/dashboardTheme.ts`)
```typescript
import { createTheme, ThemeOptions } from '@mui/material/styles';

const themeOptions: ThemeOptions = {
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#dc004e',
      light: '#ff5983',
      dark: '#9a0036',
      contrastText: '#ffffff',
    },
    success: {
      main: '#2e7d32',
      light: '#4caf50',
      dark: '#1b5e20',
    },
    warning: {
      main: '#ed6c02',
      light: '#ff9800',
      dark: '#e65100',
    },
    error: {
      main: '#d32f2f',
      light: '#ef5350',
      dark: '#c62828',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.87)',
      secondary: 'rgba(0, 0, 0, 0.6)',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 500,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 500,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 500,
      lineHeight: 1.4,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
      lineHeight: 1.5,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.6,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.43,
    },
  },
  shape: {
    borderRadius: 8,
  },
  spacing: 8,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          borderRadius: 8,
          padding: '8px 16px',
        },
        contained: {
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          '&:hover': {
            boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderRadius: 12,
          '&:hover': {
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          fontWeight: 500,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
};

export const theme = createTheme(themeOptions);
```

### 7. TypeScript Type Definitions

#### Device Types (`types/device.ts`)
```typescript
export interface Device {
  id: string;
  name: string;
  model?: string;
  manufacturer?: string;
  android_version?: string;
  api_level?: number;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  ip_address?: string;
  connection_type: 'usb' | 'wifi' | 'bluetooth';
  last_seen?: string;
  is_active: boolean;
  capabilities?: DeviceCapabilities;
  metadata?: DeviceMetadata;
  created_at?: string;
  updated_at?: string;
}

export interface DeviceCapabilities {
  has_camera: boolean;
  has_gps: boolean;
  has_nfc: boolean;
  has_bluetooth: boolean;
  has_wifi: boolean;
  has_cellular: boolean;
  screen_resolution: string;
  ram_size: number;
  storage_size: number;
}

export interface DeviceMetadata {
  serial_number?: string;
  imei?: string;
  phone_number?: string;
  carrier?: string;
  network_type?: string;
  battery_level?: number;
  temperature?: number;
  cpu_usage?: number;
  memory_usage?: number;
}

export interface DeviceStatus {
  device_id: string;
  connection_status: 'connected' | 'disconnected' | 'error';
  battery_level?: number;
  network_status?: {
    type: string;
    strength: number;
    operator: string;
  };
  memory_usage?: {
    total: number;
    used: number;
    available: number;
  };
  cpu_usage?: number;
  storage_usage?: {
    total: number;
    used: number;
    available: number;
  };
  last_updated: string;
}

export interface CreateDeviceRequest {
  id: string;
  name: string;
  model?: string;
  connection_type?: 'usb' | 'wifi' | 'bluetooth';
  ip_address?: string;
}

export interface UpdateDeviceRequest {
  name?: string;
  status?: string;
  ip_address?: string;
  metadata?: Partial<DeviceMetadata>;
}
```

### 8. Testing Strategy

#### Component Testing (`components/devices/DeviceCard/DeviceCard.test.tsx`)
```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import { configureStore } from '@reduxjs/toolkit';

import DeviceCard from './DeviceCard';
import { theme } from '../../../styles/dashboardTheme';
import deviceReducer from '../../../store/deviceSlice';
import { Device } from '../../../types/device';

const mockDevice: Device = {
  id: 'test-device-001',
  name: 'Test Device',
  model: 'Test Model',
  android_version: '11',
  api_level: 30,
  status: 'connected',
  connection_type: 'usb',
  is_active: true,
};

const mockStore = configureStore({
  reducer: {
    devices: deviceReducer,
  },
  preloadedState: {
    devices: {
      devices: [mockDevice],
      selectedDevice: null,
      loading: false,
      error: null,
      connectionStatus: {},
    },
  },
});

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <Provider store={mockStore}>
      <ThemeProvider theme={theme}>
        {component}
      </ThemeProvider>
    </Provider>
  );
};

describe('DeviceCard', () => {
  const mockOnConnect = jest.fn();
  const mockOnDisconnect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders device information correctly', () => {
    renderWithProviders(
      <DeviceCard
        device={mockDevice}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
      />
    );

    expect(screen.getByText('Test Device')).toBeInTheDocument();
    expect(screen.getByText('Test Model')).toBeInTheDocument();
    expect(screen.getByText('Android 11')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('shows connect button when device is disconnected', () => {
    const disconnectedDevice = { ...mockDevice, status: 'disconnected' as const };
    
    renderWithProviders(
      <DeviceCard
        device={disconnectedDevice}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
      />
    );

    const connectButton = screen.getByRole('button', { name: /connect/i });
    expect(connectButton).toBeInTheDocument();
  });

  it('shows disconnect button when device is connected', () => {
    renderWithProviders(
      <DeviceCard
        device={mockDevice}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
      />
    );

    const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
    expect(disconnectButton).toBeInTheDocument();
  });

  it('calls onConnect when connect button is clicked', async () => {
    const disconnectedDevice = { ...mockDevice, status: 'disconnected' as const };
    
    renderWithProviders(
      <DeviceCard
        device={disconnectedDevice}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
      />
    );

    const connectButton = screen.getByRole('button', { name: /connect/i });
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(mockOnConnect).toHaveBeenCalledWith();
    });
  });

  it('calls onDisconnect when disconnect button is clicked', async () => {
    renderWithProviders(
      <DeviceCard
        device={mockDevice}
        onConnect={mockOnConnect}
        onDisconnect={mockOnDisconnect}
      />
    );

    const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
    fireEvent.click(disconnectButton);

    await waitFor(() => {
      expect(mockOnDisconnect).toHaveBeenCalledWith();
    });
  });
});
```

### 9. Performance Optimization

#### Memoization and Optimization
```typescript
// Memoized device card component
import React, { memo } from 'react';

const DeviceCard = memo<DeviceCardProps>(({ device, onConnect, onDisconnect }) => {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison function
  return (
    prevProps.device.id === nextProps.device.id &&
    prevProps.device.status === nextProps.device.status &&
    prevProps.device.name === nextProps.device.name
  );
});

// Virtualized list for large datasets
import { FixedSizeList as List } from 'react-window';

const VirtualizedDeviceList: React.FC<{ devices: Device[] }> = ({ devices }) => {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <DeviceCard device={devices[index]} />
    </div>
  );

  return (
    <List
      height={600}
      itemCount={devices.length}
      itemSize={200}
      width="100%"
    >
      {Row}
    </List>
  );
};
```

### 10. Build Configuration

#### Package.json Scripts
```json
{
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "type-check": "tsc --noEmit",
    "analyze": "npm run build && npx bundle-analyzer build/static/js/*.js"
  }
}
```

---

**Next**: [API Reference](../api/README.md) | **Previous**: [Backend Guide](../backend/README.md)