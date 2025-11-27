"""Database migration script to add missing columns."""

import sqlite3
import os

def migrate_database():
    """Add missing columns to existing database."""
    db_path = "../../data/app.db"
    
    # Create data directory if it doesn't exist
    os.makedirs("../../data", exist_ok=True)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if devices table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='devices'")
        if not cursor.fetchone():
            print("Creating devices table...")
            cursor.execute("""
                CREATE TABLE devices (
                    id TEXT PRIMARY KEY,
                    phone_number TEXT,
                    sim_info TEXT,
                    model TEXT NOT NULL,
                    os_version TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'connected',
                    last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    developer_mode_enabled BOOLEAN NOT NULL DEFAULT 1,
                    usb_debugging_enabled BOOLEAN NOT NULL DEFAULT 1,
                    adb_state TEXT,
                    capabilities TEXT,
                    is_rooted BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
        else:
            # Add missing columns if they don't exist
            columns_to_add = [
                ("developer_mode_enabled", "BOOLEAN NOT NULL DEFAULT 1"),
                ("usb_debugging_enabled", "BOOLEAN NOT NULL DEFAULT 1"),
                ("adb_state", "TEXT"),
                ("capabilities", "TEXT"),
                ("is_rooted", "BOOLEAN DEFAULT 0")
            ]
            
            for column_name, column_def in columns_to_add:
                try:
                    cursor.execute(f"ALTER TABLE devices ADD COLUMN {column_name} {column_def}")
                    print(f"Added column: {column_name}")
                except sqlite3.OperationalError as e:
                    if "duplicate column name" in str(e):
                        print(f"Column {column_name} already exists")
                    else:
                        print(f"Error adding column {column_name}: {e}")
        
        conn.commit()
        print("Database migration completed successfully!")
        
    except Exception as e:
        print(f"Migration error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_database()
