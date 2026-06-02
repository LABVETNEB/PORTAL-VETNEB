<#
.SYNOPSIS
    Reset operativo del rate limit de login para un surface + identifier.

.DESCRIPTION
    Wrapper PowerShell del script Node/TypeScript
    scripts/dev/reset-login-rate-limit.ts. Usa SUPABASE_DB_URL o DATABASE_URL,
    ejecuta en dry-run por defecto y requiere -Force para borrar filas.

    No imprime identifier, token, password, URL de DB ni hashes completos.

.PARAMETER Surface
    Superficie de login: "unified", "clinic", "admin" o "particular".

.PARAMETER Identifier
    Identificador operativo. Para particular puede ser el token recibido por el
    usuario, pero no se imprime en output.

.PARAMETER IpAddress
    IP opcional. Si se omite, borra por surface + identifier_hash en filas con
    metadata segura. Filas legacy previas a la metadata requieren IP exacta.

.PARAMETER Force
    Ejecuta el DELETE. Sin -Force es dry-run.

.EXAMPLE
    .\reset-login-rate-limit.ps1 -Surface unified -Identifier "clinica@vetneb.com"

.EXAMPLE
    .\reset-login-rate-limit.ps1 -Surface admin -Identifier "admin" -IpAddress "1.2.3.4" -Force
#>

[CmdletBinding()]
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

$normalizedIdentifier = $Identifier.Trim()
if ($normalizedIdentifier.Length -eq 0) {
    Write-Error "Identifier no puede estar vacío."
    exit 1
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$scriptPath = Join-Path $repoRoot "scripts\dev\reset-login-rate-limit.ts"

if (-not (Test-Path $scriptPath)) {
    Write-Error "No se encontró scripts/dev/reset-login-rate-limit.ts."
    exit 1
}

$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpm) {
    Write-Error "pnpm no está disponible en PATH. Ejecute el script Node con el runtime del proyecto."
    exit 1
}

$nodeArgs = @(
    "--dir", $repoRoot.Path,
    "exec", "tsx", "scripts/dev/reset-login-rate-limit.ts",
    "--surface", $Surface,
    "--identifier", $normalizedIdentifier
)

$normalizedIp = $IpAddress.Trim()
if ($normalizedIp.Length -gt 0) {
    $nodeArgs += @("--ip-address", $normalizedIp)
}

if ($Force) {
    $nodeArgs += "--force"
}

& $pnpm.Source @nodeArgs
exit $LASTEXITCODE
