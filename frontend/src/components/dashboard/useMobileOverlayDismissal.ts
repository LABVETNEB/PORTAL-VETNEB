"use client";

import { useEffect, type RefObject } from "react";

/**
 * C23 · non-keyboard dismissal shared by the two phone overlays of the shell:
 * the destination overflow of `DashboardMobileNav` and the action menu of
 * `DashboardMobileKebabMenu`. Escape and focus return stay in each owner.
 *
 * - Exclusive: opening one closes the other; both cover `main` from opposite bars.
 * - Light dismiss: a pointer press outside the trigger and the panel closes it
 *   without moving focus (the policy of the C08 menus).
 * - Regime: both exist only below 768px, so crossing that boundary closes them
 *   and the open state cannot reappear on the way back.
 *
 * @see docs/implementation/dashboard-c23-responsive-integral.md
 */
export const MOBILE_OVERLAY_OPEN_EVENT = "vetneb:dashboard-mobile-overlay-open";
const MOBILE_OVERLAY_REGIME = "(max-width: 767px)";

export function useMobileOverlayDismissal(
  overlayId: string,
  open: boolean,
  close: () => void,
  triggerRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!open) return;

    window.dispatchEvent(new CustomEvent<string>(MOBILE_OVERLAY_OPEN_EVENT, { detail: overlayId }));

    function closeOnOtherOverlay(event: Event) {
      if ((event as CustomEvent<string>).detail !== overlayId) close();
    }
    function closeOnOutsidePress(event: Event) {
      const target = event.target instanceof Node ? event.target : null;
      if (target && (triggerRef.current?.contains(target) || panelRef.current?.contains(target))) return;
      close();
    }
    const regime = window.matchMedia(MOBILE_OVERLAY_REGIME);
    function closeOutsideRegime() {
      if (!regime.matches) close();
    }

    window.addEventListener(MOBILE_OVERLAY_OPEN_EVENT, closeOnOtherOverlay);
    document.addEventListener("pointerdown", closeOnOutsidePress, true);
    regime.addEventListener("change", closeOutsideRegime);
    return () => {
      window.removeEventListener(MOBILE_OVERLAY_OPEN_EVENT, closeOnOtherOverlay);
      document.removeEventListener("pointerdown", closeOnOutsidePress, true);
      regime.removeEventListener("change", closeOutsideRegime);
    };
  }, [overlayId, open, close, triggerRef, panelRef]);
}
