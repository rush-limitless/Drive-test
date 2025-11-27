Param(
  [string]$BaseUrl = 'http://localhost:8007',
  [switch]$Quiet,
  [int]$TimeoutSec = 5
)

function Test-Endpoint {
  param(
    [string]$Method = 'GET',
    [string]$Path
  )
  $url = "$BaseUrl$Path"
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $resp = Invoke-WebRequest -Uri $url -Method $Method -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
    $sw.Stop()
    return [pscustomobject]@{
      Method = $Method
      Endpoint = $Path
      Status  = 'OK'
      Code    = $resp.StatusCode
      TimeMs  = [int]$sw.Elapsed.TotalMilliseconds
    }
  } catch {
    $sw.Stop()
    $statusCode = $null
    if ($_.Exception.Response) {
      try { $statusCode = [int]$_.Exception.Response.StatusCode } catch { $statusCode = $null }
    }
    return [pscustomobject]@{
      Method = $Method
      Endpoint = $Path
      Status  = 'FAIL'
      Code    = $statusCode
      TimeMs  = [int]$sw.Elapsed.TotalMilliseconds
    }
  }
}

$getEndpoints = @(
  '/',
  '/health',
  '/api/devices',
  '/api/devices/stats',
  '/api/modules',
  '/api/workflows',
  '/api/executions',
  '/api/executions/stats/summary',
  '/api/reports',
  '/api/reports/types',
  '/api/reports/templates',
  '/api/dashboard/stats',
  '/api/dashboard/recent-executions',
  # Legacy v1
  '/api/v1/devices',
  '/api/v1/flows',
  '/api/v1/executions',
  '/api/v1/reports'
)

if (-not $Quiet) { Write-Host "Checking endpoints on $BaseUrl ..." -ForegroundColor Cyan }

$results = foreach ($p in $getEndpoints) { Test-Endpoint -Method GET -Path $p }

# Output summary
$ok = ($results | Where-Object { $_.Status -eq 'OK' }).Count
$fail = ($results | Where-Object { $_.Status -ne 'OK' }).Count

if (-not $Quiet) {
  $results | Sort-Object { $_.Status -ne 'OK' }, Endpoint | Format-Table -AutoSize Method, Code, Status, TimeMs, Endpoint
  Write-Host "`nOK: $ok  FAIL: $fail  (total $($results.Count))" -ForegroundColor Yellow
}

# Exit code reflects failures
if ($fail -gt 0) { exit 1 } else { exit 0 }

