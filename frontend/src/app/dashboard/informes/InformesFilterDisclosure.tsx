"use client";

import { useEffect, useRef, useState, type FocusEvent, type ReactNode } from "react";

import { ModuleDialog } from "@/components/dashboard/ModuleDialog";

// The trigger is lg-hidden and the inline fields are lg-only, so crossing the
// breakpoint can leave focus (or Radix's close-focus target) on a node with
// display:none. Each crossing hands focus to the control that replaces it.
const INLINE_FILTERS_REGIME = "(min-width: 1024px)";
const FOCUSABLE = "input, select, button, [href]";

export function InformesFilterDisclosure({
  title,
  description,
  trigger,
  inline,
  children,
}: {
  title: string;
  description: string;
  trigger: ReactNode;
  inline: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [focusInline, setFocusInline] = useState(false);
  const inlineRef = useRef<HTMLDivElement>(null);

  const focusTrigger = () => {
    const trigger = inlineRef.current?.previousElementSibling;
    if (trigger instanceof HTMLButtonElement) trigger.focus({ preventScroll: true });
  };

  useEffect(() => {
    const regime = window.matchMedia(INLINE_FILTERS_REGIME);
    const onRegimeChange = () => {
      const group = inlineRef.current;
      if (!group) return;
      if (regime.matches) {
        if (!open) return;
        setFocusInline(true);
        setOpen(false);
        return;
      }
      if (group.contains(document.activeElement)) focusTrigger();
    };
    regime.addEventListener("change", onRegimeChange);
    return () => regime.removeEventListener("change", onRegimeChange);
  }, [open]);

  // Runs after the close commits. Radix's close autofocus targets the hidden
  // trigger, which cannot take focus, so it leaves this one in place.
  useEffect(() => {
    if (open || !focusInline) return;
    setFocusInline(false);
    inlineRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
  }, [open, focusInline]);

  // Chrome's focus fixup can blur the hidden inline control before the regime
  // change is dispatched: a blur with no destination below lg means exactly that.
  const onInlineBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.relatedTarget === null && !window.matchMedia(INLINE_FILTERS_REGIME).matches) focusTrigger();
  };

  return (
    <>
      <ModuleDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        trigger={trigger}
      >
        {children}
      </ModuleDialog>
      <div ref={inlineRef} className="hidden lg:contents" onBlur={onInlineBlur}>
        {inline}
      </div>
    </>
  );
}
