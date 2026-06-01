import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColDef, ICellRendererParams, RowSelectedEvent, SelectionChangedEvent, SortModelItem } from "ag-grid-community";
import {
  alpha,
  Alert,
  Box,
  Button,
  Card,
  CardActions,
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
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepButton,
  Stepper,
  Slider,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  ButtonGroup,
  useTheme,
} from "@mui/material";
import {
  AddOutlined,
  DoneOutlined,
  DriveFileMoveOutlined,
  NoiseControlOffOutlined,
  RemoveOutlined,
  SaveOutlined,
  TravelExploreOutlined,
  HubOutlined,
  DraftsOutlined,
  RateReviewOutlined,
  CompareArrowsOutlined,
  ReportGmailerrorredOutlined,
  BubbleChartOutlined,
  PlaylistPlayOutlined,
  CategoryOutlined,
  InsightsOutlined,
  HistoryOutlined,
  AccountTreeOutlined,
  FolderOutlined,
  SearchOutlined,
  CloseOutlined,
  HelpOutlineOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  RestartAltOutlined,
  ChevronRight,
  ExpandMore,
  UnfoldMoreOutlined,
  UnfoldLessOutlined,
  DragHandleOutlined,
} from "@mui/icons-material";
import { GridContent, PageableGridContent } from "@/react/components/ag-grid";
import type { AgGridCompatibleDataSource, PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { ObjectTypeSelect } from "@/react/components/objecttype/ObjectTypeSelect";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { useAuthStore } from "@/react/auth/store";
import { useThemeMode } from "@/react/theme/AppThemeProvider";
import { useConfirm, useToast } from "@/react/feedback";
import { resolveAxiosError } from "@/utils/helpers";
import { StompRealtimeClient } from "@/data/studio/mgmt/realtime";
import {
  skillGraphApi,
  type SkillClusterRepresentative,
  type SkillCategoryReconcileResult,
  type SkillDictionaryEmbeddingJob,
  type SkillDictionaryEmbeddingJobStatus,
  type SkillGraphBatchJobEvent,
  type SkillGraphProjectionSummary,
  type SkillCluster,
  type SkillClusterMember,
} from "@/react/pages/ai/skillgraph/api";
import {
  DetailDrawer,
  EmptyState,
  ErrorState,
  EvidenceBlock,
  LoadingState,
  MetricCard,
  ScoreBadge,
  SkillGraphLayout,
  StatusBadge,
} from "@/react/pages/ai/skillgraph/components";
import {
  canAdminSkillGraph,
  canReviewSkillGraph,
  canRunSkillGraphOperations,
} from "@/react/pages/ai/skillgraph/permissions";
import { skillGraphQueryKeys } from "@/react/pages/ai/skillgraph/queryKeys";
import type {
  SkillCandidate,
  SkillCandidateStatus,
  SkillCategory,
  SkillCategoryGraph,
  SkillCategoryParentSuggestion,
  SkillClusterPoint,
  SkillDictionaryItem,
  SkillGraphJob,
  SkillGraphListParams,
  SkillGraphPageResponse,
  SkillGraphSimulationResponse,
  SkillMapping,
  SkillRecommendationApplyResult,
  SkillRecommendationJob,
  SkillRecommendationResult,
  SkillRagChunkPreview,
  SkillRagExtractionJobItem,
  SkillRelation,
  SkillRelationType,
} from "@/types/studio/skillgraph";

const PAGE_SIZE = 100;
const DICTIONARY_FETCH_LIMIT = 500;
const SKILLGRAPH_PROJECTION_POINT_LIMIT = 1000;
const PROJECTION_POINT_HOVER_LOOKUP_DELAY_MS = 180;
const RAG_CHUNK_PAGE_SIZE = 50;
const RAG_EXTRACTION_RECENT_JOB_IDS_KEY = "skillgraph.ragExtraction.recentJobIds";
const SIMULATION_TEXT_MAX_LENGTH = 200000;
const DEFAULT_AUTO_APPROVE_CONFIDENCE_THRESHOLD = 0.7;
const DEFAULT_AUTO_APPROVE_SIMILARITY_THRESHOLD = 0.9;
const DEFAULT_RECOMMENDATION_MIN_SCORE = 0.75;
const DEFAULT_RECOMMENDATION_NEW_SKILL_CONFIDENCE = 0.8;
const DEFAULT_RECOMMENDATION_EXISTING_SKILL_SCORE = 0.92;
const relationTypes: (SkillRelationType | "")[] = ["", "RELATED", "PREREQUISITE", "ALTERNATIVE", "USED_WITH", "PART_OF"];
const simulationTabs = ["extraction", "similarity", "clustering", "graph", "ncs-mapping", "course-recommendation"] as const;
const simulationSteps: { value: (typeof simulationTabs)[number]; label: string }[] = [
  { value: "extraction", label: "스킬 추출" },
  { value: "similarity", label: "유사도" },
  { value: "clustering", label: "클러스터링" },
  { value: "graph", label: "그래프" },
  { value: "ncs-mapping", label: "NCS 매핑" },
  { value: "course-recommendation", label: "과정 추천" },
];

function pageTotal<T>(response: SkillGraphPageResponse<T>, startRow: number, endRow: number, rows: T[]) {
  return response.totalElements ?? response.total ?? (response.hasMore ? endRow + 1 : startRow + rows.length);
}

class SkillGraphDictionaryDataSource implements AgGridCompatibleDataSource<SkillDictionaryItem> {
  isLoaded = false;
  loading = false;
  error: unknown = null;
  dataItems: SkillDictionaryItem[] = [];
  total = 0;
  pageSize = 15;
  page = 0;

  private filter: SkillGraphListParams = {};
  private sort = "name,asc";

  setPage(page: number) {
    this.page = page;
  }

  setPageSize(pageSize: number) {
    this.pageSize = pageSize;
  }

  setSort(sortModel?: SortModelItem[]) {
    this.sort = dictionarySortParams(sortModel);
  }

  setSearch(keyword?: string) {
    this.setFilter(keyword);
  }

  setFilter(keyword?: string) {
    const trimmed = keyword?.trim();
    this.filter = trimmed ? { ...this.filter, keyword: trimmed } : { ...this.filter, keyword: undefined };
  }

  applyFilter(filter: SkillGraphListParams) {
    this.filter = filter ?? {};
  }

  async fetch() {
    const offset = this.page * this.pageSize;
    const result = await this.fetchForAgGrid({
      startRow: offset,
      endRow: offset + this.pageSize,
    });
    this.dataItems = result.rows;
    this.total = result.total;
    this.isLoaded = true;
  }

  async fetchForAgGrid({
    startRow,
    endRow,
    sortModel,
    filterModel,
  }: {
    startRow: number;
    endRow: number;
    sortModel?: SortModelItem[];
    filterModel?: Record<string, unknown>;
  }) {
    const limit = endRow - startRow || this.pageSize;
    const page = Math.floor(startRow / Math.max(1, limit));
    if (sortModel) {
      this.setSort(sortModel);
    }
    this.loading = true;
    try {
      const response = await skillGraphApi.listDictionary({
        ...this.filter,
        ...dictionaryFilterParams(filterModel),
        page,
        size: limit,
        sort: this.sort,
      });
      const rows = listFrom<SkillDictionaryItem>(response);
      const pageResponse = response as SkillGraphPageResponse<SkillDictionaryItem>;
      const total = pageTotal(pageResponse, startRow, endRow, rows);
      this.dataItems = rows;
      this.total = total;
      this.isLoaded = true;
      return { rows, total };
    } catch (error) {
      this.error = error;
      throw error;
    } finally {
      this.loading = false;
    }
  }
}

function dictionarySortParams(sortModel?: SortModelItem[]) {
  if (!sortModel?.length) {
    return "name,asc";
  }
  const sort = sortModel
    .map((item) => {
      const field = dictionarySortField(item.colId);
      return field ? `${field},${item.sort === "desc" ? "desc" : "asc"}` : null;
    })
    .filter((item): item is string => Boolean(item));
  return sort[0] ?? "name,asc";
}

function dictionarySortField(colId?: string) {
  switch (colId) {
    case "skillName":
      return "name";
    case "normalizedName":
    case "status":
    case "categoryId":
    case "createdAt":
    case "updatedAt":
      return colId;
    case "categoryName":
      return "categoryId";
    default:
      return null;
  }
}

function dictionaryFilterParams(filterModel?: Record<string, unknown>): SkillGraphListParams {
  if (!filterModel || Object.keys(filterModel).length === 0) {
    return {};
  }
  const params: SkillGraphListParams = {};
  const nameFilter = textFilterValue(filterModel.skillName) ?? textFilterValue(filterModel.normalizedName);
  const statusFilter = textFilterValue(filterModel.status);
  const categoryFilter = textFilterValue(filterModel.categoryId);
  if (nameFilter) {
    params.keyword = nameFilter;
  }
  if (statusFilter) {
    params.status = statusFilter;
  }
  if (categoryFilter) {
    params.categoryId = categoryFilter;
  }
  return params;
}

function textFilterValue(filter: unknown) {
  if (!filter || typeof filter !== "object") {
    return undefined;
  }
  const value = filter as { filter?: unknown; values?: unknown[] };
  if (typeof value.filter === "string") {
    return value.filter.trim() || undefined;
  }
  if (Array.isArray(value.values) && value.values.length === 1 && typeof value.values[0] === "string") {
    return value.values[0].trim() || undefined;
  }
  return undefined;
}

class SkillGraphCandidateDataSource implements AgGridCompatibleDataSource<SkillCandidate> {
  isLoaded = false;
  loading = false;
  error: unknown = null;
  dataItems: SkillCandidate[] = [];
  total = 0;
  pageSize = 15;
  page = 0;

  private filter: SkillGraphListParams = {};
  private sort = "createdAt,desc";

  setPage(page: number) {
    this.page = page;
  }

  setPageSize(pageSize: number) {
    this.pageSize = pageSize;
  }

  setSort(sortModel?: SortModelItem[]) {
    this.sort = candidateSortParams(sortModel);
  }

  setSearch(keyword?: string) {
    this.setFilter(keyword);
  }

  setFilter(keyword?: string) {
    const trimmed = keyword?.trim();
    this.filter = trimmed ? { ...this.filter, keyword: trimmed } : { ...this.filter, keyword: undefined };
  }

  applyFilter(filter: SkillGraphListParams) {
    this.filter = filter ?? {};
  }

  async fetch() {
    const offset = this.page * this.pageSize;
    const result = await this.fetchForAgGrid({
      startRow: offset,
      endRow: offset + this.pageSize,
    });
    this.dataItems = result.rows;
    this.total = result.total;
    this.isLoaded = true;
  }

  async fetchForAgGrid({
    startRow,
    endRow,
    sortModel,
    filterModel,
  }: {
    startRow: number;
    endRow: number;
    sortModel?: SortModelItem[];
    filterModel?: Record<string, unknown>;
  }) {
    const limit = endRow - startRow || this.pageSize;
    const page = Math.floor(startRow / Math.max(1, limit));
    if (sortModel) {
      this.setSort(sortModel);
    }
    this.loading = true;
    try {
      const response = await skillGraphApi.listCandidates({
        ...this.filter,
        ...candidateFilterParams(filterModel),
        page,
        size: limit,
        sort: this.sort,
      });
      const rows = listFrom<SkillCandidate>(response);
      const pageResponse = response as SkillGraphPageResponse<SkillCandidate>;
      const total = pageTotal(pageResponse, startRow, endRow, rows);
      this.dataItems = rows;
      this.total = total;
      this.isLoaded = true;
      return { rows, total };
    } catch (error) {
      this.error = error;
      throw error;
    } finally {
      this.loading = false;
    }
  }
}

function candidateSortParams(sortModel?: SortModelItem[]) {
  if (!sortModel?.length) {
    return "createdAt,desc";
  }
  const sort = sortModel
    .map((item) => {
      const field = candidateSortField(item.colId);
      return field ? `${field},${item.sort === "desc" ? "desc" : "asc"}` : null;
    })
    .filter((item): item is string => Boolean(item));
  return sort[0] ?? "createdAt,desc";
}

function candidateSortField(colId?: string) {
  switch (colId) {
    case "rawText":
      return "term";
    case "normalizedText":
      return "normalizedTerm";
    case "searchText":
    case "skillType":
    case "difficulty":
    case "embedded":
    case "status":
    case "matchedSkillName":
    case "similarityScore":
    case "confidenceScore":
    case "createdAt":
      return colId;
    default:
      return null;
  }
}

function candidateFilterParams(filterModel?: Record<string, unknown>): SkillGraphListParams {
  if (!filterModel || Object.keys(filterModel).length === 0) {
    return {};
  }
  const params: SkillGraphListParams = {};
  const keyword = textFilterValue(filterModel.rawText)
    ?? textFilterValue(filterModel.normalizedText)
    ?? textFilterValue(filterModel.searchText)
    ?? textFilterValue(filterModel.target)
    ?? textFilterValue(filterModel.matchedSkillName);
  const status = textFilterValue(filterModel.status);
  const skillType = textFilterValue(filterModel.skillType);
  if (keyword) {
    params.keyword = keyword;
  }
  if (status) {
    params.status = status;
  }
  if (skillType) {
    params.skillType = skillType;
  }
  return params;
}

class SkillGraphCategoryDataSource implements AgGridCompatibleDataSource<SkillCategory> {
  isLoaded = false;
  loading = false;
  error: unknown = null;
  dataItems: SkillCategory[] = [];
  total = 0;
  pageSize = 50;
  page = 0;

  private filter: SkillGraphListParams = {};

  setPage(page: number) {
    this.page = page;
  }

  setPageSize(pageSize: number) {
    this.pageSize = pageSize;
  }

  setSort() {
  }

  setSearch(keyword?: string) {
    this.setFilter(keyword);
  }

  setFilter(keyword?: string) {
    const trimmed = keyword?.trim();
    this.filter = trimmed ? { ...this.filter, keyword: trimmed } : { ...this.filter, keyword: undefined };
  }

  applyFilter(filter: SkillGraphListParams) {
    this.filter = filter ?? {};
  }

  async fetch() {
    const offset = this.page * this.pageSize;
    const result = await this.fetchForAgGrid({ startRow: offset, endRow: offset + this.pageSize });
    this.dataItems = result.rows;
    this.total = result.total;
    this.isLoaded = true;
  }

  async fetchForAgGrid({ startRow, endRow }: { startRow: number; endRow: number }) {
    const size = endRow - startRow || this.pageSize;
    const page = Math.floor(startRow / Math.max(1, size));
    this.loading = true;
    try {
      const response = await skillGraphApi.listCategories({
        ...this.filter,
        page,
        size,
        sort: ["displayOrder,asc", "name,asc"],
      });
      const rows = listFrom<SkillCategory>(response);
      const total = pageTotal(response as SkillGraphPageResponse<SkillCategory>, startRow, endRow, rows);
      this.dataItems = rows;
      this.total = total;
      this.isLoaded = true;
      return { rows, total };
    } catch (error) {
      this.error = error;
      throw error;
    } finally {
      this.loading = false;
    }
  }
}

class SkillRecommendationResultDataSource implements AgGridCompatibleDataSource<SkillRecommendationResult> {
  isLoaded = false;
  loading = false;
  error: unknown = null;
  dataItems: SkillRecommendationResult[] = [];
  total = 0;
  pageSize = 15;
  page = 0;
  private jobId = "";

  setJobId(jobId: string) {
    this.jobId = jobId;
  }

  setPage(page: number) {
    this.page = page;
  }

  setPageSize(pageSize: number) {
    this.pageSize = pageSize;
  }

  setSort() {
  }

  setSearch() {
  }

  async fetch() {
    const offset = this.page * this.pageSize;
    const result = await this.fetchForAgGrid({ startRow: offset, endRow: offset + this.pageSize });
    this.dataItems = result.rows;
    this.total = result.total;
    this.isLoaded = true;
  }

  async fetchForAgGrid({ startRow, endRow }: { startRow: number; endRow: number }) {
    if (!this.jobId) {
      return { rows: [], total: 0 };
    }
    const size = endRow - startRow || this.pageSize;
    const page = Math.floor(startRow / Math.max(1, size));
    this.loading = true;
    try {
      const response = await skillGraphApi.listRecommendationJobResults(this.jobId, {
        page,
        size,
        sort: "createdAt,asc",
      });
      const rows = listFrom<SkillRecommendationResult>(response);
      const total = pageTotal(response as SkillGraphPageResponse<SkillRecommendationResult>, startRow, endRow, rows);
      this.dataItems = rows;
      this.total = total;
      this.isLoaded = true;
      return { rows, total };
    } catch (error) {
      this.error = error;
      throw error;
    } finally {
      this.loading = false;
    }
  }
}

function useSkillGraphRoles() {
  const roles = useAuthStore((state) => state.user?.roles);
  return {
    roles,
    canOperate: canRunSkillGraphOperations(roles),
    canReview: canReviewSkillGraph(roles),
    canAdmin: canAdminSkillGraph(roles),
  };
}

function listFrom<T>(response: unknown): T[] {
  return skillGraphApi.pageItems(response as any) as T[];
}

function keyParams(params: SkillGraphListParams) {
  return params as Record<string, string | number | boolean | null | undefined>;
}

function listQueryKey(resource: string, params: SkillGraphListParams) {
  return [...skillGraphQueryKeys.lists(), resource, keyParams(params)] as const;
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function numberValue(value?: number) {
  return value == null ? "-" : value.toLocaleString();
}

function isActiveJob(job?: SkillGraphJob | null) {
  return job?.status === "RUNNING" || job?.status === "READY";
}

function readRecentRagExtractionJobIds() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RAG_EXTRACTION_RECENT_JOB_IDS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function writeRecentRagExtractionJobIds(jobIds: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RAG_EXTRACTION_RECENT_JOB_IDS_KEY, JSON.stringify(jobIds.slice(0, 20)));
}

function rememberRecentRagExtractionJobId(jobId: string | number) {
  const value = String(jobId);
  const next = [value, ...readRecentRagExtractionJobIds().filter((id) => id !== value)];
  writeRecentRagExtractionJobIds(next);
  return next;
}

function PageFrame({
  title,
  label,
  actions,
  searchPlaceholder,
  searchValue,
  onSearchValueChange,
  onSearch,
  onRefresh,
  children,
}: {
  title: string;
  label?: string;
  actions?: React.ReactNode;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  onRefresh?: () => void;
  children: React.ReactNode;
}) {
  return (
    <SkillGraphLayout>
      <Stack spacing={2}>
        <PageToolbar
          breadcrumbs={["서비스 관리", "AI", "SkillGraph", title]}
          title={title}
          label={label}
          actions={actions}
          searchPlaceholder={searchPlaceholder}
          searchValue={searchValue}
          onSearchValueChange={onSearchValueChange}
          onSearch={onSearch}
          onRefresh={onRefresh}
        />
        {children}
      </Stack>
    </SkillGraphLayout>
  );
}

function DetailRows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <Stack spacing={1.25}>
      {rows.map(([label, value]) => (
        <Box key={label}>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Box sx={{ mt: 0.25 }}>{value ?? "-"}</Box>
        </Box>
      ))}
    </Stack>
  );
}

function EmbeddingMetadataTable({ embeddings }: { embeddings?: { embeddingProvider?: string; embeddingModel?: string; embeddingDimension?: number; createdAt?: string }[] }) {
  if (!embeddings?.length) {
    return <Typography variant="body2" color="text.secondary">-</Typography>;
  }
  return (
    <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <Box component="thead">
        <Box component="tr" sx={{ "& th": { textAlign: "left", color: "text.secondary", fontWeight: 600, py: 0.75, borderBottom: 1, borderColor: "divider" } }}>
          <Box component="th">Provider</Box>
          <Box component="th">Model</Box>
          <Box component="th">Dim</Box>
          <Box component="th">생성일</Box>
        </Box>
      </Box>
      <Box component="tbody">
        {embeddings.map((embedding, index) => (
          <Box component="tr" key={`${embedding.embeddingProvider ?? "-"}-${embedding.embeddingModel ?? "-"}-${index}`} sx={{ "& td": { py: 0.75, borderBottom: 1, borderColor: "divider" } }}>
            <Box component="td">{embedding.embeddingProvider ?? "-"}</Box>
            <Box component="td">{embedding.embeddingModel ?? "-"}</Box>
            <Box component="td">{embedding.embeddingDimension ?? "-"}</Box>
            <Box component="td">{formatDate(embedding.createdAt)}</Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function SelectionCheckbox({
  checked,
  indeterminate = false,
  ariaLabel,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  ariaLabel: string;
  onChange: (checked: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={inputRef}
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
      style={{
        width: 16,
        height: 16,
        margin: 0,
        accentColor: "#1565c0",
        cursor: "pointer",
      }}
    />
  );
}

function getDisplayedSelectionState(api: {
  getLastDisplayedRowIndex: () => number;
  getDisplayedRowAtIndex: (index: number) => { isSelected: () => boolean; setSelected: (selected: boolean) => void } | undefined;
}) {
  const lastIndex = api.getLastDisplayedRowIndex();
  if (lastIndex < 0) {
    return { displayedCount: 0, selectedCount: 0 };
  }

  let displayedCount = 0;
  let selectedCount = 0;
  for (let index = 0; index <= lastIndex; index += 1) {
    const row = api.getDisplayedRowAtIndex(index);
    if (!row) continue;
    displayedCount += 1;
    if (row.isSelected()) selectedCount += 1;
  }
  return { displayedCount, selectedCount };
}

function toggleDisplayedRows(
  api: {
    getLastDisplayedRowIndex: () => number;
    getDisplayedRowAtIndex: (index: number) => { isSelected: () => boolean; setSelected: (selected: boolean) => void } | undefined;
  },
  selected: boolean
) {
  const lastIndex = api.getLastDisplayedRowIndex();
  for (let index = 0; index <= lastIndex; index += 1) {
    api.getDisplayedRowAtIndex(index)?.setSelected(selected);
  }
}

function renderSelectionHeader(api?: {
  getLastDisplayedRowIndex: () => number;
  getDisplayedRowAtIndex: (index: number) => { isSelected: () => boolean; setSelected: (selected: boolean) => void } | undefined;
}) {
  const state = api ? getDisplayedSelectionState(api) : { displayedCount: 0, selectedCount: 0 };
  const allSelected = state.displayedCount > 0 && state.selectedCount === state.displayedCount;
  const partiallySelected = state.selectedCount > 0 && state.selectedCount < state.displayedCount;

  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <SelectionCheckbox
        ariaLabel="전체 선택"
        checked={allSelected}
        indeterminate={partiallySelected}
        onChange={() => api && toggleDisplayedRows(api, !allSelected)}
      />
    </Box>
  );
}

type CandidateSelectionGridApi = {
  getDisplayedRowCount: () => number;
  getLastDisplayedRowIndex: () => number;
  getDisplayedRowAtIndex: (index: number) => { isSelected: () => boolean; data?: SkillCandidate } | undefined;
  deselectAll?: () => void;
  refreshHeader?: () => void;
};

function CandidateSelectionCell({
  params,
  checked,
  onChange,
}: {
  params: ICellRendererParams<SkillCandidate>;
  checked: boolean;
  onChange: (candidateId: string | number, checked: boolean) => void;
}) {
  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <SelectionCheckbox
        ariaLabel="행 선택"
        checked={checked}
        onChange={(nextChecked) => {
          params.node.setSelected(nextChecked);
          const candidateId = params.data?.candidateId;
          if (candidateId !== undefined && candidateId !== null) {
            onChange(candidateId, nextChecked);
          }
        }}
      />
    </Box>
  );
}

function candidateConfidence(candidate: SkillCandidate) {
  return candidate.confidenceScore ?? candidate.confidence ?? 0;
}

function candidateSimilarity(candidate: SkillCandidate) {
  return candidate.similarityScore ?? candidate.matchedSkill?.similarityScore ?? 0;
}

function candidateTechnologyLabel(candidate?: SkillCandidate | null) {
  const values = candidate?.technology?.filter(Boolean) ?? [];
  return values.length > 0 ? values.join(", ") : "-";
}

function recommendationTypeLabel(value?: string) {
  const labels: Record<string, string> = {
    EXISTING_SKILL_MATCH: "기존 스킬 연결",
    DUPLICATE_CANDIDATE: "중복 후보",
    SIMILAR_CANDIDATE: "유사 후보",
    NCS_MAPPING_CANDIDATE: "NCS 추천",
    NEW_SKILL_CANDIDATE: "신규 스킬",
    REVIEW_REQUIRED: "검토 필요",
    LOW_CONFIDENCE: "낮은 신뢰도",
  };
  return value ? labels[value] ?? value : "-";
}

function hasMatchedSkill(candidate: SkillCandidate) {
  return Boolean(candidate.matchedSkillId ?? candidate.matchedSkill?.skillId);
}

function isAutoApprovableCandidate(candidate: SkillCandidate, confidenceThreshold: number, similarityThreshold: number) {
  return candidate.status === "PENDING"
    && hasMatchedSkill(candidate)
    && candidateConfidence(candidate) >= confidenceThreshold
    && candidateSimilarity(candidate) >= similarityThreshold;
}

function RagExtractionDialog({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted: (job?: SkillGraphJob) => void;
}) {
  const [objectType, setObjectType] = useState("");
  const [objectId, setObjectId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [chunkQuery, setChunkQuery] = useState("");
  const [chunks, setChunks] = useState<SkillRagChunkPreview[]>([]);
  const [chunkOffset, setChunkOffset] = useState(0);
  const [chunkReturned, setChunkReturned] = useState(0);
  const [chunkTotal, setChunkTotal] = useState<number | undefined>(undefined);
  const [chunkHasMore, setChunkHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const chunkColumns = useMemo<ColDef<SkillRagChunkPreview>[]>(
    () => [
      {
        field: "chunkOrder",
        headerName: "순서",
        width: 76,
        minWidth: 72,
        filter: false,
        type: "numericColumn",
      },
      {
        field: "page",
        headerName: "페이지",
        width: 86,
        minWidth: 78,
        filter: false,
        type: "numericColumn",
      },
      {
        field: "section",
        headerName: "섹션",
        width: 140,
        minWidth: 110,
        filter: false,
      },
      {
        field: "textPreview",
        headerName: "Preview",
        flex: 1,
        minWidth: 260,
        filter: false,
        tooltipField: "textPreview",
      },
      {
        field: "tokenCount",
        headerName: "Token",
        width: 92,
        minWidth: 84,
        filter: false,
        type: "numericColumn",
      },
      {
        field: "textLength",
        headerName: "길이",
        width: 86,
        minWidth: 78,
        filter: false,
        type: "numericColumn",
      },
      {
        field: "warningStatus",
        headerName: "경고",
        width: 92,
        minWidth: 84,
        filter: false,
        cellRenderer: (params: { value?: string }) => params.value ? (
          <Chip size="small" color="warning" label={params.value} />
        ) : "-",
      },
      {
        field: "documentId",
        headerName: "Document ID",
        width: 150,
        minWidth: 130,
        filter: false,
        tooltipField: "documentId",
      },
      {
        field: "chunkId",
        headerName: "Chunk ID",
        width: 180,
        minWidth: 150,
        filter: false,
        tooltipField: "chunkId",
      },
    ],
    []
  );
  const chunkGridOptions = useMemo(
    () => ({
      getRowId: (params: { data?: SkillRagChunkPreview }) => params.data?.chunkId ?? "",
      suppressCellFocus: true,
    }),
    []
  );

  useEffect(() => {
    if (!open) {
      setChunks([]);
      setChunkOffset(0);
      setChunkReturned(0);
      setChunkTotal(undefined);
      setChunkHasMore(false);
      setError("");
      setLoading(false);
      setSubmitting(false);
    }
  }, [open]);

  async function loadChunks(nextOffset = 0) {
    if (!objectType.trim() || !objectId.trim()) {
      setError("objectType과 objectId를 입력하세요.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const page = await skillGraphApi.listRagChunks({
        objectType: objectType.trim(),
        objectId: objectId.trim(),
        documentId: documentId.trim() || undefined,
        q: chunkQuery.trim() || undefined,
        offset: Math.max(0, nextOffset),
        limit: RAG_CHUNK_PAGE_SIZE,
      });
      const pageChunks = page.items ?? [];
      setChunks(pageChunks);
      setChunkOffset(page.offset ?? Math.max(0, nextOffset));
      setChunkReturned(page.returned ?? pageChunks.length);
      setChunkTotal(page.total);
      setChunkHasMore(Boolean(page.hasMore));
      if (!pageChunks.length) {
        setError("조회된 RAG chunk가 없습니다.");
      }
    } catch (err) {
      setError(resolveAxiosError(err) || "RAG chunk 조회에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function submitExtraction() {
    if (!chunks.length) {
      setError("먼저 RAG chunk를 조회하세요.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await skillGraphApi.extractRag({
        objectType: objectType.trim(),
        objectId: objectId.trim(),
        documentId: documentId.trim() || undefined,
        mode: "SELECTED_CHUNKS",
        chunkIds: chunks.map((chunk) => chunk.chunkId),
      });
      onSubmitted("jobId" in response ? response : undefined);
      onClose();
    } catch (err) {
      setError(resolveAxiosError(err) || "SkillGraph 추출 작업 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAllExtraction() {
    if (!objectType.trim() || !objectId.trim()) {
      setError("objectType과 objectId를 입력하세요.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await skillGraphApi.extractRag({
        objectType: objectType.trim(),
        objectId: objectId.trim(),
        documentId: documentId.trim() || undefined,
        mode: "ALL_CHUNKS",
        limit: 5000,
      });
      onSubmitted("jobId" in response ? response : undefined);
      onClose();
    } catch (err) {
      setError(resolveAxiosError(err) || "SkillGraph 추출 작업 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={loading || submitting ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>RAG에서 추출</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">
            서버의 SkillGraph RAG API로 chunk preview를 page 단위 조회하고, 선택한 현재 페이지 chunk ID 또는 전체 문서
            기준으로 추출 작업을 등록합니다.
          </Alert>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <ObjectTypeSelect
              value={objectType}
              onChange={(value) => {
                setObjectType(value);
                setChunks([]);
                setChunkOffset(0);
                setChunkReturned(0);
                setChunkTotal(undefined);
                setChunkHasMore(false);
              }}
              label="objectType"
              placeholder="객체유형 선택"
              includeAll={false}
              sx={{ minWidth: 240 }}
            />
            <TextField
              label="objectId"
              size="small"
              value={objectId}
              onChange={(event) => {
                setObjectId(event.target.value);
                setChunks([]);
                setChunkOffset(0);
                setChunkReturned(0);
                setChunkTotal(undefined);
                setChunkHasMore(false);
              }}
              fullWidth
            />
            <Button
              variant="outlined"
              startIcon={<TravelExploreOutlined />}
              onClick={() => void loadChunks(0)}
              disabled={loading || submitting}
              sx={{ minWidth: 118, whiteSpace: "nowrap", flexShrink: 0 }}
            >
              Chunk 조회
            </Button>
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="documentId"
              size="small"
              value={documentId}
              onChange={(event) => {
                setDocumentId(event.target.value);
                setChunks([]);
                setChunkOffset(0);
                setChunkReturned(0);
                setChunkTotal(undefined);
                setChunkHasMore(false);
              }}
              fullWidth
            />
            <TextField
              label="chunk 검색어"
              size="small"
              value={chunkQuery}
              onChange={(event) => {
                setChunkQuery(event.target.value);
                setChunks([]);
                setChunkOffset(0);
                setChunkReturned(0);
                setChunkTotal(undefined);
                setChunkHasMore(false);
              }}
              fullWidth
            />
          </Stack>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2" sx={{ flex: 1 }}>
                현재 페이지 chunk
              </Typography>
              <Chip size="small" label={`${chunks.length.toLocaleString()}개`} />
            </Stack>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
              sx={{ mt: 1 }}
            >
              <Typography variant="caption" color="text.secondary">
                offset {chunkOffset.toLocaleString()} · returned {chunkReturned.toLocaleString()} · page size{" "}
                {RAG_CHUNK_PAGE_SIZE.toLocaleString()}
                {chunkTotal == null ? "" : ` · total ${chunkTotal.toLocaleString()}`}
              </Typography>
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button
                  size="small"
                  variant="outlined"
                  disabled={loading || submitting || chunkOffset <= 0}
                  onClick={() => void loadChunks(Math.max(0, chunkOffset - RAG_CHUNK_PAGE_SIZE))}
                >
                  이전
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={loading || submitting || !chunkHasMore}
                  onClick={() => void loadChunks(chunkOffset + RAG_CHUNK_PAGE_SIZE)}
                >
                  다음
                </Button>
              </Stack>
            </Stack>
            <Box sx={{ mt: 1 }}>
              {chunks.length || loading ? (
                <GridContent<SkillRagChunkPreview>
                  columns={chunkColumns}
                  options={chunkGridOptions}
                  rowData={chunks}
                  loading={loading}
                  height={260}
                />
              ) : (
                <Box
                  sx={{
                    minHeight: 160,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "action.hover",
                    borderRadius: 1,
                    px: 2,
                    textAlign: "center",
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    objectType/objectId를 입력하고 chunk를 조회하세요.
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading || submitting}>
          취소
        </Button>
        <Button
          variant="outlined"
          onClick={() => void submitAllExtraction()}
          disabled={!objectType.trim() || !objectId.trim() || loading || submitting}
        >
          전체 문서 작업 등록
        </Button>
        <Button
          variant="contained"
          onClick={() => void submitExtraction()}
          disabled={!chunks.length || loading || submitting}
        >
          현재 페이지 작업 등록
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function PremiumDashboardMetricCard({
  label,
  value,
  icon,
  themeColor,
}: {
  label: string;
  value?: number | string;
  icon: React.ReactNode;
  themeColor: string;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.2,
        minHeight: 110,
        position: "relative",
        overflow: "hidden",
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        transition: "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "translateY(-4px)",
          borderColor: themeColor,
          boxShadow: `0 8px 24px ${alpha(themeColor, 0.08)}, 0 2px 4px ${alpha(themeColor, 0.04)}`,
        },
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {label}
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: 2,
            bgcolor: alpha(themeColor, 0.08),
            color: themeColor,
          }}
        >
          {icon}
        </Box>
      </Box>
      <Typography variant="h4" sx={{ mt: 1.5, fontWeight: 800, color: "text.primary", letterSpacing: "-0.5px" }}>
        {typeof value === "number" ? value.toLocaleString() : value ?? "-"}
      </Typography>
      <Box
        sx={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          bgcolor: alpha(themeColor, 0.5),
        }}
      />
    </Paper>
  );
}

export function SkillGraphDashboardPage() {
  const query = useQuery({
    queryKey: skillGraphQueryKeys.custom("dashboard"),
    queryFn: () => skillGraphApi.dashboard(),
  });

  return (
    <PageFrame title="대시보드" label="SkillGraph 운영 상태와 최근 처리 현황을 확인합니다.">
      {query.isLoading ? <LoadingState /> : query.error ? <ErrorState error={query.error} /> : null}
      {query.data ? (
        <Stack spacing={2.5}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)", lg: "repeat(3, 1fr)", xl: "repeat(6, 1fr)" }, gap: 2 }}>
            <PremiumDashboardMetricCard label="전체 스킬" value={query.data.totalSkillCount} icon={<HubOutlined fontSize="small" />} themeColor="#3b82f6" />
            <PremiumDashboardMetricCard label="후보" value={query.data.candidateCount} icon={<DraftsOutlined fontSize="small" />} themeColor="#6366f1" />
            <PremiumDashboardMetricCard label="검수 대기" value={query.data.pendingReviewCount} icon={<RateReviewOutlined fontSize="small" />} themeColor="#f59e0b" />
            <PremiumDashboardMetricCard label="Alias 후보" value={query.data.aliasCandidateCount} icon={<CompareArrowsOutlined fontSize="small" />} themeColor="#14b8a6" />
            <PremiumDashboardMetricCard label="Noise" value={query.data.noiseCount} icon={<ReportGmailerrorredOutlined fontSize="small" />} themeColor="#ef4444" />
            <PremiumDashboardMetricCard label="Cluster" value={query.data.clusterCount} icon={<BubbleChartOutlined fontSize="small" />} themeColor="#10b981" />
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "1fr 1fr" }, gap: 2.5 }}>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 3,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.02)",
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
                <CategoryOutlined color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  카테고리별 분포
                </Typography>
              </Stack>
              <Stack spacing={2}>
                {(query.data.categoryDistribution ?? []).length ? (
                  query.data.categoryDistribution?.map((metric, index) => {
                    const maxCount = Math.max(...(query.data.categoryDistribution?.map(d => d.skillCount) ?? [1]));
                    const percentage = (metric.skillCount / maxCount) * 100;
                    const rankColor = index === 0 ? "#3b82f6" : index === 1 ? "#6366f1" : index === 2 ? "#10b981" : "#64748b";

                    return (
                      <Stack
                        key={`${metric.categoryId ?? metric.categoryName}`}
                        spacing={0.8}
                        sx={{
                          p: 1.2,
                          borderRadius: 2,
                          transition: "background-color 0.2s ease",
                          "&:hover": { bgcolor: "action.hover" },
                        }}
                      >
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 20,
                                height: 20,
                                borderRadius: "50%",
                                bgcolor: alpha(rankColor, 0.1),
                                color: rankColor,
                                fontSize: "10.5px",
                                fontWeight: 800,
                              }}
                            >
                              {index + 1}
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                              {metric.categoryName}
                            </Typography>
                          </Stack>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: "text.secondary" }}>
                            {metric.skillCount.toLocaleString()} 개
                          </Typography>
                        </Stack>
                        <Box sx={{ flex: 1, bgcolor: "action.hover", borderRadius: 2, height: 6, overflow: "hidden" }}>
                          <Box
                            sx={{
                              width: `${Math.min(100, percentage)}%`,
                              background: `linear-gradient(90deg, ${alpha(rankColor, 0.8)} 0%, ${rankColor} 100%)`,
                              height: "100%",
                              borderRadius: 2,
                              transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                            }}
                          />
                        </Box>
                      </Stack>
                    );
                  })
                ) : (
                  <EmptyState title="카테고리 분포가 없습니다." />
                )}
              </Stack>
            </Paper>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 3,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.02)",
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
                <HistoryOutlined color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  최근 Job 상태
                </Typography>
              </Stack>
              <Stack spacing={1.5}>
                {(query.data.recentJobs ?? []).length ? (
                  query.data.recentJobs?.map((job) => {
                    const statusColor =
                      job.status === "COMPLETED"
                        ? "#10b981"
                        : job.status === "FAILED"
                          ? "#ef4444"
                          : job.status === "RUNNING"
                            ? "#3b82f6"
                            : "#64748b";

                    return (
                      <Stack
                        key={String(job.jobId)}
                        direction="row"
                        alignItems="center"
                        spacing={2}
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          border: "1px solid",
                          borderColor: "divider",
                          bgcolor: "background.paper",
                          transition: "transform 0.2s ease, box-shadow 0.2s ease",
                          borderLeft: `4px solid ${statusColor}`,
                          "&:hover": {
                            transform: "translateX(4px)",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
                            bgcolor: "action.hover",
                          },
                        }}
                      >
                        <Box sx={{ minWidth: 90 }}>
                          <StatusBadge value={job.status} />
                        </Box>
                        <Stack spacing={0.2} sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                            {job.objectType ?? "object"} / {job.objectId ?? job.jobId}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Job ID: {job.jobId}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          {formatDate(job.createdAt)}
                        </Typography>
                      </Stack>
                    );
                  })
                ) : (
                  <EmptyState title="최근 Job이 없습니다." />
                )}
              </Stack>
            </Paper>
          </Box>
        </Stack>
      ) : null}
    </PageFrame>
  );
}

export function SkillGraphJobsPage() {
  const { canOperate } = useSkillGraphRoles();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [statusAnchorEl, setStatusAnchorEl] = useState<HTMLElement | null>(null);
  const [createAnchorEl, setCreateAnchorEl] = useState<HTMLElement | null>(null);
  const [ragExtractionOpen, setRagExtractionOpen] = useState(false);
  const [selected, setSelected] = useState<SkillGraphJob | null>(null);
  const [recentJobIds, setRecentJobIds] = useState<string[]>(() => readRecentRagExtractionJobIds());
  const [recentJobs, setRecentJobs] = useState<SkillGraphJob[]>([]);
  const [submittedJobs, setSubmittedJobs] = useState<SkillGraphJob[]>([]);
  const params = useMemo<SkillGraphListParams>(() => ({ status, objectId: keyword, limit: PAGE_SIZE }), [keyword, status]);
  const query = useQuery({
    queryKey: listQueryKey("jobs", params),
    queryFn: () => skillGraphApi.listJobs(params),
    refetchInterval: (query) => {
      const jobs = [...listFrom<SkillGraphJob>(query.state.data), ...recentJobs, ...submittedJobs];
      return jobs.some(isActiveJob) ? 3000 : false;
    },
  });
  const selectedJobQuery = useQuery({
    queryKey: skillGraphQueryKeys.detail(selected?.jobId ?? ""),
    queryFn: () => skillGraphApi.getJob(selected?.jobId ?? ""),
    enabled: Boolean(selected?.jobId),
    refetchInterval: (query) => isActiveJob(query.state.data) ? 3000 : false,
  });
  const selectedJob = selectedJobQuery.data ?? selected;
  const selectedJobItemsQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("job-items", selectedJob?.jobId ?? ""),
    queryFn: () => skillGraphApi.listJobItems(selectedJob?.jobId ?? "", 0, 100),
    enabled: Boolean(selectedJob?.jobId),
    refetchInterval: isActiveJob(selectedJob) ? 3000 : false,
  });
  const retryMutation = useMutation({
    mutationFn: (jobId: string | number) => skillGraphApi.retryJob(jobId),
    onSuccess: (job) => {
      setRecentJobIds(rememberRecentRagExtractionJobId(job.jobId));
      setSubmittedJobs((prev) => [job, ...prev.filter((row) => row.jobId !== job.jobId)]);
      setSelected(job);
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.detail(job.jobId) });
    },
  });
  useEffect(() => {
    let cancelled = false;
    async function loadRecentJobs() {
      const results = await Promise.allSettled(recentJobIds.map((jobId) => skillGraphApi.getJob(jobId)));
      if (cancelled) return;
      const jobs = results
        .filter((result): result is PromiseFulfilledResult<SkillGraphJob> => result.status === "fulfilled")
        .map((result) => result.value);
      setRecentJobs(jobs);
    }
    if (recentJobIds.length) {
      void loadRecentJobs();
    } else {
      setRecentJobs([]);
    }
    return () => {
      cancelled = true;
    };
  }, [recentJobIds]);
  useEffect(() => {
    const job = selectedJobQuery.data;
    if (!job) return;
    setSubmittedJobs((prev) => [job, ...prev.filter((row) => row.jobId !== job.jobId)]);
    setRecentJobs((prev) => [job, ...prev.filter((row) => row.jobId !== job.jobId)]);
  }, [selectedJobQuery.data]);
  useEffect(() => {
    const serverJobIds = new Set(listFrom<SkillGraphJob>(query.data).map((job) => String(job.jobId)));
    if (!serverJobIds.size) return;
    setSubmittedJobs((prev) => prev.filter((job) => !serverJobIds.has(String(job.jobId))));
    setRecentJobs((prev) => prev.filter((job) => !serverJobIds.has(String(job.jobId))));
  }, [query.data]);
  const rows = useMemo(() => {
    const serverRows = listFrom<SkillGraphJob>(query.data);
    const merged = [...serverRows, ...recentJobs, ...submittedJobs];
    const seen = new Set<string>();
    return merged.filter((job) => {
      const id = String(job.jobId);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [query.data, recentJobs, submittedJobs]);
  const columns = useMemo<ColDef<SkillGraphJob>[]>(() => [
    {
      headerName: "Job ID",
      field: "jobId",
      flex: 1,
      cellRenderer: (params: ICellRendererParams<SkillGraphJob>) => (
        <Button
          variant="text"
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            setSelected(params.data ?? null);
          }}
          sx={{
            justifyContent: "flex-start",
            minWidth: 0,
            maxWidth: "100%",
            px: 0,
            textAlign: "left",
            textTransform: "none",
          }}
        >
          <Typography noWrap variant="body2" color="primary">
            {params.value ?? "-"}
          </Typography>
        </Button>
      ),
    },
    { headerName: "상태", field: "status", width: 140, cellRenderer: ({ value }: { value?: string }) => <StatusBadge value={value} /> },
    /*{ headerName: "Object Type", field: "objectType", flex: 1 },
    { headerName: "Object ID", field: "objectId", flex: 1 },*/
    { headerName: "단계", field: "currentStep", width: 100  },
    { headerName: "처리", valueGetter: ({ data }) => `${numberValue(data?.processedCount)}/${numberValue(data?.totalCount)}`, width: 100 },
    // { headerName: "성공", field: "succeededChunks", width: 92 },
    // { headerName: "실패", valueGetter: ({ data }) => numberValue(data?.failedCount), width: 92 },
    { headerName: "추출 스킬", valueGetter: ({ data }) => numberValue(data?.extractedCount), width: 100 },
    { headerName: "생성일", valueGetter: ({ data }) => formatDate(data?.createdAt), width: 180 },
    { headerName: "액션", width: 110, cellRenderer: ({ data }: { data?: SkillGraphJob }) => (
      <Button
        size="small"
        disabled={!canOperate || !data || retryMutation.isPending || !data.failedCount}
        onClick={() => data && retryMutation.mutate(data.jobId)}
      >
        실패 재시도
      </Button>
    ) },
  ], [canOperate, retryMutation]);
  const itemColumns = useMemo<ColDef<SkillRagExtractionJobItem>[]>(() => [
    { headerName: "상태", field: "status", width: 120, cellRenderer: ({ value }: { value?: string }) => <StatusBadge value={value} /> },
    { headerName: "Chunk ID", field: "chunkId", flex: 1, minWidth: 100, tooltipField: "chunkId" },
    { headerName: "Document ID", field: "documentId", width: 160, tooltipField: "documentId" },
    { headerName: "추출", field: "extractedCount", width: 92, type: "numericColumn" },
    { headerName: "오류", field: "error", flex: 1, minWidth: 180, tooltipField: "error" },
    { headerName: "갱신일", valueGetter: ({ data }) => formatDate(data?.updatedAt), width: 180 },
  ], []);
  const statusLabel = status || "전체";
  const jobStatuses = ["", "READY", "RUNNING", "COMPLETED", "FAILED", "PARTIAL"];

  function applySearch(value = keywordInput) {
    setKeyword(value.trim());
  }

  return (
    <PageFrame
      title="스킬 추출 작업"
      label="스킬 추출 Job 상태와 실패 사유를 확인합니다."
      searchPlaceholder="objectId 검색"
      searchValue={keywordInput}
      onSearchValueChange={setKeywordInput}
      onSearch={applySearch}
      onRefresh={() => query.refetch()}
      actions={
        <>
          <Button
            variant="text"
            size="small"
            onClick={(event) => setStatusAnchorEl(event.currentTarget)}
            sx={{
              height: 40,
              minWidth: 110,
              px: 1.25,
              whiteSpace: "nowrap",
              color: "text.secondary",
              borderRadius: 1,
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            상태 · {statusLabel}
          </Button>
          <Tooltip title="추출 작업 등록">
            <span>
              <IconButton
                size="small"
                aria-label="추출 작업 등록"
                disabled={!canOperate}
                onClick={(event) => setCreateAnchorEl(event.currentTarget)}
              >
                <AddOutlined fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </>
      }
    >
      {query.error ? <ErrorState error={query.error} /> : null}
      <GridContent columns={columns} rowData={rows} loading={query.isLoading} onRowSelected={(event) => {
        const rowEvent = event as RowSelectedEvent<SkillGraphJob>;
        if (rowEvent.node.isSelected()) setSelected(rowEvent.data ?? null);
      }} />
      <DetailDrawer open={Boolean(selected)} title="Job 상세" onClose={() => setSelected(null)}>
        {selectedJobQuery.error ? <ErrorState error={selectedJobQuery.error} /> : null}
        <DetailRows rows={[
          ["Job ID", selectedJob?.jobId],
          ["상태", <StatusBadge value={selectedJob?.status} />],
          ["Object", `${selectedJob?.objectType ?? "-"} / ${selectedJob?.objectId ?? "-"}`],
          ["Document", selectedJob?.documentId ?? "-"],
          ["처리", `${numberValue(selectedJob?.processedCount)}/${numberValue(selectedJob?.totalCount)}`],
          ["성공/실패", `${numberValue(selectedJob?.succeededChunks)} / ${numberValue(selectedJob?.failedCount)}`],
          ["추출 후보", numberValue(selectedJob?.extractedCount)],
          ["실패 사유", selectedJob?.failureReason ?? "-"],
          ["생성일", formatDate(selectedJob?.createdAt)],
          ["갱신일", formatDate(selectedJob?.updatedAt)],
        ]} />
        <Stack direction="row" spacing={1} sx={{ my: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => selectedJob && void selectedJobQuery.refetch()}
            disabled={!selectedJob || selectedJobQuery.isFetching}
          >
            상태 새로고침
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={!canOperate || !selectedJob?.failedCount || retryMutation.isPending}
            onClick={() => selectedJob && retryMutation.mutate(selectedJob.jobId)}
          >
            실패 chunk 재시도
          </Button>
        </Stack>
        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
          처리 item
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          offset {numberValue(selectedJobItemsQuery.data?.offset)} · returned{" "}
          {numberValue(selectedJobItemsQuery.data?.returned ?? selectedJobItemsQuery.data?.items?.length)} · page size{" "}
          {numberValue(selectedJobItemsQuery.data?.limit)}
        </Typography>
        {selectedJobItemsQuery.data?.hasMore ? (
          <Alert severity="info" sx={{ mb: 1 }}>
            현재 목록은 일부 처리 item만 표시합니다. 상태는 상세 작업의 전체 처리 건수 기준으로 갱신됩니다.
          </Alert>
        ) : null}
        {selectedJobItemsQuery.error ? <ErrorState error={selectedJobItemsQuery.error} /> : null}
        <GridContent<SkillRagExtractionJobItem>
          columns={itemColumns}
          rowData={selectedJobItemsQuery.data?.items ?? []}
          loading={selectedJobItemsQuery.isLoading || selectedJobItemsQuery.isFetching}
          height={260}
        />
      </DetailDrawer>
      <Menu
        anchorEl={statusAnchorEl}
        open={Boolean(statusAnchorEl)}
        onClose={() => setStatusAnchorEl(null)}
      >
        {jobStatuses.map((value) => (
          <MenuItem
            key={value || "all"}
            selected={status === value}
            onClick={() => {
              setStatus(value);
              setStatusAnchorEl(null);
            }}
          >
            {value || "전체"}
          </MenuItem>
        ))}
      </Menu>
      <Menu
        anchorEl={createAnchorEl}
        open={Boolean(createAnchorEl)}
        onClose={() => setCreateAnchorEl(null)}
      >
        <MenuItem
          onClick={() => {
            setCreateAnchorEl(null);
            setRagExtractionOpen(true);
          }}
        >
          RAG 에서 추출
        </MenuItem>
        <MenuItem disabled>파일에서 추출</MenuItem>
      </Menu>
      <RagExtractionDialog
        open={ragExtractionOpen}
        onClose={() => setRagExtractionOpen(false)}
        onSubmitted={(job) => {
          if (job) {
            setRecentJobIds(rememberRecentRagExtractionJobId(job.jobId));
            setSubmittedJobs((prev) => [job, ...prev.filter((row) => row.jobId !== job.jobId)]);
            setSelected(job);
          }
          queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.lists() });
        }}
      />
    </PageFrame>
  );
}

function useCandidateAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string | number; action: "approve" | "reject" | "noise" }) => {
      if (action === "approve") return skillGraphApi.approveCandidate(id);
      if (action === "noise") return skillGraphApi.markNoise(id);
      return skillGraphApi.rejectCandidate(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("dashboard") });
    },
  });
}

function useCandidateBulkAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      ids,
      status,
      reviewerNote,
    }: {
      ids: Array<string | number>;
      status: Extract<SkillCandidateStatus, "APPROVED" | "REJECTED" | "NOISE">;
      reviewerNote?: string;
    }) => skillGraphApi.reviewCandidates({ candidateIds: ids, status, reviewerNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("dashboard") });
    },
  });
}

function useCandidateAutoApproveAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: skillGraphApi.autoApproveCandidates,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("dashboard") });
    },
  });
}

export function SkillGraphCandidatesPage() {
  const { canReview } = useSkillGraphRoles();
  const theme = useTheme();
  const confirm = useConfirm();
  const toast = useToast();
  const queryClient = useQueryClient();
  const gridRef = useRef<PageableGridContentHandle<SkillCandidate>>(null);
  const recommendationGridRef = useRef<PageableGridContentHandle<SkillRecommendationResult>>(null);
  const dataSource = useMemo(() => new SkillGraphCandidateDataSource(), []);
  const recommendationDataSource = useMemo(() => new SkillRecommendationResultDataSource(), []);
  const [status, setStatus] = useState("");
  const [keyword, setKeyword] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [gridFilterActive, setGridFilterActive] = useState(false);
  const [statusAnchorEl, setStatusAnchorEl] = useState<HTMLElement | null>(null);
  const [selected, setSelected] = useState<SkillCandidate | null>(null);
  const [autoApproveOpen, setAutoApproveOpen] = useState(false);
  const [autoApproveConfidenceInput, setAutoApproveConfidenceInput] = useState(String(DEFAULT_AUTO_APPROVE_CONFIDENCE_THRESHOLD));
  const [autoApproveSimilarityInput, setAutoApproveSimilarityInput] = useState(String(DEFAULT_AUTO_APPROVE_SIMILARITY_THRESHOLD));
  const [autoApproveGenerateEmbedding, setAutoApproveGenerateEmbedding] = useState(false);
  const [autoApproveScanning, setAutoApproveScanning] = useState(false);
  const [embeddingOpen, setEmbeddingOpen] = useState(false);
  const [embeddingJobId, setEmbeddingJobId] = useState("");
  const [embeddingForm, setEmbeddingForm] = useState({
    embeddingProvider: "kure",
    embeddingModel: "nlpai-lab/KURE-v1",
    embeddingDim: "1024",
  });
  const [recommendationOpen, setRecommendationOpen] = useState(false);
  const [recommendationMode, setRecommendationMode] = useState<"form" | "history" | "results">("form");
  const [recommendationJob, setRecommendationJob] = useState<SkillRecommendationJob | null>(null);
  const [recommendationResultStats, setRecommendationResultStats] = useState<SkillRecommendationResult[]>([]);
  const [recommendationApplyResult, setRecommendationApplyResult] = useState<SkillRecommendationApplyResult | null>(null);
  const [recommendationForm, setRecommendationForm] = useState({
    targetScope: "SELECTED" as "ALL" | "SELECTED" | "CURRENT_FILTER",
    embeddingProvider: "kure",
    embeddingModel: "nlpai-lab/KURE-v1",
    embeddingDimension: "1024",
    topK: "5",
    minScore: String(DEFAULT_RECOMMENDATION_MIN_SCORE),
    newSkillMinConfidence: String(DEFAULT_RECOMMENDATION_NEW_SKILL_CONFIDENCE),
    existingSkillMinScore: String(DEFAULT_RECOMMENDATION_EXISTING_SKILL_SCORE),
    includeDictionary: true,
    includeDataset: true,
    includeCandidate: true,
  });
  const actionMutation = useCandidateAction();
  const bulkActionMutation = useCandidateBulkAction();
  const autoApproveMutation = useCandidateAutoApproveAction();
  const embeddingMutation = useMutation({
    mutationFn: () => skillGraphApi.generateMissingCandidateEmbeddings({
      embeddingProvider: embeddingForm.embeddingProvider.trim(),
      embeddingModel: embeddingForm.embeddingModel.trim(),
      embeddingDim: Number(embeddingForm.embeddingDim),
    }),
    onSuccess: (response) => {
      setEmbeddingJobId(response.jobId ?? "");
      setEmbeddingOpen(false);
      gridRef.current?.refresh();
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("dashboard") });
      toast.success("후보 임베딩 생성 작업을 시작했습니다.");
    },
    onError: (error) => {
      toast.error(resolveAxiosError(error) || "후보 임베딩 생성에 실패했습니다.");
    },
  });
  const activeCandidateEmbeddingJobQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("active-batch-job", "CANDIDATE_EMBEDDING"),
    queryFn: () => findActiveSkillGraphBatchJob("CANDIDATE_EMBEDDING"),
    enabled: canReview && !embeddingJobId,
    refetchInterval: (query) => query.state.data ? 1000 : false,
  });
  useEffect(() => {
    const activeJob = activeCandidateEmbeddingJobQuery.data;
    if (!activeJob || embeddingJobId) {
      return;
    }
    setEmbeddingJobId(activeJob.jobId);
    queryClient.setQueryData(
      skillGraphQueryKeys.custom("candidate-embedding-job", activeJob.jobId),
      embeddingJobFromBatchEvent(activeJob)
    );
  }, [activeCandidateEmbeddingJobQuery.data, embeddingJobId, queryClient]);
  const embeddingJobQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("candidate-embedding-job", embeddingJobId),
    queryFn: () => skillGraphApi.getCandidateEmbeddingJob(embeddingJobId),
    enabled: Boolean(embeddingJobId),
    refetchInterval: (query) => {
      const job = query.state.data as SkillDictionaryEmbeddingJob | undefined;
      return isEmbeddingJobActive(job?.status) ? 1000 : false;
    },
  });
  useEffect(() => {
    if (!embeddingJobId) {
      return undefined;
    }
    const client = new StompRealtimeClient();
    client.subscribe(`/topic/skillgraph/jobs/${embeddingJobId}`, (payload: SkillGraphBatchJobEvent) => {
      if (payload.jobType && payload.jobType !== "CANDIDATE_EMBEDDING") {
        return;
      }
      queryClient.setQueryData(
        skillGraphQueryKeys.custom("candidate-embedding-job", embeddingJobId),
        embeddingJobFromBatchEvent(payload)
      );
    });
    client.connect();
    return () => client.disconnect();
  }, [embeddingJobId, queryClient]);
  const recommendationMutation = useMutation({
    mutationFn: async () => {
      const job = await skillGraphApi.createCandidateRecommendationJob({
        targetScope: recommendationForm.targetScope,
        candidateIds: recommendationForm.targetScope === "SELECTED" ? selectedIds.map(String) : [],
        status: recommendationForm.targetScope === "CURRENT_FILTER" ? status || undefined : undefined,
        keyword: recommendationForm.targetScope === "CURRENT_FILTER" ? keyword || undefined : undefined,
        embeddingProvider: recommendationForm.embeddingProvider.trim(),
        embeddingModel: recommendationForm.embeddingModel.trim(),
        embeddingDimension: Number(recommendationForm.embeddingDimension),
        targetTypes: [
          recommendationForm.includeDictionary ? "SKILL_DICTIONARY" : "",
          recommendationForm.includeDataset ? "DATASET_CONCEPT" : "",
          recommendationForm.includeCandidate ? "SKILL_CANDIDATE" : "",
        ].filter(Boolean),
        topK: Number(recommendationForm.topK),
        minScore: Number(recommendationForm.minScore),
        newSkillMinConfidence: Number(recommendationForm.newSkillMinConfidence),
        existingSkillMinScore: Number(recommendationForm.existingSkillMinScore),
      });
      return { job, results: [] as SkillRecommendationResult[] };
    },
    onSuccess: ({ job, results }) => {
      setRecommendationJob(job);
      setRecommendationResultStats(results);
      setRecommendationApplyResult(null);
      setRecommendationMode("results");
      recommendationDataSource.setJobId(job.jobId);
      recommendationGridRef.current?.refresh();
      toast.success("자동 분석 작업을 시작했습니다.");
    },
    onError: (error) => {
      toast.error(resolveAxiosError(error) || "자동 분석에 실패했습니다.");
    },
  });
  const recommendationJobsQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("candidate-recommendation-jobs"),
    queryFn: () => skillGraphApi.listRecommendationJobs({ page: 0, size: 30, sort: "createdAt,desc" }),
    enabled: recommendationOpen && recommendationMode === "history",
  });
  const activeRecommendationJobQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("active-batch-job", "CANDIDATE_RECOMMENDATION"),
    queryFn: () => findActiveSkillGraphBatchJob("CANDIDATE_RECOMMENDATION"),
    enabled: canReview && !recommendationJob,
    refetchInterval: (query) => query.state.data ? 1000 : false,
  });
  useEffect(() => {
    const activeJob = activeRecommendationJobQuery.data;
    if (!activeJob || recommendationJob) {
      return;
    }
    setRecommendationJob({
      jobId: activeJob.jobId,
      targetScope: "",
      embeddingProvider: activeJob.embeddingProvider ?? "",
      embeddingModel: activeJob.embeddingModel ?? "",
      embeddingDimension: activeJob.embeddingDimension ?? 0,
      topK: 0,
      minScore: 0,
      newSkillMinConfidence: 0,
      existingSkillMinScore: 0,
      status: activeJob.status === "FAILED" ? "FAILED" : activeJob.status === "COMPLETED" ? "COMPLETED" : "RUNNING",
      totalCount: activeJob.totalCount ?? 0,
      processedCount: activeJob.processedCount ?? 0,
      resultCount: activeJob.resultCount ?? 0,
      failedCount: activeJob.failedCount ?? 0,
      errorMessage: activeJob.message ?? activeJob.errorMessage,
      createdAt: activeJob.updatedAt ?? new Date().toISOString(),
      updatedAt: activeJob.updatedAt,
      startedAt: activeJob.startedAt,
      completedAt: activeJob.completedAt,
    });
  }, [activeRecommendationJobQuery.data, recommendationJob]);
  const recommendationJobQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("candidate-recommendation-job", recommendationJob?.jobId),
    queryFn: () => skillGraphApi.getRecommendationJob(String(recommendationJob?.jobId)),
    enabled: Boolean(recommendationJob?.jobId),
    refetchInterval: (query) => {
      const job = query.state.data as SkillRecommendationJob | undefined;
      return job && job.status !== "COMPLETED" && job.status !== "FAILED" ? 1000 : false;
    },
  });
  useEffect(() => {
    if (recommendationJobQuery.data) {
      setRecommendationJob(recommendationJobQuery.data);
    }
  }, [recommendationJobQuery.data]);
  useEffect(() => {
    const jobId = recommendationJob?.jobId;
    if (!jobId) {
      return undefined;
    }
    const client = new StompRealtimeClient();
    client.subscribe(`/topic/skillgraph/jobs/${jobId}`, (payload: SkillGraphBatchJobEvent) => {
      if (payload.jobType && payload.jobType !== "CANDIDATE_RECOMMENDATION") {
        return;
      }
      setRecommendationJob((prev) => recommendationJobFromBatchEvent(payload, prev));
    });
    client.connect();
    return () => client.disconnect();
  }, [recommendationJob?.jobId]);
  useEffect(() => {
    if (!recommendationJob || (recommendationJob.status !== "COMPLETED" && recommendationJob.status !== "FAILED")) {
      return;
    }
    recommendationDataSource.setJobId(recommendationJob.jobId);
    recommendationGridRef.current?.refresh();
    void skillGraphApi
      .listRecommendationJobResults(recommendationJob.jobId, { page: 0, size: 100, sort: "createdAt,asc" })
      .then((response) => setRecommendationResultStats(listFrom<SkillRecommendationResult>(response)))
      .catch(() => undefined);
  }, [recommendationDataSource, recommendationJob]);
  const recommendationHistoryRows = listFrom<SkillRecommendationJob>(recommendationJobsQuery.data);
  const recommendationApplyMutation = useMutation({
    mutationFn: (jobId: string) => skillGraphApi.applyRecommendationJob(jobId, {
      applyMode: "ELIGIBLE_ONLY",
      recommendationTypes: ["NEW_SKILL_CANDIDATE", "EXISTING_SKILL_MATCH"],
      minConfidence: Number(recommendationForm.newSkillMinConfidence),
      minSimilarityScore: Number(recommendationForm.existingSkillMinScore),
    }),
    onSuccess: (result) => {
      setRecommendationApplyResult(result);
      gridRef.current?.refresh();
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("dashboard") });
      toast.success(`일괄 승인 완료: 적용 ${result.appliedCount.toLocaleString()}건, 제외 ${result.skippedCount.toLocaleString()}건`);
    },
    onError: (error) => {
      toast.error(resolveAxiosError(error) || "추천 결과 일괄 승인에 실패했습니다.");
    },
  });

  const [selectedIds, setSelectedIds] = useState<(number | string)[]>([]);
  const [displayedCount, setDisplayedCount] = useState(0);
  const selectedCount = selectedIds.length;
  const currentPageCandidateIds = useMemo(
    () => dataSource.dataItems
      .map((row) => row.candidateId)
      .filter((id) => id !== undefined && id !== null),
    [dataSource.dataItems, displayedCount]
  );
  const autoApproveConfidenceThreshold = Number(autoApproveConfidenceInput);
  const autoApproveSimilarityThreshold = Number(autoApproveSimilarityInput);
  const autoApproveThresholdsValid =
    Number.isFinite(autoApproveConfidenceThreshold)
    && Number.isFinite(autoApproveSimilarityThreshold)
    && autoApproveConfidenceThreshold >= 0
    && autoApproveConfidenceThreshold <= 1
    && autoApproveSimilarityThreshold >= 0
    && autoApproveSimilarityThreshold <= 1;
  const selectedIdSet = useMemo(
    () => new Set(selectedIds.map((id) => String(id))),
    [selectedIds]
  );
  const currentPageSelectedCount = useMemo(
    () => currentPageCandidateIds.filter((id) => selectedIdSet.has(String(id))).length,
    [currentPageCandidateIds, selectedIdSet]
  );
  const allCurrentPageSelected = currentPageCandidateIds.length > 0 && currentPageSelectedCount === currentPageCandidateIds.length;
  const partiallyCurrentPageSelected = currentPageSelectedCount > 0 && currentPageSelectedCount < currentPageCandidateIds.length;
  const selectedCandidateId = selected?.candidateId == null ? "" : String(selected.candidateId);

  function syncDisplayedSelection(api: CandidateSelectionGridApi) {
    setDisplayedCount(api.getDisplayedRowCount());
    api.refreshHeader?.();
  }

  function syncDisplayedSelectionAfterRender(api: CandidateSelectionGridApi) {
    window.setTimeout(() => syncDisplayedSelection(api), 0);
    window.setTimeout(() => syncDisplayedSelection(api), 150);
  }

  function clearDisplayedSelectionAfterRender(api: CandidateSelectionGridApi) {
    api.deselectAll?.();
    setSelectedIds([]);
    setDisplayedCount(api.getDisplayedRowCount());
    api.refreshHeader?.();
    window.setTimeout(() => {
      api.deselectAll?.();
      setSelectedIds([]);
      setDisplayedCount(api.getDisplayedRowCount());
      api.refreshHeader?.();
    }, 150);
  }

  function toggleCurrentPageRows(checked: boolean) {
    setSelectedIds(checked ? currentPageCandidateIds : []);
  }

  function toggleCandidateRow(candidateId: string | number, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev.map((id) => String(id)));
      const normalizedId = String(candidateId);
      if (checked) {
        next.add(normalizedId);
      } else {
        next.delete(normalizedId);
      }
      return Array.from(next);
    });
  }

  function renderHeaderCheckbox(api?: {
    getLastDisplayedRowIndex: () => number;
    getDisplayedRowAtIndex: (index: number) => { isSelected: () => boolean; setSelected: (selected: boolean) => void } | undefined;
  }) {
    return (
      <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <SelectionCheckbox
          ariaLabel="전체 선택"
          checked={allCurrentPageSelected}
          indeterminate={partiallyCurrentPageSelected}
          onChange={() => toggleCurrentPageRows(!allCurrentPageSelected)}
        />
      </Box>
    );
  }

  const columns = useMemo<ColDef<SkillCandidate>[]>(() => [
    {
      colId: "rowSelect",
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
      headerComponent: (props: {
        api: {
          getLastDisplayedRowIndex: () => number;
          getDisplayedRowAtIndex: (
            index: number
          ) => { isSelected: () => boolean; setSelected: (selected: boolean) => void } | undefined;
        };
      }) => renderHeaderCheckbox(props.api),
      cellRenderer: (params: ICellRendererParams<SkillCandidate>) => (
        <CandidateSelectionCell
          params={params}
          checked={params.data?.candidateId !== undefined && selectedIdSet.has(String(params.data.candidateId))}
          onChange={toggleCandidateRow}
        />
      ),
    },
    {
      headerName: "후보명",
      field: "rawText",
      minWidth: 220,
      flex: 1.4,
      sortable: true,
      filter: "agTextColumnFilter",
      cellRenderer: (params: ICellRendererParams<SkillCandidate>) => (
        <Button
          variant="text"
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            setSelected(params.data ?? null);
          }}
          sx={{
            justifyContent: "flex-start",
            minWidth: 0,
            maxWidth: "100%",
            px: 0,
            textAlign: "left",
            textTransform: "none",
          }}
        >
          <Typography noWrap variant="body2" color="primary">
            {params.value ?? "-"}
          </Typography>
        </Button>
      ),
    },
    { headerName: "정규화명", field: "normalizedText", minWidth: 180, flex: 1, sortable: true, filter: "agTextColumnFilter" },
    {
      headerName: "검색 텍스트",
      field: "searchText",
      minWidth: 320,
      flex: 2,
      sortable: true,
      filter: "agTextColumnFilter",
      cellRenderer: ({ value }: { value?: string }) => (
        <Tooltip title={value || ""}>
          <Typography noWrap variant="body2">
            {value || "-"}
          </Typography>
        </Tooltip>
      ),
    },
    { headerName: "유형", field: "skillType", width: 140, sortable: true, filter: "agTextColumnFilter" },
    { headerName: "난이도", field: "difficulty", width: 120, sortable: true, filter: false },
    {
      headerName: "임베딩",
      field: "embedded",
      width: 100,
      sortable: true,
      filter: false,
      cellRenderer: ({ value }: { value?: boolean }) => (
        <Chip
          size="small"
          variant={value ? "filled" : "outlined"}
          color={value ? "success" : "default"}
          label={value ? "완료" : "없음"}
        />
      ),
    },
    {
      headerName: "임베딩 모델",
      field: "embeddingModel",
      minWidth: 180,
      flex: 1,
      filter: "agTextColumnFilter",
      cellRenderer: ({ value }: { value?: string }) => (
        <Typography noWrap variant="body2">{value || "-"}</Typography>
      ),
    },
    { headerName: "대상", field: "target", minWidth: 160, flex: 0.9, sortable: false, filter: "agTextColumnFilter" },
    {
      headerName: "기술",
      width: 180,
      sortable: false,
      filter: false,
      valueGetter: ({ data }) => candidateTechnologyLabel(data),
      cellRenderer: ({ value }: { value?: string }) => (
        <Tooltip title={value === "-" ? "" : value || ""}>
          <Typography noWrap variant="body2">
            {value || "-"}
          </Typography>
        </Tooltip>
      ),
    },
    { headerName: "상태", field: "status", width: 150, sortable: true, filter: "agTextColumnFilter", cellRenderer: ({ value }: { value?: string }) => <StatusBadge value={value} /> },
    { headerName: "유사 스킬", field: "matchedSkillName", minWidth: 160, flex: 1, sortable: true, filter: "agTextColumnFilter" },
    { headerName: "유사도", field: "similarityScore", width: 80, sortable: true, filter: false, cellRenderer: ({ value }: { value?: number }) => <ScoreBadge value={value} /> },
    // { headerName: "출현", field: "occurrenceCount", width: 90 },
    { headerName: "신뢰도", field: "confidenceScore", width: 80, sortable: true, filter: false, cellRenderer: ({ value }: { value?: number }) => <ScoreBadge value={value} /> },
    { headerName: "생성일", colId: "createdAt", valueGetter: ({ data }) => formatDate(data?.createdAt), width: 170, sortable: true, filter: false },
  ], [allCurrentPageSelected, partiallyCurrentPageSelected, selectedIdSet]);

  const recommendationColumns = useMemo<ColDef<SkillRecommendationResult>[]>(() => [
    { headerName: "후보", field: "sourceText", minWidth: 220, flex: 1.4 },
    {
      headerName: "추천 유형",
      field: "recommendationType",
      minWidth: 160,
      flex: 1,
      cellRenderer: ({ value }: { value?: string }) => (
        <Chip size="small" variant="outlined" label={recommendationTypeLabel(value)} />
      ),
    },
    { headerName: "추천 대상", field: "targetText", minWidth: 200, flex: 1.2 },
    { headerName: "유사도", field: "similarityScore", width: 100, cellRenderer: ({ value }: { value?: number }) => <ScoreBadge value={value} /> },
    { headerName: "신뢰도", field: "confidence", width: 100, cellRenderer: ({ value }: { value?: number }) => <ScoreBadge value={value} /> },
    {
      headerName: "반영",
      field: "status",
      width: 120,
      cellRenderer: ({ value }: { value?: string }) => (
        <Chip
          size="small"
          color={value === "APPLIED" ? "success" : value === "FAILED" ? "error" : value === "SKIPPED" ? "warning" : "default"}
          variant={value === "APPLIED" ? "filled" : "outlined"}
          label={value === "APPLIED" ? "반영됨" : value === "SKIPPED" ? "제외" : value === "FAILED" ? "실패" : "미반영"}
        />
      ),
    },
    { headerName: "상태", field: "status", width: 120, cellRenderer: ({ value }: { value?: string }) => <StatusBadge value={value} /> },
    { headerName: "생성일", valueGetter: ({ data }) => formatDate(data?.createdAt), width: 170 },
  ], []);

  const gridOptions = useMemo(
    () => ({
      rowSelection: {
        mode: "multiRow" as const,
        enableClickSelection: false,
        checkboxes: false,
        headerCheckbox: false,
      },
      suppressRowClickSelection: true,
      rowMultiSelectWithClick: true,
      getRowStyle: (params: { data?: SkillCandidate }) => (
        params.data?.candidateId != null && String(params.data.candidateId) === selectedCandidateId
          ? {
            backgroundColor: alpha(theme.palette.primary.main, 0.08),
            boxShadow: `inset 4px 0 0 ${theme.palette.primary.main}`,
          }
          : undefined
      ),
    }),
    [selectedCandidateId, theme.palette.primary.main]
  );

  useEffect(() => {
    gridRef.current?.refreshCells();
    gridRef.current?.refreshHeader();
  }, [selectedIds, allCurrentPageSelected, partiallyCurrentPageSelected, selectedCandidateId]);

  const gridEvents = useMemo(
    () => [
      {
        type: "selectionChanged",
        listener: (event: unknown) => {
          const api = (event as SelectionChangedEvent<SkillCandidate>).api;
          syncDisplayedSelectionAfterRender(api);
        },
      },
      {
        type: "modelUpdated",
        listener: (event: { api: CandidateSelectionGridApi }) => syncDisplayedSelectionAfterRender(event.api),
      },
      {
        type: "paginationChanged",
        listener: (event: { api: CandidateSelectionGridApi; newPage?: boolean; newPageSize?: boolean }) => {
          if (event.newPage || event.newPageSize) {
            clearDisplayedSelectionAfterRender(event.api);
            return;
          }
          syncDisplayedSelectionAfterRender(event.api);
        },
      },
    ],
    []
  );

  const statusLabel = status || "전체";
  const candidateStatuses = ["", "PENDING", "MATCHED", "ALIAS_CANDIDATE", "NEW_SKILL_CANDIDATE", "APPROVED", "REJECTED", "NOISE"];
  const bulkActionDisabled = !canReview || selectedCount === 0 || bulkActionMutation.isPending;
  const autoApproveDisabled = !canReview || autoApproveMutation.isPending || autoApproveScanning;
  const embeddingJob = embeddingJobQuery.data;
  const embeddingJobActive = embeddingMutation.isPending || isEmbeddingJobActive(embeddingJob?.status);
  const embeddingProgress = embeddingJobProgress(embeddingJob);
  const embeddingFormValid = embeddingForm.embeddingProvider.trim() !== ""
    && embeddingForm.embeddingModel.trim() !== ""
    && Number(embeddingForm.embeddingDim) > 0;
  const recommendationEligibleResults = recommendationResultStats.filter((result) => (
    result.status === "CANDIDATE"
      && (result.recommendationType === "NEW_SKILL_CANDIDATE" || result.recommendationType === "EXISTING_SKILL_MATCH")
      && result.confidence >= Number(recommendationForm.newSkillMinConfidence)
      && (result.recommendationType !== "EXISTING_SKILL_MATCH"
        || result.similarityScore >= Number(recommendationForm.existingSkillMinScore))
  ));
  const recommendationReviewResults = recommendationResultStats.filter((result) => (
    result.recommendationType === "REVIEW_REQUIRED"
      || result.recommendationType === "SIMILAR_CANDIDATE"
      || result.recommendationType === "NCS_MAPPING_CANDIDATE"
      || result.recommendationType === "DUPLICATE_CANDIDATE"
  ));
  const recommendationExcludedResults = recommendationResultStats.filter((result) => (
    result.recommendationType === "LOW_CONFIDENCE" || result.status === "SKIPPED" || result.status === "FAILED"
  ));
  const recommendationJobActive = recommendationMutation.isPending
    || (recommendationJob != null && recommendationJob.status !== "COMPLETED" && recommendationJob.status !== "FAILED");
  const recommendationFormValid = recommendationForm.embeddingProvider.trim() !== ""
    && recommendationForm.embeddingModel.trim() !== ""
    && Number(recommendationForm.embeddingDimension) > 0
    && Number(recommendationForm.topK) > 0
    && Number(recommendationForm.minScore) >= 0
    && Number(recommendationForm.newSkillMinConfidence) >= 0
    && Number(recommendationForm.existingSkillMinScore) >= 0
    && (recommendationForm.includeDictionary || recommendationForm.includeDataset || recommendationForm.includeCandidate)
    && (recommendationForm.targetScope !== "SELECTED" || selectedCount > 0);

  function applySearch(value = keywordInput) {
    const nextKeyword = value.trim();
    setKeyword(nextKeyword);
    dataSource.applyFilter({ status, keyword: nextKeyword });
    gridRef.current?.refresh();
  }

  function clearCandidateGridFilters() {
    gridRef.current?.clearFilters();
    setGridFilterActive(false);
  }

  async function applyBulkAction(nextStatus: Extract<SkillCandidateStatus, "APPROVED" | "REJECTED" | "NOISE">) {
    if (selectedIds.length === 0) {
      return;
    }

    const actionLabelByStatus = {
      APPROVED: "승인",
      NOISE: "노이즈",
      REJECTED: "거부",
    } satisfies Record<Extract<SkillCandidateStatus, "APPROVED" | "REJECTED" | "NOISE">, string>;
    const actionMessageByStatus = {
      APPROVED: "승인을",
      NOISE: "노이즈로",
      REJECTED: "거부로",
    } satisfies Record<Extract<SkillCandidateStatus, "APPROVED" | "REJECTED" | "NOISE">, string>;
    const actionLabel = actionLabelByStatus[nextStatus];
    const ok = await confirm({
      title: `스킬 후보 ${actionLabel}`,
      message: `선택한 ${selectedIds.length.toLocaleString()}건에 대하여 ${actionMessageByStatus[nextStatus]} 처리하시겠습니까?`,
      okText: "처리",
      cancelText: "취소",
    });

    if (!ok) {
      return;
    }

    bulkActionMutation.mutate(
      { ids: selectedIds, status: nextStatus },
      {
        onSuccess: () => {
          setSelectedIds([]);
          gridRef.current?.deselectAll();
          gridRef.current?.refresh();
        },
      }
    );
  }

  async function applyAutoApprove() {
    if (!autoApproveThresholdsValid) {
      return;
    }

    const ok = await confirm({
      title: "스킬 후보 자동 승인",
      message: `서버에서 전체 PENDING 후보 중 신뢰도 ${autoApproveConfidenceThreshold} 이상, 유사도 ${autoApproveSimilarityThreshold} 이상인 매칭 후보를 자동 승인 처리합니다.${autoApproveGenerateEmbedding ? " 승인된 스킬의 벡터도 생성합니다." : ""} 진행하시겠습니까?`,
      okText: "승인",
      cancelText: "취소",
    });

    if (!ok) {
      return;
    }

    setAutoApproveScanning(true);
    autoApproveMutation.mutate(
      {
        minConfidence: autoApproveConfidenceThreshold,
        minSimilarityScore: autoApproveSimilarityThreshold,
        generateEmbedding: autoApproveGenerateEmbedding,
        reviewerNote: `auto-approved: confidence>=${autoApproveConfidenceThreshold}, similarity>=${autoApproveSimilarityThreshold}`,
      },
      {
        onSuccess: (result) => {
          setSelectedIds([]);
          setAutoApproveOpen(false);
          setAutoApproveScanning(false);
          gridRef.current?.deselectAll();
          gridRef.current?.refresh();
          toast.success(
            `자동 승인 처리 완료: 승인 ${result.approvedCount.toLocaleString()}건, 제외 ${result.skippedCount.toLocaleString()}건`
          );
        },
        onError: (error) => {
          setAutoApproveScanning(false);
          toast.error(resolveAxiosError(error) || "자동 승인 처리에 실패했습니다.");
        },
      }
    );
  }

  async function submitCandidateEmbedding() {
    if (!embeddingFormValid || embeddingJobActive) {
      return;
    }
    const ok = await confirm({
      title: "후보 임베딩 생성",
      message: `${embeddingForm.embeddingProvider.trim()} / ${embeddingForm.embeddingModel.trim()} 기준으로 임베딩이 없는 스킬 후보만 처리합니다.`,
      okText: "생성",
      cancelText: "취소",
    });
    if (ok) {
      embeddingMutation.mutate();
    }
  }

  async function submitRecommendationAnalysis() {
    if (!recommendationFormValid || recommendationJobActive) {
      return;
    }
    const ok = await confirm({
      title: "스킬 후보 자동 분석",
      message: `${recommendationForm.targetScope === "SELECTED" ? `선택 ${selectedCount.toLocaleString()}건` : recommendationForm.targetScope === "CURRENT_FILTER" ? "현재 검색 조건" : "전체 후보"}을 기준으로 추천 결과를 생성합니다.`,
      okText: "분석",
      cancelText: "취소",
    });
    if (ok) {
      recommendationMutation.mutate();
    }
  }

  async function applyRecommendationResults() {
    const jobId = recommendationJob?.jobId;
    if (!jobId || recommendationEligibleResults.length === 0 || recommendationApplyMutation.isPending) {
      return;
    }
    const ok = await confirm({
      title: "추천 결과 일괄 승인",
      message: `일괄 승인 가능 ${recommendationEligibleResults.length.toLocaleString()}건만 적용합니다. 신규 후보는 사전에 등록하고, 기존 스킬 매칭은 기존 스킬에 연결합니다.`,
      okText: "일괄 승인",
      cancelText: "취소",
    });
    if (ok) {
      recommendationApplyMutation.mutate(jobId);
    }
  }

  useEffect(() => {
    dataSource.applyFilter({ status, keyword });
    gridRef.current?.refresh();
  }, [dataSource, keyword, status]);

  useEffect(() => {
    if (!embeddingJob || isEmbeddingJobActive(embeddingJob.status)) {
      return;
    }
    gridRef.current?.refresh();
    queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.lists() });
    queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("dashboard") });
  }, [embeddingJob, queryClient]);

  return (
    <PageFrame
      title="스킬 후보"
      label="스킬 후보를 조회하고 검수 액션을 수행합니다."
      searchPlaceholder="후보명 검색"
      searchValue={keywordInput}
      onSearchValueChange={setKeywordInput}
      onSearch={applySearch}
      onRefresh={() => gridRef.current?.refresh()}
      actions={
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mr: 0.5 }}>
          <Chip size="small" variant="outlined" label={`선택 ${selectedCount.toLocaleString()}건`} />
          {gridFilterActive ? (
            <Tooltip title="그리드 필터 조건 초기화">
              <IconButton
                size="small"
                onClick={clearCandidateGridFilters}
                aria-label="그리드 필터 조건 초기화"
              >
                <RestartAltOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
          <Button
            size="small"
            variant="outlined"
            disabled={autoApproveDisabled}
            startIcon={<DoneOutlined />}
            onClick={() => setAutoApproveOpen(true)}
          >
            {autoApproveScanning ? "선별 중" : "자동 승인"}
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={!canReview || embeddingJobActive}
            startIcon={embeddingJobActive ? <CircularProgress size={14} color="inherit" /> : <TravelExploreOutlined />}
            onClick={() => setEmbeddingOpen(true)}
          >
            임베딩 생성
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={!canReview || recommendationJobActive}
            startIcon={recommendationJobActive ? <CircularProgress size={14} color="inherit" /> : <RateReviewOutlined />}
            onClick={() => {
              setRecommendationMode(recommendationJob ? "results" : "form");
              setRecommendationOpen(true);
            }}
          >
            자동 분석
          </Button>
          <ButtonGroup size="small" aria-label="Small button group">
          <Button
            size="small"
            variant="contained"
            disabled={bulkActionDisabled}
            startIcon={<DoneOutlined />}
            onClick={() => applyBulkAction("APPROVED")}
          >
            승인
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={bulkActionDisabled}
            startIcon={<NoiseControlOffOutlined />}
            onClick={() => applyBulkAction("NOISE")}
          >
            노이즈
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            disabled={bulkActionDisabled}
            onClick={() => applyBulkAction("REJECTED")}
          >
            거부
          </Button>
          </ButtonGroup>
          <Button
            variant="text"
            size="small"
            onClick={(event) => setStatusAnchorEl(event.currentTarget)}
            sx={{
              height: 40,
              minWidth: 110,
              px: 1.25,
              whiteSpace: "nowrap",
              color: "text.secondary",
              borderRadius: 1,
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            상태 · {statusLabel}
          </Button>
        </Stack>
      }
    >
      {embeddingJobQuery.error ? (
        <Alert severity="error" sx={{ mb: 1 }}>
          {resolveAxiosError(embeddingJobQuery.error) || "후보 임베딩 job 상태 조회에 실패했습니다."}
        </Alert>
      ) : null}
      {embeddingJob ? (
        <Alert
          severity={embeddingJob.status === "FAILED" ? "error" : embeddingJob.status === "PARTIAL" ? "warning" : embeddingJob.status === "COMPLETED" ? "success" : "info"}
          sx={{ mb: 1 }}
        >
          <Stack spacing={0.75}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                후보 embedding job {embeddingJob.jobId} · {embeddingJob.status} · processed{" "}
                {numberValue(embeddingJob.processedCount)} / requested {numberValue(embeddingJob.requestedCount)}
                {" "}· failed {numberValue(embeddingJob.failedCount)} · skipped {numberValue(embeddingJob.skippedCount)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {embeddingProgress}%
              </Typography>
            </Stack>
            {isEmbeddingJobActive(embeddingJob.status) ? (
              <LinearProgress variant={embeddingJob.requestedCount > 0 ? "determinate" : "indeterminate"} value={embeddingProgress} />
            ) : null}
            {embeddingJob.message ? <Typography variant="caption">{embeddingJob.message}</Typography> : null}
          </Stack>
        </Alert>
      ) : null}
      <Stack spacing={1}>
        <PageableGridContent<SkillCandidate>
          ref={gridRef}
          columns={columns}
          datasource={dataSource}
          options={gridOptions}
          events={gridEvents}
          onFilterActived={setGridFilterActive}
        />
      </Stack>
      <DetailDrawer
        open={Boolean(selected)}
        title="후보 상세"
        onClose={() => setSelected(null)}
        actions={(
          <>
            <Button
              size="small"
              disabled={!canReview || !selected || actionMutation.isPending}
              startIcon={<DoneOutlined />}
              onClick={() => selected && actionMutation.mutate({ id: selected.candidateId, action: "approve" })}
            >
              Approve
            </Button>
            <Button
              size="small"
              disabled={!canReview || !selected || actionMutation.isPending}
              startIcon={<NoiseControlOffOutlined />}
              onClick={() => selected && actionMutation.mutate({ id: selected.candidateId, action: "noise" })}
            >
              Noise
            </Button>
            <Button
              size="small"
              disabled={!canReview || !selected || actionMutation.isPending}
              color="error"
              onClick={() => selected && actionMutation.mutate({ id: selected.candidateId, action: "reject" })}
            >
              Reject
            </Button>
          </>
        )}
      >
        <Stack spacing={2}>
          <DetailRows rows={[
            ["후보명", selected?.rawText],
            ["정규화명", selected?.normalizedText],
            ["검색 텍스트", selected?.searchText],
            ["유형", selected?.skillType],
            ["액션", selected?.action],
            ["기술", candidateTechnologyLabel(selected)],
            ["대상", selected?.target],
            ["난이도", selected?.difficulty],
            ["신뢰도", <ScoreBadge value={selected?.confidenceScore} />],
            ["임베딩", <Chip size="small" color={selected?.embedded ? "success" : "default"} variant={selected?.embedded ? "filled" : "outlined"} label={selected?.embedded ? "완료" : "없음"} />],
            ["임베딩 목록", <EmbeddingMetadataTable embeddings={selected?.embeddings} />],
            ["문맥", selected?.context],
            ["추출 방식", selected?.extractionMethod],
            ["리뷰 상태", selected?.reviewStatus],
            ["상태", <StatusBadge value={selected?.status} />],
            ["유사 스킬", selected?.matchedSkillName ?? "-"],
            ["유사도", <ScoreBadge value={selected?.similarityScore} />],
            ["출현 횟수", selected?.occurrenceCount],
          ]} />
          <EvidenceBlock value={selected?.evidenceText ?? selected?.evidenceSentence} />
          {selected?.feedback && <EvidenceBlock value={selected.feedback} />}
        </Stack>
      </DetailDrawer>
      <Menu
        anchorEl={statusAnchorEl}
        open={Boolean(statusAnchorEl)}
        onClose={() => setStatusAnchorEl(null)}
      >
        {candidateStatuses.map((value) => (
          <MenuItem
            key={value || "all"}
            selected={status === value}
            onClick={() => {
              setStatus(value);
              setStatusAnchorEl(null);
            }}
          >
            {value || "전체"}
          </MenuItem>
        ))}
      </Menu>
      <Dialog open={autoApproveOpen} onClose={() => setAutoApproveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>스킬 후보 자동 승인</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="신뢰도 기준"
              type="number"
              size="small"
              value={autoApproveConfidenceInput}
              onChange={(event) => setAutoApproveConfidenceInput(event.target.value)}
              inputProps={{ min: 0, max: 1, step: 0.01 }}
              error={!Number.isFinite(autoApproveConfidenceThreshold) || autoApproveConfidenceThreshold < 0 || autoApproveConfidenceThreshold > 1}
              helperText="0에서 1 사이 값"
            />
            <TextField
              label="유사도 기준"
              type="number"
              size="small"
              value={autoApproveSimilarityInput}
              onChange={(event) => setAutoApproveSimilarityInput(event.target.value)}
              inputProps={{ min: 0, max: 1, step: 0.01 }}
              error={!Number.isFinite(autoApproveSimilarityThreshold) || autoApproveSimilarityThreshold < 0 || autoApproveSimilarityThreshold > 1}
              helperText="0에서 1 사이 값"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={autoApproveGenerateEmbedding}
                  onChange={(event) => setAutoApproveGenerateEmbedding(event.target.checked)}
                />
              }
              label="승인된 스킬 벡터 생성"
            />
            <Alert severity="info">
              서버가 전체 PENDING 후보에서 입력 기준에 맞는 매칭 후보를 자동 승인합니다.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAutoApproveOpen(false)}>취소</Button>
          <Button
            variant="contained"
            disabled={!autoApproveThresholdsValid || autoApproveScanning || autoApproveMutation.isPending}
            onClick={() => void applyAutoApprove()}
          >
            {autoApproveScanning ? "선별 중" : "확인"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={recommendationOpen} onClose={() => setRecommendationOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Typography variant="h6">스킬 후보 자동 분석</Typography>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Tooltip title="분석 설정">
                <IconButton size="small" color={recommendationMode === "form" ? "primary" : "default"} onClick={() => setRecommendationMode("form")}>
                  <RateReviewOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="분석 이력">
                <IconButton size="small" color={recommendationMode === "history" ? "primary" : "default"} onClick={() => setRecommendationMode("history")}>
                  <HistoryOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1, minHeight: 520 }}>
            {recommendationMode === "form" ? (
              <>
            <Alert severity="info" sx={{ alignItems: "flex-start" }}>
              <Stack spacing={0.75}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  자동 분석은 후보 임베딩을 기준으로 기존 스킬 사전, NCS 데이터셋, 다른 후보와의 유사도를 비교해 추천 결과를 생성합니다.
                </Typography>
                <Typography variant="body2">
                  선택한 provider/model/dimension 기준으로 후보 임베딩이 모두 생성되어 있어야 하며, 누락 후보가 있으면 서버가 분석을 시작하지 않습니다.
                </Typography>
                <Typography variant="body2">
                  일괄 승인은 `신규 스킬 후보`와 `기존 스킬 연결` 결과만 적용합니다. NCS 추천, 중복/유사 후보, 낮은 신뢰도 결과는 검토용으로만 표시됩니다.
                </Typography>
              </Stack>
            </Alert>
            <Select
              size="small"
              value={recommendationForm.targetScope}
              onChange={(event) => setRecommendationForm((prev) => ({ ...prev, targetScope: event.target.value as "ALL" | "SELECTED" | "CURRENT_FILTER" }))}
            >
              <MenuItem value="SELECTED">선택 후보</MenuItem>
              <MenuItem value="CURRENT_FILTER">현재 검색 결과</MenuItem>
              <MenuItem value="ALL">전체 후보</MenuItem>
            </Select>
            {recommendationForm.targetScope === "SELECTED" && selectedCount === 0 ? (
              <Alert severity="warning">선택 후보 분석은 먼저 목록에서 후보를 선택해야 합니다.</Alert>
            ) : null}
            <Typography variant="caption" color="text.secondary">
              대상 범위는 분석할 후보 집합입니다. 선택 후보는 체크한 행만, 현재 검색 결과는 화면의 검색어/상태 필터를, 전체 후보는 필터 없이 후보를 대상으로 합니다.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Embedding Provider"
                size="small"
                value={recommendationForm.embeddingProvider}
                onChange={(event) => setRecommendationForm((prev) => ({ ...prev, embeddingProvider: event.target.value }))}
                helperText="후보와 비교 대상이 같은 provider로 임베딩되어 있어야 합니다."
                fullWidth
              />
              <TextField
                label="Dimension"
                type="number"
                size="small"
                value={recommendationForm.embeddingDimension}
                onChange={(event) => setRecommendationForm((prev) => ({ ...prev, embeddingDimension: event.target.value }))}
                inputProps={{ min: 1, max: 4096 }}
                helperText="벡터 차원입니다. 예: KURE-v1은 1024."
                sx={{ width: { sm: 140 } }}
              />
            </Stack>
            <TextField
              label="Embedding Model"
              size="small"
              value={recommendationForm.embeddingModel}
              onChange={(event) => setRecommendationForm((prev) => ({ ...prev, embeddingModel: event.target.value }))}
              helperText="후보와 비교 대상이 같은 model로 임베딩되어 있어야 합니다."
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Top-K"
                type="number"
                size="small"
                value={recommendationForm.topK}
                onChange={(event) => setRecommendationForm((prev) => ({ ...prev, topK: event.target.value }))}
                inputProps={{ min: 1, max: 20 }}
                helperText="후보 하나당 비교 대상별로 가져올 최대 추천 개수입니다."
              />
              <TextField
                label="최소 점수"
                type="number"
                size="small"
                value={recommendationForm.minScore}
                onChange={(event) => setRecommendationForm((prev) => ({ ...prev, minScore: event.target.value }))}
                inputProps={{ min: 0, max: 1, step: 0.01 }}
                helperText="이 유사도 미만의 벡터 검색 결과는 추천에서 제외합니다."
              />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="신규 스킬 confidence"
                type="number"
                size="small"
                value={recommendationForm.newSkillMinConfidence}
                onChange={(event) => setRecommendationForm((prev) => ({ ...prev, newSkillMinConfidence: event.target.value }))}
                inputProps={{ min: 0, max: 1, step: 0.01 }}
                helperText="기존 스킬 강매칭이 없고 후보 신뢰도가 이 값 이상이면 신규 스킬 후보로 추천합니다."
              />
              <TextField
                label="기존 스킬 similarity"
                type="number"
                size="small"
                value={recommendationForm.existingSkillMinScore}
                onChange={(event) => setRecommendationForm((prev) => ({ ...prev, existingSkillMinScore: event.target.value }))}
                inputProps={{ min: 0, max: 1, step: 0.01 }}
                helperText="기존 스킬과의 유사도가 이 값 이상이면 기존 스킬 연결 추천으로 봅니다."
              />
            </Stack>
            <Alert severity="warning">
              기준값을 낮추면 일괄 승인 가능 건수는 늘지만 오매칭 가능성이 커집니다. 운영 검수에는 기존 스킬 similarity 0.92 이상, 신규 스킬 confidence 0.80 이상을 권장합니다.
            </Alert>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              <FormControlLabel
                control={<Switch checked={recommendationForm.includeDictionary} onChange={(event) => setRecommendationForm((prev) => ({ ...prev, includeDictionary: event.target.checked }))} />}
                label="Skill Dictionary"
              />
              <FormControlLabel
                control={<Switch checked={recommendationForm.includeDataset} onChange={(event) => setRecommendationForm((prev) => ({ ...prev, includeDataset: event.target.checked }))} />}
                label="NCS Dataset"
              />
              <FormControlLabel
                control={<Switch checked={recommendationForm.includeCandidate} onChange={(event) => setRecommendationForm((prev) => ({ ...prev, includeCandidate: event.target.checked }))} />}
                label="Skill Candidate"
              />
            </Stack>
              </>
            ) : null}
            {recommendationMode === "history" ? (
              <Stack spacing={1.25}>
                {recommendationJobsQuery.isLoading ? (
                  <LoadingState label="분석 이력을 불러오는 중입니다." />
                ) : recommendationHistoryRows.length === 0 ? (
                  <EmptyState title="분석 이력이 없습니다." />
                ) : (
                  recommendationHistoryRows.map((job) => (
                    <ListItemButton
                      key={job.jobId}
                      selected={recommendationJob?.jobId === job.jobId}
                      onClick={async () => {
                        setRecommendationJob(job);
                        setRecommendationApplyResult(null);
                        recommendationDataSource.setJobId(job.jobId);
                        const firstPage = await skillGraphApi.listRecommendationJobResults(job.jobId, { page: 0, size: 100, sort: "createdAt,asc" });
                        setRecommendationResultStats(listFrom<SkillRecommendationResult>(firstPage));
                        recommendationGridRef.current?.refresh();
                        setRecommendationMode("results");
                      }}
                      sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}
                    >
                      <ListItemText
                        primary={`자동 분석 · ${job.status}`}
                        secondary={`${job.jobId} · 결과 ${numberValue(job.resultCount)}건 · ${formatDate(job.createdAt)}`}
                      />
                      <StatusBadge value={job.status} />
                    </ListItemButton>
                  ))
                )}
              </Stack>
            ) : null}
            {recommendationMode === "results" ? (
              <Stack spacing={1.25}>
                {recommendationJobActive || recommendationJob ? (
                  <Alert severity={recommendationJob?.status === "FAILED" ? "error" : recommendationJob?.status === "COMPLETED" ? "success" : "info"}>
                    <Stack spacing={0.75}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          자동 분석 {recommendationJob?.jobId ? `job ${recommendationJob.jobId}` : "요청 처리 중"} · {recommendationJob?.status ?? "RUNNING"} · processed{" "}
                          {numberValue(recommendationJob?.processedCount)} / total {numberValue(recommendationJob?.totalCount)}
                          {" "}· results {numberValue(recommendationJob?.resultCount)} · failed {numberValue(recommendationJob?.failedCount)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {recommendationJob?.totalCount ? Math.round((recommendationJob.processedCount / recommendationJob.totalCount) * 100) : recommendationJobActive ? 0 : 100}%
                        </Typography>
                      </Stack>
                      {recommendationJobActive ? (
                        <LinearProgress
                          variant={recommendationJob?.totalCount ? "determinate" : "indeterminate"}
                          value={recommendationJob?.totalCount ? Math.round((recommendationJob.processedCount / recommendationJob.totalCount) * 100) : undefined}
                        />
                      ) : null}
                      {recommendationJob?.errorMessage ? <Typography variant="caption">{recommendationJob.errorMessage}</Typography> : null}
                    </Stack>
                  </Alert>
                ) : null}
                <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }} justifyContent="space-between">
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      자동 분석 추천 결과
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      아래 목록은 후보별로 서버가 벡터 유사도와 confidence 기준을 적용해 생성한 추천 결과입니다. 한 후보에 기존 스킬, NCS, 유사 후보 등 여러 추천이 표시될 수 있습니다.
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 0.75 }}>
                      <Chip size="small" label={`전체 ${numberValue(recommendationJob?.resultCount)}건`} />
                      <Chip size="small" color="success" variant="outlined" label={`일괄 승인 가능 ${recommendationEligibleResults.length.toLocaleString()}건`} />
                      <Chip size="small" color="warning" variant="outlined" label={`검토 필요 ${recommendationReviewResults.length.toLocaleString()}건`} />
                      <Chip size="small" variant="outlined" label={`제외 ${recommendationExcludedResults.length.toLocaleString()}건`} />
                    </Stack>
                  </Stack>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={recommendationEligibleResults.length === 0 || recommendationApplyMutation.isPending}
                    startIcon={recommendationApplyMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <DoneOutlined />}
                    onClick={applyRecommendationResults}
                  >
                    일괄 승인
                  </Button>
                </Stack>
                {recommendationApplyResult ? (
                  <Alert severity={recommendationApplyResult.failedCount > 0 ? "warning" : "success"}>
                    적용 {recommendationApplyResult.appliedCount.toLocaleString()}건 · 제외 {recommendationApplyResult.skippedCount.toLocaleString()}건 · 실패 {recommendationApplyResult.failedCount.toLocaleString()}건
                  </Alert>
                ) : null}
                <PageableGridContent<SkillRecommendationResult>
                  ref={recommendationGridRef}
                  columns={recommendationColumns}
                  datasource={recommendationDataSource}
                />
              </Stack>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setRecommendationOpen(false)}>닫기</Button>
          {recommendationMode === "form" ? (
            <Button
              variant="contained"
              size="small"
              disabled={!recommendationFormValid || recommendationJobActive}
              onClick={() => void submitRecommendationAnalysis()}
            >
              {recommendationJobActive ? "분석 중" : "추천 분석 시작"}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
      <Dialog open={embeddingOpen} onClose={() => setEmbeddingOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>스킬 후보 임베딩 생성</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              선택한 provider/model 기준으로 `tb_skill_embedding`에 없는 후보만 생성합니다.
            </Alert>
            <TextField
              label="Embedding Provider"
              size="small"
              value={embeddingForm.embeddingProvider}
              onChange={(event) => setEmbeddingForm((prev) => ({ ...prev, embeddingProvider: event.target.value }))}
            />
            <TextField
              label="Embedding Model"
              size="small"
              value={embeddingForm.embeddingModel}
              onChange={(event) => setEmbeddingForm((prev) => ({ ...prev, embeddingModel: event.target.value }))}
            />
            <TextField
              label="Dimension"
              type="number"
              size="small"
              value={embeddingForm.embeddingDim}
              onChange={(event) => setEmbeddingForm((prev) => ({ ...prev, embeddingDim: event.target.value }))}
              inputProps={{ min: 1, max: 4096 }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmbeddingOpen(false)}>취소</Button>
          <Button
            variant="contained"
            disabled={!embeddingFormValid || embeddingJobActive}
            onClick={submitCandidateEmbedding}
          >
            생성
          </Button>
        </DialogActions>
      </Dialog>
    </PageFrame>
  );
}

interface TreeNode {
  id: string;
  type: "category" | "skill";
  name: string;
  categoryId?: string | number;
  skillId?: string | number;
  children: TreeNode[];
  depth: number;
  x: number;
  y: number;
}

interface SkillGraphTreeDialogProps {
  open: boolean;
  onClose: () => void;
}

function SkillGraphTreeDialog({ open, onClose }: SkillGraphTreeDialogProps) {
  const categoriesQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("categories-tree"),
    queryFn: () => skillGraphApi.listCategoryTree(),
    enabled: open,
  });

  const dictionaryQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("dictionary-tree-items"),
    queryFn: () => skillGraphApi.listDictionary({ limit: 1000, sort: "name,asc" }),
    enabled: open,
  });

  const [pan, setPan] = useState({ x: 100, y: 150 });
  const [zoom, setZoom] = useState(0.85);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  
  const [expandedCategories, setExpandedCategories] = useState<Set<string | number>>(new Set());
  
  const svgRef = useRef<SVGSVGElement | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (categoriesQuery.data && !initializedRef.current) {
      const cats = listFrom<SkillCategory>(categoriesQuery.data);
      const roots = cats.filter(cat => !(cat.parentId ?? cat.parentCategoryId));
      setExpandedCategories(new Set(roots.map(r => r.categoryId)));
      initializedRef.current = true;
    }
  }, [categoriesQuery.data]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const scale = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      setZoom(z => Math.max(0.15, Math.min(3, z * scale)));
    };

    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      svg.removeEventListener("wheel", handleWheel);
    };
  }, [open]);

  const { visibleNodes, visibleLinks, allCategoryIds } = useMemo(() => {
    if (!categoriesQuery.data) {
      return { visibleNodes: [], visibleLinks: [], allCategoryIds: [] };
    }

    const categories = listFrom<SkillCategory>(categoriesQuery.data);
    const skills = listFrom<SkillDictionaryItem>(dictionaryQuery.data ?? []);

    const categoryMap: Record<string | number, TreeNode> = {};
    const allCatIds: Array<string | number> = [];

    categories.forEach(cat => {
      allCatIds.push(cat.categoryId);
      categoryMap[cat.categoryId] = {
        id: `c-${cat.categoryId}`,
        type: "category",
        name: cat.categoryName,
        categoryId: cat.categoryId,
        children: [],
        depth: 0,
        x: 0,
        y: 0,
      };
    });

    const rootCategories: TreeNode[] = [];

    categories.forEach(cat => {
      const node = categoryMap[cat.categoryId];
      const parentId = cat.parentId ?? cat.parentCategoryId;
      if (parentId && categoryMap[parentId]) {
        categoryMap[parentId].children.push(node);
      } else {
        rootCategories.push(node);
      }
    });

    skills.forEach(skill => {
      if (skill.categoryId && categoryMap[skill.categoryId]) {
        categoryMap[skill.categoryId].children.push({
          id: `s-${skill.skillId}`,
          type: "skill",
          name: skill.skillName ?? skill.name ?? "",
          skillId: skill.skillId,
          children: [],
          depth: 0,
          x: 0,
          y: 0,
        });
      }
    });

    let currentY = 0;
    const xSpacing = 280;
    const ySpacing = 58;
    const xPadding = 120;
    const yPadding = 80;

    function computeCoords(nodes: TreeNode[], depth: number) {
      nodes.forEach(node => {
        node.depth = depth;
        node.x = depth * xSpacing + xPadding;

        const isExpanded = node.type === "category" && expandedCategories.has(node.categoryId!);
        const visibleChildren = isExpanded ? node.children : [];

        if (visibleChildren.length === 0) {
          node.y = currentY * ySpacing + yPadding;
          currentY++;
        } else {
          computeCoords(visibleChildren, depth + 1);
          const firstChildY = visibleChildren[0].y;
          const lastChildY = visibleChildren[visibleChildren.length - 1].y;
          node.y = (firstChildY + lastChildY) / 2;
        }
      });
    }

    computeCoords(rootCategories, 0);

    const nodesList: TreeNode[] = [];
    const linksList: Array<{ source: TreeNode; target: TreeNode }> = [];

    function collect(nodes: TreeNode[], parent?: TreeNode) {
      nodes.forEach(node => {
        nodesList.push(node);
        if (parent) {
          linksList.push({ source: parent, target: node });
        }
        const isExpanded = node.type === "category" && expandedCategories.has(node.categoryId!);
        if (isExpanded) {
          collect(node.children, node);
        }
      });
    }

    collect(rootCategories);

    return {
      visibleNodes: nodesList,
      visibleLinks: linksList,
      allCategoryIds: allCatIds,
    };
  }, [categoriesQuery.data, dictionaryQuery.data, expandedCategories]);

  useEffect(() => {
    if (!searchQuery.trim() || !categoriesQuery.data) return;
    
    const categories = listFrom<SkillCategory>(categoriesQuery.data);
    const skills = listFrom<SkillDictionaryItem>(dictionaryQuery.data ?? []);
    const categoryMap: Record<string | number, SkillCategory> = {};
    categories.forEach(c => { categoryMap[c.categoryId] = c; });

    const matchedAncestors = new Set<string | number>();

    categories.forEach(c => {
      if (c.categoryName.toLowerCase().includes(searchQuery.toLowerCase())) {
        let parentId = c.parentId ?? c.parentCategoryId;
        while (parentId && categoryMap[parentId]) {
          matchedAncestors.add(parentId);
          const p = categoryMap[parentId];
          parentId = p.parentId ?? p.parentCategoryId;
        }
      }
    });

    skills.forEach(s => {
      if (s.skillName?.toLowerCase().includes(searchQuery.toLowerCase()) || s.name?.toLowerCase().includes(searchQuery.toLowerCase())) {
        let parentId = s.categoryId;
        while (parentId && categoryMap[parentId]) {
          matchedAncestors.add(parentId);
          const p = categoryMap[parentId];
          parentId = p.parentId ?? p.parentCategoryId;
        }
      }
    });

    if (matchedAncestors.size > 0) {
      setExpandedCategories(prev => {
        const next = new Set(prev);
        matchedAncestors.forEach(id => next.add(id));
        return next;
      });
    }
  }, [searchQuery, categoriesQuery.data, dictionaryQuery.data]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const toggleCategoryExpand = (catId: string | number) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedCategories(new Set(allCategoryIds));
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  const resetPanZoom = () => {
    setPan({ x: 100, y: 150 });
    setZoom(0.85);
  };

  const isLoading = categoriesQuery.isLoading || dictionaryQuery.isLoading;
  const isError = categoriesQuery.isError || dictionaryQuery.isError;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{
        sx: {
          bgcolor: "background.default",
          display: "flex",
          flexDirection: "column",
        }
      }}
    >
      <Box sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 3,
        py: 2,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
      }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <AccountTreeOutlined color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            스킬 & 카테고리 트리 그래프
          </Typography>
        </Stack>

        <Stack direction="row" spacing={2} sx={{ width: 340, mx: 4 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="카테고리 또는 스킬 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchOutlined fontSize="small" color="action" sx={{ mr: 1 }} />
            }}
          />
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Button size="small" variant="outlined" onClick={expandAll} sx={{ fontWeight: 700 }}>
            전체 펼치기
          </Button>
          <Button size="small" variant="outlined" onClick={collapseAll} sx={{ fontWeight: 700 }}>
            전체 접기
          </Button>
          <IconButton onClick={onClose} edge="end" aria-label="close">
            <CloseOutlined />
          </IconButton>
        </Stack>
      </Box>

      <Box
        sx={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          bgcolor: "grey.50",
          cursor: isDragging ? "grabbing" : "grab",
          userSelect: "none"
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {isLoading ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center", justifyContent: "center", height: "100%" }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              트리 데이터 구성 중...
            </Typography>
          </Box>
        ) : isError ? (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", p: 4 }}>
            <Alert severity="error">
              트리 데이터 로드에 실패했습니다. API 연결을 확인하십시오.
            </Alert>
          </Box>
        ) : (
          <>
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              style={{ display: "block" }}
            >
              <defs>
                <linearGradient id="cat-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f8fafc" />
                  <stop offset="100%" stopColor="#eef2ff" />
                </linearGradient>
                <linearGradient id="skill-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f8fafc" />
                  <stop offset="100%" stopColor="#ecfdf5" />
                </linearGradient>
                <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.06" />
                </filter>
                <filter id="highlight-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComponentTransfer in="blur" result="glow1">
                    <feFuncA type="linear" slope="0.65" />
                  </feComponentTransfer>
                  <feMerge>
                    <feMergeNode in="glow1" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,0,0,0.025)" strokeWidth="1" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#grid-pattern)" />

              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {visibleLinks.map((link, idx) => {
                  const parent = link.source;
                  const child = link.target;
                  const d = `M ${parent.x} ${parent.y} C ${(parent.x + child.x) / 2} ${parent.y}, ${(parent.x + child.x) / 2} ${child.y}, ${child.x} ${child.y}`;
                  
                  const isParentMatch = searchQuery && parent.name.toLowerCase().includes(searchQuery.toLowerCase());
                  const isChildMatch = searchQuery && child.name.toLowerCase().includes(searchQuery.toLowerCase());
                  const isHighlighted = isParentMatch && isChildMatch;
                  
                  return (
                    <path
                      key={`link-${idx}`}
                      d={d}
                      fill="none"
                      stroke={isHighlighted ? "#f59e0b" : "rgba(100, 116, 139, 0.15)"}
                      strokeWidth={isHighlighted ? 2.5 : 1.5}
                      strokeDasharray={isHighlighted ? "4 2" : undefined}
                      style={{ transition: "stroke 0.25s ease, stroke-width 0.25s ease" }}
                    />
                  );
                })}

                {visibleNodes.map((node) => {
                  const isCategory = node.type === "category";
                  const isExpanded = isCategory && expandedCategories.has(node.categoryId!);
                  const isSelected = selectedNode?.id === node.id;
                  const isMatched = searchQuery && node.name.toLowerCase().includes(searchQuery.toLowerCase());
                  
                  const rectWidth = isCategory ? 210 : 170;
                  const rectHeight = 36;
                  
                  const strokeColor = isSelected ? "#3b82f6" : isCategory ? "#6366f1" : "#10b981";
                  const borderWeight = isSelected ? 2 : isMatched ? 2 : 1;
                  
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      style={{ cursor: "pointer" }}
                    >
                      <rect
                        x={0}
                        y={-rectHeight / 2}
                        width={rectWidth}
                        height={rectHeight}
                        rx={6}
                        fill={isCategory ? "url(#cat-grad)" : "url(#skill-grad)"}
                        stroke={isMatched ? "#f59e0b" : strokeColor}
                        strokeWidth={borderWeight}
                        filter={isMatched ? "url(#highlight-glow)" : "url(#shadow)"}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNode(node);
                        }}
                        style={{
                          transition: "fill 0.2s ease, stroke 0.2s ease, stroke-width 0.2s ease, filter 0.2s ease",
                        }}
                      />

                      {isCategory ? (
                        <g transform="translate(10, -8)" style={{ pointerEvents: "none" }}>
                          <path
                            d="M8.2 1.6H1.6c-.9 0-1.6.7-1.6 1.6v9.8c0 .9.7 1.6 1.6 1.6h11.4c.9 0 1.6-.7 1.6-1.6V4.9c0-.9-.7-1.6-1.6-1.6H9.8L8.2 1.6z"
                            fill="rgba(99, 102, 241, 0.12)"
                            stroke="#6366f1"
                            strokeWidth="1.2"
                          />
                        </g>
                      ) : (
                        <circle
                          cx={14}
                          cy={0}
                          r={4.5}
                          fill="rgba(16, 185, 129, 0.15)"
                          stroke="#10b981"
                          strokeWidth="1.5"
                          style={{ pointerEvents: "none" }}
                        />
                      )}

                      <text
                        x={isCategory ? 34 : 26}
                        y={4}
                        fontSize={isCategory ? "13px" : "12px"}
                        fontWeight={isCategory ? 700 : 500}
                        fill={isMatched ? "#c2410c" : "#1e293b"}
                        style={{ pointerEvents: "none", letterSpacing: "-0.2px" }}
                      >
                        {node.name.length > (isCategory ? 16 : 14) 
                          ? `${node.name.substring(0, isCategory ? 15 : 13)}...` 
                          : node.name}
                      </text>

                      {isCategory && node.children.length > 0 && (
                        <g
                          transform={`translate(${rectWidth - 24}, -10)`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCategoryExpand(node.categoryId!);
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          <circle cx={10} cy={10} r={9} fill="rgba(0,0,0,0.03)" stroke="rgba(0,0,0,0.08)" strokeWidth="1" />
                          {isExpanded ? (
                            <path d="M6 10 H14" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
                          ) : (
                            <path d="M6 10 H14 M10 6 V14" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
                          )}
                        </g>
                      )}

                      {isCategory && node.children.length > 0 && (
                        <g transform={`translate(${rectWidth - 48}, -8)`} style={{ pointerEvents: "none" }}>
                          <rect x={0} y={1} width={18} height={14} rx={7} fill="rgba(99, 102, 241, 0.08)" />
                          <text x={9} y={11} fontSize="9px" fontWeight={800} fill="#6366f1" textAnchor="middle">
                            {node.children.length}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>

            <Paper
              elevation={0}
              sx={{
                position: "absolute",
                top: 20,
                right: 20,
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                p: 0.75,
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "rgba(255, 255, 255, 0.85)",
                backdropFilter: "blur(12px)",
                boxShadow: "0 4px 18px rgba(0,0,0,0.05)"
              }}
            >
              <Tooltip title="확대" placement="left">
                <IconButton size="small" onClick={() => setZoom(z => Math.min(3, z * 1.2))}>
                  <ZoomInOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="축소" placement="left">
                <IconButton size="small" onClick={() => setZoom(z => Math.max(0.15, z / 1.2))}>
                  <ZoomOutOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="위치 초기화" placement="left">
                <IconButton size="small" onClick={resetPanZoom}>
                  <RestartAltOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            </Paper>

            {selectedNode && (
              <Paper
                elevation={0}
                sx={{
                  position: "absolute",
                  bottom: 20,
                  left: 20,
                  width: 320,
                  p: 2.2,
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "rgba(255, 255, 255, 0.95)",
                  backdropFilter: "blur(12px)",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                  animation: "slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  "@keyframes slideIn": {
                    from: { transform: "translateY(15px)", opacity: 0 },
                    to: { transform: "translateY(0)", opacity: 1 },
                  }
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {selectedNode.type === "category" ? (
                      <Chip label="Category" size="small" color="primary" sx={{ fontWeight: 800, borderRadius: 1.5, height: 20, fontSize: "10.5px" }} />
                    ) : (
                      <Chip label="Skill" size="small" color="success" sx={{ fontWeight: 800, borderRadius: 1.5, height: 20, fontSize: "10.5px" }} />
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      Level {selectedNode.depth}
                    </Typography>
                  </Stack>
                  <IconButton size="small" onClick={() => setSelectedNode(null)} sx={{ p: 0.25 }}>
                    <CloseOutlined fontSize="small" />
                  </IconButton>
                </Box>
                
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "text.primary", mb: 0.5 }}>
                  {selectedNode.name}
                </Typography>
                
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                  ID: {selectedNode.type === "category" ? selectedNode.categoryId : selectedNode.skillId}
                </Typography>

                <Divider sx={{ my: 1.5 }} />

                {selectedNode.type === "category" ? (
                  <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      하위 카테고리/스킬 개수: <strong style={{ color: "#334155" }}>{selectedNode.children.length}개</strong>
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic", mt: 0.5 }}>
                      * 노드를 클릭하여 해당 카테고리 브랜치를 접거나 펼칠 수 있습니다.
                    </Typography>
                  </Stack>
                ) : (
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      소속 카테고리: <strong style={{ color: "#334155" }}>{
                        listFrom<SkillCategory>(categoriesQuery.data ?? []).find(c => String(c.categoryId) === String(listFrom<SkillDictionaryItem>(dictionaryQuery.data ?? []).find(s => String(s.skillId) === String(selectedNode.skillId))?.categoryId))?.categoryName ?? "-"
                      }</strong>
                    </Typography>
                  </Stack>
                )}
              </Paper>
            )}
          </>
        )}
      </Box>
    </Dialog>
  );
}

export function SkillGraphDictionaryPage() {
  const { canAdmin } = useSkillGraphRoles();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const gridRef = useRef<PageableGridContentHandle<SkillDictionaryItem>>(null);
  const dataSource = useMemo(() => new SkillGraphDictionaryDataSource(), []);
  const [keyword, setKeyword] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [gridFilterActive, setGridFilterActive] = useState(false);
  const [active, setActive] = useState<boolean | "">("");
  const [activeAnchorEl, setActiveAnchorEl] = useState<HTMLElement | null>(null);
  const [selected, setSelected] = useState<SkillDictionaryItem | null>(null);
  const [treeDialogOpen, setTreeDialogOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [embeddingOpen, setEmbeddingOpen] = useState(false);
  const [embeddingJobId, setEmbeddingJobId] = useState("");
  const [embeddingForm, setEmbeddingForm] = useState({
    embeddingProvider: "kure",
    embeddingModel: "nlpai-lab/KURE-v1",
    embeddingDim: "1024",
  });
  const [createForm, setCreateForm] = useState({
    skillName: "",
    normalizedName: "",
    categoryId: "",
    status: "ACTIVE",
  });
  const createMutation = useMutation({
    mutationFn: () => skillGraphApi.createDictionaryItem({
      skillName: createForm.skillName.trim(),
      normalizedName: createForm.normalizedName.trim() || createForm.skillName.trim().toLowerCase(),
      categoryId: createForm.categoryId.trim() || undefined,
      status: createForm.status,
    }),
    onSuccess: () => {
      setCreateOpen(false);
      setCreateForm({ skillName: "", normalizedName: "", categoryId: "", status: "ACTIVE" });
      gridRef.current?.refresh();
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("dashboard") });
    },
  });
  const embeddingMutation = useMutation({
    mutationFn: () => skillGraphApi.generateMissingDictionaryEmbeddings({
      embeddingProvider: embeddingForm.embeddingProvider.trim(),
      embeddingModel: embeddingForm.embeddingModel.trim(),
      embeddingDim: Number(embeddingForm.embeddingDim),
    }),
    onSuccess: (response) => {
      setEmbeddingJobId(response.jobId ?? "");
      setEmbeddingOpen(false);
      gridRef.current?.refresh();
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("dashboard") });
    },
  });
  const activeDictionaryEmbeddingJobQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("active-batch-job", "DICTIONARY_EMBEDDING"),
    queryFn: () => findActiveSkillGraphBatchJob("DICTIONARY_EMBEDDING"),
    enabled: canAdmin && !embeddingJobId,
    refetchInterval: (query) => query.state.data ? 1000 : false,
  });
  useEffect(() => {
    const activeJob = activeDictionaryEmbeddingJobQuery.data;
    if (!activeJob || embeddingJobId) {
      return;
    }
    setEmbeddingJobId(activeJob.jobId);
    queryClient.setQueryData(
      skillGraphQueryKeys.custom("dictionary-embedding-job", activeJob.jobId),
      embeddingJobFromBatchEvent(activeJob)
    );
  }, [activeDictionaryEmbeddingJobQuery.data, embeddingJobId, queryClient]);
  const embeddingJobQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("dictionary-embedding-job", embeddingJobId),
    queryFn: () => skillGraphApi.getDictionaryEmbeddingJob(embeddingJobId),
    enabled: Boolean(embeddingJobId),
    refetchInterval: (query) => {
      const job = query.state.data as SkillDictionaryEmbeddingJob | undefined;
      return isEmbeddingJobActive(job?.status) ? 1000 : false;
    },
  });
  useEffect(() => {
    if (!embeddingJobId) {
      return undefined;
    }
    const client = new StompRealtimeClient();
    client.subscribe(`/topic/skillgraph/jobs/${embeddingJobId}`, (payload: SkillGraphBatchJobEvent) => {
      if (payload.jobType && payload.jobType !== "DICTIONARY_EMBEDDING") {
        return;
      }
      queryClient.setQueryData(
        skillGraphQueryKeys.custom("dictionary-embedding-job", embeddingJobId),
        embeddingJobFromBatchEvent(payload)
      );
    });
    client.connect();
    return () => client.disconnect();
  }, [embeddingJobId, queryClient]);
  const embeddingJob = embeddingJobQuery.data;
  const embeddingJobActive = embeddingMutation.isPending || isEmbeddingJobActive(embeddingJob?.status);
  const embeddingProgress = embeddingJobProgress(embeddingJob);
  const embeddingFormValid = embeddingForm.embeddingProvider.trim() !== ""
    && embeddingForm.embeddingModel.trim() !== ""
    && Number(embeddingForm.embeddingDim) > 0;
  const columns = useMemo<ColDef<SkillDictionaryItem>[]>(() => [
    {
      headerName: "스킬명",
      field: "skillName",
      flex: 2,
      sortable: true,
      filter: "agTextColumnFilter",
      cellRenderer: (params: ICellRendererParams<SkillDictionaryItem>) => (
        <Button
          variant="text"
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            setSelected(params.data ?? null);
          }}
          sx={{
            justifyContent: "flex-start",
            minWidth: 0,
            maxWidth: "100%",
            px: 0,
            textAlign: "left",
            textTransform: "none",
          }}
        >
          <Typography noWrap variant="body2" color="primary">
            {params.value ?? "-"}
          </Typography>
        </Button>
      ),
    },
    { headerName: "정규화명", field: "normalizedName", flex: 1, sortable: true, filter: "agTextColumnFilter" },
    { headerName: "유형", field: "skillType", width: 140, sortable: true, filter: "agTextColumnFilter" },
    {
      headerName: "상태",
      field: "status",
      width: 130,
      sortable: true,
      filter: "agTextColumnFilter",
      cellRenderer: ({ value }: { value?: string }) => <StatusBadge value={value} />,
    },
    {
      headerName: "카테고리",
      field: "categoryName",
      flex: 1,
      sortable: true,
      filter: false,
      valueGetter: ({ data }) => data?.categoryName || "-",
    },
    {
      headerName: "임베딩 모델",
      field: "embeddingModel",
      minWidth: 180,
      flex: 1,
      filter: "agTextColumnFilter",
      cellRenderer: ({ value }: { value?: string }) => (
        <Typography noWrap variant="body2">{value || "-"}</Typography>
      ),
    },
    {
      headerName: "생성일",
      colId: "createdAt",
      valueGetter: ({ data }) => formatDate(data?.createdAt),
      width: 180,
      sortable: true,
    },
    {
      headerName: "갱신일",
      colId: "updatedAt",
      valueGetter: ({ data }) => formatDate(data?.updatedAt),
      width: 180,
      sortable: true,
    },
  ], []);
  const activeLabel = active === "" ? "전체" : active ? "Active" : "Inactive";

  function applySearch(value = keywordInput) {
    const nextKeyword = value.trim();
    setKeyword(nextKeyword);
    dataSource.applyFilter({ keyword: nextKeyword, active });
    gridRef.current?.refresh();
  }

  function refreshDictionary() {
    setKeywordInput("");
    setKeyword("");
    setActive("");
    dataSource.applyFilter({});
    gridRef.current?.clearFilters();
    setGridFilterActive(false);
    gridRef.current?.refresh();
  }

  function clearDictionaryGridFilters() {
    gridRef.current?.clearFilters();
    setGridFilterActive(false);
  }

  async function submitDictionaryEmbedding() {
    if (!embeddingFormValid || embeddingJobActive) {
      return;
    }
    const ok = await confirm({
      title: "스킬 사전 임베딩 생성",
      message: `${embeddingForm.embeddingProvider.trim()} / ${embeddingForm.embeddingModel.trim()} 기준으로 임베딩이 없는 스킬 사전 항목만 처리합니다.`,
      okText: "생성",
      cancelText: "취소",
    });
    if (ok) {
      embeddingMutation.mutate();
    }
  }

  useEffect(() => {
    dataSource.applyFilter({ keyword, active });
    gridRef.current?.refresh();
  }, [active, dataSource, keyword]);

  useEffect(() => {
    if (!embeddingJob || isEmbeddingJobActive(embeddingJob.status)) {
      return;
    }
    gridRef.current?.refresh();
    queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.lists() });
    queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("dashboard") });
  }, [embeddingJob, queryClient]);

  return (
    <PageFrame
      title="스킬 사전"
      label="스킬 사전과 alias, 관련 매핑을 관리합니다."
      searchPlaceholder="스킬 검색"
      searchValue={keywordInput}
      onSearchValueChange={setKeywordInput}
      onSearch={applySearch}
      onRefresh={refreshDictionary}
      actions={
        <>
          {gridFilterActive ? (
            <Tooltip title="그리드 필터 조건 초기화">
              <IconButton
                size="small"
                onClick={clearDictionaryGridFilters}
                aria-label="그리드 필터 조건 초기화"
              >
                <RestartAltOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
          <Button
            variant="text"
            size="small"
            onClick={(event) => setActiveAnchorEl(event.currentTarget)}
            sx={{
              height: 40,
              minWidth: 116,
              px: 1.25,
              whiteSpace: "nowrap",
              color: "text.secondary",
              borderRadius: 1,
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            활성 · {activeLabel}
          </Button>
          <Tooltip title={embeddingJobActive ? "embedding 생성 중" : "embedding 생성"}>
            <span>
              <IconButton
                size="small"
                disabled={!canAdmin || embeddingJobActive}
                onClick={() => setEmbeddingOpen(true)}
                aria-label="embedding 생성"
              >
                {embeddingJobActive
                  ? <CircularProgress size={18} color="inherit" />
                  : <TravelExploreOutlined fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="트리 그래프 보기">
            <span>
              <IconButton
                size="small"
                onClick={() => setTreeDialogOpen(true)}
                aria-label="트리 그래프 보기"
              >
                <AccountTreeOutlined fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="스킬 추가">
            <span>
              <IconButton
                size="small"
                disabled={!canAdmin}
                onClick={() => setCreateOpen(true)}
                aria-label="스킬 추가"
              >
                <AddOutlined fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </>
      }
    >
      {embeddingMutation.isPending ? (
        <Alert severity="info" sx={{ mb: 1 }}>
          embedding 생성 job을 등록하는 중입니다.
        </Alert>
      ) : null}
      {embeddingMutation.error ? (
        <Alert severity="error" sx={{ mb: 1 }}>
          {resolveAxiosError(embeddingMutation.error) || "embedding 생성 API가 아직 제공되지 않습니다."}
        </Alert>
      ) : null}
      {embeddingJobQuery.error ? (
        <Alert severity="error" sx={{ mb: 1 }}>
          {resolveAxiosError(embeddingJobQuery.error) || "embedding job 상태 조회에 실패했습니다."}
        </Alert>
      ) : null}
      {embeddingJob ? (
        <Alert
          severity={embeddingJob.status === "FAILED" ? "error" : embeddingJob.status === "PARTIAL" ? "warning" : embeddingJob.status === "COMPLETED" ? "success" : "info"}
          sx={{ mb: 1 }}
        >
          <Stack spacing={0.75}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                embedding job {embeddingJob.jobId} · {embeddingJob.status} · processed{" "}
                {numberValue(embeddingJob.processedCount)} / requested {numberValue(embeddingJob.requestedCount)}
                {" "}· failed {numberValue(embeddingJob.failedCount)} · skipped {numberValue(embeddingJob.skippedCount)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {embeddingProgress}%
              </Typography>
            </Stack>
            {isEmbeddingJobActive(embeddingJob.status) ? (
              <LinearProgress variant={embeddingJob.requestedCount > 0 ? "determinate" : "indeterminate"} value={embeddingProgress} />
            ) : null}
            {embeddingJob.message ? <Typography variant="caption">{embeddingJob.message}</Typography> : null}
          </Stack>
        </Alert>
      ) : embeddingMutation.data ? (
        <Alert severity={(embeddingMutation.data.processedCount ?? 0) > 0 ? "success" : "warning"} sx={{ mb: 1 }}>
          embedding 생성 요청 완료
          {embeddingMutation.data.jobId ? ` · job ${embeddingMutation.data.jobId}` : ""}
          {embeddingMutation.data.status ? ` · ${embeddingMutation.data.status}` : ""}
          {embeddingMutation.data.totalMissingCount != null ? ` · missing ${embeddingMutation.data.totalMissingCount}` : ""}
          {embeddingMutation.data.requestedCount != null ? ` · requested ${embeddingMutation.data.requestedCount}` : ""}
          {embeddingMutation.data.processedCount != null ? ` · processed ${embeddingMutation.data.processedCount}` : ""}
          {embeddingMutation.data.failedCount != null ? ` · failed ${embeddingMutation.data.failedCount}` : ""}
          {embeddingMutation.data.skippedCount != null ? ` · skipped ${embeddingMutation.data.skippedCount}` : ""}
          {embeddingMutation.data.message ? ` · ${embeddingMutation.data.message}` : ""}
        </Alert>
      ) : null}
      <Stack spacing={1}>
        <PageableGridContent<SkillDictionaryItem>
          ref={gridRef}
          datasource={dataSource}
          columns={columns}
          onFilterActived={setGridFilterActive}
        />
      </Stack>
      <DetailDrawer open={Boolean(selected)} title="스킬 상세" onClose={() => setSelected(null)}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <StatusBadge value={selected?.status} />
            <Chip
              size="small"
              label={selected?.embedded ? "임베딩 있음" : "임베딩 없음"}
              color={selected?.embedded ? "success" : "default"}
              variant={selected?.embedded ? "filled" : "outlined"}
            />
            <Chip
              size="small"
              label={selected?.active === false || selected?.status === "INACTIVE" ? "비활성" : "활성"}
              color={selected?.active === false || selected?.status === "INACTIVE" ? "default" : "primary"}
              variant="outlined"
            />
            {selected?.skillType ? <Chip size="small" label={selected.skillType} variant="outlined" /> : null}
          </Stack>
          <DetailRows rows={[
            ["Skill ID", selected?.skillId ?? "-"],
            ["스킬명", selected?.skillName],
            ["정규화명", selected?.normalizedName],
            ["상태", <StatusBadge value={selected?.status} />],
            ["임베딩", selected?.embedded ? "생성됨" : "미생성"],
            ["임베딩 목록", <EmbeddingMetadataTable embeddings={selected?.embeddings} />],
            ["활성 여부", selected?.active === false || selected?.status === "INACTIVE" ? "비활성" : "활성"],
            ["스킬 유형", selected?.skillType ?? "-"],
            ["설명", selected?.description ?? "-"],
            ["Category ID", selected?.categoryId ?? "-"],
            ["카테고리명", selected?.categoryName ?? "-"],
            ["Alias", selected?.aliases?.length ? (
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {selected.aliases.map((alias) => (
                  <Chip
                    key={`${alias.aliasId ?? alias.alias}-${alias.normalizedAlias ?? ""}`}
                    size="small"
                    label={alias.normalizedAlias ? `${alias.alias} (${alias.normalizedAlias})` : alias.alias}
                    variant="outlined"
                  />
                ))}
              </Stack>
            ) : "-"],
            ["관계 수", numberValue(selected?.relations?.length)],
            ["출처 수", numberValue(selected?.sourceCount)],
            ["신뢰도", selected?.confidenceScore != null ? <ScoreBadge value={selected.confidenceScore} /> : "-"],
            ["생성일", formatDate(selected?.createdAt)],
            ["갱신일", formatDate(selected?.updatedAt)],
          ]} />
          <Button startIcon={<SaveOutlined />} disabled={!canAdmin}>수정 저장</Button>
        </Stack>
      </DetailDrawer>
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>스킬 수동 추가</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              서버 Dictionary 생성 API가 연결되면 입력한 스킬을 사전에 직접 등록합니다.
            </Alert>
            <TextField
              label="스킬명"
              value={createForm.skillName}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, skillName: event.target.value }))}
              required
              autoFocus
            />
            <TextField
              label="정규화명"
              value={createForm.normalizedName}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, normalizedName: event.target.value }))}
              placeholder="비워두면 스킬명을 소문자로 사용"
            />
            <TextField
              label="Category ID"
              value={createForm.categoryId}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, categoryId: event.target.value }))}
            />
            <TextField
              label="상태"
              value={createForm.status}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, status: event.target.value }))}
            />
            {createMutation.error ? (
              <Alert severity="error">{resolveAxiosError(createMutation.error) || "스킬 수동 추가에 실패했습니다."}</Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>취소</Button>
          <Button
            variant="contained"
            disabled={!createForm.skillName.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            추가
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={embeddingOpen} onClose={() => setEmbeddingOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>스킬 사전 임베딩 생성</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info">
              선택한 provider/model 기준으로 임베딩이 없는 스킬 사전 항목만 생성합니다.
            </Alert>
            <TextField
              label="Embedding Provider"
              size="small"
              value={embeddingForm.embeddingProvider}
              onChange={(event) => setEmbeddingForm((prev) => ({ ...prev, embeddingProvider: event.target.value }))}
            />
            <TextField
              label="Embedding Model"
              size="small"
              value={embeddingForm.embeddingModel}
              onChange={(event) => setEmbeddingForm((prev) => ({ ...prev, embeddingModel: event.target.value }))}
            />
            <TextField
              label="Dimension"
              type="number"
              size="small"
              value={embeddingForm.embeddingDim}
              onChange={(event) => setEmbeddingForm((prev) => ({ ...prev, embeddingDim: event.target.value }))}
              inputProps={{ min: 1, max: 4096 }}
              fullWidth
            />
            {embeddingMutation.error ? (
              <Alert severity="error">{resolveAxiosError(embeddingMutation.error) || "스킬 사전 임베딩 생성에 실패했습니다."}</Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmbeddingOpen(false)}>취소</Button>
          <Button
            variant="contained"
            disabled={!embeddingFormValid || embeddingJobActive}
            onClick={submitDictionaryEmbedding}
          >
            생성
          </Button>
        </DialogActions>
      </Dialog>
      <Menu
        anchorEl={activeAnchorEl}
        open={Boolean(activeAnchorEl)}
        onClose={() => setActiveAnchorEl(null)}
      >
        {[
          ["", "전체"],
          ["true", "Active"],
          ["false", "Inactive"],
        ].map(([value, label]) => (
          <MenuItem
            key={value || "all"}
            selected={String(active) === value}
            onClick={() => {
              setActive(value === "" ? "" : value === "true");
              setActiveAnchorEl(null);
            }}
          >
            {label}
          </MenuItem>
        ))}
      </Menu>
      <SkillGraphTreeDialog open={treeDialogOpen} onClose={() => setTreeDialogOpen(false)} />
    </PageFrame>
  );
}

function commaList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function SkillGraphCategoryManagementPage() {
  const { canAdmin } = useSkillGraphRoles();
  const queryClient = useQueryClient();
  const gridRef = useRef<PageableGridContentHandle<SkillCategory>>(null);
  const dataSource = useMemo(() => new SkillGraphCategoryDataSource(), []);
  const [keyword, setKeyword] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [parentCategoryId, setParentCategoryId] = useState("");
  const [selected, setSelected] = useState<SkillCategory | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ categoryId: "", name: "", parentCategoryId: "", displayOrder: "0" });
  const [moveForm, setMoveForm] = useState({ parentCategoryId: "", displayOrder: "0" });
  const [skillIds, setSkillIds] = useState("");
  const [clusterForm, setClusterForm] = useState({ projectionId: "", clusterId: "", includeNoise: false });
  const [mergeForm, setMergeForm] = useState({ sourceCategoryIds: "", targetCategoryId: "", deleteSources: true });
  const selectedId = selected?.categoryId;
  const detailQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("category-detail", selectedId),
    queryFn: () => skillGraphApi.getCategory(selectedId ?? ""),
    enabled: Boolean(selectedId),
  });
  const historyQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("category-history", selectedId),
    queryFn: () => skillGraphApi.listCategoryHistory(selectedId ?? "", { page: 0, size: 50, sort: "createdAt,desc" }),
    enabled: Boolean(selectedId),
  });
  const categoryDetail = detailQuery.data ?? selected;
  const historyRows = listFrom<Record<string, unknown>>(historyQuery.data);
  const refreshCategories = () => {
    gridRef.current?.refresh();
    queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("categories") });
    queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("dashboard") });
  };
  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        categoryId: form.categoryId.trim() || undefined,
        categoryName: form.name.trim(),
        parentCategoryId: form.parentCategoryId.trim() || undefined,
        displayOrder: Number(form.displayOrder) || 0,
      };
      return selectedId
        ? skillGraphApi.updateCategory(selectedId, payload)
        : skillGraphApi.createCategory(payload);
    },
    onSuccess: (category) => {
      setEditOpen(false);
      setSelected(category);
      refreshCategories();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (categoryId: string | number) => skillGraphApi.deleteCategory(categoryId),
    onSuccess: () => {
      setSelected(null);
      refreshCategories();
    },
  });
  const moveMutation = useMutation({
    mutationFn: () => skillGraphApi.moveCategory(selectedId ?? "", {
      parentCategoryId: moveForm.parentCategoryId.trim() || undefined,
      displayOrder: Number(moveForm.displayOrder) || 0,
    }),
    onSuccess: (category) => {
      setSelected(category);
      refreshCategories();
    },
  });
  const assignSkillsMutation = useMutation({
    mutationFn: () => skillGraphApi.assignCategorySkills(selectedId ?? "", commaList(skillIds)),
    onSuccess: () => {
      setSkillIds("");
      refreshCategories();
    },
  });
  const assignClusterMutation = useMutation({
    mutationFn: () => skillGraphApi.assignCategoryFromCluster(selectedId ?? "", {
      projectionId: clusterForm.projectionId.trim(),
      clusterId: clusterForm.clusterId.trim(),
      includeNoise: clusterForm.includeNoise,
    }),
    onSuccess: refreshCategories,
  });
  const mergeMutation = useMutation({
    mutationFn: () => skillGraphApi.mergeCategories({
      sourceCategoryIds: commaList(mergeForm.sourceCategoryIds),
      targetCategoryId: mergeForm.targetCategoryId.trim(),
      deleteSources: mergeForm.deleteSources,
    }),
    onSuccess: () => {
      setMergeForm({ sourceCategoryIds: "", targetCategoryId: "", deleteSources: true });
      refreshCategories();
    },
  });
  const columns = useMemo<ColDef<SkillCategory>[]>(() => [
    { headerName: "categoryId", field: "categoryId", width: 180 },
    {
      headerName: "name",
      field: "categoryName",
      flex: 1,
      cellRenderer: (params: ICellRendererParams<SkillCategory>) => (
        <Button
          variant="text"
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            const row = params.data ?? null;
            setSelected(row);
            setMoveForm({
              parentCategoryId: String(row?.parentId ?? row?.parentCategoryId ?? ""),
              displayOrder: String(row?.sortOrder ?? row?.displayOrder ?? 0),
            });
          }}
          sx={{ justifyContent: "flex-start", minWidth: 0, px: 0, textAlign: "left", textTransform: "none" }}
        >
          <Typography noWrap variant="body2" color="primary">{params.value ?? "-"}</Typography>
        </Button>
      ),
    },
    {
      headerName: "parentCategoryId",
      width: 180,
      valueGetter: ({ data }) => data?.parentId ?? data?.parentCategoryId ?? "-",
    },
    {
      headerName: "displayOrder",
      width: 140,
      valueGetter: ({ data }) => data?.sortOrder ?? data?.displayOrder ?? 0,
    },
    {
      headerName: "스킬 수",
      field: "skillCount",
      width: 110,
      type: "numericColumn",
      valueGetter: ({ data }) => data?.skillCount ?? 0,
    },
    {
      headerName: "작업",
      width: 112,
      pinned: "right",
      cellRenderer: (params: ICellRendererParams<SkillCategory>) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="수정">
            <span>
              <IconButton
                size="small"
                disabled={!canAdmin}
                onClick={(event) => {
                  event.stopPropagation();
                  const row = params.data;
                  if (!row) return;
                  setSelected(row);
                  setForm({
                    categoryId: String(row.categoryId ?? ""),
                    name: row.categoryName ?? row.name ?? "",
                    parentCategoryId: String(row.parentId ?? row.parentCategoryId ?? ""),
                    displayOrder: String(row.sortOrder ?? row.displayOrder ?? 0),
                  });
                  setEditOpen(true);
                }}
              >
                <SaveOutlined fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      ),
    },
  ], [canAdmin]);

  function applySearch(value = keywordInput) {
    const nextKeyword = value.trim();
    const nextParent = parentCategoryId.trim();
    setKeyword(nextKeyword);
    dataSource.applyFilter({ keyword: nextKeyword, parentCategoryId: nextParent || undefined });
    gridRef.current?.refresh();
  }

  function openCreate() {
    setSelected(null);
    setForm({ categoryId: "", name: "", parentCategoryId: "", displayOrder: "0" });
    setEditOpen(true);
  }

  useEffect(() => {
    dataSource.applyFilter({ keyword, parentCategoryId: parentCategoryId.trim() || undefined });
    gridRef.current?.refresh();
  }, [dataSource, keyword, parentCategoryId]);

  return (
    <PageFrame
      title="카테고리 관리"
      label="저장된 카테고리 마스터와 스킬 배정을 관리합니다."
      searchPlaceholder="카테고리명 검색"
      searchValue={keywordInput}
      onSearchValueChange={setKeywordInput}
      onSearch={applySearch}
      onRefresh={() => gridRef.current?.refresh()}
      actions={
        <>
          <TextField
            size="small"
            label="Parent ID"
            value={parentCategoryId}
            onChange={(event) => setParentCategoryId(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applySearch();
            }}
            sx={{ width: 180 }}
          />
          <Tooltip title="카테고리 생성">
            <span>
              <IconButton size="small" disabled={!canAdmin} onClick={openCreate} aria-label="카테고리 생성">
                <AddOutlined fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </>
      }
    >
      <PageableGridContent<SkillCategory>
        ref={gridRef}
        datasource={dataSource}
        columns={columns}
      />
      <DetailDrawer open={Boolean(selected)} title="카테고리 상세" onClose={() => setSelected(null)}>
        <Stack spacing={2}>
          {detailQuery.error ? <Alert severity="error">{resolveAxiosError(detailQuery.error) || "카테고리 상세 조회에 실패했습니다."}</Alert> : null}
          <DetailRows rows={[
            ["categoryId", categoryDetail?.categoryId],
            ["name", categoryDetail?.categoryName],
            ["parentCategoryId", categoryDetail?.parentId ?? categoryDetail?.parentCategoryId ?? "-"],
            ["displayOrder", categoryDetail?.sortOrder ?? categoryDetail?.displayOrder ?? 0],
            ["skillCount", categoryDetail?.skillCount ?? "-"],
          ]} />
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              disabled={!canAdmin || !categoryDetail}
              onClick={() => {
                if (!categoryDetail) return;
                setForm({
                  categoryId: String(categoryDetail.categoryId ?? ""),
                  name: categoryDetail.categoryName ?? categoryDetail.name ?? "",
                  parentCategoryId: String(categoryDetail.parentId ?? categoryDetail.parentCategoryId ?? ""),
                  displayOrder: String(categoryDetail.sortOrder ?? categoryDetail.displayOrder ?? 0),
                });
                setEditOpen(true);
              }}
            >
              수정
            </Button>
            <Button
              color="error"
              disabled={!canAdmin || !selectedId || deleteMutation.isPending}
              onClick={() => {
                if (selectedId && window.confirm("선택한 카테고리를 삭제할까요?")) {
                  deleteMutation.mutate(selectedId);
                }
              }}
            >
              삭제
            </Button>
          </Stack>
          {deleteMutation.error ? <Alert severity="error">{resolveAxiosError(deleteMutation.error) || "카테고리 삭제에 실패했습니다."}</Alert> : null}

          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack spacing={1.25}>
              <Typography variant="subtitle2">계층 이동</Typography>
              <TextField
                size="small"
                label="Parent Category ID"
                value={moveForm.parentCategoryId}
                onChange={(event) => setMoveForm((prev) => ({ ...prev, parentCategoryId: event.target.value }))}
              />
              <TextField
                size="small"
                label="Display Order"
                type="number"
                value={moveForm.displayOrder}
                onChange={(event) => setMoveForm((prev) => ({ ...prev, displayOrder: event.target.value }))}
              />
              <Button
                startIcon={<DriveFileMoveOutlined />}
                disabled={!canAdmin || !selectedId || moveMutation.isPending}
                onClick={() => moveMutation.mutate()}
              >
                이동 저장
              </Button>
              {moveMutation.error ? <Alert severity="error">{resolveAxiosError(moveMutation.error) || "카테고리 이동에 실패했습니다."}</Alert> : null}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack spacing={1.25}>
              <Typography variant="subtitle2">선택 스킬 배정</Typography>
              <TextField
                label="Skill IDs"
                value={skillIds}
                onChange={(event) => setSkillIds(event.target.value)}
                placeholder="skill-1, skill-2 또는 줄바꿈 입력"
                minRows={3}
                multiline
              />
              <Button disabled={!canAdmin || !selectedId || !commaList(skillIds).length || assignSkillsMutation.isPending} onClick={() => assignSkillsMutation.mutate()}>
                스킬 배정
              </Button>
              {assignSkillsMutation.error ? <Alert severity="error">{resolveAxiosError(assignSkillsMutation.error) || "스킬 배정에 실패했습니다."}</Alert> : null}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack spacing={1.25}>
              <Typography variant="subtitle2">클러스터 기반 배정</Typography>
              <TextField
                size="small"
                label="Projection ID"
                value={clusterForm.projectionId}
                onChange={(event) => setClusterForm((prev) => ({ ...prev, projectionId: event.target.value }))}
              />
              <TextField
                size="small"
                label="Cluster ID"
                value={clusterForm.clusterId}
                onChange={(event) => setClusterForm((prev) => ({ ...prev, clusterId: event.target.value }))}
              />
              <FormControlLabel
                control={<Switch size="small" checked={clusterForm.includeNoise} onChange={(event) => setClusterForm((prev) => ({ ...prev, includeNoise: event.target.checked }))} />}
                label="Noise 포함"
              />
              <Button disabled={!canAdmin || !selectedId || !clusterForm.projectionId.trim() || !clusterForm.clusterId.trim() || assignClusterMutation.isPending} onClick={() => assignClusterMutation.mutate()}>
                클러스터 전체 스킬 배정
              </Button>
              {assignClusterMutation.error ? <Alert severity="error">{resolveAxiosError(assignClusterMutation.error) || "클러스터 배정에 실패했습니다."}</Alert> : null}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack spacing={1.25}>
              <Typography variant="subtitle2">카테고리 병합</Typography>
              <TextField
                label="Source Category IDs"
                value={mergeForm.sourceCategoryIds}
                onChange={(event) => setMergeForm((prev) => ({ ...prev, sourceCategoryIds: event.target.value }))}
                placeholder="server, api"
                minRows={2}
                multiline
              />
              <TextField
                size="small"
                label="Target Category ID"
                value={mergeForm.targetCategoryId}
                onChange={(event) => setMergeForm((prev) => ({ ...prev, targetCategoryId: event.target.value }))}
              />
              <FormControlLabel
                control={<Switch size="small" checked={mergeForm.deleteSources} onChange={(event) => setMergeForm((prev) => ({ ...prev, deleteSources: event.target.checked }))} />}
                label="Source 삭제"
              />
              <Button disabled={!canAdmin || !commaList(mergeForm.sourceCategoryIds).length || !mergeForm.targetCategoryId.trim() || mergeMutation.isPending} onClick={() => mergeMutation.mutate()}>
                병합 실행
              </Button>
              {mergeMutation.error ? <Alert severity="error">{resolveAxiosError(mergeMutation.error) || "카테고리 병합에 실패했습니다."}</Alert> : null}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2">변경 이력</Typography>
              {historyQuery.error ? (
                <Alert severity="error">{resolveAxiosError(historyQuery.error) || "변경 이력 조회에 실패했습니다."}</Alert>
              ) : historyQuery.isLoading ? (
                <LoadingState />
              ) : historyRows.length === 0 ? (
                <EmptyState title="변경 이력이 없습니다." />
              ) : (
                historyRows.slice(0, 10).map((row, index) => (
                  <Typography key={index} variant="caption" color="text.secondary">
                    {JSON.stringify(row)}
                  </Typography>
                ))
              )}
            </Stack>
          </Paper>
        </Stack>
      </DetailDrawer>
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{selectedId ? "카테고리 수정" : "카테고리 생성"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Category ID"
              value={form.categoryId}
              disabled={Boolean(selectedId)}
              onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}
              placeholder="서버 자동 생성이면 비워둠"
            />
            <TextField
              label="Name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
              autoFocus
            />
            <TextField
              label="Parent Category ID"
              value={form.parentCategoryId}
              onChange={(event) => setForm((prev) => ({ ...prev, parentCategoryId: event.target.value }))}
              placeholder="최상위 카테고리는 비워둠"
            />
            <TextField
              label="Display Order"
              type="number"
              value={form.displayOrder}
              onChange={(event) => setForm((prev) => ({ ...prev, displayOrder: event.target.value }))}
            />
            {saveMutation.error ? <Alert severity="error">{resolveAxiosError(saveMutation.error) || "카테고리 저장에 실패했습니다."}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>취소</Button>
          <Button variant="contained" disabled={!form.name.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            저장
          </Button>
        </DialogActions>
      </Dialog>
    </PageFrame>
  );
}

interface CategoryDraft {
  clusterId: string;
  categoryName: string;
  itemCount: number;
  algorithm?: string;
  confidence?: number;
  representativeSkillNames?: string[];
  selected: boolean;
}

interface ClusterSummary {
  clusterId: string;
  label: string;
  itemCount: number;
  noise: boolean;
  representativeSkillIds?: string[];
  confidence?: number | null;
  metadata?: string | null;
  algorithm?: string;
}

interface DraftSaveResult {
  categories: SkillCategory[];
  assignedCount: number;
  assignmentFailedCount: number;
}

export function SkillGraphCategoriesPage() {
  const { canAdmin } = useSkillGraphRoles();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedProjectionId, setSelectedProjectionId] = useState("");
  const [hoveredPoint, setHoveredPoint] = useState<SkillClusterPoint | null>(null);
  const [hoverLookupSkillId, setHoverLookupSkillId] = useState<string | number | undefined>();
  const [selectedClusterId, setSelectedClusterId] = useState("");
  const [showNoisePoints, setShowNoisePoints] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [clusterSearchQuery, setClusterSearchQuery] = useState("");
  const [useLlmCategoryDraft, setUseLlmCategoryDraft] = useState(true);
  const [assignClusterOnSave, setAssignClusterOnSave] = useState(true);
  const [clusterGenerationForm, setClusterGenerationForm] = useState({
    reductionAlgorithm: "UMAP",
    embeddingProvider: "kure",
    embeddingModel: "nlpai-lab/KURE-v1",
    embeddingDimension: 1024,
    skillType: "",
    projectionType: "CLUSTERING",
    projectionDimension: 2,
    limit: 1000,
    parameters: "",
  });
  const [clusterGenerationJobId, setClusterGenerationJobId] = useState("");
  const [categoryDrafts, setCategoryDrafts] = useState<CategoryDraft[]>([]);
  const [savedDraftCategories, setSavedDraftCategories] = useState<SkillCategory[]>([]);
  const [taxonomySaved, setTaxonomySaved] = useState(false);
  const [draftSaveResult, setDraftSaveResult] = useState<DraftSaveResult | null>(null);
  const [reconcileResult, setReconcileResult] = useState<SkillCategoryReconcileResult | null>(null);
  const [relationSavedClusterIds, setRelationSavedClusterIds] = useState<string[]>([]);
  const projectionsQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("category-projections"),
    queryFn: () => skillGraphApi.listProjections({ page: 0, size: 100, sort: "updatedAt,desc" }),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
  const projections = projectionSummariesFrom(projectionsQuery.data);
  const selectedProjection = projections.find((projection) => projection.projectionId === selectedProjectionId);
  const categoriesQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("category-draft-master-categories"),
    queryFn: () => skillGraphApi.listCategories({ page: 0, size: 1000, sort: ["displayOrder,asc", "name,asc"] }),
    staleTime: 60 * 1000,
  });
  const categoryMasterRows = listFrom<SkillCategory>(categoriesQuery.data);
  const projectionPointsQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("category-projection-points", selectedProjectionId),
    queryFn: () => skillGraphApi.listClusters({
      objectId: selectedProjectionId,
      page: 0,
      size: SKILLGRAPH_PROJECTION_POINT_LIMIT,
      sort: "displayOrder,asc",
    }),
    enabled: Boolean(selectedProjectionId),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
  const projectionPoints = pointsFrom(projectionPointsQuery.data);
  const noisePointCount = projectionPoints.filter(isNoisePoint).length;
  const visibleProjectionPoints = showNoisePoints ? projectionPoints : projectionPoints.filter((point) => !isNoisePoint(point));

  const clustersQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("category-clusters", selectedProjectionId),
    queryFn: () => skillGraphApi.listClusterItems(selectedProjectionId),
    enabled: Boolean(selectedProjectionId),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
  const clustersData = useMemo(() => {
    return listFrom<SkillCluster>(clustersQuery.data);
  }, [clustersQuery.data]);

  const pointLookupMap = useMemo(() => {
    const map = new Map<string, string>();
    projectionPoints.forEach((point) => {
      const id = String(point.skillId || point.targetId);
      if (id && point.label) {
        map.set(id, point.label);
      }
    });
    return map;
  }, [projectionPoints]);

  const clusterSummaries = useMemo(() => {
    const summaries = clusterSummariesFrom(projectionPoints);
    const clustersMap = new Map<string, SkillCluster>();
    clustersData.forEach((c) => {
      clustersMap.set(String(c.clusterId), c);
    });

    return summaries.map((s) => {
      const detail = clustersMap.get(s.clusterId);
      if (detail) {
        return {
          ...s,
          representativeSkillIds: detail.representativeSkillIds,
          confidence: detail.confidence,
          metadata: detail.metadata,
          algorithm: detail.algorithm,
        };
      }
      return s;
    });
  }, [projectionPoints, clustersData]);

  const categoryByClusterId = useMemo(() => {
    const map = new Map<string, SkillCategory>();
    [...categoryMasterRows, ...savedDraftCategories].forEach((category) => {
      map.set(String(category.categoryId), category);
    });
    return map;
  }, [categoryMasterRows, savedDraftCategories]);

  const clusterNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    clusterSummaries.forEach((cluster) => {
      map[cluster.clusterId] = cluster.label;
    });
    categoryByClusterId.forEach((cat, id) => {
      map[id] = cat.categoryName;
    });
    categoryDrafts.forEach((draft) => {
      if (draft.categoryName) {
        map[String(draft.clusterId)] = draft.categoryName;
      }
    });
    return map;
  }, [categoryByClusterId, categoryDrafts, clusterSummaries]);

  const clusterDisplayName = (clusterId: string | number) => {
    const id = String(clusterId);
    return clusterNamesMap[id] || `Cluster ${id}`;
  };

  const filteredClusterSummaries = useMemo(() => {
    const query = clusterSearchQuery.trim().toLowerCase();
    if (!query) return clusterSummaries;
    return clusterSummaries.filter((cluster) => {
      const savedCategory = categoryByClusterId.get(cluster.clusterId);
      const name = (clusterNamesMap[cluster.clusterId] || savedCategory?.categoryName || cluster.label).toLowerCase();
      const id = cluster.clusterId.toLowerCase();
      return name.includes(query) || id.includes(query);
    });
  }, [clusterSummaries, clusterSearchQuery, categoryByClusterId, clusterNamesMap]);

  const maxClusterItemCount = useMemo(() => {
    const validClusters = clusterSummaries.filter((c) => !c.noise);
    if (validClusters.length === 0) return 1;
    return Math.max(...validClusters.map((c) => c.itemCount));
  }, [clusterSummaries]);

  const selectedCluster = clusterSummaries.find((cluster) => cluster.clusterId === selectedClusterId);
  const membersQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("cluster-members", selectedProjectionId, selectedClusterId),
    queryFn: () => skillGraphApi.listClusterMembers(selectedProjectionId, selectedClusterId),
    enabled: Boolean(selectedProjectionId && selectedClusterId),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
  const memberRows = useMemo(() => {
    const rawList = listFrom<SkillClusterMember>(membersQuery.data);
    return [...rawList].sort((a, b) => (a.distanceToCentroid ?? 0) - (b.distanceToCentroid ?? 0));
  }, [membersQuery.data]);
  const hoveredPointSkillId = hoveredPoint?.skillId ?? hoveredPoint?.targetId;
  const hoveredPointSkillQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("projection-point-skill", hoverLookupSkillId),
    queryFn: () => skillGraphApi.getDictionaryItem(String(hoverLookupSkillId)),
    enabled: Boolean(hoverLookupSkillId),
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  });
  const hoveredPointTitle = hoveredPointSkillQuery.data && String(hoveredPointSkillQuery.data.skillId) === String(hoveredPointSkillId)
    ? `${hoveredPointSkillQuery.data.skillName}\n${hoveredPointSkillQuery.data.normalizedName}\n${hoveredPointSkillQuery.data.skillId}`
    : undefined;
  const generateTaxonomyMutation = useMutation({
    mutationFn: () => {
      const paramsText = clusterGenerationForm.parameters.trim();
      if (paramsText) {
        try {
          JSON.parse(paramsText);
        } catch (e) {
          throw new Error("파라미터 설정이 올바른 JSON 형식이 아닙니다.", { cause: e });
        }
      }
      return skillGraphApi.createProjection({
        reductionAlgorithm: clusterGenerationForm.reductionAlgorithm,
        clusteringAlgorithm: "HDBSCAN",
        embeddingProvider: clusterGenerationForm.embeddingProvider.trim(),
        embeddingModel: clusterGenerationForm.embeddingModel.trim(),
        embeddingDimension: Number(clusterGenerationForm.embeddingDimension),
        skillType: clusterGenerationForm.skillType || undefined,
        projectionType: clusterGenerationForm.projectionType.trim() || undefined,
        projectionDimension: Number(clusterGenerationForm.projectionDimension),
        limit: Number(clusterGenerationForm.limit),
        parameters: paramsText || undefined,
      });
    },
    onSuccess: (response) => {
      setClusterGenerationJobId(response.jobId ?? "");
      setTaxonomySaved(false);
      setSavedDraftCategories([]);
      setDraftSaveResult(null);
      setReconcileResult(null);
      setRelationSavedClusterIds([]);
      setCategoryDrafts([]);
    },
  });
  const activeClusterGenerationJobQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("active-batch-job", "SKILL_CLUSTER_GENERATION"),
    queryFn: () => findActiveSkillGraphBatchJob("SKILL_CLUSTER_GENERATION"),
    enabled: canAdmin && !clusterGenerationJobId,
  });
  useEffect(() => {
    const activeJob = activeClusterGenerationJobQuery.data;
    if (!activeJob || clusterGenerationJobId) {
      return;
    }
    setClusterGenerationJobId(activeJob.jobId);
    queryClient.setQueryData(skillGraphQueryKeys.custom("cluster-generation-job", activeJob.jobId), activeJob);
  }, [activeClusterGenerationJobQuery.data, clusterGenerationJobId, queryClient]);
  const clusterGenerationJobQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("cluster-generation-job", clusterGenerationJobId),
    queryFn: () => skillGraphApi.getSkillGraphBatchJob(clusterGenerationJobId),
    enabled: Boolean(clusterGenerationJobId),
    refetchInterval: (query) => isBatchJobActive((query.state.data as SkillGraphBatchJobEvent | undefined)?.status) ? 2000 : false,
  });
  useEffect(() => {
    if (!clusterGenerationJobId) {
      return undefined;
    }
    const client = new StompRealtimeClient();
    client.subscribe(`/topic/skillgraph/jobs/${clusterGenerationJobId}`, (payload: SkillGraphBatchJobEvent) => {
      if (payload.jobType && payload.jobType !== "SKILL_CLUSTER_GENERATION") {
        return;
      }
      queryClient.setQueryData(skillGraphQueryKeys.custom("cluster-generation-job", clusterGenerationJobId), payload);
      if (!isBatchJobActive(payload.status)) {
        queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("category-projections") });
        const projectionId = projectionIdFromBatchJob(payload);
        if (projectionId) {
          setSelectedProjectionId(projectionId);
        }
      }
    });
    client.connect();
    return () => client.disconnect();
  }, [clusterGenerationJobId, queryClient]);
  const proposeCategoryNamesMutation = useMutation({
    mutationFn: () => skillGraphApi.generateCategoryDrafts(selectedProjectionId, 5, useLlmCategoryDraft),
    onSuccess: (response) => {
      setTaxonomySaved(false);
      setSavedDraftCategories([]);
      setDraftSaveResult(null);
      setReconcileResult(null);
      setRelationSavedClusterIds([]);
      setCategoryDrafts(response.drafts
        .filter((draft) => !draft.noise)
        .map((draft) => ({
          clusterId: draft.clusterId,
          categoryName: draft.suggestedCategoryName || draft.proposedName || draft.clusterId,
          itemCount: draft.itemCount,
          confidence: draft.confidence,
          representativeSkillNames: draft.representativeSkillNames,
          selected: true,
        })));
    },
  });
  const reconcileCategoryDraftsMutation = useMutation({
    mutationFn: () => skillGraphApi.reconcileCategoryDrafts({
      useLlm: useLlmCategoryDraft,
    }),
    onSuccess: (response) => {
      setTaxonomySaved(false);
      setSavedDraftCategories([]);
      setDraftSaveResult(null);
      setReconcileResult(response);
      setRelationSavedClusterIds([]);
      setCategoryDrafts(response.newCategoryDrafts
        .filter((draft) => !draft.noise)
        .map((draft) => ({
          clusterId: draft.clusterId,
          categoryName: draft.suggestedCategoryName || draft.proposedName || draft.clusterId,
          itemCount: draft.itemCount,
          confidence: draft.confidence,
          representativeSkillNames: draft.representativeSkillNames,
          selected: true,
        })));
    },
  });
  const saveDraftsMutation = useMutation({
    mutationFn: async () => {
      const selectedDrafts = categoryDrafts.filter((draft) => draft.selected && draft.categoryName.trim());
      const categories = await skillGraphApi.saveCategoryDrafts(selectedDrafts.map((draft, index) => ({
        categoryId: draft.clusterId,
        name: draft.categoryName.trim(),
        displayOrder: index,
      })));
      if (!assignClusterOnSave || !selectedProjectionId) {
        return { categories, assignedCount: 0, assignmentFailedCount: 0 };
      }
      const assignments = await Promise.allSettled(categories.map((category) => (
        skillGraphApi.assignCategoryFromCluster(category.categoryId, {
          projectionId: selectedProjectionId,
          clusterId: String(category.categoryId),
          includeNoise: false,
        })
      )));
      return {
        categories,
        assignedCount: assignments.filter((result) => result.status === "fulfilled").length,
        assignmentFailedCount: assignments.filter((result) => result.status === "rejected").length,
      };
    },
    onSuccess: (response) => {
      setCategoryDrafts([]);
      setSavedDraftCategories(response.categories);
      setDraftSaveResult(response);
      setTaxonomySaved(true);
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("categories") });
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("category-draft-master-categories") });
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("dashboard") });
    },
  });
  const assignDraftRepresentativesMutation = useMutation({
    mutationFn: async (category: SkillCategory) => {
      const representatives = await skillGraphApi.listClusterRepresentatives(selectedProjectionId, String(category.categoryId), {
        page: 0,
        size: 10,
        sort: "representativeScore,desc",
        includeNoise: false,
      });
      const skillIds = listFrom<SkillClusterRepresentative>(representatives).map((representative) => String(representative.skillId));
      if (!skillIds.length) {
        throw new Error("대표 스킬 후보가 없습니다.");
      }
      return skillGraphApi.assignCategorySkills(category.categoryId, skillIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("categories") });
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("dashboard") });
    },
  });
  const assignDraftClusterMutation = useMutation({
    mutationFn: (category: SkillCategory) => skillGraphApi.assignCategoryFromCluster(category.categoryId, {
      projectionId: selectedProjectionId,
      clusterId: String(category.categoryId),
      includeNoise: false,
    }),
    onSuccess: (_response, category) => {
      setRelationSavedClusterIds((prev) => Array.from(new Set([...prev, String(category.categoryId)])));
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("categories") });
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("category-draft-master-categories") });
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("dashboard") });
    },
  });
  const nonNoiseClusters = useMemo(() => clusterSummaries.filter((c) => !c.noise), [clusterSummaries]);
  const savedClustersCount = useMemo(() => {
    return nonNoiseClusters.filter((c) => categoryByClusterId.has(c.clusterId)).length;
  }, [nonNoiseClusters, categoryByClusterId]);

  const isTaxonomyAlreadySaved = useMemo(() => {
    if (!selectedProjectionId || nonNoiseClusters.length === 0) return false;
    return savedClustersCount === nonNoiseClusters.length;
  }, [selectedProjectionId, nonNoiseClusters, savedClustersCount]);

  const isTaxonomyPartiallySaved = useMemo(() => {
    if (!selectedProjectionId || nonNoiseClusters.length === 0) return false;
    return savedClustersCount > 0 && savedClustersCount < nonNoiseClusters.length;
  }, [selectedProjectionId, nonNoiseClusters, savedClustersCount]);

  const selectedDraftCount = categoryDrafts.filter((draft) => draft.selected && draft.categoryName.trim()).length;
  const clusterGenerationJob = clusterGenerationJobQuery.data;
  const clusterGenerationJobActive = generateTaxonomyMutation.isPending || isBatchJobActive(clusterGenerationJob?.status);
  const clusterGenerationProgress = batchJobProgress(clusterGenerationJob);
  const parametersJsonValid = useMemo(() => {
    const paramsText = clusterGenerationForm.parameters.trim();
    if (!paramsText) return true;
    try {
      JSON.parse(paramsText);
      return true;
    } catch {
      return false;
    }
  }, [clusterGenerationForm.parameters]);

  const canGenerateClusterData = Boolean(
    canAdmin
    && !clusterGenerationJobActive
    && clusterGenerationForm.embeddingProvider.trim()
    && clusterGenerationForm.embeddingModel.trim()
    && Number(clusterGenerationForm.embeddingDimension) > 0
    && Number(clusterGenerationForm.projectionDimension) > 0
    && Number(clusterGenerationForm.limit) > 0
    && parametersJsonValid
  );
  const workflowStep = (taxonomySaved || isTaxonomyAlreadySaved)
    ? 4
    : isTaxonomyPartiallySaved || categoryDrafts.length > 0
      ? 3
      : selectedProjectionId
        ? 1
        : 0;

  useEffect(() => {
    if (!hoveredPointSkillId) {
      setHoverLookupSkillId(undefined);
      return;
    }
    const timer = window.setTimeout(() => {
      setHoverLookupSkillId(hoveredPointSkillId);
    }, PROJECTION_POINT_HOVER_LOOKUP_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [hoveredPointSkillId]);

  useEffect(() => {
    if (!clusterGenerationJob || isBatchJobActive(clusterGenerationJob.status)) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("category-projections") });
    const projectionId = projectionIdFromBatchJob(clusterGenerationJob);
    if (projectionId) {
      setSelectedProjectionId(projectionId);
    }
  }, [clusterGenerationJob, queryClient]);

  return (
    <PageFrame
      title="카테고리 초안"
      label="projection 기반 카테고리 초안을 생성하고 저장합니다. 저장은 카테고리 마스터 생성까지만 수행합니다."
      actions={
        <Button variant="outlined" onClick={() => navigate("/services/ai/skillgraph/category-management")}>
          카테고리 관리에서 열기
        </Button>
      }
    >
      <Stack spacing={2}>
        {/* Stepper Flow Card */}
        <Card
          variant="outlined"
          sx={{
            borderRadius: "8px",
            boxShadow: "none",
            bgcolor: "background.paper",
            borderColor: "divider",
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2.5, color: "text.primary", display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ width: 4, height: 16, bgcolor: "primary.main", borderRadius: 1 }} />
              자동 카테고리 생성 흐름
            </Typography>
            <Stepper
              activeStep={workflowStep}
              alternativeLabel
              sx={{
                mb: 3.5,
                "& .MuiStepConnector-line": {
                  borderColor: "divider",
                  borderTopWidth: 2,
                },
                "& .MuiStepConnector-root.Mui-active .MuiStepConnector-line": {
                  borderColor: "primary.main",
                },
                "& .MuiStepConnector-root.Mui-completed .MuiStepConnector-line": {
                  borderColor: "primary.main",
                },
                "& .MuiStepLabel-label": {
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: "text.secondary",
                },
                "& .MuiStepLabel-label.Mui-active": {
                  color: "primary.main",
                  fontWeight: 600,
                },
                "& .MuiStepLabel-label.Mui-completed": {
                  color: "text.primary",
                  fontWeight: 500,
                },
                "& .MuiStepIcon-root": {
                  color: "action.disabled",
                },
                "& .MuiStepIcon-root.Mui-active": {
                  color: "primary.main",
                },
                "& .MuiStepIcon-root.Mui-completed": {
                  color: "success.main",
                },
              }}
            >
              {["HDBSCAN 군집", "대표 스킬 추출", "LLM 카테고리명", "관리자 검토"].map((label) => (
                <Step key={label}>
                  <StepButton disabled sx={{ cursor: "default !important", opacity: 1 }}>
                    {label}
                  </StepButton>
                </Step>
              ))}
            </Stepper>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr 1fr" }, gap: 2 }}>
              {[
                { step: 0, title: "1차: HDBSCAN", desc: "자연 군집을 찾고 noise 스킬을 분리합니다." },
                { step: 1, title: "2차: 대표 스킬", desc: "centroid 근처, 빈도, confidence 기준으로 후보를 고릅니다." },
                { step: 2, title: "3차: LLM 명명", desc: "대표 스킬 묶음을 운영 가능한 카테고리명으로 제안합니다." },
                { step: 3, title: "4차: 검토/저장", desc: "관리자가 명칭 수정, 병합/분리 후 Taxonomy로 저장합니다." }
              ].map(({ step, title, desc }) => {
                const isActive = workflowStep === step;
                const isCompleted = workflowStep > step;
                return (
                  <Paper
                    key={step}
                    variant="outlined"
                    sx={{
                      p: 2,
                      bgcolor: isActive ? "background.paper" : isCompleted ? "rgba(46, 125, 50, 0.03)" : "rgba(0,0,0,0.015)",
                      borderColor: isActive ? "primary.main" : isCompleted ? "success.light" : "divider",
                      borderRadius: "8px",
                      boxShadow: "none",
                      transform: "none",
                      transition: "all 0.2s ease",
                      position: "relative",
                      "&::before": isActive ? {
                        content: '""',
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: "3px",
                        background: "linear-gradient(90deg, #1565c0 0%, #42a5f5 100%)",
                        borderTopLeftRadius: "8px",
                        borderTopRightRadius: "8px",
                      } : isCompleted ? {
                        content: '""',
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: "3px",
                        background: "linear-gradient(90deg, #2e7d32 0%, #4caf50 100%)",
                        borderTopLeftRadius: "8px",
                        borderTopRightRadius: "8px",
                      } : undefined,
                      "&:hover": !isActive ? {
                        bgcolor: "rgba(0,0,0,0.03)",
                        borderColor: "text.disabled",
                      } : undefined
                    }}
                  >
                    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: isActive ? "primary.main" : isCompleted ? "success.main" : "text.primary"
                        }}
                      >
                        {title}
                      </Typography>
                      {isCompleted && (
                        <DoneOutlined sx={{ fontSize: 16, color: "success.main" }} />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75, lineHeight: 1.4 }}>
                      {desc}
                    </Typography>
                  </Paper>
                );
              })}
            </Box>
          </CardContent>
        </Card>

        {/* Info Alert */}
        {taxonomySaved || isTaxonomyAlreadySaved ? (
          <Alert severity="success" sx={{ borderRadius: 1.5 }}>
            선택한 프로젝션의 모든 클러스터가 이미 카테고리 마스터(Taxonomy)로 저장되어 연동 완료되었습니다. 아래 '클러스터 탐색' 뷰에서 스킬 및 관계를 검토/저장하십시오.
          </Alert>
        ) : isTaxonomyPartiallySaved ? (
          <Alert severity="warning" sx={{ borderRadius: 1.5 }}>
            선택한 프로젝션의 클러스터 중 일부가 카테고리 마스터(Taxonomy)로 저장되었습니다. (저장됨: {savedClustersCount} / 전체: {nonNoiseClusters.length}개). 미저장된 클러스터는 &apos;카테고리명 제안&apos;을 실행하여 저장을 완료하십시오.
          </Alert>
        ) : (
          <Alert severity="info" sx={{ borderRadius: 1.5 }}>
            {categoryDrafts.length
              ? "클러스터별 제안 카테고리명을 검토하고 저장할 항목만 선택한 뒤 선택 Taxonomy 저장을 실행합니다."
              : selectedProjectionId
                ? "선택한 projection의 분포를 확인할 수 있습니다. 군집데이터 생성이 완료되면 '1단계: 군집'과 '2단계: 대표 스킬 후보 추출'이 동시에 완료된 상태입니다. 바로 '카테고리명 제안(3단계)'을 실행하여 카테고리 이름을 제안받으십시오."
                : "기존 projection을 선택하거나 군집데이터 생성으로 새 projection과 카테고리 초안을 만듭니다. 실제 스킬 배정은 아래 '클러스터 탐색' 뷰 또는 Skill Categories 화면에서 수행합니다."}
          </Alert>
        )}

        {/* Redesigned Control Panel */}
        <Card variant="outlined" sx={{ bgcolor: "background.paper", borderRadius: "8px", boxShadow: "none" }}>
          <CardContent sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
              카테고리 초안 생성 및 저장 설정
            </Typography>
            <Alert severity="info" sx={{ mb: 2, borderRadius: 1.5 }}>
              군집데이터 생성은 선택한 스킬 사전 임베딩 모델의 벡터를 2차원으로 축소한 뒤 HDBSCAN 군집을 저장합니다. UMAP은 비선형 구조를 잘 보존하고, PCA는 빠르고 재현성이 높은 선형 축소 방식입니다.
            </Alert>
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                mb: 2.5,
              }}
            >
              <Box sx={{ width: "100%" }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 500 }}>
                  스킬 맵 Projection 선택
                </Typography>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: "100%" }}>
                  <Select
                     size="small"
                     value={selectedProjectionId}
                     displayEmpty
                     onChange={(event) => {
                       setSelectedProjectionId(event.target.value);
                       setHoveredPoint(null);
                       setSelectedClusterId("");
                     }}
                     fullWidth
                     renderValue={(value) => {
                       const selected = projections.find((projection) => projection.projectionId === value);
                       if (!selected) return "Projection 선택";
                       
                       const condition = `${selected.skillType || "전체"} / ${selected.embeddingProvider || "-"} / ${selected.embeddingModel || "-"} / ${selected.reductionAlgorithm || "-"} / ${selected.algorithm || "HDBSCAN"}`;
                       const parts = [
                         selected.name || selected.projectionId,
                         `${numberValue(selected.itemCount)} items`,
                         condition,
                         selected.status
                       ].filter(Boolean);

                       return (
                         <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                           {parts.join("  |  ")}
                         </Typography>
                       );
                     }}
                     sx={{ width: "100%", minHeight: 40 }}
                  >
                    <MenuItem value="">Projection 선택</MenuItem>
                    {projections.map((projection) => {
                      const condition = `${projection.skillType || "전체"} / ${projection.embeddingProvider || "-"} / ${projection.embeddingModel || "-"} / ${projection.reductionAlgorithm || "-"} / ${projection.algorithm || "HDBSCAN"}`;
                      return (
                        <MenuItem key={projection.projectionId} value={projection.projectionId}>
                          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: "100%" }}>
                            <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 120, fontWeight: 600 }}>
                              {projection.name || projection.projectionId}
                            </Typography>
                            <Chip size="small" variant="outlined" label={`${numberValue(projection.itemCount)} items`} sx={{ height: 20 }} />
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 400 }}>
                              {condition}
                            </Typography>
                            {projection.status ? <Chip size="small" label={projection.status} sx={{ height: 20 }} /> : null}
                          </Stack>
                        </MenuItem>
                      );
                    })}
                  </Select>
                  {projectionsQuery.isLoading ? <CircularProgress size={20} sx={{ flexShrink: 0 }} /> : null}
                </Stack>
              </Box>
            </Box>

            <Stack spacing={2.5}>
              {/* Group 1: 군집 생성 설정 및 버튼 */}
              <Paper variant="outlined" sx={{ p: 2, bgcolor: "rgba(0, 0, 0, 0.015)", borderRadius: "8px", boxShadow: "none" }}>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.5, display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Box sx={{ width: 3, height: 12, bgcolor: "primary.main", borderRadius: 0.5 }} />
                  1. 신규 군집데이터 생성 설정
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr 1fr" },
                    gap: 2,
                    mb: 2,
                    alignItems: "end"
                  }}
                >
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 500 }}>
                      차원축소 알고리즘
                    </Typography>
                    <Select
                      size="small"
                      fullWidth
                      value={clusterGenerationForm.reductionAlgorithm}
                      onChange={(event) => setClusterGenerationForm((prev) => ({ ...prev, reductionAlgorithm: event.target.value }))}
                    >
                      <MenuItem value="UMAP">UMAP</MenuItem>
                      <MenuItem value="PCA">PCA</MenuItem>
                    </Select>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 500 }}>
                      임베딩 Provider
                    </Typography>
                    <TextField
                      size="small"
                      fullWidth
                      value={clusterGenerationForm.embeddingProvider}
                      onChange={(event) => setClusterGenerationForm((prev) => ({ ...prev, embeddingProvider: event.target.value }))}
                      placeholder="kure"
                    />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 500 }}>
                      벡터 모델
                    </Typography>
                    <TextField
                      size="small"
                      fullWidth
                      value={clusterGenerationForm.embeddingModel}
                      onChange={(event) => setClusterGenerationForm((prev) => ({ ...prev, embeddingModel: event.target.value }))}
                      placeholder="nlpai-lab/KURE-v1"
                    />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 500 }}>
                      Dimension
                    </Typography>
                    <TextField
                      size="small"
                      fullWidth
                      type="number"
                      value={clusterGenerationForm.embeddingDimension}
                      onChange={(event) => setClusterGenerationForm((prev) => ({ ...prev, embeddingDimension: Number(event.target.value) }))}
                      inputProps={{ min: 1 }}
                    />
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 500 }}>
                      스킬 타입
                    </Typography>
                    <Select
                      size="small"
                      fullWidth
                      value={clusterGenerationForm.skillType}
                      onChange={(event) => setClusterGenerationForm((prev) => ({ ...prev, skillType: event.target.value }))}
                    >
                      <MenuItem value="">전체 (미지정)</MenuItem>
                      <MenuItem value="TASK_SKILL">TASK_SKILL (태스크)</MenuItem>
                      <MenuItem value="TECH_SKILL">TECH_SKILL (기술)</MenuItem>
                      <MenuItem value="ROLE_SKILL">ROLE_SKILL (역할)</MenuItem>
                    </Select>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 500 }}>
                      용도 (Projection Type)
                    </Typography>
                    <Select
                      size="small"
                      fullWidth
                      value={clusterGenerationForm.projectionType}
                      onChange={(event) => setClusterGenerationForm((prev) => ({ ...prev, projectionType: event.target.value }))}
                    >
                      <MenuItem value="CLUSTERING">CLUSTERING (군집)</MenuItem>
                      <MenuItem value="RECOMMENDATION">RECOMMENDATION (추천)</MenuItem>
                      <MenuItem value="SEARCH">SEARCH (검색)</MenuItem>
                      <MenuItem value="VISUALIZATION">VISUALIZATION (시각화)</MenuItem>
                    </Select>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 500 }}>
                      차원축소 결과 차원
                    </Typography>
                    <TextField
                      size="small"
                      fullWidth
                      type="number"
                      value={clusterGenerationForm.projectionDimension}
                      onChange={(event) => setClusterGenerationForm((prev) => ({ ...prev, projectionDimension: Number(event.target.value) }))}
                      inputProps={{ min: 1 }}
                    />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 500 }}>
                      제한 개수 (Limit)
                    </Typography>
                    <TextField
                      size="small"
                      fullWidth
                      type="number"
                      value={clusterGenerationForm.limit}
                      onChange={(event) => setClusterGenerationForm((prev) => ({ ...prev, limit: Number(event.target.value) }))}
                      inputProps={{ min: 1 }}
                    />
                  </Box>

                  <Box sx={{ gridColumn: { xs: "span 1", sm: "span 2", md: "span 4" } }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 500 }}>
                      실행 파라미터 (JSON)
                    </Typography>
                    <TextField
                      size="small"
                      fullWidth
                      multiline
                      rows={3}
                      value={clusterGenerationForm.parameters}
                      onChange={(event) => setClusterGenerationForm((prev) => ({ ...prev, parameters: event.target.value }))}
                      placeholder='예: { "n_neighbors": 15, "min_dist": 0.1 }'
                      error={!parametersJsonValid}
                      helperText={!parametersJsonValid ? "올바른 JSON 형식이 아닙니다." : ""}
                      FormHelperTextProps={{ sx: { mx: 0 } }}
                    />
                  </Box>
                </Box>
                <Button
                  variant="contained"
                  size="small"
                  disabled={!canGenerateClusterData}
                  startIcon={clusterGenerationJobActive ? <CircularProgress size={16} color="inherit" /> : undefined}
                  onClick={() => generateTaxonomyMutation.mutate()}
                  sx={{ mt: 0.5, height: 32 }}
                >
                  {clusterGenerationJobActive ? "군집 생성 중" : "군집데이터 생성"}
                </Button>
              </Paper>

              {/* Group 2: 카테고리명 제안 및 조정 설정 */}
              <Paper variant="outlined" sx={{ p: 2, bgcolor: "rgba(0, 0, 0, 0.015)", borderRadius: "8px", boxShadow: "none" }}>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.5, display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Box sx={{ width: 3, height: 12, bgcolor: "info.main", borderRadius: 0.5 }} />
                  2. 카테고리명 제안 및 조정 초안 실행
                </Typography>
                
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, mb: 2, pt: 0.5 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={useLlmCategoryDraft}
                        onChange={(event) => setUseLlmCategoryDraft(event.target.checked)}
                      />
                    }
                    label="LLM 사용 (제안 생성용)"
                    sx={{ ".MuiFormControlLabel-label": { fontSize: 13, fontWeight: 500 } }}
                  />
                </Box>

                <Stack direction="row" spacing={1.5}>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={!canAdmin || !selectedProjectionId || proposeCategoryNamesMutation.isPending}
                    startIcon={proposeCategoryNamesMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
                    onClick={() => proposeCategoryNamesMutation.mutate()}
                    sx={{ height: 32 }}
                  >
                    {proposeCategoryNamesMutation.isPending ? "제안 생성 중" : "카테고리명 제안 (3단계)"}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={!canAdmin || reconcileCategoryDraftsMutation.isPending}
                    startIcon={reconcileCategoryDraftsMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
                    onClick={() => reconcileCategoryDraftsMutation.mutate()}
                    sx={{ height: 32 }}
                  >
                    {reconcileCategoryDraftsMutation.isPending ? "재조정 중" : "재조정 초안 생성"}
                  </Button>
                </Stack>
              </Paper>

              {/* Group 3: Taxonomy 마스터 저장 실행 */}
              <Paper variant="outlined" sx={{ p: 2, bgcolor: "rgba(46, 125, 50, 0.02)", borderColor: "success.light", borderRadius: "8px", boxShadow: "none" }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ sm: "center" }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Box sx={{ width: 3, height: 12, bgcolor: "success.main", borderRadius: 0.5 }} />
                      3. 분류 체계 Taxonomy 저장
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                      작성 및 검토가 완료된 카테고리 초안 리스트에서 항목을 선택하여 카테고리 마스터 테이블에 반영합니다.
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={assignClusterOnSave}
                            onChange={(event) => setAssignClusterOnSave(event.target.checked)}
                          />
                        }
                        label="저장 시 스킬 자동 배정 실행"
                        sx={{ ".MuiFormControlLabel-label": { fontSize: 12.5, fontWeight: 500, color: "text.secondary" } }}
                      />
                    </Box>
                  </Box>
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    disabled={!canAdmin || !selectedDraftCount || saveDraftsMutation.isPending}
                    startIcon={saveDraftsMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <SaveOutlined />}
                    onClick={() => saveDraftsMutation.mutate()}
                    sx={{ px: 2, height: 32, flexShrink: 0 }}
                  >
                    {saveDraftsMutation.isPending ? "저장 중" : `선택 카테고리 마스터 저장 (${selectedDraftCount}개)`}
                  </Button>
                </Stack>
              </Paper>
            </Stack>
            {clusterGenerationJob ? (
              <Alert
                severity={clusterGenerationJob.status === "FAILED" ? "error" : clusterGenerationJob.status === "COMPLETED" ? "success" : "info"}
                sx={{ mt: 2, borderRadius: 1.5 }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      군집데이터 생성 job {clusterGenerationJob.jobId} · {clusterGenerationJob.status} · processed{" "}
                      {numberValue(clusterGenerationJob.processedCount)} / requested {numberValue(clusterGenerationJob.requestedCount)}
                      {" "}· clusters {numberValue(clusterGenerationJob.resultCount)}
                    </Typography>
                    {clusterGenerationJobActive ? <Chip size="small" label={`${clusterGenerationProgress}%`} /> : null}
                  </Stack>
                  {clusterGenerationJobActive ? (
                    <LinearProgress
                      variant={clusterGenerationJob.requestedCount ? "determinate" : "indeterminate"}
                      value={clusterGenerationJob.requestedCount ? clusterGenerationProgress : undefined}
                    />
                  ) : null}
                  {clusterGenerationJob.errorMessage ? <Typography variant="caption">{clusterGenerationJob.errorMessage}</Typography> : null}
                </Stack>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        {/* Mutation Errors & Success Alerts */}
        {generateTaxonomyMutation.error ? (
          <Alert severity="error" sx={{ borderRadius: 1.5 }}>{resolveAxiosError(generateTaxonomyMutation.error) || "자동 카테고리 생성에 실패했습니다."}</Alert>
        ) : null}
        {saveDraftsMutation.error ? (
          <Alert severity="error" sx={{ borderRadius: 1.5 }}>{resolveAxiosError(saveDraftsMutation.error) || "Taxonomy 저장에 실패했습니다."}</Alert>
        ) : null}
        {proposeCategoryNamesMutation.error ? (
          <Alert severity="error" sx={{ borderRadius: 1.5 }}>{resolveAxiosError(proposeCategoryNamesMutation.error) || "카테고리명 제안에 실패했습니다."}</Alert>
        ) : null}
        {reconcileCategoryDraftsMutation.error ? (
          <Alert severity="error" sx={{ borderRadius: 1.5 }}>{resolveAxiosError(reconcileCategoryDraftsMutation.error) || "카테고리 재조정 초안 생성에 실패했습니다."}</Alert>
        ) : null}
        {proposeCategoryNamesMutation.data ? (
          <Alert severity="success" sx={{ borderRadius: 1.5 }}>
            카테고리명 제안 완료 · {useLlmCategoryDraft ? "LLM" : "rule"} · drafts {proposeCategoryNamesMutation.data.draftCount.toLocaleString()} · noise{" "}
            {proposeCategoryNamesMutation.data.noiseCount.toLocaleString()}
          </Alert>
        ) : null}
        {reconcileResult ? (
          <Alert severity="success" sx={{ borderRadius: 1.5 }}>
            카테고리 재조정 초안 생성 완료 · scanned {reconcileResult.scannedCount.toLocaleString()} · existing match{" "}
            {reconcileResult.matchedExistingCount.toLocaleString()} · new drafts {reconcileResult.newCategoryDraftCount.toLocaleString()} · noise{" "}
            {reconcileResult.noiseCount.toLocaleString()}
          </Alert>
        ) : null}
        {taxonomySaved ? (
          <Alert severity={draftSaveResult?.assignmentFailedCount ? "warning" : "success"} sx={{ borderRadius: 1.5 }}>
            카테고리 마스터를 생성했습니다.
            {assignClusterOnSave
              ? ` 클러스터 스킬 배정 ${draftSaveResult?.assignedCount ?? 0}건 완료${draftSaveResult?.assignmentFailedCount ? `, 실패 ${draftSaveResult.assignmentFailedCount}건` : ""}.`
              : " 실제 스킬 배정은 아래 '클러스터 탐색' 뷰 또는 Skill Categories 관리 페이지에서 수행합니다."}
            <Button size="small" sx={{ ml: 1 }} onClick={() => navigate("/services/ai/skillgraph/category-management")}>
              카테고리 관리에서 열기
            </Button>
          </Alert>
        ) : null}
        {projectionsQuery.error ? (
          <Alert severity="error" sx={{ borderRadius: 1.5 }}>{resolveAxiosError(projectionsQuery.error) || "projection 목록 조회에 실패했습니다."}</Alert>
        ) : null}

        {/* Category Drafts Review Table */}
        {categoryDrafts.length ? (
          <Card variant="outlined" sx={{ borderRadius: "8px", boxShadow: "none" }}>
            <CardContent sx={{ p: 2.5, pb: "20px !important" }}>
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "text.primary" }}>
                    저장 전 검토할 카테고리 초안
                  </Typography>
                  <Chip
                    size="small"
                    color="primary"
                    label={`선택됨: ${selectedDraftCount}개 / 전체: ${categoryDrafts.length}개`}
                    variant="outlined"
                    sx={{ fontWeight: 600 }}
                  />
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setCategoryDrafts((prev) => prev.map((draft) => ({ ...draft, selected: true })))}
                  >
                    전체 선택
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    color="secondary"
                    onClick={() => setCategoryDrafts((prev) => prev.map((draft) => ({ ...draft, selected: false })))}
                  >
                    전체 해제
                  </Button>
                </Stack>
              </Stack>

              <Box sx={{ overflowX: "auto", border: "1px solid rgba(224, 224, 224, 0.6)", borderRadius: 2 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid rgba(224, 224, 224, 0.8)", backgroundColor: "rgba(0, 0, 0, 0.015)" }}>
                      <th style={{ padding: "14px 16px", width: 48, verticalAlign: "middle" }}>
                        <SelectionCheckbox
                          ariaLabel="전체 카테고리 draft 선택"
                          checked={categoryDrafts.every((d) => d.selected)}
                          indeterminate={categoryDrafts.some((d) => d.selected) && !categoryDrafts.every((d) => d.selected)}
                          onChange={(checked) =>
                            setCategoryDrafts((prev) => prev.map((draft) => ({ ...draft, selected: checked })))
                          }
                        />
                      </th>
                      <th style={{ padding: "14px 16px", fontSize: 13, fontWeight: 700, color: "rgba(0, 0, 0, 0.6)", width: 60 }}>순번</th>
                      <th style={{ padding: "14px 16px", fontSize: 13, fontWeight: 700, color: "rgba(0, 0, 0, 0.6)", width: 180 }}>클러스터명</th>
                      <th style={{ padding: "14px 16px", fontSize: 13, fontWeight: 700, color: "rgba(0, 0, 0, 0.6)", width: 80, textAlign: "center" }}>지도</th>
                      <th style={{ padding: "14px 16px", fontSize: 13, fontWeight: 700, color: "rgba(0, 0, 0, 0.6)" }}>제안 카테고리명 (수정 가능)</th>
                      <th style={{ padding: "14px 16px", fontSize: 13, fontWeight: 700, color: "rgba(0, 0, 0, 0.6)", width: 100 }}>스킬 수</th>
                      <th style={{ padding: "14px 16px", fontSize: 13, fontWeight: 700, color: "rgba(0, 0, 0, 0.6)", width: 180 }}>신뢰도</th>
                      <th style={{ padding: "14px 16px", fontSize: 13, fontWeight: 700, color: "rgba(0, 0, 0, 0.6)" }}>대표 스킬 예시</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryDrafts.map((draft, index) => {
                      const percentage = draft.confidence != null ? Math.round(draft.confidence * 100) : 0;
                      let confidenceColor = "#d32f2f";
                      let confidenceBg = "rgba(211, 47, 47, 0.08)";
                      let confidenceBorder = "1px solid rgba(211, 47, 47, 0.25)";
                      let confidenceLabel = "Low";
                      if (draft.confidence != null) {
                        if (draft.confidence >= 0.8) {
                          confidenceColor = "#2e7d32";
                          confidenceBg = "rgba(46, 125, 50, 0.08)";
                          confidenceBorder = "1px solid rgba(46, 125, 50, 0.25)";
                          confidenceLabel = "High";
                        } else if (draft.confidence >= 0.5) {
                          confidenceColor = "#ed6c02";
                          confidenceBg = "rgba(237, 108, 2, 0.08)";
                          confidenceBorder = "1px solid rgba(237, 108, 2, 0.25)";
                          confidenceLabel = "Mid";
                        }
                      }
                      return (
                        <tr
                          key={draft.clusterId}
                          style={{
                            borderBottom: "1px solid rgba(224, 224, 224, 0.5)",
                            borderLeft: `5px solid ${clusterColor(draft.clusterId)}`,
                            backgroundColor: draft.selected ? "rgba(21, 101, 192, 0.02)" : "transparent",
                            transition: "background-color 0.2s ease",
                          }}
                        >
                          <td style={{ padding: "10px 16px", verticalAlign: "middle" }}>
                            <SelectionCheckbox
                              ariaLabel="카테고리 draft 선택"
                              checked={draft.selected}
                              onChange={(checked) =>
                                setCategoryDrafts((prev) =>
                                  prev.map((row) => (row.clusterId === draft.clusterId ? { ...row, selected: checked } : row))
                                )
                              }
                            />
                          </td>
                          <td style={{ padding: "10px 16px", fontSize: 13, color: "rgba(0, 0, 0, 0.87)", verticalAlign: "middle" }}>{index + 1}</td>
                          <td style={{ padding: "10px 16px", verticalAlign: "middle" }}>
                            <Stack spacing={0.25}>
                              <Typography variant="body2" sx={{ fontSize: 13, color: "rgba(0, 0, 0, 0.87)", fontWeight: 700, lineHeight: 1.25 }}>
                                {clusterDisplayName(draft.clusterId)}
                              </Typography>
                              <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.1 }}>
                                {draft.clusterId}
                              </Typography>
                            </Stack>
                          </td>
                          <td style={{ padding: "10px 16px", textAlign: "center", verticalAlign: "middle" }}>
                            <Tooltip title="지도에서 클러스터 하이라이트">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedClusterId(String(draft.clusterId));
                                  const element = document.getElementById("projection-explorer-card");
                                  if (element) {
                                    element.scrollIntoView({ behavior: "smooth", block: "center" });
                                  }
                                }}
                                sx={{
                                  transition: "transform 0.2s",
                                  "&:hover": {
                                    transform: "scale(1.15)",
                                  }
                                }}
                              >
                                <TravelExploreOutlined fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </td>
                          <td style={{ padding: "6px 16px", verticalAlign: "middle" }}>
                            <TextField
                              fullWidth
                              placeholder="카테고리명 지정"
                              value={draft.categoryName}
                              onChange={(event) =>
                                setCategoryDrafts((prev) =>
                                  prev.map((row) => (row.clusterId === draft.clusterId ? { ...row, categoryName: event.target.value } : row))
                                )
                              }
                              size="small"
                              sx={{
                                backgroundColor: "background.paper",
                                "& .MuiInputBase-input": { py: 0.75, fontSize: 13, fontWeight: 500 },
                              }}
                            />
                          </td>
                          <td style={{ padding: "10px 16px", verticalAlign: "middle" }}>
                            <Chip size="small" variant="outlined" label={`${draft.itemCount.toLocaleString()}개`} sx={{ fontWeight: 500 }} />
                          </td>
                          <td style={{ padding: "10px 16px", verticalAlign: "middle" }}>
                            {draft.confidence != null ? (
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Chip
                                  size="small"
                                  label={`${confidenceLabel} (${percentage}%)`}
                                  sx={{
                                    bgcolor: confidenceBg,
                                    border: confidenceBorder,
                                    color: confidenceColor,
                                    fontWeight: 700,
                                    fontSize: "11px",
                                    height: 20
                                  }}
                                />
                                <Box sx={{ width: 44, bgcolor: "action.hover", height: 6, borderRadius: 3, overflow: "hidden", display: { xs: "none", sm: "block" } }}>
                                  <Box sx={{ width: `${percentage}%`, bgcolor: confidenceColor, height: "100%", borderRadius: 3 }} />
                                </Box>
                              </Stack>
                            ) : (
                              <Typography variant="caption" color="text.secondary">-</Typography>
                            )}
                          </td>
                          <td style={{ padding: "10px 16px", verticalAlign: "middle" }}>
                            {draft.representativeSkillNames?.length ? (
                              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                {draft.representativeSkillNames.slice(0, 4).map((name) => (
                                  <Chip
                                    key={name}
                                    size="small"
                                    label={name}
                                    variant="outlined"
                                    sx={{ fontSize: 11.5, height: 20, bgcolor: "rgba(0, 0, 0, 0.02)", fontWeight: 500 }}
                                  />
                                ))}
                                {draft.representativeSkillNames.length > 4 ? (
                                  <Tooltip title={draft.representativeSkillNames.slice(4).join(", ")}>
                                    <Chip
                                      size="small"
                                      label={`+${draft.representativeSkillNames.length - 4}`}
                                      sx={{ fontSize: 11, height: 20, cursor: "help", fontWeight: 600 }}
                                    />
                                  </Tooltip>
                                ) : null}
                              </Stack>
                            ) : (
                              <Chip size="small" variant="outlined" label={draft.algorithm ?? "cluster"} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Box>
            </CardContent>
          </Card>
        ) : null}

        {/* Projection Explorer Section */}
        {selectedProjectionId ? (
          <Card id="projection-explorer-card" variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Stack spacing={2}>
                {/* Structured Header Row */}
                <Stack spacing={2} sx={{ mb: 1 }}>
                  {/* Top line: Title & Status */}
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} justifyContent="space-between">
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary" }}>
                        클러스터 분포 및 탐색
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ bgcolor: "action.hover", px: 1, py: 0.25, borderRadius: 1, fontFamily: "monospace" }}>
                        {selectedProjection?.name || selectedProjectionId}
                      </Typography>
                      {(taxonomySaved || isTaxonomyAlreadySaved) ? (
                        <Chip
                          size="small"
                          color="success"
                          label="Taxonomy 연동 완료"
                          sx={{ fontWeight: 700, height: 22 }}
                        />
                      ) : isTaxonomyPartiallySaved ? (
                        <Chip
                          size="small"
                          color="warning"
                          label="Taxonomy 부분 연동"
                          sx={{ fontWeight: 700, height: 22 }}
                        />
                      ) : null}
                    </Stack>

                    {/* Controls (Search & Switch) */}
                    <Stack direction="row" spacing={2} alignItems="center">
                      <TextField
                        size="small"
                        value={searchKeyword}
                        onChange={(event) => setSearchKeyword(event.target.value)}
                        placeholder="스킬 검색 highlight"
                        sx={{
                          width: 200,
                          "& .MuiInputBase-input": { py: 0.75, fontSize: 13 },
                          bgcolor: "background.paper",
                          borderRadius: 1,
                        }}
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={showNoisePoints}
                            onChange={(event) => setShowNoisePoints(event.target.checked)}
                          />
                        }
                        label="Noise 표시"
                        sx={{ ml: 0.5, ".MuiFormControlLabel-label": { fontSize: 13, fontWeight: 500 } }}
                      />
                    </Stack>
                  </Stack>

                  {/* Bottom line: Detailed Metadata Badges */}
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center", bgcolor: "rgba(0, 0, 0, 0.015)", p: 1.5, borderRadius: 1.5, border: "1px solid", borderColor: "divider" }}>
                    <Chip size="small" label={`전체 스킬: ${numberValue(selectedProjection?.itemCount ?? projectionPoints.length)}개`} sx={{ fontWeight: 600 }} />
                    <Chip size="small" variant="outlined" label={`클러스터: ${numberValue(selectedProjection?.clusterCount)}개`} />
                    <Chip size="small" variant="outlined" label={`Noise 스킬: ${noisePointCount.toLocaleString()}개`} />
                    {selectedProjection?.reductionAlgorithm ? <Chip size="small" variant="outlined" label={`축소 알고리즘: ${selectedProjection.reductionAlgorithm}`} /> : null}
                    {selectedProjection?.embeddingModel ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        color="info"
                        label={`임베딩 모델: ${selectedProjection.embeddingProvider || ""}/${selectedProjection.embeddingModel}${selectedProjection.embeddingDimension ? ` (${selectedProjection.embeddingDimension}d)` : ""}`}
                        sx={{ fontWeight: 500 }}
                      />
                    ) : null}
                    {selectedProjection?.algorithm ? <Chip size="small" variant="outlined" label={`군집 알고리즘: ${selectedProjection.algorithm}`} /> : null}
                  </Box>
                </Stack>

                {visibleProjectionPoints.length === 0 ? (
                  <EmptyState title="projection point가 없습니다." />
                ) : (
                  <ScatterSvg
                    points={visibleProjectionPoints}
                    selectedClusterId={selectedClusterId}
                    hoveredPoint={hoveredPoint}
                    hoveredTitle={hoveredPointTitle}
                    onHover={setHoveredPoint}
                    onSelect={(point) => {
                      setSelectedClusterId(isNoisePoint(point) ? "" : String(point.clusterId ?? ""));
                    }}
                    searchKeyword={searchKeyword}
                    clusterNames={clusterNamesMap}
                  />
                )}

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "340px minmax(0, 1fr)" }, gap: 2.5, alignItems: "stretch" }}>
                  {/* Left: Parent Cluster List Panel */}
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      height: 580,
                      minHeight: 0,
                      display: "flex",
                      flexDirection: "column",
                      borderRadius: 2,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
                      bgcolor: "background.paper"
                    }}
                  >
                    <Stack spacing={1.5} sx={{ minHeight: 0, flex: 1 }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "text.primary" }}>
                          클러스터 목록
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          조회할 클러스터를 선택하십시오.
                        </Typography>
                      </Box>
                      
                      <TextField
                        size="small"
                        value={clusterSearchQuery}
                        onChange={(event) => setClusterSearchQuery(event.target.value)}
                        placeholder="클러스터명 또는 ID 검색..."
                        sx={{
                          mb: 0.5,
                          "& .MuiInputBase-input": { py: 0.75, fontSize: 12.5 },
                          bgcolor: "background.paper",
                          borderRadius: 1,
                        }}
                      />

                      {projectionPointsQuery.error ? (
                        <Alert severity="error">{resolveAxiosError(projectionPointsQuery.error) || "projection point 조회에 실패했습니다."}</Alert>
                      ) : projectionPointsQuery.isLoading ? (
                        <LoadingState />
                      ) : filteredClusterSummaries.length === 0 ? (
                        <EmptyState title="검색된 클러스터가 없습니다." />
                      ) : (
                        <Stack spacing={0.5} sx={{ minHeight: 0, flex: 1, overflowY: "auto", pr: 0.5 }}>
                          {filteredClusterSummaries.map((cluster) => {
                            const savedCategory = categoryByClusterId.get(cluster.clusterId);
                            const selected = selectedClusterId === cluster.clusterId;
                            return (
                              <ListItemButton
                                key={cluster.clusterId}
                                disabled={cluster.noise}
                                selected={selected}
                                onClick={() => setSelectedClusterId(cluster.clusterId)}
                                sx={{
                                  borderRadius: 1.5,
                                  mb: 0.5,
                                  border: "1px solid",
                                  borderColor: selected ? "primary.main" : "divider",
                                  bgcolor: selected ? "rgba(21, 101, 192, 0.04)" : "background.paper",
                                  "&.Mui-selected": {
                                    bgcolor: "rgba(21, 101, 192, 0.08)",
                                    color: "primary.main",
                                  },
                                  "&.Mui-selected:hover": {
                                    bgcolor: "rgba(21, 101, 192, 0.12)",
                                  },
                                  px: 1.5,
                                  py: 1,
                                  transition: "all 0.2s ease",
                                }}
                              >
                                <Stack spacing={0.75} sx={{ width: "100%", minWidth: 0 }}>
                                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: "100%", minWidth: 0 }}>
                                    <Box
                                      sx={{
                                        width: 10,
                                        height: 10,
                                        flex: "0 0 auto",
                                        borderRadius: "50%",
                                        bgcolor: clusterColor(cluster.clusterId, cluster.noise),
                                        border: "1px solid",
                                        borderColor: cluster.noise ? "text.secondary" : "transparent",
                                        opacity: cluster.noise ? 0.6 : 0.95,
                                      }}
                                    />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      <Typography variant="body2" noWrap sx={{ fontWeight: 700, fontSize: 13, color: selected ? "primary.main" : "text.primary" }}>
                                        {clusterNamesMap[cluster.clusterId] || savedCategory?.categoryName || cluster.label}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ fontSize: 11.5 }}>
                                        {cluster.itemCount.toLocaleString()} skills{cluster.noise ? " · noise" : ""}
                                        {savedCategory ? ` · taxonomy ${savedCategory.categoryId}` : ""}
                                      </Typography>
                                    </Box>
                                    {savedCategory ? (
                                      <Chip
                                        size="small"
                                        color="success"
                                        variant="outlined"
                                        label="저장됨"
                                        sx={{ height: 18, fontSize: 9.5, px: 0.25, fontWeight: 600 }}
                                      />
                                    ) : null}
                                  </Stack>
                                  {/* Additional cluster fields (confidence, representatives, metadata) */}
                                  {!cluster.noise && (cluster.confidence != null || cluster.representativeSkillIds?.length || cluster.metadata) ? (
                                    <Box sx={{ pl: 3.25, mt: 0.5 }}>
                                      {cluster.representativeSkillIds && cluster.representativeSkillIds.length > 0 ? (
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 11, fontStyle: "italic" }}>
                                          대표 스킬: {(cluster.representativeSkillIds || []).map(id => pointLookupMap.get(String(id)) || id).slice(0, 3).join(", ")}
                                          {cluster.representativeSkillIds.length > 3 ? " 외..." : ""}
                                        </Typography>
                                      ) : null}
                                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.5 }}>
                                        {cluster.confidence != null ? (
                                          <Chip
                                            size="small"
                                            variant="outlined"
                                            color={cluster.confidence > 0.7 ? "primary" : "default"}
                                            label={`신뢰도: ${Math.round(cluster.confidence * 100)}%`}
                                            sx={{ height: 16, fontSize: 9, px: 0.25 }}
                                          />
                                        ) : null}
                                        {cluster.algorithm ? (
                                          <Chip
                                            size="small"
                                            variant="outlined"
                                            label={cluster.algorithm}
                                            sx={{ height: 16, fontSize: 9, px: 0.25 }}
                                          />
                                        ) : null}
                                        {cluster.metadata ? (
                                          <Tooltip title={cluster.metadata}>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9.5, cursor: "help", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>
                                              {cluster.metadata}
                                            </Typography>
                                          </Tooltip>
                                        ) : null}
                                      </Stack>
                                    </Box>
                                  ) : null}
                                  {/* Relative Size Progress Bar */}
                                  {!cluster.noise && (
                                    <Box sx={{ pl: 3.25, pr: 1, width: "100%" }}>
                                      <Box
                                        sx={{
                                          height: 4,
                                          borderRadius: 2,
                                          bgcolor: "rgba(0, 0, 0, 0.04)",
                                          width: "100%",
                                          overflow: "hidden"
                                        }}
                                      >
                                        <Box
                                          sx={{
                                            height: "100%",
                                            borderRadius: 2,
                                            bgcolor: clusterColor(cluster.clusterId, cluster.noise),
                                            width: `${Math.min(100, (cluster.itemCount / maxClusterItemCount) * 100)}%`,
                                            transition: "width 0.4s ease-out"
                                          }}
                                        />
                                      </Box>
                                    </Box>
                                  )}
                                </Stack>
                              </ListItemButton>
                            );
                          })}
                        </Stack>
                      )}
                    </Stack>
                  </Paper>

                  {/* Right: Child Representative Candidates Panel */}
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2.5,
                      height: 580,
                      minHeight: 0,
                      display: "flex",
                      flexDirection: "column",
                      borderRadius: 2,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
                      position: "relative",
                      borderLeftWidth: { lg: 3 },
                      borderLeftColor: { lg: selectedClusterId ? clusterColor(selectedClusterId) : "divider" },
                      bgcolor: "rgba(0, 0, 0, 0.005)",
                    }}
                  >
                    <Stack spacing={1.5} sx={{ minHeight: 0, flex: 1 }}>
                      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ md: "center" }} justifyContent="space-between">
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "text.primary", display: "flex", alignItems: "center", gap: 1 }}>
                            {selectedClusterId ? "↳" : ""} 대표 스킬 후보 목록
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {selectedCluster ? `소속 클러스터: ${categoryByClusterId.get(selectedClusterId)?.categoryName || selectedCluster.label}` : "클러스터를 선택하여 스킬 목록을 확인하세요."}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          {selectedCluster ? <Chip size="small" variant="outlined" label={`${selectedCluster.itemCount.toLocaleString()} skills`} sx={{ fontWeight: 600, bgcolor: "background.paper" }} /> : null}
                          <Chip size="small" variant="outlined" label="지표: 거리 + 빈도 + 신뢰도" sx={{ fontSize: 11, fontWeight: 500, bgcolor: "background.paper" }} />
                        </Stack>
                      </Stack>

                      {/* Contextual Cluster Actions in Right Panel */}
                      {selectedClusterId ? (() => {
                        const savedCategory = categoryByClusterId.get(selectedClusterId);
                        const relationSaved = relationSavedClusterIds.includes(selectedClusterId);
                        
                        if (selectedCluster?.noise) return null;

                        if (!savedCategory) {
                          return (
                            <Alert severity="info" sx={{ py: 0.75, px: 1.5, borderRadius: 1.5, ".MuiAlert-message": { fontSize: 12.5 } }}>
                              Taxonomy 저장 전 단계입니다. 상단의 <strong>선택 카테고리 마스터 저장</strong> 완료 후, 스킬 배정 및 관계 저장이 가능합니다.
                            </Alert>
                          );
                        }

                        return (
                          <Paper
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              bgcolor: "rgba(0, 0, 0, 0.015)",
                              borderColor: "divider",
                              borderRadius: 2
                            }}
                          >
                            <Stack spacing={1}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Box>
                                  <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 11 }}>
                                    연동된 Taxonomy ID
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 13.5 }}>
                                    {savedCategory.categoryName} ({savedCategory.categoryId})
                                  </Typography>
                                </Box>
                                <Chip size="small" color="success" label="마스터 저장 완료" sx={{ height: 20, fontSize: 10.5, fontWeight: 600 }} />
                              </Stack>
                              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  fullWidth
                                  disabled={!canAdmin || !selectedProjectionId || assignDraftRepresentativesMutation.isPending}
                                  onClick={() => assignDraftRepresentativesMutation.mutate(savedCategory)}
                                  sx={{ fontSize: 12, fontWeight: 600 }}
                                >
                                  대표 스킬만 배정
                                </Button>
                                <Button
                                  size="small"
                                  variant={relationSaved ? "contained" : "outlined"}
                                  color={relationSaved ? "success" : "primary"}
                                  fullWidth
                                  disabled={relationSaved || !canAdmin || !selectedProjectionId || assignDraftClusterMutation.isPending}
                                  onClick={() => assignDraftClusterMutation.mutate(savedCategory)}
                                  sx={{ fontSize: 12, fontWeight: 600 }}
                                >
                                  {relationSaved ? "관계 저장됨" : "전체 스킬 & 관계 저장"}
                                </Button>
                              </Stack>
                              {assignDraftRepresentativesMutation.error ? (
                                <Alert severity="error" sx={{ mt: 1, py: 0.25, fontSize: 11.5 }}>
                                  {resolveAxiosError(assignDraftRepresentativesMutation.error) || "대표 스킬 배정에 실패했습니다."}
                                </Alert>
                              ) : null}
                              {assignDraftClusterMutation.error ? (
                                <Alert severity="error" sx={{ mt: 1, py: 0.25, fontSize: 11.5 }}>
                                  {resolveAxiosError(assignDraftClusterMutation.error) || "클러스터 스킬 배정에 실패했습니다."}
                                </Alert>
                              ) : null}
                            </Stack>
                          </Paper>
                        );
                      })() : null}

                      {!selectedClusterId ? (
                        <EmptyState title="좌측에서 클러스터를 선택하세요." />
                      ) : membersQuery.error ? (
                        <Alert severity="error">
                          {resolveAxiosError(membersQuery.error) || "클러스터 멤버 조회에 실패했습니다."}
                        </Alert>
                      ) : membersQuery.isLoading ? (
                        <LoadingState />
                      ) : memberRows.length === 0 ? (
                        <EmptyState title="클러스터 멤버가 없습니다." />
                      ) : (
                        <Stack spacing={1} sx={{ minHeight: 0, overflowY: "auto", pr: 0.5, flex: 1 }}>
                          {memberRows.map((member, index) => (
                            <Paper
                              key={member.skillId}
                              variant="outlined"
                              sx={{
                                p: 1.5,
                                borderRadius: 2,
                                border: member.representative ? "2px solid" : "1px solid",
                                borderColor: member.representative ? "secondary.main" : "divider",
                                transition: "all 0.2s ease",
                                "&:hover": {
                                  transform: "translateY(-2px)",
                                  boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                                  borderColor: member.representative ? "secondary.main" : "primary.light",
                                }
                              }}
                            >
                              <Stack spacing={1.25}>
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                  <Chip
                                    size="small"
                                    label={`#${index + 1}`}
                                    sx={{
                                      bgcolor: member.representative ? "secondary.main" : "primary.light",
                                      color: member.representative ? "secondary.contrastText" : "primary.contrastText",
                                      fontWeight: 700,
                                      width: 36,
                                      height: 20,
                                      fontSize: 10.5
                                    }}
                                  />
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="body2" noWrap sx={{ fontWeight: member.representative ? 800 : 700, fontSize: 13.5 }}>
                                      {pointLookupMap.get(String(member.skillId)) || member.skillId}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: 11.5 }}>
                                      ID: {member.skillId}
                                    </Typography>
                                  </Box>
                                  <Stack direction="row" spacing={0.5} alignItems="center">
                                    {member.representative ? (
                                      <Chip size="small" color="secondary" label="대표" sx={{ height: 18, fontSize: 9.5, fontWeight: 700 }} />
                                    ) : null}
                                    <Tooltip title="중심점과의 거리 (작을수록 중심에 가까움)">
                                      <Chip size="small" variant="outlined" label={`dist: ${member.distanceToCentroid != null ? member.distanceToCentroid.toFixed(3) : "-"}`} sx={{ height: 18, fontSize: 9.5, px: 0.25, fontWeight: 500 }} />
                                    </Tooltip>
                                  </Stack>
                                </Stack>

                                <Box sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 2, pt: 0.5, borderTop: "1px dashed rgba(0,0,0,0.06)" }}>
                                  <Box>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.25 }}>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5, fontWeight: 600 }}>
                                        멤버십 스코어 (군집 적합도)
                                      </Typography>
                                      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11, color: "primary.main" }}>
                                        {member.membershipScore == null ? "-" : `${Math.round(member.membershipScore * 100)}%`}
                                      </Typography>
                                    </Stack>
                                    <Box sx={{ height: 6, bgcolor: "rgba(0, 0, 0, 0.04)", borderRadius: 3, overflow: "hidden" }}>
                                      <Box
                                        sx={{
                                          height: "100%",
                                          borderRadius: 3,
                                          bgcolor: "primary.main",
                                          width: `${Math.min(100, Math.round((member.membershipScore ?? 0) * 100))}%`,
                                          transition: "width 0.4s ease-out"
                                        }}
                                      />
                                    </Box>
                                  </Box>
                                </Box>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  </Paper>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        <Alert severity="info" sx={{ borderRadius: 1.5 }}>
          저장된 카테고리 마스터 조회, 계층 이동, 스킬 배정, 클러스터 기반 배정, 병합, 변경 이력은 별도 Skill Categories 화면에서 관리합니다.
        </Alert>
      </Stack>
    </PageFrame>
  );
}

function pointsFrom(response: unknown): SkillClusterPoint[] {
  const value = response as { points?: SkillClusterPoint[] };
  return value?.points ?? listFrom<SkillClusterPoint>(response);
}

function projectionSummariesFrom(response: unknown): SkillGraphProjectionSummary[] {
  return listFrom<SkillGraphProjectionSummary>(response);
}

function isEmbeddingJobActive(status?: SkillDictionaryEmbeddingJobStatus) {
  return status === "READY" || status === "RUNNING";
}

function embeddingJobFromBatchEvent(event: SkillGraphBatchJobEvent): SkillDictionaryEmbeddingJob {
  return {
    jobId: event.jobId,
    status: embeddingStatusFromBatchStatus(event.status),
    totalCount: event.totalCount ?? 0,
    requestedCount: event.requestedCount ?? 0,
    processedCount: event.processedCount ?? 0,
    failedCount: event.failedCount ?? 0,
    skippedCount: event.skippedCount ?? 0,
    startedAt: event.startedAt,
    updatedAt: event.updatedAt,
    completedAt: event.completedAt,
    message: event.message ?? event.errorMessage,
  };
}

async function findActiveSkillGraphBatchJob(jobType: NonNullable<SkillGraphBatchJobEvent["jobType"]>) {
  const pages = await Promise.all(
    ["RUNNING", "VALIDATING", "CREATED"].map((status) =>
      skillGraphApi.listSkillGraphBatchJobs({
        jobType,
        status,
        page: 0,
        size: 1,
        sort: "updatedAt,desc",
      })
    )
  );
  const jobs = pages.flatMap((page) => listFrom<SkillGraphBatchJobEvent>(page));
  return jobs.sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")))[0] ?? null;
}

function embeddingStatusFromBatchStatus(status?: string): SkillDictionaryEmbeddingJobStatus {
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "PARTIAL") return "PARTIAL";
  if (status === "FAILED" || status === "CANCELED" || status === "CANCELLED") return "FAILED";
  if (status === "RUNNING" || status === "VALIDATING") return "RUNNING";
  return "READY";
}

function isBatchJobActive(status?: string) {
  return status === "CREATED" || status === "VALIDATING" || status === "RUNNING";
}

function batchJobProgress(job?: SkillGraphBatchJobEvent) {
  if (!job) return 0;
  const total = job.requestedCount || job.totalCount || 0;
  if (total <= 0) return 0;
  return Math.min(100, Math.round(((job.processedCount ?? 0) + (job.failedCount ?? 0)) / total * 100));
}

function projectionIdFromBatchJob(job?: SkillGraphBatchJobEvent) {
  const snapshot = job?.requestSnapshot;
  if (!snapshot) return "";
  try {
    const parsed = JSON.parse(snapshot) as { projectionId?: string };
    return parsed.projectionId ?? "";
  } catch {
    return "";
  }
}

function recommendationJobFromBatchEvent(
  event: SkillGraphBatchJobEvent,
  previous: SkillRecommendationJob | null
): SkillRecommendationJob | null {
  if (!previous || event.jobId !== previous.jobId) {
    return previous;
  }
  return {
    ...previous,
    status: event.status === "COMPLETED" ? "COMPLETED" : event.status === "FAILED" ? "FAILED" : "RUNNING",
    totalCount: event.totalCount ?? previous.totalCount,
    processedCount: event.processedCount ?? previous.processedCount,
    resultCount: event.resultCount ?? previous.resultCount,
    failedCount: event.failedCount ?? previous.failedCount,
    errorMessage: event.message ?? event.errorMessage ?? previous.errorMessage,
    updatedAt: event.updatedAt ?? previous.updatedAt,
    completedAt: event.completedAt ?? previous.completedAt,
  };
}

function embeddingJobProgress(job?: SkillDictionaryEmbeddingJob) {
  if (!job) return 0;
  const total = job.requestedCount || job.totalCount || 0;
  if (total <= 0) return 0;
  return Math.min(100, Math.round(((job.processedCount + job.failedCount) / total) * 100));
}

function isNoisePoint(point: SkillClusterPoint) {
  const clusterId = String(point.clusterId ?? "").trim().toLowerCase();
  const status = String(point.status ?? "").trim().toLowerCase();
  return !clusterId || clusterId === "-1" || clusterId === "noise" || status === "noise";
}

function clusterColor(clusterId?: string | number, noise = false) {
  if (noise) return "#9e9e9e";
  const clusterSeed = typeof clusterId === "number"
    ? clusterId
    : Array.from(String(clusterId ?? "0")).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return `hsl(${(clusterSeed * 47) % 360} 65% 45%)`;
}

function clusterSummariesFrom(points: SkillClusterPoint[]): ClusterSummary[] {
  const summaryById = new Map<string, ClusterSummary>();
  points.forEach((point) => {
    const noise = isNoisePoint(point);
    const clusterId = noise ? "NOISE" : String(point.clusterId ?? "");
    const current = summaryById.get(clusterId);
    if (current) {
      current.itemCount += 1;
      return;
    }
    summaryById.set(clusterId, {
      clusterId,
      label: noise ? "Noise" : point.clusterLabel || `Cluster ${summaryById.size + 1}`,
      itemCount: 1,
      noise,
    });
  });
  return Array.from(summaryById.values()).sort((a, b) => {
    if (a.noise !== b.noise) return a.noise ? 1 : -1;
    return b.itemCount - a.itemCount;
  });
}

function samePoint(a?: SkillClusterPoint | null, b?: SkillClusterPoint | null) {
  return Boolean(a && b && a.targetType === b.targetType && String(a.targetId) === String(b.targetId));
}

// Andrew's Monotone Chain Convex Hull algorithm
function getConvexHull(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  if (pts.length <= 1) return pts;
  const sorted = [...pts].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));

  const lower: { x: number; y: number }[] = [];
  for (let i = 0; i < sorted.length; i++) {
    while (
      lower.length >= 2 &&
      (lower[lower.length - 1].x - lower[lower.length - 2].x) * (sorted[i].y - lower[lower.length - 2].y) -
        (lower[lower.length - 1].y - lower[lower.length - 2].y) * (sorted[i].x - lower[lower.length - 2].x) <= 0
    ) {
      lower.pop();
    }
    lower.push(sorted[i]);
  }

  const upper: { x: number; y: number }[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    while (
      upper.length >= 2 &&
      (upper[upper.length - 1].x - upper[upper.length - 2].x) * (sorted[i].y - upper[upper.length - 2].y) -
        (upper[upper.length - 1].y - upper[upper.length - 2].y) * (sorted[i].x - upper[upper.length - 2].x) <= 0
    ) {
      upper.pop();
    }
    upper.push(sorted[i]);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function ScatterSvg({
  points,
  selectedClusterId,
  hoveredPoint,
  hoveredTitle,
  onHover,
  onSelect,
  searchKeyword,
  clusterNames,
}: {
  points: SkillClusterPoint[];
  selectedClusterId?: string;
  hoveredPoint?: SkillClusterPoint | null;
  hoveredTitle?: string;
  onHover?: (point: SkillClusterPoint | null) => void;
  onSelect: (point: SkillClusterPoint) => void;
  searchKeyword?: string;
  clusterNames?: Record<string, string>;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const width = 920;
  const height = 520;
  const padding = 24;

  const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragMoved, setDragMoved] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  const [localHoveredPoint, setLocalHoveredPoint] = useState<SkillClusterPoint | null>(null);
  const activeHoveredPoint = hoveredPoint !== undefined ? hoveredPoint : localHoveredPoint;

  const handleHoverStart = (point: SkillClusterPoint) => {
    if (onHover) {
      onHover(point);
    } else {
      setLocalHoveredPoint(point);
    }
  };

  const handleHoverEnd = () => {
    if (onHover) {
      onHover(null);
    } else {
      setLocalHoveredPoint(null);
    }
  };

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 1);

  const scaleXBase = (x: number) => padding + ((x - minX) / Math.max(1, maxX - minX)) * (width - padding * 2);
  const scaleYBase = (y: number) => height - padding - ((y - minY) / Math.max(1, maxY - minY)) * (height - padding * 2);

  const scaleX = (x: number) => {
    const base = scaleXBase(x);
    return (base - width / 2) * zoom.scale + width / 2 + zoom.x;
  };

  const scaleY = (y: number) => {
    const base = scaleYBase(y);
    return (base - height / 2) * zoom.scale + height / 2 + zoom.y;
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    setDragMoved(false);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    setDragStart({ x: e.clientX - zoom.x, y: e.clientY - zoom.y });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    const dx = Math.abs(e.clientX - dragStartPos.current.x);
    const dy = Math.abs(e.clientY - dragStartPos.current.y);
    if (dx > 3 || dy > 3) {
      setDragMoved(true);
    }
    setZoom((prev) => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!svgRef.current) return;

    const scaleFactor = 1.15;
    const nextScale = e.deltaY < 0 ? zoom.scale * scaleFactor : zoom.scale / scaleFactor;
    const clampedScale = Math.max(0.8, Math.min(25, nextScale));

    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const mouseX = (clientX / rect.width) * width;
    const mouseY = (clientY / rect.height) * height;

    const cx = width / 2;
    const cy = height / 2;

    const dx = mouseX - cx - zoom.x;
    const dy = mouseY - cy - zoom.y;
    const ratio = clampedScale / zoom.scale;

    setZoom({
      scale: clampedScale,
      x: mouseX - cx - dx * ratio,
      y: mouseY - cy - dy * ratio,
    });
  };

  const xTicks = useMemo(() => {
    const ticks = [];
    const range = maxX - minX;
    const step = range / 8;
    for (let i = 0; i <= 8; i++) {
      ticks.push(minX + step * i);
    }
    return ticks;
  }, [minX, maxX]);

  const yTicks = useMemo(() => {
    const ticks = [];
    const range = maxY - minY;
    const step = range / 6;
    for (let i = 0; i <= 6; i++) {
      ticks.push(minY + step * i);
    }
    return ticks;
  }, [minY, maxY]);

  interface ClusterCentroid {
    clusterId: string;
    label: string;
    x: number;
    y: number;
    color: string;
    count: number;
  }

  const centroids = useMemo<ClusterCentroid[]>(() => {
    const clusterGroups = new Map<string, { sumX: number; sumY: number; count: number; label: string }>();
    
    points.forEach((point) => {
      const noise = isNoisePoint(point);
      if (noise) return;
      
      const cid = String(point.clusterId ?? "");
      const current = clusterGroups.get(cid);
      const customName = clusterNames?.[cid];
      const label = customName || point.clusterLabel || `Cluster ${cid}`;
      if (current) {
        current.sumX += point.x;
        current.sumY += point.y;
        current.count += 1;
        if (customName) {
          current.label = customName;
        }
      } else {
        clusterGroups.set(cid, {
          sumX: point.x,
          sumY: point.y,
          count: 1,
          label,
        });
      }
    });

    return Array.from(clusterGroups.entries())
      .map(([clusterId, data]) => ({
        clusterId,
        label: data.label,
        x: data.sumX / data.count,
        y: data.sumY / data.count,
        color: clusterColor(clusterId, false),
        count: data.count,
      }))
      .filter((c) => c.count >= 2);
  }, [points, clusterNames]);

  const selectedClusterPoints = useMemo(() => {
    if (!selectedClusterId) return [];
    return points.filter((p) => !isNoisePoint(p) && String(p.clusterId ?? "") === selectedClusterId);
  }, [points, selectedClusterId]);

  const selectedClusterHull = useMemo(() => {
    if (selectedClusterPoints.length < 2) return [];
    return getConvexHull(selectedClusterPoints);
  }, [selectedClusterPoints]);

  const activeSearch = Boolean(searchKeyword && searchKeyword.trim());
  const isPointMatched = (point: SkillClusterPoint) => {
    if (!activeSearch) return false;
    const kw = searchKeyword!.trim().toLowerCase();
    return (
      point.label?.toLowerCase().includes(kw) ||
      String(point.targetId).toLowerCase().includes(kw)
    );
  };

  return (
    <Paper variant="outlined" sx={{ position: "relative", overflow: "hidden", p: 0, bgcolor: "#ffffff", borderRadius: 2 }}>
      {/* Zoom Controls */}
      <Box sx={{ position: "absolute", top: 12, right: 12, display: "flex", flexDirection: "column", gap: 0.5, zIndex: 5 }}>
        <IconButton
          size="small"
          onClick={() => {
            setZoom((prev) => {
              const nextScale = Math.min(25, prev.scale * 1.3);
              return { ...prev, scale: nextScale };
            });
          }}
          sx={{
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <AddOutlined fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={() => {
            setZoom((prev) => {
              const nextScale = Math.max(0.8, prev.scale / 1.3);
              return { ...prev, scale: nextScale };
            });
          }}
          sx={{
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <RemoveOutlined fontSize="small" />
        </IconButton>
        <Button
          size="small"
          variant="contained"
          onClick={() => setZoom({ scale: 1, x: 0, y: 0 })}
          sx={{
            minWidth: 0,
            px: 1,
            py: 0.5,
            fontSize: 10.5,
            fontWeight: 600,
            bgcolor: "background.paper",
            color: "text.primary",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          Reset
        </Button>
      </Box>

      {/* SVG Viewport */}
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ cursor: isDragging ? "grabbing" : "grab", display: "block" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        role="img"
        aria-label="Skill cluster scatter map"
      >
        {/* Vertical Gridlines & Labels */}
        {xTicks.map((tick, i) => {
          const cxValue = scaleX(tick);
          if (cxValue < 0 || cxValue > width) return null;
          return (
            <g key={`grid-x-${i}`}>
              <line
                x1={cxValue}
                y1={0}
                x2={cxValue}
                y2={height}
                stroke="rgba(0, 0, 0, 0.04)"
                strokeWidth={1}
              />
              {cxValue >= padding && cxValue <= width - padding && (
                <text
                  x={cxValue}
                  y={height - 8}
                  textAnchor="middle"
                  style={{
                    fontSize: "9px",
                    fill: "rgba(0, 0, 0, 0.35)",
                    fontWeight: 500,
                    pointerEvents: "none",
                  }}
                >
                  {tick.toFixed(1)}
                </text>
              )}
            </g>
          );
        })}
        {/* Horizontal Gridlines & Labels */}
        {yTicks.map((tick, i) => {
          const cyValue = scaleY(tick);
          if (cyValue < 0 || cyValue > height) return null;
          return (
            <g key={`grid-y-${i}`}>
              <line
                x1={0}
                y1={cyValue}
                x2={width}
                y2={cyValue}
                stroke="rgba(0, 0, 0, 0.04)"
                strokeWidth={1}
              />
              {cyValue >= padding && cyValue <= height - padding && (
                <text
                  x={8}
                  y={cyValue}
                  dominantBaseline="central"
                  style={{
                    fontSize: "9px",
                    fill: "rgba(0, 0, 0, 0.35)",
                    fontWeight: 500,
                    pointerEvents: "none",
                  }}
                >
                  {tick.toFixed(1)}
                </text>
              )}
            </g>
          );
        })}

        {/* Convex Hull Boundaries for Selected Cluster */}
        {selectedClusterId && selectedClusterHull.length >= 3 && (() => {
          const color = clusterColor(selectedClusterId, false);
          const hullPointsStr = selectedClusterHull
            .map((p) => `${scaleX(p.x)},${scaleY(p.y)}`)
            .join(" ");
          return (
            <polygon
              points={hullPointsStr}
              fill={color}
              fillOpacity={0.06}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              style={{ transition: "all 0.15s ease", pointerEvents: "none" }}
            />
          );
        })()}
        {selectedClusterId && selectedClusterHull.length === 2 && (() => {
          const color = clusterColor(selectedClusterId, false);
          const p1 = selectedClusterHull[0];
          const p2 = selectedClusterHull[1];
          return (
            <line
              x1={scaleX(p1.x)}
              y1={scaleY(p1.y)}
              x2={scaleX(p2.x)}
              y2={scaleY(p2.y)}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              style={{ transition: "all 0.15s ease", pointerEvents: "none" }}
            />
          );
        })()}

        {/* Data Points */}
        {points.map((point) => {
          const noise = isNoisePoint(point);
          const hovered = samePoint(point, activeHoveredPoint);
          const selected = Boolean(selectedClusterId && !noise && String(point.clusterId ?? "") === selectedClusterId);
          const matched = isPointMatched(point);
          
          let dimmed = false;
          if (activeSearch) {
            dimmed = !matched;
          } else if (selectedClusterId) {
            dimmed = !selected;
          }

          const color = clusterColor(point.clusterId, noise);
          
          const cxVal = scaleX(point.x);
          const cyVal = scaleY(point.y);
          
          if (cxVal < 0 || cxVal > width || cyVal < 0 || cyVal > height) {
            return null;
          }

          let r = 3.5;
          if (hovered) {
            r = 8.5;
          } else if (matched) {
            r = 7.5;
          } else if (selected) {
            r = 6.5;
          } else if (noise) {
            r = 3.5;
          } else if (point.targetType === "SKILL") {
            r = 5.5;
          }

          let opacity = 0.75;
          if (dimmed) {
            opacity = 0.08;
          } else if (noise) {
            opacity = 0.45;
          } else if (selected || matched) {
            opacity = 0.95;
          }

          const stroke = hovered || selected || matched ? "#111827" : noise ? "#757575" : "rgba(255,255,255,0.4)";
          const strokeWidth = hovered ? 2.5 : selected || matched ? 1.8 : 0.8;

          return (
            <g
              key={`${point.targetType}-${point.targetId}`}
              onClick={(event) => {
                event.stopPropagation();
                if (!dragMoved) {
                  onSelect(point);
                }
              }}
              onMouseEnter={() => handleHoverStart(point)}
              onMouseLeave={handleHoverEnd}
              style={{ cursor: "pointer" }}
            >
              {(hovered || selected || matched) && (
                <circle
                  cx={cxVal}
                  cy={cyVal}
                  r={hovered ? 12 : matched ? 11 : 10}
                  fill="none"
                  stroke={hovered ? "rgba(21, 101, 192, 0.35)" : matched ? "rgba(234, 179, 8, 0.3)" : "rgba(17, 24, 39, 0.15)"}
                  strokeWidth={2}
                />
              )}
              <circle
                cx={cxVal}
                cy={cyVal}
                r={r}
                fill={color}
                opacity={opacity}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={noise ? "1.5 1.5" : undefined}
              />
              {matched && (
                <text
                  x={cxVal + 10}
                  y={cyVal}
                  dominantBaseline="central"
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    fill: "#111827",
                    stroke: "#ffffff",
                    strokeWidth: 3,
                    strokeLinejoin: "round",
                    paintOrder: "stroke",
                    pointerEvents: "none",
                  }}
                >
                  {point.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Cluster Centroid Labels */}
        {centroids.map((c) => {
          const cxValue = scaleX(c.x);
          const cyValue = scaleY(c.y);
          
          if (cxValue < padding || cxValue > width - padding || cyValue < padding || cyValue > height - padding) {
            return null;
          }

          const isSelectedCentroid = selectedClusterId === c.clusterId;

          if (activeSearch) return null;
          
          return (
            <g key={`centroid-${c.clusterId}`} style={{ pointerEvents: "none" }}>
              <text
                x={cxValue}
                y={cyValue}
                textAnchor="middle"
                dominantBaseline="central"
                style={{
                  fontSize: isSelectedCentroid ? "13px" : (zoom.scale >= 2 ? "12px" : "10px"),
                  fontWeight: isSelectedCentroid ? 800 : 700,
                  fill: isSelectedCentroid ? "#1565c0" : "#1f2937",
                  stroke: "#ffffff",
                  strokeWidth: isSelectedCentroid ? 4 : 3,
                  strokeLinejoin: "round",
                  paintOrder: "stroke",
                  opacity: isSelectedCentroid ? 1.0 : (zoom.scale >= 1.5 ? 0.95 : 0.8),
                }}
              >
                {c.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Dynamic HTML Tooltip */}
      {activeHoveredPoint && (
        <Box
          sx={{
            position: "absolute",
            left: `${(scaleX(activeHoveredPoint.x) / width) * 100}%`,
            top: `${(scaleY(activeHoveredPoint.y) / height) * 100}%`,
            transform: "translate(-50%, -100%) translateY(-14px)",
            bgcolor: "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(6px)",
            border: "1.5px solid",
            borderColor: activeHoveredPoint.clusterId ? clusterColor(activeHoveredPoint.clusterId, isNoisePoint(activeHoveredPoint)) : "divider",
            boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
            borderRadius: 2,
            p: 1.5,
            pointerEvents: "none",
            zIndex: 10,
            minWidth: 200,
            maxWidth: 280,
            transition: "left 0.08s ease, top 0.08s ease",
          }}
        >
          <Stack spacing={0.5}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Chip
                size="small"
                label={
                  isNoisePoint(activeHoveredPoint)
                    ? "Noise"
                    : (activeHoveredPoint.clusterId && clusterNames?.[String(activeHoveredPoint.clusterId)]) ||
                      activeHoveredPoint.clusterLabel ||
                      `Cluster ${activeHoveredPoint.clusterId}`
                }
                sx={{
                  height: 18,
                  fontSize: 10,
                  fontWeight: 600,
                  bgcolor: "rgba(0,0,0,0.04)",
                  color: clusterColor(activeHoveredPoint.clusterId, isNoisePoint(activeHoveredPoint)),
                }}
              />
              <Typography variant="caption" color="text.secondary">
                ID: {activeHoveredPoint.targetId}
              </Typography>
            </Box>
            
            <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary", mt: 0.5, wordBreak: "break-all" }}>
              {activeHoveredPoint.label}
            </Typography>

            {hoveredTitle && hoveredPoint && samePoint(activeHoveredPoint, hoveredPoint) && (
              <Box sx={{ borderLeft: "2px solid", borderColor: "primary.main", pl: 1, py: 0.25, mt: 0.5 }}>
                <Typography variant="caption" sx={{ display: "block", color: "text.secondary", fontSize: 11, whiteSpace: "pre-line" }}>
                  {hoveredTitle}
                </Typography>
              </Box>
            )}

            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                mt: 1,
                pt: 1,
                borderTop: "1px dashed",
                borderColor: "divider",
              }}
            >
              <Typography sx={{ fontSize: 10.5 }} color="text.secondary">
                대표도: {activeHoveredPoint.score != null ? activeHoveredPoint.score.toFixed(3) : "-"}
              </Typography>
              <Typography sx={{ fontSize: 10.5 }} color="text.secondary">
                ({activeHoveredPoint.x.toFixed(1)}, {activeHoveredPoint.y.toFixed(1)})
              </Typography>
            </Box>
          </Stack>
        </Box>
      )}
    </Paper>
  );
}

function getCubicBSplinePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  
  // Clamp ends by duplicating the start and end points
  const p = [points[0], points[0], ...points, points[points.length - 1], points[points.length - 1]];
  
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2];
    
    const x0 = (p0.x + 4 * p1.x + p2.x) / 6;
    const y0 = (p0.y + 4 * p1.y + p2.y) / 6;
    
    const x3 = (p1.x + 4 * p2.x + p3.x) / 6;
    const y3 = (p1.y + 4 * p2.y + p3.y) / 6;
    
    const x1 = (2 * p1.x + p2.x) / 3;
    const y1 = (2 * p1.y + p2.y) / 3;
    
    const x2 = (p1.x + 2 * p2.x) / 3;
    const y2 = (p1.y + 2 * p2.y) / 3;
    
    if (i === 1) {
      path += ` L ${x0} ${y0}`;
    }
    path += ` C ${x1} ${y1}, ${x2} ${y2}, ${x3} ${y3}`;
  }
  
  path += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  return path;
}

export function SkillGraphClustersPage() {
  const { canAdmin } = useSkillGraphRoles();
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("categories-tree-page"),
    queryFn: () => skillGraphApi.listCategoryTree(),
  });

  const dictionaryQuery = useQuery({
    queryKey: skillGraphQueryKeys.custom("dictionary-tree-items-page"),
    queryFn: () => skillGraphApi.listDictionary({ limit: 1000, sort: "name,asc" }),
  });

  // Mind map constants
  const MM_CX = 800;
  const MM_CY = 600;
  const BRANCH_COLORS = ["#818cf8","#fb923c","#34d399","#f87171","#60a5fa","#f472b6","#a78bfa","#2dd4bf","#facc15","#86efac"];

type MNode = TreeNode & { color: string; angle: number };

  type ParentCategorySuggestion = {
    suggestionId: string;
    suggestedName: string;
    childCategoryIds: string[];
    relationCount: number;
    score: number;
  };

  const { resolvedMode } = useThemeMode();
  const [pan, setPan] = useState({ x: 50, y: 80 });
  const [zoom, setZoom] = useState(0.85);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<"radial" | "tree">("radial");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [detailPanelOffset, setDetailPanelOffset] = useState({ x: 0, y: 0 });
  const [isDraggingDetailPanel, setIsDraggingDetailPanel] = useState(false);
  const detailPanelDragStart = useRef({ x: 0, y: 0 });
  const lastClickRef = useRef<{ time: number; nodeId: string | number | null }>({ time: 0, nodeId: null });

  useEffect(() => {
    setDetailPanelOffset({ x: 0, y: 0 });
  }, [selectedNode]);

  useEffect(() => {
    if (!isDraggingDetailPanel) return;
    const handleMouseMove = (event: MouseEvent) => {
      setDetailPanelOffset({
        x: event.clientX - detailPanelDragStart.current.x,
        y: event.clientY - detailPanelDragStart.current.y,
      });
    };
    const handleMouseUp = () => setIsDraggingDetailPanel(false);
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingDetailPanel]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string | number>>(new Set());
  const [expandedSkillsCategories, setExpandedSkillsCategories] = useState<Set<string | number>>(new Set());
  const [showSkills, setShowSkills] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [categoryRelationGraph, setCategoryRelationGraph] = useState<SkillCategoryGraph | null>(null);
  const [showCategoryRelations, setShowCategoryRelations] = useState(false);
  const [categoryRelationPanelWidth, setCategoryRelationPanelWidth] = useState(430);
  const [isResizingCategoryRelationPanel, setIsResizingCategoryRelationPanel] = useState(false);
  const [parentSuggestionNames, setParentSuggestionNames] = useState<Record<string, string>>({});
  const [savedParentSuggestionIds, setSavedParentSuggestionIds] = useState<Set<string>>(new Set());
  const [useLlmCategoryRelations, setUseLlmCategoryRelations] = useState(false);
  const [bundlingStrength, setBundlingStrength] = useState(0.75);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const initializedRef = useRef(false);

  const centerOnNode = (node: TreeNode) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    setPan({
      x: width / 2 - node.x * zoom,
      y: height / 2 - node.y * zoom,
    });
  };

  useEffect(() => {
    if (viewMode === "tree") {
      setPan({ x: 80, y: 120 });
      setZoom(0.85);
    } else {
      setPan({ x: 50, y: 80 });
      setZoom(0.85);
    }
  }, [viewMode]);

  useEffect(() => {
    if (categoriesQuery.data && !initializedRef.current) {
      const cats = listFrom<SkillCategory>(categoriesQuery.data);
      setExpandedCategories(new Set(cats.map(r => r.categoryId)));
      initializedRef.current = true;
    }
  }, [categoriesQuery.data]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => Math.max(0.15, Math.min(3, z * (e.deltaY < 0 ? 1.08 : 1 / 1.08))));
    };
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    if (!isResizingCategoryRelationPanel) return;
    const rightOffset = 76;
    const minWidth = 340;
    const maxWidth = Math.min(760, Math.max(420, window.innerWidth - 140));
    const handleMouseMove = (event: MouseEvent) => {
      const nextWidth = window.innerWidth - event.clientX - rightOffset;
      setCategoryRelationPanelWidth(Math.max(minWidth, Math.min(maxWidth, nextWidth)));
    };
    const handleMouseUp = () => setIsResizingCategoryRelationPanel(false);
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingCategoryRelationPanel]);

  const { visibleNodes, visibleLinks, allCategoryIds, parentMap, nodeMap } = useMemo(() => {
    if (!categoriesQuery.data) return { visibleNodes: [], visibleLinks: [], allCategoryIds: [], parentMap: new Map<string, string>(), nodeMap: new Map<string, MNode>() };

    const categories = listFrom<SkillCategory>(categoriesQuery.data);
    const skills = listFrom<SkillDictionaryItem>(dictionaryQuery.data ?? []);
    const allCatIds: Array<string | number> = [];

    const categoryMap: Record<string | number, MNode & { subcategories: MNode[]; skills: MNode[] }> = {};
    categories.forEach(cat => {
      allCatIds.push(cat.categoryId);
      categoryMap[cat.categoryId] = {
        id: `c-${cat.categoryId}`, type: "category", name: cat.categoryName,
        categoryId: cat.categoryId, children: [], subcategories: [], skills: [], depth: 0, x: 0, y: 0, color: BRANCH_COLORS[0], angle: 0,
      } as any;
    });

    const rootCategories: MNode[] = [];
    categories.forEach(cat => {
      const node = categoryMap[cat.categoryId];
      const parentId = cat.parentId ?? cat.parentCategoryId;
      if (parentId && categoryMap[parentId]) {
        categoryMap[parentId].subcategories.push(node);
      } else {
        rootCategories.push(node);
      }
    });

    skills.forEach(skill => {
      if (skill.categoryId && categoryMap[skill.categoryId]) {
        categoryMap[skill.categoryId].skills.push({
          id: `s-${skill.skillId}`, type: "skill",
          name: skill.skillName ?? skill.name ?? "", skillId: skill.skillId,
          children: [], depth: 0, x: 0, y: 0, color: "#34d399", angle: 0,
        } as MNode);
      }
    });

    const hasAncestorInSet = (catId: string | number, targetSet: Set<string | number>): boolean => {
      let currId = catId;
      while (currId) {
        const parent = categories.find(c => String(c.categoryId) === String(currId));
        const parentId = parent?.parentId ?? parent?.parentCategoryId;
        if (parentId) {
          if (targetSet.has(parentId)) return true;
          currId = parentId;
        } else {
          break;
        }
      }
      return false;
    };

    const isCategoryExpanded = (catId: string | number): boolean => {
      return expandedCategories.has(catId) || hasAncestorInSet(catId, expandedSkillsCategories);
    };

    const isCategorySkillsExpanded = (catId: string | number): boolean => {
      return showSkills || expandedSkillsCategories.has(catId) || hasAncestorInSet(catId, expandedSkillsCategories);
    };

    categories.forEach(cat => {
      const node = categoryMap[cat.categoryId];
      const isSkillExpanded = isCategorySkillsExpanded(cat.categoryId);
      node.children = [...node.subcategories];
      if (isSkillExpanded) {
        node.children.push(...node.skills);
      }
    });

    const pMap = new Map<string, string>();
    categories.forEach(cat => {
      const id = `c-${cat.categoryId}`;
      const parentId = cat.parentId ?? cat.parentCategoryId;
      if (parentId) {
        pMap.set(id, `c-${parentId}`);
      } else {
        pMap.set(id, "root");
      }
    });

    skills.forEach(skill => {
      const id = `s-${skill.skillId}`;
      if (skill.categoryId) {
        pMap.set(id, `c-${skill.categoryId}`);
      } else {
        pMap.set(id, "root");
      }
    });

    if (viewMode === "tree") {
      let currentY = 0;
      const xSpacing = 260;
      const ySpacing = 52;
      const xPadding = 120;
      const yPadding = 80;

      function assignTreePositions(node: MNode, depth: number, color: string) {
        node.depth = depth;
        node.color = color;
        node.x = depth * xSpacing + xPadding;

        const isExpanded = node.type === "category" && isCategoryExpanded(node.categoryId!);
        const visibleChildren = isExpanded ? (node.children as MNode[]) : [];

        if (visibleChildren.length === 0) {
          node.y = currentY * ySpacing + yPadding;
          currentY++;
        } else {
          visibleChildren.forEach(child => {
            assignTreePositions(child, depth + 1, color);
          });
          const firstChildY = visibleChildren[0].y;
          const lastChildY = visibleChildren[visibleChildren.length - 1].y;
          node.y = (firstChildY + lastChildY) / 2;
        }
      }

      rootCategories.forEach((cat, i) => {
        const color = BRANCH_COLORS[i % BRANCH_COLORS.length];
        assignTreePositions(cat, 0, color);
      });
    } else {
      function countLeaves(node: MNode): number {
        const isExp = node.type === "category" && isCategoryExpanded(node.categoryId!);
        if (!isExp || node.children.length === 0) return 1;
        return (node.children as MNode[]).reduce((s, c) => s + countLeaves(c), 0);
      }

      function assignPositions(node: MNode, startAngle: number, endAngle: number, depth: number, color: string) {
        node.depth = depth;
        node.color = color;
        const midAngle = (startAngle + endAngle) / 2;
        node.angle = midAngle;
        const radii = [230, 410, 570, 630, 690];
        const r = radii[Math.min(depth, radii.length - 1)];
        node.x = MM_CX + Math.cos(midAngle) * r;
        node.y = MM_CY + Math.sin(midAngle) * r;
        const isExpanded = node.type === "category" && isCategoryExpanded(node.categoryId!);
        if (isExpanded && node.children.length > 0) {
          const total = (node.children as MNode[]).reduce((s, c) => s + countLeaves(c), 0);
          let cur = startAngle;
          (node.children as MNode[]).forEach(child => {
            const span = ((endAngle - startAngle) * countLeaves(child)) / total;
            assignPositions(child, cur, cur + span, depth + 1, color);
            cur += span;
          });
        }
      }

      const totalLeaves = rootCategories.reduce((s, c) => s + countLeaves(c), 0);
      let angle = -Math.PI / 2;
      rootCategories.forEach((cat, i) => {
        const color = BRANCH_COLORS[i % BRANCH_COLORS.length];
        const span = (Math.PI * 2 * countLeaves(cat)) / Math.max(totalLeaves, 1);
        assignPositions(cat, angle, angle + span, 0, color);
        angle += span;
      });
    }

    const nodesList: MNode[] = [];
    const linksList: Array<{ source: MNode; target: MNode }> = [];
    function collect(nodes: MNode[], parent?: MNode) {
      nodes.forEach(node => {
        nodesList.push(node);
        if (parent) linksList.push({ source: parent, target: node });
        const isExpanded = node.type === "category" && isCategoryExpanded(node.categoryId!);
        if (isExpanded) collect(node.children as MNode[], node);
      });
    }
    collect(rootCategories);

    const nMap = new Map<string, MNode>();
    nodesList.forEach(node => {
      nMap.set(node.id, node);
    });

    return { visibleNodes: nodesList, visibleLinks: linksList, allCategoryIds: allCatIds, parentMap: pMap, nodeMap: nMap };
  }, [categoriesQuery.data, dictionaryQuery.data, expandedCategories, expandedSkillsCategories, showSkills, viewMode]);

  useEffect(() => {
    if (!searchQuery.trim() || !categoriesQuery.data) return;
    const categories = listFrom<SkillCategory>(categoriesQuery.data);
    const skills = listFrom<SkillDictionaryItem>(dictionaryQuery.data ?? []);
    const catMap: Record<string | number, SkillCategory> = {};
    categories.forEach(c => { catMap[c.categoryId] = c; });
    const ancestors = new Set<string | number>();
    const skillCats = new Set<string | number>();
    categories.forEach(c => {
      if (c.categoryName.toLowerCase().includes(searchQuery.toLowerCase())) {
        let pid = c.parentId ?? c.parentCategoryId;
        while (pid && catMap[pid]) { ancestors.add(pid); pid = catMap[pid].parentId ?? catMap[pid].parentCategoryId; }
      }
    });
    skills.forEach(s => {
      if (s.skillName?.toLowerCase().includes(searchQuery.toLowerCase()) || s.name?.toLowerCase().includes(searchQuery.toLowerCase())) {
        if (s.categoryId) {
          skillCats.add(s.categoryId);
          let pid = s.categoryId;
          while (pid && catMap[pid]) { ancestors.add(pid); pid = catMap[pid].parentId ?? catMap[pid].parentCategoryId; }
        }
      }
    });
    if (ancestors.size > 0) {
      setExpandedCategories(prev => { const next = new Set(prev); ancestors.forEach(id => next.add(id)); return next; });
    }
    if (skillCats.size > 0) {
      setExpandedSkillsCategories(prev => { const next = new Set(prev); skillCats.forEach(id => next.add(id)); return next; });
    }
  }, [searchQuery, categoriesQuery.data, dictionaryQuery.data]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = (e: React.MouseEvent) => {
    setIsDragging(false);
    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 5) {
      setSelectedNode(null);
    }
  };
  const toggleCategoryExpand = (catId: string | number) => {
    if (!categoriesQuery.data) return;
    const categories = listFrom<SkillCategory>(categoriesQuery.data);
    const hasSubcats = categories.some(c => (c.parentId ?? c.parentCategoryId) === catId);
    const hasSkills = listFrom<SkillDictionaryItem>(dictionaryQuery.data ?? []).some(s => String(s.categoryId) === String(catId));

    if (hasSubcats || hasSkills) {
      const isCurrentlyExpanded = expandedCategories.has(catId);
      
      setExpandedCategories(prev => {
        const next = new Set(prev);
        if (isCurrentlyExpanded) next.delete(catId);
        else next.add(catId);
        return next;
      });

      setExpandedSkillsCategories(prev => {
        const next = new Set(prev);
        if (isCurrentlyExpanded) next.delete(catId);
        else next.add(catId);
        return next;
      });
    }
  };
  const expandAll = () => {
    setExpandedCategories(new Set(allCategoryIds));
    setExpandedSkillsCategories(new Set(allCategoryIds));
  };
  const collapseAll = () => {
    setExpandedCategories(new Set());
    setExpandedSkillsCategories(new Set());
    setShowSkills(false);
  };
  const resetPanZoom = () => { setPan({ x: 50, y: 80 }); setZoom(0.85); };

  const getBundledPath = (idA: string, idB: string, beta: number): string => {
    const pathA: string[] = [];
    let currA = idA;
    while (currA) {
      pathA.push(currA);
      currA = parentMap.get(currA) || "";
    }
    if (pathA[pathA.length - 1] !== "root") {
      pathA.push("root");
    }

    const pathB: string[] = [];
    let currB = idB;
    while (currB) {
      pathB.push(currB);
      currB = parentMap.get(currB) || "";
    }
    if (pathB[pathB.length - 1] !== "root") {
      pathB.push("root");
    }

    // Find lowest common ancestor
    let lca = "root";
    const setA = new Set(pathA);
    for (let i = 0; i < pathB.length; i++) {
      if (setA.has(pathB[i])) {
        lca = pathB[i];
        break;
      }
    }

    const lcaIdxA = pathA.indexOf(lca);
    const fromAToLca = pathA.slice(0, lcaIdxA + 1);

    const lcaIdxB = pathB.indexOf(lca);
    const fromLcaToB = pathB.slice(0, lcaIdxB).reverse();

    const fullPathIds = [...fromAToLca, ...fromLcaToB];

    const points: { x: number; y: number }[] = [];
    fullPathIds.forEach(id => {
      if (id === "root") {
        if (viewMode === "tree") {
          const nodeA = nodeMap.get(idA);
          const nodeB = nodeMap.get(idB);
          const avgY = nodeA && nodeB ? (nodeA.y + nodeB.y) / 2 : MM_CY;
          points.push({ x: 20, y: avgY });
        } else {
          points.push({ x: MM_CX, y: MM_CY });
        }
      } else {
        const node = nodeMap.get(id);
        if (node) {
          points.push({ x: node.x, y: node.y });
        }
      }
    });

    if (points.length < 2) return "";

    const start = points[0];
    const end = points[points.length - 1];
    const N = points.length;
    const bundledPoints = points.map((p, i) => {
      if (i === 0) return start;
      if (i === N - 1) return end;
      const t = i / (N - 1);
      const lineX = start.x + t * (end.x - start.x);
      const lineY = start.y + t * (end.y - start.y);
      return {
        x: beta * p.x + (1 - beta) * lineX,
        y: beta * p.y + (1 - beta) * lineY,
      };
    });

    return getCubicBSplinePath(bundledPoints);
  };

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    listFrom<SkillCategory>(categoriesQuery.data ?? []).forEach((category) => {
      map.set(String(category.categoryId), category.categoryName || category.name || String(category.categoryId));
    });
    categoryRelationGraph?.categories.forEach((category) => {
      map.set(String(category.categoryId), category.categoryName || category.name || String(category.categoryId));
    });
    return map;
  }, [categoriesQuery.data, categoryRelationGraph]);

  const visibleCategoryNodeById = useMemo(() => {
    const map = new Map<string, MNode>();
    visibleNodes.forEach((node) => {
      const maybeNode = node as MNode;
      if (maybeNode.type === "category" && maybeNode.categoryId != null) {
        map.set(String(maybeNode.categoryId), maybeNode);
      }
    });
    return map;
  }, [visibleNodes]);

  const visibleCategoryRelations = useMemo(() => {
    if (!showCategoryRelations || !categoryRelationGraph) return [];
    return categoryRelationGraph.relations
      .filter((relation) => (
        visibleCategoryNodeById.has(String(relation.sourceCategoryId))
        && visibleCategoryNodeById.has(String(relation.targetCategoryId))
      ))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }, [categoryRelationGraph, showCategoryRelations, visibleCategoryNodeById]);

  const activeNodeIds = useMemo(() => {
    if (!hoveredNodeId) return null;
    const active = new Set<string>();
    active.add(hoveredNodeId);

    const addAncestors = (id: string) => {
      let curr = id;
      while (curr) {
        const parent = parentMap.get(curr);
        if (parent && parent !== "root") {
          active.add(parent);
          curr = parent;
        } else {
          break;
        }
      }
    };

    const addDescendants = (nodeId: string) => {
      const node = nodeMap.get(nodeId);
      if (node && node.children) {
        node.children.forEach((child) => {
          active.add(child.id);
          addDescendants(child.id);
        });
      }
    };

    addAncestors(hoveredNodeId);
    if (hoveredNodeId.startsWith("c-")) {
      addDescendants(hoveredNodeId);
    }

    if (hoveredNodeId.startsWith("c-")) {
      const catId = hoveredNodeId.substring(2);
      visibleCategoryRelations.forEach((rel) => {
        const srcId = String(rel.sourceCategoryId);
        const tgtId = String(rel.targetCategoryId);
        if (srcId === catId) {
          const targetNodeId = `c-${tgtId}`;
          active.add(targetNodeId);
          addAncestors(targetNodeId);
        } else if (tgtId === catId) {
          const sourceNodeId = `c-${srcId}`;
          active.add(sourceNodeId);
          addAncestors(sourceNodeId);
        }
      });
    }

    return active;
  }, [hoveredNodeId, parentMap, nodeMap, visibleCategoryRelations]);

  const hoveredCats = useMemo(() => {
    const cats = new Set<string>();
    if (!hoveredNodeId) return cats;
    if (hoveredNodeId.startsWith("c-")) {
      const catId = hoveredNodeId.substring(2);
      cats.add(catId);
      const addDescendantCats = (id: string) => {
        const node = nodeMap.get(id);
        if (node && node.children) {
          node.children.forEach(c => {
            if (c.type === "category") {
              cats.add(String(c.categoryId));
              addDescendantCats(c.id);
            }
          });
        }
      };
      addDescendantCats(hoveredNodeId);
    } else if (hoveredNodeId.startsWith("s-")) {
      const parentId = parentMap.get(hoveredNodeId);
      if (parentId && parentId.startsWith("c-")) {
        cats.add(parentId.substring(2));
      }
    }
    return cats;
  }, [hoveredNodeId, parentMap, nodeMap]);

  const relationRows = useMemo(() => (
    (categoryRelationGraph?.relations ?? [])
      .slice()
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  ), [categoryRelationGraph]);

  const heuristicParentCategorySuggestions = useMemo<ParentCategorySuggestion[]>(() => {
    const eligibleRelations = relationRows
      .filter((relation) => (
        relation.relationType !== "PARENT"
        && relation.score >= 0.45
      ))
      .slice(0, 40);
    const adjacency = new Map<string, Set<string>>();
    const scoreByPair = new Map<string, number>();
    eligibleRelations.forEach((relation) => {
      const sourceId = String(relation.sourceCategoryId);
      const targetId = String(relation.targetCategoryId);
      if (sourceId === targetId) return;
      if (!adjacency.has(sourceId)) adjacency.set(sourceId, new Set());
      if (!adjacency.has(targetId)) adjacency.set(targetId, new Set());
      adjacency.get(sourceId)?.add(targetId);
      adjacency.get(targetId)?.add(sourceId);
      scoreByPair.set([sourceId, targetId].sort().join(":"), relation.score ?? 0);
    });

    const visited = new Set<string>();
    const suggestions: ParentCategorySuggestion[] = [];
    adjacency.forEach((_neighbors, startId) => {
      if (visited.has(startId)) return;
      const stack = [startId];
      const component: string[] = [];
      visited.add(startId);
      while (stack.length) {
        const current = stack.pop();
        if (!current) continue;
        component.push(current);
        adjacency.get(current)?.forEach((next) => {
          if (!visited.has(next)) {
            visited.add(next);
            stack.push(next);
          }
        });
      }
      if (component.length < 2) return;

      const limitedComponent = component
        .slice()
        .sort((a, b) => (categoryNameById.get(a) ?? a).localeCompare(categoryNameById.get(b) ?? b))
        .slice(0, 8);
      let relationCount = 0;
      let scoreTotal = 0;
      for (let i = 0; i < limitedComponent.length; i += 1) {
        for (let j = i + 1; j < limitedComponent.length; j += 1) {
          const score = scoreByPair.get([limitedComponent[i], limitedComponent[j]].sort().join(":"));
          if (score != null) {
            relationCount += 1;
            scoreTotal += score;
          }
        }
      }
      const names = limitedComponent.map((id) => categoryNameById.get(id) ?? id);
      const firstToken = names
        .map((name) => name.trim().split(/\s+/)[0])
        .filter(Boolean)
        .find((token, _index, tokens) => tokens.filter((item) => item === token).length >= Math.ceil(names.length / 2));
      const suggestedName = firstToken && firstToken.length > 1 ? `${firstToken} 역량 그룹` : "연관 카테고리 그룹";
      suggestions.push({
        suggestionId: limitedComponent.join("__"),
        suggestedName,
        childCategoryIds: limitedComponent,
        relationCount,
        score: relationCount ? scoreTotal / relationCount : 0,
      });
    });

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [categoryNameById, relationRows]);

  const parentCategorySuggestions = useMemo<ParentCategorySuggestion[]>(() => {
    const serverSuggestions = categoryRelationGraph?.parentSuggestions ?? [];
    if (serverSuggestions.length) {
      return serverSuggestions.map((suggestion: SkillCategoryParentSuggestion) => ({
        suggestionId: suggestion.suggestionId || suggestion.childCategoryIds.map(String).join("__"),
        suggestedName: suggestion.suggestedName,
        childCategoryIds: suggestion.childCategoryIds.map(String),
        relationCount: suggestion.relationCount,
        score: suggestion.score,
      })).filter((suggestion) => !savedParentSuggestionIds.has(suggestion.suggestionId));
    }
    return heuristicParentCategorySuggestions.filter((suggestion) => !savedParentSuggestionIds.has(suggestion.suggestionId));
  }, [categoryRelationGraph?.parentSuggestions, heuristicParentCategorySuggestions, savedParentSuggestionIds]);

  useEffect(() => {
    if (!parentCategorySuggestions.length) return;
    setParentSuggestionNames((prev) => {
      const next = { ...prev };
      parentCategorySuggestions.forEach((suggestion) => {
        if (!next[suggestion.suggestionId]) {
          next[suggestion.suggestionId] = suggestion.suggestedName;
        }
      });
      return next;
    });
  }, [parentCategorySuggestions]);

  const previewCategoryRelationsMutation = useMutation({
    mutationFn: () => skillGraphApi.previewCategoryRelations({
      categoryIds: allCategoryIds,
      representativeSkillLimit: 8,
      minScore: 0.25,
      includePersisted: true,
      useLlm: useLlmCategoryRelations,
    }),
    onSuccess: (graph) => {
      setCategoryRelationGraph(graph);
      setShowCategoryRelations(true);
      setSavedParentSuggestionIds(new Set());
    },
    onError: () => {
      setCategoryRelationGraph({ categories: [], skills: [], relations: [] });
      setShowCategoryRelations(true);
      setSavedParentSuggestionIds(new Set());
    },
  });

  const saveParentCategorySuggestionMutation = useMutation({
    mutationFn: async (suggestion: ParentCategorySuggestion) => {
      const name = (parentSuggestionNames[suggestion.suggestionId] || suggestion.suggestedName).trim();
      if (!name) {
        throw new Error("상위 카테고리명을 입력하세요.");
      }
      const created = await skillGraphApi.createCategory({
        categoryName: name,
        displayOrder: 0,
      });
      await Promise.all(suggestion.childCategoryIds.map((categoryId) => (
        skillGraphApi.moveCategory(categoryId, { parentCategoryId: String(created.categoryId) })
      )));
      return { created, suggestion };
    },
    onSuccess: ({ suggestion }) => {
      setSavedParentSuggestionIds((prev) => new Set([...prev, suggestion.suggestionId]));
      categoriesQuery.refetch();
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("categories-tree-page") });
      queryClient.invalidateQueries({ queryKey: skillGraphQueryKeys.custom("category-draft-master-categories") });
    },
  });

  const categorySkills = useMemo(() => {
    if (!selectedNode || selectedNode.type !== "category" || selectedNode.categoryId === undefined) return [];
    const skills = listFrom<SkillDictionaryItem>(dictionaryQuery.data ?? []);
    return skills.filter((s) => String(s.categoryId) === String(selectedNode.categoryId));
  }, [selectedNode, dictionaryQuery.data]);

  const isLoading = categoriesQuery.isLoading || dictionaryQuery.isLoading;
  const isError = categoriesQuery.isError || dictionaryQuery.isError;

  return (
    <PageFrame
      title="스킬 분류 체계 맵"
      label="카테고리와 스킬의 계층 구조 및 관계를 계층적 엣지 번들링(HEB) 네트워크로 시각화합니다."
      searchPlaceholder="카테고리 또는 스킬 검색"
      searchValue={searchQuery}
      onSearchValueChange={setSearchQuery}
      actions={
        <Stack direction="row" spacing={1.5} alignItems="center">
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_e, val) => {
              if (val !== null) setViewMode(val);
            }}
            size="small"
            sx={{
              height: 32,
              bgcolor: resolvedMode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
              border: "1px solid",
              borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
              "& .MuiToggleButton-root": {
                px: 1.5,
                py: 0,
                fontSize: 12,
                fontWeight: 700,
                color: resolvedMode === "dark" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)",
                border: "none",
                "&.Mui-selected": {
                  color: resolvedMode === "dark" ? "#fff" : "#1e293b",
                  bgcolor: resolvedMode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                  "&:hover": {
                    bgcolor: resolvedMode === "dark" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
                  }
                }
              }
            }}
          >
            <ToggleButton value="radial" aria-label="Radial Mindmap">
              <Stack direction="row" spacing={0.5} alignItems="center">
                <HubOutlined fontSize="small" />
                <Typography variant="caption" sx={{ fontWeight: 700 }}>방사형</Typography>
              </Stack>
            </ToggleButton>
            <ToggleButton value="tree" aria-label="Horizontal Tree">
              <Stack direction="row" spacing={0.5} alignItems="center">
                <AccountTreeOutlined fontSize="small" />
                <Typography variant="caption" sx={{ fontWeight: 700 }}>계층형</Typography>
              </Stack>
            </ToggleButton>
          </ToggleButtonGroup>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showSkills}
                onChange={(event) => setShowSkills(event.target.checked)}
                sx={{
                  "& .MuiSwitch-switchBase.Mui-checked": {
                    color: "#34d399",
                  },
                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                    bgcolor: "#34d399",
                  },
                }}
              />
            }
            label="스킬 표시"
            sx={{
              mr: 0.5,
              "& .MuiFormControlLabel-label": {
                fontSize: 12,
                fontWeight: 800,
                color: "text.primary",
              },
            }}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={useLlmCategoryRelations}
                onChange={(event) => setUseLlmCategoryRelations(event.target.checked)}
              />
            }
            label="LLM"
            sx={{
              mr: 0.25,
              "& .MuiFormControlLabel-label": {
                fontSize: 12,
                fontWeight: 800,
              },
            }}
          />
          {showCategoryRelations && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mr: 1, minWidth: 120 }}>
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 800, color: "text.secondary", whiteSpace: "nowrap" }}>
                번들링: {bundlingStrength.toFixed(2)}
              </Typography>
              <Slider
                size="small"
                value={bundlingStrength}
                min={0}
                max={1}
                step={0.05}
                onChange={(_e, val) => setBundlingStrength(val as number)}
                sx={{
                  width: 70,
                  color: "#818cf8",
                  "& .MuiSlider-thumb": {
                    width: 10,
                    height: 10,
                  },
                }}
              />
            </Stack>
          )}
          <Button
            size="small"
            variant={showCategoryRelations ? "contained" : "outlined"}
            startIcon={previewCategoryRelationsMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <AccountTreeOutlined fontSize="small" />}
            onClick={() => previewCategoryRelationsMutation.mutate()}
            disabled={!canAdmin || isLoading || previewCategoryRelationsMutation.isPending}
            sx={{ fontWeight: 700 }}
          >
            {previewCategoryRelationsMutation.isPending ? "분석 중" : "추천 그룹"}
          </Button>
           <ButtonGroup
             size="small"
             variant="outlined"
             sx={{
               borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
               "& .MuiButton-outlined": {
                 borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
                 color: resolvedMode === "dark" ? "rgba(255,255,255,0.7)" : "text.secondary",
                 "&:hover": {
                   bgcolor: resolvedMode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                   borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
                   color: resolvedMode === "dark" ? "white" : "text.primary",
                 }
               }
             }}
           >
             <Button onClick={expandAll} startIcon={<UnfoldMoreOutlined fontSize="small" />} sx={{ fontWeight: 700 }}>전체 펼치기</Button>
             <Button onClick={collapseAll} startIcon={<UnfoldLessOutlined fontSize="small" />} sx={{ fontWeight: 700 }}>전체 접기</Button>
           </ButtonGroup>
         </Stack>
      }
    >
      <Box
        sx={{
          height: "calc(100vh - 220px)", minHeight: 560, position: "relative", overflow: "hidden",
          background: resolvedMode === "dark"
            ? "radial-gradient(circle at 20% 30%, rgba(99, 102, 241, 0.08) 0%, transparent 40%), " +
              "radial-gradient(circle at 80% 70%, rgba(16, 185, 129, 0.06) 0%, transparent 40%), " +
              "radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.04) 0%, transparent 60%), " +
              "#182230"
            : "radial-gradient(circle at 20% 30%, rgba(99, 102, 241, 0.04) 0%, transparent 40%), " +
              "radial-gradient(circle at 80% 70%, rgba(16, 185, 129, 0.03) 0%, transparent 40%), " +
              "radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.02) 0%, transparent 60%), " +
              "#f5f7fb",
          borderRadius: 3,
          border: "1px solid",
          borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)",
          boxShadow: resolvedMode === "dark" ? "inset 0 2px 24px rgba(0,0,0,0.35)" : "inset 0 2px 24px rgba(0,0,0,0.05)",
          cursor: isDragging ? "grabbing" : "grab", userSelect: "none",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {isLoading ? (
          <Box sx={{ display:"flex", flexDirection:"column", gap:2, alignItems:"center", justifyContent:"center", height:"100%" }}>
            <CircularProgress sx={{ color: "#818cf8" }} />
            <Typography variant="body2" sx={{ color: resolvedMode === "dark" ? "rgba(255,255,255,0.45)" : "rgba(15,23,42,0.45)" }}>마인드맵 구성 중...</Typography>
          </Box>
        ) : isError ? (
          <Box sx={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", p:4 }}>
            <Alert severity="error">데이터 로드에 실패했습니다.</Alert>
          </Box>
        ) : (
          <>
            <svg ref={svgRef} width="100%" height="100%" style={{ display: "block" }}>
              <defs>
                <pattern id="mm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke={resolvedMode === "dark" ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.025)"} strokeWidth="1" />
                  <circle cx="0" cy="0" r="1.2" fill={resolvedMode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)"} />
                </pattern>
                <filter id="mm-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="mm-shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#000" floodOpacity="0.4" />
                </filter>
                <filter id="bg-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="80" />
                </filter>
              </defs>

              {/* Grid pattern background */}
              <rect width="100%" height="100%" fill="url(#mm-grid)" />

              {/* Ambient background glows */}
              <g style={{ pointerEvents: "none" }}>
                <circle cx="30%" cy="25%" r="400" fill="#4f46e5" opacity={resolvedMode === "dark" ? 0.04 : 0.02} filter="url(#bg-glow)" />
                <circle cx="75%" cy="75%" r="350" fill="#10b981" opacity={resolvedMode === "dark" ? 0.03 : 0.015} filter="url(#bg-glow)" />
                <circle cx="50%" cy="50%" r="450" fill="#8b5cf6" opacity={resolvedMode === "dark" ? 0.02 : 0.01} filter="url(#bg-glow)" />
              </g>

              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* Curved bezier links */}
                {visibleLinks.map((link, idx) => {
                  const src = link.source as unknown as { id: string; x: number; y: number; color: string };
                  const tgt = link.target as unknown as { id: string; x: number; y: number; color: string; type: string; name: string };
                  const isMatch = !!searchQuery && tgt.name.toLowerCase().includes(searchQuery.toLowerCase());
                  const isHoverActive = activeNodeIds ? (activeNodeIds.has(src.id) && activeNodeIds.has(tgt.id)) : false;
                  const isDimmed = hoveredNodeId ? !isHoverActive : false;

                  const pull = 0.28;
                  const c1x = src.x + (MM_CX - src.x) * pull;
                  const c1y = src.y + (MM_CY - src.y) * pull;
                  const c2x = tgt.x + (MM_CX - tgt.x) * pull;
                  const c2y = tgt.y + (MM_CY - tgt.y) * pull;
                  
                  const pathD = viewMode === "tree"
                    ? `M ${src.x} ${src.y} C ${(src.x + tgt.x) / 2} ${src.y}, ${(src.x + tgt.x) / 2} ${tgt.y}, ${tgt.x} ${tgt.y}`
                    : `M ${src.x} ${src.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tgt.x} ${tgt.y}`;

                  return (
                    <path key={`link-${idx}`}
                      d={pathD}
                      fill="none"
                      stroke={isMatch ? "#fbbf24" : isHoverActive ? "#818cf8" : src.color}
                      strokeWidth={isMatch ? 2.5 : isHoverActive ? 2.2 : tgt.type === "skill" ? 1 : 1.8}
                      strokeOpacity={isDimmed ? 0.05 : isMatch ? 1 : isHoverActive ? 0.9 : tgt.type === "skill" ? 0.25 : 0.5}
                      style={{ transition: "stroke 0.25s, stroke-opacity 0.25s, stroke-width 0.25s" }}
                    />
                  );
                })}

                {visibleCategoryRelations.map((relation, idx) => {
                  const src = visibleCategoryNodeById.get(String(relation.sourceCategoryId));
                  const tgt = visibleCategoryNodeById.get(String(relation.targetCategoryId));
                  if (!src || !tgt) return null;
                  
                  const pathD = getBundledPath(src.id, tgt.id, bundlingStrength);
                  if (!pathD) return null;

                  const isRelActive = hoveredNodeId ? (
                    hoveredCats.has(String(relation.sourceCategoryId)) || 
                    hoveredCats.has(String(relation.targetCategoryId))
                  ) : false;
                  const isDimmed = hoveredNodeId ? !isRelActive : false;

                  return (
                    <path
                      key={`category-relation-${relation.relationId ?? idx}`}
                      d={pathD}
                      fill="none"
                      stroke={isRelActive ? "#818cf8" : relation.persisted ? "#22c55e" : "#f59e0b"}
                      strokeWidth={isRelActive ? Math.max(2.5, Math.min(6, 2 + (relation.score ?? 0) * 3)) : Math.max(1.4, Math.min(4, 1.2 + (relation.score ?? 0) * 2))}
                      strokeOpacity={isDimmed ? 0.05 : isRelActive ? 1.0 : relation.persisted ? 0.62 : 0.78}
                      strokeDasharray={isRelActive ? "none" : relation.persisted ? "none" : "7 5"}
                      filter={isRelActive ? "url(#mm-glow)" : undefined}
                      style={{ pointerEvents: "none", transition: "stroke 0.25s, stroke-opacity 0.25s, stroke-width 0.25s" }}
                    />
                  );
                })}

                {/* Nodes */}
                {visibleNodes.map((node) => {
                  const mn = node as unknown as MNode;
                  const isCategory = mn.type === "category";
                  const isExpanded = isCategory && expandedCategories.has(mn.categoryId!);
                  const isSelected = selectedNode?.id === mn.id;
                  const isMatched = !!searchQuery && mn.name.toLowerCase().includes(searchQuery.toLowerCase());
                  const { color, depth } = mn;
                  const isL1 = depth === 0;

                  if (!isCategory) {
                    const label = mn.name.length > 16 ? mn.name.substring(0, 15) + "…" : mn.name;
                    const w = Math.max(72, label.length * 6.2 + 22);
                    const h = 24;
                    const isHovered = hoveredNodeId === mn.id;
                    const isHoverActive = activeNodeIds ? activeNodeIds.has(mn.id) : false;
                    const isDimmed = hoveredNodeId ? !isHoverActive : false;

                    return (
                      <g key={mn.id} transform={`translate(${mn.x - w / 2}, ${mn.y - h / 2})`} style={{ cursor: "pointer", transition: "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const dx = e.clientX - dragStartPos.current.x;
                          const dy = e.clientY - dragStartPos.current.y;
                          const dist = Math.sqrt(dx * dx + dy * dy);
                          if (dist < 5) {
                            setSelectedNode(node);
                          }
                        }}
                        onMouseEnter={() => setHoveredNodeId(mn.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}>
                        <rect x={0} y={0} width={w} height={h} rx={12}
                          fill={isMatched ? "rgba(251,191,36,0.15)" : isHovered ? (resolvedMode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)") : (resolvedMode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)")}
                          stroke={isMatched ? "#fbbf24" : isHovered ? (resolvedMode === "dark" ? "white" : "#1e293b") : isHoverActive ? "#818cf8" : (resolvedMode === "dark" ? color : alpha(color, 0.6))}
                          strokeWidth={isHovered || isSelected || isMatched ? 1.5 : 0.75}
                          strokeOpacity={isDimmed ? 0.18 : isMatched ? 1 : 0.4}
                          opacity={isDimmed ? 0.18 : 1}
                          filter={isMatched || isHovered ? "url(#mm-glow)" : undefined}
                          style={{ transition: "fill 0.2s, stroke 0.2s, opacity 0.2s, stroke-opacity 0.2s" }} />
                        <circle cx={11} cy={h / 2} r={3} fill={color} opacity={isDimmed ? 0.18 : 0.85} />
                        <text x={22} y={h / 2 + 4} fontSize="10.5" fontWeight={500}
                          fill={isMatched ? (resolvedMode === "dark" ? "#fef9c3" : "#78350f") : isHovered ? (resolvedMode === "dark" ? "white" : "#0f172a") : (resolvedMode === "dark" ? "rgba(255,255,255,0.75)" : "rgba(15,23,42,0.75)")}
                          opacity={isDimmed ? 0.18 : 1}
                          style={{ pointerEvents: "none", fontFamily: "Inter, system-ui, sans-serif", transition: "opacity 0.2s" }}>
                          {label}
                        </text>
                      </g>
                    );
                  }

                  const label = mn.name.length > (isL1 ? 13 : 12) ? mn.name.substring(0, isL1 ? 12 : 11) + "…" : mn.name;
                  const w = isL1 ? 136 : 112;
                  const h = isL1 ? 38 : 32;
                  const rx = isL1 ? 19 : 16;
                  const isHovered = hoveredNodeId === mn.id;
                  const isHoverActive = activeNodeIds ? activeNodeIds.has(mn.id) : false;
                  const isDimmed = hoveredNodeId ? !isHoverActive : false;

                  return (
                    <g key={mn.id} transform={`translate(${mn.x - w / 2}, ${mn.y - h / 2})`} style={{ cursor: "pointer", transition: "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const dx = e.clientX - dragStartPos.current.x;
                        const dy = e.clientY - dragStartPos.current.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist < 5) {
                          const now = Date.now();
                          const lastClick = lastClickRef.current;
                          if (lastClick.nodeId === mn.id && now - lastClick.time < 300) {
                            toggleCategoryExpand(mn.categoryId!);
                            lastClickRef.current = { time: 0, nodeId: null };
                          } else {
                            lastClickRef.current = { time: now, nodeId: mn.id };
                            setSelectedNode(node);
                          }
                        }
                      }}
                      onMouseEnter={() => setHoveredNodeId(mn.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}>
                      {isL1 && <rect x={-4} y={-4} width={w + 8} height={h + 8} rx={rx + 4} fill={`${color}18`} style={{ pointerEvents: "none" }} opacity={isDimmed ? 0.18 : 1} />}
                      <rect x={0} y={0} width={w} height={h} rx={rx}
                        fill={isMatched ? (resolvedMode === "dark" ? `${color}2a` : `${color}2f`) : isHovered ? (resolvedMode === "dark" ? `${color}32` : `${color}25`) : (resolvedMode === "dark" ? `${color}18` : `${color}10`)}
                        stroke={isMatched ? "#fbbf24" : isSelected || isHovered ? (resolvedMode === "dark" ? "white" : "#1e293b") : isHoverActive ? "#818cf8" : color}
                        strokeWidth={isSelected || isHovered ? 2.5 : isMatched ? 2 : isL1 ? 2 : 1.5}
                        opacity={isDimmed ? 0.18 : 1}
                        filter={isL1 ? "url(#mm-shadow)" : (isMatched || isHovered) ? "url(#mm-glow)" : undefined}
                        style={{ transition: "fill 0.2s, stroke 0.2s, opacity 0.2s" }} />
                      <text x={w / 2} y={h / 2 + 4} textAnchor="middle"
                        fontSize={isL1 ? "13" : "11.5"} fontWeight={isL1 ? 800 : 700}
                        fill={isMatched ? (resolvedMode === "dark" ? "#fef9c3" : "#78350f") : (resolvedMode === "dark" ? "white" : "rgba(0, 0, 0, 0.85)")}
                        opacity={isDimmed ? 0.18 : 1}
                        style={{ pointerEvents: "none", fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "-0.3px", transition: "opacity 0.2s" }}>
                        {label}
                      </text>
                      {mn.children.length > 0 && (
                        <g transform={`translate(${w - 5}, -5)`} opacity={isDimmed ? 0.18 : 1}>
                           <circle cx={0} cy={0} r={8} fill={color} opacity={0.9} />
                           <text x={0} y={3.5} textAnchor="middle" fontSize="8" fontWeight={800} fill="white" style={{ pointerEvents: "none" }}>{mn.children.length}</text>
                        </g>
                      )}
                      {mn.children.length > 0 && (
                        <g transform={`translate(${w / 2}, ${h})`}
                           onMouseDown={(e) => e.stopPropagation()}
                           onClick={(e) => { e.stopPropagation(); toggleCategoryExpand(mn.categoryId!); }}
                           style={{ cursor: "pointer" }}
                           opacity={isDimmed ? 0.18 : 1}>
                          <circle cx={0} cy={0} r={8} fill={color} stroke={resolvedMode === "dark" ? "#0f172a" : "white"} strokeWidth={1} />
                          {isExpanded
                            ? <path d="M-3 1 L0 -2 L3 1" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                            : <path d="M-3 -2 L0 1 L3 -2" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />}
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Left Floating Controls Stack */}
            <Stack
              spacing={1.5}
              sx={{
                position: "absolute",
                top: 20,
                left: 20,
                zIndex: 10,
                pointerEvents: "none",
              }}
            >
              {/* Legend & Guide Panel */}
              {showLegend ? (
                <Paper elevation={0} sx={{
                  width: 250, p: 1.75,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                  bgcolor: resolvedMode === "dark" ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.9)",
                  backdropFilter: "blur(12px)",
                  boxShadow: resolvedMode === "dark" ? "0 4px 24px rgba(0,0,0,0.4)" : "0 4px 24px rgba(0,0,0,0.08)",
                  color: resolvedMode === "dark" ? "white" : "text.primary",
                  pointerEvents: "auto",
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                >
                  <Stack spacing={1.5}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="caption" sx={{ fontWeight: 800, color: "#818cf8", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                        범례 및 사용 가이드
                      </Typography>
                      <IconButton size="small" onClick={() => setShowLegend(false)} sx={{ color: "text.secondary", p: 0.5 }}>
                        <CloseOutlined fontSize="small" sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Stack>
                    
                    <Stack spacing={0.75}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ width: 12, height: 1.5, bgcolor: "#22c55e" }} />
                        <Typography variant="caption" sx={{ color: resolvedMode === "dark" ? "rgba(255,255,255,0.7)" : "rgba(15,23,42,0.7)" }}>저장된 관계 (실선)</Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ width: 12, height: 1.5, borderTop: "1.5px dashed #f59e0b" }} />
                        <Typography variant="caption" sx={{ color: resolvedMode === "dark" ? "rgba(255,255,255,0.7)" : "rgba(15,23,42,0.7)" }}>추천 관계 (점선)</Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "#34d399" }} />
                        <Typography variant="caption" sx={{ color: resolvedMode === "dark" ? "rgba(255,255,255,0.7)" : "rgba(15,23,42,0.7)" }}>스킬 노드 (대표 스킬)</Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ width: 10, height: 10, borderRadius: 3, border: "1px solid #818cf8", bgcolor: "rgba(129,140,248,0.15)" }} />
                        <Typography variant="caption" sx={{ color: resolvedMode === "dark" ? "rgba(255,255,255,0.7)" : "rgba(15,23,42,0.7)" }}>카테고리 노드 (대/중/소)</Typography>
                      </Stack>
                    </Stack>

                    <Divider sx={{ borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }} />

                    <Stack spacing={0.5}>
                      <Typography variant="caption" sx={{ fontSize: 10, color: resolvedMode === "dark" ? "rgba(255,255,255,0.4)" : "rgba(15,23,42,0.4)", fontWeight: 700 }}>
                        조작 방법
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: 10.5, color: resolvedMode === "dark" ? "rgba(255,255,255,0.6)" : "rgba(15,23,42,0.6)", display: "flex", alignItems: "center" }}>
                        • 드래그: 캔버스 이동
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: 10.5, color: resolvedMode === "dark" ? "rgba(255,255,255,0.6)" : "rgba(15,23,42,0.6)", display: "flex", alignItems: "center" }}>
                        • 마우스 휠: 확대/축소
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: 10.5, color: resolvedMode === "dark" ? "rgba(255,255,255,0.6)" : "rgba(15,23,42,0.6)", display: "flex", alignItems: "center" }}>
                        • 카테고리 더블 클릭 / 버튼: 하위 접기/펼치기
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: 10.5, color: resolvedMode === "dark" ? "rgba(255,255,255,0.6)" : "rgba(15,23,42,0.6)", display: "flex", alignItems: "center" }}>
                        • 카테고리/스킬 클릭: 선택 및 상세 정보
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: 10.5, color: resolvedMode === "dark" ? "rgba(255,255,255,0.6)" : "rgba(15,23,42,0.6)", display: "flex", alignItems: "center" }}>
                        • 노드 호버: 연결 관계 집중 강조
                      </Typography>
                    </Stack>
                  </Stack>
                </Paper>
              ) : (
                <Tooltip title="범례 및 사용 가이드 표시" placement="right">
                  <Paper
                    elevation={0}
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px solid",
                      borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                      bgcolor: resolvedMode === "dark" ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.9)",
                      backdropFilter: "blur(12px)",
                      boxShadow: resolvedMode === "dark" ? "0 4px 24px rgba(0,0,0,0.4)" : "0 4px 24px rgba(0,0,0,0.08)",
                      pointerEvents: "auto",
                      cursor: "pointer",
                      "&:hover": {
                        bgcolor: resolvedMode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.04)"
                      }
                    }}
                    onClick={() => setShowLegend(true)}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    <HelpOutlineOutlined fontSize="small" sx={{ color: "primary.main" }} />
                  </Paper>
                </Tooltip>
              )}

              {/* Search Matches Panel */}
              {searchQuery.trim() && (
                <Paper elevation={0} sx={{
                  width: 250, maxHeight: 220, display: "flex", flexDirection: "column",
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                  bgcolor: resolvedMode === "dark" ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.9)",
                  backdropFilter: "blur(12px)",
                  boxShadow: resolvedMode === "dark" ? "0 4px 24px rgba(0,0,0,0.25)" : "0 4px 24px rgba(0,0,0,0.08)",
                  color: resolvedMode === "dark" ? "white" : "text.primary",
                  overflow: "hidden",
                  pointerEvents: "auto",
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                >
                  <Box sx={{ p: 1.5, borderBottom: "1px solid", borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: "#818cf8", letterSpacing: "0.5px" }}>
                      검색 결과 ({visibleNodes.filter(n => n.name.toLowerCase().includes(searchQuery.toLowerCase())).length}개)
                    </Typography>
                  </Box>
                  <List sx={{ overflowY: "auto", p: 0.5, flex: 1 }}>
                    {(() => {
                      const matches = visibleNodes.filter(n => n.name.toLowerCase().includes(searchQuery.toLowerCase()));
                      if (matches.length === 0) {
                        return (
                          <ListItem sx={{ py: 1 }}>
                            <Typography variant="caption" sx={{ color: "text.secondary", width: "100%", textAlign: "center" }}>결과가 없습니다.</Typography>
                          </ListItem>
                        );
                      }
                      return matches.map((node) => (
                        <ListItemButton
                          key={node.id}
                          onClick={() => {
                            setSelectedNode(node);
                            centerOnNode(node);
                          }}
                          sx={{
                            py: 0.5, px: 1,
                            borderRadius: 1,
                            "&:hover": {
                              bgcolor: resolvedMode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)"
                            }
                          }}
                        >
                          <Stack spacing={0.25} sx={{ width: "100%" }}>
                            <Stack direction="row" spacing={0.75} alignItems="center">
                              <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: node.type === "category" ? (node as any).color : "#34d399" }} />
                              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 11.5, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                                {node.name}
                              </Typography>
                            </Stack>
                            <Typography variant="caption" sx={{ fontSize: 9.5, color: "text.secondary" }}>
                              {node.type === "category" ? "카테고리" : "스킬"} · Level {node.depth}
                            </Typography>
                          </Stack>
                        </ListItemButton>
                      ));
                    })()}
                  </List>
                </Paper>
              )}
            </Stack>

            {/* Zoom controls */}
            <Paper elevation={0} sx={{
              position: "absolute", top: 20, right: 20,
              display: "flex", flexDirection: "column", gap: 0.5, p: 0.75,
              borderRadius: 2,
              border: "1px solid",
              borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
              bgcolor: resolvedMode === "dark" ? "rgba(15,23,42,0.88)" : "rgba(255,255,255,0.9)",
              backdropFilter: "blur(12px)",
              boxShadow: resolvedMode === "dark" ? "0 4px 20px rgba(0,0,0,0.4)" : "0 4px 20px rgba(0,0,0,0.05)",
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            >
              <Tooltip title="확대" placement="left">
                <IconButton size="small" onClick={() => setZoom(z => Math.min(3, z * 1.2))} sx={{ color: resolvedMode === "dark" ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.54)", "&:hover": { color: resolvedMode === "dark" ? "white" : "black" } }}>
                  <ZoomInOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="축소" placement="left">
                <IconButton size="small" onClick={() => setZoom(z => Math.max(0.15, z / 1.2))} sx={{ color: resolvedMode === "dark" ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.54)", "&:hover": { color: resolvedMode === "dark" ? "white" : "black" } }}>
                  <ZoomOutOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="위치 초기화" placement="left">
                <IconButton size="small" onClick={resetPanZoom} sx={{ color: resolvedMode === "dark" ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.54)", "&:hover": { color: resolvedMode === "dark" ? "white" : "black" } }}>
                  <RestartAltOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            </Paper>

            {showCategoryRelations && categoryRelationGraph && (
              <Paper
                elevation={0}
                sx={{
                  position: "absolute",
                  top: 20,
                  right: 76,
                  width: categoryRelationPanelWidth,
                  height: "calc(100% - 40px)",
                  maxHeight: "calc(100% - 40px)",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
                  bgcolor: resolvedMode === "dark" ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.95)",
                  color: resolvedMode === "dark" ? "white" : "text.primary",
                  backdropFilter: "blur(14px)",
                  boxShadow: resolvedMode === "dark" ? "0 12px 32px rgba(0,0,0,0.36)" : "0 12px 32px rgba(0,0,0,0.08)",
                  overflow: "hidden",
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
              >
                <Box
                  role="separator"
                  aria-orientation="vertical"
                  title="미리보기 패널 크기 조정"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsResizingCategoryRelationPanel(true);
                  }}
                  sx={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 9,
                    cursor: "ew-resize",
                    zIndex: 2,
                    "&::after": {
                      content: '""',
                      position: "absolute",
                      top: "50%",
                      left: 3,
                      width: 3,
                      height: 52,
                      borderRadius: 999,
                      bgcolor: isResizingCategoryRelationPanel
                        ? (resolvedMode === "dark" ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.5)")
                        : (resolvedMode === "dark" ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.15)"),
                      transform: "translateY(-50%)",
                    },
                    "&:hover::after": {
                      bgcolor: resolvedMode === "dark" ? "rgba(255,255,255,0.58)" : "rgba(0,0,0,0.3)",
                    },
                  }}
                />
                <Box sx={{ p: 1.5, borderBottom: "1px solid", borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Stack spacing={0.25}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                        추천 그룹 미리보기
                      </Typography>
                      <Typography variant="caption" sx={{ color: resolvedMode === "dark" ? "rgba(255,255,255,0.58)" : "text.secondary" }}>
                        {useLlmCategoryRelations ? "LLM" : "rule"} · 추천 그룹 {parentCategorySuggestions.length.toLocaleString()}개
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.25} alignItems="center">
                      <Tooltip title="패널 축소">
                        <IconButton
                          size="small"
                          onClick={() => setCategoryRelationPanelWidth((width) => Math.max(340, width - 90))}
                          sx={{ color: resolvedMode === "dark" ? "rgba(255,255,255,0.72)" : "action.active" }}
                        >
                          <ZoomOutOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="패널 확대">
                        <IconButton
                          size="small"
                          onClick={() => setCategoryRelationPanelWidth((width) => Math.min(760, width + 90))}
                          sx={{ color: resolvedMode === "dark" ? "rgba(255,255,255,0.72)" : "action.active" }}
                        >
                          <ZoomInOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="닫기">
                        <IconButton size="small" onClick={() => setShowCategoryRelations(false)} sx={{ color: resolvedMode === "dark" ? "rgba(255,255,255,0.72)" : "action.active" }}>
                          <CloseOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Box>

                {previewCategoryRelationsMutation.error ? (
                  <Alert severity="error" sx={{ m: 1.5, borderRadius: 1.5 }}>
                    {resolveAxiosError(previewCategoryRelationsMutation.error) || "카테고리 관계 분석에 실패했습니다."}
                  </Alert>
                ) : null}
                <Box sx={{ px: 1.5, pt: 1.25, pb: 1, borderBottom: "1px solid", borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}>
                  <Stack spacing={1}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.1,
                        borderRadius: 1.5,
                        bgcolor: resolvedMode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)",
                        border: "1px solid",
                        borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Stack spacing={0.25}>
                          <Typography variant="body2" sx={{ color: resolvedMode === "dark" ? "white" : "text.primary", fontWeight: 850 }}>
                            추천 그룹을 확인하고 저장하세요
                          </Typography>
                          <Typography variant="caption" sx={{ color: resolvedMode === "dark" ? "rgba(255,255,255,0.58)" : "text.secondary" }}>
                            저장하면 새 상위 카테고리를 만들고 관련 카테고리를 그 아래로 이동합니다.
                          </Typography>
                        </Stack>
                        <Chip
                          size="small"
                          label={parentCategorySuggestions.length ? `${parentCategorySuggestions.length}개 추천` : "추천 없음"}
                          color={parentCategorySuggestions.length ? "primary" : "default"}
                          sx={{ height: 22, fontSize: 10, fontWeight: 850, flexShrink: 0 }}
                        />
                      </Stack>
                    </Paper>
                  </Stack>
                </Box>
                {parentCategorySuggestions.length ? (
                  <Box
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: "auto",
                      borderBottom: "1px solid",
                      borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                      px: 1.5,
                      py: 1.25,
                      "&::-webkit-scrollbar": { width: 4 },
                      "&::-webkit-scrollbar-thumb": {
                        bgcolor: resolvedMode === "dark" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
                        borderRadius: 2
                      }
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography variant="caption" sx={{ color: resolvedMode === "dark" ? "rgba(255,255,255,0.74)" : "text.primary", fontWeight: 850 }}>
                        상위 카테고리 후보
                      </Typography>
                      <Typography variant="caption" sx={{ color: resolvedMode === "dark" ? "rgba(255,255,255,0.42)" : "text.secondary" }}>
                        저장 시 신규 카테고리 생성
                      </Typography>
                    </Stack>
                    {saveParentCategorySuggestionMutation.error ? (
                      <Alert severity="error" sx={{ mb: 1, borderRadius: 1.5 }}>
                        {resolveAxiosError(saveParentCategorySuggestionMutation.error) || "상위 카테고리 저장에 실패했습니다."}
                      </Alert>
                    ) : null}
                    {saveParentCategorySuggestionMutation.isSuccess ? (
                      <Alert severity="success" sx={{ mb: 1, borderRadius: 1.5 }}>
                        상위 카테고리를 생성하고 하위 카테고리를 이동했습니다.
                      </Alert>
                    ) : null}
                    <Stack spacing={1}>
                      {parentCategorySuggestions.map((suggestion) => {
                        const childNames = suggestion.childCategoryIds.map((id) => categoryNameById.get(id) ?? id);
                        return (
                          <Paper
                            key={suggestion.suggestionId}
                            elevation={0}
                            sx={{
                              p: 1,
                              borderRadius: 1.5,
                              bgcolor: resolvedMode === "dark" ? "rgba(37,99,235,0.10)" : "rgba(37,99,235,0.05)",
                              border: "1px solid",
                              borderColor: resolvedMode === "dark" ? "rgba(147,197,253,0.18)" : "rgba(37,99,235,0.15)",
                            }}
                          >
                            <Stack spacing={0.85}>
                              <TextField
                                size="small"
                                label="신규 상위 카테고리명"
                                value={parentSuggestionNames[suggestion.suggestionId] ?? suggestion.suggestedName}
                                onChange={(event) => setParentSuggestionNames((prev) => ({
                                  ...prev,
                                  [suggestion.suggestionId]: event.target.value,
                                }))}
                                sx={{
                                  "& .MuiInputBase-root": {
                                    bgcolor: resolvedMode === "dark" ? "rgba(15,23,42,0.6)" : "rgba(255,255,255,0.9)",
                                    color: resolvedMode === "dark" ? "white" : "text.primary",
                                    borderRadius: 1,
                                    border: "1px solid",
                                    borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
                                  },
                                  "& .MuiInputBase-input": {
                                    fontWeight: 750,
                                    fontSize: 13,
                                  },
                                }}
                              />
                              <Typography variant="caption" sx={{ color: resolvedMode === "dark" ? "rgba(255,255,255,0.66)" : "text.secondary", lineHeight: 1.35 }}>
                                {childNames.join(" · ")}
                              </Typography>
                              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                <Stack direction="row" spacing={0.75}>
                                  <Chip size="small" label={`${suggestion.childCategoryIds.length}개 하위`} sx={{ height: 20, fontSize: 10, fontWeight: 800 }} />
                                  <Chip size="small" label={`score ${suggestion.score.toFixed(2)}`} sx={{ height: 20, fontSize: 10, fontWeight: 800 }} />
                                </Stack>
                                <Button
                                  size="small"
                                  variant="contained"
                                  disabled={!canAdmin || saveParentCategorySuggestionMutation.isPending}
                                  onClick={() => {
                                    const name = parentSuggestionNames[suggestion.suggestionId] ?? suggestion.suggestedName;
                                    const confirmed = window.confirm(`"${name}" 상위 카테고리를 만들고 ${suggestion.childCategoryIds.length}개 카테고리를 하위로 이동하시겠습니까?`);
                                    if (confirmed) {
                                      saveParentCategorySuggestionMutation.mutate(suggestion);
                                    }
                                  }}
                                  sx={{ fontWeight: 850 }}
                                >
                                  생성 후 그룹화
                                </Button>
                              </Stack>
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Stack>
                  </Box>
                ) : (
                  <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1.5, py: 4, textAlign: "center", borderBottom: "1px solid", borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}>
                    <Typography variant="body2" sx={{ color: resolvedMode === "dark" ? "rgba(255,255,255,0.72)" : "text.secondary", fontWeight: 700 }}>
                      추천할 상위 카테고리 그룹이 없습니다.
                    </Typography>
                    <Typography variant="caption" sx={{ color: resolvedMode === "dark" ? "rgba(255,255,255,0.48)" : "text.secondary" }}>
                      관계 score가 높은 카테고리가 충분할 때 후보가 표시됩니다.
                    </Typography>
                  </Box>
                )}

                <Box sx={{ p: 1.5, borderTop: "1px solid", borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }}>
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => previewCategoryRelationsMutation.mutate()}
                      disabled={previewCategoryRelationsMutation.isPending}
                      sx={{
                        color: resolvedMode === "dark" ? "white" : "text.primary",
                        borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.24)" : "rgba(0,0,0,0.24)",
                        fontWeight: 750,
                        "&:hover": {
                          borderColor: resolvedMode === "dark" ? "white" : "black"
                        }
                      }}
                    >
                      다시 분석
                    </Button>
                  </Stack>
                </Box>
              </Paper>
            )}

            {selectedNode && (
              <Box
                sx={{
                  position: "absolute",
                  bottom: 20,
                  left: 20,
                  zIndex: 10,
                  pointerEvents: "none",
                  animation: "slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  "@keyframes slideIn": {
                    from: { transform: "translateY(15px)", opacity: 0 },
                    to: { transform: "translateY(0)", opacity: 1 },
                  }
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    width: 320,
                    p: 2.2,
                    pt: 1.2,
                    borderRadius: 3,
                    border: "1px solid",
                    borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                    bgcolor: resolvedMode === "dark" ? "rgba(15, 23, 42, 0.85)" : "rgba(255, 255, 255, 0.95)",
                    color: resolvedMode === "dark" ? "white" : "text.primary",
                    backdropFilter: "blur(12px)",
                    boxShadow: resolvedMode === "dark" ? "0 10px 30px rgba(0,0,0,0.3)" : "0 10px 30px rgba(0,0,0,0.08)",
                    transform: `translate(${detailPanelOffset.x}px, ${detailPanelOffset.y}px)`,
                    pointerEvents: "auto",
                    cursor: isDraggingDetailPanel ? "grabbing" : "grab",
                    userSelect: isDraggingDetailPanel ? "none" : "auto",
                  }}
                  onMouseDown={(e) => {
                    const target = e.target as HTMLElement;
                    if (
                      target.closest("button") ||
                      target.closest("a") ||
                      target.closest("input") ||
                      target.closest(".MuiSwitch-root") ||
                      target.closest(".MuiChip-root") ||
                      target.closest(".MuiIconButton-root")
                    ) {
                      return;
                    }
                    const scrollContainer = target.closest(".scrollbar-container") || target.closest("[style*='overflow']");
                    if (scrollContainer) return;

                    setIsDraggingDetailPanel(true);
                    detailPanelDragStart.current = {
                      x: e.clientX - detailPanelOffset.x,
                      y: e.clientY - detailPanelOffset.y,
                    };
                    e.stopPropagation();
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "center", mb: 0.5, color: resolvedMode === "dark" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)" }}>
                    <DragHandleOutlined sx={{ fontSize: 20 }} />
                  </Box>

                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {selectedNode.type === "category" ? (
                        <Chip label="Category" size="small" color="primary" sx={{ fontWeight: 800, borderRadius: 1.5, height: 20, fontSize: "10.5px" }} />
                      ) : (
                        <Chip label="Skill" size="small" color="success" sx={{ fontWeight: 800, borderRadius: 1.5, height: 20, fontSize: "10.5px" }} />
                      )}
                      <Typography variant="caption" sx={{ color: resolvedMode === "dark" ? "rgba(255,255,255,0.6)" : "text.secondary", fontWeight: 600 }}>
                        Level {selectedNode.depth}
                      </Typography>
                    </Stack>
                    <IconButton size="small" onClick={() => setSelectedNode(null)} sx={{ p: 0.25, color: resolvedMode === "dark" ? "rgba(255,255,255,0.6)" : "action.active" }}>
                      <CloseOutlined fontSize="small" />
                    </IconButton>
                  </Box>
                  
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: resolvedMode === "dark" ? "white" : "text.primary", mb: 0.5 }}>
                    {selectedNode.name}
                  </Typography>
                  
                  <Typography variant="caption" sx={{ display: "block", mb: 1.5, color: resolvedMode === "dark" ? "rgba(255,255,255,0.5)" : "text.secondary" }}>
                    ID: {selectedNode.type === "category" ? selectedNode.categoryId : selectedNode.skillId}
                  </Typography>

                  <Divider sx={{ my: 1.5, borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }} />

                  {selectedNode.type === "category" ? (
                    (() => {
                      const categoriesList = listFrom<SkillCategory>(categoriesQuery.data ?? []);
                      const subcatCount = categoriesList.filter(c => String(c.parentId ?? c.parentCategoryId) === String(selectedNode.categoryId)).length;
                      return (
                        <Stack spacing={1.5}>
                          <Box>
                            <Typography variant="body2" sx={{ color: resolvedMode === "dark" ? "rgba(255,255,255,0.7)" : "text.secondary" }}>
                              하위 카테고리 개수: <Typography component="strong" sx={{ color: resolvedMode === "dark" ? "white" : "#1e293b", fontWeight: 700 }}>{subcatCount}개</Typography>
                            </Typography>
                            <Typography variant="caption" sx={{ fontStyle: "italic", mt: 0.25, display: "block", color: resolvedMode === "dark" ? "rgba(255,255,255,0.45)" : "text.secondary" }}>
                              * 노드를 클릭하여 해당 카테고리 브랜치를 접거나 펼칠 수 있습니다.
                            </Typography>
                          </Box>

                          <Divider sx={{ borderStyle: "dashed", my: 0.5, borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }} />

                          <Box>
                            <FormControlLabel
                              control={
                                <Switch
                                  size="small"
                                  checked={expandedSkillsCategories.has(selectedNode.categoryId!)}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setExpandedSkillsCategories(prev => {
                                      const next = new Set(prev);
                                      if (checked) next.add(selectedNode.categoryId!);
                                      else next.delete(selectedNode.categoryId!);
                                      return next;
                                    });
                                    if (checked) {
                                      setExpandedCategories(prev => {
                                        const next = new Set(prev);
                                        next.add(selectedNode.categoryId!);
                                        return next;
                                      });
                                    }
                                  }}
                                  sx={{
                                    "& .MuiSwitch-switchBase.Mui-checked": { color: "#10b981" },
                                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#10b981" }
                                  }}
                                />
                              }
                              label={
                                <Typography variant="body2" sx={{ fontSize: 11.5, fontWeight: 700, color: resolvedMode === "dark" ? "white" : "text.primary" }}>
                                  지도에 이 카테고리의 스킬 표시
                                </Typography>
                              }
                              sx={{ my: 0.25 }}
                            />

                            {categorySkills.length > 0 ? (
                              <Box sx={{ mt: 1 }}>
                                <Typography variant="caption" sx={{ fontWeight: 800, display: "block", mb: 0.5, color: resolvedMode === "dark" ? "rgba(255,255,255,0.7)" : "text.secondary" }}>
                                  소속 스킬 목록 ({categorySkills.length}개)
                                </Typography>
                                <Box sx={{
                                  maxHeight: 120, overflowY: "auto", pr: 0.5,
                                  border: "1px solid",
                                  borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                                  borderRadius: 1.5, p: 0.75,
                                  bgcolor: resolvedMode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                                  display: "flex", flexWrap: "wrap", gap: 0.5,
                                  "&::-webkit-scrollbar": { width: 4 },
                                  "&::-webkit-scrollbar-thumb": {
                                    bgcolor: resolvedMode === "dark" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
                                    borderRadius: 2
                                  }
                                }}>
                                  {categorySkills.map(s => (
                                    <Chip key={s.skillId} label={s.skillName ?? s.name} size="small"
                                      sx={{
                                        fontSize: 9.5, height: 18, fontWeight: 600,
                                        bgcolor: resolvedMode === "dark" ? "rgba(255,255,255,0.06)" : "background.paper",
                                        border: "1px solid",
                                        borderColor: resolvedMode === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                                        color: resolvedMode === "dark" ? "rgba(255,255,255,0.85)" : "text.primary",
                                      }} />
                                  ))}
                                </Box>
                              </Box>
                            ) : (
                              <Typography variant="caption" sx={{ display: "block", mt: 0.75, fontStyle: "italic", color: resolvedMode === "dark" ? "rgba(255,255,255,0.45)" : "text.secondary" }}>
                                이 카테고리에 배정된 스킬이 없습니다.
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                      );
                    })()
                  ) : (
                    <Stack spacing={1}>
                      <Typography variant="body2" sx={{ color: resolvedMode === "dark" ? "rgba(255,255,255,0.7)" : "text.secondary" }}>
                        소속 카테고리: <Typography component="strong" sx={{ color: resolvedMode === "dark" ? "white" : "#334155", fontWeight: 700 }}>{
                          listFrom<SkillCategory>(categoriesQuery.data ?? []).find(c => String(c.categoryId) === String(listFrom<SkillDictionaryItem>(dictionaryQuery.data ?? []).find(s => String(s.skillId) === String(selectedNode.skillId))?.categoryId))?.categoryName ?? "-"
                        }</Typography>
                      </Typography>
                    </Stack>
                  )}
                </Paper>
              </Box>
            )}
          </>
        )}
      </Box>
    </PageFrame>
  );
}

function RelationSvg({ relations }: { relations: SkillRelation[] }) {
  const width = 920;
  const height = 520;
  const names = Array.from(new Set(relations.flatMap((relation) => [relation.fromSkillName, relation.toSkillName])));
  const nodes = names.map((name, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(1, names.length);
    return { name, x: width / 2 + Math.cos(angle) * 300, y: height / 2 + Math.sin(angle) * 190 };
  });
  const nodeByName = new Map(nodes.map((node) => [node.name, node]));
  return (
    <Paper variant="outlined" sx={{ overflowX: "auto", p: 1 }}>
      <svg width={width} height={height} role="img" aria-label="Skill relation graph">
        <rect x={0} y={0} width={width} height={height} rx={8} fill="#fff" />
        {relations.map((relation) => {
          const from = nodeByName.get(relation.fromSkillName);
          const to = nodeByName.get(relation.toSkillName);
          if (!from || !to) return null;
          return <line key={relation.relationId} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#90a4ae" strokeWidth={1.5} />;
        })}
        {nodes.map((node) => (
          <g key={node.name}>
            <circle cx={node.x} cy={node.y} r={24} fill="#1976d2" opacity={0.88} />
            <text x={node.x} y={node.y + 40} textAnchor="middle" fontSize={12} fill="#263238">{node.name}</text>
          </g>
        ))}
      </svg>
    </Paper>
  );
}

export function SkillGraphViewerPage() {
  const { canAdmin } = useSkillGraphRoles();
  const [skillId, setSkillId] = useState("");
  const [relationType, setRelationType] = useState<SkillRelationType | "">("");
  const params = useMemo(() => ({ skillId, relationType, depth: 2 }), [relationType, skillId]);
  const query = useQuery({ queryKey: skillGraphQueryKeys.custom("relations", skillId, relationType), queryFn: () => skillGraphApi.listRelations(params) });
  const rows = listFrom<SkillRelation>(query.data);
  return (
    <PageFrame title="스킬 그래프 뷰어" label="특정 스킬 중심의 관계 그래프를 확인하고 관리합니다." actions={<Button disabled={!canAdmin} startIcon={<AddOutlined />}>Relation 추가</Button>}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField size="small" value={skillId} onChange={(event) => setSkillId(event.target.value)} placeholder="skillId" />
        <Select size="small" value={relationType} onChange={(event) => setRelationType(event.target.value as SkillRelationType | "")} displayEmpty sx={{ minWidth: 180 }}>
          {relationTypes.map((value) => <MenuItem key={value || "all"} value={value}>{value || "전체 관계"}</MenuItem>)}
        </Select>
      </Stack>
      {query.error ? <ErrorState error={query.error} /> : query.isLoading ? <LoadingState /> : rows.length === 0 ? <EmptyState title="relation이 없습니다." /> : <RelationSvg relations={rows} />}
    </PageFrame>
  );
}

function MappingPage({ mode }: { mode: "ncs" | "course" }) {
  const { canAdmin } = useSkillGraphRoles();
  const [keyword, setKeyword] = useState("");
  const query = useQuery({
    queryKey: skillGraphQueryKeys.custom(`${mode}-mapping`, keyword),
    queryFn: () => mode === "ncs" ? skillGraphApi.listNcsMappings({ keyword, limit: PAGE_SIZE }) : skillGraphApi.listCourseMappings({ keyword, limit: PAGE_SIZE }),
  });
  const rows = listFrom<SkillMapping>(query.data);
  const columns = useMemo<ColDef<SkillMapping>[]>(() => [
    { headerName: "Skill", field: "skillName", flex: 1 },
    { headerName: mode === "ncs" ? "NCS" : "Course", field: "targetName", flex: 1 },
    { headerName: "유사도", field: "similarityScore", width: 110, cellRenderer: ({ value }: { value?: number }) => <ScoreBadge value={value} /> },
    { headerName: "신뢰도", field: "confidenceScore", width: 110, cellRenderer: ({ value }: { value?: number }) => <ScoreBadge value={value} /> },
    { headerName: "Weight", field: "weight", width: 100 },
    { headerName: "승인", field: "approved", width: 90 },
    { headerName: "액션", width: 120, cellRenderer: () => <Button size="small" disabled={!canAdmin}>저장</Button> },
  ], [canAdmin, mode]);
  return (
    <PageFrame title={mode === "ncs" ? "NCS 매핑" : "과정 스킬 매핑"} label={mode === "ncs" ? "스킬과 NCS 매핑 후보를 검수합니다." : "과정별 핵심/보조 스킬 매핑을 관리합니다."}>
      <TextField size="small" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={mode === "ncs" ? "skill 또는 NCS 검색" : "과정 검색"} sx={{ maxWidth: 360 }} />
      {query.error ? <ErrorState error={query.error} /> : null}
      <GridContent columns={columns} rowData={rows} loading={query.isLoading} height={540} />
    </PageFrame>
  );
}

export function SkillGraphNcsMappingPage() {
  return <MappingPage mode="ncs" />;
}

export function SkillGraphCourseMappingPage() {
  return <MappingPage mode="course" />;
}

export function SkillGraphSimulationPage() {
  const { canOperate } = useSkillGraphRoles();
  const [tab, setTab] = useState<(typeof simulationTabs)[number]>("extraction");
  const [text, setText] = useState("");
  const [result, setResult] = useState<SkillGraphSimulationResponse | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Partial<Record<(typeof simulationTabs)[number], boolean>>>({});
  const mutation = useMutation({
    mutationFn: () => skillGraphApi.simulate(tab, { text, query: text, topK: 10, minScore: 0.5 }),
    onSuccess: (nextResult) => {
      setResult(nextResult);
      setCompletedSteps((current) => ({ ...current, [tab]: true }));
    },
  });
  const extractionMode = tab === "extraction";
  const activeStep = simulationSteps.findIndex((step) => step.value === tab);
  const textTooLong = text.length > SIMULATION_TEXT_MAX_LENGTH;

  return (
    <PageFrame title="추천 시뮬레이션" label="저장 없이 SkillGraph 처리 결과를 미리 확인합니다.">
      <Box sx={{ px: 0.5, py: 1, overflowX: "auto" }}>
        <Stepper nonLinear activeStep={activeStep} alternativeLabel sx={{ minWidth: { xs: 720, md: 0 } }}>
          {simulationSteps.map((step) => (
            <Step key={step.value} completed={Boolean(completedSteps[step.value])}>
              <StepButton
                color="inherit"
                onClick={() => {
                  setTab(step.value);
                  setResult(null);
                }}
              >
                {step.label}
              </StepButton>
            </Step>
          ))}
        </Stepper>
      </Box>
      <TextField
        multiline
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="시뮬레이션할 텍스트 또는 검색어를 입력하세요."
        error={textTooLong}
        helperText={`${text.length.toLocaleString()} / ${SIMULATION_TEXT_MAX_LENGTH.toLocaleString()}자${textTooLong ? " - 서버 요청 한도를 초과했습니다." : ""}`}
        FormHelperTextProps={{ sx: { textAlign: "right" } }}
        sx={{
          "& .MuiInputBase-root": {
            height: 220,
            alignItems: "flex-start",
          },
          "& textarea": {
            height: "100% !important",
            overflow: "auto !important",
          },
        }}
      />
      {extractionMode ? (
        <Alert severity="warning">
          현재 서버는 extraction dry-run API를 제공하지 않아 실행 시 후보가 저장될 수 있습니다.
        </Alert>
      ) : null}
      <Stack direction="row" spacing={1}>
        <Button variant="contained" disabled={!canOperate || !text.trim() || textTooLong || mutation.isPending} onClick={() => mutation.mutate()}>
          {extractionMode ? "추출 실행" : "Dry-run 실행"}
        </Button>
        <FormControlLabel
          control={<Chip size="small" label={extractionMode ? "후보 저장 가능" : "저장 안 함"} color={extractionMode ? "warning" : "info"} />}
          label=""
        />
      </Stack>
      {mutation.error ? <Alert severity="error">{resolveAxiosError(mutation.error) || "시뮬레이션 실패"}</Alert> : null}
      {mutation.isPending ? <LoadingState label="시뮬레이션을 실행하는 중입니다." /> : result ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1">결과</Typography>
          <Box component="pre" sx={{ mt: 1, whiteSpace: "pre-wrap", fontSize: 13, overflow: "auto" }}>
            {JSON.stringify(result, null, 2)}
          </Box>
        </Paper>
      ) : <EmptyState title="아직 실행된 시뮬레이션이 없습니다." />}
    </PageFrame>
  );
}
