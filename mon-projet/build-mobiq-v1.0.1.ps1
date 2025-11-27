# Build MOBIQ v1.0.1 - Version complète avec TelcoADBServer et ADB
param(
    [string]$Python = "C:\Users\rush\AppData\Local\Programs\Python\Python312\python.exe"
)

$ErrorActionPreference = "Stop"
$ProjectDir = "C:\Users\rush\Pictures\ADB Tool\ADB-automation-tool\mon-projet"

Write-Host "=== BUILD MOBIQ v1.0.1 ===" -ForegroundColor Cyan
Write-Host "Version complète avec TelcoADBServer + ADB intégré" -ForegroundColor Yellow

Set-Location $ProjectDir

# 1. Construire le frontend React
Write-Host "`n1. Construction du frontend React..." -ForegroundColor Yellow
Set-Location "src\frontend"
if (-not (Test-Path "node_modules")) {
    Write-Host "Installation des dépendances frontend..." -ForegroundColor Gray
    npm install
}
Write-Host "Build du frontend..." -ForegroundColor Gray
npm run build

# 2. Construire le backend avec PyInstaller
Write-Host "`n2. Construction du backend TelcoADBServer..." -ForegroundColor Yellow
Set-Location $ProjectDir
powershell -ExecutionPolicy Bypass -File ".\build\build-exe.ps1" -Python $Python

# Vérification du build backend
if (-not (Test-Path "dist\TelcoADBServer\TelcoADBServer.exe")) {
    Write-Host "❌ Erreur: TelcoADBServer.exe non généré" -ForegroundColor Red
    exit 1
}
Write-Host "✅ TelcoADBServer.exe généré" -ForegroundColor Green

# 3. Préparer les ressources Electron
Write-Host "`n3. Préparation des ressources Electron..." -ForegroundColor Yellow

# Backend
Write-Host "Copie du backend..." -ForegroundColor Gray
Remove-Item -Recurse -Force ".\src\electron\resources\backend" -ErrorAction SilentlyContinue
New-Item -ItemType Directory ".\src\electron\resources\backend\server" -Force | Out-Null
Copy-Item -Recurse -Force ".\dist\TelcoADBServer\*" ".\src\electron\resources\backend\server\"

# Frontend
Write-Host "Copie du frontend..." -ForegroundColor Gray
Remove-Item -Recurse -Force ".\src\electron\resources\frontend" -ErrorAction SilentlyContinue
New-Item -ItemType Directory ".\src\electron\resources\frontend\build" -Force | Out-Null
Copy-Item -Recurse -Force ".\src\frontend\build\*" ".\src\electron\resources\frontend\build\"

# ADB Platform Tools
Write-Host "Copie d'ADB..." -ForegroundColor Gray
Remove-Item -Recurse -Force ".\src\electron\resources\adb" -ErrorAction SilentlyContinue
New-Item -ItemType Directory ".\src\electron\resources\adb" -Force | Out-Null
Copy-Item -Recurse -Force ".\platform-tools\*" ".\src\electron\resources\adb\"

# 4. Mise à jour package.json pour v1.0.1
Write-Host "`n4. Mise à jour de la version..." -ForegroundColor Yellow
$PackageJson = Get-Content "src\electron\package.json" | ConvertFrom-Json
$PackageJson.version = "1.0.1"
$PackageJson.name = "mobiq"
$PackageJson.productName = "MOBIQ"
$PackageJson.description = "Mobile Test Automation Tool v1.0.1"

# Configuration build
$PackageJson.build.appId = "com.mobiq.automation"
$PackageJson.build.productName = "MOBIQ"
$PackageJson.build.directories.output = "../../build/electron"
$PackageJson.build.files = @("dist/**/*", "resources/**/*", "package.json")
$PackageJson.build.extraResources = @(
    @{ from = "resources/backend"; to = "backend" },
    @{ from = "resources/frontend"; to = "frontend" },
    @{ from = "resources/adb"; to = "adb" }
)
$PackageJson.build.nsis.artifactName = "MOBIQ-Setup-1.0.1.exe"

$PackageJson | ConvertTo-Json -Depth 10 | Set-Content "src\electron\package.json"
Write-Host "✅ Version mise à jour: 1.0.1" -ForegroundColor Green

# 5. Construction Electron
Write-Host "`n5. Construction de l'application Electron..." -ForegroundColor Yellow
Set-Location "src\electron"

if (-not (Test-Path "node_modules")) {
    Write-Host "Installation des dépendances Electron..." -ForegroundColor Gray
    npm install
}

Write-Host "Compilation TypeScript..." -ForegroundColor Gray
npm run build

Write-Host "Génération de l'installeur Windows..." -ForegroundColor Gray
npx electron-builder --win nsis

# 6. Vérification finale
Write-Host "`n6. Vérification du build..." -ForegroundColor Yellow
Set-Location $ProjectDir

$InstallerPath = "build\electron\MOBIQ-Setup-1.0.1.exe"
if (Test-Path $InstallerPath) {
    $Size = [math]::Round((Get-Item $InstallerPath).Length / 1MB, 2)
    Write-Host "✅ MOBIQ-Setup-1.0.1.exe généré ($Size MB)" -ForegroundColor Green
    Write-Host "📍 Emplacement: $ProjectDir\$InstallerPath" -ForegroundColor Cyan
} else {
    Write-Host "❌ Erreur: Installeur non généré" -ForegroundColor Red
    exit 1
}

# 7. Résumé
Write-Host "`n=== BUILD TERMINÉ ===" -ForegroundColor Green
Write-Host "MOBIQ v1.0.1 - Installeur Windows complet" -ForegroundColor White
Write-Host "Inclut:" -ForegroundColor Yellow
Write-Host "  ✅ TelcoADBServer.exe (backend Python)" -ForegroundColor White
Write-Host "  ✅ Frontend React" -ForegroundColor White
Write-Host "  ✅ ADB Platform Tools" -ForegroundColor White
Write-Host "  ✅ Interface Electron" -ForegroundColor White
Write-Host "`nPour installer: .\build\electron\MOBIQ-Setup-1.0.1.exe" -ForegroundColor Cyan