import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CloseOutlined,
  ContentCopyOutlined,
  ExpandMoreOutlined,
  LinkOutlined,
  RefreshOutlined,
  TextSnippetOutlined,
  TimelineOutlined,
} from "@mui/icons-material";
import dayjs from "dayjs";
import { useToast } from "@/react/feedback";
import { reactAiApi } from "@/react/pages/ai/api";
import { reactFilesApi } from "@/react/pages/files/api";
import type { AttachmentDto } from "@/types/studio/files";
import { resolveAxiosError } from "@/utils/helpers";

const THUMBNAIL_RETRY_INTERVAL_MS = 1500;
const THUMBNAIL_RETRY_LIMIT = 8;

function shouldRetryThumbnail(status?: string) {
  return !status || status === "pending";
}

function isImageContent(contentType?: string | null) {
  return Boolean(contentType?.toLowerCase().startsWith("image/"));
}

function isReadyThumbnail(status?: string) {
  return status !== "pending" && status !== "unavailable";
}

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

function ragObjectScopes(file: AttachmentDto | null, fallbackAttachmentId: number) {
  const attachmentObjectId = String(fallbackAttachmentId);
  const scopes: Array<{ objectType: string; objectId: string }> = [];
  const append = (objectType?: string | number | null, objectId?: string | number | null) => {
    const type = objectType == null ? "" : String(objectType).trim();
    const id = objectId == null ? "" : String(objectId).trim();
    if (!type || !id) {
      return;
    }
    if (!scopes.some((scope) => scope.objectType === type && scope.objectId === id)) {
      scopes.push({ objectType: type, objectId: id });
    }
  };

  append(file?.objectType, attachmentObjectId);
  append(file?.objectType, file?.objectId);
  append("attachment", attachmentObjectId);

  return scopes.length > 0 ? scopes : [{ objectType: "attachment", objectId: attachmentObjectId }];
}

function metadataMatchesAttachment(metadata: Record<string, unknown>, attachmentId: number) {
  const expected = String(attachmentId);
  const candidates = [
    metadata.attachmentId,
    metadata.sourceDocumentId,
    metadata.documentId,
  ];
  return candidates.some((value) => value != null && String(value) === expected);
}

function formatMetadataValue(value: unknown) {
  if (value == null) {
    return "-";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function supportsDownloadUrl(file?: AttachmentDto | null) {
  const properties = file?.properties ?? {};
  return (
    properties["storage.type"] === "objectstorage" &&
    Boolean(properties["storage.provider"]) &&
    Boolean(properties["storage.bucket"]) &&
    Boolean(properties["storage.key"])
  );
}

function RagMetadataAccordion({ entries }: { entries: Array<[string, unknown]> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Accordion
      disableGutters
      elevation={0}
      expanded={expanded}
      onChange={(_, nextExpanded) => setExpanded(nextExpanded)}
      square
      sx={{
        bgcolor: "transparent",
        border: 0,
        boxShadow: "none",
        "&:before": { display: "none" },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreOutlined fontSize="small" />}
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          minHeight: 36,
          px: 0,
          "& .MuiAccordionSummary-content": {
            my: 0.75,
            alignItems: "center",
          },
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
          RAG Metadata
        </Typography>
      </AccordionSummary>
      {expanded ? (
        <AccordionDetails sx={{ px: 0, pt: 0, pb: 0.5 }}>
          <Box
            component="dl"
            sx={{
              m: 0,
              display: "grid",
              gridTemplateColumns: "minmax(104px, 32%) minmax(0, 1fr)",
              rowGap: 0,
              columnGap: 1.5,
            }}
          >
            {entries.map(([key, value]) => (
              <Box
                component="div"
                key={key}
                sx={{
                  display: "contents",
                  "& > dt, & > dd": {
                    py: 0.85,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  },
                }}
              >
                <Typography component="dt" variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {key}
                </Typography>
                <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: "anywhere" }}>
                  {formatMetadataValue(value)}
                </Typography>
              </Box>
            ))}
          </Box>
        </AccordionDetails>
      ) : null}
    </Accordion>
  );
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
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const [thumbnailUnavailable, setThumbnailUnavailable] = useState(false);
  const [thumbnailReloadKey, setThumbnailReloadKey] = useState(0);
  const [ragJobId, setRagJobId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [textExtracting, setTextExtracting] = useState(false);
  const [ragIndexing, setRagIndexing] = useState(false);
  const [downloadLinkIssuing, setDownloadLinkIssuing] = useState(false);
  const [downloadLinkUrl, setDownloadLinkUrl] = useState<string | null>(null);
  const [downloadLinkExpiresAt, setDownloadLinkExpiresAt] = useState<string | null>(null);

  const metadataEntries = Object.entries(ragMetadata ?? {});
  const downloadUrlSupported = supportsDownloadUrl(file);
  const ragIndexCompleted = ragIndexed || metadataEntries.length > 0;
  const ragIndexDisabled = loading || ragIndexCompleted || ragIndexing || Boolean(ragJobId);
  const ragIndexTooltip = ragIndexCompleted
    ? "이미 RAG 인덱싱이 완료된 파일입니다."
    : ragJobId
      ? "이미 RAG 색인 작업이 생성되었습니다."
      : "이 파일을 RAG 검색 대상으로 색인합니다.";

  function clearThumbnail() {
    setThumbnailAvailable(false);
    setThumbnailLoading(false);
    setThumbnailUnavailable(false);
    setThumbnailUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
      return null;
    });
  }

  async function loadRagState(nextFile: AttachmentDto) {
    for (const scope of ragObjectScopes(nextFile, nextFile.attachmentId)) {
      try {
        const metadata = await reactAiApi.getRagObjectMetadata(scope.objectType, scope.objectId);
        if (Object.keys(metadata ?? {}).length > 0 && metadataMatchesAttachment(metadata, nextFile.attachmentId)) {
          return {
            indexed: true,
            metadata,
          };
        }
      } catch {
        // Continue with the next possible object scope before using the attachment fallback.
      }
    }

    const indexed = await reactFilesApi.hasEmbedding(nextFile.attachmentId);
    if (!indexed) {
      return {
        indexed,
        metadata: null,
      };
    }

    try {
      return {
        indexed,
        metadata: await reactFilesApi.ragMetadata(nextFile.attachmentId),
      };
    } catch {
      return {
        indexed,
        metadata: null,
      };
    }
  }

  function resetDetailState() {
    setFile(null);
    setRagIndexed(false);
    setRagMetadata(null);
    setExtractedText("");
    setTextExtracted(false);
    setRagJobId(null);
    setDownloadLinkUrl(null);
    setDownloadLinkExpiresAt(null);
    clearThumbnail();
  }

  useEffect(() => {
    resetDetailState();

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
    setThumbnailLoading(true);
    setThumbnailUnavailable(false);

    function showUnavailable() {
      setThumbnailLoading(false);
      setThumbnailUrl((currentUrl) => {
        if (!currentUrl) {
          setThumbnailAvailable(false);
          setThumbnailUnavailable(true);
        }
        return currentUrl;
      });
    }

    function loadOriginalImageFallback() {
      if (!isImageContent(file?.contentType)) {
        showUnavailable();
        return;
      }

      reactFilesApi
        .downloadBlob(requestedId)
        .then((blob) => {
          if (ignored || requestedId !== attachmentId) {
            return;
          }
          if (blob.size === 0) {
            showUnavailable();
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
          setThumbnailLoading(false);
          setThumbnailUnavailable(false);
        })
        .catch(() => {
          if (!ignored) {
            showUnavailable();
          }
        });
    }

    function loadThumbnail(attempt: number) {
      reactFilesApi
        .fetchThumbnail(requestedId, 512)
        .then(({ blob, status, retryAfterMs }) => {
          if (ignored || requestedId !== attachmentId) {
            return;
          }
          if (blob.size > 0) {
            const objectUrl = URL.createObjectURL(blob);
            setThumbnailUrl((currentUrl) => {
              if (currentUrl) {
                URL.revokeObjectURL(currentUrl);
              }
              return objectUrl;
            });
            setThumbnailAvailable(true);
            setThumbnailUnavailable(false);
            if (isReadyThumbnail(status)) {
              setThumbnailLoading(false);
              return;
            }
          }
          if (shouldRetryThumbnail(status) && attempt < THUMBNAIL_RETRY_LIMIT) {
            setThumbnailLoading(true);
            timer = window.setTimeout(() => loadThumbnail(attempt + 1), retryAfterMs ?? THUMBNAIL_RETRY_INTERVAL_MS);
          } else {
            loadOriginalImageFallback();
          }
        })
        .catch(() => {
          if (ignored) {
            return;
          }
          if (attempt < THUMBNAIL_RETRY_LIMIT) {
            timer = window.setTimeout(() => loadThumbnail(attempt + 1), THUMBNAIL_RETRY_INTERVAL_MS);
          } else {
            loadOriginalImageFallback();
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
  }, [open, attachmentId, file?.contentType, thumbnailReloadKey]);

  async function refreshDetail() {
    if (!attachmentId) return;
    setFile(null);
    setRagIndexed(false);
    setRagMetadata(null);
    setExtractedText("");
    setTextExtracted(false);
    setRagJobId(null);
    setDownloadLinkUrl(null);
    setDownloadLinkExpiresAt(null);
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

  async function handleIssueDownloadLink() {
    if (!attachmentId || !file) return;

    setDownloadLinkIssuing(true);
    try {
      const issued = await reactFilesApi.issueDownloadUrl(attachmentId, { ttlSeconds: 300 });
      setDownloadLinkUrl(issued.url);
      setDownloadLinkExpiresAt(issued.expiresAt);
      if (!navigator.clipboard?.writeText) {
        toast.warning("다운로드 링크를 생성했습니다. 클립보드 복사는 브라우저에서 지원하지 않습니다.");
        return;
      }
      try {
        await navigator.clipboard.writeText(issued.url);
        toast.success("다운로드 링크를 생성하고 클립보드에 복사했습니다.");
      } catch {
        toast.warning("다운로드 링크를 생성했습니다. 아래 링크를 다시 복사해 주세요.");
      }
    } catch (error) {
      toast.error(resolveAxiosError(error));
    } finally {
      setDownloadLinkIssuing(false);
    }
  }

  async function handleCopyDownloadLink() {
    if (!downloadLinkUrl) {
      toast.warning("복사할 다운로드 링크가 없습니다.");
      return;
    }
    if (!navigator.clipboard?.writeText) {
      toast.error("현재 브라우저에서는 클립보드 복사를 지원하지 않습니다.");
      return;
    }
    try {
      await navigator.clipboard.writeText(downloadLinkUrl);
      toast.success("다운로드 링크를 클립보드에 복사했습니다.");
    } catch {
      toast.error("클립보드에 복사할 수 없습니다. 브라우저 권한을 확인해 주세요.");
    }
  }

  async function handleRagIndex() {
    if (!attachmentId || !file || ragIndexCompleted) return;

    setRagIndexing(true);
    try {
      const [scope] = ragObjectScopes(file, attachmentId);
      const job = await reactAiApi.createRagJob({
        objectType: scope.objectType,
        objectId: scope.objectId,
        documentId: String(attachmentId),
        sourceType: "attachment",
        metadata: {
          attachmentId: String(attachmentId),
        },
        forceReindex: true,
        useLlmKeywordExtraction: true,
      });
      setRagJobId(job.jobId);
      toast.success(`${file.name} 파일의 RAG 색인 작업이 생성되었습니다.`);
    } catch (error) {
      toast.error(resolveAxiosError(error));
    } finally {
      setRagIndexing(false);
    }
  }

  function renderDetail(label: string, value?: string | number | null) {
    const displayValue = value == null || value === "" ? "-" : value;

    return (
      <Box>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.25, overflowWrap: "anywhere" }}>
          {displayValue}
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
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">
                    다운로드 링크
                  </Typography>
                  <Tooltip
                    title={
                      downloadUrlSupported
                        ? "5분 동안 사용할 수 있는 다운로드 링크를 생성하고 복사합니다."
                        : "Object Storage에 저장된 파일만 다운로드 링크를 생성할 수 있습니다."
                    }
                  >
                    <span>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={downloadLinkIssuing ? <CircularProgress size={14} /> : <LinkOutlined fontSize="small" />}
                        disabled={downloadLinkIssuing || !downloadUrlSupported}
                        onClick={() => void handleIssueDownloadLink()}
                      >
                        링크 생성
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>
                {downloadLinkExpiresAt ? (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    최근 생성 링크 만료: {formatDate(downloadLinkExpiresAt)}
                  </Typography>
                ) : null}
                {downloadLinkUrl ? (
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1 }}>
                    <TextField
                      size="small"
                      value={downloadLinkUrl}
                      InputProps={{ readOnly: true }}
                      fullWidth
                    />
                    <Tooltip title="다운로드 링크 복사">
                      <IconButton size="small" onClick={() => void handleCopyDownloadLink()}>
                        <ContentCopyOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                ) : null}
              </Box>
              {thumbnailAvailable && thumbnailUrl ? (
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      썸네일
                    </Typography>
                    {thumbnailLoading ? <CircularProgress size={14} thickness={4} /> : null}
                  </Stack>
                  <Box
                    component="img"
                    src={thumbnailUrl}
                    alt={file.name}
                    sx={{
                      width: "100%",
                      maxHeight: 220,
                      borderRadius: 1,
                      objectFit: "contain",
                      opacity: thumbnailLoading ? 0.72 : 1,
                      transition: "opacity 120ms ease",
                    }}
                  />
                </Box>
              ) : thumbnailLoading ? (
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
                    썸네일
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{
                      minHeight: 72,
                      color: "text.secondary",
                    }}
                  >
                    <CircularProgress size={18} thickness={4} />
                    <Typography variant="body2">썸네일을 불러오는 중입니다.</Typography>
                  </Stack>
                </Box>
              ) : thumbnailUnavailable ? (
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
                    썸네일
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    썸네일을 사용할 수 없습니다.
                  </Typography>
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
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">
                    RAG
                  </Typography>
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
                {ragIndexCompleted ? (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    이 파일은 RAG 인덱싱이 완료되었습니다.
                  </Typography>
                ) : null}
                {ragJobId ? (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    RAG 색인 작업 ID: {ragJobId}
                  </Typography>
                ) : null}
              </Box>

              {metadataEntries.length > 0 ? (
                <RagMetadataAccordion entries={metadataEntries} />
              ) : null}
            </>
          ) : (
            <Typography color="text.secondary">데이터 없음</Typography>
          )}
        </Stack>

        <Divider />
        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ p: 2 }}>
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
    </Drawer>
  );
}
