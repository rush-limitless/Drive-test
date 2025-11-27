# Specification — Backend API & Resilience Framework

**Spec ID**: `004-backend-api-resilience`  
**Maintainer**: Backend Platform Team  
**Last Updated**: 2025-11-04  
**Status**: Draft  

---

## 1. Background & Context

The Telco Automation platform exposes REST + WebSocket endpoints consumed by both the Electron desktop shell and the web client. Once the desktop app reaches production environments, backend reliability becomes a single point of failure: malformed responses, CORS misconfiguration, or unstable WebSocket sessions break the entire control tower.

This specification formalises the API contract and the resilience expectations so that any future work (e.g., adding new modules, packaging, or CI checks) has a well-defined backend foundation.

---

## 2. Problem Statement

Current backend behaviour is loosely defined and mostly driven by ad-hoc manual testing. Observed issues include:

- REST responses returning inconsistent shapes or HTTP codes, forcing frontend guards.
- WebSocket connections closing silently under load or when ADB restarts.
- Lack of automated contract tests, making regressions hard to detect.
- Missing resilience tactics (timeouts, retries, health endpoints) to recover from ADB or Mongo outages.

We need to guarantee predictable, versioned contracts and a recovery strategy so that the frontend stays functional and operations teams trust the system.

---

## 3. Goals & Non Goals

### Goals
- Document the REST and WebSocket contracts (HTTP codes, payload schema, error envelope).
- Define resilience patterns: retry/backoff strategy, heartbeat/health checks, logging requirements.
- Provide automated contract + integration tests executed via CI.
- Introduce versioning and deprecation policy for API changes.

### Non Goals
- Redesigning business logic of device management or execution scheduling.
- Building a full HA deployment (handled by future infrastructure specs).
- Switching database technology (remains FastAPI + SQLAlchemy + Mongo primaries).

---

## 4. Stakeholders

| Role | Responsibilities | Contact |
|------|------------------|---------|
| Backend Tech Lead | Implements resilience features, owns API contract | backend-lead@example.com |
| QA Lead | Designs automated contract tests | qa-lead@example.com |
| Electron Maintainer | Consumes new contracts, ensures compatibility | desktop-team@example.com |
| Spec Champion | Maintains documentation & ensures SDD compliance | spec-champion@example.com |

---

## 5. Personas & User Stories

### Persona: Backend Maintainer
Needs a single source of truth for API shapes, error handling, and test coverage.

### User Story 1 — Contract Reliability
**As** a frontend developer  
**I want** stable REST payloads and status codes  
**So that** I can update the UI without shipping defensive fixes.

### User Story 2 — Resilient WebSocket Updates
**As** an operator monitoring executions  
**I want** WebSocket feeds to reconnect automatically and resume updates  
**So that** transient interruptions do not hide device status changes.

### User Story 3 — Testable API Contracts
**As** a QA engineer  
**I want** automated tests that validate the contract and resilience behaviour  
**So that** regressions are caught before deployment.

---

## 6. Functional Requirements

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-101 | Define schema for `/api/v1/devices`, `/api/v1/executions`, `/api/v1/ws/*` with examples & error envelopes. | Use OpenAPI + JSON Schema. |
| FR-102 | Standardise error handling: HTTP errors return `{"error": {"code": "...", "message": "...", "details": {...}}}`. | Applies to all endpoints. |
| FR-103 | Implement heartbeat endpoint `/health/full` with ADB + DB checks. | Must return within 2s. |
| FR-104 | WebSocket manager sends heartbeat/ping every 30s; clients auto-reconnect with exponential backoff (max 5 min). | Document client expectations. |
| FR-105 | Retry strategy for ADB operations with circuit breaker when devices misbehave. | Breaker resets after configurable cooldown. |

---

## 7. Non-Functional Requirements

- **Latency**: 95th percentile REST response < 500 ms under nominal load (10 devices, 5 parallel executions).
- **Availability**: No more than 1% failed WebSocket reconnections during backend restarts.
- **Security**: CORS policy documented, optional token auth for future spec (scope: design placeholder).
- **Observability**: Structured logs for each API call and WS reconnect event.

---

## 8. Acceptance Criteria

| Scenario | Given | When | Then | Verification |
|----------|-------|------|------|--------------|
| AC-101 | Backend running with devices connected | `/api/v1/devices` is called | Returns 200 with schema `DeviceList` | Pytest contract test |
| AC-102 | Execution not found | `/api/v1/executions/{id}` called with invalid id | Returns 404 with error envelope | Pytest contract test |
| AC-103 | WebSocket connection drops | Backend restarts while client listens | Client reconnects, receives new updates | Integration test via Playwright / WS harness |
| AC-104 | ADB command fails 3 times | Retry logic executed | Circuit breaker trips, error logged, client receives graceful error | Unit + integration tests |
| AC-105 | `npm run spec:check` executed | Spec folder present | Command succeeds | Already integrated |

---

## 9. Rollout Plan

1. Produce OpenAPI schema updates & documentation.
2. Implement error envelope + CORS + heartbeat.
3. Add WS heartbeat + reconnection handling.
4. Build Pytest suite for REST contracts + WS integration harness.
5. Document versioning policy and release notes.
6. Promote spec to In Review after CI green and QA signoff.

---

## 10. Open Questions

- Should we adopt JWT or rely on API keys for auth? (postponed)
- Do we need rate limiting for device scans? (to evaluate with QA)
- Where to store circuit breaker state (in-memory vs Redis)? (initially in-memory)

---

## 11. Appendix

- Templates leveraged: `templates/spec-template.md`.
- Related specs: `003-electron-desktop-stability`.

