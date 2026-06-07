# Smoke produccion publico

Valida que los endpoints publicos de produccion responden correctamente sin requerir credenciales.
No reemplaza el smoke autenticado (`pnpm smoke:staging`) ni el smoke local (`pnpm smoke:test`).

## Endpoints validados

- `GET https://api.vetneb.com.ar/health` — HTTP 200, `success=true`, `database=up`, `storage=up`
- `GET https://vetneb.com.ar/` — HTTP 200
- `GET https://vetneb.com.ar/robots.txt` — HTTP 200
- `GET https://vetneb.com.ar/sitemap.xml` — HTTP 200, contiene `https://vetneb.com.ar`
- `GET https://vetneb.com.ar/favicon.ico` — HTTP 200, body no vacío, magic bytes ICO `00 00 01 00`

## Ejecucion

Terminal 1:

```powershell
pnpm smoke:prod:public
```

Override de URLs (opcional, sin trailing slash):

```powershell
$env:PROD_FRONTEND_URL = "https://vetneb.com.ar"
$env:PROD_API_URL = "https://api.vetneb.com.ar"
pnpm smoke:prod:public
```

## Notas

- No requiere credenciales ni secretos.
- Sale con exit code 1 ante cualquier falla.
- Timeout de 15 segundos por request.
- Registrar evidencia sanitizada del resultado en `docs/production-readiness-evidence.md` (P0-022).
