import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
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
import { reactAiApi, type EmbeddingOption } from "@/react/pages/ai/api";
import { ChatComposer } from "@/react/pages/ai/components/ChatComposer";
import { ChatMessageList } from "@/react/pages/ai/components/ChatMessageList";
import { AiProviderSelect } from "@/react/components/ai/AiProviderSelect";
import { RagAnswerModeSelector } from "@/react/pages/ai/components/RagAnswerModeSelector";
import { RagAnswerPresentationSelector } from "@/react/pages/ai/components/RagAnswerPresentationSelector";
import { RagSourceScopeSelector } from "@/react/pages/ai/components/RagSourceScopeSelector";
import { RagEvidenceSourceDrawer } from "@/react/pages/ai/components/RagEvidenceSourceDrawer";
import { RagEvidenceSourceSummary } from "@/react/pages/ai/components/RagEvidenceSourceSummary";
import { toIndexedWebSourcePayload } from "@/react/pages/ai/utils/evidenceSource";
import { reactWorkspaceApi } from "@/react/pages/workspaces/api";
import type { ChatMessage } from "@/react/pages/ai/components/chatTypes";
import type {
  AiInfoResponse,
  ChatMessageDto,
  ChatRagRequestDto,
  ChatStreamUsageEventDto,
  ProviderInfo,
  RagAnswerMode,
  RagAnswerPolicyCapabilitiesDto,
  RagAnswerPresentationCapabilitiesDto,
  RagAnswerPresentationPreference,
  RagExternalRetrievalCapabilitiesDto,
  RagExternalRetrievalMode,
  RagSourcePolicyCapabilitiesDto,
  RagSourceScope,
  TokenUsageDto,
  IndexedWebCapabilitiesDto,
  IndexedWebSourceRefDto,
} from "@/types/studio/ai";
import type { WorkspaceRef } from "@/types/studio/workspace";
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

export function RagChatPage() {
  const [aiInfo, setAiInfo] = useState<AiInfoResponse | null>(null);
  const [provider, setProvider] = useState("google-ai");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [deploymentId, setDeploymentId] = useState("chat-default");
  const [embeddingOptions, setEmbeddingOptions] = useState<EmbeddingOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<EmbeddingOption | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [answerPolicy, setAnswerPolicy] = useState<RagAnswerPolicyCapabilitiesDto | null>(null);
  const [answerMode, setAnswerMode] = useState<RagAnswerMode | null>(null);
  const [answerPresentation, setAnswerPresentation] =
    useState<RagAnswerPresentationCapabilitiesDto | null>(null);
  const [presentationPreference, setPresentationPreference] =
    useState<RagAnswerPresentationPreference | null>(null);
  const [sourcePolicy, setSourcePolicy] = useState<RagSourcePolicyCapabilitiesDto | null>(null);
  const [sourceScope, setSourceScope] = useState<RagSourceScope | null>(null);
  const [externalRetrieval, setExternalRetrieval] =
    useState<RagExternalRetrievalCapabilitiesDto | null>(null);
  const [externalRetrievalMode, setExternalRetrievalMode] =
    useState<RagExternalRetrievalMode>("OFF");
  const [indexedWebCapabilities, setIndexedWebCapabilities] =
    useState<IndexedWebCapabilitiesDto | null>(null);
  const [indexedWebCapabilitiesLoading, setIndexedWebCapabilitiesLoading] = useState(true);
  const [indexedWebCapabilitiesError, setIndexedWebCapabilitiesError] = useState<string | null>(null);
  const [indexedWebSources, setIndexedWebSources] = useState<IndexedWebSourceRefDto[]>([]);
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceRef[]>([]);
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [conversationId, setConversationId] = useState<string>(() => crypto.randomUUID());
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelAnchorEl, setModelAnchorEl] = useState<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [topK, setTopK] = useState("5"); // changed default topK to 5
  const [minScore, setMinScore] = useState("");
  const [debug, setDebug] = useState(false);
  const [retrievalStrategy, setRetrievalStrategy] = useState("hybrid");
  const [structureTopK, setStructureTopK] = useState("5");
  const [ideaBlockTopK, setIdeaBlockTopK] = useState("5");
  const [finalTopK, setFinalTopK] = useState("5");
  const [dedupe, setDedupe] = useState(true);
  const [includeDebugChunks, setIncludeDebugChunks] = useState(true);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false); // advanced toggle
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

    reactAiApi
      .getEmbeddingOptions()
      .then((res) => {
        const list = res.options ?? [];
        setEmbeddingOptions(list);
        const def = list.find((o) => o.defaultProfile) || list.find((o) => o.defaultProvider) || list[0] || null;
        setSelectedOption(def);
      })
      .catch(() => {
        // ignore
      });

    setIndexedWebCapabilitiesLoading(true);
    reactAiApi
      .fetchRagCapabilities()
      .then((capabilities) => {
        setAnswerPolicy(capabilities.answerPolicy);
        setAnswerMode(capabilities.answerPolicy.defaultMode);
        setAnswerPresentation(capabilities.answerPresentation);
        setPresentationPreference(capabilities.answerPresentation?.defaultPreference ?? "AUTO");
        setSourcePolicy(capabilities.sourcePolicy);
        setSourceScope(capabilities.sourcePolicy.defaultScope);
        setExternalRetrieval(capabilities.externalRetrieval ?? null);
        setExternalRetrievalMode(capabilities.externalRetrieval?.defaultMode ?? "OFF");
        setIndexedWebCapabilities(capabilities.indexedWeb);
        setIndexedWebCapabilitiesError(null);
      })
      .catch((loadError) => {
        const message = resolveAxiosError(loadError);
        setError(message);
        setIndexedWebCapabilitiesError(message);
      })
      .finally(() => {
        setIndexedWebCapabilitiesLoading(false);
      });

    reactWorkspaceApi
      .list({ archived: false, page: 0, size: 100, sort: "name,asc" })
      .then((response) => {
        const items = response.content ?? [];
        setWorkspaces(items);
        setWorkspaceId((current) => current ?? items[0]?.id ?? null);
      })
      .catch(() => {
        // URL 자료 기능만 비활성화하고 기존 RAG 채팅은 유지합니다.
      });
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
    const assistantMessageId = crypto.randomUUID();
    activeRequestIdRef.current = requestId;
    const numericTopK = numberOrUndefined(topK);
    const numericMinScore = numberOrUndefined(minScore);

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
    setStreamStatus(
      externalRetrievalMode === "AUTO"
        ? "문서 근거를 확인하고 필요하면 공식 외부 자료를 검색합니다."
        : "문서 근거를 검색하고 있습니다."
    );
    setInput("");

    try {
      const payload: ChatRagRequestDto = {
        chat: {
          deploymentId: deploymentId || "chat-default",
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
        retrievalStrategy: retrievalStrategy || undefined,
        retrievalOptions: {
          structureTopK: numberOrUndefined(structureTopK) ?? 5,
          ideaBlockTopK: numberOrUndefined(ideaBlockTopK) ?? 5,
          finalTopK: numberOrUndefined(finalTopK) ?? 5,
          minScore: numericMinScore,
          dedupe,
          includeDebugChunks,
        },
        debug,
        answerMode: answerMode ?? undefined,
        presentation: presentationPreference ? { preference: presentationPreference } : undefined,
        sourceScope: sourceScope ?? undefined,
        externalRetrievalMode,
        indexedWebSources: indexedWebSources.length > 0 ? toIndexedWebSourcePayload(indexedWebSources) : undefined,
      };
      if (selectedOption) {
        if (selectedOption.deploymentId) {
          payload.embeddingDeploymentId = selectedOption.deploymentId;
        } else if (selectedOption.profileId) {
          payload.embeddingProfileId = selectedOption.profileId;
        } else {
          payload.embeddingProvider = selectedOption.provider;
          payload.embeddingModel = selectedOption.model;
        }
      }
      await reactAiApi.sendRagChatStream(payload, {
        onRagStatus: (streamPayload) => {
          if (activeRequestIdRef.current !== requestId) return;
          if (streamPayload.stage === "retrieval_complete") {
            const count = streamPayload.resultCount ?? 0;
            setStreamStatus(`근거 ${count}건 검색 완료 · 답변을 생성하고 있습니다.`);
          } else if (streamPayload.stage === "generation_started") {
            setStreamStatus("근거를 바탕으로 답변을 생성하고 검증하고 있습니다.");
          } else if (
            streamPayload.stage === "external_search" ||
            streamPayload.stage === "external_search_complete"
          ) {
            setStreamStatus("필요한 공식 외부 자료 검색과 출처 확인을 완료했습니다.");
          } else {
            setStreamStatus(
              externalRetrievalMode === "AUTO"
                ? "문서 근거를 확인하고 필요하면 공식 외부 자료를 검색합니다."
                : "문서 근거를 검색하고 있습니다."
            );
          }
        },
        onDelta: () => {
          if (activeRequestIdRef.current !== requestId) return;
          setStreamStatus("답변을 검증하고 있습니다.");
        },
        onUsage: (streamPayload) => {
          if (activeRequestIdRef.current !== requestId) return;
          const tokenUsage = normalizeStreamUsage(streamPayload);
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
        onComplete: (streamPayload) => {
          if (activeRequestIdRef.current !== requestId) return;
          setStreamStatus(null);
          const metadata = streamPayload.metadata ?? {};
          const nextConversationId = streamPayload.conversationId ?? metadata.conversationId;
          if (nextConversationId) {
            setConversationId(nextConversationId);
          }
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    content:
                      typeof metadata.canonicalContent === "string"
                        ? metadata.canonicalContent
                        : message.content,
                    model: streamPayload.resolvedModel ?? metadata.resolvedModel ?? streamPayload.model ?? model,
                    metadata: {
                      ...(message.metadata ?? {}),
                      ...metadata,
                      ...(nextConversationId ? { conversationId: nextConversationId } : {}),
                    },
                  }
                : message
            )
          );
        },
        onError: (streamPayload) => {
          throw new Error(streamPayload.errorMessage || "RAG 스트림 처리 중 오류가 발생했습니다.");
        },
      });
    } catch (sendError) {
      if (activeRequestIdRef.current !== requestId) return;
      const message = resolveAxiosError(sendError);
      setError(message);
      setStreamStatus(null);
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
      if (activeRequestIdRef.current === requestId) {
        activeRequestIdRef.current = null;
        setSending(false);
        setStreamStatus(null);
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
    setStreamStatus(null);
  }

  function handleAnswerModeChange(nextMode: RagAnswerMode) {
    if (nextMode === answerMode) return;
    handleNewConversation();
    setAnswerMode(nextMode);
  }

  function handleSourceScopeChange(nextScope: RagSourceScope) {
    if (nextScope === sourceScope) return;
    handleNewConversation();
    setSourceScope(nextScope);
    setExternalRetrievalMode(
      nextScope === "DOCUMENT_AND_OFFICIAL_EXTERNAL" ? "AUTO" : "OFF"
    );
  }

  function handlePresentationChange(nextPreference: RagAnswerPresentationPreference) {
    if (nextPreference === presentationPreference) return;
    handleNewConversation();
    setPresentationPreference(nextPreference);
  }

  function handleIndexedWebSourcesChange(nextSources: IndexedWebSourceRefDto[]) {
    const current = JSON.stringify(indexedWebSources);
    const next = JSON.stringify(nextSources);
    if (current === next) return;
    handleNewConversation();
    setIndexedWebSources(nextSources);
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
      {streamStatus ? <Alert severity="info">{streamStatus}</Alert> : null}
      {shouldShowConfigurationWarning ? (
        <Alert severity="warning">AI RAG Chat을 사용하려면 Provider와 Model 설정이 필요합니다.</Alert>
      ) : null}

      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle>AI RAG Chat 설정</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <AiProviderSelect
              provider={provider}
              model={model}
              deploymentId={deploymentId}
              onChange={(p, m, d) => {
                setProvider(p);
                setModel(m);
                if (d) setDeploymentId(d);
              }}
            />
            {embeddingOptions.length > 0 ? (
              <TextField
                select
                label="임베딩 모델 프로필"
                size="small"
                value={selectedOption ? (selectedOption.profileId || `${selectedOption.provider}:${selectedOption.model}`) : ""}
                onChange={(event) => {
                  const val = event.target.value;
                  const matched = embeddingOptions.find((o) => (o.profileId || `${o.provider}:${o.model}`) === val);
                  if (matched) {
                    setSelectedOption(matched);
                  }
                }}
                disabled={sending}
                fullWidth
              >
                {embeddingOptions.map((opt) => {
                  const valueKey = opt.profileId || `${opt.provider}:${opt.model}`;
                  const label = opt.profileId
                    ? `${opt.profileId} (${opt.provider} - ${opt.model})`
                    : `${opt.provider} - ${opt.model} (${opt.dimension}d)`;
                  return (
                    <MenuItem key={valueKey} value={valueKey}>
                      {label}
                    </MenuItem>
                  );
                })}
              </TextField>
            ) : null}
            {selectedProvider ? (
              <Typography variant="caption" color="text.secondary">
                Embedding: {selectedProvider.embedding.enabled ? selectedProvider.embedding.model : "disabled"}
                {aiInfo?.vector.available ? ` · Vector: ${aiInfo.vector.implementation}` : " · Vector: unavailable"}
              </Typography>
            ) : null}
            <TextField label="System Prompt" value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} multiline minRows={2} size="small" fullWidth />
            <RagAnswerModeSelector
              capabilities={answerPolicy}
              value={answerMode}
              disabled={sending}
              onChange={handleAnswerModeChange}
            />
            <RagAnswerPresentationSelector
              capabilities={answerPresentation}
              value={presentationPreference}
              disabled={sending}
              onChange={handlePresentationChange}
            />
            <RagSourceScopeSelector
              capabilities={sourcePolicy}
              externalRetrievalCapabilities={externalRetrieval}
              value={sourceScope}
              disabled={sending}
              onChange={handleSourceScopeChange}
            />
            <TextField
              select
              label="RAG 검색 전략 (retrievalStrategy)"
              value={retrievalStrategy}
              onChange={(e) => setRetrievalStrategy(e.target.value)}
              size="small"
              fullWidth
              helperText={
                retrievalStrategy === "hybrid" ? "구조 기반 chunk와 IdeaBlock을 병합/dedupe하여 최종 전달합니다. (권장 기본)" :
                retrievalStrategy === "structure" ? "Structure-Based chunk만 RAG 후보군으로 검색합니다." :
                retrievalStrategy === "ideaBlock" ? "IdeaBlock chunk만 RAG 후보군으로 검색합니다. (비교/실험용)" :
                retrievalStrategy === "auto" ? "서버에서 질의에 맞춰 최적의 검색 방식을 판단합니다." :
                "기존 RAG 기본 검색 파이프라인을 사용합니다."
              }
            >
              <MenuItem value="hybrid">Hybrid (구조 + IdeaBlock 병합)</MenuItem>
              <MenuItem value="structure">Structure (구조 기반 단독)</MenuItem>
              <MenuItem value="ideaBlock">IdeaBlock (질답형 블록 단독)</MenuItem>
              <MenuItem value="auto">Auto (자동 라우팅)</MenuItem>
              <MenuItem value="default">Default (기존 검색)</MenuItem>
            </TextField>

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

            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" sx={{ fontWeight: 600 }}>고급 RAG 검색 옵션 표시</Typography>
              <Switch checked={showAdvancedSettings} onChange={(e) => setShowAdvancedSettings(e.target.checked)} />
            </Stack>

            {showAdvancedSettings && (
              <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 1.5, p: 1.5, bgcolor: "action.hover" }}>
                <Stack spacing={1.5}>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: "block" }}>
                    Retrieval Options 상세 구성
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <TextField
                      label="structureTopK"
                      value={structureTopK}
                      onChange={(e) => setStructureTopK(e.target.value)}
                      size="small"
                      type="number"
                      fullWidth
                    />
                    <TextField
                      label="ideaBlockTopK"
                      value={ideaBlockTopK}
                      onChange={(e) => setIdeaBlockTopK(e.target.value)}
                      size="small"
                      type="number"
                      fullWidth
                    />
                    <TextField
                      label="finalTopK"
                      value={finalTopK}
                      onChange={(e) => setFinalTopK(e.target.value)}
                      size="small"
                      type="number"
                      fullWidth
                    />
                  </Stack>
                  <Stack direction="row" spacing={2}>
                    <FormControlLabel
                      control={<Switch size="small" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} />}
                      label={<Typography variant="body2" sx={{ fontSize: 12 }}>중복 제거 (dedupe)</Typography>}
                    />
                    <FormControlLabel
                      control={<Switch size="small" checked={includeDebugChunks} onChange={(e) => setIncludeDebugChunks(e.target.checked)} />}
                      label={<Typography variant="body2" sx={{ fontSize: 12 }}>디버그용 chunk 포함</Typography>}
                    />
                  </Stack>
                </Stack>
              </Box>
            )}
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
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "8px",
          }}
        >
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
          <Box sx={{ maxWidth: 920, mx: "auto", px: { xs: 1.5, md: 5 }, mb: 1 }}>
            <RagEvidenceSourceSummary
              selectedWebSourcesCount={indexedWebSources.length}
              onOpenDrawer={() => setEvidenceDrawerOpen(true)}
              disabled={sending}
              selection={lastAssistantMessage?.metadata?.evidenceSourceSelection as any}
              sourcePolicy={lastAssistantMessage?.metadata?.sourcePolicy}
              packedOrigins={(lastAssistantMessage?.metadata?.evidenceSourceSelection as any)?.packedOrigins}
              usedOrigins={(lastAssistantMessage?.metadata?.evidenceSourceSelection as any)?.usedOrigins}
            />
          </Box>
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
            selectedWebSourcesCount={indexedWebSources.length}
            onOpenEvidenceDrawer={() => setEvidenceDrawerOpen(true)}
            controls={
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                <RagAnswerModeSelector
                  capabilities={answerPolicy}
                  value={answerMode}
                  disabled={sending}
                  hideHelperText
                  variant="compact-pill"
                  onChange={(mode) => {
                    if (mode === answerMode) return;
                    setAnswerMode(mode);
                    setError(null);
                  }}
                />
                <RagAnswerPresentationSelector
                  capabilities={answerPresentation}
                  value={presentationPreference}
                  disabled={sending}
                  hideHelperText
                  variant="compact-pill"
                  onChange={handlePresentationChange}
                />
                <RagSourceScopeSelector
                  capabilities={sourcePolicy}
                  externalRetrievalCapabilities={externalRetrieval}
                  value={sourceScope}
                  disabled={sending}
                  hideHelperText
                  variant="compact-pill"
                  onChange={handleSourceScopeChange}
                />
                {selectedOption ? (
                  <Tooltip title="이 대화에 사용되는 RAG 임베딩 모델입니다">
                    <Typography
                      variant="caption"
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        px: 1,
                        py: 0.3,
                        borderRadius: "16px",
                        fontSize: 12,
                        fontWeight: 500,
                        color: "text.secondary",
                        bgcolor: (theme) =>
                          theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
                      }}
                    >
                      (임베딩 : {selectedOption.displayName || selectedOption.model})
                    </Typography>
                  </Tooltip>
                ) : null}
              </Stack>
            }
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

      <RagEvidenceSourceDrawer
        open={evidenceDrawerOpen}
        onClose={() => setEvidenceDrawerOpen(false)}
        workspaceId={workspaceId}
        workspaces={workspaces}
        onWorkspaceChange={(nextWorkspaceId) => {
          handleNewConversation();
          setWorkspaceId(nextWorkspaceId);
          setIndexedWebSources([]);
        }}
        embeddingDeploymentId={selectedOption?.deploymentId}
        value={indexedWebSources}
        maxSelectedSources={indexedWebCapabilities?.maxSelectedSources}
        capabilities={indexedWebCapabilities}
        capabilitiesLoading={indexedWebCapabilitiesLoading}
        capabilitiesError={indexedWebCapabilitiesError}
        disabled={sending}
        onChange={handleIndexedWebSourcesChange}
      />
    </Stack>
  );
}
