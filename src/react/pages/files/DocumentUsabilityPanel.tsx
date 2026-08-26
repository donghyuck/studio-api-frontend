import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  AssessmentOutlined,
  ExpandMoreOutlined,
  RefreshOutlined,
} from "@mui/icons-material";
import type { DocumentUsabilityAssessmentDto, RagMeasuredValueDto } from "@/types/studio/ai";
import {
  canRunAutoEvaluation,
  countMeasurement,
  decisionView,
  eligibilityView,
  evaluationView,
  executionView,
  locationLabel,
  percentMeasurement,
  qualityView,
  reasonLabel,
  searchabilityView,
  type StatusView,
} from "./documentUsabilityView";

type Props = {
  assessment: DocumentUsabilityAssessmentDto;
  basisMatches: boolean;
  evaluating: boolean;
  evaluationError: string | null;
  onAutoEvaluate: () => void;
};

function StatusChip({ view }: { view: StatusView }) {
  return <Chip size="small" color={view.tone} variant="outlined" label={view.label} />;
}

function PercentMetric({
  label,
  measurement,
}: {
  label: string;
  measurement: RagMeasuredValueDto<number>;
}) {
  const view = percentMeasurement(measurement);
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>{label}</Typography>
        <Typography variant="body2" color={view.measured ? "text.primary" : "text.secondary"} sx={{ fontWeight: 700 }}>
          {view.label}
        </Typography>
      </Stack>
      {view.measured && view.value != null ? (
        <LinearProgress
          variant="determinate"
          value={Math.max(0, Math.min(100, view.value * 100))}
          aria-label={label}
          aria-valuenow={Math.round(view.value * 100)}
          sx={{ height: 7, borderRadius: 4, mt: 1 }}
        />
      ) : view.reasonCode ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
          {reasonLabel(view.reasonCode)}
        </Typography>
      ) : null}
    </Box>
  );
}

function allReasonCodes(assessment: DocumentUsabilityAssessmentDto) {
  return Array.from(new Set([
    ...assessment.decision.reasonCodes,
    ...assessment.quality.reasonCodes,
    ...assessment.location.reasonCodes,
    ...assessment.indexing.eligibility.reasonCodes,
    ...assessment.indexing.execution.reasonCodes,
    ...assessment.searchability.reasonCodes,
    ...assessment.ragEvaluation.reasonCodes,
  ])).sort();
}

export function DocumentUsabilityPanel({
  assessment,
  basisMatches,
  evaluating,
  evaluationError,
  onAutoEvaluate,
}: Props) {
  const decision = decisionView(assessment.decision.code);
  const quality = qualityView(assessment.quality.status);
  const eligibility = eligibilityView(assessment.indexing.eligibility.status);
  const execution = executionView(assessment.indexing.execution.status);
  const searchability = searchabilityView(assessment.searchability.status);
  const evaluation = evaluationView(assessment.ragEvaluation.status);
  const qualityScore = assessment.quality.score.state === "MEASURED" && assessment.quality.score.value != null
    ? assessment.quality.score.value.toFixed(2)
    : percentMeasurement(assessment.quality.score).label;
  const indexedRecordCount = countMeasurement(assessment.searchability.indexedRecordCount);
  const canEvaluate = canRunAutoEvaluation(assessment, basisMatches, evaluating);
  const reasons = allReasonCodes(assessment);
  const evaluationCompleted = assessment.ragEvaluation.status === "COMPLETED";

  return (
    <Stack spacing={2.5}>
      {!basisMatches ? (
        <Alert severity="warning">
          이 평가는 첨부파일의 현재 리비전({assessment.basis.revisionId || "확인 불가"}) 기준입니다.
          지금 보고 있는 리비전과 달라 자동 평가를 실행할 수 없습니다.
        </Alert>
      ) : null}

      <Paper
        variant="outlined"
        sx={{
          p: 2.5,
          borderRadius: 2,
          borderLeft: "5px solid",
          borderLeftColor: decision.tone === "default" ? "divider" : `${decision.tone}.main`,
        }}
      >
        <Stack spacing={1.25}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{decision.label}</Typography>
            <Chip
              size="small"
              color={assessment.decision.usable ? "success" : "error"}
              label={assessment.decision.usable ? "현재 RAG 사용 가능" : "현재 RAG 사용 불가"}
            />
          </Stack>
          {assessment.decision.reasonCodes.length > 0 ? (
            <Typography variant="body2" color="text.secondary">
              {reasonLabel(assessment.decision.reasonCodes[0])}
            </Typography>
          ) : null}
          <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75}>
            <StatusChip view={quality} />
            <StatusChip view={eligibility} />
            <StatusChip view={execution} />
            <StatusChip view={searchability} />
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: "100%" }}>
            <Stack spacing={1.5}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>문서 품질과 색인</Typography>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">품질 점수</Typography>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>{qualityScore}</Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">검색 레코드</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{indexedRecordCount.label}</Typography>
              </Stack>
              {assessment.indexing.execution.currentStep ? (
                <Typography variant="caption" color="text.secondary">
                  현재 단계: {assessment.indexing.execution.currentStep}
                </Typography>
              ) : null}
              {assessment.indexing.execution.progress.state === "MEASURED" ? (
                <PercentMetric label="색인 진행률" measurement={assessment.indexing.execution.progress} />
              ) : null}
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, height: "100%" }}>
            <Stack spacing={1.5}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{locationLabel(assessment.location.scheme)}</Typography>
              <PercentMetric label="원문 위치 연결률" measurement={assessment.location.coverage} />
              {assessment.location.pageCoverage.state === "NOT_APPLICABLE" ? (
                <Alert severity="info" icon={false} sx={{ py: 0.5 }}>
                  이 파일 형식은 고정 페이지 기준을 사용하지 않습니다.
                </Alert>
              ) : (
                <PercentMetric label="페이지 위치 연결률" measurement={assessment.location.pageCoverage} />
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack spacing={1.5}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
            <AssessmentOutlined color="primary" fontSize="small" />
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>자동 RAG 평가</Typography>
            <StatusChip view={evaluation} />
            {assessment.ragEvaluation.freshness === "STALE" ? (
              <Chip size="small" color="warning" label="이전 리비전 기준" />
            ) : assessment.ragEvaluation.freshness === "CURRENT" ? (
              <Chip size="small" color="success" variant="outlined" label="현재 리비전 기준" />
            ) : null}
            <Box sx={{ flex: 1 }} />
            <Button
              size="small"
              variant={evaluationCompleted ? "outlined" : "contained"}
              startIcon={evaluating ? <CircularProgress size={14} color="inherit" /> : <RefreshOutlined />}
              disabled={!canEvaluate}
              onClick={onAutoEvaluate}
            >
              {evaluating ? "평가 중" : evaluationCompleted ? "다시 평가" : "평가 실행"}
            </Button>
          </Stack>

          {assessment.searchability.status !== "SEARCHABLE" ? (
            <Typography variant="caption" color="text.secondary">
              문서가 검색 가능한 상태가 되면 자동 평가를 실행할 수 있습니다.
            </Typography>
          ) : null}
          {evaluationError ? <Alert severity="error">{evaluationError}</Alert> : null}

          {evaluationCompleted ? (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <PercentMetric label="근거 검색 성공률" measurement={assessment.ragEvaluation.evidenceHitRate} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <PercentMetric label="평균 역순위(MRR)" measurement={assessment.ragEvaluation.mrr} />
              </Grid>
              {assessment.ragEvaluation.selectedStrategy ? (
                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" color="text.secondary">
                    선택 전략: {assessment.ragEvaluation.selectedStrategy}
                    {assessment.ragEvaluation.topK != null ? ` · Top K ${assessment.ragEvaluation.topK}` : ""}
                  </Typography>
                </Grid>
              ) : null}
            </Grid>
          ) : null}
        </Stack>
      </Paper>

      <Accordion variant="outlined" sx={{ borderRadius: 1.5, "&:before": { display: "none" } }}>
        <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>판정 근거와 계약 정보</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.25}>
            <Typography variant="caption" color="text.secondary">
              Contract {assessment.contractVersion || "-"} · Policy {assessment.policy.version || "-"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Object {assessment.basis.objectType || "-"}/{assessment.basis.objectId || "-"} · Revision {assessment.basis.revisionId || "-"}
            </Typography>
            {reasons.length > 0 ? reasons.map((reason) => (
              <Box key={reason} sx={{ p: 1.25, borderRadius: 1, bgcolor: "action.hover" }}>
                <Typography variant="body2">{reasonLabel(reason)}</Typography>
                <Typography variant="caption" color="text.secondary">{reason}</Typography>
              </Box>
            )) : (
              <Typography variant="body2" color="text.secondary">추가 판정 사유가 없습니다.</Typography>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}
