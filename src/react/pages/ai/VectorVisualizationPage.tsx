import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  alpha,
  Box,
  Button,
  ButtonGroup,
  Chip,
  CircularProgress,
  Divider,
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
import {
  AddOutlined,
  BubbleChartOutlined,
  CheckCircleOutlined,
  CompareArrowsOutlined,
  ExpandMore,
  ErrorOutline,
  HubOutlined,
  InfoOutlined,
  RefreshOutlined,
  SearchOutlined,
} from "@mui/icons-material";
import axios from "axios";
import {
  formatObjectTypeValue,
  ObjectTypeSelect,
  type ObjectTypeSelectOption,
} from "@/react/components/objecttype/ObjectTypeSelect";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { reactAiApi } from "@/react/pages/ai/api";
import { targetStyle, VectorScatterMap } from "@/react/pages/ai/VectorScatterMap";
import type {
  ProjectionPointsResponse,
  ProjectionStatus,
  SearchVisualizationResponse,
  VectorItemDetail,
  VectorProjection,
} from "@/types/studio/ai";
import { resolveAxiosError } from "@/utils/helpers";

const DEFAULT_LIMIT = 2000;
const MAX_LIMIT = 5000;
const DEFAULT_TOP_K = 10;
const MAX_TOP_K = 100;
const PROJECTION_ALGORITHMS = [
  {
    value: "PCA",
    label: "PCA",
    description: "전체 분산이 큰 방향을 기준으로 빠르게 펼쳐 전반적인 분포를 확인합니다.",
    detail: "문서나 Chunk가 전체적으로 어떤 방향으로 퍼져 있는지 빠르게 확인할 때 적합합니다. 큰 흐름은 잘 보이지만, 가까운 점끼리 항상 실제 의미가 가장 유사하다고 단정하기는 어렵습니다.",
  },
  {
    value: "UMAP",
    label: "UMAP",
    description: "가까운 의미의 데이터가 군집으로 보이도록 배치해 문맥 구분 상태를 확인합니다.",
    detail: "의미가 비슷한 데이터가 같은 군집으로 모이는지 확인하는 데 적합합니다. RAG 색인 품질을 볼 때 객체 유형이나 문서 주제별로 묶임이 생기는지 확인하기 좋습니다.",
  },
  {
    value: "TSNE",
    label: "t-SNE",
    description: "국소적으로 유사한 데이터의 뭉침을 강조해 세밀한 유사 관계를 확인합니다.",
    detail: "작은 그룹 안에서 유사한 항목이 어떻게 모이는지 볼 때 유용합니다. 다만 전체 거리와 방향은 왜곡될 수 있으므로, 넓은 분포 해석보다는 근처 점의 관계 확인에 사용하세요.",
  },
] as const;
const PENDING_STATUSES: ProjectionStatus[] = ["REQUESTED", "PROCESSING"];
const FILTER_INPUT_SX = {
  "& .MuiInputBase-root": { height: 40 },
} as const;
const FILTER_BUTTON_SX = { height: 40 } as const;

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusColor(status?: ProjectionStatus) {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED" || status === "DELETED") return "error";
  if (status === "REQUESTED" || status === "PROCESSING") return "info";
  return "default";
}

function projectionAlgorithmHelp(algorithm: string) {
  return (
    PROJECTION_ALGORITHMS.find((item) => item.value === algorithm)?.description ??
    "서버가 생성한 2D Projection 좌표를 사용합니다."
  );
}

function projectionAlgorithmDetail(algorithm: string) {
  return (
    PROJECTION_ALGORITHMS.find((item) => item.value === algorithm)?.detail ??
    "서버가 생성한 2D Projection 좌표를 그대로 표시합니다. 좌표 자체보다 검색 결과의 similarity 점수를 우선 기준으로 판단하세요."
  );
}

function statusMessage(projection?: VectorProjection | null) {
  if (!projection) return "";
  if (projection.status === "REQUESTED" || projection.status === "PROCESSING") {
    return "좌표 생성 중입니다.";
  }
  if (projection.status === "FAILED") {
    return projection.errorMessage || "벡터 시각화 좌표 생성에 실패했습니다.";
  }
  if (projection.status === "DELETED") {
    return "삭제된 Projection입니다.";
  }
  return "";
}

function projectionScopeLabel(projection: VectorProjection | null, options: ObjectTypeSelectOption[]) {
  if (!projection) return "-";
  if (!projection.targetTypes?.length) {
    return "전체 객체유형";
  }
  return projection.targetTypes.map((item) => formatObjectTypeValue(item, options)).join(", ");
}

function clampLimit(raw: string) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed)));
}

function clampTopK(raw: string) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_TOP_K;
  return Math.max(1, Math.min(MAX_TOP_K, Math.floor(parsed)));
}

function parseMinScore(raw: string) {
  if (!raw.trim()) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(1, parsed));
}

function distanceBetween(
  first?: { x?: number | null; y?: number | null } | null,
  second?: { x?: number | null; y?: number | null } | null
) {
  if (first?.x == null || first.y == null || second?.x == null || second.y == null) {
    return null;
  }
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function metadataText(metadata?: Record<string, unknown>) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "{}";
  }
  return JSON.stringify(metadata, null, 2);
}

function resolveVectorError(error: unknown) {
  if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
    return "접근 권한이 없습니다.";
  }
  return resolveAxiosError(error);
}

function resolveSearchVisualizationError(error: unknown) {
  if (axios.isAxiosError(error) && error.response?.data?.detail === "PROJECTION_SEARCH_FAILED") {
    return "검색 시각화 처리 중 서버 오류가 발생했습니다. 현재 Projection의 객체유형 검색 조건을 서버가 처리하지 못했습니다. 좌표 조회는 사용할 수 있습니다.";
  }
  return resolveVectorError(error);
}

function DetailTableRow({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
}: {
  leftLabel: string;
  leftValue?: React.ReactNode;
  rightLabel?: string;
  rightValue?: React.ReactNode;
}) {
  return (
    <Box component="tr" sx={{ "&:not(:last-of-type)": { borderBottom: "1px solid", borderColor: "divider" } }}>
      <Box component="th" sx={{ width: 92, py: 0.85, pr: 1.25, textAlign: "left", verticalAlign: "top" }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
          {leftLabel}
        </Typography>
      </Box>
      <Box component="td" sx={{ py: 0.85, pr: 1.5, minWidth: 0, verticalAlign: "top" }}>
        <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
          {leftValue || "-"}
        </Typography>
      </Box>
      <Box component="th" sx={{ width: 92, py: 0.85, pr: 1.25, textAlign: "left", verticalAlign: "top" }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
          {rightLabel || ""}
        </Typography>
      </Box>
      <Box component="td" sx={{ py: 0.85, minWidth: 0, verticalAlign: "top" }}>
        <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
          {rightLabel ? rightValue || "-" : ""}
        </Typography>
      </Box>
    </Box>
  );
}

function DetailSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: 0.2 }}>
      {children}
    </Typography>
  );
}

function DetailTextBlock({ label, value }: { label: string; value?: string | null }) {
  return (
    <Box>
      <DetailSectionTitle>{label}</DetailSectionTitle>
      <Box
        sx={{
          mt: 0.5,
          p: 1,
          bgcolor: "action.hover",
          borderRadius: "8px",
          maxHeight: 240,
          overflow: "auto",
        }}
      >
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.7 }}>
          {value || "-"}
        </Typography>
      </Box>
    </Box>
  );
}

function DetailMetadataAccordion({ metadata }: { metadata?: Record<string, unknown> }) {
  return (
    <Accordion
      disableGutters
      elevation={0}
      square
      sx={{
        bgcolor: "transparent",
        "&:before": { display: "none" },
        border: 0,
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMore fontSize="small" />}
        sx={{
          minHeight: 36,
          px: 0,
          "& .MuiAccordionSummary-content": {
            my: 0.75,
            alignItems: "center",
            "&:after": {
              content: '""',
              flex: 1,
              borderBottom: "1px solid",
              borderColor: "divider",
              ml: 1,
            },
          },
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
          Metadata
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 0, pt: 0 }}>
        <Box component="pre" sx={{ m: 0, p: 1, bgcolor: "action.hover", borderRadius: "6px", maxHeight: 220, overflow: "auto", fontSize: 12 }}>
          {metadataText(metadata)}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

function ComparisonPanel({
  items,
  points,
  objectTypeOptions,
  onClear,
}: {
  items: VectorItemDetail[];
  points: Array<{ vectorItemId: string; x?: number | null; y?: number | null; similarity?: number | null }>;
  objectTypeOptions: ObjectTypeSelectOption[];
  onClear: () => void;
}) {
  if (items.length < 2) {
    return null;
  }
  const [first, second] = items;
  const firstPoint = points.find((point) => point.vectorItemId === first.vectorItemId);
  const secondPoint = points.find((point) => point.vectorItemId === second.vectorItemId);
  const distance = distanceBetween(firstPoint, secondPoint);
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: "8px" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <CompareArrowsOutlined fontSize="small" color="primary" />
          <Typography variant="subtitle2">비교 모드</Typography>
        </Stack>
        <Button size="small" onClick={onClear}>
          초기화
        </Button>
      </Stack>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
        <Chip size="small" variant="outlined" label={`좌표 거리 ${distance == null ? "-" : distance.toFixed(4)}`} />
        {firstPoint?.similarity != null ? <Chip size="small" variant="outlined" label={`A 유사도 ${firstPoint.similarity.toFixed(4)}`} /> : null}
        {secondPoint?.similarity != null ? <Chip size="small" variant="outlined" label={`B 유사도 ${secondPoint.similarity.toFixed(4)}`} /> : null}
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1 }}>
        {[first, second].map((item, index) => (
          <Box key={item.vectorItemId} sx={{ minWidth: 0, p: 1, bgcolor: "action.hover", borderRadius: "8px" }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
              {index === 0 ? "A" : "B"} · {formatObjectTypeValue(item.targetType, objectTypeOptions)}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 800, overflowWrap: "anywhere" }}>
              {item.label || item.vectorItemId}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
              source {item.sourceId || "-"} · {item.embeddingModel || "-"}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                mt: 1,
                maxHeight: 160,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
                lineHeight: 1.65,
              }}
            >
              {item.text || "-"}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

function VectorItemDetailPanel({
  item,
  objectTypeOptions,
}: {
  item: VectorItemDetail;
  objectTypeOptions: ObjectTypeSelectOption[];
}) {
  return (
    <Stack spacing={1.25}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>
          {item.label || item.vectorItemId}
        </Typography>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
          <Chip size="small" label={formatObjectTypeValue(item.targetType, objectTypeOptions)} />
          {item.sourceId ? <Chip size="small" variant="outlined" label={`source ${item.sourceId}`} /> : null}
          {item.dimension ? <Chip size="small" variant="outlined" label={`${item.dimension.toLocaleString()} dim`} /> : null}
        </Stack>
      </Box>

      <Box
        component="table"
        sx={{
          width: "100%",
          borderCollapse: "collapse",
          tableLayout: "fixed",
          bgcolor: "background.paper",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <Box component="tbody">
          <DetailTableRow
            leftLabel="Vector ID"
            leftValue={item.vectorItemId}
            rightLabel="객체유형"
            rightValue={formatObjectTypeValue(item.targetType, objectTypeOptions)}
          />
          <DetailTableRow
            leftLabel="sourceId"
            leftValue={item.sourceId}
            rightLabel="차원"
            rightValue={item.dimension?.toLocaleString()}
          />
          <DetailTableRow
            leftLabel="모델"
            leftValue={item.embeddingModel}
            rightLabel="생성일시"
            rightValue={formatDateTime(item.createdAt)}
          />
        </Box>
      </Box>

      <DetailTextBlock label="본문" value={item.text} />
      <DetailMetadataAccordion metadata={item.metadata} />
    </Stack>
  );
}

function EmptyDetailHint() {
  return (
    <Box sx={{ py: 1 }}>
      <Typography variant="body2" color="text.secondary">
        산점도의 점이나 Top-K 결과를 선택하면 상세가 표시됩니다.
      </Typography>
    </Box>
  );
}

function LoadingDetailHint() {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <CircularProgress size={16} />
      <Typography variant="body2" color="text.secondary">
        상세 정보를 불러오는 중입니다.
      </Typography>
    </Stack>
  );
}

function SelectedItemCardTitle() {
  return (
    <Typography variant="subtitle2" sx={{ mb: 1 }}>
      선택 항목 상세
    </Typography>
  );
}

export function VectorVisualizationPage() {
  const [projections, setProjections] = useState<VectorProjection[]>([]);
  const [projectionDetail, setProjectionDetail] = useState<VectorProjection | null>(null);
  const [selectedProjectionId, setSelectedProjectionId] = useState("");
  const [pointsResponse, setPointsResponse] = useState<ProjectionPointsResponse | null>(null);
  const [selectedItem, setSelectedItem] = useState<VectorItemDetail | null>(null);
  const [selectedVectorItemId, setSelectedVectorItemId] = useState<string | null>(null);
  const [comparisonItems, setComparisonItems] = useState<VectorItemDetail[]>([]);
  const [searchResponse, setSearchResponse] = useState<SearchVisualizationResponse | null>(null);
  const [loadingProjections, setLoadingProjections] = useState(false);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [loadingItem, setLoadingItem] = useState(false);
  const [creatingProjection, setCreatingProjection] = useState(false);
  const [searching, setSearching] = useState(false);
  const [projectionError, setProjectionError] = useState<string | null>(null);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [targetType, setTargetType] = useState("");
  const [objectTypeOptions, setObjectTypeOptions] = useState<ObjectTypeSelectOption[]>([]);
  const [clusterId, setClusterId] = useState("");
  const [limit, setLimit] = useState(String(DEFAULT_LIMIT));
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(String(DEFAULT_TOP_K));
  const [createAlgorithm, setCreateAlgorithm] = useState("PCA");
  const [minScore, setMinScore] = useState("");
  const [hideLowSimilarity, setHideLowSimilarity] = useState(false);
  const [showSearchTrajectory, setShowSearchTrajectory] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [activeTargetTypes, setActiveTargetTypes] = useState<string[]>([]);
  const pointFiltersRef = useRef({ targetType: "", query: "", clusterId: "", limit: String(DEFAULT_LIMIT) });
  const itemCacheRef = useRef(new Map<string, VectorItemDetail>());
  const searchCacheRef = useRef(new Map<string, SearchVisualizationResponse>());
  const itemRequestSeqRef = useRef(0);
  const selectedItemIdRef = useRef<string | null>(null);
  const itemErrorRef = useRef<string | null>(null);

  const selectedProjection =
    projectionDetail ?? projections.find((projection) => projection.projectionId === selectedProjectionId) ?? null;
  const points = pointsResponse?.items ?? [];
  const completed = selectedProjection?.status === "COMPLETED";
  const pending = selectedProjection ? PENDING_STATUSES.includes(selectedProjection.status) : false;
  const projectionTargetTypes = selectedProjection?.targetTypes ?? [];
  const createAlgorithmHelp = projectionAlgorithmHelp(createAlgorithm);
  const createAlgorithmDetail = projectionAlgorithmDetail(createAlgorithm);
  const projectionObjectTypes = useMemo(
    () =>
      Array.from(
        new Set(
          [...projectionTargetTypes, ...points.map((point) => point.targetType), targetType]
            .map((item) => String(item ?? "").trim())
            .filter(Boolean)
        )
      ),
    [points, projectionTargetTypes, targetType]
  );
  const legendTypes = useMemo(
    () => projectionObjectTypes,
    [projectionObjectTypes]
  );
  const minSimilarity = useMemo(() => parseMinScore(minScore), [minScore]);
  const visibleSearchResults = useMemo(() => {
    const results = searchResponse?.results ?? [];
    if (!hideLowSimilarity || minSimilarity == null) {
      return results;
    }
    return results.filter((result) => result.similarity == null || result.similarity >= minSimilarity);
  }, [hideLowSimilarity, minSimilarity, searchResponse?.results]);
  const allSelectablePoints = useMemo(
    () => [...(searchResponse?.results ?? []), ...points],
    [points, searchResponse?.results]
  );
  const selectedMapPoint = useMemo(() => {
    const selectedId = selectedVectorItemId;
    if (!selectedId) {
      return null;
    }
    return (
      searchResponse?.results.find((item) => item.vectorItemId === selectedId) ??
      points.find((item) => item.vectorItemId === selectedId) ??
      null
    );
  }, [points, searchResponse?.results, selectedVectorItemId]);

  const addComparisonItem = useCallback((item: VectorItemDetail) => {
    setComparisonItems((current) => {
      const next = current.filter((candidate) => candidate.vectorItemId !== item.vectorItemId);
      next.push(item);
      return next.slice(-2);
    });
  }, []);

  const loadProjections = useCallback(async () => {
    setLoadingProjections(true);
    setProjectionError(null);
    try {
      const data = await reactAiApi.listVectorProjections({ limit: 50, offset: 0 });
      setProjections(data);
      setProjectionDetail((current) => {
        if (!current) return current;
        const latest = data.find((projection) => projection.projectionId === current.projectionId);
        return latest ? { ...current, ...latest } : current;
      });
      setSelectedProjectionId((current) => {
        if (current && data.some((projection) => projection.projectionId === current)) {
          return current;
        }
        return data.find((projection) => projection.status === "COMPLETED")?.projectionId ?? data[0]?.projectionId ?? "";
      });
    } catch (error) {
      setProjectionError(resolveVectorError(error));
    } finally {
      setLoadingProjections(false);
    }
  }, []);

  const loadPoints = useCallback(
    async (projectionId = selectedProjectionId) => {
      if (!projectionId) {
        setPointsResponse(null);
        return;
      }
      const filters = pointFiltersRef.current;
      setLoadingPoints(true);
      setPointsError(null);
      try {
        const response = await reactAiApi.getVectorProjectionPoints(projectionId, {
          targetType: filters.targetType || undefined,
          clusterId: filters.clusterId.trim() || undefined,
          keyword: filters.query.trim() || undefined,
          limit: clampLimit(filters.limit),
          offset: 0,
        });
        setPointsResponse(response);
        setSelectedItem(null);
        setSelectedVectorItemId(null);
        setComparisonItems([]);
        setItemError(null);
        setSearchResponse(null);
        setSearchError(null);
      } catch (error) {
        setPointsError(resolveVectorError(error));
      } finally {
        setLoadingPoints(false);
      }
    },
    [selectedProjectionId]
  );

  const loadProjectionDetail = useCallback(
    async (projectionId: string) => {
      if (!projectionId) {
        setProjectionDetail(null);
        setPointsResponse(null);
        return;
      }
      setProjectionError(null);
      try {
        const detail = await reactAiApi.getVectorProjection(projectionId);
        setProjectionDetail(detail);
        if (detail.status === "COMPLETED") {
          await loadPoints(projectionId);
        } else {
          setPointsResponse(null);
          setSelectedItem(null);
          setSelectedVectorItemId(null);
          setComparisonItems([]);
          setSearchResponse(null);
        }
      } catch (error) {
        setProjectionError(resolveVectorError(error));
      }
    },
    [loadPoints]
  );

  const handleSelectPoint = useCallback(async (vectorItemId: string) => {
    setSelectedVectorItemId(vectorItemId);
    if (selectedItemIdRef.current === vectorItemId && !itemErrorRef.current) {
      return;
    }
    const cached = itemCacheRef.current.get(vectorItemId);
    if (cached) {
      setSelectedItem(cached);
      addComparisonItem(cached);
      setItemError(null);
      return;
    }
    const requestSeq = itemRequestSeqRef.current + 1;
    itemRequestSeqRef.current = requestSeq;
    setLoadingItem(true);
    setItemError(null);
    try {
      const item = await reactAiApi.getVectorItem(vectorItemId);
      itemCacheRef.current.set(vectorItemId, item);
      if (itemRequestSeqRef.current === requestSeq) {
        setSelectedItem(item);
        addComparisonItem(item);
      }
    } catch (error) {
      if (itemRequestSeqRef.current === requestSeq) {
        setItemError(resolveVectorError(error));
      }
    } finally {
      if (itemRequestSeqRef.current === requestSeq) {
        setLoadingItem(false);
      }
    }
  }, [addComparisonItem]);

  async function handleCreateRagProjection() {
    setCreatingProjection(true);
    setProjectionError(null);
    try {
      const now = new Date();
      const response = await reactAiApi.createVectorProjection({
        name: `RAG Vector Map ${createAlgorithm} ${now.toLocaleString()}`,
        algorithm: createAlgorithm,
      });
      await loadProjections();
      setSelectedProjectionId(response.projectionId);
    } catch (error) {
      setProjectionError(resolveVectorError(error));
    } finally {
      setCreatingProjection(false);
    }
  }

  async function handleSearchVisualization() {
    if (!completed || !selectedProjectionId || !query.trim()) {
      return;
    }
    const targetTypes = targetType ? [targetType] : undefined;
    const normalizedTopK = clampTopK(topK);
    const searchKey = JSON.stringify({
      projectionId: selectedProjectionId,
      query: query.trim(),
      targetTypes: targetTypes ?? [],
      topK: normalizedTopK,
    });
    const cached = searchCacheRef.current.get(searchKey);
    if (cached) {
      setSearchResponse(cached);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const response = await reactAiApi.searchVectorVisualization({
        projectionId: selectedProjectionId,
        query: query.trim(),
        targetTypes,
        topK: normalizedTopK,
      });
      const nextResponse = {
        query: response.query,
        results: [...(response.results ?? [])].sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0)),
      };
      searchCacheRef.current.set(searchKey, nextResponse);
      setSearchResponse(nextResponse);
    } catch (error) {
      setSearchError(resolveSearchVisualizationError(error));
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    void loadProjections();
  }, [loadProjections]);

  useEffect(() => {
    pointFiltersRef.current = { targetType, query, clusterId, limit };
  }, [clusterId, limit, query, targetType]);

  useEffect(() => {
    void loadProjectionDetail(selectedProjectionId);
  }, [loadProjectionDetail, selectedProjectionId]);

  useEffect(() => {
    selectedItemIdRef.current = selectedVectorItemId;
  }, [selectedVectorItemId]);

  useEffect(() => {
    itemErrorRef.current = itemError;
  }, [itemError]);

  useEffect(() => {
    if (!pending || !selectedProjectionId) {
      return;
    }
    const timer = window.setTimeout(() => {
      void loadProjections();
      void loadProjectionDetail(selectedProjectionId);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [loadProjectionDetail, loadProjections, pending, selectedProjectionId]);

  return (
    <Stack spacing={2.25}>
      <PageToolbar
        breadcrumbs={["서비스 관리", "AI", "Vector Map"]}
        title="Vector Map"
        label="임베딩 벡터의 2D Projection을 조회하고 검색 결과의 위치를 검증합니다."
        actions={
          <Stack direction="row" spacing={0.75} alignItems="center">
            <TextField
              select
              size="small"
              label="새 맵"
              value={createAlgorithm}
              onChange={(event) => setCreateAlgorithm(event.target.value)}
              helperText={createAlgorithmHelp}
              sx={{
                width: 260,
                ...FILTER_INPUT_SX,
                "& .MuiFormHelperText-root": {
                  maxWidth: 236,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                },
              }}
            >
              {PROJECTION_ALGORITHMS.map((algorithm) => (
                <MenuItem key={algorithm.value} value={algorithm.value}>
                  {algorithm.label}
                </MenuItem>
              ))}
            </TextField>
            <IconButton
              size="small"
              color="primary"
              aria-label="새 Vector Map 생성"
              onClick={() => void handleCreateRagProjection()}
              disabled={creatingProjection}
            >
              {creatingProjection ? <CircularProgress size={18} /> : <AddOutlined fontSize="small" />}
            </IconButton>
            <Tooltip title="새로고침">
              <IconButton size="small" onClick={() => void loadProjections()}>
                <RefreshOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />

      <Alert severity="info">
        <Stack spacing={0.5}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            본 화면은 고차원 임베딩 벡터를 2차원으로 축소한 참고용 시각화입니다.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            점이 가까워 보이면 의미가 비슷할 가능성이 있지만, 2D로 압축하는 과정에서 실제 거리와 달라질 수 있습니다. 정확한
            유사도 판단은 검색 시 표시되는 similarity 점수를 기준으로 확인하세요.
          </Typography>
          <Box
            sx={{
              mt: 0.5,
              px: 1.25,
              py: 1,
              borderLeft: "3px solid",
              borderColor: "info.main",
              bgcolor: (theme) => alpha(theme.palette.info.main, 0.06),
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {createAlgorithm} 맵: {createAlgorithmHelp}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {createAlgorithmDetail}
            </Typography>
          </Box>
        </Stack>
      </Alert>

      {projectionError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void loadProjections()}>
              재시도
            </Button>
          }
        >
          {projectionError}
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: "8px" }}>
        <Stack spacing={1.25}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ xs: "stretch", md: "center" }}>
            <TextField
              select
              size="small"
              label="Projection"
              value={selectedProjectionId}
              onChange={(event) => setSelectedProjectionId(event.target.value)}
              sx={{ minWidth: { md: 360 }, flex: 1 }}
              disabled={loadingProjections || projections.length === 0}
            >
              {projections.map((projection) => (
                <MenuItem key={projection.projectionId} value={projection.projectionId}>
                  {projection.name} · {projection.algorithm} · {projection.status} · {projection.itemCount.toLocaleString()}건
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          {selectedProjection ? (
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                color={statusColor(selectedProjection.status)}
                icon={
                  selectedProjection.status === "COMPLETED" ? (
                    <CheckCircleOutlined />
                  ) : selectedProjection.status === "FAILED" || selectedProjection.status === "DELETED" ? (
                    <ErrorOutline />
                  ) : (
                    <InfoOutlined />
                  )
                }
                label={selectedProjection.status}
              />
              <Chip size="small" variant="outlined" label={selectedProjection.algorithm} />
              <Chip size="small" variant="outlined" label={`${selectedProjection.itemCount.toLocaleString()} items`} />
              <Chip size="small" variant="outlined" label={`객체유형: ${projectionScopeLabel(selectedProjection, objectTypeOptions)}`} />
              <Chip size="small" variant="outlined" label={formatDateTime(selectedProjection.completedAt ?? selectedProjection.createdAt)} />
            </Stack>
          ) : null}
        </Stack>
        {loadingProjections ? (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              Projection 목록을 불러오는 중입니다.
            </Typography>
          </Stack>
        ) : null}
        {!loadingProjections && projections.length === 0 && !projectionError ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            생성된 벡터 시각화 맵이 없습니다. 기존 RAG 파일을 테스트하려면 상단의 RAG 색인 맵 생성을 실행하세요.
          </Alert>
        ) : null}
        {selectedProjection && selectedProjection.status !== "COMPLETED" ? (
          <Alert severity={selectedProjection.status === "FAILED" || selectedProjection.status === "DELETED" ? "error" : "info"} sx={{ mt: 1 }}>
            {statusMessage(selectedProjection)}
          </Alert>
        ) : null}
      </Paper>

      <Box sx={{ px: 0, py: 0.5 }}>
        <Stack direction="row" spacing={1.25} alignItems="flex-start" flexWrap="wrap" useFlexGap>
          <Tooltip title="정책 > 오브젝트 타입에 등록된 ACTIVE 객체유형 기준입니다. 전체를 선택하면 객체유형 필터 없이 조회합니다.">
            <Box sx={{ minWidth: 260, flex: "1 1 260px" }}>
              <ObjectTypeSelect
                value={targetType}
                onChange={setTargetType}
                extraValues={projectionObjectTypes}
                onOptionsLoaded={setObjectTypeOptions}
                sx={{ width: "100%" }}
                textFieldSx={FILTER_INPUT_SX}
              />
            </Box>
          </Tooltip>
          <Tooltip title="서버가 projection 생성 시 부여한 군집 번호입니다. 특정 군집의 점만 확인할 때 사용합니다.">
            <TextField
              size="small"
              label="군집 ID"
              placeholder="예: 3"
              value={clusterId}
              onChange={(event) => setClusterId(event.target.value)}
              helperText="비워두면 전체 군집"
              sx={{ minWidth: 150, flex: "0 1 170px", ...FILTER_INPUT_SX }}
            />
          </Tooltip>
          <TextField
            size="small"
            label="limit"
            type="number"
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            inputProps={{ min: 1, max: MAX_LIMIT }}
            helperText={`최대 ${MAX_LIMIT.toLocaleString()}건`}
            sx={{ width: 130, ...FILTER_INPUT_SX }}
          />
          <TextField
            size="small"
            label="검색어"
            placeholder="검색할 문장 또는 질문"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            helperText="좌표 필터와 Query point 검색에 함께 사용"
            sx={{ minWidth: 280, flex: "1 1 280px", ...FILTER_INPUT_SX }}
          />
          <TextField
            size="small"
            label="Top-K"
            type="number"
            value={topK}
            onChange={(event) => setTopK(event.target.value)}
            inputProps={{ min: 1, max: MAX_TOP_K }}
            helperText="검색 결과 수"
            sx={{ width: 110, ...FILTER_INPUT_SX }}
          />
          <TextField
            size="small"
            label="minScore"
            type="number"
            value={minScore}
            onChange={(event) => setMinScore(event.target.value)}
            inputProps={{ min: 0, max: 1, step: 0.01 }}
            helperText="검색 결과 시각 임계값"
            sx={{ width: 130, ...FILTER_INPUT_SX }}
          />
          <Box sx={{ flex: "0 0 auto", minWidth: { xs: "100%", sm: 280 } }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 700 }}>
              검증 실행
            </Typography>
            <ButtonGroup variant="outlined" sx={{ width: "100%", "& .MuiButton-root": { ...FILTER_BUTTON_SX, flex: 1 } }}>
              <Button
                variant="contained"
                disabled={!completed || loadingPoints}
                onClick={() => void loadPoints()}
                startIcon={<HubOutlined />}
              >
                좌표 조회
              </Button>
              <Button
                disabled={!completed || !query.trim() || searching}
                onClick={() => void handleSearchVisualization()}
                startIcon={searching ? <CircularProgress size={16} /> : <SearchOutlined />}
              >
                검색 시각화
              </Button>
            </ButtonGroup>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              좌표 필터 확인 후 검색어의 Top-K 위치를 함께 검증합니다.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ flex: "1 1 100%", pt: 0.25 }}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={hideLowSimilarity}
                  onChange={(event) => setHideLowSimilarity(event.target.checked)}
                />
              }
              label="임계값 미만 숨김"
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={showSearchTrajectory}
                  onChange={(event) => setShowSearchTrajectory(event.target.checked)}
                />
              }
              label="검색 궤적"
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={showHeatmap}
                  onChange={(event) => setShowHeatmap(event.target.checked)}
                />
              }
              label="밀도 맵"
            />
            <Typography variant="caption" color="text.secondary">
              밀도 맵은 현재 조회된 좌표 분포를 참고용으로 겹쳐 보여줍니다.
            </Typography>
          </Stack>
        </Stack>
      </Box>

      {pointsError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void loadPoints()}>
              재시도
            </Button>
          }
        >
          {pointsError}
        </Alert>
      ) : null}

      {pointsResponse && pointsResponse.totalCount > points.length ? (
        <Alert severity="warning">
          전체 {pointsResponse.totalCount.toLocaleString()}건 중 {points.length.toLocaleString()}건만 표시 중입니다.
        </Alert>
      ) : null}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 360px" }, gap: 2 }}>
        <Box sx={{ minHeight: 560, position: "relative", overflow: "hidden" }}>
          {loadingPoints ? (
            <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ position: "absolute", inset: 0, zIndex: 2, bgcolor: "rgba(255,255,255,0.65)" }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                벡터 좌표를 불러오는 중입니다.
              </Typography>
            </Stack>
          ) : null}
          {completed && points.length > 0 ? (
            <VectorScatterMap
              points={points}
              searchResults={searchResponse?.results ?? []}
              queryPoint={searchResponse?.query}
              selectedVectorItemId={selectedVectorItemId}
              selectedPoint={selectedMapPoint}
              activeTargetTypes={activeTargetTypes}
              showHeatmap={showHeatmap}
              showSearchTrajectory={showSearchTrajectory}
              hideLowSimilarity={hideLowSimilarity}
              minSimilarity={minSimilarity}
              onSelectPoint={handleSelectPoint}
            />
          ) : (
            <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ minHeight: 560, p: 3 }}>
              <BubbleChartOutlined color="disabled" sx={{ fontSize: 48 }} />
              <Typography variant="body2" color="text.secondary">
                {pointsError
                  ? "좌표 조회 API 오류가 발생했습니다. 상단 오류 메시지를 확인하세요."
                  : completed
                    ? "조회된 벡터 좌표가 없습니다."
                    : pending
                      ? "Projection 좌표 생성이 완료되면 산점도가 표시됩니다."
                      : "COMPLETED 상태의 Projection을 선택하면 산점도가 표시됩니다."}
              </Typography>
            </Stack>
          )}
        </Box>

        <Stack spacing={2} sx={{ minWidth: 0 }}>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: "8px" }}>
            <SelectedItemCardTitle />
            {loadingItem ? <LoadingDetailHint /> : itemError ? (
              <Alert
                severity="error"
                action={
                  selectedVectorItemId ? (
                    <Button color="inherit" size="small" onClick={() => void handleSelectPoint(selectedVectorItemId)}>
                      재시도
                    </Button>
                  ) : undefined
                }
              >
                {itemError}
              </Alert>
            ) : selectedItem ? (
              <VectorItemDetailPanel item={selectedItem} objectTypeOptions={objectTypeOptions} />
            ) : (
              <EmptyDetailHint />
            )}
          </Paper>

          <ComparisonPanel
            items={comparisonItems}
            points={allSelectablePoints}
            objectTypeOptions={objectTypeOptions}
            onClear={() => setComparisonItems([])}
          />

          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: "8px" }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              검색어 기반 Top-K 결과
              {searchResponse?.results.length ? (
                <Chip
                  size="small"
                  label={`${visibleSearchResults.length.toLocaleString()} / ${searchResponse.results.length.toLocaleString()}`}
                  sx={{ ml: 1 }}
                />
              ) : null}
            </Typography>
            {searchError ? <Alert severity="error" sx={{ mb: 1 }}>{searchError}</Alert> : null}
            {visibleSearchResults.length ? (
              <Stack spacing={0.75}>
                {visibleSearchResults.map((result, index) => (
                  <Button
                    key={`${result.vectorItemId}-${index}`}
                    variant={selectedItem?.vectorItemId === result.vectorItemId ? "contained" : "outlined"}
                    color="inherit"
                    onClick={() => void handleSelectPoint(result.vectorItemId)}
                    sx={{ justifyContent: "flex-start", textAlign: "left", borderRadius: "8px", px: 1, py: 0.75 }}
                  >
                    <Stack spacing={0.25} sx={{ minWidth: 0, width: "100%" }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="space-between">
                        <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                          {index + 1}. {result.label || result.vectorItemId}
                        </Typography>
                        <Chip size="small" label={result.similarity != null ? result.similarity.toFixed(4) : "-"} />
                      </Stack>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        객체유형 {formatObjectTypeValue(result.targetType, objectTypeOptions)} · {result.sourceId || "-"}
                      </Typography>
                    </Stack>
                  </Button>
                ))}
              </Stack>
            ) : searchResponse ? (
              <Alert severity="info">조건에 맞는 검색 결과가 없습니다.</Alert>
            ) : (
              <Typography variant="body2" color="text.secondary">
                검색어를 입력하고 검색 시각화를 실행하면 Top-K 결과가 표시됩니다.
              </Typography>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: "8px" }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              객체유형 강조 필터
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label="전체"
                color={activeTargetTypes.length === 0 ? "primary" : "default"}
                variant={activeTargetTypes.length === 0 ? "filled" : "outlined"}
                onClick={() => setActiveTargetTypes([])}
              />
              {legendTypes.map((type) => {
                const active = activeTargetTypes.includes(type);
                return (
                <Chip
                  key={type}
                  size="small"
                  label={formatObjectTypeValue(type, objectTypeOptions)}
                  sx={{
                    borderColor: targetStyle(type).color,
                    color: active ? "#fff" : targetStyle(type).color,
                    bgcolor: active ? targetStyle(type).color : undefined,
                    "&:hover": { bgcolor: active ? targetStyle(type).color : "action.hover" },
                  }}
                  variant={active ? "filled" : "outlined"}
                  onClick={() =>
                    setActiveTargetTypes((current) =>
                      current.includes(type) ? current.filter((item) => item !== type) : [...current, type]
                    )
                  }
                />
                );
              })}
            </Stack>
            <Divider sx={{ my: 1.25 }} />
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Chip size="small" variant="outlined" label="QUERY" sx={{ borderColor: targetStyle("QUERY").color, color: targetStyle("QUERY").color }} />
              <Chip size="small" variant="outlined" label="Top-K 결과" color="warning" />
              <Chip size="small" variant="outlined" label="선택 항목" color="primary" />
              {showHeatmap ? <Chip size="small" variant="outlined" label="분포 밀도" color="info" /> : null}
            </Stack>
            {legendTypes.length === 0 ? (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                좌표 조회 후 실제 objectType 기준 범례가 표시됩니다.
              </Typography>
            ) : null}
          </Paper>
        </Stack>
      </Box>
    </Stack>
  );
}
