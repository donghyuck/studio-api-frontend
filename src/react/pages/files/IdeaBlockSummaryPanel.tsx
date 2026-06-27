import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Stack,
  Grid,
  Tabs,
  Tab,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Chip,
  CircularProgress,
  Paper,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import { ExpandMoreOutlined, InfoOutlined, CheckCircleOutlined, ErrorOutline } from "@mui/icons-material";
import { useToast } from "@/react/feedback";
import { RagEvaluationDashboard } from "./RagEvaluationDashboard";
import { useQuery } from "@tanstack/react-query";
import { reactMarkdownDocumentApi } from "./api";
import type { IdeaBlockSummaryDto, MergeCandidateCluster, SampleIdeaBlock, MergePreviewCluster } from "./api";

interface Props {
  documentId: string;
  revisionId: string;
  revisionStatus?: string;
  attachmentId?: number;
  chunkingStrategy?: string;
  llmProvider?: string;
  llmModel?: string;
  embeddingProfileId?: string;
  useLlmKeywordExtraction?: boolean;
  disabled?: boolean;
  onMergeApplied?: (runRagIndex: boolean) => void;
}

export function IdeaBlockSummaryPanel({
  documentId,
  revisionId,
  revisionStatus,
  attachmentId,
  chunkingStrategy,
  llmProvider,
  llmModel,
  embeddingProfileId,
  useLlmKeywordExtraction,
  disabled,
  onMergeApplied,
}: Props) {
  const [tabIndex, setTabIndex] = useState(0);

  const { data: summary, isLoading, error, refetch } = useQuery({
    queryKey: ["ideablock-summary", documentId, revisionId],
    queryFn: () => reactMarkdownDocumentApi.getIdeaBlockSummary(documentId, revisionId),
    enabled: !!documentId && !!revisionId,
    retry: false,
  });

  if (isLoading) {
    return (
      <Box sx={{ mt: 2, pt: 1.5, borderTop: "1px dashed", borderColor: "divider", display: "flex", alignItems: "center", gap: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="caption" color="text.secondary">IdeaBlock 품질 리포트 조회 중...</Typography>
      </Box>
    );
  }

  if (error || !summary) {
    return (
      <Box sx={{ mt: 2, pt: 1.5, borderTop: "1px dashed", borderColor: "divider" }}>
        <Alert severity="error" sx={{ fontSize: 11, py: 0, px: 1 }}>
          IdeaBlock 품질 리포트를 불러올 수 없습니다.
        </Alert>
      </Box>
    );
  }

  const noEmbedding = summary.embeddingMergeCandidateCount === 0 && summary.embeddingSimilarityClusterCount === 0 && (!summary.embeddingCandidateClusters || summary.embeddingCandidateClusters.length === 0);

  // Check screen entry condition for IdeaBlock merge UI:
  // - Markdown revision is 'COMPLETED'
  // - Chunking strategy is 'blockify'
  // - Has at least one merge candidate cluster (lexical or embedding)
  const showMergeUI = revisionStatus === "COMPLETED" && chunkingStrategy === "blockify" && (
    (summary.mergeCandidateClusters && summary.mergeCandidateClusters.length > 0) ||
    (summary.embeddingCandidateClusters && summary.embeddingCandidateClusters.length > 0)
  );

  return (
    <Box sx={{ mt: 2, pt: 1.5, borderTop: "1px dashed", borderColor: "divider" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: "primary.main" }}>
          IdeaBlock 품질
        </Typography>
      </Stack>

      {/* Summary Card */}
      <Grid container spacing={1} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, sm: 4 }}>
          <Typography variant="caption" color="text.secondary" display="block">Coverage</Typography>
          <Typography variant="body2" sx={{ fontSize: 11, fontWeight: 500 }}>
            {summary.coverage !== undefined ? `${(summary.coverage * 100).toFixed(1)}%` : "N/A"}
          </Typography>
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <Typography variant="caption" color="text.secondary" display="block">IdeaBlock</Typography>
          <Typography variant="body2" sx={{ fontSize: 11, fontWeight: 500, color: "success.main" }}>
            {summary.ideaBlockCount ?? 0}
          </Typography>
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <Typography variant="caption" color="text.secondary" display="block">Fallback</Typography>
          <Typography variant="body2" sx={{ fontSize: 11, fontWeight: 500, color: "warning.main" }}>
            {summary.fallbackCount ?? 0}
          </Typography>
        </Grid>

        <Grid size={{ xs: 12 }} sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" display="block">Lexical merge candidates</Typography>
          <Typography variant="body2" sx={{ fontSize: 11, fontWeight: 500 }}>
            {summary.mergeCandidateCount ?? 0} / {summary.similarityClusterCount ?? 0} clusters
          </Typography>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="caption" color="text.secondary" display="block">Embedding merge candidates</Typography>
            {noEmbedding && (
              <Tooltip title="Embedding cluster는 서버 embedding provider가 구성된 경우에만 계산됩니다.">
                <InfoOutlined sx={{ fontSize: 14, color: "text.disabled", cursor: "help" }} />
              </Tooltip>
            )}
          </Stack>
          {noEmbedding ? (
            <Typography variant="body2" sx={{ fontSize: 11, fontWeight: 500, color: "text.disabled" }}>
              Embedding 후보 없음
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ fontSize: 11, fontWeight: 500 }}>
              {summary.embeddingMergeCandidateCount ?? 0} / {summary.embeddingSimilarityClusterCount ?? 0} clusters
            </Typography>
          )}
        </Grid>

        {summary.embeddingSimilarityThreshold !== undefined && (
          <Grid size={{ xs: 12 }}>
            <Typography variant="caption" color="text.secondary" display="block">Embedding threshold</Typography>
            <Typography variant="body2" sx={{ fontSize: 11, fontWeight: 500 }}>
              {summary.embeddingSimilarityThreshold.toFixed(2)}
            </Typography>
          </Grid>
        )}
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} variant="scrollable" scrollButtons="auto" sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, fontSize: 11, fontWeight: 600, px: 2, py: 0.5 } }}>
          <Tab label="Samples" />
          <Tab label="Fallbacks" />
          {showMergeUI && <Tab label="Lexical Merge Candidates" />}
          {showMergeUI && <Tab label="Embedding Merge Candidates" />}
          <Tab label="Evaluation Dashboard" />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <Box sx={{ pt: 1.5, maxHeight: 350, overflowY: "auto" }}>
        {tabIndex === 0 && (
          <SamplesTab
            samples={summary.samples || []}
            documentId={documentId}
            revisionId={revisionId}
            embeddingProfileId={embeddingProfileId || "retrieval-ko-kure"}
            onMergeApplied={onMergeApplied}
            refetchSummary={refetch}
          />
        )}
        {tabIndex === 1 && <FallbacksTab summary={summary} />}
        {showMergeUI && tabIndex === 2 && (
          <ClusterListTab
            clusters={summary.mergeCandidateClusters || []}
            type="lexical"
            documentId={documentId}
            revisionId={revisionId}
            llmProvider={llmProvider || "google-ai-gemini"}
            llmModel={llmModel || "gemini-2.5-flash"}
            embeddingProfileId={embeddingProfileId || "retrieval-ko-kure"}
            useLlmKeywordExtraction={!!useLlmKeywordExtraction}
            disabled={!!disabled}
            onMergeApplied={onMergeApplied}
            refetchSummary={refetch}
          />
        )}
        {showMergeUI && tabIndex === 3 && (
          <ClusterListTab
            clusters={summary.embeddingCandidateClusters || []}
            type="embedding"
            noEmbedding={noEmbedding}
            documentId={documentId}
            revisionId={revisionId}
            llmProvider={llmProvider || "google-ai-gemini"}
            llmModel={llmModel || "gemini-2.5-flash"}
            embeddingProfileId={embeddingProfileId || "retrieval-ko-kure"}
            useLlmKeywordExtraction={!!useLlmKeywordExtraction}
            disabled={!!disabled}
            onMergeApplied={onMergeApplied}
            refetchSummary={refetch}
          />
        )}
        {tabIndex === 4 && (
          <RagEvaluationDashboard
            documentId={documentId}
            attachmentId={attachmentId || 1}
            embeddingProfileId={embeddingProfileId}
          />
        )}
      </Box>
    </Box>
  );
}

function SamplesTab({
  samples,
  documentId,
  revisionId,
  embeddingProfileId,
  onMergeApplied,
  refetchSummary,
}: {
  samples: SampleIdeaBlock[];
  documentId: string;
  revisionId: string;
  embeddingProfileId: string;
  onMergeApplied?: (runRagIndex: boolean) => void;
  refetchSummary: () => void;
}) {
  if (samples.length === 0) {
    return <Typography variant="caption" color="text.secondary">샘플이 없습니다.</Typography>;
  }

  return (
    <Stack spacing={1}>
      {samples.map((sample, idx) => (
        <SampleItem
          key={idx}
          sample={sample}
          documentId={documentId}
          revisionId={revisionId}
          embeddingProfileId={embeddingProfileId}
          onMergeApplied={onMergeApplied}
          refetchSummary={refetchSummary}
        />
      ))}
    </Stack>
  );
}

function SampleItem({
  sample,
  documentId,
  revisionId,
  embeddingProfileId,
  onMergeApplied,
  refetchSummary,
}: {
  sample: SampleIdeaBlock;
  documentId: string;
  revisionId: string;
  embeddingProfileId: string;
  onMergeApplied?: (runRagIndex: boolean) => void;
  refetchSummary: () => void;
}) {
  const [isUndoLoading, setIsUndoLoading] = useState(false);
  const [undoInfo, setUndoInfo] = useState<any>(null);
  const [undoError, setUndoError] = useState<string | null>(null);

  const [progress, setProgress] = useState<any>(null);
  const [isPolling, setIsPolling] = useState(false);

  const toast = useToast();

  useEffect(() => {
    if (!isPolling || !documentId) return;
    let active = true;
    const fetchProgress = async () => {
      try {
        const res = await reactMarkdownDocumentApi.getProgress(documentId);
        if (!active) return;
        setProgress(res);
        const isCompleted = res.status === "COMPLETED";
        const isFailed = res.status === "FAILED";
        const ragStatus = res.rag?.status;
        const isRagFinished = ragStatus === "SUCCEEDED" || ragStatus === "FAILED" || ragStatus === "WARNING";

        if (isCompleted || isFailed || isRagFinished) {
          setIsPolling(false);
        }
      } catch (err) {
        console.error(err);
      }
    };
    void fetchProgress();
    const timer = setInterval(fetchProgress, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [isPolling, documentId]);

  const handleUndo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = window.confirm("이 병합된 청크를 되돌리시겠습니까? 원본 청크들이 복원됩니다.");
    if (!ok) return;

    setIsUndoLoading(true);
    setUndoError(null);
    try {
      const res = await reactMarkdownDocumentApi.mergeUndo(documentId, revisionId, {
        mergedChunkId: sample.chunkId,
        planFingerprint: sample.fingerprint || "dummy-fingerprint",
        runRagIndex: true,
        embeddingProfileId,
      });

      setUndoInfo(res);
      if (res.pipelineResult) {
        setIsPolling(true);
      }
      toast.success("병합 되돌리기 성공! RAG 재색인이 시작되었습니다.");
      refetchSummary();
      if (onMergeApplied) {
        onMergeApplied(true);
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.response?.data?.message || err?.message || "병합 되돌리기 실패";
      setUndoError(errMsg);
    } finally {
      setIsUndoLoading(false);
    }
  };

  const isDistilled = sample.chunkId.startsWith("ideablock-merged-") || sample.fingerprint;

  return (
    <Paper variant="outlined" sx={{ p: 1, bgcolor: "background.paper", borderRadius: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: "primary.main", wordBreak: "break-all" }}>
          {sample.chunkId}
        </Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {sample.mergeCandidate && (
            <Tooltip title={`Cluster ID: ${sample.similarityClusterId || '-'}, Max Score: ${sample.similarityMaxScore?.toFixed(3) || '-'}`}>
              <Chip label="Lexical Candidate" size="small" color="info" variant="outlined" sx={{ height: 16, fontSize: 9, "& .MuiChip-label": { px: 0.5 } }} />
            </Tooltip>
          )}
          {sample.embeddingMergeCandidate && (
            <Tooltip title={`Cluster ID: ${sample.embeddingSimilarityClusterId || '-'}, Max Score: ${sample.embeddingSimilarityMaxScore?.toFixed(3) || '-'}`}>
              <Chip label="Embedding Candidate" size="small" color="secondary" variant="outlined" sx={{ height: 16, fontSize: 9, "& .MuiChip-label": { px: 0.5 } }} />
            </Tooltip>
          )}
          {isDistilled && !undoInfo && (
            <Button
              variant="outlined"
              size="small"
              color="error"
              disabled={isUndoLoading}
              onClick={handleUndo}
              sx={{ height: 16, fontSize: 8, px: 0.5, py: 0, minWidth: 0 }}
            >
              {isUndoLoading ? <CircularProgress size={8} /> : "되돌리기"}
            </Button>
          )}
        </Stack>
      </Stack>
      {sample.criticalQuestion && (
        <Typography variant="body2" sx={{ fontSize: 11, fontWeight: 500, mb: 0.5 }}>
          Q: {sample.criticalQuestion}
        </Typography>
      )}
      {sample.trustedAnswer && (
        <Typography variant="body2" sx={{ fontSize: 11, color: "text.secondary", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          A: {sample.trustedAnswer}
        </Typography>
      )}

      {undoError && (
        <Alert severity="error" sx={{ fontSize: 9, py: 0, px: 1, mt: 0.5 }}>
          {undoError}
        </Alert>
      )}

      {undoInfo && (
        <Alert severity="warning" sx={{ fontSize: 9, py: 0, px: 1, mt: 0.5 }}>
          병합 되돌리기 성공! 원본 청크 복원 중. (청크 {undoInfo.beforeChunkCount}개 → {undoInfo.afterChunkCount}개)
        </Alert>
      )}

      {isPolling && progress && (
        <Box sx={{ mt: 0.5, p: 0.5, bgcolor: "action.hover", borderRadius: 0.5, border: "1px dashed", borderColor: "warning.main" }}>
          <Typography variant="caption" sx={{ fontSize: 8.5, display: "block" }}>
            되돌리기 색인 상태: {progress.status} / {progress.rag?.currentStep || "-"}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

function FallbacksTab({ summary }: { summary: IdeaBlockSummaryDto }) {
  const count = summary.fallbackCount ?? 0;
  if (count === 0) {
    return <Typography variant="caption" color="text.secondary">Fallback 처리된 항목이 없습니다.</Typography>;
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, fontSize: 10.5 }}>
        일부 source block은 IdeaBlock 생성 조건을 만족하지 않아 structure-based chunk로 보존되었습니다.
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
        {Object.entries(summary.fallbackReasonCounts || {}).map(([reason, cnt]) => {
          const labels: Record<string, string> = {
            ANSWER_TOO_SHORT: "생성 답변이 너무 짧음",
            ANSWER_HAS_NO_BODY: "답변 본문 없음",
            ANSWER_EQUALS_TITLE: "답변이 제목만 반복",
            HEADING_ONLY: "제목만 있는 block",
            EVIDENCE_NOT_FOUND: "원문 evidence 없음",
            TRUSTED_ANSWER_FACT_MISMATCH: "팩트 불일치",
            TABLE_TOO_LARGE: "표가 너무 커서 분할 실패",
          };
          return (
            <Chip
              key={reason}
              label={`${labels[reason] || reason}: ${cnt}건`}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: 10, bgcolor: "background.paper" }}
            />
          );
        })}
      </Box>
    </Box>
  );
}

function ClusterListTab({
  clusters,
  type,
  noEmbedding,
  documentId,
  revisionId,
  llmProvider,
  llmModel,
  embeddingProfileId,
  useLlmKeywordExtraction,
  disabled,
  onMergeApplied,
  refetchSummary,
}: {
  clusters: MergeCandidateCluster[];
  type: "lexical" | "embedding";
  noEmbedding?: boolean;
  documentId: string;
  revisionId: string;
  llmProvider?: string;
  llmModel?: string;
  embeddingProfileId?: string;
  useLlmKeywordExtraction?: boolean;
  disabled: boolean;
  onMergeApplied?: (runRagIndex: boolean) => void;
  refetchSummary: () => void;
}) {
  if (noEmbedding) {
    return <Typography variant="caption" color="text.secondary">Embedding 후보 없음</Typography>;
  }

  if (clusters.length === 0) {
    return <Typography variant="caption" color="text.secondary">병합 후보(Cluster)가 없습니다.</Typography>;
  }

  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: 10 }}>
        ※ 병합 후보에 대해 미리보기를 실행하고 승인된 plan만 실제 저장소에 반영할 수 있습니다.
      </Typography>
      {disabled && (
        <Alert severity="warning" sx={{ fontSize: 10.5, py: 0.5, px: 1, mb: 1 }}>
          현재 RAG 색인 또는 파이프라인이 진행 중이므로 추가 병합을 적용할 수 없습니다.
        </Alert>
      )}
      {clusters.map((c) => (
        <ClusterItem
          key={c.clusterId}
          cluster={c}
          type={type}
          documentId={documentId}
          revisionId={revisionId}
          llmProvider={llmProvider || ""}
          llmModel={llmModel || ""}
          embeddingProfileId={embeddingProfileId || ""}
          useLlmKeywordExtraction={!!useLlmKeywordExtraction}
          disabled={disabled}
          onMergeApplied={onMergeApplied}
          refetchSummary={refetchSummary}
        />
      ))}
    </Stack>
  );
}

function formatValidationWarning(warning: string): string {
  if (warning === "LLM_NOT_CONFIGURED") {
    return "LLM 설정이 누락되어 미리보기를 생성할 수 없습니다. (LLM Provider/Model 설정을 확인해 주세요.)";
  }
  if (warning === "LLM_REJECTED_MERGE") {
    return "LLM이 해당 후보들의 병합이 부적절하다고 판단하여 병합을 반려했습니다.";
  }
  if (warning === "MISSING_CRITICAL_QUESTION_SECTION") {
    return "미리보기 결과에 핵심 질문(Critical Question) 섹션이 유실되었습니다.";
  }
  if (warning === "MISSING_TRUSTED_ANSWER_SECTION") {
    return "미리보기 결과에 신뢰 답변(Trusted Answer) 섹션이 유실되었습니다.";
  }
  if (warning.startsWith("FACT_TOKEN_MISSING:")) {
    const token = warning.substring("FACT_TOKEN_MISSING:".length);
    return `원문 수치/조건 "${token}"이 병합 답변에 누락되었습니다. (원문 대조 및 확인 필요)`;
  }
  return warning;
}

function ClusterItem({
  cluster,
  type,
  documentId,
  revisionId,
  llmProvider,
  llmModel,
  embeddingProfileId,
  useLlmKeywordExtraction,
  disabled,
  onMergeApplied,
  refetchSummary,
}: {
  cluster: MergeCandidateCluster;
  type: "lexical" | "embedding";
  documentId: string;
  revisionId: string;
  llmProvider: string;
  llmModel: string;
  embeddingProfileId: string;
  useLlmKeywordExtraction: boolean;
  disabled: boolean;
  onMergeApplied?: (runRagIndex: boolean) => void;
  refetchSummary: () => void;
}) {
  const toast = useToast();
  const [preview, setPreview] = useState<MergePreviewCluster | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isApplyLoading, setIsApplyLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [appliedInfo, setAppliedInfo] = useState<{
    mergedChunkId: string;
    beforeChunkCount: number;
    afterChunkCount: number;
    reindexed: boolean;
    sourceEvidence?: any[];
    mergedFromChunkIds?: string[];
  } | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [runRagIndex, setRunRagIndex] = useState(false);

  // Polling states for RAG reindexing progress
  const [progress, setProgress] = useState<any>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null);

  const isDevMode = import.meta.env.DEV;

  // Effect to handle RAG index polling
  useEffect(() => {
    if (!isPolling || !documentId) return;

    let active = true;
    const fetchProgress = async () => {
      try {
        const res = await reactMarkdownDocumentApi.getProgress(documentId);
        if (!active) return;
        setProgress(res);

        const isCompleted = res.status === "COMPLETED";
        const isFailed = res.status === "FAILED";
        const ragStatus = res.rag?.status;
        const isRagFinished = ragStatus === "SUCCEEDED" || ragStatus === "FAILED" || ragStatus === "WARNING";

        if (isCompleted || isFailed || isRagFinished) {
          setIsPolling(false);
          if (isFailed || ragStatus === "FAILED") {
            setPollingError(res.rag?.errorMessage || res.errorMessage || "재색인 진행 중 실패했습니다.");
          }
        }
      } catch (err: any) {
        console.error("Pipeline progress polling failed:", err);
      }
    };

    void fetchProgress();
    const timer = setInterval(fetchProgress, 3000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [isPolling, documentId]);

  const handleCreatePreview = async (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent accordion toggle
    setIsPreviewLoading(true);
    setErrorMsg(null);
    try {
      const res = await reactMarkdownDocumentApi.mergePreview(documentId, revisionId, {
        clusterId: cluster.clusterId,
        preferEmbeddingClusters: type === "embedding",
        llmProvider: llmProvider || "google-ai-gemini",
        llmModel: llmModel || "gemini-2.5-flash",
        maxClusters: 1,
      });
      if (res.clusters && res.clusters.length > 0) {
        setPreview(res.clusters[0]);
      } else {
        setErrorMsg("미리보기 데이터를 받지 못했습니다.");
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.response?.data?.message || err?.message || "미리보기 생성 실패";
      setErrorMsg(errMsg);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleOpenConfirm = (rag: boolean) => {
    setRunRagIndex(rag);
    setConfirmDialogOpen(true);
  };

  const handleApplyMerge = async () => {
    if (!preview) return;
    setConfirmDialogOpen(false);
    setIsApplyLoading(true);
    setErrorMsg(null);
    setPollingError(null);
    try {
      const res = await reactMarkdownDocumentApi.mergeApply(documentId, revisionId, {
        clusterId: cluster.clusterId,
        preferEmbeddingClusters: type === "embedding",
        llmProvider: llmProvider || "google-ai-gemini",
        llmModel: llmModel || "gemini-2.5-flash",
        maxClusters: 1,
        planFingerprint: preview.planFingerprint,
        runRagIndex,
        embeddingProfileId: embeddingProfileId || "retrieval-ko-kure",
        useLlmKeywordExtraction,
      });

      setAppliedInfo({
        mergedChunkId: res.mergedChunkId,
        beforeChunkCount: res.beforeChunkCount,
        afterChunkCount: res.afterChunkCount,
        reindexed: !!res.pipelineResult,
        sourceEvidence: preview.sourceEvidence,
        mergedFromChunkIds: preview.mergedFromChunkIds,
      });

      // Start polling if reindexing was requested and pipelineResult is present
      if (runRagIndex && res.pipelineResult) {
        setProgress(null);
        setIsPolling(true);
      }

      // refetch summary to update candidate list
      refetchSummary();

      if (onMergeApplied) {
        onMergeApplied(runRagIndex);
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.response?.data?.message || err?.message || "병합 적용 실패";
      // mapping errors
      if (errMsg.includes("planFingerprint is required")) {
        setErrorMsg("승인 토큰이 만료되었거나 누락되었습니다. 미리보기를 다시 생성해주세요.");
      } else if (errMsg.includes("stale") || errMsg.includes("not found")) {
        setErrorMsg("병합 계획이 만료되었습니다. 다른 사용자가 병합했거나 상태가 변경되었습니다. 미리보기를 다시 생성해주세요.");
      } else if (errMsg.includes("not applicable")) {
        setErrorMsg("이 병합 후보는 현재 적용할 수 없습니다.");
      } else if (errMsg.includes("source chunks are missing")) {
        setErrorMsg("소스 청크를 찾을 수 없습니다. 품질 리포트를 다시 조회해 주세요.");
      } else {
        setErrorMsg(errMsg);
      }
    } finally {
      setIsApplyLoading(false);
    }
  };

  const handleResumeRag = async () => {
    setIsApplyLoading(true);
    setPollingError(null);
    try {
      await reactMarkdownDocumentApi.resume(documentId, {
        fromStage: "RAG_INDEX"
      });
      setProgress(null);
      setIsPolling(true);
      if (onMergeApplied) {
        onMergeApplied(true);
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.response?.data?.message || err?.message || "RAG 재시도 실패";
      setPollingError(errMsg);
    } finally {
      setIsApplyLoading(false);
    }
  };

  const isPendingPipeline = disabled;

  return (
    <>
      <Accordion key={cluster.clusterId} disableGutters square elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreOutlined sx={{ fontSize: 16 }} />} sx={{ minHeight: 40, px: 1, bgcolor: "action.hover" }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ width: "100%", mr: 1 }} onClick={(e) => e.stopPropagation()}>
            <Typography sx={{ fontSize: 11, fontWeight: 600 }}>{cluster.clusterId}</Typography>
            <Chip label={`Size: ${cluster.size}`} size="small" sx={{ height: 16, fontSize: 9 }} />
            {cluster.maxScore !== undefined && (
              <Chip label={`Max Score: ${cluster.maxScore.toFixed(3)}`} size="small" variant="outlined" sx={{ height: 16, fontSize: 9 }} />
            )}

            <Box sx={{ flexGrow: 1 }} />

            {appliedInfo ? (
              <Chip label="병합 적용 완료" size="small" color="success" sx={{ height: 20, fontSize: 9 }} />
            ) : (
              <Button
                variant="contained"
                size="small"
                onClick={handleCreatePreview}
                disabled={isPreviewLoading || isApplyLoading || isPendingPipeline}
                sx={{ height: 20, fontSize: 9, px: 1, minWidth: 0 }}
              >
                {isPreviewLoading ? <CircularProgress size={10} color="inherit" /> : "Preview 생성"}
              </Button>
            )}
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 1, bgcolor: "background.paper" }}>
          <Stack spacing={1}>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>Chunk IDs:</Typography>
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {cluster.chunkIds.map((id) => (
                  <Typography component="li" variant="caption" key={id} sx={{ fontFamily: "monospace", fontSize: 10 }}>
                    {id}
                  </Typography>
                ))}
              </Box>
            </Box>

            {errorMsg && (
              <Alert severity="error" sx={{ fontSize: 10, py: 0, px: 1 }}>
                {errorMsg}
              </Alert>
            )}

            {appliedInfo && (
              <Alert severity="success" icon={<CheckCircleOutlined sx={{ fontSize: 16 }} />} sx={{ fontSize: 10, py: 0.5, px: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ width: "100%" }}>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="caption" display="block" sx={{ fontWeight: 600 }}>병합 적용 성공</Typography>
                    <Typography variant="caption" display="block">새 Chunk ID: {appliedInfo.mergedChunkId}</Typography>
                    <Typography variant="caption" display="block">청크 개수 변화: {appliedInfo.beforeChunkCount}개 → {appliedInfo.afterChunkCount}개</Typography>
                    <Typography variant="caption" display="block">
                      상태: {isPolling ? "RAG 재색인 진행 중..." : pollingError ? `오류: ${pollingError}` : appliedInfo.reindexed ? "RAG 재색인 완료" : "병합 적용됨 (재색인 미실행)"}
                    </Typography>
                  </Box>
                  {appliedInfo.mergedFromChunkIds && appliedInfo.mergedFromChunkIds.length > 0 && (
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      disabled={isApplyLoading}
                      onClick={async () => {
                        const ok = window.confirm("이 병합 건을 되돌리시겠습니까? 원본 청크들이 복원됩니다.");
                        if (!ok) return;
                        setIsApplyLoading(true);
                        try {
                          const res = await reactMarkdownDocumentApi.mergeUndo(documentId, revisionId, {
                            mergedChunkId: appliedInfo.mergedChunkId,
                            planFingerprint: preview?.planFingerprint || "dummy-fingerprint",
                            runRagIndex: true,
                            embeddingProfileId,
                          });
                          toast.success("병합 되돌리기 성공! RAG 재색인이 시작되었습니다.");
                          setAppliedInfo(null);
                          setProgress(null);
                          setIsPolling(true);
                          refetchSummary();
                          if (onMergeApplied) {
                            onMergeApplied(true);
                          }
                        } catch (err: any) {
                          console.error(err);
                          toast.error(err?.response?.data?.message || err?.message || "되돌리기 실패");
                        } finally {
                          setIsApplyLoading(false);
                        }
                      }}
                      sx={{ fontSize: 8.5, py: 0, px: 0.5, height: 18 }}
                    >
                      되돌리기 (Undo)
                    </Button>
                  )}
                </Stack>

                {/* 원본 청크 요약 */}
                {appliedInfo.mergedFromChunkIds && appliedInfo.mergedFromChunkIds.length > 0 && (
                  <Box sx={{ mt: 1, borderTop: "1px dashed", borderColor: "success.main", pt: 1 }}>
                    <Typography variant="caption" display="block" sx={{ fontWeight: 600 }}>병합된 원본 청크 목록 (Source Chunks):</Typography>
                    <Box component="ul" sx={{ m: 0, pl: 2 }}>
                      {appliedInfo.mergedFromChunkIds.map((id) => (
                        <Typography component="li" variant="caption" key={id} sx={{ fontFamily: "monospace", fontSize: 9.5 }}>
                          {id}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                )}

                {appliedInfo.sourceEvidence && appliedInfo.sourceEvidence.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" display="block" sx={{ fontWeight: 600 }}>원본 근거 요약 (Evidence Snapshot):</Typography>
                    <Box sx={{ maxHeight: 100, overflowY: "auto", border: "1px solid", borderColor: "success.light", p: 0.5, borderRadius: 0.5, bgcolor: "background.paper" }}>
                      {appliedInfo.sourceEvidence.map((ev: any, idx: number) => (
                        <Typography key={idx} variant="caption" display="block" sx={{ fontSize: 9, color: "text.secondary" }}>
                          - {typeof ev === "string" ? ev : JSON.stringify(ev)}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                )}
              </Alert>
            )}

            {isPolling && progress && (
              <Box sx={{ mt: 1, p: 1, bgcolor: "action.hover", borderRadius: 1, border: "1px dashed", borderColor: "primary.main" }}>
                <Stack spacing={0.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={10} />
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>RAG 재색인 진행 현황</Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    상태: {progress.status} / 현재 단계: {progress.currentStage}
                  </Typography>
                  {progress.rag && (
                    <Typography variant="caption" color="text.secondary">
                      RAG 상태: {progress.rag.status} | {progress.rag.currentStep === "EMBEDDING" ? `임베딩 중 (${progress.rag.embeddedCount}/${progress.rag.chunkCount})` : progress.rag.currentStep === "INDEXING" ? `색인 중 (${progress.rag.indexedCount}/${progress.rag.chunkCount})` : progress.rag.currentStep || "-"}
                    </Typography>
                  )}
                </Stack>
              </Box>
            )}

            {pollingError && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <Typography variant="caption" color="error.main" sx={{ flexGrow: 1 }}>
                  재색인 실패: {pollingError}
                </Typography>
                <Button variant="outlined" color="error" size="small" onClick={handleResumeRag} sx={{ fontSize: 9, py: 0.2 }}>
                  RAG 재시도
                </Button>
              </Stack>
            )}

            {preview && !appliedInfo && (
              <Paper variant="outlined" sx={{ p: 1, bgcolor: "action.hover", borderRadius: 1 }}>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>병합 미리보기 결과</Typography>
                    <Chip
                      label={preview.applicable ? "적용 가능" : "적용 불가"}
                      color={preview.applicable ? "success" : "error"}
                      size="small"
                      sx={{ height: 16, fontSize: 9 }}
                    />
                  </Stack>

                  {preview.validationWarnings && preview.validationWarnings.length > 0 && (
                    <Alert severity="warning" icon={<ErrorOutline sx={{ fontSize: 16 }} />} sx={{ fontSize: 10, py: 0.5, px: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>이 병합안은 적용할 수 없습니다.</Typography>
                      <Box component="ul" sx={{ m: 0, pl: 1.5 }}>
                        {preview.validationWarnings.map((w) => (
                          <Typography component="li" variant="caption" key={w} sx={{ fontSize: 9.5 }}>
                            {formatValidationWarning(w)}
                          </Typography>
                        ))}
                      </Box>
                    </Alert>
                  )}

                  {preview.criticalQuestion && (
                    <Typography variant="caption" display="block">
                      <strong>Q:</strong> {preview.criticalQuestion}
                    </Typography>
                  )}
                  {preview.trustedAnswer && (
                    <Typography variant="caption" display="block" color="text.secondary">
                      <strong>A:</strong> {preview.trustedAnswer}
                    </Typography>
                  )}
                  {preview.previewText && (
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
                      <strong>텍스트 미리보기:</strong> {preview.previewText}
                    </Typography>
                  )}

                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    {isDevMode ? (
                      <Button
                        variant="outlined"
                        color="primary"
                        size="small"
                        disabled={!preview.applicable || isApplyLoading || isPendingPipeline}
                        onClick={() => handleOpenConfirm(false)}
                        sx={{ fontSize: 10, py: 0.5, flex: 1 }}
                      >
                        병합 적용 (Stage만)
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        disabled={!preview.applicable || isApplyLoading || isPendingPipeline}
                        onClick={() => handleOpenConfirm(true)}
                        sx={{ fontSize: 10, py: 0.5, flex: 1 }}
                      >
                        병합 적용 후 RAG 재색인
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Paper>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle sx={{ fontSize: 14, fontWeight: 600 }}>IdeaBlock 병합 적용 확인</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 12, mb: 1 }}>
            선택한 병합 후보(Cluster ID: {cluster.clusterId})를 적용하시겠습니까?
          </DialogContentText>
          <Box sx={{ bgcolor: "action.hover", p: 1, borderRadius: 1, mb: 2 }}>
            <Typography variant="caption" display="block"><strong>병합 대상 Chunk 수:</strong> {preview?.mergedFromChunkIds?.length ?? cluster.chunkIds.length}개</Typography>
            <Typography variant="caption" display="block"><strong>동작 모드:</strong> {runRagIndex ? "병합 적용 + RAG 재색인" : "병합 적용 (Stage만 변경)"}</Typography>
            {runRagIndex && (
              <Typography variant="caption" display="block" color="warning.main" sx={{ mt: 0.5 }}>
                ※ RAG 재색인이 함께 수행되며 완료될 때까지 시간이 걸릴 수 있습니다.
              </Typography>
            )}
          </Box>
          {preview?.sourceEvidence && preview.sourceEvidence.length > 0 && (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>Source Evidence:</Typography>
              <Box sx={{ maxHeight: 150, overflowY: "auto", border: "1px solid", borderColor: "divider", p: 1, borderRadius: 1 }}>
                {preview.sourceEvidence.map((ev: any, idx: number) => (
                  <Typography key={idx} variant="caption" display="block" color="text.secondary" sx={{ borderBottom: idx < preview.sourceEvidence!.length - 1 ? "1px solid" : "none", borderColor: "divider", pb: 0.5, mb: 0.5 }}>
                    {typeof ev === "string" ? ev : JSON.stringify(ev)}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)} size="small" sx={{ fontSize: 11 }}>취소</Button>
          <Button onClick={handleApplyMerge} size="small" variant="contained" color="primary" autoFocus sx={{ fontSize: 11 }}>
            적용
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

