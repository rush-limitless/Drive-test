# Tasks — Spec 006 Reporting & Analytics

## Data & Backend
- [ ] Model additions for storing aggregated metrics/historical data.
- [x] Implement aggregation queries & API endpoints (`/api/v1/reports/...`).
- [ ] Add retention/cleanup job with configurable retention period.

## Frontend & UX
- [x] Implement initial KPI summary view consuming `/reports/summary`.
- [ ] Build reporting dashboard UI (charts, KPIs, filter controls).
- [ ] Implement CSV export (and optional PDF) respecting filters.
- [ ] Provide textual summaries for accessibility.

## Testing & Docs
- [ ] Add contract tests for reporting endpoints.
- [ ] Add E2E tests for filtering/export if feasible.
- [ ] Update documentation (README, docs site) describing reporting features.

## Governance
- [ ] Link commits/PRs to spec `006`.
- [ ] Run `npm run spec:check` before merge.
- [ ] Promote spec to *In Review* after acceptance tests pass.
