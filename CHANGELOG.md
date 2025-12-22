# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
