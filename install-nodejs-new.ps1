# Configuration
$nodeVersion = "18.18.0"
$nodePath = "C:\nodejs"

Write-Host "Installation de Node.js v$nodeVersion..."

# Créer le dossier d'installation
New-Item -ItemType Directory -Force -Path $nodePath | Out-Null

# Télécharger Node.js
$nodeUrl = "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-win-x64.zip"
$zipPath = Join-Path $nodePath "node.zip"
Write-Host "Téléchargement depuis $nodeUrl..."
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $nodeUrl -OutFile $zipPath

# Extraire Node.js
Write-Host "Extraction..."
Expand-Archive -Path $zipPath -DestinationPath $nodePath -Force
Move-Item -Path (Join-Path $nodePath "node-v$nodeVersion-win-x64\*") -Destination $nodePath -Force

# Nettoyer
Remove-Item $zipPath -Force
Remove-Item (Join-Path $nodePath "node-v$nodeVersion-win-x64") -Recurse -Force

# Configurer le PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (-not $userPath.Contains($nodePath)) {
    [Environment]::SetEnvironmentVariable("Path", "$nodePath;$userPath", "User")
}
$env:Path = "$nodePath;$env:Path"

# Vérifier l'installation
Write-Host "Vérification de l'installation..."
try {
    $nodeVersion = & "$nodePath\node.exe" --version
    $npmVersion = & "$nodePath\npm.cmd" --version
    Write-Host "Node.js $nodeVersion installé avec succès !"
    Write-Host "npm $npmVersion installé avec succès !"
    Write-Host "Installation terminée. Veuillez fermer et rouvrir votre terminal."
} catch {
    Write-Host "Erreur lors de la vérification. Veuillez redémarrer votre terminal et réessayer."
    exit 1
}