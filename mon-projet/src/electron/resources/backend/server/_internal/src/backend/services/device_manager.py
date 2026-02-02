"""Device manager service for handling device operations."""

import asyncio
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import logging

from core.database import get_db, ensure_sql_schema
from models.device import Device, DeviceStatus
from models.device_log import DeviceLog, LogLevel
from services.adb_manager import adb_manager
from api.websocket import connection_manager

logger = logging.getLogger(__name__)


class DeviceManager:
    """Manages device detection, monitoring, and database operations."""
    
    def __init__(self):
        self.scan_interval = 5  # seconds
        self.scan_task = None
        self.is_scanning = False
        self._device_logs_cache: Dict[Tuple[str, int, int], Dict[str, object]] = {}
        self._device_logs_cache_ttl = timedelta(seconds=5)
        
    async def start_monitoring(self):
        """Start continuous device monitoring."""
        if self.scan_task and not self.scan_task.done():
            return
            
        self.is_scanning = True
        self.scan_task = asyncio.create_task(self._monitoring_loop())
        logger.info("Device monitoring started")
        
    async def stop_monitoring(self):
        """Stop device monitoring."""
        self.is_scanning = False
        if self.scan_task:
            self.scan_task.cancel()
            try:
                await self.scan_task
            except asyncio.CancelledError:
                pass
        logger.info("Device monitoring stopped")
        
    async def _monitoring_loop(self):
        """Continuous monitoring loop."""
        while self.is_scanning:
            try:
                await self.scan_and_update_devices()
                await asyncio.sleep(self.scan_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in device monitoring loop: {e}")
                await asyncio.sleep(self.scan_interval)
                
    async def scan_and_update_devices(self) -> List[Dict]:
        """Scan for devices and update database."""
        try:
            ensure_sql_schema()
            # Scan for connected devices
            connected_device_ids = await adb_manager.scan_devices()
            
            # Get database session
            db = next(get_db())
            
            try:
                # Get all devices from database
                db_devices = db.query(Device).all()
                db_device_ids = {device.id for device in db_devices}
                
                # Update existing devices and add new ones
                updated_devices = []
                
                for device_id in connected_device_ids:
                    device_info = await adb_manager.get_device_info(device_id, force_refresh=True)
                    
                    # Find existing device or create new one
                    device = db.query(Device).filter(Device.id == device_id).first()
                    
                    if device:
                        # Update existing device
                        old_status = device.status
                        device.model = device_info.get('model', device.model)
                        device.os_version = device_info.get('os_version', device.os_version)
                        device.update_status(DeviceStatus.CONNECTED)
                        sim_present = device_info.get('sim_present')
                        if sim_present is False:
                            device.sim_info = {}
                        elif 'mcc' in device_info and 'mnc' in device_info:
                            device.sim_info = {
                                'mcc': device_info['mcc'],
                                'mnc': device_info['mnc'],
                                'carrier': device_info.get('carrier', 'Unknown')
                            }
                        capabilities = device.capabilities or {}
                        capabilities.update({
                            "battery_level": device_info.get('battery_level'),
                            "network_operator": device_info.get('network_operator'),
                            "network_technology": device_info.get('network_technology'),
                            "connection_type": device_info.get('connection_type'),
                            "carrier": device_info.get('carrier'),
                        })
                        if 'airplane_mode' in device_info:
                            capabilities["airplane_mode"] = device_info.get('airplane_mode')
                        device.capabilities = {k: v for k, v in capabilities.items() if v is not None}
                        
                        # Log status change if needed
                        if old_status != DeviceStatus.CONNECTED:
                            log_entry = DeviceLog.create_connection_log(device_id, True)
                            db.add(log_entry)
                            
                    else:
                        # Create new device
                        device = Device(
                            id=device_id,
                            model=device_info.get('model', 'Unknown'),
                            os_version=device_info.get('os_version', 'Unknown'),
                            status=DeviceStatus.CONNECTED
                        )
                        
                        # Add SIM info if available
                        sim_present = device_info.get('sim_present')
                        if sim_present is False:
                            device.sim_info = {}
                        elif 'mcc' in device_info and 'mnc' in device_info:
                            device.sim_info = {
                                'mcc': device_info['mcc'],
                                'mnc': device_info['mnc'],
                                'carrier': device_info.get('carrier', 'Unknown')
                            }
                            
                        # Add phone number if available
                        if 'phone_number' in device_info:
                            device.phone_number = device_info['phone_number']
                            
                        db.add(device)
                        
                        # Log new device connection
                        log_entry = DeviceLog.create_connection_log(device_id, True)
                        db.add(log_entry)

                        device.capabilities = {
                            "battery_level": device_info.get('battery_level'),
                            "network_operator": device_info.get('network_operator'),
                            "network_technology": device_info.get('network_technology'),
                            "connection_type": device_info.get('connection_type'),
                            "carrier": device_info.get('carrier'),
                        }
                        if 'airplane_mode' in device_info:
                            device.capabilities["airplane_mode"] = device_info.get('airplane_mode')
                        device.capabilities = {k: v for k, v in (device.capabilities or {}).items() if v is not None}
                        
                    updated_devices.append(device.to_dict())
                    
                # Mark disconnected devices
                disconnected_ids = db_device_ids - set(connected_device_ids)
                for device_id in disconnected_ids:
                    device = db.query(Device).filter(Device.id == device_id).first()
                    if device and device.status != DeviceStatus.DISCONNECTED:
                        old_status = device.status
                        device.update_status(DeviceStatus.DISCONNECTED)
                        
                        # Log disconnection
                        log_entry = DeviceLog.create_connection_log(device_id, False)
                        db.add(log_entry)
                        
                        # Notify via WebSocket
                        await connection_manager.send_device_status(
                            device_id,
                            {"status": "disconnected", "last_seen": device.last_seen.isoformat()}
                        )
                        
                db.commit()
                
                # Broadcast device updates via WebSocket
                for device_data in updated_devices:
                    await connection_manager.send_device_status(
                        device_data['id'],
                        {
                            "status": device_data['status'],
                            "last_seen": device_data['last_seen'],
                            "model": device_data['model'],
                            "os_version": device_data['os_version']
                        }
                    )
                    
                return updated_devices
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error scanning devices: {e}")
            return []
            
    async def get_all_devices(self) -> List[Dict]:
        """Get all devices from database."""
        db = next(get_db())
        try:
            devices = db.query(Device).order_by(Device.last_seen.desc(), Device.id.asc()).all()
            return [device.to_dict() for device in devices]
        finally:
            db.close()
            
    async def get_device(self, device_id: str) -> Optional[Dict]:
        """Get specific device by ID."""
        db = next(get_db())
        try:
            device = db.query(Device).filter(Device.id == device_id).first()
            return device.to_dict() if device else None
        finally:
            db.close()
            
    async def get_connected_devices(self) -> List[Dict]:
        """Get only connected devices."""
        db = next(get_db())
        try:
            devices = (
                db.query(Device)
                .filter(Device.status == DeviceStatus.CONNECTED)
                .order_by(Device.last_seen.desc(), Device.id.asc())
                .all()
            )
            return [device.to_dict() for device in devices]
        finally:
            db.close()
            
    async def set_device_busy(self, device_id: str) -> bool:
        """Mark device as busy."""
        db = next(get_db())
        try:
            device = db.query(Device).filter(Device.id == device_id).first()
            if device and device.is_available():
                device.set_busy()
                db.commit()
                
                # Notify via WebSocket
                await connection_manager.send_device_status(
                    device_id,
                    {"status": "busy", "last_seen": device.last_seen.isoformat()}
                )
                return True
            return False
        finally:
            db.close()
            
    async def set_device_available(self, device_id: str) -> bool:
        """Mark device as available."""
        db = next(get_db())
        try:
            device = db.query(Device).filter(Device.id == device_id).first()
            if device:
                device.set_available()
                db.commit()
                
                # Notify via WebSocket
                await connection_manager.send_device_status(
                    device_id,
                    {"status": "connected", "last_seen": device.last_seen.isoformat()}
                )
                return True
            return False
        finally:
            db.close()
            
    async def get_device_logs(self, device_id: str, limit: int = 100, offset: int = 0) -> List[Dict]:
        """Get recent logs for a device."""
        cache_key = (device_id, limit, offset)
        now = datetime.utcnow()
        cached = self._device_logs_cache.get(cache_key)
        if cached and cached["expires_at"] > now:
            return cached["logs"]

        db = next(get_db())
        try:
            logs = (db.query(DeviceLog)
                   .filter(DeviceLog.device_id == device_id)
                   .order_by(DeviceLog.created_at.desc())
                   .limit(limit)
                   .offset(offset)
                   .all())
            payload = [log.to_dict() for log in logs]
            self._device_logs_cache[cache_key] = {
                "expires_at": now + self._device_logs_cache_ttl,
                "logs": payload,
            }
            if len(self._device_logs_cache) > 512:
                self._device_logs_cache = {
                    key: value
                    for key, value in self._device_logs_cache.items()
                    if value["expires_at"] > now
                }
                if len(self._device_logs_cache) > 512:
                    self._device_logs_cache.clear()
            return payload
        finally:
            db.close()

    async def get_device_logs_in_range(
        self,
        device_id: str,
        start: datetime,
        end: datetime,
        limit: int = 1000
    ) -> List[Dict]:
        """Get logs for a device within a datetime range."""
        db = next(get_db())
        try:
            logs = (db.query(DeviceLog)
                   .filter(DeviceLog.device_id == device_id)
                   .filter(DeviceLog.created_at >= start)
                   .filter(DeviceLog.created_at <= end)
                   .order_by(DeviceLog.created_at.asc())
                   .limit(limit)
                   .all())
            return [log.to_dict() for log in logs]
        finally:
            db.close()


# Global device manager instance
device_manager = DeviceManager()
