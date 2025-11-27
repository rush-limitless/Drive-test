# Implementation Plan: Robustesse modules RF/SilentLog

**Branch**: `chore/ci-governance` | **Date**: 2024-07-01 | **Spec**: specs/023-rf-robustness/spec.md

## Summary
Rendre `start_rf_logging` et `stop_rf_logging` plus explicites : état confirmé ou indéterminé, warning, vérification minimale (ls /sdcard/log) et tests pour couvrir succès/unknown/échec.

## Technical Context
Python/FastAPI, modules ADB existants. Pas de nouvelle dépendance.

## Tasks
- Ajuster `telco_modules.py` pour retourner `state_confirmed`, `warning`, et ne pas signaler success si aucune confirmation.
- Vérification basique post-exécution (ls /sdcard/log), fallback à status `unknown` si non concluante.
- Tests pytest couvrant success/unknown/échec.
