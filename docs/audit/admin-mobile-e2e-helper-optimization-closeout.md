# Admin Mobile E2E Helper Optimization — Closeout

> Documento de cierre **docs-only**. **No modifica código productivo, frontend/src, specs,
> helpers, backend, API, auth, DB, migrations, deps, lockfiles, screenshots, Playwright config
> ni CI.** Solo consolida el resultado del bloque y deja trazado el siguiente paso seguro.

## 1. Resumen ejecutivo

El bloque **Admin Mobile E2E Helper Optimization** (#1089 → #1093) cerró una optimización
**test-only / documental** de la suite E2E de Admin Mobile. El objetivo fue eliminar la
duplicación de primitivos de Playwright re-declarados en hasta 10 specs, **centralizándolos en
un único helper compartido** (`frontend/e2e/helpers/admin-mobile-contracts.ts`), y migrar las
familias `core`/`ops` y `status`/`config` a ese helper.

El bloque se ejecutó bajo el principio **"consolidar y reclasificar, no borrar a ciegas"**:

- **No se redujo cobertura**: ningún spec fue eliminado, ningún viewport recortado, ningún
  loop de módulos acortado.
- **No se modificó código productivo** (`frontend/src` intacto).
- **No se tocó** backend, API, auth, DB, migrations, deps, lockfiles ni CI.
- **No se movieron screenshots** a baseline visual.
- `final-polish` fue **auditado antes de tocarlo** (#1092) y migró **solo primitivos idénticos**
  (#1093), preservando su cobertura única (recorrido integral en una sola sesión, barrido de
  content-band y clipping por ancestros).

Resultado neto: misma cobertura E2E, menos duplicación, base lista para una futura
reclasificación de capas E2E/CI que **no** forma parte de este bloque.

## 2. Base de cierre

| Campo | Valor |
| --- | --- |
| Branch de trabajo | `docs/admin-mobile-e2e-helper-optimization-closeout` |
| Branch base | `main` |
| HEAD (`git log -1 --oneline`) | `7bb0ac3 test(admin): share final polish e2e primitives (#1093)` |
| `origin/main` / `origin/HEAD` | `7bb0ac3` (idéntico al HEAD local) |
| `git status --short --untracked-files=all` | limpio antes de crear este archivo |
| Worktrees | 1 (`C:/PORTAL-VETNEB`) |
| Fecha | 2026-06-23 |
| Plataforma | Windows / PowerShell / PNPM |

Open PRs relevantes: **ninguno del bloque queda abierto**. Los PRs técnicos (#1089–#1093) ya
están mergeados a `main`. Las únicas PRs abiertas son **Dependabot** (bumps de deps en
`/frontend` y raíz: #1018–#1038), ajenas a este bloque.

## 3. PRs cerrados

| PR | Título | Tipo | Scope | Resultado | Validación / CI |
| --- | --- | --- | --- | --- | --- |
| [#1089](#) | docs(admin): audit mobile e2e optimization opportunities | docs (auditoría white-box) | `docs/audit/admin-mobile-whitebox-e2e-optimization-audit.md` | Auditoría read-only que confirma exceso/duplicación de E2E y propone PRs chicos reversibles; **cero** cambios productivos | docs-only; lectura humana + `git diff --check`. CI verde |
| [#1090](#) | test(admin): share mobile e2e contract helpers | test-only | nuevo `frontend/e2e/helpers/admin-mobile-contracts.ts` + migración `core`/`ops` | Helper compartido creado (no-scroll contract, sesión poblada, `fulfillJson`, supresión dev indicator); `core`/`ops` migrados sin cambiar comportamiento | `lint`/`typecheck` + suite admin-mobile, **mismo conteo verde**. CI verde |
| [#1091](#) | test(admin): share mobile status config e2e helpers | test-only | migración `status`/`config` al helper compartido | `status`/`config` migrados; se amplía el helper con `applyColorMode` y `assertGutterContract` (light/dark + gutters) sin reducir cobertura | `lint`/`typecheck` + suite admin-mobile (status/config focalizados), **mismo conteo verde**. CI verde |
| [#1092](#) | docs(admin): audit final polish e2e overlap | docs (auditoría white-box) | `docs/audit/admin-mobile-final-polish-e2e-overlap-audit.md` | Auditoría read-only de `final-polish`: identifica cobertura única (recorrido integral, content-band, clipping) y recomienda migrar **solo primitivos idénticos** | docs-only; lectura humana + `git diff --check`. CI verde |
| [#1093](#) | test(admin): share final polish e2e primitives | test-only | migración acotada de `final-polish` (1 archivo) | `final-polish` importa del helper **solo** los primitivos idénticos; conserva sus helpers específicos locales y sus 4 tests + screenshots | `lint`/`typecheck` + `playwright test admin-mobile-final-polish-no-scroll` (4 tests, mismo set de screenshots). CI verde |

> Los enlaces `#` son marcadores; la numeración de PR (#1089–#1093) corresponde a los commits
> ya mergeados en `main` (`git log --oneline --decorate -n 12`).

## 4. Resultado técnico

**Helper compartido creado y ampliado** — `frontend/e2e/helpers/admin-mobile-contracts.ts`
centraliza los primitivos antes duplicados. Exports verificados (`rg`):

- `ADMIN_MOBILE_TOLERANCE` (tolerancia de layout, antes `TOLERANCE` local en cada spec).
- `setPopulatedAdminSession(page)` — cookie de sesión admin poblada.
- `suppressNextDevIndicator(page)` — oculta el indicador dev de Next.
- `fulfillJson(route, body)` — wrapper de `route.fulfill` para mocks.
- `readModuleNoScrollContract(page, selector)` / `assertModuleNoScrollContract(...)` — contrato
  no-scroll de módulo (firma unificada).
- `applyColorMode(page, "light" | "dark")` — eje de tema (añadido para status/config).
- `assertGutterContract(...)` — invariante de gutters (añadido para status/config).

**Specs migradas a helpers compartidos:**

- **Core** (`admin-mobile-core-modules-no-scroll.spec.ts`): consume `fulfillJson`,
  `suppressNextDevIndicator` (+ primitivos de viewport/contrato) del helper.
- **Ops** (`admin-mobile-ops-modules-no-scroll.spec.ts`): consume el set no-scroll completo
  (`assertModuleNoScrollContract`, `readModuleNoScrollContract`, `setPopulatedAdminSession`,
  `suppressNextDevIndicator`, `fulfillJson`).
- **Status** (`admin-mobile-status-modules-no-scroll.spec.ts`) y **Config**
  (`admin-mobile-config-modules-no-scroll.spec.ts`): consumen el set completo, incluyendo
  `applyColorMode` y `assertGutterContract` (matriz light/dark + gutters), con alias locales
  para no alterar el resto del spec.

**Final-polish tratado con cautela** — `admin-mobile-final-polish-no-scroll.spec.ts` fue
**auditado primero** (#1092) y luego migrado de forma **acotada** (#1093): importa del helper
**solo** los primitivos idénticos (`ADMIN_MOBILE_TOLERANCE`, `fulfillJson`,
`setPopulatedAdminSession`, `suppressNextDevIndicator`). Sus helpers específicos
(`readSurfaceContract`, `expectInsideMobileContentBand`, `expectNotClippedByAncestors`,
`auditMobileSurface`, `auditModuleItems`) **permanecen locales** para evitar blast radius sobre
los 4 specs que ya consumen el helper compartido.

**Specs no reducidas / screenshots preservadas / cobertura preservada** — ningún spec fue
borrado, ningún viewport recortado, ningún loop de módulos acortado, y el set de screenshots de
`final-polish` (~40 PNG por corrida) se mantiene intacto. La migración es puramente de imports:
mismo comportamiento, mismas aserciones, mismo conteo verde antes/después.

## 5. Cobertura preservada

Indicación explícita del estado de cobertura tras el bloque:

- **Core / ops**: **sin reducción**. La migración solo reemplazó copias locales por imports del
  helper; mismas aserciones no-scroll y mismos data-attrs (`data-admin-mobile-ops-module`,
  `data-admin-mobile-ops-item`) seleccionados.
- **Status / config**: **45 casos focalizados preservados** (matriz viewports × light/dark ×
  módulos + gutters). Ninguno fue eliminado al centralizar `applyColorMode`/`assertGutterContract`.
- **Final-polish**: **4 tests preservados** (3 mobile por viewport 360/390/430 en light + 1
  desktop smoke 1280×800), incluyendo el recorrido integral en una sola sesión, el barrido
  uniforme de content-band y el clipping por ancestros (cobertura única documentada en #1092).
- **No se eliminó ningún spec** del directorio `frontend/e2e/` durante el bloque.
- **No se renombraron tests** en los PRs de helperización (#1090, #1091, #1093): los títulos de
  `test(...)` se mantuvieron, garantizando trazabilidad y diffs de cobertura limpios.

## 6. Riesgos controlados

- **Flake de CI**: cuando apareció una intermitencia en CI (suite admin-mobile larga, con
  clicks/transiciones encadenados y mocks), se trató **reproduciendo localmente primero** y luego
  con **rerun**, sin enmascarar fallos reales ni relajar aserciones.
- **`next-env.d.ts` fuera de scope**: `next dev` reescribe `next-env.d.ts`; cuando apareció como
  ruido en el árbol de trabajo, se **regeneró/restauró** para mantener el diff acotado al scope
  del PR (ver guardrails de árbol limpio del proyecto).
- **Final-polish no fue reducido**: por tener **cobertura única** (recorrido integral, content-band,
  clipping por ancestros), se decidió migrar solo primitivos idénticos y **no** mover sus helpers
  específicos al módulo compartido (blast radius sobre 4 specs).
- **CI / scripts intactos**: **no** se tocó `.github/workflows/frontend-ci.yml` ni los scripts E2E
  de `frontend/package.json` todavía. La separación en capas queda explícitamente para otro bloque.

## 7. Estado del repositorio

- **`main` limpio**: HEAD = `7bb0ac3` (#1093) = `origin/main`; `git status` sin cambios.
- **Worktree único**: `C:/PORTAL-VETNEB` (sin worktrees adicionales).
- **Ramas Admin Mobile residuales eliminadas previamente**: las ramas técnicas del bloque
  (`audit/admin-mobile-whitebox-e2e-optimization`, `docs/admin-mobile-final-polish-e2e-overlap-audit`
  y las de helperización) ya fueron integradas a `main` y limpiadas; solo queda activa la rama de
  este closeout (`docs/admin-mobile-e2e-helper-optimization-closeout`).
- **Open PRs**: **solo Dependabot** (#1018–#1038). Ninguna PR del bloque queda abierta.

## 8. Qué NO se hizo

- **No** se redujo la suite E2E (ningún spec eliminado, ningún viewport/loop recortado).
- **No** se separaron los scripts E2E (`e2e:smoke` / `e2e:admin-mobile` / `e2e:visual-contract`
  / `e2e:full` siguen sin existir; hoy solo está `e2e` = todo).
- **No** se tocó CI (`.github/workflows/frontend-ci.yml` sin cambios).
- **No** se tocó código productivo (`frontend/src` intacto; sin micro-refactors de
  `MOBILE_PAGE_SIZE` ni `computeOffsetPager`).
- **No** se borró legacy (`legacy/drizzle-old/` sin tocar; historial de migración preservado).
- **No** se tocaron deps ni lockfiles (`package.json` / `pnpm-lock.yaml` sin cambios).

## 9. Próximo bloque recomendado

El siguiente paso seguro es **otro bloque**, no una continuación de este closeout:

- **PR-C — `docs/test: audit e2e ci layering strategy`** (documental primero): auditar la
  estrategia de capas E2E/CI **antes** de cambiar scripts o CI. Sin tocar scripts ni workflows en
  el PR de auditoría.

Capas futuras propuestas (a definir/validar en ese bloque, no aquí):

| Capa | Qué corre | Cuándo |
| --- | --- | --- |
| `e2e:smoke` | Arranque, auth-redirect, hidratación, tema, 1 desktop smoke admin | PR CI por defecto (rápido) |
| `e2e:admin-mobile` | Contratos no-scroll + pager admin mobile (sin screenshots ni light/dark) | PR que toca admin mobile |
| `e2e:visual-contract` | Screenshots + light/dark + stacking/bleed-through | Manual / nightly (caro) |
| `e2e:full` | Todo `./e2e` (estado actual) | Nightly / pre-release |

> **Aclaración:** esa reclasificación de capas E2E/CI es un **bloque aparte**. **No** debe
> mezclarse con este closeout ni implementarse en esta rama.

## 10. Recomendación final

**Dictamen:**

- El bloque **Admin Mobile E2E Helper Optimization** queda **cerrado**.
- **No tocar más helpers ni `final-polish` ahora**: la consolidación de primitivos está completa y
  `final-polish` ya migró solo lo idéntico, preservando su cobertura única.
- **Siguiente paso seguro**: una **auditoría documental** de la estrategia de capas E2E/CI
  (PR-C), antes de modificar scripts o CI.

**Qué NO hacer (recordatorio):** no borrar specs, no recortar viewports/loops, no mover los
helpers específicos de `final-polish` al módulo compartido, no separar scripts E2E ni tocar CI en
este bloque, no tocar productivo/backend/API/auth/DB/deps/lockfiles.

---

### Anexo — Comandos read-only ejecutados (evidencia)

```
git branch --show-current
git status --short --untracked-files=all
git log -1 --oneline
git log --oneline --decorate -n 12
git ls-files "docs/audit/admin-mobile-*"
git ls-files "frontend/e2e/helpers/admin-mobile-contracts.ts"
git ls-files "frontend/e2e/admin-mobile-*.spec.ts" "frontend/e2e/admin-tokens-mobile-toolbar-layout.spec.ts"
rg -n "ADMIN_MOBILE_TOLERANCE|setPopulatedAdminSession|fulfillJson|suppressNextDevIndicator|readModuleNoScrollContract|assertModuleNoScrollContract|applyColorMode|assertGutterContract" \
   frontend/e2e/helpers/admin-mobile-contracts.ts frontend/e2e/admin-mobile-*.spec.ts \
   frontend/e2e/admin-tokens-mobile-toolbar-layout.spec.ts
gh pr list --state open
```
