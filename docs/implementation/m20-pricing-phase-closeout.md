# M20 — Pricing phase closeout (Fase D)

> **Tipo:** Cierre documental **docs-only** de la Fase D (Pricing) del
> [Backend Enterprise Modularization Program](../audit/backend-enterprise-modularization-program-audit.md)
> (ID `ARCH-AUDIT-110`). No implementa, no mueve archivos, no renombra, no toca
> código, tests, `package.json`, lockfiles, CI ni schema.
> **M18 permanece cerrado. M19 permanece cerrado. M20 cierra documentalmente
> Pricing. La Fase D queda cerrada con la integración de este cambio. M21 no
> iniciado.**

Este cambio documental constituye **M20**. Al integrarse en `main`, cierra la
**Fase D**. El documento está redactado para permanecer factual después del
merge: no reclama metadata que todavía no existe (número de PR, head final,
squash SHA, merge timestamp ni estado de checks remotos de M20).

## 1. Baseline

```text
rama                = docs/backend-modularization-m20-pricing-phase-closeout
base                = 785f763de9ca47cd38d50174cd5f97324b6ddb8f
predecesor          = closeout documental M19, PR #1522
working tree inicial = limpio
índice inicial       = limpio
AGENTS aplicable     = único raíz (sin AGENTS.md anidados)
tipo                = docs-only
```

Predecesores del programa (registro histórico verificado, no alterado por este
cambio):

```text
M18 = mergeado y cerrado — PR técnico #1519, squash 5f99b5f40e08ea8929be869374f1d154f740153f (2026-07-21)
M19 = mergeado y cerrado — PR técnico #1521, head b9847412fdff839ba50d2caf8c14d1a33e0af776,
      squash d1b25111d6bc0aa644647e67a784cb596b4e1afe (2026-07-21)
M19 closeout documental = PR #1522, squash 785f763de9ca47cd38d50174cd5f97324b6ddb8f
```

## 2. Objetivo

M20 **no implementa código nuevo**. Verifica y formaliza que Pricing alcanzó la
arquitectura objetivo **proporcional** definida por el programa (§4/§6 de
ARCH-AUDIT-110):

```text
route → servicio directo → infraestructura canónica
```

Sin capas `domain/` ni `application/`, sin puertos, factories ni repositorios
artificiales, porque **Pricing no tiene reglas de dominio independientes**
[CONFIRMED: `db-pricing.ts` es CRUD + `serializePricingItem` + guard de patch].
Fabricar esas capas para código inexistente está prohibido por la restricción 13
del programa. La deuda de modularización de Pricing queda saldada con la
infraestructura canónica (M18) y las rutas thin sobre servicios directos (M19);
M20 sólo registra ese cierre.

## 3. Evidencia de cierre de Pricing

Estado verificado del contexto tras M18–M19 (ninguno de estos hechos se modifica
en M20):

- **Infraestructura canónica establecida en M18.** `db-pricing.ts` es la
  persistencia canónica del contexto en
  `server/features/pricing/infrastructure/` (move completo desde
  `server/db-pricing.ts`; **cero transacciones**, superficie pública y
  serialización preservadas).
- **Cache canónico establecido en M18.** `public-pricing-cache.ts` es el cache
  canónico de precios públicos (move byte-idéntico desde
  `server/lib/public-pricing-cache.ts`; módulo puro con cero imports, TTL de 5
  minutos, expiración lazy, semántica HIT/MISS/clear intacta).
- **Rutas admin/public thin desde M19.** `server/routes/admin-pricing.fastify.ts`
  y `server/routes/public-pricing.fastify.ts` conservan **sólo** HTTP y
  cross-cutting (registro Fastify, CORS, trusted-origin, auth admin,
  parsing/validación, status codes, mensajes, headers, logging de errores,
  contexto y llamada de auditoría en el punto contractual).
- **Servicios directos como frontera.**
  `server/features/pricing/admin-pricing-service.ts` y `public-pricing-service.ts`
  componen los canónicos y retiran de las rutas la orquestación de
  datos/cache/agrupamiento. No conocen Fastify, auth, CORS ni audit.
- **Shims legacy ausentes.** `server/db-pricing.ts` y
  `server/lib/public-pricing-cache.ts` fueron **retirados en M19**.
- **Cero consumidores operativos de los shims.** El único acceso es
  `route → servicio directo → canónico`.
- **Guard de infraestructura activo.**
  `test/architecture/pricing-infrastructure-boundary-guard.test.ts` fija la
  frontera: capa con implementación real, cache con cero imports y TTL de 5
  minutos, superficie pública del DB estable, cero transacciones, shims legacy
  ausentes y no recreables, servicios directos sin HTTP/auth/CORS/audit y rutas
  que delegan en el servicio sin importar los canónicos DB/cache directamente.
- **Contratos admin/public y servicios protegidos por tests existentes.**
  `admin-pricing-api.test.ts` y `public-pricing-api.test.ts` (contratos HTTP,
  reapuntados al canónico en M18, verdes tras el adelgazamiento M19);
  `pricing-admin-service.test.ts` y `pricing-public-service.test.ts` (contratos
  conductuales de los servicios directos, M19).
- **Cero trabajo runtime adicional requerido por M20.** Los contratos HTTP,
  cache, auth, auditoría y errores quedaron preservados por M18–M19; no resta
  implementación pendiente dentro de Pricing.

Detalle técnico de los milestones previos:
[`m18-pricing-infrastructure-move.md`](./m18-pricing-infrastructure-move.md) ·
[`m19-pricing-thin-routes.md`](./m19-pricing-thin-routes.md).

## 4. Ownership Platform/Ops — Maintenance/Health

M20 registra una decisión de **clasificación dentro del programa de
modularización**: Maintenance/Health es una **capacidad operativa de plataforma
(Platform/Ops)**, no un bounded context de negocio, y **permanece fuera de
`server/features/`** con sus paths actuales (`KEEP`).

Paths operativos (verificados en HEAD; se registran desde `server/fastify-app.ts`):

```text
server/routes/admin-system-health.fastify.ts
server/routes/admin-system-maintenance.fastify.ts
server/routes/admin-system-schema-health.fastify.ts
server/db-maintenance.ts
server/lib/schema-health.ts
```

Decisión arquitectónica `KEEP` (motivos):

- Maintenance/Health es **infraestructura operativa de plataforma**: expone
  salud, schema-health y operaciones de maintenance/dry-run.
- **No modela un bounded context de negocio**; no debe recibir una carpeta
  `server/features/maintenance/` ni capas artificiales
  `domain/application/infrastructure`.
- **No debe moverse como consecuencia de M20**: conserva sus paths actuales.
- Sus cambios futuros deben gobernarse como **Platform/Ops, observabilidad, DB o
  seguridad según su impacto real**, con scope propio y autorización propia (R2
  de `AGENTS.md`).

Diferenciación explícita:

```text
Pricing            = bounded context de negocio  → modularizado (Fase D, M18–M20)
Maintenance/Health = capacidad operativa de plataforma → KEEP, fuera de features
```

Esta nota **no** afirma que Maintenance/Health quede “cerrado” funcionalmente:
sólo queda cerrada su **clasificación** dentro del programa de modularización, y
**no constituye autorización** para modificar a futuro DB, schema, rutas, health
checks o infraestructura. Otros componentes Platform/Ops (Contact, App Version)
también permanecen fuera de `features/` por la misma razón; M20 concentra la nota
explícita en Maintenance/Health.

## 5. Scope

**Incluido:**

- nuevo documento M20 (este archivo);
- actualización del programa rector (bloque vigente de Fase D — Pricing);
- actualización del inventario arquitectónico (referencias M20 / Pricing /
  Platform-Ops);
- actualización de los dos README de Pricing (contexto e infrastructure).

**Excluido:**

- código runtime; tests; DB/schema; migraciones; frontend; CI; dependencias;
- M21 y fases posteriores;
- cualquier move, refactor o creación de capas de Platform/Ops.

## 6. Archivos (allowlist ejecutada: 5 paths — 1 A · 4 M · 0 D · 0 R)

| Archivo | A/M | Cambio |
| --- | :--: | --- |
| `docs/implementation/m20-pricing-phase-closeout.md` | A | **NUEVO.** Este documento de cierre de Fase D. |
| `docs/audit/backend-enterprise-modularization-program-audit.md` | M | Bloque vigente de Fase D — Pricing: M20 = cierre documental; Fase D cerrada con este cambio; M21 = siguiente milestone, no iniciado; link a este documento; nota concisa de ownership Maintenance/Health (Platform/Ops, fuera de features, `KEEP`). |
| `docs/architecture/shared-lib-boundary-inventory.md` | M | Referencias M20 puntuales: fila de matriz `Plataforma/ops`, resumen y heading de tests `Platform / Ops`, headings de Pricing M18–M20, y referencia mínima a la decisión M20 en las filas `lib/schema-health.ts` y `db-maintenance.ts`. Sin recalcular métricas, LOC ni reordenar tablas. |
| `server/features/pricing/README.md` | M | Cabecera de estado de fase (M20 cierre documental; Fase D cerrada al integrar; M21 no iniciado) + sección «Cierre de Fase D (M20)». |
| `server/features/pricing/infrastructure/README.md` | M | Estado de fase (M18/M19 cerrados; M20 cierre documental; Fase D cerrada al integrar) + una frase de separación de ownership con Maintenance/Health. |

## 7. Validaciones (estados canónicos)

| Gate | Estado |
| --- | --- |
| `git diff --check` | **PASSED** |
| allowlist exacta (5 paths: 1 A + 4 M) | **PASSED** |
| UTF-8 estricto / sin BOM / sin U+FFFD / sin conflict markers | **PASSED** |
| links Markdown relativos de los archivos modificados | **PASSED** |
| TypeScript/tests (`pnpm validate:local`) | **NOT_RUN** — docs-only |
| build | **NOT_RUN** — docs-only |
| `pnpm security:public-surface` | **NOT_RUN** — sin runtime/frontend |
| schema/migraciones (`pnpm validate:local:schema` / `db:migrate`) | **NOT_RUN** |
| Playwright / E2E | **NOT_RUN** |
| dependency audits (`pnpm audit`) | **NOT_RUN** |
| CI remoto | **NOT_RUN** — todavía no existe PR de M20 |

Los estados **NOT_RUN** son correctos por tratarse de un cambio exclusivamente
Markdown: no se declara cobertura equivalente a CI y no se marca ningún gate
`PASSED` sin evidencia observada.

## 8. Riesgo residual

- **Riesgo runtime nulo:** cambio docs-only; no toca ejecutables, contratos HTTP,
  DB, schema, auth, cache ni dependencias.
- **Drift futuro de ownership:** alguien podría intentar crear una feature
  artificial para operaciones (`server/features/{maintenance,health,platform,ops}/`)
  o mover los paths operativos. **Mitigación:** el inventario
  ([`shared-lib-boundary-inventory.md`](../architecture/shared-lib-boundary-inventory.md))
  y el programa rector
  ([`backend-enterprise-modularization-program-audit.md`](../audit/backend-enterprise-modularization-program-audit.md))
  registran la decisión `KEEP` (Platform/Ops, fuera de features).
- **Cambios futuros de Maintenance/Health** requieren **scope propio** según su
  impacto real (Platform/Ops, observabilidad, DB o seguridad), con autorización
  R2 individual; M20 no los habilita.

## 9. Rollback

Independiente y sin efectos de datos ni runtime:

- trigger: revertir el cierre documental de Fase D;
- `git revert <squash SHA de este PR>`;
- restaura los cinco archivos Markdown a su estado previo (1 eliminación del
  documento nuevo + 4 reversiones de contenido);
- cero impacto en datos, runtime, schema, migraciones o dependencias;
- no exige revertir M18 ni M19.

## 10. Estado final

```text
M18   = cerrado
M19   = cerrado
M20   = listo para integración (cierre documental de Pricing)
Fase D = se cierra al integrar este cambio en main
M21   = no iniciado (siguiente milestone del programa: Fase E — Public Professionals)
runtime = intacto
```
