"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

export function OfflineActions() {
  const retry = () => {
    window.location.reload();
  };

  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
      <Button type="button" className="public-cta-primary w-full sm:w-auto" onClick={retry}>
        <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
        Reintentar conexión
      </Button>
      <Button asChild variant="outline" className="w-full sm:w-auto">
        <Link href={ROUTES.home}>Volver al inicio disponible</Link>
      </Button>
    </div>
  );
}
