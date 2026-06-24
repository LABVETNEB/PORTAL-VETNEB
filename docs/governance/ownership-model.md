# VETNEB Ownership Model

Modelo documental de ownership por dominio.

## Propósito

Este documento define ownership operativo y de revisión sin modificar `.github/CODEOWNERS`.

`.github/CODEOWNERS` sigue siendo la fuente efectiva de GitHub para reviewers automáticos. Este archivo complementa esa configuración con una lectura humana por dominio.

## Reglas

- Cada PR debe declarar el dominio afectado.
- Cada PR debe declarar scope incluido y excluido.
- Si un PR toca más de un dominio de riesgo, debe dividirse salvo autorización explícita.
- Si un cambio afecta seguridad, auth, DB, migraciones, CI, dependencias o configuración productiva, requiere revisión reforzada.
- La documentación no autoriza cambios fuera de scope.

## Dominios

| Dominio | Ownership documental | Fuente vigente | Revisión requerida |
| --- | --- | --- | --- |
| Protocolo operativo / agentes | Proyecto | `AGENTS.md` | Scope, seguridad, comandos permitidos |
| Auditorías vigentes | Proyecto | `docs/audit/README.md` | Vigencia, prioridad, no mezclar históricos |
| Source of truth documental | Proyecto | `docs/SOURCES_OF_TRUTH.md` | Dominio correcto y documento vigente |
| Documentación histórica | Proyecto | `docs/HISTORICAL_DOCUMENTATION.md` | No usar históricos como fuente primaria |
| Gobernanza | Proyecto | `docs/governance/*` | ADR/RFC/checklist antes de cambios grandes |
| Review governance | Proyecto | `docs/review-governance.md` | PR content, checks, rollback, branch protection |
| CI / E2E | Ingeniería | `docs/audit/e2e-ci-layering-strategy-audit.md` | No mezclar scripts-only con CI-only |
| Operaciones / rollback | Ingeniería | `docs/ops/*` | Rollback, data impact, runbooks |
| Seguridad / sesiones | Seguridad / backend | `docs/security/*` | Auth, session, CSP, RBAC, no sensitive leakage |
| Backend / API | Backend | Server routes, tests, API docs vigentes | Contratos, errores, seguridad, rollback |
| DB / migraciones / datos | Backend / data | DB docs y auditorías vigentes | Migración, compatibilidad, backup/restore |
| Frontend / dashboard | Frontend / UX | Dashboard SoT vigente | Responsive, mobile, no-scroll, UX operativa |
| Dependencias | Ingeniería | Dependabot + futura policy | No tocar junto a cambios funcionales |

## Ownership por tipo de PR

| Tipo de PR | Revisión mínima |
| --- | --- |
| docs-only | Vigencia documental, scope, no contradicción con SoT |
| frontend-only | UX/responsive, build, lint, typecheck, no scope backend |
| backend-only | Tests backend, seguridad, contratos, rollback |
| test-only | Cobertura, estabilidad, no cambio runtime |
| CI-only | Workflow, checks, duración, rollback |
| dependency-only | Lockfile, audit, compatibilidad, rollback |
| migration-only | Backward compatibility, backup, rollback, data impact |

## Escalamiento

Elevar revisión si aparece cualquiera de estos casos:

- Auth, sesiones, permisos, RBAC o tokens.
- Datos clínicos, tenant isolation, RLS o migraciones.
- CI, workflows, Dependabot, lockfiles o dependencias.
- Cambios visuales con impacto mobile/responsive.
- Cambios que mezclan dominios.
- Cambios basados en documentación histórica o superseded.
