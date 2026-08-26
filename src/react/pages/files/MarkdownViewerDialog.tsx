import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
  ExpandLessOutlined,
  ExpandMoreOutlined,
  TranslateOutlined,
} from "@mui/icons-material";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { markdown as markdownLang } from "@codemirror/lang-markdown";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useAuthStore } from "@/react/auth/store";
import {
  reactMarkdownDocumentApi,
  type DocumentMetadataSummaryDto,
  type DocumentMetadataTranslationDto,
  type MarkdownResourceDto,
  type MarkdownLocatorDto,
  type MarkdownProvenanceDto,
  type MarkdownPipelineProgressResponseDto,
  type MarkdownOcrMetadata,
  ocrBadgeLabel,
  ocrBadgeColor,
} from "./api";
import { useToast } from "@/react/feedback";
import { API_BASE_URL } from "@/config/backend";
import { reactAiApi } from "@/react/pages/ai/api";
import { resolveAxiosError } from "@/utils/helpers";
import { filesQueryKeys } from "./queryKeys";
import { DocumentUsabilityPanel } from "./DocumentUsabilityPanel";
import { shouldPollUsability } from "./documentUsabilityView";

interface Props {
  open: boolean;
  onClose: () => void;
  attachmentId: number;
  documentId: string;
  revisionId?: string;
  fileName?: string;
  onRetryProgress?: () => void;
}

function isKoreanSummary(language: string | null | undefined, summary: string | null | undefined): boolean {
  const normalizedLanguage = language?.trim().toLowerCase();
  if (normalizedLanguage?.startsWith("ko") || normalizedLanguage?.startsWith("kor")) return true;
  if (!summary) return false;
  const letters = Array.from(summary).filter(character => /\p{L}/u.test(character));
  const hangul = letters.filter(character => /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(character)).length;
  return hangul >= 3 && hangul * 2 >= Math.max(1, letters.length);
}

export function MarkdownViewerDialog({
  open,
  onClose,
  attachmentId,
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
  const [metadataSummary, setMetadataSummary] = useState<DocumentMetadataSummaryDto | null>(null);
  const [metadataSummaryLoading, setMetadataSummaryLoading] = useState(false);
  const [metadataSummaryError, setMetadataSummaryError] = useState<string | null>(null);
  const [metadataSummaryExpanded, setMetadataSummaryExpanded] = useState(true);
  const [metadataSummaryReextracting, setMetadataSummaryReextracting] = useState(false);
  const [metadataTranslation, setMetadataTranslation] = useState<DocumentMetadataTranslationDto | null>(null);
  const [metadataTranslationLoading, setMetadataTranslationLoading] = useState(false);
  const [showKoreanTranslation, setShowKoreanTranslation] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [metadataDetailsRequested, setMetadataDetailsRequested] = useState(false);
  const [metadataDetailsLoaded, setMetadataDetailsLoaded] = useState(false);
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
  const metadataSummaryCacheRef = useRef(new Map<string, {
    summary: DocumentMetadataSummaryDto | null;
    progress: MarkdownPipelineProgressResponseDto | null;
  }>());
  const metadataCacheRef = useRef(new Map<string, {
    resources: MarkdownResourceDto[];
    locators: MarkdownLocatorDto[];
  }>());
  const metadataSummaryRequestRef = useRef(0);
  const metadataRequestRef = useRef(0);
  const metadataRegenerationRequestRef = useRef(0);
  const metadataTranslationRequestRef = useRef(0);

  const token = useAuthStore.getState().token;
  const queryClient = useQueryClient();
  const usabilityQueryKey = filesQueryKeys.custom("rag-usability", "attachment", attachmentId);
  const usabilityQuery = useQuery({
    queryKey: usabilityQueryKey,
    queryFn: () => reactAiApi.getRagObjectUsability("attachment", String(attachmentId)),
    enabled: open && activeTab === "metadata" && attachmentId > 0,
    retry: false,
    refetchInterval: (query) => shouldPollUsability(query.state.data) ? 2000 : false,
  });
  const autoEvaluationMutation = useMutation({
    mutationFn: () => reactAiApi.runRagObjectAutoEvaluation("attachment", String(attachmentId)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usabilityQueryKey, refetchType: "active" });
    },
  });

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
  const metadataCacheKey = `${documentId}::${revisionId ?? "current"}`;

  function locatorsToProvenances(values: MarkdownLocatorDto[]): MarkdownProvenanceDto[] {
    return values.map((value) => ({
      locatorId: value.locatorId,
      locatorType: value.locatorType,
      locatorNo: value.locatorNo,
      page: value.page,
      slide: value.slide,
      bbox: value.bbox ?? null,
      sourceRef: value.sourceRef,
      metadataJson: value.metadataJson,
      confidence: null,
    }));
  }

  async function loadMetadataSummary(force = false) {
    const cached = metadataSummaryCacheRef.current.get(metadataCacheKey);
    if (!force && cached) {
      setMetadataSummary(cached.summary);
      setProgress(cached.progress);
      setMetadataSummaryError(null);
      return;
    }
    const requestId = ++metadataSummaryRequestRef.current;
    setMetadataSummaryLoading(true);
    setMetadataSummaryError(null);
    try {
      const [summaryData, progData] = await Promise.all([
        reactMarkdownDocumentApi.getMetadataSummary(documentId, revisionId),
        reactMarkdownDocumentApi.getProgress(documentId, revisionId).catch(() => null),
      ]);
      if (requestId !== metadataSummaryRequestRef.current) {
        return;
      }
      metadataSummaryCacheRef.current.set(metadataCacheKey, {
        summary: summaryData,
        progress: progData,
      });
      setMetadataSummary(summaryData);
      setProgress(progData);
    } catch (err: any) {
      if (requestId !== metadataSummaryRequestRef.current) {
        return;
      }
      setMetadataSummary(null);
      setProgress(null);
      setMetadataSummaryError(err?.message || "요약 메타데이터를 불러오는 도중 오류가 발생했습니다.");
    } finally {
      if (requestId === metadataSummaryRequestRef.current) {
        setMetadataSummaryLoading(false);
      }
    }
  }

  async function reextractMetadataSummary() {
    if (!documentId || metadataSummaryReextracting) return;
    const confirmed = window.confirm(
      "현재 문서의 요약과 키워드 메타데이터를 AI로 다시 추출합니다. 처리 시간과 모델 사용 비용이 발생할 수 있습니다. 계속하시겠습니까?"
    );
    if (!confirmed) return;

    const requestId = ++metadataRegenerationRequestRef.current;
    setMetadataSummaryReextracting(true);
    try {
      await reactMarkdownDocumentApi.reextractMetadata(documentId, revisionId);
      if (requestId !== metadataRegenerationRequestRef.current) return;
      metadataTranslationRequestRef.current += 1;
      setMetadataTranslation(null);
      setMetadataTranslationLoading(false);
      setShowKoreanTranslation(false);
      metadataSummaryCacheRef.current.delete(metadataCacheKey);
      await loadMetadataSummary(true);
      if (requestId !== metadataRegenerationRequestRef.current) return;
      toast.success("문서 메타데이터 요약을 다시 추출했습니다.");
    } catch (err) {
      if (requestId !== metadataRegenerationRequestRef.current) return;
      toast.error(`요약 재추출 실패: ${resolveAxiosError(err)}`);
    } finally {
      if (requestId === metadataRegenerationRequestRef.current) {
        setMetadataSummaryReextracting(false);
      }
    }
  }

  async function toggleKoreanMetadataSummary() {
    if (showKoreanTranslation) {
      setShowKoreanTranslation(false);
      return;
    }
    if (metadataTranslation) {
      setShowKoreanTranslation(true);
      return;
    }
    if (!documentId || metadataTranslationLoading || !metadataSummary?.summary) return;
    const confirmed = window.confirm(
      "원문 요약과 키워드를 한국어로 번역합니다. 저장된 번역이 없으면 모델 사용 비용이 발생할 수 있습니다. 계속하시겠습니까?"
    );
    if (!confirmed) return;

    const requestId = ++metadataTranslationRequestRef.current;
    setMetadataTranslationLoading(true);
    try {
      const translated = await reactMarkdownDocumentApi.translateMetadataSummary(documentId, revisionId, "ko");
      if (requestId !== metadataTranslationRequestRef.current) return;
      setMetadataTranslation(translated);
      setShowKoreanTranslation(true);
      toast.success(translated.reused
        ? "저장된 한국어 번역을 불러왔습니다."
        : "한국어 번역을 생성했습니다.");
    } catch (err) {
      if (requestId !== metadataTranslationRequestRef.current) return;
      toast.error(`한국어 번역 실패: ${resolveAxiosError(err)}`);
    } finally {
      if (requestId === metadataTranslationRequestRef.current) {
        setMetadataTranslationLoading(false);
      }
    }
  }


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

  // Load detailed metadata
  async function loadMetadata(force = false) {
    const cached = metadataCacheRef.current.get(metadataCacheKey);
    if (!force && cached) {
      setResources(cached.resources);
      setLocators(cached.locators);
      setProvenances(locatorsToProvenances(cached.locators));
      setMetadataDetailsLoaded(true);
      setMetadataError(null);
      return;
    }
    const requestId = ++metadataRequestRef.current;
    setMetadataLoading(true);
    setMetadataError(null);
    try {
      const [resData, locData] = await Promise.all([
        reactMarkdownDocumentApi.getResources(documentId, revisionId),
        reactMarkdownDocumentApi.getLocators(documentId, revisionId),
      ]);
      if (requestId !== metadataRequestRef.current) {
        return;
      }
      metadataCacheRef.current.set(metadataCacheKey, {
        resources: resData,
        locators: locData,
      });
      setResources(resData);
      setLocators(locData);
      setProvenances(locatorsToProvenances(locData));
      setMetadataDetailsLoaded(true);
    } catch (err: any) {
      if (requestId !== metadataRequestRef.current) {
        return;
      }
      setMetadataDetailsLoaded(false);
      setMetadataError(err?.message || "메타데이터를 불러오는 도중 오류가 발생했습니다.");
    } finally {
      if (requestId === metadataRequestRef.current) {
        setMetadataLoading(false);
      }
    }
  }

  useEffect(() => {
    // Reset all states when documentId or revisionId changes
    metadataSummaryRequestRef.current += 1;
    metadataRequestRef.current += 1;
    metadataRegenerationRequestRef.current += 1;
    metadataTranslationRequestRef.current += 1;
    setMetadataSummaryLoading(false);
    setMetadataLoading(false);
    setMetadataSummary(null);
    setMetadataSummaryError(null);
    setMetadataSummaryExpanded(true);
    setMetadataSummaryReextracting(false);
    setMetadataTranslation(null);
    setMetadataTranslationLoading(false);
    setShowKoreanTranslation(false);
    setMetadataDetailsRequested(false);
    setMetadataDetailsLoaded(false);
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
    setSelectedProv(null);
  }, [documentId, revisionId]);

  useEffect(() => {
    if (!open) {
      metadataSummaryRequestRef.current += 1;
      metadataRequestRef.current += 1;
      metadataRegenerationRequestRef.current += 1;
      metadataTranslationRequestRef.current += 1;
      setMetadataSummaryLoading(false);
      setMetadataLoading(false);
      setMetadataSummaryError(null);
      setMetadataSummaryExpanded(true);
      setMetadataSummaryReextracting(false);
      setMetadataTranslation(null);
      setMetadataTranslationLoading(false);
      setShowKoreanTranslation(false);
      setMetadataError(null);
      setMetadataDetailsRequested(false);
      setMetadataDetailsLoaded(false);
      setSelectedProv(null);
      setActiveTab("markdown");
      setTabValue(0);
    }
  }, [open]);

  useEffect(() => {
    if (open && documentId) {
      void loadMarkdown();
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [open, documentId, revisionId]);

  useEffect(() => {
    if (open && documentId && activeTab === "metadata") {
      void loadMetadataSummary();
    }
  }, [activeTab, open, documentId, revisionId]);

  useEffect(() => {
    if (open && documentId && activeTab === "metadata" && metadataDetailsRequested) {
      void loadMetadata();
    }
  }, [activeTab, open, documentId, revisionId, metadataDetailsRequested]);

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
    const normResource = resources.find(r => r.resourceType === "NORMALIZED_DOCUMENT");
    let normMeta: any = null;

    if (normResource) {
      if (normResource.metadataJson) {
        normMeta = parseSafeJson(normResource.metadataJson);
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

      return {
        ...prov,
        index,
        resolvedPage: page,
        resolvedSlide: slide,
        bbox: prov.bbox || parsedMeta.bbox || null,
        confidence: prov.confidence ?? parsedMeta.confidence ?? null,
      };
    });

    const totalProvenanceCount = parsedProvenances.length;

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

    const normalizationIssues = normMeta?.normalizationIssues || [];
    const markdownQualityIssues = ocrRaw?.markdownQualityIssues || [];
    const allIssues = [...new Set([...normalizationIssues, ...markdownQualityIssues])];

    // 이슈 친근한 명칭 변환 딕셔너리
    const issueLabels: Record<string, string> = {
      MATH_DOCUMENT_REVIEW_REQUIRED: "수학 기호 및 공식 복원 검토 필요",
      KOREAN_SPACING_REVIEW_REQUIRED: "한국어 띄어쓰기/맞춤법 보정 검토 필요",
      PAGE_QUALITY_REVIEW_REQUIRED: "페이지 전반의 추출 품질 검토 필요",
    };

    const translatedView = showKoreanTranslation ? metadataTranslation : null;
    const displayedSummary = translatedView?.summary ?? metadataSummary?.summary ?? null;
    const displayedKeywords = translatedView?.keywords ?? metadataSummary?.keywords ?? [];
    const canTranslateSummary = Boolean(metadataSummary?.summary)
      && !isKoreanSummary(metadataSummary?.language, metadataSummary?.summary);

    return (
      <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
        {usabilityQuery.isLoading ? (
          <Stack spacing={1.25} alignItems="center" sx={{ py: 5 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">RAG 사용 가능 상태를 확인하는 중입니다...</Typography>
          </Stack>
        ) : usabilityQuery.error ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => void usabilityQuery.refetch()}>
                다시 시도
              </Button>
            }
          >
            RAG 상태를 불러오지 못했습니다: {resolveAxiosError(usabilityQuery.error)}
          </Alert>
        ) : usabilityQuery.data ? (
          <DocumentUsabilityPanel
            assessment={usabilityQuery.data}
            basisMatches={!revisionId || usabilityQuery.data.basis.revisionId === revisionId}
            evaluating={autoEvaluationMutation.isPending}
            evaluationError={autoEvaluationMutation.error ? resolveAxiosError(autoEvaluationMutation.error) : null}
            onAutoEvaluate={() => autoEvaluationMutation.mutate()}
          />
        ) : null}

        {metadataSummaryLoading && !metadataSummary && !metadataSummaryError ? (
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                요약 메타데이터를 불러오는 중입니다...
              </Typography>
            </Stack>
          </Paper>
        ) : metadataSummary ? (
          <Accordion
            expanded={metadataSummaryExpanded}
            onChange={(_, expanded) => setMetadataSummaryExpanded(expanded)}
            disableGutters
            variant="outlined"
            sx={{ borderRadius: 2, overflow: "hidden", "&:before": { display: "none" } }}
          >
            <AccordionSummary
              aria-label={`문서 메타데이터 요약 ${metadataSummaryExpanded ? "접기" : "펼치기"}`}
              expandIcon={(
                <Box
                  component="span"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    px: 1.25,
                    py: 0.5,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    color: "text.secondary",
                  }}
                >
                  <Typography component="span" variant="caption" sx={{ fontWeight: 700 }}>
                    {metadataSummaryExpanded ? "접기" : "펼치기"}
                  </Typography>
                  {metadataSummaryExpanded ? (
                    <ExpandLessOutlined sx={{ fontSize: 16 }} />
                  ) : (
                    <ExpandMoreOutlined sx={{ fontSize: 16 }} />
                  )}
                </Box>
              )}
              sx={{
                px: 3,
                "& .MuiAccordionSummary-content": { my: 2 },
                "& .MuiAccordionSummary-expandIconWrapper.Mui-expanded": { transform: "none" },
              }}
            >
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  문서 메타데이터 요약
                </Typography>
                {metadataSummary.semanticType ? (
                  <Chip size="small" label={metadataSummary.semanticType} color="primary" variant="outlined" />
                ) : null}
                {metadataSummary.quality ? (
                  <Chip size="small" label={`품질 ${metadataSummary.quality}`} variant="outlined" />
                ) : null}
                {metadataSummary.confidence != null ? (
                  <Chip size="small" label={`신뢰도 ${(metadataSummary.confidence * 100).toFixed(0)}%`} variant="outlined" />
                ) : null}
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 3, pt: 0, pb: 3 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} justifyContent="flex-end" useFlexGap flexWrap="wrap">
                  {canTranslateSummary ? (
                    <Button
                      size="small"
                      variant={showKoreanTranslation ? "contained" : "outlined"}
                      startIcon={metadataTranslationLoading
                        ? <CircularProgress size={14} color="inherit" />
                        : <TranslateOutlined />}
                      disabled={metadataTranslationLoading || metadataSummaryReextracting}
                      onClick={() => void toggleKoreanMetadataSummary()}
                    >
                      {metadataTranslationLoading
                        ? "한국어 번역 중..."
                        : showKoreanTranslation
                          ? "원문으로 보기"
                          : "한국어로 보기"}
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={metadataSummaryReextracting
                      ? <CircularProgress size={14} color="inherit" />
                      : <RefreshOutlined />}
                    disabled={metadataSummaryReextracting}
                    onClick={() => void reextractMetadataSummary()}
                  >
                    {metadataSummaryReextracting ? "요약 재추출 중..." : "요약 재추출"}
                  </Button>
                </Stack>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 8 }}>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {metadataSummary.title || "제목 정보 없음"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.7 }}>
                      {displayedSummary || "문서 요약은 아직 추출되지 않았습니다."}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Stack spacing={1}>
                      {metadataSummary.authors.length > 0 ? (
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">저자</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{metadataSummary.authors.join(", ")}</Typography>
                        </Box>
                      ) : null}
                      {metadataSummary.organization ? (
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">기관</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{metadataSummary.organization}</Typography>
                        </Box>
                      ) : null}
                      {metadataSummary.publicationYear ? (
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">발행 연도</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{metadataSummary.publicationYear}</Typography>
                        </Box>
                      ) : null}
                      {metadataSummary.subject ? (
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">주제</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{metadataSummary.subject}</Typography>
                        </Box>
                      ) : null}
                    </Stack>
                  </Grid>
                </Grid>
                {displayedKeywords.length > 0 ? (
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {displayedKeywords.map((keyword) => (
                      <Chip key={keyword} size="small" label={keyword} />
                    ))}
                    {showKoreanTranslation ? (
                      <Chip size="small" color="secondary" variant="outlined" label="한국어 번역" />
                    ) : null}
                  </Stack>
                ) : null}
                {metadataSummary.warnings.length > 0 ? (
                  <Alert severity="warning">{metadataSummary.warnings.join(", ")}</Alert>
                ) : null}
              </Stack>
            </AccordionDetails>
          </Accordion>
        ) : metadataSummaryError ? (
          <Alert
            severity="info"
            action={
              <Stack direction="row" spacing={0.5}>
                <Button
                  color="inherit"
                  size="small"
                  disabled={metadataSummaryReextracting}
                  onClick={() => void reextractMetadataSummary()}
                >
                  {metadataSummaryReextracting ? "재추출 중..." : "요약 재추출"}
                </Button>
                <Button color="inherit" size="small" onClick={() => void loadMetadataSummary(true)}>
                  다시 시도
                </Button>
              </Stack>
            }
          >
            요약 메타데이터를 바로 불러오지 못했습니다: {metadataSummaryError}
          </Alert>
        ) : null}

        {progress ? (
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="caption" color="text.secondary" display="block">파이프라인 단계</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{progress.currentStage || "-"}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="caption" color="text.secondary" display="block">상태</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{progress.status || "-"}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Typography variant="caption" color="text.secondary" display="block">Revision</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{revisionId || metadataSummary?.revisionId || "-"}</Typography>
              </Grid>
            </Grid>
          </Paper>
        ) : null}

        {!metadataDetailsLoaded && !metadataDetailsRequested ? (
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Stack spacing={1.25}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                상세 메타데이터는 필요할 때만 불러옵니다
              </Typography>
              <Typography variant="body2" color="text.secondary">
                원문 위치 정보, 리소스 JSON, OCR 진단처럼 큰 payload는 별도 요청으로 지연시킵니다.
              </Typography>
              <Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<RefreshOutlined />}
                  onClick={() => setMetadataDetailsRequested(true)}
                >
                  상세 데이터 불러오기
                </Button>
              </Box>
            </Stack>
          </Paper>
        ) : null}

        {metadataDetailsRequested && metadataLoading ? (
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                상세 메타데이터를 불러오는 중입니다...
              </Typography>
            </Stack>
          </Paper>
        ) : null}

        {metadataDetailsRequested && metadataError ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => void loadMetadata(true)}>
                다시 시도
              </Button>
            }
          >
            상세 메타데이터를 불러오지 못했습니다: {metadataError}
          </Alert>
        ) : null}

        {/* C. OCR 및 Vision LLM 설정 요약 카드 */}
        {metadataDetailsLoaded && hasOcrInfo && (
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                텍스트 추출 및 OCR 사양
              </Typography>
              <Chip
                label={ocrBadgeLabel(ocrMeta)}
                color={ocrBadgeColor(ocrMeta)}
                size="small"
                variant="filled"
                sx={{ fontWeight: 700, fontSize: 10.5 }}
              />
            </Stack>

            <Grid container spacing={2.5} sx={{ mb: 1.5 }}>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary" display="block">OCR 강제 설정</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{ocrMeta.ocrMode ?? "-"}</Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary" display="block">OCR 실제 적용</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{ocrMeta.ocrApplied == null ? "-" : ocrMeta.ocrApplied ? "예" : "아니오"}</Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary" display="block">수식 보정 적용</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{ocrMeta.mathVisionCorrectionApplied == null ? "-" : ocrMeta.mathVisionCorrectionApplied ? "예" : "아니오"}</Typography>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Typography variant="caption" color="text.secondary" display="block">처리 엔진</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{ocrMeta.ocrEngine ?? "-"}</Typography>
              </Grid>
            </Grid>

            {ocrMeta.mathVisionCorrectionRequested && (
              <Box sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 1.5, borderLeft: "4px solid", borderColor: "secondary.main", mt: 1.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "secondary.dark", display: "block", mb: 0.5 }}>
                  Vision LLM 보정 상태
                </Typography>
                <Typography variant="body2" sx={{ fontSize: 12.5 }}>
                  보정 엔진: <strong>{ocrMeta.mathVisionCorrectionProvider || "-"}</strong> / 보정된 수식 블록: <strong>{ocrMeta.mathVisionFormulaBlockCount ?? 0}개</strong>
                </Typography>
                {ocrMeta.mathVisionCorrectionSkipReason && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    미적용 사유: {ocrMeta.mathVisionCorrectionSkipReason}
                  </Typography>
                )}
              </Box>
            )}
          </Paper>
        )}

        {/* D. 아코디언 상세 분석 데이터 목록 */}
        {metadataDetailsLoaded ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, pl: 0.5 }}>
            상세 원시 데이터 분석 (개발 및 디버깅용 접기)
          </Typography>

          {/* 1. 품질 이슈 상세 */}
          {allIssues.length > 0 && (
            <Accordion variant="outlined" sx={{ borderRadius: 1.5, "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ py: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: "warning.dark" }}>
                  ⚠ 품질 이상 경고 ({allIssues.length}개 이슈 검출)
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ bgcolor: "action.hover", px: 3, pb: 3.5 }}>
                <Stack spacing={1}>
                  {allIssues.map((issue: string, idx: number) => (
                    <Box key={idx} sx={{ p: 1.5, bgcolor: "background.paper", borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>
                        {issueLabels[issue] || issue}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        시스템 분류 코드: {issue}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </AccordionDetails>
            </Accordion>
          )}

          {/* 2. 원문 위치 매핑 상세 테이블 */}
          <Accordion variant="outlined" sx={{ borderRadius: 1.5, "&:before": { display: "none" } }}>
            <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ py: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                🔍 원문 위치 정보 상세 (Provenance List - 총 {totalProvenanceCount}개)
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pb: 3.5 }}>
              {/* 페이지/슬라이드별 블록 개수 히스토그램 형태 표시 */}
              {(uniquePages.length > 0 || uniqueSlides.length > 0) && (
                <Box sx={{ mb: 2 }}>
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

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: selectedProv ? 7 : 12 }}>
                  <TableContainer sx={{ maxHeight: 300, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
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

                {selectedProv && (
                  <Grid size={{ xs: 12, md: 5 }}>
                    <Card variant="outlined" sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column" }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          위치 정보 상세
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
                          <Typography variant="caption" color="text.secondary" display="block">정규화 위치</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: "primary.main" }}>
                            {selectedProv.resolvedPage != null ? `PDF Page ${selectedProv.resolvedPage}` : ""}
                            {selectedProv.resolvedSlide != null ? `PPTX Slide ${selectedProv.resolvedSlide}` : ""}
                            {selectedProv.resolvedPage == null && selectedProv.resolvedSlide == null ? "미지정" : ""}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">BBox 좌표</Typography>
                          <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 12.5 }}>
                            {selectedProv.bbox ? `[${selectedProv.bbox.join(", ")}]` : "좌표 없음"}
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
                          <Typography variant="caption" color="text.secondary" display="block">메타데이터 (metadataJson)</Typography>
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
            </AccordionDetails>
          </Accordion>

          {/* 3. 블록 타입 분류 아코디언 */}
          <Accordion variant="outlined" sx={{ borderRadius: 1.5, "&:before": { display: "none" } }}>
            <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ py: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                📊 블록 분류 상세 통계 (Block breakdown)
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 3, pb: 3 }}>
              {Object.keys(blockCounts).length === 0 ? (
                <Typography variant="body2" color="text.secondary">정보가 없습니다.</Typography>
              ) : (
                <Grid container spacing={2}>
                  {Object.entries(blockCounts).map(([type, count]) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={type}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.75, borderBottom: "1px dashed", borderColor: "divider" }}>
                        <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 13 }}>{type}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{count}개</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
            </AccordionDetails>
          </Accordion>

          {/* 4. 문서 목차 정보 아코디언 */}
          <Accordion variant="outlined" sx={{ borderRadius: 1.5, "&:before": { display: "none" } }}>
            <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ py: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                📖 문서 목차 구조 상세 (Locators - 총 {locators.length}개)
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pb: 3.5 }}>
              {locators.length === 0 ? (
                <Typography variant="body2" color="text.secondary">목차 정보가 없습니다.</Typography>
              ) : (
                <TableContainer sx={{ maxHeight: 250, overflow: "auto" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper", fontSize: 12 }}>유형</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper", fontSize: 12 }}>페이지</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper", fontSize: 12 }}>제목</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: "background.paper", fontSize: 12 }}>Action</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {locators.map((loc) => (
                        <TableRow key={loc.locatorId}>
                          <TableCell sx={{ fontSize: 12 }}>{loc.locatorType || "-"}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{loc.page ?? loc.locatorNo ?? "-"}페이지</TableCell>
                          <TableCell sx={{ fontSize: 12, fontWeight: 500 }}>{loc.title || "-"}</TableCell>
                          <TableCell>
                            {(loc.page ?? loc.locatorNo) != null && (
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<VisibilityOutlined sx={{ fontSize: 12 }} />}
                                onClick={() => void openPagePreview((loc.page ?? loc.locatorNo)!)}
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
            </AccordionDetails>
          </Accordion>

          {/* 5. 문서 메타데이터 정보 아코디언 */}
          {docMetadata && typeof docMetadata === "object" && Object.keys(docMetadata).length > 0 && (
            <Accordion variant="outlined" sx={{ borderRadius: 1.5, "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ py: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  📄 문서 기본 정보 상세 (Document Metadata)
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 3, pb: 3 }}>
                <Grid container spacing={2.5}>
                  {Object.entries(docMetadata).map(([key, value]) => (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={key}>
                      <Typography variant="caption" color="text.secondary" display="block">{key}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: "break-all" }}>{String(value)}</Typography>
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>
          )}

          {/* 6. 파이프라인 진행 상태 아코디언 */}
          {progress && (
            <Accordion variant="outlined" sx={{ borderRadius: 1.5, "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ py: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  ⚙ 변환 파이프라인 상세 이력 (Pipeline logs)
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 3, pb: 3 }}>
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
              </AccordionDetails>
            </Accordion>
          )}
        </Box>
        ) : null}
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
