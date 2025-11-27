"""FlowModule model for module sequences in flows."""

from sqlalchemy import Column, String, Integer, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship

from .base import Base, UUIDMixin, TimestampMixin


class FlowModule(Base, UUIDMixin, TimestampMixin):
    """Model representing a module within a flow sequence."""
    
    __tablename__ = "flow_modules"
    
    # Foreign keys
    flow_id = Column(String(36), ForeignKey("flows.id"), nullable=False)
    module_id = Column(String(255), nullable=False)  # Reference to module registry
    
    # Sequence configuration
    sequence_order = Column(Integer, nullable=False)
    input_parameters = Column(JSON, nullable=True)
    
    # Execution configuration
    continue_on_failure = Column(Boolean, default=False)
    retry_count = Column(Integer, default=0)
    timeout_seconds = Column(Integer, nullable=True)
    
    # Relationships
    flow = relationship("Flow", back_populates="modules")
    
    def __repr__(self):
        return f"<FlowModule(flow_id='{self.flow_id}', module_id='{self.module_id}', order={self.sequence_order})>"
    
    def to_dict(self):
        """Convert flow module to dictionary representation."""
        return {
            "id": str(self.id),
            "flow_id": str(self.flow_id),
            "module_id": self.module_id,
            "sequence_order": self.sequence_order,
            "input_parameters": self.input_parameters or {},
            "continue_on_failure": self.continue_on_failure,
            "retry_count": self.retry_count,
            "timeout_seconds": self.timeout_seconds,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
