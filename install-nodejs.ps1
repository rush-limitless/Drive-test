# Installation automatique de Node.js LTS
Write-Host "Téléchargement de Node.js LTS..." -ForegroundColor Green

# URL pour Node.js LTS Windows x64
$nodeUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi"
$installerPath = "$env:TEMP\nodejs-installer.msi"

# Télécharger l'installeur
Invoke-WebRequest -Uri $nodeUrl -OutFile $installerPath

Write-Host "Installation de Node.js..." -ForegroundColor Green

# Installer silencieusement
Start-Process msiexec.exe -Wait -ArgumentList "/i $installerPath /quiet /norestart"

# Nettoyer
Remove-Item $installerPath

Write-Host "Node.js installé avec succès !" -ForegroundColor Green
Write-Host "Redémarrez votre terminal pour utiliser npm et node." -ForegroundColor Yellow