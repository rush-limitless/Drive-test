# Tasks — Spec 013 Call Test Parameter Prompt

## UI & State
- [ ] Créer le composant `CallTestDialog` avec validation (indicatif, numéro, durée, appels).
- [ ] Injecter la modale dans `TestModules.tsx` (modes Run/Edit, état partagé).
- [ ] Persistant les paramètres dans `localStorage` avec valeurs par défaut sûres.

## Exécution & Feedback
- [ ] Étendre le système de snackbar pour supporter la sévérité `error` et messages contextualisés.
- [ ] Brancher l’action « Run » sur l’exécution (IPC ou fallback) en transmettant `number`, `duration`, `call_count`.
- [ ] Documenter la gestion des erreurs (absence backend, validation) dans le code.

## Vérification
- [ ] Tester manuellement : réussite avec valeurs valides, blocage validation, édition sans exécution.
- [ ] Vérifier la persistance après rafraîchissement + relancement Electron.
