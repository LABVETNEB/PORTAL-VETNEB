# VETNEB production launch readiness checklist

Checklist operativo para validar el lanzamiento productivo de Portal VETNEB.
Mantener este documento sin secretos: usar nombres de variables, placeholders y
evidencias sanitizadas.

## Uso

- `[BLOCKER]`: debe quedar resuelto antes de publicar produccion.
- `[NON-BLOCKER]`: puede salir con responsable, fecha y plan de seguimiento.
- Completar cada item con evidencia: URL, captura, hash de commit, job de CI,
  log sanitizado o responsable que valida.
- No ejecutar comandos destructivos contra produccion sin backup reciente y
  ventana aprobada.

## 1. Variables backend

Fuente de verdad actual: `.env.example` y `server/lib/env.ts`.

### Requeridas para boot productivo

- [ ] `[BLOCKER]` `NODE_ENV=production`.
- [ ] `[BLOCKER]` `SUPABASE_URL` apunta al proyecto Supabase productivo.
- [ ] `[BLOCKER]` `SUPABASE_ANON_KEY` existe solo en backend/entorno seguro
  cuando sea necesario; no reemplaza la service role.
- [ ] `[BLOCKER]` `SUPABASE_SERVICE_ROLE_KEY` existe solo en backend y nunca en
  frontend, logs, repositorio ni herramientas publicas.
- [ ] `[BLOCKER]` `SUPABASE_DB_URL` o `DATABASE_URL` apunta a la base productiva
  correcta. Si existen ambas, validar que no apunten a entornos diferentes.
- [ ] `[BLOCKER]` `SUPABASE_STORAGE_BUCKET` definido, o aceptado explicitamente
  el default `reports`.
- [ ] `[BLOCKER]` `CORS_ORIGIN` contiene exactamente los origenes publicos
  autorizados del frontend, separados por coma y sin trailing slash.
- [ ] `[BLOCKER]` `TRUST_PROXY` revisado para la plataforma de hosting; el
  default del runtime es `1`.
- [ ] `[BLOCKER]` `COOKIE_NAME`, `ADMIN_COOKIE_NAME` y
  `PARTICULAR_COOKIE_NAME` definidos o aceptados explicitamente los defaults:
  `app_session_id`, `admin_session_id`, `particular_session_id`.
- [ ] `[BLOCKER]` `MAX_UPLOAD_FILE_SIZE_MB` validado contra la politica real de
  informes PDF e imagenes permitidas.
- [ ] `[BLOCKER]` `SUPABASE_SIGNED_URL_EXPIRES_IN_SECONDS` validado contra la
  politica de descarga; default actual: 900 segundos.
- [ ] `[BLOCKER]` `SESSION_TTL_HOURS` validado contra la politica de sesiones;
  default actual: 24 horas.
- [ ] `[BLOCKER]` `PORT` compatible con la plataforma, o delegado a la variable
  inyectada por el proveedor.

### Condicionales

- [ ] `[BLOCKER]` `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
  `SMTP_PASS` y `SMTP_FROM` configurados si el lanzamiento incluye formularios
  o notificaciones por email.
- [ ] `[NON-BLOCKER]` `OWNER_OPEN_ID` documentado o removido del entorno si no
  forma parte del flujo productivo actual.
- [ ] `[NON-BLOCKER]` `LAB_UPLOAD_USERNAMES` revisado si se usa para permisos
  operativos heredados.

### Comandos utiles PowerShell

```powershell
cd C:\PORTAL-VETNEB
Get-Content .env.example
```

Validar nombres esperados en el entorno local de una shell antes de un smoke:

```powershell
$requiredBackend = @(
  "NODE_ENV",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CORS_ORIGIN",
  "SUPABASE_STORAGE_BUCKET"
)

$requiredBackend | ForEach-Object {
  if (-not [Environment]::GetEnvironmentVariable($_)) {
    "MISSING: $_"
  }
}

if (-not [Environment]::GetEnvironmentVariable("SUPABASE_DB_URL") -and
    -not [Environment]::GetEnvironmentVariable("DATABASE_URL")) {
  "MISSING: SUPABASE_DB_URL or DATABASE_URL"
}
```

## 2. Variables frontend

Fuente de verdad actual: `frontend/.env.example` y `frontend/README.md`.

- [ ] `[BLOCKER]` `NEXT_PUBLIC_API_URL` apunta al backend Fastify productivo,
  con `https://` y sin trailing slash.
- [ ] `[BLOCKER]` `NEXT_PUBLIC_SITE_URL` apunta al dominio publico del frontend,
  con `https://` y sin trailing slash.
- [ ] `[BLOCKER]` El valor de `NEXT_PUBLIC_API_URL` coincide con un origen
  autorizado en `CORS_ORIGIN` cuando frontend y backend estan separados.
- [ ] `[BLOCKER]` Ninguna variable `SUPABASE_SERVICE_ROLE_KEY`, string de
  conexion DB, password SMTP o secreto de sesion esta expuesta con prefijo
  `NEXT_PUBLIC_`.
- [ ] `[NON-BLOCKER]` Canonicals, sitemap y metadata usan el dominio final
  esperado por negocio.

Comandos utiles:

```powershell
cd C:\PORTAL-VETNEB
Get-Content frontend\.env.example
pnpm -C frontend build
```

## 3. Migraciones, staging y produccion

Fuente actual: `drizzle.config.ts`, `drizzle/migrations/` y script
`pnpm db:migrate`.

- [ ] `[BLOCKER]` Staging tiene una copia representativa de datos o dataset
  suficiente para probar informes, sesiones, perfiles publicos, tokens
  particulares y logistica.
- [ ] `[BLOCKER]` `pnpm db:migrate` corrio exitosamente en staging usando
  `SUPABASE_DB_URL` o `DATABASE_URL` de staging.
- [ ] `[BLOCKER]` Backend y frontend productivos se prueban contra staging antes
  de cambiar DNS o trafico productivo.
- [ ] `[BLOCKER]` Existe backup o snapshot productivo previo a migrar.
- [ ] `[BLOCKER]` Se reviso el orden de migraciones hasta la ultima existente
  en `drizzle/migrations/`.
- [ ] `[BLOCKER]` Se confirmo que las migraciones son compatibles con el
  artefacto backend que va a quedar corriendo despues del deploy.
- [ ] `[BLOCKER]` En produccion, ejecutar migraciones una sola vez, con ventana
  aprobada y operador identificado.
- [ ] `[NON-BLOCKER]` Si hay scripts de reconciliacion en `scripts/db/`, dejar
  evidencia de si aplican o no al lanzamiento.

Comandos utiles:

```powershell
cd C:\PORTAL-VETNEB
Get-ChildItem drizzle\migrations -Filter *.sql | Sort-Object Name | Select-Object -ExpandProperty Name
pnpm db:migrate
```

## 4. CORS, dominio, HTTPS y cookies

El backend usa `CORS_ORIGIN` para origenes permitidos y, con
`NODE_ENV=production`, las cookies salen con `Secure` y `SameSite=None`.

- [ ] `[BLOCKER]` Dominio frontend productivo resuelve por HTTPS.
- [ ] `[BLOCKER]` Backend productivo resuelve por HTTPS.
- [ ] `[BLOCKER]` `CORS_ORIGIN` contiene el origen exacto del frontend:
  esquema, host y puerto si aplica; sin path ni trailing slash.
- [ ] `[BLOCKER]` No hay origenes locales (`localhost`, `127.0.0.1`, `5173`,
  `3000`, `3001`) en `CORS_ORIGIN` productivo.
- [ ] `[BLOCKER]` Las llamadas frontend usan `credentials: "include"` y el
  navegador recibe `access-control-allow-credentials: true`.
- [ ] `[BLOCKER]` Login clinic, admin y particular setean cookies con `Secure`
  en HTTPS productivo.
- [ ] `[BLOCKER]` Las cookies de logout se limpian correctamente para
  `COOKIE_NAME`, `ADMIN_COOKIE_NAME` y `PARTICULAR_COOKIE_NAME`.
- [ ] `[BLOCKER]` Las rutas unsafe (`POST`, `PUT`, `PATCH`, `DELETE`) rechazan
  origenes no autorizados con `403`.
- [ ] `[NON-BLOCKER]` Documentar si frontend y backend comparten dominio padre o
  viven en dominios completamente separados.

Comando smoke de headers:

```powershell
$BaseUrl = "https://<backend-productivo>"
$Origin = "https://<frontend-productivo>"
Invoke-WebRequest -Uri "$BaseUrl/health" -Headers @{ Origin = $Origin } -Method GET
```

## 5. Supabase Storage, signed URLs y avatars

El backend usa bucket privado, crea el bucket si falta al iniciar y genera URLs
firmadas para informes y avatars. Rutas esperadas:

- Informes: `clinics/{clinicId}/{timestamp}-{random}-{fileName}`.
- Avatars/logos: `clinic-avatars/{clinicId}/{timestamp}-{random}-{fileName}`.

- [ ] `[BLOCKER]` Bucket `SUPABASE_STORAGE_BUCKET` existe en Supabase
  produccion y esta privado.
- [ ] `[BLOCKER]` Service role usada por backend puede leer, subir y borrar
  objetos del bucket privado.
- [ ] `[BLOCKER]` Healthcheck `/health` reporta `checks.storage = "up"`.
- [ ] `[BLOCKER]` Upload admin de informe PDF crea registro DB y objeto Storage.
- [ ] `[BLOCKER]` `GET /api/reports/:reportId/download-url` devuelve signed URL
  valida y expirable para una clinica autorizada.
- [ ] `[BLOCKER]` Las signed URLs no quedan persistidas en DB ni expuestas en
  logs.
- [ ] `[BLOCKER]` Upload de avatar/logo de perfil clinica acepta solo JPEG, PNG
  o WebP.
- [ ] `[BLOCKER]` Delete de avatar/logo elimina el objeto anterior cuando
  corresponde y actualiza `avatarStoragePath` a `null` sin romper reglas de
  calidad del perfil publico.
- [ ] `[NON-BLOCKER]` Definir retencion o limpieza de objetos huerfanos si queda
  fuera del lanzamiento inicial.

Smoke upload existente:

```powershell
cd C:\PORTAL-VETNEB
$env:SMOKE_BASE_URL = "https://<backend-productivo>"
$env:SMOKE_USERNAME = "<clinic-user>"
$env:SMOKE_PASSWORD = Read-Host "Clinic password"
$env:SMOKE_TMP_DIR = "$env:TEMP\portal-vetneb-smoke"
pnpm smoke:upload
Remove-Item Env:\SMOKE_PASSWORD
```

## 6. Smoke test admin, clinica y particular

Ejecutar contra staging primero y repetir contra produccion despues del deploy.
No registrar passwords ni tokens en consola, tickets o capturas.

### Clinica

- [ ] `[BLOCKER]` Login clinic funciona: `POST /api/auth/login`.
- [ ] `[BLOCKER]` Sesion clinic funciona: `GET /api/auth/me`.
- [ ] `[BLOCKER]` Informes listan: `GET /api/reports`.
- [ ] `[BLOCKER]` Search y filtros no rompen dashboard.
- [ ] `[BLOCKER]` Download URL firmada abre el informe esperado.
- [ ] `[BLOCKER]` Logout invalida sesion.

```powershell
cd C:\PORTAL-VETNEB
$env:SMOKE_BASE_URL = "https://<backend-productivo>"
$env:SMOKE_USERNAME = "<clinic-user>"
$env:SMOKE_PASSWORD = Read-Host "Clinic password"
pnpm smoke:test
Remove-Item Env:\SMOKE_PASSWORD
```

### Admin

- [ ] `[BLOCKER]` Login admin funciona: `POST /api/admin/auth/login`.
- [ ] `[BLOCKER]` Sesion admin funciona: `GET /api/admin/auth/me`.
- [ ] `[BLOCKER]` Panel admin carga health, sesiones, audit log, usuarios/roles,
  pricing, mantenimiento y tokens particulares segun permisos actuales.
- [ ] `[BLOCKER]` Upload admin de PDF funciona y queda visible para la clinica
  correcta.
- [ ] `[BLOCKER]` Logout admin invalida sesion.

```powershell
$BaseUrl = "https://<backend-productivo>"
$Origin = "https://<frontend-productivo>"
$AdminUser = "<admin-user>"
$AdminPassword = Read-Host "Admin password"

$adminLogin = Invoke-WebRequest `
  -Uri "$BaseUrl/api/admin/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Headers @{ Origin = $Origin } `
  -Body (@{ username = $AdminUser; password = $AdminPassword } | ConvertTo-Json) `
  -SessionVariable AdminSession

Invoke-RestMethod -Uri "$BaseUrl/api/admin/auth/me" -WebSession $AdminSession
Invoke-RestMethod -Uri "$BaseUrl/api/admin/system/health" -WebSession $AdminSession
Invoke-WebRequest -Uri "$BaseUrl/api/admin/auth/logout" -Method POST -WebSession $AdminSession -Headers @{ Origin = $Origin }
Remove-Variable AdminPassword
```

### Particular

- [ ] `[BLOCKER]` Un token particular activo permite login:
  `POST /api/particular/auth/login`.
- [ ] `[BLOCKER]` `GET /api/particular/auth/me` devuelve el token y reporte
  esperados.
- [ ] `[BLOCKER]` Preview y download URL funcionan si el token tiene informe
  vinculado.
- [ ] `[BLOCKER]` Token inactivo, inexistente o sin reporte vinculado devuelve
  error esperado.
- [ ] `[BLOCKER]` Logout particular invalida sesion.

```powershell
$BaseUrl = "https://<backend-productivo>"
$Origin = "https://<frontend-productivo>"
$ParticularToken = Read-Host "Particular token"

$particularLogin = Invoke-WebRequest `
  -Uri "$BaseUrl/api/particular/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Headers @{ Origin = $Origin } `
  -Body (@{ token = $ParticularToken } | ConvertTo-Json) `
  -SessionVariable ParticularSession

Invoke-RestMethod -Uri "$BaseUrl/api/particular/auth/me" -WebSession $ParticularSession
Invoke-RestMethod -Uri "$BaseUrl/api/particular/auth/report/preview-url" -WebSession $ParticularSession
Invoke-RestMethod -Uri "$BaseUrl/api/particular/auth/report/download-url" -WebSession $ParticularSession
Invoke-WebRequest -Uri "$BaseUrl/api/particular/auth/logout" -Method POST -WebSession $ParticularSession -Headers @{ Origin = $Origin }
Remove-Variable ParticularToken
```

## 7. Seguridad final

- [ ] `[BLOCKER]` No hay secretos reales en git, README, docs, issues, PRs,
  logs de CI ni capturas.
- [ ] `[BLOCKER]` Secretos productivos viven solo en el proveedor de runtime
  correspondiente.
- [ ] `[BLOCKER]` Supabase service role no esta disponible en frontend ni en
  variables `NEXT_PUBLIC_*`.
- [ ] `[BLOCKER]` Roles clinic (`clinic_owner`, `clinic_staff`) revisados para
  permisos de upload, usuarios y recursos de clinica.
- [ ] `[BLOCKER]` Admin users productivos revisados: sin cuentas temporales,
  credenciales compartidas ni usuarios sin responsable.
- [ ] `[BLOCKER]` Rate limit de login verificado para admin, clinica y
  particular.
- [ ] `[BLOCKER]` Audit log registra login, upload, cambios de roles, pricing,
  tokens y revocaciones criticas.
- [ ] `[BLOCKER]` Tokens particulares y report access tokens tienen flujo de
  revocacion probado.
- [ ] `[BLOCKER]` Endpoints admin no son accesibles con cookie clinic ni
  particular.
- [ ] `[NON-BLOCKER]` Rotacion post-lanzamiento agendada para credenciales usadas
  durante pruebas manuales.

## 8. Observabilidad, backups y rollback

- [ ] `[BLOCKER]` `/health` productivo responde `200` y reporta DB y Storage
  `up`.
- [ ] `[BLOCKER]` `/api/admin/system/health` visible para admin productivo y sin
  filtrar secretos.
- [ ] `[BLOCKER]` Logs de backend muestran errores HTTP con path/metodo/status,
  sin passwords, tokens ni signed URLs completas.
- [ ] `[BLOCKER]` Existe dashboard o procedimiento manual para revisar errores
  5xx, latencia y fallas de login durante las primeras 24 horas.
- [ ] `[BLOCKER]` Backup o snapshot de DB tomado antes del deploy productivo.
- [ ] `[BLOCKER]` Procedimiento de restore verificado en staging o entorno no
  productivo.
- [ ] `[BLOCKER]` Rollback de aplicacion definido: version anterior, comando o
  boton del proveedor, responsable y tiempo estimado.
- [ ] `[BLOCKER]` Rollback de DB definido. Si alguna migracion no es reversible,
  documentar decision go/no-go antes de migrar.
- [ ] `[NON-BLOCKER]` Baseline de metricas alineada con `docs/ops/METRICS_BASELINE.md`.

Comandos de verificacion:

```powershell
$BaseUrl = "https://<backend-productivo>"
Invoke-RestMethod "$BaseUrl/health"
Invoke-RestMethod "$BaseUrl/api/health"
```

## 9. Contenido final, legal y comercial

- [ ] `[BLOCKER]` Home publico, servicios, profesionales, clinicas, contacto,
  login y particulares revisados por negocio.
- [ ] `[BLOCKER]` Datos comerciales productivos de pricing revisados desde admin
  si el lanzamiento expone precios.
- [ ] `[BLOCKER]` Formulario de contacto probado end-to-end si SMTP queda
  incluido en el lanzamiento.
- [ ] `[BLOCKER]` Textos legales obligatorios publicados o enlazados segun el
  criterio legal/comercial vigente: privacidad, terminos, tratamiento de datos,
  condiciones de uso de informes y contacto responsable.
- [ ] `[BLOCKER]` No hay claims medicos, comerciales o de tiempos de entrega no
  aprobados.
- [ ] `[BLOCKER]` SEO productivo revisado: canonical, sitemap, robots y dominio
  de `NEXT_PUBLIC_SITE_URL`.
- [ ] `[NON-BLOCKER]` Plan editorial post-lanzamiento documentado para paginas
  no criticas.

## 10. Criterio go/no-go

### Go

Se puede lanzar si todo esto es verdadero:

- [ ] Todos los items `[BLOCKER]` anteriores estan cerrados con evidencia.
- [ ] `pnpm test` verde en el commit candidato.
- [ ] `pnpm build` verde en el commit candidato.
- [ ] `pnpm -C frontend build` verde en el commit candidato.
- [ ] Smoke admin, clinica y particular verdes en staging.
- [ ] Smoke admin, clinica y particular verdes en produccion despues del deploy.
- [ ] Backup productivo previo confirmado.
- [ ] Rollback de aplicacion y DB confirmado.
- [ ] Responsable tecnico y responsable de negocio aprobaron la salida.

### No-go

No lanzar si ocurre cualquiera de estos casos:

- [ ] Falla DB, Storage o healthcheck.
- [ ] CORS/cookies impiden login o persistencia de sesion en HTTPS.
- [ ] Service role o secretos quedan expuestos en frontend, repo, logs o CI.
- [ ] Migraciones no fueron probadas en staging.
- [ ] No existe backup productivo reciente.
- [ ] Upload, signed URLs, avatar upload/delete o descarga de informes fallan.
- [ ] Admin, clinica o particular no pueden completar su smoke principal.
- [ ] Hay dudas legales/comerciales bloqueantes sobre contenido publico.

## Evidencia de validacion del PR

Completar al cerrar el PR de readiness:

- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm -C frontend build`
- [ ] Archivo actualizado: `docs/release-readiness.md`
