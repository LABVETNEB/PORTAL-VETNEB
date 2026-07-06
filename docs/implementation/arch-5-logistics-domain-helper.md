# ARCH-5 · Extracción de 1 helper de dominio puro en Logistics

## Objetivo

Extraer **exactamente un** helper de dominio puro del contexto Logistics hacia
`server/features/logistics/domain`, con un PR chico y sin cambiar runtime,
comportamiento observable, API, DB, schema ni contratos. Primer archivo de código
real de la capa `domain` del contexto Logistics (hasta ahora era docs-only).

## Helper extraído

`normalizeGenerateHeuristicFieldVisitIds(ids: number[]): number[]`

Regla de dominio de **planificación de rutas**: normaliza la lista de ids de
visitas de campo con la que se genera un plan heurístico. Descarta valores que no
sean enteros positivos y elimina duplicados, preservando el orden de primera
aparición.

Cumple los criterios de helper puro:

- Determinístico (misma entrada → misma salida).
- Sin I/O, sin DB, sin fetch, sin Fastify request/reply, sin cookies, sin env,
  sin logging, sin side effects.
- No usa `Date.now` ni ningún reloj; no muta la entrada.
- Testeable input/output en aislamiento.
- Cero dependencias externas (ni siquiera tipos de schema).

## Ubicación nueva

`server/features/logistics/domain/route-plan-field-visits.ts`

Respeta la regla de dependencia de la capa `domain`
(`server/features/logistics/domain/README.md`): no importa `fastify`, ni el
runtime de Drizzle, ni `env`, ni ningún `db-*`. La dependencia apunta hacia
adentro: la capa de persistencia (`server/db-logistics.ts`) importa el helper de
`domain`, nunca al revés.

## Origen

La función existía **de forma implícita** como función privada pura dentro de la
capa de persistencia `server/db-logistics.ts` (antes en las líneas 851-865),
invocada por `generateHeuristicRoutePlan`. Era lógica de dominio pura viviendo en
el archivo de persistencia; ARCH-5 la reubica en su capa correcta.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `server/features/logistics/domain/route-plan-field-visits.ts` | **Nuevo.** Helper puro `normalizeGenerateHeuristicFieldVisitIds`. |
| `server/db-logistics.ts` | Se elimina la definición local de la función y se añade `import { normalizeGenerateHeuristicFieldVisitIds } from "./features/logistics/domain/route-plan-field-visits.ts";`. El call-site queda idéntico. |
| `test/logistics-heuristic-field-visit-ids.test.ts` | **Nuevo.** Tests unitarios del helper de dominio. |

## Comportamiento preservado

- El nombre de la función y el call-site en `generateHeuristicRoutePlan` no
  cambian: `normalizeGenerateHeuristicFieldVisitIds(input.fieldVisitIds)`.
- La implementación se movió **verbatim** (misma firma, misma lógica de filtrado y
  deduplicación, mismo orden de resultados).
- No cambian endpoints, payloads, status codes, permisos, queries SQL, schema ni
  contratos.
- El guardrail `test/logistics-db.test.ts` (que exige que el source de
  `db-logistics.ts` contenga el identificador `normalizeGenerateHeuristicFieldVisitIds`)
  sigue satisfecho: el identificador permanece en el `import` y en el call-site.
- El guardrail de scope dashboard (`dashboardScopeGuardApplies`) no aplica: el
  diff no toca ningún archivo de scope dashboard.

## Tests

`test/logistics-heuristic-field-visit-ids.test.ts` (5 casos):

1. Mantiene enteros positivos únicos en orden de primera aparición.
2. Elimina duplicados preservando la primera ocurrencia.
3. Descarta ids no positivos y no enteros (`0`, negativos, decimales, `NaN`).
4. Devuelve lista vacía para entrada vacía.
5. No muta el array de entrada.

## Comandos ejecutados

```powershell
git status --short --untracked-files=all
git branch --show-current
pnpm test
pnpm build
git diff --check
```

## Resultado `pnpm test`

`tests 2970 · pass 2970 · fail 0` (base previa: 2965; +5 tests nuevos del helper).

## Resultado `pnpm build`

OK — `esbuild server/index.ts … dist/index.js 838.0kb`, `Done`. Sin errores.

## `git diff --check`

Exit 0 — sin errores de whitespace.

## Riesgos residuales

- Bajos. El cambio es una reubicación verbatim de una función pura privada; sin
  superficie de comportamiento observable afectada.
- El nombre exportado conserva el prefijo `Generate` (herencia del sitio de
  persistencia) para mantener call-site y guardrail idénticos; refinar el nombre
  quedaría para una iteración futura fuera de scope.

## Confirmaciones de scope

- **No deps / lockfiles / CI:** no se tocó `package.json`, `pnpm-lock.yaml` ni CI.
- **No DB / schema / migrations:** sin cambios en `drizzle/**` ni SQL.
- **No API / runtime behavior:** endpoints, payloads, status codes, permisos y
  queries intactos; comportamiento observable idéntico.
- **No auth:** sin cambios en sesiones, roles ni fronteras.
- **No git add/commit/push, no PR, no merge, no stashes, no `.claude/worktrees`.**
- **No uso material del ZIP de skills:** el ZIP/carpeta de skills se usó sólo como
  modo de trabajo/observación; no fue copiado, descomprimido, editado, ejecutado
  ni agregado al repositorio.
