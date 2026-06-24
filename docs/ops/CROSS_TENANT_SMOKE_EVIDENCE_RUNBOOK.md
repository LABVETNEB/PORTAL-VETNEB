# Cross-tenant smoke evidence runbook — Portal VETNEB

## 1. Estado

Runbook operativo para recolectar evidencia sanitizada de smoke cross-tenant en staging o producción controlada.

Este documento cubre PR-S3, derivado de:

- `docs/security/security-sessions-tenant-rls-audit.md`;
- `docs/security/rls-enforcement-matrix.md`;
- `docs/security/RBAC_MATRIX.md`;
- `docs/security/ENDPOINT_TEST_MATRIX.md`;
- `docs/release/release-go-no-go-policy.md`;
- `docs/ops/BACKUP_RESTORE_ROLLBACK.md`.

Resultado actual: **NO-GO para cerrar evidencia security runtime/staging** hasta ejecutar y registrar un smoke cross-tenant sanitizado con responsables.

## 2. Alcance

Incluido:

- Preparación de datos clinic A/B.
- Evidencia permitida y prohibida.
- Smoke manual/operativo de sesiones y recursos críticos.
- Criterios pass/fail.
- Registro de evidencia sanitizada.
- Acciones ante fallo.

Excluido:

- Cambios de scripts.
- Cambios de tests.
- Cambios de backend/API/auth.
- Cambios de DB, schema, migraciones o RLS nativo.
- Pegado de credenciales, cookies, tokens, signed URLs o datos clínicos.
- Ejecución automática desde CI.

## 3. Precondiciones

Antes de ejecutar este runbook:

- Confirmar autorización explícita para el entorno objetivo.
- Confirmar que el entorno objetivo es staging o producción controlada.
- Confirmar que existen dos clínicas de prueba o datos controlados: `Clinic A` y `Clinic B`.
- Confirmar que cada clínica tiene usuario válido, sesión independiente y recurso propio controlado.
- Confirmar responsable técnico y responsable negocio.
- Confirmar que se aplican las reglas de evidencia sanitizada de `docs/ops/BACKUP_RESTORE_ROLLBACK.md`.

## 4. Datos que NO se pueden registrar

No pegar en PRs, issues, chats, capturas, logs o docs:

- passwords;
- cookies;
- session IDs;
- raw tokens;
- token hashes;
- signed URLs completas;
- storage paths privados completos;
- nombres reales de pacientes/tutores;
- emails reales no sanitizados;
- datos clínicos;
- payloads completos de reportes;
- headers completos de request/response;
- valores reales de env vars;
- dumps de DB;
- archivos PDF reales.

## 5. Evidencia permitida

| Evidencia | Permitido | Prohibido |
|---|---|---|
| Timestamp | Fecha UTC aproximada | Logs crudos completos |
| Entorno | `staging`, `production controlled` | URLs internas con secretos |
| Actor | `Clinic A`, `Clinic B`, `Admin`, `Particular token` | Usuario/email real sin sanitizar |
| Recurso | `reportId=A-owned`, `token=last4:1234` | IDs sensibles masivos o tokens completos |
| HTTP status | `200`, `401`, `403`, `404`, `410` | Body completo con datos clínicos |
| Signed URL | `signedUrl=present` / `signedUrl=absent` | URL firmada completa |
| Cookie | `Set-Cookie present`, flags observados | Valor de cookie |
| Logs | “sin cookies/tokens/signed URLs detectados” | Log crudo con secretos |
| Resultado | PASS / FAIL / BLOCKED | Captura con datos reales |

## 6. Smoke matrix

| ID | Superficie | Actor inicial | Acción | Resultado esperado | Evidencia sanitizada |
|---|---|---|---|---|---|
| CT-01 | Login clínica | Clinic A | Login y `GET /api/auth/me` | 200, `clinic=A` sanitizado | status + actor + cookie flags sin valor |
| CT-02 | Login clínica | Clinic B | Login y `GET /api/auth/me` | 200, `clinic=B` sanitizado | status + actor + cookie flags sin valor |
| CT-03 | Reports own tenant | Clinic A | Listar/abrir reporte propio A | 200 o lista filtrada propia | `ownReportVisible=true` sin datos clínicos |
| CT-04 | Reports cross tenant | Clinic A | Intentar recurso controlado de Clinic B | 403/404 o no aparece en lista | status + `foreignReportVisible=false` |
| CT-05 | Signed URL own | Clinic A | Preview/download de reporte propio A | 200 + `signedUrl=present` | no pegar URL completa |
| CT-06 | Signed URL cross tenant | Clinic A | Preview/download de reporte B | 403/404, `signedUrl=absent` | status + absence |
| CT-07 | Particular token own | Particular A | `me` y reporte vinculado propio | 200 + recurso propio | token last4 solamente |
| CT-08 | Particular token cross | Particular A | Intentar reporte/token B | 404/409/410 sin disclosure | status + no metadata ajena |
| CT-09 | Public report token valid | Token público válido | Acceder recurso asociado | 200 si válido/no revocado | `tokenLast4`, `signedUrl=present` si aplica |
| CT-10 | Public report token invalid/revoked | Token inválido/revocado | Acceder recurso | 404/410 sin disclosure | status sin body completo |
| CT-11 | Audit log clinic | Clinic A | Ver audit log clinic | Solo eventos A | `foreignEventsVisible=false` |
| CT-12 | Admin audit/export | Admin | Ver/export audit | Export sin secretos | muestra sanitizada de columnas permitidas |
| CT-13 | Workflow/status own | Clinic/Admin autorizado | Cambiar estado recurso propio controlado | 200/204 y auditado | status + event recorded |
| CT-14 | Workflow/status cross | Clinic A | Intentar estado de recurso B | 403/404 sin disclosure | status + no mutation |
| CT-15 | CORS/cookies | Navegador real | Revisar flags cookies | HttpOnly/Secure/SameSite esperado | flags sin valor |
| CT-16 | Logs redaction | Backend/provider logs | Revisar logs del smoke | Sin cookies/tokens/signed URLs | declaración responsable + timestamp |

## 7. Procedimiento manual seguro

1. Preparar ventana de ejecución con responsables presentes.
2. Confirmar entorno objetivo y commit/deploy bajo prueba.
3. Iniciar sesión como Clinic A y Clinic B en contextos separados.
4. Ejecutar CT-01 a CT-16 sin pegar secretos.
5. Registrar solo evidencia permitida.
6. Cerrar sesiones usadas para smoke.
7. Limpiar variables locales temporales.
8. Revisar logs sanitizados.
9. Registrar resultado global PASS / FAIL / BLOCKED.
10. Si algún check falla, no corregir en el mismo PR documental.

## 8. Comandos auxiliares permitidos

Los scripts existentes pueden usarse como apoyo cuando correspondan:

- `pnpm smoke:staging`
- `pnpm smoke:upload`
- `pnpm smoke:prod:public`

Estos comandos no reemplazan CT-01 a CT-16 si no cubren explícitamente cross-tenant clinic A/B, signed URL absence, particular token isolation y logs sanitizados.

## 9. Criterios PASS / FAIL / BLOCKED

| Resultado | Criterio |
|---|---|
| PASS | Todos los checks aplicables devuelven resultado esperado y evidencia sanitizada completa |
| FAIL | Algún check permite recurso ajeno, leakage, cookie/token exposure o mutación cross-tenant |
| BLOCKED | Falta autorización, datos de prueba, entorno estable, responsables o capacidad de sanitizar evidencia |

## 10. NO-GO inmediato

Declarar **NO-GO** si ocurre cualquiera de estos casos:

- Clinic A puede ver o mutar recurso exclusivo de Clinic B.
- Un token particular accede a reporte/token no vinculado.
- Un token público revela si existe un recurso ajeno por diferencias no autorizadas.
- Aparece signed URL completa en evidencia o logs.
- Aparece cookie, token, hash, password o env var real.
- Un endpoint cookie-auth mutante acepta origen no confiable.
- Logout no invalida la sesión esperada.
- Admin exporta datos sensibles sin redacción.
- No se puede producir evidencia sanitizada confiable.

## 11. Registro de evidencia

Usar una tabla como esta en el tracker operativo aprobado, no necesariamente en este archivo:

| Fecha UTC | Entorno | Commit/deploy | Check IDs | Responsable técnico | Responsable negocio | Resultado | Evidencia sanitizada |
|---|---|---|---|---|---|---|---|
| `<YYYY-MM-DDTHH:mm:ssZ>` | `<staging>` | `<commit/deploy>` | `CT-01..CT-16` | `<nombre/rol>` | `<nombre/rol>` | `PASS/FAIL/BLOCKED` | `<referencia sanitizada>` |

## 12. Acciones ante FAIL

1. Detener ejecución.
2. Preservar evidencia sanitizada mínima.
3. Clasificar severidad:
   - P0 si hay acceso/mutación cross-tenant o leakage de secretos.
   - P1 si hay inconsistencia de status que permite enumeración.
   - P2 si falta evidencia o hay gap documental sin bypass demostrado.
4. Abrir PR separado con scope mínimo:
   - implementation-only si hay bug real;
   - tests-only si falta guardrail;
   - docs-only si falta trazabilidad.
5. No mezclar fix runtime con este runbook.

## 13. Relación con release go/no-go

Antes de un release productivo con riesgo de seguridad, este runbook debe estar:

- ejecutado en entorno autorizado;
- registrado con evidencia sanitizada;
- revisado por responsable técnico;
- revisado por responsable negocio;
- sin checks FAIL abiertos;
- sin secretos en la evidencia.

Si no se cumple, la decisión release debe permanecer **NO-GO**.

## 14. Validación PR-S3

Validación esperada para este PR:

- `git diff --check`;
- scope check: solo `docs/ops/CROSS_TENANT_SMOKE_EVIDENCE_RUNBOOK.md`;
- revisión manual contra:
  - `docs/security/security-sessions-tenant-rls-audit.md`;
  - `docs/security/rls-enforcement-matrix.md`;
  - `docs/release/release-go-no-go-policy.md`;
  - `docs/ops/BACKUP_RESTORE_ROLLBACK.md`;
- sin cambios en scripts, tests, backend, API, auth, DB, CI ni frontend.
