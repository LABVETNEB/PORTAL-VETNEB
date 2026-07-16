# E2E-ORG-4 public and particular domain organization

Fecha: 2026-07-15

## Estado base

- Rama: `test/e2e-organize-public-particular-domain`.
- HEAD inicial: `5a67ea11bbfd67f9a6b89e67eaa5ecefd8598e26`.
- `origin/main`: `5a67ea11bbfd67f9a6b89e67eaa5ecefd8598e26`.
- Working tree inicial: limpio, sin staged, sin untracked.
- Worktree unico: `C:/PORTAL-VETNEB`.
- Rama de trabajo inexistente antes de crear.

## Scope incluido

- Movimiento mecanico de 8 specs del dominio public y 2 specs del dominio particular
  desde `frontend/e2e/` hacia sus carpetas empresariales de ownership.
- Correccion exclusiva del import relativo de los 2 specs particular
  (`./helpers/...` -> `../../helpers/...`).
- Actualizacion de los 10 paths correspondientes en `frontend/e2e/suites/catalog.ts`,
  preservando metadata y cohortes y manteniendo el orden lexicografico global.
- Verificacion de referencias operativas no documentales a los paths legacy.
- Preservacion del contenido funcional de las 10 pruebas.

## Scope excluido

- Backend, API, auth, DB, migraciones, dependencias, lockfiles y CI/workflows.
- `frontend/src/**`, fixtures, helpers E2E, snapshots y codigo de producto.
- `frontend/playwright.config.ts`, `frontend/package.json` (ya delega cohortes al runner).
- `test/helpers/dashboard-scope-guard.ts` (public/particular no usan el prefijo dashboard).
- Governance y `scripts/governance/**`.
- Renombres de basenames, cambios de assertions, waits, retries, skips, timeouts, titulos.

## Auditoria previa

- Se leyeron `docs/audit/e2e-enterprise-organization-audit.md` (§18.3, §18.4, §19),
  `docs/implementation/test-suite-enterprise-organization-convention.md`,
  `docs/implementation/e2e-org-3-clinic-domain-organization.md`,
  `docs/audit/e2e-org-3-clinic-domain-organization-audit.md`,
  `frontend/e2e/suites/catalog.ts`, `frontend/package.json`,
  `frontend/playwright.config.ts`,
  `frontend/e2e/helpers/particular-session-contracts.ts`,
  `test/architecture/e2e-suite-catalog-completeness.test.ts` y
  `test/helpers/dashboard-scope-guard.ts`.
- El runner de cohortes vive en `frontend/e2e/scripts/run-cohort.mjs` (no en `suites/`);
  lee el catalogo dinamicamente, por lo que no contiene listas literales de paths.
- `frontend/package.json` ya delega todas las cohortes al runner: sin listas literales.
- El guard de catalogo paso antes del move: 5/5.
- Los 10 origenes existian y los 10 destinos no existian antes de mover.
- Solo los 2 specs particular importan `./helpers/particular-session-contracts`;
  los 8 public no tienen imports relativos.
- Ninguno de los 10 specs contiene `test.fail`, `test.skip`, `test.fixme`,
  `mode: "serial"` ni overrides de `retries`.

## Movimientos

| Origen | Destino |
| --- | --- |
| `frontend/e2e/public-routes.spec.ts` | `frontend/e2e/public/routes/public-routes.spec.ts` |
| `frontend/e2e/public-navigation-footer.spec.ts` | `frontend/e2e/public/navigation/public-navigation-footer.spec.ts` |
| `frontend/e2e/home-hero-evidence-first.spec.ts` | `frontend/e2e/public/home/home-hero-evidence-first.spec.ts` |
| `frontend/e2e/public-perspective-scroll.spec.ts` | `frontend/e2e/public/home/public-perspective-scroll.spec.ts` |
| `frontend/e2e/public-service-bento-specimen-journey.spec.ts` | `frontend/e2e/public/services/public-service-bento-specimen-journey.spec.ts` |
| `frontend/e2e/public-clinics-b2b-operations.spec.ts` | `frontend/e2e/public/clinics/public-clinics-b2b-operations.spec.ts` |
| `frontend/e2e/public-pricing-actionable.spec.ts` | `frontend/e2e/public/pricing/public-pricing-actionable.spec.ts` |
| `frontend/e2e/public-report-preview.spec.ts` | `frontend/e2e/public/reports/public-report-preview.spec.ts` |
| `frontend/e2e/particular-authenticated-no-scroll.spec.ts` | `frontend/e2e/particular/auth/particular-authenticated-no-scroll.spec.ts` |
| `frontend/e2e/particular-authenticated-session-fixture.spec.ts` | `frontend/e2e/particular/auth/particular-authenticated-session-fixture.spec.ts` |

## Correccion de imports

- `frontend/e2e/particular/auth/particular-authenticated-no-scroll.spec.ts`:
  `./helpers/particular-session-contracts` -> `../../helpers/particular-session-contracts`.
- `frontend/e2e/particular/auth/particular-authenticated-session-fixture.spec.ts`:
  `./helpers/particular-session-contracts` -> `../../helpers/particular-session-contracts`.
- Los 8 specs public no tienen imports relativos; no requirieron correccion.

## Hashes SHA-256

Los 8 specs public conservan hash identico (movimiento puro):

| Spec (destino) | SHA-256 (pre = post) |
| --- | --- |
| `public/routes/public-routes.spec.ts` | `9994da4213fff8fba18ccd79ca87734f09e3dc203b9a2c91482d845a07dada68` |
| `public/navigation/public-navigation-footer.spec.ts` | `573b8e967caa4015a3fd5709bac0e482724e7343fb752cb3182d0ee172e8bfe3` |
| `public/home/home-hero-evidence-first.spec.ts` | `ac1ff67d17dd7a14575e76c301f389c195aed27f155b7cf2e7e6bbfab44973f1` |
| `public/home/public-perspective-scroll.spec.ts` | `06fbaa1678fa237f95fbc20d16609a6d58a8942e74014950a64e9b057ab9f851` |
| `public/services/public-service-bento-specimen-journey.spec.ts` | `7e22c2aa934881b5313de745ad7bee8b06a1b3a33789ca7ba76ea1b5a64cbca4` |
| `public/clinics/public-clinics-b2b-operations.spec.ts` | `ae5cf9117821f8247deaedae11df537653b9ea43446cfd86810e9907f0b67d08` |
| `public/pricing/public-pricing-actionable.spec.ts` | `8fa02713b796d8a72ffdbdb3e3bdb4024319028590c4a731b94d503c111ca93d` |
| `public/reports/public-report-preview.spec.ts` | `d7424bd8e2c0b9419008c82027fa1a0e2e57e86f17dfc3004a7720fed1b48d84` |

Los 2 specs particular difieren exclusivamente por la linea de import:

| Spec | SHA-256 pre | SHA-256 post |
| --- | --- | --- |
| `particular/auth/particular-authenticated-no-scroll.spec.ts` | `adbc59a53a1cc1eb2809906fc59c131e5b411a792bc5d1af5c3a2b99d3faad14` | `70436ebaaf5c0d90a9eaac97d9751c8dd37b00a2426723f9deafa5f143938635` |
| `particular/auth/particular-authenticated-session-fixture.spec.ts` | `9b8db5270b31bfb94b8e5e54fc375757bc4caea0684d3d9ce5532ab7b4bb09db` | `b258d2e2d7ade06126b44570953c9d4813e4a82965387497ae680a3c258fcad6` |

`git diff -M` sobre los 2 particular muestra una unica linea cambiada por archivo
(el import), sin otros hunks.

## Catalogo y cohortes

- `frontend/e2e/suites/catalog.ts`: 10 entradas apuntan a los nuevos paths; la entrada
  `home-hero-evidence-first` se reubico dentro del bloque `public/home/` para conservar
  el orden lexicografico global (verificado por el guard con `localeCompare`).
- Cohortes preservadas: `public-routes` = smoke; los otros 7 public = public-clinic;
  los 2 particular = extended. Conjunto CI efectivo sin cambios (42 specs, 562 tests).
- Metadata preservada: domain, feature, contractType, criticality, owner, currentCohorts,
  executionCohorts, platform, fixture, evidence, targetGate, notes.

## Archivos modificados

- `frontend/e2e/suites/catalog.ts` (10 paths).
- 10 specs movidos (2 particular con import corregido).
- `docs/implementation/e2e-org-4-public-particular-domain-organization.md` (nuevo).
- `docs/audit/e2e-org-4-public-particular-domain-organization-audit.md` (nuevo).

## Validaciones

| Comando | Resultado |
| --- | --- |
| `git branch --show-current` / precondiciones fail-closed | todas OK |
| `pnpm exec tsx --test test/architecture/e2e-suite-catalog-completeness.test.ts` | 5 passed |
| `pnpm typecheck:test` | passed (exit 0) |
| `pnpm test` | 3107 passed |
| `pnpm --dir frontend lint` | passed |
| `pnpm --dir frontend typecheck` | passed |
| `pnpm --dir frontend build` | passed |
| `pnpm --dir frontend exec playwright test --list` | 785 tests in 72 files, sin errores de import |
| `pnpm --dir frontend e2e:public-clinic` | 116 passed |
| `pnpm --dir frontend e2e:smoke` | 41 passed |
| `pnpm --dir frontend exec playwright test <2 particular>` | 6 passed |
| `pnpm --dir frontend e2e:ci` | 1er intento: 561 passed / 1 flake (clinic tokens, fuera de scope); reintento: 562 passed |
| `pnpm --dir frontend e2e:verify-teardown` | passed, puertos 3000/3107 libres |
| `pnpm build` | passed |
| `pnpm security:public-surface` | PASS (solo findings server-only preexistentes en `frontend/src/proxy.ts`) |
| `git diff --check` | limpio |

## Puertos

- Antes de Playwright: 3000/3107 libres.
- Despues de Playwright (`e2e:verify-teardown`): 3000/3107 libres.

## Flake observado (fuera de scope)

`e2e:ci` fallo una vez en `clinic/tokens/dashboard-clinic-tokens-mobile-parity.spec.ts`
(android-small-360x740), un spec del dominio clinic no tocado por E2E-ORG-4. Control A/B:
el spec paso 3/3 en corrida aislada y `e2e:ci` completo paso 562/562 en el reintento.
Clase documentada de contencion dev-mode bajo carga (E2E-STAB §8.5, auditoria riesgo #7);
sin relacion causal con los movimientos public/particular.

Post-push, Frontend CI del PR #1487 (run 29470263941, job `validate-frontend`) fallo una
vez en `e2e/dashboard-card-navigation-shell.spec.ts:188` (`clinic dashboard — rail
navigation › the rail pager steps through modules and updates the URL`, cohorte
`visual-contract`, 272/273 passed): `expect(page).toHaveURL(/\/dashboard\?module=informes$/)`
no se cumplio dentro de su timeout de 5s, precedido en el log por `[WebServer] ⨯ Error:
aborted`. Evidencia de no-causalidad con E2E-ORG-4:

- El spec pertenece al dominio platform, no fue movido ni editado por E2E-ORG-4 y la
  membresia de su cohorte `visual-contract` no cambio (diff de `catalog.ts` limitado a
  las 10 entradas public/particular).
- El mismo SHA `0a19b4a` tiene tres runs Frontend CI verdes previos al rojo
  (29468493990, 29469174070, 29469792244); el codigo es identico en los cuatro runs.
- El mismo spec ya habia fallado en `main` antes de E2E-ORG-4 (run 28768033888,
  2026-07-06, test `Informes workspace does not render Logística content`), y el otro
  run rojo reciente de `main` (28770879350) fue `public-perspective-scroll` (clase
  conocida PR-24).
- Reproduccion local con el entorno logico de CI (Node 24, pnpm 11.13.0, Chromium,
  configuracion Playwright real, sin retries): test exacto 1/1 passed; spec completo
  66/66 passed; cohorte `visual-contract` 273/273 passed en tres corridas consecutivas.

Clasificacion: flake preexistente no reproducible (contencion dev-mode bajo carga,
E2E-STAB §8.5). El pager del rail ya activa el workspace con señal sincrona
(`requestClinicModuleActivate`); la asercion de URL depende del commit asincrono de
`router.push`, que bajo contencion del dev server puede exceder 5s. Cualquier
estabilizacion basada en estado observable corresponde a un PR independiente; no se
modifica el spec dentro de E2E-ORG-4.

## Rollback

Revertir los 10 `git mv`, revertir las 2 lineas de import y revertir las 10 entradas
del catalogo. Sin dependencias, sin cambios de producto ni de CI.

## Riesgos residuales

Bajo. Persisten patrones legacy en `scripts/governance/quality-gate-impact-policy.mjs`
y en el bloque generado de `test/README.md`; quedan fuera de scope (governance) y sin
impacto operativo sobre los paths movidos. El comentario en prosa de
`frontend/e2e/helpers/particular-session-contracts.ts:197` menciona `public-routes.spec.ts`
como referencia textual, no como dependencia de path; helpers estan fuera de scope.

## Estado final

Cambios locales sin stage, pendientes de revision humana. No se ejecuto `git add`,
`git commit`, `git push` ni operaciones remotas. E2E-ORG-5 no iniciado.
