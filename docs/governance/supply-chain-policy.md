# Supply-Chain Policy

| Campo | Valor |
| --- | --- |
| Document owner | Security / Dependency owner |
| Domain | Dependency and supply-chain governance |
| Lifecycle status | ACTIVE |
| Authoritative source role | Fuente normativa vigente para gobernanza de dependencias, Dependabot, actions pinneadas y SBOM; complemento de [VETNEB Sources of Truth](../SOURCES_OF_TRUTH.md) y del [Enterprise Control Register](./enterprise-control-register.md) |
| Effective date | 2026-08-01 |
| Last verified date | 2026-08-02 |
| Review cadence | Mensual para dependencias; trimestral para la política |
| Supersedes | Ninguno |
| Superseded by | Ninguno |
| Related controls or gaps | `ERM-CTRL-024`; `ERM-DEP-001` |
| Evidence or approval reference | `PR-DEPS-SUPPLY-CHAIN-GOVERNANCE` (Plan B slot 16); [SBOM RFC](../architecture/supply-chain-sbom-rfc.md); [closeout](../audit/pr-deps-supply-chain-governance-audit.md) |

## 1. Propósito

Esta política define cómo se gobiernan las dependencias de `LABVETNEB/PORTAL-VETNEB`: quién
es responsable, con qué cadencia se revisan, cómo se clasifica el riesgo de cada update, qué
validaciones son obligatorias, cómo se tratan las GitHub Actions pinneadas por SHA y qué rol
cumple el SBOM como evidencia.

No implementa enforcement por sí sola. El enforcement efectivo vive en
`.github/dependabot.yml`, `scripts/governance/workflow-security-validator.mjs`, los contratos
de `test/` y la configuración real de GitHub.

## 2. Alcance

Aplica a:

- dependencias npm de la raíz (`package.json`, `pnpm-lock.yaml`);
- dependencias npm del workspace frontend (`frontend/package.json`);
- GitHub Actions referenciadas en `.github/workflows/**`;
- configuración de Dependabot;
- generación y publicación del SBOM.

No aplica a: schema, migraciones, runtime backend/frontend, auth, sesiones, RLS, entornos de
GitHub, branch protection ni configuración productiva. Esos dominios conservan sus propias
fuentes rectoras.

## 3. Ownership por rol

Los owners son roles, no personas.

| Rol | Responsabilidad mínima |
| --- | --- |
| Security / Dependency owner | Mantiene esta política, triaje de security updates, clasificación de riesgo y decisión sobre majors. |
| CI owner | Mantiene `.github/dependabot.yml`, workflows, pinning por SHA y el allowlist de actions aprobadas. |
| Backend owner | Valida el impacto de dependencias raíz sobre runtime, build y tests backend. |
| Frontend / QA owner | Valida el impacto de dependencias del workspace frontend sobre lint, typecheck, build y E2E. |
| Repository admin | Ejecuta mutaciones de settings de GitHub (Dependabot security updates, Actions policy). Es la única vía para esos cambios. |
| PR author | Declara scope, validaciones ejecutadas con estado canónico y rollback. |

## 4. Cadencia de revisión

| Actividad | Cadencia |
| --- | --- |
| Dependabot version updates (npm raíz, npm frontend, GitHub Actions) | Semanal, según `schedule.interval: weekly`. |
| Triaje de security updates | Al aparecer; sin esperar a la ventana semanal. |
| Revisión de esta política | Trimestral, y ante cambios de ecosistema, gestor de paquetes o política de Actions. |
| Revisión de `ERM-CTRL-024` | Mensual para dependencias, trimestral para política. |

Una revisión vencida se registra como deuda visible. No se declara ejecutada sin evidencia.

## 5. Separación entre dependency PRs y cambios funcionales

- Un PR de dependencias no incorpora refactors, cambios de comportamiento, migraciones,
  cambios de CI no derivados del propio update ni limpiezas oportunistas.
- Un PR funcional no actualiza dependencias "de paso".
- Un update que exige un cambio de código para compilar o pasar tests declara ese cambio
  explícitamente, lo limita al mínimo necesario y lo justifica en el PR.
- Los realineamientos que un update rompe legítimamente (contratos, censos, digests de
  workflow) se corrigen en el mismo PR y nunca se debilitan ni se marcan como skip.

## 6. Separación de ecosistemas

npm raíz, npm frontend y GitHub Actions son ecosistemas distintos y se gobiernan por separado:

| Ecosistema | Directorio | Manifiesto | Validación primaria |
| --- | --- | --- | --- |
| npm | `/` | `package.json`, `pnpm-lock.yaml` | `pnpm audit --prod`, `pnpm audit`, `pnpm validate:local` |
| npm | `/frontend` | `frontend/package.json` | lint, typecheck, build y cohorte E2E aplicable |
| github-actions | `/` | `.github/workflows/**` | `workflow-security-validator.mjs` y contratos de digest |

PROHIBIDO agrupar updates que crucen estos límites. Un grupo de Dependabot nunca mezcla npm
con GitHub Actions, ni raíz con frontend, porque sus validaciones y sus dueños difieren.

## 7. Clasificación de riesgo

| Clase | Definición | Tratamiento |
| --- | --- | --- |
| `SECURITY` | Corrige una vulnerabilidad conocida. | Máxima prioridad. PR aislado salvo que el fix exija coordinación explícita. Se documenta el aviso sin exponer datos privados de alertas. |
| `MAJOR` | Cambio de major. Puede romper contrato. | PR individual siempre. Nunca agrupado. Requiere lectura de changelog, evaluación de breaking changes y validación completa del dominio. |
| `MINOR` | Añade funcionalidad compatible. | Agrupable dentro del mismo ecosistema y directorio. |
| `PATCH` | Corrección compatible. | Agrupable dentro del mismo ecosistema y directorio. |

La agrupación configurada es determinista: un grupo por ecosistema/directorio, restringido a
`applies-to: version-updates` y `update-types: [minor, patch]`.

## 8. Reglas de actualización

- **Security fixes**: se aplican con prioridad sobre cualquier update de versión. Si un fix
  exige un major, se trata como major y no se acelera saltando validaciones.
- **Majors**: nunca automáticos, nunca agrupados, nunca merge sin validación completa del
  dominio afectado y sin rollback declarado.
- **Minors y patches**: agrupables por ecosistema y directorio; requieren las validaciones
  del dominio afectado.
- **Overrides**: los `overrides` de `pnpm-workspace.yaml` que existen para cerrar avisos de
  seguridad no se eliminan sin evidencia de que el aviso ya no aplica; están anclados por
  `test/architecture/toolchain-contract.test.ts`.
- **Package manager**: la versión de pnpm la fija `packageManager` en `package.json` y está
  replicada en los workflows; cambiarla es un scope propio.

## 9. Requisitos de audit

- `pnpm audit --prod` y `pnpm audit` son obligatorios en CI en cada corrida de
  `backend-heavy-validation`, y localmente en todo cambio que toque manifiestos o lockfile.
- Un audit no ejecutado se reporta `NOT_RUN` o `BLOCKED`. Nunca se declara cobertura
  equivalente sin haberla ejecutado.
- Un audit fallido no se silencia con `continue-on-error`, `|| true` ni flags de exclusión
  añadidos para pasar el gate.

## 10. Requisitos de lockfile

- `pnpm-lock.yaml` es la fuente de resolución. Todo cambio de manifiesto debe llegar con el
  lockfile regenerado y coherente.
- `pnpm install --frozen-lockfile` debe pasar antes de abrir el PR y es lo que ejecuta CI.
- PROHIBIDO editar el lockfile a mano, regenerarlo con otro gestor o commitear un lockfile
  parcialmente resuelto.
- El lockfile no se toca en PRs que no cambian dependencias.

## 11. Requisitos de pruebas

Los gates se seleccionan por los paths realmente cambiados:

| Cambio | Gates mínimos |
| --- | --- |
| `package.json` / `pnpm-lock.yaml` | `pnpm audit --prod`, `pnpm audit`, `pnpm validate:local` |
| `frontend/package.json` | audits, `pnpm --dir frontend lint`, `typecheck`, `build`, `pnpm security:public-surface`, cohorte E2E aplicable |
| `.github/workflows/**` | `workflow-security-validator.mjs`, contratos de workflow y digest, `pnpm test` |
| `.github/dependabot.yml` | contratos positivos y negativos de Dependabot |

Todo gate reporta exactamente un estado canónico: `PASSED`, `FAILED`, `NOT_RUN`,
`NOT_AVAILABLE` o `BLOCKED`.

## 12. Estrategia de rollback

- El rollback primario de un dependency PR es revertir el PR: manifiesto y lockfile vuelven
  al estado anterior en un solo commit.
- Si el update ya está en `main` y produce una regresión productiva, se revierte primero y se
  diagnostica después.
- Un update que no pueda revertirse limpiamente (por ejemplo porque arrastró un cambio de
  código) debe declarar su frontera de rollback en el PR antes del merge.
- Los overrides de seguridad se conservan durante el rollback salvo decisión explícita.

## 13. GitHub Actions pinneadas por SHA

- Toda action externa se referencia por SHA de 40 caracteres en minúsculas, con el tag como
  comentario. Tags, ramas y expresiones dinámicas están prohibidos.
- Solo pueden usarse los repositorios declarados en `APPROVED_EXTERNAL_ACTIONS`
  (`scripts/governance/workflow-security-policy.mjs`).
- Las imágenes de contenedor se pinnean por digest `sha256` o corresponden a una excepción
  declarada exactamente en `CONTAINER_IMAGE_POLICY`.
- `permissions` de nivel superior es exactamente `contents: read`. No existen excepciones de
  permisos a nivel de job.

## 14. Procedimiento cuando Dependabot propone cambiar una action pinneada

Un PR de Dependabot sobre `github-actions` **no se mergea tal cual**. Secuencia obligatoria:

1. Verificar que el repositorio de la action sigue estando en `APPROVED_EXTERNAL_ACTIONS`.
2. Verificar que el nuevo ref es un SHA de 40 caracteres en minúsculas que corresponde al tag
   anunciado en el propio repositorio de la action.
3. Alinear en el mismo cambio los anclajes que el bump rompe: `pinnedActionReferences` y
   `canonicalWorkflowDigests` en
   `test/unit/infrastructure/workflow-security-policy-contract.test.ts`, y los anclajes de SHA
   en `test/architecture/toolchain-contract.test.ts` y los contratos de workflow afectados.
4. Entregar el cambio como PR humano con scope `workflows/CI`, porque toca workflows y
   contratos, no solo un manifiesto.
5. Cerrar el PR del bot como superseded, referenciando el PR humano.
6. Ejecutar `workflow-security-validator.mjs` y los contratos de workflow antes del merge.

PROHIBIDO actualizar el digest revisado de un workflow sin revisar el diff real del workflow.

## 15. Prohibición de merge automático

- El merge automático está prohibido para cualquier PR de dependencias, incluidos security
  updates y patches.
- No se habilita auto-merge en `.github/dependabot.yml` ni en settings del repositorio.
- `--admin` para eludir required checks está prohibido siempre.
- Todo dependency PR pasa por los cuatro required contexts antes del merge.

## 16. Prohibición de mezclar scopes no relacionados

- Un PR de dependencias mantiene un scope primario.
- La excepción mixed-scope existe, exige enumerar cada scope afectado y justificar por qué los
  dominios no pueden entregarse por separado, con frontera de acoplamiento y de rollback.
- Conveniencia, prisa o "ya que estoy" no son justificación.

## 17. SBOM como evidencia no bloqueante

- El SBOM se genera en formato CycloneDX desde `pnpm-lock.yaml` mediante
  `scripts/supply-chain/generate-sbom.mjs`.
- El job `generate-sbom` de `.github/workflows/backend-ci.yml` es estructuralmente no
  bloqueante: ningún job depende de él y el contexto required `validate-backend` no observa su
  resultado.
- El SBOM **no** es un required check y no se convierte en uno sin una decisión separada y
  aprobada.
- No se usa `continue-on-error` para ocultar fallos estructurales: un fallo de generación es
  visible aunque no bloquee el merge.
- El artifact `sbom-cyclonedx` tiene retención explícita de 90 días.
- El SBOM no se versiona: `sbom/` está en `.gitignore`.
- El SBOM es evidencia de composición derivada del lockfile. No es un escaneo de runtime, no
  detecta código vendorizado y no sustituye a `pnpm audit`.

## 18. Criterios de reapertura

Esta política y `ERM-CTRL-024` se reabren o revalidan ante cualquiera de estos disparadores:

- cambio del gestor de paquetes, de la versión pinneada de pnpm o del formato de lockfile;
- alta o baja de un ecosistema, workspace o directorio con dependencias propias;
- cambio de `APPROVED_EXTERNAL_ACTIONS`, de la política de permisos o de la política de
  Actions del repositorio;
- deriva de los required checks o de branch protection;
- habilitación o desactivación de Dependabot security updates;
- aparición de un merge automático, de un `continue-on-error` sobre un gate de dependencias o
  de un bypass de required checks;
- evidencia de que el SBOM dejó de generarse, dejó de ser reproducible o pasó a bloquear;
- incidente de seguridad con origen en una dependencia o en una action.

## 19. Estado no declarable sin evidencia

PROHIBIDO declarar como ejecutado, habilitado o cerrado cualquier item sin evidencia
observada. En particular:

- Dependabot security updates solo se declara `ENABLED` tras un readback administrativo
  posterior a la mutación.
- El artifact SBOM solo se declara producido tras observar una corrida real de CI.
- Un control no se promueve a `IMPLEMENTED` sin todos sus closure criteria observados.

## 20. Historial

| Fecha | Cambio | Estado resultante | Evidencia |
| --- | --- | --- | --- |
| 2026-08-01 | Creación inicial de la política de supply chain | `ACTIVE` al aprobarse el PR | `PR-DEPS-SUPPLY-CHAIN-GOVERNANCE`; `ERM-CTRL-024` permanece `PARTIAL` |
| 2026-08-02 | Verificación remota final del slot 16 | `ACTIVE`; vulnerability alerts habilitados y verificados; Dependabot security updates habilitados y verificados (`enabled=true`, `paused=false`); artifact SBOM verificado remotamente (ID `8840354235`, run `30770495535`, job `91556690313`); `ERM-CTRL-024` promovido a `IMPLEMENTED` | [Auditoría del slot 16](../audit/pr-deps-supply-chain-governance-audit.md); PR #1630 (head `89d00f7d9c8a4430d8f8dc209f2e0252c09ad139`); review thread `PRRT_kwDOR5qlsc6VrJFz` `RESOLVED` |
