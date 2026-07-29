# VETNEB Technical Debt Register

| Campo | Valor |
| --- | --- |
| Document owner | Engineering governance / Tech lead |
| Domain | Quality Engineering and Maintainability |
| Lifecycle status | ACTIVE |
| Authoritative source role | Registro operativo vivo de deuda técnica verificable |
| Effective date | 2026-07-28 |
| Last verified date | 2026-07-28 |
| Review cadence | Mensual y ante cada review trigger registrado |
| Supersedes | Ninguno |
| Superseded by | Ninguno |
| Related controls | `ERM-CTRL-008`; `ERM-CTRL-009`; `ERM-CTRL-011`; `ERM-CTRL-012`; `ERM-CTRL-025` |
| Relation with Enterprise Control Register | Este registro detalla deuda accionable; el [Enterprise Control Register](./enterprise-control-register.md) conserva autoridad sobre el estado y cierre de master capabilities |
| Evidence or approval reference | Censos y configuración observados para `PR-AUDIT-ENTERPRISE-DOCS` |

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
| `TDR-003` | Backend quality | Backend lint baseline absent | El paquete raíz no define un script de lint para `server/**`, `scripts/**` o `drizzle/**`; la calidad está cubierta parcialmente por typecheck, tests y build. | [Root package manifest](../../package.json); [enterprise roadmap §4.9](../audit/enterprise-repository-maturity-audit-roadmap.md#49-p2--resto) | Defectos de estilo con impacto semántico, patrones peligrosos y deriva de mantenibilidad carecen de un baseline estático uniforme. | `MEDIUM` | `OPEN` | Backend / Tech lead | Observed 2026-07-28 | Inicio de `PR-QUALITY-BACKEND-LINT-BASELINE`, cambio de tooling backend o incidente atribuible a un patrón detectable por lint. | Definir alcance y reglas, medir findings sin `--fix`, documentar baseline y añadir el gate en un PR config/dependency autorizado. | Script backend lint existente y reproducible; baseline aprobado; cero reformateo masivo; typecheck, tests y build permanecen verdes; control actualizado. | `ERM-CTRL-025`; `ERM-BE-001` |
| `TDR-004` | Quality measurement | Coverage baseline absent | Los 514 tests no publican una medición de cobertura y el paquete raíz no define `test:coverage`; no existe baseline desde el cual fijar una política informada. | [Root package manifest](../../package.json); [enterprise roadmap §4.3](../audit/enterprise-repository-maturity-audit-roadmap.md#43-p1--tests-2) | No se puede cuantificar qué código queda sin ejercitar ni detectar degradación de cobertura entre cambios. | `HIGH` | `OPEN` | QA / Tech lead | Observed 2026-07-28 | Inicio de `PR-QUALITY-COVERAGE-BASELINE`, cambio del runner de tests o propuesta de threshold. | Añadir medición separada de `pnpm test`, publicar un baseline sin threshold inicial y definir una evolución incremental basada en riesgo. | `test:coverage` genera reporte reproducible; `pnpm test` no cambia; baseline y owner están documentados; cualquier threshold posterior tiene evidencia y el control se revisa. | `ERM-CTRL-011`; `ERM-CTRL-025`; `ERM-TST-001` |
| `TDR-005` | Ownership / operations | Bus factor 1 | Una sola cuenta mantiene, administra y decide merges. Esta fila referencia el modelo de ownership y no duplica su autoridad ni sus triggers. | [Ownership Model](./ownership-model.md); [CODEOWNERS](../../.github/CODEOWNERS); branch protection verificada read-only el 2026-07-28 | Ausencia o compromiso del único maintainer puede detener delivery, operación y decisiones; no existe segregación humana de funciones. | `HIGH` | `OPEN` | Repository owner / Engineering governance | Observed 2026-07-28 | Cualquiera de los triggers objetivos definidos en el Ownership Model o la revisión trimestral. | Ejecutar la reevaluación gobernada del ownership; incorporar capacidad independiente real cuando el contexto lo permita y verificar routing/enforcement sin identidades simuladas. | Se cumple la closure evidence definida en el Ownership Model; `ERM-CTRL-008`, `ERM-CTRL-009` y `ERM-OWN-001` se actualizan con evidencia y fecha. | `ERM-CTRL-008`; `ERM-CTRL-009`; `ERM-OWN-001` |

## Mantenimiento

- Cada entrada conserva su `Debt ID`.
- Todo cambio de `Status`, severity u owner debe enlazar evidencia y actualizar la fecha.
- Una entrada `RESOLVED` se conserva para trazabilidad; no se elimina para simular limpieza.
- Los snapshots enterprise y los closeouts históricos no se reescriben.
- La priorización de implementación sigue el Plan B vigente y la autorización R0–R3 de
  `AGENTS.md`; este registro no amplía scope.
