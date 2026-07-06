/**
 * Dashboard · presentation layer (boundary placeholder).
 *
 * UI only, mirroring the CSS taxonomy already approved in #1289/#1290:
 * shell · navigation · layout · surfaces · admin · clinic.
 *
 * Boundary rule: presentation does not import `@/lib/api` directly; it
 * receives data via props or via `application` hooks (audit §6).
 *
 * Empty on purpose: PR-PRES-2 only draws the architecture boundary; concrete
 * components are relocated here (with compatibility re-exports) in later PRES
 * PRs (see docs/implementation/dashboard-presentation-boundaries.md).
 */
export {};
