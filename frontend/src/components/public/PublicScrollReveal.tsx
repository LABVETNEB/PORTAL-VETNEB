"use client";

import { type ReactNode, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type PublicScrollRevealTag = "div" | "section" | "article";
export type PublicScrollRevealVariant = "section" | "cards" | "minimal";

type PublicScrollRevealPreset = {
  fromOpacity: number;
  fromY: number;
  duration: number;
  ease: "power2.out";
  start: string;
  stagger?: number;
};

type PublicMotionSchedulerWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout?: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const PUBLIC_MOTION_POLICY_PRESETS: Record<
  PublicScrollRevealVariant,
  PublicScrollRevealPreset
> = {
  section: {
    fromOpacity: 0.88,
    fromY: 14,
    duration: 0.75,
    ease: "power2.out",
    start: "top 86%",
  },
  cards: {
    fromOpacity: 0.88,
    fromY: 16,
    duration: 0.72,
    ease: "power2.out",
    start: "top 84%",
    stagger: 0.07,
  },
  minimal: {
    fromOpacity: 0.92,
    fromY: 8,
    duration: 0.55,
    ease: "power2.out",
    start: "top 88%",
  },
};

function schedulePublicMotionInitialization(callback: () => void) {
  const motionWindow = window as PublicMotionSchedulerWindow;

  if (
    typeof motionWindow.requestIdleCallback === "function" &&
    typeof motionWindow.cancelIdleCallback === "function"
  ) {
    const idleCallbackId = motionWindow.requestIdleCallback(callback, {
      timeout: 1200,
    });

    return () => motionWindow.cancelIdleCallback?.(idleCallbackId);
  }

  const timeoutId = window.setTimeout(callback, 160);

  return () => window.clearTimeout(timeoutId);
}

export type PublicScrollRevealProps = {
  children: ReactNode;
  className?: string;
  as?: PublicScrollRevealTag;
  variant?: PublicScrollRevealVariant;
  staggerChildren?: boolean;
  childSelector?: string;
};

export function PublicScrollReveal({
  children,
  className,
  as = "div",
  variant,
  staggerChildren = false,
  childSelector = "[data-scroll-reveal-item]",
}: PublicScrollRevealProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const resolvedVariant: PublicScrollRevealVariant =
    variant ?? (staggerChildren ? "cards" : "section");

  useEffect(() => {
    const rootElement = rootRef.current;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const preset = PUBLIC_MOTION_POLICY_PRESETS[resolvedVariant];

    if (!rootElement || prefersReducedMotion) {
      return;
    }

    let isDisposed = false;
    let ctx: { revert: () => void } | null = null;
    let observer: IntersectionObserver | null = null;
    let cancelIdleInitialization: (() => void) | null = null;

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
        if (staggerChildren) {
          const childElements = rootRef.current?.querySelectorAll(childSelector);
          const staggerValue =
            preset.stagger ??
            PUBLIC_MOTION_POLICY_PRESETS.cards.stagger ??
            0.07;

          if (childElements && childElements.length > 0) {
            gsap.fromTo(
              childElements,
              { opacity: preset.fromOpacity, y: preset.fromY },
              {
                opacity: 1,
                y: 0,
                duration: preset.duration,
                ease: preset.ease,
                stagger: staggerValue,
                scrollTrigger: {
                  trigger: rootRef.current,
                  start: preset.start,
                  once: true,
                },
              },
            );

            return;
          }
        }

        gsap.fromTo(
          rootRef.current,
          { opacity: preset.fromOpacity, y: preset.fromY },
          {
            opacity: 1,
            y: 0,
            duration: preset.duration,
            ease: preset.ease,
            scrollTrigger: {
              trigger: rootRef.current,
              start: preset.start,
              once: true,
            },
          },
        );
      }, rootRef);
    };

    const scheduleInitialize = () => {
      if (isDisposed || cancelIdleInitialization) {
        return;
      }

      cancelIdleInitialization = schedulePublicMotionInitialization(() => {
        cancelIdleInitialization = null;

        if (!isDisposed) {
          void initialize();
        }
      });
    };

    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer?.disconnect();
            observer = null;
            scheduleInitialize();
          }
        },
        {
          rootMargin: "240px 0px",
          threshold: 0.01,
        },
      );

      observer.observe(rootElement);
    } else {
      scheduleInitialize();
    }

    return () => {
      isDisposed = true;
      cancelIdleInitialization?.();
      observer?.disconnect();
      ctx?.revert();
    };
  }, [childSelector, resolvedVariant, staggerChildren]);

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
