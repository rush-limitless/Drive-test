"""ExecutionStep model for individual step results."""

from sqlalchemy import Column, String, DateTime, Text, Integer, JSON, ForeignKey, Enum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum

from .base import Base, UUIDMixin, TimestampMixin


class StepStatus(enum.Enum):
    """Step execution status enumeration."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class ExecutionStep(Base, UUIDMixin, TimestampMixin):
    """Model representing individual step execution results."""
    
    __tablename__ = "execution_steps"
    
    # Foreign keys
    execution_id = Column(String(36), ForeignKey("executions.id"), nullable=False)
    execution_device_id = Column(String(36), ForeignKey("execution_devices.id"), nullable=False)
    module_id = Column(String(255), nullable=False)
    
    # Step identification
    step_index = Column(Integer, nullable=False)
    
    # Execution status and timing
    status = Column(Enum(StepStatus), default=StepStatus.PENDING, nullable=False)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    
    # Input/Output data
    input_data = Column(JSON, nullable=True)
    output_data = Column(JSON, nullable=True)
    
    # Execution logs
    stdout = Column(Text, nullable=True)
    stderr = Column(Text, nullable=True)
    
    # Artifacts
    screenshot_path = Column(String(500), nullable=True)
    
    # Error handling
    retry_attempt = Column(Integer, default=0)
    error_code = Column(String(100), nullable=True)
    
    # Relationships
    execution = relationship("Execution", back_populates="steps")
    execution_device = relationship("ExecutionDevice", back_populates="steps")
    
    def __repr__(self):
        return f"<ExecutionStep(execution_id='{self.execution_id}', module_id='{self.module_id}', step={self.step_index}, status='{self.status.value}')>"
    
    def to_dict(self):
        """Convert execution step to dictionary representation."""
        duration = None
        if self.start_time and self.end_time:
            duration = (self.end_time - self.start_time).total_seconds()
        elif self.start_time:
            duration = (datetime.now(timezone.utc) - self.start_time).total_seconds()
            
        return {
            "id": str(self.id),
            "execution_id": str(self.execution_id),
            "execution_device_id": str(self.execution_device_id),
            "module_id": self.module_id,
            "step_index": self.step_index,
            "status": self.status.value,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_seconds": duration,
            "input_data": self.input_data,
            "output_data": self.output_data,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "screenshot_path": self.screenshot_path,
            "retry_attempt": self.retry_attempt,
            "error_code": self.error_code,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
    
    def start_step(self):
        """Mark step as started."""
        self.status = StepStatus.RUNNING
        self.start_time = datetime.now(timezone.utc)
        
    def complete_step(self, output_data: dict = None, stdout: str = None):
        """Mark step as completed."""
        self.status = StepStatus.COMPLETED
        self.end_time = datetime.now(timezone.utc)
        if output_data:
            self.output_data = output_data
        if stdout:
            self.stdout = stdout
            
    def fail_step(self, error_code: str = None, stderr: str = None):
        """Mark step as failed."""
        self.status = StepStatus.FAILED
        self.end_time = datetime.now(timezone.utc)
        if error_code:
            self.error_code = error_code
        if stderr:
            self.stderr = stderr
            
    def skip_step(self):
        """Mark step as skipped."""
        self.status = StepStatus.SKIPPED
        self.end_time = datetime.now(timezone.utc)
        
    def retry_step(self):
        """Increment retry attempt and reset for retry."""
        self.retry_attempt += 1
        self.status = StepStatus.PENDING
        self.start_time = None
        self.end_time = None
        self.error_code = None
