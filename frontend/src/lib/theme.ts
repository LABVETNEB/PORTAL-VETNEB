// Literals must stay in sync with frontend/public/theme-init.js (pre-paint init).
export const THEME_STORAGE_KEY = "vetneb-theme-mode";
export const NORMAL_THEME_MODE = "normal";
export const DARK_GRAY_THEME_MODE = "dark-gray";

export type ThemeMode =
  | typeof NORMAL_THEME_MODE
  | typeof DARK_GRAY_THEME_MODE;
