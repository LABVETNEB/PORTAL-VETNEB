# ARCH-7 · Extracción del 2º helper de dominio puro en Logistics

## Objetivo

Extraer **exactamente un** helper de dominio puro adicional del contexto
Logistics hacia `server/features/logistics/domain`, con un PR chico y sin
cambiar runtime, comportamiento observable, API, DB, schema ni contratos.
Continúa el trabajo de ARCH-5 (primer helper) y respeta el guardrail de pureza
de ARCH-6.

## Helper extraído

`normalizeLogisticsLimit(value, defaultLimit?, maxLimit?): number` y
`normalizeLogisticsOffset(value): number`, junto con las constantes
`LOGISTICS_DEFAULT_LIMIT = 50` y `LOGISTICS_MAX_LIMIT = 100` de las que
dependen sus valores por defecto.

Regla de dominio de **paginación de listados de Logistics**: acota `limit` a un
entero positivo dentro de `[1, maxLimit]` (usando el default si el valor es
inválido) y acota `offset` a un entero `>= 0` (usando `0` si el valor es
inválido). Se usan en los 6 listados paginados de Logistics: visitas de campo,
eventos de ruta (lectura clinic-scoped e incremental), instancias de SLA
(lectura general) e instancias de SLA vencidas (overdue).

Cumple los criterios de helper puro:

- Determinístico (misma entrada → misma salida).
- Sin I/O, sin DB, sin fetch, sin Fastify request/reply, sin cookies, sin env,
  sin logging, sin side effects.
- No usa `Date.now` ni ningún reloj; no muta la entrada.
- Testeable input/output en aislamiento.
- Cero dependencias externas (ni siquiera tipos de schema).

## Ubicación nueva

`server/features/logistics/domain/pagination.ts`

Respeta la regla de dependencia de la capa `domain`
(`server/features/logistics/domain/README.md`): no importa `fastify`, ni el
runtime de Drizzle, ni `env`, ni ningún `db-*`. La dependencia apunta hacia
adentro: la capa de persistencia (`server/db-logistics.ts`) importa el helper
de `domain`, nunca al revés. Verificado por
`test/logistics-domain-boundary-guard.test.ts` (sigue verde, sin modificar).

## Origen

Las funciones y constantes existían **de forma implícita** como código
público puro dentro de la capa de persistencia `server/db-logistics.ts` (antes
en las líneas 37-38 y 298-318), invocadas 6 veces por distintos listados. Era
lógica de dominio pura (normalización de paginación) viviendo en el archivo de
persistencia; ARCH-7 la reubica en su capa correcta, igual que ARCH-5 hizo con
`normalizeGenerateHeuristicFieldVisitIds`.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `server/features/logistics/domain/pagination.ts` | **Nuevo.** Constantes `LOGISTICS_DEFAULT_LIMIT`/`LOGISTICS_MAX_LIMIT` y helpers puros `normalizeLogisticsLimit`/`normalizeLogisticsOffset`. |
| `server/db-logistics.ts` | Se elimina la definición local de las 2 constantes y las 2 funciones; se añade `import { LOGISTICS_DEFAULT_LIMIT, LOGISTICS_MAX_LIMIT, normalizeLogisticsLimit, normalizeLogisticsOffset } from "./features/logistics/domain/pagination.ts";` y se re-exportan con `export { ... }` para conservar exactamente la misma superficie pública del módulo (nada externo importaba estos símbolos desde `db-logistics.ts`, pero se preserva por si acaso). Los 6 call-sites quedan idénticos. |
| `test/logistics-db.test.ts` | Se ajusta el test `"logistics DB helpers define bounded pagination defaults"` (ahora `"...wire bounded pagination defaults from the domain layer"`): en vez de verificar el cuerpo de la función en el source de `db-logistics.ts`, verifica el import desde `./features/logistics/domain/pagination.ts` y la presencia de los 4 identificadores. Los demás tests que verifican `normalizeLogisticsLimit(params.limit)` / `normalizeLogisticsOffset(params.offset)` como call-site (líneas 53-54, 139, 187-188, 220-221) **no se tocaron**: siguen siendo ciertos porque el call-site no cambió. |
| `test/logistics-pagination.test.ts` | **Nuevo.** Tests unitarios del helper de dominio (11 casos). |

## Comportamiento preservado

- Los nombres de las funciones/constantes y los 6 call-sites en
  `server/db-logistics.ts` no cambian: `normalizeLogisticsLimit(params.limit)` /
  `normalizeLogisticsOffset(params.offset)`.
- La implementación se movió **verbatim** (misma firma, misma lógica de
  clamping, mismos valores por defecto `50`/`100`).
- `db-logistics.ts` sigue exportando `LOGISTICS_DEFAULT_LIMIT`,
  `LOGISTICS_MAX_LIMIT`, `normalizeLogisticsLimit` y `normalizeLogisticsOffset`
  (vía re-export), preservando su superficie pública.
- No cambian endpoints, payloads, status codes, permisos, queries SQL, schema
  ni contratos.
- El guardrail `test/logistics-domain-boundary-guard.test.ts` sigue
  satisfecho sin modificarlo: `pagination.ts` no importa nada prohibido (no
  tiene ningún import).
- El guardrail de scope dashboard (`dashboardScopeGuardApplies`) no aplica: el
  diff no toca ningún archivo de scope dashboard.

## Tests

`test/logistics-pagination.test.ts` (11 casos):

1. `LOGISTICS_DEFAULT_LIMIT` y `LOGISTICS_MAX_LIMIT` conservan sus valores
   (50/100).
2. `normalizeLogisticsLimit` cae al default con `undefined`, `null`, `0`,
   negativos, decimales y `NaN`.
3. `normalizeLogisticsLimit` acota valores por encima del máximo (incluyendo el
   límite exacto).
4. `normalizeLogisticsLimit` deja pasar valores válidos sin cambios.
5. `normalizeLogisticsLimit` respeta overrides de `defaultLimit`/`maxLimit`.
6. `normalizeLogisticsOffset` cae a `0` con `undefined`, `null`, negativos,
   decimales y `NaN`.
7. `normalizeLogisticsOffset` deja pasar enteros no negativos sin cambios.

`test/logistics-db.test.ts` ajustado (1 test reescrito, sin agregar/quitar
casos): ahora valida el import desde la capa `domain` en vez del cuerpo de la
función.

## Comandos ejecutados

```powershell
git branch --show-current
git log -1 --oneline
git status --short --untracked-files=all
pnpm test
pnpm build
git diff --check
```

## Resultado `pnpm test`

`tests 2980 · pass 2980 · fail 0` (base previa: 2970 tras ARCH-5/6; +11 tests
nuevos del helper, -1 test reescrito sin cambiar el conteo neto de tests fuera
del nuevo archivo).

## Resultado `pnpm build`

OK — `esbuild server/index.ts … dist/index.js 838.1kb`, `Done`. Sin errores.

## `git diff --check`

Exit 0 — sin errores de whitespace.

## `git status --short --untracked-files=all`

```
 M server/db-logistics.ts
 M test/logistics-db.test.ts
?? server/features/logistics/domain/pagination.ts
?? test/logistics-pagination.test.ts
```

(más este documento, `docs/implementation/arch-7-logistics-second-domain-helper.md`)

## Riesgos residuales

- Bajos. El cambio es una reubicación verbatim de código público puro que ya
  vivía sin dependencias fuera de la capa de persistencia; sin superficie de
  comportamiento observable afectada.
- Existe una duplicación conceptual pre-existente con
  `server/lib/list-pagination.ts` (`normalizeListPagination`, usado por otros
  contextos con distintos defaults y semántica de clamping). ARCH-7 no
  consolida ambas implementaciones: eso sería un refactor de comportamiento
  compartido fuera de scope ("solo 1 helper", "no refactor masivo").

## Confirmaciones de scope

- **No deps / lockfiles / CI:** no se tocó `package.json`, `pnpm-lock.yaml` ni CI.
- **No DB / schema / migrations:** sin cambios en `drizzle/**` ni SQL.
- **No API / runtime behavior:** endpoints, payloads, status codes, permisos y
  queries intactos; comportamiento observable idéntico.
- **No auth:** sin cambios en sesiones, roles ni fronteras.
- **No git add/commit/push, no PR, no merge, no stashes, no `.claude/worktrees`.**
- **No uso material del ZIP de skills:** el ZIP/carpeta de skills se usó sólo
  como modo de trabajo/observación; no fue copiado, descomprimido, editado,
  ejecutado ni agregado al repositorio.
