# Auditoría P2-D · Taxonomía documental fragmentada — fase 0 (docs-only)

> **Modo:** AUDITORÍA. No se movió, renombró ni borró ningún archivo. No se
> tocó runtime, tests, `package.json`, `pnpm-lock.yaml`, workflows, DB,
> migraciones, Render ni secretos. No commit, no push, no PR.
>
> **Rama:** `docs/audit-documentation-taxonomy-plan`.
> **HEAD base:** `1b6f6b0 docs(audit): document backend observability debt (#1185)`.
> **Fecha:** 2026-06-29.

---

## 1. Resumen ejecutivo

**Hallazgo principal: la fragmentación documental que describe P2-D ya fue
resuelta en disco.** PR `#1163` (`af5cd28 docs: consolidate historical
documentation structure`, 2026-06-28) ejecutó el move-only completo:

- `docs/audits/` → `docs/audit/` (10 archivos unificados, sin colisión).
- `IMPLEMENTATION_NOTES/` (raíz, 34 archivos) → `docs/implementation/`.
- `docs/implementation-history/` (13 archivos) → `docs/implementation/`.
- ~31 `docs/pr-*.md` sueltos en la raíz → `docs/pr-history/`.

El inventario actual confirma que **ninguna de las cuatro ubicaciones
duplicadas/fragmentadas existe hoy**:

```
docs/audits/                 → no existe
IMPLEMENTATION_NOTES/        → no existe
docs/implementation-history/ → no existe
docs/pr-*.md (raíz)          → 0 archivos
```

Lo que queda pendiente **no es mover archivos** (ya se hizo), sino **cerrar
documentalmente** dos documentos rectores que todavía presentan P2-D como
"deuda activa pendiente" cuando en realidad ya fue ejecutada:

1. `docs/audit/final-repo-cleanup-engineering-audit.md` — §1 (línea 62-64) y
   §3 P2-D (línea 398-407) describen evidencia con conteos viejos
   (`docs/audit/` 62 / `docs/audits/` 10) como si la duplicación siguiera
   vigente, aunque el mismo documento, más abajo en la nota de seguimiento de
   **PR-CLEAN2** (línea 790-821), ya registra la ejecución real del
   2026-06-28.
2. `docs/audit/final-cleanup-current-status-snapshot.md` — tabla "Pendientes
   reales" (línea 49-53) lista `P2-D | Taxonomía documental fragmentada |
   Pendiente`, contradiciendo el estado real en disco.

No se detectaron referencias de alto riesgo rotas: ningún test, script ni
workflow lee hoy una ruta bajo `docs/audits/`, `IMPLEMENTATION_NOTES/` o
`docs/implementation-history/`.

---

## 2. Inventario actual por carpeta (`docs/` + raíz)

```
99  docs/implementation
62  docs/pr-history
58  docs/audit
21  docs/audit/evidence/dashboard-runtime-post-ux1
14  docs/ (archivos sueltos en raíz, no pr-*.md)
 6  docs/security
 6  docs/ops
 5  docs/release
 5  docs/governance
 4  docs/logistics
 3  docs/qa
 3  docs/notes
 3  docs/changelog
 1  docs/protocol
 1  docs/product
 1  docs/archive
```

Carpetas/archivos mencionados por P2-D como fragmentados, verificados ausentes:

| Ruta histórica | Estado en disco | Verificación |
| --- | --- | --- |
| `docs/audits/` | **no existe** | `Get-ChildItem docs/audits` → error de ruta |
| `IMPLEMENTATION_NOTES/` (raíz) | **no existe** | `Get-ChildItem IMPLEMENTATION_NOTES` → error de ruta |
| `docs/implementation-history/` | **no existe** | `Get-ChildItem docs/implementation-history` → error de ruta |
| `docs/pr-*.md` sueltos en raíz de `docs/` | **0 archivos** | `Get-ChildItem docs -File -Filter "pr-*.md"` → vacío |
| `docs/pr-history/` | **62 archivos** (destino consolidado) | existe, poblada |
| `docs/implementation/` | **99 archivos** (destino consolidado) | existe, poblada |
| `docs/audit/` | **58 archivos** en raíz + 21 en `evidence/dashboard-runtime-post-ux1/` (destino consolidado) | existe, poblada |

**Commit responsable de la consolidación:** `af5cd28 docs: consolidate
historical documentation structure (#1163)`. Confirmado vía:
```
git log --oneline --all -- docs/audits docs/implementation-history IMPLEMENTATION_NOTES docs/pr-history
```

---

## 3. Referencias detectadas (`git grep`)

### 3.1 Referencias a rutas viejas (`docs/audits/`, `IMPLEMENTATION_NOTES/`, `docs/implementation-history/`)

Todas las apariciones encontradas son **prosa histórica** (notas de
implementación y auditorías que narran el move-only ya ejecutado, o
documentos índice como `docs/HISTORICAL_DOCUMENTATION.md` y
`docs/SOURCES_OF_TRUTH.md` que documentan correctamente "ex-`docs/audits/`,
ahora en `docs/audit/`"). **Ninguna es una referencia de código activo, test
ni script** que intente leer esas rutas hoy. Archivos relevantes:

- `AGENTS.md`
- `docs/HISTORICAL_DOCUMENTATION.md`
- `docs/SOURCES_OF_TRUTH.md`
- `docs/audit/README.md`
- `docs/audit/repository-operational-ordering-audit.md`
- `docs/implementation/chore-docs-organize-audit-implementation-notes.md`
- `docs/implementation/audit-auth-password-change-security-contracts.md`
- `docs/implementation/feat-auth-dashboard-password-change-ui.md`
- `docs/implementation/feat-auth-password-change-api-clients.md`
- `docs/implementation/feat-dashboard-no-scroll-premium-redesign.md`
- `docs/implementation/feat-dashboard-premium-visual-shell.md`
- `docs/implementation/fix-dashboard-clear-last-module-on-logout.md`
- `docs/implementation/fix-dashboard-surface-password-change-panel.md`

Estas no requieren cambio: reescribirlas reescribiría historia documental ya
cerrada (precedente explícito en
`docs/audit/repository-operational-ordering-audit.md` §3/§4/§8: "no se
reescribe historia").

### 3.2 Tests/scripts que leen rutas exactas de `docs/` (alto riesgo si se mueve algo)

```
test/admin-docs-operational-contract.test.ts        → docs/staging-smoke-runbook.md, docs/release-readiness.md
test/frontend-dashboard-filter-drawer-sticky-filters.test.ts → docs/pr-history/pr-6-dashboard-filter-drawer-sticky-filters.md
test/global-e2e-production-readiness-contract.test.ts → docs/audit/global-e2e-extreme-production-audit.md,
                                                          docs/pr-history/pr-826-global-e2e-extreme-production-readiness.md
test/helpers/clean7a-dependency-cleanup-scope.ts     → docs/implementation/frontend-unused-deps-clean7a.md
test/production-readiness.test.ts                    → docs/implementation/IMPLEMENTATION_PRODUCTION_OBSERVABILITY_READINESS.md
test/public-staging-config-contract.test.ts          → docs/staging-smoke-runbook.md, docs/release-readiness.md
test/architecture/security/security-docs-matrix-drift-guard.test.ts        → docs/security/security-sessions-tenant-rls-audit.md,
                                                          docs/security/rls-enforcement-matrix.md,
                                                          docs/security/RBAC_MATRIX.md,
                                                          docs/security/ENDPOINT_PERMISSION_MATRIX.md,
                                                          docs/security/ENDPOINT_TEST_MATRIX.md,
                                                          docs/ops/CROSS_TENANT_SMOKE_EVIDENCE_RUNBOOK.md
test/architecture/security/security-production-invariants.test.ts          → docs/security/csp-reporting-rollout.md
test/smoke-env-contract.test.ts                      → docs/smoke-local.md
test/smoke-local-contract.test.ts                    → docs/smoke-local.md
```

**Ninguno** de estos tests referencia `docs/audits/`, `IMPLEMENTATION_NOTES/`
ni `docs/implementation-history/`. Todas las rutas fijadas ya apuntan a la
taxonomía consolidada (`docs/audit/`, `docs/implementation/`,
`docs/pr-history/`, `docs/security/`, `docs/ops/`, raíz `docs/`). Esto
confirma que la consolidación de #1163 ya actualizó estos guards en su
momento (precedente: tests de scope alineados in-PR, mencionado en el
documento rector §13).

---

## 4. Qué queda realmente pendiente de P2-D

No queda trabajo de **movimiento de archivos**. Queda únicamente:

1. **Cerrar documentalmente** la sección P2-D en
   `docs/audit/final-repo-cleanup-engineering-audit.md` (actualizar evidencia
   con los conteos reales y remover la recomendación de ejecutar PR-CLEAN2,
   que ya fue ejecutado).
2. **Actualizar** la tabla "Pendientes reales" en
   `docs/audit/final-cleanup-current-status-snapshot.md` para mover P2-D de
   `Pendiente` a `Cerrado` (referenciando #1163).
3. Opcional, no bloqueante: revisar si conviene un índice de navegación
   adicional (`docs/audit/README.md` ya cumple ese rol para `docs/audit/`,
   y `docs/SOURCES_OF_TRUTH.md` / `docs/HISTORICAL_DOCUMENTATION.md` ya
   documentan el mapa completo).

No se proponen fases de movimiento porque no hay movimiento que hacer. Las
fases A-D originalmente previstas en el brief (consolidar `audits→audit`,
mover `pr-*.md`, decidir `IMPLEMENTATION_NOTES` vs `implementation-history`,
crear índice) **ya fueron ejecutadas por #1163** salvo el cierre documental
del punto 4 (índice), que ya existe en `docs/SOURCES_OF_TRUTH.md` y
`docs/HISTORICAL_DOCUMENTATION.md`.

| Fase prevista en el brief | Estado real |
| --- | --- |
| Fase A: `docs/audits` → `docs/audit` | **Ejecutada** por #1163 |
| Fase B: `docs/pr-*.md` → `docs/pr-history/` | **Ejecutada** por #1163 |
| Fase C: `IMPLEMENTATION_NOTES/` vs `docs/implementation-history/` | **Ejecutada** por #1163 (ambas absorbidas en `docs/implementation/`) |
| Fase D: índice de navegación / SOURCES_OF_TRUTH | **Ya existe**: `docs/SOURCES_OF_TRUTH.md`, `docs/HISTORICAL_DOCUMENTATION.md`, `docs/audit/README.md` |

**No se ejecutan moves en esta fase 0** (no hay ninguno pendiente que
ejecutar; el hallazgo de esta auditoría es que el move-only ya había
ocurrido y los documentos rectores no se habían actualizado para reflejarlo).

---

## 5. Confirmación docs-only

- No se movió, renombró ni borró ningún archivo.
- No se tocó runtime frontend/backend, tests, `package.json`,
  `pnpm-lock.yaml`, workflows, DB, migraciones, Render ni secretos.
- Cambios de esta auditoría: este documento nuevo +
  actualización de estado en `final-repo-cleanup-engineering-audit.md` y
  `final-cleanup-current-status-snapshot.md` + nota en
  `docs/implementation/documentation-taxonomy-audit.md`.
