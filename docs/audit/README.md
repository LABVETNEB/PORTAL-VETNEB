# VETNEB Audit Index

Índice vigente de auditorías documentales activas del proyecto VETNEB.

## Criterio de vigencia

Este índice considera como vigentes únicamente las auditorías generadas en Wave 0, incorporadas a `main` mediante el PR #1097.

Los documentos históricos previos dentro de `docs/audit/` se conservan como antecedentes, pero no forman parte del índice operativo vigente para la próxima implementación enterprise.

> **PR-CLEAN2 (2026-06-28):** `docs/audits/` (plural, 10 archivos `AUDIT_*`/`DASHBOARD_*_PLAN`) se
> unificó dentro de esta carpeta. Siguen siendo históricos (no entran al índice vigente de abajo);
> ver clasificación archivo-por-archivo en `docs/HISTORICAL_DOCUMENTATION.md`.

## Auditorías vigentes

## Documentos rectores recientes

| Documento | Propósito operativo | Estado |
| --- | --- | --- |
| [total-visual-engineering-audit.md](./total-visual-engineering-audit.md) | Rector visual/frontend: tokens, CSS, primitivas UI, dashboards, no-scroll y PR-VIS-*. Mantiene conteo visual 26. | Vigente |
| [total-software-engineering-audit.md](./total-software-engineering-audit.md) | Rector de ingeniería dura: backend, DB, seguridad, CI, testing, observabilidad y PRs ENG/SEC/OBS/LINT/COV. Mantiene conteo ENG 26. | Vigente |
| [total-engineering-roadmap.md](./total-engineering-roadmap.md) | Orquestador de secuencia, dependencias, fases, gates y trazabilidad VIS + ENG. | Vigente |
| [design-system-contract.md](./design-system-contract.md) | Contrato operativo docs-only de gobernanza del design system para PR-VIS-0 / Fase 0 / VIS-P1-001. No es auditoría nueva. | Vigente |

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

Crear un backlog maestro de implementación derivado exclusivamente de estas 4 auditorías vigentes, priorizado por riesgo, impacto operativo y dependencia técnica.
