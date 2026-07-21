# Public Professionals · domain (reglas puras)

> Capa **domain** del contexto Public Professionals. **Contiene código** desde
> M21. Ver la frontera del contexto en [`../README.md`](../README.md) y el
> contrato en [ARCH-2](../../../../docs/architecture/backend-boundary-adr.md).

## Responsabilidad

Regla de negocio **pura** de elegibilidad del banco de profesionales: determina
si una clínica figura en el directorio público según su **actividad reciente de
histopatología**. Sin efectos secundarios, sin I/O, sin framework. Determinista
y testeable en aislamiento.

## Exports públicos

`professional-bank-eligibility.ts` (consumido por el barrel `index.ts`):

- **Constantes:** `PROFESSIONAL_BANK_ELIGIBILITY_MONTHS` (3),
  `HISTOPATHOLOGY_REPORT_STUDY_TYPE` (`"histopatologia"`).
- **Tipos:** `ProfessionalBankReportDeliveryCandidate`.
- **Funciones:** `isHistopathologyReport`, `addMonths`,
  `getProfessionalBankEligibilityWindow`, `getEligibleUntil`,
  `isProfessionalBankEligible`, `getLastHistopathologyReportDeliveredAt`,
  `getProfessionalBankEligibility`.

## Semántica preservada (sin cambios de comportamiento)

- **Ventana rolling UTC de tres meses.** `deliveredFrom = addMonths(now, -3)`,
  toda la aritmética en UTC.
- **Inclusión exacta del límite.** Elegible si `deliveredAt >= deliveredFrom`
  (el instante límite incluye; un milisegundo antes, no).
- **Rechazo de fechas inválidas / ausentes.** `null`, `undefined` y valores no
  parseables no son elegibles.
- **Aritmética de fin de mes estable.** Se recorta al último día del mes destino
  (p. ej. 31-ene + 3 meses = 30-abr).
- **Selección de la última entrega.** Sólo cuenta la histopatología entregada
  por admin (`deliveredByAdmin`), tomando la más reciente.
- **Payload final.** `{ eligible, lastHistopathologyReportDeliveredAt, eligibleUntil }`.

## Semántica de histopatología y relación con el catálogo

`isHistopathologyReport` evalúa
`input.studyType === HISTOPATHOLOGY_REPORT_STUDY_TYPE`. Esto es equivalente al
predicado histórico `isReportStudyType(x) && x === HISTOPATHOLOGY_...` porque el
único valor que satisface la igualdad también pertenece al catálogo. La relación
contractual **histopatología ∈ catálogo de Reports** se preserva **por test**
(`REPORT_STUDY_TYPES.includes(HISTOPATHOLOGY_REPORT_STUDY_TYPE)`), **no por
dependencia runtime**: `server/lib/report-study-types.ts` pertenece al contexto
Reports (move reservado para M36) y el dominio canónico no lo importa.

## Barrel obligatorio

`index.ts` re-exporta la superficie completa (`export *`) sin transformarla y es
el **único** punto de entrada del dominio. Consumidores runtime y tests deben
importar el barrel, nunca el archivo interno (garantizado por el guard).

## Regla de dependencia

- **Puede importar:** el shared kernel (`drizzle/schema.ts`) **sólo como tipos**,
  y utilidades puras relativas del propio contexto.
- **No puede importar:** `fastify`, el runtime de Drizzle, `env`, `http`,
  auth/CORS, ningún `db-*`, `infrastructure`, `routes`, Supabase, I/O de Node,
  otros `server/lib/**` ni `report-study-types`.
- La dependencia apunta hacia adentro: `domain` no conoce transporte HTTP ni
  motor de persistencia.

Verificado por
`test/architecture/public-professionals-domain-boundary-guard.test.ts`, que
además exige cero imports en el módulo canónico, consumo por barrel y que el path
legacy quede como shim sólo-re-export.

## Shim legacy temporal

`server/lib/professional-bank-eligibility.ts` re-exporta este dominio por
compatibilidad temporal (M21 → expira en M24). Sin consumidores runtime tras M21.

## Qué NO hacer

No importar `db-*`, Drizzle runtime, `fastify`, `env`, I/O ni `report-study-types`.
No crear stubs, interfaces ni barrels vacíos. No copiar el catálogo de Reports
dentro del feature.
