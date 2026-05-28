import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  PublicExternalControl,
  PublicRouteControl,
} from "@/components/public/PublicRouteControl";

type PublicHeroProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
};

export function PublicHero({
  eyebrow,
  title,
  description,
  children,
  className,
  contentClassName,
  titleClassName,
  descriptionClassName,
}: PublicHeroProps) {
  return (
    <section
      className={cn("public-hero-depth py-16 text-white md:py-20", className)}
    >
      <div className={cn("container relative z-10 mx-auto px-4 sm:px-6 lg:px-8", contentClassName)}>
        {eyebrow}
        <h1
          className={cn(
            "mb-4 max-w-4xl text-4xl font-bold leading-tight md:text-5xl",
            titleClassName,
          )}
        >
          {title}
        </h1>
        {description ? (
          <div
            className={cn(
              "render-copy max-w-2xl text-lg text-primary-foreground/86 md:text-xl",
              descriptionClassName,
            )}
          >
            {description}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}

type PublicSectionProps = {
  children: ReactNode;
  variant?: "plain" | "soft" | "muted";
  className?: string;
  containerClassName?: string;
  id?: string;
  labelledBy?: string;
};

const sectionVariants = {
  plain: "bg-card/70 py-16 md:py-20",
  soft: "public-soft-canvas py-16 md:py-20",
  muted: "bg-vetneb-surface-muted/70 py-16 md:py-20",
};

export function PublicSection({
  children,
  variant = "plain",
  className,
  containerClassName,
  id,
  labelledBy,
}: PublicSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(sectionVariants[variant], className)}
    >
      <div className={cn("container mx-auto px-4 sm:px-6 lg:px-8", containerClassName)}>
        {children}
      </div>
    </section>
  );
}

type PublicSurfaceCardProps = {
  children: ReactNode;
  className?: string;
  muted?: boolean;
};

export function PublicSurfaceCard({
  children,
  className,
  muted = false,
}: PublicSurfaceCardProps) {
  return (
    <div
      className={cn(
        muted ? "premium-card-muted" : "premium-card",
        "render-gpu-soft",
        className,
      )}
    >
      {children}
    </div>
  );
}

type PublicGradientButtonProps = {
  children: ReactNode;
  className?: string;
  href?: string;
  showArrow?: boolean;
  replace?: boolean;
  prefetch?: boolean;
  external?: boolean;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  disabled?: boolean;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
};

const gradientButtonClassName =
  "inline-flex h-11 items-center justify-center gap-2 rounded-md clinical-primary-gradient clinical-primary-gradient-hover px-5 text-sm font-semibold text-primary-foreground shadow-[0_14px_34px_hsl(var(--vetneb-navy)/0.20)] transition-[box-shadow,background-color,border-color] duration-200 hover:shadow-[0_18px_44px_hsl(var(--vetneb-navy)/0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60";

export function PublicGradientButton({
  children,
  className,
  href,
  showArrow = false,
  replace = false,
  prefetch = true,
  external = false,
  type = "button",
  disabled,
  onClick,
}: PublicGradientButtonProps) {
  const content = (
    <>
      {children}
      {showArrow ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
    </>
  );

  if (href) {
    const useExternalControl =
      external ||
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:");

    if (useExternalControl) {
      return (
        <PublicExternalControl
          href={href}
          disabled={disabled}
          onClick={onClick}
          className={cn(gradientButtonClassName, className)}
        >
          {content}
        </PublicExternalControl>
      );
    }

    return (
      <PublicRouteControl
        href={href}
        variant="bare"
        replace={replace}
        prefetch={prefetch}
        disabled={disabled}
        onClick={onClick}
        className={cn(gradientButtonClassName, className)}
      >
        {content}
      </PublicRouteControl>
    );
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(gradientButtonClassName, className)}
    >
      {content}
    </button>
  );
}

type MetricPillTone = "blue" | "emerald" | "amber" | "slate";

type MetricPillProps = {
  label: ReactNode;
  value: ReactNode;
  tone?: MetricPillTone;
  className?: string;
};

const metricToneClasses: Record<MetricPillTone, string> = {
  blue: "border-vetneb-cyan/25 bg-vetneb-cyan/10 text-vetneb-navy",
  emerald: "border-vetneb-teal/25 bg-vetneb-teal/10 text-vetneb-teal",
  amber: "border-vetneb-amber/30 bg-vetneb-amber/10 text-amber-800",
  slate: "border-vetneb-line bg-vetneb-surface-muted text-vetneb-ink",
};

export function MetricPill({
  label,
  value,
  tone = "blue",
  className,
}: MetricPillProps) {
  return (
    <div
      className={cn(
        "render-gpu-soft rounded-lg border px-4 py-3 shadow-sm",
        metricToneClasses[tone],
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase opacity-70">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold leading-none">{value}</p>
    </div>
  );
}
