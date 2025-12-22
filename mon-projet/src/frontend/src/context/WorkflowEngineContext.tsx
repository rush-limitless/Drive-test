import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ModuleMetadata } from '../data/modules';
import {
  StoredWorkflow,
  recordWorkflowRun,
  updateStoredWorkflow,
} from '../utils/workflows';
import { recordDeviceWorkflowRun } from '../utils/deviceHistory';
import { recordDeviceActivity } from '../utils/deviceActivity';
import { fetchWithRetry } from '../services/utils';
import {
  buildModuleParametersForDevice,
  resolveModuleExecutionId,
  isWaitingModule,
  sanitizeWaitDurationSeconds,
  sleep,
} from '../utils/workflowHelpers';

type SnackbarSeverity = 'success' | 'info' | 'warning' | 'error';

interface StartWorkflowOptions {
  workflow: StoredWorkflow;
  deviceIds: string[];
  backendUrl: string;
  repeatCount: number;
  durationSeconds: number;
  workflowSummary: string;
  durationUnitLabel: string;
  onStatusMessage?: (payload: { severity: SnackbarSeverity; message: string }) => void;
}

interface WorkflowEngineContextValue {
  runningWorkflows: Record<string, boolean>;
  workflowActiveModuleIndex: Record<string, number | null>;
  workflowCompletedModules: Record<string, number[]>;
  workflowRunStatus: Record<string, string>;
  workflowPauseRequests: Record<string, boolean>;
  startWorkflow: (options: StartWorkflowOptions) => Promise<void>;
  stopWorkflow: (workflowId: string) => void;
  pauseWorkflow: (workflowId: string) => void;
  resumeWorkflow: (workflowId: string) => void;
  isWorkflowPaused: (workflowId: string) => boolean;
}

const WorkflowEngineContext = createContext<WorkflowEngineContextValue | undefined>(undefined);

export const WorkflowEngineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [runningWorkflows, setRunningWorkflows] = useState<Record<string, boolean>>({});
  const [workflowActiveModuleIndex, setWorkflowActiveModuleIndex] = useState<Record<string, number | null>>({});
  const [workflowCompletedModules, setWorkflowCompletedModules] = useState<Record<string, number[]>>({});
  const [workflowRunStatus, setWorkflowRunStatus] = useState<Record<string, string>>({});
  const [workflowPauseRequests, setWorkflowPauseRequests] = useState<Record<string, boolean>>({});
  const [workflowCancelRequests, setWorkflowCancelRequests] = useState<Record<string, boolean>>({});

  const pauseRef = useRef<Record<string, boolean>>({});
  const workflowCancelControllers = useRef<Record<string, AbortController>>({});
  const cancelRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    pauseRef.current = workflowPauseRequests;
  }, [workflowPauseRequests]);

  useEffect(() => {
    cancelRef.current = workflowCancelRequests;
  }, [workflowCancelRequests]);

  const setWorkflowPaused = useCallback((workflowId: string, paused: boolean) => {
    setWorkflowPauseRequests((prev) => {
      const next = { ...prev };
      if (paused) {
        next[workflowId] = true;
      } else {
        delete next[workflowId];
      }
      return next;
    });
  }, []);

  const isWorkflowPaused = useCallback((workflowId: string) => Boolean(workflowPauseRequests[workflowId]), [workflowPauseRequests]);

  const markWorkflowCancelled = useCallback((workflowId: string) => {
    setWorkflowCancelRequests((prev) => ({ ...prev, [workflowId]: true }));
  }, []);

  const clearWorkflowCancellation = useCallback((workflowId: string) => {
    setWorkflowCancelRequests((prev) => {
      const next = { ...prev };
      delete next[workflowId];
      return next;
    });
    if (workflowCancelControllers.current[workflowId]) {
      delete workflowCancelControllers.current[workflowId];
    }
  }, []);

  const stopWorkflow = useCallback((workflowId: string) => {
    markWorkflowCancelled(workflowId);
    setWorkflowPaused(workflowId, false);
    const controller = workflowCancelControllers.current[workflowId];
    if (controller) {
      controller.abort();
    }
  }, [markWorkflowCancelled, setWorkflowPaused]);

  const executeModuleForDevices = useCallback(
    async (
      workflow: StoredWorkflow,
      module: ModuleMetadata,
      deviceIds: string[],
      normalizedBackendUrl: string,
      repeatCountMeta: number,
      durationSecondsMeta: number,
      runIteration: number,
      abortSignal?: AbortSignal
    ) => {
      if (isWaitingModule(module)) {
        const waitSeconds = sanitizeWaitDurationSeconds(module.waitDurationSeconds);
        if (waitSeconds > 0) {
          await sleep(waitSeconds * 1000);
        }
        return { successes: deviceIds, failures: [] };
      }
      const apiModuleId = resolveModuleExecutionId(module.id);
      if (!apiModuleId) {
        return {
          successes: [],
          failures: deviceIds.map((deviceId) => ({
            deviceId,
            reason: `Module "${module.name}" not supported for workflows.`,
          })),
        };
      }

      const results = await Promise.allSettled(
        deviceIds.map(async (deviceId) => {
          if (abortSignal?.aborted) {
            throw { deviceId, message: 'Execution cancelled' };
          }

          const parameters = buildModuleParametersForDevice(module, deviceId) ?? {};
          try {
            const response = await fetchWithRetry(`${normalizedBackendUrl}/api/modules/${apiModuleId}/execute`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                device_id: deviceId,
                parameters,
                workflow_id: workflow.id,
                workflow_name: workflow.name,
                module_id: module.id,
                repeat_count: repeatCountMeta,
                duration_seconds: durationSecondsMeta,
                run_iteration: runIteration,
              }),
              signal: abortSignal,
            });

            if (!response.ok) {
              const text = await response.text();
              throw { deviceId, message: text || `Backend failure (HTTP ${response.status})` };
            }

            const data = await response.json();
            const dataStatus = typeof data.status === 'string' ? data.status.toLowerCase() : 'completed';
            const success =
              typeof data.success === 'boolean' ? data.success : dataStatus !== 'failed' && dataStatus !== 'error';

            if (!success) {
              const reason = data.error || data.message || `Module "${module.name}" failed`;
              throw { deviceId, message: reason };
            }

            return { deviceId, data };
          } catch (error: any) {
            if (error?.name === 'AbortError') {
              throw { deviceId, message: 'Execution cancelled' };
            }
            throw error;
          }
        })
      );

      const successes: string[] = [];
      const failures: { deviceId: string; reason: string }[] = [];

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          successes.push(result.value.deviceId);
        } else {
          const deviceId = (result.reason && result.reason.deviceId) || 'unknown';
          const reason =
            (result.reason && result.reason.message) ||
            (result.reason instanceof Error ? result.reason.message : `Module "${module.name}" execution failed.`);
          failures.push({ deviceId, reason });
        }
      });

      return { successes, failures };
    },
    []
  );

  const startWorkflow = useCallback(async (options: StartWorkflowOptions) => {
    const {
      workflow,
      deviceIds,
      backendUrl,
      repeatCount,
      durationSeconds,
      workflowSummary,
      durationUnitLabel,
      onStatusMessage,
    } = options;

    if (!backendUrl) {
      onStatusMessage?.({ severity: 'error', message: 'Backend unavailable: no URL configured.' });
      return;
    }

    if (deviceIds.length === 0) {
      onStatusMessage?.({
        severity: 'error',
        message: 'Select one or more devices on the dashboard before running a workflow.',
      });
      return;
    }

    const normalizedBackendUrl = backendUrl.replace(/\/$/, '');

    if (workflowCancelControllers.current[workflow.id]) {
      workflowCancelControllers.current[workflow.id].abort();
      delete workflowCancelControllers.current[workflow.id];
    }

    const workflowController = new AbortController();
    workflowCancelControllers.current[workflow.id] = workflowController;
    setWorkflowCancelRequests((prev) => ({ ...prev, [workflow.id]: false }));

    setRunningWorkflows((prev) => ({ ...prev, [workflow.id]: true }));
    setWorkflowActiveModuleIndex((prev) => ({
      ...prev,
      [workflow.id]: workflow.modules.length > 0 ? 0 : null,
    }));
    setWorkflowCompletedModules((prev) => ({ ...prev, [workflow.id]: [] }));
    setWorkflowRunStatus((prev) => ({
      ...prev,
      [workflow.id]: `Planning workflow (${workflowSummary}) for ${deviceIds.length} device${deviceIds.length === 1 ? '' : 's'}…`,
    }));
    onStatusMessage?.({
      severity: 'info',
      message: `Workflow "${workflow.name}" started (${workflowSummary}).`,
    });

    const sessionStart = Date.now();
    const durationWindowMs = durationSeconds * 1000;
    let runCounter = 0;
    let cancelled = false;

    const waitWhilePaused = async () => {
      if (!pauseRef.current[workflow.id]) {
        return;
      }
      setWorkflowRunStatus((prev) => ({
        ...prev,
        [workflow.id]: `Workflow "${workflow.name}" paused. Click resume to continue.`,
      }));
      while (pauseRef.current[workflow.id]) {
        await sleep(500);
      }
      setWorkflowRunStatus((prev) => ({
        ...prev,
        [workflow.id]: `Resuming workflow "${workflow.name}"…`,
      }));
    };

    const isWorkflowCancelledLocal = () => cancelRef.current[workflow.id] === true;

    try {
      while (true) {
        await waitWhilePaused();
        if (isWorkflowCancelledLocal()) {
          cancelled = true;
          break;
        }

        runCounter += 1;
        const runLabel = `Run #${runCounter}`;

        setWorkflowCompletedModules((prev) => ({ ...prev, [workflow.id]: [] }));
        setWorkflowActiveModuleIndex((prev) => ({
          ...prev,
          [workflow.id]: workflow.modules.length > 0 ? 0 : null,
        }));
        setWorkflowRunStatus((prev) => ({
          ...prev,
          [workflow.id]: `Starting ${runLabel} (${workflowSummary}) on ${deviceIds.length} device${deviceIds.length === 1 ? '' : 's'}…`,
        }));

        const deviceOutcomes: Record<string, { success: boolean; reasons: string[] }> = {};
        deviceIds.forEach((deviceId) => {
          deviceOutcomes[deviceId] = { success: true, reasons: [] };
        });

        for (let index = 0; index < workflow.modules.length; index += 1) {
          await waitWhilePaused();
          if (isWorkflowCancelledLocal()) {
            cancelled = true;
            break;
          }
          const module = workflow.modules[index];
          setWorkflowActiveModuleIndex((prev) => ({ ...prev, [workflow.id]: index }));
          setWorkflowRunStatus((prev) => ({
            ...prev,
            [workflow.id]: `${runLabel}: running "${module.name}" on ${deviceIds.length} device${deviceIds.length === 1 ? '' : 's'}…`,
          }));

          const { failures } = await executeModuleForDevices(
            workflow,
            module,
            deviceIds,
            normalizedBackendUrl,
            repeatCount,
            durationSeconds,
            runCounter,
            workflowController.signal
          );

          failures.forEach(({ deviceId, reason }) => {
            if (!deviceOutcomes[deviceId]) {
              deviceOutcomes[deviceId] = { success: false, reasons: [reason] };
            } else {
              deviceOutcomes[deviceId].success = false;
              deviceOutcomes[deviceId].reasons.push(`${module.name}: ${reason}`);
            }
          });

          setWorkflowCompletedModules((prev) => {
            const previous = prev[workflow.id] || [];
            if (previous.includes(index)) {
              return prev;
            }
            return {
              ...prev,
              [workflow.id]: [...previous, index],
            };
          });

          const nextModule = workflow.modules[index + 1];
          const shouldDelayBeforeNext =
            index < workflow.modules.length - 1 &&
            !isWaitingModule(module) &&
            !isWaitingModule(nextModule);
          if (shouldDelayBeforeNext) {
            await sleep(2000);
          }
        }

        if (cancelled) {
          break;
        }

        const successes = deviceIds.filter((deviceId) => deviceOutcomes[deviceId]?.success !== false);
        const failedDevices = deviceIds
          .filter((deviceId) => deviceOutcomes[deviceId]?.success === false)
          .map((deviceId) => ({
            deviceId,
            reason: deviceOutcomes[deviceId].reasons.join(' | ') || 'Execution failed.',
          }));

        const timestamp = new Date().toISOString();
        if (successes.length > 0) {
          recordWorkflowRun(workflow.id, timestamp);
          successes.forEach((deviceId) => recordDeviceWorkflowRun(deviceId, workflow.id, workflow.name, timestamp));
        } else {
          updateStoredWorkflow(workflow.id, { lastRunAt: timestamp });
        }
        successes.forEach((deviceId) =>
          recordDeviceActivity({
            deviceId,
            type: 'workflow',
            label: workflow.name,
            status: 'success',
            referenceId: workflow.id,
            timestamp,
          })
        );
        failedDevices.forEach(({ deviceId, reason }) =>
          recordDeviceActivity({
            deviceId,
            type: 'workflow',
            label: workflow.name,
            status: 'failure',
            referenceId: workflow.id,
            timestamp,
            details: reason,
          })
        );

        if (failedDevices.length === 0) {
          setWorkflowRunStatus((prev) => ({
            ...prev,
            [workflow.id]: `${runLabel} completed successfully.`,
          }));
        } else {
          setWorkflowRunStatus((prev) => ({
            ...prev,
            [workflow.id]: `${runLabel} completed with ${failedDevices.length} failure${failedDevices.length === 1 ? '' : 's'}.`,
          }));
        }

        onStatusMessage?.({
          severity: failedDevices.length === 0 ? 'success' : 'warning',
          message:
            failedDevices.length === 0
              ? `Workflow "${workflow.name}" completed successfully on ${successes.length} device(s).`
              : `Workflow "${workflow.name}" finished with ${failedDevices.length} failure(s).`,
        });

        if (repeatCount > 0 && runCounter >= repeatCount) {
          break;
        }

        if (durationSeconds > 0 && Date.now() - sessionStart >= durationWindowMs) {
          setWorkflowRunStatus((prev) => ({
            ...prev,
            [workflow.id]: `Workflow duration window (${durationSeconds} ${durationUnitLabel}) reached. Stopping.`,
          }));
          break;
        }
      }
    } catch (error) {
      console.error('[WorkflowEngine] Workflow execution failed', error);
      onStatusMessage?.({
        severity: 'error',
        message: `Workflow "${workflow.name}" failed: ${
          error instanceof Error ? error.message : 'Unknown error occurred.'
        }`,
      });
    } finally {
      setRunningWorkflows((prev) => ({ ...prev, [workflow.id]: false }));
      setWorkflowPaused(workflow.id, false);
      clearWorkflowCancellation(workflow.id);
      setWorkflowActiveModuleIndex((prev) => ({ ...prev, [workflow.id]: null }));
    }
  }, [
    clearWorkflowCancellation,
    executeModuleForDevices,
    markWorkflowCancelled,
    setWorkflowPaused,
    workflowCancelRequests,
  ]);

  const value = useMemo(
    () => ({
      runningWorkflows,
      workflowActiveModuleIndex,
      workflowCompletedModules,
      workflowRunStatus,
      workflowPauseRequests,
      startWorkflow,
      stopWorkflow,
      pauseWorkflow: (workflowId: string) => setWorkflowPaused(workflowId, true),
      resumeWorkflow: (workflowId: string) => setWorkflowPaused(workflowId, false),
      isWorkflowPaused,
    }),
    [
      runningWorkflows,
      workflowActiveModuleIndex,
      workflowCompletedModules,
      workflowRunStatus,
      workflowPauseRequests,
      startWorkflow,
      stopWorkflow,
      setWorkflowPaused,
      isWorkflowPaused,
    ]
  );

  return <WorkflowEngineContext.Provider value={value}>{children}</WorkflowEngineContext.Provider>;
};

export const useWorkflowEngine = (): WorkflowEngineContextValue => {
  const context = useContext(WorkflowEngineContext);
  if (!context) {
    throw new Error('useWorkflowEngine must be used within a WorkflowEngineProvider');
  }
  return context;
};
