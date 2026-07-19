# M05 — Cierre de la capa Domain de Logistics (Fase A)

> **Tipo:** Closeout de arquitectura, tests y documentación. **No** es un move
> adicional ni inicia application/infrastructure/routes. **Cero cambios runtime.**
> **Scope primario:** tests (guard de arquitectura) + documentación de apoyo.

## 1. Base exacta

- **Rama:** `refactor/backend-modularization-m05-logistics-domain-closeout`.
- **Base `main` / HEAD:** `ba9de2a311031e9e56ceb8fec2bb8b3d27862c79`
  — refactor(logistics): move metrics domain module (M04) (#1500).
- **Working tree inicial:** limpio · **Índice inicial:** vacío.
- **Documento rector:** `docs/audit/backend-enterprise-modularization-program-audit.md`
  (ID `ARCH-AUDIT-110`), §8 Fase A.

## 2. Propósito

Certificar —de forma ejecutable y documental— que la migración de la capa Domain
de Logistics quedó cerrada tras M02b/M03/M04:

1. `server/lib/logistics/` sin código ni archivos versionados.
2. Ningún import runtime o de test apunta al namespace de dominio legacy.
3. El inventario mínimo de módulos de dominio existe.
4. Todo consumidor runtime externo usa el barrel público.
5. El dominio sigue libre de DB, Fastify, env, infrastructure, routes e I/O.
6. La documentación viva declara la Fase A cerrada.
7. La secuencia siguiente es M06 (no se implementa).
8. El programa rector registra el estado real de la Fase A.
9. No cambia ningún comportamiento runtime.

## 3. Relación M02b → M03 → M04 → M05

| Milestone | Acción | Resultado |
| --- | --- | --- |
| M02b | move `sla-breach` + `time-window` → `domain/`; adaptador DB → `infrastructure/` | dominio puro de SLA/ventanas |
| M03 | move `route-planning` (515) → `domain/` (byte-idéntico) | heurística pura por barrel |
| M04 | move `metrics` (829) → `domain/` (byte-idéntico, cero imports) | `server/lib/logistics/` sin módulos de dominio |
| **M05** | **cierre: censo + guard + docs, sin mover archivos** | **Fase A cerrada; namespace legacy retirado** |

## 4. Censo de `server/lib/logistics/`

```powershell
git ls-files "server/lib/logistics/**"                       # → (vacío) 0 archivos versionados
Test-Path -LiteralPath "server/lib/logistics"                # → False
Get-ChildItem -LiteralPath "server/lib/logistics" -Force     # → n/a (directorio ausente)
```

- **Archivos versionados dentro de `server/lib/logistics/`:** 0.
- **Directorio físico legacy:** ausente (nada que remover; no se ejecutó
  `Remove-Item`).
- No se dispara `BLOCKED_LEGACY_SOURCE_REMAINS`.

> `server/lib/logistics-route-plans-cache.ts` (con guion, no `/`) **sigue versionado**
> y es runtime legítimo: es la cache del contexto (move en M13). No pertenece al
> namespace de dominio y queda fuera de este cierre.

## 5. Censo de imports legacy

```powershell
git grep -n -I -E "from (?:['""])([^'""]*/)?lib/logistics/|import\((?:['""])([^'""]*/)?lib/logistics/|require\((?:['""])([^'""]*/)?lib/logistics/" -- server test
# → exit 1 (sin matches)
git grep -n -I -E "lib/logistics/(metrics|route-planning|sla-breach|time-window|pagination|route-plan-field-visits|index)" -- test
# → exit 1 (sin matches)
```

- **Imports estáticos / dinámicos / `require` a `lib/logistics/` (dominio):** 0.
- **Tests que importan o leen (`readFileSync`) el path de dominio legacy:** 0.
- No se dispara `BLOCKED_RUNTIME_LEGACY_IMPORT`.
- **No fue necesario** el path-swap condicional autorizado en `test/**`: no existe
  ningún import/literal de dominio legacy que sustituir.

## 6. Clasificación de referencias documentales

| Referencia | Tipo | Acción |
| --- | --- | --- |
| `server/features/logistics/README.md` (§2, §4, §5, header) | LIVE_STALE | corregido (Fase A cerrada, legacy retirado) |
| `server/features/logistics/domain/README.md` | CURRENT + faltaba cierre | addendum de certificación M05 |
| `application/README.md` (`ARCH-6`) | LIVE_STALE | corregido → M06 |
| `infrastructure/README.md` ("en M02b") | LIVE_STALE | corregido → M12/M13 explícitos |
| `routes/README.md` (`ARCH-6`) | LIVE_STALE | corregido → M14–M17 |
| `docs/architecture/shared-lib-boundary-inventory.md` (tablas M01) | HISTORICAL | conservado; addendum fechado añadido |
| `docs/logistics/ROLLING_ROADMAP.md` (`server/lib/logistics/*`) | HISTORICAL | conservado; nota de vigencia añadida |
| `docs/audit/backend-enterprise-modularization-program-audit.md` §8 | LIVE (rector) | anotación de status de ejecución |
| `docs/architecture/backend-boundary-adr.md` | HISTORICAL | intacto (fuera de scope; describe el plan/ADR) |
| `docs/audit/repository-domain-architecture-audit.md`, `AUDIT_WHITE_BOX_*` | HISTORICAL | intacto (snapshots) |
| `docs/implementation/logistics-domain-shell.md`, `m02b/m03/m04-*.md` | HISTORICAL | intacto (registro de sus PRs) |
| `server/features/logistics/domain/{sla-breach,time-window}.ts` (comentarios) | HISTORICAL | intacto (comentarios de procedencia; no son imports) |

No se eliminó evidencia histórica.

## 7. Inventario de módulos requeridos

Subconjunto obligatorio (no inventario cerrado) presente en
`server/features/logistics/domain/`:

`index.ts`, `pagination.ts`, `route-plan-field-visits.ts`, `time-window.ts`,
`sla-breach.ts`, `route-planning.ts`, `metrics.ts`.

LOC (vía `git ls-files "server/features/logistics/domain/*.ts" | xargs wc -l`):
1.685 total (metrics 829, route-planning 515, sla-breach 111, index 91, pagination 52,
time-window 51, route-plan-field-visits 36).

## 8. Cambios del guard

`test/architecture/logistics-domain-boundary-guard.test.ts` — se **preservan** los
cuatro contratos previos (existencia + pureza + imports permitidos + consumo por
barrel) y se **añaden tres** contratos de cierre:

1. **Inventario mínimo requerido** — comprueba presencia de `REQUIRED_DOMAIN_MODULES`
   como subconjunto (no igualdad exacta del directorio).
2. **Ausencia del directorio legacy** — `server/lib/logistics` no existe en checkout
   limpio (mensaje: "no debe reaparecer después del cierre M05").
3. **Prohibición de imports legacy** — escanea `server/**` y `test/**`, parsea import
   specifiers con el parser existente (`listImportSpecifiers`) y falla si alguno
   resuelve a `server/lib/logistics` o `server/lib/logistics/**`. La constante legacy
   se construye por concatenación; sólo se comparan **specifiers de import** (no texto
   libre ni comentarios); no escanea Markdown; excluye explícitamente la cache
   `logistics-route-plans-cache` (guion). No excluye ningún archivo runtime.

### 8.1 Cobertura del parser de imports (follow-up de review)

`listImportSpecifiers` reconoce las **cuatro** formas de import que pueden reintroducir
el namespace legacy:

- `import ... from "..."`
- `require("...")`
- `import("...")` (dinámico)
- `import "...";` — **import estático de efecto lateral** (sin binding).

La cuarta forma se agregó como respuesta al hallazgo del review (thread
`PRRT_kwDOR5qlsc6SDrz9`): sin ella, un `import "server/lib/logistics/foo";` en
`server/**` o `test/**` habría pasado el guard silenciosamente. La cobertura queda
fijada por un test de regresión enfocado y autónomo que demuestra, sobre la sintaxis
concreta del review, que (a) el parser **extrae** el specifier de efecto lateral y
(b) `pointsToLegacyDomain` lo **clasifica** como legacy; el mismo test verifica que
las tres formas previas siguen reconociéndose sin cambios. No se añadió ninguna
dependencia ni parser TypeScript externo, ni se debilitó ningún assert.

No se debilitó ni eliminó ningún contrato. No se añadieron responsabilidades de M11
(application), M17/M45 (infra/ciclos) ni M14–M17 (HTTP).

## 9. Confirmación de barrel

- `server/features/logistics/domain/index.ts` — **UNCHANGED_AFTER_REVIEW.** Expone la
  superficie de los seis módulos; el censo no encontró ninguna exportación existente
  omitida. No se agregaron exports preventivos ni reorganización cosmética.
- `test/unit/domain/logistics/logistics-domain-barrel.test.ts` — **UNCHANGED_AFTER_REVIEW.**
  Ya fija todas las exportaciones.

## 10. Archivos modificados

- `test/architecture/logistics-domain-boundary-guard.test.ts` — **MODIFIED** (guard).
- `server/features/logistics/README.md` — **MODIFIED.**
- `server/features/logistics/domain/README.md` — **MODIFIED.**
- `server/features/logistics/application/README.md` — **MODIFIED.**
- `server/features/logistics/infrastructure/README.md` — **MODIFIED.**
- `server/features/logistics/routes/README.md` — **MODIFIED.**
- `docs/architecture/shared-lib-boundary-inventory.md` — **MODIFIED** (addendum).
- `docs/logistics/ROLLING_ROADMAP.md` — **MODIFIED** (nota de vigencia).
- `docs/audit/backend-enterprise-modularization-program-audit.md` — **MODIFIED** (status §8).
- `docs/implementation/m05-logistics-domain-phase-closeout.md` — **CREATED** (esta nota).

Ningún archivo runtime `.ts` bajo `server/**` fue modificado.

## 11. Contratos preservados

Cero cambios de comportamiento observable: runtime, endpoints, payloads, status codes,
headers, auth/authz, queries, transacciones, schema, algoritmos, exports públicos
existentes e imports runtime. El build sigue generando `dist/index.js`.

## 12. Validaciones

Ver §14 del reporte de la tarea. Dirigido primero
(`logistics-domain-boundary-guard` + `test/unit/domain/logistics/*`), luego
`pnpm validate:local` (typecheck + typecheck:test + test + build), luego
`git diff --check` y revisión de artefactos.

## 13. Test-count reconciliation

- **Dirigido previo (pre-M05):** 71 tests, 71 pass, 0 fail, 0 skip.
- **Dirigido posterior:** 75 tests, 75 pass, 0 fail, 0 skip.
- **Casos nuevos en el guard:** 4 — inventario mínimo requerido, ausencia del directorio
  legacy, prohibición de imports legacy y **cobertura de imports de efecto lateral**
  (este último, follow-up del review §8.1).
- **Suite total (`pnpm validate:local`):** 3.147 tests, 3.146 pass, 0 fail, 1 skip.
  El único skip es preexistente en la suite global (ajeno al scope M05); el guard y los
  tests de dominio tienen 0 skips.
- **Casos eliminados:** 0 · **Skips previos (guard/dominio):** 0 · **Skips nuevos:** 0.

## 14. Exclusiones

No se tocó: `domain/*.ts` (lógica), `application/*.ts`, `infrastructure/*.ts`,
`routes/*.ts`, `server/db-logistics.ts`, `server/lib/logistics-route-plans-cache.ts`,
rutas Fastify, `fastify-app.ts`, `drizzle/**`, migraciones, schema, auth/sesiones/
CORS/CSP/rate limits, `frontend/**`, `package.json`, lockfiles, `.github/**`,
`scripts/**`. No se crearon use cases, services, ports, repositories, adapters,
event bus, barrels nuevos ni shims. No se inició M06/M12/M13/M14–M17.

## 15. Rollback independiente

M05 se revierte en un único commit sin revertir M02b–M04: retira el endurecimiento
del guard y restaura la documentación previa. **No** restaura módulos legacy, **no**
mueve archivos y **no** afecta runtime. Al no haber cambios de runtime, el rollback
es independiente de la cadena M02b–M04.

## 16. Riesgos residuales

- Bajo. El endurecimiento es aditivo y verde; el barrel y su test quedan intactos.
- La cache `logistics-route-plans-cache.ts` queda deliberadamente fuera del guard de
  legacy (es runtime vigente hasta M13); la detección la excluye por diseño (guion vs `/`).
- Documentación histórica (ADR, auditorías, notas M02b–M04) conserva paths
  `server/lib/logistics/*` como registro de su estado; no se corrige por diseño.

## 17. Readiness para M06

- Dominio cerrado y protegido por guard; barrel estable como único punto de entrada.
- Próximo milestone: **M06 — primer caso de uso SLA (lectura/overdue) + puertos
  mínimos** en `application/` (hoy docs-only). No iniciado en M05.

## 18. Condición de stop si se detecta runtime legacy

Si el censo hubiera encontrado archivos versionados en `server/lib/logistics/`,
un import runtime legacy bajo `server/**`, o un test importando el path legacy sin
destino canónico inequívoco, el cierre se habría detenido con
`BLOCKED_LEGACY_SOURCE_REMAINS` / `BLOCKED_RUNTIME_LEGACY_IMPORT` respectivamente,
sin reapuntar runtime silenciosamente. En este HEAD ninguno se disparó.
