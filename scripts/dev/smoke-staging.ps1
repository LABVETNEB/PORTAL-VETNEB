param(
  [string]$BackendUrl = "https://portal-vetneb-backend-staging.onrender.com",
  [string]$FrontendUrl = "https://portal-vetneb-frontend-staging.onrender.com",
  [int]$TimeoutSec = 30,
  [int]$Retries = 3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Sanitize-Text {
  param(
    [string]$Text,
    [int]$MaxLen = 220
  )

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return ""
  }

  $clean = ($Text -replace "\s+", " ").Trim()
  if ($clean.Length -gt $MaxLen) {
    return $clean.Substring(0, $MaxLen) + "..."
  }

  return $clean
}

function Normalize-Url {
  param([string]$Url)

  if ([string]::IsNullOrWhiteSpace($Url)) {
    return ""
  }

  return $Url.Trim().TrimEnd("/")
}

function Get-StatusCodeFromException {
  param([System.Management.Automation.ErrorRecord]$ErrorRecord)

  try {
    if ($null -ne $ErrorRecord.Exception.Response -and $null -ne $ErrorRecord.Exception.Response.StatusCode) {
      return [int]$ErrorRecord.Exception.Response.StatusCode
    }
  } catch {
  }

  return $null
}

function Get-HeadersFromException {
  param([System.Management.Automation.ErrorRecord]$ErrorRecord)

  try {
    if ($null -ne $ErrorRecord.Exception.Response -and $null -ne $ErrorRecord.Exception.Response.Headers) {
      return $ErrorRecord.Exception.Response.Headers
    }
  } catch {
  }

  return @{}
}

function Get-BodyFromException {
  param([System.Management.Automation.ErrorRecord]$ErrorRecord)

  try {
    if ($null -ne $ErrorRecord.ErrorDetails -and -not [string]::IsNullOrWhiteSpace($ErrorRecord.ErrorDetails.Message)) {
      return [string]$ErrorRecord.ErrorDetails.Message
    }
  } catch {
  }

  try {
    if ($null -ne $ErrorRecord.Exception -and -not [string]::IsNullOrWhiteSpace($ErrorRecord.Exception.Message)) {
      return [string]$ErrorRecord.Exception.Message
    }
  } catch {
  }

  return ""
}

function Try-ParseJson {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return $null
  }

  try {
    return $Text | ConvertFrom-Json -ErrorAction Stop
  } catch {
    return $null
  }
}

function Get-HeaderValue {
  param(
    $Headers,
    [string]$Name
  )

  if ($null -eq $Headers) {
    return ""
  }

  try {
    $value = $Headers[$Name]
    if ($null -eq $value) {
      return ""
    }
    if ($value -is [System.Array]) {
      return [string]($value -join ",")
    }
    return [string]$value
  } catch {
    return ""
  }
}

function Get-CookieFlagsFromHeaders {
  param($Headers)

  $setCookie = Get-HeaderValue -Headers $Headers -Name "Set-Cookie"
  if ([string]::IsNullOrWhiteSpace($setCookie)) {
    return [pscustomobject]@{
      HasSetCookie = $false
      HasSecure = $false
      HasSameSiteNone = $false
    }
  }

  return [pscustomobject]@{
    HasSetCookie = $true
    HasSecure = [bool]($setCookie -match "(?i)\bSecure\b")
    HasSameSiteNone = [bool]($setCookie -match "(?i)SameSite=None")
  }
}

function Invoke-SmokeRequest {
  param(
    [string]$Method,
    [string]$Url,
    [int]$TimeoutSec,
    [int]$Retries,
    [int[]]$ExpectedStatusCodes,
    [hashtable]$RequestHeaders = @{},
    [object]$BodyObject = $null,
    [Microsoft.PowerShell.Commands.WebRequestSession]$WebSession = $null
  )

  $lastStatusCode = $null
  $lastError = ""
  $lastHeaders = @{}
  $lastBody = ""

  for ($attempt = 1; $attempt -le $Retries; $attempt++) {
    $statusCode = $null
    $responseHeaders = @{}
    $body = ""

    try {
      $params = @{
        UseBasicParsing = $true
        Method = $Method
        Uri = $Url
        TimeoutSec = $TimeoutSec
        MaximumRedirection = 5
        ErrorAction = "Stop"
      }

      if ($RequestHeaders.Count -gt 0) {
        $params.Headers = $RequestHeaders
      }

      if ($null -ne $BodyObject) {
        $params.ContentType = "application/json"
        $params.Body = ($BodyObject | ConvertTo-Json -Depth 10 -Compress)
      }

      if ($null -ne $WebSession) {
        $params.WebSession = $WebSession
      }

      $response = Invoke-WebRequest @params
      $statusCode = [int]$response.StatusCode
      $responseHeaders = $response.Headers
      $body = if ($null -ne $response.Content) { [string]$response.Content } else { "" }

      $lastStatusCode = $statusCode
      $lastHeaders = $responseHeaders
      $lastBody = $body

      if ($ExpectedStatusCodes -contains $statusCode) {
        return [pscustomobject]@{
          Success = $true
          StatusCode = $statusCode
          Headers = $responseHeaders
          Body = $body
          Json = (Try-ParseJson -Text $body)
          Attempts = $attempt
          Error = ""
        }
      }

      $lastError = "HTTP $statusCode fuera de codigos esperados ($($ExpectedStatusCodes -join ','))"
    } catch {
      $statusFromException = Get-StatusCodeFromException -ErrorRecord $_
      if ($null -ne $statusFromException) {
        $lastStatusCode = $statusFromException
      }
      $responseHeaders = Get-HeadersFromException -ErrorRecord $_
      $body = Get-BodyFromException -ErrorRecord $_
      $lastHeaders = $responseHeaders
      $lastBody = $body

      if ($null -ne $statusFromException -and ($ExpectedStatusCodes -contains $statusFromException)) {
        return [pscustomobject]@{
          Success = $true
          StatusCode = $statusFromException
          Headers = $responseHeaders
          Body = $body
          Json = (Try-ParseJson -Text $body)
          Attempts = $attempt
          Error = ""
        }
      }

      $message = Sanitize-Text -Text (Get-BodyFromException -ErrorRecord $_)
      $lastError = if ($null -ne $statusFromException) {
        "HTTP $statusFromException - $message"
      } else {
        $message
      }
    }

    if ($attempt -lt $Retries) {
      $sleepSec = [Math]::Min(6, $attempt)
      Write-Host ("  RETRY {0}/{1} -> {2}" -f $attempt, $Retries, (Sanitize-Text -Text $lastError -MaxLen 160)) -ForegroundColor DarkYellow
      Start-Sleep -Seconds $sleepSec
    }
  }

  return [pscustomobject]@{
    Success = $false
    StatusCode = $lastStatusCode
    Headers = $lastHeaders
    Body = $lastBody
    Json = (Try-ParseJson -Text $lastBody)
    Attempts = $Retries
    Error = (Sanitize-Text -Text $lastError)
  }
}

function Add-CheckResult {
  param(
    [string]$Name,
    [string]$Status,
    [bool]$Required,
    [string]$Detail
  )

  $results.Add([pscustomobject]@{
    Name = $Name
    Status = $Status
    Required = $Required
    Detail = (Sanitize-Text -Text $Detail)
  })
}

function Mark-CredentialCheckSkipSet {
  param(
    [string[]]$CheckNames,
    [string]$MissingReason
  )

  foreach ($checkName in $CheckNames) {
    Add-CheckResult -Name $checkName -Status "SKIP" -Required $false -Detail ("SKIP - " + $MissingReason)
  }
}

$BackendUrl = Normalize-Url -Url $BackendUrl
$FrontendUrl = Normalize-Url -Url $FrontendUrl
$ExpectedSecureCookieFlags = $BackendUrl.StartsWith("https://")

if ([string]::IsNullOrWhiteSpace($BackendUrl)) {
  Write-Host "BackendUrl es requerido." -ForegroundColor Red
  exit 1
}

if ([string]::IsNullOrWhiteSpace($FrontendUrl)) {
  Write-Host "FrontendUrl es requerido." -ForegroundColor Red
  exit 1
}

if ($TimeoutSec -le 0) {
  Write-Host "TimeoutSec debe ser mayor a 0." -ForegroundColor Red
  exit 1
}

if ($Retries -lt 1) {
  Write-Host "Retries debe ser al menos 1." -ForegroundColor Red
  exit 1
}

$startedAt = Get-Date
$results = [System.Collections.Generic.List[object]]::new()

Write-Host ""
Write-Host "=== STAGING SMOKE CHECK ===" -ForegroundColor Cyan
Write-Host "BackendUrl : $BackendUrl"
Write-Host "FrontendUrl: $FrontendUrl"
Write-Host "TimeoutSec : $TimeoutSec"
Write-Host "Retries    : $Retries"
Write-Host ""

$backendCandidates = @(
  [pscustomobject]@{ Label = "GET /health"; Url = "$BackendUrl/health" },
  [pscustomobject]@{ Label = "GET /api/health"; Url = "$BackendUrl/api/health" },
  [pscustomobject]@{ Label = "GET /"; Url = "$BackendUrl/" }
)

$backendSuccess = $null
$backendErrors = [System.Collections.Generic.List[string]]::new()

foreach ($candidate in $backendCandidates) {
  Write-Host ("Probing backend: {0}" -f $candidate.Label) -ForegroundColor DarkGray
  $probe = Invoke-SmokeRequest `
    -Method "GET" `
    -Url $candidate.Url `
    -TimeoutSec $TimeoutSec `
    -Retries $Retries `
    -ExpectedStatusCodes @(200)

  if ($probe.Success) {
    $backendSuccess = [pscustomobject]@{
      Label = $candidate.Label
      Url = $candidate.Url
      StatusCode = $probe.StatusCode
      Attempts = $probe.Attempts
    }
    break
  }

  $backendErrors.Add(("{0}: {1}" -f $candidate.Label, $probe.Error))
}

if ($null -ne $backendSuccess) {
  Add-CheckResult `
    -Name "Backend staging alive" `
    -Status "OK" `
    -Required $true `
    -Detail ("{0} respondio HTTP {1} (attempts={2})" -f $backendSuccess.Label, $backendSuccess.StatusCode, $backendSuccess.Attempts)
} else {
  Add-CheckResult `
    -Name "Backend staging alive" `
    -Status "FAIL" `
    -Required $true `
    -Detail ("Sin endpoint publico OK. " + (($backendErrors -join " | ")))
}

Write-Host "Probing frontend: GET /" -ForegroundColor DarkGray
$frontendProbe = Invoke-SmokeRequest `
  -Method "GET" `
  -Url "$FrontendUrl/" `
  -TimeoutSec $TimeoutSec `
  -Retries $Retries `
  -ExpectedStatusCodes @(200, 301, 302, 303, 307, 308)

if ($frontendProbe.Success) {
  $contentLength = $null
  $contentLengthHeader = Get-HeaderValue -Headers $frontendProbe.Headers -Name "Content-Length"
  if (-not [string]::IsNullOrWhiteSpace($contentLengthHeader)) {
    $parsedLength = 0
    if ([int]::TryParse($contentLengthHeader, [ref]$parsedLength)) {
      $contentLength = $parsedLength
    }
  } elseif (-not [string]::IsNullOrWhiteSpace($frontendProbe.Body)) {
    $contentLength = $frontendProbe.Body.Length
  }

  $hasNonEmptyContent = ($null -eq $contentLength) -or ($contentLength -gt 0)
  if ($hasNonEmptyContent) {
    $contentPart = if ($null -eq $contentLength) {
      "contentLength=n/a"
    } else {
      "contentLength=$contentLength"
    }

    Add-CheckResult `
      -Name "Frontend staging alive" `
      -Status "OK" `
      -Required $true `
      -Detail ("GET / respondio HTTP {0} ({1}, attempts={2})" -f $frontendProbe.StatusCode, $contentPart, $frontendProbe.Attempts)
  } else {
    Add-CheckResult `
      -Name "Frontend staging alive" `
      -Status "FAIL" `
      -Required $true `
      -Detail ("GET / respondio HTTP {0} con contenido vacio" -f $frontendProbe.StatusCode)
  }
} else {
  Add-CheckResult `
    -Name "Frontend staging alive" `
    -Status "FAIL" `
    -Required $true `
    -Detail ("GET / fallo. " + $frontendProbe.Error)
}

$corsHeaders = @{
  Origin = $FrontendUrl
  "Access-Control-Request-Method" = "POST"
}

$corsPreflight = Invoke-SmokeRequest `
  -Method "OPTIONS" `
  -Url "$BackendUrl/api/auth/login" `
  -TimeoutSec $TimeoutSec `
  -Retries $Retries `
  -ExpectedStatusCodes @(204) `
  -RequestHeaders $corsHeaders

if (-not $corsPreflight.Success) {
  Add-CheckResult `
    -Name "CORS preflight /api/auth/login (frontend origin)" `
    -Status "FAIL" `
    -Required $true `
    -Detail ("Esperado HTTP 204. " + $corsPreflight.Error)
} else {
  $allowOrigin = Get-HeaderValue -Headers $corsPreflight.Headers -Name "Access-Control-Allow-Origin"
  $allowCredentials = Get-HeaderValue -Headers $corsPreflight.Headers -Name "Access-Control-Allow-Credentials"

  if (($allowOrigin -ne $FrontendUrl) -or ($allowCredentials -ne "true")) {
    Add-CheckResult `
      -Name "CORS preflight /api/auth/login (frontend origin)" `
      -Status "FAIL" `
      -Required $true `
      -Detail ("Header mismatch allow-origin=$allowOrigin allow-credentials=$allowCredentials")
  } else {
    Add-CheckResult `
      -Name "CORS preflight /api/auth/login (frontend origin)" `
      -Status "OK" `
      -Required $true `
      -Detail ("HTTP 204 allow-origin=$allowOrigin allow-credentials=$allowCredentials")
  }
}

$badOriginCheck = Invoke-SmokeRequest `
  -Method "POST" `
  -Url "$BackendUrl/api/auth/logout" `
  -TimeoutSec $TimeoutSec `
  -Retries $Retries `
  -ExpectedStatusCodes @(403) `
  -RequestHeaders @{ Origin = "https://example.invalid" } `
  -BodyObject @{}

if ($badOriginCheck.Success) {
  Add-CheckResult `
    -Name "Unsafe bad origin blocked (/api/auth/logout)" `
    -Status "OK" `
    -Required $true `
    -Detail "HTTP 403 para origin no permitido"
} else {
  Add-CheckResult `
    -Name "Unsafe bad origin blocked (/api/auth/logout)" `
    -Status "FAIL" `
    -Required $true `
    -Detail ("Esperado HTTP 403. " + $badOriginCheck.Error)
}

$adminUser = [Environment]::GetEnvironmentVariable("SMOKE_ADMIN_USERNAME")
$adminPassword = [Environment]::GetEnvironmentVariable("SMOKE_ADMIN_PASSWORD")
$hasAdminCreds = -not [string]::IsNullOrWhiteSpace($adminUser) -and -not [string]::IsNullOrWhiteSpace($adminPassword)

if ($hasAdminCreds) {
  $adminSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $adminLogin = Invoke-SmokeRequest `
    -Method "POST" `
    -Url "$BackendUrl/api/admin/auth/login" `
    -TimeoutSec $TimeoutSec `
    -Retries $Retries `
    -ExpectedStatusCodes @(200) `
    -RequestHeaders @{ Origin = $FrontendUrl } `
    -BodyObject @{
      username = $adminUser
      password = $adminPassword
    } `
    -WebSession $adminSession

  if (-not $adminLogin.Success) {
    Add-CheckResult -Name "Admin login (/api/admin/auth/login)" -Status "FAIL" -Required $true -Detail ("Esperado HTTP 200. " + $adminLogin.Error)
  } else {
    $cookieFlags = Get-CookieFlagsFromHeaders -Headers $adminLogin.Headers
    $cookieDetail = "setCookie=" + ($(if ($cookieFlags.HasSetCookie) { "present" } else { "missing" })) + " secure=" + ($(if ($cookieFlags.HasSecure) { "yes" } else { "no" })) + " sameSiteNone=" + ($(if ($cookieFlags.HasSameSiteNone) { "yes" } else { "no" }))
    $cookieFlagsValid = (-not $ExpectedSecureCookieFlags) -or ($cookieFlags.HasSecure -and $cookieFlags.HasSameSiteNone)

    if (-not $cookieFlagsValid) {
      Add-CheckResult -Name "Admin login (/api/admin/auth/login)" -Status "FAIL" -Required $true -Detail ("HTTP 200 pero flags de cookie invalidos ($cookieDetail)")
    } else {
      Add-CheckResult -Name "Admin login (/api/admin/auth/login)" -Status "OK" -Required $true -Detail ("HTTP 200 ($cookieDetail)")
    }
  }

  $adminMe = Invoke-SmokeRequest `
    -Method "GET" `
    -Url "$BackendUrl/api/admin/auth/me" `
    -TimeoutSec $TimeoutSec `
    -Retries $Retries `
    -ExpectedStatusCodes @(200) `
    -RequestHeaders @{ Origin = $FrontendUrl } `
    -WebSession $adminSession

  Add-CheckResult -Name "Admin me (/api/admin/auth/me)" -Status ($(if ($adminMe.Success) { "OK" } else { "FAIL" })) -Required $true -Detail ($(if ($adminMe.Success) { "HTTP 200" } else { "Esperado HTTP 200. " + $adminMe.Error }))

  $adminSystemHealth = Invoke-SmokeRequest `
    -Method "GET" `
    -Url "$BackendUrl/api/admin/system/health" `
    -TimeoutSec $TimeoutSec `
    -Retries $Retries `
    -ExpectedStatusCodes @(200) `
    -RequestHeaders @{ Origin = $FrontendUrl } `
    -WebSession $adminSession

  Add-CheckResult -Name "Admin system health (/api/admin/system/health)" -Status ($(if ($adminSystemHealth.Success) { "OK" } else { "FAIL" })) -Required $true -Detail ($(if ($adminSystemHealth.Success) { "HTTP 200" } else { "Esperado HTTP 200. " + $adminSystemHealth.Error }))

  $adminSchemaHealth = Invoke-SmokeRequest `
    -Method "GET" `
    -Url "$BackendUrl/api/admin/system/schema-health" `
    -TimeoutSec $TimeoutSec `
    -Retries $Retries `
    -ExpectedStatusCodes @(200, 503) `
    -RequestHeaders @{ Origin = $FrontendUrl } `
    -WebSession $adminSession

  if (-not $adminSchemaHealth.Success) {
    Add-CheckResult -Name "Admin schema health (/api/admin/system/schema-health)" -Status "FAIL" -Required $true -Detail ("Esperado HTTP 200 o 503. " + $adminSchemaHealth.Error)
  } else {
    $schemaStatus = ""
    if ($null -ne $adminSchemaHealth.Json -and $null -ne $adminSchemaHealth.Json.status) {
      $schemaStatus = [string]$adminSchemaHealth.Json.status
    }

    if ($adminSchemaHealth.StatusCode -eq 200 -and $schemaStatus -eq "ok") {
      Add-CheckResult -Name "Admin schema health (/api/admin/system/schema-health)" -Status "OK" -Required $true -Detail "HTTP 200 status=ok"
    } elseif ($adminSchemaHealth.StatusCode -eq 503 -and $schemaStatus -eq "degraded") {
      Add-CheckResult -Name "Admin schema health (/api/admin/system/schema-health)" -Status "FAIL" -Required $true -Detail "HTTP 503 status=degraded (bloquea readiness de staging)"
    } else {
      Add-CheckResult -Name "Admin schema health (/api/admin/system/schema-health)" -Status "FAIL" -Required $true -Detail ("HTTP " + $adminSchemaHealth.StatusCode + " status=" + $schemaStatus + " (resultado no aceptable)")
    }
  }

  $adminLogout = Invoke-SmokeRequest `
    -Method "POST" `
    -Url "$BackendUrl/api/admin/auth/logout" `
    -TimeoutSec $TimeoutSec `
    -Retries $Retries `
    -ExpectedStatusCodes @(200) `
    -RequestHeaders @{ Origin = $FrontendUrl } `
    -BodyObject @{} `
    -WebSession $adminSession

  Add-CheckResult -Name "Admin logout (/api/admin/auth/logout)" -Status ($(if ($adminLogout.Success) { "OK" } else { "FAIL" })) -Required $true -Detail ($(if ($adminLogout.Success) { "HTTP 200" } else { "Esperado HTTP 200. " + $adminLogout.Error }))
} else {
  Mark-CredentialCheckSkipSet -CheckNames @(
    "Admin login (/api/admin/auth/login)",
    "Admin me (/api/admin/auth/me)",
    "Admin system health (/api/admin/system/health)",
    "Admin schema health (/api/admin/system/schema-health)",
    "Admin logout (/api/admin/auth/logout)"
  ) -MissingReason "faltan env vars SMOKE_ADMIN_USERNAME/SMOKE_ADMIN_PASSWORD"
}

$clinicUser = [Environment]::GetEnvironmentVariable("SMOKE_CLINIC_USERNAME")
$clinicPassword = [Environment]::GetEnvironmentVariable("SMOKE_CLINIC_PASSWORD")
$hasClinicCreds = -not [string]::IsNullOrWhiteSpace($clinicUser) -and -not [string]::IsNullOrWhiteSpace($clinicPassword)

if ($hasClinicCreds) {
  $clinicSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $clinicLogin = Invoke-SmokeRequest `
    -Method "POST" `
    -Url "$BackendUrl/api/auth/login" `
    -TimeoutSec $TimeoutSec `
    -Retries $Retries `
    -ExpectedStatusCodes @(200) `
    -RequestHeaders @{ Origin = $FrontendUrl } `
    -BodyObject @{
      username = $clinicUser
      password = $clinicPassword
    } `
    -WebSession $clinicSession

  if (-not $clinicLogin.Success) {
    Add-CheckResult -Name "Clinic login (/api/auth/login)" -Status "FAIL" -Required $true -Detail ("Esperado HTTP 200. " + $clinicLogin.Error)
  } else {
    $clinicCookieFlags = Get-CookieFlagsFromHeaders -Headers $clinicLogin.Headers
    $clinicCookieDetail = "setCookie=" + ($(if ($clinicCookieFlags.HasSetCookie) { "present" } else { "missing" })) + " secure=" + ($(if ($clinicCookieFlags.HasSecure) { "yes" } else { "no" })) + " sameSiteNone=" + ($(if ($clinicCookieFlags.HasSameSiteNone) { "yes" } else { "no" }))
    $clinicCookieFlagsValid = (-not $ExpectedSecureCookieFlags) -or ($clinicCookieFlags.HasSecure -and $clinicCookieFlags.HasSameSiteNone)

    if (-not $clinicCookieFlagsValid) {
      Add-CheckResult -Name "Clinic login (/api/auth/login)" -Status "FAIL" -Required $true -Detail ("HTTP 200 pero flags de cookie invalidos ($clinicCookieDetail)")
    } else {
      Add-CheckResult -Name "Clinic login (/api/auth/login)" -Status "OK" -Required $true -Detail ("HTTP 200 ($clinicCookieDetail)")
    }
  }

  $clinicMe = Invoke-SmokeRequest -Method "GET" -Url "$BackendUrl/api/auth/me" -TimeoutSec $TimeoutSec -Retries $Retries -ExpectedStatusCodes @(200) -RequestHeaders @{ Origin = $FrontendUrl } -WebSession $clinicSession
  Add-CheckResult -Name "Clinic me (/api/auth/me)" -Status ($(if ($clinicMe.Success) { "OK" } else { "FAIL" })) -Required $true -Detail ($(if ($clinicMe.Success) { "HTTP 200" } else { "Esperado HTTP 200. " + $clinicMe.Error }))

  $clinicReports = Invoke-SmokeRequest -Method "GET" -Url "$BackendUrl/api/reports?limit=10&offset=0" -TimeoutSec $TimeoutSec -Retries $Retries -ExpectedStatusCodes @(200) -RequestHeaders @{ Origin = $FrontendUrl } -WebSession $clinicSession
  Add-CheckResult -Name "Clinic reports list (/api/reports?limit=10&offset=0)" -Status ($(if ($clinicReports.Success) { "OK" } else { "FAIL" })) -Required $true -Detail ($(if ($clinicReports.Success) { "HTTP 200" } else { "Esperado HTTP 200. " + $clinicReports.Error }))

  $clinicProfile = Invoke-SmokeRequest -Method "GET" -Url "$BackendUrl/api/clinic/profile" -TimeoutSec $TimeoutSec -Retries $Retries -ExpectedStatusCodes @(200) -RequestHeaders @{ Origin = $FrontendUrl } -WebSession $clinicSession
  Add-CheckResult -Name "Clinic profile (/api/clinic/profile)" -Status ($(if ($clinicProfile.Success) { "OK" } else { "FAIL" })) -Required $true -Detail ($(if ($clinicProfile.Success) { "HTTP 200" } else { "Esperado HTTP 200. " + $clinicProfile.Error }))

  $clinicParticularTokens = Invoke-SmokeRequest -Method "GET" -Url "$BackendUrl/api/particular-tokens?limit=10&offset=0" -TimeoutSec $TimeoutSec -Retries $Retries -ExpectedStatusCodes @(200) -RequestHeaders @{ Origin = $FrontendUrl } -WebSession $clinicSession
  Add-CheckResult -Name "Clinic particular tokens list (/api/particular-tokens?limit=10&offset=0)" -Status ($(if ($clinicParticularTokens.Success) { "OK" } else { "FAIL" })) -Required $true -Detail ($(if ($clinicParticularTokens.Success) { "HTTP 200" } else { "Esperado HTTP 200. " + $clinicParticularTokens.Error }))

  $clinicLogout = Invoke-SmokeRequest -Method "POST" -Url "$BackendUrl/api/auth/logout" -TimeoutSec $TimeoutSec -Retries $Retries -ExpectedStatusCodes @(200) -RequestHeaders @{ Origin = $FrontendUrl } -BodyObject @{} -WebSession $clinicSession
  Add-CheckResult -Name "Clinic logout (/api/auth/logout)" -Status ($(if ($clinicLogout.Success) { "OK" } else { "FAIL" })) -Required $true -Detail ($(if ($clinicLogout.Success) { "HTTP 200" } else { "Esperado HTTP 200. " + $clinicLogout.Error }))
} else {
  Mark-CredentialCheckSkipSet -CheckNames @(
    "Clinic login (/api/auth/login)",
    "Clinic me (/api/auth/me)",
    "Clinic reports list (/api/reports?limit=10&offset=0)",
    "Clinic profile (/api/clinic/profile)",
    "Clinic particular tokens list (/api/particular-tokens?limit=10&offset=0)",
    "Clinic logout (/api/auth/logout)"
  ) -MissingReason "faltan env vars SMOKE_CLINIC_USERNAME/SMOKE_CLINIC_PASSWORD"
}

$particularToken = [Environment]::GetEnvironmentVariable("SMOKE_PARTICULAR_TOKEN")
$hasParticularToken = -not [string]::IsNullOrWhiteSpace($particularToken)

if ($hasParticularToken) {
  $particularSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $particularLogin = Invoke-SmokeRequest `
    -Method "POST" `
    -Url "$BackendUrl/api/particular/auth/login" `
    -TimeoutSec $TimeoutSec `
    -Retries $Retries `
    -ExpectedStatusCodes @(200) `
    -RequestHeaders @{ Origin = $FrontendUrl } `
    -BodyObject @{
      token = $particularToken
    } `
    -WebSession $particularSession

  Add-CheckResult -Name "Particular login (/api/particular/auth/login)" -Status ($(if ($particularLogin.Success) { "OK" } else { "FAIL" })) -Required $true -Detail ($(if ($particularLogin.Success) { "HTTP 200" } else { "Esperado HTTP 200. " + $particularLogin.Error }))

  $particularMe = Invoke-SmokeRequest -Method "GET" -Url "$BackendUrl/api/particular/auth/me" -TimeoutSec $TimeoutSec -Retries $Retries -ExpectedStatusCodes @(200) -RequestHeaders @{ Origin = $FrontendUrl } -WebSession $particularSession
  Add-CheckResult -Name "Particular me (/api/particular/auth/me)" -Status ($(if ($particularMe.Success) { "OK" } else { "FAIL" })) -Required $true -Detail ($(if ($particularMe.Success) { "HTTP 200" } else { "Esperado HTTP 200. " + $particularMe.Error }))

  $particularPreviewUrl = Invoke-SmokeRequest -Method "GET" -Url "$BackendUrl/api/particular/auth/report/preview-url" -TimeoutSec $TimeoutSec -Retries $Retries -ExpectedStatusCodes @(200, 409) -RequestHeaders @{ Origin = $FrontendUrl } -WebSession $particularSession
  if (-not $particularPreviewUrl.Success) {
    Add-CheckResult -Name "Particular report preview (/api/particular/auth/report/preview-url)" -Status "FAIL" -Required $true -Detail ("Esperado HTTP 200 o 409. " + $particularPreviewUrl.Error)
  } elseif ($particularPreviewUrl.StatusCode -eq 409) {
    Add-CheckResult -Name "Particular report preview (/api/particular/auth/report/preview-url)" -Status "OK" -Required $true -Detail "HTTP 409 sin informe vinculado"
  } else {
    $previewPresent = $false
    if ($null -ne $particularPreviewUrl.Json -and $null -ne $particularPreviewUrl.Json.previewUrl) {
      $previewPresent = -not [string]::IsNullOrWhiteSpace([string]$particularPreviewUrl.Json.previewUrl)
    }
    Add-CheckResult -Name "Particular report preview (/api/particular/auth/report/preview-url)" -Status "OK" -Required $true -Detail ("HTTP 200 signedUrl=" + ($(if ($previewPresent) { "present" } else { "missing" })))
  }

  $particularDownloadUrl = Invoke-SmokeRequest -Method "GET" -Url "$BackendUrl/api/particular/auth/report/download-url" -TimeoutSec $TimeoutSec -Retries $Retries -ExpectedStatusCodes @(200, 409) -RequestHeaders @{ Origin = $FrontendUrl } -WebSession $particularSession
  if (-not $particularDownloadUrl.Success) {
    Add-CheckResult -Name "Particular report download (/api/particular/auth/report/download-url)" -Status "FAIL" -Required $true -Detail ("Esperado HTTP 200 o 409. " + $particularDownloadUrl.Error)
  } elseif ($particularDownloadUrl.StatusCode -eq 409) {
    Add-CheckResult -Name "Particular report download (/api/particular/auth/report/download-url)" -Status "OK" -Required $true -Detail "HTTP 409 sin informe vinculado"
  } else {
    $downloadPresent = $false
    if ($null -ne $particularDownloadUrl.Json -and $null -ne $particularDownloadUrl.Json.downloadUrl) {
      $downloadPresent = -not [string]::IsNullOrWhiteSpace([string]$particularDownloadUrl.Json.downloadUrl)
    }
    Add-CheckResult -Name "Particular report download (/api/particular/auth/report/download-url)" -Status "OK" -Required $true -Detail ("HTTP 200 signedUrl=" + ($(if ($downloadPresent) { "present" } else { "missing" })))
  }

  $particularLogout = Invoke-SmokeRequest -Method "POST" -Url "$BackendUrl/api/particular/auth/logout" -TimeoutSec $TimeoutSec -Retries $Retries -ExpectedStatusCodes @(200) -RequestHeaders @{ Origin = $FrontendUrl } -BodyObject @{} -WebSession $particularSession
  Add-CheckResult -Name "Particular logout (/api/particular/auth/logout)" -Status ($(if ($particularLogout.Success) { "OK" } else { "FAIL" })) -Required $true -Detail ($(if ($particularLogout.Success) { "HTTP 200" } else { "Esperado HTTP 200. " + $particularLogout.Error }))
} else {
  Mark-CredentialCheckSkipSet -CheckNames @(
    "Particular login (/api/particular/auth/login)",
    "Particular me (/api/particular/auth/me)",
    "Particular report preview (/api/particular/auth/report/preview-url)",
    "Particular report download (/api/particular/auth/report/download-url)",
    "Particular logout (/api/particular/auth/logout)"
  ) -MissingReason "falta env var SMOKE_PARTICULAR_TOKEN"
}

Write-Host ""
Write-Host "=== CHECKS ===" -ForegroundColor Cyan
foreach ($item in $results) {
  $color = switch ($item.Status) {
    "OK" { "Green" }
    "FAIL" { "Red" }
    "SKIP" { "DarkGray" }
    default { "White" }
  }

  Write-Host ("[{0}] {1} :: {2}" -f $item.Status, $item.Name, $item.Detail) -ForegroundColor $color
}

$durationMs = [int][Math]::Round(((Get-Date) - $startedAt).TotalMilliseconds)
$total = $results.Count
$passed = @($results | Where-Object { $_.Status -eq "OK" }).Count
$failed = @($results | Where-Object { $_.Status -eq "FAIL" }).Count
$skipped = @($results | Where-Object { $_.Status -eq "SKIP" }).Count
$requiredFailed = @($results | Where-Object { $_.Required -and $_.Status -eq "FAIL" }).Count

Write-Host ""
Write-Host "=== SUMMARY ===" -ForegroundColor Cyan
Write-Host ("total={0} passed={1} failed={2} skipped={3} durationMs={4}" -f $total, $passed, $failed, $skipped, $durationMs)

if ($requiredFailed -gt 0) {
  exit 1
}

exit 0
