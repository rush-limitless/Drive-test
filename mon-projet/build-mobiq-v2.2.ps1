# Script de build MOBIQ v2.2.0 - AVEC ADB FORCÉ
# Création d'un installeur .exe complet avec backend + frontend + Electron + ADB

param(
    [string]$Python = "C:\Users\rush\AppData\Local\Programs\Python\Python312\python.exe"
)

$ErrorActionPreference = "Stop"
$ProjectDir = "C:\Users\rush\Pictures\ADB Tool\ADB-automation-tool\mon-projet"

# Synchronize + bump version once per build
$env:MOBIQ_BUILD_BUMP = "1"
$env:MOBIQ_BUILD_ID = (Get-Date -Format "yyyyMMddHHmmss")
& node (Join-Path $ProjectDir "scripts\sync-version.js") | Write-Host
$Version = (Get-Content (Join-Path $ProjectDir "package.json") | ConvertFrom-Json).version

Write-Host ("=== BUILD MOBIQ v{0} - AVEC ADB FORC? ===" -f $Version) -ForegroundColor Green

# Toujours se placer dans le répertoire projet pour les chemins relatifs
Set-Location $ProjectDir

# 0. Vérifier que ADB est présent
Write-Host "0. Vérification d'ADB..." -ForegroundColor Yellow
$AdbPath = "$ProjectDir\platform-tools\adb.exe"
if (-not (Test-Path $AdbPath)) {
    Write-Host "ADB manquant, téléchargement automatique..." -ForegroundColor Yellow
    powershell -ExecutionPolicy Bypass -File .\download-adb.ps1
}

if (Test-Path $AdbPath) {
    Write-Host "✅ ADB trouvé : $AdbPath" -ForegroundColor Green
    # Exécuter ADB avec chemin protégé par guillemets
    $AdbVersion = & "$AdbPath" "version" 2>$null
    if ($LASTEXITCODE -eq 0 -and $AdbVersion) {
        $AdbVersionLine = ($AdbVersion -split "`n")[0]
        Write-Host "Version ADB: $AdbVersionLine" -ForegroundColor Cyan
    } else {
        Write-Host "Version ADB: (non déterminée)" -ForegroundColor Yellow
    }
} else {
    Write-Error "❌ ADB introuvable ! Arrêt du build."
    exit 1
}

# 1. Construire le frontend React
Write-Host "1. Construction du frontend React..." -ForegroundColor Yellow
Set-Location "$ProjectDir\src\frontend"
& "$env:ComSpec" /c "npm install --silent"
& "$env:ComSpec" /c "npm run build"

# 2. Construire le backend avec PyInstaller (maintenant avec ADB forcé)
Write-Host "2. Construction du backend avec PyInstaller + ADB forcé..." -ForegroundColor Yellow
Set-Location $ProjectDir

# Nettoyer les anciens builds
Remove-Item -Recurse -Force "build\simple-server" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "dist\TelcoADBServer" -ErrorAction SilentlyContinue

# Build avec PyInstaller (appel direct du script pour conserver la session)
$BackendBuildScript = Join-Path $ProjectDir "build\build-exe.ps1"
try {
    & $BackendBuildScript -Python $Python
} catch {
    Write-Error "❌ build-exe.ps1 a échoué"
    throw
}

# Vérifier que le build backend a réussi (chemin absolu pour éviter les problèmes de contexte)
$BackendExePath = Join-Path $ProjectDir "dist\TelcoADBServer\TelcoADBServer.exe"
$BackendDir = Split-Path -Parent $BackendExePath
Write-Host ("Vérification du backend généré à: {0}" -f $BackendExePath) -ForegroundColor Cyan
$BackendWait = 0
while (-not (Test-Path -LiteralPath $BackendExePath) -and $BackendWait -lt 30) {
    Start-Sleep -Seconds 1
    $BackendWait++
}
$BackendExists = [System.IO.File]::Exists($BackendExePath)
Write-Host ("Présence du binaire backend: {0}" -f $BackendExists) -ForegroundColor Cyan
if (-not $BackendExists) {
    Write-Warning "Impossible de confirmer la présence de TelcoADBServer.exe (chemin: $BackendExePath). Poursuite du build."
} else {
    Write-Host ("✅ Backend généré: {0}" -f $BackendExePath) -ForegroundColor Green
}

# Vérifier qu'ADB est inclus dans le build
$AdbInBuild = Join-Path $ProjectDir "dist\TelcoADBServer\platform-tools\adb.exe"
if ([System.IO.File]::Exists($AdbInBuild)) {
    Write-Host "✅ ADB inclus dans le build backend !" -ForegroundColor Green
} else {
    Write-Host "⚠️  ADB non trouvé dans le build, copie manuelle..." -ForegroundColor Yellow
    $AdbTargetDir = Join-Path $ProjectDir "dist\TelcoADBServer\platform-tools"
    New-Item -ItemType Directory $AdbTargetDir -Force | Out-Null
    Copy-Item -Recurse -Force "$ProjectDir\platform-tools\*" $AdbTargetDir
    if (Test-Path (Join-Path $AdbTargetDir "adb.exe")) {
        Write-Host "✅ ADB copié manuellement !" -ForegroundColor Green
    } else {
        Write-Error "❌ Échec de la copie manuelle d'ADB"
        exit 1
    }
}

# 3. Préparer les ressources Electron
Write-Host "3. Préparation des ressources Electron..." -ForegroundColor Yellow

# Backend
Remove-Item -Recurse -Force "$ProjectDir\src\electron\resources\backend" -ErrorAction SilentlyContinue
$ElectronBackendDir = "$ProjectDir\src\electron\resources\backend\server"
New-Item -ItemType Directory $ElectronBackendDir -Force | Out-Null
Copy-Item -Recurse -Force "$ProjectDir\dist\TelcoADBServer\*" $ElectronBackendDir

# Frontend
Remove-Item -Recurse -Force "$ProjectDir\src\electron\resources\frontend" -ErrorAction SilentlyContinue
$ElectronFrontendDir = "$ProjectDir\src\electron\resources\frontend\build"
New-Item -ItemType Directory $ElectronFrontendDir -Force | Out-Null
Copy-Item -Recurse -Force "$ProjectDir\src\frontend\build\*" $ElectronFrontendDir

# 4. Construire l'application Electron
Write-Host "4. Construction de l'application Electron..." -ForegroundColor Yellow
Set-Location "$ProjectDir\src\electron"
& "$env:ComSpec" /c "npm install --silent"
& "$env:ComSpec" /c "npm run build"

# 5. Créer l'installeur Windows
Write-Host "5. Création de l'installeur Windows..." -ForegroundColor Yellow
& "$env:ComSpec" /c "npx electron-builder --win nsis"

# 6. Vérifier le résultat final
$InstallerPath = "$ProjectDir\build\electron\MOBIQ-Setup-$Version.exe"
if (Test-Path $InstallerPath) {
    Write-Host "=== BUILD RÉUSSI ===" -ForegroundColor Green
    Write-Host "Installeur créé: $InstallerPath" -ForegroundColor Cyan
    
    # Afficher la taille du fichier
    $FileSize = (Get-Item $InstallerPath).Length / 1MB
    Write-Host "Taille: $([math]::Round($FileSize, 2)) MB" -ForegroundColor Cyan
    
    # Vérifier qu'ADB est inclus dans l'installeur final
    $UnpackedDir = "$ProjectDir\build\electron\win-unpacked\resources\backend\server"
    $AdbInFinal = "$UnpackedDir\platform-tools\adb.exe"
    if (Test-Path $AdbInFinal) {
        Write-Host "✅ ADB inclus dans l'installeur final !" -ForegroundColor Green
        try {
            $AdbFinalVersionOutput = & "$AdbInFinal" "version" 2>$null
            $AdbFinalVersionLine = $null
            if ($AdbFinalVersionOutput) {
                $AdbFinalVersionLine = ($AdbFinalVersionOutput | Select-Object -First 1)
            }
            if ($AdbFinalVersionLine) {
                Write-Host "Version ADB finale: $AdbFinalVersionLine" -ForegroundColor Cyan
            } else {
                Write-Host "Version ADB finale: (non déterminée)" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "Version ADB finale: (non déterminée)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ ADB non trouvé dans l'installeur final" -ForegroundColor Red
    }
} else {
    Write-Error "Échec de la création de l'installeur!"
    exit 1
}

Write-Host "=== TERMINÉ - MOBIQ v$Version AVEC ADB FORCÉ ===" -ForegroundColor Green
