"""Tests for RF/APN modules mapped in TelcoModules and FlowExecutor."""
import pytest

from src.backend.modules.telco_modules import TelcoModules, ADB_EXECUTABLE
from src.backend.modules.flow_executor import FlowExecutor
from src.backend.modules.adb_executor import ExecutionResult


@pytest.fixture
def telco(monkeypatch):
    tm = TelcoModules()

    def fake_execute(cmd, timeout=30):
        return ExecutionResult(success=True, output="ok", error="", duration=0.1)

    monkeypatch.setattr(tm, "execute_command", fake_execute)
    return tm


def test_start_rf_logging_records_attempts(telco):
    # make check command fail to force state_confirmed False
    def fake_execute(cmd, timeout=30):
        if "find" in cmd:
            return ExecutionResult(success=True, output="", error="", duration=0.1)
        if "ls" in cmd:
            return ExecutionResult(success=False, output="", error="no such file", duration=0.1)
        return ExecutionResult(success=True, output="ok", error="", duration=0.1)

    telco.execute_command = fake_execute  # type: ignore
    result = telco.start_rf_logging()
    assert result["module"] == "start_rf_logging"
    assert result["success"] is True
    assert result["state_confirmed"] is False
    assert len(result["attempts"]) >= 3
    assert "warning" in result


def test_flow_executor_routes_new_modules(monkeypatch):
    flow = FlowExecutor()
    executor = TelcoModules()

    monkeypatch.setattr(executor, "toggle_airplane_mode", lambda enabled: {"module": "toggle_airplane_mode", "state": enabled, "success": True})
    monkeypatch.setattr(executor, "start_rf_logging", lambda: {"module": "start_rf_logging", "success": True, "state_confirmed": True})
    monkeypatch.setattr(executor, "stop_rf_logging", lambda: {"module": "stop_rf_logging", "success": True, "state_confirmed": True})
    monkeypatch.setattr(executor, "test_data_connection", lambda target=None, duration_seconds=None, interval_seconds=None: {"module": "test_data_connection", "target": target, "success": True})
    monkeypatch.setattr(executor, "pull_rf_logs", lambda destination: {"module": "pull_rf_logs", "destination": destination, "success": True})

    res_toggle = flow.execute_module(executor, "toggle_airplane_mode", {"enabled": True})
    res_start = flow.execute_module(executor, "start_rf_logging", {})
    res_stop = flow.execute_module(executor, "stop_rf_logging", {})
    res_test = flow.execute_module(executor, "test_data_connection", {"target": "1.1.1.1", "duration": 5})
    res_pull = flow.execute_module(executor, "pull_rf_logs", {"destination": "/tmp/rf"})

    assert res_toggle["state"] is True
    assert res_start["module"] == "start_rf_logging"
    assert res_stop["module"] == "stop_rf_logging"
    assert res_test["target"] == "1.1.1.1"
    assert res_pull["destination"] == "/tmp/rf"


def test_change_apn_uses_selected_value_and_verifies(monkeypatch):
    tm = TelcoModules()
    commands = []

    def fake_execute(cmd, timeout=30):
        commands.append(cmd)
        if cmd[:5] == [ADB_EXECUTABLE, "shell", "settings", "get", "global"]:
            # Verification reads should return the APN value to confirm success.
            return ExecutionResult(success=True, output="mtnapn", error="", duration=0.1)
        return ExecutionResult(success=True, output="ok", error="", duration=0.1)

    # Avoid UI side effects while still allowing the path to run.
    monkeypatch.setattr(tm, "_apply_apn_via_settings_ui", lambda apn: True)
    monkeypatch.setattr(tm, "execute_command", fake_execute)

    result = tm.configure_wrong_apn("mtnapn", use_ui_flow=True)
    assert result["module"] == "wrong_apn_configuration"
    assert result["apn"] == "mtnapn"
    assert result["success"] is True
    assert result["state_confirmed"] is True

    # Ensure the APN was written to both settings keys.
    put_cmds = [
        cmd for cmd in commands
        if cmd[:5] == [ADB_EXECUTABLE, "shell", "settings", "put", "global"]
    ]
    assert any(cmd[5:] == ["tether_dun_apn", "mtnapn"] for cmd in put_cmds)
    assert any(cmd[5:] == ["preferred_apn", "mtnapn"] for cmd in put_cmds)
