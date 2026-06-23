# Admin Mobile Final Polish — E2E overlap audit

> Auditoría read-only. **No modifica código productivo, tests, helpers, backend, API, auth, DB,
> migrations, deps, lockfiles, screenshots, Playwright config ni CI.** Solo documenta hallazgos
> y propone PRs futuros. No reduce cobertura.

## 1. Resumen ejecutivo

**Dictamen:** `admin-mobile-final-polish-no-scroll.spec.ts` es, en su mayor parte, un
**smoke de integración de una sola sesión** cuyas aserciones individuales ya están cubiertas
por las specs dedicadas. Su valor real **no** está en las aserciones (duplicadas), sino en que
es el **único** spec que recorre, en un único contexto de navegador y por viewport,
la cadena completa del chrome admin mobile: *launcher página 1 → launcher página 2 → menú "Más"
→ menú de administración (kebab) → panel de notificaciones → los 6 módulos core+ops*, más un
smoke desktop equivalente.

- **Cobertura solapada (mayoría):** el contrato no-scroll + "dentro del viewport" de launcher,
  menú "Más", kebab, notificaciones y de los 6 módulos `core`/`ops` (clinics, reports, tokens,
  audit, sessions, users) ya está cubierto **superficie por superficie** por `hub-launcher`,
  `bottom-navigation`, `core-modules` y `ops-modules`. El smoke desktop de esos 6 módulos solapa
  con el bloque `Admin desktop preserves … layout` de cada spec dedicada.
- **Cobertura única probable (minoría, pero real):** (a) la **continuidad en una sola sesión**
  del chrome completo, que ningún otro spec ejecuta como un único flujo; (b) el barrido uniforme
  de **content-band** (`expectInsideMobileContentBand`: cada tile/ítem/pager por debajo del app bar
  y por encima del bottom nav) y de **clipping por ancestros** (`expectNotClippedByAncestors`)
  aplicado de forma homogénea a *todas* las superficies en una pasada; (c) el set consolidado de
  **screenshots de evidencia** del recorrido completo.
- **Lo que final-polish NO cubre** (no es superset): módulos `status` (Resumen/health), módulos
  `config` (precios/mantenimiento), el eje **light + dark**, el aislamiento de capas de pintado /
  stacking (`module-layer-isolation`, `hub-stale-layer-stage`), la operabilidad de la toolbar y el
  diálogo de creación de tokens (`admin-tokens-mobile-toolbar-layout`), el clipping de selects de
  sesiones, la densidad de Alertas y el avance de paginación de reports.

**Recomendación:** **no tocar final-polish todavía** como contrato. Si se busca reducir deuda, el
único movimiento seguro a corto plazo es **PR-B3B test-only**: migrar los *primitivos idénticos*
que final-polish aún re-declara localmente al helper compartido `frontend/e2e/helpers/admin-mobile-contracts.ts`
(ya consumido por config/core/ops/status), **sin** reducir cobertura, **sin** tocar screenshots y
**sin** mover los helpers específicos de final-polish al módulo compartido (eso tendría blast radius
sobre 4 specs). No borrar el spec, no recortar viewports, no recortar el loop de módulos.

## 2. Base auditada

| Campo | Valor |
| --- | --- |
| Branch de trabajo | `docs/admin-mobile-final-polish-e2e-overlap-audit` |
| Branch base | `main` |
| HEAD (`git log -1 --oneline`) | `9b84ba3 test(admin): share mobile status config e2e helpers (#1091)` |
| `git status --short --untracked-files=all` | limpio antes de crear este archivo |
| Fecha | 2026-06-23 |
| Plataforma | Windows / PowerShell / PNPM |

Antecedentes ya cerrados en la rama base: #1089 (audit de optimización E2E), #1090 (share mobile
e2e contract helpers), #1091 (share mobile status config e2e helpers). El helper compartido
`frontend/e2e/helpers/admin-mobile-contracts.ts` existe y lo consumen `config`/`core`/`ops`/`status`;
**final-polish aún no lo importa** (mantiene copias locales de los primitivos).

Specs versionados considerados (`git ls-files`):

- `frontend/e2e/admin-mobile-final-polish-no-scroll.spec.ts` (auditado)
- `frontend/e2e/admin-mobile-core-modules-no-scroll.spec.ts`
- `frontend/e2e/admin-mobile-ops-modules-no-scroll.spec.ts`
- `frontend/e2e/admin-mobile-status-modules-no-scroll.spec.ts`
- `frontend/e2e/admin-mobile-config-modules-no-scroll.spec.ts`
- `frontend/e2e/admin-mobile-hub-launcher-no-scroll.spec.ts`
- `frontend/e2e/admin-mobile-bottom-navigation-no-scroll.spec.ts`
- `frontend/e2e/admin-mobile-module-layer-isolation.spec.ts`
- `frontend/e2e/admin-tokens-mobile-toolbar-layout.spec.ts`

## 3. Inventario del spec final-polish

El spec define **4 tests** (3 mobile por viewport + 1 desktop). Mobile usa `colorScheme: "light"`
+ `reducedMotion: "reduce"` (sin dark). Los 6 `MODULE_SCREENS` son: `clinics`, `reports`, `tokens`
(core) y `audit`, `sessions`, `users` (ops). **No** incluye status ni config.

| Bloque / test | Viewports | Módulos / superficies | Screenshots | Asserts principales | Riesgo de tocarlo |
| --- | --- | --- | --- | --- | --- |
| `Admin mobile final polish closeout at {viewport}` (×3, líneas 472-587) | 360 / 390 / 430 (light) | launcher pág. 1 y 2, menú "Más" (`module-menu`), kebab (`kebab-menu`), notificaciones (`notifications-panel`), + 6 módulos core/ops vía `?module=` | 11/viewport: `launcher-page-1`, `launcher-page-2`, `more-menu`, `administration-menu`, `notifications`, + 6 (uno por módulo) | `auditMobileSurface` (= `expectMobileChrome` 5 nav-items + `expectInsideMobileContentBand` + `assertSurfaceContract` no-scroll), `expectInsideMobileContentBand` por tile/ítem/pager, `expectNotClippedByAncestors` por ítem, "Actualizar" habilitado en notificaciones | **Alto**: es el recorrido integral; cada paso encadena estado de la sesión anterior |
| `Admin desktop final polish smoke at 1280x800` (×1, líneas 589-634) | 1280×800 | hub desktop + 6 módulos core/ops | 7: `launcher` + 6 (uno por módulo) | hub visible y chrome mobile oculto, `assertSurfaceContract` no-scroll en hub, por módulo: horizontal-nav visible, `bottom-nav`/`mobileRoot` ocultos, workspace visible + contenido poblado (`desktopReady`), `expectInsideViewport`, no-scroll sin descendientes | **Medio**: smoke desktop, asserts independientes por iteración |

Helpers locales del spec (no exportados, declarados in-file): `captureScreen`,
`readSurfaceContract` / `assertSurfaceContract`, `expectInsideViewport`,
`expectInsideMobileContentBand`, `expectNotClippedByAncestors`, `expectMobileChrome`,
`auditMobileSurface`, `auditModuleItems`, `setPopulatedAdminSession`, `fulfillJson`,
`mockMissingPopulatedApis`, `suppressNextDevIndicator`, `preparePage`, `captureScreen`.

Mocks: `mockMissingPopulatedApis` intercepta `**/api/admin/clinics**` y `**/api/admin/sessions**`
(9 clínicas y 9 sesiones sintéticas); resto vía fallback. Screenshots a
`test-results/admin-mobile-final-polish-no-scroll/` (≈33 mobile + 7 desktop = ~40 PNG por corrida).

## 4. Matriz de solapamiento

`✔` = lo cubre; `—` = no lo cubre; "única" = comportamiento que solo final-polish ejerce.

| Comportamiento | final-polish | Otro spec que lo cubre | Cobertura única | Recomendación |
| --- | --- | --- | --- | --- |
| Launcher mobile paginado (pág. 1/2) no-scroll + tiles dentro de banda | ✔ | `hub-launcher` (`Admin mobile hub is a paginated no-scroll launcher`) | No | Dejar; el contrato canónico vive en `hub-launcher` |
| Navegar pulsando tiles del launcher hacia módulo | — (solo audita layout, no hace click de tile) | `hub-launcher` (clicks `admin-clinics`/`audit-log`/`admin-sessions`), `module-layer-isolation` | No | N/A |
| Estilo visual de tiles (borderless, icono grande) | — | `hub-launcher` (`tiles are borderless…`) | No | N/A |
| Menú "Más" (`module-menu` + `module-link`) no-scroll/visible | ✔ | `bottom-navigation`, `core-modules` (línea 268), `ops-modules` (línea 143) | No | Contrato canónico en `bottom-navigation` |
| Menú de administración (kebab) | ✔ | `bottom-navigation` (`kebab-menu`) | No | Contrato canónico en `bottom-navigation` |
| Panel de notificaciones (+ "Actualizar" habilitado) | ✔ | `bottom-navigation` (`notifications-panel`) | No | Contrato canónico en `bottom-navigation` |
| Bottom nav: 5 ítems dentro de viewport, no-scroll | ✔ (`expectMobileChrome`) | `bottom-navigation` (`is complete and no-scroll`) | No | Contrato canónico en `bottom-navigation` |
| Core mobile no-scroll: clinics/reports/tokens (ítems + pager) | ✔ | `core-modules` (`core module "${key}" is no-scroll`) | No | Contrato canónico en `core-modules` |
| Ops mobile no-scroll: audit/sessions/users (ítems + pager) | ✔ | `ops-modules` (`ops ${key} is absolute no-scroll`) | No | Contrato canónico en `ops-modules` |
| Smoke desktop de los 6 módulos (workspace poblado, mobile oculto) | ✔ | `core-modules`/`ops-modules` (`Admin desktop preserves ${key} layout`) | No | Solapado; el desktop por-módulo vive en cada spec dedicada |
| **Continuidad del chrome completo en una sola sesión/viewport** | ✔ | — (cada spec dedicada usa página fresca por superficie) | **Sí** | **Preservar**: es el único smoke de recorrido integral |
| **Barrido uniforme content-band en todas las superficies** (`expectInsideMobileContentBand` a tiles, ítems y pagers en una pasada) | ✔ | parcial/disperso en core/ops; no de forma homogénea ni sobre launcher+menús+módulos juntos | **Sí (forma)** | **Preservar** el barrido; no replicarlo en otro spec |
| **`expectNotClippedByAncestors` por ítem de módulo** | ✔ | — (no aparece en las specs comparadas) | **Sí** | **Preservar** |
| Status modules (Resumen/health), chips/paneles, light+dark | — | `status-modules` | No (de final-polish) | Fuera de scope de final-polish |
| Config modules (precios/mantenimiento), chips/paneles, light+dark | — | `config-modules` | No (de final-polish) | Fuera de scope de final-polish |
| Aislamiento de capas de pintado / stacking / bleed-through | — | `module-layer-isolation`, `admin-mobile-hub-stale-layer-stage` | No (de final-polish) | No solapa; invariante distinto |
| Toolbar tokens operable + diálogo creación (búsqueda clínica) | — (solo no-scroll de `tokens`) | `admin-tokens-mobile-toolbar-layout` | No (de final-polish) | No solapa el contrato funcional |
| Pager tokens bottom-anchored con dataset corto/largo | parcial (pager dentro de banda) | `admin-tokens-mobile-toolbar-layout` | No | Caso funcional vive en tokens-toolbar |
| Selects Tipo/Estado de sesiones sin recorte | — | `ops-modules` (`selects render full option text uncut`) | No | No solapa |
| Densidad Alertas (10/página), avance paginación reports | — | `status-modules` (Alertas), `core-modules` (reports pagination) | No | No solapa |

## 5. Cobertura única probable

Lo que final-polish **debería preservar sí o sí** (no replicado por otras specs):

1. **Smoke de recorrido integral en una sola sesión por viewport.** Es el único test que, sin
   recargar contexto entre superficies, encadena launcher → pág. 2 → "Más" → kebab → notificaciones
   → 6 módulos. Detecta regresiones de *continuidad* (estado del shell que se rompe al transicionar
   entre superficies) que las specs por-superficie, al partir de página fresca, no ven.
2. **Barrido homogéneo de content-band** (`expectInsideMobileContentBand`) aplicado a *todas* las
   superficies y a cada tile/ítem/pager: comprueba que nada queda por encima del app bar ni por
   debajo (tapado) por el bottom nav, de forma uniforme y en una sola pasada.
3. **Chequeo de clipping por ancestros** (`expectNotClippedByAncestors`) por ítem de módulo, que no
   aparece en las specs comparadas.
4. **Set de screenshots de evidencia del recorrido completo** (launcher×2, more-menu, kebab,
   notificaciones, 6 módulos × 3 viewports + 7 desktop) consolidado en un único directorio.

## 6. Cobertura redundante probable

Candidatos a *reducir/mover en un PR posterior* (NO ahora), porque su contrato canónico ya vive
en una spec dedicada:

- Aserciones no-scroll por-módulo de `clinics`/`reports`/`tokens` → duplican `core-modules`.
- Aserciones no-scroll por-módulo de `audit`/`sessions`/`users` → duplican `ops-modules`.
- Contrato de menú "Más", kebab y notificaciones → duplican `bottom-navigation`.
- Paginación/visibilidad del launcher pág. 1/2 → duplican `hub-launcher`.
- Smoke desktop por-módulo → duplica `Admin desktop preserves … layout` de cada spec dedicada.

**Importante:** "redundante" aquí es a nivel de *aserción*, no de *intención*. El recorrido integral
y el barrido uniforme (sección 5) **no** son redundantes. Por eso la reducción solo es segura si se
preserva el flujo único; recortar el loop de módulos o los screenshots eliminaría evidencia y el
único smoke de continuidad. Tratar esta sección como *backlog observado*, no como acción inmediata.

## 7. Riesgos

- **Screenshots como evidencia visual.** Los ~40 PNG por corrida son evidencia de cierre del
  recorrido admin mobile. Reducirlos baja el costo pero elimina prueba visual; cualquier recorte
  debe ser una decisión explícita, no un efecto colateral de un refactor.
- **Flakiness por paralelismo.** El test mobile es largo (timeout 120 s), encadena clicks y
  transiciones y depende de mocks de `clinics`/`sessions`. Tocar el orden o compartir estado mal
  puede introducir intermitencias difíciles de reproducir; mantener `reducedMotion: "reduce"`.
- **Contrato visual vs contrato funcional.** final-polish valida *layout* (no-scroll, dentro de
  banda, no recortado), no *funcionalidad de negocio* (crear clínica, persistir precios, revocar
  sesión). No es sustituto de `admin-tokens-mobile-toolbar-layout` ni de los contratos operativos;
  no consolidar uno dentro del otro.
- **Blast radius del helper compartido.** Mover los helpers *específicos* de final-polish
  (`readSurfaceContract`, `expectInsideMobileContentBand`, `expectNotClippedByAncestors`,
  `auditMobileSurface`, `auditModuleItems`) a `admin-mobile-contracts.ts` afectaría a los 4 specs
  que ya lo importan (config/core/ops/status). Solo es seguro compartir los *primitivos idénticos*.
- **Tocar demasiado en un solo PR.** final-polish concentra launcher + menús + notificaciones +
  6 módulos + desktop. Un cambio amplio mezcla varios contratos; cualquier intervención debe ser
  acotada y reversible.

## 8. Propuesta de PR siguiente

### Opción recomendada — PR-B3B: test-only, migrar solo primitivos idénticos al helper compartido

- **Scope:** hacer que `admin-mobile-final-polish-no-scroll.spec.ts` importe de
  `frontend/e2e/helpers/admin-mobile-contracts.ts` **únicamente** los primitivos ya idénticos y ya
  exportados: `ADMIN_MOBILE_TOLERANCE` (== `TOLERANCE` local), `ADMIN_MOBILE_VIEWPORTS`
  (== `MOBILE_VIEWPORTS`, lista idéntica 360/390/430), `setPopulatedAdminSession`, `fulfillJson`,
  `suppressNextDevIndicator`, `expectInsideViewport`. Eliminar esas copias locales. **No** mover
  ni alterar los helpers específicos de final-polish; **no** agregarlos al módulo compartido.
- **Archivos:** solo `frontend/e2e/admin-mobile-final-polish-no-scroll.spec.ts` (1 archivo de test).
  **No** se toca `admin-mobile-contracts.ts` (ya exporta lo necesario), ni productivo, ni screenshots,
  ni config.
- **Validaciones:** `pnpm --dir frontend lint`, `pnpm --dir frontend typecheck`,
  `pnpm --dir frontend exec playwright test admin-mobile-final-polish-no-scroll` (mismo nº de tests:
  3 mobile + 1 desktop), confirmar que el set de screenshots no cambia.
- **Rollback:** `git restore frontend/e2e/admin-mobile-final-polish-no-scroll.spec.ts`. Un solo
  archivo, revert trivial.

### Opción alternativa — PR-B3B': split/reduce screenshots

- **Scope:** parametrizar la captura de screenshots por flag de entorno (p. ej. solo en fase de
  evidencia), reduciendo PNG en CI sin borrar aserciones.
- **Archivos:** `admin-mobile-final-polish-no-scroll.spec.ts`.
- **Validaciones:** misma corrida; verificar que las aserciones siguen 1:1 y que la evidencia se
  puede regenerar bajo demanda.
- **Rollback:** `git restore` del spec.
- **Veredicto:** **no recomendada ahora.** Baja relación valor/riesgo: toca evidencia visual y la
  ganancia es de tiempo de CI, no de cobertura. Postergar hasta tener métrica de costo de CI.

### Opción conservadora — no tocar final-polish todavía

- **Scope:** dejar el spec intacto; este documento queda como base de decisión.
- **Veredicto:** válida y de cero riesgo. Es la posición por defecto si no hay presión de costo de CI.

## 9. Recomendación final

**Hacer primero:** nada sobre el spec en este PR (PR-B3A es docs-only). Como *siguiente* paso, si se
decide reducir deuda, **PR-B3B test-only** migrando solo los 6 primitivos idénticos al helper
compartido `admin-mobile-contracts.ts`, en un único archivo y reversible, sin tocar screenshots.

**NO hacer:** no borrar `admin-mobile-final-polish-no-scroll.spec.ts`; no recortar viewports ni el
loop de 6 módulos; no eliminar el recorrido integral ni los chequeos de content-band / clipping por
ancestros (cobertura única, sección 5); no mover los helpers específicos de final-polish al módulo
compartido (blast radius sobre 4 specs); no reducir screenshots en este ciclo; no fusionar
final-polish con `bottom-navigation`/`hub-launcher`/`core`/`ops`/`tokens-toolbar`.
