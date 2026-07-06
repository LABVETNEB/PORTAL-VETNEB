# ARCH-8 · Barrel público del contexto Logistics domain

## Objetivo

Consolidar la superficie pública de `server/features/logistics/domain` en un
único punto de entrada (`index.ts`), con un PR chico y sin cambiar runtime,
comportamiento observable, API, DB, schema ni contratos. Continúa el trabajo
de ARCH-5 (primer helper), ARCH-6 (guardrail de pureza) y ARCH-7 (segundo
helper): no extrae lógica nueva, sólo re-exporta lo que ya existe.

## Barrel creado

`server/features/logistics/domain/index.ts`

Re-exporta, sin transformarlos:

- `normalizeGenerateHeuristicFieldVisitIds` — de `./route-plan-field-visits.ts` (ARCH-5).
- `LOGISTICS_DEFAULT_LIMIT`, `LOGISTICS_MAX_LIMIT`, `normalizeLogisticsLimit`,
  `normalizeLogisticsOffset` — de `./pagination.ts` (ARCH-7).

Cumple la regla de dependencia de la capa `domain`
(`server/features/logistics/domain/README.md`): sólo usa imports relativos
internos al propio contexto, sin `fastify`, sin runtime de Drizzle, sin `env`,
sin ningún `db-*`. Verificado por
`test/logistics-domain-boundary-guard.test.ts` (sigue verde, sin modificar,
sin relajar sus reglas).

## Motivación

Antes de ARCH-8, cualquier consumidor de `logistics/domain` debía conocer los
nombres de archivo internos del contexto (`route-plan-field-visits.ts`,
`pagination.ts`). El barrel da una única superficie pública estable
(`server/features/logistics/domain/index.ts`) para que el resto del backend
importe helpers de dominio sin acoplarse a su organización interna de
archivos.

## Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `server/features/logistics/domain/index.ts` | **Nuevo.** Barrel que re-exporta los 5 símbolos existentes de `route-plan-field-visits.ts` y `pagination.ts`. No agrega, mueve ni transforma lógica. |
| `server/db-logistics.ts` | Se reemplazan los 2 imports directos (`./features/logistics/domain/route-plan-field-visits.ts` y `./features/logistics/domain/pagination.ts`) por un único import desde `./features/logistics/domain/index.ts`. El bloque `export { LOGISTICS_DEFAULT_LIMIT, LOGISTICS_MAX_LIMIT, normalizeLogisticsLimit, normalizeLogisticsOffset }` y los 7 call-sites (1 de `normalizeGenerateHeuristicFieldVisitIds`, 6 de paginación) quedan idénticos. |
| `test/logistics-domain-barrel.test.ts` | **Nuevo.** Valida que el barrel re-exporte los 5 símbolos y que su comportamiento sea idéntico al de los archivos internos. |
| `test/logistics-db.test.ts` | Se ajusta el regex del test `"logistics DB helpers wire bounded pagination defaults from the domain layer"`: antes verificaba el import literal a `./features/logistics/domain/pagination.ts`, ahora verifica el import literal a `./features/logistics/domain/index.ts` (consecuencia directa de que `db-logistics.ts` ahora consume el barrel). No se agregan ni quitan aserciones; los demás tests del archivo no se tocaron. |
| `docs/implementation/arch-8-logistics-domain-barrel.md` | **Nuevo.** Este documento. |

## Comportamiento preservado

- Los 5 símbolos exportados (`normalizeGenerateHeuristicFieldVisitIds`,
  `LOGISTICS_DEFAULT_LIMIT`, `LOGISTICS_MAX_LIMIT`, `normalizeLogisticsLimit`,
  `normalizeLogisticsOffset`) mantienen exactamente el mismo nombre, firma e
  implementación; el barrel sólo los re-exporta (`export { ... } from "./archivo.ts"`),
  sin envolverlos ni modificarlos.
- `route-plan-field-visits.ts` y `pagination.ts` no se modificaron: siguen
  siendo el origen real del código; el barrel es puramente un punto de
  agregación.
- `server/db-logistics.ts` sigue exportando `LOGISTICS_DEFAULT_LIMIT`,
  `LOGISTICS_MAX_LIMIT`, `normalizeLogisticsLimit` y `normalizeLogisticsOffset`
  (vía re-export), preservando su superficie pública previa.
- No cambian endpoints, payloads, status codes, permisos, queries SQL, schema
  ni contratos.
- El guardrail `test/logistics-domain-boundary-guard.test.ts` sigue
  satisfecho sin modificarse ni relajarse: el nuevo `index.ts` sólo tiene
  imports relativos internos (`./route-plan-field-visits.ts`, `./pagination.ts`),
  permitidos por sus 3 reglas.
- No se extrajo ningún helper nuevo ni se movió lógica adicional: el barrel
  es 100% re-export.

## Tests

`test/logistics-domain-barrel.test.ts` (2 casos):

1. El barrel re-exporta `LOGISTICS_DEFAULT_LIMIT`, `LOGISTICS_MAX_LIMIT`,
   `normalizeLogisticsLimit` y `normalizeLogisticsOffset` con su comportamiento
   original (default, clamp a máximo, offset negativo, offset grande).
2. El barrel re-exporta `normalizeGenerateHeuristicFieldVisitIds` con su
   comportamiento original (dedupe preservando orden, descarte de valores no
   enteros/no positivos).

`test/logistics-db.test.ts` ajustado (1 regex reescrito, sin agregar/quitar
casos): ahora valida el import desde el barrel (`domain/index.ts`) en vez del
import directo a `domain/pagination.ts`.

Los tests preexistentes `test/logistics-pagination.test.ts` y
`test/logistics-heuristic-field-visit-ids.test.ts` (que importan directo de
`pagination.ts` y `route-plan-field-visits.ts` respectivamente) no se
tocaron: siguen siendo válidos porque esos archivos internos no cambiaron.

## Comandos ejecutados

```powershell
git branch --show-current
git log -1 --oneline
git status --short --untracked-files=all
node --experimental-strip-types --experimental-specifier-resolution=node --test test/logistics-domain-boundary-guard.test.ts test/logistics-domain-barrel.test.ts test/logistics-pagination.test.ts test/logistics-heuristic-field-visit-ids.test.ts
pnpm test
pnpm build
git diff --check
git status --short --untracked-files=all
```

## Resultado `pnpm test`

`tests 2982 · pass 2982 · fail 0` (base previa: 2980 tras ARCH-7; +2 tests
nuevos del barrel, 0 cambio neto en `logistics-db.test.ts` porque sólo se
reescribió un regex existente).

## Resultado `pnpm build`

OK — `esbuild server/index.ts … dist/index.js 838.3kb`, `Done`. Sin errores.

## `git diff --check`

Exit 0 — sin errores de whitespace.

## `git status --short --untracked-files=all`

```
 M server/db-logistics.ts
 M test/logistics-db.test.ts
?? server/features/logistics/domain/index.ts
?? test/logistics-domain-barrel.test.ts
```

(más este documento, `docs/implementation/arch-8-logistics-domain-barrel.md`)

## Riesgos residuales

- Bajos. El cambio es puramente de re-exportación (barrel) sobre código ya
  existente y ya testeado; ningún símbolo cambia de comportamiento.
- `server/db-logistics.ts` ahora depende de `domain/index.ts` en vez de los
  archivos individuales; si en el futuro se elimina algún archivo interno sin
  actualizar el barrel, el guardrail de tests lo detectaría de inmediato (el
  import fallaría en tiempo de ejecución de los tests).
- No se actualizó `server/features/logistics/domain/README.md`: su contenido
  describe la regla de dependencia general de la capa (que el barrel sigue
  cumpliendo) y no hace afirmaciones específicas sobre la ausencia de un
  barrel, por lo que no queda desactualizado.

## Confirmaciones de scope

- **No se extrajo ningún helper nuevo ni se movió lógica adicional:** el
  barrel es 100% re-export de código existente.
- **No deps / lockfiles / CI:** no se tocó `package.json`, `pnpm-lock.yaml` ni CI.
- **No DB / schema / migrations:** sin cambios en `drizzle/**` ni SQL.
- **No API / runtime behavior:** endpoints, payloads, status codes, permisos y
  queries intactos; comportamiento observable idéntico.
- **No auth:** sin cambios en sesiones, roles ni fronteras.
- **No se relajó** `test/logistics-domain-boundary-guard.test.ts`.
- **No git add/commit/push, no PR, no merge, no stashes, no `.claude/worktrees`.**
- **No uso material del ZIP de skills:** el ZIP/carpeta de skills se usó sólo
  como modo de trabajo/observación; no fue copiado, descomprimido, editado,
  ejecutado ni agregado al repositorio.
