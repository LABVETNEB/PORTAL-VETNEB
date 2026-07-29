# PR-SEC-REPO-SETTINGS Audit

Auditoría docs-only de baseline, elegibilidad y exposición pública para el
bloque enterprise `PR-SEC-REPO-SETTINGS`.

| Campo | Valor |
| --- | --- |
| Document owner | Security / Engineering governance |
| Domain | Repository secret protection and public security documentation |
| Lifecycle status | ACTIVE |
| Authoritative source role | Evidencia activa y closeout documental del bloque; registra configuración efectiva sanitizada sin reemplazar GitHub como fuente técnica |
| Effective date | 2026-07-29 |
| Last verified date | 2026-07-29 |
| Review cadence | Trimestral y ante cada cambio de settings, titularidad o producto |
| Supersedes | Ninguno |
| Superseded by | Ninguno |
| Related controls or gaps | `ERM-CTRL-016`; `GAP-P0-1`; `PR-SEC-0`; `PR-SEC-2` |
| Evidence or approval reference | PR #1591, merge commit `9479f6d36dd6dfa1ed25a81beacb22e1bed98f34`; habilitación R2 del 2026-07-29 y dos lecturas administrativas independientes coincidentes |
| Document classification | PUBLIC_SANITIZED |

## 1. Resumen ejecutivo

`PR-SEC-REPO-SETTINGS` queda cerrado documentalmente después de la aprobación
y merge de la fase documental mediante PR #1591, la habilitación R2 de las dos
features elegibles y dos lecturas administrativas independientes coincidentes
del 2026-07-29.

- secret scanning básico y repository push protection están `enabled`;
- validity checks y non-provider patterns permanecen `disabled` y se
  clasifican `NOT_AVAILABLE` bajo titularidad y producto actuales;
- no hubo drift entre las dos lecturas de las features avanzadas;
- la gestión restringida de alertas no fue ejecutada ni requerida para probar
  la configuración efectiva;
- la evidencia runtime cross-tenant, tenant/session, RLS runtime, staging y
  producción permanece fuera de scope y abierta.

## 2. Baseline histórica anterior

### 2.1 Repositorio local

| Atributo | Valor |
| --- | --- |
| Rama base | `main` |
| Commit base | `f2d8e05ef75aa91d27c1832489a4b94b723bd84a` |
| Commit `origin/main` | `f2d8e05ef75aa91d27c1832489a4b94b723bd84a` |
| Rama de trabajo | `docs/pr-sec-repo-settings` |
| Working tree inicial | limpio |
| Worktrees | 1 |

### 2.2 Configuración administrativa

Lectura de solo lectura limitada a campos no sensibles, verificada el
2026-07-29:

| Atributo | Estado |
| --- | --- |
| Visibilidad | `public` |
| Tipo de owner | `User` |
| `secret_scanning` | `disabled` |
| `secret_scanning_push_protection` | `disabled` |
| `secret_scanning_validity_checks` | `disabled` |
| `secret_scanning_non_provider_patterns` | `disabled` |

No se almacenó una respuesta API completa, inventario de alertas, token ni
valor de secreto.

Esta baseline conserva el estado inmediatamente anterior a la habilitación R2.
No representa el estado operativo actual y no se reemplaza para simular
continuidad histórica.

### 2.3 Estado efectivo posterior

La habilitación R2 se ejecutó el 2026-07-29 mediante un archivo `.ps1`
independiente, fail-fast y con rollback automático preparado. No se ejecutó
rollback. Dos lecturas administrativas independientes posteriores coincidieron
en los siguientes estados sanitizados:

| Atributo | Estado efectivo | Clasificación |
| --- | --- | --- |
| `secret_scanning` | `enabled` | `ENABLED` |
| `secret_scanning_push_protection` | `enabled` | `ENABLED` |
| `secret_scanning_validity_checks` | `disabled` | `NOT_AVAILABLE` bajo titularidad/producto actual |
| `secret_scanning_non_provider_patterns` | `disabled` | `NOT_AVAILABLE` bajo titularidad/producto actual |

Las lecturas se limitaron a campos de configuración no sensibles. No se
leyeron ni enumeraron alertas y no se conservaron respuestas administrativas
completas, rutas temporales, datos de autenticación ni valores de secretos.

## 3. Alcance

Incluido:

- baseline local y administrativa sanitizada;
- elegibilidad por feature contra documentación oficial vigente;
- auditoría de contenido de los seis archivos `docs/security/**`;
- perfil de clasificación, sanitización y revisión pre-merge;
- actualización de fuentes documentales e `ERM-CTRL-016`;
- criterio de cierre y siguiente paso.

Excluido:

- nuevas mutaciones de GitHub settings posteriores al estado efectivo
  documentado;
- alertas de secret scanning y respuesta a secretos reales;
- branch protection, Actions permissions, owner, plan, visibilidad o
  transferencia;
- backend, frontend, API, auth, cookies, sesiones, DB, schema, Drizzle,
  migraciones, tests, scripts, workflows, dependencias, manifiestos y lockfiles;
- evidencia runtime cross-tenant, RLS runtime, staging y producción.

## 4. Incidente previo, intento parcial y rollback histórico

Un intento anterior de mutación fue pegado línea por línea en PowerShell. El
guard lanzó una excepción, pero PowerShell continuó ejecutando comandos de
nivel superior posteriores y un PATCH alcanzó a aplicarse parcialmente.
`secret_scanning_validity_checks` permaneció `disabled`.

Los mensajes `PASSED` impresos después de la excepción eran incondicionales y
no constituyen evidencia. Se ejecutó rollback y una lectura independiente
posterior confirmó nuevamente los cuatro settings en `disabled`.

Control preventivo aplicado a la habilitación R2 posterior:

- ejecutar el cambio como archivo `.ps1` revisado o bloque atómico
  `& { ... }`;
- terminar ante la primera excepción;
- imprimir `PASSED` únicamente después de observar la condición esperada;
- verificar cada feature individualmente;
- reportar `NOT_AVAILABLE` sin intentar mutación cuando falte elegibilidad;
- efectuar una lectura independiente posterior y limitar la evidencia a
  estados sanitizados.

La ejecución autorizada posterior utilizó un archivo `.ps1` independiente,
fail-fast y con rollback preparado; las dos lecturas posteriores coincidieron
y no se ejecutó rollback. Este documento no contiene el script ni respuestas
administrativas completas.

## 5. Elegibilidad por feature

| Feature | Evidencia de elegibilidad | Clasificación del bloque |
| --- | --- | --- |
| Secret scanning básico | GitHub documenta secret scanning gratuito para repositorios públicos. | Elegible y `enabled` desde el 2026-07-29. |
| Repository push protection | GitHub permite habilitar push protection en el repositorio después de habilitar Secret Protection. | Elegible y `enabled` desde el 2026-07-29. |
| Validity checks | GitHub lo limita a repositorios de organización con GitHub Team y GitHub Secret Protection. El owner observado es `User`. | `NOT_AVAILABLE` bajo titularidad/producto actual. |
| Non-provider patterns | GitHub lo limita a repositorios de organización con GitHub Team y GitHub Secret Protection. El owner observado es `User`. | `NOT_AVAILABLE` bajo titularidad/producto actual. |

Fuentes oficiales:

- [Secret scanning](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/detect-secret-leaks/enable-secret-scanning)
- [Repository push protection](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/prevent-future-leaks/enable-push-protection)
- [Validity checks](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/customize-leak-detection/enable-validity-checks)
- [Non-provider patterns](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/detect-secret-leaks/enabling-secret-scanning-for-non-provider-patterns)

Una transferencia de titularidad no es una remediación implícita ni un
requisito de cierre para este bloque. Queda fuera de scope como decisión
estructural independiente.

## 6. Decisión sobre `docs/security/**`

La auditoría leyó los seis archivos rastreados completos. Todos se clasifican
`PUBLIC_SANITIZED`:

| Documento | Decisión |
| --- | --- |
| `docs/security/csp-reporting-rollout.md` | `PUBLIC_SANITIZED` |
| `docs/security/ENDPOINT_PERMISSION_MATRIX.md` | `PUBLIC_SANITIZED` |
| `docs/security/ENDPOINT_TEST_MATRIX.md` | `PUBLIC_SANITIZED` |
| `docs/security/RBAC_MATRIX.md` | `PUBLIC_SANITIZED` |
| `docs/security/rls-enforcement-matrix.md` | `PUBLIC_SANITIZED` |
| `docs/security/security-sessions-tenant-rls-audit.md` | `PUBLIC_SANITIZED` |

La decisión se apoya en que documentan arquitectura defensiva, actores,
endpoints contractuales, boundaries, pruebas, guardrails, estados, gaps y
criterios NO-GO sin incorporar valores de secretos, credenciales, sesiones
reales, hashes derivados de credenciales, signed URLs completas, datos
clínicos/comerciales, evidencia runtime identificable ni instrucciones
accionables de explotación.

No se modificaron esos seis documentos porque no se encontró contradicción,
exposición concreta ni link inválido dentro del scope.

La política detallada queda en
[Public Repository Exposure Profile](../security/public-repository-exposure-profile.md).

## 7. Riesgos y mitigaciones

| Riesgo | Estado | Mitigación |
| --- | --- | --- |
| Secreto publicado sin detección a nivel repositorio | Mitigado parcialmente: secret scanning y push protection están `enabled`; la respuesta a alertas es un proceso separado. | Revisión periódica de configuración y triaje restringido cuando corresponda. |
| Falsa expectativa de cuatro features habilitables | Mitigado documentalmente. | Validity checks y non-provider patterns figuran `NOT_AVAILABLE`. |
| Evidencia pública con valores sensibles | Mitigado documentalmente. | Perfil público `ACTIVE`, minimización, checklist y reglas de incidente. |
| Repetición de ejecución parcial en PowerShell | Mitigado para esta ejecución. | Archivo `.ps1` independiente, fail-fast, rollback preparado y verificación independiente. |
| Transferencia usada para mejorar una métrica | Fuera de scope. | No recomendar transferencia; tratarla como decisión estructural separada. |
| Gaps runtime interpretados como cerrados | Abierto y separado. | `ERM-CTRL-016` permanece `PARTIAL`; `ERM-SEC-001`, RLS runtime y staging no se cierran. |

## 8. Cambios documentales

| Archivo | Cambio |
| --- | --- |
| `docs/security/public-repository-exposure-profile.md` | Promueve el perfil normativo de clasificación y sanitización pública a `ACTIVE` y conserva la baseline histórica. |
| `docs/audit/pr-sec-repo-settings-audit.md` | Promueve la evidencia de bloque a `ACTIVE` y registra el closeout sanitizado. |
| `docs/SOURCES_OF_TRUTH.md` | Incorpora el perfil público como fuente vigente y retira la sección propuesta. |
| `docs/audit/README.md` | Mueve la auditoría al índice vigente y señala el bloque como cerrado. |
| `docs/governance/enterprise-control-register.md` | Registra la evidencia efectiva y el trabajo residual de `ERM-CTRL-016`, que permanece `PARTIAL`. |

Los seis documentos inventariados, los snapshots históricos y cualquier
archivo técnico permanecen sin cambios.

## 9. Rollback documental

El rollback consiste en retirar, mediante un cambio documental posterior
autorizado y revisado, la autoridad `ACTIVE` de los dos documentos y actualizar
sus referencias en los tres índices/registros según la Documentation Lifecycle
Policy. No requiere ni autoriza modificar settings, reescribir historial,
borrar evidencia histórica ni tocar archivos técnicos.

## 10. Criterio de cierre

El cierre de `PR-SEC-REPO-SETTINGS` satisface estos criterios:

1. el perfil público y esta auditoría fueron aprobados mediante PR #1591,
   mergeados y promovidos según la Documentation Lifecycle Policy;
2. una autorización R2 posterior habilitó `secret_scanning` y
   `secret_scanning_push_protection` el 2026-07-29;
3. dos lecturas independientes posteriores confirmaron ambas features en
   `enabled`;
4. validity checks y non-provider patterns permanezcan documentados como
   `NOT_AVAILABLE` mientras no cambien titularidad y producto;
5. la gestión de alertas, si existen, permanece como proceso restringido
   separado y no es necesaria para demostrar estos estados de configuración;
6. las validaciones documentales y la revisión de scope están en `PASSED`.

El cierre de este bloque no cierra `ERM-SEC-001`, evidencia cross-tenant, RLS
runtime, tenant/session, staging, producción ni otros controles de seguridad.

**PR-SEC-REPO-SETTINGS: CLOSED**

## 11. Validaciones

| Validación | Estado | Evidencia |
| --- | --- | --- |
| Inspección de paths cambiados | PASSED | Cinco archivos, todos dentro del scope documental aprobado. |
| Links Markdown relativos | PASSED | Targets relativos resueltos en los cinco archivos del diff. |
| Contenido sensible sobre líneas añadidas | PASSED | Revisión limitada al diff añadido con patrones seguros; sin valores sensibles detectados. |
| `git diff --check` | PASSED | Exit code 0; los archivos nuevos también pasaron revisión de whitespace y LF final. |
| Integridad de `ERM-CTRL-*` | PASSED | 25 filas, IDs `001..025` únicos y statuses permitidos. |
| Estado efectivo de secret protection | PASSED | Dos lecturas independientes coinciden: secret scanning y push protection `enabled`; las otras dos features `NOT_AVAILABLE`. |
| Triaje de alertas | NOT_RUN | Proceso restringido separado; no es necesario para demostrar la configuración efectiva y no se afirma que no existan alertas. |
| UTF-8 sin BOM | PASSED | Los cinco archivos verificados sin BOM. |
| Scope exclusivo docs-only | PASSED | Sin paths técnicos, históricos o fuera de los cinco candidatos. |
| Ausencia de `next-env.d.ts` modificado | PASSED | No aparece en el estado ni en los paths cambiados. |
| Ausencia de `playwright-report/` y `test-results/` | PASSED | Sin artefactos en el diff ni en las ubicaciones Playwright del repositorio. |
| Builds, tests y E2E | NOT_RUN | No seleccionados para un cambio docs-only. |

## 12. Estado y próximo paso exacto

Estado: auditoría y perfil `ACTIVE`; `PR-SEC-REPO-SETTINGS: CLOSED`; bloque
consolidado 02 cerrado. `ERM-CTRL-016` permanece `PARTIAL` porque la evidencia
runtime tenant/session y cross-tenant, RLS runtime y los gaps relacionados
siguen abiertos.

Próximo paso: `PR-SEC-SECRET-PATTERNS`, bloque 03 del Plan B, con scope ci-only,
riesgo medio-alto y autorización R2 separada. Toca el validador requerido y no
debe iniciarse dentro de este closeout.
