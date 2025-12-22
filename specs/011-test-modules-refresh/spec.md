# Feature Specification: Test Modules Catalog Integration

**Feature Branch**: `[011-test-modules-refresh]`
**Created**: 2025-11-05
**Status**: Draft
**Input**: User description: "Read modules from `specs/modules`, make each module functional with ADB logic, and expose a searchable Test Modules UI."

## 1. Background & Context

Test modules are defined in YAML and need to be surfaced in the app with consistent execution behavior.

## 2. Problem Statement

The current UI uses a hard-coded catalog and lacks reliable execution of the YAML-defined modules.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover Modules (Priority: P1)

Operators need to browse every automation module that ships with the desktop app, with the list guaranteed to reflect the YAML definitions in `specs/modules`.

**Why this priority**: Without an authoritative catalogue, operators launch scripts blindly and miss newer capabilities.

**Independent Test**: Load `/modules` page while backend is pointed at the same workspace; the grid must list every YAML module with name + short description pulled from metadata.

**Acceptance Scenarios**:

1. **Given** YAML files under `specs/modules/module.*.yaml`, **When** the Test Modules page loads, **Then** each YAML module appears as a card with name, script id, and synopsis.
2. **Given** a module is removed from the YAML directory, **When** the page refreshes, **Then** the removed module no longer appears.

---

### User Story 2 - Search & Filter (Priority: P2)

Operators want to quickly locate a module by keyword (e.g., "wifi", "airplane") without scrolling through dozens of cards.

**Why this priority**: Search is the fastest way to launch the right diagnostic in field operations.

**Independent Test**: Type a substring of a module name or ID into the search bar; matching cards should filter in real time with zero backend round-trips.

**Acceptance Scenarios**:

1. **Given** the Test Modules view, **When** the user types `"wifi"`, **Then** only modules with `"wifi"` in id/name/description remain visible.
2. **Given** the query is cleared, **When** the user presses Escape or deletes the text, **Then** the full catalogue returns instantly.

---

### User Story 3 - Execute Modules (Priority: P3)

Operators want to trigger a module run directly from the UI and rely on the backend to execute the declared entry point with real ADB commands.

**Why this priority**: Running validated modules from one click reuses the same execution logic that powers workflows, ensuring consistent behaviour.

**Independent Test**: Click `Run` on a module card with a connected device selected; the backend should invoke the module's Python entry point and respond with execution status.

**Acceptance Scenarios**:

1. **Given** a connected device ID and valid module YAML, **When** `POST /api/v1/modules/{id}/execute` is called, **Then** the backend executes the Python entry point referenced by `entry_point` and returns success/failure payload.
2. **Given** execution fails (e.g., invalid parameters), **When** the endpoint responds, **Then** the UI surfaces an error toast without crashing.

---

### Edge Cases

- What happens when a YAML file is missing mandatory keys (id/name/entry_point)-> -> Skip with warning in logs and show a toast in UI that some modules could not load.
- How does system handle module execution when no device ID is provided but the entry point requires one-> -> Validate request; respond `400` with actionable error.
- How to respond when backend cannot import the specified entry point (e.g., typo or missing function)-> -> Return `500` with module id + import error, and display error banner in UI.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Backend MUST load module metadata from `mon-projet/specs/modules/module.*.yaml`, parse into structured objects, and expose them via `/api/v1/modules`.
- **FR-002**: Metadata MUST include `id`, `name`, `description` (fallback generated from id if absent), `entry_point`, `timeout_sec`, `version`, `inputs`, `outputs`, and optional `artifacts`.
- **FR-003**: Backend MUST expose `POST /api/v1/modules/{id}/execute` that resolves the Python entry point (`package.module:function`) and runs it with optional `device_id` + parameters, returning execution summary (success flag, stdout/stderr, duration).
- **FR-004**: Frontend MUST replace the hard-coded `MODULE_CATALOG` with data fetched from the new modules endpoint and render cards styled per Spec 008 increments.
- **FR-005**: Frontend MUST provide an inline search bar (case-insensitive, debounced <=150 ms) that filters the rendered module cards without additional backend calls.
- **FR-006**: Clicking `Run` MUST hit the new execute endpoint; clicking `Edit` MUST open the underlying YAML file or declare a TODO prompt if Electron bridge unavailable.
- **FR-007**: System MUST log and surface meaningful errors (toast/dialog) when module loading or execution fails.

### Key Entities *(include if feature involves data)*

- **ModuleDefinition**: `{ id, name, description, entry_point, timeout_sec, version, inputs, outputs, artifacts }`.
- **ModuleExecutionRequest**: `{ module_id, device_id->, parameters->, timeout_override-> }`.
- **ModuleExecutionResult**: `{ module_id, success, duration, stdout->, stderr->, metadata-> }`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `GET /api/v1/modules` returns >= 35 modules from YAML with response time < 300 ms on dev hardware.
- **SC-002**: Module search filters the UI list in <= 100 ms after the debounce completes.
- **SC-003**: Executing an available module via UI triggers the backend entry point and returns JSON with `success` or `error` fields 100% of the time.
- **SC-004**: UI gracefully handles loader errors by presenting a user-facing alert and logging details in the console without unhandled exceptions.

## 8. Acceptance Criteria

- The modules endpoint returns metadata derived from YAML definitions.
- The UI renders module cards and supports local search filtering.
- Executing a module returns a success or failure response that is shown in the UI.

