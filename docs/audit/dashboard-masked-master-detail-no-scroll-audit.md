# Auditoría — Dashboard sin scroll + Navegación Jerárquica Enmascarada (Master-Detail en Cascada)

- **Rama:** `audit/dashboard-masked-master-detail-no-scroll`
- **Base:** `main` @ `ac50857` (working tree limpio, sin PRs abiertos, sin ramas remotas pendientes)
- **Fecha:** 2026-06-17
- **Alcance:** Auditoría sin cambios productivos. Único artefacto creado: este Markdown.
- **Skills aplicados:** `vetneb-admin-dashboard-operational-actions`, `vetneb-staff-senior-full-stack-engineer`, `vetneb-production-web-optimization-engineer`, `vetneb-briefing-planificacion-diseno-desarrollo-pruebas`, `vetneb-web-end-to-end-global`, `vetneb-security-production-invariants`.

> **Naturaleza de la tarea:** diagnóstico arquitectónico previo a implementación. NO se modificó código productivo, tests, CSS ni UI. NO se ejecutó `git add/commit/push` ni se creó PR.

---

## 1. Resumen ejecutivo

### 1.1. El diagnóstico no es "falta arquitectura", es "arquitectura aplicada a medias"

El portal **ya tiene** una arquitectura de App Shell de pantalla fija con primitivas no-scroll maduras. El problema persistente de scroll **no nace del shell**, nace de **módulos que no consumen esas primitivas** y de **un escape hatch de scroll interno que el contrato actual deja deliberadamente abierto**.

Cadena de altura real (correcta en su raíz):

```
DashboardShellRouter  →  div.dashboard-app-shell  (flex h-dvh overflow-hidden)   ← viewport fijo OK
  └─ div (flex-1 min-w-0 flex-col overflow-hidden)
      └─ <main class="dashboard-main">  (flex min-h-0 flex-1 overflow-y-auto)    ← ESCAPE HATCH
          └─ Controller (Hub  ↔  Module)
              └─ DashboardModuleWorkspace (flex min-h-0 flex-1 flex-col)
                  └─ <contenido del módulo>                                       ← AQUÍ desborda
```

Evidencia:

- Shell fijo correcto: [`DashboardShellRouter.tsx:22`](../../frontend/src/components/dashboard/DashboardShellRouter.tsx) → `flex h-dvh overflow-hidden`.
- **Escape hatch de scroll:** [`globals.css:218`](../../frontend/src/app/globals.css) → `.dashboard-main { @apply ... overflow-y-auto ... }`.
- **El escape hatch está blindado por contrato E2E:** [`dashboard-card-navigation-shell.spec.ts:434`](../../frontend/e2e/dashboard-card-navigation-shell.spec.ts) afirma explícitamente que `main` debe tener `overflowY === "auto"`. Es decir, hoy el sistema **promete** que `main` es un contenedor scrolleable.

### 1.2. Por qué el usuario sigue viendo scroll

Hay que distinguir dos cosas que el contrato actual trata distinto:

| Capa | Estado actual | Qué testea el E2E |
|---|---|---|
| **Body / documento** | Nunca scrollea (shell `h-dvh overflow-hidden`) | `body.scrollHeight ≤ innerHeight + 5` a 1280×900 ([spec:449](../../frontend/e2e/dashboard-card-navigation-shell.spec.ts), [spec:485](../../frontend/e2e/dashboard-card-navigation-shell.spec.ts)) |
| **`main` interno** | **Scrollea cuando el módulo desborda** | **No hay test que prohíba el scroll interno de `main`** |

El usuario percibe scroll porque **`<main>` scrollea internamente**. Los tests "no-scroll" actuales solo garantizan que el `body` no crece — no garantizan que el módulo quepa. Resultado: cuando un módulo apila formulario + lista + detalle (caso Tokens), `main` activa `overflow-y-auto` y aparece la "página que sube y baja".

### 1.3. Conclusión ejecutiva

- El **patrón objetivo ya existe** parcialmente: hay Hub→Módulo enmascarado (muñeca rusa) con `?module=` + botón "Volver a módulos", y primitivas `ModuleSurface / ModuleTabs / ModuleDialog / usePagedRows / CompactPager / MasterDetailWorkspace`.
- Existe un **gradiente de madurez**: algunos módulos son ejemplares (Auditoría, Clínicas, Precios, Estado del sistema, Sesiones); otros son anti-patrón puro (Tokens clínica).
- Existe una **bifurcación de patrón**: Admin vive 100% in-shell enmascarado; Clínica delega Informes/Logística a **rutas full-page separadas** (`/dashboard/informes`, `/dashboard/logistica`) que rompen el enmascaramiento y reintroducen "navegación por página".
- La solución NO es agregar más scroll ni rediseñar el shell: es **propagar las primitivas existentes a los módulos rezagados** y **endurecer el contrato** para que `main` deje de ser una válvula de escape silenciosa.

---

## 2. Diagnóstico por módulo

Leyenda de madurez: 🟢 cumple no-scroll · 🟡 parcial / riesgo en viewport corto · 🔴 anti-patrón (desborda y depende de `main` scroll).

### 2.1. Shell global — 🟢 (con una fuga controlada)

- **Estado actual:** viewport fijo correcto, sidebar rail compacto, router clínica/admin. Cadena `h-dvh → min-h-0 → flex-1`.
- **Dónde nace el scroll:** [`globals.css:218`](../../frontend/src/app/globals.css) `overflow-y-auto` en `.dashboard-main`; spacer móvil `<div class="h-24 md:hidden">` ([page.tsx:170](../../frontend/src/app/dashboard/page.tsx), [admin/page.tsx:829](../../frontend/src/app/dashboard/admin/page.tsx), [logistica/page.tsx:115](../../frontend/src/app/dashboard/logistica/page.tsx)).
- **Qué crece:** nada propio del shell; es contenedor.
- **Riesgo de romper:** **alto si se cambia a ciegas** — el E2E [`spec:434`](../../frontend/e2e/dashboard-card-navigation-shell.spec.ts) exige `overflow-y-auto`. Cualquier cambio debe alinear ese test en el mismo PR.
- **Recomendación:** mantener `overflow-y-auto` como red de seguridad, pero **degradarlo a "nunca debería activarse"**: cada módulo debe terminar la cadena con `ModuleSurface`. Endurecer con un test que mida `main.scrollHeight ≤ main.clientHeight` por módulo crítico a 1366×768.

### 2.2. Clínica · Tokens particulares — 🔴 (el peor ofensor)

- **Componente:** [`ClinicParticularTokensCard.tsx`](../../frontend/src/components/dashboard/ClinicParticularTokensCard.tsx).
- **Estado actual:** un único `<Card>` con `CardContent class="space-y-6"` que apila verticalmente:
  1. Formulario de **13 campos** en grid + `<textarea>` "Detalle de lesión" ([:387–633](../../frontend/src/components/dashboard/ClinicParticularTokensCard.tsx)).
  2. Panel "Token generado" con alertas, checkbox y botones ([:650–722](../../frontend/src/components/dashboard/ClinicParticularTokensCard.tsx)).
  3. Lista de hasta **10 tokens** (`getClinicParticularTokens({ limit: 10 })`, [:209](../../frontend/src/components/dashboard/ClinicParticularTokensCard.tsx)), **cada uno con grid de 6 bandas de detalle** ([:787–865](../../frontend/src/components/dashboard/ClinicParticularTokensCard.tsx)).
- **Dónde nace el scroll:** es el anti-patrón textual "lista + detalle + formulario uno debajo del otro". Aun con 1 token, el formulario completo + 6 bandas supera el viewport. Garantiza scroll de `main`.
- **Qué debería limitarse:** la lista (paginar a 3–4 visibles); el detalle de 6 bandas (mover a panel/overlay de detalle, no inline por cada fila).
- **Qué debería moverse a detalle:** las 6 bandas por token → `DetailPane` que reemplaza la lista al seleccionar.
- **Qué debería enmascararse:** el formulario de alta → `ModuleDialog` (step-based), igual que ya hace Admin Clínicas.
- **Riesgo de romper:** medio. Componente con mucho estado (token generado de una sola vista, confirmación obligatoria, clipboard). Hay que preservar: invariante "token completo se muestra una sola vez" y el flujo de confirmación antes de cerrar.
- **Recomendación concreta:** ver §4 (Master-Detail Opción A + formulario en `ModuleDialog`).

### 2.3. Clínica · Operaciones (Command Center) — 🟡

- **Componente:** [`ClinicCommandCenter.tsx`](../../frontend/src/app/dashboard/ClinicCommandCenter.tsx).
- **Estado actual:** `flex h-full min-h-0 flex-col gap-3` (height-aware) con banner KPI + `StatsCards` (4) + grid 2-col de "Informes recientes" / "Visitas de campo". Listas ya limitadas a 3 ([page.tsx:101–102](../../frontend/src/app/dashboard/page.tsx)).
- **Dónde nace el scroll:** no usa `ModuleSurface`; depende de que el contenido sea "naturalmente corto". A <820px de alto (laptop 1366×768 con chrome del navegador) banner + 4 KPIs + 2 tarjetas desborda.
- **Qué debería limitarse:** ya está acotado a 3 ítems; el riesgo es de composición vertical, no de cantidad.
- **Recomendación:** envolver en `ModuleSurface` (toolbar opcional vacío + body `flex-1 min-h-0`); convertir el grid inferior a auto-rows que rellenen el alto restante (mismo patrón que `dashboard-cockpit-grid`).

### 2.4. Clínica · Informes (módulo in-shell) — 🟡 + bifurcación de patrón

- **Componente:** [`ClinicInformesWorkspaceSummary.tsx`](../../frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx).
- **Estado actual:** `div.space-y-4` = tarjeta teaser (3 informes) + botón "Ver módulo de informes completo" que **navega a la ruta separada** `/dashboard/informes`.
- **Dónde nace el scroll:** el summary en sí cabe; el problema es **arquitectónico**: rompe el enmascaramiento (el usuario sale del shell-módulo hacia otra página).
- **Qué debería enmascararse:** el Master-Detail real de informes debería vivir **dentro del módulo**, no en otra ruta.
- **Riesgo de romper:** medio — hay deep-links y tests E2E que esperan el workspace `informes` ([spec:162](../../frontend/e2e/dashboard-card-navigation-shell.spec.ts)) y la ruta `/dashboard/informes`.
- **Recomendación:** ver §4 (traer el split Master-Detail al módulo; conservar `/dashboard/informes` como deep-link/fallback).

### 2.5. Clínica · Logística (módulo in-shell) — 🟡 + bifurcación de patrón

- **Componente:** [`ClinicLogisticaWorkspaceSummary.tsx`](../../frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx).
- **Estado actual:** idéntico patrón al de Informes → teaser + botón a `/dashboard/logistica`.
- **Diagnóstico:** mismo que §2.4. Además la ruta `/dashboard/logistica` ([logistica/page.tsx](../../frontend/src/app/dashboard/logistica/page.tsx)) apila `DashboardPageHeader` + `StickyActionBar` + `LogisticsCommandCenter` dentro de `dashboard-main` → patrón "página vertical".
- **Recomendación:** ver §4 (Opción A o ModuleTabs de sub-secciones visitas/rutas/métricas dentro del módulo).

### 2.6. Clínica · Perfil público — 🟢 (referencia de patrón ya alineado)

- **Composición:** [`page.tsx:149–165`](../../frontend/src/app/dashboard/page.tsx) → `ModuleTabs` [Acceso | Perfil público].
- **Diagnóstico:** ejemplar. Dos sub-secciones que conmutan dentro del mismo viewport sin scroll. **Mantener como referencia de "Navegación por Estado dentro del mismo card"** para los demás módulos.

### 2.7. Admin · Administración (resumen) — 🟡

- **Slot:** [`admin/page.tsx:402–427`](../../frontend/src/app/dashboard/admin/page.tsx) → `div.space-y-6` = `AdminCommandCenter` + sección "Alertas críticas" + `AdminFailedLoginAlertsReadOnlyCard`.
- **Dónde nace el scroll:** wrapper `space-y-6` sin cadena de altura; tres bloques apilados.
- **Recomendación:** `ModuleSurface` + (si hace falta) `ModuleTabs` [Resumen | Alertas]. Acotar la tarjeta de intentos fallidos con `usePagedRows`.

### 2.8. Admin · Estado del sistema — 🟢

- **Slot:** [`admin/page.tsx:568–589`](../../frontend/src/app/dashboard/admin/page.tsx) → `ModuleTabs` [Servicios | Runtime | Esquema]. Comentario explícito de no-scroll en [:454](../../frontend/src/app/dashboard/admin/page.tsx). **Referencia.**

### 2.9. Admin · Clínicas — 🟢 (referencia de Master-Detail + Dialog)

- **Componente:** [`AdminClinicsManagementCard.tsx`](../../frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx).
- **Diagnóstico:** ejemplar. `Card.flex min-h-0 flex-1 flex-col`, paginación server `PAGE_SIZE=5` ([:53](../../frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx)), alta en `ModuleDialog` ([:258](../../frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx)), edición en drawer, **una fila por clínica** con "+N". Es el modelo a replicar para Tokens clínica.

### 2.10. Admin · Precios — 🟢 (referencia de paginación extrema)

- **Componente:** [`AdminPricingEditorCard.tsx`](../../frontend/src/app/dashboard/admin/AdminPricingEditorCard.tsx).
- **Diagnóstico:** ejemplar. `ModuleTabs` por categoría + `usePagedRows` con `ITEMS_PER_PAGE = 1` ([:32](../../frontend/src/app/dashboard/admin/AdminPricingEditorCard.tsx)) + `CompactPager`. Demuestra que "1 form por viewport" es válido y preferible a scroll.

### 2.11. Admin · Tokens particulares — 🟡 (parcial, ya tiene state machine)

- **Componente:** [`AdminParticularTokensCard.tsx`](../../frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx).
- **Estado actual:** **ya tiene navegación por estado** `activePanel: "tokens" | "create"` ([:345](../../frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx), toggles [:966–980](../../frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx)). Separa lista de formulario — bien encaminado.
- **Riesgo:** el panel "tokens" puede seguir mostrando detalle largo por fila (mismo riesgo que clínica). Falta confirmar `ModuleSurface` + paginación visible.
- **Recomendación:** formalizar a `ModuleSurface` + `usePagedRows`; el panel `create` ya es un buen "step" (Opción C carousel lista→alta).

### 2.12. Admin · Auditoría — 🟢

- **Slot/Componente:** [`admin/page.tsx:639–776`](../../frontend/src/app/dashboard/admin/page.tsx) + [`AdminAuditLogTable.tsx`](../../frontend/src/app/dashboard/admin/AdminAuditLogTable.tsx).
- **Diagnóstico:** `ModuleTabs` [Resumen | Registro]; tabla con `usePagedRows PAGE_SIZE=8` + `dashboard-fitted-table` + `CompactPager`. **Referencia.** (La tab "Resumen" es grid de 3 cards `content-start` — borderline pero acotado.)

### 2.13. Admin · Sesiones / Roles clínica / Mantenimiento

- **Sesiones — 🟢:** [`admin/page.tsx:612–629`](../../frontend/src/app/dashboard/admin/page.tsx) → `flex min-h-0 flex-1` + cambio de contraseña en `ModuleDialog`. Referencia.
- **Roles clínica — 🟡:** [`admin/page.tsx:632–636`](../../frontend/src/app/dashboard/admin/page.tsx) → `section` plano envolviendo `AdminUsersRolesReadOnlyCard`. Verificar acotación de lista; envolver en `ModuleSurface`.
- **Mantenimiento — 🟡:** [`admin/page.tsx:779–786`](../../frontend/src/app/dashboard/admin/page.tsx) → `div.space-y-4` = schema card + dry-run card. Sin cadena de altura. Envolver en `ModuleTabs` [Esquema | Dry-run].

### 2.14. Ruta full-page · `/dashboard/informes` — 🟡 (Master-Detail existe, pero a nivel página)

- **Componente:** [`informes/page.tsx`](../../frontend/src/app/dashboard/informes/page.tsx).
- **Estado actual:** **ya es Master-Detail** real: lista paginada (`REPORTS_PAGE_SIZE=6`, [:44](../../frontend/src/app/dashboard/informes/page.tsx)) + `DetailPane` por `?reportId=`, en grid `xl:grid-cols-[0.86fr_1.44fr]` ([:457](../../frontend/src/app/dashboard/informes/page.tsx)). Selección por URL (Navegación por Estado). **Bien conceptualmente.**
- **Dónde nace el scroll:**
  1. Apila verticalmente `DashboardPageHeader` + `<form>` de filtros (fila completa) + grid Master-Detail dentro de `dashboard-main` ([:277–697](../../frontend/src/app/dashboard/informes/page.tsx)). Header + filtros empujan el grid fuera del viewport.
  2. `min-height: 18rem` en `.dashboard-master-panel` y `.dashboard-detail-panel` ([globals.css:1240](../../frontend/src/app/globals.css), [:1249](../../frontend/src/app/globals.css)): en single-column (mobile) suma **≥36rem forzados** + header + filtros = scroll asegurado.
  3. El `DetailPane` usa `space-y-4 p-4` con grid de 6 bandas + acciones + `StudyTimeline` ([:580–693](../../frontend/src/app/dashboard/informes/page.tsx)): alto sin techo.
- **Recomendación:** mover filtros a `dashboard-module-toolbar` compacto (inline), neutralizar `min-height:18rem` en móvil, y migrar la composición al módulo in-shell (§4) reutilizando el split. El `DetailPane` debe scrollear **solo internamente y solo si excede** (no empujar la lista).

### 2.15. Rutas `/dashboard/logistica/{visitas,rutas,metricas}` — 🟡

- **Estado actual:** rutas separadas (patrón página) con `dashboard-main` + header + contenido. Mismo diagnóstico que §2.5/§2.14.
- **Recomendación:** consolidar como sub-secciones (`ModuleTabs`) del módulo Logística in-shell, o como segundo nivel de cascada Master-Detail.

---

## 3. Mapa de arquitectura propuesta

No se inventa nada nuevo: se **nombra y completa** lo que ya existe.

```
DashboardShell (h-dvh overflow-hidden)                         [YA EXISTE — DashboardShellRouter]
└─ WorkspaceViewport (<main> min-h-0 flex-1)                   [YA EXISTE — .dashboard-main; quitar dependencia de su scroll]
   └─ Controller  (Hub ↔ Module, ?module=, "Volver a módulos") [YA EXISTE — Clinic/AdminDashboardWorkspaceController]
      ├─ Hub: DashboardModuleHub (cockpit grid auto-rows 1fr)  [YA EXISTE]
      └─ Module: DashboardModuleWorkspace (flex min-h-0 flex-1) [YA EXISTE]
         └─ ModuleSurface (toolbar fijo + body flex-1 min-h-0)  [YA EXISTE — propagar a TODOS los módulos]
            ├─ MasterList (usePagedRows + CompactPager)         [YA EXISTE — bound de listas]
            ├─ DetailPane (reemplaza/ocupa panel dedicado)      [MasterDetailWorkspace YA EXISTE]
            ├─ InCardOverlay (mobile: detalle tapa lista)       [A FORMALIZAR sobre MasterDetailWorkspace]
            ├─ ModuleTabs (navegación por estado same-card)     [YA EXISTE]
            └─ ModuleDialog (formularios por step)              [YA EXISTE]
```

Estado por estado (la "muñeca rusa"):

- **Estado inicial (general):** Hub compacto (cockpit) con métricas + tarjetas de módulo. Ya implementado.
- **Estado módulo:** `ModuleSurface` con `MasterList` acotada + `DetailPane` vacío (Opción A) o lista a pantalla (Opción B).
- **Estado seleccionado:** `selectedEntityId` → `DetailPane` se llena (desktop) o `InCardOverlay` tapa la lista (mobile). El alto del card **no cambia**.
- **Estado edición/alta:** `ModuleDialog` (step) o panel `viewMode="edit"`. No convive verticalmente con lista+detalle.
- **Estado retorno:** "Atrás" interno restaura la lista sin mover el viewport; "Volver a módulos" vuelve al Hub.

Variables de estado a estandarizar por módulo (varias ya existen de facto):

`selectedTokenId · selectedReportId · selectedClinicId · selectedStudyId · activePanel · viewMode: "list" | "detail" | "edit"`.

---

## 4. Decisión por módulo (patrón concreto, sin abstracción)

| Módulo | Patrón decidido | Justificación |
|---|---|---|
| **Shell global** | Mantener `h-dvh overflow-hidden`; `main` `overflow-y-auto` como red de seguridad **inerte**; añadir guard de test `main.scrollHeight ≤ clientHeight` por módulo crítico | No romper contrato E2E; eliminar el scroll real en origen (módulos) |
| **Tokens particulares (clínica)** | **Opción A (split fijo)** en desktop: master = lista de tokens paginada (3–4 visibles) · detail = 6 bandas del token seleccionado. **Opción B (overlay interno)** en mobile. **Alta → `ModuleDialog`** (step) | Es lista + detalle largo + formulario: el caso canónico de Master-Detail. Replica el patrón ya probado de Admin Clínicas |
| **Informes (clínica, in-shell)** | **Opción A (split fijo)**: traer el Master-Detail de `/dashboard/informes` al módulo. Filtros en toolbar compacto | Enmascarar (no navegar a otra página). El split ya existe en la ruta; se reubica |
| **Logística (clínica, in-shell)** | **Opción A + `ModuleTabs`** de sub-secciones (Visitas / Rutas / Métricas) dentro del módulo | Múltiples sub-vistas → tabs same-card; evita 4 rutas full-page |
| **Admin · Tokens particulares** | **Opción C (carousel/multi-step)** ya iniciado (`activePanel tokens↔create`) + **Opción A** dentro del panel "tokens" para el detalle | Ya tiene state machine; solo formalizar `ModuleSurface` + paginación |
| **Admin · Administración (resumen)** | `ModuleSurface` + `ModuleTabs` [Resumen \| Alertas]; intentos fallidos con `usePagedRows` | Acotar 3 bloques apilados |
| **Admin · Roles clínica** | `ModuleSurface` + `usePagedRows` | Lista read-only acotada |
| **Admin · Mantenimiento** | `ModuleTabs` [Esquema \| Dry-run] | Dos cards → tabs same-card |
| **Perfil público (clínica)** | **Mantener como referencia** (`ModuleTabs`) | Ya alineado |
| **Admin · Clínicas / Precios / Auditoría / Sesiones / Estado** | **Mantener como referencia** | Ya cumplen no-scroll |
| **Ruta `/dashboard/informes`** | Reusar su split como componente del módulo in-shell; conservar ruta como deep-link/fallback | Evita duplicar Master-Detail |

---

## 5. Reglas visuales obligatorias (para implementación futura)

1. **Prohibido el scroll del documento/body** en cualquier vista de dashboard (ya garantizado por el shell; no degradar).
2. **`main` no debe scrollear en módulos críticos.** Su `overflow-y-auto` es red de seguridad, no mecanismo de navegación. Si un módulo lo activa a 1366×768, es un bug.
3. **Prohibido apilar lista + detalle + formulario verticalmente** si la suma supera el viewport. Usar Master-Detail (A), overlay (B) o steps/dialog.
4. **Máximo de elementos visibles por card:** lista densa **≤ 8** (precedente `AdminAuditLogTable PAGE_SIZE=8`); lista con detalle por fila **≤ 4**; formulario-por-viewport puede ser **1** (precedente Precios). El resto, vía `CompactPager`.
5. **Todo detalle reemplaza u ocupa panel dedicado** (`DetailPane` / `InCardOverlay`), nunca se expande inline empujando el resto.
6. **Formularios largos → `ModuleDialog` o `viewMode="edit"`**, nunca conviviendo con la lista.
7. **Mobile usa capas internas** (Hub → lista → detalle → edición), no apilado vertical completo. Eliminar/neutralizar `min-height: 18rem` en single-column.
8. **Empty / error / loading compactos:** altura acotada, sin `min-height` que rompa la cadena. Revisar `.dashboard-master-panel`/`.dashboard-detail-panel min-height:18rem` ([globals.css:1240/1249](../../frontend/src/app/globals.css)).
9. **Filtros inline compactos** en `dashboard-module-toolbar` (fila fija), no como bloque que empuje el contenido.
10. **Acciones secundarias agrupadas** (toolbar/dialog), jerarquía clara de una sola acción primaria por estado.
11. **Eliminar spacers móviles** `<div class="h-24 md:hidden">` cuando el módulo ya quepa por cascada (hoy en [page.tsx:170](../../frontend/src/app/dashboard/page.tsx), [admin/page.tsx:829](../../frontend/src/app/dashboard/admin/page.tsx), [logistica/page.tsx:115](../../frontend/src/app/dashboard/logistica/page.tsx)).

---

## 6. Plan de implementación futura (PRs pequeños y seguros)

> Cada PR es mínimo, con causa raíz única, validable y con rollback lógico. Git lo ejecuta Nico manualmente.

### PR-A — Shell fijo + contrato anti-scroll interno
- **Scope:** introducir test que verifique `main.scrollHeight ≤ main.clientHeight` (con tolerancia) por módulo crítico a 1366×768 y un viewport mobile. Alinear/extender [`spec:434`](../../frontend/e2e/dashboard-card-navigation-shell.spec.ts) para que el "scroll de seguridad" quede documentado pero medido como inactivo.
- **Archivos probables:** `frontend/e2e/dashboard-card-navigation-shell.spec.ts` (o nuevo `dashboard-no-internal-scroll.spec.ts`).
- **Tests:** E2E nuevos anti-scroll interno; sin tocar productivo.
- **Riesgo:** bajo. No cambia UI; solo formaliza la meta.
- **Aceptación:** los módulos hoy 🟢 pasan; los 🔴/🟡 fallan (marca la deuda). Opcional `test.fixme` para los pendientes hasta su PR.

### PR-B — Tokens particulares (clínica): Master-Detail en cascada
- **Scope:** refactor de [`ClinicParticularTokensCard.tsx`](../../frontend/src/components/dashboard/ClinicParticularTokensCard.tsx) a `ModuleSurface` + `MasterDetailWorkspace` (split desktop / overlay mobile) + alta en `ModuleDialog`. Lista con `usePagedRows`.
- **Archivos probables:** `ClinicParticularTokensCard.tsx` (+ posible extracción `ClinicTokenDetailPane.tsx`, `ClinicTokenCreateDialog.tsx`).
- **Tests:** preservar contrato `tokens` workspace ([spec:207](../../frontend/e2e/dashboard-card-navigation-shell.spec.ts)); E2E de selección token→detalle sin crecer el card; mantener tests de "token visible una sola vez".
- **Riesgo:** medio (estado de token generado, clipboard, confirmación). **No cambiar payloads ni API.**
- **Aceptación:** abrir Tokens no activa scroll de `main`; seleccionar un token no aumenta altura; alta vive en dialog.

### PR-C — Informes: Master-Detail enmascarado in-shell + densidad
- **Scope:** llevar el split de [`informes/page.tsx`](../../frontend/src/app/dashboard/informes/page.tsx) al módulo `informes` del Hub clínica; filtros a toolbar compacto; neutralizar `min-height:18rem` en mobile; `DetailPane` con scroll interno acotado.
- **Archivos probables:** `ClinicInformesWorkspaceSummary.tsx` → componente split; `informes/page.tsx`; `globals.css` (solo la regla `min-height` de paneles, alineando tests de contrato CSS).
- **Tests:** mantener workspace `informes` ([spec:162](../../frontend/e2e/dashboard-card-navigation-shell.spec.ts)) y deep-link `/dashboard/informes`; E2E selección informe→detalle sin scroll.
- **Riesgo:** medio (toca CSS compartido y ruta con deep-links). Cambio de `min-height` debe alinear cualquier test de contrato `globals.css`.
- **Aceptación:** lista + detalle sin filtros empujando; mobile sin 36rem forzados.

### PR-D — Admin polish operacional (slots rezagados)
- **Scope:** envolver `adminWorkspaceSlot`, `usersRolesWorkspaceSlot`, `maintenanceWorkspaceSlot` en `ModuleSurface`/`ModuleTabs`; acotar listas con `usePagedRows`.
- **Archivos probables:** `admin/page.tsx`, `AdminUsersRolesReadOnlyCard.tsx`, `AdminMaintenanceDryRunCard.tsx`, `AdminFailedLoginAlertsReadOnlyCard.tsx`.
- **Tests:** mantener activación por módulo ([spec:701–725](../../frontend/e2e/dashboard-card-navigation-shell.spec.ts)) y aislamiento de workspace.
- **Riesgo:** bajo. Cambios de composición, sin API.
- **Aceptación:** los tres slots no activan scroll de `main` a 1366×768.

### PR-E — Logística in-shell + capas mobile
- **Scope:** consolidar Visitas/Rutas/Métricas como `ModuleTabs` (o cascada) dentro del módulo `logistica`; conservar rutas como deep-link.
- **Archivos probables:** `ClinicLogisticaWorkspaceSummary.tsx`, `LogisticsCommandCenter.tsx`, rutas `logistica/*`.
- **Tests:** mantener workspace `logistica` ([spec:177](../../frontend/e2e/dashboard-card-navigation-shell.spec.ts)).
- **Riesgo:** medio.
- **Aceptación:** sub-secciones conmutan same-card sin scroll.

### PR-F — Suite E2E visual/operativa anti-scroll
- **Scope:** matriz de viewports (1920×1080, 1366×768, 768×1024, 390×844) × módulos críticos, midiendo `main` interno y `body`.
- **Archivos probables:** nuevo spec E2E.
- **Riesgo:** bajo.
- **Aceptación:** verde en todos los módulos ya migrados (B–E).

**Orden recomendado:** PR-A → PR-B → PR-D → PR-C → PR-E → PR-F. (A primero fija la meta medible; B ataca el peor ofensor; D es bajo riesgo y limpia admin; C/E tocan CSS/rutas y van después; F cierra.)

---

## 7. Criterios de aceptación medibles

1. **Desktop (1366×768 y 1920×1080):** ningún módulo crítico activa scroll de `<main>` (`main.scrollHeight ≤ main.clientHeight + 4`) ni del `body`.
2. **Mobile (390×844):** no se apilan lista + detalle + formulario simultáneamente; se usan capas (overlay/step).
3. **Listas del dashboard:** no renderizan más de N visibles (densa ≤ 8; con detalle ≤ 4); el resto vía `CompactPager`/paginación server.
4. **Selección no cambia altura:** seleccionar token/informe/clínica no aumenta la altura del card (delta de `clientHeight` ≈ 0).
5. **Retorno estable:** "Atrás"/"Volver" restaura la vista general sin mover el scroll del viewport (`scroll: false` ya en uso).
6. **Empty/error/loading compactos:** altura acotada; sin `min-height` que fuerce scroll en single-column.
7. **Cobertura de tests:** cada módulo migrado tiene E2E anti-scroll + se preservan los contratos de hub/workspace/aislamiento/deep-link existentes.
8. **Seguridad intacta:** sin exponer `password_hash`, tokens completos, cookies ni signed URLs; separación `app_session_id` (clínica) / `admin_session_id` (admin); `security:public-surface` PASS; PWA no cachea privados. (Refactor de UI **no** debe tocar payloads ni auth.)
9. **Sin regresiones funcionales:** alta de token/clínica, edición de precios, revocación de sesión y descargas siguen llamando backend real.

---

## 8. Comandos ejecutados

> Protocolo VETNEB: Windows PowerShell, PNPM. (La skill de optimización desaconseja `rg` en terminal; la exploración de contenido usó la herramienta nativa de búsqueda del agente, no `rg` de shell.)

**Terminal 1 — Verificación de estado base**
```powershell
cd C:\PORTAL-VETNEB
git status --short                       # (vacío) working tree limpio
git branch --show-current                # main
git log -1 --oneline                     # ac50857 refactor(dashboard): align token and reports workspaces ... (#1012)
git fetch origin --prune                 # sin novedades
git status --short                       # (vacío)
gh pr list --state open                  # (vacío) sin PRs abiertos
git branch -r --no-merged origin/main    # (vacío) sin ramas remotas pendientes
git switch -c audit/dashboard-masked-master-detail-no-scroll   # rama de auditoría creada
```

**Terminal 1 — Validación base (baseline, sin cambios productivos)**
```powershell
pnpm --dir frontend typecheck            # OK (tsc --noEmit, sin errores)
pnpm security:public-surface             # PASS (sin exposición devtools pública; findings = solo identificadores server-only esperados)
pnpm --dir frontend lint                 # OK (eslint, sin warnings)
pnpm test                                # OK — tests 2758 / pass 2758 / fail 0
pnpm --dir frontend build                # OK (next build, 27 rutas compiladas)
pnpm build                               # OK (esbuild server → dist/index.js 877.2kb)
git status --short                       # (vacío) — el build NO modificó next-env.d.ts
```

**Resultado:** baseline 100% verde. Working tree limpio salvo este archivo nuevo de auditoría.

---

## 9. Recomendación final

**Implementar — SÍ**, por fases pequeñas. El sistema **no necesita rediseño**: necesita **terminar de aplicar su propia arquitectura** a los módulos rezagados y **endurecer el contrato** para que `main` deje de absorber el desborde en silencio.

- **Primer PR exacto sugerido:** **PR-A** (contrato/medición anti-scroll interno). Es de riesgo bajo, no toca UI, y convierte el problema difuso ("todavía hay scroll") en una métrica binaria por módulo que guía y verifica los PRs siguientes.
- **Peor ofensor a atacar inmediatamente después:** **PR-B** (Tokens particulares clínica) — único módulo 🔴, anti-patrón textual lista+detalle+formulario.
- **Riesgos principales:**
  1. Tocar `globals.css` (`min-height:18rem`, `overflow-y-auto`) puede chocar con **tests de contrato CSS y E2E** → alinearlos **en el mismo PR** (precedente del repo).
  2. Migrar Informes/Logística in-shell afecta **deep-links y rutas** → conservar rutas como fallback.
  3. El refactor de Tokens maneja **estado sensible** (token de una sola vista) → no alterar API ni el flujo de confirmación.
- **Beneficio esperado:** experiencia de software administrativo premium de pantalla fija, con cascada Master-Detail consistente entre Admin y Clínica, listas acotadas, detalle dinámico y formularios por estado — en desktop, tablet y mobile, **sin tocar seguridad, contratos ni estabilidad productiva**.

> **No-alcance de esta auditoría:** no se implementó código, no se modificaron tests/CSS/UI, no se hizo commit/push/PR. El único cambio en el working tree es este documento.
