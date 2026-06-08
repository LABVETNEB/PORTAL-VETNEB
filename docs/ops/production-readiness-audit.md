# Production readiness audit — Portal VETNEB

Resumen ejecutivo de la auditoría de producción al 2026-06-07.
Evidencia formal detallada: `docs/production-readiness-evidence.md`.
Runbook operativo: `docs/ops/BACKUP_RESTORE_ROLLBACK.md`.

## Estado ejecutivo

| Campo | Valor |
|---|---|
| Fecha | 2026-06-08 |
| Commit evaluado | `33966ee` |
| Decisión | **NO-GO parcial (riesgo reducido)** |
| PRs abiertos | 0 |
| Infraestructura productiva | Operativa |
| Dump externo DB | Ejecutado 2026-06-08 — evidencia sanitizada en runbook sec. 18 |
| Export Storage bucket `reports` | Ejecutado 2026-06-08 — 17 objetos, evidencia sanitizada en runbook sec. 19 |
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
| **Supabase Free plan — backups automaticos NO disponibles. Dump externo DB ejecutado 2026-06-08 (P0-016 parcialmente mitigado). Storage export bucket `reports` ejecutado 2026-06-08.** Dashboard confirma: "Free Plan does not include project backups." Dump externo con pg_dump/pg_dumpall v17.10 ejecutado el 2026-06-08T07:45:48Z fuera del repo (`C:\VETNEB-BACKUPS`, sec. 18). Storage export ejecutado el 20260608-131355, 17 objetos, fuera del repo (`C:\VETNEB-BACKUPS\supabase-storage\`, sec. 19). Riesgo remanente: cifrado/vault dump y ZIP pendientes; restore drill pendiente; backups automaticos no activos. | Cifrar/vault dump y ZIP + ejecutar restore drill (P0-017) + considerar upgrade a Supabase Pro. |
| Storage export bucket `reports`: **EJECUTADO 2026-06-08** — 17 objetos, ~3.11 MB, ZIP SHA-256 registrado, evidencia sanitizada en runbook sec. 19. Riesgo remanente: cifrado/vault del ZIP pendiente; bucket `reports` con `Policies = 0` — confirmar que acceso anonimo esta desactivado. | Cifrar/vault ZIP en `C:\VETNEB-BACKUPS\supabase-storage\`. Confirmar privacidad del bucket. Ver sec. 19 del runbook. |
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
