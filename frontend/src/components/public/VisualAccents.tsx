import type { ComponentType, HTMLAttributes, ReactNode, SVGProps } from "react";

import { cn } from "@/lib/utils";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type VisualTone = "blue" | "emerald" | "amber" | "slate";

type VisualIconProps = {
  icon: IconComponent;
  className?: string;
  iconClassName?: string;
  tone?: VisualTone;
};

const toneClasses: Record<VisualTone, string> = {
  blue: "border-vetneb-cyan/25 bg-vetneb-cyan/10 text-vetneb-navy ring-vetneb-cyan/20",
  emerald:
    "border-vetneb-teal/25 bg-vetneb-teal/10 text-vetneb-teal ring-vetneb-teal/20",
  amber:
    "border-vetneb-amber/30 bg-vetneb-amber/10 text-amber-700 ring-vetneb-amber/20",
  slate:
    "border-vetneb-line bg-vetneb-surface-muted text-vetneb-ink ring-vetneb-line",
};

export function VisualIcon({
  icon: Icon,
  className,
  iconClassName,
  tone = "blue",
}: VisualIconProps) {
  return (
    <span
      className={cn(
        "render-gpu-soft inline-flex h-12 w-12 items-center justify-center rounded-lg border shadow-[0_12px_30px_rgba(15,45,62,0.10)] ring-1",
        toneClasses[tone],
        className,
      )}
      aria-hidden="true"
    >
      <Icon className={cn("h-5 w-5", iconClassName)} strokeWidth={1.8} />
    </span>
  );
}

type EyebrowProps = {
  children: ReactNode;
  className?: string;
};

export function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <div
      className={cn(
        "mb-5 inline-flex items-center rounded-md border border-vetneb-line bg-card/80 px-3 py-1.5 text-xs font-semibold text-vetneb-navy shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

type AmbientOrbsProps = {
  variant?: "light" | "dark";
  className?: string;
};

export function AmbientOrbs({ variant = "light", className }: AmbientOrbsProps) {
  return (
    <div
      className={cn("diagnostic-field", className)}
      data-tone={variant}
      aria-hidden="true"
    />
  );
}

type PremiumPanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function PremiumPanel({
  children,
  className,
  ...props
}: PremiumPanelProps) {
  return (
    <div
      className={cn(
        "render-gpu-soft rounded-lg border border-vetneb-line bg-card/92 shadow-[0_18px_54px_rgba(15,45,62,0.10)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
