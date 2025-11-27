# Tasks — Spec 003 Electron Desktop Stability

## Engineering
- [x] Align backend URL acquisition with Electron preload (`window.electronAPI.getBackendUrl`).
- [x] Queue WebSocket device subscriptions until connection is open.
- [x] Disable GPU acceleration in Electron main process.
- [x] Expand backend CORS policy to allow desktop origin.
- [ ] Add automated smoke test harness for Electron launch (follow-up).

## Tooling & Docs
- [x] Add spec validation script (`scripts/spec/check_spec_alignment.py`).
- [x] Expose `npm run spec:check`.
- [x] Wire spec check into CI workflow (`.github/workflows/*`).
- [x] Document SDD workflow + new spec in README.

## QA
- [x] Manual verification: launch stability, device updates, backend restart.
- [ ] Regression suite automation for launch (future work).
