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
| Backup automatico Supabase | **NO DISPONIBLE — Free plan** |
| Dump externo DB (mitigacion temporal) | **EJECUTADO Y VERIFICADO — 2026-06-08** |
| Export Supabase Storage (bucket `reports`) | **EJECUTADO Y VERIFICADO — 2026-06-08** |
| Restore drill (entorno no productivo) | **PENDIENTE DE EJECUCION** |

Dump externo de la DB de produccion ejecutado el 2026-06-08 fuera del repo
con pg_dump/pg_dumpall v17.10 desde Windows PowerShell. Archivos almacenados
en `C:\VETNEB-BACKUPS` (fuera del repositorio, no versionados).
Evidencia sanitizada registrada en secciones 17, 18 y 19 de este documento.
Storage export del bucket `reports` ejecutado el 2026-06-08 fuera del repo.
Restore drill sigue pendiente.

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
| 2026-06-08T07:45:48Z | Produccion (DB externa) | Dump externo DB — pg_dump/pg_dumpall v17.10, Windows PowerShell | 1bbac76 | VETNEB | — | Ver seccion 18 — sha256 de archivos registrado, sin secretos | COMPLETADO |
| 2026-06-08T13:13:55Z | Produccion (Storage externo) | Export Storage bucket `reports` — PowerShell + Supabase Storage REST API | 33966ee | VETNEB | — | Ver seccion 19 — ZIP SHA-256 registrado, 17 objetos, sin secretos ni paths privados | COMPLETADO |
|  |  |  |  |  |  |  |  |

## 16. Decision go/no-go

- GO solo si hay backup vigente + restore probado + rollback app/DB documentado.
- NO-GO si falta backup, restore o rollback.
- GO condicionado solo si no quedan P0 abiertos.

---

## 17. Mitigacion temporal — Supabase Free plan sin backups automaticos

### Estado observado

Produccion funciona sobre **Supabase Free plan**. El dashboard de Supabase
confirma: _"Free Plan does not include project backups."_

Estado formal:

| Componente | Estado |
|---|---|
| Backup automatico Supabase | **NO DISPONIBLE — Free plan** |
| Dump externo DB (mitigacion temporal) | **EJECUTADO Y VERIFICADO — 2026-06-08** |
| Restore drill en entorno no productivo | **PENDIENTE DE EJECUCION** |
| Export Storage bucket `reports` (mitigacion temporal) | **EJECUTADO Y VERIFICADO — 2026-06-08** |

Dump externo ejecutado el 2026-06-08. Archivos fuera del repo en
`C:\VETNEB-BACKUPS`. Evidencia sanitizada en seccion 18.
Storage export del bucket `reports` ejecutado el 2026-06-08. Evidencia
sanitizada en seccion 19. Restore drill sigue pendiente.
Produccion funcional. Sin backups automaticos activos — riesgo operativo
remanente hasta completar restore drill y cifrado/vault del ZIP de Storage.

### Checklist — dump externo seguro (mitigacion temporal)

Ejecutar desde entorno local seguro con acceso a la DB de produccion:

- [x] Confirmar que el entorno local tiene acceso autorizado a la DB de produccion.
- [x] Generar dump completo de la DB desde entorno local seguro (no desde este repo).
- [x] Guardar el dump **fuera del repo** — no versionar en git.
- [ ] Cifrar el archivo dump o almacenarlo en vault/drive seguro con acceso restringido.
- [x] Registrar fecha y hora UTC del dump.
- [x] Registrar responsable real cuando exista (no inventar).
- [x] Registrar tamano aproximado y hash del archivo si se calcula (opcional pero recomendado).
- [x] Confirmar que el archivo dump no contiene secretos expuestos en texto plano en este doc.
- [x] Registrar evidencia sanitizada en la tabla de registro operativo (seccion 15 de este doc).

> Pendiente: cifrado/vault del archivo dump en `C:\VETNEB-BACKUPS`.

### Checklist — restore drill en entorno no productivo

- [ ] Confirmar que el entorno de restore **NO es produccion**.
- [ ] Crear entorno/proyecto Supabase no productivo dedicado para el drill.
- [ ] Restaurar el dump en el entorno no productivo.
- [ ] Validar conectividad y tablas criticas post-restore.
- [ ] Validar migraciones Drizzle si aplica (`pnpm schema:verify` apuntando al entorno no productivo).
- [ ] Registrar resultado final: pass/fail, hora UTC y responsable tecnico real.
- [ ] Registrar evidencia sanitizada (sin datos sensibles) en la tabla de registro operativo.
- [ ] No ejecutar restore sobre produccion sin autorizacion explicita.

### Nota — Storage no queda cubierto por dump DB

El dump de la base de datos Postgres **no incluye objetos de Supabase Storage**.
Los archivos almacenados en buckets (ej: reportes PDF, avatares) requieren un
proceso de export/backup separado.

### Checklist — Storage (bucket `reports` y otros)

- [ ] Confirmar que el bucket `reports` (y cualquier otro bucket productivo) es privado.
- [ ] Revisar que `Policies = 0` esta documentado con su significado real: sin
  politicas RLS definidas en el bucket — implica que el acceso depende
  exclusivamente del service role key; confirmar que ningun acceso anonimo o
  publico esta activo.
- [x] Definir y ejecutar procedimiento de export/backup de objetos del bucket —
  PowerShell + Supabase Storage REST API, archivos en `C:\VETNEB-BACKUPS\supabase-storage\`.
- [x] No versionar archivos sensibles del bucket en este repo — ZIP almacenado fuera del repo.
- [x] Registrar evidencia sanitizada (nombre de bucket, conteo, fecha UTC) en
  tabla de registro operativo (seccion 15) y evidencia detallada en seccion 19.

---

## 18. Evidencia sanitizada — dump externo DB 2026-06-08

Dump ejecutado fuera del repo el 2026-06-08. Archivos almacenados en
`C:\VETNEB-BACKUPS` (nunca versionados en git).

| Campo | Valor |
|---|---|
| Timestamp dump | 2026-06-08T07:45:48Z |
| Plan Supabase | Free |
| Herramienta | pg_dump / pg_dumpall v17.10 |
| Entorno ejecucion | Windows PowerShell — entorno local seguro |
| Ubicacion archivos | Fuera del repo — `C:\VETNEB-BACKUPS` |
| Repo verificado limpio | Si — `git ls-files backups/` sin salida |
| Cifrado/vault | Pendiente |

### Archivos del dump (evidencia de integridad — sin secretos)

| Archivo | Tamano (bytes) | SHA-256 |
|---|---|---|
| `roles_20260608-074548.sql` | 6749 | `9B45D04077DB38249D18374E30459DB96911550849EBB45D2EE7315617909456` |
| `schema_20260608-074548.sql` | 256633 | `E3316F2E5218FD21A7FBF7224484483339CFC71DCB0456A5144A893D0E3C4AA3` |
| `data_20260608-074548.dump` | 63214 | `7ED8F31371168879CCECB5D68148AE7CFF7858FEDB21AD26F6FED97D44DE83C8` |
| `vetneb-supabase-db-20260608-074548.zip` | 74260 | `B35559EF0C5E0A1E3479B63850CD9B028660B31B9F60EA3F98952EE63195E70B` |

> Nota: los hashes SHA-256 permiten verificar integridad futura del dump.
> No se incluye contenido SQL, connection strings, passwords ni secretos en este doc.

### Archivo local previo movido fuera del repo

El archivo `backups/production/portal-vetneb-prod-20260520-134052.dump` que
existia localmente **no estaba versionado** (`git ls-files` sin salida).
Fue movido a `C:\VETNEB-BACKUPS\legacy-local\` antes de este PR.
El repo queda sin dumps internos.

### Pendientes post-dump

- [ ] Cifrar o mover a vault seguro los archivos en `C:\VETNEB-BACKUPS`.
- [ ] Ejecutar restore drill en entorno no productivo (P0-017).
- [x] Storage export ejecutado 2026-06-08 — bucket `reports`, 17 objetos, evidencia sanitizada en seccion 19.
- [ ] Hacer upgrade a Supabase Pro para habilitar backups automaticos (alternativa permanente).

---

## 19. Evidencia sanitizada — Storage export bucket `reports` 2026-06-08

Export ejecutado fuera del repo el 2026-06-08 mediante PowerShell nativo y
Supabase Storage REST API con service role key. Archivos almacenados en
`C:\VETNEB-BACKUPS\supabase-storage\` (nunca versionados en git).
Manifest privado local generado (manifest-private-local.json) — no versionado,
no compartido; puede contener paths internos de objetos del bucket.

| Campo | Valor |
|---|---|
| Timestamp export | 20260608-131355 (local) |
| Bucket | `reports` |
| Total objetos exportados | 17 |
| Tamano total objetos | 3,261,845 bytes (~3.11 MB) |
| Metodo | PowerShell nativo + Supabase Storage REST API |
| Entorno ejecucion | Windows PowerShell — entorno local seguro |
| Ubicacion archivos | Fuera del repo — `C:\VETNEB-BACKUPS\supabase-storage\` |
| Manifest privado local | Existe — no versionado, no compartido |
| Repo verificado limpio | Si — sin archivos de export en git |
| Cifrado/vault ZIP | Pendiente |

### Archivo ZIP del export (evidencia de integridad — sin secretos)

| Archivo | Tamano (bytes) | SHA-256 |
|---|---|---|
| `vetneb-storage-reports-20260608-131355.zip` | 2,951,341 | `0BDFCC1B93BFC559634816D2B77E8CEA701E9E3BB509905309806581A03BEC22` |

> Nota: el hash SHA-256 permite verificar integridad futura del export.
> No se incluyen nombres de archivos internos del bucket, paths privados de
> objetos, signed URLs ni secretos en este documento.

### Pendientes post-export Storage

- [ ] Cifrar o mover a vault seguro el ZIP en `C:\VETNEB-BACKUPS\supabase-storage\`.
- [ ] Confirmar privacidad del bucket `reports` y revisar significado de `Policies = 0`.
- [ ] Ejecutar restore drill en entorno no productivo (P0-017).
- [ ] Hacer upgrade a Supabase Pro para habilitar backups automaticos (alternativa permanente).
