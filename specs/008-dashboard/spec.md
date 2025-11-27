# Specification — Telco ADB Dashboard

**Spec ID**: `008-dashboard`  
**Maintainer**: UI/UX + Orchestrator Teams  
**Status**: Draft → In Review  
**Last Updated**: 2025-11-04  

---

### Increment 008.8 — Device Cards Metadata *(Spec 8)*

**Objective**: Replace the simple device list with card-style tiles showing key information per connected device.

**In Scope**
- For each device returned by `/api/v1/devices`, display a card with: device name/model, SIM carrier info (if available), battery level, and connection type (USB indicator).
- Maintain “Scan Again” behaviour; cards only appear when devices array non-empty.
- Visual design inspired by existing panels: 16 px spacing between cards, soft border, subtle shadow, iconography for SIM/battery/USB.
- Fallback text when data missing (e.g., “SIM: N/A”, “Battery: —”).

**Out of Scope**
- Additional actions (reboot, inspect) per device.
- Persisting device cards outside dashboard (no changes to Device Manager page).
- Backend changes to provide extra data (use existing fields from API response where possible; otherwise placeholder).

**Acceptance Checks**
1. Given `/api/v1/devices` returns devices with `model`, `sim_info`, `battery_level`, and `connection_type`, when dashboard loads, then each device is rendered as a card with all four data points visible.
2. Given missing SIM or battery info, when rendering a card, then labels fall back to “SIM: N/A” or “Battery: —%” without breaking layout.
3. Given multiple devices, when screen width ≥1280 px, then cards flow in a responsive grid (minimum two per row) with consistent gutters.

---

### Increment 008.9 — Device Card Sizing *(Spec 9)*

**Objective**: Ensure the new device cards breathe and adapt to longer content without feeling cramped.

**In Scope**
- Increase padding / min-height of device cards so SIM and connection details never wrap awkwardly.
- Adjust grid breakpoints to allow cards to span fewer columns on medium screens (prevent overly narrow tiles).
- Enlarge icon badges (SIM/battery/USB) to 36 px and bump typography spacing.

**Out of Scope**
- Additional fields inside cards.
- Changes to other dashboard sections.

**Acceptance Checks**
1. Given devices with long carrier names, when rendered, then text wraps within the card without breaking layout and card height adjusts gracefully.
2. Given viewport width between 1024 px and 1280 px, when cards render, then at most two cards appear per row with generous padding (no cramped columns).
3. Given keyboard focus on “Open details”, when triggered, then the card still maintains spacing (no layout jump due to outline).

---

### Increment 008.10 — Device Actions *(Spec 10)*

**Objective**: Provide actionable controls on each device card: disconnecting the phone and viewing detailed information.

**In Scope**
- Replace the single “Open details” button with two buttons: `Disconnect` (outlined blue with subtle danger hover) and `Details` (primary/ghost) aligned right.
- `Disconnect` triggers `POST /api/v1/devices/{device_id}/disconnect`, shows inline loading state, and refreshes device list + summary upon success.
- `Details` opens a modal dialog summarising all available metadata (model, OS version, manufacturer, SIM info, battery, connection, last seen, status).
- Provide user feedback when disconnect fails (toast/snackbar or inline error message in card).

**Out of Scope**
- Navigation to a separate device page (dialog only).
- Persistent notifications or audit logging.
- Backend changes to enrich device payloads.

**Acceptance Checks**
1. Given a device card, when clicking `Disconnect`, then the button enters a loading state until the API resolves and the card reflects the updated status.
2. Given the disconnect request fails, when it returns an error, then an error message (toast or inline alert) is displayed without closing the dialog/card.
3. Given the user clicks `Details`, when the dialog opens, then all key fields (model, manufacturer, OS, SIM, battery, connection, last seen, status) are readable the same as in the cards.

---

### Increment 008.11 — Device Card Width *(Spec 11)*

**Objective**: Give each device tile more horizontal space so long values remain readable.

**In Scope**
- Update dashboard grid breakpoints so cards span full width on tablets (≤1280 px) and half-width on wide desktops (≥1600 px).
- Increase horizontal padding inside cards and align content to avoid cramped layout.
- Ensure SIM / battery / connection rows wrap gracefully without truncation.

**Out of Scope**
- Additional data fields or styling changes beyond spacing.
- Behaviour of other dashboard sections.

**Acceptance Checks**
1. Given viewport width 1024–1365 px, when viewing devices, then each card spans the entire row with comfortable margins.
2. Given viewport width ≥1600 px, when viewing devices, then exactly two cards appear per row with balanced spacing.
3. Given carrier names exceeding 20 characters, when rendered, then text wraps onto a new line without clipping or overflow.

---

### Increment 008.12 — Branding Alignment *(Spec 12)*

**Objective**: Align application naming with the desired “ADB Framework / Telco Automation” stack in both header and sidebar.

**In Scope**
- Update AppBar title to show two-line branding (“ADB Framework” caption + “Telco Automation” heading) with reduced font size and tighter spacing.
- Mirror the same wording in the sidebar branding block and adjust top padding so the title sits closer to the top edge.
- Ensure typography scales down slightly so the name feels lighter.

**Out of Scope**
- Any change to navigation items or AppBar actions.

**Acceptance Checks**
1. Given the dashboard loads, when viewing the top AppBar, then the title displays as two lines (“ADB Framework” / “Telco Automation”) with smaller type.
2. Given the sidebar is rendered, when observing the brand block, then it uses the same two-line wording and sits tight to the top (no large gap).

---

### Increment 008.13 — Test Modules Gallery *(Spec 13)*

**Objective**: Surface every script in `adb_scripts/` inside the “Test Modules” page as actionable cards.

**In Scope**
- Discover available modules via a static metadata list (filename, friendly name, description).
- Render cards (grid) showing module name, short description, and two buttons: `Run` and `Edit`.
- `Run` triggers a placeholder handler (console/log) until backend integration is ready; `Edit` opens the script in the default editor (Electron hook when available, otherwise shows download path).

**Out of Scope**
- Executing scripts directly from the frontend (will be wired later).
- CRUD operations on module files.

**Acceptance Checks**
1. Given the Test Modules page, when it loads, then each `.sh` script from `adb_scripts/` appears as a card with name + description.
2. Given a user clicks `Run`, then a feedback toast appears indicating the action (placeholder) mentioning which script will run.
3. Given a user clicks `Edit`, then another feedback appears (or Electron handler fires) pointing to the script path.

---

### Increment 008.14 — Test Modules Styling *(Spec 14)*

**Objective**: Make the Test Modules cards visually richer and easier to scan while keeping functionality unchanged.

**In Scope**
- Card visuals: rounded 20–24px radius, soft shadow, subtle white-to-blue gradient, hover lift (–2px) with stronger shadow.
- Header row with colored icon badge, module name, and a small script chip (monospace).
- Footer with `Run` (primary with Play icon) and `Edit` (outlined with Pencil icon) buttons.
- All copy in English.

**Out of Scope**
- Reading module metadata dynamically from the filesystem (handled by a later increment).
- Executing scripts for real (existing placeholder/Electron hooks remain).

**Acceptance Checks**
1. Given the Test Modules page, when hovering a card, then it slightly lifts and the shadow intensifies.
2. Given each card, when rendered, then it shows: icon badge, module name, script chip, description, and Run/Edit buttons.
3. Given keyboard focus, when tabbing to buttons, then focus outlines are visible and readable.

---

### Increment 008.15 — Device Battery Indicator *(Spec 15)*

**Objective**: Always surface a readable battery percentage on connected device cards.

**In Scope**
- Normalise `battery_level` values returned by the backend (string like "79%" or numeric) and display the percentage.
- Add visual cues: battery icon with color based on level (green ≥60%, amber 30–59%, red <30%).
- Handle `Unknown` gracefully by showing “Battery: Unknown” but never blank.

**Out of Scope**
- Polling for battery updates (existing refresh cadence stays).

**Acceptance Checks**
1. Given a device with `battery_level="79%"`, when the card renders, then it shows “79%” with a green badge.
2. Given `battery_level="Unknown"`, then the card shows “Unknown” text without crashing.

---

### Increment 008.16 — Battery in Details Only *(Spec 16)*

**Objective**: Simplify the Connected Devices cards while keeping full telemetry in the details dialog.

**In Scope**
- Remove the battery line from the dashboard device cards.
- Ensure the Details modal continues to show the actual battery percentage/value fetched from ADB.
- Normalise the Details display so numbers and strings (e.g. `79` or `79%`) render cleanly with a single percent sign.

**Out of Scope**
- Any change to battery polling frequency.
- Additional metrics inside the dialog.

**Acceptance Checks**
1. Given the connected devices panel, when it renders, then battery information is no longer shown in the card body.
2. Given a user opens the Details dialog for a device, when data contains `battery_level="79%"` or `79`, then the dialog displays “79%”.

---

### Increment 008.17 — Dashboard Search Directory *(Spec 17)*

**Objective**: Make the dashboard search bar surface actionable links for devices and modules without relying on a backend endpoint.

**In Scope**
- Build a local search index combining currently loaded devices and the module catalog (from `specs/modules`).
- Filter results client-side with debounced input; show name + contextual description.
- Navigate to `/devices` when selecting a device result and to `/modules` (with an anchor) for modules.

**Out of Scope**
- Searching workflows or other entities (future enhancement).
- Persisting recent searches.

**Acceptance Checks**
1. Given connected devices, when typing part of a device name, then matching devices appear in the autocomplete list.
2. Given the module catalog, when typing part of a script/module name, then matching modules appear with description text.
3. Given a search result selection, when clicking it, then the router navigates to the correct page and the field clears.

---

### Increment 008.18 — Device Card Layout *(Spec 18)*

**Objective**: Improve the visual hierarchy of connected device cards so the most relevant telemetry appears first.

**In Scope**
- Reorder card content: header (name + status), then connection type, network operator, SIM info, and a footer showing “Last seen”.
- Use dedicated icons (plug, radio tower, waves) and ensure text wraps cleanly.
- Ensure `network_operator` is surfaced when available; fallback to “Unknown”.

**Out of Scope**
- Fetching additional backend data.
- Battery indicator (already handled in details modal).

**Acceptance Checks**
1. Given a device card, when rendered, then the first info row shows the connection type followed by network operator and SIM.
2. Given a device with `network_operator`, when present, then the card displays the operator; otherwise it shows “Unknown”.
3. Given `last_seen` data, when present, then the footer displays “Last seen …”; otherwise it shows “Last seen: Unknown”.

---

### Increment 008.19 — Device Tile Mini Cards *(Spec 19)*

**Objective**: Present connected devices as compact tiles with a clean, modern aesthetic inspired by contemporary dashboards.

**In Scope**
- Reduce card footprint (approx. 200–220px tall) with consistent square-ish aspect ratio.
- Introduce a subtle glassmorphic background (blur + light border) and icon badge.
- Move actions (Disconnect/Details) to icon-only buttons to save space.
- Ensure layout is responsive: tiles in a 3-column grid on desktop, 2 on tablet, 1 on mobile.

**Out of Scope**
- Changing device metadata shown (still connection, network, SIM, last seen).
- Backend API adjustments.

**Acceptance Checks**
1. Given Connected Devices, when rendered on desktop (≥1280px), then cards show in at least 3 columns with uniform height.
2. Given a card, when hovering, then it gains a subtle lift and shadow.
3. Given a card action button, when focused/hovered, then the icon-only control is accessible (tooltip or aria-label).

---

## 1. Background & Context

The Telco ADB Automation application (Electron shell + React UI) requires a first-class home dashboard where operators can monitor device availability, launch quick actions, and review recent activity. Previous iterations mixed widgets from other pages and lacked a coherent neumorphic visual identity. This spec defines the new dashboard experience, its data contracts, and implementation guidelines.

---

## 2. Problem Statement

Current state:
1. No unified header providing device scope selection or global search across modules/workflows/devices.
2. Connected devices overview is fragmented; empty/error states are unclear.
3. Recent activity feed is missing, forcing users to drill into other tabs for history.
4. Theme and spacing are inconsistent with the desired soft/light neumorphic style.

The dashboard must present essential information at a glance, support quick navigation, and remain performant and accessible.

---

## 3. Goals & Non Goals

### Goals
- Deliver the dashboard route (`/dashboard`) featuring header controls, KPI cards, connected devices panel, and recent activity column.
- Provide backend APIs (`/api/dashboard/summary`, `/api/search`, `/api/activity/recent`) powering the UI.
- Ensure responsive, accessible layout with documented theme tokens.
- Capture telemetry for key interactions (view, search, scan, add devices).

### Non Goals
- Deep configuration of modules/workflows/devices (covered by Spec 005).
- Execution management workflows (run/stop tests).
- Device detail pages or workflow editors.

---

## 4. Stakeholders

| Role | Responsibility | Contact |
|------|----------------|---------|
| UI/UX Lead | Visual language, component design | ux@example.com |
| Frontend Lead | Dashboard React implementation | frontend@example.com |
| Backend Lead | Summary/search/activity endpoints | backend@example.com |
| QA Lead | Acceptance scenarios, E2E coverage | qa@example.com |
| Spec Champion | SDD governance | spec-champion@example.com |

---

## 5. Personas & User Stories

### Persona: Telco Operator
Needs to verify device availability, trigger quick tests, and monitor activity within seconds.

### Persona: QA Lead
Requires aggregated counts (devices/workflows) and audit trail from a single view.

### User Story 1 — At-a-glance overview
**As** an operator  
**I want** connected-device counts, workflow stats, and quick actions visible immediately  
**So that** I can assess readiness without leaving the dashboard.

### User Story 2 — Unified search
**As** a QA lead  
**I want** to search modules, workflows, and devices from one field  
**So that** I can jump directly to relevant resources.

### User Story 3 — Recent activity context
**As** an operator  
**I want** a chronological feed of recent executions/events  
**So that** I can spot issues quickly.

---

## 6. Functional Requirements

1. **Header Controls**
   - Device scope selector (default “All Devices”), counts per scope.
   - Global search input with debounce (250 ms) returning mixed entity results.
   - “Add Devices” button with badge when USB devices require authorisation.

2. **KPI Cards (Row 1)**
   - Connected devices card (`connected/total`, error message if backend reports error).
   - Workflows card (total/active/draft).
   - Quick actions card (three vertical buttons linking to `/run/quick`, `/workflows`, `/modules`).

3. **Main Panels (Row 2)**
   - Connected devices card (large) showing empty state illustration + “Scan Again” CTA; populated state optional for now.
   - Recent activity card (right column) listing last items with icons, timestamps, and “View All” link to `/reports/activity`.

4. **Search Results**
   - `GET /api/search?q=&limit=` returning `type/id/label/href`; selecting a result navigates `href`.

5. **Device Scan**
   - `POST /api/devices/scan` triggers scan; success message; WebSocket `devices_changed` event or fallback polling.

6. **Recent Activity**
   - `GET /api/activity/recent` returning up to 10 items with `icon`, `title`, `ts`, `meta`.

7. **Theme / Layout**
   - Light neumorphic style: radius 16px, spacing 24px, cards with soft elevation.
   - Colors, typography, shadows follow tokens defined in §10.

8. **State Management**
   - Dashboard state store with scope, summary, devices, activity, search cache, error.

9. **Telemetry**
   - Emit events: `dashboard_viewed`, `search_used`, `scan_again_clicked`, `add_devices_clicked`.

10. **Performance & A11y**
    - `/api/dashboard/summary` TTFB < 200 ms; LCP < 2.0 s on QA hardware.
    - WCAG 2.1 AA contrast; focus outlines; ARIA roles for search/list items.

---

### Increment 008.1 — Header Layout Refresh *(Spec 1)*

**Objective**: Align the dashboard header with the supplied mock (title on the left, scope selector inline, search field and primary CTA on the right) while preserving existing data behaviour.

**In Scope**
- Replace the hero banner with a compact header bar on a light background (`#F6F9FF`).
- Render `Dashboard` title in bold (`Typography variant="h4"`, fontWeight 700).
- Position the scope `<Select>` immediately to the right of the title (desktop) and stack underneath on mobile (<960 px).
- Style the global search input as a pill-shaped `TextField` (`borderRadius: 12px`, subtle border `#D9E2F9`).
- Primary button `Add Devices` on the far right: blue background `#2563EB`, height 44 px, radius 12 px, optional badge showing offline devices count.
- Maintain existing handlers (`handleScopeChange`, `handleSearchSelect`, `handleAddDevices`).

**Out of Scope**
- KPI card styling or layout (covered by later increments).
- Connected devices panel, quick actions, recent activity layout.
- Additional backend work—purely presentational changes.

**Acceptance Checks**
1. Given the dashboard loads, when ~the window width is ≥ 960 px, then the header shows "Dashboard" title, scope dropdown directly right of it, search field centered right, and Add Devices button flush right.
2. Given the dashboard loads, when the offline count > 0, then the Add Devices button displays a badge with that count (design accent red `#F43F5E`).
3. Given keyboard focus cycles through header controls, when the user presses `Tab`, then focus order follows title → scope select → search input → add devices button and outlines remain visible.

---

### Increment 008.2 — KPI Row Styling *(Spec 2)*

**Objective**: Reproduce the first row of cards from the mock (Connected Devices, Workflows, Quick Actions) with consistent neumorphic styling and interactive quick-action toggles.

**In Scope**
- Three cards aligned horizontally on ≥1280 px: two metric cards (Connected Devices, Workflows) and one quick-actions card.
- Card container: 20 px radius, `#FFFFFF` background, border `#E3EBFA`, subtle shadow, 24 px internal padding.
- Connected Devices card renders `connected/total` in blue `#1E40AF` with supporting error text when `summary.devices.error` present.
- Workflows card shows total (blue), breakdown line “{active} active, {draft} draft” in muted text.
- Quick Actions card lists three options stacked vertically. First option active by default with blue background `#2563EB`, white text; inactive options `#F8FAFF` with grey text and border.
- Buttons should navigate using existing `handleQuickNav` to `/run/quick`, `/workflows`, `/modules`.

**Out of Scope**
- Changing quick-action destinations or copy.
- Additional metrics (uptime, alerts, etc.).
- Responsive stacking logic (handled later if needed).

**Acceptance Checks**
1. Given the dashboard loads, when summary data is available, then connected-device and workflow cards use blue headline numbers with supporting captions exactly matching the copy `Error: HTTP 404: Not Found` when an error exists.
2. Given the dashboard loads, when the user hovers the primary quick action, the button retains blue background and renders pointer cursor; inactive buttons change background to `#E8F0FF` on hover.
3. Given the viewport ≥ 1280 px, when the cards render, then all three appear on a single row with equal height and 24 px spacing between them.

---

### Increment 008.3 — Sidebar Navigation *(Spec 3)*

**Objective**: Align the left navigation rail with the mock: branded header and ordered menu items for core areas.

**In Scope**
- Drawer width ~260 px with dark navy gradient background (`#0B1220` → `#111C35`).
- Brand block at top displaying “ADB Framework” (small caps) and “Telco Automation Desktop”.
- Menu items ordered: Dashboard, Test Modules, Custom Workflows, Device Manager, Reports.
- Each item uses rounded button (radius 12 px) with icon + label; active item background `#2563EB`, text white; inactive items lighten on hover.
- Navigation integrates with React Router (update routes for new paths where needed, placeholders acceptable).

**Out of Scope**
- Secondary navigation (Run Workflow, Reports & Artifacts variations).
- Contextual badges or counts per menu item (future enhancement).

**Acceptance Checks**
1. Given the dashboard renders, when inspecting the sidebar, then the brand block shows the two-line title exactly as specified.
2. Given the user navigates to each menu item, when selected, then the item highlights with blue background and white text while others remain passive.
3. Given keyboard navigation with `Tab` and arrow keys, when focusing the list, then focus outlines remain visible and each item is reachable sequentially.

---

### Increment 008.4 — Main Panels Layout *(Spec 4)*

**Objective**: Align the second row (Connected Devices + Recent Activity) with the reference mock, including empty state visuals and compact activity feed.

**In Scope**
- Connected Devices panel: white card, 20 px radius, border `#E3EBFA`, padding 32 px. Title aligned left, content centered. Empty state message “No devices connected” with illustrative icon, helper text, and primary button “Scan Again”.
- When devices exist, list them with light separators, avatar circle, model label, status badge, and “Open” chevron button.
- Recent Activity panel: white card with same styling, title + “View All” link button. Items displayed as pill rows with left icon (status color), title text, timestamp subtitle.
- Typography: headings `#0F172A`, body `#475569`, button background `#2563EB`.
- Maintain existing scan handler, navigate actions, API wiring.

**Out of Scope**
- Pagination or filters for activity feed.
- Device detail modals or actions beyond “Open”.
- Backend changes.

**Acceptance Checks**
1. Given `/api/devices` returns empty, when the dashboard loads, then the Connected Devices panel displays the empty illustration, helper text, and blue “Scan Again” button centered as in the mock.
2. Given `/api/activity/recent` returns multiple items, when the dashboard loads, then the Recent Activity panel lists them with icon glyphs, labels, and “View All” link top-right.
3. Given focus navigation with keyboard, when tabbing through the panels, then buttons (`Scan Again`, `View All`, `Open`) receive visible focus outlines.

---

### Increment 008.5 — Visual Polish *(Spec 5)*

**Objective**: Bring the dashboard closer to the reference mock by refining surfaces (borders, shadows, spacing) for header, cards, search field, and quick actions.

**In Scope**
- Update dashboard background to a lighter `#F5F8FF` tone and ensure header/card shadows use soft navy tints.
- Header card gets stronger drop shadow (`0 18px 36px rgba(15, 23, 42, 0.08)`), border `#DDE4F8`, and rounded corners 24 px.
- Search input styled with pill shape (`borderRadius: 999px`), white fill, subtle shadow, and hover/ focus border `#2563EB` to match mock.
- KPI cards reworked with smoother border (`#E2E9FB`), background gradient hint (`linear-gradient(180deg,#FFFFFF 0%,#F9FBFF 100%)`), and consistent spacing.
- Connected Devices & Recent Activity panels adopt same border/shadow language, list dividers use `#E7ECFC`, and quick actions buttons receive updated hover states (active deep blue, inactive `#EDF2FF`).

**Out of Scope**
- Typography copy changes beyond tone adjustments.
- Functional changes to quick actions or device list.
- Responsive/mobile tweaks (future increment).

**Acceptance Checks**
1. Given the dashboard loads, when inspecting cards, then each has radius ≥20 px, gradient white background, border color `#E2E9FB`, and a soft drop shadow (no harsh gray outlines).
2. Given the user focuses the search input, then the pill shows blue border and keeps its drop shadow without layout shift.
3. Given the user hovers inactive quick-action buttons, then background transitions to `#EDF2FF` with blue text, while the active button maintains the deep blue background.

---

### Increment 008.6 — Quick Actions & Activity Icons *(Spec 6)*

**Objective**: Match the mock’s iconography and supporting text for quick actions and recent activity items.

**In Scope**
- Quick Actions buttons: each displays a colored icon badge (rocket pink, bolt orange, grid green) and a muted secondary line describing the action.
- Activity feed entries: map activity type (`check`, `signal`, `warning`, `battery`, etc.) to specific emoji/icons (✅ 📶 ⚠️ 🔋) with consistent background color chips.
- Ensure typography: primary line bold `#0F172A`, secondary line `#94A3B8`.

**Out of Scope**
- Additional quick action items or routing changes.
- Backend mapping of activity types (use existing icon string mapping).

**Acceptance Checks**
1. Given the dashboard loads, when viewing quick actions, then each button includes a leading circular icon with color-coded background and a subtle description line underneath the main label.
2. Given activity items returned from the API, when rendering, then each uses the new emoji/icon mapping with matching background color chips and secondary timestamp text in grey.
3. Given keyboard navigation, when focusing quick action buttons, then icon badges remain aligned and accessible name includes both primary and secondary text.

---

### Increment 008.7 — Accessibility & Responsive Polish *(Spec 7)*

**Objective**: Ensure the dashboard remains aligned with the mock while providing clear focus states and graceful behaviour on narrower viewports.

**In Scope**
- Add explicit `:focus-visible` styling (outline/halo) for primary interactive controls: search input, Add Devices button, quick action buttons, Scan Again, View All, device “Open” buttons.
- Adjust header/quick action layout breakpoints so elements wrap cleanly below 1280 px (no overflow, consistent spacing).
- Tweak typography spacing for quick action secondary lines and activity timestamps for readability.

**Out of Scope**
- Changes to routing, data fetching, or additional content.
- Mobile navigation drawer behaviour (covered by future increments if needed).

**Acceptance Checks**
1. Given keyboard navigation, when tabbing through the header and quick action buttons, then a visible blue halo appears around each focused control without shifting layout.
2. Given the viewport width is 1024 px, when viewing the dashboard, then the header stack and quick actions wrap with consistent vertical spacing and no overlapping content.
3. Given activity feed timestamps, when rendered, then secondary text uses the lighter grey tone and retains readable spacing against the primary line.

---

## 7. Non-Functional Requirements

- Responsive layout supporting min width 1280 px; cards stack at smaller breakpoints.
- WS reconnection tolerant; fallback polling every 5 s if WS unavailable.
- Rate limiting for `/api/search`: 10 requests per 10 seconds per client.
- Secure scan endpoint (Electron IPC or CSRF-safe call).

---

## 8. Acceptance Criteria

| Scenario | Given | When | Then |
|----------|-------|------|------|
| AC-801 | `/api/devices` returns empty list | Dashboard loads | Connected devices panel shows illustration + “Scan Again” CTA |
| AC-802 | `/api/dashboard/summary.devices.error` present | Dashboard loads | Connected devices card shows red error text (“Error: HTTP 404: Not Found”) |
| AC-803 | User types “call” in search | Search is executed | First result includes “Call Test (module)” and can be selected |
| AC-804 | User clicks “Workflows” in Quick Actions | Dashboard loaded | Router navigates to `/workflows` |
| AC-805 | `/api/activity/recent` returns item “SMS Test completed” | Dashboard loads | Activity feed shows “SMS Test completed • 2 minutes ago” |
| AC-806 | User selects scope “Demo Lab” | Scope changed | `/api/dashboard/summary?scope=demo-lab` called and cards update |

---

## 9. Rollout Plan

1. Implement backend summary, search, and activity endpoints.
2. Build frontend components (scope select, search, KPI cards, panels).
3. Connect device scan (POST + WS).
4. Add state management and telemetry hooks.
5. Execute QA acceptance tests (Playwright + axe-core).
6. Promote spec to *In Review* once scenarios pass and metrics met.

---

## 10. Design Tokens & Theme

```ts
export const dashboardTheme = {
  radius: 16,
  spacing: 24,
  card: { padding: 20, elevation: 6 },
  colors: {
    bg: "#F7FAFC",
    panel: "#FFFFFF",
    text: "#1A202C",
    subtext: "#4A5568",
    primary: "#2563EB",
    success: "#16A34A",
    warning: "#D97706",
    danger: "#DC2626",
    border: "#E2E8F0",
  },
  shadows: {
    card: "0 8px 24px rgba(0,0,0,0.06)",
    cardHover: "0 12px 32px rgba(0,0,0,0.08)",
  },
};
```

Icons: `lucide-react`. Buttons: radius 10px; primary button height 44px.

---

## 11. Telemetry & Analytics

- `dashboard_viewed` { scopeId }
- `search_used` { queryLength, resultTypeTop }
- `scan_again_clicked`
- `add_devices_clicked`

Events emitted via telemetry client (Electron IPC or web analytics).

---

## 12. Dependencies & Integration

- Requires Spec 005 metadata for modules/workflows to power `/api/search`.
- Device scan uses existing ADB service; ensure WS `devices_changed` emitted (Spec 004 resilience).
- Electron main process to expose `addDevices()` handler (opens documentation or driver setup).

---

## 13. Definition of Done

- All acceptance criteria satisfied via automated or manual tests.
- LCP < 2.0 s, axe-core report free of critical issues, no console errors.
- CI pipeline (lint/tests/build Electron) passes.
- UX matches provided mock (padding/color variances ≤ 8px).
- README/Docs updated with dashboard summary.

---

## 14. Open Questions

- Do we need persistent saved scopes per user? (future enhancement)
- Should global search support fuzzy matching or exact prefix? (decide during implementation)
- How to surface telemetry dashboards (out of scope for now).
