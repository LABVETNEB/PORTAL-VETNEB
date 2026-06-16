# feat(dashboard): introduce premium workspace visual shell

Rama: `feat/dashboard-premium-visual-shell` · Base: `main` @ `e262643`
Normas: ISO/IEC 25010 (usabilidad/mantenibilidad), ISO/IEC 25000 SQuaRE, ISO 9001, ISO/IEC 5055, ISO/IEC 15504 SPICE, ISO 27001, ISO/IEC 14598.

> **Addendum (PR #1007 — fix CI E2E).** El run Frontend CI falló en `e2e/dashboard-card-navigation-shell.spec.ts` (2 tests de accesibilidad de cards). Causa raíz: el spec selecciona las cards del hub con `hub.locator("button")` dentro de `[data-dashboard-module-hub="true"]` y exige `aria-label` en **todo** `<button>`; el hero quedaba **dentro** de esa sección y su CTA (botón con texto, sin `aria-label`) contaminaba la colección de cards. Fix quirúrgico: en `DashboardModuleHub` el hero se renderiza ahora en un slot `data-dashboard-hub-hero-slot="true"` **fuera** (antes) de la sección de cards. Sin cambios visuales, sin perder el hero, cero dependencias. Validado: el spec pasa 65/65 (incluidos los 2 tests antes en rojo). Detalle en §“Addendum — fix CI E2E”.

## Resumen

El primer viewport de `/dashboard` y `/dashboard/admin` (landing del hub, sin `?module=`) era una grilla plana de tarjetas sin datos vivos: el contenido operativo (KPIs, estado del sistema) vivía una capa adentro, dentro de los módulos. Los PRs #1004/#1005 sumaron funcionalidad **dentro** de módulos, por eso el landing seguía igual.

Este PR introduce una **shell visual premium en el landing del hub**: una banda **hero operativo** ancha, con gradiente institucional navy→teal, datos vivos ya disponibles, status chip y CTA principal — renderizada **antes** de navegar a ningún módulo. El cambio es evidente al entrar, en la primera pantalla, en ambos roles.

## Alcance

- Sólo frontend dashboard clínica (`/dashboard`) y admin (`/dashboard/admin`).
- Cambio **aditivo**: no se elimina ninguna estructura existente.
- Sin backend, DB, migrations, auth, contratos API ni producción.
- Conserva navegación, sidebar, `PasswordChangePanel`, persistencia de último módulo, dark-gray theme mode y separación admin/clínica.

## Archivos tocados

Nuevos:
- `frontend/src/components/dashboard/DashboardHubHero.tsx` — hero presentacional reutilizable (`variant: "clinic" | "admin"`, eyebrow, título, descripción, status chip, métricas[], CTA). Sin fetch, sin imports de api/headers/public/middleware, theme-independiente (texto blanco sobre gradiente de marca).
- `test/frontend-dashboard-hub-hero.test.ts` — contrato del hero y su wiring.
- `docs/audits/DASHBOARD_PREMIUM_VISUAL_REDESIGN_PLAN.md` — auditoría Fase 1.

Modificados:
- `frontend/src/components/dashboard/DashboardModuleHub.tsx` — nuevo prop opcional `hero?: ReactNode`, renderizado arriba del heading + grilla; se conservan `data-dashboard-module-hub`, `data-dashboard-module-card`, `dashboard-card-interactive` y focus rings.
- `frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx` — construye `clinicHero` con `pendingReports`/`activeVisits` (datos que ya recibía) y CTA → módulo `operaciones`.
- `frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx` — construye `adminHero` con estado del sistema + `auditEntriesCount`/`eventTypesCount`; CTA → módulo `admin`.
- `frontend/src/app/dashboard/admin/page.tsx` — pasa `auditEntriesCount={auditEntries.length}` y `eventTypesCount={Object.keys(eventCounts).length}` (2 líneas aditivas).

`git diff --stat`: 4 archivos modificados, 74 inserciones, 1 eliminación.

## Decisión de dependencias

**No se agregaron dependencias.** El hero se construye con Tailwind (ya presente) + clases de componente existentes + íconos `lucide-react` (ya instalado). `package.json` y `pnpm-lock.yaml` sin cambios (verificado por test y por `git status`). Alternativa evitada: librerías de UI/animación/charts/themes — innecesarias para una banda hero, sumarían peso y riesgo. Impacto en bundle: nulo (sólo un componente React nuevo).

## Cambios visuales concretos

Primer viewport del hub (antes: header genérico + grilla plana de tarjetas):

- **Clínica — workspace operativo de laboratorio**: banda hero con eyebrow “Workspace operativo · Clínica”, título “Centro de operaciones clínica”, status chip (“Operación al día” / “Atención requerida”), tiles vivos **Informes pendientes** y **Visitas activas**, y CTA “Abrir centro de operaciones”.
- **Admin — centro de control**: banda hero con eyebrow “Centro de control · Administración”, estado del sistema prominente (status chip con tono ok/warn/down), tiles vivos **Eventos de auditoría** y **Tipos de evento**, y CTA “Abrir administración”.
- Jerarquía visual: hero (nivel 1, gradiente + sombra + glow) → métricas → grilla de módulos (conservada).
- Mejor uso del espacio horizontal: en `lg+` el bloque de copy queda a la izquierda y los tiles de KPI a la derecha (reduce sensación de página plana y de scroll).
- Responsive: hero apila en columna `< lg`; tiles en grilla 2-col en móvil; CTA táctil (`min-h`).
- Accesibilidad: `<section>` con `data-dashboard-hub-hero`, `aria-labelledby`/`id` de heading, botón con foco visible (`focus-visible:ring-2`), decorativos con `aria-hidden`.

## Tests ejecutados (Terminal 1)

| Comando | Resultado |
|---|---|
| `pnpm --dir frontend typecheck` | ✅ PASS (tsc --noEmit) |
| `pnpm --dir frontend lint` | ✅ PASS (eslint) |
| `pnpm test` | ✅ 2758 pass / 0 fail (incluye el nuevo `frontend-dashboard-hub-hero.test.ts` y todos los contratos de dashboard/admin/last-module/visual-consistency) |
| `pnpm --dir frontend build` | ✅ PASS (next build; `/dashboard` y `/dashboard/admin` dinámicas) |
| `pnpm build` | ✅ PASS (backend esbuild, no afectado) |
| `pnpm security:public-surface` | ✅ PASS (sin hallazgos de exposición pública) |
| `git diff --check` | ✅ sin errores de whitespace |

> `pnpm --dir frontend test:e2e` **no existe**; el script real es `pnpm --dir frontend e2e` (Playwright, requiere navegadores/servidor). Los E2E de dashboard existentes no se modificaron. No se ejecutó E2E en este entorno.

## Riesgos remanentes y mitigaciones

| Riesgo | Estado |
|---|---|
| Romper responsive | Mitigado: `flex-col` → `lg:flex-row`, tiles en grilla; build OK. |
| Ocultar acciones existentes | No: cambio aditivo, grilla de módulos intacta. |
| Duplicar contenido | No: el hero usa datos del landing (no presentes antes); los command centers siguen en sus módulos. |
| Aumentar scroll | Mitigado: hero usa ancho horizontal, altura acotada. |
| Tocar seguridad por accidente | No: sin auth/middleware/api/cookies; test anti-sensibles del hero. |
| Dependencia innecesaria | No: cero dependencias nuevas. |
| Romper contratos string-exact | No: 2758/2758 verde. |
| Guardrails `PR-N scope` por diff | Sin impacto: archivos tocados no están en blocklist (verificado en §2.6 de la auditoría). |

## Rollback plan

Cambio puramente frontend y aditivo. Rollback lógico:
- Revertir los 4 archivos modificados y eliminar los 3 nuevos (`DashboardHubHero.tsx`, `test/frontend-dashboard-hub-hero.test.ts`, auditoría). El hub vuelve a su grilla previa sin más efectos (el prop `hero` es opcional).
- No hay migraciones, datos ni contratos que revertir.

## Criterios de aceptación cumplidos

- [x] Antes/después evidente en la **primera pantalla** de ambos dashboards.
- [x] Cambio visible **sin** navegar a módulos profundos.
- [x] No depende de texto nuevo masivo (copy mínimo, foco en diseño/datos).
- [x] No rompe acciones existentes (tarjetas, navegación, last-module): tests verde.
- [x] No expone secretos/tokens/hashes/cookies: test anti-sensibles + `security:public-surface` PASS.
- [x] No cambia contratos API ni rutas; sin `fetch` en componentes.
- [x] Mantiene separación admin/clínica (heroes con `variant` distinto, sin import cruzado).
- [x] `PasswordChangePanel` intacto (no se tocó su slot).
- [x] Conserva dark-gray theme mode y sidebar.
- [x] build/typecheck/lint pasan; cero dependencias nuevas.

## Recomendaciones para commit/PR (Git manual lo hace Nico)

Rama ya creada: `feat/dashboard-premium-visual-shell`. Sugerido:

```powershell
git add frontend/src/components/dashboard/DashboardHubHero.tsx `
        frontend/src/components/dashboard/DashboardModuleHub.tsx `
        frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx `
        frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx `
        frontend/src/app/dashboard/admin/page.tsx `
        test/frontend-dashboard-hub-hero.test.ts `
        docs/audits/DASHBOARD_PREMIUM_VISUAL_REDESIGN_PLAN.md `
        IMPLEMENTATION_NOTES/feat-dashboard-premium-visual-shell.md
git commit -m "feat(dashboard): introduce premium workspace visual shell"
git push -u origin feat/dashboard-premium-visual-shell
gh pr create --fill
gh pr checks --watch
```

---

## Addendum — fix CI E2E (PR #1007)

### Diagnóstico
- **Síntoma**: Frontend CI/validate-frontend rojo en `e2e/dashboard-card-navigation-shell.spec.ts` (2 failed / 248 passed):
  - `clinic dashboard — module hub initial state › clinic hub cards have accessible names with descriptions` → `card 0 should have aria-label` (Received: null).
  - `admin dashboard — module hub initial state › admin hub cards have accessible names` → `admin card 0 should have aria-label` (Received: null).
- **Causa raíz**: ambos tests recogen las cards con `const cards = hub.locator("button")` dentro de `[data-dashboard-module-hub="true"]` y validan que **cada** `<button>` tenga `aria-label`. El `DashboardHubHero` se renderizaba **dentro** de esa sección y su CTA es un `<button>` con texto visible pero sin `aria-label`, por lo que entraba en la colección de cards y rompía el aserto. No es un defecto de accesibilidad real (el botón tiene nombre accesible por su texto); es contaminación del selector de cards.

### Cambio aplicado (mínimo)
- `frontend/src/components/dashboard/DashboardModuleHub.tsx`: el hero pasa a un slot envolvente `data-dashboard-hub-hero-slot="true"` ubicado **fuera** (antes) de la `<section data-dashboard-module-hub="true">`. Se conservan todos los contratos de cards (`data-dashboard-module-card`, `dashboard-card-interactive`, focus rings) y el `aria-label` de la sección.
- `test/frontend-dashboard-hub-hero.test.ts`: el contrato del slot ahora exige `data-dashboard-hub-hero-slot="true"` y que el hero se renderice **antes** de la sección de cards (guardia de regresión que reproduce el invariante del E2E a nivel unitario).

### Archivos modificados (relativo al commit del PR)
- `frontend/src/components/dashboard/DashboardModuleHub.tsx`
- `test/frontend-dashboard-hub-hero.test.ts`
- `IMPLEMENTATION_NOTES/feat-dashboard-premium-visual-shell.md` (esta nota)

### Validaciones ejecutadas (Terminal 1)
| Comando | Resultado |
|---|---|
| `pnpm --dir frontend e2e -- e2e/dashboard-card-navigation-shell.spec.ts` | ✅ **65 passed** (incluye los 2 tests antes en rojo) |
| `pnpm --dir frontend typecheck` | ✅ PASS |
| `pnpm --dir frontend lint` | ✅ PASS |
| `pnpm --dir frontend build` | ✅ PASS |
| `pnpm test` (contratos) | ✅ **2758 pass / 0 fail** (incluye hub-hero, shell, interaction-foundation, last-module, visual-consistency, password-change-ui) |
| `git diff --check` | ✅ sin errores |

> Nota: el webServer de Playwright corre `next dev`, que reescribe `frontend/next-env.d.ts` al path dev. Se restauró con `git checkout -- frontend/next-env.d.ts` y `next build` lo deja en el path de producción. Working tree final: sólo los 3 archivos del fix.

### Dependencias
Cero dependencias nuevas (`package.json` / `pnpm-lock.yaml` sin cambios).

### Comandos para Nico (Git manual)
```powershell
git add -A
git commit -m "fix(dashboard): keep hero outside hub card selectors"
git push
gh pr checks --watch
```
