# Implementation Plan: Nettoyage warnings et test frontend

**Branch**: `chore/ci-governance` | **Date**: 2024-07-01 | **Spec**: specs/024-warning-cleanup/spec.md

## Summary
Supprimer les warnings `datetime.utcnow`, SQLAlchemy `declarative_base` déprécié, et ajouter un test frontend mock fetch (si possible) pour `downloadDeviceReport`.

## Tasks (voir tasks.md)
- Remplacer `utcnow` ciblés par `datetime.now(timezone.utc)` dans API/tests concernés.
- Mettre à jour l’import `declarative_base` (sqlalchemy.orm).
- Ajuster tests backend pour nouvelles dates.
- Ajouter test frontend (mock fetch) si infra prête.
