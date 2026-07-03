# R-04 · Admin Particular Tokens — confirmación de contrato `total`

- **PR:** R-04 (docs-only)
- **Fecha:** 2026-07-03
- **Base:** `main` @ `2c6de7f` (feat(admin): adapt reports workflow server pagination to viewport, #1265)
- **Rama:** `docs/admin-particular-tokens-total-contract`

## Fuentes inspeccionadas (read-only)

1. `docs/audit/final-global-vetneb-50-60-pr-roadmap.md` — entradas R-04/R-05 y matriz P1 "Tokens admin sin `total`".
2. `docs/implementation/server-adaptive-pagination-strategy.md` — filas #5 "Tokens particulares (admin)", §5/§9 (bloqueo explícito hasta esta confirmación).
3. `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx` — `PAGE_SIZE=9` (desktop) / `MOBILE_PAGE_SIZE=10` (mobile), fetch vía `getAdminParticularTokens({ limit, offset })`, `canGoNext` derivado de `tokens.length === PAGE_SIZE`.
4. `frontend/src/lib/api.ts` — tipo `AdminParticularTokensSnapshot` (líneas 739-750) y `getAdminParticularTokens` (líneas 801-828).
5. `server/routes/admin-particular-tokens.fastify.ts` — handler `GET /api/admin/particular-tokens` (líneas 599-635): `limit`/`offset` parseados, `deps.listParticularTokens({ clinicId, limit, offset })`, respuesta `{ success, count: tokens.length, particularTokens, pagination: { limit, offset }, filters }`.

## Contrato actual (frontend + API)

```ts
// frontend/src/lib/api.ts:739-750
export type AdminParticularTokensSnapshot = {
  success: true;
  count: number;                 // = particularTokens.length de ESTA página, no total global
  particularTokens: AdminParticularTokenSummary[];
  pagination: {
    limit: number;                // eco del limit solicitado
    offset: number;                // eco del offset solicitado
  };
  filters: {
    clinicId: number | null;
  };
};
```

Respuesta real del servidor (`server/routes/admin-particular-tokens.fastify.ts:626-635`):

```ts
return reply.code(200).send({
  success: true,
  count: tokens.length,
  particularTokens: tokens.map(serializeParticularToken),
  pagination: { limit, offset },
  filters: { clinicId },
});
```

## Evidencia sobre `total` / `hasMore` / `hasNext`

- **`total`: NO EXISTE.** Ni en el tipo `AdminParticularTokensSnapshot`, ni en la respuesta del handler, ni en `deps.listParticularTokens` (sólo recibe `clinicId/limit/offset`, no ejecuta un `COUNT`). No hay ninguna consulta de conteo total en la ruta — `count` es simplemente `tokens.length` de la página devuelta.
- **`hasMore` / `hasNext`: NO EXISTEN.** El campo no está en el contrato de red. El frontend infiere paginación con heurística de página llena: `canGoNext = tokens.length === PAGE_SIZE` (desktop) y `canGoNextMobile = mobileTokens.length === MOBILE_PAGE_SIZE` (mobile) — ya implementado hoy en `AdminParticularTokensCard.tsx:563-564`.
- **`pagination.limit/offset`** son sólo eco de lo solicitado, no metadatos derivados del total.
- Contraste con otros endpoints admin del mismo archivo (`frontend/src/lib/api.ts`) que sí exponen `total`/`totalPages` (p. ej. reports en líneas 494-497, 596-604) o `hasMore` explícito (línea 1686) — confirma que el patrón existe en el codebase, pero **particular-tokens admin no lo implementa**.

## Decisión para R-05

**R-05 puede hacerse sin tocar backend: SÍ.**

- Estrategia por defecto (adoptada): **OF (offset/limit) con cap + "cargar más"**, usando `hasNext` derivado por heurística de página llena (superset/página llena), igual al patrón ya vigente en `AdminParticularTokensCard.tsx` y consistente con `docs/implementation/server-adaptive-pagination-strategy.md` §9 fila "Tokens admin | 9 (sin total) | 30 + 'cargar más'".
- **Ningún `total` de backend en R-05.** Añadir un `COUNT` real al endpoint queda **prohibido salvo autorización explícita de Nico ⚠** — es cambio de contrato de API (`server/routes/admin-particular-tokens.fastify.ts` + `deps.listParticularTokens`), fuera del scope docs-only de R-04 y del scope frontend-only previsto para R-05.
- R-05 debe: colapsar la dualidad desktop/mobile (`matchMedia`-cardinalidad, `PAGE_SIZE=9` vs `MOBILE_PAGE_SIZE=10`) en una sola fuente server-adaptativa, siguiendo el patrón ya probado en PR-SRV-1/PR-SRV-2 (Sessions/Roles/Clinics/Reports), manteniendo `hasNext` vía página-llena (sin `pageCount`, sin clamp de última página exacto).

## Scope permitido/prohibido para R-05

- **Permitido:** `AdminParticularTokensCard.tsx`, módulo mobile shim asociado, tests, bloque e2e propio, doc de acompañamiento.
- **Prohibido salvo autorización explícita:** cualquier cambio en `server/routes/admin-particular-tokens.fastify.ts`, `deps.listParticularTokens`, o el tipo `AdminParticularTokensSnapshot` en `frontend/src/lib/api.ts` (contrato de red).
- **Prohibido:** `globals.css`, dominios ajenos (R-48), CI, lockfiles.

## Riesgos residuales

- Sin `total`, no hay clamp de última página garantizado ni conteo exacto visible al admin — riesgo aceptado y documentado, mitigado con "cargar más" + heurística de página llena (mismo patrón ya en producción).
- Archivo `AdminParticularTokensCard.tsx` es de gran tamaño (~1.9k LOC según auditoría previa) — R-05 debe minimizar el diff y no reescribir secciones no relacionadas con paginación.
- Si en el futuro se autoriza `total` en backend, este documento queda obsoleto para esa parte y debe reemplazarse (no editarse retroactivamente sin nueva fecha/PR).

## Confirmación

Este documento es **docs-only**. No se modificó ningún archivo fuera de `docs/**`. No se implementó R-05. No se ejecutó `git add/commit/push` ni se abrió PR.
