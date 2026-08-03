# PR-DEPS-SUPPLY-CHAIN-GOVERNANCE Audit (Plan B slot 16)

| Campo | Valor |
| --- | --- |
| Document owner | Security / Dependency owner |
| Domain | Dependency and supply-chain governance |
| Lifecycle status | ACTIVE |
| Authoritative source role | Closeout local del slot 16; evidencia, no política |
| Effective date | 2026-08-01 |
| Last verified date | 2026-08-02 |
| Review cadence | Ante cambios de Dependabot, workflows, SBOM o `ERM-CTRL-024` |
| Supersedes | Ninguno |
| Superseded by | Ninguno |
| Related controls or gaps | `ERM-CTRL-024`; `ERM-DEP-001` |
| Related sources | [Supply-Chain Policy](../governance/supply-chain-policy.md); [SBOM RFC](../architecture/supply-chain-sbom-rfc.md); [Enterprise Control Register](../governance/enterprise-control-register.md); [Consolidation plan](./enterprise-roadmap-consolidation-plan.md) |
| Baseline | `main@cdff7ad67f3e1314a75311d7482f4edcd4b36e11`, working tree limpio, 4 stashes preservados |

## 1. Alcance

`PR-DEPS-SUPPLY-CHAIN-GOVERNANCE` absorbe `PR-DEPS-1`, `PR-DEPS-2`, `PR-DEPS-3` y `PR-DEPS-4`
en una sola entrega con mixed-scope exception declarada.

| Sub-PR | Objetivo | Resultado (2026-08-02) |
| --- | --- | --- |
| `PR-DEPS-1` | Dependabot security updates | `ENABLED_VERIFIED` — mutación R2 ejecutada por el repository admin (`LABVETNEB`); readback confirma `enabled=true`, `paused=false` |
| `PR-DEPS-2` | Política de supply chain | `IMPLEMENTED` — `docs/governance/supply-chain-policy.md` |
| `PR-DEPS-3` | Cobertura Dependabot | `IMPLEMENTED_VERIFIED` — npm `/`, npm `/frontend`, `github-actions` `/` con agrupación por riesgo; configuración efectiva confirmada |
| `PR-DEPS-4` | SBOM CycloneDX | `IMPLEMENTED_VERIFIED_REMOTE` — job no bloqueante, artifact `sbom-cyclonedx` observado en CI contra el head final |

Resultado local original al momento de la implementación (2026-08-01), preservado como estado previo:

| Sub-PR | Resultado local (2026-08-01) |
| --- | --- |
| `PR-DEPS-1` | `NOT_RUN` — mutación externa R2, entregada como bloque manual para el repository admin |
| `PR-DEPS-2` | `IMPLEMENTED_LOCAL` |
| `PR-DEPS-3` | `IMPLEMENTED_LOCAL` |
| `PR-DEPS-4` | `IMPLEMENTED_LOCAL` / `NOT_VERIFIED_REMOTE` — job no bloqueante y generador propio |

## 2. Estado previo observado

| Item | Estado previo |
| --- | --- |
| `ERM-CTRL-024` | `PARTIAL` |
| Dependabot security updates | `DISABLED` / pendiente de mutación externa |
| Dependabot npm raíz | `CONFIGURED` |
| Dependabot npm frontend | `NOT_CONFIGURED` |
| Dependabot github-actions | `CONFIGURED` |
| Risk grouping | `NOT_CONFIGURED` |
| SBOM executable generation | `NOT_IMPLEMENTED` |
| Workflow SHA pinning | `IMPLEMENTED` |
| `qga-workflow-security` | `REQUIRED` |
| Default workflow permissions | `read` |
| Production readiness | `PARTIAL/BLOCKED` |

## 3. Decisión técnica del SBOM

La decisión durable y sus alternativas descartadas se registran en el
[SBOM RFC](../architecture/supply-chain-sbom-rfc.md).

Resumen: el SBOM se genera con `scripts/supply-chain/generate-sbom.mjs`, un script propio del
repositorio que parsea `pnpm-lock.yaml` con el `js-yaml` ya pinneado y emite CycloneDX 1.6
JSON determinista. Se descartaron la action `CycloneDX/gh-node-module-generatebom` (fuera del
allowlist efectivo), `@cyclonedx/cyclonedx-npm` como dependencia persistente (incompatible con
un workspace pnpm sin `package-lock.json`), `pnpm dlx` (resolución en tiempo de ejecución
fuera de `--frozen-lockfile`) y la descarga de binarios `syft`/`cdxgen` (prohibida).

Consecuencia directa: **no** se modificaron `package.json` ni `pnpm-lock.yaml`. No se
incorporó ninguna dependencia persistente.

### 3.1 Semántica no bloqueante sin `continue-on-error`

El job `generate-sbom` no declara `needs`, ningún job depende de él y `backend-check` — que
publica el contexto required `validate-backend` — no observa su resultado. El merge no puede
quedar bloqueado por el SBOM y, al mismo tiempo, un fallo de generación permanece visible.
`continue-on-error` y `|| true` siguen ausentes de `backend-ci.yml`, anclados por
`test/architecture/toolchain-contract.test.ts`.

## 4. Archivos modificados

| Archivo | Cambio | Scope |
| --- | --- | --- |
| `.github/dependabot.yml` | Tres ecosistemas separados con agrupación determinista minor+patch | repository configuration |
| `.gitignore` | Ignora `sbom/` | repository configuration |
| `.github/workflows/backend-ci.yml` | Nuevo job `generate-sbom` aislado con artifact retenido 90 días | workflows/CI |
| `scripts/supply-chain/generate-sbom.mjs` | Generador CycloneDX 1.6 determinista desde el lockfile | scripts/tooling |
| `scripts/supply-chain/generate-sbom.d.mts` | Declaraciones tipadas del generador | scripts/tooling |
| `test/unit/infrastructure/supply-chain-governance-contract.test.ts` | Contratos positivos y negativos de Dependabot, workflow SBOM y generador | tests |
| `test/unit/infrastructure/workflow-security-policy-contract.test.ts` | Realineación in-PR del digest de `backend-ci.yml` y del pin de `actions/upload-artifact` | tests |
| `docs/governance/supply-chain-policy.md` | Política normativa nueva | documentation |
| `docs/architecture/supply-chain-sbom-rfc.md` | RFC de la decisión durable | documentation |
| `docs/governance/README.md` | Índice de gobernanza | documentation |
| `docs/SOURCES_OF_TRUTH.md` | Mapa de fuentes | documentation |
| `docs/governance/enterprise-control-register.md` | `ERM-CTRL-024` con evidencia local | documentation |
| `docs/audit/pr-deps-supply-chain-governance-audit.md` | Este closeout | documentation |

No se tocaron `server/**`, `frontend/src/**`, `frontend/e2e/**`, `drizzle/**`, migraciones,
schema, auth, cookies, sesiones, lógica de tenant, RLS, producción, staging, GitHub
environments, branch protection ni nombres de required checks.

## 5. Mixed-scope justification

Scopes primarios detectados: `workflows/CI`, `scripts/tooling` y `repository configuration`.
`documentation` y `tests` son soporte.

Los tres no pueden entregarse por separado sin dejar el repositorio en un estado inconsistente
o inválido:

- El job `generate-sbom` (`workflows/CI`) invoca `scripts/supply-chain/generate-sbom.mjs`
  (`scripts/tooling`). Publicar el workflow sin el generador deja `backend-ci.yml` apuntando a
  un archivo inexistente; publicar el generador sin el workflow deja código muerto sin
  evidencia. Además, el workflow escribe en `sbom/`, que debe estar ignorado por `.gitignore`
  (`repository configuration`) en el mismo commit para que la corrida no ensucie el árbol.
- La cobertura Dependabot de `/frontend` (`repository configuration`) y la política que la
  gobierna forman la misma decisión de supply chain que el SBOM: separarlas produciría un PR
  de configuración sin política vigente y un PR de política que describe una configuración que
  todavía no existe.

Frontera de acoplamiento: los tres scopes comparten un único artefacto de decisión, el
[SBOM RFC](../architecture/supply-chain-sbom-rfc.md), y una única fuente normativa, la
[Supply-Chain Policy](../governance/supply-chain-policy.md).

Frontera de rollback: revertir el PR completo. No hay dependencias, lockfile, schema ni estado
productivo involucrados, por lo que el rollback es puramente textual y atómico.

## 6. Architecture Decision

El cambio toca `.github/workflows/**`, lo que activa el contrato `Architecture Decision`. No
existía un ADR/RFC aplicable: `ci-always-run-gates-rfc.md` gobierna la estructura de gates
required, no la generación de evidencia de supply chain. Se creó por eso el
[SBOM RFC](../architecture/supply-chain-sbom-rfc.md), que registra la decisión durable de
generar el SBOM sin dependencia persistente ni action externa nueva, y la semántica no
bloqueante del job.

## 7. Validaciones locales

| Validación | Estado | Nota |
| --- | --- | --- |
| `node scripts/governance/workflow-security-validator.mjs` | `PASSED` | 7 workflows, 28 external actions, 1 excepción de contenedor; exit 0 |
| Parseo de `.github/dependabot.yml` | `PASSED` | `js-yaml` con `maxAliases: 0`; `version: 2` y tres entradas |
| Contratos Dependabot positivos y negativos | `PASSED` | Separación de ecosistemas, agrupación minor+patch, ausencia de automerge |
| Contrato de permisos mínimos | `PASSED` | Top-level `contents: read`; cero permisos a nivel de job |
| Contrato de actions SHA-pinned | `PASSED` | 4 referencias del job SBOM con SHA de 40 caracteres |
| Contrato de artifact path y retención | `PASSED` | `sbom-cyclonedx`, path único, `retention-days: 90`, `if-no-files-found: error` |
| Contrato de SBOM no required | `PASSED` | `generate-sbom` sin `needs`, sin dependientes y fuera de los cuatro contextos required |
| Contrato anti `continue-on-error` | `PASSED` | Ausente en `backend-ci.yml`, junto con `\|\| true` |
| Contrato anti versiones flotantes | `PASSED` | Sin `pnpm dlx`, `npx`, `npm install -g`, `curl`, `\| sh` |
| Contrato de generador determinista | `PASSED` | Dos generaciones byte-idénticas; sin `serialNumber` ni `timestamp` |
| `test/unit/infrastructure/supply-chain-governance-contract.test.ts` | `PASSED` | 21 tests |
| `test/unit/infrastructure/workflow-security-policy-contract.test.ts` | `PASSED` | Digest realineado |
| `test/unit/infrastructure/backend-ci-workflow.test.ts` | `PASSED` | Sin cambios necesarios |
| `test/architecture/toolchain-contract.test.ts` | `PASSED` | Sin cambios necesarios |
| `pnpm validate:local` | `PASSED` | 4.102 tests, 4.101 pass, 1 skip, 0 fail; typecheck, typecheck:test y build en verde |
| `pnpm audit --prod` | `PASSED` | `No known vulnerabilities found`; ejecutado pese a no tocar manifiestos |
| `pnpm audit` | `PASSED` | `No known vulnerabilities found` |
| `git diff --check` | `PASSED` | exit 0 |
| `pnpm install --frozen-lockfile` | `NOT_RUN` | Manifiesto y lockfile sin cambios |
| `pnpm security:public-surface` | `NOT_RUN` | Sin cambios en superficie pública |
| Cohortes E2E / Playwright locales | `NOT_RUN` | Sin cambios de frontend ni visuales; ver §7.2 para `E2E Completeness` remoto |
| `pnpm db:migrate` | `NOT_RUN` | Sin cambios de schema ni migraciones |
| Generación real del artifact SBOM en CI | `VERIFIED` (2026-08-02) | Ver §7.2; superseded del `NOT_RUN` registrado el 2026-08-01 |
| Mutación de Dependabot security updates | `ENABLED_VERIFIED` (2026-08-02) | Ver §7.2; superseded del `NOT_RUN` registrado el 2026-08-01 |

### 7.2 Evidencia remota final (2026-08-02)

Verificación observada sobre PR #1630, head `89d00f7d9c8a4430d8f8dc209f2e0252c09ad139`, estado
`OPEN`, 14/14 archivos del scope declarado, `mergeable: MERGEABLE`; los archivos de dashboard
permanecen ausentes del diff del PR.

| Item | Evidencia |
| --- | --- |
| Contextos required | `validate-pr-governance`, `validate-backend`, `validate-frontend`, `qga-workflow-security` — los cuatro únicos en `SUCCESS` |
| `E2E Completeness` | run `30770495510`, job `91556690305`, `SUCCESS` |
| Backend CI (`pull_request`) | run `30770495535`, head exacto `89d00f7d9c8a4430d8f8dc209f2e0252c09ad139`, `SUCCESS` |
| Job `generate-sbom` | job `91556690313`, `SUCCESS` |
| Artifact SBOM | ID `8840354235`, nombre `sbom-cyclonedx`, 59515 bytes, digest `sha256:94636f161cbf015708cad8c79bd29ca40e90b615862282866a724f1e7720ecc9`, SHA-256 del archivo descargado `6e355dfbb36d9e6486ce0c3a553936cadfde0050bc9066c2b8a03caab37e2dd6`, CycloneDX 1.6, 618 package components, deployables no duplicados en `document.components` |
| Review thread | `PRRT_kwDOR5qlsc6VrJFz`, comentario raíz `3696706464`, respuesta `3700543458`, estado final `RESOLVED`; la implementación correctiva permanece en el head actual |
| Vulnerability alerts | `ENABLED`, verificado por lectura administrativa (`LABVETNEB`) |
| Dependabot security updates | pre-estado `enabled=false`, `paused=false`; estado final `enabled=true`, `paused=false`; verificado 2026-08-02 |

Esta evidencia no constituye escaneo de vulnerabilidades privadas, despliegue ni verificación
de runtime; es lectura de estado de CI, artifact y configuración de GitHub.

### 7.1 Evidencia local del generador

Ejecución local de `node scripts/supply-chain/generate-sbom.mjs`: documento CycloneDX 1.6 con
618 componentes de paquete, 46 marcados `direct` y 572 `transitive`, 0 componentes sin digest
de integridad. El archivo queda en `sbom/`, ignorado por git y ausente del diff.

El sujeto del BOM es la plataforma/monorepo `portal-vetneb`, no un deployable individual. Los
dos deployables cuelgan de él como aplicaciones explícitas:

| Deployable | Manifiesto | Nombre | Versión | purl |
| --- | --- | --- | --- | --- |
| Backend | `package.json` | `portal-vetneb-backend` | `2.1.0` | `pkg:npm/portal-vetneb-backend@2.1.0` |
| Frontend | `frontend/package.json` | `portal-vetneb-frontend` | `1.0.0` | `pkg:npm/portal-vetneb-frontend@1.0.0` |

Nombre, versión y purl se derivan dinámicamente de cada manifiesto; no hay valores
hardcodeados ni fallbacks. Los dos deployables viven en `metadata.component.components` y no
inflan el inventario: `document.components` conserva exactamente los 618 paquetes del lockfile.
La representación describe composición declarada, **no** prueba despliegue ni runtime.

Corrección aplicada tras el review thread `PRRT_kwDOR5qlsc6VrJFz` (P2) sobre
`scripts/supply-chain/generate-sbom.mjs:186`: el sujeto anterior declaraba únicamente
`pkg:npm/portal-vetneb-backend@2.1.0` mientras el inventario cubría el lockfile combinado, lo
que atribuía paquetes exclusivos de frontend (`next`, `react`) al backend y omitía
`portal-vetneb-frontend` como aplicación.

Estado previo (2026-08-01): el artifact remoto `sbom-cyclonedx` verificado hasta ese momento
pertenecía al head anterior `7f96c5e16bc65817f6b3c6231e7fa0ed7512293b` y **no** reflejaba esta
corrección. Su estado quedó registrado como `NOT_RUN` hasta regenerarse tras el push correctivo.

Verificación final (2026-08-02): el job `generate-sbom` (job `91556690313`, `SUCCESS`) del
run de Backend CI `30770495535` produjo el artifact contra el head final
`89d00f7d9c8a4430d8f8dc209f2e0252c09ad139` (`pull_request`, mismo head verificado en PR #1630).
Artifact ID `8840354235`, nombre `sbom-cyclonedx`, tamaño 59515 bytes, digest del artifact
`sha256:94636f161cbf015708cad8c79bd29ca40e90b615862282866a724f1e7720ecc9`, SHA-256 del archivo
descargado `6e355dfbb36d9e6486ce0c3a553936cadfde0050bc9066c2b8a03caab37e2dd6`. El documento
observado es CycloneDX 1.6, aplicación agregada `portal-vetneb`, con los dos deployables
anidados (`portal-vetneb-backend` `2.1.0`, `portal-vetneb-frontend` `1.0.0`), 618 package
components y sin duplicación de los deployables en `document.components`. Esta verificación
confirma la corrección del review thread sobre el head final; no constituye escaneo de
vulnerabilidades ni evidencia de runtime/despliegue.

## 8. Estado de `ERM-CTRL-024`

Estado previo (2026-08-01), preservado como histórico:

```text
ERM-CTRL-024: PARTIAL
Dependabot security updates: NOT_RUN
Frontend coverage config: IMPLEMENTED_LOCAL
Risk grouping: IMPLEMENTED_LOCAL
Supply-chain policy: IMPLEMENTED_LOCAL
SBOM workflow: IMPLEMENTED_LOCAL / NOT_VERIFIED_REMOTE
SBOM artifact: NOT_RUN
Workflow SHA pinning: IMPLEMENTED
qga-workflow-security: REQUIRED
Production readiness: PARTIAL/BLOCKED
```

Estado final (2026-08-02), tras verificación remota completa (§7.2):

```text
ERM-CTRL-024: IMPLEMENTED
Dependabot security updates: ENABLED_VERIFIED (enabled=true, paused=false)
Frontend coverage config: IMPLEMENTED_VERIFIED
Risk grouping: IMPLEMENTED_VERIFIED
Supply-chain policy: IMPLEMENTED
SBOM workflow: IMPLEMENTED_VERIFIED_REMOTE
SBOM artifact: VERIFIED (artifact 8840354235, run 30770495535, job 91556690313)
Workflow SHA pinning: IMPLEMENTED
qga-workflow-security: REQUIRED
Review thread PRRT_kwDOR5qlsc6VrJFz: RESOLVED
Production readiness: PARTIAL/BLOCKED (sin cambios; fuera de alcance de este control)
```

El control se promueve a `IMPLEMENTED`. Los tres closure criteria observados: security updates
habilitados y verificados por readback administrativo, cobertura frontend `/frontend`
contract-verified y evidencia de SBOM observada contra el head final del PR. `ERM-DEP-001`
permanece `OPEN` como seguimiento operativo del primer PR real de Dependabot contra
`frontend/package.json`, que todavía no se observó.

## 9. Riesgos residuales

Riesgos previos eliminados de esta lista tras verificación (2026-08-02): la desactivación de
Dependabot security updates y la ausencia del artifact SBOM remoto quedaron resueltas por la
evidencia de §7.2 y ya no son riesgos residuales.

1. **El generador es código propio.** Un cambio de formato de `pnpm-lock.yaml` (por ejemplo un
   `lockfileVersion` nuevo) podría degradar la salida. Está cubierto por contratos, pero no por
   un validador CycloneDX externo.
2. **El SBOM refleja el lockfile, no el runtime.** No detecta código vendorizado, cargado
   dinámicamente ni dependencias del sistema operativo del runner.
3. **La agrupación aumenta el tamaño de los PR de minor/patch.** Un fallo dentro de un grupo
   obliga a revertir el grupo completo o a desagruparlo manualmente.
4. **`backend-ci.yml` gana un job por PR y por push**, con su coste de instalación.
5. **Deriva del digest revisado.** Todo cambio futuro de `backend-ci.yml` obliga a recalcular
   `canonicalWorkflowDigests`; omitirlo rompe `qga-workflow-security`.
6. **Production readiness sigue `PARTIAL/BLOCKED`.** Este slot no la modifica.
7. **Primer canary `/frontend` pendiente.** La cobertura Dependabot de `frontend/package.json`
   está configurada y contract-verified, pero todavía no se observó un PR real de Dependabot
   abierto contra ese manifiesto. `ERM-DEP-001` permanece `OPEN` hasta esa observación.

## 10. Rollback lógico

Revertir el PR completo restaura:

- `.github/dependabot.yml` a dos entradas sin agrupación;
- `.github/workflows/backend-ci.yml` sin el job `generate-sbom`, con su digest previo
  `e696873b397ae05da365e436c9e150bef7a98517cdce545a9a9549252b1037b3`;
- `.gitignore` sin `sbom/`;
- `test/unit/infrastructure/workflow-security-policy-contract.test.ts` a su estado anterior;
- la eliminación del generador, sus declaraciones, su contrato y los documentos nuevos.

No hay dependencias, lockfile, schema, migraciones, datos ni configuración productiva
involucrados. El rollback no requiere acción sobre GitHub settings, salvo que la mutación R2
de Dependabot security updates ya se hubiera ejecutado: esa habilitación es independiente del
PR y se revierte por separado desde settings.

## 11. Punto de detención declarado

Estado previo (2026-08-01), preservado como histórico:

```text
SLOT 16 LOCAL IMPLEMENTATION: APPLIED
LOCAL VALIDATIONS: PASSED
GITHUB SETTINGS MUTATION: NOT_RUN
COMMIT: NOT_RUN
PUSH: NOT_RUN
PR: NOT_RUN
REMOTE CI: NOT_RUN
SBOM ARTIFACT: NOT_RUN
MERGE: NOT_RUN
ERM-CTRL-024: PARTIAL
PRODUCTION READINESS: PARTIAL/BLOCKED
```

Estado final (2026-08-02):

```text
LOCAL IMPLEMENTATION: PASSED
REMOTE CI: PASSED
E2E: PASSED
SBOM: VERIFIED
THREAD: RESOLVED
VULNERABILITY ALERTS: ENABLED_VERIFIED
DEPENDABOT SECURITY UPDATES: ENABLED_VERIFIED
MERGE: NOT_RUN
ERM-CTRL-024: IMPLEMENTED
PRODUCTION READINESS: PARTIAL/BLOCKED
```

El slot 18 no se inicia. El roadmap enterprise no se declara cerrado. El merge de PR #1630
queda como acción manual pendiente de Nico.
