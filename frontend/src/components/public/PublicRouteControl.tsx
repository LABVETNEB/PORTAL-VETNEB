"use client";

import { usePathname, useRouter } from "next/navigation";
import type {
  ComponentPropsWithoutRef,
  FocusEvent,
  MouseEvent,
  ReactNode,
} from "react";
import { useCallback, useEffect } from "react";

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

// Every same-origin, non-hash destination is eligible for the pre-hydration
// fallback in theme-init.js, dashboard included. This used to exclude
// `/dashboard` categorically, which left every dashboard nav control visible
// and clickable before React attaches its handler, with no way to recover
// that click. Eligibility alone does not navigate anything: theme-init.js
// additionally requires the per-node `data-public-route-control-hydrated`
// marker below to be absent before it acts, so a hydrated control is never
// intercepted.
//
// `href.startsWith("/")` is NOT proof of same-origin: "//attacker.example"
// is a protocol-relative URL that also starts with "/", and the WHATWG URL
// parser additionally treats a leading "/\" as a new authority for special
// schemes and strips embedded tabs/newlines before parsing, so
// "/\t/attacker.example" collapses to the same protocol-relative form. This
// resolves the href against a fixed placeholder origin — no window.location
// dependency, since this also runs during SSR — and only accepts it if that
// resolution left the placeholder's own host untouched.
const SAME_ORIGIN_PROBE_HOST = "vetneb-internal.invalid";
const SAME_ORIGIN_PROBE_BASE = `http://${SAME_ORIGIN_PROBE_HOST}/`;

function isSameOriginRelativeHref(href: string): boolean {
  if (!href) return false;
  let resolved: URL;
  try {
    resolved = new URL(href, SAME_ORIGIN_PROBE_BASE);
  } catch {
    return false;
  }
  return resolved.protocol === "http:" && resolved.host === SAME_ORIGIN_PROBE_HOST;
}

function isPreHydrationFallbackEligible(href: string): boolean {
  return !href.includes("#") && isSameOriginRelativeHref(href);
}

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

  useEffect(() => {
    document.documentElement.dataset.publicRouteControlsHydrated = "true";
  }, []);

  // Per-node hydration signal, not the global flag above: a ref callback
  // fires only once React actually commits and adopts THIS DOM node, so it
  // can never read "hydrated" for a control still waiting behind a slower
  // sibling. SSR never renders this attribute; it only ever appears from the
  // client, which is what theme-init.js relies on to tell a live control
  // apart from one it still owns.
  const markControlHydrated = useCallback((node: HTMLButtonElement | null) => {
    if (node) {
      node.setAttribute("data-public-route-control-hydrated", "true");
    }
  }, []);

  const isRouteActive =
    activeClassName != null &&
    (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));
  const publicRouteFallbackProps = isPreHydrationFallbackEligible(href)
    ? {
        "data-public-route-control": "true",
        "data-public-route-href": href,
        "data-public-route-replace": replace ? "true" : undefined,
      }
    : {};

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
        ref={markControlHydrated}
        disabled={disabled}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onFocus={handleFocus}
        {...publicRouteFallbackProps}
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
        ref={markControlHydrated}
        disabled={disabled}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onFocus={handleFocus}
        aria-current={isRouteActive ? "page" : undefined}
        {...publicRouteFallbackProps}
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
      ref={markControlHydrated}
      disabled={disabled}
      variant={variant === "primaryDark" ? "default" : "outline"}
      size="lg"
      className={cn(styledClasses[variant], className)}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
      {...publicRouteFallbackProps}
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
} & Omit<ComponentPropsWithoutRef<"button">, "type" | "children" | "className">;

export function PublicExternalControl({
  href,
  children,
  className,
  icon,
  target = "_blank",
  disabled,
  onClick,
  ...props
}: PublicExternalControlProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);

    if (event.defaultPrevented || disabled) {
      return;
    }

    if (target === "_self") {
      window.location.assign(href);
      return;
    }

    window.open(href, target, "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2",
        className,
      )}
      {...props}
    >
      {children}
      {icon}
    </button>
  );
}
