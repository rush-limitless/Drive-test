"""Execution model for flow runtime instances."""

from sqlalchemy import Column, String, DateTime, Integer, Text, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum

from .base import Base, UUIDMixin, TimestampMixin


class ExecutionStatus(enum.Enum):
    """Execution status enumeration."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Execution(Base, UUIDMixin, TimestampMixin):
    """Model representing a flow execution instance."""
    
    __tablename__ = "executions"
    
    # Foreign key to flow
    flow_id = Column(String(36), ForeignKey("flows.id"), nullable=False)
    
    # Execution status and timing
    status = Column(Enum(ExecutionStatus), default=ExecutionStatus.PENDING, nullable=False)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    
    # Progress tracking
    progress_percentage = Column(Integer, default=0)
    current_step = Column(String(255), nullable=True)
    
    # Error handling
    error_message = Column(Text, nullable=True)
    
    # Artifacts and reporting
    artifacts_path = Column(String(500), nullable=True)
    report_generated = Column(Boolean, default=False)
    
    # Relationships
    flow = relationship("Flow", back_populates="executions")
    devices = relationship("ExecutionDevice", back_populates="execution", cascade="all, delete-orphan")
    steps = relationship("ExecutionStep", back_populates="execution", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="execution")
    
    def __repr__(self):
        return f"<Execution(id='{self.id}', flow_id='{self.flow_id}', status='{self.status.value}')>"
    
    def to_dict(self):
        """Convert execution to dictionary representation."""
        duration = None
        if self.start_time and self.end_time:
            duration = (self.end_time - self.start_time).total_seconds()
        elif self.start_time:
            duration = (datetime.now(timezone.utc) - self.start_time).total_seconds()
            
        return {
            "id": str(self.id),
            "flow_id": str(self.flow_id),
            "status": self.status.value,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_seconds": duration,
            "progress_percentage": self.progress_percentage,
            "current_step": self.current_step,
            "error_message": self.error_message,
            "artifacts_path": self.artifacts_path,
            "report_generated": self.report_generated,
            "device_count": len(self.devices),
            "devices": [device.to_dict() for device in self.devices],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    def start_execution(self):
        """Mark execution as started."""
        self.status = ExecutionStatus.RUNNING
        self.start_time = datetime.now(timezone.utc)
        
    def complete_execution(self):
        """Mark execution as completed."""
        self.status = ExecutionStatus.COMPLETED
        self.end_time = datetime.now(timezone.utc)
        self.progress_percentage = 100
        
    def fail_execution(self, error_message: str):
        """Mark execution as failed."""
        self.status = ExecutionStatus.FAILED
        self.end_time = datetime.now(timezone.utc)
        self.error_message = error_message
        
    def cancel_execution(self):
        """Mark execution as cancelled."""
        self.status = ExecutionStatus.CANCELLED
        self.end_time = datetime.now(timezone.utc)
        
    def update_progress(self, percentage: int, current_step: str = None):
        """Update execution progress."""
        self.progress_percentage = max(0, min(100, percentage))
        if current_step:
            self.current_step = current_step
            
    def is_active(self) -> bool:
        """Check if execution is currently active."""
        return self.status in [ExecutionStatus.PENDING, ExecutionStatus.RUNNING]
        
    def is_finished(self) -> bool:
        """Check if execution is finished."""
        return self.status in [ExecutionStatus.COMPLETED, ExecutionStatus.FAILED, ExecutionStatus.CANCELLED]
