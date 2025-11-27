/**
 * Execution Progress component for displaying execution progress.
 */

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Grid,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  CheckCircle as CompletedIcon,
  Error as ErrorIcon,
  PlayArrow as RunningIcon,
  Pause as PendingIcon,
} from '@mui/icons-material';

interface ExecutionDevice {
  device_id: string;
  status: string;
  start_time?: string;
  end_time?: string;
  steps?: Array<{
    id: string;
    module_id: string;
    step_index: number;
    status: string;
    start_time?: string;
    end_time?: string;
    duration_seconds?: number;
  }>;
}

interface Execution {
  id: string;
  status: string;
  progress_percentage: number;
  current_step?: string;
  devices: ExecutionDevice[];
}

interface ExecutionProgressProps {
  execution: Execution;
}

function ExecutionProgress({ execution }: ExecutionProgressProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CompletedIcon color="success" />;
      case 'running':
        return <RunningIcon color="primary" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      default:
        return <PendingIcon color="action" />;
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

  const calculateDeviceProgress = (device: ExecutionDevice) => {
    if (!device.steps || device.steps.length === 0) return 0;
    
    const completedSteps = device.steps.filter(step => 
      step.status === 'completed' || step.status === 'failed'
    ).length;
    
    return Math.round((completedSteps / device.steps.length) * 100);
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Execution Progress
      </Typography>
      
      {/* Overall Progress */}
      <Box mb={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="body2" color="text.secondary">
            Overall Progress
          </Typography>
          <Typography variant="body2">
            {execution.progress_percentage}%
          </Typography>
        </Box>
        <LinearProgress 
          variant="determinate" 
          value={execution.progress_percentage} 
          sx={{ height: 8, borderRadius: 4 }}
        />
        {execution.current_step && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Current: {execution.current_step}
          </Typography>
        )}
      </Box>

      {/* Device Progress */}
      <Typography variant="subtitle1" gutterBottom>
        Device Progress
      </Typography>
      
      <Grid container spacing={2}>
        {execution.devices.map((device) => (
          <Grid item xs={12} sm={6} md={4} key={device.device_id}>
            <Card variant="outlined">
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle2" noWrap>
                    {device.device_id}
                  </Typography>
                  <Chip 
                    label={device.status} 
                    color={getStatusColor(device.status) as any}
                    size="small"
                  />
                </Box>
                
                <Box mb={2}>
                  <LinearProgress 
                    variant="determinate" 
                    value={calculateDeviceProgress(device)} 
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {calculateDeviceProgress(device)}% complete
                  </Typography>
                </Box>

                {device.steps && device.steps.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" gutterBottom>
                      Steps ({device.steps.length})
                    </Typography>
                    <List dense sx={{ maxHeight: 150, overflow: 'auto' }}>
                      {device.steps.map((step) => (
                        <ListItem key={step.id} sx={{ py: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            {getStatusIcon(step.status)}
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Typography variant="caption">
                                {step.step_index + 1}. {step.module_id}
                              </Typography>
                            }
                            secondary={
                              step.duration_seconds && (
                                <Typography variant="caption" color="text.secondary">
                                  {step.duration_seconds.toFixed(1)}s
                                </Typography>
                              )
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
}

export default ExecutionProgress;