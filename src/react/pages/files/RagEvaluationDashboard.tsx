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
  Divider,
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
  type RagEvaluationDetailResponse,
  type RagEvaluationCompareResponse,
} from "./api";
import { useToast } from "@/react/feedback";

interface Props {
  documentId: string;
  attachmentId: number;
  embeddingProfileId?: string;
}

export function RagEvaluationDashboard({
  documentId,
  attachmentId,
  embeddingProfileId,
}: Props) {
  const toast = useToast();

  const [evaluations, setEvaluations] = useState<RagEvaluationRunResponse[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [selectedRunDetail, setSelectedRunDetail] = useState<RagEvaluationDetailResponse | null>(null);

  // Compare states
  const [beforeRunId, setBeforeRunId] = useState<string>("");
  const [afterRunId, setAfterRunId] = useState<string>("");
  const [compareResult, setCompareResult] = useState<RagEvaluationCompareResponse | null>(null);

  // Form states
  const [queriesInput, setQueriesInput] = useState<string>(
    "여름 휴가 규정이 있는가\n업무 인수인계 절차는 어떻게 되나요"
  );
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([
    "structure",
    "ideaBlock",
    "hybrid",
  ]);
  const [topK, setTopK] = useState<number>(5);
  const [minScore, setMinScore] = useState<number>(0.6);
  const [distilledBoost, setDistilledBoost] = useState<number>(0.05);

  const [isLoading, setIsLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const list = await reactMarkdownDocumentApi.getEvaluations();
      // filter history by current objectId (attachmentId)
      const filtered = list.filter((run) => String(run.objectId) === String(attachmentId));
      setEvaluations(filtered);
    } catch (err) {
      console.error("Failed to load evaluations history:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (attachmentId) {
      void loadHistory();
    }
  }, [attachmentId]);

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

    setIsCreating(true);
    try {
      const res = await reactMarkdownDocumentApi.createEvaluation({
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
      });

      toast.success("평가 프로세스가 생성 및 완료되었습니다.");
      await loadHistory();
      setSelectedRunId(res.runId);
      void handleViewDetail(res.runId);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || err?.message || "평가 생성 실패");
    } finally {
      setIsCreating(false);
    }
  };

  const handleViewDetail = async (runId: string) => {
    if (!runId) return;
    setIsDetailLoading(true);
    try {
      const res = await reactMarkdownDocumentApi.getEvaluationDetail(runId);
      setSelectedRunDetail(res);
    } catch (err: any) {
      console.error(err);
      toast.error("평가 상세를 불러오지 못했습니다.");
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
      toast.error("평가 성능 대조에 실패했습니다.");
    } finally {
      setIsComparing(false);
    }
  };

  const renderDelta = (val: number, isMs = false) => {
    if (val === undefined || isNaN(val)) return "-";
    const color = val > 0 ? (isMs ? "error.main" : "success.main") : val < 0 ? (isMs ? "success.main" : "error.main") : "text.secondary";
    const sign = val > 0 ? "+" : "";
    const label = isMs ? `${sign}${val.toFixed(1)}ms` : `${sign}${(val * 100).toFixed(1)}%`;
    const Icon = val > 0 ? (isMs ? TrendingDown : TrendingUp) : val < 0 ? (isMs ? TrendingUp : TrendingDown) : CheckCircleOutline;

    return (
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color, fontWeight: 600, fontSize: 11 }}>
        <Icon sx={{ fontSize: 14 }} />
        <span>{label}</span>
      </Stack>
    );
  };

  return (
    <Stack spacing={2} sx={{ py: 1 }}>
      {/* 1. Evaluation Run Section */}
      <Card variant="outlined">
        <CardContent sx={{ p: 1.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 1 }}>
            새 RAG 검색 성능 평가 실행
          </Typography>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="평가 질문 목록 (엔터로 구분)"
                multiline
                rows={3}
                fullWidth
                value={queriesInput}
                onChange={(e) => setQueriesInput(e.target.value)}
                variant="outlined"
                sx={{ "& .MuiInputBase-root": { fontSize: 11 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack spacing={1}>
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
                      label={<Typography variant="caption">{strategy}</Typography>}
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
                    sx={{ "& .MuiInputBase-root": { fontSize: 11 } }}
                  />
                  <TextField
                    label="Min Score"
                    type="number"
                    size="small"
                    value={minScore}
                    onChange={(e) => setMinScore(Number(e.target.value))}
                    inputProps={{ step: 0.1 }}
                    sx={{ "& .MuiInputBase-root": { fontSize: 11 } }}
                  />
                  <TextField
                    label="Boost"
                    type="number"
                    size="small"
                    value={distilledBoost}
                    onChange={(e) => setDistilledBoost(Number(e.target.value))}
                    inputProps={{ step: 0.01 }}
                    sx={{ "& .MuiInputBase-root": { fontSize: 11 } }}
                  />
                </Stack>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleCreateEvaluation}
                  disabled={isCreating}
                  startIcon={isCreating ? <CircularProgress size={12} color="inherit" /> : <PlayArrowOutlined />}
                  sx={{ fontSize: 10.5, py: 0.5 }}
                >
                  평가 실행 및 이력 저장
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 2. Run History & Metric Comparison */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card variant="outlined" sx={{ height: "100%" }}>
            <CardContent sx={{ p: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 1 }}>
                평가 실행 이력 ({evaluations.length}건)
              </Typography>
              {isLoading ? (
                <CircularProgress size={20} sx={{ my: 2, display: "block", mx: "auto" }} />
              ) : evaluations.length === 0 ? (
                <Typography variant="caption" color="text.secondary">이력이 없습니다.</Typography>
              ) : (
                <TableContainer sx={{ maxHeight: 200 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontSize: 10, py: 0.5 }}>Run ID</TableCell>
                        <TableCell sx={{ fontSize: 10, py: 0.5 }}>시각</TableCell>
                        <TableCell sx={{ fontSize: 10, py: 0.5, textAlign: "right" }}>작업</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {evaluations.map((run) => (
                        <TableRow key={run.runId} hover selected={selectedRunId === run.runId}>
                          <TableCell sx={{ fontSize: 9.5, py: 0.5, fontFamily: "monospace" }}>{run.runId.substring(0, 8)}...</TableCell>
                          <TableCell sx={{ fontSize: 9.5, py: 0.5 }}>{new Date(run.createdAt).toLocaleString("ko-KR", { hour12: false })}</TableCell>
                          <TableCell sx={{ fontSize: 9.5, py: 0.5, textAlign: "right" }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                setSelectedRunId(run.runId);
                                void handleViewDetail(run.runId);
                              }}
                              sx={{ fontSize: 8.5, py: 0.1, px: 0.5 }}
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
              <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 1 }}>
                선택된 Run 상세 메트릭 ({selectedRunId || "선택 없음"})
              </Typography>
              {isDetailLoading ? (
                <CircularProgress size={20} sx={{ my: 2, display: "block", mx: "auto" }} />
              ) : !selectedRunDetail ? (
                <Typography variant="caption" color="text.secondary">좌측 리스트에서 상세를 조회해 주세요.</Typography>
              ) : (
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Embedding Profile: {selectedRunDetail.embeddingProfileId} | TopK: {selectedRunDetail.topK} | MinScore: {selectedRunDetail.minScore}
                  </Typography>

                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: "action.hover" }}>
                          <TableCell sx={{ fontSize: 10, py: 0.5, fontWeight: 600 }}>RAG 전략</TableCell>
                          <TableCell sx={{ fontSize: 10, py: 0.5, fontWeight: 600, textAlign: "center" }}>Hit Rate</TableCell>
                          <TableCell sx={{ fontSize: 10, py: 0.5, fontWeight: 600, textAlign: "center" }}>MRR</TableCell>
                          <TableCell sx={{ fontSize: 10, py: 0.5, fontWeight: 600, textAlign: "center" }}>평균 속도</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedRunDetail.strategies.map((strategy) => {
                          const metric = selectedRunDetail.strategyResults?.[strategy] || {
                            hitRate: 0,
                            mrr: 0,
                            averageElapsedMs: 0,
                          };
                          return (
                            <TableRow key={strategy} hover>
                              <TableCell sx={{ fontSize: 10, py: 0.5, fontWeight: 500 }}>{strategy}</TableCell>
                              <TableCell sx={{ fontSize: 10, py: 0.5, textAlign: "center" }}>{(metric.hitRate * 100).toFixed(1)}%</TableCell>
                              <TableCell sx={{ fontSize: 10, py: 0.5, textAlign: "center" }}>{metric.mrr.toFixed(3)}</TableCell>
                              <TableCell sx={{ fontSize: 10, py: 0.5, textAlign: "center" }}>{metric.averageElapsedMs.toFixed(1)}ms</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Distilled Impact Info */}
                  <Box sx={{ bgcolor: "action.hover", p: 1, borderRadius: 1, border: "1px dashed", borderColor: "divider" }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, display: "block" }}>Distilled Boost Impact</Typography>
                    <Typography variant="caption" color="text.secondary">
                      IdeaBlock 병합 적용 결과(`ideaBlockDistilled=true`)가 검색 시 최상위 랭킹에 안착하도록 Score Boost 가산 정렬이 수행되었습니다.
                    </Typography>
                  </Box>
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 3. Before/After Delta Compare */}
      <Card variant="outlined">
        <CardContent sx={{ p: 1.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 1 }}>
            병합 전후 RAG 검색 성능 대조 (Delta Compare)
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <Select
              size="small"
              value={beforeRunId}
              onChange={(e) => setBeforeRunId(e.target.value)}
              displayEmpty
              sx={{ fontSize: 11, flex: 1 }}
            >
              <MenuItem value="">Before Run 선택</MenuItem>
              {evaluations.map((run) => (
                <MenuItem key={run.runId} value={run.runId} sx={{ fontSize: 11 }}>
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
              sx={{ fontSize: 11, flex: 1 }}
            >
              <MenuItem value="">After Run 선택</MenuItem>
              {evaluations.map((run) => (
                <MenuItem key={run.runId} value={run.runId} sx={{ fontSize: 11 }}>
                  {run.runId.substring(0, 8)}... ({new Date(run.createdAt).toLocaleTimeString()})
                </MenuItem>
              ))}
            </Select>

            <Button
              variant="contained"
              size="small"
              onClick={handleCompare}
              disabled={isComparing || !beforeRunId || !afterRunId}
              sx={{ fontSize: 10.5, py: 0.5 }}
            >
              {isComparing ? <CircularProgress size={12} color="inherit" /> : "Delta 비교 실행"}
            </Button>
          </Stack>

          {compareResult && (
            <Stack spacing={1.5}>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "action.hover" }}>
                      <TableCell sx={{ fontSize: 10, py: 0.5, fontWeight: 600 }}>RAG 전략</TableCell>
                      <TableCell sx={{ fontSize: 10, py: 0.5, fontWeight: 600, textAlign: "center" }}>Hit Rate Delta</TableCell>
                      <TableCell sx={{ fontSize: 10, py: 0.5, fontWeight: 600, textAlign: "center" }}>MRR Delta</TableCell>
                      <TableCell sx={{ fontSize: 10, py: 0.5, fontWeight: 600, textAlign: "center" }}>평균 속도 Delta</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.keys(compareResult.hitRateDelta || {}).map((strategy) => (
                      <TableRow key={strategy} hover>
                        <TableCell sx={{ fontSize: 10, py: 0.5, fontWeight: 500 }}>{strategy}</TableCell>
                        <TableCell sx={{ fontSize: 10, py: 0.5, textAlign: "center" }}>
                          {renderDelta(compareResult.hitRateDelta[strategy])}
                        </TableCell>
                        <TableCell sx={{ fontSize: 10, py: 0.5, textAlign: "center" }}>
                          {renderDelta(compareResult.mrrDelta?.[strategy], false)}
                        </TableCell>
                        <TableCell sx={{ fontSize: 10, py: 0.5, textAlign: "center" }}>
                          {renderDelta(compareResult.averageElapsedMsDelta?.[strategy], true)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Alert / Details on degraded or hit-rate change */}
              <Typography variant="caption" sx={{ fontWeight: 600 }}>질문별 상세 분석</Typography>
              <Stack spacing={0.5}>
                {selectedRunDetail?.questionResults?.map((qRes, idx) => {
                  const hasDegraded = Object.keys(qRes.strategyHits).some((strat) => {
                    return qRes.strategyHits[strat] === false;
                  });
                  return (
                    <Accordion key={idx} disableGutters square elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 0.5 }}>
                      <AccordionSummary expandIcon={<ExpandMoreOutlined sx={{ fontSize: 14 }} />} sx={{ minHeight: 30, px: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 500 }}>Q: {qRes.query}</Typography>
                          {hasDegraded && (
                            <Chip label="일부 전략 실패" color="warning" size="small" variant="outlined" sx={{ height: 16, fontSize: 8 }} />
                          )}
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails sx={{ p: 1, bgcolor: "background.paper" }}>
                        <Grid container spacing={1}>
                          {Object.keys(qRes.strategyHits).map((strat) => (
                            <Grid size={{ xs: 12, sm: 4 }} key={strat}>
                              <Box sx={{ p: 0.5, border: "1px solid", borderColor: "divider", borderRadius: 0.5, bgcolor: "action.hover" }}>
                                <Typography variant="caption" sx={{ fontWeight: 600, display: "block" }}>{strat}</Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                  Hit: {qRes.strategyHits[strat] ? "YES" : "NO"} | Rank: {qRes.strategyRanks[strat] || "-"}
                                </Typography>
                                {qRes.strategyChunks[strat] && qRes.strategyChunks[strat].length > 0 && (
                                  <Box sx={{ mt: 0.5 }}>
                                    <Typography variant="caption" sx={{ fontSize: 8.5, fontWeight: 500, display: "block" }}>검색 Chunk ID:</Typography>
                                    {qRes.strategyChunks[strat].map((c) => (
                                      <Typography key={c.chunkId} variant="caption" color="text.secondary" display="block" sx={{ fontSize: 8, fontFamily: "monospace", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                                        {c.chunkId} ({c.score?.toFixed(3)}) {c.ideaBlockDistilled && "🌟[Distilled]"}
                                      </Typography>
                                    ))}
                                  </Box>
                                )}
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
              </Stack>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
