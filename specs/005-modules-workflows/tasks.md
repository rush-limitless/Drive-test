# Tasks — Spec 005 Modules & Workflows Catalogue

## Metadata & Schema
- [ ] Inventory existing module YAML files and capture fields.
- [ ] Design JSON Schema (or Pydantic models) for modules.
- [ ] Design JSON Schema for workflows referencing modules.

## Validation Tooling
- [ ] Implement `scripts/spec/check_module_catalog.py`.
- [ ] Add `npm run spec:modules` command and CI job.
- [ ] Write unit tests for validation edge cases.

## Documentation & UI
- [ ] Generate Markdown/JSON catalogue for docs.
- [ ] Update README/docs with reference to catalogue.
- [ ] Update frontend to display module metadata & validate inputs.

## Governance
- [ ] Link commits/PRs to spec `005`.
- [ ] Run `npm run spec:check` and `npm run spec:modules` before merge.
- [ ] Promote spec status once validation tooling + docs shipped.
