"""Create a new database with correct schema."""

import os
import sys
sys.path.append('.')

from sqlalchemy import create_engine
from models.base import Base
from core.config import get_database_url

def create_new_database():
    """Create a new database with all tables."""
    # Ensure data directory exists
    os.makedirs("../../data", exist_ok=True)
    
    # Get database URL (now points to app_new.db)
    db_url = get_database_url()
    print(f"Creating new database at: {db_url}")
    
    # Create engine
    engine = create_engine(db_url)
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("New database created successfully with all tables!")
    
    return engine

if __name__ == "__main__":
    create_new_database()