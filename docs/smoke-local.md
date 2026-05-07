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
