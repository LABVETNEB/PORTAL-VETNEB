#Requires -Version 7.4
# Lectura de metadatos, hash y primeros 11 bytes. No extrae contenido. Probado solo con archivos sinteticos.
# Sobre respaldos reales requiere autorizacion R3. La salida no se publica: incluye rutas y permisos.
param(
    [Parameter(Mandatory)][string]$Root,
    [string]$OutFile
)
. "$PSScriptRoot\Common.ps1"

Assert-Condition (Test-Path -LiteralPath $Root -PathType Container) "no existe $Root"
Assert-LocalPlainPath $Root
if ($OutFile) { Assert-OutsideForbiddenRoots $OutFile }

$files = Get-ChildItem -LiteralPath $Root -Recurse -File -Force |
    Where-Object { $_.Name -match '\.(dump|vnbenc|age|zip|bundle|bak|tar|gz)$' }

$inventory = foreach ($file in $files) {
    $head = [byte[]]::new(11)
    $stream = [IO.File]::Open($file.FullName, 'Open', 'Read', 'Read')
    try { $null = $stream.Read($head, 0, $head.Length) }
    finally { $stream.Dispose() }
    $magic = [Text.Encoding]::ASCII.GetString($head)
    $format = 'NO_IDENTIFICADO'
    if ($file.Length -eq 0) { $format = 'VACIO' }
    if ($magic.StartsWith('PGDMP')) { $format = 'PGDMP_EN_CLARO' }
    if ($magic.StartsWith('VNBENC1')) { $format = 'VNBENC1' }
    if ($magic.StartsWith('age-encrypt')) { $format = 'AGE_V1' }
    [pscustomobject]@{
        Path       = $file.FullName
        Bytes      = $file.Length
        CreatedUtc = $file.CreationTimeUtc.ToString('o')
        Format     = $format
        Sha256     = Get-Sha256Hex $file.FullName
        Acl        = ((Get-Acl -LiteralPath $file.FullName).Access | ForEach-Object { "$($_.IdentityReference):$($_.FileSystemRights)" }) -join '; '
    }
}

$json = ConvertTo-Json -InputObject @($inventory) -Depth 3
if ($OutFile) { Write-NewTextFile $OutFile $json }
$json
