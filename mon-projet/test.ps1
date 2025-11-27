$ProjectDir = Split-Path -Parent $PSScriptRoot
$VenvPath = "$ProjectDir\.venv-build"
Write-Host "ProjectDir=$ProjectDir"
Write-Host "VenvPath=$VenvPath"
Write-Host "Check path: $VenvPath\Scripts\python.exe"
