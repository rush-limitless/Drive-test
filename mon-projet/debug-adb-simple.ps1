# Diagnostic ADB simple
$AdbPath = "C:\Users\rush\Pictures\ADB Tool\ADB-automation-tool\platform-tools\adb.exe"

Write-Host "=== DIAGNOSTIC ADB ===" -ForegroundColor Cyan

# Test ADB
if (Test-Path $AdbPath) {
    Write-Host "ADB trouve" -ForegroundColor Green
    & $AdbPath version
} else {
    Write-Host "ADB non trouve" -ForegroundColor Red
    exit 1
}

# Redemarrage serveur
Write-Host "Redemarrage serveur ADB..." -ForegroundColor Yellow
& $AdbPath kill-server
Start-Sleep -Seconds 2
& $AdbPath start-server

# Liste appareils
Write-Host "Appareils connectes:" -ForegroundColor Yellow
& $AdbPath devices

Write-Host "`nETAPES A SUIVRE:" -ForegroundColor Cyan
Write-Host "1. Sur le telephone: Parametres > A propos" -ForegroundColor White
Write-Host "2. Appuyez 7 fois sur 'Numero de build'" -ForegroundColor White
Write-Host "3. Parametres > Options developpeur" -ForegroundColor White
Write-Host "4. Activez 'Debogage USB'" -ForegroundColor White
Write-Host "5. Connectez le cable USB" -ForegroundColor White
Write-Host "6. Acceptez l'autorisation sur le telephone" -ForegroundColor White