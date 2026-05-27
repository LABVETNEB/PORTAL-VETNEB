# Production readiness evidence — Portal VETNEB

Documento de evidencia operativa para cierre de auditoria de release readiness.
Este archivo no reemplaza runbooks tecnicos; centraliza evidencia sanitizada y
criterios formales de salida.

## 1. Estado general

- Decision actual: **NO-GO hasta cerrar todos los P0**.
- El codigo ya cuenta con guardrails avanzados (health checks, smoke y schema
  verify), pero **produccion requiere evidencia runtime/staging/produccion**.
- No pegar ni adjuntar secretos, passwords, tokens reales, DB URLs completas,
  service role keys, secretos SMTP/Gmail ni signed URLs completas.
- Toda evidencia debe quedar sanitizada, con timestamp, commit y responsable.

## 2. Commit candidato

| Campo | Valor | Evidencia requerida | Estado |
|---|---|---|---|
| Repo | `LABVETNEB/PORTAL-VETNEB` | URL de repo + hash de commit evaluado | Pendiente |
| Branch base | `main` | PR contra `main` con diff revisable | Pendiente |
| Commit candidato | `a65a43e` | `git show --stat a65a43e` + referencia en PR | Pendiente |
| Working tree local | Debe estar limpio para release cut | `git status --short` sin cambios no intencionales | Pendiente |
| PRs abiertos | Listado vigente al momento de decision | Captura/listado de PRs abiertos y su impacto | Pendiente |
| Ramas remotas no mergeadas | Inventario de ramas activas relevantes | `git branch -r --no-merged origin/main` (sanitizado) | Pendiente |
| CI Backend | Verde sobre commit candidato | Enlace/captura de workflow backend exitoso | Pendiente |
| CI Frontend | Verde sobre commit candidato | Enlace/captura de workflow frontend exitoso | Pendiente |
| Release notes / changelog | Actualizado para salida | Referencia a changelog/notas publicables | Pendiente |

## 3. Matriz P0 — bloqueantes de produccion

| ID | Grupo | Severidad | Estado | Evidencia requerida | Comando PowerShell / accion | Criterio de cierre |
|---|---|---|---|---|---|---|
| P0-001 | CI | P0 | Abierto | Backend y frontend verdes en commit candidato | Revisar runs CI del commit (`gh run list --commit a65a43e`) o panel CI | Ambos pipelines exitosos, sin jobs requeridos en rojo |
| P0-002 | Staging smoke | P0 | Abierto | Smoke autenticado admin/clinic/particular | `pnpm smoke:staging` + evidencia manual sanitizada | Flujos core de los 3 perfiles completan sin error |
| P0-003 | Schema health | P0 | Abierto | Estado de esquema admin en staging | `Invoke-RestMethod "$BackendUrl/api/admin/system/schema-health"` (con sesion valida) | Resultado consistente y sin drift bloqueante |
| P0-004 | Config staging | P0 | Abierto | Variables Render staging configuradas y sanitizadas | Verificacion manual en Render (captura con valores ocultos) | Variables requeridas presentes, sin secretos expuestos |
| P0-005 | Config produccion | P0 | Abierto | Variables Render produccion configuradas y sanitizadas | Verificacion manual en Render (captura con valores ocultos) | Variables requeridas presentes, sin secretos expuestos |
| P0-006 | DB staging | P0 | Abierto | DB staging migrada + `schema:verify` OK | `pnpm schema:verify` sobre entorno staging controlado | Migraciones aplicadas y verify en verde |
| P0-007 | DB produccion | P0 | Abierto | Backup previo antes de migrar | Evidencia de backup previo con fecha/hora | No se migra sin backup confirmado del mismo dia |
| P0-008 | Storage | P0 | Abierto | Supabase Storage privado verificado | Revisión en dashboard + prueba de acceso autenticado | Bucket privado, sin lectura publica no autorizada |
| P0-009 | Upload PDF | P0 | Abierto | Upload PDF funcional en staging | `pnpm smoke:staging` o runbook upload | PDF sube, persiste y queda trazable |
| P0-010 | Signed URL | P0 | Abierto | Signed URL staging sin exposicion en logs | Descarga controlada + revision de logs sanitizados | URLs firmadas no aparecen completas en logs |
| P0-011 | Avatar/logo | P0 | Abierto | Upload de avatar/logo funcional en staging | Ejecutar flujo manual de avatar/logo en staging | Upload/update/delete correcto por permisos esperados |
| P0-012 | Contacto/email | P0 | Abierto | Contacto/email staging E2E o exclusion formal de release | Smoke manual de `/contacto` + decision documentada | Envio confirmado o fuera de alcance aprobado |
| P0-013 | CORS staging | P0 | Abierto | CORS exacto en staging | `Invoke-WebRequest -Method Options "$BackendUrl/api/auth/login" -Headers @{Origin=$Origin;"Access-Control-Request-Method"="POST"}` | Header `Access-Control-Allow-Origin` coincide con frontend staging |
| P0-014 | Cookies staging | P0 | Abierto | Cookies `Secure` y `SameSite=None` en staging HTTPS | Inspeccion de `Set-Cookie` en login staging | Flags correctas en cookies de sesion |
| P0-015 | Seguridad | P0 | Abierto | Smoke cross-tenant / IDOR minimo | Pruebas manuales con sesiones separadas | Sin acceso a recursos de otro tenant |
| P0-016 | Backup | P0 | Abierto | Backup productivo reciente | Evidencia de backup con fecha, tamano y estado | Backup vigente dentro de ventana acordada |
| P0-017 | Restore | P0 | Abierto | Restore probado en staging/no productivo | Acta de restore de prueba (sanitizada) | Restore validado y documentado |
| P0-018 | Rollback app | P0 | Abierto | Rollback app Render documentado | Runbook de rollback con pasos y responsables | Procedimiento repetible validado |
| P0-019 | Rollback DB | P0 | Abierto | Rollback DB documentado | Runbook DB con precondiciones y riesgos | Procedimiento aprobado por responsable tecnico |
| P0-020 | Dominio/HTTPS | P0 | Abierto | Dominio HTTPS productivo operativo | `Invoke-WebRequest "$FrontendUrl"` y certificados validos | Frontend/back con HTTPS valido y sin mixed content critico |
| P0-021 | CORS/cookies prod | P0 | Abierto | CORS y cookies correctas en produccion | `OPTIONS` login + inspeccion de cookies en prod | Login/sesion funcional y politicas correctas |
| P0-022 | Smoke prod | P0 | Abierto | Smoke produccion post-deploy | Runbook productivo ejecutado y firmado | Smoke minimo verde tras deploy |
| P0-023 | Logs | P0 | Abierto | Logs sin secretos ni signed URLs completas | Revision de logs backend sanitizados | Cero exposicion de datos sensibles |
| P0-024 | Legal/comercial | P0 | Abierto | Aprobacion legal/comercial minima | Acta o comentario formal de aprobacion | Riesgo legal/comercial aceptado |
| P0-025 | Gobernanza | P0 | Abierto | Aprobacion responsable tecnico y negocio | Registro de decision firmado | Ambos responsables aprueban salida |

## 4. Evidencia sanitizada requerida

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

## 5. Comandos PowerShell de validacion local

```powershell
cd C:\PORTAL-VETNEB
pnpm install --frozen-lockfile
pnpm validate:local:schema
pnpm --dir frontend lint
pnpm --dir frontend typecheck
pnpm --dir frontend build
pnpm --dir frontend e2e
```

## 6. Comandos PowerShell de staging

Usar placeholders y credenciales de prueba controladas. No imprimir passwords,
tokens ni secretos en consola, CI o capturas.

```powershell
$BackendUrl = "https://portal-vetneb-backend-staging.onrender.com"
$FrontendUrl = "https://portal-vetneb-frontend-staging.onrender.com"
$Origin = $FrontendUrl

Invoke-RestMethod "$BackendUrl/health"
Invoke-RestMethod "$BackendUrl/api/health"

Invoke-WebRequest -Method Options -Uri "$BackendUrl/api/auth/login" -Headers @{
  Origin                         = $Origin
  "Access-Control-Request-Method"  = "POST"
  "Access-Control-Request-Headers" = "content-type"
}
```

## 7. Comandos PowerShell de produccion

Mismo criterio que staging, con placeholders productivos y sin secretos reales.

```powershell
$BackendUrl = "https://<backend-productivo>"
$FrontendUrl = "https://<frontend-productivo>"
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
| NO-GO si falta cualquier P0 | Vigente | Al menos un P0 abierto en matriz | Responsable tecnico |
| GO condicionado solo si no quedan P0 y los P1 tienen responsable y fecha | Pendiente | Lista P1 con owner y ETA documentados | Responsable tecnico + negocio |

## 9. Registro de decision

| Fecha | Commit | Decision | Motivo | Responsable tecnico | Responsable negocio |
|---|---|---|---|---|---|
|  |  |  |  |  |  |
|  |  |  |  |  |  |
|  |  |  |  |  |  |

