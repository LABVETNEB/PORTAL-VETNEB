# VETNEB Audit Index

Índice vigente de auditorías documentales activas del proyecto VETNEB.

## Criterio de vigencia

Este índice considera como vigentes únicamente las auditorías generadas en Wave 0, incorporadas a `main` mediante el PR #1097, los snapshots enterprise aprobados y los documentos rectores enterprise incorporados posteriormente como auditorías docs-only explícitas.

Los documentos históricos previos dentro de `docs/audit/` se conservan como antecedentes, pero no forman parte del índice operativo vigente para la próxima implementación enterprise salvo que estén listados expresamente abajo.

> **PR-CLEAN2 (2026-06-28):** `docs/audits/` (plural, 10 archivos `AUDIT_*`/`DASHBOARD_*_PLAN`) se
> unificó dentro de esta carpeta. Siguen siendo históricos (no entran al índice vigente de abajo);
> ver clasificación archivo-por-archivo en `docs/HISTORICAL_DOCUMENTATION.md`.

## Documentos rectores enterprise recientes

| Documento | Propósito operativo | Estado |
| --- | --- | --- |
| [enterprise-repository-maturity-audit-roadmap.md](./enterprise-repository-maturity-audit-roadmap.md) | Auditoría y roadmap enterprise del repositorio: scorecard de 25 ejes, brechas P0/P1/P2/P3, roadmap por fases, matriz de validación, risk register y definición de cierre 100% enterprise. | Vigente |
| [enterprise-roadmap-consolidation-plan.md](./enterprise-roadmap-consolidation-plan.md) | Plan consolidado para reducir el roadmap enterprise a 18 PRs ejecutables, agrupando scopes compatibles sin romper seguridad, trazabilidad ni disciplina VETNEB. | Vigente |

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

## Próximo paso recomendado

Ejecutar la Fase 0 del roadmap enterprise: registrar divergencias en el Enterprise Control Register, alinear el runbook de CI con `qga-workflow-security`, actualizar `docs/SOURCES_OF_TRUTH.md` y mantener esta auditoría como documento rector vigente.
