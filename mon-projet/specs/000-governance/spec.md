# Spec 000 - Gouvernance Spec Kit

## Contexte
- Le projet Telco ADB Automation doit appliquer la méthodologie Spec Kit pour toute évolution.
- Les artefacts existants étaient incomplets (absence de spec/plan/tasks formalisés).

## Objectifs
- Instituer le triptyque `spec.md` / `plan.md` / `tasks.md` comme prérequis à toute implémentation.
- Documenter les templates à utiliser et le circuit de validation.
- Intégrer un contrôle automatisé (`npm run spec:check`) dans le flux local/PR.

## Portée
- Processus de contribution et garde-fous (PR template, README, CONTRIBUTING).
- Script de vérification des specs.

## Hors portée
- Refactoring fonctionnel des modules ADB.
- Évolutions produit : nécessitent leurs propres specs dédiées.

## Contraintes
- ASCII uniquement.
- Fonctionne sur Windows/PowerShell et environnement Node local.

## Acceptation
- Existence du script `npm run spec:check` et d’au moins un dossier `specs/<id>-<slug>/` complet.
- README/CONTRIBUTING décrivent le flux Spec Kit et l’obligation de validation.
- PR template impose la référence de spec et les validations.
