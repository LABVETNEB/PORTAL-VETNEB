# Navegación FSM del dashboard Clínica: shell y hub (PR-NAV-04)

| Campo | Valor |
| --- | --- |
| Tipo | Implementación frontend (R1) |
| Fecha | 2026-10-13 |
| Rama | `feat/dashboard-navigation-fsm-clinic` |
| Base | `main` = `7d9308971dd37102f4a25032260a36d8ee565da4` (#1858, PR-NAV-03) |
| Norma | `docs/audit/AUDITORIA_ARQUITECTURA_NAVEGACION_FSM_HOJA_DE_RUTA.md` rev. 2.3: §11.3, §12.1, §12.4, §12.5, §12.5.1, §12.6, §13, §15.3, §16 (ficha PR-NAV-04), §21 |
| Scope de gobernanza | `frontend` (tests y documentación son categorías de soporte) |
| Estado | Implementado en el árbol de trabajo; sin commit. Todas las operaciones Git/GitHub son [MANUAL-NICO] |

## 1. Estado base

Tras PR-NAV-03 la máquina de navegación tenía un único consumidor: Admin. Clínica seguía navegando por
`ClinicDashboardWorkspaceController.tsx`, con su propia clasificación de commits (`clinicNavigationState.ts`),
su presupuesto (`useNavigationFlight`), su estado optimista del hub, su persistencia y su restauración. Esa
restauración estaba muerta (D-12): el controlador guardaba el módulo que mostraba en cada render, incluido el
módulo por defecto de una entrada desnuda, antes de que su propio efecto de restauración leyera el almacenado.

La máquina (`dashboardNavigationMachine.ts`), su suite, el coordinador (`dashboardNavigationCoordinator.ts`) y
su suite **no se modifican** en esta PR.

Decisiones normativas aplicadas tal como están aprobadas: DT-1 (T2), DT-2 (ninguna selección inicia
`router.refresh()`), DT-5 (10 000 ms), DT-8 (restauración opción C), DT-9, DT-10, DT-12, DT-15 (opción A) y
DT-16 (opción A). **DT-13 sigue pendiente** y no se resuelve aquí (§7).

## 2. Scope

**Incluido.** El provider de PR-NAV-03 pasa a tener una superficie por store (Admin y Clínica) sobre el mismo
coordinador; corte del controlador de Clínica; adaptador de entrada de Clínica; selector de `display` para el
chrome de Clínica en `/dashboard` (`useStageModule.ts`); aviso de `STALLED` en el stage de Clínica; realineación de los guards que anclaban el mecanismo retirado o la exclusividad de Admin en
el provider; E2E de la ficha y sus censos.

**Excluido, deliberadamente.**

- `ClinicFullRouteModuleStage.tsx`, `FullModuleRouteControl.tsx` y el hand-over de rutas completas
  (`handsOver`, `unheardActivation`, el guard de `window.event`, `relinquishClinicModuleActivateHandOver`):
  PR-NAV-05. El stage de ruta completa sigue escuchando el bus y publicando su destino en `stageModule.ts`.
- `stageModule.ts`, el resto del chrome (`DashboardMobileNav`, `ModuleContextTitle`, `NavigationRail`,
  `NavigationDrawer`, `WorkspaceAppBar`, `DashboardMobileKebabMenu`), `app/dashboard/page.tsx`,
  `app/dashboard/layout.tsx` y `app/dashboard/error.tsx`: sin cambios. De `DashboardNavigationFrame.tsx`
  cambia una línea, la del hook que lee la banda de `/dashboard` (§4.4).
- `clinicNavigationState.ts`, `navigationFlight.ts`, `useNavigationFlight.ts` e `historyTraversal.ts`: quedan
  en el árbol. `clinicModuleHref` y `NAVIGATION_FLIGHT_BUDGET_MS` siguen en uso; el stage de ruta completa usa
  `historyTraversal.ts`. Su retiro es PR-NAV-07.
- `UploadReportModal.tsx` conserva su `router.refresh()`.
- Máquina, coordinador y sus suites; semántica de Admin; backend, DB, dependencias, workflows, Service Worker
  y la hoja de ruta.
- PR-NAV-06 (matriz consolidada), PR-NAV-07 (guard "un solo intérprete") y PR-NAV-08 (cierre documental).

## 3. Ownership: qué se retiró y quién lo decide ahora

| # | Autoridad anterior (controlador de Clínica) | Ahora |
| --- | --- | --- |
| 1 | `navigationState` (ref) + `applyClinicUrlCommit`: clasificación de commits, `router.replace` de reconciliación y `window.history.back()` | Máquina: #9, #11, #22, #23, #25, #26, #30, #32. `history.back()` desaparece (DT-16, S9) |
| 2 | `hubOverride` (estado optimista del hub) y el efecto que lo descarta | `display` de la máquina: `hub` es una ubicación propia; #7 (`SELECT_HUB`) y #5 al salir del hub |
| 3 | `historyTraversalStarted` + backstop `popstate` + `relinquishClinicNavigationIntent` | `TRAVERSE_STARTED` (#17, #18, #24, #28), con los productores del owner |
| 4 | `useNavigationFlight` + `navigateAbandonedIntent` (`router.push` al vencer el presupuesto) | Máquina: #31 y #12; timers del coordinador (A6, A7) |
| 5 | Restore por efecto (`hasRestoredLastModule`, `hasManuallyReturnedToHub`, `router.replace`) | Máquina: #1 y #2, emitidas al crear el store. Cierra D-12 |
| 6 | `subscribeClinicModuleActivate` con su copia del reclamo (`inFlight`) | El owner registrado decide: #5, #10, #16, #19 navegan; #29 reclama |
| 7 | `subscribeClinicHubReset` | `requestClinicHubReset` → `SELECT_HUB` (#7) |
| 8 | `writeDashboardLastModule` en un efecto sobre el módulo optimista | Efecto `PERSIST`, sólo en confirmaciones (#1, `settle`, #25) |
| 9 | `useState(activeModule)` y `setActiveModule` en efectos | Derivado en render del `display` previsualizado (§11.3) |

El controlador queda como vista: no importa `useRouter`, no escribe historial, no lee ni escribe
almacenamiento y no tiene estado. Sigue publicando lo que muestra en `stageModule.ts`
(`usePublishStageModule("clinic", …)`), que es el `display` de la máquina y no una segunda decisión: el
chrome de `/dashboard` ya lee ese `display` por su cuenta (§4.4), y la publicación queda como el mismo valor
por el canal que el stage de ruta completa todavía usa (PR-NAV-05).

Autoridades externas que permanecen y que la máquina trata como commit externo (#22/#23):
`FullModuleRouteControl` ("Abrir módulo completo"), los enlaces de los resúmenes a rutas completas,
`DashboardNotificationsBell`, logout y `BackForwardCacheGuard`.

## 4. Arquitectura entregada

### 4.1. Provider — `frontend/src/components/dashboard/DashboardNavigationProvider.tsx`

El owner de PR-NAV-03 deja de estar escrito para Admin y pasa a recibir una **superficie**: configuración de
la máquina, clave de almacenamiento, gramática de módulos, lectura de una URL (`locate`), URL de una ubicación
(`href`) y registro del adaptador. Hay dos, declaradas aparte y sin compartir nada: `ADMIN_SURFACE` y
`CLINIC_SURFACE`. Todo lo demás es un único código: creación del store (A1), `URL_COMMITTED` en efecto de
layout, montaje y desmontaje en efecto pasivo (A4, A8), productores de `TRAVERSE_STARTED`, previsualización
del `display`, señales de la frontera.

- `DashboardNavigationProvider` lee sólo el `pathname`, resuelve a qué superficie pertenece la ruta y sostiene
  **un slot de store por superficie**. Cambiar de superficie crea un slot nuevo; fuera del dashboard no hay
  slot ni owner.
- El store de Clínica vive a través de `/dashboard` y de sus rutas completas. Es lo que exige C-6: la máquina
  debe seguir existiendo cuando el pathname cambia para poder salir de `FAILED`.
- `useAdminDashboardNavigation()` conserva su contrato. `useClinicDashboardNavigation()` entrega
  `{ module, hub, stalled, retry }`; ambos sólo alcanzan el store de su superficie.
- `useDashboardNavigationBoundary()` entrega las señales del owner de la superficie de la ruta. La frontera
  compartida `app/dashboard/error.tsx` no cambia: ahora también tiene a quién avisar en Clínica.

Gramática de Clínica (contratos de entrada de §12.1):

| URL | `NavLocation` | `explicit` |
| --- | --- | --- |
| `/dashboard` | `module` = módulo por defecto | `false` |
| `/dashboard?module=<válido>` | `module` | `true` |
| `/dashboard?module=<desconocido>` | `module` = módulo por defecto | `true` |
| `/dashboard?hub=1` (con o sin `module`) | `hub` | `true` |
| `/dashboard/<segmento>/…` | `route`, con `path` = pathname y `module` = el segmento si es un módulo de Clínica (`informes`, `logistica`), vacío si no | `false` |

`href`: un módulo sale por `clinicModuleHref` (el módulo por defecto es la URL desnuda, §12.5); el hub por
`buildHubHref("clinic")`; una ruta por su `path`. Una excepción, necesaria para la fila #25 y #32: cuando la
ubicación pedida **es la que la URL ya muestra**, `href` devuelve la URL vigente tal como está escrita. El
módulo por defecto tiene más de una escritura (`/dashboard`, `?module=operaciones`, un `?module=` desconocido),
y un `push` a otra escritura de la misma ubicación agregaría la entrada que esa fila existe para evitar.

### 4.2. Adaptador — `frontend/src/lib/clinic-hub-reset.ts`

- `registerClinicNavigationOwner` (nuevo): el owner se registra al montar.
- `requestClinicModuleActivate` avisa primero a los stages que hacen hand-over (sin cambios) y devuelve la
  respuesta del owner: `true` si la máquina tomó la selección; `false` si no hay owner, si la máquina está en
  `BOOTING` o `FAILED` (DT-10) o si el módulo no existe. En esos casos el chrome conserva su navegación propia.
- `requestClinicHubReset` despacha `SELECT_HUB`. `subscribeClinicHubReset` se retira con su único oyente.
- El hand-over de rutas completas queda como estaba. El replay `unheardActivation` no tiene ya quién lo
  consuma (su único consumidor era el controlador) y se retira con el resto en PR-NAV-05.

### 4.3. Vista — `frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx`

Muestra `navigation.module` o el hub. Cuando el `display` no nombra ni un módulo ni el hub — una ruta completa
hacia la que esta página se va, por un traverse —, muestra lo que dice la URL que está renderizando. Sin owner
(sin provider encima) lee la URL. En `STALLED` muestra el mismo aviso `role="status"` con "Reintentar" que
Admin, como ancla de altura cero.

Las props `initialModule` e `initialHub` se conservan en el tipo porque `page.tsx` las pasa; el stage ya no las
necesita: el store nace con `HYDRATED` aplicado en el render de servidor y en el de cliente, y su `display` es
la ubicación de la URL en ambos (S10), de modo que el primer paint no depende de ellas.

### 4.4. Selector del chrome — `useStageModule.ts` y `DashboardNavigationFrame.tsx`

`useStageModule("clinic")` devuelve el `display` de la máquina cuando nombra un módulo o el hub, y lo que
publica el stage en cualquier otro caso (una ruta completa, o ningún owner). Lo usan la barra móvil, el título
móvil y, desde esta PR, la banda lateral de `/dashboard` (`ClinicUrlNavigation`, una línea). La banda de las
rutas completas (`ClinicRouteNavigation`) sigue con `useClinicStageModule()`: se renderiza fuera de toda
frontera `Suspense` y no puede leer los parámetros de búsqueda.

No estaba en el plan inicial y lo exigió un fallo medido (§10): la página de `/dashboard` llega en streaming,
de modo que el controlador puede montarse un commit después que el chrome. Con el chrome leyendo sólo lo
publicado, en ese intervalo no había nada publicado y caía a la URL. Antes eso no se veía, porque desde una
ruta completa las dos elecciones salían juntas y el router descartaba la primera; con el reclamo (#29) la
primera siempre aterriza, y su URL es justamente el módulo que el usuario ya dejó.

## 5. Cambios observables respecto de `main`

Todos son consecuencia de la norma, no decisiones de esta PR.

| Cambio | Norma |
| --- | --- |
| Una entrada desnuda a `/dashboard` con otro módulo almacenado lo **restaura** por un `router.replace`, sin entrada de historial; hasta que comitea se ve el módulo por defecto. En `main` no restauraba | D-12, DT-8 = C, #2, S10 |
| El último módulo se guarda al **confirmarse**, no al elegirse ni en cada render | §12.5, S12, S15 |
| Elegir el módulo por defecto navega a `/dashboard`, su URL canónica. En `main` el chrome escribía `?module=operaciones` cuando no había nada en vuelo y el controlador `/dashboard` cuando sí | §12.5 ("default de Clínica = URL desnuda") |
| Elegir el módulo que la URL ya muestra no navega (#4). En `main` el chrome empujaba igual su `?module=` | #4, L1 |
| A, B en vuelo, A otra vez: un `push` a la URL vigente que pide un payload de A; B nunca comitea ni queda como Forward. En `main` el controlador hacía `history.back()` | DT-16 = A, fila #25 |
| Pasado el presupuesto sin nada que relevar aparece un aviso recuperable en el stage | #12, #15, L3 |
| Desde una ruta completa, la segunda elección hecha antes de que aterrice la primera queda **reclamada** y sale al aterrizar la primera, en vez de salir de inmediato | Ficha PR-NAV-04, rev. 2.3 ("la máquina reclama igual desde una ruta completa") |
| Entrar a una ruta completa guarda su módulo como último módulo (`informes`, `logistica`) | §12.1 rev. 2.1 (`HYDRATED.location` de ruta completa), #1 |
| Un payload abandonado por presupuesto que responde antes que su relevo puede dejar su entrada; `main` lo reconciliaba | Residual DT-15, §19 |

## 6. Restauración (R-2, R-5, R-6, D-12)

| Caso | Resultado | Dónde se prueba |
| --- | --- | --- |
| R-2: URL desnuda, almacenado ≠ default | Un `router.replace`; stage en el módulo por defecto y URL desnuda hasta el commit; el almacenado no se pisa mientras tanto | Unit (coordinador con la configuración de Clínica) y E2E *restore* |
| R-3: sin almacenado, o almacenado = default | `IDLE` de inmediato, 0 `_rsc` | Unit y E2E *entry* |
| R-4: almacenado desconocido | Módulo por defecto, 0 `_rsc` | Unit y E2E *entry* |
| R-5: recarga y reingreso | La URL restaurada es un documento propio con un stage y un workspace; el módulo elegido en una visita es el que restaura la siguiente entrada desnuda | E2E *restore* y *R-5* |
| R-6: historial | 0 entradas por la restauración; Back a la página previa, Forward al módulo restaurado | E2E *restore* |
| R-8: `?module=` explícito, `?module=` desconocido, `?hub=1` | La URL gana; 0 `_rsc`; el hub no guarda nada | Unit y E2E *entry* |

## 7. Recuperación de errores (C-6, C-9) y DT-13

`FAILED` dura lo que dura montada la frontera, también en Clínica:

- **C-6.** Un `_rsc` truncado de una ruta completa monta la frontera; Back a `/dashboard` cambia el pathname,
  Next la desmonta sin `retry()`, su limpieza despacha `RESET` con la última ubicación entregada y la máquina
  reposa ahí. El clic siguiente lo toma el owner y el posterior queda reclamado, que es la prueba de que salió
  de `FAILED` (en `FAILED` el adaptador no reclama y ambos habrían salido).
- **C-6 simétrico.** Un fallo en `/dashboard` sobrevive a un Back dentro de `/dashboard` (el pathname no
  cambia) y se abandona con el Back siguiente, hacia una ruta completa.
- **DT-10.** Con la frontera visible, la barra móvil navega por su cuenta y "Reintentar" reconcilia.
- **C-9.** Entrando a `/dashboard` por una navegación de cliente con el payload truncado, la frontera se monta
  en el commit que crea el store: el `router.replace` de la restauración no se emite nunca y no queda
  presupuesto. "Reintentar" reposa en el módulo por defecto con URL desnuda; la restauración no se reintenta,
  porque `RESET` no pasa por `bootRestore`.

**DT-13 queda pendiente y su limitación está fijada tal como es.** Ese `RESET` reposa en la URL que encuentra
y persiste su módulo: tras el fallo, el almacenado pasa a ser el módulo por defecto y la preferencia que la
restauración iba a respetar se pierde. Entrando por una ruta completa pasa lo mismo con el módulo de la ruta.
Las tres opciones de §21 (A sin cambio, B reintentar la restauración, C no persistir al venir de `FAILED`)
siguen abiertas; B y C cambian la fila #21 y necesitan su propia verificación. Esta PR implementa A, que es lo
que la tabla vigente dice, y lo afirma en el unit y en dos E2E con el mensaje "known limitation, DT-13 pending".

## 8. Concurrencia (C-10, C-11) e invariantes del intérprete

Clínica usa el coordinador de PR-NAV-03 sin variantes, de modo que I1–I8 se sostienen por la misma suite
(44 tests, búsqueda aleatoria con dos semillas y las cinco mutaciones), que ya incluía una configuración de
Clínica con hub y rutas. Lo que esta PR agrega es la evidencia de integración en navegador:

| Contrato | Escenario E2E |
| --- | --- |
| S14, #29 → #30 | Bloque *single flight* (sin tocar) y *burst that leaves the hub* (sin tocar) |
| #31, #12, #14 | Bloque *abandoned flight* (sin tocar) y *STALLED with a claimed selection* |
| #25, DT-16 | Bloque *return to the committed module*, realineado, y "the default module … adds no entry" |
| C-10, S13 | Back y dos clics antes de cualquier payload |
| C-11 (c) | Clic sobre la restauración pendiente, en los dos órdenes: una entrada |
| C-11 (d), #32 | Con la restauración real, y con el commit inyectado del módulo reclamado |
| C-11 (e), DT-15 | El residual, registrado como es |
| C-8, L6 | Back + Forward y Back + módulo comiteado, con el hub como entrada anterior |
| S1 | Ningún frame de un Back/Forward con URL ≠ stage |
| S15 | Volver al módulo que comiteó con otro reclamado lo guarda |
| C-9 (d), C-6 (d) | Salir del dashboard con la restauración en vuelo y con la frontera visible |
| H-08 | `router.refresh()` pendiente más selección: `STALLED` y convergencia |

`SELECT_HUB` (#7) no tiene emisor en `frontend/src` (§11.3: `requestClinicHubReset` sólo tiene su
definición). Está cubierto en el unit — adaptador, owner y coordinador con la configuración de Clínica — y no
en E2E, donde no hay control que lo dispare. El E2E del hub cubre lo que el producto sí alcanza: hub → módulo
→ Back vuelve al hub, y una URL de hub comiteada por el router es seguida por el stage.

## 9. Trazabilidad de guards y E2E realineados

Ninguna aserción se retira sin reemplazo. "Reemplazo" nombra el contrato y dónde se prueba.

### 9.1. Guards

| Guard | Aserción retirada | Motivo | Reemplazo |
| --- | --- | --- | --- |
| `frontend-dashboard-lateral-navigation` (owners y chrome) | `const isAdmin = usePathname() === ROUTES.dashboardAdmin;`, `createAdminStoreSlot`, `<AdminStoreSlotContext.Provider>`, `<AdminNavigationOwner />`, `createAdminStore(…)` | El owner sirve a dos superficies | `surfaceOf(usePathname())`, un slot por superficie reemplazado al cambiarla, `<StoreSlotContext.Provider>`, `<NavigationOwner />`, un único `createStore(surface, router, located)`. Se conservan: el provider no lee la URL, el owner es hermano de `children`, una sola frontera `Suspense` |
| ídem | "the admin owner touches no clinic mechanism" sobre el archivo entero | El archivo declara ambas superficies | Más fuerte: la declaración de Admin no contiene ningún identificador de Clínica **y** la de Clínica ninguno de Admin (clave, módulos, parser, adaptador, href); cada hook alcanza sólo su superficie; el owner no publica en `stageModule` |
| ídem (SINGLE FLIGHT) | `inFlight`, `return inFlight;`, `outcome.reconcileTo`, `outcome.historyBack`, `recordNavigationIntent(parsed, { pushed: !inFlight })` en el controlador de Clínica | El reclamo y su reconciliación son filas de la máquina | El controlador lee `useClinicDashboardNavigation()` y no contiene ninguno de siete identificadores retirados ni efectos nativos de historial; el owner compartido registra el adaptador de Clínica. #29, #30 y #25 ya se afirmaban en ese test sobre la máquina |
| ídem (hub) | `confirmedUrlModule: hubInUrl ? null : …`, `confirmClinicHubEntry`, `if (hubInUrl \|\| isHubActive) return;` | Estado retirado | El hub es una ubicación propia, leída antes que el módulo (`if (isHubRequested(query)) return HUB;`), distinta de cualquier módulo en `same`; la restauración exige `atDefault`. E2E: *burst that leaves the hub* sin tocar |
| ídem (presupuesto) | `useNavigationFlight(navigateAbandonedIntent)`, `flight.start(` ×3, `target === abandonedTarget) return null;`, `parsed !== confirmedUrlModule) flight.start(parsed);`, `historyTraversalStarted.current = false;\n flight.end();` | El presupuesto de Clínica es de la máquina y del coordinador | La vista no contiene ninguno de seis identificadores de vuelo. #29, #31, #13, #4 y #17 se afirman en ese mismo test para el provider compartido. E2E: *abandoned flight* sin tocar y los dos de `STALLED` |
| `frontend-dashboard-last-module` (Admin) | `source.includes("CLINIC_LAST_MODULE_STORAGE_KEY") === false`; `writeDashboardLastModule(ADMIN_…)` y `readDashboardLastModule(ADMIN_…)` literales | La clave llega por la superficie | La declaración de Admin fija `storageKey: ADMIN_LAST_MODULE_STORAGE_KEY` y no contiene la de Clínica; una sola escritura (`PERSIST`) y una sola lectura (`HYDRATED`) en todo el provider |
| ídem (Clínica) | Escritura y lectura en el controlador; `if (searchParams.get("module")) return;`, `if (!lastModule) return;`, `if (lastModule === DEFAULT_CLINIC_MODULE) return;`; `recordNavigationIntent(lastModule); router.replace(clinicModuleHref(…))`; "one push"; `hasRestoredLastModule`; `setHasManuallyReturnedToHub(true)` | La restauración es de las filas #1–#2 | El controlador no toca almacenamiento ni router. Máquina: `bootRestore` exige URL no explícita, ubicación = default y almacenado válido ≠ default; `hydrate` emite `ROUTER_REPLACE` y nunca `ROUTER_PUSH`; #10 para el clic sobre la restauración; `HYDRATED` sólo en `BOOTING`. Provider: clave de Clínica, `clinicModuleHref`, sin URL armada a mano. E2E: *restore*, *entry* y C-11 (c) |
| `frontend-dashboard-hub-hero` | Oráculo AST sobre `useState(initialModule ?? DEFAULT_CLINIC_MODULE)` | El controlador no tiene estado de módulo | El mismo oráculo, con los mismos cuatro casos y la misma mutación, sobre la expresión que resuelve el módulo de la URL (`parseClinicModule(searchParams.get("module")) ?? DEFAULT_CLINIC_MODULE`) |
| `frontend-dashboard-remove-home-unified-workspace` | `initialModule ?? DEFAULT_CLINIC_MODULE` | Ídem | `navigation.module ?? urlModule`: donde el `display` no nombra un módulo, el stage cae en el de la URL, nunca en `null` |
| `dashboard-b13-admin-entry` | Lectura de `searchParams` y `explicit` literales en el provider; `storedModule: parseAdminModule(readDashboardLastModule(ADMIN_…))` | La lectura de la URL es de la superficie | `location: adminLocation(parseAdminModule(query.get(MODULE_QUERY_PARAM)))`, `isExplicit(query)`, `storedModule: surface.parseModule(readDashboardLastModule(surface.storageKey))` con la clave y el parser de Admin en su declaración |
| `frontend-route-error-boundaries` | "a store exists on the admin route only" | La frontera tiene owner en ambas superficies | Las señales salen de `useNavigationSource()`, que entrega el store de la superficie de la ruta y sólo ése; sin owner no hay señales |
| `test-global-01b-census-contract` | Adopción del lector canónico = 420 | Un importador nuevo | 421, nombrando a `dashboard-navigation-fsm-clinic`. Sin tocar `GROWTH_TOLERANCE`, bandas ni exclusiones |
| `e2e-suite-catalog-completeness`, `e2e-completeness-workflow` | Conteos del catálogo | Un spec nuevo | 109 specs; `platform` 28; `mocked` 41; `visual-contract` 31; `ci` 78 |

### 9.2. E2E existentes

| Spec | Qué cambió | Motivo | Contrato conservado |
| --- | --- | --- | --- |
| `dashboard-real-pointer-navigation` · *return to the committed module* | La rama de Clínica toma los valores de la fila #25, que la de Admin ya tenía; desaparece la bifurcación por rol | DT-16 = A; la máquina no tiene `history.back()` | Mismos escenarios y viewports. Stage y `aria-current` vuelven a A en el clic; payloads = el de B y uno a la URL de A; B no escribe historial ni repinta; `history.length` no crece; Back al landing, Forward a A y sin entrada Forward de B; sin `document`; sin errores de página |
| ídem · *Back after the flight was abandoned* | La URL tras elegir el módulo por defecto es `/dashboard` | El owner navega el default a su URL canónica | Todas las demás verificaciones, sin cambios |
| `dashboard-global-live-navigation-sync` · *Back to the same committed module* | La segunda entrada con el mismo módulo (`?module=operaciones` sobre `/dashboard`) se abre con el router en vez de con un clic | Un clic sobre el módulo que ya se muestra no navega (#4), así que el owner no puede producir esa segunda escritura | El escenario completo: con B en vuelo, Back a una entrada del módulo comiteado gana, la respuesta tardía no lo deshace, el historial no crece y Forward restaura. Es la fila #28 |
| `dashboard-interaction-foundation`, `dashboard-card-navigation-shell` (×2), `dashboard-b09-mobile-navigation-unification` | `toHaveURL(/\/dashboard$/)` tras elegir Operaciones | URL canónica del módulo por defecto | La URL exacta sigue afirmada, con el workspace y `aria-current` |
| `e2e/suites/catalog.ts` | Entrada del spec nuevo; el `proves` de `dashboard-real-pointer-navigation` describe un solo contrato de "volver al módulo comiteado" | Verdad del catálogo | — |

Se conservan **sin tocar**: *module shell*, *clinic full routes* (clic, hand-over A→B y Back antes del commit,
con y sin Navigation API), *superseded commit*, *single flight*, *clinic full-module control*, *clinic burst
that leaves the hub* y *abandoned flight* (los tres primeros casos) de `dashboard-real-pointer-navigation`; el
resto de `dashboard-global-live-navigation-sync`; `navigation-truncated-stream-recovery`; y todo
`dashboard-navigation-fsm-admin`.

## 10. RED / GREEN

**RED-1, sobre `7d930897` sin tocar código productivo.**

- `test/architecture/dashboard-navigation-fsm-clinic.test.ts`: 4 de 17 en rojo, los cuatro causales — el
  adaptador no tiene `registerClinicNavigationOwner`; el controlador no lee el owner; el provider no declara la
  superficie de Clínica; el adaptador conserva el bus de hub-reset. Los 13 restantes pasan porque afirman
  contratos de la máquina y del coordinador, que ya estaban en `main`.
- `dashboard-navigation-fsm-clinic.spec.ts` sobre el build de `main`: 18 de 29 en rojo. La restauración nunca
  pide el payload del módulo almacenado (D-12), no existe aviso de `STALLED` y la frontera no tiene owner.

**GREEN.** El mismo unit, 17 de 17; el spec, 32 de 32 (después del RED se agregaron el caso DT-10 y los dos
de la auditoría de cierre, §10.1).

**Defecto hallado por la cohorte, no por las corridas dirigidas.** La primera `e2e:visual-contract` falló en
`dashboard-real-pointer-navigation`, bloque *clinic full routes*, "A then B before A commits keeps B across
the owner handoff" para `/dashboard/informes` (390×844 y 1366×768): el ítem actual de la navegación mostró el
primer destino después de elegido el segundo. Ese bloque había pasado dos veces aislado; bajo la carga de la
cohorte el controlador se montó un commit después que el chrome. Causa y corrección en §4.4. Tras el cambio,
el bloque completo de rutas completas pasó 192 de 192 con `--repeat-each=8`, y la cohorte entera (§13).

### 10.1. Auditoría de cierre prepublicación

Seis puntos declarados como divergencias se verificaron con código, contrato y evidencia ejecutada.

| Punto | Contrato | Evidencia |
| --- | --- | --- |
| A. `useStageModule.ts` y `DashboardNavigationFrame.tsx` | §11.3: "`useStageModule` pasa a ser un selector del store de la FSM (`state.display`), no un store aparte" | A/B sobre el mismo build y el mismo comando (bloque *clinic full routes*, `--repeat-each=8`): con los dos archivos en su versión de `HEAD`, **13 de 192 fallan** ("… painted after … was chosen", en `/dashboard/informes` y `/dashboard/logistica`); con el cambio, **192 de 192**, dos veces. El selector no decide nada: devuelve el `display` del store o, si es una ruta completa, lo publicado |
| B. URL desnuda de Operaciones | §12.5: "`href` con la gramática existente (`buildDashboardModuleHref`, `clinicModuleHref`; default de Clínica = URL desnuda)"; §12.6: "Navegar a la URL vigente es `replace` sin entrada nueva" (#25) | E2E "the default module is navigated to as the bare URL…" y, agregado en el cierre, "the default module committed as ?module=operaciones is returned to by a push of that very URL, with no entry": la rama de `clinicHref` que conserva la escritura vigente no tenía evidencia propia. El bloque existente *burst that leaves the hub*, sin tocar, ya exigía `/dashboard` para la continuación |
| C. Reclamo desde rutas completas | Ficha PR-NAV-04, rev. 2.3: "la máquina reclama igual desde una ruta completa, lo que es seguro pero secuencial"; ficha PR-NAV-05: stage como vista, `OPEN_ROUTE`, UI de `STALLED`, retiro de `handsOver` | `ClinicFullRouteModuleStage.tsx` y `FullModuleRouteControl.tsx` sin diff; ningún `OPEN_ROUTE` se despacha en `frontend/src`; el stage sigue suscripto con `handsOver` y el unit afirma que no reclama. Lo que cambia es quién navega el clic del chrome, que es el adaptador de esta ficha |
| D. Persistencia al entrar por una ruta completa | §12.1 rev. 2.1: "`HYDRATED.location` de una ruta completa de Clínica lleva `{ kind: "route", path, module }`…"; fila #1; S12 | Un único `writeDashboardLastModule(` y un único `readDashboardLastModule(` en `frontend/src` fuera del helper, ambos en el provider. Unit: entradas *a full route* y *a full route without a module of the surface*. E2E agregado en el cierre: "a full route entered directly stores its module, and the next bare entry restores it" |
| E. Guards de Admin realineados | — | Prueba de mutación sobre el provider, nueve mutantes, **nueve detectados** por los guards realineados (tabla siguiente); sin mutar, los cuatro archivos pasan |
| F. `SELECT_HUB` sin emisor | Ficha: "`SELECT_HUB` = `ROUTER_PUSH(?hub=1)` con `ROUTING` (#7; hoy sin emisor, §11.3)". Su fila "Tests" no lista ninguna prueba de integración de `SELECT_HUB`; la aceptación pide "hub→módulo→Back vuelve al hub" | Unit: adaptador → owner, y coordinador con la configuración de Clínica (#7: `ROUTER_PUSH(hub)`, `display = hub`). E2E: hub → módulo → Back. No falta una prueba obligatoria. Lo que ninguna prueba ejecuta es el cableado real `requestClinicHubReset` → `router.push("/dashboard?hub=1")` en un navegador: no hay control que lo dispare y agregarlo como gancho de prueba al código productivo está fuera de lugar. Queda como riesgo residual, a cerrar por el PR que agregue el emisor |

Mutantes del punto E, cada uno aplicado a `DashboardNavigationProvider.tsx` y retirado:

| Mutante | Detectado por |
| --- | --- |
| Admin persiste bajo la clave de Clínica | `b13-admin-entry`, `last-module`, `lateral-navigation` |
| La entrada de Admin nunca es explícita | `b13-admin-entry`, `last-module` |
| El provider del layout lee los parámetros de búsqueda | `lateral-navigation` |
| `children` envuelto en una frontera | `lateral-navigation` |
| El hook de Admin alcanza el store de Clínica | `lateral-navigation` |
| Se resuelve un store sin slot de la superficie | `lateral-navigation`, `route-error-boundaries` |
| Módulos de Admin leídos con la gramática de Clínica | `b13-admin-entry`, `last-module`, `lateral-navigation` |
| Una segunda escritura de almacenamiento | `last-module` |
| La restauración de Admin sale por `push` | `b13-admin-entry` |

## 11. Riesgos residuales

| Riesgo | Estado |
| --- | --- |
| DT-13: tras un fallo de render durante la restauración inicial se pierde la preferencia almacenada | Pendiente de decisión (§7); fijado por unit y E2E tal como es |
| `STALLED` en una ruta completa no tiene UI: el aviso vive en el stage de `/dashboard` | PR-NAV-05 ("UI de `STALLED` con Reintentar" en el stage de ruta completa). Una nueva selección reintenta (#16) |
| Desde una ruta completa la segunda elección espera a la primera (secuencial) | Deliberado en la ficha; recuperar la navegación inmediata exige la medición de H1 que la ficha asigna a PR-NAV-05 |
| El corte de payload que monta la frontera al entrar depende del tamaño relativo de layout y página: 22 % en `/dashboard` (ventana medida 15–30 %) y 55 % en `/dashboard/informes` (35–90 %) | Medido en Windows local; si CI Linux difiere, el E2E falla de forma visible, no silenciosa |
| Residual DT-15: el payload abandonado puede dejar su entrada | Registrado por E2E, no afirmado en cero |
| El aviso de `STALLED` está duplicado entre el controlador de Admin y el de Clínica | Deliberado: extraerlo exigía tocar el controlador de Admin. Candidato a PR-NAV-07 |
| `clinic-hub-reset.ts` conserva el replay `unheardActivation` sin consumidores, y `useNavigationFlight.ts` y las funciones de estado de `clinicNavigationState.ts` quedan sin importadores | Código inerte; su retiro está asignado a PR-NAV-05 y PR-NAV-07 |
| Comentarios que describen el modelo anterior en archivos fuera de scope (`ClinicFullRouteModuleStage.tsx`, `navigationFlight.ts`, `dashboardModuleNavigation.ts`, el encabezado de la máquina) | Reportado; esos archivos no se tocan aquí |
| El cableado real de `SELECT_HUB` hasta `router.push("/dashboard?hub=1")` no se ejecuta en ningún navegador: no tiene emisor en el producto (§10.1, F) | Cubierto por unit hasta el efecto; el PR que agregue el emisor debe traer su E2E |
| P3 (StrictMode con React real) no se volvió a medir | El owner es el mismo código que PR-NAV-03 midió; no hay cohorte sobre `next dev` en CI |

## 12. Rollback

Revert del squash. Restaura el controlador, el adaptador, el provider de PR-NAV-03 y los guards y E2E
realineados. Admin vuelve exactamente a PR-NAV-03, porque su superficie no cambió de comportamiento. No tiene
dependientes fusionados: PR-NAV-05 parte de aquí.

## 13. Validaciones

Ejecutadas en local (Windows, Next 16.3.8, Chromium de Playwright), en secuencia y de a una tarea pesada,
sobre el árbol de trabajo sin commit. Los E2E corren sobre el production runner (`next start`) con las
variables de build de `frontend-ci.yml`. Estados canónicos de `AGENTS.md` §6.

| Gate | Estado | Observado |
| --- | --- | --- |
| Unit del corte (`test/architecture/dashboard-navigation-fsm-clinic.test.ts`) | PASSED | 17 de 17 |
| Suite del coordinador (sin modificar) | PASSED | 44 de 44 |
| Suite de la máquina rev. 2.3 (sin modificar) | PASSED | 286 de 286 |
| Guards del controlador, del provider y del catálogo E2E | PASSED | Dentro de la corrida completa con los archivos nuevos visibles como trackeados |
| `pnpm --dir frontend lint` | PASSED | exit 0 |
| `pnpm --dir frontend typecheck` | PASSED | exit 0 |
| `pnpm --dir frontend build` | PASSED | exit 0; todas las rutas del dashboard siguen dinámicas |
| `pnpm security:public-surface` | PASSED | exit 0 |
| `pnpm typecheck:test` | PASSED | exit 0 |
| `pnpm test` | FAILED | 5302 de 5330. 26 de los 27 fallos existen sólo porque los tres archivos nuevos aún no están trackeados (la suite lee fuentes y censa por el lector de archivos trackeados): con esos archivos visibles como trackeados pasan 5328 y falla 1. Ese fallo, en ambos estados, es `e2e-global-03b-authoritative-auth-boundary.fastify.test.ts`, que requiere base de datos: ambiental, ajeno a este cambio |
| E2E dirigido: `dashboard-navigation-fsm-clinic` | PASSED | 32 de 32 (30 de 30 antes de los dos casos del cierre) |
| E2E dirigido: `dashboard-real-pointer-navigation`, `dashboard-global-live-navigation-sync`, `dashboard-interaction-foundation`, `navigation-truncated-stream-recovery`, `dashboard-navigation-fsm-admin` | PASSED | Dentro de las cohortes; el bloque de rutas completas, además, 192 de 192 con `--repeat-each=8` |
| `pnpm --dir frontend e2e:visual-contract` | PASSED | 783 passed, 1 skipped (segunda corrida). La primera: 781 passed, 2 failed, el defecto de §10, corregido. No se repitió tras agregar los dos casos del cierre, que sólo agregan tests a un spec y no cambian código productivo |
| `pnpm --dir frontend e2e:public-clinic` | PASSED | 345 de 345, antes y después de la corrección de §4.4 |
| `pnpm --dir frontend e2e:smoke` | PASSED | 66 de 66, antes y después |
| Regresión de Admin: `pnpm --dir frontend e2e:admin-mobile` | PASSED | 159 de 159, antes y después |
| `git diff --check` | PASSED | sin hallazgos |
| `frontend/next-env.d.ts` y artefactos Playwright | PASSED | sin cambios en el árbol; nada en el diff |
| `e2e:extended`, `e2e:full` | NOT_RUN | No los exige la ficha ni el mapeo de §7 para este cambio |
| `pnpm typecheck`, `pnpm build` (backend), `pnpm audit` | NOT_RUN | Ningún archivo de backend ni de dependencias cambia |
| `db:migrate` | BLOCKED | Sin base de datos local |

La evidencia válida para el merge es la de CI Linux sobre el head de la PR.
