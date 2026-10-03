import {
  CollectionState,
  type CollectionStateSkeleton,
  type CollectionStateLoadingProps,
} from "@/components/dashboard/EmptyState";

export type LoadingStateProps = Omit<CollectionStateLoadingProps, "skeleton"> & {
  variant?: CollectionStateSkeleton;
};

export function LoadingState({ variant, ...props }: LoadingStateProps) {
  return <CollectionState {...props} variant="loading" skeleton={variant} />;
}
