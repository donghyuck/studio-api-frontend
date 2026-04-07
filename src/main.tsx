import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import { App } from "@/react/App";
import { AppQueryProvider } from "@/react/query/provider";
import { AppThemeProvider } from "@/react/theme/AppThemeProvider";

const container = document.getElementById("app");

if (!container) {
  throw new Error("Root container '#app' was not found.");
}

ModuleRegistry.registerModules([AllCommunityModule]);
document.documentElement.lang = "ko";

createRoot(container).render(
  <StrictMode>
    <AppQueryProvider>
      <AppThemeProvider>
        <App />
      </AppThemeProvider>
    </AppQueryProvider>
  </StrictMode>
);
