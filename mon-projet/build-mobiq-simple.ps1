# Build MOBIQ v1.0.1 Simple
$ErrorActionPreference = "Stop"
$ProjectDir = "C:\Users\rush\Pictures\ADB Tool\ADB-automation-tool\mon-projet"

Write-Host "=== BUILD MOBIQ v1.0.1 ===" -ForegroundColor Cyan
Set-Location $ProjectDir

# 1. Frontend
Write-Host "1. Frontend build..." -ForegroundColor Yellow
Set-Location "src\frontend"
npm run build

# 2. Backend
Write-Host "2. Backend build..." -ForegroundColor Yellow
Set-Location $ProjectDir
powershell -ExecutionPolicy Bypass -File ".\build\build-exe.ps1"

# 3. Resources
Write-Host "3. Copie des ressources..." -ForegroundColor Yellow
Remove-Item -Recurse -Force ".\src\electron\resources" -ErrorAction SilentlyContinue
New-Item -ItemType Directory ".\src\electron\resources\backend\server" -Force | Out-Null
New-Item -ItemType Directory ".\src\electron\resources\frontend\build" -Force | Out-Null
New-Item -ItemType Directory ".\src\electron\resources\adb" -Force | Out-Null

Copy-Item -Recurse -Force ".\dist\TelcoADBServer\*" ".\src\electron\resources\backend\server\"
Copy-Item -Recurse -Force ".\src\frontend\build\*" ".\src\electron\resources\frontend\build\"
Copy-Item -Recurse -Force ".\platform-tools\*" ".\src\electron\resources\adb\"

# 4. Electron build
Write-Host "4. Electron build..." -ForegroundColor Yellow
Set-Location "src\electron"
npm run build
npx electron-builder --win nsis

# 5. Verification
Set-Location $ProjectDir
if (Test-Path "build\electron\MOBIQ-Setup-1.0.1.exe") {
    $Size = [math]::Round((Get-Item "build\electron\MOBIQ-Setup-1.0.1.exe").Length / 1MB, 2)
    Write-Host "SUCCESS: MOBIQ-Setup-1.0.1.exe ($Size MB)" -ForegroundColor Green
} else {
    Write-Host "ERROR: Build failed" -ForegroundColor Red
}