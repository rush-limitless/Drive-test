RELEASE NOTES – MOBIQ v2.3.5
Date: 02 février 2026
Type: Build complet (Electron + Backend + ADB intégré)

Résumé
Ce build consolide les workflows, corrige plusieurs modules clés (APN, Smart App Launcher, RF logging), améliore la gestion des appareils et rend la version cohérente partout (app, setup, dashboard) avec mise à jour automatique à chaque build.

Nouveautés & améliorations majeures
1) Gestion de version unifiée et automatique
- La version affichée dans l’app, le setup et le dashboard est désormais synchronisée automatiquement.
- À chaque build, la version est incrémentée et propagée partout (frontend, backend, Electron, écran d’installation).

2) Workflows – Export / Import
- Ajout de l’export des workflows créés.
- Import possible sur une autre machine pour réutiliser un workflow.

3) Édition cohérente des modules en “Edit Workflow”
- Tous les modules éditables dans “Modules” le sont aussi dans “Edit Workflow”.
- Synchronisation des valeurs entre création et édition de workflow.

4) RF Logging – Possibilité d’arrêt/restart
- Possibilité de stopper / relancer des actions longues (ex: Start RF Logging).
- Endpoints backend ajoutés pour la gestion d’annulation.

5) Notifications plus visibles
- Notifications plus marquées, plus faciles à remarquer.
- Durée d’affichage améliorée.

Corrections détaillées
Modules et exécution
- Dial USSD Code
  - La valeur saisie est correctement conservée dans un workflow.
  - Le module devient éditable dans Edit Workflow.
  - Validation stricte: n’accepte que chiffres + “*” + “#”.
- Waiting Time
  - Correction des valeurs négatives en édition.
  - La valeur saisie est prise en compte correctement.
- Smart App Launcher
  - Respect de la durée définie dans les workflows (et non la valeur par défaut).
  - Chrome lancé plus fiablement (fallback si nécessaire).
- Change APN
  - Correction du problème de 2e exécution qui redirigeait vers un mauvais écran.
  - Meilleure robustesse en multi-devices.

Workflows & UI
- Suppression du filtre “All tags” dans le menu workflows.
- Export/Import workflows ajouté dans le menu.

Device Manager
- Correction des boutons Refresh / Add Device.
- Les appareils non connectés sont désactivés (non cliquables).
- Nettoyage d’états incohérents d’actions disponibles.

Backend / API
- Route d’annulation RF logging ajoutée.
- Exécution des modules dans les workflows alignée sur les paramètres définis.
- Chargement backend plus robuste si PYTHONPATH absent (évite “ModuleNotFoundError: src”).

Stabilité & build
- ADB inclus et vérifié dans l’installeur final.
- Processus de build fiable avec vérification automatique des dépendances.

Tests exécutés
- Frontend: vitest run
- Electron: vitest run
- Backend: pytest
Résultat: OK (tous tests passent)

Fichiers livrés
- Setup Windows: MOBIQ-Setup-2.3.5.exe
- ADB inclus dans l’installateur

Limitations / points connus
- Avertissement PyInstaller sur “Foreign Python environment” (build toujours OK).
- Avertissements Vite sur la taille des chunks.
- Certaines fonctions RF/logs peuvent dépendre du firmware exact des appareils.
