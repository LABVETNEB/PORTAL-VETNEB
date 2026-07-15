# E2E-ORG-A — Auditoría empresarial de organización de la suite Playwright

> Documento de auditoría **docs-only**. No mueve specs, no edita helpers, fixtures,
> scripts, `frontend/package.json`, `frontend/playwright.config.ts`, CI, backend, API,
> auth, DB ni dependencias. Inventaría el estado real de `frontend/e2e/**` en el HEAD
> auditado y diseña —sin implementar— la reorganización física, el catálogo de cohortes,
> el diseño fail-closed de selección focal y el plan de PRs E2E-ORG-1…X.

Convención de marcado: `[OBSERVADO]` verificado en el repositorio en la base auditada ·
`[PROPUESTO]` diseño aún no implementado · `[RIESGO]` consecuencia posible ·
`[BLOQUEANTE]` impide una migración segura · `[NO CONFIRMADO]` sin evidencia suficiente.

---

## 1. Resumen ejecutivo

**Dictamen: GO CON CONDICIONES** (detalle en §24).

- `[OBSERVADO]` La suite tiene **72 specs** tracked (785 tests descubiertos por
  `playwright test --list`), 4 helpers, 1 fixture API y 30 snapshots PNG
  `chromium-linux`. La organización física es **plana**: 72 specs en la raíz de
  `frontend/e2e/` sin subcarpetas de ownership.
- `[OBSERVADO]` CI ejecuta **42 specs (562 tests)** repartidos en 4 cohortes definidas
  por **listas manuales gigantes** en `frontend/package.json` (`e2e:smoke` 7,
  `e2e:admin-mobile` 13, `e2e:visual-contract` 11, `e2e:public-clinic` 11; disjuntas,
  unión verificada = 42). **30 specs (223 tests) quedan fuera de CI** sin ownership de
  cohorte declarado.
- `[OBSERVADO]` `e2e:ci` encadena **4 invocaciones Playwright**, cada una con su propio
  ciclo de servidores (fixture API :3107 + `next dev` :3000). El workflow
  `frontend-ci.yml` reproduce las mismas 4 invocaciones secuenciales en un solo job.
- `[OBSERVADO]` No existe ninguna fuente única verificable de cobertura por cohorte ni
  guard de completitud: un spec nuevo no catalogado cae silenciosamente a la cola
  fuera de CI (la misma cola que, según `docs/audit/e2e-stability-hardening-phase-1.md`,
  se pudrió hasta acumular 46 fallos antes de E2E-STAB-1).
- `[OBSERVADO]` Hueco de gate relevante: `dashboard-logout-private-cache.spec.ts`
  (logout + no-store de dashboards privados, contrato de seguridad) está **fuera de CI**.
- `[PROPUESTO]` Arquitectura física por ownership funcional (`admin/ clinic/ public/
  particular/ platform/ regression/` + `fixtures/ helpers/ suites/`), catálogo único
  `frontend/e2e/suites/catalog.ts` como fuente de cohortes, guard de completitud
  fail-closed en `test/architecture/`, y CI futuro con **una sola invocación
  Playwright** y un único ciclo de servidores.
- `[PROPUESTO]` Primer PR ejecutable: **E2E-ORG-1** (catálogo + runner + guard, sin
  mover ningún spec y sin tocar CI), especificado con archivos exactos en §19.

---

## 2. Base auditada

| Campo | Valor `[OBSERVADO]` |
| --- | --- |
| Rama | `docs/e2e-enterprise-architecture-audit` |
| HEAD | `1886eb1439a9d942e12025db97346585d06523b6` — `test(e2e): harden test infrastructure stability (#1467)` |
| `origin/main` | `1886eb1439a9d942e12025db97346585d06523b6` (idéntico al HEAD local) |
| Working tree antes de editar | limpio (`git status --short --untracked-files=all` vacío) |
| PNPM | `11.13.0` |
| PRs abiertos al iniciar | 0 (`gh pr list --state open` vacío) |
| Fecha | 2026-07-15 |
| Plataforma | Windows 11 / PowerShell |

---

## 3. Autoridades normativas

Leídas íntegramente en esta auditoría `[OBSERVADO]`:

1. `docs/implementation/test-suite-enterprise-organization-convention.md` — norma
   vinculante; fija que `frontend/e2e` es la ubicación física exclusiva de Playwright,
   admite subcarpetas internas (`flows/`, `features/` como categorías opcionales), y
   exige que todo movimiento actualice imports, registries, censos y docs en el mismo PR.
2. `test/README.md` — índice operativo + bloque generado `quality-gate-taxonomy`
   (sincronizado con `scripts/governance/quality-gate-impact-policy.mjs`).
3. `docs/audit/test-suite-enterprise-architecture-audit.md` — precedente del método
   (inventario → taxonomía → PRs incrementales) aplicado a `test/**`.
4. `docs/implementation/test-suite-enterprise-migration-manifest.md` — precedente de
   lotes por anchor común y lección central: las anclas siempre se subcontabilizan si
   no se buscan todas las clases de referencia (registries, censos, `readSource`).
5. `docs/audit/e2e-ci-layering-strategy-audit.md` — auditoría PR-C (2026-06-23, 42 specs
   entonces); diseñó las 4 cohortes hoy implementadas.
6. `docs/audit/e2e-stability-hardening-phase-1.md` — E2E-STAB-1 (#1467, el propio HEAD);
   documenta ownership de servidores, la cola no-CI podrida, los expected-failure guards
   del P1 de Informes y el backlog §8 que esta fase retoma.
7. `frontend/package.json`, `frontend/playwright.config.ts`,
   `.github/workflows/frontend-ci.yml`, `scripts/governance/quality-gate-impact-policy.mjs`
   y los 77 archivos tracked no-PNG bajo `frontend/e2e/**` (72 specs leídos por
   inventario y muestreo dirigido; los 5 archivos de soporte identificados por rol).

`[OBSERVADO]` Discrepancia documental detectada y recalculada: E2E-STAB-1 declara
"73 specs"; el HEAD actual tiene **72** (en `HEAD~1` había 73: #1467 retiró
`dashboard-clinic-mobile-nav-stage-parity.spec.ts` dentro del mismo merge). Todos los
conteos de este documento se recalcularon sobre el HEAD, no se heredaron.

---

## 4. Skills utilizadas por Claude Fable 5

ChatGPT únicamente inspeccionó externamente el paquete de skills para **seleccionar**
las cuatro pertinentes; no ejecutó ninguna skill ni participó en la ejecución de esta
auditoría. Claude Fable 5 activó las cuatro skills como checklists especializados
subordinados a este prompt y a la evidencia del repositorio, sin ejecutar sus
instrucciones de implementación ni sus flujos de PR:

| Skill | Propósito concreto aplicado | Secciones pertinentes usadas |
| --- | --- | --- |
| `vetneb-briefing-planificacion-diseno-desarrollo-pruebas` | Delimitación del scope docs-only, criterios de aceptación (§22), matriz de riesgos (§20), estructura del plan de PRs (§19), no-alcance (§21) | Estructura del briefing; anti-deriva |
| `vetneb-production-web-optimization-engineer` | Diagnóstico antes de diseño; clasificación P0–P3 de hallazgos; separación síntoma/causa raíz (cohortes manuales = síntoma; ausencia de fuente única = causa); plan mínimo con rollback lógico | Regla principal; flujo de trabajo pasos 1–3; formato de auditoría |
| `vetneb-staff-senior-full-stack-engineer` | Fronteras entre specs/helpers/fixtures/scripts/CI/tests de arquitectura; preservación de la separación admin/clínica/particular/público; impactos cruzados con guards backend | Comportamiento; flujo senior pasos 1–2 |
| `vetneb-web-end-to-end-global` | Verificación de que el inventario cubre todas las superficies del producto (público, clínica, admin, particular) y de que las cohortes propuestas no fragmentan flujos críticos de auth/no-store/aislamiento | Alcance global; definición de operativo |

No se utilizaron las skills excluidas por el prompt. `vetneb-security-production-invariants`
no se usó como skill rectora; la identificación de specs que protegen fronteras críticas
(§ matriz, columna Observaciones) se hizo con evidencia directa del repositorio.

---

## 5. Metodología y fuentes de evidencia

Comandos de sólo lectura ejecutados (PowerShell, Terminal 1 = `C:\PORTAL-VETNEB`):

```powershell
git branch --show-current; git status --short --untracked-files=all
git log -1 --oneline; git rev-parse HEAD; git rev-parse origin/main
pnpm --version; gh pr list --state open
git ls-files "frontend/e2e/**"                     # inventario físico (107 archivos)
git ls-files "frontend/e2e/*.spec.ts"              # 72 specs
git ls-tree -r --name-only "HEAD~1" -- frontend/e2e # verificación 73→72
pnpm --dir frontend exec playwright test --list    # 785 tests en 72 archivos
git grep -n -E "test\.fail|test\.fixme|test\.skip|test\.describe\.serial|retries" -- frontend/e2e
git grep -l -E "toHaveScreenshot|page\.screenshot" -- "frontend/e2e/*.spec.ts"
git grep -c "waitForTimeout" -- "frontend/e2e/*.spec.ts"
git grep -n "serial" -- "frontend/e2e/*.spec.ts"
git grep -n "helpers/" -- "frontend/e2e/*.spec.ts" # imports de helpers
git grep -l -E "127\.0\.0\.1:3000|localhost:3000" -- "frontend/e2e/*.spec.ts"
git grep -l "3107" ; git grep -n "frontend/e2e/" -- ":(exclude)frontend/e2e" ":(exclude)docs"
git grep -n "e2e:" -- test/                        # anclas backend de scripts/CI
```

Más lecturas completas de las autoridades de §3, del guard
`test/helpers/dashboard-scope-guard.ts`, del workflow `visual-regression-manual.yml` y
lecturas dirigidas de specs para resolver ownership (evidence dirs, cobertura
admin-vs-clinic de los specs `dashboard-*` compartidos, cabeceras de los specs
`remove-*` y `dashboard-interaction-foundation`). `playwright test --list` no arranca
webServers ni navegadores; ninguna suite E2E fue ejecutada. No se usó Python ni `rg`.
No se abrió ningún `.env` real.

---

## 6. Inventario físico actual `[OBSERVADO]`

`git ls-files "frontend/e2e/**"` = **107 archivos tracked**:

| Clase | Cantidad | Detalle |
| --- | ---: | --- |
| Specs `*.spec.ts` (raíz plana, sin subcarpetas) | **72** | lista completa en la matriz §18 |
| Helpers `frontend/e2e/helpers/` | 4 | `admin-mobile-contracts.ts` (241 líneas, importado por 7 specs), `particular-session-contracts.ts` (204, importado por 2), `restore-next-env-hygiene.mjs` (29, `globalTeardown` del config), `verify-teardown.mjs` (37, script `e2e:verify-teardown`) |
| Fixtures `frontend/e2e/fixtures/` | 1 | `admin-populated-api-server.mjs` (835 líneas; API fake sin estado mutable, puerto 3107, levantado por `webServer` en toda corrida) |
| Snapshots PNG `*-snapshots/` | 30 | 10 por cada spec `visual-regression-{public,authenticated,stress}`; todos `*-chromium-linux.png` |

Verificación cruzada: 72 + 4 + 1 + 30 = 107 ✓. No existen `flows/`, `features/`,
`suites/` ni `scripts/` dentro de `frontend/e2e/`.

Contratos internos detectados en specs:

- `test.fail` condicional: **sólo** `clinic-reports-workspace-1000.spec.ts`
  (6 sitios, constante `ONE_ROW_COLLAPSE_GUARD`) — expected-failure guards del defecto
  P1 de `/dashboard/informes`. **No se alteran** (fuera de alcance).
- `test.skip` por plataforma: `visual-regression-authenticated` y
  `visual-regression-stress` (skip fuera de Chromium+Linux).
  `visual-regression-public` **no tiene skip** → rojo local en win32 por diseño.
- `test.describe.configure({ mode: "serial" })`: los 3 specs `visual-regression-*`.
- No hay `test.fixme` ni overrides de `retries` en specs (el config tampoco define
  retries).
- `toHaveScreenshot`: sólo los 3 `visual-regression-*` (30 baselines Linux).
- `page.screenshot` de evidencia: 5 specs admin-mobile (`status`, `config`,
  `final-polish`, `hub-stale-layer-stage`, `module-layer-isolation`) escriben a
  `frontend/test-results/**` (no tracked, limpiado por Playwright);
  `visual-smoke` captura en memoria (sanity de bytes);
  **2 specs escriben en árbol tracked**: `remove-home-unified-workspace-screenshots`
  → `docs/audit/datos tecnicos dashboard/remove-dashboard-home-unified-workspace/` y
  `dashboard-runtime-post-ux1-visual-evidence` → `docs/audit/evidence/dashboard-runtime-post-ux1/`
  (+ `metrics.json`). Ambos ensucian el working tree en cada `e2e:full` (backlog
  E2E-STAB §8.3).
- `waitForTimeout`: 9 specs (13 usos), todos clasificados y documentados como
  semánticos/acotados por E2E-STAB §5 (settle de dobles lecturas, ventanas de
  observación negativas, generador de evidencia).
- Puertos: 48 specs referencian `127.0.0.1:3000`/`localhost:3000` (mayormente dominio
  de cookies sintéticas); referencias directas a `3107` sólo en
  `admin-users-fixture-pagination` y `clinic-reports-fixture-pagination` (consultan la
  fixture API por HTTP), además del fixture, `verify-teardown.mjs` y el config.

---

## 7. Inventario de descubrimiento Playwright `[OBSERVADO]`

`pnpm --dir frontend exec playwright test --list` → **`Total: 785 tests in 72 files`**,
proyecto único `chromium`. Coincidencia exacta con el inventario tracked: 72 = 72
(no hay specs no tracked ni specs tracked fuera del descubrimiento). El conteo runtime
por spec figura en la columna "Tests" de la matriz §18; los 10 mayores:

| Spec | Tests |
| --- | ---: |
| dashboard-card-navigation-shell | 66 |
| dashboard-viewport-zoom-adaptability | 60 |
| dashboard-real-app-shell-no-scroll-contract | 37 |
| dashboard-clinic-controller-workspace-parity | 26 |
| dashboard-mobile-shell-nav-contract | 25 |
| public-clinics-b2b-operations | 24 |
| admin-mobile-status-modules-no-scroll | 23 |
| admin-mobile-config-modules-no-scroll | 22 |
| public-report-preview | 21 |
| public-service-bento-specimen-journey | 20 |

---

## 8. Mapa de cohortes actual `[OBSERVADO]`

Reconstruido desde `frontend/package.json` en el HEAD (no desde documentos históricos):

| Script | Mecanismo | Specs | Tests | ¿En CI? |
| --- | --- | ---: | ---: | --- |
| `e2e` | `playwright test` (todo) | 72 | 785 | No como tal |
| `e2e:full` | `playwright test` — **duplicado exacto de `e2e`** | 72 | 785 | No |
| `e2e:smoke` | lista manual de 7 paths | 7 | 41 | Sí |
| `e2e:admin-mobile` | lista manual de 13 paths | 13 | 132 | Sí |
| `e2e:visual-contract` | lista manual de 11 paths | 11 | 273 | Sí |
| `e2e:public-clinic` | lista manual de 11 paths | 11 | 116 | Sí |
| `e2e:ci` | encadena los 4 anteriores (4 invocaciones) | 42 | 562 | Réplica local del step CI |
| `e2e:ui`, `e2e:report`, `e2e:verify-teardown` | utilidades | — | — | No |

Verificación programática: las 4 cohortes son **disjuntas** (0 duplicados) y su unión
es exactamente 42 specs. Cohorte implícita adicional: el workflow manual
`visual-regression-manual.yml` ejecuta por path los 3 specs `visual-regression-*`
(sólo Linux, `workflow_dispatch`). No existe script `e2e:evidence`, `e2e:extended`,
`e2e:clinic` ni `e2e:capacity`.

---

## 9. Coste de las cuatro invocaciones y ownership de servidores `[OBSERVADO]`

- Playwright es el **owner único** de ambos procesos vía `webServer`:
  fixture API (`:3107`, readiness `/__e2e/health`, teardown SIGTERM + failsafe) y
  `next dev` (`:3000`, timeout de arranque 120 s, reescribe `next-env.d.ts` —
  restaurado por el `globalTeardown` `restore-next-env-hygiene.mjs`).
  `reuseExistingServer` sólo con `E2E_REUSE_SERVER=1` local; CI siempre arranca limpio.
  `globalTimeout` 30 min.
- **Cada invocación Playwright levanta y derriba su propio par de servidores.**
  `e2e:ci` local = 4 boots de fixture + 4 boots de `next dev`. En CI, el job único
  `validate-frontend` instala una vez (pnpm + Chromium) pero paga igualmente los
  4 ciclos de servidores dentro del step "Run frontend E2E layered tests"
  (`set +e` + 4 comandos + agregación de exit codes).
- Línea base medida por E2E-STAB-1 (no re-medida aquí): suite completa caliente
  ≈3.5 min; las 4 suites CI en minutos de un dígito. El sobrecoste estructural de la
  fragmentación es 3 arranques redundantes de `next dev` + 3 del fixture por corrida
  de CI, más 4 informes HTML separados. `[RIESGO]` El coste crecerá linealmente con
  cada cohorte nueva si no se consolida la invocación (§16).

---

## 10. Specs fuera de CI `[OBSERVADO]`

**30 specs / 223 tests** no pertenecen a ninguna cohorte de CI. Enumeración completa
(tests entre paréntesis):

accessibility-axe-key-routes (8) · admin-pricing-multi-form-measurement (1) ·
admin-users-fixture-pagination (4) · admin-users-visual-quality-gate (15) ·
admin-users-workspace-5000 (4) · admin-users-workspace-mobile-5000 (6) ·
clinic-informes-zero-internal-scroll (4) · clinic-reports-fixture-pagination (4) ·
clinic-reports-workspace-1000 (5) · dashboard-adaptive-rows (3) ·
dashboard-centered-pager (5) · dashboard-clinic-controller-workspace-parity (26) ·
dashboard-clinic-mobile-content-reachability (5) ·
dashboard-clinic-mobile-operational-density (19) ·
dashboard-clinic-module-state-parity (14) ·
dashboard-informes-server-adaptive-pagination (5) ·
dashboard-logistica-metricas-full-route-adaptive (5) ·
dashboard-logistica-rutas-full-route-adaptive (4) ·
dashboard-logistica-visitas-full-route-adaptive (4) ·
dashboard-logout-private-cache (6) · dashboard-runtime-post-ux1-visual-evidence (1) ·
dashboard-zero-scroll-mobile-boundary (8) · logistics-mobile-no-horizontal-table (9) ·
particular-authenticated-no-scroll (4) · particular-authenticated-session-fixture (2) ·
remove-dashboard-home-unified-workspace (12) ·
remove-home-unified-workspace-screenshots (10) · visual-regression-authenticated (10) ·
visual-regression-public (10) · visual-regression-stress (10).

Hallazgos de gate dentro de esa cola:

- `[OBSERVADO]` **P1 de gate**: `dashboard-logout-private-cache` (logout, no-store de
  privados, ambos realms) es un contrato de seguridad que hoy sólo corre localmente.
  `[PROPUESTO]` Promoverlo a la cohorte smoke/CI (ver matriz y §19 E2E-ORG-1).
- `[OBSERVADO]` Toda la superficie **particular autenticada** (2 specs) y toda la
  familia **logística full-route** (3 specs) están fuera de CI: dos superficies de
  producto sin gate de navegador.
- `[OBSERVADO]` Los contratos de capacidad (5000/1000) y los realineados de E2E-STAB
  (controller-parity, zero-scroll-boundary, axe) sólo corren en `e2e:full` local — la
  misma clase de cola que se pudrió antes de E2E-STAB-1.

---

## 11. Solapamientos y huecos `[OBSERVADO]`

- **Solapamiento entre cohortes: cero.** Ningún spec aparece en dos scripts (verificado
  programáticamente sobre `frontend/package.json`).
- **Duplicación de scripts**: `e2e` y `e2e:full` son idénticos (`playwright test`).
- **Huecos de cohorte**: los 30 specs de §10 no tienen cohorte; no existe cohorte
  `evidence` ni `visual-linux` declarada en scripts (la de visual vive sólo dentro del
  workflow manual, por paths hardcodeados).
- **Hueco de completitud**: nada verifica que `smoke ∪ admin-mobile ∪ visual-contract ∪
  public-clinic ∪ <resto>` = inventario tracked. La igualdad 42+30=72 de esta auditoría
  fue calculada a mano; no hay guard que la mantenga.
- **Solapamiento conceptual sin duplicación física** (aceptable, se documenta):
  `visual-smoke` toca `/dashboard` (superficie también cubierta por visual-contract);
  `dashboard-zero-scroll-mobile-boundary` cubre ramas admin y clínica (por eso se
  clasifica en platform, no en un dominio).

---

## 12. Deuda de naming y paths `[OBSERVADO]`

1. **Prefijo `dashboard-` sobrecargado**: nombra tres ownerships distintos —
   shell compartido admin+clínica (`dashboard-card-navigation-shell`,
   `dashboard-viewport-zoom-adaptability`…), módulos exclusivamente clínicos
   (`dashboard-adaptive-rows`, `dashboard-centered-pager`,
   `dashboard-interaction-foundation`, verificado por lectura: tipan `ClinicModule` y
   no tocan admin) y módulos clínicos con prefijo compuesto (`dashboard-clinic-*`,
   `dashboard-logistica-*`, `dashboard-informes-*`).
2. **Idiomas mezclados** para la misma feature: `clinic-informes-*` vs
   `clinic-reports-*` vs `dashboard-clinic-informes-*`; `dashboard-logistica-*` vs
   `logistics-mobile-*`.
3. **Specs nombrados por el cambio, no por la superficie**:
   `remove-dashboard-home-unified-workspace` y
   `remove-home-unified-workspace-screenshots` (contrato conductual vigente del shell
   clínico + su generador de evidencia).
4. **"visual" con tres significados**: `visual-smoke` (sanity de render),
   `e2e:visual-contract` (contratos estructurales DOM/bounding-box, sin píxeles),
   `visual-regression-*` (baselines de píxeles Linux). El nombre de la cohorte
   `visual-contract` induce a error (ya señalado por PR-C §4.4).
5. **Helper con nombre estrecho**: `helpers/admin-mobile-contracts.ts` es importado
   también por `admin-users-visual-quality-gate` (desktop 1440×900) y
   `admin-users-workspace-mobile-5000` — ya es el helper genérico de contratos admin.
6. **Par casi homónimo**: `admin-clinic-edit-drawer` vs
   `admin-clinics-mobile-card-layout` (singular/plural, misma feature de clínicas admin).
7. **Paths anclados externamente** (censo completo de referencias no-docs a
   `frontend/e2e/` fuera del propio árbol):
   - `frontend/package.json` — 42 paths literales en 4 scripts.
   - `.github/workflows/visual-regression-manual.yml` — 3 paths de specs + patrón
     `frontend/e2e/**/*.png`.
   - `scripts/governance/quality-gate-impact-policy.mjs` — `representativePaths` con
     globs **anclados al layout plano** (`frontend/e2e/admin-*.spec.ts`,
     `frontend/e2e/dashboard-*.spec.ts`, `frontend/e2e/public-*.spec.ts`,
     `frontend/e2e/dashboard-clinic-*.spec.ts`) + regla de impacto por prefijo
     `frontend/e2e/` (esta última sobrevive a cualquier reorganización).
   - `test/helpers/dashboard-scope-guard.ts` — prefijo `frontend/e2e/dashboard`
     (consumido por 7 tests legacy de scope en `test/unit/ui/**`): mover specs
     `dashboard-*` fuera de ese prefijo desactivaría la aplicabilidad del guard para
     diffs e2e si no se actualiza en el mismo PR.
   - `test/unit/infrastructure/frontend-ci-workflow.test.ts` y
     `test/unit/infrastructure/production-readiness.test.ts` — fijan el **texto
     literal** del step "Run frontend E2E layered tests" del workflow.
   - `test/unit/infrastructure/package-scripts-contract.test.ts` — fija los valores
     exactos de `e2e`, `e2e:ui`, `e2e:report` (no fija las cohortes).
   - `test/unit/infrastructure/quality-gate-impact-contract.test.ts` — exige que todo
     comando de la taxonomy exista como script frontend real.
   - `test/unit/infrastructure/next-env-hygiene.test.ts` — fija el path del
     globalTeardown `frontend/e2e/helpers/restore-next-env-hygiene.mjs`.
   - `test/architecture/tracked-source-inventory.test.ts` — fija el path del fixture.
   - `frontend/playwright.config.ts` — paths de globalTeardown y del fixture server.
   - Docs: 143 archivos bajo `docs/` mencionan `spec.ts` (históricos; no se actualizan
     en masa — sólo los normativos vigentes se tocan en los PRs de move).

---

## 13. Arquitectura física propuesta `[PROPUESTO]`

Se **valida con correcciones** la orientación del briefing. Clasificación primaria por
**ownership funcional**; las cohortes (`smoke`, `ci`, `full`, `evidence`,
`visual-linux`, `extended`) son atributos del catálogo, nunca carpetas.

```text
frontend/e2e/
├── admin/
│   ├── shell/        (10)  familias no-scroll mobile del app-shell admin
│   ├── clinics/       (2)  edición y layout de clínicas
│   ├── pricing/       (1)
│   ├── tokens/        (1)
│   └── users/         (4)  incluye contratos de capacidad 5000
├── clinic/
│   ├── shell/         (9)  controller/workspace, densidad, pager, foundation
│   ├── reports/       (5)  incluye los guards del P1 de Informes
│   ├── logistics/     (5)
│   ├── tokens/        (1)
│   └── profile/       (1)
├── public/
│   ├── routes/ (1) · navigation/ (1) · home/ (2) · services/ (1)
│   ├── clinics/ (1) · pricing/ (1) · reports/ (1)
├── particular/
│   └── auth/          (2)
├── platform/
│   ├── app-shell/    (10)  contratos estructurales compartidos admin+clínica
│   ├── auth/ (2) · accessibility/ (2) · hydration/ (2) · theme/ (1) · smoke/ (1)
├── regression/
│   ├── visual/        (3)  + sus 3 dirs `*-snapshots` (30 PNG)
│   └── evidence/      (2)  generadores que escriben en docs/audit
├── fixtures/               (sin cambios)
├── helpers/                (sin cambios)
└── suites/                 (nuevo: catálogo + runner, §14–15)
```

Suma: 18 + 21 + 8 + 2 + 18 + 5 = **72** ✓ (verificada contra el inventario).

Correcciones razonadas a la propuesta secundaria del briefing:

- **Rechazado `regression/capacity/`**: los contratos de capacidad
  (`admin-users-workspace-5000`, `admin-users-workspace-mobile-5000`,
  `admin-users-visual-quality-gate`, `clinic-reports-workspace-1000`) fijan
  comportamiento de un dominio bajo volumen; su ownership es `admin/users/` y
  `clinic/reports/`. "capacity" pasa a ser cohorte del catálogo. Regla 3 del briefing
  aplicada consistentemente.
- **Rechazados `admin/sessions/`, `admin/audit/`, `admin/system/` como carpetas
  iniciales**: hoy **no existe ningún spec** cuyo ownership primario sea sesiones,
  auditoría o system health admin de forma aislada (esas superficies se cubren dentro
  de las familias de módulos del shell). Crear carpetas vacías contradice la convención
  (no materializar subcarpetas sin specs). Quedan como destinos válidos futuros.
- **Añadidos** `platform/app-shell/` y `platform/smoke/`: los 10 contratos
  estructurales `dashboard-*` cubren admin y clínica a la vez (verificado por lectura
  dirigida: p. ej. `dashboard-real-app-shell-no-scroll-contract` y
  `dashboard-card-navigation-shell` iteran ambos actores) — no pertenecen a un dominio.
  `visual-smoke` es sanity de disponibilidad multi-superficie.
- **Añadidos** `public/home/`, `public/services/`, `public/clinics/` para no forzar
  specs de landing a `routes/`/`navigation/`.
- **Rechazado `scripts/` como carpeta separada**: el único ejecutable propuesto (runner
  de cohortes) convive con el catálogo en `suites/`; los helpers `.mjs` existentes ya
  viven correctamente en `helpers/`.
- Specs clínicos con prefijo `dashboard-` se **mueven sin renombrar** (los renombres
  multiplican referencias y se difieren a un lote opcional posterior; §12 queda como
  registro de deuda).

Reglas vinculantes confirmadas: una sola ubicación física por spec; sin duplicación
para representar cohortes; helpers/fixtures nunca mezclados con specs; los snapshots
`*-snapshots/` viajan junto a su spec (convención de Playwright: el snapshotDir por
defecto es adyacente al archivo del test).

---

## 14. Contrato del catálogo `[PROPUESTO]`

Fuente única: **`frontend/e2e/suites/catalog.ts`** — módulo TypeScript puro (sin
dependencias), exporta un array tipado congelado con una entrada por spec:

```ts
type SpecEntry = {
  path: string;                 // path canónico relativo a frontend/e2e
  domain: "admin" | "clinic" | "public" | "particular" | "platform" | "regression";
  feature: string;              // subcarpeta: "shell", "reports", ...
  criticality: "critical" | "high" | "medium";
  cohorts: {
    smoke: boolean;             // cohorte rápida, siempre en gate
    ci: "smoke" | "admin-mobile" | "visual-contract" | "public-clinic" | null;
    full: true;                 // invariante: todo spec pertenece a full
    manual: "visual-linux" | "evidence" | null;
    extended: boolean;          // cola local/nightly con ownership declarado
  };
  platform: "any" | "linux-only";
  artifacts: "none" | "test-results-png" | "tracked-docs-png" | "linux-snapshots";
  fixtures: ("api-server" | "api-server-direct" | "admin-mobile-contracts"
            | "particular-session-contracts")[];
  contract: string;             // producto/contrato protegido (1 línea)
  flakeRisk: "low" | "medium" | "known-issue";
  owner: "admin" | "clinic" | "public" | "particular" | "platform" | "qa";
  reason: string;               // motivo de inclusión en su cohorte CI/extended
};
```

Comparación de alternativas y decisión:

| Opción | Evaluación | Decisión |
| --- | --- | --- |
| **1. Manifest/catalog** | Fuente única legible y machine-checkable; permite guard de completitud trivial (comparar contra `git ls-files`); habilita runner, `affected` fail-closed y reporting por cohorte; costo: un archivo que mantener (protegido por el guard) | **Elegida (primaria)** |
| 2. Tags Playwright (`@smoke`) | Exige editar los 72 specs (viola "move mecánico"); la membresía queda dispersa en 72 archivos; no hay censo verificable de "spec sin tag" sin tooling extra; grep-débil ante typos | Rechazada |
| 3. `projects` + `testMatch` | Config-only, pero convierte `playwright.config.ts` en la fuente de cohortes sin metadata (criticidad, fixture, riesgo); la completitud habría que verificarla parseando config; mezcla infraestructura de servidores con política de suites | Rechazada como fuente; **aceptada como consumidor opcional** en E2E-ORG-CI (proyectos generados desde el catálogo si se quiere reporting por cohorte en una sola corrida) |
| 4. Carpetas usadas directamente por scripts | Convertiría ownership físico en cohorte (viola la regla 3 del briefing: smoke/ci/full son cohortes, no ownership); una promoción a CI obligaría a mover archivos | Rechazada |
| 5. Combinación controlada | Carpetas = ownership físico; catálogo = cohortes y metadata; scripts = consumidores del catálogo; workflow = consumidor de scripts | **Recomendación final** (1 + estructura §13) |

---

## 15. Contrato de comandos PNPM `[PROPUESTO]`

Estado final tras E2E-ORG-CI (los nombres de cohortes se conservan por continuidad
con la taxonomy de gobernanza; el renombre de `visual-contract` queda como deuda):

| Script | Implementación futura | Nota |
| --- | --- | --- |
| `e2e` | `playwright test` | intacto (anclado por `package-scripts-contract`) |
| `e2e:full` | alias de `e2e` o retirado en E2E-ORG-X | duplicado actual |
| `e2e:smoke` / `e2e:admin-mobile` / `e2e:visual-contract` / `e2e:public-clinic` | `node e2e/suites/run-cohort.mjs <cohorte>` — el runner resuelve la lista desde el catálogo y ejecuta **una** invocación `playwright test <files>` | reemplaza las listas manuales de 7–13 paths |
| `e2e:ci` | `node e2e/suites/run-cohort.mjs ci` — **una sola invocación** con la unión de las 4 cohortes CI → **un solo ciclo de servidores** | hoy: 4 invocaciones |
| `e2e:extended` | runner, cohorte `extended` (cola con ownership declarado) | nueva |
| `e2e:evidence` | runner, cohorte `evidence` (los 2 generadores que ensucian docs/audit) — excluida de `full` cuando se decida en E2E-ORG-6 | nueva |
| `e2e:visual-linux` | runner, cohorte `visual-linux` (falla temprano con mensaje si `process.platform !== "linux"`, en lugar del rojo silencioso actual de `visual-regression-public` en win32) | nueva |
| `e2e:affected` | utilidad **sólo local**, §16 | nueva |
| `e2e:ui` / `e2e:report` / `e2e:verify-teardown` | intactos | anclados |

---

## 16. Diseño fail-closed para selección focal `[PROPUESTO]`

`e2e:affected` (nunca gate, sólo DX local):

1. Entrada: `git diff --name-only <base>` (+ untracked staged).
2. Mapa path→dominio derivado **del catálogo** más una tabla mínima de prefijos de
   `frontend/src` por dominio.
3. **Cierre por defecto**: si algún path cambiado (a) no matchea ningún prefijo
   conocido, (b) matchea superficie compartida (`frontend/src/app/globals.css`,
   `frontend/e2e/helpers/**`, `frontend/e2e/fixtures/**`,
   `frontend/playwright.config.ts`, `frontend/package.json`, `platform/**`) o
   (c) el diff está vacío/ilegible → **exit code ≠ 0** con el mensaje
   "superficie compartida o desconocida: ejecutá `pnpm e2e:ci`". Jamás ejecuta
   0 tests con exit 0.
4. Salida en modo válido: imprime la selección resuelta (specs y motivo) antes de
   ejecutar, para que la selección sea auditable.
5. Prohibido referenciarlo desde workflows; el guard de §17 puede verificar
   estáticamente esa ausencia.

---

## 17. Guard de suite-completeness propuesto `[PROPUESTO]`

`test/architecture/e2e-suite-catalog-completeness.test.ts` (runner `node:test`,
descubierto por `pnpm test` — gate backend-ci; reutiliza
`test/helpers/tracked-source-files.ts` de E2E-STAB-006 para censar por `git ls-files`).
Falla si:

1. existe un spec tracked `frontend/e2e/**/*.spec.ts` sin entrada en el catálogo
   (spec no catalogado);
2. un path aparece dos veces en el catálogo;
3. una entrada del catálogo apunta a un path inexistente;
4. una cohorte crítica queda vacía (`smoke`, cada cohorte CI, `full`);
5. la unión de cohortes CI pierde un spec marcado `criticality: "critical"` o difiere
   del set esperado versionado (protección contra demociones silenciosas: demover
   exige editar el set esperado en el mismo PR, visible en el diff);
6. (mientras existan) las listas literales de `frontend/package.json` difieren de la
   proyección del catálogo — este assert se retira cuando los scripts pasen al runner.

Con (1)–(6), un spec nuevo no puede nacer sin cohorte y una cohorte no puede perder
cobertura sin un cambio explícito y revisable.

---

## 18. Matriz completa actual → destino

72 filas = 72 specs tracked (igualdad verificada; suma por dominio 18+21+8+2+18+5=72).
Todas las columnas "actual" son `[OBSERVADO]`; "propuesto/a" son `[PROPUESTO]`.

Leyenda de abreviaturas:
**Cohorte/CI**: SM=e2e:smoke, AM=e2e:admin-mobile, VC=e2e:visual-contract,
PC=e2e:public-clinic, EXT=extended (propuesta), CAP=capacity (dentro de extended),
EV=evidence, VL=visual-linux, — = ninguna. CI actual "sí" = corre en frontend-ci.
**Fixture/helper**: API=fixture webServer (todos lo usan; se omite), +3107=consulta
HTTP directa a la fixture API, AMC=`helpers/admin-mobile-contracts.ts`,
PSC=`helpers/particular-session-contracts.ts`.
**Evid.**: TR=PNG a test-results (no tracked), DOCS=PNG/JSON a docs/audit (tracked),
SNAP=baselines `*-snapshots` versionados, mem=captura en memoria.
**Refs (referencias a actualizar en el move)**: R1=lista del script en
`frontend/package.json` (o catálogo si E2E-ORG-1 ya mergeó), R2=entrada del catálogo,
R3=prefijos de `test/helpers/dashboard-scope-guard.ts`, R4=paths en
`.github/workflows/visual-regression-manual.yml`, R5=dir `*-snapshots` adyacente,
R6=import relativo `./helpers/…`→`../../helpers/…`, R7=globs `representativePaths` de
`quality-gate-impact-policy.mjs` + regeneración del bloque de `test/README.md`
(lote E2E-ORG-CI/X, no bloquea moves). Riesgos: B=bajo, M=medio, A=alto.

### 18.1. Dominio admin (18 specs, 132 tests en CI + 30 fuera)

| Path actual (`frontend/e2e/`) | Path propuesto | Dominio | Feature | Contrato | Coh. act. | Coh. prop. | CI act. | CI prop. | Tests | Fixt/help | Plat. | Evid. | Flake | Riesgo move | Refs | Observaciones |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| admin-mobile-app-shell-absolute-no-scroll.spec.ts | admin/shell/ | admin | shell | estructural no-scroll | AM | AM | sí | sí | 6 | — | any | — | M | B | R1,R2 | |
| admin-mobile-bottom-navigation-no-scroll.spec.ts | admin/shell/ | admin | shell | estructural no-scroll | AM | AM | sí | sí | 4 | — | any | — | M | B | R1,R2 | flake removeChild resuelto (#1445-era); sin retries |
| admin-mobile-core-modules-no-scroll.spec.ts | admin/shell/ | admin | shell | estructural no-scroll | AM | AM | sí | sí | 14 | AMC | any | — | M | B | R1,R2,R6 | |
| admin-mobile-ops-modules-no-scroll.spec.ts | admin/shell/ | admin | shell | estructural no-scroll | AM | AM | sí | sí | 13 | AMC | any | — | M | B | R1,R2,R6 | |
| admin-mobile-status-modules-no-scroll.spec.ts | admin/shell/ | admin | shell | estructural + light/dark | AM | AM | sí | sí | 23 | AMC | any | TR | M | B | R1,R2,R6 | |
| admin-mobile-config-modules-no-scroll.spec.ts | admin/shell/ | admin | shell | estructural + light/dark | AM | AM | sí | sí | 22 | AMC | any | TR | M | B | R1,R2,R6 | |
| admin-mobile-final-polish-no-scroll.spec.ts | admin/shell/ | admin | shell | barrido integral clipping | AM | AM | sí | sí | 4 | AMC | any | TR | M | B | R1,R2,R6 | |
| admin-mobile-hub-launcher-no-scroll.spec.ts | admin/shell/ | admin | shell | hub launcher | AM | AM | sí | sí | 7 | — | any | — | M | B | R1,R2 | |
| admin-mobile-hub-stale-layer-stage.spec.ts | admin/shell/ | admin | shell | stage anti bleed-through | AM | AM | sí | sí | 4 | — | any | TR | M | B | R1,R2 | protege stacking-context fix del hub |
| admin-mobile-module-layer-isolation.spec.ts | admin/shell/ | admin | shell | aislamiento de capas | AM | AM | sí | sí | 7 | — | any | TR | M | B | R1,R2 | |
| admin-clinics-mobile-card-layout.spec.ts | admin/clinics/ | admin | clinics | layout cards mobile | AM | AM | sí | sí | 4 | — | any | — | M | B | R1,R2 | naming casi homónimo con edit-drawer (§12.6) |
| admin-clinic-edit-drawer.spec.ts | admin/clinics/ | admin | clinics | funcional + scope guard | AM | AM | sí | sí | 12 | — | any | — | B | B | R1,R2 | contrato de seguridad de aislamiento admin; no demover |
| admin-tokens-mobile-toolbar-layout.spec.ts | admin/tokens/ | admin | tokens | toolbar mobile | AM | AM | sí | sí | 12 | — | any | — | M | B | R1,R2 | |
| admin-pricing-multi-form-measurement.spec.ts | admin/pricing/ | admin | pricing | medición multi-form | — | EXT | no | no | 1 | — | any | — | B | B | R2 | 2 waits de settle documentados (E2E-STAB §5) |
| admin-users-fixture-pagination.spec.ts | admin/users/ | admin | users | contrato de fixture | — | EXT | no | no | 4 | +3107 | any | — | B | B | R2 | acoplado al puerto 3107 |
| admin-users-visual-quality-gate.spec.ts | admin/users/ | admin | users | calidad visual 1440×900 | — | CAP | no | no | 15 | AMC | any | — | M (dev-mode) | B | R2,R6 | flake por contención dev; mitigación = Fase G |
| admin-users-workspace-5000.spec.ts | admin/users/ | admin | users | capacidad 5000 | — | CAP | no | no | 4 | — | any | — | B | B | R2 | |
| admin-users-workspace-mobile-5000.spec.ts | admin/users/ | admin | users | capacidad 5000 mobile | — | CAP | no | no | 6 | AMC | any | — | B | B | R2,R6 | sincronización `stepMobilePage` (E2E-STAB) |

### 18.2. Dominio clinic (21 specs)

| Path actual | Path propuesto | Dominio | Feature | Contrato | Coh. act. | Coh. prop. | CI act. | CI prop. | Tests | Fixt/help | Plat. | Evid. | Flake | Riesgo move | Refs | Observaciones |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| clinic-informes-zero-internal-scroll.spec.ts | clinic/reports/ | clinic | reports | no-scroll interno informes | — | EXT | no | no | 4 | — | any | — | B | B | R2 | waits de settle documentados |
| clinic-reports-fixture-pagination.spec.ts | clinic/reports/ | clinic | reports | contrato de fixture | — | EXT | no | no | 4 | +3107 | any | — | B | B | R2 | acoplado al puerto 3107 |
| clinic-reports-workspace-1000.spec.ts | clinic/reports/ | clinic | reports | capacidad 1000 + guards P1 | — | CAP | no | no | 5 | — | any | — | known-issue | B | R2 | **6 `test.fail` condicionales del P1 de Informes — no alterar** |
| dashboard-clinic-informes-mobile-parity.spec.ts | clinic/reports/ | clinic | reports | paridad mobile | PC | PC | sí | sí | 3 | — | any | — | B | B | R1,R2,R3 | |
| dashboard-informes-server-adaptive-pagination.spec.ts | clinic/reports/ | clinic | reports | paginación adaptativa server | — | EXT | no | no | 5 | — | any | — | M (dev-mode) | B | R2,R3 | misma familia del P1; sin test.fail propio |
| dashboard-clinic-logistica-mobile-parity.spec.ts | clinic/logistics/ | clinic | logistics | paridad mobile | PC | PC | sí | sí | 3 | — | any | — | B | B | R1,R2,R3 | |
| dashboard-logistica-metricas-full-route-adaptive.spec.ts | clinic/logistics/ | clinic | logistics | ruta completa adaptativa | — | EXT | no | no | 5 | — | any | — | B | B | R2,R3 | |
| dashboard-logistica-rutas-full-route-adaptive.spec.ts | clinic/logistics/ | clinic | logistics | ruta completa adaptativa | — | EXT | no | no | 4 | — | any | — | B | B | R2,R3 | |
| dashboard-logistica-visitas-full-route-adaptive.spec.ts | clinic/logistics/ | clinic | logistics | ruta completa adaptativa | — | EXT | no | no | 4 | — | any | — | B | B | R2,R3 | |
| logistics-mobile-no-horizontal-table.spec.ts | clinic/logistics/ | clinic | logistics | sin tabla horizontal mobile | — | EXT | no | no | 9 | — | any | — | M (dev-mode) | B | R2 | |
| dashboard-clinic-tokens-mobile-parity.spec.ts | clinic/tokens/ | clinic | tokens | paridad mobile | PC | PC | sí | sí | 3 | — | any | — | B | B | R1,R2,R3 | |
| dashboard-clinic-perfil-mobile-operability.spec.ts | clinic/profile/ | clinic | profile | operabilidad mobile | PC | PC | sí | sí | 3 | — | any | — | B | B | R1,R2,R3 | |
| dashboard-clinic-controller-workspace-parity.spec.ts | clinic/shell/ | clinic | shell | controller/rail/workspace | — | EXT | no | no | 26 | — | any | — | B | B | R2,R3 | realineado por E2E-STAB §4; heredó cobertura del spec retirado |
| dashboard-clinic-mobile-content-reachability.spec.ts | clinic/shell/ | clinic | shell | alcanzabilidad contenido | — | EXT | no | no | 5 | — | any | — | B | B | R2,R3 | protege fix #1466 |
| dashboard-clinic-mobile-operational-density.spec.ts | clinic/shell/ | clinic | shell | densidad operativa mobile | — | EXT | no | no | 19 | — | any | — | B | B | R2,R3 | |
| dashboard-clinic-module-state-parity.spec.ts | clinic/shell/ | clinic | shell | paridad de estados | — | EXT | no | no | 14 | — | any | — | B | B | R2,R3 | `setTimeout(700)` intencional del mock (loading state) |
| remove-dashboard-home-unified-workspace.spec.ts | clinic/shell/ | clinic | shell | conductual post-remoción hub | — | EXT | no | no | 12 | — | any | — | B | B | R2 | nombrado por el cambio (§12.3); rename diferido |
| dashboard-interaction-foundation.spec.ts | clinic/shell/ | clinic | shell | fundamentos de interacción | SM | SM | sí | sí | 8 | — | any | — | B | B | R1,R2,R3 | clinic-only (tipa `ClinicModule`, sin superficie admin) |
| dashboard-adaptive-rows.spec.ts | clinic/shell/ | clinic | shell | filas adaptativas | — | EXT | no | no | 3 | — | any | — | B | B | R2,R3 | clinic-only (verificado) |
| dashboard-centered-pager.spec.ts | clinic/shell/ | clinic | shell | pager centrado | — | EXT | no | no | 5 | — | any | — | B | B | R2,R3 | clinic-only (verificado) |
| dashboard-master-detail-state-polish.spec.ts | clinic/shell/ | clinic | shell | estados master-detail | VC | VC | sí | sí | 6 | — | any | — | M | B | R1,R2,R3 | clinic-only (verificado); cohorte VC se mantiene |

### 18.3. Dominio public (8 specs)

| Path actual | Path propuesto | Dominio | Feature | Contrato | Coh. act. | Coh. prop. | CI act. | CI prop. | Tests | Fixt/help | Plat. | Evid. | Flake | Riesgo move | Refs | Observaciones |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| public-routes.spec.ts | public/routes/ | public | routes | rutas públicas resuelven | SM | SM | sí | sí | 14 | — | any | — | M (dev-mode) | B | R1,R2 | frontera de disponibilidad; nunca demover |
| public-navigation-footer.spec.ts | public/navigation/ | public | navigation | nav + footer | PC | PC | sí | sí | 7 | — | any | — | B | B | R1,R2 | navegación vía PublicRouteControl (sin `<a>`/Link) |
| home-hero-evidence-first.spec.ts | public/home/ | public | home | hero evidence-first | PC | PC | sí | sí | 7 | — | any | — | B | B | R1,R2 | |
| public-perspective-scroll.spec.ts | public/home/ | public | home | scroll de perspectiva | PC | PC | sí | sí | 16 | — | any | — | M | B | R1,R2 | 3 waits; efecto auditado como imperceptible (PR-24) — no corregir aquí |
| public-service-bento-specimen-journey.spec.ts | public/services/ | public | services | bento servicios + journey | PC | PC | sí | sí | 20 | — | any | — | M | B | R1,R2 | |
| public-clinics-b2b-operations.spec.ts | public/clinics/ | public | clinics | landing B2B clínicas | PC | PC | sí | sí | 24 | — | any | — | M | B | R1,R2 | |
| public-pricing-actionable.spec.ts | public/pricing/ | public | pricing | precios accionables | PC | PC | sí | sí | 9 | — | any | — | B | B | R1,R2 | |
| public-report-preview.spec.ts | public/reports/ | public | reports | preview de informe público | PC | PC | sí | sí | 21 | — | any | — | M | B | R1,R2 | |

### 18.4. Dominio particular (2 specs)

| Path actual | Path propuesto | Dominio | Feature | Contrato | Coh. act. | Coh. prop. | CI act. | CI prop. | Tests | Fixt/help | Plat. | Evid. | Flake | Riesgo move | Refs | Observaciones |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| particular-authenticated-no-scroll.spec.ts | particular/auth/ | particular | auth | no-scroll autenticado | — | EXT | no | candidato | 4 | PSC | any | — | B | B | R2,R6 | única cobertura e2e del actor particular; candidata a CI |
| particular-authenticated-session-fixture.spec.ts | particular/auth/ | particular | auth | sesión particular (fixture) | — | EXT | no | candidato | 2 | PSC | any | — | B | B | R2,R6 | realineado E2E-STAB (identidad colapsada en 390×844: follow-up de producto) |

### 18.5. Dominio platform (18 specs)

| Path actual | Path propuesto | Dominio | Feature | Contrato | Coh. act. | Coh. prop. | CI act. | CI prop. | Tests | Fixt/help | Plat. | Evid. | Flake | Riesgo move | Refs | Observaciones |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| dashboard-auth-redirect.spec.ts | platform/auth/ | platform | auth | privado→redirect; admin→404 | SM | SM | sí | sí | 3 | — | any | — | B | B | R1,R2,R3 | **frontera de seguridad; nunca demover**; wait = ventana de no-rebote |
| dashboard-logout-private-cache.spec.ts | platform/auth/ | platform | auth | logout + no-store privados | — | **SM (promover)** | **no** | **sí** | 6 | — | any | — | B | B | R2,R3 | **P1 de gate: contrato de seguridad hoy fuera de CI** |
| accessibility-axe-key-routes.spec.ts | platform/accessibility/ | platform | accessibility | axe rutas clave | — | EXT | no | candidato | 8 | — | any | — | B | B | R2 | usa `@axe-core/playwright`; realineado E2E-STAB |
| dashboard-accessibility-keyboard.spec.ts | platform/accessibility/ | platform | accessibility | teclado dashboard | VC | VC | sí | sí | 14 | — | any | — | M | B | R1,R2,R3 | |
| login-hydration.spec.ts | platform/hydration/ | platform | hydration | hidratación /login | SM | SM | sí | sí | 2 | — | any | — | B | B | R1,R2 | |
| contacto-hydration.spec.ts | platform/hydration/ | platform | hydration | hidratación /contacto | SM | SM | sí | sí | 2 | — | any | — | B | B | R1,R2 | |
| theme-mode.spec.ts | platform/theme/ | platform | theme | toggle light/dark | SM | SM | sí | sí | 2 | — | any | — | B | B | R1,R2 | |
| visual-smoke.spec.ts | platform/smoke/ | platform | smoke | render sanity multi-superficie | SM | SM | sí | sí | 10 | — | any | mem | B | B | R1,R2 | |
| dashboard-card-navigation-shell.spec.ts | platform/app-shell/ | platform | app-shell | navegación/deep-links admin+clínica | VC | VC | sí | sí | 66 | — | any | — | M | B | R1,R2,R3 | el spec más caro de la suite |
| dashboard-app-shell-visibility-contract.spec.ts | platform/app-shell/ | platform | app-shell | visibilidad app-shell | VC | VC | sí | sí | 4 | — | any | — | M | B | R1,R2,R3 | |
| dashboard-real-app-shell-no-scroll-contract.spec.ts | platform/app-shell/ | platform | app-shell | no-scroll app-shell real | VC | VC | sí | sí | 37 | — | any | — | M | B | R1,R2,R3 | waits = ventanas de observación negativas |
| dashboard-internal-no-scroll-contract.spec.ts | platform/app-shell/ | platform | app-shell | no-scroll interno | VC | VC | sí | sí | 8 | — | any | — | M | B | R1,R2,R3 | |
| dashboard-single-viewport-app-shell.spec.ts | platform/app-shell/ | platform | app-shell | single-viewport | VC | VC | sí | sí | 18 | — | any | — | M | B | R1,R2,R3 | contrato central del App Shell |
| dashboard-global-masked-master-detail.spec.ts | platform/app-shell/ | platform | app-shell | master-detail enmascarado | VC | VC | sí | sí | 16 | — | any | — | M | B | R1,R2,R3 | |
| dashboard-workspace-layout-polish.spec.ts | platform/app-shell/ | platform | app-shell | pulido layout workspace | VC | VC | sí | sí | 19 | — | any | — | M | B | R1,R2,R3 | |
| dashboard-viewport-zoom-adaptability.spec.ts | platform/app-shell/ | platform | app-shell | adaptabilidad viewport/zoom | VC | VC | sí | sí | 60 | — | any | — | M | B | R1,R2,R3 | 2.º más caro |
| dashboard-mobile-shell-nav-contract.spec.ts | platform/app-shell/ | platform | app-shell | shell/nav mobile | VC | VC | sí | sí | 25 | — | any | — | M (dev-mode) | B | R1,R2,R3 | |
| dashboard-zero-scroll-mobile-boundary.spec.ts | platform/app-shell/ | platform | app-shell | límite zero-scroll admin+clínica | — | EXT | no | no | 8 | — | any | — | B | B | R2,R3 | realineado E2E-STAB §4 |

### 18.6. Dominio regression (5 specs + 30 snapshots)

| Path actual | Path propuesto | Dominio | Feature | Contrato | Coh. act. | Coh. prop. | CI act. | CI prop. | Tests | Fixt/help | Plat. | Evid. | Flake | Riesgo move | Refs | Observaciones |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| visual-regression-public.spec.ts | regression/visual/ | regression | visual | baseline píxeles público | manual (workflow) | VL | no (manual) | no (manual) | 10 | — | **linux-only sin skip** | SNAP (10) | rojo local win32 | **M-A** | R2,R4,R5 | serial; **sin `test.skip` de plataforma** — añadirlo queda fuera de este alcance, lo cubre el runner `e2e:visual-linux` |
| visual-regression-authenticated.spec.ts | regression/visual/ | regression | visual | baseline píxeles dashboards | manual (workflow) | VL | no (manual) | no (manual) | 10 | — | linux-only (skip) | SNAP (10) | B | **M-A** | R2,R4,R5 | serial |
| visual-regression-stress.spec.ts | regression/visual/ | regression | visual | baseline píxeles stress | manual (workflow) | VL | no (manual) | no (manual) | 10 | — | linux-only (skip) | SNAP (10) | B | **M-A** | R2,R4,R5 | serial |
| remove-home-unified-workspace-screenshots.spec.ts | regression/evidence/ | regression | evidence | generador de evidencia | — | EV | no | no | 10 | — | any | **DOCS** | B | M | R2 | `OUT_DIR` por `process.cwd()` (estable ante move); `waitForTimeout(900)` backlog E2E-STAB; ensucia árbol tracked |
| dashboard-runtime-post-ux1-visual-evidence.spec.ts | regression/evidence/ | regression | evidence | generador de evidencia + métricas | — | EV | no | no | 1 | — | any | **DOCS** | B | M | R2 | resuelve por `testInfo.config.rootDir` — **verificar resolución tras el move** en E2E-ORG-6 |

Los 5 archivos de soporte (`fixtures/` 1, `helpers/` 4) **no se mueven** en ningún lote:
sus paths están anclados por `playwright.config.ts`,
`test/unit/infrastructure/next-env-hygiene.test.ts` y
`test/architecture/tracked-source-inventory.test.ts`.

---

## 19. Plan de PRs `[PROPUESTO]`

Orden diseñado para que la fuente única y el guard existan **antes** de cualquier
movimiento (lección del manifiesto TEST-ARCH: las anclas se subcontabilizan si el
censo no precede al move). Scope de PR Governance según `quality-gate-impact-policy.mjs`:
todo cambio bajo `frontend/e2e/` rutea las 4 suites e2e de frontend-ci; cambios en
`frontend/package.json` rutean además lint/typecheck/build; cambios en workflows
rutean pr-governance + manual-review.

### E2E-ORG-1 — catálogo, runner focal y guard de completitud (sin moves, sin CI)

- **Archivos exactos**:
  1. `frontend/e2e/suites/catalog.ts` (nuevo) — 72 entradas conforme §14, con las
     cohortes actuales exactas (42 CI sin alteración) + `extended`/`capacity`/
     `evidence`/`visual-linux` para los 30 restantes según la matriz §18. La promoción
     de `dashboard-logout-private-cache` a smoke se incluye **sólo** si se autoriza
     explícitamente tocar la lista de `e2e:smoke` en este PR; si no, se marca
     `criticality: "critical"` + `extended` y se promueve en E2E-ORG-CI.
  2. `frontend/e2e/suites/run-cohort.mjs` (nuevo) — runner: lee el catálogo, imprime la
     selección, ejecuta una única invocación `playwright test <files>`; falla con
     mensaje ante cohorte desconocida o vacía (fail-closed).
  3. `test/architecture/e2e-suite-catalog-completeness.test.ts` (nuevo) — guard §17,
     incluye el assert (6) de paridad catálogo ↔ listas literales de
     `frontend/package.json`.
  4. `frontend/package.json` — añade `e2e:ci` ya existente… **corrección**: `e2e:ci`
     existe; este PR **no** cambia los 4 scripts de cohorte (siguen con listas
     literales, ahora verificadas por el guard) y añade sólo `e2e:extended`,
     `e2e:evidence`, `e2e:visual-linux`, `e2e:affected` como scripts del runner.
- **Validación**: `pnpm test` (guard verde = catálogo completo y en paridad),
  `pnpm typecheck:test`, `pnpm --dir frontend lint|typecheck|build`,
  `pnpm --dir frontend e2e:smoke` focal, `pnpm e2e:verify-teardown` (script frontend),
  revertir `next-env.d.ts` antes de `pnpm test` (regla conocida del repo),
  `pnpm security:public-surface`.
- **Riesgo**: bajo (aditivo). **Rollback**: borrar los 3 archivos nuevos + revertir
  scripts añadidos. **Dependencias**: ninguna. **Governance**: frontend-package +
  frontend-e2e + node-tests.

### E2E-ORG-2 — dominio admin (18 moves)

- Mover los 18 specs de §18.1 a `admin/{shell,clinics,pricing,tokens,users}/`.
- Referencias: R2 (18 entradas del catálogo), R1 (13 paths de `e2e:admin-mobile` — o
  su proyección si los scripts ya consumen el runner), R6 (7 imports AMC).
- Validación focal: `pnpm --dir frontend e2e:admin-mobile` + guard (`pnpm test`) +
  lint/typecheck/build + verify-teardown. Completa: `e2e:ci` local.
- Riesgo: bajo-medio (volumen). Rollback: revert del move + catálogo. Depende de ORG-1.

### E2E-ORG-3 — dominio clinic (21 moves)

- Mover §18.2 a `clinic/**`. Referencias: R2, R1 (5 paths PC + 1 SM + 1 VC), R6 (0),
  **R3: añadir los nuevos prefijos (`frontend/e2e/clinic`) a
  `test/helpers/dashboard-scope-guard.ts` en el mismo PR** (los specs `dashboard-*`
  clínicos salen del prefijo `frontend/e2e/dashboard`).
- No alterar `clinic-reports-workspace-1000` más allá del path (guards P1 intactos).
- Validación: `e2e:public-clinic` + `e2e:smoke` + `e2e:visual-contract` focales +
  `pnpm test` + suite frontend estándar. Depende de ORG-1.

### E2E-ORG-4 — public y particular (10 moves)

- Mover §18.3 (8) y §18.4 (2). Referencias: R2, R1 (7 paths PC + 1 SM), R6 (2 PSC).
- Validación: `e2e:public-clinic` + `e2e:smoke` focales + guard. Depende de ORG-1.

### E2E-ORG-5 — platform (18 moves)

- Mover §18.5. Referencias: R2, R1 (5 SM + 10 VC), **R3** (salen más `dashboard-*` del
  prefijo; dejar el prefijo legacy sólo si aún quedan specs bajo él — tras ORG-5 ya no
  quedará ninguno: reemplazar por `frontend/e2e/platform` + `frontend/e2e/clinic`).
- Validación: `e2e:smoke` + `e2e:visual-contract` focales + guard. Depende de ORG-1
  (y conviene tras ORG-3 para consolidar R3 una sola vez de forma coherente).

### E2E-ORG-6 — regression, evidence y visual-linux (5 moves + 30 snapshots)

- Mover §18.6 con sus 3 dirs `*-snapshots` adyacentes (R5, mecánico con el spec).
- **R4 `[BLOQUEANTE condicional]`**: exige editar
  `.github/workflows/visual-regression-manual.yml` (3 paths de specs; el patrón PNG
  `frontend/e2e/**/*.png` sobrevive). Tocar workflows requiere autorización explícita
  → este lote no puede ejecutarse como "solo moves". Alternativa si no se autoriza:
  diferir sólo los 3 `visual-regression-*` y mover los 2 de evidence.
- Verificar tras el move la resolución de `testInfo.config.rootDir` en
  `dashboard-runtime-post-ux1-visual-evidence` (marcada en §18.6). Decisión de backlog
  E2E-STAB §8.3 (sacar evidence de `full` o redirigir la salida a no-tracked) se toma
  aquí, no antes.
- Validación: `e2e:evidence` y `e2e:visual-linux` focales (este último verifica el
  fallo temprano en win32), corrida manual del workflow en Linux si se tocó, guard.

### E2E-ORG-CI — una sola invocación Playwright en frontend CI

- Cambiar el step "Run frontend E2E layered tests" por `pnpm --dir frontend e2e:ci`
  (runner → una invocación, un ciclo de servidores) y, si se decidió, materializar la
  promoción de `dashboard-logout-private-cache`.
- **Referencias obligatorias en el mismo PR**: `frontend-ci.yml`,
  `test/unit/infrastructure/frontend-ci-workflow.test.ts` y
  `test/unit/infrastructure/production-readiness.test.ts` (fijan el texto literal del
  step), `scripts/governance/quality-gate-impact-policy.mjs` (`representativePaths`
  nuevos por carpeta + posible suite id) **+ regenerar el bloque
  `quality-gate-taxonomy` de `test/README.md`**, y
  `test/unit/infrastructure/quality-gate-impact-contract.test.ts` si cambia la
  taxonomy. Requiere autorización explícita (workflows + governance).
- Gate intermedio: mantener las 4 invocaciones hasta demostrar localmente que
  `e2e:ci` (una invocación) ejecuta exactamente los mismos specs (paridad impresa por
  el runner + guard).

### E2E-ORG-X — closeout

- Retirar `e2e:full` duplicado (o consolidarlo como alias documentado), retirar el
  assert (6) transitorio del guard si los scripts ya consumen el runner, actualizar
  `docs/implementation/test-suite-enterprise-organization-convention.md` §3-E2E y
  `test/README.md` con la estructura final, registrar deuda de renombres (§12) y
  estado residual. Docs + package.json mínimos.

Regla transversal: **ningún lote mezcla moves con renombres ni con cambios de
assertions**; cada lote deja rollback = revert del move + revert de catálogo/refs.

---

## 20. Riesgos y mitigaciones

| # | Riesgo | Marca | Mitigación |
| --- | --- | --- | --- |
| 1 | Pérdida silenciosa de cobertura al mover (spec fuera de toda cohorte) | `[RIESGO]` principal | Guard §17 (1)+(5) mergeado **antes** del primer move (orden del plan §19) |
| 2 | Anclas subcontabilizadas (lección TEST-ARCH-12/15) | `[RIESGO]` | Censo §12.7 exhaustivo por `git grep` sobre todo el repo no-docs; cada lote re-verifica referencias antes de cerrar |
| 3 | `dashboard-scope-guard` deja de aplicar a diffs e2e tras ORG-3/5 | `[RIESGO]` | Actualizar `DASHBOARD_SCOPE_PREFIXES` en el mismo PR (precedente #958 de alinear guards in-PR) |
| 4 | Workflow visual manual roto por move de visual-regression | `[BLOQUEANTE condicional]` | ORG-6 exige autorización de workflows; si no llega, se difieren sólo esos 3 specs |
| 5 | Snapshots invalidados al mover (snapshotDir adyacente) | `[RIESGO]` | Mover los dirs `*-snapshots` junto al spec en el mismo commit; verificación en Linux vía workflow manual |
| 6 | El runner altera la membresía de una cohorte | `[RIESGO]` | El runner imprime la selección; el guard exige paridad con el catálogo; comparación before/after documentada en el PR de ORG-1 |
| 7 | Flakes conocidos de contención dev-mode se atribuyen al reorg | `[RIESGO]` | Clase documentada (E2E-STAB §8.5, 5 specs en matriz); control A/B con la base antes de culpar al move; causa de fondo = Fase G (fuera de alcance) |
| 8 | `next-env.d.ts` ensucia el árbol en validaciones con e2e | `[RIESGO]` | globalTeardown existente + regla operativa conocida (revertir antes de `pnpm test`) |
| 9 | Los 2 specs de evidence ensucian docs/audit en `e2e:full` | `[OBSERVADO]` hoy | Cohorte `evidence` separada en ORG-1; decisión de exclusión de `full` en ORG-6 |
| 10 | `e2e:affected` ejecuta 0 tests y da verde | `[RIESGO]` | Diseño fail-closed §16 (exit ≠ 0 ante paths compartidos/desconocidos/selección vacía); prohibido en workflows |
| 11 | Promoción/democión de contratos de seguridad sin revisión | `[RIESGO]` | Guard §17 (5): el set esperado del gate está versionado; demover exige diff explícito |

---

## 21. No-alcance

- No se implementa nada de §13–§19 en esta fase (docs-only).
- El defecto P1 de `/dashboard/informes` (colapso adaptativo a 1 fila) **no se corrige**
  y sus expected-failure guards **no se alteran** (documentados en §6 y §18.2).
- Fase G (`next build` + `next start` para CI) permanece completamente separada
  (backlog E2E-STAB §8.2); este plan no la adelanta ni la bloquea.
- No se modifican runtime, backend, API, auth, sesiones, DB, schema, migrations,
  dependencias, lockfiles, configuración PNPM, CI, fixtures ni helpers.
- No se ejecutó ninguna suite E2E, staging ni producción; no se ejecutó Git de
  escritura.
- El follow-up de producto de la identidad tutor/mascota en viewport particular
  (E2E-STAB §8.6) y la corrección del perspective-scroll (PR-26) siguen fuera.
- Renombres de specs (deuda §12): diferidos; ningún lote del plan renombra.

---

## 22. Criterios de aceptación

De esta fase (E2E-ORG-A):

1. Único archivo nuevo: `docs/audit/e2e-enterprise-organization-audit.md`; ningún otro
   archivo modificado (verificado en §23).
2. Matriz con los 72 specs tracked, cada uno exactamente una vez, con dominio, feature
   y destino propuesto; suma por dominio = inventario.
3. Cohortes reconstruidas desde `frontend/package.json` y `frontend-ci.yml` reales.
4. Los 30 specs fuera de CI enumerados; solapamientos (cero) verificados.
5. Primer PR futuro (E2E-ORG-1) con archivos y validaciones concretas, ejecutable en
   un chat nuevo sin repetir la auditoría.

De la futura reorganización (para los PRs E2E-ORG-1…X):

6. La unión de cohortes CI nunca pierde specs respecto del set versionado esperado;
   el guard de completitud está verde en cada lote.
7. Cada spec conserva una sola ubicación física y su basename (sin renombres).
8. `e2e:ci` final = una invocación Playwright, un ciclo de servidores, misma cobertura
   demostrada (42 specs o el set promovido explícitamente).
9. `e2e:affected` nunca es gate y falla cerrado.
10. Los guards del P1 de Informes y los contratos de seguridad
    (`dashboard-auth-redirect`, `admin-clinic-edit-drawer`,
    `dashboard-logout-private-cache`) terminan dentro del gate, nunca fuera.

---

## 23. Verificación interna de completitud

Ejecutada antes de cerrar este documento:

1. **Igualdad de conteos**: inventario tracked = 72; `playwright test --list` = 72
   archivos / 785 tests; filas de la matriz = 18+21+8+2+18+5 = 72; cohortes CI
   42 (7+13+11+11, disjuntas) + fuera de CI 30 = 72. ✓
2. **Suma de tests**: CI 41+132+273+116 = 562; fuera de CI 223; 562+223 = 785. ✓
3. Cohortes reconstruidas desde archivos reales del HEAD (no desde docs históricos);
   discrepancia 73→72 con E2E-STAB-1 explicada con evidencia (`HEAD~1`). ✓
4. Scripts de `frontend/package.json` comparados con `frontend-ci.yml` (mismas 4
   invocaciones) y con la taxonomy de gobernanza. ✓
5. Los `[OBSERVADO]` provienen de comandos listados en §5 con salida real; lo no
   verificado está marcado (única instancia: ninguna — no quedaron `[NO CONFIRMADO]`;
   la resolución de `rootDir` post-move en §18.6 se marca como verificación diferida
   al PR que la afecte, no como hecho). ✓
6. Expected-failure guards de Informes documentados sin alterar; Fase G y P1 fuera de
   alcance; sin cambios productivos recomendados dentro de esta fase. ✓
7. Paths propuestos sin duplicados (72 destinos únicos). ✓
8. Sin Git de escritura ejecutado; un único archivo creado (validación §"Validación
   final" del cierre). ✓

---

## 24. Recomendación final

**GO CON CONDICIONES.**

La reorganización es viable y necesaria: la raíz plana de 72 specs, las listas
manuales de 42 paths, las 4 invocaciones con 4 ciclos de servidores y la cola no-CI
sin ownership (que ya se pudrió una vez) son deuda estructural real con causa raíz
única — no existe fuente de verdad de cobertura. Condiciones vinculantes:

1. **E2E-ORG-1 primero** (catálogo + runner + guard, sin moves y sin CI): ningún
   movimiento físico antes de que el guard de completitud esté en `pnpm test`.
2. **E2E-ORG-6 y E2E-ORG-CI requieren autorización explícita** para tocar
   `.github/workflows/**`, la policy de gobernanza y sus tests ancla; sin esa
   autorización, esos lotes se difieren sin bloquear ORG-2…5.
3. **Los prefijos de `dashboard-scope-guard` se actualizan en el mismo PR** que mueva
   specs `dashboard-*` (ORG-3/ORG-5).
4. **Sin renombres ni cambios de assertions** en ningún lote de move; los guards del
   P1 de Informes viajan intactos.
5. La promoción de `dashboard-logout-private-cache` al gate se ejecuta a más tardar en
   E2E-ORG-CI (hueco de seguridad documentado en §10).
