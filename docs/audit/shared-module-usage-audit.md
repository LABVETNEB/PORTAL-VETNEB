# Auditoría de uso del módulo `shared/` (hallazgo P2-A)

> **Modo:** AUDITORÍA documental, read-only. No se borró/movió ningún archivo, no
> se tocó runtime backend/frontend, DB, migraciones, dependencias, lockfiles,
> workflows, Render ni secretos. Este documento es la única salida.
>
> **Fecha:** 2026-06-29 · **Rama:** `audit/shared-module-usage` ·
> **HEAD:** `f9d1876 docs(audit): update post cors cleanup snapshot (#1171)`.
> **Documento rector:** `docs/audit/final-repo-cleanup-engineering-audit.md` (§P2-A,
> §4 #1-4, §5, §14 PR-CLEAN6). Este doc es el **inventario detallado** que respalda
> y refina ese hallazgo.

---

## 1. Conclusión

El módulo `shared/` (3 archivos) está **MUERTO (DEAD)**: ningún runtime
(`server/`, `frontend/`, `scripts/`, `drizzle/`) ni ningún test de comportamiento
real lo importa. El **único** consumidor es su propio test
`test/shared-const-and-errors.test.ts`, que es **tautológico** (valida los valores
del propio módulo) salvo una única aserción de paridad de literal —y esa aserción
guarda dos literales duplicados, no una fuente de verdad compartida.

Refinamiento sobre el rector: `shared/types.ts` está **doblemente muerto** — ni
siquiera el test lo importa. Tiene cero importadores en todo el repo.

**Recomendación:** ejecutar **PR-CLEAN6** (ya planificado) para eliminar `shared/`
+ su test. Riesgo **bajo**. Esta auditoría **no** ejecuta la eliminación; recomienda
el siguiente PR.

---

## 2. Inventario de archivos

`git ls-files shared` → 3 archivos versionados:

| Archivo | Tamaño | Rol declarado |
| --- | --- | --- |
| `shared/const.ts` | 8 líneas | Constantes (cookie, timeouts, mensajes de error auth) |
| `shared/_core/errors.ts` | 23 líneas | `HttpError` + constructores de error HTTP |
| `shared/types.ts` | 7 líneas | Re-export unificado de tipos (`../drizzle/schema` + `./_core/errors`) |

No hay subcarpetas adicionales. `shared/_core/errors.ts` tiene un BOM inicial
(observado en el rector §P2-A); irrelevante para el uso, relevante para limpieza.

---

## 3. Inventario de exports y tipos

### `shared/const.ts`
| Export | Valor | Notas |
| --- | --- | --- |
| `COOKIE_NAME` | `"app_session_id"` | **Duplicado** del literal hardcodeado en `frontend/src/proxy.ts:3` (`CLINIC_SESSION_COOKIE_NAME = "app_session_id"`). No es fuente de verdad: `proxy.ts` **no** lo importa. |
| `ONE_YEAR_MS` | `1000*60*60*24*365` | Sin consumidores fuera del test. |
| `FETCH_TIMEOUT_MS` | `30_000` | Sin consumidores fuera del test. |
| `AXIOS_TIMEOUT_MS` | `= FETCH_TIMEOUT_MS` | `@deprecated`; residuo de la era axios. Solo el test (P3-E). |
| `UNAUTHED_ERR_MSG` | `"Inicia sesion (10001)"` | Sin consumidores fuera del test. |
| `NOT_ADMIN_ERR_MSG` | `"No tienes el permiso requerido (10002)"` | Sin consumidores fuera del test. |

### `shared/_core/errors.ts`
| Export | Tipo | Notas |
| --- | --- | --- |
| `HttpError` | `class extends Error` | No instanciada en runtime; solo el test. |
| `BadRequestError` | `(msg) => HttpError(400)` | Solo el test. |
| `UnauthorizedError` | `(msg) => HttpError(401)` | Solo el test. |
| `ForbiddenError` | `(msg) => HttpError(403)` | Solo el test. |
| `NotFoundError` | `(msg) => HttpError(404)` | Solo el test. |

### `shared/types.ts`
| Export | Origen | Notas |
| --- | --- | --- |
| `export type * from "../drizzle/schema"` | re-export | **Cero importadores.** |
| `export * from "./_core/errors"` | re-export | **Cero importadores.** |

---

## 4. Dependencias internas e imports relativos

- `shared/types.ts` → importa `../drizzle/schema` y `./_core/errors`
  (dirección: `shared` depende de `drizzle`, **no** al revés).
- `shared/const.ts` → sin imports.
- `shared/_core/errors.ts` → sin imports.
- No hay imports relativos **hacia** `shared/` desde ningún paquete runtime.

---

## 5. Inventario de referencias encontradas (grep reproducible)

```text
# Archivos del módulo
git ls-files shared
-> shared/_core/errors.ts
-> shared/const.ts
-> shared/types.ts

# Imports relativos al módulo (../shared y ../../shared)
git grep -n "from ['\"]\.\./shared"     -> SOLO test/shared-const-and-errors.test.ts:12,19
git grep -n "from ['\"]\.\./\.\./shared" -> (vacío)

# Importadores de cada submódulo
git grep -n "shared/types"   -> 0 en código (solo prosa en docs)
git grep -n "shared/const"   -> SOLO test/...:12 (+ prosa en docs/audit)
git grep -n "shared/_core/errors" -> SOLO test/...:19 (+ prosa en docs/audit)

# Alias / workspace
git grep -n "@shared"        -> 0 en config; solo prosa en el rector
pnpm-workspace.yaml          -> packages: ["frontend"]  (no incluye shared)
tsconfig.json include        -> ["server/**","drizzle/**","scripts/**","*.ts"]  (NO shared/**)
frontend/tsconfig.json paths -> { "@/*": ["./src/*"] }  (sin @shared)
test/tsconfig.json include   -> ["./**/*.ts","../server/**","../drizzle/**","../*.ts"]

# Referencias nominales de exports (fuera de shared/ y su test)
git grep -n "HttpError"            -> SOLO test/shared-const-and-errors.test.ts
git grep -nE "BadRequestError|UnauthorizedError|ForbiddenError|NotFoundError"
                                   -> SOLO el test (la coincidencia en
                                      scripts/generate-pwa-icons.py es FileNotFoundError de Python)
git grep -n "AXIOS_TIMEOUT_MS"     -> SOLO shared/const.ts + el test (+ docs)
git grep -n "FETCH_TIMEOUT_MS"     -> SOLO shared/const.ts + el test (+ docs)
git grep -nE "UNAUTHED_ERR_MSG|NOT_ADMIN_ERR_MSG" -> SOLO shared/const.ts + el test

# Paridad de cookie (única aserción no-tautológica del test)
git grep -n "app_session_id" -- frontend/src/proxy.ts
-> frontend/src/proxy.ts:3: const CLINIC_SESSION_COOKIE_NAME = "app_session_id";  (LITERAL, no import)
git grep -nE "from ['\"].*shared/(const|types|errors)" -- frontend  -> (vacío)
```

### Falsos positivos descartados
- `frontend/src/app/dashboard/admin/*` → `from "./admin-audit-shared"`: es un
  **archivo propio del frontend** (`admin-audit-shared.ts`), no el módulo `shared/`.
- `"shared/"` en `test/frontend-dashboard-*.test.ts` (6 archivos): son **scope
  guards** (lista de prefijos que un PR de frontend **no** puede tocar vía
  `git diff --name-only`). No importan el módulo; verifican que un diff **no**
  contenga `shared/`. Eliminar el directorio **no** los rompe (asertan ausencia,
  no presencia).
- `"shared/"` en `docs/**`: prosa histórica y de planes; no es código.

---

## 6. Configuración TS / workspaces / aliases

| Config | Resultado | Implicancia |
| --- | --- | --- |
| `pnpm-workspace.yaml` | solo `frontend` | `shared/` no es paquete del workspace. |
| `tsconfig.json` (root) `include` | `server`,`drizzle`,`scripts`,`*.ts` | **No** incluye `shared/**` directamente; `shared/` entra al typecheck **solo** vía el grafo de imports del test (`typecheck:test`). |
| `tsconfig.json` `exclude` | `node_modules`,`dist`,`portal-vetneb`,`legacy` | — |
| `frontend/tsconfig.json` `paths` | `@/* -> ./src/*` | Sin `@shared`. |
| `test/tsconfig.json` `include` | `./**/*.ts` + server/drizzle | Cubre el test que importa `../shared/...`. |

**No existe alias `@shared` en ningún tsconfig ni bundler.** Eliminar `shared/` no
requiere tocar ninguna config de paths.

---

## 7. Clasificación DEAD / PARTIAL / LIVE

| Objetivo | Clasificación | Evidencia |
| --- | --- | --- |
| `shared/const.ts` | **DEAD** (solo test tautológico) | único import: el test; `COOKIE_NAME` duplica un literal que `proxy.ts` hardcodea sin importar. |
| `shared/_core/errors.ts` | **DEAD** | `HttpError` y constructores nunca instanciados en runtime; solo el test. |
| `shared/types.ts` | **DEAD (doblemente)** | cero importadores en todo el repo, ni siquiera el test. |
| `test/shared-const-and-errors.test.ts` | **Tautológico** | valida el propio módulo; la única aserción cruzada (paridad cookie) compara dos literales duplicados. |

Estado global del módulo: **DEAD**.

---

## 8. Riesgos

- **Bajo riesgo de eliminación.** Sin alias, sin imports runtime, sin paquete de
  workspace. `typecheck` (root) ni siquiera incluye `shared/**` directamente;
  `typecheck:test` deja de cubrirlo al borrar el test junto al módulo.
- **Pérdida del guard de paridad de cookie:** el test #3 asegura que
  `frontend/src/proxy.ts` contenga el literal `"app_session_id"`. Al borrar el test
  se pierde ese check. **Mitigación:** el valor del guard es bajo (compara dos
  literales duplicados, no protege una fuente de verdad importada). Si se desea
  conservar intención, relocalizar la aserción a un test de proxy/cookie existente
  — **opcional**, decisión del PR-CLEAN6.
- **Contradicción documental menor:** `docs/audit/repository-operational-ordering-audit.md:137`
  cataloga `shared/` como "Bien / No tocar". Es una valoración previa; este
  inventario la supera con evidencia. No reescribir historia, pero el PR-CLEAN6
  debería notar el cambio de criterio.
- **Scope guards intactos:** los `test/frontend-dashboard-*.test.ts` que listan
  `"shared/"` como prefijo bloqueado **no** se ven afectados (asertan ausencia en
  un diff de frontend; el PR-CLEAN6 es scope backend/raíz).

---

## 9. Recomendación para el siguiente PR

**Estado: DEAD → eliminar.** Procede **PR-CLEAN6** tal como ya está planificado en
el rector (§14), sin cambios de alcance:

- **Borrar:** `shared/const.ts`, `shared/_core/errors.ts`, `shared/types.ts`
  (directorio `shared/` completo) + `test/shared-const-and-errors.test.ts`.
- **Decisión opcional dentro del PR:** relocalizar la aserción de paridad de cookie
  (`proxy.ts` contiene `"app_session_id"`) a un test de cookie/proxy vigente, o
  descartarla por bajo valor.
- **No tocar** en este PR: `drizzle/schema` (origen de los re-exports de
  `types.ts`, vive y se usa por sí mismo), ni los scope guards de dashboard.
- **Validación del PR-CLEAN6:** `pnpm typecheck`; `pnpm typecheck:test`;
  `pnpm test`; `pnpm build`; `pnpm --dir frontend build`.
- **Rollback:** `git revert` (historia preservada).

Alternativa contemplada en el rector §6 (adoptar `HttpError` en rutas en vez de
borrar): **no recomendada** — el backend ya resuelve errores con su propio patrón
Fastify; reintroducir `shared/_core/errors` agregaría una dependencia cross-paquete
sin beneficio. Preferir eliminación.

Esta auditoría **no** ejecuta la eliminación: recomienda el PR, no lo aplica.

---

## 10. Confirmación de alcance

- No se modificó runtime backend/frontend, DB, migraciones, dependencias,
  lockfiles, workflows, Render ni secretos.
- Cambios de esta auditoría: **solo documentación** (`docs/audit/`).
- No commit · No push · No PR.
