# B06 — WorkspaceAppBar (nivel 4 del shell del dashboard)

## 1. Estado base

| Dato | Valor |
|---|---|
| Rama | `feat/dashboard-b06-workspace-app-bar` |
| HEAD/base | `161c134b94d4664b313a7a7de59e670a8fd41c4a` (main canónico post-PR #1664) |
| Worktree al iniciar | limpio, sin staged, sin stashes |
| AGENTS aplicables | `AGENTS.md` raíz (único; `git ls-files "*AGENTS.md"` no devuelve anidados) |
| Plataforma | Win32 · Chromium · PNPM |

## 2. Scope

Incluido:

- `frontend/src/components/dashboard/WorkspaceAppBar.tsx` (nuevo, presentation-pure).
- `frontend/src/components/dashboard/DashboardTopbar.tsx` (orquestador; pasa slots).
- `frontend/src/features/dashboard/config/dashboardModules.ts` (`ADMIN_MODULE_NAV_LABELS`).
- `frontend/src/features/dashboard/presentation/shell/index.ts` (re-export del barrel B01).
- `frontend/src/styles/dashboard/tokens.css` (ledger `--dash-app-bar-h` / `--dash-app-bar-band`).
- `frontend/src/styles/dashboard/layout.css` (aplicación de la banda).
- `frontend/e2e/regression/dashboard-b06-workspace-app-bar.spec.ts` (contrato runtime 21×13).
- `frontend/e2e/suites/catalog.ts` (alta del spec) y los censos que ese alta desalinea.
- `test/architecture/dashboard-b06-workspace-app-bar.test.ts` (contrato estático).

No-alcance explícito:

- B07 (drawer/rail), **B08** (retiro de `DashboardHorizontalNav`), **B09** (unificación mobile),
  B10–B12. El nav horizontal y las bottom nav quedan intactos.
- Backend, DB, dependencias, lockfile, workflows.
- Recaptura de A02 (ver §10).
- Limpieza de las superficies subordinadas contradictorias (ver §11).

## 3. Auditoría previa (medida, no inferida)

Censo real antes de editar:

- **Consumidores de `DashboardTopbar`**: 7 rutas (`app/dashboard/page.tsx`,
  `app/dashboard/admin/page.tsx`, `app/dashboard/informes/page.tsx`,
  `app/dashboard/logistica/page.tsx` + `metricas`, `rutas`, `visitas`), más
  1 referencia CSS (`styles/dashboard/surfaces.css`) y 11 tests de invariante de
  fuente en `test/`.
- **Superficies de shell**: las 21 canónicas de
  `frontend/e2e/helpers/dashboard-geometry-matrix.ts` (11 admin + 10 clínica),
  × 13 viewports = 273 combinaciones. A02, A08, B04 y ahora B06 comparten esa
  matriz; B06 no declara un segundo censo.
- **Variables que reservan la banda**: `--dash-header-h` (responsive.css, con
  escalones 4.5rem / 4rem / 3.6rem), `--dash-topbar-h` (zero-scroll.css, alias
  del anterior) y `--admin-mobile-appbar-h` (mobile-admin.css).
- **Cómo se calcula el canvas**: el ledger CSS es descriptivo; la geometría real
  es la cadena flex `shell h-dvh → header shrink-0 → main flex-1 → module stage →
  canvas`. `useDashboardCanvasCapacity` mide el **content box** del canvas con un
  `ResizeObserver` y `computeCapacity` resuelve
  `floor((canvas − reserved + gap) / (pitch + gap))`.
- **Cómo A03 deriva `limit`/`offset`**: `limit = capacity` medida;
  `offset = limit` tras el click en «siguiente»; `secondPageCount` es el render
  convergido de la página 2. Es decir: **`limit` es función directa de la altura
  del app bar**.

### Geometría pre-B06 (medición runtime, 234 hojas)

| Viewport | header | app bar (fila) | nav |
|---|---|---|---|
| 8 viewports ≥768px (admin) | 92.328 / 105.109 px* | **54.328** | 37 |
| 8 viewports ≥768px (clínica) | 55.328 / 68.109 px* | **54.328** | — |
| 5 viewports <768px (admin) | 44 | **44** | — |
| 5 viewports <768px (clínica) | 53 | **52** | — |

\* el valor mayor corresponde al escalón compacto `@media (max-height: 760px)`,
que añade `padding-block: 0.4rem` al `<header>`.

## 4. Arquitectura elegida

```
DashboardTopbar  (orquestador, importa @/lib/api)
  └── <header data-dashboard-topbar-polish>      ← banda de chrome, borde 1px
        ├── <WorkspaceAppBar>                    ← B06, presentation-pure
        │     ├── {identity}    slot renderizado por el orquestador
        │     ├── WorkspaceModuleSearch          ← búsqueda global (interna, pura)
        │     └── <div data-dashboard-desktop-actions>
        │            {actions} {notifications} {account}
        │     └── {overflow}
        └── <DashboardHorizontalNav />           ← intacto (B08 lo retira)
```

- `WorkspaceAppBar` **no** importa `@/lib/api` ni `@/app` en ningún punto de su
  cierre de imports; logout, invalidación de sesión, campana, tema y kebab
  llegan ya renderizados como slots. Por eso puede exponerse en
  `features/dashboard/presentation/shell`, y `DashboardTopbar` sigue fuera.
- La implementación se queda en `@/components/dashboard/*`: mover el archivo
  rompería los guardrails de invariante de fuente que anclan el chrome (B01).

## 5. Contrato WorkspaceAppBar

| Propiedad | Valor |
|---|---|
| Altura objetivo | `--dash-app-bar-h: 56px` |
| Tolerancia | `--dash-app-bar-band: 2px` → banda `[54, 58]` |
| Ancho | 100% |
| Radius | `var(--dash-shape-none)` = 0 |
| Elevación | `var(--dash-elevation-none)` = ninguna |
| Borde inferior | 1px, el del `<header>` (rol outline); B06 no añade un segundo |
| Filas | una |
| Temas | claro y `dark-gray`, ambos aserrados |
| Contenido | identity · global search · actions · notifications · account (+ overflow) |

**La banda se declara como `min-block-size`/`max-block-size`, nunca como altura
fija.** Esa decisión es la que preserva A03 (§7).

## 6. Semántica de la búsqueda global

- Corpus: el catálogo canónico de módulos (`ADMIN_MODULE_NAV_LABELS` /
  `CLINIC_MODULE_NAV_LABELS`). Sin endpoint nuevo, sin ranking, sin full-text,
  sin dependencias.
- Filtrado insensible a mayúsculas y acentos, sobre label e id.
- Combobox accesible: `role="combobox"` + `aria-expanded` + `aria-controls` +
  `aria-activedescendant`; listbox siempre presente en el DOM (oculta con
  `hidden`) para que la referencia ARIA nunca quede colgada.
- Teclado: ↓/↑ mueven la opción activa, Enter selecciona, Escape cierra.
- Navegación: `router.push(buildDashboardModuleHref(basePath, moduleId))`, con
  la gramática `?module=` existente. En clínica se emite además
  `requestClinicModuleActivate`, igual que las superficies de nav ya publicadas.
  **Sin `next/link` y sin `<a>`** (AGENTS.md §10).
- Visible desde `md` (≥768px). Por debajo, el chrome móvil ya posee su propia
  navegación (bottom nav + kebab) y B09 es quien la unifica.

## 7. Invariante A03 — causa del bug 10→9 y cómo se evita

De la primera implementación de B06 (perdida al cambiar de ordenador) **no se
conserva el código ni, por tanto, la regla CSS exacta que la produjo**: lo único
documentado es su efecto observado, `admin-clinics::w1280x720` pasando de
`10/10/10` a `9/9/9` con `source=server-request`. Lo que sí se puede afirmar con
evidencia es el margen medido en la rama base:

```
admin-clinics @ 1280x720
  canvas content = 401.0156 px   pitch = 36   gap = 1   reserved = 32
  usable  = 401.0156 − 32 + 1 = 370.0156
  stride  = 37
  floor(370.0156 / 37) = floor(10.00042) = 10        slack hacia abajo = 0.016 px
```

Es decir: **el canvas admite 0.016 px de reducción antes de perder una fila**.
Cualquier crecimiento efectivo del ledger vertical ≳ 0.02 px cruza el boundary
del `floor` y reduce la capacidad de 10 a 9 — sea cual sea la regla CSS que lo
provoque. Ésa es la clase de fallo que reprodujo la implementación perdida.

El barrido completo (15 módulos × 13 viewports, 234 hojas medidas en runtime)
da los dos extremos del ledger:

| Extremo | Hoja | Valor |
|---|---|---|
| Mínimo `slackDown` (cuánto puede **encoger** el canvas) | `admin-clinics::w1280x720` | **0.016 px** |
| Mínimo `slackUp` (cuánto puede **crecer** el canvas) | `admin-sessions::w412x915` | **0.031 px** |

Conclusión medida: **la altura ocupada por el app bar no puede cambiar en
ninguna dirección más de ~0.015 px, en ningún viewport**, sin romper A03.

Solución estructural adoptada: la banda de 56 px se expresa como **cota**, no
como punto.

```css
@media (min-width: 768px) {
  .dashboard-app-shell [data-workspace-app-bar="true"] {
    min-block-size: calc(var(--dash-app-bar-h) - var(--dash-app-bar-band)); /* 54px */
    max-block-size: calc(var(--dash-app-bar-h) + var(--dash-app-bar-band)); /* 58px */
  }
}
```

La altura intrínseca medida es 54.328 px: ya está **dentro** de la banda
`[54, 58]`, de modo que ni `min-` ni `max-block-size` son vinculantes y el
ledger queda idéntico. El app bar no se descuenta dos veces ni se duplica
ninguna reserva vertical: sigue siendo la misma región, ahora con su contrato
expresado en CSS en vez de solo en un test.

**Verificación empírica** (no inferida): las 234 hojas se remidieron después de
implementar. Diff contra la medición previa:

```
total 234   geometry diffs 0   capacity diffs 0
```

(header, fila del app bar, nav, `main`, content box del canvas, capacidad
calculada y ambos slacks: byte-idénticos).

## 8. Regímenes de altura y la desviación móvil (declarada, no silenciada)

- **≥768px — régimen workspace**: se aserta el objetivo auditado 56 ±2 px.
  Medido 54.328 px en los 8 viewports desktop/tablet. PASSED.
- **<768px — régimen móvil**: los app bar móviles de admin (44 px, token
  `--admin-mobile-appbar-h`) y clínica (52 px) **no** entran en la banda 56 ±2.

  Elevarlos no es una decisión de estilo que B06 pueda tomar: el margen medido
  en teléfonos es de 0.672 px (`admin-pricing::w375x812`), así que +12 px de
  chrome re-pagina consumidores que A03 congela exactamente. Las alternativas
  (comprimir el padding de `main`, encoger la bottom nav por debajo del objetivo
  táctil de 44 px) son compensaciones arbitrarias con regresión visual y de
  ergonomía, y caen en la unificación del chrome móvil, que es **B09**.

  El spec de B06 **no** hace skip de esos viewports: aserta la banda móvil
  publicada (`admin [44,48]`, `clinic [48,54]`), de modo que un cambio silencioso
  de esos tokens falla igual.

  Por eso `--admin-mobile-appbar-h` **no** se reescribe para resolver a través de
  `--dash-app-bar-h`: hacerlo cambiaría la geometría móvil y rompería A03.
  Queda como deuda declarada de B09.

## 9. Tests

| Contrato | Archivo |
|---|---|
| Estático B06 | `test/architecture/dashboard-b06-workspace-app-bar.test.ts` (12 casos) |
| Runtime B06 | `frontend/e2e/regression/dashboard-b06-workspace-app-bar.spec.ts` (21×13 + `dark-gray` sobre 2 clases de viewport + 2 de búsqueda) |
| Censos realineados | `test/architecture/e2e-suite-catalog-completeness.test.ts`, `test/unit/infrastructure/e2e-completeness-workflow.test.ts` |
| Pin de clases realineado | `test/unit/ui/frontend/frontend-visual-consistency.test.ts` |

Ningún guard se debilitó:

- Los censos E2E se realinearon al alta del spec (81→82 specs, `ci` 47→48,
  `visual-contract` 14→15, `regression` 12→13).
- El pin `className="ml-2 flex shrink-0 items-center gap-1.5 sm:ml-3 sm:gap-3"`
  **siguió a su dueño** (de `DashboardTopbar.tsx` a `WorkspaceAppBar.tsx`), con
  el mismo regex, y se añadió además el pin de la fila del app bar, que antes no
  existía. La cobertura sube, no baja.
- El guard anti-bloqueo de selección/copia
  (`onmousedown`/`ontouchstart`/`oncopy`/…) **no se tocó**: la primera versión
  de la búsqueda usaba un handler de pulsación con `preventDefault` para
  sobrevivir al `blur`, el guard lo rechazó, y la solución fue contención de
  foco (`tabIndex={-1}` en las opciones + `relatedTarget` en el `blur` del
  contenedor), sin interceptar el puntero.

## 10. A02 — pendiente declarado

A02 congela la geometría CURRENT. B06 **no** movió geometría (§7: 0 diffs sobre
234 hojas), por lo que no se recaptura A02 y no se toca ninguno de sus fixtures.
Si una corrida posterior de A02 reportase delta, sería un hallazgo nuevo a
diagnosticar, no una recaptura a aplicar.

## 11. Contradicciones subordinadas detectadas (reportadas, no corregidas)

- `.cursor/rules/vetneb-git-and-pr-boundaries.mdc`
- `docs/protocol/vetneb-ai-working-protocol.md`

Ambas clasifican stage/commit/push/PR/merge de forma más restrictiva que el
`AGENTS.md` post-#1664. Prevalece `AGENTS.md`. Su limpieza no pertenece a B06.

## 11 bis. Presupuesto de la cohorte `full` (incidente CI de #1665)

El job `E2E Completeness` (`e2e:full`) falló en el run `32308270147` por
**globalTimeout**, no por una aserción: `Timed out waiting 1800s for the test
suite to run`, `870 passed (30.0m)`, `66 did not run`. Las dos pruebas marcadas
con ✘ (A08 `clinic-informes` 5.2s y `admin-tokens` 2.1s) fueron abortadas por ese
corte, no fallaron.

Suma real de tiempo de test del run: **59.1 min** sobre 872 pruebas. Reparto:
`dashboard-limit-invariance` 15.97m, **B06 7.45m**, A03 7.28m, A02 6.67m. La
cohorte ya venía rozando el techo antes de B06 (runs verdes de B05 en 29.7–31.1m
y un run de B04 fallido en 31.4m, sin que B06 existiera), así que B06 convirtió
un desbordamiento intermitente en determinista.

Corrección aplicada dentro del scope B06, sin perder ninguna combinación:

1. **Frontera con A08.** El spec dejó de re-aserir el scroll de
   documento/body/main: A08 lo congela sobre la misma matriz 21×13 con contrato
   exacto de 0px y en la misma cohorte. Al no medir ya el payload del módulo, el
   spec deja de necesitar `networkidle` + `assertSurfaceLoaded` y espera lo que
   la banda realmente depende: montaje del app bar + `document.fonts.ready` + 2
   frames.
2. **Pasada `normal` eliminada.** La matriz ya recorre las 21 superficies en el
   tema por defecto, incluidos los dos viewports del bloque de temas; esa pasada
   era un duplicado literal. Sólo queda `dark-gray`, y la matriz **aserta** que
   su tema es `normal`, de modo que la deduplicación es un hecho verificado.
3. **Un contexto por rol** en el bloque de temas, en vez de uno por combinación:
   42 arranques de navegador → 2.

Coste medido del spec: **7.5m → 4.1m** (−45%), con 24 pruebas en verde.

Riesgo residual declarado: la cohorte `full` sigue sin holgura real. El arreglo
duradero (ampliar el presupuesto del job de completeness o shardear la cohorte)
es un cambio **ci-only**, fuera del scope de B06 y no autorizado en esta
ejecución. `E2E Completeness` no es un required check (AGENTS.md §6).

## 12. Riesgo residual

1. La banda móvil queda fuera del objetivo 56 ±2 hasta B09 (§8).
2. El margen de 0.016 px de `admin-clinics::w1280x720` sigue existiendo: es
   propiedad de A03/A05, no de B06. Cualquier PR posterior que añada chrome
   vertical lo romperá; el contrato estático de B06 impide que sea este.
3. La búsqueda global no está montada por debajo de `md`; es una decisión
   declarada, aserrada por el spec runtime.
