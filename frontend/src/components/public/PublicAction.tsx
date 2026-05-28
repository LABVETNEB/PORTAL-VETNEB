import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  PublicExternalControl,
  PublicRouteControl,
} from "@/components/public/PublicRouteControl";

export type PublicActionVariant =
  | "primaryLight"
  | "primaryDark"
  | "secondaryOutline"
  | "textLink"
  | "contactCard";

type PublicActionProps = {
  href: string;
  children: ReactNode;
  variant?: PublicActionVariant;
  className?: string;
  icon?: ReactNode;
  external?: boolean;
  replace?: boolean;
  prefetch?: boolean;
} & Omit<ComponentPropsWithoutRef<"button">, "type" | "children" | "className">;

const actionClasses: Record<
  Exclude<PublicActionVariant, "textLink" | "contactCard">,
  string
> = {
  primaryLight:
    "w-full border-vetneb-line/90 bg-card/95 px-7 font-semibold text-vetneb-navy shadow-sm hover:border-vetneb-teal/45 hover:bg-vetneb-surface-raised hover:text-vetneb-navy sm:w-auto",
  primaryDark:
    "w-full clinical-primary-gradient clinical-primary-gradient-hover px-7 font-semibold text-primary-foreground shadow-[0_14px_35px_hsl(var(--vetneb-navy)/0.22)] sm:w-auto",
  secondaryOutline:
    "w-full border border-white/60 bg-white/10 px-7 font-semibold text-vetneb-navy shadow-sm hover:bg-white/16 hover:text-vetneb-navy active:text-vetneb-navy focus-visible:text-vetneb-navy sm:w-auto",
};

export function PublicAction({
  href,
  children,
  variant = "primaryLight",
  className,
  icon,
  external = false,
  replace = false,
  prefetch = true,
  ...props
}: PublicActionProps) {
  if (variant === "textLink") {
    if (external) {
      return (
        <PublicExternalControl
          href={href}
          className={cn(
            "inline-flex items-center gap-2 text-sm font-semibold text-vetneb-navy underline-offset-4 transition hover:text-vetneb-teal hover:underline",
            className,
          )}
          {...props}
        >
          <span>{children}</span>
          {icon}
        </PublicExternalControl>
      );
    }

    return (
      <PublicRouteControl
        href={href}
        variant="textLink"
        replace={replace}
        prefetch={prefetch}
        className={className}
        icon={icon}
        {...props}
      >
        {children}
      </PublicRouteControl>
    );
  }

  if (variant === "contactCard") {
    return (
      <div
        className={cn(
          "group flex items-center justify-between gap-4 rounded-lg border border-vetneb-line/85 bg-card/95 px-4 py-3 shadow-sm transition hover:border-vetneb-teal/45 hover:bg-vetneb-surface-raised",
          className,
        )}
      >
        <span className="text-sm font-semibold text-vetneb-navy">{children}</span>
        {external ? (
          <PublicExternalControl
            href={href}
            className="inline-flex shrink-0 text-vetneb-teal transition group-hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            {...props}
          >
            <span className="sr-only">
              {typeof children === "string" ? children : "Ver"}
            </span>
            {icon ? <span aria-hidden="true">{icon}</span> : null}
          </PublicExternalControl>
        ) : (
          <PublicRouteControl
            href={href}
            variant="bare"
            replace={replace}
            prefetch={prefetch}
            className="inline-flex shrink-0 text-vetneb-teal transition group-hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            {...props}
          >
            <span className="sr-only">
              {typeof children === "string" ? children : "Ver"}
            </span>
            {icon ? <span aria-hidden="true">{icon}</span> : null}
          </PublicRouteControl>
        )}
      </div>
    );
  }

  if (external) {
    return (
      <PublicExternalControl
        href={href}
        className={cn(
          "inline-flex h-11 items-center justify-center gap-2 rounded-md border border-input bg-card/95 px-8 text-sm font-semibold ring-offset-background transition-[background-color,border-color,box-shadow,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2 disabled:opacity-55",
          actionClasses[variant],
          className,
        )}
        {...props}
      >
        <span>{children}</span>
        {icon}
      </PublicExternalControl>
    );
  }

  return (
    <PublicRouteControl
      href={href}
      variant={variant}
      replace={replace}
      prefetch={prefetch}
      className={cn(actionClasses[variant], className)}
      icon={icon}
      {...props}
    >
      {children}
    </PublicRouteControl>
  );
}
