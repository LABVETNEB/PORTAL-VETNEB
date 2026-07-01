# PR-QA-GLOBAL-0: Global adaptive dashboard contract baseline

## Estado base

- Fecha: 2026-07-01.
- Rama base: `main`.
- HEAD base: `c7e3ed5 fix(clinic): activate adaptive token row measurement (#1213)`.
- Rama de trabajo: `test/global-adaptive-dashboard-contract-baseline`.
- Working tree inicial: limpio.
- PRs abiertos al inicio: 0.
- Ramas locales al inicio: solo `main`.
- Ramas remotas no mergeadas contra `origin/main`: 0.

## Scope incluido

- Baseline e2e global en `frontend/e2e/dashboard-viewport-zoom-adaptability.spec.ts`.
- Documento de entrega en `docs/implementation/global-adaptive-dashboard-contract-baseline.md`.
- Validación observable de contrato global en superficies reales ya cubiertas por e2e:
  - Clínica: hub, Informes, Tokens particulares, Logística y rutas full-page de Informes/Logística.
  - Admin: hub, Resumen/Alertas, Mantenimiento y Usuarios/Roles.
  - Particular: entrada pública token-gated de `/particulares` en estado no autenticado.

## Scope excluido

- No se migra ningún módulo.
- No se toca producción TSX, hooks, CSS, backend, API, auth, DB, migraciones, CI, dependencias, lockfiles, snapshots ni tests unitarios.
- No se adapta Admin servidor ni se modifica `limit/offset`.
- No se trata Particular como dashboard paginado.
- No se agregan fixtures de sesión particular autenticada sin contrato previo confirmado.

## Auditoría previa

- Se leyeron los documentos rectores:
  - `docs/audit/global-zero-scroll-adaptive-dashboard-matrix.md`.
  - `docs/audit/vetneb-enterprise-operational-platform-extreme-excellence-advisory.md`.
  - `docs/implementation/clinic-tokens-adaptive-rows-per-page.md`.
- Se confirmaron scripts nativos disponibles:
  - `pnpm test`.
  - `pnpm typecheck:test`.
  - `pnpm --dir frontend lint`.
  - `pnpm --dir frontend build`.
- Se confirmaron los e2e dirigidos indicados:
  - `frontend/e2e/dashboard-viewport-zoom-adaptability.spec.ts`.
  - `frontend/e2e/dashboard-clinic-tokens-mobile-parity.spec.ts`.
  - `frontend/e2e/dashboard-internal-no-scroll-contract.spec.ts`.
  - `frontend/e2e/dashboard-global-masked-master-detail.spec.ts`.
- Se identificó cobertura Admin poblada existente, pero PR-QA-GLOBAL-0 se mantuvo en el spec global permitido para no ampliar scope.
- Se identificó `/particulares` con selectores `data-particulares-*`; no se confirmó fixture e2e de sesión particular token-gated autenticada.

## Cambios

- `dashboard-viewport-zoom-adaptability.spec.ts` ahora mide, además del scroll global, el peor scroll vertical interno real dentro de `main.dashboard-main`.
- El hub Clínica queda marcado como deuda observada para scroll interno medido: en la primera corrida estricta aparecieron `dashboard-inline-list` con 12px de overflow en tablet 768x1024 y 238px en mobile 390x844. PR-QA-GLOBAL-0 no lo transforma en gate porque no migra módulos.
- Clínica Tokens agrega baseline específico:
  - filas/cards visibles asentadas;
  - pager/footer visible;
  - body sin scroll vertical interno;
  - filas/cards dentro de la región medida;
  - gap controlado cuando hay más datos que filas visibles;
  - comparación entre viewport alto y viewport efectivo compacto para verificar cardinalidad adaptativa observable.
- Admin queda cubierto por las superficies existentes del spec global, reforzadas con detección de scroll vertical interno medido.
- Particular agrega baseline público de entrada token-gated:
  - panel primario visible en primer viewport;
  - input de token visible;
  - acción `Ingresar` visible;
  - estado de próximos pasos visible;
  - sin overflow horizontal;
  - sin scroll vertical interno dentro del panel primario;
  - pliegue controlado de primer viewport en 1280x720 efectivo, sin exigir sesión autenticada.

## Archivos modificados

- `frontend/e2e/dashboard-viewport-zoom-adaptability.spec.ts`.
- `docs/implementation/global-adaptive-dashboard-contract-baseline.md`.

## Validaciones

Ejecutadas con PNPM 10.8.1 explícito (`C:\Program Files\nodejs\pnpm.CMD`) porque el PNPM 11 del runtime Codex ignora `pnpm.overrides` de `package.json` y falla contra el lockfile congelado.

- `pnpm test` — pasó: 2905/2905.
- `pnpm typecheck:test` — pasó.
- `pnpm build` — pasó.
- `pnpm security:public-surface` — pasó sin hallazgos públicos; reportó sólo marcadores server-only esperados en `frontend/src/proxy.ts`.
- `pnpm --dir frontend lint` — pasó.
- `pnpm --dir frontend typecheck` — pasó.
- `pnpm --dir frontend build` — pasó.
- `pnpm --dir frontend exec playwright test e2e/dashboard-viewport-zoom-adaptability.spec.ts` — pasó: 60/60.
- `pnpm --dir frontend exec playwright test e2e/dashboard-clinic-tokens-mobile-parity.spec.ts` — pasó: 3/3.
- `pnpm --dir frontend exec playwright test e2e/dashboard-internal-no-scroll-contract.spec.ts` — primer intento 7/8 por `net::ERR_NO_BUFFER_SPACE`; reintento pasó: 8/8.
- `pnpm --dir frontend exec playwright test e2e/dashboard-global-masked-master-detail.spec.ts` — pasó: 16/16.

## Resultado

Baseline global agregado y validado. No se migraron módulos ni se cambió producción.

## Riesgo residual

- Particular autenticado queda `NO CONFIRMADO / requiere fixture`: este PR sólo valida la entrada pública token-gated en estado no autenticado.
- Admin servidor queda como deuda observada: el spec valida fit/no-scroll/no-clipping medible, pero no cambia `PAGE_SIZE`, `MOBILE_PAGE_SIZE`, `matchMedia` ni `limit/offset`.
- Hub Clínica en tablet/mobile conserva deuda de scroll interno medido en `dashboard-inline-list`; documentado como deuda para PR posterior, no corregido en este PR.
- El baseline de Tokens depende de medición real de filas/cards en Chromium; la corrida dirigida pasó estable en este PR.

## Estado final

Pendiente de stage/commit/push/PR por Nico según protocolo local.
