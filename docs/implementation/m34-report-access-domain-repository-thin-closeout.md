# M34 — Report Access domain, repository y thin routes

## Estado base y alcance

Reconstrucción observada desde `c887402b1ecdd041a38b4cd081b628ebb9f9a18e`
en la rama
`refactor/backend-modularization-m34-report-access-domain-repository-thin-closeout`.
El baseline tenía working tree limpio, stage vacío y `main`/`origin/main` en el
mismo commit.

Incluye exclusivamente Report Access: reglas puras, operaciones admin/clinic/public,
repository Drizzle, composición, tres rutas existentes, tests y guards afectados.
Excluye frontend, schema/migraciones, dependencias, CI, auth, CORS, cookies,
sesiones, stores de rate limit, Supabase, M35b y Reports Phase I.

## Inventario previo

`server/db-report-access.ts` exportaba siete operaciones: create, get global,
get clinic-scoped, list, revoke idempotente, record access y lookup token+report
por hash. Las rutas poseían ownership, lifecycle, persistencia y coordinación de
auditoría. Trusted-origin, rate limit, auth, parseo, respuestas HTTP, CORS y
serialización estaban en el borde.

## Arquitectura resultante

- `domain/`: estado active/revoked/expired, borde temporal inclusivo, ownership,
  clinic scope y disponibilidad pública.
- `application/`: casos de uso separados para admin, clinic y public; puertos
  derivados de `Options`; write/audit y record/signed URL/audit preservan orden.
- `infrastructure/`: las siete operaciones Drizzle trasladadas sin cambiar
  tablas, joins, filtros ni lifecycle de persistencia.
- `composition/`: carga explícita del repository para las rutas.
- `routes/`: conservan HTTP, auth, trusted-origin, rate limit, CORS, parseo,
  errores y serialización final.

`server/db-report-access.ts` fue eliminado y un guard impide recrearlo o volver a
importarlo. `server/lib/report-access-token.ts` conserva primitivas y helpers de
token/serialización compatibles; lifecycle y disponibilidad se reexportan desde
el dominio canónico para compatibilidad histórica.

## Contratos y seguridad

Admin/clinic mantienen `trusted-origin → rate limit → auth → validation/ownership
→ write → audit → response`. Público mantiene `rate limit → parse/hash → lookup
→ lifecycle/scope → generic mapping → record → signed URLs → audit → response`.
Malformed, missing, cross-clinic, revoked y expired comparten el 404 genérico.
Unavailable conserva 409. No se incorporan token raw/hash a auditoría; se
mantienen `tokenLast4`, actor, clinic/report/token ids y action names.

## Guards

- A (reanchor de path/milestone, mismo contrato): 9.
  `particular-access-m33-closeout`, `security-critical-route-surface-registry`,
  `storage-suite-completeness`, `study-tracking-admin-thin-route`,
  `study-tracking-phase-closeout`, `global-storage-report-safety-contract`,
  `admin-heavy-list-pagination-contract`,
  `global-performance-resilience-contract` y
  `test/helpers/report-foreign-access-scope.ts`.
- B (contrato route + application, misma semántica): 15.
  `audit-critical-flow-writes`, `audit-suite-completeness`,
  `reports-suite-completeness`, `global-auth-boundary-contract`,
  `security-access-lifecycle-boundaries`,
  `security-actor-relationship-boundaries`,
  `security-boundary-suite-completeness`,
  `security-mutation-permission-surface`,
  `security-rate-limit-isolation-boundaries`,
  `security-resource-ownership-boundaries`,
  `security-response-disclosure-boundaries`,
  `security-sensitive-log-redaction-boundaries`,
  `security-validation-cutoff-boundaries`,
  `security-write-attribution-boundaries` y
  `security-audit-logging-phase-boundaries`.
- C (debilitamiento): 0.

## Archivos y operaciones movidas

Se crea `server/features/report-access/` con domain, application,
infrastructure, composition y README; se modifican las tres rutas Report Access
y el helper de token; se agregan tests unitarios y el closeout guard; se elimina
el repository legacy.

## Validaciones

- Cohorte M34 + guards históricos modificados: PASSED, exit 0, 93/93.
- Reintentos dirigidos de guards descubiertos por suite completa: PASSED,
  exit 0 (91/91, 9/9 y 16/16 en sus cohortes finales).
- `pnpm typecheck`: PASSED, exit 0.
- `pnpm typecheck:test`: PASSED, exit 0.
- `pnpm validate:local`: PASSED, exit 0; typechecks, 3721 pass, 1 skip, 0
  fail y build esbuild.
- `pnpm security:public-surface`: PASSED, exit 0; sin findings públicos.
- `pnpm audit --prod`: PASSED, exit 0; sin vulnerabilidades conocidas.
- `pnpm audit`: PASSED, exit 0; sin vulnerabilidades conocidas.
- Playwright, migraciones, dev servers y watchers: NOT_RUN, excluidos por el
  scope M34.

## Riesgo residual y rollback

Riesgo residual bajo: la suite local completa cubre los reanchors; no se
ejecutaron DB/migraciones ni E2E por exclusión explícita. Rollback manual:
revertir el diff local de M34 antes de stage; no se ejecutaron comandos Git de
escritura.

## Estado final

Implementación y gates locales completos, working tree intencionalmente
modificado y stage vacío. M35b y Reports Phase I no comenzaron.
