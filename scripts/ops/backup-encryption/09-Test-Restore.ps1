#Requires -Version 7.4
# Restaura un conjunto SINTETICO en un cluster PostgreSQL 17.10 nuevo y aislado. "Aceptar" significa renombrar
# la base de cuarentena DENTRO de ese cluster: nunca publica, sustituye ni modifica una base real.
# No usa servicios ni credenciales existentes. El cluster conserva texto plano sintetico.
param(
    [Parameter(Mandatory)][string]$SetDir,
    [Parameter(Mandatory)][ValidatePattern('^[0-9A-Fa-f]{64}$')][string]$ExpectedPlainSha256,
    [Parameter(Mandatory)][string]$IdentityFile,
    [Parameter(Mandatory)][ValidateSet('primary', 'recovery', IgnoreCase = $false)][string]$IdentityRole,
    [Parameter(Mandatory)][string]$LabDir,
    [Parameter(Mandatory)][ValidateRange(20000, 65000)][int]$Port,
    # "esquema.tabla=filas;..." conocidas de antemano.
    [Parameter(Mandatory)][string]$ExpectedRowCounts,
    [Parameter(Mandatory)][string]$EvidenceDir,
    [Parameter(Mandatory)][string]$EvidenceSigningKey,
    [Parameter(Mandatory)][string]$StagingDir
)
. "$PSScriptRoot\Common.ps1"

# -ViaStdin: la sentencia no aparece en los argumentos y el error de psql no se imprime.
function Invoke-LabSql([string]$Database, [string]$Sql, [switch]$ViaStdin) {
    $source = @('-c', $Sql)
    $stdin = $null
    if ($ViaStdin) {
        $source = @('-f', '-')
        $stdin = [IO.MemoryStream]::new([Text.Encoding]::UTF8.GetBytes($Sql), $false)
    }
    $arguments = @('-X', '-w', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', "$Port", '-U', 'vetneb_lab', '-d', $Database, '-A', '-t') + $source
    $output = [IO.MemoryStream]::new()
    $result = Invoke-Chain @(New-Stage $psql $arguments @{ PGPASSWORD = $adminSecret; PGPASSFILE = 'NUL' } -Quiet:$ViaStdin) $stdin $output
    Assert-ChainOk $result 'consulta en el cluster aislado'
    [Text.Encoding]::UTF8.GetString($output.ToArray()).Trim()
}

try {
    $counts = @($ExpectedRowCounts -split ';' | Where-Object { $_ })
    Assert-Condition ($counts.Count -gt 0) 'se exige al menos una validacion de filas'
    foreach ($item in $counts) {
        Assert-Condition ($item -cmatch '^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*=\d+$') "validacion mal formada: $item"
    }

    $trust = Get-TrustContext
    $set = Open-SignedSet $trust $SetDir
    Assert-CipherRecord $set.Record $trust.Policy $ExpectedPlainSha256
    Assert-Condition ($set.Record.dataClass -ceq 'synthetic') 'este ensayo solo admite conjuntos sinteticos'

    $null = Open-HeldFile $IdentityFile
    Assert-SecretAcl $IdentityFile
    $age = Open-TrustedAge $trust 'age.exe'
    $keygen = Open-TrustedAge $trust 'age-keygen.exe'
    $initdb = Open-TrustedPostgres $trust 'initdb.exe'
    $pgCtl = Open-TrustedPostgres $trust 'pg_ctl.exe'
    $psql = Open-TrustedPostgres $trust 'psql.exe'
    $pgRestore = Open-TrustedPostgres $trust 'pg_restore.exe'
    Assert-IdentityRecipient $age $keygen $IdentityFile $trust.Policy.recipients.$IdentityRole
    $decrypt = @('--decrypt', '--identity', (Get-FullPath $IdentityFile))

    # Pasada completa previa, sin salida: nada llega a una base si el conjunto no se descifra entero.
    $set.Cipher.Position = 0
    $first = Invoke-Chain @(New-Stage $age $decrypt) $set.Cipher $null
    Assert-ChainOk $first 'descifrado previo'
    Assert-Condition ($first.Links[0].Sha256 -eq $set.Record.cipherSha256) 'los bytes consumidos no son los autenticados'
    Assert-Condition ($first.Links[1].Bytes -eq $set.Record.sourceBytes -and $first.Links[1].Sha256 -eq $ExpectedPlainSha256) 'el texto plano no coincide con el original'

    Assert-OutsideForbiddenRoots $LabDir
    Assert-OutsideTrust $LabDir
    Open-HeldDirectory $LabDir
    Assert-SecretAcl $LabDir
    Assert-Condition (@(Get-ChildItem -LiteralPath $LabDir -Force).Count -eq 0) 'LabDir debe estar vacio'
    $listeners = [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    Assert-Condition (@($listeners | Where-Object { $_.Port -eq $Port }).Count -eq 0) "el puerto $Port esta en uso"

    $data = Join-Path (Get-FullPath $LabDir) 'data'
    $passwordFile = Join-Path (Get-FullPath $LabDir) 'synthetic-password.txt'
    $adminSecret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
    $restoreSecret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
    $null = Publish-HeldBytes $passwordFile ([Text.Encoding]::ASCII.GetBytes($adminSecret))

    $stopCode = 0
    $accepted = ''
    try {
        $code = Invoke-Tool $initdb @('-D', $data, '--username=vetneb_lab', '--auth=scram-sha-256', "--pwfile=$passwordFile", '--encoding=UTF8', '--no-locale')
        Assert-Condition ($code -eq 0) "initdb fallo (codigo=$code)"
        $log = Join-Path (Get-FullPath $LabDir) 'postgres.log'
        $code = Invoke-Tool $pgCtl @('start', '-D', $data, '-w', '-t', '60', '-l', $log, '-o', "-p $Port -c listen_addresses=127.0.0.1")
        Assert-Condition ($code -eq 0) "pg_ctl start fallo (codigo=$code)"

        # Antes de escribir nada: confirmar que responde la instancia propia y no un servicio existente.
        $reported = (Invoke-LabSql 'postgres' 'SHOW data_directory') -replace '/', '\'
        Assert-Condition ($reported -ieq $data) 'la instancia que responde no es la aislada'

        $suffix = [guid]::NewGuid().ToString('N').Substring(0, 12)
        $quarantine = "quarantine_$suffix"
        # Solo el verificador SCRAM, por stdin y sin registrar la sentencia en el log del cluster.
        $verifier = New-ScramVerifier $restoreSecret
        $createRole = "SET log_statement = 'none';`nSET log_min_error_statement = 'panic';`n" +
        "CREATE ROLE vetneb_restore LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '$verifier';`n"
        $null = Invoke-LabSql 'postgres' $createRole -ViaStdin
        $null = Invoke-LabSql 'postgres' "CREATE DATABASE $quarantine OWNER vetneb_restore"

        $restoreArguments = @('--exit-on-error', '--single-transaction', '--no-owner', '--no-privileges', '-w',
            '-h', '127.0.0.1', '-p', "$Port", '-U', 'vetneb_restore', '-d', $quarantine)
        $set.Cipher.Position = 0
        $second = Invoke-Chain @(
            (New-Stage $age $decrypt),
            (New-Stage $pgRestore $restoreArguments @{ PGPASSWORD = $restoreSecret; PGPASSFILE = 'NUL' } -Quiet)
        ) $set.Cipher $null
        # age emite bloques antes de detectar un truncamiento: --single-transaction no basta para aceptar.
        Assert-ChainOk $second 'restauracion'
        Assert-Condition ($second.Links[0].Sha256 -eq $set.Record.cipherSha256) 'los bytes consumidos no son los autenticados'
        Assert-Condition ($second.Links[1].Bytes -eq $set.Record.sourceBytes -and $second.Links[1].Sha256 -eq $ExpectedPlainSha256) 'los bytes restaurados no son los del original'

        foreach ($item in $counts) {
            $table, $expected = $item -split '=', 2
            $schema, $relation = $table -split '\.', 2
            $actual = Invoke-LabSql $quarantine "SELECT count(*) FROM `"$schema`".`"$relation`""
            Assert-Condition ($actual -ceq $expected) "filas distintas en $table"
        }
        $null = Invoke-LabSql 'postgres' "ALTER DATABASE $quarantine RENAME TO accepted_$suffix"
        $accepted = "accepted_$suffix"
    }
    finally {
        # Solo la instancia propia. Una base que quede en cuarentena es invalida.
        if (Test-Path -LiteralPath (Join-Path $data 'postmaster.pid')) {
            $stopCode = Invoke-Tool $pgCtl @('stop', '-D', $data, '-m', 'fast', '-w', '-t', '60')
        }
    }
    Assert-Condition ($stopCode -eq 0) "no se pudo detener la instancia aislada (codigo=$stopCode)"
    Assert-Condition ([bool]$accepted) 'restauracion no aceptada'

    $evidence = New-EvidenceData $trust $set.Record 'restore' 'restore'
    $evidence['restore'] = 'PASSED'
    $evidence['scope'] = 'ENTORNO_SINTETICO_AISLADO'
    $evidence['validations'] = $counts.Count
    $out = Publish-Evidence $trust $evidence $EvidenceDir $EvidenceSigningKey $StagingDir
    [pscustomobject]@{ evidence = $out; database = $accepted; scope = 'ENTORNO_SINTETICO_AISLADO' }
}
finally { Close-HeldHandles }
