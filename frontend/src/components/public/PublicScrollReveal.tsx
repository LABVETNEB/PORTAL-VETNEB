"use client";

import { type ReactNode, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type PublicScrollRevealTag = "div" | "section" | "article";

export type PublicScrollRevealProps = {
  children: ReactNode;
  className?: string;
  as?: PublicScrollRevealTag;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function PublicScrollReveal({
  children,
  className,
  as = "div",
}: PublicScrollRevealProps) {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const rootElement = rootRef.current;

    if (!rootElement || prefersReducedMotion()) {
      return;
    }

    let isDisposed = false;
    let context: { revert: () => void } | null = null;

    const initialize = async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);

      if (isDisposed || !rootRef.current) {
        return;
      }

      gsap.registerPlugin(ScrollTrigger);

      context = gsap.context(() => {
        gsap.fromTo(
          rootRef.current,
          { opacity: 0, y: 18 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
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
      context?.revert();
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
