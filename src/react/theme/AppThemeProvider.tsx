import { createContext, useContext, useEffect, useMemo, useState, forwardRef } from "react";
import {
  CssBaseline,
  useMediaQuery,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { ThemeProvider, createTheme } from "@mui/material/styles";

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

const CustomDialogTitle = forwardRef<HTMLDivElement, any>((props, ref) => {
  const { children, ...other } = props;

  const handleClose = (event: React.MouseEvent) => {
    const target = event.currentTarget as HTMLElement;
    const dialogRoot = target.closest(".MuiDialog-root");
    if (dialogRoot) {
      const escapeEvent = new KeyboardEvent("keydown", {
        key: "Escape",
        keyCode: 27,
        code: "Escape",
        bubbles: true,
        cancelable: true,
      });
      dialogRoot.dispatchEvent(escapeEvent);
    }
  };

  return (
    <div
      ref={ref}
      {...other}
      style={{
        position: "relative",
        paddingRight: "48px",
        ...(other.style || {}),
      }}
    >
      {children}
      <IconButton
        aria-label="close"
        onClick={handleClose}
        className="custom-close-button"
        sx={{
          position: "absolute",
          right: 16,
          top: 16,
          color: (theme) => theme.palette.grey[500],
          transition: "all 150ms ease",
          "&:hover": {
            transform: "scale(1.1)",
            color: "text.primary",
          },
        }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </div>
  );
});
CustomDialogTitle.displayName = "CustomDialogTitle";

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
            main: "#2563eb",
          },
          background: {
            default: resolvedMode === "dark" ? "#090d16" : "#f8fafc",
            paper: resolvedMode === "dark" ? "#111827" : "#ffffff",
          },
        },
        shape: {
          borderRadius: 8,
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",
              },
            },
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
          MuiPaper: {
            styleOverrides: {
              root: {
                transition: "background-color 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
              },
            },
          },
          MuiDialog: {
            defaultProps: {
              slotProps: {
                backdrop: {
                  sx: {
                    backdropFilter: "blur(6px)",
                    backgroundColor: (theme: any) =>
                      theme.palette.mode === "dark"
                        ? "rgba(0, 0, 0, 0.5)"
                        : "rgba(15, 23, 42, 0.2)",
                  },
                },
              },
            },
            styleOverrides: {
              paper: ({ theme, ownerState }: { theme: any; ownerState: any }) => ({
                borderRadius: "14px",
                border:
                  theme.palette.mode === "dark"
                    ? "1px solid rgba(255, 255, 255, 0.08)"
                    : "1px solid rgba(0, 0, 0, 0.08)",
                boxShadow:
                  theme.palette.mode === "dark"
                    ? "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)"
                    : "0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.02)",
                backgroundColor: theme.palette.background.paper,
                backgroundImage: "none",
                ...(!ownerState.onClose && {
                  "& .custom-close-button": {
                    display: "none !important",
                  },
                }),
              }),
            },
          },
          MuiDialogTitle: {
            defaultProps: {
              component: CustomDialogTitle,
            },
            styleOverrides: {
              root: {
                fontWeight: 700,
                fontSize: "1.125rem",
                padding: "20px 24px 8px 24px",
              },
            },
          },
          MuiDialogContent: {
            styleOverrides: {
              root: {
                padding: "8px 24px 16px 24px",
              },
            },
          },
          MuiDialogActions: {
            styleOverrides: {
              root: {
                padding: "8px 24px 20px 24px",
                "& .MuiButton-root": {
                  borderRadius: "8px",
                  fontWeight: 600,
                },
              },
            },
          },
          MuiLinearProgress: {
            styleOverrides: {
              root: {
                height: 3,
                backgroundColor: "transparent",
              },
              bar: {
                background: "linear-gradient(90deg, #2563eb 0%, #6366f1 100%)",
              },
            },
          },
          MuiAlert: {
            styleOverrides: {
              root: ({ theme }: { theme: any }) => ({
                borderRadius: "12px",
                border: theme.palette.mode === "dark"
                  ? "1px solid rgba(255, 255, 255, 0.08)"
                  : "1px solid rgba(0, 0, 0, 0.06)",
                boxShadow: theme.palette.mode === "dark"
                  ? "0 4px 18px rgba(0, 0, 0, 0.35)"
                  : "0 4px 18px rgba(0, 0, 0, 0.03)",
                fontSize: "0.875rem",
                alignItems: "center",
              }),
              standardSuccess: ({ theme }: { theme: any }) => ({
                backgroundColor: theme.palette.mode === "dark"
                  ? "rgba(16, 185, 129, 0.12)"
                  : "rgba(16, 185, 129, 0.06)",
                color: theme.palette.mode === "dark" ? "#34d399" : "#059669",
                "& .MuiAlert-icon": {
                  color: theme.palette.mode === "dark" ? "#34d399" : "#059669",
                },
              }),
              standardError: ({ theme }: { theme: any }) => ({
                backgroundColor: theme.palette.mode === "dark"
                  ? "rgba(239, 68, 68, 0.12)"
                  : "rgba(239, 68, 68, 0.06)",
                color: theme.palette.mode === "dark" ? "#f87171" : "#dc2626",
                "& .MuiAlert-icon": {
                  color: theme.palette.mode === "dark" ? "#f87171" : "#dc2626",
                },
              }),
              standardWarning: ({ theme }: { theme: any }) => ({
                backgroundColor: theme.palette.mode === "dark"
                  ? "rgba(245, 158, 11, 0.12)"
                  : "rgba(245, 158, 11, 0.06)",
                color: theme.palette.mode === "dark" ? "#fbbf24" : "#d97706",
                "& .MuiAlert-icon": {
                  color: theme.palette.mode === "dark" ? "#fbbf24" : "#d97706",
                },
              }),
              standardInfo: ({ theme }: { theme: any }) => ({
                backgroundColor: theme.palette.mode === "dark"
                  ? "rgba(37, 99, 235, 0.12)"
                  : "rgba(37, 99, 235, 0.06)",
                color: theme.palette.mode === "dark" ? "#60a5fa" : "#2563eb",
                "& .MuiAlert-icon": {
                  color: theme.palette.mode === "dark" ? "#60a5fa" : "#2563eb",
                },
              }),
            },
          },
          MuiSnackbar: {
            styleOverrides: {
              root: {
                "& .MuiPaper-root": {
                  borderRadius: "12px",
                },
              },
            },
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

  useEffect(() => {
    document.documentElement.dataset.themeMode = resolvedMode;
    document.documentElement.dataset.agThemeMode = resolvedMode;
    document.documentElement.style.colorScheme = resolvedMode;
  }, [resolvedMode]);

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
