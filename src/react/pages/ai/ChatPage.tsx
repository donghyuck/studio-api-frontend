import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  EditNoteOutlined,
  HistoryOutlined,
  SettingsOutlined,
  SyncOutlined,
} from "@mui/icons-material";
import { reactAiApi } from "@/react/pages/ai/api";
import type {
  AiInfoResponse,
  ChatMessageDto,
  ChatStreamCompleteEventDto,
  ChatStreamUsageEventDto,
  ProviderInfo,
  TokenUsageDto,
} from "@/types/studio/ai";
import { resolveAxiosError } from "@/utils/helpers";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import type { ChatMessage, ConversationSummaryDto } from "@/react/pages/ai/components/chatTypes";
import { ConversationSidebar } from "@/react/pages/ai/components/ConversationSidebar";
import { ChatMessageList } from "@/react/pages/ai/components/ChatMessageList";
import { ChatComposer } from "@/react/pages/ai/components/ChatComposer";

const CHAT_INPUT_HISTORY_KEY = "ai_chat_input_history";

function normalizeStreamUsage(payload: ChatStreamUsageEventDto): TokenUsageDto | undefined {
  const usage = payload.metadata?.tokenUsage ?? payload;
  const hasUsage =
    usage.inputTokens !== undefined ||
    usage.outputTokens !== undefined ||
    usage.totalTokens !== undefined;

  if (!hasUsage) return undefined;

  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: usage.totalTokens ?? inputTokens + outputTokens,
  };
}

function normalizeStreamComplete(payload: ChatStreamCompleteEventDto) {
  const metadata = payload.metadata ?? {};

  return {
    provider: payload.provider ?? metadata.provider,
    resolvedModel: payload.resolvedModel ?? metadata.resolvedModel ?? payload.model,
    conversationId: payload.conversationId ?? metadata.conversationId,
    latencyMs: payload.latencyMs ?? metadata.latencyMs,
    finishReason: payload.finishReason ?? metadata.finishReason,
    fallbackUsed: payload.fallbackUsed,
    tokenUsage: metadata.tokenUsage,
  };
}

function toRequestMessage(message: ChatMessage): ChatMessageDto {
  return {
    role: message.role,
    content: message.content,
  };
}

export function ChatPage() {
  const [aiInfo, setAiInfo] = useState<AiInfoResponse | null>(null);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [conversationId, setConversationId] = useState<string>(() => crypto.randomUUID());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [conversationDrawerOpen, setConversationDrawerOpen] = useState(false);
  const [modelAnchorEl, setModelAnchorEl] = useState<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationSummaryDto[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [inputHistory, setInputHistory] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(CHAT_INPUT_HISTORY_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [compactMode, setCompactMode] = useState(true);
  const activeStreamIdRef = useRef<string | null>(null);
  const activeConversationLoadIdRef = useRef<string | null>(null);

  const providers = useMemo<ProviderInfo[]>(() => aiInfo?.providers ?? [], [aiInfo]);
  const selectedProvider = providers.find((item) => item.name === provider);
  const configurationMissing = !provider || !model;
  const serverMemoryEnabled = aiInfo?.chat?.memory?.enabled === true;
  const modelMenuOpen = Boolean(modelAnchorEl);
  const chatModeLabel = memoryEnabled ? "서버 메모리" : "클라이언트 누적 전송";
  const chatModeDescription = memoryEnabled
    ? "conversationId 기준으로 서버가 이전 대화를 이어갑니다."
    : "클라이언트가 지금까지의 대화 메시지를 함께 전송합니다.";
  const shouldShowSummary = messages.length >= 8;
  const lastAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages]
  );
  const regenerateConversationId =
    lastAssistantMessage?.metadata?.conversationId ?? (memoryEnabled ? conversationId : undefined);
  const canRegenerate = Boolean(regenerateConversationId && !sending && lastAssistantMessage);
  const visibleMessages = useMemo(() => {
    if (!compactMode || messages.length <= 6) {
      return messages;
    }
    return messages.slice(-6);
  }, [compactMode, messages]);
  const collapsedMessageCount = Math.max(messages.length - visibleMessages.length, 0);
  const summaryText = useMemo(() => {
    if (!shouldShowSummary) {
      return "";
    }
    const recentMessages = messages.slice(-6);
    const lastUser = [...recentMessages].reverse().find((item) => item.role === "user")?.content;
    const lastAssistant = [...recentMessages].reverse().find((item) => item.role === "assistant")?.content;
    return [
      `최근 ${recentMessages.length}개 메시지`,
      lastUser ? `질문: ${lastUser.slice(0, 120)}` : "",
      lastAssistant ? `답변: ${lastAssistant.slice(0, 160)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }, [messages, shouldShowSummary]);

  useEffect(() => {
    reactAiApi
      .fetchProviders()
      .then((data) => {
        setAiInfo(data);
        setProvider(data.defaultProvider);
        const match = data.providers.find((item) => item.name === data.defaultProvider);
        setModel(match?.chat.model ?? "");
        setMemoryEnabled(data.chat?.memory?.enabled === true);
      })
      .catch((loadError) => setError(resolveAxiosError(loadError)));
  }, []);

  useEffect(() => {
    void loadConversations();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(CHAT_INPUT_HISTORY_KEY, JSON.stringify(inputHistory.slice(0, 30)));
  }, [inputHistory]);

  async function loadConversations() {
    setLoadingConversations(true);
    try {
      const list = await reactAiApi.listConversations();
      setConversations(list);
    } catch {
      // ignore sidebar load failure
    } finally {
      setLoadingConversations(false);
    }
  }

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

  async function handleOpenConversation(nextConversationId: string) {
    activeStreamIdRef.current = null;
    const loadId = crypto.randomUUID();
    activeConversationLoadIdRef.current = loadId;
    setSending(false);
    try {
      const detail = await reactAiApi.getConversation(nextConversationId);
      if (activeConversationLoadIdRef.current !== loadId) return;
      setConversationId(detail.conversationId);
      setMessages(
        (detail.messages ?? []).map((message) => ({
          ...message,
          id: message.messageId ?? crypto.randomUUID(),
          createdAt: message.createdAt,
        }))
      );
      setConversationDrawerOpen(false);
      setError(null);
    } catch (loadError) {
      if (activeConversationLoadIdRef.current !== loadId) return;
      setError(resolveAxiosError(loadError));
    } finally {
      if (activeConversationLoadIdRef.current === loadId) {
        activeConversationLoadIdRef.current = null;
      }
    }
  }

  async function handleDeleteConversation(targetConversationId: string) {
    try {
      await reactAiApi.deleteConversation(targetConversationId);
      if (targetConversationId === conversationId) {
        handleNewConversation();
      }
      await loadConversations();
    } catch (deleteError) {
      setError(resolveAxiosError(deleteError));
    }
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending || configurationMissing) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const nextMessages: ChatMessage[] = [...messages, userMessage];
    const requestMessages = (memoryEnabled ? [userMessage] : nextMessages).map(toRequestMessage);
    const assistantMessageId = crypto.randomUUID();
    const streamId = crypto.randomUUID();
    activeStreamIdRef.current = streamId;
    setInputHistory((current) => [trimmed, ...current.filter((item) => item !== trimmed)].slice(0, 30));
    setHistoryIndex(-1);

    setMessages([
      ...nextMessages,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        model,
      },
    ]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      await reactAiApi.sendChatStream(
        {
          provider: provider || undefined,
          model: model || undefined,
          messages: requestMessages,
          systemPrompt: systemPrompt.trim() || undefined,
          memory: memoryEnabled ? { enabled: true, conversationId } : undefined,
        },
        {
          onDelta: (payload) => {
            if (activeStreamIdRef.current !== streamId) return;
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, content: `${message.content}${payload.delta ?? payload.content ?? ""}` }
                  : message
              )
            );
          },
          onUsage: (payload) => {
            if (activeStreamIdRef.current !== streamId) return;
            const tokenUsage = normalizeStreamUsage(payload);
            if (!tokenUsage) return;
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId
                  ? {
                      ...message,
                      metadata: {
                        ...(message.metadata ?? {}),
                        tokenUsage,
                      },
                    }
                  : message
              )
            );
          },
          onComplete: (payload) => {
            if (activeStreamIdRef.current !== streamId) return;
            const complete = normalizeStreamComplete(payload);
            if (complete.conversationId) {
              setConversationId(complete.conversationId);
            }
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId
                  ? {
                      ...message,
                      model: complete.resolvedModel ?? model,
                      metadata: {
                        ...(message.metadata ?? {}),
                        provider: complete.provider,
                        resolvedModel: complete.resolvedModel,
                        conversationId: complete.conversationId,
                        latencyMs: complete.latencyMs,
                        finishReason: complete.finishReason,
                        fallbackUsed: complete.fallbackUsed,
                        tokenUsage: message.metadata?.tokenUsage ?? complete.tokenUsage,
                      },
                    }
                  : message
              )
            );
          },
        }
      );
      if (activeStreamIdRef.current === streamId) {
        await loadConversations();
      }
    } catch (sendError) {
      if (activeStreamIdRef.current !== streamId) return;
      const message = resolveAxiosError(sendError);
      setError(message);
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessageId
            ? {
                ...item,
                content: `오류: ${message}`,
                metadata: { ...(item.metadata ?? {}), finishReason: "error" },
              }
            : item
        )
      );
    } finally {
      if (activeStreamIdRef.current === streamId) {
        activeStreamIdRef.current = null;
        setSending(false);
      }
    }
  }

  async function handleRegenerate() {
    if (!canRegenerate || !regenerateConversationId) return;
    const requestId = crypto.randomUUID();
    activeStreamIdRef.current = requestId;
    setSending(true);
    try {
      const response = await reactAiApi.regenerate({ conversationId: regenerateConversationId });
      if (activeStreamIdRef.current !== requestId) return;
      const assistant = [...response.messages].reverse().find((item) => item.role === "assistant");
      if (assistant) {
        const nextConversationId = response.metadata?.conversationId ?? response.conversationId;
        if (nextConversationId) {
          setConversationId(nextConversationId);
        }
        setMessages((current) => [
          ...current,
          {
            ...assistant,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            metadata: nextConversationId
              ? { ...(response.metadata ?? {}), conversationId: nextConversationId }
              : response.metadata,
            model: response.metadata?.resolvedModel ?? model,
          },
        ]);
      }
      await loadConversations();
    } catch (regenerateError) {
      if (activeStreamIdRef.current !== requestId) return;
      setError(resolveAxiosError(regenerateError));
    } finally {
      if (activeStreamIdRef.current === requestId) {
        activeStreamIdRef.current = null;
        setSending(false);
      }
    }
  }

  async function handleRetryLastUserMessage() {
    const lastUser = [...messages].reverse().find((item) => item.role === "user");
    if (!lastUser?.content) {
      return;
    }
    setInput(lastUser.content);
  }

  function handleNewConversation() {
    activeStreamIdRef.current = null;
    activeConversationLoadIdRef.current = null;
    setSending(false);
    setConversationId(crypto.randomUUID());
    setMessages([]);
    setInput("");
    setError(null);
  }

  async function handleCopyMessage(content: string) {
    await navigator.clipboard.writeText(content);
  }

  function handleEditMessage(messageId: string | undefined, content: string) {
    setInput(content);
    setMessages((current) => {
      const index = current.findIndex((message) => message.id === messageId);
      return index >= 0 ? current.slice(0, index) : current;
    });
  }

  function handleInputHistoryNavigation(direction: "prev" | "next") {
    if (inputHistory.length === 0) {
      return;
    }

    if (direction === "prev") {
      const nextIndex = historyIndex + 1 >= inputHistory.length ? inputHistory.length - 1 : historyIndex + 1;
      setHistoryIndex(nextIndex);
      setInput(inputHistory[nextIndex] ?? "");
      return;
    }

    const nextIndex = historyIndex - 1;
    if (nextIndex < 0) {
      setHistoryIndex(-1);
      setInput("");
      return;
    }
    setHistoryIndex(nextIndex);
    setInput(inputHistory[nextIndex] ?? "");
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
            <Tooltip title="대화 목록">
              <IconButton size="small" onClick={() => setConversationDrawerOpen(true)}>
                <HistoryOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="답변 다시 생성">
              <span>
                <IconButton size="small" onClick={() => void handleRegenerate()} disabled={!canRegenerate}>
                  <SyncOutlined fontSize="small" />
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
        <Alert severity="warning">AI Chat을 사용하려면 Provider와 Model 설정이 필요합니다. 상단 설정 아이콘을 눌러 사용할 provider와 모델을 선택하거나 입력하세요.</Alert>
      ) : null}

      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle>AI 모델 설정</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            {serverMemoryEnabled ? (
              <Alert severity="info">서버가 conversationId 기반 대화 기억을 지원합니다.</Alert>
            ) : (
              <Alert severity="warning">서버에서 대화 기억 기능이 비활성화되어 있습니다.</Alert>
            )}
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField select label="Provider" value={provider} onChange={(event) => handleProviderChange(event.target.value)} fullWidth size="small">
                {providers.map((item) => (
                  <MenuItem key={item.name} value={item.name}>
                    <Stack spacing={0}>
                      <Typography variant="body2">{item.name}</Typography>
                      <Typography variant="caption" color="text.secondary">chat: {item.chat.enabled ? item.chat.model : "disabled"}</Typography>
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
            <TextField label="System Prompt" value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} multiline minRows={2} size="small" fullWidth />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Stack spacing={0} sx={{ flex: 1 }}>
                <Typography variant="body2">대화 기억</Typography>
                <Typography variant="caption" color="text.secondary">{memoryEnabled ? `사용 중 · ${conversationId}` : "사용하지 않음"}</Typography>
              </Stack>
              <Switch checked={memoryEnabled} disabled={!serverMemoryEnabled} onChange={(event) => setMemoryEnabled(event.target.checked)} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setSettingsOpen(false)}>닫기</Button>
        </DialogActions>
      </Dialog>

      <Drawer
        anchor="right"
        open={conversationDrawerOpen}
        onClose={() => setConversationDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 380 },
          },
        }}
      >
        <ConversationSidebar
          drawer
          conversationId={conversationId}
          conversations={conversations}
          loading={loadingConversations}
          onOpen={(nextConversationId) => void handleOpenConversation(nextConversationId)}
          onDelete={(targetConversationId) => void handleDeleteConversation(targetConversationId)}
          onRefresh={() => void loadConversations()}
          onClose={() => setConversationDrawerOpen(false)}
        />
      </Drawer>

      <Stack sx={{ height: 'calc(100vh - 170px)', minHeight: 0 }}>
        <Paper elevation={0} sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ChatMessageList
            messages={visibleMessages}
            sending={sending}
            collapsedMessageCount={collapsedMessageCount}
            summaryText={summaryText}
            summaryVisible={shouldShowSummary}
            onToggleSummary={() => setCompactMode((current) => !current)}
            onCopy={(content) => void handleCopyMessage(content)}
            onEditUser={handleEditMessage}
            onRegenerate={() => void handleRegenerate()}
            onRetryLastUser={() => void handleRetryLastUserMessage()}
          />
          <ChatComposer
            input={input}
            sending={sending}
            configurationMissing={configurationMissing}
            model={model}
            provider={provider}
            conversationId={conversationId}
            chatModeLabel={chatModeLabel}
            chatModeDescription={chatModeDescription}
            latencyMs={lastAssistantMessage?.metadata?.latencyMs}
            tokenUsage={lastAssistantMessage?.metadata?.tokenUsage}
            inputHistory={inputHistory}
            onInputChange={setInput}
            onSubmit={() => void handleSend()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                void handleSend();
                return;
              }
              if (event.key === 'ArrowUp' && !event.shiftKey && !input.trim()) {
                event.preventDefault();
                handleInputHistoryNavigation("prev");
                return;
              }
              if (event.key === 'ArrowDown' && !event.shiftKey && historyIndex >= 0) {
                event.preventDefault();
                handleInputHistoryNavigation("next");
              }
            }}
            onOpenModelMenu={(event) => setModelAnchorEl(event.currentTarget)}
            modelMenuOpen={modelMenuOpen}
            modelAnchorEl={modelAnchorEl}
            providers={providers}
            onCloseModelMenu={handleModelMenuClose}
            onSelectProvider={(nextProvider) => handleModelSelect(nextProvider)}
            onOpenSettings={() => {
              handleModelMenuClose();
              setSettingsOpen(true);
            }}
            onSelectHistory={(value) => {
              setInput(value);
              setHistoryIndex(-1);
            }}
          />
        </Paper>
      </Stack>
    </Stack>
  );
}
