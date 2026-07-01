import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AutoAwesomeOutlined } from "@mui/icons-material";

import { useConfirm, useToast } from "@/react/feedback";
import {
  skillGraphApi,
  type SkillReferenceEmbeddingRequest,
  type SkillReferenceEmbeddingResult,
} from "@/react/pages/ai/skillgraph/api";
import { resolveAxiosError } from "@/utils/helpers";

const DEFAULT_FORM: SkillReferenceEmbeddingRequest = {
  datasetId: "",
  provider: "NCS",
  conceptType: "NCS_COMPETENCY_UNIT",
  embeddingProvider: "kure",
  embeddingModel: "nlpai-lab/KURE-v1",
  embeddingDim: 1024,
  textType: "search_text",
  textBuildStrategy: "LABEL_DESCRIPTION_CATEGORY_RAW_KEYWORDS",
  batchSize: 20,
  overwrite: false,
  normalize: true,
};

const CONCEPT_TYPE_OPTIONS = [
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

interface SkillReferenceEmbeddingDialogProps {
  open: boolean;
  datasetId?: string;
  provider?: string;
  conceptType?: string;
  onClose: () => void;
  onCompleted?: (result: SkillReferenceEmbeddingResult) => void;
}

export function SkillReferenceEmbeddingDialog({
  open,
  datasetId,
  provider,
  conceptType,
  onClose,
  onCompleted,
}: SkillReferenceEmbeddingDialogProps) {
  const confirm = useConfirm();
  const toast = useToast();
  const [form, setForm] = useState<SkillReferenceEmbeddingRequest>(() => ({
    ...DEFAULT_FORM,
    datasetId: datasetId ?? "",
    provider: provider ?? DEFAULT_FORM.provider,
    conceptType: conceptType ?? DEFAULT_FORM.conceptType,
  }));

  useEffect(() => {
    if (!open) return;
    setForm((prev) => ({
      ...prev,
      datasetId: datasetId ?? prev.datasetId,
      provider: provider ?? prev.provider,
      conceptType: conceptType ?? prev.conceptType,
    }));
  }, [conceptType, datasetId, open, provider]);

  const mutation = useMutation({
    mutationFn: (data: SkillReferenceEmbeddingRequest) => skillGraphApi.vectorizeReferenceEmbeddings(data),
    onSuccess: (result) => {
      toast.success(`임베딩 생성 완료: ${result.embeddedCount}건 생성, ${result.skippedCount}건 건너뜀`);
      onCompleted?.(result);
    },
    onError: (error: Error) => {
      toast.error(resolveAxiosError(error) || "임베딩 생성에 실패했습니다.");
    },
  });

  const canSubmit = useMemo(
    () =>
      form.datasetId.trim() !== "" &&
      form.embeddingProvider.trim() !== "" &&
      form.embeddingModel.trim() !== "" &&
      form.embeddingDim > 0 &&
      form.batchSize > 0 &&
      form.batchSize <= 100 &&
      form.textType.trim() !== "",
    [form],
  );

  const update = <K extends keyof SkillReferenceEmbeddingRequest>(field: K, value: SkillReferenceEmbeddingRequest[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!canSubmit || mutation.isPending) return;
    const ok = await confirm({
      title: "임베딩 생성",
      message: `${form.datasetId} 데이터셋의 ${form.conceptType || "전체"} Concept 임베딩 생성을 시작합니다.`,
      okText: "생성",
      cancelText: "취소",
    });
    if (!ok) return;
    mutation.mutate({
      ...form,
      datasetId: form.datasetId.trim(),
      provider: form.provider?.trim() || undefined,
      conceptType: form.conceptType?.trim() || undefined,
      embeddingProvider: form.embeddingProvider.trim(),
      embeddingModel: form.embeddingModel.trim(),
      textType: form.textType.trim(),
      textBuildStrategy: form.textBuildStrategy?.trim() || undefined,
    });
  };

  const result = mutation.data;

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Reference 임베딩 생성</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.25} sx={{ pt: 1 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Dataset ID"
              size="small"
              required
              value={form.datasetId}
              onChange={(event) => update("datasetId", event.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Provider"
              size="small"
              value={form.provider ?? ""}
              onChange={(event) => update("provider", event.target.value)}
              sx={{ width: { xs: "100%", sm: 140 } }}
            />
          </Stack>

          <FormControl size="small" fullWidth>
            <InputLabel>Concept 유형</InputLabel>
            <Select
              value={form.conceptType ?? ""}
              label="Concept 유형"
              onChange={(event) => update("conceptType", event.target.value)}
            >
              {CONCEPT_TYPE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Embedding Provider"
              size="small"
              required
              value={form.embeddingProvider}
              onChange={(event) => update("embeddingProvider", event.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Dimension"
              type="number"
              size="small"
              required
              value={form.embeddingDim}
              onChange={(event) => update("embeddingDim", Number(event.target.value))}
              sx={{ width: { xs: "100%", sm: 140 } }}
            />
          </Stack>

          <TextField
            label="Embedding Model"
            size="small"
            required
            value={form.embeddingModel}
            onChange={(event) => update("embeddingModel", event.target.value)}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Text Type"
              size="small"
              required
              value={form.textType}
              onChange={(event) => update("textType", event.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Batch Size"
              type="number"
              size="small"
              required
              value={form.batchSize}
              onChange={(event) => update("batchSize", Number(event.target.value))}
              slotProps={{ htmlInput: { min: 1, max: 100 } }}
              sx={{ width: { xs: "100%", sm: 140 } }}
            />
          </Stack>

          <TextField
            label="Text Build Strategy"
            size="small"
            value={form.textBuildStrategy ?? ""}
            onChange={(event) => update("textBuildStrategy", event.target.value)}
          />

          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.normalize}
                  onChange={(event) => update("normalize", event.target.checked)}
                />
              }
              label="Normalize"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.overwrite}
                  onChange={(event) => update("overwrite", event.target.checked)}
                />
              }
              label="Overwrite"
            />
          </Stack>

          {mutation.isPending ? <LinearProgress /> : null}
          {mutation.error ? (
            <Alert severity="error">{resolveAxiosError(mutation.error) || "임베딩 생성에 실패했습니다."}</Alert>
          ) : null}
          {result ? (
            <Alert severity={result.failedCount > 0 ? "warning" : "success"}>
              <Box>
                <Typography variant="body2">
                  total {result.totalCount} · processed {result.processedCount} · embedded {result.embeddedCount} · skipped {result.skippedCount} · failed {result.failedCount}
                </Typography>
              </Box>
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} disabled={mutation.isPending}>
          닫기
        </Button>
        <Button
          variant="contained"
          startIcon={<AutoAwesomeOutlined />}
          onClick={handleSubmit}
          disabled={!canSubmit || mutation.isPending}
        >
          생성
        </Button>
      </DialogActions>
    </Dialog>
  );
}
