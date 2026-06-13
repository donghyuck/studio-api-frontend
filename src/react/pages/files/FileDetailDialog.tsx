import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Checkbox,
  FormControlLabel,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import {
  CloseOutlined,
  ContentCopyOutlined,
  RefreshOutlined,
  TextSnippetOutlined,
  TimelineOutlined,
  ExpandMoreOutlined,
} from "@mui/icons-material";
import dayjs from "dayjs";
import { useAuthStore } from "@/react/auth/store";
import { useToast } from "@/react/feedback";
import { reactAiApi, type EmbeddingOption } from "@/react/pages/ai/api";
import {
  reactFilesApi,
  reactDocumentConvertApi,
  reactMarkdownDocumentApi,
  type DocumentConvertStatus,
  type DocumentConvertJob,
  type MarkdownDocumentRevisionDto,
} from "@/react/pages/files/api";
import type { AttachmentDto } from "@/types/studio/files";
import type { RagIndexJobStatus, RagIndexJobStep } from "@/types/studio/ai";
import { resolveAxiosError } from "@/utils/helpers";
import { DocumentConvertDialog, getDocumentFormat, getFriendlyErrorMessage } from "./DocumentConvertDialog";
import { useMarkdownDocumentPolling } from "./hooks/useMarkdownDocumentPolling";

const THUMBNAIL_RETRY_INTERVAL_MS = 1500;
const THUMBNAIL_RETRY_LIMIT = 8;

interface Props {
  open: boolean;
  onClose: () => void;
  attachmentId: number;
}

function formatFileSize(size?: number | null) {
  if (size == null) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(value?: Date | string | null) {
  return value ? dayjs(value).format("YYYY-MM-DD HH:mm:ss") : "";
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replaceAll(String.fromCharCode(0), "")
    .replace(/\f/g, "\n\n")
    .trim();
}



export function FileDetailDialog({ open, onClose, attachmentId }: Props) {
  const toast = useToast();
  const [file, setFile] = useState<AttachmentDto | null>(null);
  const [ragIndexed, setRagIndexed] = useState(false);
  const [ragMetadata, setRagMetadata] = useState<Record<string, unknown> | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [textExtracted, setTextExtracted] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [thumbnailAvailable, setThumbnailAvailable] = useState(false);
  const [thumbnailReloadKey, setThumbnailReloadKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [textExtracting, setTextExtracting] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);

  // Markdown Document Conversion / extraction states
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [reused, setReused] = useState<boolean | null>(null);
  const [runChunking, setRunChunking] = useState<boolean>(true);
  const [runRagIndex, setRunRagIndex] = useState<boolean>(true);
  const [runSkillExtraction, setRunSkillExtraction] = useState<boolean>(false);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isCanceling, setIsCanceling] = useState<boolean>(false);

  const {
    latestRevision,
    status: markdownStatus,
    error: markdownError,
    isPolling: markdownIsPolling,
    startPolling,
    stopPolling,
    setLatestRevision,
    setStatus: setMarkdownStatus,
    setError: setMarkdownError,
  } = useMarkdownDocumentPolling();

  const roles = useAuthStore((state) => state.user?.roles) ?? [];
  const canManage = roles.includes("ROLE_ADMIN") || roles.includes("ADMIN") || roles.includes("features:document-convert/manage");

  useEffect(() => {
    if (open && attachmentId && file) {
      const resolvedDocId = file.properties?.documentId || localStorage.getItem(`markdown_doc_id_${attachmentId}`);
      if (resolvedDocId) {
        setDocumentId(resolvedDocId);
        startPolling(resolvedDocId);
      } else {
        setDocumentId(null);
        setLatestRevision(null);
        setMarkdownStatus(null);
        setMarkdownError(null);
      }
      setReused(null);
    } else {
      setDocumentId(null);
      setLatestRevision(null);
      setMarkdownStatus(null);
      setMarkdownError(null);
      setReused(null);
      stopPolling();
    }
  }, [open, attachmentId, file, startPolling, stopPolling, setLatestRevision, setMarkdownStatus, setMarkdownError]);

  const metadataEntries = Object.entries(ragMetadata ?? {});
  const format = file ? getDocumentFormat(file.name, file.contentType) : null;
  const isPendingOrRunning = markdownStatus === "PENDING" || markdownStatus === "RUNNING";
  const controlsDisabled = isExtracting || isCanceling || markdownIsPolling;

  function clearThumbnail() {
    setThumbnailAvailable(false);
    setThumbnailUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
      return null;
    });
  }

  async function loadRagState(nextFile: AttachmentDto) {
    try {
      const metadata = await reactAiApi.getRagObjectMetadata("attachment", String(nextFile.attachmentId));
      if (metadata && metadata.indexed !== false && Object.keys(metadata).length > 0) {
        return {
          indexed: true,
          metadata,
        };
      }
    } catch {
      // Ignore and fallback
    }

    const indexed = await reactFilesApi.hasEmbedding(nextFile.attachmentId);
    const metadata = indexed ? await reactFilesApi.ragMetadata(nextFile.attachmentId) : null;
    const hasValidMeta = metadata && metadata.indexed !== false;
    return {
      indexed: indexed && Boolean(hasValidMeta),
      metadata: hasValidMeta ? metadata : null,
    };
  }

  useEffect(() => {
    setFile(null);
    setRagIndexed(false);
    setRagMetadata(null);
    setExtractedText("");
    setTextExtracted(false);
    clearThumbnail();

    if (!open || !attachmentId) {
      return;
    }

    let ignored = false;
    const requestedId = attachmentId;

    async function loadDetail() {
      setLoading(true);
      try {
        const nextFile = await reactFilesApi.getById(requestedId);
        if (ignored || nextFile.attachmentId !== requestedId) {
          return;
        }

        setFile(nextFile);
        setExtractedText("");
        setTextExtracted(false);

        const ragState = await loadRagState(nextFile);
        if (ignored) {
          return;
        }

        setRagIndexed(ragState.indexed);
        setRagMetadata(ragState.metadata);
      } catch (error) {
        if (!ignored) {
          toast.error(resolveAxiosError(error));
          setRagIndexed(false);
          setRagMetadata(null);
        }
      } finally {
        if (!ignored) {
          setLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      ignored = true;
    };
  }, [open, attachmentId, toast]);

  useEffect(() => {
    if (!open || !attachmentId) {
      clearThumbnail();
      return;
    }

    let ignored = false;
    let timer: number | undefined;
    const requestedId = attachmentId;

    function loadThumbnail(attempt: number) {
      reactFilesApi
        .fetchThumbnail(requestedId, 512)
        .then((blob) => {
          if (ignored || requestedId !== attachmentId) {
            return;
          }
          if (blob.size === 0) {
            if (attempt < THUMBNAIL_RETRY_LIMIT) {
              timer = window.setTimeout(() => loadThumbnail(attempt + 1), THUMBNAIL_RETRY_INTERVAL_MS);
            } else {
              setThumbnailAvailable(false);
            }
            return;
          }
          const objectUrl = URL.createObjectURL(blob);
          setThumbnailUrl((currentUrl) => {
            if (currentUrl) {
              URL.revokeObjectURL(currentUrl);
            }
            return objectUrl;
          });
          setThumbnailAvailable(true);
        })
        .catch(() => {
          if (ignored) {
            return;
          }
          if (attempt < THUMBNAIL_RETRY_LIMIT) {
            timer = window.setTimeout(() => loadThumbnail(attempt + 1), THUMBNAIL_RETRY_INTERVAL_MS);
          } else {
            setThumbnailAvailable(false);
          }
        });
    }

    loadThumbnail(0);

    return () => {
      ignored = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [open, attachmentId, thumbnailReloadKey]);

  async function refreshDetail() {
    if (!attachmentId) return;
    if (!file) {
      setFile(null);
      setRagIndexed(false);
      setRagMetadata(null);
      setExtractedText("");
      setTextExtracted(false);
      clearThumbnail();
    }
    setThumbnailReloadKey((current) => current + 1);
    setLoading(true);
    try {
      const nextFile = await reactFilesApi.getById(attachmentId);
      setFile(nextFile);
      const ragState = await loadRagState(nextFile);
      setRagIndexed(ragState.indexed);
      setRagMetadata(ragState.metadata);

      const resolvedDocId = nextFile.properties?.documentId || localStorage.getItem(`markdown_doc_id_${attachmentId}`);
      if (resolvedDocId) {
        setDocumentId(resolvedDocId);
        startPolling(resolvedDocId);
      }
    } catch (error) {
      toast.error(resolveAxiosError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleExtractText() {
    if (!attachmentId || !file) return;
    const ok = window.confirm(`${file.name} 에서 텍스트를 추출하시겠습니까?`);
    if (!ok) return;

    setTextExtracting(true);
    try {
      const text = await reactFilesApi.extractText(attachmentId);
      setExtractedText(normalizeExtractedText(text));
      setTextExtracted(true);
    } catch (error) {
      toast.error(resolveAxiosError(error));
    } finally {
      setTextExtracting(false);
    }
  }

  async function handleCopyExtractedText() {
    const text = extractedText.trim();
    if (!text) {
      toast.warning("복사할 텍스트가 없습니다.");
      return;
    }

    if (!navigator.clipboard?.writeText) {
      toast.error("현재 브라우저에서는 클립보드 복사를 지원하지 않습니다.");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success("클립보드에 복사했습니다.");
    } catch {
      toast.error("클립보드에 복사할 수 없습니다. 브라우저 권한을 확인해 주세요.");
    }
  }

  function sanitizeErrorMessage(msg: string | null | undefined): string {
    if (!msg) return "";
    return msg
      .replace(/(Signature|Expires|AWSAccessKeyId|token|access_token|key)=[^&\s]+/gi, '$1=***')
      .replace(/https?:\/\/[^\s]+(signature|token|key)[^\s]+/gi, '[SENSITIVE_URL]')
      .replace(/(s3|gs):\/\/[a-zA-Z0-9.\-_]+(\/[a-zA-Z0-9.\-_]+)*/gi, '[SENSITIVE_STORAGE_PATH]');
  }

  async function handleExtractMarkdown() {
    if (!attachmentId || !file) return;
    setIsExtracting(true);
    setReused(null);
    try {
      const res = await reactMarkdownDocumentApi.extractFromAttachment({
        attachmentId,
        runChunking,
        runRagIndex,
        runSkillExtraction,
        force: false,
      });
      const newDocId = res.document.documentId;
      setDocumentId(newDocId);
      localStorage.setItem(`markdown_doc_id_${attachmentId}`, newDocId);
      setReused(res.reused);
      if (res.reused) {
        toast.info("기존 변환 결과를 사용합니다.");
      } else {
        toast.success("Markdown 변환 및 RAG 색인 작업이 시작되었습니다.");
      }
      startPolling(newDocId);
    } catch (err) {
      const errMsg = sanitizeErrorMessage(resolveAxiosError(err));
      toast.error("Markdown 변환 요청 실패: " + errMsg);
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleReextractMarkdown() {
    if (!documentId) return;
    const ok = window.confirm("기존 결과와 관계없이 새로 변환 및 색인을 진행하시겠습니까?");
    if (!ok) return;

    setIsExtracting(true);
    setReused(null);
    try {
      const res = await reactMarkdownDocumentApi.reextract(documentId, {
        runChunking,
        runRagIndex,
        runSkillExtraction,
      });
      setReused(res.reused);
      toast.success("재추출 및 RAG 색인 작업이 시작되었습니다.");
      startPolling(documentId);
    } catch (err) {
      const errMsg = sanitizeErrorMessage(resolveAxiosError(err));
      toast.error("재추출 요청 실패: " + errMsg);
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleCancelMarkdown() {
    if (!documentId) return;
    const ok = window.confirm("진행 중인 변환 및 RAG 색인 작업을 취소하시겠습니까?");
    if (!ok) return;

    setIsCanceling(true);
    try {
      await reactMarkdownDocumentApi.cancelExtraction(documentId);
      stopPolling();
      setMarkdownStatus("CANCELED");
      if (latestRevision) {
        setLatestRevision({
          ...latestRevision,
          status: "CANCELED"
        });
      }
      toast.success("작업이 취소되었습니다.");
    } catch (err) {
      const errMsg = sanitizeErrorMessage(resolveAxiosError(err));
      toast.error("작업 취소 실패: " + errMsg);
    } finally {
      setIsCanceling(false);
    }
  }

  function renderDetail(label: string, value?: string | number | null) {
    return (
      <Box>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.25, overflowWrap: "anywhere" }}>
          {value || "-"}
        </Typography>
      </Box>
    );
  }

  const handleAccordionChange = (event: React.SyntheticEvent, isExpanded: boolean) => {
    if (isExpanded) {
      const target = event.currentTarget as HTMLElement;
      setTimeout(() => {
        target.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 240);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 520 },
          maxWidth: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <Stack spacing={0} sx={{ height: "100%", position: "relative", minHeight: 0 }}>
        <Box
          sx={{
            minHeight: 56,
            px: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" noWrap>
              {file?.name ?? "파일 상세"}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {file ? (file.properties?.objectTypeName || file.properties?.objectType || `#${file.attachmentId}`) : ""}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0} alignItems="center" flexShrink={0}>
            <Tooltip title="새로고침">
              <IconButton size="small" onClick={() => void refreshDetail()}>
                <RefreshOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={onClose}>
              <CloseOutlined fontSize="small" />
            </IconButton>
          </Stack>
        </Box>
        <Divider />

        <Stack spacing={2} sx={{ p: 2, flex: 1, overflowY: "auto", minHeight: 0 }}>
          {file ? (
            <>
              {/* 기본 정보 상시 노출 (박스 및 타이틀 없이 수직 나열) */}
              <Stack spacing={2} sx={{ mb: 2 }}>
                {renderDetail("이름", file.name)}
                {renderDetail("콘텐츠 종류", file.contentType)}
                {renderDetail("크기", formatFileSize(file.size))}
                {renderDetail("수정일", formatDate(file.updatedAt || file.createdAt))}

                {thumbnailAvailable && thumbnailUrl ? (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
                      썸네일 프리뷰
                    </Typography>
                    <Box
                      component="img"
                      src={thumbnailUrl}
                      alt={file.name}
                      sx={{
                        width: "100%",
                        maxHeight: 180,
                        objectFit: "contain",
                      }}
                    />
                  </Box>
                ) : null}
              </Stack>

              {/* Accordion Group Container (No Rounding) */}
              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 0,
                  overflow: "hidden",
                  "& .MuiAccordion-root": {
                    border: "none",
                    borderRadius: 0,
                    "&:not(:last-child)": {
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    },
                    "&:before": {
                      display: "none",
                    },
                  },
                }}
              >
                {/* Card 2: Text Extraction Accordion */}
                <Accordion disableGutters square elevation={0} onChange={handleAccordionChange}>
                <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ bgcolor: "action.hover", borderBottom: "1px solid", borderColor: "divider", minHeight: 40, "& .MuiAccordionSummary-content": { my: 1 } }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    텍스트 추출 결과
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 2, bgcolor: "background.paper" }}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      추출 텍스트 관리
                    </Typography>
                    {!textExtracted ? (
                      <Tooltip title="콘텐츠에서 텍스트를 추출합니다.">
                        <span>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<TextSnippetOutlined fontSize="small" />}
                            disabled={textExtracting}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleExtractText();
                            }}
                          >
                            텍스트 추출
                          </Button>
                        </span>
                      </Tooltip>
                    ) : (
                      <Tooltip title="클립보드에 복사">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleCopyExtractedText();
                          }}
                        >
                          <ContentCopyOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                  {textExtracted ? (
                    <Box
                      component="pre"
                      sx={{
                        m: 0,
                        maxHeight: 200,
                        overflow: "auto",
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        bgcolor: "background.default",
                        color: "text.primary",
                        p: 1.5,
                        fontFamily: "monospace",
                        fontSize: 12,
                        lineHeight: 1.6,
                      }}
                    >
                      {extractedText || "-"}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                      추출된 텍스트가 없습니다. 버튼을 눌러 추출을 시작하세요.
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>

              {/* Card 3: Markdown and RAG Accordion */}
              <Accordion defaultExpanded disableGutters square elevation={0} onChange={handleAccordionChange}>
                <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ bgcolor: "action.hover", borderBottom: "1px solid", borderColor: "divider", minHeight: 40, "& .MuiAccordionSummary-content": { my: 1 } }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Markdown 지식 변환 및 RAG 색인
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 2, bgcolor: "background.paper" }}>
                  {/* Checkbox options */}
                  <Stack spacing={0.5} sx={{ mb: 2, bgcolor: "action.hover", p: 1, borderRadius: 1.5 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={runChunking}
                          onChange={(e) => setRunChunking(e.target.checked)}
                          disabled={controlsDisabled}
                        />
                      }
                      label={<Typography variant="body2" sx={{ fontSize: 13 }}>청크 분할 실행 (runChunking)</Typography>}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={runRagIndex}
                          onChange={(e) => setRunRagIndex(e.target.checked)}
                          disabled={controlsDisabled}
                        />
                      }
                      label={<Typography variant="body2" sx={{ fontSize: 13 }}>RAG 색인 실행 (runRagIndex)</Typography>}
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={runSkillExtraction}
                          onChange={(e) => setRunSkillExtraction(e.target.checked)}
                          disabled={controlsDisabled}
                        />
                      }
                      label={<Typography variant="body2" sx={{ fontSize: 13 }}>스킬 추출 실행 (runSkillExtraction)</Typography>}
                    />
                  </Stack>

                  {/* Status and Actions */}
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {markdownStatus ? (
                        <Chip
                          label={markdownStatus}
                          size="small"
                          color={
                            markdownStatus === "COMPLETED" ? "success" :
                            (markdownStatus === "RUNNING" || markdownStatus === "PENDING") ? "primary" :
                            markdownStatus === "FAILED" ? "error" :
                            "default"
                          }
                          sx={{ height: 24, fontWeight: 500 }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          변환 이력이 없습니다.
                        </Typography>
                      )}
                      {reused && markdownStatus === "COMPLETED" && (
                        <Chip label="기존 변환 결과 사용" color="info" size="small" variant="outlined" sx={{ height: 24 }} />
                      )}
                    </Box>

                    {/* Main Action Button */}
                    {!documentId ? (
                      <Button
                        size="small"
                        variant="contained"
                        disabled={controlsDisabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleExtractMarkdown();
                        }}
                      >
                        Markdown 변환
                      </Button>
                    ) : (
                      (markdownStatus === "COMPLETED" || markdownStatus === "FAILED" || markdownStatus === "CANCELED") && (
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={controlsDisabled}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleReextractMarkdown();
                          }}
                        >
                          재추출
                        </Button>
                      )
                    )}
                  </Stack>

                  {/* Polling / Running progress */}
                  {isPendingOrRunning && (
                    <Box sx={{ mt: 1.5, bgcolor: "action.hover", p: 1.5, borderRadius: 1.5, border: "1px dashed", borderColor: "primary.main" }}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <CircularProgress size={16} />
                        <Typography variant="caption" color="text.secondary">
                          Markdown 변환 및 색인이 진행 중입니다...
                        </Typography>
                        <Button
                          size="small"
                          color="error"
                          variant="text"
                          sx={{ minWidth: 0, p: 0, ml: "auto", fontSize: 11 }}
                          disabled={isCanceling}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleCancelMarkdown();
                          }}
                        >
                          {isCanceling ? "취소 중..." : "변환 취소"}
                        </Button>
                      </Stack>
                    </Box>
                  )}

                  {/* FAILED message */}
                  {markdownStatus === "FAILED" && (markdownError || latestRevision?.errorMessage) && (
                    <Box sx={{ mt: 1.5, bgcolor: "error.light", color: "error.contrastText", p: 1.5, borderRadius: 1.5 }}>
                      <Typography variant="caption" display="block" sx={{ fontWeight: "bold", mb: 0.5 }}>
                        실패 원인
                      </Typography>
                      <Typography variant="body2" sx={{ wordBreak: "break-all", fontSize: 12 }}>
                        {sanitizeErrorMessage(latestRevision?.errorMessage || markdownError)}
                      </Typography>
                    </Box>
                  )}

                  {/* COMPLETED result display */}
                  {markdownStatus === "COMPLETED" && latestRevision && (
                    <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                      {latestRevision.markdownText && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                            추출된 Markdown 텍스트
                          </Typography>
                          <Box
                            component="pre"
                            sx={{
                              m: 0,
                              maxHeight: 200,
                              overflow: "auto",
                              whiteSpace: "pre-wrap",
                              overflowWrap: "anywhere",
                              wordBreak: "break-word",
                              border: "1px solid",
                              borderColor: "divider",
                              borderRadius: 1,
                              bgcolor: "background.default",
                              color: "text.primary",
                              p: 1.5,
                              fontFamily: "monospace",
                              fontSize: 12,
                              lineHeight: 1.6,
                            }}
                          >
                            {latestRevision.markdownText}
                          </Box>
                        </Box>
                      )}

                      {latestRevision.resultAttachmentId && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          fullWidth
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.assign(`/api/mgmt/files/${encodeURIComponent(latestRevision.resultAttachmentId!)}/download`);
                          }}
                        >
                          변환 결과 파일 다운로드
                        </Button>
                      )}
                    </Stack>
                  )}
                </AccordionDetails>
              </Accordion>

              {/* Card 4: RAG Metadata Accordion */}
              {metadataEntries.length > 0 ? (
                <Accordion disableGutters square elevation={0} onChange={handleAccordionChange}>
                  <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ bgcolor: "action.hover", borderBottom: "1px solid", borderColor: "divider", minHeight: 40, "& .MuiAccordionSummary-content": { my: 1 } }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      RAG Metadata
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 2, bgcolor: "background.paper" }}>
                    <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, bgcolor: "background.default" }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Value</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {metadataEntries.map(([key, value]) => (
                            <TableRow key={key} sx={{ "&:last-child td, &:last-child th": { border: 0 } }}>
                              <TableCell sx={{ fontWeight: 500, color: "text.secondary" }}>{key}</TableCell>
                              <TableCell sx={{ overflowWrap: "anywhere" }}>{String(value)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>
              ) : null}
              </Box>
            </>
          ) : (
            <Typography color="text.secondary">데이터 없음</Typography>
          )}
        </Stack>

        <Divider />
        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
          <Box>
            {file && getDocumentFormat(file.name, file.contentType) && (
              <Button
                variant="contained"
                color="primary"
                onClick={() => setConvertDialogOpen(true)}
              >
                문서 변환
              </Button>
            )}
          </Box>
          <Button onClick={onClose}>닫기</Button>
        </Stack>

        {loading || textExtracting || isExtracting || isCanceling ? (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              bgcolor: "rgba(255, 255, 255, 0.56)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CircularProgress />
          </Box>
        ) : null}
      </Stack>

      {file && convertDialogOpen && (
        <DocumentConvertDialog
          open={convertDialogOpen}
          onClose={() => setConvertDialogOpen(false)}
          file={file}
        />
      )}
    </Drawer>
  );
}
