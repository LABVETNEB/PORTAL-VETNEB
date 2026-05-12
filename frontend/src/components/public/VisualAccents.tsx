import type { ComponentType, ReactNode, SVGProps } from "react";

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
  blue: "from-blue-500/15 via-cyan-400/10 to-white text-blue-700 ring-blue-500/15",
  emerald:
    "from-emerald-500/15 via-teal-400/10 to-white text-emerald-700 ring-emerald-500/15",
  amber:
    "from-amber-400/20 via-orange-300/10 to-white text-amber-700 ring-amber-500/15",
  slate:
    "from-slate-500/15 via-blue-300/10 to-white text-slate-700 ring-slate-500/15",
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
        "render-gpu-soft inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br shadow-[0_18px_45px_rgba(15,23,42,0.10)] ring-1",
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

export function Eyebrow(_props: EyebrowProps) {
  return null;
}

type AmbientOrbsProps = {
  variant?: "light" | "dark";
  className?: string;
};

export function AmbientOrbs({ variant = "light", className }: AmbientOrbsProps) {
  const isDark = variant === "dark";

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden="true"
    >
      <div
        className={cn(
          "render-orb absolute -left-24 -top-28 h-72 w-72 rounded-full",
          isDark ? "bg-cyan-300/20" : "bg-cyan-200/45",
        )}
      />
      <div
        className={cn(
          "render-orb absolute right-[-7rem] top-16 h-80 w-80 rounded-full",
          isDark ? "bg-emerald-300/20" : "bg-emerald-200/45",
        )}
      />
      <div
        className={cn(
          "render-orb absolute bottom-[-9rem] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full",
          isDark ? "bg-amber-200/15" : "bg-amber-100/55",
        )}
      />
    </div>
  );
}

type PremiumPanelProps = {
  children: ReactNode;
  className?: string;
};

export function PremiumPanel({ children, className }: PremiumPanelProps) {
  return (
    <div
      className={cn(
        "render-gpu-soft rounded-3xl border border-white/70 bg-white/80 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
