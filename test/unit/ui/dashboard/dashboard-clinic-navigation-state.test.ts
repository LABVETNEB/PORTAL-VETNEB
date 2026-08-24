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
  // Deep link and Back/Forward arrive here. The last-module restore no longer
  // does: it records its intent first, which is exactly what stopped it from
  // being classified — and obeyed — as an external navigation. See the restore
  // section below.
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

// ── The last-module restore (B09 · P2) ───────────────────────────────────────
//
// `ClinicDashboardWorkspaceController` resumes the last visited module on a
// bare `/dashboard` entry. That restore is a navigation like any other, but it
// used to be issued outside both rules of this module: it hand-built its url
// and it recorded no intent.
//
// Recording no intent is the defect. The restore fires on MOUNT, so its
// `replace` is in flight exactly while the shell becomes interactive and the
// first tap can happen. If the tap's own commit lands first it consumes its
// intent, leaving nothing pending — and the restore's late commit is then read
// as an EXTERNAL navigation (deep link, Back/Forward) and obeyed, reopening the
// module the user had just left. Same race as above, one navigation earlier.

test("restore · PRE-FIX, an unrecorded restore is read as external and wins", () => {
  let state = initial(OPERACIONES);

  // The tap the user makes while the mount-time restore is still in flight.
  state = recordClinicNavigationIntent(state, INFORMES);
  const tap = applyClinicUrlCommit(state, INFORMES);
  assert.equal(tap.activeModule, INFORMES, "the tap lands and consumes its intent");
  assert.equal(tap.state.pendingIntent, null);

  // PRE-FIX the restore contributed no intent, so its late commit arrives with
  // nothing left to classify it as superseded.
  const late = applyClinicUrlCommit(tap.state, OPERACIONES);
  assert.equal(
    late.activeModule,
    OPERACIONES,
    "PRE-FIX: the restore reopens the module the tap had just left",
  );
  assert.equal(late.reconcileTo, null, "PRE-FIX: and nothing re-asserts the tap's url");
});

// A · the restore arms its intent before the url it asks for can commit.
test("restore · a non-default last module arms an intent before its url commits", () => {
  const state = initial(OPERACIONES);
  const restored = recordClinicNavigationIntent(state, INFORMES);

  assert.deepEqual(
    restored.pendingIntent,
    { target: INFORMES },
    "the restore is guarded from the moment it is issued, not once it lands",
  );
  assert.equal(
    restored.confirmedUrlModule,
    OPERACIONES,
    "the url has not committed yet: the bare /dashboard entry still holds",
  );
  assert.equal(
    clinicModuleHref(BASE, OPERACIONES, INFORMES),
    "/dashboard?module=informes",
    "and the url it asks for comes from the shared authority",
  );
});

// B · restoring the default module resolves to the bare `/dashboard`.
test("restore · the default module restores to /dashboard, never ?module=operaciones", () => {
  const href = clinicModuleHref(BASE, OPERACIONES, OPERACIONES);

  assert.equal(href, "/dashboard");
  assert.equal(
    href.includes("module="),
    false,
    "a second spelling of the default surface is what the hand-built url introduced",
  );

  // Restoring the default onto a bare entry asks for the url that is already
  // showing, which is the one genuine no-op: nothing is in flight to guard.
  const state = initial(OPERACIONES);
  assert.equal(recordClinicNavigationIntent(state, OPERACIONES), state);
});

// C · an explicit tap supersedes a restore that has not landed.
test("restore · an explicit tap supersedes a restore still in flight", () => {
  let state = initial(OPERACIONES);

  state = recordClinicNavigationIntent(state, INFORMES); // mount-time restore
  state = recordClinicNavigationIntent(state, LOGISTICA); // the user taps

  assert.deepEqual(
    state.pendingIntent,
    { target: LOGISTICA },
    "the newest intention wins: a restore is not privileged over a tap",
  );
});

// D + E · the restore's stale commit is reconciled, and the winning commit
// consumes the intent without a second replace.
test("restore · the restore's late commit is reconciled to the tap, then converges", () => {
  let state = initial(OPERACIONES);
  state = recordClinicNavigationIntent(state, INFORMES);
  state = recordClinicNavigationIntent(state, LOGISTICA);

  // D
  const stale = applyClinicUrlCommit(state, INFORMES);
  assert.equal(
    stale.activeModule,
    null,
    "the workspace keeps the tapped module: the restore lost",
  );
  assert.equal(
    stale.reconcileTo,
    LOGISTICA,
    "and the url is re-asserted so aria-current follows the tap, not the restore",
  );
  assert.deepEqual(stale.state.pendingIntent, { target: LOGISTICA });

  // E
  const settled = applyClinicUrlCommit(stale.state, LOGISTICA);
  assert.equal(settled.activeModule, LOGISTICA);
  assert.equal(settled.reconcileTo, null, "one replace per intention, and no loop");
  assert.equal(settled.state.pendingIntent, null);
  assert.equal(settled.state.confirmedUrlModule, LOGISTICA);
});
