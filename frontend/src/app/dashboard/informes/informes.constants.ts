// Real-fetch (RF) debounced strategy, same contract proven on
// `AdminAuditCard`/`AdminReportsCard` (R-06): the server `page`/`pageSize`
// pair is re-derived from the measured rows container, never a fixed
// constant. The fallback below only covers the pre-measurement paint.
export const INFORMES_FALLBACK_ROWS = 6;
// This is a Clínica full route, not an Admin App Shell surface — no
// `expectNinePopulatedRows` floor applies (that contract only pins
// Admin's Tokens/Reports/Audit/Users-Roles modules).
export const INFORMES_LIMIT_CAP = 24;
