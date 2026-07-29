# VETNEB Audit Index

Índice vigente de auditorías documentales activas del proyecto VETNEB.

| Campo | Valor |
| --- | --- |
| Document owner | Governance / Docs owner |
| Domain | Enterprise audit indexing |
| Lifecycle status | ACTIVE |
| Authoritative source role | Índice operativo de auditorías activas |
| Effective date | 2026-07-28 |
| Last verified date | 2026-07-29 |
| Review cadence | Mensual y ante nuevas auditorías rectoras |
| Supersedes | Ninguno |
| Superseded by | Ninguno |
| Related controls or gaps | `ERM-CTRL-004`; `ERM-CTRL-005` |
| Evidence or approval reference | Árbol documental verificado para `PR-AUDIT-ENTERPRISE-DOCS`; PR #1591 y closeout sanitizado de `PR-SEC-REPO-SETTINGS`; PR #1593 y closeout del bloque 03; PR #1601 y canarias #1602/#1603 del bloque 04 verificados el 2026-07-29 |

## Criterio de vigencia

Este índice considera como vigentes únicamente las auditorías generadas en Wave 0, incorporadas a `main` mediante el PR #1097, los snapshots enterprise aprobados y los documentos rectores enterprise incorporados posteriormente como auditorías docs-only explícitas.

Los documentos históricos previos dentro de `docs/audit/` se conservan como antecedentes, pero no forman parte del índice operativo vigente para la próxima implementación enterprise salvo que estén listados expresamente abajo.

> **PR-CLEAN2 (2026-06-28):** `docs/audits/` (plural, 10 archivos `AUDIT_*`/`DASHBOARD_*_PLAN`) se
> unificó dentro de esta carpeta. Siguen siendo históricos (no entran al índice vigente de abajo);
> ver clasificación archivo-por-archivo en `docs/HISTORICAL_DOCUMENTATION.md`.

## Documentos rectores enterprise recientes

| Documento | Propósito operativo | Estado |
| --- | --- | --- |
| [enterprise-repository-maturity-audit-roadmap.md](./enterprise-repository-maturity-audit-roadmap.md) | Auditoría global y roadmap original: scorecard de 25 ejes, diagnóstico, brechas P0/P1/P2/P3, matriz de validación y trazabilidad. | Vigente rector de diagnóstico |
| [enterprise-roadmap-consolidation-plan.md](./enterprise-roadmap-consolidation-plan.md) | Secuencia operativa vigente Plan B de 18 PRs; agrupa scopes compatibles sin reescribir el diagnóstico del roadmap global. | Vigente rector operativo |

### Precedencia enterprise

1. El roadmap global preserva auditoría, scorecard, prioridades y trazabilidad del plan original.
2. El plan consolidado gobierna la ejecución por bloques del Plan B.
3. El [Enterprise Control Register](../governance/enterprise-control-register.md) gobierna el
   estado operativo vivo de cada capability.
4. El baseline y el gap register permanecen snapshots históricos inmutables.

## Auditorías de bloque vigentes

| Documento | Propósito operativo | Estado |
| --- | --- | --- |
| [pr-sec-repo-settings-audit.md](./pr-sec-repo-settings-audit.md) | Baseline histórica, estado efectivo sanitizado, elegibilidad por feature y closeout del bloque 2 del Plan B. | `ACTIVE`; `PR-SEC-REPO-SETTINGS CLOSED` |
| [pr-sec-secret-patterns-audit.md](./pr-sec-secret-patterns-audit.md) | Implementación técnica #1593, matriz completa de canarias #1594–#1599 y closeout de secret patterns más Architecture Decision. | `ACTIVE`; `PR-SEC-SECRET-PATTERNS CLOSED` |
| [pr-ci-always-run-gates-audit.md](./pr-ci-always-run-gates-audit.md) | Implementación técnica #1601, matrices de canarias #1602/#1603 y closeout de contextos CI always-run. | `ACTIVE`; `PR-CI-ALWAYS-RUN-GATES CLOSED` |

## Documentos rectores recientes

| Documento | Propósito operativo | Estado |
| --- | --- | --- |
| [total-visual-engineering-audit.md](./total-visual-engineering-audit.md) | Rector visual/frontend: tokens, CSS, primitivas UI, dashboards, no-scroll y PR-VIS-*. Mantiene conteo visual 26. | Vigente |
| [total-software-engineering-audit.md](./total-software-engineering-audit.md) | Rector de ingeniería dura: backend, DB, seguridad, CI, testing, observabilidad y PRs ENG/SEC/OBS/LINT/COV. Mantiene conteo ENG 26. | Vigente |
| [total-engineering-roadmap.md](./total-engineering-roadmap.md) | Orquestador de secuencia, dependencias, fases, gates y trazabilidad VIS + ENG. | Vigente |
| [design-system-contract.md](./design-system-contract.md) | Contrato operativo docs-only de gobernanza del design system para PR-VIS-0 / Fase 0 / VIS-P1-001. No es auditoría nueva. | Vigente |

## Snapshots enterprise aprobados

| Documento | Propósito operativo | Estado |
| --- | --- | --- |
| [enterprise-repository-maturity-baseline.md](./enterprise-repository-maturity-baseline.md) | Baseline de madurez enterprise aprobado mediante PR #1436. Es snapshot histórico verificable de la auditoría del 2026-07-10. | Evidencia histórica vigente |
| [enterprise-repository-gap-register.md](./enterprise-repository-gap-register.md) | Snapshot priorizado de brechas derivado del baseline, aprobado mediante PR #1436. No debe reescribirse para simular cierres posteriores. | Evidencia histórica vigente |

El estado operativo vivo de estos controles se mantiene en
[enterprise-control-register.md](../governance/enterprise-control-register.md). Estos snapshots
no declaran obsoletas las auditorías Wave 0 vigentes ni reemplazan las fuentes rectoras por dominio.

## Auditorías Wave 0 vigentes

| Orden | Documento | Propósito operativo | Estado |
| --- | --- | --- | --- |
| 1 | [repository-operational-ordering-audit.md](./repository-operational-ordering-audit.md) | Ordenamiento operacional del repositorio, flujo de trabajo, PRs, ramas, validación y disciplina de ejecución. | Vigente |
| 2 | [vetneb-enterprise-engineering-readiness-audit.md](./vetneb-enterprise-engineering-readiness-audit.md) | Auditoría de preparación enterprise de ingeniería, calidad, testing, mantenibilidad y trazabilidad. | Vigente |
| 3 | [vetneb-extreme-multinational-enterprise-readiness-audit.md](./vetneb-extreme-multinational-enterprise-readiness-audit.md) | Evaluación extrema de preparación multinacional, resiliencia, seguridad, operación y escalabilidad. | Vigente |
| 4 | [vetneb-supreme-system-level-alignment-plan.md](./vetneb-supreme-system-level-alignment-plan.md) | Plan de alineación sistémica superior para convertir las auditorías en ejecución ordenada por prioridad. | Vigente |

## Regla de mantenimiento

Toda nueva auditoría que pretenda incorporarse al índice vigente debe cumplir estas condiciones:

- Ser aprobada mediante PR docs-only independiente.
- Tener alcance único, verificable y trazable.
- No mezclar documentación con cambios en frontend, backend, API, auth, DB, migraciones, dependencias, lockfiles, CI, scripts de package ni configuración Playwright.
- Definir claramente si reemplaza, complementa o deja obsoleta una auditoría previa.
- Mantener este README como punto de entrada documental actual.

## Estado de secuencia

```text
BLOQUE 03: CLOSED
BLOQUE 04: CLOSED
BLOQUE 05: NOT_RUN
```

`PR-SEC-SECRET-PATTERNS`, bloque 03 del
[plan consolidado](./enterprise-roadmap-consolidation-plan.md), está `CLOSED`.
PR #1593 fue integrado; #1594–#1599 quedaron cerradas sin merge y sin ramas
residuales. `PR-CI-ALWAYS-RUN-GATES`, bloque 04, está `CLOSED`: PR #1601 fue
integrado; #1602 y #1603 quedaron cerradas sin merge y con ramas residuales 0.
`PR-CI-REQUIRED-CHECKS`, bloque 05, permanece `NOT_RUN` y requiere autorización
R3 separada. Los closeouts M01–M48 y los snapshots enterprise no se usan como
backlog pendiente.
