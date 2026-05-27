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

function Invoke-GetWithRetry {
  param(
    [string]$Url,
    [int]$TimeoutSec,
    [int]$Retries,
    [int]$MinAcceptedStatus,
    [int]$MaxAcceptedStatus
  )

  $lastStatusCode = $null
  $lastError = ""
  $lastContentLength = $null

  for ($attempt = 1; $attempt -le $Retries; $attempt++) {
    try {
      $response = Invoke-WebRequest `
        -UseBasicParsing `
        -Method Get `
        -Uri $Url `
        -TimeoutSec $TimeoutSec `
        -MaximumRedirection 5

      $statusCode = [int]$response.StatusCode
      $lastStatusCode = $statusCode

      $contentLength = $null
      if ($null -ne $response.Headers -and $null -ne $response.Headers["Content-Length"]) {
        $parsedLength = 0
        if ([int]::TryParse([string]$response.Headers["Content-Length"], [ref]$parsedLength)) {
          $contentLength = $parsedLength
        }
      }
      if ($null -eq $contentLength -and $null -ne $response.Content) {
        $contentLength = $response.Content.Length
      }
      $lastContentLength = $contentLength

      if ($statusCode -ge $MinAcceptedStatus -and $statusCode -le $MaxAcceptedStatus) {
        return [pscustomobject]@{
          Success = $true
          StatusCode = $statusCode
          ContentLength = $contentLength
          Attempts = $attempt
          Error = ""
        }
      }

      $lastError = "HTTP $statusCode fuera de rango aceptado ($MinAcceptedStatus-$MaxAcceptedStatus)"
    } catch {
      $statusFromException = Get-StatusCodeFromException -ErrorRecord $_
      if ($null -ne $statusFromException) {
        $lastStatusCode = $statusFromException
      }

      if ($null -ne $statusFromException -and $statusFromException -ge $MinAcceptedStatus -and $statusFromException -le $MaxAcceptedStatus) {
        return [pscustomobject]@{
          Success = $true
          StatusCode = $statusFromException
          ContentLength = $null
          Attempts = $attempt
          Error = ""
        }
      }

      $message = Sanitize-Text -Text $_.Exception.Message
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
    ContentLength = $lastContentLength
    Attempts = $Retries
    Error = (Sanitize-Text -Text $lastError)
  }
}

$BackendUrl = Normalize-Url -Url $BackendUrl
$FrontendUrl = Normalize-Url -Url $FrontendUrl

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
  $probe = Invoke-GetWithRetry `
    -Url $candidate.Url `
    -TimeoutSec $TimeoutSec `
    -Retries $Retries `
    -MinAcceptedStatus 200 `
    -MaxAcceptedStatus 299

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
$frontendProbe = Invoke-GetWithRetry `
  -Url "$FrontendUrl/" `
  -TimeoutSec $TimeoutSec `
  -Retries $Retries `
  -MinAcceptedStatus 200 `
  -MaxAcceptedStatus 399

if ($frontendProbe.Success) {
  $hasNonEmptyContent = ($null -eq $frontendProbe.ContentLength) -or ($frontendProbe.ContentLength -gt 0)
  if ($hasNonEmptyContent) {
    $contentPart = if ($null -eq $frontendProbe.ContentLength) {
      "contentLength=n/a"
    } else {
      "contentLength=$($frontendProbe.ContentLength)"
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

Add-CheckResult `
  -Name "Backend schema health (admin)" `
  -Status "SKIP" `
  -Required $false `
  -Detail "SKIP - requiere admin session (/api/admin/system/schema-health)"

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
