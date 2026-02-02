"""Unit tests for the enhanced Device API device manager."""
import os
from types import SimpleNamespace
import pathlib
import sys

import pytest


# Ensure the backend package is importable when running from project root
BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.append(str(BACKEND_ROOT))

os.environ.setdefault("SPECIFY_ADB_EXECUTABLE", "adb")
from api.devices_legacy import DeviceManager, ADB_EXECUTABLE  # noqa: E402


def _make_result(stdout: str = "", returncode: int = 0, stderr: str = ""):
    """Helper to create a subprocess.CompletedProcess-like result."""
    return SimpleNamespace(stdout=stdout, returncode=returncode, stderr=stderr)


@pytest.mark.asyncio
async def test_get_devices_returns_enriched_device(monkeypatch):
    """get_devices should return a fully populated device entry when ADB succeeds."""
    manager = DeviceManager()
    device_id = "ABC123"

    responses = {
        (ADB_EXECUTABLE, "devices"): _make_result(
            "List of devices attached\nABC123\tdevice\n"
        ),
        (ADB_EXECUTABLE, "-s", device_id, "shell", "getprop", "ro.product.model"): _make_result(
            "Pixel 7\n"
        ),
        (
            ADB_EXECUTABLE,
            "-s",
            device_id,
            "shell",
            "getprop",
            "ro.build.version.release",
        ): _make_result("14\n"),
        (ADB_EXECUTABLE, "-s", device_id, "shell", "getprop", "ro.product.brand"): _make_result(
            "google\n"
        ),
        (ADB_EXECUTABLE, "-s", device_id, "shell", "getprop", "ro.product.marketname"): _make_result(
            "Pixel 7\n"
        ),
        (ADB_EXECUTABLE, "-s", device_id, "shell", "getprop", "ro.product.model.display"): _make_result(
            ""
        ),
        (ADB_EXECUTABLE, "-s", device_id, "shell", "getprop", "ro.product.name"): _make_result(
            ""
        ),
        (
            ADB_EXECUTABLE,
            "-s",
            device_id,
            "shell",
            "getprop",
            "ro.config.marketing_name",
        ): _make_result(""),
        (ADB_EXECUTABLE, "-s", device_id, "shell", "getprop", "ro.product.device"): _make_result(
            ""
        ),
        (ADB_EXECUTABLE, "-s", device_id, "shell", "dumpsys", "battery"): _make_result(
            "level: 79\nstatus: 2\n"
        ),
        (ADB_EXECUTABLE, "-s", device_id, "shell", "getprop", "gsm.operator.alpha"): _make_result(
            "Test Operator\n"
        ),
    }

    def fake_run(cmd, capture_output=True, text=True, timeout=None):
        key = tuple(cmd)
        return responses.get(key, _make_result())

    monkeypatch.setattr("api.devices_legacy.subprocess.run", fake_run)

    devices = await manager.get_devices()

    assert len(devices) == 1
    device = devices[0]
    assert device["id"] == device_id
    assert device["name"] == "Google Pixel 7"
    assert device["model"] == "Pixel 7"
    assert device["android_version"] == "14"
    assert device["battery_level"] == "79%"
    assert device["network_operator"] == "Test Operator"


@pytest.mark.asyncio
async def test_disconnect_device_handles_failure(monkeypatch):
    """disconnect_device should surface failure details when adb disconnect fails."""
    manager = DeviceManager()

    def fake_run(cmd, capture_output=True, text=True, timeout=None):
        return _make_result(returncode=1, stderr="failed to disconnect")

    monkeypatch.setattr("api.devices_legacy.subprocess.run", fake_run)

    result = await manager.disconnect_device("ABC123")

    assert result["success"] is False
    assert "failed" in result["message"]
