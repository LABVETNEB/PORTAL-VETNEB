"use client";

import { type ReactNode } from "react";

import {
  useScrollPerspective,
  type ScrollPerspectiveIntensity,
  type ScrollPerspectiveMobileIntensity,
} from "@/hooks/useScrollPerspective";
import { cn } from "@/lib/utils";

type PerspectiveScrollSectionTag = "div" | "section";

export type PerspectiveScrollSectionProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  as?: PerspectiveScrollSectionTag;
  intensity?: ScrollPerspectiveIntensity;
  disableOnMobile?: boolean;
  mobileIntensity?: ScrollPerspectiveMobileIntensity;
};

export function PerspectiveScrollSection({
  children,
  className,
  innerClassName,
  as = "div",
  intensity = "standard",
  disableOnMobile = false,
  mobileIntensity = "minimal",
}: PerspectiveScrollSectionProps) {
  const sectionRef = useScrollPerspective<HTMLElement>({
    intensity,
    disableOnMobile,
    mobileIntensity,
  });

  const wrapperClassName = cn("public-perspective-section", className);
  const innerContent = (
    <div className={cn("public-perspective-section-inner", innerClassName)}>
      {children}
    </div>
  );

  if (as === "section") {
    return (
      <section
        ref={(node) => {
          sectionRef.current = node;
        }}
        className={wrapperClassName}
        data-public-perspective-section="true"
        data-perspective-intensity={intensity}
      >
        {innerContent}
      </section>
    );
  }

  return (
    <div
      ref={(node) => {
        sectionRef.current = node;
      }}
      className={wrapperClassName}
      data-public-perspective-section="true"
      data-perspective-intensity={intensity}
    >
      {innerContent}
    </div>
  );
}
