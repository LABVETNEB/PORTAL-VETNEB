# PR #1681 — Frontend E2E y E2E Completeness CI Fix

## Estado base

- PR: [#1681](https://github.com/LABVETNEB/PORTAL-VETNEB/pull/1681) `feat(dashboard): complete clinic mobile admin parity`.
- Rama: `feat/clinic-mobile-admin-parity`.
- Base: `main`.
- HEAD auditado y modificado: `bfe8f5b7 fix(frontend): avoid render-time refs in admin audit`.
- Worktree inicial: limpio, sin untracked, sin stashes (verificado con la secuencia canónica de baseline).
- Entorno: Windows, PowerShell, PNPM/Corepack.
- Existe una auditoría de caja blanca previa (misma sesión) que determinó tres causas raíz independientes para los tres checks fallidos de la PR: Frontend CI, E2E Completeness y Backend CI.

## Scope incluido

- **FIX A** — determinismo del spec `dashboard-mobile-shell-nav-contract.spec.ts` (caso "admin hub"): navegación a la URL canónica del hub (`?hub=1`) en lugar de una URL transitoria que el controlador reemplaza antes de que la aserción de readiness pueda observar el elemento.
- **FIX B** — realineación del presupuesto de `E2E Completeness` (`.github/workflows/e2e-completeness.yml`) y de su contrato unitario (`test/unit/infrastructure/e2e-completeness-workflow.test.ts`) al crecimiento real del catálogo introducido por la PR (91→95 specs).
- Realineación de dos guards que el propio HEAD de la PR rompía de forma legítima y silenciosa, descubiertos al ejecutar `pnpm test` completo (nunca corrido en CI para este HEAD porque el paso de auditoría de dependencias del Backend CI aborta el job antes de llegar a `pnpm test`):
  - Digest canónico congelado de `e2e-completeness.yml` en `test/unit/infrastructure/workflow-security-policy-contract.test.ts` (consecuencia mecánica y esperada de editar el workflow en FIX B).
  - Identificador `previousLimitRef` obsoleto en `test/unit/ui/admin/admin-audit-enterprise-density.test.ts`, que el propio commit `bfe8f5b7` de la PR había reemplazado por `reconciledLimit` (patrón `useState` en lugar de mutación de ref durante el render) sin realinear el test en el mismo commit.
- Documentación de esta entrega.

## Scope excluido

- **Backend CI / dependencias (`fast-uri`, `fastify`)**: causa externa a la PR, confirmada con evidencia (ver más abajo). **No se modificó** `package.json`, `frontend/package.json`, `pnpm-workspace.yaml` ni `pnpm-lock.yaml`. El fix correspondiente pertenece a una PR separada (extender #1683 o una PR `security`-only), fusionada a `main` antes de actualizar la rama de #1681.
- A02 geometry baseline recapture: declarado como follow-up separado en el propio body de la PR; no se tocó.
- Rediseño visual de Admin, refactors globales, backend funcional, DB, schema, migraciones, auth, cookies, CORS, CSP, rate limits, observabilidad: fuera de scope, no tocados.
- `frontend/playwright-report/`, `frontend/test-results/`: artefactos gitignored, no forman parte del diff.

## Auditoría previa

Resumen de la auditoría de caja blanca (misma sesión, previa a esta implementación):

- **Frontend CI** (`frontend-heavy-validation`, run `33658751493`): falló `Run frontend E2E layered tests` (`pnpm --dir frontend e2e:ci`) con `1 failed / 1 skipped / 985 passed`. Único fallo: `e2e/platform/app-shell/dashboard-mobile-shell-nav-contract.spec.ts:356:7 › … android-small-360x740 › admin hub keeps shell/nav usable`. El artefacto de Playwright (`error-context.md`) mostró la página ya renderizando el módulo `admin` (`Resumen de administración`) en el momento del fallo — el hub había sido desmontado por un `router.replace` del controlador antes de que la aserción de visibilidad se resolviera.
- **E2E Completeness** (`e2e-full-completeness`, run `33658751496`): falló con `Timed out waiting 2400s for the test suite to run`, **cero tests marcados `failed`** (`1258 passed`, `2 flaky`, `41 did not run`). Comparado contra dos runs de control sobre catálogos de 91 specs (`main` y la PR de Dependabot de fastify), ambos en ~35.4–35.8 min: la PR añadió 4 specs y ~183 casos, proyectando ~41.2 min contra un presupuesto de 40 min heredado sin recalibrar.
- **Backend CI** (`backend-heavy-validation`, run `33658751192`): falló `Dependency security audit` (`pnpm audit --prod`) con 10 vulnerabilidades (8 high de `fast-uri`, 2 moderate de `fastify`). Confirmado con `git diff --name-only origin/main...bfe8f5b7 -- package.json pnpm-lock.yaml pnpm-workspace.yaml frontend/package.json` (vacío) y con un run de `main` sobre el mismo lockfile 6 horas antes (`SUCCESS`, `No known vulnerabilities found`): los advisories se publicaron externamente entre ambos runs. Confirmado además que la PR de Dependabot #1683 (bump de `fastify` a 5.12.1) **sigue fallando** el mismo audit por `fast-uri`, que requiere además elevar los overrides de `pnpm-workspace.yaml`.

## Causa raíz — FIX A

`frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx` (no modificado por esta entrega) contiene un efecto de "restore de último módulo":

```ts
useEffect(() => {
  if (hasRestoredLastModule.current || hasManuallyReturnedToHub) return;
  if (searchParams.get(MODULE_QUERY_PARAM) || isAdminHubRequested(searchParams)) return;
  const landingModule = lastModule ?? DEFAULT_ADMIN_MODULE; // "admin"
  hasRestoredLastModule.current = true;
  router.replace(buildDashboardModuleHref(ROUTES.dashboardAdmin, landingModule), { scroll: false });
}, [searchParams, hasManuallyReturnedToHub, router]);
```

Con `localStorage` vacío (contexto E2E limpio), cualquier visita a `/dashboard/admin` sin query dispara un `router.replace` incondicional hacia `?module=admin`, desmontando el hub. `CMP-02` (introducido por esta misma PR en `dashboardModuleNavigation.ts`) ya declara la URL canónica y estable del hub: `buildHubHref("admin")` → `/dashboard/admin?hub=1`, exenta de ese replace por `isAdminHubRequested()`. El spec seguía usando la forma transitoria. La carrera es nodeterminista por diseño: en viewports donde el primer poll de Playwright gana la carrera contra el `replace`, el test pasa; en el viewport más angosto (`360×740`), a veces no.

## Causa raíz — FIX B

`.github/workflows/e2e-completeness.yml` fijaba `E2E_GLOBAL_TIMEOUT_MS=2400000` (40 min) y `timeout-minutes: 60` → en realidad `55`, calibrados para un catálogo de 91 specs (~35.4 min medidos en runs de control). La PR eleva el catálogo a 95 specs vía `frontend/e2e/suites/catalog.ts` (no modificado por esta entrega — es contenido legítimo de la PR), lo que agota el presupuesto sin que ningún test funcional falle.

## Cambios

- `frontend/e2e/platform/app-shell/dashboard-mobile-shell-nav-contract.spec.ts`: la entrada `"admin hub"` de `SHELL_ROUTES` pasa de `path: "/dashboard/admin"` a `path: "/dashboard/admin?hub=1"`, con comentario explicando el mecanismo de carrera. El selector `ready` (`[data-dashboard-hub-root="true"]`) y el resto de aserciones de `assertShellNavContract` quedan intactos.
- `.github/workflows/e2e-completeness.yml`: `timeout-minutes` de `55` a `60`; `E2E_GLOBAL_TIMEOUT_MS` de `"2400000"` a `"2700000"` (45 min); comentario del step actualizado con la medición real (91→95 specs, ~35.4→~41.2 min proyectados) y la razón del nuevo envelope. El invariante `jobTimeoutMs − playwrightBudgetMs ≥ 15 min` se mantiene exacto: `60m − 45m = 15m`. `--workers=2 --retries=2` sin cambios; sin `continue-on-error`; sin reducción de cobertura.
- `test/unit/infrastructure/e2e-completeness-workflow.test.ts`: aserciones de `timeout-minutes` (`55→60`) y `E2E_GLOBAL_TIMEOUT_MS` (`"2400000"→"2700000"`) realineadas al nuevo contrato del workflow.
- `test/unit/infrastructure/workflow-security-policy-contract.test.ts`: digest SHA-256 canónico de `e2e-completeness.yml` actualizado (`dc71f06c…` → `bd96be3b…`), recalculado de forma independiente con `createHash("sha256")` sobre el contenido real del archivo tras el cambio de FIX B — coincide exactamente con el valor que el propio test reportó como `actual` antes del fix. Es la consecuencia mecánica esperada de modificar un workflow bajo este guard de congelamiento; no se relajó ninguna otra aserción de la política de seguridad.
- `test/unit/ui/admin/admin-audit-enterprise-density.test.ts`: la aserción `card.includes("previousLimitRef")` se reemplaza por `card.includes("reconciledLimit")`. El identificador viejo no existe en `AdminAuditCard.tsx` desde el commit `bfe8f5b7` de la propia PR, que sustituyó una mutación de ref durante el render (`previousLimitRef = useRef(effectiveLimit)`) por el patrón React correcto (`const [reconciledLimit, setReconciledLimit] = useState(effectiveLimit)`). El producto es correcto; el test quedó desalineado en el mismo commit que lo cambió.

## Archivos modificados

- `frontend/e2e/platform/app-shell/dashboard-mobile-shell-nav-contract.spec.ts`
- `.github/workflows/e2e-completeness.yml`
- `test/unit/infrastructure/e2e-completeness-workflow.test.ts`
- `test/unit/infrastructure/workflow-security-policy-contract.test.ts`
- `test/unit/ui/admin/admin-audit-enterprise-density.test.ts`
- `docs/implementation/pr-1681-frontend-e2e-completeness-ci-fix.md` (este documento)

## Validaciones

| Comando | Resultado |
| --- | --- |
| `pnpm exec playwright test e2e/platform/app-shell/dashboard-mobile-shell-nav-contract.spec.ts --repeat-each=3` (dirigido a FIX A) | PASSED — 75/75 (25 tests × 3 repeticiones), determinismo confirmado |
| `pnpm --dir frontend e2e:visual-contract` (cohorte mínima que contiene el spec de FIX A) | PASSED — 503 passed, 1 skipped, 0 failed (19.1 min) |
| `node --test test/unit/infrastructure/e2e-completeness-workflow.test.ts` (dirigido a FIX B) | PASSED — 6/6, incluye `completeness workflow passes the parser-backed workflow security policy` |
| `node --test test/unit/infrastructure/workflow-security-policy-contract.test.ts test/unit/ui/admin/admin-audit-enterprise-density.test.ts` (dirigido a los dos guards realineados) | PASSED — 14/14 |
| `pnpm --dir frontend lint` | PASSED |
| `pnpm --dir frontend typecheck` | PASSED |
| `pnpm --dir frontend build` (con env CI: `NEXT_PUBLIC_API_URL`, `VETNEB_E2E_ALLOW_LOCAL_API`, `VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS`) | PASSED |
| `pnpm security:public-surface` | PASSED — 2 hallazgos preexistentes clasificados `server-only`, sin exposición pública nueva |
| `pnpm --dir frontend e2e:ci` (reproduce el step exacto de Frontend CI) | PASSED — 986 passed, 1 skipped, 0 failed (28.8 min). Verificación matemática: la corrida previa (CI) reportaba 985 passed + 1 failed + 1 skipped = 987 total; esta corrida da 986 passed + 1 skipped = 987 — delta exacto de un test reparado, sin pérdida de cobertura |
| `pnpm validate:local` (`typecheck && typecheck:test && test && build`, root) | PASSED — 4488 tests, 4487 pass, 0 fail, 1 skipped (preexistente); build (esbuild) exitoso |
| `pnpm --dir frontend e2e:full` | NOT_RUN — Playwright completo por defecto = 0 (§7); la validación definitiva del nuevo presupuesto corresponde al run de CI sobre el HEAD publicado |
| `pnpm audit --prod` / `pnpm audit` | NOT_RUN localmente — fuera de scope de esta entrega (Backend CI/dependencias, ver Scope excluido); no se modificó ningún manifiesto de dependencias |
| `pnpm db:migrate` | NOT_RUN — sin cambios de schema/Drizzle en esta entrega |

Higiene post-E2E verificada tras cada corrida: `frontend/next-env.d.ts` sin diff (el `globalTeardown` de Playwright lo restaura automáticamente); `frontend/playwright-report/` y `frontend/test-results/` gitignored, ausentes de `git status`.

## Resultado

Los dos causantes de Frontend CI y E2E Completeness quedan corregidos en la causa raíz, sin debilitar assertions, sin skips, sin exclusiones de catálogo, sin subir timeouts fuera de la medición real, sin retries adicionales para esconder la carrera. Se descubrieron y realinearon además dos guards que el propio HEAD de la PR ya rompía de forma legítima (uno mecánico por el propio FIX B, otro preexistente al commit `bfe8f5b7` de la PR), invisibles hasta ahora porque el bloqueo temprano del audit de Backend CI nunca dejaba llegar la ejecución a `pnpm test`.

Backend CI permanece fuera de este PR: es una causa externa, confirmada activa incluso en la PR de Dependabot dedicada (#1683), que requiere además elevar los overrides de `fast-uri` en `pnpm-workspace.yaml`.

## Riesgo residual

- El presupuesto de 45 min para `E2E Completeness` es una extrapolación medida (`~41.2 min` proyectados) más margen; el run real de CI sobre el HEAD publicado es la validación definitiva. Si el margen resultara insuficiente, `E2E_GLOBAL_TIMEOUT_MS` volvería a requerir recalibración con evidencia nueva.
- 41 tests (dominados por `visual-regression-authenticated.spec.ts`, 18 baselines Linux autenticados, y `dashboard-b05-surface-inversion.spec.ts`) nunca llegaron a ejecutarse en el run de CI que agotó el presupuesto. Con el presupuesto ampliado correrán por primera vez sobre este HEAD y podrían revelar fallos hoy ocultos, incluidos los 5 baselines PNG que la propia PR modifica.
- El fastify bump aislado (#1683) no basta: persisten 8 advisories `high` de `fast-uri` en las cadenas vía `@fastify/ajv-compiler`. El fix mínimo compatible (documentado en la auditoría previa, no implementado aquí) exige elevar dos rangos de override en `pnpm-workspace.yaml` además del bump de `fastify`, y realinear `SECURITY_OVERRIDE_LINES` en `test/architecture/toolchain-contract.test.ts`.

## Rollback

Revertir los cinco archivos modificados a su estado en `bfe8f5b7` (`git show bfe8f5b7:<path>`) restaura el comportamiento previo a esta entrega sin efectos colaterales: ninguno de los cambios toca runtime de producto, backend, DB, dependencias ni configuración productiva. El rollback de FIX A reintroduce la carrera nodeterminista del spec; el rollback de FIX B reintroduce el timeout de presupuesto insuficiente; el rollback de los dos guards realineados los deja fallando de nuevo contra el HEAD actual de la PR.

## Estado final

No se ejecutó ninguna escritura Git/GitHub (`add`, `commit`, `push`, `gh pr update-branch`, `gh run rerun`, merge): no delegadas en este pedido. Working tree con los cinco archivos listados como únicas modificaciones, sin artefactos generados, sin `next-env.d.ts` alterado, sin tocar dependencias, backend, DB, auth ni configuración productiva. Backend CI queda pendiente de una PR separada de seguridad de dependencias, fuera de este scope.
