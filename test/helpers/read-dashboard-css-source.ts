import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const GLOBALS_CSS_PATH = "frontend/src/app/globals.css";

// Only dashboard CSS imports are inlined; other @import lines (e.g. tailwind)
// are ignored on purpose.
const DASHBOARD_IMPORT_RE =
  /@import\s+["']([^"']*\/styles\/dashboard\/[^"']+\.css)["']\s*;/g;

function readNormalized(absolutePath: string): string {
  return readFileSync(absolutePath, "utf8").replace(/\r\n/g, "\n");
}

/**
 * Returns the composed dashboard CSS source: globals.css followed by every
 * dashboard CSS file it @imports from ../styles/dashboard/*.css, concatenated
 * in import order.
 *
 * After PR-CSS-1 the dashboard rules live in dedicated files under
 * frontend/src/styles/dashboard/ and are pulled into globals.css via @import
 * (Tailwind v4 inlines them at build time). Text-based CSS contract tests must
 * read this composed source so selectors/sections resolve regardless of which
 * dashboard file they were extracted into.
 */
export function readDashboardCssSource(): string {
  const globalsAbsolute = resolve(process.cwd(), GLOBALS_CSS_PATH);
  const globals = readNormalized(globalsAbsolute);
  const globalsDir = dirname(globalsAbsolute);

  const parts: string[] = [globals];
  for (const match of globals.matchAll(DASHBOARD_IMPORT_RE)) {
    parts.push(readNormalized(resolve(globalsDir, match[1])));
  }
  return parts.join("\n");
}
