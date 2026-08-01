# PR-DEPS-SUPPLY-CHAIN-GOVERNANCE Audit (Plan B slot 16)

| Campo | Valor |
| --- | --- |
| Document owner | Security / Dependency owner |
| Domain | Dependency and supply-chain governance |
| Lifecycle status | ACTIVE |
| Authoritative source role | Closeout local del slot 16; evidencia, no política |
| Effective date | 2026-08-01 |
| Last verified date | 2026-08-01 |
| Review cadence | Ante cambios de Dependabot, workflows, SBOM o `ERM-CTRL-024` |
| Supersedes | Ninguno |
| Superseded by | Ninguno |
| Related controls or gaps | `ERM-CTRL-024`; `ERM-DEP-001` |
| Related sources | [Supply-Chain Policy](../governance/supply-chain-policy.md); [SBOM RFC](../architecture/supply-chain-sbom-rfc.md); [Enterprise Control Register](../governance/enterprise-control-register.md); [Consolidation plan](./enterprise-roadmap-consolidation-plan.md) |
| Baseline | `main@cdff7ad67f3e1314a75311d7482f4edcd4b36e11`, working tree limpio, 4 stashes preservados |

## 1. Alcance

`PR-DEPS-SUPPLY-CHAIN-GOVERNANCE` absorbe `PR-DEPS-1`, `PR-DEPS-2`, `PR-DEPS-3` y `PR-DEPS-4`
en una sola entrega con mixed-scope exception declarada.

| Sub-PR | Objetivo | Resultado local |
| --- | --- | --- |
| `PR-DEPS-1` | Dependabot security updates | `NOT_RUN` — mutación externa R2, entregada como bloque manual para el repository admin |
| `PR-DEPS-2` | Política de supply chain | `IMPLEMENTED_LOCAL` — `docs/governance/supply-chain-policy.md` |
| `PR-DEPS-3` | Cobertura Dependabot | `IMPLEMENTED_LOCAL` — npm `/`, npm `/frontend`, `github-actions` `/` con agrupación por riesgo |
| `PR-DEPS-4` | SBOM CycloneDX | `IMPLEMENTED_LOCAL` / `NOT_VERIFIED_REMOTE` — job no bloqueante y generador propio |

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
| Cohortes E2E / Playwright | `NOT_RUN` | Sin cambios de frontend ni visuales |
| `pnpm db:migrate` | `NOT_RUN` | Sin cambios de schema ni migraciones |
| Generación real del artifact SBOM en CI | `NOT_RUN` | Requiere corrida remota |
| Mutación de Dependabot security updates | `NOT_RUN` | R2 externo; bloque manual entregado a Nico |

### 7.1 Evidencia local del generador

Ejecución local de `node scripts/supply-chain/generate-sbom.mjs`: documento CycloneDX 1.6 con
618 componentes, 46 marcados `direct` y 572 `transitive`, 0 componentes sin digest de
integridad, raíz `pkg:npm/portal-vetneb-backend@2.1.0`. El archivo queda en `sbom/`, ignorado
por git y ausente del diff.

## 8. Estado de `ERM-CTRL-024`

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

El control **no** se promueve a `IMPLEMENTED`. Sus closure criteria exigen security updates
habilitados y verificados, cobertura frontend verificada y evidencia de SBOM observada; dos de
esos tres dependen de evidencia remota que todavía no existe.

## 9. Riesgos residuales

1. **Dependabot security updates siguen deshabilitados.** Es el riesgo dominante: los avisos
   de seguridad no generan PR automático hasta que el repository admin ejecute la mutación R2.
2. **El SBOM no está verificado en remoto.** El job está validado estructuralmente por
   contratos locales, pero ninguna corrida real de CI produjo todavía el artifact.
3. **El generador es código propio.** Un cambio de formato de `pnpm-lock.yaml` (por ejemplo un
   `lockfileVersion` nuevo) podría degradar la salida. Está cubierto por contratos, pero no por
   un validador CycloneDX externo.
4. **El SBOM refleja el lockfile, no el runtime.** No detecta código vendorizado, cargado
   dinámicamente ni dependencias del sistema operativo del runner.
5. **La agrupación aumenta el tamaño de los PR de minor/patch.** Un fallo dentro de un grupo
   obliga a revertir el grupo completo o a desagruparlo manualmente.
6. **`backend-ci.yml` gana un job por PR y por push**, con su coste de instalación.
7. **Deriva del digest revisado.** Todo cambio futuro de `backend-ci.yml` obliga a recalcular
   `canonicalWorkflowDigests`; omitirlo rompe `qga-workflow-security`.
8. **Production readiness sigue `PARTIAL/BLOCKED`.** Este slot no la modifica.

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

El slot 18 no se inicia. El roadmap enterprise no se declara cerrado.
