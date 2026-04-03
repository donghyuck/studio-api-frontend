import { AppBar, Toolbar, Typography } from "@mui/material";

interface Props {
  children?: React.ReactNode;
}

export function AppShellHeader({ children }: Props) {
  return (
    <AppBar position="static" color="inherit" elevation={1}>
      <Toolbar sx={{ justifyContent: "space-between" }}>
        <Typography variant="h6" color="text.primary">
          Studio One Platform
        </Typography>
        {children}
      </Toolbar>
    </AppBar>
  );
}
