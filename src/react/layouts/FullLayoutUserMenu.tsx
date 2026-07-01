import {
  Avatar,
  Box,
  Button,
  ClickAwayListener,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText as MuiListItemText,
  MenuItem,
  Paper,
  Popper,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  AccountCircleOutlined,
  ComputerOutlined,
  DarkModeOutlined,
  LightModeOutlined,
  ListAltOutlined,
  LogoutOutlined,
} from "@mui/icons-material";
import { useState } from "react";
import type { ThemeMode } from "@/react/theme/AppThemeProvider";

interface FullLayoutUserMenuProps {
  displayName: string;
  emailOrUsername: string;
  profileImageUrl: string;
  fallbackImageUrl: string;
  username?: string;
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  onProfile: () => void;
  onPasswordChange: () => void;
  onLogout: () => void;
}

export function FullLayoutUserMenu({
  displayName,
  emailOrUsername,
  profileImageUrl,
  fallbackImageUrl,
  username,
  themeMode,
  onThemeModeChange,
  onProfile,
  onPasswordChange,
  onLogout,
}: FullLayoutUserMenuProps) {
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);
  const profileOpen = Boolean(profileAnchor);

  function closeMenu() {
    setProfileAnchor(null);
  }

  return (
    <>
      <Box sx={{ textAlign: "right", display: { xs: "none", sm: "block" } }}>
        <Typography variant="caption" color="text.primary" fontWeight={600} sx={{ lineHeight: 1.1, display: "block" }}>
          {displayName}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, lineHeight: 1.1 }}>
          {emailOrUsername}
        </Typography>
      </Box>
      <IconButton
        onClick={(event) =>
          setProfileAnchor((anchor) => (anchor ? null : event.currentTarget))
        }
        size="small"
        aria-label="사용자 메뉴"
        sx={{
          p: 0.25,
          transition: "transform 150ms ease",
          "&:hover": {
            transform: "scale(1.05)",
          },
        }}
      >
        <Avatar
          alt={displayName}
          src={profileImageUrl}
          imgProps={{
            onError: (event) => {
              event.currentTarget.src = fallbackImageUrl;
            },
          }}
          sx={{
            width: 32,
            height: 32,
            bgcolor: "grey.200",
            border: (theme) => `1.5px solid ${theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)"}`,
            transition: "border-color 150ms ease",
            "&:hover": {
              borderColor: "primary.main",
            },
          }}
        />
      </IconButton>
      <Popper
        open={profileOpen}
        anchorEl={profileAnchor}
        placement="bottom-end"
        sx={{ zIndex: (muiTheme) => muiTheme.zIndex.modal }}
      >
        <ClickAwayListener onClickAway={closeMenu}>
          <Paper
            elevation={12}
            sx={{
              width: 320,
              mt: 1.5,
              borderRadius: 3.5,
              overflow: "hidden",
              border: "1px solid",
              borderColor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.08)",
              bgcolor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(17, 24, 39, 0.85)"
                  : "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <Box
              sx={{
                px: 2.5,
                py: 2,
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                bgcolor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.02)"
                    : "rgba(0, 0, 0, 0.01)",
                borderBottom: "1px solid",
                borderColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.06)",
              }}
            >
              <Avatar
                alt={displayName}
                src={profileImageUrl}
                imgProps={{
                  onError: (event) => {
                    event.currentTarget.src = fallbackImageUrl;
                  },
                }}
                sx={{ width: 42, height: 42, bgcolor: "grey.200" }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" noWrap fontWeight={600}>
                  {displayName}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {emailOrUsername}
                </Typography>
              </Box>
            </Box>
            <MenuItem
              onClick={() => {
                closeMenu();
                onProfile();
              }}
              sx={{
                px: 2.5,
                py: 1.25,
                transition: "all 150ms ease",
                "&:hover": {
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255, 255, 255, 0.04)"
                      : "rgba(0, 0, 0, 0.02)",
                },
              }}
            >
              <ListItemIcon>
                <AccountCircleOutlined fontSize="small" />
              </ListItemIcon>
              <MuiListItemText
                primary="내 프로필"
                secondary={username}
                primaryTypographyProps={{ fontSize: 13.5, fontWeight: 500 }}
              />
            </MenuItem>
            <MenuItem
              onClick={() => {
                closeMenu();
                onPasswordChange();
              }}
              sx={{
                px: 2.5,
                py: 1.25,
                transition: "all 150ms ease",
                "&:hover": {
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255, 255, 255, 0.04)"
                      : "rgba(0, 0, 0, 0.02)",
                },
              }}
            >
              <ListItemIcon>
                <ListAltOutlined fontSize="small" />
              </ListItemIcon>
              <MuiListItemText
                primary="비밀번호 변경"
                primaryTypographyProps={{ fontSize: 13.5, fontWeight: 500 }}
              />
            </MenuItem>
            <Divider
              sx={{
                borderColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.06)",
              }}
            />
            <Box sx={{ px: 2.5, py: 1.5 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ mb: 1, fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}
              >
                테마
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={themeMode}
                onChange={(_, nextMode) => {
                  if (nextMode) {
                    onThemeModeChange(nextMode);
                  }
                }}
                sx={{
                  "& .MuiToggleButton-root": {
                    borderRadius: "6px",
                    border: (theme) =>
                      `1px solid ${theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)"}`,
                    mx: 0.25,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "none",
                    color: "text.secondary",
                    "&.Mui-selected": {
                      bgcolor: "primary.main",
                      color: "primary.contrastText",
                      borderColor: "primary.main",
                      "&:hover": {
                        bgcolor: "primary.dark",
                      },
                    },
                  },
                }}
              >
                <ToggleButton value="system" sx={{ gap: 0.5 }}>
                  <ComputerOutlined sx={{ fontSize: 14 }} />
                  시스템
                </ToggleButton>
                <ToggleButton value="light" sx={{ gap: 0.5 }}>
                  <LightModeOutlined sx={{ fontSize: 14 }} />
                  라이트
                </ToggleButton>
                <ToggleButton value="dark" sx={{ gap: 0.5 }}>
                  <DarkModeOutlined sx={{ fontSize: 14 }} />
                  다크
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Divider
              sx={{
                borderColor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.06)",
              }}
            />
            <Box sx={{ px: 2.5, py: 2 }}>
              <Button
                variant="outlined"
                color="primary"
                fullWidth
                startIcon={<LogoutOutlined fontSize="small" />}
                onClick={() => {
                  closeMenu();
                  onLogout();
                }}
                sx={{
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: 13,
                  py: 0.75,
                }}
              >
                로그아웃
              </Button>
            </Box>
          </Paper>
        </ClickAwayListener>
      </Popper>
    </>
  );
}
