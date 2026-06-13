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
  Grid,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
  ToggleButton,
  ToggleButtonGroup,
  Select,
} from "@mui/material";
import {
  CloseOutlined,
  ContentCopyOutlined,
  RefreshOutlined,
  TextSnippetOutlined,
  TimelineOutlined,
  ExpandMoreOutlined,
  DownloadOutlined,
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
  type MarkdownLocatorDto,
  type MarkdownResourceDto,
} from "@/react/pages/files/api";
import { skillGraphApi } from "@/react/pages/ai/skillgraph/api";
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

  // Markdown Document Pipeline States
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [reused, setReused] = useState<boolean | null>(null);
  
  // Pipeline Options
  const [runChunking, setRunChunking] = useState<boolean>(true);
  const [runRagIndex, setRunRagIndex] = useState<boolean>(true);
  const [runSkillExtraction, setRunSkillExtraction] = useState<boolean>(false);
  const [force, setForce] = useState<boolean>(false);

  // Chunking Configuration
  const [chunkingStrategy, setChunkingStrategy] = useState<string>("structure-based");
  const [chunkMaxSize, setChunkMaxSize] = useState<number | string>(800);
  const [chunkOverlap, setChunkOverlap] = useState<number | string>(100);
  const [chunkUnit, setChunkUnit] = useState<string>("TOKEN");

  // RAG Configuration
  const [ragMode, setRagMode] = useState<"profile" | "direct">("profile");
  const [embeddingProfileId, setEmbeddingProfileId] = useState<string>("retrieval");
  const [embeddingProvider, setEmbeddingProvider] = useState<string>("google");
  const [embeddingModel, setEmbeddingModel] = useState<string>("gemini-embedding-001");
  const [embeddingDimension, setEmbeddingDimension] = useState<number | string>(768);

  // Locators & Resources
  const [locators, setLocators] = useState<MarkdownLocatorDto[]>([]);
  const [resources, setResources] = useState<MarkdownResourceDto[]>([]);

  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isCanceling, setIsCanceling] = useState<boolean>(false);

  const {
    latestRevision,
    status: markdownStatus,
    error: markdownError,
    isPolling: markdownIsPolling,
    ragJob,
    skillJob,
    startPolling,
    stopPolling,
    setLatestRevision,
    setStatus: setMarkdownStatus,
    setError: setMarkdownError,
    setRagJob,
    setSkillJob,
  } = useMarkdownDocumentPolling();

  const roles = useAuthStore((state) => state.user?.roles) ?? [];
  const canManage = roles.includes("ROLE_ADMIN") || roles.includes("ADMIN") || roles.includes("features:document-convert/manage");

  // Load locators and resources when Markdown status becomes COMPLETED
  useEffect(() => {
    if (markdownStatus === "COMPLETED" && documentId) {
      let active = true;
      const loadAdditionalInfo = async () => {
        try {
          const [locs, res] = await Promise.all([
            reactMarkdownDocumentApi.getLocators(documentId),
            reactMarkdownDocumentApi.getResources(documentId),
          ]);
          if (active) {
            setLocators(locs);
            setResources(res);
          }
        } catch (err) {
          console.error("Failed to load locators/resources:", err);
        }
      };
      void loadAdditionalInfo();
      return () => {
        active = false;
      };
    } else {
      setLocators([]);
      setResources([]);
    }
  }, [markdownStatus, documentId]);

  useEffect(() => {
    if (open && attachmentId && file) {
      const resolvedDocId = file.properties?.documentId || localStorage.getItem(`markdown_doc_id_${attachmentId}`);
      if (resolvedDocId) {
        setDocumentId(resolvedDocId);
        startPolling(resolvedDocId, { runRagIndex, runSkillExtraction });
      } else {
        setDocumentId(null);
        setLatestRevision(null);
        setMarkdownStatus(null);
        setMarkdownError(null);
        setRagJob(null);
        setSkillJob(null);
      }
      setReused(null);
    } else {
      setDocumentId(null);
      setLatestRevision(null);
      setMarkdownStatus(null);
      setMarkdownError(null);
      setRagJob(null);
      setSkillJob(null);
      setReused(null);
      stopPolling();
    }
  }, [open, attachmentId, file, startPolling, stopPolling, setLatestRevision, setMarkdownStatus, setMarkdownError, setRagJob, setSkillJob]);

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
        startPolling(resolvedDocId, { runRagIndex, runSkillExtraction });
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

  const handleRunChunkingChange = (checked: boolean) => {
    setRunChunking(checked);
    if (!checked) {
      setRunRagIndex(false);
      setRunSkillExtraction(false);
    }
  };

  const handleRunRagIndexChange = (checked: boolean) => {
    setRunRagIndex(checked);
    if (checked) {
      setRunChunking(true);
    } else {
      setRunSkillExtraction(false);
    }
  };

  const handleRunSkillExtractionChange = (checked: boolean) => {
    setRunSkillExtraction(checked);
    if (checked) {
      setRunRagIndex(true);
      setRunChunking(true);
    }
  };

  const buildPayload = () => {
    const maxSize = chunkMaxSize === "" ? null : Number(chunkMaxSize);
    const overlap = chunkOverlap === "" ? null : Number(chunkOverlap);

    if (runChunking) {
      if (maxSize !== null && (isNaN(maxSize) || maxSize <= 0)) {
        throw new Error("최대 크기는 양수여야 합니다.");
      }
      if (overlap !== null && (isNaN(overlap) || overlap < 0)) {
        throw new Error("중첩 크기는 0 이상이어야 합니다.");
      }
      if (maxSize !== null && overlap !== null && overlap >= maxSize) {
        throw new Error("중첩 크기는 최대 크기보다 작아야 합니다.");
      }
    }

    const payload: Record<string, any> = {
      runChunking,
      runRagIndex,
      runSkillExtraction,
      chunkingStrategy: runChunking ? chunkingStrategy : null,
      chunkMaxSize: runChunking ? maxSize : null,
      chunkOverlap: runChunking ? overlap : null,
      chunkUnit: runChunking ? chunkUnit : null,
    };

    if (runRagIndex) {
      if (ragMode === "profile") {
        payload.embeddingProfileId = embeddingProfileId || null;
        payload.embeddingProvider = null;
        payload.embeddingModel = null;
        payload.embeddingDimension = embeddingDimension === "" ? null : Number(embeddingDimension);
      } else {
        payload.embeddingProfileId = null;
        payload.embeddingProvider = embeddingProvider || null;
        payload.embeddingModel = embeddingModel || null;
        payload.embeddingDimension = embeddingDimension === "" ? null : Number(embeddingDimension);
      }
    } else {
      payload.embeddingProfileId = null;
      payload.embeddingProvider = null;
      payload.embeddingModel = null;
      payload.embeddingDimension = null;
    }

    return payload;
  };

  function getErrorMessageByStatus(status: number, originalMsg: string): string {
    if (status === 400) {
      return `옵션 조합 또는 값 오류: ${originalMsg}`;
    }
    if (status === 401 || status === 403) {
      return `인증 실패 또는 Markdown 변환 권한이 부족합니다.`;
    }
    if (status === 404) {
      return `첨부파일 또는 Markdown 문서를 찾을 수 없습니다.`;
    }
    if (status === 409) {
      return `상태 충돌이 발생했습니다. (이미 처리 중이거나 완료됨)`;
    }
    if (status >= 500) {
      return `서버, Pandoc Worker 또는 후속 파이프라인 장애가 발생했습니다.`;
    }
    return originalMsg;
  }

  async function handleExtractMarkdown() {
    if (!attachmentId || !file) return;
    
    let optionsPayload;
    try {
      optionsPayload = buildPayload();
    } catch (err: any) {
      toast.error(err.message);
      return;
    }

    setIsExtracting(true);
    setReused(null);
    try {
      const res = await reactMarkdownDocumentApi.extractFromAttachment({
        attachmentId,
        force,
        ...optionsPayload,
      } as any);
      const newDocId = res.document.documentId;
      setDocumentId(newDocId);
      localStorage.setItem(`markdown_doc_id_${attachmentId}`, newDocId);
      setReused(res.reused);
      if (res.reused) {
        toast.info("기존 변환 결과를 사용합니다.");
      } else {
        toast.success("Markdown 지식 파이프라인 작업이 시작되었습니다.");
      }
      startPolling(newDocId, { runRagIndex, runSkillExtraction });
    } catch (err: any) {
      const status = err?.response?.status;
      const rawMsg = resolveAxiosError(err);
      const errMsg = sanitizeErrorMessage(getErrorMessageByStatus(status, rawMsg));
      toast.error("Markdown 변환 요청 실패: " + errMsg);
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleReextractMarkdown() {
    if (!documentId) return;
    const ok = window.confirm("기존 결과와 관계없이 새로 변환 및 색인을 진행하시겠습니까?");
    if (!ok) return;

    let optionsPayload;
    try {
      optionsPayload = buildPayload();
    } catch (err: any) {
      toast.error(err.message);
      return;
    }

    setIsExtracting(true);
    setReused(null);
    try {
      const res = await reactMarkdownDocumentApi.reextract(documentId, optionsPayload as any);
      setReused(res.reused);
      toast.success("재추출 및 RAG 색인 작업이 시작되었습니다.");
      startPolling(documentId, { runRagIndex, runSkillExtraction });
    } catch (err: any) {
      const status = err?.response?.status;
      const rawMsg = resolveAxiosError(err);
      const errMsg = sanitizeErrorMessage(getErrorMessageByStatus(status, rawMsg));
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
    } catch (err: any) {
      const status = err?.response?.status;
      const rawMsg = resolveAxiosError(err);
      const errMsg = sanitizeErrorMessage(getErrorMessageByStatus(status, rawMsg));
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
          maxHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
      }}
    >
      <Box
          sx={{
            minHeight: 56,
            px: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            flexShrink: 0,
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

        <Box
          sx={{
            p: 2,
            flex: "1 1 0%",
            minHeight: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {file ? (
            <>
              {/* 기본 정보 상시 노출 (박스 및 타이틀 없이 수직 나열) */}
              <Stack spacing={2} sx={{ mb: 2, flexShrink: 0 }}>
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
                  flexShrink: 0,
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

              {/* Card 3: Markdown 지식 파이프라인 Accordion */}
              <Accordion defaultExpanded disableGutters square elevation={0} onChange={handleAccordionChange}>
                <AccordionSummary expandIcon={<ExpandMoreOutlined />} sx={{ bgcolor: "action.hover", borderBottom: "1px solid", borderColor: "divider", minHeight: 40, "& .MuiAccordionSummary-content": { my: 1 } }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Markdown 지식 파이프라인
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 2, bgcolor: "background.paper" }}>
                  
                  {/* Pipeline Options */}
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, fontWeight: 600 }}>
                    파이프라인 단계 선택
                  </Typography>
                  <Grid container spacing={1} sx={{ mb: 2, bgcolor: "action.hover", p: 1.5, borderRadius: 1.5 }}>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <FormControlLabel
                        control={<Checkbox size="small" checked disabled />}
                        label={<Typography variant="body2" sx={{ fontSize: 13 }}>Markdown 생성 (필수)</Typography>}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={runChunking}
                            onChange={(e) => handleRunChunkingChange(e.target.checked)}
                            disabled={controlsDisabled}
                          />
                        }
                        label={<Typography variant="body2" sx={{ fontSize: 13 }}>Chunking 분할</Typography>}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={runRagIndex}
                            onChange={(e) => handleRunRagIndexChange(e.target.checked)}
                            disabled={controlsDisabled}
                          />
                        }
                        label={<Typography variant="body2" sx={{ fontSize: 13 }}>RAG 색인</Typography>}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={runSkillExtraction}
                            onChange={(e) => handleRunSkillExtractionChange(e.target.checked)}
                            disabled={controlsDisabled}
                          />
                        }
                        label={<Typography variant="body2" sx={{ fontSize: 13 }}>Skill 추출</Typography>}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, sm: 4 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            size="small"
                            checked={force}
                            onChange={(e) => setForce(e.target.checked)}
                            disabled={controlsDisabled}
                          />
                        }
                        label={<Typography variant="body2" sx={{ fontSize: 13 }}>강제 재추출 (force)</Typography>}
                      />
                    </Grid>
                  </Grid>

                  {/* Chunking Configuration Form */}
                  {runChunking && (
                    <Box sx={{ mb: 2, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1.5, bgcolor: "background.default" }}>
                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, fontSize: 13 }}>
                        Chunking 설정
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                            전략
                          </Typography>
                          <Select
                            size="small"
                            fullWidth
                            value={chunkingStrategy}
                            onChange={(e) => setChunkingStrategy(e.target.value)}
                            disabled={controlsDisabled}
                          >
                            <MenuItem value="fixed-size">fixed-size</MenuItem>
                            <MenuItem value="recursive">recursive</MenuItem>
                            <MenuItem value="structure-based">structure-based</MenuItem>
                          </Select>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                            단위
                          </Typography>
                          <Select
                            size="small"
                            fullWidth
                            value={chunkUnit}
                            onChange={(e) => setChunkUnit(e.target.value)}
                            disabled={controlsDisabled}
                          >
                            <MenuItem value="CHARACTER">CHARACTER</MenuItem>
                            <MenuItem value="TOKEN">TOKEN</MenuItem>
                          </Select>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <TextField
                            label="최대 크기"
                            size="small"
                            type="number"
                            fullWidth
                            value={chunkMaxSize}
                            onChange={(e) => setChunkMaxSize(e.target.value)}
                            disabled={controlsDisabled}
                            placeholder="800 (기본값)"
                            helperText="양수"
                            FormHelperTextProps={{ sx: { m: 0, mt: 0.5, fontSize: 10 } }}
                          />
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                          <TextField
                            label="중첩 크기"
                            size="small"
                            type="number"
                            fullWidth
                            value={chunkOverlap}
                            onChange={(e) => setChunkOverlap(e.target.value)}
                            disabled={controlsDisabled}
                            placeholder="100 (기본값)"
                            helperText="0 이상, 최대 크기 미만"
                            FormHelperTextProps={{ sx: { m: 0, mt: 0.5, fontSize: 10 } }}
                          />
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {/* RAG Configuration Form */}
                  {runRagIndex && (
                    <Box sx={{ mb: 2, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1.5, bgcolor: "background.default" }}>
                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, fontSize: 13 }}>
                        RAG 색인 설정
                      </Typography>
                      
                      <ToggleButtonGroup
                        size="small"
                        value={ragMode}
                        exclusive
                        onChange={(e, val) => val && setRagMode(val)}
                        disabled={controlsDisabled}
                        fullWidth
                        sx={{ mb: 2 }}
                      >
                        <ToggleButton value="profile">Profile 방식</ToggleButton>
                        <ToggleButton value="direct">직접 선택 방식</ToggleButton>
                      </ToggleButtonGroup>

                      {ragMode === "profile" ? (
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 6 }}>
                            <TextField
                              label="Embedding Profile ID"
                              size="small"
                              fullWidth
                              value={embeddingProfileId}
                              onChange={(e) => setEmbeddingProfileId(e.target.value)}
                              disabled={controlsDisabled}
                              placeholder="retrieval"
                            />
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <TextField
                              label="Dimension (차원)"
                              size="small"
                              type="number"
                              fullWidth
                              value={embeddingDimension}
                              onChange={(e) => setEmbeddingDimension(e.target.value)}
                              disabled={controlsDisabled}
                              placeholder="768"
                              helperText="Profile dimension과 일치해야 함"
                              FormHelperTextProps={{ sx: { m: 0, mt: 0.5, fontSize: 10 } }}
                            />
                          </Grid>
                        </Grid>
                      ) : (
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 6 }}>
                            <TextField
                              label="Provider"
                              size="small"
                              fullWidth
                              value={embeddingProvider}
                              onChange={(e) => setEmbeddingProvider(e.target.value)}
                              disabled={controlsDisabled}
                              placeholder="google"
                            />
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <TextField
                              label="Model"
                              size="small"
                              fullWidth
                              value={embeddingModel}
                              onChange={(e) => setEmbeddingModel(e.target.value)}
                              disabled={controlsDisabled}
                              placeholder="gemini-embedding-001"
                            />
                          </Grid>
                          <Grid size={{ xs: 12 }}>
                            <TextField
                              label="Dimension (차원)"
                              size="small"
                              type="number"
                              fullWidth
                              value={embeddingDimension}
                              onChange={(e) => setEmbeddingDimension(e.target.value)}
                              disabled={controlsDisabled}
                              placeholder="768"
                            />
                          </Grid>
                        </Grid>
                      )}
                    </Box>
                  )}

                  {/* Actions & Global Status */}
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {markdownStatus ? (
                        <Chip
                          label={`Markdown: ${markdownStatus}`}
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

                  {/* 4-Step Pipeline Status Dashboard */}
                  {documentId && (
                    <Box sx={{ mb: 2, p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5, bgcolor: "action.hover" }}>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1, fontWeight: 600 }}>
                        단계별 처리 상태
                      </Typography>
                      <Stack spacing={1}>
                        {/* 1. Markdown 생성 상태 */}
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" sx={{ fontSize: 12 }}>1. Markdown 생성</Typography>
                          <Chip
                            label={markdownStatus || "대기"}
                            size="small"
                            color={
                              markdownStatus === "COMPLETED" ? "success" :
                              (markdownStatus === "RUNNING" || markdownStatus === "PENDING") ? "primary" :
                              markdownStatus === "FAILED" ? "error" : "default"
                            }
                            sx={{ height: 20, fontSize: 10 }}
                          />
                        </Stack>

                        {/* 2. Chunking 상태 */}
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" sx={{ fontSize: 12 }}>2. Chunking 분할</Typography>
                          <Chip
                            label={
                              !runChunking ? "미실행" :
                              markdownStatus !== "COMPLETED" ? (markdownStatus || "대기") :
                              ragJob ? (
                                ragJob.status === "SUCCEEDED" ? "COMPLETED" :
                                ragJob.status === "CANCELLED" || (ragJob.status as string) === "CANCELED" ? "CANCELED" :
                                ragJob.status === "FAILED" ? "FAILED" :
                                (ragJob.status || "RUNNING")
                              ) : "RUNNING"
                            }
                            size="small"
                            color={
                              !runChunking ? "default" :
                              markdownStatus !== "COMPLETED" ? (
                                markdownStatus === "FAILED" ? "error" :
                                (markdownStatus === "RUNNING" || markdownStatus === "PENDING") ? "primary" : "default"
                              ) : (
                                ragJob ? (
                                  ragJob.status === "SUCCEEDED" ? "success" :
                                  ragJob.status === "FAILED" ? "error" :
                                  (ragJob.status === "CANCELLED" || (ragJob.status as string) === "CANCELED") ? "default" : "primary"
                                ) : "primary"
                              )
                            }
                            sx={{ height: 20, fontSize: 10 }}
                          />
                        </Stack>

                        {/* 3. RAG 색인 상태 */}
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" sx={{ fontSize: 12 }}>3. RAG 색인</Typography>
                          <Chip
                            label={
                              !runRagIndex ? "미실행" :
                              markdownStatus !== "COMPLETED" ? "대기" :
                              ragJob ? (
                                ragJob.status === "SUCCEEDED" ? "COMPLETED" :
                                ragJob.status === "CANCELLED" || (ragJob.status as string) === "CANCELED" ? "CANCELED" :
                                ragJob.status === "FAILED" ? "FAILED" :
                                (ragJob.status || "RUNNING")
                              ) : "RUNNING"
                            }
                            size="small"
                            color={
                              !runRagIndex ? "default" :
                              markdownStatus !== "COMPLETED" ? "default" :
                              ragJob ? (
                                ragJob.status === "SUCCEEDED" ? "success" :
                                ragJob.status === "FAILED" ? "error" :
                                (ragJob.status === "CANCELLED" || (ragJob.status as string) === "CANCELED") ? "default" : "primary"
                              ) : "primary"
                            }
                            sx={{ height: 20, fontSize: 10 }}
                          />
                        </Stack>

                        {/* 4. Skill 추출 상태 */}
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" sx={{ fontSize: 12 }}>4. Skill 추출</Typography>
                          <Chip
                            label={
                              !runSkillExtraction ? "미실행" :
                              markdownStatus !== "COMPLETED" ? "대기" :
                              skillJob ? (
                                skillJob.status === "COMPLETED" ? "COMPLETED" :
                                skillJob.status === "FAILED" ? "FAILED" :
                                skillJob.status === "CANCELED" || skillJob.status === "CANCELLED" ? "CANCELED" :
                                skillJob.status === "PARTIAL" ? "PARTIAL" :
                                (skillJob.status || "RUNNING")
                              ) : "RUNNING"
                            }
                            size="small"
                            color={
                              !runSkillExtraction ? "default" :
                              markdownStatus !== "COMPLETED" ? "default" :
                              skillJob ? (
                                skillJob.status === "COMPLETED" ? "success" :
                                skillJob.status === "FAILED" ? "error" :
                                (skillJob.status === "CANCELED" || skillJob.status === "CANCELLED") ? "default" : "primary"
                              ) : "primary"
                            }
                            sx={{ height: 20, fontSize: 10 }}
                          />
                        </Stack>
                      </Stack>
                    </Box>
                  )}

                  {/* Polling Progress */}
                  {isPendingOrRunning && (
                    <Box sx={{ mt: 1.5, mb: 1.5, bgcolor: "action.hover", p: 1.5, borderRadius: 1.5, border: "1px dashed", borderColor: "primary.main" }}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <CircularProgress size={16} />
                        <Typography variant="caption" color="text.secondary">
                          Markdown 지식 파이프라인이 진행 중입니다...
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
                    <Box sx={{ mt: 1.5, mb: 1.5, bgcolor: "error.light", color: "error.contrastText", p: 1.5, borderRadius: 1.5 }}>
                      <Typography variant="caption" display="block" sx={{ fontWeight: "bold", mb: 0.5 }}>
                        실패 원인 (Code: {latestRevision?.errorCode || "-"})
                      </Typography>
                      <Typography variant="body2" sx={{ wordBreak: "break-all", fontSize: 12 }}>
                        {sanitizeErrorMessage(latestRevision?.errorMessage || markdownError)}
                      </Typography>
                    </Box>
                  )}

                  {/* COMPLETED result display */}
                  {markdownStatus === "COMPLETED" && latestRevision && (
                    <Stack spacing={2} sx={{ mt: 2 }}>
                      
                      {/* Metadata Table */}
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 600 }}>
                          변환 상세 정보
                        </Typography>
                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                          <Table size="small">
                            <TableBody>
                              <TableRow>
                                <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, width: "35%", fontSize: 11 }}>Markdown Doc ID</TableCell>
                                <TableCell sx={{ fontSize: 11, wordBreak: "break-all" }}>{documentId}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, fontSize: 11 }}>Revision ID</TableCell>
                                <TableCell sx={{ fontSize: 11, wordBreak: "break-all" }}>{latestRevision.revisionId}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, fontSize: 11 }}>원본 파일 형식</TableCell>
                                <TableCell sx={{ fontSize: 11 }}>{file?.contentType || "-"}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, fontSize: 11 }}>추출 방식</TableCell>
                                <TableCell sx={{ fontSize: 11 }}>
                                  {latestRevision.extractorType || "PANDOC"} {latestRevision.extractorVersion ? `(v${latestRevision.extractorVersion})` : ""}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, fontSize: 11 }}>결과 Attachment ID</TableCell>
                                <TableCell sx={{ fontSize: 11 }}>{latestRevision.resultAttachmentId || "-"}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, fontSize: 11 }}>생성 시각</TableCell>
                                <TableCell sx={{ fontSize: 11 }}>{formatDate(latestRevision.createdAt)}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, fontSize: 11 }}>완료 시각</TableCell>
                                <TableCell sx={{ fontSize: 11 }}>{formatDate(latestRevision.completedAt) || "-"}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell sx={{ bgcolor: "action.hover", fontWeight: 600, fontSize: 11 }}>적용된 파이프라인 옵션</TableCell>
                                <TableCell sx={{ fontSize: 11, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                                  {latestRevision.optionsJson ? (
                                    (() => {
                                      try {
                                        return JSON.stringify(JSON.parse(latestRevision.optionsJson), null, 2);
                                      } catch {
                                        return latestRevision.optionsJson;
                                      }
                                    })()
                                  ) : (
                                    `Chunking: ${runChunking ? "Y" : "N"}\n` +
                                    `RAG 색인: ${runRagIndex ? "Y" : "N"}\n` +
                                    `Skill 추출: ${runSkillExtraction ? "Y" : "N"}`
                                  )}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>

                      {latestRevision.markdownText && (
                        <Box>
                          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                              추출된 Markdown 본문
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (latestRevision.markdownText) {
                                  await navigator.clipboard.writeText(latestRevision.markdownText);
                                  toast.success("클립보드에 복사했습니다.");
                                }
                              }}
                            >
                              <ContentCopyOutlined fontSize="inherit" />
                            </IconButton>
                          </Stack>
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

                      {/* Locators Section */}
                      {locators.length > 0 && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 600 }}>
                            목차 및 위치 정보 (Locators)
                          </Typography>
                          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 180, overflow: "auto", borderRadius: 1 }}>
                            <Table size="small" stickyHeader>
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>Level</TableCell>
                                  <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>제목 (Title)</TableCell>
                                  <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>오프셋 (Offset)</TableCell>
                                  <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>페이지</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {locators.map((loc) => (
                                  <TableRow key={loc.locatorId} hover>
                                    <TableCell sx={{ fontSize: 10 }}>L{loc.level}</TableCell>
                                    <TableCell sx={{ fontSize: 10, fontWeight: 500 }}>{loc.title}</TableCell>
                                    <TableCell sx={{ fontSize: 10, color: "text.secondary" }}>{loc.startOffset} ~ {loc.endOffset}</TableCell>
                                    <TableCell sx={{ fontSize: 10 }}>{loc.pageNumber ?? "-"}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Box>
                      )}

                      {/* Resources Section */}
                      {resources.length > 0 && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 600 }}>
                            추출 리소스 목록 (Resources)
                          </Typography>
                          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 180, overflow: "auto", borderRadius: 1 }}>
                            <Table size="small" stickyHeader>
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>리소스명</TableCell>
                                  <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>유형 / 형식</TableCell>
                                  <TableCell sx={{ fontSize: 10, fontWeight: 600 }}>크기</TableCell>
                                  <TableCell sx={{ fontSize: 10, fontWeight: 600, textAlign: "right" }}>작업</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {resources.map((res) => (
                                  <TableRow key={res.resourceId} hover>
                                    <TableCell sx={{ fontSize: 10, fontWeight: 500, wordBreak: "break-all" }}>{res.name}</TableCell>
                                    <TableCell sx={{ fontSize: 10, color: "text.secondary" }}>
                                      {res.resourceType} ({res.contentType})
                                    </TableCell>
                                    <TableCell sx={{ fontSize: 10 }}>{formatFileSize(res.sizeBytes)}</TableCell>
                                    <TableCell sx={{ fontSize: 10, textAlign: "right" }}>
                                      <IconButton
                                        size="small"
                                        color="primary"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.location.assign(`/api/mgmt/files/${encodeURIComponent(res.attachmentId)}/download`);
                                        }}
                                      >
                                        <DownloadOutlined fontSize="inherit" />
                                      </IconButton>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Box>
                      )}

                      {latestRevision.resultAttachmentId && (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          fullWidth
                          startIcon={<DownloadOutlined />}
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
        </Box>

        <Divider />
        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center" sx={{ p: 2, flexShrink: 0 }}>
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
              zIndex: 1300,
            }}
          >
            <CircularProgress />
          </Box>
        ) : null}

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
