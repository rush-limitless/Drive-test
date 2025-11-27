<#
.SYNOPSIS
  Reconstruit le frontend et déploie les artefacts dans src/backend/static/.

.DESCRIPTION
  1. Exécute `npm run build` dans src/frontend/.
  2. Supprime le contenu existant de src/backend/static/.
  3. Copie le nouveau build dans ce dossier pour Electron / FastAPI.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = Split-Path -Parent $scriptRoot
$frontendPath = Join-Path $repoRoot 'src/frontend'
$backendStaticPath = Join-Path $repoRoot 'src/backend/static'
$buildPath = Join-Path $frontendPath 'build'

Write-Host "[build] Building frontend (npm run build)..." -ForegroundColor Cyan
Push-Location $frontendPath
try {
  npm run build | Write-Host
}
finally {
  Pop-Location
}

if (-not (Test-Path $buildPath)) {
  throw "Build folder not found at $buildPath"
}

Write-Host "[cleanup] Resetting backend static assets..." -ForegroundColor Cyan
if (-not (Test-Path $backendStaticPath)) {
  New-Item -ItemType Directory -Path $backendStaticPath | Out-Null
} else {
  Get-ChildItem $backendStaticPath | Remove-Item -Recurse -Force
}

Write-Host "[copy] Copying new build to backend/static..." -ForegroundColor Cyan
Copy-Item -Path (Join-Path $buildPath '*') -Destination $backendStaticPath -Recurse

Write-Host "[done] Frontend deployed to src/backend/static/" -ForegroundColor Green
