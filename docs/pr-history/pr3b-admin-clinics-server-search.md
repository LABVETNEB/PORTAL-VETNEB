# PR-3B — feat(admin): add server-side clinics search

## Summary

Converts the admin clinics search from client-side (filtering the loaded page in-memory)
to server-side (query parameter forwarded to the database, total count reflects the filter).

- Backend receives a `search` query parameter, applies `ILIKE` on `clinics.name` and
  `clinics.contactEmail`, and counts only the matching rows.
- Frontend sends the trimmed search term to `getAdminClinics`, resets to offset 0 on
  every change (300 ms debounce), and drops the old `filteredRows` client-side filter.
- Pagination counters (`total`, `hasPrev`, `hasNext`) now reflect the filtered universe.

## Files changed

| File | Change |
|---|---|
| `server/db-admin-clinics.ts` | Add `normalizeSearch` helper; add `search?` param to `listAdminClinics`; apply `ilike` WHERE on name + contactEmail (both select and count queries) |
| `server/routes/admin-clinics.fastify.ts` | Add `search?` to `AdminClinicsQuery` type and `AdminClinicsNativeRoutesOptions.listAdminClinics` signature; parse + sanitize `request.query.search`; forward to `deps.listAdminClinics` |
| `frontend/src/lib/api.ts` | Add `search?` to `getAdminClinics` params; append non-empty trimmed value to `URLSearchParams` |
| `frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx` | Add `useRef` import; update `loadClinics(offset, search)` to forward `search`; replace initial-load `useEffect` + add debounced search `useEffect`; remove `filteredRows` useMemo; use `rows` directly in JSX table |
| `test/admin-clinics.fastify.test.ts` | Add 4 new route tests: search forwarded, absent search, empty search, truncation to 100 chars |
| `test/frontend-admin-clinics-management-card.test.ts` | Replace 4 duplicate client-side-filter tests with server-side assertions; add 2 new tests (reset-to-page-0, no-double-filter) |

## Backend contract

```
GET /api/admin/clinics?limit=50&offset=0&search=demo

Response (unchanged shape):
{
  "success": true,
  "clinics": [...],   // filtered page
  "total": 3,         // count of matching rows (not all rows)
  "limit": 50,
  "offset": 0
}
```

**Search sanitization (route layer)**:
- `search` is optional; absent or whitespace-only → not forwarded to DB function
- Trimmed and capped at 100 characters before forwarding

**Search sanitization (DB layer)**:
- `normalizeSearch` trims, slices to 100 chars, returns `undefined` for empty string
- `undefined` → no WHERE clause → full list (backward compatible)

**Fields searched**: `clinics.name`, `clinics.contactEmail` (both case-insensitive via `ILIKE`)

**Count query** applies the same WHERE clause, so `total` matches the filtered result set.

## Frontend behavior

| Scenario | Behavior |
|---|---|
| Initial mount | `useEffect` fires immediately with `searchQuery = ""`; loads all clinics |
| User types in search | 300 ms debounce then `loadClinics(0, searchQuery)` — resets to page 1 |
| Pagination nav | `loadClinics(newOffset)` preserves current `searchQuery` |
| Create / update / delete | `loadClinics()` preserves current offset and `searchQuery` |
| Empty search | `getAdminClinics` called without `search` param — full list |
| No results | Empty state message: `No hay clínicas que coincidan con "…"` |
| No clinics at all | Empty state message: `No hay clínicas para mostrar.` |

No client-side `filteredRows` filter — what the server returns is what the table shows.

## Tests added/updated

### Backend (`test/admin-clinics.fastify.test.ts`) — 4 new tests

1. `admin clinics GET reenvía parámetro search al listado` — verifies `search` reaches mock
2. `admin clinics GET sin search no envía el campo al listado` — absent param → `undefined`
3. `admin clinics GET search vacío no envía el campo al listado` — whitespace-only → `undefined`
4. `admin clinics GET trunca search a 100 caracteres` — 200-char input capped to 100

### Frontend (`test/frontend-admin-clinics-management-card.test.ts`) — 4 updated + 2 new

- Updated: search input test now checks `search:` in source and asserts NO `filteredRows`
- New: `resets to page 0 when search changes` — asserts `searchQuery]` dependency and `loadClinics(0`
- New: `does not double-filter rows client-side` — asserts no `filteredRows`, confirms `rows.map(` and `rows.length`

## Validation commands and results

```
pnpm test                    → 2453 tests, 0 failures
pnpm build                   → dist/index.js 858.1 kB, Done in 59 ms
pnpm security:public-surface → PASS — no public devtools exposure findings
pnpm --dir frontend lint     → (no output — clean)
pnpm --dir frontend typecheck → (no output — clean)
pnpm --dir frontend build    → compiled successfully
git diff --check             → (no whitespace errors)
```

## Risks / rollback notes

- **No breaking contract change**: `search` is optional; existing callers that omit it get the
  same full-list behavior as before.
- **`ILIKE` is PostgreSQL-specific**: acceptable — the project uses Supabase/PostgreSQL exclusively.
- **SQL injection**: not possible. `ilike` uses parameterized queries via Drizzle ORM; the
  `%${search}%` interpolation is inside the ORM builder, not raw SQL.
- **Performance**: `ILIKE '%term%'` does a full table scan. Acceptable for admin-only use on a
  clinic count that is not expected to exceed thousands. If performance degrades, a
  `pg_trgm` GIN index on `clinics.name` is the natural next step (out of scope).
- **Rollback**: revert the 6 staged files to HEAD; no migration or schema change needed.
