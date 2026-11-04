"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * V7 (F0 §65.4) · dashboard tooltip: #303030 / #f2f2f2, 12/400/16, letter-spacing .1px,
 * radius 4, padding 4 x 8, no shadow. It is a description, never the only carrier of
 * information: the host keeps its own accessible name and visible text.
 *
 * Ref-free on purpose. The trigger contract is a plain props bag spread on the control, so a
 * host whose control owns its `ref` (PublicRouteControl marks hydration through it) is not
 * overridden the way a Radix `asChild` slot would. The anchor is read from the event target.
 *
 * Opens on mouse/pen hover (after a short delay) and on keyboard focus (`:focus-visible`
 * only: a click or a touch never opens it). Closes on leave, blur, activation, scroll,
 * resize and Escape. The surface stays open while the pointer is over it (WCAG 1.4.13).
 * No transition at all, so `prefers-reduced-motion` has nothing to suppress.
 */

const HOVER_DELAY_MS = 300;
const LEAVE_GRACE_MS = 120;
const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 8;
const PORTAL_ROOT = '[data-dashboard-portal-root="true"]';

export type DashboardTooltipTriggerProps = {
  onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave: (event: PointerEvent<HTMLElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  onBlur: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  "aria-describedby": string | undefined;
};

export type DashboardTooltipProps = {
  /** Plain text of the tooltip. */
  label: string;
  /** Side of the trigger the tooltip prefers; it flips when there is no room. */
  side?: "right" | "bottom";
  children: (trigger: DashboardTooltipTriggerProps) => ReactNode;
};

function place(surface: HTMLElement, anchor: HTMLElement, side: "right" | "bottom") {
  const { width, height } = surface.getBoundingClientRect();
  const rect = anchor.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  let left: number;
  let top: number;
  if (side === "right") {
    left = rect.right + ANCHOR_GAP + width > viewportWidth - VIEWPORT_MARGIN ? rect.left - ANCHOR_GAP - width : rect.right + ANCHOR_GAP;
    top = rect.top + (rect.height - height) / 2;
  } else {
    left = rect.left + (rect.width - width) / 2;
    top = rect.bottom + ANCHOR_GAP + height > viewportHeight - VIEWPORT_MARGIN ? rect.top - ANCHOR_GAP - height : rect.bottom + ANCHOR_GAP;
  }
  surface.style.left = `${Math.round(Math.max(VIEWPORT_MARGIN, Math.min(left, viewportWidth - width - VIEWPORT_MARGIN)))}px`;
  surface.style.top = `${Math.round(Math.max(VIEWPORT_MARGIN, Math.min(top, viewportHeight - height - VIEWPORT_MARGIN)))}px`;
}

export function DashboardTooltip({ label, side = "right", children }: DashboardTooltipProps) {
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  /** A delayed open or close, resolved by the effect below so no handler reads a ref. */
  const [pending, setPending] = useState<{ element: HTMLElement | null; delay: number } | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const open = anchor !== null;

  const close = useCallback(() => {
    setPending(null);
    setAnchor(null);
  }, []);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      setAnchor(pending.element);
      setPending(null);
    }, pending.delay);
    return () => clearTimeout(timer);
  }, [pending]);

  useLayoutEffect(() => {
    if (anchor && surface.current) place(surface.current, anchor, side);
  }, [anchor, side]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open, close]);

  const trigger: DashboardTooltipTriggerProps = {
    onPointerEnter: (event) => {
      if (event.pointerType === "touch") return;
      setPending({ element: event.currentTarget, delay: HOVER_DELAY_MS });
    },
    onPointerLeave: (event) => {
      if (event.pointerType === "touch") return;
      setPending({ element: null, delay: LEAVE_GRACE_MS });
    },
    onPointerDown: close,
    onFocus: (event) => {
      if (event.currentTarget.matches(":focus-visible")) {
        setPending(null);
        setAnchor(event.currentTarget);
      }
    },
    onBlur: close,
    onKeyDown: (event) => {
      if (event.key === "Escape" && open) close();
    },
    "aria-describedby": open ? id : undefined,
  };

  return (
    <>
      {children(trigger)}
      {open
        ? createPortal(
            <div
              ref={surface}
              id={id}
              role="tooltip"
              data-dashboard-tooltip="true"
              className="pointer-events-auto fixed left-0 top-0 z-[60] max-w-[min(240px,calc(100vw-1rem))] break-words rounded-[4px] bg-[#303030] px-2 py-1 text-xs font-normal leading-4 tracking-[0.1px] text-[#f2f2f2] [box-shadow:none] outline outline-1 outline-transparent transition-none"
              onPointerEnter={() => setPending(null)}
              onPointerLeave={close}
            >
              {label}
            </div>,
            document.querySelector<HTMLElement>(PORTAL_ROOT) ?? document.body,
          )
        : null}
    </>
  );
}
