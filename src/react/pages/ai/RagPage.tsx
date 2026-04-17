import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { ColDef } from "ag-grid-community";
import { GridContent } from "@/react/components/ag-grid";
import { reactAiApi } from "@/react/pages/ai/api";
import type {
  AiInfoResponse,
  ChatMessageDto,
  ProviderInfo,
  VectorSearchResultDto,
} from "@/types/studio/ai";
import { resolveAxiosError } from "@/utils/helpers";
import { PageToolbar } from "@/react/components/page/PageToolbar";

export function RagPage() {
  const [aiInfo, setAiInfo] = useState<AiInfoResponse | null>(null);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState("3");
  const [objectType, setObjectType] = useState("");
  const [objectId, setObjectId] = useState("");
  const [debug, setDebug] = useState(false);
  const [expandedQuery, setExpandedQuery] = useState("");
  const [expandedKeywords, setExpandedKeywords] = useState<string[]>([]);
  const [rows, setRows] = useState<VectorSearchResultDto[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessageDto[]>([]);
  const [ragDiagnostics, setRagDiagnostics] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const providers = useMemo<ProviderInfo[]>(() => aiInfo?.providers ?? [], [aiInfo]);

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

  const columnDefs = useMemo<ColDef<VectorSearchResultDto>[]>(
    () => [
      { field: "id", headerName: "ID", flex: 0.5 },
      { field: "score", headerName: "유사도", flex: 0.3, sortable: true },
      {
        colId: "objectScope",
        headerName: "객체 범위",
        flex: 0.6,
        valueGetter: (params) => {
          const metadata = params.data?.metadata ?? {};
          const type = metadata.objectType;
          const id = metadata.objectId;
          return type || id ? `${type ?? "-"}#${id ?? "-"}` : "-";
        },
      },
      { field: "content", headerName: "콘텐츠", flex: 1.3 },
    ],
    []
  );

  async function handleSearch(usingExpandedQuery = false) {
    setError(null);
    try {
      const data = await reactAiApi.searchVector({
        query: usingExpandedQuery ? expandedQuery : query,
        topK: Number(topK) || 3,
        hybrid: true,
        objectType: objectType.trim() || undefined,
        objectId: objectId.trim() || undefined,
      });
      setRows(data);
    } catch (searchError) {
      setError(resolveAxiosError(searchError));
    }
  }

  async function handleRewrite() {
    setError(null);
    try {
      const data = await reactAiApi.rewriteQuery({ query });
      setExpandedQuery(data.expandedQuery);
      setExpandedKeywords(data.keywords);
    } catch (rewriteError) {
      setError(resolveAxiosError(rewriteError));
    }
  }

  async function handleRagChat() {
    const trimmed = chatInput.trim();
    if (!trimmed) {
      return;
    }

    const nextMessages: ChatMessageDto[] = [
      ...chatMessages,
      { role: "user", content: trimmed },
    ];

    setChatMessages(nextMessages);
    setChatInput("");
    setRagDiagnostics(null);
    setError(null);

    try {
      const response = await reactAiApi.sendRagChat({
        chat: {
          provider: provider || undefined,
          model: model || undefined,
          messages: nextMessages,
        },
        ragQuery: expandedQuery.trim() || query.trim() || trimmed,
        ragTopK: Number(topK) || 3,
        objectType: objectType.trim() || undefined,
        objectId: objectId.trim() || undefined,
        debug,
      });

      const assistant = [...response.messages]
        .reverse()
        .find((message) => message.role === "assistant");

      if (assistant) {
        setChatMessages((current) => [...current, assistant]);
      }
      setRagDiagnostics(
        (response.metadata?.ragDiagnostics as Record<string, unknown> | undefined) ?? null
      );
    } catch (chatError) {
      setError(resolveAxiosError(chatError));
    }
  }

  return (
    <Stack spacing={1}>
      <PageToolbar
        divider={false}
        breadcrumbs={["서비스 관리", "AI", "RAG"]}
        label="문서 벡터 검색과 RAG Chat 요청을 수행합니다."
      />
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                select
                label="Provider"
                value={provider}
                onChange={(event) => {
                  const nextProvider = event.target.value;
                  setProvider(nextProvider);
                  const match = providers.find((item) => item.name === nextProvider);
                  setModel(match?.chat.model ?? "");
                }}
                fullWidth
                size="small"
              >
                {providers.map((item) => (
                  <MenuItem key={item.name} value={item.name}>
                    {item.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="Model" value={model} onChange={(event) => setModel(event.target.value)} fullWidth size="small" />
              <TextField label="topK" value={topK} onChange={(event) => setTopK(event.target.value)} sx={{ maxWidth: 140 }} size="small" />
            </Stack>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="objectType"
                value={objectType}
                onChange={(event) => setObjectType(event.target.value)}
                placeholder="예: attachment"
                helperText="첨부 파일 RAG는 attachment를 사용합니다."
                fullWidth
                size="small"
              />
              <TextField
                label="objectId"
                value={objectId}
                onChange={(event) => setObjectId(event.target.value)}
                placeholder="예: 123"
                helperText="파일 기반 RAG는 attachmentId를 입력합니다."
                fullWidth
                size="small"
              />
              <TextField
                select
                label="debug"
                value={debug ? "true" : "false"}
                onChange={(event) => setDebug(event.target.value === "true")}
                sx={{ maxWidth: 140 }}
                size="small"
                helperText="운영 정보 표시"
              >
                <MenuItem value="false">false</MenuItem>
                <MenuItem value="true">true</MenuItem>
              </TextField>
            </Stack>
            <TextField label="쿼리" value={query} onChange={(event) => setQuery(event.target.value)} size="small" />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={() => void handleSearch(false)} disabled={!query.trim()}>
                검색
              </Button>
              <Button variant="outlined" onClick={() => void handleRewrite()} disabled={!query.trim()}>
                쿼리 확장
              </Button>
              <Button variant="text" onClick={() => void handleSearch(true)} disabled={!expandedQuery.trim()}>
                확장 쿼리로 검색
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="subtitle2">RAG Chat</Typography>
            <Stack spacing={1}>
              {chatMessages.length === 0 ? (
                <Typography color="text.secondary">RAG 대화를 시작하세요.</Typography>
              ) : (
                chatMessages.map((message, index) => (
                  <TextField
                    key={`${message.role}-${index}`}
                    label={message.role}
                    value={message.content}
                    InputProps={{ readOnly: true }}
                    multiline
                    minRows={2}
                  />
                ))
              )}
            </Stack>
            <TextField
              label="RAG 질문"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              multiline
              minRows={3}
            />
            <Stack direction="row" justifyContent="flex-end">
              <Button variant="contained" onClick={() => void handleRagChat()} disabled={!chatInput.trim()}>
                RAG 요청
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
      {expandedKeywords.length > 0 ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="subtitle2">확장 키워드</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {expandedKeywords.map((keyword) => (
                  <Chip key={keyword} label={keyword} />
                ))}
              </Stack>
              <TextField label="확장 쿼리" value={expandedQuery} InputProps={{ readOnly: true }} />
            </Stack>
          </CardContent>
        </Card>
      ) : null}
      {ragDiagnostics ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1}>
              <Typography variant="subtitle2">RAG Diagnostics</Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1,
                  bgcolor: "grey.100",
                  borderRadius: 1,
                  overflow: "auto",
                  fontSize: 12,
                }}
              >
                {JSON.stringify(ragDiagnostics, null, 2)}
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ) : null}
      <GridContent<VectorSearchResultDto> columns={columnDefs} rowData={rows} height={360} />
    </Stack>
  );
}
