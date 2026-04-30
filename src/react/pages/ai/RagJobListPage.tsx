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
  IconButton,
  MenuItem,
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
  HourglassEmptyOutlined,
  HubOutlined,
  WarningAmberOutlined,
} from "@mui/icons-material";
import type { ColDef, GridOptions, ICellRendererParams } from "ag-grid-community";
import { GridContent } from "@/react/components/ag-grid";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { RagChunkSimulationDialog } from "@/react/pages/ai/RagChunkSimulationDialog";
import { RagSearchValidationPanel } from "@/react/pages/ai/RagSearchValidationPanel";
import { reactAiApi } from "@/react/pages/ai/api";
import { reactObjectTypeApi } from "@/react/pages/objecttype/api";
import type { RagIndexJobDto, RagIndexJobStatus } from "@/types/studio/ai";
import type { ObjectTypeDto } from "@/types/studio/objecttype";
import { resolveAxiosError } from "@/utils/helpers";

type RagJobStatusFilter = RagIndexJobStatus | "";
type SourceMode = "attachment" | "text";
type RagIndexJobRow = RagIndexJobDto & { __selected?: boolean };
type ObjectTypeOption = {
  value: string;
  label: string;
  code: string;
  name: string;
};

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
  const [status, setStatus] = useState<RagJobStatusFilter>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [chunkSimulationOpen, setChunkSimulationOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<RagIndexJobDto | null>(null);
  const [objectTypes, setObjectTypes] = useState<ObjectTypeDto[]>([]);
  const [sourceMode, setSourceMode] = useState<SourceMode>("attachment");
  const [objectType, setObjectType] = useState("");
  const [objectId, setObjectId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [indexText, setIndexText] = useState("");
  const [forceReindex, setForceReindex] = useState(false);
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

  const displayedJobs = useMemo<RagIndexJobRow[]>(
    () => filteredJobs.map((job) => ({ ...job, __selected: job.jobId === selectedJob?.jobId })),
    [filteredJobs, selectedJob?.jobId]
  );

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await reactAiApi.listRagJobs({
        status,
        offset: 0,
        limit: 100,
        sort: "createdAt",
        direction: "desc",
      });
      setJobs(response.items ?? []);
      setTotal(response.total ?? 0);
    } catch (loadError) {
      setError(resolveAxiosError(loadError));
    } finally {
      setLoading(false);
    }
  }, [status]);

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
    if (selectedJob && !jobs.some((job) => job.jobId === selectedJob.jobId)) {
      setCurrentSelectedJob(null);
    }
  }, [jobs, selectedJob, setCurrentSelectedJob]);

  const openDetail = useCallback((jobId: string) => {
    navigate(`/services/ai/rag/jobs/${encodeURIComponent(jobId)}`);
  }, [navigate]);

  const gridOptions = useMemo<GridOptions<RagIndexJobRow>>(
    () => ({
      getRowId: (params) => params.data.jobId,
      rowClassRules: {
        "rag-job-row-selected": (params) => Boolean(params.data?.__selected),
      },
    }),
    []
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

  const columns = useMemo<ColDef<RagIndexJobRow>[]>(
    () => [
      {
        field: "status",
        headerName: "상태",
        width: 132,
        filter: false,
        cellRenderer: (params: { value?: RagIndexJobStatus }) => (
          <Chip
            size="small"
            color={statusColor(params.value)}
            icon={statusIcon(params.value)}
            label={params.value ?? "-"}
            sx={{
              fontWeight: params.value === "FAILED" ? 700 : 500,
              "& .MuiChip-icon": { ml: 0.75 },
            }}
          />
        ),
      },
      {
        colId: "sourceName",
        headerName: "문서/파일명",
        flex: 1.2,
        minWidth: 280,
        filter: false,
        valueGetter: (params) => (params.data ? sourceDisplayName(params.data) : "-"),
        cellRenderer: (params: ICellRendererParams<RagIndexJobRow>) => {
          const row = params.data;
          if (!row) {
            return "-";
          }
          return (
            <Box
              component="button"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openDetail(row.jobId);
              }}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                border: 0,
                p: 0,
                maxWidth: "100%",
                bgcolor: "transparent",
                color: "primary.main",
                cursor: "pointer",
                font: "inherit",
                textAlign: "left",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              <Typography variant="body2" noWrap>
                {sourceDisplayName(row)}
              </Typography>
            </Box>
          );
        },
      },
      { field: "objectType", headerName: "객체 유형", width: 120, filter: false },
      { field: "objectId", headerName: "객체 ID", width: 110, filter: false },
      { field: "sourceType", headerName: "소스", width: 110, filter: false },
      { field: "currentStep", headerName: "단계", width: 130, filter: false },
      { field: "chunkCount", headerName: "Chunk", width: 90, filter: false, type: "numericColumn" },
      { field: "warningCount", headerName: "경고", width: 90, filter: false, type: "numericColumn" },
      {
        field: "createdAt",
        headerName: "생성일시",
        width: 190,
        filter: false,
        valueFormatter: (params) => formatDateTime(params.value as string | undefined),
      },
      {
        field: "durationMs",
        headerName: "소요",
        width: 100,
        filter: false,
        valueFormatter: (params) =>
          typeof params.value === "number" ? `${params.value.toLocaleString()}ms` : "-",
      },
      {
        field: "errorMessage",
        headerName: "오류",
        flex: 0.8,
        minWidth: 180,
        filter: false,
        tooltipField: "errorMessage",
      },
      {
        colId: "actions",
        headerName: "",
        filter: false,
        sortable: false,
        width: 64,
        cellRenderer: (params: ICellRendererParams<RagIndexJobRow>) => (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
            <Tooltip title="상세보기">
              <IconButton
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  if (params.data) {
                    openDetail(params.data.jobId);
                  }
                }}
              >
                <ChevronRight fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [openDetail]
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
          <>
            <Tooltip title="청킹 시뮬레이션을 실행합니다. 색인 전 텍스트가 어떤 Chunk로 나뉘는지 확인합니다.">
              <IconButton
                size="small"
                color="primary"
                aria-label="청킹 시뮬레이션"
                onClick={() => setChunkSimulationOpen(true)}
              >
                <HubOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
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
          </>
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

      <Box>
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
          <GridContent<RagIndexJobRow>
            columns={columns}
            options={gridOptions}
            rowSelection={{
              mode: "singleRow",
              checkboxes: false,
              enableClickSelection: false,
            }}
            rowData={displayedJobs}
            loading={loading}
            height={560}
            onRowSelected={(event) => {
              const row = (event as { data?: RagIndexJobRow; node?: { isSelected?: () => boolean } }).data;
              const selected = (event as { node?: { isSelected?: () => boolean } }).node?.isSelected?.();
              if (!row) {
                return;
              }
              if (selected) {
                setCurrentSelectedJob(row);
              } else if (selectedJobIdRef.current === row.jobId) {
                setCurrentSelectedJob(null);
              }
            }}
            events={[
              {
                type: "rowClicked",
                listener: (event) => {
	                  const typedEvent = event as {
	                    data?: RagIndexJobRow;
	                    node?: { setSelected?: (selected: boolean) => void };
	                  };
	                  const row = typedEvent.data;
	                  if (row) {
	                    const nextSelected = selectedJobIdRef.current !== row.jobId;
	                    typedEvent.node?.setSelected?.(nextSelected);
	                    setCurrentSelectedJob(nextSelected ? row : null);
	                  }
	                },
              },
              {
                type: "rowDoubleClicked",
                listener: (event) => {
                  const row = (event as { data?: RagIndexJobRow }).data;
                  if (row) {
                    openDetail(row.jobId);
                  }
                },
              },
            ]}
          />
        </Box>
      </Box>

      <RagSearchValidationPanel job={selectedJob} />

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>새 색인 작업</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <Alert severity="info">
              색인 작업은 생성 즉시 비동기로 실행됩니다. 생성 후 상세 화면에서 진행 상태, 로그, Chunk를 확인합니다.
            </Alert>
            <TextField
              select
              label="색인 소스"
              value={sourceMode}
              onChange={(event) => setSourceMode(event.target.value as SourceMode)}
              size="small"
              fullWidth
            >
              <MenuItem value="attachment">Attachment 파일</MenuItem>
              <MenuItem value="text">직접 입력 텍스트</MenuItem>
            </TextField>
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
      <RagChunkSimulationDialog
        open={chunkSimulationOpen}
        onClose={() => setChunkSimulationOpen(false)}
      />
    </Stack>
  );
}
