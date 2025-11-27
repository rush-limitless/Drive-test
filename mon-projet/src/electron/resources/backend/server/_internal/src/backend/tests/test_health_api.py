"""Tests for health endpoints (ADB + summary)."""
import pathlib
import sys

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.append(str(BACKEND_ROOT))

from api import health as health_api  # noqa: E402


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(health_api.router, prefix="/api/v1")
    return TestClient(app)


def test_health_summary_ok(monkeypatch, client):
    monkeypatch.setattr(health_api, "_check_adb", lambda: {"ok": True})
    monkeypatch.setattr(health_api, "_check_database", lambda: {"ok": True})

    resp = client.get("/api/v1/health/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "version" in data


def test_health_summary_degraded(monkeypatch, client):
    monkeypatch.setattr(health_api, "_check_adb", lambda: {"ok": False, "error": "not available"})
    monkeypatch.setattr(health_api, "_check_database", lambda: {"ok": True})
    resp = client.get("/api/v1/health/")
    assert resp.status_code == 200
    assert resp.json()["status"] == "degraded"


def test_health_adb_endpoint(monkeypatch, client):
    def fake_run(cmd, capture_output=True, text=True, timeout=5):
        return type("Result", (), {"returncode": 0, "stdout": "List of devices attached\n", "stderr": ""})

    monkeypatch.setattr(health_api.subprocess, "run", fake_run)
    resp = client.get("/api/v1/health/adb")
    assert resp.status_code == 200
    assert resp.json().get("status") == "ok"
