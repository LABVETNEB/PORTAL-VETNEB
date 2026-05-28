import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const FRONTEND_APP_ROOT = "frontend/src/app";
const FRONTEND_COMPONENTS_ROOT = "frontend/src/components";
const NAVBAR_PATH = "frontend/src/components/layout/Navbar.tsx";
const HOME_PATH = "frontend/src/app/page.tsx";
const PUBLIC_ACTION_PATH = "frontend/src/components/public/PublicAction.tsx";
const OFFLINE_ACTIONS_PATH = "frontend/src/components/pwa/OfflineActions.tsx";
const DASHBOARD_SIDEBAR_PATH =
  "frontend/src/components/dashboard/DashboardSidebarFrame.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function collectTsLikeFiles(relativeRoot: string): string[] {
  const absoluteRoot = resolve(process.cwd(), relativeRoot);
  const files: string[] = [];

  function walk(currentPath: string) {
    for (const entry of readdirSync(currentPath)) {
      const fullPath = `${currentPath}/${entry}`;
      const info = statSync(fullPath);

      if (info.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
        files.push(fullPath.replace(resolve(process.cwd(), "").replace(/\\/g, "/") + "/", ""));
      }
    }
  }

  walk(absoluteRoot.replace(/\\/g, "/"));

  return files;
}

const appAndComponentFiles = [
  ...collectTsLikeFiles(FRONTEND_APP_ROOT),
  ...collectTsLikeFiles(FRONTEND_COMPONENTS_ROOT),
];

test("no internal visual navigation uses Button asChild + Link", () => {
  for (const file of appAndComponentFiles) {
    const source = read(file);

    if (file.endsWith("frontend/src/components/ui/button.tsx")) {
      continue;
    }

    assert.equal(
      source.includes("Button asChild"),
      false,
      `${file} should not use Button asChild for navigation`,
    );
    assert.equal(source.includes("<Link"), false, `${file} should not render <Link>`);
  }
});

test("navbar primary navigation avoids Link and uses route controls", () => {
  const source = read(NAVBAR_PATH);

  assert.equal(source.includes("<Link"), false);
  assert.ok(source.includes('const navLinks = ['));
  assert.ok(source.includes('aria-label="Navegación principal"'));
  assert.ok(source.includes("router.push(link.href)"));
});

test("home hero CTAs avoid Link and use PublicRouteControl", () => {
  const source = read(HOME_PATH);

  assert.equal(source.includes("<Link"), false);
  assert.ok(source.includes("<PublicRouteControl"));
  assert.ok(source.includes("Acceder a informes y trazabilidad"));
  assert.ok(source.includes("Consultar informes 24 hs"));
  assert.ok(source.includes("href={ROUTES.login}"));
  assert.ok(source.includes("href={ROUTES.particulares}"));
});

test("PublicAction internal href flow uses route controls instead of Link", () => {
  const source = read(PUBLIC_ACTION_PATH);

  assert.equal(source.includes("<Link"), false);
  assert.ok(source.includes("PublicRouteControl"));
  assert.ok(source.includes("PublicExternalControl"));
});

test("OfflineActions internal CTA avoids Link", () => {
  const source = read(OFFLINE_ACTIONS_PATH);

  assert.equal(source.includes("<Link"), false);
  assert.ok(source.includes("<PublicRouteControl"));
  assert.ok(source.includes("href={ROUTES.home}"));
});

test("DashboardSidebarFrame visual nav avoids Link", () => {
  const source = read(DASHBOARD_SIDEBAR_PATH);

  assert.equal(source.includes("<Link"), false);
  assert.ok(source.includes("<PublicRouteControl"));
  assert.ok(source.includes("href={item.href}"));
  assert.ok(source.includes("href={child.href}"));
});

test("remaining anchors stay in explicit allowlist surfaces only", () => {
  const expectedAnchorFiles = [
    "frontend/src/app/page.tsx",
    "frontend/src/components/layout/Footer.tsx",
    "frontend/src/components/public/ContactoContent.tsx",
    "frontend/src/components/public/ProfesionalesSearchContent.tsx",
  ];

  const actualAnchorFiles = appAndComponentFiles.filter((file) =>
    /<a\b/.test(read(file)),
  );

  assert.deepEqual(actualAnchorFiles.sort(), expectedAnchorFiles.sort());

  const home = read("frontend/src/app/page.tsx");
  assert.ok(home.includes('href="https://wa.me/5493534138946"'));

  const footer = read("frontend/src/components/layout/Footer.tsx");
  assert.ok(footer.includes('href="https://wa.me/5493534138946"'));
  assert.ok(footer.includes('href="mailto:lab.vetneb@gmail.com"'));

  const contacto = read("frontend/src/components/public/ContactoContent.tsx");
  assert.ok(contacto.includes("href={info.href}"));
  assert.ok(contacto.includes('info.href.startsWith("http")'));

  const profesionales = read(
    "frontend/src/components/public/ProfesionalesSearchContent.tsx",
  );
  assert.ok(profesionales.includes("href={`mailto:${professional.email}`}"));
  assert.ok(
    profesionales.includes(
      "href={`https://wa.me/549${professional.phone.replace(/\\D/g, \"\")}`}",
    ),
  );
  assert.ok(profesionales.includes("href={professional.mapLink}"));
  assert.ok(profesionales.includes('target="_blank"'));
});

test("navigation controls avoid anti-preview hacks", () => {
  const guardedFiles = [
    "frontend/src/components/public/PublicRouteControl.tsx",
    "frontend/src/components/public/PublicAction.tsx",
    "frontend/src/components/public/RenderPrimitives.tsx",
    "frontend/src/components/layout/Navbar.tsx",
    "frontend/src/components/layout/Footer.tsx",
    "frontend/src/components/pwa/OfflineActions.tsx",
    "frontend/src/components/dashboard/DashboardSidebarFrame.tsx",
    "frontend/src/components/dashboard/DashboardTopbar.tsx",
    "frontend/src/app/page.tsx",
    "frontend/src/app/servicios/page.tsx",
  ];

  const forbiddenPatterns = [
    "preventDefault",
    "onPointerDown",
    "onTouchStart",
    "-webkit-touch-callout",
    "user-select: none",
  ];

  for (const file of guardedFiles) {
    const source = read(file);

    for (const pattern of forbiddenPatterns) {
      assert.equal(
        source.includes(pattern),
        false,
        `${file} should not contain ${pattern}`,
      );
    }
  }
});
