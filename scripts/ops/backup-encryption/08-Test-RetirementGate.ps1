#Requires -Version 7.4
# Lee conjuntos y evidencia firmada e informa GO / NO_GO. NUNCA elimina.
# NO_GO termina con error: con pwsh -File el codigo de salida es distinto de cero.
param(
    [Parameter(Mandatory)][string]$Original,
    [Parameter(Mandatory)][ValidatePattern('^[0-9A-Fa-f]{64}$')][string]$ExpectedPlainSha256,
    # Varias rutas separadas por ';' (pwsh -File entrega un unico texto).
    [Parameter(Mandatory)][string]$SetDirs,
    [Parameter(Mandatory)][string]$EvidenceDir
)
. "$PSScriptRoot\Common.ps1"

try {
    $trust = Get-TrustContext
    Assert-Condition ((Get-StreamSha256 (Open-HeldFile $Original)) -eq $ExpectedPlainSha256) 'el original ya no coincide con el inventario'

    $paths = @($SetDirs -split ';' | Where-Object { $_ })
    Assert-Condition ($paths.Count -gt 0) 'no se indicaron conjuntos'
    $records = @()
    $disks = @()
    foreach ($path in $paths) {
        $set = Open-SignedSet $trust $path
        Assert-CipherRecord $set.Record $trust.Policy $ExpectedPlainSha256
        $records += $set.Record
        $disks += Get-DiskNumber $path
    }

    Open-HeldDirectory $EvidenceDir
    Assert-SecretAcl $EvidenceDir
    $accepted = @()
    $rejected = @()
    $now = Get-UnixNow
    foreach ($file in Get-ChildItem -LiteralPath $EvidenceDir -Filter '*.json' -File -Force) {
        # Cualquier error al leer o interpretar una evidencia la descarta.
        try {
            $bytes = Read-HeldBytes (Open-HeldFile $file.FullName)
            $null = Open-HeldFile "$($file.FullName).sig"
            $evidence = [Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
            Assert-Condition (Test-DetachedSignature $trust $bytes "$($file.FullName).sig" $evidence.principal $script:EvidenceNamespace) 'firma de evidencia invalida'
            $reason = Test-EvidenceFields $evidence $trust.Policy $trust.PolicySha256 $records[0] $now
            Assert-Condition (-not $reason) $reason
            $accepted += $evidence
        }
        catch { $rejected += "$($file.Name): $($_.Exception.Message)" }
    }

    $checks = Get-GateChecks $trust.Policy $records @($disks | Sort-Object -Unique).Count $accepted
    $decision = Get-GateDecision $checks
    [pscustomobject]@{
        decision           = $decision
        checks             = $checks
        evidenciaAceptada  = $accepted.Count
        evidenciaRechazada = $rejected
        nota               = 'GO no autoriza borrar: exige autorizacion R3 especifica por archivo.'
    } | ConvertTo-Json -Depth 4
    Assert-Condition ($decision -ceq 'GO') 'NO_GO'
}
finally { Close-HeldHandles }
