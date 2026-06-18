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
- `IMPLEMENTATION_NOTES`

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

Nico crea el PR manualmente con un body breve y verificable:

```markdown
## Objetivo

<problema y resultado>

## Scope

- <incluido>

## Exclusiones

- <no tocado>

## Cambios

- <cambio observable>

## Validaciones

- `<comando>` — <resultado>

## QA humana

- <matriz y resultado>

## Riesgo residual

- <riesgo o ninguno conocido>

## Documentación

- `<ruta del markdown>`
```

No afirmar cobertura, seguridad o compatibilidad que no haya sido verificada.

## 24. Checks

Después de que Nico haga push y cree el PR:

### Terminal 1 — manual por Nico

```powershell
Set-Location C:\PORTAL-VETNEB
gh pr checks --watch
```

No usar `gh pr checks <NUMERO_PR> --watch`. Un check verde no reemplaza la revisión de diff ni la QA humana.

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

Solo Nico decide y ejecuta el merge cuando:

- scope y diff están aprobados;
- validaciones requeridas están verdes o existe una excepción documentada y aceptada;
- revisión independiente no tiene hallazgos bloqueantes;
- QA humana está aprobada;
- markdown y body del PR están actualizados;
- riesgo residual es conocido y aceptable.

No mezclar el merge con cambios adicionales de último minuto.

## 27. Limpieza local post-merge

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

No usar `git branch -D`, `git reset`, `git clean` ni restauraciones masivas como limpieza rutinaria.

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

## 35. Criterio final

Una tarea VETNEB está lista para entrega cuando el resultado observable cumple el objetivo y los criterios de aceptación; el diff contiene solo el scope autorizado; las validaciones y la QA aplicables tienen evidencia real; la revisión independiente no presenta bloqueantes; la documentación está actualizada; no se expusieron secretos ni se degradaron invariantes; y Nico conserva pendientes únicamente las acciones manuales de Git, PR, checks y merge.
