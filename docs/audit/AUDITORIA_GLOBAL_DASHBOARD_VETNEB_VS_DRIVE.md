# AUDITORÍA GLOBAL — DASHBOARD VETNEB vs GOOGLE DRIVE

**Tipo:** auditoría técnica, especificación de implementación y roadmap del rediseño Drive-like.
**Repositorio:** LABVETNEB/PORTAL-VETNEB
**Commit evidencia de código:** `065860c5`
**Ejecución:** 2026-08-04 03:04 → 04:10 (UTC−03:00)
**Working tree:** limpio al iniciar y al cerrar.

| Campo | Valor |
| --- | --- |
| Document owner | Dashboard / Frontend domain owner |
| Domain | Dashboard autenticado, arquitectura visual y rediseño Drive-like |
| Lifecycle status | ACTIVE |
| Authoritative source role | Única fuente de implementación del rediseño Drive-like del dashboard autenticado |
| Effective date | 2026-08-04 |
| Last verified date | 2026-08-04 |
| Review cadence | Ante cada programa completado y ante cambios estructurales del dashboard |
| Superseded by | Ninguno |
| Related controls or gaps | Programa A/B/C y hallazgos P0–P4 de este documento |
| Evidence or approval reference | PR #1635, merge commit `fa28384c3df7037b0f5263d088991abe10d5cb52` |

> **Este documento es la única fuente autorizada para planificar e implementar el rediseño Drive-like del dashboard autenticado VETNEB:** arquitectura, app shell, navegación, drawer y rail, workspace, superbuscadores, filtros, colecciones, selección, toolbars, paneles, visor, responsive, zero-scroll, contratos funcionales, geometría, Programas A/B/C, hallazgos, roadmap, pruebas, gates y aceptación final.

> **Esta auditoría no implementó ningún cambio de código, CSS, backend, base de datos, configuración ni dependencias.** No se crearon ramas, commits, pushes ni pull requests fuera del proceso normal de revisión documental.

---

## 1. Resumen ejecutivo

### 1.1 Alcance consolidado de esta auditoría

Esta auditoría cubre **todo el dashboard autenticado**: 7 rutas, 15 módulos, 89 componentes, 13 archivos CSS (149 266 bytes, 4 119 líneas) y 143 combinaciones (superficie, viewport) medidas en runtime sobre una muestra estratificada de las 21 superficies del inventario (§12, §13; metodología en §4.7). Incluye, consolidado internamente y sin dependencia de otro documento, el subsistema de 7 superbuscadores (§7).

### 1.2 Corrección metodológica incorporada

La primera medición interpretó incorrectamente el tamaño del fixture como densidad del layout: registró «**9 filas visibles frente a 15–16 de Drive**», cuando las 9 filas eran el tamaño del dataset sintético del fixture, no el límite real del layout. La medición de esta pasada lee el indicador real de paginación y el canvas medido:

| Viewport | Informes admin | Tokens admin | Usuarios | Sesiones | Drive |
|---|---:|---:|---:|---:|---:|
| 1920 × 1080 | **19** | 17 | 16 | 17 | 15 – 16 |
| 1600 / 1440 × 900 | 14 | 12 | 11 | 12 | — |
| **1366 × 768** | **10** | 9 | 9 | **8** | — |
| **1280 × 720** | **9** | 9 | 9 | **7** | — |
| 1024 × 768 | 9 | 9 | 9 | 8 | — |
| 834 × 1194 | 20 | 17 | 19 | 20 | — |
| 768 × 1024 | 15 | 12 | 15 | 15 | — |

A 1920 px VETNEB muestra **más** filas que Drive (19 vs 15–16), porque su fila mide 35.66 px frente a los 48 px de Drive. La brecha real no está en 1920: **está en 1366 × 768 y 1280 × 720**, las resoluciones de portátil corporativo, donde el chrome consume el 40–55 % del viewport y sólo caben 7–10 filas.

Corregido como hallazgo **P1-04** (§41).

### 1.3 Los seis hechos que gobiernan la transformación

**Hecho 1 — El chrome es el problema, y es peor en la resolución más común.**

| Viewport | Chrome antes de la primera fila | Drive |
|---|---:|---:|
| 1920 × 1080 | 29.9 % – 40.4 % | **19.2 %** |
| 1440 / 1600 × 900 | 35.6 % – 41.1 % | — |
| **1366 × 768** | **40.4 % – 54.7 %** | — |
| **1280 × 720** | **44.1 % – 52.5 %** | — |
| 1024 × 768 | 40.4 % – 47.6 % | — |
| Mobile (360–430) | **15.2 % – 27.2 %** | 6.8 % |

El peor caso medido es **54.7 %** (`/dashboard/logistica/rutas` y `/visitas` a 1366 × 768): más de la mitad del viewport es chrome antes del primer dato. Y el dato más revelador: **mobile está mejor que desktop**. El problema no es la densidad de VETNEB, es la arquitectura del shell de escritorio.

**Hecho 2 — El acoplamiento altura ↔ `limit` es más amplio de lo documentado.**
No hay un hook adaptativo, hay **tres**: `useAdaptiveItemsPerPage`, `useAdaptiveRowsPerPage` (envoltorio del anterior, con `minItems` por defecto 2) y `useAdaptiveDashboardPageSize` (parámetros distintos: `chromeHeightPx`, `paginationHeightPx`, `safetyBufferPx`). Los consumen **15 módulos** con 15 pares (fila, fallback, cap) distintos. Un desacoplamiento que cubra sólo uno de los tres deja la mitad del dashboard expuesta.

**Hecho 3 — Hay dos app shells para el mismo rol.**
El dashboard de clínica presenta **dos** arquitecturas: `/dashboard` usa topbar de 55.33 px + `DashboardModuleRail` de 39.39 px *dentro* de `main`; `/dashboard/informes` y `/dashboard/logistica/*` usan topbar de 92.33 px con `DashboardHorizontalNav` y **sin** rail. Mismo rol, misma sesión, dos gramáticas de navegación.

**Hecho 4 — Seis mecanismos de navegación coexisten.**
`DashboardHorizontalNav` (10 pestañas admin / 5 clínica) · `DashboardModuleRail` (pestañas + pager anterior/siguiente) · `AdminMobileBottomNav` · `ClinicMobileBottomNav` · `AdminMobileKebabMenu` · `DashboardModuleHub` + `AdminMobileHubLauncher`. Drive resuelve lo mismo con **drawer + rail + drawer mobile**.

**Hecho 5 — El dashboard es card-centric y Drive es content-first.**
Se contaron **4 capas de superficie que pintan** (fondo, borde o sombra) entre el viewport y la primera fila en los módulos admin. Drive pinta el dato directamente sobre la página: 6 sombras únicas en 22 estados, ninguna en el chrome persistente.

**Hecho 6 — La arquitectura de destino ya está andamiada y vacía.**
`features/dashboard/presentation/` existe con 7 barriles (`shell`, `navigation`, `layout`, `surfaces`, `admin`, `clinic`, más el índice) y **un solo componente real** (`DashboardStatusBadge.tsx`, 1 272 B). El destino que este documento propone no requiere inventar la estructura: requiere poblarla. Eso reduce sustancialmente el riesgo del Programa B.

### 1.4 Veredicto

El dashboard funciona, es seguro y cumple el contrato zero-scroll sin una sola excepción en las **143 combinaciones (superficie, viewport) efectivamente medidas** (§4.7; 0 px de desbordamiento horizontal y vertical). No hay que reconstruirlo: hay que **desacoplar la geometría de la paginación, unificar el shell y trasladar el presupuesto vertical del chrome al contenido**.

Se proponen **50 PR** en tres programas coordinados (Programa A: 8 · Programa B: 16 · Programa C: 26; §48–§51), ordenados del Nivel 0 al Nivel 13, más 5 correctivos separados (§55; universo máximo documentado: 55).

---

## 2. Alcance de esta auditoría

| Dimensión | Cobertura |
|---|---|
| Objeto | Todo el dashboard autenticado (admin + clínica), incluidos los 7 superbuscadores como subsistema protegido (§7) |
| Rutas | **7 rutas, 15 módulos** |
| Componentes | **89** |
| CSS | **13 archivos, 149 266 B, 4 119 líneas** |
| Mediciones | **143 combinaciones** (superficie, viewport; muestra estratificada, §4.7) + límites adaptativos reales |
| Drive usado para | app bar, búsqueda, chips, low-chrome, drawer, rail, colecciones, selección, menús, paneles, visor, mobile |
| Hallazgos | **61** (P0=4 · P1=20 · P2=20 · P3=11 · P4=6; §40–44) |
| PR del roadmap principal | **50** (Programa A: 8 · Programa B: 16 · Programa C: 26; §48–50) |
| Correctivos separados | **5** (PR-BUG-01…05; §55) |
| App header y module header | **Integrados al roadmap principal** (Programa B, Nivel 5) |

---

## 3. Materiales recibidos

| # | Material | Estado | Ubicación |
|---|---|---|---|
| 1 | `DATOS_CONSOLIDADOS_SIN_DUPLICADOS.md` | **Recibido en dos partes** | `...DESKTOP.md` (12 928 139 B, 40 978 líneas, 22 estados) y `...MOBILE.md` (1 735 358 B, 6 924 líneas, 7 estados) |
| 2 | 5 imágenes PNG | **Resueltas mediante coincidencia de dimensiones raster** | `C:\Users\Nico\Pictures\Screenshots\` — capturadas 2026-08-04 02:02–02:04 |
| 3 | `SKILL CLAUDE(1).zip` | **Recibido como `SKILL CLAUDE.zip`** | `C:\Users\Nico\Desktop\NICO\WEB\` — 10 `.skill`, cada uno un ZIP con su `SKILL.md`; los 10 leídos íntegros |

**Sobre las imágenes:** siguen siendo recortes en tema oscuro sin metadatos de viewport. Se mantiene la distinción entre dimensión raster del archivo y geometría CSS: los anchos raster (1840–1852) no coinciden con los contenedores medidos (1833.22 / 1865.22 / 1867.22), y la altura raster de 50 px de la imagen 2 corresponde a una barra que mide 60.5 px en runtime (el recorte cortó la fila de etiquetas). Su función es identificar superficies; la geometría proviene del runtime.

---

## 4. Metodología

### 4.1 Jerarquía de evidencia

1. Código actual del repositorio · 2. Runtime medido · 3. Tests existentes · 4. Imágenes · 5. Datos de Drive · 6. Inferencia marcada.
Cada afirmación se marca implícitamente por su fuente (ruta:línea para código, tabla de mediciones para runtime, código de estado para Drive).

### 4.2 Entorno de medición

Chromium vía Playwright 1.61.0 headless · Windows 11 Pro 10.0.26200 · DPR 1 · zoom 1 · tema **claro** · indicador de desarrollo de Next suprimido.

### 4.3 Backend

**Fixture API hermético del propio repositorio** (`frontend/e2e/fixtures/admin-populated-api-server.mjs`, puerto 3107) + `next dev` en 3000. **No se tocó producción, staging ni la base de datos.** Las mediciones autenticadas utilizaron sesiones sintéticas controladas para los roles administrativo y clínica dentro del fixture hermético. No se conservaron cookies, identificadores de sesión, credenciales ni valores de autenticación en los artefactos de auditoría.

### 4.4 Instrumentación

`getBoundingClientRect()` + `getComputedStyle()` sobre bandas del shell, encabezados, toolbars, filtros, canvas de filas, filas, pagers y paneles; `document.documentElement` y `document.body` para el contrato de scroll; lectura del indicador textual `N por página` para obtener el `limit` adaptativo real; recorrido del árbol para contar capas de superficie que pintan y contenedores de scroll.

### 4.5 Corrección de método aplicada

La primera pasada contó **filas renderizadas**, que están limitadas por el dataset del fixture (9 registros). Se corrigió leyendo el indicador de paginación y midiendo el canvas: el `limit` adaptativo real es 7–20 según viewport. Todas las cifras publicadas provienen de la pasada corregida. Ver §41, hallazgo P1-04.

### 4.6 Higiene del repositorio

`next dev` reescribe `frontend/next-env.d.ts` (archivo versionado). Se detectó con `git status --short` y se revirtió con `git checkout --`. Árbol verificado limpio al cierre. Capturas de evidencia guardadas **fuera del repositorio**, en el scratchpad de sesión.

### 4.7 Cobertura de la muestra

La medición no barrió los 13 viewports en las 21 superficies del inventario (§12, §13) de forma uniforme — eso habría exigido 21 × 13 = 273 mediciones, no ejecutadas — sino con una muestra estratificada de dos profundidades, verificada contra el JSON de medición original:

**Cohorte A — 8 superficies medidas en los 13 viewports completos (104 combinaciones):**
hub administrativo (`admin-hub`), Informes admin (`admin-informes`, módulo `admin-report-upload`), Clínicas (`admin-clinicas`, módulo `admin-clinics`), Usuarios y roles (`admin-usuarios`, módulo `admin-users-roles`), Auditoría (`admin-auditoria`, módulo `audit-log`), Operaciones clínica (`clinic-operaciones`, módulo `operaciones`), Informes clínica módulo (`clinic-informes`, `?module=informes`) e Informes clínica ruta completa (`clinic-informes-full`, `/dashboard/informes`).

**Cohorte B — 13 superficies medidas en 3 viewports representativos** (1920×1080, 1366×768, 390×844; 39 combinaciones):
Resumen admin (`admin-resumen`, módulo `admin`), Estado del sistema (`admin-estado`, módulo `admin-health`), Tokens admin (`admin-tokens`, módulo `admin-particular-tokens`), Precios (`admin-precios`, módulo `admin-pricing`), Sesiones (`admin-sesiones`, módulo `admin-sessions`), Mantenimiento (`admin-mantenimiento`, módulo `admin-maintenance`), Logística clínica módulo (`clinic-logistica`, `?module=logistica`), Perfil (`clinic-perfil`, módulo `perfil`), Tokens clínica (`clinic-tokens`, módulo `tokens`) y las 4 rutas completas de logística: `clinic-logistica-full` (`/dashboard/logistica`), `clinic-log-metricas` (`/dashboard/logistica/metricas`), `clinic-log-rutas` (`/dashboard/logistica/rutas`), `clinic-log-visitas` (`/dashboard/logistica/visitas`).

Total: 8 × 13 + 13 × 3 = 104 + 39 = **143 combinaciones (superficie, viewport) efectivamente medidas**, en 0 de las cuales se registró desbordamiento.

**Precisiones obligatorias sobre esta cobertura:**

- Las 143 combinaciones corresponden a **8 superficies con cobertura completa (cohorte A) más 13 con cobertura parcial de 3 viewports (cohorte B)** — no a 11 superficies homogéneas ni a ninguna otra agrupación uniforme.
- **Los «15 módulos» declarados en §1.1 y §2 no fueron medidos en los 13 viewports.** «Módulos» (15 = 10 IDs `?module=` de admin + 5 de clínica) y «superficies» (21 = 11 filas de §12 + 10 filas de §13, que además cuentan las rutas completas de clínica como entradas propias) son dos recuentos distintos; el inventario de §12/§13 usa «superficies», y es sobre esas 21 que se construyó la muestra estratificada anterior.
- **Cobertura pendiente:** las 13 superficies de la cohorte B carecen de datos en los 10 viewports restantes (1600×900, 1440×900, 1280×720, 1024×768, 834×1194, 768×1024, 430×932, 412×915, 375×812, 360×800) — 130 combinaciones no ejecutadas. Cerrarlas exige una nueva pasada de medición, no una relectura de los datos existentes.
- Toda conclusión de zero-scroll o de chrome en §1, §11, §21–§23 y §64 se limita a estas 143 combinaciones efectivamente ejecutadas; no debe leerse como cobertura de las 21 superficies en los 13 viewports.

### 4.8 Universo canónico

| Unidad | Cantidad | Definición |
|---|---:|---|
| Rutas | **7** | Rutas de Next.js distintas (§12, §13) |
| Módulos | **15** | IDs `?module=` distintos: 10 admin + 5 clínica |
| Superficies visibles | **21** | 11 filas de §12 (admin, incluye hub) + 10 filas de §13 (clínica, incluye rutas completas como entradas propias) |
| Combinaciones medidas | **143** | Muestra estratificada efectivamente ejecutada (§4.7) |
| Combinaciones pendientes | **130** | 13 superficies de la cohorte B × 10 viewports restantes (§4.7) |
| Matriz completa objetivo | **273** | 21 superficies × 13 viewports, no ejecutada |

**Regla de selección de unidad por tipo de prueba:** las pruebas visuales y de zero-scroll (§56.5, §57) deben usar las **21 superficies** cuando la diferencia de ruta o de shell produce una superficie distinta (p. ej. Informes clínica módulo vs Informes clínica ruta completa, que comparten módulo lógico pero no shell — Hecho 3, P0-04). Los contract tests funcionales (§56.2) pueden operar sobre los **15 módulos** cuando ésa sea la unidad correcta — p. ej. el contrato operativo de un módulo lógico es el mismo con independencia de por cuál shell se acceda.

---

## 5. Matriz de skills

Las 10 skills se descomprimieron y leyeron íntegras. Comparten un bloque «Protocolo VETNEB obligatorio» aplicado transversalmente: PowerShell de sólo lectura, PNPM, sin tocar producción, sin DB manual, sin migraciones, sin dependencias nuevas, sin leer ni imprimir secretos, y **sin ejecutar `git add`/`commit`/`push`/`gh pr create`/`gh pr merge`** (operaciones manuales de Nico).

| Skill | Activada | Motivo | Evidencia de aplicación | Secciones |
|---|:---:|---|---|---|
| `briefing-planificacion-diseno-desarrollo-pruebas` | **Sí** | Estructura del briefing y anti-deriva. | Cada PR de §49–51 lleva objetivo / alcance / **no alcance** / dependencias / archivos / invariantes / tests / riesgo / rollback / criterio de cierre, que es la estructura de 10 puntos de la skill. Su bloque «Anti-deriva» obligó a separar los 5 correctivos funcionales del rediseño (§52). | 11, 49–53, 57, 63 |
| `staff-senior-full-stack-engineer` | **Sí** | Evidencia real del repo, contratos, fronteras entre capas. | «Leer archivos reales antes de modificar» produjo el Hecho 2 (tres hooks adaptativos), invisible sin abrir los tres. «No simular éxito» produjo la corrección del §1.2. Todas las referencias son `ruta:línea`. | 6, 13–21, 41–45 |
| `production-web-optimization-engineer` | **Sí** | Renderizado, reflow, ResizeObserver, densidad, CSS, sobreingeniería, escala P0–P3. | Su checklist de frontend detectó: componentes de 62–83 KB (§14), `.field-select` duplicando `Select` (§15), 3 hooks adaptativos equivalentes (§20), 17 456 B de componentes muertos (§14.3). Su regla «no introducir abstracciones innecesarias» hizo rechazar un `SuperSearchBar` monolítico (§47.3). | 15, 16, 21, 40, 48 |
| `admin-dashboard-operational-actions` | **Sí** | Acciones, filtros, botones, mutaciones, toolbars, selección. | Inventario de las 10 superficies admin con su acción real (§12); verificación en runtime de que Aplicar/Limpiar/Actualizar tienen handler; detección de que la barra de tokens de clínica desaparece con dataset vacío (§17, P2-09). | 13, 18, 20, 32–34 |
| `security-production-invariants` | **Sí** | Roles, sesiones, cookies, IDs, tokens, rutas admin, datos sensibles. | Verificación de separación `admin_session_id` / `app_session_id` en las 15 superficies medidas; ningún filtro acepta token completo («Últimos 4»); ningún `data-*` contiene lexemas sensibles; ninguna colección expone hashes. | 12, 18, 61 |
| `web-end-to-end-global` | **Sí** | Coherencia global admin + clínica, responsive, regresiones cruzadas. | Detectó el Hecho 3 (dos app shells para el rol clínica), que sólo aparece comparando `/dashboard` con `/dashboard/informes`. Motivó medir las 10 superficies de clínica además de las 11 de admin. | 13, 14, 17, 38, 57 |
| `bugs-errores-optimizacion-rutas` | **Sí (condicional)** | Persisten defectos funcionales/UX. | 5 correctivos separados en §52: `line-height` degenerado, `aria-label` sobre `div` sin rol, barra condicionada a datos, doble shell de clínica, canvas de usuarios desalineado con su `limit`. | 41–45, 53 |
| `protocolos-comunicacion` | **Sí (condicional)** | Las colecciones producen llamadas con cookies de sesión y `limit`/`offset`. | Mapa filtro → parámetro → endpoint (§17.2); trazado de `limit` a la query real (§20). | 18, 21, 56 |
| `lanzamiento-mantenimiento` | **Sí (condicional)** | Se piden readiness, gates y rollback. | 12 gates en §58, rollback lógico por PR en §61. Ningún despliegue ejecutado. | 59, 62 |
| `pwa-end-to-end` | **No** | Condición no cumplida — **descarte reconfirmado**. | La política PWA de la propia skill **prohíbe cachear** `/dashboard/*` y `/dashboard/admin/*`. Las 7 rutas auditadas están íntegramente bajo `/dashboard`. Por construcción, el service worker no puede servir una versión obsoleta de ninguna superficie de este rediseño, y ningún PR propuesto toca manifest, SW ni caché. | 11 |

---

## 6. Baseline del repositorio

| Elemento | Valor |
|---|---|
| Rama / commit auditado | `main` @ `065860c5` |
| Estado | Limpio (sólo los dos documentos de auditoría sin seguimiento) |
| Fecha | 2026-08-04 03:04 −03:00 |
| Node / PNPM | v24.14.1 / 11.13.0 (coincide con `packageManager`) |
| Next.js / React | ^16.2.11 / ^19.2.8 |
| Tailwind | ^4.3.3 + `@tailwindcss/postcss` ^4.3.3 |
| Radix | `react-dialog` ^1.1.17, `react-separator` ^1.1.0, `react-slot` ^1.1.0, `react-toast` ^1.2.17, `react-tooltip` ^1.2.10 |
| Iconos | `lucide-react` ^1.24.0 |
| Utilidades CSS | `class-variance-authority` ^0.7.1, `clsx` ^2.1.1, `tailwind-merge` ^3.6.0, `tailwindcss-animate` ^1.0.7 |
| Animación | `gsap` ^3.15.0 |
| Formularios / tablas | **Sin librería.** Estado local + `<form>` nativo; `zod` ^4 cliente / ^3.25.76 backend. Tabla propia (`components/ui/table.tsx`) |
| Tests | `node --test` con `--experimental-strip-types` |
| E2E | Playwright ^1.61.0, `@axe-core/playwright` ^4.12.1, `pngjs` ^7.0.0 |
| Backend | Fastify ^5.10.0, Drizzle ^0.45.2, `postgres` ^3.4.9, Supabase JS ^2.110.8 |
| Breakpoints | Tailwind por defecto: `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 · `2xl` 1536 |

**Vigencia:** toda la evidencia de código de este documento corresponde al commit `065860c5` verificado arriba. La corrección aplicada es de método de medición, no de código (§41, P1-04).

---

## 7. Consolidación del subsistema de superbuscadores (S1–S7)

Los 7 superbuscadores son un **subsistema protegido** dentro del rediseño global (§17 los sitúa dentro del inventario general de superficies). Esta sección contiene, de forma autosuficiente y con evidencia directa de código, su contrato funcional completo. Ninguna implementación puede alterar lo descrito en §7.3–§7.7 sin romper operativa protegida.

### 7.1 Inventario S1–S7

| ID | Superficie | Ruta | Componente : línea | Mecanismo | Test que ancla |
|---|---|---|---|---|---|
| S1 | Auditoría | `/dashboard/admin?module=audit-log` | `AdminAuditFilterBar.tsx:53-133` | **`<form method="get" action="/dashboard/admin">`** — navegación por URL | `admin-audit-enterprise-density.test.ts` |
| S2 | Tokens admin | `/dashboard/admin?module=admin-particular-tokens` | `AdminParticularTokensCard.tsx:1009-1120` | `onSubmit` cliente | `admin-tokens-enterprise-density.test.ts:81-89` |
| S3 | Informes admin | `/dashboard/admin?module=admin-report-upload` | `AdminReportsCard.tsx:532-640` | `onSubmit` cliente | `admin-reports-enterprise-density.test.ts:130-136` |
| S4 | Clínicas | `/dashboard/admin?module=admin-clinics` | `AdminClinicsManagementCard.tsx:606-620` | `onChange` cliente, sin submit ni endpoint propio | `frontend-admin-clinics-management-card.test.ts` |
| S5 | Usuarios y roles | `/dashboard/admin?module=admin-users-roles` | `AdminUsersRolesReadOnlyCard.tsx:540-605` | `onChange` inmediato, sin submit | `admin-users-roles-enterprise-density.test.ts` |
| S6 | Informes clínica | `/dashboard?module=informes` | `ClinicInformesWorkspaceSummary.tsx:266-364` | `onSubmit` cliente, render condicional | `frontend-dashboard-informes.test.ts:132-145` |
| S7 | Tokens clínica | `/dashboard?module=tokens` | `ClinicParticularTokensCard.tsx:745-832` | `onSubmit` cliente, render condicional | `frontend-dashboard-clinic-tokens.test.ts` |

### 7.2 Mecanismo de consulta, submit manual vs `onChange`, y reset de página

| Superficie | Mecanismo | Momento de la consulta | Reset de página |
|---|---|---|---|
| S1 Auditoría | **`<form method="get">` con navegación de URL** | Al pulsar `Aplicar` (submit nativo) | Vía URL |
| S2 Tokens admin | `onSubmit` React (`preventDefault` implícito por `FilterBar`) | Al pulsar `Aplicar` | `pagedTokens.setPage(0)` |
| S3 Informes admin | `onSubmit` React | Al pulsar `Aplicar` | `setOffset(0)` |
| S4 Clínicas | `onChange` (filtrado en cliente) | En cada pulsación | — |
| S5 Usuarios y roles | `onChange` (sin submit) | En cada cambio de control | `setOffset(0)` sólo en los `select`; **no** en el campo de texto |
| S6 Informes clínica | `onSubmit` React | Al pulsar `Aplicar` | `setOffset(0)` |
| S7 Tokens clínica | `onSubmit` React | Al pulsar `Aplicar` | `setPage(0)` |

### 7.3 Contrato de URL de S1

`action="/dashboard/admin"` con `<input type="hidden" name="module" value="audit-log">`. Sus filtros son parámetros de query string reales y compartibles. Convertir ese `<form>` en un handler de cliente **rompería URLs existentes**: prohibido en cualquier PR del roadmap.

### 7.4 Parámetros, endpoints y payloads protegidos

| Superficie | Parámetros | Destino |
|---|---|---|
| S1 | `event`, `actorType`, `from`, `to`, `clinicId`, `reportId`, `module` | Query string → `getAdminAuditPage({...,limit,offset})` |
| S2 | `token`, `clinic`, `reportId`, `patient`, `status`, `from`, `to` | `loadTokens()` |
| S3 | `report`, `clinic`, `patient`, `status`, `study`, `file`, `from`, `to` | `getAdminReportWorkflow({limit, offset})` |
| S4 | `searchQuery` (local) | Filtrado en memoria |
| S5 | `searchQuery`, `userType` (`all`/`admin`/`clinic`), `role` (`all`/`admin`/`clinic_owner`/`clinic_staff`) | `loadUsersRoles` |
| S6 | Idem S3 sin `clinic` | Consulta de informes de clínica |
| S7 | Idem S2 sin `clinic` | `loadTokens()` |

**Semántica de fechas protegida:** `from` se envía tal cual (`YYYY-MM-DD`); `to` se expande a `${to}T23:59:59.999Z` (`AdminAuditCard.tsx:195`, misma regla en S2/S3/S6/S7). No modificable.

### 7.5 Acciones, defaults y validaciones

`Aplicar` (`type="submit"`, S1/S2/S3/S6/S7) ejecuta la consulta y resetea offset/página. `Limpiar` restaura `INITIAL_FILTER_STATE` en draft y aplicados (S2 sólo si `hasActiveFilters`; S3/S6/S7 siempre; en S1 es un `PublicRouteControl` de navegación a `/dashboard/admin?module=audit-log` con `replace`, renderizado sólo si hay filtros activos). `Actualizar` (S2) ejecuta `loadTokens()` con `disabled={isLoadingTokens}`. El indicador `N por página` (S3, S5, S7) refleja `effectiveLimit`, el `limit` real enviado — no es decorativo.

### 7.6 Política de renderizado condicional (3 variantes, no unificadas)

S1–S5 siempre renderizan su barra. S6 sólo si `!reportsLoadError`. S7 sólo si `tokens.length` es verdadero (`ClinicParticularTokensCard.tsx:916`). Unificar esta política es **PR-BUG-01** (§55); no es parte del rediseño visual.

### 7.7 Estado runtime no determinado de S7

El fixture E2E hermético no puebla tokens de clínica (responde `E2E populated session required`), por lo que S7 nunca renderiza su barra en el entorno de medición usado por esta auditoría. Sus valores geométricos se derivan del código (clases idénticas a S6, distinta plantilla de grid `lg:grid-cols-[0.9fr_0.85fr_1.15fr_0.85fr_0.85fr_0.85fr_auto_auto]`), no de runtime medido. Confianza: media-alta. Ver §63, fila 1.

### 7.8 Regla de no modificación

**Prohibido** en cualquier PR del roadmap: handlers, eventos, submit, momento de la consulta (manual vs automático), nombres de parámetro, payloads, endpoints, métodos HTTP, semántica de fechas, valores por defecto, validaciones, **paginación y límites**, ordenamiento, relevancia, resultados, permisos, roles, estados de carga y error, el efecto de `Aplicar`/`Actualizar`/`Limpiar`, rutas de navegación (incluida la query string de S1), persistencia, backend, SQL, DB, seguridad, auditoría y sanitización.

**Permitido:** CSS, posición, ubicación en el app shell, ancho, alto, distribución visual, orden visual de zonas (sin alterar el flujo ni el orden de tabulación), responsive, colores, tipografía, bordes, radios, sombras, iconos, estados visuales, presentación visual de resultados, wrappers y markup exclusivamente presentacional, extracción de componentes behavior-preserving.

---

## 8. Definición del dashboard objetivo

```
WorkspaceAppShell                       (100dvh, overflow-hidden, min-height:0)
├── WorkspaceAppBar                     56 px · menú · identidad VETNEB · búsqueda global · acciones · notificaciones · cuenta
├── NavigationDrawer / NavigationRail   256 px expandido · 80 px compacto · drawer modal en < 768
├── WorkspaceMain
│   ├── WorkspaceScaffold
│   │   ├── WorkspaceHeader             40 px · título + acciones primarias (sin descripción permanente)
│   │   ├── WorkspaceToolbar            48 px · DefaultToolbar ⇄ SelectionToolbar
│   │   ├── FilterRegion                56 px · campo primario + chips + overflow
│   │   ├── CollectionRegion            flex-1 · ContentList | ContentGrid · única región de scroll
│   │   └── WorkspaceFooter             40 px · CollectionPager
└── UtilitySidePanel                    336 px · DetailsPane | ActivityPane (colapsable)
```

**Invariantes conservados:** `100dvh`, `overflow-hidden`, `min-height: 0`, regiones internas acotadas, separación de roles, rutas, contrato zero-scroll, paginación adaptativa (desacoplada, no eliminada).

---

## 9. Principios Drive-like y Material Design 3

1. **Content-first.** El chrome persistente no pinta sombra. Evidencia Drive: 6 sombras únicas en 22 estados, todas de menú (elevación 2/4) o diálogo (elevación 24); la topbar es `rgba(0,0,0,0)` sin borde ni sombra.
2. **Superficie neutra.** Cobertura neutra 92.55 – 99.41 %; `#FFFFFF` 63–74 % del viewport, `#F8FAFD` 21–22 %. El color es acento funcional, no decoración.
3. **El tinte marca la función, no el contenedor.** Drive tiñe el campo de búsqueda (`#E9EEF6`) y deja transparente su contenedor.
4. **Una sola región de scroll relevante.** `singleRelevantScrollRegion: true` en 17 de 21 estados; `documentScroll.horizontal: false` en **22 de 22**.
5. **Ritmo de 8 px.** Gap dominante 8 px (44–82 ocurrencias por estado), 12 px secundario.
6. **Densidad homogénea.** Fila de datos 48 px en todos los estados de lista; 58 px en mobile (objetivo táctil).
7. **Degradación progresiva de filtros.** Un campo primario de 832 px + chips de 128 px que abren popovers (`aria-haspopup="dialog"`), nunca 8 campos equivalentes.
8. **Menús, no diálogos, para acciones de ítem.** Ítem de menú de 32 px, `min-width` 198 px, `padding 0 12px`, radio 0, fondo transparente, sin sombra.
9. **Identidad VETNEB preservada.** Se conservan `--vetneb-navy`, `--vetneb-teal` y el dominio veterinario. No hay clonación nominal ni de marca: se reproducen patrones funcionales y proporciones.

---

## 10. No alcance

- Implementar cualquiera de los 50 PR del roadmap principal ni de los 5 correctivos separados (universo máximo: 55; §54, §55).
- Web pública (`/`, `/servicios`, `/precios`, `/profesionales`, …). Los tokens propuestos son **dashboard-scoped**.
- Backend, SQL, Supabase, migraciones, RLS.
- Dependencias nuevas: la propuesta se implementa con Tailwind 4, Radix y `lucide-react` ya presentes.
- **PWA y service worker.** Descartado con evidencia: la política del proyecto prohíbe cachear `/dashboard/*` y `/dashboard/admin/*`; las 7 rutas auditadas están íntegramente bajo `/dashboard`; ningún PR toca manifest, SW ni caché.
- Cambiar la altura de fila de datos como objetivo independiente: altera `itemHeightPx` → `limit` (ver §20).
- Cualquier operación de git o de despliegue.

---

## 11. Invariantes

**Funcionales.** Handlers · submit · momento de consulta (manual vs automático) · nombres de parámetro · payloads · endpoints · métodos HTTP · semántica de fechas (`to` → `T23:59:59.999Z`) · defaults · validaciones · **paginación y límites** · ordenamiento · relevancia · resultados · rutas (incluida la query string de la auditoría) · persistencia.

**Seguridad.** `admin_session_id` para administración y `app_session_id` para clínica, sin mezcla · admin sin sesión no revela dashboard · sin exposición de `password`, hashes, tokens completos, cookies ni signed URLs · sin caché de privados · errores DB sanitizados · auditoría sin secretos.

**Arquitectura.** `100dvh` + `overflow-hidden` + `min-height: 0` · contrato zero-scroll · una sola región de scroll de datos por módulo · deep-link por `?module=` · Back/Forward seguro.

**Verificado en runtime:** ningún superbuscador acepta token completo (placeholder «Últimos 4»); ningún `data-*` del dashboard contiene lexemas sensibles; las 143 combinaciones (superficie, viewport) medidas respetan zero-scroll (muestra estratificada, §4.7).

---

## 12. Inventario de rutas administrativas

| Ruta | Módulo (`?module=`) | Componente raíz | Colección | Detalle | Superbuscador | Tests |
|---|---|---|---|---|---|---|
| `/dashboard/admin` | *(hub)* | `AdminDashboardWorkspaceController` + `DashboardModuleHub` + `DashboardHubHero` | — | — | — | `admin-*-enterprise-density` |
| `/dashboard/admin` | `admin` | `AdminCommandCenter` | — | — | — | `frontend-dashboard-admin` |
| `/dashboard/admin` | `admin-report-upload` | `AdminReportsCard` + `AdminReportsUploadPanel` + `AdminReportWorkflowViewerCard` | Tabla | Visor | **S3** | `admin-reports-enterprise-density` |
| `/dashboard/admin` | `admin-health` | `AdminSchemaHealthStatusCard` | — | — | — | — |
| `/dashboard/admin` | `admin-clinics` | `AdminClinicsManagementCard` + `ClinicEditDrawer` | Tarjetas | Drawer | **S4** | `frontend-admin-clinics-management-card` |
| `/dashboard/admin` | `admin-particular-tokens` | `AdminParticularTokensCard` (83 115 B) | Tabla | — | **S2** | `admin-tokens-enterprise-density` |
| `/dashboard/admin` | `admin-pricing` | `AdminPricingEditorCard` | Formularios paginados | — | — | `frontend-admin-pricing-card` |
| `/dashboard/admin` | `admin-sessions` | `AdminSessionsReadOnlyCard` | Tabla | — | — | `admin-sessions-enterprise-density` |
| `/dashboard/admin` | `admin-users-roles` | `AdminUsersRolesReadOnlyCard` | Tabla | — | **S5** | `admin-users-roles-enterprise-density` |
| `/dashboard/admin` | `audit-log` | `AdminAuditCard` + `AdminAuditFilterBar` + `AdminAuditDenseTable` + `AdminAuditDetailDialog` | Tabla densa | Diálogo | **S1** | `admin-audit-enterprise-density` |
| `/dashboard/admin` | `admin-maintenance` | `AdminMaintenanceDryRunCard` | Lista paginada | — | — | — |

**11 superficies admin** (hub + 10 módulos). Navegación: `DashboardHorizontalNav` (10 pestañas) + hub + `AdminMobileBottomNav` + `AdminMobileKebabMenu` + `AdminMobileHubLauncher`.

---

## 13. Inventario de rutas de clínica

| Ruta | Módulo | Componente raíz | Shell | Colección | Superbuscador |
|---|---|---|---|---|---|
| `/dashboard` | `operaciones` | `ClinicCommandCenter` | topbar 55.33 + **rail 39.39** | Tarjetas + tabs | — |
| `/dashboard` | `informes` | `ClinicInformesWorkspaceSummary` | topbar + rail | Tabla + master-detail | **S6** |
| `/dashboard` | `logistica` | `ClinicLogisticaWorkspaceSummary` | topbar + rail | Lista | — |
| `/dashboard` | `perfil` | `ClinicPublicProfileCard` (28 010 B) | topbar + rail | Formulario + tabs | — |
| `/dashboard` | `tokens` | `ClinicParticularTokensCard` (62 976 B) | topbar + rail | Tabla | **S7** |
| `/dashboard/informes` | *(ruta completa)* | `InformesReportsList` + `DashboardPageHeader` | **topbar 92.33 + hnav 37** | Tabla + timeline | — |
| `/dashboard/logistica` | *(ruta completa)* | `LogisticsCommandCenter` + `StickyActionBar` | topbar + hnav | Listas | — |
| `/dashboard/logistica/metricas` | | `LogisticsBoundedCanvas` | topbar + hnav | Métricas | — |
| `/dashboard/logistica/rutas` | | `LogisticsBoundedCanvas` | topbar + hnav | Tabla | — |
| `/dashboard/logistica/visitas` | | `LogisticsBoundedCanvas` | topbar + hnav | Tabla | — |

**10 superficies de clínica.** **Dos app shells distintos para el mismo rol** — hallazgo P0-04.

---

## 14. Inventario de componentes

### 15.1 Recuento

| Ubicación | Archivos | Bytes |
|---|---:|---:|
| `components/dashboard/` | 49 | 344 010 |
| `components/ui/` | 10 | 14 092 |
| `app/dashboard/admin/*.tsx` | 30 | 435 421 |
| `app/dashboard/*.tsx` (clínica raíz) | 5 | 54 028 |
| `features/dashboard/` | 14 | 18 196 |
| **Total dashboard** | **89** | ~865 000 |

### 15.2 Componentes por nivel arquitectónico

| Nivel | Componentes | Estado |
|---|---|---|
| **Shell** | `DashboardShellRouter`, `PrivateDashboardShell`, `DashboardTopbar`, `BackForwardCacheGuard` | Conservar, rediseñar visualmente |
| **Navegación** | `DashboardHorizontalNav`, `DashboardModuleRail`, `AdminMobileBottomNav`, `ClinicMobileBottomNav`, `AdminMobileKebabMenu`, `AdminMobileModuleMenu`, `AdminMobileHubLauncher`, `AdminMobileHubPager`, `AdminMobileLauncherTile` | **Unificar** — 9 componentes para 3 funciones |
| **Navegación muerta** | `DashboardSidebar`, `AdminDashboardSidebar`, `ClinicDashboardSidebar`, `DashboardSidebarFrame` | **Retirar** (§14.3) |
| **Layout** | `DashboardPageHeader` (3 usos), `DashboardModuleWorkspace`, `ModuleSurface`, `ClinicMobileModuleFrame` | Consolidar en `WorkspaceScaffold` |
| **Hub** | `DashboardModuleHub`, `DashboardHubHero` | Degradar a «Inicio» opcional |
| **Filtros** | `FilterBar` (compartido, 5 usos), `StickyFilterBar` (**0 usos**), `FilterDrawer` (**0 usos**) | Base del subsistema de filtros |
| **Colección** | `ui/table.tsx`, `usePagedRows`, `DashboardPager`, `CompactPager`, `ModuleTabs`, `StatsCards` | Base de `CollectionWorkspace` |
| **Estados** | `EmptyState`, `ErrorState`, `LoadingState`, `StatusBadge`, `DashboardStatusBadge` | Conservar, unificar |
| **Diálogos** | `ModuleDialog`, `UploadReportModal` (28 656 B), `AdminAuditDetailDialog`, `ClinicEditDrawer` | Base de `menus/` + `dialogs/` |
| **Detalle** | `StudyTimeline`, `AdminReportWorkflowViewerCard`, `ParticularTokensCardPrimitives` | **Extraer** `DetailsPane` |
| **Monolitos** | `AdminParticularTokensCard` 83 115 B · `ClinicParticularTokensCard` 62 976 B · `AdminReportsCard` 39 205 B · `AdminUsersRolesReadOnlyCard` 36 152 B · `AdminClinicsManagementCard` 33 302 B · `AdminSessionsReadOnlyCard` 30 847 B · `page.tsx` admin 30 672 B · `UploadReportModal` 28 656 B · `ClinicPublicProfileCard` 28 010 B · `AdminPricingEditorCard` 27 254 B · `ClinicInformesWorkspaceSummary` 25 282 B · `DashboardNotificationsBell` 23 503 B | **12 archivos > 23 KB**; la barra, la tabla, el pager y el detalle viven dentro del mismo archivo |

### 15.3 Componentes sin consumidores (código muerto verificado)

| Componente | Bytes | Evidencia |
|---|---:|---|
| `DashboardSidebarFrame.tsx` | 5 876 | Sólo lo usan `Admin/ClinicDashboardSidebar` |
| `FilterDrawer.tsx` | 5 644 | 0 usos JSX en `frontend/src` |
| `StickyFilterBar.tsx` | 2 770 | 0 usos; 2 tests **afirman su ausencia** |
| `AdminDashboardSidebar.tsx` | 1 772 | 0 usos JSX |
| `ClinicDashboardSidebar.tsx` | 1 245 | Sólo lo usa `DashboardSidebar` |
| `DashboardSidebar.tsx` | 149 | 0 usos JSX |
| **Total** | **17 456** | Cadena completa sin punto de entrada desde ninguna página |

### 15.4 Arquitectura de destino ya andamiada

`features/dashboard/` contiene `application/` (2), `config/` (2), `domain/` (1), `presentation/` (7 barriles + `DashboardStatusBadge.tsx`) y un `README.md` que ya describe el destino. **La estructura existe y está vacía**: poblarla es mover, no inventar.

---

## 15. Inventario CSS

| Archivo | Bytes | Responsabilidad |
|---|---:|---|
| `app/globals.css` | 56 513 | Tokens globales, primitivas, gramática premium del dashboard, `.field-select` |
| `styles/dashboard/mobile-admin.css` | 27 238 | Variante mobile admin |
| `styles/dashboard/surfaces.css` | 18 485 | Superficies del dashboard |
| `styles/dashboard/responsive.css` | 11 349 | Media queries |
| `styles/dashboard/zero-scroll.css` | 9 222 | Contrato zero-scroll |
| `styles/dashboard/mobile-clinic.css` | 8 469 | Variante mobile clínica |
| `styles/dashboard/layout.css` | 5 505 | Layout |
| `styles/dashboard/navigation.css` | 4 293 | Navegación |
| `styles/dashboard/shell.css` | 3 457 | App shell |
| `styles/dashboard/interactions.css` | 2 475 | Interacciones |
| `styles/dashboard/tables.css` | 1 006 | Tablas |
| `styles/dashboard/index.css` | 740 | Barril |
| `styles/dashboard/tokens.css` | **514** | Tokens del dashboard |
| **Total** | **149 266** (4 119 líneas) | |

### 16.1 Diagnóstico

- **`tokens.css` tiene 514 bytes** frente a 148 752 de reglas. No existe un sistema de tokens del dashboard: existen valores dispersos. Es el hallazgo CSS estructural (P1-08).
- **Duplicación verificada:** `.field-select` (`globals.css:374`) reimplementa `components/ui/select.tsx` con radio 8 px (vs 6), fondo `rgb(248,251,252)` (vs `bg-card/96`) y sombra doble (vs simple). Se usa en Usuarios y roles y en formularios admin.
- **Mobile duplicado:** `mobile-admin.css` (27 238 B) + `mobile-clinic.css` (8 469 B) = 35 707 B, 24 % del CSS total, para dos variantes de la misma gramática.
- **Sombras en chrome persistente:** la tarjeta de módulo, la topbar y el botón primario de filtros pintan sombra. Drive no pinta ninguna en chrome persistente.
- **Superficie invertida** (heredado P1-06): contenedor teñido `bg-muted/15` (alfa 0.15, imperceptible) y campos casi blancos `bg-card/96`.

---

## 16. Inventario de navegación

| Mecanismo | Componente | Superficie | Alto/Ancho medido | Drive equivalente |
|---|---|---|---|---|
| Barra superior | `DashboardTopbar` | admin + clínica | banda 55.33 px | App bar 64 px |
| Pestañas horizontales | `DashboardHorizontalNav` | admin (10 ítems) + clínica en rutas completas (5) | **37 px** | *(no existe: Drive usa drawer lateral)* |
| Rail de módulos + pager | `DashboardModuleRail` | clínica `/dashboard` | **39.39 px** | *(no existe)* |
| Bottom nav admin | `AdminMobileBottomNav` | admin < 768 | — | *(Drive mobile usa bottom nav)* |
| Bottom nav clínica | `ClinicMobileBottomNav` | clínica < 768 | — | idem |
| Kebab mobile | `AdminMobileKebabMenu` | admin < 768 | — | Overflow menu |
| Hub + launcher | `DashboardModuleHub`, `AdminMobileHubLauncher`, `AdminMobileHubPager` | admin | — | *(no existe)* |
| Drawer lateral | — | **ausente** (4 componentes muertos) | — | **NavigationDrawer 256/257 px** |

**Diagnóstico.** Seis mecanismos activos y ningún drawer. Drive usa **un** drawer de 256 px (16.04 % del viewport a 1601 px, 13.39 % a 1920 px) más un rail derecho de 56 px. VETNEB gasta 92.33 px de **altura** (8.5 % de un viewport de 1080, **12.0 % de uno de 768**) en navegación horizontal, que es el eje escaso.

---

## 17. Inventario de superbuscadores *(subsistema protegido)*

Los 7 superbuscadores se incorporan al programa global conservando íntegro su inventario funcional. Este es el índice compacto; el contrato funcional completo con evidencia de código está consolidado en §7.

| ID | Superficie | Mecanismo | Reset de página | Acciones |
|---|---|---|---|---|
| S1 | Auditoría | **`<form method="get">` con navegación de URL** | vía URL | Aplicar · Limpiar (si hay filtros) |
| S2 | Tokens admin | `onSubmit` cliente | `setPage(0)` | Aplicar · Limpiar (condicional) · Actualizar |
| S3 | Informes admin | `onSubmit` cliente | `setOffset(0)` | Aplicar · Limpiar |
| S4 | Clínicas | `onChange` (cliente) | — | *(ninguna)* |
| S5 | Usuarios y roles | `onChange` (sin submit) | `setOffset(0)` sólo en los `select` | *(ninguna)* |
| S6 | Informes clínica | `onSubmit` cliente | `setOffset(0)` | Aplicar · Limpiar |
| S7 | Tokens clínica | `onSubmit` cliente | `setPage(0)` | Aplicar · Limpiar |

**S1 es la única cuya operativa vive en la URL** (`action="/dashboard/admin"` + `<input type="hidden" name="module" value="audit-log">`). Convertir ese `<form>` en handler de cliente rompería URLs compartidas: **prohibido**.

**Permitido cambiar:** CSS, ubicación, orden visual no funcional, ancho, alto, layout, responsive, tipografía, colores, bordes, radios, iconos, wrappers, markup presentacional, visualización de filtros activos, presentación de resultados.
**Prohibido cambiar:** handlers, submit, búsqueda manual/automática, query params, payloads, endpoints, contratos API, filtros, defaults, validaciones, fechas, ordenamiento, ranking, resultados, permisos, estados, Aplicar/Limpiar/Actualizar, paginación, límites, persistencia, seguridad, backend, SQL.

---

## 18. Inventario de colecciones

| Módulo | Tipo | Alto de fila medido | Scroll interno | Selección | Acciones de ítem |
|---|---|---:|---|---|---|
| Informes admin | Tabla | **35.66** | `auto` | **No** | Botones en fila |
| Tokens admin | Tabla | **35.66** | `auto` | **No** | Botones en fila |
| Auditoría | Tabla densa | **37** | `auto` | **No** | Diálogo de detalle |
| Sesiones | Tabla | 36 *(fallback)* | `auto` | **No** | Revocar en fila |
| Usuarios y roles | Tabla | **41** | `hidden` | **No** | Cambio de rol en fila |
| Clínicas | **Tarjetas** | **156.5** | `auto` | **No** | Drawer de edición |
| Precios | **Formularios** | variable | `auto` | **No** | Guardar por ítem |
| Mantenimiento | Lista | 76 *(fallback)* | — | **No** | — |
| Informes clínica | Tabla | **49** | — | **No** | Master-detail |
| Informes (ruta completa) | Tabla | 88 *(fallback)* | — | **No** | Timeline |
| Logística rutas/visitas | Tabla | **51** | — | **No** | — |
| Tokens clínica | Tabla | 44 *(fallback)* | — | **No** | Botones en fila |

**Seis alturas de fila distintas medidas** (35.66 · 37 · 41 · 49 · 51 · 156.5) frente a las **48 px homogéneas** de Drive. **Ninguna colección soporta selección** — ni individual, ni múltiple, ni por teclado. No existe toolbar contextual ni acción masiva en ninguna de las 12.

---

## 19. Inventario de paneles y diálogos

| Superficie | Componente | Patrón actual | Patrón Drive |
|---|---|---|---|
| Detalle de informe (clínica) | inline en `ClinicInformesWorkspaceSummary` | Master-detail embebido | **DetailsPane 336 px** |
| Detalle de auditoría | `AdminAuditDetailDialog` | **Diálogo modal** | Panel lateral |
| Edición de clínica | `ClinicEditDrawer` | Drawer | Diálogo (Drive usa diálogo para renombrar) |
| Carga de informe | `UploadReportModal` (28 656 B) | Diálogo modal | Diálogo |
| Visor de informe | `AdminReportWorkflowViewerCard` | Tarjeta embebida | **Visor a pantalla completa** |
| Filtros mobile | `ModuleDialog` | Diálogo | **Bottom sheet** |
| Timeline de estudio | `StudyTimeline` | Inline | Panel de actividad |
| Notificaciones | `DashboardNotificationsBell` (23 503 B) | Popover | Panel |

**No existe un `DetailsPane` reutilizable.** Cada módulo resuelve el detalle a su manera: inline, diálogo, drawer o tarjeta. Drive tiene un panel único de ~336 px con pestañas Detalles / Actividad.

**Derivación del ancho de Drive:** `dataViewport.widthCssPx` = **1607** en el estado 04 (sin panel) y **1271** en los estados 08/09/10 (panel de detalles y de actividad abiertos) → panel = **336 px**. Coherente con `viewportAreaPercent` 66.15 % → 52.32 %.

---

## 20. Inventario de paginación adaptativa *(tabla obligatoria)*

| Módulo | Hook | Región medida | Alto de fila | Header desc. | Min | Max | Límite enviado | Riesgo |
|---|---|---|---:|---|---:|---:|---|---|
| Auditoría | `useAdaptiveItemsPerPage` | `measurement.containerNode` | 36 *(fb)* | sí | 9 desktop / 1 mobile | **32** | `limit: effectiveLimit` → `getAdminAuditPage` | **Alto** |
| Informes admin | `useAdaptiveItemsPerPage` | idem | 36 *(fb)* / 35.66 real | sí | 9 / 1 | **36** | `getAdminReportWorkflow({limit, offset})` | **Alto** |
| Tokens admin | `useAdaptiveItemsPerPage` | idem | 36 *(fb)* | sí | 9 / 1 | **30** | `loadTokens` | **Alto** |
| Clínicas | `useAdaptiveItemsPerPage` | idem | 36 *(fb)* / 156.5 real | sí | 9 / 1 | **36** | listado admin | **Alto** |
| Usuarios y roles | `useAdaptiveItemsPerPage` | idem | **40** | sí | 9 / 1 | **36** | `loadUsersRoles` | **Alto** |
| Sesiones | `useAdaptiveItemsPerPage` | idem | 36 *(fb)* | sí | 8 | **32** | listado de sesiones | **Alto** |
| Intentos fallidos | `useAdaptiveItemsPerPage` | idem | **48** | sí | 1 | **25** | `limit` servidor | **Alto** |
| Precios | `useAdaptiveItemsPerPage` | `formsBodyNode` | `reservedFormHeightPx + gap` | no | **1** | **6** | cliente (`usePagedRows`) | Medio |
| Informes (ruta completa) | `useAdaptiveItemsPerPage` | `measurement.containerNode` | **88** | no | 1 | **24** | `limit` servidor | **Alto** |
| Mantenimiento | `useAdaptiveRowsPerPage` | `candidatesListNode` | **76** | no | 2 *(def.)* | — | cliente | Bajo |
| Informes clínica | `useAdaptiveRowsPerPage` | `reportsListBodyNode` | **44** | sí | 2 | — | cliente | Medio |
| Logística clínica | `useAdaptiveRowsPerPage` | `visitsListBodyNode` | **44** | no | 2 | — | cliente | Bajo |
| Tokens clínica | `useAdaptiveRowsPerPage` | body de lista | **44** | no | 2 | — | cliente | Medio |
| Logística lista reciente | `useAdaptiveDashboardPageSize` | `containerRef` | variable | no | **2** | **12** | cliente | Bajo |
| Logística canvas acotado | `useAdaptiveDashboardPageSize` | `containerRef` | variable | sí | `minLimit` | `maxLimit` | **servidor** (si no hay `limit` explícito) | **Alto** |

**15 módulos · 3 hooks · 3 reglas de descuento distintas.**
`useAdaptiveItemsPerPage` descuenta `headerHeightPx + safetyGapPx` (por defecto 6).
`useAdaptiveRowsPerPage` es un envoltorio con `minItems` por defecto **2**.
`useAdaptiveDashboardPageSize` descuenta `chromeHeightPx + headerHeightPx + paginationHeightPx + safetyBufferPx` (por defecto 6).

**Solución preferente (§48, PR-A05):** crear una **reserva geométrica estable** — las regiones estructurales (toolbar, superbuscador, pager, encabezado) declaran su altura reservada al canvas de filas mediante variables CSS, de modo que el canvas medido sea invariante a cambios de CSS interno. El `limit` sigue adaptándose al viewport.
**Alternativa admisible (§48, PR-A06):** medición explícita por regiones (app header · module header · toolbar · filtros · resumen · rows canvas · pager) con un solo hook unificado.
**Solución prohibida:** fijar `limit = 12`, `limit = 16` o cualquier valor global. La paginación debe seguir adaptándose al viewport y al zero-scroll.

---

## 21. Métricas de app shell (1920 × 1080)

| Banda | Admin | Clínica `/dashboard` | Clínica rutas completas | Drive |
|---|---:|---:|---:|---:|
| Barra superior | 55.33 | 55.33 | 55.33 | **64** |
| Navegación horizontal | **37** | — | **37** | — |
| Rail de módulos (en `main`) | — | **39.39** | — | — |
| **Total chrome de shell** | **92.33** | **94.72** | **92.33** | **64** |
| Drawer lateral | **0** | 0 | 0 | **257** |
| Rail derecho | 0 | 0 | 0 | **56** |
| Panel de detalle | variable/embebido | embebido | embebido | **336** |
| `main` empieza en y | 92.33 | 55.33 | 92.33 | — |
| Fondo de la barra | `card/78` + `backdrop-blur` | idem | idem | **`rgba(0,0,0,0)`** |
| Sombra de la barra | `shadow-sm` | idem | idem | **`none`** |

---

## 22. Métricas de chrome

### 23.1 Descomposición vertical — Informes admin, 1920 × 1080

| Banda | y | Alto | % del chrome |
|---|---:|---:|---:|
| Header de aplicación (topbar + hnav) | 0 | **92.33** | 28.6 % |
| Gutter + `dashboard-workspace-header` | 92.33 | **73.95** | 22.9 % |
| Tarjeta: borde + `CardHeader` (título, descripción, 2 botones) | 166.28 | **46.02** | 14.2 % |
| Tira de métricas | 216.28 | 28.00 | 8.7 % |
| **Superbuscador** | 248.28 | **42.00** | **13.0 %** |
| Cabecera de tabla + separación | 290.28 | 33.00 | 10.2 % |
| **Total hasta la primera fila** | | **323.28** | 100 % |

El superbuscador es el **cuarto** consumidor. Los dos primeros (header de aplicación 92.33 + encabezado de workspace 73.95 = **166.28 px, el 51.4 %**) se resuelven en el Programa B, Nivel 5 (§49, B11–B14).

### 23.2 Chrome por viewport (% del alto del viewport antes de la primera fila)

| Viewport | Mín | Máx | Superficie del máximo | Drive |
|---|---:|---:|---|---:|
| 1920 × 1080 | 29.9 | 40.4 | logística rutas/visitas | 19.2 |
| 1600 × 900 | 35.6 | 41.1 | auditoría | — |
| 1440 × 900 | 35.6 | 41.1 | auditoría | — |
| **1366 × 768** | 40.4 | **54.7** | logística rutas/visitas | — |
| **1280 × 720** | 44.1 | **52.5** | auditoría | — |
| 1024 × 768 | 40.4 | 47.6 | auditoría | — |
| 834 × 1194 | 29.3 | 36.6 | informes clínica | — |
| 768 × 1024 | 34.0 | 42.3 | informes clínica | — |
| 430 × 932 | 15.2 | 23.4 | usuarios | — |
| 390 × 844 | 16.7 | 25.8 | usuarios | 6.8 |
| 360 × 800 | **17.6** | 27.2 | usuarios | — |

**Mobile consume la mitad de chrome que desktop.** La arquitectura mobile de VETNEB ya es content-first; la de escritorio no.

---

## 23. Métricas de contenido útil

| Métrica | VETNEB | Drive |
|---|---|---|
| `limit` adaptativo a 1920 × 1080 | **19** (informes admin) | 15 – 16 |
| `limit` adaptativo a 1366 × 768 | **10** | — |
| `limit` adaptativo a 1280 × 720 | **9** (7 en sesiones) | — |
| Alto de fila | 35.66 – 156.5 (6 valores) | **48** (homogéneo) |
| Área de datos | **NO DETERMINADO** — no se midió `viewportAreaPercent` equivalente | 66.15 % (52.32 % con panel) |
| Canvas de filas a 1920 (informes admin) | 721.3 px, `overflow-y: auto` | 720 px |
| Contenedores de scroll en `main` | 1 – 2 | 1 (17/21 estados) |
| Desbordamiento horizontal | **0 en 143/143** | `false` en 22/22 |

> El canvas de filas de VETNEB a 1920 mide **721.3 px** y el de Drive **720 px**. La superficie de datos es prácticamente idéntica; la diferencia está en *dónde empieza* (294.3 vs 175) y en *cuánto mide cada fila* (35.66 vs 48).

---

## 24. Métricas de componentes

| Componente | VETNEB (medido) | Drive (código de estado) |
|---|---|---|
| Barra superior | 55.33 px · `bg card/78` + blur · `shadow-sm` | **64 px · transparente · sin sombra** |
| Navegación | 37 px horizontal · ítem 29.59 px · radio 6 · 13/19.5 px w600 · pad `4px 10px` | Drawer 257 px |
| Tarjeta de módulo | 887.33 × 1867.22 · radio 8 · `bg card/95` · borde 1 px · **con sombra** | *(no existe la capa)* |
| Encabezado de workspace | 44 px | — |
| Cabecera de tabla | 28 px · `bg muted/65` · 12/16 px | — |
| Fila de datos | **35.66 px** · 12/16 px · sin fondo | **48 px** |
| Celda | `padding 2px 8px` | — |
| Pager | 31 px · borde superior | — |
| Superbuscador | 32 – 60.5 px · radio 8 · `bg muted/15` | Pill **834 × 48** · radio **24** · **#E9EEF6** |
| Campo de filtro | 32 px (28 en usuarios) · radio 6 · 12/16 px | Input 728 × 20 · **16 px** |
| Chip de filtro | **no existe** | **128.28 × 32** · radio 8 · borde 1 px `rgb(116,119,117)` · 14/16 px w500 |
| Ítem de menú | **no existe** (todo es diálogo) | **32 px** · `min-width 198` · `padding 0 12px` · radio 0 · transparente · sin sombra · 13/20 px w400 |
| Botón primario | 32 px · radio 6 · **`0 10px 26px rgba(16,60,96,.2)`** | Sin sombra |
| Panel de detalle | embebido, ancho variable | **336 px** |

---

## 25. Datos de Google Drive utilizados

### 26.1 Condiciones de captura

| Grupo | Viewport CSS | DPR | Estados | Uso |
|---|---|---:|---|---|
| **Principal** | **1920 × 911** | 1 | 04, 08–18 | Todas las cifras de destino |
| Secundario | 1601 × 747 | 1.2 | 02, 03, 05–07, H01, MU | Verificación de invariancia de ancho |
| Excluido | 1920 × 911 | 1 | 19, 20 (visor PDF, tema oscuro) | Sólo §35 (visor) |
| Mobile | **390 × 844** | 2 / 3 | 01–07 | §37 (responsive) |

### 26.2 Valores canónicos

| Ruta técnica | Valor | Código | Aplicabilidad |
|---|---|---|---|
| `shell.topbarHeightCssPx` | **64** | 04, 08–18 | App bar de destino |
| `detectedRegions.topbar.computed.surface.backgroundColor` | `rgba(0,0,0,0)` | 02–18 | Barra transparente |
| `detectedRegions.topbar.computed.surface.boxShadow` | `none` | todos | Sin elevación en chrome |
| `shell.leftNavigationWidthCssPx` | **257** (`minWidth: 256px`, `maxWidth: 394px`) | 04, 08–18 | Drawer de destino |
| `shell.rightRailWidthCssPx` | **56** | 04, 08–18 | Rail de utilidades |
| `dataViewport.yCssPx` | **175** | 04, 08–18 | Objetivo de chrome |
| `dataViewport.xCssPx` | **257** | 04, 08–18 | Origen de columna |
| `dataViewport.viewportAreaPercent` | **66.15 %** / 52.32 % con panel | 04 / 08–10 | Objetivo de contenido |
| `dataViewport.stickyVerticalPixels` | 48 (Mi unidad) / **105** (resultados) | 04 / 12, 13 | Toolbar pegajosa |
| Panel de detalle *(derivado)* | **336** = 1607 − 1271 | 04 vs 08–10 | `UtilitySidePanel` |
| `density.dominantDataRowHeightCssPx` | **48** | 02–17 | Fila de destino |
| `density.theoreticalRowsInPrimaryViewport` | **15** (16 detectadas) | 04, 08–17 | Referencia de densidad |
| `documentScroll.horizontal` | **`false` en 22/22** | todos | Invariante |
| `scrollArchitecture.singleRelevantScrollRegion` | `true` en 17/21 | | Invariante |
| `colorEconomy.neutralCoverageApproxPercent` | **92.55 – 99.41 %** | listas | Métrica de aceptación |
| `colorEconomy.topSurfaceColors[0]` | `#FFFFFF`, 63 – 74 % | | |
| `colorEconomy.topSurfaceColors[1]` | `#F8FAFD`, 21 – 22 % | | |
| `visualSystem.shadows` | **6 únicas en 22 estados**, ninguna en chrome persistente | | Elevación reservada |
| `visualSystem.gaps` | **8 px dominante** (44–82 ocurrencias/estado), 12 px secundario | | Ritmo |
| Buscador `form#aso_search_form_anchor` | `role="search"` · 834 × 48 · radio 24 · `#E9EEF6` · borde 1 px transparente · sin sombra · `max-width 832px` · `transition: background .1s ease-in, width .1s ease-out` | `I03798`, `G03805`, `C01621` | §45 |
| Input de búsqueda | 728 × 20 · 16 px «Google Sans» · transparente · sin borde ni radio · inset izq. 57 / der. 49 | `G04027`, `C01677` | §45 |
| Chip de filtro | 128.28 × 32 · radio 8 · borde 1 px `rgb(116,119,117)` · blanco · sin sombra · 14/16 px w500 `rgb(68,71,70)` · `margin 4px 8px 4px 0` · `aria-haspopup="dialog"` | `G00358`, `C00117`, `A00199` | §45 |
| Ítem de menú | 32 × 320 (`min-width 198`) · `padding 0 12px` · radio 0 · transparente · sin sombra · 13/20 px w400 · `aria-posinset`/`aria-setsize` | `G00320`, `C00101`, `A00141` | §45 |
| Mobile: `topbarHeightCssPx` | **60** (57 en búsqueda) | 01–07 | §37 |
| Mobile: `dataViewport.yCssPx` / `viewportAreaPercent` | **57** / **93.25 %** | 01–07 | §37 |
| Mobile: fila | **58 px** | 01–04 | §37 |
| Mobile: input de búsqueda | 334 × 37 @ x = 56 · **16 px** · sin borde ni radio · 85.64 % del ancho | `G01020`, `C00224` | §37 |

### 26.3 Limitaciones de comparación

1. Drive gestiona **una** entidad con **un** campo de búsqueda; VETNEB filtra entidades heterogéneas con 3–8 dimensiones. La composición es transferible; el número de dimensiones no.
2. Los estados de Drive son de **tema claro** (salvo 19/20); las capturas del propietario son de **tema oscuro**; la medición VETNEB fue en claro. Los colores se comparan por **relación** (Δ de luminosidad respecto a la página), nunca por hex absoluto.
3. Drive dispone de 1663 px de ancho de contenido y gasta 834 en el buscador (50 %). VETNEB dispone de 1833–1867 y gasta el 100 %. La proporción no es trasladable sin decidir qué ocupa el resto.
4. Ninguna medida se presenta como universal: cada valor lleva su estado y su viewport.

---

## 26. Matriz VETNEB vs Drive

**Tolerancias:** R = rígida (±2 px) · P = responsive (fórmula) · T = token/valor exacto.

| Propiedad | VETNEB actual | Drive | Destino | Tol. | Regla responsive |
|---|---|---|---|---|---|
| Alto de la app bar | 55.33 px | **64** | **56 px** | R ±2 | fijo; 56 en < 768 |
| Fondo de la app bar | `card/78` + blur | `rgba(0,0,0,0)` | **`hsl(var(--md-sys-color-surface))`**, sin blur | T | — |
| Sombra de la app bar | `shadow-sm` | `none` | **`none`** + borde inferior 1 px | T | — |
| Navegación primaria | horizontal 37 px | drawer 257 px | **Drawer 256 px / Rail 80 px** | R ±1 | ≥1280 drawer · 768–1279 rail · <768 drawer modal |
| Chrome vertical de shell | 92.33 px | 64 | **56 px** (−36.33) | R ±2 | idem en todos los viewports |
| Encabezado de workspace | 73.95 + 46.02 = 119.97 | — | **40 px** (−79.97) | R ±2 | 40 px; descripción a `title` |
| Tira de métricas | 28 px permanente | — | **0 px** (a la toolbar o al panel) | T | — |
| Superbuscador | 32 – 60.5 px | pill 48 en topbar 64 | **56 px** de banda, campo 40 px | R ±2 | ver §45 |
| Toolbar | **no existe** | 48 sticky (105 en búsqueda) | **48 px** | R ±2 | colapsa a overflow en <1024 |
| Chrome total antes del dato | 323.28 – 436.19 | **175** | **≤ 240 px** | R | ≤ 32 % del viewport en 768–1366 |
| Alto de fila | 35.66 – 156.5 | **48** | **40 px** homogéneo (48 en <768) | R ±1 | ver nota |
| Origen de columna | 26.39 / 27.39 / 43.39 | 257 | **único** | R ±1 | = origen del `main` |
| Panel de detalle | embebido | **336** | **336 px**, colapsable | R ±2 | overlay en <1280, full-screen en <768 |
| Chip de filtro | no existe | 128.28 × 32, radio 8 | **32 px**, radio 8, 96–160 px | R ±2 | overflow menu al no caber |
| Ítem de menú | no existe | **32 px**, `min-w 198` | **32 px**, `min-w 200` | R ±1 | 48 px en <768 (táctil) |
| Selección | **no existe** | checkbox + toolbar contextual | **checkbox + SelectionToolbar** | T | — |
| Sombra en chrome | tarjeta + botón + topbar | `none` | **`none`** | T | elevación sólo en menús/diálogos/overlays |
| Gap del sistema | 6 / 8 px mezclados | **8 px** dominante | **8 px** | T | escala 4/8/12/16/24 |
| Cobertura neutra | no medida | 92.55 – 99.41 % | **≥ 90 %** | P | métrica de aceptación |
| Desbordamiento horizontal | **0 / 143** | `false` 22/22 | **0** | R | **ya en paridad** |
| Transición | 0.15 s, 3–5 props | **0.1 s, 2 props** | 0.1 s, 2 props | T | suprimir con `reduced-motion` |

> **Nota sobre el alto de fila.** Se propone 40 px (no los 48 de Drive) porque subir de 35.66 a 48 px reduciría el `limit` a 1366 × 768 de 10 a ~7 filas. 40 px mejora legibilidad y objetivo de puntero manteniendo el `limit`. **Cualquier cambio de esta cifra altera `itemHeightPx` → `limit`** y sólo puede aplicarse tras el desacoplamiento del Programa A, con autorización explícita.

---

## 27. Diferencias estructurales

**P1-04 · Chrome del shell.** 92.33 px de chrome horizontal permanente (28.6 % del chrome total) frente a 64 px en Drive; sin drawer lateral pese a existir 4 componentes de sidebar muertos. A 1366 × 768 el chrome del shell equivale al **12.0 %** del alto del viewport.

**P0-04 · Dos app shells para el rol clínica.** `/dashboard` usa topbar 55.33 + rail 39.39 dentro de `main`; `/dashboard/informes` y `/dashboard/logistica/*` usan topbar 92.33 con navegación horizontal y sin rail.

**P1-09 · Card-centric.** 4 capas de superficie que pintan entre el viewport y el primer dato en los módulos admin: shell → `main` → tarjeta de módulo → contenedor de tabla. Drive pinta el dato sobre la página.

**P1-10 · El hub como puerta.** `/dashboard/admin` sin `?module=` renderiza `DashboardModuleHub` + `DashboardHubHero`. El deep link funciona, pero la entrada por defecto exige un paso extra.

**P1-11 · `presentation/` vacío.** 7 barriles con documentación del destino y **un** componente real (1 272 B de 865 000 B de código de dashboard).

---

## 28. Diferencias de navegación

**P1-12 · Seis mecanismos activos.** `DashboardHorizontalNav` · `DashboardModuleRail` (pestañas **y** pager anterior/siguiente) · 2 bottom navs · kebab · hub + launcher. Nueve componentes para tres funciones.

**P1-13 · Eje equivocado.** VETNEB gasta **altura** (37 px de pestañas) donde Drive gasta **anchura** (257 px de drawer). En 1366 × 768 la altura es el recurso escaso: 37 px son el 4.8 % del viewport; 257 px de ancho serían el 18.8 % de un eje sobrado.

**P3-07 · Rail con doble gramática.** `DashboardModuleRail` combina pestañas y un pager anterior/siguiente sobre el mismo conjunto ordenado — dos modelos mentales para la misma navegación.

**P2-07 · Ausencia de estado de navegación persistente.** No hay breadcrumb ni indicación de profundidad más allá de `aria-current="page"`.

---

## 29. Diferencias de workspace

**P1-14 · Sin scaffold reutilizable.** Cada módulo compone su encabezado, tira de métricas, filtros, colección y pager a mano. `ModuleSurface` (1 299 B) y `DashboardModuleWorkspace` (2 218 B) cubren sólo parte.

**P2-08 · Encabezado de workspace desproporcionado.** 73.95 px de gutter + `workspace-header` más 46.02 px de `CardHeader` = **119.97 px** para un título, una descripción y dos botones. Drive resuelve el equivalente en 0 px (el título vive en el drawer).

**P3-05 · Offset tarjeta→barra variable.** 82 / 90 / 103.5 / 112 / 126.27 px según módulo (rango de 44 px).

---

## 30. Diferencias de colecciones

**P1-07 · Seis alturas de fila.** 35.66 · 37 · 41 · 49 · 51 · 156.5 px frente a 48 homogéneas.
**P1-15 · Sin alternancia lista/cuadrícula** en ninguna colección, ni siquiera donde aporta valor (informes, clínicas, documentos).
**P2-09 · Sin ordenamiento por columna** en ninguna tabla.
**P2-10 · Cabecera de tabla no pegajosa** (28 px, se desplaza con el contenido en el canvas `auto`).
**P3-08 · Densidad de celda heterogénea:** `padding 2px 8px` en admin frente a valores distintos en clínica.

---

## 31. Diferencias de selección

**P1-16 · No existe selección en ninguna de las 12 colecciones.** Ni individual, ni múltiple, ni «seleccionar página», ni limpiar selección, ni selección por teclado. Drive expone selección individual (estado 02), múltiple (03) y toolbar contextual.
**Consecuencia:** ninguna acción masiva es posible; toda operación es fila a fila.

---

## 32. Diferencias de filtros

Inventario vigente: **P1-01** (tres implementaciones), **P1-02** (colapso 768–1023), **P1-03** (sin campo primario, reparto fraccional 180–394 px), **P1-05** (S4/S5 sin primitivas), **P1-06** (superficie invertida), **P2-01** (etiquetas incoherentes), **P2-04** (S4 sin región nombrada).

**Nuevo — P2-11 · Sin filtros activos visibles.** Ningún módulo muestra chips removibles de filtros aplicados; el único indicio es la aparición del botón `Limpiar`.

---

## 33. Diferencias de toolbars

**P1-17 · No existe la capa toolbar.** Las acciones viven en el `CardHeader` (Actualizar, Subir informe), en la fila o en el pager. Drive tiene una toolbar de 48 px que **cambia de estado** al haber selección.
**P2-12 · Sin toolbar contextual** (consecuencia directa de P1-16).
**P3-09 · Acciones de módulo dimensionadas por contenido** (28 px de alto en `CardHeader`, distintas del resto).

---

## 34. Diferencias de paneles

**P1-18 · Sin `DetailsPane` reutilizable.** Cuatro patrones distintos para la misma función (inline, diálogo, drawer, tarjeta).
**P2-13 · Sin panel de actividad.** `StudyTimeline` existe pero está embebido en un módulo.
**P3-10 · Sin `DetailsEmptyState`** consistente.

---

## 35. Diferencias de visor

**P2-14 · Visor embebido, no a pantalla completa.** `AdminReportWorkflowViewerCard` (11 772 B) es una tarjeta dentro del módulo. Drive (estados 19/20) usa un visor de página completa: `dataViewport.viewportAreaPercent` **85.59 %** (19) y **77.18 %** (20, con panel de navegación), nav izquierda reducida a 62 px, topbar `rgb(27,27,27)`, sin rail derecho.
**Roadmap progresivo conservado:** preview overlay → visor integrado → toolbar → zoom → navegación de páginas → miniaturas → fullscreen → descarga → fallback externo.

---

## 36. Diferencias CSS

**P1-08 · Sin sistema de tokens del dashboard.** `tokens.css` = 514 B frente a 148 752 B de reglas.
**P1-06 · Superficie invertida** (heredado).
**P2-02 · Sombra de diálogo en chrome persistente** (heredado, ampliado a la tarjeta de módulo y la topbar).
**P2-03 · Seis escalas tipográficas** en el dashboard: 12/16 w500 · 12/12 w500 · 13/19.5 w600 · 13/20 · 14/20 w400 · 16/24 w400.
**P2-06 · 17 456 B de componentes muertos** (§14.3).
**P2-15 · Duplicación mobile:** `mobile-admin.css` + `mobile-clinic.css` = 35 707 B (24 % del CSS).
**P2-16 · `.field-select` duplica `Select`** con radio, fondo y sombra distintos.
**P3-01 · Radios mezclados:** 6 (controles) · 8 (contenedor, `.field-select`, tarjeta) · 0 (tablas).
**P3-04 · Gap 6 vs 8 px.**
**P4-04 · Transiciones 0.15 s / 3–5 propiedades** frente a 0.1 s / 2.

---

## 37. Diferencias responsive

**P1-02 · Colapso 768–1023** (heredado): las barras de filtros pasan de 42–60.5 px a 117–155 px.
**P1-19 · El peor chrome está en 1366 × 768 y 1280 × 720** (40.4–54.7 % y 44.1–52.5 %), las resoluciones de portátil corporativo.
**P2-17 · Mobile mejor que desktop** (15.2–27.2 %): la arquitectura mobile ya es content-first; la de escritorio no. **La migración debería llevar el patrón de mobile a desktop, no al revés.**
**P3-11 · Objetivos táctiles de 36 px** en la variante mobile de Usuarios y roles (< 44 px recomendados).
**Referencia Drive mobile:** topbar 60 px (57 en búsqueda), dato desde y = 57, **93.25 %** de área de datos, fila 58 px, campo de búsqueda 334 × 37 a 16 px ocupando el 85.64 % del ancho, sin pill.

---

## 38. Diferencias de accesibilidad

**P2-04 · `aria-label` sobre `div` sin `role`** (Usuarios y roles) → nombre accesible ignorado. → **PR-BUG-03**.
**P2-05 · Sin `aria-describedby` ni live region** en ninguna colección: los cambios de conteo y de página no se anuncian.
**P2-18 · Sin `role="search"`** en ninguna de las 7 barras; Drive lo expone.
**P3-06 · Foco por `box-shadow` con `outline-style: none`** y `outline-offset: 3px` inerte → no sobrevive a `forced-colors`.
**P3-11 · Objetivos táctiles < 44 px** en mobile de Usuarios y roles.
**En positivo:** etiquetado implícito por `<label>` correcto en las superficies medidas; orden de tabulación coincidente con el visual; `sr-only` conserva el nombre accesible.
**NO DETERMINADO:** ratios de contraste WCAG reales (no se ejecutó axe sobre el dashboard) y comportamiento con lector de pantalla.

---

## 39. Diferencias de rendimiento y mantenibilidad

**P1-20 · Doce archivos > 23 KB** con barra, tabla, pager, detalle y lógica de fetch en el mismo módulo (máximo: `AdminParticularTokensCard` 83 115 B).
**P2-19 · Tres hooks adaptativos equivalentes** con tres reglas de descuento.
**P2-20 · `ResizeObserver` acoplado a la altura de la barra:** animar la altura provocaría *thrash* de `limit` y peticiones repetidas al servidor.
**P2-15 · 35 707 B de CSS mobile duplicado.**
**P2-06 · 17 456 B de componentes muertos.**
**NO DETERMINADO:** re-renders, hidratación, layout shift, long tasks y peso real del bundle del dashboard (no se perfiló).

---

## 40. Hallazgos P0

| ID | Título | Evidencia | Impacto | Recomendación | Prueba | Cierre |
|---|---|---|---|---|---|---|
| **P0-01** | La altura de las regiones determina el `limit` enviado al backend | `useAdaptiveItemsPerPage.ts:92-105`; `AdminAuditCard.tsx:188,198` | Cualquier cambio de CSS altera la paginación real, operativa protegida | Reserva geométrica estable (§20) antes de tocar geometría | `supersearch-limit-invariance` | `limit` por viewport idéntico al baseline |
| **P0-02** | Los tests de contrato de fuente congelan la geometría | `frontend-dashboard-filter-drawer-sticky-filters.test.ts:180`; `admin-tokens-enterprise-density.test.ts:84,89` | Un PR de CSS hace fallar `pnpm test` | Realinear anclas **en el mismo PR**, nunca debilitarlas | Suite completa | `pnpm validate:local` verde |
| **P0-03** | Tres hooks adaptativos con tres reglas de descuento | `useAdaptiveItemsPerPage.ts`, `useAdaptiveRowsPerPage.ts`, `useAdaptiveDashboardPageSize.ts`; 15 consumidores (§20) | Un desacoplamiento parcial deja la mitad del dashboard expuesta | Unificar en un hook con regiones declaradas | Test de invariancia sobre los 15 módulos | Un solo hook; los 15 módulos con `limit` invariante |
| **P0-04** | Dos app shells para el rol clínica | `/dashboard` topbar 55.33 + rail 39.39; `/dashboard/informes` topbar 92.33 + hnav 37 (§13, §21) | Unificar el shell cambia el canvas medido en **ambas** rutas → doble riesgo de `limit` | Unificar tras P0-03, con baseline de `limit` en las 10 superficies de clínica | E2E de paridad de shell | Un solo shell; `limit` invariante en las 10 |

---

## 41. Hallazgos P1

| ID | Título | Alcance | Evidencia |
|---|---|---|---|
| P1-01 | Tres implementaciones de superbuscador (+ 3 orígenes y 3 anchos) | 7 superbuscadores | `AdminUsersRolesReadOnlyCard.tsx:540`, `AdminClinicsManagementCard.tsx:606`; §10 doc. anterior |
| P1-02 | Colapso de densidad de filtros en 768–1023 px (42–60.5 → 117–155) | 5 superbuscadores | Medición anterior, reconfirmada |
| P1-03 | Sin campo de búsqueda primario; reparto fraccional 180–394 px | 7 superbuscadores | §10.4 doc. anterior |
| **P1-04** | **Chrome vertical (CORREGIDO)**: 29.9–54.7 % vs 19.2 %; peor en 1366×768 y 1280×720 | Todo el dashboard | §22; corrige la cifra «9 filas» del baseline |
| P1-05 | Usuarios y roles + Clínicas no usan las primitivas | 2 módulos | §10.5 doc. anterior |
| P1-06 | Superficie invertida (contenedor teñido, campos blancos) | Sistema visual | `C01621` vs runtime |
| P1-07 | Seis alturas de fila (35.66 · 37 · 41 · 49 · 51 · 156.5) vs 48 homogéneas | 12 colecciones | §18 |
| P1-08 | Sin sistema de tokens del dashboard (`tokens.css` = 514 B) | CSS | §15 |
| P1-09 | Card-centric: 4 capas de superficie antes del dato | Todo el dashboard | §22.1 |
| P1-10 | El hub es la entrada por defecto de administración | Admin | `AdminDashboardWorkspaceController:286,433` |
| P1-11 | `features/dashboard/presentation/` vacío (7 barriles, 1 componente) | Arquitectura | §14.4 |
| P1-12 | Seis mecanismos de navegación / nueve componentes | Navegación | §16 |
| P1-13 | La navegación gasta el eje escaso (altura) en vez del sobrado (anchura) | Navegación | §28 |
| P1-14 | Sin `WorkspaceScaffold` reutilizable | 15 módulos | §29 |
| P1-15 | Sin alternancia lista/cuadrícula | Colecciones | §30 |
| P1-16 | **Sin selección en ninguna de las 12 colecciones** | Colecciones | §31 |
| P1-17 | No existe la capa toolbar | 15 módulos | §33 |
| P1-18 | Sin `DetailsPane` reutilizable (4 patrones distintos) | Paneles | §34 |
| P1-19 | El peor chrome coincide con las resoluciones de portátil corporativo | Responsive | §22.2 |
| P1-20 | Doce archivos > 23 KB mezclan barra, tabla, pager, detalle y fetch | Mantenibilidad | §14.2 |

---

## 42. Hallazgos P2

| ID | Título | Alcance |
|---|---|---|
| P2-01 | Etiquetas visibles vs `sr-only` incoherentes entre hermanos | Superbuscadores |
| P2-02 | Sombra de diálogo en chrome persistente (botón, tarjeta, topbar) | Sistema visual |
| P2-03 | Seis escalas tipográficas en el dashboard | CSS |
| P2-04 | `aria-label` sobre `div` sin `role`; Clínicas sin región nombrada | Accesibilidad |
| P2-05 | Sin `aria-describedby` ni live region en ninguna colección | Accesibilidad |
| P2-06 | 17 456 B de componentes muertos (6 archivos) | Mantenibilidad |
| P2-07 | Sin breadcrumb ni estado de navegación persistente | Navegación |
| P2-08 | Encabezado de workspace de 119.97 px para título + descripción + 2 botones | Workspace |
| P2-09 | Sin ordenamiento por columna en ninguna tabla | Colecciones |
| P2-10 | Cabecera de tabla no pegajosa dentro del canvas `auto` | Colecciones |
| P2-11 | Sin chips de filtros activos removibles | Filtros |
| P2-12 | Sin toolbar contextual de selección | Toolbars |
| P2-13 | Sin panel de actividad reutilizable | Paneles |
| P2-14 | Visor embebido en tarjeta, no a pantalla completa | Visor |
| P2-15 | 35 707 B de CSS mobile duplicado (24 % del total) | CSS |
| P2-16 | `.field-select` duplica `Select` con radio, fondo y sombra distintos | CSS |
| P2-17 | Mobile mejor que desktop en chrome (15–27 % vs 30–55 %) | Responsive |
| P2-18 | Sin `role="search"` en ninguna barra | Accesibilidad |
| P2-19 | Tres hooks adaptativos equivalentes | Mantenibilidad |
| P2-20 | `ResizeObserver` acoplado a la altura → animar altura provoca *thrash* de `limit` | Rendimiento |

---

## 43. Hallazgos P3

| ID | Título |
|---|---|
| P3-01 | Radios mezclados (6 / 8 / 0) |
| P3-02 | Acciones dimensionadas por contenido (81.75 / 77.72 / 59.63 px) |
| P3-03 | Padding de contenedor `4px 8px` / `4px 6px` / `4px 16px` / `0` |
| P3-04 | Gap 6 px vs 8 px según superficie |
| P3-05 | Offset tarjeta→barra de 82 a 126.27 px |
| P3-06 | Foco con `outline-style: none` y `outline-offset` inerte |
| P3-07 | `DashboardModuleRail` con doble gramática (pestañas + pager) |
| P3-08 | Densidad de celda heterogénea entre admin y clínica |
| P3-09 | Acciones de módulo de 28 px, distintas del resto del sistema |
| P3-10 | Sin `DetailsEmptyState` consistente |
| P3-11 | Objetivos táctiles de 36 px en mobile de Usuarios y roles |

---

## 44. Hallazgos P4

| ID | Título |
|---|---|
| P4-01 | Icono `Filter` de 14 × 14 px en `Aplicar`; Drive no usa icono en la acción primaria |
| P4-02 | Placeholder «Buscar clínica por nombre, email o usuario…» truncado a 320 px |
| P4-03 | `<input type="hidden">` participa en el grid de Auditoría como columna de 0.016 px |
| P4-04 | Transiciones de 0.15 s sobre 3–5 propiedades frente a 0.1 s sobre 2 |
| P4-05 | `Módulo N de 5` en el rail: metadato de paginación en una navegación |
| P4-06 | Descripción del módulo permanente en el encabezado, redundante con la navegación |

**Totales: P0 = 4 · P1 = 20 · P2 = 20 · P3 = 11 · P4 = 6 · Total = 61.**

---

## 45. Sistema visual de destino

### 46.1 Tokens dashboard-scoped

Derivados de los tokens VETNEB existentes (`globals.css:16-49` claro, `:1663-1695` oscuro), **no impuestos a la web pública**.

| Token | Claro (HSL) | Oscuro (HSL) | Origen |
|---|---|---|---|
| `--md-sys-color-surface` | `198 34% 96%` | `210 8% 12%` | `--background` |
| `--md-sys-color-surface-dim` | `198 30% 92%` | `210 8% 10%` | derivado |
| `--md-sys-color-surface-bright` | `190 33% 98%` | `210 9% 20%` | `--card` |
| `--md-sys-color-surface-container-lowest` | `0 0% 100%` | `210 9% 9%` | derivado |
| `--md-sys-color-surface-container-low` | `190 33% 98%` | `210 9% 14%` | `--card` |
| `--md-sys-color-surface-container` | `197 31% 94%` | `210 8% 16%` | derivado |
| `--md-sys-color-surface-container-high` | `198 26% 91%` | `210 8% 20%` | **`--muted`** — equivalente de `#E9EEF6` |
| `--md-sys-color-surface-container-highest` | `197 31% 88%` | `210 8% 24%` | derivado |
| `--md-sys-color-on-surface` | `205 58% 15%` | `210 16% 90%` | `--foreground` |
| `--md-sys-color-on-surface-variant` | `205 22% 36%` | `210 10% 68%` | `--muted-foreground` |
| `--md-sys-color-outline` | `199 28% 78%` | `210 8% 32%` | `--input` |
| `--md-sys-color-outline-variant` | `197 28% 80%` | `210 8% 30%` | `--vetneb-line` |
| `--md-sys-color-primary` | `207 72% 30%` | `205 62% 44%` | `--primary` (**identidad VETNEB**) |
| `--md-sys-color-on-primary` | `190 36% 97%` | `190 36% 97%` | `--primary-foreground` |
| `--md-sys-color-primary-container` | `207 60% 88%` | `205 45% 26%` | derivado |
| `--md-sys-color-on-primary-container` | `207 72% 22%` | `205 62% 84%` | `--vetneb-navy` |
| `--md-sys-color-error` | **NO DETERMINADO** | **NO DETERMINADO** | *falta censar el token de error actual en `globals.css`* |
| `--md-sys-color-error-container` | **NO DETERMINADO** | **NO DETERMINADO** | idem |

**Justificación del token clave.** Drive tiñe su campo de búsqueda con `#E9EEF6` sobre página `#FFFFFF`: Δ L ≈ −6 puntos. En VETNEB claro la página es `--background` con L = 96; `--muted` tiene L = 91 → Δ L = −5. En oscuro, `--background` L = 12 y `--muted` L = 20 → Δ L = +8. `--muted` es por tanto el equivalente tonal nativo de `#E9EEF6`, **sin copiar el hex**.

### 46.2 Escalas

| Escala | Valores |
|---|---|
| **Shape** | 0 · 4 · 8 · 12 · 16 · full (pill = alto/2) |
| **Elevation** | 0 chrome persistente · 1 tarjeta elevada *(no usar en dashboard)* · 2 menú · 3 popover · 4 diálogo/overlay |
| **State layer** | hover 8 % · focus 10 % · pressed 12 % · selected 12 % · dragged 16 % (sobre `on-surface`) |
| **Spacing** | 4 · **8** · 12 · 16 · 24 · 32 (base 8, ritmo de Drive) |
| **Density** | `comfortable` (fila 48) · **`standard` (fila 40)** · `compact` (fila 36) |
| **Typography** | label-sm 11/16 w500 · label-md 12/16 w500 · body-sm **13/20 w400** · body-md 14/20 w400 · title-sm 14/20 w600 · title-md 16/24 w600 |
| **Motion** | short 100 ms · medium 200 ms · long 300 ms |
| **Easing** | standard `cubic-bezier(0.2,0,0,1)` · decelerate `cubic-bezier(0,0,0,1)` · accelerate `cubic-bezier(0.3,0,1,1)` |
| **Focus ring** | `outline: 2px solid hsl(var(--md-sys-color-primary)); outline-offset: 2px` **real** + `box-shadow` actual (corrige P3-06) |

---

## 46. Especificación geométrica

| Elemento | Alto | Ancho | Padding | Radio | Borde | Sombra | Tipografía | Tol. |
|---|---:|---|---|---:|---|---|---|---|
| **WorkspaceAppBar** | **56** | 100 % | `0 16px` | 0 | inferior 1 px `outline-variant` | **none** | title-md | ±2 |
| **NavigationDrawer** | 100 % | **256** | `8px` | 0 | derecho 1 px | none | body-md | ±1 |
| **NavigationRail** | 100 % | **80** | `8px 0` | 0 | derecho 1 px | none | label-sm | ±1 |
| Ítem de drawer | **40** | 100 % − 16 | `0 12px` | **20** (pill) | none | none | body-md | ±1 |
| Ítem de rail | **56** | 100 % | `8px 0` | 16 | none | none | label-sm | ±1 |
| **WorkspaceHeader** | **40** | 100 % | `0 16px` | 0 | none | none | title-sm | ±2 |
| **WorkspaceToolbar** | **48** | 100 % | `0 16px` | 0 | inferior 1 px | none | body-sm | ±2 |
| **FilterRegion** | **56** | 100 % | `8px 16px` | 0 | inferior 1 px | none | — | ±2 |
| Campo primario | **40** | `clamp(280px, 44%, 832px)` | `0 12px 0 44px` | **20** | 1 px transparente | none | body-md | ±1 |
| Chip de filtro | **32** | `clamp(96px, auto, 160px)` | `0 12px` | **8** | 1 px `outline` | none | body-sm w500 | ±2 |
| Acción de toolbar | **32** | `min-width 88` | `0 12px` | 8 | none/1 px | **none** | body-sm w600 | ±2 |
| **CollectionRegion** | `flex: 1` | 100 % | 0 | 0 | none | none | — | — |
| Cabecera de colección | **36** *(pegajosa)* | 100 % | celdas `0 12px` | 0 | inferior 1 px | none | label-md | ±1 |
| **Fila de datos** | **40** | 100 % | celdas `0 12px` | 0 | inferior 1 px `outline-variant` | none | body-sm | ±1 |
| Ítem de cuadrícula | **176** | `minmax(176px, 1fr)` | `12px` | 12 | 1 px | none | body-sm | ±2 |
| Checkbox de selección | **18** | 18 | — | 4 | 2 px | none | — | ±1 |
| **CollectionPager** | **40** | 100 % | `0 16px` | 0 | superior 1 px | none | body-sm | ±2 |
| **UtilitySidePanel** | 100 % | **336** | `16px` | 0 | izquierdo 1 px | none | body-md | ±2 |
| Ítem de menú | **32** | `min-width 200` | `0 12px` | 0 | none | none | body-sm | ±1 |
| Superficie de menú | auto | `min 200` | `8px 0` | 8 | none | **elevación 2** | — | ±1 |
| Diálogo | auto | `min(560px, 90vw)` | `24px` | 16 | none | **elevación 4** | — | ±2 |
| Objetivo táctil (< 768) | **≥ 44** | ≥ 44 | — | — | — | — | — | — |

**Chrome objetivo antes del primer dato:** 56 (app bar) + 40 (header) + 48 (toolbar) + 56 (filtros) + 36 (cabecera) = **236 px**, frente a los 323.28–436.19 actuales. Reducción medida de **87 a 200 px**. A 1366 × 768 el chrome pasaría del 40.4–54.7 % al **≈ 30.7 %**.

> **La geometría de esta tabla es la única canónica.** Los valores 64 px (app bar), 48 px (superbuscador) y 24 px (radio del campo) que aparecen como evidencia comparativa en §25 son la métrica cruda medida de Google Drive, no una especificación de destino alternativa. La especificación de destino vigente es únicamente ésta: `WorkspaceAppBar` 56 px, `WorkspaceHeader` 40 px, `WorkspaceToolbar` 48 px, `FilterRegion` 56 px, `SuperSearchField` 40 px con radio 20 px, `CollectionHeader` 36 px, fila estándar 40 px, `CollectionPager` 40 px, `UtilitySidePanel` 336 px.

---

## 47. Arquitectura de componentes

### 48.1 Destino

```
features/dashboard/
├── application/            navegación de módulos, orquestación (existe)
├── config/                 catálogo de módulos (existe)
├── domain/                 tipos de rol y módulo (existe)
└── presentation/
    ├── shell/              WorkspaceAppShell · WorkspaceAppBar · UtilitySidePanel
    ├── navigation/         NavigationDrawer · NavigationRail · MobileNavDrawer · BottomNav
    ├── workspace/          WorkspaceScaffold · WorkspaceHeader · WorkspaceToolbar · WorkspaceFooter
    ├── collection/         CollectionWorkspace · CollectionToolbar · CollectionHeader ·
    │                       ContentList · ContentListItem · ContentGrid · ContentGridItem ·
    │                       CollectionPager · CollectionEmptyState · useCollectionSelection
    ├── filters/            FilterRegion · SuperSearchField · FilterChip · FilterOverflow ·
    │                       AdvancedFilterSheet · ActiveFilterChips
    ├── details/            DetailsPane · DetailsHeader · DetailsTabs · DetailsMetadata ·
    │                       DetailsActivity · DetailsActionDock · DetailsEmptyState
    ├── menus/              OverflowMenu · ContextMenu · ActionMenu · BulkActionMenu · SubMenu
    ├── dialogs/            ModuleDialog (migrado) · ConfirmDialog · FormDialog
    ├── viewer/             DocumentViewer · ViewerToolbar · ViewerThumbnails
    ├── admin/              composición por módulo admin
    └── clinic/             composición por módulo clínica
```

### 48.2 Destino de cada componente actual

| Acción | Componentes |
|---|---|
| **Conservar y mover** | `DashboardShellRouter`, `PrivateDashboardShell`, `ModuleSurface`, `ModuleDialog`, `ModuleTabs`, `usePagedRows`, `DashboardPager`, `CompactPager`, `EmptyState`, `ErrorState`, `LoadingState`, `StatusBadge`, `FilterBar`, `ui/*` |
| **Fusionar** | 9 de navegación → `NavigationDrawer` + `NavigationRail` + `MobileNav` · 3 hooks adaptativos → 1 · `mobile-admin.css` + `mobile-clinic.css` → `responsive.css` |
| **Extraer de monolitos** | `DetailsPane` (de `ClinicInformesWorkspaceSummary`, `AdminAuditDetailDialog`, `ClinicEditDrawer`) · `CollectionWorkspace` (de las 6 cards de tabla) · `SelectionToolbar` (nuevo) |
| **Degradar** | `DashboardModuleHub` + `DashboardHubHero` → «Inicio» opcional, no puerta |
| **Retirar** | `DashboardSidebar`, `AdminDashboardSidebar`, `ClinicDashboardSidebar`, `DashboardSidebarFrame`, `StickyFilterBar`, `FilterDrawer` (17 456 B) |
| **Reexportar durante la migración** | Barriles de `presentation/*` reexportan desde `components/dashboard/` hasta que el último consumidor migre |

### 48.3 Abstracciones rechazadas

- **`SuperSearchBar` monolítico:** necesitaría props para mecanismo de submit, presencia de cada acción, política de renderizado condicional, política de etiquetas, reset por control y plantilla de columnas. API inmanejable. **Rechazado.**
- **`CollectionWorkspace` con fetch integrado:** acoplaría presentación y API. La colección recibe datos y callbacks; nunca llama al backend.
- **Unificar el mecanismo de consulta de los 7 superbuscadores:** S1 usa navegación de URL y el resto handlers de cliente. Es **operativa protegida**: no se unifica.

---

## 48. Programa A — Contratos y desacoplamiento

**Objetivo:** permitir una transformación visual profunda sin cambiar accidentalmente la operativa.

| PR | Nivel | Objetivo | Dependencias |
|---|---|---|---|
| **A01** | 0 | Baseline de contrato operativo de las 15 superficies (handlers, params, endpoints, defaults, reset de página) | — |
| **A02** | 0 | Baseline geométrico E2E: 13 viewports × 15 superficies, con tolerancias | A01 |
| **A03** | 0 | Baseline de `limit`/`offset` por módulo y viewport (los 15 de §20) | A01 |
| **A04** | 0 | Baseline de seguridad: separación de sesión, ausencia de secretos, `data-*` sin lexemas sensibles | — |
| **A05** | 1 | **Reserva geométrica estable**: las regiones estructurales declaran altura reservada; el canvas de filas queda invariante al CSS interno | A02, A03 |
| **A06** | 1 | Unificar los 3 hooks adaptativos en uno con regiones declaradas | A05 |
| **A07** | 1 | Migrar los 15 módulos al hook unificado, con `limit` invariante demostrado | A06 |
| **A08** | 1 | Congelar el contrato zero-scroll como test de 13 viewports × 15 superficies | A02 |

---

## 49. Programa B — Chrome y arquitectura global

**Objetivo:** cambiar la arquitectura visible del producto.

| PR | Nivel | Objetivo | Dependencias |
|---|---|---|---|
| **B01** | 2 | Poblar `presentation/shell` y `presentation/navigation` con reexports; reglas de import | A07 |
| **B02** | 2 | Retirar los 6 componentes muertos (17 456 B) | B01 |
| **B03** | 3 | `tokens.css`: escalas de color, shape, elevation, state-layer, spacing, density, typography, motion — claro y oscuro | B01 |
| **B04** | 3 | Migrar superficies del dashboard a los tokens; **eliminar sombra del chrome persistente** | B03 |
| **B05** | 3 | Invertir la relación de superficie (tinte al campo, contenedor transparente) | B04 |
| **B06** | 4 | `WorkspaceAppBar` de 56 px (identidad, búsqueda global, acciones, notificaciones, cuenta) | B04 |
| **B07** | 4 | `NavigationDrawer` 256 px + `NavigationRail` 80 px | B06 |
| **B08** | 4 | Retirar `DashboardHorizontalNav` y `DashboardModuleRail`; migrar a drawer/rail | B07, A08 |
| **B09** | 4 | Unificar las 2 bottom nav y el kebab en un modelo mobile único | B08 |
| **B10** | 4 | **Unificar los dos app shells de clínica** (resuelve P0-04) | B08, A07 |
| **B11** | 5 | `WorkspaceHeader` de 40 px; descripción del módulo fuera del flujo permanente | B10 |
| **B12** | 5 | Retirar la tarjeta de módulo como capa de superficie (−1 de las 4 capas) | B11, B04 |
| **B13** | 5 | Degradar el hub a «Inicio»: entrada directa al último módulo o al predeterminado | B08 |
| **B14** | 5 | Reubicar la tira de métricas (a toolbar o panel) | B11 |
| **B15** | 6 | `WorkspaceScaffold` (header · toolbar · filters · collection · details · footer) | B12 |
| **B16** | 6 | `UtilitySidePanel` de 336 px | B15 |

---

## 50. Programa C — Workspaces y módulos

**Objetivo:** llevar la nueva gramática a todas las funciones administrativas y de clínica.

| PR | Nivel | Objetivo | Dependencias |
|---|---|---|---|
| **C01** | 7 | `CollectionWorkspace` + `ContentList` + `ContentListItem` + `CollectionHeader` pegajosa | B15 |
| **C02** | 7 | `CollectionPager` unificado (fusiona `DashboardPager` y `CompactPager`) | C01 |
| **C03** | 7 | `CollectionEmptyState` / error / loading unificados | C01 |
| **C04** | 7 | Ordenamiento por columna (P2-09) | C01 |
| **C05** | 7 | Altura de fila homogénea a 40 px — **requiere A07** por `itemHeightPx` | C01, A07 |
| **C06** | 8 | `useCollectionSelection`: individual, múltiple, página, limpiar, teclado | C01 |
| **C07** | 8 | `SelectionToolbar` contextual | C06 |
| **C08** | 8 | `OverflowMenu` · `ContextMenu` · `ActionMenu` · `SubMenu` (ítem 32 px) | B15 |
| **C09** | 8 | `BulkActionMenu` sobre `SelectionToolbar` | C07, C08 |
| **C10** | 8 | `SuperSearchField` (campo primario 40 px, pill) | B15, A05 |
| **C11** | 8 | `FilterChip` + `FilterOverflow` + `ActiveFilterChips` (resuelve P1-02, P1-03, P2-11) | C10 |
| **C12** | 8 | `AdvancedFilterSheet` para mobile | C11 |
| **C13** | 9 | `DetailsPane` + `DetailsHeader` + `DetailsTabs` + `DetailsMetadata` + `DetailsEmptyState` | B16 |
| **C14** | 9 | `DetailsActivity` (extrae `StudyTimeline`) + `DetailsActionDock` | C13 |
| **C15** | 9 | `DocumentViewer` a pantalla completa + `ViewerToolbar` (zoom, páginas, fullscreen, descarga, fallback) | C13 |
| **C16** | 9 | `ViewerThumbnails` | C15 |
| **C17** | 10 | **Piloto: Informes administrativos** — valida los 12 puntos de §53 | C13 |
| **C18** | 10 | Migración admin lote 1: Tokens · Clínicas · Auditoría | C17 |
| **C19** | 10 | Migración admin lote 2: Usuarios · Sesiones · Intentos fallidos | C18 |
| **C20** | 10 | Migración admin lote 3: Precios · Mantenimiento · Estado del sistema · Resumen | C19 |
| **C21** | 10 | Migración clínica lote 1: Informes (módulo + ruta completa) | C18 |
| **C22** | 10 | Migración clínica lote 2: Tokens · Logística (3 rutas) · Perfil · Operaciones | C21 |
| **C23** | 11 | Responsive: drawer/rail/sheet, detalle a pantalla completa, bottom nav, búsqueda y filtros mobile | C22 |
| **C24** | 11 | Alternancia lista/cuadrícula donde aporta valor (informes, clínicas, documentos) | C22 |
| **C25** | 12 | Microgeometría: padding, gap, baseline, offsets de icono, truncamiento, tooltips, foco (±1–2 px) | C23 |
| **C26** | 13 | Validación y rollout: regresión visual, accesibilidad, rendimiento, gates | C25 |

---

## 51. Roadmap grueso a fino

| Nivel | Contenido | PR |
|---|---|---|
| **0** | Baseline y protección | A01 – A04 |
| **1** | Desacoplamiento (canvas, limit, regiones) | A05 – A08 |
| **2** | Arquitectura de presentación | B01, B02 |
| **3** | Tokens y foundation | B03 – B05 |
| **4** | App shell (bar, drawer, rail, mobile, unificación de shells) | B06 – B10 |
| **5** | Reducción de chrome (app header, module header, hub, métricas) | B11 – B14 |
| **6** | Workspace scaffold | B15, B16 |
| **7** | Colecciones | C01 – C05 |
| **8** | Interacción (selección, toolbars, menús, filtros) | C06 – C12 |
| **9** | Paneles y visor | C13 – C16 |
| **10** | Migración de módulos | C17 – C22 |
| **11** | Responsive | C23, C24 |
| **12** | Microgeometría | C25 |
| **13** | Validación y rollout | C26 |

### 52.1 Mapeo de los 19 PR anteriores

| Anterior | Nuevo | Nota |
|---|---|---|
| SB-01 contract test | **A01** | Ampliado de 7 a 15 superficies |
| SB-02 baseline geométrico | **A02** | Ampliado a 13 × 15 |
| SB-03 desacoplar altura↔limit | **A05 + A06 + A07** | Dividido: la evidencia mostró 3 hooks y 15 módulos |
| SB-04 S5 → primitivas | **C11** | Absorbido por el subsistema de filtros |
| SB-05 S4 → primitivas | **C11** | idem |
| SB-06 origen y ancho únicos | **B15** | Ahora es responsabilidad del `WorkspaceScaffold` |
| SB-07 retirar `StickyFilterBar` | **B02** | Ampliado a 6 componentes muertos |
| SB-08 campo primario + chips | **C10 + C11** | Dividido |
| SB-09 banda 768–1023 | **C11** | Resuelto por el overflow menu |
| SB-10 `SuperSearchField` | **C10** | — |
| SB-11 chip + overflow | **C11** | — |
| SB-12 acciones homogéneas | **C11** | — |
| SB-13 tokens visuales | **B03 + B04 + B05** | Dividido; ampliado a todo el dashboard |
| SB-14 estados | **C06 + C07** | Ampliado a selección |
| SB-15 microgeometría | **C25** | Ampliado a todo el dashboard |
| SB-16 validación y rollout | **C26** | Ampliado |
| BUG-01 render condicional | **PR-BUG-01** | Sin cambio |
| BUG-02 `line-height` | **PR-BUG-02** | Sin cambio |
| BUG-03 accesibilidad semántica | **PR-BUG-03** | Sin cambio |

**Ningún PR anterior se pierde.**

---

## 52. Selección del piloto

### 53.1 Evaluación

| Candidato | Filtros | Superbuscador | Paginación adaptativa | Selección potencial | Detalle | Visor | Densidad | Riesgo | Apto |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|:-:|
| **Informes admin** | 8 campos | S3 | `limit` servidor 9–20, cap 36 | Alta (acciones masivas reales) | Visor | Sí | 35.66 px | Medio | **★ Sí** |
| Tokens admin | 7 campos | S2 | `limit` 9–17, cap 30 | Alta | No | No | 35.66 px | Medio | Alternativa |
| Auditoría | 6 campos | S1 | `limit` 9–?, cap 32 | Baja (sólo lectura) | Diálogo | No | 37 px | **Alto** (`<form>` con URL) | No |
| Clínicas | 1 campo | S4 | cliente + servidor | Media | Drawer | No | 156.5 px | Bajo | No (poca densidad) |
| Informes clínica | 7 campos | S6 | cliente | Media | Master-detail | No | 49 px | Medio | Alternativa |

### 53.2 Decisión

**Informes administrativos se confirma como piloto.** Es el único módulo que ejercita simultáneamente los doce elementos de la arquitectura: superbuscador de 8 campos con `Aplicar`/`Limpiar`, paginación adaptativa contra servidor con el mayor rango medido (9 → 20 filas según viewport) y el cap más alto (36), colección tabular, visor documental, subida de archivos y acciones por fila que justifican selección múltiple.

**Se descarta Auditoría** pese a su densidad: su `<form method="get">` con navegación de URL es el contrato más frágil del dashboard y no debe ser el primero en migrar.

### 53.3 El piloto debe validar

Tokens · `WorkspaceScaffold` · colección · toolbar · filtros · selección · detalle · menús · responsive en los 13 viewports · **`limit` invariante** · zero-scroll · suite de pruebas completa.

---

## 53. Secuencia de módulos

| Lote | Módulos | PR | Criterio de orden |
|---|---|---|---|
| Piloto | Informes admin | C17 | Máxima cobertura de arquitectura |
| Admin 1 | Tokens · Clínicas · Auditoría | C18 | Misma primitiva de filtros; Auditoría al final del lote por su contrato de URL |
| Admin 2 | Usuarios · Sesiones · Intentos fallidos | C19 | Tablas de sólo lectura, menor riesgo |
| Admin 3 | Precios · Mantenimiento · Estado · Resumen | C20 | Colecciones no tabulares, casos especiales |
| Clínica 1 | Informes (módulo + ruta completa) | C21 | Valida la unificación de shells de B10 |
| Clínica 2 | Tokens · Logística (3 rutas) · Perfil · Operaciones | C22 | Resto de la superficie de clínica |

---

## 54. Plan de PR

Estructura completa por PR: **ID · Programa · Nivel · Título · Objetivo · Alcance · No alcance · Dependencias · Archivos probables · Componentes · Invariantes · Pruebas · Screenshots · Riesgos · Rollback · Criterio de cierre.** Se resume aquí la tabla obligatoria; el detalle por PR sigue el esquema de §48–50.

| PR | Prog. | Nivel | Objetivo | Dependencias | Superficies | Riesgo | Tests | Cierre |
|---|---|---|---|---|---|---|---|---|
| A01 | A | 0 | Contrato operativo | — | 15 | Bajo | +`dashboard-operational-contract` | Falla si cambia handler/param/endpoint/default |
| A02 | A | 0 | Baseline geométrico | A01 | 15 | Bajo | +`dashboard-geometry-baseline.spec` | Verde en 13 × 15 |
| A03 | A | 0 | Baseline de `limit` | A01 | 15 | Bajo | +`adaptive-limit-baseline` | `limit` registrado por viewport |
| A04 | A | 0 | Baseline de seguridad | — | 15 | Bajo | +`dashboard-security-invariants` | Sesiones separadas, sin secretos |
| A05 | A | 1 | Reserva geométrica | A02, A03 | 15 | **Alto** | `limit-invariance` | `limit` idéntico con regiones de 32/48/64 px |
| A06 | A | 1 | Hook unificado | A05 | — | **Alto** | unit del hook | Un hook; 3 reglas equivalentes cubiertas |
| A07 | A | 1 | Migrar 15 módulos | A06 | 15 | **Alto** | `limit-invariance` × 15 | `limit` invariante en los 15 |
| A08 | A | 1 | Congelar zero-scroll | A02 | 15 | Bajo | +`zero-scroll-contract` | 0 desbordamientos en 13 × 15 |
| B01 | B | 2 | Poblar `presentation/` | A07 | — | Bajo | reglas de import | Sin imports cruzados |
| B02 | B | 2 | Retirar muertos | B01 | — | Bajo | ajustar 3 tests | `git grep` sin resultados |
| B03 | B | 3 | Tokens | B01 | — | Medio | +contract de tokens | Escalas completas, claro y oscuro |
| B04 | B | 3 | Migrar superficies; sin sombra en chrome | B03 | 15 | Medio | regresión visual | 0 sombras en chrome persistente |
| B05 | B | 3 | Invertir superficie | B04 | 7 | Bajo | regresión visual | Campo teñido, contenedor transparente |
| B06 | B | 4 | `WorkspaceAppBar` 56 px | B04 | 15 | **Alto** | E2E de shell | 56 ±2 px en 13 viewports |
| B07 | B | 4 | Drawer + Rail | B06 | 15 | **Alto** | E2E de navegación | 256/80 ±1 px; deep links intactos |
| B08 | B | 4 | Retirar nav horizontal y rail | B07, A08 | 15 | **Alto** | E2E + zero-scroll | Un solo modelo; `?module=` intacto |
| B09 | B | 4 | Unificar mobile nav | B08 | 15 | Medio | E2E mobile | Un modelo; táctiles ≥ 44 px |
| B10 | B | 4 | **Unificar shells de clínica** | B08, A07 | 10 | **Alto** | paridad de shell + `limit` | Un shell; `limit` invariante |
| B11 | B | 5 | `WorkspaceHeader` 40 px | B10 | 15 | Medio | A02 | 40 ±2 px |
| B12 | B | 5 | Retirar tarjeta de módulo | B11, B04 | 15 | Medio | regresión visual | 3 capas en vez de 4 |
| B13 | B | 5 | Hub → «Inicio» | B08 | admin | Medio | E2E de entrada | Entrada directa; hub accesible |
| B14 | B | 5 | Reubicar métricas | B11 | 15 | Bajo | regresión visual | 0 px permanentes |
| B15 | B | 6 | `WorkspaceScaffold` | B12 | 15 | **Alto** | unit + A02 | Origen y ancho únicos |
| B16 | B | 6 | `UtilitySidePanel` | B15 | 15 | Medio | unit + E2E | 336 ±2 px, colapsable |
| C01–C05 | C | 7 | Colecciones | B15 | 12 | Medio–Alto | unit + A02 + A03 | Fila 40 px; `limit` invariante |
| C06–C09 | C | 8 | Selección y menús | C01 | 12 | Medio | unit + E2E + axe | Selección por teclado completa |
| C10–C12 | C | 8 | Filtros | B15, A05 | 7 | **Alto** | contract de superbuscadores | Operativa idéntica |
| C13–C16 | C | 9 | Paneles y visor | B16 | 15 | Medio | unit + E2E | Panel reutilizable; visor a pantalla completa |
| C17 | C | 10 | **Piloto** | C13 | 1 | **Alto** | suite completa | Los 12 puntos de §52.3 |
| C18–C22 | C | 10 | Migración | C17 | 14 | Medio | suite por lote | Sin regresión funcional |
| C23–C24 | C | 11 | Responsive | C22 | 15 | Medio | E2E 13 viewports | Chrome ≤ 32 % en 768–1366 |
| C25 | C | 12 | Microgeometría | C23 | 15 | Bajo | A02 ±1 px | Dentro de tolerancia |
| C26 | C | 13 | Validación y rollout | C25 | 15 | Bajo | suite + axe + performance | Gates de §58 verdes |

**Total: Programa A (A01–A08) = 8 · Programa B (B01–B16) = 16 · Programa C (C01–C26) = 26 · Total = 50 PR.** Esta tabla agrupa varias filas de programa por fila de resumen (p. ej. `C01–C05`) para legibilidad; la enumeración completa de los 50 IDs únicos vive en §48–§50. Sumando los 5 correctivos separados de §55, el universo máximo documentado es **55 PR**.

---

## 55. Correctivos separados

| PR | Hallazgo | Objetivo | Riesgo | Clasificación |
|---|---|---|---|---|
| **PR-BUG-01** | P2-09 | Unificar la política de renderizado condicional de la barra (3 políticas distintas: siempre / `tokens.length` / `!reportsLoadError`) | Medio — es operativa: exige decisión explícita | **Obligatorio** antes de C21/C22 (S6/S7 migran con política unificada) |
| **PR-BUG-02** | P2-03 | `line-height: 12px` = `font-size` en Usuarios y roles → `line-height ≥ 1.25 × font-size` | Bajo | **Absorbible** en C25 (microgeometría) si no se ejecuta antes |
| **PR-BUG-03** | P2-04, P2-05, P2-18 | `role="search"` en las 7 barras; `aria-label` sobre elemento con rol; `aria-describedby`; live region de conteo | Bajo | **Absorbible** en C10–C12 (subsistema de filtros) |
| **PR-BUG-04** | P0-04 | *(si se decide antes del Programa B)* Alinear el shell de `/dashboard` con el de las rutas completas de clínica | **Alto** — toca el canvas medido | **Opcional**: B10 ya resuelve P0-04 dentro del roadmap principal; sólo se activa como PR-BUG-04 si se decide adelantarlo fuera de secuencia |
| **PR-BUG-05** | P2-19 | *(si se decide antes de A06)* Documentar y unificar las 3 reglas de descuento sin cambiar valores | Medio | **Opcional**: A06 ya unifica los hooks dentro del roadmap principal; PR-BUG-05 sólo aporta valor si se necesita documentación intermedia antes de A06 |

**Ninguno se mezcla con el rediseño.** PR-BUG-01 es el único correctivo obligatorio como prerrequisito de secuencia (Programa C, lote clínica 1); PR-BUG-04 y PR-BUG-05 son opcionales porque el roadmap principal (B10, A06) ya cubre su objetivo; PR-BUG-02 y PR-BUG-03 son absorbibles en PR del roadmap principal si no se ejecutan de forma independiente antes.

---

## 56. Plan de pruebas

### 57.1 Arquitectura
Reglas de import (`presentation/` no importa de `app/`) · sin llamadas API desde presentación · sin duplicación de catálogos de módulos · sin componentes muertos.

### 57.2 Contratos
Handlers · URL y query string (incluida la de Auditoría) · payloads · endpoints · **`limit` y `offset` por viewport** · permisos · estados · defaults · semántica de fechas · reset de página por control · política de renderizado condicional.

### 57.3 Unit
Primitivas de `collection/`, `filters/`, `details/`, `menus/`, `viewer/` · variantes · selección · overflow · truncamiento · `clamp` de anchura · estados disabled/loading/error/empty.

### 57.4 E2E
Navegación entre los 15 módulos · deep links `?module=` · búsqueda · filtros · selección individual y múltiple · acciones masivas · Back/Forward · recarga · cambio de viewport en caliente (verifica A05) · diálogos · menús por teclado (Tab/Shift+Tab/Enter/Escape) · visor · mobile.

### 57.5 Regresión visual
15 superficies × 13 viewports × 2 temas × estados {inicial, hover, focus, selección, filtros activos, loading, error, empty}. **Artefactos fuera de `docs/`.** Playwright borra `test-results/` al inicio de cada corrida: preservar el «antes» fuera de ese directorio.

### 57.6 Accesibilidad
`@axe-core/playwright` sobre las 15 superficies en ambos temas · roles · etiquetas · orden de tabulación · foco visible bajo `forced-colors` · contraste ≥ 4.5:1 texto y ≥ 3:1 bordes · objetivos táctiles ≥ 44 px · `prefers-reduced-motion` · anuncio de conteo por live region.

### 57.7 Rendimiento
Re-renders por interacción · hidratación · layout shift · disparos de `ResizeObserver` · peso CSS antes/después · long tasks · **número de peticiones de paginación por cambio de viewport** (detecta *thrash* de `limit`) · estabilidad en viewport corto (768 × 600).

### 57.8 Comandos (Terminal 1)

```powershell
pnpm --dir frontend lint
```

```powershell
pnpm --dir frontend typecheck
```

```powershell
pnpm --dir frontend build
```

```powershell
pnpm security:public-surface
```

Terminal 2, tras el gate de seguridad: seleccionar la **cohorte E2E mínima suficiente** según los paths y contratos realmente afectados por el PR (tabla de decisión y catálogo en AGENTS.md §7 / `frontend/e2e/suites/catalog.ts`; candidatas: `e2e:visual-contract`, `e2e:admin-mobile`, `e2e:extended`, `e2e:public-clinic`, `e2e:smoke`, `e2e:affected`).

```powershell
pnpm --dir frontend e2e:<cohorte-seleccionada>
```

> **`pnpm validate:local` es el gate de backend** (`typecheck && typecheck:test && test && build` de `server/`) y no sustituye ninguno de los cuatro comandos de frontend anteriores.
> **Ningún E2E genérico sustituye `pnpm security:public-surface`.** Es un gate estático independiente, obligatorio siempre que se toque superficie pública de frontend.
> **`pnpm --dir frontend e2e:full` (suite completa) sólo se ejecuta cuando Nico lo pide explícitamente o cuando no existe una cohorte mínima suficiente** para el contrato afectado (AGENTS.md §7).

> **Higiene obligatoria:** `pnpm e2e*` levanta `next dev`, que reescribe `frontend/next-env.d.ts`. Revertirlo antes de `pnpm test`. Si se editó CSS con el dev server caído, borrar `frontend/.next` antes de re-correr Playwright (Turbopack sirve el CSS previo a la edición).

---

## 57. Visual regression

| Dimensión | Cobertura |
|---|---|
| Superficies | 15 (11 admin + 10 clínica, descontando solapes de ruta) |
| Viewports | 13 |
| Temas | claro + oscuro |
| Estados | inicial · hover · focus · selección · filtros activos · loading · error · empty · disabled |
| Total nominal | **15 × 13 × 2 × 9 = 3 510 capturas** |
| Estrategia | Baseline completo en A02; en cada PR sólo las superficies tocadas; suite completa en C26 |
| Aprobación | Manual, con comparación lado a lado; sin aprobación automática de diferencias |

---

## 58. Gates de staging

| Gate | Condición | Cuándo |
|---|---|---|
| G1 | Contrato operativo congelado (A01 verde) | Antes de A05 |
| G2 | Baseline geométrico y de `limit` capturados (A02, A03) | Antes de A05 |
| G3 | **`limit` invariante** con regiones de 32/48/64 px (A05–A07) | Antes de B01 |
| G4 | Zero-scroll congelado (A08) | Antes de B06 |
| G5 | Tokens completos claro + oscuro (B03) | Antes de B06 |
| G6 | Sin sombra en chrome persistente (B04) | Antes de B11 |
| G7 | Un solo modelo de navegación; deep links intactos (B08) | Antes de B10 |
| G8 | Un solo app shell de clínica (B10) | Antes de B15 |
| G9 | Chrome ≤ 240 px a 1920 y ≤ 32 % en 768–1366 (B11–B14) | Antes de C17 |
| G10 | Piloto cerrado con los 12 puntos de §52.3 (C17) | Antes de C18 |
| G11 | axe sin violaciones críticas ni serias en ambos temas | Antes de C26 |
| G12 | Staging: deploy Live en el commit esperado; las 15 superficies operativas con tenants y usuarios de prueba controlados (nunca datos de una clínica real, AGENTS.md §17); evidencia sanitizada; auditoría sin secretos; sin incremento de 4xx/5xx en 48 h | Tras C26 |

---

## 59. Riesgos

| # | Riesgo | Prob. | Impacto | Programa |
|---|---|---|---|---|
| R1 | Un cambio de CSS altera el `limit` en producción | **Alta** sin A05–A07 | **Crítico** | A |
| R2 | Cubrir sólo uno de los 3 hooks deja media plataforma expuesta | **Alta** | **Crítico** | A |
| R3 | Unificar los shells de clínica altera el canvas en 10 superficies a la vez | Media | **Crítico** | B |
| R4 | Realinear tests de contrato degenera en debilitarlos | Media | Alto | Todos |
| R5 | Romper la query string de Auditoría al migrar | Media | Alto | C |
| R6 | Perder filtros al mover controles al overflow | Media | **Crítico** | C |
| R7 | Degradar accesibilidad al sustituir `select` por chip + popover | Media | Alto | C |
| R8 | Romper el contrato zero-scroll | Media | Alto | B, C |
| R9 | El tema oscuro queda sin cubrir (medición base en claro) | **Alta** | Medio | B |
| R10 | Regresión sólo visible en clínica al validar en admin | Media | Medio | C |
| R11 | Animar alturas provoca *thrash* de `ResizeObserver` → `limit` oscilante y peticiones repetidas | Baja | Alto | B, C |
| R12 | El drawer de 256 px reduce el ancho útil y rompe tablas de 8 columnas | Media | Medio | B |
| R13 | Subir la fila a 40 px reduce el `limit` a 1366 × 768 | **Alta** sin A07 | Alto | C |
| R14 | La migración de 15 módulos se alarga y convive con dos gramáticas | **Alta** | Medio | C |

---

## 60. Mitigaciones

| Riesgo | Mitigación |
|---|---|
| R1, R2 | A05–A07 son prerrequisito absoluto; test de invariancia de `limit` sobre los 15 módulos con regiones de 32/48/64 px |
| R3 | B10 sólo tras A07; baseline de `limit` de las 10 superficies de clínica antes y después |
| R4 | Prohibido eliminar aserciones; censar anclas con `git grep` antes de tocar cada archivo |
| R5 | Auditoría conserva `<form method="get">`; E2E que carga una URL con los 6 filtros y verifica el resultado |
| R6 | Contract test que enumera los filtros **alcanzables**, no los visibles |
| R7 | El popover expone `listbox`/`dialog` con teclado completo; axe en C11 y C26 |
| R8 | A08 congela el contrato; se ejecuta en cada PR desde B06 |
| R9 | B03 obliga a tokens en ambos temas; regresión visual dual desde B04 |
| R10 | Las 15 superficies en cada gate, no sólo las de admin |
| R11 | Prohibido animar alturas de región; sólo `background-color` y `opacity` |
| R12 | El rail de 80 px es el modo por defecto en 768–1279; el drawer sólo ≥ 1280 |
| R13 | C05 depende de A07; si el `limit` cae, se revierte a 36 px con justificación medida |
| R14 | Los barriles de `presentation/` reexportan lo antiguo; ambas gramáticas conviven sin romper imports |

---

## 61. Rollback

Todos los PR son revertibles con `git revert`. **Ninguno incluye migraciones ni cambios de esquema.**

| PR | Rollback | Riesgo residual |
|---|---|---|
| A01–A04, A08 | Revert directo (sólo tests) | Nulo |
| **A05–A07** | Revert restaura el acoplamiento actual, que es el estado probado en producción | Bajo |
| B01–B02 | Revert restaura los barriles y los componentes muertos | Nulo |
| B03–B05 | Revert restaura los valores CSS previos | Nulo |
| **B06–B10** | Revert por PR; B08 y B10 deben revertirse **juntos** si se revierte B08 | Medio — coordinar |
| B11–B16 | Revert directo | Bajo |
| C01–C16 | Revert por primitiva; los módulos no migrados no se ven afectados | Bajo |
| **C17–C22** | Revert por lote; los barriles permiten convivencia de ambas gramáticas | Bajo |
| C23–C26 | Revert directo | Nulo |

---

## 62. Criterios de aceptación

El programa sólo puede cerrarse cuando, simultáneamente:

1. Todo el dashboard usa una gramática visual y operativa coherente.
2. La arquitectura es comparable a un productivity workspace: app shell + drawer/rail + workspace + colección + panel.
3. App bar y navegación están unificadas (un modelo, no seis).
4. El hub deja de ser barrera obligatoria y el usuario entra al último módulo, al predeterminado o a un deep link.
5. **El chrome se reduce de forma medible:** ≤ 240 px a 1920 × 1080 y ≤ 32 % del viewport en 768–1366 (baseline: 323.28–436.19 px y 29.9–54.7 %).
6. El contenido gana superficie y las colecciones son protagonistas.
7. Selección y toolbars contextuales son coherentes en las 12 colecciones.
8. Los filtros son progresivos (campo primario + chips + overflow).
9. Los paneles de detalle son reutilizables (un `DetailsPane`, no cuatro patrones).
10. **La operativa de los 7 superbuscadores es idéntica** (A01 verde).
11. **La paginación adaptativa sigue siendo correcta y el `limit` por viewport es invariante** respecto del baseline (A03, G3).
12. No existe scroll accidental; zero-scroll se conserva en 13 × 15 (A08).
13. No se rompen permisos ni fronteras de sesión (A04).
14. No se modifica backend sin PR separado.
15. La accesibilidad no retrocede: axe sin violaciones críticas ni serias en ambos temas.
16. Mobile es plenamente operativo con objetivos táctiles ≥ 44 px.
17. Las medidas están dentro de la tolerancia de §46.
18. La regresión visual está aprobada manualmente.
19. CI está verde: backend `pnpm validate:local`; frontend `pnpm --dir frontend lint` → `pnpm --dir frontend typecheck` → `pnpm --dir frontend build` → `pnpm security:public-surface` → cohortes E2E relevantes (§56).
20. Staging está validado y existe rollback lógico para cada PR.

---

## 63. Evidencia faltante

| Dato | Estado | Medición que lo resolvería |
|---|---|---|
| Geometría en runtime de S7 (tokens de clínica) | **NO DETERMINADO CON LA EVIDENCIA DISPONIBLE** — el fixture no puebla tokens de clínica y la barra sólo se renderiza con `tokens.length` verdadero | Fixture con tokens poblados, o staging con sesión de clínica real |
| Valores en **tema oscuro** de las 15 superficies | **NO DETERMINADO** — la medición fue en claro; las capturas del propietario están en oscuro | Repetir §21–§24 con `localStorage['vetneb-theme-mode']='dark-gray'` y `emulateMedia({colorScheme:'dark'})` |
| Ratios de contraste WCAG reales | **NO DETERMINADO** — no se ejecutó axe | `@axe-core/playwright` sobre las 15 superficies, ambos temas |
| `--md-sys-color-error` / `-error-container` | **NO DETERMINADO** | Censar los tokens de error actuales en `globals.css` |
| Área de datos como % del viewport (equivalente a `dataViewport.viewportAreaPercent` de Drive) | **NO DETERMINADO** — se midió el inicio del dato, no el área | Probe que calcule el área del canvas de filas / área del viewport |
| Estado `pressed` (`:active`) de acciones, chips y filas | **NO DETERMINADO** | `page.mouse.down()` sostenido + `getComputedStyle` |
| Re-renders, hidratación, layout shift, long tasks, peso del bundle | **NO DETERMINADO** — no se perfiló | Trazas de Performance antes/después en C26 |
| Comportamiento con lector de pantalla real | **NO DETERMINADO** | Prueba manual con NVDA/VoiceOver |
| Datos de Drive sobre responsive intermedio (tablet) | **NO DETERMINADO** — el archivo sólo tiene 1920/1601 y 390 | No resoluble con la evidencia entregada |
| Viewport CSS exacto de las 5 capturas del propietario | **NO DETERMINADO** — son recortes sin metadatos | Irrelevante: el runtime lo sustituye |

**Ninguna cifra de este documento fue inventada.**

---

## 64. Conclusión técnica

El dashboard de VETNEB no está roto. Funciona, es seguro, mantiene la separación de sesiones, no expone secretos y cumple el contrato zero-scroll sin una sola excepción en las **143 combinaciones (superficie, viewport) efectivamente medidas** (muestra estratificada, §4.7). Cualquier plan que empiece diciendo lo contrario está mal informado.

Lo que sí ocurre es que su **arquitectura visible pertenece a otra categoría de producto**. Es un dashboard premium basado en hubs, tarjetas y navegación múltiple, y el objetivo declarado es un productivity workspace content-first. Esa distancia no se cierra con color, radio ni sombra: se cierra cambiando qué ocupa el espacio y quién manda en la jerarquía.

Tres conclusiones merecen quedar por escrito, porque contradicen lo que parecía evidente al empezar:

**Primera: la densidad de VETNEB no era el problema; la primera medición interpretó incorrectamente el tamaño del fixture como densidad del layout.** El registro inicial afirmó «9 filas frente a 15–16 de Drive». Las 9 filas eran el tamaño del dataset sintético del fixture. El límite adaptativo real es **19 filas a 1920 × 1080** —más que Drive— porque la fila de VETNEB mide 35.66 px frente a 48. La brecha real aparece a **1366 × 768 y 1280 × 720**, donde el chrome llega al 54.7 % y sólo caben 7–10 filas. Ésas son las resoluciones de portátil corporativo, es decir, donde probablemente trabaja la mayoría de los usuarios reales.

**Segunda: mobile ya resolvió el problema que desktop no.** El chrome mobile es del 15–27 %; el de escritorio, del 30–55 %. La migración correcta no es llevar el patrón de escritorio a mobile, sino al revés.

**Tercera: el acoplamiento entre geometría y paginación es más profundo de lo documentado.** No hay un hook adaptativo sino tres, con tres reglas de descuento distintas, repartidos entre quince módulos. Cualquier plan que trate el rediseño como un cambio de CSS enviará `limit` distintos a producción sin que nadie lo advierta. Por eso el Programa A no rediseña nada: sólo desacopla y congela. Es el trabajo menos vistoso del roadmap y el único que no se puede saltar.

A favor del proyecto juega un hecho que reduce mucho el riesgo: **la arquitectura de destino ya está andamiada**. `features/dashboard/presentation/` existe con sus siete barriles, su README describe el destino y contiene un solo componente real. No hay que inventar la estructura; hay que poblarla.

El plan resultante son 50 PR en tres programas (más 5 correctivos separados; universo máximo 55), del Nivel 0 al 13, con la operativa congelada por test antes de tocar el primer píxel, la paginación desacoplada antes de mover una región, y un piloto —Informes administrativos— que ejercita los doce elementos de la arquitectura antes de comprometer los catorce módulos restantes. Es implementable sin dependencias nuevas, sin migraciones y con rollback lógico en cada paso.
