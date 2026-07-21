# Pricing · infrastructure (persistencia y cache)

> Capa **infrastructure** del contexto Pricing. **Contiene código** desde **M18
> (Fase D)**: la persistencia canónica (`db-pricing.ts`) y el cache canónico de
> precios públicos (`public-pricing-cache.ts`).
> Ver la frontera del contexto en [`../README.md`](../README.md) y el contrato en
> [ARCH-2](../../../../docs/architecture/backend-boundary-adr.md).
>
> **Estado M18 — mergeado y cerrado.** Esta capa se estableció mediante el
> move técnico de M18, mergeado por **PR #1519** (squash SHA
> `5f99b5f40e08ea8929be869374f1d154f740153f`, 2026-07-21): `db-pricing.ts` y
> `public-pricing-cache.ts` son la **persistencia y el cache canónicos** del
> contexto. Los paths legacy `server/db-pricing.ts` y
> `server/lib/public-pricing-cache.ts` fueron **shims temporales** (un único
> `export *`) durante M18 y **M19 los retiró** — PR #1521, squash SHA
> `d1b25111d6bc0aa644647e67a784cb596b4e1afe`, 2026-07-21: retirado
> `server/db-pricing.ts`, retirado `server/lib/public-pricing-cache.ts`; el acceso
> operativo es `route → servicio directo → canónico`. **M19 mergeado y cerrado.**
> Fase D sigue abierta; M20 no iniciado.

## Responsabilidad

Es el único lugar del contexto que conoce el motor de persistencia (Drizzle
sobre `server/db.ts` + `drizzle/schema.ts`) y el cache in-memory de precios
públicos. Pricing **no tiene reglas de dominio**: el acceso a datos es CRUD +
serialización directa.

## Regla de dependencia

- **Puede importar:** archivos de la propia capa, `server/db.ts`,
  `drizzle/schema.ts` y el runtime de `drizzle-orm`.
- **No puede importar:** `fastify`, `server/routes`, cualquier capa
  `application`, `frontend`, `auth/session/CORS/audit/email`, `server/lib` ni los
  shims legacy. (Verificado por
  `test/architecture/pricing-infrastructure-boundary-guard.test.ts`.)

## Qué vive aquí

- **`db-pricing.ts`** (M18) — **implementación canónica** de la persistencia del
  contexto: **160 LOC** medidos en HEAD `877185f` antes del move. El archivo se
  movió **completo** desde `server/db-pricing.ts`, sin reorganizar funciones, sin
  extraer mappings, sin renombrar exports y **sin introducir transacciones**:
  conserva exactamente **0 call-sites `.transaction(`**. Lo único que cambia son
  los dos specifiers exigidos por la nueva profundidad: `../../../db.ts` (mismo
  `server/db.ts`) y `../../../../drizzle/schema.ts` (mismo `drizzle/schema.ts`).
  - Superficie pública: `listPublicPricingItems`, `listAdminPricingItems`,
    `updatePricingItem` (valores) + `PricingItem`, `UpdatePricingItemInput`
    (tipos).
  - Invariantes preservados: `serializePricingItem` (updatedAt → ISO string,
    `priceLabel ?? null`), guard `hasPatchFields` (PATCH sin campos devuelve el
    registro actual sin escribir `updatedAt`), ordenamientos
    `category → displayOrder → id`, registro inexistente → `null`.
- **`public-pricing-cache.ts`** (M18) — **cache canónico** in-memory de precios
  públicos, movido **byte-idéntico** desde `server/lib/public-pricing-cache.ts`.
  Es un **módulo puro con cero imports**: TTL fijo de **5 minutos**, expiración
  **lazy** (`expiresAt <= now`), estado module-level (`cacheEntry`), defaults
  `Date.now()` y semántica HIT/MISS/clear intacta. La invariante de cero imports
  impide cablearle Redis, DB, timers o `server/lib` a futuro sin pasar por
  revisión de arquitectura.

## Shims legacy — retirados en M19

`server/db-pricing.ts` y `server/lib/public-pricing-cache.ts` fueron **shims
temporales** de un único `export *` hacia estos canónicos durante M18. **M19 los
retiró** al adelgazar las rutas (cero consumidores operativos tras el reapunte):
el único acceso es ahora `route → servicio directo del contexto → canónico`.
`test/architecture/pricing-infrastructure-boundary-guard.test.ts` fija que ambos
paths legacy están ausentes, que no pueden recrearse y que ningún módulo
productivo ni test operativo los resuelve.
