# Smoke local

Los scripts de smoke validan el backend contra un servidor ya levantado.

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
$env:SMOKE_BASE_URL = "http://localhost:3000"
$env:SMOKE_USERNAME = "<clinic-user>"
$env:SMOKE_PASSWORD = "<clinic-password>"
```

No usar los defaults internos `admin` / `admin123` salvo que existan explicitamente en la base local.

## Smoke basico

```powershell
pnpm smoke:test
```

Valida health, login clinic, sesion, reports, study-types, logout y sesion invalidada.

## Smoke upload

```powershell
$env:SMOKE_TMP_DIR = "C:\PORTAL-VETNEB\tmp"
pnpm smoke:upload
```

Valida login clinic, creacion de PDF temporal, upload multipart, lectura de reports y logout.

## Notas de seguridad

Los scripts no deben registrar la password en consola.
Solo muestran BASE URL y USUARIO.
Las credenciales reales deben configurarse por entorno local y no commitearse.
