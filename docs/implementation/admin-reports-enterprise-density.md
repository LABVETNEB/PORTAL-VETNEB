# PR-5 — Densidad enterprise en Informes Admin

> Rama: `feat/admin-reports-enterprise-density`  
> Base: `919d8e1 feat(admin): compact tokens dashboard density (#1042)`

## Objetivo

Convertir exclusivamente **Informes** del Dashboard Administración en una
consola compacta para carga, lectura de estado, trazabilidad y acceso seguro al
documento. El cambio continúa los contratos visuales de PR-2, PR-3 y PR-4 sin
modificar backend, base de datos, dependencias ni el Dashboard Clínica.

## Estado previo detectado

- El identificador real y conservado del módulo es `admin-report-upload`.
- La superficie solo mostraba texto indicando que la carga debía realizarse
  desde Tokens, pero Tokens ya no montaba el modal de carga. No había una acción
  operativa disponible en Informes.
- No había listado ni cola conectada dentro del módulo.
- Ya existía el contrato frontend/backend admin
  `getAdminReportWorkflow({ limit, offset })`, con `pagination.hasMore` y datos
  reales de clínica, paciente, estudio, archivo, etapa y tinción especial.
- Ya existían mutaciones para etapa y tinción, además de preview/descarga por URL
  firmada solicitada bajo scope admin.
- El modal legacy recorría todas las páginas de usuarios clínica para construir
  su selector. También recorría los tokens de la clínica seleccionada. No había
  un N+1 por informe en la pantalla vacía, pero sí carga masiva de catálogo al
  abrir el modal.

## Implementación

### Consola y listado

- Header de 20 px, descripción corta y acciones de 32 px.
- Franja operativa compacta con conteos de la página actual: registros,
  entregados y solicitudes de tinción.
- Tabla desktop densa y lista mobile priorizada.
- Columnas basadas exclusivamente en datos existentes: caso/paciente, clínica,
  estudio, estado, fecha, archivo y acción.
- Estados loading, error, success y empty compactos.
- Detalle en `ModuleDialog`, no inline. Permite actualizar la etapa, solicitar o
  resolver tinción y acceder al documento.

### Subida de informe

- Flujo en `ModuleDialog` dividido en dos pasos para no consumir altura del App
  Shell: asignación y documento.
- Búsqueda de clínica explícita y server-side mediante `getAdminClinics`, con un
  máximo de nueve resultados. Ya no se descarga el catálogo completo de
  usuarios clínica.
- Los tokens se cargan solo después de seleccionar una clínica. Se preserva el
  vínculo opcional y el reemplazo de informe existente.
- Se conservan archivo PDF, paciente, tipo de estudio y fecha de carga.
- Controles y botones de 28–32 px, sin dropzone ni formulario tipo landing.

## Paginación y page size

Se usa `PAGE_SIZE = 9`, con:

- `limit: PAGE_SIZE`;
- `offset: page * PAGE_SIZE`;
- anterior desde la segunda página;
- siguiente según `pagination.hasMore` real del endpoint.

Nueve filas es el límite viewport-safe validado en PR-3 para 1366×768. No se
agrega selector 25/50/100 ni se simula un total global que el contrato no
entrega.

## Contrato no-scroll

- `dashboard-main` conserva `overflow-hidden` sin cambios.
- No se agrega `overflow-y-auto`, `overflow-y-scroll` ni
  `data-dashboard-scroll-region`.
- La tabla usa nueve filas densas y paginación fija.
- Subida y detalle viven en diálogos compactos.
- El marcador `.dashboard-surface` se conserva para el contrato E2E del App
  Shell.

## Seguridad de informes y archivos

- El listado no recibe ni renderiza URLs privadas.
- Preview y descarga reutilizan `ReportFileActions` con `scope="admin"`; la URL
  firmada se solicita solo al ejecutar la acción.
- No se agregan logs, `dangerouslySetInnerHTML`, fetch público ni previews
  embebidas.
- La carga mantiene `FormData`, `accept="application/pdf"` y las validaciones
  backend existentes. No se relajan políticas de storage.
- El token particular continúa mostrándose enmascarado con sus últimos cuatro
  caracteres.

## N+1 y carga pesada

No existía un N+1 por fila en el módulo previo porque no había listado. La nueva
tabla hace una única consulta paginada y ninguna consulta adicional por fila.

La carga masiva de usuarios clínica del modal legacy se elimina de esta
superficie utilizando la búsqueda server-side existente. Los tokens siguen
leyéndose por páginas solo para la clínica elegida y bajo demanda. No existe un
endpoint de búsqueda de tokens más específico; conservar este recorrido
on-demand evita perder tokens sin agregar backend.

## Archivos modificados

- `frontend/src/app/dashboard/admin/page.tsx`
- `frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx`
- `frontend/src/app/dashboard/admin/AdminReportsCard.tsx`
- `frontend/src/app/dashboard/admin/AdminReportsUploadPanel.tsx`
- `frontend/src/app/dashboard/admin/AdminReportStatusBadge.tsx`
- `test/admin-reports-enterprise-density.test.ts`
- `test/frontend-dashboard-admin.test.ts`
- `test/frontend-report-upload-modal.test.ts`
- `docs/implementation/admin-reports-enterprise-density.md`

## Tests y validaciones

- `pnpm --dir frontend lint`: OK.
- `pnpm --dir frontend typecheck`: OK.
- `pnpm --dir frontend build`: OK.
- `pnpm test`: OK, 2788 tests aprobados y 0 fallos.
- Tests focales Informes + shell horizontal + Resumen/Clínicas + Tokens: 57
  aprobados y 0 fallos.
- E2E
  `dashboard-real-app-shell-no-scroll-contract.spec.ts --grep "admin upload report alias fits without external or internal scroll"`:
  2 aprobados en Chromium, 1440×900 y 1366×768.
- La primera ejecución E2E detectó la ausencia del marcador estructural
  `.dashboard-surface`; se restauró y la repetición final pasó en ambos
  viewports.
- Playwright modificó `frontend/next-env.d.ts`; se restauró y no forma parte del
  diff.

## Deuda técnica y riesgos residuales

1. El workflow paginado expone `hasMore`, pero no `total`; la interfaz no inventa
   un total global.
2. Una clínica con más de cien tokens requiere varias páginas bajo demanda para
   completar el selector. Un endpoint de búsqueda de tokens permitiría evitar
   ese recorrido sin recortar funcionalidad.
3. El E2E no-scroll usa la superficie vacía porque sus mocks actuales no
   incluyen `admin/report-workflow`; la densidad de nueve filas queda protegida
   por contratos de fuente y por el precedente E2E poblado de PR-3.
4. El modal legacy `UploadReportModal` permanece sin cambios para conservar sus
   contratos históricos; Informes Admin usa el nuevo panel específico.

## No alcance

- Dashboard Clínica e Informes Clínica.
- Tokens, Clínicas, Resumen, Auditoría, Usuarios y Sesiones Admin, salvo el
  título mínimo del workspace activo de Informes.
- Login, web pública, Home, Pricing y SEO.
- Backend, DB, migraciones, storage, secretos, `.env` y dependencias.
- Scroll regional, selector 25/50/100 y PR-6 o posteriores.
- Dependabot.

## Próximos PRs

- Infraestructura aprobada de scroll regional para page sizes 25/50/100.
- Total global o cursor estable en el contrato de workflow.
- Búsqueda server-side paginada de tokens particulares por clínica.
- Fixture E2E poblado específico para la cola de Informes Admin.
