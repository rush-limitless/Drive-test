"""ADB command executor for automation modules."""

import subprocess
import json
import time
from typing import Dict, Any, List
from dataclasses import dataclass

try:  # Prefer the resolved executable path when available
    from ..core.adb_path import ADB_EXECUTABLE  # type: ignore
except Exception:  # pragma: no cover - fallback to env-resolved adb
    ADB_EXECUTABLE = "adb"

@dataclass
class ExecutionResult:
    success: bool
    output: str
    error: str = ""
    duration: float = 0.0

class ADBExecutor:
    """Execute ADB commands for device automation."""
    
    def __init__(self, device_id: str = None):
        self.device_id = device_id
        
    def execute_command(self, command: List[str], timeout: int = 30) -> ExecutionResult:
        """Execute ADB command with timeout."""
        start_time = time.time()

        # Always prefer the resolved adb binary; preserve explicitly provided binaries
        if command:
            base_cmd = ADB_EXECUTABLE if command[0] == "adb" else command[0]
            if self.device_id:
                command = [base_cmd, '-s', self.device_id, *command[1:]]
            else:
                command = [base_cmd, *command[1:]]
        
        try:
            result = subprocess.run(
                command, 
                capture_output=True, 
                text=True, 
                timeout=timeout,
                encoding='utf-8'
            )
            
            duration = time.time() - start_time
            
            return ExecutionResult(
                success=result.returncode == 0,
                output=result.stdout,
                error=result.stderr,
                duration=duration
            )
            
        except subprocess.TimeoutExpired:
            return ExecutionResult(
                success=False,
                output="",
                error=f"Command timed out after {timeout}s",
                duration=timeout
            )
        except Exception as e:
            return ExecutionResult(
                success=False,
                output="",
                error=str(e),
                duration=time.time() - start_time
            )
    
    def call_test(self, number: str, calls: int = 1) -> Dict[str, Any]:
        """Execute call test module."""
        results = []
        
        for i in range(calls):
            dial_result = self.execute_command([
                'adb', 'shell', 'am', 'start', '-a', 'android.intent.action.CALL',
                '-d', f'tel:{number}'
            ])
            
            if dial_result.success:
                time.sleep(2)
                end_result = self.execute_command([
                    'adb', 'shell', 'input', 'keyevent', 'KEYCODE_ENDCALL'
                ])
                
                results.append({
                    'call_number': i + 1,
                    'number': number,
                    'dial_success': dial_result.success,
                    'end_success': end_result.success,
                    'duration': dial_result.duration + end_result.duration
                })
            else:
                results.append({
                    'call_number': i + 1,
                    'number': number,
                    'dial_success': False,
                    'error': dial_result.error
                })
        
        return {
            'module': 'call_test',
            'total_calls': calls,
            'successful_calls': sum(1 for r in results if r.get('dial_success')),
            'results': results
        }
    
    def sms_test(self, recipient: str, count: int = 1) -> Dict[str, Any]:
        """Execute SMS test module."""
        results = []
        
        for i in range(count):
            message = f"Test SMS {i+1} from ADB Automation"
            
            sms_result = self.execute_command([
                'adb', 'shell', 'am', 'start', '-a', 'android.intent.action.SENDTO',
                '-d', f'sms:{recipient}', '--es', 'sms_body', message
            ])
            
            if sms_result.success:
                time.sleep(1)
                send_result = self.execute_command([
                    'adb', 'shell', 'input', 'keyevent', 'KEYCODE_ENTER'
                ])
                
                results.append({
                    'sms_number': i + 1,
                    'recipient': recipient,
                    'message': message,
                    'success': send_result.success,
                    'duration': sms_result.duration + send_result.duration
                })
            else:
                results.append({
                    'sms_number': i + 1,
                    'recipient': recipient,
                    'success': False,
                    'error': sms_result.error
                })
        
        return {
            'module': 'sms_test',
            'total_sms': count,
            'successful_sms': sum(1 for r in results if r.get('success')),
            'results': results
        }
    
    def network_perf(self, server_ip: str = "8.8.8.8") -> Dict[str, Any]:
        """Execute network performance test."""
        ping_result = self.execute_command([
            'adb', 'shell', 'ping', '-c', '10', server_ip
        ])
        
        data_result = self.execute_command([
            'adb', 'shell', 'dumpsys', 'netstats'
        ])
        
        avg_latency = 0.0
        if ping_result.success and 'avg' in ping_result.output:
            try:
                lines = ping_result.output.split('\n')
                for line in lines:
                    if 'avg' in line and 'ms' in line:
                        parts = line.split('/')
                        if len(parts) >= 5:
                            avg_latency = float(parts[4])
                        break
            except:
                pass
        
        return {
            'module': 'network_perf',
            'server_ip': server_ip,
            'ping_success': ping_result.success,
            'average_latency_ms': avg_latency,
            'packet_loss': '0%' if ping_result.success else '100%',
            'data_usage_available': data_result.success,
            'duration': ping_result.duration + data_result.duration
        }
