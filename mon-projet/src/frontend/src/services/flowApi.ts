/**
 * Flow API service for managing automation flows.
 */

import axios from 'axios';

export interface FlowModule {
  module_id: string;
  sequence_order: number;
  input_parameters?: any;
  continue_on_failure: boolean;
  retry_count: number;
  timeout_seconds?: number;
}

export interface Flow {
  id?: string;
  name: string;
  description?: string;
  visibility: string;
  modules: FlowModule[];
  estimated_duration_minutes?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ExecutionRequest {
  device_ids: string[];
}

class FlowApiService {
  private getApiUrl(backendUrl: string): string {
    return `${backendUrl}/api/v1/flows`;
  }

  async getFlows(backendUrl: string, visibility?: string, createdBy?: string): Promise<Flow[]> {
    try {
      const params = new URLSearchParams();
      if (visibility) params.append('visibility', visibility);
      if (createdBy) params.append('created_by', createdBy);

      const response = await axios.get(`${this.getApiUrl(backendUrl)}?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching flows:', error);
      throw new Error('Failed to fetch flows');
    }
  }

  async getFlow(backendUrl: string, flowId: string): Promise<Flow> {
    try {
      const response = await axios.get(`${this.getApiUrl(backendUrl)}/${flowId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching flow ${flowId}:`, error);
      throw new Error(`Failed to fetch flow ${flowId}`);
    }
  }

  async createFlow(backendUrl: string, flow: Flow): Promise<Flow> {
    try {
      const response = await axios.post(this.getApiUrl(backendUrl), flow);
      return response.data;
    } catch (error) {
      console.error('Error creating flow:', error);
      throw new Error('Failed to create flow');
    }
  }

  async updateFlow(backendUrl: string, flowId: string, flow: Partial<Flow>): Promise<Flow> {
    try {
      const response = await axios.put(`${this.getApiUrl(backendUrl)}/${flowId}`, flow);
      return response.data;
    } catch (error) {
      console.error(`Error updating flow ${flowId}:`, error);
      throw new Error(`Failed to update flow ${flowId}`);
    }
  }

  async deleteFlow(backendUrl: string, flowId: string): Promise<void> {
    try {
      await axios.delete(`${this.getApiUrl(backendUrl)}/${flowId}`);
    } catch (error) {
      console.error(`Error deleting flow ${flowId}:`, error);
      throw new Error(`Failed to delete flow ${flowId}`);
    }
  }

  async duplicateFlow(backendUrl: string, flowId: string, name?: string): Promise<Flow> {
    try {
      const params = name ? `?name=${encodeURIComponent(name)}` : '';
      const response = await axios.post(`${this.getApiUrl(backendUrl)}/${flowId}/duplicate${params}`);
      return response.data;
    } catch (error) {
      console.error(`Error duplicating flow ${flowId}:`, error);
      throw new Error(`Failed to duplicate flow ${flowId}`);
    }
  }

  async executeFlow(backendUrl: string, flowId: string, deviceIds: string[]): Promise<any> {
    try {
      const executionRequest: ExecutionRequest = { device_ids: deviceIds };
      const response = await axios.post(
        `${backendUrl}/api/v1/executions/${flowId}/execute`,
        executionRequest
      );
      return response.data;
    } catch (error) {
      console.error(`Error executing flow ${flowId}:`, error);
      throw new Error(`Failed to execute flow ${flowId}`);
    }
  }

  // Utility methods
  validateFlow(flow: Flow): string[] {
    const errors: string[] = [];

    if (!flow.name || flow.name.trim().length === 0) {
      errors.push('Flow name is required');
    }

    if (flow.modules.length === 0) {
      errors.push('Flow must contain at least one module');
    }

    // Check for duplicate sequence orders
    const sequenceOrders = flow.modules.map(m => m.sequence_order);
    const uniqueOrders = new Set(sequenceOrders);
    if (uniqueOrders.size !== sequenceOrders.length) {
      errors.push('Duplicate sequence orders found');
    }

    // Check for gaps in sequence
    const sortedOrders = sequenceOrders.sort((a, b) => a - b);
    for (let i = 0; i < sortedOrders.length; i++) {
      if (sortedOrders[i] !== i + 1) {
        errors.push('Sequence orders must be consecutive starting from 1');
        break;
      }
    }

    return errors;
  }

  estimateFlowDuration(flow: Flow, moduleTimeouts: Record<string, number>): number {
    if (flow.estimated_duration_minutes) {
      return flow.estimated_duration_minutes;
    }

    // Sum module timeouts as rough estimate
    const totalSeconds = flow.modules.reduce((sum, module) => {
      const timeout = module.timeout_seconds || moduleTimeouts[module.module_id] || 300;
      return sum + timeout;
    }, 0);

    return Math.max(1, Math.ceil(totalSeconds / 60)); // Convert to minutes
  }

  getFlowComplexity(flow: Flow): 'simple' | 'moderate' | 'complex' {
    const moduleCount = flow.modules.length;
    const hasRetries = flow.modules.some(m => m.retry_count > 0);
    const hasContinueOnFailure = flow.modules.some(m => m.continue_on_failure);

    if (moduleCount <= 3 && !hasRetries && !hasContinueOnFailure) {
      return 'simple';
    } else if (moduleCount <= 8) {
      return 'moderate';
    } else {
      return 'complex';
    }
  }
}

export const flowApi = new FlowApiService();