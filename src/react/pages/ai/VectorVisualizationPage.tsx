import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  alpha,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AddOutlined,
  CloseOutlined,
  ExpandMoreOutlined,
  InfoOutlined,
  TuneOutlined,
  RefreshOutlined,
  SearchOutlined,
} from "@mui/icons-material";
import type { ColDef, GridOptions } from "ag-grid-community";
import { Link } from "react-router-dom";
import { GridContent } from "@/react/components/ag-grid";
import { ObjectTypeSelect } from "@/react/components/objecttype/ObjectTypeSelect";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { reactAiApi } from "@/react/pages/ai/api";
import type {
  AiInfoResponse,
  VectorItemDetailDto,
  VectorProjectionCreateRequestDto,
  VectorProjectionDetailDto,
  VectorProjectionPointDto,
  VectorProjectionSummaryDto,
  VectorSearchVisualizationResponseDto,
  VectorSearchVisualizationResultPointDto,
} from "@/types/studio/ai";
import { resolveAxiosError } from "@/utils/helpers";

const CHART_WIDTH = 980;
const CHART_HEIGHT = 560;
const CHART_PADDING = 46;
const DEFAULT_LIMIT = 50;
const DEFAULT_POINT_LIMIT = 2000;
const DEFAULT_TOP_K = 20;
const ALGORITHM_OPTIONS = ["PCA", "UMAP", "TSNE"] as const;

type ResultTab = "results" | "metrics";

interface SearchMeta {
  rank: number;
  similarity?: number | null;
  tokenCount?: number | null;
  contextIncluded?: boolean | null;
  metadata?: Record<string, unknown> | null;
}

interface VectorResultRow {
  rank: number;
  vectorItemId: string;
  similarity?: number | null;
  distance?: number | null;
  targetType?: string | null;
  label?: string | null;
  sourceId?: string | null;
  clusterId?: string | null;
  tokenCount?: number | null;
  contextIncluded?: boolean | null;
}

interface SemanticPoint {
  vectorItemId: string;
  targetType?: string;
  sourceId?: string;
  label?: string;
  x: number;
  y: number;
  clusterId?: string | null;
  metadata?: Record<string, unknown> | null;
  rank?: number;
  similarity?: number | null;
  tokenCount?: number | null;
  contextIncluded?: boolean | null;
  searchResult: boolean;
  px: number;
  py: number;
}

interface QueryMarker {
  label?: string | null;
  x: number;
  y: number;
  px: number;
  py: number;
}

interface ProjectionPointFilters {
  keyword?: string;
  targetType?: string;
  clusterId?: string;
}

function isFiniteNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value);
}

function metadataValue(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
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

function numberFromMetadata(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
  const value = metadataValue(metadata, keys);
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function booleanFromMetadata(metadata: Record<string, unknown> | null | undefined, keys: string[]) {
  const value = metadataValue(metadata, keys);
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return undefined;
}

function contextIncludedBadge(included?: boolean | null) {
  if (included == null) {
    return null;
  }
  return (
    <Chip
      size="small"
      color={included ? "success" : "default"}
      label={included ? "CONTEXT INCLUDED" : "CONTEXT EXCLUDED"}
    />
  );
}

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatNumber(value?: number | null, fixed = 3) {
  if (!isFiniteNumber(value)) {
    return "-";
  }
  return value.toFixed(fixed);
}

function projectionDistance(
  query?: { x?: number | null; y?: number | null } | null,
  point?: { x?: number | null; y?: number | null } | null,
) {
  if (
    !query ||
    !point ||
    !isFiniteNumber(query.x) ||
    !isFiniteNumber(query.y) ||
    !isFiniteNumber(point.x) ||
    !isFiniteNumber(point.y)
  ) {
    return null;
  }
  return Math.hypot(
    (point.x as number) - (query.x as number),
    (point.y as number) - (query.y as number),
  );
}

function normalizeTextList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, items) => items.indexOf(item) === index);
}

function parseMinScore(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTopK(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TOP_K;
  }
  return parsed;
}

function isValidTopK(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0;
}

function isValidMinScore(value: string) {
  const parsed = parseMinScore(value);
  return parsed == null || (parsed >= 0 && parsed <= 1);
}

function statusColor(status?: string) {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "PROCESSING":
      return "info";
    case "FAILED":
      return "error";
    case "REQUESTED":
      return "warning";
    default:
      return "default";
  }
}

function renderMetadata(value: unknown) {
  if (value == null || value === "") {
    return "-";
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function pointLoadErrorMessage(error: unknown) {
  const message = resolveAxiosError(error);
  return [
    "좌표 데이터 조회에 실패했습니다.",
    "현재 서버의 /api/mgmt/ai/vectors/projections/{projectionId}/points 응답을 확인해야 합니다.",
    message,
  ]
    .filter(Boolean)
    .join(" ");
}

function targetTypeColor(type?: string) {
  const palette = [
    "#2563eb",
    "#16a34a",
    "#f97316",
    "#7c3aed",
    "#0891b2",
    "#be123c",
    "#64748b",
  ];
  if (!type) {
    return palette[palette.length - 1];
  }
  let hash = 0;
  for (let index = 0; index < type.length; index += 1) {
    hash = (hash * 31 + type.charCodeAt(index)) % palette.length;
  }
  return palette[Math.abs(hash) % palette.length];
}

function projectionPointToSemanticPoint(
  point: VectorProjectionPointDto,
  searchMeta?: SearchMeta,
): SemanticPoint {
  return {
    vectorItemId: point.vectorItemId,
    targetType: point.targetType,
    sourceId: point.sourceId,
    label: point.label,
    x: point.x,
    y: point.y,
    clusterId: point.clusterId,
    metadata: point.metadata,
    rank: searchMeta?.rank,
    similarity: searchMeta?.similarity,
    tokenCount: searchMeta?.tokenCount ?? numberFromMetadata(point.metadata, ["tokenCount"]),
    contextIncluded: searchMeta?.contextIncluded ?? booleanFromMetadata(point.metadata, ["contextIncluded", "ragContextIncluded"]),
    searchResult: Boolean(searchMeta),
    px: 0,
    py: 0,
  };
}

function searchPointToSemanticPoint(
  point: VectorSearchVisualizationResultPointDto,
  rank: number,
): SemanticPoint {
  return {
    vectorItemId: point.vectorItemId,
    targetType: point.targetType,
    sourceId: point.sourceId,
    label: point.label,
    x: point.x,
    y: point.y,
    rank,
    similarity: point.similarity,
    tokenCount: point.tokenCount ?? numberFromMetadata(point.metadata, ["tokenCount"]),
    contextIncluded: point.contextIncluded ?? booleanFromMetadata(point.metadata, ["contextIncluded", "ragContextIncluded"]),
    metadata: point.metadata,
    searchResult: true,
    px: 0,
    py: 0,
  };
}

function axisMapper(points: { x: number; y: number }[]) {
  const xMin = Math.min(...points.map((point) => point.x));
  const xMax = Math.max(...points.map((point) => point.x));
  const yMin = Math.min(...points.map((point) => point.y));
  const yMax = Math.max(...points.map((point) => point.y));
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  return {
    mapX: (x: number) =>
      CHART_PADDING + ((x - xMin) / xRange) * (CHART_WIDTH - CHART_PADDING * 2),
    mapY: (y: number) =>
      CHART_HEIGHT -
      (CHART_PADDING +
        ((y - yMin) / yRange) * (CHART_HEIGHT - CHART_PADDING * 2)),
    xTicks: Array.from({ length: 5 }, (_, index) => {
      const ratio = index / 4;
      return {
        x: CHART_PADDING + ratio * (CHART_WIDTH - CHART_PADDING * 2),
        label: (xMin + xRange * ratio).toFixed(3),
      };
    }),
    yTicks: Array.from({ length: 5 }, (_, index) => {
      const ratio = index / 4;
      return {
        y:
          CHART_HEIGHT -
          (CHART_PADDING + ratio * (CHART_HEIGHT - CHART_PADDING * 2)),
        label: (yMin + yRange * ratio).toFixed(3),
      };
    }),
  };
}

function topValue<T>(entries: T[], fallback: T) {
  return entries.length > 0 ? entries[0] : fallback;
}

export function VectorVisualizationPage() {
  const [projections, setProjections] = useState<VectorProjectionSummaryDto[]>(
    [],
  );
  const [selectedProjectionId, setSelectedProjectionId] = useState<
    string | null
  >(null);
  const [projectionDetail, setProjectionDetail] =
    useState<VectorProjectionDetailDto | null>(null);
  const [projectionLoading, setProjectionLoading] = useState(false);
  const [projectionDetailLoading, setProjectionDetailLoading] = useState(false);
  const [projectionError, setProjectionError] = useState<string | null>(null);

  const [projectionPoints, setProjectionPoints] = useState<
    VectorProjectionPointDto[]
  >([]);
  const [projectionPointLoading, setProjectionPointLoading] = useState(false);
  const [projectionPointError, setProjectionPointError] = useState<
    string | null
  >(null);
  const [pointsRequested, setPointsRequested] = useState(false);

  const [pointKeyword, setPointKeyword] = useState("");
  const [pointTargetType, setPointTargetType] = useState("");
  const [clusterId, setClusterId] = useState("");
  const [colorBy, setColorBy] = useState("objectType");

  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(String(DEFAULT_TOP_K));
  const [minScore, setMinScore] = useState("0.70");
  const [searchTargetTypes, setSearchTargetTypes] = useState("");
  const [aiInfo, setAiInfo] = useState<AiInfoResponse | null>(null);
  const [embeddingProvider, setEmbeddingProvider] = useState("");
  const [embeddingModel, setEmbeddingModel] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchRequested, setSearchRequested] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResult, setSearchResult] =
    useState<VectorSearchVisualizationResponseDto | null>(null);

  const [showQueryPoint, setShowQueryPoint] = useState(true);
  const [showNeighborLines, setShowNeighborLines] = useState(true);
  const [showClusterLabels, setShowClusterLabels] = useState(true);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [resultTab, setResultTab] = useState<ResultTab>("results");

  const [selectedVectorItemId, setSelectedVectorItemId] = useState<
    string | null
  >(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<VectorItemDetailDto | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createAlgorithm, setCreateAlgorithm] =
    useState<(typeof ALGORITHM_OPTIONS)[number]>("PCA");
  const [createTargetTypes, setCreateTargetTypes] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const selectedProjection = useMemo(
    () =>
      projections.find((item) => item.projectionId === selectedProjectionId) ??
      null,
    [projections, selectedProjectionId],
  );
  const currentProjection = projectionDetail ?? selectedProjection;
  const selectedProjectionReady = currentProjection?.status === "COMPLETED";
  const queryReady =
    selectedProjectionReady &&
    query.trim().length > 0 &&
    isValidTopK(topK) &&
    isValidMinScore(minScore);
  const createReady = createName.trim().length > 0;
  const embeddingProviders = useMemo(
    () => aiInfo?.providers.filter((provider) => provider.embedding.enabled) ?? [],
    [aiInfo],
  );
  const currentEmbeddingProvider = useMemo(
    () => embeddingProviders.find((provider) => provider.name === embeddingProvider) ?? null,
    [embeddingProvider, embeddingProviders],
  );

  const searchMetaById = useMemo(() => {
    const result = new Map<string, SearchMeta>();
    searchResult?.results.forEach((point, index) => {
      result.set(point.vectorItemId, {
        rank: index + 1,
        similarity: point.similarity,
        tokenCount: point.tokenCount ?? numberFromMetadata(point.metadata, ["tokenCount"]),
        contextIncluded: point.contextIncluded ?? booleanFromMetadata(point.metadata, ["contextIncluded", "ragContextIncluded"]),
        metadata: point.metadata,
      });
    });
    return result;
  }, [searchResult]);

  const semanticPoints = useMemo(() => {
    const byId = new Map<string, SemanticPoint>();
    projectionPoints.forEach((point) => {
      byId.set(
        point.vectorItemId,
        projectionPointToSemanticPoint(
          point,
          searchMetaById.get(point.vectorItemId),
        ),
      );
    });
    searchResult?.results.forEach((point, index) => {
      const current = byId.get(point.vectorItemId);
      if (current) {
        byId.set(point.vectorItemId, {
          ...current,
          x: point.x,
          y: point.y,
          rank: index + 1,
          similarity: point.similarity,
          tokenCount: point.tokenCount ?? numberFromMetadata(point.metadata, ["tokenCount"]),
          contextIncluded: point.contextIncluded ?? booleanFromMetadata(point.metadata, ["contextIncluded", "ragContextIncluded"]),
          metadata: point.metadata ?? current.metadata,
          searchResult: true,
        });
      } else {
        byId.set(
          point.vectorItemId,
          searchPointToSemanticPoint(point, index + 1),
        );
      }
    });
    return Array.from(byId.values());
  }, [projectionPoints, searchMetaById, searchResult]);

  const queryPoint = searchResult?.query;
  const chartModel = useMemo(() => {
    const axisPoints = [
      ...semanticPoints.map((point) => ({ x: point.x, y: point.y })),
      ...(queryPoint &&
      isFiniteNumber(queryPoint.x) &&
      isFiniteNumber(queryPoint.y)
        ? [{ x: queryPoint.x as number, y: queryPoint.y as number }]
        : []),
    ];
    if (axisPoints.length === 0) {
      return {
        points: [] as SemanticPoint[],
        query: null as QueryMarker | null,
        xTicks: [] as { x: number; label: string }[],
        yTicks: [] as { y: number; label: string }[],
      };
    }

    const mapper = axisMapper(axisPoints);
    return {
      points: semanticPoints.map((point) => ({
        ...point,
        px: mapper.mapX(point.x),
        py: mapper.mapY(point.y),
      })),
      query:
        queryPoint &&
        isFiniteNumber(queryPoint.x) &&
        isFiniteNumber(queryPoint.y)
          ? {
              label: queryPoint.label,
              x: queryPoint.x as number,
              y: queryPoint.y as number,
              px: mapper.mapX(queryPoint.x as number),
              py: mapper.mapY(queryPoint.y as number),
            }
          : null,
      xTicks: mapper.xTicks,
      yTicks: mapper.yTicks,
    };
  }, [queryPoint, semanticPoints]);

  const selectedPoint = useMemo(() => {
    if (!selectedVectorItemId) {
      return null;
    }
    return (
      chartModel.points.find(
        (point) => point.vectorItemId === selectedVectorItemId,
      ) ?? null
    );
  }, [chartModel.points, selectedVectorItemId]);
  const detailPanelOpen = Boolean(selectedPoint && detailOpen);
  const sidePanelOpen = detailPanelOpen || controlsOpen;
  const selectVectorItem = useCallback((vectorItemId?: string | null) => {
    if (!vectorItemId) {
      setSelectedVectorItemId(null);
      setDetailOpen(false);
      return;
    }
    setSelectedVectorItemId(vectorItemId);
    setDetailOpen(true);
    setControlsOpen(false);
  }, []);

  const searchRows = useMemo(
    () =>
      searchResult?.results.map((point, index) => ({
        rank: index + 1,
        distance: projectionDistance(searchResult.query, point),
        tokenCount: point.tokenCount ?? numberFromMetadata(point.metadata, ["tokenCount"]),
        contextIncluded: point.contextIncluded ?? booleanFromMetadata(point.metadata, ["contextIncluded", "ragContextIncluded"]),
        ...point,
      })) ?? [],
    [searchResult],
  );

  const pointRows = useMemo(
    () =>
      chartModel.points.map((point, index) => ({
        rank: index + 1,
        vectorItemId: point.vectorItemId,
        similarity: point.similarity,
        distance: chartModel.query
          ? projectionDistance(chartModel.query, point)
          : null,
        targetType: point.targetType,
        label: point.label,
        sourceId: point.sourceId,
        clusterId: point.clusterId,
        tokenCount: point.tokenCount,
        contextIncluded: point.contextIncluded,
      })),
    [chartModel.points],
  );

  const resultRows = searchRows.length > 0 ? searchRows : pointRows;
  const showingSearchRows = searchRows.length > 0;
  const resultColumnDefs = useMemo<ColDef<VectorResultRow>[]>(
    () => [
      {
        field: "rank",
        headerName: showingSearchRows ? "Rank" : "No.",
        width: 82,
        sortable: true,
        filter: false,
      },
      {
        field: "similarity",
        headerName: "Score",
        width: 110,
        sortable: true,
        filter: false,
        valueFormatter: (params) =>
          showingSearchRows ? formatNumber(params.value) : "-",
      },
      {
        field: "distance",
        headerName: "Distance",
        width: 120,
        sortable: true,
        filter: false,
        valueFormatter: (params) =>
          showingSearchRows ? formatNumber(params.value) : "-",
      },
      {
        field: "tokenCount",
        headerName: "Tokens",
        width: 100,
        sortable: true,
        filter: false,
        type: "numericColumn",
        valueFormatter: (params) =>
          typeof params.value === "number" ? params.value.toLocaleString() : "-",
      },
      {
        field: "contextIncluded",
        headerName: "Context",
        width: 150,
        sortable: true,
        filter: false,
        cellRenderer: (params: { value?: boolean | null }) => contextIncludedBadge(params.value) ?? "-",
      },
      {
        field: "targetType",
        headerName: "Object Type",
        width: 150,
        sortable: true,
        filter: false,
        valueFormatter: (params) => params.value ?? "-",
      },
      {
        field: "label",
        headerName: "Title",
        flex: 1,
        minWidth: 220,
        sortable: true,
        filter: false,
        valueGetter: (params) =>
          params.data?.label ?? params.data?.vectorItemId ?? "-",
      },
      {
        field: "sourceId",
        headerName: "Object ID",
        width: 220,
        sortable: true,
        filter: false,
        valueFormatter: (params) => params.value ?? "-",
      },
      {
        field: "clusterId",
        headerName: "Cluster",
        width: 120,
        sortable: true,
        filter: false,
        valueFormatter: (params) => params.value ?? "-",
      },
    ],
    [showingSearchRows],
  );
  const resultGridOptions = useMemo<GridOptions<VectorResultRow>>(
    () => ({
      getRowId: (params) => params.data.vectorItemId,
      onRowClicked: (event) => {
        if (event.data?.vectorItemId) {
          selectVectorItem(event.data.vectorItemId);
        }
      },
      getRowStyle: (params) =>
        params.data?.vectorItemId === selectedVectorItemId
          ? { backgroundColor: alpha("#1976d2", 0.08) }
          : undefined,
      overlayNoRowsTemplate: `<span class="ag-overlay-no-rows-center">${
        selectedProjectionReady
          ? "전체 맵을 불러오면 Point 목록이 표시됩니다."
          : "COMPLETED 상태의 프로젝션을 선택하세요."
      }</span>`,
      suppressCellFocus: true,
    }),
    [selectVectorItem, selectedProjectionReady, selectedVectorItemId],
  );

  const clusterOptions = useMemo(
    () =>
      Array.from(
        new Set(
          projectionPoints
            .map((point) => point.clusterId)
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    [projectionPoints],
  );

  const typeDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    semanticPoints.forEach((point) => {
      const key = point.targetType ?? "UNKNOWN";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [semanticPoints]);

  const clusterLabels = useMemo(() => {
    const grouped = new Map<string, SemanticPoint[]>();
    chartModel.points.forEach((point) => {
      if (!point.clusterId) {
        return;
      }
      const group = grouped.get(point.clusterId) ?? [];
      group.push(point);
      grouped.set(point.clusterId, group);
    });

    return Array.from(grouped.entries()).map(([id, points]) => ({
      id,
      count: points.length,
      x: points.reduce((sum, point) => sum + point.px, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.py, 0) / points.length,
      color: targetTypeColor(topValue(points, points[0])?.targetType),
    }));
  }, [chartModel.points]);
  const searchResultPointCount = useMemo(
    () => chartModel.points.filter((point) => point.searchResult).length,
    [chartModel.points],
  );
  const canShowQueryPoint = Boolean(chartModel.query);
  const canShowNeighborLines = Boolean(
    chartModel.query && searchResultPointCount > 0,
  );
  const canShowClusterLabels = clusterLabels.length > 0;

  const metrics = useMemo(() => {
    const scores = searchRows
      .map((row) => row.similarity)
      .filter((value): value is number => isFiniteNumber(value));
    const max = scores.length ? Math.max(...scores) : null;
    const min = scores.length ? Math.min(...scores) : null;
    const avg = scores.length
      ? scores.reduce((sum, value) => sum + value, 0) / scores.length
      : null;
    return {
      totalPoints:
        projectionDetail?.itemCount ??
        selectedProjection?.itemCount ??
        projectionPoints.length,
      visiblePoints: semanticPoints.length,
      searchCount: searchRows.length,
      max,
      min,
      avg,
      clusterCount: clusterOptions.length,
    };
  }, [
    clusterOptions.length,
    projectionDetail?.itemCount,
    projectionPoints.length,
    searchRows,
    selectedProjection?.itemCount,
    semanticPoints.length,
  ]);

  const neighborRows = useMemo(
    () =>
      searchRows
        .filter((row) => row.vectorItemId !== selectedVectorItemId)
        .slice(0, 5),
    [searchRows, selectedVectorItemId],
  );

  const loadProjections = useCallback(async () => {
    setProjectionLoading(true);
    setProjectionError(null);
    try {
      const response = await reactAiApi.listVectorProjections({
        limit: DEFAULT_LIMIT,
        offset: 0,
      });
      const next = response.items ?? [];
      setProjections(next);
      setSelectedProjectionId((current) => {
        if (current && next.some((item) => item.projectionId === current)) {
          return current;
        }
        const completed = next.find((item) => item.status === "COMPLETED");
        return completed?.projectionId ?? next[0]?.projectionId ?? null;
      });
    } catch (error) {
      setProjectionError(resolveAxiosError(error));
      setProjections([]);
      setSelectedProjectionId(null);
    } finally {
      setProjectionLoading(false);
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

  const loadProjectionDetail = useCallback(async (projectionId: string) => {
    setProjectionDetailLoading(true);
    setProjectionError(null);
    try {
      const response = await reactAiApi.getVectorProjection(projectionId);
      setProjectionDetail(response);
    } catch (error) {
      setProjectionDetail(null);
      setProjectionError(resolveAxiosError(error));
    } finally {
      setProjectionDetailLoading(false);
    }
  }, []);

  const fetchProjectionPoints = useCallback(
    async (projectionId: string, filters: ProjectionPointFilters = {}) => {
      setProjectionPointLoading(true);
      setProjectionPointError(null);
      setPointsRequested(true);
      try {
        const response = await reactAiApi.getVectorProjectionPoints(
          projectionId,
          {
            limit: DEFAULT_POINT_LIMIT,
            offset: 0,
            ...(filters.keyword?.trim()
              ? { keyword: filters.keyword.trim() }
              : {}),
            ...(filters.targetType?.trim()
              ? { targetType: filters.targetType.trim() }
              : {}),
            ...(filters.clusterId?.trim()
              ? { clusterId: filters.clusterId.trim() }
              : {}),
          },
        );
        const next = response.items ?? [];
        setProjectionPoints(next);
        setSelectedVectorItemId(null);
        setDetailOpen(false);
      } catch (error) {
        setProjectionPoints([]);
        setProjectionPointError(pointLoadErrorMessage(error));
      } finally {
        setProjectionPointLoading(false);
      }
    },
    [],
  );

  const loadProjectionPoints = useCallback(async () => {
    if (!selectedProjectionId || !selectedProjectionReady) {
      setProjectionPoints([]);
      return;
    }

    await fetchProjectionPoints(selectedProjectionId, {
      keyword: pointKeyword,
      targetType: pointTargetType,
      clusterId,
    });
  }, [
    clusterId,
    pointKeyword,
    pointTargetType,
    selectedProjectionId,
    selectedProjectionReady,
  ]);

  useEffect(() => {
    void loadProjections();
    void loadAiInfo();
  }, [loadAiInfo, loadProjections]);

  useEffect(() => {
    setProjectionDetail(null);
    setSearchResult(null);
    setSearchRequested(false);
    setSelectedVectorItemId(null);
    setDetailOpen(false);
    setProjectionPoints([]);
    setProjectionPointError(null);
    setPointsRequested(false);
    setClusterId("");
    if (selectedProjectionId) {
      void loadProjectionDetail(selectedProjectionId);
    }
  }, [loadProjectionDetail, selectedProjectionId]);

  useEffect(() => {
    if (
      !selectedProjectionId ||
      !selectedProjectionReady ||
      pointsRequested ||
      projectionPointLoading
    ) {
      return;
    }
    void fetchProjectionPoints(selectedProjectionId);
  }, [
    fetchProjectionPoints,
    pointsRequested,
    projectionPointLoading,
    selectedProjectionId,
    selectedProjectionReady,
  ]);

  useEffect(() => {
    if (!selectedPoint) {
      setDetail(null);
      setDetailError(null);
      return;
    }

    setDetailLoading(true);
    setDetailError(null);
    reactAiApi
      .getVectorItem(selectedPoint.vectorItemId)
      .then(setDetail)
      .catch((error) => {
        setDetail(null);
        setDetailError(resolveAxiosError(error));
      })
      .finally(() => setDetailLoading(false));
  }, [selectedPoint]);

  function closeCreateDialog() {
    setCreateOpen(false);
    setCreateName("");
    setCreateAlgorithm("PCA");
    setCreateTargetTypes("");
    setCreateError(null);
  }

  async function handleCreateProjection() {
    const name = createName.trim();
    if (!name) {
      setCreateError("프로젝션 이름을 입력해 주세요.");
      return;
    }

    const payload: VectorProjectionCreateRequestDto = {
      name,
      algorithm: createAlgorithm,
      targetTypes: normalizeTextList(createTargetTypes),
    };

    setCreating(true);
    setCreateError(null);
    try {
      const response = await reactAiApi.createVectorProjection(payload);
      await loadProjections();
      setSelectedProjectionId(response.projectionId);
      closeCreateDialog();
    } catch (error) {
      setCreateError(resolveAxiosError(error));
    } finally {
      setCreating(false);
    }
  }

  async function runSearch() {
    if (!selectedProjectionId) {
      setSearchError("프로젝션을 먼저 선택해 주세요.");
      return;
    }
    if (!selectedProjectionReady) {
      setSearchError(
        "선택한 프로젝션이 COMPLETED 상태여야 분석할 수 있습니다.",
      );
      return;
    }
    if (!query.trim()) {
      setSearchError("검색어를 입력하세요.");
      return;
    }
    if (!isValidTopK(topK)) {
      setSearchError("Top K는 1 이상의 숫자로 입력하세요.");
      return;
    }
    if (!isValidMinScore(minScore)) {
      setSearchError("Min Score는 0~1 사이 값으로 입력하세요.");
      return;
    }

    setSearchLoading(true);
    setSearchRequested(true);
    setSearchError(null);
    try {
      const minScoreValue = parseMinScore(minScore);
      const response = await reactAiApi.searchVectorVisualization({
        projectionId: selectedProjectionId,
        query: query.trim(),
        topK: parseTopK(topK),
        ...(searchTargetTypes.trim()
          ? { targetTypes: normalizeTextList(searchTargetTypes) }
          : {}),
        ...(embeddingProvider.trim() ? { embeddingProvider: embeddingProvider.trim() } : {}),
        ...(embeddingModel.trim() ? { embeddingModel: embeddingModel.trim() } : {}),
        ...(isFiniteNumber(minScoreValue) ? { minScore: minScoreValue } : {}),
      });
      setSearchResult(response);
      selectVectorItem(response.results[0]?.vectorItemId);
      setResultTab("results");
    } catch (error) {
      setSearchResult(null);
      setSearchError(resolveAxiosError(error));
    } finally {
      setSearchLoading(false);
    }
  }

  return (
    <Stack spacing={1.2}>
      <PageToolbar
        divider
        breadcrumbs={["서비스", "AI", "벡터 시각화"]}
        label="Embedding 품질과 Query Projection 결과를 2D semantic map에서 검증합니다."
        onRefresh={() => {
          void loadProjections();
          if (selectedProjectionId) {
            void loadProjectionDetail(selectedProjectionId);
          }
        }}
        actions={
          <>
            <Tooltip title="시각화 데이터 생성">
              <IconButton
                size="small"
                color="primary"
                onClick={() => setCreateOpen(true)}
              >
                <AddOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              component={Link}
              to="/services/ai/rag"
              size="small"
              variant="outlined"
            >
              AI RAG 이동
            </Button>
          </>
        }
      />

      {projectionError ? (
        <Alert severity="error">{projectionError}</Alert>
      ) : null}
      {projectionPointError ? (
        <Alert severity="error">{projectionPointError}</Alert>
      ) : null}
      {searchError ? <Alert severity="error">{searchError}</Alert> : null}
      {createError ? <Alert severity="error">{createError}</Alert> : null}
      {detailError ? <Alert severity="error">{detailError}</Alert> : null}

      <Card variant="outlined">
        <Stack spacing={1.3} sx={{ p: 2 }}>
          <Stack direction="row" spacing={1.2} alignItems="flex-end">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">
                프로젝션
              </Typography>
              <Select
                fullWidth
                size="small"
                value={selectedProjectionId ?? ""}
                displayEmpty
                onChange={(event) =>
                  setSelectedProjectionId(event.target.value || null)
                }
                renderValue={(value) => {
                  const selected = projections.find(
                    (item) => item.projectionId === value,
                  );
                  return selected ? (
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ minWidth: 0 }}
                    >
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{ fontWeight: 600 }}
                      >
                        {selected.name}
                      </Typography>
                      <Chip
                        size="small"
                        color={statusColor(selected.status)}
                        label={selected.status}
                        sx={{ height: 20, fontWeight: 700 }}
                      />
                    </Stack>
                  ) : (
                    "프로젝션 선택"
                  );
                }}
              >
                <MenuItem value="">프로젝션 선택</MenuItem>
                {projections.map((projection) => (
                  <MenuItem
                    key={projection.projectionId}
                    value={projection.projectionId}
                  >
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ width: "100%" }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ flex: 1, minWidth: 0 }}
                        noWrap
                      >
                        {projection.name}
                      </Typography>
                      <Chip
                        size="small"
                        color={statusColor(projection.status)}
                        label={projection.status}
                        sx={{ height: 20, fontWeight: 700 }}
                      />
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </Box>
            {projectionLoading || projectionDetailLoading ? (
              <CircularProgress size={20} />
            ) : null}
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.2}
            useFlexGap
            flexWrap="wrap"
          >
            <SummaryMetric
              label="Algorithm"
              value={currentProjection?.algorithm ?? "-"}
            />
            <SummaryMetric
              label="Points"
              value={(currentProjection?.itemCount ?? 0).toLocaleString()}
            />
            <SummaryMetric
              label="Target Types"
              value={
                currentProjection?.targetTypes?.length
                  ? currentProjection.targetTypes.join(", ")
                  : "전체"
              }
              wide
            />
            <SummaryMetric
              label="Created"
              value={formatDateTime(currentProjection?.createdAt)}
            />
            <SummaryMetric
              label="Completed"
              value={formatDateTime(currentProjection?.completedAt)}
            />
          </Stack>

          {projectionDetail?.errorMessage ? (
            <Alert severity="error">{projectionDetail.errorMessage}</Alert>
          ) : null}
          {projections.length === 0 && !projectionLoading ? (
            <Alert severity="info">생성된 시각화 데이터가 없습니다.</Alert>
          ) : null}
        </Stack>
      </Card>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            lg: sidePanelOpen ? "minmax(0, 1fr) 360px" : "minmax(0, 1fr)",
          },
          gap: 1.2,
          alignItems: "stretch",
        }}
      >
        {!detailPanelOpen && controlsOpen ? (
          <Paper variant="outlined" sx={{ p: 2, order: { xs: 2, lg: 2 } }}>
            <Stack spacing={1.4}>
              <Stack
                direction="row"
                alignItems="flex-start"
                justifyContent="space-between"
                spacing={1}
              >
                <Stack spacing={0.3}>
                  <Typography variant="subtitle2">
                    Visualization Controls
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Query 분석 조건과 전체 맵 필터를 설정합니다.
                  </Typography>
                </Stack>
                <Tooltip title="Controls 숨기기">
                  <IconButton
                    size="small"
                    onClick={() => setControlsOpen(false)}
                  >
                    <CloseOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontWeight: 800, textTransform: "uppercase" }}
                >
                  Query
                </Typography>
                <TextField
                  label="Query"
                  placeholder="검색어를 입력하세요"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  fullWidth
                  size="small"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && queryReady) {
                      void runSearch();
                    }
                  }}
                />
                <Button
                  variant="contained"
                  startIcon={
                    searchLoading ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <SearchOutlined />
                    )
                  }
                  onClick={() => void runSearch()}
                  disabled={searchLoading || !queryReady}
                  fullWidth
                >
                  벡터 위치 분석
                </Button>
              </Stack>

              <BorderlessAccordion title="검색 옵션">
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      label="Top K"
                      value={topK}
                      onChange={(event) => setTopK(event.target.value)}
                      size="small"
                      inputProps={{ inputMode: "numeric" }}
                      error={!isValidTopK(topK)}
                      helperText={!isValidTopK(topK) ? "1 이상의 숫자" : " "}
                      fullWidth
                    />
                    <TextField
                      label="Min Score"
                      value={minScore}
                      onChange={(event) => setMinScore(event.target.value)}
                      size="small"
                      inputProps={{ inputMode: "decimal" }}
                      error={!isValidMinScore(minScore)}
                      helperText={
                        !isValidMinScore(minScore) ? "0~1 사이 값" : " "
                      }
                      fullWidth
                    />
                  </Stack>
                  <ObjectTypeSelect
                    value={searchTargetTypes}
                    onChange={setSearchTargetTypes}
                    label="검색 Object Type"
                    size="small"
                    placeholder="전체"
                    fullWidth
                    helperText="공통 Object Type 목록에서 검색 대상을 제한합니다."
                  />
                  <Stack direction="row" spacing={1}>
                    <TextField
                      select
                      label="Embedding Provider"
                      value={embeddingProvider}
                      onChange={(event) => {
                        const nextProvider = event.target.value;
                        const provider = embeddingProviders.find((item) => item.name === nextProvider);
                        setEmbeddingProvider(nextProvider);
                        setEmbeddingModel(provider?.embedding.model ?? "");
                      }}
                      size="small"
                      fullWidth
                      helperText="검색 쿼리 벡터 생성에 사용할 provider입니다."
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
                      label="Embedding Model"
                      value={embeddingModel}
                      onChange={(event) => setEmbeddingModel(event.target.value)}
                      size="small"
                      fullWidth
                      helperText="선택 provider의 embedding 모델입니다."
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
                </Stack>
              </BorderlessAccordion>

              <BorderlessAccordion title="Map Filter">
                <Stack spacing={1}>
                  <TextField
                    label="맵 Keyword"
                    value={pointKeyword}
                    onChange={(event) => setPointKeyword(event.target.value)}
                    size="small"
                    fullWidth
                  />
                  <ObjectTypeSelect
                    value={pointTargetType}
                    onChange={setPointTargetType}
                    label="맵 Object Type"
                    size="small"
                    placeholder="전체"
                    fullWidth
                  />
                  <TextField
                    select
                    label="Cluster"
                    value={clusterId}
                    onChange={(event) => setClusterId(event.target.value)}
                    size="small"
                    fullWidth
                  >
                    <MenuItem value="">전체</MenuItem>
                    {clusterOptions.map((item) => (
                      <MenuItem key={item} value={item}>
                        {item}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button
                    variant="outlined"
                    startIcon={
                      projectionPointLoading ? (
                        <CircularProgress size={16} />
                      ) : (
                        <RefreshOutlined />
                      )
                    }
                    onClick={() => void loadProjectionPoints()}
                    disabled={
                      !selectedProjectionReady || projectionPointLoading
                    }
                    fullWidth
                  >
                    전체 맵 새로고침
                  </Button>
                </Stack>
              </BorderlessAccordion>

              <BorderlessAccordion title="Color & Display">
                <Stack spacing={1}>
                  <TextField
                    select
                    label="Color By"
                    value={colorBy}
                    onChange={(event) => setColorBy(event.target.value)}
                    size="small"
                    fullWidth
                  >
                    <MenuItem value="objectType">Object Type</MenuItem>
                  </TextField>
                  <Stack spacing={0.4}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={canShowQueryPoint && showQueryPoint}
                          disabled={!canShowQueryPoint}
                          onChange={(event) =>
                            setShowQueryPoint(event.target.checked)
                          }
                        />
                      }
                      label={
                        <Typography variant="body2">Query Point</Typography>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={canShowNeighborLines && showNeighborLines}
                          disabled={!canShowNeighborLines}
                          onChange={(event) =>
                            setShowNeighborLines(event.target.checked)
                          }
                        />
                      }
                      label={
                        <Typography variant="body2">Neighbor Line</Typography>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={canShowClusterLabels && showClusterLabels}
                          disabled={!canShowClusterLabels}
                          onChange={(event) =>
                            setShowClusterLabels(event.target.checked)
                          }
                        />
                      }
                      label={
                        <Typography variant="body2">Cluster Label</Typography>
                      }
                    />
                  </Stack>
                </Stack>
              </BorderlessAccordion>
            </Stack>
          </Paper>
        ) : null}

        <Box sx={{ minWidth: 0, order: { xs: 1, lg: 1 } }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 1 }}
          >
            <Stack spacing={0.2}>
              <Typography variant="subtitle2">Semantic Map</Typography>
              <Typography variant="caption" color="text.secondary">
                {projectionPointLoading
                  ? "전체 벡터 위치를 불러오는 중입니다."
                  : pointsRequested
                    ? `${semanticPoints.length.toLocaleString()} visible points · ${searchRows.length.toLocaleString()} topK results`
                    : selectedProjectionReady
                      ? "프로젝션 선택 후 전체 맵을 자동으로 불러옵니다."
                      : "COMPLETED 상태의 프로젝션을 선택하세요."}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.8} alignItems="center">
              {selectedPoint && !detailOpen ? (
                <Tooltip title="선택 상세 열기">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setDetailOpen(true);
                      setControlsOpen(false);
                    }}
                  >
                    <InfoOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
              {!sidePanelOpen ? (
                <Tooltip title="Controls 열기">
                  <IconButton
                    size="small"
                    onClick={() => setControlsOpen(true)}
                  >
                    <TuneOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
              {projectionPointLoading || searchLoading ? (
                <CircularProgress size={18} />
              ) : null}
            </Stack>
          </Stack>

          {chartModel.points.length > 0 ? (
            <Box
              sx={{
                width: "100%",
                overflow: "hidden",
                bgcolor: "transparent",
              }}
            >
              <svg
                width="100%"
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                style={{ display: "block" }}
              >
                <rect
                  x={CHART_PADDING}
                  y={CHART_PADDING}
                  width={CHART_WIDTH - CHART_PADDING * 2}
                  height={CHART_HEIGHT - CHART_PADDING * 2}
                  rx={8}
                  fill="#f8fafc"
                  stroke="#e2e8f0"
                />
                {chartModel.xTicks.map((tick) => (
                  <g key={`x-${tick.label}`}>
                    <line
                      x1={tick.x}
                      x2={tick.x}
                      y1={CHART_PADDING}
                      y2={CHART_HEIGHT - CHART_PADDING}
                      stroke="#e2e8f0"
                    />
                    <text
                      x={tick.x}
                      y={CHART_HEIGHT - CHART_PADDING + 18}
                      textAnchor="middle"
                      fontSize={11}
                      fill="#64748b"
                    >
                      {tick.label}
                    </text>
                  </g>
                ))}
                {chartModel.yTicks.map((tick) => (
                  <g key={`y-${tick.label}`}>
                    <line
                      x1={CHART_PADDING}
                      x2={CHART_WIDTH - CHART_PADDING}
                      y1={tick.y}
                      y2={tick.y}
                      stroke="#e2e8f0"
                    />
                    <text
                      x={CHART_PADDING - 10}
                      y={tick.y + 4}
                      textAnchor="end"
                      fontSize={11}
                      fill="#64748b"
                    >
                      {tick.label}
                    </text>
                  </g>
                ))}

                {canShowNeighborLines && showNeighborLines
                  ? chartModel.points
                      .filter((point) => point.searchResult)
                      .map((point) => {
                        const distance = projectionDistance(
                          chartModel.query,
                          point,
                        );
                        const showDistanceLabel =
                          Boolean(point.rank && point.rank <= 5) ||
                          selectedPoint?.vectorItemId === point.vectorItemId;
                        return (
                          <g key={`line-${point.vectorItemId}`}>
                            <line
                              x1={chartModel.query!.px}
                              y1={chartModel.query!.py}
                              x2={point.px}
                              y2={point.py}
                              stroke="#94a3b8"
                              strokeDasharray="4 5"
                              strokeWidth={1.2}
                              opacity={0.75}
                            />
                            <title>{`Query -> ${point.label ?? point.vectorItemId}\ndistance: ${formatNumber(distance)}\nscore: ${formatNumber(point.similarity)}`}</title>
                            {showDistanceLabel ? (
                              <text
                                x={(chartModel.query!.px + point.px) / 2}
                                y={(chartModel.query!.py + point.py) / 2 - 4}
                                textAnchor="middle"
                                fontSize={10}
                                fill="#475569"
                                fontWeight={700}
                              >
                                {formatNumber(distance, 2)}
                              </text>
                            ) : null}
                          </g>
                        );
                      })
                  : null}

                {canShowClusterLabels && showClusterLabels
                  ? clusterLabels.map((label) => (
                      <g key={label.id}>
                        <rect
                          x={label.x - 28}
                          y={label.y - 13}
                          width={56}
                          height={24}
                          rx={12}
                          fill="#ffffff"
                          stroke={label.color}
                          opacity={0.92}
                        />
                        <text
                          x={label.x}
                          y={label.y + 4}
                          textAnchor="middle"
                          fontSize={11}
                          fill={label.color}
                          fontWeight={700}
                        >
                          {label.id}
                        </text>
                      </g>
                    ))
                  : null}

                {chartModel.points.map((point) => {
                  const selected =
                    selectedPoint?.vectorItemId === point.vectorItemId;
                  const color = targetTypeColor(point.targetType);
                  return (
                    <g key={point.vectorItemId}>
                      <circle
                        cx={point.px}
                        cy={point.py}
                        r={selected ? 7.5 : point.searchResult ? 6 : 3.2}
                        fill={point.searchResult ? "#facc15" : color}
                        stroke={
                          selected
                            ? "#111827"
                            : point.searchResult
                              ? "#ca8a04"
                              : "#ffffff"
                        }
                        strokeWidth={
                          selected ? 2.4 : point.searchResult ? 1.8 : 0.8
                        }
                        opacity={point.searchResult ? 1 : 0.74}
                        style={{ cursor: "pointer" }}
                        onClick={() => selectVectorItem(point.vectorItemId)}
                      />
                      {point.searchResult && point.rank ? (
                        <text
                          x={point.px}
                          y={point.py + 3.8}
                          textAnchor="middle"
                          fontSize={9}
                          fill="#111827"
                          fontWeight={800}
                        >
                          {point.rank}
                        </text>
                      ) : null}
                      <title>
                        {`${point.label ?? point.vectorItemId}\n${point.targetType ?? "-"} / ${point.sourceId ?? "-"}\nscore: ${formatNumber(point.similarity)}\ntokens: ${point.tokenCount?.toLocaleString() ?? "-"}\ncontext: ${point.contextIncluded == null ? "-" : point.contextIncluded ? "included" : "excluded"}\ndistance: ${formatNumber(projectionDistance(chartModel.query, point))}\ncluster: ${point.clusterId ?? "-"}\n(${formatNumber(point.x)}, ${formatNumber(point.y)})`}
                      </title>
                    </g>
                  );
                })}

                {canShowQueryPoint && showQueryPoint && chartModel.query ? (
                  <g>
                    <polygon
                      points={`${chartModel.query.px},${chartModel.query.py - 12} ${chartModel.query.px + 4},${chartModel.query.py - 4} ${chartModel.query.px + 13},${chartModel.query.py - 3} ${chartModel.query.px + 6},${chartModel.query.py + 3} ${chartModel.query.px + 8},${chartModel.query.py + 12} ${chartModel.query.px},${chartModel.query.py + 7} ${chartModel.query.px - 8},${chartModel.query.py + 12} ${chartModel.query.px - 6},${chartModel.query.py + 3} ${chartModel.query.px - 13},${chartModel.query.py - 3} ${chartModel.query.px - 4},${chartModel.query.py - 4}`}
                      fill="#ef4444"
                      stroke="#991b1b"
                      strokeWidth={1.5}
                    />
                    <rect
                      x={chartModel.query.px - 28}
                      y={chartModel.query.py + 15}
                      width={56}
                      height={24}
                      rx={12}
                      fill="#ffffff"
                      stroke="#ef4444"
                    />
                    <text
                      x={chartModel.query.px}
                      y={chartModel.query.py + 31}
                      textAnchor="middle"
                      fontSize={11}
                      fill="#dc2626"
                      fontWeight={700}
                    >
                      Query
                    </text>
                  </g>
                ) : null}
              </svg>
            </Box>
          ) : (
            <Box
              sx={{
                height: 420,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                color: "text.secondary",
              }}
            >
              {projectionPointError
                ? "전체 맵을 불러오지 못했습니다. Query 분석 결과는 계속 표시할 수 있습니다."
                : pointsRequested
                  ? "표시할 좌표 데이터가 없습니다."
                  : "프로젝션을 선택하면 전체 맵을 자동으로 불러옵니다."}
            </Box>
          )}

          <Stack
            direction="row"
            spacing={1.2}
            useFlexGap
            flexWrap="wrap"
            sx={{ mt: 1.2 }}
          >
            {typeDistribution.map(([type, count]) => (
              <Chip
                key={type}
                size="small"
                label={`${type} ${count.toLocaleString()}`}
                sx={{
                  bgcolor: alpha(targetTypeColor(type), 0.1),
                  color: targetTypeColor(type),
                  borderColor: alpha(targetTypeColor(type), 0.35),
                }}
                variant="outlined"
              />
            ))}
          </Stack>
        </Box>

        {detailPanelOpen && selectedPoint ? (
          <Paper variant="outlined" sx={{ p: 2, order: { xs: 2, lg: 2 } }}>
            <Stack spacing={1.2}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
              >
                <Typography variant="subtitle2">선택 항목 상세 정보</Typography>
                <Stack direction="row" spacing={0.8} alignItems="center">
                  {detailLoading ? <CircularProgress size={18} /> : null}
                  <Tooltip title="상세 닫기">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setDetailOpen(false);
                        setControlsOpen(false);
                      }}
                    >
                      <CloseOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
              <Divider />

              <Stack spacing={1.1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {selectedPoint.rank ? (
                    <Chip
                      size="small"
                      color="warning"
                      label={`Top ${selectedPoint.rank}`}
                    />
                  ) : null}
                  {isFiniteNumber(selectedPoint.similarity) ? (
                    <Chip
                      size="small"
                      color="primary"
                      label={`Score ${formatNumber(selectedPoint.similarity)}`}
                    />
                  ) : null}
                  {selectedPoint.tokenCount != null ? (
                    <Chip
                      size="small"
                      color="info"
                      label={`${selectedPoint.tokenCount.toLocaleString()} tokens`}
                    />
                  ) : null}
                  {contextIncludedBadge(selectedPoint.contextIncluded)}
                </Stack>
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 700, wordBreak: "break-word" }}
                >
                  {selectedPoint.label ?? selectedPoint.vectorItemId}
                </Typography>
                <DetailLine
                  label="Object Type"
                  value={selectedPoint.targetType ?? "-"}
                />
                <DetailLine
                  label="Object ID"
                  value={selectedPoint.sourceId ?? "-"}
                />
                <DetailLine
                  label="Vector Item"
                  value={selectedPoint.vectorItemId}
                />
                <DetailLine
                  label="Cluster"
                  value={selectedPoint.clusterId ?? "-"}
                />
                <DetailLine
                  label="Coordinate"
                  value={`(${formatNumber(selectedPoint.x)}, ${formatNumber(selectedPoint.y)})`}
                />
                {chartModel.query ? (
                  <DetailLine
                    label="Query Distance"
                    value={formatNumber(
                      projectionDistance(chartModel.query, selectedPoint),
                    )}
                  />
                ) : null}
                <DetailLine
                  label="Token Count"
                  value={selectedPoint.tokenCount?.toLocaleString() ?? "-"}
                />
                <DetailLine
                  label="Context"
                  value={
                    selectedPoint.contextIncluded == null
                      ? "-"
                      : selectedPoint.contextIncluded
                        ? "CONTEXT INCLUDED"
                        : "CONTEXT EXCLUDED"
                  }
                />
                <Divider />
                {detail ? (
                  <>
                    <DetailLine
                      label="Model"
                      value={detail.embeddingModel ?? "-"}
                    />
                    <DetailLine
                      label="Dimension"
                      value={detail.dimension?.toLocaleString() ?? "-"}
                    />
                    <DetailLine
                      label="Detail Tokens"
                      value={
                        detail.tokenCount?.toLocaleString() ??
                        numberFromMetadata(detail.metadata, ["tokenCount"])?.toLocaleString() ??
                        "-"
                      }
                    />
                    <DetailLine
                      label="Created"
                      value={formatDateTime(detail.createdAt)}
                    />
                    <Typography variant="subtitle2">Chunk Text</Typography>
                    <Box
                      sx={{
                        maxHeight: 180,
                        overflow: "auto",
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 1,
                        p: 1,
                        bgcolor: "action.hover",
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                      >
                        {renderMetadata(detail.text)}
                      </Typography>
                    </Box>
                    <BorderlessAccordion title="Metadata">
                      <Box
                        component="pre"
                        sx={{
                          maxHeight: 150,
                          overflow: "auto",
                          m: 0,
                          p: 1,
                          fontSize: 12,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          bgcolor: "action.hover",
                          borderRadius: 1,
                        }}
                      >
                        {renderMetadata(detail.metadata)}
                      </Box>
                    </BorderlessAccordion>
                  </>
                ) : null}
                <Divider />
                <BorderlessAccordion
                  title="유사 Chunk (검색 결과 기준)"
                  defaultExpanded
                >
                  <List dense disablePadding>
                    {neighborRows.length === 0 ? (
                      <ListItem>
                        <ListItemText secondary="Query Projection 실행 후 유사 항목이 표시됩니다." />
                      </ListItem>
                    ) : (
                      neighborRows.map((row) => (
                        <ListItemButton
                          key={row.vectorItemId}
                          onClick={() => selectVectorItem(row.vectorItemId)}
                          sx={{ borderRadius: 1 }}
                        >
                          <ListItemText
                            primary={`${row.rank}. ${row.label ?? row.sourceId ?? row.vectorItemId}`}
                            secondary={`${row.targetType ?? "-"} · score ${formatNumber(row.similarity)} · distance ${formatNumber(row.distance)}`}
                            primaryTypographyProps={{ noWrap: true }}
                            secondaryTypographyProps={{ noWrap: true }}
                          />
                        </ListItemButton>
                      ))
                    )}
                  </List>
                </BorderlessAccordion>
              </Stack>
            </Stack>
          </Paper>
        ) : null}
      </Box>

      {!selectedProjectionReady && currentProjection ? (
        <Alert severity="info">
          COMPLETED 상태가 되면 좌표 목록과 2D 차트를 조회할 수 있습니다.
        </Alert>
      ) : null}
      {searchRequested && searchResult && searchResult.results.length === 0 ? (
        <Alert severity="info">
          Query Projection 결과가 없습니다. 전체 좌표 데이터는 계속 표시할 수
          있습니다.
        </Alert>
      ) : null}

      <Box>
        <Tabs
          value={resultTab}
          onChange={(_, value) => setResultTab(value as ResultTab)}
          sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
        >
          <Tab
            value="results"
            label={
              showingSearchRows
                ? `검색 결과 (${searchRows.length.toLocaleString()})`
                : `표시 Point (${pointRows.length.toLocaleString()})`
            }
          />
          <Tab value="metrics" label="분석 지표" />
        </Tabs>
        {resultTab === "results" ? (
          <GridContent<VectorResultRow>
            columns={resultColumnDefs}
            rowData={resultRows}
            height={320}
            loading={projectionPointLoading || searchLoading}
            options={resultGridOptions}
          />
        ) : (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.2}
            useFlexGap
            flexWrap="wrap"
            sx={{ p: 2 }}
          >
            <MetricCard
              label="전체 Point"
              value={metrics.totalPoints.toLocaleString()}
            />
            <MetricCard
              label="표시 Point"
              value={metrics.visiblePoints.toLocaleString()}
            />
            <MetricCard
              label="검색 결과"
              value={metrics.searchCount.toLocaleString()}
            />
            <MetricCard
              label="Max Similarity"
              value={formatNumber(metrics.max)}
            />
            <MetricCard
              label="Avg Similarity"
              value={formatNumber(metrics.avg)}
            />
            <MetricCard
              label="Min Similarity"
              value={formatNumber(metrics.min)}
            />
            <MetricCard
              label="Cluster 수"
              value={metrics.clusterCount.toLocaleString()}
            />
            <Card variant="outlined" sx={{ minWidth: 240, p: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Object Type Distribution
              </Typography>
              <Stack spacing={0.6} sx={{ mt: 1 }}>
                {typeDistribution.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    -
                  </Typography>
                ) : (
                  typeDistribution.map(([type, count]) => (
                    <Stack
                      key={type}
                      direction="row"
                      justifyContent="space-between"
                      spacing={1}
                    >
                      <Typography variant="body2">{type}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {count.toLocaleString()}
                      </Typography>
                    </Stack>
                  ))
                )}
              </Stack>
            </Card>
          </Stack>
        )}
      </Box>

      <Dialog
        open={createOpen}
        fullWidth
        maxWidth="sm"
        onClose={closeCreateDialog}
      >
        <DialogTitle>시각화 데이터 생성</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={1.2}>
            <TextField
              label="이름"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              fullWidth
              size="small"
              autoFocus
            />
            <TextField
              select
              label="알고리즘"
              value={createAlgorithm}
              onChange={(event) =>
                setCreateAlgorithm(
                  event.target.value as (typeof ALGORITHM_OPTIONS)[number],
                )
              }
              fullWidth
              size="small"
            >
              {ALGORITHM_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Object Type"
              placeholder="예: NCS,COURSE"
              value={createTargetTypes}
              onChange={(event) => setCreateTargetTypes(event.target.value)}
              fullWidth
              size="small"
              helperText="비워두면 전체 대상에 대해 생성합니다."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCreateDialog} disabled={creating}>
            취소
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleCreateProjection()}
            disabled={creating || !createReady}
          >
            생성
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function SummaryMetric({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <Box
      sx={{
        minWidth: wide ? { xs: "100%", md: 220 } : 116,
        px: 1.4,
        py: 0.8,
        borderLeft: 1,
        borderColor: "divider",
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
    </Box>
  );
}

function BorderlessAccordion({
  title,
  children,
  defaultExpanded = false,
}: {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}) {
  return (
    <Accordion
      disableGutters
      elevation={0}
      defaultExpanded={defaultExpanded}
      sx={{
        bgcolor: "transparent",
        "&:before": { display: "none" },
        "& .MuiAccordionSummary-root": {
          minHeight: 32,
          px: 0,
        },
        "& .MuiAccordionSummary-content": {
          my: 0.4,
        },
        "& .MuiAccordionDetails-root": {
          px: 0,
          pt: 0.4,
          pb: 0,
        },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreOutlined fontSize="small" />}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 800, textTransform: "uppercase" }}
        >
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>{children}</AccordionDetails>
    </Accordion>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      justifyContent="space-between"
      alignItems="flex-start"
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ minWidth: 96 }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ fontWeight: 600, textAlign: "right", wordBreak: "break-word" }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card variant="outlined" sx={{ minWidth: 132, p: 1.5 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6" color="primary.main" sx={{ mt: 0.4 }}>
        {value}
      </Typography>
    </Card>
  );
}
