Param(
  [switch]$Quiet
)

# Ensure UTF-8 encoding for Python/Rich output to avoid banner crash
$prevPyIo = $env:PYTHONIOENCODING
$prevPyUtf8 = $env:PYTHONUTF8
$env:PYTHONIOENCODING = 'utf-8'
$env:PYTHONUTF8 = '1'

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
  if ($Quiet) {
    specify check | Out-Null
  } else {
    specify check
  }
  if (-not $Quiet) { Write-Host "`n✅ Specify check completed." -ForegroundColor Green }
}
catch {
  Write-Host "❌ specify check failed:" -ForegroundColor Red
  Write-Host $_
  exit 1
}
finally {
  Pop-Location
  # Restore previous env
  if ($null -ne $prevPyIo) { $env:PYTHONIOENCODING = $prevPyIo } else { Remove-Item Env:PYTHONIOENCODING -ErrorAction SilentlyContinue }
  if ($null -ne $prevPyUtf8) { $env:PYTHONUTF8 = $prevPyUtf8 } else { Remove-Item Env:PYTHONUTF8 -ErrorAction SilentlyContinue }
}

