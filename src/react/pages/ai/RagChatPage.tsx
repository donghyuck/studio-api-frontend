import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { AddCommentOutlined, SettingsOutlined } from "@mui/icons-material";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { reactAiApi } from "@/react/pages/ai/api";
import { ChatComposer } from "@/react/pages/ai/components/ChatComposer";
import { ChatMessageList } from "@/react/pages/ai/components/ChatMessageList";
import type { ChatMessage } from "@/react/pages/ai/components/chatTypes";
import type { AiInfoResponse, ChatMessageDto, ProviderInfo, SearchResultDto } from "@/types/studio/ai";
import { resolveAxiosError } from "@/utils/helpers";

const RAG_CHAT_INPUT_HISTORY_KEY = "ai_rag_chat_input_history";

function toRequestMessage(message: ChatMessage): ChatMessageDto {
  return {
    role: message.role,
    content: message.content,
  };
}

function numberOrUndefined(value: string) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : undefined;
}

function metadataValue(metadata: Record<string, unknown> | undefined, keys: string[]) {
  if (!metadata) {
    return undefined;
  }
  for (const key of keys) {
    const value = metadata[key];
    if (value != null && value !== "") {
      return value;
    }
  }
  return undefined;
}

function formatMetadataValue(value: unknown) {
  if (value == null || value === "") {
    return "";
  }
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function resultSourceName(row: SearchResultDto) {
  const metadataName = metadataValue(row.metadata, [
    "sourceName",
    "fileName",
    "filename",
    "originalFilename",
    "documentName",
    "title",
    "name",
  ]);
  if (metadataName != null) {
    return formatMetadataValue(metadataName);
  }

  const objectType = metadataValue(row.metadata, ["objectType", "object_type"]);
  const objectId = metadataValue(row.metadata, ["objectId", "object_id"]);
  if (objectType != null && objectId != null) {
    return `${formatMetadataValue(objectType)} #${formatMetadataValue(objectId)}`;
  }

  return row.documentId || "문서";
}

function resultChunkLabel(row: SearchResultDto) {
  const page = metadataValue(row.metadata, ["page", "pageNumber", "page_number", "pageNo", "page_no"]);
  if (page != null) {
    return `p.${formatMetadataValue(page)}`;
  }
  const slide = metadataValue(row.metadata, ["slide", "slideNumber", "slide_number", "slideNo", "slide_no"]);
  if (slide != null) {
    return `slide ${formatMetadataValue(slide)}`;
  }
  const order = metadataValue(row.metadata, ["chunkOrder", "chunkIndex", "chunk_order", "chunk_index", "order", "index"]);
  if (order != null) {
    return `chunk #${formatMetadataValue(order)}`;
  }
  return formatMetadataValue(metadataValue(row.metadata, ["chunkId", "chunk_id", "id"]));
}

function toRagReferences(rows: SearchResultDto[]) {
  return rows.slice(0, 5).map((row, index) => ({
    index: index + 1,
    title: resultSourceName(row),
    chunk: resultChunkLabel(row),
    score: row.score,
    content: row.content,
  }));
}

export function RagChatPage() {
  const [aiInfo, setAiInfo] = useState<AiInfoResponse | null>(null);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(
    "제공된 RAG 문서 내용에 근거해서만 답변하세요. 문서에서 확인할 수 없는 내용은 확인할 수 없다고 답변하세요."
  );
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [conversationId, setConversationId] = useState<string>(() => crypto.randomUUID());
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelAnchorEl, setModelAnchorEl] = useState<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topK, setTopK] = useState("2");
  const [minScore, setMinScore] = useState("0.6");
  const [debug, setDebug] = useState(false);
  const [inputHistory, setInputHistory] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(RAG_CHAT_INPUT_HISTORY_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [historyIndex, setHistoryIndex] = useState(-1);
  const activeRequestIdRef = useRef<string | null>(null);

  const providers = useMemo<ProviderInfo[]>(() => aiInfo?.providers ?? [], [aiInfo]);
  const selectedProvider = providers.find((item) => item.name === provider);
  const configurationMissing = !provider || !model;
  const shouldShowConfigurationWarning = aiInfo !== null && configurationMissing;
  const serverMemoryEnabled = aiInfo?.chat?.memory?.enabled === true;
  const modelMenuOpen = Boolean(modelAnchorEl);
  const lastAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages]
  );

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
    window.localStorage.setItem(RAG_CHAT_INPUT_HISTORY_KEY, JSON.stringify(inputHistory.slice(0, 30)));
  }, [inputHistory]);

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

  async function submitRagQuestion(trimmed: string, baseMessages: ChatMessage[], appendUserMessage: boolean) {
    if (!trimmed || sending || configurationMissing) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const nextMessages = appendUserMessage ? [...baseMessages, userMessage] : baseMessages;
    const requestMessages = (memoryEnabled ? [userMessage] : nextMessages).map(toRequestMessage);
    const requestId = crypto.randomUUID();
    activeRequestIdRef.current = requestId;
    const numericTopK = numberOrUndefined(topK);
    const numericMinScore = numberOrUndefined(minScore);

    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);
    setInput("");

    try {
      const referencesPromise = reactAiApi
        .searchRag({
          query: trimmed,
          topK: numericTopK,
          minScore: numericMinScore,
          hybrid: true,
        })
        .then(toRagReferences)
        .catch(() => []);
      const response = await reactAiApi.sendRagChat({
        chat: {
          provider: provider || undefined,
          model: model || undefined,
          messages: requestMessages,
          systemPrompt: systemPrompt.trim() || undefined,
          memory: memoryEnabled ? { enabled: true, conversationId } : undefined,
        },
        ragQuery: trimmed,
        ragTopK: numericTopK,
        topK: numericTopK,
        minScore: numericMinScore,
        debug,
      });
      if (activeRequestIdRef.current !== requestId) return;

      const assistant = [...(response.messages ?? [])].reverse().find((item) => item.role === "assistant");
      const nextConversationId = response.metadata?.conversationId ?? response.conversationId;
      const ragReferences = await referencesPromise;
      if (nextConversationId) {
        setConversationId(nextConversationId);
      }
      setMessages([
        ...nextMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistant?.content ?? "",
          createdAt: new Date().toISOString(),
          model: response.metadata?.resolvedModel ?? response.model ?? model,
          metadata: nextConversationId
            ? { ...(response.metadata ?? {}), conversationId: nextConversationId, ragReferences }
            : { ...(response.metadata ?? {}), ragReferences },
        },
      ]);
    } catch (sendError) {
      if (activeRequestIdRef.current !== requestId) return;
      const message = resolveAxiosError(sendError);
      setError(message);
      setMessages([
        ...nextMessages,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `오류: ${message}`,
          createdAt: new Date().toISOString(),
          metadata: { finishReason: "error" },
        },
      ]);
    } finally {
      if (activeRequestIdRef.current === requestId) {
        activeRequestIdRef.current = null;
        setSending(false);
        setInput("");
      }
    }
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending || configurationMissing) {
      return;
    }
    setInputHistory((current) => [trimmed, ...current.filter((item) => item !== trimmed)].slice(0, 30));
    setHistoryIndex(-1);
    await submitRagQuestion(trimmed, messages, true);
  }

  function handleNewConversation() {
    activeRequestIdRef.current = null;
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

  function handleRetryLastUserMessage() {
    const lastUser = [...messages].reverse().find((item) => item.role === "user");
    if (lastUser?.content) {
      setInput(lastUser.content);
    }
  }

  async function handleRegenerate() {
    if (sending) return;
    const lastUserIndex = [...messages].map((message) => message.role).lastIndexOf("user");
    if (lastUserIndex < 0) return;
    const baseMessages = messages.slice(0, lastUserIndex + 1);
    const lastUser = baseMessages[lastUserIndex];
    await submitRagQuestion(lastUser.content, baseMessages, false);
  }

  function handleInputHistoryNavigation(direction: "prev" | "next") {
    if (inputHistory.length === 0) return;

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
        breadcrumbs={["서비스 관리", "AI", "RAG Chat"]}
        label="RAG 검색 문맥을 기반으로 AI 답변을 생성합니다."
        actions={
          <>
            <Tooltip title="새 RAG 대화 시작">
              <IconButton size="small" aria-label="새 RAG 대화 시작" onClick={handleNewConversation}>
                <AddCommentOutlined fontSize="small" />
              </IconButton>
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
      {shouldShowConfigurationWarning ? (
        <Alert severity="warning">AI RAG Chat을 사용하려면 Provider와 Model 설정이 필요합니다.</Alert>
      ) : null}

      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle>AI RAG Chat 설정</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
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
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="topK"
                value={topK}
                onChange={(event) => setTopK(event.target.value)}
                size="small"
                type="number"
                inputProps={{ min: 1, max: 20 }}
                helperText="RAG 검색에서 사용할 최대 근거 수"
                fullWidth
              />
              <TextField
                label="minScore"
                value={minScore}
                onChange={(event) => setMinScore(event.target.value)}
                size="small"
                type="number"
                inputProps={{ min: 0, max: 1, step: 0.05 }}
                helperText="이 값보다 낮은 유사도 결과는 제외"
                fullWidth
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Stack spacing={0} sx={{ flex: 1 }}>
                <Typography variant="body2">Debug 응답</Typography>
                <Typography variant="caption" color="text.secondary">
                  RAG 검색과 답변 생성의 진단 metadata를 응답에 포함합니다.
                </Typography>
              </Stack>
              <Switch checked={debug} onChange={(event) => setDebug(event.target.checked)} />
            </Stack>
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

      <Stack sx={{ height: "calc(100vh - 170px)", minHeight: 0 }}>
        <Paper elevation={0} sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <ChatMessageList
            messages={messages}
            sending={sending}
            onCopy={(content) => void handleCopyMessage(content)}
            onEditUser={handleEditMessage}
            onRegenerate={() => void handleRegenerate()}
            onRetryLastUser={handleRetryLastUserMessage}
            emptyTitle="내부 자료에 대해 질문해 보세요."
            emptyDescription="등록된 내부 자료를 바탕으로 답변합니다."
          />
          <ChatComposer
            input={input}
            sending={sending}
            configurationMissing={configurationMissing}
            model={model}
            provider={provider}
            conversationId={conversationId}
            chatModeLabel="RAG 문맥 답변"
            chatModeDescription="입력한 질문으로 RAG 문맥을 검색하고 그 근거로 답변합니다."
            latencyMs={lastAssistantMessage?.metadata?.latencyMs}
            tokenUsage={lastAssistantMessage?.metadata?.tokenUsage}
            inputHistory={inputHistory}
            onInputChange={setInput}
            onSubmit={() => void handleSend()}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) {
                return;
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
                return;
              }
              if (event.key === "ArrowUp" && !event.shiftKey && !input.trim()) {
                event.preventDefault();
                handleInputHistoryNavigation("prev");
                return;
              }
              if (event.key === "ArrowDown" && !event.shiftKey && historyIndex >= 0) {
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
            settingsMenuLabel="AI RAG Chat 설정"
            settingsMenuDescription="provider, model, RAG 검색 조건을 설정합니다."
          />
        </Paper>
      </Stack>
    </Stack>
  );
}
