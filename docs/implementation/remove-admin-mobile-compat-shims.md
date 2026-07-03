# R-09 — Remove Admin mobile compat shims

Ref: `docs/audit/final-global-vetneb-50-60-pr-roadmap.md` (R-09).

## Objetivo

Eliminar los shims Admin mobile `return null` que quedaron muertos tras el
colapso server-adaptive de PR-SRV-1 (Sesiones) y PR-SRV-2 (Usuarios/Roles).

## Grep inicial

```
git grep -n "AdminMobileSessionsModule\|AdminMobileUsersModule" -- frontend/src/app/dashboard/admin test docs/implementation
```

Únicos shims reales detectados (`"use client"` + comentario de compat +
`export function ... { return null; }`, sin fetch, sin `MOBILE_PAGE_SIZE`,
sin `matchMedia`):

- `frontend/src/app/dashboard/admin/AdminMobileSessionsModule.tsx`
- `frontend/src/app/dashboard/admin/AdminMobileUsersModule.tsx`

## Shims eliminados

- `frontend/src/app/dashboard/admin/AdminMobileSessionsModule.tsx`
- `frontend/src/app/dashboard/admin/AdminMobileUsersModule.tsx`

## Referencias runtime/test actualizadas

`test/frontend-admin-sessions-read-only-card.test.ts` leía el archivo del
shim (`MOBILE_MODULE_PATH`) para verificar que no tenía fetch propio ni
`MOBILE_PAGE_SIZE`/`matchMedia`. Con el archivo eliminado, esa verificación
es redundante (el archivo ya no existe), así que se removió la constante
`MOBILE_MODULE_PATH` y las tres aserciones sobre `mobile`, conservando la
aserción sobre `AdminSessionsReadOnlyCard.tsx` (que ya no debe referenciar
`AdminMobileSessionsModule`).

No se encontraron referencias runtime a `AdminMobileUsersModule` en tests.

## Módulos mobile activos preservados (no tocados)

- `AdminMobileAuditModule.tsx` — presentacional activo, importado por
  `AdminAuditCard`.
- `AdminMobileCommandModule.tsx` — fuera de alcance de R-09 (no es shim
  `return null`; ya documentado en R-01/R-08).
- `AdminMobileHealthModule.tsx`
- `AdminMobileMaintenanceModule.tsx`
- `AdminMobilePricingModule.tsx`
- `AdminMobileStatusModule.tsx`
- `AdminMobileConfigModule.tsx`
- `AdminMobileOpsPager.tsx`

## Guard test agregado

`test/admin-mobile-compat-shims-removed.test.ts`:

- Falla si `AdminMobileSessionsModule.tsx` o `AdminMobileUsersModule.tsx`
  reaparecen en `frontend/src/app/dashboard/admin`.
- Falla si algún archivo de código (no test) bajo
  `frontend/src/app/dashboard/admin/**` vuelve a referenciar los símbolos
  `AdminMobileSessionsModule` o `AdminMobileUsersModule`.

## Menciones históricas conservadas (no modificadas)

Los siguientes docs de implementación previos mencionan los shims como
contexto histórico de PR-SRV-1/PR-SRV-2 y no se modifican (documentan el
estado del momento en que se escribieron, no el estado actual):

- `docs/implementation/admin-sessions-server-adaptive-pagination.md`
- `docs/implementation/admin-users-roles-server-adaptive-pagination.md`
- `docs/implementation/admin-failed-login-alerts-server-adaptive-pagination.md`
- `docs/implementation/server-adaptive-pagination-strategy.md`
- `docs/implementation/admin-audit-server-adaptive-pagination.md`

## Grep final

```
git grep -n "AdminMobileSessionsModule\|AdminMobileUsersModule" -- frontend/src/app/dashboard/admin test docs/implementation
```

Sin coincidencias en `frontend/src/app/dashboard/admin` ni en `test/`
(excepto el propio guard test, que referencia los nombres como strings a
bloquear). Las menciones restantes están todas en docs históricos listados
arriba.

```
git grep -n "return null" -- frontend/src/app/dashboard/admin test docs/implementation
```

Todas las coincidencias restantes son código/tests legítimos no relacionados
con estos dos shims (early-returns condicionales en componentes activos,
mocks de test, docs históricos que narran el estado pasado).

## Validaciones

- `pnpm test`
- `pnpm typecheck:test`
- `pnpm typecheck`
- `pnpm --dir frontend lint`
- `pnpm --dir frontend build`

## Confirmaciones

- Sin cambio de comportamiento: los dos archivos eliminados ya retornaban
  `null` sin fetch, sin listeners y sin registrar ningún dato de UI; ningún
  import runtime activo los referenciaba.
- No se modificaron módulos mobile activos ni ningún componente
  presentacional.
- No se tocó backend/API/auth/DB/server, migrations, CI/workflows,
  deps/lockfiles, snapshots, `globals.css`, Clínica, Particular ni Público.
- No se avanzó alcance de R-10.
