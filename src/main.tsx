import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import { App } from "@/react/App";

const container = document.getElementById("app");

if (!container) {
  throw new Error("Root container '#app' was not found.");
}

ModuleRegistry.registerModules([AllCommunityModule]);
document.documentElement.lang = "ko";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1565c0",
    },
    background: {
      default: "#f5f7fb",
    },
  },
});

createRoot(container).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>
);
