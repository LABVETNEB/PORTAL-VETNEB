# AUDITORÍA SUPERBUSCADORES VETNEB vs GOOGLE DRIVE

**Tipo:** auditoría técnica de sólo lectura y planificación.
**Repositorio:** LABVETNEB/PORTAL-VETNEB
**Rama auditada:** `main`
**Commit auditado:** `065860c5` — *chore(supply-chain): implement dependency governance (#1630)*
**Fecha de ejecución:** 2026-08-04 02:15 → 03:05 (UTC−03:00)
**Estado del working tree al iniciar y al cerrar:** limpio (`git status --short` vacío).

> **Esta auditoría no implementó ningún cambio.** No se modificó código, CSS, tests, configuración, dependencias ni base de datos. No se crearon ramas, commits, pushes ni pull requests. El único archivo añadido al repositorio es este documento.

---

## 1. Resumen ejecutivo

### 1.1 Qué se auditó

Se identificaron **7 superbuscadores** en el Portal VETNEB (5 corresponden a las imágenes aportadas; 2 adicionales en el dashboard de clínica comparten la misma primitiva y quedan dentro del alcance por coherencia global). Se midieron en runtime real contra el fixture API hermético del repositorio, en **13 viewports**, y se contrastaron contra **22 estados capturados de Google Drive** (escritorio) más **7 estados mobile**.

### 1.2 Los cuatro hechos que gobiernan todo el rediseño

**Hecho 1 — La altura del superbuscador está acoplada al `limit` que se envía al backend.**
`useAdaptiveItemsPerPage` ([useAdaptiveItemsPerPage.ts:92](../../frontend/src/hooks/useAdaptiveItemsPerPage.ts)) mide la altura real del contenedor de filas; ese valor produce `rowsPerPage`, que es literalmente `effectiveLimit`, que viaja como `limit:` en la query ([AdminAuditCard.tsx:188](../../frontend/src/app/dashboard/admin/AdminAuditCard.tsx) y [:198](../../frontend/src/app/dashboard/admin/AdminAuditCard.tsx)). El superbuscador vive dentro de la misma tarjeta de altura fija: **si la barra cambia de alto, el contenedor de filas cambia de alto, y el `limit` enviado al backend cambia**. El prompt prohíbe explícitamente modificar «paginación» y «límites». Por lo tanto ningún cambio de altura es puramente visual mientras ese acoplamiento exista. *Éste es el hallazgo P0-01 y es la razón por la que el roadmap empieza por desacoplar, no por rediseñar.*

**Hecho 2 — La geometría actual está congelada por tests de contrato de fuente.**
`frontend-dashboard-filter-drawer-sticky-filters.test.ts:180` fija literalmente `density === "compact" ? "h-10 md:h-8" : "h-10"` (la altura de control). `admin-tokens-enterprise-density.test.ts:89` fija la plantilla de grid exacta `lg:grid-cols-[1.05fr_1.25fr_0.8fr_1fr_0.8fr_0.85fr_0.85fr_auto_auto]`. Doce archivos de test anclan estas superficies por `readSource`. Cualquier PR que toque la geometría debe realinearlos en el mismo PR.

**Hecho 3 — No existe «el superbuscador»: existen tres implementaciones distintas.**
Cinco superficies usan la primitiva compartida `FilterBar`; **Usuarios y roles** reimplementa la barra a mano con un `div` flex y `.field-select` (altura 28 px en vez de 32, radio 8 en vez de 6, otro fondo y otra sombra); **Clínicas** no tiene barra: es un `<input>` suelto de 320 px dentro de un flex de layout. Al mismo viewport de 1920 px conviven **tres orígenes de columna** (x = 26.39 / 27.39 / 43.39) y **tres anchos** (1833.22 / 1865.22 / 1867.22).

**Hecho 4 — La superficie está invertida respecto a Drive.**
Drive tiñe **el campo** (`#E9EEF6` sobre página `#FFFFFF`) y deja el contenedor transparente. VETNEB tiñe **el contenedor** (`bg-muted/15`, casi imperceptible) y deja los campos casi blancos (`bg-card/96`). El resultado es que la barra se lee como «una tarjeta tenue con inputs» y no como «una superficie de búsqueda». Ésta es la diferencia de identidad visual más barata de corregir y la de mayor impacto perceptual.

### 1.3 Distancia medida contra Drive

| Métrica | VETNEB (1920×1080) | Drive (1920×911) | Brecha |
|---|---:|---:|---:|
| Chrome vertical antes del dato | 323.28 – 373.78 px | 175 px | **+148 a +199 px** |
| % del viewport consumido antes del dato | 29.9 % – 34.6 % | 19.2 % | **+10.7 a +15.4 pp** |
| Filas de datos visibles | 9 | 15 – 16 | **−6 a −7 filas** |
| Altura de fila de datos | 35.66 / 37 / 41 px (varía por módulo) | 48 px (homogéneo) | menor y no homogénea |
| Sombra en chrome persistente | `0 10px 26px` en el botón primario | `none` | elevación de diálogo en una barra |
| Contenedores de scroll relevantes | 0 desbordamientos en 13/13 viewports | 1 región (mayoría de estados) | **paridad — contrato ya cumplido** |

### 1.4 Veredicto

La operativa está sana y el contrato zero-scroll se cumple en los 13 viewports medidos (0 px de desbordamiento horizontal y vertical). El problema es de **arquitectura de composición**, no de píxeles: VETNEB reparte el ancho en fracciones iguales entre 6–8 campos equivalentes, sin campo de búsqueda primario; Drive concentra un campo de 832 px y degrada el resto a chips de 128 px que abren popovers. Ninguna cantidad de ajuste de padding cierra esa brecha.

Se proponen **19 PR** ordenados de contratos → arquitectura → layout → componentes → tokens → estados → microgeometría → validación. Los dos primeros no tocan CSS.

---

## 2. Inventario de archivos recibidos

| # | Archivo | Estado | Ubicación real | Observación |
|---|---|---|---|---|
| 1 | `DATOS_CONSOLIDADOS_SIN_DUPLICADOS.md` | **Recibido, en dos partes** | `C:\Users\Nico\Desktop\NICO\DATOS_CONSOLIDADOS_SIN_DUPLICADOS_DESKTOP.md` (12 928 139 B, 40 978 líneas) y `..._MOBILE.md` (1 735 358 B, 6 924 líneas) | El prompt anuncia un archivo; se entregaron dos (escritorio y mobile). Ambos se usaron. |
| 2 | `SKILL CLAUDE(1).zip` | **Recibido con otro nombre** | `C:\Users\Nico\Desktop\NICO\WEB\SKILL CLAUDE.zip` (23 000 B) | Sin el sufijo `(1)`. Contiene las 10 skills esperadas. Cada `.skill` es a su vez un ZIP con un `SKILL.md`; los 10 se descomprimieron y se leyeron íntegros. |
| 3 | 5 imágenes PNG | **Recibidas, no adjuntas al prompt** | `C:\Users\Nico\Pictures\Screenshots\` | No venían adjuntas. Se localizaron por coincidencia exacta de dimensiones raster. Ver tabla 2.1. |

### 2.1 Resolución de las cinco imágenes

Se enumeraron los PNG de `Pictures\Screenshots`, `Downloads`, `Desktop\NICO` y `Desktop\NICO\WEB`, leyendo sus dimensiones reales con `System.Drawing`. Las cinco dimensiones declaradas coincidieron con exactamente un archivo cada una, todos capturados el 2026-08-04 entre las 02:02 y las 02:04 — inmediatamente antes de la emisión de este encargo. La correspondencia es unívoca.

| Imagen | Dimensión declarada | Archivo resuelto | Capturado |
|---|---|---|---|
| 1 | 1840 × 66 | `Captura de pantalla 2026-08-04 020236.png` | 02:02:36 |
| 2 | 1842 × 50 | `Captura de pantalla 2026-08-04 020254.png` | 02:02:54 |
| 3 | 1847 × 51 | `Captura de pantalla 2026-08-04 020313.png` | 02:03:13 |
| 4 | 374 × 51 | `Captura de pantalla 2026-08-04 020336.png` | 02:03:36 |
| 5 | 1852 × 55 | `Captura de pantalla 2026-08-04 020406.png` | 02:04:06 |

**Advertencia de método (obligatoria por el punto 1 del prompt):** las cinco dimensiones son dimensiones raster del archivo, no medidas CSS. Las cinco imágenes están **recortadas** (crops), no son capturas de viewport completo, y las cinco están en **tema oscuro**. La medición en runtime de esta auditoría se ejecutó en **tema claro**. Por lo tanto:

- los anchos raster (1840–1852) **no** son el ancho CSS de los contenedores medidos (1833.22 / 1865.22 / 1867.22) sino recortes con márgenes arbitrarios de ±7 a ±19 px;
- las alturas raster (50, 51, 55, 66) **no** son la altura CSS de las barras: la imagen 2 mide 50 px de alto y la barra correspondiente mide 60.5 px en runtime, porque el recorte cortó la fila de etiquetas;
- ningún color de las imágenes es comparable con los valores medidos en claro.

Las imágenes se usaron exclusivamente para **identificar** las superficies, que es su función según la jerarquía de evidencia del punto 7. La geometría proviene del runtime.

**Verificación cruzada realizada:** se capturaron recortes en runtime de las mismas superficies y se compararon visualmente contra las imágenes 1 y 5. La correspondencia de orden de campos, etiquetas y controles es exacta (`Evento · Actor · Desde · Hasta · Clínica ID · Informe ID · [Aplicar]` y `Buscar · Tipo usuario · Rol · N por página`). La única divergencia es «12 por página» (imagen) vs «16 por página» (runtime), que es el comportamiento adaptativo esperado ante distinta altura de viewport, y confirma el Hecho 1.

---

## 3. Matriz de uso de skills

Las 10 skills se descomprimieron y se leyeron completas antes de inspeccionar el repositorio. Todas comparten un bloque «Protocolo VETNEB obligatorio» idéntico, cuyas reglas se aplicaron de forma transversal: comandos PowerShell de sólo lectura, PNPM como gestor, sin tocar producción, sin DB manual, sin migraciones, sin dependencias nuevas, sin leer ni imprimir secretos reales, y **sin ejecutar `git add`, `git commit`, `git push`, `gh pr create` ni `gh pr merge`** (esas operaciones son manuales de Nico).

| Skill | Activada | Motivo | Secciones donde se aplicó |
|---|:---:|---|---|
| `vetneb-briefing-planificacion-diseno-desarrollo-pruebas` | **Sí** | Estructura obligatoria del briefing y anti-deriva. | §14 (roadmap por niveles), §15 (plan de PR con objetivo/alcance/no-alcance/riesgo/criterio de cierre por PR), §16 (plan de pruebas), §18 (no alcance). El bloque «Anti-deriva» motivó separar los bugs funcionales (PR-BUG-01..03) del rediseño visual. |
| `vetneb-staff-senior-full-stack-engineer` | **Sí** | Trabajo con evidencia real del repo, contratos a preservar, fronteras entre capas. | §5–§7 (inventario y trazabilidad con ruta:línea), §8 (operativa protegida), §11 (mediciones). La regla «diagnosticar primero, implementar después» y «leer archivos reales antes de modificar» produjo el hallazgo P0-01, que sólo aparece leyendo el hook y la card juntos. |
| `vetneb-production-web-optimization-engineer` | **Sí** | Evaluación de arquitectura, CSS, duplicación, mantenibilidad y sobreingeniería; escala de prioridad P0–P3. | §12 (matriz VETNEB vs Drive), §13 (diferencias enumeradas), §17 (arquitectura propuesta). Su criterio «no introducir abstracciones innecesarias» motivó rechazar un `SuperSearchBar` monolítico con API de props inmanejable (§17.4). Su checklist de frontend detectó componentes grandes (`AdminParticularTokensCard` 83 115 B) y CSS duplicado (`.field-select` vs `Select`). |
| `vetneb-admin-dashboard-operational-actions` | **Sí** | Inventario de Aplicar / Actualizar / Limpiar / paginación / exportaciones y verificación de que están atados a acciones reales. | §8 (operativa protegida, tabla completa de controles y su efecto). Su regla de cierre «no aceptar “renderiza OK”» motivó verificar en runtime que cada control tiene handler real y que la barra de tokens de clínica **desaparece** en estado vacío (P2-09). |
| `vetneb-security-production-invariants` | **Sí** | Fronteras `admin_session_id` / `app_session_id`, sanitización, no exposición de IDs ni tokens. | §8.4 y §19 (riesgos). Se verificó que ningún superbuscador expone tokens completos: el filtro de tokens particulares busca por «Últimos 4», no por token completo. Se verificó que los `data-*` de las barras no contienen nombres sensibles (regla de `security:public-surface`). |
| `vetneb-web-end-to-end-global` | **Sí** | Coherencia global: no resolver una pantalla y romper otras. | §5 (se ampliaron 5 → 7 superficies al detectar dos superbuscadores de clínica con la misma primitiva), §12, §16.3 (E2E cubre admin **y** clínica). |
| `vetneb-bugs-errores-optimizacion-rutas` | **Sí (condicional cumplida)** | Se encontraron defectos funcionales/UX reales durante la inspección. | §13 P2-03 (`line-height` = `font-size`), P2-09 (barra condicionada a datos), P2-05 (`aria-label` sobre `div` sin `role`). Se les asignaron PR correctivos separados (PR-BUG-01..03) según exige su «Salida esperada». |
| `vetneb-protocolos-comunicacion` | **Sí (condicional cumplida)** | Los superbuscadores producen llamadas API con cookies de sesión. | §8.2 (mapa filtro → parámetro → endpoint), §8.3 (`credentials`), §19. |
| `vetneb-lanzamiento-mantenimiento` | **Sí (condicional cumplida)** | Se pide readiness, gates y rollback lógico. | §20 (gates de implementación y staging), §15 (rollback por PR). No se ejecutó ningún despliegue. |
| `vetneb-pwa-end-to-end` | **No** | Condición no cumplida. | Se verificó y se descarta: los superbuscadores viven en `/dashboard/*` y `/dashboard/admin/*`, rutas que la política PWA de la propia skill **prohíbe cachear**. Por lo tanto el service worker no puede servir una versión visual u operativa obsoleta de estas superficies y la skill no aplica. Se documenta el descarte en §18. |

**Nota de honestidad:** ninguna skill se declara «usada» sin aplicación concreta. `vetneb-pwa-end-to-end` se declara explícitamente **no activada** con el motivo técnico del descarte.

---

## 4. Baseline del repositorio

| Elemento | Valor | Fuente |
|---|---|---|
| Rama | `main` | `git branch --show-current` |
| Commit | `065860c5` | `git log -1 --oneline` |
| Working tree (inicio) | limpio | `git status --short` |
| Working tree (cierre) | limpio | `git status --short` |
| Fecha/hora | 2026-08-04 02:15:16 −03:00 | `Get-Date` |
| Node | v24.14.1 | `node --version` |
| PNPM | 11.13.0 | `pnpm --version` (coincide con `packageManager` de la raíz) |
| Next.js | ^16.2.11 | `frontend/package.json` |
| React / React-DOM | ^19.2.8 | `frontend/package.json` |
| Framework CSS | Tailwind CSS ^4.3.3 (`@tailwindcss/postcss` ^4.3.3) + `globals.css` con `@apply` | `frontend/package.json`, `frontend/src/app/globals.css` |
| Librerías UI | Radix (`react-dialog`, `react-separator`, `react-slot`, `react-toast`, `react-tooltip`), `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate` | `frontend/package.json` |
| Iconos | `lucide-react` ^1.24.0 | `frontend/package.json` |
| Formularios | **Ninguna librería.** Estado local `useState` + `<form>` nativo. Validación con `zod` ^4 en cliente y `zod` ^3.25.76 en backend | `frontend/package.json`, código de las cards |
| Tablas | **Ninguna librería.** Componentes propios `Table/TableHeader/TableRow/TableHead/TableBody` | `frontend/src/components/ui/table.tsx` |
| Testing (unit/contract) | `node --test` con `--experimental-strip-types` | `package.json` raíz, script `test` |
| E2E | Playwright ^1.61.0 (+ `@axe-core/playwright` ^4.12.1, `pngjs` ^7.0.0) | `frontend/package.json` |
| Backend | Fastify ^5.10.0, Drizzle ORM ^0.45.2, `postgres` ^3.4.9, Supabase JS ^2.110.8 | `package.json` raíz |
| Configuración responsive | Breakpoints Tailwind por defecto: `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536 | uso en las cards |
| Estructura del dashboard | App Shell de viewport único. Admin: 10 módulos vía `?module=` (`AdminDashboardWorkspaceController`). Clínica: módulos `operaciones/informes/logistica/perfil/tokens` (`CLINIC_MODULE_IDS`). Contrato zero-scroll con primitivas `ModuleSurface` / `ModuleTabs` / `usePagedRows` / `useAdaptiveItemsPerPage` / `ModuleDialog` | `frontend/src/features/dashboard/config/dashboardModules.ts`, `AdminDashboardWorkspaceController.tsx` |

### 4.1 Geometría del app shell medida (1920 × 1080, tema claro)

| Banda | y inicial | Altura | Nota |
|---|---:|---:|---|
| Header de aplicación | 0 | **92.33 px** | Idéntico en los 5 módulos admin |
| `main.dashboard-main` | 92.33 | 987.67 px | |
| Tarjeta del módulo | 166.28 | 887.33 px | x = 26.39, w = 1867.22 — idéntica en los 5 módulos |
| Superbuscador | 248.28 – 292.55 | 32 – 60.5 px | **varía por módulo** |
| Primera fila de datos | 323.28 – 373.78 | 35.66 – 41 px | |

---

## 5. Definición de superbuscador (operativa para esta auditoría)

Se adopta la definición del prompt: **toda superficie horizontal compacta que combina consulta y filtrado sobre un conjunto de datos y ejecuta esa consulta contra el backend.**

**Criterios de inclusión aplicados** (una superficie es superbuscador si cumple ≥1 de a–c y además d):
- a) contiene al menos un campo de entrada de texto libre destinado a consulta;
- b) contiene al menos un control de filtrado (`select`, fecha, rango) que altera el conjunto de resultados;
- c) contiene una acción explícita de consulta (`Aplicar`) o consulta implícita al cambiar el control;
- d) su resultado modifica el conjunto de datos mostrado en la superficie de datos adyacente.

**Excluido explícitamente:** el buscador público de profesionales (no aparece en las imágenes ni comparte primitiva), los diálogos de creación/edición (formularios de escritura, no de consulta) y los selectores de clínica dentro de formularios de alta (`AdminParticularTokensCard.tsx:1743`), que son *pickers* de un formulario de creación, no superbuscadores de la vista.

**No se asumió que las cinco imágenes pertenecieran al mismo componente.** Se comprobó por código: pertenecen a **cinco componentes distintos**, de los cuales sólo tres comparten la primitiva `FilterBar`.

---

## 6. Inventario de superbuscadores

| # | Superficie | Rol | Módulo (`?module=`) | Componente | Primitiva | Confianza |
|---|---|---|---|---|---|---|
| S1 | Auditoría | Admin | `audit-log` | `AdminAuditFilterBar.tsx` (usado por `AdminAuditCard.tsx`) | `FilterBar` | **Alta** — verificada en runtime y por captura comparada |
| S2 | Tokens particulares (admin) | Admin | `admin-particular-tokens` | `AdminParticularTokensCard.tsx:1003-1120` | `FilterBar` | **Alta** |
| S3 | Informes (admin) | Admin | `admin-report-upload` | `AdminReportsCard.tsx:526-642` | `FilterBar` | **Alta** |
| S4 | Clínicas | Admin | `admin-clinics` | `AdminClinicsManagementCard.tsx:606-650` | **ninguna** (`<input>` suelto) | **Alta** |
| S5 | Usuarios y roles | Admin | `admin-users-roles` | `AdminUsersRolesReadOnlyCard.tsx:540-605` (desktop), `:812-871` (mobile) | **ninguna** (`div` flex + `.field-select`) | **Alta** |
| S6 | Informes (clínica) | Clínica | `informes` | `ClinicInformesWorkspaceSummary.tsx:260-366` | `FilterBar` | **Alta** |
| S7 | Tokens particulares (clínica) | Clínica | `tokens` | `ClinicParticularTokensCard.tsx:739-834` | `FilterBar` | **Media-alta** — código verificado; **no medible en runtime** con el fixture actual (ver §10.4) |

**Primitivas compartidas:** [`FilterBar.tsx`](../../frontend/src/components/dashboard/FilterBar.tsx) exporta `FilterBar`, `FilterField`, `dashboardFilterControlClassName(density)`, `dashboardFilterActionClassName(density)` y el tipo `FilterBarDensity = "comfortable" | "compact"`. Los controles son [`Input`](../../frontend/src/components/ui/input.tsx), [`Select`](../../frontend/src/components/ui/select.tsx) y `Button`.

**Componente relacionado sin consumidores:** [`StickyFilterBar.tsx`](../../frontend/src/components/dashboard/StickyFilterBar.tsx) no se importa desde ningún archivo de `frontend/src` salvo su propia definición; sólo lo referencian tests, y dos de ellos (`frontend-dashboard-filter-drawer-sticky-filters.test.ts:136-137`) **afirman su ausencia** en las superficies. Candidato a código muerto (P3-06).

### 6.1 Recuento

- **7 superbuscadores** (5 admin, 2 clínica).
- **12 componentes relacionados**: los 7 anteriores + `FilterBar.tsx`, `input.tsx`, `select.tsx`, `button.tsx`, `StickyFilterBar.tsx`.
- **3 implementaciones estructurales distintas** para la misma función.

---

## 7. Trazabilidad imagen → ruta → componente → CSS → API → tests

| Imagen | Superficie | Ruta visible | Componente : línea | CSS / clases | Estado y API | Tests que lo anclan | Confianza |
|---|---|---|---|---|---|---|---|
| 1 (1840×66) | S1 Auditoría | `/dashboard/admin?module=audit-log` | [`AdminAuditFilterBar.tsx:53-133`](../../frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx) | `FilterBar` compact + `mx-3 hidden sm:mx-4 md:grid md:grid-cols-4 lg:grid-cols-[minmax(11rem,1.4fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_auto_auto]` | **`<form method="get" action="/dashboard/admin">`** — navegación por URL, no fetch. Campos `module`(hidden), `event`, `actorType`, `from`, `to`, `clinicId`, `reportId`. La card consume `getAdminAuditPage(query)` con `limit`/`offset` | `admin-audit-enterprise-density.test.ts` (ancla `name="${name}"` de cada filtro, `h-8`), `admin-reports-enterprise-density.test.ts:123`, `frontend-admin-particular-tokens.test.ts:181` | **Alta** |
| 2 (1842×50) | S2 Tokens admin | `/dashboard/admin?module=admin-particular-tokens` | [`AdminParticularTokensCard.tsx:1009-1120`](../../frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx) | `FilterBar` compact + `hidden shrink-0 md:grid md:grid-cols-4 lg:grid-cols-[1.05fr_1.25fr_0.8fr_1fr_0.8fr_0.85fr_0.85fr_auto_auto] lg:px-2`; `data-admin-filter-bar="advanced"` | **`onSubmit` en cliente** → `applyAdvancedFilters` → `setAppliedFilters` + `pagedTokens.setPage(0)`. Filtros: `token`, `clinic`, `reportId`, `patient`, `status`, `from`, `to`. `Actualizar` → `loadTokens()` | `admin-tokens-enterprise-density.test.ts:81-89` (**ancla la plantilla de grid literal**), `frontend-admin-particular-tokens.test.ts:202-203` | **Alta** |
| 3 (1847×51) | S3 Informes admin | `/dashboard/admin?module=admin-report-upload` | [`AdminReportsCard.tsx:532-640`](../../frontend/src/app/dashboard/admin/AdminReportsCard.tsx) | `FilterBar` compact + `hidden shrink-0 md:grid md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-[0.8fr_1fr_0.95fr_0.95fr_0.9fr_0.9fr_0.85fr_0.85fr_auto_auto] xl:px-1.5`; **`labelHidden={!mobile}`**; `data-admin-report-upload-filter-bar="advanced"` | `onSubmit` cliente → `applyAdvancedFilters` + `setOffset(0)`. Filtros: `report`, `clinic`, `patient`, `status`, `study`, `file`, `from`, `to`. Datos vía `getAdminReportWorkflow({limit, offset})` | `admin-reports-enterprise-density.test.ts:130-136` (ancla import, `<FilterBar`, las 3 líneas de densidad) | **Alta** |
| 4 (374×51) | S4 Clínicas | `/dashboard/admin?module=admin-clinics` | [`AdminClinicsManagementCard.tsx:606-620`](../../frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx) | **Sin primitiva.** `hidden items-center justify-between gap-2 md:flex` > `relative max-w-xs flex-1` > `Input` con `h-8 pl-8 text-sm` | **Filtrado en cliente**, sin submit ni endpoint propio: `onChange` → `setSearchQuery`. La paginación (`pageStart`–`pageEnd de totalClinics`) es hermana, no parte de la barra | `frontend-admin-clinics-management-card.test.ts` | **Alta** |
| 5 (1852×55) | S5 Usuarios y roles | `/dashboard/admin?module=admin-users-roles` | [`AdminUsersRolesReadOnlyCard.tsx:540-605`](../../frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx) | **Sin primitiva.** `div` con `flex min-h-12 shrink-0 items-end gap-2 border-b ... px-3 py-2 sm:px-4 md:min-h-10 md:py-1` + `label` sueltos + `.field-select` (definido en [`globals.css:374`](../../frontend/src/app/globals.css)) | **Sin submit.** `onChange` inmediato: `setSearchQuery` / `setUserType(...) + setOffset(0)` / `setRole(...) + setOffset(0)` → `loadUsersRoles`. Indicador `{effectiveLimit} por página` | `admin-users-roles-enterprise-density.test.ts` (ancla `[&_td]:h-8`, `[&_th]:h-8`) | **Alta** |
| — | S6 Informes clínica | `/dashboard?module=informes` | [`ClinicInformesWorkspaceSummary.tsx:266-364`](../../frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx) | `FilterBar` compact + `hidden shrink-0 md:grid md:grid-cols-4 lg:grid-cols-[0.82fr_1.1fr_0.85fr_1fr_1fr_0.85fr_0.85fr_auto_auto]`; `data-clinic-report-filter-bar` | `onSubmit` cliente. **Condicional:** `{!reportsLoadError ? renderAdvancedFilterForm() : null}` ([:396](../../frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx)) | `frontend-dashboard-informes.test.ts:132-145` (ancla el import multilínea exacto y la línea completa del botón submit) | **Alta** |
| — | S7 Tokens clínica | `/dashboard?module=tokens` | [`ClinicParticularTokensCard.tsx:745-832`](../../frontend/src/components/dashboard/ClinicParticularTokensCard.tsx) | `FilterBar` compact + `mb-2 hidden shrink-0 md:grid md:grid-cols-4 lg:grid-cols-[0.9fr_0.85fr_1.15fr_0.85fr_0.85fr_0.85fr_auto_auto]`; `data-clinic-access-filter-bar` | `onSubmit` cliente. **Condicional:** `{tokens.length ? renderAdvancedFilterForm() : null}` ([:916](../../frontend/src/components/dashboard/ClinicParticularTokensCard.tsx)) | `frontend-dashboard-clinic-tokens.test.ts` | **Media-alta** (no medido en runtime) |

**Ninguna superficie quedó sin resolver.**

---

## 8. Operativa protegida

Esta sección es el contrato que el rediseño **no puede alterar**. Se construyó leyendo el código, no infiriendo.

### 8.1 Mecanismo de consulta por superficie

| Superficie | Mecanismo | Momento de la consulta | Reset de página |
|---|---|---|---|
| S1 Auditoría | **`<form method="get">` con navegación de URL** | Al pulsar `Aplicar` (submit nativo) | Vía URL |
| S2 Tokens admin | `onSubmit` React (`preventDefault` implícito por `FilterBar`) | Al pulsar `Aplicar` | `pagedTokens.setPage(0)` |
| S3 Informes admin | `onSubmit` React | Al pulsar `Aplicar` | `setOffset(0)` |
| S4 Clínicas | `onChange` (filtrado en cliente) | En cada pulsación | — |
| S5 Usuarios y roles | `onChange` (sin submit) | En cada cambio de control | `setOffset(0)` en los `select`; **no** en el campo de texto |
| S6 Informes clínica | `onSubmit` React | Al pulsar `Aplicar` | `setOffset(0)` |
| S7 Tokens clínica | `onSubmit` React | Al pulsar `Aplicar` | `setPage(0)` |

> **S1 es la única superficie cuya operativa vive en la URL.** Su `action="/dashboard/admin"` con `<input type="hidden" name="module" value="audit-log">` significa que sus filtros son parámetros de query string reales y compartibles. Cualquier extracción de componente que convierta ese `<form>` en un handler de cliente **rompe URLs existentes** y está prohibida.

### 8.2 Mapa filtro → parámetro → destino

| Superficie | Campos | Nombres de parámetro | Destino |
|---|---|---|---|
| S1 | Evento, Actor, Desde, Hasta, Clínica ID, Informe ID | `event`, `actorType`, `from`, `to`, `clinicId`, `reportId`, `module` | Query string → `getAdminAuditPage({...,limit,offset})`. `to` se normaliza a `${to}T23:59:59.999Z` ([AdminAuditCard.tsx:195](../../frontend/src/app/dashboard/admin/AdminAuditCard.tsx)) |
| S2 | Token, Clínica, Informe, Paciente/tutor, Estado, Desde, Hasta | `token`, `clinic`, `reportId`, `patient`, `status`, `from`, `to` (estado interno, `.trim()` aplicado) | `loadTokens()` |
| S3 | Informe, Clínica, Paciente, Estado, Estudio, Archivo, Desde, Hasta | `report`, `clinic`, `patient`, `status`, `study`, `file`, `from`, `to` | `getAdminReportWorkflow({limit, offset})` |
| S4 | Buscar | `searchQuery` (local) | filtrado en memoria |
| S5 | Buscar, Tipo usuario, Rol | `searchQuery`, `userType` (`all`/`admin`/`clinic`), `role` (`all`/`admin`/`clinic_owner`/`clinic_staff`) | `loadUsersRoles` |
| S6 | Informe, Paciente, Estado, Estudio, Archivo, Desde, Hasta | idem S3 sin `clinic` | consulta de informes de clínica |
| S7 | Token, Informe, Paciente/tutor, Estado, Desde, Hasta | idem S2 sin `clinic` | `loadTokens()` |

**Semántica de fechas protegida:** `from` se envía tal cual (`YYYY-MM-DD`); `to` se expande al final del día. Ese comportamiento no puede cambiar.

### 8.3 Acciones y su efecto real (verificado)

| Acción | Superficies | Efecto | ¿Decorativo? |
|---|---|---|---|
| `Aplicar` (`type="submit"`, icono `Filter`) | S1, S2, S3, S6, S7 | Ejecuta la consulta y resetea offset/página | **No** |
| `Limpiar` | S2 (sólo si `hasActiveFilters`), S3, S6, S7 | Restaura `INITIAL_FILTER_STATE` en draft **y** aplicados, resetea página, limpia error | **No** |
| `Limpiar` (S1) | S1 | Es un `PublicRouteControl` de navegación a `/dashboard/admin?module=audit-log` con `replace`, renderizado **sólo si `hasActiveFilters`** | **No** |
| `Actualizar` | S2 | `loadTokens()`, con `disabled={isLoadingTokens}` | **No** |
| Indicador `N por página` | S3, S5, S7 | Refleja `effectiveLimit`, que es el `limit` real enviado | Informativo, **derivado de estado real** |

### 8.4 Invariantes de seguridad verificados

- Ningún superbuscador acepta ni muestra un token completo. El filtro de tokens usa el placeholder **«Últimos 4»**, coherente con la invariante de no exponer tokens.
- Los `data-*` de las barras (`data-dashboard-filter-bar`, `data-admin-filter-bar`, `data-admin-report-upload-filter-bar`, `data-clinic-report-filter-bar`, `data-clinic-access-filter-bar`, `data-dashboard-filter-density`) **no** contienen los lexemas prohibidos por `security:public-surface` (`token`, `session`, `cookie`, …). El de tokens usa el tallo neutro `filter-bar`.
- Separación de sesión intacta: S1–S5 se miden con `admin_session_id`; S6–S7 con `app_session_id`. Ninguna barra cruza la frontera.
- No hay `select('*')` ni filtrado en memoria sobre datos privados salvo S4, que ya recibe la página desde el backend.

### 8.5 Lo que está prohibido cambiar

Handlers, eventos, submit, momento de la consulta (automática vs manual), nombres de parámetro, payloads, endpoints, métodos HTTP, semántica de fechas, valores por defecto, validaciones, **paginación y límites**, ordenamiento, relevancia, resultados, permisos, roles, estados de carga y error, el efecto de `Aplicar`/`Actualizar`/`Limpiar`, rutas de navegación (incluida la query string de S1), persistencia, backend, SQL, DB, seguridad, auditoría y sanitización.

### 8.6 Lo que sí está permitido cambiar

CSS, posición, ubicación en el app shell, ancho, altura, distribución visual, orden visual de zonas (sin alterar el flujo ni el orden de tabulación), responsive, colores, tipografía, bordes, radios, sombras, iconos, estados visuales, presentación visual de resultados, wrappers y markup exclusivamente presentacional, y extracción de componentes visuales siempre que sea behavior-preserving.

---

## 9. Datos técnicos de Drive utilizados

Todos los valores siguientes se extrajeron de `DATOS_CONSOLIDADOS_SIN_DUPLICADOS_DESKTOP.md` y `..._MOBILE.md` resolviendo los códigos del catálogo (`I`/`A`/`G`/`S`/`C`) contra el registro consolidado de elementos de la §14 de esos archivos. Se construyó un indexador de sólo lectura para hacerlo con precisión en lugar de por búsqueda textual.

### 9.1 Condiciones de captura (obligatorio para no universalizar)

| Estado | Viewport CSS | DPR | Pantalla | URL |
|---|---|---:|---|---|
| `04`, `08`–`18` | **1920 × 911** | 1 | 1920 × 1080 | `/drive/my-drive`, `/drive/search`, `/drive/folders/...` |
| `02`, `03`, `05`–`07`, `H01`, `MU` | **1601 × 747** | 1.2 | 1600 × 900 | `/drive/my-drive`, `/drive/home` |
| `19`, `20` | 1920 × 911 | 1 | 1920 × 1080 | `/file/d/.../view` (visor PDF, **tema oscuro**) |
| Mobile `01`–`07` | **390 × 844** | 2 (01–04) / 3 (05–07) | — | `/drive/u/0/mobile/*` |

> **Los valores de esta auditoría se toman del grupo 1920 × 911, DPR 1**, salvo indicación expresa. Los estados 19/20 (visor PDF) se **excluyen** de la comparación por no ser superficies de búsqueda ni compartir shell. Los estados 1601 × 747 se usan sólo para verificar invariancia de ancho.

### 9.2 Superbuscador de Drive — valores canónicos

| Ruta técnica | Valor | Cód. | Estado | Aplicabilidad al superbuscador VETNEB |
|---|---|---|---|---|
| `identity.selectorHint` | `form#aso_search_form_anchor` | `I03798`/`I03799` | 04, 08–18 | Contenedor raíz; `role="search"` |
| `accessibility.computedRole` | `"search"` | `A00663` | todos | **Directamente aplicable**: ninguna barra VETNEB expone `role="search"` |
| `geometry` | `x 256, y 7, w 834, h 48` | `G03805` | 1920×911 | Aplicable como proporción y como altura |
| `geometry` (1601 CSS) | `x 255.99, y 7.01, w 833.66, h 47.66` | `G03804` | 1601×747 | **El ancho no cambia entre 1601 y 1920** → es fijo, no fluido |
| `computed.layout.maxWidth` | `"832px"` | `C01621` | 1920 | Cap duro del campo |
| `computed.layout.boxSizing` | `"content-box"` | `C01621` | 1920 | 832 + 2×1 px de borde = 834 |
| `computed.surface.backgroundColor` | `"rgb(233, 238, 246)"` (**#E9EEF6**) | `C01621` | 1920 | **Clave**: el tinte va en el campo |
| `computed.surface.borderRadius` | `"24px"` | `C01621` | 1920 | Ratio radio/alto = 0.5 → pill |
| `computed.surface.border` | `"1px solid rgba(0,0,0,0)"` | `C01621` | 1920 | Borde transparente reservado para el estado de foco |
| `computed.surface.boxShadow` | `"none"` | `C01621` | 1920 | **Sin elevación en reposo** |
| `computed.interaction.transition` | `"background 0.1s ease-in, width 0.1s ease-out"` | `C01621` | 1920 | Sólo 2 propiedades, 100 ms |
| `scrolling.overflowX/Y` | `"hidden"` | `S00761` | 1920 | |
| Input interno `geometry` | `x 313, y 22, w 728, h 20` | `G04027` | 1920 | Inset izquierdo 57 px, derecho 49 px |
| Input `computed.typography.fontSize` | `"16px"` | `C01677` | 1920 | vs 12 px en VETNEB |
| Input `computed.surface` | `bg transparent, border 0, radius 0` | `C01677` | 1920 | El input no pinta: pinta el contenedor |
| Input `identity.name` | `"q"` | `I03867` | 1920 | |

### 9.3 Chips de filtro de Drive (análogo de los filtros secundarios)

| Ruta técnica | Valor | Cód. | Estado |
|---|---|---|---|
| `identity.role` | `"button"`, `aria-haspopup="dialog"`, `aria-expanded` | `I00383`, `A00199` | 04 |
| `geometry` | `y 135, h 32, w 128.28` | `G00358`/`G00359` | 1920×911 |
| `computed.surface.borderRadius` | `"8px"` | `C00117` | 1920 |
| `computed.surface.border` | `"1px solid rgb(116, 119, 117)"` | `C00117` | 1920 |
| `computed.surface.backgroundColor` | `"rgb(255, 255, 255)"` | `C00117` | 1920 |
| `computed.surface.boxShadow` | `"none"` | `C00117` | 1920 |
| `computed.spacing.margin` | `"4px 8px 4px 0px"` | `C00117` | 1920 → gap horizontal 8 px |
| `computed.typography` | `14px / 16px, weight 500, color rgb(68,71,70)` | `C00117` | 1920 |

### 9.4 Shell y densidad de Drive

| Ruta técnica | Valor | Estados | Nota |
|---|---|---|---|
| `lowChromeMetrics.shell.topbarHeightCssPx` | **64** | 04, 08–18 | 63.98 en 1601 (DPR 1.2) |
| `detectedRegions.topbar.computed.surface.backgroundColor` | `rgba(0,0,0,0)` | 02–18 | **Topbar transparente** |
| `detectedRegions.topbar.computed.surface.boxShadow` | `"none"` | todos | |
| `lowChromeMetrics.shell.leftNavigationWidthCssPx` | **257** | 04, 08–18 | El buscador arranca exactamente en x = 256 |
| `lowChromeMetrics.dataViewport.yCssPx` | **175** | 04, 08–18 | Inicio del dato |
| `lowChromeMetrics.dataViewport.xCssPx` | **257** | 04, 08–18 | |
| `lowChromeMetrics.dataViewport.viewportAreaPercent` | **66.15 %** | 04, 11–18 | 52.32 % con panel lateral abierto (08–10) |
| `lowChromeMetrics.dataViewport.stickyVerticalPixels` | 48 (my-drive) / **105** (resultados de búsqueda) | 04 / 12,13 | |
| `lowChromeMetrics.density.dominantDataRowHeightCssPx` | **48** | 02–17 | Homogéneo |
| `lowChromeMetrics.density.theoreticalRowsInPrimaryViewport` | **15** | 04, 08–17 | 16 filas detectadas |
| `lowChromeMetrics.documentScroll.horizontal` | **`false` en los 22 estados** | todos | |
| `lowChromeMetrics.scrollArchitecture.singleRelevantScrollRegion` | `true` en 17/21 estados | | |
| `colorEconomy.neutralCoverageApproxPercent` | 92.55 – 99.41 % | estados de lista | |
| `colorEconomy.topSurfaceColors[0]` | `#FFFFFF`, 63–74 % del viewport | | |
| `colorEconomy.topSurfaceColors[1]` | `#F8FAFD`, 21–22 % | | |
| `visualSystem.shadows` | **6 valores únicos en 22 estados**; ninguno en el chrome persistente | | Elevación reservada a menús (Material 2/4) y diálogos (24) |
| `visualSystem.gaps` | **8 px dominante** (44–82 ocurrencias/estado), 12 px secundario | | |

### 9.5 Drive mobile (390 × 844)

| Ruta técnica | Valor | Nota |
|---|---|---|
| `lowChromeMetrics.shell.topbarHeightCssPx` | **60** (57 en estado de búsqueda) | |
| `lowChromeMetrics.dataViewport.yCssPx` | **57** | El dato empieza casi inmediatamente |
| `lowChromeMetrics.dataViewport.viewportAreaPercent` | **93.25 %** | vs 66.15 % en desktop |
| `lowChromeMetrics.density.dominantDataRowHeightCssPx` | **58** | Mayor que en desktop (48) — touch |
| Input de búsqueda `geometry` | `x 56, y 0, w 334, h 37` | 85.64 % del ancho del viewport |
| Input `computed.typography.fontSize` | **16 px** | Se mantiene 16 px (evita zoom en iOS) |
| Input `computed.surface` | `bg #FFF, border 0, radius 0` | **Sin pill en mobile**: el campo ocupa la topbar |

### 9.6 Limitaciones de comparación declaradas

1. Drive es un gestor de archivos con **una** entidad y **un** campo de búsqueda; VETNEB filtra entidades heterogéneas con 3–8 dimensiones simultáneas. La composición de Drive es transferible; el número de dimensiones no.
2. Los estados de Drive fueron capturados en **tema claro** (salvo 19/20). Las capturas VETNEB del propietario están en **tema oscuro**. Los colores sólo se comparan por relación (Δ de luminosidad respecto a la página), nunca por hex absoluto.
3. Drive dispone de 1920 − 257 = 1663 px de ancho de contenido y gasta 834 en el buscador (50 %). VETNEB dispone de 1833–1867 px y gasta el 100 % en la barra. La proporción de Drive **no** es directamente trasladable sin decidir qué ocupa el 50 % restante.
4. Ninguna medida de Drive de un viewport concreto se presenta aquí como universal: cada valor lleva su estado y su viewport.

---

## 10. Metodología de medición

### 10.1 Entorno

- **Navegador:** Chromium vía Playwright 1.61.0 (`chromium.launch()` headless).
- **Sistema:** Windows 11 Pro 10.0.26200.
- **DPR:** 1 (contextos Playwright por defecto).
- **Zoom / escala visual:** 1.
- **Tema:** claro (por defecto; `vetneb-theme-mode` no fijado).
- **Fuente:** la del bundle de la aplicación, sin fuentes externas forzadas.
- **Indicador de desarrollo de Next suprimido** con `nextjs-portal{display:none!important}` para no contaminar la geometría.

### 10.2 Backend

Se usó el **fixture API hermético del propio repositorio**, `frontend/e2e/fixtures/admin-populated-api-server.mjs` en `127.0.0.1:3107`, y `next dev` en `127.0.0.1:3000` con `NEXT_PUBLIC_API_URL=http://127.0.0.1:3107`. **No se tocó producción, ni staging, ni la base de datos.** Sesiones simuladas con las cookies del propio fixture: `admin_session_id=e2e_populated_admin_session` y `app_session_id=e2e_populated_clinic_session`.

### 10.3 Instrumentación

`getBoundingClientRect()` + `getComputedStyle()` sobre el contenedor de cada superbuscador, cada control (`input`, `select`, `button`) y cada `label`, más `document.documentElement`/`document.body` para el contrato de scroll. Estados `hover`/`focus` inducidos con `locator.hover()` / `locator.focus()` y re-leídos con `getComputedStyle`.

**Corrección de método aplicada:** la primera pasada seleccionaba el primer nodo coincidente con `querySelector`, que en Auditoría es la **instancia mobile oculta** (`md:hidden`), devolviendo 0 × 0. Se corrigió seleccionando el primer nodo con caja no nula. Todas las cifras publicadas provienen de la pasada corregida.

### 10.4 Cobertura y su límite

Se midieron **6 de las 7 superficies**. S7 (tokens de clínica) **no pudo medirse**: el fixture devuelve `E2E populated session required` para el endpoint de tokens de clínica, la lista queda vacía y el código sólo renderiza la barra si `tokens.length` es verdadero ([ClinicParticularTokensCard.tsx:916](../../frontend/src/components/dashboard/ClinicParticularTokensCard.tsx)). Sus valores en este documento se derivan del código (clases idénticas a S6 salvo la plantilla de grid) y se marcan como tales.

### 10.5 Higiene del repositorio

`next dev` reescribe `frontend/next-env.d.ts` (`./.next/types/routes.d.ts` → `./.next/dev/types/routes.d.ts`), que es un archivo versionado. Se detectó con `git status --short`, se revirtió con `git checkout -- frontend/next-env.d.ts` y se verificó árbol limpio al cierre. Las capturas de evidencia se guardaron **fuera del repositorio**, en el scratchpad de sesión, para no ensuciar `docs/audit`.

---

## 11. Mediciones actuales

### 11.1 Contenedor por superficie y viewport (px CSS)

Formato: `alto` — el ancho y la x se detallan en 11.2.

| Viewport | S1 Auditoría | S3 Informes | S2 Tokens | S4 Clínicas | S5 Usuarios | S6 Inf. clínica |
|---|---:|---:|---:|---:|---:|---:|
| 1920 × 1080 | 60.5 | 42 | 60.5 | 32 | 55.5 | 60.5 |
| 1600 × 900 | 60.5 | 42 | 60.5 | 32 | 55.5 | 60.5 |
| 1440 × 900 | 60.5 | 42 | 60.5 | 32 | 55.5 | 60.5 |
| 1366 × 768 | 60.5 | 42 | 60.5 | 32 | 55.5 | 60.5 |
| 1280 × 720 | 60.5 | 42 | 60.5 | 32 | 55.5 | 60.5 |
| 1024 × 768 | 60.5 | **80** | 60.5 | 32 | 55.5 | 60.5 |
| **834 × 1194** | **117** | **118** | **155** | 32 | 55.5 | **155** |
| **768 × 1024** | **117** | **118** | **155** | 32 | 55.5 | **155** |
| 430 × 932 | `display:none` | `display:none` | `display:none` | (en lista) | `display:none` | `display:none` |
| 412 × 915 | `display:none` | `display:none` | `display:none` | (en lista) | `display:none` | `display:none` |
| 390 × 844 | `display:none` | `display:none` | `display:none` | (en lista) | `display:none` | `display:none` |
| 375 × 812 | `display:none` | `display:none` | `display:none` | (en lista) | `display:none` | `display:none` |
| 360 × 800 | `display:none` | `display:none` | `display:none` | (en lista) | `display:none` | `display:none` |

En < 768 px las barras desktop se ocultan y su contenido se traslada a un `ModuleDialog` («Filtros»), con `density="comfortable"` y controles de 40 px. S5 conserva una variante mobile propia (`:812-871`) con `min-h-12`, controles de 36 px y tipografía de 10 px en las etiquetas.

### 11.2 Origen y ancho del contenedor (1920 × 1080)

| Superficie | x | ancho | Δ ancho vs S6 |
|---|---:|---:|---:|
| S1, S2, S3, S4 | **43.39** | **1833.22** | −34 px |
| S5 | **27.39** | **1865.22** | −2 px |
| S6 | **26.39** | **1867.22** | 0 |

Tres orígenes y tres anchos para la misma función en el mismo shell.

### 11.3 Contenedor — estilos calculados

| Propiedad | S1 / S2 / S6 | S3 | S5 | S4 |
|---|---|---|---|---|
| `display` | `grid` | `grid` | `flex` | `flex` |
| `padding` | `4px 8px` | `4px 6px` | `4px 16px` | `0px` |
| `gap` | `6px` | `6px` | `8px` | `8px` |
| `border-radius` | `8px` | `8px` | `0px` | `0px` |
| `background-color` | `oklab(0.933 −0.007 −0.007 / 0.15)` (`bg-muted/15`) | idem | idem | `transparent` |
| `border` | `1px solid oklab(0.851 −0.018 −0.017 / 0.7)` | idem | *(sólo `border-bottom`)* | ninguno |
| `box-shadow` | `none` | `none` | `none` | `none` |
| `min-height` | `auto` | `auto` | `40px` (`md:min-h-10`) | `auto` |

### 11.4 Plantillas de grid resueltas (1920 × 1080)

| Superficie | `grid-template-columns` calculado |
|---|---|
| S1 | `394.67 281.91 281.91 281.92 225.53 225.52 81.75 0.016` |
| S3 | `180.42 225.53 214.25 214.27 202.98 202.97 191.70 191.72 81.75 59.63` |
| S2 | `255.77 304.50 194.88 243.61 194.88 207.06 207.06 81.75 77.72` |
| S6 | `210.36 282.20 218.06 256.55 256.53 218.06 218.08 81.75 59.63` |

> La última columna de S1 mide **0.016 px**: es el `<input type="hidden" name="module">` participando en el grid como ítem (P4-03).

### 11.5 Controles — estilos calculados

| Propiedad | S1/S2/S3/S6 (`Input`/`Select`) | S5 `Input` | S5 `.field-select` | S4 `Input` |
|---|---|---|---|---|
| Altura | **32 px** | **28 px** | **28 px** | **32 px** |
| `border-radius` | **6 px** | 6 px | **8 px** | 6 px |
| `background-color` | `oklab(0.986 … / 0.96)` (`bg-card/96`) | idem | **`rgb(248,251,252)`** | idem |
| `border` | `1px solid rgb(183,205,215)` | idem | idem | idem |
| `box-shadow` | `0 1px 2px rgba(15,45,62,0.05)` | idem | **`0 1px 3px rgba(0,0,0,.1), 0 1px 2px -1px rgba(0,0,0,.1)`** | idem |
| `font-size` / `line-height` | **12 / 16 px** | **12 / 12 px** | 12 / 12 px | **14 / 20 px** |
| `font-weight` | 500 | 500 | 500 | **400** |
| `padding` | `8px 12px` (select: `8px 40px 8px 12px`) | `8px 12px 8px 28px` | `4px 12px` | `8px 12px 8px 32px` |

### 11.6 Botones

| Botón | Superficies | Ancho | Alto | Radio | Sombra en reposo | Sombra en hover |
|---|---|---:|---:|---|---|---|
| `Aplicar` (primario) | S1,S2,S3,S6,S7 | **81.75** | 32 | 6 px | **`rgba(16,60,96,0.2) 0 10px 26px`** | **`rgba(16,60,96,0.24) 0 14px 32px`** |
| `Limpiar` (ghost) | S3,S6 | **59.63** | 32 | 6 px | `none` | — |
| `Actualizar` (outline) | S2 | **77.72** | 32 | 6 px | `0 1px 2px rgba(15,45,62,.05)` | — |

Tipografía de acción: 12 / 16 px, peso 600, `padding 0 8px`.

### 11.7 Estados de interacción

| Estado | Cambio observado |
|---|---|
| Reposo (campo) | `border 1px solid rgb(183,205,215)` |
| Hover (campo) | `border-color → oklab(0.5497 −0.0865 −0.0149 / 0.35)` (teal 35 %). Sin otro cambio. |
| Foco (campo y acción) | `box-shadow` gana `rgb(241,246,248) 0 0 0 2px, oklab(0.5983 −0.0919 −0.0310 / 0.85) 0 0 0 4px` → anillo de 2 px de separación + 2 px de color. `outline-style: none`; `outline-offset: 3px` presente pero **inerte**. |
| Pressed | **No hay estilo diferenciado** medible. |
| Disabled | `opacity: 0.55`, `cursor: not-allowed` (declarado en las primitivas). |
| Loading | Sólo en `Actualizar` de S2 (`disabled={isLoadingTokens}`). Las demás barras no tienen estado de carga propio. |
| Filtros activos | Sin tratamiento visual en la barra. En S1 y S2 sólo se manifiesta como **aparición/desaparición del botón `Limpiar`**. |
| Transición | `border-color, box-shadow, background-color` **0.15 s** (campos); `background-color, border-color, box-shadow, color, transform` 0.15 s (acciones). |

### 11.8 Contrato de scroll

**0 px de desbordamiento horizontal y 0 px de desbordamiento vertical a nivel de documento en las 13 × 6 = 78 combinaciones medidas.** El contrato zero-scroll del dashboard se cumple íntegramente en el estado actual y debe seguir cumpliéndose.

### 11.9 Densidad y chrome (1920 × 1080)

| Superficie | Barra: top → bottom | Dato empieza | Alto de fila | Filas visibles | Offset card→barra |
|---|---|---:|---:|---:|---:|
| S1 Auditoría | 269.78 → 330.28 | **371.28** | 37 | 9 | 103.5 |
| S3 Informes | 248.28 → 290.28 | **323.28** | 35.66 | 9 | 82 |
| S2 Tokens | 278.28 → 338.78 | **373.78** | 35.66 | 9 | 112 |
| S4 Clínicas | 292.55 → 324.55 | **369.55** | 156.5 (tarjetas) | 1 | 126.27 |
| S5 Usuarios | 256.28 → 311.78 | **348.78** | 41 | 9 | 90 |

Capas de superficie que pintan (fondo, borde o sombra) entre el viewport y la barra: **3** en las cinco superficies.

### 11.10 Accesibilidad medida

| Aspecto | Resultado |
|---|---|
| Etiquetado de controles | **Correcto**: todos los `input`/`select` están envueltos en `<label>` (etiquetado implícito). S3 usa `labelHidden` → `sr-only`, que conserva el nombre accesible. |
| Nombre accesible del contenedor | S1,S2,S3,S6,S7: `<form aria-label="…">` → **válido** (`form` con nombre es región). **S5: `<div aria-label="Filtros de usuarios y roles">` sin `role`** → el nombre es ignorado por las tecnologías asistivas. **S4: sin contenedor.** |
| `role="search"` | **Ausente en las 7 superficies.** Drive lo expone (`computedRole: "search"`). |
| Orden de tabulación | Coincide con el orden visual y con el DOM en todas las superficies medidas. |
| `aria-describedby` | **Ausente en las 7.** |
| Live region para el conteo | **Ausente.** El indicador `N por página` no anuncia cambios. |
| Foco visible | Presente vía `box-shadow` de 4 px. Suficiente en contraste, pero **no sobrevive a `forced-colors`** porque `outline-style` es `none`. |
| Touch targets (< 768 px) | 40 px en el diálogo (`comfortable`), 36 px en la variante mobile de S5. Por debajo de los 44 px recomendados en S5. |

---

## 12. Matriz VETNEB actual vs Drive

Tolerancias: **R** = medida rígida verificada (±2 px); **P** = proporcional al viewport (fórmula); **T** = token/valor exacto.

| Propiedad | VETNEB actual (medido) | Drive observado (estado/viewport) | Objetivo propuesto | Tol. | Evidencia | Motivo |
|---|---|---|---|---|---|---|
| Rol semántico del contenedor | `form[aria-label]` (5), `div[aria-label]` sin rol (1), ninguno (1) | `role="search"`, `computedRole "search"` (04/1920) | `role="search"` en las 7 | T | `A00663` / runtime | Paridad de accesibilidad; coste nulo |
| Altura de la banda | 32 / 42 / 55.5 / 60.5 px | topbar 64 px (04/1920) | **64 px** en las 7 | R ±2 | `shell.topbarHeightCssPx` / runtime | Homogeneidad + espacio para un control de 48 px |
| Altura del control primario | 32 px (28 en S5) | 48 px (04/1920) | **48 px** | R ±1 | `G03805` / runtime | Valor exacto de Drive, alcanzable dentro de 64 px |
| Radio del control primario | 6 px | 24 px (`C01621`) | **24 px** (= alto/2) | T | `C01621` | Pill; ratio 0.5 exacto |
| Fondo del control primario | `bg-card/96` (≈ blanco) | **#E9EEF6** sobre página #FFFFFF (Δ L ≈ −6) | `hsl(var(--muted))` = `198 26% 91%` sobre `--background` `198 34% 96%` (Δ L = −5) — dark: `210 8% 20%` sobre `210 8% 12%` (Δ L = +8) | T | `C01621` + `globals.css:16,26,1663,1673` | Equivalente tonal en la identidad VETNEB, no copia del hex |
| Fondo del contenedor | `bg-muted/15` (tinte tenue) | `transparent` (`detectedRegions.topbar`) | **`transparent`** | T | `detectedRegions.topbar.computed.surface.backgroundColor` | Invierte la relación actual (Hecho 4) |
| Borde del contenedor | `1px solid vetneb-line/70` en 4 lados, radio 8 | ninguno | **`border-bottom: 1px solid hsl(var(--vetneb-line)/0.7)`**, radio 0 | T | idem | Elimina la lectura de «tarjeta dentro de tarjeta» |
| Sombra del contenedor | `none` | `none` | `none` | T | — | **Ya en paridad** |
| Sombra de la acción primaria | `0 10px 26px rgba(16,60,96,.2)`; hover `0 14px 32px` | `none` en chrome persistente; 6 sombras únicas en 22 estados, todas de menú/diálogo | **`none`** en reposo y hover | T | `visualSystem.shadows` / runtime | Elevación de diálogo en una barra de 32 px |
| Tipografía del control primario | 12 / 16 px, peso 500 | **16 px**, peso 400 (`C01677`) | **14 / 20 px, peso 400** | T | `C01677` | 16 px desequilibra la densidad VETNEB (8 dimensiones vs 1); 14 px es el punto medio defendible. Ver §13 D-CSS-02 |
| Tipografía de filtros secundarios | 12 / 16 px, peso 500 | 14 / 16 px, peso 500 (`C00117`) | **13 / 16 px, peso 500** | T | `C00117` | Un punto por debajo del chip de Drive, por mayor número de controles |
| Filtros secundarios: forma | `input`/`select` de ancho fraccional 180–394 px | **chip de 128.28 × 32 px**, `aria-haspopup="dialog"` | **chip de 32 px de alto, ancho por contenido, mín. 96 px, máx. 160 px** | R ±2 | `G00358`, `C00117` | Libera el ancho para el campo primario |
| Radio del chip | — (no existe) | **8 px** | **8 px** | T | `C00117` | Valor exacto |
| Borde del chip | — | `1px solid rgb(116,119,117)` | `1px solid hsl(var(--vetneb-line))` | T | `C00117` | Equivalente tonal |
| Gap entre controles | 6 px (S1,S2,S3,S6) / 8 px (S4,S5) | **8 px dominante** (44–82 ocurrencias/estado) | **8 px** en las 7 | T | `visualSystem.gaps` | Ritmo unificado |
| Ancho del campo primario | no existe campo primario | **832 px fijos** (idéntico en 1601 y 1920) | `clamp(280px, 44%, 832px)` | P | `G03804` vs `G03805` | Cap exacto de Drive; mínimo derivado de 360 px de viewport |
| Origen de la columna | 26.39 / 27.39 / 43.39 | 256 (= ancho del nav) | **un único origen**, igual al de la tarjeta del módulo | R ±1 | runtime | Alineación de shell |
| Ancho de la banda | 1833.22 / 1865.22 / 1867.22 | 1663 disponibles, 834 usados (50 %) | **un único ancho** = ancho de la tarjeta | R ±1 | runtime | |
| Chrome antes del dato | 323.28 – 373.78 px (29.9–34.6 %) | **175 px (19.2 %)** | ≤ 300 px alcanzable con el superbuscador solo; ≤ 210 px requiere tocar el app shell | P | `dataViewport.yCssPx` / runtime | Ver §13 D-EST-05: el superbuscador **no** es el mayor consumidor |
| Alto de fila de datos | 35.66 / 37 / 41 px | **48 px homogéneo** | fuera de alcance (afecta `itemHeightPx` → `limit`) | — | `density.dominantDataRowHeightCssPx` | Operativa protegida |
| Desbordamiento horizontal | **0 px en 78/78 mediciones** | **`false` en 22/22 estados** | mantener 0 | R | runtime / `documentScroll.horizontal` | **Ya en paridad** |
| Transición | 0.15 s, 3–5 propiedades | **0.1 s, 2 propiedades** | 0.1 s, 2 propiedades | T | `C01621` | |
| Cobertura neutra | no medida | 92.55 – 99.41 % | ≥ 90 % | P | `colorEconomy` | Métrica de aceptación |

---

## 13. Diferencias enumeradas por severidad

**Severidades:** P0 bloquea la transformación o puede romper operativa/seguridad · P1 diferencia estructural de alto impacto · P2 diferencia visual u operativa importante · P3 refinamiento fino · P4 detalle cosmético.

### P0 — 2 hallazgos

---
**P0-01 · La altura de la barra determina el `limit` enviado al backend**
- **Impacto:** cualquier cambio de altura del superbuscador altera la paginación real, que es operativa explícitamente protegida.
- **Evidencia:** [`useAdaptiveItemsPerPage.ts:92-105`](../../frontend/src/hooks/useAdaptiveItemsPerPage.ts) mide `containerNode.getBoundingClientRect().height` y devuelve `floor(alto disponible / rowHeight)`. [`AdminAuditCard.tsx:188`](../../frontend/src/app/dashboard/admin/AdminAuditCard.tsx) `const effectiveLimit = rowsPerPage;` y [`:198`](../../frontend/src/app/dashboard/admin/AdminAuditCard.tsx) `limit: effectiveLimit`. Confirmado empíricamente: la imagen 5 del propietario muestra «12 por página» y la medición a 1080 px de alto muestra «16 por página».
- **Causa:** la barra y el contenedor de filas son hermanos dentro de una tarjeta de altura fija; lo que gana una lo pierde el otro.
- **Recomendación:** **PR-SB-03** debe desacoplar la medición antes de cualquier cambio geométrico — compensando `headerHeightPx`/`safetyGapPx` o fijando la altura del contenedor de filas — y demostrarlo con un test que afirme que `limit` por viewport es idéntico antes y después.
- **Dependencia:** ninguna. Es el primer PR estructural.
- **Riesgo:** alto si se ignora — se enviarían `limit` distintos a producción bajo la apariencia de un cambio de CSS.
- **Prueba necesaria:** contract test de `limit` por viewport para las 7 superficies (§16.1).

---
**P0-02 · Los tests de contrato de fuente congelan la geometría actual**
- **Impacto:** un PR de CSS aparentemente inocuo hace fallar `pnpm test`.
- **Evidencia:** `frontend-dashboard-filter-drawer-sticky-filters.test.ts:180` ancla `density === "compact" ? "h-10 md:h-8" : "h-10"`; `admin-tokens-enterprise-density.test.ts:84` ancla `hidden shrink-0 md:grid md:grid-cols-4` y `:89` la plantilla `lg:grid-cols-[1.05fr_1.25fr_0.8fr_1fr_0.8fr_0.85fr_0.85fr_auto_auto]`; `frontend-dashboard-informes.test.ts:132` ancla el import multilínea exacto y `:145` la línea completa del botón submit. Doce archivos de test anclan estas superficies por `readSource`.
- **Causa:** patrón de contrato de fuente adoptado en el proyecto (precedente TEST-ARCH-12: los controllers no admiten *move* mecánico).
- **Recomendación:** cada PR de geometría realinea sus anclas **en el mismo PR**, nunca debilitándolas. Prohibido eliminar aserciones para «hacer pasar» el test.
- **Riesgo:** medio. Predecible y gestionable si se censa antes (`git grep` de las anclas del archivo a tocar).

### P1 — 8 hallazgos

**P1-01 · Tres implementaciones para una misma función.** 5 superficies usan `FilterBar`; S5 reimplementa a mano con `div` flex + `.field-select`; S4 es un `<input>` suelto. *Evidencia:* [`AdminUsersRolesReadOnlyCard.tsx:540-605`](../../frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx), [`AdminClinicsManagementCard.tsx:606-620`](../../frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx). *Recomendación:* PR-SB-04, PR-SB-05.

**P1-02 · Tres orígenes y tres anchos al mismo viewport.** x = 26.39 / 27.39 / 43.39; ancho = 1833.22 / 1865.22 / 1867.22. *Evidencia:* §11.2. *Recomendación:* PR-SB-06.

**P1-03 · Colapso de densidad en la banda 768–1023 px.** La barra pasa de 42–60.5 px a **117–155 px** (hasta ×3.7) porque `md:grid-cols-4` reparte 8–10 ítems en 4 columnas y genera 3–4 filas. *Evidencia:* §11.1. *Recomendación:* PR-SB-09 — resolver con menú de desbordamiento, no con wrap.

**P1-04 · Sin campo de búsqueda primario; reparto fraccional del ancho.** Campos de 180–394 px para contenidos de 3–12 caracteres (`#ID`, `Últimos 4`). Drive concentra 832 px en un campo y degrada el resto a chips de 128 px. *Evidencia:* §11.4 vs `G03805`/`G00358`. *Recomendación:* PR-SB-08, PR-SB-10, PR-SB-11.

**P1-05 · Chrome vertical: +148 a +199 px sobre Drive.** El dato empieza en 323–374 px (29.9–34.6 % del viewport) frente a 175 px (19.2 %) en Drive; 9 filas visibles frente a 15–16. *Evidencia:* §11.9 vs `dataViewport.yCssPx`. *Matiz importante:* el superbuscador aporta 32–60.5 px de esos 323–374. El resto son el **header de aplicación (92.33 px)** y el **encabezado del módulo (82–126.27 px)**. Corregir sólo el superbuscador cierra como mucho un tercio de la brecha (ver §14, Nivel 2, nota).

**P1-06 · Etiquetas visibles vs `sr-only` incoherentes entre hermanos.** S3 usa `labelHidden={!mobile}` y mide 42 px; S1/S2/S6 muestran etiqueta y miden 60.5 px. Misma familia de componentes, dos alturas. *Evidencia:* [`AdminReportsCard.tsx:547`](../../frontend/src/app/dashboard/admin/AdminReportsCard.tsx) vs [`AdminAuditFilterBar.tsx:66`](../../frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx). *Recomendación:* decidir una política única en PR-SB-08.

**P1-07 · S5 y S4 no usan las primitivas.** S5: control de 28 px (vs 32), `.field-select` con radio 8 px, fondo `rgb(248,251,252)` y sombra doble propios. S4: sin contenedor, tipografía 14/20 y peso 400 frente a 12/16 y peso 500. *Evidencia:* §11.5, [`globals.css:374`](../../frontend/src/app/globals.css).

**P1-08 · Superficie invertida respecto a Drive.** Drive tiñe el campo (#E9EEF6 sobre #FFFFFF) y deja el contenedor transparente; VETNEB tiñe el contenedor (`bg-muted/15`, alfa 0.15) y deja los campos casi blancos (`bg-card/96`). *Evidencia:* `C01621` + `detectedRegions.topbar.computed.surface.backgroundColor` vs §11.3/11.5. *Recomendación:* PR-SB-13. Es el cambio de mayor impacto perceptual por unidad de riesgo.

### P2 — 9 hallazgos

**P2-01 · Sombra de diálogo en el botón primario.** `0 10px 26px rgba(16,60,96,.2)` en reposo, `0 14px 32px` en hover, sobre un botón de 32 px dentro de una barra. Drive no usa sombra en chrome persistente (6 sombras únicas en 22 estados, todas de menú o diálogo). *Evidencia:* §11.6 vs `visualSystem.shadows`.

**P2-02 · Escala tipográfica incoherente.** 12/16 px peso 500 (S1,S2,S3,S6) · 12/12 px peso 500 (S5) · 14/20 px peso 400 (S4).

**P2-03 · `line-height` igual a `font-size` en S5.** `text-xs leading-none` → `12px / 12px`. Riesgo de recorte de descendentes y de caracteres acentuados en español. *Bug de presentación* → **PR-BUG-02**.

**P2-04 · Radios mezclados.** Contenedor 8 px, controles 6 px, `.field-select` 8 px, botones 6 px.

**P2-05 · `aria-label` sobre `div` sin `role` en S5.** [`AdminUsersRolesReadOnlyCard.tsx:541-542`](../../frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx). El nombre accesible se pierde. *Bug de accesibilidad* → **PR-BUG-03**.

**P2-06 · S4 sin región nombrada.** El buscador de clínicas no tiene contenedor semántico ni agrupación.

**P2-07 · Sin `aria-describedby` ni live region.** Ninguna de las 7 barras anuncia el número de resultados ni el estado de filtros a un lector de pantalla.

**P2-08 · Acciones dimensionadas por contenido.** 81.75 / 77.72 / 59.63 px producen un borde derecho irregular entre módulos.

**P2-09 · La barra de S7 desaparece en estado vacío.** `{tokens.length ? renderAdvancedFilterForm() : null}` ([:916](../../frontend/src/components/dashboard/ClinicParticularTokensCard.tsx)). S6 usa otra condición (`!reportsLoadError`); S1–S5 siempre renderizan. Tres políticas distintas. **Es operativa actual: debe preservarse salvo decisión explícita** → **PR-BUG-01** para decidirlo, separado del rediseño.

### P3 — 6 hallazgos

**P3-01 ·** Padding del contenedor `4px 8px` / `4px 6px` / `4px 16px` / `0`.
**P3-02 ·** Gap 6 px vs 8 px según superficie; Drive usa 8 px dominante.
**P3-03 ·** Offset vertical tarjeta→barra: 82 / 90 / 103.5 / 112 / 126.27 px (rango de 44 px).
**P3-04 ·** Altura de fila de datos 35.66 / 37 / 41 px entre módulos; Drive 48 px homogéneo. *Fuera de alcance del superbuscador* (altera `itemHeightPx` → `limit`).
**P3-05 ·** Foco con `outline-style: none` y `outline-offset: 3px` inerte: el anillo depende sólo de `box-shadow` y no sobrevive a `forced-colors`.
**P3-06 ·** [`StickyFilterBar.tsx`](../../frontend/src/components/dashboard/StickyFilterBar.tsx) sin consumidores en `frontend/src`; dos tests afirman su ausencia. Probable código muerto → **PR-SB-07** (independiente).

### P4 — 4 hallazgos

**P4-01 ·** Icono `Filter` de 14 × 14 px en `Aplicar`; Drive no usa icono en la acción primaria de búsqueda.
**P4-02 ·** Placeholder «Buscar clínica por nombre, email o usuario…» truncado por el campo de 320 px.
**P4-03 ·** `<input type="hidden" name="module">` participa en el grid de S1 como columna de 0.016 px.
**P4-04 ·** Transiciones de 0.15 s sobre 3–5 propiedades; Drive usa 0.1 s sobre 2.

**Totales: P0 = 2 · P1 = 8 · P2 = 9 · P3 = 6 · P4 = 4 · Total = 29.**

---

## 14. Diferencias por categoría

### 14.1 Estructurales
Ausencia de campo primario (P1-04) · tres implementaciones (P1-01) · tres orígenes y anchos (P1-02) · chrome vertical (P1-05) · superficie invertida (P1-08) · ausencia de `role="search"` (§11.10).

**Nota crítica sobre P1-05.** Descomposición medida del chrome vertical a 1920 × 1080 en el módulo de Informes (el más denso):

| Banda | px | % del chrome total |
|---|---:|---:|
| Header de aplicación | 92.33 | 28.6 % |
| Tarjeta: borde superior → barra (encabezado del módulo) | 82.00 | 25.4 % |
| **Superbuscador** | **42.00** | **13.0 %** |
| Barra → cabecera de tabla + cabecera | 107.00 | 33.1 % |
| **Total hasta la primera fila** | **323.28** | 100 % |

El superbuscador es el **tercer** consumidor, no el primero. Cerrar la brecha con Drive exige tocar el header de aplicación y el encabezado de módulo, que están **fuera del alcance de este encargo**. Se dejan como PR-ADJ-01 y PR-ADJ-02 en §18, requiriendo autorización separada.

### 14.2 Operativas visuales
Sin estado visual de «filtros activos» (sólo aparición de `Limpiar`) · sin estado de carga salvo en S2 · sin estado *pressed* · tres políticas de renderizado condicional (P2-09) · momento de consulta heterogéneo (submit en 5, `onChange` en 2 — **es operativa protegida y no se unifica**).

### 14.3 CSS
Radios mezclados (P2-04) · tipografía incoherente (P2-02) · `line-height` degenerado (P2-03) · sombra de diálogo (P2-01) · padding y gap divergentes (P3-01, P3-02) · duplicación `.field-select` vs `Select` (P1-07) · transiciones divergentes (P4-04).

**D-CSS-02 — sobre los 16 px de Drive.** Drive usa 16 px en su único campo. Trasladar 16 px a VETNEB, que muestra 6–8 controles simultáneos en la misma banda, forzaría anchos mayores y agravaría P1-03. Se propone **14 px** para el campo primario y **13 px** para los secundarios: se sube desde los 12 px actuales (legibilidad) sin importar el coste de anchura de Drive. Esto es una **adaptación razonada, no una copia**, y se declara como tal.

### 14.4 Responsive
Colapso 768–1023 px (P1-03) · en < 768 px las barras desktop se ocultan y el contenido migra a `ModuleDialog`, salvo S5 que mantiene variante propia y S4 que no migra · touch targets de 36 px en la variante mobile de S5 (< 44 px).

### 14.5 Accesibilidad
P2-05 · P2-06 · P2-07 · P3-05 · ausencia de `role="search"` · touch targets de S5 mobile.
**En positivo:** el etiquetado implícito por `<label>` envolvente es correcto en las 6 superficies medidas, el orden de tabulación coincide con el visual, y `sr-only` conserva el nombre accesible donde la etiqueta se oculta.

### 14.6 Rendimiento y mantenibilidad
`AdminParticularTokensCard.tsx` = 83 115 B y `AdminReportsCard.tsx` = 39 205 B: la barra vive dentro de componentes muy grandes, lo que dificulta el aislamiento visual · `.field-select` duplica `Select` en CSS · `StickyFilterBar` probablemente muerto (P3-06) · cada barra reimplementa `renderAdvancedFilterForm(mobile)` con la misma forma (4 copias casi idénticas) · el `ResizeObserver` de `useAdaptiveItemsPerPage` se dispara con cada cambio de altura de la barra, por lo que animar la altura provocaría *thrash* de `limit`.

---

## 15. Especificación visual de destino

Objetivo: composición equivalente a Drive con identidad y tokens VETNEB, preservando la operativa.

### 15.1 Banda del superbuscador

| Propiedad | Valor | Tolerancia | Origen |
|---|---|---|---|
| Altura total | **64 px** | ±2 px | Drive `shell.topbarHeightCssPx` = 64 |
| Padding | **8px 16px** | ±1 px | (64 − 48) / 2 = 8 |
| Gap entre zonas | **8px** | exacto | Drive `visualSystem.gaps` dominante |
| `background` | **`transparent`** | exacto | Drive topbar |
| `border` | **`border-bottom: 1px solid hsl(var(--vetneb-line) / 0.7)`** | exacto | reemplaza el borde en 4 lados |
| `border-radius` | **0** | exacto | Drive topbar |
| `box-shadow` | **`none`** | exacto | ya en paridad |
| `role` | **`search`** | exacto | Drive `computedRole` |
| Alineación vertical | `align-items: center` | — | |
| Origen x y ancho | **idénticos a la tarjeta del módulo** en las 7 superficies | ±1 px | corrige P1-02 |

### 15.2 Campo primario de búsqueda

| Propiedad | Valor | Tolerancia | Origen |
|---|---|---|---|
| Altura | **48 px** | ±1 px | Drive `G03805` |
| `border-radius` | **24 px** | exacto | Drive `C01621` (ratio 0.5) |
| Ancho | **`clamp(280px, 44%, 832px)`** | fórmula | cap = Drive `maxWidth: 832px`; mínimo derivado de 360 px de viewport |
| `background` (claro) | **`hsl(var(--muted))`** = `198 26% 91%` | exacto | equivalente tonal de #E9EEF6 (Δ L −5 vs Δ L −6 de Drive) |
| `background` (oscuro) | **`hsl(var(--muted))`** = `210 8% 20%` | exacto | Δ L +8 sobre `--background` `210 8% 12%` |
| `border` | **`1px solid transparent`** | exacto | Drive: borde reservado al foco |
| `box-shadow` | **`none`** | exacto | Drive |
| Tipografía | **14px / 20px, peso 400** | exacto | adaptación razonada de los 16 px de Drive (§14.3 D-CSS-02) |
| Color de texto | `hsl(var(--foreground))` | exacto | |
| Color del placeholder | `hsl(var(--muted-foreground))` | exacto | |
| Icono guía | 20 × 20 px, `left: 14px`, centrado vertical | ±1 px | escala de los 57 px de inset de Drive a 48 px de alto |
| `padding-left` | **44 px** | ±1 px | 14 + 20 + 10 |
| `padding-right` | **40 px** (o 12 px sin acción de limpieza) | ±1 px | inset derecho de Drive 49 px escalado |
| `transition` | **`background-color 0.1s ease-in`** | exacto | Drive `C01621`, reducido a la propiedad que cambia |

### 15.3 Chip de filtro secundario

| Propiedad | Valor | Tolerancia | Origen |
|---|---|---|---|
| Altura | **32 px** | ±1 px | Drive `G00358` |
| Ancho | por contenido, **mín. 96 px, máx. 160 px** | ±2 px | Drive 128.28 px como centro del rango |
| `border-radius` | **8 px** | exacto | Drive `C00117` |
| `border` | **`1px solid hsl(var(--vetneb-line))`** | exacto | equivalente de `rgb(116,119,117)` |
| `background` | **`hsl(var(--card))`** | exacto | Drive `rgb(255,255,255)` sobre página blanca |
| `box-shadow` | **`none`** | exacto | Drive |
| Tipografía | **13px / 16px, peso 500** | exacto | Drive 14/16/500, −1 px por densidad |
| Color | `hsl(var(--muted-foreground))` inactivo · `hsl(var(--foreground))` activo | exacto | |
| Margen derecho | **8 px** | exacto | Drive `margin: 4px 8px 4px 0` |
| ARIA | `role="button"`, `aria-haspopup="dialog"`, `aria-expanded` | exacto | Drive `A00199` |
| Estado activo | fondo `hsl(var(--vetneb-teal) / 0.12)`, borde `hsl(var(--vetneb-teal) / 0.45)`, texto `hsl(var(--foreground))`, **sin sombra** | exacto | corrige «sin estado de filtros activos» |

### 15.4 Acciones

| Propiedad | Valor | Tolerancia |
|---|---|---|
| Altura | **32 px** | ±1 px |
| Ancho mínimo | **88 px** (corrige P2-08) | ±2 px |
| Padding | `0 12px` | ±1 px |
| `border-radius` | **8 px** (alineado con chips) | exacto |
| `box-shadow` reposo | **`none`** (elimina P2-01) | exacto |
| `box-shadow` hover | **`none`**; el hover se expresa con `background-color` | exacto |
| Tipografía | 13px / 16px, peso 600 | exacto |
| Icono en `Aplicar` | **eliminar** (P4-01) o 16 × 16 px si se conserva | — |

### 15.5 Estados

| Estado | Especificación |
|---|---|
| Reposo | Campo: `background: hsl(var(--muted))`, borde transparente, sin sombra. |
| Hover (campo) | `background: hsl(var(--muted) / 0.85)`; sin cambio de borde. |
| Hover (chip/acción) | `background` un 6 % más oscuro; sin sombra, sin `transform`. |
| Foco | `outline: 2px solid hsl(var(--ring)); outline-offset: 2px` **como outline real**, además del `box-shadow` actual, para sobrevivir a `forced-colors` (corrige P3-05). |
| Pressed | `background` un 10 % más oscuro; sin `transform`, sin sombra. |
| Selected (chip con filtro activo) | Ver 15.3, estado activo. |
| Disabled | `opacity: 0.55`, `cursor: not-allowed` (sin cambio respecto al actual). |
| Loading | Spinner de 16 px en la acción, con `aria-busy="true"`; el resto de la barra permanece operable. |
| Error | La barra no cambia; el mensaje vive fuera de ella (comportamiento actual, preservado). |
| Empty | La barra permanece visible — **salvo que PR-BUG-01 confirme lo contrario para S7**. |
| Filtros activos | Chip en estado activo + contador junto a la acción `Limpiar`. |
| `prefers-reduced-motion` | Suprimir todas las transiciones. |

### 15.6 Comportamiento con texto largo, truncamiento y desbordamiento

| Situación | Regla |
|---|---|
| Placeholder más largo que el campo | `text-overflow: ellipsis`; el texto completo va en `title` **y** en `aria-label`. |
| Etiqueta de chip larga | `max-width: 160px` + elipsis; valor completo en `aria-label`. |
| Más chips que ancho disponible | **Menú de desbordamiento** (`Más filtros`, `aria-haspopup="dialog"`), nunca wrap a segunda fila. |
| Desbordamiento horizontal | **Prohibido.** `document.documentElement.scrollWidth === clientWidth` en los 13 viewports. |
| Tooltips | Sólo en chips truncados; nunca como único portador de información. |

### 15.7 Responsive

| Banda | Composición |
|---|---|
| ≥ 1280 px | Campo primario `clamp(280px, 44%, 832px)` + todos los chips + acciones. Una fila, 64 px. |
| 1024 – 1279 px | Igual; los chips que no quepan pasan al menú de desbordamiento. Una fila, 64 px. |
| **768 – 1023 px** | Campo primario `flex: 1 1 auto` + **`Filtros (N)`** único (menú de desbordamiento con todo) + acción primaria. Una fila, 64 px. **Corrige P1-03: prohibido el wrap a 4 columnas.** |
| < 768 px | Campo primario a ancho completo, 48 px de alto, + botón `Filtros (N)` de 48 × 48 px que abre el `ModuleDialog` existente. Banda 64 px. Touch targets ≥ 44 px en todos los controles del diálogo (corrige el 36 px de S5). |

### 15.8 Valores no determinados

| Dato | Motivo | Medición que falta |
|---|---|---|
| Geometría en runtime de S7 (tokens de clínica) | **NO DETERMINADO CON LOS DATOS DISPONIBLES** — el fixture no puebla tokens de clínica y la barra sólo se renderiza con `tokens.length` verdadero. | Fixture con tokens de clínica poblados, o medición en staging con sesión de clínica real. |
| Valores en **tema oscuro** de las 7 superficies | **NO DETERMINADO** — la medición se ejecutó en tema claro; las capturas del propietario están en oscuro. | Repetir §11 con `localStorage['vetneb-theme-mode']='dark-gray'` y `emulateMedia({colorScheme:'dark'})`. |
| Estado `pressed` (`:active`) de acciones y chips | **NO DETERMINADO** — no se indujo `:active` en esta pasada. | `page.mouse.down()` sostenido + `getComputedStyle`. |
| Ratios de contraste WCAG reales | **NO DETERMINADO** — no se ejecutó axe sobre las barras. | `@axe-core/playwright` acotado al selector de cada barra, en ambos temas. |
| Viewport CSS exacto de las 5 capturas del propietario | **NO DETERMINADO** — son recortes sin metadatos de viewport. | Irrelevante para el destino: el runtime lo sustituye. |
| Coste de rendimiento del cambio (re-renders, reflow) | **NO DETERMINADO** — no se perfiló. | Trazas de Performance antes/después en PR-SB-16. |

---

## 16. Arquitectura de componentes propuesta

### 16.1 Diagnóstico previo (obligatorio antes de proponer)

- **Comparten primitiva:** S1, S2, S3, S6, S7 (`FilterBar` + `FilterField` + `Input`/`Select`/`Button`).
- **Duplican estructura y estilo:** los cuatro `renderAdvancedFilterForm(mobile)` de S2, S3, S6, S7 son casi idénticos salvo la plantilla de grid y el conjunto de campos.
- **Contratos incompatibles:** S1 usa `<form method="get">` con navegación de URL; el resto usa `onSubmit` de cliente. **Esta diferencia es operativa protegida y no se puede unificar.**
- **Requieren variante:** S4 (un solo campo, filtrado en cliente) y S5 (sin submit, `onChange` inmediato).

### 16.2 Conclusión arquitectónica

Un `SuperSearchBar` monolítico que absorbiera las 7 superficies necesitaría props para: mecanismo de submit, presencia/ausencia de cada acción, política de renderizado condicional, política de etiquetas, reset de offset por control y plantilla de columnas. Es exactamente la «API de props inmanejable» que el prompt advierte y que la skill de optimización productiva prohíbe. **Se rechaza.**

Se propone en cambio un conjunto de **primitivas visuales pequeñas** que cada superficie compone, conservando su propia lógica:

```
components/dashboard/supersearch/
├── SuperSearchBar.tsx          — sólo la banda: role="search", 64px, tokens, gap. Sin lógica.
├── SuperSearchField.tsx        — campo primario pill 48px. Controlado por el consumidor.
├── SuperSearchChip.tsx         — chip 32px, aria-haspopup="dialog", estado activo.
├── SuperSearchOverflow.tsx     — menú "Filtros (N)"; reutiliza ModuleDialog.
├── SuperSearchActions.tsx      — contenedor de acciones con min-width homogéneo.
└── useSuperSearchOverflow.ts   — cuántos chips caben (ResizeObserver). Sólo layout.
```

**Fronteras estrictas:**
- Ninguna primitiva conoce endpoints, parámetros, `limit`, `offset` ni sesiones.
- Ninguna primitiva declara `onSubmit`: recibe `children` y `props` de formulario, como hoy hace `FilterBar`.
- `SuperSearchBar` **no** sustituye a `FilterBar`: lo envuelve o convive con él. `FilterBar` mantiene su contrato exportado (`FilterBarDensity`, `dashboardFilterControlClassName`, `dashboardFilterActionClassName`), que está anclado por tests.
- `useSuperSearchOverflow` sólo decide **cuántos** chips se muestran, nunca **qué filtro** se aplica.

### 16.3 Lo que NO se abstrae

El mecanismo de consulta, el reset de página, la política de renderizado condicional y el conjunto de campos permanecen en cada card. Son operativa, no presentación.

---

## 17. Roadmap ordenado (de lo más grueso a lo más fino)

### Nivel 1 — Contratos e invariantes *(sin CSS)*
1. **PR-SB-01** Congelar la operativa con un contract test de las 7 superficies.
2. **PR-SB-02** Baseline geométrico y visual: E2E de medición en 13 viewports × 7 superficies, con tolerancias.

### Nivel 2 — Arquitectura
3. **PR-SB-03** **Desacoplar altura ↔ `limit`** (resuelve P0-01). *Prerrequisito absoluto de todo lo demás.*
4. **PR-SB-04** Migrar S5 a las primitivas (behavior-preserving).
5. **PR-SB-05** Migrar S4 a las primitivas (behavior-preserving).
6. **PR-SB-06** Unificar origen y ancho de las 7 superficies.
7. **PR-SB-07** Retirar `StickyFilterBar` si se confirma muerto *(independiente, puede ir en paralelo)*.

> **Nota de alcance:** al cerrar el Nivel 2 la brecha de chrome vertical con Drive se habrá reducido como máximo un tercio (§14.1). Los otros dos tercios están en el header de aplicación y el encabezado de módulo, fuera de este encargo (PR-ADJ-01/02, §18).

### Nivel 3 — Layout principal
8. **PR-SB-08** Campo primario + chips: nueva distribución de ancho; política única de etiquetas (resuelve P1-04, P1-06).
9. **PR-SB-09** Banda 768–1023: menú de desbordamiento en lugar de wrap (resuelve P1-03).

### Nivel 4 — Sistema de componentes
10. **PR-SB-10** `SuperSearchField`.
11. **PR-SB-11** `SuperSearchChip` + `SuperSearchOverflow` + `useSuperSearchOverflow`.
12. **PR-SB-12** `SuperSearchActions` con `min-width` homogéneo (resuelve P2-08).

### Nivel 5 — Sistema visual
13. **PR-SB-13** Tokens: superficie invertida, radios, bordes, tipografía, iconos — **claro y oscuro** (resuelve P1-08, P2-01, P2-02, P2-04, P4-01, P4-04).

### Nivel 6 — Estados
14. **PR-SB-14** hover / focus / pressed / selected / disabled / loading / filtros activos / `reduced-motion` (resuelve P3-05).

### Nivel 7 — Microgeometría
15. **PR-SB-15** Padding, gap, alineación, baseline, offsets de icono, truncamiento, precisión ±1–2 px (resuelve P3-01, P3-02, P3-03).

### Nivel 8 — Validación y rollout
16. **PR-SB-16** Regresión visual, accesibilidad, rendimiento, gates y rollback.

### PR correctivos separados *(no mezclar con el rediseño)*
17. **PR-BUG-01** Decidir y unificar la política de renderizado condicional (P2-09).
18. **PR-BUG-02** `line-height` degenerado en S5 (P2-03).
19. **PR-BUG-03** `aria-label` sobre `div` sin `role` + `role="search"` + `aria-describedby` + live region (P2-05, P2-06, P2-07).

---

## 18. Plan de PR

| PR | Objetivo | Dependencias | Superficies | Riesgo | Tests | Criterio de cierre |
|---|---|---|---|---|---|---|
| **SB-01** | Contract test de operativa | — | 7 | Bajo | +`supersearch-operational-contract.test.ts` | El test falla si cambia handler, parámetro, endpoint, default, reset de página o política de submit |
| **SB-02** | Baseline geométrico | SB-01 | 7 | Bajo | +`supersearch-geometry-baseline.spec.ts` | Baseline verde en 13 viewports; artefactos fuera de `docs/` |
| **SB-03** | Desacoplar altura ↔ `limit` | SB-02 | 7 | **Alto** | `useAdaptiveItemsPerPage` unit + `supersearch-limit-invariance.test.ts` | `limit` por viewport idéntico antes/después con barra de 32, 48 y 64 px |
| **SB-04** | S5 → primitivas | SB-03 | S5 | Medio | Realinear `admin-users-roles-enterprise-density.test.ts` | Filtros con mismo efecto; `setOffset(0)` conservado sólo donde existe hoy |
| **SB-05** | S4 → primitivas | SB-03 | S4 | Bajo | Realinear `frontend-admin-clinics-management-card.test.ts` | Filtrado en cliente idéntico; paginación hermana intacta |
| **SB-06** | Origen y ancho únicos | SB-04, SB-05 | 7 | Medio | SB-02 con tolerancia ±1 px | x y ancho iguales en las 7 al mismo viewport |
| **SB-07** | Retirar `StickyFilterBar` | — | — | Bajo | Ajustar los 3 tests que lo referencian | `git grep StickyFilterBar` sin resultados en `frontend/src` |
| **SB-08** | Campo primario + chips | SB-06 | 7 | **Alto** | Realinear las 4 plantillas de grid ancladas | Todos los filtros accesibles; orden de tabulación intacto; 0 desbordamiento |
| **SB-09** | Banda 768–1023 | SB-08 | 7 | Medio | SB-02 en 834 y 768 | Banda ≤ 64 px en 768–1023; sin wrap |
| **SB-10** | `SuperSearchField` | SB-08 | 7 | Medio | +unit de la primitiva | 48 px ±1, radio 24, `clamp` verificado |
| **SB-11** | `SuperSearchChip` + overflow | SB-10 | 7 | Medio | +unit + E2E de teclado | Chip 32 px ±1, radio 8; popover operable por teclado |
| **SB-12** | `SuperSearchActions` | SB-11 | 7 | Bajo | +unit | `min-width` 88 px ±2 en las 7 |
| **SB-13** | Tokens visuales (claro + oscuro) | SB-12 | 7 | Medio | +regresión visual en ambos temas | Valores de §15 dentro de tolerancia; sin sombra en chrome |
| **SB-14** | Estados | SB-13 | 7 | Bajo | +E2E de estados + axe | Los 11 estados de §15.5 verificados |
| **SB-15** | Microgeometría | SB-14 | 7 | Bajo | SB-02 con ±1 px | Padding/gap/baseline dentro de ±1 px |
| **SB-16** | Validación y rollout | SB-15 | 7 | Bajo | Suite completa + axe + performance | Todos los gates de §20 en verde |
| **BUG-01** | Política de render condicional | SB-01 | S6, S7 | Medio | +test de estado vacío | Política decidida, documentada y testeada |
| **BUG-02** | `line-height` en S5 | — | S5 | Bajo | Realinear density test | `line-height` ≥ 1.25 × `font-size` |
| **BUG-03** | Accesibilidad semántica | — | 7 | Bajo | +axe acotado | `role="search"` en las 7; axe sin violaciones críticas |

**Total: 19 PR.** Ningún PR mezcla arquitectura, cambio funcional, rediseño, bug, seguridad, visor, PWA ni dependencias.

**Rollback lógico:** todos los PR son revertibles con `git revert` sin migraciones ni cambios de esquema. SB-03 es el único con riesgo funcional real; su reversión restaura el acoplamiento original, que es el estado actual y está probado en producción.

---

## 19. Plan de pruebas

### 19.1 Contract tests (operativa idéntica)
Para las 7 superficies: mismos handlers · mismos nombres de parámetro · mismos endpoints · mismos `limit` por viewport · mismos defaults · mismos estados de carga y error · mismos permisos · mismo momento de consulta (submit vs `onChange`) · misma normalización de `to` a fin de día · mismo reset de página por control · misma política de renderizado condicional.

### 19.2 Unit tests
Render de cada primitiva · props y variantes · estado activo del chip · overflow con N chips · `disabled` · `loading` · truncamiento · `clamp` de ancho.

### 19.3 E2E
Aplicar · limpiar · actualizar · buscar · cambiar de página · volver atrás · recargar · **conservar parámetros de URL en S1** · cambiar viewport en caliente (verifica SB-03) · navegación completa por teclado (Tab / Shift+Tab / Enter / Escape en popovers) · apertura y cierre del menú de desbordamiento.

### 19.4 Regresión visual
7 superficies × 13 viewports × 2 temas × estados {inicial, hover, focus, filtros activos, loading, error, disabled, vacío}. Artefactos **fuera de `docs/`** (precedente registrado: la evidencia PNG ensucia `docs/audit`). Recordar que Playwright borra `test-results/` al inicio de cada corrida: preservar el «antes» fuera de ese directorio.

### 19.5 Accesibilidad
`@axe-core/playwright` acotado a cada barra, en ambos temas · verificación de `role="search"` · orden de tabulación · foco visible bajo `forced-colors` · contraste ≥ 4.5:1 en texto y ≥ 3:1 en bordes de control · touch targets ≥ 44 px en < 768 px · anuncio del conteo por live region.

### 19.6 Rendimiento
Re-renders por pulsación en el campo primario · layout shift al montar la barra · reflow provocado por `ResizeObserver` · peso CSS antes/después · duplicación eliminada · tiempo hasta interactivo del módulo · estabilidad en viewport corto (768 × 600).

### 19.7 Comandos de validación (Terminal 1)

```powershell
pnpm --dir frontend lint
```

```powershell
pnpm --dir frontend typecheck
```

```powershell
pnpm validate:local
```

Terminal 2, tras `pnpm --dir frontend build`:

```powershell
pnpm --dir frontend e2e
```

> **Higiene obligatoria entre pasadas:** `pnpm e2e` levanta `next dev`, que reescribe `frontend/next-env.d.ts`. Revertirlo antes de `pnpm test` o varios tests de scope fallarán. Si se editó `globals.css` con el dev server caído, borrar `frontend/.next` antes de volver a correr Playwright (Turbopack sirve CSS previo a la edición).

---

## 20. Riesgos y mitigaciones

| # | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | Un cambio de CSS altera el `limit` enviado a producción | **Alta** si no se aplica SB-03 | **Crítico** | SB-03 antes que cualquier PR geométrico + test de invariancia de `limit` |
| R2 | Realinear tests de contrato degenera en debilitarlos | Media | Alto | Prohibido eliminar aserciones; censar anclas con `git grep` antes de tocar cada archivo |
| R3 | Romper la query string de S1 al extraer componentes | Media | Alto | S1 conserva `<form method="get">`; E2E que carga una URL con los 6 filtros y verifica el resultado |
| R4 | Romper el contrato zero-scroll | Media | Alto | SB-02 mide desbordamiento en los 13 viewports en cada PR |
| R5 | Perder filtros al mover controles al overflow | Media | **Crítico** | Contract test que enumera los filtros alcanzables por superficie, no los visibles |
| R6 | Degradar accesibilidad al sustituir `select` por chip+popover | Media | Alto | El popover debe exponer `listbox`/`dialog` con teclado completo; axe en SB-11 y SB-14 |
| R7 | El tema oscuro queda sin cubrir | **Alta** | Medio | La medición base fue en claro. SB-13 obliga a regresión visual en ambos temas |
| R8 | Regresión sólo visible en clínica al validar en admin | Media | Medio | Las 7 superficies en cada gate, no sólo las 5 de las imágenes |
| R9 | Flake por carrera de hidratación en E2E | Media | Bajo | `toPass` para geometría, como ya hace la suite |
| R10 | Animar la altura provoca *thrash* de `ResizeObserver` → `limit` oscilante | Baja | Alto | Prohibido animar la altura de la banda; sólo `background-color` |

---

## 21. No alcance

- Implementar cualquiera de los 19 PR.
- Header de aplicación (92.33 px) y encabezado de módulo (82–126.27 px): **PR-ADJ-01** y **PR-ADJ-02**, requieren autorización separada. Sin ellos la brecha de chrome con Drive no se cierra (§14.1).
- Altura de fila de datos (35.66–41 px vs 48 px de Drive): altera `itemHeightPx` → `limit`. Operativa protegida.
- Backend, SQL, base de datos, migraciones, RLS.
- Dependencias nuevas. La propuesta se implementa con Tailwind, Radix y `lucide-react` ya presentes.
- PWA y service worker: descartado con evidencia — la política PWA del proyecto prohíbe cachear `/dashboard/*` y `/dashboard/admin/*`, por lo que no puede servir versiones obsoletas de estas superficies.
- Buscador público de profesionales.
- Cualquier operación de git o de despliegue.

---

## 22. Gates de implementación y staging

| Gate | Condición | Cuándo |
|---|---|---|
| G1 — Operativa congelada | SB-01 en verde y mergeado | Antes de SB-03 |
| G2 — Baseline capturado | SB-02 en verde; artefactos archivados fuera de `docs/` | Antes de SB-03 |
| G3 — Desacoplamiento probado | `limit` idéntico por viewport con barra de 32, 48 y 64 px | Antes de SB-04 |
| G4 — Paridad de primitivas | Las 7 superficies usan las mismas primitivas | Antes de SB-08 |
| G5 — Zero-scroll | 0 px de desbordamiento en 13 viewports | En cada PR desde SB-06 |
| G6 — Accesibilidad | axe sin violaciones críticas ni serias en ambos temas | Antes de SB-16 |
| G7 — Regresión visual | Capturas aprobadas manualmente en 7 × 13 × 2 | En SB-16 |
| G8 — Validación local | `lint` + `typecheck` + `build` + `validate:local` en verde | En cada PR |
| G9 — Staging | Deploy Live en el commit esperado; las 7 superficies operativas con datos reales; auditoría sin secretos | Tras SB-16 |
| G10 — Monitoreo | Sin incremento de 4xx/5xx en los endpoints de las 7 superficies durante 48 h | Post-staging |

**Rollback:** `git revert` del PR afectado. Sin migraciones ni cambios de esquema en ninguno de los 19.

---

## 23. Criterio final de aceptación

La implementación futura sólo será correcta cuando, simultáneamente:

1. La operativa de las 7 superficies sea idéntica (SB-01 en verde).
2. No cambien API, URL, nombres de parámetro, filtros ni resultados.
3. **El `limit` enviado por viewport sea idéntico al baseline** (G3).
4. No haya regresiones de seguridad: separación de sesión intacta, sin exposición de tokens, `data-*` sin lexemas sensibles.
5. Las medidas de §15 estén implementadas dentro de su tolerancia declarada.
6. La composición se aproxime objetivamente a Drive: un campo primario dominante + filtros secundarios degradados a chips.
7. La cobertura neutra sea ≥ 90 % y no haya sombra en el chrome persistente.
8. No exista desbordamiento horizontal en ninguno de los 13 viewports.
9. El contrato zero-scroll se conserve.
10. Mobile siga siendo operativo con touch targets ≥ 44 px.
11. axe no reporte violaciones críticas ni serias en ambos temas.
12. Todos los contract tests y E2E pasen.
13. Las capturas de regresión visual estén aprobadas.
14. No haya duplicación CSS innecesaria (`.field-select` consolidado, `StickyFilterBar` resuelto).
15. No se hayan añadido dependencias.

---

## 24. Datos no determinados y evidencia faltante

Ver §15.8 para la tabla completa. Resumen: geometría en runtime de S7 · valores en tema oscuro de las 7 superficies · estado `pressed` · ratios de contraste WCAG medidos · viewport CSS exacto de las 5 capturas del propietario (irrelevante para el destino) · coste de rendimiento del cambio.

Ninguna cifra de este documento fue inventada. Donde faltó medición se escribió **NO DETERMINADO CON LOS DATOS DISPONIBLES** junto con la medición concreta que la resolvería.

---

## 25. Conclusión técnica

Los superbuscadores de VETNEB **funcionan**. Su operativa es real, sus controles están atados a acciones verificadas, las fronteras de sesión están intactas, no exponen datos sensibles y el contrato zero-scroll se cumple sin una sola excepción en 78 mediciones. Ése es el punto de partida, y es bueno.

La distancia con Drive no es de píxeles: es de **composición**. Drive resuelve la búsqueda con un campo dominante de 832 px y degrada todo lo demás a chips de 128 px que abren popovers. VETNEB reparte el ancho en fracciones aproximadamente iguales entre seis y ocho campos equivalentes, sin jerarquía, y como consecuencia no tiene campo de búsqueda primario en ninguna de sus siete superficies. Ninguna cantidad de ajuste de padding, radio o color corrige eso.

Hay además tres hallazgos que condicionan cualquier intervención y que no eran visibles desde las imágenes:

- **La altura de la barra determina el `limit` que se envía al backend.** Es el hallazgo más importante de esta auditoría. Convierte lo que parecía un encargo puramente visual en uno que empieza por un cambio de arquitectura. Cualquier plan que ignore esto enviará paginaciones distintas a producción creyendo que sólo cambió CSS.
- **La geometría está congelada por tests de contrato de fuente**, incluida la altura de control y las plantillas de grid literales. Es gestionable, pero hay que censarlo antes de cada PR, no descubrirlo al correr la suite.
- **La superficie está invertida:** Drive tiñe el campo y deja el contenedor transparente; VETNEB hace exactamente lo contrario. Corregir esa inversión es el cambio de mayor impacto perceptual por unidad de riesgo de todo el plan.

Conviene además ser explícito sobre un límite del encargo: el superbuscador aporta 42 px de los 323 px de chrome que separan el borde superior de la tarjeta de la primera fila de datos. Rediseñarlo entero, perfectamente, cierra como mucho un tercio de la brecha de densidad con Drive. Los otros dos tercios están en el header de aplicación y en el encabezado de módulo, que quedan fuera de este alcance. Prometer paridad de densidad con Drive interviniendo sólo el superbuscador sería inexacto, y por eso se deja registrado aquí y en §21 en lugar de disolverlo en el roadmap.

El plan resultante son 19 PR pequeños e independientes, ordenados de contratos a microgeometría, con la operativa congelada por test antes de tocar el primer píxel. Es implementable sin dependencias nuevas, sin migraciones y con rollback lógico en cada paso.
