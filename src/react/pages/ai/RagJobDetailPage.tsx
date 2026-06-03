import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Tooltip,
  Typography,
  TextField,
  MenuItem,
} from "@mui/material";
import {
  AccountTreeOutlined,
  CloseOutlined,
  ContentCopyOutlined,
  DataObjectOutlined,
  ExpandMoreOutlined,
  ImageOutlined,
  KeyboardArrowLeftOutlined,
  KeyboardArrowRightOutlined,
  RefreshOutlined,
  ReplayOutlined,
  SearchOutlined,
  WarningAmberOutlined,
} from "@mui/icons-material";
import type { ColDef, GridOptions } from "ag-grid-community";
import { GridContent, PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { reactAiApi, type EmbeddingOption } from "@/react/pages/ai/api";
import type {
  RagIndexChunkDto,
  RagIndexJobDto,
  RagIndexJobLogDto,
  RagIndexJobStatus,
  VectorSearchResultDto,
} from "@/types/studio/ai";
import { resolveAxiosError } from "@/utils/helpers";

function statusColor(status?: RagIndexJobStatus) {
  if (status === "SUCCEEDED") return "success";
  if (status === "WARNING") return "warning";
  if (status === "FAILED" || status === "CANCELLED") return "error";
  if (status === "RUNNING" || status === "PENDING") return "info";
  return "default";
}

function LogLevelCell(params: { value?: string | null }) {
  const level = String(params.value ?? "-").toUpperCase();
  const isError = ["ERROR", "FAILED", "FAIL"].includes(level);
  const isWarning = ["WARN", "WARNING"].includes(level);
  const color = isError ? "error.main" : isWarning ? "warning.main" : "text.secondary";

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ height: "100%", color }}>
      {isError || isWarning ? <WarningAmberOutlined sx={{ fontSize: 16 }} /> : null}
      <Typography variant="body2" fontWeight={700} color="inherit" noWrap>
        {level}
      </Typography>
    </Stack>
  );
}

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

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

function sourceDisplayName(job?: RagIndexJobDto | null) {
  if (!job) {
    return "-";
  }
  return job.sourceName || job.documentId || `${job.objectType} #${job.objectId}` || job.jobId;
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

function chunkingDisplay(job: RagIndexJobDto, chunks: RagIndexChunkDto[]) {
  const chunkMetadata = chunks.find((chunk) => chunk.metadata)?.metadata;
  const strategy =
    job.chunkingStrategy ??
    metadataValue(chunkMetadata, ["strategy", "chunkingStrategy", "chunking_strategy"]);
  const maxSize =
    job.chunkMaxSize ??
    metadataValue(chunkMetadata, ["maxSize", "chunkMaxSize", "max_size"]);
  const overlap =
    job.chunkOverlap ??
    metadataValue(chunkMetadata, ["overlap", "chunkOverlap", "chunk_overlap"]);
  const unit = job.chunkUnit ?? metadataValue(chunkMetadata, ["chunkUnit", "chunk_unit", "unit"]);

  if (strategy == null || strategy === "") {
    return "-";
  }

  const options = [
    maxSize != null && maxSize !== "" ? `크기 ${formatValue(maxSize)}` : null,
    overlap != null && overlap !== "" ? `겹침 ${formatValue(overlap)}` : null,
    unit != null && unit !== "" ? formatValue(unit) : null,
  ].filter(Boolean);

  return options.length > 0 ? `${formatValue(strategy)} (${options.join(" / ")})` : formatValue(strategy);
}

const INDEX_STEPS = [
  { key: "PENDING", label: "대기" },
  { key: "EXTRACTING", label: "추출" },
  { key: "CHUNKING", label: "청킹" },
  { key: "EMBEDDING", label: "임베딩" },
  { key: "INDEXING", label: "색인" },
  { key: "COMPLETED", label: "완료" },
] as const;

function activeStepIndex(job: RagIndexJobDto) {
  if (job.status === "SUCCEEDED" || job.status === "WARNING") {
    return INDEX_STEPS.length - 1;
  }
  if (job.status === "PENDING") {
    return 0;
  }
  const current = job.currentStep ?? "PENDING";
  return Math.max(
    0,
    INDEX_STEPS.findIndex((step) => step.key === current)
  );
}

function isTerminalSuccess(status: RagIndexJobStatus) {
  return status === "SUCCEEDED" || status === "WARNING";
}

function isTerminalFailure(status: RagIndexJobStatus) {
  return status === "FAILED" || status === "CANCELLED";
}

function describeChunk(chunk?: RagIndexChunkDto) {
  if (!chunk) return "";

  return [
    `Chunk: ${chunk.chunkOrder != null ? `#${chunk.chunkOrder}` : chunk.chunkId}`,
    chunk.headingPath ? `위치: ${chunk.headingPath}` : null,
    chunk.score != null ? `점수: ${chunk.score}` : null,
    chunk.page != null ? `페이지: ${chunk.page}` : null,
    chunk.sourceRef ? `출처: ${chunk.sourceRef}` : null,
    chunk.content ? `내용: ${chunk.content.slice(0, 500)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function metadataText(chunk: RagIndexChunkDto | null | undefined, keys: string[]) {
  return formatValue(metadataValue(chunk?.metadata, keys));
}

function metadataBoolean(metadata: Record<string, unknown> | undefined, keys: string[]) {
  const value = metadataValue(metadata, keys);
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return undefined;
}

function chunkNumber(chunk: RagIndexChunkDto | null | undefined, field: keyof RagIndexChunkDto, keys: string[]) {
  return numberValue((chunk as unknown as Record<string, unknown> | undefined)?.[field as string]) ?? metadataNumber(chunk, keys);
}

function chunkString(chunk: RagIndexChunkDto | null | undefined, field: keyof RagIndexChunkDto, keys: string[]) {
  const direct = (chunk as unknown as Record<string, unknown> | undefined)?.[field as string];
  if (direct != null && direct !== "") {
    return formatValue(direct);
  }
  return metadataText(chunk, keys);
}

function chunkWarnings(chunk: RagIndexChunkDto | null | undefined) {
  const direct = chunk?.warnings;
  const metadataWarnings = metadataValue(chunk?.metadata, ["warnings", "tokenizerWarnings", "warningMessages"]);
  if (Array.isArray(direct)) {
    return direct.filter(Boolean).map(String);
  }
  if (Array.isArray(metadataWarnings)) {
    return metadataWarnings.filter(Boolean).map(String);
  }
  if (typeof metadataWarnings === "string" && metadataWarnings.trim()) {
    return [metadataWarnings];
  }
  const warningStatus = chunk?.warningStatus ?? metadataValue(chunk?.metadata, ["warningStatus", "warning_status"]);
  return warningStatus ? [formatValue(warningStatus)] : [];
}

function chunkLength(chunk?: RagIndexChunkDto | null) {
  const metadataLength = metadataValue(chunk?.metadata, ["chunkLength", "contentLength", "length"]);
  if (typeof metadataLength === "number") {
    return metadataLength;
  }
  if (typeof metadataLength === "string" && metadataLength.trim()) {
    const parsed = Number(metadataLength);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return chunk?.content?.length ?? 0;
}

function chunkLengthRatio(chunk: RagIndexChunkDto | null | undefined, maxSize: number) {
  const length = chunkLength(chunk);
  return maxSize > 0 ? length / maxSize : 0;
}

function isShortChunk(chunk: RagIndexChunkDto | null | undefined, maxSize: number) {
  const length = chunkLength(chunk);
  if (length <= 0) {
    return false;
  }
  return length < 40 || chunkLengthRatio(chunk, maxSize) < 0.15;
}

function chunkRowId(chunk?: RagIndexChunkDto | null) {
  if (!chunk) {
    return "";
  }
  return chunk.chunkId || `${chunk.documentId}:${chunk.chunkOrder ?? ""}:${chunk.sourceRef ?? ""}`;
}

function metadataNumber(chunk: RagIndexChunkDto | null | undefined, keys: string[]) {
  return numberValue(metadataValue(chunk?.metadata, keys));
}

function compactText(value: unknown, maxLength = 72) {
  const text = formatValue(value).replace(/\s+/g, " ").trim();
  if (!text || text === "-") {
    return "-";
  }
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function chunkPosition(chunk?: RagIndexChunkDto | null) {
  const slideNumber = chunkSlideNumber(chunk);
  const pageNumber = chunkPageNumber(chunk);
  const slide = slideNumber != null ? `Slide ${slideNumber}` : null;
  const page = pageNumber != null ? `Page ${pageNumber}` : null;
  const sourceRef = metadataValue(chunk?.metadata, ["sourceRef", "sourceRefs"]);
  const heading = chunk?.headingPath ?? metadataValue(chunk?.metadata, ["section"]);
  return [slide, page, compactText(sourceRef ?? chunk?.sourceRef ?? heading, 64)]
    .filter((value) => value && value !== "-")
    .join(" · ") || "-";
}

function isPresentationChunk(chunk?: RagIndexChunkDto | null) {
  const values = [
    metadataValue(chunk?.metadata, ["sourceFormat", "format", "fileType", "contentType"]),
    metadataValue(chunk?.metadata, ["filename", "fileName", "sourceName"]),
    chunk?.sourceRef,
  ];
  return values.some((value) => typeof value === "string" && /\.(pptx?|odp)$/i.test(value))
    || values.some((value) => typeof value === "string" && /powerpoint|presentation|pptx?|odp/i.test(value));
}

function chunkSlideNumber(chunk?: RagIndexChunkDto | null) {
  return (
    numberValue(chunk?.slide) ??
    metadataNumber(chunk, ["slide", "slideNumber", "slide_number", "slideNo", "slide_no"])
  );
}

function chunkPageNumber(chunk?: RagIndexChunkDto | null) {
  return (
    numberValue(chunk?.page) ??
    metadataNumber(chunk, ["page", "pageNumber", "page_number", "pageNo", "page_no"])
  );
}

function chunkPageDisplay(chunk?: RagIndexChunkDto | null) {
  const slide = chunkSlideNumber(chunk);
  if (slide != null && isPresentationChunk(chunk)) {
    return `Slide ${slide}`;
  }
  const page = chunkPageNumber(chunk);
  if (page != null) {
    return page;
  }
  if (slide != null) {
    return `Slide ${slide}`;
  }
  return "-";
}

function findChunkById(chunks: RagIndexChunkDto[], chunkId: unknown) {
  if (typeof chunkId !== "string" || !chunkId) {
    return null;
  }
  return chunks.find((chunk) => chunk.chunkId === chunkId) ?? null;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function chunkSizeLimit(job: RagIndexJobDto | null, chunks: RagIndexChunkDto[]) {
  const metadata = chunks.find((chunk) => chunk.metadata)?.metadata;
  return (
    numberValue(job?.chunkMaxSize) ??
    numberValue(metadataValue(metadata, ["maxSize", "chunkMaxSize", "max_size"])) ??
    800
  );
}

function chunkImageUrl(chunk?: RagIndexChunkDto | null) {
  const value = metadataValue(chunk?.metadata, [
    "thumbnailUrl",
    "thumbnail_url",
    "imageUrl",
    "image_url",
    "previewUrl",
    "preview_url",
    "sourceImageUrl",
    "source_image_url",
  ]);
  return typeof value === "string" && /^https?:\/\//i.test(value) ? value : undefined;
}

function chunkSearchQuery(chunk: RagIndexChunkDto) {
  return chunk.content.replace(/\s+/g, " ").trim().slice(0, 500);
}

function StatItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Box
        sx={{
          minHeight: 24,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          typography: "body2",
          fontWeight: 700,
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </Box>
    </Box>
  );
}

function StatusChip({ status }: { status: RagIndexJobStatus }) {
  return (
    <Chip
      size="small"
      color={statusColor(status)}
      label={status}
      sx={{
        height: 20,
        borderRadius: 1,
        "& .MuiChip-label": {
          px: 0.75,
          fontSize: 11,
          fontWeight: 700,
          lineHeight: "20px",
        },
      }}
    />
  );
}

function tokenizerSelectionBadge(selectionSource: unknown, fallbackUsed?: boolean) {
  const source = formatValue(selectionSource).toLowerCase();
  if (fallbackUsed || source.includes("fallback")) {
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

function TokenizerStatusPanel({ job, chunks }: { job: RagIndexJobDto; chunks: RagIndexChunkDto[] }) {
  const sampleChunk = chunks.find((chunk) => chunk.metadata || chunk.embeddingModel || chunk.tokenizerProvider);
  const metadata = sampleChunk?.metadata;
  const selectionSource = metadataValue(metadata, [
    "tokenizerSelectionSource",
    "selectionSource",
    "tokenizer_selection_source",
  ]);
  const fallbackUsed = metadataBoolean(metadata, ["tokenizerFallbackUsed", "fallbackUsed", "tokenizer_fallback_used"]);
  const warnings = chunkWarnings(sampleChunk);

  const rows: Array<[string, unknown]> = [
    ["embeddingProvider", sampleChunk?.embeddingProvider ?? metadataValue(metadata, ["embeddingProvider"])],
    ["embeddingModel", sampleChunk?.embeddingModel ?? metadataValue(metadata, ["embeddingModel"])],
    ["tokenizerProvider", sampleChunk?.tokenizerProvider ?? metadataValue(metadata, ["tokenizerProvider"])],
    ["tokenizerEncoding", sampleChunk?.tokenizerEncoding ?? metadataValue(metadata, ["tokenizerEncoding"])],
    ["selectionSource", selectionSource],
    ["confidence", metadataValue(metadata, ["tokenizerConfidence", "confidence"])],
    ["chunkUnit", job.chunkUnit ?? metadataValue(metadata, ["chunkUnit", "unit"])],
    ["chunkSize", job.chunkMaxSize ?? metadataValue(metadata, ["chunkSize", "chunkMaxSize", "maxSize"])],
    ["chunkOverlap", job.chunkOverlap ?? metadataValue(metadata, ["chunkOverlap", "overlap"])],
    ["fallbackUsed", fallbackUsed == null ? undefined : String(fallbackUsed)],
  ];

  return (
    <Box sx={{ mt: 2, p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="subtitle2">Tokenizer Status</Typography>
          {tokenizerSelectionBadge(selectionSource, fallbackUsed)}
          {warnings.length > 0 ? <Chip size="small" color="warning" label="WARNING" /> : null}
        </Stack>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(5, 1fr)" },
            gap: 1,
          }}
        >
          {rows.map(([label, value]) => (
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
    </Box>
  );
}

function ChunkLengthCell({ chunk, maxSize }: { chunk?: RagIndexChunkDto; maxSize: number }) {
  const value = chunkLength(chunk);
  const rawRatio = maxSize > 0 ? Math.round((value / maxSize) * 100) : 0;
  const ratio = Math.min(100, rawRatio);
  const short = isShortChunk(chunk, maxSize);
  const color = short ? "warning.main" : rawRatio > 100 ? "error.main" : "primary.main";

  return (
    <Stack spacing={0} justifyContent="center" sx={{ height: "100%" }}>
      <Stack direction="row" spacing={0} alignItems="center">
        <Typography variant="caption" sx={{ lineHeight: 1 }}>
          {value.toLocaleString()}
        </Typography>
        {short ? (
          <Tooltip title="청크 길이가 너무 짧습니다. 검색 품질 확인이 필요합니다.">
            <WarningAmberOutlined color="warning" sx={{ fontSize: 15 }} />
          </Tooltip>
        ) : null}
      </Stack>
      <Box
        sx={{
          width: "100%",
          height: 4,
          bgcolor: "action.hover",
          borderRadius: 1,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            width: `${Math.max(3, ratio)}%`,
            height: "100%",
            bgcolor: color,
          }}
        />
      </Box>
    </Stack>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "96px minmax(0, 1fr)", gap: 1, alignItems: "start" }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
        {value}
      </Typography>
    </Box>
  );
}

function LinkButton({
  label,
  value,
  disabled,
  onClick,
}: {
  label: string;
  value: unknown;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <DetailRow
      label={label}
      value={
        <Button
          size="small"
          variant="text"
          disabled={disabled || value == null || value === ""}
          onClick={onClick}
          sx={{ minWidth: 0, justifyContent: "flex-start", p: 0, textTransform: "none" }}
        >
          {formatValue(value)}
        </Button>
      }
    />
  );
}

function ChunkInspector({
  job,
  chunk,
  chunks,
  onSelectChunk,
  onClose,
}: {
  job: RagIndexJobDto;
  chunk: RagIndexChunkDto | null;
  chunks: RagIndexChunkDto[];
  onSelectChunk: (chunk: RagIndexChunkDto) => void;
  onClose?: () => void;
}) {
  const [searchingSimilar, setSearchingSimilar] = useState(false);
  const [similarResults, setSimilarResults] = useState<VectorSearchResultDto[]>([]);
  const [similarError, setSimilarError] = useState<string | null>(null);
  const inspectorRef = useRef<HTMLDivElement | null>(null);
  const similarResultsRef = useRef<HTMLDivElement | null>(null);
  const currentIndex = chunks.findIndex((item) => chunkRowId(item) === chunkRowId(chunk));
  const previousChunk =
    findChunkById(chunks, metadataValue(chunk?.metadata, ["previousChunkId", "previous_chunk_id"])) ??
    (currentIndex > 0 ? chunks[currentIndex - 1] : null);
  const nextChunk =
    findChunkById(chunks, metadataValue(chunk?.metadata, ["nextChunkId", "next_chunk_id"])) ??
    (currentIndex >= 0 && currentIndex < chunks.length - 1 ? chunks[currentIndex + 1] : null);
  const parentChunk = findChunkById(chunks, chunk?.parentChunkId ?? metadataValue(chunk?.metadata, ["parentChunkId"]));
  const chunkTitle = chunk
    ? `#${chunk.chunkOrder ?? "-"} ${chunk.chunkType ?? "chunk"}`
    : "청킹 조각을 선택하세요";
  const thumbnailUrl = chunkImageUrl(chunk);
  const imageCaption = chunk?.chunkType === "image-caption";

  useEffect(() => {
    setSimilarResults([]);
    setSimilarError(null);
  }, [chunk?.chunkId]);

  async function handleSimilarSearch() {
    if (!chunk) {
      return;
    }
    setSearchingSimilar(true);
    setSimilarError(null);
    try {
      const results = await reactAiApi.searchVector({
        query: chunkSearchQuery(chunk),
        topK: 5,
        hybrid: true,
        objectType: job.objectType,
        objectId: job.objectId,
      });
      setSimilarResults(results);
      requestAnimationFrame(() => {
        similarResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (searchError) {
      setSimilarError(resolveAxiosError(searchError));
      requestAnimationFrame(() => {
        similarResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } finally {
      setSearchingSimilar(false);
    }
  }

  const drawerLayout = Boolean(onClose);

  useEffect(() => {
    if (drawerLayout) {
      requestAnimationFrame(() => {
        inspectorRef.current?.scrollTo({ top: 0 });
      });
    }
  }, [chunk?.chunkId, drawerLayout]);

  return (
    <Box
      sx={{
        border: drawerLayout ? 0 : "1px solid",
        borderColor: "divider",
        borderRadius: drawerLayout ? 0 : 1,
        p: drawerLayout ? 0 : 1.5,
        minHeight: drawerLayout ? 0 : 500,
        height: drawerLayout ? "100%" : "auto",
        overflow: drawerLayout ? "hidden" : "visible",
        bgcolor: "background.paper",
        boxSizing: "border-box",
        display: drawerLayout ? "flex" : "block",
        flexDirection: "column",
      }}
    >
      <Stack spacing={drawerLayout ? 0 : 1.5} sx={{ height: drawerLayout ? "100%" : "auto" }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
          sx={{
            minHeight: drawerLayout ? 56 : "auto",
            flexShrink: 0,
            bgcolor: "background.paper",
            px: drawerLayout ? 2 : 0,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              선택한 청킹 조각
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {chunkTitle}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="유사 청크 검색 테스트">
              <span>
                <IconButton size="small" disabled={!chunk?.content || searchingSimilar} onClick={() => void handleSimilarSearch()}>
                  {searchingSimilar ? <CircularProgress size={16} /> : <SearchOutlined fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="본문 복사">
              <span>
                <IconButton
                  size="small"
                  disabled={!chunk?.content}
                  onClick={() => {
                    if (chunk?.content) {
                      void navigator.clipboard.writeText(chunk.content);
                    }
                  }}
                >
                  <ContentCopyOutlined fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            {onClose ? (
              <Tooltip title="닫기">
                <IconButton size="small" onClick={onClose}>
                  <CloseOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>
        </Stack>
        {drawerLayout ? <Divider /> : null}

        {chunk ? (
          <Box
            ref={inspectorRef}
            sx={{
              p: drawerLayout ? 2 : 0,
              flex: drawerLayout ? 1 : "initial",
              overflow: drawerLayout ? "auto" : "visible",
              minHeight: 0,
            }}
          >
            <Stack spacing={drawerLayout ? 2 : 1.5}>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={`#${chunk.chunkOrder ?? "-"}`} />
              <Chip size="small" label={chunk.chunkType ?? "chunk"} />
              <Chip size="small" label={`${chunkLength(chunk).toLocaleString()}자`} />
              {chunkNumber(chunk, "tokenCount", ["tokenCount"]) != null ? (
                <Chip size="small" color="primary" label={`${chunkNumber(chunk, "tokenCount", ["tokenCount"])?.toLocaleString()} tokens`} />
              ) : null}
              {chunkWarnings(chunk).length > 0 ? <Chip size="small" color="warning" label="WARNING" /> : null}
              {chunk.page != null ? <Chip size="small" label={`page ${chunk.page}`} /> : null}
              {chunk.slide != null ? <Chip size="small" label={`slide ${chunk.slide}`} /> : null}
            </Stack>

            <Stack direction="row" spacing={0.5}>
              <Tooltip title="이전 Chunk로 이동">
                <span>
                  <IconButton size="small" disabled={!previousChunk} onClick={() => previousChunk && onSelectChunk(previousChunk)}>
                    <KeyboardArrowLeftOutlined fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Parent Chunk로 이동">
                <span>
                  <IconButton size="small" disabled={!parentChunk} onClick={() => parentChunk && onSelectChunk(parentChunk)}>
                    <AccountTreeOutlined fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="다음 Chunk로 이동">
                <span>
                  <IconButton size="small" disabled={!nextChunk} onClick={() => nextChunk && onSelectChunk(nextChunk)}>
                    <KeyboardArrowRightOutlined fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>

            <Divider />

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1.2fr) minmax(220px, 0.8fr)" },
                gap: 1.5,
              }}
            >
              <Stack spacing={0.75}>
                <Typography variant="subtitle2">본문</Typography>
                {imageCaption ? (
                  thumbnailUrl ? (
                    <Box
                      component="img"
                      src={thumbnailUrl}
                      alt="청킹 이미지 썸네일"
                      sx={{
                        width: "100%",
                        maxHeight: 160,
                        objectFit: "cover",
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    />
                  ) : (
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ p: 1, borderRadius: 1, bgcolor: "action.hover", color: "text.secondary" }}
                    >
                      <ImageOutlined fontSize="small" />
                      <Typography variant="caption">image-caption Chunk입니다. 응답 metadata에 thumbnail URL은 없습니다.</Typography>
                    </Stack>
                  )
                ) : null}
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 1,
                    minHeight: 220,
                    maxHeight: 420,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    bgcolor: "action.hover",
                    borderRadius: 1,
                    fontFamily: (theme) => theme.typography.fontFamily,
                    fontSize: 12,
                    lineHeight: 1.7,
                  }}
                >
                  {chunk.content?.trim() || "본문이 없습니다."}
                </Box>
              </Stack>

              <Stack spacing={1.25}>
                <Stack spacing={0.75}>
                  <Typography variant="subtitle2">토큰 정보</Typography>
                  <DetailRow label="textLength" value={formatValue(chunkNumber(chunk, "textLength", ["textLength", "contentLength", "chunkLength", "length"]) ?? chunkLength(chunk))} />
                  <DetailRow label="tokenCount" value={formatValue(chunkNumber(chunk, "tokenCount", ["tokenCount"]))} />
                  <DetailRow label="chunkIndex" value={formatValue(chunkNumber(chunk, "chunkIndex", ["chunkIndex", "chunkOrder"]) ?? chunk.chunkOrder)} />
                </Stack>

                <Stack spacing={0.75}>
                  <Typography variant="subtitle2">Tokenizer</Typography>
                  <DetailRow label="provider" value={chunkString(chunk, "tokenizerProvider", ["tokenizerProvider"])} />
                  <DetailRow label="encoding" value={chunkString(chunk, "tokenizerEncoding", ["tokenizerEncoding"])} />
                  <DetailRow label="selection" value={formatValue(metadataValue(chunk.metadata, ["tokenizerSelectionSource", "selectionSource"]))} />
                  <DetailRow label="confidence" value={formatValue(metadataValue(chunk.metadata, ["tokenizerConfidence", "confidence"]))} />
                  <DetailRow label="fallback" value={formatValue(metadataBoolean(chunk.metadata, ["tokenizerFallbackUsed", "fallbackUsed"]))} />
                </Stack>

                {chunkWarnings(chunk).length > 0 ? (
                  <Alert severity="warning">{chunkWarnings(chunk).join(" ")}</Alert>
                ) : null}

                <Stack spacing={0.75}>
                  <Typography variant="subtitle2">출처</Typography>
                  <DetailRow label="위치" value={chunkPosition(chunk)} />
                  <DetailRow label="headingPath" value={compactText(chunk.headingPath, 90)} />
                  <DetailRow label="sourceRef" value={compactText(chunk.sourceRef, 90)} />
                  <DetailRow label="page" value={formatValue(chunk.page)} />
                  <DetailRow label="slide" value={formatValue(chunk.slide)} />
                  <DetailRow label="sourceFormat" value={metadataText(chunk, ["sourceFormat"])} />
                  <DetailRow label="blockIds" value={metadataText(chunk, ["blockIds"])} />
                </Stack>

                <Stack spacing={0.75}>
                  <Typography variant="subtitle2">연결</Typography>
                  <LinkButton
                    label="parent"
                    value={chunk.parentChunkId ?? metadataValue(chunk.metadata, ["parentChunkId"])}
                    disabled={!parentChunk}
                    onClick={() => parentChunk && onSelectChunk(parentChunk)}
                  />
                  <LinkButton
                    label="previous"
                    value={metadataValue(chunk.metadata, ["previousChunkId", "previous_chunk_id"])}
                    disabled={!previousChunk}
                    onClick={() => previousChunk && onSelectChunk(previousChunk)}
                  />
                  <LinkButton
                    label="next"
                    value={metadataValue(chunk.metadata, ["nextChunkId", "next_chunk_id"])}
                    disabled={!nextChunk}
                    onClick={() => nextChunk && onSelectChunk(nextChunk)}
                  />
                </Stack>

                <Stack spacing={0.75}>
                  <Typography variant="subtitle2">임베딩</Typography>
                  <DetailRow label="provider" value={metadataText(chunk, ["embeddingProvider"])} />
                  <DetailRow label="profile" value={metadataText(chunk, ["embeddingProfileId"])} />
                  <DetailRow label="model" value={metadataText(chunk, ["embeddingModel"])} />
                  <DetailRow label="dimension" value={metadataText(chunk, ["embeddingDimension"])} />
                  <DetailRow label="indexedAt" value={formatDateTime(chunk.indexedAt ?? (metadataValue(chunk.metadata, ["indexedAt"]) as string | undefined))} />
                </Stack>
              </Stack>
            </Box>

            <Box ref={similarResultsRef} sx={{ scrollMarginTop: 16 }}>
              {similarError ? <Alert severity="error">{similarError}</Alert> : null}
            </Box>
            {similarResults.length > 0 ? (
              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1 }}>
                <Stack spacing={0.75}>
                  <Typography variant="subtitle2">유사 검색 테스트 결과</Typography>
                  {similarResults.slice(0, 5).map((result, index) => (
                    <Stack
                      key={`${result.id}-${index}`}
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ minWidth: 0 }}
                    >
                      <Chip size="small" variant="outlined" label={`${index + 1}`} />
                      <Typography variant="caption" color="text.secondary" sx={{ width: 64 }}>
                        {typeof result.score === "number" ? result.score.toFixed(4) : "-"}
                      </Typography>
                      <Typography variant="caption" noWrap sx={{ minWidth: 0 }}>
                        {compactText(result.content, 120)}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            ) : null}

            <Accordion variant="outlined" disableGutters sx={{ "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <DataObjectOutlined fontSize="small" color="action" />
                  <Typography variant="body2" fontWeight={700}>
                    Raw Metadata
                  </Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
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
                  {chunk.metadata ? JSON.stringify(chunk.metadata, null, 2) : "metadata가 없습니다."}
                </Box>
              </AccordionDetails>
            </Accordion>
            </Stack>
          </Box>
        ) : (
          <Box
            ref={inspectorRef}
            sx={{
              minHeight: 320,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "text.secondary",
              textAlign: "center",
              bgcolor: "action.hover",
              borderRadius: 1,
              px: 2,
              flex: drawerLayout ? 1 : "initial",
              overflow: drawerLayout ? "auto" : "visible",
            }}
          >
            <Typography variant="body2">
              색인 결과 row를 선택하면 본문, 출처, 연결 관계, 임베딩 정보를 확인할 수 있습니다.
            </Typography>
          </Box>
        )}
      </Stack>
    </Box>
  );
}

function embeddingDisplay(job: RagIndexJobDto | null) {
  if (!job) return "-";
  if (job.embeddingProfileId) {
    return job.embeddingProfileId;
  }
  if (job.embeddingProvider || job.embeddingModel) {
    return `${job.embeddingProvider} / ${job.embeddingModel}`;
  }
  return "기본 임베딩 설정";
}

export function RagJobDetailPage() {
  const { jobId = "" } = useParams();
  const navigate = useNavigate();
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const chunksRef = useRef<HTMLDivElement | null>(null);
  const logsRef = useRef<HTMLDivElement | null>(null);
  const [job, setJob] = useState<RagIndexJobDto | null>(null);
  const [logs, setLogs] = useState<RagIndexJobLogDto[]>([]);
  const [chunks, setChunks] = useState<RagIndexChunkDto[]>([]);
  const [selectedChunk, setSelectedChunk] = useState<RagIndexChunkDto | null>(null);
  const [loading, setLoading] = useState(false);

  const gridRef = useRef<PageableGridContentHandle<RagIndexChunkDto>>(null);
  const dataSource = useMemo(() => {
    const ds = new ReactPageDataSource<RagIndexChunkDto>(
      `/api/mgmt/ai/rag/jobs/${encodeURIComponent(jobId)}/chunks`
    );
    const originalFetch = ds.fetchForAgGrid.bind(ds);
    ds.fetchForAgGrid = async (params) => {
      const res = await originalFetch(params);
      if (params.startRow === 0) {
        setChunks(res.rows);
      }
      return res;
    };
    return ds;
  }, [jobId]);
  const [mutating, setMutating] = useState(false);
  const [retryConfirmOpen, setRetryConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [embeddingOptions, setEmbeddingOptions] = useState<EmbeddingOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<EmbeddingOption | null>(null);
  const [originalOption, setOriginalOption] = useState<EmbeddingOption | null>(null);
  const selectedChunkIndex = useMemo(
    () => chunks.findIndex((chunk) => chunkRowId(chunk) === chunkRowId(selectedChunk)),
    [chunks, selectedChunk]
  );

  const isPartialEmbedding = Boolean(
    (job?.status === "FAILED" || job?.status === "CANCELLED") &&
    job?.currentStep === "EMBEDDING" &&
    job?.indexedCount &&
    job.indexedCount > 0
  );
  const retryButtonText = isPartialEmbedding ? "이어가기" : "재시도";

  const hasChanged = Boolean(
    originalOption && selectedOption && (
      selectedOption.profileId !== originalOption.profileId ||
      selectedOption.provider !== originalOption.provider ||
      selectedOption.model !== originalOption.model
    )
  );

  const selectChunkByOffset = useCallback(
    (offset: number) => {
      if (chunks.length === 0 || selectedChunkIndex < 0) {
        return;
      }
      const nextIndex = Math.min(chunks.length - 1, Math.max(0, selectedChunkIndex + offset));
      const nextChunk = chunks[nextIndex];
      if (nextChunk && nextIndex !== selectedChunkIndex) {
        setSelectedChunk(nextChunk);
      }
    },
    [chunks, selectedChunkIndex]
  );

  useEffect(() => {
    if (!selectedChunk) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || target?.isContentEditable) {
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        selectChunkByOffset(-1);
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        selectChunkByOffset(1);
      }
      if (event.key === "Escape") {
        setSelectedChunk(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectChunkByOffset, selectedChunk]);

  function scrollToSection(section: "summary" | "chunks" | "logs") {
    const refs = {
      summary: summaryRef,
      chunks: chunksRef,
      logs: logsRef,
    };

    window.setTimeout(() => {
      refs[section].current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }



  const loadDetail = useCallback(async () => {
    if (!jobId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const jobResponse = await reactAiApi.getRagJob(jobId);
      setJob(jobResponse);

      try {
        const logsResult = await reactAiApi.getRagJobLogs(jobResponse.jobId);
        setLogs(logsResult ?? []);
      } catch {
        setLogs([]);
      }
    } catch (loadError) {
      setError(resolveAxiosError(loadError));
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    let alive = true;
    reactAiApi.getEmbeddingOptions()
      .then((res) => {
        if (alive) {
          setEmbeddingOptions(res.options ?? []);
        }
      })
      .catch(() => {
        // ignore
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (embeddingOptions.length > 0) {
      const provider = job?.embeddingProvider;
      const model = job?.embeddingModel;
      const profileId = job?.embeddingProfileId;

      const sampleChunk = chunks.find((chunk) => chunk.metadata || chunk.embeddingModel || chunk.tokenizerProvider);
      const chunkProvider = sampleChunk?.embeddingProvider ?? metadataValue(sampleChunk?.metadata, ["embeddingProvider"]);
      const chunkModel = sampleChunk?.embeddingModel ?? metadataValue(sampleChunk?.metadata, ["embeddingModel"]);
      const chunkProfileId = metadataValue(sampleChunk?.metadata, ["embeddingProfileId"]);

      const effProfileId = profileId || chunkProfileId;
      const effProvider = provider || chunkProvider;
      const effModel = model || chunkModel;

      if (effProfileId || (effProvider && effModel)) {
        const matched = embeddingOptions.find((o) => {
          if (effProfileId) {
            return o.profileId === effProfileId;
          }
          return o.provider === effProvider && o.model === effModel;
        });

        if (matched) {
          setOriginalOption(matched);
          setSelectedOption(matched);
          return;
        }
      }

      const defaultOpt = embeddingOptions.find((o) => o.defaultProfile) || embeddingOptions.find((o) => o.defaultProvider) || embeddingOptions[0] || null;
      setSelectedOption(defaultOpt);
    }
  }, [job, chunks, embeddingOptions]);

  useEffect(() => {
    if (originalOption) {
      setSelectedOption(originalOption);
    }
  }, [originalOption]);

  useEffect(() => {
    if (retryConfirmOpen && originalOption) {
      setSelectedOption(originalOption);
    }
  }, [retryConfirmOpen, originalOption]);

  async function handleRetry() {
    if (!job) {
      return;
    }
    setMutating(true);
    setError(null);
    try {
      let response: RagIndexJobDto;
      const hasChanged = Boolean(
        originalOption && selectedOption && (
          selectedOption.profileId !== originalOption.profileId ||
          selectedOption.provider !== originalOption.provider ||
          selectedOption.model !== originalOption.model
        )
      );

      if (job.status === "CANCELLED" || hasChanged) {
        const payload: any = {
          objectType: job.objectType,
          objectId: job.objectId,
          documentId: job.documentId || undefined,
          sourceType: job.sourceType || undefined,
          forceReindex: true,
          useLlmKeywordExtraction: true,
        };
        if (job.chunkingStrategy) payload.chunkingStrategy = job.chunkingStrategy;
        if (job.chunkMaxSize) payload.chunkMaxSize = job.chunkMaxSize;
        if (job.chunkOverlap) payload.chunkOverlap = job.chunkOverlap;
        if (job.chunkUnit) payload.chunkUnit = job.chunkUnit;

        if (selectedOption) {
          if (selectedOption.profileId) {
            payload.embeddingProfileId = selectedOption.profileId;
          } else {
            payload.embeddingProvider = selectedOption.provider;
            payload.embeddingModel = selectedOption.model;
          }
        }
        response = await reactAiApi.createRagJob(payload);
        navigate(`/services/ai/rag/jobs/${response.jobId}`, { replace: true });
      } else {
        const res = await reactAiApi.retryRagJob(job.jobId);
        response = {
          ...res,
          status: "PENDING",
          currentStep: undefined,
          errorMessage: undefined,
        };
      }
      setJob(response);
      await new Promise((resolve) => setTimeout(resolve, 300));
      await loadDetail();
    } catch (retryError) {
      setError(resolveAxiosError(retryError));
    } finally {
      setMutating(false);
    }
  }

  async function handleCancel() {
    if (!job) {
      return;
    }
    setMutating(true);
    setError(null);
    try {
      const response = await reactAiApi.cancelRagJob(job.jobId);
      setJob(response);
      await loadDetail();
    } catch (cancelError) {
      setError(resolveAxiosError(cancelError));
    } finally {
      setMutating(false);
    }
  }

  const effectiveChunkSize = useMemo(() => chunkSizeLimit(job, chunks), [chunks, job]);

  const chunkColumns = useMemo<ColDef<RagIndexChunkDto>[]>(
    () => [
      {
        field: "chunkOrder",
        headerName: "순서",
        sortable: true,
        width: 76,
        minWidth: 76,
        maxWidth: 82,
        filter: false,
        tooltipValueGetter: (params) => describeChunk(params.data),
      },
      {
        field: "chunkType",
        headerName: "유형",
        sortable: true,
        width: 112,
        minWidth: 96,
        filter: false,
        tooltipValueGetter: (params) => describeChunk(params.data),
      },
      {
        field: "headingPath",
        headerName: "위치",
        sortable: false,
        flex: 1,
        minWidth: 140,
        filter: false,
        valueGetter: (params) => chunkPosition(params.data),
        tooltipValueGetter: (params) => describeChunk(params.data),
        cellRenderer: (params: { data?: RagIndexChunkDto }) => {
          const value = chunkPosition(params.data);
          return (
            <Typography
              variant="body2"
              sx={{
                color: "primary.main",
                cursor: "pointer",
                textDecoration: "underline",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "inline-block",
                width: "100%",
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (params.data) {
                  setSelectedChunk(params.data);
                }
              }}
            >
              {value}
            </Typography>
          );
        },
      },
      {
        field: "page",
        headerName: "페이지",
        sortable: true,
        width: 86,
        minWidth: 78,
        maxWidth: 104,
        filter: false,
        valueGetter: (params) => chunkPageDisplay(params.data),
        tooltipValueGetter: (params) => describeChunk(params.data),
      },
      {
        colId: "length",
        headerName: "길이",
        sortable: true,
        width: 82,
        minWidth: 78,
        maxWidth: 96,
        filter: false,
        valueGetter: (params) => chunkLength(params.data),
        tooltipValueGetter: (params) => describeChunk(params.data),
        cellRenderer: (params: { data?: RagIndexChunkDto }) => (
          <ChunkLengthCell chunk={params.data} maxSize={effectiveChunkSize} />
        ),
      },
      {
        colId: "tokenCount",
        headerName: "Token",
        sortable: true,
        width: 92,
        minWidth: 84,
        filter: false,
        type: "numericColumn",
        valueGetter: (params) => chunkNumber(params.data, "tokenCount", ["tokenCount"]),
        tooltipValueGetter: (params) => describeChunk(params.data),
      },
      {
        colId: "tokenizerProvider",
        headerName: "Tokenizer",
        sortable: true,
        width: 132,
        minWidth: 112,
        filter: false,
        valueGetter: (params) => chunkString(params.data, "tokenizerProvider", ["tokenizerProvider"]),
        tooltipValueGetter: (params) => describeChunk(params.data),
      },
      {
        colId: "tokenizerEncoding",
        headerName: "Encoding",
        sortable: true,
        width: 132,
        minWidth: 112,
        filter: false,
        valueGetter: (params) => chunkString(params.data, "tokenizerEncoding", ["tokenizerEncoding"]),
        tooltipValueGetter: (params) => describeChunk(params.data),
      },
      {
        colId: "embeddingModel",
        headerName: "Embedding",
        sortable: true,
        width: 150,
        minWidth: 128,
        filter: false,
        valueGetter: (params) => chunkString(params.data, "embeddingModel", ["embeddingModel"]),
        tooltipValueGetter: (params) => describeChunk(params.data),
      },
      {
        colId: "warningStatus",
        headerName: "경고",
        sortable: true,
        width: 92,
        minWidth: 84,
        filter: false,
        cellRenderer: (params: { data?: RagIndexChunkDto }) =>
          chunkWarnings(params.data).length > 0 ? (
            <Chip size="small" color="warning" label="WARNING" />
          ) : (
            "-"
          ),
      },
      {
        field: "chunkId",
        headerName: "Chunk ID",
        sortable: true,
        flex: 1,
        minWidth: 180,
        filter: false,
        tooltipValueGetter: (params) => describeChunk(params.data),
      },
    ],
    [effectiveChunkSize]
  );

  const chunkGridOptions = useMemo<GridOptions<RagIndexChunkDto>>(
    () => ({
      getRowId: (params) => chunkRowId(params.data),
      rowClassRules: {
        "rag-chunk-row-selected": (params) => chunkRowId(params.data) === chunkRowId(selectedChunk),
        "rag-chunk-row-short": (params) => isShortChunk(params.data, effectiveChunkSize),
      },
    }),
    [effectiveChunkSize, selectedChunk]
  );

  const logColumns = useMemo<ColDef<RagIndexJobLogDto>[]>(
    () => [
      {
        field: "level",
        headerName: "레벨",
        width: 110,
        filter: false,
        cellRenderer: LogLevelCell,
      },
      { field: "step", headerName: "단계", width: 130, filter: false },
      { field: "code", headerName: "코드", width: 170, filter: false },
      { field: "message", headerName: "메시지", flex: 1, minWidth: 260, filter: false },
      {
        field: "createdAt",
        headerName: "일시",
        width: 190,
        filter: false,
        valueFormatter: (params) => formatDateTime(params.value as string | undefined),
      },
    ],
    []
  );

  return (
    <Stack spacing={2}>
      <PageToolbar
        divider={true}
        breadcrumbs={["서비스 관리", "AI", "RAG", sourceDisplayName(job)]}
        label="색인 작업의 상태, 로그, Chunk를 확인합니다."
        previous
        onPrevious={() => navigate("/services/ai/rag")}
        onRefresh={() => {
          void loadDetail();
          gridRef.current?.refresh();
        }}
        actions={
          <Stack direction="row" spacing={1}>
            <Tooltip title="실패 또는 완료된 작업을 서버 retry 엔드포인트로 다시 실행합니다.">
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ReplayOutlined />}
                  disabled={!job || mutating || job.status === "PENDING" || job.status === "RUNNING"}
                  onClick={() => setRetryConfirmOpen(true)}
                >
                  {retryButtonText}
                </Button>
              </span>
            </Tooltip>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              disabled={!job || mutating || (job.status !== "PENDING" && job.status !== "RUNNING")}
              onClick={() => void handleCancel()}
            >
              취소
            </Button>
          </Stack>
        }
      />
      <Dialog
        open={retryConfirmOpen}
        onClose={mutating ? undefined : () => setRetryConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{retryButtonText}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Typography variant="body2">
              이 RAG 색인 작업을 {retryButtonText}할까요?
            </Typography>
            {job ? (
              <Box sx={{ bgcolor: "action.hover", borderRadius: 1, p: 1.25 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Job ID
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                  {job.jobId}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  대상
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                  {job.objectType} / {job.objectId}
                </Typography>
              </Box>
            ) : null}
            {embeddingOptions.length > 0 ? (
              <Box sx={{ mt: 0.5 }}>
                <TextField
                  select
                  label="임베딩 모델 프로필 (재시도 설정)"
                  size="small"
                  value={selectedOption ? (selectedOption.profileId || `${selectedOption.provider}:${selectedOption.model}`) : ""}
                  onChange={(event) => {
                    const val = event.target.value;
                    const matched = embeddingOptions.find((o) => (o.profileId || `${o.provider}:${o.model}`) === val);
                    if (matched) {
                      setSelectedOption(matched);
                    }
                  }}
                  disabled={mutating}
                  fullWidth
                  helperText={
                    originalOption && selectedOption && (
                      selectedOption.profileId !== originalOption.profileId ||
                      selectedOption.provider !== originalOption.provider ||
                      selectedOption.model !== originalOption.model
                    )
                      ? "임베딩 모델이 변경되어 기존 작업을 재시도하는 대신 새로운 강제 재색인 Job이 생성됩니다."
                      : "설정을 변경하지 않으면 기존 색인 구성 그대로 재시도를 요청합니다."
                  }
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
              </Box>
            ) : null}
            {isPartialEmbedding && !hasChanged ? (
              <Alert severity="info" sx={{ mt: 0.5 }}>
                이미 색인된 chunk는 건너뛰고 나머지부터 진행합니다.
              </Alert>
            ) : null}
            {hasChanged ? (
              <Alert severity="warning" sx={{ mt: 0.5 }}>
                모델을 변경하면 기존 chunk 재사용 없이 새 모델 기준으로 다시 진행됩니다.
              </Alert>
            ) : null}
            <Typography variant="caption" color="text.secondary">
              취소된 작업은 동일 대상으로 새 색인 작업을 생성하고, 그 외 작업은 서버 retry 엔드포인트로 재실행합니다.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRetryConfirmOpen(false)} disabled={mutating}>
            취소
          </Button>
          <Button variant="contained" onClick={() => void handleRetry()} disabled={mutating}>
            {retryButtonText} 진행
          </Button>
        </DialogActions>
      </Dialog>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading && !job ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            작업 정보를 불러오는 중입니다.
          </Typography>
        </Stack>
      ) : null}

      {job ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 200px" },
            gap: { xs: 0, lg: 3 },
          }}
        >
          <Stack spacing={2}>
            <Container maxWidth="md" disableGutters>
              <Box ref={summaryRef} sx={{ scrollMarginTop: 56 }}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
                    gap: 1.25,
                  }}
                >
                  <StatItem
                    label="Job ID"
                    value={
                      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0, width: "100%" }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 700,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {job.jobId}
                        </Typography>
                        <Tooltip title="Job ID 복사">
                          <IconButton
                            size="small"
                            sx={{ p: 0.25 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              void navigator.clipboard.writeText(job.jobId);
                            }}
                          >
                            <ContentCopyOutlined sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    }
                  />
                  <StatItem label="문서/파일명" value={sourceDisplayName(job)} />
                  <StatItem label="상태" value={<StatusChip status={job.status} />} />
                  <StatItem label="단계" value={job.currentStep ?? "-"} />
                  <StatItem label="객체" value={`${job.objectType} #${job.objectId}`} />
                  <StatItem label="소요" value={job.durationMs ? `${job.durationMs.toLocaleString()}ms` : "-"} />
                  <StatItem label="청킹 전략" value={chunkingDisplay(job, chunks)} />
                  <StatItem label="임베딩 설정" value={embeddingDisplay(job)} />
                  <StatItem label="전체 chunk 수" value={job.chunkCount.toLocaleString()} />
                  <StatItem label="임베딩 시도/진행 chunk 수" value={job.embeddedCount.toLocaleString()} />
                  <StatItem label="실제 저장 완료 chunk 수" value={job.indexedCount.toLocaleString()} />
                </Box>
                <TokenizerStatusPanel job={job} chunks={chunks} />
                <Box sx={{ mt: 3, overflowX: "auto", pb: 0.5 }}>
                  <Stepper activeStep={activeStepIndex(job)} alternativeLabel sx={{ minWidth: 620 }}>
                    {INDEX_STEPS.map((step, index) => (
                      <Step
                        key={step.key}
                        completed={isTerminalSuccess(job.status) || index < activeStepIndex(job)}
                      >
                        <StepLabel error={isTerminalFailure(job.status) && index === activeStepIndex(job)}>
                          {step.label}
                        </StepLabel>
                      </Step>
                    ))}
                  </Stepper>
                </Box>
              </Box>
            </Container>

            <Container maxWidth={false} disableGutters>
              <Box ref={chunksRef} sx={{ scrollMarginTop: 56 }}>
                <Stack spacing={1.25}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="subtitle1">색인 결과</Typography>
                    <Tooltip title="Chunk 목록 새로고침">
                      <IconButton size="small" onClick={() => {
                        void loadDetail();
                        gridRef.current?.refresh();
                      }}>
                        <RefreshOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Box
                    sx={{
                      minWidth: 0,
                      "& .ag-row.rag-chunk-row-selected": {
                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                      },
                      "& .ag-row.rag-chunk-row-selected:hover": {
                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.14),
                      },
                      "& .ag-row.rag-chunk-row-selected .ag-cell": {
                        fontWeight: 600,
                      },
                      "& .ag-row.rag-chunk-row-short:not(.rag-chunk-row-selected)": {
                        bgcolor: (theme) => alpha(theme.palette.warning.main, 0.08),
                      },
                      "& .ag-row.rag-chunk-row-short:not(.rag-chunk-row-selected):hover": {
                        bgcolor: (theme) => alpha(theme.palette.warning.main, 0.12),
                      },
                    }}
                  >
                    <PageableGridContent<RagIndexChunkDto>
                      ref={gridRef}
                      columns={chunkColumns}
                      options={chunkGridOptions}
                      datasource={dataSource}
                      height={640}
                    />
                  </Box>
                  <Drawer
                    anchor="right"
                    open={Boolean(selectedChunk)}
                    variant="persistent"
                    onClose={() => setSelectedChunk(null)}
                    PaperProps={{
                      sx: {
                        width: { xs: "78vw", sm: 520, lg: 600, xl: 680 },
                        maxWidth: "100vw",
                        p: 0,
                        bgcolor: "background.paper",
                        borderLeft: "1px solid",
                        borderColor: "divider",
                        boxShadow: 8,
                        overflow: "hidden",
                      },
                    }}
                  >
                    <ChunkInspector
                      job={job}
                      chunk={selectedChunk}
                      chunks={chunks}
                      onSelectChunk={setSelectedChunk}
                      onClose={() => setSelectedChunk(null)}
                    />
                  </Drawer>
                  <Box ref={logsRef} sx={{ scrollMarginTop: 56 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle1">실패·경고 로그</Typography>
                        <Chip size="small" variant="outlined" label={`${logs.length.toLocaleString()}건`} />
                      </Stack>
                      <Tooltip title="로그 새로고침">
                        <IconButton size="small" onClick={() => void loadDetail()}>
                          <RefreshOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    <GridContent<RagIndexJobLogDto> columns={logColumns} rowData={logs} height={220} />
                  </Box>
                </Stack>
              </Box>
            </Container>

          </Stack>

          <Box
            component="aside"
            sx={{
              display: { xs: "none", lg: "block" },
              position: "sticky",
              top: 16,
              alignSelf: "start",
              borderLeft: "1px solid",
              borderColor: "divider",
              pl: 2,
              py: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.2 }}>
              Contents
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {[
                ["summary", "상태 요약"],
                ["chunks", "색인 결과"],
                ["logs", "실패·경고 로그"],
              ].map(([key, label]) => (
                <Button
                  key={String(key)}
                  size="small"
                  variant="text"
                  sx={{
                    justifyContent: "flex-start",
                    color: "text.secondary",
                    fontWeight: 400,
                    borderLeft: "2px solid transparent",
                    pl: 1,
                  }}
                  onClick={() => scrollToSection(key as "summary" | "chunks" | "logs")}
                >
                  {label}
                </Button>
              ))}
            </Stack>
          </Box>
        </Box>
      ) : null}
    </Stack>
  );
}
