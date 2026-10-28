# DRV · Medición comparativa Google Drive ↔ VETNEB

| Campo | Valor |
| --- | --- |
| Tipo | Auditoría comparativa de caja blanca con medición runtime. Docs-only |
| Rama / HEAD | `audit/dashboard-drive-vetneb-comparativa-20261024` @ `c8b66052b6f5a3eef1e11926f68ed5902c68fdb9` (= `origin/main`) |
| Fecha | 2026-10-24 |
| Rol documental | Evidencia y planificación. **No** fija destinos: los destinos siguen en el rector (§45–§46) |
| Jerarquía aplicada | `AGENTS.md` → rector `AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md` → código y contratos ejecutables → referencia Drive → propuesta v2 |
| Riesgo de esta entrega | R0 (lecturas Git/GitHub/código, sondas temporales fuera del repositorio) + R1 docs-only (este archivo) |

> **Reconciliación 2026-10-28.** Las secciones §1–§15 son el registro histórico del 2026-10-24 sobre `c8b66052` y se conservan sin cambios. El estado vigente sobre `main@a2c87912`, la matriz de evolución y el roadmap restante están en **§16**. Donde §1–§15 y §16 difieran, §16 describe el estado actual y §1–§15 el estado medido en su fecha.

Convención de procedencia usada en todo el documento:

- **[MEDIDO]**: valor leído por las sondas de esta auditoría sobre `c8b66052` (§3).
- **[CÓDIGO]**: lectura estática del árbol en `c8b66052`.
- **[HISTÓRICO]**: valor de un acta o de una ejecución anterior, no re-ejecutado aquí.
- **[DRIVE]**: valor de `GOOGLE_DRIVE_REFERENCIA_UI_CONSOLIDADA.md` con su estado (OBSERVADO / DERIVADO / INFERIDO / NO RESUELTO).
- **[INFERIDO]**: hipótesis no demostrada.

---

## 1. Resumen ejecutivo

1. **Dos hipótesis de la propuesta v2 pasan a desviaciones medidas.**
   - **DRV-01 confirmado.** Las columnas reveladas por viewport invierten la densidad en 1279 → 1280 px.
     - A 1279 × 800 la tabla tiene **1164.75 px** de contenedor y oculta una columna `xl:`.
     - A 1280 × 800 el contenedor cae a **989.75 px** (−175 px), la columna aparece y el truncado sube de 0 a 10 celdas (Auditoría), a 17 (Usuarios) y a 9 (Informes admin).
     - A 1440 × 900 el contenedor es de 1139.81 px, *más estrecho* que a 1279 px, y muestra las 7 columnas. [MEDIDO]
   - **DRV-03 confirmado.** Con un filtro aplicado, S2 y S3 muestran **0 chips** en los 6 viewports medidos entre 360 y 1279 px. El disparador móvil «Filtros» no indica el recuento. A partir de 1280 px, en cambio, el chip aplicado se ve en todos los anchos medidos. [MEDIDO]
2. **DRV-02 queda medido, pero no hay defecto funcional.** La cuadrícula de 3 columnas fijas produce tarjetas de 520.73 × 93.77 px a 1920 × 1080 (proporción 5.55). Drive tendría 6 columnas en ese contenedor. Sin embargo, los defectos de legibilidad aparecen en el extremo **estrecho**:
   - Clínicas admin: 15/15 tarjetas truncadas a 1024 px y 26/26 a 834 px.
   - Informes clínica (ruta completa): tarjetas de 185.56 px a 1024 px, con 15 truncados.

   Además, la altura de tarjeta (75–109 px) diverge del destino del rector (176 px, §46). [MEDIDO]
3. **G11 no está completo.** Los cuatro correctivos con prefijo G11 están fusionados: #1901, #1904, #1905 y #1907. Pero la re-verificación 21 × 2 de esta auditoría encuentra **9 de 84 registros** con violaciones `serious`:
   - **V-4** (contraste 3.92 en `FullModuleRouteControl`, 390 px, claro) y **V-5** (contraste 3.03 en Tokens clínica, oscuro) siguen abiertos.
   - Hay **dos hallazgos nuevos** `label-content-name-mismatch`, en Sesiones admin y en el módulo Logística de clínica.
   - No existe el test formal de cobertura 21 × 2. [MEDIDO] [CÓDIGO]
4. **VETNEB conserva sus ventajas sobre Drive.** Lo medido:
   - 0 px de scroll de documento en las 231 combinaciones medidas, incluidas 1920 × 945, 1280 × 800 y 1279 × 800, que A02 no cubre.
   - App bar de 55.33 px también a 1280 × 800: B3 sólo existe con alto ≤ 760 px.
   - `main` 58 px más ancho que Drive a partir de 1280 px y 234 px más ancho a 1024 px.
   - Primer bloque de contenido por encima de la primera fila de Drive (y = 223) en 20 de las 21 superficies a 1920 × 945. La excepción es `clinic-informes-full` (236.33), que sigue dentro de G9. [MEDIDO]
5. **Siguiente PR recomendada:** un correctivo G11 de nombres accesibles (`label-content-name-mismatch`), llamado aquí **G11-e**. Va antes que cualquier mejora visual DRV, porque el rector exige G11 «antes de C26» (§58). Detalle en §12.

---

## 2. Baseline Git verificable

| Elemento | Valor | Fuente |
| --- | --- | --- |
| Rama activa | `audit/dashboard-drive-vetneb-comparativa-20261024` (la obligatoria; no se cambió) | `git branch --show-current` |
| HEAD | `c8b66052b6f5a3eef1e11926f68ed5902c68fdb9`, «fix(dashboard): stabilize C21 row borders (#1914)», 2026-10-24 17:46:10 −0300 | `git log -1` |
| `origin/main` | `c8b66052…` (ref local); ahead/behind 0/0. Confirmado por `gh api repos/LABVETNEB/PORTAL-VETNEB/commits/main` = `c8b66052…`. Sin `git fetch` (no se actualizó nada) | R0 |
| Tracked | Sin modificaciones; `git diff --stat`, `--check` y `--name-only` vacíos | al inicio y al cierre |
| Untracked preexistentes (preservados) | `frontend/AGENTS.md` y `frontend/CLAUDE.md`, que regenera `next dev`. No son contrato del repositorio | `git status --short --untracked-files=all` |
| Stashes (5, intactos) | `stash@{0}`…`stash@{4}` (test/wbr-01…, main safety, e2e extended, docs global-dashboard, clinic profile retry) | `git stash list` |
| Worktrees | Sólo `C:/PORTAL-VETNEB` | `git worktree list` |
| `AGENTS.md` tracked | Sólo el raíz. `frontend/AGENTS.md` es untracked y lo genera `next dev`: no aplica como contrato | `git ls-files` |
| Propuesta v2 | No está en el árbol. Leída con `git show 6ac9695d:docs/audit/PROPUESTA_EVOLUCION_DASHBOARD_VETNEB_DESDE_DRIVE.md` (`origin/docs/dashboard-drive-evolution-proposal`, no ancestro de HEAD) | R0 |
| CI de `main@c8b66052` | Backend CI success (run `40131270897`) · Frontend CI success (run `40131270889`) | `gh run list --commit` |
| PR abierta | #1909 (Dependabot frontend; el cuerpo de #1911 declara que la sustituye; sigue abierta) | `gh pr list --state open` |
| Herramientas | Node v24.14.1, pnpm, gh, Playwright de `frontend/node_modules`, `@axe-core/playwright` 4.14.0 (#1911) | `which`, `node -v` |

### 2.1 PR fusionadas relacionadas

| PR | Título | Merge commit | `mergedAt` (UTC) |
| --- | --- | --- | --- |
| #1891 | C25 partial focus and typography hardening | `b06f75c0` | 2026-10-19T04:16:13Z |
| #1893–#1897 | C23b PR1–PR5 | … `9dfb5024` (#1897) | 2026-10-20T23:26:42Z (#1897) |
| #1898 | DRV03 forced-colors overlay focus | `ceb77bd3` | 2026-10-21T12:01:10Z |
| #1899 | BUG03 semantic search landmarks | `a696daec` | 2026-10-21T17:41:53Z |
| #1900 | DRV02 skip to content | `ca032b1a` | 2026-10-21T22:46:14Z |
| #1901 | G11-a accessible names | `f4d38e07` | 2026-10-22T02:03:45Z |
| #1904 | G11-b ModuleTabs accessibility | `e1dc6722` | 2026-10-22T11:11:30Z |
| #1905 | G11-c clinical alert contrast | `f75278dc` | 2026-10-22T13:42:40Z |
| #1906 | test: C22 dialog axe animation race | `d59b227d` | 2026-10-22T16:42:30Z |
| #1907 | G11-d maintenance heading order | `668009d8` | 2026-10-22T23:29:06Z |
| #1911 | fix(deps): align frontend dependencies and accessibility (axe 4.13 → 4.14) | `5a4fb1e7` | 2026-10-23T11:39:21Z |
| #1917 | docs: C26 G11 readiness | `86199d6f` | 2026-10-24T02:18:03Z |

---

## 3. Metodología y entornos

### 3.1 Instrumentos

Se escribieron tres sondas **fuera del repositorio**, en el scratchpad de la sesión. Ninguna toca `frontend/e2e/`, el catálogo, los censos, los fixtures ni los baselines. Las tres reutilizan sin modificarlos los helpers A02 de `frontend/e2e/helpers/dashboard-geometry-matrix.ts`:

- `DASHBOARD_GEOMETRY_SURFACES` y sesiones `populated`;
- `installSurfaceMocks`, `assertSurfaceLoaded`, `trackDataRequests`;
- `resizeSurfaceViewport`, `measureSurfaceGeometry` (tres lecturas idénticas tras un ciclo de render y datos drenado);
- `suppressNextDevChrome`.

Las ejecuta la configuración del repositorio (`frontend/playwright.config.ts`) importada sin cambios, con `testDir`, `outputDir`, reporter y teardown redirigidos al scratchpad.

| Sonda | Qué mide | Resultado de ejecución |
| --- | --- | --- |
| Geometría DRV | 21 superficies × 11 viewports. Mide el registro A02 completo y además: drawer/rail, buscador de módulos, `SuperSearchField`, barra de filtros, columnas visibles/ocultas, anchos de columna, alto y paso de fila, cabecera, estilos computados de `td`/`th`, truncado (regla de la sonda C25: `text-overflow: ellipsis` o `nowrap` + `overflow: hidden` con `scrollWidth > clientWidth`), cuadrícula C24 en ≥ 768 px y filtros aplicados en S2/S3 | `21 passed (2.5m)`, exit 0 |
| Complementaria | Cuadrícula de `clinic-informes-full` (7 viewports) y geometría del chip aplicado en S3 | `2 passed (10.0s)`, exit 0 |
| Re-verificación G11 | Mismo método que el inventario de `dashboard-drv-c26-readiness.md` §17.1: documento completo, `wcag2a/2aa/21a/21aa`, **sin `disableRules`**, temas `normal` y `dark-gray`, 1366 × 768 + 390 × 844 | `42 passed (1.4m)`, exit 0 (84 registros) |

Viewports de la sonda geométrica:

- Los seis de Drive §XIII.1: 1920 × 945, 1920 × 1080, 1440 × 900, 1366 × 768, 1280 × 800 y 1024 × 768.
- 1279 × 800, como frontera del régimen rail.
- Cuatro del censo A02 de tablet y teléfono: 834 × 1194, 768 × 1024, 390 × 844 y 360 × 800.

### 3.2 Calibración de la sonda contra A02

En los 8 viewports canónicos de A02 incluidos (1920 × 1080, 1440 × 900, 1366 × 768, 1024 × 768, 834 × 1194, 768 × 1024, 390 × 844 y 360 × 800), cada registro medido se comparó con el baseline congelado `frontend/e2e/fixtures/dashboard-geometry-baseline.ts` (Win32) usando `compareGeometryRecords`, con las tolerancias propias de A02. Resultado: **168 / 168 registros con 0 diferencias**. La sonda reproduce el instrumento A02, y sus lecturas en 1920 × 945, 1280 × 800 y 1279 × 800 son comparables con el mismo rigor. [MEDIDO]

### 3.3 Entorno y límites de homogeneidad

- Windows 11 (`win32`), Chromium de Playwright, `next dev` y API de fixture en 3107, DPR 1, `reducedMotion: reduce`, tema claro en la sonda geométrica. Una sola tarea pesada por vez (AGENTS §8).
- Datos sintéticos del fixture. No se registraron textos del fixture: sólo cajas, estilos computados y recuentos. No se accedió a datos reales ni a `C:\REA-LAB`.
- Drive mide una vista (Mi unidad, 37 elementos, cuenta real, Chrome 155, `mobile: false`); VETNEB, 21 superficies con fixture. Drive fija `body { min-width: 1000px }`, así que sus anchos ≤ 768 son escritorio estrecho, no móvil [DRIVE §I.4]. Los recuentos absolutos (filas, elementos) no son comparables.
- Reglas Drive §XIII.1 aplicadas: un valor INFERIDO o NO RESUELTO sólo admite NO_COMPARABLE; agregación por categoría sin puntuación global.

### 3.4 Higiene

- La primera ejecución de prueba (una superficie) falló en el `globalTeardown` del repositorio al cargarse desde la configuración externa (`SyntaxError … does not provide an export named 'cleanupOwnedWindowsWebServers'`). Por eso no se ejecutó `restoreNextEnvHygiene`, y `frontend/next-env.d.ts` quedó con las referencias `./.next/dev/types/…`.
- Se restauró con el propio helper del repositorio (`restoreNextEnvHygiene`, ejecutado en un proceso Node aislado) y se verificó: el hash del archivo volvió a `ce4e94a6`, el blob de HEAD. Las corridas siguientes usaron un teardown que invoca el del repositorio en un proceso aparte.
- Al cerrar: `git status` muestra sólo los dos untracked previos, los puertos 3000 y 3107 están libres, y no hay `test-results/` ni `playwright-report/` nuevos en el árbol (el `outputDir` y el reporter apuntaban al scratchpad).

---

## 4. Inventario arquitectónico actual

Censo con `git grep` de JSX (`<Nombre` seguido de espacio, `>`, `/` o fin de línea) en `frontend/src`, en `c8b66052`. «Archivos» cuenta los archivos con uso JSX, fuera del archivo que lo define, salvo donde se indica. [CÓDIGO]

| Componente del rector (§47) | Implementación real | Consumidores JSX | Estado |
| --- | --- | --- | --- |
| `WorkspaceAppShell` | **No existe con ese nombre.** El shell se compone con `DashboardShellRouter` (monta `SkipToContent`, #1900) y `DashboardNavigationFrame` (`[data-vetneb-app-shell="true"]`) | — | Implementado bajo otros owners |
| `WorkspaceAppBar` | `components/dashboard/WorkspaceAppBar.tsx` | 1 (`DashboardTopbar`) | Implementado y usado (admin y clínica) |
| `NavigationDrawer` / `NavigationRail` | `components/dashboard/NavigationDrawer.tsx` / `NavigationRail.tsx` | 1 cada uno (`DashboardNavigationFrame`) | Usados; drawer ≥ 1280 y rail 768–1279.98 (`navigation.css:247,253`) |
| `WorkspaceScaffold` | `ModuleSurface.tsx` | 4 externos (`ClinicFullRouteModuleStage`, `ClinicMobileModuleFrame`, `DashboardModuleWorkspace`, `DashboardPageHeader`) | Usado |
| `WorkspaceHeader` | `WorkspaceHeader.tsx` | 1 (`ModuleSurface`) | Usado vía `ModuleSurface` |
| `ModuleSurface` | `ModuleSurface.tsx` | 1 (`AdminCommandCenter`) | Usado |
| `WorkspaceToolbar` | **No existe**. El patrón DefaultToolbar ⇄ `SelectionToolbar` vive en cada superficie; el guard B10 lo lista como nombre reservado (`dashboard-b10-clinic-shell-unification.test.ts:106`) | — | No implementado como componente |
| `FilterRegion` | **No existe**. El owner es `components/dashboard/FilterBar.tsx` | `FilterBar`: 6 archivos | Implementado bajo otro nombre |
| `SuperSearchField` | `features/dashboard/presentation/filters/SuperSearchField.tsx` | 2 (`AdminReportsCard` S3, `AdminParticularTokensCard` S2 móvil) | Parcial |
| `ContentList` | `components/ui/table.tsx` | 23 | Adopción amplia |
| `ContentGrid` | `features/dashboard/presentation/surfaces/ContentGrid.tsx` | 3 (`AdminReportsCard`, `AdminClinicsManagementCard`, `InformesReportsList`) | Usado; columnas fijas 3 / 3 / 2 |
| `CollectionPager` | `components/dashboard/DashboardPager.tsx` | 10 externos (más `CompactPager` como adaptador) | Usado |
| `SelectionToolbar` | `features/dashboard/presentation/surfaces/SelectionToolbar.tsx` | 3 (`AdminAuditCard`, `AdminMobileAuditModule`, `AdminReportsCard`) | Parcial |
| `UtilitySidePanel` | `ModuleSurface.tsx` (slot `details`) | 0 externos; `details=` sin consumidores productivos | **Disponible sin consumidor** |
| `ModuleTabs` | `components/dashboard/ModuleTabs.tsx` | 2 (`AdminPricingEditorCard`, `admin/page.tsx`) | Usado; IDREF normalizados por #1904 |

Mecanismo responsive de tablas:

- 0 `@container` / `container-type` en `frontend/src`.
- Columnas por viewport: una `lg:table-cell` y una `xl:table-cell` (cabecera + celda) en `AdminAuditDenseTable`, `AdminParticularTokensCard`, `AdminReportsCard` y `AdminSessionsReadOnlyCard`, y sólo `xl:` en `AdminUsersRolesReadOnlyCard`. [CÓDIGO]

Escalones por alto:

- `@media (max-height: 760px)` en `responsive.css:107,237,346,359`, `tokens.css:294` y `zero-scroll.css:396`.
- `navigation.css:286` (rail con `max-height: 759.98px`). [CÓDIGO]

---

## 5. Mediciones Drive ↔ VETNEB

Valores VETNEB [MEDIDO] salvo indicación. Comparación: IGUAL (dentro de la tolerancia de Drive §XIII.2), DIFERENTE, AUSENTE, NO_COMPARABLE.

### 5.1 Shell y regiones

| Métrica | Viewport | Drive | VETNEB | Rector (§46) | Comparación |
| --- | --- | --- | --- | --- | --- |
| Alto del header | 1920 × 945, 1920 × 1080, 1440, 1366, 1280 × 800, 1279 × 800, 1024, 834, 768 | 64 (OBSERVADO, invariante) | **55.33** en las 21 superficies | 56 ± 2 | DIFERENTE (−8.67); dentro del rector |
| Alto del header | 390, 360 | 64 (escritorio estrecho) | 48 | — | NO_COMPARABLE |
| B3 (app bar a 1280 × 720) | 1280 × 800 | — | 55.33: el escalón no se activa con alto 800 | 56 ± 2 | Confirma que B3 depende del alto ≤ 760 px |
| Navegación lateral | ≥ 1280 | sidebar 224 en x = 16 (OBSERVADO) | drawer **255** (x 0) | 256 ± 1 | DIFERENTE; dentro del rector |
| Navegación lateral | 1024, 1279, 834, 768 | sidebar 224 (no colapsa) | rail **79** | 80 ± 1 | DIFERENTE; dentro del rector |
| `main.x` | ≥ 1280 / 768–1279 | 257 | 255 / 79 | — | DIFERENTE |
| `main.width` | 1920 / 1440 / 1366 / 1280 / 1024 | 1607 / 1127 / 1053 / 967 / 711 (viewport − 313, DERIVADO) | 1665 / 1185 / 1111 / 1025 / 945 | — | DIFERENTE: +58 px en ≥ 1280; +234 px a 1024 |
| `main.width` en la frontera | 1279 × 800 | — | **1200** (vs 1025 a 1280 × 800) | — | Discontinuidad −175 px medida (antes DERIVADA en la v2) |
| Ancho de la tabla (Informes admin) | 1920 / 1440 / 1366 / 1280 / 1024 | 1567 / 1087 / 1013 / 927 / 671 | 1578.22 / 1107.81 / 1035.28 / 957.75 / 881.84 | — | DIFERENTE (VETNEB más ancho en todos) |
| Rail derecho | ≥ 1366 | 56 | ausente | — | AUSENTE (intencional) |
| Scroll de documento | 231 combinaciones | `overflow-x` bajo 1000 px (OBSERVADO) | **0 / 0** en las 231 (x / y) | A08: 0 | DIFERENTE; VETNEB cumple A08 también en 1920 × 945, 1280 × 800 y 1279 × 800 |
| y de la primera fila | 1920 × 945 | 223 (175 + 48 de cabecera, DERIVADO) | `admin-clinicas` 150.33 · `admin-usuarios` 157.83 · `admin-auditoria` 162.83 · `admin-sesiones` 167.83 · `admin-informes` 189.33 · `clinic-log-rutas`/`visitas` 196.33 · `clinic-informes` 208.83 · `admin-tokens` 220.83 · `clinic-logistica-full` 222.33 · **`clinic-informes-full` 236.33** | Chrome ≤ 240 px (G9) | DIFERENTE: 20/21 superficies empiezan antes que Drive (las no listadas, sin colección, entre 68.33 y 122.27); `clinic-informes-full` 13.33 px por debajo, dentro de G9 |
| Chrome / viewport, máximo | 1280 × 800 | — | 0.285 (`clinic-informes-full`), 0.271 (`admin-tokens`) | ≤ 0.32 en 768–1366 | Dentro del rector |

### 5.2 Buscadores, filtros y chips

| Métrica | Drive | VETNEB | Rector | Comparación |
| --- | --- | --- | --- | --- |
| Buscador del header | `form[role=search]` 722 × 48, radio 24 (OBSERVADO); contradicción 834 vs 722 con el rector (§XIV.4, NO RESUELTA) | Combobox de **módulos** 240 × 36 (≥ 1024) y 176 × 36 (768–1023), radio 6; ausente en teléfono | — | NO_COMPARABLE (función distinta) |
| Campo primario de contenido (S3) | — | `SuperSearchField` 555.27 × 40 a 1920; 282.25 × 40 a 1280 × 800; radio 20 | 40 alto, radio 20, `clamp(280px, 44%, 832px)` | Alto y radio dentro del rector |
| Chip de filtro aplicado (S3) | 32 alto, radio 8, borde 1, 14/500/16, separación 8 (OBSERVADO) | **32** alto × 111.31, radio **8**, borde **1**, 13/20/500, padding `0 12px`; idéntico de 1920 a 1280 | 32 ± 2, radio 8, `0 12px` | **IGUAL** en alto, radio y borde; tipografía DIFERENTE (13 vs 14) |
| Gap de la barra de filtros | chips 8 | 6 px (S1–S3, S7) | gap 8 (escala 4/8/12) | DIFERENTE (= deuda D6 de C25) |
| Filtros aplicados visibles | toolbar de chips invariante en 11 resoluciones (OBSERVADO) | S2 y S3: chip visible en ≥ 1280; **0 chips en 360, 390, 768, 834, 1024 y 1279**; el disparador móvil «Filtros» sin recuento | §62.8 «filtros progresivos» | DIFERENTE → **DRV-03 confirmado** |

### 5.3 Tablas

| Métrica | Drive | VETNEB | Rector | Comparación |
| --- | --- | --- | --- | --- |
| Alto y paso de fila | 48 / 48 | 36 / 36 (Auditoría, Clínicas, Informes, Sesiones, Tokens admin); 37 (Usuarios); 44 (Informes clínica); 52 (Rutas). Visitas: **52 / 61 / 101** según el viewport | Fila 40 ± 1 (C05 BLOCKED) | DIFERENTE (intencional; C05 R13) |
| Cabecera de tabla | 48 | 32 (admin), 44 (clínica) | 36 ± 1 | DIFERENTE (deuda D8 / C05) |
| Padding de celda | `0 6px` | `0 8px` (admin), `0 12px` (clínica) | `0 12px` | DIFERENTE con Drive; admin DIFERENTE con el rector |
| Tipografía de celda | 14 / 400 / 20 | 12/16/400 (Informes y Tokens admin), 13/19.5/400 (Auditoría, Informes clínica) | body-sm 13/20 (§45.2) | DIFERENTE |
| Tipografía de cabecera | 14 / 500 / 48 | 12/16/600 (admin), 12/16/700 (clínica) | label-md | DIFERENTE |
| Mecanismo de columnas | container queries 744 / 832 / 1126 sobre la tabla, demostrado con viewport fijo (DERIVADO, §VI.4) | por viewport (`lg:`/`xl:`) | — | DIFERENTE → **DRV-01 confirmado** (§7) |

### 5.4 Cuadrícula C24

| Superficie | Viewport | Contenedor | Columnas VETNEB | `floor((w + 16) / 236)` (fórmula Drive) | Tarjeta (ancho × alto) | Truncados / elementos |
| --- | --- | ---: | ---: | ---: | --- | --- |
| Informes admin | 1920 × 1080 | 1578.22 | 3 | 6 | 520.73 × 93.77 | 0 / 9 |
| Informes admin | 1440 × 900 | 1107.81 | 3 | 4 | 363.94 × 99.22 | 0 / 9 |
| Informes admin | 1280 × 800 | 957.75 | 3 | 4 | 313.91 × 102.44 | 0 / 9 |
| Informes admin | 1024 × 768 | 881.84 | 3 | 3 | 288.61 × 88.89 | 0 / 9 |
| Informes admin | 768 × 1024 | 629.94 | 3 | 2 | 204.64 × 107.77 | 2 / 9 |
| Clínicas admin | 1920 × 1080 | 1578.22 | 3 | 6 | 520.73 × 97.39 | 0 / 22 |
| Clínicas admin | 1366 × 768 | 1035.28 | 3 | 4 | 339.75 × 101.83 | 0 / 14 |
| Clínicas admin | 1024 × 768 | 881.84 | 3 | 3 | 288.61 × 103.09 | **15 / 15** |
| Clínicas admin | 834 × 1194 | 694.88 | 3 | 3 | 226.28 × 99.64 | **26 / 26** |
| Clínicas admin | 768 × 1024 | 629.94 | 3 | 2 | 204.64 × 106.80 | **21 / 21** |
| Informes clínica (ruta completa) | 1920 × 1080 | 719.03 | 2 | 3 | 347.52 × 76.23 | 2 / 17 |
| Informes clínica (ruta completa) | 1366 × 768 | 466.50 | 2 | 2 | 221.25 × 85.11 | 9 / 10 |
| Informes clínica (ruta completa) | 1024 × 768 | 395.13 | 2 | 1 | **185.56** × 86.36 | **15 / 10** (varios por tarjeta) |
| Informes clínica (ruta completa) | 768 × 1024 | 611.94 | 2 | 2 | 293.97 × 84.44 | 2 / 14 |

Notas:

- Gap 8 / 8 px (Drive 16 px). Radio 8 px (Drive 12; rector 12).
- Alto de tarjeta 75–109 px, frente a **176 px** del rector (§46) y a las tarjetas cuadradas de ≈ 247 px de Drive.
- 0 tarjetas recortadas verticalmente en todas las combinaciones.
- El módulo `clinic-informes` no muestra el conmutador: la cuadrícula de clínica sólo existe en la ruta completa (`InformesReportsList`).

[MEDIDO]

### 5.5 Teléfono (censo A02)

| Métrica | 390 × 844 / 360 × 800 |
| --- | --- |
| App bar | 48 px |
| Barra inferior | 51.19 px (y = 792.81 / 748.81) |
| Scroll de documento | 0 / 0 en las 21 superficies |
| Primera fila | y ≈ 55 en las colecciones admin |
| Drive | sin layout móvil con `mobile: false` → NO_COMPARABLE (§VI.5) |

### 5.6 No medido en esta auditoría

Estados hover y focus (C25 midió el foco; esta sonda no interactúa), color de la capa de hover, tooltips, menús, overlays, paneles laterales y tema oscuro geométrico. Estado: **NOT_RUN** (§14).

---

## 6. Matriz actualizada DRV-01 a DRV-13

Estados: Confirmado (medido), Hipótesis, Bloqueado, No comparable, Implementado.

| ID | Superficie / ruta | Owner | Viewport | Drive | VETNEB | Rector | Diferencia | Impacto | Riesgo | Estado | Acción | Test |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DRV-01 | Auditoría, Usuarios, Informes, Sesiones, Tokens admin (`?module=…`) | `AdminAuditDenseTable.tsx`, `AdminUsersRolesReadOnlyCard.tsx`, `AdminReportsCard.tsx`, `AdminSessionsReadOnlyCard.tsx`, `AdminParticularTokensCard.tsx` | 1279 vs 1280 × 800; 1440 | Columnas por contenedor (DERIVADO §VI.4) | 1279: contenedor 1164.75, 1 columna `xl:` oculta, 0 truncados. 1280: contenedor 989.75 (−175), todas visibles, truncados Auditoría 10 · Usuarios 17 · Informes 9. 1440: contenedor 1139.81 y todas visibles | Sin destino explícito; C25/PR-TRUNC | −175 px de contenedor; columnas: 6 → 7 con menos espacio | Visual y densidad. Los valores truncados tienen detalle (PR-TRUNC), así que no hay pérdida de información | R1 (frontend), A02/A03 a verificar | **Confirmado** | Corregir después de G11/C26, con una tabla piloto (PR-DRV-07) | Sonda de truncado antes/después en 1024–1440; A02 21/21; A03 sin drift; A08 |
| DRV-02 | Informes admin, Clínicas admin, Informes clínica (ruta completa) | `ContentGrid.tsx`, `collection-view.ts` y los 3 consumidores | 768–1920 | `floor((w + 16) / 236)`, gap 16 (DERIVADO) | 3 / 3 / 2 columnas fijas; tarjetas 185–521 px de ancho y 75–109 de alto; truncado total en Clínicas ≤ 1024 | Ítem 176 alto, radio 12, `minmax(176px, 1fr)` | 1920: 3 vs 6 columnas; 1024 (clínica): tarjeta 185.56 < 220 (pista mínima de Drive); alto −67 a −101 px vs §46 | Visual; legibilidad en el extremo estrecho | R1; A03 neutro por construcción (filas = f(`limit`)) | **Confirmado** (medido); el destino de alto 176 diverge del estado actual | Diferir (PR-DRV-08). Alternativa C de la v2 §11.2; no `auto-fit` | Spec C24 (13 vp), A03 sin drift, aserción nueva de ancho mínimo de tarjeta y de truncado |
| DRV-03 | S3 Informes admin, S2 Tokens admin | `AdminReportsCard.tsx:697-699`, `AdminParticularTokensCard.tsx:1379-1382` | 360–1279 | Chips persistentes (OBSERVADO §II.1) | 0 chips con un filtro aplicado en 360/390/768/834/1024/1279; disparador «Filtros» sin recuento | §62.8 | Estado aplicado invisible en 6 de 11 viewports medidos | Funcional (estado) y accesibilidad | R1 (recuento) / R13 posible (chips en 768–1279) | **Confirmado** | Diferir (PR-DRV-06), opción mínima: recuento | E2E con filtro aplicado en 390, 768, 1024 y 1279; A01 idéntico; A02/A03 |
| DRV-04 | S6, S7 (clínica) | `ClinicInformesWorkspaceSummary.tsx`, `ClinicParticularTokensCard.tsx` | Todos | Chips (OBSERVADO) | 0 `ActiveFilterChips` (sólo 3 usos, en S2/S3) [CÓDIGO] | §62.8 | Ausente | Funcional | R13 / §7.8 | Bloqueado (decisión D-03) | Diferir | — |
| DRV-05 | S1–S7 | 7 barras | — | 1 landmark `search` | `role="search"` en S1–S7 [CÓDIGO] | PR-BUG-03 | — | Accesibilidad | — | **Implementado** (#1899); P2-05 parcial (S2/S3/S4 sin `rangeLabel`: `git grep rangeLabel app/dashboard/admin` → sólo 7 archivos, ninguno S2/S3/S4) | No repetir | — |
| DRV-06 | Informes admin | `AdminReportsCard.tsx:802-804, 898-900` | ≥ 1280 | Menú de fila con acciones reales | `ActionMenu` con un único ítem «Ver detalle» [CÓDIGO] | — | — | Teclado | R1 | Bloqueado (D-04) | Diferir | Guard C17 |
| DRV-07 | Visitas escritorio (F-T1) y F-T2..F-T7 | `logistica/visitas/page.tsx:225,241`; `FieldVisitDetailDialog` sólo en `:179` | Escritorio | No es modelo (§III.6) | 6 truncados en la tabla de Visitas en todos los anchos de escritorio; fila de **52 / 61 / 101 px** (1920 / 1366 / 1280 × 800) | PR-TRUNC | — | Información | R1 + A03 posible | Confirmado (F-T1); resto sin cambios | Diferir (D-06) | PR-TRUNC; A02/A03 de Visitas |
| DRV-08 | Shell | `DashboardShellRouter.tsx` | — | 3 botones de salto | `SkipToContent` montado [CÓDIGO] | — | — | — | — | **Implementado** (#1900) | No repetir | — |
| DRV-09 | Overlays portados a `body` | `interactions.css` (bloque forced-colors) | — | `:focus-visible` 60/60 | Bloque `dashboard-drv03-…` [CÓDIGO] | §56.6 | — | — | — | **Implementado** (#1898) | No repetir | — |
| DRV-10 | Panel de detalle | `ModuleSurface.tsx` (`details`) | ≥ 1280 | A4 NO RESUELTO | 0 consumidores [CÓDIGO] | 336 ± 2 | — | — | R1/R13 | No comparable; depende de DRV-01 | Diferir | — |
| DRV-11 | Tokens globales | `tokens.css:135,186,188,228` | — | hover 8 %; 14/20 | hover 0.06 / 0.10; 13 px / 1.25 [CÓDIGO]. Celdas medidas 12/16 y 13/19.5 | §45.2: 8 %, 13/20 | Divergencia documental | Visual | R2 si toca tokens | Hipótesis (sin defecto demostrado) | Diferir (D-08) | — |
| DRV-12 | App bar a 1280 × 720 (B3) | `responsive.css:107` | 1280 × 720 | 64 | A02: 68.11 [HISTÓRICO]; a 1280 × 800: **55.33** [MEDIDO] | 56 ± 2 | +12.11 sólo con alto ≤ 760 | Geometría | R13 (A03) | Confirmado, acotado al escalón de alto | Correctivo separado (D-05) | A02/A03 |
| DRV-13 | Deuda C25 D5–D8 | `DashboardMobileNav`, `navigation.css`, módulos móviles | < 768 | Sin evidencia móvil | Sin cambios de runtime desde #1891 [CÓDIGO]; barra inferior 51.19 [MEDIDO] | ≥ 44 táctil | — | Accesibilidad móvil | R13 | Bloqueado (D-07, C05) | Diferir | — |

Hallazgos nuevos de esta auditoría:

| ID | Superficie | Owner | Viewport | Hecho | Riesgo | Estado | Acción |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DRV-N1 | Sesiones admin (fila de la sesión actual) | `AdminSessionsReadOnlyCard.tsx:463-467` (y `:680-683`, móvil) | 1366 × 768, ambos temas | axe `label-content-name-mismatch` serious: el texto visible «Sesión actual» no está contenido en el `aria-label` «Sesión Admin #… actual, no se puede revocar» | R1 | **Confirmado** [MEDIDO] | G11-e (§12) |
| DRV-N2 | Módulo Logística de clínica (lista reciente de visitas) | `ClinicLogisticaWorkspaceSummary.tsx:107-110` | 1366 y 390, ambos temas | axe `label-content-name-mismatch` serious en 3 nodos: el `aria-label` «Ver detalle de la visita en …» no contiene el texto visible (clínica, fecha, estado) | R1 | **Confirmado** [MEDIDO] | G11-e (§12) |
| DRV-N3 | Visitas, ruta completa | `logistica/visitas/page.tsx` | 1366, 1280 × 800, 1024 | Alto de la primera fila de 61 y 101 px frente a 52 px en 1920/1440/1279 | R1 + A03 | Hipótesis (sólo se midió la primera fila; no se comprobó si hay recorte dentro del canvas) | Medir junto con F-T1 |

---

## 7. Desviaciones demostradas

1. **DRV-01: inversión de densidad en la frontera del drawer.** El cambio rail 80 → drawer 256 en 1280 px y la revelación `xl:table-cell` en 1280 px coinciden. La columna extra aparece justo cuando el contenedor pierde 175 px. Entre 1024 y 1279 px el contenedor (913.84–1164.75 px) es igual de ancho o más que a 1440 px (1139.81), que sí muestra la columna.
   - Prueba directa: 1279 × 800 vs 1280 × 800 con el mismo dato.
   - Truncados en la tabla: Auditoría 0 → 10, Usuarios 0 → 17, Informes admin 0 → 9.
   - Columnas: 6 → 7 en Auditoría, Sesiones, Tokens y Usuarios; 7 → 8 en Informes.

   [MEDIDO]
2. **DRV-03: estado de filtro aplicado no visible por debajo de 1280 px.** Con un filtro aplicado desde el `SuperSearchField` (S3) o el formulario de escritorio (S2):
   - ≥ 1280: el chip se ve en los 5 anchos medidos.
   - 360–1279: 0 chips en los 6 anchos medidos, y ningún disparador muestra un recuento.

   La causa en el código es el envoltorio `hidden … xl:flex`. [MEDIDO] [CÓDIGO]
3. **DRV-02: cuadrícula ilegible en el extremo estrecho.** Truncado en el 100 % de las tarjetas de Clínicas admin a 1024, 834 y 768 px. Tarjetas de Informes clínica de 185.56 px a 1024 px, más estrechas que la pista mínima derivada de Drive (219.75–223.8 px). [MEDIDO]
4. **G11: 5 hallazgos serios abiertos** (V-4, V-5, DRV-N1, DRV-N2; V-4 en dos superficies). Detalle en §9. [MEDIDO]

---

## 8. Diferencias intencionales (se mantienen)

| Diferencia | Drive | VETNEB | Motivo |
| --- | --- | --- | --- |
| App bar | 64 | 55.33 | Rector §46 (56 ± 2) |
| Drawer / rail / barra inferior | sidebar 224 fija y `min-width: 1000px` | 255 / 79 / 51.19 | §46; 0 overflow en 231 combinaciones medidas |
| Rail derecho | 56 | ausente | Sin función; +56 px de ancho útil |
| Fila densa | 48 | 36 (admin) | Capacidad A03; C05 BLOCKED (R13) |
| Paginación adaptativa | scroll continuo | pager + `limit` medido | A03 / A05 / A08 |
| Detalle en diálogo | panel (A4 NO RESUELTO) | `ModuleDialog` + `DetailsPane` | Hasta resolver DRV-01 / DRV-10 |
| Tabla semántica | `role=grid` sin `columnheader` | `table` nativo + `aria-sort` (C04) | Accesibilidad |
| Buscador del header | contenido, 722 × 48 | módulos, 240 × 36 | Rector §25.3.1 |
| Identidad visual | Google Sans, paleta Google | `--font-ui`, paleta VETNEB | Rector §45.1 |

---

## 9. Estado G11 / C26

### 9.1 Correctivos fusionados

| Correctivo | PR | Qué corrigió | Verificación en esta auditoría |
| --- | --- | --- | --- |
| G11-a | #1901 | V-1 (progressbar de Rutas y `RoutePlanDetailDialog`) y V-3 (botón «Actualizar» < 640 px) | V-1 y V-3 **no aparecen** en las 84 lecturas [MEDIDO] |
| G11-b | #1904 | V-2 (IDREF de `ModuleTabs`) | V-2 **no aparece** en `admin-precios` [MEDIDO] |
| G11-c | #1905 | `.clinical-alert-error` en oscuro (2.84 → ≥ 5.2 en Alertas y Mantenimiento) | El selector corregido no es el de V-4 ni el de V-5: `FullModuleRouteControl.tsx:28` y `ClinicParticularTokensCard.tsx:857-859` no cambiaron desde #1860 / #1899 [CÓDIGO]. V-4 y V-5 **persisten** [MEDIDO] |
| G11-d | #1907 | `heading-order` en Mantenimiento (impacto `moderate`) | No es la «cobertura 21 × 2» que el acta de preparación llamaba G11-d (divergencia de nomenclatura, §10) |

### 9.2 Re-verificación 21 × 2 (1366 × 768 y 390 × 844)

Resultado: **75 limpios y 9 con violaciones `serious`** sobre 84 registros. No hubo violaciones `critical`. El tema pedido se aplicó en los 84 registros. [MEDIDO]

| ID | Regla | Superficie · tema · viewport | Valor | Owner |
| --- | --- | --- | --- | --- |
| V-4 | `color-contrast` | `clinic-informes` y `clinic-logistica` · normal · 390 | 3.92:1 (esperado 4.5:1), 12 px | `components/dashboard/FullModuleRouteControl.tsx:28` (`text-vetneb-teal` sobre `bg-vetneb-teal/10`) |
| V-5 | `color-contrast` | `clinic-tokens` · dark-gray · 1366 y 390 | 3.03:1, 12 px | `components/dashboard/ClinicParticularTokensCard.tsx:857-859` (`text-destructive`); se expone porque el fixture responde 404 a tokens de clínica (estado de error, cobertura incompleta, igual que el acta) |
| DRV-N1 | `label-content-name-mismatch` | `admin-sesiones` · ambos temas · 1366 | 1 nodo | `AdminSessionsReadOnlyCard.tsx:463-467` |
| DRV-N2 | `label-content-name-mismatch` | `clinic-logistica` · ambos temas · 1366 y 390 | 3 nodos | `ClinicLogisticaWorkspaceSummary.tsx:107-110` |

**Atribución de DRV-N1/N2 [INFERIDO].** Los dos owners no cambiaron desde C19 (#1883) y C22 (#1887). El inventario del 2026-10-21, con axe 4.13, no los reportó. #1911 subió `@axe-core/playwright` a 4.14.0 y ya realineó otros nombres accesibles por esa misma causa (`InformesReportsList`, `DashboardMobileNav`). La causa más probable es la nueva versión de axe; no se ejecutó un A/B con 4.13 para demostrarlo.

### 9.3 Criterios C26

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Correctivos G11 conocidos fusionados | PARCIAL: 4 PR fusionadas; V-4 y V-5 abiertos; DRV-N1/N2 nuevos | §9.1, §9.2 |
| Test formal 21 superficies × 2 temas | **NOT_AVAILABLE**: no existe. Sólo `admin-c20-batch-3.spec.ts` combina axe con `dark-gray`; `clinic-c22-batch-2.spec.ts:77` conserva el mecanismo `disableRules(preexisting)` | `git grep AxeBuilder` + `dark-gray` [CÓDIGO] |
| Cobertura G11 «pasó» | **FAILED** en la re-verificación local (no es la ejecución formal del gate) | §9.2 |
| G11 (rector §58, «antes de C26») | **NO cumplido** | — |
| G12 staging (R3) | BLOCKED: sin entorno, sin tenants de prueba y sin delegación R3 | Acta de preparación §7.2 [HISTÓRICO] |
| D-11 (iniciar C26 con C25 PARTIAL), D-01(c) (cierre contra §58) y lectura de G12 (§54 vs §58) | PENDIENTES: sin registro escrito | Acta de preparación §7 |
| Subconjunto de estados para la regresión visual (§57) | PENDIENTE (decisión) | Acta de preparación §9 |
| Rendimiento (§56.7) | NOT_AVAILABLE: no hay sonda de rendimiento | Acta de preparación §9 |
| P2-05 (anuncio de conteo en S2/S3/S4) | PARCIAL | §6 DRV-05 |
| Táctiles ≥ 44 px (§62.16) | FAILED conocido (D7) | Acta C25 [HISTÓRICO] |

**Conclusión.** G11 no puede declararse completo, y C26 sigue bloqueado por G11 y por las decisiones D-11 y D-01(c). No se inició ninguna verificación R3.

---

## 10. Riesgos y dependencias

| # | Riesgo / dependencia | Impacto | Mitigación |
| --- | --- | --- | --- |
| R-1 | El acta `dashboard-drv-c26-readiness.md`, fusionada en #1917 el 2026-10-24, declara G11-a..d «PENDIENTE» (§10) con baseline `ca032b1a`, aunque #1901–#1907 ya estaban fusionadas. Además usa «G11-d» para la cobertura 21 × 2, mientras que #1907 usó G11-d para `heading-order` | Medio: puede inducir a repetir correctivos o a creer que existe un G11-d de cobertura | Reportado, no corregido (fuera de scope). Sugerencia: un registro en una PR docs-only propia |
| R-2 | Cambiar el color de V-4 o V-5 puede alterar capturas de los baselines visuales Linux | Medio | Por eso G11-e (sólo atributos) va antes que el contraste (§11) |
| R-3 | DRV-01 corregido con container queries puede reabrir truncados en otro rango o al montar un panel | Medio | Una tabla piloto, sonda de truncado 1024–1440 antes/después, histéresis de una columna |
| R-4 | DRV-02: cambiar las columnas cambia el alto de tarjeta (las filas siguen = f(`limit`)) | Bajo–medio | Alternativa C de la v2 §11.2 con alto mínimo; A03 sin drift |
| R-5 | El fixture no puebla tokens de clínica: V-5 y G11 en `clinic-tokens` se auditan en estado de error | Medio | Stub hermético en la PR de cobertura 21 × 2 |
| R-6 | Las sondas son Win32 + `next dev`; Linux + `next start` no se ejecutaron | Medio | Validar en CI sobre el head de cada PR |
| R-7 | PR #1909 (Dependabot) sigue abierta aunque #1911 declara sustituirla | Bajo | Fuera de scope; decisión de Nico |

---

## 11. Priorización técnica

Orden según las dependencias del rector (§50: C26 → C25; §58: G11 antes de C26). Las mejoras DRV visuales van después de C26.

| Prioridad | Elemento | Tipo | Valor | Riesgo | Bloqueo |
| --- | --- | --- | --- | --- | --- |
| 1 | **G11-e**: `label-content-name-mismatch` (DRV-N1, DRV-N2) | Correctivo G11, sólo atributos | WCAG 2.5.3 | Bajo: 0 cambios de caja o de color | Ninguno |
| 2 | G11-c2: contraste V-4 (`FullModuleRouteControl`) y V-5 (Tokens clínica, oscuro) | Correctivo G11 de color | WCAG 1.4.3 | Medio (baselines visuales; R2 si toca `--vetneb-teal` o `--destructive` globales) | Ninguno técnico |
| 3 | Cobertura G11 21 × 2 (test-only) con stub de tokens de clínica | Gate | Cierra G11 | Bajo | Requiere 1 y 2 en verde |
| 4 | Decisiones D-11, D-01(c) y lectura de G12 | Gobierno | Habilita C26 | — | Nico |
| 5 | C26 (sonda de rendimiento, regresión visual, acta) | Rector nivel 13 | — | Medio | 3 y 4 |
| 6 | PR-DRV-07: DRV-01, tabla piloto por contenedor | Mejora | Densidad coherente en 1024–1440 | Medio | Después de C26 |
| 7 | PR-DRV-06: DRV-03, recuento de filtros aplicados | Mejora | Estado visible en 6 de 11 viewports donde hoy no se ve | Bajo–medio | Después de C26 |
| 8 | PR-DRV-08: DRV-02, columnas por contenedor con alto mínimo | Mejora | Legibilidad de la cuadrícula estrecha | Bajo–medio | Después de C26; decisión sobre el alto de §46 |
| 9 | DRV-04, 06, 07, 10, 11, 12, 13 | — | — | — | Decisiones D-03..D-08, R13 y C05 |

---

## 12. Siguiente PR recomendada: G11-e · nombres accesibles que contienen el texto visible

| Campo | Contenido |
| --- | --- |
| Objetivo | Eliminar las violaciones `label-content-name-mismatch` (serious) de Sesiones admin y del módulo Logística de clínica, para que el nombre accesible empiece por el texto visible (WCAG 2.5.3) |
| Causa raíz demostrada | El `aria-label` reemplaza el texto visible por una frase que no lo contiene. Sesiones: visible «Sesión actual», nombre «Sesión {tipo} #{id} actual, no se puede revocar» (`AdminSessionsReadOnlyCard.tsx:463-467`, y el gemelo móvil `:680-683`). Logística: visible «{clínica} {fecha} {estado}», nombre «Ver detalle de la visita en {clínica}» (`ClinicLogisticaWorkspaceSummary.tsx:107-110`). Medido por axe 4.14 en 1366 y 390, ambos temas (§9.2) |
| Beneficio | Dos superficies menos con violaciones serias en G11 (9 → 5 registros fallidos en la re-verificación local); usuarios de control por voz pueden activar el control diciendo lo que ven |
| Scope exacto | Frontend runtime, sólo valores de `aria-label`. Sin nodos, clases, eventos, endpoints ni geometría nuevos |
| Archivos | `frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx` (los dos `aria-label` de la sesión actual) · `frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx` (`aria-label` de la fila de visita) · `test/unit/ui/admin/frontend-admin-sessions-card.test.ts:251` (ancla el literal: realinear sin debilitar) · `frontend/e2e/admin/shell/admin-c19-batch-2.spec.ts:162` (busca el botón por el nombre actual: realinear) · aserción axe dirigida (`label-content-name-mismatch`) en las specs existentes C19 y C22 |
| Dependencias | Ninguna. Va antes de G11-c2 y de la PR de cobertura 21 × 2 |
| Riesgo | Bajo (R1). A01: los handlers no cambian. A02/A03/A08: ninguna caja cambia. Seguridad: el nombre sigue sin datos sensibles más allá de lo que ya muestra la fila |
| Validaciones | Antes de editar, RED con axe dirigido. Después: `test/unit/ui/admin/frontend-admin-sessions-card.test.ts` → `pnpm --dir frontend lint` → `typecheck` → `build` → `pnpm security:public-surface` → `pnpm --dir frontend e2e:visual-contract` (contiene C19 y C22, verificado en `frontend/e2e/suites/catalog.ts:109,140`) → `git diff --check`; `frontend/next-env.d.ts` sin cambios |
| Criterios de aceptación | `label-content-name-mismatch` = 0 en `admin-sesiones` y `clinic-logistica` en los dos temas y a 1366 y 390; la sesión actual sigue deshabilitada y explica por qué; la fila de visita sigue abriendo el diálogo; A02 21/21 y A08 21/21 sin cambios; ningún `disableRules` nuevo |
| Rollback | `git revert` del squash si regresiona una spec C19/C22 o el nombre pierde información |
| Complejidad | Baja: 2 owners, 3 atributos y 2 anclas de test |

**No-alcance de esa PR:** V-4/V-5 (contraste, G11-c2), la cobertura 21 × 2, cualquier DRV visual, tokens y baselines.

---

## 13. Tests y criterios de aceptación de las mejoras DRV diferidas

| PR futura | Test necesario | Aceptación medible |
| --- | --- | --- |
| PR-DRV-07 (DRV-01) | Repetir la sonda de §3 sobre Informes admin, en 1024, 1279, 1280, 1366 y 1440 × 800 | Truncados de tabla en 1280 ≤ los de 1279; columnas visibles monótonas en el ancho del contenedor; A02 21/21, A03 195/195 + 234/234, A08 21/21 |
| PR-DRV-06 (DRV-03) | E2E con un filtro aplicado en S2/S3 a 360, 390, 768, 1024 y 1279 | Recuento visible o anunciado en 11/11 viewports; A01 idéntico; sin salto de línea en el disparador a 360 |
| PR-DRV-08 (DRV-02) | Spec C24 ampliada con ancho mínimo de tarjeta y truncado | 0 tarjetas < pista mínima decidida; truncado de Clínicas a 1024 < 100 %; A03 sin drift |

---

## 14. Limitaciones y mediciones no ejecutadas

| Medición | Estado | Motivo |
| --- | --- | --- |
| Hover, foco, `pressed` y color de la capa de hover | NOT_RUN | La sonda no interactúa; el foco lo midió C25 [HISTÓRICO] |
| Menús, overlays, paneles y diálogos (geometría y axe) | NOT_RUN | Sólo se midió el estado cargado |
| Tema oscuro geométrico | NOT_RUN | La geometría se midió en tema claro; el oscuro sólo con axe |
| Linux / `next start` | NOT_RUN | Sólo CI; la máquina local es Win32 |
| A/B de axe 4.13 vs 4.14 para DRV-N1/N2 | NOT_RUN | Cambiar dependencias es R2 y está fuera de scope |
| Recorte interno de filas de Visitas (DRV-N3) | NOT_RUN | Sólo se midió la primera fila |
| G11 en los otros 11 viewports | NOT_RUN | Mismo alcance que el inventario anterior (1366 + 390) |
| Comparación tipográfica exacta y de color (ΔE) con Drive | NO_COMPARABLE | Familias propietarias; la identidad VETNEB es intencional |
| Selección, menú contextual y panel de detalle de Drive | NO_COMPARABLE | NO RESUELTO en la referencia (A2–A4) |
| Contradicción 834/722 px del buscador | NO_COMPARABLE | NO RESUELTA en la referencia (§XIV.4) |

Validaciones documentales de esta entrega:

| Gate (AGENTS §6, docs) | Estado |
| --- | --- |
| `git diff --check` | PASSED (exit 0; el diff tracked está vacío y este archivo es untracked) |
| Espacios finales, marcadores de conflicto y número de columnas por tabla en este archivo | PASSED (`grep -c` = 0 y script `awk`, exit 0) |
| Paths citados existen (`git ls-files --error-unmatch`) y no hay patrones sensibles (`grep`) | PASSED |
| Lint, typecheck, build, `security:public-surface`, `pnpm test`, cohortes E2E | NOT_RUN: docs-only, sin código |
| Sondas temporales | Ejecutadas fuera del repositorio; sus resultados no son gates (§3) |

---

## 15. Evidencias y procedencia

| Evidencia | Ubicación | Naturaleza |
| --- | --- | --- |
| Registros JSON de la sonda geométrica (21 archivos), de la complementaria (2) y de axe (42) | Scratchpad de la sesión, fuera del repositorio (`…/scratchpad/drv-probe/json`, `json-extra`, `axe-json`) | Datos sintéticos del fixture; sólo cajas, estilos computados y recuentos; selectores CSS de axe sin texto de usuario |
| Baseline A02 de calibración | `frontend/e2e/fixtures/dashboard-geometry-baseline.ts` | Congelado, sin cambios |
| Helpers reutilizados | `frontend/e2e/helpers/dashboard-geometry-matrix.ts`, `frontend/e2e/helpers/session.ts` | Sin cambios |
| Referencia Drive | `docs/audit/GOOGLE_DRIVE_REFERENCIA_UI_CONSOLIDADA.md` §II, §IV–§VI, §XIII | Sin cambios |
| Rector | `docs/audit/AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md` §46, §50, §55, §58, §62, §63 | Sin cambios |
| Propuesta v2 | `origin/docs/dashboard-drive-evolution-proposal@6ac9695d` | Sólo lectura |
| Actas | `dashboard-drv-c26-readiness.md`, `dashboard-c25-microgeometry.md` | Sin cambios |
| GitHub | `gh pr view` (#1891, #1893–#1907, #1911, #1913–#1917), `gh pr list`, `gh run list --commit c8b66052` | Lectura del 2026-10-24 |

**Estado del documento:** READY como auditoría comparativa y planificación. Sin commit, push, PR ni escrituras remotas.

---

## 16. Actualización de reconciliación · 2026-10-28

| Campo | Valor |
| --- | --- |
| Tipo | Reconciliación de la auditoría del 2026-10-24 con `main` vigente. Docs-only |
| Rama / HEAD | `docs/dashboard-drv-comparative-reconciliation-20261028` @ `a2c8791229e7b89b713e74e0162aa92d8fdec800` (= `origin/main`) |
| Fecha | 2026-10-28 |
| Autorización | Nico: edición local de este archivo y sus verificaciones. Sin commit, push, PR ni merge |
| Riesgo | R0 (lecturas Git/GitHub/código; sondas temporales fuera del repositorio) + R1 docs-only (este archivo) |
| Regla de conservación | §1–§15 no se reescriben. Los valores del 2026-10-24 siguen siendo evidencia de `c8b66052`; esta sección no los sustituye |

Convención adicional de procedencia:

- **[MEDIDO-28/10]**: valor leído por la sonda dirigida de §16.8 sobre `a2c87912`.
- **[CI]**: resultado de un workflow de GitHub Actions leído por `gh run view`, con el SHA del head que lo produjo.
- **[PR]**: contenido de una PR fusionada leído con `gh pr view` (archivos, cuerpo, `mergedAt`, merge commit).

Estados vigentes usados en la matriz (§16.3): **Implementado y verificado** · **Pendiente y vigente** · **Obsoleto por cambios posteriores** · **Requiere nueva medición** · **Bloqueado** (por dependencia o autorización).

### 16.1 Baseline Git y SHA actual

| Elemento | Valor | Fuente |
| --- | --- | --- |
| Rama activa | `docs/dashboard-drv-comparative-reconciliation-20261028` (la indicada; no se cambió) | `git branch --show-current` |
| HEAD | `a2c8791229e7b89b713e74e0162aa92d8fdec800`, «feat(dashboard): flatten decorative control hairlines on bell trigger and centered pager (PR 3) (#1932)», 2026-10-28 03:22:17 −0300 | `git log -1` |
| `origin/main` | `a2c87912…` tras `git fetch --prune` (R1 de AGENTS §5.2; sólo poda la rama remota ya fusionada `feat/drive-control-hairlines-pr3`). Ahead/behind 0/0 | `git rev-list --left-right --count` |
| Avance desde la auditoría | 12 commits entre `c8b66052` y `a2c87912` (#1919 → #1932) | `git log --oneline c8b66052..HEAD` |
| Tracked | Sin modificaciones: `git diff --stat`, `--check` y `--name-only` vacíos al iniciar y al cerrar | — |
| Untracked preexistentes (preservados) | Este documento; `frontend/AGENTS.md` y `frontend/CLAUDE.md` (regenerados por `next dev`, no son contrato; no se tocaron) | `git status --short --untracked-files=all` |
| SHA-256 de este archivo antes de editar | `749b0f3347f8a70a2d37974de000395dad45a22e4209996df012339a49272219`; copia previa conservada fuera del repositorio | `sha256sum` |
| Stashes (5, intactos) | `stash@{0}`…`stash@{4}`, los mismos del 2026-10-24 | `git stash list` |
| Worktrees | `C:/PORTAL-VETNEB` y `C:/PORTAL-VETNEB/.claude/worktrees/compassionate-gould-ad80c4` (`283e4118`, detached; nuevo respecto del 2026-10-24, ajeno y no tocado) | `git worktree list` |
| `AGENTS.md` tracked | Sólo el raíz | `git ls-files` |
| Documentos fuente | El rector, la referencia Drive y `dashboard-drv-c26-readiness.md` no cambiaron desde `c8b66052` (diff vacío). Desde entonces sólo cambiaron en `docs/` `dashboard-c05-row-density.md`, `dashboard-c25-microgeometry.md` y `docs/ops/CI_PR_CHECKS_RUNBOOK.md` | `git diff --stat c8b66052 HEAD -- docs/` |
| CI de `main@a2c87912` | Backend CI success (run `40643446013`) · Frontend CI success (run `40643445977`) | `gh run list --commit` [CI] |
| PR abierta | Sólo #1909 (Dependabot frontend), igual que el 2026-10-24 | `gh pr list --state open` |

### 16.2 PR fusionadas y mejoras comprobadas

Las ocho PR pedidas (#1919, #1920, #1921, #1923, #1929, #1930, #1931, #1932) más las cuatro fusionadas en el mismo intervalo que afectan a la matriz (#1922, #1924, #1925, #1926). Todas `MERGED` en `main` con squash. [PR]

| PR | Título (abreviado) | Merge commit | `mergedAt` (UTC) | Impacto real comprobado | Verificación |
| --- | --- | --- | --- | --- | --- |
| #1919 | G11-e accessible name consistency | `afa00968` | 2026-10-24T22:50:16Z | Corrige DRV-N1 (`AdminSessionsReadOnlyCard.tsx`) y DRV-N2 (`ClinicLogisticaWorkspaceSummary.tsx`); realinea las anclas C19/C22 y el test de Sesiones | Archivos de la PR [PR]; matriz G11 formal en verde [CI] |
| #1920 | G11-c2 contrast corrections | `221dff97` | 2026-10-25T01:11:28Z | Corrige V-4 (`FullModuleRouteControl.tsx`) y V-5 (regla `dark-gray` acotada a `#clinic-particular-tokens p.text-destructive[role="alert"]` en `globals.css`, sin tocar `--destructive`) | `git diff` de `globals.css` [CÓDIGO]; matriz G11 formal en verde [CI] |
| #1921 | G11 formal axe matrix 21×2×2 | `e0614e9c` | 2026-10-25T04:06:52Z | Crea `frontend/e2e/platform/accessibility/dashboard-g11-axe-matrix.spec.ts`: 21 superficies × 2 temas × 1366 + 390, sin `disableRules`, `critical`/`serious` = 0, `clinic-tokens` poblado con stub local. Catálogo: tier `extended` (cohortes `extended` y `full`) | `frontend/e2e/suites/catalog.ts:161` [CÓDIGO]; §16.3 G11 |
| #1922 | C25 F-T1 Visitas address and notes on desktop | `ebe88a7c` | 2026-10-25T06:07:47Z | El `#id` de la tabla de escritorio de Visitas abre `FieldVisitDetailDialog` (`visitas/page.tsx:222`, `trigger="identifier"`) | [CÓDIGO] [PR] |
| #1923 | C05 compact row pitch 40px (R13) | `2596cf5e` | 2026-10-25T11:01:20Z | `--dash-row-pitch-compact` 36 → 40 px con autorización R13 del 2026-10-25; A02/A03 Win32 recapturados; C05 deja de estar BLOCKED | `tokens.css:258-262` [CÓDIGO]; fila 40/40 medida en 6 tablas [MEDIDO-28/10] |
| #1924 | C25 F-T2 Sesiones read-only detail | `25cd6e50` | 2026-10-25T21:13:35Z | `AdminSessionDetailDialog.tsx` nuevo; truncados de Sesiones con valor completo | [PR] [CÓDIGO] |
| #1925 | C25 F-T3..F-T7 compact values in full | `7c9b1fa9` | 2026-10-26T04:13:38Z | Detalle de solo lectura en Estado móvil, `ModuleMetricRun` de Logística, `StatsCards`, chips de Perfil | [PR] |
| #1926 | C25 D5 mobile navigation labels 11/16px | `2c5c33b5` | 2026-10-26T20:06:57Z | Etiqueta de la barra móvil 9.6/9.6 → 11/16 (`navigation.css`) | [CÓDIGO]; acta C25 §11 |
| #1929 | C25 D6 partial spacing corrections | `208c92bb` | 2026-10-27T12:15:47Z | 12 gaps horizontales intra-fila y de paginador 6 → 8 px; D6 sigue PARCIAL (acta C25 §12.5) | [PR]; gap de la barra de filtros S3 sigue en 6 px [MEDIDO-28/10] |
| #1930 | Drive-like shell foundation | `0d83fa80` | 2026-10-27T19:30:58Z | App bar opaca (`bg-card`, sin blur); buscador de módulos en píldora de 40 px; lienzo plano; 20 baselines visuales Linux promovidas | Buscador de módulos 512 × 40 (≥ 1536), 416 × 40 (1280–1535), 288 × 40 (1024–1279), 192 × 40 (768–1023), radio píldora [MEDIDO-28/10] |
| #1931 | Drive-like workspace surfaces and tonal tabs | `6f0adb3b` | 2026-10-28T05:18:50Z | Pestañas tonales, contenedor seleccionado con tinte primario, superficies planas; 30 baselines visuales Linux promovidas | [PR] [CÓDIGO] |
| #1932 | Drive control hairlines (PR 3) | `a2c87912` | 2026-10-28T06:22:18Z | Sin sombra decorativa en la campana y en los botones de pager centrados | [PR]; árbol idéntico al head de la PR `f2076e78` (`git diff` vacío) |

**Lo que estas PR no tocaron** (comprobado con `git diff c8b66052 HEAD`): el mecanismo de columnas por viewport de las cinco tablas admin, `ContentGrid` y `collection-view.ts`, el envoltorio `hidden … xl:flex` de los chips S2/S3, `ActionMenu` de Informes admin, el slot `details`, los tokens de hover y tipografía (`tokens.css:135,186,188,228`) y el escalón `@media (max-height: 760px)`. [CÓDIGO]

### 16.3 Matriz de evolución histórica y estado vigente

| ID | Estado 2026-10-24 (§6) | Evidencia 2026-10-28 | Estado vigente | Acción vigente |
| --- | --- | --- | --- | --- |
| DRV-01 | Confirmado | Mismo mecanismo (`git grep -e "@container" -e "container-type"` = 0; `lg:`/`xl:table-cell` 4/4/4/4/2 sin cambios). Contenedores, columnas y truncados idénticos al 2026-10-24 en 1279/1280 (§16.4.1) [MEDIDO-28/10] | **Pendiente y vigente** | PR-DRV-07 (§16.6) |
| DRV-02 | Confirmado (legibilidad en el extremo estrecho) | Columnas fijas 3/3/2 sin cambios; Clínicas admin truncada al 100 % a 1024, 834 y 768; Informes clínica 185.56 px a 1024 (§16.4.2) [MEDIDO-28/10] | **Pendiente y vigente** | PR-DRV-08; decisión sobre el alto de §46 |
| DRV-03 | Confirmado | 0 chips en 360–1279 en S2 y S3; ningún disparador con recuento; envoltorio `xl:flex` sin cambios (§16.4.3) [MEDIDO-28/10] [CÓDIGO] | **Pendiente y vigente** | PR-DRV-06 |
| DRV-04 | Bloqueado (D-03) | `<ActiveFilterChips` sigue con 3 usos, todos en S2/S3 [CÓDIGO] | **Bloqueado** (decisión D-03) | Sin cambio |
| DRV-05 | Implementado (#1899); P2-05 parcial | `role="search"` vigente; S2/S3/S4 siguen sin `rangeLabel` [CÓDIGO] | **Implementado y verificado** (DRV-05) · P2-05 **Pendiente y vigente** | P2-05 como correctivo propio |
| DRV-06 | Bloqueado (D-04) | `ActionMenu` con un único `ActionMenuItem` «Ver detalle» (`AdminReportsCard.tsx:803,899`) [CÓDIGO] | **Bloqueado** (decisión D-04) | Sin cambio |
| DRV-07 | Confirmado (F-T1); resto sin cambios | F-T1 (#1922), F-T2 (#1924) y F-T3..F-T7 (#1925) fusionados; `FieldVisitDetailDialog` montado también en escritorio (`visitas/page.tsx:222`) [PR] [CÓDIGO]. Sin re-medición runtime propia | **Implementado y verificado** (por código, guard PR-TRUNC y CI de cada PR) | No repetir |
| DRV-08 | Implementado (#1900) | `SkipToContent` sigue montado (`DashboardShellRouter.tsx:31`) [CÓDIGO] | **Implementado y verificado** | No repetir |
| DRV-09 | Implementado (#1898) | Bloque `dashboard-drv03-forced-colors-overlay-focus` en `interactions.css:98-128` [CÓDIGO] | **Implementado y verificado** | No repetir |
| DRV-10 | No comparable; depende de DRV-01 | `git grep "details={"` = 0 consumidores [CÓDIGO] | **Bloqueado** (depende de DRV-01) | Sin cambio |
| DRV-11 | Hipótesis | Tokens sin cambios (hover 0.06/0.10; 13 px / 1.25) [CÓDIGO] | **Pendiente y vigente** como divergencia documental (sin defecto demostrado) | D-08 |
| DRV-12 | Confirmado, acotado al alto ≤ 760 px | El baseline A02 vigente (recapturado por #1923) conserva 42 apariciones de `68.11`; escalón `max-height: 760px` sin cambios. No re-medido a 1280 × 720 | **Pendiente y vigente** (evidencia: baseline A02 congelado) | B3 / D-05, R13 |
| DRV-13 | Bloqueado (D-07, C05) | D5 implementado (#1926); D6 parcial (#1929); D7 abierto; D8: fila 40 implementada (#1923), cabecera de tabla sigue en 32 px (36 en §46) [MEDIDO-28/10] | **Parcial**: D5 implementado · D6/D7/D8-cabecera **Pendientes y vigentes**, con R13 propia | Ver §16.6 |
| DRV-N1 | Confirmado (axe) | Corregido por #1919; matriz G11 formal 42/42 en verde [CI] | **Implementado y verificado** | No repetir |
| DRV-N2 | Confirmado (axe) | Corregido por #1919; matriz G11 formal 42/42 en verde [CI] | **Implementado y verificado** | No repetir |
| DRV-N3 | Hipótesis | La página de Visitas cambió (#1922, #1925, #1932) y la fila compacta pasó a 40 px (#1923); no se re-midió | **Requiere nueva medición** | Medir junto con DRV-01 |

Estado del programa contrastado con el código y GitHub:

| Elemento | Estado 2026-10-24 | Estado 2026-10-28 | Evidencia |
| --- | --- | --- | --- |
| **G11** (rector §58) | NO cumplido: 9/84 registros con `serious` en la re-verificación local; sin test formal | **Implementado y verificado en CI.** La spec formal (#1921) pasó 42/42 casos (84 auditorías) en E2E Completeness: run `40639745506` sobre `f2076e78`, cuyo árbol es idéntico a `a2c87912`, y run programado `40478219860` sobre `main@2c5c33b5`; los dos `1997 passed`, 0 fallidos | [CI]. Re-ejecución local: NOT_RUN (§16.8) |
| **C05** | BLOCKED (R13) | **Implementado** (#1923) en su alcance: fila compacta 40 px con A02/A03 recapturados. Fuera de su alcance siguen `CollectionHeader` 36 px (medido 32) y `CollectionPager` 40 px | `docs/implementation/dashboard-c05-row-density.md` §Scope; [MEDIDO-28/10] |
| **C25** | PARTIAL | **PARTIAL**: D4 cerrado (#1922/#1924/#1925), D5 cerrado (#1926), D6 parcial (#1929), D7 abierto, D8 parcial | Acta C25 §11–§12; [PR] |
| **C26** | Bloqueado por G11, D-11 y D-01(c) | **NOT_STARTED. Bloqueado** por D-11 (C25 sigue PARTIAL; rector §50 C26 → C25) y por D-01(c)/lectura de G12. G11 dejó de bloquear | Sin PR ni acta C26 (`gh pr list --search "C26 in:title"` sólo devuelve #1917); sin registro de D-11 fuera de las actas de planificación |
| G12 | BLOCKED (R3) | **BLOCKED** sin cambios: sin entorno, tenants de prueba ni delegación R3 | — |

### 16.4 Desviaciones que continúan demostradas

#### 16.4.1 DRV-01 — inversión de densidad en 1279 → 1280 px

Mismo dato sintético, `next dev`, Win32, tema claro. Los valores de contenedor, columnas y truncados coinciden exactamente con los del 2026-10-24; sólo cambió la fila (36/37 → 40 px, #1923). [MEDIDO-28/10]

| Tabla | 1279 × 800: contenedor · columnas · truncados | 1280 × 800: contenedor · columnas · truncados | 1366 × 768 | 1440 × 900 |
| --- | --- | --- | --- | --- |
| Auditoría | 1164.75 · 6 (1 oculta) · 0 | 989.75 · 7 · **10** | 1067.28 · 7 · 5 | 1139.81 · 7 · 3 |
| Usuarios | 1164.75 · 6 (1 oculta) · 0 | 989.75 · 7 · **17** | 1067.28 · 7 · 5 | 1139.81 · 7 · 0 |
| Informes admin | 1132.75 · 7 (1 oculta) · 0 | 957.75 · 8 · **9** | 1035.28 · 8 · 9 | 1107.81 · 8 · 7 |
| Sesiones | 1164.75 · 6 (1 oculta) · 0 | 989.75 · 7 · 0 | 1067.28 · 7 · 0 | 1139.81 · 7 · 0 |
| Tokens admin | 1132.75 · 6 (1 oculta) · 0 | 957.75 · 7 · 0 | 1035.28 · 7 · 0 | 1107.81 · 7 · 0 |

- La discontinuidad de contenedor sigue en −175 px (rail 79 → drawer 255; `navigation.css:251,257`).
- Fuera de la frontera también se mantiene lo medido: Sesiones trunca 30 celdas a 834 y 25 a 768 (eran 34 y 28 con fila 36), y Usuarios 22 y 34.
- **Conclusión:** DRV-01 continúa demostrado. #1923 no lo agravó ni lo corrigió.

#### 16.4.2 DRV-02 — cuadrícula ilegible en el extremo estrecho

[MEDIDO-28/10]

| Superficie | Viewport | Contenedor | Columnas | Tarjeta (ancho × alto) | Truncados / elementos | 2026-10-24 |
| --- | --- | ---: | ---: | --- | --- | --- |
| Clínicas admin | 1920 × 1080 | 1578.22 | 3 | 520.73 × 112.44 | 0 / 20 | 520.73 × 97.39 · 0 / 22 |
| Clínicas admin | 1024 × 768 | 881.84 | 3 | 288.61 × 103.09 | **13 / 13** | 15 / 15 |
| Clínicas admin | 834 × 1194 | 694.88 | 3 | 226.28 × 113.09 | **23 / 23** | 26 / 26 |
| Clínicas admin | 768 × 1024 | 629.94 | 3 | 204.64 × 106.80 | **19 / 19** | 21 / 21 |
| Informes admin | 1920 × 1080 | 1578.22 | 3 | 520.73 × 108.30 | 0 / 9 | 520.73 × 93.77 · 0 / 9 |
| Informes admin | 768 × 1024 | 629.94 | 3 | 204.64 × 107.77 | 2 / 9 | 2 / 9 |
| Informes clínica (ruta completa) | 1280 × 800 | 430.44 | 2 | 203.22 × 75.56 | 12 / 11 | idéntico |
| Informes clínica (ruta completa) | 1024 × 768 | 395.13 | 2 | **185.56** × 86.36 | **15 / 10** | idéntico |

- El número de elementos bajó porque #1923 recapturó el `limit` de A03; el truncado de Clínicas sigue en el **100 %** de las tarjetas en ≤ 1024 px.
- Alto de tarjeta medido: 75.56–121.05 px (admin 101.83–121.05; clínica 75.56–86.36). Sigue lejos de los 176 px de §46.
- Gap 8/8, radio 8 y 0 tarjetas recortadas verticalmente, sin cambios.
- **Conclusión:** DRV-02 continúa demostrado en el extremo estrecho. La divergencia de alto con §46 sigue abierta como decisión.

#### 16.4.3 DRV-03 — estado de filtro aplicado invisible por debajo de 1280 px

Filtro aplicado con el valor sintético `9` (S3: `SuperSearchField`; S2: barra de escritorio), recorrido de los 11 viewports. [MEDIDO-28/10]

| Superficie | ≥ 1280 (1920 × 1080, 1920 × 945, 1440, 1366, 1280 × 800) | 768–1279 (1279 × 800, 1024, 834, 768) | 360–390 |
| --- | --- | --- | --- |
| S3 Informes admin | 1 grupo, 1 chip visible | **0 chips**; ningún disparador «Filtros» visible | **0 chips**; 1 disparador sin recuento |
| S2 Tokens admin | 1 grupo, 1 chip visible | **0 chips**; ningún disparador «Filtros» visible | **0 chips**; 1 disparador sin recuento |

- Chip a ≥ 1280: 111.31 × 32, radio 8, borde 1, 13/20/500, padding `0 12px`; idéntico al 2026-10-24.
- Causa en el código sin cambios: `AdminReportsCard.tsx:697` y `AdminParticularTokensCard.tsx:1380` (`hidden min-w-0 flex-1 xl:flex`). [CÓDIGO]
- **Conclusión:** DRV-03 continúa demostrado en los mismos 6 de 11 viewports.

#### 16.4.4 Otras desviaciones vigentes sin re-medición runtime

| Desviación | Evidencia vigente |
| --- | --- |
| P2-05: S2/S3/S4 sin anuncio de conteo | `git grep rangeLabel` sin resultados en los tres owners [CÓDIGO] |
| DRV-12 (B3): app bar de 68.11 px con alto ≤ 760 px | Baseline A02 vigente (42 apariciones) y escalón `responsive.css:107` sin cambios |
| DRV-13 D7: táctiles < 44 px | Sin PR desde el acta C25 (D7 «Pendiente», acta C25 §9) |
| DRV-13 D8: cabecera de tabla 32 px frente a 36 de §46 | `thead` = 32 px en las 6 tablas medidas [MEDIDO-28/10] |
| Gap de la barra de filtros S3: 6 px frente a 8 de §45.2 | `column-gap`/`row-gap` = 6 px [MEDIDO-28/10] |

### 16.5 Desviaciones y mediciones que requieren revalidación

| # | Registro del 2026-10-24 | Por qué ya no es vigente sin medir | Estado |
| --- | --- | --- | --- |
| RV-1 | §5.2 «Buscador del header»: combobox de módulos 240 × 36 / 176 × 36, radio 6 | **Obsoleto por #1930**: ahora es una píldora de 40 px (512 / 416 / 288 / 192 de ancho según el rango) [MEDIDO-28/10]. La comparación con el buscador de Drive sigue NO_COMPARABLE (función distinta) | Obsoleto; la nueva geometría queda registrada aquí |
| RV-2 | §5.3 «Alto y paso de fila» 36/37 px y §8 «Fila densa 36 (admin)» | **Obsoleto por #1923**: 40/40 px en las 6 tablas admin medidas. Informes clínica (44), Rutas (52) y Visitas (52/61/101) no se re-midieron | Admin: obsoleto y re-medido. Clínica: **Requiere nueva medición** |
| RV-3 | §5.1 «y de la primera fila» a 1920 × 945 y «Chrome / viewport» a 1280 × 800 | La cabecera y el pager no cambiaron, pero la fila de 40 px y los nuevos `limit` de A03 pueden mover la primera fila y la proporción de chrome; sólo se re-midieron 6 superficies admin | **Requiere nueva medición** (21 superficies) |
| RV-4 | DRV-N3: filas de Visitas de 61 y 101 px | Página modificada por #1922, #1925 y #1932, y fila compacta de 40 px | **Requiere nueva medición** |
| RV-5 | §5.1 «Alto del header» 55.33 px en las 21 superficies | #1930 cambió el fondo y el buscador de la app bar, no su alto. Medido 55.33 px a 1920 × 1080 en `admin-informes`; las otras 20 superficies no se re-midieron, aunque A02 sí las cubre en CI | **Requiere nueva medición** fuera de A02 (1920 × 945, 1280 × 800, 1279 × 800) |
| RV-6 | §9.2 re-verificación axe local (9/84 con `serious`) | Sustituida como evidencia por la spec formal G11 en CI. El registro del 2026-10-24 se conserva como histórico | Obsoleto como estado; histórico vigente |
| RV-7 | §5.6 hover, foco, menús, overlays y tema oscuro geométrico | #1930–#1932 cambiaron superficies, pestañas, contenedor seleccionado y hairlines | **NOT_RUN** (sigue sin medir) |

### 16.6 Roadmap restante

Se retiran de la planificación vigente, sin borrar sus registros (§11, §12, §13):

- **G11-e** (§11 prioridad 1, §12): completado por #1919.
- **G11-c2** (§11 prioridad 2): completado por #1920.
- **Cobertura G11 21 × 2** (§11 prioridad 3): completada por #1921 y verde en CI.
- **PR-DRV-05 / PR-DRV-10** (F-T1..F-T7, readiness §10): completados por #1922, #1924 y #1925.
- **C05** como bloqueo de D8 (fila): resuelto por #1923.

Roadmap vigente:

| Prioridad | Elemento | Tipo / scope | Depende de | Riesgo | Estado |
| --- | --- | --- | --- | --- | --- |
| 1 | Decisiones D-11 (iniciar C26 con C25 PARTIAL), D-01(c), lectura de G12 (§54 vs §58) y subconjunto de estados de §57, registradas por escrito | Gobierno | Nico | Sin riesgo técnico; sin ellas C26 no tiene criterio de inicio ni de cierre | **Bloqueado** (autorización) |
| 2 | D-09 ampliado: registro docs-only de las actas y del rector desactualizados (§16.8, divergencias) | docs-only | Autorización para tocar el rector | Bajo | **Pendiente** |
| 3 | C26-1: sonda de rendimiento de §56.7 | test-only, cohorte `evidence` o `extended` | 1 | Medio (flakiness si entra en `ci`) | **Bloqueado** por 1 |
| 4 | C26-2: regresión visual del subconjunto decidido (Linux/CI) | test-only + artefactos fuera del repo | 1, 3 (catálogo y censos compartidos, en serie) | Medio | **Bloqueado** por 1 |
| 5 | C26-3: acta de cierre contra §58 y acta de programa §62 | docs-only | 3, 4 | Bajo | **Bloqueado** |
| 6 | PR-DRV-06: DRV-03, recuento o anuncio de filtros aplicados en S2/S3 por debajo de 1280 px | frontend | Orden v2: después de C26, salvo decisión de Nico de adelantarlo por ser funcional y de accesibilidad | Bajo–medio (R13 si agrega una franja en 768–1279) | **Pendiente y vigente** |
| 7 | PR-DRV-07: DRV-01, tabla piloto por contenedor (Informes admin) | frontend | Después de C26 | Medio (A02/A03, posible reapertura de truncados) | **Pendiente y vigente** |
| 8 | PR-DRV-08: DRV-02, columnas por contenedor con alto mínimo, sin `auto-fit` | frontend | Después de C26 + decisión sobre los 176 px de §46 | Bajo–medio | **Pendiente y vigente** |
| 9 | P2-05: anuncio de conteo en S2/S3/S4 | frontend (accesibilidad) | Decisión de qué anunciar (acta PR-BUG-03) | Bajo | **Pendiente y vigente** |
| 10 | C25 restante: D6 V1/V2, D7 (táctiles ≥ 44 px), D8 (cabecera 36 px) | frontend + R13 | Autorización R13 por PR | Medio–alto (A02/A03) | **Bloqueado** (autorización R13) |
| 11 | DRV-04, DRV-06, DRV-10, DRV-11, DRV-12 | frontend | D-03, D-04, DRV-01, D-08, D-05/R13 | Variable | **Bloqueado** (decisiones) |

**Dependencias de orden.** C26 ya no depende de G11. Su inicio depende sólo de D-11, porque el rector §50 exige C25 y C25 sigue PARTIAL (D6/D7/D8). La prioridad 10 cerraría C25 y haría innecesaria D-11, pero exige R13 por cada PR. Las prioridades 3 y 4 tocan el mismo catálogo y los mismos censos: van en serie.

### 16.7 Tests y criterios de aceptación pendientes

Sustituye como planificación vigente a §13; §13 queda como registro.

| PR futura | Test necesario | Línea base vigente [MEDIDO-28/10] | Aceptación medible |
| --- | --- | --- | --- |
| PR-DRV-07 (DRV-01) | Repetir la sonda de §16.8 sobre las cinco tablas admin en 1024, 1279 × 800, 1280 × 800, 1366 y 1440 | Truncados en 1280 × 800: Auditoría 10, Usuarios 17, Informes 9; en 1279 × 800: 0 | Truncados en 1280 ≤ truncados en 1279 en cada tabla; columnas visibles monótonas respecto del ancho del contenedor; A02 y A08 sin diferencias; A03 sin drift contra el baseline recapturado por #1923 |
| PR-DRV-06 (DRV-03) | E2E con filtro aplicado en S2 y S3 a 360, 390, 768, 1024 y 1279 | 0 chips y ningún recuento en esos 6 viewports | Recuento visible o anunciado en 11/11 viewports; A01 idéntico; sin salto de línea del disparador a 360; A02/A03/A08 sin drift |
| PR-DRV-08 (DRV-02) | Spec C24 ampliada con ancho mínimo de tarjeta y truncado | Clínicas admin 100 % truncado en ≤ 1024; Informes clínica 185.56 px a 1024 | 0 tarjetas por debajo de la pista mínima decidida; truncado de Clínicas a 1024 < 100 %; A03 sin drift |
| P2-05 | Unit o E2E de la live region en S2/S3/S4 | 0 owners con `rangeLabel` | Cambio de página anunciado en los tres; sin cambio de `limit`/`offset` |
| C26-1 | Sonda de rendimiento (§56.7) | NOT_AVAILABLE | Registro por superficie y métrica en un acta, sin umbrales hasta tener baseline |
| G11 (mantenimiento) | `dashboard-g11-axe-matrix.spec.ts` sobre el head de cada PR que toque superficies del dashboard | 42/42 en CI | Sigue 42/42; ningún `disableRules` nuevo |

### 16.8 Limitaciones y evidencia utilizada

**Sonda dirigida del 2026-10-28.** Es la sonda geométrica y la complementaria del §3, copiadas al scratchpad de esta sesión, fuera del repositorio. Sólo se cambiaron el directorio de salida y un filtro a 6 superficies: `admin-auditoria`, `admin-usuarios`, `admin-informes`, `admin-sesiones`, `admin-tokens` y `admin-clinicas`. Reutilizan sin modificarlos los helpers A02 y la configuración Playwright del repositorio.

| Ejecución | Resultado |
| --- | --- |
| Sonda geométrica (6 superficies × 11 viewports, cuadrícula y filtro aplicado) | `6 passed (1.1m)`, exit 0 |
| Complementaria (cuadrícula de `clinic-informes-full`, chip aplicado) | `2 passed (10.1s)`, exit 0 |
| Calibración contra el baseline A02 vigente (`compareGeometryRecords`) | **48/48** registros canónicos con 0 diferencias |
| Scroll de documento | 0/0 en las 66 combinaciones medidas |
| Higiene | `frontend/next-env.d.ts` = blob `ce4e94a6` antes y después; puertos 3000 y 3107 libres; `git status` sólo con los tres untracked previos; `frontend/test-results/` y `frontend/playwright-report/` preexistentes (creados a las 02:41–02:42 −0300, antes de esta sesión), ignorados y no tocados (`outputDir` y reporter apuntaban al scratchpad) |

Entorno: Windows 11 (`win32`), Chromium de Playwright, `next dev` + API de fixture en 3107, DPR 1, `reducedMotion: reduce`, tema claro, datos sintéticos del fixture. No se registró texto del fixture: sólo cajas, estilos computados y recuentos.

**Mediciones no ejecutadas.**

| Medición | Estado | Motivo |
| --- | --- | --- |
| Re-ejecución local de la matriz G11 | NOT_RUN | Hay evidencia de CI (Linux, E2E Completeness) sobre un árbol idéntico a HEAD; repetirla en Win32 no cambia el estado del gate |
| Geometría de las otras 15 superficies (incl. primera fila y chrome, RV-3) | NOT_RUN | Fuera de la verificación mínima dirigida a DRV-01/02/03 |
| Filas de Visitas (DRV-N3, RV-4) y filas de clínica (RV-2) | NOT_RUN | Requieren una sonda propia de las rutas de Logística |
| App bar a 1280 × 720 (DRV-12) | NOT_RUN | Cubierto por el baseline A02; no se re-midió |
| Hover, foco, menús, overlays y tema oscuro geométrico | NOT_RUN | La sonda no interactúa ni cambia de tema |
| Linux / `next start` de la sonda | NOT_RUN | Máquina local Win32 |
| Comparación nueva con Drive | NO_COMPARABLE en lo ya clasificado | La referencia Drive no cambió (2026-10-19) |

**Lectura de fuentes.** Se leyeron completos este documento, `dashboard-drv-c26-readiness.md` y `GOOGLE_DRIVE_REFERENCIA_UI_CONSOLIDADA.md`. Del rector se leyeron completos el encabezado, los bloques de actualización y §45–§64 (destinos, programas, plan de PR, pruebas, gates, riesgos, aceptación y evidencia faltante). §2–§44 (inventarios del 2026-08-04) no se releyeron línea a línea en esta sesión; el archivo no cambió desde `c8b66052` (diff vacío), así que la lectura del 2026-10-24 sigue aplicando.

**Divergencias documentales detectadas (reportadas, no corregidas: fuera de scope).**

| # | Documento | Registro | Realidad verificada |
| --- | --- | --- | --- |
| DV-1 | `dashboard-drv-c26-readiness.md` §8, §16, §17.7 | «G11 = FAILED» / «NOT_RUN»; C26 bloqueado por G11 | G11 formal 42/42 en CI (#1921) |
| DV-2 | Rector §50 y bloque «Actualización C05 · 2026-10-03» | C05 «BLOCKED», 36 px preservado | C05 implementado (#1923) con R13 autorizada; el acta C05 deja el rector para «un PR docs-only propio» |
| DV-3 | Rector §50 (C04) | «IN_PROGRESS_PREREQUISITE_COMPLETE» | Ya registrado como divergencia 6 en `dashboard-drv-c26-readiness.md` §14; sin cambios |
| DV-4 | `dashboard-c25-microgeometry.md` §9 (registro de deuda) | D4 «Pendiente» | D4 cerrado por #1922/#1924/#1925 (el propio acta lo reconoce en §11) |
| DV-5 | Este documento §1–§15 | G11-e como siguiente PR; C05 BLOCKED; buscador 240 × 36 | Superado por §16 (se conserva como histórico) |

**Riesgos residuales.**

- La sonda es Win32 + `next dev` y cubre 6 superficies; la equivalencia en Linux se infiere de la calibración A02 (48/48), no se midió.
- El estado G11 se apoya en CI de E2E Completeness, que **no** es required check (AGENTS §6). Un cambio futuro puede romperlo sin bloquear el merge.
- El censo de código es estático (`git grep`) y puede no detectar usos indirectos.
- #1909 (Dependabot) sigue abierta; si se fusiona, mueve el baseline de dependencias.

**Gates de esta entrega (AGENTS §6, docs).**

| Gate | Estado |
| --- | --- |
| `git diff --check` | PASSED (exit 0; diff tracked vacío: el archivo es untracked) |
| Inspección directa del archivo: espacios finales, tabuladores, marcadores de conflicto, columnas por tabla y bloques de código balanceados | PASSED (scripts `grep`/`awk`, exit 0; detalle en el informe de la sesión) |
| Paths citados existen en HEAD | PASSED (`git ls-files --error-unmatch`, exit 0) |
| Contenido sensible (credenciales, cookies, tokens, URLs firmadas, emails, connection strings) | PASSED (`grep` sin coincidencias; los SHA son commits públicos y un digest de integridad de archivo, permitidos por AGENTS §9) |
| Conservación de §1–§15 | PASSED (diff contra la copia previa: sólo la nota del encabezado y esta §16) |
| Lint, typecheck, build, `security:public-surface`, `pnpm test`, cohortes E2E | NOT_RUN: docs-only, sin código |
| Sondas temporales | Ejecutadas fuera del repositorio; no son gates |

**Estado del documento (2026-10-28):** READY como reconciliación. Sin commit, push, PR ni escrituras remotas.

---

## 17. Auditoría integral actualizada y roadmap definitivo

| Campo | Valor |
| --- | --- |
| Tipo | Auditoría integral de caja blanca (código, contratos, CI y medición runtime) y roadmap. Docs-only |
| Fecha | 2026-10-28 (tarde, posterior a §16) |
| Rama / HEAD | `docs/dashboard-drv-comparative-reconciliation-20261028` @ `884d345cb80896b1ad7f5d1a743da1f32b9d1d86` (head de la PR #1933) |
| Runtime auditado | Árbol de `a2c87912` (el head de #1933 sólo agrega este archivo). `main` vigente es `4f9fd7b9` (#1934); su diff de `frontend/src` contra `a2c87912` son 3 líneas que sólo retiran `shadow-*` (§17.3), sin efecto geométrico |
| Autorización | Nico: escritura local de esta sección en la rama de #1933, si era seguro. Sin stage, commit, push, `gh pr edit` ni merge |
| Riesgo | R0 (lecturas Git/GitHub/código, sonda temporal fuera del repositorio) + R1 docs-only (este archivo) |
| Regla de conservación | §1–§16 no se reescriben. Esta sección no sustituye sus valores: los fecha y, donde difiere, describe el estado vigente |

Procedencia adicional:

- **[MEDIDO-17]**: sonda de §17.14 sobre el árbol de `a2c87912` (Win32, `next dev`, fixture sintético).
- **[CI-17]**: run de GitHub Actions leído con `gh run view`, con el SHA del head que lo produjo.
- **[DECISIÓN]**: elemento que sólo Nico puede resolver; no es un defecto.

### 17.1 Resumen ejecutivo

1. **Cobertura geométrica completa por primera vez.** La sonda midió las **546** combinaciones canónicas (21 superficies × 13 viewports A02 × 2 temas) más 126 de frontera (1920 × 945, 1280 × 800, 1279 × 800 × 21 × 2): **672 registros**, scroll de documento **0/0 en los 672**, tema efectivo verificado en los 672 y calibración contra el baseline A02 Win32 congelado **273/273 sin diferencias** (tema `normal`). [MEDIDO-17]
2. **G11 sigue cumplido sobre `main` vigente.** La matriz formal (`dashboard-g11-axe-matrix.spec.ts`) pasó 42/42 en E2E Completeness sobre `d9cca254`, cuyo árbol es idéntico a `main@4f9fd7b9` (run `40691799972`, `1997 passed`). [CI-17]
3. **C26 no está bloqueado por G11.** Está bloqueado por gobierno (D-11, D-01(c), lectura de G12, subconjunto de §57) y por la ausencia de la sonda de rendimiento (§56.7, NOT_AVAILABLE). C25 sigue **PARTIAL** (D6/D7/D8).
4. **Desviaciones vigentes y reproducidas hoy:** DRV-01, DRV-02, DRV-03, DRV-12 y DRV-N3 (Visitas, fila de **101 px** en 5 viewports). D7 (táctiles) queda cuantificado: **1 252 de 1 842** controles visibles en teléfono (68 %) miden < 44 px y **318** (17 %) < 24 px (tema normal, 5 viewports de teléfono). [MEDIDO-17]
5. **Estabilidad.** La PR #1933 tiene E2E Completeness en `failure` por **un único test flaky** (`dashboard-card-navigation-shell.spec.ts:540`, `failOnFlakyTests`): es el defecto de espera por `ElementHandle` que corrige la PR **#1935** (abierta). La corrección **no** está en #1933 y no debe estarlo: #1933 es docs-only. [CI-17]
6. **Recuento DRV (16 ítems: DRV-01..13 + N1..N3):** 5 implementados y verificados · 2 parciales · 5 pendientes y reproducibles · 4 bloqueados por decisión o dependencia (§17.6).

### 17.2 Baseline Git, PR y entorno

| Elemento | Valor | Fuente |
| --- | --- | --- |
| Rama al iniciar | `fix/dashboard-e2e-hydration-locator-20261028` @ `e5571d4f` (árbol limpio salvo dos untracked generados). Es la rama de la PR **#1935**, no la de #1933 | `git branch --show-current`, `gh pr list --head` |
| Seguridad del cambio de rama | `e5571d4f` ya está en `origin/fix/dashboard-e2e-hydration-locator-20261028` (ancestro de `59c75880`); diff tracked vacío; ningún archivo tracked modificado. El cambio a la rama de #1933 no podía perder trabajo | `git merge-base --is-ancestor`, `git diff --stat` |
| Operación local | `git switch docs/dashboard-drv-comparative-reconciliation-20261028` (rama local existente, = `origin/…` en `884d345c`). Sin `-c`, sin `--force` | R1 local (§17.15, nota de clasificación) |
| HEAD de trabajo | `884d345cb80896b1ad7f5d1a743da1f32b9d1d86` = `headRefOid` de #1933 | `gh pr view 1933` |
| `origin/main` | `4f9fd7b9d4a83c4f9690b0c5860fb546604a11d8` tras `git fetch --prune` (R1); #1933 está 1 detrás / 1 adelante (`mergeStateStatus` BEHIND) | `git rev-list --left-right --count` |
| PR #1933 | OPEN, no draft, base `main`, 1 archivo (este), MERGEABLE, BEHIND. Required: `validate-pr-governance`, `qga-workflow-security`, `validate-backend`, `validate-frontend` en SUCCESS sobre `884d345c`; E2E Completeness (no required) FAILURE | `gh pr view 1933 --json statusCheckRollup` |
| PR #1935 | OPEN; 1 archivo: `frontend/e2e/platform/app-shell/dashboard-card-navigation-shell.spec.ts`; head `59c75880` (merge de `main` sobre `e5571d4f`); E2E Completeness SUCCESS sobre `e5571d4f` (run `40721444486`); sobre `59c75880` en curso al cerrar | `gh pr view 1935`, `gh run list` |
| Otras PR abiertas | #1909 (Dependabot frontend) | `gh pr list --state open` |
| Stashes | 5, intactos (`stash@{0}`…`stash@{4}`) | `git stash list` |
| Worktrees | `C:/PORTAL-VETNEB` y `.claude/worktrees/compassionate-gould-ad80c4` (`283e4118`, ajeno, no tocado) | `git worktree list` |
| Untracked | `frontend/AGENTS.md`, `frontend/CLAUDE.md` (generados por `next dev`, no son contrato; preservados) | `git status --short --untracked-files=all` |
| `AGENTS.md` versionados | Sólo el raíz | `git ls-files` |
| Entorno de medición | Windows 11, Chromium de Playwright, `next dev` + API de fixture 3107, DPR 1, `reducedMotion: reduce` | — |

### 17.3 Inventario de cambios fusionados

Las 13 PR pedidas están `MERGED` y sus merge commits son ancestros de `origin/main` (`git merge-base --is-ancestor`, 13/13). [PR]

| PR | Merge commit | `mergedAt` (UTC) | Efecto comprobado en código / runtime | Criterio de aceptación |
| --- | --- | --- | --- | --- |
| #1919 G11-e | `afa00968` | 2026-10-24T22:50:16Z | DRV-N1/N2 corregidos | Cumplido: 0 `label-content-name-mismatch` en la matriz G11 [CI-17] |
| #1920 G11-c2 | `221dff97` | 2026-10-25T01:11:28Z | V-4/V-5 corregidos sin tocar tokens globales | Cumplido [CI-17] |
| #1921 G11 matriz | `e0614e9c` | 2026-10-25T04:06:52Z | Spec 21 × 2 × 2 sin `disableRules` | Cumplido: 42/42 sobre el árbol de `main@4f9fd7b9` |
| #1922 F-T1 | `ebe88a7c` | 2026-10-25T06:07:47Z | `#id` de Visitas abre `FieldVisitDetailDialog` | Cumplido (código + CI de la PR) |
| #1923 C05 | `2596cf5e` | 2026-10-25T11:01:20Z | Fila compacta 40 px | Cumplido: fila 40 en las 6 tablas admin, 16/16 viewports de lista [MEDIDO-17] |
| #1924 F-T2 | `25cd6e50` | 2026-10-25T21:13:35Z | Detalle de Sesiones | Cumplido (código) |
| #1925 F-T3..F-T7 | `7c9b1fa9` | 2026-10-26T04:13:38Z | Valores completos en detalle | Cumplido (código) |
| #1926 D5 | `2c5c33b5` | 2026-10-26T20:06:57Z | Etiquetas de la barra móvil 11/16 | Cumplido: barra 51.19 px en los 5 teléfonos y 21 superficies [MEDIDO-17] |
| #1929 D6 parcial | `208c92bb` | 2026-10-27T12:15:47Z | 12 gaps 6 → 8 px | Parcial por diseño (acta C25 §12.5) |
| #1930 shell | `0d83fa80` | 2026-10-27T19:30:58Z | App bar opaca, píldora de búsqueda | Cumplido; alto del app bar sin cambios (55.33) |
| #1931 superficies | `6f0adb3b` | 2026-10-28T05:18:50Z | Pestañas tonales, superficies planas | Cumplido (código; sin medición de color en esta sonda) |
| #1932 hairlines | `a2c87912` | 2026-10-28T06:22:18Z | Sin sombra en campana y pager centrado | Cumplido (código) |
| #1934 utility controls | `4f9fd7b9` | 2026-10-28T14:22:00Z | `shadow-*` retirado de «Exportar CSV» (Intentos fallidos), «Limpiar» (Informes clínica) y `ThemeModeToggle` del topbar | Cumplido; E2E Completeness SUCCESS sobre `d9cca254` (árbol = `main`) [CI-17] |

No se encontraron regresiones geométricas atribuibles a estas PR: la calibración 273/273 contra el baseline A02 recapturado por #1923 incluye todas las superficies y viewports canónicos. [MEDIDO-17]

### 17.4 Matriz de las 21 superficies

Tema `normal`; el oscuro dio valores geométricos y de truncado **idénticos** (1 111 elementos truncados en cada tema, 0 diferencias por registro). «Chrome» = píxeles antes del primer contenido / proporción del viewport (`derived.chromeBeforePrimaryContent*` de A02); límite G9: ≤ 240 px a 1920 y ≤ 32 % en 768–1366. [MEDIDO-17]

| Superficie | Chrome 1920 × 1080 | Chrome 1366 × 768 | Chrome 1280 × 720 | Chrome 768 × 1024 | Táctiles < 44 / visibles (teléfono, 5 vp) | Observación |
| --- | --- | --- | --- | --- | --- | --- |
| `admin-hub` | 125 / 11.6 % | 114 / 14.9 % | 125 / 17.3 % | 124 / 12.1 % | 15 / 40 | — |
| `admin-resumen` | 125 / 11.6 % | 114 / 14.9 % | 125 / 17.3 % | 124 / 12.1 % | 15 / 40 | — |
| `admin-clinicas` | 151 / 14.0 % | 146 / 19.0 % | 158 / 21.9 % | 151 / 14.7 % | 88 / 113 | Cuadrícula 100 % truncada ≤ 1024 (DRV-02); 1 control interactivo fuera del viewport a 768 × 1024 sin scroll de documento (sin identificar) |
| `admin-usuarios` | 159 / 14.7 % | 153 / 20.0 % | 165 / 23.0 % | 158 / 15.5 % | 115 / 140 | 17 truncados a 1280 × 800 (DRV-01); 34 a 768 |
| `admin-auditoria` | 164 / 15.2 % | 158 / 20.6 % | 170 / 23.7 % | 220 / 21.5 % | 164 / 189 | 10 truncados a 1280 × 800 (DRV-01) |
| `admin-sesiones` | 169 / 15.6 % | 163 / 21.3 % | 175 / 24.3 % | 168 / 16.4 % | 167 / 192 | 25 truncados a 768 (con detalle F-T2) |
| `admin-informes` | 190 / 17.6 % | 185 / 24.1 % | 197 / 27.3 % | 266 / 26.0 % | 120 / 145 | Chrome 1279 × 800 = 223 vs 185 a 1280 × 800 (barra de filtros en dos filas en régimen rail) |
| `admin-tokens` | 222 / 20.5 % | 216 / 28.2 % | 228 / **31.7 %** | 316 / 30.8 % | 80 / 105 | Máximo de chrome del dashboard: 0.3 pp bajo G9 |
| `admin-estado` | 69 / 6.4 % | 64 / 8.3 % | 76 / 10.5 % | 69 / 6.7 % | 30 / 55 | — |
| `admin-mantenimiento` | 69 / 6.4 % | 64 / 8.3 % | 76 / 10.5 % | 69 / 6.7 % | 15 / 40 | — |
| `admin-precios` | 69 / 6.4 % | 64 / 8.3 % | 76 / 10.5 % | 69 / 6.7 % | 40 / 65 | — |
| `clinic-informes` | 211 / 19.5 % | 200 / 26.1 % | 211 / 29.3 % | 304 / 29.7 % | 91 / 121 | 16 truncados a 768 |
| `clinic-informes-full` | **238** / 22.1 % | 228 / 29.6 % | 221 / 30.6 % | 260 / 25.4 % | 67 / 97 | 2 px bajo G9 a 1920; cuadrícula de 185.56 px a 1024 (DRV-02) |
| `clinic-logistica` | 83 / 7.7 % | 73 / 9.5 % | 83 / 11.6 % | 82 / 8.1 % | 15 / 60 | — |
| `clinic-logistica-full` | 224 / 20.8 % | 214 / 27.8 % | 224 / 31.2 % | 223 / 21.8 % | 65 / 95 | — |
| `clinic-log-rutas` | 198 / 18.4 % | 188 / 24.4 % | 198 / 27.6 % | 197 / 19.3 % | 30 / 60 | Fila 52 (61 a 768) |
| `clinic-log-visitas` | 198 / 18.4 % | 188 / 24.4 % | 198 / 27.6 % | 197 / 19.3 % | 30 / 60 | **Fila 101 px** en 5 viewports; 6 truncados en todos (DRV-N3) |
| `clinic-log-metricas` | 84 / 7.8 % | 74 / 9.6 % | 84 / 11.7 % | 83 / 8.1 % | 30 / 60 | — |
| `clinic-operaciones` | 83 / 7.7 % | 73 / 9.5 % | 83 / 11.6 % | 82 / 8.1 % | 15 / 45 | — |
| `clinic-perfil` | 83 / 7.7 % | 73 / 9.5 % | 83 / 11.6 % | 82 / 8.1 % | 45 / 75 | — |
| `clinic-tokens` | 83 / 7.7 % | 73 / 9.5 % | 83 / 11.6 % | 82 / 8.1 % | 15 / 45 | — |

**Lectura.** G9 se cumple en las 21 superficies en todos los viewports medidos, pero con margen mínimo en `clinic-informes-full` (238 de 240 px) y `admin-tokens` a 1280 × 720 (31.7 % de 32 %): cualquier chrome nuevo en esas dos superficies rompe G9. Los recuentos táctiles cuentan cada control una vez por viewport (5 teléfonos), no controles únicos.

### 17.5 Auditoría visual y geométrica

**A. Shell y navegación** [MEDIDO-17]

| Elemento | Medido (21 superficies) | Rector §46 | Estado |
| --- | --- | --- | --- |
| Topbar (contenedor A02) | 55.33 en 768–1920 con alto > 760; **68.11** a 1280 × 720 en 21/21; 48 en teléfono | 56 ± 2 | Cumple salvo con alto ≤ 760 px (DRV-12) |
| Barra interna `[data-workspace-app-bar]` | 54.33 también a 1280 × 720 | — | La diferencia de 13.78 px a 1280 × 720 viene del contenedor: `responsive.css:107-108` fija `--dash-header-h: 4rem` en el tramo «denso» `max-height: 760px`, que agranda en vez de compactar [CÓDIGO] |
| Drawer / rail | Drawer ≥ 1280; rail 768–1279.98 (frontera exacta reproducida en 1279/1280) | 256 / 80 | Sin cambios desde §16 |
| Barra inferior | 51.19 px en los 5 teléfonos | — | Sin cambios (D5 no la movió) |
| Familia tipográfica | `Inter` en 672/672 registros | `--font-ui` | Cumple (identidad VETNEB, intencional) |

**B. Tipografía** [MEDIDO-17]

| Elemento | Valor computado | Rector §45.2 | Estado |
| --- | --- | --- | --- |
| Celda admin (Auditoría, Usuarios, Sesiones, Clínicas) | 13 / 19.5 / 400 | body-sm 13/20 | Dentro de tolerancia (−0.5 de interlineado) |
| Celda admin (Informes, Tokens) | **12 / 16** / 400 | body-sm 13/20 | DIFERENTE: dos tamaños de celda en el mismo producto |
| Celda clínica (Rutas, Visitas) | 12 / 16 / 400, padding `0 14px` | body-sm, `0 12px` | DIFERENTE (tamaño y padding) |
| Cabecera de tabla | 12 / 16 / 600, tracking 0.96 px (admin, Rutas, Visitas); 12/16/**700** sin tracking (Informes clínica) | label-md | Dos estilos de cabecera |
| Título de sección (primer `h1/h2`) | 14 / 20 / 600 con tracking 1.68 px en la mayoría; 12/16/600 en dos superficies | title-sm | Heterogéneo; requiere decisión de jerarquía (D-08) |

**C. Geometría de colecciones** [MEDIDO-17]

| Métrica | Admin | Clínica | Rector §46 | Estado |
| --- | --- | --- | --- | --- |
| Fila | 40 (6 tablas, 16/16 vp) | 44 Informes (40 a 1280 × 720) · 52 Rutas (61 a 768) · Visitas 52/61/**101** | 40 ± 1 | Admin cumple; clínica DIFERENTE |
| Cabecera | 32 (32.5 en Informes a 768) | 44 | 36 ± 1 | DIFERENTE en ambos (D8) |
| Padding de celda | `0 8px` (5 tablas), `0 12px` (Clínicas) | `0 12px` / `0 14px` | `0 12px` | DIFERENTE en 5 tablas admin y en Logística |
| Cuadrícula: gap / radio | 8 / 8 | 8 / 8 | 12 radio | Radio DIFERENTE |
| Tarjeta de cuadrícula: alto | 101.83–121.05 | 75.56–86.36 | **176** | DIFERENTE ([DECISIÓN] D-CARD) |

**D. Colores y estados.** Tema efectivo (`html[data-theme]`) verificado en 672/672 registros. La medición de contraste vigente es la de G11 en CI (42/42, 2 viewports). **NOT_RUN** en esta sonda: hover, `focus-visible`, `active`, `selected`, `disabled`, loading, empty, error, menús, diálogos y paneles (la sonda no interactúa). #1931/#1932/#1934 cambiaron superficies y sombras sin medición de color propia.

**E. Responsive y Zero Scroll.** 0 px de scroll de documento y de `body` en 672/672; A02 calibrado 273/273. Un control interactivo de `admin-clinicas` a 768 × 1024 (ambos temas) queda fuera del viewport sin producir scroll de documento: no se identificó el nodo (posible recorte dentro de un contenedor). **REQUIERE NUEVA MEDICIÓN** (§17.11 RM-15).

### 17.6 DRV-01 a DRV-13: estado vigente

| ID | Clasificación | Evidencia vigente | Diferencia con §16 |
| --- | --- | --- | --- |
| DRV-01 | **PENDIENTE Y REPRODUCIBLE** | Truncados en tabla 1279 × 800 → 1280 × 800: Auditoría 0 → 10, Usuarios 0 → 17, Informes 0 → 9; Sesiones y Tokens 0 → 0. Contenedor 1164.75 → 989.75 (Auditoría/Usuarios/Sesiones) y 1132.75 → 957.75 (Informes/Tokens). Columnas 6 → 7 (7 → 8 Informes). A 1366: Auditoría 5, Usuarios 5, Informes 9; a 1440: 3 / 0 / 7. A 1280 × 720 Informes 9. `@container` = 0; `lg:/xl:table-cell` en 5 owners (4/4/4/4/2) [MEDIDO-17] [CÓDIGO] | Idéntico; ampliado a 1600 y 1280 × 720 |
| DRV-02 | **PENDIENTE Y REPRODUCIBLE** + [DECISIÓN] D-CARD | Columnas fijas 3/3/2 (`ContentGrid columns={3}` en `AdminClinicsManagementCard.tsx:760` y `AdminReportsCard.tsx:779`; `columns={2}` en `InformesReportsList.tsx:746`). Clínicas admin: tarjetas truncadas 13/13 (1024), 23/23 (834), 19/19 (768). Informes clínica (ruta completa): 10/10 a 1024 y 1280 × 720, 11/11 a 1280 × 800, 9/10 a 1366, 11/13 a 1440; tarjeta 185.56 px a 1024. 0 tarjetas recortadas verticalmente [MEDIDO-17] | Ampliado: Informes clínica trunca la mayoría de las tarjetas en todo 1024–1440, no sólo a 1024 |
| DRV-03 | **PENDIENTE Y REPRODUCIBLE** | Filtro aplicado (S3 Informes admin, S2 Tokens admin): chip visible sólo en ≥ 1280. 768–1279: 0 chips **y 0 disparadores** de filtros. 360–390: 0 chips y 1 disparador sin recuento. 0 live regions con el estado del filtro en los 7 viewports. Causa: `hidden min-w-0 flex-1 xl:flex` (`AdminReportsCard.tsx:697`, `AdminParticularTokensCard.tsx:1380`) [MEDIDO-17] [CÓDIGO] | Agrega: semántica accesible del estado = ausente bajo 1280 |
| DRV-04 | **BLOQUEADO POR DECISIÓN** (D-03) | `<ActiveFilterChips` sólo en S2/S3 [CÓDIGO] | Sin cambio |
| DRV-05 | **IMPLEMENTADO PARCIALMENTE** | Landmark `search` (#1899) vigente; P2-05: `rangeLabel` ausente en S2/S3/S4 (`git grep` sólo en 7 owners admin ajenos) [CÓDIGO] | Sin cambio |
| DRV-06 | **BLOQUEADO POR DECISIÓN** (D-04) | `ActionMenu` de un ítem en Informes admin [CÓDIGO] | Sin cambio |
| DRV-07 | **IMPLEMENTADO Y VERIFICADO** | F-T1..F-T7 fusionados (#1922/#1924/#1925); los 6 truncados de Visitas tienen detalle por `#id` | Sin cambio |
| DRV-08 | **IMPLEMENTADO Y VERIFICADO** | `SkipToContent` montado | Sin cambio |
| DRV-09 | **IMPLEMENTADO Y VERIFICADO** (por código y spec existente; forced-colors no re-medido aquí) | `interactions.css` bloque DRV03 | Sin cambio |
| DRV-10 | **BLOQUEADO** (depende de DRV-01) | `details={` = 0 usos [CÓDIGO] | Sin cambio |
| DRV-11 | **BLOQUEADO POR DECISIÓN** (D-08) | Hover 0.06 / 0.10 (`tokens.css:135,228`); celdas 12/16 y 13/19.5 [CÓDIGO] [MEDIDO-17] | Agrega la heterogeneidad tipográfica de §17.5 B |
| DRV-12 | **PENDIENTE Y REPRODUCIBLE** | Topbar 68.11 a 1280 × 720 en 21/21 superficies; 55.33 en los demás anchos ≥ 768 [MEDIDO-17]. Causa `responsive.css:107-108` [CÓDIGO] | Pasa de «evidencia por baseline» a medido; causa localizada |
| DRV-13 | **IMPLEMENTADO PARCIALMENTE** | D5 cerrado; D6 parcial; D7: 1 252/1 842 < 44 px (68 %) y 318 < 24 px en teléfono; D8: cabecera 32 (admin) / 44 (clínica) vs 36 [MEDIDO-17] | D7 cuantificado |
| DRV-N1 | **IMPLEMENTADO Y VERIFICADO** | #1919; G11 42/42 [CI-17] | Sin cambio |
| DRV-N2 | **IMPLEMENTADO Y VERIFICADO** | #1919; G11 42/42 [CI-17] | Sin cambio |
| DRV-N3 | **PENDIENTE Y REPRODUCIBLE** | Visitas: fila 52 (1920, 1600, 1440, 1920 × 945, 1279 × 800), 61 (1366), **101** (1280 × 800, 1280 × 720, 1024, 834, 768); 6 truncados en las 11 vistas de escritorio/tablet; 3 filas visibles en el fixture. Rutas: 52, 46 (1280 × 720), 61 (768) [MEDIDO-17] | Pasa de hipótesis a medido |

Totales: **5** implementados y verificados (DRV-07, 08, 09, N1, N2) · **2** parciales (DRV-05, 13) · **5** pendientes y reproducibles (DRV-01, 02, 03, 12, N3) · **4** bloqueados (DRV-04, 06, 11 por decisión; DRV-10 por dependencia). Ninguno OBSOLETO ni NO COMPARABLE en esta revisión; las comparaciones NO_COMPARABLE con Drive de §5 se mantienen.

### 17.7 Accesibilidad y pruebas

| Aspecto | Estado | Evidencia |
| --- | --- | --- |
| G11 axe 21 × 2 temas × 2 viewports (1366, 390), sin `disableRules` | **PASSED en CI** para `main@4f9fd7b9` (árbol de `d9cca254`) | run `40691799972`, 42/42 ✓ [CI-17]. También 42/42 dentro de los `1996 passed + 1 flaky` del run `40687491941` (#1933) |
| G11 en los otros 11 viewports, overlays, diálogos, menús y estados | **NOT_RUN** | Fuera de la spec formal |
| `aria-current`, `aria-label` de navegación | Cubiertos por specs B09/C23 existentes | No re-ejecutados |
| Foco, orden de Tab, focus trap y retorno | Cubiertos parcialmente por C13/C17–C22 | **NOT_RUN** en esta auditoría |
| Forced-colors | DRV-09 (#1898); portales a `body` sin outline (acta C25 §8) | **Pendiente** (portales) |
| Objetivos táctiles ≥ 44 px (§62.16) | **FAILED** cuantificado (68 %) | [MEDIDO-17] |
| Estado de filtros (DRV-03) y anuncio de conteo (P2-05) | **FAILED** bajo 1280 / parcial | [MEDIDO-17] [CÓDIGO] |
| Controles pre/post hidratación | Flaky conocido en `dashboard-card-navigation-shell.spec.ts:540` | Abajo |
| Staging (G12) | **BLOCKED** | Sin entorno, tenants ni delegación R3 |

**Antecedente E2E de #1933.** El run `40687491941` (E2E Completeness sobre `884d345c`) terminó con `1996 passed`, `1 flaky` y `failure` por `failOnFlakyTests`. El test: «once hydrated, the same control navigates through the router» (`:540`), `TimeoutError: page.waitForFunction: Timeout 8000ms exceeded` en `:559`. Causa (diagnóstico de la sesión anterior, coherente con el diff): `waitForFunction` recibía un `ElementHandle` capturado antes de que Suspense reemplazara el nodo, y esperaba un atributo sobre un nodo desconectado. **Corrección:** commit `e5571d4f` (PR **#1935**) sustituye las dos esperas (`:183`, `:559`) por `expect(locator).toHaveAttribute(…, { timeout: 8_000 })`: mismo timeout, sin retries ni skips, sin tocar `failOnFlakyTests`. Verificación: está en `origin/fix/dashboard-e2e-hydration-locator-20261028`; **no** está en #1933; E2E Completeness SUCCESS sobre `e5571d4f`. La corrección se preservó íntegra (no se tocó la rama ni el archivo).

### 17.8 C25 y C26

**C25 = PARTIAL.**

| Sub-objetivo | Estado | Evidencia |
| --- | --- | --- |
| D1 foco real / D2 line-height / D3 iconos | Cerrado (#1891) | Acta C25 §9 |
| D4 truncamientos sin valor completo | **Cerrado** (#1922, #1924, #1925) | Acta C25 §11; el registro §9 dice «Pendiente» (divergencia DV-4) |
| D5 etiquetas de la barra móvil | **Cerrado** (#1926) | 11/16; barra 51.19 [MEDIDO-17] |
| D6 espaciados | **Parcial** (#1929): quedan V1, V2 (R13), F1, T1, X3 (chrome/guards), M1, Q1; H3 excepción decidida | Acta C25 §12.1, §12.5 |
| D7 objetivos táctiles | **Pendiente**: 1 252/1 842 < 44 px en teléfono | [MEDIDO-17] |
| D8 densidad y cabeceras | **Parcial**: fila 40 cerrada (#1923); cabecera 32/44 vs 36 pendiente (R13) | [MEDIDO-17] |
| Portales a `body` en forced-colors | Pendiente | Acta C25 §8 |

**C26 = NOT_STARTED.**

| # | Elemento | Estado |
| --- | --- | --- |
| 1 | Prerrequisitos verificables | G11 **PASSED** (CI); C23b cerrado; PR-DRV-02/03 y PR-BUG-03 fusionadas; contratos A02/A08 verdes en CI de `main` |
| 2 | Decisiones de gobierno pendientes | D-11, D-01(c), lectura de G12 (§54 vs §58), subconjunto de estados de §57 (§17.10) |
| 3 | D-11 / D-01(c) | **PENDIENTES** sin registro escrito |
| 4 | Relación con G12 | G12 «tras C26» (§58) vs «Gates de §58 verdes» (§54): según la lectura, C26 cierra con G12 BLOCKED o no puede cerrar |
| 5 | Sonda de rendimiento §56.7 | **NOT_AVAILABLE**: 0 archivos con `PerformanceObserver`, `layout-shift` o `longtask` en `frontend/e2e` [CÓDIGO] |
| 6 | Cobertura visual | §57 nominal 4 914 capturas; hoy existen 546 registros geométricos de estado inicial (esta sonda) y las baselines Linux de `visual-linux`. Falta el subconjunto decidido |
| 7 | Artefactos de cierre | Acta C26 (§11 AGENTS: documentación detallada); acta de programa §62 con estados canónicos; artefactos visuales fuera de `docs/` y de `test-results/` |
| 8 | Secuencia mínima para comenzar | RM-02 → RM-01 → RM-04 (§17.12) |
| 9 | Criterio de completado | §17.13 |

### 17.9 Divergencias documentales

Se mantienen DV-1..DV-5 de §16.8. Nuevas:

| # | Documento | Registro | Realidad verificada |
| --- | --- | --- | --- |
| DV-6 | Este documento §16.1 | «Rama / HEAD … @ `a2c87912` (= `origin/main`)» | `main` avanzó a `4f9fd7b9` (#1934); la PR está BEHIND |
| DV-7 | Este documento §16.4.4 | DRV-12 «no re-medido a 1280 × 720» | Medido: 68.11 en 21/21 (§17.6) |
| DV-8 | Rector §46 / `responsive.css:105` | Comentario «Dense tier — small laptops» | El tramo aumenta el header a 4 rem (sube el chrome); el nombre describe lo contrario de su efecto |
| DV-9 | `dashboard-drv-c26-readiness.md` §7.1, §10, §11.1 | «El inicio de C26 sigue bloqueado por G11» | G11 PASSED en CI desde #1921 (ya reportado como DV-1; se reafirma con `main@4f9fd7b9`) |

Ninguna fuente rectora se modificó (fuera del scope autorizado). La corrección corresponde a RM-03.

### 17.10 Matriz de riesgos y decisiones

**Decisiones que bloquean trabajo** [DECISIÓN]

| Código | Problema | Opciones viables | Beneficio / riesgo | Recomendación | Impacto de no decidir | Desbloquea |
| --- | --- | --- | --- | --- | --- | --- |
| D-11 | C26 depende de C25 (§50) y C25 está PARTIAL | (a) iniciar C26 con D6/D7/D8 como deuda registrada; (b) cerrar antes D7 + D8 + D6-V1/V2 con R13 | (a) adelanta C26 sin tocar A02/A03; deja §62.16 FAILED en el acta. (b) cumple el rector literal; 3+ PR con rebaseline A02/A03 | **(a)**, registrada por escrito en el acta C26: D7/D8 son R13 de alto costo y no afectan a la validación de C26 | C26 no puede empezar | RM-04, RM-05, RM-06 |
| D-01(c) | Criterio de cierre de C26 | (c) cerrar contra los gates de §58 y registrar §62 aparte; alternativa: exigir todo §56.6 | (c) medible hoy; la alternativa exige D7 y P2-05 antes | **(c)** (lectura literal de §54) | C26 sin criterio de cierre | RM-06 |
| D-12 / lectura G12 | §54 vs §58 | G12 dentro del cierre de C26; G12 como gate de rollout posterior | Dentro: C26 exige una operación R3. Después: C26 cierra con G12 BLOCKED explícito | **Gate de rollout posterior**, con G12 BLOCKED explícito en el acta | Riesgo RC-2 (cierre falso) o C26 imposible de cerrar | RM-06, G12 |
| D-§57 | Subconjunto de estados de la regresión visual | inicial + filtros activos + error + empty; o los 9 estados | Subconjunto: ejecutable en CI Linux; 9 estados: 4 914 capturas sin baseline | **inicial, filtros activos, error, empty, focus** en 21 × 13 × 2 | C26-2 sin criterio medible | RM-05 |
| D-CARD | Alto de tarjeta: §46 fija 176; medido 75.56–121.05 | (a) adoptar 176; (b) enmendar §46 a un alto mínimo por contenido; (c) mantener alto = f(`limit`) | (a) reduce las tarjetas visibles a la mitad aprox. (A03, R13); (b)/(c) conservan capacidad | **(b)**: enmienda docs-only con alto mínimo medido y ancho mínimo de pista; la ilegibilidad está en el ancho, no en el alto | PR-DRV-08 sin destino | RM-09 |
| D-03 | Chips de filtros en S6/S7 (clínica) | agregar chips; o sólo recuento | — | Decidir junto con RM-07 (mismo patrón) | DRV-04 abierto | DRV-04 |
| D-04 | `ActionMenu` de un ítem | retirar el menú; o agregar acciones reales | Retirar: −1 control duplicado; agregar: alcance funcional nuevo | Retirar | DRV-06 abierto | DRV-06 |
| D-05 | App bar 68.11 con alto ≤ 760 | igualar a 56 (R13 A02/A03); mantener | Igualar libera 12.78 px en 1280 × 720 y baja el chrome de `admin-tokens` de 31.7 % | **Igualar**, con R13 propia | DRV-12 y margen G9 mínimo | RM-11 |
| D-07 | Táctiles ≥ 44 px en < 768 | R13 por familia de controles | Accesibilidad móvil vs capacidad A03 | Autorizar por familia (pager, chips, iconos) | §62.16 FAILED | RM-12 |
| D-08 | Tokens de hover y tipografía de celda (12/16 vs 13/19.5 vs §45.2 13/20) | unificar a 13/20; enmendar §45.2 | Unificar mueve alturas de fila clínica; enmienda documental sin riesgo | Enmienda docs-only + unificación de celdas admin 12 → 13 en una PR propia | DRV-11 abierto | DRV-11 |

D-06 (truncados) queda **resuelta** por #1922/#1924/#1925 y deja de figurar.

**Riesgos**

| # | Riesgo | Impacto | Mitigación |
| --- | --- | --- | --- |
| R17-1 | Margen G9 mínimo (238/240 px; 31.7/32 %) | Cualquier chrome nuevo rompe G9 | Toda PR que toque chrome de `clinic-informes-full` o `admin-tokens` re-mide G9 |
| R17-2 | E2E Completeness no es required; un flaky la deja roja sin bloquear el merge | Evidencia G11 de un head puede faltar | Fusionar #1935 antes de usar E2E Completeness como evidencia de C26 |
| R17-3 | Sonda Win32 + `next dev`; Linux sólo inferido de la calibración A02 | Medio | CI Linux sobre el head de cada PR |
| R17-4 | Ninguna medición de estados interactivos tras #1930–#1934 | Medio (color/hover/focus) | C26-2 con el subconjunto D-§57 |
| R17-5 | #1909 (Dependabot) abierta | Mueve el baseline de dependencias | Capturar el head al iniciar C26 |

### 17.11 Hoja de ruta priorizada

Identificadores de planificación, **no** autorización para abrir PR. Esfuerzo en horas de ingeniería, con incertidumbre ±50 % salvo indicación; supone la máquina local y CI disponibles.

| ID | Objetivo | Hallazgo | Estado | Prioridad | Impacto | Complejidad | Riesgo | Dependencias | Archivos candidatos | Implementación | Tests | Criterio de aceptación | Rollback | Evidencia |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RM-01 | Decisiones D-11, D-01(c), G12, D-§57 registradas por escrito | C26 | Pendiente | P1 | Gobierno | Baja | R0/R1 docs | Ninguna | Acta C26 nueva o enmienda del rector (D-09) | Registro docs-only de las cuatro decisiones | `git diff --check` | Cuatro decisiones con fecha y texto en el repositorio | Revert del doc | §17.10 |
| RM-02 | E2E Completeness estable | Flaky `:540` | Corrección lista en #1935 | P1 | Estabilidad | Baja | R2 (merge, [MANUAL-NICO] o delegación) | Checks de #1935 sobre `59c75880` | `dashboard-card-navigation-shell.spec.ts` | Fusionar #1935; luego `gh pr update-branch 1933` y re-ejecutar E2E Completeness | Spec con `--repeat-each=20`; E2E Completeness | 0 flaky en dos runs completos consecutivos sobre `main` | `git revert` del squash | §17.7 |
| RM-03 | Actas y rector sin estados obsoletos | DV-1..DV-9 | Pendiente | P2 | Trazabilidad | Baja | R1 docs (fuentes rectoras: autorización propia) | RM-01 | Rector §50/§46, `dashboard-drv-c26-readiness.md`, acta C25 §9 | Bloques de actualización fechados, sin reescribir histórico | `git diff --check`; paths citados | 0 divergencias DV abiertas | Revert | §16.8, §17.9 |
| RM-04 | C26-1: sonda de rendimiento §56.7 | C26 | NOT_AVAILABLE | P1 | Estabilidad / rendimiento | Alta | R1 test-only | RM-01 (D-11) | Spec nuevo en `frontend/e2e/`, `suites/catalog.ts`, censos de catálogo | CDP + `PerformanceObserver` (CLS, long tasks), conteo de `ResizeObserver` y de peticiones de paginación por resize, 768 × 600; cohorte `extended`/`evidence`, fuera de `ci` | Spec nuevo; catálogo; censos 01B | Registro por superficie y métrica en el acta; sin umbrales hasta tener baseline | Revert | Rector §56.7 |
| RM-05 | C26-2: regresión visual del subconjunto D-§57 | C26 | Bloqueado | P1 | Visual | Alta | R1 test-only + R13 (baselines) | RM-01, RM-04 (catálogo compartido, en serie) | `frontend/e2e/regression/visual/` | Capturas Linux del subconjunto; aprobación manual lado a lado | `visual-linux` en CI | Lista de capturas aprobadas con SHA del head | Revert de baselines | Rector §57 |
| RM-06 | C26-3: acta de cierre | C26 | Bloqueado | P1 | Gobierno | Media | R1 docs | RM-04, RM-05, RM-02 | `docs/implementation/` (acta C26) | Gates de §58 con estado canónico; §62 aparte | `git diff --check` | Cada gate de §58 con estado y SHA; G12 explícito | Revert | §17.13 |
| RM-07 | PR-DRV-06: estado de filtros visible y anunciado < 1280 | DRV-03 | Pendiente y reproducible | P2 (P1 si se confirma que el valor tampoco queda visible en el campo) | Funcional + accesibilidad | Media | R1; R13 si agrega una franja en 768–1279 | Ninguna técnica (orden v2: post-C26, salvo decisión de adelantar) | `AdminReportsCard.tsx:697`, `AdminParticularTokensCard.tsx:1380`, `FilterBar.tsx` | Recuento en el disparador (< 768) y recuento compacto en 768–1279; `aria-live` del cambio | E2E con filtro aplicado en 360, 390, 768, 1024, 1279, 1280, 1920; A02/A03/A08; G11 | Estado identificable en 7/7 viewports; anunciado una vez por cambio; A03 sin drift | Revert | §17.6 DRV-03 |
| RM-08 | PR-DRV-07: tabla piloto por contenedor | DRV-01 | Pendiente y reproducible | P2 | Visual / legibilidad | Media | R1; A02/A03 posible | RM-06 (orden v2) | `AdminReportsCard.tsx` (piloto), luego Auditoría y Usuarios | `container-type: inline-size` en el canvas; reglas de columna por ancho de contenedor con histéresis | Sonda de truncado 1024–1440; A02/A03/A08 | Truncados(1280 × 800) ≤ truncados(1279 × 800) en las 5 tablas; columnas monótonas con el ancho | Revert | §17.6 DRV-01 |
| RM-09 | PR-DRV-08: cuadrícula por contenedor | DRV-02 | Pendiente + D-CARD | P2 | Legibilidad | Media | R1; A03 | D-CARD; RM-06 | `ContentGrid.tsx`, `collection-view.ts`, 3 consumidores | Columnas = `floor((w + gap) / pista mínima)`; filas = f(`limit`) | Spec C24 ampliado (ancho mínimo, truncado) | 0 tarjetas bajo la pista mínima; truncado de Clínicas a 1024 < 100 %; Informes clínica ≤ 30 % en 1024–1440 | Revert | §17.6 DRV-02 |
| RM-10 | P2-05: anuncio de conteo en S2/S3/S4 | DRV-05 | Parcial | P2 | Accesibilidad | Baja | R1 | Ninguna | Owners S2/S3/S4 | `rangeLabel` + live region existente | Unit + E2E de live region | Cambio de página anunciado en 3/3; `limit`/`offset` sin cambio | Revert | §17.6 DRV-05 |
| RM-11 | B3: header 56 también con alto ≤ 760 | DRV-12 | Pendiente y reproducible | P2 | Visual / capacidad | Baja | R13 (A02/A03 rebaseline) | D-05 | `responsive.css:107-108` (`--dash-header-h`) | Retirar el override de 4 rem del tramo denso | A02/A03/A05/A08; visual Linux | Topbar 56 ± 2 a 1280 × 720 en 21/21; chrome `admin-tokens` < 31.7 % | Revert | §17.5 A |
| RM-12 | D7: táctiles ≥ 44 px en < 768 | DRV-13 / C25 | Pendiente | P1 (cierre C25 literal) / P2 con D-11 (a) | Accesibilidad | Alta | R13 por familia | D-07 | `navigation.css`, pagers móviles, chips, botones icono | Hit area ≥ 44 (padding o pseudo-elemento) sin crecer la caja visual donde A03 lo prohíba | Sonda táctil 21 × 5 teléfonos; A02/A03/A08 | Controles < 44 = 0 en teléfono (excepciones de texto en línea documentadas) | Revert por familia | §17.4 |
| RM-13 | D8: cabecera de colección 36 px | DRV-13 / C25 | Pendiente | P3 | Visual | Media | R13 (A03) | D-11 o RM-12 | Tokens de cabecera (`tokens.css`), tablas admin y clínica | Cabecera 36 ± 1 en admin y clínica | A02/A03 | `thead` 36 ± 1 en 6 tablas admin y 3 de clínica | Revert | §17.5 C |
| RM-14 | D6 restante (V1, V2, F1, T1, M1, Q1, X3) | C25 | Parcial | P3 | Visual | Media | R1 / R13 (V1, V2) | Autorización por clase | Ver acta C25 §12.1 | Una PR por clase | Sonda de gaps 21 × 13; A02/A03 | Gaps efectivos de 6 px = 0 salvo excepciones decididas | Revert | Acta C25 §12 |
| RM-15 | Diagnóstico de controles fuera del viewport y de la fila de Visitas | DRV-N3, §17.5 E | Requiere medición / reproducible | P2 | Visual / legibilidad | Baja (diagnóstico) | R0 | Ninguna | `logistica/visitas/page.tsx`, `AdminClinicsManagementCard.tsx` | Sonda que identifique el nodo (selector) y la celda que envuelve a 101 px | Sonda; después A02/A03 | Causa nombrada; si es defecto, fila ≤ 52 sin truncado nuevo | — | §17.6 DRV-N3 |
| RM-16 | Cobertura axe de estados y overlays | G11 / §56.6 | NOT_RUN | P2 | Accesibilidad | Media | R1 test-only | RM-04 (catálogo en serie) | Spec G11 o spec nuevo | Axe con menús, diálogos, panel de filtros abiertos y estados error/empty | Spec nuevo | 0 `critical`/`serious` en los estados del subconjunto D-§57 | Revert | §17.7 |
| RM-17 | Tipografía de celda unificada | DRV-11 | Bloqueado (D-08) | P3 | Visual | Media | R1; R2 si toca tokens globales | D-08 | `AdminReportsCard.tsx`, `AdminParticularTokensCard.tsx`, Logística | 12/16 → 13/20 o enmienda §45.2 | A02/A03; visual Linux | Un solo estilo de celda por rol | Revert | §17.5 B |
| RM-18 | DRV-04 / DRV-06 / DRV-10 | Varios | Bloqueado | P3 | Funcional / visual | Variable | R1 | D-03, D-04, RM-08 | Ver §6 | Según decisión | Según PR | Según decisión | Revert | §17.6 |

Esfuerzo estimado (horas): RM-01 1–2 · RM-02 0.5–1 (más CI) · RM-03 2–4 · RM-04 12–24 (alta incertidumbre: no existe instrumento) · RM-05 8–16 más revisión manual · RM-06 3–6 · RM-07 6–10 · RM-08 8–16 · RM-09 6–12 · RM-10 3–5 · RM-11 3–6 más rebaseline · RM-12 16–32 (alta incertidumbre: depende de las familias autorizadas) · RM-13 6–10 · RM-14 8–16 · RM-15 2–4 · RM-16 8–12 · RM-17 4–8.

### 17.12 Dependencias y camino crítico

```text
Camino crítico a C26 cerrado (con D-11 = a):
RM-02 ─► RM-01 ─► RM-04 ─► RM-05 ─► RM-06 ─► [G12: R3, delegación propia]
                    ▲
                    └─ catálogo y censos compartidos: RM-04, RM-05 y RM-16 en serie

Si D-11 = b (C25 completo antes de C26):
RM-01 ─► RM-12 ─► RM-13 ─► RM-14(V1,V2) ─► RM-04 ─► RM-05 ─► RM-06
```

- **Adelantables sin romper dependencias:** RM-03, RM-10, RM-15 (independientes del catálogo y de R13). RM-07 si Nico decide adelantarlo por ser funcional/accesibilidad.
- **Condicionado por R13:** RM-11, RM-12, RM-13, RM-14 (V1/V2), RM-05 (baselines).
- **Mejoras independientes post-C26:** RM-08, RM-09, RM-17, RM-18.
- **Requieren decisión:** RM-01 (y todo C26), RM-09 (D-CARD), RM-11 (D-05), RM-12 (D-07), RM-17 (D-08), RM-18 (D-03, D-04).
- Sin ciclos: ninguna tarea depende de una posterior en su cadena; RM-08 → DRV-10 es unidireccional.

### 17.13 Criterios de aceptación y cierre

| Nivel | Criterio objetivo |
| --- | --- |
| C25 completo | D6 sin gaps efectivos de 6 px fuera de excepciones decididas; D7 = 0 controles < 44 px en teléfono (salvo excepciones escritas); D8 cabecera 36 ± 1; A02/A03/A05/A08 PASSED; o bien D-11 (a) registrada |
| C26 completo | RM-04 con registro por superficie; RM-05 con capturas aprobadas; G11 42/42 sobre el head de C26; los cuatro required checks en SUCCESS sobre ese head; E2E Completeness sin flaky sobre ese head; acta con cada gate de §58 en estado canónico; G12 según la lectura decidida (nunca PASSED sin ejecución R3) |
| Programa DRV | DRV-01, 02, 03, 12, N3 sin reproducción con la sonda de §17.14 (mismas superficies, viewports y temas); DRV-04/06/10/11 resueltos por decisión; ninguna regresión de A02 (273/273) ni de scroll (0/672) |

### 17.14 Validaciones ejecutadas y pendientes

**Sonda de esta auditoría.** Archivos temporales en el scratchpad de la sesión, fuera del repositorio. Reutiliza sin modificarlos `frontend/playwright.config.ts`, `frontend/e2e/helpers/dashboard-geometry-matrix.ts` (superficies, 13 viewports, `installSurfaceMocks`, `resizeSurfaceViewport`, `measureSurfaceGeometry`, `compareGeometryRecords`), `frontend/e2e/helpers/session.ts` y el teardown del repositorio; tema aplicado igual que la spec G11 (`vetneb-theme-mode` + `emulateMedia`). Sólo registra cajas, estilos computados y recuentos; ningún texto del fixture.

| Ejecución | Resultado |
| --- | --- |
| Sonda 21 superficies × 2 temas (16 viewports cada una; cuadrícula y filtro aplicado en tema normal) | `42 passed (6.9m)`, exit 0 |
| Registros | 672 (546 canónicos + 126 de frontera); tema efectivo correcto 672/672 |
| Calibración contra el baseline A02 Win32 (`compareGeometryRecords`, tema normal, 13 viewports canónicos) | **273/273** con 0 diferencias |
| Scroll de documento y `body` | 0/0 en 672/672 |
| Higiene | `frontend/next-env.d.ts` = blob `ce4e94a6` antes y después; `outputDir` y reporter en el scratchpad; `git status` sólo con los dos untracked previos |

**Gates de esta entrega (AGENTS §6, docs).**

| Gate | Estado |
| --- | --- |
| `git diff --check` | PASSED (exit 0) |
| Conservación de §1–§16 (`cmp` de las 724 primeras líneas contra la copia previa) | PASSED (idénticas; el diff es sólo +342 líneas de §17) |
| Espacios finales, tabuladores, marcadores de conflicto, columnas por tabla y bloques de código | PASSED (`grep`/`awk`, 0 hallazgos) |
| Paths citados existen en HEAD | PASSED |
| Contenido sensible (credenciales, cookies, tokens, URLs firmadas, emails, connection strings) | PASSED (`grep` sin coincidencias; los SHA son commits públicos) |
| Lint, typecheck, build, `security:public-surface`, `pnpm test`, cohortes E2E | NOT_RUN: docs-only, sin código |
| A02/A03/A05/A08 como specs | NOT_RUN localmente; A02 calibrado por la sonda (273/273), que **no** es el gate |
| G11 local | NOT_RUN; evidencia de CI sobre el árbol de `main` (§17.7) |
| Hover, focus, menús, diálogos, loading/error/empty, forced-colors | NOT_RUN |
| Linux / `next start` | NOT_RUN (sólo CI) |
| G12 staging | BLOCKED (sin entorno, tenants ni delegación R3) |

**Cobertura auditada** (no equivale a avance de implementación):

| Dimensión | Cubierto / denominador | % |
| --- | --- | ---: |
| Geometría, zero-scroll, truncado, tipografía, táctiles (estado inicial) | 546 / 546 (21 × 13 × 2) | 100 |
| Regresión visual nominal de §57 (21 × 13 × 2 × 9) | 546 / 4 914 (sólo estado inicial, sin captura) | 11.1 |
| Axe (CI) | 84 / 546 combinaciones superficie × viewport × tema | 15.4 |
| Hallazgos DRV con estado vigente y evidencia | 16 / 16 | 100 |

### 17.15 Riesgos residuales y limitaciones

- La sonda mide estado inicial cargado con datos sintéticos; datos más largos pueden truncar antes. Los recuentos absolutos dependen del fixture.
- Win32 + `next dev`; la equivalencia con Linux se apoya en la calibración A02, no en medición Linux.
- El runtime medido es `a2c87912`; #1934 sólo retira sombras (verificado por diff), sin efecto en cajas.
- DRV-03: no se midió si el valor del filtro sigue visible dentro del campo de búsqueda entre 768 y 1279 px; por eso RM-07 queda en P2 condicional.
- El control fuera del viewport de `admin-clinicas` a 768 no se identificó (RM-15).
- Clasificación de la operación local: `git switch` a la rama existente de #1933 se trató como R1 local (§5.2 lista `git switch main` y `git switch -c`; no figura en §5.5 y no escribe historial ni remoto) y se ejecutó con el árbol limpio y el trabajo previo publicado. Se reporta para que Nico confirme o ajuste esa lectura.

**Estado del documento (§17, 2026-10-28):** READY como auditoría integral y roadmap. Sin stage, commit, push, `gh pr edit` ni merge.
