export const DEVICE_METADATA_STORAGE_KEY = 'deviceManagerMetadata';
export const DEVICE_METADATA_EVENT = 'deviceMetadataUpdated';

export interface DeviceChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface DeviceMetadata {
  alias?: string;
  tags?: string[];
  notes?: string;
  pinned?: boolean;
  checklist?: DeviceChecklistItem[];
}

export type DeviceMetadataMap = Record<string, DeviceMetadata>;

const sanitizeTags = (tags?: unknown): string[] => {
  if (!Array.isArray(tags)) {
    return [];
  }
  return tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
};

const defaultChecklist: DeviceChecklistItem[] = [
  { id: 'drivers', label: 'Drivers installed', done: false },
  { id: 'usb_debugging', label: 'USB debugging enabled', done: false },
  { id: 'sim_ready', label: 'SIM ready', done: false },
];

const sanitizeChecklist = (checklist?: unknown): DeviceChecklistItem[] => {
  if (!Array.isArray(checklist)) {
    return defaultChecklist.map((item) => ({ ...item }));
  }
  return defaultChecklist.map((item) => {
    const existing = checklist.find(
      (entry): entry is DeviceChecklistItem =>
        entry && typeof entry === 'object' && (entry as DeviceChecklistItem).id === item.id
    );
    if (existing) {
      return {
        id: existing.id,
        label: typeof existing.label === 'string' ? existing.label : item.label,
        done: Boolean(existing.done),
      };
    }
    return { ...item };
  });
};

export const normalizeDeviceMetadata = (meta?: DeviceMetadata | null): DeviceMetadata => ({
  alias: typeof meta?.alias === 'string' ? meta.alias : '',
  tags: sanitizeTags(meta?.tags),
  notes: typeof meta?.notes === 'string' ? meta.notes : '',
  pinned: Boolean(meta?.pinned),
  checklist: sanitizeChecklist(meta?.checklist),
});

export const DEFAULT_DEVICE_METADATA: DeviceMetadata = normalizeDeviceMetadata();

export const readDeviceMetadata = (): DeviceMetadataMap => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(DEVICE_METADATA_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    const next: DeviceMetadataMap = {};
    Object.entries(parsed as Record<string, DeviceMetadata>).forEach(([deviceId, meta]) => {
      next[deviceId] = normalizeDeviceMetadata(meta);
    });
    return next;
  } catch (error) {
    console.warn('[deviceMetadata] Failed to read metadata', error);
    return {};
  }
};

export const writeDeviceMetadata = (metadata: DeviceMetadataMap): void => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(DEVICE_METADATA_STORAGE_KEY, JSON.stringify(metadata));
    window.dispatchEvent(new Event(DEVICE_METADATA_EVENT));
  } catch (error) {
    console.warn('[deviceMetadata] Failed to persist metadata', error);
  }
};

export const readDeviceAliasMap = (): Record<string, string> => {
  const metadata = readDeviceMetadata();
  const aliasMap: Record<string, string> = {};
  Object.entries(metadata).forEach(([deviceId, meta]) => {
    const alias = meta.alias?.trim();
    if (alias) {
      aliasMap[deviceId] = alias;
    }
  });
  return aliasMap;
};
