import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { ColDef } from "ag-grid-community";
import { GridContent } from "@/react/components/ag-grid";
import { reactAiApi } from "@/react/pages/ai/api";
import type {
  RagChunkConfigResponseDto,
  RagChunkPreviewItemDto,
} from "@/types/studio/ai";
import { resolveAxiosError } from "@/utils/helpers";

interface Props {
  open: boolean;
  onClose: () => void;
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

function optionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const numberValue = Number(trimmed);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function ContentPreview({
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
            minHeight: 120,
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
          {content?.trim() || "Chunk row를 선택하면 전체 내용이 여기에 표시됩니다."}
        </Box>
        {metadata ? (
          <Box
            component="pre"
            sx={{
              m: 0,
              maxHeight: 160,
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

export function RagChunkSimulationDialog({ open, onClose }: Props) {
  const [config, setConfig] = useState<RagChunkConfigResponseDto | null>(null);
  const [strategy, setStrategy] = useState("");
  const [maxSize, setMaxSize] = useState("");
  const [overlap, setOverlap] = useState("");
  const [text, setText] = useState("");
  const [rows, setRows] = useState<RagChunkPreviewItemDto[]>([]);
  const [selectedRow, setSelectedRow] = useState<RagChunkPreviewItemDto | null>(null);
  const [summary, setSummary] = useState<{
    totalChunks: number;
    totalChars: number;
    strategy: string;
    maxSize: number;
    overlap: number;
    unit: string;
    warnings: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usesSizing = chunkStrategyUsesSizing(strategy);
  const textLength = text.trim().length;
  const effectiveMaxSize = (usesSizing ? optionalNumber(maxSize) : undefined) ?? config?.chunking.maxSize ?? 0;
  const singleChunkLikely =
    usesSizing && textLength > 0 && effectiveMaxSize > 0 && textLength <= effectiveMaxSize;

  const loadConfig = useCallback(async () => {
    setError(null);
    try {
      const response = await reactAiApi.getRagChunkConfig();
      setConfig(response);
      const defaultStrategy = response.chunking.previewStrategy || response.chunking.strategy || "";
      setStrategy((current) => current || defaultStrategy);
      setMaxSize((current) => current || String(response.chunking.maxSize));
      setOverlap((current) => current || String(response.chunking.overlap));
    } catch (loadError) {
      setError(resolveAxiosError(loadError));
    }
  }, []);

  useEffect(() => {
    if (!open || config) {
      return;
    }
    void loadConfig();
  }, [config, loadConfig, open]);

  async function handlePreview() {
    const previewText = text.trim();
    if (!previewText) {
      setError("시뮬레이션할 텍스트를 입력하세요.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await reactAiApi.previewRagChunks({
        text: previewText,
        strategy: strategy || undefined,
        maxSize: usesSizing ? optionalNumber(maxSize) : undefined,
        overlap: usesSizing ? optionalNumber(overlap) : undefined,
      });
      setRows(response.chunks ?? []);
      setSelectedRow(null);
      setSummary({
        totalChunks: response.totalChunks,
        totalChars: response.totalChars,
        strategy: response.strategy,
        maxSize: response.maxSize,
        overlap: response.overlap,
        unit: response.unit,
        warnings: response.warnings ?? [],
      });
    } catch (previewError) {
      setError(resolveAxiosError(previewError));
    } finally {
      setLoading(false);
    }
  }

  const columns = useMemo<ColDef<RagChunkPreviewItemDto>[]>(
    () => [
      { field: "chunkOrder", headerName: "순서", width: 80, filter: false },
      { field: "contentLength", headerName: "길이", width: 90, filter: false },
      { field: "chunkType", headerName: "유형", width: 120, filter: false },
      { field: "headingPath", headerName: "위치", width: 180, filter: false },
      { field: "content", headerName: "콘텐츠", flex: 1, minWidth: 420, filter: false },
    ],
    []
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>청킹 시뮬레이션</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <Alert severity="info">
            입력 텍스트를 현재 서버 청킹 설정으로 나누어 봅니다. 이 작업은 embedding, vector 저장, 색인 job 생성을 수행하지 않습니다.
          </Alert>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
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
            <TextField
              label="Chunk 크기"
              value={maxSize}
              onChange={(event) => setMaxSize(event.target.value)}
              size="small"
              fullWidth
              disabled={!usesSizing}
              helperText={usesSizing ? "Chunk 하나의 최대 길이입니다." : "선택한 전략에는 적용되지 않습니다."}
            />
            <TextField
              label="겹침"
              value={overlap}
              onChange={(event) => setOverlap(event.target.value)}
              size="small"
              fullWidth
              disabled={!usesSizing}
              helperText={usesSizing ? "앞뒤 Chunk 사이에 다시 포함할 중복 길이입니다." : "선택한 전략에는 적용되지 않습니다."}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            제한:{" "}
            {config
              ? `${config.limits.maxInputChars.toLocaleString()}자 / ${config.limits.maxPreviewChunks}개`
              : "-"}
          </Typography>
          <TextField
            label="텍스트"
            value={text}
            onChange={(event) => setText(event.target.value)}
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
            입력 길이: {textLength.toLocaleString()}자 · 현재 Chunk 크기 기준:{" "}
            {effectiveMaxSize ? `${effectiveMaxSize.toLocaleString()}자` : "-"}
          </Typography>
          {singleChunkLikely ? (
            <Alert severity="info">
              현재 입력 길이가 Chunk 크기보다 작습니다. recursive 전략도 기준 크기를 넘지 않으면 단일 Chunk로 생성될 수 있습니다.
            </Alert>
          ) : null}
          {summary ? (
            <Stack direction="row" spacing={0.75} flexWrap="wrap">
              <Chip size="small" label={`총 ${summary.totalChunks} chunks`} />
              <Chip size="small" label={`${summary.totalChars.toLocaleString()} chars`} />
              <Chip size="small" label={summary.strategy} />
              <Chip size="small" label={`size ${summary.maxSize}`} />
              <Chip size="small" label={`overlap ${summary.overlap}`} />
              <Chip size="small" label={summary.unit} />
            </Stack>
          ) : null}
          {summary?.warnings?.length ? <Alert severity="warning">{summary.warnings.join(" ")}</Alert> : null}
          <GridContent<RagChunkPreviewItemDto>
            columns={columns}
            rowData={rows}
            loading={loading}
            height={260}
            events={[
              {
                type: "rowClicked",
                listener: (event) => {
                  setSelectedRow((event as { data?: RagChunkPreviewItemDto }).data ?? null);
                },
              },
            ]}
          />
          <ContentPreview
            title={selectedRow ? `선택한 Chunk 전체 내용 · #${selectedRow.chunkOrder ?? "-"}` : "선택한 Chunk 전체 내용"}
            content={selectedRow?.content}
            metadata={selectedRow?.metadata}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
        <Button variant="contained" disabled={loading || !text.trim()} onClick={() => void handlePreview()}>
          {loading ? "실행 중" : "시뮬레이션 실행"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
