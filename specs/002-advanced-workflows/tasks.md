# Tasks: Advanced Telco Workflow Management

**Input**: Design documents from `/specs/002-advanced-workflows/`
**Prerequisites**: spec.md (required for user stories)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create workflow management directory structure in `src/backend/workflows/`
- [ ] T002 Install required dependencies: `simpleeval`, `APScheduler`, `asyncio-mqtt`
- [ ] T003 [P] Configure workflow validation schemas in `src/backend/schemas/workflow_schemas.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create workflow database models in `src/backend/models/workflow_models.py`
- [ ] T005 [P] Setup workflow API router structure in `src/backend/api/workflows.py`
- [ ] T006 [P] Create base workflow engine in `src/backend/workflows/engine.py`
- [ ] T007 Create workflow validation service in `src/backend/workflows/validator.py`
- [ ] T008 Setup workflow execution context in `src/backend/workflows/context.py`
- [ ] T009 Configure workflow storage and persistence layer

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Création Visuelle de Workflows (Priority: P1) 🎯 MVP

**Goal**: Éditeur drag-and-drop fonctionnel permettant de créer et sauvegarder des workflows visuels

**Independent Test**: Créer un workflow simple (Airplane Mode Enable → Network Check → Airplane Mode Disable) via l'interface et le sauvegarder avec succès

### Backend for User Story 1

- [ ] T010 [P] [US1] Create Workflow CRUD endpoints in `src/backend/api/workflows.py`
  - POST /workflows (create)
  - GET /workflows (list)
  - GET /workflows/{id} (get)
  - PUT /workflows/{id} (update)
  - DELETE /workflows/{id} (delete)
- [ ] T011 [P] [US1] Create WorkflowVersion model in `src/backend/models/workflow_models.py`
- [ ] T012 [US1] Implement workflow JSON schema validation in `src/backend/workflows/validator.py`
- [ ] T013 [US1] Add workflow persistence service in `src/backend/workflows/storage.py`

### Frontend for User Story 1

- [ ] T014 [P] [US1] Create React Flow canvas component in `src/frontend/src/components/WorkflowEditor/Canvas.tsx`
- [ ] T015 [P] [US1] Create module palette component in `src/frontend/src/components/WorkflowEditor/ModulePalette.tsx`
- [ ] T016 [US1] Implement drag-and-drop functionality in `src/frontend/src/components/WorkflowEditor/DragDrop.tsx`
- [ ] T017 [US1] Create workflow save/load functionality in `src/frontend/src/services/workflowService.ts`
- [ ] T018 [US1] Add workflow editor main component in `src/frontend/src/components/WorkflowEditor/WorkflowEditor.tsx`

**Checkpoint**: At this point, User Story 1 should be fully functional - users can create, edit, and save workflows visually

---

## Phase 4: User Story 2 - Conditions Logiques et Branchements (Priority: P2)

**Goal**: Système de conditions if/else permettant des branchements dynamiques dans les workflows

**Independent Test**: Créer un workflow avec condition "Si test réseau échoue, redémarrer device" et vérifier l'exécution du bon chemin

### Backend for User Story 2

- [ ] T019 [P] [US2] Create condition evaluator in `src/backend/workflows/evaluator.py`
- [ ] T020 [P] [US2] Add condition node types to workflow schema in `src/backend/schemas/workflow_schemas.py`
- [ ] T021 [US2] Implement condition execution logic in `src/backend/workflows/engine.py`
- [ ] T022 [US2] Add condition validation in `src/backend/workflows/validator.py`

### Frontend for User Story 2

- [ ] T023 [P] [US2] Create condition node component in `src/frontend/src/components/WorkflowEditor/nodes/ConditionNode.tsx`
- [ ] T024 [P] [US2] Add condition expression editor in `src/frontend/src/components/WorkflowEditor/ConditionEditor.tsx`
- [ ] T025 [US2] Implement branching visualization in canvas
- [ ] T026 [US2] Add condition testing/preview functionality

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - workflows with conditions can be created and executed

---

## Phase 5: User Story 3 - Planification et Exécution Automatique (Priority: P2)

**Goal**: Système de planification permettant l'exécution automatique de workflows selon des déclencheurs

**Independent Test**: Programmer un workflow pour s'exécuter toutes les 5 minutes et vérifier les exécutions automatiques

### Backend for User Story 3

- [ ] T027 [P] [US3] Setup APScheduler integration in `src/backend/workflows/scheduler.py`
- [ ] T028 [P] [US3] Create schedule management endpoints in `src/backend/api/schedules.py`
- [ ] T029 [US3] Implement workflow execution queue in `src/backend/workflows/executor.py`
- [ ] T030 [US3] Add schedule persistence in `src/backend/models/schedule_models.py`
- [ ] T031 [US3] Create workflow run tracking in `src/backend/models/run_models.py`

### Frontend for User Story 3

- [ ] T032 [P] [US3] Create schedule configuration component in `src/frontend/src/components/Scheduler/ScheduleConfig.tsx`
- [ ] T033 [P] [US3] Add execution monitoring dashboard in `src/frontend/src/components/Scheduler/ExecutionMonitor.tsx`
- [ ] T034 [US3] Implement real-time execution updates via WebSocket
- [ ] T035 [US3] Add schedule management interface

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work independently - workflows can be scheduled and executed automatically

---

## Phase 6: User Story 4 - Templates et Bibliothèque de Workflows (Priority: P3)

**Goal**: Système de templates réutilisables et bibliothèque de workflows pré-construits

**Independent Test**: Créer un template "Test Connectivité", l'utiliser pour générer un nouveau workflow, et vérifier la configuration

### Backend for User Story 4

- [ ] T036 [P] [US4] Create template model in `src/backend/models/template_models.py`
- [ ] T037 [P] [US4] Add template CRUD endpoints in `src/backend/api/templates.py`
- [ ] T038 [US4] Implement template instantiation logic in `src/backend/workflows/template_engine.py`
- [ ] T039 [US4] Create pre-built workflow library in `src/backend/workflows/library.py`
- [ ] T040 [US4] Add workflow import/export functionality

### Frontend for User Story 4

- [ ] T041 [P] [US4] Create template browser component in `src/frontend/src/components/Templates/TemplateBrowser.tsx`
- [ ] T042 [P] [US4] Add template creation interface in `src/frontend/src/components/Templates/TemplateCreator.tsx`
- [ ] T043 [US4] Implement template parameter configuration
- [ ] T044 [US4] Add workflow library integration to editor

**Checkpoint**: All user stories should now be independently functional - complete workflow management system

---

## Phase 7: Execution Engine & Real-time Features

**Purpose**: Core execution capabilities that span multiple user stories

- [ ] T045 [P] Create workflow execution engine in `src/backend/workflows/execution_engine.py`
- [ ] T046 [P] Add real-time WebSocket support in `src/backend/api/websockets.py`
- [ ] T047 Add device locking mechanism in `src/backend/workflows/device_manager.py`
- [ ] T048 Implement execution logging and artifacts storage
- [ ] T049 [P] Create execution monitoring frontend in `src/frontend/src/components/Execution/ExecutionMonitor.tsx`

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T050 [P] Add comprehensive error handling across all workflow components
- [ ] T051 [P] Implement workflow validation with cycle detection
- [ ] T052 Add execution quotas and rate limiting
- [ ] T053 Create workflow documentation and user guide
- [ ] T054 [P] Add workflow performance metrics and monitoring
- [ ] T055 Security hardening for workflow execution
- [ ] T056 Add workflow backup and restore functionality

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P2 → P3)
- **Execution Engine (Phase 7)**: Can start after Phase 2, integrates with all user stories
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational - Extends US1 but independently testable
- **User Story 3 (P2)**: Can start after Foundational - Uses US1 workflows but independently testable  
- **User Story 4 (P3)**: Can start after Foundational - Uses US1 workflows but independently testable

### Parallel Opportunities

- All tasks marked [P] within each phase can run in parallel
- Once Foundational phase completes, all user stories can start in parallel
- Backend and Frontend tasks for same user story can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test workflow creation independently
5. Deploy/demo basic workflow editor

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy (MVP!)
3. Add User Story 2 → Test conditions → Deploy
4. Add User Story 3 → Test scheduling → Deploy  
5. Add User Story 4 → Test templates → Deploy
6. Each story adds value without breaking previous functionality

---

## Acceptance Criteria Summary

### User Story 1 (P1) - Création Visuelle
- ✅ Drag-and-drop modules from palette to canvas
- ✅ Connect modules with visual links
- ✅ Save and reload workflows
- ✅ Workflow appears in workflow list

### User Story 2 (P2) - Conditions Logiques  
- ✅ Add IF condition blocks to workflows
- ✅ Configure conditions based on previous results
- ✅ Execution follows correct branch (True/False)
- ✅ Condition validation prevents errors

### User Story 3 (P2) - Planification
- ✅ Schedule workflows (daily, weekly, custom cron)
- ✅ Automatic execution at scheduled times
- ✅ Real-time execution monitoring
- ✅ Start/stop scheduled executions

### User Story 4 (P3) - Templates
- ✅ Save workflows as reusable templates
- ✅ Browse template library
- ✅ Instantiate templates with custom parameters
- ✅ Import/export workflows between systems