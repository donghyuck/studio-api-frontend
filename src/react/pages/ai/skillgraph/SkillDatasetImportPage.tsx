import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AddOutlined,
  AutoAwesomeOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";

import { PageToolbar } from "@/react/components/page/PageToolbar";
import { GridContent } from "@/react/components/ag-grid";
import { useToast } from "@/react/feedback/ToastProvider";
import { skillGraphQueryKeys } from "@/react/pages/ai/skillgraph/queryKeys";
import {
  skillGraphApi,
  type SkillDatasetImportJob,
  type SkillDatasetImportJobStatus,
  type SkillDatasetImportRequest,
} from "@/react/pages/ai/skillgraph/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SkillGraphLayout,
  StatusBadge,
} from "@/react/pages/ai/skillgraph/components";
import { SkillReferenceEmbeddingDialog } from "@/react/pages/ai/skillgraph/SkillReferenceEmbeddingDialog";

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

function isTerminal(status?: SkillDatasetImportJobStatus) {
  return status === "COMPLETED" || status === "FAILED" || status === "CANCELLED";
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return value;
  }
}

/* ------------------------------------------------------------------ */
/*  Detail Dialog                                                      */
/* ------------------------------------------------------------------ */

function JobDetailDialog({
  job,
  open,
  onClose,
  onOpenEmbedding,
}: {
  job: SkillDatasetImportJob | null;
  open: boolean;
  onClose: () => void;
  onOpenEmbedding: (job: SkillDatasetImportJob) => void;
}) {
  if (!job) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>임포트 작업 상세</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <DetailRow label="Job ID" value={job.jobId} />
          <DetailRow label="Provider" value={job.provider} />
          <DetailRow label="Dataset ID" value={job.datasetId} />
          <DetailRow label="Dataset Name" value={job.datasetName ?? "-"} />
          <Box>
            <Typography variant="caption" color="text.secondary">
              Status
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <StatusBadge value={job.status} />
            </Box>
          </Box>
          <DetailRow label="Source Location" value={job.sourceLocation} mono />
          {job.errorMessage ? (
            <Alert severity="error" sx={{ mt: 1 }}>
              {job.errorMessage}
            </Alert>
          ) : null}
          <DetailRow label="생성일시" value={formatDateTime(job.createdAt)} />
          <DetailRow label="시작일시" value={formatDateTime(job.startedAt)} />
          <DetailRow label="완료일시" value={formatDateTime(job.completedAt)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          startIcon={<AutoAwesomeOutlined />}
          onClick={() => onOpenEmbedding(job)}
          disabled={job.status !== "COMPLETED"}
        >
          임베딩 생성
        </Button>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={mono ? { fontFamily: "monospace", wordBreak: "break-all" } : undefined}
      >
        {value}
      </Typography>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Dialog                                                      */
/* ------------------------------------------------------------------ */

const INITIAL_FORM: SkillDatasetImportRequest = {
  provider: "NCS",
  datasetId: "",
  datasetName: "",
  version: "",
  language: "ko",
  sourceLocation: "",
};

function CreateImportJobDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<SkillDatasetImportRequest>({ ...INITIAL_FORM });

  const mutation = useMutation({
    mutationFn: (data: SkillDatasetImportRequest) =>
      skillGraphApi.createDatasetImportJob(data),
    onSuccess: () => {
      toast.success("임포트 작업이 생성되었습니다.");
      setForm({ ...INITIAL_FORM });
      onCreated();
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || "임포트 작업 생성에 실패했습니다.");
    },
  });

  const handleChange = (field: keyof SkillDatasetImportRequest) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const canSubmit =
    form.provider.trim() !== "" &&
    form.datasetId.trim() !== "" &&
    form.sourceLocation.trim() !== "";

  const handleSubmit = () => {
    if (!canSubmit) return;
    mutation.mutate({
      ...form,
      datasetName: form.datasetName || undefined,
      version: form.version || undefined,
      language: form.language || undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: { sx: { borderRadius: 2 } },
      }}
    >
      <DialogTitle>NCS 데이터셋 임포트 작업 생성</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            label="Provider"
            size="small"
            required
            value={form.provider}
            onChange={handleChange("provider")}
            helperText="데이터 제공자 (예: NCS)"
            slotProps={{ htmlInput: { maxLength: 40 } }}
          />
          <TextField
            label="Dataset ID"
            size="small"
            required
            value={form.datasetId}
            onChange={handleChange("datasetId")}
            helperText="데이터셋 고유 식별자 (예: ncs-2024-v1)"
            slotProps={{ htmlInput: { maxLength: 100 } }}
          />
          <TextField
            label="Dataset Name"
            size="small"
            value={form.datasetName}
            onChange={handleChange("datasetName")}
            helperText="데이터셋 이름 (예: NCS 2024년 버전)"
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Version"
              size="small"
              value={form.version}
              onChange={handleChange("version")}
              helperText="버전 (예: 2024)"
              slotProps={{ htmlInput: { maxLength: 100 } }}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Language"
              size="small"
              value={form.language}
              onChange={handleChange("language")}
              helperText="언어 코드 (예: ko)"
              slotProps={{ htmlInput: { maxLength: 20 } }}
              sx={{ flex: 1 }}
            />
          </Stack>
          <TextField
            label="Source Location"
            size="small"
            required
            value={form.sourceLocation}
            onChange={handleChange("sourceLocation")}
            helperText="서버에 위치한 NCS Excel 파일 경로 (예: /data/ncs/NCS_2024.xlsx)"
            slotProps={{ htmlInput: { maxLength: 1000 } }}
            InputProps={{
              sx: { fontFamily: "monospace", fontSize: 14 },
            }}
          />
        </Stack>
        {mutation.isPending ? <LinearProgress sx={{ mt: 2 }} /> : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} disabled={mutation.isPending}>
          취소
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!canSubmit || mutation.isPending}
        >
          생성
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export function SkillDatasetImportPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailJob, setDetailJob] = useState<SkillDatasetImportJob | null>(null);
  const [embeddingJob, setEmbeddingJob] = useState<SkillDatasetImportJob | null>(null);

  const {
    data: jobs,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: skillGraphQueryKeys.custom("dataset-import-jobs"),
    queryFn: () => skillGraphApi.listDatasetImportJobs(50),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (Array.isArray(data) && data.some((j) => !isTerminal(j.status))) {
        return 5_000;
      }
      return false;
    },
  });

  const handleCreated = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: skillGraphQueryKeys.custom("dataset-import-jobs"),
    });
  }, [queryClient]);

  const columnDefs = useMemo<ColDef<SkillDatasetImportJob>[]>(
    () => [
      {
        headerName: "",
        field: "jobId",
        width: 56,
        sortable: false,
        filter: false,
        cellRenderer: (params: ICellRendererParams<SkillDatasetImportJob>) => (
          <Tooltip title="상세 보기">
            <IconButton
              size="small"
              onClick={() => setDetailJob(params.data ?? null)}
            >
              <VisibilityOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
      },
      {
        headerName: "Job ID",
        field: "jobId",
        flex: 1,
        minWidth: 140,
        cellStyle: { fontFamily: "monospace", fontSize: 13 },
      },
      { headerName: "Provider", field: "provider", width: 100 },
      { headerName: "Dataset ID", field: "datasetId", flex: 1, minWidth: 150 },
      { headerName: "Dataset Name", field: "datasetName", flex: 1, minWidth: 150 },
      {
        headerName: "Status",
        field: "status",
        width: 130,
        cellRenderer: (params: ICellRendererParams<SkillDatasetImportJob>) => (
          <StatusBadge value={params.value} />
        ),
      },
      {
        headerName: "Source Location",
        field: "sourceLocation",
        flex: 1.5,
        minWidth: 200,
        cellStyle: { fontFamily: "monospace", fontSize: 13 },
      },
      {
        headerName: "생성일시",
        field: "createdAt",
        width: 170,
        valueFormatter: (params) => formatDateTime(params.value),
      },
      {
        headerName: "시작일시",
        field: "startedAt",
        width: 170,
        valueFormatter: (params) => formatDateTime(params.value),
      },
      {
        headerName: "완료일시",
        field: "completedAt",
        width: 170,
        valueFormatter: (params) => formatDateTime(params.value),
      },
      {
        headerName: "오류",
        field: "errorMessage",
        flex: 1,
        minWidth: 150,
        cellStyle: { color: "#d32f2f" },
      },
    ],
    [],
  );

  return (
    <SkillGraphLayout>
      <Stack spacing={2}>
        <PageToolbar
          breadcrumbs={["서비스 관리", "AI", "SkillGraph", "NCS 데이터셋 임포트"]}
          title="NCS 데이터셋 임포트"
          label="NCS 기반 스킬 데이터셋을 서버에서 임포트합니다."
          onRefresh={() => refetch()}
          actions={
            <>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddOutlined />}
                onClick={() => setCreateOpen(true)}
                sx={{ textTransform: "none" }}
              >
                임포트 작업 생성
              </Button>
            </>
          }
        />

        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState error={error} />
        ) : !jobs || jobs.length === 0 ? (
          <EmptyState
            title="임포트 작업이 없습니다."
            description="'임포트 작업 생성' 버튼을 클릭하여 NCS 데이터셋 임포트를 시작하세요."
          />
        ) : (
          <Box sx={{ height: 520 }}>
            <GridContent<SkillDatasetImportJob>
              rowData={jobs}
              columns={columnDefs}
              options={{
                getRowId: (params) => params.data.jobId,
                defaultColDef: {
                  sortable: true,
                  resizable: true,
                  filter: true,
                },
              }}
            />
          </Box>
        )}
      </Stack>

      <CreateImportJobDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />

      <JobDetailDialog
        job={detailJob}
        open={detailJob !== null}
        onClose={() => setDetailJob(null)}
        onOpenEmbedding={(job) => {
          setEmbeddingJob(job);
          setDetailJob(null);
        }}
      />

      <SkillReferenceEmbeddingDialog
        open={embeddingJob !== null}
        datasetId={embeddingJob?.datasetId}
        provider={embeddingJob?.provider}
        onClose={() => setEmbeddingJob(null)}
      />
    </SkillGraphLayout>
  );
}
