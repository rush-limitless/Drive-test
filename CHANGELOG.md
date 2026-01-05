# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2026-01-05

### Added
- Release notes for v2.3.0 covering backend fixes and UI updates.
- Device selection "Clear" action on the Dashboard.

### Changed
- Device info refresh now respects SIM swaps and airplane mode.
- RF log pulling prioritizes `/sdcard/log/cp` and related RF folders.
- Device ordering stabilized by last seen for consistent execution order.
- Dashboard version label aligned with build/runtime version sources.
- WebSocket devices connection stabilized with heartbeat and ref counting.

### Removed
- Workflow templates button from the Workflows page.

## [0.1.0] - 2025-12-22

### Added
- GitHub Actions CI for backend tests, frontend build, and Electron build artifacts.
- Vite-based frontend build pipeline.
- Shared fetch retry/backoff utility for API calls.

### Changed
- Frontend API usage updated to Vite env conventions.
- Backend startup flow improved for Electron readiness.
- Device management and dashboard UI strings cleaned to English.

### Removed
- Legacy/react-scripts build usage for the frontend.
