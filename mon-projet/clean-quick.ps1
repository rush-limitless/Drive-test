# Nettoyage rapide - Garde node_modules et platform-tools
# Usage: .\clean-quick.ps1

$ErrorActionPreference = "SilentlyContinue"
$ProjectDir = "C:\Users\rush\Pictures\ADB Tool\ADB-automation-tool\mon-projet"

Write-Host "🧹 Nettoyage rapide..." -ForegroundColor Cyan
Set-Location $ProjectDir

# Suppression rapide des dossiers de build
Remove-Item -Recurse -Force "build" 2>$null
Remove-Item -Recurse -Force "dist" 2>$null
Remove-Item -Recurse -Force ".venv-build" 2>$null
Remove-Item -Recurse -Force "src\electron\resources" 2>$null
Remove-Item -Recurse -Force "src\electron\dist" 2>$null
Remove-Item -Recurse -Force "src\frontend\build" 2>$null

# Nettoyage des caches Python
Get-ChildItem -Recurse -Directory -Name "__pycache__" | Remove-Item -Recurse -Force 2>$null

Write-Host "✅ Nettoyage rapide terminé !" -ForegroundColor Green