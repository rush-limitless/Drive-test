"""Tests for API key and rate limiting on device endpoints."""
import pathlib
import sys

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.append(str(BACKEND_ROOT))

from api import devices as devices_api  # noqa: E402
from api import devices_v2 as devices_v2_api  # noqa: E402
from api.security import _rate_store  # noqa: E402
from core.config import settings  # noqa: E402


@pytest.fixture(autouse=True)
def reset_rate_store():
    _rate_store.clear()
    # ensure API_KEY is a valid non-default value for tests
    settings.API_KEY = "test-key"
    yield
    _rate_store.clear()


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(devices_api.router, prefix="/api/v1")
    app.include_router(devices_v2_api.router, prefix="/api")
    return TestClient(app)


def test_devices_requires_api_key(client):
    resp = client.get("/api/v1/devices/")
    assert resp.status_code == 401

    resp_ok = client.get("/api/v1/devices/", headers={"X-API-Key": settings.API_KEY})
    # downstream may 500 if adb absent; only check auth passed
    assert resp_ok.status_code != 401


def test_rate_limit_blocks_after_threshold(client, monkeypatch):
    # lower the limit for the test
    monkeypatch.setattr(settings, "RATE_LIMIT_PER_MIN", 2)
    for _ in range(2):
        client.get("/api/v1/devices/", headers={"X-API-Key": settings.API_KEY})
    resp_blocked = client.get("/api/v1/devices/", headers={"X-API-Key": settings.API_KEY})
    assert resp_blocked.status_code == 429
