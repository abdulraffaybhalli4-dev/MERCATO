$ErrorActionPreference = "Stop"

$botDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodePath = (Get-Command node -ErrorAction Stop).Source
$scriptPath = Join-Path $botDir "index.js"

# Avoid starting multiple instances
$existing = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine -like "*$scriptPath*" }

if ($existing) {
  exit 0
}

$logDir = Join-Path $botDir "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outLog = Join-Path $logDir "bot-$timestamp.out.log"
$errLog = Join-Path $logDir "bot-$timestamp.err.log"

Start-Process \
  -FilePath $nodePath \
  -ArgumentList @($scriptPath) \
  -WorkingDirectory $botDir \
  -WindowStyle Hidden \
  -RedirectStandardOutput $outLog \
  -RedirectStandardError $errLog
