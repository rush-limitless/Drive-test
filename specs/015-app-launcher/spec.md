# Feature Specification: Smart App Launcher Module

**Feature Branch**: `015-app-launcher`
**Created**: 2025-12-18
**Status**: Draft
**Input**: User description: "Ajoute un module editable qui permet d'ouvrir les applications telles que Google, YouTube pour gÃ©nÃ©rer un flux de data. Quand je clique sur edit je dois pouvoir choisir l'appli que je veux ouvrir et si YouTube est choisi il doit s'ouvrir et lancer une vidÃ©o random ; de mÃªme pour Google qui doit s'ouvrir en lanÃ§ant une recherche alÃ©atoire."

## 1. Background & Context

The app launcher module enables controlled app launches for data generation workflows.

## 2. Problem Statement

There is no standardized way to launch target apps with consistent parameters across devices.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Launch a data generation app (Priority: P1)
L'ingÃ©nieur automation veut pouvoir lancer depuis le dashboard une application grand public (Google ou YouTube) afin de gÃ©nÃ©rer de la consommation de donnÃ©es et valider la connectivitÃ©.

**Why this priority**: Fournit un moyen simple de provoquer un trafic radio sans Ã©crire de scripts supplÃ©mentaires, c'est la valeur mÃ©tier la plus directe.

**Independent Test**: Depuis la page *Modules*, sÃ©lectionner un device, ouvrir la liste de modules et cliquer sur *Run* pour le module Smart App Launcher ; vÃ©rifier que l'appareil lance l'app choisie (Google ou YouTube) et que la rÃ©ponse de l'API signale l'application dÃ©marrÃ©e.

**Acceptance Scenarios**:
1. **Given** un appareil connectÃ© et le module Smart App Launcher configurÃ© pour Google, **When** l'utilisateur clique sur *Run*, **Then** Google s'ouvre avec une recherche alÃ©atoire et l'API retourne `already_on` ou un success avec le nom de l'app.
2. **Given** un appareil connectÃ© et le module Smart App Launcher configurÃ© pour YouTube, **When** l'utilisateur clique sur *Run*, **Then** YouTube s'ouvre sur une vidÃ©o choisie alÃ©atoirement et l'API confirme l'ouverture du flux.
3. **Given** un appareil sans Google ni YouTube installÃ©s, **When** on dÃ©clenche le module, **Then** l'API retourne une erreur descriptive (package manquant) et un message d'interface reflÃ¨te l'Ã©chec.

---

### User Story 2 - Configuration accessible via l'Ã©diteur (Priority: P2)
Le mÃªme utilisateur veut pouvoir changer l'application cible depuis le bouton *Edit* pour choisir entre Google et YouTube Ã  tout moment.

**Why this priority**: Facilite la rÃ©utilisation du module sans devoir supprimer/rÃ©crÃ©er un workflow ; amÃ©liore la flexibilitÃ©.

**Independent Test**: Depuis la carte du module sur la page Modules, cliquer sur *Edit*, sÃ©lectionner un des deux choix dans le dialogue, sauvegarder et vÃ©rifier que l'option persiste (mÃªme aprÃ¨s un rafraÃ®chissement de la page) et que le prochain *Run* utilise bien le choix enregistrÃ©.

**Acceptance Scenarios**:
1. **Given** l'Ã©diteur du module ouvert, **When** l'utilisateur choisit Â« YouTube Â» puis ferme l'Ã©diteur, **Then** le module continue d'indiquer Â« Smart App Launcher (YouTube) Â» et les exÃ©cutions suivantes ouvrent YouTube.
2. **Given** l'Ã©diteur ouvert, **When** l'utilisateur choisit Â« Google Â» et sauvegarde, **Then** la prochaine exÃ©cution lance Google avec une recherche alÃ©atoire et l'interface indique le choix actif.
3. **Given** duration rÃ©glÃ©e dans l'Ã©diteur, **When** on lance l'action, **Then** l'application sÃ©lectionnÃ©e s'arrÃªte automatiquement aprÃ¨s la durÃ©e dÃ©finie et la rÃ©ponse signale la fermeture.

---

### User Story 3 - Feedback clair (Priority: P3)
L'utilisateur veut savoir si l'app est dÃ©jÃ  ouverte ou si la commande n'a rien changÃ© pour Ã©viter de relancer inutilement.

**Why this priority**: RÃ©duit le bruit dans les journaux en montrant que l'app cible est dÃ©jÃ  active.

**Independent Test**: Appeler le module deux fois de suite ; la premiÃ¨re fois, vÃ©rifier que `success` est vrai et la deuxiÃ¨me fois que la rÃ©ponse mentionne `already_on`.

**Acceptance Scenarios**:
1. **Given** YouTube dÃ©jÃ  actif sur l'appareil, **When** on exÃ©cute le module avec YouTube sÃ©lectionnÃ©, **Then** la rÃ©ponse contient `already_on: true` et un message clair (p.ex. Â« YouTube is already active Â»).

---

### Edge Cases

- Que se passe-t-il si le device ne dispose pas du launcher Google ou YouTube -> L'API doit signaler le package manquant.
- Comment gÃ©rer un paramÃ¨tre `app` invalide transmissible depuis le frontend -> Rejeter l'appel et retourner un 400 clair.
- Comment rÃ©agir quand l'appareil refuse l'intent (timeout ou erreur systÃ¨me) -> Retourner `success: false` et conserver les erreurs/stack pour le debugging.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: SystÃ¨me doit exposer un module `launch_app` (Smart App Launcher) dans les modules disponibles et exÃ©cuter un intent adaptatif vers Google ou YouTube.
- **FR-002**: Module doit accepter un paramÃ¨tre obligatoire `app` (valeurs {`google`, `youtube`}) et valider son contenu.
- **FR-003**: Lorsque `app=youtube`, l'API doit gÃ©nÃ©rer une vidÃ©o alÃ©atoire (parmi une liste approuvÃ©e) et lancer l'intent `android.intent.action.VIEW` contre le lien YouTube correspondant.
- **FR-004**: Lorsque `app=google`, l'API doit construire une recherche alÃ©atoire (`android.intent.action.WEB_SEARCH`) avec une requÃªte sÃ©lectionnÃ©e dans une liste de mot-clÃ©s.
- **FR-005**: Le frontend doit proposer un module Ã©ditable avec un dialogue qui permet de choisir et persister le paramÃ¨tre `app`.
- **FR-006**: Le backend doit signaler `already_on`/`already_off` pour Ã©viter des exÃ©cutions redondantes et alimenter le bandeau d'Ã©tat.
- **FR-007**: L'Ã©diteur doit aussi permettre de dÃ©finir une durÃ©e (en secondes) pendant laquelle l'application reste ouverte, et l'API doit fermer l'app une fois ce dÃ©lai Ã©coulÃ© tout en reportant `duration_seconds` + `closed_after_duration`.

### Key Entities
- **SmartAppLaunchConfig**: {app: 'google' | 'youtube'} retenu cÃ´tÃ© frontend.
- **AppIntentPlan**: {command: List[str], description: str, launched_url: str} gÃ©nÃ©rÃ© par le backend selon la sÃ©lection.

## Success Criteria *(mandatory)*

### Measurable Outcomes
- **SC-001**: 100 % des exÃ©cutions de `launch_app` retournent une rÃ©ponse avec `module: launch_app` et `success` dÃ©finissant lâ€™Ã©tat rÃ©el (ou `already_on`).
- **SC-002**: Lâ€™Ã©diteur de module permet de choisir `google` ou `youtube` et affiche ce choix dans lâ€™UI principale, validation via test manuel.
- **SC-003**: Si YouTube est sÃ©lectionnÃ©, lâ€™API dÃ©marre obligatoirement un des IDs de vidÃ©o autorisÃ©s (au moins 5 entrÃ©es) sans besoin dâ€™accueil.
- **SC-004**: Si Google est sÃ©lectionnÃ©, au moins 5 requÃªtes possibles sont utilisÃ©es alÃ©atoirement lorsque le module est dÃ©clenchÃ©, documentÃ© en Spec.


## 8. Acceptance Criteria

- The launcher module starts the configured app on the selected device.
- The UI allows editing and saving launcher parameters.
- Errors are surfaced without crashing the UI.

