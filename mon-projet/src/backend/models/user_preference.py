"""User preference storage (key/value)."""

from sqlalchemy import Column, String, JSON

from .base import Base, TimestampMixin


class UserPreference(Base, TimestampMixin):
    """Persisted user preference (simple key/value JSON)."""

    __tablename__ = "user_preferences"

    key = Column(String, primary_key=True)
    value = Column(JSON, nullable=True)

    def to_dict(self):
        return {"key": self.key, "value": self.value}
