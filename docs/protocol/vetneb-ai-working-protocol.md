# PROTOCOLO MAESTRO VETNEB — PROGRAMACIÓN ASISTIDA POR IA

## 1. Principio rector

Toda tarea VETNEB se ejecuta con alcance explícito, base verificable, cambio mínimo suficiente, trazabilidad completa y validación proporcional al riesgo. La IA asiste; Nico conserva la decisión técnica, el control de Git, la aprobación visual y la responsabilidad de merge.

Si una acción necesaria excede el scope autorizado, el agente debe detenerse, explicar la necesidad, enumerar los archivos afectados, describir el riesgo y esperar autorización explícita de Nico.

## 2. Contexto operativo fijo

- Sistema operativo: Windows.
- Shell: PowerShell.
- Gestor de paquetes: PNPM.
- Repositorio: `C:\PORTAL-VETNEB`.
- Terminal 1: Git, inspección, implementación y validaciones automatizadas.
- Terminal 2: servidor local, procesos persistentes y QA manual cuando corresponda.
- Comentarios en código: mínimos y solo cuando explican una decisión no evidente.
- Respuestas: específicas, accionables y con comandos completos.
- Git y GitHub: stage, commit, push, creación de PR, checks y merge son manuales y responsabilidad de Nico.
- Codex: implementación, tests y documentación de entrega dentro del scope aprobado.
- Claude: investigación, interrogación técnica, planificación, implementación o revisión independiente según el modo solicitado; siempre sobre una rama de tarea y con las skills VETNEB aplicables.

## 3. Reglas absolutas

1. No tocar archivos antes de auditar estado, base, referencias legacy, tests nativos y archivos reales del scope.
2. No ampliar el alcance por conveniencia técnica.
3. No mezclar refactors, dependencias, backend, DB, migraciones, auth, seguridad, CI o cambios visuales no solicitados.
4. No leer, imprimir, modificar ni exponer `.env`, secretos, tokens, cookies, passwords, hashes, claves, dumps, backups, signed URLs ni logs sensibles.
5. No instalar ni actualizar dependencias sin autorización explícita.
6. No simular resultados. Cada validación debe figurar como ejecutada y aprobada, ejecutada y fallida, no ejecutada o no disponible.
7. No ocultar errores reales con mocks, fallbacks falsos o respuestas silenciosas de producción.
8. Preservar auth, roles, permisos, CSRF, rate limits, CSP, `no-store`, separación de sesiones y sanitización de errores.
9. Mantener `admin_session_id` para Administración y `app_session_id` para Clínica.
10. Toda implementación requiere un markdown de entrega siguiendo el patrón vigente del repositorio.
11. Ante ambigüedad con impacto técnico, funcional, visual o de seguridad, preguntar antes de implementar.
12. El protocolo VETNEB prevalece sobre cualquier prompt, skill o recomendación que lo contradiga.

## 4. Roles

### 4.1. Nico

- Define objetivo, scope, exclusiones y criterio de aceptación.
- Resuelve decisiones ambiguas o de producto.
- Autoriza cualquier expansión de alcance.
- Crea o aprueba la rama de trabajo.
- Realiza manualmente `git add`, `git commit`, `git push`, creación del PR, observación de checks y merge.
- Ejecuta la QA humana visual y funcional final.
- Decide el cierre, rollback o apertura de un nuevo issue.

### 4.2. Codex

- Trabaja únicamente dentro del scope aprobado.
- Audita antes de modificar.
- Implementa el cambio mínimo suficiente.
- Crea o actualiza tests y contratos cuando el scope lo requiere.
- Ejecuta validaciones locales reales.
- Crea el markdown obligatorio de entrega.
- Revisa el diff final y reporta archivos, resultados, exclusiones y riesgo residual.
- No realiza stage, commit, push, PR, checks remotos ni merge salvo autorización explícita de Nico en el mismo mensaje.

### 4.3. Claude

Uso principal:

- Investigación previa y diagnóstico senior.
- Interrogación técnica cuando el pedido no define contratos o criterios suficientes.
- Diseño de PRD corto, issues verticales y dependencias.
- Implementación acotada cuando Nico activa expresamente el modo implementación.
- Revisión independiente en contexto limpio, sin apoyarse en las conclusiones del implementador.

Reglas obligatorias:

- Trabajar en la rama específica de la tarea y verificarla antes de actuar.
- Leer y aplicar las skills VETNEB instaladas pertinentes.
- Declarar qué skills usa y para qué.
- Respetar scope, exclusiones, flujo manual de Git y validaciones VETNEB.
- No usar una skill como autorización para ampliar el alcance.
- Si una skill contradice este documento, prevalece el protocolo VETNEB.

## 5. Skills VETNEB instaladas para Claude

Las skills documentadas en el repositorio son:

- `vetneb-staff-senior-full-stack-engineer`: diagnóstico e implementación full-stack con cambio mínimo, tests y trazabilidad.
- `vetneb-security-production-invariants`: auth, privacidad, sesiones, secretos, límites de exposición e invariantes de producción.
- `vetneb-protocolos-comunicacion`: contratos HTTP, integración cliente-servidor, cookies, headers, CORS, email y compatibilidad de protocolos.
- `vetneb-bugs-errores-optimizacion-rutas`: reproducción, causa raíz, rutas, redirects, errores y optimización acotada.
- `vetneb-admin-dashboard-operational-actions`: acciones operativas, estados, feedback y comportamiento del dashboard administrativo.

No se deben inventar nombres de skills. Si una skill requerida no está disponible, Claude debe informarlo y continuar solo con las capacidades autorizadas por Nico.

## 6. Selección de skills por tipo de tarea

| Tipo de tarea | Skills mínimas recomendadas |
| --- | --- |
| Implementación full-stack | `vetneb-staff-senior-full-stack-engineer` |
| Auth, sesiones, permisos, secretos o privacidad | `vetneb-security-production-invariants` + `vetneb-protocolos-comunicacion` |
| API, cookies, CORS, email o contrato cliente-servidor | `vetneb-protocolos-comunicacion` + `vetneb-security-production-invariants` |
| Bug, rutas, redirects o error de runtime | `vetneb-bugs-errores-optimizacion-rutas` + la skill del dominio afectado |
| Dashboard admin y acciones operativas | `vetneb-admin-dashboard-operational-actions` + `vetneb-staff-senior-full-stack-engineer` |
| Revisión independiente | Skills del dominio auditado; no usar el razonamiento previo del implementador como evidencia |

Usar el conjunto mínimo que cubra el riesgo real. Más skills no equivalen a mejor revisión si agregan ruido o expanden el scope.

## 7. Prompt mínimo para Claude

```text
Repo: C:\PORTAL-VETNEB
Rama: <rama-de-tarea>
Base esperada: <commit-o-main-actual>
Modo: <investigación | implementación | revisión independiente>
Objetivo: <resultado concreto>
Scope incluido: <archivos, módulos o comportamiento>
Scope excluido: <límites explícitos>
Criterios de aceptación: <resultados observables>
Validaciones requeridas: <comandos reales>

Aplicá el Protocolo Maestro VETNEB. Verificá base limpia, rama, paridad local, referencias legacy, tests nativos y archivos reales antes de modificar. Usá y declará las skills VETNEB pertinentes. Si hay ambigüedad o hace falta salir del scope, detenete y pedí autorización. No hagas git add, commit, push, PR, checks ni merge. Entregá markdown y reporte final trazable.
```

## 8. Claude como revisor independiente

La revisión independiente debe ejecutarse en un chat o contexto limpio y sobre el diff real de la rama.

Claude debe:

1. Recibir objetivo, scope, criterios de aceptación, base y rama.
2. Inspeccionar el diff sin adoptar como ciertas las conclusiones del implementador.
3. Buscar regresiones funcionales, seguridad, accesibilidad, responsive, mantenibilidad y cobertura insuficiente.
4. Priorizar hallazgos por severidad y aportar archivo, ubicación, impacto y evidencia.
5. Diferenciar defectos del PR, deuda previa y mejoras fuera de scope.
6. No modificar archivos en modo revisión salvo nueva autorización explícita.
7. Informar claramente cuando no existen hallazgos accionables.

## 9. Claude en modo implementación

Claude solo implementa cuando Nico lo solicita expresamente. En ese modo debe:

1. Verificar rama y base limpia.
2. Declarar las skills elegidas.
3. Completar la auditoría previa.
4. Proponer el plan mínimo y riesgos.
5. Esperar confirmación si existe ambigüedad, riesgo relevante o expansión de scope.
6. Implementar con TDD o contratos cuando aplique.
7. Ejecutar validaciones reales.
8. Crear el markdown obligatorio.
9. Revisar el diff final.
10. Entregar comandos manuales pendientes para Nico sin ejecutarlos.

## 10. Fase senior de claridad antes de implementar

Antes de escribir código se debe poder responder:

- ¿Qué problema observable se corrige?
- ¿Quién está afectado y en qué flujo?
- ¿Cuál es el comportamiento actual y cuál el esperado?
- ¿Qué archivos y capas pertenecen realmente al scope?
- ¿Qué contratos no pueden romperse?
- ¿Qué datos, permisos, estados y errores intervienen?
- ¿Cómo se probará el cambio?
- ¿Qué queda expresamente excluido?
- ¿Cuál es el riesgo de no hacer el cambio y de hacerlo mal?

Si falta una respuesta que pueda alterar arquitectura, seguridad, UX, datos o alcance, el agente debe interrogar técnicamente a Nico antes de implementar.

## 11. PRD corto

Usar un PRD corto para cambios grandes, transversales o con decisiones de producto. Debe caber en una página operativa y contener:

```text
Problema:
Usuario/rol afectado:
Resultado esperado:
Scope incluido:
Scope excluido:
Flujo principal:
Estados loading/empty/error/success:
Contratos e invariantes:
Criterios de aceptación:
Riesgos:
Validaciones y QA:
```

El PRD define qué construir; no reemplaza la auditoría técnica ni autoriza archivos fuera del scope.

## 12. Issues verticales

Dividir trabajos grandes en issues verticales que entreguen una capacidad verificable de extremo a extremo. Cada issue debe incluir UI, contrato, datos, permisos, tests y documentación solo cuando esas capas sean necesarias para ese resultado.

Reglas:

- Un issue, un resultado observable.
- Evitar issues horizontales genéricos como “hacer backend” o “hacer frontend”.
- Mantener cada PR revisable y reversible.
- Separar deuda técnica no bloqueante en otro issue.
- No introducir infraestructura anticipada sin consumidor real.

## 13. DAG simple de dependencias

Para trabajos con varios issues, documentar un grafo acíclico simple:

```text
I1 — Contrato y criterios
 ├─> I2 — Flujo principal implementado
 │    └─> I4 — QA integral y documentación
 └─> I3 — Estados de error y seguridad
      └─> I4 — QA integral y documentación
```

Cada nodo debe indicar entrada, salida y bloqueo. No iniciar un nodo si depende de un contrato aún no aprobado.

## 14. Flujo antes de tocar código

### Terminal 1 — auditoría previa

```powershell
Set-Location C:\PORTAL-VETNEB
git status --short
git branch --show-current
git log -1 --oneline
git log main -1 --oneline
git diff --stat
git diff --name-only
```

Después:

1. Confirmar working tree limpio o identificar cambios preexistentes de Nico.
2. Confirmar rama y commit base.
3. Inspeccionar paridad entre rama y base local.
4. Buscar referencias legacy relacionadas con el scope mediante `rg`.
5. Identificar tests nativos y scripts reales.
6. Enumerar archivos reales potencialmente afectados.
7. Reportar riesgos y plan mínimo.
8. Confirmar validaciones necesarias.
9. Detenerse si hay ambigüedad, riesgo no aprobado o necesidad de salir del scope.

No limpiar, restaurar ni sobrescribir cambios preexistentes de Nico.

## 15. Crear rama

La rama la crea Nico o un agente únicamente cuando Nico solicita implementación y autoriza esa preparación. Flujo manual recomendado:

### Terminal 1

```powershell
Set-Location C:\PORTAL-VETNEB
git fetch --prune
git switch main
git pull --ff-only
git status --short
git log -1 --oneline
git switch -c <tipo>/<nombre-corto>
git branch --show-current
```

No crear la rama desde una base sucia o desactualizada. No reutilizar una rama con trabajo no relacionado.

## 16. Implementación con TDD / contratos

Aplicar TDD cuando el comportamiento pueda expresarse con un test automatizado estable:

1. Reproducir el fallo o escribir el contrato que debe fallar.
2. Confirmar que falla por la causa esperada.
3. Implementar el cambio mínimo.
4. Confirmar que el test enfocado pasa.
5. Ejecutar la suite proporcional al impacto.
6. Refactorizar solo dentro del scope y con tests verdes.

Si TDD no es viable, definir antes un contrato verificable: entrada, salida, permisos, estados, errores y criterio de aceptación. No agregar tests que congelen detalles accidentales de implementación.

## 17. Reglas frontend / dashboard

Toda implementación frontend debe cubrir desktop, laptop, tablet y móvil, y preservar:

- ausencia de overflow horizontal;
- foco visible y navegación por teclado cuando aplique;
- labels, nombres accesibles y atributos ARIA cuando correspondan;
- contraste razonable;
- estados loading, empty, error y success claros;
- acciones críticas visibles y feedback operativo;
- comportamiento coherente con permisos y sesión.

En dashboards y software administrativo:

- priorizar densidad y continuidad operativa;
- evitar páginas largas y scroll externo innecesario;
- no usar `overflow-y-auto` como arreglo automático;
- preferir paginación, tabs, master-detail, paneles o truncado seguro;
- conservar contexto, filtros y selección después de una acción;
- validar con datos densos, no solo estados vacíos.

## 18. Validaciones estándar

Ejecutar las validaciones que existan y correspondan al scope. Para una implementación completa, la referencia es:

### Terminal 1

```powershell
Set-Location C:\PORTAL-VETNEB
pnpm test
pnpm build
pnpm security:public-surface
pnpm --dir frontend lint
pnpm --dir frontend typecheck
pnpm --dir frontend build
```

Si un script no existe, reportarlo y usar únicamente un equivalente real ya disponible. No inventar scripts. Para cambios documentales puros, no ejecutar suites sin impacto técnico; ejecutar como mínimo las validaciones Git exigidas por la tarea.

## 19. Terminal 1 / Terminal 2

### Terminal 1 — comandos finitos

Usar para Git, búsquedas, edición, tests, lint, typecheck, build y validaciones.

### Terminal 2 — proceso persistente

Usar solo cuando la tarea requiere servidor local o QA visual:

```powershell
Set-Location C:\PORTAL-VETNEB
pnpm --dir frontend dev
```

No iniciar Terminal 2 si la tarea no requiere runtime. Registrar qué proceso queda activo y detenerlo al finalizar la QA.

## 20. Revisión de diff antes de cerrar

### Terminal 1

```powershell
Set-Location C:\PORTAL-VETNEB
git status --short
git diff --stat
git diff --check
git diff --name-only
```

La revisión debe confirmar:

- solo archivos autorizados;
- ausencia de secretos o datos sensibles;
- ausencia de cambios accidentales de formato o lockfile;
- tests y documentación coherentes con el comportamiento;
- scope excluido intacto;
- diff comprensible y sin whitespace errors.

## 21. Markdown obligatorio

Toda implementación debe crear o actualizar un documento en el patrón real correspondiente:

- `docs/implementation/`
- `docs/audit/`

(`IMPLEMENTATION_NOTES/` se consolidó dentro de `docs/implementation/` por PR-CLEAN2, 2026-06-28.)

Debe incluir:

- estado base;
- scope incluido y excluido;
- auditoría previa;
- cambios realizados;
- archivos modificados;
- validaciones y resultado exacto;
- QA realizada;
- riesgo residual;
- estado final;
- comandos manuales pendientes para Nico.

## 22. QA humana

La automatización no reemplaza la QA humana. Nico debe revisar visual y funcionalmente los flujos afectados, especialmente frontend, dashboard, auth y acciones críticas.

Matriz mínima cuando aplica:

- desktop, laptop, tablet y móvil;
- tema claro y oscuro si ambos existen;
- teclado y foco;
- loading, empty, error y success;
- datos densos y textos largos;
- rol autorizado y rol no autorizado;
- navegación, refresh y retorno al contexto;
- consola del navegador y requests fallidos sin datos sensibles.

Registrar evidencia suficiente, resultado y cualquier limitación del entorno.

## 23. Body de PR

El template operativo es `.github/PULL_REQUEST_TEMPLATE.md`. El contrato automatizado que lo valida es `scripts/governance/pr-governance-validator.mjs`, ejecutado por el check requerido `PR Governance` / `validate-pr-governance`. El body real del PR debe partir de ese template, no de un formato alternativo.

### Headings requeridos

El validador exige, con el nombre exacto y sin traducir, estos headings de nivel `##`:

- `## Summary`
- `## Scope`
- `## Validation`
- `## Rollback`

Si falta cualquiera de estos cuatro headings, el check falla aunque el contenido sea correcto. No eliminar un heading requerido aunque su sección sea "no aplica"; en ese caso se escribe explícitamente que no aplica y por qué, dentro del heading.

El body también debe incluir los checklists y detalles aplicables del template vigente (`Mixed-Scope Justification`, `Other Scope Detail`, `Security / Regression Checklist`) cuando el escenario los active. No inventar checkboxes que no existan en el template.

### Regla de scope

- Seleccionar exactamente un scope primario reconocido cuando el PR tiene un único scope real (`backend runtime`, `frontend runtime`, `tests`, `workflows/ci`, `migrations/schema`, `docs`, `dependencies`, `scripts/tooling`, `repository configuration`, `other`).
- La selección debe coincidir con la clasificación real de los archivos cambiados; el validador deriva el scope primario desde el diff y lo compara contra el checkbox marcado.
- Marcar `mixed-scope exception` únicamente cuando existen dos o más scopes primarios reales detectados en el diff. No usarla para evitar dividir un PR que en realidad tiene un solo scope.
- En `mixed-scope exception` deben marcarse todos los scopes primarios afectados, ni más ni menos, y la sección `## Mixed-Scope Justification` debe explicar el acoplamiento entre dominios, por qué no pueden entregarse como PRs independientes y el límite de rollback.
- `other` requiere una sección `## Other Scope Detail` con detalle sustantivo: paths concretos y motivo por el que ningún scope estándar aplica.

No afirmar cobertura, seguridad o compatibilidad que no haya sido verificada.

### Creación segura del body (bodies multilínea)

Los bodies con varias líneas se gestionan con un archivo, nunca con un body largo construido directamente en la línea de comandos:

1. escribir el body en un archivo Markdown temporal fuera del repositorio, codificado en UTF-8 sin BOM;
2. verificar el contenido del archivo antes de usarlo;
3. crear o editar el PR con `--body-file`, no con `--body`;
4. no continuar con `gh pr view` ni `gh pr checks` hasta confirmar que el comando de creación devolvió una URL de PR válida.

Ejemplo PowerShell compatible con Windows PowerShell 5.1 y PowerShell 7 (Nico ejecuta manualmente):

```powershell
$prBody = Join-Path $env:TEMP "vetneb-pr-body.md"

$prBodyContent = Get-Content `
  -LiteralPath ".github\PULL_REQUEST_TEMPLATE.md" `
  -Raw

[System.IO.File]::WriteAllText(
  $prBody,
  $prBodyContent,
  [System.Text.UTF8Encoding]::new($false)
)

Get-Content -LiteralPath $prBody -Raw
```

`Set-Content -Encoding utf8NoBOM` no se usa porque ese parámetro no existe en Windows PowerShell 5.1; `[System.IO.File]::WriteAllText` con `UTF8Encoding($false)` escribe UTF-8 sin BOM en ambas versiones.

A partir de ahí, Nico completa el archivo temporal (`$prBody`) conservando todos los headings, checkboxes y checklists del template vigente — no se recorta ni se resume el template al copiarlo al archivo temporal. Con el archivo ya completo y verificado:

```powershell
gh pr create `
  --title "<titulo>" `
  --base main `
  --head "<rama>" `
  --body-file $prBody
```

Para editar un PR existente:

```powershell
gh pr edit --body-file $prBody
```

No usar `gh pr create --body "..."` ni `gh pr edit --body "..."` para contenido multilínea, y no usar bloques PowerShell incompletos o sin verificación previa del archivo.

### Verificación del body publicado

Después de crear o editar el PR, confirmar el estado real antes de continuar:

```powershell
gh pr view --json number,title,state,url,headRefName,baseRefName,body
```

Confirmar explícitamente: el PR existe, los cuatro headings requeridos están presentes, el scope declarado coincide con el diff, el rollback está completo y las ramas head/base son las correctas.

### Revalidación después de editar metadata

Editar el body o el título de un PR no garantiza por sí solo una nueva ejecución del check de gobernanza. Con la configuración actual del repositorio:

- después de corregir metadata (body, scope, headings), debe comprobarse si aparece un nuevo run de `PR Governance` para el SHA/metadata vigente;
- si no aparece un nuevo run tras la corrección, Nico puede cerrar y reabrir el PR para generar un nuevo evento evaluable, sin crear commits vacíos;
- debe volver a ejecutarse `gh pr checks --watch` y observarse hasta el final;
- no usar commits vacíos únicamente para reactivar CI;
- no reutilizar como evidencia un run fallido anterior al que ya no corresponde al body/scope corregido.

Esta instrucción es específica al comportamiento observado en el flujo actual de `pull_request` + `workflow_dispatch` de este repositorio; no es una garantía general sobre cualquier configuración futura de CI.

## 24. Checks

Después de que Nico haga push y cree o actualice el PR:

### Terminal 1 — manual por Nico

```powershell
Set-Location C:\PORTAL-VETNEB
gh pr checks --watch
```

No usar `gh pr checks <NUMERO_PR> --watch`.

Un resultado verde en `gh pr checks --watch` es necesario pero no suficiente para mergear: no reemplaza la revisión de diff, la QA humana, ni la verificación de mergeabilidad real del PR.

### Estado de mergeabilidad después de los checks

Tras `gh pr checks --watch`, verificar el estado real del PR, no solo el resultado de los checks:

```powershell
gh pr view `
  --json number,title,state,mergeStateStatus,headRefName,baseRefName,statusCheckRollup,url
```

No autorizar el merge solamente porque `gh pr checks --watch` terminó en verde. `mergeStateStatus` puede seguir en `BLOCKED` por revisiones pendientes, review threads sin resolver, rama desactualizada u otra condición de branch protection ajena a los checks.

### Review threads antes del merge

Un check verde no implica que las conversaciones de revisión estén resueltas. Antes de considerar el PR mergeable:

1. inspeccionar los comentarios y review threads del PR (en la UI de GitHub, o vía `gh api graphql` consultando `pullRequest.reviewThreads` si se necesita lectura programática — no hay IDs fijos que reutilizar entre PRs, cada consulta usa el número de PR vigente);
2. distinguir un comentario informativo de un hallazgo accionable;
3. no resolver (`resolve`) un thread antes de aplicar la corrección correspondiente;
4. aplicar el cambio mínimo en la misma rama para cada hallazgo accionable;
5. repetir las validaciones aplicables tras el cambio;
6. publicar el nuevo commit (Nico hace push manualmente);
7. esperar los checks del nuevo SHA, no reutilizar el resultado del SHA anterior;
8. responder en el thread indicando qué se corrigió y dónde;
9. resolver el thread solamente después de publicar y validar la corrección;
10. antes de mergear, verificar que no queden review threads accionables sin resolver.

## 25. Manejo de CI fallido

1. Identificar el check y el primer error causal, no el último error en cascada.
2. Reproducir localmente con el comando real del repositorio cuando sea posible.
3. Clasificar: defecto del PR, flake, entorno externo o fallo preexistente.
4. Si es defecto del PR, abrir una corrección mínima en la misma rama y repetir validaciones.
5. Si es flake, reunir evidencia antes de reintentar; no asumirlo sin prueba.
6. Si es externo o preexistente, documentar evidencia y pedir decisión a Nico.
7. No desactivar checks, reducir cobertura, ignorar errores ni modificar workflows sin scope y autorización explícitos.
8. Después del fix, Nico realiza manualmente stage, commit, push y vuelve a observar `gh pr checks --watch`.

## 26. Merge

### Amend y `force-with-lease`

Cuando se decide conservar un PR de un solo commit, el amend y el force-push correspondiente son operaciones manuales exclusivas de Nico, y solo después de revisar el diff en stage:

```powershell
git commit --amend --no-edit
git push --force-with-lease
```

No usar `git push --force` bajo ninguna circunstancia. El amend no es obligatorio para todos los PRs: un commit correctivo nuevo sobre la misma rama también es una opción válida según el caso, y suele ser preferible cuando ya hubo revisión externa sobre el historial existente.

### Gate pre-merge

Antes de ejecutar el merge deben cumplirse todos los siguientes puntos:

- working tree local limpio;
- HEAD local y rama remota sincronizados;
- el PR está abierto y no es draft;
- scope y diff están aprobados;
- el body del PR está vigente y validado (headings, scope, rollback — ver [Sección 23](#23-body-de-pr));
- los checks del SHA actual son exitosos (no de un SHA anterior);
- la revisión independiente no tiene hallazgos bloqueantes;
- todos los review threads accionables están resueltos (ver [Sección 24](#24-checks));
- `mergeStateStatus` es exactamente `CLEAN`;
- QA humana está aprobada cuando aplica;
- el riesgo residual es conocido y aceptable;
- el rollback está documentado.

Verificación estándar antes de decidir:

```powershell
gh pr view <PR> `
  --json number,title,state,mergeStateStatus,headRefName,baseRefName,statusCheckRollup,url
```

Solo Nico decide y ejecuta el merge cuando el gate anterior se cumple completo. No mezclar el merge con cambios adicionales de último minuto.

### `--admin` y `--auto`

No usar `--admin` como workaround de branch protection. Si un PR requiere `--admin` para mergear, el bloqueo real no fue resuelto; hay que identificarlo y corregirlo, no sortearlo.

`--auto` solo puede usarse por decisión explícita de Nico, cuando los requisitos de merge están pendientes pero se espera que se satisfagan normalmente (por ejemplo, checks en curso). No debe usarse para ocultar un bloqueo cuya causa no fue identificada.

### Si `mergeStateStatus` es `BLOCKED`

1. No reintentar el merge a ciegas.
2. Inspeccionar checks, review threads, review decision, conversaciones y reglas de branch protection.
3. Identificar el requisito exacto que falta.
4. Corregir o resolver ese requisito puntual.
5. Volver a verificar `mergeStateStatus` hasta obtener `CLEAN`.

## 27. Limpieza local post-merge

### Confirmar el merge antes de limpiar

Antes de cualquier limpieza local, confirmar el estado real del PR y del remoto:

```powershell
gh pr view <PR> `
  --json number,title,state,mergedAt,mergeCommit,url

git switch main
git pull --ff-only
git fetch --prune
git log -1 --oneline
git status --short --untracked-files=all
```

Confirmar explícitamente: el PR aparece como `MERGED`, `main` local ya contiene el commit de merge tras el `pull --ff-only`, y el working tree queda limpio.

`git branch -r --no-merged origin/main` no se usa como fuente de verdad de merge porque `--no-merged` evalúa ancestry de commits: compara si el tip de la rama es alcanzable desde `origin/main`. En un squash merge, GitHub genera un commit nuevo en `main` con identidad, parentage e historial diferentes de los commits originales de la rama, aunque el tree resultante pueda ser equivalente al estado final de esa rama. Por ello, el tip original de una rama squash-merged no se convierte necesariamente en ancestro de `main` y puede seguir apareciendo como `--no-merged` aunque el PR esté efectivamente mergeado, sin que eso indique un problema real.

Para verificar la existencia de la rama remota (por ejemplo, para confirmar que GitHub ya la eliminó tras el merge):

```powershell
git branch -r --list "origin/<rama>"
```

### Limpieza local

La limpieza es manual por Nico y se realiza solo después de confirmar el merge y preservar cualquier trabajo local:

### Terminal 1 — manual por Nico

```powershell
Set-Location C:\PORTAL-VETNEB
git status --short
git switch main
git pull --ff-only
git branch --show-current
git log -1 --oneline
git branch -d <rama-mergeada>
git status --short
```

No usar `git branch -D`, `git reset`, `git clean` ni restauraciones masivas como limpieza rutinaria. No borrar worktrees ni ramas ajenas a la tarea en curso. Confirmar que la rama remota fue eliminada cuando corresponda; no forzar su eliminación si pertenece a trabajo de otra persona.

## 28. Incidencias Windows / Git

Ante errores de archivos bloqueados, procesos Git colgados o `.git\index.lock`:

### Terminal 1 — diagnóstico

```powershell
Set-Location C:\PORTAL-VETNEB
Get-Process git -ErrorAction SilentlyContinue
Test-Path .git\index.lock
git status --short
```

Reglas:

- No eliminar `index.lock` mientras exista un proceso Git activo.
- Cerrar editores o terminales que mantengan el recurso y volver a comprobar.
- La eliminación manual de un lock huérfano corresponde a Nico, después de confirmar que no existe proceso Git activo.
- No resolver problemas de permisos desactivando seguridad, antivirus o controles del sistema.
- Si PowerShell o PNPM falla, registrar comando, código de salida y primer error útil antes de reintentar.
- Ante diferencias de fin de línea, revisar el diff; no normalizar masivamente fuera del scope.

## 29. Documentación viva

Este protocolo debe actualizarse cuando cambien herramientas reales, scripts, roles o flujo de entrega. Toda actualización debe:

- tener un PR documental propio o scope explícito dentro de otro PR;
- eliminar instrucciones obsoletas en lugar de acumular contradicciones;
- preservar historial mediante Git;
- basarse en comandos y skills existentes;
- mantener ejemplos sin secretos ni datos productivos.

Los documentos de auditoría e implementación son evidencia histórica; este protocolo es la fuente operativa vigente.

## 30. Normas de calidad ISO

El trabajo se alinea como guía de calidad, sin afirmar certificación, con:

- ISO/IEC 25000 SQuaRE: evaluación sistemática de calidad.
- ISO/IEC 25010: adecuación funcional, rendimiento, compatibilidad, usabilidad, fiabilidad, seguridad, mantenibilidad y portabilidad.
- ISO 9001: proceso repetible, evidencia y mejora continua.
- ISO/IEC 5055: calidad estructural y prevención de defectos críticos.
- ISO/IEC 15504: madurez, capacidad y control del proceso.
- ISO/IEC 27001: gestión de riesgos y protección de información.
- ISO/IEC 14598: evaluación trazable del producto de software.

Aplicación práctica: criterios explícitos, cambio mínimo, pruebas proporcionales, revisión independiente, protección de información, documentación y evidencia de cierre.

## 31. Antipatrones prohibidos

- Implementar antes de entender el problema.
- Aceptar ambigüedad relevante y completar requisitos por intuición.
- Mezclar varios objetivos en un PR.
- Refactorizar globalmente durante un fix local.
- Tocar backend, DB, auth, dependencias o CI “porque ayuda”.
- Crear abstracciones sin un consumidor real.
- Agregar fallbacks que oculten fallos de producción.
- Usar mocks silenciosos en producción.
- Exponer errores DB, stack traces, secretos o identificadores sensibles.
- Validar solo happy path o estado vacío.
- Dar por aprobada una UI sin QA humana.
- Revisar el propio trabajo como única revisión independiente.
- Declarar tests verdes sin ejecutarlos.
- Ignorar CI rojo, bajar cobertura o desactivar checks.
- Ejecutar stage, commit, push, PR o merge sin autorización de Nico.
- Limpiar el working tree con comandos destructivos.
- Dejar documentación desactualizada después de cambiar contratos.

## 32. Continuidad entre chats

Cada chat nuevo debe recibir un handoff mínimo:

```text
Repo:
Rama:
Commit base:
Objetivo:
Scope incluido:
Scope excluido:
Archivos modificados:
Decisiones aprobadas:
Validaciones ejecutadas y resultado:
Validaciones pendientes:
Riesgos o bloqueos:
Próximo paso exacto:
```

El nuevo agente debe verificar el estado real por terminal; el handoff orienta, pero no reemplaza `git status`, rama, log y diff.

## 33. Checklist rápido

### Antes

- [ ] Rama y base correctas.
- [ ] Working tree limpio o cambios preexistentes identificados.
- [ ] Scope y exclusiones explícitos.
- [ ] Referencias legacy y archivos reales inspeccionados.
- [ ] Tests y scripts reales confirmados.
- [ ] Ambigüedades resueltas.
- [ ] PRD/issues/DAG creados si el tamaño lo exige.
- [ ] Riesgos y plan mínimo reportados.

### Durante

- [ ] Cambio mínimo dentro del scope.
- [ ] TDD o contratos aplicados.
- [ ] Seguridad, accesibilidad y responsive preservados.
- [ ] Sin secretos, dependencias o archivos accidentales.
- [ ] Markdown actualizado.

### Cierre

- [ ] Validaciones ejecutadas y clasificadas.
- [ ] QA humana realizada cuando aplica.
- [ ] Diff revisado.
- [ ] Revisión independiente resuelta.
- [ ] Solo archivos autorizados.
- [ ] Riesgo residual documentado.
- [ ] Comandos manuales entregados a Nico.
- [ ] Body del PR conforme a `.github/PULL_REQUEST_TEMPLATE.md`, con los headings `## Summary`, `## Scope`, `## Validation` y `## Rollback` presentes.
- [ ] Exactamente un scope primario marcado, o una excepción `mixed-scope` válida con todos los scopes reales declarados y justificados.
- [ ] Rollback documentado con trigger, pasos e impacto en datos.
- [ ] Checks verdes correspondientes al SHA actual del PR, no a un SHA anterior.
- [ ] Ningún review thread accionable abierto.
- [ ] `mergeStateStatus` verificado como `CLEAN` antes del merge.
- [ ] HEAD local y rama remota coherentes.
- [ ] Ningún uso de `--admin` como workaround de branch protection.

## 34. Comando estándar de cierre

Antes de entregar cualquier implementación o documentación:

### Terminal 1

```powershell
Set-Location C:\PORTAL-VETNEB
git status --short
git diff --stat
git diff --check
git diff --name-only
```

Después de que Nico cree el PR, el comando estándar para observar checks es:

```powershell
gh pr checks --watch
```

Y, antes de decidir el merge, el comando estándar para verificar mergeabilidad real es:

```powershell
gh pr view `
  --json number,title,state,mergeStateStatus,headRefName,baseRefName,statusCheckRollup,url
```

Un check verde en `gh pr checks --watch` no autoriza el merge por sí solo; ver [Sección 24](#24-checks) y [Sección 26](#26-merge).

## 35. Criterio final

Una tarea VETNEB está lista para entrega cuando el resultado observable cumple el objetivo y los criterios de aceptación; el diff contiene solo el scope autorizado; las validaciones y la QA aplicables tienen evidencia real; la revisión independiente no presenta bloqueantes; la documentación está actualizada; no se expusieron secretos ni se degradaron invariantes; y Nico conserva pendientes únicamente las acciones manuales de Git, PR, checks y merge.
