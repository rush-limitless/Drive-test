import { Device } from '@types';

export interface DeviceCardActions {
  onDisconnect?: (device: Device) => void;
  onDetails?: (device: Device) => void;
  isDisconnecting?: boolean;
}

export interface DeviceCardProps extends DeviceCardActions {
  device: Device;
}

export interface DeviceMeta {
  name: string;
  model: string;
  status: string;
  connectionType: string;
  simLabel: string;
  network: string;
  lastSeen: string;
}
