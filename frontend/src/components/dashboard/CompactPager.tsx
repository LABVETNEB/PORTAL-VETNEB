"use client";

import {
  CollectionPager,
  type CollectionPagerCompactProps,
} from "@/components/dashboard/DashboardPager";

export type CompactPagerProps = Omit<CollectionPagerCompactProps, "variant"> &
  Required<
    Pick<
      CollectionPagerCompactProps,
      "page" | "pageCount" | "hasPrev" | "hasNext" | "onPrev" | "onNext"
    >
  >;

/** Legacy name of the compact variant (C02 compatibility adapter). */
export function CompactPager(props: CompactPagerProps) {
  return <CollectionPager {...props} variant="compact" />;
}
