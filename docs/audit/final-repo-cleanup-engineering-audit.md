# Auditoría final de limpieza y ordenamiento del repositorio — nivel ingeniero

> **Modo:** AUDITORÍA Y PROPUESTA. No se aplicó ningún cambio destructivo, no se
> borró/movió ningún archivo, no se tocaron workflows, DB, migraciones,
> dependencias, lockfiles, Render ni secretos. Este documento es la única salida.
>
> **Skill aplicada:** `vetneb-production-web-optimization-engineer`.
> **Fecha:** 2026-06-28 · **Autor:** auditoría asistida (read-only).

---

## 1. Resumen ejecutivo

El repositorio está en estado de **cierre saludable**: `main` limpio, 0 PRs
abiertos, version gate productivo activo, workflow de force update endurecido y
**typecheck verde** (backend y frontend, ambos `exit 0` en esta auditoría). La
arquitectura productiva (Fastify + Supabase/Drizzle, Next.js App Router, proxy
same-origin a `api.vetneb.com.ar`) es coherente y los invariantes de seguridad
(sesiones por rol, `no-store` en privados, tokens no logueados) se respetan.

El trabajo de cierre **no requiere correcciones de P0**. La deuda detectada es de
**ordenamiento, duplicación y documentación**, con un foco técnico claro:

1. **Duplicación masiva de boilerplate CORS** en ~30 rutas Fastify (≈2.000
   líneas copiadas). *(P1, mayor palanca de mantenibilidad del backend.)*
2. **Acoplamiento de la URL pública de email al `CORS_ORIGIN`**
   (`resolveParticularPortalUrl`): la URL del portal en mails de token sale del
   primer origen `https` del allowlist CORS, conflando dos conceptos distintos. *(P1.)*
3. **Módulo `shared/` muerto** (3 archivos) consumido solo por su propio test. *(P2.)*
4. **6 dependencias de frontend sin uso** (`@tanstack/react-query`,
   `@tanstack/react-table`, `echarts`, `echarts-for-react`, `react-hook-form`,
   `@radix-ui/react-tooltip`). *(P2.)*
5. **Deuda documental de organización**: ~233 docs con taxonomía fragmentada
   (`audit/` + `audits/`, notas de implementación en 3 lugares, ~31 `pr-*.md`
   sueltos en la raíz de `docs/`) y al menos un doc **contradictorio**
   (`docs/notes/todo.md` describe tRPC + Google Sheets, que ya no existen). *(P2.)*
6. **Artefactos históricos/orfanados**: `legacy/drizzle-old/`,
   `scripts/generate-pwa-icons.py`, `scripts/maintenance/FUSION_POR_COMANDO.sh`. *(P3.)*
7. **Gaps menores de documentación de env vars** (`APP_VERSION`,
   `CLIENT_MIN_VERSION`, `NEXT_PUBLIC_APP_VERSION` usados pero no listados en
   `.env.example`). *(P2/P3.)*

Todas las eliminaciones se proponen como **PRs chicos, con prueba y rollback**.
Ninguna se ejecuta en esta auditoría.

> **Nota de alcance vs. brief:** el brief esperaba workflows de *Dependabot* y
> *Supabase Preview*. **No existen** en el repo: solo hay 3 workflows
> (`backend-ci`, `frontend-ci`, `app-version-force-update`). Se audita lo real.

---

## 2. Estado base

| Ítem | Valor observado | Esperado | OK |
| --- | --- | --- | --- |
| Rama actual | `audit/final-repo-cleanup-engineering` | idem | ✅ |
| HEAD | `d1ad9b5 fix(deploy): harden app version force update smoke (#1159)` | idem | ✅ |
| `git status` | limpio (working tree clean) | limpio | ✅ |
| PRs abiertos | 0 (`gh pr list --state open` vacío) | 0 | ✅ |
| Backend typecheck | `pnpm typecheck` → exit 0 | verde | ✅ |
| Frontend typecheck | `pnpm --dir frontend typecheck` → exit 0 | verde | ✅ |
| Archivos versionados | 1117 | — | — |

**Workflows existentes** (`.github/workflows/`):
- `backend-ci.yml` — postgres service, audit, migraciones, typecheck (+test), test, build.
- `frontend-ci.yml` — lint, typecheck, build, public-surface audit, E2E en 4 grupos.
- `app-version-force-update.yml` — `workflow_dispatch` manual, rotación del token de contrato.

**Scripts npm (root `package.json`):** `dev`, `build` (esbuild), `start`,
`typecheck`, `typecheck:test`, `db:generate`, `db:migrate`,
`auth:reset-login-rate-limit`, `smoke:test|upload|prod:public|staging`, `test`
(node --experimental-strip-types), `security:public-surface`, `schema:verify`,
`validate:local`, `validate:local:schema`.

**Estructura principal (conteo de archivos versionados por raíz):**

```
410 test      240 frontend   237 docs      104 server    38 drizzle
 34 IMPLEMENTATION_NOTES      21 scripts     6 .github     6 .cursor
  3 shared     3 legacy   + configs raíz (tsconfig, package.json, .env.example, …)
```

**Distribución frontend/src:** `app` (67), `components` (76), `lib` (19),
`hooks` (2), `context` (1), `types` (1), `proxy.ts` (1).
**Distribución server:** `routes` (35), `lib` (42), `middlewares` (8), `db-*.ts`
data-access (14), `index.ts`/`bootstrap.ts`/`fastify-app.ts`/`preflight.ts`.

**Dominios productivos confirmados** (`.env.example`, `frontend/.env.example`,
`app-version-force-update.yml`): frontend `https://vetneb.com.ar`, backend
`https://api.vetneb.com.ar`. **No hay** dependencia productiva de `onrender.com`
en runtime; las apariciones de `*-staging.onrender.com` son **docs de staging** y
**fixtures de test** (ver §6 y §7).

---

## 3. Hallazgos priorizados (P0–P3)

### P0 — Crítico
**Ninguno.** No se detectó riesgo de caída, fuga de datos, acceso no autorizado,
deploy roto ni auth rota en el estado actual.

### P1 — Alto (deuda técnica fuerte / contrato frágil)

#### P1-A · Duplicación masiva de boilerplate CORS por ruta
- **Tipo:** architecture / dead-code-adyacente · **Riesgo de cambio:** Medio.
- **Evidencia:** las mismas funciones se redefinen en cada ruta:
  - `function getAllowedOrigins` → **32 archivos**.
  - `function normalizeOrigin` → **32 archivos**.
  - `function getAllowedOriginForCors` → **29 archivos**.
  - `function getOriginHeader` → **29 archivos**.
  - `function applyCorsHeaders` (variantes) → **31 archivos**.
  - Bloque literal de fallback dev (`http://localhost:3000|3001|5173` + `127.0.0.1`)
    repetido en 32 archivos de `server/` (`git grep -l "localhost:5173" -- server`).
  - Ej. `server/routes/admin-audit.fastify.ts:132-221` reproduce íntegro el set
    de helpers que también vive en `server/routes/admin-auth.fastify.ts`,
    `…/contact.fastify.ts`, `…/reports.fastify.ts`, etc.
- **Causa raíz:** no existe un helper compartido (`server/lib/cors*.ts`); cada
  ruta copió el patrón. `server/lib/env.ts` ya centraliza `LOCAL_CORS_ORIGINS` y
  `corsOrigins`, pero las rutas no lo reutilizan para los headers.
- **Impacto:** ~2.000 líneas duplicadas; cualquier ajuste CORS (p.ej. agregar
  `www.vetneb.com.ar`) requiere tocar 30 archivos → alto riesgo de divergencia.
- **Acción:** **consolidar** en `server/lib/cors-headers.ts` (helper único) y
  reemplazar por import. PR dedicado **PR-CLEAN5**, con cobertura existente de
  CORS por origen (`admin-*.fastify.test.ts`, `contact-route.test.ts`).

#### P1-B · URL pública de email acoplada a `CORS_ORIGIN`
- **Tipo:** architecture / email / env · **Riesgo de cambio:** Medio.
- **Evidencia:** `server/lib/email.ts:636-639`
  ```ts
  function resolveParticularPortalUrl(corsOrigins: string[]): string | null {
    const httpsOrigin = corsOrigins.find((o) => /^https:\/\//.test(o));
    return httpsOrigin ? `${httpsOrigin}/particulares` : null;
  }
  ```
  Usado en `server/lib/email.ts:906` para el CTA "Abrir Portal VETNEB" del mail
  de token particular. La URL pública canónica **se deriva del primer origen
  `https` de `CORS_ORIGIN`** (`ENV.corsOrigins`).
- **Causa raíz:** no existe variable explícita de URL pública del portal en el
  backend (no hay `PUBLIC_SITE_URL`/`FRONTEND_URL`/`PUBLIC_PORTAL_URL`).
- **Impacto / riesgo:**
  - Hoy funciona porque en prod `CORS_ORIGIN=https://vetneb.com.ar` (1 origen).
  - Si se agrega `www.vetneb.com.ar` u otro origen, `.find()` toma **el primero
    del string**; reordenar `CORS_ORIGIN` cambiaría silenciosamente los links de
    email. Si alguna vez el primer https fuese un origen no canónico (staging,
    preview), los mails apuntarían a un host equivocado.
  - El allowlist de seguridad (qué orígenes pueden mutar) y la identidad pública
    del sitio son **conceptos distintos** que aquí quedan acoplados.
- **Acción:** **documentar + proponer** variable explícita `PUBLIC_PORTAL_URL`
  (o `FRONTEND_PUBLIC_URL`) con fallback al comportamiento actual para no romper.
  PR dedicado **PR-CLEAN3** (no implementar ahora). Ver §9.

### P2 — Medio (mantenibilidad, DX, limpieza, observabilidad)

#### P2-A · Módulo `shared/` muerto
- **Tipo:** dead-code · **Riesgo:** Bajo.
- **Evidencia:** ningún archivo de `server/`, `frontend/`, `scripts/` ni
  `drizzle/` importa `shared/const`, `shared/types` ni `shared/_core/errors`
  (`git grep -nE "shared/(const|types|_core/errors)|@shared/" -- server frontend scripts drizzle` → 0 fuera de e2e). El **único** consumidor es
  `test/shared-const-and-errors.test.ts`. `pnpm-workspace.yaml` solo lista
  `frontend`; no hay alias `@shared` en ningún `tsconfig`.
- **Detalle:** `shared/const.ts` exporta además `AXIOS_TIMEOUT_MS`
  (`@deprecated`, alias de `FETCH_TIMEOUT_MS`) — residuo de la era axios (el
  frontend ya usa `fetch` en `frontend/src/lib/api.ts`). `shared/_core/errors.ts`
  (`HttpError`, `BadRequestError`…) tampoco se usa en runtime; tiene además un BOM inicial.
- **Acción:** **eliminar `shared/` + su test** en un PR (**PR-CLEAN6**), tras
  confirmar build/typecheck. Riesgo bajo: nada productivo lo referencia.

#### P2-B · Dependencias de frontend sin uso
- **Tipo:** dependencias / performance-surface · **Riesgo:** Medio (verificar build/E2E).
- **Evidencia** (`git grep` por nombre literal en `frontend/src`, `frontend/e2e`, configs → 0 refs):
  | Paquete | Refs en código |
  | --- | --- |
  | `@tanstack/react-query` | 0 (sin `QueryClient/useQuery/useMutation`) |
  | `@tanstack/react-table` | 0 (sin `useReactTable`) |
  | `echarts` | 0 |
  | `echarts-for-react` | 0 |
  | `react-hook-form` | 0 (formularios usan `useState`/`onSubmit`; 26 componentes) |
  | `@radix-ui/react-tooltip` | 0 (sin `Tooltip`) |
- **Impacto:** no inflan el bundle servido (Next no las bundlea si no se importan)
  pero sí el `node_modules`, tiempo de install, superficie de `pnpm audit` y ruido
  de actualizaciones. `echarts` en especial es pesado.
- **Acción:** **investigar y remover** vía PR con build + E2E + lint verdes
  (**PR-CLEAN7**). **No tocar `package.json`/lock en esta auditoría.**

#### P2-C · `docs/notes/todo.md` contradictorio con la arquitectura actual
- **Tipo:** docs · **Riesgo:** Bajo.
- **Evidencia:** el archivo describe "procedimientos **tRPC**", "Sincronización con
  **Google Sheets API**", `CONTROL_CLINICAS`, `REGISTRO_INFORMES`, carga Excel/CSV
  y `SESIONES_ACTIVAS` — una arquitectura que **no corresponde** al sistema real
  (Fastify REST + Supabase/Postgres + Drizzle). La sección de logística al final sí
  es vigente.
- **Acción:** **archivar o reescribir** (separar la parte de logística vigente del
  TODO histórico tRPC/Sheets). **PR-CLEAN1**.

#### P2-D · Taxonomía documental fragmentada
- **Tipo:** docs · **Riesgo:** Bajo.
- **Evidencia:**
  - `docs/audit/` (62) **y** `docs/audits/` (10): dos taxonomías casi idénticas.
  - Notas de implementación en **3 lugares**: `docs/implementation/` (39),
    `docs/implementation-history/` (13) y `IMPLEMENTATION_NOTES/` en la raíz (34).
  - `docs/pr-history/` (32) **y** ~31 `pr-*.md` sueltos en la raíz de `docs/`
    (`pr-1…pr-10`, `pr-815…pr-826`, `pr0…pr5b`).
- **Acción:** **consolidar** taxonomía (unificar `audit`/`audits`; mover notas a un
  único árbol; recolectar `pr-*.md` en `pr-history/`). PR de solo-docs **PR-CLEAN2**.

#### P2-E · Logger mínimo y mezcla `console.*` / logger
- **Tipo:** observability · **Riesgo:** Bajo.
- **Evidencia:** `server/lib/logger.ts` es un wrapper de `console` con tipos `any[]`
  (sin niveles configurables ni redacción). Hay **56** `console.*` en `server/`
  (no test), de los cuales `server/lib/email.ts` concentra 9. Las rutas mezclan
  `console.*` crudo con `logInfo/logWarn/logError`.
- **Mitigante:** los logs sensibles **no** exponen el token (`email.ts:923` loguea
  `recipients/messageId/transport`, nunca el token). Sí loguea emails (PII operacional).
- **Acción:** **documentar** como deuda de observabilidad; opcional unificar a
  logger con niveles. No bloqueante para el cierre.

#### P2-F · `APP_VERSION` / `CLIENT_MIN_VERSION` / `NEXT_PUBLIC_APP_VERSION` no documentadas en `.env.example`
- **Tipo:** env / docs · **Riesgo:** Bajo. Ver §8.

### P3 — Bajo (cosmético / archaeology / nice-to-have)

| Id | Hallazgo | Evidencia | Acción |
| --- | --- | --- | --- |
| P3-A | `legacy/drizzle-old/` (3 archivos) fuera de la cadena de migración | `legacy/drizzle-old/README.md` lo declara "archaeology only" | archivar/eliminar (historia en git) — **PR-CLEAN6** |
| P3-B | `scripts/generate-pwa-icons.py` orfanado | 0 referencias (`git grep generate-pwa-icons`); skill VETNEB prohíbe Python | eliminar — **PR-CLEAN6** |
| P3-C | `scripts/maintenance/FUSION_POR_COMANDO.sh` orfanado | 0 referencias; opera sobre `portal-vetneb-main.zip`/`…-dev-eficiencia.zip` (fusión histórica de repos) | eliminar — **PR-CLEAN6** |
| P3-D | Fallback dev inalcanzable en `trusted-origin.ts:27-39` | `env.ts` siempre inyecta `LOCAL_CORS_ORIGINS` en dev/test y lanza si falta en prod → `ENV.corsOrigins` nunca vacío | consolidar junto a P1-A — **PR-CLEAN5** |
| P3-E | `AXIOS_TIMEOUT_MS` (`@deprecated`) | `shared/const.ts:5-6`; solo usado por su test | eliminar con P2-A — **PR-CLEAN6** |
| P3-F | Split `zod` v3 (backend `^3.25.76`) vs v4 (frontend `^4`) | `package.json` vs `frontend/package.json` | documentar (intencional: paquetes separados); revisar a futuro |
| P3-G | `backend-ci.yml` sin `paths:` → corre en PRs de solo-docs/frontend | `.github/workflows/backend-ci.yml:3-16` | evaluar `paths-ignore` (ver §10) |

---

## 4. Inventario de posibles eliminaciones

> **Todas** son candidatas a **PR futuro con prueba y rollback**, no a borrado ahora.

| # | Path | Tipo | Evidencia de no-uso | PR |
| --- | --- | --- | --- | --- |
| 1 | `shared/const.ts` | dead-code | solo `test/shared-const-and-errors.test.ts` | PR-CLEAN6 |
| 2 | `shared/types.ts` | dead-code | idem; re-export sin consumidores | PR-CLEAN6 |
| 3 | `shared/_core/errors.ts` | dead-code | idem; `HttpError` no usado en runtime | PR-CLEAN6 |
| 4 | `test/shared-const-and-errors.test.ts` | tests | testea módulo muerto (tautológico) | PR-CLEAN6 |
| 5 | `legacy/drizzle-old/` (3 archivos) | cleanup | README lo marca "archaeology only" | PR-CLEAN6 |
| 6 | `scripts/generate-pwa-icons.py` | cleanup | 0 refs; Python prohibido por skill | PR-CLEAN6 |
| 7 | `scripts/maintenance/FUSION_POR_COMANDO.sh` | cleanup | 0 refs; artefacto de fusión histórica | PR-CLEAN6 |
| 8 | `@tanstack/react-query` (dep frontend) | dependencias | 0 refs en `frontend/` | PR-CLEAN7 |
| 9 | `@tanstack/react-table` (dep frontend) | dependencias | 0 refs | PR-CLEAN7 |
| 10 | `echarts` + `echarts-for-react` (deps) | dependencias | 0 refs | PR-CLEAN7 |
| 11 | `react-hook-form` (dep frontend) | dependencias | 0 refs | PR-CLEAN7 |
| 12 | `@radix-ui/react-tooltip` (dep frontend) | dependencias | 0 refs | PR-CLEAN7 |
| 13 | `docs/notes/todo.md` (parte tRPC/Sheets) | docs | contradice arquitectura real | PR-CLEAN1 |

---

## 5. Tabla maestra — archivo / evidencia / riesgo / acción

| Archivo / objetivo | Evidencia | Severidad | Riesgo | Acción | PR |
| --- | --- | --- | --- | --- | --- |
| ~30 rutas `server/routes/*.fastify.ts` (helpers CORS) | `getAllowedOrigins`×32, `normalizeOrigin`×32, `applyCorsHeaders`×31 | P1 | Medio | consolidar a `server/lib/cors-headers.ts` | PR-CLEAN5 |
| `server/lib/email.ts:636-639,906` | URL portal derivada de `CORS_ORIGIN.find(https)` | P1 | Medio | introducir env explícita (documentar) | PR-CLEAN3 |
| `server/middlewares/trusted-origin.ts:27-39` | fallback dev inalcanzable | P3 | Bajo | consolidar | PR-CLEAN5 |
| `shared/const.ts` · `shared/types.ts` · `shared/_core/errors.ts` | solo consumidos por su test | P2 | Bajo | eliminar módulo + test | PR-CLEAN6 |
| `shared/const.ts:5-6` `AXIOS_TIMEOUT_MS` | `@deprecated`, sin uso runtime | P3 | Bajo | eliminar | PR-CLEAN6 |
| `legacy/drizzle-old/*` | "archaeology only" (su README) | P3 | Bajo | archivar/eliminar | PR-CLEAN6 |
| `scripts/generate-pwa-icons.py` | 0 refs; Python prohibido | P3 | Bajo | eliminar | PR-CLEAN6 |
| `scripts/maintenance/FUSION_POR_COMANDO.sh` | 0 refs; fusión histórica | P3 | Bajo | eliminar | PR-CLEAN6 |
| `frontend/package.json` (6 deps) | 0 refs (ver §4 #8-12) | P2 | Medio | investigar+remover | PR-CLEAN7 |
| `docs/notes/todo.md` | tRPC/Google Sheets inexistentes | P2 | Bajo | archivar/reescribir | PR-CLEAN1 |
| `docs/audit/` + `docs/audits/` | taxonomía duplicada | P2 | Bajo | unificar | PR-CLEAN2 |
| `IMPLEMENTATION_NOTES/` (raíz, 34) | notas en 3 ubicaciones | P2 | Bajo | consolidar bajo `docs/` | PR-CLEAN2 |
| ~31 `docs/pr-*.md` sueltos | deberían ir en `pr-history/` | P2 | Bajo | mover | PR-CLEAN2 |
| `.env.example` / `frontend/.env.example` | faltan `APP_VERSION`,`CLIENT_MIN_VERSION`,`NEXT_PUBLIC_APP_VERSION` | P2/P3 | Bajo | documentar (comentario) | PR-CLEAN1 |
| `server/lib/logger.ts` + 56 `console.*` | logger mínimo, mezcla cruda | P2 | Bajo | documentar/unificar (opcional) | — |

---

## 6. "No eliminar todavía" / no tocar

| Objetivo | Por qué se mantiene |
| --- | --- |
| `*-staging.onrender.com` en `test/*.fastify.test.ts` | **Fixtures intencionales** de origen CORS; muchos tests fijan `process.env.CORS_ORIGIN` y `STAGING_ORIGIN` para validar reflejo ACAO. No es código muerto. |
| `test/production-env-contracts.test.ts`, `test/public-staging-config-contract.test.ts` | **Tests de contrato que guardan** contra valores `onrender` activos en `.env.example`. Quitar los strings rompería la guardia. |
| `localhost`/`127.0.0.1` en `server/lib/env.ts`, `csp-policy.ts`, rutas | Allowlist de **desarrollo** legítimo; la consolidación (P1-A) los centraliza, no los borra. |
| `drizzle/migrations/*` (31 SQL + meta) | Historia **append-only** de migraciones. No reordenar/borrar. |
| `scripts/db/*.mjs`, `scripts/smoke/*`, `scripts/ops/verify-production-readiness.mjs` | Herramientas operativas reales (referenciadas en runbooks y `package.json`). Verificar caso por caso antes de tocar. |
| `app-version-force-update.yml` y sus URLs `vetneb.com.ar` | Workflow recién endurecido (#1158/#1159); URLs canónicas correctas. No modificar. |
| `docs/audit/backend-api-global-incident-p0.md` y auditorías previas | Histórico útil (contexto de decisiones). Archivar, no borrar. |
| `shared/_core/errors.ts` **si** se decide reutilizarlo | Alternativa a eliminar: **adoptarlo** en rutas en vez de borrar. Decisión de PR-CLEAN6. |

---

## 7. Deuda documental

**Volumen:** ~233 archivos en `docs/` + 34 en `IMPLEMENTATION_NOTES/`.

**Clasificación:**

- **Vigente (mantener):** `docs/SOURCES_OF_TRUTH.md`,
  `docs/PRODUCTION_PROGRESS_INVARIANTS.md`, `docs/security/*`,
  `docs/ops/app-version-force-update-workflow.md`,
  `docs/implementation/APP_VERSION_GATE.md`, `docs/governance/*`,
  `docs/release/*`, `docs/logistics/*`, `frontend/README.md`, `README.md`, `SETUP.md`.
- **Histórico útil (archivar, no borrar):** `docs/audit/*` y `docs/audits/*` de
  bloques cerrados (admin-mobile density, dashboard redesign, backend incident
  P0), `docs/pr-history/*`, `docs/implementation-history/*`, `IMPLEMENTATION_NOTES/*`.
- **Obsoleto / contradictorio:** `docs/notes/todo.md` (tRPC + Google Sheets;
  contradice Fastify/Supabase). Revisar `docs/notes/PENDIENTE_NORMALIZACION_CLINICS.md`.
- **Candidato a reorganizar:** ~31 `pr-*.md` sueltos en raíz de `docs/`;
  duplicidad `audit/` vs `audits/`; notas de implementación en 3 árboles.

**Dominios viejos en docs (revisar, no urgente):** `*-staging.onrender.com`
aparece como valor de ejemplo de **staging** en `docs/release-readiness.md`,
`docs/staging-smoke-runbook.md`, `frontend/README.md` y por default en
`scripts/dev/smoke-staging.ps1`. Es válido como *staging*, pero conviene
**marcar explícitamente** que el dominio productivo es `vetneb.com.ar` /
`api.vetneb.com.ar` para que nadie lo confunda con prod. `localhost` en docs es
legítimo (desarrollo). **No** hay URLs productivas apuntando a onrender.

**Orden documental final propuesto:**
```
docs/
  audit/            # unificar audits/ aquí; auditorías técnicas
  implementation/   # notas de implementación (absorber IMPLEMENTATION_NOTES/ e implementation-history/)
  pr-history/       # recolectar pr-*.md sueltos
  ops/ release/ security/ governance/ logistics/ qa/ product/ protocol/ changelog/
  notes/            # solo notas vigentes; archivar todo.md histórico
  SOURCES_OF_TRUTH.md  PRODUCTION_PROGRESS_INVARIANTS.md  (índices raíz)
```
> Riesgo de mover docs: algunos **tests de contrato leen rutas de docs/archivos**.
> Antes de mover, `git grep` la ruta exacta (ver §13).

---

## 8. Deuda de variables de entorno

**Backend (parseadas en `server/lib/env.ts`):** `NODE_ENV, PORT, DATABASE_URL,
SUPABASE_DB_URL, DATABASE_MAX_CONNECTIONS, SUPABASE_URL, SUPABASE_ANON_KEY,
SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET, COOKIE_NAME, ADMIN_COOKIE_NAME,
PARTICULAR_COOKIE_NAME, CORS_ORIGIN, TRUST_PROXY, OWNER_OPEN_ID, LAB_UPLOAD_USERNAMES,
MAX_UPLOAD_FILE_SIZE_MB, SUPABASE_SIGNED_URL_EXPIRES_IN_SECONDS, SESSION_TTL_HOURS,
SMTP_*, GMAIL_API_*, CONTACT_TO, APP_VERSION, RENDER_GIT_COMMIT, CLIENT_MIN_VERSION`.

| Variable | Usada | En `.env.example` | Observación |
| --- | --- | --- | --- |
| `APP_VERSION` | sí (`env.ts:98,152`) | **no** | gestionada por force-update workflow; documentar como comentario |
| `CLIENT_MIN_VERSION` | sí (`env.ts:100,163-164`) | **no** | arma el gate 426; borrarla apaga el gate (ver memoria) — documentar |
| `RENDER_GIT_COMMIT` | sí (fallback de `appVersion`) | **no** | inyectada por Render; aceptable no documentar |
| `NEXT_PUBLIC_APP_VERSION` | sí (`frontend/src/lib/app-version.ts:8`) | **no** (en `frontend/.env.example`) | build-time, set en Render; documentar |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` | sí | sí | consistentes (`api.vetneb.com.ar` / `vetneb.com.ar`) |
| `CORS_ORIGIN` | sí | sí (`https://vetneb.com.ar`) | **doble uso**: allowlist CORS **y** fuente de URL de email (ver §9) |

**Consistencia del trío del version gate** (coherente con la memoria del
proyecto): `NEXT_PUBLIC_APP_VERSION` (frontend, build-time), `APP_VERSION` y
`CLIENT_MIN_VERSION` (backend, runtime) se mueven juntas al mismo token de
contrato; comparación por **igualdad exacta**. Documentación operativa correcta en
`docs/ops/app-version-force-update-workflow.md` y
`docs/audit/app-version-deploy-automation-audit.md`.

**Riesgo `CORS_ORIGIN` como URL pública:** confirmado (ver §9). El brief sugiere
evaluar `PUBLIC_SITE_URL`/`FRONTEND_URL` explícita: **recomendado**, como
`PUBLIC_PORTAL_URL` con fallback al comportamiento actual.

**`www` no contemplado:** `.env.example` documenta solo el apex
(`https://vetneb.com.ar`). Si usuarios entran por `www.vetneb.com.ar`, el
preflight cross-origin podría fallar (ya señalado en
`docs/audit/backend-api-global-incident-p0.md`). **Investigar** según hosts reales.

**Acción env:** **PR-CLEAN1** agrega comentarios documentando `APP_VERSION`,
`CLIENT_MIN_VERSION`, `NEXT_PUBLIC_APP_VERSION` en los `.env.example` (sin valores
secretos). El contrato de URL pública va en **PR-CLEAN3**.

---

## 9. Deuda de email / token links

- **Archivo:** `server/lib/email.ts`.
- **Función clave:** `resolveParticularPortalUrl(corsOrigins)` (`:636-639`),
  invocada en `sendParticularTokenMail` (`:906`) para el CTA
  `${httpsOrigin}/particulares` del mail de token particular.
- **Dependencia actual:** la URL pública del portal **depende de `CORS_ORIGIN`**
  (primer origen `https`). No hay variable dedicada.
- **Estado hoy:** correcto, porque `CORS_ORIGIN=https://vetneb.com.ar` (1 origen).
  CTA → `https://vetneb.com.ar/particulares`.
- **Riesgos:**
  1. Agregar orígenes a `CORS_ORIGIN` (p.ej. `www`) y/o reordenarlos cambia los
     links de email sin que nadie lo note (`.find()` toma el primero).
  2. Acoplamiento conceptual: allowlist de seguridad ≠ identidad pública.
  3. Riesgo de links viejos: si `CORS_ORIGIN` apuntara a un host no canónico, los
     mails enviarían a ese host. (No hay onrender en runtime hoy, pero el patrón lo permite.)
- **Mitigante:** no hay fuga de token en logs (`email.ts:923`).
- **Propuesta de PR futuro (PR-CLEAN3, NO implementar):**
  1. Agregar `PUBLIC_PORTAL_URL` (o `FRONTEND_PUBLIC_URL`) a `server/lib/env.ts`
     (opcional, `z.string().url().optional()`).
  2. `resolveParticularPortalUrl` usa `ENV.publicPortalUrl ?? <primer https de corsOrigins>`
     (fallback = comportamiento actual → cero ruptura).
  3. Documentar la nueva var en `.env.example` (`= https://vetneb.com.ar`).
  4. Test: link de email = `${PUBLIC_PORTAL_URL}/particulares` cuando está seteada;
     y fallback a `CORS_ORIGIN` cuando no.
- **Rollback:** quitar la var → vuelve al fallback; sin cambio de contrato.

---

## 10. Deuda de workflows y CI

| Workflow | Estado | Observación |
| --- | --- | --- |
| `backend-ci.yml` | sólido | **Sin `paths:`** → corre full (postgres+migraciones+test+build, ~15 min) también en PRs de solo-docs o solo-frontend. `pnpm audit`/`pnpm audit --prod` pueden romper CI por advisories de devDeps. |
| `frontend-ci.yml` | sólido | `paths:` correctos; E2E en 4 grupos; `concurrency` con cancel. |
| `app-version-force-update.yml` | excelente | `workflow_dispatch` only, validación dura de input, sin imprimir secretos, orden frontend→backend, smoke con polling. **No tocar.** |

**Triggers / duplicación:** `backend-ci` corre en `push` (a `main` y muchas ramas
`feat/**,fix/**,…`) **y** `pull_request` a `main`. Un push a una rama con PR
abierto dispara el workflow dos veces; `concurrency: cancel-in-progress` mitiga
parcialmente. **Optimización (P3-G):** considerar `paths-ignore` en `backend-ci`
para PRs de solo-docs (riesgo: algunos tests de contrato leen `.env.example`/docs;
verificar antes con `git grep`).

**Secretos requeridos** (force-update): `RENDER_API_KEY`,
`RENDER_FRONTEND_SERVICE_ID`, `RENDER_BACKEND_SERVICE_ID`,
`RENDER_FRONTEND_DEPLOY_HOOK_URL`, `RENDER_BACKEND_DEPLOY_HOOK_URL`. Documentados
en `docs/ops/app-version-force-update-workflow.md`. ✅

**No existen:** Dependabot ni Supabase Preview (el brief los asumía). Si se desean,
serían altas nuevas (fuera de alcance de limpieza).

> **Restricción respetada:** no se modificó ningún workflow.

---

## 11. Deuda de tests

- **Volumen:** 410 archivos en `test/` + 49 specs en `frontend/e2e/`.
- **`.only`:** **ninguno** (no hay riesgo de CI que corra un solo test). ✅
- **`.skip`:** 4 skips **condicionales en runtime** (no hard-disable):
  `test/logger-and-email.test.ts:368`, `test/trusted-origin-edge.test.ts:92,119`,
  `test/trusted-origin.test.ts:146`. Aceptables (guardas de entorno).
- **Test tautológico:** `test/shared-const-and-errors.test.ts` valida un módulo
  muerto (`shared/`). Eliminar junto con el módulo (PR-CLEAN6).
- **Fixtures `onrender`:** intencionales (ver §6). **No** consolidar a la ligera:
  varios tests dependen de `CORS_ORIGIN=…staging.onrender.com` como origen válido.
- **Allowlists:** `test/production-env-contracts.test.ts` y
  `public-staging-config-contract.test.ts` mantienen listas de strings prohibidos en
  `.env.example`; son guardias, no acumulación muerta. Revisar solo si cambia el contrato.
- **Costo:** la suite backend (`pnpm test`) levanta `node --test` sobre `test/**`
  y requiere Postgres (CI usa service `postgres:16`). **No se ejecutó** aquí por
  costo/entorno (sin DB local garantizada); el typecheck (backend+frontend) **sí**
  pasó. CI de `main` cubre la suite.
- **Oportunidad de consolidación (sin bajar cobertura):** los helpers CORS por
  ruta tienen tests por ruta; al consolidar P1-A se puede extraer un test único
  de `server/lib/cors-headers.ts` y mantener 1-2 tests de integración por familia
  de rutas (no quitar la cobertura de origen).

---

## 12. Deuda de performance / eficiencia

| Tema | Estado | Acción |
| --- | --- | --- |
| Code splitting frontend | `gsap`/`ScrollTrigger` lazy (`PublicScrollReveal.tsx:112-114`); `next/dynamic` en `AdminClinicsManagementCard`, `ParticularesContent` | OK |
| Deps pesadas sin uso | `echarts`/`echarts-for-react`/`react-query`/`react-table`/`react-hook-form` con 0 refs | remover (PR-CLEAN7) |
| `no-store` en privados | hook global `applySensitiveApiNoStoreHeaders` (`fastify-app.ts:362`) sobre `/api/*` excepto `/api/public/*` | OK |
| Cold start backend | build esbuild bundle ESM; `host 0.0.0.0`/`PORT` correctos (no auditado a fondo aquí) | sin hallazgo |
| Logging | 56 `console.*` en server; sin redacción estructurada | observabilidad (P2-E) |
| Polling | el polling es del **smoke** del workflow (correcto, acotado), no runtime | OK |
| Dashboard no-scroll | contrato single-viewport activo (memoria del proyecto) | OK |
| Tests/scripts lentos | suite backend requiere DB; E2E en 4 grupos | mantener; revisar `paths` CI (P3-G) |

**Clasificación por impacto/riesgo:** la única palanca de performance con acción
clara es **remover deps sin uso** (impacto: install/audit surface; riesgo: Medio,
exige build+E2E). El resto está saludable.

---

## 13. Riesgos de limpieza

- **CORS (P1-A):** seguridad sensible. Consolidar mal puede abrir/cerrar orígenes.
  Mitigación: helper con **igual semántica byte a byte** + correr
  `admin-*.fastify.test.ts`, `contact-route.test.ts`, `trusted-origin*.test.ts`.
- **Email URL (P1-B/PR-CLEAN3):** cambiar la fuente de la URL puede romper links
  productivos. Mitigación: **fallback al comportamiento actual** + test de ambos caminos.
- **Mover docs (PR-CLEAN2):** algunos tests de contrato **leen rutas de archivos**.
  Mitigación: `git grep -n "<ruta-doc>"` antes de mover; ajustar guardas en el mismo PR
  (precedente del proyecto: tests de scope alineados in-PR).
- **Quitar deps (PR-CLEAN7):** un import dinámico o transitivo podría escaparse al
  grep. Mitigación: build + E2E + `pnpm --dir frontend lint` verdes; quitar de a
  una familia si hay duda.
- **Eliminar `shared/` (PR-CLEAN6):** bajo riesgo, pero confirmar que ningún
  `tsconfig`/bundler lo referencia (ya verificado: no hay alias).
- **`.env.example`:** cambiarlo puede tocar `production-env-contracts.test.ts` /
  `public-staging-config-contract.test.ts`. Mitigación: correr esos tests en el PR.
- **`next-env.d.ts`:** si un PR corre E2E, el dev server regenera `next-env.d.ts` a
  ruta dev; **revertir antes** de `pnpm test` (memoria del proyecto).

---

## 14. Plan de PRs sugerido (uno por bloque)

> Orden recomendado: del menor riesgo (docs/env) al mayor (CORS/deps). Cada PR es
> chico, con validación y rollback. **Ninguno implementado en esta auditoría.**

### PR-CLEAN1 · docs + env contract comments (solo-docs/env)
- **Alcance:** archivar/reescribir `docs/notes/todo.md` (separar logística vigente
  del TODO tRPC/Sheets); agregar comentarios documentando `APP_VERSION`,
  `CLIENT_MIN_VERSION` en `.env.example` y `NEXT_PUBLIC_APP_VERSION` en
  `frontend/.env.example`; marcar dominio productivo (`vetneb.com.ar`) vs staging.
- **Validación:** `pnpm test -- production-env-contracts` y `public-staging-config-contract`; `pnpm typecheck`.
- **Rollback:** revertir el PR (solo docs/comentarios; sin runtime).
- **Nota de seguimiento (ejecución real, rama `clean/docs-env-domain-references`):**
  este PR ejecuta el subconjunto de **referencias de dominio + nota conceptual de
  `CORS_ORIGIN`**: (a) `frontend/README.md` usa ahora los dominios productivos
  canónicos (`https://vetneb.com.ar` / `https://api.vetneb.com.ar`) como ejemplo y
  marca staging Render (`*.onrender.com`) explícitamente; (b) `.env.example` documenta
  que `CORS_ORIGIN` no es la URL pública canónica y anota el seguimiento a
  `PUBLIC_SITE_URL`/`FRONTEND_URL` (PR-CLEAN2/3). **Diferido a un PR posterior** (no es
  referencia de dominio): la reescritura de `docs/notes/todo.md` (P2-C) y los comentarios
  de `APP_VERSION`/`CLIENT_MIN_VERSION`/`NEXT_PUBLIC_APP_VERSION` (P2-F). Las apariciones
  `*-staging.onrender.com` en `docs/release-readiness.md`, `docs/staging-smoke-runbook.md`
  y `test/*` se **mantienen**: son fixtures de contrato guardadas por
  `public-staging-config-contract.test.ts` y `admin-docs-operational-contract.test.ts`.

### PR-CLEAN2 · reorganización documental (solo-docs)
- **Alcance:** unificar `docs/audits/` → `docs/audit/`; mover `pr-*.md` sueltos a
  `docs/pr-history/`; consolidar `IMPLEMENTATION_NOTES/` y `implementation-history/`
  bajo `docs/implementation/` (archivo histórico). Actualizar índices.
- **Validación:** `git grep` de cada ruta movida (asegurar que ningún test/guard la
  referencie); `pnpm test`; `pnpm --dir frontend lint`.
- **Rollback:** revertir (git conserva historia).
- **Nota de seguimiento (ejecución real, rama `clean/docs-structure-consolidation`, 2026-06-28):**
  (a) `docs/audits/` (10 `AUDIT_*`/`DASHBOARD_*_PLAN`) se unificó dentro de `docs/audit/` —sin
  colisión de nombres—. (b) `IMPLEMENTATION_NOTES/` (raíz, 34 archivos) y
  `docs/implementation-history/` (13 `IMPLEMENTACION-PR-*.md`) se consolidaron dentro de
  `docs/implementation/` (86 archivos resultantes, sin colisión). (c) Los ~30
  `pr-*.md`/`prN-*.md` sueltos de la raíz de `docs/` (`pr-1`…`pr-10`, `pr-815`…`pr-826`,
  `pr0`…`pr5b`) se recolectaron en `docs/pr-history/`. Las 3 carpetas origen quedaron vacías y se
  eliminaron del árbol (git no rastrea directorios vacíos). (d) 3 tests de contrato leían rutas
  exactas movidas y se actualizaron en el mismo PR, siguiendo el precedente de
  `docs/implementation/chore-docs-organize-audit-implementation-notes.md`:
  `test/frontend-dashboard-filter-drawer-sticky-filters.test.ts` (`DOC_PATH`),
  `test/global-e2e-production-readiness-contract.test.ts` (`prDocPath`),
  `test/production-readiness.test.ts` (ruta de
  `IMPLEMENTATION_PRODUCTION_OBSERVABILITY_READINESS.md`). Esos 3 + los 2 tests nombrados por la
  misión (`test/admin-docs-operational-contract.test.ts`,
  `test/public-staging-config-contract.test.ts`, sin referencias a rutas movidas) pasan en verde
  (20/20). (e) Se corrigió 1 link Markdown relativo roto
  (`docs/implementation/IMPLEMENTATION_EXTREME_VISUAL_FIXES.md` → `../audit/...`) y 3
  referencias operativas **vivas** que nombraban `IMPLEMENTATION_NOTES` como destino de entrega
  futura (`AGENTS.md`, `docs/protocol/vetneb-ai-working-protocol.md`,
  `.cursor/rules/vetneb-global-protocol.mdc`) — ahora apuntan solo a `docs/implementation`/`docs/audit`.
  Prosa/backtick que narra hechos históricos de PRs ya cerrados (ej. menciones de
  `docs/audits/…`/`IMPLEMENTATION_NOTES/…` dentro de notas movidas, o en
  `docs/audit/repository-operational-ordering-audit.md` §3/§4/§8 y
  `docs/audit/global-e2e-extreme-production-audit.md:26`) se dejó intacta a propósito — no se
  reescribe historia; ver nota de seguimiento agregada al final de
  `repository-operational-ordering-audit.md`. `docs/HISTORICAL_DOCUMENTATION.md` y
  `docs/SOURCES_OF_TRUTH.md` se actualizaron con las rutas nuevas. Validación ejecutada:
  `pnpm typecheck` y `pnpm typecheck:test` verdes; `pnpm --dir frontend lint` verde; suite
  `pnpm test` completa no se corrió (requiere Postgres local, igual que en la auditoría
  original — ver §11/§15); los tests puntuales arriba sí se corrieron directamente vía
  `node --experimental-strip-types --test`.

### PR-CLEAN3 · contrato de URL pública de email
- **Alcance:** `PUBLIC_PORTAL_URL` opcional en `env.ts`; `resolveParticularPortalUrl`
  usa la var con **fallback** a `CORS_ORIGIN`; documentar en `.env.example`.
- **Validación:** test de link con/sin la var; `pnpm test -- logger-and-email`; `pnpm typecheck`.
- **Rollback:** quitar la var → fallback automático; sin cambio de contrato.
- **Nota de seguimiento (ejecución real, rama `clean/email-public-site-url-contract`):**
  implementado con el nombre canónico **`PUBLIC_SITE_URL`** (coherente con
  `NEXT_PUBLIC_SITE_URL` del frontend), no `PUBLIC_PORTAL_URL`. (a) `server/lib/env.ts`
  agrega `PUBLIC_SITE_URL` al schema y expone `ENV.publicSiteUrl`, resuelto por
  `resolvePublicSiteUrl()`: normaliza al **origen** (sin trailing slash), exige `https`
  en producción (admite `http://localhost`/`127.0.0.1` en development/test) y hace
  **fail-fast** en el startup ante un valor inválido. (b) `server/lib/email.ts`:
  `resolveParticularPortalUrl(ENV.publicSiteUrl, ENV.corsOrigins)` prioriza
  `PUBLIC_SITE_URL` y mantiene el **fallback** al primer origen `https` de `CORS_ORIGIN`
  (cero ruptura si Render aún no define la var). (c) `.env.example` documenta
  `PUBLIC_SITE_URL=https://vetneb.com.ar` y la diferencia conceptual con `CORS_ORIGIN`.
  (d) Tests: `test/email-html-templates.test.ts` cubre A (usa `PUBLIC_SITE_URL`),
  B (trailing slash no duplica barra), C (fallback a CORS), D (onrender de CORS no gana)
  y E (token no se imprime en logs); `test/env.test.ts` cubre `resolvePublicSiteUrl`
  (normalización, https requerido, localhost en dev/test, fail-fast). **Acción manual
  post-merge:** agregar `PUBLIC_SITE_URL=https://vetneb.com.ar` en el backend de Render.

### PR-CLEAN4 · (reservado) www/CORS topology
- **Alcance (investigar):** decidir si `CORS_ORIGIN` incluye `www.vetneb.com.ar`
  según hosts reales; alinear con `backend-api-global-incident-p0.md`.
- **Validación:** smoke CORS por origen (apex/www); tests de origen.
- **Rollback:** revertir valor de `CORS_ORIGIN` en Render (config, no código).

### PR-CLEAN5 · consolidación CORS backend
- **Alcance:** crear `server/lib/cors-headers.ts` con
  `getAllowedOrigins/normalizeOrigin/getOriginHeader/getAllowedOriginForCors/applyCorsHeaders`;
  reemplazar las copias en ~30 rutas + `trusted-origin.ts` (eliminar fallback inalcanzable).
- **Validación:** `pnpm typecheck`; `pnpm test` (todos los `admin-*.fastify.test.ts`,
  `contact-route.test.ts`, `trusted-origin*.test.ts`, `public-*`); `pnpm build`.
- **Rollback:** revertir el PR (cambio mecánico, sin cambio de semántica).
- **Sugerencia:** dividir en 2-3 sub-PRs por familia (admin / particular / public+logistics) si el diff es grande.
- **Nota de seguimiento (ejecución real — PR-CORS1, rama `clean/backend-cors-helper-consolidation`, 2026-06-28):**
  se ejecutó la **fase 1** de la consolidación (la sugerencia de sub-PR por familia se adoptó: este PR migra la **familia admin**).
  - **Helper creado:** `server/lib/cors-headers.ts` exporta `UNSAFE_METHODS`, `getAllowedOrigins`,
    `normalizeOrigin`, `getOriginHeader`, `getAllowedOriginForCors`, `getRequestOrigin` y
    `enforceTrustedOrigin`, copiados **verbatim** de la variante dominante (mismo contrato:
    misma allowlist `ENV.corsOrigins`, mismos status/headers, mismo `"Origen no permitido"`).
  - **`applyCorsHeaders` NO se consolidó** (corrección a la lista del alcance original): su cuerpo
    **varía por ruta** en `access-control-expose-headers` (rate-limit / `Retry-After`), por lo que
    se mantiene **local** en cada archivo. Consolidarlo exigiría parametrizar y cambiar firmas/call-sites.
  - **Rutas migradas (14, familia admin):** `admin-audit`, `admin-clinics`, `admin-failed-login-alerts`,
    `admin-particular-tokens`, `admin-pricing`, `admin-report-access-tokens`, `admin-report-workflow`,
    `admin-reports`, `admin-sessions`, `admin-study-tracking`, `admin-system-health`,
    `admin-system-maintenance`, `admin-system-schema-health`, `admin-users-roles`. Se reemplazaron
    las definiciones locales por `import … from "../lib/cors-headers.ts"` y se eliminó el `const UNSAFE_METHODS`
    local (sólo lo usaba `enforceTrustedOrigin`). Net ≈ **−1.180 líneas** (1.262 borradas / 80 nuevas).
  - **Hallazgo que acota el alcance (no estaba en la auditoría original):** `enforceTrustedOrigin` tiene
    **dos clases de comportamiento** ante método inseguro **sin Origin ni Referer**: *allow-null* (lo
    permite; el hook global `requireTrustedOriginForFastify` cubre el cookie-forgery) vs *block-null*
    (responde 403). **Toda la familia admin es uniformemente *allow-null***, por lo que el canónico
    *allow-null* preserva el comportamiento exacto. Las rutas *block-null* (`particular-study-tracking`,
    `study-tracking`) **quedan fuera** para no alterar su contrato. `getAllowedOrigins` canónico conserva
    el fallback dev (inalcanzable, P3-D); `admin-clinics` tenía una variante simplificada sin fallback,
    **equivalente** porque `ENV.corsOrigins` nunca está vacío (`env.ts:166-173`).
  - **Sin cambios en tests de contrato existentes:** la fase 1 evita deliberadamente los archivos cuyos
    tests fijan **definiciones** (no call-sites): el trío auth (`security-production-invariants.test.ts`
    fija `function normalizeOrigin/getRequestOrigin/enforceTrustedOrigin`) y el trío logística
    (`logistics-*-api.test.ts` fija `function enforceTrustedOrigin`, además de uso *inline* de `UNSAFE_METHODS`).
    `api-production-session-contract.test.ts` fija `function applyCorsHeaders` en 10 rutas — satisfecho
    porque `applyCorsHeaders` se mantiene local. El resto de la suite sólo fija **call-sites**
    (`enforceTrustedOrigin(request, reply, allowedOrigins)`), preservados intactos.
  - **Test nuevo:** `test/cors-headers-shared-helper.test.ts` (10 casos: normalización, allowlist,
    Origin>Referer, `enforceTrustedOrigin` allow-null + 403, `getAllowedOrigins`=`ENV.corsOrigins`, `UNSAFE_METHODS`).
  - **Validación ejecutada (verde):** `pnpm typecheck`, `pnpm typecheck:test`,
    `node --experimental-strip-types --test test/security-trusted-origin-cors-boundaries.test.ts` (4/4) y
    además `security-production-invariants` (11), `api-production-session-contract` (4),
    `security-csrf-mutating-route-coverage` (17), `security-audit-logging-phase-boundaries` (9),
    `security-boundary-suite-completeness` (6), `security-mutation-permission-surface` (5),
    `clinic-management-route-policy` (3), `trusted-origin-router-policy` (2), `reports-suite-completeness` (7),
    `report-write-surface-ownership` (5), los **14** `admin-*` route tests (138) y el helper nuevo (10). La
    suite completa `pnpm test`/`pnpm build` no se corrió (requiere Postgres, igual que la auditoría original — §11/§15).
  - **Pendiente → PR-CORS2:** migrar la familia **clínica/particular/público no fijada por definiciones**
    (`contact`, `clinic-public-profile`, `particular-tokens`, `report-access-tokens`, `reports-status`,
    `reports`, `public-report-access`, `admin-auth` queda en el grupo auth) manteniendo `applyCorsHeaders` local.
  - **Pendiente → PR-CORS3 (requiere tocar tests de contrato en el mismo PR):** trío **auth**
    (`auth`/`admin-auth`/`particular-auth`) y trío **logística** + rutas **block-null**; implica actualizar
    `security-production-invariants.test.ts`, `logistics-*-api.test.ts` y la guardia `function applyCorsHeaders`
    de `api-production-session-contract.test.ts` para verificar el `import` + uso en vez de la definición local.
    `public-professionals.fastify.ts` **no** entra en la consolidación: su CORS es distinto (responde 403,
    mensaje `"Origin no permitido"`, expone rate-limit headers).

### PR-CLEAN6 · dead-code & artefactos
- **Alcance:** eliminar `shared/` + `test/shared-const-and-errors.test.ts`;
  `legacy/drizzle-old/`; `scripts/generate-pwa-icons.py`;
  `scripts/maintenance/FUSION_POR_COMANDO.sh`.
- **Validación:** `pnpm typecheck`; `pnpm typecheck:test`; `pnpm test`; `pnpm build`;
  `pnpm --dir frontend build`.
- **Rollback:** revertir (historia preservada en git).

### PR-CLEAN7 · dependencias frontend sin uso
- **Alcance:** remover `@tanstack/react-query`, `@tanstack/react-table`, `echarts`,
  `echarts-for-react`, `react-hook-form`, `@radix-ui/react-tooltip` de
  `frontend/package.json` (regenerar lock).
- **Validación:** `pnpm install`; `pnpm --dir frontend lint`; `pnpm --dir frontend typecheck`;
  `pnpm --dir frontend build`; E2E (`e2e:smoke`,`e2e:admin-mobile`,`e2e:visual-contract`,`e2e:public-clinic`).
- **Rollback:** revertir el PR (restaura deps + lock).
- **Cautela:** quitar de a una si alguna falla; confirmar 0 imports dinámicos.

---

## 15. Comandos de validación por PR (PowerShell / pnpm)

```powershell
# Baseline (cualquier PR)
pnpm typecheck
pnpm typecheck:test
pnpm --dir frontend typecheck
pnpm --dir frontend lint

# Backend completo (PR-CLEAN3/5/6) — requiere Postgres (CI usa service postgres:16)
pnpm test
pnpm build

# Contratos de env/docs (PR-CLEAN1/2)
node --experimental-strip-types --test test/production-env-contracts.test.ts
node --experimental-strip-types --test test/public-staging-config-contract.test.ts

# Frontend completo (PR-CLEAN7)
pnpm install
pnpm --dir frontend build
pnpm --dir frontend e2e:smoke
pnpm --dir frontend e2e:admin-mobile
pnpm --dir frontend e2e:visual-contract
pnpm --dir frontend e2e:public-clinic

# Inspección de no-uso antes de borrar deps/módulos
git grep -n "<simbolo-o-paquete>" -- frontend/src frontend/e2e server shared
```

---

## 16. Criterios de rollback (transversal)

- Cada PR es **revertible con `git revert`** (cambios acotados a una causa).
- **PR-CLEAN3 (email):** rollback lógico = quitar `PUBLIC_PORTAL_URL` → fallback a
  `CORS_ORIGIN` (sin redeploy de código si solo se borra la var en Render).
- **PR-CLEAN5 (CORS):** si un test de origen falla post-merge, revertir; el helper
  no cambia semántica, así que el revert restaura exactamente el estado previo.
- **PR-CLEAN7 (deps):** restaurar `frontend/package.json` + lock y `pnpm install`.
- **Nunca** combinar dead-code + dependencias + CORS en un mismo PR (aislar la
  causa raíz por PR para rollback limpio).

---

## 17. Checklist final de cierre de proyecto

- [ ] PR-CLEAN1 (docs/env comments) mergeado, contratos de env verdes.
- [ ] PR-CLEAN2 (reorg docs) mergeado, `git grep` de rutas movidas sin huérfanos.
- [ ] PR-CLEAN3 (email URL contract) mergeado, links de email verificados en staging.
- [ ] PR-CLEAN4 (www/CORS) decidido y documentado (o cerrado como N/A).
- [ ] PR-CLEAN5 (consolidación CORS) mergeado, suite CORS verde.
- [ ] PR-CLEAN6 (dead-code/artefactos) mergeado, build backend+frontend verde.
- [ ] PR-CLEAN7 (deps sin uso) mergeado, E2E verde.
- [ ] `.env.example` y `frontend/.env.example` documentan **todas** las vars usadas.
- [ ] `docs/notes/todo.md` ya no contradice la arquitectura real.
- [ ] Taxonomía `docs/` unificada (sin `audit`+`audits`, sin `pr-*.md` sueltos).
- [ ] `main` limpio, CI verde (backend + frontend), 0 PRs abiertos.
- [ ] `pnpm typecheck` + `pnpm --dir frontend typecheck` verdes (hoy: ✅).
- [ ] Documento de cierre/changelog actualizado.

---

## Apéndice A — Evidencia de comandos (resumen reproducible)

```text
git rev-parse --abbrev-ref HEAD     -> audit/final-repo-cleanup-engineering
git log -1 --oneline                -> d1ad9b5 fix(deploy): harden app version force update smoke (#1159)
git status --short                  -> (vacío)
gh pr list --state open             -> (vacío)
git ls-files | wc -l                -> 1117
git grep -l "function getAllowedOrigins" -- server | wc -l   -> 32
git grep -l "function normalizeOrigin"   -- server | wc -l   -> 32
git grep -l "localhost:5173"             -- server | wc -l   -> 32
git grep -n "resolveParticularPortalUrl" -- server           -> email.ts:636,906
git grep -nE "shared/(const|types|_core/errors)" server frontend scripts drizzle -> 0
git grep -n "@tanstack/react-query" -- frontend/src          -> 0
git grep -n "echarts" -- frontend/src                        -> 0
git grep -n "react-hook-form|useForm" -- frontend/src        -> 0 (real)
pnpm typecheck                      -> exit 0
pnpm --dir frontend typecheck       -> exit 0
```

*(La suite `pnpm test` / `pnpm build` / E2E no se ejecutó en esta auditoría por
costo/entorno; el typecheck de ambos paquetes pasó y CI de `main` cubre el resto.)*
