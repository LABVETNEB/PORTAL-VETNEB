# Smoke local

Los scripts de smoke validan el backend contra un servidor ya levantado.

Referencias locales/LAN recomendadas para comunicaciones:

- Backend local: `http://127.0.0.1:3000` o `http://<LAN-IP>:3000`
- Frontend local: `http://localhost:3001` o `http://<LAN-IP>:3001`

## Requisitos

Terminal 1:

```powershell
cd C:\PORTAL-VETNEB
pnpm build
pnpm start
```

Alternativa para desarrollo:

```powershell
pnpm dev
```

## Variables requeridas

Antes de ejecutar los smoke tests, configurar credenciales clinic validas para el entorno local:

```powershell
$env:SMOKE_BASE_URL = "http://127.0.0.1:3000"
$env:SMOKE_USERNAME = "<clinic-user>"
$env:SMOKE_PASSWORD = "<clinic-password>"
```

SMOKE_PASSWORD es obligatorio. El script falla si no esta configurado para evitar passwords por defecto en smoke local.

Usar `127.0.0.1` evita diferencias locales de resolucion IPv6 de `localhost`.

## Smoke basico

```powershell
pnpm smoke:test
```

Valida health, login clinic, sesion, reports, study-types, logout y sesion invalidada.

## Smoke upload

```powershell
$env:SMOKE_TMP_DIR = "$env:TEMP\portal-vetneb-smoke"
pnpm smoke:upload
```

Valida login clinic, creacion de PDF temporal, upload multipart, lectura de reports y logout.

## Notas de seguridad

Los scripts no deben registrar la password en consola.
Solo muestran BASE URL y USUARIO.
Las credenciales reales deben configurarse por entorno local y no commitearse.

## Smoke CORS/contacto opcional

```powershell
$BackendUrl = "http://127.0.0.1:3000"
$AllowedOrigin = "http://localhost:3001"

Invoke-WebRequest `
  -Method OPTIONS `
  -Uri "$BackendUrl/api/contact" `
  -Headers @{
    Origin = $AllowedOrigin
    "Access-Control-Request-Method" = "POST"
    "Access-Control-Request-Headers" = "content-type"
  } `
  -UseBasicParsing

Invoke-WebRequest `
  -Method POST `
  -Uri "$BackendUrl/api/contact" `
  -Headers @{ Origin = $AllowedOrigin } `
  -ContentType "application/json" `
  -Body (@{
    name = "Smoke Local"
    email = "smoke.local@example.com"
    clinicName = "Clinica Smoke"
    message = "Validacion local del formulario de contacto."
  } | ConvertTo-Json -Compress) `
  -UseBasicParsing
```
