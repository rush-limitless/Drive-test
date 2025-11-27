# Tasks — Spec 008 Telco ADB Dashboard

## Backend
- [x] Implement `GET /api/dashboard/summary` (scope-aware aggregates, error envelope).
- [x] Implement `GET /api/search` (modules/workflows/devices mixed results, rate limited).
- [x] Implement `GET /api/activity/recent` (latest events).
- [ ] Ensure `POST /api/devices/scan` emits `devices_changed` over WS or fallback.
- [ ] Add telemetry logging hooks.

## Frontend
- [ ] Create dashboard state store (scope, summary, devices, activity, search).
- [x] Increment 008.1 — Refresh header layout + styling to match mock.
- [x] Increment 008.2 — Style KPI row (Connected Devices / Workflows / Quick Actions).
- [x] Increment 008.3 — Sidebar navigation refresh.
- [x] Increment 008.4 — Main panels layout (Connected Devices & Recent Activity).
- [x] Increment 008.5 — Visual polish pass (header/cards/search).
- [x] Increment 008.6 — Quick actions + activity icons alignment.
- [x] Increment 008.7 — Accessibility + responsive polish.
- [x] Increment 008.8 — Device cards metadata (SIM/battery/USB).
- [x] Increment 008.9 — Device card sizing adjustments.
- [x] Increment 008.10 — Device actions (disconnect + detail modal).
- [x] Increment 008.11 — Device card width adjustments.
- [x] Increment 008.12 — Branding alignment (AppBar + sidebar).
- [x] Increment 008.13 — Test Modules gallery.
- [x] Increment 008.14 — Test Modules styling polish.
- [x] Increment 008.15 — Device battery indicator.
- [x] Increment 008.16 — Battery in details only.
- [x] Increment 008.17 — Dashboard search directory.
- [x] Increment 008.18 — Device card layout refresh.
- [x] Increment 008.19 — Device tile mini cards.
- [x] Implement KPI cards row (connected devices, workflows, quick actions).
- [x] Implement connected devices panel (empty/error states + Scan Again).
- [x] Implement recent activity panel with “View All”.
- [ ] Apply theme tokens (cards, shadows, colors) and lucide icons.
- [ ] Wire telemetry events for view/search/scan/add.

## QA / Tooling
- [ ] Add Playwright scenario coverage for acceptance criteria AC-801..AC-806.
- [ ] Run axe-core accessibility check on dashboard.
- [ ] Update documentation/README with dashboard overview.

## Governance
- [ ] Link commits/PRs to Spec 008.
- [ ] Keep `npm run spec:check` passing.
- [ ] Promote spec status to *In Review* after QA signoff.
