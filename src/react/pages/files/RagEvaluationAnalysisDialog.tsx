import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Stack,
  Chip,
  Button,
  Select,
  MenuItem,
  Divider,
} from "@mui/material";
import { CloseOutlined, DownloadOutlined, WarningAmberOutlined } from "@mui/icons-material";
import {
  reactMarkdownDocumentApi,
  type RagRetrievalEvaluationAnalysis,
  type RagStrategyAnalysis,
  type RagQuestionAnalysis,
} from "./api";
import { resolveAxiosError } from "@/utils/helpers";

interface Props {
  open: boolean;
  questionSetId: string;
  onClose: () => void;
}

export function RagEvaluationAnalysisDialog({ open, questionSetId, onClose }: Props) {
  const [analysis, setAnalysis] = useState<RagRetrievalEvaluationAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    if (!open || !questionSetId) return;

    let ignore = false;
    const fetchAnalysis = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await reactMarkdownDocumentApi.getEvaluationAnalysis(questionSetId);
        if (!ignore) {
          setAnalysis(data);
        }
      } catch (err: any) {
        if (!ignore) {
          const status = err?.response?.status ?? err?.status;
          if (status === 404) {
            setError("평가 질문 세트를 찾을 수 없습니다.");
          } else {
            setError("평가 분석 데이터를 불러오지 못했습니다: " + resolveAxiosError(err));
          }
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    void fetchAnalysis();
    return () => {
      ignore = true;
    };
  }, [open, questionSetId]);

  // Determine best strategy based on: Max hitRate -> Max mrr -> Min averageElapsedMs
  const bestStrategyName = useMemo(() => {
    if (!analysis || analysis.strategies.length === 0) return null;
    const sorted = [...analysis.strategies].sort((a, b) => {
      if (b.hitRate !== a.hitRate) return b.hitRate - a.hitRate;
      if (b.mrr !== a.mrr) return b.mrr - a.mrr;
      return a.averageElapsedMs - b.averageElapsedMs;
    });
    return sorted[0].strategy;
  }, [analysis]);

  // Filtering questions
  const filteredQuestions = useMemo(() => {
    if (!analysis) return [];
    let items = [...analysis.questions];

    if (filterType === "all_failed") {
      items = items.filter((q) => q.hitStrategies.length === 0);
    } else if (filterType === "ideablock_failed") {
      items = items.filter((q) => q.missedStrategies.includes("ideaBlock"));
    } else if (filterType === "hybrid_failed") {
      items = items.filter((q) => q.missedStrategies.includes("hybrid"));
    } else if (filterType === "structure_success_only") {
      items = items.filter(
        (q) => q.hitStrategies.includes("structure") && !q.hitStrategies.includes("ideaBlock")
      );
    }

    // Default Sorting: missedStrategies.length DESC -> bestRank ASC -> query ASC
    return items.sort((a, b) => {
      if (b.missedStrategies.length !== a.missedStrategies.length) {
        return b.missedStrategies.length - a.missedStrategies.length;
      }
      const rankA = a.bestRank ?? 999;
      const rankB = b.bestRank ?? 999;
      if (rankA !== rankB) return rankA - rankB;
      return a.query.localeCompare(b.query);
    });
  }, [analysis, filterType]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!analysis || filteredQuestions.length === 0) return;

    const headers = ["query", "hitStrategies", "missedStrategies", "bestStrategy", "bestRank"];
    const rows = filteredQuestions.map((q) => [
      q.query,
      q.hitStrategies.join("|"),
      q.missedStrategies.join("|"),
      q.bestStrategy || "-",
      q.bestRank != null ? q.bestRank : "-",
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `rag_evaluation_analysis_${questionSetId}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: 16.5 }}>
          RAG 전략 반복 평가 분석 (질문세트 ID: {questionSetId})
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseOutlined fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3.5 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : !analysis || analysis.runCount === 0 ? (
          <Box sx={{ py: 6, textAlign: "center" }}>
            <WarningAmberOutlined sx={{ fontSize: 42, color: "text.secondary", mb: 1.5 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              아직 이 질문 세트로 완료된 평가 Run이 없습니다. 먼저 평가 Job을 실행하세요.
            </Typography>
          </Box>
        ) : (
          <>
            {/* 1. 전략별 성능 분석 테이블 */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                1. 전략별 성능 분석 ({analysis.runCount}회 실행, 질문 {analysis.questionCount}개 기준)
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "action.hover" }}>
                      <TableCell sx={{ fontSize: 12.5, fontWeight: 700 }}>전략 (Strategy)</TableCell>
                      <TableCell sx={{ fontSize: 12.5, fontWeight: 700, textAlign: "center" }}>성공 수</TableCell>
                      <TableCell sx={{ fontSize: 12.5, fontWeight: 700, textAlign: "center" }}>Hit Rate</TableCell>
                      <TableCell sx={{ fontSize: 12.5, fontWeight: 700, textAlign: "center" }}>MRR</TableCell>
                      <TableCell sx={{ fontSize: 12.5, fontWeight: 700, textAlign: "center" }}>평균 지연시간</TableCell>
                      <TableCell sx={{ fontSize: 12.5, fontWeight: 700, textAlign: "center" }}>실패 질문 수</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analysis.strategies.map((strat) => {
                      const isBest = strat.strategy === bestStrategyName;
                      return (
                        <TableRow
                          key={strat.strategy}
                          hover
                          sx={{
                            bgcolor: isBest ? "rgba(25, 118, 210, 0.08)" : "inherit",
                          }}
                        >
                          <TableCell sx={{ fontSize: 12.5, fontWeight: isBest ? 700 : 500, display: "flex", alignItems: "center", gap: 1 }}>
                            {strat.strategy}
                            {isBest && (
                              <Chip
                                label="최적 추천"
                                size="small"
                                color="primary"
                                sx={{ height: 16, fontSize: 9, fontWeight: 700 }}
                              />
                            )}
                          </TableCell>
                          <TableCell sx={{ fontSize: 12.5, textAlign: "center" }}>{strat.hitCount}개</TableCell>
                          <TableCell sx={{ fontSize: 12.5, textAlign: "center", fontWeight: isBest ? 700 : 400 }}>
                            {(strat.hitRate * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell sx={{ fontSize: 12.5, textAlign: "center" }}>
                            {strat.mrr.toFixed(3)}
                          </TableCell>
                          <TableCell sx={{ fontSize: 12.5, textAlign: "center" }}>
                            {strat.averageElapsedMs.toFixed(1)} ms
                          </TableCell>
                          <TableCell
                            sx={{
                              fontSize: 12.5,
                              textAlign: "center",
                              color: strat.failedQuestionCount > 0 ? "error.main" : "inherit",
                              fontWeight: strat.failedQuestionCount > 0 ? 600 : 400,
                            }}
                          >
                            {strat.failedQuestionCount}개
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* 2. 질문별 실패 분석 테이블 */}
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.8 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  2. 질문별 실패 상세 분석
                </Typography>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Select
                    size="small"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    sx={{ height: 32, fontSize: 12.5, minWidth: 160 }}
                  >
                    <MenuItem value="all">전체 질문 보기</MenuItem>
                    <MenuItem value="all_failed">모든 전략 실패</MenuItem>
                    <MenuItem value="ideablock_failed">IdeaBlock 실패</MenuItem>
                    <MenuItem value="hybrid_failed">Hybrid 실패</MenuItem>
                    <MenuItem value="structure_success_only">Structure만 성공</MenuItem>
                  </Select>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DownloadOutlined />}
                    onClick={handleExportCSV}
                    sx={{ height: 32, fontSize: 12.5 }}
                  >
                    CSV 내보내기
                  </Button>
                </Stack>
              </Stack>

              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5, maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "action.hover" }}>
                      <TableCell sx={{ fontSize: 12.5, fontWeight: 700 }}>평가 질문</TableCell>
                      <TableCell sx={{ fontSize: 12.5, fontWeight: 700, textAlign: "center" }}>성공 전략</TableCell>
                      <TableCell sx={{ fontSize: 12.5, fontWeight: 700, textAlign: "center" }}>실패 전략</TableCell>
                      <TableCell sx={{ fontSize: 12.5, fontWeight: 700, textAlign: "center" }}>최고 전략</TableCell>
                      <TableCell sx={{ fontSize: 12.5, fontWeight: 700, textAlign: "center" }}>최고 순위</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredQuestions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 3, fontSize: 12.5, color: "text.secondary" }}>
                          해당 조건에 만족하는 분석 질문이 존재하지 않습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredQuestions.map((q, idx) => {
                        const allFailed = q.hitStrategies.length === 0;
                        const isIdeaBlockBest = q.bestStrategy === "ideaBlock" || q.bestStrategy === "hybrid";
                        const isImprovementCandidate = q.bestStrategy === "structure" && q.missedStrategies.includes("ideaBlock");

                        return (
                          <TableRow key={idx} hover sx={{ bgcolor: allFailed ? "rgba(211, 47, 47, 0.04)" : "inherit" }}>
                            <TableCell sx={{ fontSize: 12.5, fontWeight: 500, maxWidth: 350 }}>
                              {q.query}
                              {allFailed && (
                                <Chip
                                  label="모든 전략 실패"
                                  size="small"
                                  color="error"
                                  sx={{ height: 16, fontSize: 9, ml: 1, fontWeight: 700 }}
                                />
                              )}
                              {isIdeaBlockBest && (
                                <Chip
                                  label="IdeaBlock 효과"
                                  size="small"
                                  color="success"
                                  sx={{ height: 16, fontSize: 9, ml: 1, fontWeight: 700 }}
                                />
                              )}
                              {isImprovementCandidate && (
                                <Chip
                                  label="IdeaBlock 개선 후보"
                                  size="small"
                                  color="warning"
                                  sx={{ height: 16, fontSize: 9, ml: 1, fontWeight: 700 }}
                                />
                              )}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12.5, textAlign: "center" }}>
                              {q.hitStrategies.length > 0 ? (
                                q.hitStrategies.map((s) => (
                                  <Chip
                                    key={s}
                                    label={s}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    sx={{ height: 18, fontSize: 10, mr: 0.3 }}
                                  />
                                ))
                              ) : (
                                <Typography variant="caption" color="error.main" fontWeight={600}>-</Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12.5, textAlign: "center" }}>
                              {q.missedStrategies.length > 0 ? (
                                q.missedStrategies.map((s) => (
                                  <Chip
                                    key={s}
                                    label={s}
                                    size="small"
                                    color="error"
                                    variant="outlined"
                                    sx={{ height: 18, fontSize: 10, mr: 0.3 }}
                                  />
                                ))
                              ) : (
                                <Chip label="없음" size="small" color="success" sx={{ height: 18, fontSize: 10 }} />
                              )}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12.5, textAlign: "center", fontWeight: 600 }}>
                              {q.bestStrategy || "-"}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12.5, textAlign: "center", fontWeight: 600 }}>
                              {q.bestRank != null ? `${q.bestRank}위` : "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
