# Dashboard global: detalles inline y adaptación responsive

## 1. Resumen ejecutivo

Se unifica el patrón visual de Dashboard Administración y Dashboard Clínica: las superficies master-detail dejan de depender de paneles laterales rígidos y muestran el detalle dentro del ítem seleccionado. La solución conserva datos, acciones y lógica; cambia únicamente la composición visual y los contenedores.

Además, una capa CSS acotada al App Shell impide desbordes horizontales, permite que flex/grid encojan correctamente, compacta elementos secundarios en viewports efectivos reducidos y mantiene tablas/paginadores dentro de sus cards.

## 2. Rama creada

`fix/dashboard-global-inline-details-responsive`, basada en `a7f4761` (`main` y `origin/main` en paridad al iniciar).

## 3. Objetivo del PR

- Aplicar detalle inline en todas las superficies master-detail de ambos dashboards.
- Evitar solapamientos, contenido fuera de página y scroll horizontal global ante cambios de viewport o zoom.
- Mantener una densidad institucional compacta y consistente.
- Preservar contratos API, contenido interno y lógica de negocio.

## 4. Problema visual observado

- Tokens Admin e Informes Clínica completos usaban grids laterales que reducían el ancho útil y podían dejar el detalle fuera del área visible.
- Tokens Clínica y los summaries de Informes/Logística sustituían la lista por un panel de detalle en móvil y mantenían dos columnas en desktop; el comportamiento no era equivalente al detalle inline solicitado.
- La tabla de Auditoría podía crecer verticalmente por contenido largo y competir con el paginador.
- Flex/grid, tablas, chips y medios necesitaban un guard común de `min-width: 0`, wrapping y límites de ancho.

## 5. Superficies revisadas

- Administración: hub, resumen/alertas, clínicas, precios, sesiones, roles, estado, mantenimiento, reportes, Tokens particulares y Auditoría.
- Clínica: hub, operaciones, perfil, Tokens particulares, summaries de Informes y Logística, Informes completos, visitas y rutas.
- Componentes compartidos: App Shell, cards, tabs, badges/chips, paginadores, tablas y primitivas master-detail.

## 6. Decisión técnica aplicada

- Primitivas reutilizables `dashboard-inline-list`, `dashboard-inline-scroll` y `dashboard-inline-detail`.
- Lista de una sola columna; cada selector expone `aria-expanded` y el detalle se renderiza inmediatamente debajo del ítem activo.
- Cadena `flex min-h-0 flex-1` para limitar la superficie al espacio disponible; el scroll queda localizado en la lista, no en la página.
- Guard responsive scoped a `.dashboard-app-shell` para ancho máximo, shrink de hijos, wrapping y densidad.
- Tablas dentro de wrappers acotados; el paginador permanece como bloque `shrink-0` y puede envolver sus controles en anchos reducidos.

## 7. Cambios implementados

- Tokens Administración: panel lateral eliminado; detalle completo inline dentro del token activo.
- Tokens Clínica: patrón lateral/cover eliminado; lista y detalle inline equivalentes a Administración en desktop y móvil.
- Informes Clínica (ruta completa): panel lateral eliminado; cabecera, datos, acciones, archivo y timeline conservados inline.
- Summaries Clínica de Informes y Logística: paneles laterales/cover eliminados; detalle inline en el ítem seleccionado.
- Auditoría Administración: filas más compactas, wrapping en actor/objetivo/detalle/fecha, padding responsive, tabla acotada y paginador protegido.
- Capa global: anti-desborde horizontal, densidad de chips y paginadores adaptativos.
- E2E: contratos actualizados para selección inline y ausencia de panel persistente.

## 8. Archivos modificados

- `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx`
- `frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`
- `frontend/src/app/dashboard/informes/page.tsx`
- `frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx`
- `frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx`
- `frontend/src/app/dashboard/admin/AdminAuditLogTable.tsx`
- `frontend/src/app/globals.css`
- `frontend/e2e/dashboard-accessibility-keyboard.spec.ts`
- `frontend/e2e/dashboard-global-masked-master-detail.spec.ts`
- `frontend/e2e/dashboard-master-detail-state-polish.spec.ts`
- `frontend/e2e/dashboard-workspace-layout-polish.spec.ts`
- `test/frontend-dashboard-clinic-tokens.test.ts`
- `test/frontend-dashboard-home.test.ts`
- `docs/implementation/dashboard-global-inline-details-responsive.md`

## 9. Validaciones ejecutadas

Terminal 1, Windows/PowerShell y PNPM:

```text
pnpm --dir frontend lint
pnpm --dir frontend typecheck
pnpm --dir frontend build
pnpm --dir frontend exec playwright test e2e/dashboard-global-masked-master-detail.spec.ts e2e/dashboard-master-detail-state-polish.spec.ts e2e/dashboard-workspace-layout-polish.spec.ts e2e/dashboard-accessibility-keyboard.spec.ts
pnpm --dir frontend exec playwright test e2e/dashboard-viewport-zoom-adaptability.spec.ts e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts e2e/dashboard-internal-no-scroll-contract.spec.ts
pnpm validate:local
git diff --check
```

## 10. Resultado de validaciones

- Lint frontend: OK.
- Typecheck frontend: OK.
- E2E afectados: 44/44 OK.
- Contratos estáticos actualizados de Tokens/Summaries: 22/22 OK.
- Matriz viewport/zoom y no-scroll: 88/88 OK; incluye 1920×1080, 1600×900, 1536×864, 1366×768, 1280×720, 768×1024 y 390×844.
- Build frontend: OK; rutas `/dashboard`, `/dashboard/admin` y `/dashboard/informes` compiladas.
- `pnpm validate:local`: OK; typecheck backend, typecheck tests, 2760/2760 tests y build backend.
- `git diff --check`: OK.

Los avisos 404 de endpoints durante E2E corresponden al frame degradado/mocks del entorno de pruebas y no se ocultaron.

## 11. Riesgos residuales

- Los E2E de Informes completos usan el frame sin datos para fetch server-side; el contenido real del detalle requiere una sesión con datos disponibles.
- La validación visual local puede quedar limitada por autenticación o ausencia de backend/datos; cualquier superficie no observable se registra explícitamente abajo.
- Las tablas anchas conservan scroll local deliberado dentro de la card para no ocultar columnas críticas.

## 12. Pantallas que requieren validación manual de Nico

**NO CONFIRMADO — requiere validación manual de Nico con sesión y datos reales:**

- Administración: Tokens particulares y Auditoría con registros reales.
- Clínica: Tokens particulares, summary de Informes, summary de Logística e Informes completos con archivo/timeline real.
- Zoom de página real del navegador en 100%, menor y mayor.

Motivo: el navegador local redirige correctamente al login y no se usaron credenciales ni cookies reales. La automatización E2E sí validó estructura, interacción inline, ausencia de desborde/scroll global y viewports equivalentes con cookies ficticias, pero no sustituye la inspección estética de datos productivos por Nico.

## 13. Confirmación de no-alcance

- Sin cambios en backend, base de datos, migraciones, autenticación, seguridad ni contratos API.
- Sin dependencias nuevas ni cambios en lockfiles.
- Sin cambios en web pública, branding o producción.
- Sin secretos, cookies reales, tokens, passwords, hashes ni `.env` reales.
- No se ejecutaron `git add`, `git commit`, `git push`, `gh pr create`, `gh pr checks --watch` ni `gh pr merge`.
