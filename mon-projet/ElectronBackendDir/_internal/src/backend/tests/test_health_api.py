"""Tests for ADB health endpoint with API key enforcement."""
import pathlib
import sys

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.append(str(BACKEND_ROOT))

from api import health as health_api  # noqa: E402
from core.config import settings  # noqa: E402


@pytest.fixture
def client(monkeypatch):
    settings.API_KEY = "test-key"
    app = FastAPI()
    app.include_router(health_api.router, prefix="/api/v1")
    return TestClient(app)


def test_health_requires_api_key(client):
    resp = client.get("/api/v1/health/adb")
    assert resp.status_code == 401


def test_health_ok_with_api_key(monkeypatch, client):
    def fake_run(cmd, capture_output=True, text=True, timeout=5):
        return type("Result", (), {"returncode": 0, "stdout": "List of devices attached\n", "stderr": ""})

    monkeypatch.setattr(health_api.subprocess, "run", fake_run)
    resp = client.get("/api/v1/health/adb", headers={"X-API-Key": settings.API_KEY})
    assert resp.status_code == 200
    assert resp.json().get("status") == "ok"
