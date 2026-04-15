$ErrorActionPreference = 'Stop'
$repoRoot = 'C:\PORTAL-VETNEB'
if (-not (Test-Path $repoRoot)) {
  throw "No existe el repositorio en $repoRoot"
}

$migrationsDir = Join-Path $repoRoot 'drizzle\migrations'
$metaDir = Join-Path $migrationsDir 'meta'
$sqlPath = Join-Path $migrationsDir '0015_report_access_tokens_runtime_reconcile.sql'
$journalPath = Join-Path $metaDir '_journal.json'
$smokePath = Join-Path $repoRoot 'smoke-pr5-report-access-tokens.ps1'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if (-not (Test-Path $migrationsDir)) {
  New-Item -ItemType Directory -Force -Path $migrationsDir | Out-Null
}
if (-not (Test-Path $metaDir)) {
  New-Item -ItemType Directory -Force -Path $metaDir | Out-Null
}

$sql = @'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'report_access_tokens'
  ) THEN
    ALTER TABLE public.report_access_tokens
      ADD COLUMN IF NOT EXISTS created_by_clinic_user_id integer,
      ADD COLUMN IF NOT EXISTS created_by_admin_user_id integer,
      ADD COLUMN IF NOT EXISTS revoked_by_clinic_user_id integer,
      ADD COLUMN IF NOT EXISTS revoked_by_admin_user_id integer,
      ADD COLUMN IF NOT EXISTS token_last4 varchar(4),
      ADD COLUMN IF NOT EXISTS access_count integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_access_at timestamp,
      ADD COLUMN IF NOT EXISTS expires_at timestamp,
      ADD COLUMN IF NOT EXISTS revoked_at timestamp,
      ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now();

    UPDATE public.report_access_tokens
    SET token_last4 = RIGHT(token_hash, 4)
    WHERE token_last4 IS NULL;

    ALTER TABLE public.report_access_tokens
      ALTER COLUMN clinic_id SET NOT NULL,
      ALTER COLUMN report_id SET NOT NULL,
      ALTER COLUMN token_hash SET NOT NULL,
      ALTER COLUMN token_last4 SET NOT NULL,
      ALTER COLUMN access_count SET NOT NULL,
      ALTER COLUMN access_count SET DEFAULT 0,
      ALTER COLUMN created_at SET NOT NULL,
      ALTER COLUMN created_at SET DEFAULT now(),
      ALTER COLUMN updated_at SET NOT NULL,
      ALTER COLUMN updated_at SET DEFAULT now();
  ELSE
    CREATE TABLE public.report_access_tokens (
      id serial PRIMARY KEY NOT NULL,
      clinic_id integer NOT NULL,
      report_id integer NOT NULL,
      created_by_clinic_user_id integer,
      created_by_admin_user_id integer,
      revoked_by_clinic_user_id integer,
      revoked_by_admin_user_id integer,
      token_hash varchar(64) NOT NULL,
      token_last4 varchar(4) NOT NULL,
      access_count integer NOT NULL DEFAULT 0,
      last_access_at timestamp,
      expires_at timestamp,
      revoked_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_access_tokens_clinic_id_clinics_id_fk'
  ) THEN
    ALTER TABLE public.report_access_tokens
    ADD CONSTRAINT report_access_tokens_clinic_id_clinics_id_fk
    FOREIGN KEY (clinic_id)
    REFERENCES public.clinics(id)
    ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_access_tokens_report_id_reports_id_fk'
  ) THEN
    ALTER TABLE public.report_access_tokens
    ADD CONSTRAINT report_access_tokens_report_id_reports_id_fk
    FOREIGN KEY (report_id)
    REFERENCES public.reports(id)
    ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_access_tokens_created_by_clinic_user_id_clinic_users_id_fk'
  ) THEN
    ALTER TABLE public.report_access_tokens
    ADD CONSTRAINT report_access_tokens_created_by_clinic_user_id_clinic_users_id_fk
    FOREIGN KEY (created_by_clinic_user_id)
    REFERENCES public.clinic_users(id)
    ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_access_tokens_created_by_admin_user_id_admin_users_id_fk'
  ) THEN
    ALTER TABLE public.report_access_tokens
    ADD CONSTRAINT report_access_tokens_created_by_admin_user_id_admin_users_id_fk
    FOREIGN KEY (created_by_admin_user_id)
    REFERENCES public.admin_users(id)
    ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_access_tokens_revoked_by_clinic_user_id_clinic_users_id_fk'
  ) THEN
    ALTER TABLE public.report_access_tokens
    ADD CONSTRAINT report_access_tokens_revoked_by_clinic_user_id_clinic_users_id_fk
    FOREIGN KEY (revoked_by_clinic_user_id)
    REFERENCES public.clinic_users(id)
    ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_access_tokens_revoked_by_admin_user_id_admin_users_id_fk'
  ) THEN
    ALTER TABLE public.report_access_tokens
    ADD CONSTRAINT report_access_tokens_revoked_by_admin_user_id_admin_users_id_fk
    FOREIGN KEY (revoked_by_admin_user_id)
    REFERENCES public.admin_users(id)
    ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'report_access_tokens_token_hash_unique'
  ) THEN
    ALTER TABLE public.report_access_tokens
    ADD CONSTRAINT report_access_tokens_token_hash_unique UNIQUE (token_hash);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS report_access_tokens_token_hash_idx
  ON public.report_access_tokens (token_hash);

CREATE INDEX IF NOT EXISTS report_access_tokens_clinic_id_idx
  ON public.report_access_tokens (clinic_id);

CREATE INDEX IF NOT EXISTS report_access_tokens_report_id_idx
  ON public.report_access_tokens (report_id);

CREATE INDEX IF NOT EXISTS report_access_tokens_clinic_report_created_at_idx
  ON public.report_access_tokens (clinic_id, report_id, created_at);

CREATE INDEX IF NOT EXISTS report_access_tokens_expires_at_idx
  ON public.report_access_tokens (expires_at);

CREATE INDEX IF NOT EXISTS report_access_tokens_revoked_at_idx
  ON public.report_access_tokens (revoked_at);
'@
[System.IO.File]::WriteAllText($sqlPath, $sql, $utf8NoBom)
Write-Host "OK  drizzle\migrations\0015_report_access_tokens_runtime_reconcile.sql"

if (-not (Test-Path $journalPath)) {
  throw 'No existe drizzle\migrations\meta\_journal.json'
}

$journalRaw = Get-Content -Raw -Path $journalPath
if ($journalRaw.Length -gt 0 -and [int][char]$journalRaw[0] -eq 65279) {
  $journalRaw = $journalRaw.Substring(1)
}
$journal = $journalRaw | ConvertFrom-Json

$existing = $journal.entries | Where-Object { $_.tag -eq '0015_report_access_tokens_runtime_reconcile' }
if (-not $existing) {
  $nextIdx = 0
  if ($journal.entries.Count -gt 0) {
    $nextIdx = (($journal.entries | Measure-Object -Property idx -Maximum).Maximum + 1)
  }

  $entry = [PSCustomObject]@{
    idx = $nextIdx
    version = '7'
    when = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    tag = '0015_report_access_tokens_runtime_reconcile'
    breakpoints = $true
  }

  $journal.entries += $entry
}

$journalJson = $journal | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($journalPath, $journalJson, $utf8NoBom)
Write-Host "OK  drizzle\migrations\meta\_journal.json"

$smoke = @'
param(
  [string]$BaseUrl = 'http://localhost:3000',
  [string]$Username = 'publicdemo',
  [string]$Password = 'demo1234'
)

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
    username = $Username
    password = $Password
  } | ConvertTo-Json -Compress)

$loginJson = $loginResponse.Content | ConvertFrom-Json
$loginJson | ConvertTo-Json -Depth 10

if (-not $loginJson.success) {
  throw 'Login de clínica falló'
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
  throw 'No hay reportes disponibles para smoke de PR5'
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
  throw 'No se pudo crear el token público'
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
  throw 'El acceso público por token no devolvió success=true'
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
  throw 'accessCount no se incrementó luego del acceso público'
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
  throw 'La revocación del token falló'
}

Write-Host ''
Write-Host '=== REINTENTO DE ACCESO PUBLICO TRAS REVOCACION ==='
try {
  Invoke-WebRequest `
    -UseBasicParsing `
    -Uri $publicUrl `
    -ErrorAction Stop | Out-Null

  throw 'El acceso público siguió funcionando después de la revocación'
}
catch {
  if ($_.Exception.Response -eq $null) {
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
Write-Host '=== SMOKE PR5 COMPLETADO OK ==='
Write-Host "reportId: $reportId"
Write-Host "tokenId: $tokenId"
Write-Host "publicUrl probado y revocado correctamente"
'@
[System.IO.File]::WriteAllText($smokePath, $smoke, $utf8NoBom)
Write-Host "OK  smoke-pr5-report-access-tokens.ps1"

Write-Host ''
Write-Host 'Fix runtime PR5 aplicado correctamente en C:\PORTAL-VETNEB'
