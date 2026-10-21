# PR-DRV-03 · Foco visible en forced-colors dentro de los overlays portados a `body`

## Estado base, autorización y alcance

- Rama `fix/dashboard-drv03-forced-colors-overlay-focus`, base `9dfb5024319e3d6747b9c659a83a60525fb9392c` (= `main` = `origin/main`, C23b PR5 #1897). Al iniciar, el árbol tracked estaba limpio. Untracked preservados: la propuesta `docs/audit/PROPUESTA_EVOLUCION_DASHBOARD_VETNEB_DESDE_DRIVE.md` (v2, rama documental aparte) y `frontend/AGENTS.md`, que `next dev` regenera. Sin stashes; worktrees ajenos C17 y D10 intactos. No hay `AGENTS.md` anidados tracked.
- Autorización de Nico (2026-10-20): implementación local y validación de las dos PRs obligatorias de D-02 de la propuesta v2. Sin commit, push, PR ni merge. Sin R13, sin R3 y sin staging (G12).
- Origen: residual de C25 §8 y verificación «foco visible bajo `forced-colors`» de la validación de accesibilidad que ejecuta C26 (rector §56.6).
- Incluido: una regla CSS sin capa, sólo para forced-colors, en `styles/dashboard/interactions.css`; un ancla `data-clinic-edit-drawer` en `ClinicEditDrawer`; un spec E2E; la sección del guard; el catálogo y sus censos.
- Excluido: modo de color normal, migración de portales, geometría, tokens, fixtures A02/A03/A05/A08, ledger C23b, C24, backend, dependencias y CI.

## Causa

Tailwind `^4.3.3` compila `focus-visible:outline-none` a `outline-style: none` en `@layer utilities`. La regla base `:focus-visible` de `globals.css:192` vive en `@layer base` y pierde. Dentro del shell, el bloque C25 sin capa restituye el outline. Los overlays que se montan con portal en `document.body` quedan **fuera** de `.dashboard-app-shell`, así que conservan sólo el anillo de `box-shadow`, que forced-colors descarta.

## Censo de overlays portados a `body`

| Overlay | Portal | Resultado RED | Tratamiento |
| --- | --- | --- | --- |
| `ModuleDialog` sin `dashboardScopedPortal` (19 de 22 sitios) | Radix, `body` | 6 controles sin outline (detalle de Tokens admin) | Cubierto (`[data-module-dialog]`) |
| `ClinicEditDrawer` | Radix, `body` | 7 controles sin outline | Cubierto; ancla nueva `data-clinic-edit-drawer` |
| `AdvancedFilterSheet` sin `dashboardScopedPortal` (S3, Informes admin) | Radix, `body` | 9 controles sin outline (teléfono) | Cubierto (`[data-advanced-filter-sheet]`) |
| Panel de notificaciones del teléfono (`DashboardNotificationsBell`) | `createPortal`, `body` | 3 controles sin outline | Cubierto (`[data-dashboard-notifications-mobile-panel]`) |
| `DocumentViewer` (C15) | Radix, `body` | **0**: ya tiene outline propio | Sin cambio |
| Banner móvil de notificaciones | `createPortal`, `body` | No alcanzable: el fixture no tiene notificaciones sin leer | Sin cambio: su único control no declara `outline-none` y hereda la regla base |
| Proxies de chip de `ModuleCard` | `createPortal`, `body` | No aplica: `tabIndex=-1` y `aria-hidden` | Sin cambio |
| `UploadReportModal` | `createPortal`, `body` | No aplica: **0 consumidores productivos** | Sin cambio (se corrige el censo de C25 §8) |

Total RED: **25 controles** sin indicador en forced-colors en 4 overlays.

## Implementación

- `interactions.css`, bloque `dashboard-drv03-forced-colors-overlay-focus`, ubicado después del bloque C25: `@media (forced-colors: active) { :where(<4 anclas>) :where(<controles>):focus-visible { outline: 2px solid CanvasText; outline-offset: 2px; } }`.
  - Va **sin capa** por el mismo motivo que C25 G1.
  - `:where` deja la especificidad en (0,1,0).
  - La lista de controles es la de C25, con la misma exclusión de `tabindex="-1"`.
  - Sólo `outline`, que no ocupa layout.
  - En modo normal no se aplica: las capturas no cambian.
- `ClinicEditDrawer.tsx`: `data-clinic-edit-drawer="true"` en `Dialog.Content`, sin lexemas sensibles (`security:public-surface` PASSED).
- Se descartó migrar los overlays a `dashboardScopedPortal`: cambia apilamiento y contención con más riesgo y el mismo beneficio.

## Pruebas

- **E2E** `e2e/regression/dashboard-drv03-forced-colors-overlay-focus.spec.ts` (cohorte `visual-contract`, fixture poblada; GET de clínicas y URL firmada del visor con datos sintéticos):
  - Con `forcedColors: "active"`, enfoca en modalidad teclado cada control habilitado, pintado y tabulable de cada overlay.
  - Exige `:focus-visible` y un `outline` real.
  - Verifica que el overlay está fuera del shell y que no hay scroll de documento.
  - Un caso de control en modo normal comprueba que el botón de cierre de `ModuleDialog` sigue con `outline-style: none`.
- **Guard** (sección de `test/architecture/dashboard-b11-workspace-header.test.ts`, como C25):
  - Bloque único, sin capa, dentro de `@media (forced-colors: active)` y con `:where`.
  - Cubre las 4 anclas y los controles, excluye `tabindex="-1"` y declara sólo `outline`.
  - Las 4 anclas existen en sus owners.
  - Rechaza 6 mutantes: capa, `@media all`, `outline: none`, `box-shadow`, ancla del drawer quitada y `[tabindex]` sin exclusión.
- **Catálogo:** 124 → 125. Realineados regression 29, mocked 48, visual-contract 47, ci 94, full 125, unión CI 94, selección compartida 94 y mensajes 124/126, más `e2e-completeness-workflow` 125. Ninguna aserción se debilitó.

## Gates de la implementación inicial (2026-10-20)

| Gate | Estado |
| --- | --- |
| RED en `HEAD` (spec nuevo, sin CSS) | FAILED como se esperaba: 4 overlays, 25 controles; el visor y el control de modo normal pasaron |
| GREEN spec PR-DRV-03 (`.next` borrado) | PASSED 6/6 |
| Guard B11 completo (incluye C25 y PR-DRV-03) | PASSED 51/51 |
| `pnpm --dir frontend e2e:verify-catalog` | PASSED 7/7 |
| E2E dirigido: PR-DRV-03 + `admin-clinic-edit-drawer` + A02 21×13 + A08 21×13 | PASSED 60/60 |
| `pnpm --dir frontend lint`, `typecheck`, `build` | PASSED |
| `pnpm security:public-surface` | PASSED |
| `pnpm typecheck:test` | PASSED |
| `pnpm test` | FAILED 5406/5414 (1 skip), 7 fallos. 6 son **BLOCKED** por precondición: `e2e-residual-determinism`, `e2e-session-origin-source-of-truth` y `e2e-zero-scroll-regime` (4 casos) rechazan el spec nuevo con «source path is not a git-tracked file»: el lector canónico sólo acepta archivos trackeados y el agente no tiene delegado `git add`. Revisión estática: el spec no usa `waitForTimeout`, `setTimeout`, `.catch` vacíos, `addCookies`, orígenes ni literales de sesión, y compara el scroll contra `MAX_DOCUMENT_SCROLL_DELTA_PX` importado. El 7.º es `e2e-global-03b-authoritative-auth-boundary`: precondición ambiental preexistente (`DATABASE_URL`/`SUPABASE_DB_URL`) |
| A03 / A05 | NOT_RUN: la regla sólo actúa en forced-colors y no ocupa layout; A02 (cajas) y A08 en PASSED |
| `e2e:visual-contract` completo, A02/A03 Linux | NOT_RUN localmente (cohorte de 30+ min; Linux sólo en CI) |
| `e2e:full` | NOT_RUN (sin pedido) |
| `git diff --check` (más los 2 untracked nuevos) | PASSED |
| Artefactos | `frontend/next-env.d.ts` sin cambios; `frontend/test-results/` ignorado, fuera del diff; `frontend/AGENTS.md` regenerado por `next dev`, untracked y fuera del scope |

**Pendiente tras el staging de Nico:** con los 8 paths de la PR en el índice, repetir los 3 archivos de guard bloqueados (`e2e-residual-determinism`, `e2e-session-origin-source-of-truth`, `e2e-zero-scroll-regime`) y `pnpm --dir frontend e2e:verify-catalog`.

## Corrección de E2E-GLOBAL-11 (2026-10-21)

El guard de `test/architecture/e2e-mock-backend-contract.test.ts` no resolvía el identificador `SIGNED_URL` usado como matcher en el `page.route` de DocumentViewer. La ruta quedaba indeterminada para su análisis estático y fallaban el censo de overrides y las mutation proofs 4 y 5. Se sustituyó ese identificador por el mismo literal regex en la llamada y se eliminó la constante sin consumidores. El patrón y el `route.fulfill` con el PNG sintético son idénticos; el `page.route` del listado de clínicas no cambió. El test E2E del visor confirma que la imagen sigue cargando.

| Gate de esta corrección | Estado |
| --- | --- |
| E2E-GLOBAL-11, incluidas mutation proofs 4 y 5 | PASSED 12/12 |
| B11, catálogo, workflow de completitud y guards de determinismo, sesión y zero-scroll | PASSED 79/79 |
| `pnpm --dir frontend e2e:verify-catalog` | PASSED 7/7 |
| `pnpm typecheck:test` | PASSED |
| E2E dirigido PR-DRV-03, incluido DocumentViewer | PASSED 6/6 |
| Frontend lint, typecheck, build y `security:public-surface` | PASSED cada uno |
| `pnpm validate:local` | FAILED: typecheck y typecheck:test pasaron; `pnpm test` terminó con 5412 passed, 1 failed y 1 skipped de 5414; `pnpm build` no se ejecutó por fail-fast |
| `pnpm build` aislado tras el fail-fast | PASSED |
| E2E-GLOBAL-03B dirigido | BLOCKED: el test aborta antes de abrir Fastify por falta de `DATABASE_URL` o `SUPABASE_DB_URL` hacia `portal_vetneb_ci` local |
| A02/A08 y `e2e:visual-contract` completo | NOT_RUN en esta corrección: no cambiaron CSS, geometría, fixture ni esos contratos; el E2E dirigido sí verificó foco y ausencia de scroll en las superficies de PR-DRV-03 |

El puerto local 5432 aceptó TCP, pero sin una URL autorizada no se puede verificar la existencia de `portal_vetneb_ci` ni su esquema. No se ejecutaron migraciones ni se tocó backend o DB. El único fallo restante de la suite es la precondición ambiental de 03B; no hay evidencia de un defecto de aplicación. La rama necesita repetir 03B y `validate:local` con esa DB aislada antes de publicar una validación completa.

## Riesgos residuales

- El banner móvil de notificaciones no se pudo ejecutar con el fixture; queda cubierto por la regla base, no por esta PR.
- Un overlay nuevo portado a `body` sin una de las 4 anclas no queda cubierto: el guard sólo protege las existentes.
- `CanvasText` lo resuelve el sistema; el navegador puede sustituir el color del outline por el del tema de alto contraste, como corresponde.

## Rollback

`git revert` del commit squash: se retiran la regla, el ancla, el spec, la sección del guard y la entrada de catálogo con sus censos. Sin impacto en datos, backend ni baselines.
