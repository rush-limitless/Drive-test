# Fix MOBIQ ADB Path - Assure que MOBIQ trouve ADB
$AdbDir = "C:\Users\rush\Pictures\ADB Tool\ADB-automation-tool\platform-tools"

Write-Host "=== FIX MOBIQ ADB PATH ===" -ForegroundColor Cyan

# 1. Ajouter ADB au PATH système
Write-Host "1. Ajout d'ADB au PATH..." -ForegroundColor Yellow
$CurrentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($CurrentPath -notlike "*$AdbDir*") {
    [Environment]::SetEnvironmentVariable("PATH", "$CurrentPath;$AdbDir", "User")
    Write-Host "✅ ADB ajouté au PATH utilisateur" -ForegroundColor Green
} else {
    Write-Host "✅ ADB déjà dans le PATH" -ForegroundColor Green
}

# 2. Copier ADB dans System32 (solution rapide)
Write-Host "2. Copie d'ADB dans System32..." -ForegroundColor Yellow
try {
    Copy-Item "$AdbDir\adb.exe" "C:\Windows\System32\" -Force
    Copy-Item "$AdbDir\AdbWinApi.dll" "C:\Windows\System32\" -Force
    Copy-Item "$AdbDir\AdbWinUsbApi.dll" "C:\Windows\System32\" -Force
    Write-Host "✅ ADB copié dans System32" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Erreur copie System32 (permissions)" -ForegroundColor Yellow
}

# 3. Test ADB global
Write-Host "3. Test ADB global..." -ForegroundColor Yellow
$env:PATH = "$env:PATH;$AdbDir"
& adb devices

Write-Host "`n=== SOLUTIONS MOBIQ ===" -ForegroundColor Cyan
Write-Host "1. Redémarrez MOBIQ" -ForegroundColor White
Write-Host "2. Ou redémarrez votre ordinateur" -ForegroundColor White
Write-Host "3. Vérifiez les paramètres ADB dans MOBIQ" -ForegroundColor White