# PR feat/professional-bank-eligibility

## Resumen

Se implemento la elegibilidad derivada para el Banco de Profesionales sobre la
superficie publica existente de profesionales (`/api/public/professionals`).
La regla ya no usa fecha de carga informativa, fecha de creacion del caso ni
texto del perfil publico: el filtro deriva de entregas/admin report events
existentes y se evalua dinamicamente en cada consulta.

## Regla de negocio implementada

Una clinica/profesional aparece en el banco publico solo si:

- tiene perfil publico elegible segun los controles ya existentes;
- tiene al menos un informe de histopatologia entregado por administracion;
- la ultima entrega admin de histopatologia esta dentro de una ventana rolling
  de 3 meses desde `NOW()`.

La condicion efectiva es:

```sql
lastHistopathologyReportDeliveredAt >= NOW() - INTERVAL '3 months'
```

## Fuente de verdad para entrega de informe

Fuente primaria:

- `report_status_history.created_at`, filtrado por eventos con
  `changed_by_admin_user_id IS NOT NULL` y `to_status IN ('uploaded', 'delivered')`.

Fallback de compatibilidad:

- `reports.status_changed_at`, solo cuando `status_changed_by_admin_user_id IS NOT NULL`
  y `current_status IN ('uploaded', 'delivered')`.

Justificacion: en este repo, la carga admin de informes es la entrega final al
cliente. El flujo de admin upload persiste `createdByAdminUserId`, escribe
historial de estado en la misma transaccion y dispara el flujo
`report_delivered`/tracking entregado cuando corresponde.

No se usa `reports.upload_date`, `reports.created_at`, fecha de caso de
seguimiento, texto de especialidad publica ni estado manual de perfil.

## Definicion de estudio histopatologico

La definicion usa el catalogo canonico existente en
`server/lib/report-study-types.ts`:

- `histopatologia`

Se agrego `isHistopathologyReport(report)` para mantener la regla testeable y
evitar inferencias por texto libre como `ILIKE '%histopat%'`.

## Aprobacion inmediata

La aprobacion inmediata se logra por derivacion:

- `adminReportsNativeRoutes` ya llama `upsertReport` con `createdByAdminUserId`.
- `upsertReport` inserta el evento de estado inicial con atribucion admin.
- La consulta publica vuelve a evaluar el SQL contra ese dato en la siguiente
  lectura.

No se agrego booleano persistido ni estado duplicado.

## Salida automatica a los 3 meses

La salida automatica se resuelve dinamicamente con SQL:

```sql
>= NOW() - INTERVAL '3 months'
```

No se agrego cron, job ni campo booleano que pueda quedar stale.

## Archivos tocados

- `server/db-public-professionals.ts`
- `server/lib/professional-bank-eligibility.ts`
- `test/professional-bank-eligibility.test.ts`
- `test/public-professionals-db-contract.test.ts`
- `test/public-professionals-histopathology-eligibility.test.ts`
- `test/public-professionals-histopathology-sql-drift.test.ts`
- `docs/pr-history/PR-feat-professional-bank-eligibility.md`

## Tests y comandos

- `node --experimental-strip-types --experimental-specifier-resolution=node --test test/professional-bank-eligibility.test.ts test/public-professionals-histopathology-eligibility.test.ts test/public-professionals-histopathology-sql-drift.test.ts test/public-professionals-db-contract.test.ts`
- `pnpm.cmd typecheck`
- `pnpm.cmd typecheck:test`
- `pnpm.cmd --dir frontend lint`
- `pnpm.cmd --dir frontend typecheck`
- `pnpm.cmd test`
- `pnpm.cmd build`
- `pnpm.cmd security:public-surface`

Nota operativa: PowerShell bloqueo `pnpm.ps1` por ExecutionPolicy, por eso se
uso `pnpm.cmd`.

## Resultados

- Targeted eligibility/SQL tests: 19/19 pass.
- Backend typecheck: pass.
- Test typecheck: pass.
- Frontend lint: pass.
- Frontend typecheck: pass.
- Full backend test suite: 2250/2250 pass.
- Root backend build: pass.
- Public surface audit: pass.

`pnpm --dir frontend build` no se ejecuto, respetando la instruccion de no
ejecutarlo si puede pedir red por Google Fonts. El audit de superficie publica
dejo la nota esperada de que no existen assets `.next` construidos.

## Riesgos

- Informes historicos sin atribucion admin en `report_status_history` o
  `reports.status_changed_by_admin_user_id` no habilitan el banco. Esto es
  intencional para no inventar entregas.
- Si en el futuro "uploaded" deja de significar entrega final por administracion,
  habra que separar una marca explicita de entrega antes de cambiar esta regla.
- No se agregaron indices por instruccion de no tocar schema/migraciones.

## Rollback

Revertir los archivos listados arriba. No hay migracion ni cambio de schema que
deshacer.

## Estado final

Implementado y validado. Elegibilidad derivada, sin cron/job, sin booleano
persistido y sin migracion.

## Superficies no tocadas

Confirmado: no se tocaron auth, cookies, sesiones, CSRF/trusted-origin, CORS,
CSP, signed URLs, `storagePath`, WebAuthn/passkeys, mobile fixes, notificaciones
generales ni WhatsApp de tincion especial.

No hubo migracion. La elegibilidad es derivada desde datos existentes.
