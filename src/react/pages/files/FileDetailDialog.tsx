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
} from "@mui/material";
import {
  CloseOutlined,
  ContentCopyOutlined,
  RefreshOutlined,
  TextSnippetOutlined,
  TimelineOutlined,
} from "@mui/icons-material";
import dayjs from "dayjs";
import { useAuthStore } from "@/react/auth/store";
import { useToast } from "@/react/feedback";
import { reactAiApi, type EmbeddingOption } from "@/react/pages/ai/api";
import { reactFilesApi, reactDocumentConvertApi, type DocumentConvertStatus, type DocumentConvertJob } from "@/react/pages/files/api";
import type { AttachmentDto } from "@/types/studio/files";
import type { RagIndexJobStatus, RagIndexJobStep } from "@/types/studio/ai";
import { resolveAxiosError } from "@/utils/helpers";
import { DocumentConvertDialog, getDocumentFormat, getFriendlyErrorMessage } from "./DocumentConvertDialog";

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
  const [ragJobId, setRagJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [textExtracting, setTextExtracting] = useState(false);
  const [ragIndexing, setRagIndexing] = useState(false);
  const [embeddingOptions, setEmbeddingOptions] = useState<EmbeddingOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<EmbeddingOption | null>(null);
  const [chunkingStrategy, setChunkingStrategy] = useState<string>("recursive");
  const [ragJobStatus, setRagJobStatus] = useState<RagIndexJobStatus | null>(null);
  const [ragJobStep, setRagJobStep] = useState<RagIndexJobStep | null>(null);
  const [ragJobError, setRagJobError] = useState<string | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);

  // Convert-to-markdown states for DOCX/HTML RAG Indexing
  const [convertJobId, setConvertJobId] = useState<string | null>(null);
  const [convertJob, setConvertJob] = useState<DocumentConvertJob | null>(null);
  const [convertStatus, setConvertStatus] = useState<DocumentConvertStatus | null>(null);
  const [isConvertRetrying, setIsConvertRetrying] = useState(false);
  const [isConvertCanceling, setIsConvertCanceling] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);

  const roles = useAuthStore((state) => state.user?.roles) ?? [];
  const canManage = roles.includes("ROLE_ADMIN") || roles.includes("ADMIN") || roles.includes("features:document-convert/manage");

  useEffect(() => {
    if (open) {
      reactAiApi.getEmbeddingOptions()
        .then((res) => {
          const list = res.options ?? [];
          setEmbeddingOptions(list);
          const def = list.find((o) => o.defaultProfile) || list.find((o) => o.defaultProvider) || list[0] || null;
          setSelectedOption(def);
        })
        .catch(() => {
          // Ignore
        });
    } else {
      setEmbeddingOptions([]);
      setSelectedOption(null);
      setChunkingStrategy("recursive");
      setRagJobStatus(null);
      setRagJobStep(null);
      setRagJobError(null);
      setConvertJobId(null);
      setConvertJob(null);
      setConvertStatus(null);
      setConvertError(null);
    }
  }, [open]);

  // Load convert job ID from localStorage
  useEffect(() => {
    if (open && attachmentId && file) {
      const format = getDocumentFormat(file.name, file.contentType);
      const isDocxHtml = format === "docx" || format === "html";
      if (isDocxHtml) {
        const savedJobId = localStorage.getItem(`rag_convert_job_${attachmentId}`);
        if (savedJobId) {
          setConvertJobId(savedJobId);
          setConvertStatus("RUNNING"); // Trigger polling
          setConvertError(null);
        } else {
          setConvertJobId(null);
          setConvertJob(null);
          setConvertStatus(null);
          setConvertError(null);
        }
      } else {
        setConvertJobId(null);
        setConvertJob(null);
        setConvertStatus(null);
        setConvertError(null);
      }
    } else {
      setConvertJobId(null);
      setConvertJob(null);
      setConvertStatus(null);
      setConvertError(null);
    }
  }, [open, attachmentId, file]);

  // Polling for convert job status
  useEffect(() => {
    if (!open || !convertJobId || (convertStatus !== "PENDING" && convertStatus !== "RUNNING")) {
      return;
    }

    let timerId: number | undefined;
    let consecutiveErrors = 0;

    const triggerRagIndexAfterConvert = async (resultFileId: number) => {
      setRagIndexing(true);
      try {
        const payload: any = {
          useLlmKeywordExtraction: true,
          chunkingStrategy,
        };
        if (selectedOption) {
          if (selectedOption.profileId) {
            payload.embeddingProfileId = selectedOption.profileId;
          } else {
            payload.embeddingProvider = selectedOption.provider;
            payload.embeddingModel = selectedOption.model;
          }
        }
        const jobId = await reactFilesApi.ragIndex(resultFileId, payload);
        if (jobId) {
          setRagJobId(jobId);
          toast.success(`변환된 Markdown 파일의 RAG 색인 작업이 시작되었습니다.`);
        } else {
          toast.success(`변환된 Markdown 파일의 RAG 색인 작업이 완료되었습니다.`);
        }
        await refreshDetail(true);
      } catch (error) {
        toast.error("RAG 색인 등록 실패: " + resolveAxiosError(error));
      } finally {
        setRagIndexing(false);
      }
    };

    const poll = async () => {
      try {
        const res = await reactDocumentConvertApi.getJob(convertJobId);
        consecutiveErrors = 0;
        setConvertError(null);
        setConvertJob(res.data);
        setConvertStatus(res.data.status);

        if (res.data.status === "COMPLETED") {
          if (timerId) window.clearInterval(timerId);
          if (res.data.resultFileId) {
            void triggerRagIndexAfterConvert(Number(res.data.resultFileId));
          } else {
            setConvertError("변환 결과 파일 ID가 없습니다.");
          }
        } else if (res.data.status === "FAILED" || res.data.status === "CANCELED") {
          if (timerId) window.clearInterval(timerId);
        }
      } catch (error: any) {
        if (error?.response?.status === 403) {
          setConvertError("조회 권한이 부족합니다. (403)");
          if (timerId) window.clearInterval(timerId);
          return;
        }
        consecutiveErrors += 1;
        if (consecutiveErrors >= 3) {
          setConvertError("연속적인 네트워크 오류로 폴링이 중단되었습니다. 수동으로 새로고침 해주세요.");
          if (timerId) window.clearInterval(timerId);
        }
      }
    };

    const restartInterval = (ms: number) => {
      if (timerId) window.clearInterval(timerId);
      timerId = window.setInterval(poll, ms);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        restartInterval(5000);
      } else {
        restartInterval(2000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    // initial start
    restartInterval(document.hidden ? 5000 : 2000);
    void poll();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timerId) window.clearInterval(timerId);
    };
  }, [open, convertJobId, convertStatus, chunkingStrategy, selectedOption]);

  useEffect(() => {
    if (!open || !attachmentId) {
      return;
    }

    let ignored = false;
    async function checkActiveJob() {
      try {
        const res = await reactAiApi.listRagJobs({
          objectType: "attachment",
          objectId: String(attachmentId),
          page: 0,
          size: 1,
        });
        if (ignored) return;

        const latestJob = res.content?.[0];
        if (latestJob && (latestJob.status === "PENDING" || latestJob.status === "RUNNING")) {
          setRagJobId(latestJob.jobId);
          setRagJobStatus(latestJob.status);
          setRagJobStep(latestJob.currentStep);
          setRagJobError(latestJob.errorMessage);
        }
      } catch {
        // ignore
      }
    }

    void checkActiveJob();

    return () => {
      ignored = true;
    };
  }, [open, attachmentId]);

  useEffect(() => {
    if (!open || !ragJobId) {
      setRagJobStatus(null);
      setRagJobStep(null);
      setRagJobError(null);
      return;
    }

    let timer: number | undefined;

    async function pollStatus() {
      try {
        const job = await reactAiApi.getRagJob(ragJobId);
        setRagJobStatus(job.status);
        setRagJobStep(job.currentStep);
        setRagJobError(job.errorMessage);

        if (
          job.status === "SUCCEEDED" ||
          job.status === "WARNING" ||
          job.status === "FAILED" ||
          job.status === "CANCELLED"
        ) {
          if (timer) window.clearInterval(timer);
          await refreshDetail(true);
        }
      } catch {
        // ignore
      }
    }

    void pollStatus();
    timer = window.setInterval(() => {
      void pollStatus();
    }, 3000);

    return () => {
      if (timer) {
        window.clearInterval(timer);
      }
    };
  }, [open, ragJobId]);

  const metadataEntries = Object.entries(ragMetadata ?? {});
  const ragIndexCompleted = ragIndexed || metadataEntries.length > 0;

  const format = file ? getDocumentFormat(file.name, file.contentType) : null;
  const isDocxHtml = format === "docx" || format === "html";
  const isConverting = isDocxHtml && (convertStatus === "PENDING" || convertStatus === "RUNNING");

  const ragIndexDisabled =
    loading ||
    ragIndexCompleted ||
    ragIndexing ||
    Boolean(ragJobId) ||
    isConverting;

  const ragIndexTooltip = ragIndexCompleted
    ? "이미 RAG 인덱싱이 완료된 파일입니다."
    : ragJobId
      ? "이미 RAG 색인 작업이 생성되었습니다."
      : isConverting
        ? "문서 변환 작업이 진행 중입니다."
        : isDocxHtml
          ? "이 문서를 Markdown으로 변환 후 RAG 인덱싱을 요청합니다."
          : "이 파일을 RAG 검색 대상으로 색인합니다.";

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
    setRagJobId(null);
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

  async function refreshDetail(keepJobId = false) {
    if (!attachmentId) return;
    if (!file) {
      setFile(null);
      setRagIndexed(false);
      setRagMetadata(null);
      setExtractedText("");
      setTextExtracted(false);
      clearThumbnail();
    }
    if (!keepJobId) {
      setRagJobId(null);
    }
    setThumbnailReloadKey((current) => current + 1);
    setLoading(true);
    try {
      const nextFile = await reactFilesApi.getById(attachmentId);
      setFile(nextFile);
      const ragState = await loadRagState(nextFile);
      setRagIndexed(ragState.indexed);
      setRagMetadata(ragState.metadata);
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

  async function handleConvertRetry() {
    if (!convertJobId) return;
    setIsConvertRetrying(true);
    setConvertError(null);
    try {
      const res = await reactDocumentConvertApi.retryJob(convertJobId);
      setConvertJob(res.data);
      setConvertStatus(res.data.status);
      toast.success("변환 재시도 작업이 접수되었습니다.");
    } catch (error) {
      const errMsg = resolveAxiosError(error) || "변환 재시도에 실패했습니다.";
      setConvertError(errMsg);
      toast.error("변환 재시도 실패: " + errMsg);
    } finally {
      setIsConvertRetrying(false);
    }
  }

  async function handleConvertCancel() {
    if (!convertJobId) return;
    const confirmed = window.confirm("진행 중인 변환 작업을 취소하시겠습니까?");
    if (!confirmed) return;

    setIsConvertCanceling(true);
    try {
      await reactDocumentConvertApi.cancelJob(convertJobId);
      setConvertStatus("CANCELED");
      if (convertJob) {
        setConvertJob({ ...convertJob, status: "CANCELED" });
      }
      toast.success("변환 작업이 취소되었습니다.");
    } catch (error) {
      toast.error("변환 작업 취소 실패: " + resolveAxiosError(error));
    } finally {
      setIsConvertCanceling(false);
    }
  }

  async function handleRagIndex() {
    if (!attachmentId || !file || ragIndexCompleted) return;

    const format = getDocumentFormat(file.name, file.contentType);
    const isDocxHtml = format === "docx" || format === "html";

    if (isDocxHtml) {
      if (!canManage) {
        toast.error("변환 요청 권한(features:document-convert/manage)이 없습니다.");
        return;
      }
      setRagIndexing(true);
      setConvertError(null);
      try {
        const res = await reactDocumentConvertApi.convert({
          sourceFileId: String(attachmentId),
          sourceFormat: format,
          targetFormat: "markdown",
          options: {},
        });
        const newJob = res.data;
        setConvertJob(newJob);
        setConvertJobId(newJob.jobId);
        setConvertStatus(newJob.status);
        localStorage.setItem(`rag_convert_job_${attachmentId}`, newJob.jobId);
        toast.success(`문서 Markdown 변환 작업이 시작되었습니다.`);
      } catch (error) {
        const errMsg = resolveAxiosError(error) || "문서 변환 요청에 실패했습니다.";
        setConvertError(errMsg);
        toast.error("문서 변환 요청 실패: " + errMsg);
      } finally {
        setRagIndexing(false);
      }
    } else {
      setRagIndexing(true);
      try {
        const payload: any = {
          useLlmKeywordExtraction: true,
          chunkingStrategy,
        };
        if (selectedOption) {
          if (selectedOption.profileId) {
            payload.embeddingProfileId = selectedOption.profileId;
          } else {
            payload.embeddingProvider = selectedOption.provider;
            payload.embeddingModel = selectedOption.model;
          }
        }
        const jobId = await reactFilesApi.ragIndex(attachmentId, payload);
        if (jobId) {
          setRagJobId(jobId);
          toast.success(`${file.name} 파일의 RAG 색인 작업이 시작되었습니다.`);
        } else {
          toast.success(`${file.name} 파일의 RAG 색인 작업이 완료되었습니다.`);
        }
        await refreshDetail(true);
      } catch (error) {
        toast.error(resolveAxiosError(error));
      } finally {
        setRagIndexing(false);
      }
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

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 520 },
          maxWidth: "100%",
        },
      }}
    >
      <Stack spacing={0} sx={{ height: "100%", position: "relative" }}>
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
              {file ? `#${file.attachmentId}` : ""}
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

        <Stack spacing={2} sx={{ p: 2, flex: 1, overflow: "auto" }}>
          {file ? (
            <>
              {renderDetail("파일명", file.name)}
              {renderDetail("객체 유형", file.objectType)}
              {renderDetail("객체 식별자", file.objectId)}
              {renderDetail("Content Type", file.contentType)}
              {renderDetail("크기", formatFileSize(file.size))}
              {renderDetail("생성일시", formatDate(file.createdAt))}
              {thumbnailAvailable && thumbnailUrl ? (
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
                    썸네일
                  </Typography>
                  <Box
                    component="img"
                    src={thumbnailUrl}
                    alt={file.name}
                    sx={{
                      width: "100%",
                      maxHeight: 220,
                      borderRadius: 1,
                      objectFit: "contain",
                    }}
                  />
                </Box>
              ) : null}

              <Box>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">
                    텍스트 추출 결과
                  </Typography>
                  {!textExtracted ? (
                    <Tooltip title="콘텐츠에서 텍스트를 추출합니다.">
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<TextSnippetOutlined fontSize="small" />}
                          disabled={textExtracting}
                          onClick={() => void handleExtractText()}
                        >
                          텍스트 추출
                        </Button>
                      </span>
                    </Tooltip>
                  ) : (
                    <Tooltip title="클립보드에 복사">
                      <IconButton size="small" onClick={() => void handleCopyExtractedText()}>
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
                      mt: 0.75,
                      maxHeight: 280,
                      overflow: "auto",
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      wordBreak: "break-word",
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      bgcolor: "background.default",
                      color: "text.primary",
                      p: 1.25,
                      fontFamily: (theme) => theme.typography.fontFamily,
                      fontSize: 12,
                      lineHeight: 1.7,
                    }}
                  >
                    {extractedText || "-"}
                  </Box>
                ) : null}
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  RAG
                </Typography>

                {!ragIndexCompleted && embeddingOptions.length > 0 ? (
                  <Box sx={{ mb: 1.5 }}>
                    <TextField
                      select
                      label="임베딩 모델 프로필"
                      size="small"
                      value={selectedOption ? (selectedOption.profileId || `${selectedOption.provider}:${selectedOption.model}`) : ""}
                      onChange={(event) => {
                        const val = event.target.value;
                        const matched = embeddingOptions.find((o) => (o.profileId || `${o.provider}:${o.model}`) === val);
                        if (matched) {
                          setSelectedOption(matched);
                        }
                      }}
                      disabled={ragIndexing}
                      fullWidth
                    >
                      {embeddingOptions.map((opt) => {
                        const valueKey = opt.profileId || `${opt.provider}:${opt.model}`;
                        const label = opt.profileId
                          ? `${opt.profileId} (${opt.provider} - ${opt.model})`
                          : `${opt.provider} - ${opt.model} (${opt.dimension}d)`;
                        return (
                          <MenuItem key={valueKey} value={valueKey}>
                            {label}
                          </MenuItem>
                        );
                      })}
                    </TextField>
                  </Box>
                ) : null}

                {!ragIndexCompleted ? (
                  <Box sx={{ mb: 1.5 }}>
                    <TextField
                      select
                      label="청킹 전략"
                      size="small"
                      value={chunkingStrategy}
                      onChange={(event) => setChunkingStrategy(event.target.value)}
                      disabled={ragIndexing}
                      fullWidth
                    >
                      <MenuItem value="recursive">재귀적 청킹 (Recursive)</MenuItem>
                      <MenuItem value="fixed-size">고정 크기 청킹 (Fixed Size)</MenuItem>
                      <MenuItem value="structure-based">구조 기반 청킹 (Structure Based)</MenuItem>
                      <MenuItem value="semantic">의미론적 청킹 (Semantic)</MenuItem>
                      <MenuItem value="llm-based">LLM 기반 청킹 (LLM Based)</MenuItem>
                    </TextField>
                  </Box>
                ) : null}

                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Box>
                    {ragIndexCompleted ? (
                      <Typography variant="caption" color="text.secondary" display="block">
                        이 파일은 RAG 인덱싱이 완료되었습니다.
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary" display="block">
                        선택한 임베딩 프로필로 이 파일을 RAG 검색 대상으로 색인합니다.
                      </Typography>
                    )}
                  </Box>
                  <Tooltip title={ragIndexTooltip}>
                    <span>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<TimelineOutlined fontSize="small" />}
                        disabled={ragIndexDisabled}
                        onClick={() => void handleRagIndex()}
                      >
                        RAG 인덱싱
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>
                {ragJobId ? (
                  <Box sx={{ mt: 1.5, bgcolor: "action.hover", p: 1.25, borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      RAG 색인 작업 ID
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                      {ragJobId}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        진행 상태:
                      </Typography>
                      {ragJobStatus ? (
                        <Chip
                          label={`${ragJobStatus}${ragJobStep ? ` (${ragJobStep})` : ""}`}
                          size="small"
                          color={
                            ragJobStatus === "SUCCEEDED" ? "success" :
                            ragJobStatus === "RUNNING" ? "primary" :
                            ragJobStatus === "FAILED" ? "error" :
                            "default"
                          }
                          sx={{ height: 20, fontSize: 11 }}
                        />
                      ) : (
                        <CircularProgress size={12} />
                      )}
                    </Stack>
                    {ragJobError ? (
                      <Typography variant="caption" color="error.main" display="block" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>
                        오류: {ragJobError}
                      </Typography>
                    ) : null}
                  </Box>
                ) : null}

                {/* Convert Job Progress View */}
                {convertJobId ? (
                  <Box sx={{ mt: 1.5, bgcolor: "action.hover", p: 1.25, borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      문서 변환 작업 ID
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                      {convertJobId}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        변환 상태:
                      </Typography>
                      {convertStatus ? (
                        <Chip
                          label={convertStatus}
                          size="small"
                          color={
                            convertStatus === "COMPLETED" ? "success" :
                            (convertStatus === "RUNNING" || convertStatus === "PENDING") ? "primary" :
                            convertStatus === "FAILED" ? "error" :
                            "default"
                          }
                          sx={{ height: 20, fontSize: 11 }}
                        />
                      ) : (
                        <CircularProgress size={12} />
                      )}
                    </Stack>

                    {(convertStatus === "PENDING" || convertStatus === "RUNNING") && (
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                        <CircularProgress size={12} />
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                          Markdown으로 변환하는 중입니다...
                        </Typography>
                        {canManage && (
                          <Button
                            size="small"
                            color="error"
                            variant="text"
                            sx={{ minWidth: 0, p: 0, ml: "auto", fontSize: 11 }}
                            disabled={isConvertCanceling}
                            onClick={() => void handleConvertCancel()}
                          >
                            {isConvertCanceling ? "취소 중..." : "작업 취소"}
                          </Button>
                        )}
                      </Stack>
                    )}

                    {convertStatus === "COMPLETED" && (
                      <Stack spacing={1} sx={{ mt: 1 }}>
                        <Typography variant="caption" color="success.main" display="block">
                          ✓ Markdown 변환 완료
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          fullWidth
                          onClick={() => {
                            window.location.assign(`/api/document-conversions/${encodeURIComponent(convertJobId)}/download`);
                          }}
                        >
                          변환 결과 다운로드
                        </Button>
                      </Stack>
                    )}

                    {convertStatus === "FAILED" && (
                      <Stack spacing={1} sx={{ mt: 1 }}>
                        <Typography variant="caption" color="error.main" display="block">
                          오류: {getFriendlyErrorMessage(convertJob?.errorCode ?? null, convertJob?.errorMessage ?? null)}
                        </Typography>
                        {canManage && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            fullWidth
                            disabled={isConvertRetrying}
                            onClick={() => void handleConvertRetry()}
                          >
                            {isConvertRetrying ? "재시도 요청 중..." : "재시도 (Retry)"}
                          </Button>
                        )}
                      </Stack>
                    )}

                    {convertStatus === "CANCELED" && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                        변환 작업이 취소되었습니다.
                      </Typography>
                    )}
                  </Box>
                ) : null}

                {convertError && (
                  <Box sx={{ mt: 1.5, bgcolor: "action.hover", p: 1.25, borderRadius: 1 }}>
                    <Typography variant="caption" color="error.main" display="block">
                      오류: {convertError}
                    </Typography>
                  </Box>
                )}
              </Box>

              {metadataEntries.length > 0 ? (
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
                    RAG Metadata
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell>Value</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {metadataEntries.map(([key, value]) => (
                          <TableRow key={key}>
                            <TableCell>{key}</TableCell>
                            <TableCell sx={{ overflowWrap: "anywhere" }}>{String(value)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              ) : null}
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

        {loading || textExtracting || ragIndexing ? (
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
