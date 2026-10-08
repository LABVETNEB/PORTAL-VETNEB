/**
 * The module the dashboard stage is showing, published by the stage's owner.
 *
 * Only the stage owner (the workspace controller on `/dashboard` and
 * `/dashboard/admin`, a clinic full route while it hands over) classifies every
 * URL commit: the late commit of a superseded navigation, a Back/Forward
 * traversal, a restore, a hub reset. The navigation chrome used to re-derive its
 * current item from the URL plus a private copy of the pending activation, and
 * that copy classified nothing. In Next 16 a `?module=` navigate action
 * completes before the server answers, so the router queue never discards a
 * superseded push and its payload can commit ahead of the latest one: the band
 * and the bar followed that commit back to the module the user had left while
 * the stage kept the new one, for as long as the latest server render took.
 *
 * The chrome now renders what the owner resolved, so the current item and the
 * stage cannot disagree. With no owner mounted (server render, a full route
 * that is not leaving) the snapshot is `undefined` and the chrome reads the URL.
 * `null` is a stage without a module: the admin landing before it resolves, or
 * the clinic hub.
 *
 * NO IMPORTS, no DOM: module ids are plain strings, so this file is directly
 * testable from `test/unit/ui`.
 *
 * @see test/unit/ui/dashboard/frontend-dashboard-lateral-navigation.test.ts
 */

export type StageSurface = "admin" | "clinic";

/** `undefined`: no owner mounted. `null`: the owner shows no module. */
export type StageModuleSnapshot = string | null | undefined;

type StageClaim = { readonly value: string | null };

const claims: Record<StageSurface, StageClaim[]> = { admin: [], clinic: [] };
const listeners: Record<StageSurface, Set<() => void>> = {
  admin: new Set(),
  clinic: new Set(),
};

function notify(surface: StageSurface) {
  listeners[surface].forEach((listener) => listener());
}

/**
 * Publish `value` as the stage module of `surface` until the returned release
 * runs. The latest claim wins, so an owner that mounts while another is still
 * releasing never reads as "no owner".
 */
export function publishStageModule(
  surface: StageSurface,
  value: string | null,
): () => void {
  const claim: StageClaim = { value };
  claims[surface].push(claim);
  notify(surface);
  return () => {
    const index = claims[surface].indexOf(claim);
    if (index === -1) return;
    claims[surface].splice(index, 1);
    notify(surface);
  };
}

export function getStageModuleSnapshot(surface: StageSurface): StageModuleSnapshot {
  const stack = claims[surface];
  return stack.length === 0 ? undefined : stack[stack.length - 1].value;
}

export function subscribeStageModule(
  surface: StageSurface,
  listener: () => void,
): () => void {
  listeners[surface].add(listener);
  return () => {
    listeners[surface].delete(listener);
  };
}
