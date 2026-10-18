import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

// C24 · grid presentation of one collection page, next to the C01 list. Rows
// and columns are inputs (rows derive from the measured limit), so the grid
// never measures anything and never asks for a capacity of its own.

export type ContentGridProps = ComponentPropsWithRef<"div"> & {
  columns: number;
  rows: number;
};

export function ContentGrid({ columns, rows, className, style, ...props }: ContentGridProps) {
  return (
    <div
      {...props}
      className={cn("grid min-h-0 min-w-0 gap-2", className)}
      style={{
        ...style,
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
      data-content-grid="true"
    />
  );
}

export type ContentGridItemProps =
  | ({ as: "article" } & ComponentPropsWithRef<"article">)
  | ({ as: "div" } & ComponentPropsWithRef<"div">);

const CONTENT_GRID_ITEM_CLASS =
  "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-vetneb-line/70 bg-card/92 transition-colors hover:bg-vetneb-surface-muted/45 data-[state=selected]:bg-vetneb-teal/10";

export function ContentGridItem({ as, className, ...props }: ContentGridItemProps) {
  const merged = cn(CONTENT_GRID_ITEM_CLASS, className);
  switch (as) {
    case "article":
      return <article {...(props as ComponentPropsWithRef<"article">)} className={merged} data-content-grid-item="true" />;
    case "div":
      return <div {...(props as ComponentPropsWithRef<"div">)} className={merged} data-content-grid-item="true" />;
  }
}
