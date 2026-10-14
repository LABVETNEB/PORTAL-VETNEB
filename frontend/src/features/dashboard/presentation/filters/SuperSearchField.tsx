"use client";

import { forwardRef, useId, useRef, type InputHTMLAttributes } from "react";
import { LoaderCircle, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SuperSearchFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "type" | "size" | "children"
> & {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  busy?: boolean;
  clearLabel?: string;
};

export const SuperSearchField = forwardRef<HTMLInputElement, SuperSearchFieldProps>(
  function SuperSearchField(
    { label, value, onValueChange, busy = false, disabled = false, clearLabel = "Limpiar búsqueda", className, id, inputMode = "search", enterKeyHint = "search", ...inputProps },
    forwardedRef,
  ) {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const inputRef = useRef<HTMLInputElement | null>(null);
    const unavailable = disabled || busy;

    return (
      <div
        data-super-search-field="true"
        className={cn("relative h-10 min-w-0 w-full max-w-[832px] md:w-[clamp(280px,44%,832px)]", className)}
      >
        <label htmlFor={inputId} className="sr-only">{label}</label>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          {...inputProps}
          id={inputId}
          ref={(node) => {
            inputRef.current = node;
            if (typeof forwardedRef === "function") forwardedRef(node);
            else if (forwardedRef) forwardedRef.current = node;
          }}
          type="text"
          role="searchbox"
          inputMode={inputMode}
          enterKeyHint={enterKeyHint}
          value={value}
          disabled={unavailable}
          aria-busy={busy || undefined}
          onChange={(event) => onValueChange(event.currentTarget.value)}
          className="h-10 w-full min-w-0 rounded-[20px] border border-transparent bg-muted py-0 pl-11 pr-12 text-sm text-foreground shadow-none outline-none placeholder:text-muted-foreground hover:border-border focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-55"
        />
        {busy ? (
          <LoaderCircle aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : value && !disabled ? (
          <button
            type="button"
            aria-label={clearLabel}
            onClick={() => {
              onValueChange("");
              inputRef.current?.focus();
            }}
            className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-primary md:size-10"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>
    );
  },
);
