# VETNEB Technical Debt Register

| Campo | Valor |
| --- | --- |
| Document owner | Engineering governance / Tech lead |
| Domain | Quality Engineering and Maintainability |
| Lifecycle status | ACTIVE |
| Authoritative source role | Registro operativo vivo de deuda técnica verificable |
| Effective date | 2026-07-28 |
| Last verified date | 2026-07-30 |
| Review cadence | Mensual y ante cada review trigger registrado |
| Supersedes | Ninguno |
| Superseded by | Ninguno |
| Related controls | `ERM-CTRL-008`; `ERM-CTRL-009`; `ERM-CTRL-011`; `ERM-CTRL-012`; `ERM-CTRL-025` |
| Relation with Enterprise Control Register | Este registro detalla deuda accionable; el [Enterprise Control Register](./enterprise-control-register.md) conserva autoridad sobre el estado y cierre de master capabilities |
| Evidence or approval reference | Censos de `PR-AUDIT-ENTERPRISE-DOCS`; baselines ejecutables de los slots 08 y 09 |

## Propósito y reglas

Este registro mantiene deuda técnica con evidencia, owner, trigger de revisión, acción propuesta y
criterio de cierre. No incluye decisiones deliberadas ya cerradas, riesgos aceptados sin acción,
trabajo resuelto por M01–M48 ni hallazgos sin evidencia.

**Documentar una deuda no implementa la corrección, no cierra el gap relacionado y no autoriza
cambiar un control a `IMPLEMENTED`.** El cierre requiere evidencia ejecutable u operativa y la
actualización explícita del control correspondiente.

Estados permitidos:

| Status | Regla |
| --- | --- |
| `OPEN` | Deuda verificada con acción y closure criteria pendientes. |
| `PLANNED` | Existe bloque aprobado y trazable para abordarla; todavía no hay cierre. |
| `MITIGATING` | La remediación está en curso y conserva riesgo residual. |
| `RESOLVED` | Closure criteria cumplidos con evidencia enlazada y control relacionado revisado. |

Severidades permitidas: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.

## Registro operativo

| Debt ID | Domain | Title | Description | Evidence | Impact | Severity | Status | Owner | Introduced / observed date | Review trigger | Proposed action | Closure criteria | Related control or gap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `TDR-001` | Frontend quality | React Hooks lint rules disabled | `react-hooks/immutability` y `react-hooks/set-state-in-effect` están configuradas en `off`; el lint vigente no detecta esas dos clases de findings. | [Frontend ESLint config](../../frontend/eslint.config.mjs); [enterprise roadmap §4.9](../audit/enterprise-repository-maturity-audit-roadmap.md#49-p2--resto) | Mutaciones o actualizaciones de estado dentro de effects pueden entrar sin señal estática específica y elevar el coste de refactor. | `MEDIUM` | `OPEN` | Frontend / QA owner | Observed 2026-07-28 | Cambio de React/ESLint, modificación de la config frontend o inicio de un baseline de lint estricto. | Medir findings por regla, clasificar falsos positivos y habilitar cada regla en un PR frontend/config dedicado sin autofix masivo. | Ambas reglas dejan de estar `off`; lint, typecheck y build frontend pasan; excepciones puntuales quedan justificadas y el control relacionado se revisa. | `ERM-CTRL-025`; `ERM-FE-001` |
| `TDR-002` | Test architecture | Structural source coupling in tests | 367 de 514 tests leen archivos mediante `readFileSync` o `readFile`; existen 134 usos de `readdirSync` en 64 tests. Parte son guards legítimos de arquitectura y parte puede ser acoplamiento accidental a paths o estructura física. Este registro no ordena una migración masiva. | Censo reproducido el 2026-07-28 sobre `test/**/*.test.ts`; [enterprise roadmap §4.9](../audit/enterprise-repository-maturity-audit-roadmap.md#49-p2--resto); [tracked source helper](../../test/helpers/tracked-source-files.ts) | Refactors válidos pueden romper contratos por movimientos o nombres sin cambiar comportamiento; mezclar guards legítimos con acceso ad hoc dificulta priorizar. | `HIGH` | `OPEN` | QA / Backend owner | Observed 2026-07-28 | Fallo por move/refactor, cambio del helper canónico, variación material del censo o revisión trimestral. | Inventariar por test y clasificar `legitimate-guard` versus `accidental-coupling`; migrar solo los casos priorizados a helpers/fixtures canónicos en PRs test-only. | Inventario versionado con clasificación y owner; usos accidentales priorizados migrados sin debilitar guards; suite dirigida y `pnpm test` pasan; censos actualizados. | `ERM-CTRL-012`; `ERM-QLT-001` |
| `TDR-003` | Backend quality | Backend lint baseline established | El root define un baseline ESLint reproducible para 253 archivos versionados de `server/**`, `scripts/**` y `drizzle/**`: 0 errors y 52 warnings. No existe autofix ni enforcement CI. | [Root package manifest](../../package.json); [root ESLint config](../../eslint.config.mjs); [slot 09 audit](../audit/pr-quality-backend-lint-baseline-audit.md) | La ausencia de medición quedó resuelta; los 52 warnings y la evolución hacia enforcement siguen siendo riesgo residual separado. | `MEDIUM` | `RESOLVED` | Backend / Tech lead | Observed 2026-07-28; resolved locally 2026-07-30 | Cambio de tooling backend, drift material del baseline o propuesta separada de enforcement. | Mantener el comando diagnóstico reproducible; priorizar findings por riesgo en PRs separados sin autofix masivo. | Cumplido: script y config raíz existentes; baseline publicado; cero autofix/reformateo; contrato, typecheck, tests y build verdes; `ERM-BE-001` cerrado operacionalmente y `ERM-CTRL-025` revisado. | `ERM-CTRL-025`; `ERM-BE-001` (closed operationally 2026-07-30) |
| `TDR-004` | Quality measurement | Coverage baseline established | El slot 08 agregó `test:coverage` separado e intacto respecto de `test`, con baseline nativo de Node sobre 4.023 tests y sin threshold ni enforcement. | [Root package manifest](../../package.json); [slot 08 coverage audit](../audit/pr-quality-coverage-baseline-audit.md) | La ausencia de medición quedó resuelta; thresholds, drift histórico y mutation strength permanecen fuera de este cierre. | `HIGH` | `RESOLVED` | QA / Tech lead | Observed 2026-07-28; resolved 2026-07-30 | Cambio del runner, drift material o propuesta separada de threshold. | Preservar el comando diagnóstico y revisar la evolución sin convertir este registro en política de threshold. | Cumplido: `test:coverage` genera reporte reproducible; `pnpm test` permanece literal; baseline y owner están documentados; `ERM-TST-001` cerrado operacionalmente y control revisado. | `ERM-CTRL-011`; `ERM-CTRL-025`; `ERM-TST-001` (closed operationally 2026-07-30) |
| `TDR-005` | Ownership / operations | Bus factor 1 | Una sola cuenta mantiene, administra y decide merges. Esta fila referencia el modelo de ownership y no duplica su autoridad ni sus triggers. | [Ownership Model](./ownership-model.md); [CODEOWNERS](../../.github/CODEOWNERS); branch protection verificada read-only el 2026-07-28 | Ausencia o compromiso del único maintainer puede detener delivery, operación y decisiones; no existe segregación humana de funciones. | `HIGH` | `OPEN` | Repository owner / Engineering governance | Observed 2026-07-28 | Cualquiera de los triggers objetivos definidos en el Ownership Model o la revisión trimestral. | Ejecutar la reevaluación gobernada del ownership; incorporar capacidad independiente real cuando el contexto lo permita y verificar routing/enforcement sin identidades simuladas. | Se cumple la closure evidence definida en el Ownership Model; `ERM-CTRL-008`, `ERM-CTRL-009` y `ERM-OWN-001` se actualizan con evidencia y fecha. | `ERM-CTRL-008`; `ERM-CTRL-009`; `ERM-OWN-001` |

## Mantenimiento

- Cada entrada conserva su `Debt ID`.
- Todo cambio de `Status`, severity u owner debe enlazar evidencia y actualizar la fecha.
- Una entrada `RESOLVED` se conserva para trazabilidad; no se elimina para simular limpieza.
- Los snapshots enterprise y los closeouts históricos no se reescriben.
- La priorización de implementación sigue el Plan B vigente y la autorización R0–R3 de
  `AGENTS.md`; este registro no amplía scope.
