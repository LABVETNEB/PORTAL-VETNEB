"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import {
  DARK_GRAY_THEME_MODE,
  NORMAL_THEME_MODE,
  THEME_STORAGE_KEY,
  type ThemeMode,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeModeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<ThemeMode>(NORMAL_THEME_MODE);

  useEffect(() => {
    if (document.documentElement.dataset.theme === DARK_GRAY_THEME_MODE) {
      setTheme(DARK_GRAY_THEME_MODE);
    }
  }, []);

  const isDarkGray = theme === DARK_GRAY_THEME_MODE;

  function toggleTheme() {
    const next: ThemeMode = isDarkGray
      ? NORMAL_THEME_MODE
      : DARK_GRAY_THEME_MODE;
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Sin persistencia disponible: el tema igual aplica en esta vista.
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDarkGray}
      aria-label={
        isDarkGray ? "Cambiar a modo normal" : "Cambiar a modo oscuro"
      }
      title={isDarkGray ? "Modo normal" : "Modo oscuro"}
      data-theme-toggle="true"
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-card/95 text-vetneb-ink/80 shadow-[0_1px_2px_rgba(15,45,62,0.05)] transition-[background-color,border-color,box-shadow,color] duration-150 hover:border-vetneb-teal/45 hover:bg-accent/70 hover:text-vetneb-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2",
        className,
      )}
    >
      {isDarkGray ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
