# VETNEB Governance

Base documental vigente de gobernanza de ingeniería para VETNEB.

## Propósito

Este directorio define cómo registrar decisiones, proponer cambios, asignar ownership y revisar PRs antes de implementación.

Es una base docs-only. No modifica CODEOWNERS, CI, workflows, dependencias, backend, frontend, tests, auth, DB ni migraciones.

## Fuentes relacionadas

| Fuente | Uso |
| --- | --- |
| `AGENTS.md` | Protocolo operativo principal para agentes e IA |
| `.github/CODEOWNERS` | Ownership técnico efectivo aplicado por GitHub |
| `docs/review-governance.md` | Reglas existentes de contenido, checks, rollback y scope |
| `docs/SOURCES_OF_TRUTH.md` | Mapa vigente de fuentes por dominio |
| `docs/HISTORICAL_DOCUMENTATION.md` | Clasificación de documentos históricos y superseded |

## Documentos de este directorio

| Documento | Propósito |
| --- | --- |
| `adr-template.md` | Plantilla para registrar decisiones arquitectónicas |
| `rfc-change-control-template.md` | Plantilla para proponer cambios relevantes antes de implementarlos |
| `ownership-model.md` | Modelo documental de ownership por dominio |
| `pr-readiness-review-checklist.md` | Checklist de preparación antes de abrir o revisar PRs |
| `enterprise-control-register.md` | Registro operativo vivo de controles enterprise derivado del baseline y gap register aprobados |
| `documentation-lifecycle-policy.md` | Política normativa de lifecycle documental |

## Autoridad de lifecycle documental

`documentation-lifecycle-policy.md` es la fuente normativa vigente para creación, promoción,
revisión, reclasificación, supersession, cierre y conservación histórica de documentos.

Complementa a `docs/SOURCES_OF_TRUTH.md`, que sigue siendo el mapa de lectura por dominio, y a
`docs/HISTORICAL_DOCUMENTATION.md`, que sigue siendo la clasificación existente de documentación
histórica, secundaria y superseded.

El enforcement automático de esta política sigue pendiente. No se deben reclasificar, cerrar,
reemplazar, mover ni retirar documentos silenciosamente; cualquier transición documental debe quedar
declarada en el PR y reflejada en los índices correspondientes cuando aplique.

## Regla de uso

Antes de una implementación con riesgo técnico, operativo, de seguridad, datos, CI o arquitectura:

1. Confirmar fuente vigente en `docs/SOURCES_OF_TRUTH.md`.
2. Confirmar si existe documentación histórica en `docs/HISTORICAL_DOCUMENTATION.md`.
3. Crear RFC si el cambio requiere diseño previo.
4. Crear ADR si se toma una decisión duradera.
5. Revisar ownership del dominio afectado.
6. Completar checklist de PR readiness.
7. Mantener el PR con un solo scope.

## Enterprise control register

`enterprise-control-register.md` mantiene el estado operativo vivo de los controles enterprise.
Deriva del baseline y del gap register aprobados por PR #1436, pero no reemplaza esos snapshots
históricos ni los reescribe. Cualquier cambio de estado exige evidencia verificable, owner,
fecha de verificación y trazabilidad con los gaps relacionados cuando existan.

## Estado

Este directorio nace como PR-GOV1 docs-only. Cualquier cambio posterior debe mantener separación estricta entre documentación, código, CI, dependencias y configuración productiva.
