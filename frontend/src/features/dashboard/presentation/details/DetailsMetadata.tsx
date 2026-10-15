import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DetailsMetadataItem = {
  id: string;
  label: string;
  value: ReactNode;
  mono?: boolean;
};

export type DetailsMetadataProps = {
  items: readonly DetailsMetadataItem[];
  missingLabel?: string;
};

const isMissing = (value: ReactNode) => value === null || value === undefined || value === false || value === "";

export function DetailsMetadata({ items, missingLabel = "Sin dato" }: DetailsMetadataProps) {
  if (!items.length) return null;
  return (
    <dl data-details-metadata="true" className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-3 text-[13px] leading-5">
      {items.map((item) => {
        const missing = isMissing(item.value);
        return (
          <div key={item.id} data-details-metadata-item={item.id} className="min-w-0">
            <dt className="text-[11px] font-medium leading-4 text-muted-foreground">{item.label}</dt>
            <dd
              data-details-metadata-missing={missing || undefined}
              className={cn("dashboard-detail-value mt-0.5", missing ? "text-muted-foreground" : "text-vetneb-ink", item.mono && !missing && "font-mono text-xs")}
            >
              {missing ? (
                <>
                  <span aria-hidden="true">—</span>
                  <span className="sr-only">{missingLabel}</span>
                </>
              ) : item.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
