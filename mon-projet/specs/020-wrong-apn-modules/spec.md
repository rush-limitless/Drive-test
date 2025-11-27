# Feature Specification: Wrong APN & RF Logging Modules

**Feature Branch**: `chore/ci-governance`  
**Created**: 2024-07-01  
**Status**: Draft  
**Input**: User description: "implémente les 6 modules issus du script ADB (APN erroné, mode avion, RF logging, test data, pull logs)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Orchestrer APN erroné + RF logging (Priority: P1)

En tant qu’ingénieur test, je veux disposer de modules workflow pour appliquer un APN erroné, basculer le mode avion, ouvrir SysDump et démarrer/arrêter le logging RF afin d’automatiser les scénarios de capture radio.

**Why this priority**: Couvre le cœur métier (déclencher la capture RF et injecter un APN invalide) pour valider la dégradation attendue.

**Independent Test**: Via API workflow: exécuter un workflow avec `wrong_apn_configuration` + `start_rf_logging` + `stop_rf_logging` + `enable_airplane_mode`/`disable_airplane_mode` et vérifier les statuts de modules.

**Acceptance Scenarios**:

1. **Given** un device connecté ADB, **When** j’exécute le module `wrong_apn_configuration`, **Then** l’APN cible est appliqué et le module renvoie `success=True`.
2. **Given** un device connecté, **When** j’exécute `start_rf_logging`, **Then** la séquence ADB/SysDump est lancée et le module retourne `success=True` ou un message d’avertissement exploitable si l’ouverture échoue.

---

### User Story 2 - Vérifier la perte de data et collecter les logs (Priority: P2)

En tant qu’ingénieur test, je veux tester la connectivité data après APN erroné et rapatrier les logs RF pour analyse.

**Why this priority**: Valide l’effet attendu (perte de data) et fournit la preuve (logs).

**Independent Test**: Exécuter `test_data_connection` suivi de `pull_rf_logs` et vérifier le résultat (ping échoué) + présence d’artefacts copiés en local.

**Acceptance Scenarios**:

1. **Given** un APN erroné en place, **When** j’exécute `test_data_connection`, **Then** le module renvoie un échec de ping ou un statut explicite.
2. **Given** des logs RF sur le device, **When** j’exécute `pull_rf_logs`, **Then** les fichiers sont copiés vers l’hôte et le chemin est retourné.

### Edge Cases

- Aucun device ADB connecté ou plusieurs devices sans `ADB_SERIAL` défini.
- Commandes SysDump/secret code indisponibles sur certains firmwares.
- Permissions refusées pour l’écriture d’APN ou l’accès aux logs.
- Répertoires de destination Windows vs Linux (chemins à normaliser).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Exposer un module `wrong_apn_configuration` acceptant une valeur d’APN et retournant un statut de succès/erreur.
- **FR-002**: Exposer un module `toggle_airplane_mode` (ou réutiliser enable/disable) avec retour d’état vérifié.
- **FR-003**: Exposer `start_rf_logging` (SysDump/secret code best-effort) et `stop_rf_logging` avec résultat détaillé.
- **FR-004**: Exposer `test_data_connection` (ping via ADB) avec métriques basiques.
- **FR-005**: Exposer `pull_rf_logs` pour rapatrier `/sdcard/log` dans un chemin hôte résolu.
- **FR-006**: Chaque module doit être intégrable dans `FlowExecutor` et dans le catalogue frontend avec descriptions.
- **FR-007**: Ajouter des tests backend couvrant au moins la validation des endpoints/workflow pour ces modules (mocks/stubs ADB).

### Key Entities

- **Workflow module**: identifiants `wrong_apn_configuration`, `start_rf_logging`, `stop_rf_logging`, `test_data_connection`, `pull_rf_logs`, `toggle_airplane_mode`.
- **Device artifact path**: `/sdcard/log` (source) → chemin hôte normalisé.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Les 6 modules sont invocables via `/api/v1/workflows/{id}/execute` et présents dans le catalogue frontend.
- **SC-002**: Les tests backend associés passent localement et en CI.
- **SC-003**: `pull_rf_logs` renvoie un chemin local valide et crée le dossier si nécessaire.
- **SC-004**: Les modules renvoient des messages d’erreur explicites quand ADB ou SysDump échouent (pas de crash).
