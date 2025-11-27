# Specification — Packaging & Distribution Pipeline

**Spec ID**: `007-packaging-distribution`  
**Maintainer**: Delivery & Release Team  
**Last Updated**: 2025-11-04  
**Status**: Draft  

---

## 1. Background & Context

The Telco Automation suite currently runs from source (Electron + FastAPI backend). For QA labs and customer pilots we need reproducible installers: Electron desktop app for Windows/macOS, packaged backend services (Python environment, MongoDB companion), and optional CLI utilities. Ad-hoc scripts exist but lack standardisation, making every deployment error-prone.

---

## 2. Problem Statement

Without a formal packaging process:
- QA cannot distribute the app easily across machines.
- Dependencies (ADB, Python, MongoDB) must be installed manually.
- No versioned artefacts or release notes accompany builds.
- CI/CD cannot produce builds automatically.

We must define packaging requirements, scripts, and validation steps for target platforms.

---

## 3. Goals & Non Goals

### Goals
- Produce reproducible desktop builds (Electron) for Windows and macOS.
- Package backend services (FastAPI + dependencies) and document setup (Mongo, env vars).
- Automate packaging via CI workflow.
- Provide smoke tests to validate build integrity.
- Generate release notes with spec references.

### Non Goals
- Full enterprise installer with auto-update channel (future work).
- Containerisation (covered by future DevOps spec).
- Support for Linux desktop (can be backlog).

---

## 4. Stakeholders

| Role | Responsibility | Contact |
|------|----------------|---------|
| Release Manager | Oversees release pipeline and signing | release@example.com |
| Desktop/Electron Lead | Maintains Electron packaging | desktop-team@example.com |
| Backend Lead | Packages Python backend & prerequisites | backend-team@example.com |
| QA Lead | Validates installers in staging | qa@example.com |

---

## 5. Personas & User Stories

### Persona: QA Deployment Engineer
Needs to install the stack quickly in lab machines without manual dependency juggling.

### Persona: Release Manager
Requires automated build artefacts for every tagged release along with checksums/release notes.

### User Story 1 — Desktop Installer
**As** a QA engineer  
**I want** a Windows installer that bundles Electron app and prerequisites  
**So that** I can install the dashboard on new machines rapidly.

### User Story 2 — Backend Bundle
**As** a backend maintainer  
**I want** a reproducible backend package (Python env + scripts)  
**So that** deployments are consistent between environments.

### User Story 3 — CI Packaging
**As** a release manager  
**I want** CI workflows to produce installers, run smoke tests, and publish artefacts  
**So that** releases are traceable and repeatable.

---

## 6. Functional Requirements

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-401 | Electron packaging using `electron-builder` for Windows (msi/exe) and macOS (dmg). | Windows priority; macOS optional initial. |
| FR-402 | Backend packaging script that creates a virtualenv, installs dependencies, and bundles startup scripts. | Possibly using PyInstaller/frozen env. |
| FR-403 | Include necessary runtime prerequisites (ADB, Mongo instructions). | Provide automated check or install instructions. |
| FR-404 | CI workflow job `package.yml` to build artefacts on tag creation. | Upload artefacts to GitHub Releases. |
| FR-405 | Smoke test script verifying launch success and API health. | Runs post-build in CI. |
| FR-406 | Generate release notes referencing spec IDs and changes. | Could use changelog automation. |

---

## 7. Non-Functional Requirements

- Packaging process must complete within 15 minutes in CI.
- Artefacts should include checksums (SHA256).
- Installers must log installation steps for troubleshooting.
- Documentation must detail system prerequisites and uninstall process.

---

## 8. Acceptance Criteria

| Scenario | Given | When | Then | Verification |
|----------|-------|------|------|--------------|
| AC-401 | Release tag created | CI packaging workflow runs | Electron installer + backend bundle produced | GitHub Actions |
| AC-402 | Installer executed on clean Windows VM | App installed | Electron app launches & connects backend | QA manual |
| AC-403 | Backend bundle deployed | Startup script run | FastAPI backend + Mongo integration works | QA manual/automated |
| AC-404 | Smoke test executed post-build | Artefacts produced | Test passes; otherwise pipeline fails | CI job |
| AC-405 | Release notes generation | Release published | Notes include spec references & artefact links | CI automation/manual verify |

---

## 9. Rollout Plan

1. Define packaging scripts (Electron builder config, backend bundler).
2. Create smoke tests for Electron launch + backend health.
3. Implement CI workflow (`.github/workflows/package.yml`).
4. Document installation guide and troubleshooting.
5. Perform QA validation on target platforms.
6. Promote spec to In Review after first successful release.

---

## 10. Open Questions

- Should we embed MongoDB or provide separate instructions?
- Do we need code signing certificates for Windows/macOS? (if yes, manage keys securely.)
- Is an auto-update mechanism needed in this phase?

---

## 11. Appendix

- Existing scripts: `build/simple-server.spec`, `build/build-exe.ps1`, Electron packaging script.
- Related specs: `003` (desktop stability), `004` (backend API resilience).

