# Specification — Reporting & Analytics Dashboard

**Spec ID**: `006-reporting-analytics`  
**Maintainer**: Reporting & Insights Team  
**Last Updated**: 2025-11-04  
**Status**: Draft  

---

## 1. Background & Context

Operators rely on historical analytics to understand device behaviour, test pass rates, and trends across campaigns. The current Telco Automation app exposes only raw execution lists, with limited export options and no aggregated metrics. To support certification, audits, and optimisation, we need a cohesive reporting layer.

---

## 2. Problem Statement

The absence of structured reporting creates several pain points:

- No KPIs (success rate, average execution time, failure categories) to help QA leads decide on remediation.
- Manual effort to export logs and compile spreadsheets after each campaign.
- Lack of filters or time range selection in the dashboard to narrow down data.
- Missing audit trail (no generated PDF/CSV reports, no retention policy).

We must formalise the reporting requirements, data schema, and presentation to ensure insights are always available.

---

## 3. Goals & Non Goals

### Goals
- Provide aggregated metrics and trend visualisations (success rate, failure breakdown, execution duration).
- Support export formats (CSV initially, optional PDF).
- Allow filtering by time range, device group, workflow, module.
- Define data retention strategy and storage requirements.
- Automate report generation and exposure via the UI.

### Non Goals
- Building a standalone BI warehouse (future spec).
- Implementing real-time streaming analytics (focus is scheduled/near real-time).
- High-security role-based access control (tracked separately).

---

## 4. Stakeholders

| Role | Responsibility | Contact |
|------|----------------|---------|
| QA Lead | Defines metrics & acceptance for reporting features | qa@example.com |
| Backend Lead | Implements aggregation queries & data retention | backend@example.com |
| Frontend Lead | Builds reporting UI & export workflows | frontend@example.com |
| Spec Champion | Coordinates SDD execution | spec-champion@example.com |

---

## 5. Personas & User Stories

### Persona: QA Manager
Needs aggregated KPIs, the ability to filter by device or time, and export for stakeholders.

### Persona: Operator
Wants quick access to recent failures and execution history when troubleshooting.

### User Story 1 — KPI Dashboard
**As** a QA manager  
**I want** a dashboard showing success rate, failure reasons, average duration  
**So that** I can monitor quality trends at a glance.

### User Story 2 — Historical Filtering & Export
**As** an operator  
**I want** to filter executions by date range and download a CSV  
**So that** I can share results with the wider organisation.

### User Story 3 — Audit & Retention
**As** a compliance officer  
**I want** reports to be retained for a defined period with metadata  
**So that** I can audit past campaigns if needed.

---

## 6. Functional Requirements

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-301 | Provide metrics: overall success rate, failures by module, avg execution time, device coverage. | Should refresh at least daily or on demand. |
| FR-302 | Implement filtering (date range, device ID/group, workflow ID, module). | Applies to KPI cards & execution tables. |
| FR-303 | CSV export for filtered dataset. | Use RFC 4180 compliant CSV. |
| FR-304 | Optional PDF export with summary (if time allows). | Use templated generation. |
| FR-305 | Document retention policy (default 90 days) and cleanup job. | Configurable via settings. |
| FR-306 | Provide API endpoints for aggregated data (`/api/v1/reports/...`). | Connects to Spec 004 for contract definition. |
| FR-307 | UI reporting page with charts/tables. | Consider using charting library if available. |

---

## 7. Non-Functional Requirements

- Aggregation queries must complete within 2 seconds for up to 10k executions.
- Exports limited to 50k rows; warn user otherwise.
- Scheduling/caching strategy documented (e.g., nightly job vs on-demand).
- Accessibility: charts accompanied with textual summary for screen readers.

---

## 8. Acceptance Criteria

| Scenario | Given | When | Then | Verification |
|----------|-------|------|------|--------------|
| AC-301 | Executions exist in DB | KPI endpoint called | Returns metrics with defined schema | Contract test |
| AC-302 | User selects date filter | Dashboard reloads | Only matching executions/metrics displayed | Frontend test |
| AC-303 | CSV export triggered | Filter applied | File downloaded with matching rows | E2E/manual test |
| AC-304 | Retention job runs | Records older than retention period | Records archived/deleted; log entry emitted | Scheduled job test |
| AC-305 | `npm run spec:check` executed | Spec folder complete | Command passes | Already integrated |

---

## 9. Rollout Plan

1. Define report data model (SQL + Mongo collections).
2. Implement aggregation queries & API endpoints.
3. Build UI dashboard (React) with charts, filters.
4. Implement CSV export (PDF optional).
5. Add retention job (cron or scheduled task).
6. Document usage & promote spec to In Review after QA signoff.

---

## 10. Open Questions

- Should we adopt a charting library already (e.g., Recharts, Chart.js)?
- Where to store generated reports (filesystem vs S3)? (initial local storage acceptable)
- Do we need user-specific access control? (out of scope now)

---

## 11. Appendix

- Existing assets: `src/frontend/src/components/Reports` (placeholder).
- Related specs: `004-backend-api-resilience` (API contract alignment).

