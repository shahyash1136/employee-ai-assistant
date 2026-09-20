import { createContext, useContext } from "react";

export type Theme = "light" | "dark" | "system";

export interface ThemeContextValue {
  // What the user picked (may be "system").
  theme: Theme;
  // What is actually applied right now.
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

export const THEME_STORAGE_KEY = "employee-ai.theme";

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}
