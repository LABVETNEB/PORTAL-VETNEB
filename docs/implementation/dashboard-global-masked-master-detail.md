# Dashboard global — Navegación Jerárquica Enmascarada + Master-Detail en Cascada (sin scroll)

- **Rama:** `feat/dashboard-global-masked-master-detail`
- **Base:** `main` @ `bf4785b` (test(dashboard): enforce internal no-scroll contract, #1014)
- **Fecha:** 2026-06-17
- **Tipo:** Implementación + tests. No es auditoría ni rediseño libre.

## 1. Objetivo del PR

Llevar **ambos dashboards** (Clínica y Administración) al mismo modelo operativo de
**workspace administrativo fijo**: pantalla fija, sin scroll externo ni scroll
interno operativo, navegación por estados, Master-Detail en Cascada, listas
limitadas, detalle dinámico y formularios en capa dedicada. Completa los módulos
que la auditoría marcó como rezagados (PR-B/C/D/E) sin reintroducir scroll y sin
degradar el contrato anti-scroll mergeado en #1014 (PR-A).

## 2. Documentos rectores usados

- `docs/audit/dashboard-masked-master-detail-no-scroll-audit.md` — §2 (diagnóstico
  por módulo), §3 (mapa de arquitectura), §4 (decisión por módulo), §5 (reglas
  visuales), §6 (plan PR-B/C/D/E), §7 (criterios de aceptación medibles).
- `docs/implementation/dashboard-internal-no-scroll-contract.md` — PR-A: `main`
  no es scroll container (`overflow: hidden`); módulos deben **caber**, no scrollear.

## 3. Estado de reanudación tras interrupción

La reanudación encontró la rama `feat/dashboard-global-masked-master-detail`
ya creada sobre `bf4785b test(dashboard): enforce internal no-scroll contract
(#1014)`, con cambios parciales en Tokens clínica, Informes clínica, Logística
clínica, `admin/page.tsx`, este documento y un E2E global nuevo. No había PRs
abiertos ni ramas remotas no mergeadas reportadas por `git branch -r --no-merged
origin/main`. Se continuó en la rama existente, sin crear otra rama y sin
descartar cambios.

Los cambios parciales se corrigieron antes de cerrar la implementación:
el alta de Tokens ya estaba en `ModuleDialog`, pero dependía de
`overflow-y-auto` interno; se convirtió a flujo por pasos. El token generado
seguía como bloque inline dentro del card; se movió a una capa dialog controlada.
También quedaban spacers móviles `h-24 md:hidden`; se eliminaron.

## 4. Problema global corregido

El shell ya era de pantalla fija con primitivas maduras (`ModuleSurface`,
`ModuleTabs`, `ModuleDialog`, `MasterDetailWorkspace`, `usePagedRows`,
`CompactPager`), pero **módulos rezagados no las consumían**:

- **Clínica · Tokens particulares (🔴, peor ofensor):** un único card apilaba
  verticalmente **formulario de 13 campos + panel de token generado + lista de
  hasta 10 tokens, cada uno con 6 bandas de detalle**. Con `main` en
  `overflow: hidden` (PR-A) ese contenido **recortaba** con datos reales.
- **Clínica · Informes/Logística (🟡, bifurcación):** resúmenes teaser que
  empujaban al usuario fuera del shell hacia rutas full-page (`/dashboard/informes`,
  `/dashboard/logistica`), rompiendo el enmascaramiento.
- **Admin · Resumen / Mantenimiento / Roles (🟡):** slots con `space-y-6` /
  `space-y-4` / `section` plano, sin cadena de altura ni tabs.

## 5. Arquitectura aplicada (sin inventar primitivas)

```
DashboardShell (h-dvh overflow-hidden)                 [existente]
└─ main.dashboard-main (overflow-hidden, no scroll)    [PR-A]
   └─ Controller (Hub ↔ Module, ?module=, "Volver")    [existente]
      └─ Module
         ├─ Lista master  → usePagedRows + CompactPager (≤4 visibles)
         ├─ Detalle       → panel dedicado (desktop split) / capa de reemplazo (mobile)
         ├─ Tabs          → ModuleTabs (navegación por estado same-card)
         └─ Alta/edición  → ModuleDialog por pasos (capa flotante; nunca apila)
```

Estados estandarizados por módulo: `selected<Entity>Id`, `isMobileDetailOpen`
(capa de reemplazo mobile), `isCreateDialogOpen` (alta en capa dedicada),
`page` (paginación compacta).

## 6. Cambios en Dashboard Clínica

| Módulo | Antes | Ahora |
|---|---|---|
| **Operaciones** (`ClinicCommandCenter.tsx`) | banner + métricas + listas apiladas | `ModuleSurface` + `ModuleTabs` [Métricas \| Recientes]; el banner queda en toolbar fija y las listas recientes no conviven verticalmente con métricas |
| **Tokens particulares** (`ClinicParticularTokensCard.tsx`) | 🔴 form + token + lista + 6 bandas apilados | Master-Detail: lista `usePagedRows` (≤4) + `CompactPager` · detalle en panel dedicado con las 6 bandas (incl. Seguimiento + alerta de tinción) · **alta en `ModuleDialog` por 3 pasos** · token generado en `ModuleDialog` controlado · mobile = capa de reemplazo con "Volver a la lista" |
| **Informes** (`ClinicInformesWorkspaceSummary.tsx`) | teaser + botón a ruta | `ModuleSurface` in-shell con master-detail seleccionable (lista de informes recientes + detalle) · deep-link `/dashboard/informes` preservado como módulo completo · mobile = reemplazo con "Volver" |
| **Logística** (`ClinicLogisticaWorkspaceSummary.tsx`) | teaser + botón a ruta | igual patrón in-shell (visitas recientes → detalle) · deep-link `/dashboard/logistica` preservado · mobile = reemplazo |
| **Perfil público** | 🟢 ya conforme | preservado sin degradar |

## 7. Cambios en Dashboard Administración

| Slot | Antes | Ahora |
|---|---|---|
| **Resumen (admin)** | `div.space-y-6` (command center + alertas apilados) | `ModuleTabs` [Resumen \| Alertas]; cada tab cabe en un viewport. Orden y strings de contrato preservados (`AdminCommandCenter` → `AdminFailedLoginAlertsReadOnlyCard`) |
| **Alertas críticas** | tabla client-side con 25 visibles | `PAGE_SIZE=5`, card `flex min-h-0 flex-1`, tabla en cuerpo acotado y paginación visible |
| **Mantenimiento** | `div.space-y-4` (schema + dry-run) | `ModuleTabs` [Esquema \| Dry-run] (`id="admin-maintenance"` preservado); candidatos dry-run paginados de a 4 con `CompactPager` |
| **Roles clínica** | `section` plano + 25 visibles | `section` con cadena `flex min-h-0 flex-1 flex-col`; tabla roles `PAGE_SIZE=5` |
| **Subir informe / Tokens admin / Precios** | wrappers sin `min-h-0 flex-1` | wrappers reforzados para preservar el alto de sus componentes internos |
| Clínicas / Precios / Auditoría / Sesiones / Estado / Tokens admin | 🟢 referencias ya conformes | preservados; sirven de modelo |
| **Hub mobile admin/clínica** | el hub inicial podía exceder el alto fijo en 390×844 | hero/launcher compactos en mobile, descripciones largas ocultas antes de `sm`, launcher admin denso en 3 columnas |

## 8. Módulos cubiertos

Clínica: Operaciones, Tokens, Informes, Logística (migrados); Perfil (preservado).
Admin: Resumen, Mantenimiento, Roles (migrados); Clínicas, Precios, Auditoría,
Sesiones, Estado del sistema, Tokens particulares admin, Subir informe (preservados).

## 9. Módulos que ya estaban correctos y se preservaron

`AdminClinicsManagementCard` (Master-Detail + Dialog, PAGE_SIZE=5),
`AdminPricingEditorCard` (ModuleTabs + usePagedRows ITEMS_PER_PAGE=1),
`AdminAuditLogTable` (usePagedRows PAGE_SIZE=8 + CompactPager),
`AdminSessionsReadOnlyCard` (+ ModuleDialog), `AdminParticularTokensCard`
(state machine + split), `healthWorkspaceSlot` (ModuleTabs) y el `perfil`
clínica (`ModuleTabs`). No se degradó ninguno.

## 10. Lista máxima visible por módulo

| Módulo | Máximo visible | Mecanismo |
|---|---|---|
| Operaciones clínica · informes recientes | 3 | datos ya acotados + tab [Recientes] |
| Operaciones clínica · visitas de campo | 3 | datos ya acotados + tab [Recientes] |
| Tokens clínica | 4 | `usePagedRows(4)` + `CompactPager` |
| Informes clínica (in-shell) | 3 (recientes) | lista acotada + deep-link a módulo completo |
| Logística clínica (in-shell) | 3 (recientes) | lista acotada + deep-link a módulo completo |
| Admin intentos fallidos | 5 / pág | paginación client/API existente (`PAGE_SIZE=5`) |
| Admin roles | 5 / pág | paginación client/API existente (`PAGE_SIZE=5`) |
| Admin mantenimiento dry-run | 4 / pág | `usePagedRows(4)` + `CompactPager` |

## 11. Comportamiento desktop

- **Tokens clínica:** split fijo `xl:grid-cols-[0.82fr_1.46fr]` (lista master a la
  izquierda, detalle a la derecha). Seleccionar un token llena el detalle sin
  cambiar la altura del card. Alta vía botón → `ModuleDialog` por pasos.
- **Informes/Logística:** split `xl:grid-cols-[0.85fr_1.15fr]` dentro de
  `ModuleSurface`; toolbar fijo con el deep-link al módulo completo.
- **Admin:** tabs conmutan contenido en el mismo viewport.

## 12. Comportamiento tablet/mobile

- Por debajo de `xl` los módulos master-detail usan **capa de reemplazo**: se ve la
  lista; al seleccionar, el detalle **reemplaza** la lista (`hidden xl:flex` /
  `hidden xl:block`) con botón **"Volver a la lista"**. No se apilan lista + detalle.
- El alta de Tokens vive en `ModuleDialog` con **3 pasos compactos** (Vínculo,
  Paciente, Muestra), sin scroll vertical interno del formulario y sin apilar bajo
  la lista.
- Se eliminaron los spacers `h-24 md:hidden` de clínica, admin y logística.

## 13. Resolución de formularios

El alta de Tokens clínica se movió de un bloque vertical permanente a un
**`ModuleDialog` por pasos** (capa dedicada). Preserva validaciones (`validateFormState`,
`required`, `parseOptionalReportId`), loading/error, submit/cancel y el invariante
"token completo visible una sola vez". El token generado también vive en una capa
dialog controlada y no empuja el card; el cierre exige confirmar que el token fue
registrado o que no se necesita copia.

## 14. Resolución de detalle

El detalle ya no se expande inline empujando la lista. Desktop: panel dedicado en
el split. Mobile: capa de reemplazo con "Volver". En Tokens el detalle muestra las
6 bandas (Paciente, Muestra, Fechas, Publicación, Vínculo, Seguimiento con alerta
de tinción especial) del token seleccionado, no por cada fila de la lista.

## 15. Tests agregados/modificados

- **Nuevo E2E:** `frontend/e2e/dashboard-global-masked-master-detail.spec.ts` —
  no-scroll de `main`/`body`/`html` para Tokens/Informes/Logística clínica y
  Resumen/Mantenimiento/Roles admin a 1366×768 y 390×844; Tokens clínica con
  mock de 6 registros para verificar lista visible ≤4, selección de detalle,
  alerta de tinción especial, volver mobile y pasos del `ModuleDialog`.
- **Source-contract alineados (sin bajar cobertura):** los contratos existentes
  `frontend-dashboard-clinic-tokens`, `frontend-dashboard-admin`,
  `frontend-dashboard-home`, `frontend-dashboard-clinic-command-center`,
  `frontend-admin-failed-login-alerts-card`,
  `frontend-admin-users-roles-card`,
  `frontend-admin-maintenance-dry-run-card`,
  `frontend-dashboard-mobile-polish-bottom-actions` y
  `progress-production-invariants` se alinearon al contrato nuevo.
- **E2E existentes alineados:** `dashboard-workspace-layout-polish.spec.ts`
  ahora valida las regiones reales del nuevo `/dashboard/informes`
  (`Lista de informes` + `Detalle del informe`).

## 16. Viewports cubiertos

- **Desktop:** 1366×768 (mínimo del producto).
- **Mobile:** 390×844 (viewport mobile estándar de la suite).

## 17. Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `pnpm --dir frontend lint` | ✓ OK |
| `pnpm --dir frontend typecheck` | ✓ OK |
| `pnpm test` (nativos) | ✓ OK — 2760/2760 |
| `pnpm --dir frontend build` | ✓ OK |
| `pnpm build` (backend) | ✓ OK |
| `pnpm security:public-surface` | ✓ PASS — sólo notas esperadas `server-only` para `CLINIC_SESSION_COOKIE_NAME` / `ADMIN_SESSION_COOKIE_NAME` |
| `pnpm --dir frontend e2e -- e2e/dashboard-global-masked-master-detail.spec.ts --reporter=line` | ✓ OK — 16/16 |
| `pnpm --dir frontend e2e -- e2e/dashboard-accessibility-keyboard.spec.ts e2e/dashboard-app-shell-visibility-contract.spec.ts e2e/dashboard-auth-redirect.spec.ts e2e/dashboard-card-navigation-shell.spec.ts e2e/dashboard-global-masked-master-detail.spec.ts e2e/dashboard-interaction-foundation.spec.ts e2e/dashboard-internal-no-scroll-contract.spec.ts e2e/dashboard-master-detail-state-polish.spec.ts e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts e2e/dashboard-single-viewport-app-shell.spec.ts e2e/dashboard-workspace-layout-polish.spec.ts --reporter=line` | ✓ OK — 172/172 |

## 18. Riesgos

- **Datos server-side de Informes/Logística:** el E2E del módulo in-shell cubre el
  frame no-scroll con los datos que entregue la app; la selección con datos reales
  queda reforzada por contratos de fuente. Tokens sí usa mock browser-side con 6
  registros porque su carga es client-side.
- **Sin cambios de API/seguridad:** el refactor es de composición/UI. No toca
  payloads, endpoints, separación de sesión (`app_session_id`/`admin_session_id`),
  ni el invariante "token visible una sola vez".
- **CSS compartido:** se mantiene el contrato PR-A/#1014 (`main.dashboard-main`
  sigue `overflow-hidden`, nunca `auto/scroll`). Se compactó sólo la densidad
  mobile del shell/hub (`dashboard-main`, hero y launcher denso admin) para que
  los hubs iniciales también quepan en 390×844, sin mover scroll a otro wrapper.

## 19. Resultado final

Ambos dashboards operan bajo el mismo modelo: pantalla fija, listas limitadas,
detalle por estado/panel/capa, formularios en capa dedicada y mobile por capas de
reemplazo. El peor ofensor (Tokens clínica) deja de apilar lista + detalle +
formulario; los módulos de Informes/Logística tienen master-detail in-shell; los
slots admin rezagados pasan a tabs/cadena de altura/listas acotadas. No se
reintrodujo scroll operativo, no se movió el scroll a otro wrapper, no se debilitó
el contrato de #1014 y no se bajaron tests.
