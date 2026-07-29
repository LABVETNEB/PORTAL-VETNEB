# PR-SEC-SECRET-PATTERNS Audit

Auditoría docs-only y closeout del bloque enterprise 03
`PR-SEC-SECRET-PATTERNS`, que consolidó `PR-SEC-1` y `PR-ARCH-1`.

| Campo | Valor |
| --- | --- |
| Document owner | Security / Engineering governance |
| Domain | Pull-request secret detection and architecture-decision governance |
| Lifecycle status | ACTIVE |
| Authoritative source role | Evidencia activa y closeout documental del bloque 03 |
| Effective date | 2026-07-29 |
| Last verified date | 2026-07-29 |
| Review cadence | Ante cambios del validador, template, workflow o clasificación de paths |
| Supersedes | Ninguno |
| Superseded by | Ninguno |
| Related controls or gaps | `ERM-CTRL-010`; `ERM-CTRL-016`; `ERM-ARC-001`; `GAP-P0-3`; `PR-SEC-1`; `PR-ARCH-1` |
| Evidence or approval reference | PR técnico #1593 y canarias #1594–#1599, verificadas por PR, head SHA y runs de GitHub Actions |
| Document classification | PUBLIC_SANITIZED |

## 1. Resumen ejecutivo

`PR-SEC-SECRET-PATTERNS` queda `CLOSED`.

La implementación técnica se integró mediante PR #1593. El validador requerido
amplió la detección de credenciales del stack y agregó el contrato
`Architecture Decision` para cambios arquitectónicos. Las rutas positiva,
negativa y no-trigger quedaron demostradas con PRs descartables cerrados sin
merge.

El intento inicial #1596 se conserva como evidencia histórica de un diseño de
canaria incorrecto y no como fallo del gate `Architecture Decision`:

> Canary design attempt rejected by an independent M48 architecture census contract; PR Governance itself passed. The PR was closed without merge and the canary was redesigned to preserve file and LOC census.

El valor de credencial SMTP utilizado por la canaria negativa fue sintético.
Los logs identificaron únicamente la categoría `SMTP credential`; el valor no
fue impreso ni incorporado a esta documentación. La revisión sanitizada no
detectó marcadores de exposición sin enmascarar.

## 2. Baseline y alcance

| Atributo | Valor |
| --- | --- |
| Rama base del bloque | `main` |
| Base y squash técnico | `f3ae15c4edc03d338b52b950b78925fa980a9c06` |
| Rama documental | `docs/pr-sec-03-closeout` |
| Working tree inicial | limpio |
| Estado inicial de canarias | #1594–#1599 cerradas; ninguna mergeada |
| Estado inicial de ramas | sin ramas `canary/pr-sec-03-*` locales ni remotas |

Incluido:

- patrones de secretos implementados por #1593 y sus canarias positiva y
  negativa;
- gate `Architecture Decision` implementado por #1593 y sus rutas positiva,
  negativa y no-trigger;
- intento de diseño #1596, fallo independiente M48 y rediseño #1597;
- SHAs, runs, conclusiones, cierre sin merge y eliminación de ramas;
- actualización del estado operativo de `ERM-CTRL-010` y `ERM-CTRL-016`.

Excluido:

- bloque 04 y bloques 05–18;
- cambios de código, tests, workflows, dependencias, lockfiles, DB, Drizzle,
  migraciones, auth, cookies, sesiones o configuración productiva;
- staging, producción, deploys, settings, alertas reales y secretos reales.

## 3. Implementación técnica

PR #1593, `ci(governance): harden secret and architecture checks`, fue mergeado
el 2026-07-29. Su head fue
`febdf76da8d676299fc7c18452473177c3b44c7a` y el squash integrado en `main`
fue `f3ae15c4edc03d338b52b950b78925fa980a9c06`.

| Workflow | Run | Conclusión |
| --- | ---: | --- |
| PR Governance | [30469845203](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30469845203) | `success` |
| Backend CI (pull request) | [30469845657](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30469845657) | `success` |
| QGA Governance | [30469863764](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30469863764) | `success` |
| Backend CI (push del head) | [30469840452](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30469840452) | `success` |

El cambio técnico se limitó al template de PR, el validador y su declaración de
tipos, más los contratos unitarios de secret patterns, Architecture Decision y
single-scope. Este closeout no modifica esos archivos.

## 4. Matriz completa de canarias

| Canaria | PR | Head SHA | PR Governance | Backend CI | QGA Governance | Resultado |
| --- | ---: | --- | --- | --- | --- | --- |
| Secret positive | #1594 | `1bf3823b9eb3f05a39de9b524e2a0719b2d57f0a` | [30476162108](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30476162108) `success` | [30476162141](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30476162141) `success` | [30476162157](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30476162157) `success` | `PASSED` |
| Secret negative | #1595 | `2c2e0aee9b8524dcecbe6c3f6ee4d2b87cca5d31` | [30477040646](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30477040646) `failure` esperado | [30477040691](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30477040691) `success` | [30477040676](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30477040676) `success` | `PASSED` |
| Architecture positive, intento 1 | #1596 | `2ba6ab52e0a3eeac1975d1e5de8619116c726d62` | [30477351154](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30477351154) `success` | [30477357332](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30477357332) `failure` M48 | [30477357187](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30477357187) `success` | `FAILED` por diseño de canaria |
| Architecture positive v2 | #1597 | `4ba537a81a5fba714c4457bbf2db614b031fa38f` | [30479838207](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30479838207) `success` | [30479838283](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30479838283) `success` | [30479838491](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30479838491) `success` | `PASSED` |
| Architecture negative | #1598 | `f7692dd198abcdca7b824cbc53e5a73c9fe8d42f` | [30480308553](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30480308553) `failure` esperado | [30480308444](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30480308444) `success` | [30480308024](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30480308024) `success` | `PASSED` |
| Architecture non-trigger | #1599 | `952a9e5da2c28b66ab9db13d0d9e1e8b57f5e934` | [30481442459](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30481442459) `success` | [30481443222](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30481443222) `success` | [30481439340](https://github.com/LABVETNEB/PORTAL-VETNEB/actions/runs/30481439340) `success` | `PASSED` |

Las seis PR canaria están `CLOSED`, tienen `mergedAt: null` y sus ramas locales
y remotas fueron eliminadas.

## 5. Interpretación de resultados

### 5.1 Secret patterns

- #1594 demostró la ruta limpia.
- #1595 falló únicamente por `SMTP credential`, como se esperaba.
- Backend CI y QGA permanecieron en `success` en ambas rutas.
- El valor sintético no se expuso en logs ni en evidencia durable.

`GAP-P0-3` queda cerrado operativamente por evidencia posterior sin reescribir
el gap register histórico. `ERM-CTRL-016` conserva `PARTIAL` porque tenant
isolation, evidencia cross-tenant, RLS runtime y otros gaps de seguridad siguen
abiertos.

### 5.2 Architecture Decision

- #1597 demostró `Architecture trigger: true` y `Architecture Decision: PASS`
  con un cambio type-only que preservó file count, LOC no vacías y runtime.
- #1598 demostró el rechazo exacto:
  `Missing required ## Architecture Decision section for an architectural change.`
  Secret scan, metadata, scope, diff integrity y sensitive-file policy
  permanecieron en `PASS`; el fallo quedó aislado a `Architecture Decision`.
- #1599 demostró `Architecture trigger: false` y
  `Architecture Decision: N/A` para `server/lib/logger.ts`.
- #1596 no invalida el gate: PR Governance pasó y el contrato M48 rechazó de
  forma independiente el archivo nuevo no clasificado.

`ERM-ARC-001` queda cerrado operativamente y `ERM-CTRL-010` transiciona a
`IMPLEMENTED`.

## 6. Rollback documental

El rollback consiste en revertir únicamente este closeout y sus referencias en
los cuatro documentos de índice/estado. No autoriza revertir #1593, reabrir o
mergear canarias, recrear ramas, reescribir snapshots históricos ni modificar
controles técnicos.

## 7. Validaciones

| Validación | Estado | Evidencia |
| --- | --- | --- |
| PRs #1593–#1599 y `mergedAt` | `PASSED` | #1593 `MERGED`; #1594–#1599 `CLOSED` con `mergedAt: null`. |
| Runs por head SHA | `PASSED` | IDs y conclusiones de las tablas contrastados con GitHub Actions. |
| Fallos negativos aislados | `PASSED` | SMTP en #1595 y mensaje exacto Architecture Decision en #1598. |
| Sanitización del valor sintético | `PASSED` | Categoría registrada; valor no impreso ni persistido. |
| Ausencia de ramas canaria | `PASSED` | Cero ramas `canary/pr-sec-03-*` locales y remotas. |
| Allowlist documental | `PASSED` | Cinco documentos exactos. |
| `git diff --check` | `PASSED` | Exit code 0. |
| Link checker standalone | `NOT_AVAILABLE` | No existe script standalone; los links son validados por PR Governance. |
| Builds, tests y E2E | `NOT_RUN` | No seleccionados para este cambio docs-only. |
| DB, staging, producción y settings | `NOT_RUN` | Fuera de scope. |
| Bloque 04 | `NOT_RUN` | No iniciado ni autorizado por este closeout. |

## 8. Estado final

**PR-SEC-SECRET-PATTERNS: CLOSED**

**BLOQUE 03: CLOSED**

**BLOQUE 04: NOT_RUN**
