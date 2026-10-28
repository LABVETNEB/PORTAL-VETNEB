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
