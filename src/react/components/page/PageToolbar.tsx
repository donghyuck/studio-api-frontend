import {
  alpha,
  Box,
  Breadcrumbs,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ArrowBackOutlined,
  CloseOutlined,
  RefreshOutlined,
  SearchOutlined,
} from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  breadcrumbs?: string[];
  title?: string;
  label?: string;
  actions?: React.ReactNode;
  prepend?: React.ReactNode;
  closeable?: boolean;
  previous?: boolean;
  divider?: boolean;
  onPrevious?: () => void;
  onRefresh?: () => void;
  onClose?: () => void;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  hasGrid?: boolean;
}

export function PageToolbar({
  breadcrumbs,
  title,
  label,
  actions,
  prepend,
  closeable = false,
  previous = false,
  divider,
  onPrevious,
  onRefresh,
  onClose,
  searchPlaceholder = "검색어",
  searchValue = "",
  onSearchValueChange,
  onSearch,
  hasGrid = false,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  const showDivider = divider !== undefined ? divider : !hasGrid;
  const mbValue = hasGrid ? 2 : 3;

  useEffect(() => {
    setPortalTarget(document.getElementById("layout-breadcrumbs-portal"));
  }, []);

  useEffect(() => {
    if (!searchOpen) {
      return;
    }

    window.setTimeout(() => searchInputRef.current?.focus(), 120);
  }, [searchOpen]);

  function submitSearch() {
    onSearch?.(searchValue);
  }

  const breadcrumbsContent = breadcrumbs?.length ? (
    <Breadcrumbs
      separator="›"
      sx={{
        "& .MuiBreadcrumbs-separator": {
          mx: 0.75,
          opacity: 0.6,
        },
      }}
    >
      {breadcrumbs.map((item, index) => (
        <Typography
          key={`${item}-${index}`}
          color={index === breadcrumbs.length - 1 ? "text.primary" : "text.secondary"}
          sx={{
            fontSize: 11,
            fontWeight: index === breadcrumbs.length - 1 ? 600 : 500,
            letterSpacing: "-0.01em",
          }}
        >
          {item}
        </Typography>
      ))}
    </Breadcrumbs>
  ) : null;

  return (
    <Stack spacing={0} sx={{ mb: mbValue }}>
      {portalTarget && breadcrumbsContent
        ? createPortal(breadcrumbsContent, portalTarget)
        : !portalTarget
        ? breadcrumbsContent
        : null}

      <Stack spacing={1}>

        <Box
          sx={{
            minHeight: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
            {previous ? (
              <Tooltip title="이전">
                <IconButton
                  size="small"
                  onClick={onPrevious}
                  sx={{
                    transition: "transform 200ms ease",
                    "&:hover": {
                      transform: "translateX(-3px) scale(1.08)",
                      color: "primary.main",
                    },
                  }}
                >
                  <ArrowBackOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
            {prepend}
            <Box sx={{ minWidth: 0 }}>
              {title ? (
                <Typography variant="h5" noWrap fontWeight={700}>
                  {title}
                </Typography>
              ) : null}
              {label ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  noWrap
                  sx={{ fontSize: 12, mt: 0.25 }}
                >
                  {label}
                </Typography>
              ) : null}
            </Box>
          </Stack>

          <Stack
            direction="row"
            spacing={0}
            alignItems="center"
            flexShrink={0}
            sx={{
              "& .MuiIconButton-root": {
                ml: 0.5,
                transition: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
                "&:hover": {
                  transform: "scale(1.08)",
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                },
              },
            }}
          >
            {actions}
            {onSearch ? (
              <Box
                sx={{
                  width: searchOpen ? { xs: 180, sm: 260, md: 320 } : 0,
                  opacity: searchOpen ? 1 : 0,
                  ml: searchOpen ? 1.5 : 0,
                  mr: searchOpen ? 1.5 : 0,
                  overflow: "hidden",
                  transition: "all 250ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                <TextField
                  inputRef={searchInputRef}
                  size="small"
                  fullWidth
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={(event) => onSearchValueChange?.(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      submitSearch();
                    }
                    if (event.key === "Escape") {
                      setSearchOpen(false);
                    }
                  }}
                  onBlur={() => {
                    window.setTimeout(() => setSearchOpen(false), 120);
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "8px",
                      bgcolor: (theme) =>
                        theme.palette.mode === "dark"
                          ? "rgba(255, 255, 255, 0.03)"
                          : "rgba(0, 0, 0, 0.02)",
                      transition: "all 150ms ease",
                      "&:hover": {
                        bgcolor: (theme) =>
                          theme.palette.mode === "dark"
                            ? "rgba(255, 255, 255, 0.05)"
                            : "rgba(0, 0, 0, 0.03)",
                      },
                      "&.Mui-focused": {
                        boxShadow: (theme) =>
                          `0 0 0 3px ${alpha(theme.palette.primary.main, 0.16)}`,
                        borderColor: "primary.main",
                      },
                    },
                  }}
                  InputProps={{
                    endAdornment: (
                      <IconButton size="small" onClick={submitSearch}>
                        <SearchOutlined fontSize="small" />
                      </IconButton>
                    ),
                  }}
                />
              </Box>
            ) : null}
            {onSearch && !searchOpen ? (
              <Tooltip title="검색">
                <IconButton size="small" onClick={() => setSearchOpen((value) => !value)}>
                  <SearchOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
            {onRefresh ? (
              <Tooltip title="새로고침">
                <IconButton size="small" onClick={onRefresh}>
                  <RefreshOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
            {closeable ? (
              <Tooltip title="닫기">
                <IconButton size="small" onClick={onClose}>
                  <CloseOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>
        </Box>
      </Stack>

      {showDivider ? (
        <Divider
          sx={{
            mt: 1.5,
            borderColor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255, 255, 255, 0.08)"
                : "rgba(0, 0, 0, 0.06)",
          }}
        />
      ) : null}
    </Stack>
  );
}
