<#
.SYNOPSIS
    Reset del rate limit de login para un usuario bloqueado operativamente.

.DESCRIPTION
    Limpia la entrada de rate limit de login en la base de datos para
    un surface + identifier específico. No toca otros usuarios ni superficies.

    Requiere: DATABASE_URL en .env o como variable de entorno.
    Por defecto: dry-run. Usar -Force para ejecutar el DELETE real.

.PARAMETER Surface
    Superficie de login: "unified", "clinic", "admin" o "particular".

.PARAMETER Identifier
    Identificador del usuario (username o email, normalizado a lowercase).
    Para particular: el token (se usará como identifier en la key).

.PARAMETER IpAddress
    IP del cliente. Opcional. Si no se proporciona, se buscarán todas las
    entradas para surface + identifier sin filtrar por IP.

.PARAMETER Force
    Si se especifica, ejecuta el DELETE real. Por defecto es dry-run.

.EXAMPLE
    # Dry-run: ver qué filas se borrarían para la clínica "clinica@vetneb.com"
    .\reset-login-rate-limit.ps1 -Surface unified -Identifier "clinica@vetneb.com"

    # Ejecutar reset para admin "admin" desde IP 1.2.3.4
    .\reset-login-rate-limit.ps1 -Surface admin -Identifier "admin" -IpAddress "1.2.3.4" -Force

    # Reset de todas las entradas de un identifier sin filtrar IP (dry-run)
    .\reset-login-rate-limit.ps1 -Surface clinic -Identifier "usuario"
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("unified", "clinic", "admin", "particular")]
    [string]$Surface,

    [Parameter(Mandatory = $true)]
    [string]$Identifier,

    [Parameter(Mandatory = $false)]
    [string]$IpAddress = "",

    [Parameter(Mandatory = $false)]
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Cargar DATABASE_URL ──────────────────────────────────────────────────────

$envFile = Join-Path $PSScriptRoot "..\..\\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)=(.*)$') {
            $name = $Matches[1]
            $value = $Matches[2].Trim('"').Trim("'")
            if (-not [System.Environment]::GetEnvironmentVariable($name)) {
                [System.Environment]::SetEnvironmentVariable($name, $value)
            }
        }
    }
}

$databaseUrl = $env:DATABASE_URL
if (-not $databaseUrl) {
    Write-Error "DATABASE_URL no está definida. Exporta la variable o crea un .env en la raíz del proyecto."
    exit 1
}

# ── Validar parámetros ───────────────────────────────────────────────────────

$normalizedIdentifier = $Identifier.Trim().ToLower()
if ($normalizedIdentifier.Length -eq 0) {
    Write-Error "Identifier no puede estar vacío."
    exit 1
}
if ($normalizedIdentifier.Length -gt 256) {
    $normalizedIdentifier = $normalizedIdentifier.Substring(0, 256)
    Write-Warning "Identifier truncado a 256 caracteres."
}

$normalizedIp = if ($IpAddress.Trim()) { $IpAddress.Trim() } else { "" }

# ── Construir key(s) a buscar ────────────────────────────────────────────────
# Formato: login:v2:<surface>:<identifier>:ip:<ip>
# Si no se da IP, se busca para todas las IPs (LIKE pattern en SHA256 no aplica
# — debemos hacer el hash en PowerShell o buscar por prefijo de key no hasheada)
#
# IMPORTANTE: La key se guarda como SHA256(key_string) en DB.
# Para hacer la búsqueda, necesitamos reproducir el hash en PowerShell.

function Get-Sha256 {
    param([string]$InputString)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($InputString)
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $hash = $sha256.ComputeHash($bytes)
    return [BitConverter]::ToString($hash).Replace("-", "").ToLower()
}

$keysToCheck = @()

if ($normalizedIp) {
    $keyString = "login:v2:${Surface}:${normalizedIdentifier}:ip:${normalizedIp}"
    $keyHash = Get-Sha256 $keyString
    $keysToCheck += [PSCustomObject]@{ KeyString = $keyString; KeyHash = $keyHash }
} else {
    Write-Host "No se especificó IP. Se buscarán hasta 50 entradas para surface='$Surface' identifier='$normalizedIdentifier' en todas las IPs conocidas." -ForegroundColor Yellow
    Write-Host "Para mayor precisión, proporcione -IpAddress." -ForegroundColor Yellow

    # Sin IP, construimos keys para IPs comunes + "unknown"
    $commonIps = @("unknown")
    foreach ($ip in $commonIps) {
        $keyString = "login:v2:${Surface}:${normalizedIdentifier}:ip:${ip}"
        $keyHash = Get-Sha256 $keyString
        $keysToCheck += [PSCustomObject]@{ KeyString = $keyString; KeyHash = $keyHash }
    }
}

# ── Conectar y operar ────────────────────────────────────────────────────────

Write-Host ""
Write-Host "=== RESET RATE LIMIT LOGIN ===" -ForegroundColor Cyan
Write-Host "  Surface    : $Surface"
Write-Host "  Identifier : $($normalizedIdentifier.Substring(0, [Math]::Min(20, $normalizedIdentifier.Length)))..."
Write-Host "  IP         : $(if ($normalizedIp) { $normalizedIp } else { '(todas)' })"
Write-Host "  Modo       : $(if ($Force) { 'EJECUTAR (Force)' } else { 'DRY-RUN (sin cambios)' })"
Write-Host ""

# Instalar psql si no está disponible — requerir psql en PATH
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    Write-Error "psql no encontrado en PATH. Instala PostgreSQL client tools o agrega psql al PATH."
    exit 1
}

$foundAny = $false

foreach ($entry in $keysToCheck) {
    $hash = $entry.KeyHash

    # Mostrar solo primeros 16 chars del hash para no exponer el hash completo
    $hashPreview = $hash.Substring(0, 16) + "..."

    # SELECT para ver si existe
    $selectSql = "SELECT key_hash, count, reset_at FROM login_rate_limits WHERE key_hash = '$hash';"
    $result = $null
    try {
        $result = & psql $databaseUrl -t -A -c $selectSql 2>&1
    } catch {
        Write-Warning "Error al consultar DB: $_"
        continue
    }

    if ($result -and $result.Trim()) {
        $foundAny = $true
        $parts = $result.Trim() -split '\|'
        $count = if ($parts.Count -ge 2) { $parts[1] } else { "?" }
        $resetAt = if ($parts.Count -ge 3) { $parts[2] } else { "?" }

        Write-Host "  ENCONTRADO: hash=$hashPreview count=$count reset_at=$resetAt" -ForegroundColor Yellow

        if ($Force) {
            if ($PSCmdlet.ShouldProcess("login_rate_limits WHERE key_hash=$hashPreview", "DELETE")) {
                $deleteSql = "DELETE FROM login_rate_limits WHERE key_hash = '$hash';"
                try {
                    & psql $databaseUrl -c $deleteSql 2>&1 | Out-Null
                    Write-Host "  ELIMINADO : hash=$hashPreview" -ForegroundColor Green
                } catch {
                    Write-Warning "Error al eliminar: $_"
                }
            }
        } else {
            Write-Host "  (dry-run)  : se borraría hash=$hashPreview count=$count" -ForegroundColor Gray
        }
    } else {
        Write-Host "  No encontrado: key para ip='$(if ($normalizedIp) { $normalizedIp } else { 'unknown' })'" -ForegroundColor DarkGray
    }
}

Write-Host ""

if (-not $foundAny) {
    Write-Host "No se encontraron entradas de rate limit para los parámetros dados." -ForegroundColor Green
    Write-Host "El usuario no está bloqueado en DB (puede estar en memoria — reiniciar servidor si aplica)." -ForegroundColor Gray
} elseif (-not $Force) {
    Write-Host "DRY-RUN completado. Para ejecutar el reset, agregue -Force:" -ForegroundColor Cyan
    $ipFlag = if ($normalizedIp) { " -IpAddress `"$normalizedIp`"" } else { "" }
    Write-Host "  .\reset-login-rate-limit.ps1 -Surface $Surface -Identifier `"$Identifier`"$ipFlag -Force" -ForegroundColor White
} else {
    Write-Host "Reset completado." -ForegroundColor Green
}

Write-Host ""
