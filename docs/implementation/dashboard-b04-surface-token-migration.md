# B04 — Migración de superficies del dashboard a los tokens B03 y retirada de la elevación del chrome persistente

**Programa B · Nivel 3 · Dependencia: B03 · Cierra el gate G6**

| | |
|---|---|
| Base | `e9d105dec270b1d578ecc50217e3f60ccbf2c86d` (`feat(dashboard): establish B03 foundation tokens (#1660)`) |
| Rama | `feat/dashboard-b04-surface-token-migration` |
| Objetivo roadmap (§49, §54) | «Migrar superficies del dashboard a los tokens; eliminar sombra del chrome persistente» |
| Criterio de cierre | 0 sombras en chrome persistente |
| Gate | **G6** — sin sombra en chrome persistente, exigido antes de B11 |
| Riesgo roadmap | Medio |

---

## 1. Alcance

### Incluido

1. Retirada de **toda elevación del chrome persistente**, cerrando las dos fuentes
   posibles (regla CSS y utilidad Tailwind) en cada anchor.
2. Migración de superficies del dashboard autenticado al foundation B03 en las
   escalas **color**, **shape** y **elevation**.
3. Aplanado de las superficies de contenido estático vivas (audit §45.2: el nivel
   «tarjeta elevada» no se usa en el dashboard).
4. Evolución del contrato B03 de «cero consumidores» a una **frontera B04
   fail-closed**.
5. Contrato de arquitectura B04 nuevo con manifiesto normativo.
6. Gate runtime B04 sobre las **21 superficies canónicas × 2 temas × 2 clases de
   viewport = 84 estados**.
7. Regresión visual **dual** (R9): el spec de píxeles autenticado pasa a capturar
   `normal` y `dark-gray`.

### Excluido deliberadamente

| Fuera de alcance | Motivo |
|---|---|
| **B05** — inversión de superficie (tinte al campo, contenedor transparente) | `--dash-color-field` queda con 0 consumidores; ambos contratos fallan si se consume |
| **B06/B07/B08** — `WorkspaceAppBar`, `NavigationDrawer`, `NavigationRail`, retirada de `DashboardHorizontalNav`/`DashboardModuleRail` | Niveles 4; el diff no crea ni retira ningún componente de navegación |
| **B12** — retirada de la tarjeta de módulo como capa | La estructura DOM se conserva íntegra; B04 sólo cambia su gramática visual |
| Geometría, capacidad, `limit`/`offset`, row pitch | A05–A07 siguen siendo el owner; hash byte-idéntico |
| `globals.css`, `theme.ts`, `theme-init.js`, backend, deps, workflows | Fuera del scope declarado (R2) |
| Clases compartidas con el sitio público (`.surface-soft`, `.surface-empty`, `.surface-note-info`, `[data-auth-login-card]`) | Ver §7 |
| Hairlines de 1 px en **controles** anidados dentro del chrome | Ver §8 |

---

## 2. Hashes de preservación

Metodología idéntica a la documentada en B03: bloque desde el inicio de la línea
del marcador `:start` hasta el `*/` de cierre del marcador `:end`, normalizado a
LF. El hash de *declaraciones* elimina además comentarios y normaliza espacios,
conservando selectores, nombres y valores.

```
FOUNDATION_DECLARATION_HASH_BEFORE = 3f192d6d31f836f724b4b62e30f211594ee7e344e9f60a0e79113d0f2ac75828
FOUNDATION_DECLARATION_HASH_AFTER  = 3f192d6d31f836f724b4b62e30f211594ee7e344e9f60a0e79113d0f2ac75828
FOUNDATION_DECLARATIONS_IDENTICAL  = YES

FOUNDATION_RAW_HASH_BEFORE = 922539c019f2d556e9b43843f284a3735de48418f0deb6d52b4130f2c65bf58f  (208 líneas, 11 142 B)
FOUNDATION_RAW_HASH_AFTER  = 18ef067b2e1c4cad20ebaab7b07f3c17aaefa41b4a043c0181a0e62530f9900d  (218 líneas, 11 863 B)
FOUNDATION_RAW_DELTA       = sólo prosa (§9)

ROW_PITCH_HASH_BEFORE = f76d889cc2a19a10ac45abb7cb709ffaada744aca553c81e7010b3fd65044093
ROW_PITCH_HASH_AFTER  = f76d889cc2a19a10ac45abb7cb709ffaada744aca553c81e7010b3fd65044093
ROW_PITCH_BYTE_IDENTICAL = YES  (136 líneas, 6 015 B)
```

Ambos hashes están **congelados dentro del contrato B04**, de modo que un cambio
en una declaración del foundation o en un literal px del pitch falla el gate en
lugar de quedar sólo documentado aquí.

---

## 3. Censo de sombras — ANTES

33 declaraciones `box-shadow` en `frontend/src/styles/dashboard/**`, más las
utilidades Tailwind de los componentes. Clasificación completa:

### A · PERSISTENT_CHROME (elevación → none)

| Archivo | Selector / componente | Valor antes | Acción |
|---|---|---|---|
| `layout.css:155` | `.dashboard-app-shell::before` | `inset 0 1px 0 …, 0 0 0 1px …, 0 18px 70px rgba(15,45,62,0.1)` | → `var(--dash-elevation-none)` |
| `layout.css:92` | `.dashboard-module-tab[aria-selected="true"]` | `0 8px 20px rgba(15,45,62,0.18)` | → `var(--dash-elevation-none)` |
| `surfaces.css:26` | `[data-dashboard-topbar-polish="true"]` | `0 10px 28px rgba(15,45,62,0.07)` | → `var(--dash-elevation-none)` |
| `surfaces.css:32` | `[data-dashboard-sidebar-polish="true"]` | `12px 0 38px rgba(8,35,50,0.22)` | → `var(--dash-elevation-none)` · anchor sin consumidor desde B02 |
| `DashboardTopbar.tsx:103` | `<header>` | `shadow-sm` | utilidad **eliminada** |
| `FilterBar.tsx:21` | variante `comfortable` | `shadow-[var(--clinical-shadow-sm)]` | utilidad **eliminada** |
| `StickyActionBar.tsx:55` | `<section>` | `shadow-md` + `md:shadow-sm` | utilidades **eliminadas** |
| — | `[data-dashboard-horizontal-nav-shell]`, `[data-dashboard-module-rail]`, `[data-dashboard-filter-bar]`, `[data-sticky-action-bar]`, ambas bottom nav | sin declaración | → bloque B04 nuevo, `var(--dash-elevation-none)` |

### B · STATIC_CONTENT_SURFACE (aplanadas; audit §45.2)

| Archivo | Selector | Valor antes | Acción |
|---|---|---|---|
| `navigation.css:104` | `.dashboard-master-panel` | `inset 0 1px 0 …, 0 8px 22px …` | → `var(--dash-elevation-none)` |
| `shell.css:33` | `.dashboard-cockpit-launcher` | `inset 0 1px 0 …, 0 18px 48px …` | → `var(--dash-elevation-none)` |
| `shell.css:69` | `.dashboard-cockpit-tile` | `inset 0 1px 0 …, 0 10px 26px …` | → `var(--dash-elevation-none)` |
| `shell.css:78` | `.dashboard-cockpit-tile:hover` | `inset 0 1px 0 …, 0 16px 38px …` | declaración retirada; el hover se lee por `border-color` |

### C · TRANSIENT_OVERLAY (conservan sombra — G6 no las toca)

| Archivo | Selector | Estado |
|---|---|---|
| `navigation.css:137` | `.dashboard-filter-panel` | conservado (`-14px 0 44px`) — sombra **direccional** de drawer, no expresable por la escala no-direccional |
| `mobile-admin.css:212` | `.admin-mobile-kebab-menu` | conservado |
| `mobile-admin.css:325` | `.admin-mobile-module-menu` | conservado |

### D · FOCUS_INDICATOR (conservados íntegros)

| Archivo | Selector | Estado |
|---|---|---|
| `navigation.css:84` | `.dashboard-module-rail-tab:focus-visible` | doble anillo conservado; el anillo exterior adopta `var(--dash-color-surface)` (equivalente exacto de `hsl(var(--card))`) |
| `mobile-clinic.css:205` | `.clinic-mobile-bottom-nav-item:focus-visible` | intacto |

### E · DECORATIVE_NON_ELEVATION (conservadas)

Halos de icono teñidos por el propio gradiente del elemento, no niveles de la
escala: `shell.css:93` (`.dashboard-cockpit-tile-icon`), `surfaces.css:340`
(`.clinic-hub-tile-icon`) y los cinco acentos por módulo de
`surfaces.css:508–536`. También `surfaces.css:122/127`
(`.dashboard-status-dot`), que es un anillo de estado.

### F · OUT_OF_SCOPE

`surfaces.css:85` `[data-auth-login-card="true"]` — superficie de login.

### G · Sin consumidor en runtime (no migradas)

`.dashboard-detail-panel`, `.dashboard-filter-panel`, `.dashboard-hub-band`,
`.dashboard-kpi-chip`, `.dashboard-status-dot`, `.clinic-hub-*`: verificado con
`git grep` sobre `frontend/src` excluyendo `styles/`. Su retirada es limpieza de
CSS muerto (precedente B02), no B04.

---

## 4. Inventario de chrome persistente — DESPUÉS

| Anchor | Fuente CSS | Fuente Tailwind | Computed |
|---|---|---|---|
| `[data-vetneb-app-shell]::before` | `--dash-elevation-none` | — | `none` |
| `header[data-dashboard-topbar-polish="true"]` | `--dash-elevation-none` | eliminada | `none` |
| `[data-dashboard-horizontal-nav-shell]` | `--dash-elevation-none` | — | `none` |
| `[data-dashboard-module-rail]` | `--dash-elevation-none` | — | `none` |
| `[data-admin-mobile-bottom-nav]` | `--dash-elevation-none` | — | `none` |
| `[data-clinic-mobile-bottom-nav]` | `--dash-elevation-none` | — | `none` |
| `[data-dashboard-filter-bar]` | `--dash-elevation-none` | eliminada | `none` |
| `[data-sticky-action-bar]` | `--dash-elevation-none` | eliminadas (mobile + `md:`) | `none` |
| `.dashboard-module-tablist` / `.dashboard-module-tab[aria-selected]` | `--dash-elevation-none` | — | `none` |

```
PERSISTENT_ELEVATION_SHADOWS_AFTER = 0   (verificado en runtime, 84 estados)
```

El bloque nuevo `dashboard-b04-persistent-chrome` en `surfaces.css` es
**unlayered** a propósito: las utilidades Tailwind resuelven en
`@layer utilities` y ganan a `@layer components`, así que una utilidad
`shadow-*` reintroducida sobre uno de estos anchors no puede restaurar la
elevación en silencio. Aun así las utilidades se eliminaron en origen: §16 exige
cerrar **ambas** fuentes, no una.

---

## 5. Mapa de migración de tokens

Regla aplicada: `CURRENT → SEMANTIC ROLE → B03 TOKEN`, y **sólo cuando el valor
resuelto es equivalente exacto**. Ningún token se eligió por proximidad numérica.

| Antes | Rol semántico | Token B03 | Equivalencia | Archivo |
|---|---|---|---|---|
| `hsl(var(--vetneb-surface-raised))` | surface raised | `--dash-color-surface-raised` | exacta | `layout.css`, `surfaces.css` |
| `hsl(var(--vetneb-surface))` | canvas | `--dash-color-canvas` | exacta | `layout.css`, `surfaces.css` |
| `hsl(var(--vetneb-surface-muted))` | surface muted | `--dash-color-surface-muted` | exacta | `layout.css`, `surfaces.css` |
| `hsl(var(--muted-foreground))` | muted on-surface | `--dash-color-on-surface-muted` | exacta | `layout.css` |
| `hsl(var(--primary-foreground))` | on-primary | `--dash-color-on-primary` | exacta | `layout.css` |
| `hsl(var(--vetneb-teal))` | accent | `--dash-color-accent` | exacta | `navigation.css` |
| `hsl(var(--card))` | surface | `--dash-color-surface` | exacta | `navigation.css` (anillo de foco) |
| `0.5rem` | shape sm | `--dash-shape-sm` | exacta | `layout.css`, `navigation.css` |
| `0.6rem` | shape md | `--dash-shape-md` | exacta | `shell.css` |
| `0.85rem` | shape xl | `--dash-shape-xl` | exacta | `shell.css` |
| `1.1rem` | shape 2xl | `--dash-shape-2xl` | exacta | `shell.css` |
| sombras de chrome/contenido | elevation none | `--dash-elevation-none` | intencional (G6) | 5 archivos |

### Mapeos evaluados y NO aplicados

| Literal | Token candidato | Por qué no |
|---|---|---|
| `hsl(var(--vetneb-navy))` | `--dash-color-primary` | `--primary` es `207 72% 30%` y `--vetneb-navy` es `207 72% 22%` (claro) / `205 62% 44%` vs `205 58% 68%` (oscuro). El rol existe, pero adoptarlo es una **decisión visual** que exige baselines duales de píxeles, hoy bloqueados (§11). No es un hueco del foundation. |
| Bordes con alfa (`/0.7 … /0.88`) | `--dash-color-outline` (α 1) o `--dash-color-outline-subtle` (α 0.42) | Ninguno reproduce las alfas medidas; estandarizarlas aclararía o marcaría **todos** los bordes del dashboard a la vez. Misma razón: requiere revisión visual con evidencia Linux. |
| Fondos con alfa dentro de gradientes (`hsl(var(--card) / 0.97)`) | `--dash-color-surface` | El token ya envuelve `hsl()`; no admite alfa sin perder el valor medido. |

**Ningún `B03 FOUNDATION GAP` detectado.** Todos los roles necesarios para B04
son expresables con los 73 tokens existentes.

---

## 6. Consumidores del foundation — DESPUÉS

```
CONSUMER_FILES = 4    (todos bajo frontend/src/styles/dashboard/)
CONSUMER_SITES = 20
```

| Token | Categoría | Sitios | Archivos |
|---|---|---|---|
| `--dash-elevation-none` | elevation | 9 | `layout.css`, `navigation.css`, `shell.css` ×2, `surfaces.css` ×3 |
| `--dash-color-canvas` | color | 2 | `layout.css`, `surfaces.css` |
| `--dash-color-surface-raised` | color | 2 | `layout.css`, `surfaces.css` |
| `--dash-color-surface-muted` | color | 2 | `layout.css`, `surfaces.css` |
| `--dash-color-surface` | color | 1 | `navigation.css` |
| `--dash-color-on-surface-muted` | color | 1 | `layout.css` |
| `--dash-color-on-primary` | color | 1 | `layout.css` |
| `--dash-color-accent` | color | 1 | `navigation.css` |
| `--dash-shape-sm` | shape | 2 | `layout.css`, `navigation.css` |
| `--dash-shape-md` | shape | 1 | `shell.css` |
| `--dash-shape-xl` | shape | 1 | `shell.css` |
| `--dash-shape-2xl` | shape | 1 | `shell.css` |

### `UNUSED_AFTER_B04`

61 de los 73 tokens siguen sin consumidor: las escalas **state-layer**,
**spacing**, **density**, **typography** y **motion** completas, más los roles de
color y shape no alcanzados por estas superficies y los tres niveles de elevación
elevados.

**No se elimina ninguno.** B03 cerró su foundation y B04 migra superficies, no
toda la aplicación. Dos casos merecen mención explícita:

- **`--dash-elevation-raised`**: queda sin consumidor **a propósito**. El audit
  §45.2 marca el nivel «tarjeta elevada» como *no usar en dashboard*, así que una
  superficie de contenido estático se aplana en vez de adoptarlo.
- **`--dash-color-field`**: reservado para B05.

```
B05_FIELD_TOKEN_CONSUMERS = 0   (obligatorio; asertado en ambos contratos)
```

---

## 7. Clases compartidas con el sitio público — exclusión con causa

`.surface-soft`, `.surface-empty` y `.surface-note-info` reciben overrides en
`surfaces.css`, pero su regla base vive en `globals.css` y las consumen también
`frontend/src/components/public/**` (Particulares, Precios, Profesionales…).

Los tokens del foundation se declaran **únicamente** sobre `.dashboard-app-shell`.
Migrar esas clases habría hecho que sus referencias resolvieran a *nada* en toda
la web pública. Quedan fuera de B04 por corrección, no por comodidad, y la
frontera está asertada: el contrato B03 falla si un token del foundation aparece
fuera de `styles/dashboard/`, `components/dashboard/` o `app/dashboard/`.

---

## 8. Hairlines de control — frontera declarada

Los controles interactivos anidados dentro del chrome conservan un hairline de
1 px (`shadow-sm`, `shadow-[0_1px_2px_rgba(15,45,62,0.05)]`), que funciona como
sustituto de borde sobre un control y no como nivel de la escala de elevación:

| Path | Control |
|---|---|
| `DashboardTopbar.tsx:147` | botón «Cerrar sesión» |
| `DashboardNotificationsBell.tsx:468` | botón de notificaciones |
| `DashboardModuleRail.tsx:74` | flechas del rail |
| `DashboardPager.tsx:94` | botones del pager |
| `informes/page.tsx:173,248`, `InformesReportsList.tsx:643,658`, `logistica/{metricas,rutas,visitas}/page.tsx` | botones de paginación por ruta |
| `AdminFailedLoginAlertsReadOnlyCard.tsx:283` | acción de la tarjeta |

B04 migra **superficies** (§21). Estos hairlines se enumeran aquí para que no
queden ni aplanados en silencio ni olvidados; su resolución corresponde al
trabajo de controles/densidad. La nota de alcance vive también en el contrato
B04, junto al test que la implementa.

---

## 9. Preservación semántica de `tokens.css`

Se actualizó **sólo prosa**, en tres comentarios que habían quedado falsos:

1. La cabecera del bloque decía «consumed by nobody yet» y describía la aserción
   de cero consumidores. Ahora describe la frontera que la sustituye.
2. El comentario de `--dash-color-field` declara explícitamente la reserva B05.
3. El comentario de la escala de elevación registra que `none` ya se consume y
   que `raised` queda sin consumidor a propósito.

Ninguna declaración cambió: `FOUNDATION_DECLARATION_HASH` es idéntico (§2).

---

## 10. Contratos

### 10.1 Evolución del contrato B03

`test/architecture/dashboard-foundation-tokens.test.ts` — **19 → 21 tests**.

El test «the foundation has zero consumers outside its own declaration» dejó de
ser cierto por construcción. **No se borró, ni se saltó, ni se relajó a “hay
algún consumidor”**: se sustituyó por una frontera de dos lados.

| Test nuevo | Qué prueba |
|---|---|
| `the foundation is genuinely consumed after B04` | Hay consumidores **y** cubren ≥ 3 categorías (color, shape, elevation). Un revert silencioso de B04 no puede pasar como «sigue bien» |
| `every foundation consumer stays inside the authenticated dashboard` | Todo consumidor vive bajo `styles/dashboard/`, `components/dashboard/` o `app/dashboard/` — los tres árboles que renderizan dentro de `.dashboard-app-shell`, el único elemento donde el foundation está declarado |
| `the B05 field token is still reserved after B04` | `--dash-color-field` sigue con 0 consumidores |

Los 18 tests restantes (owner único de las declaraciones, scoping al shell,
clasificación de temas, resolución de fingerprints claro/oscuro, preservación del
pitch) se conservan sin cambios.

### 10.2 Contrato B04 nuevo

`test/architecture/dashboard-b04-surface-token-migration.test.ts` — **12 tests**,
fail-closed en ambos sentidos, con manifiesto normativo de 13 entradas
(`path` · `anchor` · `role` · `expectedTokens` · `elevation` · `why`) leído
contra el **source real**, nunca contra una segunda lista escrita a mano.

| # | Invariante |
|---|---|
| T0a | Cada anchor del manifiesto resuelve a **exactamente una** regla real |
| T0b | El manifiesto cubre las cuatro clasificaciones (un gate que sólo lista lo que aplana no puede demostrar que no se pasó de largo) |
| T1 | Cada regla migrada consume los tokens esperados |
| T2 | La migración cubre elevation + color + shape |
| T3 | Ninguna regla de chrome/contenido declara un literal de elevación |
| T4 | Ningún componente de chrome conserva una utilidad `shadow-*` (className completo pinneado) |
| T5 | Todo anchor de chrome persistente está direccionado por la política de elevación |
| T6 | Overlays transitorios y anillos de foco **conservan** su sombra |
| T7 | Ningún selector migrado reintroduce un `box-shadow` adicional |
| T8 | `--dash-color-field` sin consumidores |
| T9 | `FOUNDATION_DECLARATION_HASH` intacto |
| T10 | `ROW_PITCH_HASH` byte-idéntico |

---

## 11. Gate runtime B04 — 21 superficies, ambos temas

`frontend/e2e/regression/dashboard-b04-surface-token-migration.spec.ts`

| Dimensión | Valor |
|---|---|
| Superficies | 21 — desde `DASHBOARD_GEOMETRY_SURFACES`, el **mismo owner** que A02 y A08; no se duplica la matriz |
| Anchors | desde `DASHBOARD_PERSISTENT_CHROME`, export nuevo del helper derivado de `SHELL_SELECTORS`, para que el contrato estático y el runtime no vigilen inventarios distintos |
| Temas | `normal` + `dark-gray` (R9) |
| Viewports | `1366×768` (peor ratio de chrome, P1-19) y `390×844` (modelo mobile) |
| **Estados** | **21 × 2 × 2 = 84** |
| Fixture | `admin-populated-api-server` (hermético, ya existente) |
| Cohortes | `visual-contract` → `ci`, `full` · criticidad P1 |

El tema se escribe **pre-paint** en `localStorage[THEME_STORAGE_KEY]`, importando
los literales de `frontend/src/lib/theme.ts` (sin segundo mecanismo de tema), y
se asserta `documentElement.dataset.theme` **antes** de leer nada: no se pulsa el
toggle, para no medir un frame intermedio.

`readsAsElevation()` es conservador a propósito: `none` y las capas totalmente
transparentes (lo que emite `shadow-none` de Tailwind) cuentan como planas;
cualquier sintaxis que el parser no entienda se trata como **elevada**, de modo
que falla el gate en vez de colarse.

Las dos clases de viewport son necesarias, no decorativas: el nav horizontal es
`md:block`, las bottom nav son sólo mobile y la StickyActionBar es `fixed` por
debajo de `md` y `sticky` por encima. Una sola clase dejaría medio chrome sin
observar.

---

## 12. Controles de mutación

Ejecutados sobre **copia aislada** (`scratchpad/mut/`), nunca sobre source
trackeado. Baseline y estado restaurado en PASS en ambos extremos.

| # | Mutación | Contrato | Resultado |
|---|---|---|---|
| M1 | Reintroducir `shadow-sm` en `DashboardTopbar` | B04 | **FAIL** ✅ |
| M2 | Reintroducir literal de elevación en el frame del app-shell | B04 | **FAIL** ✅ |
| M3 | Cambiar chrome persistente a `--dash-elevation-menu` | B04 | **FAIL** ✅ |
| M4a | Consumir `--dash-color-field` | B04 | **FAIL** ✅ |
| M4b | Consumir `--dash-color-field` | B03 | **FAIL** ✅ |
| M5 | Consumir un token del foundation desde un path público | B03 | **FAIL** ✅ |
| M6 | Revertir un selector migrado a su valor legacy | B04 | **FAIL** ✅ |
| M7 | Alterar una declaración del foundation | B04 | **FAIL** ✅ |
| M8 | Alterar un literal px del row pitch | B04 | **FAIL** ✅ |

### M9 — mutación runtime

Harness aislado (`frontend/.b04-mutation-tmp/`, copia del spec + config propio,
eliminado tras la ejecución), restaurando por init-script una sombra de elevación
sobre `[data-dashboard-topbar-polish]`.

**FAIL** ✅ — y el fallo enumera los **4 estados** (`normal`/`dark-gray` ×
`w1366x768`/`w390x844`), lo que demuestra además que el gate observa realmente el
anchor y no pasa en vacío.

---

## 13. Validaciones

| Gate | Estado | Detalle |
|---|---|---|
| Contrato B03 dirigido | **PASSED** | 21/21 |
| Contrato B04 dirigido | **PASSED** | 12/12 |
| Grupo de arquitectura (5 specs) | **PASSED** | 61/61 |
| Unit tests afectados (8 specs) | **PASSED** | 115/115 |
| `pnpm validate:local` | **PASSED** | exit 0 · 4 228 pass / 1 skip |
| `pnpm --dir frontend lint` | **PASSED** | |
| `pnpm --dir frontend typecheck` | **PASSED** | |
| `pnpm --dir frontend build` | **PASSED** | exit 0 |
| `pnpm security:public-surface` | **PASSED** | sin hallazgos de exposición |
| `pnpm --dir frontend e2e:verify-catalog` | **PASSED** | 6/6 tras realinear el censo |
| `git diff --check` | **PASSED** | |

### Cohortes E2E

| Cohorte | Estado | Detalle |
|---|---|---|
| `e2e:visual-contract` | **PASSED** | 319/319, exit 0. Incluye el gate B04 nuevo (21 tests) y A08 zero-scroll (21 superficies × 13 viewports) |
| Gate B04 dirigido | **PASSED** | 21/21 — 84 estados contractuales |
| `e2e:extended` | **PASSED con 1 reintento** | 236 passed / 1 failed en la corrida de cohorte. El fallo fue `A05 · informes-reports-list` con `timed out after 30000ms waiting for 1 data request(s) to finish` — una **parada de transporte** bajo carga paralela, no un desajuste de `limit`. Re-verificado **aislado: PASSED** (exit 0) con `limit` estable en las tres reservas 32/48/64 de los 13 viewports. Incluye `dashboard-zero-scroll-mobile-boundary` en verde |
| `e2e:smoke` | **PASSED** | 48/48, exit 0 |
| `theme-mode.spec.ts` (dirigido) | **PASSED** | 2/2 — toggle, persistencia y aplicación pre-hidratación |

**Nota de entorno.** Una primera corrida de `e2e:visual-contract` con workers por
defecto produjo un `net::ERR_NO_BUFFER_SPACE` (agotamiento de sockets de
Windows) en un spec que pasó aislado; la corrida canónica registrada arriba se
hizo con `--workers=2` y quedó limpia. Ambos incidentes son de recursos de la
máquina, no de contrato, y ninguno se contabiliza como PASSED sin la
verificación aislada correspondiente.

### Preservación demostrada por las cohortes

`e2e:extended` ejecuta **A02** (geometría congelada, 21 × 13) y **A03**
(matriz `limit`/`offset`, 15 × 13) además de **A05**: los tres pasaron. Es la
evidencia más fuerte de que B04 no movió geometría ni capacidad — no sólo que el
diff no contiene propiedades de layout, sino que las líneas base congeladas
siguen coincidiendo.

### Tests realineados en el mismo PR (nunca debilitados)

| Test | Antes | Después | Motivo |
|---|---|---|---|
| `frontend-visual-consistency.test.ts:353` | className de la topbar **con** `shadow-sm` | className **sin** `shadow-sm` | B04 retira la elevación de la banda. Se sigue pinneando el className **completo**, así que un restyle silencioso sigue fallando |
| `e2e-suite-catalog-completeness.test.ts` | 79 specs · regression 10 · visual-contract 12 · ci 45 · full 79 | 80 · 11 · 13 · 46 · 80 | Spec B04 nuevo catalogado |
| `e2e-completeness-workflow.test.ts:179` | `E2E_SUITE_CATALOG.length === 79` | `=== 80` | Idem |

Ninguna aserción se borró, se saltó ni se marcó como `todo`.

---

## 14. Regresión visual dual (R9)

`frontend/e2e/regression/visual/visual-regression-authenticated.spec.ts`

```
DUAL_PIXEL_SPEC        = IMPLEMENTED
LINUX_SNAPSHOT_UPDATE  = BLOCKED
LINUX_SNAPSHOT_VERIFY  = BLOCKED
```

- 2 rutas × 5 viewports × 2 temas = **20 baselines** esperados.
- Los **10 nombres `normal` existentes se conservan** (`dashboard-320.png`,
  `admin-dashboard-320.png`, …) para que el diff los muestre como *modificados*
  —el delta visual intencional de B04— y no como 10 renombres más 10 altas. Sólo
  el set oscuro lleva sufijo: `dashboard-dark-gray-320.png`, etc.
- El tema se establece pre-paint y se assertea antes de capturar.
- `test.skip` de plataforma **sin tocar**: los baselines siguen siendo canónicos
  sólo para Chromium Linux. `maxDiffPixelRatio` **sin relajar** (0.001).

### Motivo del bloqueo

```
node -p "process.platform"  →  win32
```

El runner rechaza deliberadamente producir baselines fuera de Linux, y este
entorno no dispone de un Linux canónico con el Chromium/Playwright del repo. Por
tanto **no se generó, renombró ni copió ningún PNG**.

```
SNAPSHOT_PATHS_CREATED  = 0
SNAPSHOT_PATHS_MODIFIED = 0
```

**Camino posterior autorizado (NO ejecutado — es GitHub write / R2):**
`.github/workflows/visual-regression-manual.yml` con `suite=authenticated` y
`update_snapshots=true`, para producir el artifact Linux. Requiere autorización
específica de Nico.

**Consecuencia: B04 NO se publica.** El spec dual está modificado pero sus
baselines Linux faltan.

---

## 15. Preservación verificada

| Invariante | Estado |
|---|---|
| A05–A07 capacity / row pitch | Hash byte-idéntico; el bloque no se tocó |
| A08 zero-scroll | `dashboard-zero-scroll-baseline` PASSED (21 superficies × 13 viewports = 273) |
| Navegación y deep links `?module=` | Sin cambios; `dashboard-card-navigation-shell` PASSED |
| DOM funcional / estructura de componentes | Sin cambios: el diff de `.tsx` sólo altera strings de `className` |
| Geometría operativa | Ninguna propiedad de `height`/`width`/`grid`/`flex-basis`/`overflow`/`position`/`inset`/`limit`/`offset` aparece en el diff |
| API / auth / security | 0 archivos tocados |
| Foco visible | Conservado y asertado (T6) |

```
GEOMETRY_OR_RUNTIME_STRUCTURE_CHANGED = NO
BACKEND / DB / DEPS / WORKFLOWS        = 0 archivos
```

---

## 16. Archivos modificados

**Runtime (7)**

```
frontend/src/styles/dashboard/layout.css
frontend/src/styles/dashboard/navigation.css
frontend/src/styles/dashboard/shell.css
frontend/src/styles/dashboard/surfaces.css
frontend/src/styles/dashboard/tokens.css          (sólo prosa)
frontend/src/components/dashboard/DashboardTopbar.tsx
frontend/src/components/dashboard/FilterBar.tsx
frontend/src/components/dashboard/StickyActionBar.tsx
```

**E2E (4)**

```
frontend/e2e/regression/dashboard-b04-surface-token-migration.spec.ts   (nuevo)
frontend/e2e/regression/visual/visual-regression-authenticated.spec.ts
frontend/e2e/helpers/dashboard-geometry-matrix.ts                       (export añadido)
frontend/e2e/suites/catalog.ts
```

**Contratos y tests (5)**

```
test/architecture/dashboard-b04-surface-token-migration.test.ts         (nuevo)
test/architecture/dashboard-foundation-tokens.test.ts
test/architecture/e2e-suite-catalog-completeness.test.ts
test/unit/infrastructure/e2e-completeness-workflow.test.ts
test/unit/ui/frontend/frontend-visual-consistency.test.ts
```

**Documentación (1)**

```
docs/implementation/dashboard-b04-surface-token-migration.md            (este archivo)
```

---

## 17. Delta visual esperado

**Esperado:**

- Desaparece la elevación del chrome persistente: frame del shell, topbar, nav
  horizontal, rail, bottom navs, barra de filtros, barra de acciones y tira de
  tabs.
- Desaparece la elevación de las superficies de contenido estático vivas: panel
  master, launcher y tiles del hub admin (incluido el realce de hover, que pasa a
  leerse sólo por `border-color`).
- El frame del app-shell pierde también su realce interior y su anillo hairline;
  el borde visible (`border: 1px solid`) —la propiedad que assertea el contrato
  de visibilidad— se conserva.
- Las superficies adaptan claro/oscuro a través de B03 en vez de heredar la
  paleta global.

**NO esperado** (cualquier aparición debe investigarse): movimiento de regiones,
cambios de tamaño, pérdida de contenido, cambios de navegación, clipping, capas
nuevas, inversión de campo (B05), app bar (B06), retirada de la tarjeta de módulo
(B12).

---

## 18. Rollback

Revert único del commit/PR B04. Restaura la gramática de superficie legacy, las
sombras del chrome persistente, la fase «cero consumidores» de B03 y el spec de
píxeles mono-tema. Sin impacto de datos, sin migraciones, sin dependencias.

---

## 19. Riesgos residuales

| # | Riesgo | Mitigación / estado |
|---|---|---|
| R1 | **Baselines Linux ausentes.** El spec dual está modificado sin sus 20 PNG canónicos | **BLOQUEANTE de publicación.** Requiere autorización específica para `visual-regression-manual` |
| R2 | El delta visual (retirada de elevación) no ha sido revisado por un humano lado a lado | Audit §57 exige aprobación manual; pendiente de la evidencia Linux |
| R3 | Hairlines de control de 1 px siguen presentes en el chrome | Enumerados en §8 y en el contrato; ni aplanados ni olvidados |
| R4 | `--vetneb-navy` y las alfas de borde siguen sin tokenizar | §5 documenta por qué; requiere decisión visual con evidencia |
| R5 | CSS muerto (`clinic-hub-*`, `dashboard-hub-band`, `dashboard-kpi-chip`, `dashboard-detail-panel`, `dashboard-filter-panel`, `dashboard-status-dot`) conserva literales de elevación | Sin consumidor en runtime; retirada = limpieza tipo B02, PR aparte |
| R6 | `[data-dashboard-sidebar-polish]` se aplanó siendo un anchor muerto | Efecto visual nulo hoy; evita que la banda vuelva elevada si se reutiliza |
| R7 | El contrato B04 pinnea classNames completos de 3 componentes | Deliberado: un restyle silencioso debe fallar. Un cambio legítimo realinea el manifiesto |

---

## 20. Estado

```
B04 IMPLEMENTATION COMPLETE — LINUX DUAL VISUAL BASELINES BLOCKED — DO NOT PUBLISH
```

Sin `git add`, sin commit, sin push, sin PR. Ninguna operación R2/R3 ejecutada.
