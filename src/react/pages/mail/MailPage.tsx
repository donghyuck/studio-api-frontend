import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Box, Breadcrumbs, Button, Stack, Typography } from "@mui/material";

export function MailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isInbox = location.pathname.endsWith("/inbox") || location.pathname.endsWith("/mail");
  const isSync = location.pathname.endsWith("/sync");

  return (
    <Stack spacing={2}>
      <Breadcrumbs separator="›">
        <Typography color="text.secondary">응용프로그램</Typography>
        <Typography color="text.primary">메일</Typography>
      </Breadcrumbs>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h5">메일 운영</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant={isInbox ? "contained" : "text"}
            onClick={() => navigate("/application/mail/inbox")}
          >
            Inbox
          </Button>
          <Button
            variant={isSync ? "contained" : "text"}
            onClick={() => navigate("/application/mail/sync")}
          >
            Sync
          </Button>
        </Stack>
      </Box>

      <Outlet />
    </Stack>
  );
}
