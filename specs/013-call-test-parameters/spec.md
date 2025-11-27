# Feature Specification: Call Test Parameter Prompt

**Feature Branch**: `[013-call-test-parameters]`  
**Created**: 2025-11-05  
**Status**: Draft  
**Input**: User description: "Quand je clique sur run on doit me demander d'entrer l'indicatif et le numero du correspondant puis la dureé de l'appel et le nombre de fois que je veux executer l'appel. Quand je clique sur edit je dois voir ces mêmes informations."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Saisie des paramètres avant exécution (Priority: P1)

En tant qu'opérateur, lorsque je lance le module « Call Test », je veux saisir l'indicatif, le numéro, la durée et le nombre d'appels afin que l'automatisation utilise les bons paramètres à chaque exécution.

**Why this priority**: Sans saisie des paramètres, le module ne peut pas refléter la réalité métier du test vocal et les appels échouent ou ciblent un mauvais numéro.

**Independent Test**: Depuis l'UI des modules, cliquer sur « Run » pour « Call Test », remplir le formulaire et valider doit déclencher l'exécution avec un récapitulatif visible côté UI.

**Acceptance Scenarios**:

1. **Given** je suis sur la page « Modules », **When** je clique sur « Run » pour « Call Test », **Then** une fenêtre modale s'ouvre avec les champs Indicatif, Numéro, Durée (secondes) et Nombre d'appels pré-remplis avec des valeurs par défaut non vides.
2. **Given** le formulaire est affiché, **When** je fournis des valeurs valides et je confirme, **Then** l'UI affiche une notification de lancement reprenant le numéro complet et le backend reçoit les paramètres `number`, `duration`, `call_count` correctement typés.

---

### User Story 2 - Consultation/édition des paramètres existants (Priority: P2)

En tant qu'opérateur, je veux pouvoir consulter et ajuster les paramètres stockés du « Call Test » via l'action « Edit » afin de corriger des valeurs avant la prochaine exécution.

**Why this priority**: Les campagnes de test changent fréquemment de numéro ou de durée ; l’opérateur doit pouvoir vérifier et modifier sans lancer immédiatement un appel.

**Independent Test**: Cliquer sur « Edit » ouvre le même formulaire pré-rempli ; enregistrer sans lancer doit conserver les nouvelles valeurs et fermer le formulaire.

**Acceptance Scenarios**:

1. **Given** des paramètres ont déjà été saisis, **When** je clique sur « Edit », **Then** la modale affiche les dernières valeurs sauvegardées.
2. **Given** je modifie les champs et je sauvegarde depuis « Edit », **Then** les nouvelles valeurs sont persistées et un message de confirmation s’affiche sans déclencher l’exécution.

---

### User Story 3 - Persistance locale et réemploi (Priority: P3)

En tant qu’opérateur, je veux que les paramètres saisis soient mémorisés localement pour réutilisation lors de futurs lancements afin d’éviter la ressaisie complète.

**Why this priority**: Réduit les erreurs humaines et accélère la préparation des tests répétitifs.

**Independent Test**: Actualiser la page (ou redémarrer l’application) et rouvrir le formulaire doit recharger les dernières valeurs sauvegardées.

**Acceptance Scenarios**:

1. **Given** je saisis et valide de nouveaux paramètres, **When** je rafraîchis l’interface, **Then** un nouveau clic sur « Run » affiche les mêmes valeurs.
2. **Given** aucun paramètre n’a encore été enregistré, **When** j’ouvre le formulaire, **Then** des valeurs par défaut sûres (indicatif +33, durée 30s, etc.) sont proposées.

---

### Edge Cases

- Que se passe-t-il si l’utilisateur laisse un champ vide ou saisit des caractères non numériques dans la durée ou le nombre d’appels ? ⇒ Le formulaire doit bloquer la validation et afficher un message précis.
- Comment le système gère-t-il un indicatif saisi sans « + » ou contenant des espaces ? ⇒ Normaliser l’indicatif (`+` + chiffres) avant de construire le numéro complet.
- Que faire si aucune connexion backend n’est disponible ? ⇒ L’UI doit signaler l’échec et proposer de réessayer sans planter l’application.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Au clic sur « Run » du module `call_test`, l’UI MUST ouvrir une modale demandant indicatif, numéro, durée (secondes) et nombre d’appels.
- **FR-002**: Le formulaire MUST valider que indicatif et numéro contiennent uniquement `+` et des chiffres, que durée > 0 et que nombre d’appels est entre 1 et 10.
- **FR-003**: La confirmation en mode « Run » MUST concaténer l’indicatif et le numéro en un champ `number` et transmettre `duration` (int) et `call_count` (int) au déclencheur d’exécution.
- **FR-004**: Le mode « Edit » MUST afficher les mêmes champs pré-remplis et enregistrer les changements sans exécuter le module.
- **FR-005**: Les paramètres validés MUST être persistés côté client (localStorage) et réappliqués lors des prochaines ouvertures du formulaire.
- **FR-006**: L’UI MUST fournir un retour utilisateur (snackbar) indiquant succès ou erreur pour les actions « Run » et « Edit ».

### Key Entities

- **CallTestParameters**: Objet `{ countryCode: string; phoneNumber: string; durationSec: number; callCount: number }` représentant la configuration utilisateur.
- **CallTestPrompt**: Couche UI (modale) responsable de l’édition/validation des paramètres et de la remontée d’évènements `run` ou `save`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % des clics sur « Run » pour `call_test` affichent la modale de saisie (mesuré via tests manuels ou E2E).
- **SC-002**: 0 soumissions valides ne respectant pas les contraintes (durée <= 0, nombre d’appels > 10) observées lors des tests QA.
- **SC-003**: Après rafraîchissement de l’UI, les dernières valeurs sauvegardées sont réappliquées dans 100 % des cas testés.
- **SC-004**: En cas d’erreur backend simulée, l’UI renvoie un message d’échec sans crash dans 100 % des scénarios testés.
