import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  alpha,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  Divider,
  Card,
  CardContent,
  IconButton,
  MenuItem,
  Pagination,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AddOutlined,
  CancelOutlined,
  CheckCircleOutline,
  ChevronRight,
  ErrorOutline,
  History,
  HourglassEmptyOutlined,
  WarningAmberOutlined,
} from "@mui/icons-material";
import type { ColDef, GridOptions, ICellRendererParams } from "ag-grid-community";
import { GridContent } from "@/react/components/ag-grid";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { RagSearchValidationPanel } from "@/react/pages/ai/RagSearchValidationPanel";
import { reactAiApi } from "@/react/pages/ai/api";
import { reactObjectTypeApi } from "@/react/pages/objecttype/api";
import type { RagIndexJobDto, RagIndexJobStatus } from "@/types/studio/ai";
import type { ObjectTypeDto } from "@/types/studio/objecttype";
import { resolveAxiosError } from "@/utils/helpers";
import { toast } from "@/react/feedback";

export interface RagObjectGroup {
  objectType: string;
  objectId: string;
  documentId?: string;
  latestJob: RagIndexJobDto;
  count: number;
}

type RagJobStatusFilter = RagIndexJobStatus | "";
type SourceMode = "attachment" | "text";
type RagIndexJobRow = RagIndexJobDto & { __selected?: boolean };
type ObjectTypeOption = {
  value: string;
  label: string;
  code: string;
  name: string;
};

const RAG_JOB_PAGE_SIZE_OPTIONS = [25, 50, 100];

function statusColor(status?: RagIndexJobStatus) {
  if (status === "SUCCEEDED") return "success";
  if (status === "WARNING") return "warning";
  if (status === "FAILED" || status === "CANCELLED") return "error";
  if (status === "RUNNING" || status === "PENDING") return "info";
  return "default";
}

function statusIcon(status?: RagIndexJobStatus) {
  if (status === "SUCCEEDED") return <CheckCircleOutline fontSize="small" />;
  if (status === "WARNING") return <WarningAmberOutlined fontSize="small" />;
  if (status === "FAILED") return <ErrorOutline fontSize="small" />;
  if (status === "CANCELLED") return <CancelOutlined fontSize="small" />;
  if (status === "RUNNING" || status === "PENDING") return <HourglassEmptyOutlined fontSize="small" />;
  return undefined;
}

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function sourceDisplayName(job: RagIndexJobDto) {
  return job.sourceName || job.documentId || `${job.objectType} #${job.objectId}` || job.jobId;
}

export function RagJobListPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<RagIndexJobDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [status, setStatus] = useState<RagJobStatusFilter>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<RagIndexJobDto | null>(null);
  const [objectTypes, setObjectTypes] = useState<ObjectTypeDto[]>([]);
  const [sourceMode, setSourceMode] = useState<SourceMode>("attachment");
  const [objectType, setObjectType] = useState("");
  const [objectId, setObjectId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [indexText, setIndexText] = useState("");
  const [forceReindex, setForceReindex] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<RagObjectGroup | null>(null);
  const [historyJobs, setHistoryJobs] = useState<RagIndexJobDto[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const selectedJobIdRef = useRef<string | null>(null);

  const objectTypeOptions = useMemo<ObjectTypeOption[]>(
    () =>
      objectTypes.map((item) => ({
        value: String(item.objectType),
        label: `${item.code} #${item.objectType}`,
        code: item.code,
        name: item.name,
      })),
    [objectTypes]
  );

  const selectedObjectType = objectTypeOptions.find((item) => item.value === objectType) ?? null;

  const setCurrentSelectedJob = useCallback((job: RagIndexJobDto | null) => {
    selectedJobIdRef.current = job?.jobId ?? null;
    setSelectedJob(job);
  }, []);

  const filteredJobs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return jobs;
    }
    return jobs.filter((job) =>
      [
        sourceDisplayName(job),
        job.jobId,
        job.objectType,
        job.objectId,
        job.documentId,
        job.sourceType,
        job.status,
        job.currentStep,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [jobs, search]);

  const groupedJobs = useMemo<RagObjectGroup[]>(() => {
    const groupsMap = new Map<string, RagObjectGroup>();
    for (const job of filteredJobs) {
      const key = `${job.objectType}:${job.objectId}`;
      const existing = groupsMap.get(key);
      if (!existing) {
        groupsMap.set(key, {
          objectType: job.objectType,
          objectId: job.objectId,
          documentId: job.documentId,
          latestJob: job,
          count: 1,
        });
      } else {
        existing.count += 1;
        if (new Date(job.createdAt || 0) > new Date(existing.latestJob.createdAt || 0)) {
          existing.latestJob = job;
        }
      }
    }
    return Array.from(groupsMap.values());
  }, [filteredJobs]);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await reactAiApi.listRagJobs({
        status,
        page,
        size: pageSize,
        sort: "createdAt",
        direction: "desc",
      });
      const items = response.content ?? [];
      setJobs(items);
      setTotal(response.totalElements ?? 0);
    } catch (loadError) {
      setError(resolveAxiosError(loadError));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status]);

  const loadHistory = useCallback(async (group: RagObjectGroup | null) => {
    if (!group) {
      setHistoryJobs([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const response = await reactAiApi.listRagJobs({
        objectType: group.objectType,
        objectId: group.objectId,
        size: 50,
        sort: "createdAt",
        direction: "desc",
      });
      setHistoryJobs(response.content ?? []);
    } catch (err) {
      toast.error("작업 이력을 가져오는데 실패했습니다: " + resolveAxiosError(err));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadObjectTypes = useCallback(async () => {
    try {
      const response = await reactObjectTypeApi.list({ status: "ACTIVE" });
      setObjectTypes(response);
    } catch {
      setObjectTypes([]);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    void loadObjectTypes();
  }, [loadObjectTypes]);

  useEffect(() => {
    setPage(0);
  }, [status]);

  useEffect(() => {
    void loadHistory(selectedGroup);
  }, [selectedGroup, loadHistory]);

  const openDetail = useCallback((jobId: string) => {
    navigate(`/services/ai/rag/jobs/${encodeURIComponent(jobId)}`);
  }, [navigate]);

  const groupGridOptions = useMemo<GridOptions<RagObjectGroup>>(
    () => ({
      getRowId: (params) => `${params.data.objectType}:${params.data.objectId}`,
      rowClassRules: {
        "rag-job-row-selected": (params) =>
          Boolean(
            params.data &&
              selectedGroup?.objectType === params.data.objectType &&
              selectedGroup?.objectId === params.data.objectId
          ),
      },
    }),
    [selectedGroup]
  );

  function resetCreateForm() {
    setSourceMode("attachment");
    setObjectType("");
    setObjectId("");
    setDocumentId("");
    setIndexText("");
    setForceReindex(false);
  }

  async function handleCreateJob() {
    if (!objectType.trim() || !objectId.trim()) {
      setError("객체 유형과 객체 ID를 입력하세요.");
      return;
    }
    if (sourceMode === "text" && !indexText.trim()) {
      setError("텍스트 색인은 색인할 텍스트가 필요합니다.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const job = await reactAiApi.createRagJob({
        objectType: objectType.trim(),
        objectId: objectId.trim(),
        documentId: documentId.trim() || undefined,
        sourceType: sourceMode === "attachment" ? "attachment" : undefined,
        text: sourceMode === "text" ? indexText.trim() : undefined,
        forceReindex,
      });
      setCreateOpen(false);
      resetCreateForm();
      await loadJobs();
      openDetail(job.jobId);
    } catch (createError) {
      setError(resolveAxiosError(createError));
    } finally {
      setCreating(false);
    }
  }

  const groupColumns = useMemo<ColDef<RagObjectGroup>[]>(
    () => [
      { field: "objectType", headerName: "객체 유형", width: 120, filter: false },
      { field: "objectId", headerName: "객체 ID", width: 110, filter: false },
      {
        colId: "documentName",
        headerName: "문서 / 파일명",
        flex: 1.2,
        minWidth: 260,
        filter: false,
        valueGetter: (params) => (params.data ? sourceDisplayName(params.data.latestJob) : "-"),
        cellRenderer: (params: ICellRendererParams<RagObjectGroup>) => {
          const group = params.data;
          if (!group) {
            return "-";
          }
          return (
            <Typography variant="body2" noWrap sx={{ display: "inline-flex", alignItems: "center", maxWidth: "100%" }}>
              {sourceDisplayName(group.latestJob)}
            </Typography>
          );
        },
      },
      {
        field: "latestJob.status",
        headerName: "마지막 JOB 상태",
        width: 140,
        filter: false,
        cellRenderer: (params: ICellRendererParams<RagObjectGroup>) => {
          const val = params.data?.latestJob.status;
          return (
            <Chip
              size="small"
              color={statusColor(val)}
              icon={statusIcon(val)}
              label={val ?? "-"}
              sx={{
                fontWeight: val === "FAILED" ? 700 : 500,
                "& .MuiChip-icon": { ml: 0.75 },
              }}
            />
          );
        },
      },
      {
        field: "latestJob.createdAt",
        headerName: "마지막 JOB 일시",
        width: 195,
        filter: false,
        valueFormatter: (params) => formatDateTime(params.value as string | undefined),
      },
      {
        field: "count",
        headerName: "전체 Job 수",
        width: 110,
        filter: false,
        type: "numericColumn",
      },
    ],
    [statusColor]
  );


  return (
    <Stack spacing={0.5}>
      <PageToolbar
        divider={false}
        breadcrumbs={["서비스 관리", "AI", "RAG"]}
        label="색인 작업을 조회하고 문서 단위로 상세 진단을 확인합니다."
        searchPlaceholder="문서명, jobId, 객체 ID"
        searchValue={search}
        onSearchValueChange={setSearch}
        onSearch={setSearch}
        onRefresh={() => void loadJobs()}
        actions={
          <Tooltip title="새 색인 작업을 생성합니다. 생성 후 상세 화면으로 이동합니다.">
            <IconButton
              size="small"
              color="primary"
              aria-label="새 색인 작업"
              onClick={() => setCreateOpen(true)}
            >
              <AddOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
        <Typography variant="caption" color="text.secondary">
          상태
        </Typography>
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value as RagJobStatusFilter)}
          size="small"
          displayEmpty
          renderValue={(selected) => (selected ? String(selected) : "전체")}
          sx={{ minWidth: 140, height: 32, "& .MuiSelect-select": { py: 0.5, fontSize: 13 } }}
        >
          <MenuItem value="">전체</MenuItem>
          {(["PENDING", "RUNNING", "SUCCEEDED", "WARNING", "FAILED", "CANCELLED"] as RagIndexJobStatus[]).map(
            (item) => (
              <MenuItem key={item} value={item}>
                {item}
              </MenuItem>
            )
          )}
        </Select>
        <Typography variant="caption" color="text.secondary">
          표시 {filteredJobs.length.toLocaleString()}건 / 전체 {total.toLocaleString()}건
        </Typography>
      </Stack>

      <Grid container spacing={2}>
        {/* Left Column: Grouped Master Table */}
        <Grid size={{ xs: 12, md: 7.5 }}>
          <Box
            sx={{
              "& .ag-row.rag-job-row-selected": {
                bgcolor: (theme) =>
                  theme.palette.mode === "dark"
                    ? alpha(theme.palette.primary.main, 0.26)
                    : alpha(theme.palette.primary.main, 0.14),
                boxShadow: (theme) => `inset 4px 0 0 ${theme.palette.primary.main}`,
              },
              "& .ag-row.rag-job-row-selected:hover": {
                bgcolor: (theme) =>
                  theme.palette.mode === "dark"
                    ? alpha(theme.palette.primary.main, 0.34)
                    : alpha(theme.palette.primary.main, 0.2),
              },
              "& .ag-row.rag-job-row-selected .ag-cell": {
                bgcolor: (theme) =>
                  theme.palette.mode === "dark"
                    ? `${alpha(theme.palette.primary.main, 0.26)} !important`
                    : `${alpha(theme.palette.primary.main, 0.14)} !important`,
                fontWeight: 600,
              },
              "& .ag-row.ag-row-selected .ag-cell": {
                bgcolor: (theme) =>
                  theme.palette.mode === "dark"
                    ? `${alpha(theme.palette.primary.main, 0.26)} !important`
                    : `${alpha(theme.palette.primary.main, 0.14)} !important`,
                fontWeight: 600,
              },
              "& .ag-row.rag-job-row-selected:hover .ag-cell": {
                bgcolor: (theme) =>
                  theme.palette.mode === "dark"
                    ? `${alpha(theme.palette.primary.main, 0.34)} !important`
                    : `${alpha(theme.palette.primary.main, 0.2)} !important`,
              },
              "& .ag-row.ag-row-selected:hover .ag-cell": {
                bgcolor: (theme) =>
                  theme.palette.mode === "dark"
                    ? `${alpha(theme.palette.primary.main, 0.34)} !important`
                    : `${alpha(theme.palette.primary.main, 0.2)} !important`,
              },
              "& .ag-row.rag-job-row-selected .ag-cell:first-of-type": {
                boxShadow: (theme) => `inset 4px 0 0 ${theme.palette.primary.main}`,
              },
              "& .ag-row.ag-row-selected .ag-cell:first-of-type": {
                boxShadow: (theme) => `inset 4px 0 0 ${theme.palette.primary.main}`,
              },
            }}
          >
            <GridContent<RagObjectGroup>
              columns={groupColumns}
              options={groupGridOptions}
              rowSelection={{
                mode: "singleRow",
                checkboxes: false,
                enableClickSelection: false,
              }}
              rowData={groupedJobs}
              loading={loading}
              height={604}
              onRowClicked={(event) => {
                const typedEvent = event as {
                  data?: RagObjectGroup;
                  node?: { isSelected?: () => boolean; setSelected?: (selected: boolean) => void };
                };
                const row = typedEvent.data;
                if (!row) return;

                const isCurrentlySelected = typedEvent.node?.isSelected?.();
                typedEvent.node?.setSelected?.(!isCurrentlySelected);

                setSelectedGroup(row);
              }}
            />
          </Box>
        </Grid>

        {/* Right Column: Execution History runs */}
        <Grid size={{ xs: 12, md: 4.5 }}>
          <Card variant="outlined" sx={{ height: 604, display: "flex", flexDirection: "column" }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider", bgcolor: "action.hover", display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  세부 작업 이력 (Runs)
                </Typography>
                {selectedGroup && historyJobs.length > 0 && (
                  <Chip
                    label={`${historyJobs.length}건`}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ height: 18, fontSize: 10, fontWeight: 600 }}
                  />
                )}
              </Stack>
              {selectedGroup ? (
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                  {selectedGroup.objectType} #{selectedGroup.objectId} ({sourceDisplayName(selectedGroup.latestJob)})
                </Typography>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  왼쪽 목록에서 객체를 선택하십시오.
                </Typography>
              )}
            </Box>
            <CardContent sx={{ p: 0, flex: 1, overflowY: "auto" }}>
              {historyLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", p: 4 }}>
                  <CircularProgress size={32} />
                </Box>
              ) : selectedGroup ? (
                historyJobs.length > 0 ? (
                  <Stack divider={<Divider />} spacing={0}>
                    {historyJobs.map((job) => {
                      const isSelected = selectedJob?.jobId === job.jobId;
                      return (
                        <Box
                          key={job.jobId}
                          onClick={() => setCurrentSelectedJob(job)}
                          sx={{
                            p: 2,
                            cursor: "pointer",
                            bgcolor: isSelected
                              ? (theme) =>
                                  alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.12 : 0.06)
                              : "transparent",
                            borderLeft: 4,
                            borderLeftColor: isSelected ? "primary.main" : "transparent",
                            "&:hover": {
                              bgcolor: (theme) =>
                                isSelected
                                  ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.2 : 0.1)
                                  : theme.palette.action.hover,
                            },
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                            <Chip
                              size="small"
                              label={job.status}
                              color={statusColor(job.status)}
                              icon={statusIcon(job.status)}
                              sx={{ height: 20, "& .MuiChip-label": { px: 1, fontSize: 11 } }}
                            />
                            <Typography variant="caption" color={isSelected ? "text.primary" : "text.secondary"}>
                              {formatDateTime(job.createdAt)}
                            </Typography>
                          </Stack>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            spacing={1}
                            sx={{ mt: 1 }}
                          >
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="body2" color={isSelected ? "text.primary" : "text.secondary"} sx={{ fontWeight: isSelected ? 600 : 400 }} noWrap>
                                단계: {job.currentStep ?? "-"} | Chunk: {job.chunkCount ?? 0}
                              </Typography>
                              <Typography variant="caption" color={isSelected ? "text.secondary" : "text.disabled"} display="block" noWrap>
                                ID: {job.jobId}
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetail(job.jobId);
                              }}
                              sx={{ py: 0.25, minWidth: "auto", px: 1, fontSize: 11 }}
                            >
                              상세
                            </Button>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                ) : (
                  <Box sx={{ p: 4, textAlign: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                      작업 이력이 존재하지 않습니다.
                    </Typography>
                  </Box>
                )
              ) : (
                <Box
                  sx={{
                    p: 4,
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                    color: "text.disabled",
                    gap: 1.5,
                  }}
                >
                  <History sx={{ fontSize: 40, color: "action.disabled" }} />
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    그룹을 선택하면 여기에 실행 이력이 나타납니다.
                  </Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ maxWidth: "80%" }}>
                    왼쪽의 마스터 목록에서 특정 객체 유형 및 ID 행을 클릭하면 전체 실행 히스토리가 시간 순으로 상세히 조회됩니다.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>


      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" color="text.secondary">
            페이지 크기
          </Typography>
          <Select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(0);
            }}
            size="small"
            sx={{ width: 92, height: 32, "& .MuiSelect-select": { py: 0.5, fontSize: 13 } }}
          >
            {RAG_JOB_PAGE_SIZE_OPTIONS.map((size) => (
              <MenuItem key={size} value={size}>
                {size}
              </MenuItem>
            ))}
          </Select>
          <Typography variant="caption" color="text.secondary">
            {total > 0
              ? `${(page * pageSize + 1).toLocaleString()}-${Math.min(
                  (page + 1) * pageSize,
                  total
                ).toLocaleString()} / ${total.toLocaleString()}`
              : "0 / 0"}
          </Typography>
        </Stack>
        <Pagination
          page={page + 1}
          count={Math.max(1, Math.ceil(total / pageSize))}
          onChange={(_, nextPage) => setPage(nextPage - 1)}
          size="small"
          color="primary"
          showFirstButton
          showLastButton
          disabled={loading}
        />
      </Stack>

      <RagSearchValidationPanel job={selectedJob} />

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>새 색인 작업</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <Alert severity="info">
              색인 작업은 생성 즉시 비동기로 실행됩니다. 생성 후 상세 화면에서 진행 상태, 로그, Chunk를 확인합니다.
            </Alert>
            <FormControlLabel
              control={
                <Switch
                  checked={sourceMode === "text"}
                  onChange={(event) => setSourceMode(event.target.checked ? "text" : "attachment")}
                />
              }
              label={
                <Box>
                  <Typography variant="body2">직접 입력 텍스트 사용</Typography>
                  <Typography variant="caption" color="text.secondary">
                    끄면 Attachment 파일 기준으로 색인 작업을 생성합니다.
                  </Typography>
                </Box>
              }
              sx={{ alignItems: "flex-start", m: 0 }}
            />
            <Autocomplete
              options={objectTypeOptions}
              value={selectedObjectType}
              onChange={(_, value) => setObjectType(value?.value ?? "")}
              getOptionLabel={(option) => option.label}
              renderOption={(props, option) => (
                <li {...props} key={option.value}>
                  <Stack spacing={0}>
                    <Typography variant="body2">{option.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.name}
                    </Typography>
                  </Stack>
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} label="객체 유형" size="small" placeholder="객체 유형 선택" />
              )}
            />
            <TextField
              label={sourceMode === "attachment" ? "객체 ID / Attachment ID" : "객체 ID"}
              value={objectId}
              onChange={(event) => setObjectId(event.target.value)}
              size="small"
              fullWidth
              helperText={
                sourceMode === "attachment"
                  ? "비워둔 documentId 대신 이 값을 attachmentId로 사용합니다."
                  : "직접 입력 텍스트를 연결할 객체 ID입니다."
              }
            />
            <TextField
              label="Document ID"
              value={documentId}
              onChange={(event) => setDocumentId(event.target.value)}
              size="small"
              fullWidth
              helperText="선택 사항입니다. 비워두면 서버가 객체 ID를 기준으로 설정합니다."
            />
            {sourceMode === "text" ? (
              <TextField
                label="색인할 텍스트"
                value={indexText}
                onChange={(event) => setIndexText(event.target.value)}
                size="small"
                fullWidth
                multiline
                minRows={6}
              />
            ) : null}
            <FormControlLabel
              control={
                <Switch
                  checked={forceReindex}
                  onChange={(event) => setForceReindex(event.target.checked)}
                />
              }
              label="강제 재색인"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>취소</Button>
          <Button
            variant="contained"
            onClick={() => void handleCreateJob()}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {creating ? "생성 중" : "생성"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
