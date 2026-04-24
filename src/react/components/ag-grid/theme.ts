import type { Theme as MuiTheme } from "@mui/material/styles";
import { themeMaterial } from "ag-grid-community";

export function createAgGridTheme(theme: MuiTheme) {
  const dark = theme.palette.mode === "dark";

  return themeMaterial.withParams({
    primaryColor: theme.palette.primary.main,
    backgroundColor: dark ? "#1f2836" : theme.palette.background.paper,
    foregroundColor: dark ? "#e5e7eb" : theme.palette.text.primary,
    headerBackgroundColor: dark ? "#1f2836" : theme.palette.grey[50],
    headerTextColor: dark ? "#e5e7eb" : theme.palette.text.primary,
    borderColor: dark ? "rgba(255, 255, 255, 0.16)" : theme.palette.divider,
    rowHoverColor: dark ? "rgba(96, 165, 250, 0.14)" : "rgba(21, 101, 192, 0.06)",
    selectedRowBackgroundColor: dark ? "rgba(96, 165, 250, 0.18)" : "rgba(21, 101, 192, 0.10)",
    wrapperBorderRadius: 8,
    borderRadius: 8,
    fontSize: 14,
    headerFontWeight: 400,
  });
}
