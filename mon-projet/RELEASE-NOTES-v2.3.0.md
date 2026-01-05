# MOBIQ v2.3.0 - Release Notes

Release date: 2026-01-05

Highlights
- Better module cancellation and status handling during long runs.
- SIM/operator refresh fixes (SIM swap, airplane mode, no-SIM cases).
- RF log pulling targets `/sdcard/log/cp` and other RF folders first.
- Dashboard and device selection UX updates.

Backend
- Keep module status endpoint responsive during legacy module runs.
- Refresh device info on each scan; clear SIM info when SIM is removed.
- Block operator/tech detection when airplane mode is on or SIM is absent.
- RF log pull searches CP/RF folders and reports pulled paths.
- Devices listing ordered by last seen to stabilize UI and execution order.

Frontend
- Clear selection button on Dashboard; no forced auto-select after clear.
- Version label consistent across pages (env/health).
- Local time display with timezone in device details.
- Workflow templates button removed from Workflows.
- Updated sidebar brand block (shared styling across menus).
- WebSocket devices connection stabilized with heartbeat and ref counting.

Notes
- Build warnings about `baseline-browser-mapping` are informational only.
