import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  CssBaseline,
  ThemeProvider,
  createTheme,
  useMediaQuery,
} from "@mui/material";

const THEME_MODE_KEY = "theme_mode";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeModeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolvedMode: "light" | "dark";
}

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const saved = window.localStorage.getItem(THEME_MODE_KEY);
  return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);
  const resolvedMode = mode === "system" ? (prefersDark ? "dark" : "light") : mode;

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: resolvedMode,
          primary: {
            main: "#1565c0",
          },
          background: {
            default: resolvedMode === "dark" ? "#0f172a" : "#f5f7fb",
            paper: resolvedMode === "dark" ? "#111827" : "#ffffff",
          },
        },
        components: {
          MuiButton: {
            variants: [
              {
                props: { variant: "outlined", color: "inherit" },
                style: {
                  color: "rgba(148, 163, 184, 0.95)",
                  borderColor: "rgba(148, 163, 184, 0.45)",
                  backgroundColor: "rgba(148, 163, 184, 0.10)",
                },
              },
            ],
          },
        },
      }),
    [resolvedMode]
  );

  function setMode(nextMode: ThemeMode) {
    setModeState(nextMode);
    window.localStorage.setItem(THEME_MODE_KEY, nextMode);
  }

  useEffect(() => {
    window.localStorage.setItem(THEME_MODE_KEY, mode);
  }, [mode]);

  const value = useMemo(
    () => ({ mode, setMode, resolvedMode }),
    [mode, resolvedMode]
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within AppThemeProvider");
  }
  return context;
}
