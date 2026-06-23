# Admin Mobile Density — White-box audit for E2E, legacy and optimization

> Auditoría read-only. **No modifica código productivo, tests, backend, API, auth, DB,
> migrations, deps, lockfiles ni CI.** Solo documenta hallazgos y propone PRs futuros.

## 1. Resumen ejecutivo

**La sospecha de exceso de E2E es VÁLIDA y está respaldada por evidencia.**

- `frontend/playwright.config.ts` corre **todo** `./e2e` (42 specs `.spec.ts`) bajo un único
  proyecto Chromium, levantando además **dos** web servers (fixture API `:3107` + Next dev `:3000`).
- `.github/workflows/frontend-ci.yml:70-71` ejecuta `pnpm --dir frontend e2e` (la suite completa)
  en cada `push`/`pull_request` a `main`, con el step rotulado **"Run frontend E2E smoke tests"**
  cuando en realidad NO es un smoke: corre las 42 specs, varias con 5 viewports × light/dark ×
  screenshots. El nombre del step engaña sobre el costo real.
- De esas 42, **13 son admin-mobile / mobile-admin** (10 `admin-mobile-*` + `admin-tokens-mobile-toolbar-layout`
  + `admin-clinics-mobile-card-layout`) y concentran el grueso del costo: los `.md` de cierre de cada PR
  registran corridas de 23/23, 30/30, 31/31, 60/60, 79/79, 112/121 casos.
- **Cero centralización de helpers**: 6 funciones idénticas (`setPopulatedAdminSession`,
  `suppressNextDevIndicator`, `readNoScrollContract`, `assertNoScrollContract`,
  `expectInsideViewport`, `fulfillJson`) están **re-declaradas localmente** en hasta 10 specs
  (104 ocurrencias). No existe `frontend/e2e/helpers/` ni `support/`; lo único compartido es
  `frontend/e2e/fixtures/admin-populated-api-server.mjs`.
- **Solapamiento real**: `admin-mobile-final-polish-no-scroll.spec.ts` vuelve a recorrer launcher,
  menús, notificaciones, los 6 módulos mobile y el smoke desktop — territorio ya cubierto por specs
  dedicadas. `status-modules` y `config-modules` combinan 5 viewports × light/dark × módulos +
  screenshots manuales.
- **Duplicación de producto**: `AdminMobileSessionsModule`, `AdminMobileAuditModule` y
  `AdminMobileUsersModule` comparten exactamente el mismo cálculo de paginación, shell `md:hidden`
  y footer `AdminMobileOpsPager`; la constante `MOBILE_PAGE_SIZE = 10` está repetida en 5 archivos.

**Conclusión:** hay margen claro de optimización **sin perder cobertura productiva**, atacable en
PRs chicos y reversibles. Pero el riesgo de borrar contrato vivo es real (specs `no-scroll`,
`layer-isolation` y `hub-stale-layer-stage` defienden invariantes de stacking/bleed-through ya
documentados en memoria del proyecto). La recomendación es **consolidar y reclasificar, no borrar a ciegas**.

## 2. Base auditada

| Campo | Valor |
| --- | --- |
| Branch de trabajo | `audit/admin-mobile-whitebox-e2e-optimization` |
| Branch base | `main` |
| HEAD (`git rev-parse HEAD`) | `c1efa9abb2ff724909f9fac87746e1a981412f04` |
| `origin/main` | `c1efa9abb2ff724909f9fac87746e1a981412f04` (idéntico) |
| Último commit | `c1efa9a fix(admin): refine mobile sessions density (#1088)` |
| `git status` | limpio antes de crear la rama; tras crear la rama, solo este archivo nuevo |
| Worktrees | 1 (`C:/PORTAL-VETNEB`) |
| Fecha | 2026-06-23 |
| Plataforma | Windows / PowerShell / PNPM |

Inventario base (read-only, `git ls-files`):

- `frontend/e2e/*.spec.ts`: **42** specs.
- `test/*.test.ts`: **404** tests nativos (Node/Fastify/contract).
- `legacy/**`: **3** archivos (`legacy/drizzle-old/README.md`, `big_zuras.sql`, `loving_boom_boom.sql`).
- `docs/**`: ~170 documentos (alto volumen de auditorías/PR-history previas).

## 3. Inventario E2E

### 3.1 Specs admin-mobile / mobile-admin (foco de la auditoría)

| Spec | Propósito real | Módulos cubiertos | Viewports | Color modes | Screenshots | Mocks locales | Criticidad | Acción |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `admin-mobile-app-shell-absolute-no-scroll.spec.ts` (8.4 KB) | App shell admin mobile sin scroll absoluto (html/body) | shell global | 5 (360×640, 360×740, 390×844, 412×915, 430×932) | no | no | no (fixture) | Alta (contrato no-scroll) | Mantener en CI |
| `admin-mobile-bottom-navigation-no-scroll.spec.ts` (6.9 KB) | Bottom-nav admin + smoke desktop | bottom-nav, app bar | 3 mobile + desktop 1280 | no | no | no (fixture) | Alta | Mantener en CI |
| `admin-mobile-hub-launcher-no-scroll.spec.ts` (11.5 KB) | Hub launcher + paginación de tiles + no-scroll + desktop | hub launcher | 5 mobile + desktop 1280 | no | no | no (fixture) | Alta | Mantener en CI |
| `admin-mobile-core-modules-no-scroll.spec.ts` (17.3 KB) | No-scroll de módulos core (clínicas/reportes/tokens) + desktop | clinics, reports, tokens | 3 mobile + desktop 1280 | no | no | no (fixture) | Alta | Mantener (núcleo de cobertura core) |
| `admin-mobile-ops-modules-no-scroll.spec.ts` (14.7 KB) | No-scroll de módulos ops (sesiones/auditoría/usuarios) + no-recorte de selects | sessions, audit, users | 3 mobile + desktop + 360 extra | no | no | **sí** (`fulfillJson`) | Alta | Mantener (núcleo ops) |
| `admin-mobile-status-modules-no-scroll.spec.ts` (20.8 KB) | No-scroll de status (resumen/health/alertas), 5 viewports × light/dark + screenshots | overview, health, alerts | 5 mobile + desktop | **light/dark** | **sí** (l.290) | **sí** (`fulfillJson`) | Media-alta | Reducir matriz / mover screenshots a visual-contract |
| `admin-mobile-config-modules-no-scroll.spec.ts` (18.1 KB) | No-scroll de config (precios/mantenimiento), 5 viewports × light/dark + screenshots | pricing, maintenance, config | 5 mobile + desktop | **light/dark** | **sí** (l.319) | **sí** (`fulfillJson`) | Media-alta | Reducir matriz / mover screenshots a visual-contract |
| `admin-mobile-module-layer-isolation.spec.ts` (21.0 KB) | Aislamiento de capas / stacking context (bleed-through) | swap de módulos | 3 mobile + matriz 4 (light/dark) | **light/dark** | **sí** (l.560) | parcial | **Crítica** (invariante de stacking) | Mantener; aislar de la suite default |
| `admin-mobile-hub-stale-layer-stage.spec.ts` (8.6 KB) | Stage persistente del Hub (bleed-through al swap) | hub stage | 4 combos viewport+mode | **light/dark** | **sí** (l.232) | parcial | **Crítica** (regresión #documentada) | Mantener; aislar de la suite default |
| `admin-mobile-final-polish-no-scroll.spec.ts` (21.6 KB) | "Closeout" que re-recorre launcher + menús + notificaciones + 6 módulos + smoke desktop | **TODO admin mobile** | 3 mobile + desktop | light (fijo) | **sí** (l.216) | **sí** (`fulfillJson`) | Media (solapada) | **Fusionar/retirar** o reducir a smoke fino |
| `admin-tokens-mobile-toolbar-layout.spec.ts` (18.2 KB) | Layout/overflow de toolbar de tokens particulares | tokens | múltiples | no | no | **sí** (`page.route` tokens + users-roles) | Media | Mantener; deduplicar mocks vía fixture |
| `admin-clinics-mobile-card-layout.spec.ts` (9.2 KB) | Layout de card de clínicas mobile + paginación | clinics | 3 + test paginación | no | no | parcial | Media | Mantener |

> Observación transversal: **7 de estas specs cierran con un "smoke desktop 1280×800"**
> (`core`, `hub-launcher`, `bottom-nav`, `ops`, `config`, `status`, `final-polish`). Ese desktop
> smoke está repetido 7 veces y podría centralizarse en una sola aserción.

### 3.2 Resto de specs E2E (contexto, fuera del foco)

| Grupo | Specs | Naturaleza | Acción sugerida |
| --- | --- | --- | --- |
| Dashboard shell / no-scroll (no admin-mobile) | `dashboard-real-app-shell-no-scroll-contract`, `dashboard-single-viewport-app-shell`, `dashboard-internal-no-scroll-contract`, `dashboard-app-shell-visibility-contract`, `dashboard-mobile-shell-nav-contract`, `dashboard-card-navigation-shell`, `dashboard-global-masked-master-detail`, `dashboard-master-detail-state-polish`, `dashboard-workspace-layout-polish`, `dashboard-interaction-foundation`, `dashboard-accessibility-keyboard`, `dashboard-viewport-zoom-adaptability` | Contrato de shell/no-scroll del dashboard general | Mantener (capa `e2e:full`/contract) |
| Clínica mobile parity | `dashboard-clinic-informes-mobile-parity`, `dashboard-clinic-logistica-mobile-parity`, `dashboard-clinic-perfil-mobile-operability`, `dashboard-clinic-tokens-mobile-parity` | Paridad mobile de clínica (no admin) | Mantener |
| Auth/redirect | `dashboard-auth-redirect` | Smoke de redirección | `e2e:smoke` |
| Público | `public-routes`, `public-navigation-footer`, `public-pricing-actionable`, `public-report-preview`, `public-clinics-b2b-operations`, `public-service-bento-specimen-journey`, `public-perspective-scroll`, `home-hero-evidence-first` | Superficie pública | Mantener (capa `e2e:full`) |
| Hidratación / tema / visual | `contacto-hydration`, `login-hydration`, `theme-mode`, `visual-smoke` | Smoke ligero | `e2e:smoke` |
| Admin desktop | `admin-clinic-edit-drawer` | Drawer admin desktop | Mantener |

## 4. Matriz de solapamiento E2E

`X` = el spec asume/valida esa dimensión.

| Dimensión / Spec | app-shell | bottom-nav | hub-launcher | core | ops | status | config | layer-isolation | hub-stale | **final-polish** |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| no-scroll html/body/main | X | X | X | X | X | X | X | — | — | **X** |
| no overflow auto/scroll | X | X | X | X | X | X | X | X | — | **X** |
| viewport bounding boxes | — | X | X | X | X | — | — | — | — | **X** |
| app bar / bottom nav | X | X | — | — | — | — | — | — | — | **X** |
| hub launcher | — | — | X | — | — | — | — | X | X | **X** |
| core modules (clinics/reports/tokens) | — | — | — | X | — | — | — | — | — | **X** |
| ops modules (sessions/audit/users) | — | — | — | — | X | — | — | — | — | **X** |
| status modules (overview/health/alerts) | — | — | — | — | — | X | — | — | — | **X** |
| config modules (pricing/maintenance) | — | — | — | — | — | — | X | — | — | **X** |
| screenshots | — | — | — | — | — | X | X | X | X | **X** |
| desktop smoke 1280×800 | — | X | X | X | X | X | X | — | — | **X** |

**Lectura:**

- `final-polish` marca **todas** las filas → es un "paraguas" cuyo valor incremental sobre las specs
  dedicadas es bajo. Es el candidato #1 a **fusionar/retirar** (o reducir a un smoke fino que NO repita
  los 6 módulos).
- El bloque `no-scroll html/body/main` lo defienden 8 specs con el **mismo** `assertNoScrollContract`.
  El contrato es uno solo; lo que cambia es el módulo montado. Esto justifica extraer el helper
  (no borrar las specs, sino dejar de duplicar el código).
- `layer-isolation` y `hub-stale-layer-stage` **no se solapan** con las de no-scroll: defienden el
  invariante de stacking-context/bleed-through (ver memoria `project_admin_mobile_hub_stage`). Son
  cobertura única — **no fusionar**.
- `desktop smoke 1280×800` aparece 7 veces: centralizable en una sola aserción de desktop.

## 5. Duplicación técnica

No existe módulo de helpers compartido en `frontend/e2e/`. Cada helper está copiado localmente.

| Helper | Archivos donde se re-declara | Riesgo de centralizar | Recomendación |
| --- | --- | --- | --- |
| `setPopulatedAdminSession(page)` | app-shell:19, bottom-nav:24, hub-stale:33, config:79, hub-launcher:13, module-layer:28, status:77, ops:86, final-polish:131 (9) | **Bajo** — cuerpo idéntico (setea cookie `admin_session_id` poblada) | Extraer a `frontend/e2e/helpers/admin-session.ts` |
| `suppressNextDevIndicator(page)` | core:84, bottom-nav:34, hub-stale:43, config:161, hub-launcher:23, module-layer:38, status:142, ops:146, final-polish:190 (9) | **Bajo** — oculta el indicador dev de Next | Extraer a helper común |
| `readNoScrollContract(page[, selector])` | core:181, config:185, hub-launcher:58, status:173, ops:193 (5) | **Medio** — firma divergente (con/sin `selector`) | Unificar firma `(page, selector?)` antes de extraer |
| `assertNoScrollContract(contract, label)` | core:232, config:235, status:229, ops:247 (4) | **Bajo** — assert idéntico | Extraer junto a `readNoScrollContract` |
| `expectInsideViewport(...)` | core:248, bottom-nav:40, hub-launcher:29, ops:266, final-polish:316 (5) | **Bajo** | Extraer a helper común |
| `fulfillJson(route, body)` | config:89, status:87, ops:96, final-polish:141 (4) | **Bajo** — wrapper trivial de `route.fulfill` | Extraer a helper común |
| Mocks `page.route` de sessions/tokens/clinics/pricing/status | `admin-tokens-mobile-toolbar-layout` (tokens + users-roles), `config`/`status`/`ops`/`final-polish` (`fulfillJson`) | **Medio** — la fixture `admin-populated-api-server.mjs` ya sirve esos endpoints; los `page.route` locales divergen del contrato central | Migrar mocks locales a la fixture cuando el dato deseado coincida; documentar los casos que requieren override puntual |

**Tipo compartido sin centralizar:** `NoScrollContract` (referenciado en core/config/status/ops/hub-launcher)
también está re-declarado por spec. Debe acompañar al helper extraído.

**Riesgo global de la extracción:** bajo-medio, **siempre que se haga en un solo PR de test** que no
toque producción y se valide corriendo la suite admin-mobile completa antes/después (mismo conteo de casos verdes).

## 6. Obsoletos / legacy / en desuso

> **Nada se borra en este scope.** Solo se listan candidatos con su evidencia de (no) uso.

| Candidato | Evidencia | Veredicto |
| --- | --- | --- |
| `legacy/drizzle-old/` (README + 2 `.sql`) | Referenciado en `.cursorignore:105` (ignorado por tooling). `docs/audit/admin-mobile-final-polish-no-scroll-closeout.md:49`: "No se encontraron referencias relacionadas en `legacy/`". **No** es importado por código productivo. | **Historial de migración** — NO borrar. Candidato a documentar/archivar en PR-F tras auditoría de referencias formal. |
| `admin-mobile-final-polish-no-scroll.spec.ts` | Solapa todas las filas de §4; los closeouts lo corren siempre junto a las dedicadas (cobertura redundante) | Candidato a **fusionar/retirar** en PR-D (no en PR-A). |
| Mocks `page.route` locales que duplican `admin-populated-api-server.mjs` | §5, fila de mocks | Candidatos a migrar a fixture, no a borrar. |
| `desktop smoke 1280×800` repetido en 7 specs | §4 fila desktop | Candidato a centralizar (1 aserción) — no es "obsoleto" pero sí redundante. |
| `docs/audit/admin-mobile-*` (≈14 closeouts mobile) | Inventario docs §2 | Historial válido; NO borrar. Eventual consolidación documental fuera de scope. |

**Scripts/comandos sin uso detectados:** ninguno con prueba de no-uso en este barrido. `frontend/package.json`
expone `e2e`, `e2e:ui`, `e2e:report` — los tres se usan (CI usa `e2e`; `:ui`/`:report` son de uso local
legítimo). No se proponen para retiro.

## 7. Código productivo optimizable (frontend admin mobile)

> Refactors **bajo riesgo**, opt-in, sin tocar backend/API/auth/DB. Cada uno aislable en PR-E.

### 7.1 Constante de page-size duplicada
`MOBILE_PAGE_SIZE = 10` está repetida literal en 5 archivos:
- `AdminClinicsManagementCard.tsx:56`, `AdminReportsCard.tsx:40`, `AdminParticularTokensCard.tsx:77`,
  `AdminMobileAuditModule.tsx:13`, `AdminMobileSessionsModule.tsx:17`.
- Variante: `AdminMobileCommandModule.tsx:38` `FAILED_LOGIN_PAGE_SIZE = 10`.
- Divergente intencional: `AdminMobileUsersModule.tsx:17` (`= 3`), `AdminMobileMaintenanceModule.tsx` (`= 3`),
  `AdminMobilePricingModule.tsx` (`= 4`).

**Oportunidad:** extraer `export const ADMIN_MOBILE_LIST_PAGE_SIZE = 10` a un módulo de constantes
(`frontend/src/app/dashboard/admin/admin-mobile.constants.ts`). **Riesgo bajo**, pero ya existen
tests nativos que fijan el layout del pager (`test/admin-mobile-core-pager-canonical-layout.test.ts`,
`test/admin-mobile-ops-pager-canonical-layout.test.ts`) — alinear en el mismo PR.

### 7.2 Cálculo de paginación idéntico (Sessions / Audit / Users)
Las tres calculan exactamente lo mismo:
```
const page = Math.floor(offset / SIZE) + 1;
const pageCount = Math.max(1, Math.ceil(total / SIZE));
const rangeStart = rows.length ? offset + 1 : 0;
const rangeEnd = offset + rows.length;
const hasNext = rangeEnd < total;
```
Ref: `AdminMobileSessionsModule.tsx:103-109`, `AdminMobileAuditModule.tsx:68-72`,
`AdminMobileUsersModule.tsx:104-106`.

**Oportunidad:** helper puro `computeOffsetPager(offset, total, pageSize)` → `{ page, pageCount, rangeStart, rangeEnd, hasNext, rangeLabel }`.
**Riesgo bajo** (función pura, sin estado). Mejora consistencia del `rangeLabel`.

### 7.3 Shell de sección mobile repetido
Las tres usan el mismo wrapper:
```
className="dashboard-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-vetneb-line/80 bg-card md:hidden"
data-admin-mobile-ops-module="…"
```
**Oportunidad:** componente presentacional `AdminMobileOpsModuleShell` (header opcional + slot lista + `AdminMobileOpsPager`).
**Riesgo medio** — varias specs (`admin-mobile-ops-modules-no-scroll`) seleccionan por
`data-admin-mobile-ops-module` y `data-admin-mobile-ops-item`. **Preservar esos data-attrs exactamente.**

### 7.4 Estado empty/error/loading
Patrón ternario repetido (`error ? … : isPending ? "Cargando…" : "Sin …"`).
**Oportunidad:** helper `<AdminMobileListState status={…} />`. **Riesgo bajo-medio.**

### 7.5 `AdminMobileOpsPager` ya es buen ejemplo
`AdminMobileOpsPager.tsx` ya está bien factorizado y reutilizado (Sessions/Audit/Users). Es el patrón a
imitar: **componentes chicos y explícitos, no una abstracción monolítica** que oculte la lógica de revoke
(Sessions), filtros (Audit) o roles (Users), que son legítimamente distintas.

### 7.6 `globals.css`
27 archivos referencian `data-dashboard-module`/`data-admin-mobile` (incl. `globals.css:39`). Cualquier
limpieza CSS mobile admin debe respetar el orden de bloques reduced-motion antes de los bloques dashboard
(ver memoria `project_legacy_scope_tests_working_tree`). **No tocar en PR-E salvo necesidad probada.**

> ⚠️ **Anti-sobreingeniería (protocolo VETNEB):** extraer SOLO 7.1 (constante) y 7.2 (helper puro) como
> primer paso seguro. 7.3/7.4 quedan para un PR posterior con validación de data-attrs. **No** crear un
> "módulo genérico de lista admin mobile" que absorba revoke/filtros/roles.

## 8. Propuesta de clasificación de E2E

Diseño de capas (scripts a definir en PR-C; hoy solo existe `e2e` = todo).

| Capa | Qué corre | Specs representativas | Cuándo |
| --- | --- | --- | --- |
| `e2e:smoke` | Arranque, auth-redirect, hidratación, tema, 1 desktop smoke admin | `dashboard-auth-redirect`, `login-hydration`, `contacto-hydration`, `theme-mode`, `visual-smoke` | **PR CI por defecto** (rápido) |
| `e2e:admin-mobile` | Contratos no-scroll + pager admin mobile (sin screenshots ni light/dark) | `admin-mobile-app-shell-absolute-no-scroll`, `…-bottom-navigation-…`, `…-hub-launcher-…`, `…-core-modules-…`, `…-ops-modules-…`, `admin-clinics-mobile-card-layout`, `admin-tokens-mobile-toolbar-layout` | PR que toca admin mobile |
| `e2e:visual-contract` | Screenshots + light/dark + stacking/bleed-through | `…-status-modules-…`, `…-config-modules-…`, `…-module-layer-isolation`, `…-hub-stale-layer-stage` | Manual / nightly (caro) |
| `e2e:full` | Todo `./e2e` (estado actual) | las 42 | Nightly / pre-release |

**Racional:** hoy CI paga la capa más cara (`full` + screenshots + 5 viewports × light/dark) en cada PR.
Separar permite que el PR típico corra `smoke` + (si aplica) `admin-mobile`, dejando `visual-contract`/`full`
para nightly. Esto reduce el costo por PR **sin** perder cobertura: las specs siguen existiendo, solo cambia
*cuándo* corren.

## 9. Propuesta de PRs chicos

> Orden y dependencias pensados para máxima reversibilidad. **Ninguno** se implementa en esta rama.

### PR-A — docs: close white-box audit  *(esta rama)*
- **Scope:** crear `docs/audit/admin-mobile-whitebox-e2e-optimization-audit.md` (este archivo).
- **Archivos:** solo el `.md`.
- **Riesgo:** nulo (sin código productivo/tests/CI).
- **Validaciones:** `git status`, `git diff --check`, lectura humana.
- **Rollback:** borrar el `.md`.

### PR-B — test: extract shared Playwright admin mobile helpers
- **Scope:** crear `frontend/e2e/helpers/` con `setPopulatedAdminSession`, `suppressNextDevIndicator`,
  `readNoScrollContract` (firma unificada), `assertNoScrollContract`, `expectInsideViewport`, `fulfillJson`
  y el tipo `NoScrollContract`; importarlos en los specs.
- **Archivos:** nuevo helper + los ≤10 specs admin-mobile (solo imports + borrado de copias).
- **Riesgo:** bajo-medio (firma divergente de `readNoScrollContract` — unificar primero).
- **Validaciones:** `pnpm --dir frontend e2e` sobre specs admin-mobile, **mismo conteo verde** que antes;
  `lint`/`typecheck`.
- **Rollback:** revertir imports (las copias originales quedan en git history).

### PR-C — test: split E2E scripts into smoke/admin-mobile/full
- **Scope:** añadir scripts `e2e:smoke`, `e2e:admin-mobile`, `e2e:visual-contract` en `frontend/package.json`
  (via `--grep`/listas de specs). **CI sin cambios en este PR** (CI se ajusta en PR aparte, fuera de scope actual).
- **Archivos:** `frontend/package.json` (solo `scripts`).
- **Riesgo:** bajo (no toca deps ni lockfile; no toca CI).
- **Validaciones:** correr cada script localmente y verificar el subconjunto esperado.
- **Rollback:** quitar los scripts.

### PR-D — test: reduce duplicated admin mobile specs without losing coverage
- **Scope:** reducir `admin-mobile-final-polish-no-scroll` a un smoke fino (o fusionar sus asserts únicos en las
  dedicadas) y centralizar el `desktop smoke 1280×800`. **Conservar** `layer-isolation` y `hub-stale-layer-stage`.
- **Archivos:** specs admin-mobile afectadas.
- **Riesgo:** **medio-alto** (riesgo de perder un assert único). Requiere mapa assert-por-assert antes de tocar.
- **Validaciones:** diff de cobertura (lista de `data-*` y aserciones cubiertas antes/después debe ser superset).
- **Rollback:** revertir specs.

### PR-E — refactor frontend: small mobile admin shared constants/helpers
- **Scope:** §7.1 (`ADMIN_MOBILE_LIST_PAGE_SIZE`) + §7.2 (`computeOffsetPager`). **Solo eso.**
- **Archivos:** nuevo `admin-mobile.constants.ts`/`.util.ts` + Sessions/Audit/Users (+ alinear los 2 tests de pager).
- **Riesgo:** bajo (constante + función pura). No tocar revoke/filtros/roles ni data-attrs.
- **Validaciones:** `pnpm --dir frontend lint typecheck build`, `pnpm validate:local`, tests de pager verdes.
- **Rollback:** revertir.

### PR-F — docs: archive/deprecate legacy candidates only after reference audit
- **Scope:** documentar estado de `legacy/drizzle-old/` (historial de migración) con prueba formal de no-uso.
  **No borrar** archivos.
- **Archivos:** un `.md` (p.ej. `legacy/drizzle-old/README.md` ampliado o `docs/notes/`).
- **Riesgo:** bajo.
- **Validaciones:** `rg` de referencias a `drizzle-old` en todo el repo (debe seguir sin imports productivos).
- **Rollback:** revertir el `.md`.

## 10. Recomendación final

**Hacer primero (en este orden, PRs separados):**

1. **PR-A** (esta rama): cerrar la auditoría. Sin riesgo.
2. **PR-B**: extraer helpers Playwright compartidos. Es el de mayor relación valor/riesgo: elimina 104
   duplicaciones sin cambiar comportamiento y habilita los demás.
3. **PR-C**: separar scripts E2E en capas (sin tocar CI todavía). Reversible, prepara el ahorro de costo.
4. **PR-E**: micro-refactor productivo (constante + pager puro). Bajo riesgo, alineando los 2 tests de pager.

**Hacer después / con cuidado:**

5. **PR-D**: reducir `final-polish` y centralizar el desktop smoke — **solo con mapa assert-por-assert**.
6. **PR-F**: documentar `legacy/` tras auditoría formal de referencias.

**Qué NO hacer:**

- ❌ No borrar `legacy/drizzle-old/` (historial de migración; en `.cursorignore`).
- ❌ No fusionar ni eliminar `admin-mobile-module-layer-isolation` ni `admin-mobile-hub-stale-layer-stage`:
  defienden el invariante de stacking-context / bleed-through del Hub (cobertura única, ya fue regresión real).
- ❌ No crear un "módulo genérico de lista admin mobile" que absorba revoke/filtros/roles (sobreingeniería;
  oculta comportamiento crítico de seguridad como el bloqueo de auto-revocación de la sesión admin actual).
- ❌ No tocar CI, deps, lockfiles, backend, API, auth, DB ni migrations en ninguno de estos PRs.
- ❌ No mover screenshots a baseline visual sin una capa nightly dedicada (evitar flakiness en PR CI).

**Invariantes de seguridad a preservar en cualquier refactor (skill `security-production-invariants`):**
separación `admin_session_id` / `app_session_id` (la fixture ya la modela), bloqueo de auto-revocación de
sesión admin actual (`AdminMobileSessionsModule.tsx:182-184,213`), no exponer tokens/cookies/hashes en UI ni
fixtures, y no cachear superficies admin/privadas en el service worker.

---

### Anexo — Comandos read-only ejecutados (evidencia)

```
git branch --show-current
git status --short --untracked-files=all
git fetch origin --prune
git log -1 --oneline ; git rev-parse HEAD ; git rev-parse origin/main
git worktree list ; git branch
git switch -c audit/admin-mobile-whitebox-e2e-optimization
rg -n "readNoScrollContract|assertNoScrollContract|expectInsideViewport|setPopulatedAdminSession|suppressNextDevIndicator" frontend/e2e
rg -n "mkdir|page.screenshot|test-results|fullPage" frontend/e2e
rg -n "colorScheme|emulateMedia|setViewportSize|page.route" frontend/e2e
rg -n "MOBILE_PAGE_SIZE|PAGE_SIZE|limit: 10" frontend/src
git ls-files "frontend/e2e/*.spec.ts" ; git ls-files "test/*.test.ts" ; git ls-files "legacy/**" ; git ls-files "docs/**"
```
