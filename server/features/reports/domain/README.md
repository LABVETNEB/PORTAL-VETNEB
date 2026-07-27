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

M41 retiró los tres paths legacy bajo `server/lib`. El barrel canónico de esta
capa es la única superficie de dominio Reports para consumidores externos.
