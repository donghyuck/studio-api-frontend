import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import { toast } from "@/react/feedback";
import { reactObjectStorageApi } from "@/react/pages/objectstorage/api";
import type { BucketDto, ObjectInfoDto, PresignedUrlDto } from "@/types/studio/storage";
import { resolveAxiosError } from "@/utils/helpers";

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

  useEffect(() => {
    if (!open || !bucket || !objectKey) {
      return;
    }
    reactObjectStorageApi
      .fetchObjectHead({
        providerId: bucket.providerId,
        bucket: bucket.bucket,
        key: objectKey,
      })
      .then(setHead)
      .catch((error) => toast.error(resolveAxiosError(error)));
  }, [open, bucket, objectKey]);

  async function handlePresign() {
    if (!bucket || !objectKey) {
      return;
    }
    try {
      const data = await reactObjectStorageApi.presignGet({
        providerId: bucket.providerId,
        bucket: bucket.bucket,
        key: objectKey,
      });
      setPresigned(data);
    } catch (error) {
      toast.error(resolveAxiosError(error));
    }
  }

  async function handleDownload() {
    if (!bucket || !head?.key) {
      return;
    }
    try {
      await reactObjectStorageApi.downloadFile(bucket.providerId, bucket.bucket, head.key, head.name);
    } catch (error) {
      toast.error(resolveAxiosError(error));
    }
  }

  async function handlePreview() {
    if (!bucket || !head?.key) {
      return;
    }
    try {
      await reactObjectStorageApi.openInNewTab(bucket.providerId, bucket.bucket, head.key);
    } catch (error) {
      toast.error(resolveAxiosError(error));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{objectKey || "Object"}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <TextField label="이름" value={head?.name ?? ""} InputProps={{ readOnly: true }} />
          <TextField label="콘텐츠 종류" value={head?.contentType ?? ""} InputProps={{ readOnly: true }} />
          <TextField label="크기" value={head?.size ?? ""} InputProps={{ readOnly: true }} />
          <TextField label="etag" value={head?.eTag ?? ""} InputProps={{ readOnly: true }} />
          <TextField
            label="Pre Signed URL"
            value={presigned?.url ?? ""}
            InputProps={{ readOnly: true }}
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => void handlePresign()}>URL 생성</Button>
        <Button onClick={() => void handleDownload()}>다운로드</Button>
        <Button onClick={() => void handlePreview()}>미리보기</Button>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
}
