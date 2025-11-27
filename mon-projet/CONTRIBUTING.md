# Contribuer avec Spec Kit

Ce projet impose le flux Spec Kit : **aucune implémentation n’est acceptée sans trio spec → plan → tasks validé**.

## Étapes obligatoires
1. Créer le dossier `specs/<id>-<slug>/`.
2. Copier les modèles depuis `.specify/templates/` :
   - `spec-template.md` → `spec.md`
   - `plan-template.md` → `plan.md`
   - `tasks-template.md` → `tasks.md`
3. Remplir :
   - `spec.md` : contexte, objectifs, exclusions.
   - `plan.md` : approche technique, archi, risques, tests prévus.
   - `tasks.md` : tâches exécutables, estimations, critères de done.
4. Faire valider ces trois artefacts (relecture/approbation).
5. Exécuter `npm run spec:check` et inclure le résultat dans la PR.
6. Mentionner l’ID de spec dans les commits/PR (template PR : `.github/pull_request_template.md`).

## Branches et cycle de livraison
- Branches autorisées : `feature/<slug>`, `fix/<slug>`, `chore/<slug>`, `refactor/<slug>`, `docs/<slug>`, `release/<version>`. La CI bloque les autres noms.
- Un changement important = une branche dédiée, description claire dans la PR.
- `main` reste stable ; merges via PR uniquement, avec CI verte.
- Release : bumper la version (SemVer), mettre à jour `CHANGELOG.md`, taguer `vX.Y.Z`, puis créer la release GitHub avec les artefacts/builds.

## Règles de PR
- Pas de code sans spec/plan/tasks validés.
- Checkboxes du template PR doivent être cochées (ou justifiées).
- Toute divergence par rapport à la spec doit être notée dans la section “Notes” de la PR et mise à jour dans les artefacts.

## Tests
- Définir la stratégie de test dans `plan.md`.
- Documenter les commandes lancées dans la PR.
- Ajouter/adapter des tests automatisés quand c’est pertinent.

## Outils
- `npm run spec:check` pour valider la structure des dossiers `specs/`.
- `scripts/launch*` pour les flux locaux (backend/frontend/Electron).
- `adb devices` pour vérifier les terminaux utilisés par les modules.
