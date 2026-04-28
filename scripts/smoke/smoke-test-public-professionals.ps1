param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Username = "publicdemo",
  [string]$Password = "demo1234",
  [int]$ExpectedClinicId = 4
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "== $Message ==" -ForegroundColor Cyan
}

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw "ASSERT FAILED: $Message"
  }

  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Invoke-JsonRequest {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Uri,
    [Microsoft.PowerShell.Commands.WebRequestSession]$WebSession,
    [object]$BodyObject
  )

  $params = @{
    UseBasicParsing = $true
    Uri             = $Uri
    Method          = $Method
  }

  if ($null -ne $WebSession) {
    $params.WebSession = $WebSession
  }

  if ($null -ne $BodyObject) {
    $params.ContentType = "application/json"
    $params.Body = ($BodyObject | ConvertTo-Json -Depth 10)
  }

  $response = Invoke-WebRequest @params
  return ($response.Content | ConvertFrom-Json)
}

try {
  $clinicSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession

  Write-Step "LOGIN CLINICA"
  $login = Invoke-JsonRequest `
    -Method "POST" `
    -Uri "$BaseUrl/api/auth/login" `
    -WebSession $clinicSession `
    -BodyObject @{
      username = $Username
      password = $Password
    }

  $login | ConvertTo-Json -Depth 10
  Assert-True ($login.success -eq $true) "Login de clínica exitoso"
  Assert-True ($null -ne $login.clinicUser) "La respuesta incluye clinicUser"
  Assert-True ([int]$login.clinicUser.clinicId -eq $ExpectedClinicId) "clinicId esperado = $ExpectedClinicId"

  Write-Step "PATCH PERFIL PUBLICO"
  $profilePayload = @{
    displayName   = "Centro Veterinario Dermato VETNEB"
    aboutText     = "Centro especializado en dermatopatologia veterinaria, citologia, histopatologia y segunda opinion diagnostica."
    specialtyText = "Dermatopatologia veterinaria"
    servicesText  = "Citologia, histopatologia, inmunohistoquimica y segunda opinion"
    email         = "contacto@vetneb.com"
    phone         = "+54 353 4000000"
    locality      = "Villa Maria"
    country       = "Argentina"
    isPublic      = $true
  }

  $patchProfile = Invoke-JsonRequest `
    -Method "PATCH" `
    -Uri "$BaseUrl/api/clinic/profile" `
    -WebSession $clinicSession `
    -BodyObject $profilePayload

  $patchProfile | ConvertTo-Json -Depth 10
  Assert-True ($patchProfile.success -eq $true) "PATCH /api/clinic/profile responde success=true"
  Assert-True ($patchProfile.profile.isPublic -eq $true) "El perfil queda publico"
  Assert-True ($patchProfile.profile.publication.hasRequiredPublicFields -eq $true) "Tiene campos requeridos"
  Assert-True ($patchProfile.profile.publication.hasQualitySupplement -eq $true) "Tiene suplemento de calidad"
  Assert-True ([int]$patchProfile.profile.publication.qualityScore -ge 75) "qualityScore >= 75"
  Assert-True ($patchProfile.profile.publication.isSearchEligible -eq $true) "El perfil es elegible para busqueda"
  Assert-True ([int]$patchProfile.search.clinicId -eq $ExpectedClinicId) "La fila de search corresponde a la clinica esperada"

  Write-Step "GET PERFIL PUBLICO PROPIO"
  $getProfile = Invoke-JsonRequest `
    -Method "GET" `
    -Uri "$BaseUrl/api/clinic/profile" `
    -WebSession $clinicSession

  $getProfile | ConvertTo-Json -Depth 10
  Assert-True ($getProfile.success -eq $true) "GET /api/clinic/profile responde success=true"
  Assert-True ($getProfile.profile.displayName -eq "Centro Veterinario Dermato VETNEB") "displayName correcto"
  Assert-True ($getProfile.profile.specialtyText -eq "Dermatopatologia veterinaria") "specialtyText correcto"
  Assert-True ($getProfile.profile.locality -eq "Villa Maria") "locality correcta"
  Assert-True ($getProfile.profile.country -eq "Argentina") "country correcto"
  Assert-True ($getProfile.search.isSearchEligible -eq $true) "La proyeccion search queda elegible"
  Assert-True ([int]$getProfile.search.profileQualityScore -ge 75) "profileQualityScore de search >= 75"

  Write-Step "BUSQUEDA PUBLICA SIMPLE"
  $searchSimple = Invoke-JsonRequest `
    -Method "GET" `
    -Uri "$BaseUrl/api/public/professionals/search?q=dermatopatologia"

  $searchSimple | ConvertTo-Json -Depth 10
  Assert-True ($searchSimple.success -eq $true) "Search simple responde success=true"
  Assert-True ([int]$searchSimple.count -ge 1) "Search simple devuelve al menos 1 resultado"

  $simpleHit = $searchSimple.professionals | Where-Object { [int]$_.clinicId -eq $ExpectedClinicId } | Select-Object -First 1
  Assert-True ($null -ne $simpleHit) "La clinica esperada aparece en search simple"
  Assert-True ($simpleHit.displayName -eq "Centro Veterinario Dermato VETNEB") "Search simple devuelve displayName correcto"
  Assert-True ([double]$simpleHit.profileQualityScore -ge 75) "Search simple devuelve profileQualityScore valido"

  Write-Step "BUSQUEDA PUBLICA CON LOCALIDAD Y PAIS"
  $searchFiltered = Invoke-JsonRequest `
    -Method "GET" `
    -Uri "$BaseUrl/api/public/professionals/search?q=dermato&locality=Villa%20Maria&country=Argentina"

  $searchFiltered | ConvertTo-Json -Depth 10
  Assert-True ($searchFiltered.success -eq $true) "Search filtrada responde success=true"
  Assert-True ([int]$searchFiltered.count -ge 1) "Search filtrada devuelve al menos 1 resultado"

  $filteredHit = $searchFiltered.professionals | Where-Object { [int]$_.clinicId -eq $ExpectedClinicId } | Select-Object -First 1
  Assert-True ($null -ne $filteredHit) "La clinica esperada aparece en search filtrada"
  Assert-True ($filteredHit.locality -eq "Villa Maria") "Search filtrada devuelve locality correcta"
  Assert-True ($filteredHit.country -eq "Argentina") "Search filtrada devuelve country correcto"
  Assert-True ([double]$filteredHit.relevance.score -gt 0) "Search filtrada devuelve score positivo"

  Write-Step "DETALLE PUBLICO"
  $detail = Invoke-JsonRequest `
    -Method "GET" `
    -Uri "$BaseUrl/api/public/professionals/$ExpectedClinicId"

  $detail | ConvertTo-Json -Depth 10
  Assert-True ($detail.success -eq $true) "Detalle publico responde success=true"
  Assert-True ([int]$detail.professional.clinicId -eq $ExpectedClinicId) "Detalle publico devuelve clinicId esperado"
  Assert-True ($detail.professional.displayName -eq "Centro Veterinario Dermato VETNEB") "Detalle publico devuelve displayName correcto"
  Assert-True ($detail.professional.specialtyText -eq "Dermatopatologia veterinaria") "Detalle publico devuelve specialtyText correcto"
  Assert-True ($detail.professional.locality -eq "Villa Maria") "Detalle publico devuelve locality correcta"
  Assert-True ($detail.professional.country -eq "Argentina") "Detalle publico devuelve country correcto"

  Write-Step "RESUMEN FINAL"
  Write-Host "SMOKE TEST COMPLETO OK" -ForegroundColor Green
  Write-Host "BaseUrl: $BaseUrl"
  Write-Host "ClinicId validado: $ExpectedClinicId"
  Write-Host "Usuario validado: $Username"
}
catch {
  Write-Host ""
  Write-Host "SMOKE TEST FALLIDO" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
