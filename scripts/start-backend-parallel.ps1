<# 
.SYNOPSIS
  Lance le backend FastAPI via Uvicorn avec plusieurs workers pour permettre des actions simultanées sur plusieurs appareils.
.DESCRIPTION
  Ce script prépare l'environnement (PYTHONPATH) puis exécute `uvicorn src.backend.simple_server:app`
  en répartissant les requêtes sur plusieurs workers, ce qui évite que la commande d'un appareil
  bloque les autres. Les logs d'accès et l’horodatage affichent le `device_id` pour faciliter le suivi.
.PARAMETER Workers
  Nombre de workers uvicorn. Par défaut : 2.
.PARAMETER Port
  Port HTTP exposé (FastAPI écoute `0.0.0.0`). Valeur par défaut : 8007.
.PARAMETER Reload
  Ajoute `--reload` pour le développement afin de recharger les fichiers Python automatiquement.
#>
param (
    [int]$Workers = 2,
    [int]$Port = 8007,
    [switch]$Reload
)

Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path "$scriptDir\.."

Write-Host "Navigating to project root: $projectRoot"
Set-Location $projectRoot

$env:PYTHONPATH = "$PWD\src;$PWD\src\backend"
Write-Host "Using PYTHONPATH: $env:PYTHONPATH"

$uvicornArgs = @(
    "src.backend.simple_server:app",
    "--host",
    "0.0.0.0",
    "--port",
    $Port,
    "--workers",
    $Workers,
    "--log-level",
    "info",
    "--timeout-keep-alive",
    "120",
    "--access-log"
)

if ($Reload) {
    $uvicornArgs += "--reload"
}

Write-Host "Starting uvicorn with workers=$Workers port=$Port"

python -m uvicorn @uvicornArgs
