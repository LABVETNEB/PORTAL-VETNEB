"use client";

import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type DashboardRefreshButtonProps = {
  label?: string;
  className?: string;
};

export function DashboardRefreshButton({
  label = "Reintentar",
  className,
}: DashboardRefreshButtonProps) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => router.refresh()}
      className={className}
    >
      <RefreshCw className="h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
