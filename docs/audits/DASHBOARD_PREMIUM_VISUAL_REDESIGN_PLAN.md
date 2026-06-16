# Dashboard Premium Visual Redesign — Plan de auditoría e implementación

Rama: `feat/dashboard-premium-visual-shell`
Base: `main` @ `e262643`
Alcance: Frontend dashboard clínica (`/dashboard`) y admin (`/dashboard/admin`).
Normas de referencia: ISO/IEC 25010 (usabilidad, mantenibilidad), ISO/IEC 25000 SQuaRE, ISO 9001, ISO/IEC 5055, ISO/IEC 15504 SPICE, ISO 27001, ISO/IEC 14598.

---

## 1. Diagnóstico honesto

### 1.1 Por qué el dashboard se ve igual

El primer viewport real al entrar a `/dashboard` y `/dashboard/admin` (sin `?module=`) está compuesto por:

1. `DashboardTopbar` (header sticky) — ya tiene polish.
2. `main.dashboard-main` →
   - `DashboardPageHeader` — título + descripción genérica (“Seleccione un módulo para acceder a sus funciones.”).
   - `*DashboardWorkspaceController` que, **sin módulo activo, renderiza `DashboardModuleHub`**: una grilla plana de tarjetas genéricas (icono + título + descripción + “acción →”).

El contenido operativo real (KPIs, informes recientes, estado del sistema) **no está en el landing**: vive una capa adentro, dentro de los módulos:

- Clínica: `ClinicCommandCenter` (KPIs, informes/visitas) está dentro del módulo `operaciones`.
- Admin: `AdminCommandCenter` (eventos, tipos de evento, estado) está dentro del módulo `admin`.

Resultado: la **primera pantalla es una grilla de tarjetas sin datos vivos**, idéntica conceptualmente desde hace varios PRs. Es “plana que sube y baja” porque no hay banda de resumen con jerarquía ni señal operativa inmediata.

### 1.2 Qué componentes/layouts limitan el salto visual

| Superficie | Limitación |
|---|---|
| `DashboardModuleHub` | Grilla uniforme 1/2/3 columnas, todas las tarjetas con el mismo peso visual. Sin hero, sin métricas, sin jerarquía. |
| `*WorkspaceController` | Ya reciben datos vivos (`pendingReports`, `activeVisits`, `systemStatus`) pero los usan **solo como badges minúsculos** en tarjetas. |
| `DashboardPageHeader` | Repite el título del topbar y aporta una descripción genérica; consume altura sin densidad útil. |
| Datos vivos | Existen en `page.tsx` (stats, auditoría, health) pero no se exponen en el landing. |

### 1.3 Qué cambios anteriores no generaron impacto visible

- **#1004** agregó `PasswordChangePanel` dentro de `perfil` / `admin-sessions` (módulos profundos) → invisible en el landing.
- **#1005** subió ese panel dentro de los workspaces existentes → sigue siendo invisible hasta navegar a un módulo.
- **#1006** sólo reorganizó documentación.

Ninguno tocó el **primer viewport** del hub.

### 1.4 Qué debe cambiar para que el primer viewport sea claramente distinto

Introducir una **shell visual premium en el landing del hub** (no dentro de módulos):

- Un **hero operativo** ancho con datos vivos ya disponibles (clínica: informes pendientes + visitas activas; admin: estado del sistema + volumen de auditoría + tipos de evento), CTA principal y jerarquía visual fuerte.
- Reutilizar la grilla de módulos existente debajo del hero, sin perder ninguna tarjeta.

Esto cambia el landing **antes de navegar a ningún módulo**, que es exactamente lo que faltaba.

---

## 2. Mapa de superficies reales

### 2.1 Dashboard clínica (`/dashboard`)
- `frontend/src/app/dashboard/page.tsx` (server; carga stats/reports/visitas; arma slots).
- `frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx` (client; hub ↔ workspace, last-module).
- `frontend/src/app/dashboard/ClinicCommandCenter.tsx` (presentacional módulo `operaciones`).

### 2.2 Dashboard admin (`/dashboard/admin`)
- `frontend/src/app/dashboard/admin/page.tsx` (server; auditoría + health; arma slots).
- `frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx` (client; hub ↔ workspace, last-module).
- `frontend/src/app/dashboard/admin/AdminCommandCenter.tsx` (presentacional módulo `admin`).

### 2.3 Componentes compartidos
- `frontend/src/components/dashboard/DashboardModuleHub.tsx` (grilla de tarjetas del landing). **Superficie clave del cambio.**
- `frontend/src/components/dashboard/DashboardModuleWorkspace.tsx` (wrapper de módulo con “Volver”).
- `frontend/src/components/dashboard/DashboardTopbar.tsx`, `DashboardPageHeader.tsx`.
- `frontend/src/components/dashboard/DashboardSidebarFrame.tsx` + `Clinic/AdminDashboardSidebar.tsx`.
- `frontend/src/app/globals.css` (tokens `dashboard-*`, `surface-*`, `dashboard-kpi-pill`, `dashboard-card-interactive`).

### 2.4 Tests existentes relevantes (contratos string-exact)
- `test/frontend-dashboard-home.test.ts`, `test/frontend-dashboard-clinic-command-center.test.ts`
- `test/frontend-dashboard-admin.test.ts`, `test/frontend-dashboard-admin-command-center.test.ts`
- `test/frontend-dashboard-shell.test.ts`, `test/frontend-dashboard-private-shell-foundation.test.ts`
- `test/frontend-dashboard-interaction-foundation.test.ts` (contratos de `DashboardModuleHub`)
- `test/frontend-dashboard-last-module.test.ts` (lógica de controllers)
- `test/frontend-visual-consistency.test.ts` (clases/grids existentes)
- `test/frontend-dashboard-accessibility-focus-aria.test.ts`, `test/frontend-dashboard-workspace-layout-polish.test.ts`

### 2.5 Tests faltantes (a agregar)
- Contrato del nuevo hero del hub: presencia, datos vivos, CTA, separación clínica/admin, sin fetch, sin secretos. → `test/frontend-dashboard-hub-hero.test.ts`.

### 2.6 Restricciones de los guardrails de scope (verificado en repo)
Los tests `PR-N ... stays within allowed file scope` ejecutan `git diff --name-only` y bloquean (prefijos) `server/`, `drizzle/`, `shared/`, `frontend/src/app/api/`, `frontend/src/middleware`; (exactos) `package.json`, `pnpm-lock.yaml`, `frontend/package.json`, `frontend/pnpm-lock.yaml`, `frontend/next-env.d.ts`, `frontend/tsconfig.json`, `frontend/src/app/layout.tsx`, `frontend/src/lib/auth.ts`, `frontend/src/lib/seo.ts`, `frontend/src/middleware.ts`.

**`frontend/src/app/globals.css` NO está bloqueado** (sólo se lee para asserts). Los archivos objetivo de este PR (hub, controllers, nuevos componentes, `page.tsx`) **no** están bloqueados. Estos guardrails se evalúan sobre el working tree: pueden “fallar” localmente con árbol sucio y pasan en CI (diff vacío post-commit) — comportamiento documentado del repo.

---

## 3. Propuesta visual premium

Estrategia: **aditiva**. No se elimina ninguna estructura contractual existente; se inyecta una banda hero en el landing del hub y se enriquece la jerarquía. La decisión de no tocar `globals.css` es deliberada (ver §8): el hero se construye con utilidades Tailwind + clases de componente ya existentes.

### 3.1 Dashboard clínica — workspace operativo de laboratorio
- **Layout**: hero ancho full-width arriba del hub; debajo, la grilla de módulos existente.
- **Header**: se conserva `DashboardTopbar` + `DashboardPageHeader`. El hero añade jerarquía sin duplicar copy.
- **Hero**: gradiente institucional navy→teal (marca, theme-aware), eyebrow “Workspace operativo · Clínica”, título, subtítulo, **tiles de KPI vivos** (Informes pendientes / Visitas activas) y **CTA primaria** “Abrir centro de operaciones” → módulo `operaciones`.
- **Grid de cards**: se conserva (`operaciones`, `informes`, `logística`, `perfil`, `tokens`) con sus badges.
- **Jerarquía visual**: hero (nivel 1) → métricas (nivel 2) → módulos (nivel 3).
- **Estados**: si stats no cargó, KPIs muestran 0 (consistente con badges actuales); sin datos sensibles.
- **Módulo hero/resumen**: el hero es el resumen accionable del landing.
- **Responsive**: hero apila en columna < `lg`, fila a `lg+`; tiles en grilla 2-col en móvil.
- **Reducir scroll**: el hero usa espacio horizontal (tiles a la derecha) en escritorio.
- **Qué NO cambiar**: lógica de URL/last-module, slots de workspace, `ClinicCommandCenter`, `PasswordChangePanel`, navegación, sidebar.

### 3.2 Dashboard admin — centro de control
- **Layout**: idéntico patrón; hero arriba del hub admin.
- **Hero**: gradiente navy profundo, eyebrow “Centro de control · Administración”, **estado del sistema prominente** (punto de estado + label), tiles vivos (Eventos de auditoría / Tipos de evento), CTA “Abrir administración” → módulo `admin`.
- **Grid de cards**: se conservan las 10 tarjetas admin.
- **Jerarquía**: estado/seguridad first (consistente con la prioridad de “Alertas críticas”).
- **Estados**: si `systemHealth` falló, el estado se muestra como tal (variant outline / label), sin inventar datos.
- **Responsive**: igual al clínico.
- **Qué NO cambiar**: auditoría, health, contratos de `page.tsx`, `AdminCommandCenter`, sesiones, `PasswordChangePanel`, sidebar.

### 3.3 Componentes compartidos
- **Nuevo** `DashboardHubHero.tsx`: hero presentacional reutilizable (eyebrow, título, descripción, status chip opcional, métricas[], CTA opcional, `variant: "clinic" | "admin"`). Sin fetch, sin imports de api/middleware/public, theme-aware.
- **Modificado** `DashboardModuleHub.tsx`: nuevo prop opcional `hero?: ReactNode`, renderizado arriba del heading + grilla. Se conservan `data-dashboard-module-hub`, `data-dashboard-module-card`, `dashboard-card-interactive`, focus rings.
- **Modificados** controllers: construyen el hero con datos que ya reciben y lo pasan a `DashboardModuleHub`.

---

## 4. Criterios de aceptación visual (verificables)

1. Antes/después evidente en la **primera pantalla** de `/dashboard` y `/dashboard/admin` sin navegar a módulos: aparece una banda hero con datos vivos y CTA. ✔ verificable visualmente + por test de presencia.
2. El cambio es visible **sin entrar a módulos profundos**. ✔
3. No depende de texto nuevo masivo (copy mínimo, foco en diseño/datos). ✔
4. No rompe acciones existentes (tarjetas, navegación, last-module). ✔ tests.
5. No expone secretos/tokens/hashes/cookies. ✔ test anti-sensibles.
6. No cambia contratos API ni rutas. ✔ sin tocar `lib/api`, sin fetch en componentes.
7. Mantiene rutas actuales (`/dashboard`, `/dashboard/admin`, `?module=`). ✔
8. Mantiene separación admin/clínica (heroes distintos, sin import cruzado). ✔
9. `PasswordChangePanel` sigue visible donde corresponde (`perfil` / `admin-sessions`). ✔ no se toca.
10. Conserva dark-gray theme mode (hero usa tokens de marca theme-aware). ✔
11. Conserva sidebar y persistencia de último módulo. ✔

---

## 5. Plan de implementación del PR

**Título sugerido:** `feat(dashboard): introduce premium workspace visual shell`

**Scope:** sólo frontend dashboard clínica/admin. Sin backend, DB, migrations, auth, contratos API ni producción.

Archivos:
- `frontend/src/components/dashboard/DashboardHubHero.tsx` (nuevo)
- `frontend/src/components/dashboard/DashboardModuleHub.tsx` (prop `hero`)
- `frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx` (hero clínica)
- `frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx` (hero admin + recibe counts)
- `frontend/src/app/dashboard/admin/page.tsx` (pasa `auditEntriesCount`, `eventTypesCount` — aditivo)
- `test/frontend-dashboard-hub-hero.test.ts` (nuevo, contrato)

No se toca: `page.tsx` clínica, command centers, sidebars, layout, `globals.css`, `lib/*`, backend.

---

## 6. Tests y validación

Comandos PNPM reales del repo:

```powershell
pnpm test                       # root: node --test test/**/*.test.ts (contratos)
pnpm --dir frontend lint        # eslint
pnpm --dir frontend typecheck   # tsc --noEmit
pnpm --dir frontend build       # next build
pnpm build                      # backend esbuild (no afectado)
pnpm security:public-surface    # auditoría devtools superficie pública
```

> `pnpm --dir frontend test:e2e` **no existe**; el script real es `pnpm --dir frontend e2e` (Playlist Playwright, requiere navegadores). E2E existentes de dashboard (`frontend/e2e/dashboard-*.spec.ts`) no se modifican.

Tests mínimos a asegurar:
- Rutas dashboard siguen protegidas (sin tocar middleware/auth → contratos existentes intactos).
- Módulos existentes siguen visibles (tarjetas en controllers → tests `frontend-dashboard-admin`/`home`).
- `PasswordChangePanel` no desaparece (no se toca `page.tsx` clínica ni slot sessions).
- Separación admin/clínica (test nuevo: heroes con variant correcto, sin import cruzado).
- Sin secretos/datos sensibles (test nuevo).
- build/typecheck/lint pasan.
- Theme mode intacto (no se toca `globals.css` ni toggles).
- Sidebar intacto (no se toca).
- Persistencia de último módulo intacta (no se toca la lógica; `frontend-dashboard-last-module`).

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Romper responsive | Hero con `flex-col` → `lg:flex-row`; tiles en grilla; probado en build. |
| Ocultar acciones existentes | Cambio aditivo; grilla de módulos intacta. |
| Duplicar contenido | Hero usa datos del landing (no presentes antes); no repite los command centers (que viven en módulos). |
| Aumentar scroll | Hero usa ancho horizontal en escritorio; altura acotada. |
| Tocar seguridad por accidente | No se toca auth/middleware/api/cookies; test anti-sensibles en el hero. |
| Dependencia innecesaria | Cero dependencias nuevas (ver §8). |
| Maquillar sin cambiar percepción | El cambio está en el **primer viewport** del hub, no dentro de módulos. |
| Romper contratos string-exact | Cambios aditivos; se preservan todas las cadenas/orden/atributos verificados; se corre `pnpm test`. |

---

## 8. Decisión sobre dependencias

**No se agregan dependencias.** Justificación:
- El hero se construye con **Tailwind** (ya presente) y clases de componente existentes (`dashboard-kpi-pill`, `dashboard-card-interactive`, gradientes de marca navy/teal ya usados en `DashboardModuleHub`).
- Íconos vía `lucide-react` (ya instalado).
- No se requieren librerías de UI/animación/charts/themes.
- Evita impacto en bundle y respeta el guardrail `package.json`/`pnpm-lock.yaml` sin cambios.

Alternativa evitada: librerías de dashboard/animación (p. ej. framer-motion, una UI kit) — innecesarias para una banda hero con grilla; sumarían peso y riesgo sin beneficio.
