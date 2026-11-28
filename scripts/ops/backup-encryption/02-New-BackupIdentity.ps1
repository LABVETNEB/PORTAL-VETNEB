#Requires -Version 7.4
# Genera material criptografico (R3 si es definitivo). La clave privada no toca el disco en claro.
# Ejecutar en una consola propia, nunca en un terminal visible para un agente ni con transcripcion activa:
# si la passphrase se deja vacia, age genera una y la MUESTRA en pantalla.
param(
    [Parameter(Mandatory)][string]$KeyDir,
    [Parameter(Mandatory)][ValidatePattern('^[a-z0-9-]{3,60}$')][string]$Name
)
. "$PSScriptRoot\Common.ps1"

$secret = [byte[]]::new(16384)
try {
    $trust = Get-TrustContext -ToolsOnly
    $age = Open-TrustedAge $trust 'age.exe'
    $keygen = Open-TrustedAge $trust 'age-keygen.exe'

    Assert-OutsideForbiddenRoots $KeyDir
    Assert-OutsideTrust $KeyDir
    Open-HeldDirectory $KeyDir
    Assert-SecretAcl $KeyDir
    $target = Join-Path (Get-FullPath $KeyDir) "$Name.key.age"
    Assert-Condition (-not (Test-Path -LiteralPath $target)) 'la identidad ya existe; no se sobrescribe'
    Assert-Condition (-not (Test-Path -LiteralPath "$target.record.json")) 'el registro ya existe; no se sobrescribe'

    $sink = [IO.MemoryStream]::new($secret, $true)
    $generated = Invoke-Chain @(New-Stage $keygen @() -Quiet) $null $sink
    Assert-ChainOk $generated 'age-keygen'
    $count = [int]$sink.Position
    Assert-Condition ($count -gt 0) 'salida vacia de age-keygen'

    $public = [IO.MemoryStream]::new()
    $derived = Invoke-Chain @(New-Stage $keygen @('-y') -Quiet) ([IO.MemoryStream]::new($secret, 0, $count, $false)) $public
    Assert-ChainOk $derived 'age-keygen -y'
    $recipient = [Text.Encoding]::ASCII.GetString($public.ToArray()).Trim()
    Assert-Condition ($recipient -cmatch $script:RecipientPattern) 'clave publica inesperada'

    Write-Host 'age pedira la passphrase en la consola. No dejarla vacia.'
    $encrypted = [IO.MemoryStream]::new()
    $sealed = Invoke-Chain @(New-Stage $age @('--passphrase')) ([IO.MemoryStream]::new($secret, 0, $count, $false)) $encrypted
    Assert-ChainOk $sealed 'cifrado de la identidad'
    $bytes = $encrypted.ToArray()
    Assert-Condition ($bytes.Length -gt 22 -and [Text.Encoding]::ASCII.GetString($bytes, 0, 22) -ceq "age-encryption.org/v1`n") 'la identidad no quedo cifrada'

    $null = Publish-HeldBytes $target $bytes
    Assert-SecretAcl $target
    # El registro es la marca de publicacion: sin el, la identidad es un parcial.
    $record = [ordered]@{
        schema         = 1
        name           = $Name
        recipient      = $recipient
        identitySha256 = Get-BytesSha256 $bytes
        createdUnix    = Get-UnixNow
    }
    $null = Publish-HeldBytes "$target.record.json" ([Text.UTF8Encoding]::new($false).GetBytes(($record | ConvertTo-Json)))
    $record
    Write-Host 'NO es valida hasta superar un descifrado de prueba (script 04).'
}
finally {
    [Array]::Clear($secret, 0, $secret.Length)
    Close-HeldHandles
}
