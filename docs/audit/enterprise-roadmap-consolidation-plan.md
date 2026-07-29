# Enterprise Roadmap Consolidation Plan

> Plan docs-only para reducir el roadmap enterprise original de 39 PRs a un plan operativo recomendado de 18 PRs consolidados, preservando seguridad, trazabilidad, reversibilidad y disciplina de scope VETNEB.

## Metadata

| Campo | Valor |
| --- | --- |
| Tipo | docs-only |
| Document owner | Engineering governance |
| Rama de trabajo | `docs/enterprise-repository-maturity-audit-roadmap` |
| Documento base | `docs/audit/enterprise-repository-maturity-audit-roadmap.md` |
| Lifecycle status | ACTIVE |
| Authoritative source role | Secuencia operativa vigente del enterprise roadmap |
| Effective date | 2026-07-28 |
| Last verified date | 2026-07-28 |
| Review cadence | Mensual y ante cambios de dependencias o riesgo del roadmap |
| Propósito | Consolidar el roadmap enterprise en bloques ejecutables con menor cantidad de PRs |
| Alcance | PR planning, consolidation strategy, scope governance, dependencies, risk, validations and sequencing |
| No-scope | No modifica runtime, backend, frontend, DB, migraciones, dependencias, lockfiles, workflows ni configuración productiva |
| Related controls or gaps | `ERM-CTRL-001..025`; roadmap enterprise global |
| Evidence or approval reference | Plan B consolidado en `docs/enterprise-audit-block-01` |

---

# 0. Autoridad y precedencia

- [Enterprise Repository Maturity Audit and Roadmap](./enterprise-repository-maturity-audit-roadmap.md)
  preserva el diagnóstico, scorecard, prioridades y roadmap original.
- Este documento gobierna la secuencia ejecutable recomendada del Plan B de 18 PRs.
- [Enterprise Control Register](../governance/enterprise-control-register.md) gobierna el estado
  operativo vivo y puede registrar evidencia posterior sin reescribir este plan.
- El baseline y el gap register enterprise son snapshots históricos inmutables.

El Plan B no elimina PRs ni hallazgos del roadmap original: los absorbe en bloques trazables.

# 1. Diagnóstico directo

Sí se puede reducir la cantidad de PRs de forma real.

La reducción recomendada es:

| Plan | PRs | Reducción | Riesgo |
| --- | ---: | ---: | --- |
| Original | 39 | — | Máxima granularidad |
| Línea base efectiva | 38 | 1 PR ya ejecutado | Igual que original |
| Plan A conservador | 24 | -37% | Bajo / trazabilidad alta |
| Plan B recomendado | 18 | -53% | Balance óptimo |
| Plan C agresivo | 13 | -66% | Alto / requiere autorización explícita |

El plan recomendado es **Plan B — 18 PRs consolidados**.

No se recomienda bajar de 13 PRs sin degradar seguridad, trazabilidad, diagnóstico de CI o separación de scopes. El piso duro absoluto son 8 PRs que no admiten fusión.

---

# 2. Correcciones relevantes

## 2.1 Línea base real

La línea base práctica ya no es 39 PRs, sino 38, porque `PR-DOC-1` ya quedó documentado en la rama:

- `docs/audit/enterprise-repository-maturity-audit-roadmap.md`
- `docs/audit/README.md`
- `docs/SOURCES_OF_TRUTH.md`

## 2.2 Corrección de orden RLS

`PR-RLS-PILOT` no debe ejecutarse antes de backup/restore, rollback y observabilidad.

Debe moverse a la posición 15 porque el ADR de RLS exige como criterios previos:

- observabilidad,
- rollback,
- restore / disaster recovery,
- evidencia cross-tenant.

## 2.3 PRs huérfanos resueltos

El plan reducido debe incorporar estos PRs que quedaban fuera:

| PR original | Resolución |
| --- | --- |
| `PR-ARCH-1` | Absorbido por `PR-SEC-SECRET-PATTERNS` |
| `PR-REL-3` | Absorbido por `PR-BACKUP-RESTORE-ROLLBACK-DRILL` |
| `PR-QUALITY-2` | Se mantiene separado como `PR-QUALITY-BACKEND-LINT-BASELINE` |

---

# 3. Plan B recomendado — 18 PRs

| Orden | PR consolidado | Absorbe | Scope | Riesgo |
| ---: | --- | --- | --- | --- |
| 1 | `PR-AUDIT-ENTERPRISE-DOCS` | `PR-GOV-1`, `PR-CI-0`, resto de `PR-SOT-1`, `PR-OWNERS-1`, `PR-QUALITY-3` | docs-only | Bajo |
| 2 | `PR-SEC-REPO-SETTINGS` | `PR-SEC-0`, `PR-SEC-2` | config-only + docs evidencia | Bajo |
| 3 | `PR-SEC-SECRET-PATTERNS` | `PR-SEC-1`, `PR-ARCH-1` | ci-only | Medio-alto |
| 4 | `PR-CI-ALWAYS-RUN-GATES` | `PR-CI-2` | ci-only | Medio-alto |
| 5 | `PR-CI-REQUIRED-CHECKS` | `PR-CI-1`, `PR-CI-4` | config-only + docs evidencia | Alto |
| 6 | `PR-E2E-CI-COMPLETENESS` | `PR-CI-3` | ci-only | Medio |
| 7 | `PR-TEST-ARCHITECTURE-CONSOLIDATION` | `PR-TEST-ARCH-1`, `PR-TEST-ARCH-2`, `PR-TEST-ARCH-3` | test-only + docs soporte | Medio-alto |
| 8 | `PR-QUALITY-COVERAGE-BASELINE` | `PR-QUALITY-1` | config-only | Medio |
| 9 | `PR-QUALITY-BACKEND-LINT-BASELINE` | `PR-QUALITY-2` | config-only + dependencies | Medio-alto |
| 10 | `PR-SEC-TENANT-RLS-DESIGN` | `PR-RLS-1` | docs-only | Medio |
| 11 | `PR-SEC-CROSS-TENANT-EVIDENCE` | `PR-SEC-3` | ops-only | Medio |
| 12 | `PR-DATA-DR-OBS-GOVERNANCE` | `PR-DATA-1`, `PR-BACKUP-1`, `PR-OBS-1`, diseño de `PR-OBS-4` | docs-only | Bajo |
| 13 | `PR-BACKUP-RESTORE-ROLLBACK-DRILL` | `PR-BACKUP-2`, `PR-REL-3` | ops-only | Alto |
| 14 | `PR-OBS-BACKEND-STRUCTURED-LOGGING-METRICS` | `PR-OBS-2`, `PR-OBS-3` | backend-only | Medio-alto |
| 15 | `PR-RLS-PILOT` | `PR-RLS-2` | data-only | Muy alto |
| 16 | `PR-DEPS-SUPPLY-CHAIN-GOVERNANCE` | `PR-DEPS-1`, `PR-DEPS-2`, `PR-DEPS-3`, `PR-DEPS-4` | mixed-scope exception | Medio |
| 17 | `PR-REL-PRODUCTION-READINESS` | `PR-REL-1`, `PR-REL-2` | config-only + docs evidencia | Medio |
| 18 | `PR-ENTERPRISE-CLOSEOUT` | `PR-GOV-2`, `PR-GOV-3`, `PR-DOC-2`, evidencia de `PR-OBS-4` | docs-only | Bajo |

---

# 4. PRs que deben quedar separados sí o sí

Estos PRs no deben fusionarse con otros:

| PR | Motivo |
| --- | --- |
| `PR-RLS-PILOT` | Toca DB, migraciones y RLS. Riesgo R3. |
| `PR-CI-REQUIRED-CHECKS` | Cambia branch protection / required checks. |
| `PR-CI-ALWAYS-RUN-GATES` | Debe ejecutarse antes de activar required checks. |
| `PR-QUALITY-BACKEND-LINT-BASELINE` | Puede tocar dependencias y lockfile. |
| `PR-BACKUP-RESTORE-ROLLBACK-DRILL` | Evidencia operativa real. No reversible como operación. |
| `PR-SEC-CROSS-TENANT-EVIDENCE` | Requiere staging y evidencia cross-tenant. |
| `PR-OBS-BACKEND-STRUCTURED-LOGGING-METRICS` | Toca runtime backend. |
| `PR-SEC-SECRET-PATTERNS` | Toca el validador requerido. Un error puede bloquear PRs. |

---

# 5. PRs que requieren autorización explícita de Nico

| Nivel | PRs |
| --- | --- |
| R3 | `PR-CI-REQUIRED-CHECKS`, `PR-SEC-CROSS-TENANT-EVIDENCE`, `PR-BACKUP-RESTORE-ROLLBACK-DRILL`, `PR-RLS-PILOT`, `PR-REL-PRODUCTION-READINESS` |
| R2 | `PR-SEC-REPO-SETTINGS`, `PR-SEC-SECRET-PATTERNS`, `PR-CI-ALWAYS-RUN-GATES`, `PR-E2E-CI-COMPLETENESS`, `PR-QUALITY-COVERAGE-BASELINE`, `PR-QUALITY-BACKEND-LINT-BASELINE`, `PR-OBS-BACKEND-STRUCTURED-LOGGING-METRICS`, `PR-DEPS-SUPPLY-CHAIN-GOVERNANCE` |
| R1 | `PR-AUDIT-ENTERPRISE-DOCS`, `PR-TEST-ARCHITECTURE-CONSOLIDATION`, `PR-SEC-TENANT-RLS-DESIGN`, `PR-DATA-DR-OBS-GOVERNANCE`, `PR-ENTERPRISE-CLOSEOUT` |

---

# 6. PRs sin rama técnica pero con evidencia documental

Algunos cambios son settings puros de GitHub, pero deben quedar documentados con closeout:

| Mutación de settings | PR de evidencia |
| --- | --- |
| Secret scanning, push protection, validity checks, non-provider patterns | `PR-SEC-REPO-SETTINGS` |
| Required checks y Actions permissions | `PR-CI-REQUIRED-CHECKS` |
| Dependabot security updates | `PR-DEPS-SUPPLY-CHAIN-GOVERNANCE` |
| GitHub environments staging / production | `PR-REL-PRODUCTION-READINESS` |

---

# 7. Skills VETNEB aplicables

| Bloque | Skills principales |
| --- | --- |
| Documentación enterprise | `VeTNEB Briefing Planificación Diseño Desarrollo Pruebas`, `VeTNEB Staff Senior Full-Stack Engineer` |
| Seguridad y secretos | `VeTNEB Security Production Invariants`, `VeTNEB Lanzamiento Mantenimiento` |
| CI/CD y required checks | `VeTNEB Staff Senior Full-Stack Engineer`, `VETNEB Production Web Optimization Engineer` |
| E2E completeness | `VeTNEB Web End-to-End Global` |
| Test architecture | `VeTNEB Staff Senior Full-Stack Engineer`, `VeTNEB Briefing Planificación Diseño Desarrollo Pruebas` |
| Tenant isolation / RLS | `VeTNEB Security Production Invariants`, `VeTNEB Staff Senior Full-Stack Engineer` |
| Data / DR / observability governance | `VeTNEB Lanzamiento Mantenimiento`, `VETNEB Production Web Optimization Engineer` |
| Backend observability | `VeTNEB Staff Senior Full-Stack Engineer`, `VeTNEB Security Production Invariants`, `VETNEB Production Web Optimization Engineer` |
| Supply chain | `VeTNEB Security Production Invariants`, `VeTNEB Lanzamiento Mantenimiento` |
| Release / closeout | `VeTNEB Lanzamiento Mantenimiento`, `VeTNEB Briefing Planificación Diseño Desarrollo Pruebas` |

---

# 8. Recomendación final

Ejecutar **Plan B — 18 PRs consolidados**.

Razones:

1. Reduce aproximadamente 53% la cantidad de PRs.
2. Mantiene aislados los PRs de mayor riesgo.
3. Respeta el ADR de RLS.
4. Conserva trazabilidad.
5. Evita PRs gigantes.
6. Evita abrir 39 PRs innecesarios.
7. Mantiene la disciplina de scope de VETNEB.

No se recomienda Plan C salvo autorización explícita de Nico y aceptación de mayor riesgo operativo.
