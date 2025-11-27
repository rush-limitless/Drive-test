# Script de diagnostic ADB - Détection des problèmes de connexion téléphone
param(
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"
$AdbPath = "C:\Users\rush\Pictures\ADB Tool\ADB-automation-tool\platform-tools\adb.exe"

Write-Host "=== DIAGNOSTIC ADB - DÉTECTION TÉLÉPHONE ===" -ForegroundColor Cyan

# 1. Vérifier ADB
Write-Host "`n1. Vérification d'ADB..." -ForegroundColor Yellow
if (Test-Path $AdbPath) {
    Write-Host "✅ ADB trouvé: $AdbPath" -ForegroundColor Green
    & $AdbPath version
} else {
    Write-Host "❌ ADB non trouvé à: $AdbPath" -ForegroundColor Red
    exit 1
}

# 2. Statut du serveur ADB
Write-Host "`n2. Statut du serveur ADB..." -ForegroundColor Yellow
Write-Host "Redémarrage du serveur ADB..." -ForegroundColor Gray
& $AdbPath kill-server
Start-Sleep -Seconds 2
& $AdbPath start-server

# 3. Liste des appareils
Write-Host "`n3. Recherche d'appareils..." -ForegroundColor Yellow
$Devices = & $AdbPath devices
Write-Host $Devices -ForegroundColor White

# 4. Vérifications système
Write-Host "`n4. Vérifications système..." -ForegroundColor Yellow

# Pilotes USB
Write-Host "Pilotes USB Android:" -ForegroundColor Gray
$UsbDevices = Get-WmiObject -Class Win32_PnPEntity | Where-Object { 
    $_.Name -like "*Android*" -or $_.Name -like "*ADB*" -or $_.DeviceID -like "*VID_*"
}
if ($UsbDevices) {
    $UsbDevices | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor White }
} else {
    Write-Host "  Aucun pilote Android détecté" -ForegroundColor Red
}

# Processus ADB
Write-Host "`nProcessus ADB actifs:" -ForegroundColor Gray
$AdbProcesses = Get-Process -Name "adb" -ErrorAction SilentlyContinue
if ($AdbProcesses) {
    $AdbProcesses | ForEach-Object { Write-Host "  - PID: $($_.Id)" -ForegroundColor White }
} else {
    Write-Host "  Aucun processus ADB actif" -ForegroundColor Yellow
}

# 5. Instructions de dépannage
Write-Host "`n=== INSTRUCTIONS DE DÉPANNAGE ===" -ForegroundColor Cyan

Write-Host "`n📱 SUR LE TÉLÉPHONE:" -ForegroundColor Yellow
Write-Host "1. Paramètres > À propos du téléphone" -ForegroundColor White
Write-Host "2. Appuyez 7 fois sur 'Numéro de build'" -ForegroundColor White
Write-Host "3. Parametres > Options developpeur" -ForegroundColor White
Write-Host "4. Activez 'Debogage USB'" -ForegroundColor White
Write-Host "5. Activez 'Installer via USB'" -ForegroundColor White

Write-Host "`n🔌 CONNEXION USB:" -ForegroundColor Yellow
Write-Host "1. Utilisez un câble USB de données (pas seulement charge)" -ForegroundColor White
Write-Host "2. Changez le mode USB vers 'Transfert de fichiers' ou 'MTP'" -ForegroundColor White
Write-Host "3. Acceptez l'autorisation de débogage sur le téléphone" -ForegroundColor White

Write-Host "`n💻 SUR L'ORDINATEUR:" -ForegroundColor Yellow
Write-Host "1. Installez les pilotes USB du fabricant" -ForegroundColor White
Write-Host "2. Redémarrez l'ordinateur si nécessaire" -ForegroundColor White
Write-Host "3. Testez avec un autre port USB" -ForegroundColor White

# 6. Test de connexion en boucle
Write-Host "`n6. Test de connexion (Ctrl+C pour arrêter)..." -ForegroundColor Yellow
$Count = 0
while ($true) {
    $Count++
    Write-Host "`rTest #$Count - " -NoNewline -ForegroundColor Gray
    
    $Result = & $AdbPath devices 2>&1
    $DeviceLines = $Result | Where-Object { $_ -match "^\w+\s+(device|unauthorized|offline)" }
    
    if ($DeviceLines) {
        Write-Host "TÉLÉPHONE DÉTECTÉ!" -ForegroundColor Green
        Write-Host $DeviceLines -ForegroundColor White
        break
    } else {
        Write-Host "Aucun appareil..." -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 3
}

Write-Host "`n=== DIAGNOSTIC TERMINÉ ===" -ForegroundColor Cyan