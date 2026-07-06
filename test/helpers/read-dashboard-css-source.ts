import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const GLOBALS_CSS_PATH = "frontend/src/app/globals.css";

// Match any @import "....css" so both globals.css's composition-root import
// ("../styles/dashboard/index.css") and index.css's relative module imports
// ("./navigation.css") are captured. Non-.css imports (e.g. "tailwindcss") are
// ignored; the resolved path is then filtered to styles/dashboard below so only
// dashboard CSS is inlined.
const CSS_IMPORT_RE = /@import\s+["']([^"']+\.css)["']\s*;/g;
const DASHBOARD_DIR_SEGMENT = "/styles/dashboard/";

function isDashboardCssPath(absolutePath: string): boolean {
  return absolutePath.replace(/\\/g, "/").includes(DASHBOARD_DIR_SEGMENT);
}

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
 *
 * After PR-CSS-1B globals.css imports a single composition root
 * (styles/dashboard/index.css) which in turn @imports every dashboard module.
 * Resolution is therefore recursive: any inlined dashboard file is itself
 * scanned for further dashboard @imports so the module rules resolve whether
 * globals.css imports them directly or through index.css.
 */
export function readDashboardCssSource(): string {
  const globalsAbsolute = resolve(process.cwd(), GLOBALS_CSS_PATH);

  const parts: string[] = [];
  const seen = new Set<string>();

  const inline = (absolutePath: string): void => {
    if (seen.has(absolutePath)) return;
    seen.add(absolutePath);
    const source = readNormalized(absolutePath);
    parts.push(source);
    const currentDir = dirname(absolutePath);
    for (const match of source.matchAll(CSS_IMPORT_RE)) {
      const importedAbsolute = resolve(currentDir, match[1]);
      if (isDashboardCssPath(importedAbsolute)) {
        inline(importedAbsolute);
      }
    }
  };

  inline(globalsAbsolute);
  return parts.join("\n");
}
