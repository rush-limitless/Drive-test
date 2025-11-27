#!/usr/bin/env powershell
# Script de test pour l'installeur ADB Framework Telco Automation

Write-Host "=== Test de l'installeur ADB Framework Telco Automation ===" -ForegroundColor Cyan

$installerPath = ".\build\electron\ADB Framework Telco Automation-Setup-1.0.0.exe"
$installDir = "$env:LOCALAPPDATA\Programs\adb-framework-telco-automation"

# Vérifier que l'installeur existe
if (-not (Test-Path $installerPath)) {
    Write-Host "❌ Installeur non trouvé: $installerPath" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Installeur trouvé: $installerPath" -ForegroundColor Green
$size = (Get-Item $installerPath).Length / 1MB
Write-Host "📦 Taille: $([math]::Round($size, 2)) MB" -ForegroundColor Yellow

# Vérifier si une version précédente est installée
if (Test-Path $installDir) {
    Write-Host "⚠️  Version précédente détectée dans: $installDir" -ForegroundColor Yellow
    Write-Host "   Désinstallez d'abord via 'Apps and Features' ou supprimez manuellement" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🚀 Pour installer:" -ForegroundColor Cyan
Write-Host "   1. Exécutez: $installerPath" -ForegroundColor White
Write-Host "   2. Suivez l'assistant d'installation" -ForegroundColor White
Write-Host "   3. L'application sera installée dans: $installDir" -ForegroundColor White

Write-Host ""
Write-Host "🔍 Pour tester après installation:" -ForegroundColor Cyan
Write-Host "   cd `"$installDir`"" -ForegroundColor White
Write-Host "   .\`"ADB Framework Telco Automation.exe`"" -ForegroundColor White

Write-Host ""
Write-Host "✅ Vérifications attendues:" -ForegroundColor Green
Write-Host "   - Backend démarre (Uvicorn running on http://127.0.0.1:8007)" -ForegroundColor White
Write-Host "   - Interface React se charge sans erreur 'file not found'" -ForegroundColor White
Write-Host "   - Dashboard affiche les appareils connectés" -ForegroundColor White

Write-Host ""
Write-Host "=== Installeur prêt pour déploiement ===" -ForegroundColor Green