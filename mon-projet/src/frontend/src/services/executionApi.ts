/**
 * Execution API service for managing flow executions.
 */

import axios from 'axios';

export interface ExecutionDevice {
  device_id: string;
  status: string;
  start_time?: string;
  end_time?: string;
  duration_seconds?: number;
  error_message?: string;
}

export interface Execution {
  id: string;
  flow_id: string;
  status: string;
  start_time?: string;
  end_time?: string;
  duration_seconds?: number;
  progress_percentage: number;
  current_step?: string;
  error_message?: string;
  artifacts_path?: string;
  report_generated: boolean;
  device_count: number;
  devices: ExecutionDevice[];
  created_at: string;
  updated_at: string;
}

export interface ExecutionLog {
  id: string;
  device_id: string;
  level: string;
  message: string;
  event_type?: string;
  execution_id?: string;
  module_id?: string;
  metadata?: string;
  created_at: string;
}

export interface ExecutionArtifact {
  name: string;
  path: string;
  size: number;
  modified: string;
  type: 'screenshot' | 'log' | 'other';
}

class ExecutionApiService {
  private getApiUrl(backendUrl: string): string {
    return `${backendUrl}/api/v1/executions`;
  }

  private normalizeExecutionDevice(raw: any): ExecutionDevice {
    return {
      device_id: raw?.device_id ?? raw?.id ?? 'unknown-device',
      status: raw?.status ?? 'unknown',
      start_time: raw?.start_time ?? raw?.started_at ?? undefined,
      end_time: raw?.end_time ?? raw?.completed_at ?? undefined,
      duration_seconds: raw?.duration_seconds ?? undefined,
      error_message: raw?.error_message ?? undefined,
    };
  }

  private normalizeExecution(raw: any): Execution {
    const devicesArray = Array.isArray(raw?.devices)
      ? raw.devices.map((device: any) => this.normalizeExecutionDevice(device))
      : raw?.device_id
        ? [this.normalizeExecutionDevice({ device_id: raw.device_id, status: raw?.status })]
        : [];

    const progress = raw?.progress_percentage ?? raw?.progress ?? 0;

    return {
      id: raw?.id ?? 'unknown-execution',
      flow_id: raw?.flow_id ?? raw?.workflow_id ?? 'unknown-flow',
      status: raw?.status ?? 'unknown',
      start_time: raw?.start_time ?? raw?.started_at ?? undefined,
      end_time: raw?.end_time ?? raw?.completed_at ?? undefined,
      duration_seconds: raw?.duration_seconds ?? undefined,
      progress_percentage: typeof progress === 'number' ? progress : Number(progress) || 0,
      current_step: raw?.current_step ?? undefined,
      error_message: raw?.error_message ?? raw?.error ?? undefined,
      artifacts_path: raw?.artifacts_path ?? undefined,
      report_generated: Boolean(raw?.report_generated),
      device_count: raw?.device_count ?? devicesArray.length,
      devices: devicesArray,
      created_at: raw?.created_at ?? raw?.started_at ?? new Date().toISOString(),
      updated_at: raw?.updated_at ?? raw?.completed_at ?? new Date().toISOString(),
    };
  }

  private normalizeExecutionLog(raw: any, executionId: string): ExecutionLog {
    return {
      id: raw?.id ?? `${executionId}-${raw?.timestamp ?? Date.now()}`,
      device_id: raw?.device_id ?? 'unknown-device',
      level: raw?.level ?? 'info',
      message: raw?.message ?? '',
      event_type: raw?.event_type ?? undefined,
      execution_id: raw?.execution_id ?? executionId,
      module_id: raw?.module_id ?? undefined,
      metadata: raw?.metadata ?? undefined,
      created_at: raw?.created_at ?? raw?.timestamp ?? new Date().toISOString(),
    };
  }

  async getExecutions(
    backendUrl: string, 
    status?: string, 
    flowId?: string, 
    limit: number = 50
  ): Promise<Execution[]> {
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (flowId) params.append('flow_id', flowId);
      params.append('limit', limit.toString());

      const response = await axios.get(`${this.getApiUrl(backendUrl)}?${params.toString()}`);
      const data = response.data;
      if (Array.isArray(data)) {
        return data.map((item) => this.normalizeExecution(item));
      }
      if (data && Array.isArray(data.executions)) {
        return data.executions.map((item: any) => this.normalizeExecution(item));
      }
      return [];
    } catch (error) {
      console.error('Error fetching executions:', error);
      throw new Error('Failed to fetch executions');
    }
  }

  async getExecution(backendUrl: string, executionId: string): Promise<Execution> {
    try {
      const response = await axios.get(`${this.getApiUrl(backendUrl)}/${executionId}`);
      return this.normalizeExecution(response.data);
    } catch (error) {
      console.error(`Error fetching execution ${executionId}:`, error);
      throw new Error(`Failed to fetch execution ${executionId}`);
    }
  }

  async cancelExecution(backendUrl: string, executionId: string): Promise<void> {
    try {
      await axios.post(`${this.getApiUrl(backendUrl)}/${executionId}/cancel`);
    } catch (error) {
      console.error(`Error cancelling execution ${executionId}:`, error);
      throw new Error(`Failed to cancel execution ${executionId}`);
    }
  }

  async getExecutionStatus(backendUrl: string, executionId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.getApiUrl(backendUrl)}/${executionId}/status`);
      return response.data;
    } catch (error) {
      console.error(`Error getting execution status ${executionId}:`, error);
      throw new Error(`Failed to get execution status ${executionId}`);
    }
  }

  async getExecutionLogs(
    backendUrl: string, 
    executionId: string, 
    deviceId?: string, 
    limit: number = 100
  ): Promise<ExecutionLog[]> {
    try {
      const params = new URLSearchParams();
      if (deviceId) params.append('device_id', deviceId);
      params.append('limit', limit.toString());

      const response = await axios.get(
        `${this.getApiUrl(backendUrl)}/${executionId}/logs?${params.toString()}`
      );
      const data = response.data;
      if (Array.isArray(data)) {
        return data.map((item) => this.normalizeExecutionLog(item, executionId));
      }
      if (data && Array.isArray(data.logs)) {
        return data.logs.map((item: any) => this.normalizeExecutionLog(item, executionId));
      }
      return [];
    } catch (error) {
      console.error(`Error fetching execution logs ${executionId}:`, error);
      throw new Error(`Failed to fetch execution logs ${executionId}`);
    }
  }

  async getExecutionArtifacts(backendUrl: string, executionId: string): Promise<{
    execution_id: string;
    artifacts_path: string;
    artifact_count: number;
    artifacts: ExecutionArtifact[];
  }> {
    try {
      const response = await axios.get(`${this.getApiUrl(backendUrl)}/${executionId}/artifacts`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching execution artifacts ${executionId}:`, error);
      throw new Error(`Failed to fetch execution artifacts ${executionId}`);
    }
  }

  // Utility methods
  isExecutionActive(execution: Execution): boolean {
    return execution.status === 'pending' || execution.status === 'running';
  }

  isExecutionFinished(execution: Execution): boolean {
    return ['completed', 'failed', 'cancelled'].includes(execution.status);
  }

  getExecutionDuration(execution: Execution): number | null {
    if (!execution.start_time) return null;
    
    const start = new Date(execution.start_time);
    const end = execution.end_time ? new Date(execution.end_time) : new Date();
    
    return Math.floor((end.getTime() - start.getTime()) / 1000);
  }

  formatExecutionDuration(execution: Execution): string {
    const duration = this.getExecutionDuration(execution);
    if (duration === null) return 'Not started';
    
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  getExecutionSuccessRate(executions: Execution[]): number {
    const finishedExecutions = executions.filter(this.isExecutionFinished);
    if (finishedExecutions.length === 0) return 0;
    
    const successfulExecutions = finishedExecutions.filter(e => e.status === 'completed');
    return Math.round((successfulExecutions.length / finishedExecutions.length) * 100);
  }

  getAverageExecutionTime(executions: Execution[]): number {
    const completedExecutions = executions.filter(e => 
      e.status === 'completed' && e.duration_seconds
    );
    
    if (completedExecutions.length === 0) return 0;
    
    const totalDuration = completedExecutions.reduce((sum, e) => sum + (e.duration_seconds || 0), 0);
    return Math.round(totalDuration / completedExecutions.length);
  }

  groupExecutionsByStatus(executions: Execution[]): Record<string, Execution[]> {
    return executions.reduce((groups, execution) => {
      const status = execution.status;
      if (!groups[status]) {
        groups[status] = [];
      }
      groups[status].push(execution);
      return groups;
    }, {} as Record<string, Execution[]>);
  }

  getExecutionsByDateRange(
    executions: Execution[], 
    startDate: Date, 
    endDate: Date
  ): Execution[] {
    return executions.filter(execution => {
      const createdAt = new Date(execution.created_at);
      return createdAt >= startDate && createdAt <= endDate;
    });
  }
}

export const executionApi = new ExecutionApiService();
