import * as React from "react";
import { cn } from "@/lib/utils";

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto rounded-lg border border-vetneb-line/75 bg-card/92 shadow-[0_10px_30px_rgba(15,45,62,0.06)]">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("[&_tr]:border-b [&_tr]:border-vetneb-line/65 [&_tr]:bg-vetneb-surface-muted/65", className)}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t border-vetneb-line/65 bg-muted/45 font-medium [&>tr]:last:border-b-0",
      className,
    )}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-vetneb-line/60 transition-colors hover:bg-vetneb-surface-muted/45 data-[state=selected]:bg-vetneb-teal/10",
      className,
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-3.5 align-middle text-foreground/88 [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

// C01 · collection primitives. Structure and semantics only: data, fetch,
// paging, sorting and selection stay with the consumer.

const CollectionWorkspace = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("dashboard-collection-workspace", className)}
    {...props}
    data-collection-workspace="true"
  />
));
CollectionWorkspace.displayName = "CollectionWorkspace";

const CollectionHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <TableHeader
    ref={ref}
    className={cn("dashboard-collection-header", className)}
    {...props}
    data-collection-header="true"
  />
));
CollectionHeader.displayName = "CollectionHeader";

type ContentListProps =
  | ({ as: "tbody" } & React.ComponentPropsWithRef<"tbody">)
  | ({ as: "ul" } & React.ComponentPropsWithRef<"ul">)
  | ({ as: "ol" } & React.ComponentPropsWithRef<"ol">)
  | ({ as: "div" } & React.ComponentPropsWithRef<"div">);

function ContentList({ as, ...props }: ContentListProps) {
  switch (as) {
    case "tbody":
      return <TableBody {...(props as React.ComponentPropsWithRef<"tbody">)} data-content-list="true" />;
    case "ul":
      return <ul {...(props as React.ComponentPropsWithRef<"ul">)} data-content-list="true" />;
    case "ol":
      return <ol {...(props as React.ComponentPropsWithRef<"ol">)} data-content-list="true" />;
    case "div":
      return <div {...(props as React.ComponentPropsWithRef<"div">)} data-content-list="true" />;
  }
}

type ContentListItemProps =
  | ({ as: "tr" } & React.ComponentPropsWithRef<"tr">)
  | ({ as: "li" } & React.ComponentPropsWithRef<"li">)
  | ({ as: "article" } & React.ComponentPropsWithRef<"article">)
  | ({ as: "div" } & React.ComponentPropsWithRef<"div">);

function ContentListItem({ as, ...props }: ContentListItemProps) {
  switch (as) {
    case "tr":
      return <TableRow {...(props as React.ComponentPropsWithRef<"tr">)} data-content-list-item="true" />;
    case "li":
      return <li {...(props as React.ComponentPropsWithRef<"li">)} data-content-list-item="true" />;
    case "article":
      return <article {...(props as React.ComponentPropsWithRef<"article">)} data-content-list-item="true" />;
    case "div":
      return <div {...(props as React.ComponentPropsWithRef<"div">)} data-content-list-item="true" />;
  }
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  CollectionWorkspace,
  CollectionHeader,
  ContentList,
  ContentListItem,
  type ContentListProps,
  type ContentListItemProps,
};
