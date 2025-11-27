# Script de build PyInstaller pour TelcoADBServer
param(
    [string]$Python = "python"
)

$ErrorActionPreference = "Stop"
# Résolution robuste des chemins avec espaces
$ProjectDir = Split-Path -Parent $PSScriptRoot
$VenvPath   = Join-Path $ProjectDir ".venv-build"
$VenvPython = Join-Path $VenvPath "Scripts\python.exe"

Write-Host "🔧 Preparing build virtual environment..." -ForegroundColor Cyan
if (-not (Test-Path $VenvPython)) {
    & $Python -m venv $VenvPath
}

Write-Host "📦 Installing build dependencies..." -ForegroundColor Yellow
& $VenvPython -m pip install --upgrade pip
& $VenvPython -m pip install -r (Join-Path $ProjectDir "src\backend\requirements.txt")
& $VenvPython -m pip install pyinstaller

Write-Host "🏗️ Building TelcoADBServer.exe..." -ForegroundColor Yellow
Set-Location "$ProjectDir"
& (Join-Path $VenvPath "Scripts\pyinstaller.exe") --clean --noconfirm "build\simple-server.spec"

Write-Host "✅ Build complete!" -ForegroundColor Green
Write-Host "Executable location: $ProjectDir\dist\TelcoADBServer\TelcoADBServer.exe" -ForegroundColor Cyan
