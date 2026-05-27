# Production readiness snapshot — 2026-05-27

Auditoría de producción sin credenciales. Registra evidencia obtenida tras el
bloque de PRs #712–#718. No declara GO producción real. No cierra P0 que
dependen de credenciales, accesos a proveedores, staging autenticado, producción
real o aprobaciones humanas.

Este documento no contiene secretos, tokens, passwords, cookies, signed URLs,
service role keys, DB URLs, dumps ni datos personales reales.

> [!IMPORTANT]
> Evidencia formal centralizada en `docs/production-readiness-evidence.md`.
> Checklist legal/comercial en `docs/legal-commercial-readiness.md`.

---

## 1. Estado ejecutivo

| Campo | Valor |
|---|---|
| Decisión | **NO-GO producción real** |
| Fecha de auditoría | 2026-05-27 |
| Commit auditado | `ddeb3cc` |
| Motivo NO-GO | Faltan evidencias con credenciales, accesos a proveedores y aprobaciones humanas |
| Cambios de código pendientes conocidos | Ninguno en este momento |
| Evidencia local | Verde |
| CI main | Verde |
| Staging público (sin credenciales) | Verde |
| Staging autenticado | Pendiente por credenciales |
| Upload / storage / signed URL real | Pendiente por credenciales |
| Backup / restore / rollback | Pendiente por acceso owner |
| Legal / comercial / aprobadores | Pendiente por aprobación humana |
| Producción real | NO-GO |

---

## 2. Commit y estado del repositorio

| Campo | Valor | Estado |
|---|---|---|
| Repo | `LABVETNEB/PORTAL-VETNEB` | ✓ |
| Branch | `main` | ✓ |
| Commit auditado | `ddeb3cc docs(prod): add legal commercial launch checklist (#718)` | ✓ |
| Working tree | Limpio | ✓ |
| PRs abiertos | Ninguno | ✓ |
| Ramas remotas no mergeadas | Ninguna | ✓ |

---

## 3. PRs incluidos en el bloque de auditoría

| PR | Título | Tipo | Estado |
|---|---|---|---|
| #712 | `audit(prod): add production readiness evidence checklist` | audit/docs | Mergeado en main |
| #713 | `test(security): add cross-tenant IDOR smoke contracts` | test | Mergeado en main |
| #714 | `ops(smoke): extend staging smoke authenticated flows` | ops | Mergeado en main |
| #715 | `ops(smoke): add upload storage signed-url evidence mode` | ops | Mergeado en main |
| #716 | `ops(release): add backup restore rollback runbook` | ops/docs | Mergeado en main |
| #717 | `docs(security): add RBAC endpoint-test matrix` | docs | Mergeado en main |
| #718 | `docs(prod): add legal commercial launch checklist` | docs | Mergeado en main |

---

## 4. CI main

| PR / commit | Workflow | Estado | Observación |
|---|---|---|---|
| #718 | Backend CI | success | Commit `ddeb3cc` |
| #717 | Backend CI | success | Commit `ad2669a` |
| #716 | Backend CI | success | Commit `74caf75` |
| #715 | Backend CI | success | — |
| #714 | Backend CI | success | — |
| #713 | Backend CI | success | — |
| #712 | Backend CI | success | — |
| #711 | Backend CI | success | — |
| #711 | Frontend CI | success | — |

Los PRs docs-only (#716, #717, #718) pueden no disparar Frontend CI si el
workflow no incluye cambios de frontend; Backend CI verde en todos los casos.
URLs de runs no incluidas para evitar tokens expirados.

---

## 5. Validación local

| Comando | Resultado | Evidencia | Estado |
|---|---|---|---|
| `pnpm typecheck` | OK | Sin errores de tipos en runtime | ✓ Verde |
| `pnpm typecheck:test` | OK | Sin errores de tipos en tests | ✓ Verde |
| `pnpm test` | 1773 pass / 0 fail / 1 skipped | Suite completa de tests unitarios e integración | ✓ Verde |
| `pnpm build` | OK | `dist/index.js` generado sin errores | ✓ Verde |
| `pnpm validate:local:schema` | OK | Schema local consistente | ✓ Verde |
| `pnpm schema:verify` | status ok, totalMissing 0 | Ver sección 6 | ✓ Verde |
| `pnpm --dir frontend lint` | OK | Sin errores de lint en frontend | ✓ Verde |
| `pnpm --dir frontend typecheck` | OK | Sin errores de tipos en frontend | ✓ Verde |
| `pnpm --dir frontend build` | OK | Build Next.js de producción sin errores | ✓ Verde |
| `pnpm --dir frontend e2e` | 19 passed / 0 failed | Playwright E2E completo | ✓ Verde |

---

## 6. Schema verify

Resultado de `pnpm schema:verify` sobre entorno local:

| Campo | Valor |
|---|---|
| status | ok |
| requiredTables | 3 |
| totalMissing | 0 |
| `public.reports` missing | 0 |
| `public.report_status_history` missing | 0 |
| `public.report_access_tokens` missing | 0 |

Evidencia sin secretos: valores numéricos y estado de schema, sin credenciales
ni connection string.

---

## 7. Staging público sin credenciales

| Check | Resultado | Estado |
|---|---|---|
| Backend staging `/health` — HTTP status | 200 OK | ✓ Verde |
| Frontend staging `/` — HTTP status | 200 OK | ✓ Verde |
| CORS preflight `OPTIONS /api/auth/login` — status | 204 | ✓ Verde |
| `Access-Control-Allow-Origin` coincide con frontend staging | Sí | ✓ Verde |
| `Access-Control-Allow-Credentials` | true | ✓ Verde |
| Bad origin `POST /api/auth/logout` — status | 403 | ✓ Verde |
| `pnpm smoke:staging` — total/passed/failed/skipped | 20 / 4 / 0 / 16 | ✓ Verde (público) |

Los 16 checks skipped corresponden a flujos autenticados que requieren
`SMOKE_ADMIN_USERNAME`, `SMOKE_ADMIN_PASSWORD`, `SMOKE_CLINIC_USERNAME`,
`SMOKE_CLINIC_PASSWORD` u otras variables no disponibles sin credenciales.

---

## 8. Staging autenticado pendiente

| Check | Motivo pendiente | Evidencia requerida | Estado |
|---|---|---|---|
| Login admin (`POST /api/admin/auth/login`) | Credenciales staging admin requeridas | Log sanitizado status 200 + cookie `admin_session_id` presente | Pendiente |
| Admin schema health (`GET /api/admin/system/schema-health`) | Requiere sesión admin activa | `status=ok` en respuesta sanitizada | Pendiente (P0-003) |
| Login clínica (`POST /api/auth/login`) | Credenciales staging clinic requeridas | Log sanitizado status 200 + cookie `app_session_id` presente | Pendiente |
| Listado de informes clinic (`GET /api/reports`) | Requiere sesión clínica activa | Log sanitizado con count de informes, sin IDs reales | Pendiente |
| Perfil público clínica | Requiere clínica con perfil publicado en staging | Respuesta sanitizada con slug anónimo | Pendiente |
| Login particular (`POST /api/particular/auth/login`) | Token particular staging requerido | Log sanitizado status 200 | Pendiente |
| Smoke upload (`pnpm smoke:upload`) | `SMOKE_BASE_URL`, `SMOKE_USERNAME`, `SMOKE_PASSWORD` requeridos | `reportId` trazable + `signedUrl=present` en log sanitizado | Pendiente (P0-008/P0-009/P0-010) |

---

## 9. Smoke upload sin credenciales

`pnpm smoke:upload` ejecutado sin variables de entorno requeridas:

- **Resultado:** falla segura esperada con error `SMOKE_BASE_URL es requerido`.
- **No ejecuta** upload real contra staging.
- **No expone** secretos — el script aborta antes de cualquier llamada HTTP.
- **No cierra** P0-009 (upload PDF), P0-010 (signed URL), ni P0-008 (Storage).
- **Sirve como evidencia** de comportamiento fail-safe del script ante ausencia
  de credenciales.

---

## 10. P0 pendientes para GO producción

| P0 | Pendiente | Bloqueado por | Evidencia requerida |
|---|---|---|---|
| P0-002 | Smoke autenticado admin/clinic/particular en staging | Credenciales staging | Log sanitizado de flujos completos |
| P0-003 | Schema health admin en staging | Sesión admin staging | `status=ok` en respuesta sanitizada |
| P0-008 | Storage bucket privado verificado | Acceso Supabase Storage + credenciales clinic | Captura dashboard storage sanitizada + smoke upload OK |
| P0-009 | Upload PDF funcional en staging | Credenciales clinic staging + `SMOKE_BASE_URL` | `reportId` trazable en log sanitizado |
| P0-010 | Signed URL staging validada | Credenciales clinic staging | `signedUrl=present` en log sanitizado; URLs no expuestas |
| P0-011 | Upload avatar/logo funcional | Credenciales admin staging | Flujo manual avatar/logo en staging |
| P0-012 | Contacto/email E2E o exclusión aprobada | Configuración Gmail API/SMTP + `CONTACT_TO` + decisión de release | Smoke E2E sanitizado o acta de exclusión. Ver `docs/legal-commercial-readiness.md` LC-003/LC-004 |
| P0-015 | Smoke cross-tenant / IDOR en staging/producción | Sesiones separadas staging | Prueba manual con dos sesiones y log sanitizado |
| P0-016 | Backup productivo reciente | Acceso owner Supabase/Render | Acta con fecha, tamaño y estado sanitizados |
| P0-017 | Restore probado en staging/no productivo | Acceso owner + entorno de prueba | Acta de restore de prueba sanitizada |
| P0-018 | Rollback app documentado y probado | Acceso Render owner | Runbook ejecutado + evidencia sanitizada |
| P0-019 | Rollback DB documentado y aprobado | Decisión y acceso owner | Runbook aprobado por responsable técnico |
| P0-020 | Dominio HTTPS productivo operativo | Dominio productivo configurado | `Invoke-WebRequest` HTTPS + certificados válidos |
| P0-021 | CORS y cookies correctas en producción | Deploy productivo | `OPTIONS` login + inspección cookies en prod |
| P0-022 | Smoke producción post-deploy | Deploy productivo completado | Runbook productivo ejecutado y firmado |
| P0-023 | Logs sin secretos ni signed URLs completas | Deploy productivo + acceso logs | Extracto de logs sanitizado |
| P0-024 | Aprobación legal/comercial mínima | Aprobación humana responsable negocio/legal | Checklist LC-001–LC-015 cerrada. Ver `docs/legal-commercial-readiness.md` |
| P0-025 | Aprobación responsable técnico y negocio | Aprobación humana | Registro de decisión con fecha, commit y responsables |

P0-001 (CI), P0-004 (config staging), P0-005 (config producción), P0-006
(DB staging migrada), P0-007 (backup previo a migrar), P0-013 (CORS staging),
P0-014 (cookies staging) — evidencia no disponible sin acceso al proveedor.

---

## 11. Datos que no se deben adjuntar como evidencia

Los siguientes datos no deben incluirse en PRs, issues, comentarios, capturas
ni en este documento:

- Passwords o credenciales de cualquier tipo.
- Tokens de sesión, API keys o access tokens.
- Cookies de sesión reales.
- Signed URLs completas.
- Service role keys de Supabase.
- DB URLs completas con credenciales.
- Dumps de base de datos.
- Datos reales de clientes, propietarios, pacientes o mascotas.
- Capturas de pantalla con información sensible sin redactar.
- Credenciales o configuraciones de proveedores (Supabase, Render, Gmail).

---

## 12. Próxima acción requerida

No corresponde abrir un PR de código. Las próximas acciones son operativas y
requieren acceso humano a proveedores y credenciales de staging/producción:

1. **Staging autenticado:** obtener credenciales de staging de owner o que el
   owner ejecute `pnpm smoke:staging` con las variables `SMOKE_ADMIN_*` y
   `SMOKE_CLINIC_*` configuradas, y aporte el log sanitizado.
2. **Smoke upload:** ejecutar `pnpm smoke:upload` con `SMOKE_BASE_URL`,
   `SMOKE_USERNAME` y `SMOKE_PASSWORD` de una clínica de staging. Aportar log
   sanitizado con `reportId` y `signedUrl=present`. No exponer el password en
   consola, capturas ni tickets.
3. **Supabase Storage:** evidenciar bucket privado en dashboard Supabase
   (captura sanitizada sin service role visible).
4. **Backup / restore / rollback:** ejecutar procedimiento de
   `docs/ops/BACKUP_RESTORE_ROLLBACK.md` y aportar acta sanitizada con fecha,
   estado y responsable.
5. **Legal / comercial:** completar checklist `docs/legal-commercial-readiness.md`
   LC-001–LC-015 con aprobaciones de negocio/legal.
6. **Deploy productivo controlado:** configurar variables de producción en Render,
   ejecutar migraciones una sola vez, desplegar backend y frontend, ejecutar smoke
   productivo y registrar evidencia sanitizada.
