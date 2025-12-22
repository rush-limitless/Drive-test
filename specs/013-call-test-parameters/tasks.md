# Tasks â€” Spec 013 Call Test Parameter Prompt

## UI & State

- [ ] CrÃ©er le composant `CallTestDialog` avec validation (indicatif, numÃ©ro, durÃ©e, appels).
- [ ] Injecter la modale dans `TestModules.tsx` (modes Run/Edit, Ã©tat partagÃ©).
- [ ] Persistant les paramÃ¨tres dans `localStorage` avec valeurs par dÃ©faut sÃ»res.

## ExÃ©cution & Feedback

- [ ] Ã‰tendre le systÃ¨me de snackbar pour supporter la sÃ©vÃ©ritÃ© `error` et messages contextualisÃ©s.
- [ ] Brancher lâ€™action Â«â€¯Runâ€¯Â» sur lâ€™exÃ©cution (IPC ou fallback) en transmettant `number`, `duration`, `call_count`.
- [ ] Documenter la gestion des erreurs (absence backend, validation) dans le code.

## VÃ©rification

- [ ] Tester manuellement : rÃ©ussite avec valeurs valides, blocage validation, Ã©dition sans exÃ©cution.
- [ ] VÃ©rifier la persistance aprÃ¨s rafraÃ®chissement + relancement Electron.

