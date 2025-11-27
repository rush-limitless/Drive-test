"""Tests for device report PDF endpoint."""
import pathlib
import sys
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.append(str(BACKEND_ROOT))

from api import devices as devices_api  # noqa: E402
from core.config import settings  # noqa: E402


@pytest.fixture(autouse=True)
def stub_device_manager(monkeypatch):
    settings.API_KEY = "test-key"
    now = datetime.now(timezone.utc)

    class StubManager:
        async def get_device(self, device_id: str):
            if device_id != "dev-1":
                return None
            return {
                "id": device_id,
                "model": "Pixel 7",
                "network_operator": "TestOp",
                "network_technology": "LTE",
                "status": "connected",
            }

        async def get_device_logs(self, device_id: str, limit: int = 1000):
            return [
                {"created_at": (now - timedelta(hours=1)).isoformat(), "message": "Log 1"},
                {"created_at": (now - timedelta(days=2)).isoformat(), "message": "Old log"},
            ]

    monkeypatch.setattr(devices_api, "device_manager", StubManager())


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(devices_api.router, prefix="/api/v1")
    return TestClient(app)


def test_report_download_success(client):
    now = datetime.now(timezone.utc)
    start = (now - timedelta(hours=2)).isoformat()
    end = now.isoformat()
    resp = client.get(
        f"/api/v1/devices/dev-1/report?from_ts={start}&to_ts={end}",
        headers={"X-API-Key": settings.API_KEY},
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:4]  # not empty


def test_report_invalid_range_returns_400(client):
    start = "2099-01-01T00:00:00+00:00"
    end = "2000-01-01T00:00:00+00:00"
    resp = client.get(
        f"/api/v1/devices/dev-1/report?from_ts={quote(start)}&to_ts={quote(end)}",
        headers={"X-API-Key": settings.API_KEY},
    )
    assert resp.status_code == 400


def test_report_csv_success(client):
    now = datetime.now(timezone.utc)
    start = (now - timedelta(hours=2)).isoformat()
    end = now.isoformat()
    resp = client.get(
        f"/api/v1/devices/dev-1/report?from_ts={start}&to_ts={end}&format=csv",
        headers={"X-API-Key": settings.API_KEY},
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    assert b"timestamp,message" in resp.content
