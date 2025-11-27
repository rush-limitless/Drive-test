# Plan — Telco ADB Dashboard (Spec 008)

| Phase | Deliverable | Owner | Target |
|-------|-------------|-------|--------|
| P0 | Backend summary/search/activity endpoints drafted | Backend Lead | 2025-11-06 |
| P1 | Dashboard state store + telemetry scaffolding | Frontend Lead | 2025-11-07 |
| P2 | Header (scope select + search + add devices) implemented | Frontend Team | 2025-11-08 |
| P3 | KPI cards & connected devices panel | Frontend Team | 2025-11-09 |
| P4 | Recent activity panel + skeleton/empty/error states | Frontend Team | 2025-11-10 |
| P5 | Device scan workflow + WS integration | Backend + Frontend | 2025-11-11 |
| P6 | QA automation (Playwright + axe-core) | QA Lead | 2025-11-12 |
| P7 | Documentation & spec promotion to In Review | Spec Champion | 2025-11-13 |

## Work Streams

1. **Backend APIs**
   - Implement `/api/dashboard/summary`, `/api/search`, `/api/activity/recent`, reuse existing device endpoints.
   - Ensure rate limiting and error envelopes align with Spec 004 resilience.

2. **Frontend Implementation**
   - Create components (DeviceScopeSelect, GlobalSearch, KPI cards, panels).
   - Apply theme tokens (neumorphic style), integrate lucide-react icons.
   - Manage state with Redux/Zustand/tanstack-query.

3. **Device Scan & Telemetry**
   - Wire `POST /api/devices/scan`, listen to WS `devices_changed`.
   - Emit telemetry events for key actions.

4. **QA & Documentation**
   - Build acceptance tests (Playwright, axe-core).
   - Update README/docs to describe dashboard behaviour.
   - Run `npm run spec:check` and ensure CI coverage.

