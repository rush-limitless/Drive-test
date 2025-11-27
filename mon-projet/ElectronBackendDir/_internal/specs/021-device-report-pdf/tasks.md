---

description: "Device Manager PDF reports"

---

# Tasks: Device Manager PDF Reports

**Input**: Design documents from `/specs/021-device-report-pdf/`
**Prerequisites**: plan.md, spec.md

## Phase 1: Backend

- [ ] T001 [US1] Ajouter dépendance ReportLab dans `src/backend/requirements.txt`.
- [ ] T002 [US1] Implémenter l’endpoint GET `/api/v1/devices/{id}/report` (validation from/to, période max, 404 device, 400 dates invalides).
- [ ] T003 [US1] Générer le PDF en mémoire (infos device + résumé logs filtrés, max 200, mention tronqué) et renvoyer `application/pdf` avec Content-Disposition + logging d’usage.

## Phase 2: Tests backend

- [ ] T004 [US1] Ajouter tests pytest pour l’endpoint (200 avec PDF non vide, 400 dates invalides, 404 device).

## Phase 3: Frontend

- [ ] T005 [US2] Étendre `deviceApi` avec `downloadDeviceReport(deviceId, from, to, baseUrl)` (blob download, nom de fichier).
- [ ] T006 [US2] Ajouter UI dans Device Manager : sélection de période (presets + date-time), feedback téléchargement, bouton “Télécharger PDF” par device, et action batch multi-device (séquentiel).
- [ ] T007 [US2] (optionnel si infra) Test unitaire frontend pour la fonction de téléchargement (mock fetch) ou stub simple.

## Phase 4: Build & Validation

- [ ] T008 [US2] Exécuter `python -m pytest` (backend) et `npm run build:electron` (frontend) avant livraison et consigner les résultats.
