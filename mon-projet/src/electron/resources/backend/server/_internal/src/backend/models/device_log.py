"""Device log model for tracking device activity."""

from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from .base import Base, UUIDMixin, TimestampMixin


class LogLevel(enum.Enum):
    """Log level enumeration."""
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class DeviceLog(Base, UUIDMixin, TimestampMixin):
    """Model for device activity logs."""
    
    __tablename__ = "device_logs"
    
    # Foreign key to device
    device_id = Column(String, ForeignKey("devices.id"), nullable=False)
    
    # Log details
    level = Column(Enum(LogLevel), default=LogLevel.INFO, nullable=False)
    message = Column(Text, nullable=False)
    event_type = Column(String, nullable=True)  # connection, command, error, etc.
    
    # Optional execution context
    execution_id = Column(String, nullable=True)
    module_id = Column(String, nullable=True)
    
    # Additional metadata
    extra_metadata = Column(Text, nullable=True)  # JSON string for additional context
    
    # Relationship
    device = relationship("Device", backref="logs")
    
    def __repr__(self):
        return f"<DeviceLog(device_id='{self.device_id}', level='{self.level.value}', message='{self.message[:50]}...')>"
    
    def to_dict(self):
        """Convert log entry to dictionary representation."""
        return {
            "id": str(self.id),
            "device_id": self.device_id,
            "level": self.level.value,
            "message": self.message,
            "event_type": self.event_type,
            "execution_id": self.execution_id,
            "module_id": self.module_id,
            "metadata": self.extra_metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
    
    @classmethod
    def create_connection_log(cls, device_id: str, connected: bool):
        """Create a connection status log entry."""
        message = f"Device {'connected' if connected else 'disconnected'}"
        return cls(
            device_id=device_id,
            level=LogLevel.INFO,
            message=message,
            event_type="connection"
        )
    
    @classmethod
    def create_command_log(cls, device_id: str, command: str, success: bool, output: str = ""):
        """Create an ADB command log entry."""
        level = LogLevel.INFO if success else LogLevel.ERROR
        message = f"ADB command {'succeeded' if success else 'failed'}: {command}"
        return cls(
            device_id=device_id,
            level=level,
            message=message,
            event_type="command",
            extra_metadata=output[:1000] if output else None  # Truncate long output
        )
    
    @classmethod
    def create_error_log(cls, device_id: str, error_message: str, execution_id: str = None):
        """Create an error log entry."""
        return cls(
            device_id=device_id,
            level=LogLevel.ERROR,
            message=error_message,
            event_type="error",
            execution_id=execution_id
        )
