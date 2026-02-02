RELEASE NOTES - MOBIQ v2.3.9
Date: 02 February 2026
Type: Full build (Electron + Backend + ADB included)

Summary
This build consolidates workflows, fixes key modules (APN, Smart App Launcher, RF logging), improves device management, and keeps versioning consistent across app, installer, and dashboard with automatic update on each build.

Major updates
1) Unified automatic versioning
- App, installer, and dashboard versions are synchronized.
- Each build increments and propagates the version across frontend, backend, Electron, and installer metadata.

2) Workflows - Export / Import
- Export created workflows.
- Import workflows on another PC.

3) Consistent editing in Edit Workflow
- All editable modules in Modules are also editable in Edit Workflow.
- Values stay synchronized between create and edit.

4) RF Logging - Stop/Restart
- Ability to stop or restart long actions (ex: Start RF Logging).
- Backend endpoints added for cancellation.

5) More visible notifications
- Stronger visuals and longer display.

Detailed fixes
Modules and execution
- Dial USSD Code
  - Value is preserved inside workflows.
  - Editable in Edit Workflow.
  - Strict validation: digits plus * and # only.
- Waiting Time
  - Negative values fixed in edit mode.
  - Input values are respected.
- Smart App Launcher
  - Workflow duration respected (no fallback to default).
  - Chrome launch more reliable (fallback if needed).
- Change APN
  - Fixed second execution going to the wrong screen.
  - Improved multi-device robustness.

Workflows and UI
- Removed the All tags filter in workflows menu.
- Export/Import added in workflows menu.

Device Manager
- Refresh / Add Device fixed.
- Disconnected devices are disabled (not clickable).
- Cleaned inconsistent action states.

Backend / API
- RF logging cancellation route added.
- Workflow module execution aligned with defined parameters.
- Backend import more robust when PYTHONPATH is missing (prevents ModuleNotFoundError: src).

Stability and build
- ADB included and verified inside the installer.
- Build pipeline reliability improved.

Tests executed
- Frontend: vitest run
- Electron: vitest run
- Backend: pytest
Result: OK (all tests pass)

Deliverables
- Windows installer: MOBIQ-Setup-2.3.9.exe
- ADB included in installer

Known limitations
- PyInstaller warning about foreign Python environment (build still OK).
- Vite chunk size warnings.
- RF/log behavior can depend on device firmware.
