# Installation manuelle de Node.js avec ajout au PATH
Write-Host "Installation de Node.js..." -ForegroundColor Green

# Télécharger Node.js portable
$nodeUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip"
$zipPath = "$env:TEMP\nodejs.zip"
$extractPath = "C:\nodejs"

# Créer le dossier
if (!(Test-Path $extractPath)) {
    New-Item -ItemType Directory -Path $extractPath -Force
}

# Télécharger
Write-Host "Téléchargement..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $nodeUrl -OutFile $zipPath

# Extraire
Write-Host "Extraction..." -ForegroundColor Yellow
Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force

# Renommer le dossier
$extractedFolder = Get-ChildItem $extractPath | Where-Object {$_.Name -like "node-*"}
if ($extractedFolder) {
    Move-Item "$extractPath\$($extractedFolder.Name)\*" $extractPath -Force
    Remove-Item "$extractPath\$($extractedFolder.Name)" -Force
}

# Ajouter au PATH système
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "Machine")
if ($currentPath -notlike "*$extractPath*") {
    [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$extractPath", "Machine")
    Write-Host "PATH mis à jour" -ForegroundColor Green
}

# Ajouter au PATH de la session actuelle
$env:PATH += ";$extractPath"

# Nettoyer
Remove-Item $zipPath -Force

Write-Host "Node.js installé dans: $extractPath" -ForegroundColor Green
Write-Host "Test de l'installation..." -ForegroundColor Yellow

# Tester
& "$extractPath\node.exe" --version