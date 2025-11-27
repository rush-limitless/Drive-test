import { ModuleMetadata, MODULE_CATALOG } from '../data/modules';
import { CallTestValues } from '../types/callTest';

export type WorkflowStatus = 'active' | 'draft';

export interface StoredWorkflow {
  id: string;
  name: string;
  description?: string;
  modules: ModuleMetadata[];
  createdAt: string;
  updatedAt: string;
  status: WorkflowStatus;
  runCount: number;
  lastRunAt: string | null;
}

const STORAGE_KEY = 'customWorkflows';
const UPDATE_EVENT = 'workflows:updated';

const moduleCatalogMap = new Map<string, ModuleMetadata>(
  MODULE_CATALOG.map((module) => [module.id, module])
);

const cloneCallTestParams = (value?: CallTestValues): CallTestValues | undefined =>
  value
    ? {
        countryCode: value.countryCode,
        phoneNumber: value.phoneNumber,
        duration: value.duration,
        callCount: value.callCount,
      }
    : undefined;

const isCallTestValues = (value: unknown): value is CallTestValues => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as CallTestValues;
  return (
    typeof candidate.countryCode === 'string' &&
    typeof candidate.phoneNumber === 'string' &&
    typeof candidate.duration === 'number' &&
    typeof candidate.callCount === 'number'
  );
};

const sanitizeCallTestParams = (value: unknown): CallTestValues | undefined => {
  if (!isCallTestValues(value)) {
    return undefined;
  }
  return cloneCallTestParams(value);
};

const cloneModule = (module: ModuleMetadata): ModuleMetadata => ({
  ...module,
  callTestParams: cloneCallTestParams(module.callTestParams),
});

const safeParse = (value: string | null): unknown[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.warn('[workflows] Failed to parse stored workflows:', error);
  }

  return [];
};

const emitUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  }
};

const normalizeModuleEntry = (entry: unknown): ModuleMetadata | null => {
  if (typeof entry === 'string') {
    const fromCatalog = moduleCatalogMap.get(entry);
    if (fromCatalog) {
      return cloneModule(fromCatalog);
    }

    const fallbackId = entry.trim() || 'unnamed_module';
    return {
      id: entry,
      name: fallbackId,
      script: fromCatalog?.script ?? '',
      description: fromCatalog?.description ?? '',
      category: fromCatalog?.category ?? 'Custom',
      editable: fromCatalog?.editable ?? false,
      waitDurationSeconds: fromCatalog?.waitDurationSeconds,
      hiddenInModulesPage: fromCatalog?.hiddenInModulesPage ?? false,
    };
  }

  if (entry && typeof entry === 'object') {
    const record = entry as Partial<ModuleMetadata> & Record<string, unknown>;
    const rawId =
      typeof record.id === 'string'
        ? record.id
        : typeof record.module === 'string'
          ? record.module
          : undefined;

    if (!rawId) {
      return null;
    }

    const base = moduleCatalogMap.get(rawId);
    const name =
      typeof record.name === 'string' && record.name.trim().length > 0
        ? record.name.trim()
        : base?.name ?? rawId;
    const script =
      typeof record.script === 'string' && record.script.trim().length > 0
        ? record.script
        : base?.script ?? '';
    const description =
      typeof record.description === 'string'
        ? record.description
        : base?.description ?? '';
    const category =
      typeof record.category === 'string' && record.category.trim().length > 0
        ? record.category
        : base?.category ?? 'Custom';
    const editable =
      typeof record.editable === 'boolean' ? record.editable : base?.editable ?? true;

    const callTestParams =
      sanitizeCallTestParams((record as any).callTestParams) ??
      cloneCallTestParams(base?.callTestParams);

    return {
      id: rawId,
      name,
      script,
      description,
      category,
      editable,
      waitDurationSeconds:
        typeof (record as any).waitDurationSeconds === 'number'
          ? (record as any).waitDurationSeconds as number
          : base?.waitDurationSeconds,
      hiddenInModulesPage:
        typeof (record as any).hiddenInModulesPage === 'boolean'
          ? (record as any).hiddenInModulesPage as boolean
          : base?.hiddenInModulesPage ?? false,
      callTestParams,
    };
  }

  if (entry && typeof (entry as ModuleMetadata).id === 'string') {
    const module = entry as ModuleMetadata;
    const base = moduleCatalogMap.get(module.id);
    return {
      id: module.id,
      name: module.name ?? base?.name ?? module.id,
      script: module.script ?? base?.script ?? '',
      description: module.description ?? base?.description ?? '',
      category: module.category ?? base?.category ?? 'Custom',
      editable: typeof module.editable === 'boolean' ? module.editable : base?.editable ?? true,
      waitDurationSeconds:
        typeof module.waitDurationSeconds === 'number'
          ? module.waitDurationSeconds
          : base?.waitDurationSeconds,
      hiddenInModulesPage:
        typeof module.hiddenInModulesPage === 'boolean'
          ? module.hiddenInModulesPage
          : base?.hiddenInModulesPage ?? false,
      callTestParams: cloneCallTestParams(module.callTestParams ?? base?.callTestParams),
    };
  }

  return null;
};

const normalizeModules = (value: unknown): ModuleMetadata[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const modules: ModuleMetadata[] = [];

  for (const entry of value) {
    const normalized = normalizeModuleEntry(entry);
    if (!normalized) {
      continue;
    }

    modules.push(normalized);
  }

  return modules;
};

const sanitizeTimestamp = (value: unknown, fallback: string): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return fallback;
};

const sanitizeOptionalTimestamp = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
};

const sanitizeRunCount = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.trunc(parsed));
    }
  }

  return fallback;
};

const hydrateWorkflow = (record: any, index: number): StoredWorkflow => {
  const now = new Date().toISOString();
  const idSource = record?.id ?? record?.workflowId ?? record?.workflow_id;
  const id =
    typeof idSource === 'string' && idSource.trim().length > 0
      ? idSource.trim()
      : `workflow_${Date.now()}_${index}`;

  const name =
    typeof record?.name === 'string' && record.name.trim().length > 0
      ? record.name.trim()
      : 'Untitled Workflow';

  const description =
    typeof record?.description === 'string' ? record.description : '';

  const modules = normalizeModules(record?.modules);

  const createdAtCandidate = record?.createdAt ?? record?.created_at ?? record?.created;
  const updatedAtCandidate = record?.updatedAt ?? record?.updated_at ?? record?.updated;
  const runCountCandidate =
    record?.runCount ??
    record?.run_count ??
    record?.totalRuns ??
    record?.total_runs ??
    record?.executions;
  const lastRunAtCandidate =
    record?.lastRunAt ??
    record?.last_run_at ??
    record?.last_run ??
    record?.lastRun;

  const createdAt = sanitizeTimestamp(createdAtCandidate, now);
  const updatedAt = sanitizeTimestamp(updatedAtCandidate, createdAt);
  const runCount = sanitizeRunCount(runCountCandidate, 0);
  const lastRunAt = sanitizeOptionalTimestamp(lastRunAtCandidate);
  const derivedStatus: WorkflowStatus = runCount > 0 || !!lastRunAt ? 'active' : 'draft';

  return {
    id,
    name,
    description,
    modules,
    createdAt,
    updatedAt,
    status: derivedStatus,
    runCount,
    lastRunAt,
  };
};

export const getStoredWorkflows = (): StoredWorkflow[] => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return [];
  }

  const rawItems = safeParse(window.localStorage.getItem(STORAGE_KEY));
  return rawItems.map((item, index) => hydrateWorkflow(item, index));
};

const persist = (workflows: StoredWorkflow[]) => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows));
  emitUpdate();
};

export const addStoredWorkflow = (
  workflow: Omit<StoredWorkflow, 'id' | 'createdAt' | 'updatedAt' | 'runCount' | 'lastRunAt' | 'status'> & {
    runCount?: number;
    lastRunAt?: string | null;
  }
): StoredWorkflow => {
  const workflows = getStoredWorkflows();
  const now = new Date().toISOString();
  const normalizedName = workflow.name?.trim() || 'Untitled Workflow';
  const normalizedModules = normalizeModules(workflow.modules);
  const lastRunAt = sanitizeOptionalTimestamp(workflow.lastRunAt);

  const newWorkflow: StoredWorkflow = {
    id: `workflow_${Date.now()}`,
    name: normalizedName,
    description: workflow.description || '',
    modules: normalizedModules,
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    runCount: sanitizeRunCount(workflow.runCount, 0),
    lastRunAt,
  };

  workflows.push(newWorkflow);
  persist(workflows);
  return newWorkflow;
};

export const updateStoredWorkflow = (
  workflowId: string,
  updates: Partial<Omit<StoredWorkflow, 'id' | 'createdAt'>>
): StoredWorkflow | null => {
  const workflows = getStoredWorkflows();
  const idx = workflows.findIndex((workflow) => workflow.id === workflowId);
  if (idx === -1) {
    return null;
  }

  const existing = workflows[idx];
  const now = new Date().toISOString();
  const next: StoredWorkflow = {
    ...existing,
    updatedAt: now,
  };

  if (typeof updates.name === 'string') {
    const trimmed = updates.name.trim();
    next.name = trimmed.length > 0 ? trimmed : existing.name;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
    next.description = typeof updates.description === 'string' ? updates.description : '';
  }

  if (updates.modules) {
    next.modules = normalizeModules(updates.modules);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'runCount')) {
    next.runCount = sanitizeRunCount((updates as any).runCount, existing.runCount);
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'lastRunAt')) {
    next.lastRunAt = sanitizeOptionalTimestamp((updates as any).lastRunAt);
  }

  if (typeof updates.updatedAt === 'string') {
    next.updatedAt = sanitizeTimestamp(updates.updatedAt, now);
  }

  next.status = next.runCount > 0 || !!next.lastRunAt ? 'active' : 'draft';

  workflows[idx] = next;
  persist(workflows);
  return next;
};

export const deleteStoredWorkflow = (workflowId: string): void => {
  const workflows = getStoredWorkflows();
  const filtered = workflows.filter((workflow) => workflow.id !== workflowId);
  persist(filtered);
};

export const clearStoredWorkflows = (): void => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
  emitUpdate();
};

export const recordWorkflowRun = (workflowId: string, executedAt?: string): StoredWorkflow | null => {
  const workflows = getStoredWorkflows();
  const idx = workflows.findIndex((workflow) => workflow.id === workflowId);
  if (idx === -1) {
    return null;
  }

  const timestamp = executedAt ? sanitizeTimestamp(executedAt, new Date().toISOString()) : new Date().toISOString();
  const current = workflows[idx];
  const updated: StoredWorkflow = {
    ...current,
    runCount: current.runCount + 1,
    lastRunAt: timestamp,
    updatedAt: timestamp,
    status: 'active',
  };

  workflows[idx] = updated;
  persist(workflows);
  return updated;
};

export const WORKFLOWS_STORAGE_EVENT = UPDATE_EVENT;
