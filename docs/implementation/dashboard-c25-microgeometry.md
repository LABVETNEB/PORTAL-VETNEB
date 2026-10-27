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
| D5 | Etiqueta de la barra móvil 9.6/9.6 px | 94 (4 vp), 470 (13 vp) | label-sm 11/16 | −6.4 px | `DashboardMobileNav` / `navigation.css` | **No implementada**: alarga el ítem (50.19 px) → `bottomNav` A02 y canvas móvil A03 (R13) · *Estado vigente (2026-10-26): implementada sin cambio geométrico; los 50.19 px ya eran la altura del ítem en `HEAD` (§11)* |
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
- D5, D6, D7 y F-T1..F-T7 quedan abiertos y requieren autorización explícita (cambio funcional, R13 o rebaseline A02/A03); D8 sigue BLOCKED por C05. *(Registro del 2026-10-19. Estado vigente de D5: §11.)*

## 9. Registro de deuda

| ID | Estado |
| --- | --- |
| D1 | Corregido (foco real, también en forced-colors, dentro del shell) |
| D2 | Corregido (dos buscadores de Usuarios y roles) |
| D3 | Sin desviación medida |
| D4 | Pendiente: siete truncamientos sin acceso al valor completo (F-T1..F-T7, §2.1) |
| D5 | Implementado en rama (§11): 11/16 sin cambio geométrico; seis baselines visuales Linux a 320 promovidas con R13 (`96b14809`); PR, CI y merge pendientes |
| D6 | Parcial (§12): 12 gaps horizontales intra-fila y de paginador 6 → 8 px sin cambio geométrico; los verticales, de capacidad, de chrome y de tira de métricas siguen abiertos |
| D7 | Pendiente: objetivos táctiles inferiores a 44 px |
| D8 | BLOCKED por C05/R13 |
| C23b | Pendiente; sin intervención en esta PR |
| Portales a `body` | Pendiente: foco sin outline en forced-colors (§8) |

## 10. Estado de cierre

**C25 = PARTIAL**, consolidado localmente y preparado para una PR independiente (`feat(dashboard): C25 partial focus and typography hardening`, scope `frontend runtime`). Sin staging, commit, push ni PR ejecutados por el agente; los cuatro required checks no tienen todavía resultado sobre un HEAD publicado.

- Implementado y medido dentro de tolerancia: D1 (foco real, 1 315 → 0 controles sin outline, también en forced-colors) y D2 / PR-BUG-02 (12/12 → 12/16). Sin desviación: D3 (iconos).
- No cerrado: D4 (siete truncados sin mecanismo de valor completo, F-T1..F-T7), D5, D6 y D7 requieren cambio funcional o geométrico con autorización (R13 / rebaseline A02/A03); D8 sigue BLOCKED por C05; F-T4 cruza el chrome de C23b. *(Registro del 2026-10-19. Vigente: D4 fusionado en #1922/#1924/#1925; D5 implementado en rama, sin fusionar, §11.)*
- C23b sigue abierto y C23 no está completo; C25 no lo cierra ni lo enmascara.
- No-alcance: C23b, C26, D5–D8, F-T1..F-T7, backend, DB, dependencias, CI y baselines.

## 11. D5 · Tipografía de la navegación móvil (2026-10-26)

Base `7c9b1fa9` (C05 #1923 y D4 #1922/#1924/#1925 incorporados). Scope: sólo D5.

**Causa raíz.** `--dash-mobile-nav-label-size` apuntaba a `--admin-mobile-type-2xs` = `clamp(0.6rem, 0.5rem + 0.3svw, 0.68rem)`, que en todo teléfono queda en su piso de 9.6 px (el techo exige ~960 px de ancho), y `.dashboard-mobile-nav-item` declaraba `line-height: 1`, lo que colapsaba la línea a 9.6 px. Owner único: el bloque B09/CMP-02 de `navigation.css`, compartido por Administración y Clínica.

**Medición previa.** Los 50.19 px que la auditoría atribuyó a 11/16 son la altura que el ítem YA tiene en `HEAD`: se estira a la banda de 51.19 px (50.19 + 1 px de borde). Su contenido ocupa 36.79 px (padding 3.84 × 2 + glifo 17.6 + gap 1.91 + etiqueta 9.6).

**Alternativas.** A (geometría conservada): medida con la regla inyectada en Chromium, 11/16 computados, ítem 50.19, banda 51.19, `main` idéntico, holgura de 7.34 px por lado, sin recorte (la etiqueta más ancha a 320, «Auditoría», ocupa 49.63 de 80 px). B (ajuste geométrico local) y C (cambio de capacidad, R13) son innecesarias: no hay desborde que absorber. Elegida: A.

**Cambio.** `[data-vetneb-app-shell-surface]` declara `--dash-mobile-nav-label-size: 0.6875rem` y `--dash-mobile-nav-label-leading: 1rem` una sola vez; el ítem consume el segundo token en lugar de `line-height: 1`. Sin cambios en `tokens.css` ni en `DashboardMobileNav.tsx`. El peso (650 frente a label-sm w500) no forma parte de D5 y no se tocó.

| Viewport | Rol | Fuente antes → después | Banda | Δ `main` | A08 |
| --- | --- | --- | --- | ---: | --- |
| 320×720, 360×800, 375×812, 390×844, 412×915, 430×932 | Admin (4 ranuras) y Clínica (5 ranuras, shell y ruta completa) | 9.6/9.6 → 11/16 | 51.19 → 51.19 | 0 | scroll 0/0 |
| 375×812 tema oscuro | ambos | 9.6/9.6 → 11/16 | 51.19 → 51.19 | 0 | scroll 0/0 |
| 768×1024 | ambos | sin barra (régimen lateral) | — | 0 | scroll 0/0 |

**Pruebas.** Guard B09: tokens 11/16 ligados una vez y consumidos por la regla del ítem, sin `scale()`/`zoom`; tres mutantes rechazados. Spec E2E B09: `font-size`/`line-height` computados (±0.05 px) y etiqueta dentro de su ranura en cada superficie; con el CSS de `HEAD` falla (9.6 px).

| Gate | Estado |
| --- | --- |
| Guards B04, B07, B09, B11, C23, tokens de fundación, truncation, paridad móvil, catálogo E2E, censo 01B | PASSED 190/190 |
| E2E B09 (cohorte `visual-contract`) | PASSED 31/31 |
| A02 geometría 21×13 (fixture Win32 sin cambios) | PASSED 21/21 |
| A03 límite adaptativo 15×13 | PASSED 16/16 |
| A05 invariancia de límite 15×13 | PASSED 15/15 |
| A08 zero-scroll 21×13 | PASSED 21/21 |
| Frontera zero-scroll móvil | PASSED 8/8 |
| Barra inferior admin-mobile | PASSED 4/4 |
| `lint`, `typecheck`, `build`, `security:public-surface` | PASSED |
| G11 axe | NOT_RUN: color y contraste sin cambios; sólo crece el tamaño |
| Baselines visuales Linux (`visual-linux`) | NOT_RUN localmente (sólo Linux) |

**Autorización pendiente.** Seis capturas Linux a 320 px incluyen la barra y se comparan con `maxDiffPixelRatio: 0.001` (≈230 px): `admin-dashboard-320`, `admin-dashboard-dark-gray-320`, `dashboard-320`, `dashboard-dark-gray-320` (autenticado) y `stress-admin-dashboard-320`, `stress-dashboard-320` (stress). El cambio de las etiquetas las hará diferir en `visual-linux`/`e2e:full` (E2E Completeness, no requerido). No se regeneraron: hace falta autorización explícita para el dispatch Linux de `visual-regression-manual.yml`. *(Resuelto el 2026-10-26: §11.1.)*

**Riesgos residuales.** Linux no medido localmente; el overflow «Más» abierto no se modificó (usa `--admin-mobile-type-xs`).

### 11.1 Promoción R13 de baselines visuales Linux (2026-10-26)

**Alcance de la autorización R13.** Nico autorizó regenerar exactamente las seis baselines visuales Linux a 320 px afectadas por D5, a partir de evidencia `production-candidate`. La autorización no cubre A02, A03, A05, A08, `limit`/`offset`, la altura de la barra, el canvas ni ninguna otra captura; no reutiliza las autorizaciones R13 de C05 ni de F-T5/F-T7.

**Procedencia.**

| Dato | Valor |
| --- | --- |
| Commit productivo D5 | `64ad2e68d4ae8acc8df82aba984e255ea03d2250` |
| Workflow | `visual-regression-manual.yml`, run `40298466674`, suite `all`, runner `production-candidate`, `update_snapshots=false`, evento `workflow_dispatch`, head `64ad2e68` |
| Artefacto | `12638674702` `visual-regression-all-production-candidate-1`, 36 841 951 B, `sha256:5010f9aeaa3ac211703dd1f947470b948885629760f5426811315ef20568c900` |
| Conclusión del run | `failure` por diseño: el comparador del candidato sale con código 1 ante cualquier diferencia no aprobada; la evidencia se publica igual |
| Comparación | 40 PNG emparejados, dimensiones idénticas, 22 idénticos en píxeles, 18 distintos |

**Clasificación de los 18 PNG distintos.**

| Grupo | PNG | Diferencia | Origen | Decisión |
| --- | ---: | --- | --- | --- |
| Clínica 320 (`dashboard`, `dashboard-dark-gray`, `stress-dashboard`) | 3 | 1 967–1 971 px, bbox `[20,677]-[302,710]`, sólo la banda de la barra (y ≥ 669) | D5: etiquetas 11/16 | Promover |
| Admin 320 (`admin-dashboard`, `admin-dashboard-dark-gray`, `stress-admin-dashboard`) | 3 | 1 953–1 957 px en la barra + 5 505–5 564 px en y 0–21; 0 px entre ambas franjas | D5 + sombra preexistente | Promover |
| Admin 768–1920, claro/oscuro, normal y stress | 12 | 5 496–5 564 px, bbox `[0,0]-[267,21]` | Sólo sombra preexistente | No promover (fuera de D5) |

**Sombra preexistente de Admin.** La franja `[0,0]-[267,21]` es la estela del `box-shadow: 0 8px 24px` de `.skip-to-content-link` («Saltar al contenido principal», DRV02 #1900): el botón se oculta con `translateY(calc(-100% - 1.5rem))`, su borde inferior queda en y ≈ −12 y la sombra alcanza y ≈ 20. Es hasta 25 niveles más oscura en y = 0 y desaparece en y = 22. Ya figuraba con los mismos conteos en el run D4 `40262289895`, anterior a D5. Las baselines de Clínica la incluyen desde D4; las de Admin a 768–1920 px son anteriores a #1900. Playwright no la cuenta (`threshold` 0.2 por píxel frente a un Δ máximo de 25/255 por canal), por eso `e2e:full` pasa con esas baselines.

**Diferencias perceptuales.** Bajo la métrica de Playwright (YIQ, `threshold` 0.2), los seis PNG a 320 px superan el máximo de 230 px sólo por la barra (1 035–1 201 px); fuera de la banda de la barra y de la franja de la sombra no hay ningún píxel distinto. La evidencia disponible no muestra otra diferencia perceptual.

**Geometría.** La promoción no cambia contratos geométricos: banda 51.19 px, ítem 50.19 px y `main` idénticos antes y después en los seis viewports de teléfono, claro y oscuro (§11); A02, A03, A05 y A08 en PASSED sin tocar fixtures.

**Inventario promovido** (copia byte-exacta desde `candidate-prod/`, SHA-256 verificado sobre el árbol versionado en `96b14809`):

| Archivo | SHA-256 anterior (`64ad2e68`) | SHA-256 promovido (`96b14809`) = candidato |
| --- | --- | --- |
| `visual-regression-authenticated.spec.ts-snapshots/admin-dashboard-320-chromium-linux.png` | `6ec27765a21f49a81d8c3cf73fa8214cd6e558993b1274ab2f8ed9a9a454fd43` | `b1df609ea5c2abc9da32e3340f99a3002ca5e077c761ab77f0925747b23436a7` |
| `visual-regression-authenticated.spec.ts-snapshots/admin-dashboard-dark-gray-320-chromium-linux.png` | `85555c8097586768b070c789cc4be93d7803214c07bb29cc707ce18df2962f33` | `ae57410e992a9e1460c4f035ee85402b55ff3a081745a6a419bbcfbb07be7d42` |
| `visual-regression-authenticated.spec.ts-snapshots/dashboard-320-chromium-linux.png` | `f0dd855b44a8d04d5c2d40664fb51b8b697dc8167bebf39d2cfc36d5651093c5` | `29490eb7f8894966a43bc29b14b8481e76504b767ca77af710d00c7c9b1a227e` |
| `visual-regression-authenticated.spec.ts-snapshots/dashboard-dark-gray-320-chromium-linux.png` | `ba648e21fdd2ee6facbd1f13dc4dd6832a5d48329f0ab3fdd321defe54a9546e` | `3d1f8162a2c3c4308a4b042d95b5d876b4394e4922879d896820466d2a0b7ba0` |
| `visual-regression-stress.spec.ts-snapshots/stress-admin-dashboard-320-chromium-linux.png` | `6ec27765a21f49a81d8c3cf73fa8214cd6e558993b1274ab2f8ed9a9a454fd43` | `b1df609ea5c2abc9da32e3340f99a3002ca5e077c761ab77f0925747b23436a7` |
| `visual-regression-stress.spec.ts-snapshots/stress-dashboard-320-chromium-linux.png` | `f0dd855b44a8d04d5c2d40664fb51b8b697dc8167bebf39d2cfc36d5651093c5` | `29490eb7f8894966a43bc29b14b8481e76504b767ca77af710d00c7c9b1a227e` |

Rutas bajo `frontend/e2e/regression/visual/`. Los pares normal/stress comparten hash porque son el mismo render. `git diff --name-only 64ad2e68 96b14809` lista exactamente estos seis archivos: ningún otro PNG de Admin cambió.

**Commit y estado remoto.** Promoción `96b14809849e8d2c01fc2e03aec70a509e6c9a28` (`test(dashboard): promote C25 D5 320px Linux visual baselines from production candidate run 40298466674`); `origin/fix/dashboard-c25-d5-mobile-nav-label-20261026` = `96b14809` verificado por `git ls-remote`.

### 11.2 Cierre cronológico D5

| Fecha (UTC) | Evento | Referencia |
| --- | --- | --- |
| 2026-10-26 | Medición en `HEAD`: 9.6/9.6 px; ítem ya a 50.19 px | `7c9b1fa9` |
| 2026-10-26 | Implementación 11/16 + guard B09 + aserción E2E B09; gates locales (§11) | `64ad2e68` |
| 2026-10-26 09:18 | Candidato productivo Linux: 6 PNG D5 + 12 sombras preexistentes de Admin | run `40298466674`, artefacto `12638674702` |
| 2026-10-26 | Diagnóstico de la franja de Admin: sombra de `.skip-to-content-link` (#1900) | §11.1 |
| 2026-10-26 | Promoción R13 de las seis baselines a 320 px | `96b14809` |

**Gates.** Los resultados locales son los de la tabla de §11 sobre el diff de `64ad2e68`; no se ejecutaron gates nuevos en esta actualización documental.

**Pendiente sobre la futura PR (sin resultado todavía):** los cuatro required checks (`validate-pr-governance`, `qga-workflow-security`, `validate-backend`, `validate-frontend`) sobre el head publicado; E2E Completeness (`e2e:full`, incluye `visual-linux`), no requerido, que confirma las seis baselines bajo el runner productivo de Linux; y el squash merge protegido. D5 no está fusionado.

**Deuda registrada.** Doce baselines de Admin a 768–1920 px no incluyen la sombra de `.skip-to-content-link`; Playwright las acepta, pero el comparador estricto del candidato las seguirá listando hasta que una PR propia las promueva.

## 12. D6 · Gaps no canónicos (2026-10-26)

Base `2c5c33b5` (D5 #1926 fusionado), rama `fix/dashboard-c25-d6-spacing-20261026`. Scope: sólo D6, frontend runtime. Sin tokens de geometría, capacidad, baselines A02/A03, fixtures ni capturas.

**Método.** Sonda Playwright temporal (fuera del catálogo, retirada) sobre las 21 superficies × 13 viewports de A02, con sus stubs y su asentamiento causal. Por contenedor flex/grid visible del shell con ≥ 2 hijos en flujo se registra el gap **efectivo**: el vertical sólo si dos hijos quedan apilados (`top ≥ bottom` de otro) y el horizontal sólo si quedan lado a lado; un gap declarado que no separa nada no cuenta. Además, por registro: elementos truncados (`scrollWidth > clientWidth` con elipsis), contenedores con recorte horizontal y scroll de documento. Root 16 px en todos los registros: 4.8 = `0.3rem`, 6.4 = `0.4rem`, 2.88 = `0.18rem`, 1.92 = `0.12rem`, 9.6 = `0.6rem`.

**Re-medición del baseline.** Las cifras históricas (2 740 contenedores, ~45 componentes) contaban gaps declarados. Con el criterio efectivo, en `HEAD`: 5 736 contenedores, **930** gaps efectivos de 6 px y **2 003** fuera de 4/8/12/16/24 (dos corridas idénticas).

### 12.1 Inventario y clasificación

| Clase | Medido en `HEAD` | Origen | Severidad | Decisión |
| --- | ---: | --- | --- | --- |
| H1 · Horizontal intra-fila (icono/insignia + texto) | 374 | `gap-1.5` en filas de Clínicas (celda de escritorio), Sesiones (escritorio), Auditoría y Usuarios móviles; mismo patrón, sin estado medido por la sonda, en la fila móvil de Clínicas, Intentos fallidos, Informes admin y la identidad con `badges` de `CanonicalOperationalRow` | Baja | **Corregida** (6 → 8) |
| H2 · Paginadores móviles admin | 35 | `gap-1.5` en `AdminMobileOpsPager` y en los paginadores de Clínicas, Informes y Tokens | Baja | **Corregida** (6 → 8) |
| H3 · Horizontal que aumenta el truncado | 265 | trailing de `CanonicalOperationalRow`, trailing de Informes clínica móvil, trigger móvil de Sesiones | Media | **Excepción decidida** (Nico, 2026-10-26): se conserva 6 px. Con 8 px aparecían +7 truncados (Sesiones 375, Informes clínica 360, Logística 412/1440); el texto visible y la accesibilidad prevalecen sobre la uniformidad del gap |
| V1 · Verticales en canvas móviles (Tokens, Estado, Mantenimiento, Precios, Perfil) | 51 | `gap-1.5` en columnas y rejillas con `flex-1`/`grid-rows-*` | Alta | Abierta: reparte la altura del canvas (A02/A03, R13) |
| V2 · Gap de capacidad `data-dashboard-row-gap="spaced"` | 26 | `--dash-row-gap: 6px` (`tokens.css`), Logística ruta completa | Alta | Abierta: entra en `computeCapacity` → `limit` (A03, R13) |
| F1 · Barras de filtros `md:gap-1.5` | 76 | `FilterBar`, formularios de filtros y `lg:[&_label]:gap-x-1.5` de Informes clínica | Media | Abierta: a 768–1023 el formulario ocupa dos filas (región `filters` de A02, chrome C23b) y B05 ancla la clase |
| T1 · Grupo `inline-flex` de la barra de Informes clínica (ruta completa) | 6 | `gap-1.5` | Baja | Abierta: barra de herramientas de C24, fuera de este lote |
| M1 · Tira de métricas B14 | 65 | `ModuleMetricRun` | Media | Abierta: agrava F-T4 (cruza C23b) y PR-TRUNC ancla la clase |
| Q1 · Atajos y panel de estado del hub | 32 | `AdminOverviewQuickLinks` (`flex-wrap`), panel «resumen» | Media | Abierta: el wrap puede cambiar la altura del hub |
| X1 · Densidad fluida (`--dash-gap`, `--dash-cockpit-gap`, tabs, `module-surface`) | 7.68–12.17 px | `clamp(…, … + vh, …)` de `responsive.css` | — | **Excepción justificada**: capa de adaptación al viewport/zoom; cuantizarla rompe la adaptabilidad |
| X2 · Sub-escala intra-control | 1.92 (470), 2 (232), 2.88 (35), 4.8 (46) | ítem de la barra móvil (glifo → etiqueta, B09), `gap-0.5` etiqueta → campo, chips, tablist | — | **Excepción justificada** por ahora: separaciones internas de un control, no ritmo entre bloques; la barra móvil acaba de fijarse en D5 |
| X3 · Chrome no canónico | 6.4/6.45/6.52 (121), 9.6 (104) | `gap: 0.4rem` del app bar (sobrescribe `gap-2`), `0.6rem` del paginador de clínica | Media | Abierta: chrome (C23b) y anclas de B06/visual-consistency |

### 12.2 Cambio

`gap-1.5` → `gap-2` en 12 líneas de 9 archivos: `AdminClinicsManagementCard.tsx` (fila móvil, celda de escritorio, paginador), `AdminSessionsReadOnlyCard.tsx` (trigger de escritorio), `AdminMobileAuditModule.tsx`, `AdminUsersRolesReadOnlyCard.tsx`, `AdminFailedLoginAlertsReadOnlyCard.tsx`, `AdminReportsCard.tsx` (fila y paginador), `AdminParticularTokensCard.tsx` (paginador), `AdminMobileOpsPager.tsx` y `CanonicalOperationalRow.tsx` (bloque de identidad). Todos son filas `flex` sin wrap o paginadores con altura reservada (`DASHBOARD_TOUCH_PAGER_RESERVATION`): el gap sólo desplaza contenido en el eje horizontal. Ningún guard anclaba esas clases.

### 12.3 Antes / después (sonda, 21 × 13)

| Métrica | `HEAD` | D6 |
| --- | ---: | ---: |
| Gaps efectivos de 6 px | 930 | **520** |
| Gaps efectivos de 8 px | 2 106 | 2 503 |
| Gaps fuera de 4/8/12/16/24 | 2 003 | 1 593 |
| Elementos truncados | 873 | 873 |
| Contenedores con recorte horizontal | 9 | 9 |
| Registros con scroll de documento | 0 | 0 |

Dos diferencias de conteo de la sonda no son atribuibles al cambio: `admin-sesiones` a 430 alterna 15/16 ítems con el mismo código (asentamiento de la sonda tras el resize; A03 en PASSED) y `clinic-informes-full` a 1920 mide 6 filas `CanonicalOperationalRow` frente a 17, donde el único gap cambiado del componente es inerte (la fila no lleva `badges`); A02/A03/A05 en PASSED.

### 12.4 Pruebas

| Gate | Estado |
| --- | --- |
| Suite Node (`pnpm test`), incluidos los guards que leen los nueve archivos | FAILED 5 437/5 439 (1 skip): sólo `e2e-global-03b-authoritative-auth-boundary`, que exige `DATABASE_URL`/`SUPABASE_DB_URL` (ambiental y preexistente) |
| A02 geometría 21×13 (fixture Win32 sin cambios) | PASSED 21/21 |
| A03 límite adaptativo 15×13 | PASSED 16/16 |
| A05 invariancia de límite 15×13 | PASSED 15/15 |
| A08 zero-scroll 21×13 | PASSED 21/21 |
| Frontera zero-scroll móvil (`extended`, spec único) | PASSED 8/8 |
| `e2e:admin-mobile` | FAILED 163/165: T1 y T2 de §12.6, preexistentes y no atribuibles a D6 |
| `e2e:visual-contract` | FAILED 1 044/1 047 (con `E2E_GLOBAL_TIMEOUT_MS=3600000`; la primera corrida agotó los 30 min con 1 007 PASSED, 0 FAILED y 40 sin correr): T3, T4 y T5 de §12.6, preexistentes y no atribuibles a D6 |
| Frontend `lint`, `typecheck`, `build`; `security:public-surface` | PASSED |
| `git diff --check` | PASSED |
| A02/A03 Linux, baselines visuales Linux | NOT_RUN localmente (sólo CI); las capturas Linux que muestren las filas o paginadores tocados pueden diferir, sin promoción autorizada |
| `e2e:full` | NOT_RUN (sin autorización) |

### 12.5 Pendiente, bloqueos y riesgos

- **D6 = PARCIAL.** Quedan 520 gaps efectivos de 6 px y 1 593 no canónicos. H3 queda como excepción decidida: no se introduce truncado para alcanzar 8 px. V1 y V2 mueven canvas o capacidad: requieren R13 propia (A02/A03). F1, T1 y X3 tocan chrome (C23b) o clases ancladas por guards (B05, B06, visual-consistency). M1 cruza F-T4/C23b. Q1 requiere re-medir la altura del hub.
- X1 y X2 se tratan como excepciones justificadas; si se quisiera cuantizar X2 (barra móvil, etiquetas de campo), es un cambio propio con medición de la barra y de las capturas a 320 px.
- Riesgo residual: +2 px por gap corregido estrechan el texto de esas filas; la sonda no registra truncado nuevo en los 273 registros, pero estados no cubiertos por los stubs (datos más largos) podrían truncar antes. Las filas afectadas tienen mecanismo de valor completo (PR-TRUNC).

### 12.6 Diagnóstico de los cinco fallos E2E (2026-10-26)

**Método.** A/B sobre el mismo árbol: el runtime alterna entre `HEAD` (las 12 líneas en `gap-1.5`, diff de `src` vacío) y D6 con un script que reescribe sólo esas líneas y conserva CRLF. Caché `frontend/.next` borrada antes de cada serie. Los cinco tests, aislados con `-g`, `--retries=0` y `--repeat-each=5`, en el mismo orden para los dos runtimes. Las sondas de causa raíz (fuera del catálogo y retiradas) usan los helpers de los specs originales y no modifican ningún test, contrato, fixture ni baseline.

| # | Test | D6 ×5 | `HEAD` ×5 | Causa raíz (evidencia) | Clase |
| --- | --- | ---: | ---: | --- | --- |
| T1 | `admin-mobile-core-modules-no-scroll` «reachable from bottom nav and Más menu» | 1/5 | 1/5 | Al cargar `/dashboard/admin?hub=1`, la app lanza su propia navegación suave a `?module=admin` (hub retirado). El clic en «Clínicas» llega con esa navegación pendiente y gana la última en commitear: en una copia instrumentada del spec, con runtime `HEAD` y 10 repeticiones, los **4 fallos** terminan en `?module=admin` («Resumen», el mismo estado que la captura original) y las 6 pasadas en `?module=admin-clinics`. La hidratación no es la causa: con el overlay de Next suprimido, el clic previo a hidratar navega 6/6 | **Defecto de producto preexistente** (FSM de navegación: una redirección de la app pisa la intención del usuario). Fuera del scope de D6 |
| T2 | `admin-mobile-status-modules-no-scroll` F-T3 «android-large-412x915» | 5/5 | 5/5 | `DashboardNotificationsBell` hace polling cada 30 s (`POLLING_INTERVAL_MS`). El test exige 0 requests durante su bucle de apertura y cierre de detalles; sólo falla si ese bucle cruza un tick, cosa que pasa cuando la cohorte completa ralentiza la máquina. La campana y Estado del sistema no están en el diff | **Intermitencia** del test, dependiente de la carga (aislamiento temporal frente al polling) |
| T3 | `dashboard-real-pointer-navigation` Informes 390 «A then B before A commits» | 5/5 | 5/5 | `expectStage` espera 5 s el workspace de Logística tras una navegación encadenada; sólo se agotó dentro de la cohorte de 34 min. Es la misma familia de navegación concurrente que T1; ningún archivo de navegación está en el diff | **Intermitencia** por carga; preexistente |
| T4 | `dashboard-c13-details-pane` «sin solicitudes de red» | 3/5 | 2/5 | Los `POST /dashboard/admin?module=audit-log` son la Server Action `getAdminAuditPage`, que `AdminAuditCard` dispara al cambiar `effectiveLimit` (refetch con debounce). `mount` espera hidratación y dos frames, no ese refetch, que a veces cae en la ventana del test. A 1366 px la presentación móvil (único archivo D6 de Auditoría) no se muestra | **Intermitencia** de readiness del test; preexistente (`HEAD` falla más) |
| T5 | `dashboard-c24-list-grid-toggle` «clinic full route offers the grid» | 5/5 | 5/5 | A 1440 px, `settleInformesRows` devuelve a veces 6 filas, un estado **transitorio**: con el helper oficial, `HEAD` dio 6 en 4/10 y 6/10 muestras y D6 en 2/11; 3 s después siempre hay 13 filas con el canvas idéntico (597 px). La cuadrícula pinta la ventana real (13) y la comparación falla. `CanonicalOperationalRow` no recibe `badges` en esa lista: el gap de D6 es inerte allí | **Intermitencia** de readiness del helper de test; preexistente |

**Conclusión.** Ningún fallo es una regresión de D6: los cinco reproducen con el runtime de `HEAD` con la misma o mayor frecuencia, o sólo fallan bajo la carga de la cohorte completa, y en todos la causa está en código que el diff no toca. T1 es un defecto real de producto, preexistente, que conviene tratar en una tarea propia de navegación. T2–T5 son debilidades de sincronización de los tests. No se modificó ningún test para ocultarlas.

**Revalidación tras el diagnóstico** (runtime idéntico al validado en §12.4): `e2e:verify-catalog` PASSED 7/7; guards Node de los nueve archivos y de C25 PASSED 535/535; frontend `lint` y `typecheck` PASSED; `git diff --check` PASSED.
