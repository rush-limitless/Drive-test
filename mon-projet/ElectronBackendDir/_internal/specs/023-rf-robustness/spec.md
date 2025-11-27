# Feature Specification: Robustesse modules RF/SilentLog

**Feature Branch**: `chore/ci-governance`  
**Created**: 2024-07-01  
**Status**: Draft  
**Input**: « Clarifier le statut des modules RF (start/stop), ajouter vérification basique et warnings explicites. »

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Statut explicite des modules RF (Priority: P1)
En tant qu’ingénieur test, je veux que `start_rf_logging` et `stop_rf_logging` retournent un statut clair (confirmé/indéterminé/échec) plutôt qu’un simple booléen.

**Independent Test**: Appel du module avec mocks ADB : lorsque les commandes passent mais la vérif échoue, le statut doit être `unknown` avec un warning.

### Edge Cases
- Toutes les commandes échouent → `success=False`.
- Commandes OK mais vérification silencieuse échoue → `success=False` ou `state_confirmed=False` + warning.
- ADB indisponible → message explicite.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: `start_rf_logging` retourne `status` ou `state_confirmed` et warning si non confirmé.
- **FR-002**: `stop_rf_logging` idem, avec vérification basique (listing `/sdcard/log`).
- **FR-003**: Tests pytest couvrant statuts `unknown` et échec.

## Success Criteria *(mandatory)*
- **SC-001**: En cas de commandes réussies mais pas de preuve, le module retourne `success=False` ou `state_confirmed=False` avec warning.
- **SC-002**: Tests passent en CI.
