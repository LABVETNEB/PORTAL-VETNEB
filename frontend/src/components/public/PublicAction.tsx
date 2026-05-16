import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
} & Omit<ComponentPropsWithoutRef<typeof Link>, "href" | "children" | "className">;

const actionClasses: Record<Exclude<PublicActionVariant, "textLink" | "contactCard">, string> = {
  primaryLight:
    "w-full border-vetneb-line/90 bg-card/95 px-7 font-semibold text-vetneb-navy shadow-sm hover:border-vetneb-teal/45 hover:bg-vetneb-surface-raised hover:text-vetneb-navy sm:w-auto",
  primaryDark:
    "w-full clinical-primary-gradient clinical-primary-gradient-hover px-7 font-semibold text-primary-foreground shadow-[0_14px_35px_hsl(var(--vetneb-navy)/0.22)] sm:w-auto",
  secondaryOutline:
    "w-full border border-white/60 bg-white/10 px-7 font-semibold text-white shadow-sm hover:bg-white/16 sm:w-auto",
};

export function PublicAction({
  href,
  children,
  variant = "primaryLight",
  className,
  icon,
  external = false,
  ...props
}: PublicActionProps) {
  const rel = external ? "noopener noreferrer" : props.rel;
  const target = external ? "_blank" : props.target;

  if (variant === "textLink") {
    return (
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-2 text-sm font-semibold text-vetneb-navy underline-offset-4 transition hover:text-vetneb-teal hover:underline",
          className,
        )}
        rel={rel}
        target={target}
        {...props}
      >
        <span>{children}</span>
        {icon}
      </Link>
    );
  }

  if (variant === "contactCard") {
    return (
      <Link
        href={href}
        className={cn(
          "group flex items-center justify-between gap-4 rounded-lg border border-vetneb-line/85 bg-card/95 px-4 py-3 text-left shadow-sm transition hover:border-vetneb-teal/45 hover:bg-vetneb-surface-raised",
          className,
        )}
        rel={rel}
        target={target}
        {...props}
      >
        <span className="text-sm font-semibold text-vetneb-navy">{children}</span>
        {icon ? (
          <span className="text-vetneb-teal transition group-hover:translate-x-0.5">
            {icon}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <Button
      asChild
      variant={variant === "primaryDark" ? "default" : "outline"}
      size="lg"
      className={cn(actionClasses[variant], className)}
    >
      <Link href={href} rel={rel} target={target} {...props}>
        <span>{children}</span>
        {icon}
      </Link>
    </Button>
  );
}
