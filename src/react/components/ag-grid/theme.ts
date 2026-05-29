import type { Theme as MuiTheme } from "@mui/material/styles";
import { themeMaterial } from "ag-grid-community";

export function createAgGridTheme(theme: MuiTheme) {
  const dark = theme.palette.mode === "dark";

  return themeMaterial.withParams({
    primaryColor: theme.palette.primary.main,
    backgroundColor: dark ? "#111827" : theme.palette.background.paper,
    foregroundColor: dark ? "#e5e7eb" : theme.palette.text.primary,
    headerBackgroundColor: dark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.01)",
    headerTextColor: dark ? "#e5e7eb" : theme.palette.text.primary,
    borderColor: dark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)",
    rowHoverColor: dark ? "rgba(37, 99, 235, 0.08)" : "rgba(37, 99, 235, 0.04)",
    selectedRowBackgroundColor: dark ? "rgba(37, 99, 235, 0.15)" : "rgba(37, 99, 235, 0.06)",
    wrapperBorderRadius: 10,
    borderRadius: 10,
    fontSize: 13.5,
    headerFontWeight: 600,
  });
}
