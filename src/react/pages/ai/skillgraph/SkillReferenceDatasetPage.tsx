import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  alpha,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AccountTreeOutlined,
  ArrowForwardOutlined,
  AutoAwesomeOutlined,
  CloseOutlined,
  ExpandLess,
  ExpandMore,
  MapOutlined,
} from "@mui/icons-material";
import type { ColDef, ICellRendererParams, SortModelItem } from "ag-grid-community";

import { PageToolbar } from "@/react/components/page/PageToolbar";
import { PageableGridContent } from "@/react/components/ag-grid";
import type { PageableGridContentHandle } from "@/react/components/ag-grid/types";
import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import { useToast } from "@/react/feedback/ToastProvider";
import { skillGraphQueryKeys } from "@/react/pages/ai/skillgraph/queryKeys";
import {
  skillGraphApi,
  type SkillReferenceConcept,
  type SkillReferenceRoadmapContext,
} from "@/react/pages/ai/skillgraph/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SkillGraphLayout,
} from "@/react/pages/ai/skillgraph/components";
import { SkillReferenceEmbeddingDialog } from "@/react/pages/ai/skillgraph/SkillReferenceEmbeddingDialog";

class SkillReferenceConceptDataSource extends ReactPageDataSource<SkillReferenceConcept> {
  constructor() {
    super("/api/mgmt/skillgraph/datasets/reference-search");
  }

  async fetchForAgGrid({
    startRow,
    endRow,
    sortModel,
  }: {
    startRow: number;
    endRow: number;
    sortModel?: SortModelItem[];
  }) {
    const size = endRow - startRow || this.pageSize;
    const page = Math.floor(startRow / size);
    const sort =
      (sortModel ?? []).length > 0
        ? `${sortModel![0].colId},${sortModel![0].sort}`
        : "conceptId,desc";
    const mode = this.filter.mode as "search" | "children" | undefined;
    const datasetId = (this.filter.datasetId as string | undefined)?.trim();
    const conceptType = (this.filter.conceptType as string | undefined)?.trim();
    const query = (this.filter.query as string | undefined)?.trim();
    const parentConceptId = (this.filter.parentConceptId as string | undefined)?.trim();

    if (!datasetId) {
      return { rows: [], total: 0 };
    }

    const response =
      mode === "children" && parentConceptId
        ? await skillGraphApi.listReferenceChildren(datasetId, parentConceptId, { page, size, sort })
        : query
          ? await skillGraphApi.searchReferenceConcepts(
              {
                datasetId,
                conceptType: conceptType || undefined,
                query,
              },
              { page, size, sort }
            )
          : await skillGraphApi.listReferenceConcepts(datasetId, {
              conceptType: conceptType || undefined,
              page,
              size,
              sort,
            });

    return {
      rows: response.content ?? [],
      total: response.totalElements ?? 0,
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const NCS_CONCEPT_TYPES = [
  { value: "", label: "전체" },
  { value: "NCS_MAJOR_CATEGORY", label: "대분류" },
  { value: "NCS_MIDDLE_CATEGORY", label: "중분류" },
  { value: "NCS_MINOR_CATEGORY", label: "소분류" },
  { value: "NCS_DETAIL_CATEGORY", label: "세분류" },
  { value: "NCS_COMPETENCY_UNIT", label: "능력단위" },
  { value: "NCS_COMPETENCY_ELEMENT", label: "능력단위요소" },
  { value: "NCS_PERFORMANCE_CRITERIA", label: "수행준거" },
  { value: "NCS_KNOWLEDGE", label: "지식" },
  { value: "NCS_SKILL", label: "기술" },
  { value: "NCS_ATTITUDE", label: "태도" },
  { value: "NCS_KSA", label: "KSA" },
] as const;

function conceptTypeLabel(type?: string) {
  return NCS_CONCEPT_TYPES.find((t) => t.value === type)?.label ?? type ?? "-";
}

function conceptTypeColor(type?: string): "primary" | "secondary" | "success" | "warning" | "info" | "error" | "default" {
  if (type?.includes("CATEGORY")) return "primary";
  if (type === "NCS_COMPETENCY_UNIT") return "secondary";
  if (type === "NCS_COMPETENCY_ELEMENT") return "info";
  if (type === "NCS_PERFORMANCE_CRITERIA") return "warning";
  if (type === "NCS_KNOWLEDGE" || type === "NCS_SKILL" || type === "NCS_ATTITUDE" || type === "NCS_KSA") return "success";
  return "default";
}

/* ------------------------------------------------------------------ */
/*  Concept Detail Drawer                                              */
/* ------------------------------------------------------------------ */

function ConceptDetailDrawer({
  concept,
  open,
  onClose,
  onBrowseChildren,
  onViewRoadmap,
}: {
  concept: SkillReferenceConcept | null;
  open: boolean;
  onClose: () => void;
  onBrowseChildren: (concept: SkillReferenceConcept) => void;
  onViewRoadmap: (concept: SkillReferenceConcept) => void;
}) {
  if (!concept) return null;

  const isCompetencyUnit = concept.conceptType === "NCS_COMPETENCY_UNIT";

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: { xs: 360, sm: 520 }, p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" noWrap sx={{ flex: 1 }}>
            Concept 상세
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseOutlined fontSize="small" />
          </IconButton>
        </Stack>
        <Divider sx={{ my: 1.5 }} />

        <Stack spacing={2}>
          <Box>
            <Typography variant="caption" color="text.secondary">이름</Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>{concept.preferredLabel}</Typography>
          </Box>

          <Stack direction="row" spacing={1}>
            <Chip
              size="small"
              label={conceptTypeLabel(concept.conceptType)}
              color={conceptTypeColor(concept.conceptType)}
              variant="filled"
            />
            {concept.levelValue ? (
              <Chip size="small" label={`Level ${concept.levelValue}`} variant="outlined" />
            ) : null}
          </Stack>

          <FieldRow label="Concept ID" value={concept.conceptId} mono />
          <FieldRow label="Dataset ID" value={concept.datasetId} />
          <FieldRow label="Provider" value={concept.provider} />
          <FieldRow label="외부 코드" value={concept.externalCode} />
          <FieldRow label="상위 코드" value={concept.parentCode} />
          {concept.categoryPath ? (
            <Box>
              <Typography variant="caption" color="text.secondary">분류 경로</Typography>
              <Typography variant="body2" sx={{ mt: 0.25 }}>{concept.categoryPath}</Typography>
            </Box>
          ) : null}
          {concept.description ? (
            <Box>
              <Typography variant="caption" color="text.secondary">설명</Typography>
              <Typography variant="body2">{concept.description}</Typography>
            </Box>
          ) : null}

          <Divider />

          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AccountTreeOutlined />}
              onClick={() => onBrowseChildren(concept)}
              sx={{ textTransform: "none" }}
            >
              하위 Concept 조회
            </Button>
            {isCompetencyUnit ? (
              <Button
                size="small"
                variant="contained"
                startIcon={<MapOutlined />}
                onClick={() => onViewRoadmap(concept)}
                sx={{ textTransform: "none" }}
              >
                로드맵 컨텍스트
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Box>
    </Drawer>
  );
}

function FieldRow({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography
        variant="body2"
        sx={mono ? { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" } : undefined}
      >
        {value ?? "-"}
      </Typography>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/*  Roadmap Context Dialog                                             */
/* ------------------------------------------------------------------ */

function RoadmapContextDrawer({
  open,
  onClose,
  datasetId,
  conceptId,
}: {
  open: boolean;
  onClose: () => void;
  datasetId: string;
  conceptId: string;
}) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: skillGraphQueryKeys.custom("roadmap-context", datasetId, conceptId),
    queryFn: () => skillGraphApi.getRoadmapContext(datasetId, conceptId),
    enabled: open && !!datasetId && !!conceptId,
  });

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: { xs: 380, sm: 560, md: 640 }, p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" noWrap sx={{ flex: 1 }}>
            로드맵 컨텍스트
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseOutlined fontSize="small" />
          </IconButton>
        </Stack>
        <Divider sx={{ my: 1.5 }} />

        {isLoading ? (
          <LoadingState label="로드맵 컨텍스트를 불러오는 중..." />
        ) : isError ? (
          <ErrorState error={error} />
        ) : data ? (
          <RoadmapContextContent data={data} />
        ) : null}
      </Box>
    </Drawer>
  );
}

function RoadmapContextContent({ data }: { data: SkillReferenceRoadmapContext }) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    elements: true,
    criteria: true,
    ksa: true,
    relations: false,
  });

  const toggle = (key: string) =>
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <Stack spacing={2}>
      {/* Competency Unit header */}
      <Paper variant="outlined" sx={{ p: 2, bgcolor: (t) => alpha(t.palette.secondary.main, 0.04) }}>
        <Chip size="small" label="능력단위" color="secondary" sx={{ mb: 1 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {data.competencyUnit.preferredLabel}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {data.competencyUnit.externalCode} · {data.competencyUnit.categoryPath}
        </Typography>
        {data.competencyUnit.levelValue ? (
          <Chip size="small" label={`Level ${data.competencyUnit.levelValue}`} variant="outlined" sx={{ ml: 1 }} />
        ) : null}
      </Paper>

      {/* Competency Elements */}
      <RoadmapSection
        title={`능력단위요소 (${data.competencyElements.length})`}
        color="info"
        expanded={expandedSections.elements}
        onToggle={() => toggle("elements")}
        items={data.competencyElements}
      />

      {/* Performance Criteria */}
      <RoadmapSection
        title={`수행준거 (${data.performanceCriteria.length})`}
        color="warning"
        expanded={expandedSections.criteria}
        onToggle={() => toggle("criteria")}
        items={data.performanceCriteria}
      />

      {/* KSA */}
      <RoadmapSection
        title={`지식·기술·태도 (${data.knowledgeSkillsAttitudes.length})`}
        color="success"
        expanded={expandedSections.ksa}
        onToggle={() => toggle("ksa")}
        items={data.knowledgeSkillsAttitudes}
      />

      {/* Relations */}
      <Box>
        <ListItemButton onClick={() => toggle("relations")} sx={{ px: 0, borderRadius: 1 }}>
          <ListItemText
            primary={`관계 (${data.relations.length})`}
            primaryTypographyProps={{ variant: "subtitle2", fontWeight: 600 }}
          />
          {expandedSections.relations ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
        <Collapse in={expandedSections.relations}>
          <List dense disablePadding>
            {data.relations.map((rel) => (
              <ListItem key={rel.relationId} sx={{ pl: 2 }}>
                <ListItemText
                  primary={rel.relationType}
                  secondary={`${rel.sourceConceptId.slice(0, 16)}… → ${rel.targetConceptId.slice(0, 16)}…`}
                  primaryTypographyProps={{ fontSize: 13, fontWeight: 500 }}
                  secondaryTypographyProps={{ fontSize: 11, fontFamily: "monospace" }}
                />
                {rel.confidence != null ? (
                  <Chip size="small" variant="outlined" label={`${(rel.confidence * 100).toFixed(0)}%`} />
                ) : null}
              </ListItem>
            ))}
          </List>
        </Collapse>
      </Box>
    </Stack>
  );
}

function RoadmapSection({
  title,
  color,
  expanded,
  onToggle,
  items,
}: {
  title: string;
  color: "info" | "warning" | "success";
  expanded: boolean;
  onToggle: () => void;
  items: SkillReferenceConcept[];
}) {
  return (
    <Box>
      <ListItemButton onClick={onToggle} sx={{ px: 0, borderRadius: 1 }}>
        <ListItemText
          primary={title}
          primaryTypographyProps={{ variant: "subtitle2", fontWeight: 600 }}
        />
        {expanded ? <ExpandLess /> : <ExpandMore />}
      </ListItemButton>
      <Collapse in={expanded}>
        <List dense disablePadding>
          {items.map((item) => (
            <ListItem key={item.conceptId} sx={{ pl: 2 }}>
              <ListItemText
                primary={item.preferredLabel}
                secondary={
                  [item.externalCode, item.levelValue ? `Level ${item.levelValue}` : null]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
                primaryTypographyProps={{ fontSize: 13 }}
                secondaryTypographyProps={{ fontSize: 11 }}
              />
              <Chip
                size="small"
                label={conceptTypeLabel(item.conceptType)}
                color={color}
                variant="outlined"
                sx={{ fontSize: 11, height: 20 }}
              />
            </ListItem>
          ))}
          {items.length === 0 ? (
            <ListItem sx={{ pl: 2 }}>
              <ListItemText
                primary="항목이 없습니다."
                primaryTypographyProps={{ fontSize: 13, color: "text.secondary" }}
              />
            </ListItem>
          ) : null}
        </List>
      </Collapse>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export function SkillReferenceDatasetPage() {
  const toast = useToast();
  const gridRef = useRef<PageableGridContentHandle<SkillReferenceConcept>>(null);
  const dataSource = useMemo(() => new SkillReferenceConceptDataSource(), []);

  // Search form state
  const [datasetId, setDatasetId] = useState("");
  const [conceptType, setConceptType] = useState("");
  const [queryText, setQueryText] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [embeddingOpen, setEmbeddingOpen] = useState(false);

  // Navigation breadcrumb trail
  const [breadcrumbTrail, setBreadcrumbTrail] = useState<
    Array<{ label: string; conceptId: string; datasetId: string }>
  >([]);

  // Detail & roadmap state
  const [detailConcept, setDetailConcept] = useState<SkillReferenceConcept | null>(null);
  const [roadmapTarget, setRoadmapTarget] = useState<{ datasetId: string; conceptId: string } | null>(null);

  const {
    data: datasetPage,
    isLoading: isDatasetLoading,
  } = useQuery({
    queryKey: skillGraphQueryKeys.custom("reference-dataset-ids"),
    queryFn: () => skillGraphApi.listDatasetIds({ page: 0, size: 100, sort: "datasetId,desc" }),
  });
  const datasetOptions = datasetPage?.content ?? [];

  const handleSearch = useCallback((nextQueryText = queryText) => {
    if (!datasetId.trim()) {
      toast.warning("Dataset을 선택하세요.");
      return;
    }
    setBreadcrumbTrail([]);
    dataSource.applyFilter({
      mode: "search",
      datasetId: datasetId.trim(),
      conceptType: conceptType || undefined,
      query: nextQueryText.trim() || undefined,
    });
    setHasSearched(true);
    window.setTimeout(() => gridRef.current?.refresh(), 0);
  }, [dataSource, datasetId, conceptType, queryText, toast]);

  const handleRefreshSearch = useCallback(() => {
    if (!hasSearched) {
      handleSearch(queryText);
      return;
    }
    gridRef.current?.refresh();
  }, [handleSearch, hasSearched, queryText]);

  const handleBrowseChildren = useCallback(
    (concept: SkillReferenceConcept) => {
      setDetailConcept(null);
      setBreadcrumbTrail((prev) => [
        ...prev,
        { label: concept.preferredLabel, conceptId: concept.conceptId, datasetId: concept.datasetId },
      ]);
      dataSource.applyFilter({
        mode: "children",
        datasetId: concept.datasetId,
        parentConceptId: concept.conceptId,
      });
      setHasSearched(true);
      gridRef.current?.refresh();
    },
    [dataSource],
  );

  const handleBreadcrumbClick = useCallback(
    (index: number) => {
      const target = breadcrumbTrail[index];
      setBreadcrumbTrail((prev) => prev.slice(0, index + 1));
      dataSource.applyFilter({
        mode: "children",
        datasetId: target.datasetId,
        parentConceptId: target.conceptId,
      });
      gridRef.current?.refresh();
    },
    [breadcrumbTrail, dataSource],
  );

  const handleBackToSearch = useCallback(() => {
    setBreadcrumbTrail([]);
    dataSource.applyFilter({
      mode: "search",
      datasetId: datasetId.trim(),
      conceptType: conceptType || undefined,
      query: queryText.trim() || undefined,
    });
    gridRef.current?.refresh();
  }, [dataSource, datasetId, conceptType, queryText]);

  const handleViewRoadmap = useCallback((concept: SkillReferenceConcept) => {
    setDetailConcept(null);
    setRoadmapTarget({ datasetId: concept.datasetId, conceptId: concept.conceptId });
  }, []);

  // Grid columns
  const columnDefs = useMemo<ColDef<SkillReferenceConcept>[]>(
    () => [
      {
        headerName: "유형",
        field: "conceptType",
        width: 120,
        cellRenderer: (params: ICellRendererParams<SkillReferenceConcept>) => (
          <Chip
            size="small"
            label={conceptTypeLabel(params.value)}
            color={conceptTypeColor(params.value)}
            variant="filled"
            sx={{ fontSize: 11, height: 22 }}
          />
        ),
      },
      {
        headerName: "이름",
        field: "preferredLabel",
        flex: 2,
        minWidth: 200,
        cellRenderer: (params: ICellRendererParams<SkillReferenceConcept>) =>
          params.data ? (
            <Button
              variant="text"
              size="small"
              onClick={() => setDetailConcept(params.data ?? null)}
              sx={{
                justifyContent: "flex-start",
                minWidth: 0,
                px: 0,
                maxWidth: "100%",
                textTransform: "none",
                fontWeight: 600,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              {params.value ?? "-"}
            </Button>
          ) : null,
      },
      {
        headerName: "외부 코드",
        field: "externalCode",
        width: 150,
        cellStyle: { fontFamily: "monospace", fontSize: 13 },
      },
      {
        headerName: "Level",
        field: "levelValue",
        width: 80,
      },
      {
        headerName: "분류 경로",
        field: "categoryPath",
        flex: 2,
        minWidth: 250,
      },
      {
        headerName: "",
        width: 50,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams<SkillReferenceConcept>) =>
          params.data ? (
            <Tooltip title="하위 Concept 조회">
              <IconButton size="small" onClick={() => handleBrowseChildren(params.data!)}>
                <ArrowForwardOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null,
      },
    ],
    [handleBrowseChildren],
  );

  return (
    <SkillGraphLayout>
      <Stack spacing={2}>
        <PageToolbar
          breadcrumbs={["서비스 관리", "AI", "SkillGraph", "NCS Reference 조회"]}
          title="NCS Reference Dataset 조회"
          label="임포트된 NCS 데이터셋의 Concept을 검색하고 계층을 탐색합니다."
          searchPlaceholder="Concept 이름 검색"
          searchValue={queryText}
          onSearchValueChange={setQueryText}
          onSearch={handleSearch}
          onRefresh={handleRefreshSearch}
          actions={
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="outlined"
                size="small"
                startIcon={<AutoAwesomeOutlined />}
                disabled={!datasetId.trim()}
                onClick={() => setEmbeddingOpen(true)}
                sx={{ textTransform: "none", whiteSpace: "nowrap" }}
              >
                임베딩 생성
              </Button>
              <FormControl size="small" sx={{ minWidth: 280 }}>
                <InputLabel>Dataset</InputLabel>
                <Select
                  value={datasetId}
                  label="Dataset"
                  disabled={isDatasetLoading}
                  onChange={(event) => setDatasetId(event.target.value)}
                >
                  {datasetOptions.length === 0 ? (
                    <MenuItem value="" disabled>
                      Dataset 없음
                    </MenuItem>
                  ) : null}
                  {datasetOptions.map((dataset) => (
                    <MenuItem key={dataset.datasetId} value={dataset.datasetId}>
                      {dataset.datasetName
                        ? `${dataset.datasetId} · ${dataset.datasetName}`
                        : dataset.datasetId}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Concept 유형</InputLabel>
                <Select
                  value={conceptType}
                  label="Concept 유형"
                  onChange={(e) => setConceptType(e.target.value)}
                >
                  {NCS_CONCEPT_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      {t.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          }
        />

        {/* ---- Breadcrumb trail ---- */}
        {breadcrumbTrail.length > 0 ? (
          <Paper variant="outlined" sx={{ px: 2, py: 1 }}>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexWrap: "wrap", gap: 0.5 }}>
              <Chip
                label="검색 결과"
                size="small"
                variant="outlined"
                onClick={handleBackToSearch}
                sx={{ cursor: "pointer" }}
              />
              {breadcrumbTrail.map((crumb, index) => (
                <Stack key={crumb.conceptId} direction="row" spacing={0.5} alignItems="center">
                  <Typography variant="body2" color="text.secondary">›</Typography>
                  <Chip
                    label={crumb.label}
                    size="small"
                    color={index === breadcrumbTrail.length - 1 ? "primary" : "default"}
                    variant={index === breadcrumbTrail.length - 1 ? "filled" : "outlined"}
                    onClick={index < breadcrumbTrail.length - 1 ? () => handleBreadcrumbClick(index) : undefined}
                    sx={{ cursor: index < breadcrumbTrail.length - 1 ? "pointer" : "default" }}
                  />
                </Stack>
              ))}
            </Stack>
          </Paper>
        ) : null}

        {!hasSearched ? (
          <EmptyState
            title="검색 조건을 입력하세요."
            description="Dataset을 선택하고 toolbar 검색을 실행하면 NCS Concept 목록이 표시됩니다."
          />
        ) : null}

        <PageableGridContent<SkillReferenceConcept>
          ref={gridRef}
          datasource={dataSource}
          columns={columnDefs}
          options={{
            getRowId: (params) => params.data.conceptId,
            tooltipShowDelay: 300,
            defaultColDef: {
              sortable: true,
              resizable: true,
              filter: false,
            },
          }}
        />
      </Stack>

      {/* ---- Detail Drawer ---- */}
      <ConceptDetailDrawer
        concept={detailConcept}
        open={detailConcept !== null}
        onClose={() => setDetailConcept(null)}
        onBrowseChildren={handleBrowseChildren}
        onViewRoadmap={handleViewRoadmap}
      />

      {/* ---- Roadmap Context Drawer ---- */}
      {roadmapTarget ? (
        <RoadmapContextDrawer
          open
          onClose={() => setRoadmapTarget(null)}
          datasetId={roadmapTarget.datasetId}
          conceptId={roadmapTarget.conceptId}
        />
      ) : null}

      <SkillReferenceEmbeddingDialog
        open={embeddingOpen}
        datasetId={datasetId}
        provider={datasetOptions.find((dataset) => dataset.datasetId === datasetId)?.provider}
        conceptType={conceptType || undefined}
        onClose={() => setEmbeddingOpen(false)}
      />
    </SkillGraphLayout>
  );
}
