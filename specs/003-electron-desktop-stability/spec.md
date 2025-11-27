# Specification — Electron Desktop Stability & Real-Time Dashboard UX

**Spec ID**: `003-electron-desktop-stability`  
**Maintainer**: Telco Automation Platform Team  
**Last Updated**: 2025-11-04  
**Status**: Draft ➜ to be promoted to *In Review* once pilot build passes acceptance tests.

---

## 1. Background & Context

The Telco Automation desktop app was migrated to an Electron shell to embed the React control centre beside the Python (FastAPI/Uvicorn) backend. Recent QA sessions surfaced repeated stability issues:

- The renderer intermittently displayed a blank/black screen after launch.
- WebSocket reconnect loops and CORS errors made the dashboard unusable once the backend restarted.
- GPU related freezes prevented operators from monitoring executions.

The goal of this specification is to formalise the expected behaviour of the Electron delivery, define clear acceptance tests, and ensure every regression goes through Spec‑Driven Development (SDD) artefacts before implementation.

---

## 2. Problem Statement

Operators need a reliable desktop experience that mirrors the web dashboard, exposes real-time execution telemetry, and survives backend/device volatility. Failures in the renderer or the WebSocket layer instantly halt field operations.

Requirements derived from support tickets:

1. The Electron window must reach a fully interactive dashboard within 10 seconds after launch on a standard QA workstation.
2. The renderer must recover automatically from backend restarts without manual refresh.
3. Device/WebSocket updates must remain visible (no silent failure) when multiple devices connect/disconnect.

---

## 3. Goals & Non Goals

### Goals
- Provide deterministic launch behaviour for the Electron shell (no blank window, no GPU deadlock).
- Ensure the dashboard uses the backend URL supplied by Electron (no defaulting to dev server).
- Surface spec-driven health checks during CI (spec files validated, scenarios mapped to automated regression tests).

### Non Goals
- Replacing the existing React dashboard visual design.
- Introducing a full offline mode.
- Automating Field QA deployment packaging (tracked separately under spec `004-desktop-packaging`).

---

## 4. Stakeholders

| Role | Responsibilities | Contact |
|------|------------------|---------|
| QA Lead | validates acceptance criteria, regression owner | qa-lead@example.com |
| Electron Maintainer | owns Electron main/preload changes & build pipeline | desktop-team@example.com |
| Backend Maintainer | ensures FastAPI emits durable WebSocket events & CORS policy | backend-team@example.com |
| Spec Champion | keeps spec artefacts up to date, facilitates SDD cadence | spec-champion@example.com |

---

## 5. Personas & User Stories

### Persona: Telco Automation Operator
- Needs to monitor multi-device executions in a lab.
- Relies on the desktop build where USB access & ADB scripts are local.

### User Story 1 — Stable Launch
**As** an operator  
**I want** the Electron build to open the dashboard consistently without requiring dev tools  
**So that** I can start device scans immediately.

### User Story 2 — Resilient Telemetry
**As** an operator  
**I want** execution progress, device status, and log feeds to keep updating even when the backend restarts  
**So that** I do not lose context during lengthy campaigns.

### User Story 3 — Spec Visibility
**As** a maintainer  
**I want** CI to fail when a spec or its derived tasks are missing mandatory sections  
**So that** changes stay anchored to written specifications.

---

## 6. Functional Requirements

| ID | Requirement | Source |
|----|-------------|--------|
| FR-001 | Electron must disable GPU acceleration on Windows when the renderer fails health check. | Incident TCK-412 |
| FR-002 | `backendUrl` in React must always originate from `electronAPI.getBackendUrl()` before any REST/XHR call is fired. | QA Session 2025-10 |
| FR-003 | WebSocket service stores pending device subscriptions and replays them when the connection opens; no device should miss status updates. | QA Session 2025-10 |
| FR-004 | `scripts/spec/check_spec_alignment.py` validates every spec folder contains `spec.md`, `plan.md`, `tasks.md`, and required headings. | SDD Governance |
| FR-005 | CI job `npm run spec:check` (new) executes the spec validation script. | DevOps alignment |

---

## 7. Non-Functional Requirements

- **Performance**: Renderer interactive ≤ 10 seconds (cold start) on Windows 11 QA laptop (Intel i7, 16 GB RAM).
- **Reliability**: WS reconnection must succeed within 5 seconds after backend restart.
- **Observability**: Electron main process logs WebSocket subscription events and renderer failures to STDOUT.
- **Documentation**: README updated with Spec Kit workflow including command list.

---

## 8. Acceptance Criteria

| Scenario | Given | When | Then | Test Notes |
|----------|-------|------|------|-----------|
| AC-01 Stable dashboard launch | Fresh Electron build | App is launched | Dashboard renders with device list & execution summary within 10 s | Manual smoke + automated `npm run electron:test-launch` (future) |
| AC-02 WS recovery | Running dashboard & backend | Backend process restarts | Dashboard reconnects WS, device counts resume, no blank screen | QA regression |
| AC-03 Spec validation | Repo cloned | `npm run spec:check` executes | Command exits 0, prints validated specs | New spec script |
| AC-04 Spec enforcement | Missing mandatory heading in spec | `npm run spec:check` executes | Command exits non-zero, lists offending spec file | Verified in CI |

---

## 9. Rollout Plan

1. Implement code changes (GPU guard, WS queue, backend CORS, backendURL gating).
2. Add spec governance script & npm command.
3. Update README with SDD workflow and reference spec ID `003`.
4. QA regression run on desktop lab.
5. Promote spec status to *In Review* once acceptance tests pass; merge spec folder.

---

## 10. Open Questions

- Should we vendor a lightweight smoke-test harness for Electron launch? (Not in current scope.)
- Do we want to enforce spec validation via Git hook or rely on CI? (Pending DevOps decision.)
- Are other specs affected by new pipeline command? (Need to update maintainers.)

---

## 11. Appendix

- Template derived from `templates/spec-template.md`.
- Related specs: `001-advanced-telco-automation`, `002-advanced-workflows`.

