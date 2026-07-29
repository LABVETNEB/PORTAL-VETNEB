# PR-SEC-REPO-SETTINGS Audit

Auditoría docs-only de baseline, elegibilidad y exposición pública para el
bloque enterprise `PR-SEC-REPO-SETTINGS`.

| Campo | Valor |
| --- | --- |
| Document owner | Security / Engineering governance |
| Domain | Repository secret protection and public security documentation |
| Lifecycle status | PROPOSED |
| Authoritative source role | Evidencia documental propuesta del bloque; no reemplaza la configuración efectiva de GitHub |
| Effective date | 2026-07-29, condicionada a aprobación y merge |
| Last verified date | 2026-07-29 |
| Review cadence | Ante cada cambio de settings y trimestral mientras el bloque permanezca abierto |
| Supersedes | Ninguno |
| Superseded by | Ninguno |
| Related controls or gaps | `ERM-CTRL-016`; `GAP-P0-1`; `PR-SEC-0`; `PR-SEC-2` |
| Evidence or approval reference | Lectura local y administrativa de solo lectura sobre `main@f2d8e05ef75aa91d27c1832489a4b94b723bd84a`; aprobación y merge pendientes |
| Document classification | PUBLIC_SANITIZED |

## 1. Resumen ejecutivo

La fase documental de `PR-SEC-REPO-SETTINGS` consolida la baseline real de
secret protection, determina elegibilidad por feature y formaliza el perfil de
exposición de `docs/security/**`.

El bloque no está cerrado:

- secret scanning básico y repository push protection permanecen `disabled` y
  requieren una autorización R2 posterior y específica;
- validity checks y non-provider patterns son `NOT_AVAILABLE` bajo titularidad
  de usuario y producto actuales;
- no se ejecutó ninguna mutación de GitHub settings;
- la evidencia runtime cross-tenant, RLS runtime y staging permanece fuera de
  scope y abierta.

## 2. Baseline verificada

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

## 3. Alcance

Incluido:

- baseline local y administrativa sanitizada;
- elegibilidad por feature contra documentación oficial vigente;
- auditoría de contenido de los seis archivos `docs/security/**`;
- perfil de clasificación, sanitización y revisión pre-merge;
- actualización de fuentes documentales e `ERM-CTRL-016`;
- criterio de cierre y siguiente paso.

Excluido:

- cualquier mutación de GitHub settings;
- alertas de secret scanning y respuesta a secretos reales;
- branch protection, Actions permissions, owner, plan, visibilidad o
  transferencia;
- backend, frontend, API, auth, cookies, sesiones, DB, schema, Drizzle,
  migraciones, tests, scripts, workflows, dependencias, manifiestos y lockfiles;
- evidencia runtime cross-tenant, RLS runtime, staging y producción.

## 4. Incidente previo, intento parcial y rollback

Un intento anterior de mutación fue pegado línea por línea en PowerShell. El
guard lanzó una excepción, pero PowerShell continuó ejecutando comandos de
nivel superior posteriores y un PATCH alcanzó a aplicarse parcialmente.
`secret_scanning_validity_checks` permaneció `disabled`.

Los mensajes `PASSED` impresos después de la excepción eran incondicionales y
no constituyen evidencia. Se ejecutó rollback y una lectura independiente
posterior confirmó nuevamente los cuatro settings en `disabled`.

Control preventivo para cualquier intento futuro:

- ejecutar el cambio como archivo `.ps1` revisado o bloque atómico
  `& { ... }`;
- terminar ante la primera excepción;
- imprimir `PASSED` únicamente después de observar la condición esperada;
- verificar cada feature individualmente;
- reportar `NOT_AVAILABLE` sin intentar mutación cuando falte elegibilidad;
- efectuar una lectura independiente posterior y limitar la evidencia a
  estados sanitizados.

Este documento no contiene ni propone un script mutante.

## 5. Elegibilidad por feature

| Feature | Evidencia de elegibilidad | Clasificación del bloque |
| --- | --- | --- |
| Secret scanning básico | GitHub documenta secret scanning gratuito para repositorios públicos. | Pendiente de autorización R2. |
| Repository push protection | GitHub permite habilitar push protection en el repositorio después de habilitar Secret Protection. | Pendiente de autorización R2. |
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
| Secreto publicado sin detección a nivel repositorio | Abierto: secret scanning y push protection `disabled`. | Autorización R2 posterior para habilitar solo las dos features elegibles y verificar cada estado. |
| Falsa expectativa de cuatro features habilitables | Mitigado documentalmente. | Validity checks y non-provider patterns figuran `NOT_AVAILABLE`. |
| Evidencia pública con valores sensibles | Mitigación documental propuesta. | Clasificación, minimización, checklist y reglas de incidente del perfil público. |
| Repetición de ejecución parcial en PowerShell | Mitigación preventiva documentada. | Archivo `.ps1` revisado o bloque atómico, fail-fast y verificación independiente. |
| Transferencia usada para mejorar una métrica | Fuera de scope. | No recomendar transferencia; tratarla como decisión estructural separada. |
| Gaps runtime interpretados como cerrados | Abierto y separado. | `ERM-CTRL-016` permanece `PARTIAL`; `ERM-SEC-001`, RLS runtime y staging no se cierran. |

## 8. Cambios documentales

| Archivo | Cambio |
| --- | --- |
| `docs/security/public-repository-exposure-profile.md` | Nuevo perfil propuesto de clasificación y sanitización pública. |
| `docs/audit/pr-sec-repo-settings-audit.md` | Nueva evidencia documental propuesta del bloque. |
| `docs/SOURCES_OF_TRUTH.md` | Registra las fuentes propuestas sin promoverlas antes de aprobación. |
| `docs/audit/README.md` | Enlaza la auditoría en revisión y mantiene el bloque abierto. |
| `docs/governance/enterprise-control-register.md` | Mejora evidencia, fecha, next action y closure criteria de `ERM-CTRL-016`, que permanece `PARTIAL`. |

Los seis documentos inventariados, los snapshots históricos y cualquier
archivo técnico permanecen sin cambios.

## 9. Rollback documental

El rollback consiste en retirar, mediante un cambio documental posterior
autorizado y revisado, los dos documentos propuestos y las referencias
incorporadas en los tres índices/registros. No requiere ni autoriza modificar
settings, reescribir historial, borrar evidencia histórica ni tocar archivos
técnicos.

## 10. Criterio de cierre

`PR-SEC-REPO-SETTINGS` puede cerrarse únicamente cuando:

1. el perfil público y esta auditoría sean aprobados, mergeados y promovidos
   según la Documentation Lifecycle Policy;
2. una autorización R2 posterior habilite `secret_scanning` y
   `secret_scanning_push_protection`;
3. una lectura independiente posterior confirme ambas features en `enabled`;
4. validity checks y non-provider patterns permanezcan documentados como
   `NOT_AVAILABLE` mientras no cambien titularidad y producto;
5. cualquier alerta generada sea tratada en un flujo restringido sin publicar
   secretos ni respuestas completas;
6. las validaciones documentales y la revisión de scope estén en `PASSED`.

El cierre de este bloque no cierra `ERM-SEC-001`, evidencia cross-tenant, RLS
runtime, staging ni otros controles de seguridad.

## 11. Validaciones

| Validación | Estado | Evidencia |
| --- | --- | --- |
| Inspección de paths cambiados | PASSED | Cinco archivos, todos dentro del scope documental aprobado. |
| Links Markdown relativos | PASSED | Targets relativos resueltos en los cinco archivos del diff. |
| Contenido sensible sobre líneas añadidas | PASSED | Revisión limitada al diff añadido con patrones seguros; sin valores sensibles detectados. |
| `git diff --check` | PASSED | Exit code 0; los archivos nuevos también pasaron revisión de whitespace y LF final. |
| Integridad de `ERM-CTRL-*` | PASSED | 25 filas, IDs `001..025` únicos y statuses permitidos. |
| UTF-8 sin BOM | PASSED | Los cinco archivos verificados sin BOM. |
| Scope exclusivo docs-only | PASSED | Sin paths técnicos, históricos o fuera de los cinco candidatos. |
| Ausencia de `next-env.d.ts` modificado | PASSED | No aparece en el estado ni en los paths cambiados. |
| Ausencia de `playwright-report/` y `test-results/` | PASSED | Sin artefactos en el diff ni en las ubicaciones Playwright del repositorio. |
| Builds, tests y E2E | NOT_RUN | No seleccionados para un cambio docs-only. |

## 12. Estado y próximo paso exacto

Estado: fase documental implementada localmente y pendiente de revisión; bloque
enterprise abierto; cero mutaciones de settings.

Próximo paso: Nico revisa este diff. Una tarea posterior debe otorgar
autorización R2 específica si se decide habilitar únicamente secret scanning y
repository push protection mediante ejecución atómica, fail-fast, verificación
individual y lectura independiente posterior.
