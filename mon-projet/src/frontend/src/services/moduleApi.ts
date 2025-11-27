/**
 * Module API service for managing automation modules.
 */

import axios from 'axios';

export interface ModuleStep {
  name: string;
  description: string;
  timeout_seconds: number;
}

export interface Module {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  steps: ModuleStep[];
  input_schema: any;
  output_schema: any;
  timeout_seconds: number;
  requires_root: boolean;
  device_compatibility?: any;
}

class ModuleApiService {
  private getApiUrl(backendUrl: string): string {
    return `${backendUrl}/api/v1/modules`;
  }

  async getModules(backendUrl: string, category?: string, activeOnly: boolean = true): Promise<Module[]> {
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (activeOnly) params.append('active_only', 'true');

      const response = await axios.get(`${this.getApiUrl(backendUrl)}?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching modules:', error);
      throw new Error('Failed to fetch modules');
    }
  }

  async getModule(backendUrl: string, moduleId: string): Promise<Module> {
    try {
      const response = await axios.get(`${this.getApiUrl(backendUrl)}/${moduleId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching module ${moduleId}:`, error);
      throw new Error(`Failed to fetch module ${moduleId}`);
    }
  }

  async getCategories(backendUrl: string): Promise<string[]> {
    try {
      const response = await axios.get(`${this.getApiUrl(backendUrl)}/categories`);
      return response.data;
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw new Error('Failed to fetch categories');
    }
  }

  async validateModuleInput(backendUrl: string, moduleId: string, inputParams: any): Promise<{
    module_id: string;
    valid: boolean;
    input_params: any;
  }> {
    try {
      const response = await axios.post(`${this.getApiUrl(backendUrl)}/${moduleId}/validate`, inputParams);
      return response.data;
    } catch (error) {
      console.error(`Error validating module input ${moduleId}:`, error);
      throw new Error(`Failed to validate module input ${moduleId}`);
    }
  }

  // Utility methods
  getModulesByCategory(modules: Module[]): Record<string, Module[]> {
    return modules.reduce((groups, module) => {
      const category = module.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(module);
      return groups;
    }, {} as Record<string, Module[]>);
  }

  searchModules(modules: Module[], query: string): Module[] {
    const lowerQuery = query.toLowerCase();
    return modules.filter(module =>
      module.name.toLowerCase().includes(lowerQuery) ||
      module.description.toLowerCase().includes(lowerQuery) ||
      module.category.toLowerCase().includes(lowerQuery) ||
      module.id.toLowerCase().includes(lowerQuery)
    );
  }

  getModuleComplexity(module: Module): 'simple' | 'moderate' | 'complex' {
    const stepCount = module.steps.length;
    const hasComplexSchema = this.hasComplexInputSchema(module.input_schema);
    const longTimeout = module.timeout_seconds > 300; // 5 minutes

    if (stepCount <= 2 && !hasComplexSchema && !longTimeout) {
      return 'simple';
    } else if (stepCount <= 5) {
      return 'moderate';
    } else {
      return 'complex';
    }
  }

  private hasComplexInputSchema(schema: any): boolean {
    if (!schema || !schema.properties) return false;
    
    const propertyCount = Object.keys(schema.properties).length;
    const hasNestedObjects = Object.values(schema.properties).some((prop: any) => 
      prop.type === 'object' || prop.type === 'array'
    );
    
    return propertyCount > 5 || hasNestedObjects;
  }

  estimateModuleDuration(module: Module): number {
    // Estimate based on steps and timeout
    const stepDuration = module.steps.reduce((sum, step) => sum + step.timeout_seconds, 0);
    return Math.min(stepDuration, module.timeout_seconds);
  }

  getModuleRequirements(module: Module): string[] {
    const requirements: string[] = [];
    
    if (module.requires_root) {
      requirements.push('Root access required');
    }
    
    if (module.device_compatibility) {
      if (module.device_compatibility.min_android_version) {
        requirements.push(`Android ${module.device_compatibility.min_android_version}+`);
      }
      if (module.device_compatibility.required_features) {
        requirements.push(...module.device_compatibility.required_features);
      }
    }
    
    return requirements;
  }

  validateModuleCompatibility(module: Module, deviceInfo: any): boolean {
    if (!module.device_compatibility) return true;
    
    const compat = module.device_compatibility;
    
    // Check Android version
    if (compat.min_android_version && deviceInfo.os_version) {
      const deviceVersion = parseFloat(deviceInfo.os_version);
      const minVersion = parseFloat(compat.min_android_version);
      if (deviceVersion < minVersion) return false;
    }
    
    // Check required features
    if (compat.required_features && deviceInfo.capabilities) {
      for (const feature of compat.required_features) {
        if (!deviceInfo.capabilities[feature]) return false;
      }
    }
    
    return true;
  }
}

export const moduleApi = new ModuleApiService();