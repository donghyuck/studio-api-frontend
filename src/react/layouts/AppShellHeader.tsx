import { AppBar, Box, Toolbar, Typography } from "@mui/material";

interface Props {
  children?: React.ReactNode;
  leading?: React.ReactNode;
}

export function AppShellHeader({ children, leading }: Props) {
  return (
    <AppBar
      position="static"
      color="inherit"
      elevation={0}
      sx={{
        bgcolor: "transparent",
        backgroundImage: "none",
        boxShadow: "none",
      }}
    >
      <Toolbar
        sx={{
          minHeight: 64,
          justifyContent: "space-between",
          borderBottom: "1px solid",
          borderColor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(139, 92, 246, 0.2)" // Violet hairline border
              : "rgba(139, 92, 246, 0.15)",
          bgcolor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(7, 8, 15, 0.85)" // Space Navy default background with opacity
              : "rgba(248, 250, 252, 0.85)", // Light sky default background with opacity
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          transition: "background-color 200ms ease, border-color 200ms ease",
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
            <Typography
              variant="subtitle1"
              color="text.primary"
              fontWeight={700}
              sx={{
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
              }}
            >
              Studio One Platform
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                fontWeight: 500,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                fontSize: 10,
                opacity: 0.8,
              }}
            >
              Operator console
            </Typography>
          </Box>
        </Box>
        {children}
      </Toolbar>
    </AppBar>
  );
}
