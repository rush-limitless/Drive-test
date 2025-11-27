# Script de lancement automatique de l'application Telco ADB Automation
Write-Host "=== LANCEMENT TELCO ADB AUTOMATION ===" -ForegroundColor Cyan

# Vérifier Node.js
Write-Host "Vérification de Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "Node.js détecté: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERREUR: Node.js non trouvé. Redémarrez votre terminal après installation." -ForegroundColor Red
    exit 1
}

# Installation des dépendances si nécessaire
if (!(Test-Path "node_modules")) {
    Write-Host "Installation des dépendances Electron..." -ForegroundColor Yellow
    npm install
}

if (!(Test-Path "src\frontend\node_modules")) {
    Write-Host "Installation des dépendances React..." -ForegroundColor Yellow
    cd src\frontend
    npm install
    cd ..\..
}

# Installation des dépendances Python
Write-Host "Installation des dépendances Python..." -ForegroundColor Yellow
cd src\backend
pip install -r requirements.txt
cd ..\..

# Lancement de l'application
Write-Host "Lancement de l'application..." -ForegroundColor Green
Write-Host "Backend: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan

# Lancer en mode développement
npm run electron-dev