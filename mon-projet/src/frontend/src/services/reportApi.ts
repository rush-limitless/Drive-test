import { resolveBaseUrl, fetchWithRetry } from './utils';

export interface StatusBreakdown {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export interface ReportSummary {
  total_executions: number;
  success_rate: number;
  average_duration_seconds: number | null;
  device_coverage: number;
  executions_last_7_days: number;
  last_execution_at: string | null;
  status_breakdown: StatusBreakdown;
}

export interface SummaryFilters {
  date_from?: string;
  date_to?: string;
}

export const reportApi = {
  async getSummary(baseUrl?: string, filters: SummaryFilters = {}): Promise<ReportSummary> {
    const resolvedBase = resolveBaseUrl(baseUrl);
    const url = new URL(`${resolvedBase}/api/v1/reports/summary`);

    if (filters.date_from) {
      url.searchParams.set('date_from', filters.date_from);
    }
    if (filters.date_to) {
      url.searchParams.set('date_to', filters.date_to);
    }

    const response = await fetchWithRetry(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch report summary: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  },
};
