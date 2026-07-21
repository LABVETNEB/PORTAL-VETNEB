# M21 · Mover el dominio de elegibilidad a Public Professionals

## Base exacta

- **Rama base:** `refactor/backend-modularization-m21-public-professionals-domain`.
- **HEAD base:** `ed83ab3dc5a2757ee3168cf38e99ab3ca6daedc4`.
- **Working tree inicial:** limpio. Índice limpio.
- **AGENTS aplicable:** únicamente `AGENTS.md` raíz.
- **Milestone:** Fase E — **M21** (apertura del contexto Public Professionals).
- **Documento rector:** [Backend Enterprise Modularization Program — Audit](../audit/backend-enterprise-modularization-program-audit.md)
  (fila 52 → **M21**: `professional-bank-eligibility` es dominio real).

## Objetivo

Materializar el dominio real de Public Professionals moviendo la regla pura de
elegibilidad del banco de profesionales desde
`server/lib/professional-bank-eligibility.ts` a
`server/features/public-professionals/domain/professional-bank-eligibility.ts`,
detrás de un barrel público, preservando todos los exports y el comportamiento
observable. M21 crea la frontera real de dominio, reapunta el consumidor runtime
y el test de dominio al barrel canónico, conserva el path legacy como shim
temporal y agrega un guard arquitectónico. **No** mueve persistencia, rutas ni
rate limiting.

## Censo de consumidores (evidencia `grep`)

Path legacy `server/lib/professional-bank-eligibility.ts`:

- **Runtime:** `server/db-public-professionals.ts` (único importador). Importa
  `HISTOPATHOLOGY_REPORT_STUDY_TYPE` y `PROFESSIONAL_BANK_ELIGIBILITY_MONTHS`.
- **Test:** `test/unit/contracts/public-professionals/professional-bank-eligibility.test.ts`
  (importa la superficie de comportamiento de la regla).

Ambos se reapuntan al barrel canónico en este PR. Las referencias restantes al
path legacy viven en documentos rectores / de auditoría
(`docs/audit/...`, `docs/architecture/shared-lib-boundary-inventory.md`,
`docs/pr-history/PR-feat-professional-bank-eligibility.md`) y **no se modifican**
en este PR técnico: son baseline histórico, no rompen build/tests/guards. El
shim conserva la compatibilidad de cualquier import legacy hasta M24.

## Exports preservados

Movidos íntegros al módulo canónico (misma superficie pública):

- `PROFESSIONAL_BANK_ELIGIBILITY_MONTHS`
- `HISTOPATHOLOGY_REPORT_STUDY_TYPE`
- `ProfessionalBankReportDeliveryCandidate` (tipo)
- `isHistopathologyReport`
- `addMonths`
- `getProfessionalBankEligibilityWindow`
- `getEligibleUntil`
- `isProfessionalBankEligible`
- `getLastHistopathologyReportDeliveredAt`
- `getProfessionalBankEligibility`

Comportamiento preservado sin cambios: ventana rolling UTC de tres meses,
inclusión exacta del límite, rechazo de fechas inválidas/ausentes, aritmética de
fin de mes, selección de la última entrega admin, exigencia `deliveredByAdmin`,
`eligibleUntil`, payload final y tipos públicos.

## Contradicción detectada con `report-study-types.ts`

El archivo legacy importaba del contexto Reports:

```typescript
import { isReportStudyType, type ReportStudyType } from "./report-study-types.ts";
```

`server/lib/report-study-types.ts` pertenece al contexto **Reports**, cuyo move
está reservado para **M36**. El dominio canónico de Public Professionals **no
debe depender en runtime de ese futuro contexto**. Se aplica una resolución
comportamiento-equivalente que elimina la dependencia:

```typescript
export const HISTOPATHOLOGY_REPORT_STUDY_TYPE = "histopatologia" as const;

export function isHistopathologyReport(input: {
  studyType?: string | null;
}): boolean {
  return input.studyType === HISTOPATHOLOGY_REPORT_STUDY_TYPE;
}
```

No se copia ni se mueve `REPORT_STUDY_TYPES`, y el dominio canónico no importa
`server/lib/report-study-types.ts`.

### Prueba de equivalencia

El predicado histórico era `isReportStudyType(x) && x === HISTOPATHOLOGY_REPORT_STUDY_TYPE`
con `HISTOPATHOLOGY_REPORT_STUDY_TYPE === "histopatologia"` e
`isReportStudyType(x)` verdadero sii `x ∈ REPORT_STUDY_TYPES`
(`["citologia", "histopatologia", "hemoparasitos"]`).

- Si `x === "histopatologia"`: pertenece al catálogo ⇒ `isReportStudyType(x)` es
  `true`, y la igualdad es `true` ⇒ predicado histórico `true`. El nuevo
  predicado (`x === "histopatologia"`) también es `true`.
- Si `x !== "histopatologia"`: la igualdad es `false` ⇒ predicado histórico
  `false` (con o sin pertenencia). El nuevo predicado también `false`.

El nuevo predicado es equivalente porque **el único valor que satisface
simultáneamente la pertenencia al catálogo y la igualdad es `"histopatologia"`**.
La relación contractual (histopatología ∈ catálogo) se preserva **por test**:
`REPORT_STUDY_TYPES.includes(HISTOPATHOLOGY_REPORT_STUDY_TYPE) === true`.

## Decisión shim

Se conserva `server/lib/professional-bank-eligibility.ts` como **shim mínimo**
(`export *` hacia el barrel canónico, sin lógica). Motivo: el programa exige
compatibilidad temporal durante Fase E. Tras M21 el shim **no tiene consumidores
runtime** (el único, `db-public-professionals.ts`, ya consume el barrel). El shim
**expira en M24**, tras el censo final de Fase E. No se conserva lógica
duplicada, wrappers, aliases ni defaults.

## Allowlist (9 paths: 6 A + 3 M, 0 D, 0 R)

```text
A  docs/implementation/m21-public-professionals-domain.md
A  server/features/public-professionals/README.md
A  server/features/public-professionals/domain/README.md
A  server/features/public-professionals/domain/index.ts
A  server/features/public-professionals/domain/professional-bank-eligibility.ts
A  test/architecture/public-professionals-domain-boundary-guard.test.ts
M  server/lib/professional-bank-eligibility.ts
M  server/db-public-professionals.ts
M  test/unit/contracts/public-professionals/professional-bank-eligibility.test.ts
```

| Archivo | Cambio |
| --- | --- |
| `server/features/public-professionals/domain/professional-bank-eligibility.ts` | **CREATED.** Módulo canónico puro (cero imports); resuelve la dependencia con Reports. |
| `server/features/public-professionals/domain/index.ts` | **CREATED.** Barrel público (`export *`). |
| `server/lib/professional-bank-eligibility.ts` | **MODIFIED.** Reemplazado por shim `export *` hacia el barrel. |
| `server/db-public-professionals.ts` | **MODIFIED.** Sólo el specifier del import (barrel canónico). |
| `test/unit/contracts/public-professionals/professional-bank-eligibility.test.ts` | **MODIFIED.** Import reapuntado al barrel + caso de pertenencia al catálogo. |
| `test/architecture/public-professionals-domain-boundary-guard.test.ts` | **CREATED.** Guard de frontera del dominio. |
| `server/features/public-professionals/README.md` | **CREATED.** Frontera del contexto. |
| `server/features/public-professionals/domain/README.md` | **CREATED.** Contrato del dominio puro. |
| `docs/implementation/m21-public-professionals-domain.md` | **CREATED.** Este documento. |

## Contratos preservados

- **db-public-professionals.ts:** sólo cambia el specifier del import
  (`HISTOPATHOLOGY_REPORT_STUDY_TYPE`, `PROFESSIONAL_BANK_ELIGIBILITY_MONTHS` por
  el barrel). SQL, templates, nombres de constantes SQL, queries, mappings,
  filtros, ordenamientos, límites, transacciones (cero), exports, tipos y el
  comportamiento search/detail quedan **byte por byte** idénticos.
- **Regla de elegibilidad:** cuerpo movido sin reescrituras cosméticas salvo la
  eliminación de la dependencia con Reports ya especificada.

## Tests anclados

- `test/architecture/public-professionals-domain-boundary-guard.test.ts`
  (**nuevo**) — existencia del dominio + módulo canónico + barrel, pureza
  (sin db/env/fastify/infra/routes/supabase/fs/http/process/report-study-types
  ni otros `server/lib/**`), cero imports en el canónico, re-export por barrel,
  consumo runtime por barrel, shim sólo-re-export, consumidor apunta al barrel y
  ausencia de copia del catálogo dentro del feature.
- `test/unit/contracts/public-professionals/professional-bank-eligibility.test.ts`
  — mismos casos de comportamiento, import reapuntado al barrel, **+1** caso:
  `REPORT_STUDY_TYPES.includes(HISTOPATHOLOGY_REPORT_STUDY_TYPE)`.
- `test/architecture/public-professionals-source-boundaries.test.ts` — verde sin
  cambios (inspecciona la ruta pública, no el dominio).
- `test/unit/contracts/public-professionals/public-professionals-db-contract.test.ts`,
  `...-histopathology-eligibility.test.ts`,
  `...-histopathology-sql-drift.test.ts` — verdes sin cambios: inspeccionan el
  texto SQL y los nombres de constantes de `db-public-professionals.ts`, que no
  cambian (sólo cambió el specifier del import).

## Exclusiones

Sin cambios en `server/lib/report-study-types.ts`,
`server/lib/public-professionals-rate-limit.ts`,
`server/routes/public-professionals.fastify.ts`, `server/fastify-app.ts`,
`drizzle/**`, `migrations/**`, `supabase/**`, schema, auth/sesiones/cookies/CORS/
CSP/rate-limits/headers, `frontend/**`, `package.json`, lockfiles, `.github/**`,
`scripts/**`, `AGENTS.md`. No se movieron `server/db-public-professionals.ts`,
`server/lib/report-study-types.ts`, `server/lib/public-professionals-rate-limit.ts`
ni `server/routes/public-professionals.fastify.ts`. No se modificaron documentos
rectores/auditoría. No se inició M22, M23 ni M24.

## Validaciones

Ver la sección de validaciones del reporte de ejecución (gates dirigidos con
`pnpm exec tsx --test` sobre el guard nuevo, el guard de source boundaries y los
cuatro contratos de public-professionals; luego `pnpm validate:local`,
`pnpm security:public-surface` y `git diff --check`). Estados canónicos:
`PASSED` / `FAILED` / `NOT_RUN` / `NOT_AVAILABLE` / `BLOCKED`.

## Riesgos residuales

- Bajo. El move preserva la superficie pública y el comportamiento; la única
  divergencia (eliminación de la dependencia con Reports) es comportamiento-
  equivalente y está anclada por test.
- Referencias documentales al path legacy quedan en docs rectores/auditoría (no
  modificables aquí): staleza documental, no rompe build/tests/guards. Se
  reconcilia en el closeout documental posterior.

## Rollback

Revertir el PR restaura el módulo legacy con lógica propia y los imports de
`db-public-professionals.ts` y del test. No hay cambios de schema, migraciones,
rutas ni contratos HTTP que compliquen el revert.

## Estado

```text
M20 cerrado
M21 listo para integración
Fase E abierta
M22 no iniciado
```

El closeout documental posterior registrará la metadata real de merge (PR, SHA,
timestamp, checks); este PR técnico no inventa esos datos.
