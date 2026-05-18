import assert from "node:assert/strict";
import { statSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const HOME_PAGE_PATH = "frontend/src/app/page.tsx";
const SCROLL_REVEAL_PATH =
  "frontend/src/components/public/PublicScrollReveal.tsx";
const HERO_IMAGE_PATH =
  "frontend/public/images/hero-microscope-vetneb.webp";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

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
