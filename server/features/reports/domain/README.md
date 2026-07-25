# Reports domain

Dominio puro de Reports establecido por M36.

La entrada pública es `index.ts`. Los consumidores externos no deben importar
los módulos internos directamente. Dentro de la capa se permiten imports
relativos entre módulos y tipos de `drizzle/schema.ts`; no se permiten imports
runtime de schema ni dependencias de transporte, persistencia o side effects.

Inventario canónico:

- `report-status.ts`
- `report-study-types.ts`
- `reports.ts`
- `index.ts`

Los paths legacy bajo `server/lib` son shims temporales de compatibilidad. Su
retiro pertenece al censo final de Fase I, no a M36.
