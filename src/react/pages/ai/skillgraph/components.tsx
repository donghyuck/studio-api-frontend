import { useState, type ReactNode } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import {
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AccountTreeOutlined,
  AutoGraphOutlined,
  BadgeOutlined,
  CategoryOutlined,
  FactCheckOutlined,
  HubOutlined,
  InsightsOutlined,
  LanOutlined,
  MenuOpenOutlined,
  MenuOutlined,
  PlayCircleOutline,
  SchemaOutlined,
  ScienceOutlined,
  SearchOutlined,
  StorageOutlined,
  WorkOutline,
} from "@mui/icons-material";
import type {
  SkillCandidateStatus,
  SkillGraphJobStatus,
} from "@/types/studio/skillgraph";

export interface SkillGraphNavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

export interface SkillGraphNavGroup {
  title: string;
  items: SkillGraphNavItem[];
}

export const skillGraphNavGroups: SkillGraphNavGroup[] = [
  {
    title: "개요",
    items: [
      { label: "대시보드", path: "/services/ai/skillgraph/dashboard", icon: <InsightsOutlined fontSize="small" /> },
    ],
  },
  {
    title: "수집 및 QC",
    items: [
      { label: "스킬 추출 작업", path: "/services/ai/skillgraph/jobs", icon: <PlayCircleOutline fontSize="small" /> },
      { label: "스킬 후보", path: "/services/ai/skillgraph/candidates", icon: <BadgeOutlined fontSize="small" /> },
    ],
  },
  {
    title: "분류 체계 및 카탈로그",
    items: [
      { label: "스킬 사전", path: "/services/ai/skillgraph/dictionary", icon: <SchemaOutlined fontSize="small" /> },
      { label: "카테고리 초안", path: "/services/ai/skillgraph/categories", icon: <CategoryOutlined fontSize="small" /> },
      { label: "카테고리 관리", path: "/services/ai/skillgraph/category-management", icon: <CategoryOutlined fontSize="small" /> },
    ],
  },
  {
    title: "분석 및 매핑",
    items: [
      { label: "스킬 분류 체계 맵", path: "/services/ai/skillgraph/clusters", icon: <HubOutlined fontSize="small" /> },
      { label: "스킬 그래프 뷰어", path: "/services/ai/skillgraph/graph", icon: <AutoGraphOutlined fontSize="small" /> },
      { label: "NCS 매핑", path: "/services/ai/skillgraph/ncs-mapping", icon: <LanOutlined fontSize="small" /> },
      { label: "과정 스킬 매핑", path: "/services/ai/skillgraph/course-mapping", icon: <WorkOutline fontSize="small" /> },
    ],
  },
  {
    title: "시뮬레이션",
    items: [
      { label: "추천 시뮬레이션", path: "/services/ai/skillgraph/simulation", icon: <ScienceOutlined fontSize="small" /> },
    ],
  },
  {
    title: "데이터 관리",
    items: [
      { label: "NCS 데이터셋 임포트", path: "/services/ai/skillgraph/dataset-import", icon: <StorageOutlined fontSize="small" /> },
      { label: "NCS Reference 조회", path: "/services/ai/skillgraph/reference-dataset", icon: <SearchOutlined fontSize="small" /> },
    ],
  },
];

export const skillGraphNavItems: SkillGraphNavItem[] = skillGraphNavGroups.flatMap((group) => group.items);

export function SkillGraphLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(null);

  const handleOpenMenu = (event: React.MouseEvent<HTMLButtonElement>, index: number) => {
    setAnchorEl(event.currentTarget);
    setActiveMenuIndex(index);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setActiveMenuIndex(null);
  };

  const isGroupActive = (group: SkillGraphNavGroup) => {
    return group.items.some(
      (item) =>
        location.pathname === item.path ||
        location.pathname.startsWith(`${item.path}/`)
    );
  };

  return (
    <Stack spacing={2} sx={{ width: "100%" }}>
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          position: "sticky",
          top: 0,
          zIndex: 1100,
          bgcolor: "background.paper",
          borderRadius: 0,
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <AccountTreeOutlined color="primary" fontSize="medium" />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                SkillGraph Console
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                Extraction, review, mapping
              </Typography>
            </Box>
          </Stack>

          <Stack
            direction="row"
            spacing={0.5}
            sx={{
              flexWrap: "wrap",
              gap: 0.5,
            }}
          >
            {skillGraphNavGroups.map((group, index) => {
              const active = isGroupActive(group);
              const isOpen = activeMenuIndex === index;
              return (
                <Box key={group.title}>
                  <Button
                    size="small"
                    onClick={(e) => handleOpenMenu(e, index)}
                    sx={{
                      fontSize: 13,
                      fontWeight: active ? 600 : 500,
                      px: 1.5,
                      py: 0.75,
                      borderRadius: 1,
                      textTransform: "none",
                      color: active ? "primary.main" : "text.secondary",
                      bgcolor: active ? "rgba(21, 101, 192, 0.06)" : "transparent",
                      border: "1px solid",
                      borderColor: active ? "primary.main" : "transparent",
                      "&:hover": {
                        bgcolor: active ? "rgba(21, 101, 192, 0.1)" : "action.hover",
                      },
                    }}
                  >
                    {group.title}
                  </Button>
                  <Menu
                    anchorEl={anchorEl}
                    open={isOpen && Boolean(anchorEl)}
                    onClose={handleCloseMenu}
                    elevation={3}
                    slotProps={{
                      paper: {
                        sx: {
                          mt: 0.5,
                          minWidth: 200,
                          borderRadius: 1.5,
                          border: "1px solid",
                          borderColor: "divider",
                        },
                      },
                    }}
                  >
                    {group.items.map((item) => {
                      const selected =
                        location.pathname === item.path ||
                        location.pathname.startsWith(`${item.path}/`);
                      return (
                        <MenuItem
                          key={item.path}
                          component={RouterLink}
                          to={item.path}
                          onClick={handleCloseMenu}
                          selected={selected}
                          sx={{
                            fontSize: 13,
                            py: 1,
                            px: 2,
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                            "&.Mui-selected": {
                              bgcolor: "rgba(21, 101, 192, 0.08)",
                              color: "primary.main",
                              fontWeight: 600,
                            },
                          }}
                        >
                          <Box sx={{ display: "flex", color: selected ? "primary.main" : "text.secondary" }}>
                            {item.icon}
                          </Box>
                          <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 13 }} />
                        </MenuItem>
                      );
                    })}
                  </Menu>
                </Box>
              );
            })}
          </Stack>
        </Stack>
      </Paper>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Stack>
  );
}

export function LoadingState({ label = "데이터를 불러오는 중입니다." }: { label?: string }) {
  return (
    <Stack spacing={1.5} alignItems="center" justifyContent="center" sx={{ minHeight: 220 }}>
      <CircularProgress size={28} />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}

export function EmptyState({ title = "표시할 데이터가 없습니다.", description }: { title?: string; description?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
      <Typography variant="subtitle1">{title}</Typography>
      {description ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {description}
        </Typography>
      ) : null}
    </Paper>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";
  return <Alert severity="error">{message}</Alert>;
}

export function StatusBadge({ value }: { value?: SkillCandidateStatus | SkillGraphJobStatus | string }) {
  const color =
    value === "COMPLETED" || value === "APPROVED"
      ? "success"
      : value === "FAILED" || value === "REJECTED"
        ? "error"
        : value === "RUNNING" || value === "MATCHED" || value === "ALIAS_CANDIDATE" || value === "NEW_SKILL_CANDIDATE"
          ? "info"
          : value === "NOISE" || value === "PARTIAL" || value === "PENDING"
            ? "warning"
            : "default";

  return <Chip size="small" label={value ?? "-"} color={color} variant={color === "default" ? "outlined" : "filled"} />;
}

export function ScoreBadge({ value, label }: { value?: number; label?: string }) {
  const display = value == null ? "-" : `${Math.round(value * 1000) / 10}%`;
  return <Chip size="small" variant="outlined" label={label ? `${label} ${display}` : display} />;
}

export function EvidenceBlock({ value }: { value?: string }) {
  if (!value) return <Typography variant="body2" color="text.secondary">근거 문장이 없습니다.</Typography>;
  return (
    <Box
      sx={(theme) => ({
        p: 1.5,
        borderRadius: 1,
        bgcolor: alpha(theme.palette.info.main, 0.08),
        border: `1px solid ${alpha(theme.palette.info.main, 0.18)}`,
      })}
    >
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
}

export function DetailDrawer({
  open,
  title,
  onClose,
  actions,
  children,
  width,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  actions?: ReactNode;
  children: ReactNode;
  width?: string | number | Record<string, string | number>;
}) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: width || { xs: 340, sm: 520 }, height: "100%", display: "flex", flexDirection: "column" }}>
        <Box sx={{ px: 2, pt: 2, bgcolor: "background.paper", borderBottom: 1, borderColor: "divider" }}>
          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
            <Typography variant="h6">{title}</Typography>
            {actions ? (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                {actions}
              </Stack>
            ) : null}
          </Stack>
          <Divider sx={{ mt: 2 }} />
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 2 }}>
          {children}
        </Box>
      </Box>
    </Drawer>
  );
}

export function MetricCard({ label, value, helper }: { label: string; value?: number | string; helper?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, minHeight: 104 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4" sx={{ mt: 1 }}>
        {typeof value === "number" ? value.toLocaleString() : value ?? "-"}
      </Typography>
      {helper ? (
        <Typography variant="caption" color="text.secondary">
          {helper}
        </Typography>
      ) : null}
    </Paper>
  );
}
