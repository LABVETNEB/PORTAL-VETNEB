# B02 — Retiro de componentes muertos del dashboard

Programa B · Nivel 2 · `refactor/dashboard-remove-dead-components-b02`

Fuente rectora: `docs/audit/AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md` §14.3 (censo de código
muerto), §49 (roadmap del Programa B) y §56.1 (plan de tests de arquitectura).

## Estado base

| Campo | Valor |
|---|---|
| Base | `62928943af95577e14c01a8ef68cf03a5e934e08` (`main`) |
| Dependencia | B01 — CLOSED (PR #1658) |
| Rama | `refactor/dashboard-remove-dead-components-b02` |

## Scope

**Incluido:** retiro de los seis componentes sin consumidores de §14.3, realineación de los tests
que los anclaban por `readSource`, y un contrato de arquitectura que hace el retiro *fail-closed*.

**Excluido deliberadamente:**

- B03 y posteriores: `tokens.css`, escalas de color/shape/elevation/spacing/typography/motion,
  migración de superficies, app bar, drawer, rail, `WorkspaceScaffold`.
- `DashboardHorizontalNav` y `DashboardModuleRail`: navegación **viva**, programada para B08
  (después de B07 + A08).
- `AdminMobileKebabMenu`: componente **vivo**. Su ausencia del barrel B01 es consecuencia de que
  alcanza `@/lib/api` transitivamente, no de que esté muerto. B02 no lo toca.
- `AdminMobileBottomNav`, `ClinicMobileBottomNav`, `AdminMobileModuleMenu`,
  `AdminMobileHubLauncher`, `AdminMobileHubPager`, `DashboardPager`, `CompactPager`: vivos, sin
  cambios.

## Auditoría previa — censo white-box contra HEAD

El estado muerto se volvió a demostrar contra la base real; no se asumió del documento histórico.

| Componente | Importadores runtime | Importadores type-only | Exposición en barrels | Veredicto |
|---|---:|---:|---|---|
| `DashboardSidebarFrame.tsx` | 2 (ambos dentro del propio cluster) | 0 | ninguna | DEAD_CONFIRMED |
| `FilterDrawer.tsx` | 0 | 0 | ninguna | DEAD_CONFIRMED |
| `StickyFilterBar.tsx` | 0 | 0 | ninguna | DEAD_CONFIRMED |
| `AdminDashboardSidebar.tsx` | 0 | 0 | ninguna | DEAD_CONFIRMED |
| `ClinicDashboardSidebar.tsx` | 1 (`DashboardSidebar`, dentro del cluster) | 0 | ninguna | DEAD_CONFIRMED |
| `DashboardSidebar.tsx` | 0 | 0 | ninguna | DEAD_CONFIRMED |

Grafo de la cadena sidebar, reconstruido (no heredado):

```text
DashboardSidebar ──► ClinicDashboardSidebar ──┐
                                              ├──► DashboardSidebarFrame ──► @/lib/routes, lucide-react
AdminDashboardSidebar ────────────────────────┘

Entrypoints runtime hacia el cluster desde frontend/src/app/**,
frontend/src/features/** o cualquier otro módulo alcanzable: 0
```

Búsquedas ejecutadas: nombre literal, specifier por path (`@/components/dashboard/<X>`),
specifier relativo (`./X`, `../X`), `export ... from`, `import()` dinámico y `require()`. Los
únicos aciertos fuera del cluster eran **comentarios** en los barrels `presentation/navigation` y
`presentation/layout`, y **tests** (ver abajo). El cluster es cerrado: se retira entero o no se
retira.

`FilterDrawer` y `StickyFilterBar`: 0 usos JSX y 0 imports. `frontend/src/app/dashboard/informes/page.tsx`
usa `FilterBar` + `FilterField` (subsistema vivo), y un test histórico **afirma la ausencia** de
`FilterDrawer`/`StickyFilterBar` en esa página — ese contrato se conserva intacto.

## Cambios

### Archivos eliminados (6)

```text
frontend/src/components/dashboard/DashboardSidebarFrame.tsx
frontend/src/components/dashboard/FilterDrawer.tsx
frontend/src/components/dashboard/StickyFilterBar.tsx
frontend/src/components/dashboard/AdminDashboardSidebar.tsx
frontend/src/components/dashboard/ClinicDashboardSidebar.tsx
frontend/src/components/dashboard/DashboardSidebar.tsx
```

### Métrica de retiro

| Medida | Bytes |
|---|---:|
| Histórico §14.3 | 17 456 |
| Real, working tree CRLF en la base | **17 456** |
| Real, blobs LF en la base | 16 907 |

Sin deriva. Los 17 456 B del audit son la medición del working tree en Windows (CRLF); los
16 907 B son los mismos contenidos almacenados en git con LF. La diferencia (549 B) es exactamente
el número de saltos de línea de los seis archivos.

### Contrato de arquitectura (nuevo)

`test/architecture/dashboard-dead-component-retirement.test.ts` — cuatro invariantes fail-closed:

1. los seis paths auditados no existen;
2. ningún módulo bajo `frontend/src` recrea uno de los seis nombres (en **cualquier** carpeta);
3. ninguna fuente de `frontend/src` importa o reexporta un módulo retirado (alias, relativo,
   `import()` dinámico, `require()`, forma directorio-índice);
4. ningún barrel de `features/dashboard/presentation` exporta un símbolo retirado.

Los specifiers se extraen de declaraciones reales de import/export, nunca por substring: este
mismo archivo, los barrels y varios contratos de ausencia **nombran** los componentes retirados en
prosa, y un escaneo textual los marcaría a todos.

### Guard B01 (`dashboard-presentation-import-boundaries.test.ts`)

`NAVIGATION_FORBIDDEN_EXPORTS` se **conserva** como defensa en profundidad: falla ante un
re-export por nombre, con independencia de si el módulo existe. Solo se actualizó el comentario
(era una scope fence "la disposición pertenece a B02"; B02 ya la resolvió) y los mensajes de
fallo. Cero cambio de comportamiento.

### Tests realineados (13 archivos)

El roadmap estimaba «ajustar 3 tests»; la realidad son 13 archivos. La deriva se explica porque
los seis componentes estaban anclados por `readSource` desde suites de accesibilidad, consistencia
visual, paridad móvil y contratos admin/clínica, no solo desde sus tests propios.

**Eliminados por completo (1):** `test/unit/ui/admin/frontend-admin-sidebar-module-navigation.test.ts`
— el archivo entero contrataba `AdminDashboardSidebar` + `DashboardSidebarFrame`.

**Tests de implementación del componente retirado, eliminados (semántica A):**

| Archivo | Tests retirados |
|---|---|
| `test/unit/ui/dashboard/frontend-dashboard-filter-drawer-sticky-filters.test.ts` | contrato de `FilterDrawer`; contrato de `StickyFilterBar` |
| `test/unit/ui/dashboard/frontend-dashboard-mobile-polish-bottom-actions.test.ts` | PR-9 `StickyFilterBar`; PR-9 `FilterDrawer` |
| `test/unit/ui/dashboard/frontend-dashboard-workspace-layout-polish.test.ts` | 4 de `FilterDrawer` + 4 de `DashboardSidebarFrame` |
| `test/unit/ui/dashboard/frontend-dashboard-shell.test.ts` | 3 de `DashboardSidebarFrame` + 1 clínica + 1 admin |
| `test/unit/ui/frontend/frontend-visual-consistency.test.ts` | shell del sidebar; paridad clínica/admin |
| `test/unit/infrastructure/mobile-production-parity-invariants.test.ts` | invariante `h-dvh` del sidebar |
| `test/unit/ui/admin/frontend-admin-report-workflow.test.ts` | anclas operativas del sidebar admin |

**Tests mixtos, reducidos a su mitad viva (sin debilitar assertions):**

| Archivo | Ajuste |
|---|---|
| `frontend-dashboard-accessibility-focus-aria.test.ts` | `StickyFilterBar+StickyActionBar` → solo `StickyActionBar`; `DashboardSidebarFrame+Topbar+Bell` → solo `Topbar+Bell` |
| `admin-dashboard-sections-contract.test.ts` | se pierde la mitad "el sidebar declara la sección"; se conserva íntegra la mitad "el ancla se renderiza en la superficie admin" |
| `frontend-admin-particular-tokens.test.ts` | se retiran 2 asserts sobre el sidebar; el montaje de la card y el ancla siguen contratados |
| `frontend-clinic-public-profile.test.ts` | idem, orden de las cards intacto |
| `frontend-dashboard-clinic-tokens.test.ts` | idem |
| `frontend-native-link-preview-contract.test.ts` | `DashboardSidebarFrame` sale de la lista de archivos vigilados |

**Contratos de ausencia CONSERVADOS (semántica B) — ningún test que afirma la ausencia se tocó:**

```text
frontend-dashboard-filter-drawer-sticky-filters.test.ts:50-53   informes no usa FilterDrawer/StickyFilterBar
frontend-dashboard-shell.test.ts:51-52                          shell router no renderiza <Admin|ClinicDashboardSidebar />
frontend-dashboard-horizontal-nav.test.ts:134-135               shell router no menciona los sidebars
```

No se convirtió ningún FAIL en `skip`, no se debilitó ninguna assertion y no se relajó ningún
guard de scope.

### Comentarios de barrels

`presentation/navigation/index.ts` y `presentation/layout/index.ts` describían los componentes
retirados como pendientes de B02. Solo prosa; cero cambio de exports.

## Invariantes preservadas

| Dominio | Estado |
|---|---|
| Runtime observable | cero cambio (0 importadores runtime antes del retiro) |
| DOM · CSS · navegación · rutas | cero cambio |
| API · auth · sesiones/cookies | cero cambio |
| `limit`/`offset` · zero-scroll | cero cambio |
| DB · dependencias · CI/workflows | cero cambio |

## Validaciones

| Gate | Estado |
|---|---|
| `dashboard-dead-component-retirement.test.ts` (dirigido) | PASSED |
| `dashboard-presentation-import-boundaries.test.ts` (dirigido) | PASSED |
| 16 suites afectadas (dirigido, 149 tests) | PASSED |
| Mutation controls M1/M1b/M2/M3 | PASSED (fail-closed) |
| `pnpm validate:local` | PASSED |
| `pnpm --dir frontend lint` | PASSED |
| `pnpm --dir frontend typecheck` | PASSED |
| `pnpm --dir frontend build` | PASSED |
| `pnpm security:public-surface` | PASSED |
| `git diff --check` | PASSED |
| Playwright | NOT_RUN — justificado |

### Mutation controls

| # | Mutación (sobre copia aislada, fuera del árbol versionado) | Resultado |
|---|---|---|
| M1 | recrear `StickyFilterBar.tsx` en su path original | FAIL (invariantes 1 y 2) |
| M1b | recrear `DashboardSidebarFrame.tsx` bajo **otra** carpeta | FAIL (invariante 2) |
| M2 | añadir re-export de `AdminDashboardSidebar` al barrel `navigation` | FAIL (invariantes 3 y 4) |
| M3 | añadir `import { FilterDrawer }` a `DashboardShellRouter` | FAIL (invariante 3) |
| — | baseline restaurado | PASS |

### Playwright — justificación de NOT_RUN

Los seis componentes tenían **0 importadores runtime** antes del retiro; el retiro no cambia
ninguna ruta, ningún JSX vivo, ningún CSS y ninguna geometría. No hay superficie renderizada que
E2E pueda observar. Playwright no se usó para justificar el retiro: la demostración es estática y
está en el censo de arriba.

## Rollback

`git revert` del commit de B02. Restaura los seis archivos, los tests realineados y los
comentarios de barrels; retira el contrato de arquitectura. Sin migraciones, sin cambios de
esquema, sin efecto productivo.

## Riesgos residuales

- **Cobertura contractual perdida junto con el código muerto.** Los tests eliminados describían
  clases Tailwind y ARIA de componentes que ya no existen. Si B07 reintroduce un rail/drawer, su
  contrato se escribe nuevo contra el diseño de B07; no se recupera de aquí.
- **`admin-dashboard-sections-contract`** ya no cruza el catálogo de módulos contra una fuente de
  navegación. El mapeo `?module=` ↔ ancla renderizada sigue contratado, y la navegación viva
  (`DashboardHorizontalNav`) tiene sus propios contratos, pero el cruce específico sidebar↔ancla
  desaparece con el sidebar.
- **Comentario obsoleto en E2E.** `frontend/e2e/platform/accessibility/dashboard-accessibility-keyboard.spec.ts`
  conserva un encabezado de sección `// ─── FilterDrawer ───` sobre un bloque que en realidad
  prueba los filtros compactos vivos. Es prosa, no una referencia que cargue el módulo; se deja
  intacto para no tocar el catálogo E2E en un PR de retiro.
- **Deriva de estimación del roadmap:** §56.1 preveía «ajustar 3 tests» y fueron 13 archivos.
  Registrado aquí; el roadmap canónico no se reescribe desde este PR.
