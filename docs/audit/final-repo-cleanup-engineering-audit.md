# Auditoría final de limpieza y ordenamiento del repositorio — nivel ingeniero

> **Modo:** AUDITORÍA Y PROPUESTA. No se aplicó ningún cambio destructivo, no se
> borró/movió ningún archivo, no se tocaron workflows, DB, migraciones,
> dependencias, lockfiles, Render ni secretos. Este documento es la única salida.
>
> **Skill aplicada:** `vetneb-production-web-optimization-engineer`.
> **Fecha:** 2026-06-28 · **Autor:** auditoría asistida (read-only).
>
> **Actualización documental:** 2026-06-29 · snapshot final del bloque P1-A CORS
> después de PR #1164, #1165, #1166, #1167, #1168, #1169 y #1170. Modo
> docs-only; no se tocó runtime backend/frontend, DB,
> migraciones, dependencias, lockfiles, workflows, Render ni secretos.
>
> **Normalización de estado:** 2026-06-29 · rama
> `docs/final-cleanup-status-normalization`, HEAD
> `b143cbe docs(audit): close frontend dependencies cleanup (#1179)`. Este corte
> separa deuda activa de bloques ya cerrados: P1-B cerrado por #1162, P2-A por
> #1173 y P2-B por #1175-#1179.

---

## 1. Resumen ejecutivo

El repositorio está en estado de **cierre saludable**: `main` limpio, 0 PRs
abiertos, version gate productivo activo, workflow de force update endurecido y
**typecheck verde** (backend y frontend, ambos `exit 0` en esta auditoría). La
arquitectura productiva (Fastify + Supabase/Drizzle, Next.js App Router, proxy
same-origin a `api.vetneb.com.ar`) es coherente y los invariantes de seguridad
(sesiones por rol, `no-store` en privados, tokens no logueados) se respetan.

El trabajo de cierre **no requiere correcciones de P0**. Tras la secuencia
#1164–#1170, el bloque **P1-A CORS** queda cerrado documentalmente como
duplicación masiva resuelta por fases: el contrato común vive en
`server/lib/cors-headers.ts` y las familias migradas importan el helper
compartido. Quedan documentados como remanentes no pendientes
`applyCorsHeaders` local por headers específicos y el middleware global
`trusted-origin`; la única excepción conocida de ruta con contrato distinto es
`public-professionals.fastify.ts`. La actualización #1170
(`clean/backend-cors-helper-logistics-sla`) resolvió el residual GET-only de
`logistics-sla.fastify.ts` importando los helpers compartidos compatibles, sin
cambiar `OPTIONS`, status codes, bodies, headers ni semántica
`Origin`/`Referer`.

La deuda activa restante ya no incluye P1-B, P2-A ni P2-B. Esos bloques quedan
cerrados en este corte:

- **P1-B email public URL:** cerrado por #1162
  (`fix(email): use explicit public site url for portal links`), usando
  `PUBLIC_SITE_URL` como fuente explícita con fallback conservador al
  comportamiento previo.
- **P2-A `shared/`:** cerrado por #1173; se eliminó el módulo muerto y su test.
- **P2-B dependencias frontend:** cerrado por #1175-#1179. PR-CLEAN7A removió
  dependencias core sin uso, PR-CLEAN7C cerró tooling `UNKNOWN`, PR-CLEAN7D/#1178
  removió Radix `SUSPECT unused` y #1179 dejó el cierre documental. Ver
  [`frontend-dependencies-cleanup-closeout.md`](frontend-dependencies-cleanup-closeout.md).
  `@radix-ui/react-toast` y `@radix-ui/react-tooltip` quedan diferidas
  intencionalmente por roadmap/UI; no son deuda activa accidental.

**Estado final de hallazgos (2026-06-29, post-#1186): sin P0, sin P1 activo,
sin P2 activo pendiente de cleanup final y sin P3 activo pendiente de cleanup
final.** Los cuatro bloques que esta auditoría rastreaba como deuda real ya
quedaron cerrados, documentalmente o por ejecución:

1. **P2-D · Taxonomía documental fragmentada**: **cerrado**. El move-only ya
   fue ejecutado por `#1163` (2026-06-28); la duplicación `audit/`+`audits/`,
   las 3 ubicaciones de notas de implementación y los `pr-*.md` sueltos **ya
   no existen en disco**. Re-verificado por `#1186` (auditoría de fase 0). Ver
   [`documentation-taxonomy-fragmentation-audit.md`](documentation-taxonomy-fragmentation-audit.md).
   *(P2, cerrado, no activo.)*
2. **P2-E · Logger/console observability**: logger mínimo y mezcla de
   `console.*`/logger en backend. *(P2.)* **Cerrado documentalmente por
   `#1185` (2026-06-29)** — queda como **deuda moderada documentada y no
   bloqueante** (no como deuda activa de cleanup), con plan futuro opcional.
   Ver detalle más abajo y
   `docs/audit/backend-observability-logger-console-audit.md`.
3. **P3 · Artefactos históricos/orfanados**: **cerrado** por `#1183`
   (`clean/remove-orphaned-historical-artifacts`, 2026-06-29); se eliminaron
   `legacy/drizzle-old/`, `scripts/generate-pwa-icons.py` y
   `scripts/maintenance/FUSION_POR_COMANDO.sh`. *(P3, cerrado, no activo.)*
4. **P3-G · Backend CI `paths-ignore` opcional**: **cerrado** por `#1184`
   (`paths-ignore: ['docs/**', '**/*.md']` en el trigger `pull_request` de
   `backend-ci.yml`) para evitar runs pesados en PRs estrictamente
   docs-only/frontend. *(P3, cerrado, no activo.)*

No quedan eliminaciones ni cambios pendientes de ejecución dentro del alcance
de esta auditoría. Cierre final documentado en
[`final-repo-cleanup-closeout.md`](final-repo-cleanup-closeout.md).

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
- **Estado actualizado (2026-06-29):** **resuelto por fases** para las familias
  incluidas en PR #1164, #1165, #1166, #1167 y #1168, con el residual
  `logistics-sla` resuelto por #1170. El helper compartido
  `server/lib/cors-headers.ts` centraliza `UNSAFE_METHODS`, `getAllowedOrigins`,
  `normalizeOrigin`, `getOriginHeader`, `getAllowedOriginForCors`,
  `getRequestOrigin`, `enforceTrustedOrigin` y
  `enforceTrustedOriginRequired`. No se modificó runtime en este cierre
  documental.
- **Evidencia original (2026-06-28):** las mismas funciones se redefinían en
  cada ruta:
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
- **PRs de resolución:**
  - **#1164 / PR-CORS1:** familia admin allow-null.
  - **#1165 / PR-CORS2:** públicas/particulares seguras allow-null.
  - **#1166 / PR-CORS3A:** auth.
  - **#1167 / PR-CORS3B:** logística real (`field-visits`, `route-events`,
    `route-plans`).
  - **#1168 / PR-CORS3C:** study tracking block-null con
    `enforceTrustedOriginRequired`.
  - **#1169:** cierre documental post-#1168; inventarió `logistics-sla` como
    residual GET-only.
  - **#1170:** migración de `server/routes/logistics-sla.fastify.ts` al helper
    compartido, sin tocar `server/lib/cors-headers.ts` ni
    `server/routes/public-professionals.fastify.ts`.
- **Inventario actualizado tras #1170 (`git grep`, 2026-06-29):**
  - `normalizeOrigin` aparece en `server/lib/cors-headers.ts`,
    `server/routes/public-professionals.fastify.ts`.
  - `getAllowedOrigins` aparece en `server/lib/cors-headers.ts`,
    `server/routes/public-professionals.fastify.ts`.
  - `getRequestOrigin`, `getOriginHeader` y `getAllowedOriginForCors` quedan
    definidos sólo en `server/lib/cors-headers.ts`; `logistics-sla.fastify.ts`
    los importa sin redefinirlos.
  - `enforceTrustedOrigin` / `enforceTrustedOriginRequired` quedan sólo en
    `server/lib/cors-headers.ts`.
  - `Access-Control-Allow-Origin` exacto en mayúsculas → 0 resultados; los
    headers reales se emiten en minúsculas desde `applyCorsHeaders` local.
  - `"Origen no permitido"` permanece en el helper y en call-sites de rutas que
    preservan su contrato; `"Origin no permitido"` queda sólo en
    `public-professionals.fastify.ts`.
- **Remanentes intencionales:** `applyCorsHeaders` se mantiene local en 31 rutas
  porque los `access-control-expose-headers` varían por endpoint; el middleware
  global `server/middlewares/trusted-origin.ts` conserva su contrato propio;
  la única excepción conocida de ruta con contrato distinto es
  `server/routes/public-professionals.fastify.ts`, fuera por decisión explícita:
  mensaje `"Origin no permitido"`, comportamiento CORS propio y
  headers/rate-limit propios. No debe entrar al helper general sin PR dedicado
  de contrato.
- **Residual `logistics-sla` resuelto (2026-06-29):**
  `server/routes/logistics-sla.fastify.ts` es una ruta GET-only
  (`GET,OPTIONS`) y no usaba control de trusted-origin para mutaciones. La
  migración #1170 reemplazó sus copias locales de `getAllowedOrigins`,
  `normalizeOrigin`, `getOriginHeader`, `getAllowedOriginForCors` y
  `getRequestOrigin` por imports desde `server/lib/cors-headers.ts`. Se mantuvo
  `applyCorsHeaders` local y no se introdujo `enforceTrustedOrigin`.
- **Acción:** **cerrado documentalmente** como P1-A por la secuencia
  #1164–#1170, manteniendo `public-professionals` como única excepción conocida
  de ruta y `logistics-sla` como residual ya resuelto por #1170.

#### P1-B · URL pública de email acoplada a `CORS_ORIGIN`
- **Tipo:** architecture / email / env · **Riesgo de cambio:** Medio.
- **Estado actualizado (2026-06-29):** **cerrado por #1162**
  (`fix(email): use explicit public site url for portal links`). La deuda activa
  ya no es el acoplamiento email/CORS: el backend usa URL pública explícita
  (`PUBLIC_SITE_URL`) y conserva fallback al primer origen `https` de
  `CORS_ORIGIN` solo como compatibilidad. Este bloque se conserva como evidencia
  histórica de la causa raíz y del contrato de rollback.
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
- **Acción histórica:** **documentar + proponer** variable explícita `PUBLIC_PORTAL_URL`
  (o `FRONTEND_PUBLIC_URL`) con fallback al comportamiento actual para no romper.
  PR dedicado **PR-CLEAN3**; ejecutado luego por #1162 con `PUBLIC_SITE_URL`.
  Ver §9.
- **Acción actual:** **cerrado**. No listar P1-B como pendiente activo; cualquier
  trabajo posterior es seguimiento operativo de configuración (`PUBLIC_SITE_URL`
  en entorno productivo) o mantenimiento del fallback.

### P2 — Medio (mantenibilidad, DX, limpieza, observabilidad)

#### P2-A · Módulo `shared/` muerto
- **Tipo:** dead-code · **Riesgo:** Bajo.
- **Estado actualizado (2026-06-29):** **cerrado por #1173**. La porción P2-A de
  PR-CLEAN6 eliminó `shared/const.ts`, `shared/types.ts`,
  `shared/_core/errors.ts` y `test/shared-const-and-errors.test.ts`. Este bloque
  queda como trazabilidad histórica, no como deuda activa.
- **Evidencia:** ningún archivo de `server/`, `frontend/`, `scripts/` ni
  `drizzle/` importa `shared/const`, `shared/types` ni `shared/_core/errors`
  (`git grep -nE "shared/(const|types|_core/errors)|@shared/" -- server frontend scripts drizzle` → 0 fuera de e2e). El **único** consumidor es
  `test/shared-const-and-errors.test.ts`. `pnpm-workspace.yaml` solo lista
  `frontend`; no hay alias `@shared` en ningún `tsconfig`.
- **Detalle:** `shared/const.ts` exporta además `AXIOS_TIMEOUT_MS`
  (`@deprecated`, alias de `FETCH_TIMEOUT_MS`) — residuo de la era axios (el
  frontend ya usa `fetch` en `frontend/src/lib/api.ts`). `shared/_core/errors.ts`
  (`HttpError`, `BadRequestError`…) tampoco se usa en runtime; tiene además un BOM inicial.
- **Acción histórica:** **eliminar `shared/` + su test** en un PR
  (**PR-CLEAN6**), tras confirmar build/typecheck. Riesgo bajo: nada productivo
  lo referenciaba.
- **Acción actual:** **cerrado**. Los artefactos P3 de PR-CLEAN6 siguen
  pendientes, pero `shared/` y `AXIOS_TIMEOUT_MS` no deben seguir apareciendo
  como pendientes.
- **Snapshot de auditoría dedicada (2026-06-29, rama `audit/shared-module-usage`,
  HEAD `f9d1876`):** inventario detallado en
  [`docs/audit/shared-module-usage-audit.md`](shared-module-usage-audit.md).
  Confirma **DEAD** con grep reproducible y refina el hallazgo:
  - `git grep -n "from ['\"]../shared"` → **solo** `test/shared-const-and-errors.test.ts:12,19`.
  - `shared/types.ts` está **doblemente muerto**: cero importadores, ni siquiera el
    test (este solo importa `const.ts` y `_core/errors.ts`).
  - `COOKIE_NAME` (`"app_session_id"`) **no** es fuente de verdad: `frontend/src/proxy.ts:3`
    hardcodea el literal sin importar `shared/`. La única aserción no-tautológica del
    test (paridad de cookie) compara dos literales duplicados.
  - Sin alias `@shared` en ningún `tsconfig`/bundler; `tsconfig.json` (root) `include`
    **no** lista `shared/**` (entra al typecheck solo vía el grafo del test, `typecheck:test`).
  - Falsos positivos descartados: `from "./admin-audit-shared"` (archivo propio del
    frontend, no el módulo) y `"shared/"` en 6 `test/frontend-dashboard-*.test.ts`
    (scope guards de prefijo, no imports; eliminar el directorio no los rompe).
  - Recomendación reafirmada: ejecutar **PR-CLEAN6** sin cambio de alcance; opción de
    relocalizar el guard de paridad de cookie (bajo valor). Auditoría docs-only: no se
    tocó runtime; no commit/push/PR.
- **Estado: EJECUTADO** (2026-06-29, rama `clean/remove-dead-shared-module`, base
  HEAD `1af20d2`). Se eliminó el directorio `shared/` completo (`const.ts`,
  `_core/errors.ts`, `types.ts`) + `test/shared-const-and-errors.test.ts` como la
  porción P2-A de PR-CLEAN6, sin cambio de alcance. No se tocó `frontend/src/proxy.ts`,
  no se creó abstracción de cookie, no se adoptó `HttpError`; el guard de paridad de
  cookie se descartó por bajo valor. No se tocaron `package.json`/lockfiles/tsconfig/
  workspace/CI (innecesario: `shared/` no era paquete del workspace ni estaba en
  `include`). Nota de cierre en
  [`docs/audit/shared-module-usage-audit.md`](shared-module-usage-audit.md) §11. Los
  artefactos P3 de PR-CLEAN6 (`legacy/drizzle-old/`, `scripts/generate-pwa-icons.py`,
  `scripts/maintenance/FUSION_POR_COMANDO.sh`) fueron eliminados luego por
  `clean/remove-orphaned-historical-artifacts` (2026-06-29).

#### P2-B · Dependencias de frontend sin uso
- **Tipo:** dependencias / performance-surface · **Estado actualizado
  (2026-06-29):** **cerrado por #1175-#1179**. Queda defer roadmap/UI
  intencional para `@radix-ui/react-toast` y `@radix-ui/react-tooltip`.
- **Snapshot documental dedicado (2026-06-29, rama
  `audit/frontend-dependencies-usage`, HEAD `d958c63`):**
  [`docs/audit/frontend-dependencies-usage-audit.md`](frontend-dependencies-usage-audit.md).
  Inventario completo de `frontend/package.json`: 25 `dependencies` y 12
  `devDependencies`, con búsquedas reproducibles en `frontend/src`,
  `frontend/e2e`, `test`, `scripts`, configs y `docs` como referencia.
- **Evidencia principal:** el grupo original sigue sin imports runtime/config:
  `@tanstack/react-query`, `@tanstack/react-table`, `echarts`,
  `echarts-for-react`, `react-hook-form`, `@radix-ui/react-tooltip`.
  La auditoría amplía el set `SUSPECT unused` a Radix declarados pero no
  importados: `@radix-ui/react-avatar`,
  `@radix-ui/react-dropdown-menu`, `@radix-ui/react-label`,
  `@radix-ui/react-select`, `@radix-ui/react-tabs`,
  `@radix-ui/react-toast`.
- **Falsos positivos descartados:** `gsap` sí está vivo por imports dinámicos en
  `frontend/src/components/public/PublicScrollReveal.tsx`; `@radix-ui/react-dialog`,
  `@radix-ui/react-separator` y `@radix-ui/react-slot` sí tienen imports runtime;
  Tailwind/PostCSS/Next/React/Playwright/TypeScript son tooling o runtime vivo.
- **Riesgo de eliminación:** `test/package-scripts-contract.test.ts` fija varias
  dependencias como contrato de manifest; cualquier PR de eliminación debe
  actualizar ese test junto con `frontend/package.json` y `pnpm-lock.yaml`.
  PR-CLEAN7C cerró el remanente tooling: `@eslint/eslintrc` y la dependencia
  directa `@next/eslint-plugin-next` fueron eliminadas de forma acotada tras
  validar `lint`; no eran eliminación de runtime.
- **Impacto:** no inflan el bundle servido (Next no las bundlea si no se importan)
  pero sí el `node_modules`, tiempo de install, superficie de `pnpm audit` y ruido
  de actualizaciones. `echarts` en especial es pesado.
- **Acción histórica:** no remover masivamente. Recomendar PRs chicos por grupo. Primer PR
  sugerido: **PR-CLEAN7A** para `@tanstack/react-query`,
  `@tanstack/react-table`, `echarts`, `echarts-for-react` y
  `react-hook-form`, dejando Radix no usados para un PR posterior porque existen
  docs/roadmap que proponen adoptar `toast`/`tooltip`. **No tocar
  `package.json`/lock en esta auditoría.**
- **Acción actual:** **cerrado**. No recomendar PR-CLEAN7D como pendiente: #1178
  ya removió `avatar`, `dropdown-menu`, `label`, `select` y `tabs`. `toast` y
  `tooltip` quedan `DEFER keep` por roadmap/UI, no como cleanup accidental.
- **Estado PR-CLEAN7A:** **EJECUTADO** (2026-06-29, rama
  `clean/remove-unused-frontend-deps-core`, base HEAD `2140f28`). Se removieron
  sólo `@tanstack/react-query`, `@tanstack/react-table`, `echarts`,
  `echarts-for-react` y `react-hook-form` de `frontend/package.json` con
  `corepack pnpm --dir frontend remove ...`, regenerando `pnpm-lock.yaml`.
  `test/package-scripts-contract.test.ts` dejó de exigir esas 5 dependencias.
  No se tocaron Radix, dependencias `UNKNOWN`, runtime frontend/backend, DB,
  migraciones, workflows, Render ni secrets.
- **Estado PR-CLEAN7B / remanente P2-B:** **AUDITORÍA DOCS-ONLY COMPLETADA**
  (2026-06-29, rama `audit/frontend-dependencies-radix-tooling`, HEAD
  `1ac86d0`). Ver
  [`docs/audit/frontend-radix-tooling-dependencies-audit.md`](frontend-radix-tooling-dependencies-audit.md).
  Resultado: 0 imports reales `from`/`require`/`import()` para los 9 paquetes
  auditados. `@radix-ui/react-avatar`, `@radix-ui/react-dropdown-menu`,
  `@radix-ui/react-label`, `@radix-ui/react-select` y
  `@radix-ui/react-tabs` quedan `SUSPECT unused`; `@radix-ui/react-toast` y
  `@radix-ui/react-tooltip` quedan `DEFER keep` por roadmap explícito de
  dashboard premium; `@eslint/eslintrc` y la dependencia directa
  `@next/eslint-plugin-next` fueron resueltas luego por PR-CLEAN7C.
  No se tocaron `frontend/package.json`, `pnpm-lock.yaml`, runtime
  frontend/backend, DB, migraciones, workflows, Render ni secrets en PR-CLEAN7B.
- **Estado PR-CLEAN7C / tooling ESLint:** **EJECUTADO** (2026-06-29, rama
  `clean/frontend-eslint-tooling-deps`, base HEAD `7626865`). Se removieron sólo
  `@eslint/eslintrc` y la dependencia directa `@next/eslint-plugin-next` de
  `frontend/package.json` con
  `corepack pnpm --dir frontend remove @eslint/eslintrc @next/eslint-plugin-next`,
  regenerando `pnpm-lock.yaml`. La decisión se basó en que no existe uso de
  `FlatCompat` ni import de `@eslint/eslintrc` en `frontend/eslint.config.mjs`,
  y en que `eslint-config-next@16.2.9` ya trae transitivamente
  `@next/eslint-plugin-next@16.2.9`. Se actualizó
  `test/package-scripts-contract.test.ts` y el guard histórico
  `test/helpers/clean7a-dependency-cleanup-scope.ts`. No se tocó Radix, runtime
  frontend/backend, DB, migraciones, workflows, Render, secrets ni
  `package.json` raíz.
- **Estado PR-CLEAN7D / Radix unused:** **EJECUTADO** (2026-06-29, rama
  `clean/frontend-radix-unused-core`, mergeado como #1178; HEAD esperado post
  merge `327253e`). Se removieron sólo `@radix-ui/react-avatar`,
  `@radix-ui/react-dropdown-menu`, `@radix-ui/react-label`,
  `@radix-ui/react-select` y `@radix-ui/react-tabs`. Permanecen
  `@radix-ui/react-toast` y `@radix-ui/react-tooltip` como `DEFER keep` por
  roadmap/estandarización UI.
- **Cierre P2-B (2026-06-29):** **CERRADO DOCUMENTALMENTE** en
  [`docs/audit/frontend-dependencies-cleanup-closeout.md`](frontend-dependencies-cleanup-closeout.md).
  El bloque quedó cerrado por #1175, #1176, #1177 y #1178; el tooling `UNKNOWN`
  quedó resuelto; no hubo cambios runtime/API/backend/DB/workflows en este
  closeout docs-only; no se tocaron `frontend/package.json`, `pnpm-lock.yaml`,
  `package.json` raíz ni runtime.

#### P2-C · `docs/notes/todo.md` contradictorio con la arquitectura actual
- **Tipo:** docs · **Riesgo:** Bajo.
- **Evidencia:** el archivo describía "procedimientos **tRPC**", "Sincronización con
  **Google Sheets API**", `CONTROL_CLINICAS`, `REGISTRO_INFORMES`, carga Excel/CSV
  y `SESIONES_ACTIVAS` — una arquitectura que **no corresponde** al sistema real
  (Fastify REST + Supabase/Postgres + Drizzle). La sección de logística al final sí
  es vigente.
- **Acción:** **CERRADO DOCUMENTALMENTE.** El histórico tRPC/Sheets se archivó en
  [`docs/archive/legacy-trpc-sheets-todo.md`](../archive/legacy-trpc-sheets-todo.md);
  `docs/notes/todo.md` quedó solo con la sección de logística vigente y una nota
  que referencia el archivo y `docs/SOURCES_OF_TRUTH.md`. Detalle en
  [`docs/implementation/legacy-todo-note-cleanup.md`](../implementation/legacy-todo-note-cleanup.md).
  Docs-only, sin cambios en runtime/dependencias/DB. **PR-CLEAN1**.

#### P2-D · Taxonomía documental fragmentada
- **Tipo:** docs · **Riesgo:** Bajo.
- **Estado actualizado (2026-06-29):** **ejecutado por `#1163`
  (2026-06-28, `docs: consolidate historical documentation structure`)**. El
  move-only ya ocurrió: `docs/audits/`, `IMPLEMENTATION_NOTES/` (raíz) y
  `docs/implementation-history/` **ya no existen**; `docs/pr-*.md` sueltos en
  la raíz de `docs/` = 0. Lo que la sección de evidencia original describía
  (duplicación `audit/`+`audits/`, 3 hogares de implementation notes, `pr-*.md`
  sueltos) es **histórico**, no deuda activa. Auditoría de fase 0 (re-verificó
  el estado en disco, `git grep` de referencias y tests de contrato) en
  [`docs/audit/documentation-taxonomy-fragmentation-audit.md`](documentation-taxonomy-fragmentation-audit.md).
- **Evidencia original (previa a #1163, conservada por trazabilidad):**
  - `docs/audit/` (62) **y** `docs/audits/` (10): dos taxonomías casi idénticas.
  - Notas de implementación en **3 lugares**: `docs/implementation/` (39),
    `docs/implementation-history/` (13) y `IMPLEMENTATION_NOTES/` en la raíz (34).
  - `docs/pr-history/` (32) **y** ~31 `pr-*.md` sueltos en la raíz de `docs/`
    (`pr-1…pr-10`, `pr-815…pr-826`, `pr0…pr5b`).
- **Acción histórica:** consolidar taxonomía (unificar `audit`/`audits`; mover
  notas a un único árbol; recolectar `pr-*.md` en `pr-history/`). PR de
  solo-docs **PR-CLEAN2**, ejecutado por `#1163`.
- **Acción actual:** **cerrado**. No listar P2-D como pendiente de movimiento;
  el único seguimiento posible es cosmético (índices ya existentes en
  `docs/SOURCES_OF_TRUTH.md` / `docs/HISTORICAL_DOCUMENTATION.md` /
  `docs/audit/README.md`).

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
- **Estado actualizado (2026-06-29):** **cerrado documentalmente** por la rama
  `docs/observability-logger-console-audit` (docs-only, sin tocar runtime). Auditoría
  completa en `docs/audit/backend-observability-logger-console-audit.md`: confirma
  56 `console.*` / 9 `logInfo|logWarn|logError` (estos últimos sólo usados en
  `server/lib/audit.ts`), clasificados en 4 familias — request access logging
  sanitizado (20), email info logs con PII de `recipients` pero sin token (9),
  errores ya sanitizados vía `getSafeErrorName`/`getSanitizedDbErrorDetails` (~17)
  y un subgrupo nuevo de **riesgo moderado** (4 puntos: `middlewares/error-handler.ts:67`,
  `fastify-app.ts:381`, `admin-pricing.fastify.ts:406,502`, `public-pricing.fastify.ts:125`)
  que loguean el objeto `error` completo en vez de sólo `message`/`name`. No se
  detectó fuga de secretos/tokens/contraseñas. Plan futuro (no ejecutado en esta
  rama): unificar a `logInfo/logWarn/logError`, acotar el subgrupo de riesgo
  moderado al patrón `errorName` ya usado en el resto del backend, y evaluar
  redacción parcial de `recipients` en `email.ts`.

#### P2-F · `APP_VERSION` / `CLIENT_MIN_VERSION` / `NEXT_PUBLIC_APP_VERSION` no documentadas en `.env.example`
- **Tipo:** env / docs · **Riesgo:** Bajo.
- **Estado actualizado (2026-06-29):** **cerrado** por la rama
  `docs/env-version-vars-contract`. `.env.example` documenta `APP_VERSION` y
  `CLIENT_MIN_VERSION`; `frontend/.env.example` documenta
  `NEXT_PUBLIC_APP_VERSION`. El cambio fue docs/env-example comments only: no
  se tocó runtime frontend/backend, lógica del version gate, `CORS_ORIGIN`,
  URLs públicas, secretos, dependencias, lockfile, DB, migraciones, workflows ni
  Render. Ver [`docs/implementation/env-version-vars-docs.md`](../implementation/env-version-vars-docs.md).

### P3 — Bajo (cosmético / archaeology / nice-to-have)

| Id | Hallazgo | Evidencia | Acción |
| --- | --- | --- | --- |
| P3-A | `legacy/drizzle-old/` (3 archivos) fuera de la cadena de migración | `legacy/drizzle-old/README.md` lo declara "archaeology only" | **eliminado** — `clean/remove-orphaned-historical-artifacts` (2026-06-29) |
| P3-B | `scripts/generate-pwa-icons.py` orfanado | 0 referencias (`git grep generate-pwa-icons`); skill VETNEB prohíbe Python | **eliminado** — `clean/remove-orphaned-historical-artifacts` (2026-06-29) |
| P3-C | `scripts/maintenance/FUSION_POR_COMANDO.sh` orfanado | 0 referencias; opera sobre `portal-vetneb-main.zip`/`…-dev-eficiencia.zip` (fusión histórica de repos) | **eliminado** — `clean/remove-orphaned-historical-artifacts` (2026-06-29) |
| P3-D | `trusted-origin.ts` conserva helper/fallback propio | Middleware global fuera de `server/routes`; mantiene contrato de protección global y no fue tocado por #1164–#1170 | mantener como remanente intencional salvo PR dedicado |
| P3-E | `AXIOS_TIMEOUT_MS` (`@deprecated`) | residuo histórico de `shared/const.ts`; eliminado junto con P2-A por #1173 | cerrado |
| P3-F | Split `zod` v3 (backend `^3.25.76`) vs v4 (frontend `^4`) | `package.json` vs `frontend/package.json` | documentar (intencional: paquetes separados); revisar a futuro |
| P3-G | `backend-ci.yml` sin `paths:` → corre en PRs de solo-docs/frontend | `.github/workflows/backend-ci.yml:3-16` | Cerrado: `paths-ignore` (`docs/**`, `**/*.md`) en `pull_request` (ver §10) |
| P3-H | Residual CORS local resuelto en `logistics-sla.fastify.ts` | Cerrado por #1170 / `clean/backend-cors-helper-logistics-sla`: la ruta GET-only importa `getAllowedOrigins`, `getAllowedOriginForCors` y `getRequestOrigin` desde `server/lib/cors-headers.ts`; `applyCorsHeaders` queda local | cerrado |

---

## 4. Inventario de posibles eliminaciones

> **Todas** son candidatas a **PR futuro con prueba y rollback**, no a borrado ahora.

| # | Path | Tipo | Evidencia de no-uso | PR |
| --- | --- | --- | --- | --- |
| 1 | `shared/const.ts` | dead-code | eliminado por #1173 junto con P2-A | cerrado |
| 2 | `shared/types.ts` | dead-code | eliminado por #1173 junto con P2-A | cerrado |
| 3 | `shared/_core/errors.ts` | dead-code | eliminado por #1173 junto con P2-A | cerrado |
| 4 | `test/shared-const-and-errors.test.ts` | tests | eliminado por #1173 junto con P2-A | cerrado |
| 5 | `legacy/drizzle-old/` (3 archivos) | cleanup | eliminado por `clean/remove-orphaned-historical-artifacts` | cerrado |
| 6 | `scripts/generate-pwa-icons.py` | cleanup | eliminado por `clean/remove-orphaned-historical-artifacts` | cerrado |
| 7 | `scripts/maintenance/FUSION_POR_COMANDO.sh` | cleanup | eliminado por `clean/remove-orphaned-historical-artifacts` | cerrado |
| 8 | `@tanstack/react-query` (dep frontend) | dependencias | removida por PR-CLEAN7A (#1175) | cerrado |
| 9 | `@tanstack/react-table` (dep frontend) | dependencias | removida por PR-CLEAN7A (#1175) | cerrado |
| 10 | `echarts` + `echarts-for-react` (deps) | dependencias | removidas por PR-CLEAN7A (#1175) | cerrado |
| 11 | `react-hook-form` (dep frontend) | dependencias | removida por PR-CLEAN7A (#1175) | cerrado |
| 12 | Radix remanente no importado | dependencias | `avatar`, `dropdown-menu`, `label`, `select`, `tabs` removidos por PR-CLEAN7D/#1178; `toast`/`tooltip` `DEFER keep` por roadmap | cerrado |
| 13 | `docs/notes/todo.md` (parte tRPC/Sheets) | docs | archivada en `docs/archive/legacy-trpc-sheets-todo.md` | cerrado |

---

## 5. Tabla maestra — archivo / evidencia / riesgo / acción

| Archivo / objetivo | Evidencia | Severidad | Riesgo | Acción | PR |
| --- | --- | --- | --- | --- | --- |
| ~30 rutas `server/routes/*.fastify.ts` (helpers CORS) | Resuelto por fases #1164–#1168, cierre documental #1169 y residual `logistics-sla` resuelto por #1170; helper compartido en `server/lib/cors-headers.ts`; quedan `applyCorsHeaders` local y la única excepción conocida de ruta `public-professionals` | P1 cerrado | Medio | mantener cierre documental; cualquier ajuste futuro debe preservar contrato exacto | PR-CLEAN5 / PR-CORS1–3C + #1169/#1170 |
| `server/lib/email.ts:636-639,906` | URL portal derivaba de `CORS_ORIGIN.find(https)`; cerrado por #1162 con `PUBLIC_SITE_URL` explícita y fallback conservador | P1 cerrado | Medio | mantener contrato documentado; seguimiento operativo de env si aplica | #1162 / PR-CLEAN3 |
| `server/middlewares/trusted-origin.ts` | helper/fallback propio del middleware global | P3 | Bajo | mantener salvo PR dedicado | — |
| `server/routes/logistics-sla.fastify.ts` | ya no contiene copias locales de helpers CORS compartibles; #1170 lo migró a imports desde `server/lib/cors-headers.ts` | P3 cerrado | Bajo | mantener imports compartidos y `applyCorsHeaders` local | — |
| `shared/const.ts` · `shared/types.ts` · `shared/_core/errors.ts` | solo consumidos por su test; eliminados por #1173 | P2 cerrado | Bajo | cerrado; no listar como pendiente | #1173 / PR-CLEAN6 parcial |
| `shared/const.ts:5-6` `AXIOS_TIMEOUT_MS` | `@deprecated`, sin uso runtime; eliminado con `shared/` por #1173 | P3 cerrado | Bajo | cerrado | #1173 |
| `legacy/drizzle-old/*` | "archaeology only" (su README); eliminado | P3 cerrado | Bajo | cerrado | `clean/remove-orphaned-historical-artifacts` |
| `scripts/generate-pwa-icons.py` | 0 refs; Python prohibido; eliminado | P3 cerrado | Bajo | cerrado | `clean/remove-orphaned-historical-artifacts` |
| `scripts/maintenance/FUSION_POR_COMANDO.sh` | 0 refs; fusión histórica; eliminado | P3 cerrado | Bajo | cerrado | `clean/remove-orphaned-historical-artifacts` |
| `frontend/package.json` (Radix remanente) | Tooling ESLint cerrado por PR-CLEAN7C; Radix `avatar`, `dropdown-menu`, `label`, `select`, `tabs` cerrado por PR-CLEAN7D/#1178; `toast`/`tooltip` quedan `DEFER keep` por roadmap | P2 cerrado | Medio | cerrado; no recomendar PR-CLEAN7D como pendiente | #1178 / #1179 |
| `docs/notes/todo.md` | tRPC/Google Sheets inexistentes | P2 cerrado | Bajo | cerrado; archivado en `docs/archive/legacy-trpc-sheets-todo.md` | PR-CLEAN1 |
| `docs/audit/` + `docs/audits/` | unificado por #1163; `docs/audits/` ya no existe | P2 cerrado | Bajo | cerrado | #1163 / PR-CLEAN2 |
| `IMPLEMENTATION_NOTES/` (raíz, 34) | consolidado por #1163; ya no existe | P2 cerrado | Bajo | cerrado | #1163 / PR-CLEAN2 |
| ~31 `docs/pr-*.md` sueltos | movidos a `pr-history/` por #1163; 0 sueltos hoy | P2 cerrado | Bajo | cerrado | #1163 / PR-CLEAN2 |
| `.env.example` / `frontend/.env.example` | `APP_VERSION`, `CLIENT_MIN_VERSION` y `NEXT_PUBLIC_APP_VERSION` documentadas con token no secreto | P2 cerrado | Bajo | cerrado docs-only | P2-F |
| `server/lib/logger.ts` + 56 `console.*` | logger mínimo, mezcla cruda; cerrado documentalmente por `#1185` | P2 cerrado documentalmente | Bajo | deuda moderada documentada, no bloqueante; unificar a futuro (opcional) | #1185 |

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
| `shared/_core/errors.ts` | Alternativa histórica descartada: se eliminó junto con `shared/` por #1173; no reintroducir sin PR dedicado y justificación nueva. |

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
- **Obsoleto / contradictorio (cerrado):** `docs/notes/todo.md` (tRPC + Google
  Sheets; contradecía Fastify/Supabase) — histórico archivado en
  `docs/archive/legacy-trpc-sheets-todo.md`. Revisar
  `docs/notes/PENDIENTE_NORMALIZACION_CLINICS.md`.
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
| `APP_VERSION` | sí (`env.ts:98,152`) | **sí** | documentada en `.env.example` como token no secreto del version gate |
| `CLIENT_MIN_VERSION` | sí (`env.ts:100,163-164`) | **sí** | documentada en `.env.example`; arma el gate 426 y vaciarla/no configurarla lo desarma |
| `RENDER_GIT_COMMIT` | sí (fallback de `appVersion`) | **no** | inyectada por Render; aceptable no documentar |
| `NEXT_PUBLIC_APP_VERSION` | sí (`frontend/src/lib/app-version.ts:8`) | **sí** (en `frontend/.env.example`) | build-time; debe moverse con `APP_VERSION`/`CLIENT_MIN_VERSION` y requiere rebuild |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` | sí | sí | consistentes (`api.vetneb.com.ar` / `vetneb.com.ar`) |
| `CORS_ORIGIN` | sí | sí (`https://vetneb.com.ar`) | allowlist CORS; el doble uso como fuente primaria de URL de email fue cerrado por #1162 con `PUBLIC_SITE_URL` (ver §9) |

**Consistencia del trío del version gate** (coherente con la memoria del
proyecto): `NEXT_PUBLIC_APP_VERSION` (frontend, build-time), `APP_VERSION` y
`CLIENT_MIN_VERSION` (backend, runtime) se mueven juntas al mismo token de
contrato; comparación por **igualdad exacta**. Documentación operativa correcta en
`docs/ops/app-version-force-update-workflow.md` y
`docs/audit/app-version-deploy-automation-audit.md`.

**Riesgo `CORS_ORIGIN` como URL pública:** cerrado por #1162 (ver §9). El
seguimiento operativo es mantener `PUBLIC_SITE_URL=https://vetneb.com.ar` en el
backend productivo y conservar `CORS_ORIGIN` como allowlist, no como identidad
pública primaria.

**`www` no contemplado:** `.env.example` documenta solo el apex
(`https://vetneb.com.ar`). Si usuarios entran por `www.vetneb.com.ar`, el
preflight cross-origin podría fallar (ya señalado en
`docs/audit/backend-api-global-incident-p0.md`). **Investigar** según hosts reales.

**Acción env P2-F cerrada (2026-06-29):** `.env.example` documenta
`APP_VERSION` y `CLIENT_MIN_VERSION`; `frontend/.env.example` documenta
`NEXT_PUBLIC_APP_VERSION`. Se usó placeholder no secreto (`<version-token>`) y
no se modificaron URLs, `CORS_ORIGIN`, lógica del gate ni runtime. El contrato
de URL pública ya fue cerrado por #1162 / PR-CLEAN3.

---

## 9. Deuda de email / token links

- **Archivo:** `server/lib/email.ts`.
- **Función clave:** `resolveParticularPortalUrl(corsOrigins)` (`:636-639`),
  invocada en `sendParticularTokenMail` (`:906`) para el CTA
  `${httpsOrigin}/particulares` del mail de token particular.
- **Dependencia original:** la URL pública del portal **dependía de
  `CORS_ORIGIN`** (primer origen `https`). No había variable dedicada.
- **Estado actual:** **cerrado por #1162**. La URL pública se resuelve desde
  `PUBLIC_SITE_URL` y se conserva fallback a `CORS_ORIGIN` para no romper
  despliegues sin la variable configurada. CTA canónico:
  `https://vetneb.com.ar/particulares`.
- **Riesgos originales cerrados:**
  1. Agregar orígenes a `CORS_ORIGIN` (p.ej. `www`) y/o reordenarlos cambia los
     links de email sin que nadie lo note (`.find()` toma el primero).
  2. Acoplamiento conceptual: allowlist de seguridad ≠ identidad pública.
  3. Riesgo de links viejos: si `CORS_ORIGIN` apuntara a un host no canónico, los
     mails enviarían a ese host. (No hay onrender en runtime hoy, pero el patrón lo permite.)
- **Mitigante:** no hay fuga de token en logs (`email.ts:923`).
- **Propuesta histórica de PR futuro (PR-CLEAN3, ya ejecutada por #1162 con
  `PUBLIC_SITE_URL`):**
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
| `backend-ci.yml` | sólido | `pull_request` tiene `paths-ignore: docs/**, **/*.md` (P3-G, cerrado) → no corre en PRs estrictamente docs-only; sigue corriendo full (postgres+migraciones+test+build, ~15 min) ante cambios en `server/**`, `test/**`, `package.json`, `pnpm-lock.yaml`, `.github/workflows/**`, `drizzle/**`, `scripts/**`, `.env.example` o cualquier archivo no-docs. `push` queda sin `paths-ignore` (sin cambio). `pnpm audit`/`pnpm audit --prod` pueden romper CI por advisories de devDeps. |
| `frontend-ci.yml` | sólido | `paths:` correctos; E2E en 4 grupos; `concurrency` con cancel. |
| `app-version-force-update.yml` | excelente | `workflow_dispatch` only, validación dura de input, sin imprimir secretos, orden frontend→backend, smoke con polling. **No tocar.** |

**Triggers / duplicación:** `backend-ci` corre en `push` (a `main` y muchas ramas
`feat/**,fix/**,…`) **y** `pull_request` a `main`. Un push a una rama con PR
abierto dispara el workflow dos veces; `concurrency: cancel-in-progress` mitiga
parcialmente. **Optimización (P3-G, cerrado):** se agregó `paths-ignore:
['docs/**', '**/*.md']` sólo al trigger `pull_request` de `backend-ci.yml`. Se
verificó con `git grep` que los tests de contrato que leen `.env.example`
(`test/smoke-env-contract.test.ts`, `test/production-env-contracts.test.ts`,
etc.) no dependen de archivos `docs/**`/`*.md`, y que GitHub Actions sólo omite
el job cuando *todos* los archivos del diff caen dentro del `paths-ignore`
(cualquier archivo en `server/**`, `test/**`, `package.json`,
`pnpm-lock.yaml`, `.github/workflows/**`, `drizzle/**`, `scripts/**` o
`.env.example` sigue disparando el job normalmente). El trigger `push` queda
intacto. Ver
[`docs/implementation/backend-ci-paths-ignore-docs-only.md`](../implementation/backend-ci-paths-ignore-docs-only.md).

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
- **Test tautológico:** `test/shared-const-and-errors.test.ts` validaba un módulo
  muerto (`shared/`) y fue eliminado por #1173 junto con P2-A.
- **Fixtures `onrender`:** intencionales (ver §6). **No** consolidar a la ligera:
  varios tests dependen de `CORS_ORIGIN=…staging.onrender.com` como origen válido.
- **Allowlists:** `test/production-env-contracts.test.ts` y
  `public-staging-config-contract.test.ts` mantienen listas de strings prohibidos en
  `.env.example`; son guardias, no acumulación muerta. Revisar solo si cambia el contrato.
- **Costo:** la suite backend (`pnpm test`) levanta `node --test` sobre `test/**`
  y requiere Postgres (CI usa service `postgres:16`). **No se ejecutó** aquí por
  costo/entorno (sin DB local garantizada); el typecheck (backend+frontend) **sí**
  pasó. CI de `main` cubre la suite.
- **Cobertura CORS post-consolidación:** PR #1164 creó la cobertura dedicada de
  `server/lib/cors-headers.ts`; las fases siguientes mantuvieron tests de
  integración por familia de rutas. Cualquier PR futuro sobre remanentes debe
  conservar esa doble cobertura.

---

## 12. Deuda de performance / eficiencia

| Tema | Estado | Acción |
| --- | --- | --- |
| Code splitting frontend | `gsap`/`ScrollTrigger` lazy (`PublicScrollReveal.tsx:112-114`); `next/dynamic` en `AdminClinicsManagementCard`, `ParticularesContent` | OK |
| Deps pesadas sin uso | `echarts`/`echarts-for-react`/`react-query`/`react-table`/`react-hook-form` con 0 refs | cerrado por PR-CLEAN7A (#1175) |
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

- **CORS (P1-A):** seguridad sensible. El bloque de duplicación masiva ya fue
  consolidado por fases #1164–#1168 y el residual `logistics-sla` fue resuelto
  por #1170; cualquier PR futuro sobre remanentes
  (`public-professionals`, `trusted-origin`) debe tratarse como
  cambio dedicado y preservar contrato exacto. Mitigación: helper con **igual
  semántica byte a byte** + correr tests CORS/trusted-origin por familia.
- **Email URL (P1-B/PR-CLEAN3):** riesgo histórico cerrado por #1162; la
  mitigación aplicada fue **fallback al comportamiento actual** + test de ambos
  caminos.
- **Mover docs (PR-CLEAN2):** algunos tests de contrato **leen rutas de archivos**.
  Mitigación: `git grep -n "<ruta-doc>"` antes de mover; ajustar guardas en el mismo PR
  (precedente del proyecto: tests de scope alineados in-PR).
- **Quitar deps (PR-CLEAN7):** riesgo histórico ya cerrado por fases #1175-#1179.
  `toast`/`tooltip` no entran a cleanup accidental: quedan diferidos por
  roadmap/UI.
- **Eliminar `shared/` (PR-CLEAN6):** riesgo histórico ya cerrado por #1173.
  Cualquier reintroducción de constantes/errores compartidos debe ser PR nuevo,
  explícito y con consumidores reales.
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
- **Nota de seguimiento P2-F (ejecución real, rama
  `docs/env-version-vars-contract`, 2026-06-29):** se documentaron
  `APP_VERSION` y `CLIENT_MIN_VERSION` en `.env.example`, y
  `NEXT_PUBLIC_APP_VERSION` en `frontend/.env.example`, usando sólo placeholders
  no secretos. No se tocaron `docs/notes/todo.md`, runtime, dependencias,
  lockfiles, DB, migraciones, workflows, Render ni lógica del version gate.
- **Nota de seguimiento P2-C (ejecución real, rama
  `docs/cleanup-legacy-todo-note`, 2026-06-29):** el histórico tRPC/Google Sheets
  de `docs/notes/todo.md` se movió a
  `docs/archive/legacy-trpc-sheets-todo.md`; `docs/notes/todo.md` quedó con la
  sección de logística vigente y una nota que apunta al archivo y a
  `docs/SOURCES_OF_TRUTH.md`. Detalle en
  `docs/implementation/legacy-todo-note-cleanup.md`. Docs-only, sin tocar
  runtime, dependencias, lockfiles, DB, migraciones ni workflows.

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
- **Estado:** **cerrado por #1162** con el nombre canónico `PUBLIC_SITE_URL`.
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
- **Estado:** cerrado por fases en PR #1164, #1165, #1166, #1167 y #1168.
- **Alcance ejecutado:** crear `server/lib/cors-headers.ts` y reemplazar las
  copias principales por imports en las familias admin, públicas/particulares
  seguras, auth, logística real y study-tracking block-null. `applyCorsHeaders`
  quedó local por variación de headers por ruta.
- **Validación:** cada fase registró typecheck/tests CORS y suites por ruta en
  sus notas de implementación. En este cierre documental sólo se reejecutó
  inventario por `git grep` y validaciones de diff.
- **Rollback histórico:** cada PR de fase es revertible de forma independiente.
- **Exclusiones preservadas:** `public-professionals.fastify.ts` conserva
  contrato/mensaje/headers propios; `trusted-origin.ts` conserva contrato global.
  `logistics-sla.fastify.ts` quedaba como residual GET-only inventariado en este
  corte histórico y fue resuelto luego por #1170
  (`clean/backend-cors-helper-logistics-sla`).
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
- **Nota de seguimiento (ejecución real — PR-CORS2, rama `clean/backend-cors-helper-route-family-2`, 2026-06-28):**
  se ejecutó la **fase 2** de la consolidación sobre la **segunda familia segura** identificada por PR-CORS1
  (rutas *allow-null* y *header-only* cuyo contrato **no** está fijado por tests de definición). El helper
  `server/lib/cors-headers.ts` **no se modificó** (ya exportaba los 7 símbolos); sólo se reemplazaron las
  definiciones locales por `import … from "../lib/cors-headers.ts"` y se eliminó el `const UNSAFE_METHODS`
  local donde quedaba sin uso. `applyCorsHeaders` se mantiene **local** en las 7 rutas (sus
  `access-control-expose-headers` varían: `contact` incluye `Retry-After`; `report-access-tokens` y
  `public-report-access` exponen rate-limit sin `Retry-After`; `clinic-public-profile`, `particular-tokens`,
  `reports-status` y `reports` no exponen headers extra).
  - **Rutas migradas (7):**
    - **Allow-null con `enforceTrustedOrigin` (5):** `contact`, `clinic-public-profile`, `particular-tokens`,
      `report-access-tokens`, `reports-status`. Importan `enforceTrustedOrigin` + `getAllowedOrigins` +
      `getAllowedOriginForCors` (+ `getRequestOrigin` salvo `clinic-public-profile`, ver abajo) y se borró el
      `const UNSAFE_METHODS` local (sólo lo usaba `enforceTrustedOrigin`). Las dos formas locales del cuerpo
      (`!o || allowed.has(o)` en `contact`; `if(!o) …; if(allowed.has(o)) …` en las otras 4) son **equivalentes**
      al canónico *allow-null* — comportamiento exacto preservado.
    - **GET-only sin `enforceTrustedOrigin` (1):** `reports`. Importa `getAllowedOrigins` +
      `getAllowedOriginForCors` + `getRequestOrigin` (este último se usa *inline* en el `optionsHandler`).
    - **Header-only (1):** `public-report-access`. No tiene `getRequestOrigin` ni `enforceTrustedOrigin` ni
      `"Origen no permitido"`; importa sólo `getAllowedOrigins` + `getAllowedOriginForCors`.
  - **Matiz de imports (verificado por uso real, no por nombre):** `clinic-public-profile` **no** importa
    `getRequestOrigin` porque su única referencia vivía dentro del `enforceTrustedOrigin` local (ahora
    importado); el resto sí lo usa en su `optionsHandler` de preflight. `normalizeOrigin`/`getOriginHeader`
    quedan en **0** referencias directas en las 7 rutas (sólo se invocan dentro del helper compartido).
  - **`import { ENV }` sin uso en `contact` y `public-report-access`:** tras migrar, `ENV` sólo lo usaba el
    `getAllowedOrigins` local. Se **deja el import** para replicar exactamente el patrón de PR-CORS1 (las 14
    rutas admin migradas también conservan el `import { ENV }` sin uso; `tsconfig.json` no activa
    `noUnusedLocals`, por lo que `typecheck` lo tolera). Candidato menor a limpieza futura, fuera de alcance.
  - **Sin cambios en tests de contrato:** ningún test fija las **definiciones** de estas 7 rutas; el resto de
    la suite sólo fija **call-sites** (`enforceTrustedOrigin(request, reply, allowedOrigins)`) y
    `function applyCorsHeaders` (satisfecho porque sigue local). No se añadieron ni modificaron tests.
  - **Diff:** net **−605 líneas** (38 nuevas / 643 borradas) en 7 archivos; sin tocar frontend, DB,
    migraciones, dependencias, lockfiles, workflows ni env.
  - **Validación ejecutada (verde):** `pnpm typecheck`, `pnpm typecheck:test`,
    `node --experimental-strip-types --test test/cors-headers-shared-helper.test.ts` (10/10) y
    `…/security-trusted-origin-cors-boundaries.test.ts` (4/4); además los tests dedicados por ruta
    (`contact-route`, `contact-rate-limit`, `clinic-public-profile.fastify`, `particular-tokens.fastify`,
    `report-access-tokens.fastify`, `reports-status.fastify`, `reports.fastify`, `public-report-access.fastify`,
    `public-report-access-rate-limit`) y los contratos acoplados (`trusted-origin-router-policy`,
    `security-csrf-mutating-route-coverage`, `security-critical-route-surface-registry`,
    `security-boundary-suite-completeness`, `reports-suite-completeness`, los `*-runtime-timing-contract` y
    `*-session-last-access-contract` de las rutas migradas, `report-management-route-policy`,
    `clinic-management-route-policy`, `report-write-surface-ownership`, `global-auth-boundary-contract`,
    `backend-api-no-store-cache-contract`, `fastify-app`). Total ejecutado: typecheck ×2 + **≈205** casos en
    verde, fail 0. `pnpm test`/`pnpm build` completos no se corrieron (requieren Postgres — §11/§15).
  - **Pendiente → PR-CORS3 (sin cambios respecto a PR-CORS1):** trío **auth**
    (`auth`/`admin-auth`/`particular-auth`) y trío **logística** + rutas **block-null**
    (`particular-study-tracking`, `study-tracking`); requiere actualizar en el mismo PR los tests que fijan
    **definiciones** (`security-production-invariants.test.ts`, `logistics-*-api.test.ts`) para verificar el
    `import` en vez de la definición local. `public-professionals.fastify.ts` permanece fuera (CORS y mensaje
    distintos).
- **Nota de seguimiento (ejecución real — PR-CORS3A, rama `clean/backend-cors-helper-auth-routes`, 2026-06-29):**
  se ejecutó la subfase **auth** de PR-CORS3, separada de logística y de rutas *block-null* para mantener el
  diff chico y el contrato exacto. El helper `server/lib/cors-headers.ts` **no se modificó**: ya exportaba
  `UNSAFE_METHODS`, `normalizeOrigin`, `getAllowedOrigins`, `getOriginHeader`, `getAllowedOriginForCors`,
  `getRequestOrigin` y `enforceTrustedOrigin`.
  - **Rutas migradas (3):** `server/routes/auth.fastify.ts`,
    `server/routes/admin-auth.fastify.ts` y `server/routes/particular-auth.fastify.ts`.
    Las tres reemplazan las definiciones locales de `getAllowedOrigins`, `normalizeOrigin`,
    `getOriginHeader`, `getAllowedOriginForCors`, `getRequestOrigin`, `enforceTrustedOrigin` y el
    `const UNSAFE_METHODS` local por imports desde `../lib/cors-headers.ts`.
  - **`applyCorsHeaders` se mantiene local** en las tres rutas, con el mismo cuerpo y los mismos headers
    (`vary`, `access-control-allow-origin`, `access-control-allow-credentials` y
    `LOGIN_RATE_LIMIT_EXPOSED_HEADERS`). La guardia de `api-production-session-contract.test.ts` que fija
    `function applyCorsHeaders` sigue vigente y pasa sin cambios.
  - **Contrato preservado:** misma variante *allow-null* para métodos inseguros sin `Origin`/`Referer`,
    mismo bloqueo 403 con `{ success: false, error: "Origen no permitido" }`, mismo preflight
    `GET,POST,OPTIONS`, mismo reflejo de `Origin` permitido y sin wildcard con credenciales.
  - **Tests actualizados:** `test/security-production-invariants.test.ts` dejó de exigir definiciones locales
    en el trío auth y ahora verifica que el contrato vive en `server/lib/cors-headers.ts`, que las rutas
    importan `enforceTrustedOrigin`, `getAllowedOriginForCors`, `getAllowedOrigins` y `getRequestOrigin`, y
    que no reintroducen las copias locales. `applyCorsHeaders` continúa exigido localmente.
  - **Fuera de alcance respetado:** no se tocaron logística (`logistics-*`), rutas *block-null*
    (`particular-study-tracking`, `study-tracking`), `public-professionals.fastify.ts`, frontend runtime, DB,
    migraciones, dependencias, lockfiles, workflows, Render ni secrets.
  - **Validación ejecutada:** `pnpm typecheck`, `pnpm typecheck:test`, helper CORS (10/10),
    `security-trusted-origin-cors-boundaries` (4/4), `security-production-invariants` (11/11),
    `api-production-session-contract` (4/4), `global-auth-boundary-contract` (5/5), bloque auth específico
    encontrado por grep (167/167), `pnpm build`, `pnpm security:public-surface`,
    `pnpm --dir frontend lint`, `pnpm --dir frontend typecheck` y `pnpm --dir frontend build` verdes.
    `pnpm test` completo fue ejecutado: 2885/2893 pasaron y 8 fallaron por guardas históricas de PRs frontend
    que inspeccionan el `git diff` y prohíben cambios backend (`server/routes/admin-auth.fastify.ts`,
    `server/routes/auth.fastify.ts`), no por regresión CORS/auth.
  - **Pendiente → PR-CORS3B recomendado:** abordar logística y *block-null* por separado. Para logística,
    actualizar primero `logistics-*-api.test.ts` para verificar import/uso del helper compartido. Para
    `particular-study-tracking` y `study-tracking`, preservar explícitamente el contrato *block-null* con una
    variante o wrapper dedicado; no reutilizar el helper *allow-null* sin adaptar contrato.
- **Nota de seguimiento (ejecución real — PR-CORS3B, rama `clean/backend-cors-helper-logistics-routes`, 2026-06-29):**
  se ejecutó la subfase **logística** de PR-CORS3, separada de rutas *block-null* y de
  `public-professionals.fastify.ts` para preservar contratos distintos. El helper
  `server/lib/cors-headers.ts` **no se modificó**: ya exportaba `UNSAFE_METHODS`, `normalizeOrigin`,
  `getAllowedOrigins`, `getOriginHeader`, `getAllowedOriginForCors`, `getRequestOrigin` y
  `enforceTrustedOrigin`.
  - **Rutas migradas (3):** `server/routes/logistics-field-visits.fastify.ts`,
    `server/routes/logistics-route-events.fastify.ts` y `server/routes/logistics-route-plans.fastify.ts`.
    Las tres reemplazan las definiciones locales de `getAllowedOrigins`, `normalizeOrigin`,
    `getOriginHeader`, `getAllowedOriginForCors`, `getRequestOrigin`, `enforceTrustedOrigin` y el
    `const UNSAFE_METHODS` local por imports desde `../lib/cors-headers.ts`. A diferencia del trío auth,
    logística conserva uso directo de `UNSAFE_METHODS` para guardias RBAC de métodos inseguros, por lo que
    también importa ese símbolo desde el helper compartido.
  - **`applyCorsHeaders` se mantiene local** en las tres rutas, con el mismo cuerpo y los mismos headers
    (`vary`, `access-control-allow-origin`, `access-control-allow-credentials`). No se parametrizó ni se
    consolidó en este PR.
  - **Contrato preservado:** misma variante *allow-null* para métodos inseguros sin `Origin`/`Referer`,
    mismo bloqueo 403 con `{ success: false, error: "Origen no permitido" }`, mismo comportamiento
    `Origin`/`Referer`, mismos preflight por ruta (`field-visits`: `GET,POST,PUT,PATCH,OPTIONS`;
    `route-events`: `GET,POST,OPTIONS`; `route-plans`: `GET,POST,PATCH,OPTIONS`) y sin wildcard con
    credenciales.
  - **Tests actualizados:** `test/logistics-field-visits-api.test.ts`,
    `test/logistics-route-events-api.test.ts`, `test/logistics-route-plans-api.test.ts` y
    `test/security-production-invariants.test.ts` dejaron de exigir definiciones locales y ahora verifican
    import/uso del helper compartido, `applyCorsHeaders` local y ausencia de copias CORS.
  - **Fuera de alcance respetado:** no se tocaron `particular-study-tracking`, `study-tracking`,
    `public-professionals.fastify.ts`, frontend runtime, DB, migraciones, dependencias, lockfiles,
    workflows, Render ni secrets.
  - **Validación ejecutada:** `corepack pnpm typecheck`, `corepack pnpm typecheck:test`, helper CORS
    (10/10), `security-trusted-origin-cors-boundaries` (4/4), `security-production-invariants` (11/11),
    los tres contratos logísticos migrados (17/17, 11/11, 23/23), todo `test/logistics-*.test.ts`
    encontrado por grep (219/219), `corepack pnpm build`, `corepack pnpm security:public-surface`,
    `corepack pnpm --dir frontend lint`, `corepack pnpm --dir frontend typecheck` y
    `corepack pnpm --dir frontend build` verdes. `corepack pnpm test` completo fue ejecutado:
    2885/2893 pasaron y 8 fallaron por guardas históricas de PRs frontend que inspeccionan `git diff` y
    prohíben cambios backend (`server/routes/logistics-*.fastify.ts`), no por regresión CORS/logística.
  - **Pendiente → PR-CORS3C recomendado:** abordar sólo rutas *block-null*
    (`particular-study-tracking`, `study-tracking`) con variante/wrapper dedicado que preserve el bloqueo
    de métodos inseguros sin `Origin` ni `Referer`. `public-professionals.fastify.ts` sigue fuera porque su
    CORS y mensaje son distintos.
- **Nota de seguimiento (ejecución real — PR-CORS3C, rama `clean/backend-cors-helper-block-null-routes`, 2026-06-29):**
  se ejecutó la subfase **block-null** de PR-CORS3, limitada a las dos rutas que bloquean métodos inseguros
  sin `Origin` ni `Referer`. El helper `server/lib/cors-headers.ts` ahora exporta
  `enforceTrustedOriginRequired`, variante explícita *block-null* que reutiliza `UNSAFE_METHODS` y
  `getRequestOrigin`, preserva métodos seguros y responde 403 con `{ success: false, error: "Origen no permitido" }`
  cuando el origen falta o no pertenece a la allowlist. La variante *allow-null* `enforceTrustedOrigin` no se
  modificó.
  - **Rutas migradas (2):** `server/routes/particular-study-tracking.fastify.ts` y
    `server/routes/study-tracking.fastify.ts`. Ambas reemplazan las definiciones locales de
    `getAllowedOrigins`, `normalizeOrigin`, `getOriginHeader`, `getAllowedOriginForCors`, `getRequestOrigin`,
    `enforceTrustedOrigin` y el `const UNSAFE_METHODS` local por imports desde `../lib/cors-headers.ts`. Para
    conservar call-sites y guardas existentes, importan `enforceTrustedOriginRequired as enforceTrustedOrigin`.
  - **`applyCorsHeaders` se mantiene local** en ambas rutas, con el mismo cuerpo y los mismos headers
    (`vary`, `access-control-allow-origin`, `access-control-allow-credentials`).
  - **Contrato preservado:** métodos inseguros sin `Origin` ni `Referer` siguen devolviendo 403,
    `Origin` permitido no falla por origen, `Origin` no permitido devuelve 403, el mensaje exacto sigue siendo
    `"Origen no permitido"`, y los preflight `OPTIONS` conservan sus allow-methods por ruta.
  - **Tests actualizados:** `test/cors-headers-shared-helper.test.ts` cubre la variante *block-null*;
    `test/security-production-invariants.test.ts` exige import/uso del helper compartido y ausencia de copias
    CORS locales en las dos rutas; `test/study-tracking.fastify.test.ts` y
    `test/particular-study-tracking.fastify.test.ts` fijan los casos runtime de `Origin` permitido, faltante y
    no permitido.
  - **Fuera de alcance respetado:** no se tocó `public-professionals.fastify.ts`, frontend runtime, DB,
    migraciones, dependencias, lockfiles, workflows, Render ni secrets.
  - **Validación ejecutada:** `pnpm typecheck` y `pnpm typecheck:test` directos fallaron antes de ejecutar
    scripts por `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`; los equivalentes `corepack pnpm typecheck` y
    `corepack pnpm typecheck:test` pasaron. Pasaron también helper CORS (14/14),
    `security-trusted-origin-cors-boundaries` (4/4), `security-production-invariants` (11/11), las dos rutas
    migradas (11/11 y 12/12), contratos CSRF/mutación/management, suite study-tracking, runtime timing,
    `fastify-app`, seguridad cross-auth/sesiones/ownership/audit y report/status/access-token específicos
    ejecutados. `corepack pnpm build`, `corepack pnpm security:public-surface`,
    `corepack pnpm --dir frontend lint`, `corepack pnpm --dir frontend build` y un segundo
    `corepack pnpm --dir frontend typecheck` pasaron; el primer frontend typecheck falló por
    `.next/types/routes.js` faltante antes del build y pasó luego de regenerar `.next`. `corepack pnpm test`
    completo fue ejecutado: 2890/2898 pasaron y 8 fallaron por guardas históricas de PRs frontend que
    inspeccionan `git diff` y prohíben cambios backend (`server/lib/cors-headers.ts` y rutas backend), no por
    regresión CORS/study-tracking.
  - **Recomendación restante:** mantener `public-professionals.fastify.ts` fuera de esta consolidación salvo PR
    dedicado, porque conserva contrato CORS y mensaje propio (`"Origin no permitido"`).
- **Cierre documental posterior a #1168 (rama `docs/close-cors-cleanup-audit`,
  HEAD `5342e9a`, 2026-06-29):** el bloque P1-A queda cerrado como
  consolidación principal resuelta por fases #1164–#1168. El inventario actual
  confirma que `enforceTrustedOrigin`/`enforceTrustedOriginRequired` viven sólo
  en el helper compartido; las familias migradas ya no redefinen
  `getAllowedOrigins`, `normalizeOrigin`, `getOriginHeader`,
  `getAllowedOriginForCors` ni `getRequestOrigin`. Se documentan tres
  categorías remanentes:
  - **Intencional:** `applyCorsHeaders` local por diferencias de
    `access-control-expose-headers` y allow-methods por endpoint.
  - **Excepción explícita:** `server/routes/public-professionals.fastify.ts`
    por contrato CORS, rate-limit headers y mensaje `"Origin no permitido"`.
  - **Residual inventariado entonces:** `server/routes/logistics-sla.fastify.ts`
    mantenía helpers CORS locales en superficie GET-only; fue resuelto luego en
    `clean/backend-cors-helper-logistics-sla`.

- **Nota de seguimiento (ejecución real — residual `logistics-sla`, rama
  `clean/backend-cors-helper-logistics-sla`, 2026-06-29):** se migró sólo
  `server/routes/logistics-sla.fastify.ts` al helper CORS compartido. El helper
  `server/lib/cors-headers.ts` no se modificó.
  - **Ruta migrada (1):** `server/routes/logistics-sla.fastify.ts` reemplaza las
    definiciones locales de `getAllowedOrigins`, `normalizeOrigin`,
    `getOriginHeader`, `getAllowedOriginForCors` y `getRequestOrigin` por imports
    desde `../lib/cors-headers.ts`.
  - **`applyCorsHeaders` se mantiene local** con los mismos headers (`vary`,
    `access-control-allow-origin`, `access-control-allow-credentials`).
  - **Contrato preservado:** la ruta sigue siendo GET-only (`GET,OPTIONS`), no
    introduce `UNSAFE_METHODS` ni `enforceTrustedOrigin`, mantiene preflight
    `GET,OPTIONS`, bloqueo 403 de `OPTIONS` con origen no permitido y la misma
    semántica allow-null para ausencia de `Origin`/`Referer`.
  - **Tests actualizados:** `test/logistics-sla-routes-api.test.ts` y
    `test/security-production-invariants.test.ts` verifican import/uso del
    helper compartido, ausencia de copias CORS locales y preservación del
    contrato GET-only.

### PR-CLEAN6 · dead-code & artefactos
- **Alcance histórico:** eliminar `shared/` + `test/shared-const-and-errors.test.ts`;
  `legacy/drizzle-old/`; `scripts/generate-pwa-icons.py`;
  `scripts/maintenance/FUSION_POR_COMANDO.sh`.
- **Estado actual:** la porción `shared/` (P2-A) está **CERRADA por #1173**
  (2026-06-29, rama `clean/remove-dead-shared-module`): eliminado `shared/` +
  su test. Los artefactos P3 (`legacy/drizzle-old/`, `generate-pwa-icons.py`,
  `FUSION_POR_COMANDO.sh`) quedaron **CERRADOS** por
  `clean/remove-orphaned-historical-artifacts` (2026-06-29): se revalidaron 0
  referencias operativas (`git grep`) y se eliminaron los 3 artefactos sin
  tocar `drizzle/migrations/`, `drizzle/meta/`, runtime, dependencias,
  lockfiles, DB, workflows, Render ni secretos. Detalle en
  [`docs/implementation/remove-orphaned-historical-artifacts.md`](../implementation/remove-orphaned-historical-artifacts.md).
- **Validación:** `pnpm typecheck`; `pnpm typecheck:test`; `pnpm test`; `pnpm build`;
  `pnpm --dir frontend build`.
- **Rollback:** revertir (historia preservada en git).

### PR-CLEAN7 · dependencias frontend sin uso
- **Estado documental:** **bloque P2-B cerrado por #1175-#1179**. Cierre
  dedicado en
  [`docs/audit/frontend-dependencies-cleanup-closeout.md`](frontend-dependencies-cleanup-closeout.md).
  Auditorías base:
  [`frontend-dependencies-usage-audit.md`](frontend-dependencies-usage-audit.md)
  y
  [`frontend-radix-tooling-dependencies-audit.md`](frontend-radix-tooling-dependencies-audit.md).
- **Alcance recomendado por fases:**
  - **PR-CLEAN7A (EJECUTADO 2026-06-29):** remover `@tanstack/react-query`,
    `@tanstack/react-table`, `echarts`, `echarts-for-react` y
    `react-hook-form`; actualizar `test/package-scripts-contract.test.ts`;
    regenerar lock.
  - **PR-CLEAN7B (AUDITORÍA DOCS-ONLY COMPLETADA 2026-06-29):** auditar
    remanente Radix/tooling sin tocar manifests, lockfile ni runtime. Documento:
    [`frontend-radix-tooling-dependencies-audit.md`](frontend-radix-tooling-dependencies-audit.md).
  - **PR-CLEAN7C (EJECUTADO 2026-06-29):** remover tooling ESLint directo
    `@eslint/eslintrc` y dependencia directa `@next/eslint-plugin-next`, con
    lint antes/después y validaciones completas.
  - **PR-CLEAN7D (EJECUTADO 2026-06-29, #1178):** remover Radix
    `SUSPECT unused`: `avatar`, `dropdown-menu`, `label`, `select`, `tabs`.
    Mantener `toast`/`tooltip` como `DEFER keep` mientras siga vigente el
    roadmap de dashboard premium; si se descarta, eliminarlos en PR separado.
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
- **PR-CLEAN3 (email):** rollback lógico = quitar `PUBLIC_SITE_URL` → fallback a
  `CORS_ORIGIN` (sin redeploy de código si solo se borra la var en Render).
- **PR-CLEAN5 (CORS):** ya dividido en fases #1164–#1168, cierre documental
  #1169 y residual `logistics-sla` resuelto por #1170; si aparece una regresión de origen,
  revertir la fase responsable. Cualquier ajuste futuro de
  `public-professionals` o `trusted-origin` debe ser PR dedicado.
- **PR-CLEAN7 (deps):** restaurar `frontend/package.json` + lock y `pnpm install`.
- **Nunca** combinar dead-code + dependencias + CORS en un mismo PR (aislar la
  causa raíz por PR para rollback limpio).

---

## 17. Checklist final de cierre de proyecto

- [x] PR-CLEAN1 (docs/env comments): P2-F cerrado por
  `docs/env-version-vars-contract`; P2-C `docs/notes/todo.md` cerrado, histórico
  archivado en `docs/archive/legacy-trpc-sheets-todo.md`.
- [x] PR-CLEAN2 (reorg docs) mergeado por `#1163`; `git grep` de rutas movidas
  sin huérfanos (re-verificado por `#1186`).
- [x] PR-CLEAN3 / P1-B (email URL contract) cerrado por #1162; `PUBLIC_SITE_URL`
  separa URL pública de `CORS_ORIGIN` con fallback conservador.
- [ ] PR-CLEAN4 (www/CORS) — **fuera del alcance P1-P3 de este cierre; no es
  deuda activa del cleanup final.** Queda diferido como investigación futura
  de topología (decidir si `CORS_ORIGIN` debe incluir `www.vetneb.com.ar`);
  no bloquea el cierre documental ni implica deuda técnica accidental.
- [x] PR-CLEAN5 / P1-A CORS cerrado por la secuencia #1164–#1170; excepción
  única `public-professionals` documentada y residual `logistics-sla` resuelto.
- [x] PR-CLEAN6 (dead-code/artefactos): porción `shared/` (P2-A) cerrada por
  #1173; artefactos P3 (`legacy/drizzle-old/`,
  `generate-pwa-icons.py`, `FUSION_POR_COMANDO.sh`) cerrados por #1183
  (`clean/remove-orphaned-historical-artifacts`, 2026-06-29).
- [x] PR-CLEAN7 / P2-B (deps sin uso): cerrado por #1175-#1179. PR-CLEAN7A
  ejecutado; PR-CLEAN7B docs-only completado; PR-CLEAN7C tooling ejecutado;
  PR-CLEAN7D Radix `SUSPECT unused` ejecutado para `avatar`, `dropdown-menu`,
  `label`, `select` y `tabs`.
  `toast`/`tooltip` quedan diferidos por roadmap y el cierre docs-only queda en
  `docs/audit/frontend-dependencies-cleanup-closeout.md`.
- [x] `.env.example` y `frontend/.env.example` documentan las vars del version
  gate (`APP_VERSION`, `CLIENT_MIN_VERSION`, `NEXT_PUBLIC_APP_VERSION`).
- [x] `docs/notes/todo.md` ya no contradice la arquitectura real.
- [x] Taxonomía `docs/` unificada (sin `audit`+`audits`, sin `pr-*.md`
  sueltos) — cerrado por #1163, re-verificado por #1186.
- [x] P2-E logger/observability cerrado documentalmente por #1185 como deuda
  moderada no bloqueante.
- [x] P3-G `backend-ci.yml` `paths-ignore` cerrado por #1184.
- [ ] `main` limpio, CI verde (backend + frontend), 0 PRs abiertos — **estado
  esperado post-merge de este PR de cierre**; verificado en este corte:
  working tree limpio y 0 PRs abiertos en `docs/final-repo-cleanup-closeout`
  (HEAD `40f4524`); CI se reconfirma al mergear.
- [x] `pnpm typecheck` + `pnpm --dir frontend typecheck` verdes (re-verificado
  en este cierre, ver validaciones).
- [x] Documento de cierre/changelog actualizado:
  [`final-repo-cleanup-closeout.md`](final-repo-cleanup-closeout.md).

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

---

## Apéndice B — Evidencia de cierre P1-A CORS post-#1170 (2026-06-29)

**Base local del cierre documental:**

```text
git branch --show-current -> docs/post-cors-cleanup-snapshot
git log -1 --oneline      -> 6663246 refactor(cors): share helper in logistics sla route (#1170)
git status --short        -> (vacío antes de editar este documento)
```

**Inventario solicitado (`server/routes` + `server/lib`):**

```text
git grep -n "function normalizeOrigin\|const normalizeOrigin" -- server/routes server/lib
-> server/lib/cors-headers.ts:47
-> server/routes/public-professionals.fastify.ts:120

git grep -n "function getAllowedOrigins\|const getAllowedOrigins" -- server/routes server/lib
-> server/lib/cors-headers.ts:24
-> server/routes/public-professionals.fastify.ts:97

git grep -n "function getRequestOrigin\|const getRequestOrigin" -- server/routes server/lib
-> server/lib/cors-headers.ts:80

git grep -n "function getAllowedOriginForCors\|const getAllowedOriginForCors" -- server/routes server/lib
-> server/lib/cors-headers.ts:61

git grep -n "function enforceTrustedOrigin\|const enforceTrustedOrigin" -- server/routes server/lib
-> server/lib/cors-headers.ts:99
-> server/lib/cors-headers.ts:122

git grep -n "function applyCorsHeaders\|const applyCorsHeaders" -- server/routes server/lib
-> 31 definiciones locales en rutas, incluida server/routes/logistics-sla.fastify.ts:129
   y server/routes/public-professionals.fastify.ts:203; 0 definiciones en server/lib.

git grep -n "Origen no permitido\|Origin no permitido" -- server/routes server/lib
-> "Origen no permitido": helper compartido + call-sites de rutas con contrato preservado,
   incluida server/routes/logistics-sla.fastify.ts:606.
-> "Origin no permitido": sólo server/routes/public-professionals.fastify.ts:219.

git grep -n 'from "../lib/cors-headers.ts"' -- server/routes
-> 30 rutas importan el helper compartido, incluida server/routes/logistics-sla.fastify.ts:27.
-> server/routes/public-professionals.fastify.ts no importa el helper por contrato distinto.
```

**Lectura del inventario:**

- La duplicación principal migrada por #1164–#1168 fue removida de las familias
  admin, públicas/particulares seguras, auth, logística real y study-tracking.
- #1169 documentó el cierre post-#1168 y #1170 resolvió el residual
  `logistics-sla.fastify.ts`.
- Los remanentes esperados son el helper compartido, `applyCorsHeaders` local por
  headers específicos y el middleware global `trusted-origin`.
- `public-professionals.fastify.ts` queda como única excepción conocida de ruta
  por contrato distinto: mensaje `"Origin no permitido"`, headers/comportamiento
  propios y exclusión del helper general salvo PR dedicado de contrato.
- `logistics-sla.fastify.ts` ya no redefine helpers CORS compartibles: importa
  `getAllowedOrigins`, `getAllowedOriginForCors` y `getRequestOrigin` desde
  `server/lib/cors-headers.ts`, conserva `applyCorsHeaders` local y mantiene el
  contrato GET/OPTIONS.

---

## Apéndice C — Cierre PR-CLEAN7D Radix unused (2026-06-29)

**Base local:**

```text
git branch --show-current -> clean/frontend-radix-unused-core
git log -1 --oneline      -> a4582e4 chore(frontend): remove redundant eslint tooling deps (#1177)
git status --short        -> (vacio antes de editar)
```

**Decision aplicada:**

- Remover solo `@radix-ui/react-avatar`,
  `@radix-ui/react-dropdown-menu`, `@radix-ui/react-label`,
  `@radix-ui/react-select` y `@radix-ui/react-tabs`.
- Mantener `@radix-ui/react-toast` y `@radix-ui/react-tooltip` como
  `DEFER keep`.
- No tocar runtime frontend/backend, DB, migraciones, workflows, Render,
  secrets, otras dependencias ni `package.json` raiz.

**Evidencia previa:**

```text
git grep amplio -> solo manifest, lockfile, tests/helpers y documentacion.
git grep imports reales from/require/import() para los cinco candidatos -> 0 resultados.
corepack pnpm --dir frontend why <paquete> -> cada candidato era dependencia directa del frontend.
```

**Cambio aplicado:**

```text
corepack pnpm --dir frontend remove @radix-ui/react-avatar @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-select @radix-ui/react-tabs
```

`frontend/package.json` y `pnpm-lock.yaml` fueron actualizados por pnpm. Los
contratos `test/package-scripts-contract.test.ts` y
`test/helpers/clean7a-dependency-cleanup-scope.ts` se ajustaron solo para dejar
de exigir/preservar el grupo removido y seguir preservando Radix activo o
diferido (`dialog`, `separator`, `slot`, `toast`, `tooltip`).
