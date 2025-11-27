"""ExecutionDevice model for device assignments to executions."""

from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum

from .base import Base, UUIDMixin, TimestampMixin


class ExecutionDeviceStatus(enum.Enum):
    """Execution device status enumeration."""
    ASSIGNED = "assigned"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ExecutionDevice(Base, UUIDMixin, TimestampMixin):
    """Model representing device assignment to execution."""
    
    __tablename__ = "execution_devices"
    
    # Foreign keys
    execution_id = Column(String(36), ForeignKey("executions.id"), nullable=False)
    device_id = Column(String(255), ForeignKey("devices.id"), nullable=False)
    
    # Execution status and timing
    status = Column(Enum(ExecutionDeviceStatus), default=ExecutionDeviceStatus.ASSIGNED, nullable=False)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    
    # Error handling
    error_message = Column(Text, nullable=True)
    
    # Artifacts
    artifacts_path = Column(String(500), nullable=True)
    
    # Relationships
    execution = relationship("Execution", back_populates="devices")
    device = relationship("Device")
    steps = relationship("ExecutionStep", back_populates="execution_device", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<ExecutionDevice(execution_id='{self.execution_id}', device_id='{self.device_id}', status='{self.status.value}')>"
    
    def to_dict(self):
        """Convert execution device to dictionary representation."""
        duration = None
        if self.start_time and self.end_time:
            duration = (self.end_time - self.start_time).total_seconds()
        elif self.start_time:
            duration = (datetime.now(timezone.utc) - self.start_time).total_seconds()
            
        return {
            "id": str(self.id),
            "execution_id": str(self.execution_id),
            "device_id": self.device_id,
            "status": self.status.value,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_seconds": duration,
            "error_message": self.error_message,
            "artifacts_path": self.artifacts_path,
            "step_count": len(self.steps),
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
    
    def start_execution(self):
        """Mark device execution as started."""
        self.status = ExecutionDeviceStatus.RUNNING
        self.start_time = datetime.now(timezone.utc)
        
    def complete_execution(self):
        """Mark device execution as completed."""
        self.status = ExecutionDeviceStatus.COMPLETED
        self.end_time = datetime.now(timezone.utc)
        
    def fail_execution(self, error_message: str):
        """Mark device execution as failed."""
        self.status = ExecutionDeviceStatus.FAILED
        self.end_time = datetime.now(timezone.utc)
        self.error_message = error_message
