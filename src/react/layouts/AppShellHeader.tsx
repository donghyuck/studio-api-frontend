import { AppBar, Box, Toolbar, Typography } from "@mui/material";

interface Props {
  children?: React.ReactNode;
  leading?: React.ReactNode;
}

export function AppShellHeader({ children, leading }: Props) {
  return (
    <AppBar position="static" color="inherit" elevation={1}>
      <Toolbar sx={{ justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {leading}
          <Typography variant="h6" color="text.primary">
            Studio One Platform
          </Typography>
        </Box>
        {children}
      </Toolbar>
    </AppBar>
  );
}
