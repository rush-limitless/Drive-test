# Script de nettoyage complet - Supprime tous les résidus de builds
# Nettoie build, dist, node_modules, caches, et installeurs

param(
    [switch]$Force,
    [switch]$KeepNodeModules
)

$ErrorActionPreference = "Stop"
$ProjectDir = "C:\Users\rush\Pictures\ADB Tool\ADB-automation-tool\mon-projet"

Write-Host "=== NETTOYAGE COMPLET DES BUILDS ===" -ForegroundColor Red

if (-not $Force) {
    $Confirm = Read-Host "Voulez-vous vraiment supprimer TOUS les builds et caches ? (y/N)"
    if ($Confirm -ne "y" -and $Confirm -ne "Y") {
        Write-Host "Annulé par l'utilisateur." -ForegroundColor Yellow
        exit 0
    }
}

Set-Location $ProjectDir

# 1. Dossiers de build principaux
Write-Host "1. Suppression des dossiers de build..." -ForegroundColor Yellow
$BuildDirs = @(
    "build",
    "dist", 
    ".venv-build",
    "temp-adb"
)

foreach ($Dir in $BuildDirs) {
    if (Test-Path $Dir) {
        Write-Host "  Suppression: $Dir" -ForegroundColor Gray
        Remove-Item -Recurse -Force $Dir -ErrorAction SilentlyContinue
    }
}

# 2. Ressources Electron
Write-Host "2. Nettoyage des ressources Electron..." -ForegroundColor Yellow
$ElectronDirs = @(
    "src\electron\resources",
    "src\electron\dist"
)

foreach ($Dir in $ElectronDirs) {
    if (Test-Path $Dir) {
        Write-Host "  Suppression: $Dir" -ForegroundColor Gray
        Remove-Item -Recurse -Force $Dir -ErrorAction SilentlyContinue
    }
}

# 3. Frontend build
Write-Host "3. Nettoyage du frontend..." -ForegroundColor Yellow
if (Test-Path "src\frontend\build") {
    Write-Host "  Suppression: src\frontend\build" -ForegroundColor Gray
    Remove-Item -Recurse -Force "src\frontend\build" -ErrorAction SilentlyContinue
}

# 4. Node modules (optionnel)
if (-not $KeepNodeModules) {
    Write-Host "4. Suppression des node_modules..." -ForegroundColor Yellow
    $NodeDirs = @(
        "src\frontend\node_modules",
        "src\electron\node_modules"
    )
    
    foreach ($Dir in $NodeDirs) {
        if (Test-Path $Dir) {
            Write-Host "  Suppression: $Dir" -ForegroundColor Gray
            Remove-Item -Recurse -Force $Dir -ErrorAction SilentlyContinue
        }
    }
} else {
    Write-Host "4. Conservation des node_modules (--KeepNodeModules)" -ForegroundColor Cyan
}

# 5. Caches Python
Write-Host "5. Nettoyage des caches Python..." -ForegroundColor Yellow
$PythonCaches = Get-ChildItem -Recurse -Directory -Name "__pycache__" -ErrorAction SilentlyContinue
foreach ($Cache in $PythonCaches) {
    Write-Host "  Suppression: $Cache" -ForegroundColor Gray
    Remove-Item -Recurse -Force $Cache -ErrorAction SilentlyContinue
}

# 6. Fichiers temporaires
Write-Host "6. Suppression des fichiers temporaires..." -ForegroundColor Yellow
$TempFiles = @(
    "*.log",
    "*.tmp",
    "*.pyc",
    ".DS_Store",
    "Thumbs.db"
)

foreach ($Pattern in $TempFiles) {
    $Files = Get-ChildItem -Recurse -File -Name $Pattern -ErrorAction SilentlyContinue
    foreach ($File in $Files) {
        Write-Host "  Suppression: $File" -ForegroundColor Gray
        Remove-Item -Force $File -ErrorAction SilentlyContinue
    }
}

# 7. Installeurs générés
Write-Host "7. Suppression des anciens installeurs..." -ForegroundColor Yellow
$Installers = Get-ChildItem -Name "*.exe" | Where-Object { 
    $_ -like "*Setup*" -or $_ -like "*MOBIQ*" -or $_ -like "*ADB*Framework*"
}

foreach ($Installer in $Installers) {
    Write-Host "  Suppression: $Installer" -ForegroundColor Gray
    Remove-Item -Force $Installer -ErrorAction SilentlyContinue
}

# 8. Nettoyage des logs
Write-Host "8. Nettoyage des logs..." -ForegroundColor Yellow
if (Test-Path "src\backend\artifacts\logs") {
    Get-ChildItem "src\backend\artifacts\logs\*.log" | ForEach-Object {
        Write-Host "  Vidage: $($_.Name)" -ForegroundColor Gray
        Clear-Content $_.FullName -ErrorAction SilentlyContinue
    }
}

# 9. Vérification finale
Write-Host "9. Vérification de l'espace libéré..." -ForegroundColor Yellow
$RemainingSize = 0
$CheckDirs = @("build", "dist", ".venv-build")
foreach ($Dir in $CheckDirs) {
    if (Test-Path $Dir) {
        $Size = (Get-ChildItem -Recurse $Dir -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        $RemainingSize += $Size
    }
}

if ($RemainingSize -eq 0) {
    Write-Host "✅ Nettoyage complet réussi !" -ForegroundColor Green
} else {
    $SizeMB = [math]::Round($RemainingSize / 1MB, 2)
    Write-Host "⚠️  Quelques fichiers restants: $SizeMB MB" -ForegroundColor Yellow
}

Write-Host "=== NETTOYAGE TERMINÉ ===" -ForegroundColor Green
Write-Host ""
Write-Host "Prêt pour un nouveau build propre !" -ForegroundColor Cyan