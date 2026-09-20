import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  THEME_STORAGE_KEY,
  ThemeContext,
  type Theme,
} from "@/hooks/use-theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    /* storage blocked: fall back to following the OS */
  }
  return "system";
}

// Subscribes to the OS colour-scheme so "System" tracks it live.
function subscribeToSystem(callback: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const getSystemDark = () => window.matchMedia(DARK_QUERY).matches;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const systemDark = useSyncExternalStore(subscribeToSystem, getSystemDark);

  const resolvedTheme =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  // The class on <html> is what shadcn's `.dark` tokens key off. index.html
  // sets it before first paint; this keeps it in sync afterwards.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* choice just won't persist */
    }
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
