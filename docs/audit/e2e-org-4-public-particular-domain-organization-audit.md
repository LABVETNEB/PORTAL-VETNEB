# E2E-ORG-4 public and particular domain organization audit

Fecha: 2026-07-15

## Estado base

- Rama: `test/e2e-organize-public-particular-domain`.
- HEAD inicial: `5a67ea11bbfd67f9a6b89e67eaa5ecefd8598e26`.
- `origin/main`: `5a67ea11bbfd67f9a6b89e67eaa5ecefd8598e26`.
- Working tree inicial: limpio (sin staged, sin untracked).
- Worktree unico: `C:/PORTAL-VETNEB`.

## Scope incluido

- Aplicar E2E-ORG-4 conforme a `docs/audit/e2e-enterprise-organization-audit.md`
  (§18.3, §18.4, §19).
- Mover exactamente 8 specs public y 2 specs particular a subdirectorios de ownership.
- Corregir solo el import relativo de los 2 specs particular.
- Actualizar catalogo y verificar referencias operativas autorizadas.
- Validar preservacion de contenido de los 10 specs.

## Scope excluido

- Nueva auditoria general de la suite.
- Backend, API, auth, DB, migraciones, dependencias, lockfiles, CI/workflows, governance.
- Cambios funcionales en specs, producto, fixtures, helpers, snapshots, config Playwright.
- `frontend/package.json`, `test/helpers/dashboard-scope-guard.ts` (sin cambios requeridos).
- Renombres de basenames y cambios de assertions/waits/timeouts/skips/titulos.

## Precondiciones verificadas (fail-closed)

| Control | Resultado |
| --- | --- |
| Rama actual | `main` -> creada `test/e2e-organize-public-particular-domain` |
| Working tree inicial | limpio |
| Staged inicial | ninguno |
| Untracked inicial | ninguno |
| HEAD | `5a67ea11bbfd67f9a6b89e67eaa5ecefd8598e26` |
| `origin/main` | `5a67ea11bbfd67f9a6b89e67eaa5ecefd8598e26` |
| Worktrees | solo `C:/PORTAL-VETNEB` |
| Rama de trabajo preexistente | no existia |
| Catalogo (guard) | 5/5 verde, 72 specs catalogados |
| Total specs tracked | 72 |
| Origenes (10) | presentes |
| Destinos (10) | ausentes |

Documentos y anclas leidos antes de modificar:

- `docs/audit/e2e-enterprise-organization-audit.md` (§18.3, §18.4, §19)
- `docs/implementation/test-suite-enterprise-organization-convention.md`
- `docs/implementation/e2e-org-3-clinic-domain-organization.md`
- `docs/audit/e2e-org-3-clinic-domain-organization-audit.md`
- `frontend/e2e/suites/catalog.ts`
- `frontend/e2e/scripts/run-cohort.mjs` (runner real; lee catalogo dinamicamente)
- `frontend/package.json` (delega cohortes al runner; sin listas literales)
- `frontend/playwright.config.ts`
- `frontend/e2e/helpers/particular-session-contracts.ts`
- `test/architecture/e2e-suite-catalog-completeness.test.ts`
- `test/helpers/dashboard-scope-guard.ts`

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

Carpetas nuevas: `public/{routes,navigation,home,services,clinics,pricing,reports}`,
`particular/auth`.

## Referencias actualizadas

- `frontend/e2e/suites/catalog.ts`: 10 entradas apuntan a los nuevos paths; entrada
  `home-hero-evidence-first` reubicada al bloque `public/home/` para conservar el orden
  lexicografico global; metadata y cohortes preservadas.
- 2 specs particular: import relativo corregido a `../../helpers/particular-session-contracts`.

Referencias no actualizadas (sin dependencia literal de los paths viejos):

- `frontend/package.json`: sin cambios; delega cohortes al runner, sin listas de specs.
- `test/helpers/dashboard-scope-guard.ts`: sin cambios; public/particular no usan el
  prefijo `frontend/e2e/dashboard`.
- `scripts/governance/quality-gate-impact-policy.mjs` y bloque `quality-gate-taxonomy`
  de `test/README.md`: governance, fuera de scope.
- `frontend/e2e/helpers/particular-session-contracts.ts:197`: comentario en prosa que
  menciona `public-routes.spec.ts`, no dependencia de path; helper fuera de scope.

Censo `git grep` sobre `frontend`, `test`, `scripts`, `.github`, `package.json`
(excluyendo `docs`): sin referencias operativas a los paths viejos tras el move.

## Evidencia de preservacion

- Total specs tracked: 72 antes y despues.
- Playwright discovery: 785 tests in 72 files antes y despues (sin errores de import).
- Duplicados fisicos: 0.
- Origenes post-move: 10 ausentes. Destinos post-move: 10 presentes.
- Renames: 8 public `R100`; 2 particular `R` con un solo hunk (import) por archivo.
- 8 specs public con SHA-256 identico pre/post.
- 2 specs particular difieren solo por la linea de import (`git diff -M`: 1 linea/archivo).
- Sin `test.fail`, `test.skip`, `test.fixme`, `serial` ni `retries` en los 10 specs.
- Titulos de tests preservados (verificado por corridas focales que listan cada titulo).

## Validaciones

| Comando | Resultado |
| --- | --- |
| `pnpm exec tsx --test test/architecture/e2e-suite-catalog-completeness.test.ts` | 5 passed |
| `pnpm typecheck:test` | passed |
| `pnpm test` | 3107 passed |
| `pnpm --dir frontend lint` | passed |
| `pnpm --dir frontend typecheck` | passed |
| `pnpm --dir frontend build` | passed |
| `pnpm --dir frontend exec playwright test --list` | 785 tests / 72 files |
| `pnpm --dir frontend e2e:public-clinic` | 116 passed |
| `pnpm --dir frontend e2e:smoke` | 41 passed |
| `pnpm --dir frontend exec playwright test <2 particular>` | 6 passed |
| `pnpm --dir frontend e2e:ci` | 561 passed + 1 flake fuera de scope; reintento 562 passed |
| `pnpm --dir frontend e2e:verify-teardown` | passed |
| `pnpm build` | passed |
| `pnpm security:public-surface` | PASS |
| `git diff --check` | limpio |

Puertos:

- Antes de Playwright: 3000/3107 libres.
- Despues de Playwright: 3000/3107 libres.

## Flake fuera de scope

`clinic/tokens/dashboard-clinic-tokens-mobile-parity.spec.ts` (android-small-360x740)
fallo una vez bajo carga de `e2e:ci` (6 workers, 562 tests). Corrida aislada: 3/3 passed.
Reintento de `e2e:ci`: 562/562 passed. Spec del dominio clinic, no tocado por E2E-ORG-4;
clase de contencion dev-mode documentada (E2E-STAB §8.5 / auditoria riesgo #7). Sin
relacion causal con los movimientos.

Post-push, Frontend CI (run 29470263941) fallo una vez en
`e2e/dashboard-card-navigation-shell.spec.ts:188` (rail pager, cohorte `visual-contract`,
272/273): `toHaveURL(?module=informes)` supero su timeout de 5s con `[WebServer] ⨯ Error:
aborted` previo. Spec del dominio platform, no tocado por E2E-ORG-4 y con cohorte sin
cambios. El mismo SHA registra tres runs Frontend CI verdes (29468493990, 29469174070,
29469792244) y el mismo spec ya fallo en `main` pre-E2E-ORG-4 (run 28768033888,
2026-07-06). Reproduccion local (Node 24, pnpm 11.13.0, Chromium, sin retries): test
exacto 1/1, spec 66/66, cohorte `visual-contract` 273/273 en tres corridas. Clasificacion:
flake preexistente no reproducible; estabilizacion eventual en PR independiente.

## Resultado

PASS. E2E-ORG-4 aplicado de forma mecanica: 10 specs reubicados, 2 imports corregidos,
catalogo alineado y ordenado, contenido preservado y validacion local completa.

## Riesgo residual

Bajo. Unica deuda: patrones legacy taxonomy/governance, excluidos del alcance actual.

## Estado final

Cambios locales sin stage, pendientes de revision humana. No se ejecuto `git add`,
`git commit`, `git push` ni operaciones remotas.
