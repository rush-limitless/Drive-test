# Tasks — Spec 004 Backend API & Resilience

## Contract & Documentation
- [ ] Inventory existing endpoints and capture current payloads.
- [ ] Draft JSON schema + OpenAPI updates for `/api/v1/devices`, `/api/v1/executions`, `/api/v1/ws/*`.
- [ ] Document error envelope format and versioning policy.

## Implementation
- [ ] Implement heartbeat endpoint `/health/full` with ADB + DB probes.
- [ ] Standardise error responses and ensure CORS policy configured per spec.
- [ ] Add WebSocket heartbeat/ping and reconnection/backoff hints.
- [ ] Introduce retry + circuit-breaker logic around ADB operations.

## Testing & Tooling
- [ ] Add pytest contract tests covering success/error cases.
- [ ] Build integration test harness for WS reconnection (Playwright or python WS client).
- [ ] Update CI to execute new tests (see `pytest` jobs).

## Governance
- [ ] Link commits/PRs to spec ID `004`.
- [ ] Keep README / developer docs aligned with new contract.
- [ ] Promote spec to *In Review* once QA signoff obtained.
