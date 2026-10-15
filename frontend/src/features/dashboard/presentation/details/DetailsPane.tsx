import type { ReactNode } from "react";

export type DetailsPaneProps = {
  label: string;
  children: ReactNode;
  busy?: boolean;
};

// C13: content composition only. Width, collapse and scroll stay owned by the B16 side panel.
export function DetailsPane({ label, children, busy = false }: DetailsPaneProps) {
  return (
    <section data-details-pane="true" aria-label={label} aria-busy={busy || undefined} className="flex min-w-0 flex-col gap-3">
      {children}
    </section>
  );
}
