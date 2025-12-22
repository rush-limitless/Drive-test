# Plan â€” Dashboard Device Targeting (Spec 014)

| Phase | Deliverable | Owner | Target |
|-------|-------------|-------|--------|
| P0 | Confirm backend still honours `device_id` for modules | Backend | 2025-11-06 |
| P1 | Implement dashboard device selection + persistence | Frontend | 2025-11-06 |
| P2 | Update module execution flow to consume selected device | Frontend | 2025-11-07 |
| P3 | QA validation with multi-device setup | QA | 2025-11-07 |

## Workstream 1 â€” Discovery

- Audit current device polling (`useDevices`) to ensure we can track status changes.
- Verify that deselecting/ disconnecting devices is surfaced via polling.
- Document storage key to share between dashboard and module pages.

## Workstream 2 â€” Dashboard UX

- Add a â€œSet Activeâ€ action & visual highlight to each device card.
- Persist the chosen `device_id` in local storage and auto-select when only one device exists.
- Handle disconnection by clearing the stored selection and prompting the user.

## Workstream 3 â€” Module Integration

- Update module execution helper (Call Test) to read the stored device, block execution when missing, and send `device_id` to the backend.
- Provide user-facing guidance (snackbar) when no device is active.
- Ensure placeholder/Electron logs reflect the target device for debugging.

## Workstream 4 â€” QA / Documentation

- Manual runs: two devices (switching active device), single device auto-selection, no-device error state.
- Update release notes / docs referencing the dashboard-driven selection.

