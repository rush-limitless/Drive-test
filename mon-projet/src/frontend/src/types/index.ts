export interface SimInfo {
  mcc?: string;
  mnc?: string;
  carrier?: string;
}

export interface Device {
  id: string;
  model: string;
  serial?: string;
  android_version?: string;
  os_version?: string;
  connection_type?: string;
  status?: string;
  adb_status?: string;
  raw_status?: string;
  raw_adb_status?: string;
  name?: string;
  marketing_name?: string;
  phone_number?: string;
  sim_info?: SimInfo;
  sim_slots?: Array<{
    slot_index?: number;
    operator?: string;
    operator_numeric?: string;
    network_technology?: string;
  }>;
  battery_level?: number | string;
  network_operator?: string;
  network_operator_live?: string;
  carrier?: string;
  network_technology?: string;
  last_seen?: string;
  airplane_mode?: boolean;
  developer_mode_enabled?: boolean;
  usb_debugging_enabled?: boolean;
  requires_setup?: boolean;
}

export interface KPIData {
  connectedDevices: number;
  workflows: number;
  lastRunStatus: string;
}

export interface Module {
  id: string;
  name: string;
  description: string;
  editable: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps_count: number;
  policy: Record<string, any>;
}

export interface Execution {
  execution_id: string;
  status: string;
  flow_id: string;
  device_id: string;
  step_results?: any[];
  steps_completed?: number;
  total_steps?: number;
}
