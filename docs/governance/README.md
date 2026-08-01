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
| `data-classification-retention-policy.md` | Política normativa de clasificación, retención, legal hold y disposición de datos |
| `supply-chain-policy.md` | Política normativa de dependencias, Dependabot, actions pinneadas por SHA y SBOM |

## Autoridad de lifecycle documental

`documentation-lifecycle-policy.md` es la fuente normativa vigente para creación, promoción,
revisión, reclasificación, supersession, cierre y conservación histórica de documentos.

Complementa a `docs/SOURCES_OF_TRUTH.md`, que sigue siendo el mapa de lectura por dominio, y a
`docs/HISTORICAL_DOCUMENTATION.md`, que sigue siendo la clasificación existente de documentación
histórica, secundaria y superseded.

El enforcement automático de esta política sigue pendiente. No se deben reclasificar, cerrar,
reemplazar, mover ni retirar documentos silenciosamente; cualquier transición documental debe quedar
declarada en el PR y reflejada en los índices correspondientes cuando aplique.

## Gobernanza de datos

`data-classification-retention-policy.md` es la fuente normativa de clasificación, retención,
legal hold y disposición. Sus períodos son objetivos internos sujetos a obligaciones legales o
contractuales confirmadas. La política no implementa jobs, borrado, migraciones, inventario de
activos ni cambios de Storage.

Se complementa con:

- `docs/ops/data-recovery-objectives.md` para RPO/RTO;
- `docs/ops/BACKUP_RESTORE_ROLLBACK.md` para ejecución operativa;
- `docs/ops/INCIDENT_MANAGEMENT_RUNBOOK.md` para incidentes;
- `docs/ops/METRICS_BASELINE.md` para SLIs/SLOs y diseño de alertas.

## Gobernanza de supply chain

`supply-chain-policy.md` es la fuente normativa de gobernanza de dependencias: ownership por
rol, cadencia, clasificación de riesgo, separación entre npm raíz, npm frontend y GitHub
Actions, reglas de majors/minors/patches/security fixes, audits, lockfile, pruebas, rollback,
tratamiento de actions pinneadas por SHA, prohibición de merge automático y rol del SBOM como
evidencia no bloqueante.

La decisión durable sobre la herramienta SBOM y la semántica no bloqueante del job vive en
`docs/architecture/supply-chain-sbom-rfc.md`. El enforcement efectivo vive en
`.github/dependabot.yml`, `scripts/governance/workflow-security-validator.mjs` y los contratos
de `test/`; la política por sí sola no prueba enforcement.

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
