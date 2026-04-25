import { ArrowUpwardOutlined, CheckOutlined, ExpandMoreOutlined } from "@mui/icons-material";
import { Box, Button, Card, CardContent, Chip, IconButton, Popover, Stack, Tooltip, Typography } from "@mui/material";
import type { ProviderInfo } from "@/types/studio/ai";

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
}: Props) {
  return (
    <Box sx={{ px: { xs: 1, md: 4 }, pb: 2 }}>
      <Card variant="outlined" sx={{ borderRadius: 3, bgcolor: "background.paper" }}>
        <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack spacing={1}>
            <textarea
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="답글..."
              rows={3}
              style={{
                width: "100%",
                minHeight: 64,
                maxHeight: 160,
                resize: "vertical",
                border: 0,
                outline: "none",
                background: "transparent",
                color: "inherit",
                font: "inherit",
              }}
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  <Tooltip title={chatModeDescription}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "inline-flex", alignItems: "center", px: 0.75, py: 0.25, borderRadius: 1, bgcolor: "action.hover", fontSize: 11 }}>
                      {chatModeLabel}
                    </Typography>
                  </Tooltip>
                  <Tooltip title="현재 provider">
                    <Typography variant="caption" color="text.secondary" sx={{ display: "inline-flex", alignItems: "center", px: 0.75, py: 0.25, borderRadius: 1, bgcolor: "action.hover", fontSize: 11 }}>
                      {provider || "default"}
                    </Typography>
                  </Tooltip>
                  <Tooltip title="현재 model">
                    <Typography variant="caption" color="text.secondary" sx={{ display: "inline-flex", alignItems: "center", px: 0.75, py: 0.25, borderRadius: 1, bgcolor: "action.hover", fontSize: 11, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {model || "미설정"}
                    </Typography>
                  </Tooltip>
                  {latencyMs ? (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "inline-flex", alignItems: "center", px: 0.75, py: 0.25, borderRadius: 1, bgcolor: "action.hover", fontSize: 11 }}>
                      {latencyMs}ms
                    </Typography>
                  ) : null}
                  {conversationId ? (
                    <Tooltip title={conversationId}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "inline-flex", alignItems: "center", px: 0.75, py: 0.25, borderRadius: 1, bgcolor: "action.hover", fontSize: 11 }}>
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
                  <IconButton color="primary" onClick={onSubmit} disabled={sending || !input.trim() || configurationMissing} sx={{ width: 40, height: 40, bgcolor: "primary.main", color: "primary.contrastText" }}>
                    <ArrowUpwardOutlined fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ sm: "center" }}
              justifyContent="space-between"
            >
              <Typography variant="caption" color="text.secondary">
                `Ctrl/Cmd + Enter` 전송 · 빈 입력에서 `ArrowUp/Down` 최근 질문
              </Typography>
              {inputHistory.length > 0 ? (
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {inputHistory.slice(0, 3).map((historyItem) => (
                    <Chip
                      key={historyItem}
                      size="small"
                      variant="outlined"
                      label={historyItem.length > 18 ? `${historyItem.slice(0, 18)}…` : historyItem}
                      onClick={() => onSelectHistory(historyItem)}
                    />
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
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
              <Typography variant="body2">더 많은 모델</Typography>
              <Typography variant="caption" color="text.secondary">provider와 model을 직접 설정합니다.</Typography>
            </Box>
            <ExpandMoreOutlined fontSize="small" sx={{ transform: "rotate(-90deg)" }} />
          </Button>
        </Stack>
      </Popover>
    </Box>
  );
}
