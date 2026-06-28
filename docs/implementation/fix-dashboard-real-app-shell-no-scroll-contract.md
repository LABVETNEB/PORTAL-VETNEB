# fix(dashboard): enforce real app shell no-scroll contract

## Contexto

El PR #1009 dejó primitivas de App Shell y CI verde, pero no alcanzó para el navegador real porque varias pruebas corrían con módulos vacíos o poco densos. El caso reportado por Nico fue `/dashboard/admin?module=admin-sessions` en `1366x768`, con un excedente aproximado de `+47px`. La causa visual principal era altura fija acumulada: `dashboard-filter-stats-grid` con celdas `surface-soft` de alrededor de `94px`, `PAGE_SIZE = 8`, tabla de 7 columnas, header/card padding y un segundo panel de acceso en la misma superficie.

Durante el endurecimiento del contrato aparecieron otros fallos reales no cubiertos por los specs previos:

- `/dashboard?module=perfil` en `1366x768` excedía `+6px` en el workspace por el padding del `PasswordChangePanel`.
- El tab interno `Perfil público` dentro de `/dashboard?module=perfil` excedía `+724px` en workspace al renderizar el formulario completo de perfil.

## Rutas verificadas

- `/dashboard`
- `/dashboard?module=operaciones`
- `/dashboard?module=informes`
- `/dashboard?module=logistica`
- `/dashboard?module=perfil`
- `/dashboard/admin`
- `/dashboard/admin?module=admin-clinics`
- `/dashboard/admin?module=audit-log`
- `/dashboard/admin?module=admin-pricing`
- `/dashboard/admin?module=admin-sessions`
- `/dashboard/admin?module=admin-health`
- `/dashboard/admin?module=maintenance`
- `/dashboard/admin?module=admin-upload-report`

Viewports: `1440x900` y `1366x768`.

## Mediciones

Antes:

- `admin-sessions` `1366x768`: reportado en navegador real como `+47px`; contenedor causante: card de sesiones, especialmente `dashboard-filter-stats-grid` + `surface-soft` + tabla de 8 filas.
- `perfil` `1366x768`: reproducido por el nuevo contrato con workspace `scrollHeight=611`, `clientHeight=603`, excedente efectivo `+6px`.
- `perfil` tab `Perfil público` `1366x768`: reproducido con mock de perfil público denso, `main +676px`, `workspace +724px`.

Después:

- `admin-sessions` `1366x768`: `document=0px`, `body=0px`, `main=0px`, `workspace=0px`, `viewport=0px`, `surface=0px`, `dashboard-filter-stats-grid=0px`; grid final `60px`.
- `perfil` `1366x768`: `document=0px`, `body=0px`, `main=0px`, `workspace=0px`, `viewport=0px`, `surface=0px`.
- `perfil` tab `Perfil público` `1366x768`: `main=0px`, `workspace=0px`, `surface=0px`; el card final mide `449px` de alto efectivo.
- El spec contractual mide `documentElement`, `body`, `main.dashboard-main`, workspace/hub, viewport interno, surface estable y peor scroll interno efectivo.

## Cambios aplicados

- `admin-sessions`: `PAGE_SIZE` baja de `8` a `3`; barra `dashboard-filter-stats-grid` conserva la clase contractual, elimina cajas `surface-soft`, reduce padding/gaps y compacta filas/celdas de tabla.
- `admin-clinics`: `PAGE_SIZE` baja de `8` a `5`; la tabla vuelve a una fila por clínica, con usuario principal y marcador `+N`; el alta queda en `ModuleDialog`.
- `admin-pricing`: `ITEMS_PER_PAGE` baja de `2` a `1` porque el formulario manual por estudio es alto; el catálogo queda accesible por tabs + pager.
- `admin-health`: servicios, runtime y esquema se dividen en tabs para evitar apilamiento fijo.
- `admin-sessions`: cambio de contraseña se mueve a `ModuleDialog` para no competir con la tabla principal.
- `perfil`: `PasswordChangePanel` reduce padding vertical y gap del formulario para cumplir `1366x768` sin cortar campos.
- `perfil público`: el formulario largo se divide en tabs internos compactos (`Estado`, `Datos`, `Contenido`) con acción de guardado fija, sin scroll interno ni externo.
- Routing admin: se aceptan aliases obligatorios `maintenance -> admin-maintenance` y `admin-upload-report -> admin-report-upload`.
- `ModuleDialog`: permite modo uncontrolled con `trigger` para diálogos compactos dentro del App Shell.

## Tests

Nuevo:

- `frontend/e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts`

Actualizado:

- `test/frontend-admin-sessions-card.test.ts`

El nuevo spec cubre las rutas obligatorias en ambos viewports, los tabs internos del editor de perfil público y usa intercepts deterministas para módulos poblados (`clinic/profile`, `admin/clinics`, `admin/pricing`, `admin/sessions`). En rutas donde la data es server-side con `NEXT_PUBLIC_API_URL=""`, el test valida el frame real y el estado degradado disponible en e2e.

## Validaciones ejecutadas

- `pnpm --dir frontend e2e -- e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts` - 28 passed
- `pnpm --dir frontend e2e -- e2e/dashboard-single-viewport-app-shell.spec.ts` - 18 passed
- `pnpm --dir frontend e2e -- e2e/dashboard-card-navigation-shell.spec.ts` - 65 passed
- `pnpm --dir frontend e2e -- e2e/dashboard-workspace-layout-polish.spec.ts` - 8 passed
- `pnpm --dir frontend typecheck` - passed
- `pnpm --dir frontend lint` - passed
- `pnpm --dir frontend build` - passed
- `pnpm test` - 2758 passed
- `pnpm security:public-surface` - passed

## Dependencias y alcance

- Cero dependencias nuevas.
- No se tocó backend, DB, migrations, auth, sesiones/backend ni contratos API.
- No se ejecutó `git add`, `git commit`, `git push`, `gh pr create` ni `gh pr merge`.

## Riesgos remanentes

- Los datos server-side de clinic reports/logistica/audit/system health no se pueden poblar con `page.route` en el e2e actual porque el server de Next consulta backend local cuando `NEXT_PUBLIC_API_URL=""`. El contrato queda cubierto para el frame real y para los módulos client-side densos que sí reproducían el overflow.
- El shell conserva la clase legacy `overflow-y-auto` en `main.dashboard-main`; el contrato efectivo exige y verifica `scrollHeight <= clientHeight + 2`.

## Rollback

Revertir este cambio debe restaurar:

- page sizes previos de sesiones/clínicas/precios;
- layout anterior de health y sessions;
- parseo sin aliases;
- padding previo de `PasswordChangePanel`;
- el spec contractual nuevo.

Si el rollback es necesario, ejecutar los mismos e2e de App Shell antes de mergear para confirmar el impacto visual.

## Comandos para Nico

```powershell
git add -A
git commit -m "fix(dashboard): enforce real app shell no-scroll contract"
git push -u origin fix/dashboard-real-app-shell-no-scroll-contract
gh pr create --fill
gh pr checks --watch
```
