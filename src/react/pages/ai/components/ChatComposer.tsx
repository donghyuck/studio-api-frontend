import { useState } from "react";
import { AddOutlined, ArrowUpwardOutlined, CheckOutlined, ExpandMoreOutlined, HistoryOutlined, LanguageOutlined } from "@mui/icons-material";
import { alpha, Box, Button, IconButton, Menu, MenuItem, Popover, Stack, Tooltip, Typography } from "@mui/material";
import type { ProviderInfo } from "@/types/studio/ai";

const numberFormatter = new Intl.NumberFormat("ko-KR");

function formatNumber(value?: number) {
  return typeof value === "number" ? numberFormatter.format(value) : "-";
}

function formatMilliseconds(value?: number) {
  return typeof value === "number" ? `${numberFormatter.format(value)}ms` : "";
}

interface Props {
  input: string;
  sending: boolean;
  configurationMissing: boolean;
  model: string;
  provider: string;
  conversationId: string;
  chatModeLabel: string;
  chatModeDescription: string;
  latencyMs?: number;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  inputHistory: string[];
  selectedWebSourcesCount?: number;
  onOpenEvidenceDrawer?: () => void;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onOpenModelMenu: (event: React.MouseEvent<HTMLElement>) => void;
  modelMenuOpen: boolean;
  modelAnchorEl: HTMLElement | null;
  providers: ProviderInfo[];
  onCloseModelMenu: () => void;
  onSelectProvider: (provider: string) => void;
  onOpenSettings: () => void;
  onSelectHistory: (value: string) => void;
  controls?: React.ReactNode;
  settingsMenuLabel?: string;
  settingsMenuDescription?: string;
}

export function ChatComposer({
  input,
  sending,
  configurationMissing,
  model,
  provider,
  conversationId,
  chatModeLabel,
  chatModeDescription,
  latencyMs,
  tokenUsage,
  inputHistory,
  selectedWebSourcesCount = 0,
  onOpenEvidenceDrawer,
  onInputChange,
  onSubmit,
  onKeyDown,
  onOpenModelMenu,
  modelMenuOpen,
  modelAnchorEl,
  providers,
  onCloseModelMenu,
  onSelectProvider,
  onOpenSettings,
  onSelectHistory,
  controls,
  settingsMenuLabel = "더 많은 모델",
  settingsMenuDescription = "provider와 model을 직접 설정합니다.",
}: Props) {
  const [historyAnchorEl, setHistoryAnchorEl] = useState<HTMLElement | null>(null);
  const [contextAnchorEl, setContextAnchorEl] = useState<HTMLElement | null>(null);
  const historyMenuOpen = Boolean(historyAnchorEl);
  const contextMenuOpen = Boolean(contextAnchorEl);

  function handleSelectHistory(value: string) {
    onSelectHistory(value);
    setHistoryAnchorEl(null);
  }

  return (
    <Box sx={{ px: { xs: 1.5, md: 5 }, pb: 2 }}>
      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "8px",
          bgcolor: (theme) =>
            theme.palette.mode === "dark"
              ? alpha(theme.palette.common.white, 0.06)
              : theme.palette.background.paper,
          boxShadow: (theme) =>
            `0 8px 20px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.24 : 0.08)}`,
          px: 1.25,
          py: 1,
          maxWidth: 920,
          mx: "auto",
        }}
      >
        <Stack spacing={0.75}>
          <textarea
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="답글..."
            rows={1}
            style={{
              width: "100%",
              minHeight: 30,
              maxHeight: 120,
              resize: "none",
              border: 0,
              outline: "none",
              background: "transparent",
              color: "inherit",
              font: "inherit",
              fontSize: 14,
              lineHeight: 1.55,
            }}
          />
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            {onOpenEvidenceDrawer ? (
              <Tooltip title="자료 추가 (+)">
                <IconButton
                  size="small"
                  onClick={(event) => setContextAnchorEl(event.currentTarget)}
                  sx={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    bgcolor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(255, 255, 255, 0.12)"
                        : "rgba(0, 0, 0, 0.08)",
                    color: "text.primary",
                    "&:hover": {
                      bgcolor: (theme) =>
                        theme.palette.mode === "dark"
                          ? "rgba(255, 255, 255, 0.2)"
                          : "rgba(0, 0, 0, 0.14)",
                    },
                  }}
                >
                  <AddOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
            <Tooltip title="모델 선택">
              <Button
                size="small"
                variant="text"
                endIcon={<ExpandMoreOutlined fontSize="small" />}
                onClick={onOpenModelMenu}
                sx={{
                  color: "text.primary",
                  px: 1.25,
                  py: 0.3,
                  borderRadius: "16px",
                  fontSize: 12.5,
                  fontWeight: 500,
                  textTransform: "none",
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(255, 255, 255, 0.06)"
                      : "rgba(0, 0, 0, 0.04)",
                  "&:hover": {
                    bgcolor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(255, 255, 255, 0.1)"
                        : "rgba(0, 0, 0, 0.08)",
                  },
                }}
              >
                {model || "모델 설정"}
              </Button>
            </Tooltip>
            {controls ? <Box sx={{ display: "inline-flex", alignItems: "center" }}>{controls}</Box> : null}
            <Tooltip title="최근 질문">
              <span>
                <IconButton
                  size="small"
                  onClick={(event) => setHistoryAnchorEl(event.currentTarget)}
                  disabled={inputHistory.length === 0}
                  sx={{ width: 30, height: 30 }}
                >
                  <HistoryOutlined fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                <Tooltip title={chatModeDescription}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "inline-flex", alignItems: "center", px: 0.75, py: 0.25, borderRadius: "6px", bgcolor: "action.hover", fontSize: 11 }}>
                    {chatModeLabel}
                  </Typography>
                </Tooltip>
                {latencyMs ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "inline-flex", alignItems: "center", px: 0.75, py: 0.25, borderRadius: "6px", bgcolor: "action.hover", fontSize: 11 }}>
                    {formatMilliseconds(latencyMs)}
                  </Typography>
                ) : null}
                {tokenUsage ? (
                  <Tooltip
                    title={`input ${formatNumber(tokenUsage.inputTokens)} · output ${formatNumber(tokenUsage.outputTokens)} · total ${formatNumber(tokenUsage.totalTokens)}`}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ display: "inline-flex", alignItems: "center", px: 0.75, py: 0.25, borderRadius: "6px", bgcolor: "action.hover", fontSize: 11 }}>
                      tokens {formatNumber(tokenUsage.totalTokens)}
                    </Typography>
                  </Tooltip>
                ) : null}
                {conversationId ? (
                  <Tooltip title={conversationId}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "inline-flex", alignItems: "center", px: 0.75, py: 0.25, borderRadius: "6px", bgcolor: "action.hover", fontSize: 11 }}>
                      {conversationId.slice(0, 12)}
                    </Typography>
                  </Tooltip>
                ) : null}
              </Stack>
            </Box>
              <Tooltip title="보내기">
                <span>
                  <IconButton
                    color="primary"
                    onClick={onSubmit}
                    disabled={sending || !input.trim() || configurationMissing}
	                    sx={{
	                      width: 34,
	                      height: 34,
	                      bgcolor: (theme) =>
                          theme.palette.mode === "dark" ? "#0d47a1" : "#0b3d91",
	                      color: "primary.contrastText",
	                      "&:hover": {
	                        bgcolor: (theme) =>
	                          theme.palette.mode === "dark" ? "#1565c0" : "#072f70",
	                        color: "primary.contrastText",
	                      },
                      "&.Mui-disabled": {
                        bgcolor: "action.disabledBackground",
                        color: "action.disabled",
                      },
                    }}
	                  >
	                    <ArrowUpwardOutlined sx={{ fontSize: 18 }} />
	                  </IconButton>
	                </span>
	              </Tooltip>
          </Stack>
        </Stack>
      </Box>
      <Menu
        anchorEl={historyAnchorEl}
        open={historyMenuOpen}
        onClose={() => setHistoryAnchorEl(null)}
        slotProps={{
          paper: {
            sx: {
              width: 360,
              maxWidth: "calc(100vw - 32px)",
            },
          },
        }}
      >
        {inputHistory.slice(0, 8).map((historyItem) => (
          <MenuItem key={historyItem} onClick={() => handleSelectHistory(historyItem)}>
            <Typography variant="body2" noWrap title={historyItem}>
              {historyItem}
            </Typography>
          </MenuItem>
        ))}
      </Menu>
      <Popover open={modelMenuOpen} anchorEl={modelAnchorEl} onClose={onCloseModelMenu} anchorOrigin={{ vertical: "top", horizontal: "right" }} transformOrigin={{ vertical: "bottom", horizontal: "right" }} PaperProps={{ sx: { width: 360, borderRadius: 2, p: 1, mb: 1 } }}>
        <Stack spacing={0.5}>
          {providers.filter((item) => item.chat.enabled).map((item) => {
            const selected = item.name === provider;
            return (
              <Button key={item.name} variant="text" onClick={() => onSelectProvider(item.name)} sx={{ justifyContent: "space-between", textAlign: "left", color: "text.primary", px: 1.5, py: 1 }}>
                <Box>
                  <Typography variant="body2">{item.chat.model || item.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{item.name}</Typography>
                </Box>
                {selected ? <CheckOutlined color="primary" fontSize="small" /> : null}
              </Button>
            );
          })}
          <Button variant="text" onClick={onOpenSettings} sx={{ justifyContent: "space-between", color: "text.primary", px: 1.5, py: 1 }}>
            <Box>
              <Typography variant="body2">{settingsMenuLabel}</Typography>
              <Typography variant="caption" color="text.secondary">{settingsMenuDescription}</Typography>
            </Box>
            <ExpandMoreOutlined fontSize="small" sx={{ transform: "rotate(-90deg)" }} />
          </Button>
        </Stack>
      </Popover>

      <Popover
        open={contextMenuOpen}
        anchorEl={contextAnchorEl}
        onClose={() => setContextAnchorEl(null)}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        PaperProps={{ sx: { width: 280, borderRadius: 2.5, p: 0.75, mb: 1 } }}
      >
        <MenuItem
          onClick={() => {
            setContextAnchorEl(null);
            onOpenEvidenceDrawer?.();
          }}
          sx={{ borderRadius: 1.5, gap: 1.5, py: 1.2 }}
        >
          <LanguageOutlined fontSize="small" color="primary" />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              웹 참고자료 (URL 수집·선택)
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {selectedWebSourcesCount > 0
                ? `${selectedWebSourcesCount}개 웹 자료 선택됨`
                : "공개 HTTPS URL 수집 및 색인 자료 선택"}
            </Typography>
          </Box>
        </MenuItem>
      </Popover>
    </Box>
  );
}
