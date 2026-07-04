# Fix admin mobile hub tile stability

- Fecha: 2026-07-04
- Rama: `visual/global-dashboard-premium-system`
- Base: `fc47594 feat(dashboard): redesign premium global dashboard system`

## Estado base

- `git status --short` inicial: limpio.
- Rama actual: `visual/global-dashboard-premium-system`.
- Test afectado reportado: `frontend/e2e/admin-mobile-module-layer-isolation.spec.ts`.
- Selector afectado: `[data-admin-mobile-hub-launcher="true"] [data-admin-mobile-hub-tile="admin-particular-tokens"]`.

## Scope incluido

- Estabilizar el click del tile mobile del Admin hub.
- Mantener data attributes, labels, rutas y modulo `admin-particular-tokens`.
- Mantener diseño premium, contrato no-scroll e isolated paint layers.
- Actualizar documentacion de implementacion existente.

## Scope excluido

- Backend, API, auth, DB, Supabase, migraciones, dependencias, lockfiles y CI.
- Cambios de permisos, rutas, logica operativa de modulos o tests.
- Commits, push y PR.

## Auditoria previa

- Hub localizado en `frontend/src/components/dashboard/AdminMobileHubLauncher.tsx`.
- Tile localizado en `frontend/src/components/dashboard/AdminMobileLauncherTile.tsx`.
- Activacion de modulo localizada en `frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx`.
- CSS relacionado localizado en `frontend/src/app/globals.css`.
- No se encontro key inestable en el tile: la key usa `card.moduleId`.
- No se encontro condicion destructiva por breakpoint en el componente del tile.
- La causa fuente esta en el desmontaje sincronico del Hub al ejecutar `card.onClick` durante la accion de click.

## Cambios

- `AdminMobileLauncherTile` ahora difiere la ejecucion de `card.onClick` con `requestAnimationFrame` + `setTimeout(0)`.
- El nodo del boton queda montado durante la accion nativa de click.
- La activacion existente del modulo, URL, workspace y labels queda intacta.

## Archivos modificados

- `frontend/src/components/dashboard/AdminMobileLauncherTile.tsx`
- `docs/implementation/global-dashboard-premium-system.md`
- `docs/audit/fix-admin-mobile-hub-tile-stability.md`

## Validaciones

- `pnpm playwright test e2e/admin-mobile-module-layer-isolation.spec.ts --project=chromium --grep "admin mobile modules keep isolated paint layers"`: paso, 3/3.
- `pnpm playwright test e2e/admin-mobile-module-layer-isolation.spec.ts e2e/admin-tokens-mobile-toolbar-layout.spec.ts --project=chromium`: paso, 19/19.
- `pnpm test`: paso, 2955/2955.
- `pnpm typecheck`: paso.
- `pnpm build`: paso.
- `pnpm security:public-surface`: paso; sin hallazgos publicos, con marcadores server-only conocidos en `frontend/src/proxy.ts`.
- `pnpm --dir frontend lint`: paso.
- `pnpm --dir frontend typecheck`: paso.
- `pnpm --dir frontend build`: paso.
- `pnpm --dir frontend e2e:visual-contract`: paso, 273/273.
- `pnpm lint` en raiz: no ejecutado; el script no existe en `package.json`.

## Resultado

- El tile `admin-particular-tokens` conserva el nodo durante el click.
- La transicion Hub -> workspace sigue ocurriendo y el workspace se monta correctamente.
- No se modificaron tests ni timeouts.
- No se uso force click ni skip.

## Riesgo residual

- Bajo. La activacion desde tiles del hub mobile se posterga un frame/macrotask para respetar la estabilidad DOM del click.
- No hay cambio de datos, permisos, endpoints, cookies, auth ni persistencia.

## Estado final

- Implementacion frontend acotada.
- Documentacion actualizada en `docs/implementation` y `docs/audit`.
- Queda pendiente que Nico realice stage, commit, push, PR y checks manuales.

---

## CI follow-up: deterministic hub activation

### CI failure
- Spec: `frontend/e2e/admin-mobile-module-layer-isolation.spec.ts:316` — "admin mobile modules keep isolated paint layers".
- Viewport: `iphone-pro-max-430x932`.
- Selector: `[data-admin-mobile-hub-launcher="true"] [data-admin-mobile-hub-tile="admin-particular-tokens"]`.
- Error: `locator.click timeout — element was detached from the DOM, retrying`.
- Why previous fix was insufficient: el diferimiento por `requestAnimationFrame` + `setTimeout(0)`
  es timing-based, no estructural. No garantiza en qué punto del ciclo de vida del click
  aterriza el desmontaje: sólo corre la ventana. En un runner CI lento (frames rAF que se
  estiran a cientos de ms y chequeos de actionability de Playwright que se alargan entre
  resolución del nodo y dispatch del input), la ventana corrida sigue cruzándose con la
  acción nativa. Además introduce no-determinismo explícitamente prohibido por el protocolo.

### Root cause
- `activateModule` ejecutaba `setActiveModule(moduleId)` directamente dentro del `onClick`
  del tile. React procesa los eventos discretos con **flush síncrono**: el estado se aplica
  y el commit que desmonta el hub launcher (swap hub→workspace) ocurre **dentro del ciclo
  de vida del click nativo**. Localmente la secuencia de input de Playwright suele completar
  antes del commit; bajo el timing estirado del runner CI el desmontaje aterriza en medio de
  la acción y Playwright ve el tile clickeado "detached from the DOM".
- Diagnóstico validado empíricamente en local con instrumentación temporal (no commiteada):
  MutationObserver sobre el stage + stamps de identidad de nodo del tile + CPU throttling 6x
  vía CDP + delay selectivo del fetch RSC. Se descartaron las hipótesis alternativas
  (re-paginación del pager: es `useState` puro sin efectos; churn de re-render por commits
  RSC: la identidad del nodo del tile permanece estable ≥4s tras cada retorno al hub;
  override por commit de URL tardío: la action queue del router descarta commits superados).

### Final solution
1. **Activación en dos commits** (`AdminDashboardWorkspaceController.tsx`): el `onClick`
   del tile sólo registra la intención en `pendingActivation` (estado que NO cambia el
   render del launcher). Un `useEffect` la promueve en el commit siguiente
   (`setActiveModule` + `router.push`). El tile clickeado permanece montado, visible,
   estable y attached durante TODO el ciclo del click, por orden de commits de React —
   determinista, sin timers.
2. **Guard de intención de navegación** (`pendingNavigationIntent`, mismo archivo): toda
   activación sync (tile, hero CTA, señal bottom-nav, hub-reset) registra su objetivo; el
   efecto de sincronización con `searchParams` consume la intención en el primer commit
   posterior y descarta un commit que no coincida (navegación superada), en vez de aplicarlo
   ciegamente sobre el estado optimista. Consumo one-shot: back/forward y deep links nunca
   se bloquean más de un commit y sólo dentro de la ventana optimista sub-segundo.
3. **Revert del diferimiento rAF/setTimeout** en `AdminMobileLauncherTile.tsx`: vuelve al
   `onClick={card.onClick}` directo (el diferimiento atacaba un no-mecanismo y agregaba
   no-determinismo).

### Scope gate: ClinicDashboardWorkspaceController
- Decisión: **Mantener Clínica**.
- Causa: el diff de `ClinicDashboardWorkspaceController.tsx` replica el mismo patrón
  determinístico aplicado en Admin y corrige la misma clase de carrera estructural:
  las acciones del cockpit clínico también promovían el módulo de forma síncrona
  (`setActiveModule` + `router.push`) desde el click, desmontando el hub/cockpit en
  el mismo ciclo nativo de interacción.
- Evidencia del diff: se agregan `pendingActivation`, `pendingNavigationIntent`, guard
  one-shot del efecto de `searchParams`, promoción posterior por `useEffect` y marca de
  intención en activaciones sync (`subscribeClinicModuleActivate`, bottom-nav/hub reset
  y `backToHub`). Se elimina sólo la activación directa desde `activateModule`.
- Paridad preservada: no cambia `ROUTES.dashboard`, no cambia `?module=`, no agrega ni
  elimina módulos, no cambia permisos, no toca auth, no toca contratos data-* y conserva
  deep links, back/forward, bottom-nav, hub reset y retorno a Vista general.
- Alcance: se incluye en este PR por paridad estructural del patrón de navegación, no por
  rediseño nuevo ni por cambio visual clínico. `ClinicDashboardWorkspaceController.tsx`
  queda agregado al set esperado para el commit manual.
- Validación clínica específica: `pnpm playwright test
  e2e/dashboard-card-navigation-shell.spec.ts
  e2e/dashboard-clinic-controller-workspace-parity.spec.ts
  e2e/dashboard-clinic-mobile-nav-stage-parity.spec.ts --project=chromium`: 99/99.

### Visual contract preserved
- Enterprise dashboard language: sin cambios visuales; hub launcher, tiles, acentos por
  módulo y jerarquía premium intactos (cambio de lógica de activación, no de presentación).
- Zero-scroll: `e2e:visual-contract` 273/273; contratos de capas/no-scroll admin mobile verdes.
- Touch targets: tiles y bottom-nav sin cambios de geometría.
- Safe-area: sin cambios (CSS intacto).
- Module accessibility: mismos `data-admin-mobile-hub-tile`, mismos aria-labels, mismo
  propósito accesible; los 10 módulos siguen alcanzables por hub, bottom-nav y menú "Más".
- Functions preserved: activación de módulos, URL `?module=`, last-module, hub-reset,
  workspaces y navegación operativa idénticos.

### Validations
- Validaciones previas del fix admin:
- `playwright test e2e/admin-mobile-module-layer-isolation.spec.ts --grep "isolated paint layers"`: 3/3.
- Suite relacionada (`admin-mobile-module-layer-isolation` + `admin-tokens-mobile-toolbar-layout`): 19/19.
- Stress `--repeat-each=3 --workers=2` de ambas: 57/57 (una corrida previa mostró 1 flake
  del test de paint-chain dark bajo carga, re-verificado 3/3 aislado; patrón de carga local).
- Reproducción CI-fidelity temporal (secuencia completa sesiones→hub→auditoría→hub→tokens
  bajo CPU throttle 6x, 3 repeticiones): 3/3, swap-log limpio sin remounts espurios.
- `pnpm e2e:visual-contract`: 273/273.
- `pnpm e2e:admin-mobile` (suite completa, 13 specs en paralelo): 1 fallo rotativo por
  corrida en specs NO relacionados (`final-polish`, `core-modules`), cada uno verde aislado
  y bajo stress dirigido 8/8. **Control con stash:** la base SIN este fix falla igual
  (131/132 y 130/132) — flakiness local de contención de suite preexistente, no regresión.
- `pnpm test`: 2955/2955. `pnpm typecheck` / `typecheck:test`: pass.
- `pnpm --dir frontend lint` / `typecheck` / `build`: pass. `pnpm build`: pass.
- `pnpm security:public-surface`: PASS.
- Instrumentación temporal (`__repro-detach.spec.ts`) eliminada antes de la entrega;
  `frontend/next-env.d.ts` restaurado al contenido del repo.

### Scope gate revalidation (2026-07-04)
- `pnpm playwright test e2e/dashboard-card-navigation-shell.spec.ts
  e2e/dashboard-clinic-controller-workspace-parity.spec.ts
  e2e/dashboard-clinic-mobile-nav-stage-parity.spec.ts --project=chromium`: 99/99.
- `pnpm typecheck`: pass.
- `pnpm build`: pass.
- `pnpm security:public-surface`: pass.
- `pnpm --dir frontend lint`: pass.
- `pnpm --dir frontend typecheck`: pass.
- `pnpm --dir frontend build`: pass.
- `pnpm --dir frontend e2e:visual-contract`: 273/273.
- `pnpm test`: fail por contaminación local fuera de scope en `.claude/worktrees`.
  Las fallas finales son guardrails `public-professionals-fixture-*` que escanean
  copias bajo `.claude/worktrees/{confident-kowalevski-8f883a,interesting-hugle-b6592f,vigilant-almeida-3ba1ec}/test/...`.
  No se tocaron esos worktrees, no se modificaron tests y no se amplió scope para
  limpiar archivos generados por otros agentes.
