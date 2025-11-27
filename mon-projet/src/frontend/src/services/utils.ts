export const DEFAULT_API_BASE_URL = 'http://localhost:8007';

export const resolveBaseUrl = (baseUrl?: string): string => {
  const resolved = baseUrl && baseUrl.trim().length > 0 ? baseUrl : DEFAULT_API_BASE_URL;
  return resolved.endsWith('/') ? resolved.slice(0, -1) : resolved;
};

