import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AccountCircleOutlined,
  ArticleOutlined,
  AccountTreeOutlined,
  BusinessOutlined,
  DashboardOutlined,
  ExpandLess,
  ExpandMore,
  FolderOpenOutlined,
  ForumOutlined,
  GroupOutlined,
  HubOutlined,
  Inventory2Outlined,
  LinkOutlined,
  MailOutline,
  PsychologyAltOutlined,
  RuleOutlined,
  StorageOutlined,
  TopicOutlined,
} from "@mui/icons-material";

export const DRAWER_WIDTH = 248;
export const COLLAPSED_DRAWER_WIDTH = 64;

export type NavItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
  match?: (pathname: string) => boolean;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export function matchesPath(pathname: string, item: NavItem) {
  if (item.match) {
    return item.match(pathname);
  }

  if (item.path === "/") {
    return pathname === "/";
  }

  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

export function buildNavSections(): NavSection[] {
  return [
    {
      title: "General",
      items: [
        {
          label: "대시보드",
          path: "/",
          icon: <DashboardOutlined fontSize="small" />,
        },
        {
          label: "내 프로필",
          path: "/profile",
          icon: <AccountCircleOutlined fontSize="small" />,
        },
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
        {
          label: "파일",
          path: "/application/files",
          icon: <FolderOpenOutlined fontSize="small" />,
        },
        {
          label: "작업공간",
          path: "/application/workspaces",
          icon: <AccountTreeOutlined fontSize="small" />,
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
        {
          label: "ACL",
          path: "/admin/acl",
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
          label: "AI RAG Chat",
          path: "/services/ai/rag-chat",
          icon: <PsychologyAltOutlined fontSize="small" />,
        },
        {
          label: "AI RAG",
          path: "/services/ai/rag",
          icon: <TopicOutlined fontSize="small" />,
          match: (pathname) =>
            pathname === "/services/ai/rag" ||
            /^\/services\/ai\/rag\/jobs\/[^/]+$/.test(pathname),
        },
        {
          label: "RAG 시뮬레이터",
          path: "/services/ai/rag/chunking-simulator",
          icon: <HubOutlined fontSize="small" />,
        },
        {
          label: "벡터 시각화",
          path: "/services/ai/vector-visualization",
          icon: <TopicOutlined fontSize="small" />,
        },
        // {
        //   label: "NCS 데이터셋 임포트",
        //   path: "/services/ai/skillgraph/dataset-import",
        //   icon: <StorageOutlined fontSize="small" />,
        // },
        {
          label: "SkillGraph Console",
          path: "/services/ai/skillgraph/dashboard",
          icon: <HubOutlined fontSize="small" />,
          match: (pathname) => pathname.startsWith("/services/ai/skillgraph"),
        },
      ],
    },
    {
      title: "Admin",
      items: [
        {
          label: "회원",
          path: "/admin/users",
          icon: <AccountCircleOutlined fontSize="small" />,
        },
        {
          label: "그룹",
          path: "/admin/groups",
          icon: <GroupOutlined fontSize="small" />,
        },
        {
          label: "역할",
          path: "/admin/roles",
          icon: <RuleOutlined fontSize="small" />,
        },
        {
          label: "회사",
          path: "/admin/companies",
          icon: <BusinessOutlined fontSize="small" />,
        },
        {
          label: "로그인 실패 감사",
          path: "/admin/audit/login-failures",
          icon: <ArticleOutlined fontSize="small" />,
        },
        {
          label: "파일 다운로드 로그",
          path: "/admin/audit/attachment-download-links",
          icon: <LinkOutlined fontSize="small" />,
        },
      ],
    },
  ];
}

interface FullLayoutNavigationProps {
  sections: NavSection[];
  pathname: string;
  collapsed: boolean;
  expandedSections: Record<string, boolean>;
  onToggleSection: (title: string) => void;
  onNavigate: (path: string) => void;
}

export function FullLayoutNavigation({
  sections,
  pathname,
  collapsed,
  expandedSections,
  onToggleSection,
  onNavigate,
}: FullLayoutNavigationProps) {
  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        color: "text.primary",
      }}
    >
      <Box sx={{ flex: 1, overflowY: "auto", py: 2 }}>
        {sections.map((section) => (
          <Box
            key={section.title}
            sx={{
              mb: 1.5,
              px: collapsed ? 1 : 2,
            }}
          >
            {!collapsed ? (
              <ListItemButton
                onClick={() => onToggleSection(section.title)}
                sx={{
                  minHeight: 34,
                  borderRadius: 1,
                  px: 0,
                  py: 0.5,
                  justifyContent: "space-between",
                  color: "text.primary",
                  bgcolor: "transparent",
                  "&:hover": {
                    bgcolor: "transparent",
                    color: "primary.main",
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
                    fontWeight: 650,
                    letterSpacing: "0.08em",
                    fontSize: 10,
                    color: "text.secondary",
                    opacity: 0.8,
                  }}
                >
                  {section.title}
                </Typography>
                {expandedSections[section.title] ? (
                  <ExpandLess fontSize="small" sx={{ fontSize: 16, opacity: 0.6 }} />
                ) : (
                  <ExpandMore fontSize="small" sx={{ fontSize: 16, opacity: 0.6 }} />
                )}
              </ListItemButton>
            ) : null}
            <List
              disablePadding
              sx={{
                ml: 0,
                pl: collapsed ? 0 : 1.5,
                pr: 0,
                borderLeft: collapsed ? "none" : "1px solid",
                borderColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.06)"
                    : "rgba(0, 0, 0, 0.05)",
                display:
                  collapsed || expandedSections[section.title]
                    ? "block"
                    : "none",
              }}
            >
              {section.items.map((item) => {
                const active = matchesPath(pathname, item);
                const button = (
                  <ListItemButton
                    key={item.path}
                    selected={active}
                    onClick={() => onNavigate(item.path)}
                    sx={{
                      position: "relative",
                      minHeight: 34,
                      borderRadius: "6px",
                      mb: 0.5,
                      px: collapsed ? 1 : 1.5,
                      py: 0.5,
                      ml: collapsed ? 0 : -0.5,
                      justifyContent: collapsed ? "center" : "flex-start",
                      color: active ? "primary.main" : "text.secondary",
                      transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",
                      "&.Mui-selected": {
                        bgcolor: (theme) =>
                          theme.palette.mode === "dark"
                            ? "rgba(37, 99, 235, 0.12)"
                            : "rgba(37, 99, 235, 0.06)",
                        color: "primary.main",
                        "&::before": collapsed ? {} : {
                          content: '""',
                          position: "absolute",
                          left: 0,
                          top: "20%",
                          height: "60%",
                          width: 3,
                          borderRadius: 1,
                          bgcolor: "primary.main",
                        },
                      },
                      "&.Mui-selected:hover": {
                        bgcolor: (theme) =>
                          theme.palette.mode === "dark"
                            ? "rgba(37, 99, 235, 0.18)"
                            : "rgba(37, 99, 235, 0.10)",
                        transform: collapsed ? "none" : "translateX(4px)",
                      },
                      "&:hover": {
                        bgcolor: (theme) =>
                          theme.palette.mode === "dark"
                            ? "rgba(255, 255, 255, 0.03)"
                            : "rgba(0, 0, 0, 0.03)",
                        color: active ? "primary.main" : "text.primary",
                        transform: collapsed ? "none" : "translateX(4px)",
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: collapsed ? 0 : 28,
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
                          fontSize: 13.5,
                          fontWeight: active ? 600 : 500,
                          color: "inherit",
                          letterSpacing: "-0.01em",
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
}
