import { useState } from "react";
import { ArrowUpwardOutlined, CheckOutlined, ExpandMoreOutlined, HistoryOutlined } from "@mui/icons-material";
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
  const historyMenuOpen = Boolean(historyAnchorEl);

  function handleSelectHistory(value: string) {
    onSelectHistory(value);
    setHistoryAnchorEl(null);
  }

  return (
    <Box sx={{ px: { xs: 1, md: 4 }, pb: 2 }}>
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
          {controls ? <Box>{controls}</Box> : null}
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Tooltip title="최근 질문">
              <span>
                <IconButton
                  size="small"
                  onClick={(event) => setHistoryAnchorEl(event.currentTarget)}
                  disabled={inputHistory.length === 0}
                  sx={{ width: 32, height: 32 }}
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
              <Tooltip title="모델 선택">
                <Button size="small" variant="text" endIcon={<ExpandMoreOutlined fontSize="small" />} onClick={onOpenModelMenu} sx={{ color: "text.primary", px: 1, minWidth: 0 }}>
                  {model || "모델 설정"}
                </Button>
              </Tooltip>
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
    </Box>
  );
}
