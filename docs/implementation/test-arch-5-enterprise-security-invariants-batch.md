# TEST-ARCH-5 - Enterprise security invariants batch

## Estado base

- Entorno: Windows, PowerShell, PNPM.
- Rama esperada y observada: `test/enterprise-security-invariants-batch`.
- HEAD observado: `32e1d73 test(architecture): move enterprise guard batch (#1311)`.
- Working tree inicial: limpio (`git status --short --untracked-files=all` sin salida).
- Movimiento fisico minimo: 3 archivos de test.
- Categoria enterprise asignada: `test/security/`.

## Documentos leidos

- `C:\Users\Nico\.codex\attachments\31bc59c8-ae7a-43b0-892c-16284e5420e8\pasted-text-1.txt`
- `docs/audit/test-suite-enterprise-architecture-audit.md`
- `docs/implementation/test-suite-enterprise-organization-convention.md`
- `test/README.md`
- `docs/implementation/test-arch-3-enterprise-first-unit-domain-batch.md`
- `docs/implementation/test-arch-4-enterprise-architecture-security-guards-batch.md`
- `package.json`

## Scope incluido

- Movimiento fisico minimo de tests claramente clasificables como security invariants.
- Creacion de `test/security/`.
- Movimiento de 3 archivos de test.
- Ajustes minimos de imports relativos y raiz de lectura local afectados por la nueva profundidad.
- Creacion de esta nota de entrega requerida por protocolo VETNEB.

## Scope excluido

- No runtime.
- No cambios funcionales de produccion.
- No cambios de assertions salvo paths/imports por move.
- No `package.json`.
- No `pnpm-lock.yaml`.
- No dependencias.
- No CI/workflows.
- No backend runtime.
- No DB, schema ni migraciones.
- No auth, roles, permisos, cookies, CSRF, CSP ni rate limits.
- No stashes.
- No `.claude/worktrees`.
- No helpers, factories, mocks ni abstracciones nuevas.
- No tests que requieran servidor HTTP real, DB real, Supabase real, red externa o env productivo.

## Auditoria previa

Confirmaciones:

- El glob `test/**/*.test.ts` descubre tests en subcarpetas sin tocar scripts.
- `test/tsconfig.json` admite codigo anidado bajo `test/`.
- `test/security/` no existia al inicio del lote.
- Los tres candidatos elegidos no tenian anchors en `test/**` por nombre de archivo.
- Las referencias detectadas en `docs/**` son historicas o matrices documentales y quedaron fuera de scope para evitar churn no requerido.

## Candidatos inspeccionados

| Candidato | Categoria evaluada | Decision | Razon |
| --- | --- | --- | --- |
| `test/architecture/security/security-session-cookie-boundaries.test.ts` | Security invariant | No elegido | Candidato claro, pero esta anclado por `global-e2e-production-readiness-contract`, `security-boundary-suite-completeness`, `security-critical-route-surface-registry`, `security-docs-matrix-drift-guard` y self-read. Moverlo exigia coordinar demasiados paths. |
| `test/architecture/security/security-boundary-suite-completeness.test.ts` | Security invariant / suite completeness | No elegido | Es un registry de completitud de seguridad y esta anclado por otros guards. Moverlo ampliaba el alcance. |
| `test/api-error-no-stack-traces-contract.test.ts` | Security invariant | No elegido | Elegible, pero se priorizaron sesiones/cookies, cache privado y rate-limit cross-realm por alineacion directa con la prioridad del lote. |
| `test/auth-session-boundaries.test.ts` | Security invariant | Elegido | Protege separacion de sesiones/cookies entre clinica, admin y particular con stubs locales y `app.inject`, sin servidor real ni DB/red. |
| `test/backend-api-no-store-cache-contract.test.ts` | Security invariant | Elegido | Protege `Cache-Control: no-store` para APIs privadas y confirma que rutas autenticadas delegan al hook global sin I/O externo. |
| `test/security-csrf-mutating-route-coverage.test.ts` | Security invariant | No elegido | Elegible, pero tiene mayor superficie de imports y casos de integracion; se mantuvo el lote en candidatos mas chicos. |
| `test/security-docs-matrix-drift-guard.test.ts` | Security/docs guard | No elegido | Es mas documental/registry-driven que invariante behavioral del lote. |
| `test/security-rate-limit-cross-realm-isolation.test.ts` | Security invariant / regression guard | Elegido | Protege aislamiento de rate limits entre realms y confirma que respuestas 429 no filtran password/hash/token/cookie/secret. |

## Candidatos elegidos

| Archivo destino | Categoria asignada | Por que califica |
| --- | --- | --- |
| `test/security/auth-session-boundaries.test.ts` | Security invariant | Sesiones y cookies por superficie (`app_session_id`, `admin_session_id`, particular) sin fallback cruzado. |
| `test/security/backend-api-no-store-cache-contract.test.ts` | Security invariant | Cache privado y headers `Cache-Control: no-store` en API sensible. |
| `test/security/security-rate-limit-cross-realm-isolation.test.ts` | Security invariant / regression guard | Rate-limit cross-realm y no disclosure de secretos en respuestas 429. |

## Archivos movidos

| Origen | Destino |
| --- | --- |
| `test/auth-session-boundaries.test.ts` | `test/security/auth-session-boundaries.test.ts` |
| `test/backend-api-no-store-cache-contract.test.ts` | `test/security/backend-api-no-store-cache-contract.test.ts` |
| `test/security-rate-limit-cross-realm-isolation.test.ts` | `test/security/security-rate-limit-cross-realm-isolation.test.ts` |

## Imports ajustados

| Archivo | Cambio |
| --- | --- |
| `test/security/auth-session-boundaries.test.ts` | `../server/...` -> `../../server/...` |
| `test/security/backend-api-no-store-cache-contract.test.ts` | `new URL("../", import.meta.url)` -> `new URL("../../", import.meta.url)` |
| `test/security/backend-api-no-store-cache-contract.test.ts` | `../server/lib/sensitive-response-cache.ts` -> `../../server/lib/sensitive-response-cache.ts` |
| `test/security/security-rate-limit-cross-realm-isolation.test.ts` | `../server/...` -> `../../server/...` |

## Validaciones ejecutadas

| Comando | Resultado |
| --- | --- |
| `git diff --check` | Paso sin salida. |
| `git diff --stat` | Paso. Al no usar `git add`, muestra solo bajas tracked: `test/auth-session-boundaries.test.ts`, `test/backend-api-no-store-cache-contract.test.ts` y `test/security-rate-limit-cross-realm-isolation.test.ts`. |
| `git diff --name-only` | Paso. Al no usar `git add`, muestra solo las 3 bajas tracked esperadas. |
| `git status --short --untracked-files=all` | Paso. Muestra las 3 bajas tracked, los 3 destinos nuevos en `test/security/` y este reporte untracked. |
| `pnpm typecheck:test` | Primer intento con shim Codex aborto antes del script por `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`; reejecutado con PNPM 10.8.1 de Corepack (`C:\Program Files\nodejs\pnpm.cmd`) y paso. |
| `pnpm test` | Paso con PNPM 10.8.1 de Corepack: 2983 tests, 2983 pass, 0 fail. |
| `pnpm build` | Paso con PNPM 10.8.1 de Corepack: `dist/index.js 838.3kb`, `Done in 17ms`. |
| `pnpm security:public-surface` | Paso. Reporto `PASS security/public-surface`; mantuvo findings `server-only` esperados para identificadores de cookies en `frontend/src/proxy.ts`. |
| `pnpm --dir frontend lint` | Paso. |
| `pnpm --dir frontend typecheck` | Paso. |
| `pnpm --dir frontend build` | Paso. |

## Confirmacion de scope

- No se toco runtime (`server/**`, `frontend/src/**`).
- No se tocaron deps, lockfile, package manifests, CI, DB, schema, migrations, stashes ni `.claude/worktrees`.
- No se cambiaron assertions ni logica de tests.
- El cambio es mecanico: mover 3 tests a `test/security/`, ajustar paths relativos y documentar el lote.

## Riesgo residual

- Bajo. Los tres tests elegidos no tenian anchors en `test/**`.
- El riesgo principal es import relativo incorrecto por nueva profundidad; queda cubierto por `pnpm test`.
- Las referencias en `docs/**` quedan historicas y no afectan el runner.

## Estado final

Working tree con cambios esperados:

- `D test/auth-session-boundaries.test.ts`
- `D test/backend-api-no-store-cache-contract.test.ts`
- `D test/security-rate-limit-cross-realm-isolation.test.ts`
- `?? docs/implementation/test-arch-5-enterprise-security-invariants-batch.md`
- `?? test/security/auth-session-boundaries.test.ts`
- `?? test/security/backend-api-no-store-cache-contract.test.ts`
- `?? test/security/security-rate-limit-cross-realm-isolation.test.ts`

Nico conserva stage, commit, push, PR, checks y merge manuales.
