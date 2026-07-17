import { useState, useEffect, useRef } from "react";
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  Tab,
  Tabs,
  Button,
  CircularProgress,
  Switch,
  FormControlLabel,
  TextField,
  InputAdornment,
  Paper,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
} from "@mui/material";
import {
  CloseOutlined,
  ContentCopyOutlined,
  DownloadOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  SearchOutlined,
  RefreshOutlined,
  VisibilityOutlined,
  InfoOutlined,
} from "@mui/icons-material";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { markdown as markdownLang } from "@codemirror/lang-markdown";
import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useAuthStore } from "@/react/auth/store";
import {
  reactMarkdownDocumentApi,
  type MarkdownResourceDto,
  type MarkdownLocatorDto,
  type MarkdownProvenanceDto,
  type MarkdownPipelineProgressResponseDto,
  type MarkdownOcrMetadata,
  shouldSuggestOcrReextract,
  ocrBadgeLabel,
  ocrBadgeColor,
} from "./api";
import { useToast } from "@/react/feedback";
import { API_BASE_URL } from "@/config/backend";

interface Props {
  open: boolean;
  onClose: () => void;
  documentId: string;
  revisionId?: string;
  fileName?: string;
  onRetryProgress?: () => void;
}

export function MarkdownViewerDialog({
  open,
  onClose,
  documentId,
  revisionId,
  fileName,
  onRetryProgress,
}: Props) {
  const toast = useToast();

  // Top tabs: "markdown" | "metadata"
  const [activeTab, setActiveTab] = useState<"markdown" | "metadata">("markdown");

  // Markdown Tab specific states
  const [tabValue, setTabValue] = useState<number>(0); // 0: Rendered, 1: Raw
  const [loading, setLoading] = useState<boolean>(false);
  const [text, setText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [is409, setIs409] = useState<boolean>(false);
  const [lineWrap, setLineWrap] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Metadata Tab specific states
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [resources, setResources] = useState<MarkdownResourceDto[]>([]);
  const [locators, setLocators] = useState<MarkdownLocatorDto[]>([]);
  const [provenances, setProvenances] = useState<MarkdownProvenanceDto[]>([]);
  const [selectedProv, setSelectedProv] = useState<any | null>(null);
  const [progress, setProgress] = useState<MarkdownPipelineProgressResponseDto | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Page Preview Modal States
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewBlobUrl, setPreviewBlobUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const token = useAuthStore.getState().token;

  async function openPagePreview(page: number, bbox?: number[] | null) {
    if (!documentId) return;
    setPreviewLoading(true);
    setPreviewError("");
    setPreviewOpen(true);
    setPreviewTitle(`페이지 미리보기 - ${page}페이지` + (bbox ? ` (영역 지정)` : ""));

    let url = `${API_BASE_URL}/api/markdown-documents/${encodeURIComponent(documentId)}/pages/${page}/preview`;
    if (bbox && bbox.length === 4) {
      const [x0, y0, x1, y1] = bbox;
      url += `?x0=${x0}&y0=${y0}&x1=${x1}&y1=${y1}`;
    }

    try {
      const headers: Record<string, string> = {
        Accept: "image/png",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`이미지 로드 실패 (Status: ${response.status})`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPreviewBlobUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return blobUrl;
      });
    } catch (err: any) {
      setPreviewError(err?.message || "미리보기 이미지를 로드하는 중 오류가 발생했습니다.");
    } finally {
      setPreviewLoading(false);
    }
  }

  useEffect(() => {
    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  const abortControllerRef = useRef<AbortController | null>(null);


  // Load markdown text with progressive streaming
  async function loadMarkdown() {
    setLoading(true);
    setError(null);
    setIs409(false);
    setText("");

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const path = revisionId
      ? `/api/markdown-documents/${encodeURIComponent(documentId)}/revisions/${encodeURIComponent(revisionId)}/markdown`
      : `/api/markdown-documents/${encodeURIComponent(documentId)}/markdown`;

    const token = useAuthStore.getState().token;

    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: {
          Accept: "text/markdown",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        signal: abortController.signal,
      });

      if (!response.ok) {
        if (response.status === 409) {
          setIs409(true);
          throw new Error("markdown.content-unavailable");
        }
        const isJson = response.headers.get("content-type")?.includes("application/json");
        const errMsg = isJson
          ? (await response.json().catch(() => ({})))?.message
          : await response.text().catch(() => "");
        throw new Error(errMsg || `HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        const fullText = await response.text();
        setText(fullText);
        setLoading(false);
        return;
      }

      const decoder = new TextDecoder("utf-8");
      let markdown = "";
      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;

        markdown += decoder.decode(value, { stream: true });
        setText(markdown);
      }
      markdown += decoder.decode();
      setText(markdown);
      setLoading(false);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setError(err.message || "마크다운을 불러오는 도중 오류가 발생했습니다.");
      setLoading(false);
    }
  }

  // Load Metadata
  async function loadMetadata() {
    setMetadataLoading(true);
    setMetadataError(null);
    try {
      const [resData, locData, provData, progData] = await Promise.all([
        reactMarkdownDocumentApi.getResources(documentId),
        reactMarkdownDocumentApi.getLocators(documentId),
        reactMarkdownDocumentApi.getProvenance(documentId).catch(() => []),
        reactMarkdownDocumentApi.getProgress(documentId).catch(() => null),
      ]);
      setResources(resData);
      setLocators(locData);
      setProvenances(provData || []);
      setProgress(progData);
    } catch (err: any) {
      setMetadataError(err?.message || "메타데이터를 불러오는 도중 오류가 발생했습니다.");
    } finally {
      setMetadataLoading(false);
    }
  }

  useEffect(() => {
    // Reset all states when documentId or revisionId changes
    setResources([]);
    setLocators([]);
    setProvenances([]);
    setProgress(null);
    setMetadataError(null);
    setActiveTab("markdown");
    setTabValue(0);
    setText("");
    setError(null);
    setIs409(false);
  }, [documentId, revisionId]);

  useEffect(() => {
    if (open && documentId) {
      void loadMarkdown();
      void loadMetadata();
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [open, documentId, revisionId]);

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => toast.success("마크다운이 클립보드에 복사되었습니다."),
      () => toast.error("복사에 실패했습니다.")
    );
  };

  const handleDownload = async () => {
    try {
      await reactMarkdownDocumentApi.downloadMarkdown(documentId, revisionId, fileName ? `${fileName.replace(/\.[^/.]+$/, "")}.md` : undefined);
      toast.success("다운로드가 시작되었습니다.");
    } catch (err: any) {
      toast.error("다운로드 실패: " + (err?.message || "알 수 없는 오류"));
    }
  };

  // Helper parser for safe JSON parsing
  function parseSafeJson(jsonStr: string | null | undefined): any {
    if (!jsonStr) return {};
    try {
      return JSON.parse(jsonStr);
    } catch {
      return {};
    }
  }

  // Parse page number from sourceRef format page[n]/block[m]
  function parsePageFromSourceRef(sourceRef: string | null | undefined): number | null {
    if (!sourceRef) return null;
    const match = sourceRef.match(/page\[(\d+)\]/i);
    return match ? parseInt(match[1], 10) : null;
  }

  // Parse slide number from sourceRef format slide[n]/block[m]
  function parseSlideFromSourceRef(sourceRef: string | null | undefined): number | null {
    if (!sourceRef) return null;
    const match = sourceRef.match(/slide\[(\d+)\]/i);
    return match ? parseInt(match[1], 10) : null;
  }

  // Setup CodeMirror extensions
  const extensions = [
    markdownLang(),
    EditorView.theme({
      "&": {
        fontSize: "12.5px",
        fontFamily: "'JetBrains Mono', Consolas, monospace",
      },
    }),
  ];
  if (lineWrap) {
    extensions.push(EditorView.lineWrapping);
  }

  // Render Metadata View
  function renderMetadataContent() {
    if (metadataLoading) {
      return (
        <Stack spacing={1.5} alignItems="center" justifyContent="center" sx={{ minHeight: "40vh" }}>
          <CircularProgress size={32} />
          <Typography variant="body2" color="text.secondary">메타데이터를 불러오는 중입니다...</Typography>
        </Stack>
      );
    }

    if (metadataError) {
      return (
        <Stack spacing={1.5} alignItems="center" justifyContent="center" sx={{ minHeight: "40vh", p: 4, textAlign: "center" }}>
          <Typography variant="body2" color="error" sx={{ fontWeight: 600 }}>
            불러오기 실패: {metadataError}
          </Typography>
          <Button size="small" variant="outlined" color="primary" startIcon={<RefreshOutlined />} onClick={loadMetadata}>
            다시 시도
          </Button>
        </Stack>
      );
    }

    const normResource = resources.find(r => r.resourceType === "NORMALIZED_DOCUMENT");
    let normMeta: any = null;
    let parseFailed = false;

    if (normResource) {
      if (normResource.metadataJson) {
        normMeta = parseSafeJson(normResource.metadataJson);
        if (Object.keys(normMeta).length === 0) {
          parseFailed = true;
        }
      }
    }

    // OCR & Quality metadata parsing
    const ocrRaw: any = normMeta ?? (() => {
      for (const r of resources) {
        const m = parseSafeJson(r.metadataJson);
        if (m && (
          m.ocrApplied != null || m.ocrMode != null ||
          m.ocrRequired != null || m.ocrRequested != null ||
          m.ocrRequestedBy != null
        )) return m;
      }
      return null;
    })();

    const ocrMeta: MarkdownOcrMetadata = {
      ocrMode: ocrRaw?.ocrMode,
      ocrRequired: ocrRaw?.ocrRequired,
      ocrRequestedBy: ocrRaw?.ocrRequestedBy,
      ocrDecisionReason: ocrRaw?.ocrDecisionReason,
      ocrApplied: ocrRaw?.ocrApplied,
      ocrLanguage: ocrRaw?.ocrLanguage,
      ocrEngine: ocrRaw?.ocrEngine ?? ocrRaw?.pdfExtractionEngine,
      pdfExtractionEngine: ocrRaw?.pdfExtractionEngine,
      ocrUnavailableReason: ocrRaw?.ocrUnavailableReason,
      pdfOcrFallback: ocrRaw?.pdfOcrFallback,
      recommendedRoute: ocrRaw?.recommendedRoute ?? ocrRaw?.pdfRecommendedRoute,
      actualRoute: ocrRaw?.actualRoute ?? ocrRaw?.pdfActualRoute,
      pdfRecommendedRoute: ocrRaw?.pdfRecommendedRoute,
      pdfActualRoute: ocrRaw?.pdfActualRoute,
      markdownQualityStatus: ocrRaw?.markdownQualityStatus,
      mathVisionCorrectionRequested: ocrRaw?.mathVisionCorrectionRequested,
      mathVisionCorrectionApplied: ocrRaw?.mathVisionCorrectionApplied,
      mathVisionCorrectionProvider: ocrRaw?.mathVisionCorrectionProvider,
      mathVisionFormulaBlockCount: ocrRaw?.mathVisionFormulaBlockCount,
      mathVisionCorrectionSkipReason: ocrRaw?.mathVisionCorrectionSkipReason,
    };

    if (!ocrMeta.ocrMode && ocrRaw) {
      const legacyRequested = ocrRaw.ocrRequested ?? ocrRaw.ocrRequired;
      if (legacyRequested === true) ocrMeta.ocrMode = "FORCE";
    }

    const hasOcrInfo = ocrRaw != null && (
      ocrMeta.ocrMode != null || ocrMeta.ocrApplied != null ||
      ocrMeta.ocrEngine != null || ocrMeta.ocrRequestedBy != null ||
      ocrMeta.mathVisionCorrectionRequested != null
    );

    const suggestOcrReextract = shouldSuggestOcrReextract(ocrMeta);

    // 1. Provenance Page/Slide 파싱 및 통계
    const parsedProvenances = provenances.map((prov, index) => {
      const parsedMeta = parseSafeJson(prov.metadataJson);
      
      let page: number | null = prov.page ?? parsedMeta.page ?? parsePageFromSourceRef(prov.sourceRef) ?? null;
      if (page === null && prov.locatorType === "page" && prov.locatorNo != null) {
        page = prov.locatorNo;
      }
      
      let slide: number | null = prov.slide ?? parsedMeta.slide ?? parseSlideFromSourceRef(prov.sourceRef) ?? null;
      if (slide === null && prov.locatorType === "slide" && prov.locatorNo != null) {
        slide = prov.locatorNo;
      }

      const isCoverageTarget = 
        prov.locatorType === "NORMALIZED_BLOCK" || 
        prov.locatorType === "page" || 
        prov.locatorType === "slide" || 
        (prov.sourceRef != null && prov.sourceRef.trim() !== "");

      return {
        ...prov,
        index,
        resolvedPage: page,
        resolvedSlide: slide,
        isCoverageTarget,
        bbox: prov.bbox || parsedMeta.bbox || null,
        confidence: prov.confidence ?? parsedMeta.confidence ?? null,
      };
    });

    const totalProvenanceCount = parsedProvenances.length;
    const coverageTargets = parsedProvenances.filter(p => p.isCoverageTarget);
    const totalCoverageTargetCount = coverageTargets.length;
    
    const pageConfirmedCount = coverageTargets.filter(p => p.resolvedPage != null).length;
    const slideConfirmedCount = coverageTargets.filter(p => p.resolvedSlide != null).length;

    const uniquePages = Array.from(new Set(parsedProvenances.map(p => p.resolvedPage).filter((p): p is number => p != null))).sort((a, b) => a - b);
    const uniqueSlides = Array.from(new Set(parsedProvenances.map(p => p.resolvedSlide).filter((s): s is number => s != null))).sort((a, b) => a - b);

    const pageBlockCounts: Record<number, number> = {};
    const slideBlockCounts: Record<number, number> = {};

    parsedProvenances.forEach(p => {
      if (p.resolvedPage != null) {
        pageBlockCounts[p.resolvedPage] = (pageBlockCounts[p.resolvedPage] || 0) + 1;
      }
      if (p.resolvedSlide != null) {
        slideBlockCounts[p.resolvedSlide] = (slideBlockCounts[p.resolvedSlide] || 0) + 1;
      }
    });

    // Block type summary calculation
    const blockCounts: Record<string, number> = {};
    if (normMeta?.document?.blocks && Array.isArray(normMeta.document.blocks)) {
      normMeta.document.blocks.forEach((b: any) => {
        const type = b.type || "UNKNOWN";
        blockCounts[type] = (blockCounts[type] || 0) + 1;
      });
    }

    const docMetadata = normMeta?.document?.metadata || null;

    // Normalization & Quality gate statuses
    const normalizationStatus = normMeta?.normalizationStatus || ocrRaw?.normalizationStatus || "-";
    const markdownQualityStatus = ocrRaw?.markdownQualityStatus || "-";
    const markdownQualityScore = ocrRaw?.markdownQualityScore ?? normMeta?.markdownQualityScore ?? null;
    const qualityGateStatus = ocrRaw?.qualityGateStatus ?? normMeta?.qualityGateStatus ?? "-";
    const ragIndexEligible = ocrRaw?.ragIndexEligible ?? normMeta?.ragIndexEligible ?? null;

    const normalizationIssues = normMeta?.normalizationIssues || [];
    const markdownQualityIssues = ocrRaw?.markdownQualityIssues || [];
    const allIssues = [...new Set([...normalizationIssues, ...markdownQualityIssues])];

    // 사용 가능 판정 논리
    let usageDecisionLabel = "판정 불가";
    let usageDecisionColor: "success" | "warning" | "error" = "warning";
    let usageDecisionDesc = "품질 분석이 아직 완료되지 않았습니다.";

    if (qualityGateStatus === "PASSED" && ragIndexEligible === true) {
      if (markdownQualityStatus === "REVIEW_REQUIRED" || normalizationStatus === "REVIEW_REQUIRED") {
        usageDecisionLabel = "사용 가능 (품질 경고 존재)";
        usageDecisionColor = "warning";
        usageDecisionDesc = "품질 게이트를 통과하고 RAG 색인도 가능하지만, 일부 검토가 필요합니다.";
      } else {
        usageDecisionLabel = "사용 가능";
        usageDecisionColor = "success";
        usageDecisionDesc = "품질 게이트를 충족하며 RAG 및 서비스 색인에 완전히 적합합니다.";
      }
    } else if (qualityGateStatus === "FAILED" || ragIndexEligible === false) {
      usageDecisionLabel = "사용 제한";
      usageDecisionColor = "error";
      usageDecisionDesc = "품질 기준에 미달(Gate FAILED)되었거나 RAG 색인 대상에서 제외되었습니다.";
    } else if (markdownQualityStatus === "REVIEW_REQUIRED" || normalizationStatus === "REVIEW_REQUIRED") {
      usageDecisionLabel = "사용 가능 (품질 경고 존재)";
      usageDecisionColor = "warning";
      usageDecisionDesc = "정규화 결과 분석에 일부 주의/검토 요구 사항이 포함되어 있습니다.";
    }

    // 이슈 친근한 명칭 변환 딕셔너리
    const issueLabels: Record<string, string> = {
      MATH_DOCUMENT_REVIEW_REQUIRED: "수학 기호 및 공식 복원 검토 필요",
      KOREAN_SPACING_REVIEW_REQUIRED: "한국어 띄어쓰기/맞춤법 보정 검토 필요",
      PAGE_QUALITY_REVIEW_REQUIRED: "페이지 전반의 추출 품질 검토 필요",
    };

    function getMathVisionStatus(): { label: string; color: "success" | "warning" | "info" | "default" } {
      const req = ocrMeta.mathVisionCorrectionRequested;
      const app = ocrMeta.mathVisionCorrectionApplied;
      const skip = ocrMeta.mathVisionCorrectionSkipReason;
      
      if (req === true) {
        if (app === true) {
          return { label: "Vision LLM 보정 적용됨", color: "success" };
        } else {
          if (skip === "SERVER_DISABLED") {
            return { label: "서버 설정상 Vision LLM 보정이 비활성화됨", color: "warning" };
          } else if (skip === "NO_API_KEY") {
            return { label: "Vision LLM API key가 설정되지 않음", color: "warning" };
          }
          return { label: `Vision LLM 보정 미적용 (${skip || "알 수 없는 이유"})`, color: "warning" };
        }
      }
      return { label: "Vision LLM 보정 미요청", color: "default" };
    }

    return (
      <Box sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {/* A. 사용 가능 판정 카드 */}
          <Grid size={{ xs: 12 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 2,
                borderLeft: "6px solid",
                borderColor: `${usageDecisionColor}.main`,
                bgcolor: `${usageDecisionColor}.lighter` || "action.hover",
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: `${usageDecisionColor}.dark`, mb: 0.5 }}>
                    정규화 품질 상태: {usageDecisionLabel}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {usageDecisionDesc}
                  </Typography>
                </Box>
                {ragIndexEligible !== null && (
                  <Chip
                    label={ragIndexEligible ? "RAG 색인 가능" : "RAG 색인 불가"}
                    color={ragIndexEligible ? "success" : "error"}
                    variant="filled"
                    sx={{ fontWeight: 700 }}
                  />
                )}
              </Stack>
            </Paper>
          </Grid>

          {/* B. 정규화 요약 */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
                <InfoOutlined color="primary" fontSize="small" /> 정규화 상태 상세
              </Typography>
              {parseFailed ? (
                <Typography variant="body2" color="error">메타데이터를 해석할 수 없습니다.</Typography>
              ) : (
                <Stack spacing={1.5}>
                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" display="block">정규화 상태 (Normalization Status)</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{normalizationStatus}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" display="block">품질 상태 (Quality Status)</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{markdownQualityStatus}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" display="block">품질 게이트 (Quality Gate)</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        <Chip
                          label={qualityGateStatus}
                          color={qualityGateStatus === "PASSED" ? "success" : qualityGateStatus === "FAILED" ? "error" : "default"}
                          size="small"
                          sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
                        />
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" display="block">품질 스코어 (Quality Score)</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {markdownQualityScore !== null ? `${markdownQualityScore}점` : "-"}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" display="block">블록 수 / 전체 페이지 수</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {normMeta?.blockCount != null ? `${normMeta.blockCount} Blocks` : "-"} / {normMeta?.pageCount != null ? `${normMeta.pageCount} Pages` : "-"}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" display="block">테이블 / 이미지 수</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {normMeta?.tableCount != null ? `${normMeta.tableCount} Tables` : "-"} / {normMeta?.imageCount != null ? `${normMeta.imageCount} Images` : "-"}
                      </Typography>
                    </Grid>
                  </Grid>

                  {allIssues.length > 0 && (
                    <Box sx={{ mt: 1.5, p: 2, bgcolor: "action.hover", borderRadius: 1.5, border: "1px dashed", borderColor: "warning.main" }}>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: "warning.dark", display: "block", mb: 1 }}>
                        품질 경고 상세 ({allIssues.length}개)
                      </Typography>
                      {allIssues.map((issue: string, idx: number) => (
                        <Typography key={idx} variant="caption" color="text.secondary" display="block" sx={{ pl: 1, textIndent: -8 }}>
                          • {issueLabels[issue] || issue}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Stack>
              )}
            </Paper>
          </Grid>

          {/* C. 블록 통계 */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                블록 분류 (Block Breakdown)
              </Typography>
              {Object.keys(blockCounts).length === 0 ? (
                <Typography variant="body2" color="text.secondary">정량 분석된 블록 정보가 없습니다.</Typography>
              ) : (
                <Stack spacing={1} sx={{ maxHeight: 220, overflow: "auto", pr: 0.5 }}>
                  {Object.entries(blockCounts).map(([type, count]) => (
                    <Box key={type} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.75, borderBottom: "1px dashed", borderColor: "divider" }}>
                      <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 13 }}>{type}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{count}</Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Paper>
          </Grid>

          {/* D. OCR 요약 */}
          {hasOcrInfo && (
            <Grid size={{ xs: 12 }}>
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    OCR 요약
                  </Typography>
                  <Chip
                    label={ocrBadgeLabel(ocrMeta)}
                    color={ocrBadgeColor(ocrMeta)}
                    size="small"
                    variant="filled"
                    sx={{ fontWeight: 600, fontSize: 11 }}
                  />
                </Stack>

                {suggestOcrReextract && (
                  <Box sx={{ mb: 2, p: 1.5, bgcolor: "action.hover", borderRadius: 1, border: "1px solid", borderColor: "warning.main" }}>
                    <Typography variant="caption" sx={{ color: "warning.dark", fontWeight: 600, display: "block" }}>
                      ⚠ OCR 권장: 다시 추출 시 'OCR 적용 후 재추출'을 사용하면 품질을 개선할 수 있습니다.
                    </Typography>
                    {ocrMeta.ocrDecisionReason && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        사유: {ocrMeta.ocrDecisionReason}
                      </Typography>
                    )}
                  </Box>
                )}

                <Grid container spacing={2}>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary" display="block">OCR 모드</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {ocrMeta.ocrMode ?? "-"}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary" display="block">OCR 요청 주체</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {ocrMeta.ocrRequestedBy ?? "-"}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary" display="block">OCR 적용</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {ocrMeta.ocrApplied == null ? "-" : ocrMeta.ocrApplied ? "예" : "아니오"}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary" display="block">OCR 언어</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {ocrMeta.ocrLanguage ?? "-"}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary" display="block">PDF 추출 엔진</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {ocrMeta.ocrEngine ?? "-"}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary" display="block">OCR Fallback</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {ocrMeta.pdfOcrFallback == null ? "-" : ocrMeta.pdfOcrFallback ? "예" : "아니오"}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary" display="block">권장 라우트</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {ocrMeta.recommendedRoute ?? ocrMeta.pdfRecommendedRoute ?? "-"}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary" display="block">실제 처리 라우트</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {ocrMeta.actualRoute ?? ocrMeta.pdfActualRoute ?? "-"}
                    </Typography>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2.5 }} />

                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Vision LLM 수식 보정
                  </Typography>
                  {(() => {
                    const status = getMathVisionStatus();
                    return <Chip label={status.label} color={status.color} size="small" variant="filled" sx={{ fontWeight: 600, fontSize: 11 }} />;
                  })()}
                </Stack>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <Typography variant="caption" color="text.secondary" display="block">Vision 보정 요청</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {ocrMeta.mathVisionCorrectionRequested == null ? "-" : ocrMeta.mathVisionCorrectionRequested ? "예" : "아니오"}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <Typography variant="caption" color="text.secondary" display="block">Vision 보정 적용</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {ocrMeta.mathVisionCorrectionApplied == null ? "-" : ocrMeta.mathVisionCorrectionApplied ? "예" : "아니오"}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <Typography variant="caption" color="text.secondary" display="block">Vision Provider</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {ocrMeta.mathVisionCorrectionProvider || "-"}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <Typography variant="caption" color="text.secondary" display="block">보정 수식 블록 수</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {ocrMeta.mathVisionFormulaBlockCount != null ? `${ocrMeta.mathVisionFormulaBlockCount}개` : "-"}
                    </Typography>
                  </Grid>
                  {ocrMeta.mathVisionCorrectionSkipReason && (
                    <Grid size={{ xs: 12 }}>
                      <Typography variant="caption" color="text.secondary" display="block">미적용 사유 (Skip Reason)</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {ocrMeta.mathVisionCorrectionSkipReason}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </Grid>
          )}

          {/* E. 위치 정보 통계 카드 */}
          <Grid size={{ xs: 12 }}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2.5, display: "flex", alignItems: "center", gap: 1 }}>
                <VisibilityOutlined color="primary" fontSize="small" /> 원문 위치 정보 분석 (Provenance & Slide Statistics)
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Card variant="outlined" sx={{ p: 1.5, textAlign: "center" }}>
                    <Typography variant="caption" color="text.secondary">총 위치 정보 수</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>{totalProvenanceCount}개</Typography>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Card variant="outlined" sx={{ p: 1.5, textAlign: "center" }}>
                    <Typography variant="caption" color="text.secondary">페이지 확인 수 (PDF)</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5, color: "primary.main" }}>
                      {pageConfirmedCount}개 
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 11 }}>
                        대상 중 {totalCoverageTargetCount > 0 ? ((pageConfirmedCount / totalCoverageTargetCount) * 100).toFixed(1) : 0}%
                      </Typography>
                    </Typography>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Card variant="outlined" sx={{ p: 1.5, textAlign: "center" }}>
                    <Typography variant="caption" color="text.secondary">슬라이드 확인 수 (PPTX)</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5, color: "secondary.main" }}>
                      {slideConfirmedCount}개
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 11 }}>
                        대상 중 {totalCoverageTargetCount > 0 ? ((slideConfirmedCount / totalCoverageTargetCount) * 100).toFixed(1) : 0}%
                      </Typography>
                    </Typography>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Card variant="outlined" sx={{ p: 1.5, textAlign: "center" }}>
                    <Typography variant="caption" color="text.secondary">확인된 페이지/슬라이드 수</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                      {uniquePages.length > 0 ? `Page: ${uniquePages.length}개` : ""}
                      {uniqueSlides.length > 0 ? `Slide: ${uniqueSlides.length}개` : ""}
                      {uniquePages.length === 0 && uniqueSlides.length === 0 ? "0개" : ""}
                    </Typography>
                  </Card>
                </Grid>
              </Grid>

              {/* 페이지/슬라이드별 블록 개수 히스토그램 형태 표시 */}
              {(uniquePages.length > 0 || uniqueSlides.length > 0) && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ fontWeight: 600, mb: 1 }}>
                    페이지 / 슬라이드별 블록 검출 빈도
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", maxHeight: 120, overflow: "auto", p: 0.5 }}>
                    {uniquePages.map(pageNum => (
                      <Chip
                        key={`page-${pageNum}`}
                        label={`Page ${pageNum} (${pageBlockCounts[pageNum]}개)`}
                        size="small"
                        variant="outlined"
                        color="primary"
                        sx={{ fontSize: 11 }}
                      />
                    ))}
                    {uniqueSlides.map(slideNum => (
                      <Chip
                        key={`slide-${slideNum}`}
                        label={`Slide ${slideNum} (${slideBlockCounts[slideNum]}개)`}
                        size="small"
                        variant="outlined"
                        color="secondary"
                        sx={{ fontSize: 11 }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* 위치 정보 목록 테이블 */}
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: selectedProv ? 7 : 12 }}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ fontWeight: 600, mb: 1 }}>
                    위치 정보 리스트 (행 클릭 시 상세 조회 가능)
                  </Typography>
                  <TableContainer sx={{ maxHeight: 350, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper", fontSize: 12 }}>ID / Type</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper", fontSize: 12 }}>원문 위치</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper", fontSize: 12 }}>BBox</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper", fontSize: 12 }}>Source Ref</TableCell>
                          <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper", fontSize: 12 }}>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {parsedProvenances.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                              위치 정보(Provenance) 데이터가 존재하지 않습니다.
                            </TableCell>
                          </TableRow>
                        ) : (
                          parsedProvenances.map((prov) => {
                            const isSelected = selectedProv?.index === prov.index;
                            const displayPageOrSlide = prov.resolvedPage != null 
                              ? `Page ${prov.resolvedPage}` 
                              : (prov.resolvedSlide != null ? `Slide ${prov.resolvedSlide}` : "-");
                            
                            return (
                              <TableRow
                                key={prov.locatorId || prov.index}
                                hover
                                selected={isSelected}
                                onClick={() => setSelectedProv(prov)}
                                sx={{ cursor: "pointer", "&.Mui-selected": { bgcolor: "action.selected" } }}
                              >
                                <TableCell sx={{ fontSize: 12 }}>
                                  <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 600 }}>
                                    {prov.locatorId ? `${prov.locatorId.substring(0, 10)}...` : `#${prov.index}`}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {prov.locatorType}
                                  </Typography>
                                </TableCell>
                                <TableCell sx={{ fontSize: 12, fontWeight: 500 }}>
                                  {displayPageOrSlide}
                                </TableCell>
                                <TableCell sx={{ fontSize: 11, fontFamily: "monospace" }}>
                                  {prov.bbox ? `[${prov.bbox.map(n => n.toFixed(1)).join(", ")}]` : "-"}
                                </TableCell>
                                <TableCell sx={{ fontSize: 11, fontFamily: "monospace", color: "text.secondary" }}>
                                  {prov.sourceRef || "-"}
                                </TableCell>
                                <TableCell>
                                  {prov.resolvedPage != null && (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      startIcon={<VisibilityOutlined sx={{ fontSize: 12 }} />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void openPagePreview(prov.resolvedPage!, prov.bbox);
                                      }}
                                      sx={{ py: 0.1, px: 1, fontSize: 10.5, height: 22 }}
                                    >
                                      위치 보기
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>

                {/* 상세 카드 */}
                {selectedProv && (
                  <Grid size={{ xs: 12, md: 5 }}>
                    <Card variant="outlined" sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column" }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          선택한 위치 정보 상세
                        </Typography>
                        <IconButton size="small" onClick={() => setSelectedProv(null)}>
                          <CloseOutlined fontSize="small" />
                        </IconButton>
                      </Box>
                      <Stack spacing={1.5} sx={{ flexGrow: 1, overflow: "auto" }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">Locator ID</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: "break-all" }}>{selectedProv.locatorId}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">Type / No</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {selectedProv.locatorType} (No: {selectedProv.locatorNo ?? "-"})
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">정규화 페이지 / 슬라이드</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: "primary.main" }}>
                            {selectedProv.resolvedPage != null ? `PDF Page ${selectedProv.resolvedPage}` : ""}
                            {selectedProv.resolvedSlide != null ? `PPTX Slide ${selectedProv.resolvedSlide}` : ""}
                            {selectedProv.resolvedPage == null && selectedProv.resolvedSlide == null ? "미지정" : ""}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">BBox 좌표</Typography>
                          <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12.5 }}>
                            {selectedProv.bbox ? `[${selectedProv.bbox.join(", ")}]` : "좌표 없음 (bbox가 없어도 페이지 번호는 유지됩니다)"}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">Source Reference</Typography>
                          <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12.5 }}>{selectedProv.sourceRef || "-"}</Typography>
                        </Box>
                        {selectedProv.confidence != null && (
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">신뢰도 (Confidence)</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{(selectedProv.confidence * 100).toFixed(1)}%</Typography>
                          </Box>
                        )}
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">메타데이터 원본 (metadataJson)</Typography>
                          <Box
                            sx={{
                              p: 1,
                              bgcolor: "action.hover",
                              borderRadius: 1,
                              fontSize: 11,
                              fontFamily: "monospace",
                              maxHeight: 120,
                              overflow: "auto",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-all"
                            }}
                          >
                            {selectedProv.metadataJson || "{}"}
                          </Box>
                        </Box>
                      </Stack>
                    </Card>
                  </Grid>
                )}
              </Grid>
            </Paper>
          </Grid>

          {/* F. 기존 Locators 목록 보존 */}
          <Grid size={{ xs: 12 }}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                문서 목차 위치 (Document Outline Locators)
              </Typography>
              {locators.length === 0 ? (
                <Typography variant="body2" color="text.secondary">목차 정보가 없습니다.</Typography>
              ) : (
                <TableContainer sx={{ maxHeight: 200, overflow: "auto" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper", fontSize: 12 }}>Level</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper", fontSize: 12 }}>페이지</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper", fontSize: 12 }}>제목</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper", fontSize: 12 }}>Locator ID</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper", fontSize: 12 }}>오프셋</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper", fontSize: 12 }}>액션</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {locators.map((loc) => (
                        <TableRow key={loc.locatorId}>
                          <TableCell sx={{ fontSize: 12 }}>{loc.level ?? "-"}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{loc.pageNumber ?? "-"}페이지</TableCell>
                          <TableCell sx={{ fontSize: 12, fontWeight: 500 }}>{loc.title || "-"}</TableCell>
                          <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>{loc.locatorId || "-"}</TableCell>
                          <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>{loc.startOffset} ~ {loc.endOffset}</TableCell>
                          <TableCell>
                            {loc.pageNumber != null && (
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<VisibilityOutlined sx={{ fontSize: 12 }} />}
                                onClick={() => void openPagePreview(loc.pageNumber!)}
                                sx={{ py: 0.1, px: 1, fontSize: 10.5, height: 22 }}
                              >
                                위치 보기
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>

          {/* G. 문서 기본 메타데이터 */}
          {docMetadata && typeof docMetadata === "object" && Object.keys(docMetadata).length > 0 && (
            <Grid size={{ xs: 12 }}>
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                  문서 정보 (Document Metadata)
                </Typography>
                <Grid container spacing={2}>
                  {Object.entries(docMetadata).map(([key, value]) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={key}>
                      <Typography variant="caption" color="text.secondary" display="block">{key}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: "break-all" }}>{String(value)}</Typography>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Grid>
          )}

          {/* H. 파이프라인 정보 */}
          {progress && (
            <Grid size={{ xs: 12 }}>
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                  파이프라인 진행 상태 (Pipeline Progress)
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="caption" color="text.secondary" display="block">Current Stage</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{progress.currentStage || "-"}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="caption" color="text.secondary" display="block">Status</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{progress.status || "-"}</Typography>
                  </Grid>
                  {progress.errorMessage && (
                    <Grid size={{ xs: 12 }}>
                      <Typography variant="caption" color="error" display="block">Error Message</Typography>
                      <Typography variant="body2" color="error" sx={{ fontWeight: 500 }}>{progress.errorMessage}</Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </Grid>
          )}
        </Grid>
      </Box>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      fullScreen={isFullscreen}
      sx={{
        "& .MuiDialog-paper": {
          height: isFullscreen ? "100vh" : "85vh",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <DialogTitle
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
          pr: "16px !important",
          "& .custom-close-button": {
            display: "none",
          },
        }}
      >
        <Stack spacing={0.5} sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: 16 }}>
            마크다운 결과 보기 {fileName && `- ${fileName}`}
          </Typography>
          {revisionId && (
            <Typography variant="caption" color="text.secondary">
              Revision ID: {revisionId}
            </Typography>
          )}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title={isFullscreen ? "창 모드" : "전체화면"}>
            <IconButton size="small" onClick={() => setIsFullscreen((v) => !v)}>
              {isFullscreen ? <FullscreenExitOutlined fontSize="small" /> : <FullscreenOutlined fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="닫기">
            <IconButton size="small" onClick={onClose}>
              <CloseOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: "flex", flexDirection: "column", flexGrow: 1, overflow: "hidden" }}>
        {/* Top level tabs [ Markdown ] [ Metadata ] */}
        <Box sx={{ borderBottom: 1, borderColor: "divider", px: 2, bgcolor: "action.hover", flexShrink: 0 }}>
          <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val)}>
            <Tab label="Markdown" value="markdown" />
            <Tab label="Metadata" value="metadata" />
          </Tabs>
        </Box>

        {activeTab === "markdown" ? (
          <>
            {/* Controls Bar */}
            <Box sx={{ px: 2, py: 1, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1, flexShrink: 0 }}>
              <Tabs value={tabValue} onChange={(_, val) => setTabValue(val)} sx={{ minHeight: 32, "& .MuiTab-root": { py: 0.5, minHeight: 32 } }}>
                <Tab label="미리보기 (Preview)" />
                <Tab label="원본 보기 (Raw)" />
              </Tabs>

              <Stack direction="row" spacing={1.5} alignItems="center">
                {tabValue === 1 && (
                  <>
                    <FormControlLabel
                      control={<Switch size="small" checked={lineWrap} onChange={(e) => setLineWrap(e.target.checked)} />}
                      label={<Typography variant="caption">자동 줄바꿈</Typography>}
                      sx={{ mr: 1 }}
                    />
                    <TextField
                      size="small"
                      placeholder="텍스트 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <SearchOutlined fontSize="small" />
                            </InputAdornment>
                          ),
                          sx: { height: 28, fontSize: 12 },
                        }
                      }}
                    />
                  </>
                )}
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  disabled={!text}
                  startIcon={<ContentCopyOutlined />}
                  onClick={handleCopy}
                  sx={{ height: 28, fontSize: 12 }}
                >
                  복사
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  disabled={!text}
                  startIcon={<DownloadOutlined />}
                  onClick={handleDownload}
                  sx={{ height: 28, fontSize: 12 }}
                >
                  다운로드
                </Button>
              </Stack>
            </Box>

            {/* Content Panel */}
            <Box sx={{ flexGrow: 1, overflow: "auto", position: "relative", bgcolor: "background.default", p: tabValue === 0 ? 3 : 0 }}>
              {loading && text.length === 0 && (
                <Stack spacing={1.5} alignItems="center" justifyContent="center" sx={{ position: "absolute", inset: 0, bgcolor: "rgba(255,255,255,0.7)", zIndex: 1 }}>
                  <CircularProgress size={32} />
                  <Typography variant="body2" color="text.secondary">마크다운을 불러오는 중입니다...</Typography>
                </Stack>
              )}

              {is409 ? (
                <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ minHeight: "50vh", p: 4, textAlign: "center" }}>
                  <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600 }}>
                    아직 생성 완료된 마크다운 본문이 없습니다.
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 400 }}>
                    현재 변환 작업이 진행 중일 수 있습니다. 파이프라인 진행 상태를 다시 확인하거나 잠시 후 다시 시도해 주세요.
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    {onRetryProgress && (
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        startIcon={<RefreshOutlined />}
                        onClick={() => {
                          onRetryProgress();
                          onClose();
                        }}
                      >
                        진행 상태 새로고침
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      startIcon={<RefreshOutlined />}
                      onClick={loadMarkdown}
                    >
                      본문 로드 재시도
                    </Button>
                  </Stack>
                </Stack>
              ) : error ? (
                <Stack spacing={1.5} alignItems="center" justifyContent="center" sx={{ minHeight: "50vh", p: 4, textAlign: "center" }}>
                  <Typography variant="body2" color="error" sx={{ fontWeight: 600 }}>
                    불러오기 실패: {error}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    startIcon={<RefreshOutlined />}
                    onClick={loadMarkdown}
                  >
                    다시 시도
                  </Button>
                </Stack>
              ) : (
                <>
                  {tabValue === 0 ? (
                    <Box
                      className="markdown-body"
                      sx={{
                        fontFamily: "Inter, Roboto, sans-serif",
                        fontSize: "14px",
                        lineHeight: 1.6,
                        color: "text.primary",
                        "& h1": { fontSize: "1.8rem", mt: 2, mb: 1, borderBottom: "1px solid", borderColor: "divider", pb: 0.5 },
                        "& h2": { fontSize: "1.4rem", mt: 2, mb: 1, borderBottom: "1px solid", borderColor: "divider", pb: 0.5 },
                        "& h3": { fontSize: "1.2rem", mt: 1.5, mb: 0.8 },
                        "& h4": { fontSize: "1.1rem", mt: 1.5, mb: 0.8 },
                        "& p": { my: 1 },
                        "& code": { bgcolor: "action.hover", px: 0.6, py: 0.2, borderRadius: 0.5, fontFamily: "monospace", fontSize: "0.9em" },
                        "& pre": { bgcolor: "action.hover", p: 1.5, borderRadius: 1, overflowX: "auto", my: 1.5 },
                        "& pre code": { p: 0, bgcolor: "transparent" },
                        "& blockquote": { borderLeft: "4px solid", borderColor: "primary.main", pl: 1.5, my: 1.5, color: "text.secondary", fontStyle: "italic" },
                        "& ul": { pl: 2, my: 1 },
                        "& ol": { pl: 2, my: 1 },
                        "& li": { my: 0.5 },
                        "& table": { borderCollapse: "collapse", width: "100%", my: 1.5, fontSize: "0.9em" },
                        "& th": { border: "1px solid", borderColor: "divider", p: 0.75, bgcolor: "action.hover", fontWeight: 700 },
                        "& td": { border: "1px solid", borderColor: "divider", p: 0.75 },
                        // KaTeX math styles
                        "& .katex-display": { overflowX: "auto", overflowY: "hidden", my: 1.5 },
                        "& .katex": { fontSize: "1.05em" },
                      }}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          img: ({ src, alt }) => (
                            <MarkdownImage src={src} alt={alt} documentId={documentId} />
                          )
                        }}
                      >
                        {text}
                      </ReactMarkdown>
                    </Box>
                  ) : (
                    <CodeMirror
                      value={text}
                      height="100%"
                      extensions={extensions}
                      readOnly
                      theme="light"
                      basicSetup={{
                        lineNumbers: true,
                        foldGutter: true,
                        highlightActiveLine: false,
                        searchKeymap: true,
                      }}
                    />
                  )}
                </>
              )}
            </Box>
          </>
        ) : (
          <Box sx={{ flexGrow: 1, overflow: "auto", bgcolor: "background.default" }}>
            {renderMetadataContent()}
          </Box>
        )}
      </DialogContent>

      {/* Page / Crop Preview Dialog */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: 15 }}>
            {previewTitle}
          </Typography>
          <IconButton onClick={() => setPreviewOpen(false)} size="small">
            <CloseOutlined fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", bgcolor: "action.hover", minHeight: 300 }}>
          {previewLoading ? (
            <Stack spacing={1.5} alignItems="center">
              <CircularProgress size={32} />
              <Typography variant="body2" color="text.secondary">이미지를 가져오는 중입니다...</Typography>
            </Stack>
          ) : previewError ? (
            <Typography variant="body2" color="error" sx={{ fontWeight: 600 }}>
              {previewError}
            </Typography>
          ) : previewBlobUrl ? (
            <Box
              component="img"
              src={previewBlobUrl}
              alt="Page Preview"
              sx={{
                maxWidth: "100%",
                maxHeight: "65vh",
                objectFit: "contain",
                boxShadow: 3,
                borderRadius: 1.5,
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
              }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">미리보기 파일이 없습니다.</Typography>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

interface MarkdownImageProps {
  src?: string;
  alt?: string;
  documentId: string | null;
}

function MarkdownImage({ src, alt, documentId }: MarkdownImageProps) {
  const [blobUrl, setBlobUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const token = useAuthStore.getState().token;

  useEffect(() => {
    if (!src) {
      setLoading(false);
      return;
    }

    let active = true;
    let resolvedUrl = src;

    // page[n]/image[m] -> pages/{page}/preview mapping
    const pageImageRegex = /^page(\d+)\/image(\d+)/i;
    const match = src.match(pageImageRegex);
    if (match && documentId) {
      const pageNum = match[1];
      resolvedUrl = `${API_BASE_URL}/api/markdown-documents/${encodeURIComponent(documentId)}/pages/${pageNum}/preview`;
    } else if (src.startsWith("/")) {
      resolvedUrl = `${API_BASE_URL}${src}`;
    } else if (!src.startsWith("http://") && !src.startsWith("https://") && !src.startsWith("blob:") && documentId) {
      resolvedUrl = `${API_BASE_URL}/api/markdown-documents/${encodeURIComponent(documentId)}/${src}`;
    }

    async function loadImage() {
      try {
        const headers: Record<string, string> = {
          Accept: "image/png"
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        
        const response = await fetch(resolvedUrl, {
          headers,
          credentials: "include"
        });

        if (!response.ok) {
          throw new Error("Image load failed");
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        if (active) {
          setBlobUrl(url);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load markdown image:", err);
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    }

    void loadImage();

    return () => {
      active = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [src, documentId, token]);

  if (loading) {
    return (
      <Box sx={{ display: "inline-flex", p: 1, bgcolor: "action.hover", borderRadius: 1, my: 1 }}>
        <CircularProgress size={16} />
      </Box>
    );
  }

  if (error || !blobUrl) {
    return (
      <Box sx={{ display: "inline-flex", flexDirection: "column", p: 1.5, border: "1px dashed", borderColor: "error.main", borderRadius: 1.5, bgcolor: "action.hover", color: "error.main", fontSize: "11px", my: 1 }}>
        <span>이미지 로드 실패</span>
        <span style={{ fontSize: "9px", opacity: 0.8 }}>{alt || src}</span>
      </Box>
    );
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      style={{
        maxWidth: "100%",
        height: "auto",
        display: "block",
        margin: "8px 0",
        borderRadius: "4px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
      }}
    />
  );
}
