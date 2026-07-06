# ARCH-10 · Cierre Logistics Domain Architecture

## Objetivo del bloque

Cerrar y congelar el estado del bloque **Logistics Domain Architecture** de
ARCH-5 a ARCH-9, documentando la frontera actual de
`server/features/logistics/domain` sin modificar runtime, tests, API, DB,
schema, migraciones, auth, dependencias, lockfiles ni CI.

El bloque consolida una capa `domain` chica, pura y testeada para Logistics:

- **ARCH-5 #1301:** extrae el helper puro de normalización de ids de visitas de
  campo para planificación heurística.
- **ARCH-6 #1302:** agrega el guardrail de pureza de la frontera
  `logistics/domain`.
- **ARCH-7 #1303:** extrae el helper puro de paginación de Logistics.
- **ARCH-8 #1304:** crea el barrel público del dominio.
- **ARCH-9 #1305:** agrega el guardrail de imports al barrel público.

## Estado final del árbol

| Archivo | Estado final |
| --- | --- |
| `server/features/logistics/domain/index.ts` | Barrel público del dominio. Re-exporta los helpers puros disponibles sin agregar lógica. Es el punto de entrada para consumidores runtime backend. |
| `server/features/logistics/domain/route-plan-field-visits.ts` | Helper puro de planificación de rutas agregado en ARCH-5. Normaliza ids de field visits para generación heurística. |
| `server/features/logistics/domain/pagination.ts` | Helpers y constantes puras de paginación agregados en ARCH-7. Normalizan `limit` y `offset` para listados de Logistics. |
| `server/features/logistics/domain/README.md` | Documento de frontera de la capa `domain`. Mantiene la regla de dependencia: reglas puras, sin I/O, sin framework y sin persistencia. |

Nota de cierre: `domain/README.md` conserva texto histórico del shell inicial
que menciona un estado docs-only/futuro. ARCH-10 no lo modifica porque el scope
preferido es sólo este archivo nuevo y no hay necesidad funcional de tocar docs
existentes para cerrar el bloque.

## Superficie pública del domain barrel

`server/features/logistics/domain/index.ts` expone exactamente:

| Símbolo | Origen | Responsabilidad |
| --- | --- | --- |
| `normalizeGenerateHeuristicFieldVisitIds` | `./route-plan-field-visits.ts` | Normaliza ids de visitas de campo para planificación heurística. |
| `LOGISTICS_DEFAULT_LIMIT` | `./pagination.ts` | Default de paginación de Logistics: `50`. |
| `LOGISTICS_MAX_LIMIT` | `./pagination.ts` | Máximo de paginación de Logistics: `100`. |
| `normalizeLogisticsLimit` | `./pagination.ts` | Normaliza y acota `limit` a un entero positivo válido. |
| `normalizeLogisticsOffset` | `./pagination.ts` | Normaliza `offset` a un entero no negativo válido. |

El barrel no transforma valores, no envuelve funciones y no agrega lógica. Sólo
re-exporta los símbolos existentes de los archivos internos.

## Helpers puros disponibles

### `normalizeGenerateHeuristicFieldVisitIds(ids: number[]): number[]`

Responsabilidad: sanear la lista de ids de visitas de campo usada para generar
un plan heurístico de rutas.

Reglas:

- Descarta valores que no sean enteros positivos.
- Descarta duplicados.
- Preserva el orden de primera aparición.
- No muta el array de entrada.

### `normalizeLogisticsLimit(value, defaultLimit?, maxLimit?): number`

Responsabilidad: sanear el `limit` de listados paginados de Logistics.

Reglas:

- Usa `LOGISTICS_DEFAULT_LIMIT` (`50`) cuando el valor no es entero positivo.
- Acota valores válidos por encima del máximo a `LOGISTICS_MAX_LIMIT` (`100`).
- Permite overrides explícitos de `defaultLimit` y `maxLimit`.

### `normalizeLogisticsOffset(value): number`

Responsabilidad: sanear el `offset` de listados paginados de Logistics.

Reglas:

- Devuelve `0` cuando el valor no es entero no negativo.
- Devuelve el valor original cuando es un entero `>= 0`.

## Guardrails activos

| Test | Protección |
| --- | --- |
| `test/logistics-domain-boundary-guard.test.ts` | Protege la pureza de `server/features/logistics/domain` y exige que consumidores runtime backend importen el dominio por el barrel público. |
| `test/logistics-domain-barrel.test.ts` | Verifica que el barrel re-exporte los helpers y constantes con comportamiento idéntico al de los archivos internos. |
| `test/logistics-pagination.test.ts` | Verifica constantes y helpers puros de paginación (`limit`/`offset`). |
| `test/logistics-heuristic-field-visit-ids.test.ts` | Verifica el helper puro de normalización de ids de field visits. |

## Reglas de import

- Consumidores runtime backend deben importar Logistics domain desde
  `server/features/logistics/domain/index.ts` o una ruta relativa equivalente
  que resuelva a ese `index.ts`.
- Archivos internos de `server/features/logistics/domain` pueden importarse
  entre sí con imports relativos internos.
- `server/features/logistics/domain/index.ts` puede importar y re-exportar
  archivos internos del dominio.
- Tests unitarios pueden importar archivos internos del dominio para validar
  helpers específicos.
- Consumidores runtime backend fuera de `server/features/logistics/domain` no
  deben importar directo `pagination.ts`, `route-plan-field-visits.ts` ni otros
  archivos internos futuros del dominio.

## Invariantes

La capa `server/features/logistics/domain` queda congelada con estas invariantes:

- Sin I/O.
- Sin DB.
- Sin Fastify.
- Sin `env` / `process`.
- Sin Supabase.
- Sin `fs`, `http`, `https` ni `fetch` runtime.
- Sin dependencias hacia `routes` o `infrastructure` del propio contexto.
- Sin comportamiento dependiente de reloj, red, filesystem o persistencia.
- Helpers determinísticos, testeables por input/output y sin side effects.

## Validaciones esperadas

Para cerrar o revisar este bloque, las validaciones esperadas son:

```powershell
pnpm test
pnpm build
git diff --check
```

En este cierre docs-only también corresponde revisar:

```powershell
git status --short --untracked-files=all
```

## Riesgos residuales

- Bajo. El estado congelado es una capa pequeña con helpers puros y guardrails
  automatizados.
- El barrel protege consumidores runtime contra acoplamiento a nombres de
  archivos internos, pero no impide que tests unitarios importen internos por
  diseño.
- `domain/README.md` mantiene una frase histórica de shell docs-only; no afecta
  runtime ni tests, pero puede actualizarse en un PR docs-only futuro si Nico
  quiere alinear esa documentación secundaria.
- Si en el futuro se agrega una dependencia npm pura al dominio, el guardrail de
  whitelist fallará a propósito y deberá revisarse en el mismo PR.

## Confirmación explícita de scope

ARCH-10 es docs-only y confirma:

- No runtime behavior.
- No API.
- No DB, schema ni migraciones.
- No dependencias, lockfiles ni CI.
- No auth.
- No stashes.
- No `.claude/worktrees`.
- No tests modificados.
- No archivos runtime modificados.
- No `git add`, commit, push, PR ni merge.

## Estado final

Documento de cierre creado en
`docs/implementation/arch-10-logistics-domain-architecture-closeout.md`.
El bloque ARCH-5..ARCH-9 queda resumido y congelado como referencia operativa
para futuros cambios de Logistics domain.
