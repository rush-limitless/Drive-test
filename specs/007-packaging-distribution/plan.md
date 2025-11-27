# Plan — Packaging & Distribution Pipeline (Spec 007)

| Phase | Deliverable | Owner | Target |
|-------|-------------|-------|--------|
| P0 | Packaging blueprint (Electron builder config + backend bundler plan) | Release Manager | 2025-11-06 |
| P1 | Electron packaging scripts & config | Desktop Team | 2025-11-08 |
| P2 | Backend bundle script (virtualenv / PyInstaller) | Backend Team | 2025-11-09 |
| P3 | Smoke tests (launcher, API health) | QA + Tooling | 2025-11-10 |
| P4 | CI workflow `package.yml` producing artefacts | DevOps | 2025-11-11 |
| P5 | Documentation & release notes automation | Spec Champion | 2025-11-12 |
| P6 | Validation on target OS (Win/macOS) | QA | 2025-11-13 |

## Work Streams

1. **Desktop Packaging**
   - Prepare `electron-builder` configuration.
   - Handle assets, icons, versioning, auto-updates (if postponed, document).
   - Create Windows installer (msi/exe); evaluate macOS dmg.

2. **Backend Packaging**
   - Script to build virtualenv + dependencies.
   - Optionally produce PyInstaller binary for backend.
   - Provide wrapper script for service start/stop.
   - Document prerequisites (ADB, Mongo).

3. **Automation & QA**
   - Create smoke test script verifying app launch and backend health.
   - Add GitHub Actions workflow to build artefacts and upload to Releases.
   - Generate checksums and release notes.
   - Validate installers on clean VMs.
