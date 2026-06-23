# VETNEB — Fix: Auditoría mobile con fetch propio sanitizado, 10/página

Módulo 3 de 7 del bloque "Admin Mobile Refinement". Cada módulo se entrega
como rama/PR independiente (precedente #1077→#1081; módulos 1-Hub y
2-Clínicas en `fix/admin-mobile-hub-card-density` y
`fix/admin-mobile-clinics-density`).

---

## 1. Rama y base

- Rama: `fix/admin-mobile-audit-density` (worktree aislado desde `main`
  limpio, mismo motivo que Clínicas: no mezclar diffs sin commitear de
  módulos previos).
- HEAD base: `aa6bea6 fix(admin): align mobile core pager to canonical
  tokens layout (#1081)`.

## 2. Alcance

Mobile de `AdminMobileAuditModule` (Auditoría, Dashboard Administrador):

1. 10 registros por página en mobile (antes: 3, derivados localmente de la
   página desktop de 9).
2. Por registro: `Admin` si el actor es administración, nombre de clínica
   (best-effort) si el actor es clínica.
3. Mantener el botón `Ver` (vía `AdminAuditDetailDialog`).
4. Mantener el paginador canónico abajo.
5. No perder datos críticos del registro (entidad, fecha, detalle siguen
   presentes).
6. No tocar el filtro salvo preservación mínima (sigue siendo el mismo
   `AdminAuditFilterBar`, mismos campos, misma navegación por URL).

## 3. No alcance

Backend (Fastify), endpoints nuevos, DB, auth, dependencias, lockfiles, CI,
rutas públicas, producción, dashboard Clínica, desktop (tabla y paginación
de `AdminAuditCard`/`AdminAuditDenseTable` sin cambios), Hub, Clínicas,
Alertas, Informes, Tokens, Sesiones (cada uno su propio PR).

## 4. Diagnóstico previo y dos bloqueos reales encontrados

### 4.1 Boundary de seguridad (resuelto con Server Action)

`page.tsx` (línea ~528, comentario explícito) sólo deja cruzar al cliente
un `AdminAuditRow[]` ya sanitizado — nunca el `AdminAuditEntry` crudo
(`ipAddress`, `userAgent`, `requestPath`, `metadata` completo). La
arquitectura previa de `AdminMobileAuditModule` reaprovechaba ese
`AdminAuditRow[]` ya sanitizado, pero **server-rendereado para desktop**
(`ADMIN_AUDIT_PAGE_SIZE = 9`), re-paginándolo localmente en mobile en
bloques de 3 — nunca pedía una página mobile propia de 10.

Hacer que mobile pida su propia página de 10 sin romper ese boundary
requería evitar un `fetch` cliente directo a `getAuditEntries` (que
devuelve el `AdminAuditEntry` crudo). Se resolvió con una **Server Action**
de Next.js (`"use server"`) que corre en el servidor, llama al mismo
`getAuditEntries` ya existente, sanitiza igual que `page.tsx` y devuelve
sólo `AdminAuditRow[]` al cliente. No se tocó el backend Fastify ni se
agregó ningún endpoint nuevo.

### 4.2 Sin campo confiable actor→clínica (mitigado, documentado)

`AdminAuditEntry` no tiene un campo que vincule de forma confiable un actor
`clinic_user` a su clínica: `actorClinicUserId` es el id del *usuario* de
clínica, no el id de la clínica. El único campo de clínica en la entrada es
`clinicId`, un campo de contexto genérico ya usado hoy por
`getAuditEntity` para la columna "Entidad" — para algunos tipos de evento
podría ser una clínica relacionada/target, no estrictamente la que actuó.

Decisión (confirmada con Nico): reutilizar ese mismo `clinicId` como
aproximación best-effort para resolver el nombre de clínica en mobile, sin
tocar backend. Si no hay nombre resuelto, se degrada a `Clínica #id` (nunca
se pierde el registro). Riesgo documentado en §10.

## 5. Archivos modificados/creados

| Archivo | Cambio |
|---|---|
| `frontend/src/app/dashboard/admin/admin-audit-shared.ts` | **Nuevo.** Extrae de `page.tsx` (sin cambiar comportamiento) `EVENT_LABELS`, `ACTOR_LABELS`, `getEventVariant`, `getAuditMetadataSummary` (+ sus helpers privados de sanitización de metadata), `formatAuditDate`, `getAuditActor`, `getAuditEntity`. Single source of truth para desktop y para la nueva Server Action. |
| `frontend/src/app/dashboard/admin/admin-audit-mobile.actions.ts` | **Nuevo.** Server Action `getAdminMobileAuditPage(query)`: reenvía cookies (`cookies()` de `next/headers`), llama `getAuditEntries` con `limit/offset` propios de mobile, resuelve nombre de clínica best-effort vía `getAdminClinics` (loop paginado, sólo si hay algún actor `clinic_user` con `clinicId` en la página — evita el round-trip si no aplica), y devuelve únicamente `AdminAuditRow[]` + `total` + `loadError`. La resolución de nombre de clínica está en su propio `try/catch` independiente — si falla, degrada a `Clínica #id` sin tirar abajo el resto de la página (bug real encontrado y corregido durante el TDD, ver §9). |
| `frontend/src/app/dashboard/admin/AdminMobileAuditModule.tsx` | Reescrito: de componente prop-driven (recibía `rows`/`totalCount`/`serverPage`/`serverPageSize` ya armados por `page.tsx`) a componente que hace su propio fetch vía la Server Action, con `MOBILE_PAGE_SIZE = 10` y paginación por `offset` propia (independiente de la paginación desktop de 9). Lista de `grid-rows-3` con `border-b` por fila → lista compacta `divide-y` (mismo patrón que Tokens/Clínicas) para que 10 filas entren sin scroll. |
| `frontend/src/app/dashboard/admin/AdminAuditCard.tsx` | Deja de pasarle a `AdminMobileAuditModule` los props que ya no usa (`rows`, `totalCount`, `serverPage`, `serverPageSize`, `loadError`) — el componente ahora obtiene sus propios datos. Sección desktop (tabla, footer, `ADMIN_AUDIT_PAGE_SIZE`) sin cambios. |
| `frontend/src/app/dashboard/admin/page.tsx` | Importa de `admin-audit-shared.ts` en vez de definir localmente `EVENT_LABELS`/`ACTOR_LABELS`/`getEventVariant`/metadata helpers/`formatAuditDate`/`getAuditActor`/`getAuditEntity`. Comportamiento de desktop idéntico (mismas funciones, mismo código, sólo reubicado). |
| `frontend/e2e/fixtures/admin-populated-api-server.mjs` | `AUDIT_EVENTS` 9→13 entradas (4 nuevas, variadas en `actorType`/`event`) para que la paginación 10/página mobile tenga una página 2 real con contenido distinto. |
| `frontend/e2e/admin-mobile-ops-modules-no-scroll.spec.ts` | `OPS_MODULES` ganó `maxItemsPerPage` por módulo (audit:10, sessions:4, users:4) en vez de un cap fijo `<=4` compartido; sólo `audit` cambia de valor en este PR. |

No se crearon archivos de test nuevos: se reforzó/ajustó el contrato
compartido más cercano (`admin-mobile-ops-modules-no-scroll.spec.ts`) y el
fixture que ambos módulos comparten.

## 6. Decisiones técnicas

1. **Server Action en vez de endpoint nuevo o de subir el page size
   compartido**: confirmado con Nico tras detectar el boundary de
   seguridad. Cero cambios en el backend Fastify; la sanitización ocurre en
   el mismo proceso Node del frontend, reutilizando exactamente la misma
   lógica que ya usa `page.tsx` (extraída a `admin-audit-shared.ts`, no
   duplicada).
2. **Resolución de nombre de clínica con `clinicId` existente, no con
   nueva semántica de backend**: confirmado con Nico tras detectar que no
   hay campo confiable actor→clínica sin tocar backend. Se documenta el
   riesgo (§10) en vez de inventar un join que no se puede verificar desde
   el frontend.
3. **Lookup de nombre de clínica sólo si hace falta**: `buildClinicNameMap`
   sólo se ejecuta si la página de 10 registros tiene al menos un actor
   `clinic_user` con `clinicId`; evita el round-trip a `/api/admin/clinics`
   en páginas que sólo tienen actores `Admin`/`Sistema`.
4. **Fallo de la resolución de clínica no debe tirar la página**: aislado en
   su propio `try/catch` (ver bug real en §9) — un error ahí degrada a
   `Clínica #id`, nunca a "No se pudieron cargar los eventos."
5. **Lista compacta `divide-y`** (mismo patrón Tokens/Clínicas) para
   alcanzar 10 filas sin scroll, en vez de `grid-rows-3` fijo.

## 7. Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `pnpm --dir frontend lint` | OK (sin salida) |
| `pnpm --dir frontend typecheck` | OK |
| `pnpm --dir frontend build` | OK (`next build` exitoso, 25 rutas) |
| `npx playwright test e2e/admin-mobile-ops-modules-no-scroll.spec.ts` | **GREEN 12/12** (audit/sessions/users mobile + desktop) |
| `npx playwright test e2e/admin-mobile-final-polish-no-scroll.spec.ts e2e/admin-mobile-module-layer-isolation.spec.ts e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts e2e/dashboard-card-navigation-shell.spec.ts e2e/admin-mobile-hub-launcher-no-scroll.spec.ts` | **GREEN 121/121** (regresión chrome mobile, aislamiento de capas, contrato no-scroll real con datos poblados, navegación del hub) |

`pnpm test` (root, suite backend) no se ejecutó: este PR no toca backend ni
archivos bajo `test/`.

> Nota operativa: `frontend/next-env.d.ts` no quedó modificado tras correr
> Playwright/build en este worktree; se verificó explícitamente.

## 8. Resultado de tests (TDD)

- **RED inicial (esperado por diseño):** el contrato compartido
  `admin-mobile-ops-modules-no-scroll.spec.ts` fallaba con `itemCount<=4`
  contra el nuevo código (10 filas) — se actualizó a un cap por módulo en
  el mismo PR.
- **RED real (bug encontrado, no de test):** al ejecutar el spec contra la
  implementación nueva, Auditoría mobile mostraba "No se pudieron cargar
  los eventos." en los 3 viewports, pese a que el fixture sí tiene los 13
  eventos. Diagnóstico con logging temporal: la causa raíz era que
  `buildClinicNameMap` (llamado porque un evento del fixture tiene
  `actorType: "clinic_user"`) llamaba a `/api/admin/clinics`, ruta que el
  fixture de e2e no implementa (`404 E2E fixture route not found`), y el
  `try/catch` envolvía tanto el fetch de auditoría como el de clínicas —
  un 404 en la resolución de nombre tiraba abajo toda la página. Fix:
  aislar `buildClinicNameMap` en su propio `.catch()` que degrada a un
  mapa vacío (→ `Clínica #id`) sin afectar `getAuditEntries`.
- **GREEN:** 12/12 en el contrato de ops, 121/121 en la regresión amplia
  (incluye el contrato real de no-scroll con datos poblados a 1366×768/
  1440×900 y el flujo de filtros con teclado).

## 9. `git status --short --untracked-files=all`

```
 M frontend/e2e/admin-mobile-ops-modules-no-scroll.spec.ts
 M frontend/e2e/fixtures/admin-populated-api-server.mjs
 M frontend/src/app/dashboard/admin/AdminAuditCard.tsx
 M frontend/src/app/dashboard/admin/AdminMobileAuditModule.tsx
 M frontend/src/app/dashboard/admin/page.tsx
?? frontend/src/app/dashboard/admin/admin-audit-mobile.actions.ts
?? frontend/src/app/dashboard/admin/admin-audit-shared.ts
?? docs/audit/admin-mobile-audit-density-own-fetch.md
```

## 10. Confirmación explícita

- **10 registros por página en mobile:** confirmado (`MOBILE_PAGE_SIZE =
  10`, e2e con dataset de 13 muestra página 1 con 10 y página 2 con 3).
- **`Admin` o nombre de clínica según corresponda:** confirmado para
  `admin_user` (siempre "Admin"). Para `clinic_user`, nombre resuelto
  best-effort vía `clinicId` — **riesgo residual**: ese campo no está
  garantizado como "la clínica que actuó" para todos los tipos de evento
  (ver §4.2); cuando no resuelve, muestra `Clínica #id` (no se pierde el
  dato, sólo el nombre amigable).
- **Botón `Ver` preservado:** confirmado (`AdminAuditDetailDialog`, sin
  cambios en el componente).
- **Paginador canónico abajo:** confirmado (`AdminMobileOpsPager`, mismo
  componente, sin cambios).
- **No se pierden datos críticos del registro:** confirmado (`entity` vía
  `getAuditEntity` completo, `detail` vía `getAuditMetadataSummary`
  completo, `date` completo — sólo `actor` cambió su formato en mobile).
- **Filtro preservado:** confirmado (`AdminAuditFilterBar` sin cambios;
  hidratación con teclado verificada en e2e).
- **Sin scroll global / interno / `overflow:auto`/`scroll` agregado:**
  confirmado (contrato compartido de ops sigue verde; `git diff` no agrega
  overflow nuevo).
- **Appbar / bottom nav preservados:** confirmado (specs de chrome mobile
  compartidos siguen verdes).
- **#1074 / #1076 preservados:** no tocados.
- **Backend/API/DB/auth/dependencias/lockfiles/CI/dashboard Clínica/otros
  módulos admin:** no tocados — el único archivo de infraestructura de
  test modificado es el fixture de e2e (`admin-populated-api-server.mjs`,
  un servidor HTTP local sólo para Playwright, no backend real).

## 11. Riesgo residual

1. **Nombre de clínica aproximado** (§4.2): para eventos donde `clinicId`
   no representa la clínica del actor `clinic_user` (si existieran),
   mobile mostraría el nombre de una clínica relacionada en vez de la que
   realmente actuó. No se pudo verificar sin acceso al esquema/llamadas de
   backend que generan cada tipo de evento. Sugerido: confirmar con el
   equipo de backend qué eventos garantizan `clinicId === clínica del
   actor` antes de extender este patrón a otros módulos.
2. **Server Action añade una capa nueva** (antes: paso de props server→
   client en el mismo render; ahora: round-trip cliente→servidor por cada
   cambio de página mobile). Costo aceptado a cambio de no romper el
   boundary de seguridad de datos sensibles de auditoría.
3. **Lookup de clínicas no cacheado entre páginas**: cada cambio de página
   mobile que incluya actores `clinic_user` repite el loop de
   `getAdminClinics`. Igual al patrón ya existente en Tokens (recarga en
   cada apertura del diálogo de creación); aceptado por consistencia, no
   se optimizó con cache para mantener el diff mínimo.

---

### Cierre / Git manual (protocolo VETNEB)

Implementación, tests y validaciones completas. Según el protocolo, **Git
lo ejecuta Nico**. Este PR vive en un worktree separado
(`C:\PORTAL-VETNEB-audit`). Comandos a ejecutar **desde
`C:\PORTAL-VETNEB-audit`**:

```powershell
cd C:\PORTAL-VETNEB-audit
git add frontend/src/app/dashboard/admin/admin-audit-shared.ts `
        frontend/src/app/dashboard/admin/admin-audit-mobile.actions.ts `
        frontend/src/app/dashboard/admin/AdminMobileAuditModule.tsx `
        frontend/src/app/dashboard/admin/AdminAuditCard.tsx `
        frontend/src/app/dashboard/admin/page.tsx `
        frontend/e2e/admin-mobile-ops-modules-no-scroll.spec.ts `
        frontend/e2e/fixtures/admin-populated-api-server.mjs `
        docs/audit/admin-mobile-audit-density-own-fetch.md
git status --short --untracked-files=all
git commit -m "fix(admin): give mobile audit its own sanitized 10-per-page fetch"
git push -u origin fix/admin-mobile-audit-density
gh pr create --base main --head fix/admin-mobile-audit-density --title "fix(admin): give mobile audit its own sanitized 10-per-page fetch" --body "## Summary
- Admin mobile Auditoría now fetches its own 10-record pages via a Next.js Server Action, instead of re-slicing the desktop's 9-row SSR page locally in chunks of 3
- The Server Action reuses the same sanitization logic as the desktop page (extracted to admin-audit-shared.ts) — raw audit entries (ipAddress, userAgent, metadata) never cross to the client
- Each record shows 'Admin' or a best-effort clinic name (via the existing clinicId context field) instead of a generic 'Clínica #id'

## Scope
- Admin Dashboard mobile Auditoría module only (3 of 7 in the mobile refinement block)

## Not touched
- Backend (Fastify), new endpoints, DB, auth, dependencies, lockfiles, CI, public routes, production, Clínica dashboard, desktop audit table/pagination, other admin modules

## Known limitation
- Clinic name resolution uses the audit entry's generic clinicId field, which is not guaranteed to be the acting clinic for every event type (no reliable actor-to-clinic field exists without a backend change). Falls back to 'Clínica #id' when unresolved — no data is lost.

## Validation
- pnpm --dir frontend lint
- pnpm --dir frontend typecheck
- pnpm --dir frontend build
- playwright admin-mobile-ops-modules-no-scroll.spec.ts (12/12)
- playwright admin-mobile-final-polish-no-scroll.spec.ts + admin-mobile-module-layer-isolation.spec.ts + dashboard-real-app-shell-no-scroll-contract.spec.ts + dashboard-card-navigation-shell.spec.ts + admin-mobile-hub-launcher-no-scroll.spec.ts (121/121 regression)"
gh pr checks --watch

# Tras mergear los PRs anteriores, eliminar este worktree:
cd C:\PORTAL-VETNEB
git worktree remove ../PORTAL-VETNEB-audit
```

## Nota de CI manual

- Backend CI falló porque contratos root antiguos seguían buscando helpers de auditoría directamente en page.tsx.
- El PR extrajo la lógica segura a dmin-audit-shared.ts; se actualizaron los tests para validar el archivo compartido y mantener integración desde page.tsx.
- Frontend CI falló en la navegación mobile al módulo dmin-sessions; se reforzó el click de destinos fijos del bottom nav para persistir/sincronizar el módulo activo sin relajar el test.
- No se tocó backend, API, DB, auth, dependencias, lockfiles ni CI.

## Nota adicional Frontend CI

- En CI la navegación mobile hacia dmin-sessions podía quedar en carrera al depender únicamente del link del bottom nav.
- Se endureció el click de destinos fijos del bottom nav usando outer.push() explícito, preventDefault(), persistencia del módulo y sincronización visual local.
- El objetivo sigue siendo corregir navegación real, no relajar el e2e.
