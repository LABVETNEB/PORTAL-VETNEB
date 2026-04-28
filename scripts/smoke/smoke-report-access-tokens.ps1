param(
  [string]$BaseUrl = 'http://localhost:3000',
  [pscredential]$Credential
)

if ($null -eq $Credential) {
  $Credential = Get-Credential -UserName 'publicdemo' -Message 'Credenciales para smoke report access tokens'
}

$ErrorActionPreference = 'Stop'

$origin = $BaseUrl
$clinicSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession

Write-Host ''
Write-Host '=== LOGIN CLINICA ==='
$loginResponse = Invoke-WebRequest `
  -UseBasicParsing `
  -Uri "$BaseUrl/api/auth/login" `
  -Method POST `
  -WebSession $clinicSession `
  -ContentType 'application/json' `
  -Headers @{ Origin = $origin } `
  -Body (@{
    username = $Credential.UserName
    password = $Credential.GetNetworkCredential().Password
  } | ConvertTo-Json -Compress)

$loginJson = $loginResponse.Content | ConvertFrom-Json
$loginJson | ConvertTo-Json -Depth 10

if (-not $loginJson.success) {
  throw 'Login de clÃ­nica fallÃ³'
}

Write-Host ''
Write-Host '=== LISTAR REPORTES ==='
$reportsResponse = Invoke-WebRequest `
  -UseBasicParsing `
  -Uri "$BaseUrl/api/reports?limit=20" `
  -WebSession $clinicSession

$reportsJson = $reportsResponse.Content | ConvertFrom-Json
$reportsJson | ConvertTo-Json -Depth 10

if (-not $reportsJson.reports -or $reportsJson.reports.Count -eq 0) {
  throw 'No hay reportes disponibles para smoke de report access tokens'
}

$report = $reportsJson.reports[0]
$reportId = $report.id
$currentStatus = $report.currentStatus

Write-Host ""
Write-Host "Reporte seleccionado: $reportId (estado actual: $currentStatus)"

if ($currentStatus -notin @('ready', 'delivered')) {
  Write-Host ''
  Write-Host '=== TRANSICIONAR REPORTE A READY ==='
  $statusResponse = Invoke-WebRequest `
    -UseBasicParsing `
    -Uri "$BaseUrl/api/reports/$reportId/status" `
    -Method PATCH `
    -WebSession $clinicSession `
    -ContentType 'application/json' `
    -Headers @{ Origin = $origin } `
    -Body (@{
      status = 'ready'
    } | ConvertTo-Json -Compress)

  $statusJson = $statusResponse.Content | ConvertFrom-Json
  $statusJson | ConvertTo-Json -Depth 10

  if (-not $statusJson.success) {
    throw 'No se pudo llevar el reporte a ready'
  }
}

Write-Host ''
Write-Host '=== CREAR TOKEN PUBLICO ==='
$createTokenResponse = Invoke-WebRequest `
  -UseBasicParsing `
  -Uri "$BaseUrl/api/report-access-tokens" `
  -Method POST `
  -WebSession $clinicSession `
  -ContentType 'application/json' `
  -Headers @{ Origin = $origin } `
  -Body (@{
    reportId = $reportId
    expiresAt = (Get-Date).ToUniversalTime().AddDays(7).ToString('o')
  } | ConvertTo-Json -Compress)

$createTokenJson = $createTokenResponse.Content | ConvertFrom-Json
$createTokenJson | ConvertTo-Json -Depth 10

if (-not $createTokenJson.success) {
  throw 'No se pudo crear el token pÃºblico'
}

$tokenId = $createTokenJson.reportAccessToken.id
$publicUrl = "$BaseUrl$($createTokenJson.publicAccessPath)"

Write-Host ""
Write-Host "tokenId: $tokenId"
Write-Host "publicUrl: $publicUrl"

Write-Host ''
Write-Host '=== LISTAR TOKENS DEL REPORTE ==='
$listTokensResponse = Invoke-WebRequest `
  -UseBasicParsing `
  -Uri "$BaseUrl/api/report-access-tokens?reportId=$reportId" `
  -WebSession $clinicSession
$listTokensJson = $listTokensResponse.Content | ConvertFrom-Json
$listTokensJson | ConvertTo-Json -Depth 10

Write-Host ''
Write-Host '=== DETALLE DEL TOKEN ANTES DEL ACCESO ==='
$getTokenBeforeResponse = Invoke-WebRequest `
  -UseBasicParsing `
  -Uri "$BaseUrl/api/report-access-tokens/$tokenId" `
  -WebSession $clinicSession
$getTokenBeforeJson = $getTokenBeforeResponse.Content | ConvertFrom-Json
$getTokenBeforeJson | ConvertTo-Json -Depth 10

Write-Host ''
Write-Host '=== ACCESO PUBLICO POR TOKEN ==='
$publicResponse = Invoke-WebRequest `
  -UseBasicParsing `
  -Uri $publicUrl
$publicJson = $publicResponse.Content | ConvertFrom-Json
$publicJson | ConvertTo-Json -Depth 10

if (-not $publicJson.success) {
  throw 'El acceso pÃºblico por token no devolviÃ³ success=true'
}

Write-Host ''
Write-Host '=== DETALLE DEL TOKEN DESPUES DEL ACCESO ==='
$getTokenAfterResponse = Invoke-WebRequest `
  -UseBasicParsing `
  -Uri "$BaseUrl/api/report-access-tokens/$tokenId" `
  -WebSession $clinicSession
$getTokenAfterJson = $getTokenAfterResponse.Content | ConvertFrom-Json
$getTokenAfterJson | ConvertTo-Json -Depth 10

if ($getTokenAfterJson.reportAccessToken.accessCount -lt 1) {
  throw 'accessCount no se incrementÃ³ luego del acceso pÃºblico'
}

Write-Host ''
Write-Host '=== REVOCAR TOKEN ==='
$revokeResponse = Invoke-WebRequest `
  -UseBasicParsing `
  -Uri "$BaseUrl/api/report-access-tokens/$tokenId/revoke" `
  -Method PATCH `
  -WebSession $clinicSession `
  -ContentType 'application/json' `
  -Headers @{ Origin = $origin } `
  -Body '{}'
$revokeJson = $revokeResponse.Content | ConvertFrom-Json
$revokeJson | ConvertTo-Json -Depth 10

if (-not $revokeJson.success) {
  throw 'La revocaciÃ³n del token fallÃ³'
}

Write-Host ''
Write-Host '=== REINTENTO DE ACCESO PUBLICO TRAS REVOCACION ==='
try {
  Invoke-WebRequest `
    -UseBasicParsing `
    -Uri $publicUrl `
    -ErrorAction Stop | Out-Null

  throw 'El acceso pÃºblico siguiÃ³ funcionando despuÃ©s de la revocaciÃ³n'
}
catch {
  if ($null -eq $_.Exception.Response) {
    throw
  }

  $statusCode = $_.Exception.Response.StatusCode.value__
  $errorBody = $_.ErrorDetails.Message

  Write-Host "HTTP STATUS: $statusCode"
  Write-Host 'BODY:'
  Write-Host $errorBody

  if ($statusCode -ne 410) {
    throw 'Se esperaba HTTP 410 luego de revocar el token'
  }
}

Write-Host ''
Write-Host '=== SMOKE REPORT ACCESS TOKENS COMPLETADO OK ==='
Write-Host "reportId: $reportId"
Write-Host "tokenId: $tokenId"
Write-Host "publicUrl probado y revocado correctamente"
