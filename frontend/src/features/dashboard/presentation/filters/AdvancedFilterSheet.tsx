"use client";

import { useId, useRef, type ReactNode, type RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

type Action = { label: string; disabled?: boolean };

export type AdvancedFilterSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
  closeLabel?: string;
  actions?: {
    apply?: Action & { onApply: () => void };
    clear?: Action & { onClear: () => void };
    cancel?: Action & { onCancel: () => void };
  };
};

const focusable = 'input:not([type="hidden"]), select, textarea, button, [tabindex]';

function canReceiveFocus(element: HTMLElement, dialog: HTMLElement): boolean {
  if (!dialog.contains(element) || !element.isConnected || element.tabIndex < 0 || element.matches(":disabled")) return false;
  if (element.closest('[hidden], [inert], [aria-hidden="true"]') || element.getClientRects().length === 0) return false;
  for (let node: HTMLElement | null = element; node && dialog.contains(node); node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.visibility !== "visible" || style.display === "none" || style.opacity === "0") return false;
  }
  return true;
}

function firstFocusable(body: HTMLElement | null, dialog: HTMLElement): HTMLElement | undefined {
  const candidates = [...(body?.querySelectorAll<HTMLElement>(focusable) ?? [])]
    .filter((element) => canReceiveFocus(element, dialog));
  candidates.sort((a, b) => {
    const first = a.tabIndex > 0 ? a.tabIndex : Infinity;
    const second = b.tabIndex > 0 ? b.tabIndex : Infinity;
    return first - second;
  });
  return candidates[0];
}

export function AdvancedFilterSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  initialFocusRef,
  returnFocusRef,
  fallbackFocusRef,
  closeLabel = "Cerrar filtros avanzados",
  actions,
}: AdvancedFilterSheetProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-vetneb-ink/30 backdrop-blur-[1px]" />
        <Dialog.Content
          ref={dialogRef}
          data-advanced-filter-sheet="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[calc(100dvh-env(safe-area-inset-top))] min-w-0 flex-col overflow-hidden rounded-t-2xl border border-vetneb-line bg-card text-vetneb-ink shadow-xl outline-none md:bottom-auto md:left-1/2 md:top-1/2 md:w-[min(34rem,calc(100vw-2rem))] md:max-h-[88dvh] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl"
          onOpenAutoFocus={(event) => {
            openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            const dialog = dialogRef.current;
            if (!dialog) return;
            const target = initialFocusRef?.current && canReceiveFocus(initialFocusRef.current, dialog)
              ? initialFocusRef.current
              : firstFocusable(bodyRef.current, dialog) ?? closeRef.current;
            if (target) {
              target.focus({ preventScroll: true });
              if (document.activeElement === target) event.preventDefault();
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = [returnFocusRef?.current, fallbackFocusRef?.current, openerRef.current]
              .find((element) => element?.isConnected && element !== document.body && element.getClientRects().length > 0 && !element.matches(":disabled"));
            target?.focus({ preventScroll: true });
          }}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-vetneb-line px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title id={titleId} className="break-words text-base font-semibold">{title}</Dialog.Title>
              {description ? <Dialog.Description id={descriptionId} className="mt-1 break-words text-sm text-muted-foreground">{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close asChild>
              <button ref={closeRef} type="button" aria-label={closeLabel} className="flex size-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-primary">
                <X aria-hidden="true" className="size-5" />
              </button>
            </Dialog.Close>
          </div>
          <div ref={bodyRef} data-advanced-filter-body="true" className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4">
            {children}
          </div>
          {actions && (actions.clear || actions.cancel || actions.apply) ? (
            <div data-advanced-filter-actions="true" className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-vetneb-line px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              {actions.clear ? <button type="button" disabled={actions.clear.disabled} onClick={actions.clear.onClear} className="min-h-11 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-primary">{actions.clear.label}</button> : null}
              {actions.cancel ? <button type="button" disabled={actions.cancel.disabled} onClick={actions.cancel.onCancel} className="min-h-11 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-primary">{actions.cancel.label}</button> : null}
              {actions.apply ? <button type="button" disabled={actions.apply.disabled} onClick={actions.apply.onApply} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-primary">{actions.apply.label}</button> : null}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
