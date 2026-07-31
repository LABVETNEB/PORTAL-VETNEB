# VETNEB Agent Instructions

Contrato operativo obligatorio para todo agente (IA o humano asistido por IA) que trabaje en
`LABVETNEB/PORTAL-VETNEB`. Fuente única de verdad de instrucciones del repositorio. Si otra
superficie de instrucciones (p. ej. `.cursor/rules/`) contradice este archivo, prevalece este
archivo y la contradicción debe reportarse a Nico.

Precedencia de instrucciones (de mayor a menor):

```text
INSTRUCCIONES_DE_PLATAFORMA_O_SISTEMA
→ PEDIDO_EXPLÍCITO_ACTUAL_DE_NICO
→ AGENTS.md_MÁS_CERCANO_APLICABLE
→ AGENTS.md_RAÍZ (este archivo)
→ CÓDIGO_TESTS_Y_CONFIGURACIÓN_EJECUTABLE
→ DOCUMENTACIÓN_TÉCNICA_VIGENTE
→ README_Y_COMENTARIOS
→ INFERENCIAS
```

Resolución de contradicciones: ante conflicto entre este archivo, un `AGENTS.md` anidado, código
o configuración ejecutable y documentación, prevalece el nivel más alto de la lista y, dentro del
mismo nivel, la regla **más restrictiva**. La contradicción se reporta a Nico en la respuesta
final; no se resuelve silenciosamente, no se elige la lectura más permisiva y no se edita la
fuente en conflicto fuera del scope autorizado. Para el estado efectivo de GitHub (branch
protection, required checks, settings) manda la configuración real, no su descripción documental.

## 1. Identidad y entorno

- Usuario: Nico. Senior Web Developer. Autoriza scope, escrituras git/gh y operaciones sensibles.
- Entorno: Windows + PowerShell. Gestor: PNPM (la versión la fija `packageManager` en `package.json`).
- Respuestas específicas, nunca genéricas. Comentarios de código mínimos.
- Formato de entrega de código según actor:
  - Si el agente tiene herramientas de edición de archivos → aplicar el parche mínimo
    (diff mínimo suficiente); no volcar archivos completos en la respuesta.
  - Si Nico va a aplicar cambios manualmente → entregar comandos y bloques completos copiables.
  - Etiquetar terminales (Terminal 1 / Terminal 2) solo cuando de verdad se requieran procesos
    simultáneos (p. ej. dev server + tests); si la ejecución es secuencial, un solo flujo.

## 2. Protocolo de entrada

Toda tarea — incluida la que llega como enlace de GitHub (repo, rama, commit, archivo, PR,
issue, workflow, check) — sigue esta secuencia antes de analizar el objetivo:

```text
RESOLVER_REPOSITORIO_Y_REFERENCIA   (preservar rama/commit explícitos; no asumir main;
                                     si es PR: número, base, head, paths cambiados)
→ LEER_AGENTS_RAIZ                  (este archivo, completo)
→ BUSCAR_AGENTS_ANIDADOS            (git ls-files; excluir node_modules/**, .next/**, dist/** y generados)
→ RESOLVER_PRECEDENCIA              (el más cercano especializa; no elimina protecciones globales)
→ CAPTURAR_BASELINE                 (git status --short, branch, log -1, diff --stat/--name-only)
→ RECIÉN_ENTONCES_ANALIZAR_OBJETIVO
```

Criterio de salida: referencia identificada + AGENTS leído + baseline capturado.
Si el enlace es ambiguo, usar metadatos visibles de GitHub; preguntar una única pregunta
concreta solo si el objetivo material no puede resolverse.

## 3. Modelo de riesgo y autorización

Toda acción se clasifica antes de ejecutarse:

```text
R0 = lectura/inspección segura        → PERMITIDO siempre, sin confirmación
R1 = escritura local dentro del scope → PERMITIDO solo si Nico pidió implementación
R2 = cambio sensible/estructural      → BLOQUEADO sin autorización explícita en la tarea actual
R3 = operación destructiva/productiva → BLOQUEADO sin autorización específica y actual
```

- R0: Read/Glob/Grep, `git status|branch|log|diff|ls-files|remote`, lectura GitHub.
- R1: editar archivos del scope, crear tests del scope, ejecutar validaciones locales.
- R2: backend/DB/Drizzle/migraciones/schema, endpoints, cookies, CORS, CSP, auth, rate limits,
  `package.json`, `pnpm-lock.yaml`, dependencias, CI/workflows, Dependabot, configuración
  productiva. Ante necesidad de tocar R2: detenerse → justificar → listar archivos → explicar
  riesgo → esperar aprobación. (Protocolo único; no se repite en otras secciones.)
- R3: migraciones ejecutadas contra DB real, deploys, workflows que tocan variables productivas
  (p. ej. force update de versión), borrado de datos, reinicios de servicios, cualquier acción
  sobre producción o staging remoto. Incluye además: ejecución de policies/roles RLS contra
  cualquier DB real (§14), restore drill y rollback drill sobre entorno remoto o datos reales
  (§15), recolección de evidencia en staging o producción controlada (§17) y mutación de settings
  de GitHub (branch protection, required checks, environments, secret scanning, política de
  Actions, Dependabot).
- Bloqueo efectivo: una acción R2/R3 sin autorización no se ejecuta, no se simula, no se sustituye
  por un equivalente más débil y no se pospone en silencio. Se reporta como BLOCKED con el
  comando o archivo exacto y queda listada como [MANUAL-NICO] en la respuesta final.
- Autorización: es por tarea y por mensaje; no se generaliza de una tarea a la siguiente.
- Preservación: nunca revertir, stashear ni sobrescribir cambios preexistentes de Nico en el
  árbol de trabajo; registrarlos, preservarlos y trabajar alrededor.

Criterio de salida: cada acción de la tarea tiene clasificación R0–R3 antes de ejecutarse;
las R2/R3 sin autorización quedan bloqueadas y reportadas.

## 4. Scope (ubicación canónica)

Limitar el trabajo al scope indicado del PR o tarea. No mezclar: Dependabot, refactors globales,
backend/DB/migraciones/dependencias no solicitados, cambios visuales fuera del módulo, cambios
estructurales de login/auth, cambios de CI/workflows, limpiezas masivas. Salir del scope = R2.

PR mínimo: un scope primario, una causa, un rollback. Si el trabajo requiere dos scopes primarios
(p. ej. backend + frontend, o ci + dependencias), el default es **split obligatorio** en PRs
independientes y secuenciados; la excepción mixed-scope existe pero exige enumerar cada scope
afectado y justificar por qué los dominios no pueden entregarse por separado, cuál es la frontera
de acoplamiento y cuál la de rollback. Conveniencia, prisa o "ya que estoy" no son justificación.

No-alcance explícito: toda entrega declara qué quedó deliberadamente fuera. Un hallazgo real
detectado fuera del scope se **reporta**, no se corrige de contrabando; si es crítico, se detiene
y se pide autorización. Los ajustes que un cambio in-scope rompe legítimamente (guards, censos,
contratos de arquitectura que anclan paths o literales) se realinean **en el mismo PR** y nunca
se debilitan, se silencian ni se marcan como skip.

Reglas de scope por tipo de trabajo (aplican también a §§14–18): docs-only, scripts-only,
ci-only, test-only, backend-only, frontend-only, config-only y ops-only se entregan separados. Un
PR documental no ejecuta operaciones reales, y una operación real no reescribe política en el
mismo cambio salvo autorización explícita de Nico.

## 5. Git y GitHub CLI

### Agente — permitido (R0)

`git status --short`, `git branch --show-current`, `git log -1 --oneline`, `git diff --stat`,
`git diff --check`, `git diff --name-only`, `git branch`, `git branch -r --no-merged origin/main`,
`git ls-files`, `git remote -v`, operaciones GitHub de solo lectura.

### Agente — permitido solo si Nico pidió implementación (R1)

`git fetch --prune`, `git switch main`, `git pull --ff-only`, `git switch -c <branch>`.

### Agente — prohibido salvo autorización explícita en el mismo mensaje (R2/R3)

`git add|commit|push|reset|clean|checkout -- .|restore|merge|rebase|stash|tag`,
`gh pr create|merge`, `gh run`, cualquier `gh` de escritura. El agente puede ejecutar `gh` de
solo lectura (p. ej. `gh pr checks` sin `--watch`) únicamente si Nico lo pide en la tarea actual.

Prohibiciones adicionales, sin excepción por urgencia ni por "es reversible":

```text
git push --force | --force-with-lease      git branch -D | -d           git tag -d
git rebase (incl. -i, --onto, --continue)  git merge (incl. --abort)    git cherry-pick
git stash (incl. pop/apply/drop/clear)     git reset (soft|mixed|hard)  git clean -fd
git worktree add|remove|prune              git filter-branch            git reflog expire
gh api con -X POST|PATCH|PUT|DELETE        gh workflow run|enable|disable
gh secret|variable|release|repo edit       gh api .../protection | .../environments (escritura)
```

`git rebase` y `git merge` no se ejecutan ni siquiera para "actualizar la rama": si el PR está
detrás de `main`, se reporta y Nico decide. Nunca revertir, stashear ni sobrescribir cambios
preexistentes de Nico (§3). `--admin` para eludir checks requeridos está prohibido siempre,
también para Nico, según `docs/ops/CI_PR_CHECKS_RUNBOOK.md`.

### [MANUAL-NICO] — comandos que Nico ejecuta manualmente; el agente NO los ejecuta

Stage, commit, push, creación de PR, merge y:

```powershell
gh pr checks --watch
```

(en la rama del PR activo; no pasar número de PR).

## 6. Validación por impacto (fail-fast)

Estados canónicos — únicos admitidos al reportar:

```text
PASSED        = ejecutado, exit code 0
FAILED        = ejecutado, falló
NOT_RUN       = no seleccionado para este cambio
NOT_AVAILABLE = el script no existe (reportar, no inventar equivalentes)
BLOCKED       = el script existe pero el entorno requerido no está disponible
                (DB, navegadores Playwright, staging, secretos)
```

No simular éxito. Nunca marcar PASSED sin exit code 0 observado.

Secuencia general:

```text
LEER_PATHS_CAMBIADOS → CLASIFICAR_DOMINIO → EJECUTAR_PRIMERO_EL_TEST_MÁS_ESPECÍFICO
→ SI_FALLA: detener gates dependientes, diagnosticar causa raíz, corregir (si R1), reintentar
→ EJECUTAR_GATES_GENERALES → REVISAR_ARTEFACTOS → REPORTAR_ESTADOS
```

Matriz por dominio (todos los comandos existen en el repo):

- **Solo docs**: revisar markdown y links si aplica → `git diff --check` → reportar.
- **Backend** (`server/`, `test/`, `scripts/`):
  test dirigido relevante → `pnpm validate:local`
  (equivale a `typecheck && typecheck:test && test && build`; no re-ejecutar sus piezas aparte)
  → `pnpm security:public-surface` si se tocó superficie pública.
- **Schema/Drizzle** (R2, requiere autorización): test de schema dirigido →
  `pnpm validate:local:schema` (incluye `schema:verify`) → revisar archivos de migración.
- **Dependencias/manifiestos/lockfile** (`package.json`, `frontend/package.json`,
  `pnpm-workspace.yaml`, `pnpm-lock.yaml`) (R2, requiere autorización): `pnpm audit --prod` →
  `pnpm audit` → gates funcionales aplicables del dominio afectado. Si los audits no se
  ejecutaron, no declarar cobertura equivalente a CI: reportarlos como NOT_RUN o BLOCKED.
- **Frontend no visual**: test dirigido si existe → `pnpm --dir frontend lint` →
  `pnpm --dir frontend typecheck` → `pnpm --dir frontend build` → `pnpm security:public-surface`.
- **Frontend visual**: gates estáticos anteriores → cohorte E2E relevante (§7) → revisar
  screenshots/artefactos → diff.

CI real que el trabajo debe sobrevivir: `backend-ci` = `audit --prod → audit → db:migrate →
typecheck → typecheck:test → test → build` (los audits corren siempre en CI; localmente solo son
obligatorios cuando el cambio toca dependencias/lockfiles o cuando se declara cobertura
equivalente completa); `frontend-ci` = `lint → typecheck → build → security:public-surface →
e2e:ci` (cohorte `ci`, Chromium). `pr-governance` valida metadatos y scope del PR;
`qga-governance` valida la política de seguridad de workflows. La validación local debe cubrir,
como mínimo, los gates de CI afectados por el cambio (`db:migrate` local suele quedar BLOCKED sin
DB: reportarlo así).

Contextos required de `main` — los cuatro bloquean el merge:

```text
validate-pr-governance     validate-backend
qga-workflow-security      validate-frontend
```

En backend y frontend el contexto final está siempre presente y el job pesado es condicional por
impacto (rango merge-base → head): un heavy `skipped` solo es legítimo con detector
`impact=false` y contexto final en `SUCCESS`. `E2E Completeness` (`e2e:full`, catálogo completo)
**no** es required y no sustituye a `validate-frontend`. Mapa operativo y estados bloqueantes:
`docs/ops/CI_PR_CHECKS_RUNBOOK.md`; la fuente ejecutable es la configuración efectiva de GitHub.

Selección de gates por impacto: elegir por los paths realmente cambiados, no por costumbre ni por
el nombre del PR. Un gate no seleccionado se reporta NOT_RUN con el motivo; un gate imposible de
ejecutar por falta de entorno (DB, navegadores, staging, secretos, autorización) se reporta
BLOCKED. Prohibido: declarar cobertura equivalente a CI sin haberla ejecutado, sustituir un gate
por otro más barato y llamarlo equivalente, o inferir PASSED de una corrida anterior, de otra
rama o de otro entorno.

Criterio de salida: cada gate seleccionado reporta exactamente un estado canónico; ningún gate
general se ejecuta con el gate específico previo en FAILED sin diagnóstico.

## 7. Selección de cohortes E2E

```text
Admin mobile afectado                → pnpm --dir frontend e2e:admin-mobile
Zero-scroll desktop/contrato visual  → pnpm --dir frontend e2e:visual-contract
Zero-scroll mobile boundary          → pnpm --dir frontend e2e:extended
Público / clínica                    → pnpm --dir frontend e2e:public-clinic
Flujo crítico general                → pnpm --dir frontend e2e:smoke
Mapeo por paths soportado            → pnpm --dir frontend e2e:affected
Suite completa                       → pnpm --dir frontend e2e:full  (solo si Nico lo pide o no
                                       existe alternativa mínima suficiente)
```

Antes de asignar una cohorte a un contrato concreto, verificar la pertenencia actual del spec en
`frontend/e2e/suites/catalog.ts` y seleccionar la cohorte más pequeña que realmente lo contiene.
El nombre de una cohorte no constituye evidencia de cobertura.

Reglas: Playwright completo por defecto = 0. Si se editó CSS global con el dev server caído,
borrar `frontend/.next` antes de correr Playwright (la caché sirve CSS pre-edición). Tras
cualquier corrida E2E, verificar que `frontend/next-env.d.ts` no quedó modificado antes de
correr `pnpm test`. No dejar artefactos `playwright-report/` ni `test-results/` en el diff.

## 8. Recursos (máquina de ~8 GB de RAM)

```text
MAX_TAREAS_PESADAS_CONCURRENTES     = 1   (build, pnpm test completo, cohorte E2E)
WATCHERS_POR_DEFECTO                = 0   (nada de modo watch salvo petición explícita)
BUILDS_FRONTEND+BACKEND_SIMULTÁNEOS = 0
REINICIOS_AUTOMÁTICOS               = 0
TERMINAR_PROCESOS_AJENOS            = 0   (solo limpiar procesos creados por el propio agente)
```

Antes de lanzar una tarea pesada: confirmar que no hay otra en curso; ejecutar; esperar fin;
recién entonces la siguiente.

## 9. Seguridad

No leer, imprimir, modificar ni exponer: `.env`, `.env.*`, secretos, tokens reales, cookies
reales, passwords, signed URLs, claves privadas, dumps, backups, logs sensibles, datos clínicos
o comerciales innecesarios. `.env.example`/`.env.sample` solo como referencia de nombres.

Hashes — prohibición acotada:

- PROHIBIDO: hashes de passwords, de tokens de sesión, de credenciales, derivados de secretos.
- PERMITIDO inspeccionar: digests de integridad de archivos, pins SHA de actions en workflows,
  SHAs públicos de commits, checksums no secretos.

Nombres `data-*` en `frontend/src` no pueden contener stems sensibles (token/session/cookie…):
`security:public-surface` lo bloquea.

Evidencia sanitizada — regla transversal (detalle operativo en §§14–17). Ningún artefacto
producido por el trabajo (captura, log, acta, fixture, export, adjunto de PR, respuesta) puede
contener: secretos o valores de variables de entorno, cookies o session IDs, tokens crudos o sus
hashes, signed URLs completas, paths privados de storage, connection strings, dumps o backups,
datos clínicos, nombres reales de pacientes o tutores, emails reales sin sanitizar, ni payloads o
headers completos de request/response. Los fixtures y datos de prueba usan valores sintéticos, no
copias de datos reales. Un artefacto que incumple esto se descarta: no se recorta, no se difumina
y no se adjunta "con cuidado".

Invariantes productivas a preservar siempre: `admin_session_id` (Admin), `app_session_id`
(Clínica), auth, roles, permisos, CSRF, rate limits, CSP, `no-store` en superficies privadas,
no filtración de errores de DB, no stack traces al cliente, no mocks silenciosos en producción,
no fallbacks falsos que oculten errores reales.

## 10. Frontend, responsive y contrato Zero Scroll

Toda implementación frontend aplica en desktop, laptop, tablet y móvil, preservando: sin
overflow horizontal, foco visible, navegación por teclado cuando aplique, labels/aria cuando
aplique, contraste razonable, estados loading/empty/error, acciones críticas visibles.
Restricción del repo (protegida por tests en `test/unit/ui/`): no introducir `next/link` ni
`<a>` para navegación; usar el patrón de control de rutas existente (button + router.push).

Dashboard / software administrativo — invariantes medibles:

```text
SCROLL_VERTICAL_DEL_DOCUMENTO   = 0
SCROLL_HORIZONTAL_DEL_DOCUMENTO = 0
SCROLL_INTERNO_NO_AUTORIZADO    = 0   (solo el contratado, p. ej. body de tabla)
ACCIONES_CRÍTICAS_VISIBLES      = 100%
SOLAPAMIENTOS_DE_LAYOUT         = 0
```

Secuencia de implementación: viewport → altura disponible → reservar header/nav/acciones →
región de datos → capacidad de filas visibles → adaptar page size → reducir columnas
secundarias preservando las críticas → validar overflow y teclado → ejecutar
`e2e:visual-contract` y, si es admin responsive, `e2e:admin-mobile`.

Permitido: densidad adaptativa, filas/columnas adaptativas, paginación dinámica, tabs,
master-detail, paneles, revelado progresivo, truncado accesible.
Prohibido: `overflow-y: auto` como solución primaria, scroll anidado, ocultar acciones críticas,
reducción ilegible de fuente, alturas fijas arbitrarias, clipping de contenido, overflow
horizontal sin control.

Criterio de salida: el cumplimiento se demuestra con los specs de contrato existentes en
`frontend/e2e/` (no con inspección manual): `dashboard-internal-no-scroll-contract` y
`dashboard-real-app-shell-no-scroll-contract` vía cohorte `visual-contract`, y
`dashboard-zero-scroll-mobile-boundary` vía cohorte `extended` (§7), en PASSED.

## 11. Documentación proporcional

```text
Cambio trivial y de bajo riesgo          → solo informe final en la respuesta
Auditoría                                 → solo respuesta, salvo que Nico pida documento
Cambio arquitectónico                     → documento en docs/implementation (si hay escritura autorizada)
Seguridad / schema / workflow / migración → documentación detallada obligatoria
RLS / DB / restore / rollback / staging   → acta obligatoria con evidencia sanitizada (§§14–17)
```

Seguir el patrón existente del repositorio. `IMPLEMENTATION_NOTES/` se consolidó en
`docs/implementation/` (PR-CLEAN2, 2026-06-28); no recrear esa carpeta. Cuando se cree
documento, incluir: estado base, scope incluido/excluido, auditoría previa, cambios, archivos,
validaciones con estados canónicos, resultado, riesgo residual, estado final.

## 12. Calidad

Atributos exigibles (cada uno con control verificable en este repo): correctitud funcional
(tests), seguridad (`security:public-surface` + invariantes §9), fiabilidad (integración),
mantenibilidad (cambio mínimo, guards de arquitectura en `test/architecture/`), performance
razonable, compatibilidad (4 viewports), accesibilidad (spec axe en `frontend/e2e/`),
testabilidad, trazabilidad (§11). Prohibido afirmar "certificado", "compliant" o "conforme a
ISO X" sin auditoría formal específica. No sobreingeniería.

## 13. Finalización

Antes de cerrar cualquier implementación:

```text
git status --short → git diff --stat → git diff --check → git diff --name-only
→ confirmar que el diff contiene SOLO archivos del scope
→ confirmar cero artefactos (playwright-report/, test-results/, next-env.d.ts alterado)
```

La respuesta final debe indicar: (1) qué se hizo, (2) archivos modificados, (3) validaciones
con estado canónico cada una, (4) exclusiones respetadas, (5) estado final, (6) comandos
[MANUAL-NICO] pendientes, sin ejecutarlos, (7) las acciones R2/R3 que quedaron BLOCKED por falta
de autorización y (8) los riesgos residuales conocidos. Una tarea está terminada solo cuando los
gates seleccionados por §6 están PASSED o justificadamente BLOCKED/NOT_RUN, y el diff es mínimo.

Las secciones §§14–18 son protocolos operativos que se **suman** a §§1–13 para dominios de alto
riesgo (RLS/DB, backup/restore/rollback, observabilidad, evidencia staging, arquitectura
monorepo). No relajan ninguna regla anterior y no reemplazan esta secuencia de cierre, que sigue
siendo el último paso de toda implementación.

## 14. RLS / DB Change Safety Protocol

Aplica a RLS, schema, migraciones, roles de base de datos, policies, ownership y modelo de
conexión. Fuentes rectoras: `docs/architecture/rls-tenant-isolation-adr.md` (Accepted,
Alternativa D), `docs/security/rls-enforcement-matrix.md` y `ERM-CTRL-018` del
`docs/governance/enterprise-control-register.md`.

```text
Diseño, ADR, matriz, schema o migración escrita   → R2 como mínimo
Ejecución contra DB real, staging o productiva    → R3
```

- El aislamiento tenant **aplicativo** es obligatorio antes, durante y después de RLS. RLS es una
  segunda barrera; nunca reemplaza el scoping aplicativo, y ninguna implementación de RLS
  autoriza a retirarlo.
- El piloto RLS permanece **BLOQUEADO** hasta cerrar todos los entry criteria: backup y restore
  validados, rollback validado, observabilidad mínima, evidencia cross-tenant, matriz RLS
  aprobada, entorno no productivo controlado, datos Clinic A/B, responsables de seguridad y DB
  asignados, y autorización explícita de Nico. Un entry criterion no verificado es BLOCKED.
- Verificación previa obligatoria antes de diseñar policies: rol efectivo de la conexión,
  `rolsuper`, `rolbypassrls`, ownership de las tablas, tipo y modo del pooler, soporte
  transaccional, y policies creadas fuera del repositorio. Sin esa verificación no se diseña ni
  se propone SQL de policies.
- Verificaciones mínimas del piloto: tenant A no **lee** ni **muta** filas de tenant B; la
  ausencia de contexto no concede acceso; el contexto inválido no concede acceso; admin
  autorizado conserva sus operaciones; particular y token público quedan limitados al recurso
  vinculado; los jobs usan rol explícito; no hay contaminación de contexto entre conexiones;
  deny-by-default y least privilege verificados por rol.
- El contexto tenant se deriva **exclusivamente** de la identidad autenticada, se aplica por
  transacción sobre la misma conexión y no sobrevive entre requests. Prohibido confiar en un
  identificador de tenant enviado por el cliente y prohibido `SET` persistente sobre conexiones
  reutilizadas.
- PROHIBIDO ejecutar una migración sin rollback documentado; el rollback se prueba antes que la
  migración llegue a un entorno con datos reales.
- PROHIBIDO mezclar RLS con observabilidad, dependencias, frontend, required checks de CI o
  refactors funcionales. Cada uno es un PR separado (§4).
- Evidencia sanitizada obligatoria (§9): sin connection strings, credenciales, dumps, datos
  clínicos ni identificadores reales.
- Salida obligatoria: cada verificación reporta PASSED / FAILED / BLOCKED / NOT_RUN (§6).
  Prohibido declarar RLS "activo", "verificado" o "cerrado" sin evidencia runtime observada.

Criterio de salida: la clasificación R2/R3 está declarada por acción, cada entry criterion tiene
estado canónico y ninguna sentencia se ejecutó contra una DB real sin autorización específica y
actual de Nico.

## 15. Backup, Restore and Rollback Drill Protocol

Fuente rectora: `docs/ops/BACKUP_RESTORE_ROLLBACK.md`, que además registra el estado vigente
(sin backups automáticos de plataforma; dump de DB y export de Storage ejecutados y verificados
fuera del repositorio; **restore drill pendiente de ejecución**).

```text
Política, acta, checklist o RPO/RTO documentados     → R1 docs-only
Preparación local de un drill, sin entorno remoto    → R2
Drill que toca entorno remoto o datos reales         → R3
```

- **RPO y RTO se declaran numéricamente y por clase de dato** (DB, Storage, audit log) antes de
  ejecutar cualquier drill. Un adjetivo no es un objetivo y no habilita la ejecución.
- Ejecutar solo en el entorno autorizado, identificado por nombre y confirmado como no
  productivo, salvo autorización R3 específica y actual para otro entorno.
- PROHIBIDO usar datos clínicos reales, dumps completos, connection strings o credenciales en la
  evidencia. Los dumps y backups viven fuera del repositorio y nunca se versionan.
- Acta mínima: entorno, commit/deploy, timestamp UTC, operador responsable, alcance, pasos
  ejecutados, duración medida, resultado, validaciones post-restore/post-rollback y riesgos
  residuales.
- Validaciones mínimas post-restore: verificación de schema, smoke público, smoke privado
  autorizado, integridad mínima de los datos de prueba, y duración medida contra el RTO objetivo.
- Validaciones mínimas post-rollback: health del backend, rutas públicas, superficie privada
  correctamente bloqueada sin cookie válida, y smoke crítico del release afectado.
- PROHIBIDO declarar el sistema "recuperable", "con DR" o "rollback probado" sin un drill
  observado y registrado. Backup no probado no es backup; runbook escrito no es drill ejecutado.
- No mezclar la ejecución real de un drill con el cambio documental de la política en el mismo
  PR, salvo autorización explícita de Nico.

Criterio de salida: RPO/RTO declarados, acta completa con evidencia sanitizada y cada validación
con estado canónico. Sin drill observado, el estado es BLOCKED o NOT_RUN, nunca PASSED.

## 16. Observability and Logging Safety Protocol

Aplica a todo cambio que introduzca o modifique logging, métricas, health endpoints o correlación
de requests. Referencias: `docs/ops/METRICS_BASELINE.md` (baseline documental, sin colectores ni
alertas) y `ERM-CTRL-021`.

- **Structured logging obligatorio** para toda observabilidad runtime nueva o modificada: nivel
  explícito, timestamp y campos discretos parseables; no cadenas concatenadas irrecuperables.
- **Correlation/request id obligatorio** en rutas privadas y en todo error relevante, de forma que
  request, error y auditoría puedan unirse sin exponer identidad ni datos clínicos.
- **Redacción obligatoria**: tokens, cookies, passwords, hashes de credenciales, signed URLs,
  headers sensibles (`authorization`, `cookie`, `set-cookie`), errores de DB crudos, stack traces
  hacia el cliente, datos clínicos y payloads sensibles. La redacción vive en el logger, no
  depende de que cada llamador se acuerde.
- **Health endpoints**: no exponen secretos, stack traces, configuración interna, tokens, DSN,
  connection strings ni datos clínicos. Reportan estado y poco más.
- **Métricas agregadas**, nunca personales ni clínicas. Prohibido usar como dimensión un
  identificador de paciente, tutor, email real, token o session id.
- Un log que contiene datos sensibles **no es evidencia**: se descarta, no se adjunta recortado.
- PROHIBIDO que un cambio de observabilidad altere el contrato HTTP (status, headers, body,
  caché) sin un test que lo cubra. Preservar `no-store` en superficies privadas y la ausencia de
  caché en respuestas con cookie.
- Validación mínima: tests de redacción, guard de caché privada / `no-store`, smoke de health, y
  revisión del diff buscando campos que se loguean sin redactar.

Criterio de salida: la observabilidad agregada es estructurada, correlacionada y redactada; el
contrato HTTP previo se mantiene o su cambio está cubierto por test, con estados canónicos.

## 17. Staging Evidence and Sanitization Protocol

Aplica a toda evidencia obtenida fuera del árbol local: staging, producción controlada, smoke
cross-tenant, capturas y logs. Fuente rectora del caso cross-tenant:
`docs/ops/CROSS_TENANT_SMOKE_EVIDENCE_RUNBOOK.md` (CT-01..CT-16).

- Toda evidencia declara el **commit/deploy exacto** bajo prueba. Evidencia sin referencia de
  commit/deploy no es evidencia y no cierra ningún control ni gap.
- PROHIBIDO capturar o pegar secretos, cookies, tokens, hashes, signed URLs completas, paths
  privados de storage, datos clínicos reales, emails reales sin sanitizar o información comercial
  sensible (§9).
- Usar tenants y usuarios de prueba. Nunca datos de una clínica real para demostrar un contrato.
- Acta mínima: entorno, URL o superficie, rol/actor, timestamp UTC, commit/deploy, pasos,
  resultado, artefactos sanitizados y riesgos residuales.
- Si staging no está disponible, no está autorizado o no tiene datos de prueba: reportar
  **BLOCKED**. PROHIBIDO simular PASSED, inferirlo de otro entorno, deducirlo de tests locales o
  presentar un runbook como si fuera una ejecución.
- La evidencia cross-tenant separa explícitamente `Clinic A` y `Clinic B` con datos controlados y
  registra tanto el acceso propio permitido como el ajeno bloqueado, con status HTTP y ausencia
  de disclosure.
- Evidencia visual: capturas sin datos reales. Los artefactos generados fuera del scope se
  limpian antes de cerrar (§13); las capturas de evidencia no se guardan en `test-results/`
  (Playwright borra ese directorio al inicio de cada corrida) ni quedan en el diff.

Criterio de salida: cada ítem de evidencia tiene entorno, commit/deploy, resultado canónico y
artefactos sanitizados; lo no ejecutado queda BLOCKED o NOT_RUN, con el motivo explícito.

## 18. Enterprise Monorepo Boundary Protocol

Estado actual verificable: monorepo PNPM workspace con el backend en la raíz
(`portal-vetneb-backend`) y el frontend como único package del workspace
(`pnpm-workspace.yaml` → `packages: ["frontend"]`). No existen `apps/` ni `packages/`. Este
protocolo es **política futura**: fija las condiciones de cualquier migración, no la autoriza.

- Cualquier migración a `apps/backend`, `apps/frontend` o `packages/*` es R2 como mínimo, y R3
  cuando toca lockfile, workflows, build/deploy de Render o resolución productiva.
- PROHIBIDO mover estructura física sin una auditoría específica de arquitectura monorepo,
  aprobada y con plan por fases. Ningún "primer paso pequeño" está exento.
- Toda propuesta declara, antes de mover un archivo: imports permitidos y prohibidos entre
  packages, ownership por package en `.github/CODEOWNERS`, selección de tests afectados por
  package, paths de `tsconfig`, grafo de build, tipos compartidos, configuración compartida y
  test-utils compartidos.
- PROHIBIDO mezclar migración monorepo con RLS, observabilidad, release, dependencias o refactors
  funcionales (§4).
- Todo package nuevo declara owner, scripts mínimos (`typecheck` y `build`/`test` según aplique),
  validaciones asociadas y no-alcance explícito.
- Todo plan de migración incluye rollback lógico y compatibilidad verificada con Render, el
  workspace PNPM y los cuatro required checks de §6.
- Los guards de `test/architecture/` anclan paths y censos reales: una migración que los rompa
  debe realinearlos en el mismo PR, nunca debilitarlos, saltearlos ni marcarlos como skip.

Criterio de salida: ninguna estructura física se movió sin auditoría aprobada y autorización; toda
propuesta declara boundaries, ownership, tests afectados, rollback y compatibilidad CI/Render.
