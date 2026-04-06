import {
  Box,
  Button,
  Container,
  Typography,
} from "@mui/material";
import { Outlet, useNavigate } from "react-router-dom";
import { AppShellHeader } from "@/react/layouts/AppShellHeader";
import { useAuthStore } from "@/react/auth/store";

export function FullLayout() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logoutEverywhere = useAuthStore((state) => state.logoutEverywhere);

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "background.default" }}>
      {/* TODO: FullLayout is a minimal implementation with only an AppBar.
                 Future enhancements will include sidebar/navigation components. */}
      <AppShellHeader>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Button variant="text" size="small" onClick={() => navigate("/profile")}>
            내 프로필
          </Button>
          <Typography variant="body2" color="text.secondary">
            {user?.name ?? user?.username ?? "사용자"}
          </Typography>
          <Button variant="outlined" size="small" onClick={() => void logoutEverywhere()}>
            로그아웃
          </Button>
        </Box>
      </AppShellHeader>
      <Container sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
