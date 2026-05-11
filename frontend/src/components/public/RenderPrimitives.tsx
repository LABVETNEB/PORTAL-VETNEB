import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

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
            "mb-4 max-w-4xl text-4xl font-bold leading-tight tracking-tight md:text-5xl",
            titleClassName,
          )}
        >
          {title}
        </h1>
        {description ? (
          <div
            className={cn(
              "render-copy max-w-2xl text-lg text-blue-50 md:text-xl",
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
  plain: "bg-white py-16 md:py-20",
  soft: "public-soft-canvas py-16 md:py-20",
  muted: "bg-gray-50 py-16 md:py-20",
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
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  disabled?: boolean;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
};

const gradientButtonClassName =
  "render-gpu-soft inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-teal-600 px-5 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(37,99,235,0.22)] transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:from-blue-800 hover:to-teal-700 hover:shadow-[0_18px_44px_rgba(37,99,235,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60";

export function PublicGradientButton({
  children,
  className,
  href,
  showArrow = false,
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
    return (
      <Link href={href} className={cn(gradientButtonClassName, className)}>
        {content}
      </Link>
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
  blue: "border-blue-100 bg-blue-50/80 text-blue-900",
  emerald: "border-emerald-100 bg-emerald-50/80 text-emerald-900",
  amber: "border-amber-100 bg-amber-50/80 text-amber-900",
  slate: "border-slate-200 bg-slate-50/80 text-slate-900",
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
        "render-gpu-soft rounded-2xl border px-4 py-3 shadow-sm",
        metricToneClasses[tone],
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold leading-none">{value}</p>
    </div>
  );
}