"""Device model for connected Android devices."""

from sqlalchemy import Column, String, DateTime, Boolean, JSON, Enum
from datetime import datetime, timezone
import enum

from .base import Base, TimestampMixin


class DeviceStatus(enum.Enum):
    """Device connection status enumeration."""
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    BUSY = "busy"
    ERROR = "error"
    SETUP_REQUIRED = "setup_required"


class Device(Base, TimestampMixin):
    """Model representing a connected Android device."""
    
    __tablename__ = "devices"
    
    # Primary key is the ADB device ID
    id = Column(String, primary_key=True)
    
    # Device metadata
    phone_number = Column(String, nullable=True)
    sim_info = Column(JSON, nullable=True)  # MCC, MNC, carrier info
    model = Column(String, nullable=False)
    os_version = Column(String, nullable=False)
    
    # Connection status
    status = Column(Enum(DeviceStatus), default=DeviceStatus.CONNECTED, nullable=False)
    last_seen = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Device configuration flags
    developer_mode_enabled = Column(Boolean, default=True, nullable=False)
    usb_debugging_enabled = Column(Boolean, default=True, nullable=False)
    adb_state = Column(String, nullable=True)
    
    # Device capabilities and configuration
    capabilities = Column(JSON, nullable=True)
    is_rooted = Column(Boolean, default=False)
    
    def __repr__(self):
        return f"<Device(id='{self.id}', model='{self.model}', status='{self.status.value}')>"
    
    def to_dict(self):
        """Convert device to dictionary representation."""
        capabilities = self.capabilities or {}
        return {
            "id": self.id,
            "phone_number": self.phone_number,
            "sim_info": self.sim_info or {},
            "model": self.model,
            "os_version": self.os_version,
            "status": self.status.value,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
            "capabilities": self.capabilities or {},
            "is_rooted": self.is_rooted,
            "developer_mode_enabled": self.developer_mode_enabled,
            "usb_debugging_enabled": self.usb_debugging_enabled,
            "adb_state": self.adb_state,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "battery_level": capabilities.get("battery_level"),
            "network_operator": capabilities.get("network_operator"),
            "network_technology": capabilities.get("network_technology"),
            "connection_type": capabilities.get("connection_type"),
            "carrier": capabilities.get("carrier") or (self.sim_info or {}).get("carrier"),
        }
    
    def update_status(self, new_status: DeviceStatus):
        """Update device status and last seen timestamp."""
        self.status = new_status
        self.last_seen = datetime.now(timezone.utc)
        
    def is_available(self) -> bool:
        """Check if device is available for execution."""
        return self.status == DeviceStatus.CONNECTED
        
    def set_busy(self):
        """Mark device as busy during execution."""
        self.status = DeviceStatus.BUSY
        self.last_seen = datetime.now(timezone.utc)
        
    def set_available(self):
        """Mark device as available after execution."""
        self.status = DeviceStatus.CONNECTED
        self.last_seen = datetime.now(timezone.utc)
