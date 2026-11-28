#Requires -Version 7.4
# Pruebas con age, passphrases y clusteres PostgreSQL sinteticos. Las inicia una persona.
# Con -AutoPassphrase genera una passphrase sintetica en memoria y responde los pedidos de consola;
# usarlo solo en una consola dedicada. Sin el, las respuestas se escriben a mano.
# Requiere autorizacion especifica para instalar age y para iniciar instancias aisladas. No elimina nada.
param(
    [string]$LabRoot,
    # Carpeta con age.exe y age-keygen.exe v1.3.2 ya obtenidos con autorizacion.
    [string]$AgeDir,
    [string]$PostgresDir = 'C:\Program Files\PostgreSQL\17',
    [ValidateRange(20000, 64000)][int]$Port = 55417,
    [switch]$AuthorizedLab,
    [switch]$AutoPassphrase,
    # T07b: carpeta existente en OTRO disco fisico, restringida a operador y SYSTEM. Requiere consola visible.
    [string]$SecondDiskRoot,
    [switch]$AuthorizedSecondDisk,
    [ValidateRange(1, 60)][int]$ReconnectMinutes = 10
)
. "$PSScriptRoot\..\Common.ps1"
. "$PSScriptRoot\TestSupport.ps1"

$cases = [ordered]@{
    T02 = 'Cambio del cifrado o registro durante la firma: bloqueado'
    T04 = 'Sustitucion del origen, su carpeta o la politica durante el cifrado: bloqueada'
    T07 = 'Interrupcion en 02, 03 y 05: sin publicacion ni sobrescritura'
    T07b = 'Copia 06 a otro disco fisico: autenticada, interrumpida y releida tras reconectar'
    T08 = 'Conjunto sano aceptado; alterado, truncado o sobrante sin evidencia'
    T09 = 'Passphrase erronea y fallo de pg_restore: sin evidencia'
    T10 = 'Identidades independientes; rol cruzado o dos claves: rechazo'
    T13 = 'Restauracion sana aceptada y comparada; defectuosa o incompleta no aceptada'
    T16 = 'Fallo de initdb: sin evidencia ni aceptacion'
    T17 = 'Fallo de pg_ctl start: sin evidencia ni aceptacion'
    T18 = 'Fallo de psql en la validacion: sin evidencia ni aceptacion'
    T19 = 'Fallo de almacenamiento al publicar evidencia: nada valido'
    T20 = 'Disco lleno real durante la restauracion'
    T15 = 'Sin texto plano fuera del origen sintetico y los clusteres'
}
if (-not ($AuthorizedLab -and $LabRoot -and $AgeDir -and (Test-Path -LiteralPath (Join-Path $AgeDir 'age.exe')))) {
    foreach ($id in $cases.Keys) { Add-Result $id $cases[$id] 'BLOCKED' 'faltan -AuthorizedLab, -LabRoot o age en -AgeDir' }
    Complete-Run
    return
}

# Proceso hijo unido a la consola para las passphrases. El motivo del rechazo queda en un archivo propio:
# redirigir stderr ocultaria los pedidos interactivos.
function Invoke-Console([string]$Script, [string[]]$Arguments, [string]$Passphrase = $script:LabPassphrase) {
    $marker = Join-Path $lab.staging "reason-$([guid]::NewGuid().ToString('N'))"
    $quoted = @(foreach ($argument in $Arguments) {
            $value = $argument
            if ($argument -cnotmatch '^-[A-Za-z0-9]+$') { $value = "'$($argument.Replace("'", "''"))'" }
            $value
        })
    $path = Join-Path $lab.scripts $Script
    $command = "try { & '$path' $($quoted -join ' ') } catch { [IO.File]::WriteAllText('$marker', `$_.Exception.Message); throw }"
    Set-LabInput $Passphrase
    try { & $script:Pwsh -NoProfile -Command $command | Out-Host }
    finally { Clear-LabInput }
    $code = $LASTEXITCODE
    $reason = ''
    if (Test-Path -LiteralPath $marker) { $reason = [IO.File]::ReadAllText($marker) }
    [pscustomobject]@{ Code = $code; Reason = $reason }
}

# Un codigo distinto de cero no basta: una passphrase mal escrita tambien lo produce.
function Assert-Refused($Run, [string]$Pattern, [string]$What) {
    Assert-Condition ($Run.Code -ne 0) "$What fue aceptado"
    Assert-Condition ($Run.Reason -cmatch $Pattern) "$What rechazado por otro motivo (codigo=$($Run.Code)): $($Run.Reason)"
}

function Assert-Accepted($Run, [string]$What) {
    Assert-Condition ($Run.Code -eq 0) "$What fallo (codigo=$($Run.Code)): $($Run.Reason)"
}

function Invoke-LabQuery([string]$Database, [int]$LabPort, [string]$Password, [string]$Sql) {
    $arguments = @('-X', '-w', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', "$LabPort", '-U', 'vetneb_lab', '-d', $Database, '-A', '-t', '-c', $Sql)
    $output = [IO.MemoryStream]::new()
    $result = Invoke-Chain @(New-Stage "$bin\psql.exe" $arguments @{ PGPASSWORD = $Password; PGPASSFILE = 'NUL' }) $null $output
    Assert-ChainOk $result 'consulta de verificacion'
    [Text.Encoding]::UTF8.GetString($output.ToArray()).Trim()
}

function Assert-PortFree([int]$LabPort) {
    $listeners = [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    Assert-Condition (@($listeners | Where-Object { $_.Port -eq $LabPort }).Count -eq 0) "el puerto $LabPort esta en uso"
}

# Inyecta una accion justo antes de la linea que contiene el ancla, sin ganchos en el codigo probado.
function Invoke-WithBreakpoint([string]$Script, [string]$Anchor, [string]$Action, [hashtable]$Parameters, [string]$BreakIn = $Script) {
    $path = Join-Path $lab.scripts $Script
    $target = Join-Path $lab.scripts $BreakIn
    $hit = @(Select-String -LiteralPath $target -SimpleMatch $Anchor)
    Assert-Condition ($hit.Count -eq 1) "ancla ausente o repetida en ${BreakIn}: $Anchor"
    $marker = Join-Path $lab.staging "marker-$([guid]::NewGuid().ToString('N'))"
    $failure = "$marker-reason"
    $text = ($Parameters.Keys | ForEach-Object { "-$_ '$($Parameters[$_])'" }) -join ' '
    $command = "`$null = Set-PSBreakpoint -Script '$target' -Line $($hit[0].LineNumber) -Action { `$state = 'REACHED'; $Action; [IO.File]::WriteAllText('$marker', `$state) }; " +
    "try { & '$path' $text } catch { [IO.File]::WriteAllText('$failure', `$_.Exception.Message); throw }"
    Set-LabInput
    try { & $script:Pwsh -NoProfile -Command $command | Out-Host }
    finally { Clear-LabInput }
    $code = $LASTEXITCODE
    $state = ''
    if (Test-Path -LiteralPath $marker) { $state = [IO.File]::ReadAllText($marker) }
    $reason = ''
    if (Test-Path -LiteralPath $failure) { $reason = [IO.File]::ReadAllText($failure) }
    [pscustomobject]@{ Code = $code; State = $state; Marker = $marker; Reason = $reason }
}

function Wait-Condition([scriptblock]$Condition, [int]$Minutes, [string]$Failure) {
    $watch = [Diagnostics.Stopwatch]::StartNew()
    while (-not (& $Condition)) {
        Assert-Condition ($watch.Elapsed.TotalMinutes -lt $Minutes) $Failure
        Start-Sleep -Seconds 2
    }
}

function New-RestoreParameters([string]$Name, [string]$Counts = 'lab.items=20000', [string]$Evidence = $lab.evidence) {
    @{
        SetDir = $setDir; ExpectedPlainSha256 = $dumpHash; IdentityFile = $identity; IdentityRole = 'primary'
        LabDir = (New-Folder $lab.Run $Name); Port = ($Port + 1); ExpectedRowCounts = $Counts
        EvidenceDir = $Evidence; EvidenceSigningKey = $keys['lab-restore']; StagingDir = $lab.staging
    }
}

# Todo fallo deja el cluster aislado detenido y el puerto libre.
function Assert-RestoreStopped([hashtable]$Parameters) {
    Assert-Condition (-not (Test-Path -LiteralPath (Join-Path $Parameters.LabDir 'data\postmaster.pid'))) 'quedo un cluster encendido'
    Assert-PortFree ($Port + 1)
}

function Get-WriteAttempt([string]$Path) {
    "try { [IO.File]::WriteAllBytes('$Path', [byte[]](1)); `$state = 'MODIFIED' } catch { `$state = 'BLOCKED' }"
}

function New-Folder([string]$Parent, [string]$Name) {
    $path = Join-Path $Parent $Name
    $null = New-Item -ItemType Directory -Path $path
    $path
}

function Get-EvidenceCount { @(Get-ChildItem -LiteralPath $lab.evidence -File).Count }

$started = [DateTime]::UtcNow
$metrics = @{ restoreSeconds = $null; fingerprintSha256 = ''; truncatedSha256 = '' }
Assert-PortFree $Port
Assert-PortFree ($Port + 1)
if ($AutoPassphrase) { Enable-LabAutoInput }
# Un fallo de preparacion deja su motivo en la corrida: la consola dedicada se cierra al terminar.
trap {
    $current = Get-Variable lab -ValueOnly -ErrorAction Ignore
    if ($current -and -not (Test-Path -LiteralPath (Join-Path $current.Run 'resultados-interactivos.json'))) {
        [IO.File]::WriteAllText((Join-Path $current.Run 'fallo-arnes.txt'), $_.Exception.Message)
    }
    Clear-LabInput
    break
}
$lab = New-Lab $LabRoot
$ageCopy = New-Folder $lab.tools 'age'
foreach ($name in 'age.exe', 'age-keygen.exe') { [IO.File]::Copy((Join-Path $AgeDir $name), (Join-Path $ageCopy $name), $false) }
$tools = @{ age = Get-LabToolEntry $ageCopy @('.'); postgres = Get-LabToolEntry $PostgresDir @('bin', 'lib') }

if ($AutoPassphrase) { Write-Host '== Entrada automatica: NO escribir en esta ventana ==' -ForegroundColor Yellow }
Write-Host '== Claves de firma desechables: passphrase SINTETICA en cada una =='
$keys = @{}
foreach ($principal in 'vetneb-backup', 'lab-primary', 'lab-recovery', 'lab-restore') {
    $keys[$principal] = Join-Path $lab.keys $principal
    New-LabKey $keys[$principal] -Interactive
}
$policy = New-SyntheticPolicy
$policy.productionComputer = [Environment]::MachineName
$policy.evidenceSigners[0].computer = [Environment]::MachineName
$policy.evidenceSigners[2].computer = [Environment]::MachineName
$policy | Add-Member -NotePropertyName tools -NotePropertyValue (ConvertTo-Object $tools)
$null = Install-LabTrust $lab $policy $keys

Write-Host '== Identidades age desechables =='
foreach ($name in 'lab-primary', 'lab-recovery') {
    Assert-Accepted (Invoke-Console '02-New-BackupIdentity.ps1' @('-KeyDir', $lab.keys, '-Name', $name)) "02 para $name"
}
$identity = Join-Path $lab.keys 'lab-primary.key.age'
$policy.recipients.primary = ([IO.File]::ReadAllText("$identity.record.json") | ConvertFrom-Json).recipient
$policy.recipients.recovery = ([IO.File]::ReadAllText((Join-Path $lab.keys 'lab-recovery.key.age.record.json')) | ConvertFrom-Json).recipient
# La politica de laboratorio y su pin se reescriben una vez, antes de crear conjuntos.
$trustLab = Install-LabTrust $lab $policy $keys

# Origen sintetico: cluster descartable, datos inventados, pg_dump -Fc.
$sourceData = Join-Path $lab.source 'cluster'
$dump = Join-Path $lab.source 'lab.dump'
$secret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
$passwordFile = Join-Path $lab.source 'synthetic-password.txt'
[IO.File]::WriteAllText($passwordFile, $secret)
$bin = Join-Path $PostgresDir 'bin'
$environment = @{ PGPASSWORD = $secret; PGPASSFILE = 'NUL' }
$connection = @('-w', '-h', '127.0.0.1', '-p', "$Port", '-U', 'vetneb_lab')
# Esquema, restricciones, indices y contenido completo.
$fingerprintSql = @'
SELECT concat_ws('|',
 (SELECT string_agg(a.attname||' '||format_type(a.atttypid,a.atttypmod)||' '||a.attnotnull, ',' ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid='lab.items'::regclass AND a.attnum>0 AND NOT a.attisdropped),
 (SELECT string_agg(indexdef, ';' ORDER BY indexname) FROM pg_indexes WHERE schemaname='lab'),
 (SELECT string_agg(conname||' '||pg_get_constraintdef(oid), ';' ORDER BY conname) FROM pg_constraint WHERE conrelid='lab.items'::regclass),
 (SELECT count(*)||' '||md5(string_agg(id||':'||payload, ',' ORDER BY id)) FROM lab.items))
'@
Assert-Condition ((Invoke-Tool "$bin\initdb.exe" @('-D', $sourceData, '--username=vetneb_lab', '--auth=scram-sha-256', "--pwfile=$passwordFile", '--no-locale', '--encoding=UTF8')) -eq 0) 'initdb fallo'
try {
    Assert-Condition ((Invoke-Tool "$bin\pg_ctl.exe" @('start', '-D', $sourceData, '-w', '-l', (Join-Path $lab.source 'postgres.log'), '-o', "-p $Port -c listen_addresses=127.0.0.1")) -eq 0) 'pg_ctl start fallo'
    $reported = (Invoke-LabQuery 'postgres' $Port $secret 'SHOW data_directory') -replace '/', '\'
    Assert-Condition ($reported -ieq $sourceData) 'la instancia que responde no es la aislada'
    # 20000 filas: el dump supera un bloque de age (64 KiB) y un truncamiento deja salida parcial.
    $sql = 'CREATE SCHEMA lab; CREATE TABLE lab.items AS SELECT n AS id, md5(n::text) AS payload FROM generate_series(1, 20000) n; ALTER TABLE lab.items ADD PRIMARY KEY (id); CREATE INDEX items_payload_idx ON lab.items (payload)'
    Assert-Condition ((Invoke-Tool "$bin\psql.exe" (@('-X', '-v', 'ON_ERROR_STOP=1') + $connection + @('-d', 'postgres', '-c', $sql)) $environment) -eq 0) 'datos sinteticos fallidos'
    $sourceFingerprint = Invoke-LabQuery 'postgres' $Port $secret $fingerprintSql
    Assert-Condition ((Invoke-Tool "$bin\pg_dump.exe" ($connection + @('-d', 'postgres', '-n', 'lab', '-Fc', '-f', $dump)) $environment) -eq 0) 'pg_dump fallo'
}
finally {
    if (Test-Path -LiteralPath (Join-Path $sourceData 'postmaster.pid')) {
        Assert-Condition ((Invoke-Tool "$bin\pg_ctl.exe" @('stop', '-D', $sourceData, '-m', 'fast', '-w')) -eq 0) 'no se detuvo el cluster de origen'
    }
}
$dumpHash = Get-Sha256Hex $dump
Assert-Condition ((Get-Item -LiteralPath $dump).Length -gt 128KB) 'el dump sintetico no supera dos bloques de age'
$setDir = New-Folder $lab.sets 'set-a'
$protect = @{ Source = $dump; ExpectedSha256 = $dumpHash; SetDir = $setDir; DataClass = 'synthetic' }
$sign = @{ SetDir = $setDir; ExpectedPlainSha256 = $dumpHash; SigningKey = $keys['vetneb-backup']; StagingDir = $lab.staging }

Invoke-Case 'T04' $cases.T04 {
    $policyFile = Join-Path $lab.trust 'trust-policy.json'
    $action = "$(Get-WriteAttempt $dump); try { Rename-Item -LiteralPath '$($lab.source)' -NewName 'movido'; `$state = 'MODIFIED' } catch { }; try { [IO.File]::WriteAllText('$policyFile', '{}'); `$state = 'MODIFIED' } catch { }"
    $run = Invoke-WithBreakpoint '03-Protect-Backup.ps1' '$result = Invoke-Chain' $action $protect
    Assert-Condition ($run.State -ceq 'BLOCKED') "estado de la inyeccion: $($run.State)"
    Assert-Condition ($run.Code -eq 0 -and (Get-Sha256Hex $dump) -eq $dumpHash) "03 codigo=$($run.Code)"
    $record = [IO.File]::ReadAllText((Join-Path $setDir 'lab.dump.age.record.json')) | ConvertFrom-Json
    Assert-Condition ($record.recipients.primary -ceq $policy.recipients.primary -and $record.recipients.recovery -ceq $policy.recipients.recovery) 'destinatarios distintos de la politica'
}

Invoke-Case 'T02' $cases.T02 {
    $cipher = Join-Path $setDir 'lab.dump.age'
    $action = "$(Get-WriteAttempt $cipher); try { [IO.File]::WriteAllText('$cipher.record.json', '{}'); `$state = 'MODIFIED' } catch { }"
    $run = Invoke-WithBreakpoint '05-Sign-BackupSet.ps1' '$signature = New-DetachedSignature' $action $sign
    Assert-Condition ($run.State -ceq 'BLOCKED') "estado de la inyeccion: $($run.State)"
    Assert-Condition ($run.Code -eq 0) "05 codigo=$($run.Code)"
}

Invoke-Case 'T07' $cases.T07 {
    # Marca propia por paso: sin ella un fallo anterior al ancla pasaria por interrupcion.
    function Get-Crash([string]$Step) { "[IO.File]::WriteAllText('$($lab.staging)\crash-$Step', 'x'); Stop-Process -Id `$PID -Force" }
    function Assert-Crashed([string]$Step) { Assert-Condition (Test-Path -LiteralPath (Join-Path $lab.staging "crash-$Step")) "la inyeccion no se alcanzo en $Step" }
    # 02
    $parameters = @{ KeyDir = $lab.keys; Name = 'lab-interrumpida' }
    $run = Invoke-WithBreakpoint '02-New-BackupIdentity.ps1' '$null = Publish-HeldBytes "$target.record.json"' (Get-Crash '02') $parameters
    Assert-Crashed '02'
    Assert-Condition ($run.Code -ne 0 -and -not (Test-Path -LiteralPath (Join-Path $lab.keys 'lab-interrumpida.key.age.record.json'))) '02 publico pese a la interrupcion'
    Assert-Refused (Invoke-Console '02-New-BackupIdentity.ps1' @('-KeyDir', $lab.keys, '-Name', 'lab-interrumpida')) 'la identidad ya existe' 'reintento de 02'
    # 03
    $partial = New-Folder $lab.sets 'set-b'
    $parameters = @{ Source = $dump; ExpectedSha256 = $dumpHash; SetDir = $partial; DataClass = 'synthetic' }
    $run = Invoke-WithBreakpoint '03-Protect-Backup.ps1' '$null = Publish-HeldBytes "$cipherPath.record.json"' (Get-Crash '03') $parameters
    Assert-Crashed '03'
    Assert-Condition ($run.Code -ne 0 -and @(Get-ChildItem -LiteralPath $partial -Filter '*.record.json').Count -eq 0) '03 dejo registro'
    Assert-Refused (Invoke-Console '03-Protect-Backup.ps1' @('-Source', $dump, '-ExpectedSha256', $dumpHash, '-SetDir', $partial, '-DataClass', 'synthetic')) 'SetDir debe estar vacio' 'reintento de 03'
    # 05
    $unsigned = New-Folder $lab.sets 'set-c'
    Assert-Accepted (Invoke-Console '03-Protect-Backup.ps1' @('-Source', $dump, '-ExpectedSha256', $dumpHash, '-SetDir', $unsigned, '-DataClass', 'synthetic')) '03'
    $parameters = @{ SetDir = $unsigned; ExpectedPlainSha256 = $dumpHash; SigningKey = $keys['vetneb-backup']; StagingDir = $lab.staging }
    $run = Invoke-WithBreakpoint '05-Sign-BackupSet.ps1' '$null = Publish-HeldBytes "$sums.sig"' (Get-Crash '05') $parameters
    Assert-Crashed '05'
    Assert-Condition ($run.Code -ne 0 -and -not (Test-Path -LiteralPath (Join-Path $unsigned 'SHA256SUMS.txt.sig'))) '05 publico pese a la interrupcion'
    Assert-Refused (Invoke-Console '05-Sign-BackupSet.ps1' @('-SetDir', $unsigned, '-ExpectedPlainSha256', $dumpHash, '-SigningKey', $keys['vetneb-backup'], '-StagingDir', $lab.staging)) 'el conjunto debe contener solo' 'reintento de 05'
    # 06 se ejercita en T07b, que exige un segundo disco fisico.
}

$blocker = Get-SecondDiskBlocker $SecondDiskRoot $lab.sets ([bool]$AuthorizedSecondDisk)
if ($blocker) { Add-Result 'T07b' $cases.T07b 'BLOCKED' $blocker }
if (-not $blocker) {
    Invoke-Case 'T07b' $cases.T07b {
        $disk = Get-DiskOfPath $SecondDiskRoot
        $destination = New-Folder (Get-FullPath $SecondDiskRoot) (Split-Path $lab.Run -Leaf)
        $names = 'lab.dump.age', 'lab.dump.age.record.json', 'SHA256SUMS.txt', 'SHA256SUMS.txt.sig'
        $expected = @{}
        foreach ($name in $names) { $expected[$name] = Get-Sha256Hex (Join-Path $setDir $name) }
        function Assert-CopyIntact([string]$Folder) {
            foreach ($name in $names) { Assert-Condition ((Get-Sha256Hex (Join-Path $Folder $name)) -eq $expected[$name]) "copia distinta: $name" }
            $null = Open-SignedSet $trustLab $Folder
            Close-HeldHandles
        }
        # Control positivo y reintento sin sobrescritura.
        $copy = Join-Path $destination 'set-a'
        Assert-Accepted (Invoke-Console '06-Copy-BackupSet.ps1' @('-SetDir', $setDir, '-DestinationRoot', $destination)) '06 al segundo disco'
        Assert-CopyIntact $copy
        Assert-Refused (Invoke-Console '06-Copy-BackupSet.ps1' @('-SetDir', $setDir, '-DestinationRoot', $destination)) 'already exists|ya existe' 'la copia repetida'
        Assert-CopyIntact $copy
        # Interrupcion justo antes de publicar la firma.
        $second = New-Folder $lab.sets 'set-t07b'
        Assert-Accepted (Invoke-Console '03-Protect-Backup.ps1' @('-Source', $dump, '-ExpectedSha256', $dumpHash, '-SetDir', $second, '-DataClass', 'synthetic')) '03'
        Assert-Accepted (Invoke-Console '05-Sign-BackupSet.ps1' @('-SetDir', $second, '-ExpectedPlainSha256', $dumpHash, '-SigningKey', $keys['vetneb-backup'], '-StagingDir', $lab.staging)) '05'
        $crash = Join-Path $lab.staging 'crash-06'
        $action = "[IO.File]::WriteAllText('$crash', 'x'); Stop-Process -Id `$PID -Force"
        $run = Invoke-WithBreakpoint '06-Copy-BackupSet.ps1' '$null = Publish-HeldBytes "$sums.sig"' $action @{ SetDir = $second; DestinationRoot = $destination }
        $partial = Join-Path $destination 'set-t07b'
        Assert-Condition ($run.Code -ne 0 -and (Test-Path -LiteralPath $crash)) 'la interrupcion de 06 no se alcanzo'
        Assert-Condition ((Test-Path -LiteralPath (Join-Path $partial 'SHA256SUMS.txt')) -and -not (Test-Path -LiteralPath (Join-Path $partial 'SHA256SUMS.txt.sig'))) '06 publico pese a la interrupcion'
        Assert-Rejected { Open-SignedSet $trustLab $partial } 'SHA256SUMS\.txt\.sig'
        Close-HeldHandles
        Assert-Refused (Invoke-Console '06-Copy-BackupSet.ps1' @('-SetDir', $second, '-DestinationRoot', $destination)) 'already exists|ya existe' 'el reintento sobre un parcial'
        # Relectura tras desconectar y reconectar el medio.
        $mark = Join-Path $copy 'SHA256SUMS.txt.sig'
        Write-Host "== EXPULSAR y desconectar el segundo disco (plazo $ReconnectMinutes min) ==" -ForegroundColor Yellow
        Wait-Condition { -not (Test-Path -LiteralPath $mark) } $ReconnectMinutes 'no se observo la desconexion del disco'
        Write-Host "== Desconexion observada. RECONECTAR con la misma letra y desbloquear (plazo $ReconnectMinutes min) ==" -ForegroundColor Yellow
        Wait-Condition { Test-Path -LiteralPath $mark } $ReconnectMinutes 'no se observo la reconexion del disco'
        $again = Get-DiskOfPath $copy
        Assert-Condition ($again.UniqueId -eq $disk.UniqueId -and $again.SerialNumber -eq $disk.SerialNumber) 'se reconecto otro disco'
        Assert-Condition (-not (Test-IndependentDisk (Get-DiskOfPath $lab.sets) $again)) 'el disco reconectado no es independiente'
        Assert-CopyIntact $copy
        Assert-Rejected { Open-SignedSet $trustLab $partial } 'SHA256SUMS\.txt\.sig'
        Write-NewTextFile (Join-Path $lab.Run 't07b-disco.json') ([ordered]@{ busType = "$($again.BusType)"; diskNumber = $again.Number; sha256 = $expected } | ConvertTo-Json)
    }
}

$verify = @('-SetDir', $setDir, '-ExpectedPlainSha256', $dumpHash, '-EvidenceDir', $lab.evidence,
    '-EvidenceSigningKey', $keys['lab-primary'], '-StagingDir', $lab.staging)

Invoke-Case 'T08' $cases.T08 {
    # Control positivo: sin el, un 04 que siempre falle haria pasar todos los rechazos.
    Write-Host '== Conjunto SANO: identidad primaria (dos veces) y clave lab-primary =='
    $before = Get-EvidenceCount
    Assert-Accepted (Invoke-Console '04-Test-EncryptedBackup.ps1' ($verify + @('-IdentityFile', $identity, '-IdentityRole', 'primary'))) '04 sobre el conjunto sano'
    Assert-Condition ((Get-EvidenceCount) -eq $before + 2) 'falta la evidencia firmada del conjunto sano'
    $mutations = [ordered]@{
        alterado = { param($b) $b[$b.Length - 5] = $b[$b.Length - 5] -bxor 1; , $b }
        truncado = { param($b) , [byte[]]$b[0..($b.Length - 40)] }
        sobrante = { param($b) , [byte[]]($b + [byte[]](1, 2, 3)) }
    }
    foreach ($name in $mutations.Keys) {
        $bad = New-Folder $lab.sets "set-$name"
        $cipher = Join-Path $bad 'lab.dump.age'
        $bytes = & $mutations[$name] ([IO.File]::ReadAllBytes((Join-Path $setDir 'lab.dump.age')))
        [IO.File]::WriteAllBytes($cipher, $bytes)
        # Firma valida sobre contenido malo: debe rechazarlo el descifrado.
        $record = [IO.File]::ReadAllText((Join-Path $setDir 'lab.dump.age.record.json')) | ConvertFrom-Json
        $record.cipherSha256 = Get-Sha256Hex $cipher
        $record.cipherBytes = $bytes.Length
        [IO.File]::WriteAllText("$cipher.record.json", ($record | ConvertTo-Json -Depth 4), $script:Utf8)
        $sums = Join-Path $bad 'SHA256SUMS.txt'
        $lines = "$(Get-Sha256Hex $cipher)  lab.dump.age`n$(Get-Sha256Hex "$cipher.record.json")  lab.dump.age.record.json`n"
        [IO.File]::WriteAllText($sums, $lines, $script:Utf8)
        Write-Host "== Caso ${name}: clave vetneb-backup y luego identidad primaria =="
        Add-LabSignature $sums $keys['vetneb-backup'] 'vetneb-backup'
        $before = Get-EvidenceCount
        $arguments = @('-SetDir', $bad) + $verify[2..($verify.Count - 1)] + @('-IdentityFile', $identity, '-IdentityRole', 'primary')
        Assert-Refused (Invoke-Console '04-Test-EncryptedBackup.ps1' $arguments) 'descifrado y recorrido del archivo fallo \(codigos=-?[1-9]\d*,' "el caso $name"
        Assert-Condition ((Get-EvidenceCount) -eq $before) "hubo evidencia en el caso $name"
    }
}

Invoke-Case 'T09' $cases.T09 {
    Write-Host '== Escribir una passphrase ERRONEA para la identidad =='
    $before = Get-EvidenceCount
    $run = Invoke-Console '04-Test-EncryptedBackup.ps1' ($verify + @('-IdentityFile', $identity, '-IdentityRole', 'primary')) (New-LabPassphrase)
    Assert-Refused $run 'apertura de la identidad fallo' 'la passphrase erronea'
    Assert-Condition ((Get-EvidenceCount) -eq $before) 'hubo evidencia con passphrase erronea'
    # Cifrado y firma validos sobre un dump incompleto: age termina bien y el fallo es de pg_restore.
    Write-Host '== Dump incompleto: passphrase CORRECTA de vetneb-backup y de la identidad primaria (dos veces) =='
    $short = Join-Path (New-Folder $lab.source 'truncado') 'lab.dump'
    $bytes = [IO.File]::ReadAllBytes($dump)
    [IO.File]::WriteAllBytes($short, [byte[]]$bytes[0..([int][Math]::Floor($bytes.Length * 0.6) - 1)])
    $metrics.truncatedSha256 = Get-Sha256Hex $short
    $shortSet = New-Folder $lab.sets 'set-dump-truncado'
    Assert-Accepted (Invoke-Console '03-Protect-Backup.ps1' @('-Source', $short, '-ExpectedSha256', $metrics.truncatedSha256, '-SetDir', $shortSet, '-DataClass', 'synthetic')) '03 del dump incompleto'
    Assert-Accepted (Invoke-Console '05-Sign-BackupSet.ps1' @('-SetDir', $shortSet, '-ExpectedPlainSha256', $metrics.truncatedSha256, '-SigningKey', $keys['vetneb-backup'], '-StagingDir', $lab.staging)) '05 del dump incompleto'
    $run = Invoke-Console '04-Test-EncryptedBackup.ps1' @('-SetDir', $shortSet, '-ExpectedPlainSha256', $metrics.truncatedSha256, '-EvidenceDir', $lab.evidence,
        '-EvidenceSigningKey', $keys['lab-primary'], '-StagingDir', $lab.staging, '-IdentityFile', $identity, '-IdentityRole', 'primary')
    Assert-Refused $run 'descifrado y recorrido del archivo fallo \(codigos=-?\d+,-?[1-9]' 'el fallo de pg_restore'
    Assert-Condition ((Get-EvidenceCount) -eq $before) 'hubo evidencia con pg_restore fallido'
}

Invoke-Case 'T10' $cases.T10 {
    $before = Get-EvidenceCount
    Write-Host '== Identidad primaria declarada como recuperacion =='
    $run = Invoke-Console '04-Test-EncryptedBackup.ps1' ($verify + @('-IdentityFile', $identity, '-IdentityRole', 'recovery'))
    Assert-Refused $run 'no corresponde al destinatario del rol' 'la identidad primaria como recuperacion'
    Assert-Condition ((Get-EvidenceCount) -eq $before) 'la identidad primaria sirvio como recuperacion'
    # La identidad de recuperacion descifra por si sola el mismo cifrado, sin salida a disco.
    Write-Host '== Passphrase de la identidad de RECUPERACION =='
    $source = [IO.File]::OpenRead((Join-Path $setDir 'lab.dump.age'))
    try {
        Set-LabInput
        $alone = Invoke-Chain @(New-Stage (Join-Path $ageCopy 'age.exe') @('--decrypt', '--identity', (Join-Path $lab.keys 'lab-recovery.key.age'))) $source $null
    }
    finally {
        Clear-LabInput
        $source.Dispose()
    }
    Assert-ChainOk $alone 'descifrado con la identidad de recuperacion'
    Assert-Condition ($alone.Links[1].Sha256 -eq $dumpHash) 'la identidad de recuperacion no recupero el original'
    Write-Host '== Identidad doble: passphrase NUEVA (dos veces) y luego la misma una vez =='
    # Archivo con dos claves, generado en memoria y escrito solo cifrado.
    $buffer = [byte[]]::new(16384)
    try {
        $sink = [IO.MemoryStream]::new($buffer, $true)
        foreach ($round in 1, 2) {
            $made = Invoke-Chain @(New-Stage (Join-Path $ageCopy 'age-keygen.exe') @() -Quiet) $null $sink
            Assert-ChainOk $made 'age-keygen'
        }
        $encrypted = [IO.MemoryStream]::new()
        Set-LabInput
        try { $sealed = Invoke-Chain @(New-Stage (Join-Path $ageCopy 'age.exe') @('--passphrase')) ([IO.MemoryStream]::new($buffer, 0, [int]$sink.Position, $false)) $encrypted }
        finally { Clear-LabInput }
        Assert-ChainOk $sealed 'cifrado de la identidad doble'
        $double = Join-Path $lab.keys 'doble.key.age'
        [IO.File]::WriteAllBytes($double, $encrypted.ToArray())
    }
    finally { [Array]::Clear($buffer, 0, $buffer.Length) }
    $run = Invoke-Console '04-Test-EncryptedBackup.ps1' ($verify + @('-IdentityFile', $double, '-IdentityRole', 'primary'))
    Assert-Refused $run 'exactamente una clave' 'el archivo con dos claves'
    Assert-Condition ((Get-EvidenceCount) -eq $before) 'se acepto un archivo con dos claves'
}

Invoke-Case 'T13' $cases.T13 {
    $restore = @('-SetDir', $setDir, '-ExpectedPlainSha256', $dumpHash, '-IdentityFile', $identity, '-IdentityRole', 'primary',
        '-Port', "$($Port + 1)", '-EvidenceDir', $lab.evidence, '-EvidenceSigningKey', $keys['lab-restore'], '-StagingDir', $lab.staging)
    $before = Get-EvidenceCount
    Write-Host '== Validacion de filas erronea: identidad primaria (tres veces) =='
    $bad = $restore + @('-LabDir', (New-Folder $lab.Run 'restore-bad'), '-ExpectedRowCounts', 'lab.items=1')
    Assert-Refused (Invoke-Console '09-Test-Restore.ps1' $bad) 'filas distintas en lab\.items' 'la validacion fallida'
    Assert-Condition ((Get-EvidenceCount) -eq $before) 'hubo evidencia con validacion fallida'

    Write-Host '== Restauracion de un dump incompleto: identidad primaria (tres veces) =='
    $incomplete = @('-SetDir', (Join-Path $lab.sets 'set-dump-truncado'), '-ExpectedPlainSha256', $metrics.truncatedSha256) + $restore[4..($restore.Count - 1)]
    $incomplete += @('-LabDir', (New-Folder $lab.Run 'restore-truncado'), '-ExpectedRowCounts', 'lab.items=20000')
    Assert-Refused (Invoke-Console '09-Test-Restore.ps1' $incomplete) 'restauracion fallo \(codigos=-?\d+,-?[1-9]' 'la restauracion incompleta'
    Assert-Condition ((Get-EvidenceCount) -eq $before) 'hubo evidencia con restauracion incompleta'

    Write-Host '== Restauracion SANA: identidad primaria (tres veces) y clave lab-restore =='
    $restoreDir = New-Folder $lab.Run 'restore-ok'
    $good = $restore + @('-LabDir', $restoreDir, '-ExpectedRowCounts', 'lab.items=20000')
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $run = Invoke-Console '09-Test-Restore.ps1' $good
    $metrics.restoreSeconds = [Math]::Round($watch.Elapsed.TotalSeconds, 1)
    Assert-Accepted $run 'la restauracion sana'
    Assert-Condition ((Get-EvidenceCount) -eq $before + 2) 'falta la evidencia firmada de restauracion'
    $published = @(Get-ChildItem -LiteralPath $lab.evidence -File -Filter 'restore-*.json')
    Assert-Condition ($published.Count -eq 1) 'se esperaba una sola evidencia de restauracion'
    $content = [IO.File]::ReadAllBytes($published[0].FullName)
    Assert-Condition (Test-DetachedSignature $trustLab $content "$($published[0].FullName).sig" 'lab-restore' $script:EvidenceNamespace) 'la evidencia de restauracion no verifica'
    $evidence = [Text.Encoding]::UTF8.GetString($content) | ConvertFrom-Json
    Assert-Condition ($evidence.restore -ceq 'PASSED' -and $evidence.scope -ceq 'ENTORNO_SINTETICO_AISLADO' -and $evidence.plainSha256 -eq $dumpHash) 'contenido de evidencia inesperado'

    # Comparacion funcional: se reinicia solo el cluster aceptado y se vuelve a detener.
    Assert-PortFree ($Port + 1)
    $data = Join-Path $restoreDir 'data'
    $password = [IO.File]::ReadAllText((Join-Path $restoreDir 'synthetic-password.txt'))
    try {
        $code = Invoke-Tool "$bin\pg_ctl.exe" @('start', '-D', $data, '-w', '-t', '60', '-l', (Join-Path $restoreDir 'postgres-verify.log'), '-o', "-p $($Port + 1) -c listen_addresses=127.0.0.1")
        Assert-Condition ($code -eq 0) "pg_ctl start de verificacion fallo (codigo=$code)"
        $reported = (Invoke-LabQuery 'postgres' ($Port + 1) $password 'SHOW data_directory') -replace '/', '\'
        Assert-Condition ($reported -ieq $data) 'la instancia que responde no es la restaurada'
        $database = Invoke-LabQuery 'postgres' ($Port + 1) $password "SELECT string_agg(datname, ',') FROM pg_database WHERE datname ~ '^(accepted|quarantine)_'"
        Assert-Condition ($database -cmatch '^accepted_[0-9a-f]{12}$') "bases inesperadas: $database"
        $restored = Invoke-LabQuery $database ($Port + 1) $password $fingerprintSql
        Assert-Condition ($restored -ceq $sourceFingerprint) 'esquema o datos restaurados distintos del origen'
        $metrics.fingerprintSha256 = Get-BytesSha256 ([Text.Encoding]::UTF8.GetBytes($restored))
    }
    finally {
        if (Test-Path -LiteralPath (Join-Path $data 'postmaster.pid')) {
            Assert-Condition ((Invoke-Tool "$bin\pg_ctl.exe" @('stop', '-D', $data, '-m', 'fast', '-w', '-t', '60')) -eq 0) 'no se detuvo el cluster restaurado'
        }
    }
    # Ningun log de los clusteres restaurados contiene la sentencia ni el verificador del rol.
    foreach ($log in Get-ChildItem -Path (Join-Path $lab.Run 'restore-*\postgres*.log') -File) {
        Assert-Condition ([IO.File]::ReadAllText($log.FullName) -notmatch 'SCRAM-SHA-256\$|PASSWORD ') "credencial en $($log.FullName)"
    }
}

Invoke-Case 'T16' $cases.T16 {
    $before = Get-EvidenceCount
    $parameters = New-RestoreParameters 'restore-t16'
    $action = '$null = New-Item -ItemType Directory -Path $data; [IO.File]::WriteAllText(($data + ''\ocupado''), ''x'')'
    $run = Invoke-WithBreakpoint '09-Test-Restore.ps1' '$code = Invoke-Tool $initdb' $action $parameters
    Assert-Refused $run 'initdb fallo \(codigo=-?[1-9]' 'el fallo de initdb'
    Assert-Condition ($run.State -ceq 'REACHED' -and (Get-EvidenceCount) -eq $before) 'hubo evidencia con initdb fallido'
    Assert-RestoreStopped $parameters
}

Invoke-Case 'T17' $cases.T17 {
    $before = Get-EvidenceCount
    $parameters = New-RestoreParameters 'restore-t17'
    # El puerto se ocupa despues de la comprobacion previa y dentro del propio proceso probado.
    $action = '$global:ocupante = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port); $global:ocupante.Server.ExclusiveAddressUse = $true; $global:ocupante.Start()'
    $run = Invoke-WithBreakpoint '09-Test-Restore.ps1' 'Invoke-Tool $pgCtl @(''start''' $action $parameters
    Assert-Refused $run 'pg_ctl start fallo \(codigo=-?[1-9]' 'el fallo de pg_ctl'
    Assert-Condition ($run.State -ceq 'REACHED' -and (Get-EvidenceCount) -eq $before) 'hubo evidencia con pg_ctl fallido'
    Assert-RestoreStopped $parameters
}

Invoke-Case 'T18' $cases.T18 {
    $before = Get-EvidenceCount
    $parameters = New-RestoreParameters 'restore-t18' 'lab.ausente=1'
    $arguments = @(foreach ($key in $parameters.Keys) { "-$key"; "$($parameters[$key])" })
    Assert-Refused (Invoke-Console '09-Test-Restore.ps1' $arguments) 'consulta en el cluster aislado fallo' 'el fallo de psql'
    Assert-Condition ((Get-EvidenceCount) -eq $before) 'hubo evidencia con psql fallido'
    Assert-RestoreStopped $parameters
}

Invoke-Case 'T19' $cases.T19 {
    $gate = @('-File', (Join-Path $lab.scripts '08-Test-RetirementGate.ps1'), '-Original', $dump, '-ExpectedPlainSha256', $dumpHash, '-SetDirs', $setDir, '-EvidenceDir')
    # a) El volumen rechaza la escritura de la evidencia despues de una restauracion correcta.
    $denied = New-Folder $lab.Run 'evidence-t19-denegada'
    $parameters = New-RestoreParameters 'restore-t19a' 'lab.items=20000' $denied
    $action = '$carpeta = [IO.DirectoryInfo]::new($EvidenceDir); $permisos = [IO.FileSystemAclExtensions]::GetAccessControl($carpeta, ''Access''); ' +
    '$permisos.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.WindowsIdentity]::GetCurrent().User, ''CreateFiles'', ''Deny'')); ' +
    '[IO.FileSystemAclExtensions]::SetAccessControl($carpeta, $permisos)'
    try {
        $run = Invoke-WithBreakpoint '09-Test-Restore.ps1' '$out = Publish-Evidence' $action $parameters
        Assert-Refused $run 'CreateFileW 5' 'la escritura denegada'
        Assert-Condition ($run.State -ceq 'REACHED' -and @(Get-ChildItem -LiteralPath $denied -File).Count -eq 0) 'quedo evidencia pese a la denegacion'
    }
    finally {
        $folder = [IO.DirectoryInfo]::new($denied)
        $permissions = [IO.FileSystemAclExtensions]::GetAccessControl($folder, [Security.AccessControl.AccessControlSections]::Access)
        $rule = [Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.WindowsIdentity]::GetCurrent().User, 'CreateFiles', 'Deny')
        $null = $permissions.RemoveAccessRule($rule)
        [IO.FileSystemAclExtensions]::SetAccessControl($folder, $permissions)
    }
    Assert-RestoreStopped $parameters
    # b) Corte entre la evidencia y su firma: la puerta no la cuenta.
    $partial = New-Folder $lab.Run 'evidence-t19-parcial'
    $parameters = New-RestoreParameters 'restore-t19b' 'lab.items=20000' $partial
    $crash = Join-Path $lab.staging 'crash-evidencia'
    $action = "[IO.File]::WriteAllText('$crash', 'x'); Stop-Process -Id `$PID -Force"
    $run = Invoke-WithBreakpoint '09-Test-Restore.ps1' '$null = Publish-HeldBytes "$out.sig" $signature' $action $parameters 'Common.ps1'
    Assert-Condition ($run.Code -ne 0 -and (Test-Path -LiteralPath $crash)) 'el corte de publicacion no se alcanzo'
    Assert-Condition (@(Get-ChildItem -LiteralPath $partial -Filter '*.json').Count -eq 1 -and @(Get-ChildItem -LiteralPath $partial -Filter '*.sig').Count -eq 0) 'estado parcial inesperado'
    Assert-RestoreStopped $parameters
    $child = Invoke-Child ($gate + $partial)
    Assert-ChildRejected $child 'NO_GO'
    Assert-Condition ($child.Output -match '"evidenciaAceptada": 0\b') "la puerta acepto una evidencia sin firma: $($child.Output)"
    # Control: la evidencia completa de la corrida si se acepta, y aun asi la puerta responde NO_GO.
    $child = Invoke-Child ($gate + $lab.evidence)
    Assert-ChildRejected $child 'NO_GO'
    Assert-Condition ($child.Output -match '"evidenciaAceptada": [1-9]') "control sin evidencia aceptada: $($child.Output)"
}

Add-Result 'T20' $cases.T20 'BLOCKED' 'requiere un volumen dedicado pequeno y autorizacion especifica; no se simula'

Invoke-Case 'T15' $cases.T15 {
    # Todo el laboratorio de la corrida salvo origen sintetico, clusteres, scripts y binarios.
    $excluded = @($lab.source, $lab.scripts, $lab.tools) + @(Get-ChildItem -LiteralPath $lab.Run -Directory -Filter 'restore-*' | ForEach-Object FullName)
    $scanned = 0
    foreach ($file in Get-ChildItem -LiteralPath $lab.Run -Recurse -File -Force) {
        if (@($excluded | Where-Object { Test-PathInside $file.FullName $_ }).Count) { continue }
        $text = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($file.FullName))
        Assert-Condition (-not $text.StartsWith('PGDMP') -and $text -notmatch 'AGE-SECRET-KEY-') "texto plano en $($file.FullName)"
        $scanned++
    }
    Assert-Condition ($scanned -gt 0) 'no se examino ningun archivo'
    # La passphrase automatica no puede estar en ningun archivo de la corrida, tampoco en logs de PostgreSQL.
    if ($script:LabPassphrase) {
        foreach ($file in Get-ChildItem -LiteralPath $lab.Run -Recurse -File -Force) {
            $stream = [IO.FileStream]::new($file.FullName, 'Open', 'Read', 'ReadWrite')
            try {
                $copy = [IO.MemoryStream]::new()
                $stream.CopyTo($copy)
            }
            finally { $stream.Dispose() }
            foreach ($encoding in [Text.Encoding]::ASCII, [Text.Encoding]::Unicode) {
                Assert-Condition (-not $encoding.GetString($copy.ToArray()).Contains($script:LabPassphrase)) "passphrase en $($file.FullName)"
            }
        }
    }
}

$summary = [ordered]@{
    schema            = 1
    run               = $lab.Run
    startedUtc        = $started.ToString('o')
    finishedUtc       = [DateTime]::UtcNow.ToString('o')
    durationSeconds   = [Math]::Round(([DateTime]::UtcNow - $started).TotalSeconds, 1)
    # En modo manual incluye la escritura de passphrases por la persona.
    passphraseMode    = $(if ($AutoPassphrase) { 'automatica' }; if (-not $AutoPassphrase) { 'manual' })
    restoreSeconds    = $metrics.restoreSeconds
    dumpSha256        = $dumpHash
    dumpBytes         = (Get-Item -LiteralPath $dump).Length
    fingerprintSha256 = $metrics.fingerprintSha256
    results           = @($script:Results)
}
Write-NewTextFile (Join-Path $lab.Run 'resultados-interactivos.json') ($summary | ConvertTo-Json -Depth 6)
Write-RunRecord $lab.Run 'interactiva'
Write-Host "Laboratorio conservado: $($lab.Run)"
try { Complete-Run }
finally {
    # Con la ventana oculta es el unico registro de la salida. El buffer no guarda lo que haya desbordado.
    Save-ConsoleLog (Join-Path $lab.Run 'consola-interactiva.log')
}
