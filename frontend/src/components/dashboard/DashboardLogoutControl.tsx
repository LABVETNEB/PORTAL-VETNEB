"use client";

import {
  useCallback,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";

import { logout as logoutClinic, logoutAdmin } from "@/lib/api";
import { clearDashboardLastModules } from "@/lib/dashboard-last-module";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

type DashboardLogoutControlProps = {
  surface: "admin" | "clinic";
  children: ReactNode;
  className?: string;
} & Omit<
  ComponentPropsWithoutRef<"button">,
  "type" | "children" | "className" | "onClick"
>;

// Real logout control for the private dashboard. Unlike a plain navigation to
// /login, this invalidates the server session (clearing the httpOnly session
// cookie) before leaving the authenticated surface, so Back + reload cannot
// re-render private data.
export function DashboardLogoutControl({
  surface,
  children,
  className,
  disabled,
  ...props
}: DashboardLogoutControlProps) {
  const [isPending, setIsPending] = useState(false);

  const handleLogout = useCallback(async () => {
    if (isPending) {
      return;
    }
    setIsPending(true);

    // Drop local UI state first so nothing private survives the redirect.
    clearDashboardLastModules();

    try {
      if (surface === "admin") {
        await logoutAdmin();
      } else {
        await logoutClinic();
      }
    } catch {
      // A transport failure must not strand the user on a private surface. The
      // hard redirect below still unloads the rendered private tree; the proxy
      // re-checks the session cookie on the next request to /dashboard.
    }

    // Hard navigation (not router.push): unloads the authenticated SPA, discards
    // in-memory private state and replaces the current history entry. Combined
    // with the no-store headers on /dashboard, Back + reload reach the proxy and
    // are redirected to /login once the session cookie is gone.
    window.location.replace(ROUTES.login);
  }, [isPending, surface]);

  return (
    <button
      type="button"
      disabled={disabled || isPending}
      aria-busy={isPending || undefined}
      onClick={() => {
        void handleLogout();
      }}
      className={cn(
        "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
