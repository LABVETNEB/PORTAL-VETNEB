# PR-6 — Densidad enterprise en Auditoría Admin

> Rama: `feat/admin-audit-enterprise-density`  
> Base: `628c454 feat(admin): compact reports dashboard density (#1043)`

## Objetivo

Convertir exclusivamente **Auditoría** del Dashboard Administración en una
consola compacta para investigar eventos por acción, actor, entidad y fecha. El
cambio continúa los contratos visuales de PR-2 a PR-5 sin modificar backend,
base de datos, dependencias, login, web pública ni Dashboard Clínica.

## Estado previo detectado

- El identificador real y conservado del módulo es `audit-log`.
- `admin-notifications`, `audit-role-changes` y `admin-event-summary` pertenecían
  a Auditoría, pero vivían como tres cards grandes en una tab separada.
- `getAuditEntries` llamaba a `/api/admin/audit-log` sin parámetros. El backend
  aplicaba su límite por defecto y la página filtraba y paginaba ese resultado
  en memoria con `PAGE_SIZE = 8`; por lo tanto, filtros y totales no
  representaban necesariamente el registro completo.
- El endpoint existente ya aceptaba `event`, `actorType`, `clinicId`, `reportId`,
  `from`, `to`, `limit` y `offset`, y ya devolvía `pagination.total`.
- El tipo frontend no reflejaba el payload operativo actual: usaba
  `actorId/targetType/targetId`, mientras el contrato real entrega actor por
  superficie, entidad, objetivos y datos de request separados.
- No había N+1 por fila. Había una única lectura no parametrizada.
- El resumen de metadata filtraba claves sensibles de primer nivel, pero podía
  serializar objetos estructurados completos.

## Implementación

### Consola y densidad

- Una sola superficie `dashboard-surface` reemplaza las tabs Resumen/Registro.
- Header de 16 px, subtítulo de 12 px y contador de coincidencias.
- Franja compacta de tres métricas que conserva los anchors reales
  `admin-event-summary`, `audit-role-changes` y `admin-notifications`.
- Tabla desktop de 13 px, header de 32 px, filas de 36 px, badges de 20 px y
  acción de 28 px.
- Lista mobile priorizada; los filtros se abren en `ModuleDialog` para no crecer
  verticalmente dentro del App Shell.
- Estados error y vacío compactos, sin ilustraciones ni paneles altos.
- El detalle vive en `ModuleDialog`; no existe expansión inline ni JSON crudo.

### Filtros y paginación

La consulta usa el soporte server-side existente para:

- tipo de evento;
- tipo de actor;
- fecha desde/hasta;
- ID de clínica;
- ID de informe.

Los filtros y `auditPage` se conservan en la URL. Las fechas se normalizan a
inicio y fin UTC del día antes de enviarse al endpoint. Valores desconocidos o
IDs no positivos se descartan de forma segura antes de consultar.

Se usa `ADMIN_AUDIT_PAGE_SIZE = 9`, con `limit: 9` y
`offset: (auditPage - 1) * 9`. Nueve filas siguen el límite viewport-safe
validado en PR-3, PR-4 y PR-5. No se agrega selector 25/50/100.

## Contrato no-scroll

- `dashboard-main` conserva `overflow-hidden` sin cambios.
- No se agrega `overflow-y-auto`, `overflow-y-scroll` ni
  `data-dashboard-scroll-region`.
- Tabla/lista, filtros y paginación usan alturas compactas y nueve registros.
- El detalle y los filtros mobile viven en diálogos, por lo que no expanden el
  body del módulo.
- La infraestructura regional de scroll para 25/50/100 continúa fuera de PR-6.

## Seguridad y exposición de datos

- Solo valores preformateados cruzan del Server Component a los componentes
  cliente de tabla y diálogo.
- No se envían al diálogo `ipAddress`, `userAgent`, `requestId`, sesión ni
  metadata cruda.
- Se conservan únicamente referencias internas mínimas de actor/entidad cuando
  son necesarias para trazabilidad; nunca se muestra el valor de un token.
- El filtro de metadata omite claves relacionadas con password, token, secret,
  cookie, auth, hash, storage, email, session, IP, user-agent y request-id.
- Objetos y arrays de metadata se sustituyen por `Dato estructurado omitido`;
  no se serializa JSON completo.
- No se agrega `dangerouslySetInnerHTML`, logging de eventos, fetch público ni
  endpoint nuevo. La autorización y cookies existentes permanecen intactas.

## N+1 y carga

No existía N+1 y no se introduce uno. Las lecturas son un conjunto fijo y
paralelo, nunca una consulta por fila:

1. página actual filtrada, máximo nueve eventos;
2. overview global, máximo nueve eventos, para total y actividad reciente;
3. resumen de cambios de rol, máximo un evento;
4. resumen de notificaciones, máximo un evento.

El endpoint y repositorio existentes realizan paginación y conteo server-side.
No se modificó backend ni se creó un contrato batch.

## Archivos modificados

- `frontend/src/app/dashboard/admin/AdminAuditCard.tsx`
- `frontend/src/app/dashboard/admin/AdminAuditDenseTable.tsx`
- `frontend/src/app/dashboard/admin/AdminAuditFilterBar.tsx`
- `frontend/src/app/dashboard/admin/AdminAuditDetailDialog.tsx`
- `frontend/src/app/dashboard/admin/AdminAuditLogTable.tsx` (retirado)
- `frontend/src/app/dashboard/admin/page.tsx`
- `frontend/src/lib/api.ts`
- `test/admin-audit-enterprise-density.test.ts`
- `test/admin-dashboard-sections-contract.test.ts`
- `test/audit-suite-completeness.test.ts`
- `test/frontend-admin-live-read-contract.test.ts`
- `test/frontend-admin-metadata-guard.test.ts`
- `test/frontend-audit-no-mock-fallback.test.ts`
- `test/frontend-dashboard-admin.test.ts`
- `test/frontend-dashboard-admin-command-center.test.ts`
- `test/frontend-dashboard-admin-section-tabs.test.ts`
- `test/frontend-dashboard-hub-hero.test.ts`
- `test/frontend-notification-click-anchors.test.ts`
- `test/frontend-visual-consistency.test.ts`
- `docs/implementation/admin-audit-enterprise-density.md`

## Tests y validaciones

- `pnpm --dir frontend lint`: OK.
- `pnpm --dir frontend typecheck`: OK.
- Tests focales PR-6 + contratos Admin: 55 aprobados, 0 fallos.
- `pnpm --dir frontend build`: OK; build de producción completo.
- `pnpm test`: OK; 2793 aprobados, 0 fallos.
- E2E `dashboard-real-app-shell-no-scroll-contract.spec.ts --grep "admin audit log"`:
  2 aprobados en Chromium, 1366×768 y 1440×900.
- Playwright regeneró `frontend/next-env.d.ts`; se restauró y no integra el diff.

## Deuda técnica y riesgos residuales

1. El endpoint no ofrece agregación por tipo de evento. La franja evita inventar
   una distribución global y muestra solo totales respaldados por el contrato.
2. La consola hace cuatro lecturas acotadas para preservar total global,
   actividad reciente y los dos resúmenes históricos. Un endpoint agregado
   podría consolidarlas en el futuro, pero no se justifica ampliar backend aquí.
3. Los filtros por entidad se limitan a clínica e informe, que son los campos
   server-side existentes. No se implementa texto libre ni búsqueda genérica.
4. Page sizes 25/50/100 siguen bloqueados hasta aprobar scroll regional.
5. El E2E local no-scroll valida la superficie vacía porque su web server no
   dispone del endpoint admin real. La tabla poblada de nueve filas queda
   protegida por contratos de fuente; un fixture poblado específico sigue
   pendiente.

## No alcance

- Dashboard Clínica y cualquier módulo de Clínica.
- Resumen, Clínicas, Tokens, Informes, Usuarios y Sesiones Admin, salvo la
  integración mínima de los totales de auditoría ya consumidos por Resumen.
- Login, web pública, Home, Pricing y SEO.
- Backend, DB, migraciones, secretos, `.env` y dependencias.
- Export nuevo, scroll regional, selector 25/50/100 y PR-7 o posteriores.
- Dependabot.

## Próximos PRs

- Infraestructura aprobada de scroll regional para page sizes 25/50/100.
- Agregación server-side opcional de métricas de auditoría.
- Búsqueda server-side genérica por entidad/texto si se define un contrato
  seguro y autorizado.
- Cobertura E2E poblada específica para Auditoría Admin.
