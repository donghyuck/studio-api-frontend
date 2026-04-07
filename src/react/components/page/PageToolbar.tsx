import {
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
  ArrowBackIosNewOutlined,
  CloseOutlined,
  RefreshOutlined,
  SearchOutlined,
} from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";

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
}

export function PageToolbar({
  breadcrumbs,
  title,
  label,
  actions,
  prepend,
  closeable = false,
  previous = false,
  divider = true,
  onPrevious,
  onRefresh,
  onClose,
  searchPlaceholder = "검색어",
  searchValue = "",
  onSearchValueChange,
  onSearch,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!searchOpen) {
      return;
    }

    window.setTimeout(() => searchInputRef.current?.focus(), 120);
  }, [searchOpen]);

  function submitSearch() {
    onSearch?.(searchValue);
  }

  return (
    <Stack spacing={0}>
      <Stack spacing={1}>
        {breadcrumbs?.length ? (
          <Breadcrumbs separator="›" sx={{ fontSize: 12 }}>
            {breadcrumbs.map((item, index) => (
              <Typography
                key={`${item}-${index}`}
                color={index === breadcrumbs.length - 1 ? "text.primary" : "text.secondary"}
                fontSize={12}
              >
                {item}
              </Typography>
            ))}
          </Breadcrumbs>
        ) : null}

        <Box
          sx={{
            minHeight: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            {previous ? (
              <Tooltip title="이전">
                <IconButton size="small" onClick={onPrevious}>
                  <ArrowBackIosNewOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
            {prepend}
            <Box sx={{ minWidth: 0 }}>
              {title ? (
                <Typography variant="h5" noWrap>
                  {title}
                </Typography>
              ) : null}
              {label ? (
                <Typography variant="caption" color="text.secondary" display="block" noWrap>
                  {label}
                </Typography>
              ) : null}
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
            {actions}
            {onSearch ? (
              <Box
                sx={{
                  width: searchOpen ? { xs: 180, sm: 260, md: 320 } : 0,
                  opacity: searchOpen ? 1 : 0,
                  overflow: "hidden",
                  transition: "width 160ms ease, opacity 120ms ease",
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

      {divider ? <Divider sx={{ mt: "4px", borderColor: "rgba(148, 163, 184, 0.45)" }} /> : null}
    </Stack>
  );
}
