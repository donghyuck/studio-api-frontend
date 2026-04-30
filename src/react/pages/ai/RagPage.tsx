import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ArticleOutlined,
  CheckBoxOutlineBlankOutlined,
  CheckBoxOutlined,
  ChevronRightOutlined,
  ExpandMoreOutlined,
  HubOutlined,
  InfoOutlined,
  PlayArrowOutlined,
  ReplayOutlined,
  SearchOutlined,
  StorageOutlined,
} from "@mui/icons-material";
import type { ColDef, GridOptions, ICellRendererParams } from "ag-grid-community";
import { GridContent } from "@/react/components/ag-grid";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { reactAiApi } from "@/react/pages/ai/api";
import { reactFilesApi } from "@/react/pages/files/api";
import { reactObjectTypeApi } from "@/react/pages/objecttype/api";
import type {
  AiInfoResponse,
  ChatMessageDto,
  ChatResponseMetadataDto,
  ProviderInfo,
  RagChunkConfigResponseDto,
  RagChunkPreviewItemDto,
  RagIndexChunkDto,
  RagIndexChunkPageResponseDto,
  RagIndexJobDto,
  RagIndexJobLogDto,
  RagIndexJobStatus,
  SearchResultDto,
  TokenUsageDto,
  VectorSearchResultDto,
} from "@/types/studio/ai";
import type { ObjectTypeDto } from "@/types/studio/objecttype";
import { resolveAxiosError } from "@/utils/helpers";

type ValidationTab = "vector" | "rag" | "chat";
type RagJobStatusFilter = RagIndexJobStatus | "";
type ObjectTypeOption = {
  value: string;
  label: string;
  name: string;
  code: string;
  objectType: number;
};
type ConfirmedScope = {
  objectType: string;
  objectId: string;
  attachmentId?: string;
};

function formatValue(value: unknown) {
  if (value == null || value === "") {
    return "-";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function chunkStrategyHint(strategy: string) {
  switch (strategy) {
    case "fixed-size":
      return "고정 길이 기준으로 단순하게 나눕니다. 빠르지만 문단 구조를 덜 반영합니다.";
    case "recursive":
      return "문단, 문장, 공백 순서로 가능한 자연스럽게 나눕니다. 일반 문서에 적합합니다.";
    case "structure-based":
      return "제목, 섹션 같은 문서 구조를 우선 반영해 나눕니다. 구조화 문서에 적합합니다.";
    default:
      return "서버가 지원하는 청킹 전략을 선택합니다.";
  }
}

function chunkStrategyUsesSizing(strategy: string) {
  return ["fixed-size", "recursive", "structure-based"].includes(strategy.trim().toLowerCase());
}

function pickMetadataValue(metadata: Record<string, unknown> | undefined, keys: string[]) {
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

function getChunkOrder(metadata: Record<string, unknown> | undefined) {
  return pickMetadataValue(metadata, [
    "chunkOrder",
    "chunkIndex",
    "chunk_order",
    "chunk_index",
    "chunkNo",
    "chunk_no",
    "order",
    "index",
  ]);
}

function getChunkId(metadata: Record<string, unknown> | undefined) {
  return pickMetadataValue(metadata, ["chunkId", "chunk_id", "chunkIdentifier", "id"]);
}

function formatChunkValue(metadata: Record<string, unknown> | undefined) {
  const order = getChunkOrder(metadata);
  if (order != null) {
    return `#${formatValue(order)}`;
  }

  const id = getChunkId(metadata);
  if (id != null) {
    return formatValue(id);
  }
  return "-";
}

function formatChunkTooltip(metadata: Record<string, unknown> | undefined) {
  const order = getChunkOrder(metadata);
  const id = getChunkId(metadata);
  if (order != null && id != null) {
    return `순서: ${formatValue(order)} / Chunk ID: ${formatValue(id)}`;
  }
  if (order != null) {
    return `순서: ${formatValue(order)}`;
  }
  if (id != null) {
    return `Chunk ID: ${formatValue(id)}`;
  }
  return "Chunk 정보 없음";
}

function chunkRowKey(row?: RagIndexChunkDto | null) {
  if (!row) {
    return "";
  }
  return row.chunkId || `${row.documentId}:${row.chunkOrder ?? ""}:${row.sourceRef ?? ""}`;
}

function formatTokenUsage(usage?: TokenUsageDto) {
  if (!usage) {
    return "토큰 정보 없음";
  }
  return `입력 ${usage.inputTokens.toLocaleString()} / 출력 ${usage.outputTokens.toLocaleString()} / 합계 ${usage.totalTokens.toLocaleString()}`;
}

function buildVisibleRagContext(rows: SearchResultDto[], limit: number) {
  const maxChars = 6000;
  const chunks = rows.slice(0, Math.max(1, limit)).map((row, index) => {
    const content = row.content?.trim() || "";
    return `[화면 RAG 후보 ${index + 1}] documentId=${row.documentId} score=${formatValue(row.score)}\n${content}`;
  });
  const context = chunks.join("\n\n").trim();
  return context.length > maxChars ? `${context.slice(0, maxChars)}\n...` : context;
}

function extractRagDiagnostics(metadata?: ChatResponseMetadataDto | null) {
  if (!metadata) {
    return null;
  }

  const diagnostics: Record<string, unknown> = {};
  const retrieval = metadata.ragDiagnostics;
  const context = metadata.ragContextDiagnostics;
  if (retrieval && typeof retrieval === "object") {
    diagnostics.retrieval = retrieval;
  }
  if (context && typeof context === "object") {
    diagnostics.context = context;
  }
  return Object.keys(diagnostics).length > 0 ? diagnostics : null;
}

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function statusColor(status?: RagIndexJobStatus) {
  if (status === "SUCCEEDED") return "success";
  if (status === "WARNING") return "warning";
  if (status === "FAILED" || status === "CANCELLED") return "error";
  if (status === "RUNNING" || status === "PENDING") return "info";
  return "default";
}

function isPositiveIntegerText(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return false;
  }
  const numberValue = Number(trimmed);
  return Number.isInteger(numberValue) && numberValue > 0;
}

function inferAttachmentIdFromJob(job: RagIndexJobDto) {
  if (job.sourceType !== "attachment") {
    return undefined;
  }
  if (isPositiveIntegerText(job.documentId)) {
    return job.documentId;
  }
  if (job.objectType === "attachment" && isPositiveIntegerText(job.objectId)) {
    return job.objectId;
  }
  return undefined;
}

function JobSelectionToggle({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <IconButton
      type="button"
      size="small"
      aria-label={checked ? "작업 선택 해제" : "작업 선택"}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      sx={{
        width: 28,
        height: 28,
        p: 0,
        color: checked ? "primary.main" : "text.secondary",
      }}
    >
      {checked ? <CheckBoxOutlined fontSize="small" /> : <CheckBoxOutlineBlankOutlined fontSize="small" />}
    </IconButton>
  );
}

function ErrorMessageCell(params: { value?: string }) {
  const value = params.value?.trim();
  if (!value) {
    return "-";
  }
  return (
    <Tooltip title={value} placement="top-start">
      <Typography variant="body2" noWrap sx={{ maxWidth: "100%" }}>
        {value}
      </Typography>
    </Tooltip>
  );
}

function StatusMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "success" | "warning";
}) {
  const color =
    tone === "success" ? "success.main" : tone === "warning" ? "warning.main" : "text.primary";
  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        p: 1.25,
        minHeight: 76,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="subtitle2" color={color} sx={{ mt: 0.5 }} noWrap>
        {value}
      </Typography>
    </Box>
  );
}

function SummaryStatusCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        borderRadius: 2,
        bgcolor: "action.hover",
        px: 1.25,
        py: 1,
      }}
    >
      <Stack spacing={0.25}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          {title}
        </Typography>
        <Typography variant="body2" fontWeight={700} noWrap>
          {value}
        </Typography>
        {hint ? (
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
            {hint}
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}

function SearchResultDetail({
  title,
  content,
  metadata,
}: {
  title: string;
  content?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 1.25 }}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">{title}</Typography>
        <Box
          component="pre"
          sx={{
            m: 0,
            maxHeight: 260,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            borderRadius: 2,
            bgcolor: "action.hover",
            p: 1,
            fontFamily: (theme) => theme.typography.fontFamily,
            fontSize: 12,
            lineHeight: 1.7,
          }}
        >
          {content?.trim() || "검색 결과 row를 선택하면 전체 콘텐츠가 여기에 표시됩니다."}
        </Box>
        {metadata ? (
          <Box
            component="pre"
            sx={{
              m: 0,
              maxHeight: 180,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              color: "text.secondary",
              fontSize: 12,
            }}
          >
            {JSON.stringify(metadata, null, 2)}
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}

export function RagPage() {
  const statusSectionRef = useRef<HTMLDivElement | null>(null);
  const targetSectionRef = useRef<HTMLDivElement | null>(null);
  const jobsSectionRef = useRef<HTMLDivElement | null>(null);
  const validationSectionRef = useRef<HTMLDivElement | null>(null);
  const chunksSectionRef = useRef<HTMLDivElement | null>(null);
  const diagnosticsSectionRef = useRef<HTMLDivElement | null>(null);
  const selectedJobIdRef = useRef<string | null>(null);
  const jobLogsCacheRef = useRef(new Map<string, RagIndexJobLogDto[]>());
  const objectMetadataCacheRef = useRef(new Map<string, Record<string, unknown>>());
  const chunksPageCacheRef = useRef(new Map<string, RagIndexChunkPageResponseDto>());
  const [aiInfo, setAiInfo] = useState<AiInfoResponse | null>(null);
  const [provider, setProvider] = useState("");
  const [objectTypes, setObjectTypes] = useState<ObjectTypeDto[]>([]);
  const [model, setModel] = useState("");
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState("5");
  const [minScore, setMinScore] = useState("");
  const [objectType, setObjectType] = useState("");
  const [objectId, setObjectId] = useState("");
  const [attachmentId, setAttachmentId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [indexText, setIndexText] = useState("");
  const [forceReindex, setForceReindex] = useState(false);
  const [indexChunkingStrategy, setIndexChunkingStrategy] = useState("");
  const [indexChunkMaxSize, setIndexChunkMaxSize] = useState("");
  const [indexChunkOverlap, setIndexChunkOverlap] = useState("");
  const [indexChunkUnit, setIndexChunkUnit] = useState("character");
  const [debug, setDebug] = useState(true);
  const [expandedQuery, setExpandedQuery] = useState("");
  const [expandedKeywords, setExpandedKeywords] = useState<string[]>([]);
  const [vectorRows, setVectorRows] = useState<VectorSearchResultDto[]>([]);
  const [ragRows, setRagRows] = useState<SearchResultDto[]>([]);
  const [vectorSearched, setVectorSearched] = useState(false);
  const [ragSearched, setRagSearched] = useState(false);
  const [lastRagSearchQuery, setLastRagSearchQuery] = useState("");
  const [selectedVectorResult, setSelectedVectorResult] = useState<VectorSearchResultDto | null>(null);
  const [selectedRagResult, setSelectedRagResult] = useState<SearchResultDto | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessageDto[]>([]);
  const [ragDiagnostics, setRagDiagnostics] = useState<Record<string, unknown> | null>(null);
  const [targetMetadata, setTargetMetadata] = useState<Record<string, unknown> | null>(null);
  const [targetIndexed, setTargetIndexed] = useState<boolean | null>(null);
  const [confirmedScope, setConfirmedScope] = useState<ConfirmedScope | null>(null);
  const [jobs, setJobs] = useState<RagIndexJobDto[]>([]);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [jobStatusFilter, setJobStatusFilter] = useState<RagJobStatusFilter>("");
  const [selectedJob, setSelectedJob] = useState<RagIndexJobDto | null>(null);
  const [jobLogs, setJobLogs] = useState<RagIndexJobLogDto[]>([]);
  const [chunks, setChunks] = useState<RagIndexChunkDto[]>([]);
  const [selectedChunk, setSelectedChunk] = useState<RagIndexChunkDto | null>(null);
  const [chunkPage, setChunkPage] = useState({ offset: 0, limit: 50, hasMore: false });
  const [lastMetadata, setLastMetadata] = useState<ChatResponseMetadataDto | null>(null);
  const [lastValidatedAt, setLastValidatedAt] = useState<string | null>(null);
  const [tab, setTab] = useState<ValidationTab>("vector");
  const [chunkPreviewOpen, setChunkPreviewOpen] = useState(false);
  const [chunkConfig, setChunkConfig] = useState<RagChunkConfigResponseDto | null>(null);
  const [chunkPreviewText, setChunkPreviewText] = useState("");
  const [chunkPreviewStrategy, setChunkPreviewStrategy] = useState("");
  const [chunkPreviewMaxSize, setChunkPreviewMaxSize] = useState("");
  const [chunkPreviewOverlap, setChunkPreviewOverlap] = useState("");
  const [chunkPreviewRows, setChunkPreviewRows] = useState<RagChunkPreviewItemDto[]>([]);
  const [selectedPreviewChunk, setSelectedPreviewChunk] = useState<RagChunkPreviewItemDto | null>(null);
  const [chunkPreviewSummary, setChunkPreviewSummary] = useState<{
    totalChunks: number;
    totalChars: number;
    strategy: string;
    maxSize: number;
    overlap: number;
    unit: string;
    warnings: string[];
  } | null>(null);
  const [chunkPreviewLoading, setChunkPreviewLoading] = useState(false);
  const [chunkPreviewError, setChunkPreviewError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [vectorLoading, setVectorLoading] = useState(false);
  const [ragLoading, setRagLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  const providers = useMemo<ProviderInfo[]>(() => aiInfo?.providers ?? [], [aiInfo]);
  const currentProvider = useMemo(
    () => providers.find((item) => item.name === provider),
    [provider, providers]
  );
  const objectTypeOptions = useMemo<ObjectTypeOption[]>(
    () =>
      objectTypes.map((item) => ({
        value: String(item.objectType),
        label: `${item.code} #${item.objectType}`,
        name: item.name,
        code: item.code,
        objectType: item.objectType,
      })),
    [objectTypes]
  );
  const selectedObjectTypeOption = useMemo(
    () => objectTypeOptions.find((item) => item.value === objectType) ?? null,
    [objectType, objectTypeOptions]
  );
  const formatObjectTypeLabel = useCallback(
    (value?: string | null) => {
      if (!value) {
        return "-";
      }
      return objectTypeOptions.find((item) => item.value === value)?.label ?? value;
    },
    [objectTypeOptions]
  );
  const resolveObjectTypeValue = useCallback(
    (value?: string | null) => {
      const trimmed = value?.trim();
      if (!trimmed) {
        return "";
      }
      const idFromLabel = trimmed.match(/#\s*(\d+)\s*$/)?.[1];
      if (idFromLabel) {
        return idFromLabel;
      }
      const match = objectTypeOptions.find(
        (item) => item.value === trimmed || item.label === trimmed || item.code === trimmed
      );
      return match?.value ?? trimmed;
    },
    [objectTypeOptions]
  );
  const canCheckTarget = Boolean(attachmentId.trim() || (objectType.trim() && objectId.trim()));
  const hasConfirmedScope = Boolean(confirmedScope);
  const canIndexAttachment = Boolean(confirmedScope?.attachmentId);
  const currentAttachmentIdForIndexing = resolveAttachmentIdForIndexing();
  const canForceReindexTarget = Boolean(confirmedScope && currentAttachmentIdForIndexing);
  const canCreateTextJob = Boolean(confirmedScope && !confirmedScope.attachmentId && indexText.trim());
  const selectedJobSucceeded = selectedJob?.status === "SUCCEEDED" || selectedJob?.status === "WARNING";
  const selectedJobFailed = selectedJob?.status === "FAILED" || selectedJob?.status === "CANCELLED";
  const hasSearchResult = vectorRows.length > 0 || ragRows.length > 0 || Boolean(lastMetadata);
  const hasJobInspection = Boolean(selectedJob && (jobLogs.length > 0 || chunks.length > 0));
  const workflowActiveStep = !confirmedScope
    ? 0
    : !selectedJob || !selectedJobSucceeded
      ? 1
      : !hasJobInspection
        ? 2
        : 3;
  const visibleJobCount = jobs.length;
  const vectorReady = Boolean(aiInfo?.vector.available);
  const indexChunkingUsesSizing = chunkStrategyUsesSizing(indexChunkingStrategy);
  const chunkPreviewTextLength = chunkPreviewText.trim().length;
  const chunkPreviewUsesSizing = chunkStrategyUsesSizing(chunkPreviewStrategy);
  const chunkPreviewEffectiveMaxSize =
    (chunkPreviewUsesSizing ? optionalNumber(chunkPreviewMaxSize) : undefined) ?? chunkConfig?.chunking.maxSize ?? 0;
  const chunkPreviewSingleChunkLikely =
    chunkPreviewUsesSizing &&
    chunkPreviewTextLength > 0 &&
    chunkPreviewEffectiveMaxSize > 0 &&
    chunkPreviewTextLength <= chunkPreviewEffectiveMaxSize;

  function objectCacheKey(scopeObjectType?: string, scopeObjectId?: string) {
    return `${scopeObjectType ?? ""}:${scopeObjectId ?? ""}`;
  }

  function chunksCacheKey(scopeObjectType?: string, scopeObjectId?: string, offset = 0, limit = chunkPage.limit) {
    return `${objectCacheKey(scopeObjectType, scopeObjectId)}:${offset}:${limit}`;
  }

  function clearObjectInspectionCache(scopeObjectType?: string, scopeObjectId?: string) {
    const prefix = `${objectCacheKey(scopeObjectType, scopeObjectId)}:`;
    objectMetadataCacheRef.current.delete(objectCacheKey(scopeObjectType, scopeObjectId));
    for (const key of chunksPageCacheRef.current.keys()) {
      if (key.startsWith(prefix)) {
        chunksPageCacheRef.current.delete(key);
      }
    }
  }

  function resetConfirmedScope() {
    setConfirmedScope(null);
    setTargetIndexed(null);
    setTargetMetadata(null);
    setSelectedJob(null);
    setJobLogs([]);
    setChunks([]);
    setSelectedChunk(null);
    setVectorRows([]);
    setRagRows([]);
    setVectorSearched(false);
    setRagSearched(false);
    setSelectedVectorResult(null);
    setSelectedRagResult(null);
    setChatMessages([]);
    setLastMetadata(null);
    setRagDiagnostics(null);
    setLastRagSearchQuery("");
    setChunkPage((current) => ({ ...current, offset: 0, hasMore: false }));
  }

  function clearSelectedJob() {
    setSelectedJob(null);
    setJobLogs([]);
    setChunks([]);
    setSelectedChunk(null);
    setTargetIndexed(null);
    setTargetMetadata(null);
  }

  function toggleSelectedJob(job: RagIndexJobDto) {
    if (job.jobId === selectedJobIdRef.current) {
      clearSelectedJob();
      return;
    }
    void handleSelectJob(job);
  }

  const loadProviders = useCallback(async () => {
    setError(null);
    try {
      const data = await reactAiApi.fetchProviders();
      setAiInfo(data);
      setProvider(data.defaultProvider);
      const match = data.providers.find((item) => item.name === data.defaultProvider);
      setModel(match?.chat.model ?? "");
    } catch (loadError) {
      setError(resolveAxiosError(loadError));
    }
  }, []);

  const loadObjectTypes = useCallback(async () => {
    try {
      setObjectTypes(await reactObjectTypeApi.list({ status: "ACTIVE" }));
    } catch {
      setObjectTypes([]);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    setError(null);
    setJobsLoading(true);
    try {
      const response = await reactAiApi.listRagJobs({
        status: jobStatusFilter || undefined,
        offset: 0,
        limit: 50,
        sort: "createdAt",
        direction: "desc",
      });
      setJobs(response.items ?? []);
      setJobsTotal(response.total ?? 0);
      const selectedJobId = selectedJobIdRef.current;
      if (selectedJobId && !response.items.some((job) => job.jobId === selectedJobId)) {
        setSelectedJob(null);
        setJobLogs([]);
        setChunks([]);
      }
    } catch (loadError) {
      setError(resolveAxiosError(loadError));
    } finally {
      setJobsLoading(false);
    }
  }, [jobStatusFilter]);

  useEffect(() => {
    void loadProviders();
    void loadObjectTypes();
  }, [loadObjectTypes, loadProviders]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    selectedJobIdRef.current = selectedJob?.jobId ?? null;
  }, [selectedJob?.jobId]);

  const loadChunkConfig = useCallback(async () => {
    setChunkPreviewError(null);
    try {
      const config = await reactAiApi.getRagChunkConfig();
      setChunkConfig(config);
      const defaultStrategy = config.chunking.previewStrategy || config.chunking.strategy || "";
      setIndexChunkingStrategy((current) => current || defaultStrategy);
      setIndexChunkMaxSize((current) => current || String(config.chunking.maxSize));
      setIndexChunkOverlap((current) => current || String(config.chunking.overlap));
      setChunkPreviewStrategy((current) => current || defaultStrategy);
      setChunkPreviewMaxSize((current) => current || String(config.chunking.maxSize));
      setChunkPreviewOverlap((current) => current || String(config.chunking.overlap));
    } catch (configError) {
      setChunkPreviewError(resolveAxiosError(configError));
    }
  }, []);

  useEffect(() => {
    void loadChunkConfig();
  }, [loadChunkConfig]);

  useEffect(() => {
    if (!chunkPreviewOpen || chunkConfig) {
      return;
    }

    let alive = true;
    setChunkPreviewError(null);
    void reactAiApi
      .getRagChunkConfig()
      .then((config) => {
        if (!alive) {
          return;
        }
        setChunkConfig(config);
        const defaultStrategy = config.chunking.previewStrategy || config.chunking.strategy || "";
        setIndexChunkingStrategy((current) => current || defaultStrategy);
        setIndexChunkMaxSize((current) => current || String(config.chunking.maxSize));
        setIndexChunkOverlap((current) => current || String(config.chunking.overlap));
        setChunkPreviewStrategy((current) => current || defaultStrategy);
        setChunkPreviewMaxSize((current) => current || String(config.chunking.maxSize));
        setChunkPreviewOverlap((current) => current || String(config.chunking.overlap));
      })
      .catch((configError) => {
        if (!alive) {
          return;
        }
        setChunkPreviewError(resolveAxiosError(configError));
      });

    return () => {
      alive = false;
    };
  }, [chunkConfig, chunkPreviewOpen]);

  async function handleRefresh() {
    await Promise.all([loadProviders(), loadJobs()]);
    if (selectedJob) {
      await handleSelectJob(selectedJob, true);
    }
  }

  const vectorColumnDefs = useMemo<ColDef<VectorSearchResultDto>[]>(
    () => [
      { field: "id", headerName: "ID", width: 70, flex: 0, filter: false, cellClass: "ag-center-cell" },
      {
        field: "score",
        headerName: "유사도",
        width: 90,
        flex: 0,
        sortable: true,
        filter: false,
        cellClass: "ag-center-cell",
        valueFormatter: (params) =>
          typeof params.value === "number" ? params.value.toFixed(4) : "-",
      },
      {
        colId: "objectScope",
        headerName: "객체 범위",
        width: 190,
        flex: 0,
        filter: false,
        valueGetter: (params) => {
          const metadata = params.data?.metadata ?? {};
          const type = metadata.objectType;
          const id = metadata.objectId;
          return type || id ? `${type ?? "-"}#${id ?? "-"}` : "-";
        },
      },
      {
        colId: "chunkOrder",
        headerName: "Chunk",
        width: 80,
        flex: 0,
        filter: false,
        cellClass: "ag-center-cell",
        valueGetter: (params) => formatChunkValue(params.data?.metadata),
        tooltipValueGetter: (params) => formatChunkTooltip(params.data?.metadata),
      },
      { field: "content", headerName: "콘텐츠", flex: 1, minWidth: 420, filter: false },
    ],
    []
  );

  const ragColumnDefs = useMemo<ColDef<SearchResultDto>[]>(
    () => [
      { field: "documentId", headerName: "Document", width: 120, flex: 0, filter: false },
      {
        field: "score",
        headerName: "유사도",
        width: 90,
        flex: 0,
        sortable: true,
        filter: false,
        cellClass: "ag-center-cell",
        valueFormatter: (params) =>
          typeof params.value === "number" ? params.value.toFixed(4) : "-",
      },
      {
        colId: "objectScope",
        headerName: "객체 범위",
        width: 190,
        flex: 0,
        filter: false,
        valueGetter: (params) => {
          const metadata = params.data?.metadata ?? {};
          const type = metadata.objectType;
          const id = metadata.objectId;
          return type || id ? `${type ?? "-"}#${id ?? "-"}` : "-";
        },
      },
      {
        colId: "chunkOrder",
        headerName: "Chunk",
        width: 80,
        flex: 0,
        filter: false,
        cellClass: "ag-center-cell",
        valueGetter: (params) => formatChunkValue(params.data?.metadata),
        tooltipValueGetter: (params) => formatChunkTooltip(params.data?.metadata),
      },
      { field: "content", headerName: "콘텐츠", flex: 1, minWidth: 420, filter: false },
    ],
    []
  );

  const jobColumnDefs = useMemo<ColDef<RagIndexJobDto>[]>(
    () => [
      {
        colId: "selection",
        headerName: "",
        width: 44,
        minWidth: 44,
        maxWidth: 44,
        pinned: "left",
        sortable: false,
        filter: false,
        resizable: false,
        suppressMovable: true,
        lockPosition: true,
        cellClass: "selection-column-centered",
        headerClass: "selection-column-centered",
        cellRenderer: (params: ICellRendererParams<RagIndexJobDto>) => {
          const checked = params.data?.jobId === selectedJob?.jobId;

          return (
            <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <JobSelectionToggle
                checked={checked}
                onToggle={() => {
                  if (!params.data) {
                    return;
                  }
                  toggleSelectedJob(params.data);
                }}
              />
            </Box>
          );
        },
      },
      {
        field: "status",
        headerName: "상태",
        width: 120,
        filter: false,
        cellRenderer: (params: { value?: RagIndexJobStatus }) => (
          <Chip size="small" color={statusColor(params.value)} label={params.value ?? "-"} />
        ),
      },
      { field: "currentStep", headerName: "단계", width: 120, filter: false },
      { field: "objectType", headerName: "객체 유형", width: 130, filter: false },
      { field: "objectId", headerName: "객체 ID", width: 130, filter: false },
      { field: "sourceType", headerName: "소스", width: 120, filter: false },
      {
        field: "chunkCount",
        headerName: "Chunk",
        width: 100,
        filter: false,
        type: "numericColumn",
      },
      {
        field: "warningCount",
        headerName: "경고",
        width: 90,
        filter: false,
        type: "numericColumn",
      },
      {
        field: "durationMs",
        headerName: "소요",
        width: 110,
        filter: false,
        valueFormatter: (params) =>
          typeof params.value === "number" ? `${params.value.toLocaleString()}ms` : "-",
      },
      {
        field: "createdAt",
        headerName: "생성일시",
        width: 190,
        filter: false,
        valueFormatter: (params) => formatDateTime(params.value as string | undefined),
      },
      {
        field: "errorMessage",
        headerName: "오류",
        flex: 1.4,
        minWidth: 220,
        filter: false,
        tooltipField: "errorMessage",
        cellRenderer: ErrorMessageCell,
      },
    ],
    [selectedJob?.jobId]
  );

  const jobGridOptions = useMemo<GridOptions<RagIndexJobDto>>(
    () => ({
      getRowId: (params) => params.data.jobId,
      suppressRowClickSelection: true,
      rowClassRules: {
        "rag-job-row-selected": (params) => params.data?.jobId === selectedJob?.jobId,
      },
    }),
    [selectedJob?.jobId]
  );

  const chunkColumnDefs = useMemo<ColDef<RagIndexChunkDto>[]>(
    () => [
      { field: "chunkOrder", headerName: "순서", width: 90, filter: false },
      { field: "chunkId", headerName: "Chunk ID", width: 180, filter: false },
      { field: "documentId", headerName: "Document", width: 160, filter: false },
      {
        field: "score",
        headerName: "점수",
        width: 100,
        filter: false,
        valueFormatter: (params) =>
          typeof params.value === "number" ? params.value.toFixed(4) : "-",
      },
      { field: "headingPath", headerName: "위치", width: 180, filter: false },
      { field: "content", headerName: "콘텐츠", flex: 1.4, filter: false },
    ],
    []
  );

  const chunkGridOptions = useMemo<GridOptions<RagIndexChunkDto>>(
    () => ({
      getRowId: (params) => chunkRowKey(params.data),
      rowSelection: {
        mode: "singleRow",
        enableClickSelection: false,
        checkboxes: false,
      },
      suppressRowClickSelection: true,
      rowClassRules: {
        "rag-chunk-row-selected": (params) => chunkRowKey(params.data) === chunkRowKey(selectedChunk),
      },
    }),
    [selectedChunk]
  );

  const chunkPreviewColumnDefs = useMemo<ColDef<RagChunkPreviewItemDto>[]>(
    () => [
      { field: "chunkOrder", headerName: "순서", width: 90, filter: false },
      { field: "chunkId", headerName: "Chunk ID", width: 180, filter: false },
      { field: "chunkType", headerName: "유형", width: 110, filter: false },
      { field: "contentLength", headerName: "길이", width: 90, filter: false, type: "numericColumn" },
      { field: "headingPath", headerName: "위치", width: 180, filter: false },
      { field: "content", headerName: "미리보기", flex: 1.4, filter: false },
    ],
    []
  );

  const logColumnDefs = useMemo<ColDef<RagIndexJobLogDto>[]>(
    () => [
      {
        field: "level",
        headerName: "레벨",
        width: 100,
        filter: false,
        cellRenderer: (params: { value?: string }) => (
          <Chip
            size="small"
            color={params.value === "ERROR" ? "error" : params.value === "WARN" ? "warning" : "default"}
            label={params.value ?? "-"}
          />
        ),
      },
      { field: "step", headerName: "단계", width: 120, filter: false },
      { field: "code", headerName: "코드", width: 200, filter: false },
      { field: "message", headerName: "메시지", flex: 1, filter: false },
      { field: "detail", headerName: "상세", flex: 1, filter: false },
      {
        field: "createdAt",
        headerName: "생성일시",
        width: 190,
        filter: false,
        valueFormatter: (params) => formatDateTime(params.value as string | undefined),
      },
    ],
    []
  );

  function resolveScope() {
    if (confirmedScope) {
      return {
        objectType: resolveObjectTypeValue(confirmedScope.objectType),
        objectId: confirmedScope.objectId,
      };
    }
    const scopedAttachmentId = attachmentId.trim();
    const scopedObjectType = resolveObjectTypeValue(objectType);
    return {
      objectType: scopedObjectType || (scopedAttachmentId ? "attachment" : undefined),
      objectId: objectId.trim() || scopedAttachmentId || undefined,
    };
  }

  function resolveAttachmentIdForIndexing() {
    if (confirmedScope?.attachmentId) {
      return confirmedScope.attachmentId;
    }

    const trimmedDocumentId = documentId.trim();
    if (
      selectedJob?.sourceType === "attachment" &&
      isPositiveIntegerText(trimmedDocumentId)
    ) {
      return trimmedDocumentId;
    }

    if (
      selectedJob?.sourceType === "attachment" &&
      selectedJob.objectType === "attachment" &&
      isPositiveIntegerText(selectedJob.objectId)
    ) {
      return selectedJob.objectId;
    }

    return "";
  }

  function markValidated() {
    setLastValidatedAt(new Date().toLocaleString());
  }

  function activateValidationTab(nextTab: ValidationTab) {
    setTab(nextTab);
    if (nextTab === "chat" && ragRows.length > 0 && chatMessages.length === 0) {
      void handleRagChat();
    }
    window.requestAnimationFrame(() => {
      validationSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  async function loadObjectMetadata(scopeObjectType?: string, scopeObjectId?: string, force = false) {
    if (!scopeObjectType || !scopeObjectId) {
      return;
    }
    const cacheKey = objectCacheKey(scopeObjectType, scopeObjectId);
    if (!force && objectMetadataCacheRef.current.has(cacheKey)) {
      setTargetMetadata(objectMetadataCacheRef.current.get(cacheKey) ?? null);
      return;
    }
    try {
      const metadata = await reactAiApi.getRagObjectMetadata(scopeObjectType, scopeObjectId);
      objectMetadataCacheRef.current.set(cacheKey, metadata);
      setTargetMetadata(metadata);
    } catch {
      // Metadata endpoint can be unavailable for stores that do not support it.
    }
  }

  async function loadChunks(scopeObjectType?: string, scopeObjectId?: string, offset = 0, force = false) {
    if (!scopeObjectType || !scopeObjectId) {
      setChunks([]);
      setSelectedChunk(null);
      return;
    }
    const cacheKey = chunksCacheKey(scopeObjectType, scopeObjectId, offset, chunkPage.limit);
    if (!force && chunksPageCacheRef.current.has(cacheKey)) {
      const cached = chunksPageCacheRef.current.get(cacheKey);
      if (cached) {
        setChunks(cached.items ?? []);
        setSelectedChunk(cached.items?.[0] ?? null);
        setChunkPage({
          offset: cached.offset,
          limit: cached.limit,
          hasMore: cached.hasMore,
        });
        return;
      }
    }
    setChunksLoading(true);
    try {
      const response = await reactAiApi.getRagObjectChunksPage(scopeObjectType, scopeObjectId, offset, chunkPage.limit);
      chunksPageCacheRef.current.set(cacheKey, response);
      setChunks(response.items ?? []);
      setSelectedChunk(response.items?.[0] ?? null);
      setChunkPage({
        offset: response.offset,
        limit: response.limit,
        hasMore: response.hasMore,
      });
    } finally {
      setChunksLoading(false);
    }
  }

  async function handleSelectJob(job: RagIndexJobDto, force = false) {
    const jobAttachmentId = inferAttachmentIdFromJob(job);
    const alreadySelected = selectedJobIdRef.current === job.jobId;
    setSelectedJob(job);
    setObjectType(job.objectType);
    setObjectId(job.objectId);
    setAttachmentId(jobAttachmentId ?? "");
    setDocumentId(job.documentId ?? "");
    setConfirmedScope({
      objectType: job.objectType,
      objectId: job.objectId,
      attachmentId: jobAttachmentId,
    });
    setTargetIndexed(job.status === "SUCCEEDED" || job.status === "WARNING");
    setTargetMetadata(null);
    setError(null);
    if (!force && alreadySelected && jobLogsCacheRef.current.has(job.jobId)) {
      setJobLogs(jobLogsCacheRef.current.get(job.jobId) ?? []);
      await Promise.all([
        loadChunks(job.objectType, job.objectId, 0),
        loadObjectMetadata(job.objectType, job.objectId),
      ]);
      return;
    }
    setLogsLoading(true);
    try {
      const logsPromise = !force && jobLogsCacheRef.current.has(job.jobId)
        ? Promise.resolve(jobLogsCacheRef.current.get(job.jobId) ?? [])
        : reactAiApi.getRagJobLogs(job.jobId);
      const [logs] = await Promise.all([
        logsPromise,
        loadChunks(job.objectType, job.objectId, 0, force),
        loadObjectMetadata(job.objectType, job.objectId, force),
      ]);
      jobLogsCacheRef.current.set(job.jobId, logs ?? []);
      setJobLogs(logs ?? []);
    } catch (selectError) {
      setError(resolveAxiosError(selectError));
    } finally {
      setLogsLoading(false);
    }
  }

  async function handleCreateJob() {
    const scope = confirmedScope;
    setError(null);

    if (!scope?.objectType || !scope.objectId) {
      setError("먼저 색인 대상을 상태 확인으로 확정하세요.");
      return;
    }
    if (!scope.attachmentId && !indexText.trim()) {
      setError("직접 색인 텍스트를 입력하거나 attachmentId를 입력해야 job을 생성할 수 있습니다.");
      return;
    }

    try {
      const job = await reactAiApi.createRagJob({
        objectType: scope.objectType,
        objectId: scope.objectId,
        documentId: documentId.trim() || undefined,
        sourceType: scope.attachmentId && !indexText.trim() ? "attachment" : undefined,
        forceReindex,
        text: indexText.trim() || undefined,
        useLlmKeywordExtraction: true,
        ...indexChunkingOptions(),
      });
      setSelectedJob(job);
      await loadJobs();
      clearObjectInspectionCache(job.objectType, job.objectId);
      jobLogsCacheRef.current.delete(job.jobId);
      await handleSelectJob(job, true);
    } catch (createError) {
      setError(resolveAxiosError(createError));
    }
  }

  async function handleRetryJob() {
    if (!selectedJob) {
      return;
    }
    setError(null);
    try {
      const job = await reactAiApi.retryRagJob(selectedJob.jobId);
      await loadJobs();
      clearObjectInspectionCache(job.objectType, job.objectId);
      jobLogsCacheRef.current.delete(job.jobId);
      await handleSelectJob(job, true);
    } catch (retryError) {
      setError(resolveAxiosError(retryError));
    }
  }

  async function handleCancelJob() {
    if (!selectedJob) {
      return;
    }
    setError(null);
    try {
      const job = await reactAiApi.cancelRagJob(selectedJob.jobId);
      await loadJobs();
      jobLogsCacheRef.current.delete(job.jobId);
      await handleSelectJob(job, true);
    } catch (cancelError) {
      setError(resolveAxiosError(cancelError));
    }
  }

  async function handleCheckTarget() {
    const numericAttachmentId = Number(attachmentId);
    const scopedObjectType = resolveObjectTypeValue(objectType);
    const scopedObjectId = objectId.trim();
    setError(null);
    setTargetIndexed(null);
    setTargetMetadata(null);

    if (
      !attachmentId.trim()
      && (!scopedObjectType || !scopedObjectId)
    ) {
      setError("attachmentId 또는 objectType/objectId를 입력한 뒤 상태를 확인하세요.");
      return;
    }

    try {
      if (attachmentId.trim()) {
        if (!Number.isFinite(numericAttachmentId) || numericAttachmentId <= 0) {
          setError("attachmentId는 1 이상의 숫자여야 합니다.");
          return;
        }
        const attachment = await reactFilesApi.getById(numericAttachmentId);
        const nextScope = {
          objectType: scopedObjectType || String(attachment.objectType),
          objectId: scopedObjectId || String(attachment.objectId),
          attachmentId: String(numericAttachmentId),
        };
        const indexed = await reactFilesApi.hasEmbedding(numericAttachmentId);
        setTargetIndexed(indexed);
        setObjectType(nextScope.objectType);
        setObjectId(nextScope.objectId);
        setDocumentId((current) => current || String(numericAttachmentId));
        setConfirmedScope(nextScope);
        setTargetMetadata(indexed ? await reactFilesApi.ragMetadata(numericAttachmentId) : null);
        await loadChunks(nextScope.objectType, nextScope.objectId, 0);
      } else {
        const nextScope = {
          objectType: scopedObjectType,
          objectId: scopedObjectId,
        };
        setConfirmedScope(nextScope);
        await Promise.all([
          loadObjectMetadata(nextScope.objectType, nextScope.objectId),
          loadChunks(nextScope.objectType, nextScope.objectId, 0),
        ]);
      }
      markValidated();
    } catch (checkError) {
      setError(resolveAxiosError(checkError));
    }
  }

  async function handleIndexAttachment() {
    setError(null);

    if (!confirmedScope?.attachmentId) {
      setError("먼저 attachmentId를 상태 확인으로 확정하세요.");
      return;
    }

    try {
      const job = await reactAiApi.createRagJob({
        objectType: confirmedScope.objectType,
        objectId: confirmedScope.objectId,
        documentId: documentId.trim() || confirmedScope.attachmentId,
        sourceType: "attachment",
        forceReindex,
        metadata: {
          attachmentId: confirmedScope.attachmentId,
        },
        useLlmKeywordExtraction: true,
        ...indexChunkingOptions(),
      });
      setSelectedJob(job);
      await loadJobs();
      clearObjectInspectionCache(job.objectType, job.objectId);
      jobLogsCacheRef.current.delete(job.jobId);
      await handleSelectJob(job, true);
    } catch (indexError) {
      setError(resolveAxiosError(indexError));
    }
  }

  async function handleForceReindexTarget() {
    setError(null);

    const attachmentIdForIndexing = resolveAttachmentIdForIndexing();
    if (!confirmedScope || !attachmentIdForIndexing) {
      setError("강제 재색인은 attachmentId가 확정된 대상에서만 실행할 수 있습니다.");
      return;
    }

    try {
      const job = await reactAiApi.createRagJob({
        objectType: resolveObjectTypeValue(confirmedScope.objectType),
        objectId: confirmedScope.objectId,
        documentId: documentId.trim() || attachmentIdForIndexing,
        sourceType: "attachment",
        forceReindex: true,
        metadata: {
          attachmentId: attachmentIdForIndexing,
        },
        useLlmKeywordExtraction: true,
        ...indexChunkingOptions(),
      });
      setSelectedJob(job);
      await loadJobs();
      clearObjectInspectionCache(job.objectType, job.objectId);
      jobLogsCacheRef.current.delete(job.jobId);
      await handleSelectJob(job, true);
    } catch (indexError) {
      setError(resolveAxiosError(indexError));
    }
  }

  async function handleVectorSearch(usingExpandedQuery = false) {
    const searchQuery = (usingExpandedQuery ? expandedQuery : query).trim();
    const scope = resolveScope();
    setError(null);

    if (!searchQuery) {
      return [];
    }

    setVectorSearched(true);
    setVectorRows([]);
    setSelectedVectorResult(null);
    setVectorLoading(true);
    try {
      const data = await reactAiApi.searchVector({
        query: searchQuery,
        topK: Number(topK) || 5,
        hybrid: true,
        minScore: minScore.trim() ? Number(minScore) : undefined,
        objectType: scope.objectType,
        objectId: scope.objectId,
      });
      setVectorRows(data);
      setSelectedVectorResult(data[0] ?? null);
      markValidated();
      return data;
    } catch (searchError) {
      setError(resolveAxiosError(searchError));
      return [];
    } finally {
      setVectorLoading(false);
    }
  }

  async function handleRagSearch(usingExpandedQuery = false) {
    const scope = resolveScope();
    const searchQuery = (usingExpandedQuery ? expandedQuery : query).trim();
    setError(null);

    if (!searchQuery) {
      return [];
    }

    setRagSearched(true);
    setRagRows([]);
    setSelectedRagResult(null);
    setChatMessages([]);
    setLastMetadata(null);
    setRagDiagnostics(null);
    setLastRagSearchQuery("");
    setRagLoading(true);
    try {
      const data = await reactAiApi.searchRag({
        query: searchQuery,
        topK: Number(topK) || 5,
        objectType: scope.objectType,
        objectId: scope.objectId,
      });
      setRagRows(data);
      setLastRagSearchQuery(searchQuery);
      setSelectedRagResult(data[0] ?? null);
      setChatMessages([]);
      setLastMetadata(null);
      setRagDiagnostics(null);
      markValidated();
      return data;
    } catch (searchError) {
      setError(resolveAxiosError(searchError));
      return [];
    } finally {
      setRagLoading(false);
    }
  }

  function handleDefaultSearch(usingExpandedQuery = false) {
    setTab("vector");
    void handleVectorSearch(usingExpandedQuery);
  }

  async function handleValidationTabChange(value: ValidationTab) {
    setTab(value);
    if (!query.trim()) {
      return;
    }
    if (value === "rag" && ragRows.length === 0) {
      await handleRagSearch(false);
    }
    if (value === "vector" && vectorRows.length === 0) {
      await handleVectorSearch(false);
    }
    if (value === "chat" && ragRows.length > 0 && chatMessages.length === 0) {
      await handleRagChat();
      return;
    }
    if (value === "chat" && ragRows.length === 0) {
      const rows = await handleRagSearch(false);
      if (rows.length > 0) {
        await handleRagChat(rows);
      }
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

  async function handleRagChat(contextRows = ragRows) {
    if (chatLoading) {
      return;
    }

    const trimmed = chatInput.trim() || lastRagSearchQuery.trim() || query.trim();
    if (!trimmed) {
      return;
    }
    if (contextRows.length === 0) {
      setError("먼저 RAG 결과를 조회한 뒤 답변을 생성하세요.");
      return;
    }

    const scope = resolveScope();
    const ragTopK = Number(topK) || 5;
    const visibleRagContext = buildVisibleRagContext(contextRows, ragTopK);
    const nextMessages: ChatMessageDto[] = [
      { role: "user", content: trimmed },
    ];

    setLastMetadata(null);
    setChatMessages(nextMessages);
    setChatInput("");
    setRagDiagnostics(null);
    setError(null);

    setChatLoading(true);
    try {
      const response = await reactAiApi.sendRagChat({
        chat: {
          provider: provider || undefined,
          model: model || undefined,
          systemPrompt:
            [
              "제공된 RAG 문서 내용에 근거해서만 답변하세요. 문서에서 확인할 수 없는 내용은 확인할 수 없다고 답변하세요.",
              visibleRagContext
                ? `아래는 현재 화면의 RAG 결과 탭에 표시된 후보 문맥입니다. 이 문맥을 우선 근거로 사용하세요.\n${visibleRagContext}`
                : "",
            ].filter(Boolean).join("\n\n"),
          messages: nextMessages,
        },
        ragQuery: lastRagSearchQuery.trim() || trimmed,
        ragTopK,
        objectType: scope.objectType,
        objectId: scope.objectId,
        debug,
      });

      const assistant = [...response.messages]
        .reverse()
        .find((message) => message.role === "assistant");

      if (assistant) {
        setChatMessages((current) => [...current, assistant]);
      }
      setLastMetadata(response.metadata ?? null);
      setRagDiagnostics(extractRagDiagnostics(response.metadata));
      markValidated();
    } catch (chatError) {
      setError(resolveAxiosError(chatError));
    } finally {
      setChatLoading(false);
    }
  }

  function handleOpenChunkPreview() {
    setChunkPreviewOpen(true);
    setChunkPreviewError(null);
    setChunkPreviewRows([]);
    setSelectedPreviewChunk(null);
    setChunkPreviewSummary(null);
    if (!chunkPreviewText.trim() && indexText.trim()) {
      setChunkPreviewText(indexText);
    }
  }

  function optionalNumber(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const numberValue = Number(trimmed);
    return Number.isFinite(numberValue) ? numberValue : undefined;
  }

  function indexChunkingOptions() {
    const strategy = indexChunkingStrategy.trim();
    const usesSizing = chunkStrategyUsesSizing(strategy);
    return {
      chunkingStrategy: strategy || undefined,
      chunkMaxSize: usesSizing ? optionalNumber(indexChunkMaxSize) : undefined,
      chunkOverlap: usesSizing ? optionalNumber(indexChunkOverlap) : undefined,
      chunkUnit: indexChunkUnit.trim() || undefined,
    };
  }

  async function handlePreviewChunks() {
    const text = chunkPreviewText.trim();
    if (!text) {
      setChunkPreviewError("미리보기할 텍스트를 입력하세요.");
      return;
    }

    setChunkPreviewLoading(true);
    setChunkPreviewError(null);
    try {
      const response = await reactAiApi.previewRagChunks({
        text,
        documentId: documentId.trim() || undefined,
        objectType: confirmedScope?.objectType ?? (objectType.trim() || undefined),
        objectId: confirmedScope?.objectId ?? (objectId.trim() || undefined),
        strategy: chunkPreviewStrategy || undefined,
        maxSize: chunkPreviewUsesSizing ? optionalNumber(chunkPreviewMaxSize) : undefined,
        overlap: chunkPreviewUsesSizing ? optionalNumber(chunkPreviewOverlap) : undefined,
      });
      setChunkPreviewRows(response.chunks ?? []);
      setSelectedPreviewChunk(response.chunks?.[0] ?? null);
      setChunkPreviewSummary({
        totalChunks: response.totalChunks,
        totalChars: response.totalChars,
        strategy: response.strategy,
        maxSize: response.maxSize,
        overlap: response.overlap,
        unit: response.unit,
        warnings: response.warnings ?? [],
      });
    } catch (previewError) {
      setChunkPreviewError(resolveAxiosError(previewError));
    } finally {
      setChunkPreviewLoading(false);
    }
  }

  function handleStartNewIndexJob() {
    resetConfirmedScope();
    window.requestAnimationFrame(() => {
      targetSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  return (
    <Stack spacing={1.5}>
      <PageToolbar
        breadcrumbs={["서비스 관리", "AI", "RAG"]}
        label="색인 작업을 선택해 Chunk, 로그, 검색 결과와 답변을 검증합니다."
        onRefresh={() => void handleRefresh()}
        actions={
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Tooltip title="attachment 또는 텍스트 기준으로 새 RAG 색인 작업을 생성합니다.">
              <Button size="small" variant="contained" onClick={handleStartNewIndexJob}>
                새 색인 작업
              </Button>
            </Tooltip>
            <Tooltip title="현재 청킹 설정과 텍스트 Chunk 결과를 색인 없이 미리 확인합니다.">
              <Button size="small" variant="outlined" onClick={handleOpenChunkPreview}>
                청킹 시뮬레이션
              </Button>
            </Tooltip>
          </Stack>
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack spacing={1.5} sx={{ width: "100%" }}>
      <Box
        ref={statusSectionRef}
        sx={{
          scrollMarginTop: 56,
        }}
      >
        <Card sx={{ border: 0, boxShadow: "none", bgcolor: "transparent" }}>
          <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
            <Stack spacing={1.5}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
                  gap: 1,
                }}
              >
                <SummaryStatusCard
                  title="임베딩 모델"
                  value={currentProvider?.embedding.model ?? "Embedding 없음"}
                />
                <SummaryStatusCard
                  title="벡터 저장소"
                  value={vectorReady ? aiInfo?.vector.implementation ?? "사용 가능" : "확인 필요"}
                />
                <SummaryStatusCard
                  title="채팅 모델"
                  value={model || "모델 정보 없음"}
                />
                <SummaryStatusCard
                  title="청킹 모델"
                  value={
                    chunkConfig
                      ? `${chunkConfig.chunking.strategy} · size ${chunkConfig.chunking.maxSize} / overlap ${chunkConfig.chunking.overlap}`
                      : "청킹 정보 없음"
                  }
                />
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Stack spacing={1.5}>
        <Card variant="outlined" ref={targetSectionRef} sx={{ scrollMarginTop: 56, borderRadius: 2, order: 2 }}>
          <CardContent>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} alignItems="center">
                <StorageOutlined fontSize="small" color="primary" />
                <Typography variant="subtitle2">새 색인 작업</Typography>
              </Stack>
              <Stepper
                activeStep={workflowActiveStep}
                sx={{
                  opacity: hasConfirmedScope ? 1 : 0.55,
                  "& .MuiStepLabel-label": { typography: "caption" },
                }}
              >
                <Step completed={hasConfirmedScope}>
                  <StepLabel>대상 확정</StepLabel>
                </Step>
                <Step completed={Boolean(selectedJobSucceeded)}>
                  <StepLabel>색인 실행</StepLabel>
                </Step>
                <Step completed={Boolean(selectedJobSucceeded && hasJobInspection)}>
                  <StepLabel>작업 확인</StepLabel>
                </Step>
                <Step completed={Boolean(selectedJobSucceeded && hasSearchResult)}>
                  <StepLabel>검색 검증</StepLabel>
                </Step>
              </Stepper>
              <Alert
                severity={selectedJobFailed ? "error" : hasConfirmedScope ? "success" : "info"}
                action={
                  hasConfirmedScope ? (
                    <Button color="inherit" size="small" onClick={resetConfirmedScope}>
                      대상 변경
                    </Button>
                  ) : undefined
                }
              >
                {selectedJobFailed && confirmedScope
                  ? `선택한 job이 실패했습니다. 대상: ${formatObjectTypeLabel(confirmedScope.objectType)} / ${confirmedScope.objectId}`
                  : confirmedScope
                    ? `확정된 대상: ${formatObjectTypeLabel(confirmedScope.objectType)} / ${confirmedScope.objectId}${
                        lastValidatedAt ? ` · 확인 ${lastValidatedAt}` : ""
                      }`
                  : "먼저 attachmentId 또는 objectType/objectId를 입력하고 상태 확인으로 색인 대상을 확정하세요. 대상이 확정되기 전에는 색인 실행과 Chunk 조회가 비활성화됩니다."}
              </Alert>
              {!confirmedScope ? (
                <>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                    <TextField
                      label="attachmentId"
                      value={attachmentId}
                      onChange={(event) => {
                        setAttachmentId(event.target.value);
                        resetConfirmedScope();
                      }}
                      placeholder="예: 123"
                      fullWidth
                      size="small"
                    />
                    <Autocomplete<ObjectTypeOption, false, false, true>
                      freeSolo
                      size="small"
                      fullWidth
                      options={objectTypeOptions}
                      value={selectedObjectTypeOption ?? objectType}
                      inputValue={selectedObjectTypeOption?.label ?? objectType}
                      onInputChange={(_, value, reason) => {
                        if (reason === "input") {
                          setObjectType(resolveObjectTypeValue(value));
                          resetConfirmedScope();
                        }
                        if (reason === "clear") {
                          setObjectType("");
                          resetConfirmedScope();
                        }
                      }}
                      onChange={(_, value) => {
                        if (typeof value === "string") {
                          setObjectType(resolveObjectTypeValue(value));
                          resetConfirmedScope();
                          return;
                        }
                        setObjectType(value?.value ?? "");
                        resetConfirmedScope();
                      }}
                      getOptionLabel={(option) => (typeof option === "string" ? option : option.label)}
                      isOptionEqualToValue={(option, value) =>
                        typeof value !== "string" && option.value === value.value
                      }
                      renderOption={(props, option) => (
                        <Box component="li" {...props} key={option.value}>
                          <Stack spacing={0}>
                            <Typography variant="body2">{option.label}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {option.name}
                            </Typography>
                          </Stack>
                        </Box>
                      )}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="objectType"
                          placeholder="정책 오브젝트 타입 선택 또는 attachment 직접 입력"
                          helperText="정책 > 오브젝트 타입의 ACTIVE 항목을 선택할 수 있습니다."
                        />
                      )}
                    />
                    <TextField
                      label="objectId"
                      value={objectId}
                      onChange={(event) => {
                        setObjectId(event.target.value);
                        resetConfirmedScope();
                      }}
                      placeholder="예: 123"
                      fullWidth
                      size="small"
                    />
                    <TextField
                      label="documentId"
                      value={documentId}
                      onChange={(event) => setDocumentId(event.target.value)}
                      placeholder="예: doc-123"
                      fullWidth
                      size="small"
                    />
                  </Stack>
                </>
              ) : null}
              {confirmedScope && !selectedJob ? (
                <TextField
                  label="직접 색인 텍스트"
                  value={indexText}
                  onChange={(event) => setIndexText(event.target.value)}
                  placeholder="attachment source 대신 직접 텍스트를 색인할 때 입력합니다."
                  multiline
                  minRows={3}
                  size="small"
                />
              ) : null}
              {confirmedScope ? (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
                    gap: 1,
                  }}
                >
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Object Type
                    </Typography>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {formatObjectTypeLabel(confirmedScope.objectType)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Object ID
                    </Typography>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {confirmedScope.objectId}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Document
                    </Typography>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {documentId || "-"}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      선택 작업
                    </Typography>
                    {selectedJob ? (
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Chip size="small" color={statusColor(selectedJob.status)} label={selectedJob.status} />
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {selectedJob.currentStep ?? "-"}
                        </Typography>
                      </Stack>
                    ) : (
                      <Typography variant="body2" fontWeight={600}>
                        -
                      </Typography>
                    )}
                  </Box>
                </Box>
              ) : null}
              <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 1.25 }}>
                {!confirmedScope ? (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2">현재 단계: 대상 확정</Typography>
                      <Typography variant="caption" color="text.secondary">
                        입력한 attachmentId 또는 objectType/objectId의 색인 상태를 확인해 작업 대상을 확정합니다.
                      </Typography>
                    </Box>
                    <Tooltip
                      title={
                        canCheckTarget
                          ? "입력한 attachmentId 또는 objectType/objectId의 색인 상태와 metadata를 조회하고 작업 대상을 확정합니다."
                          : "attachmentId 또는 objectType/objectId를 입력하면 활성화됩니다."
                      }
                    >
                      <span>
                        <Button
                          variant="contained"
                          size="small"
                          disabled={!canCheckTarget}
                          onClick={() => void handleCheckTarget()}
                        >
                          상태 확인
                        </Button>
                      </span>
                    </Tooltip>
                  </Stack>
                ) : null}

                {confirmedScope && !selectedJob ? (
                  <Stack spacing={1}>
                    <Box>
                      <Typography variant="subtitle2">현재 단계: 색인 실행</Typography>
                      <Typography variant="caption" color="text.secondary">
                        확정된 대상에 대해 attachment source 또는 직접 입력 텍스트 기반 색인 Job을 생성합니다.
                      </Typography>
                    </Box>
                    <Accordion variant="outlined" sx={{ borderRadius: 1.5, "&:before": { display: "none" } }}>
                      <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                        <Stack spacing={0.25}>
                          <Typography variant="body2">운영 색인 청킹 옵션</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Job 생성 시 실제 색인 파이프라인에 전달되는 Chunking 옵션입니다.
                          </Typography>
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Stack spacing={1.25}>
                          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                            <TextField
                              select
                              label="청킹 전략"
                              value={indexChunkingStrategy}
                              onChange={(event) => setIndexChunkingStrategy(event.target.value)}
                              size="small"
                              fullWidth
                              helperText={chunkStrategyHint(indexChunkingStrategy)}
                            >
                              {(chunkConfig?.chunking.availableStrategies ?? ["fixed-size", "recursive", "structure-based"]).map(
                                (strategy) => (
                                  <MenuItem key={strategy} value={strategy}>
                                    {strategy}
                                  </MenuItem>
                                )
                              )}
                            </TextField>
                            <TextField
                              label="Chunk 크기"
                              value={indexChunkMaxSize}
                              onChange={(event) => setIndexChunkMaxSize(event.target.value)}
                              size="small"
                              fullWidth
                              disabled={!indexChunkingUsesSizing}
                              helperText={
                                indexChunkingUsesSizing
                                  ? "색인 Chunk 하나의 최대 길이입니다."
                                  : "선택한 전략에는 적용되지 않습니다."
                              }
                            />
                            <TextField
                              label="겹침"
                              value={indexChunkOverlap}
                              onChange={(event) => setIndexChunkOverlap(event.target.value)}
                              size="small"
                              fullWidth
                              disabled={!indexChunkingUsesSizing}
                              helperText={
                                indexChunkingUsesSizing
                                  ? "앞뒤 Chunk 사이에 다시 포함할 중복 길이입니다."
                                  : "선택한 전략에는 적용되지 않습니다."
                              }
                            />
                            <TextField
                              select
                              label="단위"
                              value={indexChunkUnit}
                              onChange={(event) => setIndexChunkUnit(event.target.value)}
                              size="small"
                              fullWidth
                              helperText="크기와 겹침 값을 해석하는 단위입니다."
                            >
                              <MenuItem value="character">문자</MenuItem>
                              <MenuItem value="token">토큰</MenuItem>
                            </TextField>
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            값을 비우면 서버 기본 설정을 사용합니다. 현재 서버 기본값:{" "}
                            {chunkConfig
                              ? `${chunkConfig.chunking.strategy}, size ${chunkConfig.chunking.maxSize}, overlap ${chunkConfig.chunking.overlap}`
                              : "-"}
                          </Typography>
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                      {canIndexAttachment ? (
                        <Tooltip title="확정된 attachmentId 기준으로 파일을 읽고 RAG 색인 작업을 생성합니다.">
                          <span>
                            <Button
                              variant="contained"
                              size="small"
                              onClick={() => void handleIndexAttachment()}
                            >
                              Attachment 색인
                            </Button>
                          </span>
                        </Tooltip>
                      ) : (
                        <Tooltip title={canCreateTextJob ? "입력한 텍스트를 기준으로 RAG 색인 Job을 생성합니다." : "직접 색인 텍스트를 입력해야 합니다."}>
                          <span>
                            <Button
                              variant="contained"
                              size="small"
                              startIcon={<PlayArrowOutlined />}
                              disabled={!canCreateTextJob}
                              onClick={() => void handleCreateJob()}
                            >
                              텍스트 색인
                            </Button>
                          </span>
                        </Tooltip>
                      )}
                      <Tooltip title={forceReindex ? "기존 색인이 있어도 다시 색인합니다." : "서버 정책에 따라 중복 색인을 피합니다."}>
                        <FormControlLabel
                          sx={{ ml: 0, mr: 0 }}
                          control={
                            <Switch
                              size="small"
                              checked={forceReindex}
                              onChange={(event) => setForceReindex(event.target.checked)}
                            />
                          }
                          label={
                            <Typography variant="body2" color="text.secondary">
                              강제 재색인
                            </Typography>
                          }
                        />
                      </Tooltip>
                    </Stack>
                  </Stack>
                ) : null}

                {selectedJob && selectedJobFailed ? (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" color="error.main">
                        현재 단계: 색인 실패
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        선택한 job은 완료되지 않았습니다. 로그의 오류를 확인한 뒤 기존 job을 재시도하거나 확정된 attachment 대상을 강제 재색인하세요.
                      </Typography>
                    </Box>
                    <Tooltip title="선택한 실패/중단 job을 서버 retry 엔드포인트로 다시 실행합니다.">
                      <span>
                        <Button size="small" variant="outlined" onClick={() => void handleRetryJob()}>
                          선택 job 재시도
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip
                      title={
                        canForceReindexTarget
                          ? "확정된 attachment 대상의 색인을 force=true로 새 job을 생성해 다시 만듭니다."
                          : "attachmentId가 확정된 대상에서 사용할 수 있습니다."
                      }
                    >
                      <span>
                        <Button
                          size="small"
                          variant="contained"
                          color="warning"
                          disabled={!canForceReindexTarget}
                          onClick={() => void handleForceReindexTarget()}
                        >
                          강제 재색인
                        </Button>
                      </span>
                    </Tooltip>
                  </Stack>
                ) : null}

                {selectedJob && !selectedJobFailed && !hasJobInspection ? (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2">현재 단계: 작업 확인</Typography>
                      <Typography variant="caption" color="text.secondary">
                        생성 또는 선택한 작업의 로그와 Chunk 조각을 조회합니다.
                      </Typography>
                    </Box>
                    <Tooltip title="선택한 작업 대상의 생성 Chunk 조각을 조회합니다.">
                      <span>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => void loadChunks(confirmedScope?.objectType, confirmedScope?.objectId, 0, true)}
                        >
                          Chunk 조회
                        </Button>
                      </span>
                    </Tooltip>
                  </Stack>
                ) : null}

                {selectedJobSucceeded && hasJobInspection ? (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2">현재 단계: 검색 검증</Typography>
                      <Typography variant="caption" color="text.secondary">
                        아래 `Chunk / 검색 검증` 영역에서 Vector 결과와 RAG 결과를 확인합니다.
                      </Typography>
                    </Box>
                    <Tooltip title="Vector 결과 탭으로 이동합니다.">
                      <Button size="small" variant="outlined" onClick={() => activateValidationTab("vector")}>
                        Vector 결과
                      </Button>
                    </Tooltip>
                    <Tooltip title="RAG 결과 탭으로 이동합니다.">
                      <Button size="small" variant="outlined" onClick={() => activateValidationTab("rag")}>
                        RAG 결과
                      </Button>
                    </Tooltip>
                    <Tooltip title={ragRows.length > 0 ? "답변 생성 탭으로 이동합니다." : "먼저 RAG 결과를 조회하세요."}>
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={ragRows.length === 0}
                          onClick={() => activateValidationTab("chat")}
                        >
                          답변 생성
                        </Button>
                      </span>
                    </Tooltip>
                  </Stack>
                ) : null}
              </Box>
              {targetIndexed != null ? (
                <Box>
                  <Chip
                    size="small"
                    color={selectedJobFailed ? "error" : targetIndexed ? "success" : "warning"}
                    label={selectedJobFailed ? "선택 job 실패" : targetIndexed ? "색인됨" : "색인 없음"}
                  />
                </Box>
              ) : null}
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1,
                  bgcolor: "action.hover",
                  borderRadius: 2,
                  minHeight: 120,
                  maxHeight: 180,
                  overflow: "auto",
                  fontSize: 12,
                }}
              >
                {targetMetadata ? JSON.stringify(targetMetadata, null, 2) : "metadata 조회 결과가 여기에 표시됩니다."}
              </Box>
            </Stack>
          </CardContent>
        </Card>

        <Box ref={jobsSectionRef} sx={{ flex: 1, scrollMarginTop: 56, order: 1 }}>
          <Stack spacing={1.25}>
              <Typography variant="caption" color="text.secondary">
                먼저 색인 작업을 선택합니다. 현재 {visibleJobCount.toLocaleString()}건
                {jobsTotal ? ` / 전체 ${jobsTotal.toLocaleString()}건` : ""}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="caption" color="text.secondary">
                  상태
                </Typography>
                <Select
                  value={jobStatusFilter}
                  onChange={(event) => setJobStatusFilter(event.target.value as RagJobStatusFilter)}
                  size="small"
                  displayEmpty
                  renderValue={(selected) => (selected ? String(selected) : "전체")}
                  sx={{
                    minWidth: 120,
                    height: 32,
                    "& .MuiSelect-select": {
                      py: 0.5,
                      fontSize: 13,
                    },
                  }}
                >
                  <MenuItem value="">전체</MenuItem>
                  {(["PENDING", "RUNNING", "SUCCEEDED", "WARNING", "FAILED", "CANCELLED"] as RagIndexJobStatus[]).map(
                    (status) => (
                      <MenuItem key={status} value={status}>
                        {status}
                      </MenuItem>
                    )
                  )}
                </Select>
                <Button variant="outlined" size="small" sx={{ height: 32 }} onClick={() => void loadJobs()}>
                  조회
                </Button>
                <Tooltip title="선택한 실패/중단 job을 서버 retry 엔드포인트로 다시 실행합니다. 기존 색인을 강제로 새로 만드는 기능은 아닙니다.">
                  <span>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<ReplayOutlined />}
                      disabled={!selectedJob || selectedJob.status === "PENDING" || selectedJob.status === "RUNNING"}
                      onClick={() => void handleRetryJob()}
                    >
                      선택 job 재시도
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip
                  title={
                    canForceReindexTarget
                      ? "확정된 attachment 대상의 색인을 force=true로 새 job을 생성해 다시 만듭니다."
                      : "attachmentId로 상태 확인을 완료한 대상에서 사용할 수 있습니다."
                  }
                >
                  <span>
                    <Button
                      variant="contained"
                      size="small"
                      color="warning"
                      startIcon={<ReplayOutlined />}
                      disabled={!canForceReindexTarget}
                      onClick={() => void handleForceReindexTarget()}
                    >
                      강제 재색인
                    </Button>
                  </span>
                </Tooltip>
                <Button
                  variant="outlined"
                  size="small"
                  color="warning"
                  disabled={!selectedJob || (selectedJob.status !== "PENDING" && selectedJob.status !== "RUNNING")}
                  onClick={() => void handleCancelJob()}
                >
                  취소
                </Button>
              </Stack>
              <Box
                sx={{
                  "& .ag-row.rag-job-row-selected": {
                    bgcolor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(66, 165, 245, 0.22)"
                        : "rgba(25, 118, 210, 0.12)",
                  },
                  "& .ag-row.rag-job-row-selected:hover": {
                    bgcolor: (theme) =>
                      theme.palette.mode === "dark"
                        ? "rgba(66, 165, 245, 0.28)"
                        : "rgba(25, 118, 210, 0.18)",
                  },
                  "& .ag-row.rag-job-row-selected::before": {
                    content: '""',
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    bgcolor: "primary.main",
                    zIndex: 1,
                  },
                  "& .ag-row.rag-job-row-selected .ag-cell": {
                    fontWeight: 600,
                  },
                }}
              >
                <GridContent<RagIndexJobDto>
                  columns={jobColumnDefs}
                  options={jobGridOptions}
                  rowData={jobs}
                  loading={jobsLoading}
                  height={300}
                  events={[
                    {
                      type: "rowClicked",
                      listener: (event) => {
                        const row = (event as { data?: RagIndexJobDto }).data;
                        if (!row) {
                          return;
                        }
                        toggleSelectedJob(row);
                      },
                    },
                  ]}
                />
              </Box>
              {selectedJob ? (
                <Alert severity="info" icon={false}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={0.75} alignItems={{ sm: "center" }}>
                    <Chip size="small" color="primary" label="선택됨" />
                    <Typography variant="caption" color="text.secondary">
                      {selectedJob.jobId} / {selectedJob.status} / {selectedJob.currentStep ?? "-"} /{" "}
                      {formatObjectTypeLabel(selectedJob.objectType)} / {selectedJob.objectId}
                    </Typography>
                  </Stack>
                </Alert>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  작업 row를 선택하면 실행 로그와 생성된 Chunk 조각을 확인할 수 있습니다.
                </Typography>
              )}
              {selectedJob ? (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(6, 1fr)" },
                    gap: 1,
                    p: 1.25,
                    borderRadius: 2,
                    bgcolor: "action.hover",
                  }}
                >
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      상태
                    </Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Chip size="small" color={statusColor(selectedJob.status)} label={selectedJob.status} />
                    </Stack>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      단계
                    </Typography>
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {selectedJob.currentStep ?? "-"}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      객체
                    </Typography>
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {formatObjectTypeLabel(selectedJob.objectType)} / {selectedJob.objectId}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      소스
                    </Typography>
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {selectedJob.sourceType ?? "-"}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Chunk
                    </Typography>
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {selectedJob.chunkCount?.toLocaleString?.() ?? selectedJob.chunkCount ?? "-"}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      소요
                    </Typography>
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {typeof selectedJob.durationMs === "number" ? `${selectedJob.durationMs.toLocaleString()}ms` : "-"}
                    </Typography>
                  </Box>
                </Box>
              ) : null}
              {selectedJob?.errorMessage ? (
                <Alert severity="error">
                  <Typography variant="caption" color="inherit" display="block" sx={{ mb: 0.5 }}>
                    선택한 작업 오류
                  </Typography>
                  <Typography variant="body2" color="inherit" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                    {selectedJob.errorMessage}
                  </Typography>
                </Alert>
              ) : null}
          </Stack>
        </Box>
      </Stack>

      <Card variant="outlined" ref={validationSectionRef} sx={{ scrollMarginTop: 56, borderRadius: 2 }}>
        <CardContent>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <HubOutlined fontSize="small" color="primary" />
              <Typography variant="subtitle2">Chunk / 검색 검증</Typography>
            </Stack>
            <Alert severity="info">
              <Typography variant="caption" color="text.secondary">
                현재 범위: {confirmedScope ? `${formatObjectTypeLabel(confirmedScope.objectType)} / ${confirmedScope.objectId}` : "전체 색인 대상"}
                {" · "}Vector 결과는 유사 Chunk를 확인하고, RAG 결과는 답변 후보 문맥을 확인합니다.
                {!confirmedScope
                  ? " 전체 색인 대상에서는 검색어와 직접 관련이 낮은 문서도 함께 보일 수 있으므로, 파일 단위 검증은 먼저 색인 대상을 확정하세요."
                  : null}
              </Typography>
            </Alert>
            <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} alignItems={{ lg: "flex-start" }}>
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
              <TextField
                label="Model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                fullWidth
                size="small"
              />
              <Tooltip title="검색 결과로 가져올 최대 Chunk 개수입니다. 값이 클수록 후보 문맥은 많아지지만 노이즈와 비용도 늘 수 있습니다.">
                <TextField
                  label="topK"
                  value={topK}
                  onChange={(event) => setTopK(event.target.value)}
                  sx={{ minWidth: 140 }}
                  size="small"
                  helperText="가져올 후보 수"
                />
              </Tooltip>
              <Tooltip
                title={
                  tab === "vector"
                    ? "이 유사도 점수보다 낮은 Vector 검색 결과를 제외합니다. 비워두면 서버 기본값을 사용합니다. 너무 높이면 결과가 없을 수 있습니다."
                    : "현재 서버 RAG 검색 API는 minScore를 받지 않습니다. RAG 결과는 topK와 선택된 색인 대상 기준으로 조회됩니다."
                }
              >
                <TextField
                  label="Vector minScore"
                  value={minScore}
                  onChange={(event) => setMinScore(event.target.value)}
                  sx={{ minWidth: 160 }}
                  size="small"
                  placeholder="예: 0.65"
                  helperText={tab === "vector" ? "최소 유사도" : "RAG 검색에는 미적용"}
                  disabled={tab !== "vector"}
                />
              </Tooltip>
              <Tooltip title="RAG 검색과 답변 생성 응답에 진단 metadata를 포함합니다.">
                <Box
                  sx={{
                    minWidth: 130,
                    height: 40,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <FormControlLabel
                    sx={{ ml: 0, mr: 0 }}
                    control={
                      <Switch
                        size="small"
                        checked={debug}
                        onChange={(event) => setDebug(event.target.checked)}
                      />
                    }
                    label={
                      <Typography variant="body2" color="text.secondary">
                        debug
                      </Typography>
                    }
                  />
                </Box>
              </Tooltip>
            </Stack>
            <Stack spacing={1}>
              <TextField
                value={query}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && query.trim()) {
                    handleDefaultSearch(false);
                  }
                }}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setVectorSearched(false);
                  setRagSearched(false);
                  setVectorRows([]);
                  setRagRows([]);
                  setSelectedVectorResult(null);
                  setSelectedRagResult(null);
                  setChatMessages([]);
                  setLastMetadata(null);
                  setRagDiagnostics(null);
                  setLastRagSearchQuery("");
                }}
                placeholder="검증 쿼리 입력"
                size="small"
                fullWidth
                inputProps={{ "aria-label": "검증 쿼리" }}
                slotProps={{
                  input: {
                    endAdornment: (
                      <Tooltip
                        title="입력한 쿼리 그대로 Vector 결과를 먼저 조회합니다. RAG 결과는 탭을 열 때 조회합니다."
                      >
                        <span>
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<SearchOutlined />}
                            onClick={() => handleDefaultSearch(false)}
                            disabled={!query.trim()}
                          >
                            검색
                          </Button>
                        </span>
                      </Tooltip>
                    ),
                  },
                }}
              />
              <Accordion variant="outlined" disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                  <Stack spacing={0.25}>
                    <Typography variant="body2" fontWeight={700}>
                      AI 검색어 개선
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      검색 결과가 부족하면 AI가 질문을 검색 친화적인 표현으로 바꾸고, 그 검색어로 다시 찾습니다.
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Tooltip title="AI가 입력한 질문을 검색에 더 잘 맞는 검색어와 키워드로 바꿉니다.">
                        <span>
                          <Button
                            variant="outlined"
                            startIcon={<SearchOutlined />}
                            onClick={() => void handleRewrite()}
                            disabled={!query.trim()}
                          >
                            AI가 검색어 다듬기
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip
                        title="AI가 다듬은 검색어로 Vector 결과를 먼저 조회합니다. RAG 결과는 탭을 열 때 조회합니다."
                      >
                        <span>
                          <Button
                            variant="outlined"
                            startIcon={<SearchOutlined />}
                            onClick={() => handleDefaultSearch(true)}
                            disabled={!expandedQuery.trim()}
                          >
                            개선된 검색어로 검색
                          </Button>
                        </span>
                      </Tooltip>
                    </Stack>
                    {expandedQuery || expandedKeywords.length > 0 ? (
                      <Stack direction="row" spacing={0.75} flexWrap="wrap">
                        {expandedQuery ? (
                          <Chip label={`다듬은 검색어: ${expandedQuery}`} size="small" variant="outlined" />
                        ) : null}
                        {expandedKeywords.map((keyword) => (
                          <Chip key={keyword} label={keyword} size="small" />
                        ))}
                      </Stack>
                    ) : null}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </Stack>
            <Tabs value={tab} onChange={(_, value: ValidationTab) => void handleValidationTabChange(value)}>
              <Tab
                value="vector"
                label={
                  <Badge color="primary" badgeContent={vectorRows.length} invisible={!vectorSearched}>
                    <Box component="span" sx={{ pr: 1.25 }}>
                      Vector 결과
                      <ChevronRightOutlined sx={{ ml: 0.5, fontSize: 16, verticalAlign: "middle" }} />
                    </Box>
                  </Badge>
                }
              />
              <Tab
                value="rag"
                label={
                  <Badge color="primary" badgeContent={ragRows.length} invisible={!ragSearched}>
                    <Box component="span" sx={{ pr: 1.25 }}>
                      RAG 결과
                      <ChevronRightOutlined sx={{ ml: 0.5, fontSize: 16, verticalAlign: "middle" }} />
                    </Box>
                  </Badge>
                }
              />
              <Tab value="chat" label="답변 생성" />
            </Tabs>

            {tab === "vector" ? (
              <Stack spacing={1}>
                <Alert severity="success" variant="outlined">
                  <Typography variant="body2">
                    Vector 검색은 입력 쿼리와 가장 가까운 Chunk를 점수순으로 보여줍니다.
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Vector store의 원시 유사도 결과입니다. 색인이 제대로 되었는지, 원하는 문서 조각이 검색되는지 확인할 때 사용합니다. 검색이 잘 안 되면 `AI 검색어 개선`으로 질문을 검색 친화적인 표현으로 바꾼 뒤 다시 찾을 수 있습니다.
                    {!confirmedScope
                      ? " 현재는 전체 색인에서 검색하므로 topK를 낮추거나 minScore를 높이면 노이즈를 줄일 수 있습니다."
                      : null}
                  </Typography>
                </Alert>
                <GridContent<VectorSearchResultDto>
                  columns={vectorColumnDefs}
                  rowData={vectorRows}
                  loading={vectorLoading}
                  height={360}
                  events={[
                    {
                      type: "rowClicked",
                      listener: (event) => {
                        const row = (event as { data?: VectorSearchResultDto }).data;
                        setSelectedVectorResult(row ?? null);
                      },
                    },
                  ]}
                />
                <SearchResultDetail
                  title={
                    selectedVectorResult
                      ? `선택한 Chunk 전체 내용 · ${selectedVectorResult.id}`
                      : "선택한 Chunk 전체 내용"
                  }
                  content={selectedVectorResult?.content}
                  metadata={selectedVectorResult?.metadata}
                />
              </Stack>
            ) : null}

            {tab === "rag" ? (
              <Stack spacing={1}>
                <Alert severity="success" variant="outlined">
                  <Typography variant="body2">
                    RAG 검색은 실제 답변 생성 전에 사용될 후보 문맥을 확인합니다.
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Vector 검색 결과를 RAG 검색 파이프라인 규칙으로 한 번 더 정리한 후보 문맥입니다. 필터, fallback, context expansion 설정에 따라 Vector 검색과 건수나 순서가 달라질 수 있습니다.
                    현재 서버 RAG 검색 API는 minScore를 받지 않으므로 topK와 선택된 색인 대상 기준으로 조회합니다.
                  </Typography>
                </Alert>
                <GridContent<SearchResultDto>
                  columns={ragColumnDefs}
                  rowData={ragRows}
                  loading={ragLoading}
                  height={360}
                  events={[
                    {
                      type: "rowClicked",
                      listener: (event) => {
                        const row = (event as { data?: SearchResultDto }).data;
                        setSelectedRagResult(row ?? null);
                      },
                    },
                  ]}
                />
                <SearchResultDetail
                  title={
                    selectedRagResult
                      ? `선택한 후보 문맥 전체 내용 · ${selectedRagResult.documentId}`
                      : "선택한 후보 문맥 전체 내용"
                  }
                  content={selectedRagResult?.content}
                  metadata={selectedRagResult?.metadata}
                />
              </Stack>
            ) : null}

            {tab === "chat" ? (
              <Stack spacing={1.5}>
                <Alert severity={ragRows.length > 0 ? "success" : "warning"} variant="outlined">
                  <Typography variant="body2">
                    RAG 결과에서 확인한 후보 문맥을 기준으로 최종 답변을 생성합니다.
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    이미 RAG 결과가 있으면 이 탭에서 바로 답변을 확인합니다. 질문을 비워두면 현재 검증 쿼리를 사용합니다.
                  </Typography>
                </Alert>
                {lastRagSearchQuery ? (
                  <Typography variant="caption" color="text.secondary">
                    답변 생성 기준 RAG 쿼리: {lastRagSearchQuery} / 후보 문맥 {ragRows.length.toLocaleString()}건
                  </Typography>
                ) : null}
                <Stack spacing={1}>
                  {chatMessages.filter((message) => message.role === "assistant").length === 0 ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      {chatLoading ? <CircularProgress size={18} /> : null}
                      <Typography variant="body2" color="text.secondary">
                        {chatLoading ? "문맥 기반 답변을 생성하고 있습니다." : "아직 생성된 답변이 없습니다."}
                      </Typography>
                    </Stack>
                  ) : (
                    chatMessages.filter((message) => message.role === "assistant").map((message, index) => (
                      <Box
                        key={`${message.role}-${index}`}
                        sx={{
                          alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                          maxWidth: "82%",
                          borderRadius: 2,
                          px: 1.25,
                          py: 1,
                          bgcolor: message.role === "user" ? "primary.main" : "action.hover",
                          color: message.role === "user" ? "primary.contrastText" : "text.primary",
                          whiteSpace: "pre-wrap",
                          fontSize: 13,
                        }}
                      >
                        {message.content}
                      </Box>
                    ))
                  )}
                  {chatLoading ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={18} />
                      <Typography variant="body2" color="text.secondary">
                        답변을 갱신하고 있습니다.
                      </Typography>
                    </Stack>
                  ) : null}
                </Stack>
                <TextField
                  label="답변 생성 질문"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder={query.trim() || "예: 이 파일의 핵심 내용을 요약해줘"}
                  helperText="RAG 결과 문맥을 바탕으로 답변할 질문입니다. 비워두면 RAG 결과를 만든 쿼리를 사용합니다."
                  multiline
                  minRows={3}
                  size="small"
                />
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    {lastMetadata
                      ? `${lastMetadata.provider ?? provider} / ${lastMetadata.resolvedModel ?? model} / ${formatTokenUsage(lastMetadata.tokenUsage)} / ${lastMetadata.latencyMs ?? "-"}ms`
                      : `RAG 후보 문맥 ${ragRows.length.toLocaleString()}건`}
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={chatLoading ? <CircularProgress color="inherit" size={16} /> : undefined}
                    onClick={() => void handleRagChat()}
                    disabled={chatLoading || ragRows.length === 0 || !(chatInput.trim() || query.trim())}
                  >
                    {chatLoading ? "생성 중" : "문맥 기반 답변 생성"}
                  </Button>
                </Stack>
              </Stack>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" ref={chunksSectionRef} sx={{ scrollMarginTop: 56, borderRadius: 2 }}>
        <CardContent>
          <Stack spacing={1.25}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={1} alignItems="center">
                <StorageOutlined fontSize="small" color="primary" />
                <Typography variant="subtitle2">Chunk</Typography>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Tooltip title={confirmedScope ? "확정된 대상의 생성 Chunk 조각을 조회합니다." : "먼저 상태 확인으로 색인 대상을 확정하세요."}>
                  <span>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={!confirmedScope}
                      onClick={() => void loadChunks(confirmedScope?.objectType, confirmedScope?.objectId, 0, true)}
                    >
                      Chunk 조회
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title="이전 Chunk 페이지를 조회합니다.">
                  <span>
                    <Button
                      size="small"
                      variant="text"
                      disabled={chunkPage.offset <= 0}
                      onClick={() =>
                        void loadChunks(
                          confirmedScope?.objectType,
                          confirmedScope?.objectId,
                          Math.max(0, chunkPage.offset - chunkPage.limit)
                        )
                      }
                    >
                      이전
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title="다음 Chunk 페이지를 조회합니다.">
                  <span>
                    <Button
                      size="small"
                      variant="text"
                      disabled={!chunkPage.hasMore}
                      onClick={() =>
                        void loadChunks(confirmedScope?.objectType, confirmedScope?.objectId, chunkPage.offset + chunkPage.limit)
                      }
                    >
                      다음
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>
            <Box
              sx={{
                "& .ag-row.rag-chunk-row-selected": {
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(66, 165, 245, 0.22)"
                      : "rgba(25, 118, 210, 0.12)",
                },
                "& .ag-row.rag-chunk-row-selected:hover": {
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark"
                      ? "rgba(66, 165, 245, 0.28)"
                      : "rgba(25, 118, 210, 0.18)",
                },
                "& .ag-row.rag-chunk-row-selected .ag-cell": {
                  fontWeight: 600,
                },
              }}
            >
              <GridContent<RagIndexChunkDto>
                columns={chunkColumnDefs}
                options={chunkGridOptions}
                rowData={chunks}
                loading={chunksLoading}
                height={280}
                events={[
                  {
                    type: "rowClicked",
                    listener: (event) => {
                      const row = (event as { data?: RagIndexChunkDto }).data;
                      const node = (event as {
                        node?: { setSelected: (selected: boolean, clearSelection?: boolean) => void };
                      }).node;
                      if (row) {
                        node?.setSelected(true, true);
                        setSelectedChunk(row);
                      }
                    },
                  },
                ]}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              offset {chunkPage.offset.toLocaleString()} / returned {chunks.length.toLocaleString()} / hasMore{" "}
              {chunkPage.hasMore ? "true" : "false"}
            </Typography>
            <SearchResultDetail
              title={
                selectedChunk
                  ? `선택한 Chunk 전체 내용 · #${selectedChunk.chunkOrder ?? "-"}`
                  : "선택한 Chunk 전체 내용"
              }
              content={selectedChunk?.content}
              metadata={selectedChunk?.metadata}
            />
            <Accordion variant="outlined" disableGutters sx={{ "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                <Stack spacing={0.25}>
                  <Typography variant="body2" fontWeight={700}>
                    실패·경고 로그
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    선택한 색인 job의 처리 로그입니다. 오류 원인 확인이 필요할 때 펼쳐서 확인합니다.
                  </Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <GridContent<RagIndexJobLogDto>
                  columns={logColumnDefs}
                  rowData={jobLogs}
                  loading={logsLoading}
                  height={220}
                />
              </AccordionDetails>
            </Accordion>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" ref={diagnosticsSectionRef} sx={{ scrollMarginTop: 56, borderRadius: 2 }}>
        <CardContent>
          <Stack spacing={1.25}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ArticleOutlined fontSize="small" color="primary" />
              <Typography variant="subtitle2">결과 / 진단</Typography>
            </Stack>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                gap: 1,
              }}
            >
              <StatusMetric label="RAG Diagnostics" value={ragDiagnostics ? "수신됨" : "없음"} />
              <StatusMetric label="Token Usage" value={formatTokenUsage(lastMetadata?.tokenUsage)} />
              <StatusMetric label="Latency" value={lastMetadata?.latencyMs ? `${lastMetadata.latencyMs}ms` : "-"} />
            </Box>
            <Divider />
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 1,
                bgcolor: "action.hover",
                borderRadius: 2,
                overflow: "auto",
                fontSize: 12,
                minHeight: 120,
                maxHeight: 260,
              }}
            >
              {ragDiagnostics
                ? JSON.stringify(ragDiagnostics, null, 2)
                : "RAG Chat debug=true 응답의 diagnostics가 여기에 표시됩니다."}
            </Box>
            {targetMetadata ? (
              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary">
                  Metadata preview
                </Typography>
                {Object.entries(targetMetadata).slice(0, 8).map(([key, value]) => (
                  <Stack key={key} direction="row" spacing={1}>
                    <Typography variant="caption" sx={{ width: 160, flexShrink: 0 }}>
                      {key}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                      {formatValue(value)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      </Stack>

      <Dialog open={chunkPreviewOpen} onClose={() => setChunkPreviewOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>청킹 시뮬레이션</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <Alert severity="info" icon={<InfoOutlined />}>
              입력 텍스트를 현재 ChunkingOrchestrator 설정으로 나누어 봅니다. 이 작업은 embedding, vector 저장,
              색인 Job 생성을 수행하지 않습니다.
            </Alert>
            {chunkPreviewError ? <Alert severity="error">{chunkPreviewError}</Alert> : null}
            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
              <TextField
                select
                label="청킹 전략"
                value={chunkPreviewStrategy}
                onChange={(event) => setChunkPreviewStrategy(event.target.value)}
                size="small"
                fullWidth
                helperText={chunkStrategyHint(chunkPreviewStrategy)}
              >
                {(chunkConfig?.chunking.availableStrategies ?? ["fixed-size", "recursive", "structure-based"]).map(
                  (strategy) => (
                    <MenuItem key={strategy} value={strategy}>
                      {strategy}
                    </MenuItem>
                  )
                )}
              </TextField>
              <TextField
                label="Chunk 크기"
                value={chunkPreviewMaxSize}
                onChange={(event) => setChunkPreviewMaxSize(event.target.value)}
                size="small"
                fullWidth
                disabled={!chunkPreviewUsesSizing}
                helperText={
                  chunkPreviewUsesSizing
                    ? "Chunk 하나의 최대 길이입니다."
                    : "선택한 전략에는 적용되지 않습니다."
                }
              />
              <TextField
                label="겹침"
                value={chunkPreviewOverlap}
                onChange={(event) => setChunkPreviewOverlap(event.target.value)}
                size="small"
                fullWidth
                disabled={!chunkPreviewUsesSizing}
                helperText={
                  chunkPreviewUsesSizing
                    ? "앞뒤 Chunk 사이에 다시 포함할 중복 길이입니다."
                    : "선택한 전략에는 적용되지 않습니다."
                }
              />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              미리보기 제한:{" "}
              {chunkConfig
                ? `${chunkConfig.limits.maxInputChars.toLocaleString()}자 / ${chunkConfig.limits.maxPreviewChunks}개`
                : "-"}
            </Typography>
            <TextField
              label="텍스트"
              value={chunkPreviewText}
              onChange={(event) => setChunkPreviewText(event.target.value)}
              placeholder="청킹 결과를 확인할 텍스트를 입력하세요."
              multiline
              minRows={8}
              maxRows={8}
              size="small"
              fullWidth
              slotProps={{
                input: {
                  sx: {
                    alignItems: "flex-start",
                    "& textarea": {
                      overflow: "auto !important",
                    },
                  },
                },
              }}
            />
            <Typography variant="caption" color="text.secondary">
              입력 길이: {chunkPreviewTextLength.toLocaleString()}자 · 현재 Chunk 크기 기준:{" "}
              {chunkPreviewEffectiveMaxSize ? `${chunkPreviewEffectiveMaxSize.toLocaleString()}자` : "-"}
            </Typography>
            {chunkPreviewSingleChunkLikely ? (
              <Alert severity="info">
                현재 입력 길이가 Chunk 크기보다 작습니다. recursive 전략도 가능한 한 자연스러운
                구간을 찾되, 기준 크기를 넘지 않으면 단일 Chunk로 생성될 수 있습니다.
              </Alert>
            ) : null}
            {chunkPreviewSummary ? (
              <Stack direction="row" spacing={0.75} flexWrap="wrap">
                <Chip size="small" label={`총 ${chunkPreviewSummary.totalChunks} chunks`} />
                <Chip size="small" label={`${chunkPreviewSummary.totalChars.toLocaleString()} chars`} />
                <Chip size="small" label={chunkPreviewSummary.strategy} />
                <Chip size="small" label={`size ${chunkPreviewSummary.maxSize}`} />
                <Chip size="small" label={`overlap ${chunkPreviewSummary.overlap}`} />
                <Chip size="small" label={chunkPreviewSummary.unit} />
              </Stack>
            ) : null}
            {chunkPreviewSummary?.warnings?.length ? (
              <Alert severity="warning">{chunkPreviewSummary.warnings.join(" ")}</Alert>
            ) : null}
            <GridContent<RagChunkPreviewItemDto>
              columns={chunkPreviewColumnDefs}
              rowData={chunkPreviewRows}
              loading={chunkPreviewLoading}
              height={260}
              events={[
                {
                  type: "rowClicked",
                  listener: (event) => {
                    setSelectedPreviewChunk((event as { data?: RagChunkPreviewItemDto }).data ?? null);
                  },
                },
              ]}
            />
            <SearchResultDetail
              title={
                selectedPreviewChunk
                  ? `선택한 Chunk 전체 내용 · #${selectedPreviewChunk.chunkOrder ?? "-"}`
                  : "선택한 Chunk 전체 내용"
              }
              content={selectedPreviewChunk?.content}
              metadata={selectedPreviewChunk?.metadata}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChunkPreviewOpen(false)}>닫기</Button>
          <Button
            variant="contained"
            disabled={chunkPreviewLoading || !chunkPreviewText.trim()}
            onClick={() => void handlePreviewChunks()}
          >
            {chunkPreviewLoading ? "실행 중" : "미리보기 실행"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
