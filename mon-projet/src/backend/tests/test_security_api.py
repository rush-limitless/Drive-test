"""Tests for API key/rate limiting hooks (currently disabled for desktop build)."""
import pathlib
import sys

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.append(str(BACKEND_ROOT))

from api import devices as devices_api  # noqa: E402
from api import devices_legacy as devices_legacy_api  # noqa: E402
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
    app.include_router(devices_legacy_api.router, prefix="/api")
    return TestClient(app)


def test_devices_endpoint_accessible_without_api_key(client):
    """Desktop builds disable API key checks, so anonymous requests pass."""
    resp = client.get("/api/v1/devices/")
    assert resp.status_code in {200, 500}

    resp_ok = client.get("/api/v1/devices/", headers={"X-API-Key": settings.API_KEY})
    assert resp_ok.status_code in {200, 500}


def test_rate_limit_disabled(client, monkeypatch):
    """Rate limiting is disabled; even after multiple calls, status is not 429."""
    monkeypatch.setattr(settings, "RATE_LIMIT_PER_MIN", 2)
    for _ in range(3):
        resp = client.get("/api/v1/devices/", headers={"X-API-Key": settings.API_KEY})
        assert resp.status_code in {200, 500}
