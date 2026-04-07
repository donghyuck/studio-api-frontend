import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Breadcrumbs, Stack, Tab, Tabs, Typography } from "@mui/material";

export function MailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentTab = location.pathname.endsWith("/sync") ? "sync" : "inbox";

  return (
    <Stack spacing={1.5}>
      <Breadcrumbs separator="›" sx={{ fontSize: 12 }}>
        <Typography color="text.secondary" fontSize={12}>응용프로그램</Typography>
        <Typography color="text.primary" fontSize={12}>메일</Typography>
      </Breadcrumbs>
      {/* <Typography variant="h5">메일</Typography> */}
      <Tabs
        value={currentTab}
        onChange={(_, value) => navigate(`/application/mail/${value}`)}
        sx={{ borderBottom: 1, borderColor: "divider", minHeight: 36 }}
      >
        <Tab label="Inbox" value="inbox" sx={{ minHeight: 36 }} />
        <Tab label="Sync" value="sync" sx={{ minHeight: 36 }} />
      </Tabs>

      <Outlet />
    </Stack>
  );
}
