"""Module run history model for catalog-driven executions."""

from __future__ import annotations

from datetime import datetime, timezone
import enum
from typing import Any, Dict, Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Integer,
    String,
    Text,
)

from .base import Base, TimestampMixin, UUIDMixin


class ModuleRunStatus(enum.Enum):
    """Lifecycle states for individual module executions."""

    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ModuleRun(Base, UUIDMixin, TimestampMixin):
    """Persisted record of an individual module execution."""

    __tablename__ = "module_runs"

    module_id = Column(String(100), nullable=False)
    module_name = Column(String(255), nullable=False)
    device_id = Column(String(100), nullable=True)

    status = Column(Enum(ModuleRunStatus), default=ModuleRunStatus.QUEUED, nullable=False)
    success = Column(Boolean, default=False, nullable=False)
    error_message = Column(Text, nullable=True)

    parameters_json = Column(Text, nullable=True)
    result_json = Column(Text, nullable=True)

    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)

    def mark_running(self) -> None:
        self.status = ModuleRunStatus.RUNNING
        self.started_at = datetime.now(timezone.utc)

    def mark_completed(self, *, success: bool, result_json: Optional[str], duration_ms: int) -> None:
        self.status = ModuleRunStatus.COMPLETED
        self.success = success
        self.result_json = result_json
        self.completed_at = datetime.now(timezone.utc)
        self.duration_ms = duration_ms

    def mark_failed(self, error_message: str) -> None:
        self.status = ModuleRunStatus.FAILED
        self.success = False
        self.error_message = error_message
        self.completed_at = datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        """Shape suitable for API responses."""
        return {
            "id": self.id,
            "module_id": self.module_id,
            "module_name": self.module_name,
            "device_id": self.device_id,
            "status": self.status.value,
            "success": self.success,
            "error_message": self.error_message,
            "parameters_json": self.parameters_json,
            "result_json": self.result_json,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "duration_ms": self.duration_ms,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
