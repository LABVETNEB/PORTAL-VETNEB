# VETNEB Release

Base documental vigente para release, deployment readiness, go/no-go y rollback.

## Propósito

Este directorio ordena cómo preparar, validar, aprobar y revertir releases de VETNEB sin duplicar runbooks existentes.

Es una base docs-only. No modifica scripts, CI, workflows, deploy settings, Render, Supabase, variables de entorno, backend, frontend, tests, Playwright, dependencias ni lockfiles.

## Fuentes relacionadas

| Fuente | Uso |
| --- | --- |
| `docs/release-readiness.md` | Checklist amplio de readiness productivo |
| `docs/ops/BACKUP_RESTORE_ROLLBACK.md` | Backup, restore y rollback operativo |
| `docs/ops/CI_PR_CHECKS_RUNBOOK.md` | Checks de PR, merge y limpieza |
| `docs/ops/production-readiness-audit.md` | Auditoría operativa de readiness |
| `docs/production-readiness-evidence.md` | Evidencia sanitizada de producción |
| `docs/production-readiness-snapshot-2026-05-27.md` | Snapshot histórico de readiness |
| `docs/governance/pr-readiness-review-checklist.md` | Checklist de PR readiness |
| `docs/qa/regression-strategy.md` | Validación por riesgo y regresión |
| `docs/SOURCES_OF_TRUTH.md` | Mapa vigente de fuentes por dominio |
| `docs/HISTORICAL_DOCUMENTATION.md` | Clasificación de documentación histórica |

## Documentos de este directorio

| Documento | Propósito |
| --- | --- |
| `release-go-no-go-policy.md` | Política de decisión go/no-go, deploy readiness y rollback |
| `release-evidence-archive-policy.md` | Ubicación, sanitización y retención de evidencia de releases |
| `production-readiness-environments-evidence.md` | Evidencia sanitizada de GitHub environments para Plan B Slot 17 |

## Regla de uso

Antes de un release o cambio con impacto productivo:

1. Confirmar fuente vigente en `docs/SOURCES_OF_TRUTH.md`.
2. Revisar PR readiness en `docs/governance/pr-readiness-review-checklist.md`.
3. Revisar estrategia de regresión en `docs/qa/regression-strategy.md`.
4. Revisar readiness productivo en `docs/release-readiness.md`.
5. Revisar backup, restore y rollback en `docs/ops/BACKUP_RESTORE_ROLLBACK.md`.
6. Confirmar checks de PR con `docs/ops/CI_PR_CHECKS_RUNBOOK.md`.
7. Registrar decisión go/no-go.
8. Archivar la evidencia según `release-evidence-archive-policy.md`.
9. No mezclar release readiness con cambios funcionales, CI, dependencias o migraciones.

## Estado

Este directorio nace como PR-REL1 docs-only. No reemplaza los documentos existentes: los organiza como ruta de decisión para release.
