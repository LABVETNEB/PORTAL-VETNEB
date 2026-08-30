# ADR: Migration Snapshot Integrity — Manual Migrations Policy

> **Tipo:** ADR **docs + config**. Retira el script `db:generate` de
> `package.json` y agrega un guard estático de integridad. No ejecuta
> migraciones, no toca `drizzle/schema.ts`, no modifica SQL histórico, no
> reconstruye snapshots, no abre conexión a ninguna base de datos.
> **Hallazgo asociado:** VET-07 (MEDIUM/HIGH, Persistence) — cadena de
> snapshots de Drizzle Kit incompleta.
> **Bloque:** WBR-09.

## 1. Contexto

Drizzle Kit gestiona dos flujos independientes sobre `drizzle/migrations/`:

- **`drizzle-kit migrate`** (`pnpm db:migrate`): lee únicamente
  `meta/_journal.json` y los archivos `.sql` nombrados por cada entrada del
  journal (`readMigrationFiles` en `drizzle-orm/migrator.cjs`). Nunca abre ni
  referencia `meta/*_snapshot.json`.
- **`drizzle-kit generate`** (`pnpm db:generate`, ya retirado — ver §3): para
  calcular el diff a convertir en SQL, toma como estado "anterior" el
  **último archivo `*_snapshot.json` presente físicamente en disco**
  (`preparePrevSnapshot`: `snapshots[snapshots.length - 1]`, ordenado
  alfabéticamente), no una cadena histórica completa reconstruida ni
  validada contra el journal completo.

El repositorio conserva únicamente 4 snapshots (`0010`, `0011`, `0012`,
`0014`) para 31 migraciones SQL reales (`0000`..`0030`). El último snapshot
en disco es `0014`. Bajo el mecanismo descrito arriba, ejecutar
`db:generate` compararía el schema TypeScript actual (que ya refleja los
cambios de las migraciones `0015`..`0030`) contra el snapshot de `0014`,
generando SQL que reintroduciría cambios ya aplicados por esas 17
migraciones.

Esta conclusión se verificó leyendo el código fuente instalado localmente de
`drizzle-kit`/`drizzle-orm` (`node_modules/drizzle-kit/bin.cjs`,
`node_modules/drizzle-orm/migrator.cjs`) — no requirió ni ejecutó ninguna
migración ni conexión a base de datos.

## 2. Decisión

Se adopta la **Estrategia E2: retirar el generador inseguro y declarar
política de migraciones manuales**, en lugar de reconstruir los 27
snapshots faltantes (Estrategia E1).

**Justificación de E1 vs. E2:** E1 exigiría reconstruir, de forma
determinista y verificable, el estado de schema exacto en cada uno de los
27 puntos históricos faltantes. No existe en el repositorio ningún
mecanismo automatizado y sin base de datos capaz de hacerlo con certeza; la
única forma de generar snapshots fieles requeriría ejecutar `drizzle-kit
generate` iterativamente contra una base de datos real en cada paso
histórico, lo cual excede la autorización R2 de este bloque (R3 requerido
para cualquier operación contra una base de datos). Por lo tanto:

```
E1_STATUS = NOT_VERIFIABLE_WITHOUT_R3_DB
```

Se aplica E2 por defecto, tal como indica el roadmap.

```
MIGRATION_POLICY = MANUAL_MIGRATION_POLICY
```

## 3. Qué cambia

- `package.json`: `db:generate` is retired — se retira el script
  `"db:generate": "drizzle-kit generate"`. No se sustituye por ningún alias
  equivalente
  (`drizzle-kit generate --custom`, `drizzle-kit push`, script propio,
  etc.).
- `"db:migrate": "drizzle-kit migrate"` se conserva sin cambios — su
  mecanismo (journal + SQL) es correcto y no depende de la cadena de
  snapshots (ver §1).
- Se agrega un guard estático (`test/architecture/migration-snapshot-integrity.test.ts`)
  que verifica la integridad SQL↔journal↔snapshot y bloquea la
  reintroducción de `db:generate` o cualquier alias de
  `drizzle-kit generate`.

## 4. Qué NO cambia

- `drizzle/schema.ts` — sin modificaciones. Sigue siendo la fuente de
  verdad del modelo TypeScript actual.
- `drizzle/migrations/*.sql` — ningún archivo histórico fue reescrito.
- `meta/_journal.json` — sin modificaciones (ya es 31/31 exacto respecto al
  SQL).
- Los 4 snapshots existentes (`0010`, `0011`, `0012`, `0014`) — se
  **retienen** como artefactos históricos, sin valor autoritativo para
  generar diffs. No se eliminan: no hay evidencia de que conservarlos
  introduzca riesgo adicional, y no ampliar el cambio es preferible.

## 5. Modelo canónico de migraciones (política vigente)

1. `drizzle/schema.ts` describe el modelo TypeScript **actual**; es la
   fuente de verdad del estado esperado del schema.
2. Las migraciones SQL se **escriben y revisan manualmente**. No existe un
   comando canónico de generación automática en este repositorio.
3. Toda migración nueva debe:
   - agregarse como `.sql` en `drizzle/migrations/` con el próximo prefijo
     numérico secuencial (`00NN_descripcion.sql`);
   - registrarse como entrada nueva en `meta/_journal.json` con `idx`
     consecutivo y `tag` igual al nombre de archivo sin extensión.
4. Los snapshots existentes en `meta/*_snapshot.json` **no constituyen una
   cadena completa** y **no son fuente autorizada** para generar diffs
   automáticos.
5. `db:generate` está **deliberadamente deshabilitado** mientras la cadena
   de snapshots permanezca incompleta. No debe reintroducirse bajo ningún
   alias.
6. `db:migrate` (`drizzle-kit migrate`) sólo puede ejecutarse bajo las
   reglas de autorización de `AGENTS.md` (R2/R3 según corresponda) y nunca
   contra producción sin las validaciones que AGENTS.md exige.
7. Toda migración que altere datos o estructuras en uso requiere un plan de
   rollback/recuperación documentado cuando `AGENTS.md` lo exija, antes de
   aplicarse a cualquier entorno no local.
8. Nunca debe aplicarse SQL generado automáticamente sobre una base con
   datos reales sin revisión humana explícita — este ADR no cambia esa
   regla, la reafirma.

## 6. Estado de validación

```
MIGRATION_METADATA_INTEGRITY = VERIFIED_STATICALLY
DATABASE_SCHEMA_MATCH        = NOT_VERIFIED
MIGRATION_EXECUTION          = NOT_VERIFIED
ROLLBACK_EXECUTION           = NOT_VERIFIED
```

Este ADR certifica únicamente la integridad **estática** de los metadatos
de migración (SQL↔journal↔snapshot) y la retirada del generador inseguro.
No afirma, ni puede afirmar sin acceso R3 a una base de datos real, que el
schema de ninguna base de datos (local, staging o producción) coincida con
`drizzle/schema.ts`.

## 7. Consecuencias

- Cualquier cambio de schema futuro requiere que un ingeniero escriba el
  SQL de migración a mano y lo registre en el journal — no hay atajo
  automático.
- El riesgo de que `db:generate` reintroduzca SQL ya aplicado queda
  cerrado: el comando ya no existe en `package.json`.
- Un guard automático (`test/architecture/migration-snapshot-integrity.test.ts`)
  falla la suite si alguien reintroduce `db:generate` o un alias
  equivalente, o si la relación SQL↔journal↔snapshot se rompe.
