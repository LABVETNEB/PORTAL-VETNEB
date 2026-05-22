# Staging and production smoke runbook PowerShell

Runbook accionable para validar staging y repetir el mismo smoke despues del
deploy productivo. No pegar secretos, passwords, tokens reales ni signed URLs en
logs, issues, PRs o capturas.

## 1. Variables requeridas

Ejecutar en PowerShell desde una terminal limpia. Los dos valores publicos son
obligatorios y no deben tener trailing slash.

```powershell
$BackendUrl = "https://<backend-staging-or-production>"
$FrontendUrl = "https://<frontend-staging-or-production>"
$Origin = $FrontendUrl

if (-not $BackendUrl.StartsWith("https://")) { throw "BackendUrl debe usar https" }
if (-not $FrontendUrl.StartsWith("https://")) { throw "FrontendUrl debe usar https" }
if ($BackendUrl.EndsWith("/") -or $FrontendUrl.EndsWith("/")) {
  throw "BackendUrl y FrontendUrl no deben tener trailing slash"
}
```

### Preflight Render para comunicaciones

Antes del smoke del formulario de contacto, confirmar en Render que quedaron
configuradas estas variables y luego ejecutar redeploy:

- Servicio backend staging: `portal-vetneb-backend-staging`
  - `NODE_ENV=production`
  - `PORT=10000`
  - `CORS_ORIGIN=https://portal-vetneb-frontend-staging.onrender.com`
  - `SMTP_HOST=smtp.gmail.com`
  - `SMTP_PORT=587`
  - `SMTP_SECURE=false`
  - `SMTP_USER=lab.vetneb@gmail.com`
  - `SMTP_PASS=<GMAIL_APP_PASSWORD_WITHOUT_SPACES>`
  - `SMTP_FROM=lab.vetneb@gmail.com`
  - `CONTACT_TO=lab.vetneb@gmail.com`
- Servicio frontend staging: `portal-vetneb-frontend-staging`
  - `NODE_ENV=production`
  - `NEXT_PUBLIC_API_URL=https://portal-vetneb-backend-staging.onrender.com`
  - `NEXT_PUBLIC_SITE_URL=https://portal-vetneb-frontend-staging.onrender.com`

Variables prohibidas en frontend staging:
`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`,
`SMTP_FROM`, `CONTACT_TO`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`,
`SUPABASE_DB_URL`

Sin redeploy posterior al cambio de env, staging puede seguir respondiendo con
estado degradado de SMTP aunque la configuración ya esté cargada en el panel.

Secuencia mínima obligatoria en staging:

1. Guardar variables backend Render.
2. Guardar variables frontend Render.
3. Redeploy backend Render.
4. Redeploy frontend Render.
5. Verificar `/dashboard/admin` autenticado:
   - `Correo SMTP` = `Configurado`
   - `Contacto email` = `Configurado`
   - `CORS público` incluye `https://portal-vetneb-frontend-staging.onrender.com`

## 2. Helpers para status code y errores

Estos helpers capturan status code tambien cuando `Invoke-WebRequest` lanza
excepcion por HTTP 4xx/5xx. No imprimen secretos por defecto.

```powershell
$ErrorActionPreference = "Stop"

function Convert-SecretToPlainText {
  param([Parameter(Mandatory = $true)][securestring]$Secret)

  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secret)
  try {
    [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Invoke-SmokeRequest {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("GET", "POST", "PATCH", "DELETE", "OPTIONS")]
    [string]$Method,

    [Parameter(Mandatory = $true)]
    [string]$Uri,

    [Microsoft.PowerShell.Commands.WebRequestSession]$WebSession,
    [hashtable]$Headers = @{},
    [object]$BodyObject
  )

  $params = @{
    UseBasicParsing = $true
    Uri             = $Uri
    Method          = $Method
    ErrorAction     = "Stop"
  }

  if ($null -ne $WebSession) {
    $params.WebSession = $WebSession
  }

  if ($Headers.Count -gt 0) {
    $params.Headers = $Headers
  }

  if ($null -ne $BodyObject) {
    $params.ContentType = "application/json"
    $params.Body = ($BodyObject | ConvertTo-Json -Depth 10 -Compress)
  }

  try {
    $response = Invoke-WebRequest @params
    $json = $null

    if ($response.Content) {
      try {
        $json = $response.Content | ConvertFrom-Json -ErrorAction Stop
      }
      catch {
        $json = $null
      }
    }

    return [pscustomobject]@{
      Ok         = $true
      Method     = $Method
      Uri        = $Uri
      StatusCode = [int]$response.StatusCode
      Headers    = $response.Headers
      Json       = $json
      Body       = $response.Content
      Error      = $null
    }
  }
  catch {
    $statusCode = 0
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $statusCode = [int]$_.Exception.Response.StatusCode
    }

    return [pscustomobject]@{
      Ok         = $false
      Method     = $Method
      Uri        = $Uri
      StatusCode = $statusCode
      Headers    = @{}
      Json       = $null
      Body       = $_.ErrorDetails.Message
      Error      = $_.Exception.Message
    }
  }
}

function Show-SmokeResult {
  param(
    [Parameter(Mandatory = $true)]$Result,
    [switch]$IncludeBody
  )

  $line = "{0} {1} -> HTTP {2}" -f $Result.Method, $Result.Uri, $Result.StatusCode
  if ($Result.Ok) {
    Write-Host $line -ForegroundColor Green
  }
  else {
    Write-Host $line -ForegroundColor Red
    if ($Result.Error) { Write-Host $Result.Error -ForegroundColor Red }
  }

  if ($IncludeBody -and $Result.Body) {
    $Result.Body
  }
}

function Assert-SmokeStatus {
  param(
    [Parameter(Mandatory = $true)]$Result,
    [Parameter(Mandatory = $true)][int[]]$ExpectedStatus,
    [Parameter(Mandatory = $true)][string]$Name
  )

  if ($Result.StatusCode -notin $ExpectedStatus) {
    throw "$Name fallo. Esperado HTTP $($ExpectedStatus -join ', '), recibido HTTP $($Result.StatusCode)"
  }
}
```

## 3. Healthcheck backend

`/health` debe devolver DB y Storage `up`. `/api/health` debe responder 200.

```powershell
$Health = Invoke-SmokeRequest -Method GET -Uri "$BackendUrl/health"
Show-SmokeResult $Health
Assert-SmokeStatus $Health 200 "Backend /health"

if ($Health.Json.checks.database -ne "up") { throw "Database no esta up" }
if ($Health.Json.checks.storage -ne "up") { throw "Storage no esta up" }

$ApiHealth = Invoke-SmokeRequest -Method GET -Uri "$BackendUrl/api/health"
Show-SmokeResult $ApiHealth
Assert-SmokeStatus $ApiHealth 200 "Backend /api/health"
```

## 4. Smoke frontend publico

El frontend publico debe cargar rutas clave sin depender de sesion.

```powershell
$PublicPaths = @("/", "/clinicas", "/profesionales", "/particulares", "/login")

foreach ($Path in $PublicPaths) {
  $PublicSmoke = Invoke-SmokeRequest -Method GET -Uri "$FrontendUrl$Path"
  Show-SmokeResult $PublicSmoke
  Assert-SmokeStatus $PublicSmoke 200 "Frontend publico $Path"
}
```

## 4.1 Smoke manual del formulario de contacto

1. Abrir `$FrontendUrl/contacto`.
2. Enviar un formulario válido (nombre, email, mensaje >= 10 caracteres).
3. Confirmar en `/dashboard/admin` que:
   - `Correo SMTP` está `Configurado`.
   - `Contacto email` está `Configurado`.
   - `CONTACT_TO` figura `Configurado`.
   - `CORS público` muestra el frontend staging activo.
4. Confirmar en UI mensaje de éxito:
   `Mensaje enviado correctamente`.
5. Confirmar que el correo llega a `CONTACT_TO`.
6. Confirmar que el email recibido conserva `replyTo` con el email del
   solicitante.

Si aparece el mensaje:
`Mensaje recibido, pero el envío automático de correo no está configurado...`,
tratarlo como `fail` de readiness de staging (configuración runtime incompleta
o redeploy faltante). Ese estado debe registrarse como `smtp_disabled`.

## 4.2 Smoke público de `OPTIONS/POST /api/contact` (PowerShell)

```powershell
$BackendUrl = "https://portal-vetneb-backend-staging.onrender.com"
$Origin = "https://portal-vetneb-frontend-staging.onrender.com"

$ContactPreflight = Invoke-SmokeRequest `
  -Method OPTIONS `
  -Uri "$BackendUrl/api/contact" `
  -Headers @{
    Origin = $Origin
    "Access-Control-Request-Method" = "POST"
    "Access-Control-Request-Headers" = "content-type"
  }

Show-SmokeResult $ContactPreflight
Assert-SmokeStatus $ContactPreflight 204 "OPTIONS /api/contact"

$ContactPreflightAllowOrigin = $ContactPreflight.Headers["Access-Control-Allow-Origin"]
if (-not $ContactPreflightAllowOrigin) {
  $ContactPreflightAllowOrigin = $ContactPreflight.Headers["access-control-allow-origin"]
}
if (($ContactPreflightAllowOrigin -join ",") -ne $Origin) {
  throw "OPTIONS /api/contact devolvió Access-Control-Allow-Origin distinto al frontend staging"
}

$ContactPayload = @{
  name = "Smoke Render"
  email = "smoke.render@example.com"
  clinicName = "Clinic Smoke"
  message = "Validacion publica de contacto desde PowerShell en Render staging."
}

$ContactPost = Invoke-SmokeRequest `
  -Method POST `
  -Uri "$BackendUrl/api/contact" `
  -Headers @{ Origin = $Origin } `
  -BodyObject $ContactPayload

Show-SmokeResult $ContactPost -IncludeBody

if ($ContactPost.StatusCode -eq 200) {
  "PASS: POST /api/contact respondió 200 y email entregado."
}
elseif ($ContactPost.StatusCode -eq 202) {
  throw "FAIL: POST /api/contact respondió smtp_disabled (runtime SMTP/CONTACT_TO incompleto o redeploy pendiente)."
}
elseif ($ContactPost.StatusCode -eq 502) {
  throw "FAIL: POST /api/contact respondió email_delivery_failed. Revisar logs seguros de backend en Render."
}
else {
  throw "FAIL: POST /api/contact devolvió HTTP $($ContactPost.StatusCode)."
}
```

## 5. Login clinica por API

Usar una cuenta de clinica autorizada para staging o produccion. La password se
lee sin eco en pantalla y no debe guardarse.

```powershell
$ClinicSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$ClinicCredential = Get-Credential -UserName "<clinic-user>" -Message "Credenciales clinic para smoke"

$ClinicLogin = Invoke-SmokeRequest `
  -Method POST `
  -Uri "$BackendUrl/api/auth/login" `
  -WebSession $ClinicSession `
  -Headers @{ Origin = $Origin } `
  -BodyObject @{
    username = $ClinicCredential.UserName
    password = $ClinicCredential.GetNetworkCredential().Password
  }

Show-SmokeResult $ClinicLogin
Assert-SmokeStatus $ClinicLogin 200 "POST /api/auth/login"

$SetCookie = $ClinicLogin.Headers["Set-Cookie"] -join "; "
if (-not $SetCookie) {
  $SetCookie = $ClinicLogin.Headers["set-cookie"] -join "; "
}
if (-not $SetCookie) { throw "Login clinic no devolvio Set-Cookie" }
if ($SetCookie -notmatch "Secure") { throw "Cookie clinic sin Secure" }
if ($SetCookie -notmatch "SameSite=None") { throw "Cookie clinic sin SameSite=None" }
```

Fallback por navegador si el release exige validacion visual:

```powershell
Start-Process "$FrontendUrl/login"
```

En el navegador, iniciar sesion con la misma cuenta de clinica. Revisar en
DevTools > Network que `POST /api/auth/login` responda 200, reciba `Set-Cookie`
con `Secure` y `SameSite=None`, y que las llamadas posteriores usen cookies.

## 6. Validaciones clinic autenticadas

Estos endpoints deben responder con la sesion de clinica recien creada.

```powershell
$Me = Invoke-SmokeRequest -Method GET -Uri "$BackendUrl/api/auth/me" -WebSession $ClinicSession
Show-SmokeResult $Me
Assert-SmokeStatus $Me 200 "GET /api/auth/me"
if ($Me.Json.success -ne $true) { throw "GET /api/auth/me no devolvio success=true" }

$Reports = Invoke-SmokeRequest `
  -Method GET `
  -Uri "$BackendUrl/api/reports?limit=10&offset=0" `
  -WebSession $ClinicSession
Show-SmokeResult $Reports
Assert-SmokeStatus $Reports 200 "GET /api/reports"
if ($Reports.Json.success -ne $true) { throw "GET /api/reports no devolvio success=true" }
if (-not ($Reports.Json.reports -is [array])) { throw "GET /api/reports no devolvio reports[]" }

$Profile = Invoke-SmokeRequest `
  -Method GET `
  -Uri "$BackendUrl/api/clinic/profile" `
  -WebSession $ClinicSession
Show-SmokeResult $Profile
Assert-SmokeStatus $Profile 200 "GET /api/clinic/profile"
if ($Profile.Json.success -ne $true) { throw "GET /api/clinic/profile no devolvio success=true" }

$ParticularTokens = Invoke-SmokeRequest `
  -Method GET `
  -Uri "$BackendUrl/api/particular-tokens?limit=10&offset=0" `
  -WebSession $ClinicSession
Show-SmokeResult $ParticularTokens
Assert-SmokeStatus $ParticularTokens 200 "GET /api/particular-tokens"
if ($ParticularTokens.Json.success -ne $true) { throw "GET /api/particular-tokens no devolvio success=true" }
if (-not ($ParticularTokens.Json.particularTokens -is [array])) {
  throw "GET /api/particular-tokens no devolvio particularTokens[]"
}
```

## 7. Particular/token manual sin exponer token

Pedir a negocio un token particular activo de staging o produccion. No pegarlo
en chat, tickets, capturas ni logs.

Validacion API:

```powershell
$ParticularSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$ParticularTokenSecret = Read-Host "Particular token" -AsSecureString
$ParticularTokenPlain = Convert-SecretToPlainText $ParticularTokenSecret

$ParticularLogin = Invoke-SmokeRequest `
  -Method POST `
  -Uri "$BackendUrl/api/particular/auth/login" `
  -WebSession $ParticularSession `
  -Headers @{ Origin = $Origin } `
  -BodyObject @{ token = $ParticularTokenPlain }
Show-SmokeResult $ParticularLogin
Assert-SmokeStatus $ParticularLogin 200 "POST /api/particular/auth/login"

$ParticularMe = Invoke-SmokeRequest `
  -Method GET `
  -Uri "$BackendUrl/api/particular/auth/me" `
  -WebSession $ParticularSession
Show-SmokeResult $ParticularMe
Assert-SmokeStatus $ParticularMe 200 "GET /api/particular/auth/me"

$ParticularPreview = Invoke-SmokeRequest `
  -Method GET `
  -Uri "$BackendUrl/api/particular/auth/report/preview-url" `
  -WebSession $ParticularSession
Show-SmokeResult $ParticularPreview
Assert-SmokeStatus $ParticularPreview 200 "GET /api/particular/auth/report/preview-url"

$ParticularDownload = Invoke-SmokeRequest `
  -Method GET `
  -Uri "$BackendUrl/api/particular/auth/report/download-url" `
  -WebSession $ParticularSession
Show-SmokeResult $ParticularDownload
Assert-SmokeStatus $ParticularDownload 200 "GET /api/particular/auth/report/download-url"

$ParticularLogout = Invoke-SmokeRequest `
  -Method POST `
  -Uri "$BackendUrl/api/particular/auth/logout" `
  -WebSession $ParticularSession `
  -Headers @{ Origin = $Origin }
Show-SmokeResult $ParticularLogout
Assert-SmokeStatus $ParticularLogout 200 "POST /api/particular/auth/logout"

Remove-Variable ParticularTokenPlain -ErrorAction SilentlyContinue
Remove-Variable ParticularTokenSecret -ErrorAction SilentlyContinue
```

Validacion manual en navegador:

1. Abrir `$FrontendUrl/particulares`.
2. Ingresar el token manualmente, sin capturar pantalla con el valor visible.
3. Confirmar que el informe carga y que preview/download abren el archivo
   esperado.
4. Si se necesita evidencia, limpiar el campo del token antes de capturar.

## 8. CORS y cookies desde navegador

Preflight esperado desde el origen frontend:

```powershell
$Preflight = Invoke-SmokeRequest `
  -Method OPTIONS `
  -Uri "$BackendUrl/api/auth/login" `
  -Headers @{
    Origin = $Origin
    "Access-Control-Request-Method" = "POST"
    "Access-Control-Request-Headers" = "content-type"
  }
Show-SmokeResult $Preflight
Assert-SmokeStatus $Preflight 204 "OPTIONS /api/auth/login"

$AllowOrigin = $Preflight.Headers["Access-Control-Allow-Origin"]
if (-not $AllowOrigin) { $AllowOrigin = $Preflight.Headers["access-control-allow-origin"] }
if (($AllowOrigin -join ",") -ne $Origin) {
  throw "Access-Control-Allow-Origin no coincide con FrontendUrl"
}

$AllowCredentials = $Preflight.Headers["Access-Control-Allow-Credentials"]
if (-not $AllowCredentials) {
  $AllowCredentials = $Preflight.Headers["access-control-allow-credentials"]
}
if (($AllowCredentials -join ",") -ne "true") {
  throw "Access-Control-Allow-Credentials debe ser true"
}

$BadOrigin = Invoke-SmokeRequest `
  -Method POST `
  -Uri "$BackendUrl/api/auth/logout" `
  -Headers @{ Origin = "https://example.invalid" }
Show-SmokeResult $BadOrigin
Assert-SmokeStatus $BadOrigin 403 "Unsafe method con Origin no autorizado"
```

Validacion en DevTools:

1. Abrir `$FrontendUrl/login`.
2. Network: `POST /api/auth/login` debe responder 200.
3. Response headers: `access-control-allow-origin` debe ser exactamente
   `$FrontendUrl`; `access-control-allow-credentials` debe ser `true`.
4. Set-Cookie: debe incluir `Secure`, `SameSite=None`, `HttpOnly` y el nombre
   de cookie clinic esperado.
5. Application > Cookies: la cookie queda disponible para el dominio correcto.
6. Ejecutar en Console, ajustando solo el backend publico:

```javascript
await fetch("https://<backend-staging-or-production>/api/auth/me", {
  credentials: "include",
}).then(async (response) => ({
  status: response.status,
  body: await response.json().catch(() => null),
}))
```

El resultado esperado es `status: 200` mientras la sesion clinic siga activa.

## 9. Avatar y Storage manual

Validar desde el navegador con una imagen JPEG, PNG o WebP de prueba que no
contenga datos sensibles.

1. Iniciar sesion en `$FrontendUrl/login`.
2. Abrir el dashboard de clinica y el bloque de perfil publico.
3. Subir un avatar/logo de prueba.
4. Confirmar que la imagen renderiza despues de recargar la pagina.
5. Ejecutar:

```powershell
$ProfileAfterAvatar = Invoke-SmokeRequest `
  -Method GET `
  -Uri "$BackendUrl/api/clinic/profile" `
  -WebSession $ClinicSession
Show-SmokeResult $ProfileAfterAvatar
Assert-SmokeStatus $ProfileAfterAvatar 200 "GET /api/clinic/profile despues de avatar"

if (-not $ProfileAfterAvatar.Json.profile.avatarStoragePath) {
  throw "El perfil no expone avatarStoragePath despues del upload"
}

if ($ProfileAfterAvatar.Json.profile.avatarStoragePath -notmatch "^clinic-avatars/") {
  throw "avatarStoragePath no usa el prefijo clinic-avatars/"
}

if (-not $ProfileAfterAvatar.Json.profile.avatarUrl) {
  throw "El perfil no devolvio avatarUrl firmada"
}
```

Opcional solo con PowerShell 7+, si se necesita validar multipart por API:

```powershell
$AvatarFile = "C:\path\to\avatar-smoke.webp"
if ($PSVersionTable.PSVersion.Major -ge 7 -and (Test-Path $AvatarFile)) {
  $AvatarUpload = Invoke-WebRequest `
    -UseBasicParsing `
    -Uri "$BackendUrl/api/clinic/profile/avatar" `
    -Method POST `
    -WebSession $ClinicSession `
    -Headers @{ Origin = $Origin } `
    -Form @{ avatar = Get-Item $AvatarFile }

  if ([int]$AvatarUpload.StatusCode -notin @(200, 201)) {
    throw "Avatar upload fallo con HTTP $($AvatarUpload.StatusCode)"
  }
}
```

## 10. Logout clinic

Cerrar la sesion clinic usada por el smoke.

```powershell
$ClinicLogout = Invoke-SmokeRequest `
  -Method POST `
  -Uri "$BackendUrl/api/auth/logout" `
  -WebSession $ClinicSession `
  -Headers @{ Origin = $Origin }
Show-SmokeResult $ClinicLogout
Assert-SmokeStatus $ClinicLogout 200 "POST /api/auth/logout"

$MeAfterLogout = Invoke-SmokeRequest `
  -Method GET `
  -Uri "$BackendUrl/api/auth/me" `
  -WebSession $ClinicSession
Show-SmokeResult $MeAfterLogout
Assert-SmokeStatus $MeAfterLogout 401 "GET /api/auth/me despues de logout"

Remove-Variable ClinicCredential -ErrorAction SilentlyContinue
```

## 11. Criterio pass/fail

Pass:

- `$BackendUrl/health` responde 200 con `checks.database = "up"` y
  `checks.storage = "up"`.
- `$FrontendUrl`, `/clinicas`, `/profesionales`, `/particulares` y `/login`
  responden 200.
- Login clinic responde 200, setea cookie segura y permite `GET /api/auth/me`.
- `GET /api/reports?limit=10&offset=0`,
  `GET /api/clinic/profile` y
  `GET /api/particular-tokens?limit=10&offset=0` responden 200 con
  `success=true`.
- El token particular activo permite login, `me`, preview, download y logout
  sin exponer el token real.
- CORS devuelve el origen frontend exacto, permite credentials y rechaza
  origins no autorizados para metodos unsafe.
- Avatar/storage sube y renderiza una imagen de prueba, con
  `avatarStoragePath` bajo `clinic-avatars/`.

Fail:

- Cualquier paso automatico devuelve status inesperado.
- El navegador no conserva la sesion cross-site.
- Health, DB o Storage quedan en estado distinto de `up`.
- El frontend publico devuelve 4xx/5xx o HTML roto.
- Un endpoint autenticado devuelve 401/403 con credenciales validas.
- Aparece un secreto, token real o signed URL completa en evidencia.

## 12. Rollback trigger

Disparar rollback o no-go si ocurre cualquiera de estos casos:

- `/health` falla, o DB/Storage no estan `up`.
- CORS/cookies impiden login o persistencia de sesion en HTTPS.
- Login clinic, `GET /api/reports`, `GET /api/clinic/profile` o
  `GET /api/particular-tokens?limit=10&offset=0` fallan.
- Particular/token no puede abrir preview/download con un token activo valido.
- Avatar upload, signed URL o render de imagen falla.
- Frontend publico tiene 4xx/5xx, rutas criticas rotas o errores visibles.
- Se detectan 5xx repetidos, errores de auth inesperados o secretos expuestos
  en logs/capturas durante el smoke.
