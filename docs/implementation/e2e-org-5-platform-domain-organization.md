# E2E-ORG-5 platform domain organization

Fecha: 2026-07-17

## Estado base

- Rama: `test/e2e-organize-platform-domain`.
- HEAD inicial: `45f2ebd744771b33d35b6a587b9ed3878c91cd79`.
- Base sincronizada con `origin/main`.
- Working tree inicial limpio.
- PRs abiertos al inicio: 0.
- Gestor: `pnpm@11.13.0`.

## Objetivo

Reorganizar los 18 specs del dominio `platform` que permanecían en la raíz de
`frontend/e2e/` bajo la ubicación canónica `frontend/e2e/platform/**`.

El cambio es exclusivamente arquitectónico:

- preserva títulos, assertions, fixtures y comportamiento;
- preserva cohortes y metadata;
- preserva 72 specs y 785 tests descubiertos;
- no modifica runtime de producto;
- no modifica backend, API, auth, DB, dependencias, lockfiles o workflows.

## Scope incluido

- Movimiento de 18 specs.
- Actualización de sus 18 paths en `frontend/e2e/suites/catalog.ts`.
- Orden lexicográfico global del catálogo.
- Corrección del único import relativo afectado.
- Migración de la aplicabilidad legacy desde `frontend/e2e/dashboard*` hacia los
  destinos canónicos `dashboard-*` de `platform/accessibility`,
  `platform/app-shell` y `platform/auth`, sin clasificar todo `platform` como
  dashboard scope.
- Preservación del prefijo `frontend/e2e/clinic`.
- Corrección del path legacy remanente en
  `test/architecture/e2e-suite-catalog-completeness.test.ts` (aserción del
  entry `logout`), detectado por el guard de catálogo pre-stage.

## Scope excluido

- `frontend/src/**`.
- Backend, API, auth, DB, schema y migraciones.
- Dependencias, manifiestos, lockfiles, CI y workflows.
- Fixtures y helpers E2E compartidos.
- Configuración Playwright.
- Cambios de assertions, títulos, retries, skips, expected failures o timeouts.
- Corrección del defecto P1 de Informes.
- Modificación de:
  - `frontend/e2e/admin/users/admin-users-workspace-mobile-5000.spec.ts`;
  - `frontend/e2e/clinic/reports/clinic-reports-workspace-1000.spec.ts`.

## Movimientos

### Accessibility

- `frontend/e2e/accessibility-axe-key-routes.spec.ts`
  -> `frontend/e2e/platform/accessibility/accessibility-axe-key-routes.spec.ts`
- `frontend/e2e/dashboard-accessibility-keyboard.spec.ts`
  -> `frontend/e2e/platform/accessibility/dashboard-accessibility-keyboard.spec.ts`

### App shell

- `frontend/e2e/dashboard-app-shell-visibility-contract.spec.ts`
  -> `frontend/e2e/platform/app-shell/dashboard-app-shell-visibility-contract.spec.ts`
- `frontend/e2e/dashboard-card-navigation-shell.spec.ts`
  -> `frontend/e2e/platform/app-shell/dashboard-card-navigation-shell.spec.ts`
- `frontend/e2e/dashboard-global-masked-master-detail.spec.ts`
  -> `frontend/e2e/platform/app-shell/dashboard-global-masked-master-detail.spec.ts`
- `frontend/e2e/dashboard-internal-no-scroll-contract.spec.ts`
  -> `frontend/e2e/platform/app-shell/dashboard-internal-no-scroll-contract.spec.ts`
- `frontend/e2e/dashboard-mobile-shell-nav-contract.spec.ts`
  -> `frontend/e2e/platform/app-shell/dashboard-mobile-shell-nav-contract.spec.ts`
- `frontend/e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts`
  -> `frontend/e2e/platform/app-shell/dashboard-real-app-shell-no-scroll-contract.spec.ts`
- `frontend/e2e/dashboard-single-viewport-app-shell.spec.ts`
  -> `frontend/e2e/platform/app-shell/dashboard-single-viewport-app-shell.spec.ts`
- `frontend/e2e/dashboard-viewport-zoom-adaptability.spec.ts`
  -> `frontend/e2e/platform/app-shell/dashboard-viewport-zoom-adaptability.spec.ts`
- `frontend/e2e/dashboard-workspace-layout-polish.spec.ts`
  -> `frontend/e2e/platform/app-shell/dashboard-workspace-layout-polish.spec.ts`
- `frontend/e2e/dashboard-zero-scroll-mobile-boundary.spec.ts`
  -> `frontend/e2e/platform/app-shell/dashboard-zero-scroll-mobile-boundary.spec.ts`

### Auth

- `frontend/e2e/dashboard-auth-redirect.spec.ts`
  -> `frontend/e2e/platform/auth/dashboard-auth-redirect.spec.ts`
- `frontend/e2e/dashboard-logout-private-cache.spec.ts`
  -> `frontend/e2e/platform/auth/dashboard-logout-private-cache.spec.ts`

### Hydration

- `frontend/e2e/contacto-hydration.spec.ts`
  -> `frontend/e2e/platform/hydration/contacto-hydration.spec.ts`
- `frontend/e2e/login-hydration.spec.ts`
  -> `frontend/e2e/platform/hydration/login-hydration.spec.ts`

### Smoke y theme

- `frontend/e2e/visual-smoke.spec.ts`
  -> `frontend/e2e/platform/smoke/visual-smoke.spec.ts`
- `frontend/e2e/theme-mode.spec.ts`
  -> `frontend/e2e/platform/theme/theme-mode.spec.ts`

## Corrección del import relativo

Diecisiete specs conservaron contenido idéntico.

`dashboard-logout-private-cache.spec.ts` requirió únicamente recalcular el import de
`next.config` debido a la nueva profundidad:

- anterior: `../next.config`;
- posterior: `../../../next.config`.

No se modificó ninguna otra línea funcional del spec.

## Corrección del guard de catálogo (test de arquitectura)

`test/architecture/e2e-suite-catalog-completeness.test.ts` contenía una
aserción que localizaba el entry `logout` por su path anterior al
movimiento:

- anterior: `entries.find((entry) => entry.path === "e2e/dashboard-logout-private-cache.spec.ts")`;
- posterior: `entries.find((entry) => entry.path === "e2e/platform/auth/dashboard-logout-private-cache.spec.ts")`.

Esta era la causa exacta del `FAILED` pre-stage del guard de catálogo: el
catálogo (`catalog.ts`) ya declaraba el path nuevo, pero esta aserción
buscaba el path viejo y no encontraba el entry (`assert.ok(logout)` fallaba).
Corregida la línea, el test dirigido corre 5/5 en verde de forma aislada
(`node --experimental-strip-types --experimental-specifier-resolution=node
--test test/architecture/e2e-suite-catalog-completeness.test.ts`).
No se modificó ninguna otra línea de ese archivo.

## Catálogo y cohortes

Estado verificado:

| Métrica | Resultado |
| --- | ---: |
| Entradas totales | 72 |
| Paths únicos | 72 |
| Entradas platform | 18 |
| Entradas bajo `e2e/platform/` | 18 |
| Platform en `smoke` | 5 |
| Platform en `visual-contract` | 10 |
| Platform fuera de CI actual | 3 |
| Cohorte `smoke` | 7 |
| Cohorte `visual-contract` | 11 |
| Cohorte `ci` | 42 |
| Cohorte `full` | 72 |

`dashboard-logout-private-cache.spec.ts` continúa en `extended` con
`targetGate: "future-p1"`.

## Dashboard scope guard

La sustitución inicial de `frontend/e2e/dashboard` por el prefijo completo
`frontend/e2e/platform` amplió accidentalmente la aplicabilidad de los legacy
dashboard guards a specs no-dashboard como hydration, theme, smoke y axe general.

La revisión P2 del PR #1489 confirmó que esa ampliación podía producir falsos
positivos en cambios legítimos de contacto o tema que también tocaran rutas/API.
La corrección conserva la semántica anterior y reconoce únicamente:

- `frontend/e2e/platform/accessibility/dashboard-*`;
- `frontend/e2e/platform/app-shell/dashboard-*`;
- `frontend/e2e/platform/auth/dashboard-*`.

Se preservaron `frontend/e2e/clinic`, los prefijos de runtime dashboard y
`test/frontend-dashboard`. Los specs platform de hydration, theme, smoke y
accessibility no-dashboard vuelven a ser no aplicables a estos guards legacy.

## Validaciones

| Validación | Estado |
| --- | --- |
| Inventario físico: 72 specs, 18 platform | PASSED |
| Catálogo en memoria: único y ordenado | PASSED |
| Scope guard inicial `clinic + platform` | PASSED técnicamente, posteriormente estrechado por revisión P2 |
| Playwright discovery: 785 tests en 72 archivos | PASSED |
| `e2e:smoke` | PASSED |
| `e2e:visual-contract` | PASSED |
| `e2e:extended` | FAILED: 177 passed, 5 fallos fuera del scope |
| Admin users mobile aislado, tres repeticiones | PASSED: 18/18 |
| Clinic reports 1000 aislado, tres repeticiones | FAILED: 12/15 |
| Teardown | PASSED: puertos 3000 y 3107 libres |
| Guard de catálogo pre-stage | FAILED por inventario basado en `git ls-files` |
| `pnpm validate:local` pre-stage | FAILED: 3106/3107 por el mismo guard |
| Stage de los 18 movimientos, `catalog.ts`, `dashboard-scope-guard.ts` y este documento | PASSED |
| Corrección del path legacy en `e2e-suite-catalog-completeness.test.ts` | PASSED |
| Guard de catálogo aislado post-fix (`node --test .../e2e-suite-catalog-completeness.test.ts`) | PASSED: 5/5 |
| `pnpm validate:local` post-fix | PASSED: 3107/3107 |
| Stage del test de arquitectura corregido y este documento | PASSED |
| Contratos platform de `extended` afectados por el movimiento | PASSED: 22/22 |
| Teardown final | PASSED: puertos 3000 y 3107 libres |
| Artefactos Playwright | `test-results` y `playwright-report` presentes, ignorados por Git y sin contaminación del working tree |
| PR Governance inicial | FAILED por headings/checkboxes ausentes en el body; body corregido en GitHub |
| Revisión P2 de dashboard scope | FIXED en `9fe9972`; CI del nuevo head pendiente |

## Auditoría de Claude sobre el fallo de Informes

La auditoría concluyó que el guard E2E existente está deliberadamente limitado a colapsos
posteriores a navegación mediante `searchParams`.

El fallo observado ocurre durante la carga inicial mediante `page.goto`, antes de cualquier
navegación por `searchParams`, y reproduce con un único worker.

Clasificación:

- manifestación agravada de un defecto P1 de producto;
- no regresión causada por E2E-ORG-5;
- no flake principal de infraestructura;
- no corresponde ampliar el expected failure;
- no corresponde modificar el spec dentro de E2E-ORG-5;
- requiere diagnóstico y corrección en una rama independiente.

E2E-ORG-5 cierra técnicamente con esta auditoría y conserva el contrato inicial como testigo
real del defecto de producto.

## Resultado

- 18 specs reorganizados bajo `frontend/e2e/platform/**`.
- Cero specs platform legacy en la raíz física.
- Catálogo actualizado y ordenado.
- Cohortes y metadata preservadas.
- Scope guard actualizado sin ampliar dashboard scope a todo `platform`.
- 72 specs y 785 tests preservados.
- Cero cambios de producto.
- Cero cambios en dependencias, lockfiles o workflows.

## Riesgos residuales

### P1 de Informes

La carga inicial de `/dashboard/informes` puede permanecer limitada a una sola fila.

Este defecto es ajeno a E2E-ORG-5 y debe abordarse en una rama y PR independientes.

### Validación dependiente del índice — cerrada

El guard de catálogo utiliza `git ls-files`. Después del stage reconoció correctamente los
18 movimientos. La referencia contractual legacy de
`dashboard-logout-private-cache.spec.ts` fue actualizada al path canónico y el guard aislado
pasó 5/5. La validación integral posterior pasó 3107/3107.

## Estado final de esta fase

- Rama: `test/e2e-organize-platform-domain`.
- Commit inicial del cambio: `2d8b6231a88dcab241bee13f5fbce207d3687263`.
- Corrección P2 del scope guard: `9fe9972bf1ef2f7b6e094b6fc17349a85ecb74cc`.
- PR abierto: #1489.
- Body del PR actualizado al contrato de governance.
- Review thread P2: pendiente de resolver después de registrar la corrección.
- CI del nuevo head: pendiente.
- Merge: NOT_RUN.

## Pendientes MANUAL-NICO

1. Esperar CI del nuevo head.
2. Confirmar PR Governance en verde.
3. Resolver el review thread P2 una vez reconocida la corrección.
4. Autorizar merge en mensaje separado.
