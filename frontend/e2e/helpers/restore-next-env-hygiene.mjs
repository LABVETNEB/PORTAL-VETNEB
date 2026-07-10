import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DEV_ROUTES_REFERENCE = "./.next/dev/types/routes.d.ts";
export const PRODUCTION_ROUTES_REFERENCE = "./.next/types/routes.d.ts";

const FRONTEND_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_NEXT_ENV_PATH = join(FRONTEND_DIR, "next-env.d.ts");

export function restoreNextEnvSource(source) {
  return source.split(DEV_ROUTES_REFERENCE).join(PRODUCTION_ROUTES_REFERENCE);
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
