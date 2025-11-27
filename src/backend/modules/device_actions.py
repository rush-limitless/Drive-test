"""Device-level automation helpers exposed through module entry points."""

from __future__ import annotations

from typing import Any, Dict, Optional

from .telco_modules import TelcoModules


def _executor(device_id: Optional[str] = None) -> TelcoModules:
    return TelcoModules(device_id)


def enable_airplane_mode(device_id: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    return _executor(device_id).enable_airplane_mode()


def disable_airplane_mode(device_id: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    return _executor(device_id).disable_airplane_mode()


def force_lte_only(device_id: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    result = _executor(device_id).force_network_type('lte')
    result['module'] = 'force_lte_only'
    return result


def force_3g_only(device_id: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    result = _executor(device_id).force_network_type('3g')
    result['module'] = 'force_3g_only'
    return result


def force_2g_only(device_id: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    result = _executor(device_id).force_network_type('2g')
    result['module'] = 'force_2g_only'
    return result


def enable_wifi(device_id: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    return _executor(device_id).enable_wifi()


def disable_wifi(device_id: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    return _executor(device_id).disable_wifi()


def enable_mobile_data(device_id: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    return _executor(device_id).enable_mobile_data()


def disable_mobile_data(device_id: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    return _executor(device_id).disable_mobile_data()


def check_signal_strength(device_id: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    return _executor(device_id).check_signal_strength()


def check_ip_info(device_id: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    result = _executor(device_id).check_ip()
    result['module'] = 'check_ip_info'
    return result


def initiate_call(device_id: Optional[str] = None, number: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    if not number:
        raise ValueError("Parameter 'number' is required")
    return _executor(device_id).initiate_call(number)


def reject_incoming_call(device_id: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    return _executor(device_id).reject_incoming_call()


def start_data_session(device_id: Optional[str] = None, url: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    return _executor(device_id).start_data_session(url or "http://www.google.com")


def stop_data_session(device_id: Optional[str] = None, package: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    return _executor(device_id).stop_data_session(package or "com.android.chrome")


def capture_screenshot(device_id: Optional[str] = None, filename: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    return _executor(device_id).capture_screenshot(filename)


def power_off_device(device_id: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    return _executor(device_id).power_off_device()


def wake_screen(device_id: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    return _executor(device_id).wake_screen()


def sleep_screen(device_id: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    return _executor(device_id).sleep_screen()


def install_app(
    device_id: Optional[str] = None,
    apk_path: Optional[str] = None,
    replace: Optional[bool] = True,
    **_: Any,
) -> Dict[str, Any]:
    if not apk_path:
        raise ValueError("Parameter 'apk_path' is required")
    return _executor(device_id).install_app(apk_path, replace=replace if replace is not None else True)


def uninstall_app(device_id: Optional[str] = None, package_name: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    if not package_name:
        raise ValueError("Parameter 'package_name' is required")
    return _executor(device_id).uninstall_app(package_name)


def force_close_app(device_id: Optional[str] = None, package_name: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    if not package_name:
        raise ValueError("Parameter 'package_name' is required")
    return _executor(device_id).force_close_app(package_name)


def send_sms(
    device_id: Optional[str] = None,
    number: Optional[str] = None,
    message: Optional[str] = None,
    **_: Any,
) -> Dict[str, Any]:
    if not number:
        raise ValueError("Parameter 'number' is required")
    if message is None:
        raise ValueError("Parameter 'message' is required")
    return _executor(device_id).send_sms(number, message)


def delete_sms(device_id: Optional[str] = None, **_: Any) -> Dict[str, Any]:
    return _executor(device_id).delete_sms()
