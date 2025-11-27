"""Lightweight network performance probes."""

from __future__ import annotations

from typing import Any, Dict, Optional

from .telco_modules import TelcoModules


def run_perf_suite(
    device_id: Optional[str] = None,
    server_ip: str = "8.8.8.8",
    port: int = 5201,
    duration_s: int = 10,
    repeats: int = 3,
    **_: Any,
) -> Dict[str, Any]:
    executor = TelcoModules(device_id)
    metrics = executor.network_perf(server_ip=server_ip, port=port, duration_s=duration_s, repeats=repeats)
    metrics['module'] = 'network_perf'
    return metrics
