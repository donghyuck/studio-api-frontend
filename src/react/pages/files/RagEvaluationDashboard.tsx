import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Stack,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Grid,
  Card,
  CardContent,
  TextField,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from "@mui/material";
import {
  ExpandMoreOutlined,
  PlayArrowOutlined,
  CompareArrowsOutlined,
  CheckCircleOutline,
  TrendingUp,
  TrendingDown,
} from "@mui/icons-material";
import {
  reactMarkdownDocumentApi,
  type RagEvaluationRunResponse,
  type RagEvaluationCompareResponse,
  type RagEvaluationJobResponse,
} from "./api";
import { useToast } from "@/react/feedback";

interface Props {
  documentId: string;
  attachmentId: number;
  embeddingProfileId?: string;
}

const PRESET_QUERIES_FAST = [
  "근무일과 1주 근로시간은 어떻게 정해져 있는가",
  "휴게시간은 근무 중 언제 어떻게 주어지는가",
  "연장근로는 1주일에 최대 몇 시간까지 가능한가",
  "야간근로와 휴일근로 시 임금 가산율은 어떻게 되는가",
  "퇴직금은 어떤 기준으로 지급되는가"
];

const PRESET_QUERIES_BOOST = [
  "여름 휴가 규정이 있는가",
  "식대 지급 요건이 어떻게 되나요",
  "근무 태만 시 징계 기준이 무엇인가요"
];

export function RagEvaluationDashboard({
  documentId,
  attachmentId,
  embeddingProfileId,
}: Props) {
  const toast = useToast();

  const [evaluations, setEvaluations] = useState<RagEvaluationRunResponse[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [selectedRunDetail, setSelectedRunDetail] = useState<RagEvaluationRunResponse | null>(null);

  // Attachment comparison states
  const [baselineAttachmentId, setBaselineAttachmentId] = useState<number | string>(attachmentId);
  const [candidateAttachmentId, setCandidateAttachmentId] = useState<number | string>("");
  const [baselineRun, setBaselineRun] = useState<RagEvaluationRunResponse | null>(null);
  const [candidateRun, setCandidateRun] = useState<RagEvaluationRunResponse | null>(null);
  const [isDualLoading, setIsDualLoading] = useState(false);

  // Compare states
  const [beforeRunId, setBeforeRunId] = useState<string>("");
  const [afterRunId, setAfterRunId] = useState<string>("");
  const [compareResult, setCompareResult] = useState<RagEvaluationCompareResponse | null>(null);

  // Form states
  const [queriesInput, setQueriesInput] = useState<string>(PRESET_QUERIES_FAST.join("\n"));
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>(["structure", "ideaBlock", "hybrid"]);
  const [topK, setTopK] = useState<number>(5);
  const [minScore, setMinScore] = useState<number>(0.2);
  const [distilledBoost, setDistilledBoost] = useState<number>(0.05);

  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  // Async Job states
  const [activeJob, setActiveJob] = useState<RagEvaluationJobResponse | null>(null);
  const [jobPollingError, setJobPollingError] = useState<string | null>(null);

  // Detail strategy selection
  const [activeDetailStrategy, setActiveDetailStrategy] = useState<string>("hybrid");

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const list = await reactMarkdownDocumentApi.getEvaluations();
      // filter history by current objectId
      const filtered = list.filter((run) => String(run.objectId) === String(attachmentId));
      setEvaluations(filtered);
    } catch (err: any) {
      handleHttpError(err, "이력 조회");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (attachmentId) {
      void loadHistory();
    }
  }, [attachmentId]);

  // Dynamic polling effect for the evaluation job
  useEffect(() => {
    if (!activeJob || activeJob.status === "COMPLETED" || activeJob.status === "FAILED") {
      return;
    }

    let active = true;
    let accumulatedTime = 0;
    let currentInterval = 2000; // 2 seconds initially
    let timerId: NodeJS.Timeout;

    const poll = async () => {
      try {
        const statusRes = await reactMarkdownDocumentApi.getEvaluationJobStatus(activeJob.jobId);
        if (!active) return;

        setActiveJob(statusRes);

        if (statusRes.status === "COMPLETED") {
          setIsCreating(false);
          toast.success("비동기 RAG 평가 작업이 정상 완료되었습니다!");
          if (statusRes.runId) {
            setSelectedRunId(statusRes.runId);
            void handleViewDetail(statusRes.runId);
          }
          void loadHistory();
          return;
        }

        if (statusRes.status === "FAILED") {
          setIsCreating(false);
          setJobPollingError(statusRes.errorMessage || "평가 작업 진행 도중 서버에서 실패했습니다.");
          return;
        }

        // Adjust interval dynamically after 30 seconds
        accumulatedTime += currentInterval;
        if (accumulatedTime >= 30000 && currentInterval === 2000) {
          currentInterval = 5000; // Switch to 5 seconds
          toast.info("정밀 평가가 장시간 진행 중이므로, 갱신 주기를 5초로 늘려 진행률을 추적합니다.");
        }

        // Schedule next poll
        timerId = setTimeout(poll, currentInterval);
      } catch (err: any) {
        console.error("Job status polling error:", err);
        // Continue scheduling next poll in case of temporary network glitches
        timerId = setTimeout(poll, currentInterval);
      }
    };

    // Schedule initial poll
    timerId = setTimeout(poll, currentInterval);

    return () => {
      active = false;
      clearTimeout(timerId);
    };
  }, [activeJob?.jobId]);

  const handleHttpError = (err: any, actionName: string) => {
    const status = err?.response?.status ?? err?.status;
    const msg = err?.response?.data?.message || err?.message || "";

    if (status === 401) {
      toast.error("로그인이 만료되었습니다. 다시 로그인 해 주세요.");
    } else if (status === 403) {
      toast.error(`권한 오류: RAG 평가를 위한 services:ai_rag read 권한이 부족합니다.`);
    } else if (status === 404) {
      toast.error("요청하신 평가 run 데이터를 찾을 수 없습니다. 목록을 다시 조회합니다.");
      void loadHistory();
    } else {
      toast.error(`${actionName} 중 오류가 발생했습니다: ${msg}`);
    }
  };

  const handleApplyPreset = (type: "fast" | "boost") => {
    if (type === "fast") {
      setSelectedStrategies(["structure", "ideaBlock", "hybrid"]);
      setTopK(5);
      setMinScore(0.2);
      setDistilledBoost(0.05);
      setQueriesInput(PRESET_QUERIES_FAST.join("\n"));
      toast.success("빠른 비교 Preset이 설정되었습니다.");
    } else {
      setSelectedStrategies(["hybrid"]);
      setTopK(5);
      setMinScore(0.2);
      setDistilledBoost(0.05);
      setQueriesInput(PRESET_QUERIES_BOOST.join("\n"));
      toast.success("Boost 실험 Preset이 설정되었습니다.");
    }
  };

  const handleCreateEvaluation = async () => {
    const questions = queriesInput
      .split("\n")
      .map((q) => q.trim())
      .filter(Boolean)
      .map((q) => ({ query: q }));

    if (questions.length === 0) {
      toast.warning("최소 한 개 이상의 질문을 입력하세요.");
      return;
    }

    // Determine whether to use sync or async job API
    const useJobApi = questions.length >= 10 || selectedStrategies.length >= 2;

    setIsCreating(true);
    setJobPollingError(null);
    setActiveJob(null);

    const requestPayload = {
      strategies: selectedStrategies,
      objectType: "attachment",
      objectId: String(attachmentId),
      embeddingProfileId: embeddingProfileId || "retrieval-ko-kure",
      topK,
      minScore,
      retrievalOptions: {
        structureTopK: topK,
        ideaBlockTopK: topK,
        finalTopK: topK,
        dedupe: true,
        distilledScoreBoost: distilledBoost,
      },
      questions,
    };

    if (useJobApi) {
      // Async Job API
      try {
        const job = await reactMarkdownDocumentApi.createEvaluationJob(requestPayload);
        setActiveJob(job);
        toast.info("평가 문항/전략이 대량으로 검출되어 비동기 Job으로 백그라운드 평가를 시작합니다.");
      } catch (err: any) {
        console.error(err);
        handleHttpError(err, "평가 Job 생성");
        setIsCreating(false);
      }
    } else {
      // Sync API
      try {
        const res = await reactMarkdownDocumentApi.createEvaluation(requestPayload);
        toast.success("RAG 평가 실행이 정상 완료되었습니다.");
        await loadHistory();
        setSelectedRunId(res.runId);
        void handleViewDetail(res.runId);
        setIsCreating(false);
      } catch (err: any) {
        console.error(err);
        handleHttpError(err, "평가 실행");
        setIsCreating(false);
      }
    }
  };

  const handleViewDetail = async (runId: string) => {
    if (!runId) return;
    setIsDetailLoading(true);
    try {
      const res = await reactMarkdownDocumentApi.getEvaluationDetail(runId);
      setSelectedRunDetail(res);
      if (res.strategies && res.strategies.length > 0) {
        setActiveDetailStrategy(res.strategies[0].strategy);
      }
    } catch (err: any) {
      console.error(err);
      handleHttpError(err, "상세 조회");
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!beforeRunId || !afterRunId) {
      toast.warning("비교할 Before와 After 평가 이력을 선택하세요.");
      return;
    }
    setIsComparing(true);
    try {
      const res = await reactMarkdownDocumentApi.compareEvaluations({
        beforeRunId,
        afterRunId,
      });
      setCompareResult(res);
    } catch (err: any) {
      console.error(err);
      handleHttpError(err, "델타 비교");
    } finally {
      setIsComparing(false);
    }
  };

  const handleFetchDualAttachmentRuns = async () => {
    if (!baselineAttachmentId || !candidateAttachmentId) {
      toast.warning("비교할 Baseline 및 Candidate Attachment ID를 모두 입력하세요.");
      return;
    }
    setIsDualLoading(true);
    setBaselineRun(null);
    setCandidateRun(null);
    try {
      const list = await reactMarkdownDocumentApi.getEvaluations();
      const baseRuns = list
        .filter((r) => String(r.objectId) === String(baselineAttachmentId))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const candRuns = list
        .filter((r) => String(r.objectId) === String(candidateAttachmentId))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (baseRuns.length === 0) {
        toast.warning(`Baseline Attachment (ID: ${baselineAttachmentId})의 최근 평가 이력이 없습니다.`);
      } else {
        const detail = await reactMarkdownDocumentApi.getEvaluationDetail(baseRuns[0].runId);
        setBaselineRun(detail);
      }

      if (candRuns.length === 0) {
        toast.warning(`Candidate Attachment (ID: ${candidateAttachmentId})의 최근 평가 이력이 없습니다.`);
      } else {
        const detail = await reactMarkdownDocumentApi.getEvaluationDetail(candRuns[0].runId);
        setCandidateRun(detail);
      }
      toast.success("이중 Attachment 대조군 데이터를 로드했습니다.");
    } catch (err: any) {
      console.error(err);
      handleHttpError(err, "대조 이력 로드");
    } finally {
      setIsDualLoading(false);
    }
  };

  const renderDeltaMetric = (val: number, isMs = false) => {
    if (val === undefined || isNaN(val)) return "-";
    const color = val > 0 ? (isMs ? "error.main" : "success.main") : val < 0 ? (isMs ? "success.main" : "error.main") : "text.secondary";
    const sign = val > 0 ? "+" : "";
    const label = isMs ? `${sign}${val.toFixed(0)}ms` : `${sign}${(val * 100).toFixed(1)}%`;
    const Icon = val > 0 ? (isMs ? TrendingDown : TrendingUp) : val < 0 ? (isMs ? TrendingUp : TrendingDown) : CheckCircleOutline;

    return (
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color, fontWeight: 600, fontSize: 11 }}>
        <Icon sx={{ fontSize: 14 }} />
        <span>{label}</span>
      </Stack>
    );
  };

  const getActiveDetailQuestions = () => {
    if (!selectedRunDetail) return [];
    const stratMatch = selectedRunDetail.strategies.find((s) => s.strategy === activeDetailStrategy);
    return stratMatch ? stratMatch.questions : [];
  };

  return (
    <Stack spacing={2} sx={{ py: 1 }}>
      {/* Preset Control Panel */}
      <Card variant="outlined" sx={{ borderLeft: "4px solid", borderLeftColor: "primary.main" }}>
        <CardContent sx={{ p: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>RAG 평가 질문 프리셋</Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" size="small" onClick={() => handleApplyPreset("fast")} sx={{ fontSize: 12, height: 28 }}>
                빠른 비교 Preset (5문항)
              </Button>
              <Button variant="outlined" size="small" color="secondary" onClick={() => handleApplyPreset("boost")} sx={{ fontSize: 12, height: 28 }}>
                Boost 실험 Preset (3문항)
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* 1. Evaluation Run Section */}
      <Card variant="outlined">
        <CardContent sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, display: "block", mb: 1 }}>
            새 RAG 검색 성능 평가 실행
          </Typography>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="평가 질문 목록 (엔터로 구분)"
                multiline
                rows={4}
                fullWidth
                value={queriesInput}
                onChange={(e) => setQueriesInput(e.target.value)}
                variant="outlined"
                sx={{ "& .MuiInputBase-root": { fontSize: 13 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={2}>
                  {["structure", "ideaBlock", "hybrid"].map((strategy) => (
                    <FormControlLabel
                      key={strategy}
                      control={
                        <Checkbox
                          size="small"
                          checked={selectedStrategies.includes(strategy)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStrategies([...selectedStrategies, strategy]);
                            } else {
                              setSelectedStrategies(selectedStrategies.filter((s) => s !== strategy));
                            }
                          }}
                        />
                      }
                      label={<Typography variant="body2">{strategy}</Typography>}
                    />
                  ))}
                </Stack>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Top K"
                    type="number"
                    size="small"
                    value={topK}
                    onChange={(e) => setTopK(Number(e.target.value))}
                    sx={{ "& .MuiInputBase-root": { fontSize: 13 } }}
                  />
                  <TextField
                    label="Min Score"
                    type="number"
                    size="small"
                    value={minScore}
                    onChange={(e) => setMinScore(Number(e.target.value))}
                    inputProps={{ step: 0.1 }}
                    sx={{ "& .MuiInputBase-root": { fontSize: 13 } }}
                  />
                  <TextField
                    label="Boost"
                    type="number"
                    size="small"
                    value={distilledBoost}
                    onChange={(e) => setDistilledBoost(Number(e.target.value))}
                    inputProps={{ step: 0.01 }}
                    sx={{ "& .MuiInputBase-root": { fontSize: 13 } }}
                  />
                </Stack>

                {/* Loading state and Progress feedback */}
                {isCreating && activeJob && (
                  <Box sx={{ p: 1, bgcolor: "action.hover", borderRadius: 1, border: "1px dashed", borderColor: "primary.main" }}>
                    <Stack spacing={0.5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={10} />
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>RAG 백그라운드 평가 진행률 ({activeJob.status})</Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        평가 상태: {activeJob.completedQuestions} / {activeJob.totalQuestions} 문항 완료 (전략: {activeJob.currentStrategy || "-"})
                      </Typography>
                      {activeJob.currentQuestion && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic", fontSize: 9.5 }}>
                          현재 검증 중: "{activeJob.currentQuestion}"
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                )}

                {isCreating && !activeJob && (
                  <Alert severity="info" sx={{ fontSize: 9.5, py: 0.2 }}>
                    RAG 검색 및 동기식 성능 검증 중입니다...
                  </Alert>
                )}

                {jobPollingError && (
                  <Alert severity="error" sx={{ fontSize: 10, py: 0.5 }}>
                    <Typography variant="caption" display="block" sx={{ fontWeight: 600 }}>비동기 평가 진행 실패</Typography>
                    <Typography variant="caption" display="block">{jobPollingError}</Typography>
                    <Button variant="outlined" color="error" size="small" onClick={handleCreateEvaluation} sx={{ fontSize: 9, py: 0.1, mt: 0.5 }}>
                      동일 조건으로 평가 재실행
                    </Button>
                  </Alert>
                )}

                <Button
                  variant="contained"
                  size="small"
                  onClick={handleCreateEvaluation}
                  disabled={isCreating}
                  startIcon={isCreating ? <CircularProgress size={12} color="inherit" /> : <PlayArrowOutlined />}
                  sx={{ fontSize: 13, py: 1 }}
                >
                  평가 실행 및 이력 저장
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 2. Baseline vs Candidate Attachment Comparison Card */}
      <Card variant="outlined" sx={{ bgcolor: "action.hover" }}>
        <CardContent sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, display: "block", mb: 1 }}>
            이중 Attachment 대조군 비교 (Baseline vs Candidate)
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
            <TextField
              label="Baseline Attachment ID"
              size="small"
              type="number"
              value={baselineAttachmentId}
              onChange={(e) => setBaselineAttachmentId(e.target.value)}
              sx={{ "& .MuiInputBase-root": { fontSize: 13, bgcolor: "background.paper" }, flex: 1 }}
            />
            <Typography variant="body2" color="text.secondary">vs</Typography>
            <TextField
              label="Candidate Attachment ID"
              size="small"
              type="number"
              value={candidateAttachmentId}
              onChange={(e) => setCandidateAttachmentId(e.target.value)}
              sx={{ "& .MuiInputBase-root": { fontSize: 13, bgcolor: "background.paper" }, flex: 1 }}
            />
            <Button
              variant="contained"
              size="small"
              color="secondary"
              disabled={isDualLoading || !baselineAttachmentId || !candidateAttachmentId}
              onClick={handleFetchDualAttachmentRuns}
              sx={{ height: 36, fontSize: 13 }}
            >
              대조 비교 실행
            </Button>
          </Stack>

          {isDualLoading && <CircularProgress size={20} sx={{ display: "block", mx: "auto", my: 2 }} />}

          {(baselineRun || candidateRun) && (
            <Grid container spacing={2}>
              {/* Baseline column */}
              <Grid size={{ xs: 12, sm: 6 }}>
                <Card variant="outlined">
                  <CardContent sx={{ p: 1 }}>
                    <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600 }}>
                      Baseline (ID: {baselineAttachmentId}) {baselineRun ? `[Run: ${baselineRun.runId.substring(0, 8)}]` : "이력 없음"}
                    </Typography>
                    {baselineRun && (
                      <Table size="small" sx={{ mt: 1 }}>
                        <TableBody>
                          {baselineRun.strategies.map((s) => (
                            <TableRow key={s.strategy}>
                              <TableCell sx={{ fontSize: 13, p: 0.5, fontWeight: 500 }}>{s.strategy}</TableCell>
                              <TableCell sx={{ fontSize: 13, p: 0.5 }}>Hit@K: {(s.hitRate * 100).toFixed(0)}%</TableCell>
                              <TableCell sx={{ fontSize: 13, p: 0.5 }}>MRR: {s.mrr.toFixed(3)}</TableCell>
                              <TableCell sx={{ fontSize: 13, p: 0.5, textAlign: "right" }}>{s.averageElapsedMs.toFixed(0)}ms</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Candidate column */}
              <Grid size={{ xs: 12, sm: 6 }}>
                <Card variant="outlined">
                  <CardContent sx={{ p: 1 }}>
                    <Typography variant="body2" color="secondary.main" sx={{ fontWeight: 600 }}>
                      Candidate (ID: {candidateAttachmentId}) {candidateRun ? `[Run: ${candidateRun.runId.substring(0, 8)}]` : "이력 없음"}
                    </Typography>
                    {candidateRun && (
                      <Table size="small" sx={{ mt: 1 }}>
                        <TableBody>
                          {candidateRun.strategies.map((s) => (
                            <TableRow key={s.strategy}>
                              <TableCell sx={{ fontSize: 13, p: 0.5, fontWeight: 500 }}>{s.strategy}</TableCell>
                              <TableCell sx={{ fontSize: 13, p: 0.5 }}>Hit@K: {(s.hitRate * 100).toFixed(0)}%</TableCell>
                              <TableCell sx={{ fontSize: 13, p: 0.5 }}>MRR: {s.mrr.toFixed(3)}</TableCell>
                              <TableCell sx={{ fontSize: 13, p: 0.5, textAlign: "right" }}>{s.averageElapsedMs.toFixed(0)}ms</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* 3. Run History & Metric Comparison */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent sx={{ p: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, display: "block", mb: 1 }}>
                평가 실행 이력 ({evaluations.length}건)
              </Typography>
              {isLoading ? (
                <CircularProgress size={20} sx={{ my: 2, display: "block", mx: "auto" }} />
              ) : evaluations.length === 0 ? (
                <Typography variant="body2" color="text.secondary">이력이 없습니다.</Typography>
              ) : (
                <TableContainer>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontSize: 13, py: 0.5 }}>Run ID</TableCell>
                        <TableCell sx={{ fontSize: 13, py: 0.5 }}>시각</TableCell>
                        <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "right" }}>작업</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {evaluations.map((run) => (
                        <TableRow key={run.runId} hover selected={selectedRunId === run.runId}>
                          <TableCell sx={{ fontSize: 13, py: 0.5 }}>{run.runId.substring(0, 8)}...</TableCell>
                          <TableCell sx={{ fontSize: 13, py: 0.5 }}>{new Date(run.createdAt).toLocaleString("ko-KR", { hour12: false })}</TableCell>
                          <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "right" }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                setSelectedRunId(run.runId);
                                void handleViewDetail(run.runId);
                              }}
                              sx={{ fontSize: 12, py: 0.3, px: 0.75 }}
                            >
                              상세
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 7 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent sx={{ p: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, display: "block", mb: 1 }}>
                선택된 Run 상세 메트릭 ({selectedRunId || "선택 없음"})
              </Typography>
              {isDetailLoading ? (
                <CircularProgress size={20} sx={{ my: 2, display: "block", mx: "auto" }} />
              ) : !selectedRunDetail ? (
                <Typography variant="body2" color="text.secondary">좌측 리스트에서 상세를 조회해 주세요.</Typography>
              ) : (
                <Stack spacing={1}>
                  <Typography variant="body2" color="text.secondary" display="block">
                    Embedding Profile: {selectedRunDetail.embeddingProfileId} | TopK: {selectedRunDetail.topK} | MinScore: {selectedRunDetail.minScore}
                  </Typography>

                  {/* Strategy Summary Table (Strategy, Questions, Hit, Hit@K, MRR, Avg ms) */}
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: "action.hover" }}>
                          <TableCell sx={{ fontSize: 13, py: 0.5, fontWeight: 600 }}>Strategy</TableCell>
                          <TableCell sx={{ fontSize: 13, py: 0.5, fontWeight: 600, textAlign: "center" }}>Questions</TableCell>
                          <TableCell sx={{ fontSize: 13, py: 0.5, fontWeight: 600, textAlign: "center" }}>Hit</TableCell>
                          <TableCell sx={{ fontSize: 13, py: 0.5, fontWeight: 600, textAlign: "center" }}>Hit@K</TableCell>
                          <TableCell sx={{ fontSize: 13, py: 0.5, fontWeight: 600, textAlign: "center" }}>MRR</TableCell>
                          <TableCell sx={{ fontSize: 13, py: 0.5, fontWeight: 600, textAlign: "center" }}>Avg ms</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedRunDetail.strategies.map((s) => (
                          <TableRow key={s.strategy} hover selected={activeDetailStrategy === s.strategy} onClick={() => setActiveDetailStrategy(s.strategy)} sx={{ cursor: "pointer" }}>
                            <TableCell sx={{ fontSize: 13, py: 0.5, fontWeight: 500 }}>{s.strategy}</TableCell>
                            <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "center" }}>{s.questionCount}</TableCell>
                            <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "center" }}>{s.hitCount}</TableCell>
                            <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "center" }}>{(s.hitRate * 100).toFixed(0)}%</TableCell>
                            <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "center" }}>{s.mrr.toFixed(3)}</TableCell>
                            <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "center" }}>{s.averageElapsedMs.toFixed(0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Active Strategy Details (Questions breakdown) */}
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, display: "block" }}>
                      전략 질문 상세 분석 ({activeDetailStrategy})
                    </Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead sx={{ bgcolor: "action.hover" }}>
                          <TableRow>
                            <TableCell sx={{ fontSize: 13, py: 0.5 }}>Query</TableCell>
                            <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "center" }}>Hit</TableCell>
                            <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "center" }}>First Rank</TableCell>
                            <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "center" }}>Result Count</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {getActiveDetailQuestions().map((q, idx) => (
                            <QuestionRow key={idx} question={q} strategy={activeDetailStrategy} />
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 4. Before/After Delta Compare */}
      <Card variant="outlined">
        <CardContent sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, display: "block", mb: 1 }}>
            병합 전후 RAG 검색 성능 대조 (Delta Compare)
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <Select
              size="small"
              value={beforeRunId}
              onChange={(e) => setBeforeRunId(e.target.value)}
              displayEmpty
              sx={{ fontSize: 13, flex: 1 }}
            >
              <MenuItem value="">Before Run 선택 (병합 전)</MenuItem>
              {evaluations.map((run) => (
                <MenuItem key={run.runId} value={run.runId} sx={{ fontSize: 13 }}>
                  {run.runId.substring(0, 8)}... ({new Date(run.createdAt).toLocaleTimeString()})
                </MenuItem>
              ))}
            </Select>

            <CompareArrowsOutlined sx={{ color: "text.secondary" }} />

            <Select
              size="small"
              value={afterRunId}
              onChange={(e) => setAfterRunId(e.target.value)}
              displayEmpty
              sx={{ fontSize: 13, flex: 1 }}
            >
              <MenuItem value="">After Run 선택 (병합 후)</MenuItem>
              {evaluations.map((run) => (
                <MenuItem key={run.runId} value={run.runId} sx={{ fontSize: 13 }}>
                  {run.runId.substring(0, 8)}... ({new Date(run.createdAt).toLocaleTimeString()})
                </MenuItem>
              ))}
            </Select>

            <Button
              variant="contained"
              size="small"
              onClick={handleCompare}
              disabled={isComparing || !beforeRunId || !afterRunId}
              sx={{ fontSize: 13, py: 0.5 }}
            >
              {isComparing ? <CircularProgress size={12} color="inherit" /> : "Delta 비교 실행"}
            </Button>
          </Stack>

          {compareResult && (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell sx={{ fontSize: 13, py: 0.5, fontWeight: 600 }}>RAG 전략</TableCell>
                    <TableCell sx={{ fontSize: 13, py: 0.5, fontWeight: 600, textAlign: "center" }}>Before HitRate</TableCell>
                    <TableCell sx={{ fontSize: 13, py: 0.5, fontWeight: 600, textAlign: "center" }}>After HitRate</TableCell>
                    <TableCell sx={{ fontSize: 13, py: 0.5, fontWeight: 600, textAlign: "center" }}>HitRate Delta</TableCell>
                    <TableCell sx={{ fontSize: 13, py: 0.5, fontWeight: 600, textAlign: "center" }}>Before MRR</TableCell>
                    <TableCell sx={{ fontSize: 13, py: 0.5, fontWeight: 600, textAlign: "center" }}>After MRR</TableCell>
                    <TableCell sx={{ fontSize: 13, py: 0.5, fontWeight: 600, textAlign: "center" }}>MRR Delta</TableCell>
                    <TableCell sx={{ fontSize: 13, py: 0.5, fontWeight: 600, textAlign: "center" }}>Before Avg ms</TableCell>
                    <TableCell sx={{ fontSize: 13, py: 0.5, fontWeight: 600, textAlign: "center" }}>After Avg ms</TableCell>
                    <TableCell sx={{ fontSize: 13, py: 0.5, fontWeight: 600, textAlign: "center" }}>Avg ms Delta</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {compareResult.strategies.map((s) => (
                    <TableRow key={s.strategy} hover>
                      <TableCell sx={{ fontSize: 13, py: 0.5, fontWeight: 500 }}>{s.strategy}</TableCell>
                      <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "center" }}>{(s.beforeHitRate * 100).toFixed(0)}%</TableCell>
                      <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "center" }}>{(s.afterHitRate * 100).toFixed(0)}%</TableCell>
                      <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "center" }}>
                        {renderDeltaMetric(s.hitRateDelta)}
                      </TableCell>
                      <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "center" }}>{s.beforeMrr.toFixed(3)}</TableCell>
                      <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "center" }}>{s.afterMrr.toFixed(3)}</TableCell>
                      <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "center" }}>
                        {renderDeltaMetric(s.mrrDelta)}
                      </TableCell>
                      <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "center" }}>{s.beforeAverageElapsedMs.toFixed(0)}ms</TableCell>
                      <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "center" }}>{s.afterAverageElapsedMs.toFixed(0)}ms</TableCell>
                      <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "center" }}>
                        {renderDeltaMetric(s.averageElapsedMsDelta, true)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

function QuestionRow({ question, strategy }: { question: any; strategy: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow hover onClick={() => setOpen(!open)} sx={{ cursor: "pointer" }}>
        <TableCell sx={{ fontSize: 13, py: 0.5 }}>{question.query}</TableCell>
        <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "center", color: question.hit ? "success.main" : "error.main", fontWeight: 600 }}>
          {String(question.hit)}
        </TableCell>
        <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "center" }}>{question.firstRank ?? "-"}</TableCell>
        <TableCell sx={{ fontSize: 13, py: 0.5, textAlign: "center" }}>{question.resultCount}</TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={4} sx={{ bgcolor: "action.hover", p: 1 }}>
            <Box sx={{ pl: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, display: "block", mb: 0.5 }}>
                검색된 결과 청크 리스트 (Metadata 포함)
              </Typography>
              {(!question.chunks || question.chunks.length === 0) ? (
                <Typography variant="body2" color="text.secondary">반환된 청크가 없습니다.</Typography>
              ) : (
                <Stack spacing={0.5}>
                  {question.chunks.map((c: any, index: number) => {
                    const meta = c.metadata || {};
                    return (
                      <Box key={index} sx={{ borderBottom: "1px dashed", borderColor: "divider", pb: 0.5, mb: 0.5 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip label={`Rank ${index + 1}`} size="small" sx={{ height: 18, fontSize: 10 }} />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {c.chunkId}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            (Score: {c.score?.toFixed(3)})
                          </Typography>
                          {meta.ideaBlockDistilled && (
                            <Chip label="🌟 Distilled" size="small" color="primary" sx={{ height: 16, fontSize: 10 }} />
                          )}
                        </Stack>
                        <Typography variant="body2" color="text.secondary" display="block" sx={{ fontSize: 12, mt: 0.5, whiteSpace: "pre-wrap", bgcolor: "background.paper", p: 0.5, borderRadius: 0.5 }}>
                          {c.text || "(텍스트 본문 없음)"}
                        </Typography>
                        {/* Metadata grid */}
                        <Grid container spacing={0.5} sx={{ mt: 0.5 }}>
                          <Grid size={{ xs: 6, sm: 4 }}>
                            <Typography variant="caption" sx={{ fontSize: 11, color: "text.disabled" }}>Strategy: {strategy}</Typography>
                          </Grid>
                          {meta.chunkType && (
                            <Grid size={{ xs: 6, sm: 4 }}>
                              <Typography variant="caption" sx={{ fontSize: 11, color: "text.disabled" }}>Type: {meta.chunkType}</Typography>
                            </Grid>
                          )}
                          {meta.actualChunkingStrategy && (
                            <Grid size={{ xs: 6, sm: 4 }}>
                              <Typography variant="caption" sx={{ fontSize: 11, color: "text.disabled" }}>Chunking: {meta.actualChunkingStrategy}</Typography>
                            </Grid>
                          )}
                          {meta.sectionTitle && (
                            <Grid size={{ xs: 6, sm: 4 }}>
                              <Typography variant="caption" sx={{ fontSize: 11, color: "text.disabled" }}>Section: {meta.sectionTitle}</Typography>
                            </Grid>
                          )}
                          {meta.markdownDocumentId && (
                            <Grid size={{ xs: 6, sm: 4 }}>
                              <Typography variant="caption" sx={{ fontSize: 11, color: "text.disabled" }}>DocID: {meta.markdownDocumentId.substring(0, 8)}...</Typography>
                            </Grid>
                          )}
                          {meta.markdownRevisionId && (
                            <Grid size={{ xs: 6, sm: 4 }}>
                              <Typography variant="caption" sx={{ fontSize: 11, color: "text.disabled" }}>RevID: {meta.markdownRevisionId.substring(0, 8)}...</Typography>
                            </Grid>
                          )}
                          {meta.ideaBlockDistillationFingerprint && (
                            <Grid size={{ xs: 12 }}>
                              <Typography variant="caption" sx={{ fontSize: 11, color: "text.disabled" }}>Fingerprint: {meta.ideaBlockDistillationFingerprint}</Typography>
                            </Grid>
                          )}
                        </Grid>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
