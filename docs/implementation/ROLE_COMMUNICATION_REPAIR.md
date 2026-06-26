# Reparación de comunicación entre roles

Esta implementación corrige el contrato auditado de comunicación entre roles sin cambiar el modelo de permisos ni agregar migraciones.

## Alcance reparado

- Los cambios de workflow administrativo de informes ahora producen notificación interna cuando el informe tiene un seguimiento vinculado.
- Las solicitudes/resoluciones de tinción especial desde workflow administrativo ahora producen notificación interna cuando existe seguimiento vinculado.
- Los destinos de notificación ya no enrutan genéricamente todo a tokens; los eventos de seguimiento, informes y tinción van al módulo administrativo de informes.
- La campana de notificaciones ya no navega si falla la mutación de marcar como leída, evitando falsos leídos y navegación con estado inconsistente.
- Los controles públicos externos usan semántica nativa de enlace para WhatsApp, mailto, tel y URLs externas.
- Se agregaron pruebas de contrato para bloquear regresiones en navegación, destinos, semántica externa y side-effects de workflow.

## Criterio de seguridad

- No se modifican cookies, sesiones, roles ni reglas de autorización.
- No se agregan migraciones ni tablas nuevas.
- Las notificaciones de workflow se crean con el scope del seguimiento existente: `clinicId`, `reportId` y `particularTokenId` cuando aplica.
- Si un informe todavía no tiene seguimiento vinculado, no se inventa destinatario; se registra warning operacional.

## Validaciones esperadas

Ejecutar antes de merge:

```bash
pnpm typecheck
pnpm typecheck:test
pnpm test
pnpm build
pnpm security:public-surface
pnpm --dir frontend lint
pnpm --dir frontend typecheck
pnpm --dir frontend build
```
