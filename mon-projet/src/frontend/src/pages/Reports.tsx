/**
 * Reports page component.
 */

import React, { useEffect, useState } from 'react';
import {
  Typography,
  Box,
  Grid,
  Paper,
  CircularProgress,
  Alert,
  Divider,
  Stack,
  Chip,
} from '@mui/material';

import { reportApi, ReportSummary } from '../services/reportApi';

interface ReportsProps {
  backendUrl: string;
}

const formatDuration = (seconds: number | null): string => {
  if (!seconds || Number.isNaN(seconds)) {
    return 'N/A';
  }

  if (seconds < 60) {
    return `${Math.round(seconds)} s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) {
    return `${minutes} min ${remainingSeconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} h ${remainingMinutes} min`;
};

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return 'N/A';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

function Reports({ backendUrl }: ReportsProps) {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!backendUrl) {
      return;
    }

    const fetchSummary = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await reportApi.getSummary(backendUrl);
        setSummary(data);
      } catch (err) {
        console.error('Failed to load report summary', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load report summary'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [backendUrl]);

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Reporting & Analytics
      </Typography>

      {!backendUrl && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Backend URL is not configured. Please connect the application to the backend.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box display="flex" alignItems="center" gap={2} sx={{ mb: 3 }}>
          <CircularProgress size={24} />
          <Typography variant="body1">Loading summary…</Typography>
        </Box>
      )}

      {summary && !loading && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Total Executions
              </Typography>
              <Typography variant="h4" component="p">
                {summary.total_executions}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Executions recorded for the selected period
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Success Rate
              </Typography>
              <Typography variant="h4" component="p">
                {summary.success_rate.toFixed(2)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Percentage of executions completed successfully
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Avg. Duration
              </Typography>
              <Typography variant="h4" component="p">
                {formatDuration(summary.average_duration_seconds)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Average execution time
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Devices Covered
              </Typography>
              <Typography variant="h4" component="p">
                {summary.device_coverage}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Unique devices involved in executions
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Status Breakdown
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={`Pending: ${summary.status_breakdown.pending}`} />
                <Chip label={`Running: ${summary.status_breakdown.running}`} />
                <Chip
                  label={`Completed: ${summary.status_breakdown.completed}`}
                  color="success"
                />
                <Chip
                  label={`Failed: ${summary.status_breakdown.failed}`}
                  color="error"
                />
                <Chip
                  label={`Cancelled: ${summary.status_breakdown.cancelled}`}
                  color="warning"
                />
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Activity Highlights
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="subtitle2">
                    Executions (last 7 days)
                  </Typography>
                  <Typography variant="body1">
                    {summary.executions_last_7_days}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2">
                    Last Execution
                  </Typography>
                  <Typography variant="body1">
                    {formatDateTime(summary.last_execution_at)}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}

      {!loading && !summary && backendUrl && !error && (
        <Alert severity="info">
          No executions available yet. Once tests have been run, you will see analytics here.
        </Alert>
      )}
    </Box>
  );
}

export default Reports;
