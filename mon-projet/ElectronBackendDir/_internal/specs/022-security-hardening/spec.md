# Feature Specification: Sécurisation endpoints devices/report

**Feature Branch**: `chore/ci-governance`  
**Created**: 2024-07-01  
**Status**: Draft  
**Input**: « Sécuriser endpoints Device Manager (auth + rate-limit) »

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Accès protégé par clé API (Priority: P1)
En tant qu’administrateur, je veux que les endpoints sensibles (devices, rapports PDF) exigent une clé API pour éviter l’accès anonyme.

**Independent Test**: Appeler `/api/v1/devices/...` sans clé → 401, avec clé valide → 200.

### User Story 2 - Rate limiting (Priority: P1)
En tant qu’admin, je veux limiter le nombre d’appels par minute pour éviter l’abus (ex. génération massive de PDF).

**Independent Test**: Dépasser le quota (ex. 10 req/min) → 429 ; en dessous → 200.

### Edge Cases
- Clé absente ou incorrecte → 401.
- Quota dépassé → 429 avec message clair.
- Concurrence multi-clés : compteur par clé (fallback IP si pas de clé).

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: Clé API obligatoire sur les endpoints devices (v1/v2) et report PDF (`X-API-Key`).
- **FR-002**: Rate limit simple en mémoire (par clé, fenêtre 60s) configurable, retourne 429 au-delà du seuil.
- **FR-003**: Tests backend pour 401/429 et cas nominal.

### Key Entities
- **API Key**: `settings.API_KEY` (env), header `X-API-Key`.
- **Rate limit**: seuil configurable `settings.RATE_LIMIT_PER_MIN`.

## Success Criteria *(mandatory)*
- **SC-001**: Appel sans clé ou clé invalide → 401.
- **SC-002**: Plus de N requêtes/minute avec la même clé → 429.
- **SC-003**: Tests pytest passent et CI verte.
