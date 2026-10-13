# Navegación FSM del dashboard Clínica: rutas completas y retiro del hand-over (PR-NAV-05)

| Campo | Valor |
| --- | --- |
| Tipo | Implementación frontend (R1) |
| Fecha | 2026-10-13 |
| Rama | `feat/dashboard-navigation-fsm-full-routes` |
| Base | `main` = `8be59a30c9b744bcfd3f9e42355dd9749ccb1794` (#1859, PR-NAV-04) |
| Norma | `docs/audit/AUDITORIA_ARQUITECTURA_NAVEGACION_FSM_HOJA_DE_RUTA.md` rev. 2.3: §11.3, §12.1, §12.4, §12.5, §12.5.1, §16 (ficha PR-NAV-05), §21 |
| Scope de gobernanza | `frontend` (tests y documentación son categorías de soporte) |
| Estado | Implementado en el árbol de trabajo; sin commit. Todas las operaciones Git/GitHub son [MANUAL-NICO] |

## 1. Estado base

Tras PR-NAV-04 el store de Clínica ya vivía a través de `/dashboard` y de sus rutas completas, y el chrome
(banda, barra, kebab, búsqueda, tarjetas del hub) ya preguntaba al owner antes de navegar. Quedaban fuera de
la máquina, por exclusión expresa de aquella ficha, tres piezas:

- `ClinicFullRouteModuleStage.tsx`: escuchaba el bus `subscribeClinicModuleActivate` con `handsOver`, tenía
  estado propio (`leavingTo`) y sus propios oyentes de Back/Forward (`subscribeHistoryTraversal` + `popstate`).
- `FullModuleRouteControl.tsx` ("Abrir módulo completo"): navegaba con su propio `router.push` dentro de
  `useTransition`; la máquina sólo veía el commit, como externo (#22).
- `clinic-hub-reset.ts`: conservaba el bus de oyentes, el replay `unheardActivation`, el guard de
  `window.event` y `relinquishClinicModuleActivateHandOver`.

La máquina (`dashboardNavigationMachine.ts`), el coordinador (`dashboardNavigationCoordinator.ts`) y sus
suites **no se modifican**.

Decisiones normativas aplicadas tal como están aprobadas: DT-1 (T2, `router.push`/`router.replace`), DT-2
(ninguna selección inicia `router.refresh()`), DT-5 (10 000 ms, sin cambio), DT-8 (restauración opción C),
DT-9, DT-10, DT-12 (coordinador FIFO existente), DT-15 (opción A) y DT-16 (fila #25). **DT-13 sigue
pendiente** y su semántica no se toca (§9).

## 2. Scope

**Incluido.** Los tres archivos de la ficha; una extensión del hook de Clínica en
`DashboardNavigationProvider.tsx` (§4.1), que es el único poseedor del store y por lo tanto el único lugar
desde el que una vista puede leer el `display` de ruta o despachar `OPEN_ROUTE`; realineación de los dos
guards que anclaban el hand-over; E2E de la ficha en el spec de Clínica existente y su entrada de catálogo.

**Excluido, deliberadamente.**

- Máquina, tabla de transiciones, coordinador y sus suites; semántica de Admin; backend, DB, `loading.tsx`,
  Service Worker, dependencias, workflows, CI y la hoja de ruta.
- `DashboardNavigationFrame.tsx`, `useStageModule.ts`, `stageModule.ts` y el resto del chrome: sin diff. La
  banda de una ruta completa sigue leyendo lo que el stage publica (§4.2).
- `historyTraversal.ts`, `useNavigationFlight.ts`, `navigationFlight.ts` y las funciones de estado de
  `clinicNavigationState.ts`: quedan en el árbol. `historyTraversal.ts` pierde aquí a su último importador;
  su retiro, con el del resto del código inerte, es PR-NAV-07.
- PR-NAV-06 (matriz consolidada), PR-NAV-07 (guard "un solo intérprete") y PR-NAV-08 (cierre documental).
- La medición de H1 para recuperar la navegación inmediata entre páginas desde una ruta completa (ficha
  PR-NAV-04, rev. 2.3): no se hizo y el reclamo secuencial se conserva (§11).

## 3. Ownership: antes y después

Diagnóstico del modelo anterior (RED-1), por lectura de `8be59a30`:

| # | Pregunta | Antes | Ahora |
| --- | --- | --- | --- |
| A | Qué navegación conservaban el stage y el control | Stage: ninguna propia, pero un estado visual paralelo (`leavingTo`). Control: `router.push(href)` propio | Ninguna. Ambos son vistas del `display` |
| B | `handsOver` | Marcaba a un oyente del bus que oía cada pedido sin reclamarlo ni "asentarlo" | Retirado. No hay bus |
| C | `unheardActivation` | Guardaba 5 s el último pedido que ningún oyente final oyó, para reproducirlo al siguiente suscriptor. Sin consumidor desde PR-NAV-04 | Retirado. La selección reclamada es `next` de la máquina (#29, #30) |
| D | `window.event` | `isHistoryTraversalDispatch()` en el adaptador: descartaba el replay si el suscriptor se montaba dentro de un `popstate` | Retirado con el replay |
| E | `relinquish…HandOver` | El stage lo llamaba al empezar un Back/Forward para soltar el pedido retenido | Retirado. Un traverse es `TRAVERSE_STARTED` (#17, #28) |
| F | `pending` | Control: `isPending` de `useTransition`, sin presupuesto. Stage: `leavingTo !== null` | `display` de la máquina: `navigation.route === href` en el control; `navigation.route !== pathname` en el stage |
| G | Payload que nunca responde | Desde una ruta completa la máquina ya llegaba a `STALLED`, pero **sin UI**: el stage quedaba en "Cargando…" sin aviso. Desde el control no había `ROUTING`: el botón giraba sin fin | `STALLED` visible y recuperable en ambos casos (§5) |
| H | Recuperación | Sólo otra selección (#16), sin que nada lo indicara; el control, sólo recargando | "Reintentar" (`RETRY` → `HARD_NAVIGATE`, #15) u otra selección (#16) |
| I | Back/Forward con vuelo activo | El stage soltaba su estado con dos oyentes propios; la máquina, en paralelo, procesaba `TRAVERSE_STARTED` | Sólo la máquina. El stage muestra el `display` del traverse |
| J | URL / display / workspace | El stage mostraba `leavingTo`; el chrome, el `display`; coincidían por construcción del bus, no por una única fuente | Una fuente: `display`, previsualizado en el mismo render que la URL (§11.3) |
| K | Último módulo | `PERSIST` de la máquina desde PR-NAV-04 (#1 al entrar por una ruta completa) | Sin cambio (§6) |
| L | Rutas que saltaban el owner | `FullModuleRouteControl` (dos usos). Los enlaces entre subrutas de logística y el resto de los `PublicRouteControl` siguen siendo commits externos (#22), fuera de la ficha | El control pasa por `OPEN_ROUTE` |

## 4. Arquitectura entregada

### 4.1. Provider — `DashboardNavigationProvider.tsx`

`useClinicDashboardNavigation()` gana dos campos; nada más cambia en el archivo:

- `route: string | null` — el `path` de la ruta completa que el `display` nombra.
- `openRoute(href): boolean` — despacha `OPEN_ROUTE` y devuelve `true`. Devuelve `false`, sin despachar,
  cuando `href` no es una ruta completa de Clínica con módulo propio (la máquina lo ignoraría, #6) o cuando el
  estado es `BOOTING` o `FAILED` (DT-10). La ubicación sale de `CLINIC_SURFACE.locate`, la misma gramática
  que lee la URL: una sola definición de qué módulo nombra una ruta.

Es el único emisor de `OPEN_ROUTE` en `frontend/src`. Admin no cambia.

### 4.2. Stage — `ClinicFullRouteModuleStage.tsx`

Vista sin estado ni efectos de navegación:

```text
leaving   = hay owner  y  display.route ≠ pathname de este render
leavingTo = leaving ? display.module : null
```

- `!leaving` → el contenido propio de la ruta.
- `leaving` → `LoadingState` del destino, con el `moduleId` del módulo destino en el workspace cuando el
  destino es un módulo (lo que ya afirmaban los E2E existentes).
- `STALLED` → el aviso `role="status"` con "Reintentar", como ancla de altura cero sobre el stage: no cambia
  la altura que mide el workspace (Zero Scroll) y la banda, la barra y la app bar siguen operativas.

El stage sigue publicando `leavingTo` en `stageModule.ts`. No es una segunda decisión: es el `display` de la
máquina por el canal que lee la banda de las rutas completas (`ClinicRouteNavigation`), que se renderiza
fuera de toda frontera y no se toca en esta PR.

Como el `display` se previsualiza en el mismo render que la URL, el stage que se monta con un commit nunca
muestra un módulo obsoleto: si la ruta aterriza con otra selección reclamada (#30), se monta mostrando ya la
selección reclamada.

### 4.3. Control — `FullModuleRouteControl.tsx`

`onClick` pregunta `navigation.openRoute(href)` y hace `preventDefault()` sólo si el owner tomó la selección;
el owner navega con `router.push(href, { scroll: false })`. Si el owner declina, el `PublicRouteControl`
navega por su propio `href`, igual que el resto del chrome (DT-10). `aria-busy` y "Abriendo módulo…" derivan
de `navigation.route === href`. Marcado, clases, nombre accesible, foco, activación por teclado y el fallback
de pre-hidratación (`data-public-route-*`) no cambian. El control es un `button`: no tenía ni tiene semántica
de enlace con modificadores.

### 4.4. Adaptador — `clinic-hub-reset.ts`

Queda igual al de Admin: `registerClinicNavigationOwner`, `requestClinicHubReset`,
`requestClinicModuleActivate` (la respuesta del owner, o `false` sin owner). Sin imports, sin DOM.

## 5. `ROUTING`, `STALLED` y `HARD_NAVIGATE`

| Origen | Selección | Fila | Qué se ve |
| --- | --- | --- | --- |
| Ruta completa | Módulo en la banda | #5 | El stage pasa al workspace pendiente del destino; URL en la ruta |
| Shell | "Abrir módulo completo" | #8 | El control pasa a pendiente; el stage sigue en la URL |
| Cualquiera | Presupuesto vencido (10 000 ms) sin nada reclamado | #12 | Aviso `role="status"` + "Reintentar" en el stage que esté montado |
| `STALLED` | "Reintentar" | #15 | Navegación de documento al mismo destino (`assign` para un push, `replace` para un replace); presupuesto nuevo |
| `STALLED` | Otra selección | #16 | Navega; el aviso se va |
| `STALLED` | El destino responde tarde | #14 | Reposa en el destino |
| `ROUTING` | Segunda selección antes del commit | #29 → #30 / #31 | Reclamada; sale al aterrizar la primera, o al vencer el presupuesto |

No queda estado sin salida: `STALLED` sale por #14, #15, #16, #17 o #20; no hay timers huérfanos porque los
presupuestos son función del estado (A6) y los E2E avanzan el reloj otro presupuesto después de cada
recuperación y afirman que no aparece nada.

## 6. Persistencia del último módulo e historial

Sin cambios de comportamiento respecto de PR-NAV-04, que ya había fijado §12.1 rev. 2.1; esta PR agrega
evidencia:

- Entrada directa a `/dashboard/informes` → almacenado = `informes` → `/dashboard` desnudo en un documento
  nuevo restaura `informes` con un `replace`; Back vuelve a la ruta (0 entradas extra).
- "Abrir módulo completo" es **un** push; una selección reclamada sobre ese vuelo reemplaza su entrada
  (#30): la ráfaga deja una entrada.
- "Reintentar" de un push agrega la entrada que el push habría agregado.
- **C-5 / S12: NOT_APPLICABLE en navegador.** Las cinco rutas completas de Clínica (`/dashboard/informes`,
  `/dashboard/logistica`, `/dashboard/logistica/{metricas,rutas,visitas}`) nombran un módulo válido en su
  primer segmento; no existe ninguna sin módulo resoluble. El contrato queda cubierto en unit: una ruta sin
  módulo reposa sin `PERSIST`, y `OPEN_ROUTE` hacia ella no es una selección (#6).

## 7. Recuperación de errores (C-6)

Los E2E de PR-NAV-04 se conservan sin tocar y corren ahora con el stage y el control ya migrados:

- `_rsc` truncado de la ruta abierta con "Abrir módulo completo" → frontera; el `NAV_FAILED` cancela el
  presupuesto del `OPEN_ROUTE` (#20), no aparece `STALLED`; Back a `/dashboard` la desmonta sin "Reintentar";
  el clic siguiente navega y el posterior queda reclamado.
- Simétrico: fallo en `/dashboard`, Back hacia una ruta completa, y el owner navega desde ahí.
- Con la frontera visible el control no está montado (la frontera reemplaza la página); el chrome navega por
  su cuenta (DT-10).

## 8. Concurrencia (C-8, C-10, C-11)

| Contrato | Evidencia |
| --- | --- |
| C-8 / L6 entre ruta completa y shell | Unit y E2E nuevo: Back + Forward antes del commit (#17, #28) y Back + módulo comiteado (#25), con el Back realmente en vuelo (el E2E afirma que su payload fue pedido y está retenido) |
| #29 → #30 a través del pathname | Unit y E2E nuevo: módulo elegido con "Abrir módulo completo" en vuelo |
| *Single flight*, *abandoned flight*, *superseded commit*, hand-over A→B desde ruta completa, Back antes del commit con y sin Navigation API | `dashboard-real-pointer-navigation`, sin tocar |
| Residual DT-15 | E2E existente, sin tocar: registrado, no afirmado en cero |

## 9. DT-13 pendiente y DT-5

- **DT-13** sigue pendiente. Esta PR no cambia la fila #21: tras un fallo de render durante la restauración,
  `RESET` reposa en la URL que encuentra y persiste su módulo. Los dos E2E que lo fijan "tal como es" pasan
  sin cambios.
- **DT-5** se conserva en 10 000 ms: `NAVIGATION_FLIGHT_BUDGET_MS`, un único `setTimeout` en el provider.

## 10. RED / GREEN

**RED, sobre `8be59a30` sin tocar código productivo.**

- `test/architecture/dashboard-navigation-fsm-clinic.test.ts`: 4 de 24 en rojo, los cuatro causales — el
  adaptador exporta el bus; el adaptador conserva el hand-over; el stage no lee el owner; el control no
  despacha `OPEN_ROUTE`. Los 20 restantes afirman contratos de la máquina y del coordinador, que ya estaban.
- E2E nuevos sobre el build de `main`: 5 de 6 en rojo. No existe aviso de `STALLED` en una ruta completa
  (2), "Abrir módulo completo" no llega a `STALLED` (2) y una selección sobre su vuelo sale como un segundo
  push en vez de quedar reclamada (1). El sexto (C-8) pasaba y queda como regresión; en su primera versión
  pasaba en vacío (ver abajo).

**GREEN.** Unit 24 de 24. Spec de Clínica 43 de 43, y 172 de 172 con `--repeat-each=4`.

**Corrección de un E2E propio durante el GREEN.** La primera versión del E2E de C-8 hacía Back sobre una
entrada que el router todavía tenía en caché: el Back comiteaba al instante y el clic siguiente era una
navegación común, que con el payload retenido llega legítimamente a `STALLED`. En `main` pasaba porque la
ruta completa no tenía aviso. No era un defecto del producto. El escenario se rehízo para que el Back esté
realmente en vuelo (documento nuevo antes de cada Back) y afirma esa premisa.

## 11. Guards y E2E realineados

Ninguna aserción se retira sin reemplazo.

| Guard | Aserción retirada | Motivo | Reemplazo |
| --- | --- | --- | --- |
| `dashboard-navigation-fsm-clinic` · adaptador (comportamiento) | El stage con `handsOver` oye cada pedido y nunca reclama; `relinquishClinicModuleActivateHandOver()` | El bus no existe | El módulo exporta exactamente tres funciones; el resto del test (owner, DT-10, reemplazo de owner) sin cambios |
| ídem · "hand-over is kept for PR-NAV-05" | `handsOver`, `relinquish…`, `subscribe…` presentes; el stage no importa el provider | Era el ancla de la exclusión de PR-NAV-04 | Once identificadores retirados ausentes del adaptador; ningún consumidor del bus en stage, control, controlador, provider ni frame; el stage y el control leen el owner (dos tests nuevos de ownership) |
| `frontend-dashboard-lateral-navigation` · "a clinic tap before the controller subscribes is handed over once" | Replay de un pedido no oído al siguiente suscriptor | §11.3: el store existe antes que cualquier página; el replay no tenía consumidor desde PR-NAV-04 | "a clinic request with no navigation owner is left to the caller and never replayed", el mismo contrato que Admin tiene desde PR-NAV-03 |
| ídem · SINGLE FLIGHT (bloque Clínica) | Un oyente del bus reclama según su respuesta; un stage con `handsOver` nunca reclama | El reclamo es la fila #29 | El owner registrado decide; el adaptador no tiene con qué suscribir un segundo reclamante |
| ídem · "Abrir módulo completo shows its pending state…" | `useTransition`, `startTransition(() => router.push(href))`, `aria-busy={isPending …}` sobre el flag de la transición | El pendiente es el `display` | `isPending = navigation?.route === href`; `openRoute`; `aria-busy`, texto y `PublicRouteControl` conservados; sin `useTransition`. E2E *clinic full-module control*, sin tocar |
| ídem · "a full-route stage hands the latest activation to the controller that replaces it" | El último pedido sobrevive al cambio de owner; no se reproduce dos veces; un traverse lo suelta | Era el contrato del bus | "a full-route stage keeps no activation: the store that outlives the route does": el stage no tiene estado; #30 en la máquina; un slot de store por superficie, no por pathname. Unit nuevo #29–#30 a través del pathname. E2E *A then B before A commits keeps B across the owner handoff*, sin tocar |
| ídem · "an owner mounted by Back/Forward inside popstate never adopts the kept destination" | Guard de `window.event` | No hay destino retenido que adoptar | Los dos productores de `TRAVERSE_STARTED` (Navigation API y `popstate`) y las filas #17/#28. E2E *Back before the commit…*, con y sin Navigation API, sin tocar |

E2E existentes: ninguno se debilita. En `dashboard-navigation-fsm-clinic.spec.ts` se agregan seis escenarios;
al de persistencia de ruta completa se le suma la aserción de historial (Back vuelve a la ruta); cambia un
comentario del E2E de C-6. `catalog.ts`: se amplían `proves` y `notes` de esa entrada; ningún conteo cambia.

## 12. Riesgos residuales

| Riesgo | Estado |
| --- | --- |
| DT-13 | Pendiente de decisión; fijado por unit y E2E tal como es |
| Desde una ruta completa la segunda elección espera a la primera (secuencial) | Deliberado en la norma. La medición de H1 que la ficha de PR-NAV-04 pide para cambiarlo no se hizo |
| El aviso de `STALLED` existe ahora en tres archivos (controlador Admin, controlador Clínica, stage de ruta completa) | Deliberado: extraerlo exige tocar los dos controladores, fuera de la ficha. Candidato a PR-NAV-07 |
| `historyTraversal.ts` queda sin importadores, junto con `useNavigationFlight.ts` y las funciones de estado de `clinicNavigationState.ts` | Código inerte; retiro asignado a PR-NAV-07 |
| Comentarios que todavía describen el modelo de hand-over en archivos fuera de scope (`DashboardNavigationFrame.tsx`, `useStageModule.ts`, `stageModule.ts`, `navigationFlight.ts`) | Reportado; no se tocan aquí |
| Un `display` que es otra ruta completa o el hub (traverse entre rutas completas, `SELECT_HUB`) muestra el estado de carga genérico, sin nombre de módulo, y la banda conserva el módulo de la ruta | `SELECT_HUB` no tiene emisor en el producto; el traverse entre rutas completas dura lo que tarde su payload |
| Los enlaces entre subrutas de logística y otros `PublicRouteControl` a rutas completas siguen siendo commits externos (#22): sin presupuesto ni `STALLED` | Fuera de la ficha, que nombra `FullModuleRouteControl`. A evaluar en PR-NAV-06/07 |
| Residual DT-15 | Registrado por E2E, no afirmado en cero |
| Evidencia sólo local (Windows, Chromium de Playwright) | La válida para el merge es la de CI Linux sobre el head de la PR |

## 13. Rollback

Revert del squash. Restaura el stage, el control, el adaptador con su bus, el hook del provider y los guards
y E2E realineados; Clínica vuelve exactamente a PR-NAV-04. Admin no cambia en ningún sentido. Sin
dependientes fusionados.

## 14. Validaciones

Ejecutadas en local (Windows, Chromium de Playwright), en secuencia y de a una tarea pesada, sobre el árbol
de trabajo sin commit. Los E2E corren sobre el production runner (`next start`) con las variables de build
de `frontend-ci.yml`. Estados canónicos de `AGENTS.md` §6.

| Gate | Estado | Observado |
| --- | --- | --- |
| Unit del corte (`test/architecture/dashboard-navigation-fsm-clinic.test.ts`) | PASSED | 24 de 24 |
| Guard realineado (`frontend-dashboard-lateral-navigation`) | PASSED | Junto con el anterior, 45 de 45 |
| Suites de la máquina y del coordinador (sin modificar) y tests de arquitectura | PASSED | Dentro de `pnpm test` |
| `pnpm --dir frontend lint` | PASSED | exit 0 |
| `pnpm --dir frontend typecheck` | PASSED | exit 0 |
| `pnpm --dir frontend build` | PASSED | exit 0; todas las rutas del dashboard siguen dinámicas |
| `pnpm typecheck:test` | PASSED | exit 0 |
| `pnpm security:public-surface` | PASSED | exit 0 |
| `pnpm test` | FAILED | 5334 de 5336 (1 skipped, preexistente). El único fallo es `e2e-global-03b-authoritative-auth-boundary.fastify.test.ts`, que requiere base de datos: ambiental, ajeno a este cambio. Repetido sobre el árbol final con el mismo resultado |
| E2E dirigido: `dashboard-navigation-fsm-clinic` | PASSED | 43 de 43; 172 de 172 con `--repeat-each=4` |
| E2E dirigidos: `dashboard-real-pointer-navigation` (incluida la variante sin Navigation API), `dashboard-clinic-full-route-stage-parity`, `navigation-truncated-stream-recovery`, `dashboard-navigation-fsm-admin`, `dashboard-global-live-navigation-sync` | PASSED | 179 de 179 |
| `pnpm --dir frontend e2e:visual-contract` | PASSED | 796 passed, 1 skipped |
| `pnpm --dir frontend e2e:public-clinic` | PASSED | 345 de 345 |
| Regresión de Admin: `pnpm --dir frontend e2e:admin-mobile` | PASSED | 159 de 159 |
| `pnpm --dir frontend e2e:smoke` | PASSED | 66 de 66 |
| `git diff --check` | PASSED | sin hallazgos |
| `frontend/next-env.d.ts` y artefactos Playwright | PASSED | sin cambios en el árbol; nada en el diff |
| C-5 / S12 en navegador | NOT_RUN | No aplicable: no existe una ruta completa sin módulo resoluble (§6); cubierto en unit |
| Specs de ruta completa de la cohorte `extended` (logística métricas/rutas/visitas adaptive, mobile no-horizontal-table, informes zero-internal-scroll y server-adaptive-pagination) | PASSED | 31 de 31, dirigidos |
| `e2e:extended` completa, `e2e:full` | NOT_RUN | No las exige la ficha ni el mapeo de §7 de `AGENTS.md` para este cambio |
| `pnpm typecheck`, `pnpm build` (backend), `pnpm audit` | NOT_RUN | Ningún archivo de backend ni de dependencias cambia |
| `db:migrate` | BLOCKED | Sin base de datos local ni autorización |

Las cohortes corrieron sobre el código y los tests finales; lo único creado después es este documento.

La evidencia válida para el merge es la de CI Linux sobre el head de la PR.
