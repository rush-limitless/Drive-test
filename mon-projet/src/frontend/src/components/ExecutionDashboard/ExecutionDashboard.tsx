/**
 * Execution Dashboard component for monitoring flow executions.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Alert,
} from '@mui/material';
import { Stop as StopIcon, Refresh as RefreshIcon } from '@mui/icons-material';

import ExecutionProgress from './ExecutionProgress';
import ExecutionLogs from './ExecutionLogs';
import { executionApi } from '../../services/executionApi';
import { webSocketService } from '../../services/websocket';

interface Execution {
  id: string;
  flow_id: string;
  status: string;
  start_time?: string;
  end_time?: string;
  progress_percentage: number;
  current_step?: string;
  error_message?: string;
  devices: Array<{
    device_id: string;
    status: string;
    start_time?: string;
    end_time?: string;
  }>;
}

interface ExecutionDashboardProps {
  backendUrl: string;
  executionId?: string;
}

function ExecutionDashboard({ backendUrl, executionId }: ExecutionDashboardProps) {
  const [execution, setExecution] = useState<Execution | null>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (executionId) {
      loadExecution(executionId);
      // Connect to backend native WebSocket for this execution
      webSocketService.connectExecution(backendUrl, executionId);
      // Subscribe to real-time updates
      const unsubscribe = webSocketService.subscribeToExecutionProgress((update) => {
        if (update.execution_id === executionId) {
          setExecution(prev => prev ? {
            ...prev,
            progress_percentage: update.progress_percentage,
            current_step: update.current_step
          } : null);
        }
      });
      
      return () => {
        unsubscribe();
        webSocketService.disconnectExecution();
      };
    } else {
      loadExecutions();
    }
  }, [backendUrl, executionId]);

  const loadExecution = async (id: string) => {
    if (!backendUrl) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const executionData = await executionApi.getExecution(backendUrl, id);
      setExecution(executionData);
    } catch (err) {
      setError('Failed to load execution details');
      console.error('Error loading execution:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadExecutions = async () => {
    if (!backendUrl) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const executionList = await executionApi.getExecutions(backendUrl);
      setExecutions(executionList);
    } catch (err) {
      setError('Failed to load executions');
      console.error('Error loading executions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelExecution = async (id: string) => {
    try {
      await executionApi.cancelExecution(backendUrl, id);
      if (executionId === id) {
        await loadExecution(id);
      } else {
        await loadExecutions();
      }
    } catch (err) {
      setError('Failed to cancel execution');
      console.error('Error cancelling execution:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'running':
        return 'primary';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatDuration = (startTime?: string, endTime?: string) => {
    if (!startTime) return 'Not started';
    
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000);
    
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
        <Button onClick={() => executionId ? loadExecution(executionId) : loadExecutions()}>
          Retry
        </Button>
      </Alert>
    );
  }

  // Single execution view
  if (executionId && execution) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5" component="h2">
            Execution Details
          </Typography>
          <Box>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => loadExecution(executionId)}
              disabled={loading}
              sx={{ mr: 1 }}
            >
              Refresh
            </Button>
            {execution.status === 'running' && (
              <Button
                variant="contained"
                color="error"
                startIcon={<StopIcon />}
                onClick={() => handleCancelExecution(executionId)}
              >
                Cancel
              </Button>
            )}
          </Box>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <ExecutionProgress execution={execution} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Execution Info
              </Typography>
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">
                  Status
                </Typography>
                <Chip 
                  label={execution.status} 
                  color={getStatusColor(execution.status) as any}
                  size="small"
                />
              </Box>
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">
                  Progress
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={execution.progress_percentage} 
                  sx={{ mt: 1 }}
                />
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {execution.progress_percentage}%
                </Typography>
              </Box>
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">
                  Duration
                </Typography>
                <Typography variant="body1">
                  {formatDuration(execution.start_time, execution.end_time)}
                </Typography>
              </Box>
              {execution.current_step && (
                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary">
                    Current Step
                  </Typography>
                  <Typography variant="body1">
                    {execution.current_step}
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12}>
            <ExecutionLogs backendUrl={backendUrl} executionId={executionId} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  // Executions list view
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" component="h2">
          Execution History
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadExecutions}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Execution ID</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Progress</TableCell>
              <TableCell>Devices</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {executions.map((exec) => (
              <TableRow key={exec.id}>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {exec.id.substring(0, 8)}...
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={exec.status} 
                    color={getStatusColor(exec.status) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center">
                    <LinearProgress 
                      variant="determinate" 
                      value={exec.progress_percentage} 
                      sx={{ width: 100, mr: 1 }}
                    />
                    <Typography variant="body2">
                      {exec.progress_percentage}%
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>{exec.devices.length}</TableCell>
                <TableCell>
                  {formatDuration(exec.start_time, exec.end_time)}
                </TableCell>
                <TableCell>
                  {exec.status === 'running' && (
                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleCancelExecution(exec.id)}
                    >
                      Cancel
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default ExecutionDashboard;
