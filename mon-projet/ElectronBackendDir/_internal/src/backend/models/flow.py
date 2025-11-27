"""Flow model for automation sequences."""

from sqlalchemy import Column, String, Text, Integer, Boolean, Enum
from sqlalchemy.orm import relationship
import enum

from .base import Base, UUIDMixin, TimestampMixin


class FlowVisibility(enum.Enum):
    """Flow visibility enumeration."""
    PRIVATE = "private"
    SHARED = "shared"
    PUBLIC = "public"


class Flow(Base, UUIDMixin, TimestampMixin):
    """Model representing an automation flow."""
    
    __tablename__ = "flows"
    
    # Basic flow information
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(String(255), nullable=True)
    visibility = Column(Enum(FlowVisibility), default=FlowVisibility.PRIVATE, nullable=False)
    
    # Flow configuration
    is_template = Column(Boolean, default=False)
    estimated_duration_minutes = Column(Integer, nullable=True)
    
    # Relationships
    modules = relationship("FlowModule", back_populates="flow", cascade="all, delete-orphan")
    executions = relationship("Execution", back_populates="flow")
    
    def __repr__(self):
        return f"<Flow(id='{self.id}', name='{self.name}', visibility='{self.visibility.value}')>"
    
    def to_dict(self):
        """Convert flow to dictionary representation."""
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "created_by": self.created_by,
            "visibility": self.visibility.value,
            "is_template": self.is_template,
            "estimated_duration_minutes": self.estimated_duration_minutes,
            "module_count": len(self.modules),
            "modules": [module.to_dict() for module in sorted(self.modules, key=lambda m: m.sequence_order)],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    def get_ordered_modules(self):
        """Get modules ordered by sequence."""
        return sorted(self.modules, key=lambda m: m.sequence_order)
    
    def get_total_estimated_duration(self):
        """Calculate total estimated duration from modules."""
        if self.estimated_duration_minutes:
            return self.estimated_duration_minutes
        
        # Sum module timeouts as rough estimate
        total_seconds = sum(module.timeout_seconds or 300 for module in self.modules)
        return max(1, total_seconds // 60)  # Convert to minutes