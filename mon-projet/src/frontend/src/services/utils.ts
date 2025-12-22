export const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8007';

export const resolveBaseUrl = (baseUrl?: string): string => {
  const trimmed = baseUrl?.trim() ?? '';
  const resolved = trimmed.length > 0 ? trimmed : DEFAULT_API_BASE_URL;
  return resolved.endsWith('/') ? resolved.slice(0, -1) : resolved;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type RetryOptions = {
  retries?: number;
  backoffMs?: number;
  retryOn?: number[];
};

export const fetchWithRetry = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> => {
  const { retries = 2, backoffMs = 400, retryOn = [429, 500, 502, 503, 504] } = options;
  let attempt = 0;
  while (true) {
    try {
      const response = await fetch(input, init);
      if (!response.ok && retryOn.includes(response.status) && attempt < retries) {
        attempt += 1;
        const waitMs = backoffMs * Math.pow(2, attempt - 1);
        await sleep(waitMs);
        continue;
      }
      return response;
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
      attempt += 1;
      const waitMs = backoffMs * Math.pow(2, attempt - 1);
      await sleep(waitMs);
    }
  }
};
