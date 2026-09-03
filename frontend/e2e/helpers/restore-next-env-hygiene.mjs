import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEV_ROUTES_REFERENCE = "./.next/dev/types/routes.d.ts";
export const PRODUCTION_ROUTES_REFERENCE = "./.next/types/routes.d.ts";
// Next.js >= 16.3 appends this dev-only import. It has no counterpart in the
// committed file, so it is dropped instead of rewritten.
export const DEV_ROOT_PARAMS_REFERENCE = "./.next/dev/types/root-params.d.ts";

const FRONTEND_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_NEXT_ENV_PATH = join(FRONTEND_DIR, "next-env.d.ts");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Anchored to a whole line and to this exact specifier: never a generic
// ".next/dev/**" sweep, which would silently absorb future regressions.
const DEV_ROOT_PARAMS_IMPORT = new RegExp(
  `^[ \\t]*import[ \\t]+(["'])${escapeRegExp(DEV_ROOT_PARAMS_REFERENCE)}\\1[ \\t]*;?[ \\t]*\\r?\\n?`,
  "gm",
);

export function restoreNextEnvSource(source) {
  return source
    .split(DEV_ROUTES_REFERENCE)
    .join(PRODUCTION_ROUTES_REFERENCE)
    .replace(DEV_ROOT_PARAMS_IMPORT, "");
}

export async function restoreNextEnvHygiene({
  nextEnvPath = DEFAULT_NEXT_ENV_PATH,
} = {}) {
  if (!existsSync(nextEnvPath)) {
    return;
  }

  const source = readFileSync(nextEnvPath, "utf8");
  const restored = restoreNextEnvSource(source);

  if (restored !== source) {
    writeFileSync(nextEnvPath, restored, "utf8");
  }
}

export default restoreNextEnvHygiene;

const invokedUrl = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";

if (import.meta.url === invokedUrl) {
  await restoreNextEnvHygiene();
}
