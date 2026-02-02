import { CallTestValues } from '../types/callTest';

export interface ModuleMetadata {
  id: string;
  name: string;
  script: string;
  description: string;
  category: string;
  editable: boolean;
  waitDurationSeconds?: number;
  duration_estimate?: string;
  durationEstimate?: string;
  avg_duration?: string;
  avgDuration?: string;
  impact?: 'low' | 'medium' | 'high';
  prerequisites?: string[];
  hiddenInModulesPage?: boolean;
  callTestParams?: CallTestValues;
  secretCode?: string;
  appLaunchTarget?: string;
  appLaunchDurationSeconds?: number;
  pingTarget?: string;
  pingDurationSeconds?: number;
  pingIntervalSeconds?: number;
  wrongApnValue?: string;
  logPullDestination?: string;
}

export const MODULE_CATALOG: ModuleMetadata[] = [
  {
    id: 'call_test',
    name: 'Call Test',
    script: 'call_control.sh',
    description: 'Runs a voice call scenario to validate audio quality and connectivity',
    category: 'Voice & Messaging',
    editable: true,
    hiddenInModulesPage: true,
    avg_duration: '2-4 min',
    impact: 'high',
    prerequisites: ['SIM ready', 'Microphone', 'Speaker'],
  },
  {
    id: 'enable_airplane_mode',
    name: 'Airplane Mode On',
    script: 'enable_airplane_mode.sh',
    description: 'Enables airplane mode to test network recovery scenarios.',
    category: 'Device Controls',
    editable: false,
    avg_duration: '15-30 s',
    impact: 'medium',
    prerequisites: ['ADB connected'],
  },
  {
    id: 'disable_airplane_mode',
    name: 'Airplane Mode Off',
    script: 'disable_airplane_mode.sh',
    description: 'Disables airplane mode to restore network connectivity.',
    category: 'Device Controls',
    editable: false,
    avg_duration: '15-30 s',
    impact: 'medium',
    prerequisites: ['ADB connected'],
  },
  {
    id: 'ping',
    name: 'Ping',
    script: 'ping.sh',
    description: 'Ping an IP address or domain from the device for a configurable duration.',
    category: 'Connectivity',
    editable: true,
    avg_duration: '30-60 s',
    impact: 'low',
    prerequisites: ['Network connectivity'],
  },
  {
    id: 'waiting_time',
    name: 'Waiting Time',
    script: '',
    description: 'Adds a configurable pause between workflow modules.',
    category: 'Utility',
    editable: true,
    waitDurationSeconds: 5,
    avg_duration: 'Varies',
    impact: 'low',
  },
  {
    id: 'activate_data',
    name: 'Activate Mobile Data',
    script: 'enable_mobile_data.sh',
    description: 'Ensures mobile data is enabled on the device before running connectivity tests.',
    category: 'Connectivity',
    editable: false,
    avg_duration: '20-40 s',
    impact: 'medium',
    prerequisites: ['Mobile data'],
  },
  {
    id: 'launch_app',
    name: 'Smart App Launcher',
    script: 'launch_app.sh',
    description: 'Launch Google or YouTube to generate realistic data traffic.',
    category: 'Automation',
    editable: true,
    avg_duration: '30-90 s',
    impact: 'medium',
    prerequisites: ['Target app installed'],
  },
  {
    id: 'wrong_apn_configuration',
    name: 'Change APN',
    script: 'wrong_apn_configuration.sh',
    description: 'Applies a deliberately wrong APN value to validate failure scenarios.',
    category: 'Network',
    editable: true,
    hiddenInModulesPage: true,
    avg_duration: '1-2 min',
    impact: 'high',
    prerequisites: ['APN access'],
  },
  {
    id: 'start_rf_logging',
    name: 'Start RF Logging',
    script: 'start_rf_logging.sh',
    description: 'Starts RF logging via SysDump/secret code (best effort).',
    category: 'Diagnostics',
    editable: false,
    avg_duration: '30-60 s',
    impact: 'high',
    prerequisites: ['SysDump available'],
  },
  {
    id: 'stop_rf_logging',
    name: 'Stop RF Logging',
    script: 'stop_rf_logging.sh',
    description: 'Stops RF logging via SysDump (best effort).',
    category: 'Diagnostics',
    editable: false,
    avg_duration: '15-30 s',
    impact: 'medium',
    prerequisites: ['RF logging active'],
  },
  {
    id: 'pull_rf_logs',
    name: 'Pull RF Logs',
    script: 'pull_rf_logs.sh',
    description: 'Pulls RF log files from the device to the host for analysis.',
    category: 'Diagnostics',
    editable: true,
    avg_duration: '1-3 min',
    impact: 'high',
    prerequisites: ['Storage available'],
  },
  {
    id: 'dial_secret_code',
    name: 'Dial USSD Code',
    script: 'dial_secret_code.sh',
    description: 'Dial a secret/USSD code such as *#9900# or *101#.',
    category: 'Automation',
    editable: true,
    avg_duration: '15-30 s',
    impact: 'medium',
    prerequisites: ['Dialer access'],
  },
];
