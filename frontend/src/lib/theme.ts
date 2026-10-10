// Literals must stay in sync with frontend/public/theme-init.js (pre-paint init).
export const THEME_STORAGE_KEY = "vetneb-theme-mode";
export const NORMAL_THEME_MODE = "normal";
export const DARK_GRAY_THEME_MODE = "dark-gray";
export const NORMAL_THEME_COLOR = "#0c354e";
export const DARK_GRAY_THEME_COLOR = "#1c1f21";

// First 16 hex digits of the SHA-256 of frontend/public/theme-init.js. The
// script blocks the parser of every document, so its URL carries this content
// version and next.config.ts lets that exact URL be cached for good.
export const THEME_INIT_SCRIPT_PATH = "/theme-init.js";
export const THEME_INIT_SCRIPT_VERSION = "52962763805719be";
export const THEME_INIT_SCRIPT_SRC = `${THEME_INIT_SCRIPT_PATH}?v=${THEME_INIT_SCRIPT_VERSION}`;

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
