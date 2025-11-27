# Feature Specification: Device Manager PDF Reports

**Feature Branch**: `chore/ci-governance`  
**Created**: 2024-07-01  
**Status**: Draft  
**Input**: User description: "Menu Device Manager avec export PDF sur une période choisie"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export PDF par device et par période (Priority: P1)

En tant qu’ingénieur test, je veux télécharger un rapport PDF pour un device sélectionné, sur une période définie, incluant ses métadonnées et un aperçu des événements/logs pour analyse.

**Why this priority**: Couvre le besoin métier principal (rapport partageable).

**Independent Test**: Appeler l’endpoint `/api/v1/devices/{id}/report?from=...&to=...` et vérifier que le PDF se télécharge avec les infos et logs de la période.

**Acceptance Scenarios**:
1. **Given** un device existant, **When** j’appelle l’API avec une plage valide, **Then** je reçois un PDF (HTTP 200, `content-type: application/pdf`, Content-Disposition avec nom explicite).
2. **Given** une plage invalide (from > to), **When** j’appelle l’API, **Then** je reçois un 400 avec un message clair.

### User Story 2 - Menu Device Manager avec export (Priority: P2)

En tant qu’utilisateur UI, je peux choisir un device, définir une période (presets + date-time), et télécharger le PDF directement depuis le Device Manager.

**Why this priority**: Rend la fonctionnalité accessible depuis l’interface existante.

**Independent Test**: Via frontend, sélectionner un device + période, cliquer “Télécharger PDF” et vérifier que le fichier se télécharge.

### Edge Cases
- Aucun device trouvé → 404.
- Période > limite autorisée (ex. 90 jours) → 400.
- Logs absents → PDF génère un message “Aucune donnée sur la période”.
- Formats de date invalides → 400.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: Endpoint HTTP GET `/api/v1/devices/{id}/report` acceptant `from`, `to` (ISO 8601), retourne `application/pdf`.
- **FR-002**: Le PDF inclut métadonnées device (id, modèle, opérateur, réseau) et un résumé des logs/événements sur la période, avec troncature raisonnable (ex. 200 entrées) et mention si tronqué.
- **FR-003**: Validation des dates (from <= to, période max configurable).
- **FR-004**: UI Device Manager offre le choix de période (presets + date-time) et déclenche le téléchargement avec feedback (spinner/toast).
- **FR-005**: Permettre l’export multi-device (même plage) depuis l’UI en téléchargements séquentiels.
- **FR-006**: Tests backend pour l’endpoint (200, 400, 404) et test frontend léger pour la fonction de téléchargement (mock fetch) si infra de test disponible.

### Key Entities
- **Device**: infos de base (id, modèle, opérateur, statut réseau).
- **Device logs/events**: liste avec timestamps, messages (source device_manager).

## Success Criteria *(mandatory)*

### Measurable Outcomes
- **SC-001**: PDF téléchargeable pour un device connecté en moins de 3 secondes sur dataset limité.
- **SC-002**: Validation des paramètres date retourne des erreurs explicites (400).
- **SC-003**: Bouton UI “Télécharger PDF” fonctionnel sur Device Manager.
- **SC-004**: Tests backend passent en CI; build frontend passe.
