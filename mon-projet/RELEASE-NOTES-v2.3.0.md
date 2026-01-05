# MOBIQ v2.3.0 — Release Notes (Detailed)

Release date: 2026-01-05  
Installer: MOBIQ-Setup-2.3.0.exe

Summary
- Focused on stability, device accuracy, and long‑running module control.
- Improved RF log handling and operator/SIM detection reliability.
- UI/UX refinements for device selection, time display, and navigation.

## What’s New / Improvements

### Module Execution & Control
- **Stop/Cancellation support for active modules**  
  Long-running modules can now be cancelled reliably using server status IDs.  
  This fixes cases where STOP showed “missing status id” and did nothing.

- **Status endpoint responsiveness during legacy runs**  
  Legacy module executions are moved to a background thread so `/api/modules/status` remains responsive while modules are running.

- **Progress estimation for long modules**  
  Progress bars now show a percentage based on historical average duration and current elapsed time.

### RF Logging & Log Pull
- **RF log pull now targets CP/RF folders first**  
  Pull RF logs now prioritizes `/sdcard/log/cp` and RF/CP‑specific folders instead of the generic dumpstate folder.

- **Improved pull reporting**  
  The response now includes the exact pulled paths and partial success is treated as success when at least one folder is copied.

### Device Info Accuracy
- **SIM/operator refresh**  
  Device info refresh runs on every scan. SIM swap is now detected and reflected correctly (carrier name, MCC/MNC).

- **No‑SIM / airplane mode handling**  
  Operator and network technology are suppressed when SIM is absent or airplane mode is enabled.

- **Live operator checks protected**  
  Live operator queries are skipped when SIM is absent or airplane mode is on to avoid stale values.

### Device List Ordering
- **Stable device ordering**  
  Devices are now ordered by most recent `last_seen` (and then by ID) so lists remain stable and deterministic.

### UI / UX
- **Dashboard version label aligned**  
  Dashboard now shows the same build version logic as the other pages (env/health).

- **Local time with timezone**  
  Times in device details show local time and timezone (rather than implicit UTC).

- **Clear selection**  
  Added a “Clear” action to deselect all devices and prevent auto‑reselect.

- **Workflow templates button removed**  
  Templates button/menu removed from Workflows as requested.

- **Unified sidebar branding**  
  New brand block styling applied consistently across all menus.

### WebSocket Stability
- **Devices WS connection stabilized**  
  A single shared WS connection is now used across pages (ref‑counted).  
  A heartbeat ping keeps the connection alive to avoid random disconnects.

---

## Bugs Fixed (Detailed)

### 1) “Unable to cancel: missing status id” when pressing STOP
**Root cause:** The UI didn’t persist module `status_id` for active runs; cancellation lacked the required ID.  
**Fix:** Track and persist status IDs on execute response and reuse on cancel. Also clear stale IDs on restart.  
**Impact:** STOP works reliably during active runs.

### 2) `/api/modules/status` 404 while module running
**Root cause:** Route order conflict and legacy module execution blocking the server loop.  
**Fix:** Reordered routes and moved legacy execution to background thread.  
**Impact:** Status polling now stays responsive during long runs.

### 3) SIM/operator stays on old carrier after SIM swap
**Root cause:** Cached device info + incomplete refresh logic.  
**Fix:** Force refresh on scan; clear SIM info when SIM absent; re‑parse operator on each scan.  
**Impact:** Operator updates when SIM changes (MTN → Orange, etc.).

### 4) 5G shown when not available / airplane mode / no‑SIM
**Root cause:** Network tech detection ran even when SIM absent or airplane mode enabled.  
**Fix:** Gate network tech detection and live operator when SIM absent or airplane mode ON.  
**Impact:** No more fake “5G” in invalid contexts.

### 5) RF log pull shows “not working” but dumpsys logs are copied
**Root cause:** RF pull reused generic `/sdcard/log` path.  
**Fix:** Search and pull `cp`/RF folders first; report exact pulled paths; treat partial success correctly.  
**Impact:** RF logs pulled from correct CP path.

### 6) Electron main process EPIPE crash
**Root cause:** stdout/stderr pipe closed under certain conditions.  
**Fix:** Guard logging and ignore EPIPE on console writes.  
**Impact:** No more “JavaScript error in main process (EPIPE)”.

### 7) Device list “priority” issues with telco phones
**Root cause:** Ordering based on implicit DB/default order.  
**Fix:** Sort by last seen, then ID.  
**Impact:** UI order matches real activity; execution order follows selection order.

### 8) UI selection stuck
**Root cause:** No explicit “clear selection” action; auto‑select could immediately re‑select.  
**Fix:** Added Clear action and disabled auto‑select after clear.  
**Impact:** Users can deselect all devices.

---

## Known Limitations / In Progress
- Device‑specific UI automation (Chrome launch, APN navigation) can still vary by OEM/Android version.
- Some modules remain best‑effort for non‑telco phones depending on permissions/UI.

---

## Files / Components Touched
- Backend: `mon-projet/src/backend` (adb_manager, modules, websocket router)
- Frontend: `mon-projet/src/frontend` (Dashboard, TestModules, FlowComposer, DeviceManager, websocket service)
- Electron: `mon-projet/src/electron/main.ts`

---

## Installation
1. Download `MOBIQ-Setup-2.3.0.exe`
2. Run as Administrator
3. Launch MOBIQ from the desktop shortcut

---

## Support
If you need a QA checklist or verification steps for each fix, tell me which areas you want expanded.
