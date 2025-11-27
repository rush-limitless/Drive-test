"""Base model class for SQLAlchemy models."""

from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, String
from sqlalchemy.orm import declarative_base
import uuid

Base = declarative_base()


class TimestampMixin:
    """Mixin for timestamp fields."""
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)


class UUIDMixin:
    """Mixin for UUID primary key."""
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))


class BaseModel(Base, UUIDMixin, TimestampMixin):
    """Abstract base model with common fields."""
    
    __abstract__ = True
    
    def to_dict(self):
        """Convert model instance to dictionary."""
        return {
            column.name: getattr(self, column.name)
            for column in self.__table__.columns
        }
