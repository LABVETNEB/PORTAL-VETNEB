# Admin clinic password visibility

## Base

- Rama: `fix/admin-clinic-password-visibility`.
- HEAD inicial: `a6ec736 test(admin): add populated admin e2e coverage (#1051)`.
- `main` local inicial: `a6ec736 test(admin): add populated admin e2e coverage (#1051)`.
- Working tree inicial: limpio.

## Objetivo

Ocultar por defecto las contraseñas nuevas ingresadas por Administración al
crear una Clínica o reemplazar la credencial de un usuario de Clínica. La
revelación debe ser explícita, accesible y reversible, sin cambiar los contratos
de API ni persistencia.

## Scope incluido

- Alta de Clínica en `AdminClinicsManagementCard`.
- Reemplazo de credenciales en `ClinicEditDrawer`.
- Contratos estáticos y E2E de estado inicial, reveal y hide.
- Runbook de staging y checklist de release relacionados.
- Documento de implementación y trazabilidad.

## Scope excluido

- Backend, endpoints, DB, Drizzle, schema y migraciones.
- Auth, cookies, sesiones, roles, permisos y manejo uniforme de 401/403.
- Dependencias, `package.json`, lockfile, CI, workflows y Dependabot.
- Rediseño del dashboard, App Shell y módulos Admin no relacionados.
- `.env`, secretos, tokens y datos reales.

## Auditoría previa

- Rama, HEAD, `main` local y working tree coincidían con la base esperada.
- `AdminClinicsManagementCard.tsx` renderizaba la contraseña inicial con
  `type="text"`.
- `ClinicEditDrawer.tsx` renderizaba cada nueva contraseña de recuperación con
  `type="text"`.
- `frontend-admin-clinics-management-card.test.ts` exigía expresamente que esos
  inputs no usaran `type="password"`.
- `docs/staging-smoke-runbook.md` y `docs/release-readiness.md` documentaban la
  visibilidad durante la carga.
- Los tipos de listado `AdminClinicManagementSummary` y las respuestas de
  clínicas no contienen password ni hash. El dato sensible es el valor nuevo
  ingresado localmente por el Admin; no proviene del listado backend.
- No existía acción de copiar en estas dos superficies.

## Comportamiento anterior

- El valor nuevo quedaba visible mientras se escribía.
- No existía interacción de reveal/hide.
- El riesgo P2 era exposición visual, captura accidental y shoulder surfing.

## Comportamiento corregido

- Ambos inputs usan `type="password"` en su estado inicial.
- Cada campo incorpora un botón `type="button"` con iconos `Eye`/`EyeOff`, foco
  visible, `aria-label`, `aria-pressed` y `aria-controls`.
- Reveal solo ocurre por click o activación de teclado del botón.
- La segunda activación vuelve a ocultar el valor.
- La visibilidad del alta se resetea al cerrar o completar el diálogo.
- La visibilidad de recuperación se mantiene por usuario y se resetea al
  cambiar de Clínica o guardar la credencial.
- Se conservan `autocomplete="new-password"`, la confirmación antes de
  reemplazar, el payload y las acciones existentes.
- El botón se ubica dentro del campo con padding derecho, sin agregar altura ni
  scroll regional; el patrón es neutro para desktop, laptop, tablet y móvil.

## Tests agregados o ajustados

- Contrato estático para estado inicial oculto en alta y recuperación.
- Contrato de interacción accesible para reveal/hide.
- E2E de alta con valor sintético: oculto, ausente como texto visible, reveal y
  hide.
- E2E de recuperación con el mismo contrato.
- Contrato documental para eliminar las instrucciones legacy de visibilidad.
- Contrato de iconos del botón Actualizar ajustado para incluir `Eye`/`EyeOff`.

## Archivos modificados

- `frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx`.
- `frontend/src/app/dashboard/admin/ClinicEditDrawer.tsx`.
- `frontend/e2e/admin-clinic-edit-drawer.spec.ts`.
- `test/frontend-admin-clinics-management-card.test.ts`.
- `test/frontend-dashboard-action-feedback-focus-polish.test.ts`.
- `test/admin-docs-operational-contract.test.ts`.
- `docs/staging-smoke-runbook.md`.
- `docs/release-readiness.md`.
- `docs/implementation/admin-clinic-password-visibility.md`.

## Validaciones

- TDD focal inicial de UI y docs: 11/15; cuatro fallos esperados por el contrato
  inseguro previo.
- Contratos focales de UI y docs después del cambio: 15/15.
- Contrato focal de feedback/iconos: 19/19.
- E2E focal inicial: 0/2 por selector ambiguo del test; el DOM ya informaba
  `type="password"`. Se seleccionó explícitamente el textbox.
- E2E focal final:
  `pnpm --dir frontend exec playwright test e2e/admin-clinic-edit-drawer.spec.ts --grep "password starts hidden"`
  — 2/2.
- `pnpm --dir frontend lint` — pasó.
- `pnpm --dir frontend typecheck` — pasó.
- Primera ejecución de `pnpm test` — 2806/2807; un contrato estático esperaba
  la lista anterior exacta de imports de Lucide.
- `pnpm test` final — 2807/2807.
- `pnpm build` — pasó.
- `pnpm security:public-surface` — pasó sin exposición pública; conservó dos
  notas server-only esperadas para nombres de cookies en `frontend/src/proxy.ts`.
- `pnpm --dir frontend build` — pasó; 25/25 páginas generadas.

Playwright regeneró temporalmente `frontend/next-env.d.ts` con la ruta de tipos
de desarrollo. El cambio incidental fue revertido mediante parche y el archivo
quedó fuera del diff.

## Resultado

- Contraseña visible por defecto: no.
- Contraseña como texto inicial: no.
- Contraseña en `title`, `aria-label`, `placeholder` o `data-*`: no.
- Reveal/hide: explícito, accesible y reversible.
- Copia: no aplica; la superficie no tenía acción de copiar.
- Secretos reales: no se leyeron, imprimieron ni incorporaron.

## Riesgo residual y QA humana

- Playwright ejecutó Chromium desktop. El patrón no cambia altura ni ancho del
  formulario, pero Nico debe completar QA visual en desktop, laptop, tablet y
  móvil, además de teclado, foco y temas soportados.
- El E2E mostró advertencias Radix preexistentes de `DialogTitle`/`Description`
  en superficies del dashboard. No se modificaron porque no pertenecen a este
  P2 y los dos tests focales pasaron.
- La contraseña nueva permanece necesariamente en el estado controlado del
  formulario hasta guardar o cerrar; no se renderiza como texto ni atributo
  accesible.

## Estado final y acciones manuales

- Los cambios quedan en working tree, sin stage, commit ni push.
- Nico debe revisar el diff y ejecutar la QA humana responsive.
- Stage, commit, push y creación del PR quedan a cargo de Nico.
- Después del push y creación del PR: `gh pr checks --watch`.
