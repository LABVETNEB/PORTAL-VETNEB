"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

/**
 * C23 · non-keyboard dismissal shared by the two phone overlays of the shell:
 * the destination overflow of `DashboardMobileNav` and the action menu of
 * `DashboardMobileKebabMenu`. Escape and focus return stay in each owner.
 *
 * - Exclusive: opening one closes the other; both cover `main` from opposite bars.
 * - Light dismiss: a pointer press outside the overlay closes it without moving
 *   focus (the policy of the C08 menus).
 * - Regime: both exist only below 768px, so crossing that boundary closes them
 *   and the open state cannot reappear on the way back.
 *
 * "Outside" is the React tree, not the DOM: the owner spreads the returned
 * handler on its trigger and its panel, and React propagates pointer events
 * through portals, so a dialog the panel portals to `document.body` (the
 * Notificaciones panel of the kebab) stays inside. The press is judged on
 * `window` in the bubble phase, after React has dispatched it.
 *
 * @see docs/implementation/dashboard-c23-responsive-integral.md
 */
export const MOBILE_OVERLAY_OPEN_EVENT = "vetneb:dashboard-mobile-overlay-open";
const MOBILE_OVERLAY_REGIME = "(max-width: 767px)";

export function useMobileOverlayDismissal(
  overlayId: string,
  open: boolean,
  close: () => void,
): (event: ReactPointerEvent<HTMLElement>) => void {
  const insidePresses = useRef(new WeakSet<Event>());
  const markInsidePress = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    insidePresses.current.add(event.nativeEvent);
  }, []);

  useEffect(() => {
    if (!open) return;

    window.dispatchEvent(new CustomEvent<string>(MOBILE_OVERLAY_OPEN_EVENT, { detail: overlayId }));

    function closeOnOtherOverlay(event: Event) {
      if ((event as CustomEvent<string>).detail !== overlayId) close();
    }
    function closeOnOutsidePress(event: Event) {
      if (!insidePresses.current.has(event)) close();
    }
    const regime = window.matchMedia(MOBILE_OVERLAY_REGIME);
    function closeOutsideRegime() {
      if (!regime.matches) close();
    }

    window.addEventListener(MOBILE_OVERLAY_OPEN_EVENT, closeOnOtherOverlay);
    window.addEventListener("pointerdown", closeOnOutsidePress);
    regime.addEventListener("change", closeOutsideRegime);
    return () => {
      window.removeEventListener(MOBILE_OVERLAY_OPEN_EVENT, closeOnOtherOverlay);
      window.removeEventListener("pointerdown", closeOnOutsidePress);
      regime.removeEventListener("change", closeOutsideRegime);
    };
  }, [overlayId, open, close]);

  return markInsidePress;
}
