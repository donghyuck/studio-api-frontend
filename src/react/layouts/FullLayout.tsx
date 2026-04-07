import {
  Box,
  Avatar,
  Button,
  ClickAwayListener,
  Divider,
  Drawer,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
  Popper,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
  MenuItem,
  ListItemText as MuiListItemText,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  AccountCircleOutlined,
  ArticleOutlined,
  DashboardOutlined,
  ExpandLess,
  ExpandMore,
  FolderOpenOutlined,
  ForumOutlined,
  GroupOutlined,
  Inventory2Outlined,
  MailOutline,
  Menu,
  PsychologyAltOutlined,
  RuleOutlined,
  StorageOutlined,
  TopicOutlined,
  LogoutOutlined,
  ListAltOutlined,
  ComputerOutlined,
  LightModeOutlined,
  DarkModeOutlined,
} from "@mui/icons-material";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { AppShellHeader } from "@/react/layouts/AppShellHeader";
import { useAuthStore } from "@/react/auth/store";
import { PasswordChangeDialog } from "@/react/pages/profile/PasswordChangeDialog";
import { SessionStatusChip } from "@/react/components/auth/SessionStatusChip";
import { API_BASE_URL } from "@/config/backend";
import NO_AVATAR from "@/assets/images/users/no-avatar.png";
import { useThemeMode } from "@/react/theme/AppThemeProvider";

const DRAWER_WIDTH = 248;

type NavItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
  match?: (pathname: string) => boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

function matchesPath(pathname: string, item: NavItem) {
  if (item.match) {
    return item.match(pathname);
  }

  if (item.path === "/") {
    return pathname === "/";
  }

  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

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
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const profileOpen = Boolean(profileAnchor);

  const sections = useMemo<NavSection[]>(
    () => [
      {
        title: "General",
        items: [
          { label: "대시보드", path: "/", icon: <DashboardOutlined fontSize="small" /> },
          { label: "내 프로필", path: "/profile", icon: <AccountCircleOutlined fontSize="small" /> },
        ],
      },
      {
        title: "Application",
        items: [
          {
            label: "메일",
            path: "/application/mail/inbox",
            icon: <MailOutline fontSize="small" />,
            match: (pathname) => pathname.startsWith("/application/mail"),
          },
          {
            label: "포럼 관리",
            path: "/admin/forums",
            icon: <ForumOutlined fontSize="small" />,
          },
        ],
      },
      {
        title: "Resource",
        items: [
          { label: "파일", path: "/application/files", icon: <FolderOpenOutlined fontSize="small" /> },
          {
            label: "문서",
            path: "/application/documents",
            icon: <ArticleOutlined fontSize="small" />,
          },
          {
            label: "템플릿",
            path: "/application/templates",
            icon: <Inventory2Outlined fontSize="small" />,
          },
        ],
      },
      {
        title: "Policy",
        items: [
          {
            label: "오브젝트 타입",
            path: "/policy/object-types",
            icon: <RuleOutlined fontSize="small" />,
          },
          { label: "ACL", path: "/admin/acl", icon: <RuleOutlined fontSize="small" /> },
        ],
      },
      {
        title: "Services",
        items: [
          {
            label: "Object Storage",
            path: "/services/object-storage",
            icon: <StorageOutlined fontSize="small" />,
          },
          {
            label: "AI Chat",
            path: "/services/ai/chat",
            icon: <PsychologyAltOutlined fontSize="small" />,
          },
          {
            label: "AI RAG",
            path: "/services/ai/rag",
            icon: <TopicOutlined fontSize="small" />,
          },
        ],
      },
      {
        title: "Admin",
        items: [
          { label: "회원", path: "/admin/users", icon: <AccountCircleOutlined fontSize="small" /> },
          { label: "그룹", path: "/admin/groups", icon: <GroupOutlined fontSize="small" /> },
          { label: "역할", path: "/admin/roles", icon: <RuleOutlined fontSize="small" /> },
          {
            label: "로그인 실패 감사",
            path: "/admin/audit/login-failures",
            icon: <ArticleOutlined fontSize="small" />,
          },
        ],
      },
    ],
    []
  );

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

  const drawerWidth = collapsed ? 0 : DRAWER_WIDTH;
  const displayName = user?.name || user?.username || "사용자";
  const profileImageUrl = user?.username
    ? `${API_BASE_URL}/api/profile/${encodeURIComponent(user.username)}/avatar`
    : NO_AVATAR;

  const drawerContent = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#ffffff",
        color: "#1f2937",
      }}
    >
      <Box sx={{ flex: 1, overflowY: "auto", py: 2 }}>
        {sections.map((section) => (
          <Box
            key={section.title}
            sx={{
              mb: 1,
              px: 2,
            }}
          >
            {!collapsed ? (
              <ListItemButton
                onClick={() =>
                  setExpandedSections((current) => ({
                    ...current,
                    [section.title]: !current[section.title],
                  }))
                }
                sx={{
                  minHeight: 34,
                  borderRadius: 1,
                  px: 0,
                  py: 0.5,
                  justifyContent: "space-between",
                  color: "#111827",
                  bgcolor: "transparent",
                  "&:hover": {
                    bgcolor: "transparent",
                    color: "#2563eb",
                  },
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    textTransform: "uppercase",
                    fontWeight: 500,
                    letterSpacing: 0.2,
                  }}
                >
                  {section.title}
                </Typography>
                {expandedSections[section.title] ? (
                  <ExpandLess fontSize="small" />
                ) : (
                  <ExpandMore fontSize="small" />
                )}
              </ListItemButton>
            ) : null}
            <List
              disablePadding
              sx={{
                ml: 0,
                pl: 1.5,
                pr: 0,
                borderLeft: "1px solid rgba(148,163,184,0.45)",
                display: collapsed || expandedSections[section.title] ? "block" : "none",
              }}
            >
              {section.items.map((item) => {
                const active = matchesPath(location.pathname, item);
                const button = (
                  <ListItemButton
                    key={item.path}
                    selected={active}
                    onClick={() => navigate(item.path)}
                    sx={{
                      position: "relative",
                      minHeight: 30,
                      borderRadius: 1,
                      mb: 0.25,
                      px: 1,
                      py: 0.25,
                      ml: -0.5,
                      justifyContent: collapsed ? "center" : "flex-start",
                      color: active ? "#2563eb" : "#4b5563",
                      "&.Mui-selected": {
                        bgcolor: "transparent",
                        color: "#2563eb",
                        fontWeight: 700,
                      },
                      "&.Mui-selected:hover": {
                        bgcolor: "rgba(37,99,235,0.06)",
                      },
                      "&:hover": {
                        bgcolor: "rgba(37,99,235,0.06)",
                        color: "#2563eb",
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: collapsed ? 0 : 30,
                        color: "inherit",
                        justifyContent: "center",
                        "& svg": {
                          fontSize: 18,
                        },
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    {!collapsed ? (
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          fontSize: 14,
                          fontWeight: active ? 600 : 500,
                          color: "inherit",
                        }}
                      />
                    ) : null}
                  </ListItemButton>
                );

                return collapsed ? (
                  <Tooltip key={item.path} title={item.label} placement="right">
                    {button}
                  </Tooltip>
                ) : (
                  button
                );
              })}
            </List>
          </Box>
        ))}
      </Box>
    </Box>
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
          <Box sx={{ textAlign: "right", display: { xs: "none", sm: "block" } }}>
            <Typography variant="caption" color="text.primary" fontWeight={600} sx={{ lineHeight: 1.1, display: "block" }}>
              {displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, lineHeight: 1.1 }}>
              {user?.email || user?.username || ""}
            </Typography>
          </Box>
          <IconButton
            onClick={(event) =>
              setProfileAnchor((anchor) => (anchor ? null : event.currentTarget))
            }
            size="small"
            aria-label="사용자 메뉴"
          >
            <Avatar
              alt={displayName}
              src={profileImageUrl}
              imgProps={{
                onError: (event) => {
                  event.currentTarget.src = NO_AVATAR;
                },
              }}
              sx={{ width: 30, height: 30, bgcolor: "grey.200" }}
            />
          </IconButton>
          <Popper
            open={profileOpen}
            anchorEl={profileAnchor}
            placement="bottom-end"
            sx={{ zIndex: (muiTheme) => muiTheme.zIndex.modal }}
          >
            <ClickAwayListener onClickAway={() => setProfileAnchor(null)}>
              <Paper
                elevation={8}
                sx={{
                  width: 320,
                  mt: 1,
                  borderRadius: 3,
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
              <Box
                sx={{
                  px: 2.5,
                  py: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  bgcolor: "rgba(37,99,235,0.04)",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Avatar
                  alt={displayName}
                  src={profileImageUrl}
                  imgProps={{
                    onError: (event) => {
                      event.currentTarget.src = NO_AVATAR;
                    },
                  }}
                  sx={{ width: 42, height: 42, bgcolor: "grey.200" }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap>
                    {displayName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {user?.email || user?.username || ""}
                  </Typography>
                </Box>
              </Box>
            <MenuItem
              onClick={() => {
                setProfileAnchor(null);
                navigate("/profile");
              }}
              sx={{ px: 2.5, py: 1.25 }}
            >
              <ListItemIcon>
                <AccountCircleOutlined fontSize="small" />
              </ListItemIcon>
              <MuiListItemText primary="내 프로필" secondary={user?.username} />
            </MenuItem>
            <MenuItem
              onClick={() => {
                setProfileAnchor(null);
                setPasswordDialogOpen(true);
              }}
              sx={{ px: 2.5, py: 1.25 }}
            >
              <ListItemIcon>
                <ListAltOutlined fontSize="small" />
              </ListItemIcon>
              <MuiListItemText primary="비밀번호 변경" />
            </MenuItem>
            <Divider />
            <Box sx={{ px: 2.5, py: 1.5 }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                테마
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={themeMode}
                onChange={(_, nextMode) => {
                  if (nextMode) {
                    setThemeMode(nextMode);
                  }
                }}
              >
                <ToggleButton value="system" sx={{ gap: 0.5 }}>
                  <ComputerOutlined fontSize="small" />
                  시스템
                </ToggleButton>
                <ToggleButton value="light" sx={{ gap: 0.5 }}>
                  <LightModeOutlined fontSize="small" />
                  라이트
                </ToggleButton>
                <ToggleButton value="dark" sx={{ gap: 0.5 }}>
                  <DarkModeOutlined fontSize="small" />
                  다크
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Divider />
            <Box sx={{ px: 2.5, py: 2 }}>
              <Button
                variant="outlined"
                color="primary"
                fullWidth
                startIcon={<LogoutOutlined fontSize="small" />}
                onClick={() => {
                  setProfileAnchor(null);
                  void logoutEverywhere();
                }}
              >
                로그아웃
              </Button>
            </Box>
              </Paper>
            </ClickAwayListener>
          </Popper>
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
              borderRight: collapsed ? "none" : "1px solid",
              borderColor: "divider",
              transition: "width 160ms ease, border-color 160ms ease",
            }}
          >
            {!collapsed ? drawerContent : null}
          </Box>
        ) : (
          <Drawer
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            variant="temporary"
            ModalProps={{ keepMounted: true }}
            PaperProps={{ sx: { width: DRAWER_WIDTH } }}
          >
            {drawerContent}
          </Drawer>
        )}
        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            bgcolor: "#ffffff",
            px: { xs: 2, md: 3 },
            py: 3,
          }}
        >
          <Outlet />
        </Box>
      </Box>
      <PasswordChangeDialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
      />
    </Box>
  );
}
