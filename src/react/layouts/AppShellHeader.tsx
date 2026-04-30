import { AppBar, Box, Toolbar, Typography } from "@mui/material";

interface Props {
  children?: React.ReactNode;
  leading?: React.ReactNode;
}

export function AppShellHeader({ children, leading }: Props) {
  return (
    <AppBar position="static" color="inherit" elevation={0}>
      <Toolbar
        sx={{
          minHeight: 64,
          justifyContent: "space-between",
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center" }}>{leading}</Box>
          <Box>
            <Typography variant="subtitle1" color="text.primary" fontWeight={700}>
              Studio One Platform
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Operator console
            </Typography>
          </Box>
        </Box>
        {children}
      </Toolbar>
    </AppBar>
  );
}
