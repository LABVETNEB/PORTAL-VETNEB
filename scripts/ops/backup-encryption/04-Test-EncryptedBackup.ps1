#Requires -Version 7.4
# Abre un conjunto publicado, prueba la identidad del rol, descifra sin escribir texto plano, recorre el archivo
# con pg_restore hacia NUL (sin base de datos) y firma la evidencia. Sobre un respaldo real requiere R3.
param(
    [Parameter(Mandatory)][string]$SetDir,
    [Parameter(Mandatory)][ValidatePattern('^[0-9A-Fa-f]{64}$')][string]$ExpectedPlainSha256,
    [Parameter(Mandatory)][string]$IdentityFile,
    [Parameter(Mandatory)][ValidateSet('primary', 'recovery', IgnoreCase = $false)][string]$IdentityRole,
    [Parameter(Mandatory)][string]$EvidenceDir,
    [Parameter(Mandatory)][string]$EvidenceSigningKey,
    [Parameter(Mandatory)][string]$StagingDir
)
. "$PSScriptRoot\Common.ps1"

try {
    $trust = Get-TrustContext
    $set = Open-SignedSet $trust $SetDir
    Assert-CipherRecord $set.Record $trust.Policy $ExpectedPlainSha256

    $null = Open-HeldFile $IdentityFile
    Assert-SecretAcl $IdentityFile
    Assert-Condition (-not (Test-PathInside $IdentityFile $set.Directory)) 'la identidad no puede convivir con el cifrado'
    Assert-Condition (-not (Test-PathInside $EvidenceDir $set.Directory)) 'la evidencia no puede escribirse dentro del conjunto'

    $age = Open-TrustedAge $trust 'age.exe'
    $keygen = Open-TrustedAge $trust 'age-keygen.exe'
    $pgRestore = Open-TrustedPostgres $trust 'pg_restore.exe'
    $recipient = $trust.Policy.recipients.$IdentityRole
    Assert-IdentityRecipient $age $keygen $IdentityFile $recipient

    # Una sola pasada: se hashean exactamente los bytes autenticados que recibe pg_restore.
    $set.Cipher.Position = 0
    $result = Invoke-Chain @(
        (New-Stage $age @('--decrypt', '--identity', (Get-FullPath $IdentityFile))),
        (New-Stage $pgRestore @('--exit-on-error', '--file=NUL') -Quiet)
    ) $set.Cipher $null
    Assert-ChainOk $result 'descifrado y recorrido del archivo'
    Assert-Condition ($result.Links[0].Sha256 -eq $set.Record.cipherSha256) 'los bytes consumidos no son los autenticados'
    Assert-Condition ($result.Links[1].Bytes -eq $set.Record.sourceBytes) 'tamano descifrado distinto'
    Assert-Condition ($result.Links[1].Sha256 -eq $ExpectedPlainSha256) 'hash descifrado distinto del original'

    $data = New-EvidenceData $trust $set.Record 'decrypt' $IdentityRole
    $data['recipient'] = $recipient
    $data['decrypt'] = 'PASSED'
    $data['archiveCheck'] = 'PASSED'
    $out = Publish-Evidence $trust $data $EvidenceDir $EvidenceSigningKey $StagingDir
    [pscustomobject]@{ evidence = $out; setId = $set.Record.setId; role = $IdentityRole }
}
finally { Close-HeldHandles }
