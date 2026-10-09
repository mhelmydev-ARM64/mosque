import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "auto";
export type FontSize = "sm" | "md" | "lg" | "xl";
export type PrimaryColor = "green" | "blue" | "indigo" | "violet" | "rose" | "orange";

export interface AppearanceSettings {
  theme: ThemeMode;
  fontSize: FontSize;
  primary: PrimaryColor;
}

const STORAGE_KEY = "appearance.v1";

const DEFAULTS: AppearanceSettings = { theme: "auto", fontSize: "md", primary: "green" };

export const THEME_LABELS: Record<ThemeMode, string> = {
  light: "فاتح",
  dark: "داكن",
  auto: "تلقائي حسب الجهاز",
};

export const FONT_LABELS: Record<FontSize, string> = {
  sm: "صغير",
  md: "متوسط",
  lg: "كبير",
  xl: "كبير جدًا",
};

export const PRIMARY_LABELS: Record<PrimaryColor, string> = {
  green: "أخضر",
  blue: "أزرق",
  indigo: "نيلي",
  violet: "بنفسجي",
  rose: "وردي",
  orange: "برتقالي",
};

function load(): AppearanceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AppearanceSettings>;
    return {
      theme: parsed.theme === "light" || parsed.theme === "dark" || parsed.theme === "auto" ? parsed.theme : DEFAULTS.theme,
      fontSize: parsed.fontSize && parsed.fontSize in FONT_LABELS ? parsed.fontSize : DEFAULTS.fontSize,
      primary: parsed.primary && parsed.primary in PRIMARY_LABELS ? parsed.primary : DEFAULTS.primary,
    };
  } catch {
    return DEFAULTS;
  }
}

interface AppearanceContextValue extends AppearanceSettings {
  resolvedTheme: "light" | "dark";
  setAppearance: (patch: Partial<AppearanceSettings>) => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppearanceSettings>(load);
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme: "light" | "dark" = settings.theme === "auto" ? (systemDark ? "dark" : "light") : settings.theme;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolvedTheme);
    root.setAttribute("data-fontsize", settings.fontSize);
    root.setAttribute("data-primary", settings.primary);
    // شريط المتصفح يتبع لون الثيم الحي لا قيمة مكتوبة يدويًا
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const chrome = getComputedStyle(root).getPropertyValue("--surface").trim();
      if (chrome) meta.setAttribute("content", chrome);
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* التخزين غير متاح */
    }
  }, [settings, resolvedTheme]);

  const setAppearance = useCallback((patch: Partial<AppearanceSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo(
    () => ({ ...settings, resolvedTheme, setAppearance }),
    [settings, resolvedTheme, setAppearance]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance outside provider");
  return ctx;
}
