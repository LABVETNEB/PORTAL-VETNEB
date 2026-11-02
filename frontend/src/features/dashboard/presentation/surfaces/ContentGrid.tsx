import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";

// C24 · grid presentation of one collection page, next to the C01 list. Rows
// and columns are inputs (rows derive from the measured limit), so the grid
// never measures anything and never asks for a capacity of its own. Each row is
// `auto` (F0-D9(B)): a tile is as tall as its content needs, never stretched over the canvas.

/** `drive`: V5 tile geometry (16 px gap, 12 px radius, #f0f4f9 fill in light). Omitted: the geometry C24 froze. */
export type ContentGridTile = "drive";

export type ContentGridProps = ComponentPropsWithRef<"div"> & {
  columns: number;
  rows: number;
  tile?: ContentGridTile;
};

export function ContentGrid({ columns, rows, tile, className, style, ...props }: ContentGridProps) {
  return (
    <div
      {...props}
      className={cn("grid min-h-0 min-w-0 content-start", tile === "drive" ? "gap-[var(--dash-grid-gap)]" : "gap-2", className)}
      style={{
        ...style,
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, auto)`,
      }}
      data-content-grid="true"
    />
  );
}

export type ContentGridItemProps = { tile?: ContentGridTile } & (
  | ({ as: "article" } & ComponentPropsWithRef<"article">)
  | ({ as: "div" } & ComponentPropsWithRef<"div">)
);

const CONTENT_GRID_ITEM_CLASS =
  "flex min-h-0 min-w-0 flex-col overflow-hidden border border-vetneb-line/70 transition-colors hover:bg-vetneb-surface-muted/45 data-[state=selected]:bg-vetneb-teal/10";
const CONTENT_GRID_ITEM_SURFACE = {
  legacy: "rounded-lg bg-card/92",
  drive: "rounded-[var(--dash-grid-tile-radius)] bg-[var(--dash-grid-tile-fill)]",
} as const;

export function ContentGridItem({ as, tile, className, ...props }: ContentGridItemProps) {
  const merged = cn(CONTENT_GRID_ITEM_CLASS, CONTENT_GRID_ITEM_SURFACE[tile ?? "legacy"], className);
  switch (as) {
    case "article":
      return <article {...(props as ComponentPropsWithRef<"article">)} className={merged} data-content-grid-item="true" />;
    case "div":
      return <div {...(props as ComponentPropsWithRef<"div">)} className={merged} data-content-grid-item="true" />;
  }
}
