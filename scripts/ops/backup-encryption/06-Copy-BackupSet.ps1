#Requires -Version 7.4
# Copia un conjunto publicado (solo cifrado) a OTRO DISCO FISICO. Sin sobrescritura.
# La firma se escribe al final, tras verificar las copias sobre handles que siguen retenidos.
param(
    [Parameter(Mandatory)][string]$SetDir,
    [Parameter(Mandatory)][string]$DestinationRoot
)
. "$PSScriptRoot\Common.ps1"

try {
    $trust = Get-TrustContext
    $set = Open-SignedSet $trust $SetDir
    Assert-OutsideForbiddenRoots $DestinationRoot
    Assert-OutsideTrust $DestinationRoot
    Open-HeldDirectory $DestinationRoot
    Assert-SecretAcl $DestinationRoot
    Assert-Condition ((Get-DiskNumber $set.Directory) -ne (Get-DiskNumber $DestinationRoot)) 'el destino esta en el mismo disco fisico; no es una copia independiente'

    $target = Join-Path (Get-FullPath $DestinationRoot) (Split-Path $set.Directory -Leaf)
    $size = ($set.Files.Values | Measure-Object Length -Sum).Sum
    Assert-FreeSpace $DestinationRoot $size
    # Sin -Force: falla si el destino ya existe.
    $null = New-Item -ItemType Directory -Path $target
    Open-HeldDirectory $target
    Assert-SecretAcl $target
    Assert-Condition (@(Get-ChildItem -LiteralPath $target -Force).Count -eq 0) 'el destino recien creado no esta vacio'

    foreach ($name in @($set.Files.Keys | Sort-Object)) {
        $source = $set.Files[$name]
        $copy = Join-Path $target $name
        $writer = New-HeldFile $copy
        $source.Position = 0
        $pumped = [Vetneb.Pump]::Start($source, $writer, $false).GetAwaiter().GetResult()
        Assert-Condition (-not $pumped.Broken -and $pumped.Bytes -eq $source.Length) "copia incompleta: $name"
        $writer.Flush($true)
        $writer.Dispose()
        Assert-Condition ((Get-StreamSha256 (Open-HeldFile $copy)) -eq $pumped.Sha256) "relectura distinta: $name"
    }
    $sums = Join-Path $target 'SHA256SUMS.txt'
    $null = Publish-HeldBytes $sums $set.Sums
    $null = Publish-HeldBytes "$sums.sig" $set.Signature
    $null = Open-SignedSet $trust $target
    # La relectura inmediata puede salir de cache: desconectar el medio, reconectar y ejecutar el script 08.
    'COPIED_PENDING_REREAD'
}
finally { Close-HeldHandles }
