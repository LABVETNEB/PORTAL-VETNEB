"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";
import { PublicRouteControl } from "@/components/public/PublicRouteControl";

/**
 * "Abrir módulo completo": leaves the clinic module shell for a full route,
 * another page whose server render can take seconds. A plain push left the
 * control unchanged for that whole wait, so the click looked ignored. The push
 * runs inside a transition, and the control shows its pending state until the
 * full route commits.
 */
export function FullModuleRouteControl({
  href,
  ariaLabel,
}: {
  readonly href: string;
  readonly ariaLabel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <PublicRouteControl
      href={href}
      variant="bare"
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-vetneb-teal/45 bg-vetneb-teal/10 px-2.5 text-xs font-semibold text-vetneb-teal transition-colors hover:bg-vetneb-teal/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 aria-busy:cursor-wait"
      aria-label={ariaLabel}
      aria-busy={isPending || undefined}
      onClick={(event) => {
        event.preventDefault();
        if (isPending) return;
        startTransition(() => router.push(href));
      }}
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {isPending ? "Abriendo módulo…" : "Abrir módulo completo"}
    </PublicRouteControl>
  );
}
