import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
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
} from "@mui/icons-material";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { AppShellHeader } from "@/react/layouts/AppShellHeader";
import { useAuthStore } from "@/react/auth/store";

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
  const logoutEverywhere = useAuthStore((state) => state.logoutEverywhere);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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
          { label: "파일", path: "/application/files", icon: <FolderOpenOutlined fontSize="small" /> },
          {
            label: "메일",
            path: "/application/mail/inbox",
            icon: <MailOutline fontSize="small" />,
            match: (pathname) => pathname.startsWith("/application/mail"),
          },
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
          { label: "ACL", path: "/admin/acl", icon: <RuleOutlined fontSize="small" /> },
          {
            label: "로그인 실패 감사",
            path: "/admin/audit/login-failures",
            icon: <ArticleOutlined fontSize="small" />,
          },
          {
            label: "포럼 관리",
            path: "/admin/forums",
            icon: <ForumOutlined fontSize="small" />,
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

  const drawerContent = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#e9eef5",
        color: "#1f2937",
      }}
    >
      <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
        {sections.map((section) => (
          <Box key={section.title} sx={{ mb: 1 }}>
            {!collapsed ? (
              <ListItemButton
                onClick={() =>
                  setExpandedSections((current) => ({
                    ...current,
                    [section.title]: !current[section.title],
                  }))
                }
                sx={{
                  mx: 1.5,
                  mb: 0.5,
                  minHeight: 38,
                  borderRadius: 2,
                  px: 1.5,
                  justifyContent: "space-between",
                  color: "#334155",
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.4 }}
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
                px: collapsed ? 1 : 1.5,
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
                      minHeight: 42,
                      borderRadius: 2,
                      mb: 0.5,
                      px: collapsed ? 1.25 : 1.5,
                      justifyContent: collapsed ? "center" : "flex-start",
                      color: active ? "#0f172a" : "#334155",
                      "&.Mui-selected": {
                        bgcolor: "rgba(148,163,184,0.22)",
                      },
                      "&.Mui-selected:hover": {
                        bgcolor: "rgba(148,163,184,0.28)",
                      },
                      "&:hover": {
                        bgcolor: "rgba(148,163,184,0.14)",
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: collapsed ? 0 : 36,
                        color: active ? "#0f172a" : "#475569",
                        justifyContent: "center",
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
    </Box>
  );
}
