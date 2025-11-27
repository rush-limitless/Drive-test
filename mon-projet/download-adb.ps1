# Script pour télécharger et inclure ADB dans le build
param(
    [string]$AdbUrl = "https://dl.google.com/android/repository/platform-tools-latest-windows.zip"
)

$ErrorActionPreference = "Stop"
$ProjectDir = "C:\Users\rush\Pictures\ADB Tool\ADB-automation-tool\mon-projet"

Write-Host "=== TÉLÉCHARGEMENT ADB PLATFORM-TOOLS ===" -ForegroundColor Green

# Créer le dossier temporaire
$TempDir = "$ProjectDir\temp-adb"
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

try {
    # Télécharger platform-tools
    Write-Host "Téléchargement de platform-tools..." -ForegroundColor Yellow
    $ZipPath = "$TempDir\platform-tools.zip"
    Invoke-WebRequest -Uri $AdbUrl -OutFile $ZipPath -UseBasicParsing
    
    # Extraire
    Write-Host "Extraction..." -ForegroundColor Yellow
    Expand-Archive -Path $ZipPath -DestinationPath $TempDir -Force
    
    # Copier vers le projet
    Write-Host "Installation dans le projet..." -ForegroundColor Yellow
    $SourceDir = "$TempDir\platform-tools"
    $DestDir = "$ProjectDir\platform-tools"
    
    if (Test-Path $DestDir) {
        Remove-Item -Recurse -Force $DestDir
    }
    
    Copy-Item -Recurse -Force $SourceDir $DestDir
    
    # Vérifier
    $AdbExe = "$DestDir\adb.exe"
    if (Test-Path $AdbExe) {
        Write-Host "✅ ADB installé avec succès !" -ForegroundColor Green
        Write-Host "Localisation: $AdbExe" -ForegroundColor Cyan
        
        # Tester ADB
        $Version = & $AdbExe version 2>$null
        Write-Host "Version: $($Version -split "`n" | Select-Object -First 1)" -ForegroundColor Cyan
    } else {
        Write-Error "❌ Échec de l'installation ADB"
    }
    
} finally {
    # Nettoyer
    if (Test-Path $TempDir) {
        Remove-Item -Recurse -Force $TempDir
    }
}

Write-Host "=== TERMINÉ ===" -ForegroundColor Green