"use client";

import { LogIn, ShieldAlert } from "lucide-react";

import { PublicRouteControl } from "@/components/public/PublicRouteControl";
import {
  getAdminAccessErrorState,
  type AdminAccessErrorStatus,
} from "@/lib/api-error";
import { ROUTES } from "@/lib/routes";

type AdminAccessErrorStateProps = {
  status: AdminAccessErrorStatus;
};

export function AdminAccessErrorState({
  status,
}: AdminAccessErrorStateProps) {
  const state = getAdminAccessErrorState(status);

  if (!state) {
    return null;
  }

  return (
    <section
      role="alert"
      aria-labelledby="admin-access-error-title"
      className="dashboard-surface flex min-h-48 flex-1 flex-col items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/8 px-5 py-8 text-center"
    >
      <div
        className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-amber-500/25 bg-card text-amber-700"
        aria-hidden="true"
      >
        <ShieldAlert className="h-5 w-5" />
      </div>
      <h2
        id="admin-access-error-title"
        className="text-base font-semibold text-vetneb-ink"
      >
        {state.title}
      </h2>
      <p className="mt-1 max-w-lg text-sm text-muted-foreground">
        {state.message}
      </p>
      {state.supportText ? (
        <p className="mt-1 max-w-lg text-xs text-muted-foreground">
          {state.supportText}
        </p>
      ) : null}
      {state.status === 401 ? (
        <PublicRouteControl
          href={ROUTES.login}
          variant="primaryDark"
          className="mt-4 h-9 w-auto px-4 text-sm"
          icon={<LogIn className="h-4 w-4" aria-hidden="true" />}
        >
          Volver a iniciar sesión
        </PublicRouteControl>
      ) : null}
    </section>
  );
}
