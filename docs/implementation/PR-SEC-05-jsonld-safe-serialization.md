# PR-SEC-05 — Serialización segura de JSON-LD (SEC-17)

## Estado base

- Rama: `fix/sec-17-jsonld-safe-serialization`, creada desde `origin/main` = `3c8186bdf3b77ccbd8cd70a261c286542ac7447c`.
- Scope: frontend-only (R1) + guards de test y auditor de seguridad pública. Sin cambios en `server/`, dependencias, workflows ni DB (M48 no aplica).

## Hallazgo SEC-17

Diez páginas inyectaban JSON-LD con `dangerouslySetInnerHTML={{ __html: JSON.stringify(...) }}`. `JSON.stringify` no escapa `<`, así que un valor con `</script><script>…` cerraría el `<script>` y permitiría inyección HTML/XSS. Hoy los datos son estáticos; el riesgo era latente ante datos dinámicos. El guard CSP y el auditor exigían `application/ld+json` + `JSON.stringify`, pero no verificaban la protección contra cierre de `<script>`.

## Serializer

`serializeJsonLd(data: unknown): string` en `frontend/src/lib/json-ld.ts` (única definición; módulo sin dependencias: importarlo desde `seo.ts` arrastraba los tipos de `next` al typecheck raíz de tests y rompía `typecheck:test`). `JSON.stringify` + escape de `<`, `>`, `&`, U+2028 y U+2029 como `\u003c`, `\u003e`, `\u0026`, `\u2028`, `\u2029`. JSON válido y semánticamente idéntico (`JSON.parse` recupera el original), sin mutar la entrada ni doble serializar.

## Inventario de sinks migrados (10)

`app/layout.tsx`, `precios`, `contacto`, `profesionales`, `clinicas`, `servicios`, `citologia-veterinaria`, `informes-veterinarios`, `histopatologia-veterinaria`, `laboratorio-patologico-veterinario` (todos bajo `frontend/src/app/`). Inventario verificado por búsqueda en `frontend/src`: no existen otros usos de `dangerouslySetInnerHTML`.

## Contratos fortalecidos

- `test/unit/ui/frontend/frontend-csp-inline-blockers-contract.test.ts`: el sink debe ser `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(` ; `JSON.stringify` crudo, expresiones arbitrarias o `serializeJsonLd` fuera de un script JSON-LD fallan. Nuevos tests: definición única y consumidores importando de `@/lib/json-ld` (10 consumidores) y regresión sintética con sinks inseguros.
- `scripts/security/audit-public-devtools-surface.mjs`: la regla `dangerously-set-inner-html` sólo justifica un sink con `application/ld+json` y `__html: serializeJsonLd(`; el marcador de revisión explícita existente no cambia. Sin allowlists nuevas.
- Tests existentes que anclaban `JSON.stringify(jsonLd)` literal se realinearon a `serializeJsonLd(` (no se debilitó ninguno).
- Mismo `frontend-csp-inline-blockers-contract.test.ts`: pruebas de comportamiento del serializer (caracteres peligrosos, `</script>`, Unicode, comillas/barras, anidados, `JSON.parse`, inmutabilidad, sin doble escape) y verificación de los 10 sinks. Viven allí y no en `frontend-seo-public-surface-extreme.test.ts` porque un import estático de `frontend/src` o un registry literal nuevo en ese spec movía dos cifras del censo 01B (MIXED 63 > 62; registry literal 134 > 133) fuera de banda.
- `frontend-public-devtools-exposure-contract.test.ts`: prueba end-to-end del auditor real en workspace temporal (seguro pasa; `JSON.stringify` crudo y expresión arbitraria fallan).

## Archivos modificados

10 páginas/layout, `frontend/src/lib/json-ld.ts` (nuevo), `scripts/security/audit-public-devtools-surface.mjs`, 8 archivos de test (7 realineados + CSP ampliado) bajo `test/unit/ui/` y este documento.

## Gates

- Tests dirigidos (`test/unit/ui/public/*`, CSP, SEO metadata, censo 01B; 370 tests): PASSED.
- `pnpm --dir frontend lint`, `typecheck`, `build`: PASSED. `pnpm security:public-surface`: PASSED.
- `pnpm typecheck:test`: PASSED (0 errores).
- `pnpm validate:local` completo: FAILED ambiental en el worktree (sin `.env`/DB; los tests leen sólo archivos tracked y `json-ld.ts` aún no está en el índice). No atribuible al diff: el censo 01B, la única regresión real detectada, se corrigió y pasa.
- `pnpm audit`: NOT_RUN (sin cambios de dependencias).

## Riesgos residuales

- La protección depende de que todo sink use `serializeJsonLd`; está forzada por el guard CSP y por `security:public-surface`.
- El marcador `security-reviewed-dangerouslysetinnerhtml` del auditor sigue vigente para otros usos con revisión explícita (no usado hoy).

## Rollback

Revertir el PR: restablece `JSON.stringify` en los 10 sinks, elimina `serializeJsonLd` y restaura los guards anteriores. Sin migraciones ni efectos de datos.
