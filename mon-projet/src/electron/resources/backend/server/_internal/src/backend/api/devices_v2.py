"""
Enhanced Device API with better error handling and device management
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
import subprocess
import asyncio
import logging
from datetime import datetime, timezone
import re

try:  # Always prefer the resolved adb binary bundled with the app
    from core.adb_path import ADB_EXECUTABLE  # type: ignore
except Exception:  # pragma: no cover - fallback if import fails
    ADB_EXECUTABLE = "adb"

router = APIRouter()
logger = logging.getLogger(__name__)
from api.security import require_api_key, enforce_rate_limit  # noqa: E402

class DeviceManager:
    def __init__(self):
        self.device_cache = {}
        self.last_scan = 0

    def _adb_cmd(self, base_args: list[str], device_id: Optional[str] = None) -> list[str]:
        """Build an adb command using the resolved executable and optional device id."""
        if device_id:
            return [ADB_EXECUTABLE, "-s", device_id, *base_args]
        return [ADB_EXECUTABLE, *base_args]
    
    async def get_devices(self) -> List[Dict[str, Any]]:
        """Get all connected ADB devices with detailed information"""
        try:
            result = subprocess.run(
                self._adb_cmd(['devices']), 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            
            if result.returncode != 0:
                logger.error(f"ADB command failed: {result.stderr}")
                return []
            
            devices = []
            lines = result.stdout.strip().split('\n')[1:]  # Skip header
            
            for line in lines:
                if line.strip() and '\t' in line:
                    device_id, status = line.strip().split('\t')
                    device_info = await self._get_device_details(device_id, status)
                    devices.append(device_info)
            
            return devices
            
        except subprocess.TimeoutExpired:
            logger.error("ADB command timed out")
            return []
        except Exception as e:
            logger.error(f"Error getting devices: {e}")
            return []
    
    def _sanitize_operator_label(self, value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        cleaned = value.strip().strip('"').strip()
        if not cleaned or cleaned.lower() in {'unknown', 'null', 'not available'}:
            return None
        if 'NetworkRegistrationInfo' in cleaned or 'mOperatorAlphaShort' in cleaned:
            return None
        first_segment = cleaned.split(',')[0].strip()
        if not first_segment or first_segment.lower() == 'null':
            return None
        return first_segment

    def _normalize_network_label(self, value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        cleaned = value.strip()
        if not cleaned:
            return None

        numeric_alias = {
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
        }
        if cleaned.isdigit() and cleaned in numeric_alias:
            cleaned = numeric_alias[cleaned]

        upper = cleaned.upper()
        mapping = {
            'NR': 'NR',
            'NR_NSA': 'NR',
            'NR_SA': 'NR',
            'LTE_CA': 'LTE+',
            'LTE': 'LTE',
            'HSPAP': 'HSPA+',
            'HSPA': 'HSPA',
            'UMTS': 'UMTS',
            'EDGE': 'EDGE',
            'GPRS': 'GPRS',
            'GSM': 'GSM',
            'CDMA': 'CDMA',
            'EVDO_0': 'EVDO',
            'EVDO_A': 'EVDO',
            'EVDO_B': 'EVDO',
        }
        label = mapping.get(upper, upper)
        return label

    async def _get_device_details(self, device_id: str, status: str) -> Dict[str, Any]:
        """Get detailed information for a specific device"""
        device_info = {
            "id": device_id,
            "status": "online" if status == "device" else status,
            "model": "Unknown",
            "name": "Unknown",
            "brand": "Unknown",
            "marketing_name": "Unknown",
            "android_version": "Unknown",
            "connection_type": "USB",
            "last_seen": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "airplane_mode": False,
        }
        
        if status == "device":
            try:
                # Get device model
                model_result = subprocess.run(
                    self._adb_cmd(['shell', 'getprop', 'ro.product.model'], device_id),
                    capture_output=True, text=True, timeout=5
                )
                if model_result.returncode == 0:
                    device_info["model"] = model_result.stdout.strip()
                
                # Get Android version
                version_result = subprocess.run(
                    self._adb_cmd(['shell', 'getprop', 'ro.build.version.release'], device_id),
                    capture_output=True, text=True, timeout=5
                )
                if version_result.returncode == 0:
                    device_info["android_version"] = version_result.stdout.strip()
                
                # Read airplane mode state so UI can react immediately
                airplane_state = subprocess.run(
                    self._adb_cmd(['shell', 'settings', 'get', 'global', 'airplane_mode_on'], device_id),
                    capture_output=True, text=True, timeout=5
                )
                if airplane_state.returncode == 0:
                    device_info["airplane_mode"] = airplane_state.stdout.strip() == "1"
                
                # Get device name (brand + model + marketing name)
                brand_result = subprocess.run(
                    self._adb_cmd(['shell', 'getprop', 'ro.product.brand'], device_id),
                    capture_output=True, text=True, timeout=5
                )
                
                # Try multiple properties to get the best device name
                props_to_try = [
                    'ro.product.marketname',
                    'ro.product.model.display', 
                    'ro.product.name',
                    'ro.config.marketing_name',
                    'ro.product.device'
                ]
                
                brand = brand_result.stdout.strip() if brand_result.returncode == 0 else "Unknown"
                best_name = ""
                
                # Try each property to find the best commercial name
                for prop in props_to_try:
                    try:
                        result = subprocess.run(
                            self._adb_cmd(['shell', 'getprop', prop], device_id),
                            capture_output=True, text=True, timeout=3
                        )
                        if result.returncode == 0 and result.stdout.strip():
                            prop_value = result.stdout.strip()
                            # Skip if it's just a model code (contains mostly uppercase and numbers)
                            if not (len(prop_value) < 15 and prop_value.replace('-', '').replace('_', '').isalnum() and any(c.isupper() for c in prop_value)):
                                best_name = prop_value
                                break
                    except:
                        continue
                
                # Build device name with brand mapping for common brands
                brand_mapping = {
                    'samsung': 'Samsung',
                    'xiaomi': 'Xiaomi', 
                    'huawei': 'Huawei',
                    'oppo': 'OPPO',
                    'vivo': 'Vivo',
                    'oneplus': 'OnePlus',
                    'google': 'Google',
                    'motorola': 'Motorola',
                    'nokia': 'Nokia',
                    'sony': 'Sony'
                }
                
                clean_brand = brand_mapping.get(brand.lower(), brand.title())
                
                # Enhanced Samsung model mapping database
                samsung_models = {
                    # Galaxy A Series
                    'SM-A426': 'Galaxy A42 5G',
                    'SM-A525': 'Galaxy A52',
                    'SM-A715': 'Galaxy A71',
                    'SM-A125': 'Galaxy A12',
                    'SM-A225': 'Galaxy A22',
                    'SM-A325': 'Galaxy A32',
                    'SM-A725': 'Galaxy A72',
                    'SM-A025': 'Galaxy A02s',
                    'SM-A115': 'Galaxy A11',
                    'SM-A515': 'Galaxy A51',
                    'SM-A705': 'Galaxy A70',
                    
                    # Galaxy S Series
                    'SM-G991': 'Galaxy S21',
                    'SM-G996': 'Galaxy S21+',
                    'SM-G998': 'Galaxy S21 Ultra',
                    'SM-G973': 'Galaxy S10',
                    'SM-G975': 'Galaxy S10+',
                    'SM-G977': 'Galaxy S10 5G',
                    'SM-G980': 'Galaxy S20',
                    'SM-G985': 'Galaxy S20+',
                    'SM-G988': 'Galaxy S20 Ultra',
                    
                    # Galaxy Note Series
                    'SM-N970': 'Galaxy Note 10',
                    'SM-N975': 'Galaxy Note 10+',
                    'SM-N981': 'Galaxy Note 20',
                    'SM-N986': 'Galaxy Note 20 Ultra',
                    
                    # Special Samsung codes (codenames)
                    'dm2qksx': 'Galaxy S21 FE',
                    'a42xuque': 'Galaxy A42 5G',
                    'dm1q': 'Galaxy S20',
                    'dm2q': 'Galaxy S20+',
                    'dm3q': 'Galaxy S20 Ultra',
                    'r8q': 'Galaxy Note 20',
                    'c2q': 'Galaxy Note 20 Ultra'
                }
                
                model = device_info["model"]
                
                # Construct full name with improved Samsung logic
                friendly_name = None
                
                if clean_brand == "Samsung":
                    # First try direct model lookup (for special codes like dm2qksx, a42xuque)
                    friendly_name = samsung_models.get(model.lower())
                    
                    # Also try the model as-is (case sensitive)
                    if not friendly_name:
                        friendly_name = samsung_models.get(model)
                    
                    # If not found and it's SM- format, try prefix lookup
                    if not friendly_name and model.startswith("SM-"):
                        model_prefix = model[:6]  # Get SM-A426 from SM-A426U1
                        friendly_name = samsung_models.get(model_prefix)
                
                # Use best_name if it's not a technical code
                if not friendly_name and best_name:
                    # Check if best_name looks like a friendly name (not just codes)
                    if not (len(best_name) < 12 and best_name.replace('-', '').replace('_', '').isalnum()):
                        friendly_name = best_name
                
                # Build final device name - prioritize Samsung friendly names
                if friendly_name:
                    if clean_brand != "Unknown" and clean_brand.lower() not in friendly_name.lower():
                        device_info["name"] = f"{clean_brand} {friendly_name}"
                    else:
                        device_info["name"] = friendly_name if "Galaxy" in friendly_name else f"{clean_brand} {friendly_name}"
                elif best_name and not (len(best_name) < 12 and best_name.replace('-', '').replace('_', '').isalnum()):
                    if clean_brand != "Unknown" and clean_brand.lower() not in best_name.lower():
                        device_info["name"] = f"{clean_brand} {best_name}"
                    else:
                        device_info["name"] = best_name
                elif clean_brand != "Unknown" and model != "Unknown":
                    device_info["name"] = f"{clean_brand} {model}"
                else:
                    device_info["name"] = model if model != "Unknown" else "Unknown Device"
                
                device_info["brand"] = clean_brand
                device_info["marketing_name"] = best_name
                
                # Get battery level
                try:
                    device_info["battery_level"] = "Unknown"
                    battery_result = subprocess.run(
                        self._adb_cmd(['shell', 'dumpsys', 'battery'], device_id),
                        capture_output=True, text=True, timeout=5
                    )
                    if battery_result.returncode == 0:
                        for line in battery_result.stdout.split('\n'):
                            if 'level:' in line:
                                level_value = line.split(':')[1].strip()
                                device_info["battery_level"] = level_value + '%'
                                break
                except:
                    device_info["battery_level"] = "Unknown"
                
                # Get network operator
                try:
                    operator_props = [
                        'gsm.operator.alpha',
                        'gsm.sim.operator.alpha',
                        'gsm.operator.alpha.1',
                        'gsm.operator.alpha.2'
                    ]
                    operator_value = None

                    for prop in operator_props:
                        result = subprocess.run(
                            self._adb_cmd(['shell', 'getprop', prop], device_id),
                            capture_output=True, text=True, timeout=3
                        )
                        if result.returncode == 0 and result.stdout.strip():
                            operator_value = result.stdout.strip()
                            break

                    if not operator_value:
                        numeric_props = ['gsm.operator.numeric', 'gsm.sim.operator.numeric']
                        for prop in numeric_props:
                            result = subprocess.run(
                                self._adb_cmd(['shell', 'getprop', prop], device_id),
                                capture_output=True, text=True, timeout=3
                            )
                            if result.returncode == 0 and result.stdout.strip():
                                operator_value = result.stdout.strip()
                                break

                    sanitized_operator = self._sanitize_operator_label(operator_value)
                    device_info["network_operator"] = sanitized_operator or (operator_value.strip() if operator_value else "Unknown")
                except Exception:
                    device_info["network_operator"] = None

                # Get network technology
                try:
                    network_type = None
                    network_prop = subprocess.run(
                        self._adb_cmd(['shell', 'getprop', 'gsm.network.type'], device_id),
                        capture_output=True, text=True, timeout=5
                    )
                    if network_prop.returncode == 0:
                        candidate = network_prop.stdout.strip()
                        if candidate and candidate.lower() != 'unknown':
                            network_type = candidate

                    if not network_type:
                        telephony = subprocess.run(
                            self._adb_cmd(['shell', 'dumpsys', 'telephony.registry'], device_id),
                            capture_output=True, text=True, timeout=7
                        )
                        if telephony.returncode == 0:
                            match = re.search(r'dataNetworkType\s*=\s*([A-Z0-9_+-]+)', telephony.stdout, re.IGNORECASE)
                            if match:
                                network_type = match.group(1)
                    if network_type:
                        device_info["network_technology"] = self._normalize_network_label(network_type)
                except Exception:
                    device_info["network_technology"] = None
                        
            except subprocess.TimeoutExpired:
                logger.warning(f"Timeout getting details for device {device_id}")
            except Exception as e:
                logger.warning(f"Error getting details for device {device_id}: {e}")
        
        return device_info
    
    async def test_device(self, device_id: str) -> Dict[str, Any]:
        """Test device connectivity"""
        try:
            result = subprocess.run(
                self._adb_cmd(['shell', 'echo', 'test'], device_id),
                capture_output=True, text=True, timeout=10
            )
            
            if result.returncode == 0:
                return {
                    "success": True,
                    "message": f"Device {device_id} connection test passed"
                }
            else:
                return {
                    "success": False,
                    "message": f"Device {device_id} test failed: {result.stderr}"
                }
                
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "message": f"Device {device_id} test timed out"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Device {device_id} test failed: {str(e)}"
            }
    
    async def reboot_device(self, device_id: str) -> Dict[str, Any]:
        """Reboot a specific device"""
        try:
            result = subprocess.run(
                self._adb_cmd(['reboot'], device_id),
                capture_output=True, text=True, timeout=10
            )
            
            if result.returncode == 0:
                return {
                    "success": True,
                    "message": f"Device {device_id} reboot initiated"
                }
            else:
                return {
                    "success": False,
                    "message": f"Device {device_id} reboot failed: {result.stderr}"
                }
                
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "message": f"Device {device_id} reboot timed out"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Device {device_id} reboot failed: {str(e)}"
            }
    
    async def disconnect_device(self, device_id: str) -> Dict[str, Any]:
        """Disconnect a specific device"""
        try:
            result = subprocess.run(
                self._adb_cmd(['disconnect', device_id]),
                capture_output=True, text=True, timeout=10
            )
            
            if result.returncode == 0:
                return {
                    "success": True,
                    "message": f"Device {device_id} disconnected successfully"
                }
            else:
                return {
                    "success": False,
                    "message": f"Device {device_id} disconnect failed: {result.stderr}"
                }
                
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "message": f"Device {device_id} disconnect timed out"
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Device {device_id} disconnect failed: {str(e)}"
            }

# Global device manager instance
device_manager = DeviceManager()

@router.get("/devices")
async def get_devices(dep1=Depends(require_api_key), dep2=Depends(enforce_rate_limit)):
    """Get all connected devices"""
    devices = await device_manager.get_devices()
    return devices

@router.get("/devices/{device_id}")
async def get_device(device_id: str, dep1=Depends(require_api_key), dep2=Depends(enforce_rate_limit)):
    """Get specific device information"""
    devices = await device_manager.get_devices()
    device = next((d for d in devices if d["id"] == device_id), None)
    
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    return device

@router.post("/devices/{device_id}/test")
async def test_device(device_id: str, dep1=Depends(require_api_key), dep2=Depends(enforce_rate_limit)):
    """Test device connectivity"""
    result = await device_manager.test_device(device_id)
    return result

@router.post("/devices/{device_id}/reboot")
async def reboot_device(device_id: str, dep1=Depends(require_api_key), dep2=Depends(enforce_rate_limit)):
    """Reboot a device"""
    result = await device_manager.reboot_device(device_id)
    return result

@router.post("/devices/{device_id}/disconnect")
async def disconnect_device(device_id: str, dep1=Depends(require_api_key), dep2=Depends(enforce_rate_limit)):
    """Disconnect a device"""
    result = await device_manager.disconnect_device(device_id)
    return result

@router.get("/devices/{device_id}/info")
async def get_device_info(device_id: str, dep1=Depends(require_api_key), dep2=Depends(enforce_rate_limit)):
    """Get detailed device information"""
    try:
        # Get comprehensive device info
        info_commands = {
            "model": "ro.product.model",
            "brand": "ro.product.brand", 
            "android_version": "ro.build.version.release",
            "api_level": "ro.build.version.sdk",
            "serial": "ro.serialno",
        }
        
        device_info = {"id": device_id}
        
        for key, prop in info_commands.items():
            try:
                result = subprocess.run(
                    device_manager._adb_cmd(['shell', 'getprop', prop], device_id),
                    capture_output=True, text=True, timeout=5
                )
                if result.returncode == 0:
                    device_info[key] = result.stdout.strip()
            except:
                device_info[key] = "Unknown"
        
        return device_info
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting device info: {str(e)}")
