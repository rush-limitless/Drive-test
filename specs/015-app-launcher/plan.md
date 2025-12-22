# Plan

## Implementation Plan: Smart App Launcher Module

**Branch**: `015-app-launcher` | **Date**: 2025-12-18 | **Spec**: ../015-app-launcher/spec.md
**Input**: Feature specification describing the editable module that launches Google or YouTube to generate data.

## Summary

Expose a device-required legacy module `launch_app` that sends the appropriate adb intent based on a configurable `app` parameter and duration. The feature touches the backend module execution path (`telco_modules`) plus the legacy catalog `modules.py`, and the React-based modules page for the editable UI that persists the selected target application and how long it stays open.

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript/React (frontend)
**Primary Dependencies**: FastAPI + TelcoModules helper for the legacy device modules, React/MUI for the dashboard UI
**Storage**: None beyond local UI state (no new database tables).
**Testing**: Manual verification through the modules UI and `npm run spec:check` to validate Spec Kit artifacts.
**Target Platform**: Windows/macOS/Linux desktops via the Telco automation stack.
**Project Type**: Web application (frontend + FastAPI backend).
**Performance Goals**: Keep module runtime under 60s and avoid blocking UI updates when an intent fails.
**Constraints**: Must rely on adb + intents; airgap scenarios require graceful failure messages.
**Scale/Scope**: Single module addition plus supporting UI (affects backend modules API and modules page).

## Constitution Check

Not applicable; no additional research phases required beyond this plan.

## Project Structure

### Documentation (this feature)

```text
specs/015-app-launcher/
|-- spec.md
|-- plan.md
# (tasks.md will reference this plan)
```

### Source Code (repository root)

```text
backend/
|-- src/
|   |-- backend/api/modules.py        # legacy module catalog + execution routing
|   |-- modules/telco_modules.py      # adb helpers
frontend/
|-- src/
|   |-- components/
|   |-- pages/TestModules.tsx         # modules dashboard UI
```

**Structure Decision**: The work spans three primary files: backend modules API/logic plus the legacy catalog definitions under `backend/api/modules.py` and the React modules page UI under `frontend/src/pages/TestModules.tsx` (plus the shared module catalog `frontend/src/data/modules.ts`).

## Complexity Tracking

No constitution violations anticipated; feature is an incremental module + UI improvement.
