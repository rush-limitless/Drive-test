"""Flow execution engine for running automation flows."""

import yaml
import json
import time
from typing import Dict, Any, List
from .adb_executor import ADBExecutor
from .telco_modules import TelcoModules, DEFAULT_MAX_RING_TIME, DEFAULT_REDIAL_DELAY, DEFAULT_WRONG_APN
import logging

logger = logging.getLogger(__name__)

class FlowExecutor:
    """Execute automation flows on Android devices."""
    
    def __init__(self):
        self.executors = {}  # device_id -> ADBExecutor
        
    def get_executor(self, device_id: str) -> TelcoModules:
        """Get or create Telco modules executor for device."""
        if device_id not in self.executors:
            self.executors[device_id] = TelcoModules(device_id)
        return self.executors[device_id]
    
    def execute_flow(self, flow_config: Dict[str, Any], device_id: str = None) -> Dict[str, Any]:
        """Execute a complete automation flow."""
        executor = self.get_executor(device_id) if device_id else TelcoModules()
        
        flow_id = flow_config.get('id', 'unknown')
        flow_name = flow_config.get('name', 'Unknown Flow')
        steps = flow_config.get('steps', [])
        policy = flow_config.get('policy', {})
        
        execution_id = f"exec_{flow_id}_{int(time.time())}"
        start_time = time.time()
        
        results = {
            'execution_id': execution_id,
            'flow_id': flow_id,
            'flow_name': flow_name,
            'device_id': device_id,
            'start_time': start_time,
            'status': 'running',
            'steps_completed': 0,
            'total_steps': len(steps),
            'step_results': [],
            'errors': []
        }
        
        stop_on_failure = policy.get('stop_on_failure', True)
        
        for i, step in enumerate(steps):
            step_start = time.time()
            module_name = step.get('module')
            module_params = step.get('with', {})
            
            try:
                step_result = self.execute_module(executor, module_name, module_params)
                step_result['step_number'] = i + 1
                step_result['step_duration'] = time.time() - step_start
                
                results['step_results'].append(step_result)
                results['steps_completed'] = i + 1
                
                # Check if step failed and should stop
                if not step_result.get('success', True) and stop_on_failure:
                    results['status'] = 'failed'
                    results['errors'].append(f"Step {i+1} ({module_name}) failed")
                    break
                    
            except Exception as e:
                error_msg = f"Step {i+1} ({module_name}) error: {str(e)}"
                results['errors'].append(error_msg)
                
                if stop_on_failure:
                    results['status'] = 'failed'
                    break
        
        # Complete execution
        if results['status'] == 'running':
            results['status'] = 'completed'
        
        results['end_time'] = time.time()
        results['total_duration'] = results['end_time'] - start_time
        
        return results
    
    def execute_module(self, executor: TelcoModules, module_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a single automation module."""
        start_ts = time.time()
        if module_name == 'call_test':
            number = params.get('number', '*123#')
            calls = params.get('calls', 1)
            talk_duration = params.get('duration', params.get('talk_duration', 10))
            max_ring_time = params.get('max_ring_time', DEFAULT_MAX_RING_TIME)
            redial_delay = params.get('redial_delay', DEFAULT_REDIAL_DELAY)
            result = executor.call_test(
                number=number,
                calls=calls,
                talk_duration=talk_duration,
                max_ring_time=max_ring_time,
                redial_delay=redial_delay
            )
            result['success'] = result['successful_calls'] > 0
            return result
            
        elif module_name == 'sms_test':
            recipient = params.get('recipient', '+1234567890')
            count = params.get('count', 1)
            result = executor.sms_test(recipient, count)
            result['success'] = result['successful_sms'] > 0
            return result
            
        elif module_name == 'network_perf':
            server_ip = params.get('server_ip', '8.8.8.8')
            result = executor.network_perf(server_ip)
            result['success'] = result['ping_success']
            return result
# New telco modules
        elif module_name == 'enable_airplane_mode':
            return executor.enable_airplane_mode()
        elif module_name == 'disable_airplane_mode':
            return executor.disable_airplane_mode()
        elif module_name == 'wrong_apn_configuration':
            apn = params.get('apn_value') or params.get('apn') or DEFAULT_WRONG_APN
            use_ui = bool(params.get('use_ui_flow'))
            return executor.configure_wrong_apn(apn, use_ui_flow=use_ui)
        elif module_name == 'pull_device_logs':
            destination = params.get('destination') or params.get('path') or './device_logs'
            return executor.pull_device_logs(destination)
        elif module_name == 'force_phone_to_lte':
            return executor.force_network_type('lte')
        elif module_name == 'force_phone_to_3g':
            return executor.force_network_type('3g')
        elif module_name == 'force_phone_to_2g':
            return executor.force_network_type('2g')
        elif module_name == 'enable_wifi':
            return executor.enable_wifi()
        elif module_name == 'disable_wifi':
            return executor.disable_wifi()
        elif module_name == 'enable_mobile_data':
            return executor.enable_mobile_data()
        elif module_name == 'disable_mobile_data':
            return executor.disable_mobile_data()
        elif module_name == 'activate_data':
            return executor.enable_mobile_data()
        elif module_name == 'toggle_airplane_mode':
            desired = params.get('enabled')
            return executor.toggle_airplane_mode(bool(desired))
        elif module_name == 'start_rf_logging':
            return executor.start_rf_logging()
        elif module_name == 'stop_rf_logging':
            return executor.stop_rf_logging()
        elif module_name == 'test_data_connection':
            return executor.test_data_connection(
                target=params.get('target', '8.8.8.8'),
                duration_seconds=params.get('duration', params.get('duration_seconds', 10)),
                interval_seconds=params.get('interval', params.get('interval_seconds', 1.0)),
            )
        elif module_name == 'pull_rf_logs':
            destination = params.get('destination') or params.get('path') or './rf_logs'
            return executor.pull_rf_logs(destination)
        elif module_name == 'dial_secret_code':
            return executor.dial_secret_code(params.get('code'))
        elif module_name == 'launch_app':
            app = params.get('app') or params.get('target') or params.get('app_target')
            duration_raw = params.get('duration_seconds', params.get('duration'))
            duration_seconds = None
            if duration_raw is not None:
                try:
                    duration_seconds = int(duration_raw)
                except (TypeError, ValueError):
                    duration_seconds = None
            targets = params.get('targets') or params.get('target_sequence')
            return executor.launch_app(app=app, duration_seconds=duration_seconds, targets=targets)
        elif module_name == 'check_signal_strength':
            return executor.check_signal_strength()
        elif module_name == 'ping':
            target = params.get('target', '8.8.8.8')
            duration = params.get('duration', 10)
            interval = params.get('interval', 1.0)
            return executor.ping_target(target=target, duration_seconds=duration, interval_seconds=interval)
        elif module_name == 'check_ip':
            return executor.check_ip()
        elif module_name == 'voice_call_test':
            number = params.get('number', '*123#')
            duration = params.get('duration', 10)
            call_count = params.get('call_count', 1)
            return executor.voice_call_test(number, duration, call_count)
        elif module_name == 'initiate_call':
            number = params.get('number', '*123#')
            return executor.initiate_call(number)
        elif module_name == 'reject_incoming_call':
            return executor.reject_incoming_call()
        elif module_name == 'send_sms':
            number = params.get('number', '+1234567890')
            message = params.get('message', 'Test SMS')
            return executor.send_sms(number, message)
        elif module_name == 'delete_sms':
            return executor.delete_sms()
        elif module_name == 'start_data_session':
            url = params.get('url', 'http://www.google.com')
            return executor.start_data_session(url)
        elif module_name == 'stop_data_session':
            package = params.get('package', 'com.android.chrome')
            return executor.stop_data_session(package)
        elif module_name == 'capture_screenshot':
            filename = params.get('filename')
            return executor.capture_screenshot(filename)
        elif module_name == 'power_off_device':
            return executor.power_off_device()
        elif module_name == 'wake_screen':
            return executor.wake_screen()
        elif module_name == 'sleep_screen':
            return executor.sleep_screen()
        elif module_name == 'install_app':
            apk_path = params.get('apk_path')
            if not apk_path:
                return {'module': module_name, 'success': False, 'error': 'apk_path required'}
            return executor.install_app(apk_path)
        elif module_name == 'uninstall_app':
            package_name = params.get('package_name')
            if not package_name:
                return {'module': module_name, 'success': False, 'error': 'package_name required'}
            return executor.uninstall_app(package_name)
        elif module_name == 'force_close_app':
            package_name = params.get('package_name')
            if not package_name:
                return {'module': module_name, 'success': False, 'error': 'package_name required'}
            return executor.force_close_app(package_name)
        elif module_name == 'configure_wrong_apn':
            apn = params.get('apn_value') or params.get('apn') or DEFAULT_WRONG_APN
            return executor.configure_wrong_apn(apn)
        elif module_name == 'check_network_registration':
            return executor.check_network_registration()
        elif module_name == 'end_call':
            return executor.end_call()
            
        else:
            return {
                'module': module_name,
                'success': False,
                'error': f'Unknown module: {module_name}'
            }
        duration = time.time() - start_ts
        logger.info(
            "module_execution",
            extra={
                "module": module_name,
                "success": bool(result.get("success", False)),
                "device_id": executor.device_id,
                "duration_sec": round(duration, 2),
                "error": result.get("error"),
            },
        )
        return result
    
    def load_flow_from_file(self, flow_path: str) -> Dict[str, Any]:
        """Load flow configuration from YAML file."""
        try:
            with open(flow_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except Exception as e:
            raise ValueError(f"Failed to load flow from {flow_path}: {str(e)}")
    
    def get_available_devices(self) -> List[Dict[str, str]]:
        """Get list of available ADB devices."""
        import subprocess
        
        try:
            result = subprocess.run(['adb', 'devices'], capture_output=True, text=True)
            devices = []
            
            for line in result.stdout.split('\n')[1:]:
                if line.strip() and '\t' in line:
                    device_id, status = line.strip().split('\t')
                    devices.append({
                        'id': device_id,
                        'status': 'online' if status == 'device' else 'offline'
                    })
            
            return devices
        except Exception:
            return []
