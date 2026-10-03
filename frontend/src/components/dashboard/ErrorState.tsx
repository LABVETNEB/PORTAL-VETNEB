"use client";

import {
  CollectionState,
  type CollectionStateErrorProps,
} from "@/components/dashboard/EmptyState";

export type ErrorStateProps = CollectionStateErrorProps;

export function ErrorState(props: ErrorStateProps) {
  return <CollectionState {...props} variant="error" />;
}
