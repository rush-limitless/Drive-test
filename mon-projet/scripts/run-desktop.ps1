<# 
    Script d’orchestration complet :
      1. npm install + build React
      2. déploiement via scripts/deploy-frontend.ps1
      3. lancement d’Electron

    Utilisation :
      ./scripts/run-desktop.ps1
      ./scripts/run-desktop.ps1 -SkipFrontendBuild   # saute npm install/build
      ./scripts/run-desktop.ps1 -SkipDeploy          # saute la copie vers backend/static
#>
[CmdletBinding()]
param(
    [switch]$SkipFrontendBuild,
    [switch]$SkipDeploy,
    [switch]$SkipBackendTests
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Step {
    param(
        [Parameter(Mandatory=$true)][string]$Label,
        [Parameter(Mandatory=$true)][ScriptBlock]$Action
    )
    Write-Host ""
    Write-Host "==> $Label" -ForegroundColor Cyan
    & $Action
}

if (-not $SkipBackendTests) {
    $pytestExe = Join-Path $repoRoot '.venv\Scripts\python.exe'
    if (-not (Test-Path $pytestExe)) {
        $pytestExe = 'python'
    }
    Invoke-Step "Running backend tests (pytest)" {
        Push-Location (Join-Path $repoRoot 'src\backend')
        try {
            & $pytestExe -m pytest
        }
        finally {
            Pop-Location
        }
    }
} else {
    Write-Host "[skip] Backend tests skipped" -ForegroundColor Yellow
}

if (-not $SkipFrontendBuild) {
    Invoke-Step "Installing frontend dependencies" {
        Push-Location (Join-Path $repoRoot 'src\frontend')
        try {
            npm install
        }
        finally {
            Pop-Location
        }
    }

    Invoke-Step "Building frontend (npm run build)" {
        Push-Location (Join-Path $repoRoot 'src\frontend')
        try {
            npm run build
        }
        finally {
            Pop-Location
        }
    }
} else {
    Write-Host "[skip] Frontend build skipped" -ForegroundColor Yellow
}

if (-not $SkipDeploy) {
    Invoke-Step "Deploying frontend to backend/static" {
        & (Join-Path $repoRoot 'scripts\deploy-frontend.ps1')
    }
} else {
    Write-Host "[skip] Frontend deploy skipped" -ForegroundColor Yellow
}

$electronCmd = Join-Path $repoRoot 'node_modules\.bin\electron.cmd'
if (-not (Test-Path $electronCmd)) {
    throw "Electron CLI introuvable : $electronCmd. Lance npm install à la racine."
}

Invoke-Step "Launching Electron desktop app" {
    & $electronCmd (Join-Path $repoRoot 'src\electron')
}
