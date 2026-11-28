#Requires -Version 7.4
# Prueba de recuperabilidad de un archivo del formato anterior VNBENC1: descifra solo en memoria y compara
# hash. No escribe ningun archivo. Probado solo con archivos sinteticos construidos segun el formato descrito.
# Sobre un respaldo real requiere autorizacion R3.
param(
    [Parameter(Mandatory)][string]$CipherFile,
    [Parameter(Mandatory)][ValidatePattern('^[0-9A-Fa-f]{64}$')][string]$ExpectedPlainSha256
)
. "$PSScriptRoot\Common.ps1"

Assert-LocalPlainPath $CipherFile
$length = (Get-Item -LiteralPath $CipherFile).Length
Assert-Condition ($length -gt 55 -and $length -le 512MB) 'tamano fuera de rango'
$all = [IO.File]::ReadAllBytes((Get-FullPath $CipherFile))
Assert-Condition ([Text.Encoding]::ASCII.GetString($all, 0, 7) -ceq 'VNBENC1') 'formato no reconocido'
$iterations = [BitConverter]::ToInt32($all, 7)
Assert-Condition ($iterations -ge 600000 -and $iterations -le 5000000) "iteraciones fuera de rango: $iterations"
$salt = [byte[]]$all[11..26]
$nonce = [byte[]]$all[27..38]
$tag = [byte[]]$all[39..54]
$cipher = [byte[]]::new($all.Length - 55)
[Array]::Copy($all, 55, $cipher, 0, $cipher.Length)
$plain = [byte[]]::new($cipher.Length)

$secure = Read-Host 'Passphrase del respaldo' -AsSecureString
$pointer = [IntPtr]::Zero
$chars = [char[]]::new($secure.Length)
$password = $null
$key = $null
$gcm = $null
try {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($secure)
    [Runtime.InteropServices.Marshal]::Copy($pointer, $chars, 0, $chars.Length)
    $password = [Text.Encoding]::UTF8.GetBytes($chars)
    $key = [Security.Cryptography.Rfc2898DeriveBytes]::Pbkdf2($password, $salt, $iterations, [Security.Cryptography.HashAlgorithmName]::SHA256, 32)
    $gcm = [Security.Cryptography.AesGcm]::new($key, 16)
    $gcm.Decrypt($nonce, $cipher, $tag, $plain)
    $actual = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($plain))
    Assert-Condition ($actual -eq $ExpectedPlainSha256) 'el contenido descifrado no coincide con el original'
    [pscustomobject]@{ result = 'PASSED'; plainSha256 = $actual; computer = $env:COMPUTERNAME; verifiedUtc = [datetime]::UtcNow.ToString('o') }
}
finally {
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeGlobalAllocUnicode($pointer) }
    [Array]::Clear($chars, 0, $chars.Length)
    if ($password) { [Array]::Clear($password, 0, $password.Length) }
    if ($key) { [Array]::Clear($key, 0, $key.Length) }
    [Array]::Clear($plain, 0, $plain.Length)
    if ($gcm) { $gcm.Dispose() }
    $secure.Dispose()
}
