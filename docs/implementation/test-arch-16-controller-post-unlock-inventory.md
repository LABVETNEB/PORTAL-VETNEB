# TEST-ARCH-16 - Controller post-unlock inventory

## Resumen ejecutivo

TEST-ARCH-16 es un inventario docs-only del estado de controller tests despues de
TEST-ARCH-13, TEST-ARCH-14 y TEST-ARCH-15. No mueve tests, no edita tests, no
toca runtime, backend productivo, DB, schema, migraciones, CI, dependencias,
`package.json` ni `pnpm-lock.yaml`.

Resultado del censo recursivo:

| Grupo | Cantidad | Estado |
|---|---:|---|
| `*.fastify.test.ts` bajo `test/` | 29 | Total controller Fastify detectado. |
| Ya movidos a `test/integration/adapters/controllers/` | 13 | `YA_MOVIDO`. |
| Legacy `*.fastify.test.ts` todavia en `test/` raiz | 16 | 13 `MOVIBLE_SEGURO`, 3 `BLOQUEADO_POR_ANCHOR`. |
| HTTP/API request-injection no `*.fastify.test.ts` | 29 | Fuera del lote controller-fastify; requiere auditoria separada por ambiguedad de clasificacion. |

Recomendacion: TEST-ARCH-17 deberia mover solo el grupo study-tracking
desbloqueado por TEST-ARCH-15, 3 archivos:

- `test/admin-study-tracking.fastify.test.ts`
- `test/particular-study-tracking.fastify.test.ts`
- `test/study-tracking.fastify.test.ts`

El subtrio reports (`admin-reports`, `reports`, `reports-status`) no debe moverse
todavia: `test/report-study-types-catalog.test.ts` conserva una lista hardcodeada
de rutas `test/<archivo>` y un `assert.deepEqual` que quedaria rojo si esos
archivos se mueven sin un fix previo.

## Base verificada

| Item | Resultado |
|---|---|
| Repo | `C:\PORTAL-VETNEB` |
| Entorno | Windows, PowerShell, PNPM |
| Rama esperada | `docs/controller-post-unlock-inventory` |
| Rama observada | `docs/controller-post-unlock-inventory` |
| HEAD observado | `85257f4 test(architecture): support source path guard fallbacks (#1322)` |
| Working tree inicial | Limpio (`git status --short` sin salida). |
| `git diff --stat` inicial | Sin salida. |
| PRs abiertos | Ninguno (`gh pr list --state open --limit 50 --json ...` devolvio `[]`). |
| Residuo remoto conocido | `origin/test/particular-authenticated-session-fixture`, observado con `git branch -r --no-merged origin/main`; no se toco. |

## Comandos de inventario usados

Todos los comandos se ejecutaron desde Terminal 1, raiz `C:\PORTAL-VETNEB`, con
PowerShell. No se uso `rg`.

```powershell
git status --short
git branch --show-current
git log -1 --oneline
git diff --stat
git branch -r --no-merged origin/main
gh pr list --state open --limit 50 --json number,title,headRefName,baseRefName,isDraft
Get-ChildItem -LiteralPath 'test' -Recurse -File -Filter '*.fastify.test.ts' | Select-Object -ExpandProperty FullName
Get-ChildItem -LiteralPath 'docs\implementation' -File | Where-Object { $_.Name -like 'test-arch-11*' -or $_.Name -like 'test-arch-12*' -or $_.Name -like 'test-arch-13*' -or $_.Name -like 'test-arch-14*' -or $_.Name -like 'test-arch-15*' -or $_.Name -eq 'test-suite-enterprise-organization-convention.md' }
Get-Content -LiteralPath 'test\README.md'
Get-Content -LiteralPath 'docs\implementation\test-suite-enterprise-organization-convention.md'
Get-Content -LiteralPath 'docs\audit\test-suite-enterprise-architecture-audit.md'
Get-Content -LiteralPath 'docs\implementation\test-arch-12-enterprise-controller-bulk-batch-1.md'
Get-Content -LiteralPath 'docs\implementation\test-arch-13-recursive-suite-census-and-source-path-guards.md'
Get-Content -LiteralPath 'docs\implementation\test-arch-14-enterprise-controller-audit-group-a.md'
Get-Content -LiteralPath 'docs\implementation\test-arch-15-source-path-guards-bd-unlock.md'
Select-String -LiteralPath <test/docs/scripts/package files> -SimpleMatch -Pattern 'test/<legacy-fastify-basename>'
Select-String -LiteralPath 'test\report-study-types-catalog.test.ts' -Pattern 'admin-reports.fastify|reports.fastify|reports-status.fastify|critical report tests stop using free-text|listSourceFiles|deepEqual' -Context 2,2
Select-String -LiteralPath 'test\study-tracking-suite-completeness.test.ts','test\reports-suite-completeness.test.ts','test\storage-suite-completeness.test.ts','test\architecture\security\security-critical-route-surface-registry.test.ts','test\security-boundary-suite-completeness.test.ts' -Pattern '<legacy fastify basenames>|assertFileExists|readSource|existsSync|path:' -Context 1,1
Get-ChildItem -LiteralPath 'test' -Recurse -File -Filter '*.test.ts' | ForEach-Object { Select-String -LiteralPath $_.FullName -Pattern '\.inject\(' }
```

## Docs normativos inspeccionados

| Documento | Estado |
|---|---|
| `test/README.md` | Leido. |
| `docs/implementation/test-suite-enterprise-organization-convention.md` | Leido. |
| `docs/audit/test-suite-enterprise-architecture-audit.md` | Leido. |
| `docs/implementation/test-arch-11*` | No existe archivo con ese patron en `docs/implementation/`. |
| `docs/implementation/test-arch-12-enterprise-controller-bulk-batch-1.md` | Leido. |
| `docs/implementation/test-arch-13-recursive-suite-census-and-source-path-guards.md` | Leido. |
| `docs/implementation/test-arch-14-enterprise-controller-audit-group-a.md` | Leido. |
| `docs/implementation/test-arch-15-source-path-guards-bd-unlock.md` | Leido. |

Lectura normativa aplicada:

- `test/integration/adapters/controllers/` es el destino enterprise para tests
  `*.fastify.test.ts` que construyen Fastify y ejercitan `app.inject()`.
- Todo move futuro debe actualizar imports relativos y registries/path anchors en
  el mismo PR.
- TEST-ARCH-13 volvio subdirectory-aware los censos audit/security tratados ahi.
- TEST-ARCH-14 ya movio el grupo audit.
- TEST-ARCH-15 volvio subdirectory-aware seis guards adicionales y dejo
  desbloqueado el grupo study-tracking; tambien documento que
  `report-study-types-catalog.test.ts` sigue bloqueando el subtrio reports.

## Tabla de controller tests ya movidos

| Archivo | Clasificacion | Evidencia |
|---|---|---|
| `test/integration/adapters/controllers/admin-audit.fastify.test.ts` | `YA_MOVIDO` | En destino enterprise; movido por TEST-ARCH-14. |
| `test/integration/adapters/controllers/admin-clinics.fastify.test.ts` | `YA_MOVIDO` | En destino enterprise. |
| `test/integration/adapters/controllers/admin-failed-login-alerts.fastify.test.ts` | `YA_MOVIDO` | En destino enterprise. |
| `test/integration/adapters/controllers/admin-report-workflow.fastify.test.ts` | `YA_MOVIDO` | En destino enterprise. |
| `test/integration/adapters/controllers/admin-sessions.fastify.test.ts` | `YA_MOVIDO` | En destino enterprise. |
| `test/integration/adapters/controllers/admin-system-health.fastify.test.ts` | `YA_MOVIDO` | En destino enterprise. |
| `test/integration/adapters/controllers/admin-system-maintenance.fastify.test.ts` | `YA_MOVIDO` | En destino enterprise. |
| `test/integration/adapters/controllers/admin-system-schema-health.fastify.test.ts` | `YA_MOVIDO` | En destino enterprise. |
| `test/integration/adapters/controllers/admin-users-roles.fastify.test.ts` | `YA_MOVIDO` | En destino enterprise. |
| `test/integration/adapters/controllers/auth-authorization-integration.fastify.test.ts` | `YA_MOVIDO` | En destino enterprise. |
| `test/integration/adapters/controllers/clinic-audit.fastify.test.ts` | `YA_MOVIDO` | En destino enterprise; movido por TEST-ARCH-14. |
| `test/integration/adapters/controllers/logistics-sla-routes-integration.fastify.test.ts` | `YA_MOVIDO` | En destino enterprise. |
| `test/integration/adapters/controllers/particular-audit.fastify.test.ts` | `YA_MOVIDO` | En destino enterprise; movido por TEST-ARCH-14. |

Total ya movidos: 13.

## Tabla de controller tests legacy restantes

Todos los 16 legacy `*.fastify.test.ts` de la raiz usan Fastify y `app.inject()`,
importan `../server/**`, no usan `process.cwd()`, `fileURLToPath`,
`import.meta.url`, `new URL` ni `__dirname`, y tienen bootstrap de env sintetico
con `??=`. Los literales `SUPABASE_*`, `DATABASE_URL`, `https://example.supabase.co`
o `http://localhost:3000` son defaults de test, no evidencia de DB/red/Supabase
reales.

| Archivo legacy | Clasificacion | Anchor/test blockers | Accion minima de un move futuro |
|---|---|---|---|
| `test/admin-auth.fastify.test.ts` | `MOVIBLE_SEGURO` | `security-boundary-suite-completeness` subdirectory-aware; `security-critical-route-surface-registry` exact; `security-session-cookie-boundaries` subdirectory-aware. | Mover, ajustar imports `../server` a profundidad nueva y actualizar `path:` en `security-critical-route-surface-registry`; evaluar actualizar path documental en `security-boundary-suite-completeness`. |
| `test/admin-particular-tokens.fastify.test.ts` | `MOVIBLE_SEGURO` | `reports-suite-completeness` exact; `security-critical-route-surface-registry` exact; `security-write-attribution-boundaries` subdirectory-aware. | Mover, ajustar imports y actualizar `path:` en `reports-suite-completeness` y `security-critical-route-surface-registry`. |
| `test/admin-report-access-tokens.fastify.test.ts` | `MOVIBLE_SEGURO` | `reports-suite-completeness` exact; `security-critical-route-surface-registry` exact; `security-access-lifecycle`, `security-rate-limit-isolation`, `security-write-attribution` subdirectory-aware. | Mover, ajustar imports y actualizar `path:` en `reports-suite-completeness` y `security-critical-route-surface-registry`. |
| `test/admin-reports.fastify.test.ts` | `BLOQUEADO_POR_ANCHOR` | `report-study-types-catalog.test.ts` hardcodea `test/admin-reports.fastify.test.ts` en filtro y `assert.deepEqual`; tambien aparece en `reports-suite-completeness` y `storage-suite-completeness`. | No mover hasta corregir o hacer path-aware `report-study-types-catalog.test.ts`. |
| `test/admin-study-tracking.fastify.test.ts` | `MOVIBLE_SEGURO` | `study-tracking-suite-completeness` exact; `security-critical-route-surface-registry` exact; `security-write-attribution` subdirectory-aware; `security-cross-tenant-idor-contract` solo dato. | Mover, ajustar imports y actualizar `path:` en `study-tracking-suite-completeness` y `security-critical-route-surface-registry`. |
| `test/auth.fastify.test.ts` | `MOVIBLE_SEGURO` | `security-boundary-suite-completeness` subdirectory-aware; `security-critical-route-surface-registry` exact; `security-session-cookie-boundaries` subdirectory-aware. | Mover, ajustar imports y actualizar `path:` en `security-critical-route-surface-registry`; evaluar actualizar path documental en `security-boundary-suite-completeness`. |
| `test/clinic-public-profile.fastify.test.ts` | `MOVIBLE_SEGURO` | `storage-suite-completeness` exact. | Mover, ajustar imports y actualizar `path:` en `storage-suite-completeness`. |
| `test/particular-auth.fastify.test.ts` | `MOVIBLE_SEGURO` | `reports-suite-completeness` exact; `security-session-cookie-boundaries` subdirectory-aware; `security-cross-tenant-idor-contract` solo dato. | Mover, ajustar imports y actualizar `path:` en `reports-suite-completeness`. |
| `test/particular-study-tracking.fastify.test.ts` | `MOVIBLE_SEGURO` | `study-tracking-suite-completeness` exact; `security-access-lifecycle`, `security-resource-ownership`, `security-response-disclosure` subdirectory-aware. | Mover, ajustar imports y actualizar `path:` en `study-tracking-suite-completeness`. |
| `test/particular-tokens.fastify.test.ts` | `MOVIBLE_SEGURO` | `reports-suite-completeness` exact; `security-write-attribution` subdirectory-aware; `security-cross-tenant-idor-contract` solo dato. | Mover, ajustar imports y actualizar `path:` en `reports-suite-completeness`. |
| `test/public-professionals.fastify.test.ts` | `MOVIBLE_SEGURO` | `storage-suite-completeness` exact; `public-professionals-source-boundaries`, `security-rate-limit-isolation`, `security-validation-cutoff` subdirectory-aware. | Mover, ajustar imports y actualizar `path:` en `storage-suite-completeness`. |
| `test/public-report-access.fastify.test.ts` | `MOVIBLE_SEGURO` | `reports-suite-completeness` exact; `storage-suite-completeness` exact; security guards subdirectory-aware; `security-cross-tenant-idor-contract` solo dato. | Mover, ajustar imports y actualizar `path:` en `reports-suite-completeness` y `storage-suite-completeness`. |
| `test/report-access-tokens.fastify.test.ts` | `MOVIBLE_SEGURO` | `reports-suite-completeness` exact; `security-critical-route-surface-registry` exact; multiple security guards subdirectory-aware; `security-cross-tenant-idor-contract` solo dato. | Mover, ajustar imports y actualizar `path:` en `reports-suite-completeness` y `security-critical-route-surface-registry`. |
| `test/reports-status.fastify.test.ts` | `BLOQUEADO_POR_ANCHOR` | `report-study-types-catalog.test.ts` hardcodea `test/reports-status.fastify.test.ts` en filtro y `assert.deepEqual`; tambien aparece en `reports-suite-completeness` y security guards. | No mover hasta corregir o hacer path-aware `report-study-types-catalog.test.ts`. |
| `test/reports.fastify.test.ts` | `BLOQUEADO_POR_ANCHOR` | `report-study-types-catalog.test.ts` hardcodea `test/reports.fastify.test.ts` en filtro y `assert.deepEqual`; tambien aparece en `reports-suite-completeness` y `security-critical-route-surface-registry`. | No mover hasta corregir o hacer path-aware `report-study-types-catalog.test.ts`. |
| `test/study-tracking.fastify.test.ts` | `MOVIBLE_SEGURO` | `study-tracking-suite-completeness` exact; `security-write-attribution` subdirectory-aware; `security-cross-tenant-idor-contract` solo dato. | Mover, ajustar imports y actualizar `path:` en `study-tracking-suite-completeness`. |

Total legacy controller restantes: 16.

## Tabla de bloqueantes por archivo

| Archivo | Bloqueante | Tipo | Estado post-unlock |
|---|---|---|---|
| `test/admin-reports.fastify.test.ts` | `test/report-study-types-catalog.test.ts:142` y `:152` | Anchor hardcodeado + `assert.deepEqual`. | Bloqueado. Requiere fix previo o path update especial del catalogo. |
| `test/reports.fastify.test.ts` | `test/report-study-types-catalog.test.ts:143` y `:155` | Anchor hardcodeado + `assert.deepEqual`. | Bloqueado. Requiere fix previo o path update especial del catalogo. |
| `test/reports-status.fastify.test.ts` | `test/report-study-types-catalog.test.ts:145` y `:154` | Anchor hardcodeado + `assert.deepEqual`. | Bloqueado. Requiere fix previo o path update especial del catalogo. |

No se detecto `BLOQUEADO_POR_IMPORT_COMPLEJO` entre los 16 legacy: los imports son
relativos directos a `../server/**` y el patron probado en TEST-ARCH-14 es ajustar
profundidad a `../../../../server/**` al mover a
`test/integration/adapters/controllers/`.

No se detecto `BLOQUEADO_POR_AMBIGUEDAD_DE_CLASIFICACION` entre los 16 legacy
`*.fastify.test.ts`. Si se amplia el scope a tests no `*.fastify` con
`app.inject()`, hay 29 archivos adicionales y si entraran a TEST-ARCH deberian
auditarse aparte por ser contratos API, security, runtime, logistics o app-level,
no el lote controller-fastify restante.

## Candidatos exactos recomendados para TEST-ARCH-17

Recomendacion minima y de menor riesgo: mover el grupo study-tracking, 3 archivos.
Es el grupo que TEST-ARCH-15 dejo explicitamente desbloqueado y mantiene cohesion
de dominio.

| Archivo | Motivo | Ediciones esperadas en el PR de move |
|---|---|---|
| `test/admin-study-tracking.fastify.test.ts` | `MOVIBLE_SEGURO`; anchors subdirectory-aware o registries exact actualizables. | Move a `test/integration/adapters/controllers/`, imports a `../../../../server/**`, `path:` en `study-tracking-suite-completeness` y `security-critical-route-surface-registry`. |
| `test/particular-study-tracking.fastify.test.ts` | `MOVIBLE_SEGURO`; anchors subdirectory-aware o registry exact actualizable. | Move a destino enterprise, imports a `../../../../server/**`, `path:` en `study-tracking-suite-completeness`. |
| `test/study-tracking.fastify.test.ts` | `MOVIBLE_SEGURO`; anchors subdirectory-aware o registry exact actualizable. | Move a destino enterprise, imports a `../../../../server/**`, `path:` en `study-tracking-suite-completeness`. |

Movibles seguros no recomendados para TEST-ARCH-17 por tamano/churn de lote:

- `test/auth.fastify.test.ts`
- `test/admin-auth.fastify.test.ts`
- `test/admin-particular-tokens.fastify.test.ts`
- `test/admin-report-access-tokens.fastify.test.ts`
- `test/clinic-public-profile.fastify.test.ts`
- `test/particular-auth.fastify.test.ts`
- `test/particular-tokens.fastify.test.ts`
- `test/public-professionals.fastify.test.ts`
- `test/public-report-access.fastify.test.ts`
- `test/report-access-tokens.fastify.test.ts`

Estos diez son backlog seguro para lotes posteriores, preferentemente separados
por dominio y por registry afectado.

## Archivos exactos que NO deben moverse todavia

No mover todavia por bloqueo real:

- `test/admin-reports.fastify.test.ts`
- `test/reports.fastify.test.ts`
- `test/reports-status.fastify.test.ts`

No mover dentro de TEST-ARCH-17 aunque sean `MOVIBLE_SEGURO`, para mantener el
lote pequeno y revertible:

- `test/auth.fastify.test.ts`
- `test/admin-auth.fastify.test.ts`
- `test/admin-particular-tokens.fastify.test.ts`
- `test/admin-report-access-tokens.fastify.test.ts`
- `test/clinic-public-profile.fastify.test.ts`
- `test/particular-auth.fastify.test.ts`
- `test/particular-tokens.fastify.test.ts`
- `test/public-professionals.fastify.test.ts`
- `test/public-report-access.fastify.test.ts`
- `test/report-access-tokens.fastify.test.ts`

No meter en este bloque sin auditoria propia los 29 tests no `*.fastify.test.ts`
que usan `app.inject()`:

- `test/admin-pricing-api.test.ts`
- `test/api-contract-smoke.test.ts`
- `test/api-error-content-type-contract.test.ts`
- `test/api-error-no-secrets-contract.test.ts`
- `test/api-error-no-stack-traces-contract.test.ts`
- `test/api-request-id-observability-contract.test.ts`
- `test/audit-export-boundaries.test.ts`
- `test/auth-password-change.test.ts`
- `test/client-version-gate-contract.test.ts`
- `test/contact-route.test.ts`
- `test/fastify-app.test.ts`
- `test/global-public-surface-hardening-contract.test.ts`
- `test/global-storage-report-safety-contract.test.ts`
- `test/login-rate-limit-operability.test.ts`
- `test/login-rate-limit-reset-on-success.test.ts`
- `test/logistics-audit-runtime.test.ts`
- `test/logistics-route-plans-cache-runtime.test.ts`
- `test/logistics-route-plans-heuristic-runtime.test.ts`
- `test/logistics-route-plans-metrics-runtime.test.ts`
- `test/performance-load-smoke.test.ts`
- `test/public-pricing-api.test.ts`
- `test/public-professionals-logging-invariants.test.ts`
- `test/public-professionals-response-headers-invariants.test.ts`
- `test/public-professionals-route-surface-invariants.test.ts`
- `test/report-write-surface-ownership.test.ts`
- `test/security-csrf-mutating-route-coverage.test.ts`
- `test/security-trusted-origin-cors-boundaries.test.ts`
- `test/security/auth-session-boundaries.test.ts`
- `test/security/security-rate-limit-cross-realm-isolation.test.ts`

## Criterio de elegibilidad para proximo bulk

Un controller legacy es elegible para move a
`test/integration/adapters/controllers/` cuando cumple todo esto:

1. Es `*.fastify.test.ts`, usa Fastify y `app.inject()`.
2. No tiene `process.cwd()`, `fileURLToPath`, `import.meta.url`, `new URL` ni
   `__dirname` que vuelvan complejo el move.
3. Sus imports son relativos simples a `../server/**` y pueden ajustarse por
   profundidad.
4. Todo anchor de test path es una de estas dos cosas:
   - subdirectory-aware por TEST-ARCH-13/15, o
   - registry exacto cuyo `path:` se actualiza en el mismo PR de move.
5. No esta en un censo con lista hardcodeada que filtre por la ruta legacy sin
   resolver por basename o path canonico.
6. No requiere tocar runtime, backend productivo, DB/schema/migrations, deps,
   CI, `package.json` ni `pnpm-lock.yaml`.

## Riesgos detectados

| Riesgo | Impacto | Mitigacion |
|---|---|---|
| `report-study-types-catalog.test.ts` bloquea el subtrio reports. | Move directo deja rojo el censo por rutas hardcodeadas. | Hacer TEST-ARCH-15-b o incluir fix path-aware autorizado antes de mover esos 3. |
| Registries exactos no subdirectory-aware (`reports-suite`, `study-tracking-suite`, `storage-suite`, `security-critical-route-surface-registry`). | Si se mueve sin actualizar `path:`, falla `assertFileExists`, `readSource` o `existsSync`. | Actualizar `path:` en el mismo PR de move. |
| Lote demasiado grande mezclando auth, reports, storage y study-tracking. | Diff mas dificil de revisar y revertir. | TEST-ARCH-17 de 3 archivos study-tracking; lotes posteriores por dominio. |
| Tests no `*.fastify` con `app.inject()`. | Pueden parecer controllers pero mezclan contracts/security/runtime/API. | No incluirlos en controller-fastify move sin auditoria especifica. |
| Referencias docs historicas a rutas legacy. | No rompen tests pero pueden quedar desactualizadas si se intenta documentar exhaustivamente en cada move. | No tocar docs historicas en moves mecanicos salvo reporte del PR. |

## Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `git diff --check` | OK, sin salida. |
| `git diff --stat` | Sin salida porque el unico archivo esta untracked. |
| `git diff --name-only` | Sin salida porque el unico archivo esta untracked. |
| `git status --short --untracked-files=all` | `?? docs/implementation/test-arch-16-controller-post-unlock-inventory.md`. |
| `pnpm test` | Fallo antes del runner por shim no interactivo: `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' test` | OK: 2983 pass, 0 fail. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' build` | OK: `dist\index.js 838.3kb`. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' security:public-surface` | PASS; conserva findings `server-only` esperados en `frontend/src/proxy.ts` (`CLINIC_SESSION_COOKIE_NAME`, `ADMIN_SESSION_COOKIE_NAME`). |
| `& 'C:\Program Files\nodejs\pnpm.cmd' --dir frontend lint` | OK. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' --dir frontend typecheck` | OK. |
| `& 'C:\Program Files\nodejs\pnpm.cmd' --dir frontend build` | OK, Next.js 16.2.7 compilo y genero 25 paginas estaticas. |

## Confirmacion de no cambios fuera del Markdown

Unico archivo previsto:

- `docs/implementation/test-arch-16-controller-post-unlock-inventory.md`

Scope excluido y respetado:

- No se movieron tests.
- No se editaron tests.
- No se edito runtime.
- No se edito producto.
- No se edito backend productivo.
- No se edito DB/schema/migrations.
- No se edito CI.
- No se editaron dependencias.
- No se edito `package.json`.
- No se edito `pnpm-lock.yaml`.
- No se usaron stashes.
- No se uso `.claude/worktrees`.
- No se uso `rg`.

## Recomendacion final de tamano de lote para TEST-ARCH-17

Tamano recomendado: 3 archivos.

Mover solo el grupo study-tracking:

- `test/admin-study-tracking.fastify.test.ts`
- `test/particular-study-tracking.fastify.test.ts`
- `test/study-tracking.fastify.test.ts`

Razon: es el grupo ya desbloqueado por TEST-ARCH-15, mantiene una unidad de
dominio, requiere pocos registries (`study-tracking-suite-completeness` y
`security-critical-route-surface-registry`) y evita mezclar auth/reports/storage
en el mismo PR.

## Estado final

Working tree final esperado: un unico archivo untracked, este reporte Markdown.
No hay cambios tracked, no hay cambios fuera de `docs/implementation/` y no se
toco ningun archivo de tests/runtime/producto.
