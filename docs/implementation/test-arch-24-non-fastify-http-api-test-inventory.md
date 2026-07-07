# TEST-ARCH-24 - Non-fastify HTTP/API test inventory

## Resumen ejecutivo

TEST-ARCH-24 inventaria manualmente los tests no-fastify que usan request injection / `app.inject()`.

Este PR es docs-only:
- no mueve tests
- no edita tests
- no toca runtime/producto
- no toca DB/schema/migrations
- no toca CI
- no toca dependencias
- no toca `package.json`
- no toca `pnpm-lock.yaml`
- no usa Codex
- no usa Claude

## Estado base

| Item | Resultado |
|---|---|
| Repo | `C:\PORTAL-VETNEB` |
| Rama esperada | `docs/non-fastify-http-api-test-inventory` |
| HEAD base esperado | `34fa7ee docs(test): close controller fastify migration (#1330)` |
| Working tree inicial | Limpio |
| PRs abiertos | 0 |
| Residuo remoto conocido | `origin/test/particular-authenticated-session-fixture`, no tocado |

## Resultado del inventario

| Metrica | Resultado |
|---|---:|
| Total test/spec files | 0 |
| Total `*.fastify.test.ts` | 0 |
| Non-fastify files con `.inject(` | 0 |

## Clasificacion manual

| Archivo | Clasificacion | `.inject(` count | Accion recomendada |
|---|---|---:|---|
| $(@{Path=test\api-contract-smoke.test.ts; Classification=API_CONTRACT_OR_SMOKE; InjectCount=4; RecommendedAction=Candidato a lote API contract/smoke.}.Path) | $(@{Path=test\api-contract-smoke.test.ts; Classification=API_CONTRACT_OR_SMOKE; InjectCount=4; RecommendedAction=Candidato a lote API contract/smoke.}.Classification) | 4 | Candidato a lote API contract/smoke. |
| $(@{Path=test\api-error-content-type-contract.test.ts; Classification=API_CONTRACT_OR_SMOKE; InjectCount=6; RecommendedAction=Candidato a lote API error contracts.}.Path) | $(@{Path=test\api-error-content-type-contract.test.ts; Classification=API_CONTRACT_OR_SMOKE; InjectCount=6; RecommendedAction=Candidato a lote API error contracts.}.Classification) | 6 | Candidato a lote API error contracts. |
| $(@{Path=test\api-error-no-secrets-contract.test.ts; Classification=API_CONTRACT_OR_SMOKE; InjectCount=3; RecommendedAction=Candidato a lote API error/security disclosure contracts.}.Path) | $(@{Path=test\api-error-no-secrets-contract.test.ts; Classification=API_CONTRACT_OR_SMOKE; InjectCount=3; RecommendedAction=Candidato a lote API error/security disclosure contracts.}.Classification) | 3 | Candidato a lote API error/security disclosure contracts. |
| $(@{Path=test\api-error-no-stack-traces-contract.test.ts; Classification=API_CONTRACT_OR_SMOKE; InjectCount=2; RecommendedAction=Candidato a lote API error/security disclosure contracts.}.Path) | $(@{Path=test\api-error-no-stack-traces-contract.test.ts; Classification=API_CONTRACT_OR_SMOKE; InjectCount=2; RecommendedAction=Candidato a lote API error/security disclosure contracts.}.Classification) | 2 | Candidato a lote API error/security disclosure contracts. |
| $(@{Path=test\api-request-id-observability-contract.test.ts; Classification=API_CONTRACT_OR_SMOKE; InjectCount=10; RecommendedAction=Candidato a lote API observability contracts.}.Path) | $(@{Path=test\api-request-id-observability-contract.test.ts; Classification=API_CONTRACT_OR_SMOKE; InjectCount=10; RecommendedAction=Candidato a lote API observability contracts.}.Classification) | 10 | Candidato a lote API observability contracts. |
| $(@{Path=test\client-version-gate-contract.test.ts; Classification=API_CONTRACT_OR_SMOKE; InjectCount=2; RecommendedAction=Candidato separado; revisar porque incluye source string fixtures.}.Path) | $(@{Path=test\client-version-gate-contract.test.ts; Classification=API_CONTRACT_OR_SMOKE; InjectCount=2; RecommendedAction=Candidato separado; revisar porque incluye source string fixtures.}.Classification) | 2 | Candidato separado; revisar porque incluye source string fixtures. |
| $(@{Path=test\global-public-surface-hardening-contract.test.ts; Classification=API_CONTRACT_OR_SMOKE; InjectCount=3; RecommendedAction=Candidato a lote global public surface.}.Path) | $(@{Path=test\global-public-surface-hardening-contract.test.ts; Classification=API_CONTRACT_OR_SMOKE; InjectCount=3; RecommendedAction=Candidato a lote global public surface.}.Classification) | 3 | Candidato a lote global public surface. |
| $(@{Path=test\global-storage-report-safety-contract.test.ts; Classification=API_CONTRACT_OR_SMOKE; InjectCount=2; RecommendedAction=Candidato a lote global storage/report safety.}.Path) | $(@{Path=test\global-storage-report-safety-contract.test.ts; Classification=API_CONTRACT_OR_SMOKE; InjectCount=2; RecommendedAction=Candidato a lote global storage/report safety.}.Classification) | 2 | Candidato a lote global storage/report safety. |
| $(@{Path=test\performance-load-smoke.test.ts; Classification=API_CONTRACT_OR_SMOKE; InjectCount=2; RecommendedAction=Candidato separado; smoke/performance.}.Path) | $(@{Path=test\performance-load-smoke.test.ts; Classification=API_CONTRACT_OR_SMOKE; InjectCount=2; RecommendedAction=Candidato separado; smoke/performance.}.Classification) | 2 | Candidato separado; smoke/performance. |
| $(@{Path=test\fastify-app.test.ts; Classification=APP_LEVEL_MONOLITH; InjectCount=49; RecommendedAction=No mover todavia; requiere decision arquitectonica propia.}.Path) | $(@{Path=test\fastify-app.test.ts; Classification=APP_LEVEL_MONOLITH; InjectCount=49; RecommendedAction=No mover todavia; requiere decision arquitectonica propia.}.Classification) | 49 | No mover todavia; requiere decision arquitectonica propia. |
| $(@{Path=test\admin-pricing-api.test.ts; Classification=DOMAIN_HTTP_API; InjectCount=9; RecommendedAction=Candidato a lote pricing con public-pricing-api.}.Path) | $(@{Path=test\admin-pricing-api.test.ts; Classification=DOMAIN_HTTP_API; InjectCount=9; RecommendedAction=Candidato a lote pricing con public-pricing-api.}.Classification) | 9 | Candidato a lote pricing con public-pricing-api. |
| $(@{Path=test\logistics-audit-runtime.test.ts; Classification=DOMAIN_HTTP_API; InjectCount=8; RecommendedAction=Candidato a lote logistics runtime.}.Path) | $(@{Path=test\logistics-audit-runtime.test.ts; Classification=DOMAIN_HTTP_API; InjectCount=8; RecommendedAction=Candidato a lote logistics runtime.}.Classification) | 8 | Candidato a lote logistics runtime. |
| $(@{Path=test\logistics-route-plans-cache-runtime.test.ts; Classification=DOMAIN_HTTP_API; InjectCount=8; RecommendedAction=Candidato a lote logistics runtime.}.Path) | $(@{Path=test\logistics-route-plans-cache-runtime.test.ts; Classification=DOMAIN_HTTP_API; InjectCount=8; RecommendedAction=Candidato a lote logistics runtime.}.Classification) | 8 | Candidato a lote logistics runtime. |
| $(@{Path=test\logistics-route-plans-heuristic-runtime.test.ts; Classification=DOMAIN_HTTP_API; InjectCount=4; RecommendedAction=Candidato a lote logistics runtime.}.Path) | $(@{Path=test\logistics-route-plans-heuristic-runtime.test.ts; Classification=DOMAIN_HTTP_API; InjectCount=4; RecommendedAction=Candidato a lote logistics runtime.}.Classification) | 4 | Candidato a lote logistics runtime. |
| $(@{Path=test\logistics-route-plans-metrics-runtime.test.ts; Classification=DOMAIN_HTTP_API; InjectCount=3; RecommendedAction=Candidato a lote logistics runtime.}.Path) | $(@{Path=test\logistics-route-plans-metrics-runtime.test.ts; Classification=DOMAIN_HTTP_API; InjectCount=3; RecommendedAction=Candidato a lote logistics runtime.}.Classification) | 3 | Candidato a lote logistics runtime. |
| $(@{Path=test\public-pricing-api.test.ts; Classification=DOMAIN_HTTP_API; InjectCount=5; RecommendedAction=Candidato a lote pricing con admin-pricing-api.}.Path) | $(@{Path=test\public-pricing-api.test.ts; Classification=DOMAIN_HTTP_API; InjectCount=5; RecommendedAction=Candidato a lote pricing con admin-pricing-api.}.Classification) | 5 | Candidato a lote pricing con admin-pricing-api. |
| $(@{Path=test\public-professionals-logging-invariants.test.ts; Classification=PUBLIC_PROFESSIONALS_INVARIANT; InjectCount=9; RecommendedAction=Candidato a lote public-professionals invariant.}.Path) | $(@{Path=test\public-professionals-logging-invariants.test.ts; Classification=PUBLIC_PROFESSIONALS_INVARIANT; InjectCount=9; RecommendedAction=Candidato a lote public-professionals invariant.}.Classification) | 9 | Candidato a lote public-professionals invariant. |
| $(@{Path=test\public-professionals-response-headers-invariants.test.ts; Classification=PUBLIC_PROFESSIONALS_INVARIANT; InjectCount=20; RecommendedAction=Candidato a lote public-professionals invariant; tiene anchors activos.}.Path) | $(@{Path=test\public-professionals-response-headers-invariants.test.ts; Classification=PUBLIC_PROFESSIONALS_INVARIANT; InjectCount=20; RecommendedAction=Candidato a lote public-professionals invariant; tiene anchors activos.}.Classification) | 20 | Candidato a lote public-professionals invariant; tiene anchors activos. |
| $(@{Path=test\public-professionals-route-surface-invariants.test.ts; Classification=PUBLIC_PROFESSIONALS_INVARIANT; InjectCount=7; RecommendedAction=Candidato a lote public-professionals invariant; tiene anchors activos.}.Path) | $(@{Path=test\public-professionals-route-surface-invariants.test.ts; Classification=PUBLIC_PROFESSIONALS_INVARIANT; InjectCount=7; RecommendedAction=Candidato a lote public-professionals invariant; tiene anchors activos.}.Classification) | 7 | Candidato a lote public-professionals invariant; tiene anchors activos. |
| $(@{Path=test\contact-route.test.ts; Classification=PUBLIC_ROUTE_HTTP_API; InjectCount=19; RecommendedAction=Candidato separado o lote public-route; archivo grande.}.Path) | $(@{Path=test\contact-route.test.ts; Classification=PUBLIC_ROUTE_HTTP_API; InjectCount=19; RecommendedAction=Candidato separado o lote public-route; archivo grande.}.Classification) | 19 | Candidato separado o lote public-route; archivo grande. |
| $(@{Path=test\audit-export-boundaries.test.ts; Classification=SECURITY_OR_BOUNDARY; InjectCount=5; RecommendedAction=Candidato a lote audit/security boundary; tiene anchors activos en audit/security guards.}.Path) | $(@{Path=test\audit-export-boundaries.test.ts; Classification=SECURITY_OR_BOUNDARY; InjectCount=5; RecommendedAction=Candidato a lote audit/security boundary; tiene anchors activos en audit/security guards.}.Classification) | 5 | Candidato a lote audit/security boundary; tiene anchors activos en audit/security guards. |
| $(@{Path=test\auth-password-change.test.ts; Classification=SECURITY_OR_BOUNDARY; InjectCount=8; RecommendedAction=Candidato a lote auth/security boundary.}.Path) | $(@{Path=test\auth-password-change.test.ts; Classification=SECURITY_OR_BOUNDARY; InjectCount=8; RecommendedAction=Candidato a lote auth/security boundary.}.Classification) | 8 | Candidato a lote auth/security boundary. |
| $(@{Path=test\login-rate-limit-operability.test.ts; Classification=SECURITY_OR_BOUNDARY; InjectCount=5; RecommendedAction=Candidato a lote rate-limit.}.Path) | $(@{Path=test\login-rate-limit-operability.test.ts; Classification=SECURITY_OR_BOUNDARY; InjectCount=5; RecommendedAction=Candidato a lote rate-limit.}.Classification) | 5 | Candidato a lote rate-limit. |
| $(@{Path=test\login-rate-limit-reset-on-success.test.ts; Classification=SECURITY_OR_BOUNDARY; InjectCount=22; RecommendedAction=Candidato a lote rate-limit; archivo grande.}.Path) | $(@{Path=test\login-rate-limit-reset-on-success.test.ts; Classification=SECURITY_OR_BOUNDARY; InjectCount=22; RecommendedAction=Candidato a lote rate-limit; archivo grande.}.Classification) | 22 | Candidato a lote rate-limit; archivo grande. |
| $(@{Path=test\report-write-surface-ownership.test.ts; Classification=SECURITY_OR_BOUNDARY; InjectCount=2; RecommendedAction=Candidato a lote reports/security boundary; tiene anchors activos en report catalog/suite.}.Path) | $(@{Path=test\report-write-surface-ownership.test.ts; Classification=SECURITY_OR_BOUNDARY; InjectCount=2; RecommendedAction=Candidato a lote reports/security boundary; tiene anchors activos en report catalog/suite.}.Classification) | 2 | Candidato a lote reports/security boundary; tiene anchors activos en report catalog/suite. |
| $(@{Path=test\security-csrf-mutating-route-coverage.test.ts; Classification=SECURITY_OR_BOUNDARY; InjectCount=8; RecommendedAction=Candidato a lote security boundary.}.Path) | $(@{Path=test\security-csrf-mutating-route-coverage.test.ts; Classification=SECURITY_OR_BOUNDARY; InjectCount=8; RecommendedAction=Candidato a lote security boundary.}.Classification) | 8 | Candidato a lote security boundary. |
| $(@{Path=test\security-trusted-origin-cors-boundaries.test.ts; Classification=SECURITY_OR_BOUNDARY; InjectCount=6; RecommendedAction=Candidato a lote security boundary; tiene anchors activos en security registries.}.Path) | $(@{Path=test\security-trusted-origin-cors-boundaries.test.ts; Classification=SECURITY_OR_BOUNDARY; InjectCount=6; RecommendedAction=Candidato a lote security boundary; tiene anchors activos en security registries.}.Classification) | 6 | Candidato a lote security boundary; tiene anchors activos en security registries. |
| $(@{Path=test\security\auth-session-boundaries.test.ts; Classification=SECURITY_OR_BOUNDARY_ALREADY_PLACED; InjectCount=15; RecommendedAction=Ya esta bajo test/security; no mover en bloque non-fastify root.}.Path) | $(@{Path=test\security\auth-session-boundaries.test.ts; Classification=SECURITY_OR_BOUNDARY_ALREADY_PLACED; InjectCount=15; RecommendedAction=Ya esta bajo test/security; no mover en bloque non-fastify root.}.Classification) | 15 | Ya esta bajo test/security; no mover en bloque non-fastify root. |
| $(@{Path=test\security\security-rate-limit-cross-realm-isolation.test.ts; Classification=SECURITY_OR_BOUNDARY_ALREADY_PLACED; InjectCount=17; RecommendedAction=Ya esta bajo test/security; no mover en bloque non-fastify root.}.Path) | $(@{Path=test\security\security-rate-limit-cross-realm-isolation.test.ts; Classification=SECURITY_OR_BOUNDARY_ALREADY_PLACED; InjectCount=17; RecommendedAction=Ya esta bajo test/security; no mover en bloque non-fastify root.}.Classification) | 17 | Ya esta bajo test/security; no mover en bloque non-fastify root. |

## Anchors activos en test/**

| Candidato | Anchor activo | Texto |
|---|---|---|
| N/A | N/A | Sin anchors activos en test/**. |

## Lectura del inventario

El bloque non-fastify no es homogeneo. Contiene:

- contratos API/error/observability
- dominios HTTP/API como pricing y logistics
- security/boundary tests
- invariants public-professionals
- un monolito app-level: `test/fastify-app.test.ts`
- archivos ya ubicados bajo `test/security/`

Por eso no corresponde mover todo en lote unico.

## Recomendacion para TEST-ARCH-25

Primer move recomendado: **pricing HTTP/API batch**.

Motivo:
- lote chico
- dominio homogeneo
- 2 archivos
- menor superficie que `fastify-app.test.ts`, rate-limit o public-professionals invariants

Candidatos:

- `test/admin-pricing-api.test.ts`
- `test/public-pricing-api.test.ts`

Destino recomendado:

- `test/integration/adapters/controllers/`

Justificacion:
- ambos son tests HTTP/API con `app.inject()`
- validan rutas backend expuestas
- siguen el mismo criterio fisico de controller/request-injection usado en el cierre controller-fastify

## Bloqueados o diferidos

Diferir:

- `test/fastify-app.test.ts`: app-level monolith, 49 injects.
- `test\security\auth-session-boundaries.test.ts`: ya ubicado bajo `test/security/`.
- `test\security\security-rate-limit-cross-realm-isolation.test.ts`: ya ubicado bajo `test/security/`.
- public-professionals invariant group: tiene varios anchors historicos y debe moverse junto.
- rate-limit group: archivos grandes y security-sensitive.

## Criterio para futuros PRs

Antes de mover cualquier archivo no-fastify:

1. Confirmar destino enterprise correcto.
2. Confirmar anchors activos en `test/**`.
3. Mover por grupos homogeneos.
4. Actualizar anchors en el mismo PR.
5. No tocar runtime/producto/DB/CI/deps/lockfile.
6. No usar Codex ni Claude.

## Validaciones

Pendiente completar antes de commit:

| Comando | Resultado |
|---|---|
| `git diff --check` | Pendiente |
| `git diff --stat` | Pendiente |
| `git diff --name-only` | Pendiente |
| `git status --short --untracked-files=all` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' test` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' build` | Pendiente |
| `& 'C:\Program Files\nodejs\pnpm.cmd' security:public-surface` | Pendiente |

## Confirmacion

TEST-ARCH-24 es docs-only y manual. No se uso Codex ni Claude.