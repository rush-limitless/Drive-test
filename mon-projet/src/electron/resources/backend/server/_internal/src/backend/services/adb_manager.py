"""ADB connection pool manager for device operations."""

import asyncio
import subprocess
import json
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta, timezone
import re

from core.config import settings

logger = logging.getLogger(__name__)

NETWORK_TYPE_CODE_MAP = {
    0: None,
    1: "GPRS",
    2: "EDGE",
    3: "UMTS",
    4: "CDMA",
    5: "EVDO_0",
    6: "EVDO_A",
    7: "1XRTT",
    8: "HSDPA",
    9: "HSUPA",
    10: "HSPA",
    11: "IDEN",
    12: "EVDO_B",
    13: "LTE",
    14: "EHRPD",
    15: "HSPAP",
    16: "GSM",
    17: "TD_SCDMA",
    18: "IWLAN",
    19: "LTE_CA",
    20: "NR",
    21: "NR",
    22: "NR",
}

NETWORK_TYPE_PATTERNS = [
    re.compile(r"mDataNetworkType\s*=\s*(\d+)", re.IGNORECASE),
    re.compile(r"mVoiceNetworkType\s*=\s*(\d+)", re.IGNORECASE),
    re.compile(r"mNetworkType\s*=\s*(\d+)", re.IGNORECASE),
]

NETWORK_KEYWORD_PRIORITY = [
    'NR_SA',
    'NR_NSA',
    'NR',
    'LTE_CA',
    'LTE',
    'HSPAP',
    'HSPA',
    'HSUPA',
    'HSDPA',
    'UMTS',
    'EDGE',
    'GPRS',
    'GSM',
    'IWLAN',
    'CDMA',
    'EVDO_B',
    'EVDO_A',
    'EVDO_0',
    '1XRTT',
]


def _normalize_network_prop(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    primary = value.split(',')[0].strip().upper()
    if not primary or primary in {'UNKNOWN', 'N/A', 'NONE'}:
        return None
    return primary


def _split_prop_list(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [entry.strip() for entry in value.split(',') if entry.strip()]


def _network_label_from_code(code: int) -> Optional[str]:
    label = NETWORK_TYPE_CODE_MAP.get(code)
    if not label:
        return None
    if label == "LTE_CA":
        return "LTE-CA"
    return label


def _parse_network_type_from_dump(dump: str) -> Optional[str]:
    if not dump:
        return None
    for pattern in NETWORK_TYPE_PATTERNS:
        match = pattern.search(dump)
        if match:
            try:
                code = int(match.group(1))
            except ValueError:
                continue
            label = _network_label_from_code(code)
            if label:
                return label
    return None


def _parse_network_keyword(dump: str) -> Optional[str]:
    if not dump:
        return None
    upper_dump = dump.upper()
    for keyword in NETWORK_KEYWORD_PRIORITY:
        if keyword in upper_dump:
            return keyword
    return None


def _clean_operator_label(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = value.strip().strip('"').strip()
    if not cleaned:
        return None
    cleaned = cleaned.splitlines()[0].strip()
    if not cleaned or cleaned.lower() in {'unknown', 'null', 'n/a'}:
        return None
    if 'NetworkRegistrationInfo' in cleaned or 'mOperatorAlphaShort' in cleaned:
        return None
    if len(cleaned) > 64:
        return None
    return cleaned

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


class ADBConnection:
    """Individual ADB connection to a device."""
    
    def __init__(self, device_id: str):
        self.device_id = device_id
        self.last_used = datetime.now(timezone.utc)
        self.is_busy = False
        self.connection_health = True
        
    async def execute_command(self, command: str, timeout: int = None) -> Tuple[str, str, int]:
        """Execute ADB command on this device.
        
        Returns:
            Tuple of (stdout, stderr, return_code)
        """
        if timeout is None:
            timeout = settings.ADB_TIMEOUT
            
        full_command = [settings.ADB_PATH, '-s', self.device_id] + command.split()

        attempts = max(1, settings.ADB_RETRY_ATTEMPTS)
        delay = settings.ADB_RETRY_BASE_DELAY
        for attempt in range(1, attempts + 1):
            process = None
            try:
                process = await asyncio.create_subprocess_exec(
                    *full_command,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )

                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=timeout
                )

                self.last_used = datetime.now(timezone.utc)
                self.connection_health = True

                return (
                    stdout.decode('utf-8', errors='ignore'),
                    stderr.decode('utf-8', errors='ignore'),
                    process.returncode or 0
                )

            except asyncio.TimeoutError:
                if process and process.returncode is None:
                    process.kill()
                    await process.communicate()
                if attempt >= attempts:
                    logger.error(f"ADB command timeout for device {self.device_id}: {command}")
                    self.connection_health = False
                    raise
                logger.warning(
                    "ADB command timeout for device %s (attempt %s/%s): %s",
                    self.device_id,
                    attempt,
                    attempts,
                    command
                )
            except Exception as e:
                if process and process.returncode is None:
                    process.kill()
                    await process.communicate()
                if attempt >= attempts:
                    logger.error(f"ADB command failed for device {self.device_id}: {e}")
                    self.connection_health = False
                    raise
                logger.warning(
                    "ADB command failed for device %s (attempt %s/%s): %s",
                    self.device_id,
                    attempt,
                    attempts,
                    e
                )

            await asyncio.sleep(min(delay, settings.ADB_RETRY_MAX_DELAY))
            delay = min(delay * 2, settings.ADB_RETRY_MAX_DELAY)

    async def get_network_operator_live(self) -> Optional[str]:
        """Return operator from dumpsys telephony.registry when available."""
        try:
            airplane_mode, _, _ = await self.execute_command("shell settings get global airplane_mode_on")
            if airplane_mode.strip() == "1":
                return None

            sim_state, _, _ = await self.execute_command("shell getprop gsm.sim.state")
            if sim_state:
                normalized = [state.strip().upper() for state in sim_state.split(',') if state.strip()]
                if normalized and all(
                    state in {"ABSENT", "UNKNOWN", "NOT_READY", "NO_SIM", "N/A", "NONE"}
                    for state in normalized
                ):
                    return None

            stdout, _, _ = await self.execute_command("shell dumpsys telephony.registry")
        except Exception:
            return None
        if not stdout:
            return None
        long_match = re.search(r'mOperatorAlphaLong=([^\r\n,]+)', stdout)
        if long_match:
            value = _clean_operator_label(long_match.group(1))
            if value:
                return value
        short_match = re.search(r'mOperatorAlphaShort=([^\r\n,]+)', stdout)
        if short_match:
            return _clean_operator_label(short_match.group(1))
        return None
    
    async def _detect_network_technology(self) -> Optional[str]:
        """Return the current network/radio technology for this device."""
        try:
            stdout, _, _ = await self.execute_command("shell getprop gsm.network.type")
            normalized = _normalize_network_prop(stdout.strip())
            if normalized:
                return normalized
        except Exception:
            pass

        try:
            stdout, _, _ = await self.execute_command("shell dumpsys telephony.registry")
            detected = _parse_network_type_from_dump(stdout)
            if detected:
                return detected
            keyword = _parse_network_keyword(stdout)
            if keyword:
                return keyword
        except Exception:
            pass

        try:
            stdout, _, _ = await self.execute_command("shell dumpsys telephony")
            detected = _parse_network_type_from_dump(stdout)
            if detected:
                return detected
            keyword = _parse_network_keyword(stdout)
            if keyword:
                return keyword
        except Exception:
            pass

        return None
            
    async def get_device_info(self) -> Dict[str, str]:
        """Get device information and metadata."""
        info = {}
        
        try:
            # Get device model
            stdout, _, _ = await self.execute_command("shell getprop ro.product.model")
            info['model'] = stdout.strip()
            
            # Get Android version
            stdout, _, _ = await self.execute_command("shell getprop ro.build.version.release")
            info['os_version'] = stdout.strip()
            
            # Get battery level
            try:
                stdout, _, _ = await self.execute_command("shell dumpsys battery")
                if stdout.strip():
                    for line in stdout.splitlines():
                        if 'level' in line.lower():
                            level_match = re.search(r'level:\s*(\d+)', line, re.IGNORECASE)
                            if level_match:
                                info['battery_level'] = int(level_match.group(1))
                                break
            except Exception:
                pass
            
            # Get connection type
            try:
                def usb_tokens(value: str) -> bool:
                    normalized = value.strip().lower()
                    return any(token in normalized for token in ('adb', 'mtp', 'rndis', 'accessory', 'ptp'))

                usb_state_active = False
                try:
                    usb_state, _, _ = await self.execute_command("shell getprop sys.usb.state")
                    if usb_tokens(usb_state):
                        usb_state_active = True
                except Exception:
                    pass

                if not usb_state_active:
                    try:
                        usb_config, _, _ = await self.execute_command("shell getprop sys.usb.config")
                        if usb_tokens(usb_config):
                            usb_state_active = True
                    except Exception:
                        pass

                wifi_up = False
                try:
                    wifi_info, _, _ = await self.execute_command("shell ip addr show wlan0")
                    if wifi_info.strip() and ('state UP' in wifi_info or 'inet ' in wifi_info):
                        wifi_up = True
                except Exception:
                    pass

                if not wifi_up:
                    try:
                        route_info, _, _ = await self.execute_command("shell ip route | grep wlan0")
                        wifi_up = bool(route_info.strip())
                    except Exception:
                        pass

                usb_up = usb_state_active
                if not usb_up:
                    for iface in ('rndis0', 'usb0', 'eth0'):
                        try:
                            iface_info, _, _ = await self.execute_command(f"shell ip addr show {iface}")
                            if iface_info.strip() and ('state UP' in iface_info or 'inet ' in iface_info):
                                usb_up = True
                                break
                        except Exception:
                            continue

                info['connection_type'] = 'USB'
            except Exception:
                info['connection_type'] = 'USB'  # Default to USB

            # Get airplane mode state (best effort)
            try:
                stdout, _, _ = await self.execute_command("shell settings get global airplane_mode_on")
                if stdout is not None:
                    info['airplane_mode'] = stdout.strip() == "1"
            except Exception:
                pass
            airplane_mode = info.get('airplane_mode') is True
            
            # Get SIM info if available
            sim_present = None
            try:
                async def _getprop(prop: str) -> str:
                    stdout, _, _ = await self.execute_command(f"shell getprop {prop}")
                    return stdout.strip()

                sim_states = _split_prop_list(await _getprop("gsm.sim.state"))
                if not sim_states:
                    sim_states = []
                    for idx in (1, 2):
                        value = await _getprop(f"gsm.sim.state.{idx}")
                        if value:
                            sim_states.append(value)

                normalized_states = [state.strip().upper() for state in sim_states if state.strip()]
                sim_present = None
                if normalized_states:
                    sim_present = any(
                        state not in {"ABSENT", "UNKNOWN", "NOT_READY", "NO_SIM", "N/A", "NONE"}
                        for state in normalized_states
                    )

                if sim_present is None:
                    numeric_hint = await _getprop("gsm.sim.operator.numeric")
                    if not numeric_hint:
                        numeric_hint = await _getprop("gsm.operator.numeric")
                    if numeric_hint:
                        sim_present = True

                if sim_present is not None:
                    info['sim_present'] = sim_present

                if sim_present:
                    stdout, _, _ = await self.execute_command("shell getprop gsm.operator.numeric")
                    if stdout.strip():
                        mcc_mnc = stdout.strip()
                        if len(mcc_mnc) >= 5:
                            info['mcc'] = mcc_mnc[:3]
                            info['mnc'] = mcc_mnc[3:]

                if sim_present and not airplane_mode:
                    # Get operator name using dumpsys commands
                    operator_found = False

                    # Method 1: dumpsys telephony.registry for network operator
                    stdout, _, _ = await self.execute_command("shell dumpsys telephony.registry | grep -i operator")
                    if stdout.strip():
                        lines = stdout.split('\n')
                        for line in lines:
                            if 'mOperatorAlphaLong=' in line:
                                match = re.search(r'mOperatorAlphaLong=([^\r\n]+)', line)
                                if match:
                                    candidate = match.group(1)
                                    operator_name = _clean_operator_label(candidate)
                                    if operator_name:
                                        info['carrier'] = operator_name
                                        info['network_operator'] = operator_name
                                        operator_found = True
                                        break

                    if not operator_found:
                        sim_operator_alpha, _, _ = await self.execute_command("shell getprop gsm.sim.operator.alpha")
                        sim_operator_name = _clean_operator_label(sim_operator_alpha)
                        if sim_operator_name:
                            info['carrier'] = sim_operator_name
                            info['network_operator'] = sim_operator_name
                            operator_found = True
                    
                    if not operator_found:
                        # Method 2: dumpsys telephony for SIM operator
                        stdout, _, _ = await self.execute_command("shell dumpsys telephony | grep -i 'operator\\|carrier'")
                        if stdout.strip():
                            lines = stdout.split('\n')
                            for line in lines:
                                if 'OperatorName=' in line:
                                    match = re.search(r'OperatorName=([^\r\n]+)', line)
                                    if match:
                                        candidate = match.group(1)
                                        operator_name = _clean_operator_label(candidate)
                                        if operator_name:
                                            info['carrier'] = operator_name
                                            info['network_operator'] = operator_name
                                            operator_found = True
                                            break
                    
                    if not operator_found:
                        # Method 3: dumpsys isms for SIM info
                        stdout, _, _ = await self.execute_command("shell dumpsys isms | grep -i operator")
                        if stdout.strip():
                            lines = stdout.split('\n')
                            for line in lines:
                                if 'operator' in line.lower() and '=' in line:
                                    parts = line.split('=')
                                    if len(parts) > 1:
                                        operator_name = _clean_operator_label(parts[1])
                                        if operator_name:
                                            info['carrier'] = operator_name
                                            info['network_operator'] = operator_name
                                            operator_found = True
                                            break
                    
                    if not operator_found:
                        # Method 4: Service call to get network operator
                        stdout, _, _ = await self.execute_command("shell service call iphonesubinfo 11")
                        if 'Result: Parcel' in stdout:
                            # Extract operator from service call result
                            lines = stdout.split('\n')
                            for line in lines:
                                if '0x' in line and len(line) > 20:
                                    # Try to extract readable text from hex output
                                    hex_parts = re.findall(r'0x[0-9a-fA-F]+', line)
                                    for hex_part in hex_parts:
                                        try:
                                            # Convert hex to potential text
                                            hex_val = int(hex_part, 16)
                                            if 32 <= hex_val <= 126:  # Printable ASCII range
                                                char = chr(hex_val)
                                                # Build operator name from characters
                                                pass
                                        except:
                                            pass
                    
                    if not operator_found:
                        # Method 5: Standard getprop methods as fallback
                        prop_candidates = [
                            "gsm.operator.alpha",
                            "gsm.operator.alpha.1",
                            "gsm.operator.alpha.2",
                            "gsm.sim.operator.alpha",
                            "gsm.sim.operator.alpha.1",
                            "gsm.sim.operator.alpha.2",
                            "gsm.operator.numeric",
                            "gsm.sim.operator.numeric",
                            "ro.carrier",
                            "ro.cdma.home.operator.alpha",
                        ]
                        for prop in prop_candidates:
                            stdout, _, _ = await self.execute_command(f"shell getprop {prop}")
                            operator_name = _clean_operator_label(stdout)
                            if operator_name:
                                info['carrier'] = operator_name
                                info['network_operator'] = operator_name
                                operator_found = True
                                break

                    operator_list = _split_prop_list(await _getprop("gsm.operator.alpha"))
                    if not operator_list:
                        operator_list = _split_prop_list(await _getprop("gsm.sim.operator.alpha"))
                    if not operator_list:
                        operator_list = []
                        for idx in (1, 2):
                            value = await _getprop(f"gsm.operator.alpha.{idx}")
                            if not value:
                                value = await _getprop(f"gsm.sim.operator.alpha.{idx}")
                            if value:
                                operator_list.append(value)

                    numeric_list = _split_prop_list(await _getprop("gsm.operator.numeric"))
                    if not numeric_list:
                        numeric_list = _split_prop_list(await _getprop("gsm.sim.operator.numeric"))
                    if not numeric_list:
                        numeric_list = []
                        for idx in (1, 2):
                            value = await _getprop(f"gsm.operator.numeric.{idx}")
                            if not value:
                                value = await _getprop(f"gsm.sim.operator.numeric.{idx}")
                            if value:
                                numeric_list.append(value)

                    data_type_list = _split_prop_list(await _getprop("gsm.data.network.type"))
                    if not data_type_list:
                        data_type_list = []
                        for idx in (1, 2):
                            value = await _getprop(f"gsm.data.network.type.{idx}")
                            if value:
                                data_type_list.append(value)

                    voice_type_list = _split_prop_list(await _getprop("gsm.network.type"))
                    if not voice_type_list:
                        voice_type_list = _split_prop_list(await _getprop("gsm.voice.network.type"))
                    if not voice_type_list:
                        voice_type_list = []
                        for idx in (1, 2):
                            value = await _getprop(f"gsm.network.type.{idx}")
                            if not value:
                                value = await _getprop(f"gsm.voice.network.type.{idx}")
                            if value:
                                voice_type_list.append(value)

                    slot_count = max(
                        len(operator_list),
                        len(numeric_list),
                        len(data_type_list),
                        len(voice_type_list),
                    )
                    sim_slots: List[Dict[str, str]] = []
                    for idx in range(slot_count):
                        operator = operator_list[idx] if idx < len(operator_list) else None
                        operator_numeric = numeric_list[idx] if idx < len(numeric_list) else None
                        data_net = data_type_list[idx] if idx < len(data_type_list) else None
                        voice_net = voice_type_list[idx] if idx < len(voice_type_list) else None
                        slot = {
                            "slot_index": idx,
                            "operator": _clean_operator_label(operator),
                            "operator_numeric": operator_numeric,
                            "network_technology": _normalize_network_prop(data_net or voice_net),
                        }
                        sim_slots.append({k: v for k, v in slot.items() if v is not None})

                    if sim_slots:
                        info["sim_slots"] = sim_slots
            
                # Get phone number if available (requires special permissions)
                try:
                    stdout, _, _ = await self.execute_command("shell service call iphonesubinfo 1")
                    # Parse phone number from service call output
                    if 'Result: Parcel' in stdout:
                        lines = stdout.split('\n')
                        for line in lines:
                            if '0x' in line and len(line) > 20:
                                # Extract phone number from hex data (simplified)
                                pass
                except Exception:
                    pass
                    
            except Exception:
                # SIM info not available or device doesn't support telephony
                pass

            allow_network_tech = not airplane_mode and sim_present is not False

            if allow_network_tech:
                network_tech = await self._detect_network_technology()
                if network_tech:
                    info['network_technology'] = network_tech
                
        except Exception as e:
            logger.error(f"Failed to get device info for {self.device_id}: {e}")
            
        return info
        
    async def capture_screenshot(self, output_path: str) -> bool:
        """Capture device screenshot."""
        try:
            stdout, stderr, code = await self.execute_command(f"exec-out screencap -p")
            if code == 0 and stdout:
                with open(output_path, 'wb') as f:
                    f.write(stdout.encode('latin1'))
                return True
        except Exception as e:
            logger.error(f"Screenshot failed for {self.device_id}: {e}")
        return False


class ADBManager:
    """Manages ADB connections and device operations."""
    
    def __init__(self):
        self.connections: Dict[str, ADBConnection] = {}
        self.device_info_cache: Dict[str, Dict] = {}
        self.last_device_scan = None
        self._scan_lock = asyncio.Lock()
        
    async def scan_devices(self) -> List[str]:
        """Scan for connected ADB devices."""
        async with self._scan_lock:
            try:
                process = await asyncio.create_subprocess_exec(
                    settings.ADB_PATH, 'devices',
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                stdout, stderr = await process.communicate()
                
                if process.returncode != 0:
                    logger.error(f"ADB devices command failed: {stderr.decode()}")
                    return []
                
                # Parse device list
                devices = []
                lines = stdout.decode().strip().split('\n')[1:]  # Skip header
                
                for line in lines:
                    if '\tdevice' in line:
                        device_id = line.split('\t')[0]
                        devices.append(device_id)
                        
                        # Create connection if not exists
                        if device_id not in self.connections:
                            self.connections[device_id] = ADBConnection(device_id)
                            
                # Remove disconnected devices
                current_devices = set(devices)
                disconnected = set(self.connections.keys()) - current_devices
                for device_id in disconnected:
                    del self.connections[device_id]
                    if device_id in self.device_info_cache:
                        del self.device_info_cache[device_id]
                        
                self.last_device_scan = datetime.now(timezone.utc)
                logger.info(f"Found {len(devices)} connected devices")
                return devices
                
            except Exception as e:
                logger.error(f"Device scan failed: {e}")
                return []
                
    async def get_device_connection(self, device_id: str) -> Optional[ADBConnection]:
        """Get ADB connection for device."""
        if device_id not in self.connections:
            # Try to refresh device list
            await self.scan_devices()
            
        return self.connections.get(device_id)
        
    async def get_device_info(self, device_id: str, force_refresh: bool = False) -> Dict[str, str]:
        """Get cached or fresh device information."""
        if not force_refresh and device_id in self.device_info_cache:
            return self.device_info_cache[device_id]
            
        connection = await self.get_device_connection(device_id)
        if not connection:
            return {}
            
        info = await connection.get_device_info()
        info['id'] = device_id
        info['last_seen'] = datetime.now(timezone.utc).isoformat()
        info['status'] = 'connected' if connection.connection_health else 'error'
        
        self.device_info_cache[device_id] = info
        return info

    async def get_network_operator_live(self, device_id: str) -> Optional[str]:
        """Read operator live from the device without writing to cache/DB."""
        connection = await self.get_device_connection(device_id)
        if not connection:
            return None
        try:
            return await connection.get_network_operator_live()
        except Exception:
            return None
        
    async def execute_on_device(self, device_id: str, command: str, timeout: int = None) -> Tuple[str, str, int]:
        """Execute command on specific device."""
        connection = await self.get_device_connection(device_id)
        if not connection:
            raise ValueError(f"Device {device_id} not found or not connected")
            
        if connection.is_busy:
            raise RuntimeError(f"Device {device_id} is busy")
            
        connection.is_busy = True
        try:
            return await connection.execute_command(command, timeout)
        finally:
            connection.is_busy = False
            
    async def capture_screenshot(self, device_id: str, output_path: str) -> bool:
        """Capture screenshot from device."""
        connection = await self.get_device_connection(device_id)
        if not connection:
            return False
            
        return await connection.capture_screenshot(output_path)
        
    def get_device_status(self, device_id: str) -> str:
        """Get current device status."""
        if device_id not in self.connections:
            return 'disconnected'
            
        connection = self.connections[device_id]
        if not connection.connection_health:
            return 'error'
        elif connection.is_busy:
            return 'busy'
        else:
            return 'connected'


# Global ADB manager instance
adb_manager = ADBManager()
