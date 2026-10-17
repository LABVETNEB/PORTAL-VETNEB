# D10: fallo tardío de navegación y reintento

## Estado base y alcance

Base `efdf09b79d81ceebfbf102d8764bd7960bb027d8`, rama `codex/c17-unblock-d10`. Las dos celdas F4 ya tenían una corrección local pendiente en este worktree y pasaban 2/2. F7 fallaba en sus dos variantes de viewport y Navigation API: tras responder 500 al reintento retenido, la selección posterior permanecía en el escenario visual, pero la URL seguía en el módulo de origen. No hubo evento `load`; la espera histórica de ese evento agotaba los 30 segundos.

Este cambio se limita a D10: reintento del dashboard, cuatro celdas de fallo tardío, cobertura y guard de autoridad de navegación. Quedan fuera C17, A03, Perfil Clínica funcional, Next.js y sus dependencias.

## Investigación y causa

El reintento del producto llamaba `router.refresh()`. En Next 16.4.0, el `refresh-reducer` construye un refresh de la URL actual y comparte su cola de acciones con la navegación posterior; `app-router-instance` permite que una navegación sustituya una acción pendiente. Al retener la respuesta Flight/RSC del refresh, seleccionar otro módulo y contestar 500 al refresh, el estado visual de la selección más reciente quedaba adelantado respecto de la URL. La respuesta tardía bloqueaba la confirmación de la nueva ruta. El problema se reprodujo sin retries en F7 2/2. La aserción corregida, que exige convergencia real en vez de esperar una recarga, también quedó RED 2/2 antes del cambio productivo.

## Corrección

`DashboardRefreshButton` reintenta con `router.replace` a la URL actual completa (pathname, query y hash) y `scroll: false`. Sigue solicitando datos nuevos del servidor, conserva la entrada de historial y no inicia una navegación de documento. El destino se obtiene únicamente de `window.location`, por lo que no admite una URL aportada por un usuario o fixture.

El guard `dashboard-navigation-single-owner` reconoce solamente esa expresión exacta como destino local legible. Las mutaciones de query, hash y destino arbitrario vuelven a ser rechazadas. No se añade un segundo propietario de selección de módulo. Las pruebas F4 y F7 ahora exigen la autoridad de la selección reciente, convergencia URL/vista/FSM/almacenamiento, ausencia de cargas de documento y de entradas extra de historial. Una prueba independiente verifica que el reintento recupera informes tras cambiar la sesión sintética y obtiene exactamente un nuevo payload RSC.

## Corrección en compilación de producción

Las cuatro celdas pasaban con `next dev` y fallaban 4/4 con `next build` + `next start` (también F4 × S1 con un worker): `Execution context was destroyed` en F4 y `the failed refresh does not reload the document` en F7. En producción la ruta del módulo ya es conocida, así que Next 16.4.0 navega con `navigateToKnownRoute` y pide los datos dinámicos aparte (`render-tree.js`, `fetchMissingDynamicData`). Si esa respuesta falla, `dispatchRetryDueToTreeMismatch` despacha `ACTION_SERVER_PATCH` con `mpa: true`, y `server-patch-reducer.js` ejecuta `completeHardNavigation` antes de su propio chequeo `previousTree !== state.tree`. El 524 tardío de un vuelo abandonado o el 500 del reintento recargan la URL abandonada sobre la selección vigente. Con `next dev` la ruta no está precargada y la acción pendiente se descarta al llegar la navegación posterior, por eso no se reproducía. El defecto sigue en `next@16.4.2` y en `16.5.0-canary.16`, así que actualizar Next no lo corrige.

`supersededFlightGuard.ts` envuelve `window.fetch` mientras el `DashboardNavigationProvider` está montado. Sólo actúa sobre payloads de navegación del router (`GET` con `rsc: 1`, sin `next-router-prefetch`): si uno falla (status no 2xx o rechazo de red no abortado) cuando ya se emitió un payload de navegación posterior, la falla no se entrega al router y el vuelo queda como uno que nunca responde, que es lo que el owner ya hace con un vuelo abandonado (F1). El payload más reciente conserva el fallback documental de Next (F3, F4 sin selección posterior, F5), y las respuestas, prefetches, Server Actions y solicitudes de API llegan sin cambios. No se modifica `node_modules`, no hay recargas añadidas ni un segundo propietario de selección.

## Evidencia de validación

| Gate | Resultado |
| --- | --- |
| F7 original, sin retries | FAILED 2/2, timeout de `load` y URL sin convergencia |
| F7 con aserción contractual antes de la corrección | FAILED 2/2, URL del módulo de origen |
| F7 con `router.replace` local | PASSED 2/2 |
| F4, F6 y F7 dirigidos | PASSED 7/7 antes del ajuste de catálogo y guard |
| F4, F6, F7 y cobertura D10 | PASSED 8/8 antes de la prueba adicional de reintento |
| Reintento de datos con sesión sintética | PASSED 1/1 |
| Guard de propietario único, incluidas cuatro mutaciones | PASSED 10/10 |
| Guards dirigidos de FSM, catálogo y navegación | PASSED 371/371 |
| Lint frontend | PASSED, exit 0 |
| Typecheck frontend | PASSED, exit 0 |
| Build frontend | PASSED, exit 0 |
| D10 F4/F7 finales, sin retries (más censo de cuatro celdas) | PASSED 5/5 |
| `visual-contract` completo | FAILED, 943 aprobadas, 1 fallida, 1 omitida (8,4 min) |
| Caso fallido aislado, sin retries, un worker | PASSED 2/2 (con y sin Navigation API) |
| `security:public-surface` | PASSED, exit 0 |
| `validate:local` | FAILED, exit 1 |
| D10 en `next start`, sin guard, 1 worker | FAILED 4/4 (fallback documental) |
| Unidad `dashboard-navigation-superseded-flight` | PASSED 7/7 (RED antes del módulo) |
| D10 en `next start`, con guard, 1 y 4 workers | PASSED 5/5 y 5/5 |
| Matriz de fallos completa en `next start`, 4 workers | PASSED 63/63 |
| FSM admin y clínica, puntero real, recuperación de requests y C10 en `next start` | PASSED 157/157 |
| D10, F6 y reintento de datos en `next dev` | PASSED 9/9 |

El único fallo de la cohorte ocurrió en `dashboard-real-pointer-navigation.spec.ts`, ruta de Clínica `/dashboard/logistica` a 1366×768, antes de la lógica del test: `page.goto` devolvió `net::ERR_NO_BUFFER_SPACE`. El spec no fue modificado por D10. La misma prueba y su variante sin Navigation API pasaron en ejecución aislada 2/2, sin retries. La firma señala agotamiento intermitente de recursos de red locales bajo los diez workers de la cohorte; esa causalidad es una inferencia, no una demostración de independencia absoluta. La cohorte sigue FAILED. No se repite entera sin una hipótesis adicional ni se sustituye por la prueba aislada.

`validate:local` llegó a los tests de Node y falló. Dos firmas dirigidas se confirmaron: `tracked-source-inventory.test.ts` intenta abrir `<worktree>/.git/index`, pero este checkout auxiliar usa el gitdir de worktrees y no tiene ese path (13/14); `e2e-global-03b-authoritative-auth-boundary.fastify.test.ts` exige `portal_vetneb_ci` en PostgreSQL local y la variable para esa DB aislada no está disponible (0/1). No se editan esos contratos fuera del scope D10 ni se usan bases reales. El resultado de `validate:local` permanece FAILED; sus etapas posteriores no se ejecutaron.

## Riesgo residual y reversión

La semántica de reintento pasa de `refresh` a navegación `replace` de la misma URL. El test de datos comprueba que vuelve a pedir el contenido RSC; F7 comprueba que una respuesta vieja no desplaza una selección posterior. El cambio se revierte restaurando la llamada del botón y el guard asociado, pero reaparece F7. La guarda depende de dos hechos de Next 16.4: el header `rsc: 1` de los payloads de navegación y una única solicitud de navegación por navegación del dashboard (sin rutas paralelas ni interceptadas). Si Next cambia esos headers, la guarda deja de actuar y reaparece D10 sin bloquear navegaciones; las cuatro celdas en `next start` lo detectan. Un payload retenido queda pendiente en memoria hasta que se descarga el documento. La guarda se retira cuando Next compruebe la obsolescencia antes del fallback documental. La descripción histórica de D10 en la hoja de ruta corresponde a la base anterior y se conserva como antecedente.

## Estado final

Las cuatro celdas D10 cumplen su contrato en `next dev` y en `next start`. La entrega del worktree queda `BLOCKED` por los gates completos fallidos. El primer `visual-contract` falló con `ERR_NO_BUFFER_SPACE`; la repetición controlada de dos workers terminó con seis fallos C10, descritos más abajo. `validate:local` mantiene las dos precondiciones ajenas a D10. Se requiere una cohorte completa aprobada y ejecutar `validate:local` en un entorno con índice Git compatible y PostgreSQL de pruebas aislado antes de declarar el cierre contractual. No se alteró el índice, los stashes ni el worktree C17.

## Seguimiento de validación en worktree

Se inició una única repetición de `visual-contract` con el mismo catálogo de 38 specs, `--workers=2 --retries=0 --reporter=dot`, sin cambiar la configuración persistente. En el control de proceso seguían activos el runner y su CLI Playwright, iniciados a la misma hora; el resultado de esa ejecución permanecía `RUNNING` al redactar este seguimiento. No se inició otra cohorte. El host tenía 31,65 GB físicos y 17,78 GB libres antes de la ejecución; durante ella se observaron 14,77 GB libres y 1.124 conexiones TCP en `TIME_WAIT`. Estas mediciones no prueban por sí solas la causa de `ERR_NO_BUFFER_SPACE` anterior.

El fallo del inventario tracked es independiente de D10: `test/architecture/tracked-source-inventory.test.ts` abre directamente `<checkout>/.git/index`, ausente en un worktree (RED 13/14 en el test dirigido). `git rev-parse --git-path index` devuelve el índice del gitdir auxiliar en este worktree y `.git/index` en el checkout ordinario. El helper `test/helpers/tracked-source-files.ts` ya detecta que `.git` no es directorio y usa `git ls-files` en ese caso, conservando el filtro de untracked. Corregir el test es scope test-only propio; §4 exige separarlo del PR D10, por lo que no se modificó aquí ni se declaró GREEN.

Auth 03b sigue sin la base aislada `portal_vetneb_ci` en este entorno. Su PASS anterior en C17 no se transfiere a este árbol y no se repitió el gate.

La ejecución visual controlada terminó `FAILED` con seis casos de `dashboard-c10-super-search-field.spec.ts`; `.last-run.json` registra exactamente seis identificadores fallidos y los seis `error-context.md` pertenecen a ese spec. C10 y `SuperSearchField` son idénticos al HEAD base; el botón D10 no se monta en Auditoría. El arnés C10 se agrega a `main.dashboard-main` después de ver el markup de Auditoría y esperar dos frames, pero antes de confirmar la hidratación React. En los fallos, el searchbox/contenedor del arnés llega a existir y luego desaparece mientras Auditoría sigue visible. Los arneses C11–C15 ya esperan explícitamente la marca React de `main` antes de insertarse. La causa respaldada por código y capturas es el arnés insertado antes del commit de hidratación; no hay evidencia de una regresión causada por D10.

La corrección pertenece a un PR C10 independiente bajo §4: esperar la hidratación del `main.dashboard-main` con la comprobación causal ya usada por C11–C15, antes de `page.addScriptTag({ content: harness })`. Después debe ejecutarse únicamente el spec C10 completo, sin retries, y preservar sus aserciones de geometría, foco, teclado y limpieza. No se editó C10 en este worktree D10 ni se declaró GREEN para esa corrección.
