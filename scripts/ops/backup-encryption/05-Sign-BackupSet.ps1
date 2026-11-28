#Requires -Version 7.4
# Firma y publica un conjunto cifrado. La passphrase se pide por consola.
# SHA256SUMS.txt.sig se escribe al final: es la marca de publicacion.
param(
    [Parameter(Mandatory)][string]$SetDir,
    [Parameter(Mandatory)][ValidatePattern('^[0-9A-Fa-f]{64}$')][string]$ExpectedPlainSha256,
    [Parameter(Mandatory)][string]$SigningKey,
    [Parameter(Mandatory)][string]$StagingDir
)
. "$PSScriptRoot\Common.ps1"

try {
    $trust = Get-TrustContext
    Assert-OutsideForbiddenRoots $SetDir
    Assert-OutsideTrust $SetDir
    Open-HeldDirectory $SetDir
    Assert-SecretAcl $SetDir
    $directory = Get-FullPath $SetDir
    Assert-Condition (-not (Test-PathInside $SigningKey $directory)) 'la clave de firma no puede vivir en el conjunto'
    Assert-Condition (-not (Test-PathInside $StagingDir $directory)) 'StagingDir no puede estar dentro del conjunto'

    # Lista cerrada: exactamente un cifrado de dump y su registro. Una identidad .key.age queda rechazada.
    $entries = @(Get-ChildItem -LiteralPath $directory -Force | Sort-Object Name)
    $ciphers = @($entries | Where-Object { -not $_.PSIsContainer -and $_.Name.EndsWith('.dump.age') })
    Assert-Condition ($entries.Count -eq 2 -and $ciphers.Count -eq 1) 'el conjunto debe contener solo un .dump.age y su registro'

    # Los handles quedan retenidos hasta despues de publicar: lo firmado es lo verificado.
    $cipher = Open-HeldFile $ciphers[0].FullName
    $recordStream = Open-HeldFile "$($ciphers[0].FullName).record.json"
    $record = [Text.Encoding]::UTF8.GetString((Read-HeldBytes $recordStream)) | ConvertFrom-Json
    Assert-CipherRecord $record $trust.Policy $ExpectedPlainSha256
    Assert-Condition ($record.cipherName -ceq $ciphers[0].Name) 'el registro describe otro cifrado'
    $cipherHash = Get-StreamSha256 $cipher
    Assert-Condition ($cipherHash -eq $record.cipherSha256 -and $cipher.Length -eq $record.cipherBytes) 'el cifrado no coincide con su registro'

    $lines = @(
        "$cipherHash  $($ciphers[0].Name)"
        "$(Get-StreamSha256 $recordStream)  $($ciphers[0].Name).record.json"
    )
    $content = [Text.UTF8Encoding]::new($false).GetBytes(($lines -join "`n") + "`n")
    $signature = New-DetachedSignature $trust $content $SigningKey $script:SignNamespace $trust.Policy.backupSigner $StagingDir

    $sums = Join-Path $directory 'SHA256SUMS.txt'
    $null = Publish-HeldBytes $sums $content
    $null = Publish-HeldBytes "$sums.sig" $signature
    $null = Open-SignedSet $trust $directory
    'SIGNED_AND_VERIFIED'
}
finally { Close-HeldHandles }
