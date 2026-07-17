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
  sobre producción o staging remoto.
- Autorización: es por tarea y por mensaje; no se generaliza de una tarea a la siguiente.
- Preservación: nunca revertir, stashear ni sobrescribir cambios preexistentes de Nico en el
  árbol de trabajo; registrarlos, preservarlos y trabajar alrededor.

Criterio de salida: cada acción de la tarea tiene clasificación R0–R3 antes de ejecutarse;
las R2/R3 sin autorización quedan bloqueadas y reportadas.

## 4. Scope (ubicación canónica)

Limitar el trabajo al scope indicado del PR o tarea. No mezclar: Dependabot, refactors globales,
backend/DB/migraciones/dependencias no solicitados, cambios visuales fuera del módulo, cambios
estructurales de login/auth, cambios de CI/workflows, limpiezas masivas. Salir del scope = R2.

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
- **Frontend no visual**: test dirigido si existe → `pnpm --dir frontend lint` →
  `pnpm --dir frontend typecheck` → `pnpm --dir frontend build` → `pnpm security:public-surface`.
- **Frontend visual**: gates estáticos anteriores → cohorte E2E relevante (§7) → revisar
  screenshots/artefactos → diff.

CI real que el trabajo debe sobrevivir: `backend-ci` = `db:migrate → typecheck → typecheck:test
→ test → build`; `frontend-ci` = `lint → typecheck → build → security:public-surface → e2e:smoke
+ e2e:admin-mobile + e2e:visual-contract + e2e:public-clinic` (Chromium). `pr-governance` valida
metadatos del PR. La validación local debe cubrir, como mínimo, los gates de CI afectados por el
cambio (`db:migrate` local suele quedar BLOCKED sin DB: reportarlo así).

Criterio de salida: cada gate seleccionado reporta exactamente un estado canónico; ningún gate
general se ejecuta con el gate específico previo en FAILED sin diagnóstico.

## 7. Selección de cohortes E2E

```text
Admin mobile afectado                → pnpm --dir frontend e2e:admin-mobile
Zero-scroll / contrato visual        → pnpm --dir frontend e2e:visual-contract
Público / clínica                    → pnpm --dir frontend e2e:public-clinic
Flujo crítico general                → pnpm --dir frontend e2e:smoke
Mapeo por paths soportado            → pnpm --dir frontend e2e:affected
Suite completa                       → pnpm --dir frontend e2e:full  (solo si Nico lo pide)
```

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
`frontend/e2e/` (no con inspección manual): `dashboard-internal-no-scroll-contract`,
`dashboard-real-app-shell-no-scroll-contract`, `dashboard-zero-scroll-mobile-boundary` y la
cohorte `visual-contract` en PASSED.

## 11. Documentación proporcional

```text
Cambio trivial y de bajo riesgo          → solo informe final en la respuesta
Auditoría                                 → solo respuesta, salvo que Nico pida documento
Cambio arquitectónico                     → documento en docs/implementation (si hay escritura autorizada)
Seguridad / schema / workflow / migración → documentación detallada obligatoria
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
[MANUAL-NICO] pendientes, sin ejecutarlos. Una tarea está terminada solo cuando los gates
seleccionados por §6 están PASSED o justificadamente BLOCKED/NOT_RUN, y el diff es mínimo.
