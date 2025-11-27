# Specification — Modules & Workflows Catalogue

**Spec ID**: `005-modules-workflows`  
**Maintainer**: Automation Modules Team  
**Last Updated**: 2025-11-04  
**Status**: Draft  

---

## 1. Background & Context

The Telco Automation platform ships with 29 ADB modules and a set of YAML workflows that orchestrate test sequences (daily smoke, network stress, etc.). These artefacts are the core delivery for QA operators, yet their definitions live in disparate YAML files without a canonical reference or validation.

The lack of formal documentation causes:
- divergence between module implementation and documentation;
- missing parameter validation, leading to runtime errors;
- difficulty for new engineers to understand available actions;
- duplication when creating new workflows.

This spec defines the catalogue of modules/workflows, documents inputs/outputs, and introduces validation tooling so modules stay consistent with their declared behaviour.

---

## 2. Problem Statement

Without a single source of truth:
- Operators run workflows with invalid parameters and discover issues late.
- The React UI cannot display contextual help or validation hints.
- Backend changes may break workflows silently.

We need a structured registry describing each module/workflow, together with schema validation and documentation automation.

---

## 3. Goals & Non Goals

### Goals
- Provide machine-readable metadata for every module and workflow (inputs, defaults, pre/post conditions).
- Validate YAML specs via automated lint/test command.
- Generate developer/operator documentation from the registry.
- Ensure the UI can consume the metadata to surface contextual info.

### Non Goals
- Redesigning workflows or modules themselves (functional behaviour stays the same).
- Building a full graphical editor (tracked separately).
- Implementing runtime scheduling changes beyond validation hooks.

---

## 4. Stakeholders

| Role | Responsibility | Contact |
|------|----------------|---------|
| Module Maintainer | Keeps module definitions & ADB scripts aligned with metadata | modules@example.com |
| Frontend Lead | Consumes metadata to render UI hints & forms | frontend@example.com |
| QA Lead | Validates workflow definitions & acceptance tests | qa@example.com |
| Spec Champion | Oversees Spec Kit process | spec-champion@example.com |

---

## 5. Personas & User Stories

### Persona: Test Engineer
- Needs a searchable catalogue of modules with parameters & preconditions.

### Persona: Workflow Designer
- Wants to assemble workflows by reusing validated modules.

### User Story 1 — Module Metadata
**As** a test engineer  
**I want** module definitions with inputs, defaults, and expected results  
**So that** I can configure tests without hunting through code.

### User Story 2 — Workflow Validation
**As** a workflow designer  
**I want** validation tooling for YAML workflows  
**So that** mistakes are caught before execution.

### User Story 3 — Documentation Generation
**As** a spec champion  
**I want** docs generated automatically from module/workflow metadata  
**So that** documentation stays up-to-date when modules evolve.

---

## 6. Functional Requirements

| ID | Requirement | Notes |
|----|-------------|-------|
| FR-201 | Define metadata schema (YAML/JSON) for modules (`id`, `description`, `inputs`, `preconditions`, `adb_script`). | Example based on existing YAML. |
| FR-202 | Define metadata schema for workflows (`id`, `steps`, `expected_duration`, `tags`). | Should reference module IDs. |
| FR-203 | Implement validation command `npm run spec:modules` that checks schema compliance and cross-references modules. | Python script similar to spec check. |
| FR-204 | Generate Markdown docs (or a JSON export) enumerating modules & workflows. | Reused by frontend & docs site. |
| FR-205 | UI consumes metadata to display module details and input validation rules. | Backlog item to coordinate with frontend team. |

---

## 7. Non-Functional Requirements

- Metadata definitions versioned (include `version` field, changelog).
- Validation command completes in < 5 seconds on dev machines.
- Errors must be human-readable with hints for remediation.

---

## 8. Acceptance Criteria

| Scenario | Given | When | Then | Verification |
|----------|-------|------|------|--------------|
| AC-201 | Module metadata defined | `npm run spec:modules` runs | Passes with no warnings | CI job |
| AC-202 | YAML missing required field | Validation runs | Fails with explicit error | Unit test |
| AC-203 | Workflow references unknown module | Validation runs | Fails with reference error | Unit test |
| AC-204 | Docs generation command executes | Modules/workflows defined | Markdown/JSON output produced | Manual in initial iteration |
| AC-205 | Frontend selects module | Metadata available | Inputs and descriptions displayed in UI | Manual QA + frontend tests |

---

## 9. Rollout Plan

1. Inventory existing YAML modules/workflows and convert to canonical metadata format (may be the same files with added fields).
2. Implement schema definitions (e.g., via `jsonschema`).
3. Build validation script and CLI hook.
4. Generate documentation artefacts (Markdown, JSON export).
5. Integrate validation into CI and update frontend to consume metadata.
6. Promote spec status to In Review once validation + doc generation merged.

---

## 10. Open Questions

- Should module metadata live next to implementation or in a central registry?
- Do we deprecate any modules/workflows during alignment?
- How to version workflows referencing multiple module versions?

---

## 11. Appendix

- Existing YAML: `mon-projet/specs/modules/*.yaml`.
- Template: `templates/spec-template.md`.

