# 📁 Telco ADB Automation Framework - Structure Complète

## 🏗️ Architecture Générale

```
mon-projet/
├── 🚀 SERVEUR PRINCIPAL
│   └── simple-server.py              # FastAPI server (PORT 8003)
│
├── 🎯 INTERFACE WEB
│   └── src/backend/static/index.html # Interface utilisateur complète
│
├── 🔧 MODULES ADB
│   └── src/backend/modules/          # 29 modules télécoms
│
├── 📋 WORKFLOWS
│   └── specs/                        # 10 flux YAML prédéfinis
│
└── 🛠️ SCRIPTS & CONFIG
    ├── adb_scripts/                  # Scripts shell ADB
    └── .specify/                     # Configuration Spec-Kit
```

## 📂 Structure Détaillée

### 🚀 **Serveur Principal**
```
simple-server.py                      # Serveur FastAPI principal
├── API REST endpoints
├── Gestion multi-téléphones
├── Exécution des modules
└── Interface web intégrée
```

### 🎯 **Interface Web** (`src/backend/static/`)
```
index.html                           # Interface complète (HTML/CSS/JS)
├── Dashboard avec statistiques
├── Gestion des appareils connectés
├── 29 modules de test
├── Workflows personnalisés
├── Logs temps réel
└── Recherche globale
```

### 🔧 **Backend Modules** (`src/backend/`)
```
modules/
├── adb_executor.py                  # Base executor ADB
├── telco_modules.py                 # 29 modules télécoms
│   ├── voice_call_test()           # Test d'appel avec paramètres
│   ├── enable_airplane_mode()      # Mode avion
│   ├── force_network_type()        # Force LTE/3G/2G
│   ├── send_sms()                  # Envoi SMS
│   ├── check_signal_strength()     # Force du signal
│   └── ... (24 autres modules)
└── flow_executor.py                 # Orchestrateur de workflows

api/                                 # API endpoints (architecture avancée)
├── devices.py                       # Gestion des appareils
├── executions.py                    # Suivi des exécutions
├── flows.py                         # Gestion des workflows
└── modules.py                       # Modules disponibles

core/                                # Configuration système
├── config.py                        # Configuration globale
├── database.py                      # Base de données
└── logging.py                       # Système de logs

models/                              # Modèles de données
├── device.py                        # Modèle appareil
├── execution.py                     # Modèle exécution
└── flow.py                          # Modèle workflow

services/                            # Services métier
├── adb_manager.py                   # Gestionnaire ADB
├── device_manager.py                # Gestionnaire d'appareils
└── execution_engine.py              # Moteur d'exécution
```

### 📋 **Workflows** (`specs/`)
```
flow.daily_smoke.yaml               # Test quotidien (Voice+SMS+Data)
flow.complete_telco_suite.yaml      # Suite complète télécoms
flow.network_stress_test.yaml       # Test de stress réseau
flow.communication_full.yaml        # Test communication complet
flow.airplane_mode_complete.yaml    # Test mode avion complet
flow.connectivity_matrix.yaml       # Matrice de connectivité
flow.data_session_stress.yaml       # Stress test session données
flow.device_management.yaml         # Gestion des appareils
flow.network_switching.yaml         # Commutation réseau
flow.screen_power_test.yaml         # Test écran/alimentation
```

### 🛠️ **Scripts ADB** (`adb_scripts/`)
```
call_control.sh                      # Contrôle des appels
sms_control.sh                       # Contrôle SMS
network_checks.sh                    # Vérifications réseau
network_performance.sh               # Performance réseau
wifi_control.sh                      # Contrôle Wi-Fi
mobile_data_control.sh               # Contrôle données mobiles
enable_airplane_mode.sh              # Activation mode avion
disable_airplane_mode.sh             # Désactivation mode avion
force_lte.sh                         # Force LTE
force_3g.sh                          # Force 3G
force_2g.sh                          # Force 2G
device_control.sh                    # Contrôle appareil
app_management.sh                    # Gestion applications
data_session.sh                      # Session de données
```

### 🎨 **Frontend React** (`src/frontend/`) - *Préparé mais non utilisé*
```
src/
├── components/
│   ├── DeviceManager/              # Gestion des appareils
│   ├── ExecutionDashboard/         # Tableau de bord exécution
│   └── FlowBuilder/                # Constructeur de workflows
├── pages/
│   ├── Dashboard.tsx               # Page principale
│   ├── FlowComposer.tsx           # Compositeur de flux
│   └── Reports.tsx                 # Rapports
└── services/
    ├── deviceApi.ts                # API appareils
    ├── executionApi.ts             # API exécutions
    └── websocket.ts                # WebSocket temps réel

package.json                        # Dépendances React/MUI/TypeScript
```

### 🔧 **Modules Individuels** (`src/modules/`)
```
call_test/module.py                  # Module test d'appel
sms_test/module.py                   # Module test SMS
data_test/module.py                  # Module test données
base_module.py                       # Module de base
```

### ⚙️ **Configuration Spec-Kit** (`.specify/`)
```
memory/constitution.md               # Principes du projet
scripts/powershell/                  # Scripts PowerShell
├── check-prerequisites.ps1         # Vérification prérequis
├── create-new-feature.ps1          # Création de fonctionnalités
└── setup-plan.ps1                  # Configuration du plan

templates/                           # Modèles Spec-Kit
├── spec-template.md                # Modèle spécification
├── plan-template.md                # Modèle plan
└── tasks-template.md               # Modèle tâches
```

### 🧪 **Tests & Utilitaires**
```
test_call.py                        # Test direct d'appel
test_interface.html                 # Interface de test simple
tests/                              # Tests unitaires
docs/                               # Documentation
```

### 📦 **Configuration Projet**
```
package.json                        # Configuration Node.js
.eslintrc.json                     # Configuration ESLint
.prettierrc                        # Configuration Prettier
.gitignore                         # Fichiers ignorés Git
requirements.txt                   # Dépendances Python
```

### 🚀 **Scripts de Lancement**
```
launch-app.ps1                     # Lancement application complète
launch-ui.ps1                      # Lancement interface uniquement
launch-without-node.ps1            # Lancement sans Node.js
fix-and-launch.ps1                 # Correction et lancement
install-node-manual.ps1            # Installation Node.js manuelle
```

## 🔄 **Flux de Données**

```
Interface Web (index.html)
    ↓ HTTP Requests
FastAPI Server (simple-server.py)
    ↓ Module Execution
Flow Executor (flow_executor.py)
    ↓ ADB Commands
Telco Modules (telco_modules.py)
    ↓ Shell Commands
ADB Scripts (adb_scripts/)
    ↓ ADB Protocol
Android Devices
```

## 🎯 **Points d'Entrée**

1. **Interface Web** : `http://localhost:8003`
2. **API Documentation** : `http://localhost:8003/docs`
3. **Serveur Principal** : `python simple-server.py`
4. **Test Direct** : `python test_call.py`

## 📊 **Statistiques**

- **29 Modules ADB** télécoms complets
- **10 Workflows** YAML prédéfinis
- **14 Scripts** shell ADB
- **1 Interface** web complète
- **Multi-téléphones** supporté
- **Logs temps réel** intégrés