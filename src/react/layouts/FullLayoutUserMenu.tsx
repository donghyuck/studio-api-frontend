import {
  alpha,
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
      >
        <Avatar
          alt={displayName}
          src={profileImageUrl}
          imgProps={{
            onError: (event) => {
              event.currentTarget.src = fallbackImageUrl;
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
        <ClickAwayListener onClickAway={closeMenu}>
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
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                borderBottom: "1px solid",
                borderColor: "divider",
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
                <Typography variant="subtitle2" noWrap>
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
              sx={{ px: 2.5, py: 1.25 }}
            >
              <ListItemIcon>
                <AccountCircleOutlined fontSize="small" />
              </ListItemIcon>
              <MuiListItemText primary="내 프로필" secondary={username} />
            </MenuItem>
            <MenuItem
              onClick={() => {
                closeMenu();
                onPasswordChange();
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
                    onThemeModeChange(nextMode);
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
                  closeMenu();
                  onLogout();
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
