import type { Theme as MuiTheme } from "@mui/material/styles";
import { themeMaterial } from "ag-grid-community";

export function createAgGridTheme(theme: MuiTheme) {
  const dark = theme.palette.mode === "dark";

  return themeMaterial.withParams({
    primaryColor: theme.palette.primary.main,
    backgroundColor: theme.palette.background.paper,
    foregroundColor: theme.palette.text.primary,
    headerBackgroundColor: dark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.015)",
    headerTextColor: theme.palette.text.primary,
    borderColor: dark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
    rowHoverColor: dark ? "rgba(139, 92, 246, 0.08)" : "rgba(139, 92, 246, 0.04)",
    selectedRowBackgroundColor: dark ? "rgba(139, 92, 246, 0.15)" : "rgba(139, 92, 246, 0.08)",
    wrapperBorderRadius: 10,
    borderRadius: 10,
    fontSize: 13.5,
    headerFontWeight: 600,
  });
}
