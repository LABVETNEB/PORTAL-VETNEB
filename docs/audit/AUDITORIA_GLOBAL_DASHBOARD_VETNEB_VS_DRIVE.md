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
- **Los «15 módulos de navegación (`?module=`)» declarados en §1.1 y §2 no fueron medidos en los 13 viewports.** «Módulos de navegación» (15 = 10 IDs `?module=` de admin + 5 de clínica) y «superficies» (21 = 11 filas de §12 + 10 filas de §13, que además cuentan las rutas completas de clínica como entradas propias) son dos recuentos distintos; el inventario de §12/§13 usa «superficies», y es sobre esas 21 que se construyó la muestra estratificada anterior. **Ninguno de estos dos recuentos define el universo de A03**, que son los **15 consumidores de paginación adaptativa de §20** (§4.8, §20.1).
- **Cobertura pendiente:** las 13 superficies de la cohorte B carecen de datos en los 10 viewports restantes (1600×900, 1440×900, 1280×720, 1024×768, 834×1194, 768×1024, 430×932, 412×915, 375×812, 360×800) — 130 combinaciones no ejecutadas. Cerrarlas exige una nueva pasada de medición, no una relectura de los datos existentes.
- Toda conclusión de zero-scroll o de chrome en §1, §11, §21–§23 y §64 se limita a estas 143 combinaciones efectivamente ejecutadas; no debe leerse como cobertura de las 21 superficies en los 13 viewports.

### 4.8 Universo canónico

| Unidad | Cantidad | Definición |
|---|---:|---|
| Rutas | **7** | Rutas de Next.js distintas (§12, §13) |
| Módulos de navegación (`?module=`) | **15** | IDs `?module=` distintos: 10 admin + 5 clínica. Inventario de navegación y de contratos generales. **No es el universo de A03** (§20.1) |
| Consumidores de paginación adaptativa | **15** | Los 15 consumidores de hooks adaptativos de §20 (§40 P0-03). **Universo canónico de A03** (§20.1) |
| Superficies visibles | **21** | 11 filas de §12 (admin, incluye hub) + 10 filas de §13 (clínica, incluye rutas completas como entradas propias) |
| Combinaciones medidas | **143** | Muestra estratificada efectivamente ejecutada (§4.7) |
| Combinaciones pendientes | **130** | 13 superficies de la cohorte B × 10 viewports restantes (§4.7) |
| Matriz completa objetivo | **273** | 21 superficies × 13 viewports, no ejecutada |
| Registros primarios de A03 | **195** | 15 consumidores × 13 viewports (§20.1) |
| Observaciones hoja de A03 | **234** | 169 + 26 + 39, por los dos consumidores compuestos (§20.2) |

**Regla de selección de unidad por tipo de prueba:** las pruebas visuales y de zero-scroll (§56.5, §57) deben usar las **21 superficies** cuando la diferencia de ruta o de shell produce una superficie distinta (p. ej. Informes clínica módulo vs Informes clínica ruta completa, que comparten módulo lógico pero no shell — Hecho 3, P0-04). Los contract tests funcionales (§56.2) pueden operar sobre los **15 módulos de navegación** cuando ésa sea la unidad correcta — p. ej. el contrato operativo de un módulo lógico es el mismo con independencia de por cuál shell se acceda.

**Excepción normativa — A03.** Los **15 módulos de navegación de esta tabla no constituyen el universo de A03**, y ninguna lectura de A03 puede sustituir su universo por ellos. El universo de A03 son los **15 consumidores de hooks adaptativos de §20**, definidos como contrato normativo en §20.1–§20.5. Los dos conjuntos de 15 no coinciden: los módulos de navegación incluyen `admin-health`, `operaciones` y `perfil`, que no consumen ningún hook adaptativo, y excluyen los consumidores de `/dashboard/informes` y de `/dashboard/logistica*`, que §20 clasifica con riesgo **Alto**.

---

## 5. Matriz de skills

Las 10 skills se descomprimieron y leyeron íntegras. Comparten un bloque «Protocolo VETNEB obligatorio» aplicado transversalmente: PowerShell de sólo lectura, PNPM, sin tocar producción, sin DB manual, sin migraciones, sin dependencias nuevas, sin leer ni imprimir secretos, y **sin ejecutar `git add`/`commit`/`push`/`gh pr create`/`gh pr merge`** (operaciones manuales de Nico).

| Skill | Activada | Motivo | Evidencia de aplicación | Secciones |
|---|:---:|---|---|---|
| `briefing-planificacion-diseno-desarrollo-pruebas` | **Sí** | Estructura del briefing y anti-deriva. | Cada PR de §49–51 lleva objetivo / alcance / **no alcance** / dependencias / archivos / invariantes / tests / riesgo / rollback / criterio de cierre, que es la estructura de 10 puntos de la skill. Su bloque «Anti-deriva» obligó a separar los 5 correctivos funcionales del rediseño (§52). | 11, 49–53, 57, 63 |
| `staff-senior-full-stack-engineer` | **Sí** | Evidencia real del repo, contratos, fronteras entre capas. | «Leer archivos reales antes de modificar» produjo el Hecho 2 (tres hooks adaptativos), invisible sin abrir los tres. «No simular éxito» produjo la corrección del §1.2. Todas las referencias son `ruta:línea`. | 6, 13–21, 41–45 |
| `production-web-optimization-engineer` | **Sí** | Renderizado, reflow, ResizeObserver, densidad, CSS, sobreingeniería, escala P0–P3. | Su checklist de frontend detectó: componentes de 62–83 KB (§14), `.field-select` duplicando `Select` (§15), 3 hooks adaptativos equivalentes (§20), 17 456 B de componentes muertos (§14.3). Su regla «no introducir abstracciones innecesarias» hizo rechazar un `SuperSearchBar` monolítico (§47.3). | 15, 16, 21, 40, 48 |
| `admin-dashboard-operational-actions` | **Sí** | Acciones, filtros, botones, mutaciones, toolbars, selección. | Inventario de las 10 superficies admin con su acción real (§12); verificación en runtime de que Aplicar/Limpiar/Actualizar tienen handler; detección de que la barra de tokens de clínica desaparece con dataset vacío (§17, P2-09). | 13, 18, 20, 32–34 |
| `security-production-invariants` | **Sí** | Roles, sesiones, cookies, IDs, tokens, rutas admin, datos sensibles. | Verificación de separación `admin_session_id` / `app_session_id` en los 15 módulos verificados; ningún filtro acepta token completo («Últimos 4»); ningún `data-*` contiene lexemas sensibles; ninguna colección expone hashes. | 12, 18, 61 |
| `web-end-to-end-global` | **Sí** | Coherencia global admin + clínica, responsive, regresiones cruzadas. | Detectó el Hecho 3 (dos app shells para el rol clínica), que sólo aparece comparando `/dashboard` con `/dashboard/informes`. Motivó medir las 10 superficies de clínica además de las 11 de admin. | 13, 14, 17, 38, 57 |
| `bugs-errores-optimizacion-rutas` | **Sí (condicional)** | Persisten defectos funcionales/UX. | 5 correctivos separados en §52: `line-height` degenerado, `aria-label` sobre `div` sin rol, barra condicionada a datos, doble shell de clínica, canvas de usuarios desalineado con su `limit`. | 41–45, 53 |
| `protocolos-comunicacion` | **Sí (condicional)** | Las colecciones producen llamadas con cookies de sesión y `limit`/`offset`. | Mapa filtro → parámetro → endpoint (§7.4); trazado de `limit` a la query real (§20). | 18, 21, 56 |
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

### 14.1 Recuento

| Ubicación | Archivos | Bytes |
|---|---:|---:|
| `components/dashboard/` | 49 | 344 010 |
| `components/ui/` | 10 | 14 092 |
| `app/dashboard/admin/*.tsx` | 30 | 435 421 |
| `app/dashboard/*.tsx` (clínica raíz) | 5 | 54 028 |
| `features/dashboard/` | 14 | 18 196 |
| **Total dashboard** | **89** | ~865 000 |

### 14.2 Componentes por nivel arquitectónico

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

### 14.3 Componentes sin consumidores (código muerto verificado)

| Componente | Bytes | Evidencia |
|---|---:|---|
| `DashboardSidebarFrame.tsx` | 5 876 | Sólo lo usan `Admin/ClinicDashboardSidebar` |
| `FilterDrawer.tsx` | 5 644 | 0 usos JSX en `frontend/src` |
| `StickyFilterBar.tsx` | 2 770 | 0 usos; 2 tests **afirman su ausencia** |
| `AdminDashboardSidebar.tsx` | 1 772 | 0 usos JSX |
| `ClinicDashboardSidebar.tsx` | 1 245 | Sólo lo usa `DashboardSidebar` |
| `DashboardSidebar.tsx` | 149 | 0 usos JSX |
| **Total** | **17 456** | Cadena completa sin punto de entrada desde ninguna página |

### 14.4 Arquitectura de destino ya andamiada

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

### 15.1 Diagnóstico

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
| Mantenimiento | `useAdaptiveRowsPerPage` | `candidatesListNode` (desktop) · lista de candidatos mobile | **76** desktop / **44** mobile | no | 2 *(def.)* | — | cliente | Bajo |
| Informes clínica | `useAdaptiveRowsPerPage` | `reportsListBodyNode` | **44** | sí | 2 | — | cliente | Medio |
| Logística clínica | `useAdaptiveRowsPerPage` | `visitsListBodyNode` | **44** | no | 2 | — | cliente | Bajo |
| Tokens clínica | `useAdaptiveRowsPerPage` | body de lista | **44** | no | 2 | — | cliente | Medio |
| Logística lista reciente **· compuesto (2 variantes, §20.2)** | `useAdaptiveDashboardPageSize` | `containerRef` | variable | no | **2** | **12** | cliente | Bajo |
| Logística canvas acotado **· compuesto (3 variantes, §20.2)** | `useAdaptiveDashboardPageSize` | `containerRef` | variable | sí | `minLimit` | `maxLimit` | **servidor** (si no hay `limit` explícito) | **Alto** |

**15 módulos · 3 hooks · 3 reglas de descuento distintas.**
`useAdaptiveItemsPerPage` descuenta `headerHeightPx + safetyGapPx` (por defecto 6).
`useAdaptiveRowsPerPage` es un envoltorio con `minItems` por defecto **2**.
`useAdaptiveDashboardPageSize` descuenta `chromeHeightPx + headerHeightPx + paginationHeightPx + safetyBufferPx` (por defecto 6).

**Correcciones de runtime aplicadas antes de congelar A03.** El diagnóstico ejecutable previo a A03 encontró cuatro contratos en los que el runtime impedía observar una segunda página adaptativa completa. Se corrigieron **antes** de capturar el baseline, de modo que A03 pueda congelar comportamiento adaptativo real y no cardinalidades truncadas:

- **Mantenimiento.** Por debajo de 768 px la superficie visible paginaba con una constante fija de 3 y ningún hook adaptativo, mientras el consumidor de esta tabla sólo se montaba en `≥768 px`. La implementación mobile visible pasa a consumir `useAdaptiveRowsPerPage` sobre su propia lista de candidatos medida, con `minItems` 2 y huella de fila real (fila + gap). El consumidor adaptativo es ahora **visible y observable en los 13 viewports canónicos**; ninguna evidencia de A03 proviene de un componente oculto.
- **Logística lista reciente.** El command center recortaba ambas colecciones a 5 elementos *antes* de la paginación, por debajo del `maxItems` **12** de este mismo inventario, lo que impedía una segunda página en 1920 × 1080 y la dejaba truncada en 1600 × 900 y 1440 × 900. Ese recorte previo se eliminó: el canvas acotado recibe las colecciones ordenadas completas y sigue siendo el **único** dueño de la cardinalidad. No se modificaron `useAdaptiveDashboardPageSize`, `minItems` **2**, `maxItems` **12** ni los breakpoints.
- **Informes clínica y Logística clínica (resúmenes del workspace).** El server component de `/dashboard` obtenía un superset de 24 informes y recortaba **ambos** datasets con `slice(0, 24)` antes de entregarlos a los consumidores adaptativos. Como el `limit` medido llega a 13–16 en los viewports altos, la segunda página quedaba truncada por fin de dataset: medido 13 → 11 en 1920 × 1080, 14 → 10 en 834 × 1194 y 14 → 10 en 430 × 932 para Informes clínica; 14 → 10, 16 → 8 y 13 → 11 en 1920 × 1080, 834 × 1194 y 768 × 1024 para Logística clínica. Se retiró el cap previo: el fetch de informes pasa a una ventana hermética declarada como constante nombrada (`CLINIC_DASHBOARD_ADAPTIVE_SUPERSET_LIMIT` = **100**) y ambos workspaces reciben **completas** las colecciones obtenidas por la página. La ventana de 100 acota cuántos datos hay disponibles; **no** es un tamaño de página: `useAdaptiveRowsPerPage` sigue siendo el único dueño del `limit` visible. Los recortes `.slice(0, 3)` que alimentan `ClinicCommandCenter` se conservan intactos: pertenecen al resumen operativo compacto, que no es la superficie normativa de las filas 11 y 12 de §20.
- **Tokens admin.** La ventana inicial histórica de **30** no alcanzaba para dos páginas completas cuando `useAdaptiveItemsPerPage` medía **17** filas: 17 registros en la primera página y sólo 13 en la segunda, reproducido en 1920 × 1080 y 834 × 1194. La matriz ejecutable de los **13 viewports canónicos** confirmó 17 como máximo observado y fijó la ventana mínima nombrada `TOKENS_INITIAL_ADAPTIVE_WINDOW_SIZE` en **34** (`2 × 17`). Esta ventana sigue siendo un superset acotado —no un `page size`—: el hook adaptativo conserva la propiedad de la cardinalidad visible, el orden cliente sigue siendo el del servidor y `Cargar más` conserva su lote incremental posterior. La misma matriz demuestra 13/13 segundas páginas completas, `offset === limit`, slices exactos y cero IDs duplicados o desconocidos. **A03 aún no está congelado en esta rama**; esta corrección sólo desbloquea su captura posterior.

La ampliación deliberada de la ventana de 24 a 100 ensanchó el pager visible de `clinic-informes`. Los registros A02 específicos de Windows y Linux se realinearon de forma independiente: en ocho viewports por plataforma cambiaron únicamente `regions.pager.x` y `regions.pager.width` (16 escalares por plataforma; 32 agregados en el PR), porque el renderizado de Chromium y las métricas de fuentes difieren entre plataformas. No cambiaron las tolerancias, el schema, el DPR, el orden ni otras regiones; las otras 20 superficies permanecen intactas. A03 conserva 15 módulos, 13 viewports, 195 registros primarios y 234 observaciones hoja.

Ninguna de estas cuatro correcciones implementa A05 ni A06: no hay reserva geométrica estable, ni unificación de hooks, ni cambio de límites, breakpoints o algoritmo adaptativo (§20.5, §48).

**Correcciones adicionales descubiertas durante la captura ejecutable de A03 (pre-baseline).** La matriz completa de 15 × 13 no pudo cerrarse hasta corregir cinco defectos reales que sólo son visibles al ejercer una transición de página en los 13 viewports. Ninguno es A05 ni A06: no hay reserva geométrica, ni hook unificado, ni `limit` fijo, ni cambio de breakpoints. Son correctivos mínimos y locales que hacen **observable** el contrato ya vigente.

- **Inestabilidad del pitch de fila (cinco consumidores).** `AdminReportsCard`, `AdminMaintenanceDryRunCard`, `InformesReportsList`, `ClinicParticularTokensCard` y `LogisticsRecentListCanvas` derivaban la altura de fila de **la primera fila renderizada**. Las filas no son uniformes —el marcador «Tinción» de un informe, la línea extra de un grupo de purga no soportado, el nombre de estudio o de clínica que envuelve en un teléfono angosto—, de modo que el pitch medido dependía de **qué registros** estaban en pantalla: la página 1 y la página 2 medían alturas distintas, el tamaño de página cambiaba en plena transición y el `offset` se re-anclaba contra el `limit` cambiado. En `admin-report-upload` a 834 × 1194 un solo clic en «Siguiente» emitía **cuatro** ventanas (`17@17 → 20@17 → 20@0 → 17@0`) y terminaba de vuelta en la página 1; en los otros cuatro la segunda página volvía incompleta a 360 × 800. El pitch pasa a ser una propiedad del **layout**: se mide una vez por tamaño de la región medida, se reutiliza entre cambios de página y se vuelve a medir cuando esa región cambia de tamaño. Ningún `limit` queda fijado y ninguna cardinalidad de régimen estable cambia.
- **Precios mobile sin cardinalidad medida (paridad).** `AdminMobilePricingModule` —la única superficie de Precios visible por debajo de `md`, porque `AdminPricingEditorCard` está oculta ahí— paginaba el catálogo con la constante `CATALOG_PAGE_SIZE = 4`, de forma que el consumidor adaptativo normativo de la fila «Precios» de §20 **no era observable en 13 viewports**. El 4 sobrevive sólo como fallback previo a la medición (`CATALOG_FALLBACK_ROWS`) y la cardinalidad pasa a derivarse del canvas de catálogo realmente medido a través de `useAdaptiveRowsPerPage`, el mismo hook que ya usa el resto del dashboard. La grilla `grid-rows-4` (filas estiradas, medición autorreferencial) se sustituyó por una columna de filas dimensionadas por contenido. No cambia la API, ni la edición, ni los hooks globales.
- **Piso mínimo de Usuarios/Roles recortando el pager a 1280 × 720.** El piso desktop de nueve filas era incondicional. A 1280 × 720 la región medida es **347,09 px** y sólo entran **siete** filas, así que la novena desbordaba la región **58,41 px**, se pintaba sobre el pager y se quedaba con el hit-test de «Siguiente» (`elementFromPoint` devolvía un `TD`): con un dataset real la paginación era **inalcanzable**. El piso pasa a ser condicional a que la región pueda alojar nueve filas de verdad — `floor((containerHeight − headerHeight) / rowHeight) ≥ 9` —, decidido con la misma región medida que ya gobierna el ajuste, sin nombre de viewport, sin breakpoint de ancho y sin media query. Además la región de filas deja de llevar padding vertical propio (4 px por lado, estrictamente dentro de esta card): esos 8 px estaban **dentro** de la caja de la que se deriva el ajuste pero **fuera** del espacio utilizable, por lo que a 1366 × 768 nueve filas (32 + 9 × 41 = 401 px) desbordaban 2,81 px la región de 402,69 px mientras la aritmética las creía adentro. Resultado medido: 1280 × 720 → 7 filas, sin desbordar, pager alcanzable; **1366 × 768 → 9 filas** con desbordamiento cero; **1440 × 900 → contrato histórico intacto**. El contrato «nueve filas pobladas» (`expectNinePopulatedRows`) sigue verde en sus dos viewports.

### 20.6 Estado de A03 *(normativo)*

**A03 NO está congelado.** La matriz completa de 15 × 13 se alcanzó y se validó —**195** registros primarios, **195** claves primarias únicas, **234** observaciones hoja, **234** claves hoja únicas, **169** simples, **26** `logistics-recent-list`, **39** `logistics-bounded-canvas`, **0** filas inválidas— en corridas completas en frío, y una pareja de corridas consecutivas llegó a `DRIFT_COUNT = 0` sobre las 234 hojas. El congelado **queda retenido** por un único defecto residual, no por cardinalidad ni por cobertura.

**Defecto residual (bloqueante del congelado).** `logistics-recent-list` es intermitente en los viewports de teléfono más angostos (`w360x800`, `w375x812`, `w390x844`, `w412x915`, `w430x932`; ambas variantes, `recent-visits` y `recent-plans`). En aislamiento el canvas mide 127–143 px, las filas 50,2–51,3 px y la página resuelve **2** filas de forma estable en ambas páginas; bajo la matriz serial completa el pitch se congela ocasionalmente cerca de **40 px**, la página reclama **3** filas y la tercera queda recortada por el canvas zero-scroll, de modo que la segunda página exhibe 2 donde el contrato exige 3. Correcciones ya aplicadas que redujeron —sin eliminar— la ventana: pitch como propiedad del layout (sondeado en la primera página y sostenido al paginar), pitch como máximo de las filas realmente renderizadas, y observación por `ResizeObserver` de **las filas** además del canvas (una fila alcanza su altura final una o dos tramas después de montarse y ese crecimiento no redimensiona el canvas flex, así que la primera medición corta era la última tomada). El residuo es una carrera de asentamiento, no una diferencia de datos entre páginas.

**Regla de congelado.** No se congela A03 hasta que dos corridas completas en frío consecutivas cierren en 195/195/234/234 con `DRIFT_COUNT = 0`. No se congela desde raws parciales, ni desde la corrida favorable de un par disparejo.

**Solución preferente (§48, PR-A05):** crear una **reserva geométrica estable** — las regiones estructurales (toolbar, superbuscador, pager, encabezado) declaran su altura reservada al canvas de filas mediante variables CSS, de modo que el canvas medido sea invariante a cambios de CSS interno. El `limit` sigue adaptándose al viewport.
**Alternativa admisible (§48, PR-A06):** medición explícita por regiones (app header · module header · toolbar · filtros · resumen · rows canvas · pager) con un solo hook unificado.
**Solución prohibida:** fijar `limit = 12`, `limit = 16` o cualquier valor global. La paginación debe seguir adaptándose al viewport y al zero-scroll.

### 20.7 Estado supervisor de A05 e inversión controlada de dependencia *(2026-08-11)*

**A05 queda CLOSED por el gate supervisor.** Los **15 consumidores canónicos** declaran una reserva geométrica estable para sus regiones estructurales; el pager compartido y la barra de acción sticky publican una huella estable antes de que el canvas adaptativo derive su capacidad. Los tres hooks existentes (`useAdaptiveItemsPerPage`, `useAdaptiveRowsPerPage` y `useAdaptiveDashboardPageSize`) se preservan: A05 no los unifica, no fija un `limit`, no cambia sus breakpoints y no implementa A06 ni A07. La implementación, su oracle y el `e2e:extended` definitivo cerraron con exit 0 sobre el worktree supervisado.

La implementación verificó, en los 15 consumidores y los 13 viewports canónicos, que regiones reservadas de **32/48/64 px** y un resize en caliente conservan el `limit`, y que cambios internos de contenido no provocan refetches geométricos espurios. A06 (**hook unificado**) y A07 (**migración de los 15 consumidores al hook unificado**) permanecen **NOT_IMPLEMENTED**.

> **CORRECCIÓN (2026-08-14) — el CLOSED de esta sección se apoyaba en un oracle que no medía producción.**
> `dashboard-limit-invariance.spec.ts` **fabricaba** la reserva bajo prueba: antes de medir imponía sobre la región reservada `block-size`, `min-block-size`, `max-block-size` y `flex-basis` de 64 px con `!important`. Con la reserva impuesta por el propio test, un consumidor cuyo CSS productivo no reservaba nada medía igual una región estable, de modo que el PASSED «15/15» **no es evidencia de reserva productiva**.
> Medido contra producción real, **10 de los 15 consumidores no declaraban reserva**: `max-block-size: none` y `flex-basis: auto` con sólo un piso `min-h-*`. Reproducción exacta en `admin-users-roles @ w1920x1080`: control interno 32→48→64 px ⇒ pager 41→57→73 px, rows canvas 699.828→683.828→667.828 px (transferencia 1:1), `limit` 18→17 y **2 requests de paginación inducidos**.
> Las dos afirmaciones «los 15 consumidores canónicos declaran una reserva geométrica estable» y «Invariancia A05 · PASSED 15/15» quedan **anuladas para el estado anterior a esta corrección**. El estado vigente de A05 se registra en §20.8.

**Inversión controlada de dependencia — estado final.** El orden conceptual del roadmap mantiene A03 → A05. A05 se adelantó deliberadamente para eliminar la realimentación geométrica que impedía congelar A03. Después de integrar A05 se ejecutaron las dos capturas Linux frías requeridas sobre el mismo SHA, con 234/234 hojas, 195/195 primarios, `INVALID = 0` y observaciones contractuales deterministas entre Cold1 y Cold2. Los baselines Win32/Linux fueron realineados únicamente con las capturas reales autorizadas y la verificación posterior cerró sin drift. Por tanto, A03 queda **FROZEN / CLOSED** y A05 queda **CLOSED**. A06 y A07 permanecen **NOT_IMPLEMENTED**.

**Revisión supervisora del expected-fail de CAP-C3.** El colapso en la carga inicial no fue introducido por A05: el commit versionado `66dbda3d7e50acc30ff912f43aaaa094cce9c629` (2026-07-17), en `docs/implementation/e2e-org-5-platform-domain-organization.md`, registra que ocurre durante `page.goto`, antes de cualquier navegación por `searchParams`, reproduce con un worker y puede dejar `/dashboard/informes` limitado a una sola fila. El guard inicial queda separado del guard histórico de `searchParams` y sólo acepta esta firma: ruta `/dashboard/informes` sin query, viewport 1280 × 720, fila inicial `8401`, total 1000, `Mostrando 1-1`, página y pager `1 / 1000`, datos presentes, canvas y fila con la geometría recortada conocida, pager visible, cero error/loading/empty, cero overflow global, cero respuestas HTTP ≥500 y cero `pageerror`. Un contrato por mutaciones demuestra que `limit = 2`, datos vacíos, error, loading, canvas 0, pager ausente, overflow, ruta/query distintas, HTTP 500 o `pageerror` no arman el expected-fail. CAP-C3 cerró 6/6 con 3 pases normales, 3 expected-fails históricos y 0 fallos inesperados; el first-page repeat cerró 20 pases normales, 0 expected-fails y 0 fallos inesperados.

**Reconciliación A02 acotada.** La corrección legítima del pager de Usuarios/Roles descrita arriba dejó obsoletos únicamente sus registros Windows. Se recapturó esa superficie completa —**13 registros, 13 claves únicas**— y se realinearon sólo **8 viewports**, con **7 rutas métricas únicas** y **42 valores escalares** modificados. No hubo rebaseline global, cambios de tolerancia, cambios de schema ni cambios de provenance global; la captura queda identificada como reconciliación parcial A02 de esta fecha sobre el linaje `ceeb64d330fdca890af3c30ab0b74058b2d82124`. La matriz A02 completa volvió a cerrar en **21 superficies × 13 viewports = 273 combinaciones**.

**Reconciliación del catálogo E2E — estado final.** El árbol físico contiene **78 specs** y los **78 pertenecen al catálogo estático**; `E2E_MANUAL_ONLY_SPECS` está vacío. No existen faltantes, duplicados ni solapamientos. El catálogo vigente contiene **19 admin**, **22 clinic**, **8 public**, **2 particular**, **18 platform** y **9 regression**. Las cohortes de ejecución vigentes contienen **44 ci**, **29 extended**, **2 evidence**, **3 visual-linux** y **78 full**. `dashboard-adaptive-limit-baseline.spec.ts` forma parte del catálogo como regression/dashboard P1 y participa en `extended/full`; A03 ya no está en estado pre-freeze ni manual-only.

Evidencia de cierre observada en este worktree:

| Gate | Resultado |
|---|---|
| Arquitectura / verificación de catálogo | **PASSED** · 6/6 + 6/6 · exit 0 |
| A02 Usuarios/Roles, captura dirigida y post-reconciliación | **PASSED** · 13 registros únicos · exit 0 |
| A02 completo | **PASSED** · 21/21 superficies · 273/273 combinaciones · exit 0 |
| Unit A05 | **PASSED** · 12/12 · exit 0 |
| Invariancia A05 | **PASSED** · 15/15 consumidores · 13 viewports · 32/48/64 px + hot resize · exit 0 |
| CAP-C3 supervisor | **PASSED** · 6/6 · 3 normales + 3 expected-fails históricos + 0 inesperados · exit 0 |
| CAP-C3 first-page repeat | **PASSED** · 20 normales + 0 expected-fails + 0 inesperados · exit 0 |
| E2E `extended` supervisor de esta etapa histórica | **PASSED** · 28 specs · 222 tests · 222 expected + 0 unexpected · evidencia anterior al cierre definitivo de A03 |
| E2E `affected` conservador | **NOT_RUN** · el correctivo quedó limitado al readiness de un spec; no cambió helper, catálogo ni infraestructura compartida |
| Frontend lint / typecheck | **PASSED** · exit 0 / exit 0 |
| Frontend build / `security:public-surface` | **PASSED** · evidencia previa del mismo worktree, no invalidada; no reejecutados durante esta continuación |

Las dos corridas supervisoras previas fallaron únicamente en `admin-users-visual-quality-gate.spec.ts`, estados iniciales mobile 390 × 844 y 430 × 932. El fallo real no era una colección asentada en cero: la aserción prematura observaba `rewrittenUrls.length === 0` unos milisegundos después de que el wrapper móvil ya fuera visible, antes de que el `useEffect` cliente emitiera `/api/admin/users-roles`. En aislamiento, la compilación más lenta ocultaba la carrera. El readiness del spec registra ahora, antes de navegar, la respuesta GET de `/api/admin/users-roles` ya reescrita con `dataset=high-volume`, exige respuesta HTTP exitosa y sólo después evalúa estado, primera fila y métricas asentadas. Se preservan `rewrittenUrls.length > 0`, la comprobación de `dataset=high-volume`, `rowCount > 0` y todas las aserciones de total, paginación y geometría; no se añadieron retries, sleeps, tolerancias ni timeouts.

El correctivo cerró **2/2** casos dirigidos, **15/15** estados del spec completo y **150/150** ejecuciones del spec con `--repeat-each=10`, todos con cero fallos inesperados y exit 0. El único `e2e:extended` posterior cerró **28 specs / 222 tests / 222 expected / 0 unexpected**, exit 0. El guard supervisor CAP-C3 permanece fail-closed y sin cambios. Por ello, en esta etapa histórica, A05 quedó **CLOSED** y A03 todavía estaba **OPEN / NOT FROZEN**; el cierre definitivo posterior de A03 se documenta en §20.8 y en la reconciliación final de esta sección. A06/A07 seguían **NOT_IMPLEMENTED**.

### 20.8 Reserva de pager adoptada en producción y A05 re-medido *(2026-08-14)*

**Oracle.** `dashboard-limit-invariance.spec.ts` dejó de escribir sobre la región reservada. Muta **sólo el control interno** (32/48/64 px) y **lee** la reserva: `PAGER_BLOCK_SIZE`, `PAGER_COMPUTED_BLOCK_SIZE`, `PAGER_MIN_BLOCK_SIZE`, `PAGER_MAX_BLOCK_SIZE`, `PAGER_FLEX_BASIS`, `ROWS_CANVAS_BLOCK_SIZE`, `LIMIT` y `PAGINATION_REQUESTS`. La invariancia de la reserva es ahora una aserción propia, además de las de canvas y `limit`.

**Producción.** Los 10 consumidores del defecto adoptan la reserva canónica exacta declarada por la primitive (`--dash-adaptive-pager-reserved-block-size` + `block/min/max-block-size`, aplicada inline porque las utilidades de Tailwind ganan a la capa `components`). Tres magnitudes, todas derivadas de tokens existentes y ninguna inventada:

| Reserva | Valor | Consumidores |
|---|---|---|
| `DASHBOARD_PAGER_RESERVATION` | `var(--dash-pagination-h, 2.5rem)` | pagers de pie con controles ≤32 px |
| `DASHBOARD_TOUCH_PAGER_RESERVATION` | `max(var(--dash-pagination-h, 2.5rem), 2.5rem)` | pagers con target táctil `h-9` (piso `min-h-10` ya declarado) |
| `DASHBOARD_INLINE_PAGER_RESERVATION` | `var(--dash-control-h, 2rem)` | cluster prev/next embebido en la toolbar (Clínicas) |

Los targets táctiles **no se redujeron**: los guards `admin-mobile-ops-pager-canonical-layout` y `admin-mobile-core-pager-canonical-layout` fijan `h-9` (≥36 px) deliberadamente, así que la reserva se dimensiona al control y no al revés.

| Gate | Resultado |
|---|---|
| A05 invariancia 32/48/64 (oracle corregido) | **PASSED** · 15/15 consumidores · 13 viewports · reserva, canvas y `limit` invariantes · 0 requests inducidas |
| A05 aserción `hot A → B → A` de `admin-maintenance` | **FLAKY** (no es la reserva) · ver nota |
| Unit + arquitectura (`test/unit/ui`, `test/architecture`) | **2041/2045** · 3 fallos preexistentes ajenos al cambio |
| `e2e:visual-contract` | **PASSED** · 277 · exit 0 |
| `e2e:admin-mobile` | **PASSED** · 133 · exit 0 |
| lint / typecheck / build / `security:public-surface` | **PASSED** · exit 0 |
| A03 cold-1 + cold-2 | 234/234 hojas · **DRIFT_COUNT = 0** |

**A02 y A03 recapturados (win32, 2026-08-14).** Los dos fixtures se habían capturado por última vez en `df8d93b3`; después, dentro del mismo PR, aterrizaron `776e1b17` (*pitch-locked capacity engine as single owner*, que crea `computeCapacity.ts`) y `8ab5a361` (*model the collapsed row border in capacity*), que cambian deliberadamente el pitch de fila y la aritmética de capacidad. Ambos baselines quedaron obsoletos frente a su propia rama, y a ese delta se sumó después el de la reserva de pager.

**El entorno quedó exonerado por control ejecutado, no por suposición.** Con el árbol productivo puesto en `df8d93b3` mediante intercambio reversible de contenido de archivo (sin comandos Git destructivos, restauración verificada byte-idéntica), esta máquina reprodujo los contratos anteriores **exactamente**:

| Estado del árbol | A02 | A03 (hojas distintas) |
|---|---|---|
| `df8d93b3` (commit de la captura anterior) | PASSED 21/21 · exit 0 | 0/234 · 16/16 · exit 0 |
| HEAD sin el fix de pager | FAILED · 11 superficies · 348 filas | 118/234 |
| HEAD con el fix de pager | FAILED · 12 superficies · 363 filas | 120/234 |

Atribución del delta: **entorno 0**; commits post-captura del PR **11 superficies A02 y 118/234 hojas A03**; reserva de pager **1** superficie A02 (`admin-precios`: `regions.pager.height` 42.59→36 px, el pager pasa a reservar el token canónico) y **11/234** hojas A03.

Recaptura ejecutada con el mecanismo versionado, sin editar números a mano:

| Gate posterior a la recaptura | Resultado |
|---|---|
| A02 capture (`VETNEB_A02_GEOMETRY_CAPTURE=1`) | PASSED · 21/21 · 273 registros · exit 0 |
| A02 verificación sin capture mode | **PASSED · 21/21 · 273/273 · exit 0** |
| A03 cold-1 | **PASSED · 16/16 · 234/234 hojas · 195/195 primarios · exit 0** |
| A03 cold-2 | **PASSED · 16/16 · 234/234 hojas · 195/195 primarios · exit 0** |
| A03 `DRIFT_COUNT` / `FULL_OBSERVATION_DIFF_COUNT` / `INVALID` | **0 / 0 / 0** |
| Guard `A03 frozen baseline is complete, exact and source-backed` | **PASSED** |

**Nota sobre el `hot A → B → A` de `admin-maintenance`.** Es una aserción distinta de la invariancia de la reserva y **no** la involucra: en `w1366x768` el pager mide 36 px con `max-block-size: 36px` en las cinco lecturas, y 32/48/64 px dan canvas 328 px y `limit` 4 de forma invariante. Lo que falla es que, al volver del viewport B, el canvas de filas no reexpande (328 → 244 px) y el `limit` cae 4 → 3. Incidencia observada: falla 2/2 corridas completas, **pasa 2/2 en aislamiento** (47,5 s) y pasó 2 corridas completas anteriores sobre el mismo código productivo, con la convergencia declarando dos firmas idénticas consecutivas sobre la lista aún incompleta. Es fragilidad sensible a carga del camino de *thrash* por cambio de viewport que §56.7 ya registra, agravada por el `prepare` asíncrono del módulo (re-ejecuta el dry-run). No se debilita la aserción, no se toca producción para compensarla y no se marca skip: queda declarada como riesgo residual con su firma exacta.

Se preservaron orden de registros, schema, tolerancias, `baseCommit` y provenance; sólo se movieron los números win32 y `capturedAt`. `platformObservations` de A03 vuelve a `{}`: el set Linux venía del mismo commit obsoleto y no puede recapturarse desde win32, así que se retira en lugar de conservarse como contrato congelado a sabiendas incorrecto — con ello el guard versionado que exige `platformObservations: {}` vuelve a verde **sin debilitar ninguna aserción**, y una corrida Linux falla cerrada con el mensaje del propio spec. El set Linux de A02 queda intacto y **sigue obsoleto**: es riesgo residual declarado, no cubierto por esta tarea.

**La unidad canónica de A03 son los 15 consumidores de hooks adaptativos inventariados en la tabla anterior**, los mismos que §40 P0-03 referencia como «15 consumidores (§20)» y que el Hecho 2 de §1.3 cuenta como «15 módulos con 15 pares (fila, fallback, cap) distintos».

Los 15 IDs `?module=` de §4.8 son un inventario de navegación y de contratos generales: **no constituyen el universo de A03**. Queda excluida toda lectura por la cual A03 pueda interpretarse sobre ese conjunto.

**Registro normativo de `moduleId`.** Los siguientes son los **únicos 15 `moduleId` válidos para A03**, en el **orden canónico del baseline**:

| Fila §20 | Consumidor | `moduleId` normativo |
|---:|---|---|
| 1 | Auditoría | `admin-audit-log` |
| 2 | Informes admin | `admin-report-upload` |
| 3 | Tokens admin | `admin-particular-tokens` |
| 4 | Clínicas | `admin-clinics` |
| 5 | Usuarios y roles | `admin-users-roles` |
| 6 | Sesiones | `admin-sessions` |
| 7 | Intentos fallidos | `admin-failed-login-alerts` |
| 8 | Precios | `admin-pricing` |
| 9 | Informes — ruta completa | `informes-reports-list` |
| 10 | Mantenimiento | `admin-maintenance` |
| 11 | Informes clínica | `clinic-informes-summary` |
| 12 | Logística clínica | `clinic-logistica-summary` |
| 13 | Tokens clínica | `clinic-particular-tokens` |
| 14 | Logística lista reciente | `logistics-recent-list` |
| 15 | Logística canvas acotado | `logistics-bounded-canvas` |

Reglas normativas de este registro:

- Éstos son los **únicos 15 `moduleId` válidos** para A03; no existe ningún otro.
- **No** se permite derivarlos de labels traducidos, de rutas ni de nombres de componentes: el literal de esta tabla es la única fuente.
- El orden de la tabla es el **orden canónico del baseline**.
- Cada `moduleId` debe generar **exactamente 13 claves primarias**, una por viewport canónico.
- Toda clave desconocida —`moduleId`, `viewportSlug` o `variantId` no declarados— debe **fallar de forma cerrada**.
- Los `variantId` existen **sólo** para los módulos compuestos definidos en §20.2 (`logistics-recent-list`, `logistics-bounded-canvas`).
- Los `variantId` **no sustituyen ni modifican** el `moduleId`: refinan la identidad de la observación hoja, no la del registro primario.

Matriz primaria de A03 — invariante:

| Magnitud | Valor |
|---|---:|
| Módulos canónicos | **15** |
| Viewports canónicos (§4.7) | **13** |
| Registros primarios | **195** |
| Claves primarias únicas | **195** |
| Observaciones hoja | **234** |

Cada módulo aparece exactamente **13** veces; cada viewport, exactamente **15**.

Esquema de identidad:

```text
clave primaria     = moduleId::viewportSlug
identidad de hoja  = moduleId::viewportSlug::variantId
```

### 20.9 A06 y A07 cerrados por el guard de completitud *(2026-08-17)*

Esta subsección **no revisa ni reescribe** §20.7 ni §20.8: registra el estado posterior. En los
puntos temporales de aquellas subsecciones, A06 y A07 estaban efectivamente `NOT_IMPLEMENTED`.

**A06 = CLOSED.** Clasificación: `A06_ALREADY_IMPLEMENTED_BY_OPTION_D`. El hook unificado no se
implementó como PR-A06 independiente: Option D lo entregó como `useDashboardCanvasCapacity`
(`frontend/src/hooks/useDashboardCanvasCapacity.ts`) sobre el motor puro
`frontend/src/lib/dashboard/capacity/computeCapacity.ts`. Un único propietario de capacidad, con
regiones declaradas y pitch bloqueado, es exactamente el objetivo de A06 (§48, «un solo hook
unificado»). No se reimplementa nada: A06 se cierra por evidencia de lo ya integrado.

**A07 = CLOSED.** Estado previo: `A07_RUNTIME_COMPLETE_GUARD_INCOMPLETE`. El runtime ya estaba
migrado; lo que faltaba era demostrarlo de forma **fail-closed**. El guard
`test/architecture/dashboard-capacity-single-owner.test.ts` descubría a los consumidores por
auto-discovery, lo cual prueba que quien adoptó el propietario cumple el contrato, pero **no**
que lo hayan adoptado todos los normativos. Ese era el único gap.

| Censo A07 | Valor |
|---|---|
| Runtime migrado | **15/15** `moduleId` normativos |
| Owners físicos | **17/17** archivos |
| Consumidores legacy ejecutables | **0** |
| Motores de capacidad | **1** |
| Guard de completitud | **PASSED** |

Los 15 módulos resuelven a 17 owners porque `admin-pricing` y `admin-maintenance` renderizan
presentaciones desktop y móvil mutuamente excluyentes, cada una con su propio canvas acotado.

Los cinco propietarios legacy (`useAdaptiveItemsPerPage`, `useAdaptiveRowsPerPage`,
`useAdaptiveDashboardPageSize`, `createAdaptiveRowPitchCalibrator`, `adaptiveRowPitchCalibration`)
no tienen **ninguna** referencia ejecutable en `frontend/src`: las tres ocurrencias restantes son
prosa del comentario de cabecera del propio hook propietario.

**Lo que añade el contrato de completitud.** Los 15 `moduleId` se leen del registro canónico A03
(`frontend/e2e/helpers/dashboard-adaptive-limit-matrix.ts`), no se recopian: una segunda lista
escrita a mano derivaría en silencio, que es justamente el fallo que el contrato existe para
detectar. Sobre esa base se exige cardinalidad exacta (15 ids · 17 owners), ausencia de duplicados
en ambos ejes, orden canónico, existencia física de cada owner, adopción del hook por cada owner, y
—en las dos direcciones— igualdad entre el conjunto descubierto y el conjunto normativo.

Fail-closed demostrado por control de mutación, no afirmado:

| Mutación | Resultado |
|---|---|
| Se borra un `moduleId` normativo del censo | **FAIL** · 3 aserciones (registro, cardinalidad, owner descubierto no declarado) |
| Un owner declarado no existe en disco | **FAIL** · 2 aserciones |
| Un owner declarado no adopta el hook | **FAIL** · 2 aserciones |

**Retiro legacy verificado sobre todo el árbol** *(corrección posterior al review P2)*. La aserción
de segunda ruta de capacidad recorría **sólo** el conjunto descubierto, lo que dejaba el retiro
demostrado únicamente allí donde el propietario ya había sido adoptado: un helper nuevo podía
reintroducir un propietario legacy, quedar fuera del conjunto descubierto por esa misma razón y
mantener el guard en verde. Ahora recorre `ALL_SOURCE_FILES` sobre código sin comentarios, de modo
que el retiro es una propiedad del **árbol completo** y no del subconjunto migrado. Control de
mutación: un archivo de `frontend/src` que referencia `useAdaptiveRowsPerPage` sin adoptar el
propietario **pasaba** el guard anterior (16/16, exit 0) y **falla** el actual, nombrando archivo y
propietario.

Como efecto colateral deseado, las aserciones preexistentes del guard (observadores, scroller
interno, reserva de pager, bloqueo al pitch) quedan ancladas a un conjunto ahora **probadamente
completo**, no sólo al conjunto que se hubiera descubierto.

**A04 = PENDING.** Esta tarea no lo toca. El baseline de seguridad de A04 (separación de sesión,
ausencia de secretos, `data-*` sin lexemas sensibles) sigue fuera de alcance.

Alcance deliberadamente excluido: no se modificó runtime, CSS, el baseline A03, A05, backend, DB,
CI ni dependencias. El diff es un único archivo de test más este registro documental.

### 20.2 Consumidores compuestos y conteo de observaciones *(normativo)*

Las filas 14 y 15 de §20 son **consumidores compuestos**: un único consumidor del hook con varias instancias o rutas reales, cada una con su propio contenedor medido y su propio contrato. El registro primario de cada combinación módulo/viewport contiene una **colección tipada de observaciones hoja**, una por variante. Está prohibido seleccionar arbitrariamente una única instancia o ruta y está prohibido agregar sus valores por mínimo, máximo, promedio o primer elemento (§20.5).

| Fila §20 | `moduleId` | `variantId` obligatorio | Instancia o ruta real |
|---|---|---|---|
| 14 · Logística lista reciente | `logistics-recent-list` | `recent-visits` | `/dashboard/logistica` — lista «Visitas de campo» |
| 14 · Logística lista reciente | `logistics-recent-list` | `recent-plans` | `/dashboard/logistica` — lista «Planes de ruta» |
| 15 · Logística canvas acotado | `logistics-bounded-canvas` | `bounded-visitas` | `/dashboard/logistica/visitas` |
| 15 · Logística canvas acotado | `logistics-bounded-canvas` | `bounded-rutas` | `/dashboard/logistica/rutas` |
| 15 · Logística canvas acotado | `logistics-bounded-canvas` | `bounded-metricas` | `/dashboard/logistica/metricas` |

Los otros **13** módulos tienen exactamente **una** observación hoja por registro primario.

Desglose obligatorio de las observaciones hoja:

| Origen | Cálculo | Observaciones |
|---|---|---:|
| 13 módulos simples | 13 × 13 viewports | **169** |
| `logistics-recent-list` | 2 variantes × 13 viewports | **26** |
| `logistics-bounded-canvas` | 3 variantes × 13 viewports | **39** |
| **Total** | | **234** |

Las variantes **no** crean `moduleId` adicionales ni claves primarias adicionales: el universo primario permanece en 15 `moduleId` y 195 claves primarias.

### 20.3 Punto temporal de observación *(normativo)*

El baseline **no** registra el fallback previo a la medición adaptativa, ni ningún valor anterior a `ResizeObserver`, al layout o a la convergencia de la medición, ni el primer request transitorio. Para cada combinación (módulo, variante, viewport):

1. cargar el estado hermético representativo;
2. esperar readiness semántica;
3. esperar la convergencia de la medición adaptativa, sin sleeps fijos;
4. partir desde la primera página;
5. ejecutar **exactamente una** transición válida hacia la página siguiente;
6. esperar la estabilización del contrato resultante;
7. registrar el `limit` y el `offset` efectivos de esa **segunda página**.

Prohibido usar `waitForTimeout`, sleeps, retries o promedios para decidir la estabilidad. Que un cambio de viewport pueda producir más de un request de paginación es un hecho reconocido (§56.7, *thrash* de `limit`): A03 lo **registra**, no lo corrige (§20.5).

### 20.4 Origen semántico del contrato *(normativo)*

Cada observación hoja declara su fuente mediante una **unión discriminada** de exactamente tres variantes:

**1 · `server-request`** — consumidores cuya paginación efectiva se transmite al servidor. Registra: el request final estable provocado por la transición de página, el endpoint, el método, el `limit` real, el `offset` real y provenance suficiente para asociar el request a su módulo, variante y viewport.

**2 · `url-query`** — consumidores cuya paginación efectiva se expresa en la URL. Registra: el `pathname`, la query final estabilizada, el `limit` real, el `offset` real y provenance suficiente.

**3 · `client-slice`** — consumidores paginados íntegramente en cliente. Registra, desde una ejecución real: la cantidad efectiva de elementos de la segunda página, el `limit` efectivo, el índice base cero del primer elemento renderizado, ese mismo índice como `offset`, los identificadores ordenados del fixture que demuestran la posición de la porción, y provenance suficiente.

**Significado de `offset` en `client-slice`.** No implica que el runtime exponga una variable o un parámetro llamado `offset`. Significa el **índice base cero observable del primer elemento de la porción cliente después de una transición real de página**. Prohibido registrar `offset: null`; prohibido asumir `offset: 0`; prohibido derivar el valor exclusivamente de una tabla estática o de la lectura del código. El fixture debe contener elementos suficientes para que la segunda página sea **completa** y el `limit` pueda observarse sin truncamiento por final de dataset.

**Tokens admin y derivas registradas por A01.** En los consumidores donde el request obtiene un *superset* y el paginado adaptativo ocurre en cliente — caso de Tokens admin, deriva **D-03** de A01 — la fuente de A03 es `client-slice`: el `limit` de A03 es el tamaño de página adaptativo efectivo y el `offset` de A03 es el índice observable de inicio de la porción cliente. El límite fijo o *cap* del request de superset **no** reemplaza el contrato adaptativo. La deriva existente se conserva y se referencia; A03 no la corrige.

### 20.5 No normalización y frontera con A05/A06 *(normativo)*

Queda prohibido, dentro de A03: elegir sólo la primera instancia de un consumidor compuesto; seleccionar una ruta «representativa» sin medir las demás; aplicar mínimo; aplicar máximo; calcular promedio; colapsar las variantes a un único valor; expandir el universo primario a 18 `moduleId`; convertir las variantes en módulos nuevos; fijar globalmente un `limit`; y corregir offsets, hooks o paginación.

A03 **sólo captura el comportamiento existente**. No implementa reserva geométrica estable, nuevos breakpoints, corrección del algoritmo adaptativo, unificación de hooks, cambio de límites, cambio de `offset`, deduplicación de requests, prevención de *thrash*, ni ninguna corrección de A05 o A06. A03 depende de A01 y conceptualmente precede a A05 y A06 (§48); la excepción operativa controlada que adelantó A05 para desbloquear el freeze se documenta en §20.7 y no congela A03. Las incoherencias que A03 descubra se **registran y documentan como riesgo**; no se corrigen en A03.

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

### 22.1 Descomposición vertical — Informes admin, 1920 × 1080

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

### 22.2 Chrome por viewport (% del alto del viewport antes de la primera fila)

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

### 25.1 Condiciones de captura

| Grupo | Viewport CSS | DPR | Estados | Uso |
|---|---|---:|---|---|
| **Principal** | **1920 × 911** | 1 | 04, 08–18 | Todas las cifras de destino |
| Secundario | 1601 × 747 | 1.2 | 02, 03, 05–07, H01, MU | Verificación de invariancia de ancho |
| Excluido | 1920 × 911 | 1 | 19, 20 (visor PDF, tema oscuro) | Sólo §35 (visor) |
| Mobile | **390 × 844** | 2 / 3 | 01–07 | §37 (responsive) |

### 25.2 Valores canónicos

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

### 25.3 Limitaciones de comparación

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
| **P0-03** | Tres hooks adaptativos con tres reglas de descuento | `useAdaptiveItemsPerPage.ts`, `useAdaptiveRowsPerPage.ts`, `useAdaptiveDashboardPageSize.ts`; 15 consumidores (§20) | Un desacoplamiento parcial deja la mitad del dashboard expuesta | Unificar en un hook con regiones declaradas | Test de invariancia sobre los 15 consumidores (universo canónico de A03, §20.1) | Un solo hook; los 15 consumidores con `limit` invariante |
| **P0-04** | Dos app shells para el rol clínica | `/dashboard` topbar 55.33 + rail 39.39; `/dashboard/informes` topbar 92.33 + hnav 37 (§13, §21) | Unificar el shell cambia el canvas medido en **ambas** rutas → doble riesgo de `limit` | Unificar tras P0-03, con baseline de `limit` en las 10 superficies de clínica | E2E de paridad de shell | Un solo shell; `limit` invariante en las 10 |

---

## 41. Hallazgos P1

| ID | Título | Alcance | Evidencia |
|---|---|---|---|
| P1-01 | Tres implementaciones de superbuscador (+ 3 orígenes y 3 anchos) | 7 superbuscadores | `AdminUsersRolesReadOnlyCard.tsx:540-605` (sin primitiva, `div` + `.field-select`); `AdminClinicsManagementCard.tsx:606-620` (sin primitiva, `<input>` suelto); las 5 superficies restantes usan `FilterBar` (§7.1); 3 orígenes/3 anchos medidos en runtime al mismo viewport — x = 26.39/27.39/43.39, ancho = 1833.22/1865.22/1867.22 (§24, §26) |
| P1-02 | Colapso de densidad de filtros en 768–1023 px (42–60.5 → 117–155) | 5 superbuscadores | Medición anterior, reconfirmada |
| P1-03 | Sin campo de búsqueda primario; reparto fraccional 180–394 px | 7 superbuscadores | `AdminAuditFilterBar.tsx:61` (`lg:grid-cols-[minmax(11rem,1.4fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_auto_auto]`), `AdminReportsCard.tsx:538` (`xl:grid-cols-[0.8fr_1fr_0.95fr_0.95fr_0.9fr_0.9fr_0.85fr_0.85fr_auto_auto]`) y plantillas fraccionales equivalentes en S2/S6/S7 (§7.1): ningún superbuscador reserva una columna dominante, los 7–9 campos comparten fracciones (`0.8fr`–`1.4fr`) del mismo ancho de banda. El rango de 180–394 px por campo resulta de resolver esas fracciones sobre el ancho de banda medido en runtime (1833.22–1867.22 px, §24, §26) |
| **P1-04** | **Chrome vertical (CORREGIDO)**: 29.9–54.7 % vs 19.2 %; peor en 1366×768 y 1280×720 | Todo el dashboard | §22; corrige la cifra «9 filas» del baseline |
| P1-05 | Usuarios y roles + Clínicas no usan las primitivas | 2 módulos | `AdminUsersRolesReadOnlyCard.tsx:540-605` — `div` con `flex` + `.field-select` (`globals.css:374`, radio 8 px, fondo `rgb(248,251,252)`, sombra doble) en vez de `FilterBar`/`Select`; `AdminClinicsManagementCard.tsx:606-620` — `<input>` suelto de `components/ui/input.tsx`, sin `FilterBar` ni región nombrada. Primitiva compartida por las 5 superficies restantes: `FilterBar.tsx` (S1/S2/S3/S6/S7, §7.1) |
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

### 45.1 Tokens dashboard-scoped

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

### 45.2 Escalas

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

### 47.1 Destino

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

### 47.2 Destino de cada componente actual

| Acción | Componentes |
|---|---|
| **Conservar y mover** | `DashboardShellRouter`, `PrivateDashboardShell`, `ModuleSurface`, `ModuleDialog`, `ModuleTabs`, `usePagedRows`, `DashboardPager`, `CompactPager`, `EmptyState`, `ErrorState`, `LoadingState`, `StatusBadge`, `FilterBar`, `ui/*` |
| **Fusionar** | 9 de navegación → `NavigationDrawer` + `NavigationRail` + `MobileNav` · 3 hooks adaptativos → 1 · `mobile-admin.css` + `mobile-clinic.css` → `responsive.css` |
| **Extraer de monolitos** | `DetailsPane` (de `ClinicInformesWorkspaceSummary`, `AdminAuditDetailDialog`, `ClinicEditDrawer`) · `CollectionWorkspace` (de las 6 cards de tabla) · `SelectionToolbar` (nuevo) |
| **Degradar** | `DashboardModuleHub` + `DashboardHubHero` → «Inicio» opcional, no puerta |
| **Retirar** | `DashboardSidebar`, `AdminDashboardSidebar`, `ClinicDashboardSidebar`, `DashboardSidebarFrame`, `StickyFilterBar`, `FilterDrawer` (17 456 B) |
| **Reexportar durante la migración** | Barriles de `presentation/*` reexportan desde `components/dashboard/` hasta que el último consumidor migre |

### 47.3 Abstracciones rechazadas

- **`SuperSearchBar` monolítico:** necesitaría props para mecanismo de submit, presencia de cada acción, política de renderizado condicional, política de etiquetas, reset por control y plantilla de columnas. API inmanejable. **Rechazado.**
- **`CollectionWorkspace` con fetch integrado:** acoplaría presentación y API. La colección recibe datos y callbacks; nunca llama al backend.
- **Unificar el mecanismo de consulta de los 7 superbuscadores:** S1 usa navegación de URL y el resto handlers de cliente. Es **operativa protegida**: no se unifica.

---

## 48. Programa A — Contratos y desacoplamiento

**Objetivo:** permitir una transformación visual profunda sin cambiar accidentalmente la operativa.

| PR | Nivel | Objetivo | Dependencias |
|---|---|---|---|
| **A01** | 0 | Baseline de contrato operativo de los 15 módulos (handlers, params, endpoints, defaults, reset de página) | — |
| **A02** | 0 | Baseline geométrico E2E: 21 superficies × 13 viewports (273 combinaciones), con tolerancias | A01 |
| **A03** | 0 | Baseline de `limit`/`offset` por módulo, variante y viewport sobre los **15 consumidores de §20** — no sobre los IDs `?module=` de §4.8: 195 registros primarios y 234 observaciones hoja; contrato normativo en §20.1–§20.5 | A01 |
| **A04** | 0 | Baseline de seguridad: separación de sesión, ausencia de secretos, `data-*` sin lexemas sensibles | — |
| **A05** | 1 | **Reserva geométrica estable**: las regiones estructurales declaran altura reservada; el canvas de filas queda invariante al CSS interno | A02, A03 |
| **A06** | 1 | Unificar los 3 hooks adaptativos en uno con regiones declaradas | A05 |
| **A07** | 1 | Migrar los 15 módulos al hook unificado, con `limit` invariante demostrado | A06 |
| **A08** | 1 | Congelar el contrato zero-scroll como test de 21 superficies × 13 viewports (273 combinaciones) | A02 |

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

### 51.1 Mapeo de los 19 PR anteriores

| Anterior | Nuevo | Nota |
|---|---|---|
| SB-01 contract test | **A01** | Ampliado de 7 a 15 módulos |
| SB-02 baseline geométrico | **A02** | Ampliado a 21 × 13 (273 combinaciones) |
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

### 52.1 Evaluación

| Candidato | Filtros | Superbuscador | Paginación adaptativa | Selección potencial | Detalle | Visor | Densidad | Riesgo | Apto |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|:-:|
| **Informes admin** | 8 campos | S3 | `limit` servidor 9–20, cap 36 | Alta (acciones masivas reales) | Visor | Sí | 35.66 px | Medio | **★ Sí** |
| Tokens admin | 7 campos | S2 | `limit` 9–17, cap 30 | Alta | No | No | 35.66 px | Medio | Alternativa |
| Auditoría | 6 campos | S1 | `limit` 9–?, cap 32 | Baja (sólo lectura) | Diálogo | No | 37 px | **Alto** (`<form>` con URL) | No |
| Clínicas | 1 campo | S4 | cliente + servidor | Media | Drawer | No | 156.5 px | Bajo | No (poca densidad) |
| Informes clínica | 7 campos | S6 | cliente | Media | Master-detail | No | 49 px | Medio | Alternativa |

### 52.2 Decisión

**Informes administrativos se confirma como piloto.** Es el único módulo que ejercita simultáneamente los doce elementos de la arquitectura: superbuscador de 8 campos con `Aplicar`/`Limpiar`, paginación adaptativa contra servidor con el mayor rango medido (9 → 20 filas según viewport) y el cap más alto (36), colección tabular, visor documental, subida de archivos y acciones por fila que justifican selección múltiple.

**Se descarta Auditoría** pese a su densidad: su `<form method="get">` con navegación de URL es el contrato más frágil del dashboard y no debe ser el primero en migrar.

### 52.3 El piloto debe validar

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
| A02 | A | 0 | Baseline geométrico | A01 | 21 | Bajo | +`dashboard-geometry-baseline.spec` | Verde en 21 × 13 (273 combinaciones) |
| A03 | A | 0 | Baseline de `limit`/`offset` | A01 | 15 consumidores (§20.1) | Bajo | +`adaptive-limit-baseline` | 195 registros primarios · 195 claves · 234 observaciones hoja (§20.1–§20.4) |
| A04 | A | 0 | Baseline de seguridad | — | 15 | Bajo | +`dashboard-security-invariants` | Sesiones separadas, sin secretos |
| A05 | A | 1 | Reserva geométrica | A02, A03 | 15 | **Alto** | `limit-invariance` | `limit` idéntico con regiones de 32/48/64 px |
| A06 | A | 1 | Hook unificado | A05 | — | **Alto** | unit del hook | Un hook; 3 reglas equivalentes cubiertas |
| A07 | A | 1 | Migrar 15 módulos | A06 | 15 | **Alto** | `limit-invariance` × 15 | `limit` invariante en los 15 |
| A08 | A | 1 | Congelar zero-scroll | A02 | 21 | Bajo | +`zero-scroll-contract` | 0 desbordamientos en 21 × 13 (273 combinaciones) |
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

### 56.1 Arquitectura
Reglas de import (`presentation/` no importa de `app/`) · sin llamadas API desde presentación · sin duplicación de catálogos de módulos · sin componentes muertos.

### 56.2 Contratos
Handlers · URL y query string (incluida la de Auditoría) · payloads · endpoints · **`limit` y `offset` por módulo, variante y viewport** — sobre los 15 consumidores de §20 (no sobre los IDs `?module=` de §4.8), observados en la **segunda página** tras la convergencia adaptativa y clasificados como `server-request`, `url-query` o `client-slice` (§20.1–§20.4) · permisos · estados · defaults · semántica de fechas · reset de página por control · política de renderizado condicional.

### 56.3 Unit
Primitivas de `collection/`, `filters/`, `details/`, `menus/`, `viewer/` · variantes · selección · overflow · truncamiento · `clamp` de anchura · estados disabled/loading/error/empty.

### 56.4 E2E
Navegación entre los 15 módulos · deep links `?module=` · búsqueda · filtros · selección individual y múltiple · acciones masivas · Back/Forward · recarga · cambio de viewport en caliente (verifica A05) · diálogos · menús por teclado (Tab/Shift+Tab/Enter/Escape) · visor · mobile.

### 56.5 Regresión visual
21 superficies × 13 viewports × 2 temas × estados {inicial, hover, focus, selección, filtros activos, loading, error, empty}. **Artefactos fuera de `docs/`.** Playwright borra `test-results/` al inicio de cada corrida: preservar el «antes» fuera de ese directorio.

### 56.6 Accesibilidad
`@axe-core/playwright` sobre las 21 superficies en ambos temas · roles · etiquetas · orden de tabulación · foco visible bajo `forced-colors` · contraste ≥ 4.5:1 texto y ≥ 3:1 bordes · objetivos táctiles ≥ 44 px · `prefers-reduced-motion` · anuncio de conteo por live region.

### 56.7 Rendimiento
Re-renders por interacción · hidratación · layout shift · disparos de `ResizeObserver` · peso CSS antes/después · long tasks · **número de peticiones de paginación por cambio de viewport** (detecta *thrash* de `limit`) · estabilidad en viewport corto (768 × 600).

### 56.8 Comandos (Terminal 1)

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
| Superficies | 21 (11 admin + 10 clínica; §12, §13) |
| Viewports | 13 |
| Temas | claro + oscuro |
| Estados | inicial · hover · focus · selección · filtros activos · loading · error · empty · disabled |
| Total nominal | **21 × 13 × 2 × 9 = 4 914 capturas** |
| Estrategia | Baseline completo en A02; en cada PR sólo las superficies tocadas; suite completa en C26 |
| Aprobación | Manual, con comparación lado a lado; sin aprobación automática de diferencias |

---

## 58. Gates de staging

| Gate | Condición | Cuándo |
|---|---|---|
| G1 | Contrato operativo congelado (A01 verde) | Antes de A05 |
| G2 | Baseline geométrico (A02: 21 × 13 = 273 combinaciones) y baseline de `limit`/`offset` (A03: 195 registros primarios · 195 claves · 234 observaciones hoja, §20.1) capturados | Antes de A05 |
| G3 | **`limit` invariante** con regiones de 32/48/64 px (A05–A07) | Antes de B01 |
| G4 | Zero-scroll congelado (A08) | Antes de B06 |
| G5 | Tokens completos claro + oscuro (B03) | Antes de B06 |
| G6 | Sin sombra en chrome persistente (B04) | Antes de B11 |
| G7 | Un solo modelo de navegación; deep links intactos (B08) | Antes de B10 |
| G8 | Un solo app shell de clínica (B10) | Antes de B15 |
| G9 | Chrome ≤ 240 px a 1920 y ≤ 32 % en 768–1366 (B11–B14) | Antes de C17 |
| G10 | Piloto cerrado con los 12 puntos de §52.3 (C17) | Antes de C18 |
| G11 | axe sin violaciones críticas ni serias en ambos temas | Antes de C26 |
| G12 | Staging: deploy Live en el commit esperado; las 21 superficies operativas con tenants y usuarios de prueba controlados (nunca datos de una clínica real, AGENTS.md §17); evidencia sanitizada; auditoría sin secretos; sin incremento de 4xx/5xx en 48 h | Tras C26 |

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
| R10 | Las 21 superficies en cada gate, no sólo las de admin |
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
11. **La paginación adaptativa sigue siendo correcta y el `limit` por módulo, variante y viewport es invariante** respecto del baseline (A03, G3).
12. No existe scroll accidental; zero-scroll se conserva en 21 superficies × 13 viewports = 273 combinaciones (A08).
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
| Valores en **tema oscuro** de las 21 superficies | **NO DETERMINADO** — la medición fue en claro; las capturas del propietario están en oscuro | Repetir §21–§24 con `localStorage['vetneb-theme-mode']='dark-gray'` y `emulateMedia({colorScheme:'dark'})` |
| Ratios de contraste WCAG reales | **NO DETERMINADO** — no se ejecutó axe | `@axe-core/playwright` sobre las 21 superficies, ambos temas |
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
