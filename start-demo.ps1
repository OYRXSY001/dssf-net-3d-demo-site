$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$port = 5173
$url = "http://127.0.0.1:$port/"
$server = Join-Path $root "serve.mjs"

function Test-Listening([int]$p) {
  try {
    $client = [System.Net.Sockets.TcpClient]::new()
    $client.Connect("127.0.0.1", $p)
    $client.Close()
    return $true
  } catch {
    return $false
  }
}

if (Test-Listening $port) {
  Write-Host "已有服务在 $url ，直接打开浏览器。" -ForegroundColor Cyan
  Start-Process $url
  exit 0
}

$hasNode = Get-Command node -ErrorAction SilentlyContinue
$hasPython = Get-Command python -ErrorAction SilentlyContinue
if (-not $hasNode -and -not $hasPython) {
  Write-Host "未找到 node / python。请安装 Node.js（推荐）或 Python 3。" -ForegroundColor Red
  exit 1
}

Write-Host "启动静态服务 $url" -ForegroundColor Cyan
Write-Host "按 Ctrl+C 停止。" -ForegroundColor DarkGray
Start-Job -ScriptBlock {
  param($target)
  Start-Sleep -Seconds 1
  Start-Process $target
} -ArgumentList $url | Out-Null

if ($hasNode -and (Test-Path $server)) {
  node $server $port
} else {
  python -m http.server $port --bind 127.0.0.1
}
