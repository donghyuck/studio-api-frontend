import { Box, Container } from "@mui/material";
import { Outlet } from "react-router-dom";
import { AppShellHeader } from "@/react/layouts/AppShellHeader";

export function PublicLayout() {
  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "background.default" }}>
      <AppShellHeader />
      <Container sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
