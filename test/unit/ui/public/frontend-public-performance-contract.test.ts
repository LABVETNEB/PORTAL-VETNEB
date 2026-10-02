import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import { parseTsx } from "../dashboard/dashboard-source-oracle.ts";
import { runModule } from "../admin/source-function-runner.ts";

const HOME_PAGE_PATH = "frontend/src/app/page.tsx";
const SCROLL_REVEAL_PATH =
  "frontend/src/components/public/PublicScrollReveal.tsx";
const HERO_IMAGE_PATH =
  "frontend/public/images/hero-microscope-vetneb.webp";

test("home hero uses optimized Next image as LCP candidate", () => {
  const source = read(HOME_PAGE_PATH);

  assert.ok(source.includes('import Image from "next/image";'));
  assert.ok(source.includes('src="/images/hero-microscope-vetneb.webp"'));
  assert.ok(
    source.includes('alt="Microscopio en laboratorio patológico veterinario"'),
  );
  assert.ok(source.includes("fill"));
  assert.ok(source.includes("priority"));
  assert.ok(source.includes('sizes="100vw"'));
  assert.equal(source.includes("unoptimized"), false);
});

test("home hero keeps LCP image outside scroll reveal wrappers", () => {
  const source = read(HOME_PAGE_PATH);
  const heroMatch = source.match(
    /<section\s+className="relative isolate overflow-hidden text-white"[\s\S]*?<\/section>/,
  );

  assert.ok(heroMatch);
  assert.equal(heroMatch[0].includes("<PublicScrollReveal"), false);
  assert.equal(
    /<PublicScrollReveal[\s\S]*?src="\/images\/hero-microscope-vetneb\.webp"/.test(
      source,
    ),
    false,
  );
});

test("public hero image stays within conservative LCP asset budget", () => {
  const heroImage = statSync(resolve(process.cwd(), HERO_IMAGE_PATH));

  assert.ok(
    heroImage.size <= 100_000,
    `hero image should stay <= 100 KB, received ${heroImage.size} bytes`,
  );
});

test("public scroll reveal defers animation work away from initial render", () => {
  const source = read(SCROLL_REVEAL_PATH);

  assert.ok(source.includes("IntersectionObserver"));
  assert.ok(source.includes('rootMargin: "240px 0px"'));
  assert.ok(source.includes("threshold: 0.01"));
  assert.ok(source.includes("requestIdleCallback"));
  assert.ok(source.includes("cancelIdleCallback"));
  assert.ok(source.includes("setTimeout"));
  assert.ok(source.includes("clearTimeout"));
  assert.ok(source.includes('import("gsap")'));
  assert.ok(source.includes('import("gsap/ScrollTrigger")'));
});

test("public scroll reveal keeps reduced motion and cleanup guarantees", () => {
  const source = read(SCROLL_REVEAL_PATH);

  assert.ok(source.includes("prefers-reduced-motion"));
  assert.ok(source.includes("matchMedia"));
  assert.ok(source.includes("observer?.disconnect()"));
  assert.ok(source.includes("cancelIdleInitialization?.()"));
  assert.ok(source.includes("ctx?.revert()"));
});

test("TEST-GLOBAL-08 G06-P13 kills M-P02 when unmount cleanup skips GSAP context reversion", async () => {
  const source = read(SCROLL_REVEAL_PATH);
  const run = async (candidate: string) => {
    let effect: (() => void | (() => void)) | undefined;
    let observe: ((entries: Array<{ isIntersecting: boolean }>) => void) | undefined;
    let idleCallback: (() => void) | undefined;
    let reverts = 0;
    const root = {};
    class Observer {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
        observe = callback;
      }
      observe() {}
      disconnect() {}
    }
    const PublicScrollReveal = runModule(
      parseTsx(candidate, SCROLL_REVEAL_PATH),
      {
        react: {
          useEffect: (callback: () => void | (() => void)) => { effect = callback; },
          useRef: () => ({ current: root }),
        },
        "@/lib/utils": { cn: (...classes: unknown[]) => classes.filter(Boolean).join(" ") },
        gsap: {
          gsap: {
            registerPlugin: () => undefined,
            context: (callback: () => void) => {
              callback();
              return { revert: () => { reverts += 1; } };
            },
            fromTo: () => undefined,
          },
        },
        "gsap/ScrollTrigger": { ScrollTrigger: {} },
      },
      {
        React: { createElement: () => null },
        window: {
          matchMedia: () => ({ matches: false }),
          requestIdleCallback: (callback: () => void) => { idleCallback = callback; return 1; },
          cancelIdleCallback: () => undefined,
          setTimeout: () => 1,
          clearTimeout: () => undefined,
          IntersectionObserver: Observer,
        },
        IntersectionObserver: Observer,
      },
    ).PublicScrollReveal as (props: { children: unknown }) => unknown;

    PublicScrollReveal({ children: null });
    assert.ok(effect, "component must register its effect");
    const cleanup = effect();
    assert.ok(observe, "effect must observe the reveal root");
    observe([{ isIntersecting: true }]);
    assert.ok(idleCallback, "intersection must schedule initialization");
    idleCallback();
    await new Promise((resolve) => setImmediate(resolve));
    if (typeof cleanup !== "function") {
      throw new Error("effect must provide cleanup");
    }
    cleanup();
    return reverts;
  };

  assert.equal(await run(source), 1);
  const mutant = source.replace("ctx?.revert();", "if (false) ctx?.revert();");
  assert.notEqual(mutant, source, "M-P02 must be applicable");
  assert.equal(await run(mutant), 0, "M-P02 leaves GSAP context active after unmount");
});
