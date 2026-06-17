"use client";

import { useId, type ReactNode } from "react";
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
};

/**
 * Compact, centered dialog for App Shell forms and confirmations. Content is
 * meant to be short or step-based; the panel is capped to the viewport and does
 * not introduce internal scroll on desktop (forms are split into steps/dialogs
 * rather than scrolled).
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
}: ModuleDialogProps) {
  const titleId = useId();
  const descId = useId();

  return (
    <Dialog.Root
      {...(open !== undefined ? { open } : {})}
      onOpenChange={(next) => {
        if (!next && busy) return;
        onOpenChange?.(next);
      }}
    >
      {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : null}
      <Dialog.Portal>
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
                className="text-base font-semibold text-vetneb-ink"
              >
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description
                  id={descId}
                  className="mt-0.5 text-xs text-muted-foreground"
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

          <div className="min-h-0 flex-1 px-5 py-4">{children}</div>

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
