# Plan - Spec 000 Gouvernance Spec Kit

## Approche
- Documenter et imposer le flux Spec Kit dans le dépôt (README, CONTRIBUTING, template PR).
- Ajouter un contrôle automatisé : script Node léger (`scripts/spec-check.js`) et script npm `spec:check`.
- Créer un dossier de référence `specs/000-governance/` avec le triptyque complet.

## Architecture / Livrables
- Docs : mise à jour README, nouveau CONTRIBUTING, PR template.
- Tooling : `scripts/spec-check.js`, script npm `spec:check`.
- Artefacts : `specs/000-governance/{spec.md,plan.md,tasks.md}`.

## Risques
- Divergence avec l’outil `specify` s’il est utilisé : le check est volontairement minimaliste (présence et non-vide).
- Utilisateurs contournant le check : couvert par le template PR et la règle de revue.

## Tests prévus
- `npm run spec:check` doit passer et lister les dossiers valides.
- Vérifier manuellement que les docs mentionnent les emplacements templates et le flux.
