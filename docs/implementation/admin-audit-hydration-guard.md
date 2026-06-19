# PR fix/admin-audit-hydration-guard — Entrega Codex

## Base

- Rama: `fix/admin-audit-hydration-guard`.
- HEAD inicial: `bf011ab docs(protocol): add VETNEB AI working protocol (#1049)`.
- Working tree inicial: limpio.
- Entorno: Windows, PowerShell y PNPM.

## Scope incluido

- Diagnóstico del hydration mismatch reproducible en Admin Audit.
- Corrección mínima de la frontera SSR/CSR del filtro mobile de auditoría.
- Guard E2E contra `pageerror` y errores de consola de hidratación.
- Validación en Chromium a 1366×768, 1440×900 y mobile 390×844.

## Scope excluido

- Backend, DB, Drizzle, migraciones, endpoints, auth, cookies, CORS, CSP y rate limits.
- Dependencias, `package.json`, `pnpm-lock.yaml`, CI, workflows y Dependabot.
- Rediseño visual, cambios de layout y refactors compartidos de `ModuleDialog`.
- Cobertura E2E poblada de Overview, Tokens, Reports, Audit y Users/Roles.
- Visibilidad de contraseñas de Clínica y contrato UI uniforme para 401/403.
- `.env`, secretos, tokens, cookies reales y datos sensibles.

## Auditoría previa

### Archivos revisados

- `frontend/src/app/dashboard/admin/page.tsx`.
- `frontend/src/app/dashboard/admin/AdminAuditCard.tsx`.
- `frontend/src/app/dashboard/admin/AdminAuditDenseTable.tsx`.
- `frontend/src/app/dashboard/admin/AdminAuditDetailDialog.tsx`.
- `frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx`.
- `frontend/src/components/dashboard/ModuleDialog.tsx`.
- `frontend/src/components/ui/button.tsx`.
- `frontend/e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts`.
- `frontend/e2e/contacto-hydration.spec.ts`.
- `frontend/e2e/login-hydration.spec.ts`.
- `test/admin-audit-enterprise-density.test.ts`.
- `docs/audit/admin-enterprise-density-completion-audit.md`.
- `docs/implementation/admin-audit-enterprise-density.md`.

### Causa raíz encontrada

`AdminAuditFilterBar` era un Server Component que construía un `Button` y lo
entregaba como prop `trigger` a `ModuleDialog`, un Client Component. Radix
`Dialog.Trigger asChild` clona ese nodo para agregar `aria-controls`,
`data-state`, handler y ref. En la ruta Audit, el HTML SSR no contenía el
`button`, mientras la primera renderización cliente sí lo agregaba. React
detectaba una divergencia estructural y regeneraba el árbol en cliente.

La captura del `pageerror` ubicó la cadena exacta:

`AdminAuditFilterBar` → `ModuleDialog` → `DialogTrigger` → `SlotClone` →
`Button`.

No se encontraron como causa `Date.now`, `Math.random`, browser APIs durante
render, locale dependiente ni IDs generados manualmente en la superficie Audit.

## Solución implementada

- `AdminAuditFilterBar.tsx` se declaró Client Component con `"use client"`.
- El trigger y `ModuleDialog` ahora se construyen dentro de la misma frontera
  cliente y producen markup inicial estable.
- No se cambió markup, copy, clases, filtros, navegación, datos ni contrato
  responsive.
- `ModuleDialog` permaneció intacto para no ampliar el riesgo a otros módulos.
- El E2E no-scroll captura errores antes de navegar a Admin Audit, espera la
  finalización de la hidratación y falla ante cualquier `pageerror` o mensaje
  de consola compatible con hydration/server-render mismatch.

## Archivos modificados

- `frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx`.
- `frontend/e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts`.
- `docs/implementation/admin-audit-hydration-guard.md`.

## Tests y validaciones

### Reproducción previa

- `pnpm exec playwright test e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts --grep "admin audit log"`, desde `frontend`:
  - Antes del guard: 2/2 asserts de overflow aprobaban aunque React emitía el
    hydration mismatch.
  - Fase roja con guard: 0/2; ambos viewports fallaron por el `pageerror`
    esperado en `AdminAuditFilterBar`.
  - Fase verde tras el fix: 2/2 aprobados, sin `pageerror` ni warning de
    hidratación.
- `pnpm exec playwright test e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts --grep "admin audit"`, desde `frontend`:
  - Resultado final: 3/3 aprobados.
  - Incluye 1366×768, 1440×900 y 390×844.
  - En mobile, el filtro abre con Enter, cierra con Escape y devuelve el foco al
    trigger sin error de hidratación.

### Validación obligatoria

- `pnpm test`: aprobado, 2806/2806 tests.
- `pnpm build`: aprobado.
- `pnpm security:public-surface`: aprobado, sin exposición pública detectada;
  conserva dos hallazgos informativos `server-only` preexistentes en
  `frontend/src/proxy.ts`.
- `pnpm --dir frontend lint`: aprobado.
- `pnpm --dir frontend typecheck`: aprobado.
- `pnpm --dir frontend build`: aprobado; `/dashboard/admin` continúa como ruta
  dinámica.

### Incidencia de validación controlada

Playwright/Next dev cambió temporalmente `frontend/next-env.d.ts` para apuntar
a `.next/dev/types/routes.d.ts`. La primera ejecución de `pnpm test` falló
9/2806 por contratos que prohíben ese artefacto. Se restauró exclusivamente la
línea generada; la repetición completa pasó 2806/2806 y el archivo no integra
el diff final.

## QA y resultado

- Chromium 1366×768: Admin Audit sin overflow y sin hydration mismatch.
- Chromium 1440×900: Admin Audit sin overflow y sin hydration mismatch.
- Chromium 390×844: filtro mobile operativo por teclado y sin hydration
  mismatch.
- El contrato visual y funcional permanece sin cambios.
- Los 404 de `getAuditEntries` y `getAdminSystemHealth` continúan como limitación
  conocida del web server E2E local; no producen el error de hidratación y no
  se ocultaron con mocks nuevos.

## Riesgo residual

- Bajo: el cambio productivo se limita a la frontera cliente del filtro Audit.
- El E2E local sigue validando Audit con superficie vacía por ausencia del
  endpoint admin real en ese servidor; la cobertura poblada pertenece al PR
  separado definido por Nico.
- Al abrir el filtro, Radix emite en desarrollo avisos internos de título y
  descripción por el contrato de IDs custom de `ModuleDialog`; el diálogo
  conserva nombre accesible verificado por rol. Corregir ese helper compartido
  afectaría otros módulos y queda fuera de este fix aislado.

## Estado final

- Sin cambios en backend, DB, auth, seguridad, dependencias, configuración
  productiva ni módulos fuera del scope.
- Sin `git add`, `git commit`, `git push`, comandos `gh` ni instalación de
  paquetes.
- Archivos dejados en working tree para revisión manual de Nico.

## Comandos manuales pendientes para Nico

```powershell
Set-Location C:\PORTAL-VETNEB
git status --short --untracked-files=all
git diff --check
git diff --stat
git diff --name-only
git add frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx frontend/e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts docs/implementation/admin-audit-hydration-guard.md
git commit -m "fix(admin): guard audit hydration boundary"
git push
gh pr checks --watch
```
