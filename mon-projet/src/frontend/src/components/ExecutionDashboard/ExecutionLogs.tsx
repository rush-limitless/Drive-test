/**
 * Execution Logs component for displaying real-time execution logs.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  IconButton,
} from '@mui/material';
import {
  Clear as ClearIcon,
  Download as DownloadIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';

import { executionApi, ExecutionLog } from '../../services/executionApi';
import { webSocketService, LogEntry as WebSocketLogEntry } from '../../services/websocket';

interface ExecutionLogsProps {
  backendUrl: string;
  executionId: string;
}

function ExecutionLogs({ backendUrl, executionId }: ExecutionLogsProps) {
  type LogItem = WebSocketLogEntry & Partial<ExecutionLog> & { created_at?: string };
  const [logs, setLogs] = useState<LogItem[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [deviceFilter, setDeviceFilter] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadLogs();
    
    // Subscribe to real-time log updates
    const unsubscribe = webSocketService.subscribeToLogs((logEntry) => {
      if (logEntry.execution_id === executionId) {
        const normalized: LogItem = { ...logEntry, created_at: logEntry.timestamp };
        setLogs(prev => [...prev, normalized]);
      }
    });
    
    return unsubscribe;
  }, [backendUrl, executionId]);

  useEffect(() => {
    // Auto-scroll to bottom when new logs arrive
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    // Apply filters
    let filtered = logs;
    
    if (levelFilter) {
      filtered = filtered.filter(log => log.level === levelFilter);
    }
    
    if (deviceFilter) {
      filtered = filtered.filter(log => log.device_id === deviceFilter);
    }
    
    if (searchFilter) {
      const search = searchFilter.toLowerCase();
      filtered = filtered.filter(log => 
        (log.message || '').toLowerCase().includes(search) ||
        (log.module_id && log.module_id.toLowerCase().includes(search))
      );
    }
    
    setFilteredLogs(filtered);
  }, [logs, levelFilter, deviceFilter, searchFilter]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const logEntries = await executionApi.getExecutionLogs(backendUrl, executionId);
      const normalized = logEntries.map((entry) => ({
        ...entry,
        type: 'log_entry' as const,
        execution_id: entry.execution_id ?? executionId,
        timestamp: entry.created_at
      }));
      setLogs(normalized.reverse()); // Reverse to show oldest first
    } catch (err) {
      console.error('Error loading logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setLevelFilter('');
    setDeviceFilter('');
    setSearchFilter('');
  };

  const exportLogs = () => {
    const logText = filteredLogs
      .map((log) => {
        const timestamp = log.created_at ?? log.timestamp ?? '';
        const level = (log.level || '').toUpperCase();
        const deviceId = log.device_id ?? '';
        const message = log.message ?? '';
        return `[${timestamp}] [${level}] [${deviceId}] ${message}`;
      })
      .join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution-${executionId}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      case 'debug':
        return 'default';
      default:
        return 'default';
    }
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString();
  };

  const uniqueDevices = Array.from(new Set(logs.map(log => log.device_id).filter(Boolean))) as string[];
  const uniqueLevels = Array.from(new Set(logs.map(log => log.level).filter(Boolean))) as string[];

  return (
    <Paper sx={{ p: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">
          Execution Logs ({filteredLogs.length})
        </Typography>
        <Box>
          <IconButton onClick={exportLogs} disabled={filteredLogs.length === 0}>
            <DownloadIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Filters */}
      <Box display="flex" gap={2} mb={2} flexWrap="wrap">
        <TextField
          size="small"
          label="Search"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          sx={{ minWidth: 200 }}
        />
        
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Level</InputLabel>
          <Select
            value={levelFilter}
            label="Level"
            onChange={(e) => setLevelFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {uniqueLevels.map(level => (
              <MenuItem key={level} value={level}>{level}</MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Device</InputLabel>
          <Select
            value={deviceFilter}
            label="Device"
            onChange={(e) => setDeviceFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {uniqueDevices.map(device => (
              <MenuItem key={device} value={device}>{device}</MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <Button
          startIcon={<ClearIcon />}
          onClick={clearFilters}
          disabled={!levelFilter && !deviceFilter && !searchFilter}
        >
          Clear
        </Button>
      </Box>

      {/* Logs List */}
      <Box 
        sx={{ 
          maxHeight: 400, 
          overflow: 'auto',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'grey.50'
        }}
      >
        {filteredLogs.length === 0 ? (
          <Box p={2} textAlign="center">
            <Typography variant="body2" color="text.secondary">
              {loading ? 'Loading logs...' : 'No logs found'}
            </Typography>
          </Box>
        ) : (
          <List dense>
            {filteredLogs.map((log) => (
              <ListItem key={log.id} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                      <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                        {formatTimestamp(log.created_at)}
                      </Typography>
                      <Chip 
                        label={log.level} 
                        color={getLevelColor(log.level) as any}
                        size="small"
                      />
                      <Chip 
                        label={log.device_id} 
                        variant="outlined"
                        size="small"
                      />
                      {log.module_id && (
                        <Chip 
                          label={log.module_id} 
                          variant="outlined"
                          size="small"
                          color="primary"
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Typography 
                      variant="body2" 
                      sx={{ mt: 0.5, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}
                    >
                      {log.message}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
            <div ref={logsEndRef} />
          </List>
        )}
      </Box>
    </Paper>
  );
}

export default ExecutionLogs;