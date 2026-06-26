"use client";

import { usePathname, useRouter } from "next/navigation";
import type {
  ComponentPropsWithoutRef,
  FocusEvent,
  MouseEvent,
  ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PublicRouteControlVariant =
  | "primaryLight"
  | "primaryDark"
  | "secondaryOutline"
  | "textLink"
  | "bare";

type PublicRouteControlProps = {
  href: string;
  children: ReactNode;
  variant?: PublicRouteControlVariant;
  className?: string;
  activeClassName?: string;
  icon?: ReactNode;
  replace?: boolean;
  prefetch?: boolean;
} & Omit<ComponentPropsWithoutRef<"button">, "type" | "children" | "className">;

const styledClasses: Record<
  Exclude<PublicRouteControlVariant, "textLink" | "bare">,
  string
> = {
  primaryLight:
    "w-full border-vetneb-line/90 bg-card/95 px-7 font-semibold text-vetneb-navy shadow-sm hover:border-vetneb-teal/45 hover:bg-vetneb-surface-raised hover:text-vetneb-navy sm:w-auto",
  primaryDark:
    "w-full clinical-primary-gradient clinical-primary-gradient-hover px-7 font-semibold text-primary-foreground shadow-[0_14px_35px_hsl(var(--vetneb-navy)/0.22)] sm:w-auto",
  secondaryOutline:
    "w-full border border-white/60 bg-white/10 px-7 font-semibold text-vetneb-navy shadow-sm hover:bg-white/16 hover:text-vetneb-navy active:text-vetneb-navy focus-visible:text-vetneb-navy sm:w-auto",
};

export function PublicRouteControl({
  href,
  children,
  variant = "primaryLight",
  className,
  activeClassName,
  icon,
  replace = false,
  prefetch = true,
  disabled,
  onClick,
  onMouseEnter,
  onFocus,
  ...props
}: PublicRouteControlProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isRouteActive =
    activeClassName != null &&
    (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

  const navigate = () => {
    if (replace) {
      router.replace(href);
      return;
    }

    // For same-page hash navigation, use window.location.hash so the browser
    // fires a native hashchange event. router.push uses history.pushState which
    // does not fire hashchange, breaking hash-listening components (AdminSectionTabs).
    if (typeof window !== "undefined" && href.includes("#")) {
      const target = new URL(href, window.location.origin);
      if (target.pathname === window.location.pathname) {
        window.location.hash = target.hash;
        return;
      }
    }

    router.push(href);
  };

  const prefetchRoute = () => {
    if (!prefetch || !href.startsWith("/")) {
      return;
    }

    router.prefetch(href);
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);

    if (event.defaultPrevented || disabled) {
      return;
    }

    navigate();
  };

  const handleMouseEnter = (event: MouseEvent<HTMLButtonElement>) => {
    onMouseEnter?.(event);

    if (event.defaultPrevented || disabled) {
      return;
    }

    prefetchRoute();
  };

  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
    onFocus?.(event);

    if (event.defaultPrevented || disabled) {
      return;
    }

    prefetchRoute();
  };

  if (variant === "textLink") {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onFocus={handleFocus}
        className={cn(
          "inline-flex items-center gap-2 text-sm font-semibold text-vetneb-navy underline-offset-4 transition hover:text-vetneb-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2",
          className,
        )}
        {...props}
      >
        <span>{children}</span>
        {icon}
      </button>
    );
  }

  if (variant === "bare") {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onFocus={handleFocus}
        aria-current={isRouteActive ? "page" : undefined}
        className={cn(
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2",
          className,
          isRouteActive && activeClassName,
        )}
        {...props}
      >
        {children}
      </button>
    );
  }

  return (
    <Button
      type="button"
      disabled={disabled}
      variant={variant === "primaryDark" ? "default" : "outline"}
      size="lg"
      className={cn(styledClasses[variant], className)}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
      {...props}
    >
      {children}
      {icon}
    </Button>
  );
}

type PublicExternalControlProps = {
  href: string;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  target?: "_blank" | "_self";
  disabled?: boolean;
} & Omit<
  ComponentPropsWithoutRef<"a">,
  "href" | "children" | "className" | "target" | "aria-disabled" | "rel"
>;

export function PublicExternalControl({
  href,
  children,
  className,
  icon,
  target = "_blank",
  disabled = false,
  onClick,
  ...props
}: PublicExternalControlProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);

    if (event.defaultPrevented) {
      return;
    }

    if (disabled) {
      event.preventDefault();
    }
  };

  return (
    <a
      href={href}
      target={target}
      rel={target === "_blank" ? "noopener noreferrer" : undefined}
      aria-disabled={disabled ? "true" : undefined}
      tabIndex={disabled ? -1 : props.tabIndex}
      onClick={handleClick}
      className={cn(
        "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
      {...props}
    >
      {children}
      {icon}
    </a>
  );
}
