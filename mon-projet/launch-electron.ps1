#!/usr/bin/env pwsh

Write-Host "Démarrage de l'application ADB Framework avec Electron..." -ForegroundColor Green

# Vérifier si Electron est installé
$electronPath = ".\node_modules\.bin\electron.cmd"
if (-not (Test-Path $electronPath)) {
    Write-Host "Electron n'est pas installé. Installation en cours..." -ForegroundColor Yellow
    npm install electron@25.9.8 --save-dev
}

# Compiler le TypeScript d'Electron si nécessaire
Write-Host "Compilation du code Electron..." -ForegroundColor Yellow
Set-Location "src\electron"
npm run build
Set-Location "..\..\"

# Lancer l'application Electron
Write-Host "Lancement de l'application Electron..." -ForegroundColor Green
& $electronPath "src\electron"