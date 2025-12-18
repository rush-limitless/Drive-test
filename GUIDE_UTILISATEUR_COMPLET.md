# 📱 MOBIQ - Guide d'Utilisation Complet

<div align="center">
    <h1>🚀 MOBIQ Framework Telco Automation</h1>
    <h3><em>Guide d'utilisation complet - De l'installation à l'utilisation avancée</em></h3>
    <p><strong>29 modules de test • Interface moderne • Orchestration multi-appareils • Développement spec-driven</strong></p>
</div>

---

## 📋 Table des Matières

1. [🔧 Installation et Configuration](#-installation-et-configuration)
2. [🚀 Premier Démarrage](#-premier-démarrage)
3. [📊 Interface Principale - Dashboard](#-interface-principale---dashboard)
4. [📱 Gestionnaire d'Appareils](#-gestionnaire-dappareils)
5. [🧪 Modules de Test](#-modules-de-test)
6. [🔄 Compositeur de Workflows](#-compositeur-de-workflows)
7. [📈 Rapports et Analyses](#-rapports-et-analyses)
8. [⚙️ Configuration Avancée](#️-configuration-avancée)
9. [🔍 Dépannage](#-dépannage)
10. [📸 Captures d'Écran](#-captures-décran)

---

## 🔧 Installation et Configuration

### Prérequis Système

**Configuration minimale requise :**
- **Système d'exploitation** : Windows 10/11, macOS 10.15+, Ubuntu 18.04+
- **Node.js** : Version 18+ (npm 9+)
- **Python** : Version 3.11+
- **Mémoire** : 8GB RAM minimum (16GB recommandé)
- **Stockage** : 2GB d'espace libre
- **ADB** : Android Debug Bridge installé et configuré
- **Appareil Android** : Avec débogage USB activé

### 1. Installation d'ADB (Android Debug Bridge)

#### Windows
```powershell
# Via Chocolatey (recommandé)
choco install adb

# Ou téléchargement manuel depuis developer.android.com
```

#### macOS
```bash
# Via Homebrew
brew install android-platform-tools
```

#### Ubuntu/Debian
```bash
sudo apt install android-tools-adb
```

### 2. Clonage et Configuration du Projet

```bash
# Cloner le repository
git clone <repo-url>
cd mon-projet

# Créer un environnement virtuel Python
python -m venv .venv

# Activer l'environnement virtuel
# Windows PowerShell :
.\.venv\Scripts\activate
# macOS/Linux :
source .venv/bin/activate
```

### 3. Installation des Dépendances

#### Backend Python
```bash
pip install --upgrade pip
pip install -r src/backend/requirements.txt
```

#### Frontend React
```bash
# Packages racine (Electron)
npm install

# Packages frontend
cd src/frontend
npm install

# Packages Electron
cd ../electron
npm install
```

### 4. Construction de l'Application

#### Build du Frontend
```bash
cd src/frontend
npm run build

# Copier les assets statiques (Windows)
cd ../..
.\scripts\deploy-frontend.ps1

# Ou manuellement copier build/* vers src/backend/static/
```

#### Build d'Electron
```bash
cd src/electron
npm run build
```

### 5. Configuration de l'Environnement

#### Windows PowerShell
```powershell
$env:PYTHONPATH = "$PWD\src;$PWD\src\backend"
```

#### macOS/Linux
```bash
export PYTHONPATH="$PWD/src:$PWD/src/backend"
```

---

## 🚀 Premier Démarrage

### 1. Préparation de l'Appareil Android

1. **Activer le Mode Développeur** :
   - Aller dans `Paramètres` → `À propos du téléphone`
   - Appuyer 7 fois sur `Numéro de build`

2. **Activer le Débogage USB** :
   - Aller dans `Paramètres` → `Options pour les développeurs`
   - Activer `Débogage USB`

3. **Connecter l'Appareil** :
   - Connecter via câble USB
   - Autoriser le débogage USB sur l'appareil

4. **Vérifier la Connexion** :
   ```bash
   adb devices
   # Doit afficher votre appareil comme "device"
   ```

### 2. Démarrage du Backend

```bash
cd mon-projet
python simple-server.py
```

**Sortie attendue :**
```
Starting Telco ADB Automation
Interface: http://localhost:8003
API Documentation: http://localhost:8003/docs
```

### 3. Accès à l'Interface Web

Ouvrir votre navigateur et aller à : `http://localhost:8003`

### 4. Lancement d'Electron (Optionnel)

```bash
# Windows
node_modules\.bin\electron.cmd src\electron

# macOS/Linux
npx electron src/electron
```

---

## 📊 Interface Principale - Dashboard

*[📸 Insérer capture d'écran du Dashboard principal ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/dashboard-main.png`

Le Dashboard est l'écran d'accueil de MOBIQ qui offre une vue d'ensemble de votre environnement de test.

### Éléments du Dashboard

#### 1. Barre de Navigation Supérieure
- **Logo MOBIQ** : Retour à l'accueil
- **Dashboard** : Vue d'ensemble (page actuelle)
- **Modules** : Accès aux modules de test
- **Workflows** : Compositeur de workflows
- **Appareils** : Gestionnaire d'appareils
- **Rapports** : Analyses et historiques

#### 2. Cartes de Statut en Temps Réel

*[📸 Insérer capture d'écran des cartes de statut ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/status-cards.png`

- **Appareils Connectés** : Nombre d'appareils ADB détectés
- **Tests Actifs** : Nombre de tests en cours d'exécution
- **Workflows Programmés** : Workflows automatisés planifiés
- **Dernière Activité** : Horodatage de la dernière action

#### 3. Graphiques de Performance
- **Graphique de Succès des Tests** : Taux de réussite sur 24h
- **Utilisation des Modules** : Modules les plus utilisés
- **Performance Réseau** : Latence et débit

#### 4. Journal d'Activité en Temps Réel
- **Logs en Direct** : Affichage des événements système
- **Filtrage** : Par niveau (Info, Warning, Error)
- **Export** : Sauvegarde des logs

### Actions Rapides depuis le Dashboard

1. **Test Rapide d'Appel** :
   - Cliquer sur "Test d'Appel Rapide"
   - Saisir le numéro de téléphone
   - Définir la durée
   - Lancer le test

2. **Vérification de Connectivité** :
   - Bouton "Ping Test"
   - Test automatique vers 8.8.8.8

3. **Capture d'Écran** :
   - Bouton "Screenshot"
   - Sauvegarde automatique

---

## 📱 Gestionnaire d'Appareils

*[📸 Insérer capture d'écran du gestionnaire d'appareils ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/device-manager.png`

Le Gestionnaire d'Appareils permet de surveiller et contrôler tous les appareils Android connectés.

### Interface du Gestionnaire

#### 1. Liste des Appareils
Chaque appareil affiché avec :
- **Nom/Modèle** : Identifiant de l'appareil
- **ID ADB** : Identifiant unique ADB
- **Statut** : Connecté/Déconnecté/En test
- **Batterie** : Niveau de charge
- **Version Android** : OS et niveau API
- **Opérateur** : Réseau mobile actuel

#### 2. Actions par Appareil

*[📸 Insérer capture d'écran des actions d'appareil ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/device-actions.png`

**Boutons d'action disponibles :**
- **📱 Détails** : Informations complètes
- **🔄 Actualiser** : Mise à jour du statut
- **📸 Screenshot** : Capture d'écran
- **🔋 Batterie** : Informations d'alimentation
- **📶 Signal** : Force du signal réseau
- **⚙️ Paramètres** : Configuration avancée

#### 3. Informations Détaillées d'Appareil

Cliquer sur "Détails" pour voir :
- **Informations Système** :
  - Modèle et fabricant
  - Version Android et niveau API
  - Architecture CPU
  - Mémoire RAM/Stockage

- **État Réseau** :
  - Opérateur mobile
  - Type de réseau (2G/3G/4G/5G)
  - Force du signal
  - Adresse IP

- **Applications Installées** :
  - Liste des packages
  - Versions des applications
  - Permissions accordées

### Gestion Multi-Appareils

#### 1. Sélection Multiple
- Cocher plusieurs appareils
- Actions groupées disponibles :
  - Test simultané
  - Capture d'écran groupée
  - Configuration en lot

#### 2. Profils d'Appareils
- Créer des profils personnalisés
- Sauvegarder les configurations
- Application rapide de paramètres

---

## 🧪 Modules de Test

*[📸 Insérer capture d'écran de la page modules de test ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/test-modules.png`

MOBIQ propose 29 modules de test télécoms spécialisés, organisés par catégories.

### Catégories de Modules

#### 1. 📞 Tests Voix et Appels

*[📸 Insérer capture d'écran des modules voix ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/voice-modules.png`

**Modules disponibles :**

- **`voice_call_test`** - Test d'Appel Vocal Avancé
  - **Paramètres** :
    - Numéro de téléphone
    - Durée de conversation (secondes)
    - Nombre d'appels
    - Délai entre appels
  - **Fonctionnalités** :
    - Détection automatique de réponse
    - Gestion de la messagerie vocale
    - Mesure de la durée de sonnerie
    - Rapport détaillé par appel

- **`initiate_call`** - Initiation d'Appel Simple
  - Lancement d'appel sans supervision
  - Paramètre : Numéro de téléphone

- **`end_call`** - Fin d'Appel
  - Raccrochage automatique
  - Aucun paramètre requis

- **`reject_incoming_call`** - Rejet d'Appel Entrant
  - Rejet automatique des appels entrants
  - Utile pour les tests automatisés

#### 2. 📶 Contrôles Réseau

*[📸 Insérer capture d'écran des modules réseau ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/network-modules.png`

- **`enable_airplane_mode`** / **`disable_airplane_mode`**
  - Activation/désactivation du mode avion
  - Vérification automatique de l'état
  - Timeout configurable

- **`enable_wifi`** / **`disable_wifi`**
  - Contrôle du Wi-Fi
  - Détection de l'état actuel
  - Évite les actions redondantes

- **`enable_mobile_data`** / **`disable_mobile_data`**
  - Gestion des données mobiles
  - Interface utilisateur et commandes système
  - Fallback automatique

- **`check_network_registration`**
  - Vérification de l'enregistrement réseau
  - Informations sur l'opérateur
  - Type de réseau (2G/3G/4G/5G)
  - État du service (In Service/Emergency Only/etc.)

- **`check_signal_strength`**
  - Mesure de la force du signal
  - Données détaillées du registre téléphonie
  - Historique des mesures

#### 3. 🌐 Tests de Connectivité

- **`ping_target`** - Test Ping Avancé
  - **Paramètres** :
    - Cible (par défaut : 8.8.8.8)
    - Durée en secondes
    - Intervalle entre pings
  - **Métriques** :
    - Paquets transmis/reçus
    - Pourcentage de perte
    - RTT min/avg/max/mdev

- **`test_data_connection`**
  - Test de connectivité données
  - Basé sur ping avec rapport spécialisé

#### 4. 💬 Messagerie SMS

- **`send_sms`** - Envoi de SMS
  - **Paramètres** :
    - Numéro destinataire
    - Message texte
  - Ouverture automatique de l'application SMS

- **`delete_sms`** - Suppression des SMS
  - Effacement complet des messages
  - Réinitialisation de l'application

#### 5. 🔧 Gestion d'Applications

- **`install_app`** - Installation d'APK
  - **Paramètres** :
    - Chemin vers le fichier APK
    - Option de remplacement
  - Vérification de l'installation

- **`uninstall_app`** - Désinstallation
  - Paramètre : Nom du package
  - Confirmation de suppression

- **`force_close_app`** - Fermeture Forcée
  - Arrêt immédiat d'une application
  - Utile pour les tests de récupération

#### 6. 📱 Contrôles d'Appareil

- **`capture_screenshot`** - Capture d'Écran
  - **Paramètres** :
    - Nom de fichier (optionnel)
  - Sauvegarde automatique locale

- **`wake_screen`** / **`sleep_screen`**
  - Contrôle de l'écran
  - Réveil/mise en veille

- **`power_off_device`**
  - Extinction de l'appareil
  - ⚠️ Attention : Perte de connexion ADB

#### 7. 🔍 Modules Avancés

- **`configure_wrong_apn`** - Configuration APN Incorrecte
  - Test de robustesse réseau
  - Interface utilisateur automatisée
  - Vérification des paramètres

- **`start_rf_logging`** / **`stop_rf_logging`**
  - Logging RF (Radio Frequency)
  - Codes secrets Samsung (*#9900#)
  - Navigation UI automatique

- **`pull_device_logs`** / **`pull_rf_logs`**
  - Récupération des logs
  - Sauvegarde locale organisée

- **`run_custom_script`** - Script Personnalisé
  - Exécution de commandes ADB custom
  - Support multi-lignes
  - Gestion d'erreurs

- **`dial_secret_code`** - Codes Secrets
  - Composition de codes USSD
  - Support des caractères spéciaux (* et #)

### Utilisation des Modules

#### 1. Sélection d'un Module

*[📸 Insérer capture d'écran de sélection de module ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/module-selection.png`

1. Naviguer vers la page "Modules"
2. Parcourir les catégories ou utiliser la recherche
3. Cliquer sur le module désiré

#### 2. Configuration des Paramètres

*[📸 Insérer capture d'écran de configuration de paramètres ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/module-parameters.png`

1. **Formulaire de Paramètres** :
   - Champs obligatoires marqués d'un *
   - Validation en temps réel
   - Valeurs par défaut pré-remplies

2. **Sélection d'Appareil** :
   - Liste déroulante des appareils connectés
   - Statut de chaque appareil
   - Possibilité de sélection multiple

#### 3. Exécution et Suivi

*[📸 Insérer capture d'écran d'exécution de test ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/test-execution.png`

1. **Lancement** :
   - Bouton "▶ Exécuter le Test"
   - Confirmation des paramètres
   - Démarrage immédiat

2. **Suivi en Temps Réel** :
   - Barre de progression
   - Logs en direct
   - Métriques actualisées

3. **Résultats** :
   - Statut de réussite/échec
   - Données détaillées
   - Options d'export

---

## 🔄 Compositeur de Workflows

*[📸 Insérer capture d'écran du compositeur de workflows ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/workflow-composer.png`

Le Compositeur de Workflows permet de créer des séquences de tests automatisées et complexes.

### Interface du Compositeur

#### 1. Zone de Conception

*[📸 Insérer capture d'écran de la zone de conception ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/workflow-design.png`

- **Glisser-Déposer** : Interface intuitive
- **Connexions Visuelles** : Liens entre les étapes
- **Conditions** : Branchements conditionnels
- **Boucles** : Répétitions automatiques

#### 2. Bibliothèque de Modules
- **Modules Disponibles** : Tous les 29 modules
- **Recherche** : Filtrage rapide
- **Catégories** : Organisation par type
- **Favoris** : Modules fréquemment utilisés

#### 3. Propriétés des Étapes
- **Configuration** : Paramètres spécifiques
- **Conditions** : Critères d'exécution
- **Délais** : Temporisation entre étapes
- **Gestion d'Erreurs** : Actions en cas d'échec

### Création d'un Workflow

#### 1. Workflow Simple : Test d'Appel Complet

*[📸 Insérer capture d'écran d'un workflow simple ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/simple-workflow.png`

**Étapes :**
1. **Vérification de Connectivité** (`ping_target`)
2. **Vérification du Signal** (`check_signal_strength`)
3. **Test d'Appel** (`voice_call_test`)
4. **Capture d'Écran** (`capture_screenshot`)

#### 2. Workflow Avancé : Test de Robustesse Réseau

*[📸 Insérer capture d'écran d'un workflow avancé ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/advanced-workflow.png`

**Étapes :**
1. **État Initial** (`check_network_registration`)
2. **Activation Mode Avion** (`enable_airplane_mode`)
3. **Attente** (Délai de 10 secondes)
4. **Désactivation Mode Avion** (`disable_airplane_mode`)
5. **Vérification de Reconnexion** (`check_network_registration`)
6. **Test de Données** (`test_data_connection`)
7. **Condition** : Si échec → Retry
8. **Rapport Final** (`capture_screenshot`)

### Workflows Prédéfinis

MOBIQ inclut 10 workflows prêts à l'emploi :

#### 1. **Basic Call Test**
- Test d'appel simple avec vérifications
- Durée : ~2 minutes

#### 2. **Network Stress Test**
- Cycles répétés de connexion/déconnexion
- Durée : ~15 minutes

#### 3. **Data Performance Suite**
- Tests complets de performance données
- Durée : ~10 minutes

#### 4. **SMS Functionality Check**
- Envoi/réception/suppression SMS
- Durée : ~3 minutes

#### 5. **App Installation Cycle**
- Installation/test/désinstallation d'APK
- Durée : Variable selon l'APK

### Programmation et Exécution

#### 1. Exécution Immédiate
- Bouton "▶ Exécuter Maintenant"
- Sélection des appareils cibles
- Suivi en temps réel

#### 2. Programmation Différée

*[📸 Insérer capture d'écran de programmation ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/workflow-scheduling.png`

- **Date et Heure** : Planification précise
- **Récurrence** : Quotidienne/Hebdomadaire/Mensuelle
- **Conditions** : Déclencheurs automatiques
- **Notifications** : Alertes de fin d'exécution

---

## 📈 Rapports et Analyses

*[📸 Insérer capture d'écran de la page rapports ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/reports-main.png`

La section Rapports fournit des analyses détaillées et des historiques complets de tous les tests.

### Types de Rapports

#### 1. Rapports d'Exécution

*[📸 Insérer capture d'écran d'un rapport d'exécution ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/execution-report.png`

**Contenu :**
- **Résumé Exécutif** :
  - Taux de réussite global
  - Durée totale d'exécution
  - Nombre de tests réalisés
  - Appareils impliqués

- **Détails par Test** :
  - Horodatage de début/fin
  - Paramètres utilisés
  - Résultats détaillés
  - Messages d'erreur éventuels

- **Métriques de Performance** :
  - Temps de réponse
  - Utilisation des ressources
  - Qualité du signal
  - Débit de données

#### 2. Rapports d'Appareil

*[📸 Insérer capture d'écran d'un rapport d'appareil ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/device-report.png`

**Informations par Appareil :**
- **Historique des Tests** : Chronologie complète
- **Performance** : Évolution des métriques
- **Fiabilité** : Taux de succès par module
- **Utilisation** : Fréquence d'utilisation

#### 3. Rapports de Tendances

*[📸 Insérer capture d'écran des tendances ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/trends-report.png`

**Analyses Temporelles :**
- **Graphiques de Performance** : Évolution sur 7/30/90 jours
- **Comparaisons** : Entre appareils ou périodes
- **Prédictions** : Tendances futures basées sur l'historique
- **Alertes** : Détection d'anomalies

### Filtrage et Recherche

#### 1. Filtres Disponibles
- **Période** : Dernière heure/jour/semaine/mois
- **Appareil** : Sélection spécifique
- **Module** : Type de test
- **Statut** : Succès/Échec/En cours
- **Utilisateur** : Qui a lancé le test

#### 2. Recherche Avancée
- **Mots-clés** : Dans les logs et résultats
- **Expressions Régulières** : Recherche complexe
- **Combinaisons** : Plusieurs critères simultanés

### Export et Partage

#### 1. Formats d'Export

*[📸 Insérer capture d'écran des options d'export ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/export-options.png`

- **PDF** : Rapport formaté pour impression
- **Excel** : Données tabulaires pour analyse
- **CSV** : Import dans d'autres outils
- **JSON** : Intégration API

#### 2. Rapports Automatiques
- **Programmation** : Génération automatique
- **Email** : Envoi programmé aux équipes
- **Webhooks** : Intégration avec outils externes

---

## ⚙️ Configuration Avancée

### 1. Paramètres Système

*[📸 Insérer capture d'écran des paramètres système ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/system-settings.png`

#### Configuration Backend
```python
# src/backend/core/config.py
class Settings:
    # Serveur
    HOST = "127.0.0.1"
    PORT = 8003
    
    # Base de données
    DATABASE_URL = "sqlite:///./data/app.db"
    
    # ADB
    ADB_TIMEOUT = 30
    DEVICE_POLL_INTERVAL = 5
    
    # Logs
    LOG_LEVEL = "INFO"
    LOG_RETENTION_DAYS = 30
```

#### Variables d'Environnement
```bash
# Configuration via .env
MOBIQ_HOST=0.0.0.0
MOBIQ_PORT=8003
MOBIQ_DEBUG=false
MOBIQ_LOG_LEVEL=INFO
ADB_PATH=/usr/local/bin/adb
```

### 2. Personnalisation de l'Interface

#### Thèmes et Couleurs
- **Mode Sombre/Clair** : Basculement automatique
- **Couleurs Personnalisées** : Adaptation à la charte graphique
- **Disposition** : Réorganisation des panneaux

#### Préférences Utilisateur
- **Langue** : Français/Anglais
- **Fuseau Horaire** : Configuration locale
- **Notifications** : Types et fréquence
- **Raccourcis** : Touches personnalisées

### 3. Intégrations Externes

#### APIs et Webhooks
```python
# Configuration webhook
WEBHOOK_ENDPOINTS = {
    "test_completion": "https://your-api.com/webhook/test-complete",
    "device_status": "https://your-api.com/webhook/device-status",
    "error_alerts": "https://your-api.com/webhook/errors"
}
```

#### Bases de Données Externes
- **PostgreSQL** : Pour environnements d'entreprise
- **MongoDB** : Stockage de logs volumineux
- **InfluxDB** : Métriques de performance

---

## 🔍 Dépannage

### Problèmes Courants

#### 1. Appareil Non Détecté

**Symptômes :**
- `adb devices` ne liste pas l'appareil
- Interface MOBIQ affiche "Aucun appareil connecté"

**Solutions :**
1. **Vérifier la connexion USB** :
   ```bash
   # Redémarrer le serveur ADB
   adb kill-server
   adb start-server
   adb devices
   ```

2. **Pilotes USB** (Windows) :
   - Installer les pilotes du fabricant
   - Utiliser les pilotes génériques Android

3. **Autorisation de débogage** :
   - Révoquer les autorisations : `Paramètres` → `Options développeur` → `Révoquer autorisations débogage USB`
   - Reconnecter l'appareil

#### 2. Tests qui Échouent

**Diagnostic :**
1. **Vérifier les logs** :
   ```bash
   # Logs backend
   tail -f logs/mobiq.log
   
   # Logs ADB
   adb logcat | grep -i error
   ```

2. **Tester manuellement** :
   ```bash
   # Test de connectivité ADB
   adb shell echo "test"
   
   # Vérifier les permissions
   adb shell pm list permissions
   ```

#### 3. Performance Lente

**Optimisations :**
1. **Réduire le polling** :
   ```python
   # Dans config.py
   DEVICE_POLL_INTERVAL = 10  # Augmenter l'intervalle
   ```

2. **Limiter les logs** :
   ```python
   LOG_LEVEL = "WARNING"  # Réduire la verbosité
   ```

3. **Nettoyer la base de données** :
   ```bash
   python src/backend/cleanup_db.py --older-than 30
   ```

### Logs et Diagnostics

#### 1. Niveaux de Log
- **DEBUG** : Informations détaillées pour développement
- **INFO** : Événements normaux du système
- **WARNING** : Situations inhabituelles mais gérables
- **ERROR** : Erreurs nécessitant une attention
- **CRITICAL** : Erreurs critiques arrêtant le système

#### 2. Emplacements des Logs
```
logs/
├── mobiq.log          # Log principal de l'application
├── adb.log           # Logs spécifiques ADB
├── device_*.log      # Logs par appareil
└── error.log         # Erreurs uniquement
```

#### 3. Outils de Diagnostic

*[📸 Insérer capture d'écran des outils de diagnostic ici]*
**Emplacement suggéré pour la photo** : `media/screenshots/diagnostic-tools.png`

- **Health Check** : `/api/health` - Statut système
- **Device Info** : `/api/devices/{id}/info` - Détails appareil
- **System Metrics** : `/api/metrics` - Performance système

---

## 📸 Captures d'Écran

### Emplacements Suggérés pour les Photos

Créer le dossier `media/screenshots/` et ajouter les captures suivantes :

#### Interface Principale
1. **`dashboard-main.png`** - Vue d'ensemble du dashboard
2. **`status-cards.png`** - Cartes de statut en temps réel
3. **`navigation-menu.png`** - Menu de navigation principal

#### Gestionnaire d'Appareils
4. **`device-manager.png`** - Liste des appareils connectés
5. **`device-actions.png`** - Boutons d'action par appareil
6. **`device-details.png`** - Informations détaillées d'un appareil

#### Modules de Test
7. **`test-modules.png`** - Page principale des modules
8. **`voice-modules.png`** - Modules de test voix
9. **`network-modules.png`** - Modules de contrôle réseau
10. **`module-selection.png`** - Sélection d'un module
11. **`module-parameters.png`** - Configuration des paramètres
12. **`test-execution.png`** - Exécution d'un test en cours

#### Compositeur de Workflows
13. **`workflow-composer.png`** - Interface du compositeur
14. **`workflow-design.png`** - Zone de conception visuelle
15. **`simple-workflow.png`** - Exemple de workflow simple
16. **`advanced-workflow.png`** - Workflow complexe avec conditions
17. **`workflow-scheduling.png`** - Programmation de workflows

#### Rapports et Analyses
18. **`reports-main.png`** - Page principale des rapports
19. **`execution-report.png`** - Rapport d'exécution détaillé
20. **`device-report.png`** - Rapport spécifique à un appareil
21. **`trends-report.png`** - Graphiques de tendances
22. **`export-options.png`** - Options d'export des rapports

#### Configuration
23. **`system-settings.png`** - Paramètres système
24. **`user-preferences.png`** - Préférences utilisateur
25. **`diagnostic-tools.png`** - Outils de diagnostic

### Instructions pour les Captures

1. **Résolution** : 1920x1080 minimum
2. **Format** : PNG pour la qualité
3. **Annotations** : Ajouter des flèches et légendes si nécessaire
4. **Cohérence** : Utiliser le même thème/apparence
5. **Mise à jour** : Capturer avec la dernière version de l'interface

---

## 🚀 Utilisation Avancée

### Scripts d'Automatisation

#### 1. Script de Démarrage Complet
```bash
#!/bin/bash
# start-mobiq.sh

echo "🚀 Démarrage de MOBIQ..."

# Vérifier ADB
if ! command -v adb &> /dev/null; then
    echo "❌ ADB non trouvé. Veuillez l'installer."
    exit 1
fi

# Activer l'environnement virtuel
source .venv/bin/activate

# Démarrer le backend
echo "📡 Démarrage du backend..."
python simple-server.py &
BACKEND_PID=$!

# Attendre que le backend soit prêt
sleep 5

# Démarrer Electron
echo "🖥️ Démarrage de l'interface Electron..."
npx electron src/electron &
ELECTRON_PID=$!

echo "✅ MOBIQ démarré avec succès!"
echo "Backend PID: $BACKEND_PID"
echo "Electron PID: $ELECTRON_PID"
echo "Interface web: http://localhost:8003"

# Attendre l'arrêt
wait
```

#### 2. Script de Test Automatisé
```python
#!/usr/bin/env python3
# auto-test.py

import requests
import time
import json

BASE_URL = "http://localhost:8003/api/v1"

def run_automated_test_suite():
    """Exécute une suite de tests automatisée."""
    
    # 1. Vérifier les appareils connectés
    devices = requests.get(f"{BASE_URL}/devices").json()
    if not devices:
        print("❌ Aucun appareil connecté")
        return False
    
    device_id = devices[0]['id']
    print(f"📱 Utilisation de l'appareil: {device_id}")
    
    # 2. Suite de tests
    tests = [
        {
            "module": "check_signal_strength",
            "params": {}
        },
        {
            "module": "ping_target",
            "params": {"target": "8.8.8.8", "duration_seconds": 5}
        },
        {
            "module": "voice_call_test",
            "params": {"number": "+33123456789", "talk_duration": 10}
        }
    ]
    
    results = []
    for test in tests:
        print(f"🧪 Exécution: {test['module']}")
        
        response = requests.post(
            f"{BASE_URL}/modules/{test['module']}/execute",
            json={
                "device_id": device_id,
                "parameters": test['params']
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            results.append(result)
            print(f"✅ {test['module']}: {'Succès' if result.get('success') else 'Échec'}")
        else:
            print(f"❌ {test['module']}: Erreur HTTP {response.status_code}")
        
        time.sleep(2)  # Délai entre tests
    
    # 3. Rapport final
    success_count = sum(1 for r in results if r.get('success'))
    print(f"\n📊 Résultats: {success_count}/{len(results)} tests réussis")
    
    return success_count == len(results)

if __name__ == "__main__":
    success = run_automated_test_suite()
    exit(0 if success else 1)
```

### Intégration CI/CD

#### 1. GitHub Actions
```yaml
# .github/workflows/mobiq-tests.yml
name: MOBIQ Automated Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        pip install -r src/backend/requirements.txt
    
    - name: Start MOBIQ backend
      run: |
        python simple-server.py &
        sleep 10
    
    - name: Run API tests
      run: |
        python tests/api_tests.py
    
    - name: Generate report
      run: |
        python scripts/generate_test_report.py
```

---

## 📞 Support et Communauté

### Ressources d'Aide

1. **Documentation Technique** : `/docs` dans le projet
2. **API Documentation** : `http://localhost:8003/docs` (Swagger)
3. **Issues GitHub** : Pour signaler des bugs
4. **Discussions** : Pour questions et suggestions

### Contact

- **Email Support** : support@mobiq-framework.com
- **Documentation** : https://docs.mobiq-framework.com
- **GitHub** : https://github.com/F2G-Telco-Academy/ADB-automation-tool

---

## 📄 Licence et Crédits

**MOBIQ Framework** est distribué sous licence MIT.

**Développé par** : F2G Telco Academy  
**Version** : 2.2.0  
**Dernière mise à jour** : Janvier 2025

---

*Ce guide sera mis à jour régulièrement. Pour la version la plus récente, consultez la documentation en ligne.*