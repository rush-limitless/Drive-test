# Plan â€” Call Test Parameter Prompt (Spec 013)

| Phase | Deliverable | Owner | Target |
|-------|-------------|-------|--------|
| P0 | Confirmer le flux actuel (Electron vs backend) et les contraintes de validation | Frontend | 2025-11-05 |
| P1 | ImplÃ©menter la modale de paramÃ¨tres + persistance locale | Frontend | 2025-11-06 |
| P2 | Brancher lâ€™action Â«â€¯Runâ€¯Â» sur lâ€™exÃ©cution (IPC Electron ou API backend) et messages UI | Frontend | 2025-11-06 |
| P3 | QA manuelle (Ã©tats nominal, erreurs de validation, absence backend) | QA | 2025-11-07 |

## Workstream 1 â€” Analyse & Validation

- Cartographier le comportement existant de `TestModules.tsx` (snackbar, `electronAPI`, fallback).
- DÃ©cider du canal dâ€™exÃ©cution (IPC `runScript` si dispo, sinon POST `/api/modules/voice_call_test/execute`).
- DÃ©finir les valeurs par dÃ©faut (indicatif `+33`, durÃ©e `30`, rÃ©pÃ©titions `1`).

## Workstream 2 â€” ImplÃ©mentation UI

- CrÃ©er un composant `CallTestDialog` (MUI) avec gestion dâ€™Ã©tat locale et validation.
- Ajouter lâ€™Ã©tat parent dans `TestModules.tsx` pour ouvrir la modale en mode Run/Edit.
- Normaliser et sÃ©rialiser les paramÃ¨tres dans `localStorage` (`callTestParams`).

## Workstream 3 â€” ExÃ©cution & Feedback

- Couper `ELECTRON_RUN_AS_NODE` avant lancement via Electron (documentation interne).
- ImplÃ©menter la concatÃ©nation numÃ©ro complet + envoi au backend/IPC.
- Ã‰tendre le systÃ¨me de snackbar pour gÃ©rer les niveaux `success`, `info`, `error`.
- RÃ©diger les instructions de test manuel (Run rÃ©ussi, validation bloquÃ©e, absence backend).

