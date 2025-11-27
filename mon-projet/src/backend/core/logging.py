"""Logging configuration for the application."""

import logging
import logging.handlers
import os
from datetime import datetime, timezone
from typing import Optional

from .config import settings


class StructuredFormatter(logging.Formatter):
    """Custom formatter for structured logging."""
    
    def format(self, record):
        # Add timestamp and structured fields
        record.timestamp = datetime.now(timezone.utc).isoformat()
        record.service = "telco-adb-automation"
        
        # Add execution context if available
        if hasattr(record, 'execution_id'):
            record.execution_context = f"[{record.execution_id}]"
        else:
            record.execution_context = ""
            
        if hasattr(record, 'device_id'):
            record.device_context = f"[{record.device_id}]"
        else:
            record.device_context = ""
            
        return super().format(record)


def setup_logging():
    """Configure application logging."""
    # Ensure logs directory exists
    os.makedirs(settings.LOGS_DIR, exist_ok=True)
    
    # Root logger configuration
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper()))
    
    # Clear existing handlers
    root_logger.handlers.clear()
    
    # Console handler (follow configured LOG_LEVEL so DEBUG is visible when requested)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(getattr(logging, settings.LOG_LEVEL.upper()))
    console_formatter = StructuredFormatter(
        '%(asctime)s - %(name)s - %(levelname)s %(execution_context)s%(device_context)s - %(message)s'
    )
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)
    
    # File handler for all logs
    file_handler = logging.handlers.RotatingFileHandler(
        filename=os.path.join(settings.LOGS_DIR, 'telco-automation.log'),
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5
    )
    file_handler.setLevel(logging.DEBUG)
    file_formatter = StructuredFormatter(
        '%(timestamp)s - %(service)s - %(name)s - %(levelname)s %(execution_context)s%(device_context)s - %(message)s'
    )
    file_handler.setFormatter(file_formatter)
    root_logger.addHandler(file_handler)
    
    # Execution logs handler (separate file for execution-specific logs)
    execution_handler = logging.handlers.RotatingFileHandler(
        filename=os.path.join(settings.LOGS_DIR, 'executions.log'),
        maxBytes=50 * 1024 * 1024,  # 50MB
        backupCount=10
    )
    execution_handler.setLevel(logging.INFO)
    execution_handler.addFilter(ExecutionLogFilter())
    execution_handler.setFormatter(file_formatter)
    root_logger.addHandler(execution_handler)
    
    # Error logs handler
    error_handler = logging.handlers.RotatingFileHandler(
        filename=os.path.join(settings.LOGS_DIR, 'errors.log'),
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(file_formatter)
    root_logger.addHandler(error_handler)
    
    # Suppress noisy third-party loggers
    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    
    logging.info("Logging configuration initialized")


class ExecutionLogFilter(logging.Filter):
    """Filter to capture only execution-related logs."""
    
    def filter(self, record):
        return hasattr(record, 'execution_id') or 'execution' in record.name.lower()


class ExecutionLogger:
    """Logger for execution-specific events with context."""
    
    def __init__(self, execution_id: str, device_id: Optional[str] = None):
        self.execution_id = execution_id
        self.device_id = device_id
        self.logger = logging.getLogger(f"execution.{execution_id}")
        
    def _add_context(self, extra: dict = None) -> dict:
        """Add execution context to log record."""
        context = {
            'execution_id': self.execution_id,
        }
        if self.device_id:
            context['device_id'] = self.device_id
        if extra:
            context.update(extra)
        return context
        
    def info(self, message: str, **kwargs):
        """Log info message with execution context."""
        self.logger.info(message, extra=self._add_context(kwargs))
        
    def warning(self, message: str, **kwargs):
        """Log warning message with execution context."""
        self.logger.warning(message, extra=self._add_context(kwargs))
        
    def error(self, message: str, **kwargs):
        """Log error message with execution context."""
        self.logger.error(message, extra=self._add_context(kwargs))
        
    def debug(self, message: str, **kwargs):
        """Log debug message with execution context."""
        self.logger.debug(message, extra=self._add_context(kwargs))
        
    def step_started(self, step_name: str, step_index: int):
        """Log step start."""
        self.info(f"Step {step_index + 1} started: {step_name}")
        
    def step_completed(self, step_name: str, step_index: int, duration: float):
        """Log step completion."""
        self.info(f"Step {step_index + 1} completed: {step_name} (took {duration:.2f}s)")
        
    def step_failed(self, step_name: str, step_index: int, error: str):
        """Log step failure."""
        self.error(f"Step {step_index + 1} failed: {step_name} - {error}")
        
    def adb_command(self, command: str, stdout: str = "", stderr: str = ""):
        """Log ADB command execution."""
        self.debug(f"ADB command: {command}")
        if stdout:
            self.debug(f"ADB stdout: {stdout[:500]}...")  # Truncate long output
        if stderr:
            self.warning(f"ADB stderr: {stderr}")


def get_execution_logger(execution_id: str, device_id: Optional[str] = None) -> ExecutionLogger:
    """Get execution logger with context."""
    return ExecutionLogger(execution_id, device_id)
