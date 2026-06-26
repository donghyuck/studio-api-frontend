import {
  Box,
  Drawer,
  IconButton,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Menu } from "@mui/icons-material";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { AppShellHeader } from "@/react/layouts/AppShellHeader";
import { useAuthStore } from "@/react/auth/store";
import { PasswordChangeDialog } from "@/react/features/profile/components/PasswordChangeDialog";
import { SessionStatusChip } from "@/react/components/auth/SessionStatusChip";
import { API_BASE_URL } from "@/config/backend";
import NO_AVATAR from "@/assets/images/users/no-avatar.png";
import { useThemeMode } from "@/react/theme/AppThemeProvider";
import {
  buildNavSections,
  COLLAPSED_DRAWER_WIDTH,
  DRAWER_WIDTH,
  FullLayoutNavigation,
  matchesPath,
} from "@/react/layouts/FullLayoutNavigation";
import { FullLayoutUserMenu } from "@/react/layouts/FullLayoutUserMenu";

export function FullLayout() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const refreshTokens = useAuthStore((state) => state.refreshTokens);
  const logoutEverywhere = useAuthStore((state) => state.logoutEverywhere);
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const sections = useMemo(() => buildNavSections(), []);
  const sectionDefaults = useMemo(
    () =>
      Object.fromEntries(
        sections.map((section) => [
          section.title,
          section.items.some((item) => matchesPath(location.pathname, item)),
        ])
      ) as Record<string, boolean>,
    [location.pathname, sections]
  );
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    sectionDefaults
  );

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    setExpandedSections((current) => {
      const next = { ...current };
      for (const [title, expanded] of Object.entries(sectionDefaults)) {
        if (!(title in next)) {
          next[title] = expanded;
          continue;
        }
        if (expanded) {
          next[title] = true;
        }
      }
      return next;
    });
  }, [sectionDefaults]);

  const drawerWidth = collapsed ? COLLAPSED_DRAWER_WIDTH : DRAWER_WIDTH;
  const displayName = user?.name || user?.username || "사용자";
  const emailOrUsername = user?.email || user?.username || "";
  const profileImageUrl = user?.username
    ? `${API_BASE_URL}/api/profile/${encodeURIComponent(user.username)}/avatar`
    : NO_AVATAR;

  const navigation = (
    <FullLayoutNavigation
      sections={sections}
      pathname={location.pathname}
      collapsed={collapsed}
      expandedSections={expandedSections}
      onToggleSection={(title) =>
        setExpandedSections((current) => ({
          ...current,
          [title]: !current[title],
        }))
      }
      onNavigate={(path) => {
        navigate(path);
        setMobileOpen(false);
      }}
    />
  );

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "background.default" }}>
      <AppShellHeader
        leading={
          <IconButton
            edge="start"
            onClick={() => {
              if (isDesktop) {
                setCollapsed((value) => !value);
                return;
              }
              setMobileOpen(true);
            }}
          >
            <Menu />
          </IconButton>
        }
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            pr: 1,
          }}
        >
          <Box sx={{ display: { xs: "none", md: "block" } }}>
            <SessionStatusChip token={token} refreshTokens={refreshTokens} />
          </Box>
          <FullLayoutUserMenu
            displayName={displayName}
            emailOrUsername={emailOrUsername}
            profileImageUrl={profileImageUrl}
            fallbackImageUrl={NO_AVATAR}
            username={user?.username}
            themeMode={themeMode}
            onThemeModeChange={setThemeMode}
            onProfile={() => navigate("/profile")}
            onPasswordChange={() => setPasswordDialogOpen(true)}
            onLogout={() => void logoutEverywhere()}
          />
        </Box>
      </AppShellHeader>
      <Box sx={{ display: "flex", minHeight: "calc(100vh - 64px)" }}>
        {isDesktop ? (
          <Box
            component="aside"
            sx={{
              width: drawerWidth,
              flexShrink: 0,
              overflow: "hidden",
              borderRight: "1px solid",
              borderColor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.06)",
              transition: "width 160ms ease, border-color 160ms ease",
            }}
          >
            {navigation}
          </Box>
        ) : (
          <Drawer
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            variant="temporary"
            ModalProps={{ keepMounted: true }}
            PaperProps={{ sx: { width: DRAWER_WIDTH } }}
          >
            {navigation}
          </Drawer>
        )}
        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            bgcolor: "transparent",
            p: { xs: 2, md: 3 },
            pt: { xs: 1.5, md: 2 },
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Breadcrumbs Portal Destination */}
          <Box
            id="layout-breadcrumbs-portal"
            sx={{
              px: { xs: 0.5, md: 1 },
              mb: 1.5,
              minHeight: 18,
              display: "flex",
              alignItems: "center",
            }}
          />
          <Box
            sx={{
              flex: 1,
              bgcolor: "background.paper",
              borderRadius: 3.5, // 14px
              border: (theme) =>
                theme.palette.mode === "dark"
                  ? "1px solid rgba(139, 92, 246, 0.15)"
                  : "1px solid rgba(139, 92, 246, 0.1)",
              boxShadow: (theme) =>
                theme.palette.mode === "dark"
                  ? "0 4px 24px rgba(0, 0, 0, 0.3)"
                  : "0 4px 20px rgba(0, 0, 0, 0.02)",
              p: { xs: 2.5, md: 4 },
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Outlet />
          </Box>
        </Box>
      </Box>
      <PasswordChangeDialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
      />
    </Box>
  );
}
