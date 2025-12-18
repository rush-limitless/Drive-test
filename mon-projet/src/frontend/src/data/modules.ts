import { CallTestValues } from '../types/callTest';

export interface ModuleMetadata {
  id: string;
  name: string;
  script: string;
  description: string;
  category: string;
  editable: boolean;
  waitDurationSeconds?: number;
  hiddenInModulesPage?: boolean;
  callTestParams?: CallTestValues;
}

export const MODULE_CATALOG: ModuleMetadata[] = [
  {
    id: 'call_test',
    name: 'Call Test',
    script: 'call_control.sh',
    description: 'Runs a voice call scenario to validate audio quality and connectivity',
    category: 'Voice & Messaging',
    editable: true,
  },
  {
    id: 'sms_send',
    name: 'Send SMS',
    script: 'send_sms.sh',
    description: 'Send a custom SMS message to the selected device.',
    category: 'Voice & Messaging',
    editable: true,
  },
  {
    id: 'enable_airplane_mode',
    name: 'Airplane Mode On',
    script: 'enable_airplane_mode.sh',
    description: 'Enables airplane mode to test network recovery scenarios.',
    category: 'Device Controls',
    editable: false,
  },
  {
    id: 'disable_airplane_mode',
    name: 'Airplane Mode Off',
    script: 'disable_airplane_mode.sh',
    description: 'Disables airplane mode to restore network connectivity.',
    category: 'Device Controls',
    editable: false,
  },
  {
    id: 'ping',
    name: 'Ping',
    script: 'ping.sh',
    description: 'Ping an IP address or domain from the device for a configurable duration.',
    category: 'Connectivity',
    editable: true,
  },
  {
    id: 'waiting_time',
    name: 'Waiting Time',
    script: '',
    description: 'Adds a configurable pause between workflow modules.',
    category: 'Utility',
    editable: true,
    waitDurationSeconds: 5,
  },
  {
    id: 'activate_data',
    name: 'Activate Mobile Data',
    script: 'enable_mobile_data.sh',
    description: 'Ensures mobile data is enabled on the device before running connectivity tests.',
    category: 'Connectivity',
    editable: false,
  },
  {
    id: 'launch_app',
    name: 'Smart App Launcher',
    script: 'launch_app.sh',
    description: 'Launch Google or YouTube to generate realistic data traffic.',
    category: 'Automation',
    editable: true,
  },
  {
    id: 'wrong_apn_configuration',
    name: 'Change APN',
    script: 'wrong_apn_configuration.sh',
    description: 'Applies a deliberately wrong APN value to validate failure scenarios.',
    category: 'Network',
    editable: true,
  },
  {
    id: 'start_rf_logging',
    name: 'Start RF Logging',
    script: 'start_rf_logging.sh',
    description: 'Starts RF logging via SysDump/secret code (best effort).',
    category: 'Diagnostics',
    editable: false,
  },
  {
    id: 'stop_rf_logging',
    name: 'Stop RF Logging',
    script: 'stop_rf_logging.sh',
    description: 'Stops RF logging via SysDump (best effort).',
    category: 'Diagnostics',
    editable: false,
  },
  {
    id: 'pull_rf_logs',
    name: 'Pull RF Logs',
    script: 'pull_rf_logs.sh',
    description: 'Pulls RF log files from the device to the host for analysis.',
    category: 'Diagnostics',
    editable: true,
  },
  {
    id: 'dial_secret_code',
    name: 'Dial USSD Code',
    script: 'dial_secret_code.sh',
    description: 'Dial a secret/USSD code such as *#9900# or *101#.',
    category: 'Automation',
    editable: true,
  },
];
