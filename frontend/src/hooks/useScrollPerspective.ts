"use client";

import { useEffect, useRef, type RefObject } from "react";

export type ScrollPerspectiveIntensity = "subtle" | "standard" | "featured";
export type ScrollPerspectiveMobileIntensity = "none" | "minimal";

type ScrollPerspectiveProfile = {
  maxRotateXDeg: number;
  minScale: number;
  maxTranslateYPx: number;
  minOpacity: number;
};

export const SCROLL_PERSPECTIVE_PROFILES: Record<
  ScrollPerspectiveIntensity,
  ScrollPerspectiveProfile
> = {
  subtle: {
    maxRotateXDeg: 2,
    minScale: 0.99,
    maxTranslateYPx: 12,
    minOpacity: 0.94,
  },
  standard: {
    maxRotateXDeg: 3,
    minScale: 0.985,
    maxTranslateYPx: 20,
    minOpacity: 0.9,
  },
  featured: {
    maxRotateXDeg: 4.5,
    minScale: 0.975,
    maxTranslateYPx: 28,
    minOpacity: 0.86,
  },
};

const SCROLL_PERSPECTIVE_MOBILE_MINIMAL_PROFILE: ScrollPerspectiveProfile = {
  maxRotateXDeg: 0,
  minScale: 0.992,
  maxTranslateYPx: 10,
  minOpacity: 0.95,
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const MOBILE_VIEWPORT_MAX_WIDTH_PX = 768;

type RegisteredPerspectiveSection = {
  element: HTMLElement;
  desktopProfile: ScrollPerspectiveProfile;
  mobileProfile: ScrollPerspectiveProfile | null;
  isNeutralized: boolean;
};

const registeredSections = new Set<RegisteredPerspectiveSection>();

let pendingFrameId: number | null = null;
let areViewportListenersAttached = false;

function setSectionDepthVariables(
  element: HTMLElement,
  scale: number,
  rotateXDeg: number,
  translateYPx: number,
  opacity: number,
) {
  element.style.setProperty("--scroll-depth-scale", scale.toFixed(4));
  element.style.setProperty("--scroll-depth-rotate-x", `${rotateXDeg.toFixed(3)}deg`);
  element.style.setProperty("--scroll-depth-y", `${translateYPx.toFixed(2)}px`);
  element.style.setProperty("--scroll-depth-opacity", opacity.toFixed(4));
}

function clearSectionDepthVariables(element: HTMLElement) {
  element.style.removeProperty("--scroll-depth-scale");
  element.style.removeProperty("--scroll-depth-rotate-x");
  element.style.removeProperty("--scroll-depth-y");
  element.style.removeProperty("--scroll-depth-opacity");
}

function updateRegisteredSections() {
  pendingFrameId = null;

  const viewportHeight = window.innerHeight;

  if (viewportHeight <= 0 || registeredSections.size === 0) {
    return;
  }

  const viewportCenter = viewportHeight / 2;
  const isMobileViewport = window.innerWidth < MOBILE_VIEWPORT_MAX_WIDTH_PX;

  for (const section of registeredSections) {
    const profile = isMobileViewport
      ? section.mobileProfile
      : section.desktopProfile;

    if (!profile) {
      if (!section.isNeutralized) {
        setSectionDepthVariables(section.element, 1, 0, 0, 1);
        section.isNeutralized = true;
      }
      continue;
    }

    section.isNeutralized = false;

    const rect = section.element.getBoundingClientRect();

    if (rect.height <= 0) {
      continue;
    }

    const sectionCenter = rect.top + rect.height / 2;
    const normalizationRange = viewportCenter + rect.height / 2;
    const rawProgress = (sectionCenter - viewportCenter) / normalizationRange;
    const signedProgress = Math.max(-1, Math.min(1, rawProgress));
    // Signed quadratic easing: near the viewport center the section stays
    // visually neutral; depth ramps toward the viewport edges.
    const easedDepth = signedProgress * Math.abs(signedProgress);
    const depthMagnitude = Math.abs(easedDepth);
    // Sections taller than the viewport rotate proportionally less so the
    // projected near edge never widens past the layout gutters.
    const rotationHeightCap = Math.min(1, viewportHeight / rect.height);

    setSectionDepthVariables(
      section.element,
      1 - (1 - profile.minScale) * depthMagnitude,
      profile.maxRotateXDeg * easedDepth * rotationHeightCap,
      profile.maxTranslateYPx * easedDepth,
      1 - (1 - profile.minOpacity) * depthMagnitude,
    );
  }
}

function scheduleSectionsUpdate() {
  if (pendingFrameId !== null) {
    return;
  }

  pendingFrameId = window.requestAnimationFrame(updateRegisteredSections);
}

function attachViewportListeners() {
  if (areViewportListenersAttached) {
    return;
  }

  window.addEventListener("scroll", scheduleSectionsUpdate, { passive: true });
  window.addEventListener("resize", scheduleSectionsUpdate, { passive: true });
  areViewportListenersAttached = true;
}

function detachViewportListeners() {
  if (!areViewportListenersAttached) {
    return;
  }

  window.removeEventListener("scroll", scheduleSectionsUpdate);
  window.removeEventListener("resize", scheduleSectionsUpdate);
  areViewportListenersAttached = false;

  if (pendingFrameId !== null) {
    window.cancelAnimationFrame(pendingFrameId);
    pendingFrameId = null;
  }
}

export type UseScrollPerspectiveOptions = {
  intensity?: ScrollPerspectiveIntensity;
  disableOnMobile?: boolean;
  mobileIntensity?: ScrollPerspectiveMobileIntensity;
};

export function useScrollPerspective<T extends HTMLElement>({
  intensity = "standard",
  disableOnMobile = false,
  mobileIntensity = "minimal",
}: UseScrollPerspectiveOptions = {}): RefObject<T | null> {
  const sectionRef = useRef<T | null>(null);

  useEffect(() => {
    const element = sectionRef.current;

    if (!element) {
      return;
    }

    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      element.setAttribute("data-perspective-disabled", "reduced-motion");

      return () => {
        element.removeAttribute("data-perspective-disabled");
      };
    }

    const section: RegisteredPerspectiveSection = {
      element,
      desktopProfile: SCROLL_PERSPECTIVE_PROFILES[intensity],
      mobileProfile:
        disableOnMobile || mobileIntensity === "none"
          ? null
          : SCROLL_PERSPECTIVE_MOBILE_MINIMAL_PROFILE,
      isNeutralized: false,
    };

    registeredSections.add(section);
    element.setAttribute("data-perspective-active", "true");
    attachViewportListeners();
    scheduleSectionsUpdate();

    return () => {
      registeredSections.delete(section);
      element.removeAttribute("data-perspective-active");
      clearSectionDepthVariables(element);

      if (registeredSections.size === 0) {
        detachViewportListeners();
      }
    };
  }, [disableOnMobile, intensity, mobileIntensity]);

  return sectionRef;
}
