# Remove dashboard Home + unified module workspace (clínica)

- **Branch:** `fix/dashboard-remove-home-unified-workspace`
- **Base:** `main` @ `e37f651` — `fix(dashboard): enforce zero-scroll adaptive density (#1286)`
- **Alcance:** solo el dashboard de **clínica** (`/dashboard`). El dashboard admin
  (`/dashboard/admin`) y sus componentes de hub (`DashboardModuleHub`,
  `DashboardHubHero`) **no** se tocan.

---

## 1. Decisión: Home eliminado

El **Home/hub de módulos** de la clínica queda **eliminado**. Antes,
`/dashboard` renderizaba `ClinicDashboardCockpit` (una landing con la sección
"Módulos clínicos", grilla de tiles, KPIs y acciones duplicadas por módulo)
siempre que `activeModule` era `null`. Ese cockpit ya **no existe**.

Se eliminó por completo del código de clínica:

- el componente `ClinicDashboardCockpit`,
- los atributos `data-dashboard-module-hub` / `data-clinic-cockpit*`,
- la sección **"Módulos clínicos"** y la grilla de tiles,
- las acciones duplicadas por módulo ("Abrir …", "Generar o abrir tokens"),
- el retorno del hub cuando `activeModule` era `null`,
- el `DashboardPageHeader` "Resumen operativo" (apariencia de landing),
- el botón "Vista general" del workspace de clínica (llevaba de vuelta al hub).

No queda ninguna pantalla intermedia de módulos ni grilla de cards tipo home.

## 2. Qué reemplaza al Home

`/dashboard` ahora **abre directamente un workspace operativo**:

- El servidor resuelve el módulo por defecto en el render inicial
  (`initialModule = parseClinicModule(...) ?? DEFAULT_CLINIC_MODULE`), con
  `DEFAULT_CLINIC_MODULE = "operaciones"`.
- El controlador cliente nunca deja `activeModule` en `null`: si no hay
  `?module=` válido, resuelve a `operaciones`.
- El shell operativo es: **header ejecutivo** (`DashboardTopbar`) → **rail/pager
  único de módulos** (`DashboardModuleRail`) → **workspace del módulo activo**
  (`DashboardModuleWorkspace` + contenido, con indicadores y acciones propias).

Ninguna acción se ocultó para "pasar screenshots": los estados vacíos/degradados
que aparecen en la evidencia provienen del **mock E2E** (`NEXT_PUBLIC_API_URL`
apuntando al fixture), que devuelve datos de clínica degradados — es el mismo
fixture que usan las suites de clínica preexistentes.

## 3. Cómo se mantiene cada acción / función

| Función previa | Dónde vive ahora |
| --- | --- |
| Ir a Operaciones | Rail (tab "Operaciones") · default de `/dashboard` · `?module=operaciones` |
| Ir a Informes | Rail (tab "Informes") · `?module=informes` · "Abrir módulo completo" → `/dashboard/informes` |
| Ir a Logística | Rail (tab "Logística") · `?module=logistica` · "Abrir módulo completo" → `/dashboard/logistica` |
| Ir a Perfil | Rail (tab "Perfil") · `?module=perfil` |
| Ir a Tokens | Rail (tab "Tokens") · `?module=tokens` |
| Paginar entre módulos | Pager prev/next integrado en el mismo rail (`Módulo N de 5`) |
| "Volver al resumen/home" | **No** vuelve a un home viejo: el reset de hub legado
  (`subscribeClinicHubReset`, ej. "Inicio" en superficies secundarias) resuelve a
  `DEFAULT_CLINIC_MODULE` (operaciones). |
| Reanudar último módulo | `last-module storage` se conserva pero **solo** puede
  resolver a un módulo real (nunca a un home); `router.replace`, sin polución de
  historial. |
| Deep links `?module=…` | Siguen funcionando (SSR + sync de URL en el controlador). |
| Rutas completas `/dashboard/informes`, `/dashboard/logistica/*` | Intactas
  (superficies extendidas), accesibles por "Abrir módulo completo". |

## 4. Componente único de paginación / navegación

**`frontend/src/components/dashboard/DashboardModuleRail.tsx`** es el **único**
control de navegación/paginación de módulos de clínica, **compartido en todos los
dispositivos** (Android/iOS/desktop). Reemplaza a las dos navegaciones
device-específicas que existían:

- desktop: `DashboardHorizontalNav` (tabs superiores) — ahora **suprimido** en el
  `/dashboard` exacto (se conserva para admin y para rutas de clínica
  secundarias);
- mobile: `ClinicMobileBottomNav` (barra inferior) — ahora **suprimido** en el
  `/dashboard` exacto (se conserva en rutas de clínica secundarias).

El rail integra, en una sola gramática y estilo:

- rail horizontal de tabs con el módulo activo marcado (`aria-current="page"`,
  subrayado teal + tinte navy), con auto-scroll del activo a la vista;
- **pager** prev/next que recorre los mismos módulos ordenados, con estado
  `Módulo N de 5`;
- navegación por links reales `?module=` (deep-linkable, Back/Forward seguro) +
  activación optimista vía `requestClinicModuleActivate`.

Se usa de forma idéntica para **operaciones, informes, logística, perfil y
tokens**. No hay paginación duplicada, ni pagers con estilos distintos, ni
controles flotando fuera del surface.

## 5. Screenshots (evidencia "after")

Carpeta: `docs/audit/datos tecnicos dashboard/remove-dashboard-home-unified-workspace/`

| Archivo | Ruta | Viewport |
| --- | --- | --- |
| `dashboard-360x740.png` | `/dashboard` | 360×740 |
| `dashboard-390x844.png` | `/dashboard` | 390×844 |
| `dashboard-1366x768.png` | `/dashboard` | 1366×768 |
| `dashboard-1440x900.png` | `/dashboard` | 1440×900 |
| `informes-390x844.png` | `/dashboard?module=informes` | 390×844 |
| `logistica-390x844.png` | `/dashboard?module=logistica` | 390×844 |
| `perfil-390x844.png` | `/dashboard?module=perfil` | 390×844 |
| `tokens-390x844.png` | `/dashboard?module=tokens` | 390×844 |
| `informes-1366x768.png` | `/dashboard?module=informes` | 1366×768 |
| `logistica-1366x768.png` | `/dashboard?module=logistica` | 1366×768 |

Generadas con `frontend/e2e/remove-home-unified-workspace-screenshots.spec.ts`
(contexto aislado por captura → un `/dashboard` "en frío" siempre resuelve a
operaciones sin interferencia del last-module).

## 6. Validaciones ejecutadas

| Comando | Resultado |
| --- | --- |
| `pnpm --dir frontend typecheck` | ✅ PASS |
| `pnpm --dir frontend lint` | ✅ PASS |
| `pnpm test` | ✅ 2961/2961 PASS |
| `pnpm build` (backend esbuild) | ✅ PASS |
| `pnpm --dir frontend build` (Next prod) | ✅ Compiled successfully |
| `pnpm security:public-surface` | ✅ PASS (sin exposición de devtools) |
| `pnpm --dir frontend e2e:visual-contract` | ✅ 273/273 PASS |

Verificación git final:

- `git diff -- frontend/next-env.d.ts` → **vacío** (limpio).
- `git diff -- package.json frontend/package.json pnpm-lock.yaml package-lock.json`
  → **vacío** (sin cambios en dependencias).
- `git diff --check` → sin errores de whitespace (solo avisos LF→CRLF benignos).

### Tests nuevos / adaptados

- **Nuevos:** `test/frontend-dashboard-remove-home-unified-workspace.test.ts`
  (contrato source-level) y
  `frontend/e2e/remove-dashboard-home-unified-workspace.spec.ts` (E2E de los 6
  escenarios obligatorios: sin home/hub/tile grid; default operaciones; deep
  links; navegación/paginación común idéntica en todos los módulos; sin "Módulos
  clínicos"; sin scroll externo/horizontal en 360/390/1366/1440).
- **Adaptados** (dependían del home viejo, no se borró ninguno):
  `frontend-dashboard-home.test.ts`, `frontend-dashboard-hub-hero.test.ts`,
  `frontend-dashboard-clinic-command-center.test.ts`,
  `frontend-visual-consistency.test.ts` y los E2E del set `visual-contract`
  (`dashboard-card-navigation-shell`, `dashboard-mobile-shell-nav-contract`,
  `dashboard-viewport-zoom-adaptability`, `dashboard-real-app-shell-no-scroll-contract`,
  `dashboard-single-viewport-app-shell`, `dashboard-internal-no-scroll-contract`,
  `dashboard-workspace-layout-polish`).

## 7. Riesgos residuales

1. **Densidad del módulo Operaciones en mobile con datos degradados.** Con el
   mock E2E (stats en error) el tab "Métricas" queda denso en 390px; el contrato
   zero-scroll se cumple (no hay contenedor de scroll operativo), pero el
   contenido es recortado por `overflow:hidden`. Con datos reales el alto es
   menor. Sin regresión respecto al render previo del módulo.
2. **Especificaciones E2E de clínica fuera del gate `e2e:visual-contract`** que
   aún referencian el cockpit/hub o la barra inferior en `/dashboard` (p. ej.
   `dashboard-clinic-*-mobile-parity`, `dashboard-clinic-mobile-nav-stage-parity`,
   `dashboard-clinic-controller-workspace-parity`, `visual-regression-*`,
   `accessibility-axe-key-routes`, `dashboard-interaction-foundation`) requieren
   la **misma migración al rail** que ya se aplicó al set requerido. No están en
   la validación obligatoria; se recomiendan como follow-up inmediato con el
   mismo patrón (rail en lugar de cockpit/bottom-nav).
3. **"Volver al sitio público"** (link de conveniencia que vivía en el nav
   horizontal desktop) ya no aparece en el `/dashboard` principal de clínica; la
   salida operativa sigue disponible vía "Cerrar sesión". Se mantiene en las
   rutas de clínica secundarias.
4. **CSS del cockpit legado** (`.clinic-cockpit-hub`, `.clinic-hub-*`,
   `.dashboard-hub-band`, `.clinic-hub-page-header`) permanece en `globals.css`
   pero quedó **muerto** (ningún elemento de clínica lo usa). No renderiza nada;
   candidato a limpieza posterior.

## 8. Archivos tocados

### Nuevos

- `frontend/src/components/dashboard/DashboardModuleRail.tsx` — rail/pager único.
- `test/frontend-dashboard-remove-home-unified-workspace.test.ts`
- `frontend/e2e/remove-dashboard-home-unified-workspace.spec.ts`
- `frontend/e2e/remove-home-unified-workspace-screenshots.spec.ts`
- `docs/audit/datos tecnicos dashboard/remove-dashboard-home-unified-workspace.md` (este doc)
- `docs/audit/datos tecnicos dashboard/remove-dashboard-home-unified-workspace/*.png` (10 capturas)

### Modificados

- `frontend/src/app/dashboard/page.tsx` — default operaciones; sin pageHeader/hub.
- `frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx` —
  cockpit eliminado; default no-nullable; rail + workspace.
- `frontend/src/components/dashboard/DashboardModuleWorkspace.tsx` — `onBack`
  opcional (clínica sin botón; admin lo conserva).
- `frontend/src/components/dashboard/DashboardHorizontalNav.tsx` — suprimido en
  `/dashboard` exacto (clínica).
- `frontend/src/components/dashboard/ClinicMobileBottomNav.tsx` — suprimido en
  `/dashboard` exacto (clínica).
- `frontend/src/app/globals.css` — estilos `.dashboard-module-rail*`.
- Tests source-level: `test/frontend-dashboard-home.test.ts`,
  `test/frontend-dashboard-hub-hero.test.ts`,
  `test/frontend-dashboard-clinic-command-center.test.ts`,
  `test/unit/ui/frontend/frontend-visual-consistency.test.ts`.
- E2E (set visual-contract): `frontend/e2e/dashboard-card-navigation-shell.spec.ts`,
  `frontend/e2e/dashboard-mobile-shell-nav-contract.spec.ts`,
  `frontend/e2e/dashboard-viewport-zoom-adaptability.spec.ts`,
  `frontend/e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts`,
  `frontend/e2e/dashboard-single-viewport-app-shell.spec.ts`,
  `frontend/e2e/dashboard-internal-no-scroll-contract.spec.ts`,
  `frontend/e2e/dashboard-workspace-layout-polish.spec.ts`.

### No tocados (prohibidos)

`backend/**`, `server/**`, `supabase/**`, migraciones, auth, contratos API,
`.github/**`, `package.json`, `frontend/package.json`, `pnpm-lock.yaml`,
`package-lock.json`, `frontend/next-env.d.ts`.
