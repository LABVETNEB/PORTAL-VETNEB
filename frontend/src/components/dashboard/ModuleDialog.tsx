"use client";

import { useId, useLayoutEffect, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ModuleDialogProps = {
  /** Controlled open state. Omit (with a `trigger`) for an uncontrolled dialog. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  /** Optional trigger; when omitted the dialog is controlled externally. */
  trigger?: ReactNode;
  children: ReactNode;
  /** Footer actions row (submit/cancel). Kept visible without scroll. */
  footer?: ReactNode;
  /** Prevents closing via overlay/escape while a mutation is in flight. */
  busy?: boolean;
  closeLabel?: string;
  /**
   * PR-TRUNC follow-up. Opt-in local scroll owner for the body, scoped to
   * this dialog instance only. Off by default: the panel stays the original
   * compact/step-based contract (capped to the viewport, no internal
   * scroller) so short forms and confirmations are byte-identical to before.
   * Set only by long-form DETAIL/DIALOG/INSPECTOR consumers whose content can
   * genuinely exceed `max-h-[88vh]` — the body becomes their single reachable
   * scroll owner instead of letting `.clinical-modal`'s `overflow-hidden`
   * clip it. A consumer that already owns its own internal scroll region
   * (e.g. the informes master-detail canvas) must NOT set this: it would
   * compete with that region instead of letting it size correctly.
   */
  scrollableBody?: boolean;
  /**
   * B05: mount the Radix portal under `[data-dashboard-portal-root="true"]`
   * (a dedicated, always-empty child of `.dashboard-app-shell`) instead of
   * `document.body`, so CSS custom properties declared on `.dashboard-app-shell`
   * — `--dash-color-field` in particular — resolve inside this dialog's
   * portalled content. Off by default: every other `ModuleDialog` keeps
   * portalling to `document.body` unchanged. Only the shared mobile filter
   * dialogs (S1/S2/S3/S6/S7) set this.
   */
  dashboardScopedPortal?: boolean;
};

/**
 * Compact, centered dialog for App Shell forms and confirmations. Content is
 * meant to be short or step-based; the panel is capped to the viewport and
 * does not scroll internally by default.
 *
 * Scroll ownership. The panel is `max-h-[88vh]` and `.clinical-modal` is
 * `overflow-hidden`, so a body taller than that remainder is CLIPPED with no
 * way to reach the hidden part unless something scrolls it — the dialog is
 * the terminal surface for a datum, so that clipping is silent data loss
 * (measured on the admin/clinic token detail at 360x800: the panel reported
 * scrollWidth 364 vs clientWidth 326). A GLOBAL scroller on every instance
 * would fix that but breaks the original compact/step-based contract for
 * short forms and can bury a consumer's own critical actions or internal
 * scroll region under a second, redundant one. So the body is a flex column
 * (letting a consumer's child stretch to its full height when it needs to)
 * and only becomes a scroll owner when `scrollableBody` opts in, per
 * instance. Header and footer always stay outside it and remain visible
 * without scrolling.
 */
export function ModuleDialog({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  children,
  footer,
  busy = false,
  closeLabel = "Cerrar",
  dashboardScopedPortal = false,
  scrollableBody = false,
}: ModuleDialogProps) {
  const titleId = useId();
  const descId = useId();

  // Resolved before paint so the very first portalled frame already targets
  // the dashboard shell — there is exactly one `[data-dashboard-portal-root]`
  // per page, rendered unconditionally by `DashboardShellRouter` ahead of
  // every dashboard route, so it already exists by the time any dialog can
  // open. `null` here is not an error state: Radix's own `Portal` treats a
  // falsy `container` as "use the default", so this only ever WIDENS where
  // the portal can land, never narrows it to nothing.
  const [scopedPortalContainer, setScopedPortalContainer] =
    useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!dashboardScopedPortal) {
      setScopedPortalContainer(null);
      return;
    }
    setScopedPortalContainer(
      document.querySelector<HTMLElement>('[data-dashboard-portal-root="true"]'),
    );
  }, [dashboardScopedPortal]);

  return (
    <Dialog.Root
      {...(open !== undefined ? { open } : {})}
      onOpenChange={(next) => {
        if (!next && busy) return;
        onOpenChange?.(next);
      }}
    >
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal
        container={dashboardScopedPortal ? scopedPortalContainer : undefined}
      >
        <Dialog.Overlay className="fixed inset-0 z-40 bg-vetneb-ink/30 backdrop-blur-[1px] duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          data-module-dialog="true"
          className="clinical-modal fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col duration-200 focus:outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          onInteractOutside={(event) => {
            if (busy) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-vetneb-line/70 px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title
                id={titleId}
                className="break-words text-base font-semibold text-vetneb-ink"
              >
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description
                  id={descId}
                  className="mt-0.5 break-words text-xs text-muted-foreground"
                >
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={busy}
                aria-label={closeLabel}
              >
                <X aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>

          <div
            data-module-dialog-body="true"
            className={`flex min-h-0 flex-1 flex-col px-5 py-4 ${
              scrollableBody ? "overflow-y-auto overscroll-contain" : ""
            }`}
          >
            {children}
          </div>

          {footer ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-vetneb-line/70 px-5 py-3">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
