"""Messaging validation helpers."""

from __future__ import annotations

from typing import Any, Dict, Optional

from .telco_modules import TelcoModules


def send_and_validate_sms(
    device_id: Optional[str] = None,
    recipient: Optional[str] = None,
    count: int = 1,
    message: Optional[str] = None,
    **_: Any,
) -> Dict[str, Any]:
    if not recipient:
        raise ValueError("Parameter 'recipient' is required")
    if count <= 0:
        raise ValueError("Parameter 'count' must be greater than zero")

    executor = TelcoModules(device_id)
    payload = executor.sms_test(recipient, count)

    successful = payload.get('successful_sms', 0)
    total = payload.get('total_sms', count)
    success_rate = successful / total if total else 0.0

    enriched = {
        **payload,
        'module': 'sms_test',
        'success': successful == total,
        'sent_count': total,
        'delivered_count': successful,
        'success_rate': success_rate,
        'latency_ms_avg': 0.0,  # Placeholder until telemetry exposed
        'message_template': message,
    }
    return enriched
