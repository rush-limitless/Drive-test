"""Application configuration management."""

import os
import sys
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

from core.adb_path import ADB_EXECUTABLE as DEFAULT_ADB_EXECUTABLE


def _determine_runtime_root() -> Path:
    """Resolve a writable runtime directory for packaged and dev builds."""
    override = os.environ.get("TELCOADB_RUNTIME_DIR")
    if override:
        return Path(override).expanduser()

    if getattr(sys, "frozen", False):
# Frozen/packaged executable: default to user-specific AppData.
        base_dir = (
            os.environ.get("LOCALAPPDATA")
            or os.environ.get("APPDATA")
            or str(Path.home())
        )
        return Path(base_dir) / "TelcoADB"
# Source/development mode: keep using the repository root.
    return Path(__file__).resolve().parents[3]


RUNTIME_ROOT = _determine_runtime_root()
RUNTIME_ROOT.mkdir(parents=True, exist_ok=True)

DEFAULT_DATA_DIR = RUNTIME_ROOT / "data"
DEFAULT_ARTIFACTS_DIR = RUNTIME_ROOT / "artifacts"
DEFAULT_SCREENSHOTS_DIR = DEFAULT_ARTIFACTS_DIR / "screenshots"
DEFAULT_LOGS_DIR = DEFAULT_ARTIFACTS_DIR / "logs"
DEFAULT_REPORTS_DIR = DEFAULT_ARTIFACTS_DIR / "reports"


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)
    
    # Server configuration
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    DEBUG: bool = False
    
    # Database configuration
    DATABASE_URL: str = "sqlite:///./data/app_new.db"
# Set to "" or "disabled" to fully disable Mongo on the backend.
    MONGODB_URL: str = ""
    MONGODB_DATABASE: str = "telco_automation"
    MONGODB_SERVER_SELECTION_TIMEOUT_MS: int = 2000
    
    # Redis configuration
    REDIS_URL: str = "redis://localhost:6379"
    
    # ADB configuration
    ADB_PATH: str = DEFAULT_ADB_EXECUTABLE
    ADB_TIMEOUT: int = 30
    ADB_RETRY_ATTEMPTS: int = 2
    ADB_RETRY_BASE_DELAY: float = 0.5
    ADB_RETRY_MAX_DELAY: float = 2.0
    
    # scrcpy configuration
    SCRCPY_PATH: str = "scrcpy"
    SCRCPY_QUALITY: str = "medium"
    SCRCPY_FPS: int = 15
    
    # Execution configuration
    MAX_CONCURRENT_DEVICES: int = 20
    DEFAULT_MODULE_TIMEOUT: int = 300
    MAX_RETRY_ATTEMPTS: int = 3
    
    # Storage configuration
    ARTIFACTS_DIR: str = str(DEFAULT_ARTIFACTS_DIR)
    SCREENSHOTS_DIR: str = str(DEFAULT_SCREENSHOTS_DIR)
    LOGS_DIR: str = str(DEFAULT_LOGS_DIR)
    REPORTS_DIR: str = str(DEFAULT_REPORTS_DIR)
    
    # Security configuration
    SECRET_KEY: str = "your-secret-key-change-in-production"
    API_KEY: str = "change-me"
    RATE_LIMIT_PER_MIN: int = 60
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Metadata
    APP_VERSION: str = "2.3.9"
    
    # Logging configuration
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    


# Global settings instance
settings = Settings()


def get_database_url() -> str:
    """Get database URL with fallback logic."""
    db_url = settings.DATABASE_URL
    if not db_url.startswith("sqlite:///"):
        return db_url

    raw_path = db_url.replace("sqlite:///", "", 1)
    # In-memory or URI-based sqlite connection (e.g., :memory: or file::memory:?cache=shared)
    if raw_path.startswith(":"):
        return db_url

    relative_path = Path(raw_path)
    if not relative_path.is_absolute():
        relative_path = (RUNTIME_ROOT / relative_path).resolve()

    os.makedirs(relative_path.parent, exist_ok=True)
    return f"sqlite:///{relative_path}"


def ensure_directories():
    """Ensure all required directories exist."""
    directories = [
        settings.ARTIFACTS_DIR,
        settings.SCREENSHOTS_DIR,
        settings.LOGS_DIR,
        settings.REPORTS_DIR
    ]
    
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
