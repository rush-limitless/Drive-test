## Building Windows Desktop Release

### 1. Préparer l’environnement
```powershell
cd C:\Users\rush\Pictures\ADB Tool\ADB-automation-tool\mon-projet
.\.venv\Scripts\python.exe -m pip install -r src\backend\requirements.txt
npm install                         # à la racine pour Electron
```

### 2. Vérifier/Tester
Le script `scripts\run-desktop.ps1` exécute maintenant les tests FastAPI avant de rebuilder/déployer l’UI :
```powershell
.\scripts\run-desktop.ps1
```
Options utiles : `-SkipBackendTests`, `-SkipFrontendBuild`, `-SkipDeploy`.

### 3. Générer le backend packagé
```powershell
powershell -ExecutionPolicy Bypass -File .\build\build-exe.ps1
```
L’exécutable est produit dans `dist\TelcoADBServer\TelcoADBServer.exe`.

### 4. Construire l’installeur Electron (NSIS)
```powershell
powershell -ExecutionPolicy Bypass -File .\build-mobiq-v2.ps1
```
Ce script :
1. rebâtit le frontend,
2. appelle PyInstaller,
3. recopie backend/frontend dans `src\electron\resources`,
4. lance `npm run build` côté Electron,
5. exécute `electron-builder --win nsis`.

Le setup final se trouve dans `build\electron\MOBIQ-Setup-2.0.0.exe`.
