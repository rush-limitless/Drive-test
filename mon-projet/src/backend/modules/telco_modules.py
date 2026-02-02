"""Full telco automation modules for ADB."""

import logging
import os
import re
import subprocess
import time
import math
import random
import threading
import inspect
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Callable, Dict, Any, Optional, List, Tuple
from urllib.parse import quote
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
NETWORK_TYPE_CODE_MAP = {
    '1': 'GPRS',
    '2': 'EDGE',
    '3': 'UMTS',
    '4': 'CDMA',
    '5': 'EVDO_0',
    '6': 'EVDO_A',
    '7': '1XRTT',
    '8': 'HSDPA',
    '9': 'HSUPA',
    '10': 'HSPA',
    '11': 'IDEN',
    '12': 'EVDO_B',
    '13': 'LTE',
    '14': 'EHRPD',
    '15': 'HSPAP',
    '16': 'GSM',
    '17': 'TD_SCDMA',
    '18': 'IWLAN',
    '19': 'LTE_CA',
    '20': 'NR',
    '21': 'NR',
    '22': 'NR',
}
NETWORK_SOURCE_CONFIDENCE = {
    'dumpsys-registry': 0.9,
    'dumpsys-telephony': 0.8,
    'dumpsys-registry+getprop': 0.95,
    'dumpsys-telephony+getprop': 0.85,
    'getprop': 0.6,
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
APP_LAUNCHER_VIDEO_IDS = [
    "M7lc1UVf-VE",
    "kffacxfA7G4",
    "3JZ_D3ELwOQ",
    "7wtfhZwyrcc",
    "6Dh-RL__uN4",
]
APP_LAUNCHER_QUERIES = [
    "network performance automation",
    "youtube video recommendations",
    "how to optimize mobile data",
    "android adb automation tips",
    "live streaming quality test",
]
APP_LAUNCHER_MAP_LOCATIONS = [
    "Paris, France",
    "New York, NY",
    "San Francisco, CA",
    "Berlin, Germany",
    "Tokyo, Japan",
]
APP_LAUNCHER_MAP_TRAFFIC_QUERY_LOCATIONS = [
    "Paris, France",
    "New York, NY",
    "San Francisco, CA",
]
APP_LAUNCHER_CHROME_NEWS_SITES = [
    "https://news.google.com/topstories?hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNR1F3T1dJQ0FtVnVNREZqYldFa0Vn?hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNR3R1YlRjQkFtVnVNREZqYldFa0Vn?hl=en-US&gl=US&ceid=US:en",
    "https://www.bloomberg.com",
    "https://www.ft.com",
]
APP_LAUNCHER_PACKAGE_MAP = {
    "youtube": "com.google.android.youtube",
    "google": "com.google.android.googlequicksearchbox",
    "maps": "com.google.android.apps.maps",
    "maps_traffic": "com.google.android.apps.maps",
    "chrome_news": "com.android.chrome",
}
APP_LAUNCHER_DEFAULT = "youtube"


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
    if upper in {'UNKNOWN', 'N/A', 'NONE', 'NULL'}:
        return None
    if upper.isdigit() and upper in NETWORK_TYPE_CODE_MAP:
        upper = NETWORK_TYPE_CODE_MAP[upper]
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
    """Extended telco automation modules."""

    _NETWORK_CACHE_TTL_SECONDS = 1.5
    _network_registration_cache: Dict[str, Dict[str, Any]] = {}
    _network_registration_cache_ts: Dict[str, float] = {}

    def _cache_key(self) -> str:
        return self.device_id or "default"

    def _get_cached_network_registration(self) -> Optional[Dict[str, Any]]:
        key = self._cache_key()
        cached = self._network_registration_cache.get(key)
        cached_ts = self._network_registration_cache_ts.get(key)
        if cached is None or cached_ts is None:
            return None
        if time.monotonic() - cached_ts <= self._NETWORK_CACHE_TTL_SECONDS:
            return cached
        return None

    def _set_cached_network_registration(self, payload: Dict[str, Any]) -> None:
        key = self._cache_key()
        self._network_registration_cache[key] = payload
        self._network_registration_cache_ts[key] = time.monotonic()

    def _is_permission_denied(self, result: ExecutionResult) -> bool:
        haystack = f"{result.output}\n{result.error}".lower()
        return any(
            token in haystack
            for token in (
                "permission denial",
                "securityexception",
                "not allowed",
                "requires android.permission.dump",
                "permission denied",
            )
        )

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
        data_network_raw = extract('mDataNetworkType')
        voice_network_raw = extract('mVoiceNetworkType')
        network_type_raw = data_network_raw or voice_network_raw
        network_label = _format_network_label(network_type_raw) if network_type_raw else None
        data_network_label = _format_network_label(data_network_raw) if data_network_raw else None
        voice_network_label = _format_network_label(voice_network_raw) if voice_network_raw else None
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
        if data_network_label:
            info['data_network_technology'] = data_network_label
        if voice_network_label:
            info['voice_network_technology'] = voice_network_label
        if emergency_only is not None:
            info['emergency_only'] = emergency_only

        sim_slots = self._parse_sim_slots(payload)
        if sim_slots:
            info['sim_slots'] = sim_slots
            first_slot = sim_slots[0]
            if not info.get('operator'):
                info['operator'] = first_slot.get('operator')
            if not info.get('operator_numeric'):
                info['operator_numeric'] = first_slot.get('operator_numeric')
            if not info.get('network_technology'):
                info['network_technology'] = first_slot.get('network_technology')

        return info or None

    def _parse_sim_slots(self, payload: str) -> List[Dict[str, Any]]:
        slots: List[Dict[str, Any]] = []
        matches = list(re.finditer(r"Phone Id(?:=|:)\s*(\d+)", payload))
        if not matches:
            return slots

        for index, match in enumerate(matches):
            slot_index = int(match.group(1))
            section_start = match.end()
            section_end = matches[index + 1].start() if index + 1 < len(matches) else len(payload)
            section = payload[section_start:section_end]

            operator = (
                _clean_operator_label(_extract_field(section, 'mOperatorAlphaShort'))
                or _clean_operator_label(_extract_field(section, 'mOperatorAlphaLong'))
            )
            operator_numeric = _extract_field(section, 'mOperatorNumeric')
            service_state = _normalize_state_value(_extract_field(section, 'mServiceState'))
            voice_state = _normalize_state_value(_extract_field(section, 'mVoiceRegState') or _extract_field(section, 'mVoiceServiceState'))
            data_state = _normalize_state_value(_extract_field(section, 'mDataRegState') or _extract_field(section, 'mDataServiceState'))
            data_connection = _normalize_state_value(_extract_field(section, 'mDataConnectionState'))
            data_network_raw = _extract_field(section, 'mDataNetworkType')
            voice_network_raw = _extract_field(section, 'mVoiceNetworkType')
            network_type_raw = data_network_raw or voice_network_raw
            network_label = _format_network_label(network_type_raw) if network_type_raw else None
            data_network_label = _format_network_label(data_network_raw) if data_network_raw else None
            voice_network_label = _format_network_label(voice_network_raw) if voice_network_raw else None

            slot_info = {
                'slot_index': slot_index,
                'operator': operator,
                'operator_numeric': operator_numeric,
                'service_state': service_state,
                'voice_state': voice_state,
                'data_state': data_state,
                'data_connection_state': data_connection,
                'network_technology': network_label or (network_type_raw.upper() if network_type_raw else None),
                'data_network_technology': data_network_label,
                'voice_network_technology': voice_network_label,
            }
            slots.append({k: v for k, v in slot_info.items() if v is not None})

        return slots

    def _getprop_value(self, key: str) -> Optional[str]:
        result = self.execute_command([ADB_EXECUTABLE, 'shell', 'getprop', key])
        if not result.success or result.output is None:
            return None
        return result.output.strip() or None

    def _split_prop_list(self, value: Optional[str]) -> List[str]:
        if not value:
            return []
        return [entry.strip() for entry in value.split(',') if entry.strip()]

    def _collect_prop_values(self, keys: List[str], max_slots: int = 4) -> List[str]:
        values: List[str] = []
        for key in keys:
            base = self._getprop_value(key)
            values = self._split_prop_list(base)
            if values:
                break

        suffix_values: List[str] = []
        for key in keys:
            for idx in range(1, max_slots + 1):
                slot_value = self._getprop_value(f"{key}.{idx}")
                if slot_value:
                    suffix_values.append(slot_value.strip())
            if suffix_values:
                break

        if not values:
            values = suffix_values
        elif suffix_values:
            for idx, value in enumerate(suffix_values):
                if idx < len(values):
                    if not values[idx]:
                        values[idx] = value
                else:
                    values.append(value)

        return values

    def _read_getprop_network_info(self) -> Optional[Dict[str, Any]]:
        operator_list = self._collect_prop_values(['gsm.operator.alpha', 'gsm.sim.operator.alpha'])
        numeric_list = self._collect_prop_values(['gsm.operator.numeric', 'gsm.sim.operator.numeric'])
        data_type_list = self._collect_prop_values(['gsm.data.network.type'])
        voice_type_list = self._collect_prop_values(['gsm.network.type', 'gsm.voice.network.type'])

        slot_count = max(len(operator_list), len(numeric_list), len(data_type_list), len(voice_type_list))
        if slot_count == 0:
            return None

        sim_slots: List[Dict[str, Any]] = []
        for idx in range(slot_count):
            op = operator_list[idx] if idx < len(operator_list) else None
            num = numeric_list[idx] if idx < len(numeric_list) else None
            data_net = data_type_list[idx] if idx < len(data_type_list) else None
            voice_net = voice_type_list[idx] if idx < len(voice_type_list) else None
            network_raw = data_net or voice_net
            slot = {
                'slot_index': idx,
                'operator': _clean_operator_label(op),
                'operator_numeric': num,
                'network_technology': _format_network_label(network_raw) if network_raw else None,
                'data_network_technology': _format_network_label(data_net) if data_net else None,
                'voice_network_technology': _format_network_label(voice_net) if voice_net else None,
            }
            sim_slots.append({k: v for k, v in slot.items() if v is not None})

        info = {
            'operator': sim_slots[0].get('operator') if sim_slots else None,
            'operator_numeric': sim_slots[0].get('operator_numeric') if sim_slots else None,
            'network_technology': sim_slots[0].get('network_technology') if sim_slots else None,
            'data_network_technology': sim_slots[0].get('data_network_technology') if sim_slots else None,
            'voice_network_technology': sim_slots[0].get('voice_network_technology') if sim_slots else None,
            'sim_slots': sim_slots,
        }
        return {k: v for k, v in info.items() if v is not None}

    def _read_dumpsys_telephony_info(self) -> Optional[Dict[str, Any]]:
        result = self.execute_command([ADB_EXECUTABLE, 'shell', 'dumpsys', 'telephony'])
        if not result.success or not result.output or self._is_permission_denied(result):
            return None
        return self._parse_registration_info(result.output)

    def _is_app_running(self, package: str) -> bool:
        if not package:
            return False
        result = self.execute_command([ADB_EXECUTABLE, 'shell', 'pidof', package])
        return bool(result.success and result.output and result.output.strip())

    def _is_app_installed(self, package: str) -> bool:
        if not package:
            return False
        result = self.execute_command([ADB_EXECUTABLE, 'shell', 'pm', 'list', 'packages', package])
        if not result.success or not result.output:
            return False
        return package in result.output
    
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
                'already_on': enable,
                'already_off': not enable,
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
            'already_on': success and enable and bool(final_state),
            'already_off': success and not enable and final_state is False,
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

        def _parse_carriers_row(output: Optional[str]) -> Dict[str, Optional[str]]:
            if not output:
                return {'name': None, 'apn': None, 'id': None}
            # Example: Row: 0 _id=23 name=MTN CM apn=mtnwap ...
            name_match = re.search(r'\bname=([^\s]+)', output)
            apn_match = re.search(r'\bapn=([^\s]+)', output)
            id_match = re.search(r'\b_id=([0-9]+)', output)
            return {
                'name': name_match.group(1) if name_match else None,
                'apn': apn_match.group(1) if apn_match else None,
                'id': id_match.group(1) if id_match else None,
            }

        # Best-effort read of current selected APN from content provider (may require root)
        current_preferapn_cmd = [ADB_EXECUTABLE, 'shell', 'content', 'query', '--uri', 'content://telephony/carriers/preferapn']
        current_preferapn = self.execute_command(current_preferapn_cmd)
        current_preferapn_parsed = _parse_carriers_row(current_preferapn.output if current_preferapn.success else None)

        # Check current APN settings
        current_tether = self.execute_command([ADB_EXECUTABLE, 'shell', 'settings', 'get', 'global', 'tether_dun_apn'])
        current_preferred = self.execute_command([ADB_EXECUTABLE, 'shell', 'settings', 'get', 'global', 'preferred_apn'])
        logger.debug(
            "Current APN values | tether_dun_apn=%s | preferred_apn=%s | preferapn_name=%s | preferapn_apn=%s",
            current_tether.output,
            current_preferred.output,
            current_preferapn_parsed.get('name'),
            current_preferapn_parsed.get('apn'),
        )

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
        ui_ok: Optional[bool] = None

        verify_commands = [
            [ADB_EXECUTABLE, 'shell', 'settings', 'get', 'global', 'tether_dun_apn'],
            [ADB_EXECUTABLE, 'shell', 'settings', 'get', 'global', 'preferred_apn'],
        ]

        def verify_apn() -> Tuple[bool, List[ExecutionResult]]:
            verify_results = [self.execute_command(cmd) for cmd in verify_commands]
            confirmed = all(apn in (res.output or '') for res in verify_results if res.success)
            logger.debug("Verification results | tether_dun_apn=%s | preferred_apn=%s | confirmed=%s",
                         verify_results[0].output if verify_results else None,
                         verify_results[1].output if len(verify_results) > 1 else None,
                         confirmed)
            return confirmed, verify_results

        confirmed, verify_results = verify_apn()

        if use_ui_flow:
            ui_flow_attempted = True
            ui_ok = self._apply_apn_via_settings_ui(apn)
            ui_flow_note = "APN Settings UI sequence executed (best effort); verify on device."
            if ui_ok:
                logger.info("APN UI flow executed (best effort) for value: %s", apn)
            else:
                logger.warning("APN UI flow could not confirm UI interactions; falling back to settings.put only")
            confirmed, verify_results = verify_apn()
            if not ui_ok:
                confirmed = False

        step_failure = next((res for res in results if not res.success), None)
        error_msg = None
        if step_failure:
            error_msg = step_failure.error or "APN write command failed"
        elif not confirmed:
            error_msg = "APN not confirmed on device (best-effort)"
            logger.warning("APN verification failed for value '%s' (device may not accept settings.put)", apn)

        success = all(res.success for res in results) and confirmed and (not use_ui_flow or ui_ok)
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
            'current_preferapn': current_preferapn_parsed,
            'ui_flow_attempted': ui_flow_attempted,
            'ui_verified': ui_ok,
            'ui_flow_note': ui_flow_note,
            'steps': [{'command': ' '.join(cmd), 'success': res.success, 'error': res.error} for cmd, res in zip(commands, results)],
            'preferapn': {'command': ' '.join(current_preferapn_cmd), 'success': current_preferapn.success, 'output': current_preferapn.output, 'error': current_preferapn.error},
            'verify': [{'command': ' '.join(cmd), 'success': res.success, 'output': res.output, 'error': res.error} for cmd, res in zip(verify_commands, verify_results)],
            'warning': None if confirmed else 'APN not confirmed on device (best-effort)',
            'error': error_msg,
            'message': ("APN was already set; re-applied for verification" if was_already_set else "APN applied"),
        }

    def start_rf_logging(self, cancel_event: Optional[threading.Event] = None) -> Dict[str, Any]:
        """Best-effort start of RF logging via SysDump/secret code (non-root, DPAD)."""
        attempts = []
        def _cancelled() -> bool:
            return bool(cancel_event and cancel_event.is_set())
        if _cancelled():
            return {'module': 'start_rf_logging', 'success': False, 'cancelled': True, 'error': 'Execution cancelled'}

        # 1) Open dialer
        cmd = [ADB_EXECUTABLE, 'shell', 'am', 'start', '-a', 'android.intent.action.DIAL']
        res = self.execute_command(cmd, timeout=10)
        attempts.append({'command': ' '.join(cmd), 'success': res.success, 'error': res.error.strip() if res.error else None})
        time.sleep(0.5)
        if _cancelled():
            return {'module': 'start_rf_logging', 'success': False, 'cancelled': True, 'error': 'Execution cancelled', 'attempts': attempts}
        # Clear any existing input
        for _ in range(12):
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DEL'])
            time.sleep(0.05)
            if _cancelled():
                return {'module': 'start_rf_logging', 'success': False, 'cancelled': True, 'error': 'Execution cancelled', 'attempts': attempts}
        # Enter *#9900# via keyevents for reliability
        for key in ('KEYCODE_STAR', 'KEYCODE_POUND', 'KEYCODE_9', 'KEYCODE_9', 'KEYCODE_0', 'KEYCODE_0', 'KEYCODE_POUND'):
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', key])
            time.sleep(0.1)
            if _cancelled():
                return {'module': 'start_rf_logging', 'success': False, 'cancelled': True, 'error': 'Execution cancelled', 'attempts': attempts}
        # Alternate validation: ENTER then broadcast secret code (avoids voice calls)
        enter_cmd = [ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_ENTER']
        res_enter = self.execute_command(enter_cmd, timeout=5)
        attempts.append({'command': ' '.join(enter_cmd), 'success': res_enter.success, 'error': res_enter.error.strip() if res_enter.error else None})
        time.sleep(0.8)
        if _cancelled():
            return {'module': 'start_rf_logging', 'success': False, 'cancelled': True, 'error': 'Execution cancelled', 'attempts': attempts}
        broadcast_cmd = [ADB_EXECUTABLE, 'shell', 'am', 'broadcast', '-a', 'android.provider.Telephony.SECRET_CODE', '-d', 'android_secret_code://9900']
        res_bc = self.execute_command(broadcast_cmd, timeout=5)
        attempts.append({'command': ' '.join(broadcast_cmd), 'success': res_bc.success, 'error': res_bc.error.strip() if res_bc.error else None})
        time.sleep(0.8)
        if _cancelled():
            return {'module': 'start_rf_logging', 'success': False, 'cancelled': True, 'error': 'Execution cancelled', 'attempts': attempts}

        # 2) Check if the Silent log screen is present before navigating (avoid typing in the dialer otherwise)
        root = self._ui_dump()

        def _has_sysdump_markers(r: ET.Element) -> bool:
            for node in r.iter():
                txt = (node.attrib.get('text') or node.attrib.get('content-desc') or '').strip().lower()
                if 'silent log' in txt or 'silentlog' in txt:
                    return True
            return False

        has_silent_log = _has_sysdump_markers(root) if root is not None else False

        # 3) UI attempt: search for "Silent log" and "RF"
        ui_success = False
        if has_silent_log:
            for _ in range(6):
                if _cancelled():
                    return {'module': 'start_rf_logging', 'success': False, 'cancelled': True, 'error': 'Execution cancelled', 'attempts': attempts}
                if self._tap_by_text('Silent log') or self._tap_by_text('SilentLog') or self._tap_by_text('Silent logging'):
                    time.sleep(0.5)
                    for __ in range(6):
                        if _cancelled():
                            return {'module': 'start_rf_logging', 'success': False, 'cancelled': True, 'error': 'Execution cancelled', 'attempts': attempts}
                        if self._tap_by_text('RF') or self._tap_by_text('CP') or self._tap_by_text('MODEM'):
                            ui_success = True
                            break
                        self._scroll_down()
                    break
                self._scroll_down()

            # DPAD to confirm "OK" in the RF dialog (down 6 times, right, center)
            dpad_ok = [
                ('KEYCODE_DPAD_DOWN', 6),  # move down to OK
                ('KEYCODE_DPAD_RIGHT', 1),
                ('KEYCODE_DPAD_CENTER', 1),
            ]
            for key, count in dpad_ok:
                for _ in range(count):
                    if _cancelled():
                        return {'module': 'start_rf_logging', 'success': False, 'cancelled': True, 'error': 'Execution cancelled', 'attempts': attempts}
                    self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', key])
                    time.sleep(0.3)

        # 4) Status: consider it successful if the dial/broadcast sequence was sent,
        # also add a warning if the presence of SysDump is not confirmed.
        state_confirmed = has_silent_log
        success = any(a['success'] for a in attempts)  # do not block on missing dump/ls
        return {
            'module': 'start_rf_logging',
            'success': success,
            'already_active': False,
            'state_confirmed': state_confirmed,
            'attempts': attempts,
            'warning': None if state_confirmed else 'Silent log screen not confirmed; open menu manually if needed, then rerun.',
        }

    def stop_rf_logging(self, cancel_event: Optional[threading.Event] = None) -> Dict[str, Any]:
        """Best-effort stop of RF logging, same process as start (keyevents + broadcast + DPAD)."""
        attempts = []
        def _cancelled() -> bool:
            return bool(cancel_event and cancel_event.is_set())
        if _cancelled():
            return {'module': 'stop_rf_logging', 'success': False, 'cancelled': True, 'error': 'Execution cancelled'}
        # 1) Open dialer
        cmd = [ADB_EXECUTABLE, 'shell', 'am', 'start', '-a', 'android.intent.action.DIAL']
        res = self.execute_command(cmd, timeout=10)
        attempts.append({'command': ' '.join(cmd), 'success': res.success, 'error': res.error.strip() if res.error else None})
        time.sleep(0.5)
        if _cancelled():
            return {'module': 'stop_rf_logging', 'success': False, 'cancelled': True, 'error': 'Execution cancelled', 'attempts': attempts}
        # Clear any existing input
        for _ in range(12):
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DEL'])
            time.sleep(0.05)
            if _cancelled():
                return {'module': 'stop_rf_logging', 'success': False, 'cancelled': True, 'error': 'Execution cancelled', 'attempts': attempts}
        # Enter *#9900# via keyevents
        for key in ('KEYCODE_STAR', 'KEYCODE_POUND', 'KEYCODE_9', 'KEYCODE_9', 'KEYCODE_0', 'KEYCODE_0', 'KEYCODE_POUND'):
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', key])
            time.sleep(0.1)
            if _cancelled():
                return {'module': 'stop_rf_logging', 'success': False, 'cancelled': True, 'error': 'Execution cancelled', 'attempts': attempts}
        # Validation: ENTER + broadcast secret code (avoids voice calls)
        enter_cmd = [ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_ENTER']
        res_enter = self.execute_command(enter_cmd, timeout=5)
        attempts.append({'command': ' '.join(enter_cmd), 'success': res_enter.success, 'error': res_enter.error.strip() if res_enter.error else None})
        time.sleep(0.8)
        if _cancelled():
            return {'module': 'stop_rf_logging', 'success': False, 'cancelled': True, 'error': 'Execution cancelled', 'attempts': attempts}
        broadcast_cmd = [ADB_EXECUTABLE, 'shell', 'am', 'broadcast', '-a', 'android.provider.Telephony.SECRET_CODE', '-d', 'android_secret_code://9900']
        res_bc = self.execute_command(broadcast_cmd, timeout=5)
        attempts.append({'command': ' '.join(broadcast_cmd), 'success': res_bc.success, 'error': res_bc.error.strip() if res_bc.error else None})
        time.sleep(0.8)
        if _cancelled():
            return {'module': 'stop_rf_logging', 'success': False, 'cancelled': True, 'error': 'Execution cancelled', 'attempts': attempts}

        # 2) Check for the Silent log menu
        root = self._ui_dump()

        def _has_sysdump_markers(r: ET.Element) -> bool:
            for node in r.iter():
                txt = (node.attrib.get('text') or node.attrib.get('content-desc') or '').strip().lower()
                if 'silent log' in txt or 'silentlog' in txt:
                    return True
            return False

        has_silent_log = _has_sysdump_markers(root) if root is not None else False

        # 3) UI: type Silent log and disable it
        ui_success = False
        if has_silent_log:
            for _ in range(6):
                if _cancelled():
                    return {'module': 'stop_rf_logging', 'success': False, 'cancelled': True, 'error': 'Execution cancelled', 'attempts': attempts}
                if self._tap_by_text('Silent log') or self._tap_by_text('SilentLog') or self._tap_by_text('Silent logging'):
                    time.sleep(0.5)
                    # target RF or the active option, then DPAD to OK
                    for __ in range(6):
                        if _cancelled():
                            return {'module': 'stop_rf_logging', 'success': False, 'cancelled': True, 'error': 'Execution cancelled', 'attempts': attempts}
                        if self._tap_by_text('RF') or self._tap_by_text('CP') or self._tap_by_text('MODEM'):
                            ui_success = True
                            break
                        self._scroll_down()
                    # DPAD to reach OK after selection
                    dpad_ok = [
                        ('KEYCODE_DPAD_DOWN', 6),
                        ('KEYCODE_DPAD_RIGHT', 1),
                        ('KEYCODE_DPAD_CENTER', 1),
                    ]
                    for key, count in dpad_ok:
                        for _ in range(count):
                            if _cancelled():
                                return {'module': 'stop_rf_logging', 'success': False, 'cancelled': True, 'error': 'Execution cancelled', 'attempts': attempts}
                            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', key])
                            time.sleep(0.3)
                    break
                self._scroll_down()

        state_confirmed = has_silent_log
        success = any(a['success'] for a in attempts)
        return {
            'module': 'stop_rf_logging',
            'success': success,
            'state_confirmed': state_confirmed,
            'attempts': attempts,
            'warning': None if state_confirmed else 'Silent log menu not confirmed; stop RF manually if still active.',
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

    def _tap_by_resource_id(self, resource_id_substring: str, retries: int = 2) -> bool:
        target = resource_id_substring.lower()
        for _ in range(retries):
            root = self._ui_dump()
            if root is None:
                time.sleep(1)
                continue
            for node in root.iter():
                res_id = (node.attrib.get('resource-id') or '').lower()
                if target in res_id:
                    bounds = node.attrib.get('bounds')
                    pos = self._parse_bounds_center(bounds) if bounds else None
                    if pos:
                        self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'tap', str(pos[0]), str(pos[1])])
                        time.sleep(1)
                        return True
            time.sleep(1)
        return False

    def _tap_best_apn_entry(self) -> bool:
        root = self._ui_dump()
        if root is None:
            return False

        entries = []

        def parse_bounds(bounds: str):
            m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds or "")
            if not m:
                return None
            left, top, right, bottom = map(int, m.groups())
            return left, top, right, bottom

        def walk(node, parent=None):
            bounds = node.attrib.get('bounds')
            rect = parse_bounds(bounds) if bounds else None
            pos = None
            if rect:
                left, top, right, bottom = rect
                pos = ((left + right) // 2, (top + bottom) // 2)
            entry = {
                'node': node,
                'parent': parent,
                'rect': rect,
                'pos': pos,
                'text': (node.attrib.get('text') or node.attrib.get('content-desc') or '').strip(),
                'class': (node.attrib.get('class') or '').lower(),
                'resource_id': (node.attrib.get('resource-id') or '').lower(),
                'checked': node.attrib.get('checked') == 'true',
                'selected': node.attrib.get('selected') == 'true',
                'clickable': node.attrib.get('clickable') == 'true',
            }
            entries.append(entry)
            for child in list(node):
                walk(child, entry)

        walk(root, None)

        def is_header(label: str) -> bool:
            lower = label.lower()
            return any(token in lower for token in (
                'access point names',
                "nom des points d'acc",
                "access point name",
                'add',
                'ajouter',
            ))

        def tap_entry(entry: dict) -> bool:
            if not entry.get('pos'):
                return False
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'tap', str(entry['pos'][0]), str(entry['pos'][1])])
            time.sleep(1)
            return True

        def tap_rect(rect: tuple, bias: float = 0.6) -> bool:
            left, top, right, bottom = rect
            width = right - left
            height = bottom - top
            if width <= 0 or height <= 0:
                return False
            x = int(left + max(20, min(width - 20, width * bias)))
            y = int((top + bottom) // 2)
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'tap', str(x), str(y)])
            time.sleep(1)
            return True

        def prefer_row_text(y_center: int) -> Optional[dict]:
            best = None
            best_delta = None
            for entry in entries:
                rect = entry.get('rect')
                if not rect:
                    continue
                if not entry['text'] or is_header(entry['text']):
                    continue
                left, top, right, bottom = rect
                if top <= y_center <= bottom:
                    delta = abs(((top + bottom) // 2) - y_center)
                    if best is None or delta < best_delta:
                        best = entry
                        best_delta = delta
            return best

        def resolve_click_target(entry: dict) -> Optional[dict]:
            current = entry
            while current:
                if current.get('rect') and current['clickable'] and not (current['text'] and is_header(current['text'])):
                    return current
                current = current.get('parent')
            return None

        checked_entries = [e for e in entries if (e['checked'] or e['selected']) and not (e['text'] and is_header(e['text']))]
        for entry in checked_entries:
            target = resolve_click_target(entry)
            if target and tap_entry(target):
                return True
            if entry.get('rect'):
                _, top, _, bottom = entry['rect']
                row_target = prefer_row_text((top + bottom) // 2)
                if row_target and row_target.get('rect') and tap_rect(row_target['rect'], bias=0.7):
                    return True

        prioritized = [e for e in entries if e['text'] and not is_header(e['text'])]
        prioritized.sort(key=lambda e: (e['rect'][1] if e['rect'] else 10**9))

        for entry in prioritized:
            if 'checkedtextview' in entry['class'] or 'apn' in entry['resource_id'] or 'carrier' in entry['resource_id']:
                if entry['clickable'] and tap_entry(entry):
                    return True
                if entry.get('rect') and tap_rect(entry['rect'], bias=0.7):
                    return True

        for entry in prioritized:
            if entry['clickable'] and tap_entry(entry):
                return True
            if entry.get('rect') and tap_rect(entry['rect'], bias=0.7):
                return True

        return False

    def _tap_selected_apn_entry(self) -> bool:
        """Tap only the currently selected/checked APN entry. No name matching or fallbacks."""
        root = self._ui_dump()
        if root is None:
            logger.debug("APN UI dump unavailable; cannot resolve selected APN entry.")
            return False

        entries = []

        def parse_bounds(bounds: str):
            m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds or "")
            if not m:
                return None
            left, top, right, bottom = map(int, m.groups())
            return left, top, right, bottom

        def walk(node, parent=None):
            bounds = node.attrib.get('bounds')
            rect = parse_bounds(bounds) if bounds else None
            pos = None
            if rect:
                left, top, right, bottom = rect
                pos = ((left + right) // 2, (top + bottom) // 2)
            entry = {
                'node': node,
                'parent': parent,
                'rect': rect,
                'pos': pos,
                'text': (node.attrib.get('text') or node.attrib.get('content-desc') or '').strip(),
                'class': (node.attrib.get('class') or '').lower(),
                'resource_id': (node.attrib.get('resource-id') or '').lower(),
                'checked': node.attrib.get('checked') == 'true',
                'selected': node.attrib.get('selected') == 'true',
                'clickable': node.attrib.get('clickable') == 'true',
            }
            entries.append(entry)
            for child in list(node):
                walk(child, entry)

        walk(root, None)

        def is_header(label: str) -> bool:
            lower = label.lower()
            return any(token in lower for token in (
                'access point names',
                "nom des points d'acc",
                "access point name",
                'add',
                'ajouter',
            ))

        def resolve_click_target(entry: dict) -> Optional[dict]:
            current = entry
            while current:
                if current.get('rect') and current['clickable'] and not (current['text'] and is_header(current['text'])):
                    return current
                current = current.get('parent')
            return None

        def tap_entry(entry: dict) -> bool:
            if not entry.get('pos'):
                return False
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'tap', str(entry['pos'][0]), str(entry['pos'][1])])
            time.sleep(1)
            return True

        def tap_rect(rect: tuple, bias: float = 0.7) -> bool:
            left, top, right, bottom = rect
            width = right - left
            height = bottom - top
            if width <= 0 or height <= 0:
                return False
            x = int(left + max(20, min(width - 20, width * bias)))
            y = int((top + bottom) // 2)
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'tap', str(x), str(y)])
            time.sleep(1)
            return True

        def prefer_row_text(y_center: int) -> Optional[dict]:
            best = None
            best_delta = None
            for entry in entries:
                rect = entry.get('rect')
                if not rect:
                    continue
                if not entry['text'] or is_header(entry['text']):
                    continue
                left, top, right, bottom = rect
                if top <= y_center <= bottom:
                    delta = abs(((top + bottom) // 2) - y_center)
                    if best is None or delta < best_delta:
                        best = entry
                        best_delta = delta
            return best

        selected_entries = [
            e for e in entries
            if (e['checked'] or e['selected']) and not (e['text'] and is_header(e['text']))
        ]
        if not selected_entries:
            logger.debug("No checked/selected APN entries found in UI dump.")
        for entry in selected_entries:
            target = resolve_click_target(entry)
            if target and tap_entry(target):
                return True
            # If the checked node is a radio button, tap the row instead of the tiny control.
            if entry.get('rect'):
                _, top, _, bottom = entry['rect']
                row_target = prefer_row_text((top + bottom) // 2)
                if row_target and row_target.get('rect') and tap_rect(row_target['rect'], bias=0.7):
                    logger.debug("Tapped APN row based on selected radio button.")
                    return True
            if tap_entry(entry):
                return True

        return False

    def _get_selected_apn_label(self) -> Optional[str]:
        """Best-effort: return the label of the selected APN from the APN list UI."""
        root = self._ui_dump()
        if root is None:
            return None

        entries = []

        def parse_bounds(bounds: str):
            m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds or "")
            if not m:
                return None
            left, top, right, bottom = map(int, m.groups())
            return left, top, right, bottom

        def walk(node):
            bounds = node.attrib.get('bounds')
            rect = parse_bounds(bounds) if bounds else None
            entry = {
                'rect': rect,
                'text': (node.attrib.get('text') or node.attrib.get('content-desc') or '').strip(),
                'checked': node.attrib.get('checked') == 'true',
                'selected': node.attrib.get('selected') == 'true',
            }
            entries.append(entry)
            for child in list(node):
                walk(child)

        walk(root)

        def is_header(label: str) -> bool:
            lower = label.lower()
            return any(token in lower for token in (
                'access point names',
                "nom des points d'acc",
                "access point name",
                'add',
                'ajouter',
            ))

        checked_entries = [
            e for e in entries
            if (e['checked'] or e['selected'])
        ]
        for entry in checked_entries:
            if entry['text'] and not is_header(entry['text']):
                return entry['text']
            if entry.get('rect'):
                _, top, _, bottom = entry['rect']
                y_center = (top + bottom) // 2
                for candidate in entries:
                    rect = candidate.get('rect')
                    if not rect or not candidate['text'] or is_header(candidate['text']):
                        continue
                    left, top, right, bottom = rect
                    if top <= y_center <= bottom:
                        return candidate['text']
        return None

    def _apn_name_matches_by_letters(self, selected_name: str, target_apn: str) -> bool:
        """Approximate match: at least one letter in common (A-Z)."""
        if not selected_name or not target_apn:
            return False
        selected_letters = set(re.findall(r'[a-z]', selected_name.lower()))
        target_letters = set(re.findall(r'[a-z]', target_apn.lower()))
        return len(selected_letters & target_letters) > 0

    def _read_apn_field_value(self) -> Optional[str]:
        """Best-effort: read current APN field value from the APN detail screen UI."""
        root = self._ui_dump()
        if root is None:
            return None

        entries = []

        def parse_bounds(bounds: str):
            m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", bounds or "")
            if not m:
                return None
            left, top, right, bottom = map(int, m.groups())
            return left, top, right, bottom

        def walk(node, parent=None):
            bounds = node.attrib.get('bounds')
            rect = parse_bounds(bounds) if bounds else None
            text = (node.attrib.get('text') or node.attrib.get('content-desc') or '').strip()
            entry = {
                'node': node,
                'parent': parent,
                'rect': rect,
                'text': text,
                'class': (node.attrib.get('class') or '').lower(),
                'resource_id': (node.attrib.get('resource-id') or '').lower(),
            }
            entries.append(entry)
            for child in list(node):
                walk(child, entry)

        walk(root, None)

        label_tokens = {
            'apn',
            'access point name',
            "nom du point d'accès",
        }

        def is_label(text: str) -> bool:
            lower = text.lower()
            return lower in label_tokens

        # 1) Prefer editable field value
        for entry in entries:
            if 'edittext' in entry['class'] or 'textinput' in entry['class']:
                if entry['text']:
                    return entry['text']

        # 2) Find row where label is "APN" and take nearest value on same row
        for entry in entries:
            if not entry['text'] or not is_label(entry['text']):
                continue
            rect = entry.get('rect')
            if not rect:
                continue
            _, top, _, bottom = rect
            y_center = (top + bottom) // 2
            candidates = []
            for other in entries:
                if not other['text'] or is_label(other['text']):
                    continue
                orect = other.get('rect')
                if not orect:
                    continue
                oleft, otop, oright, obottom = orect
                if otop <= y_center <= obottom:
                    candidates.append(other)
            if candidates:
                candidates.sort(key=lambda e: (e['rect'][0] if e['rect'] else 0), reverse=True)
                return candidates[0]['text']

        return None
        candidates = []
        for node in root.iter():
            bounds = node.attrib.get('bounds')
            if not bounds:
                continue
            pos = self._parse_bounds_center(bounds)
            if not pos:
                continue
            text = (node.attrib.get('text') or node.attrib.get('content-desc') or '').strip()
            class_name = (node.attrib.get('class') or '').lower()
            resource_id = (node.attrib.get('resource-id') or '').lower()
            checked = node.attrib.get('checked') == 'true'
            selected = node.attrib.get('selected') == 'true'
            clickable = node.attrib.get('clickable') == 'true'
            candidates.append({
                'pos': pos,
                'text': text,
                'class': class_name,
                'resource_id': resource_id,
                'checked': checked,
                'selected': selected,
                'clickable': clickable,
            })

        def is_header(label: str) -> bool:
            lower = label.lower()
            return any(token in lower for token in (
                'access point names',
                'nom des points d\'acc',
                'access point name',
                'add',
                'ajouter',
            ))

        def tap_candidate(entry: dict) -> bool:
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'tap', str(entry['pos'][0]), str(entry['pos'][1])])
            time.sleep(1)
            return True

        prioritized = [c for c in candidates if c['text'] and not is_header(c['text'])]
        prioritized.sort(key=lambda c: c['pos'][1])

        for entry in candidates:
            if (entry['checked'] or entry['selected']) and (not entry['text'] or not is_header(entry['text'])):
                return tap_candidate(entry)

        for entry in prioritized:
            if 'checkedtextview' in entry['class'] or 'apn' in entry['resource_id'] or 'carrier' in entry['resource_id']:
                return tap_candidate(entry)

        for entry in prioritized:
            if entry['clickable']:
                return tap_candidate(entry)

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
            # 1) Reset settings app to avoid landing on stale sub-screens (2nd run issue).
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_HOME'])
            time.sleep(0.3)
            self.execute_command([ADB_EXECUTABLE, 'shell', 'am', 'force-stop', 'com.android.settings'])
            time.sleep(0.5)
            # 2) Settings root
            self.execute_command([ADB_EXECUTABLE, 'shell', 'am', 'start', '-a', 'android.settings.SETTINGS'])
            time.sleep(1)
            # 3) Connections
            if not (self._tap_by_text('Connections') or self._tap_by_text('Connexions')):
                self._scroll_down()
                if not (self._tap_by_text('Connections') or self._tap_by_text('Connexions')):
                    return False
            time.sleep(1)
            # 4) Mobile networks (move down 6 times, then confirm)
            for _ in range(6):
                self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DPAD_DOWN'])
                time.sleep(0.2)
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DPAD_CENTER'])
            time.sleep(1)
            # 5) Access Point Names (move down 3 times, then confirm)
            for _ in range(3):
                self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DPAD_DOWN'])
                time.sleep(0.2)
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DPAD_CENTER'])
            time.sleep(1)
            # 6) Ensure the APN to change is the currently selected one and matches MTN CM / Orange,
            # or fallback to any non-empty selected label.
            selected_label = self._get_selected_apn_label()
            if not selected_label:
                logger.warning("Selected APN label not found; skipping change.")
                return False
            if selected_label not in ('MTN CM', 'Orange'):
                logger.info("Selected APN label '%s' accepted as non-empty fallback.", selected_label)
            # Open the selected APN entry (no name matching beyond the selected check)
            selected = self._tap_selected_apn_entry()
            if not selected:
                selected = self._tap_best_apn_entry()
            if not selected:
                # Last-resort fallback: open the first item via DPAD
                logger.debug("APN selection fallback: using DPAD to open first entry.")
                self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DPAD_DOWN'])
                time.sleep(0.2)
                self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DPAD_CENTER'])
                selected = True
            time.sleep(1)
            if not selected:
                return False
            # 7) In APN details, target the "APN" field
            if not self._tap_by_text('APN') and not self._tap_by_text("Access point name"):
                self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DPAD_CENTER'])
            time.sleep(1)
            # Effacer et saisir la nouvelle valeur
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_MOVE_END'])
            for _ in range(25):
                self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_DEL'])
                time.sleep(0.02)
            self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'text', apn])
            time.sleep(1)
            # 8) Validate via OK button if present (dialog), otherwise ENTER
            if not self._tap_by_text('OK'):
                # approximate tap bottom-right (avoid Cancel)
                self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'tap', '950', '1650'])
                time.sleep(0.5)
                self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_ENTER'])
            time.sleep(1)
            # Best-effort: verify APN field value before saving
            current_apn_value = self._read_apn_field_value()
            if current_apn_value and current_apn_value.strip() != apn:
                logger.warning("APN field mismatch after input | expected=%s | actual=%s", apn, current_apn_value)
                return False
            # 9) Puis menu -> down 2x -> Save
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
        """Best-effort pull of RF/modem logs from device storage."""
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

        candidate_roots = [
            "/sdcard/log",
            "/sdcard/Log",
            "/sdcard/LOG",
            "/sdcard/CP_LOG",
            "/sdcard/cp_log",
            "/sdcard/diag_logs",
            "/sdcard/diag_log",
            "/sdcard/diag",
            "/sdcard/diaglog",
        ]
        keyword_hints = ("cp", "modem", "rf", "radio", "diag")

        sources: List[str] = []
        fallback_root = None
        for root in candidate_roots:
            listing = self.execute_command([ADB_EXECUTABLE, 'shell', 'ls', '-1', root])
            if not listing.success:
                continue
            entries = [line.strip() for line in listing.output.splitlines() if line.strip()]
            if root.endswith(("_LOG", "_log")) or "diag" in root.lower():
                sources.append(root)
                continue
            if entries:
                lower_entries = {entry.lower(): entry for entry in entries}
                cp_candidates = [
                    lower_entries.get("cp"),
                    lower_entries.get("cp_log"),
                    lower_entries.get("cp-log"),
                ]
                cp_matches = [entry for entry in cp_candidates if entry]
                if cp_matches:
                    sources.extend(f"{root}/{entry}" for entry in cp_matches)
                    continue
                matched = [entry for entry in entries if any(key in entry.lower() for key in keyword_hints)]
                if matched:
                    sources.extend(f"{root}/{entry}" for entry in matched)
                else:
                    fallback_root = root
            elif not fallback_root:
                fallback_root = root

        unique_sources = []
        seen = set()
        for source in sources:
            if source not in seen:
                seen.add(source)
                unique_sources.append(source)

        pulled: List[str] = []
        errors: List[Dict[str, str]] = []
        if unique_sources:
            for source in unique_sources:
                dest_path = target_dir / Path(source).name
                res = self.execute_command([ADB_EXECUTABLE, 'pull', source, str(dest_path)], timeout=300)
                if res.success:
                    pulled.append(source)
                else:
                    errors.append({"source": source, "error": res.error or res.output})
        elif fallback_root:
            res = self.execute_command([ADB_EXECUTABLE, 'pull', fallback_root, str(target_dir)], timeout=300)
            if res.success:
                pulled.append(fallback_root)
            else:
                errors.append({"source": fallback_root, "error": res.error or res.output})
        else:
            errors.append({"source": "unknown", "error": "No RF log directories found on device."})

        success = len(pulled) > 0
        return {
            'module': 'pull_rf_logs',
            'destination': str(target_dir),
            'success': success,
            'pulled_paths': pulled,
            'errors': errors,
            'note': "Pulled RF/modem log folders when found; fallback may include general logs.",
        }

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

    def _verify_app_front(self, package: str) -> bool:
        result = self.execute_command([ADB_EXECUTABLE, 'shell', 'dumpsys', 'activity', 'activities'])
        if not result or not result.success or not result.output:
            return False
        return package in result.output

    def _start_app_intent(self, normalized: str) -> Dict[str, Any]:
        package = APP_LAUNCHER_PACKAGE_MAP.get(normalized)
        if not package:
            return {
                'success': False,
                'error': f'Unsupported app "{normalized}"',
                'package': normalized,
                'duration': 0.0,
            }
        chrome_installed = True
        if normalized == 'chrome_news' and not self._is_app_installed(package):
            chrome_installed = False

        already_running = self._is_app_running(package)
        if normalized == 'youtube':
            video_id = random.choice(APP_LAUNCHER_VIDEO_IDS)
            target_url = f"https://www.youtube.com/watch?v={video_id}"
            cmd = [
                ADB_EXECUTABLE,
                'shell',
                'am',
                'start',
                '-a',
                'android.intent.action.VIEW',
                '-d',
                target_url,
            ]
        elif normalized == 'maps':
            location = random.choice(APP_LAUNCHER_MAP_LOCATIONS)
            target_url = f"geo:0,0?q={quote(location)}"
            cmd = [
                ADB_EXECUTABLE,
                'shell',
                'am',
                'start',
                '-a',
                'android.intent.action.VIEW',
                '-d',
                target_url,
                '-n',
                'com.google.android.apps.maps/com.google.android.maps.MapsActivity',
            ]
        elif normalized == 'chrome_news':
            target_url = random.choice(APP_LAUNCHER_CHROME_NEWS_SITES)
            cmd = [
                ADB_EXECUTABLE,
                'shell',
                'am',
                'start',
                '-a',
                'android.intent.action.VIEW',
                '-d',
                target_url,
                '-p',
                package,
            ]
            fallback_cmd = [
                ADB_EXECUTABLE,
                'shell',
                'am',
                'start',
                '-a',
                'android.intent.action.VIEW',
                '-d',
                target_url,
            ]
        elif normalized == 'maps_traffic':
            location = random.choice(APP_LAUNCHER_MAP_TRAFFIC_QUERY_LOCATIONS)
            query = quote(f"traffic {location}")
            target_url = f"https://www.google.com/maps/search/{query}"
            cmd = [
                ADB_EXECUTABLE,
                'shell',
                'am',
                'start',
                '-a',
                'android.intent.action.VIEW',
                '-d',
                target_url,
                '-n',
                'com.google.android.apps.maps/com.google.android.maps.MapsActivity',
            ]
        else:
            query = random.choice(APP_LAUNCHER_QUERIES)
            target_url = f"search:{query}"
            cmd = [
                ADB_EXECUTABLE,
                'shell',
                'am',
                'start',
                '-a',
                'android.intent.action.WEB_SEARCH',
                '-e',
                'query',
                query,
                '-n',
                'com.google.android.googlequicksearchbox/com.google.android.apps.gsa.searchnow.SearchActivity',
            ]

        cmd_result = self.execute_command(cmd)
        success = bool(cmd_result.success)
        warning = None
        used_package = package
        if normalized == 'chrome_news' and (not chrome_installed or not success):
            fallback_result = self.execute_command(fallback_cmd)
            if fallback_result.success:
                cmd_result = fallback_result
                success = True
                used_package = 'browser'
                warning = 'Chrome not available; opened default browser.'
        verification = self._verify_app_front(used_package) if success and used_package != 'browser' else False
        return {
            'package': used_package,
            'success': success,
            'duration': cmd_result.duration,
            'target': target_url,
            'already_on': already_running,
            'already_off': not already_running,
            'command_error': cmd_result.error,
            'foreground_verified': verification,
            'warning': warning,
        }

    def launch_app(
        self,
        app: Optional[str],
        duration_seconds: Optional[int] = None,
        targets: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        entries = []
        if targets:
            entries.extend(targets)
        else:
            entries.append({'app': app or APP_LAUNCHER_DEFAULT, 'duration_seconds': duration_seconds})

        results = []
        total_duration = 0.0
        stage_messages = []
        overall_success = True

        for entry in entries:
            normalized = (str(entry.get('app') or APP_LAUNCHER_DEFAULT)).strip().lower()
            duration_target = entry.get('duration_seconds')
            launch_result = self._start_app_intent(normalized)
            if not launch_result['success']:
                overall_success = False
                results.append({
                    'app': normalized,
                    'success': False,
                    'error': launch_result.get('command_error'),
                })
                stage_messages.append(f'{normalized} failed')
                continue

            requested_duration = None
            closed_after_duration = False
            if duration_target and duration_target > 0:
                requested_duration = duration_target
                time.sleep(duration_target)
                close_result = self.force_close_app(launch_result['package'])
                closed_after_duration = bool(close_result.get('success'))
            total_duration += launch_result.get('duration', 0.0)
            results.append({
                'app': normalized,
                'success': launch_result['success'],
                'duration': launch_result.get('duration'),
                'duration_seconds': requested_duration,
                'app_package': launch_result['package'],
                'target': launch_result.get('target'),
                'already_on': launch_result.get('already_on'),
                'already_off': launch_result.get('already_off'),
                'foreground_verified': launch_result.get('foreground_verified'),
                'closed_after_duration': closed_after_duration,
                'error': None if launch_result['success'] else launch_result.get('command_error'),
            })
            overall_success = overall_success and launch_result['success']
            stage_messages.append(
                f"{normalized} {'closed' if closed_after_duration else 'launched'}"
            )

        stage_message = f"Launching apps: {', '.join(stage_messages)}"
        return {
            'module': 'launch_app',
            'success': overall_success,
            'duration': total_duration,
            'results': results,
            'stage_message': stage_message,
            'target_sequence': entries,
        }

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
    def _is_mobile_data_enabled(self) -> Optional[bool]:
        result = self.execute_command(
            [ADB_EXECUTABLE, 'shell', 'settings', 'get', 'global', 'mobile_data']
        )
        if not result.success or result.output is None:
            return None
        value = result.output.strip()
        return value == '1'

    def enable_mobile_data(self) -> Dict[str, Any]:
        already_enabled = self._is_mobile_data_enabled()
        if already_enabled:
            return {
                'module': 'enable_mobile_data',
                'success': True,
                'duration': 0.1,
                'already_on': True,
                'error': None,
                'message': 'Mobile data is already enabled',
            }
        result = self.execute_command([ADB_EXECUTABLE, 'shell', 'svc', 'data', 'enable'])
        return {
            'module': 'enable_mobile_data',
            'success': result.success,
            'duration': result.duration,
            'already_on': bool(already_enabled),
            'error': None if result.success else result.error,
            'message': 'Mobile data enabled' if result.success else 'Failed to enable mobile data',
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
        cached = self._get_cached_network_registration()
        if cached:
            cached_payload = dict(cached)
            cached_payload['cached'] = True
            return cached_payload

        result = self.execute_command([ADB_EXECUTABLE, 'shell', 'dumpsys', 'telephony.registry'])
        low_permission = self._is_permission_denied(result)
        info = self._parse_registration_info(result.output) if result.success and result.output and not low_permission else None
        source = 'dumpsys-registry'

        if not info:
            telephony_info = None
            if not low_permission:
                telephony_info = self._read_dumpsys_telephony_info()
            if telephony_info:
                info = telephony_info
                source = 'dumpsys-telephony'

        fallback_info = self._read_getprop_network_info()
        if fallback_info:
            if not info:
                info = fallback_info
                source = 'getprop'
            else:
                for key, value in fallback_info.items():
                    if key not in info:
                        info[key] = value
                if 'sim_slots' not in info and fallback_info.get('sim_slots'):
                    info['sim_slots'] = fallback_info.get('sim_slots')
                source = f"{source}+getprop"

        if info is not None:
            info['source'] = source
            info['confidence'] = NETWORK_SOURCE_CONFIDENCE.get(source, 0.5)

        response = {
            'module': 'check_network_registration',
            'success': result.success or bool(fallback_info) or bool(info),
            'duration': result.duration,
            'error': result.error if not result.success and not fallback_info and not info else None,
            'registration_info': info,
            'low_permission': low_permission,
        }
        self._set_cached_network_registration(response)
        return response

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

    def preflight_check(self) -> Dict[str, Any]:
        start = time.time()
        checks: List[Dict[str, Any]] = []

        def _run_check(name: str, command: List[str]) -> bool:
            result = self.execute_command(command)
            entry = {
                'name': name,
                'success': bool(result.success),
                'duration': result.duration,
                'output': result.output or '',
                'error': result.error if not result.success else None,
            }
            checks.append(entry)
            return entry['success']

        overall_success = True
        overall_success = overall_success and _run_check('adb_version', [ADB_EXECUTABLE, 'version'])
        overall_success = overall_success and _run_check('wifi_service', [ADB_EXECUTABLE, 'shell', 'dumpsys', 'wifi'])
        overall_success = overall_success and _run_check('connectivity_service', [ADB_EXECUTABLE, 'shell', 'dumpsys', 'connectivity'])

        return {
            'module': 'preflight_check',
            'success': overall_success,
            'duration': time.time() - start,
            'checks': {check['name']: check for check in checks},
            'message': 'Preflight checks completed successfully' if overall_success else 'Preflight checks detected issues',
        }

    # -----------------------------
    # SMS
    # -----------------------------
    def _sanitize_text_input(self, value: str) -> str:
        """Prepare strings for `adb shell input text` (spaces must be %s)."""
        safe = value.replace(' ', '%s')
        for ch in ['"', "'", '\\']:
            safe = safe.replace(ch, '')
        return safe

    def send_sms(self, number: str, message: str) -> Dict[str, Any]:
        """Send an SMS by mimicking the provided automation logic."""
        start = time.time()
        sanitized_message = self._sanitize_text_input(message)
        number_value = number.strip()
        attempts: List[Dict[str, Any]] = []

        def _focus_message_field() -> bool:
            root = self._ui_dump()
            if root is None:
                return False
            for node in root.iter():
                class_name = (node.attrib.get('class') or '').lower()
                if class_name == 'android.widget.edittext':
                    bounds = node.attrib.get('bounds')
                    pos = self._parse_bounds_center(bounds) if bounds else None
                    if pos:
                        self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'tap', str(pos[0]), str(pos[1])])
                        time.sleep(0.5)
                        return True
            return False

        def _tap_send_button() -> bool:
            send_resource_candidates = [
                'send_message_button',
                'send_button',
                'send_message',
                'send',
            ]
            for candidate in send_resource_candidates:
                if self._tap_by_resource_id(candidate):
                    return True
            if self._tap_by_text('Send') or self._tap_by_text('Envoyer'):
                return True
            tap = self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'tap', '666', '889'])
            return tap.success

        def _run_sequence(sequence_name: str) -> bool:
            attempts.append({'strategy': sequence_name})
            if sequence_name == 'intent_sendto':
                result = self.execute_command([
                    ADB_EXECUTABLE, 'shell', 'am', 'start',
                    '-a', 'android.intent.action.SENDTO',
                    '-d', f'sms:{number_value}',
                    '--es', 'sms_body', message,
                    '--ez', 'exit_on_sent', 'true',
                ])
                attempts[-1]['start_success'] = result.success
                if not result.success:
                    attempts[-1]['error'] = result.error
                    return False
                time.sleep(2)
                _focus_message_field()
                self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'text', sanitized_message])
                time.sleep(1)
                tapped = _tap_send_button()
                attempts[-1]['tap_success'] = tapped
                attempts[-1]['tap_error'] = None if tapped else 'send_button_not_found'
                return tapped

            if sequence_name == 'app_messages':
                result = self.execute_command([
                    ADB_EXECUTABLE, 'shell', 'am', 'start',
                    '-a', 'android.intent.action.MAIN',
                    '-c', 'android.intent.category.DEFAULT',
                    '-t', 'vnd.android-dir/mms-sms',
                ])
                attempts[-1]['start_success'] = result.success
                if not result.success:
                    attempts[-1]['error'] = result.error
                    return False
                time.sleep(2)
                self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_MENU'])
                time.sleep(1)
                self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'text', self._sanitize_text_input(number_value)])
                self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'keyevent', 'KEYCODE_TAB'])
                _focus_message_field()
                self.execute_command([ADB_EXECUTABLE, 'shell', 'input', 'text', sanitized_message])
                tapped = _tap_send_button()
                attempts[-1]['tap_success'] = tapped
                attempts[-1]['tap_error'] = None if tapped else 'send_button_not_found'
                return tapped
            return False

        success = _run_sequence('intent_sendto') or _run_sequence('app_messages')
        duration = time.time() - start
        error = None
        if not success:
            for attempt in attempts:
                if not attempt.get('start_success'):
                    error = attempt.get('error') or f"{attempt.get('strategy', 'sms')} start failed"
                    break
                if attempt.get('tap_error'):
                    error = attempt.get('tap_error')
                    break
            if not error:
                error = 'SMS send failed (UI interaction not confirmed)'
        return {
            'module': 'send_sms',
            'success': success,
            'duration': duration,
            'attempts': attempts,
            'error': error,
        }

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

    @classmethod
    def execute_on_multiple_devices(
        cls,
        device_ids: List[str],
        worker: Callable[['TelcoModules'], Dict[str, Any]],
        *,
        module_name: Optional[str] = None,
        max_workers: Optional[int] = None,
        cancel_event: Optional[threading.Event] = None,
    ) -> Dict[str, Any]:
        """Run the same worker callable concurrently on multiple devices."""
        targets = [device_id for device_id in device_ids if device_id]
        resolved_name = module_name or getattr(worker, '__name__', 'module')
        if not targets:
            return {
                'module': resolved_name,
                'success': False,
                'device_results': [],
                'error': 'No device IDs provided',
            }

        results: List[Dict[str, Any]] = []
        pool_size = max_workers or len(targets)
        with ThreadPoolExecutor(max_workers=pool_size) as executor:
            future_to_device = {
                executor.submit(cls._run_worker_for_device, worker, device_id, cancel_event): device_id
                for device_id in targets
            }
            for future in as_completed(future_to_device):
                device_id = future_to_device[future]
                try:
                    value = future.result()
                    results.append(
                        {
                            'device_id': device_id,
                            'success': bool(value.get('success', True)),
                            'result': value,
                        }
                    )
                except Exception as exc:
                    results.append(
                        {
                            'device_id': device_id,
                            'success': False,
                            'error': str(exc),
                        }
                    )

        overall_success = all(entry.get('success', False) for entry in results)
        return {
            'module': resolved_name,
            'success': overall_success,
            'device_results': results,
        }

    @staticmethod
    def _run_worker_for_device(
        worker: Callable[['TelcoModules'], Dict[str, Any]],
        device_id: str,
        cancel_event: Optional[threading.Event] = None,
    ) -> Dict[str, Any]:
        """Invoke the worker with a dedicated TelcoModules instance for a device."""
        if cancel_event and cancel_event.is_set():
            return {'success': False, 'cancelled': True, 'error': 'Execution cancelled'}
        executor = TelcoModules(device_id)
        try:
            signature = inspect.signature(worker)
            if len(signature.parameters) >= 2:
                result = worker(executor, cancel_event)
            else:
                result = worker(executor)
        except (TypeError, ValueError):
            result = worker(executor)
        if not isinstance(result, dict):
            result = {'result': result}
        result.setdefault('success', True)
        return result
