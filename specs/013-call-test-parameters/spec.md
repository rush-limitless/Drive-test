# Feature Specification: Call Test Parameter Prompt

**Feature Branch**: `[013-call-test-parameters]`
**Created**: 2025-11-05
**Status**: Draft
**Input**: User description: "Quand je clique sur run on doit me demander d'entrer l'indicatif et le numero du correspondant puis la dureÃ© de l'appel et le nombre de fois que je veux executer l'appel. Quand je clique sur edit je dois voir ces mÃªmes informations."

## 1. Background & Context

The Call Test module needs consistent parameter capture before execution and when editing existing values.

## 2. Problem Statement

The current flow does not enforce parameter entry or reuse, leading to inconsistent test execution.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Saisie des paramÃ¨tres avant exÃ©cution (Priority: P1)

En tant qu'opÃ©rateur, lorsque je lance le module Â«â€¯Call Testâ€¯Â», je veux saisir l'indicatif, le numÃ©ro, la durÃ©e et le nombre d'appels afin que l'automatisation utilise les bons paramÃ¨tres Ã  chaque exÃ©cution.

**Why this priority**: Sans saisie des paramÃ¨tres, le module ne peut pas reflÃ©ter la rÃ©alitÃ© mÃ©tier du test vocal et les appels Ã©chouent ou ciblent un mauvais numÃ©ro.

**Independent Test**: Depuis l'UI des modules, cliquer sur Â«â€¯Runâ€¯Â» pour Â«â€¯Call Testâ€¯Â», remplir le formulaire et valider doit dÃ©clencher l'exÃ©cution avec un rÃ©capitulatif visible cÃ´tÃ© UI.

**Acceptance Scenarios**:

1. **Given** je suis sur la page Â«â€¯Modulesâ€¯Â», **When** je clique sur Â«â€¯Runâ€¯Â» pour Â«â€¯Call Testâ€¯Â», **Then** une fenÃªtre modale s'ouvre avec les champs Indicatif, NumÃ©ro, DurÃ©e (secondes) et Nombre d'appels prÃ©-remplis avec des valeurs par dÃ©faut non vides.
2. **Given** le formulaire est affichÃ©, **When** je fournis des valeurs valides et je confirme, **Then** l'UI affiche une notification de lancement reprenant le numÃ©ro complet et le backend reÃ§oit les paramÃ¨tres `number`, `duration`, `call_count` correctement typÃ©s.

---

### User Story 2 - Consultation/Ã©dition des paramÃ¨tres existants (Priority: P2)

En tant qu'opÃ©rateur, je veux pouvoir consulter et ajuster les paramÃ¨tres stockÃ©s du Â«â€¯Call Testâ€¯Â» via l'action Â«â€¯Editâ€¯Â» afin de corriger des valeurs avant la prochaine exÃ©cution.

**Why this priority**: Les campagnes de test changent frÃ©quemment de numÃ©ro ou de durÃ©eâ€¯; lâ€™opÃ©rateur doit pouvoir vÃ©rifier et modifier sans lancer immÃ©diatement un appel.

**Independent Test**: Cliquer sur Â«â€¯Editâ€¯Â» ouvre le mÃªme formulaire prÃ©-rempli ; enregistrer sans lancer doit conserver les nouvelles valeurs et fermer le formulaire.

**Acceptance Scenarios**:

1. **Given** des paramÃ¨tres ont dÃ©jÃ  Ã©tÃ© saisis, **When** je clique sur Â«â€¯Editâ€¯Â», **Then** la modale affiche les derniÃ¨res valeurs sauvegardÃ©es.
2. **Given** je modifie les champs et je sauvegarde depuis Â«â€¯Editâ€¯Â», **Then** les nouvelles valeurs sont persistÃ©es et un message de confirmation sâ€™affiche sans dÃ©clencher lâ€™exÃ©cution.

---

### User Story 3 - Persistance locale et rÃ©emploi (Priority: P3)

En tant quâ€™opÃ©rateur, je veux que les paramÃ¨tres saisis soient mÃ©morisÃ©s localement pour rÃ©utilisation lors de futurs lancements afin dâ€™Ã©viter la ressaisie complÃ¨te.

**Why this priority**: RÃ©duit les erreurs humaines et accÃ©lÃ¨re la prÃ©paration des tests rÃ©pÃ©titifs.

**Independent Test**: Actualiser la page (ou redÃ©marrer lâ€™application) et rouvrir le formulaire doit recharger les derniÃ¨res valeurs sauvegardÃ©es.

**Acceptance Scenarios**:

1. **Given** je saisis et valide de nouveaux paramÃ¨tres, **When** je rafraÃ®chis lâ€™interface, **Then** un nouveau clic sur Â«â€¯Runâ€¯Â» affiche les mÃªmes valeurs.
2. **Given** aucun paramÃ¨tre nâ€™a encore Ã©tÃ© enregistrÃ©, **When** jâ€™ouvre le formulaire, **Then** des valeurs par dÃ©faut sÃ»res (indicatif +33, durÃ©e 30s, etc.) sont proposÃ©es.

---

### Edge Cases

- Que se passe-t-il si lâ€™utilisateur laisse un champ vide ou saisit des caractÃ¨res non numÃ©riques dans la durÃ©e ou le nombre dâ€™appelsâ€¯-> â‡’ Le formulaire doit bloquer la validation et afficher un message prÃ©cis.
- Comment le systÃ¨me gÃ¨re-t-il un indicatif saisi sans Â«â€¯+â€¯Â» ou contenant des espacesâ€¯-> â‡’ Normaliser lâ€™indicatif (`+` + chiffres) avant de construire le numÃ©ro complet.
- Que faire si aucune connexion backend nâ€™est disponibleâ€¯-> â‡’ Lâ€™UI doit signaler lâ€™Ã©chec et proposer de rÃ©essayer sans planter lâ€™application.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Au clic sur Â«â€¯Runâ€¯Â» du module `call_test`, lâ€™UI MUST ouvrir une modale demandant indicatif, numÃ©ro, durÃ©e (secondes) et nombre dâ€™appels.
- **FR-002**: Le formulaire MUST valider que indicatif et numÃ©ro contiennent uniquement `+` et des chiffres, que durÃ©e > 0 et que nombre dâ€™appels est entre 1 et 10.
- **FR-003**: La confirmation en mode Â«â€¯Runâ€¯Â» MUST concatÃ©ner lâ€™indicatif et le numÃ©ro en un champ `number` et transmettre `duration` (int) et `call_count` (int) au dÃ©clencheur dâ€™exÃ©cution.
- **FR-004**: Le mode Â«â€¯Editâ€¯Â» MUST afficher les mÃªmes champs prÃ©-remplis et enregistrer les changements sans exÃ©cuter le module.
- **FR-005**: Les paramÃ¨tres validÃ©s MUST Ãªtre persistÃ©s cÃ´tÃ© client (localStorage) et rÃ©appliquÃ©s lors des prochaines ouvertures du formulaire.
- **FR-006**: Lâ€™UI MUST fournir un retour utilisateur (snackbar) indiquant succÃ¨s ou erreur pour les actions Â«â€¯Runâ€¯Â» et Â«â€¯Editâ€¯Â».

### Key Entities

- **CallTestParameters**: Objet `{ countryCode: string; phoneNumber: string; durationSec: number; callCount: number }` reprÃ©sentant la configuration utilisateur.
- **CallTestPrompt**: Couche UI (modale) responsable de lâ€™Ã©dition/validation des paramÃ¨tres et de la remontÃ©e dâ€™Ã©vÃ¨nements `run` ou `save`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100â€¯% des clics sur Â«â€¯Runâ€¯Â» pour `call_test` affichent la modale de saisie (mesurÃ© via tests manuels ou E2E).
- **SC-002**: 0 soumissions valides ne respectant pas les contraintes (durÃ©e <=â€¯0, nombre dâ€™appels >â€¯10) observÃ©es lors des tests QA.
- **SC-003**: AprÃ¨s rafraÃ®chissement de lâ€™UI, les derniÃ¨res valeurs sauvegardÃ©es sont rÃ©appliquÃ©es dans 100â€¯% des cas testÃ©s.
- **SC-004**: En cas dâ€™erreur backend simulÃ©e, lâ€™UI renvoie un message dâ€™Ã©chec sans crash dans 100â€¯% des scÃ©narios testÃ©s.


## 8. Acceptance Criteria

- Parameter dialog appears for Run and Edit flows.
- Valid inputs are persisted and reused.
- Backend receives normalized call parameters.

