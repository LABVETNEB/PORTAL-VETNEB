# Entrega en laboratorio y fecha estimada

## Problema corregido

La estimación de entrega/informe no debe gobernarse por la fecha de envío de la muestra. El envío es un dato logístico secundario y puede ocurrir antes de que VETNEB reciba efectivamente la muestra.

La base operativa del SLA queda definida como entrega en laboratorio. En el backend se expone como `labReceivedAt` y se conserva `receptionAt` como alias compatible con la columna existente `study_tracking_cases.reception_at`.

## Fechas del flujo

- Fecha de extracción: dato clínico de toma de muestra.
- Fecha de envío: dato logístico de traslado, útil para trazabilidad pero no para SLA.
- Entrega en laboratorio: fecha real en la que VETNEB recibe la muestra; gobierna la estimación.
- Fecha estimada de entrega/informe: se calcula desde entrega en laboratorio.

## Regla laboral

El helper puro de `server/lib/study-tracking.ts` trabaja con claves `YYYY-MM-DD` para evitar corrimientos por timezone.

- Lunes a viernes no feriados: `1`.
- Sábado no feriado: `0.5`.
- Domingo: `0`.
- Feriados nacionales Argentina y días puente/no operativos configurados: `0`.

En ausencia de una hora confiable de recepción, el conteo empieza desde el día calendario siguiente a `labReceivedAt`.

## Feriados 2026

La configuración inicial vive en `argentinaHolidaysByYear`:

- `2026-01-01`
- `2026-02-16`
- `2026-02-17`
- `2026-03-23`
- `2026-03-24`
- `2026-04-02`
- `2026-04-03`
- `2026-05-01`
- `2026-05-25`
- `2026-06-15`
- `2026-06-20`
- `2026-07-09`
- `2026-07-10`
- `2026-08-17`
- `2026-10-12`
- `2026-11-23`
- `2026-12-07`
- `2026-12-08`
- `2026-12-25`

Para agregar años futuros, sumar la lista anual oficial a `argentinaHolidaysByYear`. No hay reglas perpetuas implícitas.

## Permisos y superficies

Solo el dashboard administrador puede crear o modificar `labReceivedAt`.

Las rutas de clínica y particular no exponen edición de `labReceivedAt`. La clínica puede ver seguimiento ya serializado, y el portal particular solo consulta su seguimiento y notificaciones.

El seguimiento automático creado desde tokens ya no deriva la recepción desde `shippingDate`; usa una fecha operativa interna y queda corregible por admin.

## Rutas y componentes modificados

- `server/lib/study-tracking.ts`
- `server/lib/token-study-tracking.ts`
- `server/routes/admin-study-tracking.fastify.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx`
- `frontend/src/components/dashboard/AdminReportWorkflowViewerCard.tsx`
- `server/lib/email.ts`

## Tests agregados o actualizados

- Dominio de calendario laboral, sábados, domingos, feriados y días puente.
- Cálculo desde `labReceivedAt` y no desde `shippingDate`.
- Recalculo cuando admin modifica `labReceivedAt`.
- Bloqueo de clínica y particular/token para modificar `labReceivedAt`.
- UI admin con label "Entrega en laboratorio".
- Serialización sin campos sensibles como `storagePath`, `signedUrl`, token crudo, cookie, sesión, secretos, stack, cause o details.

## Validaciones

Validaciones solicitadas para ejecutar:

- `pnpm test`
- `pnpm build`
- `pnpm security:public-surface`
- `pnpm --dir frontend lint`
- `pnpm --dir frontend typecheck`
- `pnpm --dir frontend build`

## Riesgos residuales

- Solo está cargado el calendario 2026; los años futuros requieren mantenimiento anual.
- La columna persistida sigue siendo `reception_at`; `labReceivedAt` es el contrato semántico de API/UI.
- Los seguimientos automáticos de tokens sin intervención admin usan fecha operativa del backend hasta que admin confirme la entrega real en laboratorio.
