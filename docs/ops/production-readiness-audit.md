# Production readiness audit — Portal VETNEB

Resumen ejecutivo de la auditoría de producción al 2026-06-07.
Evidencia formal detallada: `docs/production-readiness-evidence.md`.
Runbook operativo: `docs/ops/BACKUP_RESTORE_ROLLBACK.md`.

## Estado ejecutivo

| Campo | Valor |
|---|---|
| Fecha | 2026-06-07 |
| Commit evaluado | `bda510b` |
| Decisión | **NO-GO parcial** |
| PRs abiertos | 0 |
| Infraestructura productiva | Operativa |
| Pendientes bloqueantes | Documentados abajo |

## Infraestructura productiva confirmada

- Frontend: `https://vetneb.com.ar` — OK (PC y móvil).
- API backend: `https://api.vetneb.com.ar` — OK.
- Health `/health`: 200 OK, `database=up`, `storage=up`.
- TLS: Certificate Issued en API.
- Backend Render: plan Starter activo.

## Configuración de entorno corregida

| Variable | Valor correcto | Observación |
|---|---|---|
| `CORS_ORIGIN` | `https://vetneb.com.ar` | Actualizado de staging a producción |
| `TRUST_PROXY` | `1` | `true` rompe startup — valor numérico requerido en Render |
| `NEXT_PUBLIC_API_URL` | `https://api.vetneb.com.ar` | Actualizado de staging |
| `NEXT_PUBLIC_SITE_URL` | `https://vetneb.com.ar` | Actualizado de staging |

## Riesgos remanentes

### P0 — bloqueantes activos

| Riesgo | Acción requerida |
|---|---|
| Secreto expuesto en historial git o Render | Rotar en Supabase/Google/Render **antes** de declarar GO |
| CI formal no verificado sobre `bda510b` | Confirmar runs de backend-ci y frontend-ci en GitHub Actions |
| Staging smoke autenticado pendiente | Ejecutar `pnpm smoke:staging` con credenciales admin/clinic/particular |
| Schema health (`/api/admin/system/schema-health`) no verificado | Smoke admin con credenciales reales |
| **Supabase Free plan — backups automaticos NO disponibles.** Dashboard confirma: "Free Plan does not include project backups." Produccion funcional pero sin respaldo automatico activo. Riesgo operativo critico: perdida de datos no recuperable sin dump externo. Mitigacion temporal requerida: dump externo inmediato desde entorno local seguro. Alternativa: upgrade a Supabase Pro para habilitar backups automaticos. Ver checklists en `docs/ops/BACKUP_RESTORE_ROLLBACK.md` seccion 17. | Ejecutar dump externo desde entorno local seguro + almacenar cifrado fuera del repo + registrar evidencia sanitizada. O hacer upgrade a plan de pago. |
| Storage backup/export: **PENDIENTE** — dump DB no cubre objetos de Storage. Bucket `reports` detectado con `Policies = 0`. | Definir y ejecutar proceso de export de objetos. Verificar acceso anonimo desactivado. Ver checklist en `docs/ops/BACKUP_RESTORE_ROLLBACK.md` seccion 17. |
| Restore drill: **PENDIENTE DE EJECUCION EN ENTORNO NO PRODUCTIVO** — no existe acta verificada | Ejecutar restore drill fuera de produccion. Seguir checklist en `docs/ops/BACKUP_RESTORE_ROLLBACK.md` seccion 17. |
| Smoke producción post-deploy no documentado | Ejecutar runbook y firmar evidencia sanitizada |
| CORS/cookies en producción no verificados con login real | Smoke login con sesión real en HTTPS producción |
| Aprobación legal/comercial pendiente | Completar `docs/legal-commercial-readiness.md` LC-001 a LC-015 |
| Gobernanza — aprobación responsable técnico + negocio | Registrar en sección 11 de `docs/legal-commercial-readiness.md` |

### P1 — no bloqueantes a seguir

| Riesgo | Owner sugerido | ETA |
|---|---|---|
| Monitoreo externo (uptime/alertas 5xx) | DevOps | Post-GO |
| www redirect `www.vetneb.com.ar` → `vetneb.com.ar` (si aplica) | DevOps | Post-GO |
| Rotación de credenciales de prueba manuales | Tech lead | Post-GO |
| Baseline de métricas alineada con `docs/ops/METRICS_BASELINE.md` | DevOps | Post-GO |
| Retención/limpieza de objetos Storage huérfanos | Backend owner | Post-GO |

## Próximos PRs chicos sugeridos

| PR | Scope | Prioridad |
|---|---|---|
| `ops: document staging smoke authenticated evidence` | Evidencia smoke staging autenticado | P0 |
| `ops: document backup restore evidence 2026` | Acta backup/restore con fecha y responsable | P0 |
| `ops: document production smoke post-deploy` | Runbook firmado post-deploy | P0 |
| `docs: close legal commercial readiness LC-001-LC-015` | Completar checklist legal/comercial | P0 |
| `ops: add external uptime monitoring` | Configurar monitoreo uptime externo | P1 |

## Criterio de cierre 100%

GO producción se puede declarar únicamente cuando:

1. Todos los P0 de `docs/production-readiness-evidence.md` tienen evidencia sanitizada.
2. Ningun secreto real está expuesto; todos los secretos afectados están rotados.
3. `pnpm test`, `pnpm build` y `pnpm -C frontend build` verdes en `bda510b`.
4. Smoke producción post-deploy ejecutado y firmado.
5. Responsable técnico y responsable de negocio registran aprobación en
   `docs/legal-commercial-readiness.md` sección 11.
