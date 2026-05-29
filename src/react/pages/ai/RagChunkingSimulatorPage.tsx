import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  ExpandMoreOutlined,
  HelpOutlineOutlined,
} from "@mui/icons-material";
import type { ColDef } from "ag-grid-community";
import { GridContent } from "@/react/components/ag-grid";
import { ObjectTypeSelect } from "@/react/components/objecttype/ObjectTypeSelect";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { reactAiApi } from "@/react/pages/ai/api";
import type {
  AiInfoResponse,
  RagChunkPreviewItemDto,
  RagChunkConfigResponseDto,
  RagChunkingSimulationResponseDto,
  RagContextSimulationChunkDto,
  RagContextSimulationResponseDto,
  RagTokenizerStatusDto,
} from "@/types/studio/ai";
import { resolveAxiosError } from "@/utils/helpers";

type SimulatorTab = "chunking" | "context";
type ChunkingMode = "token-aware" | "legacy-preview";
const TOKEN_DISTRIBUTION_GRID_HEIGHT = 440;

function formatValue(value: unknown) {
  if (value == null || value === "") {
    return "-";
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function numberValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function chunkStrategyUsesSizing(strategy: string) {
  return ["fixed-size", "recursive", "structure-based"].includes(strategy.trim().toLowerCase());
}

function chunkStrategyHint(strategy: string) {
  switch (strategy) {
    case "fixed-size":
      return "고정 길이 기준으로 단순하게 나눕니다.";
    case "recursive":
      return "문단, 문장, 공백 순서로 자연스럽게 나눕니다.";
    case "structure-based":
      return "제목과 섹션 같은 문서 구조를 우선 반영합니다.";
    default:
      return "서버가 지원하는 청킹 전략을 선택합니다.";
  }
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

function itemValue(
  item: RagChunkPreviewItemDto | RagContextSimulationChunkDto | undefined,
  field: keyof RagChunkPreviewItemDto | keyof RagContextSimulationChunkDto,
  metadataKeys: string[],
) {
  if (!item) {
    return undefined;
  }
  const direct = (item as unknown as Record<string, unknown>)[field as string];
  return direct ?? metadataValue(item.metadata, metadataKeys);
}

function warningList(value?: string[] | null) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function HelpPanel({
  title,
  children,
  defaultExpanded = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  return (
    <Accordion
      disableGutters
      elevation={0}
      defaultExpanded={defaultExpanded}
      sx={{
        bgcolor: "action.hover",
        borderRadius: 1,
        "&:before": { display: "none" },
        "& .MuiAccordionSummary-root": { minHeight: 38, px: 1.25 },
        "& .MuiAccordionDetails-root": { px: 1.25, pt: 0, pb: 1.25 },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreOutlined fontSize="small" />}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <HelpOutlineOutlined color="action" sx={{ fontSize: 17 }} />
          <Typography variant="body2" fontWeight={700}>
            {title}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Typography component="div" variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
          {children}
        </Typography>
      </AccordionDetails>
    </Accordion>
  );
}

function selectionBadge(tokenizer?: RagTokenizerStatusDto | null) {
  const source = String(tokenizer?.selectionSource ?? "").toLowerCase();
  if (tokenizer?.fallbackUsed || source.includes("fallback")) {
    return <Chip size="small" color="warning" label="FALLBACK" />;
  }
  if (source.includes("explicit")) {
    return <Chip size="small" color="primary" label="EXPLICIT" />;
  }
  if (source.includes("auto") || source.includes("mapping") || source.includes("provider-default")) {
    return <Chip size="small" color="success" label="AUTO SELECTED" />;
  }
  return null;
}

function TokenizerStatusPanel({ tokenizer }: { tokenizer?: RagTokenizerStatusDto | null }) {
  const warnings = warningList(tokenizer?.warnings);
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="subtitle2">Tokenizer Status</Typography>
          {selectionBadge(tokenizer)}
          {warnings.length > 0 ? <Chip size="small" color="warning" label="WARNING" /> : null}
        </Stack>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
            gap: 1,
          }}
        >
          {[
            ["embeddingProvider", tokenizer?.embeddingProvider],
            ["embeddingModel", tokenizer?.embeddingModel],
            ["tokenizerProvider", tokenizer?.tokenizerProvider],
            ["tokenizerEncoding", tokenizer?.tokenizerEncoding],
            ["selectionSource", tokenizer?.selectionSource],
            ["confidence", tokenizer?.confidence],
            ["chunkUnit", tokenizer?.chunkUnit],
            ["chunkSize", tokenizer?.chunkSize],
            ["chunkOverlap", tokenizer?.chunkOverlap],
            ["fallbackUsed", tokenizer?.fallbackUsed == null ? undefined : String(tokenizer.fallbackUsed)],
          ].map(([label, value]) => (
            <Box key={label} sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography variant="body2" fontWeight={700} noWrap>
                {formatValue(value)}
              </Typography>
            </Box>
          ))}
        </Box>
        {warnings.length > 0 ? <Alert severity="warning">{warnings.join(" ")}</Alert> : null}
      </Stack>
    </Paper>
  );
}

function TokenDistribution({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <Stack direction="row" spacing={0.5} alignItems="flex-end" sx={{ minHeight: 240, px: 0.5 }}>
      {values.slice(0, 80).map((value, index) => (
        <Box
          key={`${index}-${value}`}
          title={`#${index + 1}: ${value.toLocaleString()} tokens`}
          sx={{
            flex: "1 1 4px",
            minWidth: 3,
            height: `${Math.max(5, (value / max) * 100)}%`,
            bgcolor: value > max * 0.85 ? "warning.main" : "primary.main",
            borderRadius: "3px 3px 0 0",
          }}
        />
      ))}
    </Stack>
  );
}

export function RagChunkingSimulatorPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<SimulatorTab>("chunking");
  const [config, setConfig] = useState<RagChunkConfigResponseDto | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [aiInfo, setAiInfo] = useState<AiInfoResponse | null>(null);
  const [text, setText] = useState("");
  const [objectType, setObjectType] = useState("");
  const [objectId, setObjectId] = useState("");
  const [attachmentId, setAttachmentId] = useState("");
  const [embeddingProvider, setEmbeddingProvider] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [chunkingMode, setChunkingMode] = useState<ChunkingMode>("token-aware");
  const [strategy, setStrategy] = useState("");
  const [tokenizerAutoDetect, setTokenizerAutoDetect] = useState(true);
  const [chunkUnit, setChunkUnit] = useState("token");
  const [chunkSize, setChunkSize] = useState("800");
  const [chunkOverlap, setChunkOverlap] = useState("80");
  const [maxChunkSize, setMaxChunkSize] = useState("1200");
  const [chunkingLoading, setChunkingLoading] = useState(false);
  const [chunkingError, setChunkingError] = useState<string | null>(null);
  const [chunkingResponse, setChunkingResponse] = useState<RagChunkingSimulationResponseDto | null>(null);
  const [chunkingFallbackNotice, setChunkingFallbackNotice] = useState<string | null>(null);
  const [selectedChunk, setSelectedChunk] = useState<RagChunkPreviewItemDto | null>(null);

  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState("5");
  const [contextBudgetTokens, setContextBudgetTokens] = useState("4000");
  const [includeNeighborChunks, setIncludeNeighborChunks] = useState(true);
  const [includeParentChunk, setIncludeParentChunk] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const [contextResponse, setContextResponse] = useState<RagContextSimulationResponseDto | null>(null);
  const [selectedContextChunk, setSelectedContextChunk] = useState<RagContextSimulationChunkDto | null>(null);

  const chunkRows = chunkingResponse?.chunks ?? [];
  const chunkingUsesSizing = chunkStrategyUsesSizing(strategy);
  const tokenDistribution = useMemo(
    () =>
      chunkingResponse?.tokenDistribution?.length
        ? chunkingResponse.tokenDistribution
        : chunkRows.map((row) => Number(itemValue(row, "tokenCount", ["tokenCount"]) ?? 0)),
    [chunkRows, chunkingResponse?.tokenDistribution],
  );
  const contextRows = contextResponse?.chunks ?? contextResponse?.retrievedChunks ?? [];
  const contextBudget = contextResponse?.budgetTokens ?? contextResponse?.contextBudgetTokens ?? numberValue(contextBudgetTokens);
  const chunkingStep = chunkingLoading ? 1 : chunkRows.length > 0 ? 2 : 0;
  const contextStep = contextLoading ? 1 : contextRows.length > 0 || contextResponse?.finalContext ? 2 : 0;
  const embeddingProviders = useMemo(
    () => aiInfo?.providers.filter((provider) => provider.embedding.enabled) ?? [],
    [aiInfo],
  );
  const currentEmbeddingProvider = useMemo(
    () => embeddingProviders.find((provider) => provider.name === embeddingProvider) ?? null,
    [embeddingProvider, embeddingProviders],
  );

  const loadConfig = useCallback(async () => {
    setConfigError(null);
    try {
      const response = await reactAiApi.getRagChunkConfig();
      setConfig(response);
      const defaultStrategy = response.chunking.previewStrategy || response.chunking.strategy || "";
      setStrategy((current) => current || defaultStrategy);
      setChunkSize((current) => current || String(response.chunking.maxSize));
      setChunkOverlap((current) => current || String(response.chunking.overlap));
      setChunkUnit((current) => current || response.chunking.strategy || "token");
    } catch (error) {
      setConfigError(resolveAxiosError(error));
    }
  }, []);

  const loadAiInfo = useCallback(async () => {
    try {
      const response = await reactAiApi.fetchProviders();
      setAiInfo(response);
      const defaultProvider =
        response.providers.find((provider) => provider.name === response.defaultProvider && provider.embedding.enabled) ??
        response.providers.find((provider) => provider.embedding.enabled);
      setEmbeddingProvider((current) => current || defaultProvider?.name || "");
      setEmbeddingModel((current) => current || defaultProvider?.embedding.model || "");
    } catch {
      setAiInfo(null);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
    void loadAiInfo();
  }, [loadAiInfo, loadConfig]);

  async function handleChunkingSimulation() {
    const simulationText = text.trim();
    if (!simulationText) {
      setChunkingError("시뮬레이션할 텍스트를 입력하세요.");
      return;
    }
    setChunkingLoading(true);
    setChunkingError(null);
    setChunkingFallbackNotice(null);
    try {
      if (chunkingMode === "legacy-preview") {
        const previewResponse = await reactAiApi.previewRagChunks({
          text: simulationText,
          documentId: attachmentId.trim() || undefined,
          objectType: objectType.trim() || undefined,
          objectId: objectId.trim() || undefined,
          strategy: strategy || undefined,
          maxSize: chunkingUsesSizing ? numberValue(chunkSize) : undefined,
          overlap: chunkingUsesSizing ? numberValue(chunkOverlap) : undefined,
          unit: chunkUnit,
        });
        const response: RagChunkingSimulationResponseDto = {
          chunks: previewResponse.chunks ?? [],
          totalChunks: previewResponse.totalChunks,
          totalChars: previewResponse.totalChars,
          warnings: previewResponse.warnings ?? [],
          tokenizer: {
            chunkUnit: previewResponse.unit,
            chunkSize: previewResponse.maxSize,
            chunkOverlap: previewResponse.overlap,
            selectionSource: "legacy-preview",
          },
        };
        setChunkingResponse(response);
        setSelectedChunk(response.chunks?.[0] ?? null);
        return;
      }

      const response = await reactAiApi.simulateRagChunking({
        text: simulationText,
        objectType: objectType.trim() || undefined,
        objectId: objectId.trim() || undefined,
        attachmentId: attachmentId.trim() || undefined,
        embeddingProvider: embeddingProvider.trim() || undefined,
        embeddingModel: embeddingModel.trim() || undefined,
        tokenizerAutoDetect,
        chunkUnit,
        chunkSize: numberValue(chunkSize),
        chunkOverlap: numberValue(chunkOverlap),
        maxChunkSize: numberValue(maxChunkSize),
      });
      setChunkingResponse(response);
      setSelectedChunk(response.chunks?.[0] ?? null);
    } catch (error) {
      if (chunkingMode === "token-aware") {
        try {
          const previewResponse = await reactAiApi.previewRagChunks({
            text: simulationText,
            documentId: attachmentId.trim() || undefined,
            objectType: objectType.trim() || undefined,
            objectId: objectId.trim() || undefined,
            strategy: strategy || undefined,
            maxSize: chunkingUsesSizing ? numberValue(chunkSize) : undefined,
            overlap: chunkingUsesSizing ? numberValue(chunkOverlap) : undefined,
            unit: chunkUnit,
          });
          const response: RagChunkingSimulationResponseDto = {
            chunks: previewResponse.chunks ?? [],
            totalChunks: previewResponse.totalChunks,
            totalChars: previewResponse.totalChars,
            warnings: previewResponse.warnings ?? [],
            tokenizer: {
              chunkUnit: previewResponse.unit,
              chunkSize: previewResponse.maxSize,
              chunkOverlap: previewResponse.overlap,
              selectionSource: "legacy-preview-fallback",
              fallbackUsed: true,
            },
          };
          setChunkingResponse(response);
          setSelectedChunk(response.chunks?.[0] ?? null);
          setChunkingFallbackNotice(`Token-aware simulation API 호출에 실패해 기존 청킹 preview API로 실행했습니다. (${resolveAxiosError(error)})`);
        } catch (fallbackError) {
          setChunkingResponse(null);
          setChunkingError(resolveAxiosError(fallbackError));
        }
      } else {
        setChunkingResponse(null);
        setChunkingError(resolveAxiosError(error));
      }
    } finally {
      setChunkingLoading(false);
    }
  }

  async function handleContextSimulation() {
    if (!query.trim()) {
      setContextError("컨텍스트 시뮬레이션 쿼리를 입력하세요.");
      return;
    }
    setContextLoading(true);
    setContextError(null);
    try {
      const response = await reactAiApi.simulateRagContext({
        query: query.trim(),
        objectType: objectType.trim() || undefined,
        objectId: objectId.trim() || undefined,
        topK: numberValue(topK),
        contextBudgetTokens: numberValue(contextBudgetTokens),
        includeNeighborChunks,
        includeParentChunk,
        embeddingProvider: embeddingProvider.trim() || undefined,
        embeddingModel: embeddingModel.trim() || undefined,
      });
      setContextResponse(response);
      setSelectedContextChunk((response.chunks ?? response.retrievedChunks ?? [])[0] ?? null);
    } catch (error) {
      setContextResponse(null);
      setContextError(resolveAxiosError(error));
    } finally {
      setContextLoading(false);
    }
  }

  const chunkColumns = useMemo<ColDef<RagChunkPreviewItemDto>[]>(
    () => [
      {
        colId: "chunkIndex",
        headerName: "Index",
        width: 90,
        valueGetter: (params) => itemValue(params.data, "chunkIndex", ["chunkIndex", "chunkOrder"]) ?? params.data?.chunkOrder ?? "-",
      },
      {
        colId: "textLength",
        headerName: "Text",
        width: 90,
        type: "numericColumn",
        valueGetter: (params) => itemValue(params.data, "textLength", ["textLength", "contentLength"]) ?? params.data?.contentLength,
      },
      {
        colId: "tokenCount",
        headerName: "Tokens",
        width: 100,
        type: "numericColumn",
        valueGetter: (params) => itemValue(params.data, "tokenCount", ["tokenCount"]),
      },
      {
        colId: "tokenizerProvider",
        headerName: "Tokenizer",
        width: 150,
        valueGetter: (params) => itemValue(params.data, "tokenizerProvider", ["tokenizerProvider"]),
      },
      {
        colId: "tokenizerEncoding",
        headerName: "Encoding",
        width: 150,
        valueGetter: (params) => itemValue(params.data, "tokenizerEncoding", ["tokenizerEncoding"]),
      },
      { field: "chunkType", headerName: "유형", width: 120 },
      { field: "headingPath", headerName: "위치", flex: 1, minWidth: 180 },
      { field: "content", headerName: "미리보기", flex: 1.2, minWidth: 260 },
    ],
    [],
  );

  const contextColumns = useMemo<ColDef<RagContextSimulationChunkDto>[]>(
    () => [
      { field: "rank", headerName: "Rank", width: 86 },
      {
        field: "score",
        headerName: "Score",
        width: 100,
        valueFormatter: (params) => (typeof params.value === "number" ? params.value.toFixed(4) : "-"),
      },
      {
        colId: "included",
        headerName: "Context",
        width: 150,
        cellRenderer: (params: { data?: RagContextSimulationChunkDto }) =>
          params.data?.included ? (
            <Chip size="small" color="success" label="CONTEXT INCLUDED" />
          ) : (
            <Chip size="small" color="default" label="CONTEXT EXCLUDED" />
          ),
      },
      {
        colId: "tokenCount",
        headerName: "Tokens",
        width: 100,
        type: "numericColumn",
        valueGetter: (params) => itemValue(params.data, "tokenCount", ["tokenCount"]),
      },
      { field: "cumulativeTokenCount", headerName: "누적", width: 100, type: "numericColumn" },
      {
        colId: "scope",
        headerName: "객체",
        width: 190,
        valueGetter: (params) => {
          const type = params.data?.objectType ?? metadataValue(params.data?.metadata, ["objectType"]);
          const id = params.data?.objectId ?? metadataValue(params.data?.metadata, ["objectId"]);
          return type || id ? `${formatValue(type)} #${formatValue(id)}` : "-";
        },
      },
      { field: "documentId", headerName: "Document", width: 170 },
      { field: "exclusionReason", headerName: "제외 사유", width: 180 },
      { field: "content", headerName: "본문", flex: 1.2, minWidth: 280 },
    ],
    [],
  );

  return (
    <Stack spacing={1.5}>
      <PageToolbar
        divider
        breadcrumbs={["서비스 관리", "AI", "RAG 시뮬레이터"]}
        label="색인 없이 청킹과 RAG 컨텍스트 예산을 진단합니다."
        previous
        onPrevious={() => navigate("/services/ai/rag")}
      />

      <Tabs value={tab} onChange={(_, value) => setTab(value)}>
        <Tab value="chunking" label="청킹 시뮬레이션" />
        <Tab value="context" label="컨텍스트 시뮬레이션" />
      </Tabs>

      <HelpPanel title="이 화면에서 확인할 수 있는 것" defaultExpanded>
        청킹 시뮬레이션은 문서를 실제 색인하지 않고 문장이 어떤 조각으로 나뉘는지 확인하는 기능입니다.
        컨텍스트 시뮬레이션은 검색된 조각 중 어떤 조각이 최종 RAG 답변 재료에 포함되는지 확인하는 기능입니다.
        먼저 기본 조건을 넣고, 실행 후 표의 토큰 수와 경고를 확인하세요.
      </HelpPanel>

      <Stepper activeStep={tab === "chunking" ? chunkingStep : contextStep} sx={{ px: 0.5 }}>
        <Step completed={tab === "chunking" ? Boolean(text.trim()) : Boolean(query.trim())}>
          <StepLabel>조건 입력</StepLabel>
        </Step>
        <Step completed={tab === "chunking" ? chunkRows.length > 0 : contextRows.length > 0}>
          <StepLabel>시뮬레이션 실행</StepLabel>
        </Step>
        <Step completed={tab === "chunking" ? chunkRows.length > 0 : Boolean(contextResponse?.finalContext || contextRows.length)}>
          <StepLabel>결과 확인</StepLabel>
        </Step>
      </Stepper>

      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack spacing={1}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems="flex-start">
            <Typography variant="subtitle2" sx={{ minWidth: 76, pt: { md: 1 } }}>
              공통 조건
            </Typography>
            <ObjectTypeSelect
              value={objectType}
              onChange={setObjectType}
              label="objectType"
              size="small"
              placeholder="전체"
              sx={{ minWidth: 190, flex: "1 1 190px" }}
            />
            <TextField
              label="objectId"
              size="small"
              value={objectId}
              onChange={(event) => setObjectId(event.target.value)}
              sx={{ minWidth: 150, flex: "1 1 150px" }}
            />
            <TextField
              label="attachmentId"
              size="small"
              value={attachmentId}
              onChange={(event) => setAttachmentId(event.target.value)}
              sx={{ minWidth: 150, flex: "1 1 150px" }}
            />
            <TextField
              select
              label="embeddingProvider"
              size="small"
              value={embeddingProvider}
              sx={{ minWidth: 180, flex: "1 1 180px" }}
              onChange={(event) => {
                const nextProvider = event.target.value;
                const provider = embeddingProviders.find((item) => item.name === nextProvider);
                setEmbeddingProvider(nextProvider);
                setEmbeddingModel(provider?.embedding.model ?? "");
              }}
              helperText="쿼리와 토큰 진단에 사용할 embedding provider입니다."
            >
              <MenuItem value="">기본값</MenuItem>
              {embeddingProviders.map((provider) => (
                <MenuItem key={provider.name} value={provider.name}>
                  {provider.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="embeddingModel"
              size="small"
              value={embeddingModel}
              onChange={(event) => setEmbeddingModel(event.target.value)}
              sx={{ minWidth: 220, flex: "1.2 1 220px" }}
            >
              <MenuItem value="">기본값</MenuItem>
              {currentEmbeddingProvider?.embedding.model ? (
                <MenuItem value={currentEmbeddingProvider.embedding.model}>
                  {currentEmbeddingProvider.embedding.model}
                </MenuItem>
              ) : null}
              {embeddingModel && embeddingModel !== currentEmbeddingProvider?.embedding.model ? (
                <MenuItem value={embeddingModel}>{embeddingModel}</MenuItem>
              ) : null}
            </TextField>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            특정 문서나 파일만 확인하려면 객체 범위 또는 attachmentId를 입력합니다. 전체 설정만 확인할 때는 비워 두어도 됩니다.
          </Typography>
        </Stack>
      </Paper>

      {tab === "chunking" ? (
        <Stack spacing={1.5}>
          {configError ? <Alert severity="warning">{configError}</Alert> : null}
          {chunkingError ? <Alert severity="error">{chunkingError}</Alert> : null}
          {chunkingFallbackNotice ? <Alert severity="info">{chunkingFallbackNotice}</Alert> : null}
          <HelpPanel title="청킹 시뮬레이션 읽는 법">
            입력 텍스트가 몇 개의 Chunk로 나뉘는지, 각 Chunk가 너무 길거나 짧지 않은지 봅니다.
            token 방식은 모델이 실제로 처리하는 토큰 기준에 가깝고, character 방식은 글자 수 기준이라 단순하지만 모델 한도와 차이가 날 수 있습니다.
            Tokens 값이 maxChunkSize에 가까운 Chunk가 많으면 답변 품질보다 컨텍스트 예산 소모가 커질 수 있습니다.
          </HelpPanel>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack spacing={1.25}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  select
                  label="시뮬레이션 방식"
                  value={chunkingMode}
                  onChange={(event) => {
                    const nextMode = event.target.value as ChunkingMode;
                    setChunkingMode(nextMode);
                    setChunkUnit(nextMode === "legacy-preview" ? "character" : "token");
                  }}
                  size="small"
                  sx={{ minWidth: { sm: 240 } }}
                  helperText="Token-aware는 모델 토큰 기준 진단, 기존 preview는 기존 AI RAG 버튼과 같은 방식입니다."
                >
                  <MenuItem value="token-aware">Token-aware simulation API</MenuItem>
                  <MenuItem value="legacy-preview">기존 청킹 preview</MenuItem>
                </TextField>
                <TextField
                  select
                  label="청킹 전략"
                  value={strategy}
                  onChange={(event) => setStrategy(event.target.value)}
                  size="small"
                  fullWidth
                  helperText={chunkStrategyHint(strategy)}
                >
                  {(config?.chunking.availableStrategies ?? ["fixed-size", "recursive", "structure-based"]).map((item) => (
                    <MenuItem key={item} value={item}>
                      {item}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <TextField
                label="텍스트"
                value={text}
                onChange={(event) => setText(event.target.value)}
                multiline
                minRows={8}
                maxRows={8}
                size="small"
                fullWidth
                helperText="색인 전에 실제 문서 일부를 붙여 넣고 Chunk 경계와 길이를 확인합니다."
                slotProps={{
                  input: {
                    sx: {
                      alignItems: "flex-start",
                      "& textarea": {
                        height: "192px !important",
                        overflow: "auto !important",
                      },
                    },
                  },
                }}
              />
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "repeat(5, 1fr)" },
                  gap: 1,
                }}
              >
                <TextField select label="chunkUnit" size="small" value={chunkUnit} onChange={(event) => setChunkUnit(event.target.value)}>
                  <MenuItem value="token">token</MenuItem>
                  <MenuItem value="character">character</MenuItem>
                </TextField>
                <TextField
                  label="chunkSize"
                  size="small"
                  value={chunkSize}
                  onChange={(event) => setChunkSize(event.target.value)}
                  disabled={!chunkingUsesSizing}
                  helperText={chunkingUsesSizing ? "Chunk 하나의 목표 크기입니다." : "선택 전략에는 적용되지 않습니다."}
                />
                <TextField
                  label="chunkOverlap"
                  size="small"
                  value={chunkOverlap}
                  onChange={(event) => setChunkOverlap(event.target.value)}
                  disabled={!chunkingUsesSizing}
                  helperText={chunkingUsesSizing ? "앞뒤 Chunk에 중복 포함할 크기입니다." : "선택 전략에는 적용되지 않습니다."}
                />
                <TextField
                  label="maxChunkSize"
                  size="small"
                  value={maxChunkSize}
                  onChange={(event) => setMaxChunkSize(event.target.value)}
                  disabled={chunkingMode === "legacy-preview"}
                  helperText={chunkingMode === "legacy-preview" ? "기존 preview API에는 전달하지 않습니다." : "이 값을 넘는 Chunk는 경고 대상입니다."}
                />
                <FormControlLabel
                  control={<Switch checked={tokenizerAutoDetect} onChange={(event) => setTokenizerAutoDetect(event.target.checked)} />}
                  label="Tokenizer auto-detect"
                  disabled={chunkingMode === "legacy-preview"}
                />
              </Box>
              {chunkingMode === "legacy-preview" && chunkUnit === "token" ? (
                <Alert severity="info">
                  기존 청킹 preview에서 token 단위는 서버 preview API가 token unit을 지원할 때만 적용됩니다.
                </Alert>
              ) : null}
              {config ? (
                <Typography variant="caption" color="text.secondary">
                  기존 preview 제한: {config.limits.maxInputChars.toLocaleString()}자 / {config.limits.maxPreviewChunks.toLocaleString()} chunks
                </Typography>
              ) : null}
              <Box>
                <Button
                  variant="contained"
                  disabled={chunkingLoading || !text.trim()}
                  onClick={() => void handleChunkingSimulation()}
                  startIcon={chunkingLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                  {chunkingLoading ? "실행 중" : "청킹 시뮬레이션 실행"}
                </Button>
              </Box>
            </Stack>
          </Paper>
          <TokenizerStatusPanel tokenizer={chunkingResponse?.tokenizer} />
          {warningList(chunkingResponse?.warnings).length > 0 ? (
            <Alert severity="warning">{warningList(chunkingResponse?.warnings).join(" ")}</Alert>
          ) : null}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.5fr) minmax(280px, 0.7fr)" }, gap: 1.5 }}>
            <GridContent<RagChunkPreviewItemDto>
              columns={chunkColumns}
              rowData={chunkRows}
              loading={chunkingLoading}
              height={TOKEN_DISTRIBUTION_GRID_HEIGHT}
              events={[
                {
                  type: "rowClicked",
                  listener: (event) => setSelectedChunk((event as { data?: RagChunkPreviewItemDto }).data ?? null),
                },
              ]}
            />
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Stack spacing={1}>
                <Typography variant="subtitle2">Token Distribution</Typography>
                <Typography variant="body2" color="text.secondary">
                  막대가 높을수록 해당 Chunk가 많은 토큰을 사용합니다. 일부 막대만 지나치게 높으면 해당 문단 분리 방식을 조정하는 것이 좋습니다.
                </Typography>
                {tokenDistribution.length > 0 ? <TokenDistribution values={tokenDistribution} /> : <Typography variant="body2" color="text.secondary">시뮬레이션 결과가 없습니다.</Typography>}
                <Divider />
                <Typography variant="subtitle2">선택 Chunk</Typography>
                <Typography variant="body2" color="text.secondary">
                  표에서 선택한 Chunk의 전체 본문입니다. 문장이 중간에서 끊기거나 의미 단위가 너무 작으면 chunkSize, overlap, 전략을 조정하세요.
                </Typography>
                <Box component="pre" sx={{ m: 0, height: 220, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12 }}>
                  {selectedChunk?.content ?? "Chunk row를 선택하세요."}
                </Box>
                {selectedChunk?.metadata ? (
                  <Box component="pre" sx={{ m: 0, height: 160, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", color: "text.secondary", fontSize: 12 }}>
                    {JSON.stringify(selectedChunk.metadata, null, 2)}
                  </Box>
                ) : null}
              </Stack>
            </Paper>
          </Box>
        </Stack>
      ) : (
        <Stack spacing={1.5}>
          {contextError ? <Alert severity="error">{contextError}</Alert> : null}
          <HelpPanel title="컨텍스트 시뮬레이션 읽는 법">
            RAG는 검색된 Chunk를 모두 답변에 넣지 않고, 정해진 토큰 예산 안에서 일부만 포함합니다.
            included는 최종 답변 재료에 포함된 Chunk이고, excluded는 검색되었지만 예산이나 확장 규칙 때문에 제외된 Chunk입니다.
            점수가 높은 Chunk가 제외되면 contextBudgetTokens나 neighbor/parent 옵션을 조정해야 합니다.
          </HelpPanel>
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack spacing={1.25}>
              <TextField
                label="query"
                size="small"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                fullWidth
                helperText="사용자가 실제로 질문할 문장을 입력합니다."
              />
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" }, gap: 1 }}>
                <TextField
                  label="topK"
                  size="small"
                  value={topK}
                  onChange={(event) => setTopK(event.target.value)}
                  helperText="검색 후보로 가져올 Chunk 수입니다."
                />
                <TextField
                  label="contextBudgetTokens"
                  size="small"
                  value={contextBudgetTokens}
                  onChange={(event) => setContextBudgetTokens(event.target.value)}
                  helperText="최종 답변에 넣을 수 있는 최대 토큰 예산입니다."
                />
                <FormControlLabel control={<Switch checked={includeNeighborChunks} onChange={(event) => setIncludeNeighborChunks(event.target.checked)} />} label="앞뒤 Chunk 포함" />
                <FormControlLabel control={<Switch checked={includeParentChunk} onChange={(event) => setIncludeParentChunk(event.target.checked)} />} label="상위 Chunk 포함" />
              </Box>
              <Box>
                <Button
                  variant="contained"
                  disabled={contextLoading || !query.trim()}
                  onClick={() => void handleContextSimulation()}
                  startIcon={contextLoading ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                  {contextLoading ? "실행 중" : "컨텍스트 시뮬레이션 실행"}
                </Button>
              </Box>
            </Stack>
          </Paper>
          <TokenizerStatusPanel tokenizer={contextResponse?.tokenizer} />
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={`사용 토큰 ${formatValue(contextResponse?.usedTokens)}`} />
            <Chip size="small" label={`예산 ${formatValue(contextBudget)}`} />
            <Chip size="small" label={`후보 ${contextRows.length.toLocaleString()}건`} />
          </Stack>
          {warningList(contextResponse?.warnings).length > 0 ? (
            <Alert severity="warning">{warningList(contextResponse?.warnings).join(" ")}</Alert>
          ) : null}
          <GridContent<RagContextSimulationChunkDto>
            columns={contextColumns}
            rowData={contextRows}
            loading={contextLoading}
            height={360}
            events={[
              {
                type: "rowClicked",
                listener: (event) => setSelectedContextChunk((event as { data?: RagContextSimulationChunkDto }).data ?? null),
              },
            ]}
          />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, gap: 1.5 }}>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>선택 Chunk</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                선택한 검색 후보의 본문입니다. excluded라면 제외 사유와 누적 토큰을 함께 확인하세요.
              </Typography>
              <Box component="pre" sx={{ m: 0, height: 260, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12 }}>
                {selectedContextChunk?.content ?? "검색 결과 row를 선택하세요."}
              </Box>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Final Context Preview</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                실제 답변 생성에 전달될 문맥 미리보기입니다. 중요한 내용이 빠져 있으면 topK나 예산을 늘려 확인하세요.
              </Typography>
              <Box component="pre" sx={{ m: 0, height: 260, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12 }}>
                {contextResponse?.finalContext ?? "컨텍스트 시뮬레이션 결과가 없습니다."}
              </Box>
            </Paper>
          </Box>
        </Stack>
      )}
    </Stack>
  );
}
