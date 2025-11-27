"""Network registration and radio diagnostics."""

from __future__ import annotations

from typing import Any, Dict, Optional

from .telco_modules import TelcoModules


def validate_registration_for_all_devices(
    device_id: Optional[str] = None,
    **_: Any,
) -> Dict[str, Any]:
    executor = TelcoModules(device_id)

    registration = executor.check_network_registration()
    signal = executor.check_signal_strength()
    ip_info = executor.check_ip()

    device_entry = {
        'device_id': device_id,
        'registration': registration.get('registration_info'),
        'signal': signal.get('signal_info'),
        'ip': {
            'ip_info': ip_info.get('ip_info'),
            'route_info': ip_info.get('route_info'),
        },
    }

    success = all(
        entry.get('success', False)
        for entry in (registration, signal, ip_info)
    )

    return {
        'module': 'network_check',
        'success': success,
        'registered_devices': [device_entry],
        'details': {
            'registration': registration,
            'signal': signal,
            'ip': ip_info,
        },
    }
