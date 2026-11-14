param(
  [string]$FrontendPort = "5173",
  [string]$BackendDir = $env:DSSF_BACKEND_DIR,
  [string]$BackendCmd = $env:DSSF_BACKEND_CMD,
  [string]$BackendHealthUrl = $(if ($env:DSSF_BACKEND_HEALTH) { $env:DSSF_BACKEND_HEALTH } else { "http://127.0.0.1:8000/health" })
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendUrl = "http://127.0.0.1:$FrontendPort/"

function Test-Listening([int]$p) {
  try {
    $c = [System.Net.Sockets.TcpClient]::new()
    $c.Connect("127.0.0.1", $p)
    $c.Close()
    return $true
  } catch { return $false }
}

Write-Host "[DSSF demo] frontend: $frontendUrl" -ForegroundColor Cyan
if (Test-Listening ([int]$FrontendPort)) {
  Write-Host "Frontend port $FrontendPort already listening; will open browser." -ForegroundColor DarkYellow
} else {
  $node = Get-Command node -ErrorAction SilentlyContinue
  $serve = Join-Path $root "serve.mjs"
  if ($node -and (Test-Path $serve)) {
    Start-Process -FilePath "node" -ArgumentList @("`"$serve`"", $FrontendPort) -WorkingDirectory $root | Out-Null
  } elseif (Get-Command python -ErrorAction SilentlyContinue) {
    Start-Process -FilePath "python" -ArgumentList @("-m","http.server",$FrontendPort,"--bind","127.0.0.1") -WorkingDirectory $root | Out-Null
  } else {
    throw "No node/python found to start frontend."
  }
  Start-Sleep -Seconds 1
}

if ($BackendDir -and $BackendCmd) {
  if (-not (Test-Path $BackendDir)) { throw "BackendDir not found: $BackendDir" }
  Write-Host "[DSSF demo] backend: $BackendCmd (in $BackendDir)" -ForegroundColor Cyan
  Start-Process -FilePath "powershell" -ArgumentList @("-NoProfile","-Command","cd `"$BackendDir`"; $BackendCmd") -WorkingDirectory $BackendDir | Out-Null
  Start-Sleep -Seconds 1
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri $BackendHealthUrl -TimeoutSec 3
    Write-Host "Backend health: $($r.StatusCode)" -ForegroundColor Green
  } catch {
    Write-Host "Backend started (health check not ready: $BackendHealthUrl). Verify Backend logs/port." -ForegroundColor DarkYellow
  }
} else {
  Write-Host "Backend not configured (frontend-only). Set -BackendDir/-BackendCmd or DSSF_BACKEND_DIR/DSSF_BACKEND_CMD when Backend delivers." -ForegroundColor DarkGray
}

Start-Process $frontendUrl | Out-Null
Write-Host "Open: $frontendUrl" -ForegroundColor Green
Write-Host "Self-check: $frontendUrl`?seed=42&result=1  |  $BackendHealthUrl" -ForegroundColor DarkGray
