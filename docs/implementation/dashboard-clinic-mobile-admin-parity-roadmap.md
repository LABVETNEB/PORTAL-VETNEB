# Roadmap — Paridad Dashboard Clínica mobile con Dashboard Administración mobile

Fuente única: `docs/audit/AUDITORIA_CAJA_BLANCA_DASHBOARD_CLINICA_MOBILE_VS_ADMIN.md`
(HEAD `b68e22a3`, 126 mediciones runtime en Chromium 149.0.7827.55).

No existe trabajo en este roadmap sin diferencia auditada, y no existe diferencia auditada
sin bloque en este roadmap.

```text
CMP_BLOCKS               = 12
DIFFERENCES_ROADMAPPED   = 42/42
ROOT_CAUSES_ROADMAPPED   = 17/17
```

## Cobertura

| Bloque | DIF cerradas | RC cerradas | Depende de | Riesgo |
| --- | --- | --- | --- | --- |
| CMP-01 | 001, 002, 003, 004, 005 | RC-001, RC-002 | — | MEDIUM |
| CMP-02 | 006, 007, 041 | RC-015 | CMP-01 | MEDIUM |
| CMP-03 | 008, 009, 010 | RC-003 | CMP-01 | LOW |
| CMP-04 | 011, 012, 013 | RC-004 | CMP-03 | HIGH |
| CMP-05 | 020, 021, 022, 023, 024 | RC-006, RC-007 | CMP-04 | HIGH |
| CMP-06 | 014, 015, 016, 017, 018, 019 | RC-005 | CMP-04 | HIGH |
| CMP-07 | 025, 026, 038, 039, 040 | RC-008, RC-014 | CMP-04 | MEDIUM |
| CMP-08 | 027, 028, 029, 030 | RC-009 | CMP-04, CMP-06 | MEDIUM |
| CMP-09 | 031, 032, 033 | RC-010 | CMP-04, CMP-06 | LOW |
| CMP-10 | 034, 035, 036, 037 | RC-011, RC-012, RC-013 | CMP-04, CMP-06 | MEDIUM |
| CMP-11 | 042 | RC-016 | CMP-05, CMP-09 | LOW |
| CMP-12 | las 42 (validación) | RC-017 | CMP-01…11 | MEDIUM |

Regla transversal para todo bloque: **PR mínimo** (§4 de `AGENTS.md`), un scope primario, un
rollback. Cada bloque es un PR independiente y secuenciado. Los guards de arquitectura y los
censos que un cambio in-scope rompa legítimamente se realinean **en el mismo PR**, nunca se
debilitan ni se marcan skip.

Regla transversal de Admin: si un bloque extrae un primitivo compartido desde Admin, el
resultado visual de Admin debe quedar **geometry-equivalent**. El criterio cuantitativo es
el mismo en los 12 bloques y se enuncia una vez aquí:

```text
ADMIN_REGRESSION_GATE
  para las 11 superficies Admin × 6 viewports mobile:
    |Δ| <= 0.5 CSS px en toda caja estructural
    igualdad EXACTA de token/string en todo estilo computado estructural
    pageScrollsY == false, pageScrollsX == false, localScrollers == 0
```

---

## Contrato de paridad absoluta (BLOQUEADO)

Este contrato tiene precedencia sobre cualquier criterio de aceptación de un bloque
individual. Sustituye las tolerancias originales de la auditoría (2 px / 4 px), que
describían el estado observado, por las tolerancias de la implementación.

### PC-1 · Objetivo

```text
CLINIC_VISUAL_COMPONENT == ADMIN_CANONICAL_VISUAL_COMPONENT
```

No se acepta "similar", "misma gramática", "equivalente", "consistente", "inspirado en
Admin" ni "suficientemente cerca". Donde sea técnicamente posible, Clínica **reutiliza el
mismo primitivo compartido**. Ninguna reimplementación clínica paralela es aceptable cuando
el primitivo canónico de Admin puede compartirse.

### PC-2 · Qué puede diferir

Sólo **contenido de dominio**: etiquetas de métrica, valores de métrica, etiquetas de
entidad, acciones de dominio y datos de dominio.

**No** es contenido de dominio y por tanto **no puede diferir**: familia de componente,
geometría de tarjeta, padding, spacing, orden del DOM, ubicación de superficie, ubicación
de la región de métricas, tipografía, breakpoint, densidad visual, comportamiento de
scroll, diseño del pager, diseño de filtros, diseño de diálogo, geometría visual de tabs.

### PC-3 · Igualdad exacta de estilo computado

Para elementos canónicos renderizados en el mismo viewport se exige **igualdad exacta de
string/token**:

```text
display · position · flex-direction · grid-template-columns · grid-template-rows
align-items · justify-content · gap · padding · margin (cuando es estructural)
font-size · font-weight · line-height · letter-spacing
border-width · border-style · border-radius
color computado · background-color computado
overflow-x · overflow-y
```

### PC-4 · Tolerancia geométrica

```text
|Δ| <= 0.5 CSS px  para: x, y relativo al padre canónico, width,
                          height fija/mínima independiente del contenido,
                          gaps, paddings
```

Si un valor difiere porque la longitud del texto de dominio cambia la altura natural del
contenido, debe demostrarse igualmente el **mismo primitivo compartido y el mismo contrato
CSS**. Está prohibido relajar la tolerancia para hacer pasar un test.

### PC-5 · Contrato táctil

La geometría **visible** debe coincidir con Admin. El blanco táctil **efectivo** debe ser
`>= 44 × 44 CSS px`. Si la geometría visible de Admin queda por debajo de 44 px, **no se
modifica Admin**: Clínica usa la misma geometría visible más un área de impacto no visual,
sin regiones de impacto solapadas, sin padding visible extra y sin cambiar el ritmo
vertical. Se validan por separado `VISUAL_GEOMETRY_PARITY` y `EFFECTIVE_TOUCH_TARGET`.

### PC-6 · Orden del DOM

Donde la referencia Admin contiene esas regiones, la secuencia canónica es:

```text
SHELL → APP BAR → WORKSPACE HEADER → METRIC REGION
      → TOOLBAR/FILTER REGION → CONTENT SURFACE → PAGER/FOOTER
```

Las métricas no pueden moverse a tabs, al cuerpo de la tarjeta de contenido, a diálogos, a
drawers, a la toolbar ni a una hoja mobile oculta.

### PC-7 · Prohibición de paridad por aserción

La paridad no se declara por compartir nombres de clase, por importar el mismo componente,
porque pasen los tests ni porque las capturas se parezcan. Se demuestra **midiendo el
navegador en vivo**.

### PC-8 · Matriz cerrada

```text
MOBILE_VIEWPORTS = 360×740 · 360×800 · 375×812 · 390×844 · 412×915 · 430×932
CLINIC_CERTIFICATION = 10 superficies × 6 viewports = 60/60
```

No se admite una matriz parcial de 3/6. No se admite `N/A` en ninguna superficie clínica.

---

## CMP-01

### Objective
Llevar el app bar mobile de Clínica a la gramática G-002 de Admin: 48 px fijos, una línea de
título con el contexto del módulo, sin subtítulo y con una única acción de 44×44.

### Differences closed
DIF-001, DIF-002, DIF-003, DIF-004, DIF-005.

### Root causes closed
RC-001, RC-002.

### Admin canonical reference
- `frontend/src/styles/dashboard/mobile-admin.css` — `--admin-mobile-appbar-h: 3rem` (`:67`),
  fijado de altura (`:125-142`), supresión de título/subtítulo/acciones de escritorio
  (`:144-152`), `.admin-mobile-context-title` (`:154-163`), kebab con piso táctil de 44 px
  (`:172-180`).
- `frontend/src/components/dashboard/DashboardTopbar.tsx` — `AdminMobileContextTitle`
  (`:129-133`).

### Clinic target
- `frontend/src/components/dashboard/DashboardTopbar.tsx` — `DashboardTopbar` (`:121-142`).
- `frontend/src/components/dashboard/WorkspaceAppBar.tsx` — `WorkspaceAppBar`.
- `frontend/src/styles/dashboard/mobile-clinic.css` — bloque `@media (max-width: 767px)`
  (`:53-207`).

### Implementation detail
- **Extraer** de `DashboardTopbar.tsx:128-134` el componente
  `ModuleContextTitle` (nuevo, `frontend/src/components/dashboard/ModuleContextTitle.tsx`),
  parametrizado por `surface: "admin" | "clinic"` y por el resolvedor de contexto. La rama
  admin debe seguir renderizando exactamente el mismo árbol y la misma clase
  `.admin-mobile-context-title`; la rama clínica renderiza la clase equivalente
  `.clinic-mobile-context-title` con los mismos tokens.
- Sustituir la condición `isAdmin ? … : null` por el render del nuevo componente para ambos
  roles. Props: `{ surface, moduleId, fallback }`. `Suspense` se conserva con el mismo
  `fallback` textual por rol.
- El resolvedor de contexto clínico deriva el título del módulo activo
  (`operaciones` → "Operaciones", `informes` → "Informes", `logistica` → "Logística",
  `perfil` → "Perfil público", `tokens` → "Tokens particulares") y, en rutas completas,
  del nombre de la página, que ya es correcto hoy.
- En `mobile-clinic.css`, añadir dentro del `@media (max-width: 767px)` el bloque espejo:
  - token `--clinic-mobile-appbar-h: 3rem`;
  - `height/min-height/max-height: calc(var(--clinic-mobile-appbar-h) + env(safe-area-inset-top))`
    sobre `[data-dashboard-topbar-polish="true"]` scoped a
    `[data-vetneb-app-shell-surface="clinic"]`, con `padding: 0`;
  - `display: none !important` para `#dashboard-topbar-title`,
    el subtítulo del topbar y `[data-dashboard-desktop-actions="true"]`;
  - `.clinic-mobile-context-title { display:block; font-size:1rem; font-weight:650;
    line-height:1.2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }`.
- Las tres acciones actuales (theme toggle, notificaciones, salir) se colapsan en **un**
  kebab de 44×44 con el mismo primitivo del kebab admin. Su menú contiene los tres destinos.
- DOM order del app bar tras el cambio: `[título de contexto] [kebab]`.
- Sin cambio de breakpoint: todo bajo `max-width: 767px`.

### Files to modify
```text
frontend/src/components/dashboard/DashboardTopbar.tsx
frontend/src/components/dashboard/WorkspaceAppBar.tsx
frontend/src/styles/dashboard/mobile-clinic.css
```

### Files to add
```text
frontend/src/components/dashboard/ModuleContextTitle.tsx
```

### Files to delete
Ninguno.

### Forbidden changes
`frontend/src/styles/dashboard/mobile-admin.css` y `frontend/src/app/dashboard/admin/**`.
La extracción sólo puede tocar `DashboardTopbar.tsx`, y Admin debe seguir midiendo 48.00 px
de app bar y 16px/650 de título en los 6 viewports.

### Acceptance criteria
```text
appBarHeight            == 48.00  en 10 superficies × 6 viewports
appBarTitle.fontSize    == 16px
appBarTitle.fontWeight  == 650
appBarTitle.content     == nombre del módulo activo (≠ "Dashboard Clínica")
appBarSubtitle          == ausente (0 nodos visibles)
appBarActions.length    == 1
appBarActions[0] box    == 44×44 (>= 44 en ambos ejes)
ADMIN_REGRESSION_GATE   PASS
```

### Runtime validation
Rutas: las 10 (CLN-001…010). Viewports: los 6.

### Automated validation
`pnpm --dir frontend e2e:public-clinic`, `pnpm --dir frontend e2e:admin-mobile`,
`pnpm --dir frontend lint`, `typecheck`, `build`, `pnpm security:public-surface`.

### Dependencies
Ninguna.

### Risk
MEDIUM — toca un componente compartido por ambos roles; el gate de regresión Admin es
obligatorio en el mismo PR.

---

## CMP-02

### Objective
Alinear el modelo de slots del bottom nav clínico con G-011 (5 slots de 78 px + overflow) y
resolver la ausencia de superficie de entrada.

### Differences closed
DIF-006, DIF-007, DIF-041.

### Root causes closed
RC-015.

### Admin canonical reference
`frontend/src/components/dashboard/DashboardMobileNav.tsx` — catálogo de destinos y
overflow (`:129-164`, `:207-290`, `:307-400`); superficie de hub
`[data-admin-mobile-hub-launcher]` en `frontend/src/app/dashboard/admin/`.

### Clinic target
`frontend/src/components/dashboard/DashboardMobileNav.tsx`,
`frontend/src/app/dashboard/page.tsx`.

### Decisión bloqueada
```text
CLINIC_HOME = REAL_HUB
REMOVE_HOME = FALSE
```
El `home` clínico se convierte en un hub real, estructuralmente equivalente al de Admin.
La opción (a) del análisis original — retirar el slot — queda **descartada**.

### Implementation detail
- El componente **ya es compartido**: el cambio es de configuración, no de primitivo.
  Elevar el límite de slots a una constante única `MOBILE_NAV_SLOTS = 5` aplicada a ambos
  roles, de forma que el sexto destino clínico caiga al overflow existente. Con `home`
  conservado, los slots son `home` + los 4 primeros módulos, y `tokens` pasa al overflow,
  exactamente como Admin envía sus módulos 5–10 al overflow.
- `home` deja de resolver al módulo por defecto y pasa a resolver a una **superficie de
  entrada real** con la gramática del launcher de Admin: tiles paginados
  (`[data-admin-mobile-hub-launcher]` como referencia), sin tarjeta de módulo, con pager de
  tiles. El hub clínico consume el mismo primitivo de launcher, parametrizado por rol.
- La etiqueta recupera `9.6px` automáticamente al pasar a 78 px de slot; no se toca el CSS
  de tipografía.

### Files to modify
```text
frontend/src/components/dashboard/DashboardMobileNav.tsx
frontend/src/app/dashboard/page.tsx
```

### Files to add
Ninguno en la opción (a). En la opción (b), la superficie de entrada clínica.

### Files to delete
Ninguno.

### Forbidden changes
La rama admin del catálogo de destinos y el orden de sus 5 slots.

### Acceptance criteria
```text
bottomNavItemCount   == 5
bottomNavItem box    == 78 × 50.2 (±2px)
bottomNav label      == 9.6px
overflow             presente y paginable
bottomNav height     == 51.19 (sin cambio)
ADMIN_REGRESSION_GATE PASS
```

### Runtime validation
Las 10 superficies × 6 viewports, más la hoja de overflow abierta y paginada.

### Automated validation
`e2e:public-clinic`, `e2e:admin-mobile`, `e2e:extended`.

### Dependencies
CMP-01.

### Risk
MEDIUM — cambia la navegación primaria de Clínica; requiere decisión explícita de Nico
sobre (a) vs (b) antes de implementar.

---

## CMP-03

### Objective
Aplicar a Clínica el *header reclaim* que Admin ya tiene: suprimir la banda
`.dashboard-workspace-header` en mobile y anular el `padding-top` del module viewport.

### Differences closed
DIF-008, DIF-009, DIF-010.

### Root causes closed
RC-003.

### Admin canonical reference
`frontend/src/styles/dashboard/mobile-admin.css` — bloque
`admin-mobile-module-header-reclaim` (`:482-507`).

### Clinic target
`frontend/src/styles/dashboard/mobile-clinic.css`.

### Implementation detail
- Añadir el bloque espejo dentro del `@media (max-width: 767px)` existente:
  ```text
  [data-vetneb-app-shell-surface="clinic"]
    [data-dashboard-module-workspace]
    .dashboard-workspace-header { display: none !important; }

  [data-vetneb-app-shell-surface="clinic"]
    [data-dashboard-module-workspace]
    [data-dashboard-module-viewport] { min-height: 0; padding-top: 0 !important; }
  ```
- `WorkspaceHeader.tsx` **no se modifica**: sigue renderizando para desktop y sigue aportando
  el `h2` que da nombre accesible al workspace. La supresión es visual y por breakpoint,
  igual que en Admin.
- Precondición: CMP-01 debe estar fusionado, porque el título de contexto pasa a vivir en el
  app bar; suprimir el header antes dejaría a Clínica sin indicación de módulo.

### Files to modify
```text
frontend/src/styles/dashboard/mobile-clinic.css
```

### Files to add
Ninguno.

### Files to delete
Ninguno.

### Forbidden changes
`mobile-admin.css`; `WorkspaceHeader.tsx`.

### Acceptance criteria
```text
legacyWorkspaceHeader           == null (0 px) en CLN-001…005 × 6 viewports
moduleViewportPaddingTop        == 0
primer contenido de CLN-001     y ≈ 55 (delta vs Admin <= 2px)
ganancia medida                 >= 56 px de canvas (40 header + 16 padding)
document scroll                 sin cambio (false/false)
ADMIN_REGRESSION_GATE           PASS
```

### Runtime validation
CLN-001…005 × 6 viewports.

### Automated validation
`e2e:public-clinic`, `e2e:extended`, `e2e:visual-contract`.
Realinear en el mismo PR `test/architecture/dashboard-b11-workspace-header.test.ts` si su
censo ancla la presencia del header en mobile clínico.

### Dependencies
CMP-01.

### Risk
LOW — cambio CSS acotado por breakpoint y por superficie, con precedente idéntico en Admin.

---

## CMP-04

### Objective
Hacer que cada módulo clínico rinda **una** tarjeta canónica `.dashboard-surface` que llene
el canvas, eliminando las cuatro capas de anidamiento intermedias.

### Differences closed
DIF-011, DIF-012, DIF-013.

### Root causes closed
RC-004.

### Admin canonical reference
`frontend/src/app/dashboard/admin/AdminMobileStatusModule.tsx` (`:1-111`),
`AdminMobileConfigModule.tsx` (`:1-109`), `AdminMobileAuditModule.tsx`.
Tokens de la tarjeta: `radius 8px`, `border 1px`, `background rgb(248,251,252)`,
`overflow:hidden`, `flex-1`, `min-h-0`.

### Clinic target
`frontend/src/components/dashboard/ClinicMobileModuleFrame.tsx`,
`frontend/src/components/dashboard/ModuleSurface.tsx`,
`frontend/src/app/dashboard/ClinicCommandCenter.tsx`,
`frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx`,
`frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx`,
`frontend/src/components/dashboard/ClinicPublicProfileCard.tsx`,
`frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`.

### Implementation detail
- **Extraer** de los arquetipos admin el primitivo compartido `ModuleCard`
  (`frontend/src/components/dashboard/ModuleCard.tsx`): `section.dashboard-surface` con
  `flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-vetneb-line/80
  bg-card` y slots nombrados `header`, `bands`, `canvas`, `pager`.
- Reescribir los arquetipos admin para consumir `ModuleCard` **sin cambiar una sola clase
  emitida**: el DOM resultante debe ser byte-equivalente al actual. Este es el único punto
  del roadmap en que se tocan archivos de Admin, y está sujeto al `ADMIN_REGRESSION_GATE`.
- En Clínica, colapsar la cadena
  `clinic-mobile-module-frame > clinicCommandCenter > dashboard-module-surface >
  dashboard-module-body > dashboard-module-tabs`
  a `ModuleCard > [banda de chips] > [canvas] > [pager]`.
- `ClinicMobileModuleFrame` queda como envoltorio vacío y se retira de la cadena de render
  (el archivo se conserva si tiene consumidores desktop; la auditoría no midió desktop y no
  puede declararlo muerto).
- `ModuleSurface` (`.dashboard-module-surface`) deja de usarse en la cadena mobile clínica;
  se conserva para desktop.
- Scroll ownership: la tarjeta es `overflow:hidden`; el canvas interno es
  `min-h-0 flex-1 overflow:hidden`. Ningún descendiente recibe `overflow:auto` (ver CMP-10).

### Files to modify
```text
frontend/src/app/dashboard/admin/AdminMobileStatusModule.tsx      (sólo consumo de ModuleCard)
frontend/src/app/dashboard/admin/AdminMobileConfigModule.tsx      (sólo consumo de ModuleCard)
frontend/src/app/dashboard/admin/AdminMobileAuditModule.tsx       (sólo consumo de ModuleCard)
frontend/src/components/dashboard/ClinicMobileModuleFrame.tsx
frontend/src/app/dashboard/ClinicCommandCenter.tsx
frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx
frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx
frontend/src/components/dashboard/ClinicPublicProfileCard.tsx
frontend/src/components/dashboard/ClinicParticularTokensCard.tsx
frontend/src/styles/dashboard/layout.css
```

### Files to add
```text
frontend/src/components/dashboard/ModuleCard.tsx
```

### Files to delete
Ninguno.

### Forbidden changes
Cualquier cambio en Admin que altere su geometría. `mobile-admin.css` no se toca.

### Acceptance criteria
```text
surfaceCount                    == 1 en CLN-001…005 × 6 viewports
primarySurface.borderRadius     == 8px
primarySurface.borderTopWidth   == 1px
primarySurface.backgroundColor  == rgb(248, 251, 252)
primarySurface.overflowY        == hidden
surfaceTop                      == 54.91 / 54.91 / 54.98 / 55.06 / 55.17 / 55.27 (±2px)
surfaceBottomGap                == surfaceInsetLeft (±2px)
profundidad DOM viewport→contenido == la de Admin
ADMIN_REGRESSION_GATE           PASS (11 superficies × 6 viewports)
```

### Runtime validation
CLN-001…005 × 6 viewports, y las 11 superficies Admin como control de no-regresión.

### Automated validation
`e2e:admin-mobile` (control Admin), `e2e:public-clinic`, `e2e:visual-contract`,
`e2e:extended`. Realinear en el mismo PR los guards de `test/architecture/` que anclen
`.dashboard-module-surface` o la cadena de anidamiento clínica.

### Dependencies
CMP-03.

### Risk
HIGH — es el bloque estructural del roadmap y el único que toca Admin. Mitigación: la
extracción debe ser un refactor puro verificado por el gate de regresión antes de aplicar
cualquier cambio clínico; si el gate no pasa, el PR se detiene.

---

## CMP-05

### Objective
Unificar las tres gramáticas de métrica en el primitivo canónico G-006 y dotar de región de
métricas a las seis superficies clínicas que hoy no tienen ninguna.

### Differences closed
DIF-020, DIF-021, DIF-022, DIF-023, DIF-024.

### Root causes closed
RC-006, RC-007.

### Admin canonical reference
`frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx:146-162` — banda `md:hidden` con
`span[data-dashboard-b14-metrics]`, `flex items-baseline gap-1.5 whitespace-nowrap
tabular-nums`, separadores `·`, altura medida 16.00 px en los 6 viewports, sin tarjeta,
borde, radio ni fondo, alojada **dentro** de la banda de encabezado.

### Clinic target
`frontend/src/app/dashboard/logistica/visitas/page.tsx:119`,
`frontend/src/app/dashboard/logistica/rutas/page.tsx:119`,
`frontend/src/app/dashboard/logistica/metricas/page.tsx:163`,
`frontend/src/components/dashboard/StatsCards.tsx`,
`frontend/src/app/dashboard/ClinicCommandCenter.tsx`,
`frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx`,
`frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx`,
`frontend/src/components/dashboard/ClinicPublicProfileCard.tsx`,
`frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`,
`frontend/src/app/dashboard/informes/InformesReportsList.tsx`,
`frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx`,
`frontend/src/styles/dashboard/zero-scroll.css:318-345`.

### Implementation detail
- **Extraer** `ModuleMetricRun` (`frontend/src/components/dashboard/ModuleMetricRun.tsx`)
  desde `AdminAuditFilterBar.tsx:151-162`. Props:
  `{ metrics: ReadonlyArray<{ key: string; label: string; value: string | number }>,
     surfaceId: string }`. Emite
  `<span data-dashboard-b14-metrics={surfaceId} class="flex shrink-0 items-baseline gap-1.5
  whitespace-nowrap tabular-nums">` con un `<span data-metric={key}>` por métrica y
  `<span aria-hidden="true">·</span>` entre ellas.
- `AdminAuditFilterBar` pasa a consumirlo; su DOM debe quedar byte-equivalente.
- Las tres rutas de logística **retiran** `[data-dashboard-metric-strip]` de encima de la
  tarjeta y montan `ModuleMetricRun` **dentro** de la banda de encabezado de `ModuleCard`,
  quedando así también cerrado el orden de bandas de esas tres superficies (CMP-11 valida).
- `CLN-001` retira la pila vertical de `.dashboard-metric-card` (4 × 106 px) del tab panel y
  monta `ModuleMetricRun` en el encabezado de la tarjeta.
### Decisión bloqueada — métricas de dominio

```text
CANONICAL_METRIC_GRAMMARS   = 1
CLINIC_METRIC_SURFACES      = 10/10
CLINIC_METRIC_PRIMITIVE_COUNT = 1   (una familia de implementación visual)
```

Las seis regiones hoy ausentes reciben exactamente estas métricas:

| Superficie | Métrica 1 | Métrica 2 | Métrica 3 |
| --- | --- | --- | --- |
| CLN-001 Operaciones | Informes | Pendientes | Visitas activas |
| CLN-002 Informes (workspace) | Total | En proceso | Disponibles |
| CLN-003 Logística (workspace) | Visitas | Activas | Completadas |
| CLN-004 Perfil | Estado | Completitud | Pendientes |
| CLN-006 `/dashboard/informes` | Total resultados | En proceso | Disponibles |
| CLN-007 `/dashboard/logistica` | Visitas activas | Planes activos | Total visitas |

Las cuatro superficies que **ya** portan métricas — CLN-005 Tokens, CLN-008 Visitas,
CLN-009 Rutas, CLN-010 Métricas de logística — migran al **mismo** primitivo canónico.
Ninguna conserva su gramática actual.

Implementaciones de métrica prohibidas en Clínica después de la migración, cuando
representen una geometría alternativa: `dashboard-kpi-pill`, `dashboard-metric-card`,
`StatsCards`, `ParticularTokensMetricStrip`. Si alguno de esos nombres sobrevive por
compatibilidad, debe delegar el **100 %** en el primitivo canónico y documentarse.
Preferente: retirar la duplicación visual obsoleta cuando sea seguro y esté auditado.

### Regla de métricas de Perfil (CLN-004)

Prohibido añadir un endpoint de backend sólo para fabricar métricas cosméticas. Las tres
métricas se derivan de los datos de perfil/publicación que la ruta ya recibe, cuyo contrato
la auditoría observó en runtime (`profile.publication`):

```text
ESTADO      = publication.isSearchEligible ? "Visible" : "Oculto"
COMPLETITUD = publication.qualityScore            (entero 0–100, sufijo "%")
PENDIENTES  = publication.missingRequiredFields.length
            + publication.missingRecommendedFields.length
```

Las tres fórmulas se documentan en el componente que las calcula. Ninguna llamada de red
nueva.

### Implementation detail (continuación)
- Las seis superficies sin métricas (CLN-001…004, CLN-006, CLN-007) reciben
  `ModuleMetricRun` con las métricas de la tabla bloqueada de arriba.
- `zero-scroll.css:318-345` pierde las reglas de compresión de
  `[data-dashboard-metric-strip] .dashboard-metric-card`, que dejan de tener sujeto en
  mobile clínico. Conservarlas si algún consumidor desktop las necesita.
- `StatsCards.tsx` y `.dashboard-metric-card` se conservan para desktop; sólo se retiran de
  la cadena mobile clínica.

### Files to modify
```text
frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx     (sólo consumo de ModuleMetricRun)
frontend/src/app/dashboard/logistica/visitas/page.tsx
frontend/src/app/dashboard/logistica/rutas/page.tsx
frontend/src/app/dashboard/logistica/metricas/page.tsx
frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx
frontend/src/app/dashboard/ClinicCommandCenter.tsx
frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx
frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx
frontend/src/app/dashboard/informes/InformesReportsList.tsx
frontend/src/components/dashboard/ClinicPublicProfileCard.tsx
frontend/src/components/dashboard/ClinicParticularTokensCard.tsx
frontend/src/components/dashboard/StatsCards.tsx
frontend/src/styles/dashboard/zero-scroll.css
```

### Files to add
```text
frontend/src/components/dashboard/ModuleMetricRun.tsx
```

### Files to delete
Ninguno.

### Forbidden changes
La geometría de la banda de métricas de ADM-010 (`y ≈ 74`, `h = 16`).

### Acceptance criteria
```text
metricsCount            == 1 en las 10 superficies × 6 viewports
metricsHook             == "dashboardB14Metrics" en 60/60
metrics.box.height      == 16.00 (±2px) en 60/60
metrics.style.gap       == 6px
metricCard.borderRadius == 0px
metricCard.borderWidth  == 0px
metricCard.background   == transparente
métricas dentro del encabezado de la tarjeta: metrics.y > primarySurface.y
altura ganada vs. hoy    >= 31.7px (CLN-008/009), >= 50.3px (CLN-010), >= 456px (CLN-001)
ADMIN_REGRESSION_GATE   PASS
```

### Runtime validation
Las 10 superficies × 6 viewports.

### Automated validation
`e2e:admin-mobile`, `e2e:public-clinic`, `e2e:visual-contract`, `e2e:extended`.

### Dependencies
CMP-04 (la banda de encabezado canónica debe existir para alojar la corrida).

### Risk
HIGH — reduce cuatro tarjetas de métrica a una línea de texto en CLN-001; es el cambio de
densidad informativa más visible del roadmap y requiere validación de producto sobre qué
métricas sobreviven.

---

## CMP-06

### Objective
Integrar las cinco rutas completas de Clínica en el shell de módulos, de modo que rindan
stage, workspace, module viewport y una única tarjeta que llene el canvas.

### Differences closed
DIF-014, DIF-015, DIF-016, DIF-017, DIF-018, DIF-019.

### Root causes closed
RC-005.

### Admin canonical reference
`frontend/src/app/dashboard/page.tsx` — montaje de
`[data-dashboard-module-stage] > [data-dashboard-module-workspace] >
[data-dashboard-module-viewport]`; cotas de la tarjeta según G-004.

### Clinic target
`frontend/src/app/dashboard/informes/page.tsx`,
`frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx`,
`frontend/src/app/dashboard/logistica/visitas/page.tsx`,
`frontend/src/app/dashboard/logistica/rutas/page.tsx`,
`frontend/src/app/dashboard/logistica/metricas/page.tsx`.

### Implementation detail
- Las cinco páginas envuelven su contenido en el mismo trío de contenedores que el shell de
  módulos monta, con `data-dashboard-module-workspace` = identificador de la ruta
  (`informes-full`, `logistica-full`, `logistica-visitas`, `logistica-rutas`,
  `logistica-metricas`).
- El contenido pasa a `ModuleCard` (CMP-04), una por superficie.
- **CLN-007** deja de rendir dos tarjetas: las dos colecciones (visitas / planes) pasan a
  ser dos bandas de chips sobre una única tarjeta, siguiendo el arquetipo config de Admin
  (`AdminMobileConfigModule`), que resuelve exactamente ese caso con dos paneles.
- La sticky action bar de CLN-007 se reubica en CMP-10.
- El botón "Abrir módulo completo" y la barra de acciones del hub conservan su función de
  navegación; no se retira ninguna ruta.

### Files to modify
```text
frontend/src/app/dashboard/informes/page.tsx
frontend/src/app/dashboard/informes/InformesReportsList.tsx
frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx
frontend/src/app/dashboard/logistica/visitas/page.tsx
frontend/src/app/dashboard/logistica/rutas/page.tsx
frontend/src/app/dashboard/logistica/metricas/page.tsx
```

### Files to add
Ninguno.

### Files to delete
Ninguno.

### Forbidden changes
Ninguna ruta se elimina ni se redirige.

### Acceptance criteria
```text
[data-dashboard-module-stage]     presente en CLN-006…010 × 6 viewports
[data-dashboard-module-workspace] presente en 30/30
[data-dashboard-module-viewport]  presente en 30/30
surfaceCount                      == 1 en 30/30 (CLN-007 incluido)
surfaceTop                        == 54.91…55.27 (±2px por viewport)
surfaceBottomGap                  == surfaceInsetLeft (±2px)
espacio muerto CLN-007            de 229.34–336.92 px a <= 9 px
ADMIN_REGRESSION_GATE             PASS
```

### Runtime validation
CLN-006…010 × 6 viewports.

### Automated validation
`e2e:public-clinic`, `e2e:extended`, `e2e:visual-contract`. Realinear en el mismo PR los
specs de rutas completas de logística (`dashboard-logistica-*-full-route-adaptive.spec.ts`)
que anclan la estructura actual.

### Dependencies
CMP-04.

### Risk
HIGH — cinco rutas server-rendered cambian de layout raíz. Mitigación: un PR por ruta si el
gate de scope lo exige, con CLN-007 último por ser el que además fusiona dos tarjetas.

---

## CMP-07

### Objective
Unificar la banda de filtros y la banda de chips/tabs de Clínica con G-007 y G-008.

### Differences closed
DIF-025, DIF-026, DIF-038, DIF-039, DIF-040.

### Root causes closed
RC-008, RC-014.

### Admin canonical reference
- Filtros: banda `grid grid-cols-2 gap-2 border-b bg-muted/15 px-2 py-1` de 62 px con
  controles `.field-select h-9` (32–36 px, `font-size 12–14px`), en
  `AdminSessionsReadOnlyCard.tsx` y `AdminUsersRolesReadOnlyCard.tsx`; desbordamiento a
  `ModuleDialog` en `AdminAuditFilterBar.tsx:163-176`.
- Chips: banda `role="tablist"` dentro de la tarjeta, `border-b`, 33.39 px, chips `flex-1
  truncate` de ancho igual, `10.56px / 600`, `radius 6px`, padding `4.8 / 6.4`, en
  `AdminMobileStatusModule.tsx` y `AdminMobileConfigModule.tsx`.

### Clinic target
`frontend/src/components/dashboard/ModuleTabs.tsx`,
`frontend/src/styles/dashboard/layout.css` (`.dashboard-module-tablist`),
`frontend/src/app/dashboard/informes/InformesReportsList.tsx`,
`frontend/src/components/dashboard/ClinicPublicProfileCard.tsx`,
`frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`.

### Implementation detail
- `ModuleTabs` recibe una variante `density="module-card"` que emite la banda dentro de la
  tarjeta con los tokens de Admin: `flex shrink-0 items-center gap-1 overflow-hidden
  border-b p-1.5`, chips `min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-[0.72rem]
  font-semibold leading-tight`. `flex-1` es lo que impide la envoltura de DIF-040.
- CLN-004 tiene **5** tabs; a 375 px de ancho de tarjeta, `flex-1` da ~71 px por chip, por
  encima del mínimo de truncado. Si la medición post-cambio muestra texto ilegible, la
  salida canónica es la del arquetipo config de Admin: reagrupar en 2–3 paneles, no
  reintroducir la envoltura.
- CLN-006 sustituye el bloque de filtros expandido (163 px) por la banda inline de 62 px;
  los controles que no entren van al `ModuleDialog` "Filtros", como hace ADM-010.
- CLN-002 y CLN-005 **añaden** la banda inline con el resumen de estado de filtro
  ("Todos los eventos" / "Filtros activos" es el patrón de Admin) junto al disparador del
  diálogo que ya tienen.
- Controles de filtro clínicos bajan de 40 px a `h-9` (36 px).

### Files to modify
```text
frontend/src/components/dashboard/ModuleTabs.tsx
frontend/src/styles/dashboard/layout.css
frontend/src/app/dashboard/informes/InformesReportsList.tsx
frontend/src/app/dashboard/ClinicCommandCenter.tsx
frontend/src/components/dashboard/ClinicPublicProfileCard.tsx
frontend/src/components/dashboard/ClinicParticularTokensCard.tsx
```

### Files to add
Ninguno.

### Files to delete
Ninguno.

### Forbidden changes
Los arquetipos admin de chips; el primitivo `ModuleDialog`, que ya está en paridad exacta
y no debe tocarse.

### Acceptance criteria
```text
chipsRow.height        == 33.39 (±2px) en CLN-001 y CLN-004 × 6 viewports
chip.height            == 22.8 (±2px)  [ver Riesgo]
chip widths            iguales entre sí (varianza <= 2px)
chip.fontSize          == 10.56px
chip.borderRadius      == 6px
tabs envueltos         == 0 en los 6 viewports (CLN-004)
banda de filtros       presente e inline en CLN-002, CLN-005, CLN-006
banda de filtros altura == 62 (±4px)
filterControl.height   == 32–36
ADMIN_REGRESSION_GATE  PASS
```

### Runtime validation
CLN-001, CLN-002, CLN-004, CLN-005, CLN-006 × 6 viewports. CLN-005 debe medirse con un stub
del endpoint de tokens para observar su estado poblado (riesgo residual 3 de la auditoría).

### Automated validation
`e2e:public-clinic`, `e2e:admin-mobile`, `e2e:extended`, spec de accesibilidad axe.

### Dependencies
CMP-04.

### Decisión bloqueada — contrato táctil

```text
VISUAL_GEOMETRY        = ADMIN (chip 22.8 px de alto, banda 33.39 px)
EFFECTIVE_TOUCH_TARGET = >= 44 × 44 CSS px
ADMIN_MODIFICATION     = FALSE
```

Se resuelve el conflicto sin tocar Admin y sin renunciar al piso táctil: el chip clínico
adopta la geometría **visible** de Admin y extiende su área de impacto mediante un
pseudo-elemento no visual (`::after` con `position:absolute`, `inset` negativo simétrico
hasta `44×44`, `content:""`, sin fondo, sin borde). Requisitos:

- el pseudo-elemento **no** aporta caja al layout: el ritmo vertical de la banda sigue
  siendo 33.39 px y el chip sigue midiendo 22.8 px de alto visible;
- las áreas de impacto de chips adyacentes **no se solapan**: con `gap 4px` entre chips y
  chips de ~119 px de ancho, la extensión vertical a 44 px es la única necesaria y la
  horizontal se limita a `gap/2` por lado;
- ningún padding visible adicional.

`VISUAL_GEOMETRY_PARITY` y `EFFECTIVE_TOUCH_TARGET` se validan como **dos asertos
separados** en el contrato de paridad.

### Risk
MEDIUM — el pseudo-elemento de impacto debe verificarse por `elementFromPoint` en las
cuatro esquinas del blanco de 44×44, no por inspección de CSS. Si dos áreas se solapan, el
toque llega al chip equivocado.

---

## CMP-08

### Objective
Reducir el vocabulario de `data-dashboard-row-pitch` de Clínica al único token canónico
`regular` y marcar cada fila con el hook adaptativo.

### Differences closed
DIF-027, DIF-028, DIF-029, DIF-030.

### Root causes closed
RC-009.

### Admin canonical reference
`AdminSessionsReadOnlyCard.tsx`, `AdminUsersRolesReadOnlyCard.tsx`,
`AdminMobileAuditModule.tsx`: `[data-dashboard-adaptive-rows-canvas]
[data-dashboard-row-pitch="regular"]`, filas de 44 px (40 px en `w360x740`), cada fila con
`[data-dashboard-adaptive-row]`. Capacidad medida 12/12/12/13/14/15.

### Clinic target
`frontend/src/app/dashboard/logistica/LogisticsBoundedCanvas.tsx`,
`frontend/src/app/dashboard/logistica/LogisticsRecentListCanvas.tsx`,
`frontend/src/app/dashboard/informes/InformesReportsList.tsx`,
`frontend/src/app/dashboard/logistica/metricas/page.tsx`.

### Implementation detail
- **Precondición obligatoria del bloque:** inventariar los campos que hoy transporta cada
  fila `card` (76 px), `tall` y `block` (168 px), y contrastarlos con los que caben en una
  fila `regular` de 44 px de Admin. La auditoría midió geometría, no carga informativa
  (riesgo residual 2). Los campos que no entren se reubican en el detalle o en el diálogo,
  siguiendo el patrón master-detail que Admin usa; **no se comprime la fila ocultando datos
  sin destino**.
- Emitir `data-dashboard-row-pitch="regular"` en los tres canvas y retirar `card`, `tall` y
  `block` de la cadena mobile clínica.
- Marcar cada fila renderizada con `data-dashboard-adaptive-row`, que hoy falta en CLN-007,
  CLN-008 y CLN-009 pese a declarar el canvas adaptativo.
- CLN-010 (bloques de 168 px por plan) es el caso más severo: 3 registros ocupan todo el
  canvas. Reconvertir a fila `regular` con el detalle por plan accesible mediante el patrón
  de detalle ya existente.

### Files to modify
```text
frontend/src/app/dashboard/logistica/LogisticsBoundedCanvas.tsx
frontend/src/app/dashboard/logistica/LogisticsRecentListCanvas.tsx
frontend/src/app/dashboard/informes/InformesReportsList.tsx
frontend/src/app/dashboard/logistica/metricas/page.tsx
```

### Files to add
Ninguno.

### Files to delete
Ninguno.

### Forbidden changes
El pitch adaptativo de Admin y su degradación a 40 px en `w360x740`.

### Acceptance criteria
```text
rowPitch (atributo) == "regular" en CLN-006…010 × 6 viewports
rowPitchPx          == 44 (40 en w360x740), ±2px
filas con [data-dashboard-adaptive-row] == número de registros renderizados
capacidad CLN-010   de 3 filas a >= 12 filas en w390x844
capacidad CLN-006   de 1–3 filas a >= 10 filas en w390x844
ningún campo de dominio pierde superficie sin destino documentado
ADMIN_REGRESSION_GATE PASS
```

### Runtime validation
CLN-006…010 × 6 viewports.

### Automated validation
`e2e:public-clinic`, `e2e:extended`, specs de paginación adaptativa clínica, que deben
realinearse en el mismo PR porque anclan las capacidades actuales.

### Dependencies
CMP-04, CMP-06.

### Risk
MEDIUM — cambia la densidad informativa por fila. El inventario de campos es una
precondición, no una tarea opcional.

---

## CMP-09

### Objective
Llevar el pager de Clínica a G-010: 40 px constantes y etiqueta con rango, total y página.

### Differences closed
DIF-031, DIF-032, DIF-033.

### Root causes closed
RC-010.

### Admin canonical reference
`frontend/src/app/dashboard/admin/AdminMobileOpsPager.tsx:1-64` —
`nav.dashboard-pager[data-dashboard-adaptive-reserved-region="pager"]`, `min-h-10`,
`border-t`, altura medida 40.00 px en los 6 viewports, etiqueta
`1–13 de 60 · Anterior · Pág. 1 / 5 · Siguiente`.

### Clinic target
`frontend/src/components/dashboard/DashboardPager.tsx`,
`frontend/src/components/dashboard/CompactPager.tsx`, y sus consumidores clínicos
(`ClinicInformesWorkspaceSummary`, `ClinicLogisticaWorkspaceSummary`,
`InformesReportsList`, `visitas|rutas|metricas/page.tsx`, `LogisticsCommandCenter`).

### Implementation detail
- Alinear `DashboardPager` y `CompactPager` con la geometría del pager admin: `min-h-10`
  fijo, `border-t`, `shrink-0`, `overflow-hidden` — la altura deja de derivarse del
  contenido, que es la causa de que hoy varíe 36.00→38.27 según el viewport.
- Etiqueta: `{offset+1}–{offset+visible} de {total}` + `Pág. {page} / {pages}`. Requiere que
  el consumidor pase `total`; las tres rutas de logística hoy no lo pasan, y por eso
  renderizan `Página 1` con ambos botones inertes (DIF-033).
- `[data-dashboard-adaptive-reserved-region="pager"]` debe emitirse en los pagers clínicos
  para que el cálculo de capacidad adaptativa reserve la banda igual que en Admin.
- CLN-007 pasa de dos pagers a uno al fusionarse sus dos tarjetas (CMP-06).

### Files to modify
```text
frontend/src/components/dashboard/DashboardPager.tsx
frontend/src/components/dashboard/CompactPager.tsx
frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx
frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx
frontend/src/app/dashboard/informes/InformesReportsList.tsx
frontend/src/app/dashboard/logistica/visitas/page.tsx
frontend/src/app/dashboard/logistica/rutas/page.tsx
frontend/src/app/dashboard/logistica/metricas/page.tsx
frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx
```

### Files to add
Ninguno.

### Files to delete
Ninguno.

### Forbidden changes
`AdminMobileOpsPager.tsx`.

### Acceptance criteria
```text
pagerHeight == 40.00 (±2px) en las 7 superficies con pager × 6 viewports
pagerHeight constante entre viewports (varianza == 0 ±2px)
etiqueta contiene rango, total y página en 7/7
pagers sin total == 0
[data-dashboard-adaptive-reserved-region="pager"] presente en 7/7
CLN-007 pagers == 1
ADMIN_REGRESSION_GATE PASS
```

### Runtime validation
CLN-002, CLN-003, CLN-006…010 × 6 viewports, con "Siguiente" operado realmente.

### Automated validation
`e2e:public-clinic`, `e2e:extended`, `frontend/e2e/clinic/shell/dashboard-centered-pager.spec.ts`
(realinear en el mismo PR).

### Dependencies
CMP-04, CMP-06.

### Risk
LOW — cambio local y verificable; el mayor trabajo es propagar `total` desde las rutas de
logística.

---

## CMP-10

### Objective
Alinear la gramática de estados, la propiedad del scroll y la ubicación de las acciones
persistentes con G-013, G-001 y G-005.

### Differences closed
DIF-034, DIF-035, DIF-036, DIF-037.

### Root causes closed
RC-011, RC-012, RC-013.

### Admin canonical reference
- Estados: `AdminSessionsReadOnlyCard.tsx:303-312` — error en el subtítulo del encabezado
  (`text-[11px] text-destructive`, `role="alert"`) + mensaje centrado y muted que llena el
  canvas, sin desplazar geometría.
- Scroll: `mobile-admin.css:470-478` — `overflow-y: hidden` en módulos ops.
- Acciones: la acción persistente vive en la banda de encabezado de la tarjeta
  (`Actualizar`, `Nueva clínica`, `Filtros`), nunca en una banda a sangre completa.

### Clinic target
`frontend/src/components/dashboard/ClinicPublicProfileCard.tsx`,
`frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`,
`frontend/src/styles/dashboard/mobile-clinic.css:185-198`,
`frontend/src/components/dashboard/StickyActionBar.tsx`,
`frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx`.

### Implementation detail
- **Estados (DIF-034, DIF-035).** El bloque de alerta clínico deja de renderizarse en el
  flujo por encima del contenido. El mensaje de error pasa al subtítulo del encabezado de
  `ModuleCard` con `role="alert"`, y el canvas rinde el mensaje centrado y muted. El
  resultado: la geometría de las bandas no cambia entre estado poblado y estado de error.
  Aplica igualmente a los estados `empty` y `loading`.
- **Scroll (DIF-036).** Retirar el bloque `mobile-clinic.css:185-198` que concede
  `overflow-y: auto` a `.dashboard-module-body` en `operaciones` y `perfil`. Ese bloque
  existe porque el contenido de esos dos módulos desborda su altura asignada; CMP-05
  (métricas de 472 px a 16 px en CLN-001) y CMP-07 (tabs sin envoltura en CLN-004) eliminan
  la causa. **Verificar la premisa antes de retirar la regla**: si tras CMP-05 y CMP-07 el
  contenido sigue desbordando, la salida canónica es paginar o tabular, como hace Admin, no
  reintroducir el scroll.
- **Acciones (DIF-037).** La sticky action bar de CLN-007 (`390 × 89`, a sangre completa)
  se retira. Sus tres destinos ("Ver visitas", "Ver rutas", "Ver métricas") pasan a la banda
  de chips de la tarjeta única que CMP-06 crea para esa superficie.

### Files to modify
```text
frontend/src/components/dashboard/ClinicPublicProfileCard.tsx
frontend/src/components/dashboard/ClinicParticularTokensCard.tsx
frontend/src/components/dashboard/StickyActionBar.tsx
frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx
frontend/src/styles/dashboard/mobile-clinic.css
```

### Files to add
Ninguno.

### Files to delete
Ninguno. `StickyActionBar` puede conservar consumidores desktop no medidos por esta
auditoría; sólo se retira de la cadena mobile clínica.

### Forbidden changes
La gramática de estados de Admin.

### Acceptance criteria
```text
bloques de alerta en flujo == 0 en CLN-004 y CLN-005
desplazamiento de geometría entre estado poblado y estado de error == 0px (±2px)
localScrollers == 0 en las 10 superficies × 6 viewports  (hoy: 1 en CLN-001 @ w360x740)
[data-sticky-action-bar] == 0 nodos en mobile clínico
los 3 destinos de logística siguen alcanzables en <= 1 toque
pageScrollsY == false, pageScrollsX == false (sin cambio)
ADMIN_REGRESSION_GATE PASS
```

### Runtime validation
CLN-001, CLN-004, CLN-005, CLN-007 × 6 viewports, con especial atención a `w360x740`, el
viewport donde hoy aparece el scroll local.

### Automated validation
`e2e:public-clinic`, `e2e:extended`, `e2e:visual-contract`,
`dashboard-logistica-mobile-action-bar-reachability.spec.ts` (realinear en el mismo PR),
`dashboard-clinic-mobile-content-reachability.spec.ts`.

### Dependencies
CMP-04, CMP-06. La retirada del scroll local exige además CMP-05 y CMP-07 fusionados.

### Risk
MEDIUM — retirar un scroll owner sin haber eliminado la causa del desbordamiento produce
clipping de contenido, que `AGENTS.md` §10 prohíbe explícitamente. De ahí la verificación
previa obligatoria.

---

## CMP-11

### Objective
Fijar el orden canónico de bandas G-014 en las superficies que hoy lo invierten o lo tienen
incompleto.

### Differences closed
DIF-042.

### Root causes closed
RC-016.

### Admin canonical reference
Orden medido en 66/66:
`appBar > surfaceHeader > [chips | filters | metrics] > rowsCanvas > pager > bottomNav`.

### Clinic target
`frontend/src/app/dashboard/logistica/visitas/page.tsx:119-130` y homólogos de `rutas` y
`metricas`; `ClinicInformesWorkspaceSummary.tsx`; `ClinicLogisticaWorkspaceSummary.tsx`.

### Implementation detail
- CLN-008/009/010: las métricas dejan de preceder al encabezado. CMP-05 ya las mueve dentro
  del encabezado; este bloque **verifica y fija** el orden resultante y añade el contrato.
- CLN-002/003: pasan a rendir banda de encabezado (título + subtítulo + acción), que hoy no
  tienen, con lo que su orden se completa.
- El orden se valida por geometría (`y` creciente de cada banda), no por orden de aparición
  en el JSX, exactamente como lo midió la auditoría.

### Files to modify
```text
frontend/src/app/dashboard/logistica/visitas/page.tsx
frontend/src/app/dashboard/logistica/rutas/page.tsx
frontend/src/app/dashboard/logistica/metricas/page.tsx
frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx
frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx
```

### Files to add
Ninguno.

### Files to delete
Ninguno.

### Forbidden changes
El orden de bandas de Admin.

### Acceptance criteria
```text
orden de bandas por geometría idéntico al de Admin en las 10 superficies × 6 viewports
surfaceHeader presente en 10/10
ninguna banda de métricas con y < surfaceHeader.y
ADMIN_REGRESSION_GATE PASS
```

### Runtime validation
CLN-002, CLN-003, CLN-008, CLN-009, CLN-010 × 6 viewports.

### Automated validation
`e2e:public-clinic`, `e2e:visual-contract`.

### Dependencies
CMP-05, CMP-09.

### Risk
LOW — en gran parte es consecuencia de CMP-05 y CMP-06; este bloque aporta el contrato.

---

## CMP-12

### Objective
Sustituir los contratos que hoy permiten la divergencia por un contrato de paridad que
enumere el censo completo de superficies clínicas mobile y las compare contra la gramática
de Admin en los 6 viewports.

### Differences closed
Las 42 (como validación, no como implementación).

### Root causes closed
RC-017.

### Admin canonical reference
La gramática G-001…G-015 de §7 de la auditoría, medida en runtime, no transcrita de código.

### Clinic target
`frontend/e2e/clinic/reports/dashboard-clinic-informes-mobile-parity.spec.ts`,
`frontend/e2e/clinic/logistics/dashboard-clinic-logistica-mobile-parity.spec.ts`,
`frontend/e2e/clinic/tokens/dashboard-clinic-tokens-mobile-parity.spec.ts`,
`frontend/e2e/helpers/dashboard-geometry-matrix.ts`,
`frontend/e2e/suites/catalog.ts`.

### Implementation detail
- **Añadir** `frontend/e2e/helpers/mobile-parity-matrix.ts` con:
  - los **6** viewports mobile derivados del repositorio (hoy los specs cubren 3);
  - el censo de las 10 superficies clínicas y las 11 admin, con sus rutas y readiness;
  - el esquema de medición único (el de esta auditoría), sin ninguna variable por rol;
  - el comparador con tolerancias: 2 px estructural, 4 px en cajas de texto rasterizado,
    exacto en valores fijados por Playwright.
- **Añadir** `frontend/e2e/clinic/shell/clinic-mobile-admin-parity-contract.spec.ts`, que
  para cada superficie clínica × cada viewport valida, midiendo **ambos roles en la misma
  corrida**:
  - orden de bandas por geometría;
  - presencia de los hooks `[data-dashboard-module-stage|workspace|viewport]`;
  - `surfaceCount == 1` y cotas `surfaceTop` / `surfaceBottomGap`;
  - `metricsCount == 1`, hook `dashboardB14Metrics` y `height == 16`;
  - `rowPitch == "regular"` y filas con el hook adaptativo;
  - `pagerHeight == 40` y etiqueta con rango + total;
  - `appBarHeight == 48`, 1 acción, sin subtítulo;
  - `bottomNavItemCount == 5`;
  - `pageScrollsY == false`, `pageScrollsX == false`, `localScrollers == 0`;
  - ausencia de overflow horizontal;
  - interacción: tab, pager y diálogo operados con readback.
- **Añadir** `test/architecture/clinic-mobile-admin-parity-census.test.ts`: deriva el censo
  de superficies clínicas de la configuración de rutas — **no** de una lista escrita a mano —
  y falla si existe una superficie clínica mobile sin fila en el contrato de paridad. Este es
  el guard que impide que una superficie nueva nazca divergente.
- **Reescribir** los tres specs "mobile-parity" existentes: hoy miden Clínica contra sí
  misma. Pasan a delegar la parte de paridad en el nuevo contrato y conservan sólo sus
  aserciones de dominio.
- **Realinear** `dashboard-geometry-matrix.ts`: sus selectores de región no resuelven en
  Admin mobile en `HEAD` y su baseline congela la divergencia. Actualizar los selectores a
  los que el runtime usa realmente y recapturar la baseline en el mismo PR que cierre
  CMP-11.
- **Actualizar** `frontend/e2e/suites/catalog.ts` con los specs nuevos y su cohorte. Ojo al
  censo del catálogo: un spec nuevo sin `git add` rompe `e2e:verify-catalog`.

### Files to modify
```text
frontend/e2e/clinic/reports/dashboard-clinic-informes-mobile-parity.spec.ts
frontend/e2e/clinic/logistics/dashboard-clinic-logistica-mobile-parity.spec.ts
frontend/e2e/clinic/tokens/dashboard-clinic-tokens-mobile-parity.spec.ts
frontend/e2e/helpers/dashboard-geometry-matrix.ts
frontend/e2e/suites/catalog.ts
```

### Files to add
```text
frontend/e2e/helpers/mobile-parity-matrix.ts
frontend/e2e/clinic/shell/clinic-mobile-admin-parity-contract.spec.ts
test/architecture/clinic-mobile-admin-parity-census.test.ts
```

### Files to delete
Ninguno.

### Forbidden changes
Los specs de `frontend/e2e/admin/**`, que son la referencia de no-regresión de Admin.

### Acceptance criteria
```text
EVERY_CLINIC_MOBILE_SURFACE_HAS_ADMIN_PARITY_CONTRACT = TRUE
superficies clínicas cubiertas        == 10/10
viewports cubiertos                   == 6/6
combinaciones validadas               == 60
superficies declaradas N/A            == 0
el censo se deriva de rutas, no de lista manual
el contrato falla si se añade una superficie clínica sin fila
ningún assert depende sólo de screenshots
```

### Runtime validation
Las 10 superficies clínicas y las 11 admin × 6 viewports, en una sola corrida.

### Automated validation
`pnpm --dir frontend e2e:verify-catalog`, `e2e:public-clinic`, `e2e:admin-mobile`,
`e2e:extended`, `e2e:visual-contract`, `pnpm validate:local`.

### Dependencies
CMP-01 … CMP-11. El contrato se escribe antes, pero sólo puede quedar en verde al final.

### Risk
MEDIUM — es el bloque que impide la regresión; escrito demasiado pronto bloquea los bloques
anteriores. Recomendación: introducirlo con las aserciones de cada bloque activándose a
medida que ese bloque se fusiona, y no antes.

---

## Notas de ejecución

- **Un bloque = un PR.** Scope primario único, causa única, rollback único (`AGENTS.md` §4).
- Los tres pares de bloques con dependencia dura (CMP-04 → CMP-05/06, CMP-06 → CMP-08/09)
  no pueden solaparse: CMP-04 cambia la tarjeta sobre la que los demás miden.
- Todo PR de este roadmap es **frontend visual** y por tanto (§6 de `AGENTS.md`) exige:
  `pnpm --dir frontend lint` → `typecheck` → `build` → `pnpm security:public-surface` →
  cohorte E2E indicada en cada bloque → revisión de artefactos → `git diff --check`.
- Si se editó CSS global con el dev server caído, borrar `frontend/.next` antes de correr
  Playwright.
- Tras cualquier corrida E2E, verificar que `frontend/next-env.d.ts` no quedó modificado
  antes de correr `pnpm test`, y que no quedan `playwright-report/` ni `test-results/` en el
  diff.
- Tres bloques requieren **decisión explícita de Nico antes de implementar**: CMP-02
  (slot `home`), CMP-05 (qué métricas de dominio) y CMP-07 (paridad literal vs. piso táctil,
  con la opción (ii) tocando Admin y exigiendo autorización).

---

## Estado final (CMP-01…12)

```text
CMP-01  DONE      CMP-05  DONE      CMP-09  DONE
CMP-02  DONE      CMP-06  DONE      CMP-10  DONE
CMP-03  DONE      CMP-07  DONE      CMP-11  DONE
CMP-04  DONE      CMP-08  DONE      CMP-12  DONE

DIF_CLOSED = 42/42   RC_CLOSED = 17/17   FINAL_CLINIC_RUNTIME = 60/60
```

Detalle completo — evidencia runtime, hallazgos reales que el propio contrato de CMP-12
encontró y corrigió (doble borde de pager, selector de pager no compartido, cobertura
parcial de `ModuleMetricRun` en mobile Admin), y pendientes declarados (recaptura de
`dashboard-geometry-matrix.ts`, 273 combinaciones) — en
`docs/audit/AUDITORIA_CAJA_BLANCA_DASHBOARD_CLINICA_MOBILE_VS_ADMIN.md`, §25.

Construido incrementalmente por capas (pilot de 1 superficie → capas A–F → 6 viewports →
10 superficies), nunca como un harness monolítico escrito a ciegas, según el mandato
explícito de esa fase.
