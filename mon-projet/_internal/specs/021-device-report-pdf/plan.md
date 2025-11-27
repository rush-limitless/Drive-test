# Implementation Plan: Device Manager PDF Reports

**Branch**: `chore/ci-governance` | **Date**: 2024-07-01 | **Spec**: specs/021-device-report-pdf/spec.md  
**Input**: Feature specification from `/specs/021-device-report-pdf/spec.md`

## Summary

Exposer un endpoint backend pour générer un PDF par device sur une période (from/to), et ajouter dans l’UI Device Manager un bouton de téléchargement avec sélection de période. PDF minimaliste via ReportLab (dépendance légère) en mémoire. Validation des dates et erreurs explicites.

## Technical Context

**Language/Version**: Python 3.12 (FastAPI), Node 20/React  
**Primary Dependencies**: FastAPI, ReportLab (nouvelle), React/MUI  
**Storage**: Logs devices via DeviceLog (DB)  
**Testing**: pytest (backend), npm build (frontend)  
**Target Platform**: Linux/WSL, CI GitHub Actions  
**Constraints**: Pas de dépendances natives complexes; PDF généré en mémoire; limiter la période (ex. 90 jours) et la quantité de logs.

## Constitution Check

Spec/plan/tasks présents; PR devra référencer l’ID 021 et passer `spec:check`.

## Project Structure

```text
mon-projet/
├── src/backend/api/devices.py           # Endpoint report
├── src/backend/services/...(device_manager) # Source données logs/device
├── src/backend/tests/                   # pytest pour l’endpoint
├── src/frontend/src/services/deviceApi.ts   # appel download PDF
├── src/frontend/src/components/DeviceManager/DeviceManager.tsx # UI bouton/période
└── specs/021-device-report-pdf/         # spec/plan/tasks
```

**Structure Decision**: Ajouter la logique PDF dans l’API (helper interne) pour limiter la surface; pas de module séparé si inutile.

## Complexity Tracking

N/A.
