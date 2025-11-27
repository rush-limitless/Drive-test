/**
 * Flow Canvas component for drag-and-drop flow composition.
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Chip,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  ArrowDownward as ArrowIcon,
} from '@mui/icons-material';

interface Module {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: Array<{ name: string; description: string }>;
}

interface FlowModule {
  module_id: string;
  sequence_order: number;
  input_parameters?: any;
  continue_on_failure: boolean;
  retry_count: number;
}

interface FlowCanvasProps {
  modules: FlowModule[];
  availableModules: Module[];
  onRemoveModule: (index: number) => void;
  onReorderModules: (fromIndex: number, toIndex: number) => void;
}

function FlowCanvas({ modules, availableModules, onRemoveModule, onReorderModules }: FlowCanvasProps) {
  const getModuleInfo = (moduleId: string) => {
    return availableModules.find(m => m.id === moduleId);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (dragIndex !== dropIndex) {
      onReorderModules(dragIndex, dropIndex);
    }
  };

  if (modules.length === 0) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight={300}
        border="2px dashed"
        borderColor="grey.300"
        borderRadius={2}
        bgcolor="grey.50"
      >
        <Typography variant="body1" color="text.secondary">
          Drag modules from the palette to build your flow
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {modules.map((flowModule, index) => {
        const moduleInfo = getModuleInfo(flowModule.module_id);
        
        return (
          <Box key={`${flowModule.module_id}-${index}`}>
            <Card
              sx={{ mb: 2, cursor: 'grab' }}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
            >
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box display="flex" alignItems="center" flexGrow={1}>
                    <DragIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Box>
                      <Typography variant="h6" component="div">
                        {index + 1}. {moduleInfo?.name || flowModule.module_id}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {moduleInfo?.description}
                      </Typography>
                      {moduleInfo && (
                        <Chip label={moduleInfo.category} size="small" sx={{ mr: 1 }} />
                      )}
                      {flowModule.continue_on_failure && (
                        <Chip label="Continue on failure" size="small" color="warning" sx={{ mr: 1 }} />
                      )}
                      {flowModule.retry_count > 0 && (
                        <Chip label={`Retry: ${flowModule.retry_count}`} size="small" color="info" />
                      )}
                    </Box>
                  </Box>
                  
                  <IconButton
                    size="small"
                    onClick={() => onRemoveModule(index)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
                
                {moduleInfo && moduleInfo.steps.length > 0 && (
                  <Box mt={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      Steps:
                    </Typography>
                    <List dense>
                      {moduleInfo.steps.map((step, stepIndex) => (
                        <ListItem key={stepIndex} sx={{ py: 0.5 }}>
                          <ListItemText
                            primary={`${stepIndex + 1}. ${step.name}`}
                            secondary={step.description}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </CardContent>
            </Card>
            
            {index < modules.length - 1 && (
              <Box display="flex" justifyContent="center" mb={2}>
                <ArrowIcon color="action" />
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

export default FlowCanvas;