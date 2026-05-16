import type { ReactNode } from "react";

import { AmbientOrbs } from "@/components/public/VisualAccents";
import { cn } from "@/lib/utils";

export type PublicHeroVariant =
  | "brand"
  | "editorial"
  | "directory"
  | "conversion"
  | "compact"
  | "none";

type PublicHeroProps = {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  children?: ReactNode;
  variant?: PublicHeroVariant;
  className?: string;
};

const heroShellClasses: Record<Exclude<PublicHeroVariant, "none">, string> = {
  brand: "relative isolate overflow-hidden text-white",
  editorial: "public-soft-canvas border-b border-vetneb-line/70 py-14 md:py-16",
  directory: "public-soft-canvas border-b border-vetneb-line/70 py-12 md:py-14",
  conversion: "public-hero-depth py-16 text-white md:py-20",
  compact: "public-soft-canvas border-b border-vetneb-line/70 py-10 md:py-12",
};

const contentClasses: Record<Exclude<PublicHeroVariant, "none">, string> = {
  brand: "container relative z-10 mx-auto px-4 sm:px-6 lg:px-8",
  editorial: "container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8",
  directory: "container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8",
  conversion: "container relative z-10 mx-auto px-4 sm:px-6 lg:px-8",
  compact: "container mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8",
};

const titleClasses: Record<Exclude<PublicHeroVariant, "none">, string> = {
  brand: "max-w-5xl text-[clamp(1.85rem,4.6vw,3.75rem)] font-bold uppercase leading-[0.94] tracking-[0.045em] text-primary-foreground",
  editorial: "max-w-4xl text-3xl font-bold leading-tight text-vetneb-ink md:text-4xl",
  directory: "max-w-4xl text-3xl font-bold leading-tight text-vetneb-ink md:text-4xl",
  conversion: "max-w-4xl text-4xl font-bold leading-tight text-primary-foreground md:text-5xl",
  compact: "text-3xl font-bold leading-tight text-vetneb-ink md:text-4xl",
};

const descriptionClasses: Record<Exclude<PublicHeroVariant, "none">, string> = {
  brand: "mt-6 max-w-2xl text-xl font-medium leading-tight text-primary-foreground/94 md:text-2xl lg:text-3xl",
  editorial: "mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg",
  directory: "mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg",
  conversion: "mt-5 max-w-2xl text-xl leading-relaxed text-primary-foreground/92",
  compact: "mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base",
};

export function PublicHero({
  title,
  description,
  eyebrow,
  actions,
  children,
  variant = "editorial",
  className,
}: PublicHeroProps) {
  if (variant === "none") {
    return <>{children}</>;
  }

  const isDark = variant === "brand" || variant === "conversion";

  return (
    <section className={cn(heroShellClasses[variant], className)}>
      {isDark ? <AmbientOrbs variant="dark" /> : null}
      <div className={contentClasses[variant]}>
        {eyebrow ? (
          <p
            className={cn(
              "mb-3 text-xs font-semibold uppercase tracking-[0.22em]",
              isDark ? "text-primary-foreground/72" : "text-vetneb-navy/70",
            )}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1 className={titleClasses[variant]}>{title}</h1>
        {description ? (
          <div className={descriptionClasses[variant]}>{description}</div>
        ) : null}
        {actions ? (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {actions}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}
