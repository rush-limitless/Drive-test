param(
    [string]$MongoBin = "C:\Program Files\MongoDB\Server\7.0\bin",
    [string]$DbPath = "$PSScriptRoot\..\data\mongodb",
    [int]$MongoPort = 27017,
    [string]$PythonExe = "python",
    [string]$BackendDir = "$PSScriptRoot\..\src\backend",
    [switch]$SkipMongo
)

$mongoProcess = $null
$mongodExe = $null

if (-not $SkipMongo) {
    Write-Host "Lancement de MongoDB local (dbpath=$DbPath, bin=$MongoBin) ..."
    $mongodExe = Join-Path $MongoBin mongod.exe

    if (-not (Test-Path $mongodExe)) {
        $pathHit = $null
        try {
            $cmd = Get-Command mongod.exe -ErrorAction Stop
            $pathHit = $cmd.Source
        } catch {
            try {
                $cmd = Get-Command mongod -ErrorAction Stop
                $pathHit = $cmd.Source
            } catch {}
        }
        if ($pathHit) {
            $mongodExe = $pathHit
            Write-Host "mongod trouvé via PATH : $mongodExe"
        } else {
            Write-Error "mongod.exe introuvable (répertoire $MongoBin). Installe MongoDB ou relance ce script avec -SkipMongo si tu utilises une instance externe (Docker, Atlas...)."
            exit 1
        }
    }

    if (-not (Test-Path $DbPath)) {
        New-Item -ItemType Directory -Path $DbPath | Out-Null
    }

    $mongodArgs = @(
        "--dbpath", $DbPath,
        "--bind_ip", "127.0.0.1",
        "--port", $MongoPort,
        "--quiet"
    )

    $mongoProcess = Start-Process -FilePath $mongodExe -ArgumentList $mongodArgs -WindowStyle Hidden -PassThru
    Write-Host "MongoDB lancé (PID $($mongoProcess.Id))."
} else {
    Write-Host "Option -SkipMongo activée : on suppose qu'une instance MongoDB externe est déjà disponible."
}

Write-Host "Démarrage du backend FastAPI ..."
Push-Location $BackendDir
$backendArgs = "-m","uvicorn","main:app","--host","127.0.0.1","--port","8007","--reload"
& $PythonExe @backendArgs
$exitCode = $LASTEXITCODE
Pop-Location

Write-Host "Backend stoppé. Arrêt de MongoDB (si encore actif)..."
try {
    if ($mongoProcess -and -not $mongoProcess.HasExited) {
        Stop-Process -Id $mongoProcess.Id -Force
        Write-Host "MongoDB arrêté."
    }
} catch {
    Write-Warning "Impossible d’arrêter MongoDB proprement : $_"
}

exit $exitCode
