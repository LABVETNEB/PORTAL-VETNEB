# M35b — Token Access enumeration/disclosure closeout

## Identificación

- Milestone: M35b.
- Repositorio: `LABVETNEB/PORTAL-VETNEB`.
- Rama:
  `test/backend-modularization-m35b-token-access-enumeration-disclosure-closeout`.
- Baseline exacto: `f30bef676bb93d4e2d6e766386139ad053624a30`.
- M33: cerrado por PR #1570.
- M34: cerrado por PR #1572.
- Hotfix R2 de redacción global: PR #1573.

## Scope

Incluye la regresión ejecutable conjunta de Particular Access y Report Access,
el guard arquitectónico M35b, la ampliación conjunta de la matriz cross-tenant
IDOR, el registro de owners en suite completeness y este closeout.

Excluye runtime, frontend, schema/migraciones, dependencias, CI, auth, cookies,
sesiones, CORS, cambios de rate limits, M36 y Reports Phase I. No se modifican
implementaciones ni reglas internas ya cerradas por M33 y M34.

## Matriz Particular Access

| Contrato | Evidencia ejecutable |
| --- | --- |
| Token missing vs foreign | mismo `404`, body y headers |
| Selector hostil | query `clinicId`, `tokenId` y `reportId` no reemplaza la clínica autenticada |
| Report missing vs foreign | mismo resultado y cero writes |
| Repository failure | `500` genérico sin error interno |
| Token raw/hash | ausentes de respuestas y auditoría |
| Clinic authority | `clinicId` deriva de la sesión autenticada |
| Side effects | ownership inválido corta antes de persistir |

## Matriz Report Access

| Contrato | Evidencia ejecutable |
| --- | --- |
| malformed, missing, revoked, expired y cross-clinic | `404` indistinguible |
| unavailable | `409` legítimamente distinguible |
| success | `200` y orden completo observado |
| repository failure | `500` genérico, sin audit |
| storage failure | `500` genérico, sin audit |
| rate limit | `429` antes de parse, hash y repository |
| side effects | record access antes de signed URLs; audit al final |
| path redaction | `response.path` es `/api/public/report-access/[REDACTED]` |

## Contratos cerrados

- Las respuestas de recursos missing, foreign, inválidos por lifecycle o
  cross-realm son indistinguibles cuando el contrato exige ocultamiento.
- `409` para informe no disponible y `429` para rate limit permanecen estados
  legítimamente distinguibles.
- No se exponen token raw/hash, detalles de repository/storage, SQL ni stack.
- El scope de clínica autenticada prevalece sobre selectores hostiles.
- Particular Access y Report Access permanecen separados por realm.
- La auditoría conserva atribución segura por actor, clínica, informe y token
  id, sin credenciales.
- Revocación y expiración se evalúan antes de exponer el informe.
- El rate limit público corta antes de parse, hash, repository y side effects.

## Hotfix R2

M35b detectó el P1 de disclosure del token raw mediante `response.path`. El PR
#1573 corrigió el path global antes de este closeout y dejó el contrato
ejecutable en
`test/security/token-access-enumeration-disclosure-regression.test.ts`. El
hallazgo inicial está corregido y no constituye un fallo residual.

## Guards

- A — registry/path/closeout, misma cobertura:
  `test/architecture/security/security-boundary-suite-completeness.test.ts` y
  `test/architecture/token-access-m35b-closeout.test.ts`.
- B — matriz conjunta con evidencia ejecutable:
  `test/architecture/security/security-cross-tenant-idor-contract.test.ts`.
- C — debilitamiento: 0.

Los demás guards globales de lifecycle, rate limits, ownership, disclosure,
log redaction y write attribution ya anclaban las superficies canónicas y no
se modificaron sólo para mencionar M35b.

## Validación

| Gate | Estado | Resultado |
| --- | --- | --- |
| Cohorte M35b | PASSED | exit 0, 10/10 |
| Cinco integraciones token access | PASSED | exit 0, 49/49 |
| Suite completeness | PASSED | exit 0, 6/6 |
| Cross-tenant IDOR final | PASSED | exit 0, 9/9 |
| `pnpm typecheck:test` | PASSED | exit 0 |
| `pnpm validate:local` | PASSED | exit 0; typechecks, 3.732 pass, 1 skip, 0 fail y build |
| `pnpm security:public-surface` | PASSED | exit 0, sin findings públicos |
| `pnpm audit --prod` | PASSED | exit 0, sin vulnerabilidades conocidas |
| `pnpm audit` | PASSED | exit 0, sin vulnerabilidades conocidas |
| `git diff --check` | PASSED | exit 0 |

La primera cohorte M35b quedó `FAILED` 9/10 porque el guard nuevo no reconocía
la allowlist M33 expresada como array seguido de `.sort()`; el parser
source-aware se corrigió y la repetición exacta quedó `PASSED` 10/10. La
primera cohorte de guards quedó `FAILED` 14/15 por una colisión de substring
con el autocontrol de secretos del propio CTIDOR; se corrigió sólo esa frase y
CTIDOR quedó `PASSED` 9/9. No hubo fallos runtime.

## Riesgo residual

- No existe ni se afirma RLS.
- Staging, DB real y producción: NOT_RUN.
- Playwright: NOT_RUN, fuera del scope.
- M36 permanece pendiente.

## Rollback

Revertir únicamente los tests, guards y documentación M35b. No hay runtime,
schema, migración ni datos que compensar.

## Estado final

- Fase H: cerrada.
- M36: no iniciado.
- Reports Phase I: no iniciada.
