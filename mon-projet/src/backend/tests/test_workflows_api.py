"""Lightweight tests for the workflows API router.

These tests isolate storage to a temp directory and stub out heavy executors
so we can validate routing logic without ADB access.
"""
import json
import pathlib
import sys
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.append(str(BACKEND_ROOT))

from api import workflows as wf


@pytest.fixture(autouse=True)
def isolate_workflows(tmp_path, monkeypatch):
    """Use temp files and a fresh in-memory DB for each test."""
    workflows_path = tmp_path / "workflows.json"
    schedules_path = tmp_path / "workflow_schedules.json"

    monkeypatch.setattr(wf, "WORKFLOW_STORAGE_PATH", workflows_path)
    monkeypatch.setattr(wf, "SCHEDULE_STORAGE_PATH", schedules_path)

    original_db = wf.workflows_db
    original_scheduler = wf.workflow_scheduler

    wf.workflow_scheduler = wf.WorkflowScheduler(schedules_path)
    wf.workflows_db = [
        {
            "id": "wf_001",
            "name": "Demo Workflow",
            "description": "smoke test workflow",
            "modules": [{"id": "ping"}, {"id": "activate_data"}],
            "steps_count": 2,
            "status": "active",
            "created_at": "2024-01-01T00:00:00Z",
            "last_run": None,
            "success_rate": 0,
            "total_runs": 0,
        }
    ]

    yield

    wf.workflow_scheduler.stop()
    wf.workflow_scheduler = original_scheduler
    wf.workflows_db = original_db


@pytest.fixture(autouse=True)
def stub_executors(monkeypatch):
    """Stub heavy module execution to avoid ADB and speed up tests."""

    def fake_execute(self, executor, module_name, params):
        return {"module": module_name, "success": True, "params": params}

    monkeypatch.setattr(wf.FlowExecutor, "execute_module", fake_execute)
    monkeypatch.setattr(wf.time, "sleep", lambda _seconds: None)


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(wf.router, prefix="/api/v1")
    return TestClient(app)


def test_create_workflow_persists_to_storage(client):
    payload = {
        "name": "Connectivity Check",
        "description": "validate connectivity modules",
        "modules": ["ping", "activate_data"],
    }

    resp = client.post("/api/v1/workflows", json=payload)
    assert resp.status_code == 200

    data = resp.json()
    assert data["id"] == "wf_002"
    assert data["steps_count"] == 2
    assert data["status"] == "draft"

    with wf.WORKFLOW_STORAGE_PATH.open(encoding="utf-8") as handle:
        stored = json.load(handle)
    assert len(stored) == 2
    assert any(entry["name"] == "Connectivity Check" for entry in stored)


def test_execute_workflow_runs_catalog_modules(client):
    # Ensure deterministic modules for this run
    wf.workflows_db = [
        {
            "id": "wf_001",
            "name": "Ping And Data",
            "description": "ping then activate data",
            "modules": [
                {"id": "ping", "parameters": {"target": "1.1.1.1"}},
                {"id": "activate_data"},
            ],
            "steps_count": 2,
            "status": "active",
            "created_at": "2024-01-01T00:00:00Z",
            "last_run": None,
            "success_rate": 0,
            "total_runs": 0,
        }
    ]

    resp = client.post(
        "/api/v1/workflows/wf_001/execute",
        json={"modules": [], "device_id": "dev-1"},
    )
    assert resp.status_code == 200

    body = resp.json()
    assert body["status"] == "completed"
    assert body["workflow_id"] == "wf_001"
    assert body["device_id"] == "dev-1"

    executed_modules = [step["module"] for step in body["results"]]
    assert executed_modules == ["ping", "activate_data"]
    assert body["execution_id"].startswith("exec_wf_001_")


def test_schedule_workflow_rejects_past_date(client):
    run_at = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    resp = client.post(
        "/api/v1/workflows/wf_001/schedule",
        json={"device_ids": ["dev-1"], "run_at": run_at},
    )
    assert resp.status_code == 400
    assert "future" in resp.json()["detail"].lower()
