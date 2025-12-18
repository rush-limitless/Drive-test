
"""Database configuration helpers (SQL + Mongo)."""

from __future__ import annotations

import importlib
import logging
import threading
from contextlib import contextmanager
from typing import Generator, Optional

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from .config import get_database_url, settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# SQLAlchemy setup (used by legacy services / flows API)
# ---------------------------------------------------------------------------
DATABASE_URL = get_database_url()

sql_connect_args = {}
if DATABASE_URL.startswith('sqlite'):  # Enable multithreaded access for SQLite
    sql_connect_args['check_same_thread'] = False

engine: Engine = create_engine(DATABASE_URL, connect_args=sql_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_session() -> Session:
    """Return a new SQLAlchemy session."""
    return SessionLocal()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    """Provide a transactional scope around a series of operations."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ---------------------------------------------------------------------------
# MongoDB helpers (used by new async services)
# ---------------------------------------------------------------------------
_async_client: Optional[AsyncIOMotorClient] = None
_sync_client: Optional[MongoClient] = None


def get_async_client() -> AsyncIOMotorClient:
    global _async_client
    if _async_client is None:
        logger.info("Connecting to MongoDB (async) at %s", settings.MONGODB_URL)
        _async_client = AsyncIOMotorClient(
            settings.MONGODB_URL,
            serverSelectionTimeoutMS=settings.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
        )
    return _async_client


def get_sync_client() -> MongoClient:
    global _sync_client
    if _sync_client is None:
        logger.info("Connecting to MongoDB (sync) at %s", settings.MONGODB_URL)
        _sync_client = MongoClient(
            settings.MONGODB_URL,
            serverSelectionTimeoutMS=settings.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
        )
    return _sync_client


def get_async_database():
    return get_async_client()[settings.MONGODB_DATABASE]


def get_sync_database():
    return get_sync_client()[settings.MONGODB_DATABASE]


class DatabaseManager:
    """Utility helper to create Mongo collections and indexes."""

    def __init__(self):
        disable = not settings.MONGODB_URL or settings.MONGODB_URL.lower() in ("disabled", "none")
        if disable:
            logger.info("MongoDB disabled; skipping client initialization.")
            self.db = None
            return
        try:
            self.db = get_sync_database()
        except Exception as exc:  # pragma: no cover
            logger.warning("Skipping MongoDB connection (offline mode): %s", exc)
            self.db = None

    def create_collections(self) -> None:
        if not self.db:
            logger.info("MongoDB disabled; skipping collection setup.")
            return
        if "workflows" not in self.db.list_collection_names():
            self.db.create_collection("workflows")
            self.db.workflows.create_index("name")
            self.db.workflows.create_index("status")

        if "workflow_versions" not in self.db.list_collection_names():
            self.db.create_collection("workflow_versions")
            self.db.workflow_versions.create_index("workflow_id")
            self.db.workflow_versions.create_index("is_current")

        if "runs" not in self.db.list_collection_names():
            self.db.create_collection("runs")
            self.db.runs.create_index("workflow_version_id")
            self.db.runs.create_index("status")
            self.db.runs.create_index("started_at")

        if "run_steps" not in self.db.list_collection_names():
            self.db.create_collection("run_steps")
            self.db.run_steps.create_index("run_id")
            self.db.run_steps.create_index("node_id")

        if "schedules" not in self.db.list_collection_names():
            self.db.create_collection("schedules")
            self.db.schedules.create_index("workflow_id")
            self.db.schedules.create_index("enabled")

        logger.info("MongoDB collections ensured")

    def drop_collections(self) -> None:
        if not self.db:
            logger.info("MongoDB disabled; skipping collection drop.")
            return
        collections = [
            "workflows",
            "workflow_versions",
            "runs",
            "run_steps",
            "schedules",
        ]
        for name in collections:
            if name in self.db.list_collection_names():
                self.db.drop_collection(name)
        logger.info("MongoDB collections dropped")

    def get_collection(self, name: str):
        if not self.db:
            raise RuntimeError("MongoDB disabled; no collections available.")
        return self.db[name]


_schema_lock = threading.Lock()
_schema_initialized = False


def ensure_sql_schema() -> None:
    """Ensure the SQLite schema exists before running ORM queries."""
    global _schema_initialized
    if _schema_initialized:
        return

    with _schema_lock:
        if _schema_initialized:
            return

        model_modules = [
            "models.device",
            "models.device_log",
            "models.flow",
            "models.flow_module",
            "models.execution",
            "models.execution_device",
            "models.execution_step",
            "models.report",
            "models.module_run",
            "models.workflow_models",
            "models.user_preference",
        ]

        for module_path in model_modules:
            try:
                importlib.import_module(module_path)
            except ModuleNotFoundError:
                importlib.import_module(f"src.backend.{module_path}")

        try:
            from models.base import Base  # type: ignore
        except ModuleNotFoundError:  # pragma: no cover - fallback for packaged runs
            from src.backend.models.base import Base  # type: ignore

        Base.metadata.create_all(bind=engine)
        _schema_initialized = True


db_manager = DatabaseManager()
