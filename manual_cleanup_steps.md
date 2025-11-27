# Nettoyage Manuel des Installations Précédentes

## 🧹 **Étapes de Nettoyage Manuel**

### 1. **Arrêter tous les processus**
```
Ctrl + Shift + Échap → Gestionnaire des tâches
Rechercher et arrêter :
- ADB Framework Telco Automation.exe
- adb-framework-telco-automation.exe  
- TelcoADBServer.exe
- python.exe (si lié au projet)
```

### 2. **Désinstaller via Panneau de Configuration**
```
Paramètres → Applications → Applications et fonctionnalités
Rechercher : "ADB Framework" ou "Telco"
Cliquer → Désinstaller
```

### 3. **Supprimer les dossiers d'installation**
```
C:\Program Files\ADB Framework Telco Automation\
C:\Program Files (x86)\ADB Framework Telco Automation\
C:\Users\[nom]\AppData\Local\ADB Framework Telco Automation\
C:\Users\[nom]\AppData\Local\adb-framework-telco-automation\
C:\Users\[nom]\AppData\Roaming\ADB Framework Telco Automation\
```

### 4. **Supprimer les raccourcis**
```
Bureau : ADB Framework Telco Automation.lnk
Menu Démarrer : Programmes\F2G Telco\
```

### 5. **Nettoyer le registre** (Optionnel - Avancé)
```
Win + R → regedit
Supprimer les clés :
HKEY_CURRENT_USER\SOFTWARE\ADB Framework Telco Automation
HKEY_LOCAL_MACHINE\SOFTWARE\ADB Framework Telco Automation
HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\[GUID]
```

### 6. **Vider les caches**
```
%TEMP% → Supprimer fichiers *telco* et *adb-framework*
%APPDATA%\Electron → Supprimer le dossier
```

## 🚀 **Méthode Automatique (Recommandée)**

**Exécuter le script de nettoyage :**
```batch
cleanup_previous_installations.bat
```

Ce script fait tout automatiquement et en sécurité.

## ⚠️ **Important**

- **Fermer toutes les applications** avant le nettoyage
- **Redémarrer l'ordinateur** après le nettoyage
- **Exécuter en tant qu'administrateur** si nécessaire