import { useState, useEffect, useRef } from "react";
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
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
} from "@mui/material";
import {
  CloseOutlined,
  ContentCopyOutlined,
  DownloadOutlined,
  SearchOutlined,
  RefreshOutlined,
  VisibilityOutlined,
  InfoOutlined,
} from "@mui/icons-material";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { markdown as markdownLang } from "@codemirror/lang-markdown";
import DOMPurify from "dompurify";
import { useAuthStore } from "@/react/auth/store";
import {
  reactMarkdownDocumentApi,
  type MarkdownResourceDto,
  type MarkdownLocatorDto,
  type MarkdownPipelineProgressResponseDto,
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
  const [progress, setProgress] = useState<MarkdownPipelineProgressResponseDto | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Parse markdown to HTML (lightweight custom renderer for preview)
  const renderedHtml = useEffectHtml(text);

  function useEffectHtml(md: string) {
    if (!md) return "";
    let html = md
      // Escaping HTML characters first for safety
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // Headers
      .replace(/^###### (.*$)/gim, "<h6>$1</h6>")
      .replace(/^##### (.*$)/gim, "<h5>$1</h5>")
      .replace(/^#### (.*$)/gim, "<h4>$1</h4>")
      .replace(/^### (.*$)/gim, "<h3>$1</h3>")
      .replace(/^## (.*$)/gim, "<h2>$1</h2>")
      .replace(/^# (.*$)/gim, "<h1>$1</h1>")
      // Code Blocks
      .replace(/```([\s\S]*?)```/gm, "<pre><code>$1</code></pre>")
      // Inline Code
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      // Italic
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      // Blockquotes
      .replace(/^\> (.*$)/gim, "<blockquote>$1</blockquote>")
      // Unordered lists
      .replace(/^\s*[\-\*]\s+(.*$)/gim, "<ul><li>$1</li></ul>")
      // Replace duplicate closing/opening list tags
      .replace(/<\/ul>\s*<ul>/g, "")
      // Paragraphs
      .split("\n\n")
      .map(p => {
        if (p.trim().startsWith("<h") || p.trim().startsWith("<pre") || p.trim().startsWith("<ul") || p.trim().startsWith("<block")) {
          return p;
        }
        return `<p>${p.replace(/\n/g, "<br />")}</p>`;
      })
      .join("\n");

    return DOMPurify.sanitize(html);
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

  // Load Metadata
  async function loadMetadata() {
    setMetadataLoading(true);
    setMetadataError(null);
    try {
      const [resData, locData, progData] = await Promise.all([
        reactMarkdownDocumentApi.getResources(documentId),
        reactMarkdownDocumentApi.getLocators(documentId),
        reactMarkdownDocumentApi.getProgress(documentId).catch(() => null),
      ]);
      setResources(resData);
      setLocators(locData);
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
      if (activeTab === "markdown") {
        void loadMarkdown();
      } else if (activeTab === "metadata" && resources.length === 0 && locators.length === 0 && !progress) {
        void loadMetadata();
      }
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [open, activeTab, documentId, revisionId]);

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

  // Helper parser for resource metadataJson
  function parseMetadataJson(resource: MarkdownResourceDto): any | null {
    if (!resource.metadataJson) return null;
    try {
      return JSON.parse(resource.metadataJson);
    } catch {
      return null;
    }
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
        normMeta = parseMetadataJson(normResource);
        if (!normMeta) {
          parseFailed = true;
        }
      }
    }

    // Block type summary calculation
    const blockCounts: Record<string, number> = {};
    if (normMeta?.document?.blocks && Array.isArray(normMeta.document.blocks)) {
      normMeta.document.blocks.forEach((b: any) => {
        const type = b.type || "UNKNOWN";
        blockCounts[type] = (blockCounts[type] || 0) + 1;
      });
    }

    const docMetadata = normMeta?.document?.metadata || null;

    // OCR info: from normMeta top-level or any resource metadataJson
    // Try normMeta first, then other resources
    const ocrMeta: any = normMeta ?? (() => {
      for (const r of resources) {
        const m = parseMetadataJson(r);
        if (m && (m.ocrApplied != null || m.ocrRequested != null || m.ocrRequired != null)) return m;
      }
      return null;
    })();
    const ocrRequested: boolean | null | undefined = ocrMeta?.ocrRequested ?? ocrMeta?.ocrRequired;
    const ocrApplied: boolean | null | undefined = ocrMeta?.ocrApplied;
    const ocrEngine: string | null | undefined = ocrMeta?.ocrEngine ?? ocrMeta?.pdfExtractionEngine;
    const ocrUnavailableReason: string | null | undefined = ocrMeta?.ocrUnavailableReason;
    const pdfOcrFallback: boolean | null | undefined = ocrMeta?.pdfOcrFallback;
    const hasOcrInfo = ocrRequested != null || ocrApplied != null || ocrEngine != null;

    // Determine OCR status label
    function getOcrStatusLabel(): { label: string; color: "success" | "warning" | "info" | "default" } {
      if (ocrRequested === true && ocrApplied === true) {
        return { label: "OCR 적용됨", color: "success" };
      } else if (ocrRequested === true && ocrApplied === false) {
        return { label: "OCR 요청됨 / 미적용", color: "warning" };
      } else if (ocrRequested === false && ocrApplied === true) {
        return { label: "OCR fallback 적용됨", color: "info" };
      } else if (ocrRequested === false && ocrApplied === false) {
        return { label: "OCR 미사용", color: "default" };
      }
      return { label: "-", color: "default" };
    }

    return (
      <Box sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {/* 1. Normalization Summary */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
                <InfoOutlined color="primary" fontSize="small" /> 정규화 요약 (Normalization Summary)
              </Typography>
              {parseFailed ? (
                <Typography variant="body2" color="error">메타데이터를 해석할 수 없습니다.</Typography>
              ) : !normMeta ? (
                <Typography variant="body2" color="text.secondary">정규화 메타데이터가 없습니다.</Typography>
              ) : (
                <Stack spacing={1.5}>
                  <Grid container spacing={1}>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" display="block">Schema Version</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{normMeta.schemaVersion || "-"}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" display="block">Status</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{normMeta.normalizationStatus || "-"}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" display="block">Source</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{normMeta.normalizationSource || "-"}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" display="block">Blocks / Pages</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {normMeta.blockCount != null ? `${normMeta.blockCount} Blocks` : "-"} / {normMeta.pageCount != null ? `${normMeta.pageCount} Pages` : "-"}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="text.secondary" display="block">Tables / Images</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {normMeta.tableCount != null ? `${normMeta.tableCount} Tables` : "-"} / {normMeta.imageCount != null ? `${normMeta.imageCount} Images` : "-"}
                      </Typography>
                    </Grid>
                  </Grid>

                  {normMeta.normalizationIssues && normMeta.normalizationIssues.length > 0 && (
                    <Box sx={{ mt: 1, p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: "warning.main", display: "block", mb: 0.5 }}>
                        정규화 이슈 ({normMeta.normalizationIssues.length}개)
                      </Typography>
                      {normMeta.normalizationIssues.map((issue: string, idx: number) => (
                        <Typography key={idx} variant="caption" color="text.secondary" display="block">
                          • {issue}
                        </Typography>
                      ))}
                    </Box>
                  )}
                </Stack>
              )}
            </Paper>
          </Grid>

          {/* 2. Block Summary */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                블록 요약 (Block Summary)
              </Typography>
              {Object.keys(blockCounts).length === 0 ? (
                <Typography variant="body2" color="text.secondary">블록 정보가 없습니다.</Typography>
              ) : (
                <Stack spacing={1}>
                  {Object.entries(blockCounts).map(([type, count]) => (
                    <Box key={type} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.5, borderBottom: "1px dashed", borderColor: "divider" }}>
                      <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: 13 }}>{type}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{count}</Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Paper>
          </Grid>

          {/* 3. OCR Summary */}
          {hasOcrInfo && (() => {
            const { label, color } = getOcrStatusLabel();
            return (
              <Grid size={{ xs: 12 }}>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      OCR 요약
                    </Typography>
                    <Chip label={label} color={color} size="small" variant="filled" sx={{ fontWeight: 600, fontSize: 11 }} />
                  </Stack>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="caption" color="text.secondary" display="block">OCR 요청</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {ocrRequested == null ? "-" : ocrRequested ? "예" : "아니오"}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="caption" color="text.secondary" display="block">OCR 적용</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {ocrApplied == null ? "-" : ocrApplied ? "예" : "아니오"}
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="caption" color="text.secondary" display="block">PDF 추출 엔진</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{ocrEngine || "-"}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="caption" color="text.secondary" display="block">OCR Fallback</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {pdfOcrFallback == null ? "-" : pdfOcrFallback ? "예" : "아니오"}
                      </Typography>
                    </Grid>
                    {ocrRequested === true && ocrApplied === false && (
                      <Grid size={{ xs: 12 }}>
                        <Typography variant="caption" color="text.secondary" display="block">OCR 미적용 사유</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: ocrUnavailableReason ? "text.primary" : "text.secondary" }}>
                          {ocrUnavailableReason ||
                            "추출 엔진이 OCR 없이 텍스트 레이어를 사용했을 수 있습니다."}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              </Grid>
            );
          })()}

          {/* 4. Document Metadata */}
          {docMetadata && typeof docMetadata === "object" && Object.keys(docMetadata).length > 0 && (
            <Grid size={{ xs: 12 }}>
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                  문서 메타데이터 (Document Metadata)
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

          {/* 4. Pipeline Progress */}
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

          {/* 5. Locators */}
          <Grid size={{ xs: 12 }}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                위치 정보 (Locators)
              </Typography>
              {locators.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Locator 정보가 없습니다.</Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Level</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Page Number</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Title</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Locator ID</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Offsets</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {locators.map((loc) => (
                        <TableRow key={loc.locatorId}>
                          <TableCell sx={{ fontSize: 12.5 }}>{loc.level ?? "-"}</TableCell>
                          <TableCell sx={{ fontSize: 12.5 }}>{loc.pageNumber ?? "-"}</TableCell>
                          <TableCell sx={{ fontSize: 12.5 }}>{loc.title || "-"}</TableCell>
                          <TableCell sx={{ fontSize: 12.5 }}>{loc.locatorId || "-"}</TableCell>
                          <TableCell sx={{ fontSize: 12.5 }}>{loc.startOffset} ~ {loc.endOffset}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>
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
      sx={{
        "& .MuiDialog-paper": {
          height: "85vh",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <DialogTitle sx={{ p: 2, display: "flex", alignItems: "center", borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
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
                        "& li": { my: 0.5 },
                      }}
                      dangerouslySetInnerHTML={{ __html: renderedHtml }}
                    />
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
    </Dialog>
  );
}
