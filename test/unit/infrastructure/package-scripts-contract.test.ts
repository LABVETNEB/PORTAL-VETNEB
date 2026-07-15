import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

type PackageJson = {
  name: string;
  version?: string;
  private?: boolean;
  type?: string;
  packageManager?: string;
  scripts: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function readPackage(relativePath: string): PackageJson {
  return JSON.parse(readFileSync(resolve(process.cwd(), relativePath), "utf8")) as PackageJson;
}

test("root package keeps backend identity package manager and module mode", () => {
  const pkg = readPackage("package.json");

  assert.equal(pkg.name, "portal-vetneb-backend");
  assert.equal(pkg.version, "2.1.0");
  assert.equal(pkg.private, true);
  assert.equal(pkg.type, "module");
  assert.equal(pkg.packageManager, "pnpm@11.13.0");
});

test("root package keeps backend build validation and test scripts", () => {
  const pkg = readPackage("package.json");

  assert.equal(pkg.scripts.dev, "tsx server/index.ts");
  assert.equal(
    pkg.scripts.build,
    "esbuild server/index.ts --bundle --platform=node --format=esm --packages=external --outfile=dist/index.js",
  );
  assert.equal(pkg.scripts.start, "node dist/index.js");
  assert.equal(pkg.scripts.typecheck, "tsc --noEmit");
  assert.equal(pkg.scripts["typecheck:test"], "tsc -p ./test/tsconfig.json --noEmit");
  assert.equal(
    pkg.scripts.test,
    "node --experimental-strip-types --experimental-specifier-resolution=node --test test/**/*.test.ts",
  );
  assert.equal(
    pkg.scripts["validate:local"],
    "pnpm typecheck && pnpm typecheck:test && pnpm test && pnpm build",
  );
});

test("root package keeps database and smoke scripts", () => {
  const pkg = readPackage("package.json");

  assert.equal(pkg.scripts["db:generate"], "drizzle-kit generate");
  assert.equal(pkg.scripts["db:migrate"], "drizzle-kit migrate");
  assert.equal(pkg.scripts["smoke:test"], "node scripts/smoke/smoke-test.mjs");
  assert.equal(pkg.scripts["smoke:upload"], "node scripts/smoke/smoke-upload.mjs");
});

test("root package keeps backend runtime dependency surface", () => {
  const pkg = readPackage("package.json");
  const dependencies = pkg.dependencies ?? {};

  assert.ok(dependencies.fastify);
  assert.ok(dependencies.zod);
  assert.ok(dependencies["@supabase/supabase-js"]);
  assert.ok(dependencies["drizzle-orm"]);
  assert.ok(dependencies.postgres);
  assert.ok(dependencies.argon2);
  assert.ok(dependencies.multer);
  assert.ok(dependencies.nodemailer);
  assert.ok(dependencies.dotenv);
});

test("root package keeps backend development dependency surface", () => {
  const pkg = readPackage("package.json");
  const devDependencies = pkg.devDependencies ?? {};

  assert.ok(devDependencies.typescript);
  assert.ok(devDependencies.tsx);
  assert.ok(devDependencies.esbuild);
  assert.ok(devDependencies["drizzle-kit"]);
  assert.ok(devDependencies["@types/node"]);
  assert.ok(devDependencies["@types/multer"]);
  assert.ok(devDependencies["@types/nodemailer"]);
});

test("frontend package keeps identity and Next scripts", () => {
  const pkg = readPackage("frontend/package.json");

  assert.equal(pkg.name, "portal-vetneb-frontend");
  assert.equal(pkg.version, "1.0.0");
  assert.equal(pkg.private, true);
  assert.equal(pkg.scripts.dev, "next dev");
  assert.equal(pkg.scripts.build, "next build");
  assert.equal(pkg.scripts.start, "next start");
  assert.equal(pkg.scripts.lint, "eslint .");
  assert.equal(pkg.scripts.typecheck, "tsc --noEmit");
});

test("frontend package keeps Playwright script surface delegated through the E2E catalog runner", () => {
  const pkg = readPackage("frontend/package.json");

  assert.equal(pkg.scripts.e2e, "node e2e/scripts/run-cohort.mjs full");
  assert.equal(pkg.scripts["e2e:ui"], "playwright test --ui");
  assert.equal(pkg.scripts["e2e:report"], "playwright show-report");
  assert.equal(pkg.scripts["e2e:full"], "node e2e/scripts/run-cohort.mjs full");
  assert.equal(pkg.scripts["e2e:ci"], "node e2e/scripts/run-cohort.mjs ci");
  assert.equal(pkg.scripts["e2e:smoke"], "node e2e/scripts/run-cohort.mjs smoke");
  assert.equal(pkg.scripts["e2e:admin-mobile"], "node e2e/scripts/run-cohort.mjs admin-mobile");
  assert.equal(pkg.scripts["e2e:visual-contract"], "node e2e/scripts/run-cohort.mjs visual-contract");
  assert.equal(pkg.scripts["e2e:public-clinic"], "node e2e/scripts/run-cohort.mjs public-clinic");
});

test("frontend package keeps runtime dependency surface", () => {
  const pkg = readPackage("frontend/package.json");
  const dependencies = pkg.dependencies ?? {};

  assert.ok(dependencies.next);
  assert.ok(dependencies.react);
  assert.ok(dependencies["react-dom"]);
  assert.ok(dependencies.zod);
  assert.ok(dependencies["class-variance-authority"]);
  assert.ok(dependencies.clsx);
  assert.ok(dependencies["tailwind-merge"]);
  assert.ok(dependencies["lucide-react"]);
});

test("frontend package keeps active Radix UI dependency surface", () => {
  const pkg = readPackage("frontend/package.json");
  const dependencies = pkg.dependencies ?? {};

  assert.ok(dependencies["@radix-ui/react-dialog"]);
  assert.ok(dependencies["@radix-ui/react-separator"]);
  assert.ok(dependencies["@radix-ui/react-slot"]);
  assert.ok(dependencies["@radix-ui/react-toast"]);
  assert.ok(dependencies["@radix-ui/react-tooltip"]);
});

test("frontend package keeps development dependency surface", () => {
  const pkg = readPackage("frontend/package.json");
  const devDependencies = pkg.devDependencies ?? {};

  assert.ok(devDependencies.typescript);
  assert.ok(devDependencies.eslint);
  assert.ok(devDependencies["eslint-config-next"]);
  assert.ok(devDependencies["@playwright/test"]);
  assert.ok(devDependencies["@types/node"]);
  assert.ok(devDependencies["@types/react"]);
  assert.ok(devDependencies["@types/react-dom"]);
  assert.ok(devDependencies.tailwindcss);
  assert.ok(devDependencies["@tailwindcss/postcss"]);
  assert.ok(devDependencies.postcss);
});
