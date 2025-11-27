# Plan — 003 Electron Desktop Stability

| Phase | Milestone | Owner | Target |
|-------|-----------|-------|--------|
| P0 | Spec drafted & validated via `npm run spec:check` | Spec Champion | 2025-11-05 |
| P1 | Electron launch fixes merged (GPU guard, WS queue) | Desktop Team | 2025-11-07 |
| P2 | Backend CORS update deployed | Backend Team | 2025-11-07 |
| P3 | QA regression suite signed-off | QA Lead | 2025-11-08 |
| P4 | Spec promoted In Review & README updated | Spec Champion | 2025-11-09 |

## Work Breakdown

1. **Code hardening**
   - Disable GPU acceleration when launching Electron on Windows.
   - Ensure React waits for Electron-provided backend URL before issuing requests.
   - Queue WebSocket subscriptions and replay on reconnect.
   - Expand backend CORS policy (`allow_origins=["*"]`).

2. **Spec Governance Tooling**
   - Create `scripts/spec/check_spec_alignment.py`.
   - Add `npm run spec:check` command → executes the script via Python.
   - Document workflow in README.

3. **QA & Regression**
   - Manual smoke: device connection, execution progress, log streaming.
   - Backend restart scenario (ensure WS recovers).
   - Validate blank screen no longer reproducible with GPU disabled.

4. **SDD Alignment**
   - Link commits/PRs to spec ID `003`.
   - Run `npm run spec:check` in CI (follow-up PR to GitHub workflow).
   - Update `CHANGELOG` once spec is promoted.

