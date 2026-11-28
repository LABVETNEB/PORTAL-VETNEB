#Requires -Version 7.4
# Pruebas automaticas. Sin -LabRoot no crean ni modifican archivos: solo casos en memoria y lecturas.
# Con -LabRoot (laboratorio autorizado) agregan los casos sin age ni passphrase.
param([string]$LabRoot)
. "$PSScriptRoot\..\Common.ps1"
. "$PSScriptRoot\TestSupport.ps1"

$common = Join-Path $script:ScriptsDir 'Common.ps1'

Invoke-Case 'S01' 'Parseo de todos los scripts, sin else ni exit' {
    foreach ($file in Get-ChildItem -LiteralPath $script:ScriptsDir -Recurse -File -Filter '*.ps1') {
        $tokens = $null
        $errors = $null
        $null = [Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$tokens, [ref]$errors)
        Assert-Condition ($errors.Count -eq 0) "errores de parseo en $($file.Name): $($errors -join '; ')"
        Assert-Condition (@($tokens | Where-Object { $_.Kind -in 'Else', 'Exit' }).Count -eq 0) "else o exit en $($file.Name)"
    }
}

Invoke-Case 'S02' 'Scripts 01 y 07 solo usan funciones vigentes de Common' {
    foreach ($name in '01-Get-BackupInventory.ps1', '07-Test-Vnbenc.ps1') {
        $ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $script:ScriptsDir $name), [ref]$null, [ref]$null)
        $commands = $ast.FindAll({ param($node) $node -is [Management.Automation.Language.CommandAst] }, $true)
        foreach ($command in $commands) {
            $called = $command.GetCommandName()
            if ($called -and $called -ne '.' -and -not $called.EndsWith('Common.ps1')) {
                Assert-Condition ([bool](Get-Command $called -ErrorAction SilentlyContinue)) "$name usa un comando ausente: $called"
            }
        }
    }
}

Invoke-Case 'T01a' 'Pin de politica vacio o parcial: rechazo' {
    Assert-Rejected { Get-TrustContext } 'pin de la politica'
    $script:TrustPolicySha256 = 'ABC123'
    try { Assert-Rejected { Get-TrustContext } 'pin de la politica' }
    finally { $script:TrustPolicySha256 = '' }
}

Invoke-Case 'T03a' 'El handle retenido impide abrir para escritura' {
    $held = Open-HeldFile $common
    Assert-Condition ((Get-StreamSha256 $held) -eq (Get-Sha256Hex $common)) 'hash por handle distinto'
    $opened = $null
    try { $opened = [IO.File]::Open($common, 'Open', 'Write', 'ReadWrite') }
    catch [IO.IOException] { $opened = $null }
    if ($opened) {
        $opened.Dispose()
        throw 'se pudo abrir para escritura un archivo retenido'
    }
}

Invoke-Case 'T05a' 'ACL administrativa y de secreto; firma del binario del sistema' {
    $null = Open-SshKeygen
    Assert-Rejected { Assert-SecretAcl $script:SshKeygen } 'ACL no restringida|propietario'
    Assert-Rejected { Assert-AdminAcl $common } 'ACL no restringida|propietario'
}

Invoke-Case 'T05c' 'Clave de firma sin cifrado detectada por cabecera' {
    foreach ($cipher in 'none', 'aes256-ctr') {
        $data = [byte[]]::new(48)
        [Text.Encoding]::ASCII.GetBytes('openssh-key-v1').CopyTo($data, 0)
        $data[18] = $cipher.Length
        [Text.Encoding]::ASCII.GetBytes($cipher).CopyTo($data, 19)
        # Cabecera fabricada: no contiene material de clave.
        $head = [Text.Encoding]::ASCII.GetBytes("-----BEGIN OPENSSH PRIVATE $('KEY')-----`n$([Convert]::ToBase64String($data))")
        Assert-Condition ((Get-SshKeyCipher $head) -ceq $cipher) "cifrado mal leido: $cipher"
    }
}

Invoke-Case 'T06' 'Politica: solo X25519 nativo, dos destinatarios y roles independientes' {
    Assert-PolicyRoles (New-SyntheticPolicy) @(New-SyntheticSignerLines)
    $mutations = @{
        'solo X25519'        = { param($p) $p.recipients.primary = 'age1yubikey1' + ('q' * 50) }
        'X25519 nativo'      = { param($p) $p.recipients.primary = 'age1pq1' + ('q' * 55) }
        'deben ser distintos' = { param($p) $p.recipients.recovery = $p.recipients.primary }
        'exactamente dos'    = { param($p) $p.recipients | Add-Member -NotePropertyName tercero -NotePropertyValue (New-FakeRecipient 's') }
        'otro equipo'        = { param($p) $p.evidenceSigners[1].computer = 'LAB-PRODUCTION' }
        'principal repetido' = { param($p) $p.evidenceSigners[1].principal = 'lab-primary' }
    }
    foreach ($pattern in $mutations.Keys) {
        $policy = New-SyntheticPolicy
        & $mutations[$pattern] $policy
        Assert-Rejected { Assert-PolicyRoles $policy @(New-SyntheticSignerLines) } $pattern
    }
    $shared = @(New-SyntheticSignerLines) -replace 'AAAASYNTHETIC3', 'AAAASYNTHETIC2'
    Assert-Rejected { Assert-PolicyRoles (New-SyntheticPolicy) $shared } 'misma clave'
    $namespace = @(New-SyntheticSignerLines) -replace 'vetneb-evidence', 'vetneb-backup'
    Assert-Rejected { Assert-PolicyRoles (New-SyntheticPolicy) $namespace } 'namespace'
}

Invoke-Case 'T09a' 'Todo codigo de salida y toda tuberia rota se propagan' {
    $findstr = Join-Path ([Environment]::SystemDirectory) 'findstr.exe'
    $bytes = [Text.Encoding]::ASCII.GetBytes("dato-sintetico`r`n")
    $ok = Invoke-Chain @((New-Stage $findstr @('dato')), (New-Stage $findstr @('dato'))) ([IO.MemoryStream]::new($bytes)) ([IO.MemoryStream]::new())
    Assert-ChainOk $ok 'cadena sana'
    Assert-Condition ($ok.Links[0].Sha256 -eq (Get-BytesSha256 $bytes)) 'hash de entrada distinto'
    $sort = Join-Path ([Environment]::SystemDirectory) 'sort.exe'
    $producer = Invoke-Chain @((New-Stage $findstr @('ausente')), (New-Stage $sort @())) ([IO.MemoryStream]::new($bytes)) $null
    Assert-Condition ($producer.ExitCodes[0] -ne 0 -and $producer.ExitCodes[1] -eq 0) "codigos inesperados: $($producer.ExitCodes -join ',')"
    Assert-Rejected { Assert-ChainOk $producer 'productor' } 'productor fallo'
    $consumer = Invoke-Chain @((New-Stage $findstr @('dato')), (New-Stage $findstr @('ausente'))) ([IO.MemoryStream]::new($bytes)) $null
    Assert-Rejected { Assert-ChainOk $consumer 'consumidor' } 'consumidor fallo'
    $large = [byte[]]::new(8MB)
    $early = Invoke-Chain @(New-Stage $findstr @('x', 'Z:\ruta-inexistente\nada') -Quiet) ([IO.MemoryStream]::new($large)) $null
    Assert-Rejected { Assert-ChainOk $early 'consumidor temprano' } 'consumidor temprano fallo'
}

Invoke-Case 'T11a' 'Evidencia vieja, ajena o de otro equipo, conjunto o politica: rechazo' {
    $policy = New-SyntheticPolicy
    $record = New-SyntheticRecord $policy
    $now = 2000000
    $valid = New-SyntheticEvidence $record 'decrypt' 'primary' 'LAB-PRODUCTION' ($now - 60)
    Assert-Condition ((Test-EvidenceFields $valid $policy ('C' * 64) $record $now) -eq '') 'se rechazo una evidencia valida'
    $mutations = @{
        'otro conjunto'      = { param($e) $e.setId = 'b' * 32 }
        'otro cifrado'       = { param($e) $e.cipherSha256 = 'D' * 64 }
        'otro origen'        = { param($e) $e.plainSha256 = 'D' * 64 }
        'equipo distinto'    = { param($e) $e.computer = 'OTRO' }
        'rol distinto'       = { param($e) $e.role = 'recovery' }
        'firmante no'        = { param($e) $e.principal = 'intruso' }
        'otra politica'      = { param($e) $e.policyEpoch = 2 }
        'evidencia vencida'  = { param($e) $e.createdUnix = 1000001 }
        'fecha futura'       = { param($e) $e.createdUnix = 2001000 }
        'anterior al'        = { param($e) $e.createdUnix = 1 }
        'destinatario'       = { param($e) $e.recipient = 'otro' }
        'no superado'        = { param($e) $e.archiveCheck = 'NOT_RUN' }
    }
    foreach ($pattern in $mutations.Keys) {
        $evidence = New-SyntheticEvidence $record 'decrypt' 'primary' 'LAB-PRODUCTION' ($now - 60)
        & $mutations[$pattern] $evidence
        $reason = Test-EvidenceFields $evidence $policy ('C' * 64) $record $now
        Assert-Condition ($reason -match $pattern) "esperado '$pattern', obtenido '$reason'"
    }
}

Invoke-Case 'T11b' 'GO solo con todas las condiciones' {
    $policy = New-SyntheticPolicy
    $record = New-SyntheticRecord $policy
    $evidence = @(
        New-SyntheticEvidence $record 'decrypt' 'primary' 'LAB-PRODUCTION' 1999000
        New-SyntheticEvidence $record 'decrypt' 'recovery' 'LAB-RECOVERY' 1999000
        New-SyntheticEvidence $record 'restore' 'restore' 'LAB-RESTORE' 1999000
    )
    $records = @($record, $record, $record)
    Assert-Condition ((Get-GateDecision (Get-GateChecks $policy $records 3 $evidence)) -ceq 'GO') 'caso completo sin GO'
    for ($skip = 0; $skip -lt 3; $skip++) {
        $partial = @(0..2 | Where-Object { $_ -ne $skip } | ForEach-Object { $evidence[$_] })
        Assert-Condition ((Get-GateDecision (Get-GateChecks $policy $records 3 $partial)) -ceq 'NO_GO') "GO sin la evidencia $skip"
    }
    Assert-Condition ((Get-GateDecision (Get-GateChecks $policy $records 3 @())) -ceq 'NO_GO') 'GO sin evidencia'
    Assert-Condition ((Get-GateDecision (Get-GateChecks $policy $records 2 $evidence)) -ceq 'NO_GO') 'GO con dos discos'
    Assert-Condition ((Get-GateDecision (Get-GateChecks $policy @($record, $record) 3 $evidence)) -ceq 'NO_GO') 'GO con dos copias'
    $pending = New-SyntheticPolicy
    $pending.evidenceMaxAge.status = 'PENDING_APPROVAL'
    Assert-Condition ((Get-GateDecision (Get-GateChecks $pending $records 3 $evidence)) -ceq 'NO_GO') 'GO con vigencia sin aprobar'
    $custody = New-SyntheticPolicy
    $custody.custodians.recovery = $custody.custodians.primary
    Assert-Condition ((Get-GateDecision (Get-GateChecks $custody $records 3 $evidence)) -ceq 'NO_GO') 'GO con un solo custodio'
    Assert-Condition ((Get-GateDecision ([ordered]@{})) -ceq 'NO_GO') 'GO sin comprobaciones'
}

Invoke-Case 'T12a' 'Un NO_GO produce codigo de salida distinto de cero' {
    $command = ". '$common'; `$d = Get-GateDecision ([ordered]@{ prueba = `$false }); Assert-Condition (`$d -ceq 'GO') 'NO_GO'"
    Assert-ChildRejected (Invoke-Child @('-Command', $command)) 'NO_GO'
}

Invoke-Case 'S03' 'Cada interrupcion del arnes interactivo tiene un ancla unica' {
    $harness = Join-Path $PSScriptRoot 'Invoke-InteractiveTests.ps1'
    $ast = [Management.Automation.Language.Parser]::ParseFile($harness, [ref]$null, [ref]$null)
    $calls = @($ast.FindAll({ param($node) $node -is [Management.Automation.Language.CommandAst] -and $node.GetCommandName() -eq 'Invoke-WithBreakpoint' }, $true))
    Assert-Condition ($calls.Count -ge 8) "interrupciones halladas: $($calls.Count)"
    foreach ($call in $calls) {
        $values = @($call.CommandElements | Select-Object -Skip 1)
        $target = $values[0].Value
        if ($values.Count -ge 5) { $target = $values[4].Value }
        $hits = @(Select-String -LiteralPath (Join-Path $script:ScriptsDir $target) -SimpleMatch $values[1].Value)
        Assert-Condition ($hits.Count -eq 1) "ancla no unica en ${target}: $($values[1].Value) ($($hits.Count))"
    }
}

Invoke-Case 'R03' 'La contrasena del rol de restauracion no viaja en argumentos ni en claro' {
    # Vector del RFC 7677: la prueba del cliente y la firma del servidor validan StoredKey y ServerKey.
    $verifier = New-ScramVerifier 'pencil' ([Convert]::FromBase64String('W22ZaJ0SNY7soEsUEjb6gQ==')) 4096
    Assert-Condition ($verifier -cmatch '^SCRAM-SHA-256\$4096:W22ZaJ0SNY7soEsUEjb6gQ==\$([A-Za-z0-9+/=]{44}):([A-Za-z0-9+/=]{44})$') 'formato de verificador'
    $stored = [Convert]::FromBase64String($Matches[1])
    $server = [Convert]::FromBase64String($Matches[2])
    $nonce = 'rOprNGfwEbeRWgbNEkqO%hvYDpWUa2RaTCAfuxFIlj)hNlF$k0'
    $message = [Text.Encoding]::ASCII.GetBytes("n=user,r=rOprNGfwEbeRWgbNEkqO,r=$nonce,s=W22ZaJ0SNY7soEsUEjb6gQ==,i=4096,c=biws,r=$nonce")
    $signature = [Convert]::ToBase64String([Security.Cryptography.HMACSHA256]::HashData($server, $message))
    Assert-Condition ($signature -ceq '6rriTRBi23WpRR/wtup+mMhUZUn/dB5nLTJRsjl95G4=') 'ServerKey no coincide con el vector'
    $proof = [Convert]::FromBase64String('dHzbZapWIk4jUhN+Ute9ytag9zjfMHgsqmmiz7AndVQ=')
    $mask = [Security.Cryptography.HMACSHA256]::HashData($stored, $message)
    $clientKey = [byte[]](0..31 | ForEach-Object { $proof[$_] -bxor $mask[$_] })
    Assert-Condition ([Convert]::ToBase64String([Security.Cryptography.SHA256]::HashData($clientKey)) -ceq [Convert]::ToBase64String($stored)) 'StoredKey no coincide con el vector'

    $restore = Join-Path $script:ScriptsDir '09-Test-Restore.ps1'
    $ast = [Management.Automation.Language.Parser]::ParseFile($restore, [ref]$null, [ref]$null)
    $text = $ast.Extent.Text
    $secretUses = @([regex]::Matches($text, '\$restoreSecret[^\r\n]*') | ForEach-Object Value)
    Assert-Condition (@($text -split "`n" | Where-Object { $_ -match 'PASSWORD ''' -and $_ -match '\$restoreSecret' }).Count -eq 0) 'la contrasena en claro aparece en una sentencia'
    Assert-Condition ($secretUses.Count -ge 3 -and $text -match 'Invoke-LabSql ''postgres'' \$createRole -ViaStdin') 'la creacion del rol no usa stdin'
    Assert-Condition ($text -match 'log_min_error_statement = ''panic''') 'la sentencia podria quedar en el log del cluster'

    # Comportamiento: se extrae la funcion real y se sustituye solo la ejecucion de procesos.
    $definition = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-LabSql' }, $true)
    . ([scriptblock]::Create($definition.Extent.Text))
    $psql = 'psql-no-ejecutado.exe'
    $Port = 20000
    $adminSecret = 'ADMIN-SINTETICA'
    $seen = @{}
    function Invoke-Chain([object[]]$Stages, [IO.Stream]$InputStream, [IO.Stream]$OutputStream) {
        $seen.arguments = @($Stages[0].Arguments)
        $seen.quiet = $Stages[0].Quiet
        $seen.environment = @($Stages[0].Environment.Values)
        $seen.stdin = ''
        if ($InputStream) { $seen.stdin = [IO.StreamReader]::new($InputStream).ReadToEnd() }
        [pscustomobject]@{ ExitCodes = @($seen.code); Broken = $false }
    }
    $seen.code = 0
    $statement = "CREATE ROLE x PASSWORD '$verifier'"
    $null = Invoke-LabSql 'postgres' $statement -ViaStdin
    Assert-Condition (($seen.arguments -join ' ') -notmatch 'SCRAM|PASSWORD' -and $seen.arguments[-2] -ceq '-f' -and $seen.arguments[-1] -ceq '-') 'la sentencia llego a los argumentos'
    Assert-Condition ($seen.stdin -ceq $statement -and $seen.quiet) 'la sentencia no viajo por stdin silenciado'
    Assert-Condition (($seen.environment -join ' ') -notmatch 'SCRAM') 'el verificador llego al entorno'
    $seen.code = 3
    Assert-Rejected { Invoke-LabSql 'postgres' $statement -ViaStdin } 'consulta en el cluster aislado fallo'
    $seen.code = 0
    $null = Invoke-LabSql 'postgres' 'SELECT 1'
    Assert-Condition ($seen.arguments[-2] -ceq '-c' -and $seen.stdin -eq '') 'las consultas sin secreto cambiaron'
}

Invoke-Case 'T07p' 'Precondiciones de T07b: sin autorizacion, mismo disco o disco virtual quedan bloqueados' {
    $here = $PSScriptRoot
    Assert-Condition ((Get-SecondDiskBlocker $here $here $false) -match 'AuthorizedSecondDisk') 'sin autorizacion no se bloqueo'
    Assert-Condition ((Get-SecondDiskBlocker '' $here $true) -match 'ausente o inexistente') 'sin destino no se bloqueo'
    Assert-Condition ((Get-SecondDiskBlocker $here $here $true) -match 'mismo disco fisico') 'el mismo disco no se bloqueo'
    # Descriptores inventados: prueban la regla de rechazo, no sustituyen un disco fisico.
    $local = [pscustomobject]@{ Number = 0; BusType = 'NVMe'; SerialNumber = 'A'; UniqueId = 'U0' }
    $cases = @{
        'virtual'             = [pscustomobject]@{ Number = 1; BusType = 'File Backed Virtual'; SerialNumber = 'B'; UniqueId = 'U1' }
        'agrupado'            = [pscustomobject]@{ Number = 1; BusType = 'Storage Spaces'; SerialNumber = 'B'; UniqueId = 'U1' }
        'desconocido'         = [pscustomobject]@{ Number = 1; BusType = 'Unknown'; SerialNumber = 'B'; UniqueId = 'U1' }
        'mismo numero de serie' = [pscustomobject]@{ Number = 1; BusType = 'USB'; SerialNumber = 'A'; UniqueId = 'U1' }
        'mismo identificador' = [pscustomobject]@{ Number = 1; BusType = 'USB'; SerialNumber = 'B'; UniqueId = 'U0' }
        'no se pudo'          = $null
    }
    foreach ($name in $cases.Keys) {
        $pattern = $name
        if ($name -in 'virtual', 'agrupado', 'desconocido') { $pattern = 'disco virtual, agrupado' }
        Assert-Condition ((Test-IndependentDisk $local $cases[$name]) -match $pattern) "no se rechazo: $name"
    }
}

$labCases = [ordered]@{
    T05d = 'Ancestro que permite a Everyone borrar la carpeta: rechazo (R-M3)'
    F01  = 'Inventario 01: formatos, hashes, sin sobrescritura ni lectura redirigida'
    F07  = 'Formato anterior 07: recupera el sintetico y rechaza alterados'
    T01b = 'Firmante ajeno, clave revocada y politica alterada'
    T03b = 'Junction rechazado y ancestro retenido no renombrable'
    T05b = 'Binario alterado, DLL no declarada y ACL amplia'
    T07a = 'Conjunto ya publicado no se reescribe'
    T07c = 'Conjunto incompleto, alterado, sustituido o revocado: rechazo'
    T11c = 'Puerta real: evidencia fabricada, alterada, vencida, ajena o revocada; NO_GO'
    T14  = 'Copia en el mismo disco fisico: rechazo'
}
if (-not $LabRoot) {
    foreach ($id in $labCases.Keys) { Add-Result $id $labCases[$id] 'BLOCKED' 'requiere -LabRoot en un laboratorio autorizado' }
    Complete-Run
    return
}

$lab = New-Lab $LabRoot
$keys = @{}
foreach ($principal in 'vetneb-backup', 'lab-primary', 'lab-recovery', 'lab-restore', 'intruso') {
    $keys[$principal] = Join-Path $lab.keys $principal
    New-LabKey $keys[$principal]
}
$trusted = @{}
foreach ($principal in 'vetneb-backup', 'lab-primary', 'lab-recovery', 'lab-restore') { $trusted[$principal] = $keys[$principal] }
$policy = New-SyntheticPolicy
$policy.productionComputer = [Environment]::MachineName
$policy.evidenceSigners[0].computer = [Environment]::MachineName
$policy.evidenceSigners[2].computer = [Environment]::MachineName
$trust = Install-LabTrust $lab $policy $trusted

$original = Join-Path $lab.source 'lab.dump'
[IO.File]::WriteAllBytes($original, [Text.Encoding]::ASCII.GetBytes('PGDMP-datos-inventados'))
$originalHash = Get-Sha256Hex $original
$setDir = Join-Path $lab.sets 'set-a'
$null = New-Item -ItemType Directory -Path $setDir
$cipher = Join-Path $setDir 'lab.dump.age'
[IO.File]::WriteAllBytes($cipher, [Text.Encoding]::ASCII.GetBytes("age-encryption.org/v1`ncifrado-sintetico"))
$record = New-SyntheticRecord $policy
$record.sourceSha256 = $originalHash
$record.cipherSha256 = Get-Sha256Hex $cipher
[IO.File]::WriteAllText("$cipher.record.json", ($record | ConvertTo-Json -Depth 4), $script:Utf8)
$sums = Join-Path $setDir 'SHA256SUMS.txt'
$lines = "$(Get-Sha256Hex $cipher)  lab.dump.age`n$(Get-Sha256Hex "$cipher.record.json")  lab.dump.age.record.json`n"
[IO.File]::WriteAllText($sums, $lines, $script:Utf8)
Add-LabSignature $sums $keys['vetneb-backup'] 'vetneb-backup'

$gateArguments = @('-File', (Join-Path $lab.scripts '08-Test-RetirementGate.ps1'), '-Original', $original,
    '-ExpectedPlainSha256', $originalHash, '-SetDirs', $setDir, '-EvidenceDir', $lab.evidence)

Invoke-Case 'T01b' $labCases.T01b {
    $content = [IO.File]::ReadAllBytes($sums)
    Assert-Condition (Test-DetachedSignature $trust $content "$sums.sig" 'vetneb-backup' 'vetneb-backup') 'firma legitima rechazada'
    $foreign = Join-Path $lab.staging 'ajeno.txt'
    [IO.File]::WriteAllBytes($foreign, $content)
    Add-LabSignature $foreign $keys['intruso'] 'vetneb-backup'
    Assert-Condition (-not (Test-DetachedSignature $trust $content "$foreign.sig" 'vetneb-backup' 'vetneb-backup')) 'firma ajena aceptada'
    $revoked = Join-Path $lab.staging 'revoked'
    [IO.File]::WriteAllText($revoked, "$(Get-LabPublicKey $keys['vetneb-backup'])`n", $script:Utf8)
    $withRevocation = [pscustomobject]@{ AllowedSigners = $trust.AllowedSigners; RevokedKeys = $revoked }
    Assert-Condition (-not (Test-DetachedSignature $withRevocation $content "$sums.sig" 'vetneb-backup' 'vetneb-backup')) 'clave revocada aceptada'
    $policyPath = Join-Path $lab.trust 'trust-policy.json'
    $saved = [IO.File]::ReadAllBytes($policyPath)
    Close-HeldHandles
    try {
        [IO.File]::AppendAllText($policyPath, ' ')
        Assert-ChildRejected (Invoke-Child $gateArguments) 'no coincide con su pin'
    }
    finally { [IO.File]::WriteAllBytes($policyPath, $saved) }
}

Invoke-Case 'T03b' $labCases.T03b {
    $real = Join-Path $lab.Run 'real'
    $null = New-Item -ItemType Directory -Path $real
    [IO.File]::WriteAllText((Join-Path $real 'a.txt'), 'a')
    $link = Join-Path $lab.Run 'enlace'
    $null = New-Item -ItemType Junction -Path $link -Target $real
    Assert-Rejected { Open-HeldFile (Join-Path $link 'a.txt') } 'reparse'
    $null = Open-HeldFile (Join-Path $real 'a.txt')
    Assert-Rejected { Rename-Item -LiteralPath $real -NewName 'movido' } '.'
    Assert-Condition (Test-Path -LiteralPath $real) 'el ancestro retenido fue renombrado'
    Close-HeldHandles
    # Carpetas sin archivos abiertos: el bloqueo depende solo de los handles de directorio.
    $parent = Join-Path $lab.Run 'padre'
    $empty = Join-Path $parent 'vacia'
    $null = New-Item -ItemType Directory -Path $empty
    Open-HeldDirectory $empty
    Assert-Rejected { Rename-Item -LiteralPath $empty -NewName 'movida' } '.'
    Assert-Rejected { Rename-Item -LiteralPath $parent -NewName 'padre-movido' } '.'
    Assert-Condition (Test-Path -LiteralPath $empty) 'una carpeta retenida fue renombrada'
    Close-HeldHandles
    # Control: sin retencion el mismo renombrado funciona.
    Rename-Item -LiteralPath $parent -NewName 'padre-movido'
    Assert-Condition (-not (Test-Path -LiteralPath $parent)) 'el control de renombrado no fue valido'
}

Invoke-Case 'T05b' $labCases.T05b {
    $writers = $script:TrustedWriterSids
    $script:TrustedWriterSids = @(Get-OperatorSid) + $writers
    try {
        $tool = Join-Path $lab.tools 'falsa'
        $null = New-Item -ItemType Directory -Path $tool
        $exe = Join-Path $tool 'tool.exe'
        # Archivo inerte: nunca se ejecuta.
        [IO.File]::WriteAllText($exe, 'inerte')
        $entry = Get-LabToolEntry $tool @('.')
        $context = [pscustomobject]@{ Policy = ConvertTo-Object @{ tools = @{ falsa = $entry } } }
        $null = Open-TrustedTool $context 'falsa' 'tool.exe'
        Close-HeldHandles
        [IO.File]::WriteAllText($exe, 'alterado')
        Assert-Rejected { Open-TrustedTool $context 'falsa' 'tool.exe' } 'no aprobado'
        Close-HeldHandles
        [IO.File]::WriteAllText($exe, 'inerte')
        $extra = Join-Path $tool 'plantada.dll'
        [IO.File]::WriteAllText($extra, 'x')
        Assert-Rejected { Open-TrustedTool $context 'falsa' 'tool.exe' } 'no declarado'
        Close-HeldHandles
        # Carpeta propia para el caso de ACL: la DLL plantada se conserva en la anterior.
        $tool = Join-Path $lab.tools 'acl'
        $null = New-Item -ItemType Directory -Path $tool
        [IO.File]::WriteAllText((Join-Path $tool 'tool.exe'), 'inerte')
        $context = [pscustomobject]@{ Policy = ConvertTo-Object @{ tools = @{ falsa = Get-LabToolEntry $tool @('.') } } }
        $null = Open-TrustedTool $context 'falsa' 'tool.exe'
        Close-HeldHandles
        # Solo la DACL: Set-Acl puede exigir privilegios sobre propietario o auditoria.
        $directory = [IO.DirectoryInfo]::new($tool)
        $acl = [IO.FileSystemAclExtensions]::GetAccessControl($directory, [Security.AccessControl.AccessControlSections]::Access)
        $everyone = [Security.Principal.SecurityIdentifier]::new('S-1-1-0')
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($everyone, 'Modify', 'Allow'))
        [IO.FileSystemAclExtensions]::SetAccessControl($directory, $acl)
        try { Assert-Rejected { Open-TrustedTool $context 'falsa' 'tool.exe' } 'ACL no restringida' }
        finally {
            # La carpeta se conserva, pero no queda abierta a otros principales.
            Close-HeldHandles
            $null = $acl.RemoveAccessRule([Security.AccessControl.FileSystemAccessRule]::new($everyone, 'Modify', 'Allow'))
            [IO.FileSystemAclExtensions]::SetAccessControl($directory, $acl)
        }
        $null = Open-TrustedTool $context 'falsa' 'tool.exe'
    }
    finally { $script:TrustedWriterSids = $writers }
}

Invoke-Case 'T07a' $labCases.T07a {
    $before = Get-Sha256Hex "$sums.sig"
    $child = Invoke-Child @('-File', (Join-Path $lab.scripts '05-Sign-BackupSet.ps1'), '-SetDir', $setDir,
        '-ExpectedPlainSha256', $originalHash, '-SigningKey', $keys['vetneb-backup'], '-StagingDir', $lab.staging)
    Assert-ChildRejected $child 'solo un .dump.age'
    Assert-Condition ((Get-Sha256Hex "$sums.sig") -eq $before) 'la firma publicada cambio'
}

Invoke-Case 'T07c' $labCases.T07c {
    $cipherBytes = [IO.File]::ReadAllBytes($cipher)
    $recordBytes = [IO.File]::ReadAllBytes("$cipher.record.json")
    $sumsBytes = [IO.File]::ReadAllBytes($sums)
    $signatureBytes = [IO.File]::ReadAllBytes("$sums.sig")
    # Cada variante es una carpeta nueva a la que le falta o le cambia algo.
    function New-Variant([string]$Name, [hashtable]$Files) {
        $path = Join-Path $lab.sets "variante-$Name"
        $null = New-Item -ItemType Directory -Path $path
        foreach ($file in $Files.Keys) { [IO.File]::WriteAllBytes((Join-Path $path $file), $Files[$file]) }
        $path
    }
    $complete = @{
        'lab.dump.age' = $cipherBytes; 'lab.dump.age.record.json' = $recordBytes
        'SHA256SUMS.txt' = $sumsBytes; 'SHA256SUMS.txt.sig' = $signatureBytes
    }
    $null = Open-SignedSet $trust (New-Variant 'integra' $complete)
    Close-HeldHandles
    $variants = @(
        @{ name = 'sin-firma'; file = 'SHA256SUMS.txt.sig'; value = $null; reason = 'SHA256SUMS\.txt\.sig' }
        @{ name = 'firma-parcial'; file = 'SHA256SUMS.txt.sig'; value = [byte[]]$signatureBytes[0..60]; reason = 'firma del conjunto invalida' }
        @{ name = 'sin-lista'; file = 'SHA256SUMS.txt'; value = $null; reason = 'SHA256SUMS\.txt' }
        @{ name = 'lista-parcial'; file = 'SHA256SUMS.txt'; value = [byte[]]$sumsBytes[0..40]; reason = 'firma del conjunto invalida' }
        @{ name = 'sin-registro'; file = 'lab.dump.age.record.json'; value = $null; reason = 'faltan o sobran' }
        @{ name = 'sin-cifrado'; file = 'lab.dump.age'; value = $null; reason = 'faltan o sobran' }
        @{ name = 'cifrado-alterado'; file = 'lab.dump.age'; value = [byte[]]($cipherBytes + [byte]1); reason = 'hash distinto' }
        @{ name = 'registro-alterado'; file = 'lab.dump.age.record.json'; value = [byte[]]($recordBytes + [byte]32); reason = 'hash distinto' }
        @{ name = 'sobrante'; file = 'extra.txt'; value = [byte[]](1); reason = 'faltan o sobran' }
    )
    foreach ($variant in $variants) {
        $files = $complete.Clone()
        $files.Remove($variant.file)
        if ($null -ne $variant.value) { $files[$variant.file] = $variant.value }
        $path = New-Variant $variant.name $files
        Assert-Rejected { Open-SignedSet $trust $path } $variant.reason
        Close-HeldHandles
    }
    $good = Join-Path $lab.sets 'variante-integra'
    $revoked = [pscustomobject]@{
        Policy = ($trust.Policy | ConvertTo-Json -Depth 8 | ConvertFrom-Json)
        AllowedSigners = $trust.AllowedSigners; RevokedKeys = $trust.RevokedKeys
    }
    $revoked.Policy.revokedSetIds = @($record.setId)
    Assert-Rejected { Open-SignedSet $revoked $good } 'conjunto revocado'
    Close-HeldHandles
    $opened = Open-SignedSet $trust $good
    Assert-Rejected { Assert-CipherRecord $opened.Record $trust.Policy ('E' * 64) } 'inventario independiente'
    # Sustitucion despues de verificar: ni escritura ni cambio de carpeta.
    Assert-Rejected { [IO.File]::WriteAllBytes((Join-Path $good 'lab.dump.age'), [byte[]](9)) } '.'
    Assert-Rejected { Rename-Item -LiteralPath $good -NewName 'variante-sustituida' } '.'
    Assert-Condition ((Get-StreamSha256 $opened.Cipher) -eq $record.cipherSha256) 'el contenido consumido cambio'
}

Invoke-Case 'T11c' $labCases.T11c {
    $now = Get-UnixNow
    $cases = @(
        @{ name = 'valida'; key = 'lab-primary'; created = $now; alter = $false }
        @{ name = 'fabricada'; key = 'intruso'; created = $now; alter = $false }
        @{ name = 'alterada'; key = 'lab-primary'; created = $now; alter = $true }
        @{ name = 'vencida'; key = 'lab-primary'; created = ($now - 30 * 86400); alter = $false }
    )
    foreach ($case in $cases) {
        $data = New-SyntheticEvidence $record 'decrypt' 'primary' ([Environment]::MachineName) $case.created
        $data.policySha256 = $trust.PolicySha256
        $path = Join-Path $lab.evidence "$($case.name).json"
        [IO.File]::WriteAllText($path, ($data | ConvertTo-Json), $script:Utf8)
        Add-LabSignature $path $keys[$case.key] 'vetneb-evidence'
        if ($case.alter) { [IO.File]::AppendAllText($path, ' ') }
    }
    $child = Invoke-Child $gateArguments
    $other = New-SyntheticEvidence $record 'decrypt' 'primary' ([Environment]::MachineName) $now
    $other.policySha256 = $trust.PolicySha256
    $other.setId = 'b' * 32
    $path = Join-Path $lab.evidence 'otro-conjunto.json'
    [IO.File]::WriteAllText($path, ($other | ConvertTo-Json), $script:Utf8)
    Add-LabSignature $path $keys['lab-primary'] 'vetneb-evidence'
    $child = Invoke-Child $gateArguments
    $child.Output | Set-Content -LiteralPath (Join-Path $lab.Run 'gate-evidencia.log')
    Assert-ChildRejected $child 'NO_GO'
    Assert-Condition ($child.Output -match '"evidenciaAceptada": 1\b') "se esperaba una sola evidencia aceptada: $($child.Output)"
    $expected = @{ fabricada = 'firma de evidencia invalida'; alterada = 'firma de evidencia invalida'; vencida = 'evidencia vencida'; 'otro-conjunto' = 'otro conjunto' }
    foreach ($name in $expected.Keys) {
        Assert-Condition ($child.Output -match "$name\.json: [^`"]*$($expected[$name])") "motivo inesperado para $name"
    }

    # Revocacion: segunda instalacion con la clave de recuperacion revocada desde el inicio.
    $second = New-Lab $LabRoot
    $revokedTrust = Install-LabTrust $second ($policy | ConvertTo-Json -Depth 8 | ConvertFrom-Json) $trusted @((Get-LabPublicKey $keys['lab-recovery']))
    foreach ($role in 'primary', 'recovery') {
        $computer = [Environment]::MachineName
        if ($role -ceq 'recovery') { $computer = 'LAB-RECOVERY' }
        $data = New-SyntheticEvidence $record 'decrypt' $role $computer (Get-UnixNow)
        $data.policySha256 = $revokedTrust.PolicySha256
        $path = Join-Path $second.evidence "$role.json"
        [IO.File]::WriteAllText($path, ($data | ConvertTo-Json), $script:Utf8)
        Add-LabSignature $path $keys["lab-$role"] 'vetneb-evidence'
    }
    # Control: la firma revocada es valida sin la revocacion.
    $revokedFile = Join-Path $second.evidence 'recovery.json'
    $content = [IO.File]::ReadAllBytes($revokedFile)
    Assert-Condition (Test-DetachedSignature $trust $content "$revokedFile.sig" 'lab-recovery' 'vetneb-evidence') 'control de revocacion invalido'
    Close-HeldHandles
    $child = Invoke-Child @('-File', (Join-Path $second.scripts '08-Test-RetirementGate.ps1'), '-Original', $original,
        '-ExpectedPlainSha256', $originalHash, '-SetDirs', $setDir, '-EvidenceDir', $second.evidence)
    $child.Output | Set-Content -LiteralPath (Join-Path $second.Run 'gate-revocacion.log')
    Assert-ChildRejected $child 'NO_GO'
    Assert-Condition ($child.Output -match '"evidenciaAceptada": 1\b') "revocacion no aplicada: $($child.Output)"
    Assert-Condition ($child.Output -match 'recovery\.json: [^"]*firma de evidencia invalida') 'la evidencia revocada no se rechazo por firma'
    Assert-Condition ($child.Output -match '"recuperacionEnOtroEquipo": false') 'la evidencia revocada conto para la puerta'
}

Invoke-Case 'T14' $labCases.T14 {
    $destination = Join-Path $lab.Run 'destino'
    $null = New-Item -ItemType Directory -Path $destination
    $child = Invoke-Child @('-File', (Join-Path $lab.scripts '06-Copy-BackupSet.ps1'), '-SetDir', $setDir, '-DestinationRoot', $destination)
    Assert-ChildRejected $child 'mismo disco fisico'
    Assert-Condition (@(Get-ChildItem -LiteralPath $destination -Force).Count -eq 0) 'se escribio en el destino'
}

Invoke-Case 'T05d' $labCases.T05d {
    $parent = Join-Path $lab.Run 'padre-amplio'
    $secret = Join-Path $parent 'secreto'
    $null = New-Item -ItemType Directory -Path $secret
    # La carpeta final queda restringida; el defecto esta solo en el ancestro.
    Set-LabAcl $secret
    $operator = Get-OperatorSid
    Assert-SecretAcl $secret
    $directory = [IO.DirectoryInfo]::new($parent)
    $acl = [IO.FileSystemAclExtensions]::GetAccessControl($directory, [Security.AccessControl.AccessControlSections]::Access)
    $everyone = [Security.Principal.SecurityIdentifier]::new('S-1-1-0')
    $rule = [Security.AccessControl.FileSystemAccessRule]::new($everyone, 'DeleteSubdirectoriesAndFiles', 'Allow')
    $acl.AddAccessRule($rule)
    [IO.FileSystemAclExtensions]::SetAccessControl($directory, $acl)
    try {
        # Una comprobacion limitada a la carpeta (la implementacion previa) la sigue aceptando.
        Assert-AclMask $secret (@($operator) + $script:TrustedWriterSids) @($operator, 'S-1-5-18') ([long]-1)
        Assert-Rejected { Assert-SecretAcl $secret } 'ACL no restringida en .*padre-amplio \(S-1-1-0\)'
        $writers = $script:TrustedWriterSids
        $script:TrustedWriterSids = @($operator) + $writers
        try { Assert-Rejected { Assert-AdminAcl $secret } 'ACL no restringida en .*padre-amplio \(S-1-1-0\)' }
        finally { $script:TrustedWriterSids = $writers }
    }
    finally {
        $null = $acl.RemoveAccessRule($rule)
        [IO.FileSystemAclExtensions]::SetAccessControl($directory, $acl)
    }
    Assert-SecretAcl $secret
}

Invoke-Case 'F01' $labCases.F01 {
    $root = Join-Path $lab.Run 'inventario'
    $null = New-Item -ItemType Directory -Path $root
    $files = [ordered]@{
        'claro.dump'       = @('PGDMP-sintetico-000', 'PGDMP_EN_CLARO')
        'anterior.vnbenc'  = @('VNBENC1-sintetico-000', 'VNBENC1')
        'nuevo.age'        = @("age-encryption.org/v1`nsintetico", 'AGE_V1')
        'otro.zip'         = @('PK-sintetico-000', 'NO_IDENTIFICADO')
        'vacio.bak'        = @('', 'VACIO')
        'ignorado.txt'     = @('PGDMP-no-listar', $null)
    }
    foreach ($name in $files.Keys) { [IO.File]::WriteAllText((Join-Path $root $name), $files[$name][0], $script:Utf8) }
    $before = @(Get-ChildItem -LiteralPath $root -File | Sort-Object Name | ForEach-Object { Get-Sha256Hex $_.FullName }) -join ','
    $inventory = Join-Path $lab.Run 'inventario.json'
    $script01 = Join-Path $lab.scripts '01-Get-BackupInventory.ps1'
    $child = Invoke-Child @('-File', $script01, '-Root', $root, '-OutFile', $inventory)
    Assert-Condition ($child.Code -eq 0) "01 codigo=$($child.Code): $($child.Output)"
    $rows = @([IO.File]::ReadAllText($inventory) | ConvertFrom-Json)
    Assert-Condition ($rows.Count -eq 5) "filas inesperadas: $($rows.Count)"
    foreach ($row in $rows) {
        $name = [IO.Path]::GetFileName($row.Path)
        Assert-Condition ($row.Format -ceq $files[$name][1]) "formato de ${name}: $($row.Format)"
        Assert-Condition ($row.Sha256 -eq (Get-Sha256Hex $row.Path) -and $row.Bytes -eq (Get-Item -LiteralPath $row.Path).Length) "hash o tamano de $name"
    }
    $published = Get-Sha256Hex $inventory
    Assert-ChildRejected (Invoke-Child @('-File', $script01, '-Root', $root, '-OutFile', $inventory)) 'inventario\.json'
    Assert-Condition ((Get-Sha256Hex $inventory) -eq $published) '01 sobrescribio el inventario'
    Assert-ChildRejected (Invoke-Child @('-File', $script01, '-Root', (Join-Path $lab.Run 'no-existe'))) 'no existe'
    # La copia de laboratorio conserva las raices prohibidas; se usa la del repositorio, nunca la de respaldos.
    $forbidden = 'C:\PORTAL-VETNEB\inventario-prohibido.json'
    Assert-ChildRejected (Invoke-Child @('-File', $script01, '-Root', $root, '-OutFile', $forbidden)) 'raiz prohibida'
    Assert-Condition (-not (Test-Path -LiteralPath $forbidden)) 'se escribio un inventario prohibido'
    $link = Join-Path $lab.Run 'inventario-enlace'
    $null = New-Item -ItemType Junction -Path $link -Target $root
    Assert-ChildRejected (Invoke-Child @('-File', $script01, '-Root', $link)) 'reparse'
    $none = Join-Path $lab.Run 'inventario-vacio'
    $null = New-Item -ItemType Directory -Path $none
    $child = Invoke-Child @('-File', $script01, '-Root', $none)
    Assert-Condition ($child.Code -eq 0 -and $child.Output.Trim() -ceq '[]') "carpeta vacia: $($child.Output)"
    $after = @(Get-ChildItem -LiteralPath $root -File | Sort-Object Name | ForEach-Object { Get-Sha256Hex $_.FullName }) -join ','
    Assert-Condition ($after -ceq $before) '01 modifico los origenes'
}

Invoke-Case 'F07' $labCases.F07 {
    $folder = Join-Path $lab.Run 'formato-anterior'
    $null = New-Item -ItemType Directory -Path $folder
    $passphrase = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(16))
    $plain = [Text.Encoding]::ASCII.GetBytes('PGDMP-datos-inventados-formato-anterior' * 50)
    $salt = [Security.Cryptography.RandomNumberGenerator]::GetBytes(16)
    $nonce = [Security.Cryptography.RandomNumberGenerator]::GetBytes(12)
    $key = [Security.Cryptography.Rfc2898DeriveBytes]::Pbkdf2([Text.Encoding]::UTF8.GetBytes($passphrase), $salt, 600000, [Security.Cryptography.HashAlgorithmName]::SHA256, 32)
    $tag = [byte[]]::new(16)
    $cipherBytes = [byte[]]::new($plain.Length)
    $gcm = [Security.Cryptography.AesGcm]::new($key, 16)
    try { $gcm.Encrypt($nonce, $plain, $cipherBytes, $tag) }
    finally { $gcm.Dispose() }
    $good = [byte[]]([Text.Encoding]::ASCII.GetBytes('VNBENC1') + [BitConverter]::GetBytes([int]600000) + $salt + $nonce + $tag + $cipherBytes)
    $expected = Get-BytesSha256 $plain
    $script07 = Join-Path $lab.scripts '07-Test-Vnbenc.ps1'

    # La passphrase sintetica entra por stdin; Read-Host se sustituye solo en el proceso de prueba.
    function Invoke-Legacy([string]$Name, [byte[]]$Bytes, [string]$Secret, [string]$Hash) {
        $path = Join-Path $folder "$Name.vnbenc"
        [IO.File]::WriteAllBytes($path, $Bytes)
        $command = "function Read-Host { param([string]`$Prompt, [switch]`$AsSecureString) `$s = [Security.SecureString]::new(); foreach (`$c in [Console]::In.ReadLine().ToCharArray()) { `$s.AppendChar(`$c) }; `$s }; & '$script07' -CipherFile '$path' -ExpectedPlainSha256 $Hash"
        $output = $Secret | & $script:Pwsh -NoProfile -NonInteractive -Command $command 2>&1 | Out-String
        [pscustomobject]@{ Code = $LASTEXITCODE; Output = $output }
    }
    $run = Invoke-Legacy 'sano' $good $passphrase $expected
    Assert-Condition ($run.Code -eq 0 -and $run.Output -match 'PASSED' -and $run.Output -match $expected) "07 rechazo el archivo sano: $($run.Output)"
    Assert-Condition (-not $run.Output.Contains($passphrase)) 'la passphrase aparece en la salida'
    $flipped = [byte[]]$good.Clone()
    $flipped[$flipped.Length - 3] = $flipped[$flipped.Length - 3] -bxor 1
    $badMagic = [byte[]]$good.Clone()
    $badMagic[0] = 88
    $weak = [byte[]]$good.Clone()
    [BitConverter]::GetBytes([int]1000).CopyTo($weak, 7)
    $negatives = @(
        @{ name = 'clave-erronea'; bytes = $good; secret = 'otra-sintetica'; hash = $expected; reason = 'tag' }
        @{ name = 'alterado'; bytes = $flipped; secret = $passphrase; hash = $expected; reason = 'tag' }
        @{ name = 'truncado'; bytes = [byte[]]$good[0..($good.Length - 20)]; secret = $passphrase; hash = $expected; reason = 'tag' }
        @{ name = 'sobrante'; bytes = [byte[]]($good + [byte]1); secret = $passphrase; hash = $expected; reason = 'tag' }
        @{ name = 'magia'; bytes = $badMagic; secret = $passphrase; hash = $expected; reason = 'formato no reconocido' }
        @{ name = 'iteraciones'; bytes = $weak; secret = $passphrase; hash = $expected; reason = 'iteraciones fuera de rango' }
        @{ name = 'corto'; bytes = [byte[]]$good[0..54]; secret = $passphrase; hash = $expected; reason = 'tamano fuera de rango' }
        @{ name = 'otro-hash'; bytes = $good; secret = $passphrase; hash = ('F' * 64); reason = 'no coincide con el original' }
    )
    foreach ($negative in $negatives) {
        $run = Invoke-Legacy $negative.name $negative.bytes $negative.secret $negative.hash
        Assert-Condition ($run.Code -ne 0 -and $run.Output -notmatch 'PASSED') "07 acepto $($negative.name)"
        Assert-Condition ($run.Output -match $negative.reason) "motivo inesperado en $($negative.name): $($run.Output)"
    }
    Assert-Condition (@(Get-ChildItem -LiteralPath $folder -Force).Count -eq ($negatives.Count + 1)) '07 escribio archivos'
}

Write-RunRecord $lab.Run 'automatica'
Write-Host "Laboratorio conservado: $($lab.Run)"
Complete-Run
