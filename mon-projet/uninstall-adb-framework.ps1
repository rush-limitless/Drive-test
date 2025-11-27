#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Supprime proprement l'application "MOBIQ" (et les anciennes versions "ADB Framework Telco Automation") installée via l'installeur Electron.

.DESCRIPTION
    - Tente d'abord d'arrêter les processus encore en cours.
    - Exécute l'uninstalleur NSIS en mode silencieux si disponible.
    - Supprime ensuite les dossiers résiduels (Programmes, AppData locale, raccourcis).
    - Compatible MOBIQ (nouveau nom) et anciennes builds ADB Framework Telco Automation.

.PARAMETER Force
    Ignore les erreurs non critiques afin de poursuivre le nettoyage (utile si des fichiers sont verrouillés).
#>
param(
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$programCandidates = @(
    (Join-Path -Path $env:LOCALAPPDATA -ChildPath "Programs\MOBIQ")
    (Join-Path -Path $env:LOCALAPPDATA -ChildPath "Programs\adb-framework-telco-automation")
)
$installDir = ($programCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1)
if (-not $installDir) {
    $installDir = $programCandidates[0]
}

$uninstallers = @(
    "Uninstall MOBIQ.exe",
    "Uninstall ADB Framework Telco Automation.exe"
)
$uninstallerExe = $uninstallers |
    ForEach-Object { Join-Path -Path $installDir -ChildPath $_ } |
    Where-Object { Test-Path $_ } |
    Select-Object -First 1
if (-not $uninstallerExe) {
    $uninstallerExe = Join-Path -Path $installDir -ChildPath $uninstallers[0]
}

$localDataCandidates = @(
    (Join-Path -Path $env:LOCALAPPDATA -ChildPath "MOBIQ")
    (Join-Path -Path $env:LOCALAPPDATA -ChildPath "adb-framework-telco-automation")
)
$startMenuDir = Join-Path -Path $env:APPDATA -ChildPath "Microsoft\Windows\Start Menu\Programs\F2G Telco\MOBIQ"
$desktopLinks = @(
    (Join-Path -Path ([Environment]::GetFolderPath("Desktop")) -ChildPath "MOBIQ.lnk")
    (Join-Path -Path ([Environment]::GetFolderPath("Desktop")) -ChildPath "ADB Framework Telco Automation.lnk")
)

function Write-Step($message, [ConsoleColor]$color = [ConsoleColor]::Cyan) {
    $timestamp = (Get-Date).ToString("HH:mm:ss")
    Write-Host "[$timestamp] $message" -ForegroundColor $color
}

function Stop-AppProcess {
    $targets = @(
        "MOBIQ",
        "MOBIQ.exe",
        "ADB Framework Telco Automation",
        "ADB Framework Telco Automation.exe",
        "TelcoADBServer",
        "TelcoADBServer.exe"
    )
    foreach ($name in $targets | Sort-Object -Unique) {
        $procs = Get-Process -Name $name -ErrorAction SilentlyContinue
        if ($null -ne $procs) {
            foreach ($proc in $procs) {
                Write-Step "Arrêt du processus $($proc.ProcessName) (PID $($proc.Id))..." Yellow
                try {
                    $proc.CloseMainWindow() | Out-Null
                    Start-Sleep -Milliseconds 500
                    if (-not $proc.HasExited) {
                        $proc.Kill($true)
                    }
                } catch {
                    if (-not $Force) { throw }
                    Write-Step "Impossible de fermer $($proc.ProcessName): $($_.Exception.Message)" Red
                }
            }
        }
    }
}

function Invoke-Uninstaller {
    if (-not (Test-Path $uninstallerExe)) {
        Write-Step "Uninstalleur NSIS introuvable (fichier déjà supprimé ?)" DarkYellow
        return
    }
    Write-Step "Exécution de l'uninstalleur officiel..." Green
    $silentArgs = '/S'  # mode silencieux NSIS
    try {
        $process = Start-Process -FilePath $uninstallerExe -ArgumentList $silentArgs -Wait -PassThru -WindowStyle Hidden
        if ($process.ExitCode -ne 0) {
            $msg = "L'uninstalleur a retourné le code $($process.ExitCode)"
            if ($Force) {
                Write-Step $msg DarkYellow
            } else {
                throw $msg
            }
        }
    } catch {
        if (-not $Force) { throw }
        Write-Step "Erreur durant l'uninstall: $($_.Exception.Message)" Red
    }
}

function Remove-PathSafe([string]$path) {
    if (-not (Test-Path $path)) { return }
    Write-Step "Suppression de $path" DarkGray
    try {
        Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction Stop
    } catch {
        if (-not $Force) { throw }
        Write-Step "Impossible de supprimer $path : $($_.Exception.Message)" Red
    }
}

try {
    Write-Step "Nettoyage de l'installation MOBIQ / Telco ADB"

    Stop-AppProcess
    Invoke-Uninstaller

    # Nettoyage manuel en cas de résidus
    Remove-PathSafe $installDir
    foreach ($dir in $localDataCandidates | Sort-Object -Unique) {
        Remove-PathSafe $dir
    }
    Remove-PathSafe $startMenuDir
    foreach ($link in $desktopLinks | Where-Object { Test-Path $_ }) {
        Remove-PathSafe $link
    }

    Write-Step "Suppression terminée." Green
    Write-Step "Vous pouvez relancer l'installeur pour déployer la nouvelle version." Cyan
} catch {
    Write-Host "[ERREUR] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
