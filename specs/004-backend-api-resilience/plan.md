# Plan — Backend API & Resilience (Spec 004)

| Phase | Deliverable | Owner | Target |
|-------|-------------|-------|--------|
| P0 | Finalise API contract schema + error envelope design | Backend Lead | 2025-11-06 |
| P1 | Implement heartbeat endpoint & CORS review | Backend Team | 2025-11-07 |
| P2 | WebSocket heartbeat + auto-reconnect strategy | Backend Team | 2025-11-08 |
| P3 | Retry/circuit-breaker logic around ADB calls | Backend Team | 2025-11-09 |
| P4 | Contract tests (pytest) + WS integration harness | QA | 2025-11-10 |
| P5 | Documentation + release notes updated | Spec Champion | 2025-11-11 |

## Work Streams

1. **Contract Definition**
   - Extend `openapi.json` or FastAPI docs to reflect new schema.
   - Document payloads, status codes, error envelope fields.

2. **Resilience Features**
   - Implement heartbeat endpoint & ADB retry logic.
   - Add WS heartbeat, auto-reconnect hints, and structured logging.

3. **Testing**
   - Create pytest suite for REST endpoints using frozen fixtures.
   - Build integration harness for WebSocket reconnection scenarios.

4. **Governance**
   - Ensure spec references all commits/PRs.
   - Run `npm run spec:check` prior to merge.

