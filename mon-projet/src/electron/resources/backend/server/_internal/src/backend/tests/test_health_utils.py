from types import SimpleNamespace

from api import health


def test_resolve_adb_cli_prefers_configured(monkeypatch):
    monkeypatch.setattr(health.settings, "ADB_PATH", "/custom/adb")
    monkeypatch.setattr(health, "ADB_EXECUTABLE", "adb-default")

    assert health._resolve_adb_cli() == "/custom/adb"


def test_resolve_adb_cli_falls_back_to_default(monkeypatch):
    monkeypatch.setattr(health.settings, "ADB_PATH", "adb")
    monkeypatch.setattr(health, "ADB_EXECUTABLE", "adb-default")

    assert health._resolve_adb_cli() == "adb-default"


def test_check_adb_success(monkeypatch):
    def fake_run(*_args, **_kwargs):
        return SimpleNamespace(returncode=0, stdout="ok", stderr="")

    monkeypatch.setattr(health, "_resolve_adb_cli", lambda: "adb")
    monkeypatch.setattr(health.subprocess, "run", fake_run)

    payload = health._check_adb()

    assert payload["ok"] is True
    assert payload["stdout"] == "ok"
    assert payload["latency_ms"] >= 0


def test_check_adb_failure(monkeypatch):
    def fake_run(*_args, **_kwargs):
        return SimpleNamespace(returncode=1, stdout="", stderr="fail")

    monkeypatch.setattr(health, "_resolve_adb_cli", lambda: "adb")
    monkeypatch.setattr(health.subprocess, "run", fake_run)

    payload = health._check_adb()

    assert payload["ok"] is False
    assert payload["error"] == "fail"
