# PR-7A — Admin Usuarios y Roles con densidad enterprise

## Objetivo

Convertir Usuarios y Roles del Dashboard Administración en una consola compacta,
sobria y segura, manteniendo el contrato funcional existente y el App Shell sin
scroll global.

## Superficie real y frontera de alcance

- Identificador real de navegación: `admin-users-roles`.
- Superficie frontend: `AdminUsersRolesReadOnlyCard` dentro de
  `/dashboard/admin?module=admin-users-roles`.
- La navegación horizontal conserva la etiqueta `Usuarios`.
- PR-7A incluye exclusivamente lectura de usuarios administrativos y de clínica,
  filtros existentes y cambio de rol de usuarios de clínica.
- Sesiones, revocación, dispositivos y datos de sesión quedan fuera de alcance y
  se reservan para PR-7B.

## Estado previo detectado

La superficie ya consumía `GET /api/admin/users-roles` con filtros `userType` y
`role`, además de `limit/offset`. Usaba paginación server-side de cinco filas,
cinco bloques altos para métricas y filtros, una tabla espaciosa y botones de
cambio de rol que elevaban la altura de cada fila. El cambio de rol ya requería
confirmación y utilizaba el contrato backend auditado existente.

No se detectó carga masiva ni N+1: cada página requiere una consulta y cada cambio
de rol una mutación puntual. Tampoco existe búsqueda textual server-side en el
contrato actual.

## Implementación

- Page size final: `9`, server-side mediante `limit/offset`.
- Header de 48 px aproximados, acción secundaria de 32 px y subtítulo breve.
- Franja única de tres métricas con valores de 20 px.
- Filtros de tipo y rol en una barra compacta; no se agregaron filtros sin dato.
- Tabla desktop con header de 32 px y filas de 36 px.
- Lista mobile priorizada con usuario, rol, clínica e identificación secundaria.
- Paginación compacta con rango, página actual y controles anterior/siguiente.
- IDs internos permanecen como metadata secundaria; no son contenido principal.
- No se muestran emails porque el contrato no los entrega ni eran necesarios.
- Se mantienen usuario, tipo, rol, clínica, alta y actualización, que son los
  únicos datos reales disponibles para esta superficie.

## Seguridad y trazabilidad

- Los usuarios admin continúan sin ser editables desde esta consola.
- Solo los dos roles de clínica existentes pueden alternarse.
- Cada cambio conserva confirmación explícita, bloqueo durante la mutación,
  protección contra degradar al último Owner y feedback controlado.
- El contrato backend existente registra `clinic_user.role.changed`; PR-7A no
  modifica autorización, validación ni auditoría.
- No se muestran ni trasladan passwords, hashes, tokens, cookies, session IDs o
  datos de sesión.
- No se agregan logs de consola, HTML inseguro, fetch público ni endpoint nuevo.

## No-scroll y responsive

`dashboard-main` conserva `overflow-hidden`. La tabla no agrega scroll vertical
regional ni `data-dashboard-scroll-region`; nueve filas densas caben en el
viewport de referencia 1366×768. Desktop usa tabla ajustada, mientras mobile usa
una lista priorizada para evitar una tabla horizontal ilegible.

## Archivos modificados

- `frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx`
- `frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx`
- `test/frontend-admin-users-roles-card.test.ts`
- `test/frontend-dashboard-tables-cards-consistency-polish.test.ts`
- `test/admin-users-roles-enterprise-density.test.ts`
- `docs/implementation/admin-users-roles-enterprise-density.md`

## Tests y validaciones

- Tests focalizados de Usuarios/Roles y regresión PR-2 a PR-6: 99/99.
- `pnpm --dir frontend lint`: OK.
- `pnpm --dir frontend typecheck`: OK.
- `pnpm --dir frontend build`: OK.
- `pnpm test`: 2799/2799.
- `dashboard-real-app-shell-no-scroll-contract.spec.ts` en Chromium: 28/28
  para 1440×900 y 1366×768.
- No existe E2E específico para `admin-users-roles`; el E2E ejecutado cubre el
  contrato global real del App Shell, y los contratos estáticos focalizados
  cubren esta superficie.

## Deuda técnica y riesgos residuales

- El backend no ofrece búsqueda textual, estado ni última actividad para esta
  superficie; no se implementa filtrado client-side parcial ni se inventan datos.
- No existe selector 25/50/100 porque el contrato de scroll regional se difiere.
- La confirmación sensible continúa usando el diálogo nativo existente; un
  diálogo de producto exigiría una modificación funcional adicional.
- La semántica histórica del componente conserva `ReadOnlyCard`, aunque permite
  la mutación de rol ya existente; se mantiene para evitar renombrados amplios.

## No alcance y próximos PRs

No se modifica Dashboard Clínica, Sesiones, auth, login, cookies, backend, base
de datos, migraciones, dependencias, web pública, Tokens, Clínicas, Resumen,
Informes, Auditoría ni ramas Dependabot. PR-7B podrá abordar Sesiones de forma
independiente.
