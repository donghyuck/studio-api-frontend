import { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CloseOutlined,
  ContentCopyOutlined,
  DownloadOutlined,
  IosShareOutlined,
  OpenInNewOutlined,
} from "@mui/icons-material";
import dayjs from "dayjs";
import { toast } from "@/react/feedback";
import { reactObjectStorageApi } from "@/react/pages/objectstorage/api";
import type { BucketDto, ObjectInfoDto, PresignedUrlDto } from "@/types/studio/storage";
import { isVideoOrAudioOrImgOrPdf, resolveAxiosError } from "@/utils/helpers";

export function ObjectDialog({
  open,
  onClose,
  bucket,
  objectKey,
}: {
  open: boolean;
  onClose: () => void;
  bucket?: BucketDto | null;
  objectKey?: string;
}) {
  const [head, setHead] = useState<ObjectInfoDto | null>(null);
  const [presigned, setPresigned] = useState<PresignedUrlDto | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isHeadLoaded = Boolean(head?.key && head.key === objectKey);
  const previewable = Boolean(
    isHeadLoaded && head?.contentType && isVideoOrAudioOrImgOrPdf(head.contentType)
  );
  const inlinePreviewable = Boolean(
    isHeadLoaded &&
      previewUrl &&
      (head?.contentType?.startsWith("image/") || head?.contentType?.startsWith("video/"))
  );
  const metadataEntries = Object.entries(head?.metadata ?? {});

  useEffect(() => {
    setHead(null);
    setPresigned(null);
    setPreviewUrl(null);

    if (!open || !bucket || !objectKey) {
      return;
    }

    setLoading(true);
    reactObjectStorageApi
      .fetchObjectHead({
        providerId: bucket.providerId,
        bucket: bucket.bucket,
        key: objectKey,
      })
      .then(setHead)
      .catch((error) => toast.error(resolveAxiosError(error)))
      .finally(() => setLoading(false));
  }, [open, bucket, objectKey]);

  useEffect(() => {
    if (
      !open ||
      !bucket ||
      !objectKey ||
      !isHeadLoaded ||
      !head?.contentType ||
      (!head.contentType.startsWith("image/") && !head.contentType.startsWith("video/"))
    ) {
      setPreviewUrl(null);
      return;
    }

    reactObjectStorageApi
      .presignGet({
        providerId: bucket.providerId,
        bucket: bucket.bucket,
        key: objectKey,
        disposition: "inline",
      })
      .then((data) => setPreviewUrl(data.url || null))
      .catch((error) => toast.error(resolveAxiosError(error)));
  }, [open, bucket, objectKey, isHeadLoaded, head?.contentType]);

  async function handlePresign() {
    if (!bucket || !objectKey || !isHeadLoaded) {
      return;
    }
    try {
      setLoading(true);
      const data = await reactObjectStorageApi.presignGet({
        providerId: bucket.providerId,
        bucket: bucket.bucket,
        key: objectKey,
      });
      setPresigned(data);
    } catch (error) {
      toast.error(resolveAxiosError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    if (!bucket || !isHeadLoaded || !head?.key) {
      return;
    }
    try {
      await reactObjectStorageApi.downloadFile(bucket.providerId, bucket.bucket, head.key, head.name);
    } catch (error) {
      toast.error(resolveAxiosError(error));
    }
  }

  async function handlePreview() {
    if (!bucket || !previewable || !head?.key) {
      return;
    }
    try {
      await reactObjectStorageApi.openInNewTab(bucket.providerId, bucket.bucket, head.key);
    } catch (error) {
      toast.error(resolveAxiosError(error));
    }
  }

  async function handleCopyPresignedUrl() {
    if (!presigned?.url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(presigned.url);
      toast.success("URL을 복사했습니다.");
    } catch (error) {
      toast.error(resolveAxiosError(error));
    }
  }

  function formatBytes(value?: number | null) {
    if (value == null) {
      return "";
    }

    if (value === 0) {
      return "0 B";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const size = value / 1024 ** index;

    return `${size >= 10 || index === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`;
  }

  function formatDate(value?: Date | string | null) {
    return value ? dayjs(value).format("YYYY-MM-DD HH:mm:ss") : "";
  }

  function renderDetail(label: string, value?: string | number | null) {
    return (
      <Box>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            mt: 0.25,
            overflowWrap: "anywhere",
            whiteSpace: "pre-wrap",
          }}
        >
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
          width: { xs: "100%", sm: 480 },
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
              {head?.name || objectKey || "Object"}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              {bucket?.bucket ?? ""}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose}>
            <CloseOutlined fontSize="small" />
          </IconButton>
        </Box>
        <Divider />

        <Stack spacing={2} sx={{ p: 2, flex: 1, overflow: "auto" }}>
          {renderDetail("이름", head?.name)}
          {renderDetail("콘텐츠 종류", head?.contentType)}
          {renderDetail("크기", formatBytes(head?.size))}
          {renderDetail("수정일", formatDate(head?.modifiedDate))}
          {renderDetail("etag", head?.eTag)}
          {metadataEntries.length > 0 ? (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
                Metadata
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
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Typography variant="caption" color="text.secondary">
                Pre Signed Access URL
              </Typography>
              <Tooltip title="외부 공유를 위한 만료 시간이 있는 보안 접근 URL을 생성합니다.">
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<IosShareOutlined fontSize="small" />}
                    disabled={!isHeadLoaded || loading || Boolean(presigned?.url)}
                    onClick={() => void handlePresign()}
                  >
                    공유 URL 생성
                  </Button>
                </span>
              </Tooltip>
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
              외부 사용자에게 공유할 수 있는 만료 시간이 있는 접근 URL입니다.
            </Typography>
            {presigned?.url ? (
              <Box sx={{ mt: 0.25 }}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Typography
                    variant="body2"
                    sx={{
                      flex: 1,
                      overflowWrap: "anywhere",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {presigned.url}
                  </Typography>
                  <Tooltip title="클립보드에 복사">
                    <IconButton size="small" onClick={() => void handleCopyPresignedUrl()}>
                      <ContentCopyOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  생성된 URL은 {formatDate(presigned.expiresAt)}까지 유효합니다.
                </Typography>
              </Box>
            ) : null}
          </Box>
          {inlinePreviewable ? (
            <Box>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.75 }}>
                미리보기
              </Typography>
              {head?.contentType?.startsWith("image/") ? (
                <Box
                  component="img"
                  src={previewUrl ?? undefined}
                  alt={head?.name ?? "Object preview"}
                  sx={{
                    width: "100%",
                    maxHeight: 280,
                    bgcolor: "grey.100",
                    borderRadius: 1,
                    objectFit: "contain",
                  }}
                />
              ) : (
                <Box
                  component="video"
                  src={previewUrl ?? undefined}
                  controls
                  sx={{
                    width: "100%",
                    maxHeight: 280,
                    bgcolor: "grey.100",
                    borderRadius: 1,
                  }}
                />
              )}
            </Box>
          ) : null}
        </Stack>

        <Divider />
        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ p: 2 }}>
          <Button
            variant="outlined"
            startIcon={<DownloadOutlined fontSize="small" />}
            disabled={!isHeadLoaded}
            onClick={() => void handleDownload()}
          >
            다운로드
          </Button>
          <Button
            variant="outlined"
            startIcon={<OpenInNewOutlined fontSize="small" />}
            disabled={!previewable}
            onClick={() => void handlePreview()}
          >
            새 탭에서 열기
          </Button>
          <Button onClick={onClose}>닫기</Button>
        </Stack>
        {loading ? (
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
