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
  DashboardOutlined,
  ExpandLess,
  ExpandMore,
  FolderOpenOutlined,
  ForumOutlined,
  GroupOutlined,
  Inventory2Outlined,
  MailOutline,
  PsychologyAltOutlined,
  RuleOutlined,
  StorageOutlined,
  TopicOutlined,
} from "@mui/icons-material";

export const DRAWER_WIDTH = 248;

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
                onClick={() => onToggleSection(section.title)}
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
                const active = matchesPath(pathname, item);
                const button = (
                  <ListItemButton
                    key={item.path}
                    selected={active}
                    onClick={() => onNavigate(item.path)}
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
}
