# Navegación FSM del dashboard Admin (PR-NAV-03)

| Campo | Valor |
| --- | --- |
| Tipo | Implementación frontend (R1) |
| Fecha | 2026-10-12 |
| Rama | `feat/dashboard-navigation-fsm-admin` |
| Base | `main` = `e192d30703173d235ae67ad5a7d4bc5cc277ff74` (#1857, máquina rev. 2.3) |
| Norma | `docs/audit/AUDITORIA_ARQUITECTURA_NAVEGACION_FSM_HOJA_DE_RUTA.md` rev. 2.3: §11.3, §12.1, §12.5, §12.5.1, §12.6, §13, §13.1, §16 (ficha PR-NAV-03), §18, §21 |
| Scope de gobernanza | `frontend` (tests y documentación son categorías de soporte) |
| Estado | Implementado en el árbol de trabajo; sin commit. Todas las operaciones Git/GitHub son [MANUAL-NICO] |

## 1. Estado base

Hasta este cambio la máquina de navegación (`dashboardNavigationMachine.ts`) estaba en `main` sin ningún
consumidor: sólo la importaba su suite. El dashboard Admin navegaba por
`AdminDashboardWorkspaceController.tsx`, que concentraba nueve mecanismos con autoridad sobre URL, historial
y contenido (§3). La máquina y su suite **no se modifican** en esta PR.

Decisiones normativas aplicadas tal como están aprobadas: DT-1 (T2), DT-2 (ninguna selección inicia
`router.refresh()`), DT-5 (10 000 ms), DT-8 (restauración opción C), DT-9, DT-10, DT-11, DT-12 (intérprete
opción A), DT-14, DT-15 (opción A) y DT-16 (opción A). DT-13 sigue pendiente y no se resuelve aquí: sólo
afecta a Clínica.

## 2. Scope

**Incluido.** Coordinador sin React (§12.5.1), provider y owner de Admin, corte del controlador Admin,
adaptador de entrada, selector de `display` para el chrome, cableado de la frontera de error, realineación
de los guards que anclaban el mecanismo retirado, E2E de la ficha y sus censos.

**Excluido, deliberadamente.**

- Clínica: controlador, buses, rutas completas, persistencia y `stageModule` (PR-NAV-04/05). El provider no
  crea store ni despacha nada fuera de `/dashboard/admin` (§6).
- `dashboardNavigationMachine.ts` y su suite; `historyTraversal.ts`, `navigationFlight.ts`, `stageModule.ts`,
  `useNavigationFlight.ts`; el chrome; `page.tsx`.
- Backend, DB, workflows, Service Worker, dependencias, hoja de ruta FSM.
- La matriz de PR-NAV-06 (navegadores, Back/Forward sin Navigation API por superficie), el guard "un solo
  intérprete" de PR-NAV-07 y el cierre documental de PR-NAV-08.

## 3. Ownership: qué se retiró y quién lo decide ahora

| # | Autoridad anterior (controlador Admin) | Ahora |
| --- | --- | --- |
| 1 | Clasificación de commits en un efecto, `router.replace` de continuación y `window.history.back()` | Máquina: #9, #11, #23, #26, #30, #32. `history.back()` desaparece (DT-16, S9) |
| 2 | Restore de landing por `router.replace` en un efecto | Máquina: #2 y #3, emitidas al crear el store |
| 3 | `resolveRetiredHub`: `history.replaceState` nativo más `setActiveModule` | Máquina: `normalization` vía `settle` y #3, con `ROUTER_REPLACE` |
| 4 | Relevo al vencer el presupuesto (`useNavigationFlight` + `router.push`) | Máquina: #31 y #12; timers del coordinador (A6, A7) |
| 5 | Backstop `popstate` y flag de traverse | `TRAVERSE_STARTED` (#17, #24, #28), con productores del owner |
| 6 | Bus `subscribeAdminModuleActivate` con su copia del reclamo y el replay `unheardActivation` | Adaptador de despacho; el reclamo es la fila #29 |
| 7 | Stage publicado con `usePublishStageModule("admin", …)` | Selector del `display` de la máquina |
| 8 | Persistencia por efecto sobre el módulo optimista | Efecto `PERSIST`, sólo en confirmaciones (#1, `settle`, #25) |

El controlador queda como vista: no importa `useRouter`, no escribe historial, no lee ni escribe
almacenamiento y no tiene estado de navegación propio. Conserva el manejo de errores de acceso.

Autoridades externas que permanecen y que la máquina trata como commit externo (#22/#23): "Limpiar" de
auditoría (`router.replace`), el formulario GET de auditoría (documento), `DashboardNotificationsBell`
(`router.push`), logout y `BackForwardCacheGuard`.

## 4. Arquitectura entregada

### 4.1. Coordinador — `frontend/src/lib/dashboard/navigation/dashboardNavigationCoordinator.ts`

Implementa A1–A8 y la tabla de vigencia de §12.5.1 sin React, sin Next y sin DOM. Sólo tiene imports de
tipos; la máquina, el planificador de microtareas, el router, el almacenamiento y los timers se inyectan.

- `dispatch` aplica la transición al llamarse y encola sus efectos con `(flight, seq)`; nunca ejecuta nada.
- Un drenaje por bloque síncrono, en microtarea, sólo con el owner montado.
- Vigencia por `navId`; para el `ROUTER_PUSH` sin vuelo de #25 y #32, por `seq`.
- A6: al cierre de cada drenaje los timers quedan determinados por el estado.
- `commit(location)` entrega `URL_COMMITTED` sólo si la ubicación difiere de la última entregada por
  `HYDRATED`, `URL_COMMITTED` o `RESET` (H6); `previewDisplay` es la previsualización pura para el render.
- Una transición es inerte por definición (nada cambia y nada se emite), no por lista de filas.

### 4.2. Owner — `frontend/src/components/dashboard/DashboardNavigationProvider.tsx`

- `DashboardNavigationProvider` se monta en `app/dashboard/layout.tsx`. Sólo lee el `pathname`. En
  `/dashboard/admin` entrega un *slot* de store y monta `AdminNavigationOwner`; en cualquier otra ruta no
  entrega nada.
- El store se crea en render con `initial()` + `HYDRATED` (A1), una vez por visita a Admin, por el primer
  componente que renderiza con la URL en mano.
- `AdminNavigationOwner` no renderiza nada: despacha `URL_COMMITTED` en un efecto de layout, monta y
  desmonta el coordinador en un efecto pasivo (A4, A8), registra el adaptador y los productores de
  `TRAVERSE_STARTED` (Navigation API con su destino; `popstate` cuando no existe).
- `useAdminDashboardNavigation()` entrega a stage y chrome `{ module, stalled, retry }`. Previsualiza
  `URL_COMMITTED` en render, de modo que `display` cambia en el mismo commit que la URL (§11.3).
- `useDashboardNavigationBoundary()` entrega a la frontera `failed()` (NAV_FAILED) y `left()` (RESET con la
  última ubicación entregada).
- Efectos: `router.push`/`router.replace` con `{ scroll: false }` y `buildDashboardModuleHref`;
  `location.assign`/`replace` sólo para `HARD_NAVIGATE`; presupuesto con `NAVIGATION_FLIGHT_BUDGET_MS`
  importado de `navigationFlight.ts`, de modo que hay un único valor en el árbol.

### 4.3. Por qué el owner es un hermano y no un envoltorio

El layout sirve también rutas que el build intenta prerenderizar. Dos intentos anteriores, descartados:

1. `useSearchParams()` en el provider del layout: `next build` falla en `/dashboard/logistica/metricas`
   ("should be wrapped in a suspense boundary").
2. Envolver `children` en `<Suspense fallback={children}>`: el build pasa, pero el servidor envía la página
   **dos veces** (fallback y contenido) y el cliente las intercambia. Medido sobre el documento servido de
   `/dashboard/admin?module=admin-clinics`: 2 shells, 2 stages y 2 workspaces, 209 KB; con la estructura
   final, 1, 1 y 1, 142 KB.

La estructura final no envuelve `children` en nada: el owner es un hermano dentro de su propio
`<Suspense fallback={null}>` y cada consumidor del `display` lee la URL donde ya la leía, bajo el boundary
que ya tenía. El E2E de restauración fija "un shell, un stage y un workspace en el documento servido".

### 4.4. Frontera — `frontend/src/app/dashboard/error.tsx`

`NAV_FAILED` al montar y `RESET` en la limpieza, en un único efecto pasivo; "Reintentar" llama `left()` y
después `retry()`. La copia sigue siendo fija y no expone `error.message` ni `digest`. Sin owner (toda ruta
de Clínica) el hook devuelve `null` y la frontera no despacha nada.

### 4.5. Adaptador — `frontend/src/lib/admin-hub-reset.ts`

`requestAdminModuleActivate` entrega la selección al owner registrado y devuelve su respuesta. Devuelve
`false` cuando no hay owner, cuando la máquina está en `BOOTING` o `FAILED` (DT-10) o cuando el módulo no
existe: en esos casos el chrome conserva su navegación propia. El bus de listeners y el replay
`unheardActivation` se retiran. `requestAdminHubReset` sigue exportado y llega a la máquina, que lo rechaza
en Admin (#6).

### 4.6. Vista — `AdminDashboardWorkspaceController.tsx` y `useStageModule.ts`

El controlador muestra `navigation.module`. En `STALLED` muestra un aviso `role="status"` con "Reintentar"
(RETRY, fila #15), como ancla de altura cero superpuesta: no cambia la altura que mide el workspace.
`useStageModule("admin")` y `useAdminStageModule()` devuelven el `display`; `useClinicStageModule()` sigue
leyendo `stageModule.ts` y no toca nada de Admin.

## 5. Cambios observables respecto de `main`

Todos son consecuencia de la norma, no decisiones de esta PR.

| Cambio | Norma |
| --- | --- |
| Una entrada sin módulo (`/dashboard/admin`, `?hub=1`, `?module=` inválido) muestra el stage neutro hasta que comitea el `router.replace`; antes un `replaceState` nativo pintaba el módulo de inmediato. `?hub=1` y `?module=bogus` pasan de 0 a 1 `_rsc` | DT-8 = C, S10, §15.3 R-1 |
| A, B en vuelo, A otra vez: un `push` a la URL vigente que pide un payload de A; B nunca comitea ni queda como Forward | DT-16 = A, fila #25 |
| El último módulo se guarda al confirmarse, no al elegirse | §12.5, S12, S15 |
| Pasado el presupuesto sin nada que relevar aparece un aviso recuperable | #12, #15, L3 |
| Un payload abandonado por presupuesto que responde antes que su relevo puede dejar su entrada; `main` lo reconciliaba | Residual DT-15, §19 |

## 6. Aislamiento de Clínica

- Fuera de `/dashboard/admin` el provider entrega `slot = null`: `useAdminNavigationSource()` devuelve
  `null`, ningún store se crea y el owner no se monta.
- La frontera compartida recibe `null` y no despacha.
- `useClinicStageModule()` no llama a ningún hook de Admin; `useStageModule("clinic")` devuelve el valor
  publicado por los owners de Clínica, igual que antes.
- No se tocó ningún archivo de Clínica. El bloque *return to the committed module* del E2E se realineó sólo
  en su rama `admin`; la rama `clinic` conserva su contrato.
- Verificación: `dashboard-global-live-navigation-sync` (54/54) y `dashboard-real-pointer-navigation`
  ejercen ambos roles sin cambios en Clínica.
- En `frontend/e2e/suites/catalog.ts` la descripción `proves` de `dashboard-real-pointer-navigation`
  distingue ahora los dos contratos de "volver al módulo comiteado": Clínica conserva el suyo y Admin es la
  fila #25.

## 7. Verificación

### 7.1. Coordinador — `test/unit/ui/dashboard/dashboard-navigation-coordinator.test.ts` (44 tests)

- A1–A8 paso por paso.
- R1–R8 de §0.5 con los valores de rev. 2.3 (en R5 navega la primera selección y la segunda queda
  reclamada), incluidas R4b en ambos órdenes de limpieza, R7 y R7b y las seis R8.
- Filas de rev. 2.3: #29 → #30, #31 y #12, #11, #25 y su descarte por `seq`, #15, #20 → #21.
- H6: entrega y deduplicación de commits; `previewDisplay` puro.
- Búsqueda aleatoria con los oráculos I1–I8, evaluados sobre el host inyectado y no sobre el coordinador:

| Semilla | Corridas | Tareas | Navegaciones | Huella | Violaciones |
| --- | ---: | ---: | ---: | --- | ---: |
| `0x50314631` | 20 000 | 180 061 | 22 929 | `39d6780d` | 0 |
| `0x0badc0de` | 20 000 | 179 586 | 22 881 | `b2a6196a` | 0 |

- Mutaciones M1–M5, construidas desde la fuente trackeada con un elemento del algoritmo retirado; cada una
  viola al menos un invariante y la fuente sin mutar, cargada igual, no viola ninguno:

| Mutante | Elemento retirado | Invariantes que lo detectan |
| --- | --- | --- |
| M1 | Vigencia | I2, I7, I8 |
| M2 | Drenaje en microtarea (síncrono) | I8 |
| M3 | Vigencia por `navId` (por última transición) | I6 |
| M4 | Conciliación de timers (A6) | I3 |
| M5 | No drenar desmontado | I4 |

No hay flags de test en el código productivo: los mutantes se obtienen transformando la fuente.

### 7.2. E2E — `frontend/e2e/platform/app-shell/dashboard-navigation-fsm-admin.spec.ts` (26 tests)

Production runner, payloads retenidos y continuados, fallos con el 200 real truncado, presupuesto movido con
el reloj de la página. Cobertura contra la ficha:

| Ficha | Escenario |
| --- | --- |
| R-1, R-5, R-6, S10 | Restauración retenida: stage neutro, URL desnuda, un `_rsc`, 0 entradas, documento servido con un solo shell |
| R-3, R-4, R-8 | Seis entradas (sin almacenado, alias, desconocido, módulo explícito, `?hub=1`, `?module=` inválido) |
| L5 | Back a la entrada desnuda se normaliza; con el payload más allá del presupuesto, `STALLED` y luego #14 |
| L2, L3 | `STALLED` visible y RETRY por documento; con reclamo, relevo al primer presupuesto y aviso al segundo |
| H-08 | `router.refresh()` pendiente más selección: `STALLED` y convergencia |
| Frontera (a), (b) | Payload truncado: sin presupuesto vivo; "Reintentar" recupera sin reload y el clic siguiente navega |
| C-9 (a), (b), C-6 (a), C-4, frontera (c) | Entrada al dashboard con el payload truncado: ningún `_rsc` de restauración; "Reintentar" emite exactamente una normalización al módulo almacenado |
| C-9 (c) | Frontera en un commit posterior a la restauración |
| C-9 (d), C-6 (d) | Salir del dashboard con la restauración en vuelo y con la frontera visible |
| C-6 (b) | Back dentro de Admin con la frontera visible |
| C-6 (c), DT-10 | Con la frontera visible, la barra móvil navega por su cuenta y "Reintentar" reconcilia |
| C-8, L6 | Back + Forward y Back + módulo comiteado no muestran `STALLED` |
| C-10, S13 | Back y dos clics: aterriza el último, sin normalización |
| S1 | Ningún frame pintado de un Back/Forward con URL ≠ stage |
| C-11 (c) | Clic sobre la restauración pendiente, en los dos órdenes: una entrada |
| C-11 (d), #32 | Dos escenarios: con la restauración real, y con el commit inyectado del módulo reclamado |
| C-11 (e), DT-15 | El residual, registrado como es |
| S15, C-11b | Volver al módulo que comiteó con otro reclamado lo guarda; la entrada desnuda lo restaura |

C-11 (a) y (b) son el bloque *single flight* existente, que pasa sin tocarse: bajo el reclamo la segunda
elección no pide payload hasta que la primera aterriza, así que "C liberado antes que B" no es alcanzable.
Frontera (d) es `navigation-truncated-stream-recovery.spec.ts`, sin cambios.

### 7.3. Hallazgos de la verificación en navegador

1. **P1 observado.** Entrando a `/dashboard/admin` desde una ruta pública con el payload cortado al 35 %,
   la frontera se monta en el commit que crea el store, la URL queda desnuda y el `router.replace` de la
   restauración **no se emite nunca**. Es el orden de R2/R8.1 en un navegador real.
2. **El orden de R2 no se puede forzar desde dentro de Admin.** Con el payload de la entrada desnuda
   truncado, el fallo aparece en un commit posterior al de la URL: la normalización ya salió. Es el caso
   legítimo de R1 y lo cubre el escenario "frontera en un commit posterior".
3. **Con la frontera visible no hay chrome desde 768 px.** La frontera reemplaza la página completa, banda
   y barra incluidas. El caso C-6 (c) sólo existe por debajo de 768 px, donde la barra móvil pertenece al
   shell; el E2E lo fija en 390×844.
4. **Admin no monta `DashboardRefreshButton`.** El E2E de H-08 emite el mismo `router.refresh()` desde el
   router.
5. **H1 para un `push` sobre una restauración pendiente no es determinista.** El commit de la restauración
   puede llegar (#32) o haber sido descartado por el `push` (#30). El E2E afirma lo que vale en ambos casos
   y anota cuál ocurrió; la fila #32 tiene además un escenario propio y determinista.
6. **E4 confirmado con el owner:** un traverse dentro de la misma página comitea al instante.
7. **El último módulo se guarda al hidratar, no al pintar (hallado en CI, #1858).**
   `admin-mobile-hub-launcher-no-scroll.spec.ts` falló en Frontend CI sobre `27ad9098`: tras cargar
   `?module=audit-log` y pedir `?hub=1`, aterrizó en `admin`. El test tomaba el workspace pintado por el
   servidor como señal de "módulo guardado", pero la escritura ocurre al hidratar y el documento se
   abandonaba antes. Medido con CPU ralentizada 6×: el workspace es visible a los ~720 ms con el
   almacenamiento vacío y la escritura llega a los ~1 020 ms; el escenario da 0 de 15. **`main` se comporta
   igual** (mismos archivos en su versión de `e192d307`, mismo build): escritura a los ~970–1 170 ms y 0 de
   15. No es un defecto de esta PR ni de la máquina: la fila #1 persiste al recibir `HYDRATED`, que es el
   primer momento posible. El test se corrigió para esperar su precondición real, el módulo almacenado,
   antes de navegar (15 de 15 a 6× y a 12×).

### 7.4. P3 — StrictMode con React real

Condición normativa (§12.5.1): "Bajo StrictMode en desarrollo, montaje → limpieza → montaje ocurren en el
mismo bloque síncrono", a confirmar con un "test en modo desarrollo". Las reproducciones R7 y R7b de §7.1
ejercen ese **orden** sobre el coordinador y no son evidencia sobre React; esta sección sí lo es.

**Medio.** `next dev` (Next 16.3.8, React 19.3.0 de desarrollo, StrictMode activo por defecto del App
Router) y Playwright, ambos ya instalados: ninguna dependencia nueva y ningún código de prueba en la
aplicación. Arnés temporal **fuera del repositorio**, que reutiliza `frontend/playwright.config.ts` (fixture
y servidor de aplicación) con otro `testDir`. Observa la página desde afuera con un script de inicio que
envuelve funciones de plataforma que el owner llama: el registro del listener `navigate` de la Navigation
API, los timers de 10 000 ms, las escrituras de historial y los `_rsc` de `/dashboard/admin`. Cada registro
lleva el número de su bloque síncrono: una microtarea encolada por el primer registro del bloque lo cierra,
de modo que dos registros con el mismo número corrieron sin ningún punto de control de microtareas entre
ellos.

**Control.** El mismo arnés sobre el production runner (`next start`), donde StrictMode no hace doble
montaje.

| Comprobación | `next dev` (StrictMode real) | `next start` (control) |
| --- | --- | --- |
| Efecto del owner al entrar por un módulo | `add`, `remove`, `add`, los tres en el bloque 1 | `add` |
| Presupuestos al reposar en un módulo | 0 armados, 0 vivos | igual |
| R7b: entrada desnuda con módulo almacenado y el payload retenido | `add`, `remove`, `add` y **después** un único `budget:arm`; 1 presupuesto vivo; 1 `_rsc`; URL desnuda | `add`, un `budget:arm`; igual |
| R7b: al liberar el payload | 1 `replaceState` del módulo, 0 `pushState`, 0 presupuestos vivos | igual |
| Clic con el payload retenido | 1 `_rsc`, 1 presupuesto | igual |
| Segunda elección reclamada | 0 `_rsc` nuevos, el mismo presupuesto | igual |
| Aterrizaje y continuación | 2 `_rsc` en total, 2 `budget:arm`, 2 `budget:cancel`, 0 vencidos, 0 vivos; 1 `pushState`; `history.length` +1 | igual |
| Salida del dashboard | listeners: 2 altas y 2 bajas; 0 presupuestos vivos | 1 alta y 1 baja; 0 vivos |
| R7: entrada con el payload truncado (frontera y owner en el mismo commit) | frontera visible; `add`, `remove`, `add`; **0** `_rsc` de restauración; 0 `budget:arm`; URL desnuda | frontera visible; `add`; igual |
| R7: "Reintentar" | exactamente 1 `_rsc` de normalización al módulo almacenado; 0 presupuestos vivos | igual |

Resultado: 4 de 4 en `next dev` y 20 de 20 con `--repeat-each=5`, con la misma secuencia de listeners en las
cinco repeticiones; 4 de 4 en el control. **P3 se cumple:** el doble montaje ocurre en un solo bloque
síncrono, el drenaje único de §12.5.1 lo absorbe, y no deja navegaciones duplicadas, presupuestos huérfanos
ni listeners residuales.

Límites, explícitos: el arnés no está versionado, igual que la evidencia de sesión de §0.2 y §0.7 de la hoja
de ruta; versionarlo exigiría una cohorte que corra sobre `next dev`, que hoy no existe en CI. Es Chromium
en Windows local. Y, como dice la propia fila de P3, no vale como evidencia de producción: lo que vale para
producción es el control y el E2E de §7.2.

Una observación del arnés, sin efecto en el contrato: la baja del listener al salir del dashboard llega poco
después de que la red queda en reposo (limpieza de efectos pasivos), no en el mismo instante que la URL.

## 8. Trazabilidad de aserciones retiradas

Ninguna aserción se retira sin reemplazo. "Reemplazo" nombra el contrato y dónde se prueba.

| Guard | Aserción retirada | Motivo | Reemplazo |
| --- | --- | --- | --- |
| `frontend-dashboard-lateral-navigation` | `usePublishStageModule("admin", activeModule);` en el controlador | El owner de Admin es la máquina; no hay segunda copia que publicar | El stage muestra `navigation.module`; `useStageModule` devuelve el mismo `display`; el controlador no publica. E2E: `expectConverged`/`expectShown` |
| ídem | Replay `unheardActivation` (test de comportamiento del bus) | §11.3: el store existe antes que cualquier página; un replay podría navegar dos veces | Test de comportamiento nuevo: sin owner devuelve `false` y nada se reproduce; un owner nuevo reemplaza al anterior; el bus y el replay no existen |
| ídem | `subscribeAdminModuleActivate(() => adminInFlight)` | El reclamo vive en la máquina | El adaptador retransmite la respuesta del owner; fila #29 en las suites de la máquina y del coordinador; bloque *single flight* del E2E |
| ídem | `const inFlight = pendingNavigationIntent…`, `return inFlight;`, `router.replace(…intent.target…)`, `if (superseded === null && …)` | Mecanismo retirado | Owner: toma toda selección que la máquina no ignora (DT-10). Máquina: #29, #30 y la idempotencia sobre `next ?? target` |
| ídem | `if (pushedFrom.current?.module === intent.target)` y `window.history.back();` | DT-16 = A; S9 prohíbe efectos nativos de historial | Fila #25 (`returnToCommitted`, `ROUTER_PUSH`); ningún archivo del owner contiene `history.*` ni `router.refresh`. E2E: bloque *return to the committed module*, rama admin |
| ídem (presupuesto) | `useNavigationFlight(navigateAbandonedIntent)`, `flight.start(` ×2, `target === abandonedTarget) return null;`, `if (parsed !== committed) flight.start(parsed);`, `historyTraversalStarted.current = false;\n flight.end();` | El presupuesto de Admin es de la máquina y del coordinador | Un solo valor de presupuesto en el árbol; A6 y A8 en el coordinador; #31, #12, #13, #4 y #17 en la máquina. E2E: *abandoned flight* sin tocar y los dos escenarios de `STALLED` |
| `dashboard-b13-admin-entry` | Precedencia de entrada en el controlador (`if (searchParams.get(…) \|\| isAdminHubRequested…)`, `landingModule = lastModule ?? DEFAULT_ADMIN_MODULE`) | La precedencia es de las filas #1–#3 | `explicit` del owner; `bootRestore` de la máquina; `ROUTER_REPLACE` sin `ROUTER_PUSH` en `hydrate`. E2E: seis escenarios de entrada |
| ídem | `setHasManuallyReturnedToHub(true);`, `pendingNavigationIntent`, `previousUrlModule`, `currentUrlModule` presentes | Estado de navegación retirado | Señal contratada exportada y despachada (`SELECT_HUB`); nueve identificadores afirmados **ausentes** del controlador |
| ídem | `function resolveRetiredHub()`, `window.history.replaceState(`, "nunca entra a la cola del router" | La normalización es `ROUTER_REPLACE` | `normalization` y `settle` de la máquina; la protección frente a una navegación de usuario pasa a ser #10 y #11; S9 afirmado sobre controlador, owner y coordinador. E2E: L5 y C-11 (c) |
| `dashboard-b09-mobile-navigation-unification` | `subscribeAdminHubReset` y `function resolveRetiredHub()` en el controlador | Ídem | Señal exportada, entregada al owner y despachada; `normalization` configurada con `DEFAULT_ADMIN_MODULE`; sin `matchMedia` en controlador ni owner |
| `frontend-dashboard-last-module` | `writeDashboardLastModule(ADMIN_…, activeModule)` y lectura en el controlador; latch `hasRestoredLastModule` | La persistencia es el efecto `PERSIST`; el one-shot es `BOOTING` | Owner: un único `writeDashboardLastModule` (el de `PERSIST`) y una única lectura (para `HYDRATED`); el controlador no toca almacenamiento. Máquina: `HYDRATED` sólo en `BOOTING`. E2E: `storedModule` en entradas, C-11 (c) y S15 |
| `frontend-dashboard-admin` | `setActiveModule(parseAdminModule(…))`, `[searchParams, router, flight]`, `useRouter, useSearchParams` | El módulo se deriva en render | `urlModule` y `activeModule` derivados en render; sin `setActiveModule` ni `useRouter`. E2E: "ningún frame con URL ≠ stage" |
| `frontend-route-error-boundaries` | `onClick={() => retry()}` para el boundary del dashboard | "Reintentar" debe despachar `RESET` antes de `retry()` (§12.1) | Regex que exige `navigation?.left(); retry();` y una sola llamada a `retry()`; test nuevo del cableado. Los otros dos boundaries conservan la aserción original. E2E: los cinco escenarios de frontera |

Los tres archivos condicionales se tocaron por fallo causal medido:
`frontend-route-error-boundaries.test.ts` y `frontend-dashboard-admin.test.ts` (anclas de la fila anterior) y
`test-global-01b-census-contract.test.ts`, donde la adopción del lector canónico pasa de 419 a 420 porque la
suite del coordinador lee la fuente para sus mutaciones. No se cambió `GROWTH_TOLERANCE`, ninguna banda ni
ninguna exclusión. La métrica "assertions de censo congelado" quedó dentro de su banda sin re-anclarla: las
aserciones de sólo-conteo de la suite nueva se reescribieron como aserciones sobre las navegaciones
ejecutadas.

## 9. Riesgos residuales

| Riesgo | Estado |
| --- | --- |
| P3 (StrictMode con React real) está verificada con un arnés temporal sobre `next dev` que no queda versionado (§7.4) | Si React o Next cambian el doble montaje, ningún gate del repositorio lo detecta; el contrato que protege a producción (I1–I8, E2E) sí está versionado |
| El corte del 35 % del payload que monta la frontera al entrar depende del tamaño relativo de layout y página | Medido en Windows local; si CI Linux difiere, el E2E falla de forma visible, no silenciosa |
| Residual DT-15: el payload abandonado puede dejar su entrada | Registrado por E2E, no afirmado en cero |
| A → B → C (reclamado) → B aterriza → A (reclamado) → C aterriza deja `[A, A]` | Residual aceptado en §19; sin E2E propio |
| Cruzar entre `/dashboard/admin` y otra ruta del mismo layout crea un store nuevo | Deliberado: es otra superficie y otra sesión |
| H1 para un `push` sobre un traverse sin comitear sigue sin evidencia | E4: dentro de la misma página el traverse comitea antes |
| El comentario "Not wired to any consumer yet (PR-NAV-02)" de la máquina quedó falso | Reportado: la máquina no se modifica en esta PR |

## 10. Rollback

Revert del squash. Restaura el controlador, el bus y los guards; el coordinador y el provider quedan sin
consumidores. Es el primer PR de la Fase C, sin dependientes: no exige orden.

## 11. Validaciones

Ejecutadas en local (Windows, Node 24.14.1, Next 16.3.8, Chromium de Playwright), en secuencia, sobre el
árbol de trabajo sin commit. Estados canónicos de `AGENTS.md` §6.

| Gate | Estado | Observado |
| --- | --- | --- |
| Suite del coordinador | PASSED | 44 de 44 |
| Suite de la máquina rev. 2.3 (sin modificar) | PASSED | 286 de 286 |
| Guards que leen los archivos modificados | PASSED | 199 de 199, con los archivos nuevos visibles como trackeados |
| `pnpm --dir frontend lint` | PASSED | exit 0 |
| `pnpm --dir frontend typecheck` | PASSED | exit 0 |
| `pnpm --dir frontend build` (variables de build de `frontend-ci.yml`) | PASSED | exit 0; todas las rutas del dashboard siguen dinámicas |
| `pnpm security:public-surface` | PASSED | exit 0 |
| `pnpm typecheck:test` | PASSED | exit 0 |
| `pnpm test` | FAILED | 5206 de 5296. 88 de los 89 fallos existen sólo porque los cinco archivos nuevos aún no están trackeados (la suite lee fuentes por el lector de archivos trackeados): con esos archivos visibles como trackeados pasan 5311 de 5313. El fallo restante en ambos estados es `e2e-global-03b-authoritative-auth-boundary.fastify.test.ts`, que requiere base de datos |
| E2E dirigido: spec nuevo | PASSED | 26 de 26; 156 de 156 con `--repeat-each=6` |
| E2E dirigido: `dashboard-real-pointer-navigation`, `dashboard-global-live-navigation-sync`, `navigation-truncated-stream-recovery` | PASSED | 66, 54 y 3 |
| `pnpm --dir frontend e2e:visual-contract` | PASSED | 753 passed, 1 skipped (segunda corrida). La primera perdió un `page.goto` de `dashboard-b12-module-card-removal` por `net::ERR_NO_BUFFER_SPACE` |
| `pnpm --dir frontend e2e:admin-mobile` | PASSED | 159 de 159 |
| `pnpm --dir frontend e2e:public-clinic` | PASSED | 345 de 345 (segunda corrida). La primera perdió un `page.goto` de `clinic-mobile-admin-parity-contract` por `net::ERR_NO_BUFFER_SPACE` |
| `pnpm --dir frontend e2e:smoke` | PASSED | 66 de 66 |
| `git diff --check` | PASSED | sin hallazgos |
| P3: StrictMode con React real (`next dev`, arnés temporal no versionado) | PASSED | 4 de 4; 20 de 20 con `--repeat-each=5`; control en `next start` 4 de 4 (§7.4) |
| Guards del catálogo E2E tras realinear el `proves` de `dashboard-real-pointer-navigation` | PASSED | 79 de 79 |
| `pnpm typecheck`, `pnpm build` (backend), `pnpm audit` | NOT_RUN | Ningún archivo de backend ni de dependencias cambia |
| `db:migrate` | BLOCKED | Sin base de datos local |

`net::ERR_NO_BUFFER_SPACE` es agotamiento de sockets de Windows bajo corridas consecutivas con varios
workers; afectó a un test distinto en cada caso, ninguno de navegación, y no se reprodujo al repetir la
cohorte. La evidencia válida para el merge es la de CI Linux sobre el head de la PR.
