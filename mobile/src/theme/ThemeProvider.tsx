import { createContext, useContext, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { createDashboardStyles } from "../components/dashboard/styles";
import { createUIStyles } from "../components/ui.styles";
import { darkColors, lightColors, type ThemeColors } from "./colors";

function createTheme(colors: ThemeColors, isDark: boolean) {
  return {
    colors,
    isDark,
    s: createUIStyles(colors),
    styles: createDashboardStyles(colors),
  };
}

// Create style sheets once, rather than on every render or clock tick.
const themes = {
  light: createTheme(lightColors, false),
  dark: createTheme(darkColors, true),
};
const ThemeContext = createContext<ReturnType<typeof createTheme> | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? themes.dark : themes.light;
  return <ThemeContext value={theme}>{children}</ThemeContext>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme must be used inside ThemeProvider.");
  return theme;
}
