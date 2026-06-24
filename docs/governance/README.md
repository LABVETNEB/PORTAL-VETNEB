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

## Regla de uso

Antes de una implementación con riesgo técnico, operativo, de seguridad, datos, CI o arquitectura:

1. Confirmar fuente vigente en `docs/SOURCES_OF_TRUTH.md`.
2. Confirmar si existe documentación histórica en `docs/HISTORICAL_DOCUMENTATION.md`.
3. Crear RFC si el cambio requiere diseño previo.
4. Crear ADR si se toma una decisión duradera.
5. Revisar ownership del dominio afectado.
6. Completar checklist de PR readiness.
7. Mantener el PR con un solo scope.

## Estado

Este directorio nace como PR-GOV1 docs-only. Cualquier cambio posterior debe mantener separación estricta entre documentación, código, CI, dependencias y configuración productiva.
