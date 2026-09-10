# E2E-GLOBAL-01 — Restaurar `E2E Completeness` (saneamiento APT con soporte Deb822)

Fase 1 de 10 del programa `LIMPIEZA E2E` (`docs/audit/LIMPIEZA E2E.md`, §24). Cierra P0-2 / R-03.

## Estado base

| Ítem | Valor |
|---|---|
| Rama base | `main` |
| HEAD base | `df192e5901e80e7baf654af6f7bd3b14ac7e7437` |
| Asunto | `docs(audit): add LIMPIEZA E2E (#1705)` |
| Relación con `origin/main` | `0 0` |
| `git status --short -uall` | vacío |
| Rama de trabajo | `fix/e2e-global-01-completeness` |
| Clasificación | R2 (CI/workflows), scope primario `workflows/CI` |

## Scope incluido

- `.github/workflows/e2e-completeness.yml`: saneamiento de la fuente APT de Google Chrome, con
  soporte de los dos formatos que la imagen del runner puede usar.
- Realineación in-PR de los dos guards que anclan ese workflow (§4 de `AGENTS.md`):
  contrato de infraestructura y digest canónico de seguridad de workflows.
- Esta documentación de implementación (§11).

## Scope excluido

- `E2E-GLOBAL-02` … `E2E-GLOBAL-10` y cualquier otra fase de `LIMPIEZA E2E`.
- `frontend/playwright.config.ts`, specs, fixtures, helpers y catálogo E2E.
- `.github/workflows/frontend-ci.yml` (ver riesgo residual R-R1).
- Frontend y backend de producto, dependencias, lockfile, auth, cookies y configuración productiva.
- Branch protection, required checks, secrets y settings de GitHub.
- PR #1704, usada exclusivamente como evidencia histórica y no como fuente de verdad.

## Auditoría previa

`pnpm --dir frontend exec playwright install-deps chromium` ejecuta `apt-get update`, que falla
cerrado ante cualquier fuente configurada. La imagen `ubuntu-24.04` trae preinstalado el
repositorio propio de Google Chrome, ajeno a las bibliotecas de sistema que Chromium necesita.
Ese repositorio publicó índices inconsistentes y APT terminó con `Hash Sum mismatch` y exit `100`.

Evidencia (lecturas R0, `gh run view`):

| Run | Timestamp UTC | Resultado | Paso |
|---|---|---|---|
| `34357768243` | 2026-09-09 13:32 | success | 11 alcanzado |
| `34365419421` | 2026-09-09 14:42 | failure | 9 · `Install Playwright system dependencies` |
| `34379465111` | 2026-09-09 16:52 | failure | 9 |
| `34385169532` | 2026-09-09 17:48 | failure | 9 — `Err:29 …/chrome-stable/deb stable/main amd64 Packages / Hash Sum mismatch`; `E: … exit code 100` |
| `34409140047` | 2026-09-09 21:50 | failure | 9 — remediación histórica: `Unsupported Deb822 APT source containing targeted URI: /etc/apt/sources.list.d/google-chrome.sources` |
| `34421834047` | 2026-09-10 00:34 | pasos 9 y 10 en verde | 11 en ejecución |

Dos conclusiones que la implementación respeta:

1. **El fallo es intermitente, no permanente.** El run `34421834047`, con el workflow de `main` sin
   modificar, superó el paso 9. La inconsistencia del índice remoto se sanó sola. Por lo tanto el
   verde de un run aislado **no** es evidencia de remediación: el gate seguía expuesto a la próxima
   publicación inconsistente de `dl.google.com`. La corrección elimina la exposición, no espera a
   que el upstream se comporte.
2. **La causa del fallo de la remediación histórica es el formato.** El runner declara la fuente
   como `/etc/apt/sources.list.d/google-chrome.sources`, en formato **Deb822**. Un saneamiento que
   sólo entiende las líneas clásicas `deb`/`deb-src` no la neutraliza y aborta.

## Cambio implementado

El paso `Install Playwright system dependencies` pasa a `shell: bash` y, antes de invocar
`install-deps`, recorre `/etc/apt/sources.list`, `/etc/apt/sources.list.d/*.list` y
`/etc/apt/sources.list.d/*.sources`, y neutraliza únicamente las entradas cuya URI contiene
`dl.google.com/linux/chrome` (cubre `chrome/deb`, `chrome-stable/deb` y demás canales):

- **Deb822 (`.sources`)**: la estrofa que contiene la URI objetivo se reescribe con `Enabled: no`,
  el mecanismo documentado del formato. Se preserva el resto de sus campos y todas las demás
  estrofas del archivo, incluida la separación por línea en blanco. Un `Enabled:` previo se
  reemplaza en lugar de duplicarse.
- **Clásico (`.list` y `sources.list`)**: la línea activa se comenta con prefijo trazable.

`awk` procesa Deb822 en modo párrafo (`RS = ""`) con `FS = "\n"` explícito, de modo que cada
estrofa es un registro y cada una de sus líneas exactamente un campo. Sin ese `FS` explícito el
separador por espacios por defecto sigue vigente y parte `Types: deb` en dos campos, corrompiendo
el archivo; el guard fija esa condición.

`playwright install-deps chromium` se conserva textualmente. `playwright install --with-deps
chromium` **no** se usa como sustituto: ejecuta el mismo `apt-get update` y no evita la causa.

## Comportamiento fail-closed

- `set -euo pipefail` en el paso completo.
- La ausencia de la fuente objetivo **no** es error: el bucle no hace nada y `install-deps` corre igual.
- Una fuente objetivo que sigue activa después de la reescritura **sí** es error: `exit 1` con causa nombrada.
- No se introduce `continue-on-error`, `|| true`, `set +e`, ni degradación de errores a warnings.
- No se omite la instalación de dependencias, no se reduce cobertura y no se toca `e2e:full`.
- No se altera ninguna otra fuente APT: el archivo de Ubuntu queda byte a byte idéntico.

## Archivos

| Archivo | Cambio |
|---|---|
| `.github/workflows/e2e-completeness.yml` | Saneamiento APT con soporte Deb822 en el paso 9 |
| `test/unit/infrastructure/e2e-completeness-workflow.test.ts` | Contrato ejecutable del saneamiento (guard nuevo) |
| `test/unit/infrastructure/workflow-security-policy-contract.test.ts` | Digest canónico realineado del único workflow modificado |

Digest canónico: `bd96be3b…3cecbe` → `fdac86cb…c8c569`.

## Validaciones

| Gate | Estado |
|---|---|
| Tests dirigidos de infraestructura (`e2e-completeness-workflow`, `workflow-security-policy-contract`, `workflow-security-validator-contract`) | PASSED — 55/55 |
| `pnpm validate:local` (`typecheck` + `typecheck:test` + `test` + `build`) | PASSED — 4502 pass / 1 skip preexistente |
| `node scripts/governance/workflow-security-validator.mjs` (qga-governance) | PASSED — 7 workflows, 28 acciones externas |
| `pnpm security:public-surface` | PASSED |
| `git diff --check` | PASSED |
| Ejecución del script contra fixtures APT sintéticos (Deb822 mono/multi-estrofa, `.list` mixto, ausencia total, idempotencia) | PASSED |
| Mutación del guard contra 4 regresiones (one-liner revertido, `--with-deps`, rechazo Deb822 de #1704, fallo silenciado) | PASSED — discrimina las 4 |
| Cohortes E2E (`e2e:full` local) | NOT_RUN — `AGENTS.md` §7 fija Playwright completo por defecto = 0; el cambio es ci-only y no toca specs, config ni catálogo |
| `pr-governance` | NOT_RUN — requiere metadatos de PR; se evalúa en CI |

## Riesgos residuales

- **R-R1 — `frontend-ci.yml` sigue expuesto.** El gate required instala el browser con
  `playwright install --with-deps`, que ejecuta el mismo `apt-get update` sobre las mismas fuentes.
  Hoy no ha fallado, pero la exposición es idéntica. Queda **fuera de scope** por `AGENTS.md` §4 y
  por el no-scope declarado de `E2E-GLOBAL-01`; se reporta, no se corrige de contrabando.
- **R-R2 — deriva de la imagen del runner.** Si GitHub cambia la ruta o el canal de la fuente de
  Chrome, el fragmento objetivo deja de coincidir y la exposición vuelve. El fragmento se eligió
  deliberadamente amplio (`dl.google.com/linux/chrome`) para cubrir todos los canales.
- **R-R3 — aceptación pendiente.** `LIMPIEZA E2E` exige **2 runs consecutivos de `E2E Completeness`
  alcanzando el paso 11**. Esa evidencia sólo existe después del push, y no la produce esta
  implementación local.

## Estado final

Corrección implementada y validada localmente. Aceptación definitiva pendiente de los 2 runs
consecutivos exigidos por la fuente rectora. Ninguna fase posterior de `LIMPIEZA E2E` fue iniciada.
