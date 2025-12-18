"""Device action entry points used by Spec YAML modules.

This compatibility layer keeps Spec-driven module entry points stable
(`modules.device_actions:...`) while delegating to the TelcoModules
implementation that actually speaks ADB.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, Optional

# Ensure the project root (which contains the src/ package) is importable
_PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.append(str(_PROJECT_ROOT))

try:  # pragma: no cover - runtime import flexibility
    from src.backend.modules.telco_modules import TelcoModules  # type: ignore
except ImportError:  # pragma: no cover
    from backend.modules.telco_modules import TelcoModules  # type: ignore

__all__ = ["send_sms"]


def _executor(device_id: Optional[str] = None) -> TelcoModules:
    """Instantiate TelcoModules with optional device scoping."""
    return TelcoModules(device_id)


def send_sms(*, device_id: Optional[str] = None, recipient: str, message: str) -> Dict[str, Any]:
    """Send an SMS with a custom message to the provided recipient."""
    recipient_value = recipient.strip()
    message_value = message.strip()
    if not recipient_value:
        raise ValueError("recipient is required")
    if not message_value:
        raise ValueError("message is required")

    executor = _executor(device_id)
    return executor.send_sms(recipient_value, message_value)
