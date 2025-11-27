/**
 * Flow Builder component for creating and editing automation flows.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Fade,
  Zoom,
} from '@mui/material';
import { 
  Add as AddIcon, 
  Save as SaveIcon, 
  PlayArrow as ExecuteIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
  AutoAwesome as MagicIcon
} from '@mui/icons-material';

import FlowCanvas from './FlowCanvas';
import { flowApi } from '../../services/flowApi';
import { moduleApi } from '../../services/moduleApi';

interface Module {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: Array<{ name: string; description: string }>;
  input_schema: any;
  timeout_seconds: number;
}

interface FlowModule {
  module_id: string;
  sequence_order: number;
  input_parameters?: any;
  continue_on_failure: boolean;
  retry_count: number;
}

interface Flow {
  id?: string;
  name: string;
  description?: string;
  visibility: string;
  modules: FlowModule[];
}

interface FlowBuilderProps {
  backendUrl: string;
  flowId?: string;
  onFlowSaved?: (flow: any) => void;
  onFlowExecuted?: (execution: any) => void;
}

function FlowBuilder({ backendUrl, flowId, onFlowSaved, onFlowExecuted }: FlowBuilderProps) {
  const [flow, setFlow] = useState<Flow>({
    name: '',
    description: '',
    visibility: 'private',
    modules: []
  });
  const [availableModules, setAvailableModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);

  useEffect(() => {
    loadAvailableModules();
    if (flowId) {
      loadFlow(flowId);
    }
  }, [backendUrl, flowId]);

  const loadAvailableModules = async () => {
    try {
      const modules = await moduleApi.getModules(backendUrl);
      setAvailableModules(modules);
    } catch (err) {
      setError('Failed to load available modules');
      console.error('Error loading modules:', err);
    }
  };

  const loadFlow = async (id: string) => {
    try {
      setLoading(true);
      const flowData = await flowApi.getFlow(backendUrl, id);
      setFlow(flowData);
    } catch (err) {
      setError('Failed to load flow');
      console.error('Error loading flow:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddModule = (moduleId: string) => {
    const module = availableModules.find(m => m.id === moduleId);
    if (!module) return;

    const newFlowModule: FlowModule = {
      module_id: moduleId,
      sequence_order: flow.modules.length + 1,
      input_parameters: {},
      continue_on_failure: false,
      retry_count: 0
    };

    setFlow(prev => ({
      ...prev,
      modules: [...prev.modules, newFlowModule]
    }));
  };

  const handleRemoveModule = (index: number) => {
    setFlow(prev => ({
      ...prev,
      modules: prev.modules.filter((_, i) => i !== index).map((module, i) => ({
        ...module,
        sequence_order: i + 1
      }))
    }));
  };

  const handleReorderModules = (fromIndex: number, toIndex: number) => {
    const newModules = [...flow.modules];
    const [movedModule] = newModules.splice(fromIndex, 1);
    newModules.splice(toIndex, 0, movedModule);
    
    // Update sequence orders
    const reorderedModules = newModules.map((module, index) => ({
      ...module,
      sequence_order: index + 1
    }));

    setFlow(prev => ({
      ...prev,
      modules: reorderedModules
    }));
  };

  const handleSaveFlow = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!flow.name.trim()) {
        setError('Flow name is required');
        return;
      }

      if (flow.modules.length === 0) {
        setError('Flow must contain at least one module');
        return;
      }

      let savedFlow;
      if (flowId) {
        savedFlow = await flowApi.updateFlow(backendUrl, flowId, flow);
      } else {
        savedFlow = await flowApi.createFlow(backendUrl, flow);
      }

      setSaveDialogOpen(false);
      if (onFlowSaved) {
        onFlowSaved(savedFlow);
      }
    } catch (err) {
      setError('Failed to save flow');
      console.error('Error saving flow:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteFlow = async (deviceIds: string[]) => {
    try {
      setLoading(true);
      setError(null);

      if (!flowId) {
        setError('Flow must be saved before execution');
        return;
      }

      const execution = await flowApi.executeFlow(backendUrl, flowId, deviceIds);
      setExecuteDialogOpen(false);
      
      if (onFlowExecuted) {
        onFlowExecuted(execution);
      }
    } catch (err) {
      setError('Failed to execute flow');
      console.error('Error executing flow:', err);
    } finally {
      setLoading(false);
    }
  };

  const getModuleInfo = (moduleId: string) => {
    return availableModules.find(m => m.id === moduleId);
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: 3,
      position: 'relative'
    }}>
      {/* Background Pattern */}
      <Box sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        pointerEvents: 'none'
      }} />
      
      {/* Header */}
      <Fade in timeout={800}>
        <Card sx={{ 
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          mb: 4,
          position: 'relative',
          zIndex: 1
        }}>
          <CardContent sx={{ p: 4 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box display="flex" alignItems="center" gap={2}>
                <Box sx={{
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  borderRadius: '16px',
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <MagicIcon sx={{ color: 'white', fontSize: 32 }} />
                </Box>
                <Box>
                  <Typography variant="h4" sx={{
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>
                    {flowId ? 'Edit Workflow' : 'Create Workflow'}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Build powerful automation sequences with drag & drop
                  </Typography>
                </Box>
              </Box>
              <Box display="flex" gap={2}>
                <Button
                  variant="outlined"
                  startIcon={<SaveIcon />}
                  onClick={() => setSaveDialogOpen(true)}
                  disabled={loading}
                  sx={{
                    borderRadius: '12px',
                    px: 3,
                    py: 1.5,
                    borderColor: 'rgba(102, 126, 234, 0.3)',
                    color: '#667eea',
                    '&:hover': {
                      borderColor: '#667eea',
                      background: 'rgba(102, 126, 234, 0.1)'
                    }
                  }}
                >
                  Save Workflow
                </Button>
                {flowId && (
                  <Button
                    variant="contained"
                    startIcon={<ExecuteIcon />}
                    onClick={() => setExecuteDialogOpen(true)}
                    disabled={loading}
                    sx={{
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      borderRadius: '12px',
                      px: 3,
                      py: 1.5,
                      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 25px rgba(102, 126, 234, 0.6)'
                      }
                    }}
                  >
                    Execute Workflow
                  </Button>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Fade>

      {error && (
        <Zoom in timeout={500}>
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3,
              borderRadius: '16px',
              background: 'rgba(244, 67, 54, 0.1)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(244, 67, 54, 0.2)'
            }} 
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        </Zoom>
      )}

      <Grid container spacing={4}>
        {/* Module Palette */}
        <Grid item xs={12} md={4}>
          <Fade in timeout={1000}>
            <Card sx={{ 
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(20px)',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              height: 'fit-content',
              position: 'relative',
              zIndex: 1
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" gap={2} mb={3}>
                  <TimelineIcon sx={{ color: '#667eea', fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
                    Module Library
                  </Typography>
                </Box>
                {availableModules.map((module, index) => (
                  <Zoom in timeout={300 + index * 100} key={module.id}>
                    <Card sx={{
                      mb: 2,
                      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05), rgba(118, 75, 162, 0.05))',
                      border: '1px solid rgba(102, 126, 234, 0.1)',
                      borderRadius: '16px',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'pointer',
                      '&:hover': {
                        transform: 'translateY(-4px) scale(1.02)',
                        boxShadow: '0 12px 24px rgba(102, 126, 234, 0.2)',
                        borderColor: 'rgba(102, 126, 234, 0.3)'
                      }
                    }}>
                      <CardContent sx={{ p: 2 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                            {module.name}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => handleAddModule(module.id)}
                            sx={{
                              background: 'linear-gradient(135deg, #667eea, #764ba2)',
                              color: 'white',
                              width: 32,
                              height: 32,
                              '&:hover': {
                                transform: 'scale(1.1)',
                                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                              }
                            }}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                          {module.description}
                        </Typography>
                        <Chip 
                          label={module.category} 
                          size="small" 
                          sx={{
                            background: 'rgba(102, 126, 234, 0.1)',
                            color: '#667eea',
                            fontWeight: 600,
                            fontSize: '0.7rem'
                          }}
                        />
                      </CardContent>
                    </Card>
                  </Zoom>
                ))}
              </CardContent>
            </Card>
          </Fade>
        </Grid>

        {/* Flow Canvas */}
        <Grid item xs={12} md={8}>
          <Fade in timeout={1200}>
            <Card sx={{ 
              background: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(20px)',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
              minHeight: 500,
              position: 'relative',
              zIndex: 1
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" gap={2} mb={3}>
                  <SettingsIcon sx={{ color: '#667eea', fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
                    Workflow Designer
                  </Typography>
                </Box>
                
                {flow.modules.length === 0 ? (
                  <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 300,
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05), rgba(118, 75, 162, 0.05))',
                    borderRadius: '16px',
                    border: '2px dashed rgba(102, 126, 234, 0.2)',
                    textAlign: 'center'
                  }}>
                    <MagicIcon sx={{ fontSize: 64, color: 'rgba(102, 126, 234, 0.3)', mb: 2 }} />
                    <Typography variant="h6" sx={{ color: '#64748b', mb: 1 }}>
                      Start Building Your Workflow
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Drag modules from the library to create your automation sequence
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    {flow.modules.map((flowModule, index) => {
                      const moduleInfo = getModuleInfo(flowModule.module_id);
                      return (
                        <Zoom in timeout={200 + index * 100} key={index}>
                          <Card sx={{
                            mb: 2,
                            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.9))',
                            border: '1px solid rgba(102, 126, 234, 0.2)',
                            borderRadius: '16px',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            position: 'relative',
                            overflow: 'hidden',
                            '&:hover': {
                              transform: 'translateX(8px)',
                              boxShadow: '0 8px 24px rgba(102, 126, 234, 0.2)',
                              borderColor: 'rgba(102, 126, 234, 0.4)'
                            }
                          }}>
                            {/* Step Number */}
                            <Box sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: 40,
                              height: 40,
                              background: 'linear-gradient(135deg, #667eea, #764ba2)',
                              borderRadius: '0 0 16px 0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontWeight: 700,
                              fontSize: '0.9rem'
                            }}>
                              {index + 1}
                            </Box>
                            
                            <CardContent sx={{ p: 3, pl: 6 }}>
                              <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Box flex={1}>
                                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 0.5 }}>
                                    {moduleInfo?.name || flowModule.module_id}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    {moduleInfo?.description}
                                  </Typography>
                                  <Box display="flex" gap={1}>
                                    <Chip 
                                      label={moduleInfo?.category || 'Unknown'} 
                                      size="small"
                                      sx={{
                                        background: 'rgba(102, 126, 234, 0.1)',
                                        color: '#667eea',
                                        fontWeight: 600
                                      }}
                                    />
                                    {flowModule.continue_on_failure && (
                                      <Chip 
                                        label="Continue on Failure" 
                                        size="small"
                                        sx={{
                                          background: 'rgba(245, 158, 11, 0.1)',
                                          color: '#f59e0b'
                                        }}
                                      />
                                    )}
                                  </Box>
                                </Box>
                                <Box display="flex" alignItems="center" gap={1}>
                                  <Tooltip title="Drag to reorder">
                                    <IconButton size="small" sx={{ color: '#64748b' }}>
                                      <DragIcon />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Remove module">
                                    <IconButton 
                                      size="small" 
                                      onClick={() => handleRemoveModule(index)}
                                      sx={{ 
                                        color: '#ef4444',
                                        '&:hover': {
                                          background: 'rgba(239, 68, 68, 0.1)'
                                        }
                                      }}
                                    >
                                      <DeleteIcon />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </Box>
                            </CardContent>
                            
                            {/* Connection Line */}
                            {index < flow.modules.length - 1 && (
                              <Box sx={{
                                position: 'absolute',
                                bottom: -16,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: 2,
                                height: 16,
                                background: 'linear-gradient(180deg, #667eea, #764ba2)',
                                zIndex: 1
                              }} />
                            )}
                          </Card>
                        </Zoom>
                      );
                    })}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Fade>
        </Grid>
      </Grid>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Save Flow</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Flow Name"
            fullWidth
            variant="outlined"
            value={flow.name}
            onChange={(e) => setFlow(prev => ({ ...prev, name: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={flow.description}
            onChange={(e) => setFlow(prev => ({ ...prev, description: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveFlow} variant="contained" disabled={loading}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default FlowBuilder;