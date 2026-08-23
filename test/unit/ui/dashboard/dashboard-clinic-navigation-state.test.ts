import assert from "node:assert/strict";
import test from "node:test";

import {
  applyClinicUrlCommit,
  clinicModuleHref,
  recordClinicNavigationIntent,
  type ClinicNavigationState,
} from "../../../../frontend/src/lib/dashboard/navigation/clinicNavigationState.ts";

// B09 · P2 — clinic module navigation state machine.
//
// The defect this pins is a RACE, and a race is exactly what a browser test
// cannot pin: measured on `next dev`, the module url commits ~145ms after the
// tap and Next CANCELS the superseded push at every gap from 0 to 120ms, so the
// stale commit that triggers the bug never lands locally. Reproducing it there
// would mean fabricating timing, which turns a real defect into a flaky test.
//
// So the transition is modelled instead of raced: `applyClinicUrlCommit` IS the
// stale commit, delivered deterministically. Same input, same output, no
// clock, no CPU, no router.
//
// The scenario, verbatim from the review:
//
//   url shows `operaciones`  ->  tap Informes  ->  tap Inicio before the first
//   push commits  ->  the delayed `?module=informes` commit arrives.
//
// The pre-fix algorithm was:
//
//   pendingIntent = confirmedUrlModule === target ? null : { target }
//
// Inicio targets `operaciones`, which is still what `confirmedUrlModule` holds
// (the informes push has not committed), so the second intent CLEARED the guard
// instead of superseding it, and the stale commit reopened Informes.

const OPERACIONES = "operaciones";
const INFORMES = "informes";
const LOGISTICA = "logistica";
const BASE = "/dashboard";

function initial(module: string = OPERACIONES): ClinicNavigationState {
  return { confirmedUrlModule: module, pendingIntent: null };
}

/**
 * The pre-fix rule, kept as an executable reference so the regression is proven
 * against the algorithm that actually shipped rather than against prose.
 */
function preFixRecordIntent(
  state: ClinicNavigationState,
  target: string,
): ClinicNavigationState {
  return {
    confirmedUrlModule: state.confirmedUrlModule,
    pendingIntent: state.confirmedUrlModule === target ? null : { target },
  };
}

// ── The defect, stated as a failing transition on the old algorithm ──────────

test("P2 · the shipped algorithm loses the Inicio intent and reopens the module", () => {
  let state = initial();

  state = preFixRecordIntent(state, INFORMES);
  assert.deepEqual(
    state.pendingIntent,
    { target: INFORMES },
    "first intent arms the guard",
  );

  // Inicio, while the informes push is still in flight.
  state = preFixRecordIntent(state, OPERACIONES);
  assert.equal(
    state.pendingIntent,
    null,
    "PRE-FIX: the newest intent is dropped because it matches the stale url",
  );

  // The delayed commit lands with nothing left to stop it.
  const outcome = applyClinicUrlCommit(state, INFORMES);
  assert.equal(
    outcome.activeModule,
    INFORMES,
    "PRE-FIX: the superseded module reopens after Inicio appeared to succeed",
  );
});

test("P2 · the newest intent supersedes even when it matches the stale url", () => {
  let state = initial();

  state = recordClinicNavigationIntent(state, INFORMES);
  assert.deepEqual(state.pendingIntent, { target: INFORMES });

  state = recordClinicNavigationIntent(state, OPERACIONES);
  assert.deepEqual(
    state.pendingIntent,
    { target: OPERACIONES },
    "Inicio must win: it is the newest intention, not a no-op",
  );
  assert.equal(
    state.confirmedUrlModule,
    OPERACIONES,
    "recording an intent never invents a url commit",
  );
});

test("P2 · the stale commit cannot reopen the module and is reconciled", () => {
  let state = initial();
  state = recordClinicNavigationIntent(state, INFORMES);
  state = recordClinicNavigationIntent(state, OPERACIONES);

  const stale = applyClinicUrlCommit(state, INFORMES);

  assert.equal(
    stale.activeModule,
    null,
    "the workspace keeps the optimistic Inicio state",
  );
  assert.equal(
    stale.reconcileTo,
    OPERACIONES,
    "the stale url must be re-asserted, not merely ignored: DashboardMobileNav derives aria-current from the url",
  );
  assert.deepEqual(
    stale.state.pendingIntent,
    { target: OPERACIONES },
    "the intent stays armed until its own commit lands",
  );
  assert.equal(
    stale.state.confirmedUrlModule,
    INFORMES,
    "the commit is still recorded: it really did happen",
  );
});

// ── Convergence and the absence of a replace loop ────────────────────────────

test("P2 · reconciliation converges in exactly one replace", () => {
  let state = initial();
  state = recordClinicNavigationIntent(state, INFORMES);
  state = recordClinicNavigationIntent(state, OPERACIONES);

  const stale = applyClinicUrlCommit(state, INFORMES);
  assert.equal(stale.reconcileTo, OPERACIONES);

  // The replace produces its own commit, which matches the intent.
  const settled = applyClinicUrlCommit(stale.state, OPERACIONES);
  assert.equal(settled.activeModule, OPERACIONES, "url and workspace agree");
  assert.equal(settled.reconcileTo, null, "no second replace");
  assert.equal(
    settled.state.pendingIntent,
    null,
    "the intent is disarmed once it converges",
  );

  // Any further commit is external and must be obeyed directly.
  const afterwards = applyClinicUrlCommit(settled.state, LOGISTICA);
  assert.equal(afterwards.activeModule, LOGISTICA);
  assert.equal(afterwards.reconcileTo, null, "no replace outside a pending intent");
});

test("P2 · a stale commit that repeats cannot start a replace loop", () => {
  let state = initial();
  state = recordClinicNavigationIntent(state, INFORMES);
  state = recordClinicNavigationIntent(state, OPERACIONES);

  let outcome = applyClinicUrlCommit(state, INFORMES);
  let replaces = outcome.reconcileTo === null ? 0 : 1;

  // Even if the stale url commits again, each pass emits at most one replace
  // and the loop terminates the moment the intent's own commit lands.
  outcome = applyClinicUrlCommit(outcome.state, INFORMES);
  replaces += outcome.reconcileTo === null ? 0 : 1;

  outcome = applyClinicUrlCommit(outcome.state, OPERACIONES);
  replaces += outcome.reconcileTo === null ? 0 : 1;

  assert.equal(outcome.reconcileTo, null, "the matching commit ends the sequence");
  assert.equal(outcome.state.pendingIntent, null);
  assert.equal(replaces, 2, "one replace per stale commit, never per render");
});

// ── The transitions that already worked and must keep working ────────────────

test("normal navigation · operaciones -> informes", () => {
  let state = initial();
  state = recordClinicNavigationIntent(state, INFORMES);

  const commit = applyClinicUrlCommit(state, INFORMES);
  assert.equal(commit.activeModule, INFORMES);
  assert.equal(commit.reconcileTo, null);
  assert.equal(commit.state.pendingIntent, null);
  assert.equal(commit.state.confirmedUrlModule, INFORMES);
});

test("normal navigation · informes -> Inicio", () => {
  let state = initial(INFORMES);
  state = recordClinicNavigationIntent(state, OPERACIONES);
  assert.deepEqual(state.pendingIntent, { target: OPERACIONES });

  const commit = applyClinicUrlCommit(state, OPERACIONES);
  assert.equal(commit.activeModule, OPERACIONES);
  assert.equal(commit.reconcileTo, null);
  assert.equal(commit.state.pendingIntent, null);
});

test("same target with nothing pending is a real no-op", () => {
  const state = initial();
  const next = recordClinicNavigationIntent(state, OPERACIONES);

  assert.equal(next.pendingIntent, null, "no guard is armed when nothing is in flight");
  assert.equal(next, state, "the state object is returned untouched");
});

test("two fast module intents · A -> B", () => {
  let state = initial();
  state = recordClinicNavigationIntent(state, INFORMES);
  state = recordClinicNavigationIntent(state, LOGISTICA);
  assert.deepEqual(state.pendingIntent, { target: LOGISTICA });

  // A commits late: superseded, reconciled to B.
  const stale = applyClinicUrlCommit(state, INFORMES);
  assert.equal(stale.activeModule, null);
  assert.equal(stale.reconcileTo, LOGISTICA);

  const settled = applyClinicUrlCommit(stale.state, LOGISTICA);
  assert.equal(settled.activeModule, LOGISTICA);
  assert.equal(settled.state.pendingIntent, null);
});

test("external navigation without a pending intent is obeyed", () => {
  // Deep link, Back/Forward and the last-module restore all arrive here.
  const state = initial();
  const commit = applyClinicUrlCommit(state, LOGISTICA);

  assert.equal(commit.activeModule, LOGISTICA, "never skipped outside the optimistic window");
  assert.equal(commit.reconcileTo, null, "and never rewritten");
  assert.equal(commit.state.confirmedUrlModule, LOGISTICA);
});

// ── Canonical urls ───────────────────────────────────────────────────────────

test("the default module reconciles to the bare dashboard url", () => {
  assert.equal(
    clinicModuleHref(BASE, OPERACIONES, OPERACIONES),
    "/dashboard",
    "Inicio already links to /dashboard; reconciliation must not invent ?module=operaciones",
  );
  assert.equal(clinicModuleHref(BASE, OPERACIONES, INFORMES), "/dashboard?module=informes");
  assert.equal(clinicModuleHref(BASE, OPERACIONES, LOGISTICA), "/dashboard?module=logistica");
});
