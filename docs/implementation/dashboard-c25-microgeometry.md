# C25 · Microgeometría del dashboard

## Estado base, dependencias y alcance

- Rama `feat/dashboard-c25-microgeometry-post-c16`, base `3f760f49602639e6ceb398fc5043c88da7e8924b` (C16, #1890; `git merge-base --is-ancestor` verdadero). Árbol tracked limpio al inicio; se preservaron los dos untracked previos (`frontend/AGENTS.md`, `frontend/CLAUDE.md`, generados por `next dev`), los cinco stashes y el único worktree. Sin `AGENTS.md` anidados tracked. No se usó la rama C25 anterior ni se ejecutaron escrituras Git o GitHub.
- Objetivo contractual (roadmap §50 nivel 12, §54 fila C25): padding, gap, baseline, offsets de icono, truncamiento, tooltips y foco dentro de ±1–2 px; criterio de cierre «A02 ±1 px · dentro de tolerancia».
- Owners tocados: `styles/dashboard/interactions.css` (PR-4), `styles/dashboard/navigation.css` (B07/B09, foco de la barra móvil) y `AdminUsersRolesReadOnlyCard.tsx` (C19). Auditados sin cambio: `CanonicalOperationalRow` (C21/C22), `ModuleMetricRun` (B14), `ModuleCard`, Auditoría (C06/C07), Sesiones, Informes admin (C24), Informes clínica (C21/C24) y Logística (C22). No se tocaron colecciones (C01), orden (C04), pitch de fila (C05), buscadores y filtros (C10–C12), paneles y visor (C13–C16, incluida la cancelación de miniaturas de C16), overlays (C23a) ni alternancia lista/cuadrícula (C24).
- Alcance: frontend-only, CSS de foco y una clase de interlineado. Sin backend, DB, endpoints, dependencias, CI, workflows, tokens de geometría, baselines A02/A03/A08, C23b ni C26.

### Dependencia C23 → C25

C23a está fusionado (#1888); C23b (chrome ≤ 32 % entre 768 y 1366 px) sigue **abierto**: su ledger de 17 + 4 celdas en `test/architecture/dashboard-c23-responsive-integral.test.ts` no se modificó y C23 **no** está completo. Lo que C25 implementa no depende de C23b porque no mueve ninguna caja:

| Familia | ¿Mueve chrome, alturas o canvas? | Depende de C23b |
| --- | --- | --- |
| Outline de foco | No: `outline` no ocupa layout | No |
| `line-height` de los buscadores de Usuarios y roles | No: la altura la fijan `h-7`/`h-8`/`h-9` | No |
| Gap 6 → 8 px, táctil ≥ 44, etiqueta 9.6/9.6 de la barra móvil, tira de métricas truncada | Sí | Sí, o R13 (§2) |
| Fila 40, cabecera 36, pager 40 | Sí | C05 BLOCKED / R13 |

No se redujeron cabeceras, no se tocó el app bar ni se alteró ningún componente compartido para cerrar C23b de forma indirecta.

## 1. Método de auditoría

Sonda Playwright temporal (`frontend/e2e/c25-probe/`, fuera del catálogo, borrada al terminar) que reutiliza los helpers de A02: las 21 superficies, sus sesiones de fixture, stubs y espera de layout estable. Por superficie y viewport mide, dentro de `[data-vetneb-app-shell="true"]`:

- **Foco**: cada control enfocable recibe `focus({ focusVisible: true })`; se registra `outline-style`/`outline-width` computados. Se repite con `forcedColors: "active"`, donde Chromium descarta el `box-shadow` del anillo.
- **Line-height**: controles con `line-height < 1.2 × font-size`.
- **Iconos**: en controles `flex` en fila con `align-items: center`, desvío del centro del `svg` respecto del centro de la caja de contenido; se reporta |Δ| > 1 px.
- **Truncamiento**: `text-overflow: ellipsis` (o `nowrap` + `overflow: hidden`) con `scrollWidth > clientWidth`.
- **Gaps**: histograma de `column-gap`/`row-gap` en flex/grid de `main`.
- **Táctil** (< 768 px): controles con algún lado < 44 px.

Base en `HEAD`: 4 viewports canónicos (1920×1080, 1366×768, 1024×768, 390×844) = 84 registros. Resultado: los **13** viewports canónicos = 273 registros, en modo normal y forzado.

Entorno de la evidencia (2026-10-18): Windows 11 (`win32`), Chromium de Playwright, `next dev` con la API de fixture en 3107, DPR 1, tema claro, `reducedMotion: reduce`. Cobertura: controles enfocables visibles dentro del shell en el estado cargado de cada superficie (sin abrir diálogos, menús ni sheets). Los portales montados en `document.body` quedan fuera de la medición y de la regla (§8).

## 2. Inventario y desviaciones medidas

| # | Desviación | Medida en `HEAD` | Contrato | Diferencia | Owner | Resolución |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | Foco sin outline (P3-06) | 1 315 / 1 912 controles con `outline-style: none`; en forced-colors no queda indicador | §45: `outline: 2px solid` primario + `outline-offset: 2px` real + anillo | 0 px vs 2 px | utilidades `focus-visible:outline-none` (~45 componentes); `outline: none` explícito en la barra móvil | **Corregida** (G1) |
| D2 | Line-height degenerado (PR-BUG-02 / P2-03 «12/12») | buscador de Usuarios y roles 12/12 px (h 28 escritorio, h 36 móvil) | ≥ 1.25 × 12 = 15 px | −4 px de interlineado | `AdminUsersRolesReadOnlyCard.tsx` | **Corregida** (G2), sólo en los dos `<Input>` de búsqueda |
| D3 | Offset de icono > 1 px | **0** (4 y 13 viewports) | ±1 px | 0 | — | Sin desviación |
| D4 | Texto truncado | 91 elementos en 4 vp; 452 en 13 vp | PR-TRUNC (`dashboard-truncation-integrity.test.ts`): una fila puede truncar si su detalle lleva el valor completo; `title` está **rechazado** como mecanismo | — | ver §2.1 | Seguro en la mayoría; 7 hallazgos sin mecanismo, **no corregidos** |
| D5 | Etiqueta de la barra móvil 9.6/9.6 px | 94 (4 vp), 470 (13 vp) | label-sm 11/16 | −6.4 px | `DashboardMobileNav` / `navigation.css` | **No implementada**: alarga el ítem (50.19 px) → `bottomNav` A02 y canvas móvil A03 (R13) |
| D6 | Gap 6 px vs 8 px (P3-04) | 2 740 contenedores con 6 px y escalas no canónicas (2.88, 4.8, 6.4, 9.6, 11.23…) | 4/8/12/16/24 | 2 px | ~45 componentes | **No implementada**: barrido global; los gaps verticales mueven el canvas (A03) y los horizontales cambian ajustes de línea (precedente C24: +20 px de chrome, `limit` 5 → 4) |
| D7 | Objetivos táctiles < 44 px | 1 151 controles en los 5 viewports de teléfono | ≥ 44 × 44 (§46) | hasta −16 px | módulos móviles | **No implementada**: cambia alturas móviles (A02/A03, R13) |
| D8 | Fila 36 → 40, cabecera 36, pager 40 | ya documentado | §46 | +4 px | C05 / C01 / C02 | **BLOCKED** por C05/R13 |

### 2.1 Truncamiento: clasificación contra PR-TRUNC

Un primer intento añadió `title` a los 21 sitios medidos. Se **retiró completo**: PR-TRUNC rechaza `title` como mecanismo de valor completo («hover-only», poco fiable para tecnología asistiva, invisible al tacto) y el auditor de superficie pública (`sensitive-a11y-attribute-value`) marcó el `title` con id de sesión. Los dos fallaron en la suite Node y quedaron en verde al retirarlo.

| Superficie | Elementos truncados | Mecanismo de valor completo | Clase |
| --- | --- | --- | --- |
| Auditoría (tabla densa y móvil) | entidad, detalle | `AdminAuditDetailDialog` | Segura (PR-TRUNC) |
| Usuarios y roles | usuario, clínica, metadatos, insignia de rol | `AdminUserRoleDetailDialog` en ambas presentaciones | Segura (PR-TRUNC) |
| Informes admin | estudio, archivo, clínica · estudio | diálogo de detalle del informe | Segura |
| Informes clínica (hub y ruta completa) | paciente, estudio, archivo | diálogo de detalle / master-detail | Segura |
| Logística (ruta completa, Rutas, Métricas, Visitas móvil) | clínica, dirección, paradas | `FieldVisitDetailDialog`, `RoutePlanDetailDialog`, `RoutePlanMetricDetailDialog` | Segura |
| F-T1 · Visitas, tabla de escritorio | dirección (`max-w-[180px]`), notas (`max-w-[150px]`) | ninguno: la fila de escritorio no abre detalle | **Hallazgo** |
| F-T2 · Sesiones (834/768/360) | `#sesión`, tipo de actor, línea móvil | ninguno | **Hallazgo** |
| F-T3 · Estado del sistema móvil | detalle del servicio («Gmail API: … · SMTP: …») | ninguno | **Hallazgo** |
| F-T4 · Tira de métricas B14 (Rutas, Visitas, Métricas) | métricas finales recortadas | ninguno | **Hallazgo** (chrome; cruza C23b) |
| F-T5 · `StatsCards` (Operaciones) | etiqueta «Informes pendientes» | ninguno | **Hallazgo** |
| F-T6 · Chips de `ModuleCard` (Perfil, 360–430) | «Cambiar contraseña» | el panel de la pestaña | Hallazgo menor |
| F-T7 · Descripción móvil de `ClinicCommandCenter` | descripción de sección | ninguno | Hallazgo menor |

F-T1..F-T7 exigen un mecanismo de detalle (cambio funcional) o permitir el ajuste de línea (cambio de geometría con riesgo A02/A03): ambos fuera de una corrección microgeométrica neutra. Quedan reportados para autorización. Opciones a estudiar por superficie, en este orden de preferencia:

1. **Revelado mediante un detalle existente**: llevar la fila al diálogo o panel que ya tiene la superficie (Visitas en escritorio puede montar el `FieldVisitDetailDialog` que ya usa su lista móvil).
2. **Diálogo accesible nuevo** con el patrón C13 (`DetailsPane`), donde no hay detalle (Sesiones, Estado del sistema).
3. **Wrapping controlado** sólo donde la altura no es contractual (descripción móvil, etiqueta de `StatsCards`), con A02/A03 re-medidos y, si se mueven, R13.

Queda descartado `title` para mostrar valores, y en ningún caso un identificador de sesión ni un dato privado en un atributo.

## 3. Correcciones aplicadas

### G1 · Foco real (D1)

- `interactions.css`, bloque `dashboard-c25-focus-outline`: `.dashboard-app-shell :where(a[href], button, input, select, textarea, summary, [role="button"], [role="tab"], [role="checkbox"], [tabindex]:not([tabindex="-1"])):focus-visible { outline: 2px solid var(--dash-color-focus-ring); outline-offset: 2px; }`.
  - **Sin capa** a propósito: dentro de `@layer components` perdería contra `@layer utilities` (`outline-none`), el mismo motivo documentado por B06/B07.
  - `:where` deja la especificidad en (0,2,0): las reglas de foco explícitas del shell (drawer/rail B07, kebab C23a, barra móvil) siguen mandando.
  - Excluye `tabindex="-1"` (contenedores con foco programático, que `responsive.css` mantiene sin outline) y no nombra roles de menú: los ítems C08 y las opciones son `<button>`, y el guard C08 prohíbe CSS de menús.
  - Con `ring-2 ring-offset-2` (por ejemplo `components/ui/input.tsx`) el outline pinta la misma franja que el anillo existente.
  - Cascada verificada: las reglas explícitas sin capa del shell tienen especificidad mayor y siguen ganando (kebab C23a en `mobile-chrome.css`, drawer/rail y overflow móvil en `navigation.css`, toggle del panel lateral en `surfaces.css`). Todo contenedor con foco programático `tabindex="-1"` (el patrón de `.dashboard-focus-trap-container` en `responsive.css`) queda excluido por el selector. Fuera del shell, la regla base de `globals.css` no cambia.
  - Claro/oscuro: `--dash-color-focus-ring` resuelve a `--clinical-focus-ring`, que `globals.css` redeclara en el tema oscuro; en forced-colors el navegador sustituye el color por el del sistema.
  - Cobertura de portales: `ActionMenu` (`[data-dashboard-portal-root]`), `ModuleTabs` (slot del shell) y los `ModuleDialog`/`AdvancedFilterSheet` con `dashboardScopedPortal` quedan dentro del shell y cubiertos.
- `navigation.css`, foco de `.dashboard-mobile-nav-item`: `outline: none` → `outline: 2px solid transparent; outline-offset: -2px`. Invisible en modo normal (el anillo doble B04 sigue intacto), visible en forced-colors e inset para no recortarse con el `overflow: hidden` de la banda.

### G2 · Line-height (D2, PR-BUG-02)

`AdminUsersRolesReadOnlyCard.tsx`: los dos buscadores pasan de `text-xs leading-none` a `text-xs leading-4` (12/16). Las cajas conservan `h-8 md:h-7` y `h-9`. Los `<select>` de Usuarios y roles y de Sesiones también declaran `leading-none`, pero su `line-height` computado ya es ≥ 1.2 (lo resuelve `.field-select`): inertes, sin tocar. PR-BUG-02 queda **absorbido** en C25 (§55) **sólo** para esos dos campos, los únicos medidos con 12/12 (4 → 0 registros); no se abrió correctivo independiente. Ninguna otra escala tipográfica cambió.

## 4. Comparación antes / después

| Métrica (sonda) | `HEAD`, 4 vp | C25, 4 vp | C25, 13 vp |
| --- | ---: | ---: | ---: |
| Controles enfocables medidos | 1 912 | 1 912 | 5 872 |
| Sin outline de foco (normal) | 1 315 | **0** | **0** |
| Sin outline de foco (forced-colors) | 1 315 | **0** | **0** |
| Controles de formulario con line-height < 1.2 | 4 | **0** | **0** |
| Etiquetas 9.6/9.6 de la barra móvil (D5) | 94 | 94 | 470 |
| Iconos con \|Δ\| > 1 px | 0 | 0 | 0 |
| Elementos truncados (D4, sin cambio) | 91 | 91 | 452 |

Geometría: ninguna corrección cambia una caja; A02, A03, A05 y A08 se ejecutaron sin tocar fixtures (§6).

## 5. Contratos preservados

- `limit`, `offset`, page size, paginación y capacidad sin cambios (A03, A05). Sin scroll de documento ni interno nuevo (A08).
- Pitch de fila (C05), cabeceras, app bar, rail/drawer y barra móvil sin cambios de tamaño. Ledger C23b intacto. Visor y miniaturas C16 sin tocar.
- PR-TRUNC y el auditor de superficie pública siguen en verde: C25 no introduce `title` como mecanismo de valor completo.
- Seguridad: sin cambios en sesiones, cookies, endpoints ni superficie pública; ningún `data-*` nuevo.

## 6. Pruebas, guards y validaciones

**Guard C25**, como sección de `test/architecture/dashboard-b11-workspace-header.test.ts` (el censo 01B está saturado con un archivo nuevo, como en C24): bloque de foco sin capa, con `:where`, exclusión de `tabindex="-1"`, controles cubiertos y sólo `outline`; seis mutaciones rechazadas (capa, `:is`, `outline: none`, `box-shadow`, `[tabindex]` sin exclusión, `select` quitado); ninguna regla `:focus-visible` del CSS del dashboard con `outline: none`, con su prueba negativa; outline inset de la barra móvil junto a su anillo; y PR-BUG-02. Sin `readFileSync` nuevo ni conteos `.length, n`.

RED → GREEN: la sonda midió D1 y D2 en `HEAD` (tabla §4) y su ausencia tras el cambio; el guard falla con cada mutante.

**Consolidación (2026-10-19).** Mismo árbol, sin cambios de runtime. Diff = 4 archivos tracked + esta acta, nada staged. Guards dirigidos re-ejecutados: B11 (incluida la sección C25), PR-TRUNC, B04, B07, B09, tokens de fundación, ledger C23b, focus-polish PR-4 y censo 01B, **PASSED 166/166**. No se repitieron suites completas: la tabla siguiente es la evidencia del 2026-10-18 sobre el mismo diff de runtime.

| Gate (ejecución 2026-10-18) | Estado |
| --- | --- |
| Guard C25 (sección de B11) + B11 completo | PASSED 51/51 |
| Suite Node completa (`pnpm test`) | FAILED 5401/5403 (1 skip): sólo `e2e-global-03b-authoritative-auth-boundary`, que exige `DATABASE_URL`/`SUPABASE_DB_URL` (ambiental y preexistente). PR-TRUNC y el auditor de superficie pública, rojos con el primer intento de `title`, quedaron en verde al retirarlo |
| `pnpm validate:local` como cadena | NOT_RUN: su suite Node falla por la precondición 03B; sus piezas se ejecutaron por separado |
| A02 geometría 21×13 (fixture Win32 sin cambios) | PASSED 21/21 |
| A03 `limit`/`offset` 15×13 (fixtures sin cambios) | PASSED 16/16 (195/195 registros, 234/234 hojas) |
| A05 invariancia 15×13 | PASSED 15/15 |
| A08 zero-scroll 21×13 | PASSED 21/21 |
| `e2e:visual-contract` | FAILED 1006/1007. Único fallo: C23a «Notificaciones del kebab» (`waitForRequest` agotado). Aislado ×3 con C25: 2/3 fallan; **A/B con el runtime de `HEAD`** (los tres archivos de C25 retirados temporalmente) ×3: 1/3 falla. Flake preexistente, no atribuible a C25 (ya registrado en C24) |
| `e2e:admin-mobile` | PASSED 159/159 |
| Frontera móvil zero-scroll (`extended`, spec único) | PASSED 8/8 |
| Frontend `lint`, `typecheck`, `build`; `security:public-surface`; raíz `typecheck`, `typecheck:test`, `build` | PASSED |
| `git diff --check` | PASSED |
| A02/A03 Linux, baselines visuales Linux | NOT_RUN localmente (sólo CI) |
| `e2e:full` | NOT_RUN (sin autorización) |

## 7. Matriz de viewports

| Viewport | Foco (normal / forced) | Line-height buscadores | Iconos | A02 / A03 / A08 |
| --- | --- | --- | --- | --- |
| 1920×1080, 1600×900, 1440×900, 1366×768, 1280×720 | outline 2 px en todos los enfocables | 12/16 (h 28) | 0 desvíos | PASSED |
| 1024×768, 834×1194, 768×1024 | idem | 12/16 (h 28) | 0 | PASSED |
| 430×932, 412×915, 390×844, 375×812, 360×800 | idem; barra móvil con outline inset transparente | 12/16 (h 36) | 0 | PASSED |

## 8. Limitaciones y riesgos

- Linux no se ejecutó localmente: A02/A03 Linux y los baselines visuales Linux quedan para CI. C25 no mueve cajas, pero el outline aparece en cualquier captura que enfoque un control.
- Portales a `document.body` fuera del shell no reciben la regla de foco y conservan el anillo sólo de `box-shadow`, que forced-colors descarta: el panel de `DashboardNotificationsBell`, el portal de `ModuleCard`, `UploadReportModal` y los `ModuleDialog` sin `dashboardScopedPortal` (por ejemplo los diálogos de detalle). No se midieron (la sonda no abre overlays) y el selector no se amplió a `body` a propósito: cubrirlos exige migrarlos al portal del shell o una regla propia, en una PR aparte.
- El outline puede quedar recortado por contenedores `overflow: hidden` en el borde, igual que el anillo actual.
- D5, D6, D7 y F-T1..F-T7 quedan abiertos y requieren autorización explícita (cambio funcional, R13 o rebaseline A02/A03); D8 sigue BLOCKED por C05.

## 9. Registro de deuda

| ID | Estado |
| --- | --- |
| D1 | Corregido (foco real, también en forced-colors, dentro del shell) |
| D2 | Corregido (dos buscadores de Usuarios y roles) |
| D3 | Sin desviación medida |
| D4 | Pendiente: siete truncamientos sin acceso al valor completo (F-T1..F-T7, §2.1) |
| D5 | Pendiente: line-height de la navegación móvil; dependencia geométrica (`bottomNav` A02, canvas A03) |
| D6 | Pendiente: gaps de 6 px; riesgo de alterar la capacidad (A03) |
| D7 | Pendiente: objetivos táctiles inferiores a 44 px |
| D8 | BLOCKED por C05/R13 |
| C23b | Pendiente; sin intervención en esta PR |
| Portales a `body` | Pendiente: foco sin outline en forced-colors (§8) |

## 10. Estado de cierre

**C25 = PARTIAL**, consolidado localmente y preparado para una PR independiente (`feat(dashboard): C25 partial focus and typography hardening`, scope `frontend runtime`). Sin staging, commit, push ni PR ejecutados por el agente; los cuatro required checks no tienen todavía resultado sobre un HEAD publicado.

- Implementado y medido dentro de tolerancia: D1 (foco real, 1 315 → 0 controles sin outline, también en forced-colors) y D2 / PR-BUG-02 (12/12 → 12/16). Sin desviación: D3 (iconos).
- No cerrado: D4 (siete truncados sin mecanismo de valor completo, F-T1..F-T7), D5, D6 y D7 requieren cambio funcional o geométrico con autorización (R13 / rebaseline A02/A03); D8 sigue BLOCKED por C05; F-T4 cruza el chrome de C23b.
- C23b sigue abierto y C23 no está completo; C25 no lo cierra ni lo enmascara.
- No-alcance: C23b, C26, D5–D8, F-T1..F-T7, backend, DB, dependencias, CI y baselines.
