// Literals must stay in sync with the pre-paint init script published as
// frontend/public/theme-init.<version>.js.
export const THEME_STORAGE_KEY = "vetneb-theme-mode";
export const NORMAL_THEME_MODE = "normal";
export const DARK_GRAY_THEME_MODE = "dark-gray";
export const NORMAL_THEME_COLOR = "#0c354e";
export const DARK_GRAY_THEME_COLOR = "#1c1f21";

// First 16 hex digits of the SHA-256 of the pre-paint init script. The script
// blocks the parser of every document. The hash is part of the file name, so
// new bytes always get a new URL and next.config.ts lets that exact path be
// cached for good.
export const THEME_INIT_SCRIPT_VERSION = "52962763805719be";
export const THEME_INIT_SCRIPT_SRC = `/theme-init.${THEME_INIT_SCRIPT_VERSION}.js`;
// Documents rendered before the hash moved into the path load the script from
// this path with a `v=<version>` query.
export const THEME_INIT_LEGACY_SCRIPT_PATH = "/theme-init.js";

export type ThemeMode =
  | typeof NORMAL_THEME_MODE
  | typeof DARK_GRAY_THEME_MODE;

function themeColorForMode(theme: ThemeMode): string {
  return theme === DARK_GRAY_THEME_MODE
    ? DARK_GRAY_THEME_COLOR
    : NORMAL_THEME_COLOR;
}

export function applyThemeMode(theme: ThemeMode): void {
  document.documentElement.dataset.theme = theme;

  const themeColors = document.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  const themeColor = themeColors.item(0);
  if (themeColor) {
    themeColor.content = themeColorForMode(theme);
  }

  for (let index = 1; index < themeColors.length; index += 1) {
    const duplicate = themeColors.item(index);
    if (duplicate) {
      duplicate.dataset.vetnebThemeColorDuplicate = "true";
      duplicate.setAttribute("name", "theme-color-duplicate");
    }
  }
}
