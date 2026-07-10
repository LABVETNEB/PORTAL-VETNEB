# PR-3 — Densidad enterprise en Resumen y Clínicas Admin

> Rama: `feat/admin-overview-clinics-enterprise-density`
> Base: `3950834 feat(dashboard): replace sidebar shell with horizontal navigation (#1040)`

## Decisión de layout

Este PR respeta el contrato global no-scroll vigente. `main.dashboard-main`
continúa con `overflow-hidden`; no se agrega scroll global ni una región vertical
interna. Resumen y Clínicas se ajustan al viewport mediante densidad, paginación
acotada y superficies flex existentes.

Clínicas usa un page size fijo de **9 filas**. El valor inicial de 10 filas
producía 12 px de scroll vertical interno en `.dashboard-table-responsive` en
el E2E de CI a 1366×768. Nueve filas conservan la densidad de aproximadamente
40 px por fila y dejan un margen estable sin convertir `main` ni el body de
tabla en un contenedor de scroll.

## Deuda técnica explícita

Para 25/50/100 filas reales se requiere un PR dedicado que introduzca scroll regional acotado al body de tabla mediante una región explícita tipo `data-dashboard-scroll-region`, actualizando el contrato no-scroll para permitir solo ese scroll interno designado.

Esta deuda no se implementa en PR-3.

## Cambios en Resumen Admin

- Header operativo existente, compacto y sin hero dentro del módulo Resumen.
- Strip de tres KPI con valores de 20 px: eventos, tipos de evento y estado.
- Cuatro paneles densos: atención requerida, actividad reciente real, módulos
  operativos y alertas/estados.
- Actividad reciente derivada del audit log ya cargado por la página; no agrega
  requests ni contratos backend.
- Accesos compactos que preservan la navegación existente por `?module=`,
  incluida Clínicas mediante `?module=admin-clinics`.

## Cambios en Clínicas Admin

- Header, acciones y buscador compactos.
- Padding de panel limitado a 8–16 px.
- Tabla de 13 px, headers de 12 px semibold y filas de aproximadamente 40 px.
- Paginación server-side existente elevada de 5 a 9 filas.
- Alta en diálogo y edición en drawer se conservan; no hay detalle inline grande.
- No se agrega selector 25/50/100 ni scroll vertical al body de tabla.

## Archivos modificados

- `frontend/src/app/dashboard/admin/AdminCommandCenter.tsx`
- `frontend/src/app/dashboard/admin/AdminOverviewQuickLinks.tsx`
- `frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx`
- `frontend/src/app/dashboard/admin/page.tsx`
- `test/admin-overview-clinics-enterprise-density.test.ts`
- `test/frontend-dashboard-admin-command-center.test.ts`
- `test/unit/ui/frontend/frontend-visual-consistency.test.ts`
- `docs/implementation/admin-overview-clinics-enterprise-density.md`

## Tests y validaciones

Se validan los contratos de densidad, los cuatro paneles del Resumen, la
navegación `?module=admin-clinics`, el page size 9, la ausencia de scroll
vertical nuevo y la continuidad del shell horizontal sin sidebar.

Resultados finales:

- `pnpm --dir frontend lint`: OK, sin errores.
- `pnpm --dir frontend typecheck`: OK, sin errores.
- `pnpm --dir frontend build`: OK, build de producción completo.
- `pnpm test`: OK, 2777 tests aprobados, 0 fallos.
- E2E específico `admin clinics populated fits without external or internal
  scroll`: OK, 2/2 casos en Chromium (1366×768 y 1440×900). El web server local
  regeneró `next-env.d.ts`; se restauró al contenido previo y no integra el diff.

## No alcance

- Dashboard Clínica y los módulos Admin de Tokens, Informes, Auditoría,
  Usuarios y Sesiones.
- Login, web pública, Home, Pricing y SEO.
- Backend, base de datos, migraciones, dependencias y Dependabot.
- Contrato global no-scroll y specs E2E generales.
- Infraestructura regional de scroll y selector 25/50/100.

## Riesgos residuales

- El fit con 9 filas se valida en 1366×768 mediante el contrato E2E específico;
  el contenido truncado debe conservar sus límites actuales.
- Mensajes transitorios de error o éxito agregan altura; el shell mantiene el
  contrato no-scroll y puede recortarlos en viewports excepcionalmente bajos.
- La ampliación a 25/50/100 continúa bloqueada hasta implementar y aprobar la
  región de scroll explícita descrita como deuda técnica.
