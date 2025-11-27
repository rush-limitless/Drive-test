"""Initialize database with all required tables."""

from sqlalchemy import create_engine
from models.base import Base
from models.device import Device
from models.execution import Execution
from models.execution_device import ExecutionDevice
from models.execution_step import ExecutionStep
from models.flow import Flow
from models.flow_module import FlowModule
from core.config import get_database_url
import os

def init_database():
    """Initialize database with all tables."""
    # Ensure data directory exists
    os.makedirs("../../data", exist_ok=True)
    
    # Create engine
    engine = create_engine(get_database_url())
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("All database tables created successfully!")

if __name__ == "__main__":
    init_database()