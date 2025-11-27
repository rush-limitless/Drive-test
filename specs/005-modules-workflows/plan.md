# Plan — Modules & Workflows Catalogue (Spec 005)

| Phase | Deliverable | Owner | Target |
|-------|-------------|-------|--------|
| P0 | Metadata schema proposal (modules + workflows) | Module Maintainer | 2025-11-06 |
| P1 | Validation script + CLI command `spec:modules` | Backend Tooling | 2025-11-07 |
| P2 | Documentation generator (Markdown/JSON) | Docs Team | 2025-11-08 |
| P3 | Frontend integration (UI uses metadata) | Frontend Team | 2025-11-10 |
| P4 | CI integration + QA signoff | QA Lead | 2025-11-11 |

## Track 1 — Schema & Inventory
- Audit `mon-projet/specs/modules/*.yaml`.
- Define schema fields (`id`, `name`, `description`, `inputs`, `outputs`, `preconditions`, `adb_script`, `tags`).
- Decide on workflow metadata fields (`steps`, `duration`, `dependencies`).

## Track 2 — Tooling
- Create `scripts/spec/check_module_catalog.py`.
- Add `npm run spec:modules` invoking the script.
- Produce JSON/Markdown export (optional CLI flag).

## Track 3 — UI & Docs
- Update frontend to load metadata (maybe via static JSON).
- Generate docs and link from README / docs site.
- Announce process in SDD onboarding documentation.
