import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Popover,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ArrowUpwardOutlined,
  CheckOutlined,
  ContentCopyOutlined,
  EditNoteOutlined,
  ExpandMoreOutlined,
  SettingsOutlined,
  SmartToyOutlined,
} from "@mui/icons-material";
import { reactAiApi } from "@/react/pages/ai/api";
import type { AiInfoResponse, ChatMessageDto, ProviderInfo } from "@/types/studio/ai";
import { resolveAxiosError } from "@/utils/helpers";
import { PageToolbar } from "@/react/components/page/PageToolbar";

type ChatMessage = ChatMessageDto & {
  id?: string;
  createdAt?: string;
  model?: string;
  metadata?: Record<string, unknown>;
};

export function ChatPage() {
  const [aiInfo, setAiInfo] = useState<AiInfoResponse | null>(null);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelAnchorEl, setModelAnchorEl] = useState<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const providers = useMemo<ProviderInfo[]>(() => aiInfo?.providers ?? [], [aiInfo]);
  const selectedProvider = providers.find((item) => item.name === provider);
  const configurationMissing = !provider || !model;
  const serverMemoryEnabled = aiInfo?.chat?.memory?.enabled === true;
  const modelMenuOpen = Boolean(modelAnchorEl);

  useEffect(() => {
    reactAiApi
      .fetchProviders()
      .then((data) => {
        setAiInfo(data);
        setProvider(data.defaultProvider);
        const match = data.providers.find((item) => item.name === data.defaultProvider);
        setModel(match?.chat.model ?? "");
      })
      .catch((loadError) => setError(resolveAxiosError(loadError)));
  }, []);

  function handleProviderChange(nextProvider: string) {
    setProvider(nextProvider);
    const match = providers.find((item) => item.name === nextProvider);
    setModel(match?.chat.model ?? "");
  }

  function handleModelMenuClose() {
    setModelAnchorEl(null);
  }

  function handleModelSelect(nextProvider: string) {
    handleProviderChange(nextProvider);
    handleModelMenuClose();
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const nextMessages: ChatMessage[] = [...messages, userMessage];
    const requestMessages = memoryEnabled ? [userMessage] : nextMessages;
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);
    try {
      const response = await reactAiApi.sendChat({
        provider: provider || undefined,
        model: model || undefined,
        messages: requestMessages,
        systemPrompt: systemPrompt.trim() || undefined,
        memory: memoryEnabled ? { enabled: true, conversationId } : undefined,
      });
      const assistant = [...response.messages].reverse().find((item) => item.role === "assistant");
      if (assistant) {
        setMessages((current) => [
          ...current,
          { ...assistant, id: crypto.randomUUID(), model: response.model ?? model, metadata: response.metadata, createdAt: new Date().toISOString() },
        ]);
      }
    } catch (sendError) {
      const message = resolveAxiosError(sendError);
      setError(message);
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content: `오류: ${message}`, model, createdAt: new Date().toISOString() },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleNewConversation() {
    setConversationId(crypto.randomUUID());
    setMessages([]);
    setInput("");
    setError(null);
  }

  function renderTokenUsage(metadata?: Record<string, unknown>) {
    const usage = metadata?.tokenUsage as
      | { inputTokens?: number; outputTokens?: number; totalTokens?: number }
      | undefined;
    if (!usage) return null;

    return (
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: "block", fontSize: 11 }}>
        tokens · input {usage.inputTokens ?? "-"} · output {usage.outputTokens ?? "-"} · total{" "}
        {usage.totalTokens ?? "-"}
      </Typography>
    );
  }

  function formatMessageTime(value?: string) {
    if (!value) return "";
    return new Date(value).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function handleCopyMessage(content: string) {
    await navigator.clipboard.writeText(content);
  }

  function handleEditMessage(index: number, content: string) {
    setInput(content);
    setMessages((current) => current.slice(0, index));
  }

  return (
    <Stack spacing={1}>
      <PageToolbar
        divider={true}
        breadcrumbs={["서비스 관리", "AI", "Chat"]}
        label="Provider와 모델을 선택해 AI Chat 요청을 보냅니다."
        actions={
          <>
            <Tooltip title={memoryEnabled ? "새 대화 시작" : "대화 기억을 켜면 새 대화를 시작할 수 있습니다"}>
              <span>
                <IconButton size="small" onClick={handleNewConversation} disabled={!memoryEnabled}>
                  <EditNoteOutlined fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="설정">
              <IconButton size="small" onClick={() => setSettingsOpen(true)}>
                <SettingsOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        }
      />
      {error ? <Alert severity="error">{error}</Alert> : null}
      {configurationMissing ? (
        <Alert severity="warning">
          AI Chat을 사용하려면 Provider와 Model 설정이 필요합니다. 상단 설정 아이콘을 눌러 사용할
          provider와 모델을 선택하거나 입력하세요.
        </Alert>
      ) : null}
      {memoryEnabled ? (
        <Alert severity="info">
          대화 기억 사용 중입니다. 새 대화를 시작하면 이전 대화와 분리됩니다.
        </Alert>
      ) : null}

      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: { borderRadius: 3 },
          },
        }}
      >
        <DialogTitle>AI 모델 설정</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Alert severity="info">
              Provider를 비우면 서버 기본 provider가 사용됩니다. System Prompt는 별도 systemPrompt
              필드로 전송되며, 대화 메시지에는 사용자와 assistant 메시지만 유지됩니다.
            </Alert>
            {serverMemoryEnabled ? (
              <Alert severity="info">
                서버가 conversationId 기반 대화 기억을 지원합니다. 켜면 이전 대화는 서버 메모리에서
                이어지며, 클라이언트는 현재 턴 메시지만 전송합니다.
              </Alert>
            ) : (
              <Alert severity="warning">
                서버에서 대화 기억 기능이 비활성화되어 있습니다.
              </Alert>
            )}
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                select
                label="Provider"
                value={provider}
                onChange={(event) => handleProviderChange(event.target.value)}
                fullWidth
                size="small"
              >
                {providers.map((item) => (
                  <MenuItem key={item.name} value={item.name}>
                    <Stack spacing={0}>
                      <Typography variant="body2">{item.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        chat: {item.chat.enabled ? item.chat.model : "disabled"}
                      </Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="Model" value={model} onChange={(event) => setModel(event.target.value)} fullWidth size="small" />
            </Stack>
            {selectedProvider ? (
              <Typography variant="caption" color="text.secondary">
                Embedding: {selectedProvider.embedding.enabled ? selectedProvider.embedding.model : "disabled"}
                {aiInfo?.vector.available ? ` · Vector: ${aiInfo.vector.implementation}` : " · Vector: unavailable"}
              </Typography>
            ) : null}
            <TextField
              label="System Prompt"
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
              multiline
              minRows={2}
              size="small"
              fullWidth
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Stack spacing={0} sx={{ flex: 1 }}>
                <Typography variant="body2">대화 기억</Typography>
                <Typography variant="caption" color="text.secondary">
                  {memoryEnabled ? `사용 중 · ${conversationId}` : "사용하지 않음"}
                </Typography>
              </Stack>
              <Switch
                checked={memoryEnabled}
                disabled={!serverMemoryEnabled}
                onChange={(event) => setMemoryEnabled(event.target.checked)}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setSettingsOpen(false)}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      <Paper
        elevation={0}
        sx={{ minHeight: "calc(100vh - 170px)", display: "flex", flexDirection: "column" }}
      >
        <Box sx={{ flex: 1, overflowY: "auto", px: { xs: 1, md: 8 }, py: 3 }}>
          <Stack spacing={2}>
            {messages.length === 0 ? (
              <Stack spacing={1} alignItems="center" justifyContent="center" sx={{ minHeight: 260 }}>
                <Avatar sx={{ bgcolor: "primary.main" }}>
                  <SmartToyOutlined />
                </Avatar>
                <Typography color="text.secondary">메시지를 입력해 AI와 대화를 시작하세요.</Typography>
              </Stack>
            ) : (
              messages.map((message, index) => (
                <Stack
                  key={`${message.role}-${index}`}
                  direction="row"
                  justifyContent={message.role === "user" ? "flex-end" : "flex-start"}
                  sx={{
                    "& .user-message-actions": {
                      opacity: 0,
                      transition: "opacity 120ms ease",
                    },
                    "&:hover .user-message-actions": {
                      opacity: 1,
                    },
                  }}
                >
                  <Stack spacing={0.5} alignItems={message.role === "user" ? "flex-end" : "flex-start"}>
                    <Box
                      sx={{
                        maxWidth: { xs: "92%", md: message.role === "user" ? "76%" : "72%" },
                        px: message.role === "user" ? 1.75 : 2,
                        py: message.role === "user" ? 1 : 1.5,
                        borderRadius: message.role === "user" ? 2 : "18px 18px 18px 4px",
                        bgcolor: message.role === "user" ? "rgba(2, 132, 199, 0.10)" : "background.paper",
                        color: message.role === "user" ? "info.main" : "text.primary",
                        border: "none",
                        boxShadow: message.role === "user" ? "0 1px 2px rgba(15, 23, 42, 0.08)" : "none",
                      }}
                    >
                      {message.role === "assistant" ? (
                        <Typography variant="ca
                        ption" color="text.secondary">
                          Assistant{message.model ? ` · ${message.model}` : ""}
                        </Typography>
                      ) : null}
                      <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: message.role === "assistant" ? 13 : 14 }}>
                        {message.content}
                      </Typography>
                      {message.role === "assistant" ? renderTokenUsage(message.metadata) : null}
                    </Box>
                    {message.role === "user" ? (
                      <Stack
                        className="user-message-actions"
                        direction="row"
                        spacing={0.5}
                        alignItems="center"
                        sx={{ pr: 0.5 }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {formatMessageTime(message.createdAt)}
                        </Typography>
                        <Tooltip title="복사">
                          <IconButton size="small" onClick={() => void handleCopyMessage(message.content)}>
                            <ContentCopyOutlined fontSize="inherit" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="편집">
                          <IconButton size="small" onClick={() => handleEditMessage(index, message.content)}>
                            <EditNoteOutlined fontSize="inherit" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    ) : null}
                  </Stack>
                </Stack>
              ))
            )}
            {sending ? (
              <Stack direction="row" justifyContent="flex-start">
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <CircularProgress size={16} />
                  <Typography variant="body2" color="text.secondary">
                    응답 생성 중...
                  </Typography>
                </Box>
              </Stack>
            ) : null}
          </Stack>
        </Box>
        <Box sx={{ px: { xs: 1, md: 6 }, pb: 2 }}>
          <Card
            variant="outlined"
            sx={{
              borderRadius: 3,
              bgcolor: "background.paper",
              boxShadow: "0 8px 28px rgba(15, 23, 42, 0.08)",
            }}
          >
            <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
              <Stack spacing={1}>
                <TextField
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                      void handleSend();
                    }
                  }}
                  placeholder="답글..."
                  multiline
                  minRows={2}
                  maxRows={6}
                  fullWidth
                  variant="standard"
                  InputProps={{ disableUnderline: true }}
                />
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title="모델 선택">
                    <Button
                      size="small"
                      variant="text"
                      endIcon={<ExpandMoreOutlined fontSize="small" />}
                      onClick={(event) => setModelAnchorEl(event.currentTarget)}
                      sx={{
                        color: "text.primary",
                        px: 1,
                        minWidth: 0,
                        "&:hover": { bgcolor: "action.hover" },
                      }}
                    >
                      {model || "모델 설정"}
                    </Button>
                  </Tooltip>
                  <Tooltip title="보내기">
                    <span>
                      <IconButton
                        color="primary"
                        onClick={() => void handleSend()}
                        disabled={sending || !input.trim() || configurationMissing}
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: "primary.main",
                          color: "primary.contrastText",
                          "&:hover": { bgcolor: "primary.dark" },
                          "&.Mui-disabled": {
                            bgcolor: "action.disabledBackground",
                            color: "action.disabled",
                          },
                        }}
                      >
                        <ArrowUpwardOutlined fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
          <Popover
            open={modelMenuOpen}
            anchorEl={modelAnchorEl}
            onClose={handleModelMenuClose}
            anchorOrigin={{ vertical: "top", horizontal: "right" }}
            transformOrigin={{ vertical: "bottom", horizontal: "right" }}
            PaperProps={{
              sx: {
                width: 360,
                borderRadius: 2,
                p: 1,
                mb: 1,
              },
            }}
          >
            <Stack spacing={0.5}>
              {providers
                .filter((item) => item.chat.enabled)
                .map((item) => {
                  const selected = item.name === provider;
                  return (
                    <Button
                      key={item.name}
                      variant="text"
                      onClick={() => handleModelSelect(item.name)}
                      sx={{
                        justifyContent: "space-between",
                        textAlign: "left",
                        color: "text.primary",
                        px: 1.5,
                        py: 1,
                      }}
                    >
                      <Box>
                        <Typography variant="body2">{item.chat.model || item.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.name}
                        </Typography>
                      </Box>
                      {selected ? <CheckOutlined color="primary" fontSize="small" /> : null}
                    </Button>
                  );
                })}
              <Button
                variant="text"
                onClick={() => {
                  handleModelMenuClose();
                  setSettingsOpen(true);
                }}
                sx={{ justifyContent: "space-between", color: "text.primary", px: 1.5, py: 1 }}
              >
                <Box>
                  <Typography variant="body2">더 많은 모델</Typography>
                  <Typography variant="caption" color="text.secondary">
                    provider와 model을 직접 설정합니다.
                  </Typography>
                </Box>
                <ExpandMoreOutlined fontSize="small" sx={{ transform: "rotate(-90deg)" }} />
              </Button>
            </Stack>
          </Popover>
          <Typography variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mt: 1 }}>
            AI는 실수할 수 있습니다. 중요한 결과는 다시 확인하세요.
          </Typography>
        </Box>
      </Paper>
    </Stack>
  );
}
