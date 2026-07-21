# M13 — Logistics: move del cache de route plans a `infrastructure/`

**Estado:** implementado / **pendiente de merge**. Working tree listo para revisión
manual de Nico; ninguna escritura Git/GitHub ejecutada por el agente.

- **Rama:** `refactor/backend-modularization-m13-logistics-cache-adapter`
- **Base exacta:** `5c775b3cd6bd4cc33bbd7442dfe733f6f1169308`
  (`refactor(logistics): move DB persistence to infrastructure (#1509)` = **M12 ya
  mergeado**)
- **Programa:** Fase C (Logistics infra + rutas), milestone **M13**
- **Autorización:** refactor **R2 estructural backend**, autorizado específicamente
  por Nico en la tarea actual (AGENTS.md §3), limitado al move del cache adapter
  descrito en la auditoría R0 aprobada.

## 1. Objetivo y alcance

Mover el cache in-memory de route plans de Logistics a la capa `infrastructure`
del contexto, **byte-idéntico**, preservando exactamente la superficie pública y
el comportamiento observable, dejando el path legacy como shim documentado y
extendiendo el guard ejecutable de frontera existente.

**Incluido:** move byte-idéntico, shim, reapunte de los 2 tests del cache,
extensión del guard de infraestructura, documentación.
**Excluido:** M14, M15, M16, M17; rutas; puerto de cache; schema; migraciones;
dependencias; Redis; serialización; env vars.

## 2. Auditoría R0 (medida en HEAD `5c775b3`, no en cifras documentales)

| Métrica | Valor medido |
| --- | --- |
| LOC de `server/lib/logistics-route-plans-cache.ts` (`wc -l`) | **107** |
| `git hash-object` del archivo original | `132557c77d2676d1c6e69dc0f0aba723b05ffd48` |
| SHA-256 (checksum no secreto) | `437fb6dfc62f155b2b561766f2c292650cd54911247b1c0e1d59e613480a1741` |
| Imports (estáticos + dinámicos + require) | **0** |
| Funciones exportadas | **9** |
| Tipos exportados | **0** (`CacheEntry<T>` es interno) |
| TTL | `5 * 60 * 1000` ms, constante interna, expiración lazy |
| Backing store | 2 `Map<string, CacheEntry<unknown>>` module-level; referencias sin serialización |
| Consumidores runtime | **1** — `server/routes/logistics-route-plans.fastify.ts` (import estático de 6 símbolos) |
| Consumidores de test | 2 — unit (`logistics-route-plans-cache.test.ts`, 9 símbolos) + integration (`logistics-route-plans-cache-runtime.test.ts`, 2 símbolos vía import dinámico) |

Superficie pública (9 exports, antes = después):
`getCachedRoutePlansSnapshot`, `setCachedRoutePlansSnapshot`,
`clearRoutePlansCache`, `clearRoutePlansCacheByClinic`,
`getCachedRoutePlanMetricsSnapshot`, `setCachedRoutePlanMetricsSnapshot`,
`clearRoutePlanMetricsCache`, `clearRoutePlanMetricsCacheByClinic`,
`clearRoutePlanMetricsCacheByPlan`.

**Dato de diseño clave:** la construcción de claves
(`buildRoutePlansListCacheKey`, `buildRoutePlanMetricsCacheKey`,
`serializeCacheValue`), el header `X-Logistics-Cache` y la semántica HIT/MISS
**no viven en el cache**: pertenecen a la ruta
(`server/routes/logistics-route-plans.fastify.ts`) y **siguen ahí hasta M14**.
No existe puerto de cache en domain/application y M13 **no lo introduce**: el
puerto se definirá junto con su primer consumidor real en M14 (criterio del
programa: nunca interfaces vacías anticipadas).

## 3. Estrategia de move

1. Copia **byte-idéntica** del archivo a
   `server/features/logistics/infrastructure/logistics-route-plans-cache.ts`.
   `git hash-object` del canónico = `132557c…` (idéntico al original). Como el
   módulo tiene **cero imports**, no hubo ningún specifier que ajustar (M12
   necesitó 3). **Sin cabecera añadida**: 107 LOC exactos.
2. `server/lib/logistics-route-plans-cache.ts` reemplazado por **shim**:
   comentario de compatibilidad + un único
   `export * from "../features/logistics/infrastructure/logistics-route-plans-cache.ts";`.
   Cero lógica, cero imports, cero exports propios, sin default export.
3. Reapunte de los **2 tests del cache** al canónico (sólo el path del import;
   casos, expectativas y fixtures intactos).
4. Guard de infraestructura **extendido** (no se creó un segundo guard).

**No se hizo:** reorganizar, renombrar, formatear, refactorizar, introducir
puerto/interfaz/DI/event bus/Redis/serialización/fallbacks, ni tocar la ruta.

## 4. Consumidores (antes → después)

| Consumidor | Tipo de import | Antes | Después |
| --- | --- | --- | --- |
| `server/routes/logistics-route-plans.fastify.ts` | estático | `../lib/logistics-route-plans-cache.ts` | **sin cambios** (resuelve por el shim; ruta **byte-idéntica**, verificado con `git diff` vacío) |
| `test/unit/infrastructure/logistics/logistics-route-plans-cache.test.ts` | estático | `server/lib/…` | **canónico** (`…/infrastructure/logistics-route-plans-cache.ts`) |
| `test/integration/adapters/controllers/logistics-route-plans-cache-runtime.test.ts` | dinámico | `server/lib/…` | **canónico** |

Las rutas de field-visits, route-events y SLA **no** importan el cache (verificado
con `git grep` en R0). La única otra referencia en `test/**` al path legacy es un
**comentario** (no assert) en `logistics-domain-boundary-guard.test.ts:234`, que
sigue siendo correcto: describe por qué ese guard no matchea el path del cache.

## 5. Guard de frontera (extensión M13)

`test/architecture/logistics-infrastructure-boundary-guard.test.ts` — mismo
mecanismo (node:test + lectura de fuente + parser de imports, sin dependencias
nuevas, sin spawn). Las reglas generales de M12 quedan **intactas** y, por
auto-descubrimiento de la capa, ya cubren al cache canónico (prohibición de
Fastify/routes/application/frontend/auth/`server/lib`). Se añaden **tres
contratos M13**:

1. **Pureza del cache canónico** — el archivo existe, contiene implementación
   real y tiene **cero specifiers de import** (estático, dinámico o require);
   impide cablearle Redis/DB/Fastify a futuro sin revisión de arquitectura.
2. **Shim sólo-re-export** — el shim legacy existe (hasta M14), sólo referencia
   el canónico, usa `export *` y no declara funciones.
3. **Infra no consume el shim del cache** — ningún archivo de la capa importa
   `server/lib/logistics-route-plans-cache.ts`.

## 6. Archivos (allowlist: 10 paths)

| Archivo | Cambio |
| --- | --- |
| `server/features/logistics/infrastructure/logistics-route-plans-cache.ts` | **NUEVO.** Cache canónico, move byte-idéntico (107 LOC, hash idéntico al original). |
| `server/lib/logistics-route-plans-cache.ts` | **REEMPLAZADO** por shim (comentario + un único `export *`). |
| `test/unit/infrastructure/logistics/logistics-route-plans-cache.test.ts` | **MODIFICADO.** Sólo el path del import. |
| `test/integration/adapters/controllers/logistics-route-plans-cache-runtime.test.ts` | **MODIFICADO.** Sólo el path del import dinámico. |
| `test/architecture/logistics-infrastructure-boundary-guard.test.ts` | **MODIFICADO.** 3 constantes + 3 tests M13; reglas M12 intactas. |
| `server/features/logistics/infrastructure/README.md` | **MODIFICADO.** Cache canónico, shim del cache, M12 mergeado. |
| `server/features/logistics/README.md` | **MODIFICADO.** Estado Fase C, cache migrado, shims, links M12/M13. |
| `server/features/logistics/application/README.md` | **MODIFICADO.** Sólo la sección de futuro (siguiente = M14). |
| `docs/audit/backend-enterprise-modularization-program-audit.md` | **MODIFICADO.** Status M12 mergeado + status M13 en Fase C. |
| `docs/implementation/m13-logistics-cache-infrastructure-move.md` | **NUEVO.** Este documento. |

**Denylist respetada (cero cambios):** `server/routes/**` (incluida
`logistics-route-plans.fastify.ts`, byte-idéntica), `domain/**`,
`application/**/*.ts`, `db-logistics.ts` (canónico y shim), `sla-breach-db.ts`,
`server/db.ts`, `server/fastify-app.ts`, `drizzle/**`, `migrations/**`,
manifests/lockfiles, `.github/**`, `frontend/**`,
auth/cookies/sesiones/CORS/CSP/rate limits, claves de cache, header
`X-Logistics-Cache`, lógica HIT/MISS, M14+.

## 7. Invariantes preservadas (antes = después)

- 9 exports, mismas signatures, defaults `now = Date.now()`.
- TTL 5 minutos exactos; expiración lazy con borrado en lectura; miss = `null`.
- Invalidación completa y por prefijo `clinic:${id}|` / `clinic:${id}|plan:${id}|`
  (scoping por tenant intacto).
- Referencias de objeto sin serialización; 2 Map module-level.
- Header `X-Logistics-Cache` HIT/MISS, no-cache de errores e invalidación tras
  mutaciones: fijados por el contract-test de runtime, que pasa sin ningún cambio
  de expectativas (R-07 del programa mitigado según lo previsto).
- Endpoints, contratos HTTP, schema, migraciones, auth, CORS, CSP, rate limits:
  intactos.

## 8. Riesgo residual y rollback

- **Shim del cache vivo hasta M14**: dos paths válidos para la misma superficie,
  igual que el shim de `db-logistics` (hasta M14–M16). El guard impide que la
  propia capa lo use.
- **Riesgo de comportamiento: muy bajo** — move byte-idéntico (hash verificado),
  cero specifiers ajustados, contract-tests de unit y runtime verdes sin
  modificar expectativas.

Rollback independiente y sin efectos de datos: restaurar la implementación en
`server/lib/logistics-route-plans-cache.ts`, borrar el canónico, revertir los 2
imports de tests, los 3 tests M13 del guard y los 5 archivos documentales.

## 9. Validaciones

| Gate | Estado |
| --- | --- |
| Dirigidos — cache unit + cache runtime + guard infraestructura + guard dominio | **PASSED** |
| `pnpm validate:local` (`typecheck && typecheck:test && test && build`) | **PASSED** |
| `pnpm security:public-surface` | **NOT_RUN** (sin superficie pública/frontend) |
| `pnpm validate:local:schema` | **NOT_RUN** (sin schema/migraciones) |
| E2E (Playwright) | **NOT_RUN** (sin frontend) |
| `db:migrate` local | **NOT_RUN** (move sin schema) |
| Escrituras Git/GitHub | **BLOCKED** para el agente — **[MANUAL-NICO]** |

## 10. Siguiente milestone

**M14 — thin `logistics-route-plans`** (reapunta la ruta al canónico, retira el
shim del cache y define el puerto de cache junto con su primer consumidor real).
**No adelantado aquí.** Fase C **no cerrada**; M13 **no se declara cerrado hasta
el merge**.

## 11. Operaciones [MANUAL-NICO]

El agente **no** ejecutó ninguna escritura Git/GitHub. Pendientes de Nico:
`git add`, `git commit`, `git push`, creación de PR, `gh pr checks --watch` (en
la rama del PR activo, sin número), merge.
