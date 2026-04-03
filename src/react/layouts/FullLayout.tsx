import {
  AppBar,
  Box,
  Button,
  Container,
  Toolbar,
  Typography,
} from "@mui/material";
import { Outlet } from "react-router-dom";
import { useAuthStore } from "@/react/auth/store";

export function FullLayout() {
  const user = useAuthStore((state) => state.user);
  const logoutEverywhere = useAuthStore((state) => state.logoutEverywhere);

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "background.default" }}>
      {/* TODO: FullLayout is a minimal implementation with only an AppBar.
                 Future enhancements will include sidebar/navigation components. */}
      <AppBar position="static" color="inherit" elevation={1}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Typography variant="h6" color="text.primary">
            Studio One Platform
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {user?.name ?? user?.username ?? "사용자"}
            </Typography>
            <Button variant="outlined" size="small" onClick={() => void logoutEverywhere()}>
              로그아웃
            </Button>
          </Box>
        </Toolbar>
      </AppBar>
      <Container sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
