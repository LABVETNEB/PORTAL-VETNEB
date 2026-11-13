# PR-SEC-10 — Diseño de staging aislado (precondición de E3/E4/E6)

Estado base: `b9d88659` (`origin/main`, EV-01 #2001). Scope: **docs-only** (diseño). Riesgo del documento: R1. Toda operación sobre Render, Supabase, DNS o Cloudflare que describe es **R3** y **no está autorizada** por este documento. No se creó infraestructura, no se tocó producción, no hay cambios de código.

Revisión 10: build corregido y redeploy exitoso; `vetneb-api-stg` Live (arranque, preflight y bucket privado de staging verificados). Revisión 9: `vetneb-api-stg` creado en Staging; primer deploy fallido en el build por `corepack enable` (EROFS), sin tocar bases; corrección propuesta pendiente de autorización. Revisión 8: entorno Render «Staging» creado (vacío) y variables del frontend público (nombres); región Ohio. Revisión 7: administrador sintético creado (§11.4) y procedimiento de Render staging (§11.5). Revisión 6: esquema migrado en staging y verificado (§11.2); precondiciones del administrador y de Render (§11.3). Revisión 5: Supabase staging creado y verificado (§11.1, «Resultado de la ejecución»). Revisión 4: decisión definitiva — organización `LABVETNEB-STAGING` y proyecto `vetneb-staging` (§4A, §11.1); el límite de 2 proyectos Free es global. Revisión 3: cierra la capacidad de Supabase (§4A). Revisión 2: incorpora la lectura de código del alta de cuentas, la evidencia de DNS público, el procedimiento de migración seguro y los costos verificados. **Corrige la revisión 1**: `portal-vetneb-frontend-staging` es el frontend de **producción** (§1).

## 0. HANDOFF entre ordenadores (estado al 2026-11-12)

Para retomar el trabajo en otra máquina: leer `AGENTS.md`, este documento completo (sobre todo §6, §11.1–§11.5) y continuar desde «Pendiente». Ningún secreto está en este documento ni en el repositorio.

**Hecho y verificado (no repetir):**

| Elemento | Estado |
|---|---|
| Organización Supabase `LABVETNEB-STAGING`, proyecto `vetneb-staging`, referencia **`qlupryhscwlihzsxbmqy`**, Free, `us-west-2`, 1 miembro, sin GitHub | Creado (§11.1) |
| Migraciones | **32 migraciones completadas** y `schema:verify` en verde; 28 tablas (§11.2). **No volver a migrar** |
| Administrador `stg-admin` | **Creado** (1 fila en `admin_users`, argon2id) (§11.4). **No volver a crearlo** |
| Entorno Render `Staging` (proyecto `PORTAL-VETNEB`) | Creado (§11.5) |
| Backend `vetneb-api-stg`, servicio `srv-dbr5u80u01pc73a9e4a0` | **Live** en `https://vetneb-api-stg.onrender.com`; Free, Ohio, Auto-Deploy Off |
| Deploy exitoso | `dep-dbr60ttckfvc73dafji0`, commit desplegado **`b9d88659`** |
| Runtime | Node **24.22.1** (`NODE_VERSION`), pnpm **11.13.1**; build `pnpm install --frozen-lockfile && pnpm build`; start `pnpm start`; health `/health` |
| Build y arranque | Satisfactorios; preflight completado (limpiezas con 0 filas); bucket privado `reports` creado en Supabase staging |

**ADVERTENCIA — los nombres engañan:** los servicios existentes `portal-vetneb-backend-staging` (atiende `api.vetneb.com.ar`) y `portal-vetneb-frontend-staging` (atiende `www.vetneb.com.ar`) son **PRODUCCIÓN**. `PORTAL-VETNEB` (Free) es un backend que comparte base y proyecto Supabase con producción. Ninguno puede usarse, modificarse ni probarse como staging. El staging real son únicamente `vetneb-api-stg` (y el futuro `vetneb-web-stg`) más el proyecto Supabase `vetneb-staging`.

**Pendiente (cada punto requiere autorización R3 expresa de Nico; ver §11.5 y §12):**

1. Crear el frontend `vetneb-web-stg` en el entorno Staging (con `NEXT_PUBLIC_API_URL=https://vetneb-api-stg.onrender.com`; sin `corepack enable`; ver §11.5). Si su URL real difiere de `https://vetneb-web-stg.onrender.com`, corregir `CORS_ORIGIN` y `PUBLIC_SITE_URL` del backend.
2. Verificaciones de aislamiento I1–I8 (§9) y comparación de referencias entre servicios.
3. Prueba de login de `stg-admin` por HTTP y smoke público; alta de clínicas y accesos sintéticos por la API de staging.
4. Campaña **E3 / E4 / E6** con instrumentación temporal de diagnóstico (§10).
5. **Implementación y cierre de PR-SEC-10** (exigir `TRUST_PROXY` en producción): sigue **BLOQUEADA** hasta tener E3, E4 y E6; ninguna evidencia local o de staging debe presentarse como cierre.

**Qué NO está en el repositorio (hay que recrearlo o recuperarlo):**

- Los scripts de PowerShell usados para la guarda de destino, la migración y el alta del administrador (viven fuera del repo, a propósito, por su manejo de secretos). Se recrean con la lógica descrita en §6, §11.2, §11.4 y §11.5 (guarda de destino por igualdad exacta con la referencia staging y rechazo de la de producción; sin `.env`; ambas variables de base con el mismo valor; entrada oculta para secretos).
- Contraseñas, claves de Supabase y URLs de conexión: solo en el gestor de contraseñas de Nico.
- Sesiones autenticadas del navegador (Render, Supabase): deben iniciarse en la otra máquina.
- Las notas de memoria del asistente son locales de cada máquina.

**Reglas que siguen vigentes:** no copiar variables ni credenciales de producción; no ejecutar nada contra los servicios públicos; `TRUST_PROXY`, `SMTP_*`, `GMAIL_API_*`, `CONTACT_TO` y `DATABASE_URL` ausentes en staging; Git y GitHub según la matriz de `AGENTS.md` §5.

## 1. Por qué hace falta

PR-SEC-10 (exigir `TRUST_PROXY` en producción) está bloqueado por evidencia de topología: peer inmediato (E3), IP/CIDR de proxies entrantes (E4) y cadena `X-Forwarded-For` (E6). Esas pruebas necesitan tráfico real hacia un backend desplegado. Hoy no existe un backend aislado donde hacerlas.

Evidencia establecida (metadatos de Render y DNS público; no se repite):

| Servicio | Rol efectivo | Evidencia |
|---|---|---|
| `portal-vetneb-backend-staging` | **Backend público de producción** | Plan Starter; dominio `api.vetneb.com.ar` |
| `portal-vetneb-frontend-staging` | **Frontend de producción** | DNS público: `www.vetneb.com.ar` es un CNAME hacia `portal-vetneb-frontend-staging.onrender.com` |
| `PORTAL-VETNEB` (Free) | Backend Fastify **sin aislamiento** | Mismo proyecto Supabase y misma base PostgreSQL que producción (comparación IGUAL) |

Los tres despliegan `b9d88659`. `TRUST_PROXY` está ausente en ambos backends. Conclusión: **ningún servicio existente es utilizable como staging**: ni el backend, ni el Free, ni el frontend.

Nombres engañosos: no se renombra nada en este PR. Desde aquí "producción" = el servicio que atiende el dominio público correspondiente, sin importar su nombre en Render. El apex `vetneb.com.ar` resuelve a una dirección A de Render; su enrutamiento (redirección a `www` u otro) no se verificó.

## 2. Auditoría de dependencias (código ejecutable)

| Dependencia | Dónde se origina | Efecto sobre staging |
|---|---|---|
| PostgreSQL | `server/lib/env.ts:210` `SUPABASE_DB_URL ?? DATABASE_URL` (prima la primera) | Si apuntan al destino equivocado, el backend escribe ahí. |
| Supabase (cliente + Storage) | `server/lib/supabase.ts`: `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`; bucket `SUPABASE_STORAGE_BUCKET` (default `reports`) | La service-role key da acceso total al proyecto al que pertenece. |
| Arranque con escritura | `server/preflight.ts`: `select 1`, `ensureStorageBucketExists()` (puede **crear** el bucket) y borrado de sesiones expiradas (clínica, admin, particular) y estados de búsqueda global | **Arrancar un servicio contra el destino equivocado ya escribe en él.** Las variables deben estar correctas antes del primer arranque. |
| Auth y sesiones | Cookies propias (`admin_session_id`, `app_session_id`, particular); sin Supabase Auth | El aislamiento de sesiones depende solo de la base. `cookieSecure` y `SameSite=none` con `NODE_ENV=production`. |
| Hash de contraseñas | `server/lib/auth-security.ts`: `hashPassword` = argon2id; el SHA-256 legado solo verifica y fuerza rehash | Las cuentas sintéticas deben nacer con argon2id (§3). |
| Migraciones | `pnpm db:migrate` = `drizzle-kit migrate`; esquema `drizzle/schema.ts`; migraciones 0000–0031 | Extensiones: `pgcrypto`, `pg_trgm`, `unaccent`. Verificación: `pnpm schema:verify`. |
| Resolución de URL de migración | `scripts/db/resolve-drizzle-db-url.mjs` | Ver §6. |
| Scripts de datos y `schema:verify` | `scripts/db/*.mjs` y `scripts/schema-verify.mjs`: `import "dotenv/config"` y `SUPABASE_DB_URL \|\| DATABASE_URL` | `dotenv/config` carga el `.env` local sin pisar variables ya definidas. Ver regla de §6. |
| SMTP / Gmail | `server/lib/email.ts`; destinatarios `CONTACT_TO` (en producción sin valor = sin destinatarios) | `SMTP_*`, `GMAIL_API_*`, `CONTACT_TO` ausentes = correo desactivado. |
| Integraciones externas | Únicas URLs salientes en `server/`: `oauth2.googleapis.com` y `gmail.googleapis.com` | Sin webhooks ni otras integraciones salientes. |
| Tareas automáticas | Sin `setInterval`, cron ni scheduler; solo el cleanup de arranque | Sin procesos periódicos que escriban. |
| CI/CD hacia Render | `app-version-force-update.yml` usa `RENDER_API_KEY`, `RENDER_BACKEND_SERVICE_ID`, `RENDER_FRONTEND_SERVICE_ID` y deploy hooks | Un servicio nuevo no se ve afectado salvo que se reapunten esos secrets. Prohibido reapuntarlos. |
| CORS y dominios | `CORS_ORIGIN`, `PUBLIC_SITE_URL`; `frontend/next.config.ts` reescribe `/api/:path*` hacia `NEXT_PUBLIC_API_URL` | `NEXT_PUBLIC_*` se incorporan en el **build**; cambiarlas exige rebuild. |
| Rate limiting y auditoría | Tablas persistentes en la misma base; clave de IP vía `request.ip` | En staging viven en la base staging. |
| Versión de cliente | `CLIENT_MIN_VERSION` (sin valor = gate desactivado) | Staging no debe heredar el token de contrato de producción. |

Marcador de entorno: `env.ts` no tiene variable que identifique "staging" (`NODE_ENV` ∈ development/test/production). La identificación se apoya en evidencia externa (criterio I7). Agregar un marcador sería un cambio de código R2, fuera de este PR.

## 3. Alta de cuentas (verificado por lectura de código)

Hallazgo: **ningún código ni script de este repositorio crea la primera cuenta administradora.**

- `drizzle/schema.ts:223`: tabla `admin_users` (`username`, `email`, `password_hash`).
- Ninguna migración inserta filas en `admin_users`; no hay `INSERT` en `server/` ni en `scripts/`.
- `server/routes/admin-users-roles.fastify.ts` solo expone `GET` y `PATCH` (`access-control-allow-methods: GET,PATCH,OPTIONS`): no crea administradores.
- Por lo tanto, en producción el administrador inicial se creó fuera del repositorio (SQL manual o equivalente). No hay procedimiento documentado ni reproducible.

Diseño para staging:

1. **Primer administrador (R3, solo en staging):** generar una contraseña aleatoria con un generador criptográfico local, calcular su hash argon2id con `hashPassword` de `server/lib/auth-security.ts` en un script local descartable, e insertar la fila en `admin_users` del proyecto **staging** (editor SQL de Supabase staging o conexión verificada con la guarda de §6). La contraseña se guarda en un gestor de contraseñas; no se imprime, no se pega en chat ni en el repo. Nunca insertar un hash SHA-256 legado.
2. **Resto de cuentas, por la API real de staging** (con la sesión del administrador sintético, desde el origen de confianza de staging):
   - `POST /api/admin/clinics` (`server/routes/admin-clinics.fastify.ts:391`) crea clínica y usuario de clínica con `clinicName`, `contactEmail`, `contactPhone`, `username`, `password`, `role`; la contraseña se hashea con el hasher del servidor.
   - `POST /api/admin/particular-tokens` (`admin-particular-tokens.fastify.ts:403`) emite accesos de particular.
3. **Prohibido para staging:** `scripts/db/list-or-create-clinic-user.mjs` y `prepare-known-clinic-user.mjs` (usuario `publicdemo`, contraseña fija `demo1234` con hash SHA-256 legado: credencial débil y conocida en una URL pública) y cualquier script que lea `.env`.
4. Datos sintéticos: nombres con prefijo `STG-`, correos de documentación (`@example.invalid`), sin datos clínicos reales.

Gap documentado (no se corrige aquí, R2 aparte): falta un procedimiento reproducible de alta del primer administrador. Un script de aprovisionamiento con guarda de destino sería la solución de código; queda como seguimiento.

## 4. Arquitectura propuesta

```text
Navegador de prueba ─► frontend staging (Render, NUEVO) ─rewrite /api─► backend staging (Render, NUEVO)
                                                                          │
                                                       Supabase staging (NUEVO: Postgres + Storage propios)
Producción (sin cambios): www.vetneb.com.ar ─► portal-vetneb-frontend-staging ─► portal-vetneb-backend-staging (api.vetneb.com.ar) ─► Supabase producción
```

### A. Proyecto Supabase staging (nuevo)

- Proyecto y base propios; claves exclusivas (`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, contraseña de base). Nunca se copian de producción.
- **Decisión (Nico): organización Supabase independiente `LABVETNEB-STAGING`, con un proyecto Free `vetneb-staging`.** Sin integración con GitHub, sin credenciales de producción copiadas, y sin usuarios, bases de datos ni Storage compartidos con producción. Pasos exactos en §11.1.
- Límite de identidad que no se elimina: la cuenta humana de Nico es propietaria de ambas organizaciones. El aislamiento es de organización, proyecto, base, Storage, claves y facturación; no de persona. No invitar a otros usuarios a `LABVETNEB-STAGING` y no crear tokens de acceso personal ni usar la CLI de Supabase con sesión iniciada para ambos entornos (esos tokens y esa sesión abarcan todas las organizaciones de la cuenta).
- Esquema: §6. Datos: §3.
- Límites de plan (página oficial de precios de Supabase): Free = 500 MB de base, 1 GB de Storage, **pausa automática tras 7 días sin actividad**, sin backups, 2 proyectos Free activos (según Nico, el límite es **global** para las organizaciones donde es propietario o administrador, no por organización). Pro = desde USD 25/mes, sin pausa, backups diarios (7 días).
- **Capacidad actual (verificada en el panel de Supabase, solo lectura, 2026-11-12):**
  - Una sola organización: «Organización de LABVETNEB», **plan gratuito**, **1 proyecto** (lista de organizaciones y página de proyectos).
  - Ese proyecto es el de producción (tarjeta con computación NANO, región `us-west-2` y vinculado al repositorio `LABVETNEB/PORTAL-VETNEB`). No figura como pausado.
  - Proyectos Free activos: **1 de 2** (límite global de la cuenta). **Capacidad restante: 1 proyecto.** Esta revisión **retira** la suposición anterior de que cada organización nueva traía su propio cupo: crear una organización no aumenta el límite.
  - El formulario «Nuevo proyecto» de esa organización se abre sin aviso de límite y con el botón de crear habilitado. No se creó nada ni se envió el formulario.
  - **Costo adicional para `vetneb-staging` Free: 0.** No hace falta contratar un plan. El proyecto ocupa el **último** cupo Free: con staging creado quedan 2 de 2 y **no habrá margen para un tercer proyecto Free** en ninguna organización; otro proyecto exigiría Pro o eliminar/liberar uno. No verificado: si un proyecto pausado por inactividad libera cupo.
  - La organización nueva se crea porque aporta aislamiento de miembros, facturación y claves, **no** cupo.
  - **Integración con GitHub:** el proyecto de producción muestra vínculo con el repositorio del proyecto. No se verificó qué automatiza (migraciones o ramas de vista previa). **No conectar GitHub al proyecto staging** hasta revisar esa integración.

### B. Backend staging en Render (servicio nuevo)

- Nombre inequívoco, p. ej. `vetneb-api-stg`. Entorno de Render separado ("Staging"), no el entorno "Production".
- Comandos derivados de los scripts reales: build `corepack enable && pnpm install --frozen-lockfile && pnpm build`, start `pnpm start`.
- Repositorio `LABVETNEB/PORTAL-VETNEB`; **auto-deploy desactivado**: deploy manual del commit elegido.
- Variables (solo nombres):
  - Requeridas por el esquema: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`.
  - Operativas: `NODE_ENV=production`, `PORT`, `CORS_ORIGIN` (solo el origen del frontend staging), `PUBLIC_SITE_URL` (idem), `SUPABASE_STORAGE_BUCKET` (bucket propio).
  - **Ausentes a propósito:** `DATABASE_URL`, `SMTP_*`, `GMAIL_API_*`, `CONTACT_TO`, `CLIENT_MIN_VERSION`, `TRUST_PROXY` (se carga recién en la fase E4).
- Prohibido clonar el servicio o copiar el entorno de producción en bloque.

### C. Frontend staging (servicio nuevo; el existente NO se reutiliza)

- `portal-vetneb-frontend-staging` sirve `www.vetneb.com.ar`: es producción. Reconfigurarlo cambiaría el sitio público. **Prohibido reutilizarlo.**
- Servicio nuevo (p. ej. `vetneb-web-stg`), mismo entorno "Staging", repositorio y rama controlados, comandos derivados del servicio de producción: build `pnpm install --frozen-lockfile && pnpm -C frontend build`, start `pnpm -C frontend start`.
- Variables: `NEXT_PUBLIC_API_URL` = URL del backend staging; `NEXT_PUBLIC_SITE_URL` = URL del frontend staging. Se fijan **antes** del primer build (se incorporan al bundle y al rewrite).
- Nunca `DATABASE_URL`, `SUPABASE_*` de servidor ni `SMTP_*` en el frontend.

### D. Aislamiento operativo

- Entorno Render "Staging" distinto; proyecto/organización Supabase distintos; secrets de GitHub de producción sin tocar.
- Correo: sin `SMTP_*` ni `GMAIL_API_*` → `getTransporter` devuelve `null`; sin `CONTACT_TO`, en producción no hay destinatarios (falla cerrada).
- Acceso: solo credenciales sintéticas; URL no enlazada desde sitios públicos.
- Sin cron ni jobs (§2).
- Higiene local: migraciones y scripts de datos solo con la guarda de §6.

## 5. Topología de red observada por DNS público (E2 parcial)

Consultas DNS (A, AAAA, CNAME, NS); ninguna solicitud HTTP a la aplicación. Sin direcciones de usuarios.

| Hecho | Nivel |
|---|---|
| El DNS de `vetneb.com.ar` está delegado a Cloudflare (servidores de nombres `*.ns.cloudflare.com`) | Confirmado por DNS público |
| `www` → `portal-vetneb-frontend-staging.onrender.com`; `api` → `portal-vetneb-backend-staging.onrender.com` | Confirmado por DNS público |
| Los tres nombres `*.onrender.com` (y por tanto `www` y `api`) siguen la misma cadena: `gcp-us-west1-1.origin.onrender.com` → `*.cdn.cloudflare.net`, y terminan en dos direcciones A de Render | Confirmado por DNS público |
| **Cloudflare participa en el borde de Render** para todos los hosts `onrender.com` (el CNAME de Render termina en `cdn.cloudflare.net`) | Confirmado por DNS público (cadena); su efecto sobre `X-Forwarded-For` y el peer no está verificado |
| Los registros `www` y `api` de la zona del usuario están en modo **solo DNS** (resuelven mediante CNAME hacia Render, sin direcciones propias de Cloudflare) | Inferido |
| El apex `vetneb.com.ar` resuelve a una dirección A de Render; tipo de redirección no verificado | Confirmado (resolución); no verificado (comportamiento) |
| Región: `us-west1` en la cadena DNS; el panel mostró Ohio para un servicio | No concluyente; no verificado |

Consecuencias para el diseño:

- Un backend nuevo accedido por su URL `onrender.com` recorre **el mismo borde** que `api.vetneb.com.ar`. El subdominio de staging en la zona de Cloudflare **ya no es necesario** para igualar la ruta de red (se degrada a opcional). Sigue sin verificarse si un host por defecto y un dominio propio se enrutan igual dentro de Render, y si Free y Starter pasan por el mismo borde.
- Que Cloudflare esté en el camino implica que el peer y la cadena `X-Forwarded-For` en Fastify pueden incluir saltos de Render y de Cloudflare. No se sabe cuántos ni cuáles. E4/E6 deben determinarlo por observación; no se infiere ningún CIDR de la propiedad de las direcciones DNS.
- **Regla de equivalencia de plan:** si el plan Free pudiera cambiar el camino, la evidencia final de E3/E6 se confirma en Starter. Render factura por segundo (fuente no oficial), de modo que una campaña corta en Starter cuesta pocos centavos.

## 6. Procedimiento de migración que no puede apuntar a producción

Análisis de `scripts/db/resolve-drizzle-db-url.mjs` (con `drizzle.config.ts`):

- Usa el entorno del proceso; solo si **ninguna** de las dos variables existe en el proceso cae al `.env`. Si alguna existe (aunque esté vacía), el `.env` no se consulta; una variable vacía sin la otra produce el error «Falta…».
- Si ambas están definidas con valores distintos falla (sin eco de valores).
- **No valida el destino**: acepta cualquier URL `postgres://`. La tabla de pruebas existente (`drizzle-config-db-url.test.ts`, DRZ-01…) cubre la resolución, no el destino.
- Los scripts de `scripts/db/*.mjs` y `schema-verify.mjs` usan `dotenv/config` y `SUPABASE_DB_URL || DATABASE_URL`: si solo se define `DATABASE_URL` en el proceso y el `.env` trae `SUPABASE_DB_URL` de producción, **gana el valor de producción**.

Reglas del procedimiento:

1. **Definir siempre las dos variables, con el mismo valor** (forma admitida por el resolver y por CI). Así el `.env` no interviene en ningún script.
2. **Nunca** definir las variables de base en el `.env` de la máquina que migra staging.
3. Validar el destino con una **guarda de referencia** antes de ejecutar: el operador ingresa la referencia del proyecto staging y la de producción (identificadores no secretos de 20 letras minúsculas); la URL debe ser Supabase, contener la referencia staging en el host o en el usuario del pooler, y **no** contener la de producción.
4. La URL se pide con entrada segura; no se imprime, no se escribe en archivos ni en el historial.
5. Limpiar las variables al terminar.

Procedimiento listo para ejecutar con autorización R3 (Terminal 1, PowerShell, directorio del repo):

```powershell
$ErrorActionPreference = 'Stop'
Remove-Item Env:SUPABASE_DB_URL, Env:DATABASE_URL -ErrorAction SilentlyContinue

$ref     = Read-Host 'Referencia del proyecto STAGING (no secreta)'
$prodRef = Read-Host 'Referencia del proyecto PRODUCCION (no secreta)'
if ($ref -notmatch '^[a-z]{20}$' -or $prodRef -notmatch '^[a-z]{20}$') { throw 'referencia invalida' }
if ($ref -eq $prodRef) { throw 'las referencias son iguales' }

$sec = Read-Host 'URL de base STAGING' -AsSecureString
$url = [System.Net.NetworkCredential]::new('', $sec).Password
$u = [uri]$url
if ($u.Scheme -notin 'postgres','postgresql') { throw 'esquema invalido' }
if ($u.Host -notmatch '(^|\.)supabase\.(co|com)$') { throw 'host no Supabase' }
$user = [uri]::UnescapeDataString(($u.UserInfo -split ':')[0])
if (("$($u.Host)|$user").Contains($prodRef)) { throw 'destino contiene la referencia de PRODUCCION' }
if (-not ($u.Host.Contains($ref) -or $user.EndsWith(".$ref"))) { throw 'destino no coincide con STAGING' }
'GUARDA: PASS (destino coincide con la referencia staging)'

$env:SUPABASE_DB_URL = $url
$env:DATABASE_URL    = $url
try {
  pnpm db:migrate;    if ($LASTEXITCODE -ne 0) { throw 'db:migrate fallo' }
  pnpm schema:verify; if ($LASTEXITCODE -ne 0) { throw 'schema:verify fallo' }
} finally {
  Remove-Item Env:SUPABASE_DB_URL, Env:DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Variable url, sec -ErrorAction SilentlyContinue
}
```

Validación de la guarda: la lógica se ejecutó localmente con 8 casos sintéticos (referencias ficticias; sin red ni secretos): acepta host directo y pooler del staging; rechaza host directo y pooler de producción, referencia distinta, host no Supabase, esquema inválido y URL no válida (7/8 por la causa de rechazo esperada; el caso «URL no válida» también rechaza, con un mensaje distinto) y referencias iguales. No se ejecutó contra ninguna base real.

Endurecimiento de código recomendado (R2, PR aparte, no incluido): que el resolver exija una variable de destino permitido (p. ej. una referencia esperada) y un test que la cubra; y que los scripts de `scripts/db/` usen el mismo resolver.

## 7. Costos (USD/mes)

Verificación de fuentes:

| Dato | Fuente | Estado |
|---|---|---|
| Render Free: 0.1 CPU/512 MB, se duerme tras 15 min sin tráfico, arranque ~1 min, 750 h/mes por workspace, sin disco persistente | Documentación oficial de Render | Verificado |
| Render compute plans: Starter 0.5 CPU/512 MB, Standard 1 CPU/2 GB | Documentación oficial | Verificado (especificaciones) |
| Render Starter ~7 y Standard ~25 | Fuentes secundarias (artículos y comunidad); la página oficial de precios consultada no muestra importes | **No verificado oficialmente** |
| Tarifas de plan de workspace de Render | No disponibles en las páginas accesibles | No verificado |
| Supabase Free (500 MB, 1 GB Storage, pausa a 7 días, 2 proyectos activos) y Pro (desde 25, 8 GB, sin pausa, backups diarios) | Página oficial de precios | Verificado |

| Opción | Backend | Frontend | Supabase | Total |
|---|---|---|---|---|
| **Comenzar (preferida)** | Render Free | Render Free | Free | **0** |
| Escalar si Free interfiere | Starter (~7) | Free | Free | **~7** |
| Representativa | Starter/Standard (~7 / ~25) | Starter (~7) | Pro (25) | **~39–57** |

Criterio de escalada a Starter: arranques en frío o suspensión de horas que impidan completar una campaña, o necesidad de confirmar E3/E6 en el mismo plan que producción (§5). Si el backend Free agota las 750 horas compartidas, el workspace suspende los servicios Free (también el `PORTAL-VETNEB` Free existente, que comparte workspace): vigilar el consumo antes de la campaña.

## 8. Riesgos de contaminación entre entornos

| Riesgo | Causa | Control |
|---|---|---|
| Staging escribe en la base de producción | Variable copiada; precedencia `SUPABASE_DB_URL ?? DATABASE_URL`; el preflight escribe al arrancar | Variables cargadas **antes** del primer deploy; `DATABASE_URL` ausente; I1–I3 |
| Frontend staging llama a la API de producción | `NEXT_PUBLIC_API_URL` incorporado en el build | Servicio nuevo con la variable fijada antes del primer build; I4 |
| **Modificar el frontend de producción creyendo que es staging** | Nombre `portal-vetneb-frontend-staging` | No reutilizar; no tocar ese servicio |
| Migración contra producción desde la PC | `.env` local; el resolver no valida destino | Procedimiento de §6 |
| Correo real desde staging | `SMTP_*`/`CONTACT_TO` copiados; el runbook `docs/staging-smoke-runbook.md` lista `CONTACT_TO` y `SMTP_PASS` reales para ese servicio | Variables ausentes; I5 |
| Credencial débil conocida en staging | `scripts/db/*` con `publicdemo`/`demo1234` | No usarlos (§3) |
| Pipeline de versión toca el servicio equivocado | Secrets `RENDER_*_SERVICE_ID` | No modificarlos |
| Datos reales en staging | Restauración de dumps | Prohibido (AGENTS §15, §17); solo sintéticos |
| Conclusiones de topología falsas | Plan o ruta distintos | Regla de equivalencia de plan (§5) |

Contradicciones reportadas, sin editar: `docs/staging-smoke-runbook.md` describe `portal-vetneb-backend-staging` y `portal-vetneb-frontend-staging` como staging, pero son producción; `docs/production-readiness-evidence.md` y `docs/ops/production-readiness-audit.md` afirman `TRUST_PROXY=1` en producción, pero la variable está ausente (y `env.ts` rechaza `1`).

## 9. Validación de aislamiento (criterios observables)

| ID | Prueba | Método | Aprobación |
|---|---|---|---|
| I1 | Proyecto Supabase distinto | Comparar en el panel hashes parciales del identificador de proyecto de `SUPABASE_URL` entre ambos backends, dentro del navegador, sin mostrar valores | **DIFERENTE** |
| I2 | Destino PostgreSQL distinto | Igual, sobre host, puerto y base de `SUPABASE_DB_URL` | **DIFERENTE** |
| I3 | Credenciales sin acceso a producción | En el panel de Supabase de producción, las claves staging no existen; prueba negativa autorizada con credencial staging contra el proyecto productivo | Rechazo; ninguna escritura |
| I4 | Frontend usa solo la API staging | Buscar en los assets del frontend staging el host de producción y el del backend staging | Producción: 0 apariciones; staging: ≥1 |
| I5 | Sin integraciones capaces de alterar producción | Ausencia de `SMTP_*`, `GMAIL_API_*`, `CONTACT_TO`; el formulario de contacto responde sin envío | Variables ausentes; sin correo |
| I6 | Datos sintéticos | Conteo y marcador `STG-` en clínicas/usuarios | 100% con marcador; 0 datos reales |
| I7 | Identificación inequívoca | Nombre y host del servicio; commit desplegado (`RENDER_GIT_COMMIT`) igual al esperado; ningún dominio de producción asociado | Coincidencia exacta |
| I8 | Sin rutas accidentales a producción | Revisión de variables: ninguna referencia a `api.vetneb.com.ar` ni a `www.vetneb.com.ar`/`vetneb.com.ar` salvo lo previsto; secrets de GitHub no apuntan a servicios nuevos | 0 referencias |

Estado de cada criterio hoy: **NOT_RUN** (el entorno no existe).

## 10. Protocolo E3 / E4 / E6 (diseñado, no ejecutado)

Precondiciones: I1–I8 en PASSED; autorización R3 específica para los servicios staging; cliente de prueba controlado por el operador.

Sanitización: ninguna IP real de usuario ni cadena `X-Forwarded-For` completa se imprime, guarda o transmite. Solo categorías y booleanos.

Instrumentación temporal mínima (propuesta; no se implementa aquí):

- Hook `onRequest` de diagnóstico en un **commit de diagnóstico desplegado solo al backend staging**, nunca fusionado a `main` ni desplegado a producción.
- Doble activación: variable explícita de diagnóstico y un marcador presente solo en staging; por defecto desactivado.
- Por solicitud registra: familia del peer (IPv4/IPv6), clase del peer (loopback, privada RFC 1918, CGNAT, pública), número de entradas de `X-Forwarded-For` y, por posición: validez, clase, y coincidencia con el hash de la IP del operador (variable con el hash calculado fuera del sistema) o con el valor de control `203.0.113.77` (rango de documentación).
- No registra IP completa, cabeceras completas, cookies, tokens ni cuerpo.
- Duración acotada.

Pruebas:

- **E3:** por la ruta del navegador (frontend→API) y directo a la API: familia y clase del peer; repetir N veces espaciadas en el tiempo y entre reinicios para ver variación.
- **E6:** (a) sin `X-Forwarded-For` del cliente: número de entradas y posición del operador; (b) con `X-Forwarded-For` de control: si llega, en qué posición y si el proxy lo conserva, agrega o sobrescribe; (c) diferencia frontend→API frente a directo. La presencia de una cabecera no prueba que sea confiable.
- **E4:** un peer observado no prueba que todos los peers pertenezcan a un rango estable. Un CIDR solo es admisible si el peer es de una clase estable en todas las repeticiones, el proveedor lo confirma por escrito (documentación o soporte) y se demuestra que un tercero no puede originar tráfico desde ese rango hacia el servicio. Sin confirmación del proveedor, E4 queda BLOCKED. Ninguna página oficial de Render consultada publica rangos entrantes.
- **Cloudflare:** la participación en el borde de Render está confirmada por DNS (§5); falta establecer si los saltos de Cloudflare aparecen en la cadena que recibe Fastify.

Criterios de retiro de la instrumentación: acta sanitizada registrada; redeploy desde `main` y comprobación por grep y por prueba runtime de la ausencia del hook; variables de diagnóstico eliminadas; rama de diagnóstico borrada (operación manual de Nico).

Pruebas automatizadas previas al despliegue del hook: desactivado no registra nada; activado nunca emite IP completa ni cabeceras; no altera el contrato HTTP; no se activa sin el marcador de staging.

## 11. Secuencia de aprovisionamiento

Todos los pasos de escritura son **R3** y necesitan autorización expresa por paso. «Precondición» indica lo que falta hoy.

| # | Paso | Actor / acceso | Precondición o aprobación adicional |
|---|---|---|---|
| 0 | Confirmar que ningún `.env` local define variables de base de producción; terminal limpia | Agente (R0/R1) | — |
| 1 | Verificar capacidad Supabase (proyectos Free activos) | Agente con sesión Supabase, solo lectura | **Hecho:** 1 de 2 proyectos Free usados; cupo para 1 más sin costo (§4A) |
| 2 | Crear la organización `LABVETNEB-STAGING` y el proyecto `vetneb-staging` (§11.1); anotar solo la referencia | **Nico** (consola, cuenta) | **HECHO y verificado** (referencia `qlupryhscwlihzsxbmqy`; §11.1) |
| 3 | Guardar claves staging en el gestor de contraseñas | **Nico** | — |
| 4 | **HECHO (§11.2)** — Migrar: procedimiento de §6 (`db:migrate` y `schema:verify`) | Agente ejecuta el procedimiento; **Nico ingresa la URL** (entrada segura) | Autorización R3 para ejecutar contra staging; referencias staging/producción informadas por Nico |
| 5 | **HECHO (§11.4)** — Primer administrador sintético (§3, punto 1) | Agente prepara el hash localmente; **Nico** inserta en staging | Autorización R3; contraseña solo en el gestor |
| 6 | Crear entorno Render "Staging" y backend nuevo con **todas** las variables en el formulario de creación; auto-deploy desactivado; sin `TRUST_PROXY` | **Nico** (consola) o agente con sesión Render autorizada | Autorización R3; claves cargadas por Nico |
| 7 | Verificar I1, I2, I5, I7, I8 antes de cualquier prueba funcional | Agente (lectura en panel) | Autorización R3 de lectura |
| 8 | Crear frontend nuevo con `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_SITE_URL` fijadas **antes** del primer build; verificar I4 | Nico/agente | Autorización R3 |
| 9 | Alta de clínicas y accesos sintéticos por la API de staging (§3, punto 2) | Agente por HTTP a staging | Autorización R3 (solicitudes a staging) |
| 10 | Verificar I3 y I6 | Agente/Nico | Autorización R3 (prueba negativa) |
| 11 | Campaña E3/E4/E6 con el hook temporal (§10) | Agente con autorización R3 independiente | Hook aprobado por PR y tests; despliegue solo a staging |
| 12 | (Opcional) subdominio de staging en la zona de Cloudflare | Nico | Autorización R3 (DNS); ya no necesario para igualar la ruta (§5) |

Rollback: suspender o eliminar los servicios nuevos y el proyecto Supabase staging; revertir cualquier DNS de staging. No hay cambios de código ni de producción que deshacer. Si en el paso 6 se observa escritura en un destino inesperado, **detener**, suspender el servicio y reportar.

### 11.1 Pasos exactos de creación de Supabase staging (R3, manuales de Nico)

Los nombres de campos son los vistos en el panel (idioma español); los valores de cualquier opción que no se haya observado no se asumen y se marcan «verificar en pantalla».

**Precondiciones (antes de abrir el panel):** sesión iniciada con la cuenta propietaria; gestor de contraseñas abierto; MFA activo en la cuenta; este documento a la vista. Ningún valor secreto se pega en chat, repositorio, tickets ni capturas.

| # | Acción | Verificación (readback) |
|---|---|---|
| 1 | En «Organizaciones» elegir «Nueva organización» | Se abre el formulario de alta |
| 2 | Nombre: `LABVETNEB-STAGING`. Tipo: el que corresponda a uso propio (verificar en pantalla). **Plan: gratuito (USD 0)**; no seleccionar Pro ni cargar tarjeta | El resumen muestra plan gratuito y costo 0 antes de confirmar |
| 3 | Confirmar la creación de la organización | La lista de organizaciones muestra **2** organizaciones: «Organización de LABVETNEB» (1 proyecto) y `LABVETNEB-STAGING` (0 proyectos), ambas en plan gratuito |
| 4 | En `LABVETNEB-STAGING` → configuración → miembros: comprobar que el único miembro es Nico; no invitar a nadie | Un solo miembro |
| 5 | En `LABVETNEB-STAGING` elegir «Nuevo proyecto» | Formulario con «Nombre del proyecto», «Contraseña de la base de datos» y «Región» |
| 6 | Nombre del proyecto: `vetneb-staging`. Contraseña: generada por el gestor (larga y aleatoria); guardarla **antes** de confirmar; no reutilizar ninguna contraseña de producción | La contraseña existe en el gestor |
| 7 | Región: la misma que producción (`us-west-2`) para fidelidad; verificar en pantalla que el costo mostrado sea 0 y que no se seleccione computación de pago | Costo 0; computación del plan gratuito |
| 8 | **No** conectar GitHub ni habilitar integraciones; **no** crear ramas de base de datos | Ninguna integración aparece conectada en el proyecto |
| 9 | Confirmar «Crear nuevo proyecto» y esperar el aprovisionamiento | El proyecto figura activo en `LABVETNEB-STAGING` |
| 10 | Anotar solo la **referencia del proyecto** (20 letras minúsculas, identificador no secreto) | La referencia es distinta de la del proyecto de producción |
| 11 | Revisar el proyecto de producción sin modificarlo | Sigue activo, sin cambios de configuración |
| 12 | Las claves (`anon`, `service_role`) y la cadena de conexión se leen **solo en el panel de `vetneb-staging`** y se copian directamente al gestor; se cargan en Render únicamente en el formulario de creación del servicio (§11, paso 6) | No pasan por chat ni por el repositorio |

Acta mínima (sin valores secretos): organización, nombre del proyecto, referencia, región, plan, fecha y hora UTC, operador, y readbacks 3, 4, 9, 10 y 11.

#### Resultado de la ejecución (2026-11-12; organización y formulario preparados por el agente en Chrome, contraseña y confirmación del proyecto por Nico)

| Verificación | Resultado | Evidencia (solo lectura) |
|---|---|---|
| Organización nueva creada | **SÍ** — `LABVETNEB-STAGING` | Lista de organizaciones: 2, ambas «Plan gratuito», 1 proyecto cada una |
| Proyecto nuevo creado | **SÍ** — `vetneb-staging` | Título del panel `vetneb-staging \| LABVETNEB-STAGING`; la tarjeta del panel traducido muestra el nombre con texto automático |
| Plan Free confirmado | **SÍ** | Formulario «Gratis - $0/mes»; etiqueta GRATIS; facturación «Plan gratuito», sin facturas, sin tarjeta registrada |
| Región | **Oeste de Estados Unidos (Oregón), `us-west-2`** (mostrada como `nosotros-oeste-2`) | Misma región que producción |
| Referencia pública del proyecto | **`qlupryhscwlihzsxbmqy`** (20 letras; identificador no secreto) | URL del panel |
| Referencia distinta de producción | **SÍ** | Comparación en el navegador contra la del proyecto de producción: distintas |
| GitHub conectado | **NO** | Integraciones: solo el selector «Seleccione el repositorio de GitHub»; la tarjeta del proyecto no muestra repositorio (la de producción sí) |
| Miembros de `LABVETNEB-STAGING` | **1** (la cuenta de Nico, rol Dueño) | Pantalla de equipo: «1 miembro», sin invitaciones |
| Producción sin modificaciones | **VERIFICADO por observación** | Sigue como único proyecto de su organización, activo (no pausado), NANO, `nosotros-oeste-2`, vinculado a `LABVETNEB/PORTAL-VETNEB`; solo se leyó; no se abrió ningún formulario sobre ella. No se auditó el registro de actividad |
| Sin credenciales copiadas | **SÍ** | La contraseña de base la ingresó Nico; no se leyeron claves ni cadenas de conexión |

Configuración del formulario decidida por el agente (reversible en el panel del proyecto): «Habilitar la API de datos» marcada; «Exponer automáticamente nuevas tablas» **desmarcada** (recomendación del propio Supabase; el backend usa Postgres directo); «Habilitar RLS automático» sin marcar. Pendiente de comprobar en la fase de migración: que `ensureStorageBucketExists` (Storage) funcione con esa configuración.

Estado al cerrar esta fase: listo para migrar. La migración se ejecutó después; ver §11.2. Cupo: 2 de 2 proyectos Free activos.

Cuenta de cupo después del paso 9: **2 de 2 proyectos Free activos** (límite global de la cuenta).

Rollback: eliminar `vetneb-staging` y luego `LABVETNEB-STAGING` (operación destructiva en la consola; solo Nico; confirmar que el proyecto eliminado es el de staging por su nombre y referencia). Libera el cupo. No afecta a producción.

Criterio de salida de la fase: readbacks 3, 4, 9, 10 y 11 observados y referencia anotada. Hasta entonces los pasos siguientes (migración, Render) están **BLOCKED**.

### 11.2 Migración de esquema en Supabase staging (ejecutada 2026-11-12)

Autorización R3: solo `vetneb-staging` (`qlupryhscwlihzsxbmqy`). Ejecutada con un script de PowerShell fuera del repositorio, lanzado por Nico en su terminal; la URL de conexión se ingresó con entrada oculta y nunca se mostró ni se registró. Registro sanitizado conservado fuera del repositorio.

| Control / resultado | Estado |
|---|---|
| Revisión previa de efectos | Migraciones 0000–0031 (32 entradas de journal). Solo la 0005 contiene `DELETE FROM active_sessions` (inocuo sobre base vacía); la 0031 menciona `DROP TABLE` solo en un comentario. `schema:verify` es solo lectura. Sin scripts `pre`/`post` ni hooks de git. Único proceso `node` abierto: herramienta ajena sin conexiones a bases |
| Riesgo `.env` | El `.env` local define ambas variables de base. Mitigación: ambas variables de proceso con la misma URL de staging, `DOTENV_CONFIG_PATH` apuntando a un archivo inexistente y variables `PG*` borradas |
| Guarda de destino | **PASS**: Session pooler, puerto 5432, base `postgres`, usuario con la referencia staging por **igualdad exacta**, sin parámetros extra, sin la referencia de producción. 9 casos sintéticos previos en verde |
| Destino staging validado | **SÍ** |
| Precheck de solo lectura | 0 tablas en `public`; esquema `drizzle` ausente |
| `pnpm db:migrate` | **PASSED** — 32 migraciones aplicadas; 32 registradas en `drizzle.__drizzle_migrations` |
| `pnpm schema:verify` | **PASSED** — exit 0, 0 columnas críticas faltantes |
| Postmigración (metadatos) | 28 tablas, 143 índices, 121 restricciones, 72 claves foráneas; extensiones `pg_trgm`, `pgcrypto`, `unaccent` |
| Tablas | `active_sessions`, `admin_sessions`, `admin_users`, `audit_log`, `clinic_public_profiles`, `clinic_public_search`, `clinic_users`, `clinics`, `field_visits`, `global_search_states`, `login_failed_attempts`, `login_rate_limits`, `particular_sessions`, `particular_tokens`, `pricing_items`, `report_access_tokens`, `report_status_history`, `reports`, `route_events`, `route_plans`, `route_stops`, `sla_instances`, `sla_policies`, `study_tracking_cases`, `study_tracking_notifications`, `time_windows`, `users`, `visit_locations` |
| Variables temporales | Eliminadas (sin imprimir valores) |
| Producción no intervenida | **SÍ**: la conexión usada fue solo la de staging; no se tocó ninguna conexión de producción |
| Errores | Ninguno |
| Git | Sin cambios de código; el único cambio local es este documento (untracked) |

**Integridad de datos:** la única tabla con filas (estadística aproximada `n_live_tup`, que puede retrasarse) es `pricing_items` con 15 filas. Ver origen abajo. Las demás tablas aparecen sin filas; el conteo exacto no se ejecutó (solo metadatos autorizados).

**Origen de las 15 filas de `pricing_items` (lectura de código):** las inserta la migración `drizzle/migrations/0023_pricing_items.sql` con un `INSERT … SELECT` desde una lista `VALUES` fija: 7 estudios de `CITOLOGÍAS` y 8 de `HISTOPATOLOGÍAS` (orden de visualización 1–7 y 1–8), con `price_label` nulo y `is_active = true`, protegido con `WHERE NOT EXISTS` (idempotente). Son un catálogo de nombres de estudios definido en el repositorio, **sin precios y sin datos de clientes ni de producción**. Son esperadas y no indican contaminación. Otras inserciones en migraciones (`0007` hacia `clinic_public_search`, `0012` hacia `report_status_history`) derivan de tablas de origen que en una base vacía no producen filas. No se modificó ni eliminó ningún dato.

### 11.3 Precondiciones para lo siguiente (no ejecutadas)

**Primer administrador sintético (R3, solo staging):**

- Tabla `admin_users`: `username` (único, obligatorio), `email` (opcional; índice único sobre `lower(email)`), `password_hash` (obligatorio). El login resuelve por usuario o por email (`getAdminUserByIdentifier`), verifica con `verifyPassword`; solo hace falta esa fila (ni rol ni otras tablas).
- Hash: argon2id con `hashPassword` de `server/lib/auth-security.ts`; nunca SHA-256 legado.
- Procedimiento propuesto: script fuera del repositorio, con la **misma guarda de destino estricta de §11.2** y el mismo precheck, que pide el usuario y la contraseña con entrada oculta (dos veces), calcula el hash, inserta **una** fila y consulta solo `count(*)`. Contraseña en el gestor de Nico; nada se imprime ni se escribe en archivos.
- Nombre sugerido: `stg-admin`; email con dominio reservado (`@example.invalid`).
- Prerrequisitos: autorización R3 expresa para esa inserción; la URL de conexión ingresada por Nico; confirmar que `admin_users` está vacía antes (precheck).
- No usar `scripts/db/*` (credenciales fijas) ni SQL con hashes SHA-256.

**Backend Render staging (R3, no creado):**

- Variables: `SUPABASE_URL` (derivable de la referencia staging; no secreta), `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` (secretas; de `vetneb-staging`, copiadas por Nico), `SUPABASE_DB_URL` (la URL del Session pooler, puerto 5432, la misma validada), `NODE_ENV=production`, `PORT`, `CORS_ORIGIN` (obligatorio en producción: falla el arranque si falta; debe ser el origen del frontend staging) y `PUBLIC_SITE_URL`. Ausentes: `DATABASE_URL`, `SMTP_*`, `GMAIL_API_*`, `CONTACT_TO`, `CLIENT_MIN_VERSION`, `TRUST_PROXY`.
- Dependencia circular: el backend exige `CORS_ORIGIN` y el frontend exige la URL del backend en el build. Orden propuesto: crear primero el backend con el origen previsto del frontend, crear el frontend con la URL real del backend y, si la URL del frontend difiere de la prevista, corregir `CORS_ORIGIN` y redeployar el backend. Los nombres de `onrender.com` no están garantizados (el servicio Free existente muestra un sufijo aleatorio).
- Arranque: `preflight` ejecuta `select 1`, crea el bucket privado de Storage si falta (`public: false`; un error de Storage aborta el arranque) y limpia sesiones expiradas. Por eso las variables deben estar correctas **antes** del primer deploy y la Storage API de `vetneb-staging` debe responder (la exposición automática de tablas desmarcada no la afecta, pero se comprueba en el primer arranque).
- Pool: `DATABASE_MAX_CONNECTIONS` (default 3, tope 10) está dentro del límite del pooler; no se necesita cambiarlo.
- Pendiente de verificar en pantalla: que el workspace permita crear un entorno "Staging" y su tarifa; el plan elegido (Free primero, según decisión de Nico); desactivar auto-deploy; fijar el commit `b9d88659` en el primer deploy manual.
- Seguimiento tras el arranque: comprobar los criterios I1, I2, I5, I7 e I8 de §9 sobre el servicio nuevo antes de cualquier prueba funcional.

**Siguiente operación R3 que necesita autorización:** creación del primer administrador sintético en `vetneb-staging` (script con guarda; solo inserción de una fila en `admin_users`). Después, en otra autorización: creación del entorno y del backend en Render.

### 11.4 Primer administrador sintético de staging (ejecutado 2026-11-12)

Autorización R3: una sola fila en `admin_users` de `vetneb-staging` (`qlupryhscwlihzsxbmqy`); el proyecto de producción figuraba como prohibido. Script fuera del repositorio, lanzado por Nico; la URL de conexión y la contraseña se ingresaron con entrada oculta (la contraseña con doble confirmación) y viajaron al proceso de Node por entrada estándar; no se registraron ni se escribieron en archivos.

| Control / resultado | Estado |
|---|---|
| Guarda de destino | **PASS** (Session pooler, puerto 5432, base `postgres`, referencia staging por igualdad exacta, sin la referencia de producción, sin parámetros extra, sin `.env` ni variables `PG*`) |
| Esquema de `admin_users` | `id`, `username` (100, obligatorio, único), `password_hash` (255, obligatorio), `created_at`, `updated_at`, `email` (255, **opcional**); índices `admin_users_pkey`, `admin_users_username_key`, `admin_users_email_lower_uidx` (parcial: solo `email` no nulo) |
| Administradores antes / `stg-admin` preexistente | **0 / 0** |
| Hash | `hashPassword` real del repositorio (`server/lib/auth-security.ts`): formato **argon2id**, cabe en 255, `verifyPassword` lo acepta, **sin necesidad de rehash**; sin SHA-256 legado ni contraseñas por defecto |
| Inserción | **INSERTADO**: una fila, `username = stg-admin`, `email` nulo (el login resuelve por usuario), en una transacción; `id` 1 |
| Lectura posterior (solo lectura) | Administradores después: **1**; usuario presente; todos los hashes argon2id y de longitud válida; email nulo |
| `node exit` | 0 |
| Variables y contraseñas temporales | Eliminadas de la sesión |
| Producción | No tocada |
| Git | Sin cambios de código; solo este documento (untracked) |

No se probó el login por HTTP (autorización independiente). No se crearon clínicas, tokens ni otras cuentas.

### 11.5 Preparación de Render staging (procedimiento; **no ejecutado**)

Servicios nuevos (ambos Web Service, Node, en un entorno «Staging» de Render distinto de «Production»; no se modifica ningún servicio existente):

| Servicio | Nombre propuesto | Build | Start | Salud |
|---|---|---|---|---|
| Backend | `vetneb-api-stg` | `corepack enable && pnpm install --frozen-lockfile && pnpm build` | `pnpm start` | ruta `/health` |
| Frontend | `vetneb-web-stg` | `pnpm install --frozen-lockfile && pnpm -C frontend build` | `pnpm -C frontend start` | por defecto |

Comunes: repositorio `LABVETNEB/PORTAL-VETNEB`, rama `main`, directorio raíz vacío, **Auto-Deploy desactivado**, plan Free (decisión de Nico; escalar a Starter solo según §7), región **Ohio** (igual que los tres servicios de producción; verificar en el formulario). El repositorio no declara versión de Node: fijar `NODE_VERSION` explícita (ver resultado de los pasos 1 a 3) para no heredar un valor por defecto distinto del de producción.

Por qué el frontend es el camino E6: en el navegador, las llamadas van a `/api/*` del mismo origen (`frontend/src/lib/api.ts`), y `next.config.ts` las reescribe hacia `NEXT_PUBLIC_API_URL`. El backend ve entonces el tráfico del **servidor Next**, no del navegador; el acceso directo al backend es el otro camino. Ambos se medirán por separado.

Variables del backend (valores nuevos, nunca copiados de producción):

| Variable | Origen del valor |
|---|---|
| `SUPABASE_URL` | `https://qlupryhscwlihzsxbmqy.supabase.co` (derivada de la referencia) |
| `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Panel de `vetneb-staging`; las copia Nico al gestor |
| `SUPABASE_DB_URL` | La misma URL del Session pooler validada por la guarda (puerto 5432) |
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `CORS_ORIGIN`, `PUBLIC_SITE_URL` | Origen `https://…` del frontend staging, sin barra final (obligatorio en producción; sin él el backend no arranca) |
| Ausentes | `DATABASE_URL`, `SMTP_*`, `GMAIL_API_*`, `CONTACT_TO`, `CLIENT_MIN_VERSION`, `TRUST_PROXY`, `OWNER_OPEN_ID`, `LAB_UPLOAD_USERNAMES` |

Variables del frontend: `NEXT_PUBLIC_API_URL` (URL del backend staging), `NEXT_PUBLIC_SITE_URL` (URL del propio frontend staging) y las demás que el servicio de producción tenga por nombre (se leen **solo los nombres**, no los valores) con valores propios de staging. Se incorporan al build.

Dependencia circular y predicción de URL: el backend exige el origen del frontend y el frontend exige la URL del backend. Los nombres `onrender.com` no están garantizados. Se crea primero el backend con el origen previsto del frontend (`https://vetneb-web-stg.onrender.com`), luego el frontend con la URL real del backend y, si la URL real del frontend difiere, se corrige `CORS_ORIGIN`/`PUBLIC_SITE_URL` (y, en el frontend, `NEXT_PUBLIC_SITE_URL`, con rebuild) y se redeploya.

**Verificaciones locales previas (antes de pegar valores en Render), sin tocar Render:**

| ID | Verificación | Aprobación |
|---|---|---|
| P1 | La URL del Session pooler pasa la guarda de §11.2 (igualdad exacta con la referencia staging, sin la de producción) | PASS |
| P2 | Las claves: si son JWT, el reclamo `ref` de su carga decodificada coincide con la referencia staging y el `role` es el esperado (`anon` / `service_role`); si son del formato nuevo (`sb_publishable_…`/`sb_secret_…`), no hay reclamo decodificable: se comprueba que provienen del panel de `vetneb-staging` y se valida en la fase R3 con una lectura sobre la URL de staging | JWT: coincide y no es la referencia de producción; formato nuevo: procedencia confirmada |
| P3 | `SUPABASE_URL` contiene exactamente la referencia staging | Coincidencia |
| P4 | Ninguna variable de la lista «Ausentes» está definida | 0 definidas |

**Secuencia de aprovisionamiento (cada paso de escritura es R3 con autorización expresa):**

| # | Paso | Actor | R3 |
|---|---|---|---|
| 1 | **HECHO** — Lectura de solo lectura: nombres de variables del frontend de producción; versión de Node: no verificada (ver resultados) | Agente con Chrome | Sí (lectura Render) |
| 2 | **HECHO** — Comprobar que el workspace permite el entorno «Staging» y su costo | Agente | Sí |
| 3 | **HECHO** — Crear el entorno «Staging» en el proyecto (vacío, sin cargos) | Agente con Chrome | Sí |
| 4 | P1–P4 en una terminal | Agente prepara; Nico ingresa secretos | No toca Render; usa secretos de staging |
| 5 | Crear `vetneb-api-stg` con todas las variables en el formulario, Auto-Deploy desactivado; el primer deploy es automático al crear: no hay vista previa de su resultado, por eso P1–P4 van antes | Nico (o agente con sesión autorizada, sin ver los secretos) | Sí |
| 6 | Esperar el primer deploy; comprobar en los logs el arranque (`preflight`: `select 1`, bucket privado, limpieza de sesiones) y el commit `RENDER_GIT_COMMIT` esperado | Agente (lectura de logs) | Sí |
| 7 | Verificar I1, I2, I5, I7 e I8 de §9 sobre el servicio nuevo (comparación en el navegador, sin mostrar valores) | Agente | Sí (lectura) |
| 8 | Crear `vetneb-web-stg` con `NEXT_PUBLIC_API_URL` ya fija | Nico/agente | Sí |
| 9 | Corregir `CORS_ORIGIN`/`PUBLIC_SITE_URL` si la URL real del frontend difiere; redeploy | Nico/agente | Sí |
| 10 | Verificar I4 (activos del frontend: host de producción 0 apariciones; host staging ≥1) | Agente | Sí (solicitudes a staging) |
| 11 | Prueba de login de `stg-admin` por HTTP y smoke público | Agente | Sí (autorización independiente) |
| 12 | Crear clínicas y accesos sintéticos por la API de staging | Agente | Sí |
| 13 | Campaña E3/E4/E6 con commit de diagnóstico (§10) | Agente | Sí (autorización independiente; requiere una rama y un push, operaciones R2 aparte) |

Si en el paso 6 aparece cualquier señal de destino inesperado, **suspender el servicio de inmediato** y reportar.

#### Resultado del paso 5: creación de `vetneb-api-stg` y primer deploy (2026-11-12)

Autorización R3: crear el servicio en el entorno Staging y permitir su primer deploy tras superar las precondiciones. Los tres secretos (`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`) los pegó Nico en el formulario; el agente no los vio.

| Precondición | Resultado |
|---|---|
| P1 guarda de URL de base (terminal de Nico) | **PASS** — Session pooler, 5432 |
| P2 claves (terminal de Nico) | **PASS** — JWT con `ref` staging; roles `anon` y `service_role` |
| P3 `SUPABASE_URL` | **PASS** — `https://qlupryhscwlihzsxbmqy.supabase.co` |
| P4 variables prohibidas | **PASS** — 9 variables; ninguna de `DATABASE_URL`, `SMTP_*`, `GMAIL_API_*`, `CONTACT_TO`, `CLIENT_MIN_VERSION`, `TRUST_PROXY`, `OWNER_OPEN_ID`, `LAB_UPLOAD_USERNAMES` |
| Revisión del formulario antes de crear (decodificación dentro de la pestaña; solo booleanos y longitudes) | Las tres variables presentes; claves JWT con referencia staging y roles correctos, distintas entre sí; la URL de base pasa la guarda estricta (Session pooler, 5432, `/postgres`, sin parámetros); ninguna contiene la referencia de producción; sin hosts de producción en las variables no secretas; `NODE_VERSION` = 24.22.1 |
| Configuración creada | Entorno Staging; Free ($0); Ohio; Node; rama `main`; Auto-Deploy Off; health check `/health`; build `corepack enable && pnpm install --frozen-lockfile && pnpm build`; start `pnpm start`; pre-deploy vacío |
| Servicio | `vetneb-api-stg` (`srv-dbr5u80u01pc73a9e4a0`); deploy `dep-dbr5u88u01pc73a9e54g`; disparador «First Deploy»; commit **`b9d8865`** |

**Primer deploy: FALLÓ** (7 s), en el **build**, antes de ejecutar código de la aplicación:

- El log confirma: commit `b9d8865` en `main`, «Using Node.js version 24.22.1 via environment variable NODE_VERSION».
- Falla el primer comando del build, `corepack enable`: `Internal Error: EROFS: read-only file system, unlink '/usr/bin/pnpm'`; el build sale con estado 1.
- Causa (por el log): la imagen de build de Render con Node 24.22.1 trae `pnpm` instalado en `/usr/bin/pnpm` en un sistema de archivos de solo lectura, y `corepack enable` intenta reemplazar ese enlace. No es un problema de credenciales, de base ni del código de la aplicación.
- Efecto sobre el aislamiento: como el build no terminó, **no se ejecutó el arranque ni el `preflight`**: no hubo conexión a Supabase, no se creó el bucket y no se escribió en ninguna base. Producción no se tocó. No se modificó ninguna variable tras el fallo.
- Estado: el servicio existe en Staging con un deploy fallido; sin reintentos automáticos (Auto-Deploy Off).

Hipótesis de corrección (**aplicada después con autorización expresa; ver el redeploy más abajo**): cambiar el build a `pnpm install --frozen-lockfile && pnpm build` (sin `corepack enable`, como el build del frontend público). Queda por verificar que el `pnpm` de la imagen respete la versión de `packageManager` (`pnpm@11.13.1`) o sea compatible con el `pnpm-lock.yaml`; la prueba es un nuevo deploy manual del mismo commit. Los servicios de producción conservan su comando original, que funcionó con la versión de Node vigente cuando se crearon.

Verificaciones pendientes hasta que haya un deploy exitoso: arranque, `preflight`, salud (`/health`), estado del bucket de Storage staging y la comparación en el navegador de referencias entre servicios (I1, I2, I8).

#### Resultado del redeploy con el build corregido (2026-11-12)

Autorización R3: cambiar únicamente el comando de build de `vetneb-api-stg` (`srv-dbr5u80u01pc73a9e4a0`) y ejecutar **un** deploy manual del commit `b9d88659`.

Verificación previa de compatibilidad de `pnpm` (sin tocar instalaciones globales): `packageManager` = `pnpm@11.13.1`, `lockfileVersion` 9.0, `pnpm` local 11.13.1. Evidencia en Render, solo lectura: el deploy del frontend público de hoy, **del mismo commit**, compiló con un `pnpm install --frozen-lockfile` sin `corepack` («Lockfile is up to date», «Done in 1.1s using pnpm v11.13.1»). Eso demuestra que el `pnpm` de la imagen respeta `packageManager` y acepta el lockfile. No es una garantía formal para la versión 24.22.1 de Node (el frontend usa 24.14.1, la versión por defecto de su fecha de creación); la prueba definitiva fue el propio deploy.

| Control | Resultado |
|---|---|
| Cambio de configuración | Build: `corepack enable && pnpm install --frozen-lockfile && pnpm build` → **`pnpm install --frozen-lockfile && pnpm build`**. Ningún otro campo ni variable modificados (se verificó que Start sigue `pnpm start`) |
| Deploy | Manual, «Deploy a specific commit» `b9d8865` (SHA completo `b9d88659…`), `dep-dbr60ttckfvc73dafji0`; duración 1 m 31 s |
| Node y pnpm | Node **24.22.1** (por `NODE_VERSION`); pnpm **v11.13.1** |
| Build | **EXITOSO**: lockfile aceptado (619 entradas, política de cadena de suministro superada), `@supabase/supabase-js` 2.118.0, `esbuild` generó `dist/index.js` (1004.5 kb) |
| Arranque | `pnpm start` → `node dist/index.js`; **«API listening … :10000»** (Fastify) |
| Preflight | Completado sin errores: limpieza de sesiones expiradas de clínica, administrador y particular y de búsquedas guardadas, **0 filas en cada una** (consulta ejecutada contra la base) |
| Health check `/health` | Render lo superó: «Your service is live» (el aviso «Waiting for internal health check» pasó) |
| Estado del servicio | **Live**, plan Free, Ohio, entorno Staging, rama `main`, commit `b9d8865`, URL `https://vetneb-api-stg.onrender.com` (sin sufijo aleatorio) |
| Conexión exclusiva a Supabase staging | **Verificada indirectamente**: el preflight consultó una base que, con las variables cargadas (validadas antes de crear: URL de base Session pooler con la referencia staging por igualdad exacta, claves JWT con `ref` staging), es la de staging; y el **bucket privado de Storage apareció en el proyecto `vetneb-staging`** (ver abajo), que estaba vacío antes del arranque |
| Bucket de Storage staging | Presente en `vetneb-staging` (Storage → Archivos): **un bucket**, `reports` (mostrado como «Informes» por la traducción del panel), 0 políticas, sin etiqueta de público, sin límite de tamaño configurado. Creado por `ensureStorageBucketExists` (privado, `public: false`) en este arranque |
| Errores críticos | Ninguno en el log de despliegue |
| Cambios fuera del alcance | Ninguno: no se modificaron variables, producción, DNS ni Supabase (solo lecturas del panel de Storage); migraciones no ejecutadas; no se creó el frontend |

No se realizaron solicitudes HTTP a la aplicación (la campaña E3/E4/E6 y el smoke del login siguen sin autorizar). Quedan pendientes las comparaciones de referencias entre servicios (I1, I2, I8) y la verificación posterior del bucket por política (I5), a ejecutar con su propia autorización de lectura.

**`vetneb-api-stg` quedó operativo** (servicio en línea, arranque y preflight correctos, bucket privado creado en staging). Para crear `vetneb-web-stg` falta: autorización R3 de creación; fijar `NEXT_PUBLIC_API_URL=https://vetneb-api-stg.onrender.com` y `NEXT_PUBLIC_SITE_URL` con la URL prevista del frontend; las variables por nombre del frontend público (`NODE_ENV`, `NEXT_PUBLIC_APP_VERSION` no se fija); evitar `corepack enable` también en su build (`pnpm install --frozen-lockfile && pnpm -C frontend build`); y confirmar que `CORS_ORIGIN` del backend coincida con la URL real del frontend (hoy `https://vetneb-web-stg.onrender.com`, prevista).

#### Resultado de los pasos 1 a 3 (ejecutados 2026-11-12, Chrome autenticado de Nico)

| Paso | Resultado |
|---|---|
| 1 — Variables del frontend público (`portal-vetneb-frontend-staging`, que atiende `www.vetneb.com.ar`) | Solo nombres, sin valores: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_SITE_URL`, `NODE_ENV` (4 variables; **no** hay `NODE_VERSION`). El frontend de staging replica estos nombres con valores propios; `NEXT_PUBLIC_APP_VERSION` no se fija (en producción la rota el flujo `app-version-force-update`) |
| 1 — Versión de Node.js | **NO VERIFICADO por observación directa**: el log de deploy accesible (fase de arranque) no imprime la versión. Dato documental (documentación oficial de Render): sin `NODE_VERSION`, `.node-version`, `.nvmrc` ni `engines`, Render usa la versión por defecto **de la fecha de creación del servicio** (24.22.1 para servicios creados desde 2026-10-21; 24.21.0 para los creados entre 2026-09-17 y 2026-10-21). El repositorio no declara versión. Un servicio nuevo podría recibir una versión distinta de la de producción. **Acción:** fijar `NODE_VERSION` explícita en staging una vez conocida la de producción (primer log de build del servicio o fecha de creación), o aceptar y registrar la diferencia |
| 1 — Producción | Solo lectura; no se modificó nada |
| 2 — ¿Permite el workspace crear el entorno? | **SÍ**. Documentación oficial: los workspaces Hobby admiten hasta **dos entornos por proyecto**; con «Production» + «Staging» se usa exactamente el cupo. El diálogo de alta no mostró costo ni exigió cambio de plan; solo la opción «Bloquear conexiones entre entornos» está marcada como PRO |
| 3 — Entorno `Staging` creado | **SÍ**: entorno nuevo vacío (0 servicios, 0 grupos de variables) dentro del proyecto `PORTAL-VETNEB`; la opción PRO quedó desactivada; sin cargos |
| Producción tras el paso 3 | Los 3 servicios siguen en «Production», sin cambios (todos desplegados); nada se movió |

Observaciones que ajustan el diseño:

- **Región:** los tres servicios de producción están en **Ohio**. La revisión anterior proponía Oregón; para igualar la topología de producción, los servicios staging deben crearse en **Ohio** (la base Supabase seguirá en Oregón, igual que en producción). Corrige §11.5.
- **Cupo de entornos:** con el entorno «Staging» ya no quedan más entornos en el proyecto (límite Hobby: 2). Un tercer entorno exigiría actualizar el plan.
- **Aislamiento de red entre entornos:** «Bloquear conexiones entre entornos» es una función de pago; no se activó. El aislamiento de datos de este diseño no depende de ella (bases, claves y variables distintas).

Rollback: suspender o eliminar `vetneb-web-stg` y `vetneb-api-stg`, y revertir el entorno «Staging»; Supabase staging no se toca (se puede vaciar o eliminar aparte). Producción no se afecta en ningún paso.

Operaciones R3 que requerirán autorización: pasos 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12 y 13; la lectura de claves de Supabase y su copia al gestor son de Nico.

## 12. Operaciones R3 que requerirán autorización posterior

Crear organización/proyecto Supabase; migrar y cargar datos en staging; crear el primer administrador; crear entorno y servicios Render y sus variables; deploy del backend, del frontend y del commit de diagnóstico; lectura del panel de Supabase; solicitudes HTTP a staging; lectura de logs de Render; cambios de DNS/Cloudflare. El borrado de la rama de diagnóstico es manual de Nico.

## 13. Estado y no-alcance

- No se crearon servicios ni proyectos, no se modificaron variables, no se desplegó, no se migró, no se enviaron solicitudes HTTP; solo consultas DNS públicas y lecturas de documentación oficial.
- Sin cambios de código, tests, dependencias, workflows ni CI.
- Sin commit, push ni PR.
- Cerrado en revisión 7: administrador `stg-admin` creado (1 fila en `admin_users`, argon2id); sin login probado, sin clínicas ni servicios Render.
- Cerrado en revisión 6: esquema de `vetneb-staging` migrado y verificado (§11.2). Sin administradores, sin servicios Render, sin datos distintos del catálogo de `pricing_items`.
- Cerrado en revisión 3: capacidad de Supabase (1 de 2 proyectos Free activos; staging viable sin costo adicional; ver §4A).
- Pendiente: qué automatiza la integración GitHub del proyecto Supabase de producción, precios oficiales de Render (no figuran en las páginas accesibles), comportamiento del apex, equivalencia Free/Starter en el borde, efecto de Cloudflare sobre peer y `X-Forwarded-For`.
