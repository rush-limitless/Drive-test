---

description: "Modules ADB Wrong APN & RF logging"

---

# Tasks: Wrong APN & RF Logging Modules

**Input**: Design documents from `/specs/020-wrong-apn-modules/`  
**Prerequisites**: plan.md, spec.md

## Phase 1: Foundational

- [ ] T001 [US1] Ajouter méthodes ADB dans `src/backend/modules/telco_modules.py` : start_rf_logging, stop_rf_logging, test_data_connection, pull_rf_logs, wrapper toggle_airplane_mode (réutilisation), validation apn.
- [ ] T002 [US1] Mapper les modules dans `src/backend/modules/flow_executor.py` (id + params) avec retours structurés.
- [ ] T003 [US1] Exposer les modules dans l’API workflows si nécessaire (réutilisation route existante).

## Phase 2: Catalogue Frontend

- [ ] T004 [US1] Ajouter les 6 modules au `MODULE_CATALOG` (`src/frontend/src/data/modules.ts`) avec descriptions/catégories.

## Phase 3: Tests backend

- [ ] T005 [US1] Créer des tests pytest (mocks ADB) couvrant au moins un happy-path par module dans `src/backend/tests/` (nouveau fichier).

## Phase 4: Build & Validation

- [ ] T006 [US1] Exécuter `python -m pytest` (backend) et `npm run build:electron` (frontend) avant livraison.
- [ ] T007 [US1] Mettre à jour changelog interne (si applicable) et préparer la PR avec résultats de tests.
