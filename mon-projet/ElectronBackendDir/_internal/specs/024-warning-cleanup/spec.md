# Feature Specification: Nettoyage warnings (utcnow/pydantic/sqlalchemy) + test frontend download

**Feature Branch**: `chore/ci-governance`  
**Created**: 2024-07-01  
**Status**: Draft  
**Input**: « Réduire les warnings `utcnow`, SQLAlchemy, pydantic, et ajouter un test frontend de download si possible »

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Timestamps TZ-aware (Priority: P1)
En tant que dev, je veux éliminer les warnings `datetime.utcnow()` pour avoir des logs/tests propres.

**Independent Test**: Exécution pytest sans warnings `utcnow`.

### User Story 2 - SQLAlchemy warning (Priority: P2)
En tant que dev, je veux supprimer l’avertissement `declarative_base` déprécié.

**Independent Test**: pytest sans warning SQLAlchemy 2.0.

### User Story 3 - Test frontend minimal (Priority: P3)
En tant que dev, je veux un test unitaire simple du helper `downloadDeviceReport` (mock fetch) si l’infra le permet.

**Independent Test**: test JS/TS qui mock fetch et vérifie l’appel et le filename.

### Edge Cases
- Compatibilité SQLAlchemy existante.
- Environnement sans infra de test frontend : test optionnel/stub.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: Remplacer les usages `datetime.utcnow` concernés par des timestamps tz-aware (utc).
- **FR-002**: Remplacer l’import `declarative_base` déprécié par l’API SQLAlchemy 2.0.
- **FR-003**: Ajouter/supprimer les warnings observés dans pytest.
- **FR-004**: (Optionnel) Ajouter un test frontend mock fetch pour `downloadDeviceReport` si supporté.

## Success Criteria *(mandatory)*
- **SC-001**: pytest ne remonte plus les warnings `utcnow`.
- **SC-002**: Warning `declarative_base` absent.
- **SC-003**: CI backend et build frontend toujours verts.  
