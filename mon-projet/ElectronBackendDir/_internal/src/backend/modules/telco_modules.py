"""Modules d'automatisation télécoms complets pour ADB."""

import logging
import os
import re
import subprocess
import time
import math
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from .adb_executor import ADBExecutor, ExecutionResult

# Support both import styles (modules.* when backend is the working dir, and src.backend.* when launched from project root)
try:
    from ..core.adb_path import ADB_EXECUTABLE
except ImportError:  # pragma: no cover - runtime fallback
    from src.backend.core.adb_path import ADB_EXECUTABLE  # type: ignore

logger = logging.getLogger(__name__)

STATE_VALUE_MAP = {
    '0': 'IN_SERVICE',
    '1': 'OUT_OF_SERVICE',
    '2': 'EMERGENCY_ONLY',
    '3': 'POWER_OFF',
}

NETWORK_DISPLAY_MAP = {
    'NR': '5G',
    'NR_NSA': '5G',
    'NR_SA': '5G',
    'LTE': '4G',
    'LTE_CA': '4G+',
    'HSPAP': '3G',
    'HSPA': '3G',
    'HSUPA': '3G',
    'HSDPA': '3G',
    'UMTS': '3G',
    'EDGE': '2G',
    'GPRS': '2G',
    'GSM': '2G',
}

CALL_STATE_IDLE = 0
CALL_STATE_RINGING = 1
CALL_STATE_OFFHOOK = 2
CALL_STATE_LABELS = {
    CALL_STATE_IDLE: 'Idle',
    CALL_STATE_RINGING: 'Ringing',
    CALL_STATE_OFFHOOK: 'Connected',
}
DEFAULT_RING_TIMEOUT = 45
DEFAULT_VOICEMAIL_TIMEOUT = 40
CALL_MONITOR_POLL_SEC = 1.0
CALL_MIN_RING_SECONDS = 5.0
DEFAULT_MAX_RING_TIME = 20  # seconds
DEFAULT_REDIAL_DELAY = 3.0
AIRPLANE_STATE_TIMEOUT = 12.0
AIRPLANE_STATE_POLL_SEC = 0.5
DEFAULT_WRONG_APN = "arnaud"


def _extract_field(source: str, field: str) -> Optional[str]:
    pattern = rf"{field}=([^\s,\)\}}]+)"
    match = re.search(pattern, source)
    if match:
        return match.group(1).strip()
    return None


def _normalize_state_value(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = value.strip()
    if cleaned.upper().startswith('STATE_'):
        cleaned = cleaned.upper().replace('STATE_', '')
    elif cleaned in STATE_VALUE_MAP:
        cleaned = STATE_VALUE_MAP[cleaned]
    cleaned = cleaned.replace('_', ' ').strip()
    return cleaned.title() if cleaned else None


def _format_network_label(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    upper = value.upper()
    display = NETWORK_DISPLAY_MAP.get(upper)
    if display:
        return f"{display} ({upper})"
    return upper


def _clean_operator_label(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = value.strip().strip('"').strip()
    if not cleaned or cleaned.lower() in {'unknown', 'null', 'n/a'}:
        return None
    if 'NetworkRegistrationInfo' in cleaned or 'mOperatorAlphaShort' in cleaned:
        return None
    if cleaned.startswith('null'):
        return None
    return cleaned[:64]


def _parse_call_state(payload: str) -> Optional[int]:
    if not payload:
        return None
    match = re.search(r"mCallState\s*=\s*(\d+)", payload)
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


class TelcoModules(ADBExecutor):
    """Modules d'automatisation télécoms étendus."""

    def _parse_registration_info(self, payload: Optional[str]) -> Optional[Dict[str, Any]]:
        if not payload:
            return None

        info: Dict[str, Any] = {}

        def extract(field: str) -> Optional[str]:
            return _extract_field(payload, field)

        def normalize_label(value: Optional[str]) -> Optional[str]:
            if not value:
                return None
            cleaned = value.strip().strip('"')
            if not cleaned:
                return None
            upper = cleaned.upper()
            if upper.startswith('STATE_') or cleaned.isdigit():
                normalised = _normalize_state_value(cleaned)
                return normalised
            if upper.startswith(('DATA_', 'VOICE_', 'SERVICE_', 'REG_STATE_')):
                return upper.replace('_', ' ').title()
            return cleaned

        def bool_value(value: Optional[str]) -> Optional[bool]:
            if value is None:
                return None
            lowered = value.strip().lower()
            if lowered in {'true', '1', 'yes'}:
                return True
            if lowered in {'false', '0', 'no'}:
                return False
            return None

        operator = (
            _clean_operator_label(extract('mOperatorAlphaShort'))
            or _clean_operator_label(extract('mOperatorAlphaLong'))
        )
        operator_numeric = extract('mOperatorNumeric')
        service_state = normalize_label(extract('mServiceState'))
        voice_state = normalize_label(extract('mVoiceRegState') or extract('mVoiceServiceState'))
        data_state = normalize_label(extract('mDataRegState') or extract('mDataServiceState'))
        data_connection = normalize_label(extract('mDataConnectionState'))
        network_type_raw = extract('mDataNetworkType') or extract('mVoiceNetworkType')
        network_label = _format_network_label(network_type_raw) if network_type_raw else None
        emergency_only = bool_value(extract('mEmergencyOnly') or extract('mIsEmergencyOnly'))

        if operator:
            info['operator'] = operator
        if operator_numeric:
            info['operator_numeric'] = operator_numeric
        if service_state:
            info['service_state'] = service_state
        if voice_state:
            info['voice_state'] = voice_state
        if data_state:
            info['data_state'] = data_state
        if data_connection:
            info['data_connection_state'] = data_connection
        if network_label:
            info['network_technology'] = network_label
        elif network_type_raw:
            info['network_technology'] = network_type_raw.upper()
        if emergency_only is not None:
            info['emergency_only'] = emergency_only

        return info or None
    
    # -----------------------------
    # Call Handling
    # -----------------------------
    
    def _read_call_state(self) -> Optional[int]:
        result = self.execute_command([
            ADB_EXECUTABLE, 'shell', 'dumpsys', 'telephony.registry'
        ])
        if not result.success:
            return None
        return _parse_call_state(result.output)

    def _clear_event_log(self) -> None:
        """Clear the events buffer so we only read fresh call_state entries."""
        self.execute_command([ADB_EXECUTABLE, 'shell', 'logcat', '-b', 'events', '-c'])

    def _read_event_log_call_states(self) -> List[str]:
        """Return call_state entries from the events buffer."""
        result = self.execute_command([ADB_EXECUTABLE, 'shell', 'logcat', '-b', 'events', '-v', 'brief', '-d'])
        if not result.success or not result.output:
            return []
        states = re.findall(r'call_state=?\s*(\d+)', result.output, re.IGNORECASE)
        return states

    def _read_telecom_call_details(self) -> List[Dict[str, Any]]:
        """Parse dumpsys telecom to extract state/connectTime per call."""
        result = self.execute_command([ADB_EXECUTABLE, 'shell', 'dumpsys', 'telecom'])
        if not result.success or not result.output:
            return []

        calls: List[Dict[str, Any]] = []
        current: Dict[str, Any] = {}

        for raw_line in result.output.splitlines():
            line = raw_line.strip()
            if not line:
                continue

            if line.startswith('Call TC') or line.startswith('Call '):
                if current:
                    calls.append(current)
                current = {}

            state_match = re.search(r'state\s*=\s*([A-Z_]+)', line, re.IGNORECASE)
            if state_match:
                current['state'] = state_match.group(1).upper()

            connect_match = re.search(r'connect(?:Elapsed)?Time(?:Millis)?\s*=\s*([0-9]+)', line, re.IGNORECASE)
            if connect_match:
                try:
                    current['connect_time'] = int(connect_match.group(1))
                except ValueError:
                    current['connect_time'] = 0

            dir_match = re.search(r'isIncoming\s*=\s*(true|false)', line, re.IGNORECASE)
            if dir_match:
                current['is_incoming'] = dir_match.group(1).lower() == 'true'

        if current:
            calls.append(current)
        return calls

    def _wait_for_call_connection(self, timeout: Optional[int]) -> Tuple[bool, float]:
        """Wait until dumpsys telecom reports a connected/active call with non-zero connect time."""
        start = time.time()
        self._clear_event_log()
        while timeout is None or time.time() - start < timeout:
            for state in self._read_event_log_call_states():
                try:
                    numeric_state = int(state)
                except ValueError:
                    continue
                if numeric_state == 4:  # connected
                    self._clear_event_log()
                    return True, time.time() - start
                if numeric_state in {0, 5}:  # idle or disconnected
                    self._clear_event_log()
                    return False, time.time() - start
            self._clear_event_log()

            for call in self._read_telecom_call_details():
                state = call.get('state')
                connect_time = call.get('connect_time', 0)
                if state in {'ACTIVE', 'HOLDING'} and connect_time and connect_time > 0:
                    return True, time.time() - start
                if state in {'DISCONNECTED', 'DISCONNECTING', 'ABORTED'}:
                    return False, time.time() - start
            time.sleep(CALL_MONITOR_POLL_SEC)
        return False, time.time() - start

    def _wait_for_call_state(self, target_states: Tuple[int, ...], timeout: Optional[float], poll_interval: float = CALL_MONITOR_POLL_SEC, min_idle_duration: float = 0.0) -> Tuple[Optional[int], float]:
        start = time.time()
        last_state: Optional[int] = None
        while timeout is None or time.time() - start < timeout:
            state = self._read_call_state()
            if state in target_states:
                elapsed = time.time() - start
                if state == CALL_STATE_IDLE and elapsed < min_idle_duration:
                    time.sleep(poll_interval)
                    continue
                return state, elapsed
            if state is not None:
                last_state = state
            time.sleep(poll_interval)
        return last_state, time.time() - start

    def _maintain_active_call(self, duration: float, poll_interval: float = CALL_MONITOR_POLL_SEC) -> Tuple[float, Optional[int]]:
        start = time.time()
        last_state: Optional[int] = None
        while time.time() - start < duration:
            state = self._read_call_state()
            if state not in (CALL_STATE_OFFHOOK, None):
                last_state = state
                break
            time.sleep(poll_interval)
        return time.time() - start, last_state

    def _dial_until_answered(self, number: str, max_ring_time: Optional[int], redial_delay: float) -> Dict[str, Any]:
        """Attempt to dial repeatedly until the call is answered or ring budget is exhausted."""
        total_ring = 0.0
        attempts = 0
        last_error: Optional[str] = None

        while max_ring_time is None or total_ring < max_ring_time:
            attempts += 1
            dial_result = self.execute_command([
                ADB_EXECUTABLE, 'shell', 'am', 'start', '-a', 'android.intent.action.CALL', '-d', f'tel:{number}'
            ])

            if not dial_result.success:
                last_error = dial_result.error or "Failed to initiate call"
                break

            remaining = None if max_ring_time is None else max(max_ring_time - total_ring, 1)
            answered, elapsed = self._wait_for_call_connection(remaining)
            total_ring += elapsed

            if answered:
                return {
                    'answered': True,
                    'ring_duration': total_ring,
                    'attempts': attempts,
                    'error': None
                }

            # ensure call is terminated before retrying
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_ENDCALL'])
            if max_ring_time is not None and total_ring >= max_ring_time:
                break
            time.sleep(redial_delay)

        return {
            'answered': False,
            'ring_duration': total_ring,
            'attempts': attempts,
            'error': last_error
        }

    def _supervised_voice_call(self, number: str, talk_duration: int, ring_timeout: int, voicemail_timeout: int) -> Dict[str, Any]:
        call_start = time.time()
        dial_result = self.execute_command([
            ADB_EXECUTABLE, 'shell', 'am', 'start', '-a', 'android.intent.action.CALL', '-d', f'tel:{number}'
        ])

        if not dial_result.success:
            return {
                'success': False,
                'answered': False,
                'voicemail_reached': False,
                'ring_duration': 0.0,
                'talk_time_elapsed': 0.0,
                'voicemail_wait': 0.0,
                'hangup_sent': False,
                'termination_state': None,
                'number': number,
                'total_duration': time.time() - call_start,
                'error': dial_result.error or "Failed to initiate call"
            }

        # Ring until answered (ignore ringing duration)
        ring_state, ring_elapsed = self._wait_for_call_state(
            (CALL_STATE_OFFHOOK, CALL_STATE_IDLE),
            max(ring_timeout, 1),
            min_idle_duration=CALL_MIN_RING_SECONDS,
        )
        answered = ring_state == CALL_STATE_OFFHOOK
        talk_elapsed = 0.0
        voicemail_wait = 0.0
        hang_result: Optional[ExecutionResult] = None
        final_state = ring_state

        if answered:
            talk_elapsed, premature_state = self._maintain_active_call(talk_duration)
            hang_result = self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_ENDCALL'])
            final_state = CALL_STATE_IDLE if hang_result.success else premature_state
        else:
            final_state, voicemail_wait = self._wait_for_call_state(
                (CALL_STATE_IDLE,),
                max(voicemail_timeout, 1)
            )
            if final_state is None:
                final_state = ring_state

        voicemail_reached = (not answered) and final_state == CALL_STATE_IDLE
        success = answered or voicemail_reached
        error = None if success else "Call ended before voicemail pickup"
        if answered and hang_result and not hang_result.success:
            error = hang_result.error or error

        return {
            'success': success,
            'answered': answered,
            'voicemail_reached': voicemail_reached,
            'ring_duration': ring_elapsed,
            'talk_time_elapsed': talk_elapsed,
            'voicemail_wait': voicemail_wait,
            'hangup_sent': bool(hang_result and hang_result.success) if answered else False,
            'termination_state': CALL_STATE_LABELS.get(final_state, 'Unknown'),
            'number': number,
            'total_duration': time.time() - call_start,
            'error': error
        }

    def call_test(self, number: str, calls: int = 1, talk_duration: int = 10) -> Dict[str, Any]:
        """Execute call test module."""
        results = []
        
        for i in range(calls):
            dial_result = self.execute_command([
                'adb', 'shell', 'am', 'start', '-a', 'android.intent.action.CALL',
                '-d', f'tel:{number}'
            ])
            
            if dial_result.success:
                time.sleep(talk_duration)
                end_result = self.execute_command([
                    'adb', 'shell', 'input', 'keyevent', 'KEYCODE_ENDCALL'
                ])
                
                results.append({
                    'call_number': i + 1,
                    'number': number,
                    'dial_success': dial_result.success,
                    'end_success': end_result.success,
                    'talk_duration': talk_duration,
                    'duration': dial_result.duration + talk_duration + end_result.duration
                })
            else:
                results.append({
                    'call_number': i + 1,
                    'number': number,
                    'dial_success': False,
                    'talk_duration': 0,
                    'error': dial_result.error
                })
        
        return {
            'module': 'call_test',
            'total_calls': calls,
            'successful_calls': sum(1 for r in results if r.get('dial_success')),
            'results': results
        }

    def voice_call_test(self, number: str, talk_duration: int = 10, call_count: int = 1) -> Dict[str, Any]:
        results = []
        total_duration = 0.0
        successful_calls = 0
        voicemail_hits = 0
        ring_timeout = max(talk_duration, DEFAULT_RING_TIMEOUT)

        for i in range(call_count):
            call_details = self._supervised_voice_call(
                number=number,
                talk_duration=talk_duration,
                ring_timeout=ring_timeout,
                voicemail_timeout=DEFAULT_VOICEMAIL_TIMEOUT
            )
            call_details['call_number'] = i + 1
            results.append(call_details)
            total_duration += call_details.get('total_duration', 0.0)
            if call_details.get('answered'):
                successful_calls += 1
            if call_details.get('voicemail_reached'):
                voicemail_hits += 1
            
            if i < call_count - 1:
                time.sleep(3)

        success_flag = any(r.get('success') for r in results)

        return {
            'module': 'voice_call_test',
            'success': success_flag,
            'duration': total_duration,
            'number': number,
            'call_duration': talk_duration,
            'call_count': call_count,
            'successful_calls': successful_calls,
            'voicemail_hits': voicemail_hits,
            'results': results,
            'error': None if success_flag else 'All calls failed before voicemail'
        }

    def initiate_call(self, number: str) -> Dict[str, Any]:
        result = self.execute_command([ADB_EXECUTABLE, 'shell', 'am', 'start', '-a', 'android.intent.action.CALL', '-d', f'tel:{number}'])
        return {'module': 'initiate_call', 'success': result.success, 'duration': result.duration, 'number': number, 'error': result.error if not result.success else None}

    def end_call(self) -> Dict[str, Any]:
        result = self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_ENDCALL'])
        return {'module': 'end_call', 'success': result.success, 'duration': result.duration, 'error': result.error if not result.success else None}

    def reject_incoming_call(self) -> Dict[str, Any]:
        result = self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_ENDCALL'])
        return {'module': 'reject_incoming_call', 'success': result.success, 'duration': result.duration, 'error': result.error if not result.success else None}

    # -----------------------------
    # Airplane Mode
    # -----------------------------
    def _get_airplane_state(self) -> Optional[bool]:
        result = self.execute_command([ADB_EXECUTABLE, 'shell', 'settings', 'get', 'global', 'airplane_mode_on'])
        if not result.success or result.output is None:
            return None
        value = result.output.strip()
        if value not in {'0', '1'}:
            return None
        return value == '1'

    def _wait_for_airplane_state(self, expected: bool) -> Tuple[bool, Optional[bool], float]:
        start = time.time()
        last_state: Optional[bool] = None
        while time.time() - start < AIRPLANE_STATE_TIMEOUT:
            state = self._get_airplane_state()
            if state is not None:
                last_state = state
                if state is expected:
                    return True, last_state, time.time() - start
            time.sleep(AIRPLANE_STATE_POLL_SEC)
        return False, last_state, time.time() - start

    def _toggle_airplane_mode(self, enable: bool) -> Dict[str, Any]:
        state_label = 'enable_airplane_mode' if enable else 'disable_airplane_mode'
        
        # Check current state first
        current_state = self._get_airplane_state()
        if current_state is not None and current_state == enable:
            return {
                'module': state_label,
                'success': True,
                'duration': 0.1,
                'airplane_mode': current_state,
                'state_verified': True,
                'already_in_state': True,
                'message': f'Airplane mode is already {"enabled" if enable else "disabled"}',
            }
        
        # Root/system-only path (pas de navigation UI)
        errors: List[Dict[str, str]] = []
        cmds: List[List[str]] = [
            [ADB_EXECUTABLE, 'shell', 'settings', 'put', 'global', 'airplane_mode_on', '1' if enable else '0'],
            [ADB_EXECUTABLE, 'shell', 'cmd', 'connectivity', 'airplane-mode', 'enable' if enable else 'disable'],
            [ADB_EXECUTABLE, 'shell', 'am', 'broadcast', '-a', 'android.intent.action.AIRPLANE_MODE', '--ez', 'state', 'true' if enable else 'false'],
        ]
        for cmd in cmds:
            res = self.execute_command(cmd)
            if not res.success and res.error:
                errors.append({'command': ' '.join(cmd), 'error': res.error})
            time.sleep(0.2)

        verified, final_state, wait_duration = self._wait_for_airplane_state(enable)
        state_known = final_state is not None
        state_matches = bool(state_known and final_state == enable)
        success = state_matches

        return {
            'module': state_label,
            'success': success,
            'duration': round(wait_duration, 2),
            'airplane_mode': final_state,
            'state_verified': state_matches and verified,
            'already_in_state': False,
            'errors': errors or None,
            'warnings': None if success or state_known else 'Airplane mode state could not be confirmed (root commands used)',
        }

    def enable_airplane_mode(self) -> Dict[str, Any]:
        return self._toggle_airplane_mode(True)

    def disable_airplane_mode(self) -> Dict[str, Any]:
        return self._toggle_airplane_mode(False)

    def toggle_airplane_mode(self, enabled: bool) -> Dict[str, Any]:
        """Toggle airplane mode with verification."""
        return self._toggle_airplane_mode(bool(enabled))

    def _toggle_mobile_data_root(self, enable: bool) -> ExecutionResult:
        """Toggle mobile data using root `svc data` command."""
        action = 'enable' if enable else 'disable'
        return self.execute_command([
            ADB_EXECUTABLE, 'shell', 'su', '-c', f'svc data {action}'
        ])

    def configure_wrong_apn(self, apn_value: Optional[str] = None, use_ui_flow: bool = True) -> Dict[str, Any]:
        apn = re.sub(r'[^A-Za-z0-9._-]', '', (apn_value or DEFAULT_WRONG_APN).strip()) or DEFAULT_WRONG_APN

        # Check current APN settings
        current_tether = self.execute_command([ADB_EXECUTABLE, 'shell', 'settings', 'get', 'global', 'tether_dun_apn'])
        current_preferred = self.execute_command([ADB_EXECUTABLE, 'shell', 'settings', 'get', 'global', 'preferred_apn'])
        logger.debug("Current APN values | tether_dun_apn=%s | preferred_apn=%s", current_tether.output, current_preferred.output)

        was_already_set = (
            current_tether.success
            and current_preferred.success
            and current_tether.output.strip() == apn
            and current_preferred.output.strip() == apn
        )

        commands = [
            [ADB_EXECUTABLE, 'shell', 'settings', 'put', 'global', 'tether_dun_apn', apn],
            [ADB_EXECUTABLE, 'shell', 'settings', 'put', 'global', 'preferred_apn', apn],
        ]
        logger.info("Applying wrong APN=%s via settings.put (2 commands, force_apply=%s)", apn, was_already_set)
        results = [self.execute_command(cmd) for cmd in commands]

        ui_flow_attempted = False
        ui_flow_note: Optional[str] = None
        if use_ui_flow:
            ui_flow_attempted = True
            ui_ok = self._apply_apn_via_settings_ui(apn)
            ui_flow_note = "APN Settings UI sequence executed (best effort); verify on device."
            if ui_ok:
                logger.info("APN UI flow executed (best effort) for value: %s", apn)
            else:
                logger.warning("APN UI flow could not confirm UI interactions; falling back to settings.put only")

        verify_commands = [
            [ADB_EXECUTABLE, 'shell', 'settings', 'get', 'global', 'tether_dun_apn'],
            [ADB_EXECUTABLE, 'shell', 'settings', 'get', 'global', 'preferred_apn'],
        ]
        verify_results = [self.execute_command(cmd) for cmd in verify_commands]
        confirmed = all(apn in (res.output or '') for res in verify_results if res.success)
        logger.debug("Verification results | tether_dun_apn=%s | preferred_apn=%s | confirmed=%s",
                     verify_results[0].output if verify_results else None,
                     verify_results[1].output if len(verify_results) > 1 else None,
                     confirmed)

        step_failure = next((res for res in results if not res.success), None)
        error_msg = None
        if step_failure:
            error_msg = step_failure.error or "APN write command failed"
        elif not confirmed:
            error_msg = "APN not confirmed on device (best-effort)"
            logger.warning("APN verification failed for value '%s' (device may not accept settings.put)", apn)

        success = all(res.success for res in results) and confirmed
        if success:
            logger.info("Wrong APN successfully applied and confirmed: %s", apn)
        else:
            logger.error("Wrong APN failed (success=%s, confirmed=%s, error=%s)", success, confirmed, error_msg)
        return {
            'module': 'wrong_apn_configuration',
            'apn': apn,
            'success': success,
            'already_configured': was_already_set,
            'state_confirmed': confirmed,
            'ui_flow_attempted': ui_flow_attempted,
            'ui_flow_note': ui_flow_note,
            'steps': [{'command': ' '.join(cmd), 'success': res.success, 'error': res.error} for cmd, res in zip(commands, results)],
            'verify': [{'command': ' '.join(cmd), 'success': res.success, 'output': res.output, 'error': res.error} for cmd, res in zip(verify_commands, verify_results)],
            'warning': None if confirmed else 'APN not confirmed on device (best-effort)',
            'error': error_msg,
            'message': ("APN was already set; re-applied for verification" if was_already_set else "APN applied"),
        }

    def start_rf_logging(self) -> Dict[str, Any]:
        """Best-effort start of RF logging via SysDump/secret code (non-root, DPAD)."""
        attempts = []

        # 1) Ouvrir dialer
        cmd = [ADB_EXECUTABLE, 'shell', 'am', 'start', '-a', 'android.intent.action.DIAL']
        res = self.execute_command(cmd, timeout=10)
        attempts.append({'command': ' '.join(cmd), 'success': res.success, 'error': res.error.strip() if res.error else None})
        time.sleep(0.5)
        # Effacer toute saisie existante
        for _ in range(12):
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DEL'])
            time.sleep(0.05)
        # Saisir *#9900# via keyevents pour fiabilité
        for key in ('KEYCODE_STAR', 'KEYCODE_POUND', 'KEYCODE_9', 'KEYCODE_9', 'KEYCODE_0', 'KEYCODE_0', 'KEYCODE_POUND'):
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', key])
            time.sleep(0.1)
        # Validation alternative : ENTER puis broadcast secret code (évite les appels voix)
        enter_cmd = [ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_ENTER']
        res_enter = self.execute_command(enter_cmd, timeout=5)
        attempts.append({'command': ' '.join(enter_cmd), 'success': res_enter.success, 'error': res_enter.error.strip() if res_enter.error else None})
        time.sleep(0.8)
        broadcast_cmd = [ADB_EXECUTABLE, 'shell', 'am', 'broadcast', '-a', 'android.provider.Telephony.SECRET_CODE', '-d', 'android_secret_code://9900']
        res_bc = self.execute_command(broadcast_cmd, timeout=5)
        attempts.append({'command': ' '.join(broadcast_cmd), 'success': res_bc.success, 'error': res_bc.error.strip() if res_bc.error else None})
        time.sleep(0.8)

        # 2) Vérifier si l'écran SysDump est présent avant de naviguer (sinon éviter de taper dans le dialer)
        root = self._ui_dump()

        def _has_sysdump_markers(r: ET.Element) -> bool:
            for node in r.iter():
                txt = (node.attrib.get('text') or node.attrib.get('content-desc') or '').strip().lower()
                if any(tag in txt for tag in ('sysdump', 'silent log', 'silentlog', 'copy kernel log', 'cp based log')):
                    return True
            return False

        has_sysdump = _has_sysdump_markers(root) if root is not None else False

        # 3) Tentative UI : rechercher "Silent log" et "RF"
        ui_success = False
        if has_sysdump:
            for _ in range(6):
                if self._tap_by_text('Silent log') or self._tap_by_text('SilentLog') or self._tap_by_text('Silent logging'):
                    time.sleep(0.5)
                    for __ in range(6):
                        if self._tap_by_text('RF') or self._tap_by_text('CP') or self._tap_by_text('MODEM'):
                            ui_success = True
                            break
                        self._scroll_down()
                    break
                self._scroll_down()

            # DPAD pour valider "OK" dans le dialogue RF (5 fois bas, droite, centre)
            dpad_ok = [
                ('KEYCODE_DPAD_DOWN', 6),  # descendre jusqu'à OK
                ('KEYCODE_DPAD_RIGHT', 1),
                ('KEYCODE_DPAD_CENTER', 1),
            ]
            for key, count in dpad_ok:
                for _ in range(count):
                    self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', key])
                    time.sleep(0.3)

        # 4) Statut : on considère succès si la séquence dial/broadcast a été envoyée,
        # et on ajoute un warning si la présence de SysDump n'est pas confirmée.
        state_confirmed = has_sysdump
        success = any(a['success'] for a in attempts)  # ne bloque pas sur l'absence de dump/ls
        return {
            'module': 'start_rf_logging',
            'success': success,
            'already_active': False,
            'state_confirmed': state_confirmed,
            'attempts': attempts,
            'warning': None if state_confirmed else 'SysDump not confirmed; open menu manually if needed, then rerun.',
        }

    def stop_rf_logging(self) -> Dict[str, Any]:
        """Best-effort stop of RF logging, même processus que start (keyevents + broadcast + DPAD)."""
        attempts = []
        # 1) Ouvrir dialer
        cmd = [ADB_EXECUTABLE, 'shell', 'am', 'start', '-a', 'android.intent.action.DIAL']
        res = self.execute_command(cmd, timeout=10)
        attempts.append({'command': ' '.join(cmd), 'success': res.success, 'error': res.error.strip() if res.error else None})
        time.sleep(0.5)
        # Effacer toute saisie existante
        for _ in range(12):
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DEL'])
            time.sleep(0.05)
        # Saisir *#9900# via keyevents
        for key in ('KEYCODE_STAR', 'KEYCODE_POUND', 'KEYCODE_9', 'KEYCODE_9', 'KEYCODE_0', 'KEYCODE_0', 'KEYCODE_POUND'):
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', key])
            time.sleep(0.1)
        # Validation : ENTER + broadcast secret code (évite appel voix)
        enter_cmd = [ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_ENTER']
        res_enter = self.execute_command(enter_cmd, timeout=5)
        attempts.append({'command': ' '.join(enter_cmd), 'success': res_enter.success, 'error': res_enter.error.strip() if res_enter.error else None})
        time.sleep(0.8)
        broadcast_cmd = [ADB_EXECUTABLE, 'shell', 'am', 'broadcast', '-a', 'android.provider.Telephony.SECRET_CODE', '-d', 'android_secret_code://9900']
        res_bc = self.execute_command(broadcast_cmd, timeout=5)
        attempts.append({'command': ' '.join(broadcast_cmd), 'success': res_bc.success, 'error': res_bc.error.strip() if res_bc.error else None})
        time.sleep(0.8)

        # 2) Vérifier SysDump
        root = self._ui_dump()

        def _has_sysdump_markers(r: ET.Element) -> bool:
            for node in r.iter():
                txt = (node.attrib.get('text') or node.attrib.get('content-desc') or '').strip().lower()
                if any(tag in txt for tag in ('sysdump', 'silent log', 'silentlog', 'copy kernel log', 'cp based log')):
                    return True
            return False

        has_sysdump = _has_sysdump_markers(root) if root is not None else False

        # 3) UI : taper Silent log et désactiver
        ui_success = False
        if has_sysdump:
            for _ in range(6):
                if self._tap_by_text('Silent log') or self._tap_by_text('SilentLog') or self._tap_by_text('Silent logging'):
                    time.sleep(0.5)
                    # on vise RF ou l’option active, puis DPAD pour OK
                    for __ in range(6):
                        if self._tap_by_text('RF') or self._tap_by_text('CP') or self._tap_by_text('MODEM'):
                            ui_success = True
                            break
                        self._scroll_down()
                    # DPAD pour aller sur OK après sélection
                    dpad_ok = [
                        ('KEYCODE_DPAD_DOWN', 6),
                        ('KEYCODE_DPAD_RIGHT', 1),
                        ('KEYCODE_DPAD_CENTER', 1),
                    ]
                    for key, count in dpad_ok:
                        for _ in range(count):
                            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', key])
                            time.sleep(0.3)
                    break
                self._scroll_down()

        state_confirmed = has_sysdump
        success = any(a['success'] for a in attempts)
        return {
            'module': 'stop_rf_logging',
            'success': success,
            'state_confirmed': state_confirmed,
            'attempts': attempts,
            'warning': None if state_confirmed else 'SysDump not confirmed; stop RF manually if still active.',
            'ui_success': ui_success,
        }

    # -----------------------------
    # UI helpers for APN (strict sequence)
    # -----------------------------
    def _ui_dump(self) -> Optional[ET.Element]:
        try:
            self.execute_command([ADB_EXECUTABLE, 'shell', 'uiautomator', 'dump', '/sdcard/window_dump.xml'])
            res = self.execute_command([ADB_EXECUTABLE, 'shell', 'cat', '/sdcard/window_dump.xml'])
            xml = res.output or ''
            if not xml:
                return None
            return ET.fromstring(xml)
        except Exception:
            return None

    def _parse_bounds_center(self, bounds: str) -> Optional[Tuple[int, int]]:
        m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds or "")
        if not m:
            return None
        l, t, r, b = map(int, m.groups())
        return (l + r) // 2, (t + b) // 2

    def _tap_by_text(self, text_substring: str, retries: int = 2) -> bool:
        """Search visible UI text/content-desc and tap center."""
        target = text_substring.lower()
        for _ in range(retries):
            root = self._ui_dump()
            if root is None:
                time.sleep(1)
                continue
            for node in root.iter():
                txt = (node.attrib.get('text') or node.attrib.get('content-desc') or '').strip()
                if target in txt.lower():
                    bounds = node.attrib.get('bounds')
                    pos = self._parse_bounds_center(bounds) if bounds else None
                    if pos:
                        self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'tap', str(pos[0]), str(pos[1])])
                        time.sleep(1)
                        return True
            time.sleep(1)
        return False

    def _scroll_down(self):
        try:
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'swipe', '500', '1500', '500', '500', '300'])
        except Exception:
            pass
        time.sleep(0.5)

    # -----------------------------
    # APN UI helper (best effort, Samsung-friendly)
    # -----------------------------
    def _apply_apn_via_settings_ui(self, apn: str) -> bool:
        """Strict sequence: Settings -> Connections -> Mobile networks -> APN list -> edit APN -> menu/save."""
        try:
            # 1) Settings root
            self.execute_command([ADB_EXECUTABLE, 'shell', 'am', 'start', '-a', 'android.settings.SETTINGS'])
            time.sleep(1)
            # 2) Connections
            if not (self._tap_by_text('Connections') or self._tap_by_text('Connexions')):
                self._scroll_down()
                if not (self._tap_by_text('Connections') or self._tap_by_text('Connexions')):
                    return False
            time.sleep(1)
            # 3) Mobile networks (descendre 6 fois puis valider)
            for _ in range(6):
                self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DPAD_DOWN'])
                time.sleep(0.2)
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DPAD_CENTER'])
            time.sleep(1)
            # 4) Access Point Names (descendre 3 fois puis valider)
            for _ in range(3):
                self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DPAD_DOWN'])
                time.sleep(0.2)
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DPAD_CENTER'])
            time.sleep(1)
            # 5) Sélection APN (tap sur premier item de la liste) sans toucher le bouton retour
            selected = False
            # Essayer de tap sur le libellé de l'APN ou sa valeur
            if self._tap_by_text('MTN CM') or self._tap_by_text('mtnwap'):
                selected = True
            else:
                # Fallback: tap coordonnées au centre de la carte (éviter la barre du haut)
                self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'tap', '540', '650'])
                selected = True
            time.sleep(1)
            if not selected:
                return False
            # 6) Dans le détail APN, cibler le champ "APN"
            if not self._tap_by_text('APN') and not self._tap_by_text("Nom du point d'accès"):
                self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DPAD_CENTER'])
            time.sleep(1)
            # Effacer et saisir la nouvelle valeur
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_MOVE_END'])
            for _ in range(25):
                self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DEL'])
                time.sleep(0.02)
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'text', apn])
            time.sleep(1)
            # 6) Valider le champ via bouton OK si présent (dialog), sinon ENTER
            if not self._tap_by_text('OK'):
                # tap approximatif bas droite (évite Cancel)
                self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'tap', '950', '1650'])
                time.sleep(0.5)
                self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_ENTER'])
            time.sleep(1)
            # Puis menu -> down 2x -> Save
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', '82'])
            time.sleep(1)
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DPAD_DOWN'])
            time.sleep(1)
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DPAD_DOWN'])
            time.sleep(1)
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_ENTER'])
            time.sleep(1)
            return True
        except Exception as exc:
            logger.debug("APN UI flow failed: %s", exc)
            return False

    def pull_device_logs(self, destination: str) -> Dict[str, Any]:
        normalized_destination = (destination or '').strip()
        if not normalized_destination:
            normalized_destination = './device_logs'
        if os.name != 'nt' and re.match(r'^[A-Za-z]:', normalized_destination):
            drive = normalized_destination[0].lower()
            remainder = normalized_destination[2:].replace('\\', '/')
            normalized_destination = f"/mnt/{drive}/{remainder.lstrip('/')}"
        target_base = Path(normalized_destination).expanduser()
        device_suffix = self.device_id or 'device'
        target_dir = target_base / device_suffix
        target_dir.mkdir(parents=True, exist_ok=True)
        result = self.execute_command([ADB_EXECUTABLE, 'pull', '/sdcard/log', str(target_dir)])
        return {
            'module': 'pull_device_logs',
            'destination': str(target_dir),
            'success': result.success,
            'output': result.output,
            'error': result.error,
        }

    def pull_rf_logs(self, destination: str) -> Dict[str, Any]:
        """Convenience wrapper for RF logs location (/sdcard/log)."""
        result = self.pull_device_logs(destination)
        result['module'] = 'pull_rf_logs'
        return result

    def run_custom_script(self, script: Optional[str]) -> Dict[str, Any]:
        """Execute custom ADB shell commands provided by the user (one per line)."""
        if not script or not str(script).strip():
            return {'module': 'custom_script', 'success': False, 'error': 'No script provided'}
        lines = [line.strip() for line in str(script).splitlines() if line.strip()]
        if not lines:
            return {'module': 'custom_script', 'success': False, 'error': 'No commands to run'}

        results = []
        for line in lines:
            # Support full adb command or plain shell snippet
            if line.startswith('adb '):
                cmd = line.split()
            else:
                cmd = [ADB_EXECUTABLE, 'shell'] + line.split()
            res = self.execute_command(cmd, timeout=60)
            results.append({'command': ' '.join(cmd), 'success': res.success, 'output': res.output, 'error': res.error})
            if not res.success:
                break

        success = all(r['success'] for r in results) and len(results) > 0
        return {
            'module': 'custom_script',
            'success': success,
            'results': results,
            'error': None if success else 'One or more commands failed',
        }

    def dial_secret_code(self, code: Optional[str]) -> Dict[str, Any]:
        """Dial a secret/USSD code (e.g., *#9900# or *101#) via keyevents + CALL."""
        if not code or not str(code).strip():
            return {'module': 'dial_secret_code', 'success': False, 'error': 'No code provided'}
        clean = str(code).strip()
        mapping = {
            '*': 'KEYCODE_STAR',
            '#': 'KEYCODE_POUND',
            '0': 'KEYCODE_0',
            '1': 'KEYCODE_1',
            '2': 'KEYCODE_2',
            '3': 'KEYCODE_3',
            '4': 'KEYCODE_4',
            '5': 'KEYCODE_5',
            '6': 'KEYCODE_6',
            '7': 'KEYCODE_7',
            '8': 'KEYCODE_8',
            '9': 'KEYCODE_9',
        }
        attempts = []
        # Open dialer
        cmd = [ADB_EXECUTABLE, 'shell', 'am', 'start', '-a', 'android.intent.action.DIAL']
        res = self.execute_command(cmd, timeout=10)
        attempts.append({'command': ' '.join(cmd), 'success': res.success, 'error': res.error})
        time.sleep(0.5)
        # Clear existing input
        for _ in range(12):
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DEL'])
            time.sleep(0.05)
        # Type code via keyevents
        for ch in clean:
            key = mapping.get(ch)
            if not key:
                return {'module': 'dial_secret_code', 'success': False, 'error': f'Unsupported character: {ch}'}
            res_key = self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', key])
            attempts.append({'command': f"{ADB_EXECUTABLE} shell input keyevent {key}", 'success': res_key.success, 'error': res_key.error})
            time.sleep(0.1)
        # Call to validate
        res_call = self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_CALL'], timeout=5)
        attempts.append({'command': f"{ADB_EXECUTABLE} shell input keyevent KEYCODE_CALL", 'success': res_call.success, 'error': res_call.error})
        time.sleep(1.0)

        return {
            'module': 'dial_secret_code',
            'success': all(a['success'] for a in attempts if a),
            'attempts': attempts,
            'code': clean,
        }

    def test_data_connection(self, target: str = "8.8.8.8", duration_seconds: int = 10, interval_seconds: float = 1.0) -> Dict[str, Any]:
        """Re-use ping module but label explicitly for data connectivity check."""
        result = self.ping_target(target=target, duration_seconds=duration_seconds, interval_seconds=interval_seconds)
        result['module'] = 'test_data_connection'
        return result

    # -----------------------------
    # Wi-Fi
    # -----------------------------
    def enable_wifi(self) -> Dict[str, Any]:
        # Check current WiFi state
        check_result = self.execute_command([ADB_EXECUTABLE, 'shell', 'dumpsys', 'wifi'])
        if check_result.success and 'Wi-Fi is enabled' in check_result.output:
            return {
                'module': 'enable_wifi', 
                'success': True, 
                'duration': 0.1, 
                'already_enabled': True,
                'message': 'WiFi is already enabled'
            }
        
        result = self.execute_command([ADB_EXECUTABLE, 'shell', 'svc', 'wifi', 'enable'])
        return {
            'module': 'enable_wifi', 
            'success': result.success, 
            'duration': result.duration, 
            'already_enabled': False,
            'error': result.error if not result.success else None
        }

    def disable_wifi(self) -> Dict[str, Any]:
        # Check current WiFi state
        check_result = self.execute_command([ADB_EXECUTABLE, 'shell', 'dumpsys', 'wifi'])
        if check_result.success and 'Wi-Fi is disabled' in check_result.output:
            return {
                'module': 'disable_wifi', 
                'success': True, 
                'duration': 0.1, 
                'already_disabled': True,
                'message': 'WiFi is already disabled'
            }
        
        result = self.execute_command([ADB_EXECUTABLE, 'shell', 'svc', 'wifi', 'disable'])
        return {
            'module': 'disable_wifi', 
            'success': result.success, 
            'duration': result.duration, 
            'already_disabled': False,
            'error': result.error if not result.success else None
        }

    # -----------------------------
    # Mobile Data
    # -----------------------------
    def enable_mobile_data(self) -> Dict[str, Any]:
        result = self.execute_command([ADB_EXECUTABLE, 'shell', 'svc', 'data', 'enable'])
        return {
            'module': 'enable_mobile_data',
            'success': result.success,
            'duration': result.duration,
            'error': result.error if not result.success else None
        }

    def disable_mobile_data(self) -> Dict[str, Any]:
        # Try UI toggle (non-root friendly)
        self.execute_command([ADB_EXECUTABLE, 'shell', 'cmd', 'statusbar', 'expand-settings'])
        time.sleep(1.0)
        self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DPAD_DOWN'])
        self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DPAD_CENTER'])
        time.sleep(1.0)
        check_result = self.execute_command([ADB_EXECUTABLE, 'shell', 'settings', 'get', 'global', 'mobile_data'])
        if check_result.success and check_result.output.strip() == '0':
            return {
                'module': 'disable_mobile_data',
                'success': True,
                'duration': 1.0,
                'already_disabled': False,
                'message': 'Mobile data disabled via UI (best effort)',
            }
        # Fallback best-effort command
        result = self.execute_command([ADB_EXECUTABLE, 'shell', 'svc', 'data', 'disable'])
        return {
            'module': 'disable_mobile_data',
            'success': result.success,
            'duration': result.duration,
            'already_disabled': False,
            'error': result.error if not result.success else None,
            'warning': 'UI toggle may require manual confirmation if device UI differs',
        }

    # -----------------------------
    # Network & Signal
    # -----------------------------
    def check_network_registration(self) -> Dict[str, Any]:
        result = self.execute_command([ADB_EXECUTABLE, 'shell', 'dumpsys', 'telephony.registry'])
        info = self._parse_registration_info(result.output) if result.success and result.output else None
        return {
            'module': 'check_network_registration',
            'success': result.success,
            'duration': result.duration,
            'error': result.error if not result.success else None,
            'registration_info': info,
        }

    def check_signal_strength(self) -> Dict[str, Any]:
        result = self.execute_command([ADB_EXECUTABLE, 'shell', 'dumpsys', 'telephony.registry'])
        return {'module': 'check_signal_strength', 'success': result.success, 'duration': result.duration, 'error': result.error if not result.success else None}

    def ping_target(self, target: str = "8.8.8.8", duration_seconds: int = 10, interval_seconds: float = 1.0) -> Dict[str, Any]:
        """Run ping from the UE toward a target for a given duration."""
        if not target or not str(target).strip():
            return {'module': 'ping', 'success': False, 'error': 'target is required'}

        # Validation/clamping to stop runaway pings
        try:
            duration_seconds = max(1, int(duration_seconds))
        except (TypeError, ValueError):
            duration_seconds = 10
        try:
            interval_seconds = float(interval_seconds)
        except (TypeError, ValueError):
            interval_seconds = 1.0
        interval_seconds = min(max(interval_seconds, 0.2), 5.0)
        count = max(1, int(math.ceil(duration_seconds / interval_seconds)))

        command = [
            ADB_EXECUTABLE, 'shell', 'ping',
            '-i', f"{interval_seconds:.2f}",
            '-c', str(count),
            '-w', str(max(duration_seconds, 5)),
            target
        ]

        start_ts = time.monotonic()
        result = self.execute_command(command, timeout=max(duration_seconds + 5, 10))
        elapsed = time.monotonic() - start_ts

        packets_tx = packets_rx = None
        packet_loss = None
        rtt = {}

        if result.output:
            # BusyBox/toolbox variants
            summary_match = re.search(
                r'(?P<tx>\d+)\s+packets transmitted,\s+(?P<rx>\d+)\s+(?:packets )?received,\s+(?P<loss>[\d\.]+)% packet loss',
                result.output,
                re.IGNORECASE
            )
            if summary_match:
                packets_tx = int(summary_match.group('tx'))
                packets_rx = int(summary_match.group('rx'))
                packet_loss = float(summary_match.group('loss'))

            rtt_match = re.search(
                r'(?:rtt|round-trip) min/avg/max/(?:mdev|stddev) = ([\d\.]+)/([\d\.]+)/([\d\.]+)/([\d\.]+) ms',
                result.output
            )
            if rtt_match:
                rtt = {
                    'min_ms': float(rtt_match.group(1)),
                    'avg_ms': float(rtt_match.group(2)),
                    'max_ms': float(rtt_match.group(3)),
                    'mdev_ms': float(rtt_match.group(4)),
                }

        success = result.success and packets_rx is not None and packets_rx > 0 and (packet_loss is None or packet_loss < 100.0)

        return {
            'module': 'ping',
            'success': success,
            'duration': result.duration,
            'duration_requested_seconds': duration_seconds,
            'duration_effective_seconds': elapsed,
            'target': target,
            'packets_transmitted': packets_tx,
            'packets_received': packets_rx,
            'packet_loss_percent': packet_loss,
            'rtt': rtt or None,
            'output': result.output,
            'error': result.error if not success else None,
        }

    # -----------------------------
    # SMS
    # -----------------------------
    def send_sms(self, number: str, message: str) -> Dict[str, Any]:
        self.execute_command([ADB_EXECUTABLE, 'shell', 'am', 'start', '-a', 'android.intent.action.SENDTO', '-d', f'sms:{number}', '--es', 'sms_body', message])
        self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_ENTER'])
        return {'module': 'send_sms', 'success': True, 'duration': 0.1}

    def delete_sms(self) -> Dict[str, Any]:
        result = self.execute_command([ADB_EXECUTABLE, 'shell', 'pm', 'clear', 'com.android.messaging'])
        return {'module': 'delete_sms', 'success': result.success, 'duration': result.duration, 'error': result.error if not result.success else None}

    # -----------------------------
    # Screenshots & Device
    # -----------------------------
    def capture_screenshot(self, filename: str = None) -> Dict[str, Any]:
        if not filename:
            filename = f"screenshot_{int(time.time())}.png"
        device_path = f"/sdcard/{filename}"
        self.execute_command([ADB_EXECUTABLE, 'shell', 'screencap', '-p', device_path])
        self.execute_command([ADB_EXECUTABLE, 'pull', device_path, filename])
        return {'module': 'capture_screenshot', 'success': True, 'duration': 0.1, 'filename': filename}

    def power_off_device(self) -> Dict[str, Any]:
        self.execute_command([ADB_EXECUTABLE, 'shell', 'reboot', '-p'])
        return {'module': 'power_off_device', 'success': True, 'duration': 0.1}

    def wake_screen(self) -> Dict[str, Any]:
        self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_WAKEUP'])
        return {'module': 'wake_screen', 'success': True, 'duration': 0.1}

    def sleep_screen(self) -> Dict[str, Any]:
        self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_POWER'])
        return {'module': 'sleep_screen', 'success': True, 'duration': 0.1}

    # -----------------------------
    # App Management
    # -----------------------------
    def install_app(self, apk_path: str, replace: bool = True) -> Dict[str, Any]:
        command = [ADB_EXECUTABLE, 'install']
        if replace:
            command.append('-r')
        command.append(apk_path)
        result = self.execute_command(command)
        return {'module': 'install_app', 'success': result.success, 'duration': result.duration, 'apk_path': apk_path, 'replace': replace, 'error': result.error if not result.success else None}

    def uninstall_app(self, package_name: str) -> Dict[str, Any]:
        result = self.execute_command([ADB_EXECUTABLE, 'uninstall', package_name])
        return {'module': 'uninstall_app', 'success': result.success, 'duration': result.duration, 'package_name': package_name, 'error': result.error if not result.success else None}

    def force_close_app(self, package_name: str) -> Dict[str, Any]:
        result = self.execute_command([ADB_EXECUTABLE, 'shell', 'am', 'force-stop', package_name])
        return {'module': 'force_close_app', 'success': result.success, 'duration': result.duration, 'package_name': package_name, 'error': result.error if not result.success else None}
