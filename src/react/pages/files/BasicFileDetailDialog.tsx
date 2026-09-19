import { useEffect, useState } from "react";
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { reactFilesApi } from "./api";
import type { AttachmentDto } from "@/types/studio/files";

/** File-only servers must not start AI or document-processing requests when opening details. */
export function BasicFileDetailDialog({ open, attachmentId, onClose }: {
  open: boolean; attachmentId: number | null; onClose: () => void;
}) {
  const [file, setFile] = useState<AttachmentDto | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setFile(null);
    setError(false);
    if (open && attachmentId) {
      reactFilesApi.getById(attachmentId)
        .then((value) => { if (active) setFile(value); })
        .catch(() => { if (active) setError(true); });
    }
    return () => { active = false; };
  }, [open, attachmentId]);
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle>파일 상세</DialogTitle>
    <DialogContent>
      {error ? <Alert severity="error">파일 정보를 불러오지 못했습니다.</Alert> : file ? <Stack spacing={1}>
        <Typography fontWeight={700}>{file.name}</Typography>
        <Typography color="text.secondary">{file.contentType} · {file.size.toLocaleString()} bytes</Typography>
        <Alert severity="info">이 서버에서는 기본 파일 관리를 제공합니다.</Alert>
      </Stack> : <CircularProgress aria-label="파일 정보 조회 중" />}
    </DialogContent>
    <DialogActions><Button onClick={onClose}>닫기</Button></DialogActions>
  </Dialog>;
}
