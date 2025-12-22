---

description: "Task list for implementing the Smart App Launcher module"

---

# Tasks: Smart App Launcher Module

**Input**: Specification & implementation plan from `/specs/015-app-launcher/`
**Prerequisites**: `spec.md`, `plan.md` (already created)
**Tests**: Manual verification via the Modules dashboard + `npm run spec:check`

## Phase 3: User Story 1 - Launch a data generation app (Priority: P1)

**Goal**: Add the new `launch_app` backend module that drives Google or YouTube via adb intents.

**Independent Test**: Execute `launch_app` with both `app=google` and `app=youtube` and verify success/ error responses and intent values.

- [ ] T001 [US1] Extend `backend/api/modules.py` to introduce the `launch_app` entry in `legacy_modules_db` and declare it as `device_required`.
- [ ] T002 [US1] Add `launch_app` to `DEVICE_REQUIRED_MODULES` and route execution to the TelcoModules helper with the `app` parameter.
- [ ] T003 [US1] In `backend/modules/telco_modules.py`, add `launch_app` logic: pick a random video ID/query list, send the correct adb intent, and return the structured response with `already_on`/`already_off` flags plus the chosen URL.
- [ ] T004 [US1] Document the allowed `app` values and sample video/query lists in code comments (and optionally update docs if needed).

## Phase 4: User Story 2 - Configuration accessible via l'Ã©diteur (Priority: P2)

**Goal**: Let operators choose the target app from the dashboard editor; persist the choice in UI state and send it on execution.

**Independent Test**: Open the module editor for Smart App Launcher, switch between Google and YouTube, save, then run the module and observe the chosen app launching.

- [x] T00A [US2] Extend the dialog to capture a duration (seconds) setting, persist it in localStorage, and display it under the module card.
- [x] T00B [US2] Validate the duration input (positive integer) and ensure `appLauncherDuration` is included in the payload when running the module.

- [ ] T005 [US2] Add the Smart App Launcher entry to `frontend/src/data/modules.ts` with `editable: true` and a descriptive category/text.
- [ ] T006 [US2] Extend `frontend/src/pages/TestModules.tsx`:
  - Maintain `appLauncherSelection` state and storage for the chosen target.
  - Add a dedicated `Dialog` that opens when the module's *Edit* button is clicked and lets the user pick Google or YouTube.
  - Ensure the dialog describes the randomized behavior and updates the UI badge to indicate the active app.
- [ ] T007 [US2] When `runDeviceModule` hits `launch_app`, include the selected `app` parameter in the request payload so the backend knows which intent to send.

## Phase 5: User Story 3 - Feedback clair (Priority: P3)

**Goal**: Surface backend hints (`already_on`) so repeated executions yield clear messaging.

**Independent Test**: Run the module twice consecutively with the same app and confirm the UI snackbar reports "already in desired state" after the second run.

- [ ] T008 [US3] Ensure `TelcoModules.launch_app` sets `already_on`/`already_off` in its response when the requested app is already running, and map that data to snackbar text in `runDeviceModule` (already handled for other fields).
- [ ] T009 [US3] Add a manual QA step: run the module twice (YouTube or Google) and check that the backend response + snackbar mention the repeated state.

## Phase N: Polish & Cross-Cutting Concerns

- [ ] T010 [P] Add or update any necessary docs (specifies, release notes, README) that mention the new module.
- [ ] T011 [P] Run `npm run spec:check` to validate the triad of spec/plan/tasks and ensure compliance with Spec Kit.

