# Feature Specification: Smart App Launcher Module

**Feature Branch**: `015-app-launcher`  
**Created**: 2025-12-18  
**Status**: Draft  
**Input**: User description: "Ajoute un module editable qui permet d'ouvrir les applications telles que Google, YouTube pour générer un flux de data. Quand je clique sur edit je dois pouvoir choisir l'appli que je veux ouvrir et si YouTube est choisi il doit s'ouvrir et lancer une vidéo random ; de même pour Google qui doit s'ouvrir en lançant une recherche aléatoire."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Launch a data generation app (Priority: P1)
L'ingénieur automation veut pouvoir lancer depuis le dashboard une application grand public (Google ou YouTube) afin de générer de la consommation de données et valider la connectivité.

**Why this priority**: Fournit un moyen simple de provoquer un trafic radio sans écrire de scripts supplémentaires, c'est la valeur métier la plus directe.

**Independent Test**: Depuis la page *Modules*, sélectionner un device, ouvrir la liste de modules et cliquer sur *Run* pour le module Smart App Launcher ; vérifier que l'appareil lance l'app choisie (Google ou YouTube) et que la réponse de l'API signale l'application démarrée.

**Acceptance Scenarios**:
1. **Given** un appareil connecté et le module Smart App Launcher configuré pour Google, **When** l'utilisateur clique sur *Run*, **Then** Google s'ouvre avec une recherche aléatoire et l'API retourne `already_on` ou un success avec le nom de l'app.
2. **Given** un appareil connecté et le module Smart App Launcher configuré pour YouTube, **When** l'utilisateur clique sur *Run*, **Then** YouTube s'ouvre sur une vidéo choisie aléatoirement et l'API confirme l'ouverture du flux.
3. **Given** un appareil sans Google ni YouTube installés, **When** on déclenche le module, **Then** l'API retourne une erreur descriptive (package manquant) et un message d'interface reflète l'échec.

---

### User Story 2 - Configuration accessible via l'éditeur (Priority: P2)
Le même utilisateur veut pouvoir changer l'application cible depuis le bouton *Edit* pour choisir entre Google et YouTube à tout moment.

**Why this priority**: Facilite la réutilisation du module sans devoir supprimer/récréer un workflow ; améliore la flexibilité.

**Independent Test**: Depuis la carte du module sur la page Modules, cliquer sur *Edit*, sélectionner un des deux choix dans le dialogue, sauvegarder et vérifier que l'option persiste (même après un rafraîchissement de la page) et que le prochain *Run* utilise bien le choix enregistré.

**Acceptance Scenarios**:
1. **Given** l'éditeur du module ouvert, **When** l'utilisateur choisit « YouTube » puis ferme l'éditeur, **Then** le module continue d'indiquer « Smart App Launcher (YouTube) » et les exécutions suivantes ouvrent YouTube.
2. **Given** l'éditeur ouvert, **When** l'utilisateur choisit « Google » et sauvegarde, **Then** la prochaine exécution lance Google avec une recherche aléatoire et l'interface indique le choix actif.
3. **Given** duration réglée dans l'éditeur, **When** on lance l'action, **Then** l'application sélectionnée s'arrête automatiquement après la durée définie et la réponse signale la fermeture.

---

### User Story 3 - Feedback clair (Priority: P3)
L'utilisateur veut savoir si l'app est déjà ouverte ou si la commande n'a rien changé pour éviter de relancer inutilement.

**Why this priority**: Réduit le bruit dans les journaux en montrant que l'app cible est déjà active.

**Independent Test**: Appeler le module deux fois de suite ; la première fois, vérifier que `success` est vrai et la deuxième fois que la réponse mentionne `already_on`.

**Acceptance Scenarios**:
1. **Given** YouTube déjà actif sur l'appareil, **When** on exécute le module avec YouTube sélectionné, **Then** la réponse contient `already_on: true` et un message clair (p.ex. « YouTube is already active »).

---

### Edge Cases
- Que se passe-t-il si le device ne dispose pas du launcher Google ou YouTube ? L'API doit signaler le package manquant.
- Comment gérer un paramètre `app` invalide transmissible depuis le frontend ? Rejeter l'appel et retourner un 400 clair.
- Comment réagir quand l'appareil refuse l'intent (timeout ou erreur système) ? Retourner `success: false` et conserver les erreurs/stack pour le debugging.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: Système doit exposer un module `launch_app` (Smart App Launcher) dans les modules disponibles et exécuter un intent adaptatif vers Google ou YouTube.
- **FR-002**: Module doit accepter un paramètre obligatoire `app` (valeurs {`google`, `youtube`}) et valider son contenu.
- **FR-003**: Lorsque `app=youtube`, l'API doit générer une vidéo aléatoire (parmi une liste approuvée) et lancer l'intent `android.intent.action.VIEW` contre le lien YouTube correspondant.
- **FR-004**: Lorsque `app=google`, l'API doit construire une recherche aléatoire (`android.intent.action.WEB_SEARCH`) avec une requête sélectionnée dans une liste de mot-clés.
- **FR-005**: Le frontend doit proposer un module éditable avec un dialogue qui permet de choisir et persister le paramètre `app`.
- **FR-006**: Le backend doit signaler `already_on`/`already_off` pour éviter des exécutions redondantes et alimenter le bandeau d'état.
- **FR-007**: L'éditeur doit aussi permettre de définir une durée (en secondes) pendant laquelle l'application reste ouverte, et l'API doit fermer l'app une fois ce délai écoulé tout en reportant `duration_seconds` + `closed_after_duration`.

### Key Entities
- **SmartAppLaunchConfig**: {app: 'google' | 'youtube'} retenu côté frontend.
- **AppIntentPlan**: {command: List[str], description: str, launched_url: str} généré par le backend selon la sélection.

## Success Criteria *(mandatory)*

### Measurable Outcomes
- **SC-001**: 100 % des exécutions de `launch_app` retournent une réponse avec `module: launch_app` et `success` définissant l’état réel (ou `already_on`).
- **SC-002**: L’éditeur de module permet de choisir `google` ou `youtube` et affiche ce choix dans l’UI principale, validation via test manuel.
- **SC-003**: Si YouTube est sélectionné, l’API démarre obligatoirement un des IDs de vidéo autorisés (au moins 5 entrées) sans besoin d’accueil.
- **SC-004**: Si Google est sélectionné, au moins 5 requêtes possibles sont utilisées aléatoirement lorsque le module est déclenché, documenté en Spec.
