"""Report model for execution reports."""

from sqlalchemy import Column, String, Integer, DateTime, Boolean, Enum, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from .base import Base, UUIDMixin, TimestampMixin


class ReportFormat(enum.Enum):
    """Report format enumeration."""
    PDF = "pdf"
    CSV = "csv"
    HTML = "html"
    JSON = "json"


class Report(Base, UUIDMixin, TimestampMixin):
    """Model representing an execution report."""
    
    __tablename__ = "reports"
    
    # Foreign key to execution
    execution_id = Column(String(36), ForeignKey("executions.id"), nullable=False)
    
    # Report details
    format = Column(Enum(ReportFormat), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    generation_time_seconds = Column(Integer, nullable=False)
    
    # Report content flags
    includes_screenshots = Column(Boolean, default=True)
    includes_logs = Column(Boolean, default=True)
    
    # Relationships
    execution = relationship("Execution", back_populates="reports")
    
    def __repr__(self):
        return f"<Report(id='{self.id}', execution_id='{self.execution_id}', format='{self.format.value}')>"
    
    def to_dict(self):
        """Convert report to dictionary representation."""
        return {
            "id": str(self.id),
            "execution_id": str(self.execution_id),
            "format": self.format.value,
            "file_path": self.file_path,
            "file_size_bytes": self.file_size_bytes,
            "generation_time_seconds": self.generation_time_seconds,
            "includes_screenshots": self.includes_screenshots,
            "includes_logs": self.includes_logs,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
