# Plan — Call Test Parameter Prompt (Spec 013)

| Phase | Deliverable | Owner | Target |
|-------|-------------|-------|--------|
| P0 | Confirmer le flux actuel (Electron vs backend) et les contraintes de validation | Frontend | 2025-11-05 |
| P1 | Implémenter la modale de paramètres + persistance locale | Frontend | 2025-11-06 |
| P2 | Brancher l’action « Run » sur l’exécution (IPC Electron ou API backend) et messages UI | Frontend | 2025-11-06 |
| P3 | QA manuelle (états nominal, erreurs de validation, absence backend) | QA | 2025-11-07 |

## Workstream 1 — Analyse & Validation
- Cartographier le comportement existant de `TestModules.tsx` (snackbar, `electronAPI`, fallback).
- Décider du canal d’exécution (IPC `runScript` si dispo, sinon POST `/api/modules/voice_call_test/execute`).
- Définir les valeurs par défaut (indicatif `+33`, durée `30`, répétitions `1`).

## Workstream 2 — Implémentation UI
- Créer un composant `CallTestDialog` (MUI) avec gestion d’état locale et validation.
- Ajouter l’état parent dans `TestModules.tsx` pour ouvrir la modale en mode Run/Edit.
- Normaliser et sérialiser les paramètres dans `localStorage` (`callTestParams`).

## Workstream 3 — Exécution & Feedback
- Couper `ELECTRON_RUN_AS_NODE` avant lancement via Electron (documentation interne).
- Implémenter la concaténation numéro complet + envoi au backend/IPC.
- Étendre le système de snackbar pour gérer les niveaux `success`, `info`, `error`.
- Rédiger les instructions de test manuel (Run réussi, validation bloquée, absence backend).
