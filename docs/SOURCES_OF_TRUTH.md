# VETNEB Sources of Truth

Mapa vigente de fuentes de verdad documentales del proyecto VETNEB.

## Propósito

Este documento define qué archivo debe leerse primero para cada dominio del proyecto, evita re-auditorías innecesarias y separa documentación vigente de documentación histórica.

Regla principal:

- Leer primero este archivo.
- Luego leer `docs/audit/README.md`.
- Luego leer únicamente la fuente vigente del dominio afectado.
- No usar documentos históricos como base de implementación salvo trazabilidad puntual.

## Fuentes vigentes principales

| Dominio | Fuente de verdad vigente | Complementos permitidos | Estado | Regla |
| --- | --- | --- | --- | --- |
| Índice de auditorías activas | `docs/audit/README.md` | Las 4 auditorías Wave 0 enlazadas desde ese índice | Vigente | Punto de entrada documental de auditorías activas |
| Orden operacional del repositorio | `docs/audit/repository-operational-ordering-audit.md` | Este archivo | Vigente | Define orden de PRs docs-only y separación de scopes |
| Readiness enterprise de ingeniería | `docs/audit/vetneb-enterprise-engineering-readiness-audit.md` | `docs/audit/vetneb-supreme-system-level-alignment-plan.md` | Vigente | Usar para gaps enterprise, testing, observabilidad, performance y arquitectura |
| Readiness multinacional extrema | `docs/audit/vetneb-extreme-multinational-enterprise-readiness-audit.md` | `docs/audit/vetneb-supreme-system-level-alignment-plan.md` | Vigente | Usar para P0/P1 de gobernanza, seguridad, SRE, datos y confianza ejecutiva |
| Alineación sistémica superior | `docs/audit/vetneb-supreme-system-level-alignment-plan.md` | Las otras 3 auditorías Wave 0 | Vigente | Usar para reconciliar prioridades, dependencias, waves y PR families |
| Protocolo operativo de agentes | `AGENTS.md` | `docs/protocol/vetneb-ai-working-protocol.md`, `.cursor/rules/*` | Vigente | `AGENTS.md` manda; reglas derivadas no deben contradecirlo |
| CI / E2E layering | `docs/audit/e2e-ci-layering-strategy-audit.md` | `frontend/package.json`, `docs/ops/CI_PR_CHECKS_RUNBOOK.md` | Vigente parcial | PR-C1 y PR-C2 cerrados; antes de PR-C3 validar unión de capas == full |
| Dashboard Admin horizontal-nav | `docs/audit/dashboard-horizontal-navigation-information-architecture.md` | `docs/implementation/dashboard-horizontal-shell-navigation.md` | Vigente en curso | No mezclar con ordenamiento documental ni con PRs enterprise foundation |
| Dashboard mobile/admin density | `docs/audit/admin-mobile-density-closeout.md` | Closeouts y auditorías admin-mobile relacionadas | Cerrado | No re-auditar de cero salvo regresión visual nueva |
| Seguridad / sesiones / superficie pública | `docs/security/*` | Tests `security-*`, `auth-*`, matrices RBAC/endpoints/CSP | Vigente estable | Usar para invariantes; PR-S1 debe ser auditoría enfocada antes de tocar auth/API |
| Operación / rollback / CI runbooks | `docs/ops/*` | `review-governance.md`, build-info y smoke staging existentes | Vigente parcial | Completar con PR-REL1, no mezclar con CI-only |
| Implementaciones recientes | `docs/implementation/*` | `IMPLEMENTATION_NOTES/*` | Referencia secundaria | Leer solo si el dominio lo exige; no usar como fuente primaria si hay closeout/auditoría vigente |

## Disambiguación `docs/audit` vs `docs/audits`

| Path | Uso correcto | Estado | Leer por defecto |
| --- | --- | --- | --- |
| `docs/audit/` | Auditorías activas, closeouts recientes y documentos docs-only vigentes | Mixto, con índice vigente en `docs/audit/README.md` | Sí, pero solo a través del índice |
| `docs/audits/` | Auditorías y planes históricos antiguos, especialmente documentos mayúsculos o planes visuales previos | Histórico | No |
| `docs/pr-history/` | Historial de PRs antiguos | Histórico | No |
| `docs/implementation-history/` | Historial de implementaciones antiguas | Histórico | No |
| `docs/pr-*`, `docs/fix-*` en raíz de `docs/` | Notas antiguas sueltas | Histórico / pendiente de clasificación | No |
| `IMPLEMENTATION_NOTES/` | Notas de implementación sancionadas por organización previa | Secundario | No por defecto |

## Reglas de lectura para futuras auditorías

Antes de auditar o implementar:

1. Confirmar `main` limpio.
2. Leer este mapa.
3. Leer `docs/audit/README.md`.
4. Identificar el dominio afectado.
5. Leer solo la fuente vigente de ese dominio.
6. Clasificar cualquier documento histórico como contexto, no como instrucción vigente.
7. No mezclar documentación con frontend, backend, API, auth, DB, migraciones, dependencias, lockfiles, CI, scripts de package ni configuración Playwright.
8. No permitir que Claude, Codex u otra IA elija prioridades sin matriz P0/P1/P2/P3 explícita.
9. Separar docs-only, scripts-only, CI-only, test-only, backend-only y frontend-only en PRs distintos.
10. No tocar Dependabot dentro de PRs funcionales, documentales o de ordenamiento.

## Próximo orden recomendado

| Orden | PR | Tipo | Objetivo |
| --- | --- | --- | --- |
| 1 | PR-O3 | docs-only | Clasificar documentación histórica vs vigente y marcar planes superseded |
| 2 | PR-GOV1 | docs-only | Crear base de gobernanza: ADR/RFC/change-control/ownership |
| 3 | PR-QA1 | docs-only | Definir política de flaky tests y regression strategy |
| 4 | PR-C3 | CI-only | Usar capas E2E en CI sin pérdida de cobertura, después de validación local |
| 5 | PR-S1 | docs-only | Auditoría enfocada de seguridad, sesiones, tenant isolation y RLS |
| 6 | PR-OBS1 | docs-only | Baseline de observabilidad, SLOs y runbook de incidentes |

## Estado

Este mapa es vigente desde PR-O2 y complementa `docs/audit/README.md`.
