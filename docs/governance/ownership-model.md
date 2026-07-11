# VETNEB Ownership Model

| Campo | Valor |
| --- | --- |
| Document owner | Tech lead / Domain owners |
| Domain | Code and Operational Ownership |
| Lifecycle status | ACTIVE |
| Authoritative source role | Human-readable operational ownership model complementing effective GitHub CODEOWNERS |
| Effective date | 2026-07-11 |
| Last verified date | 2026-07-11 |
| Review cadence | Trimestral y ante cambios de ownership o enforcement |
| Supersedes | None |
| Superseded by | None |
| Related controls or gaps | ERM-OWN-001; ERM-CTRL-008; ERM-CTRL-009 |
| Evidence or approval reference | PR #1440; canary PRs #1441 through #1444 |

## Propósito

Este documento define el ownership operativo y de revisión por dominio.

[.github/CODEOWNERS](../../.github/CODEOWNERS) es la fuente efectiva de GitHub para la asignación automática de reviewers.

Este modelo complementa esa configuración con una lectura humana del dominio, el tipo de revisión esperada y las reglas de escalamiento.

El estado operativo de los controles enterprise se mantiene en el [Enterprise Control Register](./enterprise-control-register.md).

## Fuentes efectivas

- `.github/CODEOWNERS`: asignación automática efectiva por path;
- protección de `main`: revisión CODEOWNERS y check requerido;
- este documento: interpretación humana de ownership y revisión;
- enterprise control register: estado operativo, evidencia y cadence.

## Estado de enforcement verificado

Verificado el 2026-07-11:

- `require_code_owner_reviews`: activo;
- approving reviews requeridas: 1;
- stale reviews: dismissed;
- required check: `validate-pr-governance`;
- strict status checks: activos;
- enforcement para administradores: activo;
- linear history y conversation resolution: requeridos;
- force pushes y branch deletion: desactivados.

Los canarios #1441, #1442, #1443 y #1444 demostraron que GitHub solicita automáticamente a `VETNEB` para cambios representativos en `.github/**`, `docs/**`, `server/**` y `frontend/**`.

## Reglas

- Cada PR debe declarar el dominio afectado.
- Cada PR debe declarar scope incluido y excluido.
- Si un PR toca más de un dominio de riesgo, debe dividirse salvo autorización explícita.
- La aprobación propia no reemplaza una revisión válida del otro code owner.
- Un cambio en una ruta protegida debe conservar la asignación automática esperada.
- Si un cambio afecta seguridad, auth, DB, migraciones, CI, dependencias o configuración productiva, requiere revisión reforzada.
- La documentación no autoriza cambios fuera de scope.

## Dominios

| Dominio | Ownership operativo | Paths efectivos | Revisión requerida |
| --- | --- | --- | --- |
| Fallback del repositorio | Proyecto / Ingeniería | `*` | Scope, riesgo y compatibilidad general |
| Gobernanza y automatización | Proyecto / Ingeniería | `/.github/**` | Protección, workflows, CODEOWNERS y rollback |
| Documentación y governance | Proyecto / Docs owner | `/docs/**`, `/AGENTS.md` | Vigencia, lifecycle, SoT y trazabilidad |
| Backend / API | Backend | `/server/**` | Contratos, errores, seguridad y rollback |
| Frontend / interfaces | Frontend / UX | `/frontend/**` | UX, responsive, accesibilidad y no scope backend |
| DB / schema / migraciones | Backend / Data | `/drizzle/**` | Compatibilidad, backup, rollback y data impact |
| Test architecture | QA / Ingeniería | `/test/**` | Cobertura de riesgo, estabilidad y no cambio runtime |
| Scripts / tooling | Ingeniería | `/scripts/**` | Operación, seguridad, compatibilidad y rollback |
| Package y PNPM manifests | Ingeniería / Dependency owner | `/package.json`, `/pnpm-lock.yaml`, `/pnpm-workspace.yaml` | Dependencias, lockfile, audit y compatibilidad |

El orden de los handles dentro de CODEOWNERS no establece jerarquía.

`LABVETNEB` y `VETNEB` son owners válidos para cada regla actual. El modelo permite que una cuenta revise los PRs creados por la otra.

## Ownership por tipo de PR

| Tipo de PR | Revisión mínima |
| --- | --- |
| docs-only | Vigencia documental, lifecycle, scope y no contradicción con SoT |
| frontend-only | UX/responsive, build, lint, typecheck y ausencia de scope backend |
| backend-only | Tests backend, seguridad, contratos y rollback |
| test-only | Cobertura de riesgo, estabilidad y ausencia de cambio runtime |
| CI-only | Workflow, checks requeridos, permisos, duración y rollback |
| dependency-only | Lockfile, audit, compatibilidad y rollback |
| migration-only | Backward compatibility, backup, rollback y data impact |

## Escalamiento

Elevar revisión si aparece cualquiera de estos casos:

- auth, sesiones, permisos, RBAC o tokens;
- datos clínicos, tenant isolation, RLS o migraciones;
- CI, workflows, Dependabot, lockfiles o dependencias;
- cambios visuales con impacto mobile o responsive;
- cambios que mezclan dominios;
- cambios basados en documentación histórica o superseded;
- modificación de CODEOWNERS, collaborators o branch protection.

## Evidencia de implementación

La implementación y auditoría de cierre están registradas en:

- [Enterprise CODEOWNERS Enforcement — Implementation Closeout](../implementation/enterprise-codeowners-enforcement-closeout.md);
- [Enterprise CODEOWNERS Enforcement — Audit Closeout](../audit/enterprise-codeowners-enforcement-closeout-audit.md).

## Riesgo residual

El modelo actual es efectivo por path, pero no separa todavía dominios entre equipos especialistas distintos.

No existen GitHub teams asociados al repositorio y no se mantienen métricas automáticas de ownership. Estas mejoras requieren PRs independientes y no invalidan el enforcement vigente.
