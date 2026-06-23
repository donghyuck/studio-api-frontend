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
            main: "#cc785c", // Claude Coral
            dark: "#a9583e",
            contrastText: "#ffffff",
          },
          background: {
            default: resolvedMode === "dark" ? "#181715" : "#faf9f5", // Cream Canvas / Navy Dark
            paper: resolvedMode === "dark" ? "#1f1e1b" : "#efe9de",  // Surface Dark Soft / Surface Card Cream
          },
          text: {
            primary: resolvedMode === "dark" ? "#faf9f5" : "#141413", // Ink / On-Dark
            secondary: resolvedMode === "dark" ? "#a09d96" : "#6c6a64", // Muted
          },
        },
        shape: {
          borderRadius: 8,
        },
        typography: {
          fontFamily: '"Inter", "-apple-system", BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          h1: {
            fontFamily: '"Cormorant Garamond", "Garamond", "Times New Roman", serif',
            fontWeight: 400,
            letterSpacing: "-1px",
          },
          h2: {
            fontFamily: '"Cormorant Garamond", "Garamond", "Times New Roman", serif',
            fontWeight: 400,
            letterSpacing: "-0.5px",
          },
          h3: {
            fontFamily: '"Cormorant Garamond", "Garamond", "Times New Roman", serif',
            fontWeight: 400,
            letterSpacing: "-0.3px",
          },
          h4: {
            fontFamily: '"Cormorant Garamond", "Garamond", "Times New Roman", serif',
            fontWeight: 400,
          },
          h5: {
            fontFamily: '"Cormorant Garamond", "Garamond", "Times New Roman", serif',
            fontWeight: 400,
          },
          h6: {
            fontFamily: '"Cormorant Garamond", "Garamond", "Times New Roman", serif',
            fontWeight: 400,
          },
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                borderRadius: "8px", // rounded.md
                textTransform: "none",
                fontWeight: 500,
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
                borderRadius: "12px", // rounded.lg
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
                        ? "rgba(0, 0, 0, 0.6)"
                        : "rgba(20, 20, 19, 0.25)",
                  },
                },
              },
            },
            styleOverrides: {
              paper: ({ theme, ownerState }: { theme: any; ownerState: any }) => ({
                borderRadius: "12px", // rounded.lg
                border:
                  theme.palette.mode === "dark"
                    ? "1px solid #efe9de"
                    : "1px solid #e6dfd8", // Hairline border
                boxShadow: "0 20px 25px -5px rgba(20, 20, 19, 0.1)",
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
                fontFamily: '"Cormorant Garamond", "Garamond", "Times New Roman", serif',
                fontWeight: 500,
                fontSize: "1.5rem",
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
                background: "linear-gradient(90deg, #cc785c 0%, #efe9de 100%)", // Coral to soft cream gradient
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
                  ? "rgba(93, 184, 114, 0.12)"
                  : "rgba(93, 184, 114, 0.06)",
                color: theme.palette.mode === "dark" ? "#5db872" : "#059669",
                "& .MuiAlert-icon": {
                  color: theme.palette.mode === "dark" ? "#5db872" : "#059669",
                },
              }),
              standardError: ({ theme }: { theme: any }) => ({
                backgroundColor: theme.palette.mode === "dark"
                  ? "rgba(198, 69, 69, 0.12)"
                  : "rgba(198, 69, 69, 0.06)",
                color: theme.palette.mode === "dark" ? "#c64545" : "#dc2626",
                "& .MuiAlert-icon": {
                  color: theme.palette.mode === "dark" ? "#c64545" : "#dc2626",
                },
              }),
              standardWarning: ({ theme }: { theme: any }) => ({
                backgroundColor: theme.palette.mode === "dark"
                  ? "rgba(232, 165, 90, 0.12)"
                  : "rgba(232, 165, 90, 0.06)",
                color: theme.palette.mode === "dark" ? "#e8a55a" : "#d97706",
                "& .MuiAlert-icon": {
                  color: theme.palette.mode === "dark" ? "#e8a55a" : "#d97706",
                },
              }),
              standardInfo: ({ theme }: { theme: any }) => ({
                backgroundColor: theme.palette.mode === "dark"
                  ? "rgba(204, 120, 92, 0.12)"
                  : "rgba(204, 120, 92, 0.06)",
                color: theme.palette.mode === "dark" ? "#cc785c" : "#cc785c",
                "& .MuiAlert-icon": {
                  color: theme.palette.mode === "dark" ? "#cc785c" : "#cc785c",
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
