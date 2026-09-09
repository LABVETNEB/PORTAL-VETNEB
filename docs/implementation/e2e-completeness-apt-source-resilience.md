# E2E Completeness — resiliencia de la fuente APT de Google Chrome

## Estado base

- Repositorio: `LABVETNEB/PORTAL-VETNEB`.
- Baseline actual: `main` en `2683f39ab865d0c3cfcf26c2489a801115b58320`.
- PR #1703 `fix(frontend): sync next-env with Next.js codegen`: fusionada; su merge commit es `2683f39ab865d0c3cfcf26c2489a801115b58320`.
- Incidente originario: [PR #1702](https://github.com/LABVETNEB/PORTAL-VETNEB/pull/1702), que sólo modifica `frontend/package.json` y `pnpm-lock.yaml`. Este cambio CI-only no modifica esa PR ni incorpora su scope de dependencias.
- Run de `E2E Completeness` observado: `34385169532`, attempt `1`, `FAILURE` durante `playwright install-deps chromium`.
- Run de `Frontend CI` observado sobre el mismo head: `34385169601`, attempt `2`, `SUCCESS`. No son el mismo workflow ni el mismo rerun.

## Scope incluido

- Hardening CI-only del step `Install Playwright system dependencies`.
- Contrato unitario ejecutable para la neutralización específica de la fuente APT de Google Chrome.
- Preservación del gate observacional de source hygiene y de la cobertura `e2e:full`.
- Revisión parser-backed y realineación del digest canónico del único workflow modificado.
- Esta documentación de implementación R2.

## Scope excluido

- PR #1702, dependencias, manifests y lockfile.
- El drift histórico de `frontend/next-env.d.ts`, resuelto separadamente por PR #1703.
- `frontend/next-env.d.ts`, `frontend/e2e/helpers/restore-next-env-hygiene.mjs`, `frontend/e2e/scripts/run-cohort.mjs`, `test/unit/infrastructure/next-env-hygiene.test.ts` y `frontend/playwright.config.ts`.
- Producto frontend, backend, DB, schema, migraciones, auth, cookies y configuración productiva.
- Branch protection, required-check settings, Actions secrets y creación o modificación de PRs.
- Reducción de cobertura, skips, `continue-on-error`, omisión de `install-deps`, cambio de Chromium por Chrome y aumento de timeouts.

## Cause A — fuente APT de Google Chrome

`pnpm --dir frontend exec playwright install-deps chromium` ejecuta APT en `ubuntu-latest`. En el run `34385169532`, APT consultó `https://dl.google.com/linux/chrome-stable/deb`; el índice publicado y `Packages.gz` no coincidían, por lo que APT terminó con `Hash Sum mismatch` y exit code `100`. El browser y la cohorte `e2e:full` nunca llegaron a ejecutarse.

La fuente de Google Chrome es ajena a las dependencias del sistema que Playwright necesita para Chromium. No existe evidencia de que las actualizaciones de #1702 causaran el fallo: `Frontend CI` completó la instalación del browser y su cohorte E2E sobre el mismo head.

Esta causa se resuelve en el presente cambio CI-only.

## Cause B histórica — drift de `frontend/next-env.d.ts`

El build de Next.js había producido drift al agregar `import "./.next/types/root-params.d.ts";`. PR #1703 fusionó esa salida de producción como parte del archivo canónico y cerró la divergencia en `main`.

Esta causa está resuelta previamente por PR #1703 y queda fuera del scope del presente cambio. El workflow no restaura el archivo completo desde `HEAD`: el gate final permanece observacional y fail-closed, de modo que una mutación desconocida de `frontend/next-env.d.ts` continúa provocando un fallo visible.

El helper existente conserva exclusivamente sus transformaciones tipificadas para referencias de desarrollo y no se modifica.

## Decisión técnica

El step de dependencias del sistema conserva `shell: bash`, `set -euo pipefail`, timeout explícito y termina ejecutando exactamente:

```text
pnpm --dir frontend exec playwright install-deps chromium
```

Antes de esa instalación inspecciona únicamente las ubicaciones canónicas de APT (`sources.list`, `*.list` y `*.sources`) buscando el fragmento exacto `dl.google.com/linux/chrome-stable/deb` en entradas activas.

- En formato one-line `.list`, sólo comenta la línea activa cuyo token URI coincide con `http://` o `https://dl.google.com/linux/chrome-stable/deb`, con slash final opcional.
- Todas las demás líneas se copian sin cambios; un archivo mixto conserva sus repositorios ajenos.
- Una coincidencia con sintaxis activa no reconocida aborta explícitamente.
- Una coincidencia en Deb822 `.sources` también aborta explícitamente; nunca se deshabilita el archivo completo.
- Después de escribir una `.list`, el workflow relee el archivo y falla si la fuente objetivo sigue activa.
- Si la fuente no está configurada, no altera APT y continúa con Playwright.

No se ignora ningún error general de APT. Cualquier fallo real de `install-deps` conserva su exit code no-cero.

El step final de higiene conserva `if: always()`, elimina sólo los dos directorios de artefactos esperados y ejecuta `git diff --exit-code` más `git status` sobre `frontend/next-env.d.ts` y `frontend/e2e`. No sobrescribe fuentes antes de observarlas.

## Alternativas descartadas

- `continue-on-error`, `|| true` o ignorar errores generales de APT: ocultarían fallos reales.
- Deshabilitar `sources.list.d` o mover un archivo completo: podría retirar repositorios ajenos.
- Retry de APT: no corrige metadata inconsistente determinista y agrega latencia sin defensa demostrable.
- Omitir `install-deps`, instalar Chrome o reducir `e2e:full`: cambiaría el contrato o la cobertura.
- Transformar Deb822 con lógica ad hoc dentro del YAML: amplía desproporcionadamente la superficie; una representación no soportada falla de forma explícita.
- Restaurar `frontend/next-env.d.ts` completo desde `HEAD`: podría borrar una mutación desconocida antes de que el gate la detecte.
- Modificar el helper o runner de cohortes: PR #1703 ya resolvió el drift canónico y el helper tipificado permanece vigente.

## Archivos modificados

- `.github/workflows/e2e-completeness.yml`
- `test/unit/infrastructure/e2e-completeness-workflow.test.ts`
- `test/unit/infrastructure/workflow-security-policy-contract.test.ts`
- `docs/implementation/e2e-completeness-apt-source-resilience.md`

## Tests y validaciones

| Gate | Estado | Evidencia |
| --- | --- | --- |
| `node --test test/unit/infrastructure/e2e-completeness-workflow.test.ts` | PASSED | 7/7; hardening APT, `install-deps chromium`, cobertura completa y gate de higiene observacional intactos. |
| `node --test test/unit/infrastructure/workflow-security-policy-contract.test.ts` | PASSED | 8/8 después de la revisión y realineación exclusiva del digest. |
| Ambos tests dirigidos en una invocación | PASSED | 15/15. |
| `pnpm validate:local` | PASSED | `typecheck`, `typecheck:test`, 4.503 tests (4.502 pass, 1 skip, 0 fail) y build backend. |
| `pnpm --dir frontend e2e:full` | NOT_RUN | La ejecución Linux definitiva corresponde a CI después de publicación. |
| Audits de dependencias | NOT_RUN | No se modifican manifests ni lockfile. |
| Migraciones / schema | NOT_RUN | Sin impacto DB/Drizzle. |
| Gates de producto frontend | NOT_RUN | Sin cambios de producto frontend. |

## Workflow-security review

- Permisos top-level conservados exactamente en `contents: read`.
- Actions externas y pins SHA sin cambios.
- Sin permisos de job, acciones nuevas, referencias mutables ni allowlists modificadas.
- El guard reportó como único fallo inicial el digest de `.github/workflows/e2e-completeness.yml`.
- El SHA-256 se recalculó independientemente con PowerShell/.NET sobre UTF-8 normalizado de CRLF a LF y coincidió con el valor observado por el test: `9d8de6fc148d7c847dab9b9dcd3f53edc29a10d722ef63c208e68799b4302d3c`.
- Sólo esa entrada de `canonicalWorkflowDigests` fue realineada; el guard final pasó 8/8 sin debilitarse.
- Ningún otro workflow ni digest se modifica.

## Rollback lógico

Restaurar los cuatro archivos de esta entrega a su contenido anterior revierte completamente el cambio. No hay datos, migraciones ni dependencias que deshacer. El rollback reintroduciría la dependencia accidental de `E2E Completeness` respecto de la disponibilidad coherente de la fuente APT de Google Chrome.

## Riesgos residuales

- La ejecución definitiva sólo puede observarse en un runner Linux real después de publicar la rama; localmente no se ejecuta `e2e:full`.
- Si GitHub migra la fuente objetivo a Deb822 `.sources`, el workflow fallará explícitamente y requerirá una transformación parser-backed dedicada. No deshabilitará repositorios ajenos silenciosamente.
- Una falla ajena de APT o Playwright continuará fallando el job por diseño.

## Estado final

El cambio se limita al workflow, sus guards y esta documentación. PR #1702, PR #1703, dependencias y producto permanecen intactos. La publicación se limita a la rama `fix/e2e-completeness-apt-resilience`; no se crea PR ni se ejecutan reruns o merges desde esta tarea.
