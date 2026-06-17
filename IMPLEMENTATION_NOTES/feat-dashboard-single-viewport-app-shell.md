# feat(dashboard): convert workspace to single-viewport app shell

Rama: `feat/dashboard-single-viewport-app-shell` · Base: `009254e` (#1008)
Alcance: **solo frontend + tests + docs**. Cero backend / DB / migrations / auth / contratos API.
**Cero dependencias nuevas.**

---

## Diagnóstico exacto

El problema no era estético sino arquitectónico: el contenido de cada módulo se renderizaba
dentro de `DashboardModuleWorkspace` cuyo área de contenido usaba `overflow-y-auto` —
**scroll interno delegado**— y los módulos eran "páginas largas" sin presupuesto de altura.

### Por qué #1007 no alcanzaba
Mejora visual (hero, cards, gradientes) que mantuvo el patrón de página larga y el scroll del
contenedor. No transformó el modelo de uso.

### Por qué #1008 no alcanzaba
Introdujo el cockpit no-scroll **solo en el hub** (`DashboardModuleHub` → `.dashboard-cockpit`).
Funcionaba en la antesala de selección, pero al **abrir un módulo** el contenido volvía a
scrollear (`DashboardModuleWorkspace` content `overflow-y-auto` + módulos largos: command center,
audit-log con tabla completa, clínicas `PAGE_SIZE=50`, precios con todos los ítems apilados,
sesiones `PAGE_SIZE=25`). La operación real seguía siendo un dashboard convencional.

---

## Arquitectura implementada

Cadena de altura determinística (App Shell), reutilizando el shell raíz ya correcto
(`DashboardShellRouter`: `flex h-dvh overflow-hidden`):

```
shell (h-dvh overflow-hidden)
 └ columna principal (flex-1 min-w-0 overflow-hidden)
    └ main.dashboard-main (flex min-h-0 flex-1 overflow-y-auto*)   *propiedad conservada por contrato; sin overflow efectivo
       └ Controller
          ├ HUB: {pageHeader} + DashboardModuleHub (cockpit, fila lg flex-1)
          └ MÓDULO: DashboardModuleWorkspace
                     ├ header (Volver + título)
                     └ viewport (flex min-h-0 flex-1, SIN scroll)  ← antes overflow-y-auto
                        └ ModuleSurface / ModuleTabs / tabla paginada
```

Cambios estructurales clave:
1. **`DashboardModuleWorkspace`**: el área de contenido pasó de `overflow-y-auto pt-4` a
   `flex min-h-0 min-w-0 flex-1 flex-col pt-4` con `data-dashboard-module-viewport`. **Se eliminó
   el scroll interno delegado** (raíz del problema).
2. **Recuperación de altura**: `DashboardPageHeader` se pasa como prop `pageHeader` al controller
   y se renderiza **solo en el hub**; en módulo se oculta y se recuperan ~90px.

### Componentes agregados (zero deps)
- `frontend/src/components/dashboard/ModuleSurface.tsx` — frame de módulo (toolbar fija + body
  `flex-1 min-h-0`).
- `frontend/src/components/dashboard/ModuleTabs.tsx` — segmented control accesible
  (`role=tablist/tab/tabpanel`, teclado) con panel activo `flex-1 min-h-0`; solo monta el panel
  activo (aislamiento).
- `frontend/src/components/dashboard/usePagedRows.ts` — hook de paginación cliente sobre arrays.
- `frontend/src/components/dashboard/CompactPager.tsx` — barra de paginación compacta (aria-live).
- `frontend/src/components/dashboard/ModuleDialog.tsx` — dialog compacto (radix-dialog ya
  presente) para formularios, capado a `max-h-[88vh]`, sin scroll operativo.
- `frontend/src/app/dashboard/admin/AdminAuditLogTable.tsx` — tabla de auditoría paginada
  (recibe filas **pre-sanitizadas** desde el server component).

### Archivos modificados
- `globals.css` — nueva sección `dashboard-single-viewport-app-shell` (clases de surface/tabs/pager).
- `DashboardModuleWorkspace.tsx`, `ClinicDashboardWorkspaceController.tsx`,
  `AdminDashboardWorkspaceController.tsx` (prop `pageHeader`).
- `app/dashboard/page.tsx`, `app/dashboard/admin/page.tsx` (header como prop; auditoría con tabs;
  sesiones con tabs; perfil con tabs; rows de auditoría pre-formateadas).
- `ClinicCommandCenter.tsx` (root flex column compacto).
- `AdminClinicsManagementCard.tsx` (alta en `ModuleDialog`, `PAGE_SIZE` 50→8).
- `AdminPricingEditorCard.tsx` (tabs por categoría + paginación por categoría, `ITEMS_PER_PAGE=2`).
- `AdminSessionsReadOnlyCard.tsx` (`PAGE_SIZE` 25→8).

---

## Módulos realmente rediseñados (vista única)

| Módulo | Técnica no-scroll |
|---|---|
| Clínica hub | cockpit (ya) + header reclaim |
| Clínica operaciones | flex column compacto, listas top-3 |
| Clínica informes / logística | resumen compacto (1 card + CTA) |
| Clínica perfil | **tabs** (Acceso / Perfil público) |
| Admin hub | cockpit (ya) + header reclaim |
| Admin clínicas | alta → **dialog**, tabla **paginada (8)** + drawer detalle |
| Admin auditoría | **tabs** (Resumen / Registro) + tabla **paginada (8)** |
| Admin precios | **tabs por categoría** + **paginación** (form por ítem preservado) |
| Admin sesiones | **tabs** (Acceso / Sesiones), tabla `PAGE_SIZE=8` |

---

## Reglas de no-scroll absoluto y cómo se evita ocultar funcionalidad

- Desktop: ningún `overflow-y-auto/scroll` operativo en módulos; el body del módulo es
  `flex-1 min-h-0` y el contenido se **acota** (paginación / tabs / dialog), **nunca se recorta**.
- Tablas/listas largas → paginación real (todas las filas siguen accesibles vía pager).
- Formularios largos → dialog (alta de clínica) o tabs (perfil/sesiones).
- Multi-sección → tabs (auditoría, precios por categoría).
- `.dashboard-main` conserva `overflow-y: auto` solo por compatibilidad con el test legacy
  ("main content area is scroll container"); la métrica real verificada es
  `scrollHeight ≤ clientHeight`.
- Deep links preservados (`?module=…`, y filtros de auditoría `event`/`actorType`).
- `PasswordChangePanel` preservado (clínica perfil + admin sesiones), visible primero.
- Tema dark-gray, accesibilidad (roles tab/dialog, aria-label, focus ring) preservados.

---

## Tests nuevos / actualizados

- **Nuevo**: `frontend/e2e/dashboard-single-viewport-app-shell.spec.ts` — 9 rutas × 2 viewports
  (1440×900 y 1366×768) = **18 escenarios**. Verifica:
  - `documentElement`/`body` `scrollHeight ≤ clientHeight + 2` y `scrollWidth ≤ clientWidth + 2`.
  - `main.dashboard-main` `scrollHeight ≤ clientHeight + 2` (sin overflow efectivo).
- **Actualizados en el PR** (alineación de contratos source-level a la nueva arquitectura,
  preservando invariantes de seguridad/scope): `frontend-admin-sessions-card`,
  `admin-dashboard-sections-contract`, `frontend-admin-metadata-guard`,
  `frontend-dashboard-admin`, `frontend-dashboard-admin-command-center`,
  `frontend-dashboard-admin-section-tabs`, `frontend-dashboard-home`,
  `frontend-visual-consistency`.
  - La **redacción de metadatos sensibles** de auditoría (`SENSITIVE_AUDIT_METADATA_KEY_PARTS`,
    `isSensitiveAuditMetadataKey`, `getAuditMetadataSummary`) permanece en `page.tsx`: el detalle
    se pre-sanitiza en el server y el componente cliente solo recibe strings seguros.

---

## Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `pnpm --dir frontend typecheck` | ✅ |
| `pnpm --dir frontend lint` | ✅ |
| `pnpm --dir frontend build` | ✅ |
| `pnpm test` | ✅ 2758/2758 |
| `pnpm security:public-surface` | ✅ (solo hallazgos server-only preexistentes) |
| `pnpm --dir frontend e2e` (3 specs) | ✅ 91/91 |
| `git diff --check` | ✅ sin errores |

`frontend/next-env.d.ts` fue regenerado por el dev server de e2e y **revertido**
(`git checkout -- frontend/next-env.d.ts`).

---

## Dependencias

**Cero dependencias nuevas.** Se reutilizan `@radix-ui/react-dialog` (ya presente) para
`ModuleDialog` y primitivas nativas para tabs/paginación. `package.json` y
`frontend/package.json` sin cambios (verificado por guards de scope/no-deps en la suite).

---

## Riesgos remanentes

- **Densidad bajo datos reales**: los viewports de e2e corren sin backend
  (`NEXT_PUBLIC_API_URL=""`), por lo que validan el frame en estado vacío. Con datos reales el
  no-scroll se sostiene por la paginación (clínicas/sesiones/auditoría `8/pág`, precios `2/ítems
  por pág + tabs por categoría`). En `1366×768` con filas muy densas, conviene auditar
  visualmente; si hiciera falta, bajar page sizes es un cambio de una línea.
- **Precios**: el contrato source-level exige el "form manual por ítem"; se respetó y se acotó con
  tabs + paginación. La densidad por página es baja (2) por diseño del form; un follow-up podría
  introducir edición por dialog para mayor densidad.
- **Módulos admin no prioritarios** (estado del sistema, mantenimiento, tokens, roles, subir
  informe): ya no tienen scroll delegado (frame corregido) y se muestran en el viewport; con datos
  extensos `admin-health` (grid de 9 tiles) podría requerir tabs en un follow-up. No están en el
  set de contrato E2E de este PR.
- **Tokens clínica / Perfil público (tab)**: formularios extensos; el tab por defecto (Acceso)
  entra; el panel de formulario largo podría requerir wizard en follow-up. No están en el set E2E.

---

## Rollback

Cambios 100% frontend + tests + docs, sin migrations ni contratos. Rollback = revertir el merge
del PR. No requiere acciones en backend/DB/Render.

---

## Comandos sugeridos para Nico

```powershell
cd C:\PORTAL-VETNEB
git add -A
git status
git commit -m "feat(dashboard): convert workspace to single-viewport app shell"
git push -u origin feat/dashboard-single-viewport-app-shell
gh pr create --fill
gh pr checks --watch
```
