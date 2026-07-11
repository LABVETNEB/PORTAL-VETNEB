# VETNEB Ownership Model

| Campo | Valor |
| --- | --- |
| Document owner | Repository owner / Engineering governance |
| Domain | Code and Operational Ownership |
| Lifecycle status | ACTIVE |
| Authoritative source role | Human-readable ownership and review model complementing GitHub configuration |
| Effective date | 2026-07-11 |
| Last verified date | 2026-07-11 |
| Review cadence | Trimestral y ante cambios de maintainers, CODEOWNERS o branch protection |
| Supersedes | Previous two-account ownership operating model |
| Superseded by | None |
| Related controls or gaps | ERM-OWN-001; ERM-CTRL-008; ERM-CTRL-009 |
| Evidence or approval reference | Administrative single-maintainer transition on 2026-07-11; branch `chore/single-maintainer-governance`; PR #1445 closed without merge |

## Propósito

Este documento define el ownership operativo, la responsabilidad por dominio y el modelo de revisión vigente para VETNEB.

[`.github/CODEOWNERS`](../../.github/CODEOWNERS) es la fuente efectiva de GitHub para el mapeo automático de ownership por path. Este documento explica cómo interpretar ese mapa dentro de un repositorio mantenido por una sola cuenta.

El estado operativo de los controles enterprise continúa en el [Enterprise Control Register](./enterprise-control-register.md). Los snapshots históricos no se reescriben.

## Modelo vigente

VETNEB opera actualmente como repositorio **single-maintainer**:

- `LABVETNEB` es la única cuenta administradora y maintainer efectiva;
- `VETNEB` fue retirada como collaborator el 2026-07-11;
- CODEOWNERS asigna todos los paths protegidos a `@LABVETNEB`;
- CODEOWNERS expresa accountability, no segregación de funciones;
- GitHub no exige aprobación humana ni aprobación CODEOWNER;
- la seguridad de merge depende de pull requests protegidas y checks automáticos requeridos;
- no se simula independencia usando dos cuentas controladas por la misma persona.

## Enforcement de `main`

Configuración administrativamente verificada el 2026-07-11:

- pull request flow protegido;
- required status check `validate-pr-governance`;
- strict status checks activados;
- administrator enforcement activado;
- `required_approving_review_count`: `0`;
- `require_code_owner_reviews`: `false`;
- `require_last_push_approval`: `false`;
- `dismiss_stale_reviews`: `false` porque no existen approvals requeridas;
- linear history requerida;
- conversation resolution requerida;
- force pushes desactivados;
- branch deletion desactivada.

La ausencia de aprobación humana requerida es deliberada y coherente con el modelo single-maintainer. No equivale a ausencia de control: el merge continúa condicionado por la PR, el check positivo requerido y las demás protecciones de `main`.

## Fuentes efectivas

- `.github/CODEOWNERS`: accountability por path;
- protección externa de `main`: enforcement de PR y checks;
- `.github/workflows/pr-governance.yml`: validación positiva requerida de metadata, scope, Markdown, secretos y diff integrity;
- este documento: interpretación humana y reglas operativas;
- enterprise control register: estado de madurez, gaps y criterios de cierre.

## Reglas operativas

- Cada PR debe declarar el dominio afectado.
- Cada PR debe declarar scope incluido y excluido.
- Los cambios deben usar una rama separada de `main`.
- Los checks requeridos deben finalizar satisfactoriamente antes del merge.
- Una cuenta no debe crear una segunda identidad personal para simular revisión independiente.
- La revisión humana externa puede solicitarse voluntariamente para cambios críticos, pero no es un gate requerido mientras exista un solo maintainer real.
- Si se incorpora un maintainer independiente, se debe reauditar CODEOWNERS, approvals requeridas y reglas de bypass antes de declarar segregación de funciones.
- Si un PR toca más de un dominio de riesgo, debe dividirse salvo justificación explícita.
- Auth, permisos, datos clínicos, DB, migraciones, CI, dependencias y configuración productiva requieren validación reforzada aunque no exista approval humana obligatoria.
- La documentación no autoriza cambios fuera de scope.

## Dominios y accountability

| Dominio | Accountable owner actual | Paths efectivos | Validación mínima |
| --- | --- | --- | --- |
| Fallback del repositorio | `@LABVETNEB` | `*` | Scope, riesgo, checks y rollback |
| Gobernanza y automatización | `@LABVETNEB` | `/.github/**` | Workflows, permisos, branch protection y rollback |
| Documentación y governance | `@LABVETNEB` | `/docs/**`, `/AGENTS.md` | Vigencia, lifecycle, SoT, links y trazabilidad |
| Backend / API | `@LABVETNEB` | `/server/**` | Contratos, seguridad, tests y rollback |
| Frontend / interfaces | `@LABVETNEB` | `/frontend/**` | UX, responsive, accesibilidad, lint, typecheck y build |
| DB / schema / migraciones | `@LABVETNEB` | `/drizzle/**` | Compatibilidad, backup, data impact y rollback |
| Test architecture | `@LABVETNEB` | `/test/**` | Cobertura de riesgo, estabilidad y ausencia de cambio runtime accidental |
| Scripts / tooling | `@LABVETNEB` | `/scripts/**` | Operación, seguridad, compatibilidad y rollback |
| Package y PNPM manifests | `@LABVETNEB` | `/package.json`, `/pnpm-lock.yaml`, `/pnpm-workspace.yaml` | Dependencias, lockfile, audit y compatibilidad |

Los nombres de dominio describen responsabilidades técnicas. No implican que existan equipos separados cuando la cuenta accountable es única.

## Ownership por tipo de PR

| Tipo de PR | Validación mínima |
| --- | --- |
| docs-only | Vigencia documental, lifecycle, links, scope y no contradicción con SoT |
| frontend-only | UX/responsive, lint, typecheck, build y ausencia de scope backend |
| backend-only | Typecheck, tests, build, seguridad, contratos y rollback |
| test-only | Cobertura del riesgo, estabilidad y ausencia de cambio runtime |
| CI-only | Workflow, permisos, checks requeridos, duración y rollback |
| dependency-only | Lockfile, audit, compatibilidad y rollback |
| migration-only | Backward compatibility, backup, rollback y data impact |

## Escalamiento

Requerir revisión humana externa o una auditoría específica cuando aparezca cualquiera de estos casos:

- auth, sesiones, permisos, RBAC o tokens;
- datos clínicos, tenant isolation, RLS o migraciones;
- cambios destructivos o irreversibles;
- CI, workflows, Dependabot, lockfiles o dependencias críticas;
- cambios visuales con impacto multi-dispositivo significativo;
- cambios que mezclan dominios de alto riesgo;
- modificación de CODEOWNERS, collaborators, branch protection o checks requeridos;
- incorporación de un segundo maintainer real.

La revisión externa puede provenir de un profesional, consultor o futuro collaborator independiente. Debe ser una revisión real, no una autoaprobación mediante otra cuenta controlada por el mismo maintainer.

## Estado de controles relacionados

El modelo single-maintainer es operativo y explícito, pero no satisface segregación de funciones ni ownership independiente por dominio.

Por lo tanto:

- `ERM-OWN-001` permanece abierto en el gap register histórico;
- `ERM-CTRL-008` permanece `PARTIAL`;
- `ERM-CTRL-009` permanece `PARTIAL`;
- el path mapping de CODEOWNERS existe, pero todos los paths tienen el mismo accountable owner;
- una futura transición a `IMPLEMENTED` requiere owners o reviewers independientes reales, o una redefinición formal y aprobada de los criterios del control.

## Evidencia

- [Single-Maintainer Governance — Implementation Record](../implementation/single-maintainer-governance.md)
- [Single-Maintainer Governance — Audit Record](../audit/single-maintainer-governance-audit.md)
- [Enterprise CODEOWNERS Domain Model — Implementation Record](../implementation/enterprise-codeowners-domain-model.md), evidencia histórica del modelo anterior
- [Enterprise CODEOWNERS Domain Model — Audit Record](../audit/enterprise-codeowners-domain-model-audit.md), evidencia histórica del modelo anterior

## Riesgo residual

- no existe segregación de funciones humana;
- no existen equipos especialistas de GitHub;
- una cuenta administradora concentra autoría, operación y decisión de merge;
- los checks automáticos no sustituyen revisión humana experta en cambios de alto riesgo;
- un compromiso de la cuenta única tiene mayor blast radius.

Mitigaciones vigentes:

- MFA y seguridad de cuenta deben mantenerse activas;
- PR protegida obligatoria;
- check positivo requerido;
- administrator enforcement;
- linear history y conversation resolution;
- force pushes y branch deletion desactivados;
- scope y rollback obligatorios;
- revisión externa voluntaria o específica para cambios críticos.
