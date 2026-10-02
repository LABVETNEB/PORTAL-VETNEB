import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";
import { parseTsx } from "../dashboard/dashboard-source-oracle.ts";
import { runModule } from "../admin/source-function-runner.ts";

const NAVBAR_PATH = "frontend/src/components/layout/Navbar.tsx";
const FOOTER_PATH = "frontend/src/components/layout/Footer.tsx";
const HOME_PAGE_PATH = "frontend/src/app/page.tsx";
const SERVICIOS_PAGE_PATH = "frontend/src/app/servicios/page.tsx";
const PUBLIC_ROUTE_CONTROL_PATH = "frontend/src/components/public/PublicRouteControl.tsx";
const SPECIMEN_JOURNEY_COMPONENT_PATH =
  "frontend/src/components/public/SpecimenJourneySection.tsx";

// ─── PR #899: Secondary hero gradient + servicios card hover palette ─────────

test("servicios premium-card hover palette avoids legacy sky color classes", () => {
  const source = read(SERVICIOS_PAGE_PATH);

  assert.equal(source.includes("bg-sky-50"), false);
  assert.equal(source.includes("border-sky-300"), false);
  assert.equal(source.includes("hover:[&_.premium-card]:shadow-xl"), false);
});

// ─── PR #900: CTA interactions + FAQ chevron feedback ────────────────────────

test("footer FAQ chevron uses group-open:rotate-180 and group-open:text-vetneb-teal", () => {
  const source = read(FOOTER_PATH);

  assert.ok(source.includes("group-open:rotate-180"));
  assert.ok(source.includes("group-open:text-vetneb-teal"));
});

test("footer dark CTA uses border-white/25 and bg-white/14 not legacy /15 and /8 values", () => {
  const source = read(FOOTER_PATH);

  assert.ok(source.includes("border-white/25"));
  assert.ok(source.includes("bg-white/14"));
  assert.equal(source.includes("border-white/15"), false);
  assert.equal(source.includes("bg-white/8"), false);
});

// ─── PR #901: Subtle depth in flat public sections ────────────────────────────

test("home trust section uses public-evidence-band-light surface (PR-18)", () => {
  const source = read(HOME_PAGE_PATH);

  assert.ok(source.includes('className="public-evidence-band-light py-12 md:py-16"'));
  assert.equal(
    source.includes("bg-gradient-to-b from-white via-white to-vetneb-surface/40"),
    false,
  );
});

test("home final CTA section has diagnostic-field depth layer and z-10 content wrapper", () => {
  const source = read(HOME_PAGE_PATH);

  assert.ok(source.includes('className="diagnostic-field" data-tone="dark" aria-hidden="true"'));
  assert.ok(source.includes("container relative z-10"));
});

test("footer FAQ section uses bg-vetneb-surface-muted/40 depth background", () => {
  const source = read(FOOTER_PATH);

  assert.ok(source.includes("bg-vetneb-surface-muted/40"));
});

// ─── PR #902: Scroll reveal + process step depth ──────────────────────────────

test("home journey step circles have depth shadow and primary ring", () => {
  const source = read(SPECIMEN_JOURNEY_COMPONENT_PATH);

  assert.ok(source.includes("shadow-[0_6px_16px_hsl(var(--vetneb-navy)/0.22)]"));
  assert.ok(source.includes("ring-2 ring-primary/20"));
});

// ─── PR #903: Navbar depth + active route state ───────────────────────────────

test("navbar header uses bg-card/92 and backdrop-blur-sm not bg-card/96", () => {
  const source = read(NAVBAR_PATH);

  assert.ok(source.includes("bg-card/92"));
  assert.ok(source.includes("backdrop-blur-sm"));
  assert.equal(source.includes("bg-card/96"), false);
});

test("navbar desktop and mobile nav links pass activeClassName to PublicRouteControl", () => {
  const source = read(NAVBAR_PATH);

  assert.ok(source.includes('activeClassName="bg-accent/80 text-vetneb-ink shadow-sm"'));
});

test("navbar CTA controls carry no activeClassName — only nav link loops do", () => {
  const source = read(NAVBAR_PATH);

  const occurrences = (source.match(/activeClassName=/g) ?? []).length;

  assert.equal(
    occurrences,
    2,
    `activeClassName must appear exactly in desktop and mobile nav link loops (expected 2, got ${occurrences})`,
  );
});

test("PublicRouteControl imports usePathname and declares activeClassName prop", () => {
  const source = read(PUBLIC_ROUTE_CONTROL_PATH);

  assert.ok(source.includes("usePathname"));
  assert.ok(source.includes("activeClassName?: string;"));
});

test("PublicRouteControl emits aria-current=page when the route is active", () => {
  const source = read(PUBLIC_ROUTE_CONTROL_PATH);

  assert.ok(source.includes('aria-current={isRouteActive ? "page" : undefined}'));
});

test("TEST-GLOBAL-08 G06-P16 kills M-P04 when a later prop spread clears aria-current", () => {
  const source = read(PUBLIC_ROUTE_CONTROL_PATH);
  const ariaCurrent = (candidate: string) => {
    const PublicRouteControl = runModule(
      parseTsx(candidate, PUBLIC_ROUTE_CONTROL_PATH),
      {
        react: { useCallback: (callback: unknown) => callback, useEffect: () => undefined },
        "next/navigation": { usePathname: () => "/profesionales", useRouter: () => ({}) },
        "@/components/ui/button": { Button: () => null },
        "@/lib/utils": { cn: (...classes: unknown[]) => classes.filter(Boolean).join(" ") },
      },
      { React: { createElement: (type: unknown, props: Record<string, unknown>) => ({ type, props }) } },
    ).PublicRouteControl as (props: Record<string, unknown>) => { props: Record<string, unknown> };
    return PublicRouteControl({
      href: "/profesionales",
      children: "Profesionales",
      variant: "bare",
      activeClassName: "active",
    }).props["aria-current"];
  };

  assert.equal(ariaCurrent(source), "page");
  const mutant = source.replace(
    'aria-current={isRouteActive ? "page" : undefined}',
    'aria-current={isRouteActive ? "page" : undefined} {...{ "aria-current": undefined }}',
  );
  assert.notEqual(mutant, source, "M-P04 must be applicable");
  assert.equal(ariaCurrent(mutant), undefined, "M-P04 clears the active-route state");
});

test("PublicRouteControl active route logic: root exact-only, nested prefix-aware", () => {
  const source = read(PUBLIC_ROUTE_CONTROL_PATH);

  assert.ok(source.includes("activeClassName != null &&"));
  assert.ok(source.includes('href === "/" ? pathname === "/" :'));
  assert.ok(source.includes('pathname === href || pathname.startsWith(href + "/")'));
});
