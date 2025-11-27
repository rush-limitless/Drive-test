"""Composite voice call validation routines."""

from __future__ import annotations

from typing import Any, Dict, Optional

from .telco_modules import TelcoModules


def perform_call_tests(
    device_id: Optional[str] = None,
    number: Optional[str] = None,
    calls: int = 1,
    interval_sec: int = 10,
    **extra: Any,
) -> Dict[str, Any]:
    if not number:
        raise ValueError("Parameter 'number' is required")
    if calls <= 0:
        raise ValueError("Parameter 'calls' must be greater than zero")
    
    talk_window = extra.get('duration') or extra.get('call_duration') or interval_sec
    ring_timeout = extra.get('ring_timeout') or max(int(talk_window), 45)
    voicemail_timeout = extra.get('voicemail_timeout') or 40

    executor = TelcoModules(device_id)
    raw = executor.call_test(
        number,
        calls,
        talk_duration=int(talk_window),
        ring_timeout=int(ring_timeout),
        voicemail_timeout=int(voicemail_timeout),
    )

    durations = [step.get('duration', 0) for step in raw.get('results', []) if step.get('duration')]
    avg_duration = sum(durations) / len(durations) if durations else 0.0
    successful = raw.get('successful_calls', 0)
    total = raw.get('total_calls', calls)
    dropped = max(total - successful, 0)
    success_rate = successful / total if total else 0.0

    enriched = {
        **raw,
        'module': 'call_test',
        'success': successful > 0,
        'success_rate': success_rate,
        'cst_seconds_avg': avg_duration,
        'dropped_count': dropped,
        'retry_interval_sec': interval_sec,
    }
    return enriched
