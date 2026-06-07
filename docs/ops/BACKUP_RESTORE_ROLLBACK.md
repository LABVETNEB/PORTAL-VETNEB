# Backup, restore y rollback — Portal VETNEB

Runbook operativo formal para release readiness. Documento obligatorio para
salidas productivas con impacto potencial en datos, storage, runtime o
configuracion.

## 1. Estado y decision

- Este runbook es obligatorio antes de GO produccion.
- Ningun deploy productivo con cambios de DB/storage debe avanzar sin backup
  vigente.
- Si restore o rollback no fueron probados, la decision operativa debe ser
  **NO-GO**.

### Estado actual

| Componente | Estado formal |
|---|---|
| Backup DB Supabase | **PENDIENTE DE VERIFICACION FORMAL** |
| Backup Supabase Storage | **PENDIENTE DE VERIFICACION FORMAL** |
| Restore drill (entorno no productivo) | **PENDIENTE DE EJECUCION** |

No existe evidencia verificada en repo ni en logs de que backup o restore
hayan sido ejecutados y documentados con el entorno de produccion actual.
Estado correcto: PENDIENTE. Bloquea GO produccion para releases con cambios
de DB/storage hasta que se registre evidencia sanitizada formal.

## 2. Alcance

Este runbook cubre:

- Supabase Postgres.
- Supabase Storage (buckets de informes/avatar, si aplica).
- Render backend.
- Render frontend.
- Variables de entorno.
- DNS/dominio, si aplica al release.

## 3. Datos que nunca deben exponerse

No pegar en issues/chats/PRs/capturas/logs:

- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `SUPABASE_DB_URL`
- `SMTP_PASS`
- `GMAIL_API_REFRESH_TOKEN`
- cookies de sesion
- passwords
- tokens particulares
- signed URLs completas
- backups completos descargables
- connection strings

## 4. Evidencia sanitizada permitida

| Tipo | Permitido | Prohibido | Responsable |
|---|---|---|---|
| backup DB | fecha UTC, estado, tamano aproximado, operador | dump completo, URL de conexion, credenciales | DBA/DevOps |
| backup storage | bucket, privacidad, conteo aproximado, fecha | archivos sensibles, signed URLs completas | Backend/DevOps |
| restore test | acta de entorno no productivo, resultado smoke, timestamp | restore en produccion sin control, datos sensibles crudos | DBA/Tech lead |
| rollback app | deploy IDs sanitizados, hora, resultado health | env vars con valor, tokens, capturas con secretos | DevOps |
| rollback DB | decision documentada, metodo, ventana, resultado | comandos destructivos sin aprobacion, dumps en PR | DBA/Tech lead |
| rollback env vars | listado de nombres revertidos, fecha, operador | valores reales de variables | DevOps |
| smoke post-restore | resumen pass/fail por check | passwords, cookies, tokens, signed URLs completas | QA/Tech lead |
| smoke post-rollback | resumen pass/fail y estado final | logs crudos con secretos | QA/Tech lead |

## 5. Preflight antes de release

- [ ] `main` limpio.
- [ ] PRs abiertos: ninguno.
- [ ] CI verde.
- [ ] `pnpm validate:local:schema`.
- [ ] `pnpm smoke:staging`.
- [ ] `pnpm smoke:upload` con credenciales staging, si corresponde.
- [ ] backup DB reciente.
- [ ] backup storage reciente.
- [ ] restore probado.
- [ ] rollback documentado.
- [ ] responsables tecnico y negocio asignados.

## 6. Backup DB Supabase

Pasos operativos:

1. Confirmar proyecto Supabase correcto (`<supabase-project-id>` /
   `<supabase-project-name>`).
2. Registrar fecha/hora UTC de inicio de backup.
3. Ejecutar backup/snapshot/export usando panel Supabase o tooling autorizado
   por el equipo.
4. Verificar estado final (`success`) y tamano aproximado del backup.
5. Registrar evidencia sanitizada en tracker operativo.
6. Confirmar que no se pego dump completo ni connection string en ningun canal.

Nota: si no hay CLI oficial configurada en este repo para backup, ejecutar el
procedimiento desde panel Supabase o herramienta autorizada por la organizacion.

### Evidencia requerida para cerrar backup DB (P0-016)

- [ ] Acceso confirmado al panel Supabase con proyecto productivo correcto.
- [ ] Backup/snapshot iniciado y completado (estado `success`).
- [ ] Registrado: fecha UTC de inicio, estado final, tamano aproximado.
- [ ] Verificado: no se pego dump completo, connection string ni credenciales en ningun canal.
- [ ] Evidencia sanitizada registrada en la tabla de registro operativo (seccion 15 de este doc).
- [ ] Responsable tecnico que ejecuto el backup identificado y registrado.
- [ ] P0-016 cerrado en `docs/production-readiness-evidence.md` con referencia a esta evidencia.

## 7. Backup Supabase Storage

Pasos operativos:

1. Identificar buckets relevantes (`<reports-bucket>`, `<clinic-avatars-bucket>`,
   u otros del release).
2. Validar que los buckets usados por runtime sean privados.
3. Registrar conteo aproximado de objetos, fecha UTC y tamano aproximado (si
   la consola lo permite).
4. No descargar ni adjuntar archivos sensibles en PRs/issues/chats.
5. Adjuntar solo evidencia permitida: nombre de bucket, conteo aproximado,
   estado privado y fecha.

### Evidencia requerida para cerrar backup Storage (P0-016 componente storage)

- [ ] Buckets productivos activos identificados.
- [ ] Verificado que los buckets relevantes son privados (sin lectura publica).
- [ ] Registrado: nombre de bucket, conteo aproximado de objetos, fecha UTC, tamano aproximado.
- [ ] No se adjuntaron signed URLs ni archivos sensibles en ningun canal.
- [ ] Evidencia sanitizada registrada en la tabla de registro operativo (seccion 15 de este doc).
- [ ] Responsable tecnico identificado y registrado.

## 8. Restore test en staging/no productivo

Reglas:

- Restore debe probarse fuera de produccion.
- Usar entorno no productivo controlado (`<staging-restore-env>`).

Pasos minimos:

1. Ejecutar restore de DB en entorno no productivo.
2. Validar esquema y conectividad.
3. Validar login basico.
4. Ejecutar `pnpm smoke:staging`.
5. Ejecutar `pnpm smoke:upload` si hay credenciales de smoke.
6. Registrar resultado final (pass/fail), hora UTC y responsables.

### Checklist restore drill (P0-017)

- [ ] Confirmar que el entorno de restore NO es produccion.
- [ ] Registrar nombre del entorno no productivo utilizado.
- [ ] Restore de DB ejecutado desde backup reciente.
- [ ] Esquema y conectividad validados post-restore.
- [ ] `pnpm validate:local:schema` u equivalente: verde.
- [ ] `pnpm smoke:staging` ejecutado sobre entorno restaurado: resultado registrado.
- [ ] Resultado final registrado: pass/fail, hora UTC, responsable tecnico.
- [ ] No se pegaron dumps ni datos sensibles en evidencia.
- [ ] P0-017 cerrado en `docs/production-readiness-evidence.md` con referencia a esta evidencia.

## 9. Rollback app Render

Pasos operativos:

1. Identificar deploy anterior estable para backend
   (`<backend-deploy-id-previo>`).
2. Identificar deploy anterior estable para frontend
   (`<frontend-deploy-id-previo>`).
3. Ejecutar rollback backend en Render.
4. Ejecutar rollback frontend en Render.
5. Verificar `GET /health` y `GET /api/health`.
6. Verificar CORS/cookies y login basico.
7. Registrar deploy IDs sanitizados, hora UTC y resultado.

No pegar valores reales de env vars en evidencia.

## 10. Rollback DB

Reglas:

- Preferir migraciones backward-compatible.
- Si hay migracion irreversible, el release debe quedar en NO-GO hasta tener
  plan explicito aprobado.
- Rollback DB puede requerir restore desde backup.
- No ejecutar rollback destructivo sin aprobacion de responsable tecnico y
  responsable negocio.

Registrar siempre:

- motivo de rollback DB
- estrategia aplicada
- impacto esperado
- resultado y decision final

## 11. Rollback env vars

Pasos operativos:

1. Capturar estado previo de nombres de variables (sin valores).
2. Revertir cambios desde panel Render/Supabase segun corresponda.
3. No pegar valores en PRs/issues/chats/capturas.
4. Ejecutar smoke posterior.
5. Registrar evidencia sanitizada.

## 12. Criterios de rollback inmediato

Disparar rollback inmediato ante cualquiera de estos casos:

- `/health` falla.
- DB/storage no `up`.
- login admin/clinic falla.
- CORS/cookies falla.
- upload/download falla.
- schema health `degraded`.
- errores 5xx repetidos.
- fuga de token/signed URL/secreto en logs.
- contacto/email critico falla si esta dentro del release.
- dominio HTTPS falla.

## 13. Secuencia de rollback

1. Congelar deploys.
2. Preservar evidencia sanitizada.
3. Notificar responsables tecnico y negocio.
4. Rollback app.
5. Rollback env vars si aplica.
6. Restore DB si corresponde.
7. Restore storage si corresponde.
8. Ejecutar smoke post-rollback.
9. Registrar decision final.

## 14. Smoke posterior a restore/rollback

Comandos PowerShell seguros (placeholders):

```powershell
cd C:\PORTAL-VETNEB
pnpm validate:local:schema
pnpm smoke:staging

$env:SMOKE_BASE_URL = "https://<backend-staging-or-production>"
$env:SMOKE_USERNAME = "<clinic-user>"
$env:SMOKE_PASSWORD = Read-Host "Clinic password"
# Opcional:
# $env:SMOKE_UPLOAD_FILE = "C:\path\to\portal-vetneb-smoke-upload.pdf"

pnpm smoke:upload

Remove-Item Env:\SMOKE_PASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:\SMOKE_UPLOAD_FILE -ErrorAction SilentlyContinue
```

Checks manuales complementarios (si aplica): admin, clinic, particular.

## 15. Registro operativo

| Fecha UTC | Entorno | Accion | Commit/deploy | Responsable tecnico | Responsable negocio | Evidencia sanitizada | Resultado |
|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |

## 16. Decision go/no-go

- GO solo si hay backup vigente + restore probado + rollback app/DB documentado.
- NO-GO si falta backup, restore o rollback.
- GO condicionado solo si no quedan P0 abiertos.
