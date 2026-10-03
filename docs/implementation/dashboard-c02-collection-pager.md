# C02 · CollectionPager unificado

## Base y alcance

Base: `main` / `origin/main` en `068f62c30ee908f56fd16c5afe64be68a3a32e08` (C01 fusionado por #1814). Rama local `feat/dashboard-c02-collection-pager`, sin worktree. C02 es el segundo slot del Programa C (§50) y depende sólo de C01. Fusiona `DashboardPager` y `CompactPager` en una primitiva única; no inicia C03–C05 ni migra módulos (C17+).

C02 unifica presentación y API de componente. No cambia algoritmo de paginación, `limit`, `offset`, page size, hooks de capacidad, endpoints, query params, payloads, momento de consulta, orden, filtros, permisos ni rutas.

## Censo previo

Fuente: código ejecutable (`git grep` sobre `frontend/src`, `frontend/e2e` y `test`), con el documento rector como hipótesis.

| Pager | Consumidores de render | Base de página | Rango / total | Reserva | Control | Paginación |
|---|---|---|---|---|---|---|
| `DashboardPager` (centrado, `nav`) | `ClinicLogisticaWorkspaceSummary`, `LogisticsRecentListCanvas` | 0 | `rangeLabel` preformateado por el consumidor, `sr-only`, `aria-live="polite"`; ausente sin total | `DASHBOARD_TOUCH_PAGER_RESERVATION` | texto `Anterior`/`Siguiente`, `h-8`, `dashboard-pagination-btn` | cliente (`usePagedRows`) |
| `CompactPager` (compacto, `div`) | `AdminMaintenanceDryRunCard`, `AdminPricingEditorCard` | 0 | calculado `a–b de N <itemLabel>` / `Sin <itemLabel>`, visible, `aria-live="polite"` + `aria-atomic` | `DASHBOARD_PAGER_RESERVATION` | icono, `h-8 w-8`, `aria-label` | cliente (`usePagedRows`) |
| `AdminMobileOpsPager` (fuera de C02) | módulos admin mobile | **1** | `rangeLabel` `sr-only` | `DASHBOARD_TOUCH_PAGER_RESERVATION` | `Button` `h-9` | según módulo |
| Pagers manuales con markup propio (fuera de C02) | Informes, Logística rutas/visitas/métricas, Auditoría, Informes admin, Tokens admin/clínica, Clínicas, Usuarios, Sesiones, Intentos fallidos, Informes clínica | según módulo | según módulo | importan una de las tres reservas | según módulo | servidor, URL o cliente |

Reservas: las tres constantes viven en `components/dashboard/DashboardPager.tsx` y las importan 14 archivos además de los dos pagers. Ningún consumidor usaba el modo slot de `DashboardPager`; se conserva por compatibilidad de API. Ningún consumidor de `DashboardPager` o `CompactPager` pagina contra servidor.

Diferencias legítimas entre ambos pagers (no fusionables sin cambiar contrato): elemento raíz y landmark (`nav` con `aria-label` frente a `div`), reserva (táctil frente a estándar), modelo de rango (cadena del consumidor `sr-only` frente a cálculo visible con `aria-atomic`), orden (anterior · estado · siguiente frente a rango · estado · anterior · siguiente), marcadores `data-dashboard-pager-prev/next` (en el wrapper frente al botón), contenido del control (texto frente a icono) y el `span.dashboard-pagination-context` del estado centrado. Lógica idéntica que estaba duplicada: cálculo de deshabilitado, etiqueta `Pág. X / Y`, `aria-label` de los controles, piel base del control, marcadores raíz y la importación de la reserva.

## Diseño

**Owner.** `CollectionPager` es la única implementación; se publica por `features/dashboard/presentation/surfaces` junto a las primitivas C01. Vive en el módulo existente `components/dashboard/DashboardPager.tsx` —igual que C01 vive en `ui/table.tsx`— porque ese módulo ya es el owner de las tres reservas que importan 14 archivos y porque el lector canónico de la suite rechaza archivos no versionados. La carpeta destino `presentation/collection/` (§47.1) no se crea en C02.

**API.** Unión discriminada por `variant`:

- `variant: "centered"` — `aria-label` obligatorio, `rangeLabel?`, slots `prevControl`/`stateControl`/`nextControl`.
- `variant: "compact"` — `rangeStart`, `rangeEnd`, `total`, `itemLabel?` (por defecto `elementos`).
- Común — `page` base 0, `pageCount`, `hasPrev?`/`hasNext?` (si faltan se derivan de la página), `onPrev`, `onNext`, `disabled`, `className`.

Una sola regla de estado: `displayPage = clamp(page + 1, 1, max(1, pageCount))`, `prev` deshabilitado si `disabled || !onPrev || !(hasPrev ?? displayPage > 1)` y simétrico para `next`: un control built-in nunca queda habilitado sin callback que lo opere (los controles de slot no se alteran). El estado centrado ya acotaba así; el compacto mostraba `page + 1` sin acotar. Para toda entrada alcanzable (`usePagedRows` garantiza `0 ≤ page < pageCount` y `pageCount ≥ 1`) ambas reglas producen el mismo texto; sólo difieren con `page ≥ pageCount` o `pageCount = 0`, estados que ningún consumidor produce.

**Adaptadores.** `DashboardPager` (`<CollectionPager {...props} variant="centered" />`) y `CompactPager` (`<CollectionPager {...props} variant="compact" />`) conservan nombres, tipos de props e imports; no renderizan markup propio. Los cuatro consumidores no cambian.

**Marcador.** La raíz añade `data-collection-pager="centered|compact"`, único atributo nuevo del DOM, para que los contratos E2E prueben el owner en runtime.

**Fuera de la primitiva.** Sin fetch, endpoints, capacidad, `limit`/`offset`, orden, selección, estados vacío/error/carga, hooks, estado, memoización ni observadores.

## Geometría

Reservas sin cambios de valor ni de owner:

| Reserva | Valor | Uso |
|---|---|---|
| `DASHBOARD_PAGER_RESERVATION` | `var(--dash-pagination-h, 2.5rem)` | variante compacta y pagers de pie con controles ≤ 32 px |
| `DASHBOARD_TOUCH_PAGER_RESERVATION` | `max(var(--dash-pagination-h, 2.5rem), 2.5rem)` | variante centrada y pagers táctiles |
| `DASHBOARD_INLINE_PAGER_RESERVATION` | `var(--dash-control-h, 2rem)` | cluster inline de Clínicas |

`block-size`, `min-block-size`, `max-block-size`, el marcador `data-dashboard-adaptive-reserved-region="pager"` y la regla CSS `.dashboard-pager` no cambian. Los controles conservan `h-8` (32 px) en ambas variantes.

**Objetivo 40 px.** La variante centrada ya reserva ≥ 40 px (piso táctil `2.5rem`): 40 px medidos a 1366 × 768 y 390 × 844. La compacta conserva la reserva estándar ligada a `--dash-pagination-h` (36 px a 1366 × 768). Llevarla a 40 px desplazaría el canvas de filas y el `limit` de Precios y Mantenimiento: es trabajo de C05 junto con A07, como la cabecera de 36 px en C01. C02 no añade token de geometría.

## CSS

Sin cambios de CSS. Las clases de los controles se componen de una piel base común más una piel por variante; el conjunto de clases de cada control es idéntico al anterior (sólo cambia el orden dentro del atributo). `dashboard-pagination-btn`, `dashboard-pagination-context`, `.dashboard-pager` y `.dashboard-compact-pager` siguen siendo los mismos selectores.

## Verificación

- Paridad legacy (script de sesión, fuera del repo): las fuentes de `068f62c3` frente a los adaptadores, ejecutadas contra un stub de React. Centrado 7 776/7 776 combinaciones idénticas (incluidas páginas fuera de rango y modo slot); compacto 864/864 en el dominio alcanzable; las únicas diferencias son `page ≥ pageCount` o `pageCount = 0` (regla acotada) y el marcador `data-collection-pager`.
- Unit `dashboard-stable-geometry-reservation` (runtime: ejecuta `DashboardPager.tsx` y `CompactPager.tsx`): PASSED 11/11, incluye 5 casos C02 (variante centrada, variante compacta, base 0 compartida, paridad congelada de cada adaptador). Mutaciones probadas en local, todas eliminadas: adaptador compacto con variante centrada, reserva compacta táctil, `disabled` ignorado, `aria-atomic` alterado, texto de rango alterado, etiqueta vacía alterada y markup propio en un adaptador.
- Guard de arquitectura B11/B15/B16/C01/C02: PASSED 17/17, incluye 3 casos C02 (owner único y adaptadores, primitiva sólo de presentación, censo de consumidores y cerco C03+/C05). El cerco C01 que prohibía el nombre `CollectionPager` se realineó para C02; el resto de sus prohibiciones sigue intacto.
- Guards `test/architecture/**` + `test/unit/ui/**`: PASSED 2440/2441, 1 omitido condicional preexistente.
- E2E `dashboard-b11-workspace-header.spec.ts`: PASSED 20/20 (3 casos C02). Precios a 1366 × 768 (compacto): reserva exacta de 36 px (`block = min = max`), controles de 32 px alcanzables por hit-test, filas sobre el pager, rango `a–b de N estudios` igual a las filas renderizadas, anterior/siguiente por click y teclado, cero requests de paginación. Logística clínica a 1366 × 768 y 390 × 844 (centrado, dataset A03 de 256 visitas): reserva táctil exacta de 40 px, controles de 32 px, 9 y 12 filas —iguales al `limit` congelado por A03 para esos viewports—, rango `sr-only` y estado `Pág. X / Y` coherentes al paginar, cero requests.
- A02: PASSED, 21/21 superficies (273 combinaciones), baseline sin cambios.
- A03: PASSED, 16/16, 195/195 registros primarios y 234/234 hojas; fixture sin cambios, sin recaptura.
- A05: PASSED, 15/15; `limit` invariante. A08: PASSED, 21/21 superficies sobre 13 viewports.
- Contratos zero-scroll de AGENTS §10 y causales de pager (`dashboard-internal-no-scroll-contract`, `dashboard-real-app-shell-no-scroll-contract`, `dashboard-zero-scroll-mobile-boundary`, `dashboard-viewport-zoom-adaptability`, `dashboard-centered-pager`, `admin-pricing-multi-form-measurement`, `admin-mobile-config-modules-no-scroll`, `dashboard-logistica-mobile-action-bar-reachability`, `dashboard-adaptive-rows`, `dashboard-clinic-module-state-parity`): PASSED 168/168.
- Frontend lint, typecheck y build, `pnpm typecheck:test`, `pnpm security:public-surface` y `git diff --check`: PASSED.
- No seleccionados: `pnpm validate:local` y `pnpm test` completo (gates de backend; C02 no toca `server/`), cohorte visual Linux (BLOCKED en Win32).

## Riesgo y rollback lógico

Riesgo residual: la regla de estado acotada difiere del compacto anterior sólo en estados inalcanzables; el orden de tokens dentro de `class` cambió con el mismo conjunto. La cohorte visual Linux no es ejecutable en Win32.

Rollback: restaurar `DashboardPager.tsx` y `CompactPager.tsx` a `068f62c3`, quitar el export de `surfaces`, los casos C02 de los tests de reserva y arquitectura, el bloque C02 del spec B11 y su descripción en el catálogo. No requiere cambios de datos ni de backend.

## No alcance

Sin backend, API, auth, DB, migraciones, dependencias, lockfile, workflows, PWA ni producción. Sin C03 (estados vacío/error/carga), C04 (orden por columna), C05 (fila de 40 px, reserva de 36/40 px), C06+ (selección, toolbar contextual, menús, acciones masivas), A06/A07 (hook único) ni migración de módulos. `AdminMobileOpsPager` (base 1, `Button` `h-9`) y los pagers manuales quedan fuera: comparten reserva y marcadores, pero su adopción es parte de C17–C22.
