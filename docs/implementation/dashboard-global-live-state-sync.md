# DASHBOARD_GLOBAL_LIVE_SYNC · navegación de módulo viva en ambos dashboards

## Estado

PR #1830 sobre `main@f6486331`, rama `fix/dashboard-global-live-state-sync`. Frontend-only: no toca backend, API, auth, sesión, permisos, catálogos, rutas, geometría ni baselines. Incluye la corrección del P2 de review «Preserve Back navigation during optimistic activation» (ver «Back/Forward durante una activación pendiente»).

## Síntoma

"Existe lag en ambos dashboard; si no se actualiza la página no muestra el enlace." Al elegir un módulo, el dashboard seguía pintando el módulo anterior hasta que el servidor respondía:

- **Admin, ≥ 768 px (rail y drawer):** el click no cambiaba nada (workspace, ítem actual ni URL) durante todo el round-trip.
- **Clínica, ≥ 768 px:** el workspace cambiaba al instante, pero el ítem `aria-current` de la banda lateral quedaba en el módulo anterior: banda y workspace se contradecían.
- **Ambos roles:** la búsqueda de módulos del app bar (admin), los accesos «Módulos operativos» de Resumen (admin) y «Cambiar contraseña» del kebab móvil (ambos) esperaban el mismo commit.
- **< 768 px**, la barra móvil ya era optimista en ambos roles y no estaba afectada.

## Reproducción

Determinista, sin relojes: el spec retiene en vuelo cada payload de navegación del router (requests `_rsc`) mientras aserta el DOM vivo, y recién después los libera. Con una latencia de servidor de 2,5 s (probe local) el retraso visible es exactamente ese round-trip.

- `REPRO_BEFORE = FAILED`: 20 de 24 en la matriz de banda (admin: el workspace destino nunca aparece con el servidor retenido; clínica: `aria-current` recibe `operaciones` con el workspace ya en `informes`), y 5 de 5 en los destinos fuera de la banda. Los 4 casos móviles pasan, lo que aísla la causa en la banda ≥ 768 px y en los productores sin señal.
- `REPRO_AFTER = PASSED`: 29 de 29.

## Causa raíz

Un cambio `?module=` es una navegación de una página dinámica (`page.tsx` async, lecturas `no-store` al backend). El router sólo comitea la URL cuando llegó el render completo del servidor. Todo lector que dependía únicamente de ese commit iba un round-trip detrás del click.

El repo ya tenía el contrato para esto, la **activación optimista**: el destino publica el módulo, el controller cambia el stage y un intent guard concilia el commit posterior. Ese contrato estaba aplicado de forma incompleta:

| Fuente | Antes | Problema |
|---|---|---|
| Drawer / Rail, admin | sin señal (`if (isAdmin) return;`, anclado por test) | el controller admin esperaba la URL |
| Banda lateral, ítem actual (ambos) | sólo `useSearchParams` | el resaltado esperaba la URL |
| App bar, búsqueda, admin | sin señal (comentario obsoleto: "admin has no such activation buffer") | ídem |
| Resumen admin, accesos | sin señal | ídem |
| Kebab móvil, «Cambiar contraseña» (ambos) | sin señal | ídem |

- **ADMIN_CAUSE:** destinos que no publicaban `requestAdminModuleActivate`, más el resaltado lateral derivado sólo de la URL.
- **CLINIC_CAUSE:** el resaltado lateral derivado sólo de la URL (el stage ya era optimista), más el kebab sin señal.
- **SHARED_OWNER:** `DashboardNavigationFrame` para el ítem actual de la banda, y el canal de activación de cada rol para el stage.

## Fix

1. **Paridad de productores:** Drawer, Rail, búsqueda del app bar, accesos de Resumen y kebab publican la activación de su rol.
2. **Ítem actual vivo en el owner común:** `DashboardNavigationFrame` escucha la misma activación que el stage (`subscribeClinicModuleActivate` o `observeAdminModuleActivate`). El override se liga al módulo comiteado desde el que se emitió y se descarta en el próximo commit, así que la URL sigue siendo la única autoridad para deep link, reload, Back y Forward. No se agrega una tercera fuente de verdad.
3. **Canal observador admin (`observeAdminModuleActivate`):** el canal admin entrega la última activación no escuchada al **primer** suscriptor (hand-over tardío para el controller). Si la navegación se suscribiera como listener, se quedaría con ese hand-over. Los observers reciben cada request, pero no cuentan como "escuchado" ni consumen el hand-over. La barra móvil admin también observa, en paridad con la clínica.

Drawer y Rail siguen sin estado; el estado transitorio vive en el frame.

## Back/Forward durante una activación pendiente (P2 de review)

**Defecto.** Con B todavía en vuelo (workspace y navegación ya en B, URL en A), un Back producía un commit que los controllers clasificaban como «commit superado del router»:

- **Admin:** hacía `return` sin abandonar el intent. URL y resaltado volvían al módulo histórico, pero el workspace quedaba en B indefinidamente, incluso después de un Forward.
- **Clínica:** reconciliaba la URL hacia B con `router.replace`, que es un segundo payload de B. Si ese replace se cancelaba, Next hacía una navegación dura a B: el Back quedaba deshecho.

Reproducción: 21 de 21 casos fallan sobre `27411943`. El router de Next descarta por sí mismo la navegación B superada por el Back: en ningún modo hubo `pushState` ni commit tardío de B. El problema era sólo nuestra clasificación.

**Modelo.** Un commit que no coincide con el intent pendiente sólo puede ser *stale* si su módulo es el destino de una activación **superada mientras seguía en vuelo**. Esos destinos se registran al grabar un intent nuevo (`supersededTargets`). Cualquier otro commit que no coincide es una navegación externa (Back, Forward o deep link) y es del usuario: el intent se abandona y se obedece la URL.

| Commit observado con intent pendiente | Clase | Acción |
|---|---|---|
| destino del intent | intent confirmado | consumir y obedecer |
| destino superado en vuelo | commit stale del router | Clínica reconcilia y Admin ignora (sin cambios) |
| otro módulo | navegación externa | abandonar el intent y obedecer |
| sin cambio de módulo | no es commit | respaldo `popstate` |

La clasificación no depende del orden entre el listener `popstate` de Next y los nuestros. Se midió que el efecto de URL ve el commit del Back antes que nuestro handler, incluso en fase capture, así que una solución basada sólo en `popstate` no alcanzaba.

**Origen del commit (traverse).** El módulo solo no alcanza como identidad: un Back puede caer en una entrada del mismo módulo que una activación superada, y ese commit es idéntico a un commit stale de B. Con B superada por C, Clínica lo reconciliaba a C y deshacía el Back; CI lo reprodujo en drawer, rail y mobile. `subscribeHistoryTraversal` (`lib/dashboard/navigation/historyTraversal.ts`) escucha el evento `navigate` de la Navigation API con `navigationType === "traverse"`, que se dispara al **iniciar** el traverse, antes de que cambie la URL y antes de `popstate`. Cada controller levanta un flag que consume el primer commit (o el respaldo `popstate`), y ese commit es externo aunque su módulo sea un destino superado (`applyClinicUrlCommit(..., "history")` en Clínica, `fromHistory` en Admin). Sin Navigation API la suscripción no hace nada y queda el comportamiento por módulo más el respaldo `popstate`.

**Respaldo `popstate`.** Un Back a una entrada que lleva el mismo módulo comiteado (por ejemplo `/dashboard` y `/dashboard?module=operaciones`) no cambia el módulo, así que ningún commit llega al clasificador. Para ese caso, `popstate` abandona el intent y vuelve el stage al módulo comiteado (`relinquishClinicNavigationIntent` en Clínica). Además descarta el override del ítem actual en `DashboardNavigationFrame` y el slot optimista de `DashboardMobileNav`. Cada listener se registra en un efecto y se limpia con `removeEventListener`.

Que los tres handlers son causales se demostró desactivando cada uno: el caso «mismo módulo comiteado» falla en el workspace o en `aria-current`. En Admin el respaldo es defensivo: la UI no crea dos entradas seguidas del mismo módulo (landing y `?hub=1` usan replace).

## Por qué no hay refresh

No se usa `router.refresh`, `reload`, `replace` al mismo URL, timers, keys aleatorias ni navegación dura. No hace falta revalidar ningún Server Component: los datos de los workspaces ya están en el payload actual, y lo único que faltaba era que la UI siguiera a la intención del usuario.

## Matriz de tests

- `frontend/e2e/platform/app-shell/dashboard-global-live-navigation-sync.spec.ts` (cohorte `visual-contract`, layer `fixture`): 2 roles × 6 viewports (390×844, 768×1024, 1024×768, 1366×768, 1536×960, 1920×1080) × {switch con servidor retenido + interacción inmediata tras reload; A→B→C rápido con servidor retenido + Back/Back/Forward}, más app bar, accesos de Resumen y kebab. Asegura un solo `aria-current` en la navegación pintada, un solo workspace y un solo payload por switch, sin warnings de hydration.
- Mismo spec, bloque «Back during a pending activation» (25 casos). Cubre Admin y Clínica × {drawer 1366, rail 1024, mobile 390}, cada uno con:
  - una activación pendiente;
  - B superada por C;
  - Back a una entrada del módulo superado.

  Suma la búsqueda del app bar (ambos roles), los accesos de Resumen, el kebab (ambos roles) y el Back a la entrada del mismo módulo comiteado (drawer y mobile). En cada caso, con el payload retenido, asegura que el Back gana en URL, workspace y `aria-current` antes de liberar B. Después de la respuesta tardía de B, que el router lee o descarta, asegura que el Back no se deshace, que no hay escrituras de historial hacia el módulo abandonado, que `history.length` se conserva, que hay un solo payload, que no hay navegación de documento y que Forward restaura la entrada.
- **Sin `route.abort()`.** Es un fallo de red, no una cancelación del router: Next responde a un Flight fallido con una navegación del browser al URL que falló («Falling back to browser navigation», `fetch-server-response.js`), aunque el historial ya lo haya dejado. CI (Linux, `next start`) lo mostró con 8 de 8 casos `cancelled` y el trace con un request de documento a B 5 ms después del abort. El router de Next no aborta el fetch de una navegación superada: la descarta (`continue` resuelve y la respuesta se ignora). Ese es el contrato real y está cubierto por la respuesta tardía.
- `test/unit/ui/dashboard/dashboard-clinic-navigation-state.test.ts`: clasificación del Back con intent pendiente, sólo un destino superado es stale, re-grabar el mismo destino no se supera a sí mismo, el respaldo `relinquishClinicNavigationIntent`, un traverse sobre un destino superado es externo, y `subscribeHistoryTraversal` sólo reacciona a `traverse` y limpia su listener.
- `test/unit/ui/dashboard/frontend-dashboard-lateral-navigation.test.ts`: la señal deja de ser clinic-only (realineado), anclas del frame y un test runtime del observador: no consume el hand-over y el unsubscribe funciona.
- Censos del catálogo E2E realineados en +1 (`e2e-suite-catalog-completeness`, `e2e-completeness-workflow`).

## No-alcance

- **Round-trip del servidor por switch:** sigue existiendo (un payload por cambio de módulo, refetch `no-store`). Convertir el cambio de módulo en estado cliente (`history.pushState`) cambiaría la semántica de frescura de datos: es una decisión aparte.
- **Destinos que cambian de página real** (rutas completas de Clínica, «Abrir módulo completo», campana de notificaciones): no son estado `?module=`. Banda y página cambian juntas en el commit, y no se adelanta el resaltado para no contradecir la página visible.
- **Spelling del destino por defecto:** la banda lateral emite `/dashboard?module=operaciones` en vez del `/dashboard` canónico. Es preexistente y no afecta la sincronización; se reporta y no se corrige acá.

## Riesgos residuales

- Si llega un commit superado (A después del optimista B), el ítem lateral sigue a la URL hasta el commit de B. Es el mismo comportamiento que ya tenía la barra móvil, y el estado final converge.
- **Navegadores sin Navigation API:** un Back exactamente sobre una entrada de un destino superado vuelve a clasificarse por módulo. Clínica puede reconciliar a C si el efecto de URL corre antes que `popstate`.
- **Fallo de red real del Flight de una navegación ya dejada por el historial:** es fallback del framework. Next navega con el browser al URL fallido, y eso no se modela como contrato del dashboard.
- Si el servidor nunca responde, la URL no se mueve aunque la UI ya muestre el destino. Un reload en ese estado vuelve al módulo de la URL.
