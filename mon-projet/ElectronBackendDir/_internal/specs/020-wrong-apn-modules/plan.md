# Implementation Plan: Wrong APN & RF Logging Modules

**Branch**: `chore/ci-governance` | **Date**: 2024-07-01 | **Spec**: specs/020-wrong-apn-modules/spec.md  
**Input**: Feature specification from `/specs/020-wrong-apn-modules/spec.md`

## Summary

Ajouter 6 modules ADB orientés test RF/APN dans le backend (TelcoModules + FlowExecutor) et les exposer via l’API/workflows + catalogue frontend : appliquer un APN erroné, basculer le mode avion, démarrer/arrêter le logging RF (best-effort SysDump), tester la connectivité data et rapatrier les logs. Approche : implémenter des méthodes dédiées dans `telco_modules.py`, mapper dans `flow_executor.py`, ajouter les métadonnées frontend, et couvrir par des tests pytest (mocks ADB).

## Technical Context

**Language/Version**: Python 3.12 (backend), Node 20 (frontend)  
**Primary Dependencies**: FastAPI, pytest, React/TS (frontend)  
**Storage**: Fichiers JSON pour workflows (local)  
**Testing**: pytest (backend), npm build (frontend)  
**Target Platform**: Linux/WSL pour build et CI GitHub Actions  
**Project Type**: Web app (backend FastAPI + frontend React/Electron)  
**Performance Goals**: N/A (scripts ADB best-effort)  
**Constraints**: Éviter crash si ADB absent; retours explicites; normalisation chemins Windows/Linux  
**Scale/Scope**: Modules additionnels sur pipeline existant

## Constitution Check

Respect des règles Spec Kit : spec/plan/tasks, PR template, spec:check dans CI.

## Project Structure

### Documentation (feature)

```text
specs/020-wrong-apn-modules/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
mon-projet/
├── src/backend/api/               # Routes FastAPI
├── src/backend/modules/           # TelcoModules, FlowExecutor (à étendre)
├── src/backend/tests/             # pytest (ajout tests modules/workflows)
├── src/frontend/src/data/         # MODULE_CATALOG (ajouts UI)
└── .github/workflows/             # CI (déjà en place)
```

**Structure Decision**: Web app backend/frontend avec modules ADB dans `src/backend/modules/` et métadonnées UI dans `src/frontend/src/data/modules.ts`.

## Complexity Tracking

N/A (pas de violation identifiée).
