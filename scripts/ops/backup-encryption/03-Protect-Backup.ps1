#Requires -Version 7.4
# Crea UNA copia cifrada de un dump en una carpeta vacia. El original solo se lee.
# El resultado queda SIN PUBLICAR hasta que el script 05 lo firme. Sobre un respaldo real requiere R3.
param(
    [Parameter(Mandatory)][string]$Source,
    [Parameter(Mandatory)][ValidatePattern('^[0-9A-Fa-f]{64}$')][string]$ExpectedSha256,
    [Parameter(Mandatory)][string]$SetDir,
    [Parameter(Mandatory)][ValidateSet('synthetic', 'production', IgnoreCase = $false)][string]$DataClass
)
. "$PSScriptRoot\Common.ps1"

try {
    $trust = Get-TrustContext
    $age = Open-TrustedAge $trust 'age.exe'

    $sourceStream = Open-HeldFile $Source
    $name = [IO.Path]::GetFileName((Get-FullPath $Source))
    Assert-Condition ($name.EndsWith('.dump')) 'solo se admiten archivos .dump'

    Assert-OutsideForbiddenRoots $SetDir
    Assert-OutsideTrust $SetDir
    Open-HeldDirectory $SetDir
    Assert-SecretAcl $SetDir
    Assert-Condition (@(Get-ChildItem -LiteralPath $SetDir -Force).Count -eq 0) 'SetDir debe estar vacio'

    $head = [byte[]]::new(5)
    $sourceStream.ReadExactly($head, 0, 5)
    Assert-Condition ([Text.Encoding]::ASCII.GetString($head) -ceq 'PGDMP') 'el origen no es un dump custom de PostgreSQL'
    Assert-Condition ((Get-StreamSha256 $sourceStream) -eq $ExpectedSha256) 'el origen no coincide con el hash del inventario'
    Assert-FreeSpace $SetDir ($sourceStream.Length * 2)

    # age no abre ninguna ruta: recibe el origen desde el handle y los destinatarios desde la politica.
    $cipherName = "$name.age"
    $cipherPath = Join-Path (Get-FullPath $SetDir) $cipherName
    $writer = New-HeldFile $cipherPath
    $arguments = @('--encrypt', '-r', $trust.Policy.recipients.primary, '-r', $trust.Policy.recipients.recovery)
    $result = Invoke-Chain @(New-Stage $age $arguments) $sourceStream $writer
    Assert-ChainOk $result 'cifrado (el parcial se conserva para revision)'
    Assert-Condition ($result.Links[0].Bytes -eq $sourceStream.Length -and $result.Links[0].Sha256 -eq $ExpectedSha256) 'los bytes cifrados no son los del inventario'
    $writer.Flush($true)
    $writer.Dispose()

    $cipher = Open-HeldFile $cipherPath
    Assert-Condition ((Get-StreamSha256 $cipher) -eq $result.Links[1].Sha256) 'el cifrado cambio al cerrarse'
    $header = [byte[]]::new(22)
    $cipher.ReadExactly($header, 0, 22)
    Assert-Condition ([Text.Encoding]::ASCII.GetString($header) -ceq "age-encryption.org/v1`n") 'cabecera inesperada'

    $record = [ordered]@{
        schema       = 2
        state        = 'ENCRYPTED_UNSIGNED'
        setId        = [guid]::NewGuid().ToString('N')
        dataClass    = $DataClass
        sourceName   = $name
        sourceBytes  = $sourceStream.Length
        sourceSha256 = $ExpectedSha256.ToUpperInvariant()
        cipherName   = $cipherName
        cipherBytes  = $cipher.Length
        cipherSha256 = $result.Links[1].Sha256
        recipients   = [ordered]@{ primary = $trust.Policy.recipients.primary; recovery = $trust.Policy.recipients.recovery }
        policyEpoch  = $trust.Policy.epoch
        ageVersion   = $script:AgeVersion
        createdUnix  = Get-UnixNow
    }
    $null = Publish-HeldBytes "$cipherPath.record.json" ([Text.UTF8Encoding]::new($false).GetBytes(($record | ConvertTo-Json)))
    $record
}
finally { Close-HeldHandles }
