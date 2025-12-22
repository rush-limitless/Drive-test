import { ModuleMetadata } from '../data/modules';

export type DurationUnit = 'minutes' | 'hours' | 'days';

export const REPEAT_UNIT_TO_SECONDS: Record<DurationUnit, number> = {
  minutes: 60,
  hours: 3600,
  days: 86400,
};

export const convertDurationToSeconds = (value: number, unit: DurationUnit): number => {
  const normalizedValue = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  return normalizedValue * REPEAT_UNIT_TO_SECONDS[unit];
};

export const WAITING_TIME_MODULE_ID = 'waiting_time';
export const DEFAULT_WAIT_DURATION_SECONDS = 5;
export const MIN_WAIT_DURATION_SECONDS = 1;
export const MAX_WAIT_DURATION_SECONDS = 600;
const WAITING_TIME_STORAGE_KEY = 'waitingTimeDurationSeconds';

export const CALL_TEST_STORAGE_KEY = 'callTestParams';
export const GLOBAL_CALL_TEST_KEY = '__global__';

export const CALL_TEST_DEFAULTS = {
  countryCode: '+237',
  phoneNumber: '691234567',
  duration: 30,
  callCount: 1,
};

export type StoredCallTestValues = typeof CALL_TEST_DEFAULTS;

const sanitizeCallTestValues = (values: Partial<StoredCallTestValues>): StoredCallTestValues => {
  const countryDigits = (values.countryCode ?? CALL_TEST_DEFAULTS.countryCode).replace(/[^0-9]/g, '');
  const countryCode = countryDigits ? `+${countryDigits}` : CALL_TEST_DEFAULTS.countryCode;
  const phoneNumber =
    (values.phoneNumber ?? CALL_TEST_DEFAULTS.phoneNumber).replace(/[^0-9]/g, '') ||
    CALL_TEST_DEFAULTS.phoneNumber;
  const duration = Math.max(1, Math.min(600, Number(values.duration ?? CALL_TEST_DEFAULTS.duration)));
  const callCount = Math.max(1, Math.min(10, Number(values.callCount ?? CALL_TEST_DEFAULTS.callCount)));
  return { countryCode, phoneNumber, duration, callCount };
};

const readCallTestStorageMap = (): Record<string, StoredCallTestValues> => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(CALL_TEST_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const entries: Record<string, StoredCallTestValues> = {};
      Object.entries(parsed).forEach(([key, value]) => {
        if (value && typeof value === 'object') {
          entries[key] = sanitizeCallTestValues(value as Partial<StoredCallTestValues>);
        }
      });
      return entries;
    }
  } catch (error) {
    console.warn('[workflowHelpers] Failed to read Call Test storage map', error);
  }
  return {};
};

const resolveCallTestValuesForDevice = (deviceId?: string | null): StoredCallTestValues => {
  const map = readCallTestStorageMap();
  if (deviceId && map[deviceId]) {
    return map[deviceId];
  }
  if (map[GLOBAL_CALL_TEST_KEY]) {
    return map[GLOBAL_CALL_TEST_KEY];
  }
  return CALL_TEST_DEFAULTS;
};

const resolveCallTestValuesForModule = (module: ModuleMetadata, deviceId?: string | null): StoredCallTestValues => {
  const map = readCallTestStorageMap();
  if (deviceId && map[deviceId]) {
    return map[deviceId];
  }
  if (module.id === 'call_test' && module.callTestParams) {
    return sanitizeCallTestValues(module.callTestParams);
  }
  if (map[GLOBAL_CALL_TEST_KEY]) {
    return map[GLOBAL_CALL_TEST_KEY];
  }
  return CALL_TEST_DEFAULTS;
};

export const buildModuleParametersForDevice = (module: ModuleMetadata, deviceId?: string | null): Record<string, any> | undefined => {
  if (module.id === 'call_test') {
    const values = resolveCallTestValuesForModule(module, deviceId);
    const internationalNumber = `${values.countryCode}${values.phoneNumber}`.replace(/\s+/g, '');
    return {
      number: internationalNumber,
      duration: values.duration,
      call_count: values.callCount,
      calls: values.callCount,
    };
  }
  return undefined;
};

export const resolveModuleExecutionId = (moduleId: string): string | null => {
  if (moduleId === 'call_test') {
    return 'voice_call_test';
  }
  if (moduleId === WAITING_TIME_MODULE_ID) {
    return null;
  }
  return moduleId;
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const isWaitingModule = (module?: ModuleMetadata | null): boolean => module?.id === WAITING_TIME_MODULE_ID;

export const sanitizeWaitDurationSeconds = (value?: number | string): number => {
  const candidate = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(candidate)) {
    return DEFAULT_WAIT_DURATION_SECONDS;
  }
  const rounded = Math.round(candidate);
  return Math.min(MAX_WAIT_DURATION_SECONDS, Math.max(MIN_WAIT_DURATION_SECONDS, rounded));
};

export const getStoredWaitingTimeDuration = (): number => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return DEFAULT_WAIT_DURATION_SECONDS;
  }
  try {
    const raw = window.localStorage.getItem(WAITING_TIME_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_WAIT_DURATION_SECONDS;
    }
    const parsed = Number(raw);
    return sanitizeWaitDurationSeconds(parsed);
  } catch {
    return DEFAULT_WAIT_DURATION_SECONDS;
  }
};
