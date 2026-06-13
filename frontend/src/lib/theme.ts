// Literals must stay in sync with frontend/public/theme-init.js (pre-paint init).
export const THEME_STORAGE_KEY = "vetneb-theme-mode";
export const NORMAL_THEME_MODE = "normal";
export const DARK_GRAY_THEME_MODE = "dark-gray";
export const NORMAL_THEME_COLOR = "#0c354e";
export const DARK_GRAY_THEME_COLOR = "#1c1f21";

export type ThemeMode =
  | typeof NORMAL_THEME_MODE
  | typeof DARK_GRAY_THEME_MODE;

export function applyThemeMode(theme: ThemeMode): void {
  document.documentElement.dataset.theme = theme;

  const themeColors = document.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  const themeColor = themeColors.item(0);
  if (themeColor) {
    themeColor.content =
      theme === DARK_GRAY_THEME_MODE
        ? DARK_GRAY_THEME_COLOR
        : NORMAL_THEME_COLOR;
  }

  for (let index = 1; index < themeColors.length; index += 1) {
    themeColors.item(index)?.remove();
  }
}
