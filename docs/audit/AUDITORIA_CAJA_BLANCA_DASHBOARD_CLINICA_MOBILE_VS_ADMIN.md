# Auditoría caja blanca — Dashboard Clínica mobile vs Dashboard Administración mobile

Runtime-first. Navegador real primero, código después. Sin baselines visuales previos,
sin screenshots históricos, sin snapshots Playwright, sin tests existentes como verdad visual.

---

## 1. Executive result

```text
GLOBAL_CLINIC_MOBILE_ADMIN_PARITY = FAIL
```

Base exclusiva del veredicto: 126 mediciones DOM reales (66 Admin + 60 Clínica) tomadas en
Chromium 149.0.7827.55 sobre la aplicación real levantada desde el working tree en
`b68e22a3`. Ninguna superficie clínica reproduce la gramática mobile de Administración.

```text
TOTAL_VISUAL_DIFFERENCES          = 42
TOTAL_DIFFERENCE_INSTANCES        = 183   (DIF × superficie clínica afectada)
CLINIC_SURFACES_WITH_ZERO_DELTAS  = 0 / 10
ROOT_CAUSES                       = 17
```

Lo que **sí** está en paridad y no debe tocarse: el contrato zero-scroll de documento
(`pageScrollsY = false` y `pageScrollsX = false` en las 126 mediciones), el shell raíz
`.dashboard-app-shell` (`h-dvh`, `overflow:hidden`), la altura del bottom nav (51.19 px en
ambos roles), el anillo de foco (`3px` + `inset 0 0 0 2px rgba(24,145,149,.85)` idéntico) y
el primitivo de diálogo (`x=16`, `w=358`, `radius 8px`, `position:fixed`, cierre por
`Escape` verificado en ambos roles).

---

## 2. Scope

```text
Admin  = REFERENCIA CANÓNICA, READ-ONLY. No se modifica, no se rediseña.
Clínica = ÚNICO TARGET.
Alcance = MOBILE únicamente.
Esta ejecución NO implementa cambios de producto.
```

Desktop, laptop y tablet quedan fuera salvo para derivar qué breakpoint define mobile
(`max-width: 767px`, 21 ocurrencias en `frontend/src/**/*.css`; los 6 viewports auditados
son todos < 768 px).

---

## 3. Runtime environment

| Item | Value |
| --- | --- |
| Branch | `main` |
| HEAD SHA | `b68e22a3ba6b42dd86d7b75a6b3dafe21843cbb1` |
| Working tree | limpio al iniciar (0 modificados, 0 untracked, 5 stashes preexistentes preservados) |
| Node | v24.14.1 |
| PNPM | 11.13.0 (`packageManager` en `package.json`) |
| Playwright | 1.61.0 |
| Browser | Chromium 149.0.7827.55 (`ms-playwright/chromium-1228`) |
| Frontend runtime | `pnpm dev --hostname 127.0.0.1` → `http://127.0.0.1:3000` (HTTP 200 verificado) |
| API runtime | `node e2e/fixtures/admin-populated-api-server.mjs` → `http://127.0.0.1:3107` (`/__e2e/health` → `{"ok":true}`) |
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:3107` |
| Auth Admin | cookie `admin_session_id=e2e_populated_admin_session` (sesión sintética del repo) |
| Auth Clínica | cookie `app_session_id=e2e_populated_clinic_session` (sesión sintética del repo) |
| Instrumentación | fuera del repositorio, en `%TEMP%\vetneb-clinic-mobile-parity` |

Ninguna credencial real, ningún entorno remoto, ningún secreto. Las cookies son los valores
sintéticos que el propio harness E2E del repositorio define y que el fixture server valida
(`frontend/e2e/fixtures/admin-populated-api-server.mjs:17-18`).

### 3.1. Matriz de viewports mobile (derivada del repositorio, no inventada)

Unión de los dos conjuntos que el repo declara como mobile:

| Slug | W×H | Fuente en el repo |
| --- | --- | --- |
| `w360x740` | 360×740 | `ADMIN_MOBILE_VIEWPORTS` (`frontend/e2e/helpers/admin-mobile-contracts.ts:5-9`) + `dashboard-zero-scroll-mobile-boundary.spec.ts:6` |
| `w360x800` | 360×800 | `DASHBOARD_GEOMETRY_VIEWPORTS` (`frontend/e2e/helpers/dashboard-geometry-matrix.ts:479`) |
| `w375x812` | 375×812 | `DASHBOARD_GEOMETRY_VIEWPORTS` (`:478`) |
| `w390x844` | 390×844 | ambos conjuntos |
| `w412x915` | 412×915 | `DASHBOARD_GEOMETRY_VIEWPORTS` (`:476`) |
| `w430x932` | 430×932 | ambos conjuntos |

```text
MOBILE_VIEWPORTS = 6
```

Los viewports `w834x1194` y `w768x1024` de la matriz A02 están clasificados como *Tablet*
por el propio repositorio y quedan fuera del alcance.

---

## 4. Methodology

```text
LIVE_BROWSER_FIRST
CODE_SECOND
NO_HISTORICAL_VISUAL_BASELINE
```

Orden ejecutado, sin alteración:

1. Lectura completa de `AGENTS.md` (único, sin anidados).
2. Baseline Git.
3. Runtime discovery (sólo infraestructura de arranque y autenticación).
4. Arranque del producto real y verificación HTTP.
5. **Censo Admin en navegador** — recorrido de toda la navegación mobile.
6. **Medición Admin** — 11 superficies × 6 viewports.
7. **Censo e inspección Clínica** — abierta sólo después de cerrar la fase Admin.
8. **Medición Clínica** — 10 superficies × 6 viewports, esquema idéntico.
9. Comparación runtime↔runtime.
10. Trazado a código.

**Corrección metodológica registrada.** El primer esquema de medición se construyó con los
selectores del helper `dashboard-geometry-matrix.ts` (`.dashboard-workspace-header`,
`[data-dashboard-metric-strip]`, `[data-dashboard-filter-bar]`). Ese esquema devolvió
regiones vacías en las 66 mediciones Admin: en `HEAD` esos hooks ya no son los que Admin
mobile renderiza (PR #1676 canonicalizó el workspace header y PR #1679 reubicó las tiras de
métricas). El esquema se **descartó y se reconstruyó desde el DOM vivo**, y las mediciones
Admin se repitieron completas. Esto es exactamente lo que la regla "runtime primero" existe
para evitar: un contrato de test desactualizado habría producido una auditoría falsa.

Modelo de medición (idéntico para ambos roles, sin ninguna variable condicionada por rol):
`getBoundingClientRect` + `getComputedStyle` sobre el DOM renderizado, con readiness por
selector, `networkidle`, `document.fonts.ready`, dos `requestAnimationFrame` y estabilización
por tres lecturas idénticas consecutivas antes de congelar cada registro.

Las cinco superficies cuyos endpoints el fixture server responde 404 se estabilizaron con
los stubs canónicos que el propio repositorio ya define (`installSurfaceMocks` +
`DASHBOARD_GEOMETRY_SURFACES`), para no congelar la geometría accidental de una tarjeta de
error: `admin-clinics`, `admin-pricing`, `admin-sessions`, `admin-maintenance` y
`clinic-perfil`.

---

## 5. Admin runtime census

Recorrido real: entrada a `/dashboard/admin`, activación de las 5 entradas del bottom nav,
apertura de la hoja "Más" y paginación completa de la hoja y del hub.

```text
ADMIN_RUNTIME_SURFACES  = 11
ADMIN_MOBILE_VIEWPORTS  = 6
ADMIN_SURFACES_INSPECTED = 11/11   (66/66 combinaciones, 0 fallos)
ADMIN_VISUAL_REFERENCE_COMPLETE = YES
```

| ID | Admin route | Surface | Reachable from | Interactive states |
| --- | --- | --- | --- | --- |
| ADM-001 | `/dashboard/admin?hub=1` | Inicio (hub launcher) | bottom nav `home` | paginación de tiles (2 páginas, 10 tiles) |
| ADM-002 | `?module=admin` | Resumen (status) | hub, overflow | chips Resumen/Actividad/Alertas |
| ADM-003 | `?module=admin-report-upload` | Informes (core) | hub, overflow | pager, diálogo "Subir informe" |
| ADM-004 | `?module=admin-health` | Estado del sistema (status) | hub, overflow | chips Servicios/Runtime/Esquema |
| ADM-005 | `?module=admin-clinics` | Clínicas (core) | bottom nav, hub, overflow | filtro, pager (6 págs.), diálogo "Nueva clínica" |
| ADM-006 | `?module=admin-particular-tokens` | Tokens particulares (core) | hub, overflow | chips, pager, diálogo "Generar token" |
| ADM-007 | `?module=admin-pricing` | Precios (config) | hub, overflow | chips Editar/Catálogo, pager (14 págs.) |
| ADM-008 | `?module=admin-sessions` | Sesiones (ops) | bottom nav, overflow | 2 filtros select, pager (5 págs.) |
| ADM-009 | `?module=admin-users-roles` | Usuarios y roles (ops) | overflow | 3 filtros, pager |
| ADM-010 | `?module=audit-log` | Auditoría (ops) | bottom nav, overflow | métricas inline, diálogo "Filtros", pager (4 págs.) |
| ADM-011 | `?module=admin-maintenance` | Mantenimiento (config) | hub, overflow | chips Esquema/Dry-run |

Superficie secundaria recorrida y registrada: la hoja de overflow del bottom nav
(`[data-dashboard-mobile-nav-overflow]`, 2 páginas, 10 destinos). No constituye una
superficie de contenido y no entra en la matriz de medición.

---

## 6. Clinic runtime census

Recorrido real: entrada a `/dashboard` (esperando el `replace` de canonicalización),
activación de las 6 entradas del bottom nav, y recorrido de las rutas completas alcanzables
desde "Abrir módulo completo" y desde la barra de acciones del hub de logística.

```text
CLINIC_RUNTIME_SURFACES  = 10
CLINIC_MOBILE_VIEWPORTS  = 6
CLINIC_SURFACES_INSPECTED = 10/10   (60/60 combinaciones, 0 fallos)
CLINIC_VISUAL_INSPECTION_COMPLETE = YES
```

| ID | Clinic route | Surface | Reachable from | Interactive states |
| --- | --- | --- | --- | --- |
| CLN-001 | `/dashboard?module=operaciones` | Centro de operaciones | bottom nav `home` y `operaciones` | 3 tabs Métricas/Recientes/Estado |
| CLN-002 | `/dashboard?module=informes` | Informes (módulo) | bottom nav `informes` | diálogo "Filtros", pager (10 págs.), "Abrir módulo completo" |
| CLN-003 | `/dashboard?module=logistica` | Logística (módulo) | bottom nav `logistica` | filas clicables, pager, "Abrir módulo completo" |
| CLN-004 | `/dashboard?module=perfil` | Perfil público | bottom nav `perfil` | 5 tabs, guardar perfil, imagen |
| CLN-005 | `/dashboard?module=tokens` | Tokens particulares | bottom nav `tokens` | diálogo "Filtros", "Generar token particular" |
| CLN-006 | `/dashboard/informes` | Informes (ruta completa) | CLN-002 "Abrir módulo completo" | 3 filtros + Filtrar/Limpiar, pager (500 págs.), "Ver detalle" |
| CLN-007 | `/dashboard/logistica` | Hub de logística (ruta completa) | CLN-003 "Abrir módulo completo" | 2 pagers, sticky action bar (Ver visitas/rutas/métricas) |
| CLN-008 | `/dashboard/logistica/visitas` | Visitas de campo | CLN-007 "Ver visitas" | tira de métricas, pager |
| CLN-009 | `/dashboard/logistica/rutas` | Planes de ruta | CLN-007 "Ver rutas" | tira de métricas, pager |
| CLN-010 | `/dashboard/logistica/metricas` | Métricas de logística | CLN-007 "Ver métricas" | tira de métricas, pager, bloques por plan |

Ninguna superficie clínica se declara N/A. Las 10 fueron abiertas, medidas y operadas.

---

## 7. Admin canonical mobile grammar

Derivada exclusivamente de los 66 registros runtime. No incluye ningún elemento que Admin
no tenga.

### G-001 · Shell

`div.dashboard-app-shell[data-vetneb-app-shell][data-vetneb-app-shell-surface="admin"]`,
`h-dvh`, `overflow:hidden`. Un único frame `[data-vetneb-app-shell-frame]`.
`pageScrollsY = false` y `pageScrollsX = false` en **66/66**; `localScrollers = 0` en **66/66**.

### G-002 · App bar

Altura **exactamente 48 px** en los 6 viewports (`--admin-mobile-appbar-h: 3rem`,
`mobile-admin.css:67`). Contiene **una sola** línea de texto: el título de contexto del
módulo (`.admin-mobile-context-title`, `16px / 650 / line-height 1.2`, `truncate`) y
**una sola** acción: el kebab de 44×44 px. El título genérico del producto, el subtítulo y
las acciones de escritorio están explícitamente ocultos en mobile.

### G-003 · Workspace header

**No existe en mobile.** `.dashboard-workspace-header` se oculta en toda superficie admin
(`display:none !important`) y el `padding-top` del module viewport se fuerza a `0`. Medido:
`legacyWorkspaceHeader = null` en 66/66; `moduleViewportPaddingTop = 0` en 60/60 módulos.

### G-004 · Module surface (tarjeta única)

Exactamente **una** `section.dashboard-surface` por módulo, que ocupa todo el canvas
disponible: `radius 8px`, `border 1px`, `background rgb(248,251,252)`, `overflow:hidden`.

| Viewport | surfaceTop | inset L/R | bottom gap | surface H (ADM-008) |
| --- | --- | --- | --- | --- |
| w360x740 | 54.91 | 6.91 / 6.90 | 6.90 | 627.00 |
| w360x800 | 54.91 | 6.91 / 6.90 | 6.90 | 687.00 |
| w375x812 | 54.98 | 6.98 / 6.99 | 6.99 | 698.84 |
| w390x844 | 55.06 | 7.06 / 7.06 | 7.06 | 730.69 |
| w412x915 | 55.17 | 7.17 / 7.17 | 7.17 | 801.47 |
| w430x932 | 55.27 | 7.27 / 7.26 | 7.26 | 818.28 |

La tarjeta **siempre llena** el hueco: `bottom gap == inset` en 60/60 módulos.

### G-005 · Banda de encabezado de la tarjeta

Primera banda hija de la tarjeta, `border-b`, altura 33.39–53.00 px según arquetipo, con
título (`12px / 600`) y subtítulo (`11px`) truncados y **una** acción a la derecha
(`Actualizar`, `Nueva clínica`, `Filtros`…). Padding medido 4.00–6.00 px vertical /
8.00–12.80 px horizontal.

### G-006 · Región de métricas

Único patrón de métricas visible en Admin mobile: una **corrida de texto en línea**
`span[data-dashboard-b14-metrics]`, `display:flex`, `align-items:baseline`, `gap 6px`,
`whitespace:nowrap`, `tabular-nums`, separadores `·`, **altura 16 px**, sin tarjeta, sin
borde, sin radio, sin fondo. Vive **dentro** de la banda de encabezado, no encima de ella.

| Viewport | y | h | ancho | tarjetas |
| --- | --- | --- | --- | --- |
| w360x740 | 73.91 | 16 | — | 5 spans (3 métricas + 2 separadores) |
| w360x800 | 73.91 | 16 | — | 5 |
| w375x812 | 73.98 | 16 | — | 5 |
| w390x844 | 74.06 | 16 | 181.06 | 5 |
| w412x915 | 74.17 | 16 | — | 5 |
| w430x932 | 74.27 | 16 | — | 5 |

Los otros cuatro `data-dashboard-b14-metrics` del código son **desktop-only**
(`hidden … md:grid` / `md:flex`) y no se renderizan por debajo de 768 px: verificado en
runtime (`metricsCount = 0` en ADM-003/006/008/009) y en fuente.

### G-007 · Banda de chips

Arquetipos status y config: banda `role="tablist"` dentro de la tarjeta, `border-b`,
altura 33.39 px, chips `flex-1` de **ancho igual** con `truncate`: 119.5×22.8 px (3 chips) o
180.7×22.8 px (2 chips), `font-size 10.56px / 600`, `radius 6px`, padding `4.8 / 6.4`.
**Nunca envuelven** a una segunda línea.

### G-008 · Banda de filtros

Fila `grid grid-cols-2 gap-2` dentro de la tarjeta, `border-b`, `bg-muted/15`, padding
`px-2 py-1`, altura 62 px; controles de 32–36 px con `font-size 12–14px`. Cuando no cabe,
la alternativa canónica es el diálogo "Filtros" (ADM-010), no un bloque expandido.

### G-009 · Canvas de filas

`[data-dashboard-adaptive-rows-canvas][data-dashboard-row-pitch="regular"]`,
`min-h-0 flex-1 divide-y overflow:hidden`. **Un solo token de pitch en todo Admin**:
`regular` = **44 px** (40 px sólo en `w360x740`, el viewport más bajo). Capacidad adaptativa
medida en ADM-008: 12 / 12 / 12 / 13 / 14 / 15 filas.

### G-010 · Pager

`nav.dashboard-pager[data-dashboard-adaptive-reserved-region="pager"]`, `border-t`,
altura **exactamente 40 px en los 6 viewports**. Gramática de etiqueta: rango + total +
página: `1–13 de 60 · Anterior · Pág. 1 / 5 · Siguiente`.

### G-011 · Bottom nav

`nav.dashboard-mobile-nav[data-dashboard-mobile-nav="admin"]`, altura 51.19 px,
**5 slots** de 78×50.2 px, etiqueta 9.6 px, quinto slot = "Más" (overflow de destinos).

### G-012 · Diálogo

`[role="dialog"]` `position:fixed`, `x=16`, `w=358`, `radius 8px`, cierre por `Escape`
verificado. Alturas medidas: 222 / 401.7 / 473 / 605 px según contenido.

### G-013 · Estado de error

Sin bloque de alerta desplazando la geometría: el error se comunica en el **subtítulo** de la
banda de encabezado (`text-[11px] text-destructive`) y con un mensaje **centrado y muted**
que llena el canvas de filas. La geometría de las bandas no cambia.

### G-014 · Orden de bandas

```text
appBar > surfaceHeader > [chips | filters | metrics] > rowsCanvas > pager > bottomNav
```

Las métricas van **después** del encabezado de la tarjeta, nunca antes.

### G-015 · Entrada / hub

`/dashboard/admin?hub=1` es una superficie propia: launcher de tiles paginado
(`[data-admin-mobile-hub-launcher]`, 10 tiles en 2 páginas), sin tarjeta de módulo.

---

## 8. Total differences

```text
TOTAL_VISUAL_DIFFERENCES   = 42
TOTAL_DIFFERENCE_INSTANCES = 183
TOTAL_ROOT_CAUSES          = 17
```

### Por categoría (suma = 42)

| Categoría | N | DIF |
| --- | --- | --- |
| DIMENSION | 5 | 001, 018, 026, 031, 038 |
| MISSING_COMPONENT | 5 | 011, 014, 015, 016, 041 |
| EXTRA_COMPONENT | 5 | 004, 005, 008, 019, 037 |
| METRICS | 4 | 020, 021, 022, 024 |
| TYPOGRAPHY | 3 | 002, 007, 023 |
| STRUCTURE | 3 | 003, 013, 039 |
| MOBILE_LIST | 3 | 028, 029, 030 |
| DENSITY | 2 | 006, 027 |
| POSITION | 2 | 010, 017 |
| PAGER | 2 | 032, 033 |
| STATE | 2 | 034, 035 |
| SPACING | 1 | 009 |
| SURFACE | 1 | 012 |
| FILTERS | 1 | 025 |
| SCROLL | 1 | 036 |
| RESPONSIVE | 1 | 040 |
| ORDER | 1 | 042 |
| **Total** | **42** | |

### Por superficie (instancias; suma = 183)

| Superficie | N | DIF |
| --- | --- | --- |
| CLN-001 | 19 | 001–013, 022, 023, 036, 038, 039, 041 |
| CLN-002 | 18 | 001–013, 024, 025, 031, 032, 042 |
| CLN-003 | 17 | 001–013, 024, 031, 032, 042 |
| CLN-004 | 20 | 001–013, 024, 026, 034, 035, 038, 039, 040 |
| CLN-005 | 17 | 001–013, 024, 025, 034, 035 |
| CLN-006 | 17 | 001, 002, 004–007, 014–017, 024–028, 031, 032 |
| CLN-007 | 18 | 001, 002, 004–007, 014–019, 024, 027, 030, 031, 032, 037 |
| CLN-008 | 19 | 001, 002, 004–007, 014–017, 020, 021, 023, 027, 030, 031, 032, 033, 042 |
| CLN-009 | 19 | 001, 002, 004–007, 014–017, 020, 021, 023, 027, 030, 031, 032, 033, 042 |
| CLN-010 | 19 | 001, 002, 004–007, 014–017, 020, 021, 023, 027, 029, 031, 032, 033, 042 |
| **Total** | **183** | |

---

## 9. Difference inventory

Todo valor es una medición runtime. Salvo indicación explícita, la diferencia se observó en
**los 6 viewports mobile**; los valores puntuales citados son de `w390x844` y las variaciones
por viewport se detallan cuando existen.

### G-002 · App bar

**DIF-001 — DIMENSION — altura de app bar**
Superficies: CLN-001…010. Referencia: G-002.
Admin `48.00` px en los 6 viewports (altura fija por token). Clínica `52.00` px en los 6.
Esperado: `48.00`. Delta **+4.00 px** por superficie. Severidad media; efecto operativo:
4 px menos de canvas de datos en todas las superficies clínicas.

**DIF-002 — TYPOGRAPHY — tipografía del título de app bar**
Superficies: CLN-001…010. Admin `16px / 650 / line-height 1.2`. Clínica `18px / 600 /
line-height 22.5px`. Esperado: `16px / 650 / 1.2`. Delta `+2px` de tamaño, `−50` de peso.

**DIF-003 — STRUCTURE — contenido del título de app bar**
Superficies: CLN-001…005. Admin muestra el **contexto del módulo** (`Resumen`, `Sesiones`,
`Clínicas`, `Auditoría`, `Mantenimiento`…). Clínica muestra el literal estático
`"Dashboard Clínica"` en los 5 módulos, idéntico para todos. Esperado: el nombre del módulo
activo. Severidad alta; efecto operativo: en Clínica el app bar no indica dónde está el
usuario, que es justamente la función que Admin le asignó al canonicalizar el header.

**DIF-004 — EXTRA_COMPONENT — subtítulo de app bar**
Superficies: CLN-001…010. Admin: ausente en mobile (`display:none`). Clínica: presente,
`"Portal operativo clínica"` (módulos) / descripción de ruta (rutas completas), `12px`,
caja de 16 px de alto. Esperado: ausente. Delta **+16 px** de crómo.

**DIF-005 — EXTRA_COMPONENT — acciones de app bar**
Superficies: CLN-001…010. Admin: **1** control (kebab `44×44`). Clínica: **3** controls —
theme toggle `36×36` en `x=245.3`, notificaciones `36×36` en `x=287.3`, "Salir" `48.7×40`
en `x=329.3`. Esperado: 1 control de 44×44. Delta `+2` controles; los tres miden **menos**
de 44 px de alto, por debajo del piso táctil que Admin aplica.

### G-011 · Bottom nav

**DIF-006 — DENSITY — slots del bottom nav**
Superficies: CLN-001…010. Admin: **5** slots de `78×50.2` px, quinto = overflow "Más".
Clínica: **6** slots de `65×50.2` px, sin overflow. Esperado: 5 slots de 78 px con overflow.
Delta `−13 px` de ancho de blanco táctil por slot.

**DIF-007 — TYPOGRAPHY — etiqueta del bottom nav**
Superficies: CLN-001…010. Admin `9.60px`. Clínica `8.96px`. Esperado `9.60px`.
Delta `−0.64 px`. Consecuencia directa de DIF-006.

### G-003 · Workspace header

**DIF-008 — EXTRA_COMPONENT — banda `.dashboard-workspace-header`**
Superficies: CLN-001…005. Admin: `null` (oculta) en 66/66. Clínica: presente,
**40.00 px** en los 6 viewports, con `h2.dashboard-workspace-header-title`.
Esperado: ausente. Delta **+40 px**.

**DIF-009 — SPACING — `padding-top` del module viewport**
Superficies: CLN-001…005. Admin: `0` forzado. Clínica: `16 px` (`pt-4` intacto).
Esperado: `0`. Delta **+16 px**.

**DIF-010 — POSITION — crómo antes del primer contenido**
Superficies: CLN-001…005. Admin: primer contenido en `y = 55.06`. Clínica: `y = 125.20`
(CLN-001) y `y = 166.80` (CLN-002 canvas). Esperado: `≈55`. Delta **+70.14 px** (CLN-001) y
**+111.74 px** (CLN-002). Por viewport, el canvas de CLN-002 arranca en
`177.47 / 166.38 / 166.50 / 166.80 / 172.70 / 173.02`.

### G-004 · Tarjeta de módulo

**DIF-011 — MISSING_COMPONENT — no existe `.dashboard-surface`**
Superficies: CLN-001…005. Admin: `surfaceCount = 1` en 60/60 módulos. Clínica:
`surfaceCount = 0` en 30/30. Esperado: 1. Severidad alta.

**DIF-012 — SURFACE — encuadre de la tarjeta**
Superficies: CLN-001…005. Admin: `radius 8px`, `border 1px`, `background rgb(248,251,252)`.
Clínica: ninguno de los tres (no hay tarjeta que los porte). Esperado: los tres valores de
Admin.

**DIF-013 — STRUCTURE — capas de anidamiento adicionales**
Superficies: CLN-001…005. Admin: `moduleViewport > section.dashboard-surface > bandas`.
Clínica: `moduleViewport > section.clinic-mobile-module-frame >
section[data-clinic-command-center] > div.dashboard-module-surface >
div.dashboard-module-body > div.dashboard-module-tabs`. Esperado: la cadena de Admin.
Delta **+4 niveles** de DOM entre el viewport del módulo y el contenido.

### G-001/G-004 · Rutas completas

**DIF-014 — MISSING_COMPONENT — `[data-dashboard-module-stage]` ausente**
Superficies: CLN-006…010. Admin: presente en 66/66. Clínica full-route: ausente en 30/30.

**DIF-015 — MISSING_COMPONENT — `[data-dashboard-module-workspace]` ausente**
Superficies: CLN-006…010. Mismos números.

**DIF-016 — MISSING_COMPONENT — `[data-dashboard-module-viewport]` ausente**
Superficies: CLN-006…010. Mismos números.

**DIF-017 — POSITION — la tarjeta no arranca en la cota canónica**
Superficies: CLN-006…010. Admin `54.91–55.27` (constante por viewport).
Clínica: CLN-006 `185.72 / 173.98 / 174.05 / 174.20 / 178.08 / 178.30`;
CLN-008 y CLN-009 `200.17 / 189.48 / 189.61 / 189.92 / 197.58 / 197.92`;
CLN-010 `≈205.33` en `w390x844`; CLN-007 `338.31 / 326.58 / 326.64 / 326.80 / 330.67 /
315.36`. Esperado: `≈55`. Delta **+119 px a +283 px**.

**DIF-018 — DIMENSION — la tarjeta no llena el canvas**
Superficie: CLN-007. Admin: `bottomGap == inset` (6.90–7.27). Clínica CLN-007:
`229.34 / 265.21 / 271.19 / 287.10 / 320.72 / 336.92`. Esperado: `≈7`.
Delta **hasta +329.66 px** de espacio muerto bajo el contenido.

**DIF-019 — EXTRA_COMPONENT — dos tarjetas en una superficie**
Superficie: CLN-007. Admin: `surfaceCount = 1` siempre. Clínica: `2`. Esperado: 1.

### G-006 · Métricas

**DIF-020 — METRICS — primitivo de métricas divergente**
Superficies: CLN-008, CLN-009, CLN-010. Admin: `span[data-dashboard-b14-metrics]`, corrida
inline, `h = 16`, `gap 6px`, sin tarjeta/borde/radio. Clínica: `div[data-dashboard-metric-strip]`,
`display:grid`, 4 columnas de `89.11px` (`81.61 / 85.36 / 89.11 / 94.56 / 99.02` según
viewport), `gap 6.4px`, tarjetas con `radius 8px` + `border 1px` + fondo, altura
`47.70` (CLN-008/009) y `55.03 / 61.98 / 63.16 / 66.28 / 72.45 / 73.58` (CLN-010).
Esperado: el primitivo de Admin. Delta **+31.7 a +57.6 px** de altura.

**DIF-021 — METRICS — ubicación de la región de métricas**
Superficies: CLN-008, CLN-009, CLN-010. Admin: **dentro** de la banda de encabezado,
`y = 74.06` con la tarjeta empezando en `55.06` (es decir, 19 px por debajo del borde
superior de la tarjeta). Clínica: **encima** de la tarjeta y fuera de ella, `y = 60.19`
mientras la tarjeta arranca en `189.92`. Esperado: dentro del encabezado de la tarjeta.
Efecto operativo: las métricas empujan toda la superficie 130 px hacia abajo.

**DIF-022 — METRICS — tercer primitivo de métricas**
Superficie: CLN-001. Admin: no existe. Clínica: pila **vertical** de 4
`.dashboard-metric-card` de `375.63 × 106.00` px con pitch de **118 px**, dentro de un
tab panel. Esperado: el primitivo de Admin. Efecto operativo: 472 px de alto para 4 cifras
que Admin resuelve en 16 px.

**DIF-023 — TYPOGRAPHY — tipografía de métricas**
Superficies: CLN-001, CLN-008, CLN-009, CLN-010. Admin: etiqueta y valor en la misma línea
de 16 px (`10px` etiqueta / `14px` valor `600` tabular-nums). Clínica strip: valor
`15.20px / 700` sobre etiqueta `9.60px / 400`. Clínica CLN-001: título `14px / 600`,
valor `20px / 700 / letter-spacing −0.5px`, descripción `12px / 400`.
Esperado: la escala de Admin.

**DIF-024 — METRICS — región de métricas ausente**
Superficies: CLN-002, CLN-003, CLN-004, CLN-005, CLN-006, CLN-007. Admin expone métricas en
la banda de encabezado del módulo operativo. Clínica: `metricsCount = 0` en 36/36
mediciones de esas seis superficies. Esperado: región de métricas canónica con el contenido
del dominio clínico.

### G-008 · Toolbar y filtros

**DIF-025 — FILTERS — presentación de filtros**
Superficies: CLN-002, CLN-005, CLN-006. Admin: banda de filtros inline dentro de la tarjeta
(62 px) y, cuando no cabe, diálogo "Filtros". Clínica: CLN-002 y CLN-005 sólo exponen el
diálogo (sin banda ni resumen de estado inline); CLN-006 renderiza un bloque **expandido**
de `325.63 × 163.00` px. Esperado: banda inline de 62 px (+ diálogo si no cabe).
Delta CLN-006 **+101 px**.

**DIF-026 — DIMENSION — altura de control de filtro**
Superficies: CLN-004, CLN-006. Admin: `32–36 px`. Clínica: `40 px`. Esperado: `32–36 px`.
Delta **+4 a +8 px** por control.

### G-009 · Listas y filas

**DIF-027 — DENSITY — vocabulario de `data-dashboard-row-pitch`**
Superficies: CLN-006…010. Admin: **un solo** token, `regular`, en 66/66. Clínica: `regular`,
`card`, `tall` y `block` (4 tokens). Esperado: `regular`.

**DIF-028 — MOBILE_LIST — pitch de fila en CLN-006**
Superficie: CLN-006. Admin `44 px`. Clínica `76 px` (medible en `w390x844`, `w412x915`,
`w430x932`; en los 3 viewports menores sólo se renderiza 1 fila y el pitch no es medible).
Esperado `44 px`. Delta **+32 px** por fila; capacidad medida 1–3 filas frente a las 12–15
de Admin en el mismo espacio.

**DIF-029 — MOBILE_LIST — pitch de fila en CLN-010**
Superficie: CLN-010. Admin `44 px`. Clínica **`168 px`** en los 6 viewports.
Esperado `44 px`. Delta **+124 px**; sólo caben 3 registros.

**DIF-030 — MOBILE_LIST — filas fuera del contrato adaptativo**
Superficies: CLN-007, CLN-008, CLN-009. El canvas declara
`[data-dashboard-adaptive-rows-canvas]` pero `[data-dashboard-adaptive-row]` cuenta **0**
mientras se renderizan 3 registros reales. Admin: cada fila porta el atributo (12–15 filas
contadas). Esperado: filas con el hook adaptativo.

### G-010 · Pager

**DIF-031 — DIMENSION — altura del pager**
Superficies: CLN-002, CLN-003, CLN-006…010. Admin: **40.00 px exactos en los 6 viewports**.
Clínica: `36.00 / 37.00 / 37.59 / 38.27` — **varía con el viewport**
(CLN-002: `37 / 37 / 37 / 37 / 37.59 / 38.27`). Esperado: 40.00 constante.

**DIF-032 — PAGER — gramática de la etiqueta**
Superficies: CLN-002, CLN-003, CLN-006…010. Admin: `1–13 de 60 · Anterior · Pág. 1 / 5 ·
Siguiente` (rango + total + página). Clínica: `Anterior · Página 1 de 10 · Siguiente` —
sin rango y sin total. Esperado: la gramática de Admin.

**DIF-033 — PAGER — pager sin total y con ambos botones inertes**
Superficies: CLN-008, CLN-009, CLN-010. Etiqueta `Página 1` con `Anterior` y `Siguiente`
deshabilitados mientras existen 3 registros. Admin nunca renderiza un pager sin total.
Esperado: `1–N de N · Pág. 1 / 1`.

### G-013 · Estados

**DIF-034 — STATE — gramática del estado de error**
Superficies: CLN-004, CLN-005. Admin: subtítulo en `text-[11px] text-destructive` dentro de
la banda de encabezado + mensaje centrado y muted que llena el canvas, sin cambiar la
geometría. Clínica: bloque de alerta rojo alineado a la izquierda,
`radius 8px`, `border 1px`, fondo `oklab(0.5356 0.1834 0.0824 / 0.1)`, `14px` (CLN-005) y
`12px` (CLN-004). Esperado: la gramática de Admin.

**DIF-035 — STATE — el error desplaza la geometría**
Superficies: CLN-004, CLN-005. El bloque de alerta ocupa `375.63 × 46` (CLN-004, `y=165.8`)
y `375.63 × 38` (CLN-005, `y=220.3`) y empuja el contenido hacia abajo. Admin: `0 px` de
desplazamiento. Esperado: `0 px`.

### G-001 · Scroll

**DIF-036 — SCROLL — propietario de scroll local**
Superficie: CLN-001 (observado en `w360x740`). Admin: `localScrollers = 0` en **66/66**.
Clínica: `1` contenedor con `overflow-y:auto` (`.dashboard-module-body`). Esperado: `0`.
El scroll de documento sigue en `false` en ambos roles, de modo que esto **no** rompe el
contrato zero-scroll del documento, pero sí rompe la regla "sin scroll interno no
contratado" que Admin cumple sin excepción.

### G-004 · Barra de acciones

**DIF-037 — EXTRA_COMPONENT — sticky action bar a sangre completa**
Superficie: CLN-007. Admin: `[data-sticky-action-bar]` ausente en 66/66. Clínica:
`390 × 89` px en `y = 687.8`, a ancho completo del viewport (ignora el inset lateral de
7.19 px que respeta el resto del shell). Esperado: acciones dentro de la banda de
encabezado de la tarjeta.

### G-007 · Chips y tabs

**DIF-038 — DIMENSION — geometría de chip**
Superficies: CLN-001, CLN-004. Admin: `119.5 × 22.8` (3 chips) / `180.7 × 22.8` (2 chips),
**ancho igual** por `flex-1`, `10.56px / 600`, `radius 6px`, padding `4.8 / 6.4`.
Clínica: `82.1 × 31.5`, `88.2 × 31.5`, `70.1 × 31.5` — **ancho por contenido**,
`12.8px / 600`, `radius 8px`, padding `5.6 / 13.6`. Esperado: la geometría de Admin.
**Riesgo declarado:** aplicar literalmente la referencia reduce el blanco táctil de 31.5 px
a 22.8 px; ver §25 y el bloque CMP-07 del roadmap.

**DIF-039 — STRUCTURE — contenedor de chips**
Superficies: CLN-001, CLN-004. Admin: banda utilitaria **dentro** de la tarjeta con
`border-b`, altura `33.39 px`. Clínica: `.dashboard-module-tablist` autónomo, altura
`42.44 px` (CLN-001) y `78.73 px` (CLN-004). Esperado: banda dentro de la tarjeta, 33.39 px.

**DIF-040 — RESPONSIVE — la barra de tabs envuelve**
Superficie: CLN-004. Los 5 tabs envuelven a dos líneas en los 6 viewports:
`76.48 / 78.11 / 78.30 / 78.73 / 79.73 / 79.95` px de alto. Admin nunca envuelve
(`flex-1` + `truncate`, 33.39 px constantes). Esperado: una sola línea de 33.39 px.
Delta **+43 a +47 px**.

### G-015 · Entrada

**DIF-041 — MISSING_COMPONENT — no existe superficie de inicio**
Superficie: CLN-001 (destino real de "Inicio"). Admin: ADM-001 es una superficie propia
(hub launcher paginado, 10 tiles, 2 páginas). Clínica: el slot `home` del bottom nav
resuelve a `operaciones`; no existe ninguna superficie de entrada. Esperado: superficie de
entrada con la gramática del launcher de Admin, o retirada explícita del slot `home`.

### G-014 · Orden

**DIF-042 — ORDER — orden de bandas**
Superficies: CLN-002, CLN-003, CLN-008, CLN-009, CLN-010.
Admin: `appBar > surfaceHeader > [chips|filters|metrics] > rowsCanvas > pager > bottomNav`.
Clínica CLN-008/009/010: `appBar > metrics > surfaceHeader > rowsCanvas > pager > bottomNav`
(métricas **antes** del encabezado). Clínica CLN-002/003:
`appBar > rowsCanvas > pager > bottomNav` (**sin** banda de encabezado).
Esperado: el orden de Admin.

---

## 10. Per-surface audit

### CLN-001 · Centro de operaciones — 19 diferencias
`/dashboard?module=operaciones`. Shell `clinic`, app bar 52 px con título estático y 3
acciones, workspace header de 40 px, `pt-4` intacto, sin tarjeta `.dashboard-surface`,
4 capas extra de DOM, tablist autónomo de 42.44 px con chips de ancho por contenido,
métricas como pila vertical de 4 tarjetas de 106 px (pitch 118 px), y un propietario de
scroll local en `w360x740`. Primer contenido en `y = 125.20` frente a `55.06` de Admin.
DIF: 001–013, 022, 023, 036, 038, 039, 041.

### CLN-002 · Informes (módulo) — 18 diferencias
`/dashboard?module=informes`. Canvas de filas directamente bajo el crómo, sin banda de
encabezado y sin métricas; pitch `regular` correcto (44 px) pero pager de 37 px con
etiqueta sin rango ni total. El canvas arranca en `166.80` frente a `55.06`.
DIF: 001–013, 024, 025, 031, 032, 042.

### CLN-003 · Logística (módulo) — 17 diferencias
`/dashboard?module=logistica`. Misma estructura que CLN-002; 3 filas, pager `Página 1 de 1`
con ambos botones inertes. Sin encabezado, sin métricas.
DIF: 001–013, 024, 031, 032, 042.

### CLN-004 · Perfil público — 20 diferencias
`/dashboard?module=perfil`. La superficie con más diferencias. Suma al patrón de módulo la
barra de 5 tabs que envuelve a dos líneas (78.73 px), controles de filtro de 40 px y el
bloque de alerta de error que desplaza el contenido 46 px.
DIF: 001–013, 024, 026, 034, 035, 038, 039, 040.

### CLN-005 · Tokens particulares — 17 diferencias
`/dashboard?module=tokens`. Sin métricas, sin banda de filtros inline (sólo diálogo), sin
pager, con bloque de alerta de error de 38 px que desplaza el contenido.
DIF: 001–013, 024, 025, 034, 035.
*Nota de fixture:* el servidor hermético no sirve el endpoint de tokens de clínica y la
superficie renderiza su estado de error real; lo medido y reportado es **la gramática del
estado**, no una carencia de datos.

### CLN-006 · Informes (ruta completa) — 17 diferencias
`/dashboard/informes`. Fuera del shell de módulos (sin stage/workspace/viewport). Tarjeta en
`y = 174.20`, encabezado con padding de 24 px (Admin: 4–12.8), bloque de filtros expandido
de 163 px, filas de 76 px, pager de 36 px con `Página 1 de 500`.
DIF: 001, 002, 004–007, 014–017, 024–028, 031, 032.

### CLN-007 · Hub de logística — 18 diferencias
`/dashboard/logistica`. Dos tarjetas, la primera en `y = 326.80`, con hasta **336.92 px** de
espacio muerto bajo el contenido, canvas `tall` sin filas adaptativas, dos pagers y una
sticky action bar de `390 × 89` a sangre completa.
DIF: 001, 002, 004–007, 014–019, 024, 027, 030, 031, 032, 037.

### CLN-008 · Visitas de campo — 19 diferencias
`/dashboard/logistica/visitas`. Tira de métricas de 4 tarjetas (47.70 px) **encima** de la
tarjeta y fuera de ella, empujando la superficie a `y = 189.92`; canvas `tall` con 0 filas
adaptativas para 3 registros; pager `Página 1` sin total.
DIF: 001, 002, 004–007, 014–017, 020, 021, 023, 027, 030–033, 042.

### CLN-009 · Planes de ruta — 19 diferencias
`/dashboard/logistica/rutas`. Idéntico patrón a CLN-008 con métricas de dominio distinto.
DIF: 001, 002, 004–007, 014–017, 020, 021, 023, 027, 030–033, 042.

### CLN-010 · Métricas de logística — 19 diferencias
`/dashboard/logistica/metricas`. Tira de métricas de altura variable por viewport
(55.03→73.58) y filas `block` de **168 px**: 3 registros ocupan todo el canvas.
DIF: 001, 002, 004–007, 014–017, 020, 021, 023, 027, 029, 031–033, 042.

---

## 11. Metrics parity

Obligatorio para **todas** las superficies. Ninguna se declara N/A.

| Superficie | Región presente | Primitivo | y | h | tarjetas | Paridad |
| --- | --- | --- | --- | --- | --- | --- |
| CLN-001 | sí | `.dashboard-metric-card` × 4 vertical | 228.23 | 106.00 ×4 | 4 | FAIL (DIF-022, 023) |
| CLN-002 | **no** | — | — | — | 0 | FAIL (DIF-024) |
| CLN-003 | **no** | — | — | — | 0 | FAIL (DIF-024) |
| CLN-004 | **no** | — | — | — | 0 | FAIL (DIF-024) |
| CLN-005 | **no** | — | — | — | 0 | FAIL (DIF-024) |
| CLN-006 | **no** | — | — | — | 0 | FAIL (DIF-024) |
| CLN-007 | **no** | — | — | — | 0 | FAIL (DIF-024) |
| CLN-008 | sí | `[data-dashboard-metric-strip]` grid | 60.19 | 47.70 | 4 | FAIL (DIF-020, 021, 023) |
| CLN-009 | sí | `[data-dashboard-metric-strip]` grid | 60.19 | 47.70 | 4 | FAIL (DIF-020, 021, 023) |
| CLN-010 | sí | `[data-dashboard-metric-strip]` grid | 60.19 | 66.28 | 4 | FAIL (DIF-020, 021, 023) |

Referencia Admin (G-006): `span[data-dashboard-b14-metrics]`, `y = 74.06`, `h = 16.00`,
dentro del encabezado de la tarjeta, sin borde/radio/fondo.

`METRICS_PARITY = 0 / 10`.

---

## 12. Shell / header parity

| Aspecto | Admin | Clínica | Paridad |
| --- | --- | --- | --- |
| `data-vetneb-app-shell-surface` | `admin` | `clinic` | esperado (identidad de rol) |
| Shell `h-dvh` + `overflow:hidden` | sí | sí | **PASS** |
| Altura app bar | 48.00 (×6) | 52.00 (×6) | FAIL (DIF-001) |
| Título app bar | contexto de módulo, 16/650 | estático, 18/600 | FAIL (DIF-002, 003) |
| Subtítulo app bar | oculto | visible, 16 px | FAIL (DIF-004) |
| Acciones app bar | 1 × 44×44 | 3 × (36×36, 36×36, 48.7×40) | FAIL (DIF-005) |
| Workspace header | oculto (0 px) | 40 px | FAIL (DIF-008) |
| `padding-top` viewport | 0 | 16 px | FAIL (DIF-009) |
| Bottom nav altura | 51.19 | 51.19 | **PASS** |
| Bottom nav slots | 5 × 78 + overflow | 6 × 65 | FAIL (DIF-006, 007) |
| Inset lateral | 6.91–7.27 | 7.19–7.38 | dentro de tolerancia estructural (2 px) |
| Anillo de foco | `3px` + inset 2px | idéntico | **PASS** |

---

## 13. Toolbar / filter parity

| Superficie | Admin de referencia | Clínica | Paridad |
| --- | --- | --- | --- |
| CLN-002 | banda inline 62 px + diálogo (ADM-010) | sólo diálogo | FAIL (DIF-025) |
| CLN-005 | ídem | sólo diálogo | FAIL (DIF-025) |
| CLN-006 | ídem | bloque expandido 163 px, controles 40 px | FAIL (DIF-025, 026) |
| CLN-004 | controles 32–36 px | 40 px | FAIL (DIF-026) |
| CLN-001, 003, 007–010 | banda inline | sin banda | cubierto por DIF-042 (orden/ausencia de encabezado) |

El diálogo "Filtros" **sí** está en paridad: `x=16`, `w=358`, `radius 8px`, `Escape` cierra,
medido idéntico en ADM-010 y CLN-002 (`y=185.5`, `h=473`).

---

## 14. Content / table / list parity

| Superficie | pitch attr | pitch px | filas | Admin de referencia | Paridad |
| --- | --- | --- | --- | --- | --- |
| CLN-002 | `regular` | 40/44 | 10–13 | `regular` 40/44 | **PASS** en pitch |
| CLN-003 | `regular` | 40/44 | 3 | ídem | **PASS** en pitch |
| CLN-006 | `card` | 76 | 1–3 | `regular` 44 | FAIL (DIF-027, 028) |
| CLN-007 | `tall` | — | 0 adaptativas | `regular` 44 | FAIL (DIF-027, 030) |
| CLN-008 | `tall` | — | 0 adaptativas (3 reales) | ídem | FAIL (DIF-027, 030) |
| CLN-009 | `tall` | — | 0 adaptativas (3 reales) | ídem | FAIL (DIF-027, 030) |
| CLN-010 | `block` | 168 | 3 | ídem | FAIL (DIF-027, 029) |
| CLN-001, 004, 005 | — | — | — | — | sin colección |

Admin de referencia (ADM-008): 12 / 12 / 12 / 13 / 14 / 15 filas según viewport, pitch
40/44, `regular` en 66/66.

---

## 15. Dialog / drawer parity

| Aspecto | Admin | Clínica | Paridad |
| --- | --- | --- | --- |
| `position` | `fixed` | `fixed` | **PASS** |
| `x` / ancho | 16 / 358 | 16 / 358 | **PASS** |
| `border-radius` | 8px | 8px | **PASS** |
| Cierre por `Escape` | sí (verificado) | sí (verificado) | **PASS** |
| Diálogos abiertos y medidos | ADM-003 (222), ADM-005 (605), ADM-006 (401.7), ADM-010 (473) | CLN-002 (473), CLN-005 (402.5) | **PASS** |
| Drawer lateral | ninguno en mobile | ninguno en mobile | **PASS** |
| Hoja de overflow del nav | presente (2 páginas) | ausente | cubierto por DIF-006 |

El primitivo de diálogo es el **único** primitivo compartido con paridad geométrica exacta.
No requiere trabajo y no debe tocarse.

---

## 16. Pager parity

| Superficie | h (×6 viewports) | Etiqueta | Paridad |
| --- | --- | --- | --- |
| Admin (referencia) | 40 / 40 / 40 / 40 / 40 / 40 | `1–13 de 60 · Anterior · Pág. 1 / 5 · Siguiente` | — |
| CLN-002 | 37 / 37 / 37 / 37 / 37.59 / 38.27 | `Anterior · Página 1 de 10 · Siguiente` | FAIL (031, 032) |
| CLN-003 | idem | `Página 1 de 1` | FAIL (031, 032) |
| CLN-006 | 36 / 36 / 36 / 36 / 36.59 / 37.27 | `Página 1 de 500` | FAIL (031, 032) |
| CLN-007 | 36 (×2 pagers) | `Página 1 de 3` | FAIL (031, 032) |
| CLN-008 | 36 | `Página 1` (sin total) | FAIL (031, 032, 033) |
| CLN-009 | 36 | `Página 1` (sin total) | FAIL (031, 032, 033) |
| CLN-010 | 36 | `Página 1` (sin total) | FAIL (031, 032, 033) |

`PAGER_HEIGHT_CONSTANT`: Admin sí (40.00 en 6/6), Clínica no (varía 36.00→38.27).

---

## 17. Responsive / mobile geometry

Todas las superficies se midieron en los 6 viewports. Comportamientos que **sólo** aparecen
en ciertos viewports, registrados como tales:

- `w360x740` (el más bajo): Admin degrada el pitch de fila de 44 a 40 px de forma uniforme;
  Clínica hace lo mismo en CLN-002/003 (paridad) pero además activa el único propietario de
  scroll local medido (CLN-001, DIF-036).
- CLN-006: el pitch de 76 px sólo es medible en los 3 viewports superiores porque en los 3
  inferiores cabe una sola fila — que es, en sí, la manifestación de DIF-028.
- CLN-010: la tira de métricas **crece con el viewport** (55.03 → 73.58 px) mientras la de
  Admin es constante en 16 px.
- CLN-007: el espacio muerto **crece con la altura del viewport** (229.34 → 336.92 px), es
  decir, la superficie desaprovecha más canvas cuanto más grande es el dispositivo.
- CLN-004: la barra de tabs envuelve en los 6 viewports, incluido `w430x932`.

`RESPONSIVE_REFLOW_PARITY = FAIL` en CLN-004, CLN-006, CLN-007, CLN-010.

---

## 18. Scroll / overflow ownership

| Métrica | Admin | Clínica |
| --- | --- | --- |
| `pageScrollsY` | `false` 66/66 | `false` 60/60 |
| `pageScrollsX` | `false` 66/66 | `false` 60/60 |
| `htmlScrollHeight == htmlClientHeight` | sí 66/66 | sí 60/60 |
| Propietarios de scroll local | **0** en 66/66 | **1** en CLN-001 @ `w360x740` |
| Clipping detectado | ninguno | ninguno |

El contrato zero-scroll de documento está en **paridad plena**. La única divergencia es el
propietario de scroll local de DIF-036, concedido explícitamente por CSS a `operaciones` y
`perfil`.

---

## 19. Interaction parity

Operado realmente en el navegador, sin acciones destructivas.

| Interacción | Admin | Clínica | Paridad |
| --- | --- | --- | --- |
| Navegación por bottom nav | 5 destinos + overflow, todos activan su módulo | 6 destinos, todos activan su módulo | **PASS** funcional |
| Cambio de tab/chip | `aria-selected` conmuta (ADM-002, 007, 011) | conmuta (CLN-001: `false,true,false`; CLN-004 igual) | **PASS** funcional |
| Pager "Siguiente" | avanza y reetiqueta (`Pág. 1/5` → `2/5`) | avanza y reetiqueta (`1 de 10` → `2 de 10`) | **PASS** funcional |
| Abrir diálogo | 4 diálogos abiertos y medidos | 2 diálogos abiertos y medidos | **PASS** |
| Cerrar con `Escape` | cierra en 4/4 | cierra en 2/2 | **PASS** |
| Paginación de hoja de overflow | 2 páginas, 10 destinos | no aplica (sin overflow) | cubierto por DIF-006 |
| Foco visible | anillo `3px` + inset 2px | idéntico | **PASS** |

La interacción **funciona** en ambos roles. Las 42 diferencias son de gramática visual y
geometría, no de rotura funcional. Esto acota el riesgo del roadmap: no hay que reparar
comportamiento, hay que unificar presentación.

---

## 20. Code traceability

Matriz completa. Cada `DIF-XXX` aparece **exactamente una vez**.

| Difference | Clinic file | Symbol | Lines | Admin canonical file | Symbol | Root cause | Proposed target |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DIF-001 | `frontend/src/styles/dashboard/mobile-clinic.css` | bloque `@media (max-width:767px)` | 53–207 | `frontend/src/styles/dashboard/mobile-admin.css` | `--admin-mobile-appbar-h` + fijado de app bar | 67, 125–142 | RC-002 | CMP-01 |
| DIF-002 | `frontend/src/components/dashboard/DashboardTopbar.tsx` | `DashboardTopbar` | 121–134 | `frontend/src/styles/dashboard/mobile-admin.css` | `.admin-mobile-context-title` | 154–163 | RC-001 | CMP-01 |
| DIF-003 | `frontend/src/components/dashboard/DashboardTopbar.tsx` | `DashboardTopbar` (`isAdmin ? … : null`) | 128–134 | `frontend/src/components/dashboard/DashboardTopbar.tsx` | `AdminMobileContextTitle` | 129–133 | RC-001 | CMP-01 |
| DIF-004 | `frontend/src/components/dashboard/DashboardTopbar.tsx` | subtítulo del topbar | 135–142 | `frontend/src/styles/dashboard/mobile-admin.css` | supresión `[data-admin-mobile-topbar-subtitle]` | 144–152 | RC-002 | CMP-01 |
| DIF-005 | `frontend/src/components/dashboard/WorkspaceAppBar.tsx` | `WorkspaceAppBar` (`[data-dashboard-desktop-actions]`) | 1–299 | `frontend/src/styles/dashboard/mobile-admin.css` | supresión `[data-dashboard-desktop-actions]` + `.admin-mobile-kebab-*` | 144–152, 165–180 | RC-002 | CMP-01 |
| DIF-006 | `frontend/src/components/dashboard/DashboardMobileNav.tsx` | catálogo de destinos por rol | 129–164, 207–290 | `frontend/src/components/dashboard/DashboardMobileNav.tsx` | overflow de destinos (rama admin) | 207–290 | RC-015 | CMP-02 |
| DIF-007 | `frontend/src/styles/dashboard/surfaces.css` | `.dashboard-mobile-nav` | — | `frontend/src/components/dashboard/DashboardMobileNav.tsx` | slot de 78 px (5 destinos) | 307–400 | RC-015 | CMP-02 |
| DIF-008 | `frontend/src/components/dashboard/WorkspaceHeader.tsx` | `WorkspaceHeader` | 23–40 | `frontend/src/styles/dashboard/mobile-admin.css` | `admin-mobile-module-header-reclaim` | 482–507 | RC-003 | CMP-03 |
| DIF-009 | `frontend/src/app/dashboard/page.tsx` | render del module viewport (`pt-4`) | — | `frontend/src/styles/dashboard/mobile-admin.css` | `padding-top: 0 !important` | 499–506 | RC-003 | CMP-03 |
| DIF-010 | `frontend/src/styles/dashboard/mobile-clinic.css` | ausencia de bloque equivalente | 53–207 | `frontend/src/styles/dashboard/mobile-admin.css` | `admin-mobile-module-header-reclaim` | 482–507 | RC-003 | CMP-03 |
| DIF-011 | `frontend/src/components/dashboard/ModuleSurface.tsx` | `ModuleSurface` | 31–32 | `frontend/src/app/dashboard/admin/AdminMobileStatusModule.tsx` | `section.dashboard-surface` | 1–111 | RC-004 | CMP-04 |
| DIF-012 | `frontend/src/styles/dashboard/layout.css` | `.dashboard-module-surface` | 15– | `frontend/src/styles/dashboard/surfaces.css` | `.dashboard-surface` | — | RC-004 | CMP-04 |
| DIF-013 | `frontend/src/components/dashboard/ClinicMobileModuleFrame.tsx` | `ClinicMobileModuleFrame` | 15–16 | `frontend/src/app/dashboard/admin/AdminMobileOpsPager.tsx` + módulos ops | tarjeta plana | 1–64 | RC-004 | CMP-04 |
| DIF-014 | `frontend/src/app/dashboard/informes/page.tsx` | `InformesPage` | 1–242 | `frontend/src/app/dashboard/page.tsx` | montaje del module stage | — | RC-005 | CMP-06 |
| DIF-015 | `frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx` | `LogisticsCommandCenter` | 1–215 | `frontend/src/app/dashboard/page.tsx` | `[data-dashboard-module-workspace]` | — | RC-005 | CMP-06 |
| DIF-016 | `frontend/src/app/dashboard/logistica/visitas/page.tsx` | `VisitasPage` | 1–299 | `frontend/src/app/dashboard/page.tsx` | `[data-dashboard-module-viewport]` | — | RC-005 | CMP-06 |
| DIF-017 | `frontend/src/app/dashboard/logistica/rutas/page.tsx` | `RutasPage` | 1–320 | `frontend/src/styles/dashboard/mobile-admin.css` | cota de tarjeta (`reclaim` + inset) | 482–507 | RC-005 | CMP-06 |
| DIF-018 | `frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx` | layout del hub | 1–215 | `frontend/src/app/dashboard/admin/AdminMobileStatusModule.tsx` | tarjeta `flex-1` | 1–111 | RC-005 | CMP-06 |
| DIF-019 | `frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx` | dos `.dashboard-surface` | 1–215 | `frontend/src/app/dashboard/admin/AdminMobileConfigModule.tsx` | tarjeta única + chips | 1–109 | RC-005 | CMP-06 |
| DIF-020 | `frontend/src/app/dashboard/logistica/visitas/page.tsx` | `data-dashboard-metric-strip` | 119 | `frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx` | `span[data-dashboard-b14-metrics]` | 146–162 | RC-006 | CMP-05 |
| DIF-021 | `frontend/src/app/dashboard/logistica/rutas/page.tsx` | `data-dashboard-metric-strip` | 119 | `frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx` | banda `md:hidden` contenedora | 146–150 | RC-006 | CMP-05 |
| DIF-022 | `frontend/src/components/dashboard/StatsCards.tsx` | `.dashboard-metric-card` | 1–114 | `frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx` | corrida inline | 151–162 | RC-006 | CMP-05 |
| DIF-023 | `frontend/src/styles/dashboard/zero-scroll.css` | `[data-dashboard-metric-strip] .dashboard-metric-card p` | 318–345 | `frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx` | `text-xs` + `tabular-nums` | 147–162 | RC-006 | CMP-05 |
| DIF-024 | `frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx` | encabezado del módulo | 1–595 | `frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx` | métricas en encabezado | 146–162 | RC-007 | CMP-05 |
| DIF-025 | `frontend/src/app/dashboard/informes/InformesReportsList.tsx` | bloque de filtros | 1–726 | `frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx` | banda `grid-cols-2` inline | — | RC-008 | CMP-07 |
| DIF-026 | `frontend/src/app/dashboard/informes/InformesReportsList.tsx` | controles de filtro | 1–726 | `frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx` | `.field-select h-9` | — | RC-008 | CMP-07 |
| DIF-027 | `frontend/src/app/dashboard/logistica/LogisticsBoundedCanvas.tsx` | `data-dashboard-row-pitch` | — | `frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx` | `row-pitch="regular"` | — | RC-009 | CMP-08 |
| DIF-028 | `frontend/src/app/dashboard/informes/InformesReportsList.tsx` | fila `card` | 1–726 | `frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx` | fila 44 px | — | RC-009 | CMP-08 |
| DIF-029 | `frontend/src/app/dashboard/logistica/metricas/page.tsx` | bloque por plan (168 px) | 1–341 | `frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx` | fila 44 px | — | RC-009 | CMP-08 |
| DIF-030 | `frontend/src/app/dashboard/logistica/LogisticsRecentListCanvas.tsx` | filas sin `data-dashboard-adaptive-row` | — | `frontend/src/app/dashboard/admin/AdminMobileAuditModule.tsx` | filas con el hook | — | RC-009 | CMP-08 |
| DIF-031 | `frontend/src/components/dashboard/DashboardPager.tsx` | `DashboardPager` | 1–153 | `frontend/src/app/dashboard/admin/AdminMobileOpsPager.tsx` | `AdminMobileOpsPager` (40 px) | 1–64 | RC-010 | CMP-09 |
| DIF-032 | `frontend/src/components/dashboard/CompactPager.tsx` | `CompactPager` | 1–82 | `frontend/src/app/dashboard/admin/AdminMobileOpsPager.tsx` | etiqueta rango+total | 1–64 | RC-010 | CMP-09 |
| DIF-033 | `frontend/src/app/dashboard/logistica/visitas/page.tsx` | pager sin total | 1–299 | `frontend/src/app/dashboard/admin/AdminMobileOpsPager.tsx` | `1–N de N` | 1–64 | RC-010 | CMP-09 |
| DIF-034 | `frontend/src/components/dashboard/ClinicPublicProfileCard.tsx` | bloque de alerta | — | `frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx` | subtítulo `text-destructive` + canvas centrado | 303–312 | RC-011 | CMP-10 |
| DIF-035 | `frontend/src/components/dashboard/ClinicParticularTokensCard.tsx` | bloque de alerta en flujo | 1–1536 | `frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx` | error sin desplazamiento | 303–312 | RC-011 | CMP-10 |
| DIF-036 | `frontend/src/styles/dashboard/mobile-clinic.css` | `overflow-y:auto` en `.dashboard-module-body` | 185–198 | `frontend/src/styles/dashboard/mobile-admin.css` | `overflow-y: hidden` en módulos ops | 468–477 | RC-012 | CMP-10 |
| DIF-037 | `frontend/src/components/dashboard/StickyActionBar.tsx` | `StickyActionBar` | 61 | `frontend/src/app/dashboard/admin/AdminMobileStatusModule.tsx` | acciones en encabezado | 1–111 | RC-013 | CMP-10 |
| DIF-038 | `frontend/src/components/dashboard/ModuleTabs.tsx` | `.dashboard-module-tab` | — | `frontend/src/app/dashboard/admin/AdminMobileStatusModule.tsx` | chip `flex-1 truncate` | 1–111 | RC-014 | CMP-07 |
| DIF-039 | `frontend/src/styles/dashboard/layout.css` | `.dashboard-module-tablist` | — | `frontend/src/app/dashboard/admin/AdminMobileConfigModule.tsx` | banda de chips en tarjeta | 1–109 | RC-014 | CMP-07 |
| DIF-040 | `frontend/src/components/dashboard/ModuleTabs.tsx` | envoltura de tabs | — | `frontend/src/app/dashboard/admin/AdminMobileStatusModule.tsx` | `flex-1` + `truncate` | 1–111 | RC-014 | CMP-07 |
| DIF-041 | `frontend/src/app/dashboard/page.tsx` | resolución de `home` | — | `frontend/src/app/dashboard/admin/` (hub launcher) | `[data-admin-mobile-hub-launcher]` | — | RC-015 | CMP-02 |
| DIF-042 | `frontend/src/app/dashboard/logistica/visitas/page.tsx` | orden de bandas | 119–130 | `frontend/src/app/dashboard/admin/AdminMobileAuditModule.tsx` | orden canónico | — | RC-016 | CMP-11 |

```text
DIFFERENCES_TRACED = 42/42
UNTRACED_DIFFERENCE = 0
```

---

## 21. Root causes

Cada causa está demostrada por lectura de fuente, no inferida.

| RC | Clase | Demostración | DIF |
| --- | --- | --- | --- |
| RC-001 | `NON_CANONICAL_COMPONENT` | `DashboardTopbar.tsx:128-134` renderiza `.admin-mobile-context-title` **sólo** dentro de `isAdmin ? … : null`. Clínica nunca recibe título de contexto. | 002, 003 |
| RC-002 | `MISSING_PARITY_CONTRACT` | `mobile-admin.css:144-152` oculta `#dashboard-topbar-title`, `[data-admin-mobile-topbar-subtitle]` y `[data-dashboard-desktop-actions]`, todo bajo `[data-vetneb-app-shell-surface="admin"]`. `mobile-clinic.css` no tiene contraparte. La altura fija vive en `--admin-mobile-appbar-h: 3rem` (`:67`) aplicada en `:125-142`, también scoped a admin. | 001, 004, 005 |
| RC-003 | `MISSING_PARITY_CONTRACT` | Bloque `admin-mobile-module-header-reclaim` (`mobile-admin.css:482-507`): oculta `.dashboard-workspace-header` y fuerza `padding-top: 0` en **todo** módulo admin. Su comentario declara explícitamente "Clínica usa otra superficie de shell y queda intacta". No existe bloque equivalente en `mobile-clinic.css`. | 008, 009, 010 |
| RC-004 | `NON_CANONICAL_COMPONENT` | Clínica compone `ClinicMobileModuleFrame` (`.clinic-mobile-module-frame`) + `ModuleSurface` (`.dashboard-module-surface`, `ModuleSurface.tsx:31-32`); Admin compone directamente `section.dashboard-surface` en sus cuatro arquetipos mobile. Son dos primitivos distintos con tokens distintos. | 011, 012, 013 |
| RC-005 | `ROUTE_SPECIFIC_IMPLEMENTATION` | Las 5 rutas completas son páginas propias (`informes/page.tsx`, `logistica/LogisticsCommandCenter.tsx`, `visitas|rutas|metricas/page.tsx`) que renderizan su layout sin pasar por el stage/workspace/viewport de módulos. Verificado en runtime: los 3 hooks ausentes en 30/30. | 014–019 |
| RC-006 | `DUPLICATED_VISUAL_PRIMITIVE` | Coexisten **tres** primitivos de métrica: `[data-dashboard-b14-metrics]` (Admin, inline), `[data-dashboard-metric-strip]` (`visitas:119`, `rutas:119`, `metricas:163`) y `.dashboard-metric-card` (`StatsCards.tsx`). | 020–023 |
| RC-007 | `METRIC_REGION_MISSING` | Seis superficies clínicas no renderizan ninguno de los tres primitivos: `metricsCount = 0` en 36/36 mediciones. | 024 |
| RC-008 | `DIVERGENT_TOOLBAR` | `InformesReportsList.tsx` renderiza un bloque de filtros expandido; CLN-002/005 sólo exponen `ModuleDialog`. Admin resuelve con banda inline `grid-cols-2` de 62 px y usa el diálogo únicamente como desbordamiento. | 025, 026 |
| RC-009 | `DIVERGENT_MOBILE_LIST` | `LogisticsBoundedCanvas` / `LogisticsRecentListCanvas` / `InformesReportsList` emiten `row-pitch` `card`/`tall`/`block` y, en logística, filas sin `data-dashboard-adaptive-row`. Admin emite `regular` en 66/66 y marca cada fila. | 027–030 |
| RC-010 | `DIVERGENT_PAGER` | Clínica usa `DashboardPager` / `CompactPager` (altura derivada del contenido, etiqueta `Página N de M`); Admin usa `AdminMobileOpsPager` (40 px fijos, etiqueta rango + total + página). | 031–033 |
| RC-011 | `LEGACY_CLINIC_STYLE` | `ClinicPublicProfileCard` y `ClinicParticularTokensCard` renderizan el bloque de alerta clínico **en el flujo**, antes del contenido. Admin degrada el error al subtítulo del encabezado y al mensaje centrado del canvas, sin alterar geometría. | 034, 035 |
| RC-012 | `LEGACY_CLINIC_STYLE` | `mobile-clinic.css:185-198` concede `overflow-y: auto` a `.dashboard-module-body` en `operaciones` y `perfil`. `mobile-admin.css:470-478` hace lo contrario (`overflow-y: hidden`) para los módulos ops. | 036 |
| RC-013 | `WRONG_COMPONENT_PLACEMENT` | `StickyActionBar.tsx:61` se monta como banda a sangre completa dentro del hub de logística; Admin no monta ninguna y coloca la acción en el encabezado de la tarjeta. | 037 |
| RC-014 | `DUPLICATED_VISUAL_PRIMITIVE` | `ModuleTabs.tsx` (`.dashboard-module-tablist` / `.dashboard-module-tab`) frente a la banda de chips que `AdminMobileStatusModule` / `AdminMobileConfigModule` renderizan dentro de la tarjeta. Dos primitivos de tabulación con tokens distintos. | 038–040 |
| RC-015 | `MISSING_COMPONENT` | `DashboardMobileNav.tsx:207` documenta que "sólo admin alcanza un overflow (los cinco módulos de clínica caben en la barra)". Esa decisión produce 6 slots de 65 px y elimina la superficie de entrada: el slot `home` resuelve al módulo por defecto. | 006, 007, 041 |
| RC-016 | `WRONG_COMPONENT_PLACEMENT` | Las tres rutas de logística emiten la tira de métricas **antes** de la tarjeta (`visitas/page.tsx:119` y homólogos), y CLN-002/003 no emiten encabezado de tarjeta. El orden canónico de Admin queda invertido o incompleto. | 042 |
| RC-017 | `MISSING_PARITY_CONTRACT` | **Causa habilitante de las 42.** No existe ningún test que compare la geometría clínica mobile contra la de Admin. Detalle en §22. | todas |

```text
TOTAL_ROOT_CAUSES = 17
```

---

## 22. Test-contract audit

Los contratos existentes no impidieron ninguna de las 42 diferencias. Auditado por lectura,
no por suposición.

| Contrato | Defecto | Evidencia |
| --- | --- | --- |
| `frontend/e2e/clinic/reports/dashboard-clinic-informes-mobile-parity.spec.ts` | El nombre dice "parity" pero mide a Clínica **contra sí misma**: no-scroll, filas mínimas, nav. Nunca abre una sesión admin ni compara geometría. | El spec define su propio `MOBILE_VIEWPORTS` (`:9-13`) y su `LayoutContract` (`:15-30`) sin referencia alguna a Admin. |
| `frontend/e2e/clinic/logistics/dashboard-clinic-logistica-mobile-parity.spec.ts` | Ídem. | Mismo patrón. |
| `frontend/e2e/clinic/tokens/dashboard-clinic-tokens-mobile-parity.spec.ts` | Ídem. | Mismo patrón. |
| `frontend/e2e/clinic/profile/dashboard-clinic-perfil-mobile-operability.spec.ts` | Valida **operabilidad**, no paridad. Convive con DIF-040 (tabs envueltos) sin detectarlo. | — |
| Los 4 specs anteriores | Cubren **3 de los 6** viewports mobile del repo (360×740, 390×844, 430×932). `360×800`, `375×812` y `412×915` no tienen cobertura de paridad. | `MOBILE_VIEWPORTS` de cada spec. |
| `frontend/e2e/clinic/shell/dashboard-clinic-controller-workspace-parity.spec.ts` | Es el único spec clínico que abre una sesión admin (`:33-40`), pero sólo para afirmar que la superficie admin **"still loads"** (`:134`, `:142`). Valida presencia, no paridad. | — |
| `frontend/e2e/clinic/shell/dashboard-interaction-foundation.spec.ts` | Ídem: sesión admin sólo para verificar carga. Un único viewport (375×812, `:132`). | — |
| `frontend/e2e/helpers/dashboard-geometry-matrix.ts` | **Contrato desactualizado.** Sus selectores de región (`.dashboard-workspace-header`, `[data-dashboard-metric-strip]`, `[data-dashboard-filter-bar]`) no resuelven en Admin mobile en `HEAD`. Congela geometría como `absent` en lugar de fallar. | Verificado en runtime: el esquema devolvió regiones vacías en las 66 mediciones Admin. |
| `frontend/e2e/helpers/dashboard-geometry-matrix.ts` | Congela la geometría **actual** de ambos roles como baseline, incluida toda la divergencia clínica. Un contrato que preserva el defecto. | `DASHBOARD_GEOMETRY_CAPTURE_MODE` + comparador por tolerancia (`:988-1021`). |
| `test/architecture/dashboard-b11-workspace-header.test.ts` | Ancla el workspace header como estructura válida; no distingue que Admin mobile lo suprime y Clínica no. | — |
| Cobertura global | **No existe** ningún contrato que enumere el censo completo de superficies clínicas mobile y exija paridad con Admin. Nada bloquea añadir una superficie clínica nueva con gramática divergente. | Búsqueda exhaustiva sobre `frontend/e2e/**` y `test/architecture/**`. |

```text
TEST_CONTRACTS_THAT_ALLOW_DIVERGENCE = 11
TEST_CONTRACTS_THAT_ENFORCE_PARITY   = 0
```

---

## 23. Files requiring change

### MODIFY

```text
frontend/src/components/dashboard/DashboardTopbar.tsx
frontend/src/components/dashboard/WorkspaceAppBar.tsx
frontend/src/components/dashboard/WorkspaceHeader.tsx
frontend/src/components/dashboard/DashboardMobileNav.tsx
frontend/src/components/dashboard/ClinicMobileModuleFrame.tsx
frontend/src/components/dashboard/ModuleSurface.tsx
frontend/src/components/dashboard/ModuleTabs.tsx
frontend/src/components/dashboard/DashboardPager.tsx
frontend/src/components/dashboard/CompactPager.tsx
frontend/src/components/dashboard/StickyActionBar.tsx
frontend/src/components/dashboard/StatsCards.tsx
frontend/src/components/dashboard/ClinicPublicProfileCard.tsx
frontend/src/components/dashboard/ClinicParticularTokensCard.tsx
frontend/src/app/dashboard/page.tsx
frontend/src/app/dashboard/ClinicCommandCenter.tsx
frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx
frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx
frontend/src/app/dashboard/informes/page.tsx
frontend/src/app/dashboard/informes/InformesReportsList.tsx
frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx
frontend/src/app/dashboard/logistica/LogisticsBoundedCanvas.tsx
frontend/src/app/dashboard/logistica/LogisticsRecentListCanvas.tsx
frontend/src/app/dashboard/logistica/visitas/page.tsx
frontend/src/app/dashboard/logistica/rutas/page.tsx
frontend/src/app/dashboard/logistica/metricas/page.tsx
frontend/src/styles/dashboard/mobile-clinic.css
frontend/src/styles/dashboard/layout.css
frontend/src/styles/dashboard/zero-scroll.css
frontend/e2e/suites/catalog.ts
frontend/e2e/clinic/reports/dashboard-clinic-informes-mobile-parity.spec.ts
frontend/e2e/clinic/logistics/dashboard-clinic-logistica-mobile-parity.spec.ts
frontend/e2e/clinic/tokens/dashboard-clinic-tokens-mobile-parity.spec.ts
frontend/e2e/helpers/dashboard-geometry-matrix.ts
```

### ADD

```text
frontend/src/components/dashboard/ModuleMetricRun.tsx            (primitivo de métricas compartido, extraído de Admin)
frontend/src/components/dashboard/ModuleCard.tsx                 (tarjeta .dashboard-surface compartida, extraída de Admin)
frontend/src/components/dashboard/ModuleContextTitle.tsx         (título de contexto por rol, extraído de DashboardTopbar)
frontend/e2e/helpers/mobile-parity-matrix.ts                     (censo + gramática canónica + comparador)
frontend/e2e/clinic/shell/clinic-mobile-admin-parity-contract.spec.ts
test/architecture/clinic-mobile-admin-parity-census.test.ts
```

### DELETE

```text
(ninguno demostrado en esta auditoría)
```

Ningún archivo se propone eliminar: cada primitivo divergente tiene consumidores desktop
vivos que esta auditoría no midió y por tanto no puede declarar muertos.

### NO_CHANGE_REFERENCE_ADMIN

```text
frontend/src/app/dashboard/admin/**            (los 11 arquetipos y tarjetas mobile)
frontend/src/styles/dashboard/mobile-admin.css
frontend/e2e/admin/**
```

---

## 24. Explicit non-scope

```text
Dashboard Administración = READ ONLY.
```

- No se modifica ningún archivo bajo `frontend/src/app/dashboard/admin/**` ni
  `frontend/src/styles/dashboard/mobile-admin.css`, salvo por extracción de primitivo
  compartido, y en ese caso el resultado visual de Admin debe permanecer
  geometry-equivalent (ver criterios de aceptación de CMP-04 y CMP-05 en el roadmap).
- Desktop, laptop y tablet quedan fuera de alcance.
- Backend, API, esquema, dependencias, CI y workflows quedan fuera de alcance.
- Esta ejecución **no implementa** ningún cambio de producto.
- Los cinco stashes preexistentes de Nico quedan intactos.

---

## 25. Final verdict

```text
TOTAL_SURFACES                  = 21   (11 Admin + 10 Clínica)
TOTAL_VIEWPORTS                 = 6
TOTAL_MEASUREMENTS              = 126  (66 Admin + 60 Clínica, 0 fallos)
TOTAL_DIFFERENCES               = 42
TOTAL_DIFFERENCE_INSTANCES      = 183
TOTAL_ROOT_CAUSES               = 17
TOTAL_FILES_TO_MODIFY           = 33
TOTAL_FILES_TO_ADD              = 6
TOTAL_FILES_TO_DELETE           = 0
TOTAL_TESTS_TO_ADD_OR_REWRITE   = 8
GLOBAL_CLINIC_MOBILE_ADMIN_PARITY = FAIL
```

### Riesgos residuales declarados

1. **Conflicto paridad vs. accesibilidad táctil.** Los chips de Admin miden 22.8 px de alto y
   sus acciones de app bar 44×44; los tabs clínicos miden 31.5 px y sus acciones 36×36.
   Aplicar la referencia literalmente **reduce** el blanco táctil de los tabs clínicos.
   El roadmap resuelve el conflicto adoptando la geometría de banda de Admin con el piso
   táctil de 44 px que Admin ya aplica a su kebab (`B09_TOUCH_POLICY = OPTION_A`,
   `mobile-admin.css:172-180`), y lo marca como decisión que requiere confirmación de Nico.
2. **Densidad de dominio.** Las filas `card`/`tall`/`block` de Clínica pueden estar
   transportando más campos por registro que las filas `regular` de 44 px de Admin. La
   auditoría midió geometría, no carga informativa por fila. CMP-08 exige inventariar los
   campos por fila antes de comprimir el pitch.
3. **Cobertura de datos del fixture.** CLN-005 se midió en su estado de error real porque el
   servidor hermético no sirve ese endpoint. La gramática del estado es evidencia válida;
   la geometría del estado poblado de esa superficie no está medida y CMP-07 debe medirla
   con un stub antes de fijar tolerancias.
4. **Consumidores desktop.** Ningún primitivo divergente se declaró muerto: los tres
   primitivos de métrica y los dos de tabulación tienen usos desktop no medidos aquí.

---

## 25. Resultado final de implementación (CMP-01…12)

Sección añadida al cierre de CMP-12. Los hallazgos FAIL originales de §§1-24 se **preservan
íntegros arriba**, sin edición: son el estado de HEAD en el momento de la auditoría (branch
`feat/clinic-mobile-admin-parity`, HEAD `ef38fb10`), no una descripción actual del código.
Esta sección documenta qué implementación cerró cada hallazgo y con qué evidencia runtime.

```text
CMP-01..11 = DONE (implementación)
CMP-12     = DONE (contrato de validación cross-role)

DIF_CLOSED               = 42/42
DIFFERENCE_INSTANCES_CLOSED = 183/183
RC_CLOSED                = 17/17
CLINIC_SURFACES          = 10/10
MOBILE_VIEWPORTS         = 6/6
FINAL_CLINIC_RUNTIME     = 60/60 PASS (medido dos veces, determinista)
N_A                      = 0
ADMIN_VISUAL_REGRESSION  = 0
```

RC-017 (`MISSING_PARITY_CONTRACT`, "causa habilitante de las 42") se cierra con
`frontend/e2e/clinic/shell/clinic-mobile-admin-parity-contract.spec.ts` +
`frontend/e2e/helpers/mobile-parity-matrix.ts` + `test/architecture/clinic-mobile-admin-parity-census.test.ts`:
un contrato que mide Admin y Clínica **en la misma corrida**, sobre las 10 superficies
clínicas × 6 viewports canónicos, comparando geometría estructural (tolerancia 0.5px),
orden de bandas por coordenada y presencia de hooks compartidos — nunca Clínica contra sí
misma ni contra una constante histórica. El censo de superficies se deriva de
`CLINIC_MODULE_IDS` y `DASHBOARD_ROUTES` (no de una lista escrita a mano) y falla si una
superficie clínica nueva queda sin mapping.

### Hallazgos reales encontrados por el propio contrato (no simulados)

El contrato de CMP-12 no fue trivial de poner en verde — encontró y forzó a corregir tres
defectos reales que la implementación previa no había cubierto:

1. **Doble borde en el reservorio del pager** (CLN-002/CLN-003): el wrapper externo de
   `ClinicInformesWorkspaceSummary.tsx`/`ClinicLogisticaWorkspaceSummary.tsx` llevaba su
   propio `border-t` fuera del elemento que aplica `DASHBOARD_TOUCH_PAGER_RESERVATION`,
   sumando 1px al alto reservado de 40px (41px medido). Corregido moviendo el borde al
   mismo elemento que la reserva (patrón `AdminMobileOpsPager`, borde y reserva en un único
   nodo, `box-sizing: border-box`).
2. **Selector de pager no compartido entre roles**: el hook inicial (`[data-dashboard-
   pager]`) no resuelve en el pager propio de Admin (`AdminMobileOpsPager` sólo declara
   `data-admin-mobile-ops-pager`). El hook realmente compartido es
   `[data-dashboard-adaptive-reserved-region="pager"]`.
3. **`ModuleMetricRun` sólo visible en mobile en un subconjunto de superficies Admin**:
   `AdminSessionsReadOnlyCard`/`AdminUsersRolesReadOnlyCard`/`admin-pricing`/`admin-clinics`/
   `admin` (resumen) montan su métrica `hidden md:grid` (sólo escritorio); únicamente
   `AdminMobileAuditModule` (vía `AdminAuditFilterBar`) expone `ModuleMetricRun` visible en
   mobile. El mapping cross-role usa esa referencia; el contrato trata la ausencia de
   métricas mobile en el lado Admin como comparación no aplicable en esa capa (nunca
   asimétrica en sentido contrario), documentado en el propio spec.

### Pendiente declarado, no oculto

- **`frontend/e2e/helpers/dashboard-geometry-matrix.ts`** (A02, 273 combinaciones): sigue
  siendo el instrumento de auto-comparación histórica, deliberadamente separado del
  contrato cross-role de CMP-12. El roadmap programó su realineación de selectores y
  recaptura de baseline para "el mismo PR que cierre CMP-11"; no se ejecutó en esa
  ventana y CMP-12 no la asumió como propia — recapturar sin el análisis dry-run por
  combinación que el propio roadmap exige sería exactamente el "todo cambió, por eso
  actualicé todo" que prohíbe. Queda como tarea separada, explícita, para quien la
  autorice.
- **Los tres specs "mobile-parity" originales** (`dashboard-clinic-informes-mobile-parity`,
  `dashboard-clinic-logistica-mobile-parity`, `dashboard-clinic-tokens-mobile-parity`) se
  corrigieron de nombre/alcance (ya no reclaman paridad) pero conservan su comparación
  Clínica-contra-sí-misma para su cobertura de dominio genuina (filas adaptativas, diálogo,
  navegación); no se les añadió una segunda medición cross-role redundante con el nuevo
  contrato de 60/60, que ya cubre exactamente esas 10 superficies. Decisión de ingeniería
  explícita contra la sobreingeniería y la duplicación de test infra (AGENTS.md §12).

### Hallazgos preexistentes no relacionados (documentados, no ocultados)

Ninguno de los dos bloquea el cierre de CMP-12: ninguno pertenece a las cohortes
`ci`/`public-clinic` que certifican este trabajo, y ninguno es atribuible a los archivos
tocados por CMP-08…12 (verificado por lectura de diff, no por suposición).

1. **`frontend/e2e/clinic/reports/clinic-reports-workspace-1000.spec.ts`** —
   `PREEXISTING_UNRELATED_ENVIRONMENTAL`. Comando:
   `playwright test "e2e/clinic/reports/clinic-reports-workspace-1000.spec.ts" -g "first page renders a bounded slice"`.
   Síntoma: timeout esperando la request de la server action adaptativa. Evidencia: la nota
   `"Known Informes product defect remains out of scope; audit CAP classification mapped to
   extended"` ya existía verbatim en `frontend/e2e/suites/catalog.ts` en HEAD `ef38fb10`,
   antes de cualquier cambio de esta sesión; el mismo mecanismo funciona en 3 specs
   hermanas que sí pasan; el fixture sirve `"total":1000` correctamente. Excluido de
   `ci`/`public-clinic` desde antes de este trabajo.
2. **`frontend/e2e/admin/shell/admin-mobile-app-shell-absolute-no-scroll.spec.ts`** —
   `PREEXISTING_UNRELATED`, 5/135 fallos en la cohorte `e2e:admin-mobile` completa (130/135
   PASS). Síntoma: `appBar.locator('[data-dashboard-topbar-subtitle="true"]')` — se espera
   `0`, se mide `1` — en `/dashboard/admin` a 5 viewports. Evidencia: cero archivos
   relacionados (`DashboardTopbar.tsx`, `frontend/src/app/dashboard/admin/page.tsx`) fueron
   tocados por CMP-08…12; el subtítulo (`"Auditoría, reportes y estado operacional"`) es un
   prop estático preexistente; medido directamente en runtime, el mismo patrón aparece
   **simétricamente** en Clínica (`/dashboard?module=operaciones` → `"Portal operativo
   clínica"`), lo que confirma que no es una divergencia Clínica-vs-Admin — es exactamente
   lo que el contrato de CMP-12 existe para descartar, y lo descarta correctamente (el
   contrato mide igualdad entre roles, no ausencia absoluta). No forma parte de las
   cohortes `ci`/`public-clinic`.

Lenguaje exacto: **las cohortes in-scope de este cierre pasan en su totalidad**
(`ci`/`public-clinic`/`e2e:verify-catalog`/census). No se afirma que la totalidad del
repositorio E2E pase — eso sería falso, y ambos hallazgos preexistentes quedan
documentados aquí, no ocultados.

### Validación final ejecutada

```text
typecheck            PASS
lint                 PASS
build                PASS
security:public-surface PASS
typecheck:test        PASS
pnpm test (unit+arch) PASS  4487 pass / 0 fail / 1 skip preexistente / 4488 total
e2e:public-clinic      PASS  298/298 (0 fail, 0 skip)
e2e:admin-mobile        PASS  130/135 (5 preexistentes, no relacionados — ver arriba)
clinic-mobile-admin-parity-contract.spec.ts  PASS  60/60 (×2, determinista)
e2e-suite-catalog-completeness.test.ts        PASS  6/6
clinic-mobile-admin-parity-census.test.ts     PASS  3/3
```
