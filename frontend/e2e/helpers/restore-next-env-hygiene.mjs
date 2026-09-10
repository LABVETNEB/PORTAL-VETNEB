import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEV_ROUTES_REFERENCE = "./.next/dev/types/routes.d.ts";
export const PRODUCTION_ROUTES_REFERENCE = "./.next/types/routes.d.ts";
// Next.js >= 16.3 appends this dev-only import whenever the app uses root
// params. The committed file now has a production counterpart (synced from
// `next build` codegen), so it is rewritten to that counterpart, exactly like
// the routes reference above — never dropped, which would leave next-env.d.ts
// behind the tracked baseline and the source-hygiene gate red on a file no
// commit touched.
export const DEV_ROOT_PARAMS_REFERENCE = "./.next/dev/types/root-params.d.ts";
export const PRODUCTION_ROOT_PARAMS_REFERENCE = "./.next/types/root-params.d.ts";

const FRONTEND_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_NEXT_ENV_PATH = join(FRONTEND_DIR, "next-env.d.ts");

export function restoreNextEnvSource(source) {
  return source
    .split(DEV_ROUTES_REFERENCE)
    .join(PRODUCTION_ROUTES_REFERENCE)
    .split(DEV_ROOT_PARAMS_REFERENCE)
    .join(PRODUCTION_ROOT_PARAMS_REFERENCE);
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
