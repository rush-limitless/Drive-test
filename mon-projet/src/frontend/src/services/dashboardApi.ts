import { resolveBaseUrl, fetchWithRetry } from './utils';

export interface DashboardScope {
  id: string;
  label: string;
  count: number;
}

export interface DashboardSummary {
  scope: string;
  scopes: DashboardScope[];
  devices: {
    connected: number;
    total: number;
    error: { code: string; message: string } | null;
  };
  workflows: {
    total: number;
    active: number;
    draft: number;
  };
  quickActions: Array<{ id: string; label: string; href: string; icon: string }>;
}

export interface ActivityItem {
  id: string;
  icon: string;
  title: string;
  ts: string | null;
  meta: string;
}

export interface SearchResult {
  type: 'module' | 'workflow' | 'device';
  id: string;
  label: string;
  href: string;
  description?: string;
}

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const text = await response.text();
    const detail = text || 'No body';
    throw new Error(`HTTP ${response.status}: ${response.statusText} - ${detail}`);
  }
  return response.json() as Promise<T>;
};

export const dashboardApi = {
  async getSummary(baseUrl?: string, scope?: string): Promise<DashboardSummary> {
    const resolvedBase = resolveBaseUrl(baseUrl);
    const url = new URL(`${resolvedBase}/api/v1/dashboard/summary`);
    if (scope) {
      url.searchParams.set('scope', scope);
    }
    const response = await fetchWithRetry(url.toString());
    return handleResponse<DashboardSummary>(response);
  },

  async getRecentActivity(baseUrl?: string, limit = 10): Promise<ActivityItem[]> {
    const resolvedBase = resolveBaseUrl(baseUrl);
    const url = new URL(`${resolvedBase}/api/v1/activity/recent`);
    url.searchParams.set('limit', String(limit));
    const response = await fetchWithRetry(url.toString());
    const payload = await handleResponse<{ items: ActivityItem[] }>(response);
    return payload.items ?? [];
  },

  async search(baseUrl: string | undefined, query: string, limit = 8): Promise<SearchResult[]> {
    const resolvedBase = resolveBaseUrl(baseUrl);
    const url = new URL(`${resolvedBase}/api/v1/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', String(limit));
    const response = await fetchWithRetry(url.toString());
    const payload = await handleResponse<{ results: SearchResult[] }>(response);
    return payload.results ?? [];
  },
};



