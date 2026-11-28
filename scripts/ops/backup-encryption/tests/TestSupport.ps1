#Requires -Version 7.4
# Arnes de las pruebas. Se carga DESPUES de ..\Common.ps1. Solo datos sinteticos; no elimina nada.
# Las funciones *-Lab* crean archivos, ACL y claves desechables: requieren autorizacion de laboratorio.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:ScriptsDir = Split-Path $PSScriptRoot -Parent
$script:Pwsh = Join-Path $PSHOME 'pwsh.exe'
$script:Results = [Collections.Generic.List[object]]::new()
$script:Utf8 = [Text.UTF8Encoding]::new($false)

function Add-Result([string]$Id, [string]$Name, [string]$Status, [string]$Detail = '') {
    $script:Results.Add([pscustomobject]@{ Id = $Id; Status = $Status; Name = $Name; Detail = $Detail })
}

function Invoke-Case([string]$Id, [string]$Name, [scriptblock]$Body) {
    $status = 'PASSED'
    $detail = ''
    Write-Host "== $Id : $Name =="
    try { $null = & $Body }
    catch {
        $status = 'FAILED'
        $detail = $_.Exception.Message
    }
    finally { Close-HeldHandles }
    Add-Result $Id $Name $status $detail
}

# El rechazo debe ocurrir y por el motivo esperado.
function Assert-Rejected([scriptblock]$Action, [string]$Pattern) {
    $message = $null
    try { $null = & $Action }
    catch { $message = $_.Exception.Message }
    if ($null -eq $message) { throw "no hubo rechazo (esperado: $Pattern)" }
    if ($message -notmatch $Pattern) { throw "rechazo por otro motivo: $message" }
}

# Bytes exactos probados: SHA-256 y fin de linea de cada fuente.
function Get-SourceManifest {
    $runbook = Join-Path $script:ScriptsDir '..\..\..\docs\ops\BACKUP_ENCRYPTION_RUNBOOK.md'
    $files = @(Get-ChildItem -LiteralPath $script:ScriptsDir -Recurse -File -Filter '*.ps1' | ForEach-Object FullName)
    if (Test-Path -LiteralPath $runbook) { $files += [IO.Path]::GetFullPath($runbook) }
    foreach ($file in $files | Sort-Object) {
        $text = [IO.File]::ReadAllText($file)
        $eol = 'LF'
        if ($text.Contains("`r`n")) { $eol = 'CRLF' }
        if ($text -cmatch '\r\n' -and $text -cmatch '(?<!\r)\n') { $eol = 'MIXTO' }
        [pscustomobject]@{ file = [IO.Path]::GetFileName($file); sha256 = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash; eol = $eol }
    }
}

# Registro nuevo en la carpeta de la corrida, antes de Complete-Run. Nunca sobrescribe.
function Write-RunRecord([string]$Directory, [string]$Suite) {
    $record = [ordered]@{
        schema      = 1
        suite       = $Suite
        finishedUtc = [DateTime]::UtcNow.ToString('o')
        powershell  = "$($PSVersionTable.PSVersion)"
        sources     = @(Get-SourceManifest)
        results     = @($script:Results)
    }
    $path = Join-Path $Directory "registro-$Suite-$([DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')).json"
    Write-NewTextFile $path ($record | ConvertTo-Json -Depth 5)
    Write-Host "Registro: $path"
}

# Salida de la consola del ensayo, saneada. Archivo nuevo; no se guarda si contiene la passphrase.
function Save-ConsoleLog([string]$Path) {
    $ui = $Host.UI.RawUI
    $area = [Management.Automation.Host.Rectangle]::new(0, 0, $ui.BufferSize.Width - 1, $ui.CursorPosition.Y)
    $cells = $ui.GetBufferContents($area)
    $rows = @(for ($y = 0; $y -lt $cells.GetLength(0); $y++) {
            (-join @(for ($x = 0; $x -lt $cells.GetLength(1); $x++) { $cells[$y, $x].Character })).TrimEnd()
        })
    $text = $rows -join "`n"
    if ($script:LabPassphrase) { Assert-Condition (-not $text.Contains($script:LabPassphrase)) 'la consola contiene la passphrase: no se guarda' }
    $text = $text.Replace([Environment]::GetFolderPath('UserProfile'), '%USERPROFILE%') -replace 'S-1-5-21-[0-9-]+', 'S-1-5-21-<cuenta>'
    Write-NewTextFile $Path $text
}

# Motivo por el que un destino no sirve como segundo disco fisico; '' si sirve.
function Test-IndependentDisk($Source, $Target) {
    if ($null -eq $Source -or $null -eq $Target) { return 'no se pudo determinar el disco' }
    if ($Source.Number -eq $Target.Number) { return 'mismo disco fisico' }
    foreach ($disk in $Source, $Target) {
        if ("$($disk.BusType)" -match '^$|Unknown|Virtual|Spaces|iSCSI') { return "disco virtual, agrupado, remoto o desconocido: '$($disk.BusType)'" }
    }
    if ("$($Target.SerialNumber)".Trim() -and "$($Source.SerialNumber)".Trim() -eq "$($Target.SerialNumber)".Trim()) { return 'mismo numero de serie' }
    if ($Source.UniqueId -and $Source.UniqueId -eq $Target.UniqueId) { return 'mismo identificador de disco' }
    ''
}

function Get-DiskOfPath([string]$Path) {
    $number = Get-DiskNumber $Path
    Get-Disk -Number $number -ErrorAction Stop | Select-Object Number, BusType, SerialNumber, UniqueId
}

function Get-SecondDiskBlocker([string]$Root, [string]$SourcePath, [bool]$Authorized) {
    if (-not $Authorized) { return 'requiere un segundo disco fisico y -AuthorizedSecondDisk' }
    if (-not $Root -or -not (Test-Path -LiteralPath $Root -PathType Container)) { return 'requiere un segundo disco fisico: -SecondDiskRoot ausente o inexistente' }
    try {
        $reason = Test-IndependentDisk (Get-DiskOfPath $SourcePath) (Get-DiskOfPath $Root)
        if ($reason) { return "no es un segundo disco fisico: $reason" }
        if ([IO.DriveInfo]::new([IO.Path]::GetPathRoot((Get-FullPath $Root))).DriveFormat -ne 'NTFS') { return 'el destino no es NTFS' }
    }
    catch { return "no se pudo comprobar la independencia fisica: $($_.Exception.Message)" }
    ''
}

# Falla el proceso si algo no quedo PASSED.
function Complete-Run {
    $script:Results | Format-Table Id, Status, Name, Detail -Wrap | Out-String -Width 160 | Write-Host
    $script:Results | Group-Object Status | ForEach-Object { Write-Host "$($_.Name)=$($_.Count)" }
    $pending = @($script:Results | Where-Object Status -NE 'PASSED')
    if ($pending.Count) { throw "SUITE INCOMPLETA O FALLIDA: $($pending.Count) caso(s) sin PASSED" }
}

function Invoke-Child([string[]]$Arguments) {
    $output = & $script:Pwsh -NoProfile -NonInteractive @Arguments 2>&1 | Out-String
    [pscustomobject]@{ Code = $LASTEXITCODE; Output = $output }
}

function Assert-ChildRejected($Child, [string]$Pattern) {
    Assert-Condition ($Child.Code -ne 0) "el proceso hijo termino con 0 (esperado rechazo: $Pattern)"
    Assert-Condition ($Child.Output -match $Pattern) "rechazo por otro motivo: $($Child.Output)"
}

# --- Datos en memoria -------------------------------------------------------------------------------

function New-FakeRecipient([char]$Last) { 'age1' + ('q' * 57) + $Last }

function ConvertTo-Object($Value) { $Value | ConvertTo-Json -Depth 8 | ConvertFrom-Json }

function New-SyntheticPolicy {
    ConvertTo-Object ([ordered]@{
            schema             = 1
            epoch              = 1
            productionComputer = 'LAB-PRODUCTION'
            backupSigner       = 'vetneb-backup'
            evidenceSigners    = @(
                @{ principal = 'lab-primary'; role = 'primary'; computer = 'LAB-PRODUCTION' }
                @{ principal = 'lab-recovery'; role = 'recovery'; computer = 'LAB-RECOVERY' }
                @{ principal = 'lab-restore'; role = 'restore'; computer = 'LAB-RESTORE' }
            )
            recipients         = @{ primary = New-FakeRecipient 'p'; recovery = New-FakeRecipient 'r' }
            custodians         = @{ primary = 'custodio-a'; recovery = 'custodio-b' }
            # Valor de prueba. La vigencia real sigue pendiente de aprobacion.
            evidenceMaxAge     = @{ days = 7; status = 'APPROVED'; approvedBy = 'SOLO-PRUEBAS' }
            revokedSetIds      = @()
        })
}

function New-SyntheticSignerLines {
    $index = 0
    foreach ($principal in 'vetneb-backup', 'lab-primary', 'lab-recovery', 'lab-restore') {
        $namespace = 'vetneb-evidence'
        if ($principal -ceq 'vetneb-backup') { $namespace = 'vetneb-backup' }
        $index++
        "$principal namespaces=`"$namespace`" ssh-ed25519 AAAASYNTHETIC$index"
    }
}

function New-SyntheticRecord($Policy) {
    ConvertTo-Object ([ordered]@{
            schema       = 2
            setId        = 'a' * 32
            dataClass    = 'synthetic'
            sourceName   = 'lab.dump'
            sourceBytes  = 10
            sourceSha256 = 'A' * 64
            cipherName   = 'lab.dump.age'
            cipherBytes  = 20
            cipherSha256 = 'B' * 64
            recipients   = @{ primary = $Policy.recipients.primary; recovery = $Policy.recipients.recovery }
            policyEpoch  = 1
            createdUnix  = 1000000
        })
}

function New-SyntheticEvidence($Record, [string]$Kind, [string]$Role, [string]$Computer, [long]$Created) {
    $data = [ordered]@{
        schema = 1; kind = $Kind; role = $Role; setId = $Record.setId; cipherSha256 = $Record.cipherSha256
        plainSha256 = $Record.sourceSha256; computer = $Computer; policyEpoch = 1; policySha256 = 'C' * 64
        createdUnix = $Created; principal = "lab-$Role"
    }
    if ($Kind -ceq 'decrypt') {
        $data['recipient'] = $Record.recipients.$Role
        $data['decrypt'] = 'PASSED'
        $data['archiveCheck'] = 'PASSED'
    }
    if ($Kind -ceq 'restore') { $data['restore'] = 'PASSED' }
    ConvertTo-Object $data
}

# --- Laboratorio en disco ---------------------------------------------------------------------------

function Set-LabAcl([string]$Path) {
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in (Get-OperatorSid), 'S-1-5-18') {
        $identity = [Security.Principal.SecurityIdentifier]::new($sid)
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
    }
    [IO.FileSystemAclExtensions]::SetAccessControl([IO.DirectoryInfo]::new($Path), $acl)
}

function Set-LabConstant([string]$Path, [string]$Pattern, [string]$Replacement) {
    $text = [IO.File]::ReadAllText($Path)
    Assert-Condition ([regex]::Matches($text, $Pattern).Count -eq 1) "constante no localizada exactamente una vez: $Pattern"
    $evaluator = [Text.RegularExpressions.MatchEvaluator] { param($match) $Replacement }
    [IO.File]::WriteAllText($Path, [regex]::Replace($text, $Pattern, $evaluator), $script:Utf8)
}

# Copia los scripts a una carpeta nueva. La sustitucion de constantes existe solo en esa copia.
function New-Lab([string]$LabRoot) {
    Assert-OutsideForbiddenRoots $LabRoot
    Assert-Condition (Test-Path -LiteralPath $LabRoot -PathType Container) 'LabRoot debe existir previamente'
    $run = Join-Path (Get-FullPath $LabRoot) "run-$([guid]::NewGuid().ToString('N').Substring(0, 12))"
    $null = New-Item -ItemType Directory -Path $run
    Set-LabAcl $run
    $lab = [ordered]@{ Run = $run }
    foreach ($name in 'scripts', 'trust', 'keys', 'staging', 'evidence', 'source', 'sets', 'tools') {
        $lab[$name] = Join-Path $run $name
        $null = New-Item -ItemType Directory -Path $lab[$name]
    }
    foreach ($file in Get-ChildItem -LiteralPath $script:ScriptsDir -File -Filter '*.ps1') {
        [IO.File]::Copy($file.FullName, (Join-Path $lab.scripts $file.Name), $false)
    }
    $common = Join-Path $lab.scripts 'Common.ps1'
    Set-LabConstant $common '(?m)^\$script:TrustRoot = [^\r\n]*' "`$script:TrustRoot = '$($lab.trust)'"
    Set-LabConstant $common '(?m)^\$script:TrustedWriterSids = @\(' "`$script:TrustedWriterSids = @('$(Get-OperatorSid)', "
    [pscustomobject]$lab
}

# --- Passphrase sintetica automatica ----------------------------------------------------------------
# age y ssh-keygen siguen leyendo de la consola: el arnes escribe las teclas cuando aparece cada pedido. La
# passphrase vive solo en memoria; no viaja por argumentos, entorno ni archivos. Usar una consola dedicada.

$script:LabPassphrase = ''

function Enable-LabAutoInput {
    if (-not ('Vetneb.LabConsole' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using Microsoft.Win32.SafeHandles;

namespace Vetneb {
    public static class LabConsole {
        [StructLayout(LayoutKind.Explicit, Size = 20)]
        struct InputRecord {
            [FieldOffset(0)] public ushort EventType;
            [FieldOffset(4)] public int KeyDown;
            [FieldOffset(8)] public ushort Repeat;
            [FieldOffset(10)] public ushort VirtualKey;
            [FieldOffset(14)] public ushort Character;
        }
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern SafeFileHandle CreateFileW(string name, uint access, uint share, IntPtr security, uint disposition, uint flags, IntPtr template);
        [StructLayout(LayoutKind.Sequential)]
        struct Coord { public short X, Y; }
        [StructLayout(LayoutKind.Sequential)]
        struct ScreenInfo {
            public Coord Size, Cursor;
            public ushort Attributes;
            public short Left, Top, Right, Bottom;
            public Coord Maximum;
        }
        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool GetConsoleScreenBufferInfo(SafeFileHandle handle, out ScreenInfo info);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern bool ReadConsoleOutputCharacterW(SafeFileHandle handle, [Out] char[] buffer, uint length, Coord start, out uint read);
        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool FlushConsoleInputBuffer(SafeFileHandle handle);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern bool WriteConsoleInputW(SafeFileHandle handle, InputRecord[] records, uint length, out uint written);

        static SafeFileHandle Open() {
            SafeFileHandle handle = CreateFileW("CONIN$", 0xC0000000, 0x3, IntPtr.Zero, 3, 0, IntPtr.Zero);
            if (handle.IsInvalid) { throw new Win32Exception(); }
            return handle;
        }
        public static void Flush() {
            using (SafeFileHandle handle = Open()) {
                if (!FlushConsoleInputBuffer(handle)) { throw new Win32Exception(); }
            }
        }
        static void Type(string line) {
            string text = line + "\r";
            InputRecord[] records = new InputRecord[text.Length * 2];
            for (int i = 0; i < records.Length; i++) {
                char c = text[i / 2];
                records[i].EventType = 1;
                records[i].KeyDown = i % 2 == 0 ? 1 : 0;
                records[i].Repeat = 1;
                records[i].VirtualKey = (ushort)(c == '\r' ? 0x0D : 0);
                records[i].Character = c;
            }
            using (SafeFileHandle handle = Open()) {
                uint written;
                if (!WriteConsoleInputW(handle, records, (uint)records.Length, out written) || written != records.Length) {
                    throw new Win32Exception();
                }
            }
            Array.Clear(records, 0, records.Length);
        }

        // Pedido pendiente: el cursor queda despues de "...passphrase...:" (puede ocupar varias filas).
        static string Prompt() {
            using (SafeFileHandle handle = CreateFileW("CONOUT$", 0xC0000000, 0x3, IntPtr.Zero, 3, 0, IntPtr.Zero)) {
                ScreenInfo info;
                if (handle.IsInvalid || !GetConsoleScreenBufferInfo(handle, out info)) { throw new Win32Exception(); }
                if (info.Cursor.X == 0) { return null; }
                StringBuilder text = new StringBuilder();
                for (int row = Math.Max(0, info.Cursor.Y - 2); row <= info.Cursor.Y; row++) {
                    int length = row == info.Cursor.Y ? info.Cursor.X : info.Size.X;
                    char[] cells = new char[length];
                    uint read;
                    Coord start = new Coord { X = 0, Y = (short)row };
                    if (!ReadConsoleOutputCharacterW(handle, cells, (uint)length, start, out read)) { throw new Win32Exception(); }
                    text.Append(cells, 0, (int)read);
                }
                string line = text.ToString().TrimEnd();
                if (!line.EndsWith(":") || line.IndexOf("passphrase", StringComparison.OrdinalIgnoreCase) < 0) { return null; }
                return info.Cursor.Y + "|" + info.Cursor.X + "|" + line;
            }
        }

        static volatile bool running;
        static Thread worker;
        static string failure;

        // ssh-keygen descarta lo escrito antes de su pedido: se responde cuando el pedido ya esta en pantalla.
        public static void Answer(string line) {
            Stop();
            Flush();
            running = true;
            failure = null;
            worker = new Thread(() => {
                try {
                    string answered = null;
                    int count = 0;
                    Stopwatch since = Stopwatch.StartNew();
                    while (running) {
                        Thread.Sleep(100);
                        string prompt = Prompt();
                        if (prompt == null) { answered = null; continue; }
                        if (prompt == answered && since.ElapsedMilliseconds < 3000) { continue; }
                        Thread.Sleep(400);
                        if (!running || Prompt() != prompt) { continue; }
                        if (++count > 20) { failure = "demasiados pedidos de passphrase"; return; }
                        Type(line);
                        answered = prompt;
                        since.Restart();
                    }
                }
                catch (Exception error) { failure = error.Message; }
            });
            worker.IsBackground = true;
            worker.Start();
        }

        // Detiene las respuestas y descarta lo que no se haya consumido.
        public static string Stop() {
            running = false;
            if (worker == null) { return null; }
            worker.Join();
            worker = null;
            Flush();
            return failure;
        }
    }
}
'@
    }
    $script:LabPassphrase = New-LabPassphrase
}

function New-LabPassphrase { [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24)) }

# Responde los pedidos del proximo programa hasta Clear-LabInput.
function Set-LabInput([string]$Passphrase = $script:LabPassphrase) {
    if ($script:LabPassphrase) { [Vetneb.LabConsole]::Answer($Passphrase) }
}

function Clear-LabInput {
    if (-not $script:LabPassphrase) { return }
    $failure = [Vetneb.LabConsole]::Stop()
    Assert-Condition (-not $failure) "entrada automatica: $failure"
}

# ssh-keygen de Windows agrega a Administrators en la clave privada y Assert-SecretAcl lo rechaza.
function Set-LabKeyAcl([string]$Path) {
    $acl = [Security.AccessControl.FileSecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in (Get-OperatorSid), 'S-1-5-18') {
        $identity = [Security.Principal.SecurityIdentifier]::new($sid)
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl', 'Allow'))
    }
    [IO.FileSystemAclExtensions]::SetAccessControl([IO.FileInfo]::new($Path), $acl)
}

# Sin -Interactive crea claves desechables SIN passphrase, validas solo para probar verificadores.
function New-LabKey([string]$Path, [switch]$Interactive) {
    $options = @('-q', '-t', 'ed25519', '-C', 'lab', '-f', $Path)
    if (-not $Interactive) { $options += @('-N', '') }
    if ($Interactive) { Set-LabInput }
    try { & $script:SshKeygen @options }
    finally { if ($Interactive) { Clear-LabInput } }
    Assert-Condition ($LASTEXITCODE -eq 0) 'ssh-keygen fallo'
    Set-LabKeyAcl $Path
}

function Get-LabPublicKey([string]$Path) {
    $parts = [IO.File]::ReadAllText("$Path.pub").Trim() -split ' '
    "$($parts[0]) $($parts[1])"
}

function Add-LabSignature([string]$File, [string]$Key, [string]$Namespace) {
    # Las claves sin passphrase de la suite automatica ignoran la entrada preparada.
    Set-LabInput
    try { & $script:SshKeygen -q -Y sign -f $Key -n $Namespace $File }
    finally { Clear-LabInput }
    Assert-Condition ($LASTEXITCODE -eq 0) 'firma de laboratorio fallida'
}

# Escribe allowed_signers, revoked_keys y la politica, y fija el pin en la copia instalada.
function Install-LabTrust($Lab, $Policy, [hashtable]$Keys, [string[]]$RevokedKeys = @()) {
    $lines = foreach ($principal in $Keys.Keys) {
        $namespace = 'vetneb-evidence'
        if ($principal -ceq 'vetneb-backup') { $namespace = 'vetneb-backup' }
        "$principal namespaces=`"$namespace`" $(Get-LabPublicKey $Keys[$principal])"
    }
    $signers = Join-Path $Lab.trust 'allowed_signers'
    $revoked = Join-Path $Lab.trust 'revoked_keys'
    [IO.File]::WriteAllText($signers, (($lines -join "`n") + "`n"), $script:Utf8)
    [IO.File]::WriteAllText($revoked, (($RevokedKeys | ForEach-Object { "$_`n" }) -join ''), $script:Utf8)
    $Policy | Add-Member -NotePropertyName allowedSignersSha256 -NotePropertyValue (Get-Sha256Hex $signers) -Force
    $Policy | Add-Member -NotePropertyName revokedKeysSha256 -NotePropertyValue (Get-Sha256Hex $revoked) -Force
    $path = Join-Path $Lab.trust 'trust-policy.json'
    [IO.File]::WriteAllText($path, ($Policy | ConvertTo-Json -Depth 8), $script:Utf8)
    $pin = Get-Sha256Hex $path
    $common = Join-Path $Lab.scripts 'Common.ps1'
    Set-LabConstant $common '(?m)^\$script:TrustPolicySha256 = [^\r\n]*' "`$script:TrustPolicySha256 = '$pin'"
    [pscustomobject]@{ Policy = $Policy; PolicySha256 = $pin; AllowedSigners = $signers; RevokedKeys = $revoked }
}

# Inventario de binarios de una instalacion local. Es confianza en el primer uso: no acredita procedencia.
function Get-LabToolEntry([string]$Directory, [string[]]$Scan) {
    $files = [ordered]@{}
    foreach ($folder in $Scan) {
        foreach ($file in Get-ChildItem -LiteralPath (Join-Path $Directory $folder) -Recurse -File -Force | Where-Object { $_.Extension -in '.exe', '.dll' }) {
            $files[[IO.Path]::GetRelativePath($Directory, $file.FullName)] = Get-Sha256Hex $file.FullName
        }
    }
    @{ directory = $Directory; scan = $Scan; files = $files }
}
