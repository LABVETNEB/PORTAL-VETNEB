#Requires -Version 7.4
# Funciones compartidas del cifrado de respaldos. Estado: no certificado; no apto para produccion.
# Ningun script elimina ni sobrescribe archivos: ante un fallo quedan parciales que revisa una persona.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:AgeVersion = 'v1.3.2'
$script:SignNamespace = 'vetneb-backup'
$script:EvidenceNamespace = 'vetneb-evidence'
$script:RecipientPattern = '^age1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{58}$'
$script:SshKeygen = 'C:\Windows\System32\OpenSSH\ssh-keygen.exe'
$script:ForbiddenRoots = @('C:\PORTAL-VETNEB', 'C:\VETNEB-BACKUPS')

# Raiz de confianza: carpeta y pin viven fuera de todo conjunto y solo un administrador puede escribirlos.
# El pin se completa en la copia INSTALADA como cambio revisado. Vacio = falla cerrado.
$script:TrustRoot = 'C:\ProgramData\VETNEB-H02\trust'
$script:TrustPolicySha256 = ''
# SYSTEM, Administrators y TrustedInstaller.
$script:TrustedWriterSids = @('S-1-5-18', 'S-1-5-32-544', 'S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464')

$script:Held = [Collections.Generic.List[IDisposable]]::new()
$script:HeldDirectories = @{}
$script:TrustedTools = @{}

function Assert-Condition([bool]$Condition, [string]$Reason) {
    if (-not $Condition) { throw "SUSPENDIDO: $Reason" }
}

function Get-FullPath([string]$Path) {
    $full = [IO.Path]::GetFullPath($Path, (Get-Location).ProviderPath)
    [IO.Path]::TrimEndingDirectorySeparator($full)
}

# Comprobacion previa de forma. La garantia frente a carreras la dan los handles de Open-Held*.
function Assert-LocalPlainPath([string]$Path) {
    $full = Get-FullPath $Path
    Assert-Condition ($full -match '^[A-Za-z]:\\') "se exige una ruta local con letra de unidad: $full"
    Assert-Condition ($full -notmatch '~\d') "no se admiten nombres cortos 8.3: $full"
    $current = $full
    while ($current) {
        if (Test-Path -LiteralPath $current) {
            $item = Get-Item -LiteralPath $current -Force
            Assert-Condition (-not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) "enlace o reparse point: $current"
        }
        $current = [IO.Path]::GetDirectoryName($current)
    }
}

function Test-PathInside([string]$Path, [string]$Root) {
    $p = (Get-FullPath $Path).TrimEnd('\') + '\'
    $r = (Get-FullPath $Root).TrimEnd('\') + '\'
    $p.StartsWith($r, [StringComparison]::OrdinalIgnoreCase)
}

function Assert-OutsideForbiddenRoots([string]$Path) {
    Assert-LocalPlainPath $Path
    foreach ($root in $script:ForbiddenRoots) {
        Assert-Condition (-not (Test-PathInside $Path $root)) "destino dentro de una raiz prohibida: $root"
    }
    $current = Get-FullPath $Path
    while ($current) {
        Assert-Condition (-not (Test-Path -LiteralPath (Join-Path $current '.git'))) "destino dentro de un arbol Git: $current"
        $current = [IO.Path]::GetDirectoryName($current)
    }
}

# Disco fisico que respalda una ruta. Falla cerrado si no puede determinarse (red, subst, sin permiso).
function Get-DiskNumber([string]$Path) {
    Assert-LocalPlainPath $Path
    $letter = (Get-FullPath $Path).Substring(0, 1)
    $partition = @(Get-Partition -DriveLetter $letter -ErrorAction Stop)
    Assert-Condition ($partition.Count -eq 1) "no se pudo determinar el disco de $Path"
    $partition[0].DiskNumber
}

function Assert-FreeSpace([string]$Path, [long]$Bytes) {
    $drive = [IO.DriveInfo]::new([IO.Path]::GetPathRoot((Get-FullPath $Path)))
    Assert-Condition ($drive.AvailableFreeSpace -ge ($Bytes + 64MB)) "espacio insuficiente en $($drive.Name)"
}

function Get-Sha256Hex([string]$Path) {
    (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}

function Get-BytesSha256([byte[]]$Bytes) {
    [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($Bytes))
}

function Get-UnixNow { [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() }

# Escritura simple sin sobrescritura (inventario). Los artefactos de un conjunto usan Publish-HeldBytes.
function Write-NewTextFile([string]$Path, [string]$Text) {
    $stream = [IO.FileStream]::new((Get-FullPath $Path), [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try {
        $bytes = [Text.UTF8Encoding]::new($false).GetBytes($Text)
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Flush($true)
    }
    finally { $stream.Dispose() }
}

function Initialize-Native {
    if ('Vetneb.Native' -as [type]) { return }
    Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Win32.SafeHandles;

namespace Vetneb {
    [StructLayout(LayoutKind.Sequential)]
    public struct HandleInfo {
        public uint Attributes, CreationLow, CreationHigh, AccessLow, AccessHigh, WriteLow, WriteHigh;
        public uint VolumeSerial, SizeHigh, SizeLow, Links, IndexHigh, IndexLow;
    }

    public static class Native {
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern SafeFileHandle CreateFileW(string name, uint access, uint share, IntPtr security, uint disposition, uint flags, IntPtr template);
        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool GetFileInformationByHandle(SafeFileHandle handle, out HandleInfo info);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        static extern uint GetFinalPathNameByHandleW(SafeFileHandle handle, StringBuilder buffer, uint length, uint flags);

        static SafeFileHandle Open(string path, uint access, uint share, uint disposition, uint flags) {
            SafeFileHandle handle = CreateFileW(path, access, share, IntPtr.Zero, disposition, flags, IntPtr.Zero);
            if (handle.IsInvalid) {
                int code = Marshal.GetLastWin32Error();
                handle.Dispose();
                throw new IOException("CreateFileW " + code + ": " + path);
            }
            return handle;
        }
        // Directorio: LIST_DIRECTORY participa en el control de comparticion; sin FILE_SHARE_DELETE.
        public static SafeFileHandle OpenDirectory(string path) { return Open(path, 0x81, 0x3, 3, 0x02200000); }
        // Archivo: lectura, otros solo pueden leer; no sigue reparse points.
        public static SafeFileHandle OpenRead(string path) { return Open(path, 0x80000000, 0x1, 3, 0x00200000); }
        // Archivo nuevo: acceso exclusivo; falla si ya existe.
        public static SafeFileHandle CreateExclusive(string path) { return Open(path, 0xC0000000, 0x0, 1, 0x00200000); }

        public static HandleInfo Describe(SafeFileHandle handle) {
            HandleInfo info;
            if (!GetFileInformationByHandle(handle, out info)) { throw new IOException("GetFileInformationByHandle"); }
            return info;
        }
        public static string FinalPath(SafeFileHandle handle) {
            StringBuilder buffer = new StringBuilder(32768);
            uint length = GetFinalPathNameByHandleW(handle, buffer, (uint)buffer.Capacity, 0);
            if (length == 0 || length >= buffer.Capacity) { throw new IOException("GetFinalPathNameByHandleW"); }
            return buffer.ToString();
        }
    }

    public sealed class PumpResult {
        public long Bytes;
        public string Sha256;
        public bool Broken;
    }

    // Copia un flujo y calcula el SHA-256 de exactamente los bytes leidos.
    public static class Pump {
        public static Task<PumpResult> Start(Stream source, Stream target, bool closeTarget) {
            return Task.Factory.StartNew(() => Run(source, target, closeTarget), TaskCreationOptions.LongRunning);
        }
        static PumpResult Run(Stream source, Stream target, bool closeTarget) {
            PumpResult result = new PumpResult();
            byte[] buffer = new byte[65536];
            using (IncrementalHash hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256)) {
                try {
                    int read;
                    while ((read = source.Read(buffer, 0, buffer.Length)) > 0) {
                        hash.AppendData(buffer, 0, read);
                        result.Bytes += read;
                        if (!result.Broken) {
                            // Si el consumidor muere se sigue drenando para no bloquear al productor.
                            try { target.Write(buffer, 0, read); }
                            catch (Exception) { result.Broken = true; }
                        }
                    }
                }
                catch (Exception) { result.Broken = true; }
                finally {
                    Array.Clear(buffer, 0, buffer.Length);
                    if (closeTarget) {
                        try { target.Dispose(); }
                        catch (Exception) { result.Broken = true; }
                    }
                }
                result.Sha256 = Convert.ToHexString(hash.GetHashAndReset());
            }
            return result;
        }
    }
}
'@
}

# --- Handles retenidos ------------------------------------------------------------------------------

function Assert-HeldHandle($Handle, [string]$Full, [bool]$Directory, [bool]$AllowHardLinks) {
    $info = [Vetneb.Native]::Describe($Handle)
    Assert-Condition (-not ($info.Attributes -band 0x400)) "reparse point: $Full"
    Assert-Condition ([bool]($info.Attributes -band 0x10) -eq $Directory) "tipo de objeto inesperado: $Full"
    if (-not $Directory -and -not $AllowHardLinks) {
        Assert-Condition ($info.Links -eq 1) "enlace duro no admitido: $Full"
    }
    Assert-Condition ([Vetneb.Native]::FinalPath($Handle) -ieq "\\?\$Full") "la ruta no resuelve a si misma: $Full"
}

# Retiene la raiz y cada ancestro: no pueden renombrarse, borrarse ni convertirse en junction.
function Open-HeldDirectory([string]$Path) {
    Initialize-Native
    Assert-LocalPlainPath $Path
    $full = Get-FullPath $Path
    $drive = [IO.DriveInfo]::new([IO.Path]::GetPathRoot($full))
    Assert-Condition ($drive.DriveType -in 'Fixed', 'Removable' -and $drive.DriveFormat -eq 'NTFS') "se exige NTFS en disco local: $full"
    $chain = [Collections.Generic.List[string]]::new()
    $current = $full
    while ($current) {
        $chain.Insert(0, $current)
        $current = [IO.Path]::GetDirectoryName($current)
    }
    foreach ($directory in $chain) {
        if ($script:HeldDirectories.ContainsKey($directory)) { continue }
        $handle = [Vetneb.Native]::OpenDirectory($directory)
        $script:Held.Add($handle)
        Assert-HeldHandle $handle $directory $true $false
        $script:HeldDirectories[$directory] = $true
    }
}

function Open-HeldFile([string]$Path, [switch]$AllowHardLinks) {
    $full = Get-FullPath $Path
    Open-HeldDirectory ([IO.Path]::GetDirectoryName($full))
    $handle = [Vetneb.Native]::OpenRead($full)
    $script:Held.Add($handle)
    Assert-HeldHandle $handle $full $false ([bool]$AllowHardLinks)
    $stream = [IO.FileStream]::new($handle, [IO.FileAccess]::Read)
    $script:Held.Add($stream)
    $stream
}

function New-HeldFile([string]$Path) {
    $full = Get-FullPath $Path
    Open-HeldDirectory ([IO.Path]::GetDirectoryName($full))
    $handle = [Vetneb.Native]::CreateExclusive($full)
    $script:Held.Add($handle)
    Assert-HeldHandle $handle $full $false $false
    $stream = [IO.FileStream]::new($handle, [IO.FileAccess]::ReadWrite)
    $script:Held.Add($stream)
    $stream
}

function Get-StreamSha256([IO.Stream]$Stream) {
    $Stream.Position = 0
    $hex = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($Stream))
    $Stream.Position = 0
    $hex
}

function Read-HeldBytes([IO.Stream]$Stream, [int]$Limit = 1MB) {
    Assert-Condition ($Stream.Length -le $Limit) 'archivo de control demasiado grande'
    $bytes = [byte[]]::new($Stream.Length)
    $Stream.Position = 0
    $Stream.ReadExactly($bytes, 0, $bytes.Length)
    $Stream.Position = 0
    , $bytes
}

# Crea, fuerza a disco y reabre en solo lectura comprobando el contenido sobre el handle que queda retenido.
function Publish-HeldBytes([string]$Path, [byte[]]$Bytes) {
    $writer = New-HeldFile $Path
    $writer.Write($Bytes, 0, $Bytes.Length)
    $writer.Flush($true)
    $writer.Dispose()
    $reader = Open-HeldFile $Path
    Assert-Condition ((Get-StreamSha256 $reader) -eq (Get-BytesSha256 $Bytes)) "contenido alterado al publicar: $Path"
    $reader
}

function Close-HeldHandles {
    for ($index = $script:Held.Count - 1; $index -ge 0; $index--) { $script:Held[$index].Dispose() }
    $script:Held.Clear()
    $script:HeldDirectories.Clear()
    $script:TrustedTools.Clear()
}

# --- ACL --------------------------------------------------------------------------------------------

function Get-OperatorSid { [Security.Principal.WindowsIdentity]::GetCurrent().User.Value }

# Falla si el propietario no es de confianza o si otro principal tiene alguno de los permisos de la mascara.
function Assert-AclMask([string]$Path, [string[]]$Owners, [string[]]$Trusted, [long]$Mask) {
    $acl = Get-Acl -LiteralPath $Path
    Assert-Condition ($acl.GetSecurityDescriptorSddlForm('Access') -notmatch 'NO_ACCESS_CONTROL') "DACL nula: $Path"
    $owner = $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
    Assert-Condition ($Owners -contains $owner) "propietario no confiable en $Path ($owner)"
    foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
        if ($rule.AccessControlType -ne 'Allow') { continue }
        if ($rule.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly) { continue }
        if ($Trusted -contains $rule.IdentityReference.Value) { continue }
        Assert-Condition (([long][int]$rule.FileSystemRights -band $Mask) -eq 0) "ACL no restringida en $Path ($($rule.IdentityReference.Value))"
    }
}

function Assert-AncestorAcl([string]$Path, [string[]]$Trusted) {
    # DeleteSubdirectoriesAndFiles, Delete, ChangePermissions, TakeOwnership y GENERIC_ALL.
    $mask = [long]0x100D0040
    $current = [IO.Path]::GetDirectoryName((Get-FullPath $Path))
    while ($current) {
        Assert-AclMask $current $Trusted $Trusted $mask
        $current = [IO.Path]::GetDirectoryName($current)
    }
}

# Secretos y datos: solo el operador y SYSTEM tienen acceso.
function Assert-SecretAcl([string]$Path) {
    $operator = Get-OperatorSid
    $full = Get-FullPath $Path
    Assert-AclMask $full (@($operator) + $script:TrustedWriterSids) @($operator, 'S-1-5-18') ([long]-1)
    Assert-AncestorAcl $full (@($operator) + $script:TrustedWriterSids)
}

# Codigo y confianza: solo administradores pueden escribir.
function Assert-AdminAcl([string]$Path) {
    # Toda forma de escritura, borrado o cambio de permisos, incluidos los derechos genericos.
    $mask = [long]0x500D0156
    $full = Get-FullPath $Path
    Assert-AclMask $full $script:TrustedWriterSids $script:TrustedWriterSids $mask
    Assert-AncestorAcl $full $script:TrustedWriterSids
}

# --- Procesos ---------------------------------------------------------------------------------------

# Entorno minimo: sin PG*, SSH_ASKPASS ni PATH heredado.
function New-StartInfo([string]$Exe, [string[]]$Arguments, [hashtable]$Environment = @{}) {
    $info = [Diagnostics.ProcessStartInfo]::new($Exe)
    foreach ($argument in $Arguments) { $info.ArgumentList.Add($argument) }
    $info.UseShellExecute = $false
    $windows = [Environment]::GetFolderPath('Windows')
    $system = [Environment]::SystemDirectory
    $info.WorkingDirectory = $system
    $info.Environment.Clear()
    $base = @{
        SystemRoot = $windows; windir = $windows; SystemDrive = $windows.Substring(0, 2); PATH = $system
        ComSpec = (Join-Path $system 'cmd.exe'); TEMP = [IO.Path]::GetTempPath(); TMP = [IO.Path]::GetTempPath()
        USERPROFILE = [Environment]::GetFolderPath('UserProfile'); ProgramData = [Environment]::GetFolderPath('CommonApplicationData')
    }
    foreach ($key in $base.Keys) { $info.Environment[$key] = $base[$key] }
    foreach ($key in $Environment.Keys) { $info.Environment[$key] = $Environment[$key] }
    $info
}

function New-Stage([string]$Exe, [string[]]$Arguments, [hashtable]$Environment = @{}, [switch]$Quiet) {
    [pscustomobject]@{ Exe = $Exe; Arguments = $Arguments; Environment = $Environment; Quiet = [bool]$Quiet }
}

# Entrada -> etapa 1 -> ... -> etapa N -> salida. Links[0] resume la entrada; Links[k], la salida de la etapa k.
function Invoke-Chain([object[]]$Stages, [IO.Stream]$InputStream, [IO.Stream]$OutputStream) {
    Initialize-Native
    $processes = [Collections.Generic.List[Diagnostics.Process]]::new()
    $pumps = [object[]]::new($Stages.Count + 1)
    $errors = [Collections.Generic.List[object]]::new()
    try {
        for ($index = 0; $index -lt $Stages.Count; $index++) {
            $stage = $Stages[$index]
            $info = New-StartInfo $stage.Exe $stage.Arguments $stage.Environment
            $info.RedirectStandardOutput = $true
            $info.RedirectStandardInput = ($index -gt 0 -or $null -ne $InputStream)
            $info.RedirectStandardError = $stage.Quiet
            $process = [Diagnostics.Process]::Start($info)
            $processes.Add($process)
            # stderr silenciado se drena sin imprimirlo: puede contener datos.
            if ($stage.Quiet) { $errors.Add([Vetneb.Pump]::Start($process.StandardError.BaseStream, [IO.Stream]::Null, $false)) }
        }
        if ($null -ne $InputStream) { $pumps[0] = [Vetneb.Pump]::Start($InputStream, $processes[0].StandardInput.BaseStream, $true) }
        for ($index = 1; $index -lt $Stages.Count; $index++) {
            $pumps[$index] = [Vetneb.Pump]::Start($processes[$index - 1].StandardOutput.BaseStream, $processes[$index].StandardInput.BaseStream, $true)
        }
        $sink = $OutputStream ?? [IO.Stream]::Null
        $pumps[$Stages.Count] = [Vetneb.Pump]::Start($processes[$Stages.Count - 1].StandardOutput.BaseStream, $sink, $false)
        foreach ($process in $processes) { $process.WaitForExit() }
        $links = [object[]]::new($pumps.Count)
        for ($index = 0; $index -lt $pumps.Count; $index++) {
            if ($null -ne $pumps[$index]) { $links[$index] = $pumps[$index].GetAwaiter().GetResult() }
        }
        foreach ($task in $errors) { $null = $task.GetAwaiter().GetResult() }
        [pscustomobject]@{
            ExitCodes = @($processes | ForEach-Object { $_.ExitCode })
            Links     = $links
            Broken    = [bool]@($links | Where-Object { $null -ne $_ -and $_.Broken }).Count
        }
    }
    finally {
        foreach ($process in $processes) {
            if (-not $process.HasExited) { $process.Kill() }
            $process.Dispose()
        }
    }
}

function Assert-ChainOk($Result, [string]$What) {
    $failed = @($Result.ExitCodes | Where-Object { $_ -ne 0 })
    Assert-Condition ($failed.Count -eq 0 -and -not $Result.Broken) "$What fallo (codigos=$($Result.ExitCodes -join ',') tuberiaRota=$($Result.Broken))"
}

# Proceso unido a la consola (passphrase interactiva). Devuelve el codigo de salida.
function Invoke-Tool([string]$Exe, [string[]]$Arguments, [hashtable]$Environment = @{}) {
    $process = [Diagnostics.Process]::Start((New-StartInfo $Exe $Arguments $Environment))
    try {
        $process.WaitForExit()
        $process.ExitCode
    }
    finally {
        if (-not $process.HasExited) { $process.Kill() }
        $process.Dispose()
    }
}

# Verificador SCRAM-SHA-256 de PostgreSQL: la contrasena en claro no necesita viajar en ninguna sentencia.
# La contrasena debe ser ASCII (no se aplica SASLprep). El verificador tambien es sensible.
function New-ScramVerifier([string]$Password, [byte[]]$Salt = [Security.Cryptography.RandomNumberGenerator]::GetBytes(16), [int]$Iterations = 4096) {
    Assert-Condition ($Password -cmatch '^[\x21-\x7E]+$') 'contrasena no admitida para SCRAM'
    $bytes = [Text.Encoding]::ASCII.GetBytes($Password)
    $salted = $null
    try {
        $salted = [Security.Cryptography.Rfc2898DeriveBytes]::Pbkdf2($bytes, $Salt, $Iterations, [Security.Cryptography.HashAlgorithmName]::SHA256, 32)
        $client = [Security.Cryptography.HMACSHA256]::HashData($salted, [Text.Encoding]::ASCII.GetBytes('Client Key'))
        $stored = [Security.Cryptography.SHA256]::HashData($client)
        $server = [Security.Cryptography.HMACSHA256]::HashData($salted, [Text.Encoding]::ASCII.GetBytes('Server Key'))
        [Array]::Clear($client, 0, $client.Length)
        'SCRAM-SHA-256${0}:{1}${2}:{3}' -f $Iterations, [Convert]::ToBase64String($Salt), [Convert]::ToBase64String($stored), [Convert]::ToBase64String($server)
    }
    finally {
        [Array]::Clear($bytes, 0, $bytes.Length)
        if ($salted) { [Array]::Clear($salted, 0, $salted.Length) }
    }
}

# --- Politica de confianza --------------------------------------------------------------------------

# Validacion pura: roles, destinatarios nativos distintos y claves de firma distintas entre principales.
function Assert-PolicyRoles($Policy, [string[]]$SignerLines) {
    Assert-Condition (@($Policy.recipients.PSObject.Properties).Count -eq 2) 'la politica admite exactamente dos destinatarios'
    $primary = [string]$Policy.recipients.primary
    $recovery = [string]$Policy.recipients.recovery
    foreach ($recipient in $primary, $recovery) {
        Assert-Condition ($recipient -cmatch $script:RecipientPattern) 'destinatario no admitido: solo X25519 nativo'
    }
    Assert-Condition ($primary -cne $recovery) 'los destinatarios primario y de recuperacion deben ser distintos'
    Assert-Condition (-not [string]::IsNullOrWhiteSpace($Policy.productionComputer)) 'falta el equipo productivo'
    $entries = @($Policy.evidenceSigners)
    Assert-Condition ($entries.Count -eq 3) 'se exigen tres firmantes de evidencia: primary, recovery y restore'
    foreach ($role in 'primary', 'recovery', 'restore') {
        $match = @($entries | Where-Object { $_.role -ceq $role })
        Assert-Condition ($match.Count -eq 1 -and -not [string]::IsNullOrWhiteSpace($match[0].computer)) "firmante de evidencia invalido: $role"
        if ($role -ceq 'recovery') {
            Assert-Condition ($match[0].computer -ine $Policy.productionComputer) 'la recuperacion debe ocurrir en otro equipo'
        }
    }
    $expected = @{ ([string]$Policy.backupSigner) = $script:SignNamespace }
    foreach ($entry in $entries) {
        Assert-Condition (-not $expected.ContainsKey([string]$entry.principal)) 'principal repetido entre firmantes'
        $expected[[string]$entry.principal] = $script:EvidenceNamespace
    }
    $keys = @{}
    $seen = @{}
    foreach ($line in @($SignerLines | Where-Object { $_.Trim() -and -not $_.StartsWith('#') })) {
        Assert-Condition ($line -cmatch '^([a-z0-9-]+) namespaces="([a-z0-9-]+)"(?: valid-after="[0-9Z]+")?(?: valid-before="[0-9Z]+")? ssh-ed25519 ([A-Za-z0-9+/=]+)(?: .*)?$') 'linea no admitida en allowed_signers'
        $principal = $Matches[1]
        $namespace = $Matches[2]
        $key = $Matches[3]
        Assert-Condition ($expected.ContainsKey($principal) -and $expected[$principal] -ceq $namespace) "principal o namespace no declarado: $principal"
        Assert-Condition (-not $seen.ContainsKey($principal)) "principal con mas de una clave: $principal"
        Assert-Condition (-not $keys.ContainsKey($key)) 'la misma clave de firma figura en dos roles'
        $seen[$principal] = $true
        $keys[$key] = $true
    }
    Assert-Condition ($seen.Count -eq $expected.Count) 'faltan firmantes en allowed_signers'
}

# -ToolsOnly sirve para generar identidades antes de que existan destinatarios y firmantes.
function Get-TrustContext([switch]$ToolsOnly) {
    Assert-Condition ($script:TrustPolicySha256 -match '^[0-9A-Fa-f]{64}$') 'pin de la politica de confianza vacio o parcial'
    Open-HeldDirectory $PSScriptRoot
    Assert-AdminAcl $PSScriptRoot
    foreach ($file in Get-ChildItem -LiteralPath $PSScriptRoot -File -Force -Filter '*.ps1') {
        $null = Open-HeldFile $file.FullName
        Assert-AdminAcl $file.FullName
    }
    Open-HeldDirectory $script:TrustRoot
    Assert-AdminAcl $script:TrustRoot
    $policyPath = Join-Path $script:TrustRoot 'trust-policy.json'
    $stream = Open-HeldFile $policyPath
    Assert-AdminAcl $policyPath
    $bytes = Read-HeldBytes $stream
    Assert-Condition ((Get-BytesSha256 $bytes) -eq $script:TrustPolicySha256) 'la politica de confianza no coincide con su pin'
    $policy = [Text.Encoding]::UTF8.GetString($bytes).TrimStart([char]0xFEFF) | ConvertFrom-Json
    Assert-Condition ($policy.schema -eq 1 -and $policy.epoch -ge 1) 'esquema o epoca de politica no admitidos'
    $trust = [pscustomobject]@{
        Policy         = $policy
        PolicySha256   = $script:TrustPolicySha256.ToUpperInvariant()
        AllowedSigners = Join-Path $script:TrustRoot 'allowed_signers'
        RevokedKeys    = Join-Path $script:TrustRoot 'revoked_keys'
    }
    if ($ToolsOnly) { return $trust }
    $pins = @{ $trust.AllowedSigners = $policy.allowedSignersSha256; $trust.RevokedKeys = $policy.revokedKeysSha256 }
    $signerLines = @()
    foreach ($path in $pins.Keys) {
        $held = Open-HeldFile $path
        Assert-AdminAcl $path
        $content = Read-HeldBytes $held
        Assert-Condition ((Get-BytesSha256 $content) -eq $pins[$path]) "archivo de confianza alterado: $path"
        if ($path -eq $trust.AllowedSigners) { $signerLines = [Text.Encoding]::UTF8.GetString($content) -split "`r?`n" }
    }
    Assert-PolicyRoles $policy $signerLines
    $trust
}

# Exige el conjunto exacto de .exe y .dll aprobados, con ACL administrativa, y los retiene.
function Open-TrustedTool($Trust, [string]$Tool, [string]$RelativePath) {
    if (-not $script:TrustedTools.ContainsKey($Tool)) {
        $entry = $Trust.Policy.tools.$Tool
        $root = Get-FullPath $entry.directory
        Open-HeldDirectory $root
        Assert-AdminAcl $root
        $approved = @{}
        foreach ($property in $entry.files.PSObject.Properties) { $approved[$property.Name] = [string]$property.Value }
        $found = @{}
        foreach ($scan in @($entry.scan)) {
            $folder = Get-FullPath (Join-Path $root $scan)
            foreach ($file in Get-ChildItem -LiteralPath $folder -Recurse -File -Force | Where-Object { $_.Extension -in '.exe', '.dll' }) {
                $relative = [IO.Path]::GetRelativePath($root, $file.FullName)
                Assert-Condition ($approved.ContainsKey($relative)) "binario no declarado en la politica: $relative"
                $stream = Open-HeldFile $file.FullName
                Assert-AdminAcl $file.FullName
                Assert-AdminAcl $file.DirectoryName
                Assert-Condition ((Get-StreamSha256 $stream) -eq $approved[$relative]) "binario no aprobado: $relative"
                $found[$relative] = $file.FullName
            }
        }
        Assert-Condition ($approved.Count -gt 0 -and $found.Count -eq $approved.Count) "faltan binarios aprobados de $Tool"
        $script:TrustedTools[$Tool] = $found
    }
    Assert-Condition ($script:TrustedTools[$Tool].ContainsKey($RelativePath)) "binario no aprobado: $RelativePath"
    $script:TrustedTools[$Tool][$RelativePath]
}

function Open-TrustedAge($Trust, [string]$Name) {
    $exe = Open-TrustedTool $Trust 'age' $Name
    $output = [IO.MemoryStream]::new()
    $result = Invoke-Chain @(New-Stage $exe @('--version')) $null $output
    Assert-ChainOk $result "$Name --version"
    Assert-Condition ([Text.Encoding]::ASCII.GetString($output.ToArray()).Trim() -ceq $script:AgeVersion) "version no aprobada de $Name"
    $exe
}

function Open-TrustedPostgres($Trust, [string]$Name) {
    $exe = Open-TrustedTool $Trust 'postgres' "bin\$Name"
    $output = [IO.MemoryStream]::new()
    $result = Invoke-Chain @(New-Stage $exe @('--version')) $null $output
    Assert-ChainOk $result "$Name --version"
    Assert-Condition ([Text.Encoding]::ASCII.GetString($output.ToArray()).Trim() -cmatch '\) 17\.10$') "se exige PostgreSQL 17.10: $Name"
    $exe
}

# Binario del sistema: firma de Microsoft en lugar de un pin que cambia con cada actualizacion.
function Open-SshKeygen {
    $null = Open-HeldFile $script:SshKeygen -AllowHardLinks
    Assert-AdminAcl $script:SshKeygen
    $signature = Get-AuthenticodeSignature -LiteralPath $script:SshKeygen
    Assert-Condition ($signature.Status -eq 'Valid' -and $signature.IsOSBinary) 'ssh-keygen sin firma valida del sistema'
    $script:SshKeygen
}

# --- Firmas -----------------------------------------------------------------------------------------

# Los bytes verificados viajan por stdin: son exactamente los que el llamador va a interpretar.
function Test-DetachedSignature($Trust, [byte[]]$Content, [string]$SignaturePath, [string]$Principal, [string]$Namespace) {
    $exe = Open-SshKeygen
    $arguments = @('-Y', 'verify', '-f', $Trust.AllowedSigners, '-I', $Principal, '-n', $Namespace,
        '-s', (Get-FullPath $SignaturePath), '-r', $Trust.RevokedKeys)
    $result = Invoke-Chain @(New-Stage $exe $arguments -Quiet) ([IO.MemoryStream]::new($Content, $false)) $null
    ($result.ExitCodes[0] -eq 0) -and (-not $result.Broken)
}

# Lee solo la cabecera publica del formato OpenSSH para conocer el cifrado de la clave privada.
function Get-SshKeyCipher([byte[]]$Head) {
    $text = [Text.Encoding]::ASCII.GetString($Head)
    Assert-Condition ($text -cmatch '^-----BEGIN OPENSSH PRIVATE[ ]KEY-----\r?\n([A-Za-z0-9+/]{64})') 'formato de clave de firma no admitido'
    $data = [Convert]::FromBase64String($Matches[1])
    Assert-Condition ([Text.Encoding]::ASCII.GetString($data, 0, 14) -ceq 'openssh-key-v1' -and $data[14] -eq 0) 'cabecera de clave inesperada'
    $length = [int]$data[18]
    Assert-Condition ($data[15] -eq 0 -and $data[16] -eq 0 -and $data[17] -eq 0 -and $length -ge 1 -and $length -le 29) 'cabecera de clave inesperada'
    [Text.Encoding]::ASCII.GetString($data, 19, $length)
}

# Firma una copia retenida en StagingDir y comprueba la firma contra los bytes en memoria.
function New-DetachedSignature($Trust, [byte[]]$Content, [string]$KeyPath, [string]$Namespace, [string]$Principal, [string]$StagingDir) {
    $key = Open-HeldFile $KeyPath
    Assert-SecretAcl $KeyPath
    $head = [byte[]]::new(128)
    $count = $key.ReadAtLeast($head, $head.Length, $false)
    Assert-Condition ($count -eq $head.Length) 'clave de firma incompleta'
    Assert-Condition ((Get-SshKeyCipher $head) -cne 'none') 'la clave de firma no tiene passphrase'
    Assert-OutsideForbiddenRoots $StagingDir
    Open-HeldDirectory $StagingDir
    Assert-SecretAcl $StagingDir
    $file = Join-Path (Get-FullPath $StagingDir) "sign-$([guid]::NewGuid().ToString('N'))"
    $null = Publish-HeldBytes $file $Content
    $exe = Open-SshKeygen
    $code = Invoke-Tool $exe @('-Y', 'sign', '-f', (Get-FullPath $KeyPath), '-n', $Namespace, $file)
    Assert-Condition ($code -eq 0) "firma fallida (codigo=$code)"
    $signature = Open-HeldFile "$file.sig"
    Assert-Condition (Test-DetachedSignature $Trust $Content "$file.sig" $Principal $Namespace) 'la firma generada no verifica con la politica'
    , (Read-HeldBytes $signature)
}

# --- Conjuntos --------------------------------------------------------------------------------------

function Assert-CipherRecord($Record, $Policy, [string]$ExpectedPlainSha256) {
    Assert-Condition ($Record.schema -eq 2 -and $Record.setId -cmatch '^[0-9a-f]{32}$') 'registro de cifrado no admitido'
    Assert-Condition ($Record.dataClass -cin 'synthetic', 'production') 'clase de datos no declarada'
    Assert-Condition ($Record.cipherName -cmatch '^[^\\/:]+\.dump\.age$') 'nombre de cifrado no admitido'
    Assert-Condition ($Record.sourceSha256 -match '^[0-9A-F]{64}$' -and $Record.cipherSha256 -match '^[0-9A-F]{64}$') 'hashes ausentes en el registro'
    Assert-Condition ($Record.sourceBytes -gt 0) 'tamano de origen invalido'
    if ($ExpectedPlainSha256) {
        Assert-Condition ($Record.sourceSha256 -eq $ExpectedPlainSha256) 'el registro no coincide con el inventario independiente'
    }
    Assert-Condition ($Record.recipients.primary -ceq $Policy.recipients.primary -and $Record.recipients.recovery -ceq $Policy.recipients.recovery) 'destinatarios distintos de la politica'
    Assert-Condition ($Record.policyEpoch -ge 1 -and $Record.policyEpoch -le $Policy.epoch) 'epoca de conjunto invalida'
    Assert-Condition (@($Policy.revokedSetIds) -cnotcontains $Record.setId) 'conjunto revocado'
}

function Assert-OutsideTrust([string]$Path) {
    foreach ($root in $script:TrustRoot, $PSScriptRoot) {
        Assert-Condition (-not (Test-PathInside $Path $root) -and -not (Test-PathInside $root $Path)) "solapa con la raiz de confianza: $Path"
    }
}

# Un conjunto esta publicado solo si su firma verifica. Devuelve handles retenidos: se consume desde ellos.
function Open-SignedSet($Trust, [string]$SetDir) {
    Assert-OutsideTrust $SetDir
    Open-HeldDirectory $SetDir
    $directory = Get-FullPath $SetDir
    $sumsPath = Join-Path $directory 'SHA256SUMS.txt'
    $content = Read-HeldBytes (Open-HeldFile $sumsPath)
    $signature = Read-HeldBytes (Open-HeldFile "$sumsPath.sig")
    Assert-Condition (Test-DetachedSignature $Trust $content "$sumsPath.sig" $Trust.Policy.backupSigner $script:SignNamespace) 'firma del conjunto invalida'
    $listed = @{}
    foreach ($line in ([Text.Encoding]::UTF8.GetString($content) -split "`n" | Where-Object { $_ })) {
        Assert-Condition ($line -cmatch '^([0-9A-F]{64})  ([^\\/:]+)$') 'linea invalida en SHA256SUMS'
        Assert-Condition (-not $listed.ContainsKey($Matches[2])) 'nombre repetido en SHA256SUMS'
        $listed[$Matches[2]] = $Matches[1]
    }
    $present = @(Get-ChildItem -LiteralPath $directory -Force | Where-Object { $_.Name -notin 'SHA256SUMS.txt', 'SHA256SUMS.txt.sig' })
    Assert-Condition ($present.Count -eq 2 -and $listed.Count -eq 2) 'faltan o sobran archivos en el conjunto'
    $files = @{}
    foreach ($file in $present) {
        Assert-Condition ($listed.ContainsKey($file.Name)) "archivo no firmado: $($file.Name)"
        $stream = Open-HeldFile $file.FullName
        Assert-Condition ((Get-StreamSha256 $stream) -eq $listed[$file.Name]) "hash distinto: $($file.Name)"
        $files[$file.Name] = $stream
    }
    $recordNames = @($files.Keys | Where-Object { $_.EndsWith('.dump.age.record.json') })
    Assert-Condition ($recordNames.Count -eq 1) 'falta el registro del cifrado'
    $record = [Text.Encoding]::UTF8.GetString((Read-HeldBytes $files[$recordNames[0]])) | ConvertFrom-Json
    Assert-CipherRecord $record $Trust.Policy ''
    Assert-Condition ($recordNames[0] -ceq "$($record.cipherName).record.json" -and $files.ContainsKey($record.cipherName)) 'el registro no describe el cifrado presente'
    Assert-Condition ($listed[$record.cipherName] -eq $record.cipherSha256) 'el cifrado no coincide con su registro'
    [pscustomobject]@{
        Directory = $directory; Record = $record; Cipher = $files[$record.cipherName]
        Files = $files; Sums = $content; Signature = $signature
    }
}

# --- Identidades y evidencia ------------------------------------------------------------------------

# La identidad debe contener exactamente UNA clave privada y corresponder al destinatario del rol.
function Assert-IdentityRecipient([string]$Age, [string]$Keygen, [string]$IdentityPath, [string]$Recipient) {
    $buffer = [byte[]]::new(16384)
    try {
        $plain = [IO.MemoryStream]::new($buffer, $true)
        $opened = Invoke-Chain @(New-Stage $Age @('--decrypt', (Get-FullPath $IdentityPath))) $null $plain
        Assert-ChainOk $opened 'apertura de la identidad'
        $public = [IO.MemoryStream]::new()
        $derived = Invoke-Chain @(New-Stage $Keygen @('-y') -Quiet) ([IO.MemoryStream]::new($buffer, 0, [int]$plain.Position, $false)) $public
        Assert-ChainOk $derived 'derivacion de la clave publica'
        $keys = @([Text.Encoding]::ASCII.GetString($public.ToArray()) -split "`r?`n" | Where-Object { $_ })
        Assert-Condition ($keys.Count -eq 1) 'la identidad debe contener exactamente una clave'
        Assert-Condition ($keys[0] -ceq $Recipient) 'la identidad no corresponde al destinatario del rol'
    }
    finally { [Array]::Clear($buffer, 0, $buffer.Length) }
}

function New-EvidenceData($Trust, $Record, [string]$Kind, [string]$Role) {
    [ordered]@{
        schema       = 1
        kind         = $Kind
        role         = $Role
        setId        = $Record.setId
        cipherSha256 = $Record.cipherSha256
        plainSha256  = $Record.sourceSha256
        computer     = [Environment]::MachineName
        policyEpoch  = $Trust.Policy.epoch
        policySha256 = $Trust.PolicySha256
        createdUnix  = Get-UnixNow
    }
}

# La firma es la marca de publicacion: una evidencia sin .sig valida no existe.
function Publish-Evidence($Trust, $Data, [string]$EvidenceDir, [string]$SigningKey, [string]$StagingDir) {
    $signer = @($Trust.Policy.evidenceSigners | Where-Object { $_.role -ceq $Data.role })[0]
    Assert-Condition ($signer.computer -ieq [Environment]::MachineName) "este equipo no esta autorizado para el rol $($Data.role)"
    $Data['principal'] = $signer.principal
    Assert-OutsideForbiddenRoots $EvidenceDir
    Assert-OutsideTrust $EvidenceDir
    Open-HeldDirectory $EvidenceDir
    Assert-SecretAcl $EvidenceDir
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($Data | ConvertTo-Json))
    $signature = New-DetachedSignature $Trust $bytes $SigningKey $script:EvidenceNamespace $signer.principal $StagingDir
    $out = Join-Path (Get-FullPath $EvidenceDir) "$($Data.kind)-$($Data.setId)-$($Data.role)-$([guid]::NewGuid().ToString('N')).json"
    $null = Publish-HeldBytes $out $bytes
    $null = Publish-HeldBytes "$out.sig" $signature
    $out
}

# Validacion pura de una evidencia ya autenticada. Devuelve '' o el motivo de rechazo.
function Test-EvidenceFields($Evidence, $Policy, [string]$PolicySha256, $Record, [long]$Now) {
    $signer = @($Policy.evidenceSigners | Where-Object { $_.principal -ceq $Evidence.principal })
    if ($signer.Count -ne 1) { return 'firmante no declarado' }
    if ($Evidence.schema -ne 1) { return 'esquema' }
    if ($Evidence.role -cne $signer[0].role) { return 'rol distinto del firmante' }
    if ($Evidence.computer -ine $signer[0].computer) { return 'equipo distinto del firmante' }
    if ($Evidence.setId -cne $Record.setId) { return 'otro conjunto' }
    if ($Evidence.cipherSha256 -ne $Record.cipherSha256) { return 'otro cifrado' }
    if ($Evidence.plainSha256 -ne $Record.sourceSha256) { return 'otro origen' }
    if ($Evidence.policyEpoch -ne $Policy.epoch -or $Evidence.policySha256 -ne $PolicySha256) { return 'otra politica' }
    $days = [long]$Policy.evidenceMaxAge.days
    if ($days -lt 1) { return 'vigencia no definida' }
    if ($Evidence.createdUnix -lt $Record.createdUnix) { return 'anterior al conjunto' }
    if ($Evidence.createdUnix -gt ($Now + 300)) { return 'fecha futura' }
    if (($Now - $Evidence.createdUnix) -gt ($days * 86400)) { return 'evidencia vencida' }
    if ($Evidence.kind -ceq 'decrypt') {
        if ($Evidence.role -cnotin 'primary', 'recovery') { return 'rol no admitido para descifrado' }
        if ($Evidence.recipient -cne $Policy.recipients.($Evidence.role)) { return 'destinatario distinto' }
        if ($Evidence.decrypt -cne 'PASSED' -or $Evidence.archiveCheck -cne 'PASSED') { return 'descifrado no superado' }
        return ''
    }
    if ($Evidence.kind -ceq 'restore') {
        if ($Evidence.role -cne 'restore' -or $Evidence.restore -cne 'PASSED') { return 'restauracion no superada' }
        return ''
    }
    'tipo desconocido'
}

# $Evidence contiene solo evidencias autenticadas y validadas.
function Get-GateChecks($Policy, [object[]]$Records, [int]$DiskCount, [object[]]$Evidence) {
    $decrypted = @($Evidence | Where-Object { $_.kind -ceq 'decrypt' })
    [ordered]@{
        tresCopiasEnDiscosDistintos  = ($Records.Count -ge 3 -and $DiskCount -ge 3)
        mismoConjuntoCifrado         = (@($Records | ForEach-Object { "$($_.setId)|$($_.cipherSha256)" } | Sort-Object -Unique).Count -eq 1)
        conjuntoDeLaEpocaVigente     = (@($Records | Where-Object { $_.policyEpoch -ne $Policy.epoch }).Count -eq 0 -and $Records.Count -gt 0)
        vigenciaDeEvidenciaAprobada  = ($Policy.evidenceMaxAge.status -ceq 'APPROVED' -and -not [string]::IsNullOrWhiteSpace($Policy.evidenceMaxAge.approvedBy))
        # Declaracion administrativa: la criptografia no demuestra que dos custodios sean independientes.
        custodiosDeclaradosDistintos = (-not [string]::IsNullOrWhiteSpace($Policy.custodians.primary) -and -not [string]::IsNullOrWhiteSpace($Policy.custodians.recovery) -and $Policy.custodians.primary -ine $Policy.custodians.recovery)
        descifradoPrimario           = (@($decrypted | Where-Object { $_.role -ceq 'primary' }).Count -gt 0)
        recuperacionEnOtroEquipo     = (@($decrypted | Where-Object { $_.role -ceq 'recovery' -and $_.computer -ine $Policy.productionComputer }).Count -gt 0)
        restauracionAceptada         = (@($Evidence | Where-Object { $_.kind -ceq 'restore' }).Count -gt 0)
    }
}

function Get-GateDecision($Checks) {
    if ($Checks.Count -gt 0 -and @($Checks.Values | Where-Object { $_ -isnot [bool] -or -not $_ }).Count -eq 0) { return 'GO' }
    'NO_GO'
}
