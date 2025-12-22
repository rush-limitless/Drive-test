# Feature Specification: Dashboard Device Targeting for Modules

**Feature Branch**: `[014-call-test-device-selection]`
**Created**: 2025-11-06
**Status**: Draft
**Input**: User description: "Quand deux telephones sont connectÃ©s il faut une logique de choix du tÃ©lÃ©phone sur lequel on veux executer le module. Cette sÃ©lection doit Ãªtre faite sur le dashboard."

## 1. Background & Context

Module execution requires selecting a target device when multiple devices are connected.

## 2. Problem Statement

The current dashboard does not offer a clear device selection workflow for module execution.

## User Scenarios & Testing *(mandatory)*

### User Story 1 â€“ Pick a Target Device from the Dashboard (Priority: P1)

When multiple phones are connected, the operator needs to pick which device is â€œactiveâ€ directly from the dashboard card. Any module run afterwards must use that device automatically.

**Why this priority**: Prevents automation from hitting the wrong handset when several are available.

**Independent Test**: With two devices online, clicking the â€œSet Active Deviceâ€ control on a card highlights it. Running Call Test (or any single-device module) uses the highlighted device and no other phone rings.

**Acceptance Scenarios**:

1. **Given** two connected devices, **When** I mark device `Device-A` as active on the dashboard, **Then** the card displays an active state and the selection persists while browsing.
2. **Given** `Device-A` is active, **When** I launch Call Test from the Modules page, **Then** the backend request contains `device_id=Device-A` and only that handset rings.

---

### User Story 2 â€“ Persist the Selection Across Sessions (Priority: P2)

Operators should not have to reselect their preferred phone after every refresh or navigation.

**Why this priority**: Saves time during repetitive test campaigns and reduces selection mistakes.

**Independent Test**: Select a device, reload the dashboard, and verify the same card stays active. Navigate to the Modules page and confirm the choice is still applied.

**Acceptance Scenarios**:

1. **Given** I activate `Device-B`, **When** I refresh the dashboard, **Then** `Device-B` remains highlighted as the active device.
2. **Given** the stored device is disconnected, **When** I reopen the dashboard, **Then** the UI clears the selection and prompts me to choose another device before running modules.

---

### User Story 3 â€“ Guide the User When No Device Is Active (Priority: P3)

If no device has been selected, the Modules page must block execution and clearly instruct the user to pick one from the dashboard first.

**Why this priority**: Avoids silent failures and ensures the operator understands how to target a phone.

**Independent Test**: Clear the selection (or connect zero devices), attempt to run Call Test; the Modules page shows an error and does not contact the backend.

**Acceptance Scenarios**:

1. **Given** no active device, **When** I click â€œRunâ€ for Call Test, **Then** I receive an error message telling me to select a device on the dashboard, and no module is executed.
2. **Given** an active device is removed, **When** I navigate to Modules, **Then** the page detects the missing device and prompts me to reselect via the dashboard.

---

### Edge Cases

- Device list updates while the dashboard is open: selection should switch to a valid device or clear gracefully.
- Only one device connected: selection should auto-activate it but still show confirmation.
- Handle long IDs by showing both model and ID in the card state, so the operator can recognise the phone quickly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-701**: Each device card on the dashboard MUST expose a control (button or click area) to mark the device as the active target for modules.
- **FR-702**: The active state MUST be visually distinct (badge, border, etc.) and stored locally (e.g., `localStorage`).
- **FR-703**: Module invocations MUST read the stored `device_id` and include it in backend requests; if no device is selected, execution MUST be blocked with user feedback.
- **FR-704**: When the active device is disconnected, the selection MUST be cleared (and the UI should notify the user).
- **FR-705**: The selection logic MUST be reusable by future modules beyond Call Test.

### Key Entities

- **ActiveDevice**: `{ id: string; model->: string }` â€“ persisted identifier shared between dashboard and modules.
- **DeviceCardState**: UI state describing whether a card is active, inactive, or unavailable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-701**: With â‰¥2 devices connected, 100% of module runs use the device marked active on the dashboard (verified by backend logs).
- **SC-702**: Operators can refresh or navigate away and back without losing the active selection (manual QA).
- **SC-703**: Attempting to run a module without an active device yields a clear error and no backend/API calls (manual or automated test).
- **SC-704**: Device disconnection clears the active selection within one polling cycle (QA script).


## 8. Acceptance Criteria

- The dashboard allows selecting an active device for module execution.
- Module runs use the selected device id consistently.
- The UI communicates the active device clearly.

