# Script de build MOBIQ v2.1.0 - AVEC ADB INCLUS
# Création d'un installeur .exe complet avec backend + frontend + Electron + ADB

param(
    [string]$Python = "C:\Users\rush\AppData\Local\Programs\Python\Python312\python.exe"
)

$ErrorActionPreference = "Stop"
$ProjectDir = "C:\Users\rush\Pictures\ADB Tool\ADB-automation-tool\mon-projet"

Write-Host "=== BUILD MOBIQ v2.1.0 - AVEC ADB ===" -ForegroundColor Green

# 0. Vérifier que ADB est présent
Write-Host "0. Vérification d'ADB..." -ForegroundColor Yellow
$AdbPath = "$ProjectDir\platform-tools\adb.exe"
if (-not (Test-Path $AdbPath)) {
    Write-Host "ADB manquant, téléchargement automatique..." -ForegroundColor Yellow
    powershell -ExecutionPolicy Bypass -File .\download-adb.ps1
}

if (Test-Path $AdbPath) {
    Write-Host "✅ ADB trouvé : $AdbPath" -ForegroundColor Green
} else {
    Write-Error "❌ ADB introuvable ! Arrêt du build."
    exit 1
}

# 1. Construire le frontend React
Write-Host "1. Construction du frontend React..." -ForegroundColor Yellow
Set-Location "$ProjectDir\src\frontend"
npm install
npm run build

# 2. Construire le backend avec PyInstaller (maintenant avec ADB)
Write-Host "2. Construction du backend avec PyInstaller + ADB..." -ForegroundColor Yellow
Set-Location $ProjectDir

# Build avec PyInstaller
powershell -ExecutionPolicy Bypass -File .\build\build-exe.ps1 -Python $Python

# Vérifier que le build backend a réussi
if (-not (Test-Path "dist\TelcoADBServer\TelcoADBServer.exe")) {
    Write-Error "Le build du backend a échoué!"
    exit 1
}

# 3. Préparer les ressources Electron
Write-Host "3. Préparation des ressources Electron..." -ForegroundColor Yellow

# Backend
Remove-Item -Recurse -Force ".\src\electron\resources\backend" -ErrorAction SilentlyContinue
New-Item -ItemType Directory ".\src\electron\resources\backend\server" -Force | Out-Null
Copy-Item -Recurse -Force ".\dist\TelcoADBServer\*" ".\src\electron\resources\backend\server\"

# Frontend
Remove-Item -Recurse -Force ".\src\electron\resources\frontend" -ErrorAction SilentlyContinue
New-Item -ItemType Directory ".\src\electron\resources\frontend\build" -Force | Out-Null
Copy-Item -Recurse -Force ".\src\frontend\build\*" ".\src\electron\resources\frontend\build\"

# 4. Construire l'application Electron
Write-Host "4. Construction de l'application Electron..." -ForegroundColor Yellow
Set-Location ".\src\electron"
npm install
npm run build

# 5. Créer l'installeur Windows
Write-Host "5. Création de l'installeur Windows..." -ForegroundColor Yellow
npx electron-builder --win nsis

# 6. Vérifier le résultat
$InstallerPath = "$ProjectDir\build\electron\MOBIQ-Setup-2.1.0.exe"
if (Test-Path $InstallerPath) {
    Write-Host "=== BUILD RÉUSSI ===" -ForegroundColor Green
    Write-Host "Installeur créé: $InstallerPath" -ForegroundColor Cyan
    
    # Afficher la taille du fichier
    $FileSize = (Get-Item $InstallerPath).Length / 1MB
    Write-Host "Taille: $([math]::Round($FileSize, 2)) MB" -ForegroundColor Cyan
    
    # Vérifier qu'ADB est inclus
    $UnpackedDir = "$ProjectDir\build\electron\win-unpacked\resources\backend\server"
    $AdbInBuild = "$UnpackedDir\platform-tools\adb.exe"
    if (Test-Path $AdbInBuild) {
        Write-Host "✅ ADB inclus dans le build !" -ForegroundColor Green
    } else {
        Write-Host "⚠️  ADB non trouvé dans le build" -ForegroundColor Yellow
    }
} else {
    Write-Error "Échec de la création de l'installeur!"
    exit 1
}

Write-Host "=== TERMINÉ - MOBIQ v2.1.0 AVEC ADB ===" -ForegroundColor Green