# Production readiness evidence — Portal VETNEB

Documento de evidencia operativa para cierre de auditoria de release readiness.
Este archivo no reemplaza runbooks tecnicos; centraliza evidencia sanitizada y
criterios formales de salida.

## 1. Estado general

- Snapshot de auditoría sin credenciales: `docs/production-readiness-snapshot-2026-05-27.md`
- Decision actual: **NO-GO parcial — infraestructura productiva verificada, pendientes operativos documentados abajo**.
- El codigo ya cuenta con guardrails avanzados (health checks, smoke y schema
  verify), y produccion tiene infraestructura operativa confirmada.
- No pegar ni adjuntar secretos, passwords, tokens reales, DB URLs completas,
  service role keys, secretos SMTP/Gmail ni signed URLs completas.
- Toda evidencia debe quedar sanitizada, con timestamp, commit y responsable.

> [!IMPORTANT]
> **Secreto expuesto — accion requerida antes de declarar cierre 100%:**
> Si en algun momento un secreto real (service role key, SMTP pass, token OAuth)
> fue expuesto en git, repo, logs, issues o PR, debe estar rotado en el proveedor
> correspondiente (Supabase, Google, Render) antes de declarar GO produccion.
> Verificar historial de commits y variables de entorno Render.

> [!IMPORTANT]
> **TRUST_PROXY — configuracion correcta verificada:**
> `TRUST_PROXY=1` es el valor correcto para Render (reverse proxy numerico).
> `TRUST_PROXY=true` rompe el startup del servidor; no usar en ningun entorno.
> Valor documentado y corregido en `.env.example`.

## 2. Commit candidato

| Campo | Valor | Evidencia requerida | Estado |
|---|---|---|---|
| Repo | `LABVETNEB/PORTAL-VETNEB` | URL de repo + hash de commit evaluado | Verificado |
| Branch base | `main` | PR contra `main` con diff revisable | Verificado |
| Commit candidato | `bda510b` | `git show --stat bda510b` | Verificado |
| Working tree local | Limpio | `git status --short` sin cambios no intencionales | Verificado — 0 PRs abiertos |
| PRs abiertos | Ninguno al 2026-06-07 | Listado de PRs vigente | Verificado — 0 PRs abiertos |
| Ramas remotas no mergeadas | Inventario de ramas activas relevantes | `git branch -r --no-merged origin/main` (sanitizado) | Pendiente |
| CI Backend | Verde sobre commit candidato | Enlace/captura de workflow backend exitoso | Pendiente |
| CI Frontend | Verde sobre commit candidato | Enlace/captura de workflow frontend exitoso | Pendiente |
| Release notes / changelog | Actualizado para salida | Referencia a changelog/notas publicables | Pendiente |

## 3. Infraestructura productiva verificada — 2026-06-07

| Componente | URL | Estado | Verificado por |
|---|---|---|---|
| Frontend produccion | `https://vetneb.com.ar` | OK | Auditoría Claude 2026-06-07 |
| Backend API | `https://api.vetneb.com.ar` | OK | Auditoría Claude 2026-06-07 |
| Health endpoint `/health` | `https://api.vetneb.com.ar/health` | 200 OK | Auditoría Claude 2026-06-07 |
| Database | Reportado por `/health` | `up` | Auditoría Claude 2026-06-07 |
| Storage | Reportado por `/health` | `up` | Auditoría Claude 2026-06-07 |
| PC (escritorio) | Navegador | Funciona | Auditoría Claude 2026-06-07 |
| Móvil | Navegador móvil | Funciona | Auditoría Claude 2026-06-07 |
| Backend Render plan | Render Starter | Activo | Auditoría Claude 2026-06-07 |
| TLS API | Certificate Issued | Válido | Auditoría Claude 2026-06-07 |

## 4. Matriz P0 — bloqueantes de produccion

| ID | Grupo | Severidad | Estado | Evidencia requerida | Comando PowerShell / accion | Criterio de cierre |
|---|---|---|---|---|---|---|
| P0-001 | CI | P0 | Pendiente | Backend y frontend verdes en commit candidato | Revisar runs CI del commit (`gh run list --commit bda510b`) o panel CI | Ambos pipelines exitosos, sin jobs requeridos en rojo |
| P0-002 | Staging smoke | P0 | Pendiente | Smoke autenticado admin/clinic/particular | `pnpm smoke:staging` (modo autenticado opcional con `SMOKE_*`) + evidencia manual sanitizada | Flujos core de los 3 perfiles completan sin error; si faltan credenciales, checks autenticados quedan en SKIP |
| P0-003 | Schema health | P0 | Pendiente | Estado de esquema admin en staging (smoke autenticado) | `pnpm smoke:staging` con `SMOKE_ADMIN_USERNAME` y `SMOKE_ADMIN_PASSWORD` (check `/api/admin/system/schema-health`) | `status=ok` para cierre; `status=degraded` mantiene P0 Abierto y evidencia runtime/staging pendiente |
| P0-004 | Config staging | P0 | Pendiente | Variables Render staging configuradas y sanitizadas | Verificacion manual en Render (captura con valores ocultos) | Variables requeridas presentes, sin secretos expuestos |
| P0-005 | Config produccion | P0 | **Parcialmente verificado** | Variables Render produccion configuradas y sanitizadas | Verificado: `CORS_ORIGIN=https://vetneb.com.ar`, `TRUST_PROXY=1`. Pendiente: captura formal con valores ocultos | Variables requeridas presentes, sin secretos expuestos |
| P0-006 | DB staging | P0 | Pendiente | DB staging migrada + `schema:verify` OK | `pnpm schema:verify` sobre entorno staging controlado | Migraciones aplicadas y verify en verde |
| P0-007 | DB produccion | P0 | Pendiente | Backup previo antes de migrar | Evidencia de backup previo con fecha/hora | No se migra sin backup confirmado del mismo dia |
| P0-008 | Storage | P0 | **Parcialmente verificado** | Supabase Storage privado verificado + evidencia de `storagePath/storage_path` | `/health` reporta `storage=up`. Pendiente: `pnpm smoke:upload` + revision dashboard storage | Bucket privado, sin lectura publica no autorizada; evidencia runtime/staging pendiente |
| P0-009 | Upload PDF | P0 | Pendiente | Upload PDF funcional en staging con reporte persistido | `pnpm smoke:upload` | Login clinic + upload OK + `reportId` trazable; evidencia runtime/staging pendiente |
| P0-010 | Signed URL | P0 | Pendiente | Signed URL staging validada sin exposicion en logs | `pnpm smoke:upload` (esperar `signedUrl=present`) + revision de logs sanitizados | URLs firmadas no aparecen completas en logs; evidencia runtime/staging pendiente |
| P0-011 | Avatar/logo | P0 | Pendiente | Upload de avatar/logo funcional en staging | Ejecutar flujo manual de avatar/logo en staging | Upload/update/delete correcto por permisos esperados |
| P0-012 | Contacto/email | P0 | Pendiente | Contacto/email staging E2E o exclusion formal de release. Ver criterios y evidencia permitida en `docs/legal-commercial-readiness.md` secciones 5 (LC-003, LC-004) y 6. | Smoke manual de `/contacto` + decision documentada | Envio confirmado (smoke E2E sanitizado) o exclusion aprobada registrada en `docs/legal-commercial-readiness.md` |
| P0-013 | CORS staging | P0 | Pendiente | CORS exacto en staging (preflight OPTIONS) | `pnpm smoke:staging` (check `OPTIONS /api/auth/login` con `Origin=$FrontendUrl`) | `Access-Control-Allow-Origin` coincide con frontend staging y `Access-Control-Allow-Credentials=true`; evidencia runtime/staging pendiente |
| P0-014 | Cookies staging | P0 | Pendiente | Cookies `Secure` y `SameSite=None` en staging HTTPS | `pnpm smoke:staging` (logins autenticados opcionales admin/clinic validan flags de cookie) | Flags correctas en cookies de sesion; evidencia runtime/staging pendiente |
| P0-015 | Seguridad | P0 | Pendiente | Smoke cross-tenant / IDOR minimo + contrato `test/security-cross-tenant-idor-contract.test.ts` + matrices `docs/security/RBAC_MATRIX.md`, `docs/security/ENDPOINT_PERMISSION_MATRIX.md`, `docs/security/ENDPOINT_TEST_MATRIX.md` | `pnpm test` (guardrails) + revision de matrices + pruebas manuales con sesiones separadas en staging/produccion | Sin acceso a recursos de otro tenant; evidencia runtime/staging pendiente |
| P0-016 | Backup | P0 | **Pendiente — sin evidencia formal. Supabase Free plan no incluye project backups. Produccion funcional sin backups automaticos. Mitigacion requerida: dump externo inmediato.** | Supabase dashboard confirma: "Free Plan does not include project backups." Backup automatico no disponible. Dump externo no ejecutado aun. Storage backup/export pendiente. Checklist de mitigacion temporal en `docs/ops/BACKUP_RESTORE_ROLLBACK.md` seccion 17. | Ejecutar dump externo desde entorno local seguro + registrar evidencia sanitizada en seccion 15 del runbook. No declarar GO sin dump ejecutado y evidencia registrada. | Dump externo ejecutado, guardado fuera del repo y cifrado; evidencia sanitizada formal registrada en runbook. No marcar GO hasta entonces. |
| P0-017 | Restore | P0 | **Pendiente — sin evidencia formal** | Restore drill pendiente de ejecucion en entorno seguro/no productivo. No existe acta de restore verificada. Checklist de cierre en `docs/ops/BACKUP_RESTORE_ROLLBACK.md` seccion 8. | Ejecutar restore drill en entorno no productivo + registrar resultado (pass/fail, hora UTC, responsable tecnico) en seccion 15 del runbook | Restore drill ejecutado, documentado y acta sanitizada registrada en runbook |
| P0-018 | Rollback app | P0 | Pendiente | Rollback app Render documentado | `docs/ops/BACKUP_RESTORE_ROLLBACK.md` (pasos, responsables y evidencia sanitizada) | Procedimiento repetible validado |
| P0-019 | Rollback DB | P0 | Pendiente | Rollback DB documentado | `docs/ops/BACKUP_RESTORE_ROLLBACK.md` (criterio NO-GO, restore y decision registrada) | Procedimiento aprobado por responsable tecnico |
| P0-020 | Dominio/HTTPS | P0 | **Verificado** | Dominio HTTPS productivo operativo | Frontend `https://vetneb.com.ar` OK, API `https://api.vetneb.com.ar` OK, TLS Certificate Issued | Frontend/back con HTTPS valido y sin mixed content critico |
| P0-021 | CORS/cookies prod | P0 | Pendiente | CORS y cookies correctas en produccion | `OPTIONS` login + inspeccion de cookies en prod | Login/sesion funcional y politicas correctas |
| P0-022 | Smoke prod | P0 | Pendiente | Smoke produccion post-deploy | Runbook productivo ejecutado y firmado | Smoke minimo verde tras deploy |
| P0-023 | Logs | P0 | Pendiente | Logs sin secretos ni signed URLs completas | Revision de logs backend sanitizados | Cero exposicion de datos sensibles |
| P0-024 | Legal/comercial | P0 | Pendiente | Aprobacion legal/comercial minima. Checklist completa en `docs/legal-commercial-readiness.md` (LC-001 a LC-015). | Acta o comentario formal de aprobacion + evidencia sanitizada por criterio | LC-001 a LC-015 con evidencia o exclusion aprobada; ver `docs/legal-commercial-readiness.md` |
| P0-025 | Gobernanza | P0 | Pendiente | Aprobacion responsable tecnico y negocio. Ver registro de aprobacion en `docs/legal-commercial-readiness.md` seccion 11. | Registro de decision con fecha, commit, responsable tecnico y responsable negocio | Ambos responsables aprueban salida; evidencia en registro de aprobacion de `docs/legal-commercial-readiness.md` |

## 5. Evidencia sanitizada requerida

| Evidencia | Formato permitido | Formato prohibido | Responsable |
|---|---|---|---|
| CI verde | URL de run + captura con jobs en verde | Logs con secretos/token de CI | Tech lead / DevOps |
| Render env vars | Captura con valores ocultos y nombres visibles | Captura con valores completos/copiables | DevOps |
| Supabase DB | Captura de estado + resultado de verify sanitizado | Connection string completa / credenciales | Backend owner |
| Supabase Storage | Captura de policy/bucket + prueba funcional | URLs firmadas completas en texto plano | Backend owner |
| smoke admin | Log sanitizado + timestamp + commit | Cookies, token o datos sensibles de usuarios | QA/Tech lead |
| smoke clinic | Log sanitizado + timestamp + commit | Sesiones/cookies/token reales | QA/Tech lead |
| smoke particular | Log sanitizado + timestamp + commit | Datos personales sin anonimizar | QA/Tech lead |
| smoke contacto | Evidencia de envio y recepcion sin secretos | Correos completos con datos sensibles sin redaccion | QA/Negocio |
| smoke upload/download | Evidencia de upload/download con IDs anonimizados | Signed URLs completas | QA/Backend |
| logs backend | Extracto con redaccion y correlacion temporal | Secretos, passwords, tokens, signed URLs completas | DevOps |
| backup | Ticket/acta con fecha-hora, estado y responsable | Dump sin cifrar compartido fuera de canal seguro | DBA/DevOps |
| restore | Resultado de restore de prueba no productiva | Restore en produccion sin control ni evidencia | DBA/DevOps |
| rollback | Runbook + evidencia de simulacion o ejecucion controlada | Procedimiento informal sin versionado | DevOps |
| aprobacion legal/comercial | Acta o comentario formal con fecha | Aprobacion verbal no registrada | Negocio/Legal |

## 6. Comandos PowerShell de validacion local

```powershell
cd C:\PORTAL-VETNEB
pnpm install --frozen-lockfile
pnpm validate:local:schema
pnpm --dir frontend lint
pnpm --dir frontend typecheck
pnpm --dir frontend build
pnpm --dir frontend e2e
```

## 7. Comandos PowerShell de produccion

```powershell
$BackendUrl = "https://api.vetneb.com.ar"
$FrontendUrl = "https://vetneb.com.ar"
$Origin = $FrontendUrl

Invoke-RestMethod "$BackendUrl/health"
Invoke-RestMethod "$BackendUrl/api/health"

Invoke-WebRequest -Method Options -Uri "$BackendUrl/api/auth/login" -Headers @{
  Origin                         = $Origin
  "Access-Control-Request-Method"  = "POST"
  "Access-Control-Request-Headers" = "content-type"
}
```

## 8. Checklist go/no-go

| Criterio | Estado | Evidencia | Aprobador |
|---|---|---|---|
| GO solo si todos los P0 estan cerrados con evidencia | Pendiente | Matriz P0 completa + anexos sanitizados | Responsable tecnico + negocio |
| NO-GO si falta cualquier P0 | Vigente | P0-001 a P0-025: mayoria pendiente | Responsable tecnico |
| GO condicionado solo si no quedan P0 y los P1 tienen responsable y fecha | Pendiente | Lista P1 con owner y ETA documentados | Responsable tecnico + negocio |

## 9. Registro de decision

| Fecha | Commit | Decision | Motivo | Responsable tecnico | Responsable negocio |
|---|---|---|---|---|---|
| 2026-06-07 | `bda510b` | NO-GO parcial | Infraestructura productiva OK. Pendientes: CI formal, staging smoke autenticado, backup/restore, smoke prod documentado, aprobacion legal/gobernanza | VETNEB | — |
|  |  |  |  |  |  |
|  |  |  |  |  |  |
