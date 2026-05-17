"use client";

import { type ReactNode, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type PublicScrollRevealTag = "div" | "section" | "article";

export type PublicScrollRevealProps = {
  children: ReactNode;
  className?: string;
  as?: PublicScrollRevealTag;
};

export function PublicScrollReveal({
  children,
  className,
  as = "div",
}: PublicScrollRevealProps) {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const rootElement = rootRef.current;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!rootElement || prefersReducedMotion) {
      return;
    }

    let isDisposed = false;
    let ctx: { revert: () => void } | null = null;

    const initialize = async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);

      if (isDisposed || !rootRef.current) {
        return;
      }

      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        gsap.fromTo(
          rootRef.current,
          { opacity: 0.96, y: 14 },
          {
            opacity: 1,
            y: 0,
            duration: 0.75,
            ease: "power2.out",
            scrollTrigger: {
              trigger: rootRef.current,
              start: "top 86%",
              once: true,
            },
          },
        );
      }, rootRef);
    };

    void initialize();

    return () => {
      isDisposed = true;
      ctx?.revert();
    };
  }, []);

  if (as === "section") {
    return (
      <section
        ref={(node) => {
          rootRef.current = node;
        }}
        className={cn(className)}
      >
        {children}
      </section>
    );
  }

  if (as === "article") {
    return (
      <article
        ref={(node) => {
          rootRef.current = node;
        }}
        className={cn(className)}
      >
        {children}
      </article>
    );
  }

  return (
    <div
      ref={(node) => {
        rootRef.current = node;
      }}
      className={cn(className)}
    >
      {children}
    </div>
  );
}
