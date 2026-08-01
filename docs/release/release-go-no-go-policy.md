# Release Go/No-Go Policy

Política documental vigente para decidir releases, deployment readiness y rollback en VETNEB.

## Propósito

Definir un criterio único para aprobar, pausar o revertir un release.

Este documento no ejecuta deploys ni modifica configuración productiva. Solo ordena la decisión operativa.

## Clasificación de release

| Tipo | Descripción | Revisión mínima |
| --- | --- | --- |
| Docs-only | Cambios documentales sin runtime | Scope, links, `git diff --check`, checks de PR |
| Patch runtime | Fix acotado de backend o frontend | Tests del dominio, build, rollback |
| Security patch | Auth, sesión, permisos, leakage o public surface | Suite security, rollback, evidencia |
| Data/migration | DB, migraciones, storage o datos clínicos | Backup, compatibilidad, restore/rollback |
| CI/deploy | Workflows, scripts, deploy config o package scripts | Dry-run, rollback de config, checks |
| Dependency | Dependencias o lockfiles | Audit, build, tests afectados, rollback de versión |
| Major release | Múltiples dominios o cambio operativo amplio | RFC/ADR, QA strategy, go/no-go formal |

## Preflight obligatorio

Antes de aprobar un release:

- Confirmar `main` limpio.
- Confirmar PRs incluidos.
- Confirmar checks verdes.
- Confirmar scope y no-scope.
- Confirmar validaciones ejecutadas.
- Confirmar evidencia sanitizada.
- Confirmar rollback trigger.
- Confirmar rollback steps.
- Confirmar data impact.
- Confirmar owner operativo.
- Confirmar que no hay secretos en logs, screenshots ni documentación.
- Confirmar que no se mezclaron dependencias con cambios funcionales.
- Confirmar que no se mezclaron CI/workflows con runtime sin autorización explícita.

## Validación mínima por riesgo

| Riesgo | Validación esperada |
| --- | --- |
| Docs-only | `git diff --check`, review documental |
| Backend/API | `pnpm test`, `pnpm build`, checks de PR |
| Frontend | `pnpm --dir frontend lint`, `pnpm --dir frontend typecheck`, `pnpm --dir frontend build` |
| E2E focalizado | Suite definida en `docs/qa/regression-strategy.md` |
| Security/public surface | Suite security vigente y `pnpm security:public-surface` si aplica |
| DB/migration | Tests de migración, backup, restore plan y rollback |
| CI/deploy | `gh pr checks --watch`, runbook CI y rollback de config |

## Go

Un release puede avanzar si:

- El scope está cerrado.
- Los checks requeridos están verdes.
- No hay flaky test sin clasificar.
- No hay regresión conocida sin owner.
- No hay evidencia sensible expuesta.
- El rollback está definido.
- El data impact está documentado.
- La evidencia de validación corresponde al riesgo real.
- El estado productivo esperado es verificable después del deploy.

## No-go

Un release debe pausarse si aparece cualquiera de estos puntos:

- Checks rojos sin diagnóstico.
- Flaky test P1 sin owner.
- Regresión visual u operativa reproducible sin fix ni follow-up.
- Cambio de auth, sesión, tenant isolation, DB o storage sin validación suficiente.
- Migración sin backup o rollback.
- CI/deploy config modificada sin rollback.
- Dependencias mezcladas con cambios funcionales.
- Evidencia con secretos, tokens, datos clínicos o información sensible.
- Scope expandido sin dividir PR.
- Documentación histórica usada como fuente primaria contra `docs/SOURCES_OF_TRUTH.md`.

## Rollback trigger

Definir rollback inmediato si:

- El deploy rompe login, sesión o autorización.
- El deploy rompe lectura/escritura crítica.
- El deploy expone datos sensibles.
- El deploy rompe acceso público esencial.
- El deploy rompe generación, subida, acceso o descarga de informes.
- El deploy provoca error productivo sostenido.
- El deploy degrada dashboard crítico o navegación operativa.
- El deploy rompe compatibilidad con datos existentes.

## Rollback steps

El PR o release debe indicar:

- Commit o PR a revertir.
- Servicio afectado.
- Comando o acción de rollback.
- Responsable.
- Orden de ejecución.
- Verificación posterior.
- Evidencia sanitizada posterior.
- Impacto en datos.
- Comunicación necesaria.

## Smoke posterior

Después de deploy o rollback, validar según dominio:

- Health backend.
- Login o sesión si aplica.
- Ruta pública crítica.
- Dashboard crítico si aplica.
- Upload/download de informe si aplica.
- Storage/signed URL si aplica.
- Smoke staging o producción según runbook vigente.

## Evidencia permitida

Permitido:

- Commit.
- PR.
- Checks.
- Logs sanitizados.
- Capturas sin secretos.
- Hashes o tamaños de backup.
- Resultado de smoke.
- Estado go/no-go.

Prohibido:

- Tokens.
- Cookies.
- Secrets.
- URLs firmadas activas.
- Datos clínicos reales.
- Credenciales.
- Dumps completos.
- Capturas con información sensible.

## Archivo y retención de evidencia

Toda decisión debe archivar su evidencia conforme a
[Release Evidence Archive Policy](./release-evidence-archive-policy.md).

El registro debe indicar la ubicación del archivo y la clase de retención.
Una evidencia no ejecutada permanece `NOT_RUN` o `BLOCKED`; nunca se infiere
`PASSED` por existir documentación o configuración.

La evidencia de configuración inicial de GitHub environments se conserva en
[Production Readiness Environments Evidence](./production-readiness-environments-evidence.md).

## Registro go/no-go

Registrar:

| Campo | Valor |
| --- | --- |
| Fecha | YYYY-MM-DD |
| Commit |  |
| PRs incluidos |  |
| Tipo de release |  |
| Validaciones |  |
| Riesgo residual |  |
| Rollback trigger |  |
| Rollback steps |  |
| Data impact |  |
| Decisión | Go / No-go |
| Owner |  |
| Evidencia |  |
| Archivo de evidencia | `docs/release/evidence/<release-id>.md` |
| Clase de retención | 24 meses / 60 meses |

## Criterio de cierre

El release queda cerrado cuando:

- La decisión fue registrada.
- La evidencia fue sanitizada.
- Los checks finales quedaron documentados.
- No quedan P0 abiertos.
- Todo P1 tiene owner y seguimiento.
- `main` queda limpio tras merge y prune.
