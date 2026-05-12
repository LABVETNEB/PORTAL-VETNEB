param(
  [string]$BackendUrl = "http://localhost:3000",
  [string]$FrontendUrl = "http://localhost:3001",
  [int]$DebugPort = 9223
)

$ErrorActionPreference = "Stop"

function Convert-SecureStringToPlainText {
  param([securestring]$SecureString)

  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)

  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Find-Chrome {
  $candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  )

  return $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

function Send-CDP {
  param(
    [System.Net.WebSockets.ClientWebSocket]$WebSocket,
    [int]$Id,
    [string]$Method,
    [hashtable]$Params = @{}
  )

  $payload = @{
    id = $Id
    method = $Method
    params = $Params
  } | ConvertTo-Json -Depth 20 -Compress

  $bytes = [Text.Encoding]::UTF8.GetBytes($payload)

  $WebSocket.SendAsync(
    [ArraySegment[byte]]::new($bytes),
    [System.Net.WebSockets.WebSocketMessageType]::Text,
    $true,
    [Threading.CancellationToken]::None
  ).GetAwaiter().GetResult()

  Start-Sleep -Milliseconds 250
}

Write-Host "VETNEB admin launcher" -ForegroundColor Cyan

$health = Invoke-WebRequest -UseBasicParsing "$BackendUrl/api/health" -TimeoutSec 8
if ($health.StatusCode -ne 200) {
  throw "Backend no respondió OK en $BackendUrl/api/health"
}

$adminUsername = $env:VETNEB_ADMIN_USERNAME
if ([string]::IsNullOrWhiteSpace($adminUsername)) {
  $adminUsername = "VETNEB"
}

$adminPassword = $env:VETNEB_ADMIN_PASSWORD
if ([string]::IsNullOrWhiteSpace($adminPassword)) {
  $securePassword = Read-Host "Password administrador $adminUsername" -AsSecureString
  $adminPassword = Convert-SecureStringToPlainText $securePassword
}

$adminSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession

$loginBody = @{
  username = $adminUsername
  password = $adminPassword
} | ConvertTo-Json -Compress

$loginResponse = Invoke-WebRequest `
  -UseBasicParsing `
  -Uri "$BackendUrl/api/admin/auth/login" `
  -Method POST `
  -WebSession $adminSession `
  -ContentType "application/json" `
  -Body $loginBody `
  -TimeoutSec 15

if ($loginResponse.StatusCode -ne 200) {
  throw "Login administrador falló con status $($loginResponse.StatusCode)"
}

$adminCookie = $adminSession.Cookies.GetCookies($BackendUrl) |
  Where-Object { $_.Name -eq "admin_session_id" } |
  Select-Object -First 1

if (-not $adminCookie) {
  throw "No se obtuvo admin_session_id desde $BackendUrl"
}

$chrome = Find-Chrome

if (-not $chrome) {
  throw "Chrome no encontrado. Instale Google Chrome o ajuste el launcher."
}

$profile = Join-Path $env:TEMP "vetneb-admin-visible"

Start-Process `
  -FilePath $chrome `
  -ArgumentList @(
    "--remote-debugging-port=$DebugPort",
    "--user-data-dir=$profile",
    "--new-window",
    "about:blank"
  )

Start-Sleep -Seconds 2

$tab = Invoke-RestMethod `
  -Method PUT `
  -Uri "http://127.0.0.1:$DebugPort/json/new?about:blank"

$ws = [System.Net.WebSockets.ClientWebSocket]::new()

$ws.ConnectAsync(
  [Uri]$tab.webSocketDebuggerUrl,
  [Threading.CancellationToken]::None
).GetAwaiter().GetResult()

try {
  Send-CDP -WebSocket $ws -Id 1 -Method "Network.enable"
  Send-CDP -WebSocket $ws -Id 2 -Method "Page.enable"

  Send-CDP `
    -WebSocket $ws `
    -Id 3 `
    -Method "Network.setCookie" `
    -Params @{
      name = "admin_session_id"
      value = $adminCookie.Value
      url = $FrontendUrl
      path = "/"
      sameSite = "Lax"
    }

  Send-CDP `
    -WebSocket $ws `
    -Id 4 `
    -Method "Network.setCookie" `
    -Params @{
      name = "admin_session_id"
      value = $adminCookie.Value
      url = $BackendUrl
      path = "/"
      sameSite = "Lax"
    }

  Send-CDP `
    -WebSocket $ws `
    -Id 5 `
    -Method "Page.navigate" `
    -Params @{
      url = "$FrontendUrl/dashboard/admin"
    }
} finally {
  $ws.Dispose()
}

Write-Host "Administrador abierto: $FrontendUrl/dashboard/admin" -ForegroundColor Green


