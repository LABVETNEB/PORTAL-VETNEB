// ─────────────────────────────────────────────────────────────────────────────
// E2E-GLOBAL-10 · single owner of the document zero-scroll régime.
//
// LIMPIEZA E2E P2-2 / R-12 recorded two régimes for ONE invariant: A08
// (`regression/dashboard-zero-scroll-baseline`) froze the document scroll delta
// at exactly 0 px over its 273 canonical combinations, while the older shell
// contracts kept a 1-2 px allowance. A 1-2 px regression therefore passed in
// one place and failed in the other, and the number had no owner.
//
// This module is that owner. Every spec that asserts THE SAME THING A08 asserts
// — `scrollHeight - clientHeight` and `scrollWidth - clientWidth` of
// `document.documentElement`, `document.body` or the shell's `main` region —
// imports this constant instead of declaring a local literal.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EXACT contract, not a tolerance. `AGENTS.md` §10 states the invariant as
 * `SCROLL_VERTICAL_DEL_DOCUMENTO = 0` / `SCROLL_HORIZONTAL_DEL_DOCUMENTO = 0`,
 * so the régime freezes zero, not "almost zero": any delta of 1 px or more
 * fails.
 *
 * It is measured, not aspirational — A08 reports a delta of exactly 0 px on its
 * six metrics across all 273 canonical combinations, so the gate is enforced at
 * the value the shell already holds and no runtime change was needed to reach
 * it.
 *
 * It must NOT be raised to absorb a failure: a positive delta is a runtime
 * defect to report, not a number to re-tune.
 */
export const MAX_DOCUMENT_SCROLL_DELTA_PX = 0;

// What this constant does NOT own, and why those surfaces keep their own
// allowance:
//
//   * BOX GEOMETRY (`getBoundingClientRect` edges, a band top, a pager bottom).
//     Those are fractional CSS pixels compared against integer viewport bounds,
//     so a sub-pixel allowance is the contract, not a leak.
//   * INTERNAL CONTAINERS that A08 does not measure (module roots, workspace,
//     surface, the worst internal scroller). `AGENTS.md` §10 lists
//     `SCROLL_INTERNO_NO_AUTORIZADO` as a separate invariant and no canonical
//     matrix has frozen those deltas at 0 px yet, so converging them would be a
//     claim with no measurement behind it. They stay where they are until a
//     measurement — not a search-and-replace — says otherwise.
