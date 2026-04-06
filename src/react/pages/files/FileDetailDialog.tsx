import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  TextField,
  Typography,
  CircularProgress,
} from "@mui/material";
import { useToast } from "@/react/feedback";
import { apiRequest } from "@/react/query/fetcher";

interface FileInfoDto {
  attachmentId: number;
  name?: string;
  originalFileName?: string;
  contentType?: string;
  size?: number;
  createdAt?: string;
  properties?: Record<string, string>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  attachmentId: number;
}

export function FileDetailDialog({ open, onClose, attachmentId }: Props) {
  const toast = useToast();
  const [file, setFile] = useState<FileInfoDto | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !attachmentId) return;
    setLoading(true);
    apiRequest<FileInfoDto>("get", `/api/mgmt/files/${attachmentId}`)
      .then(setFile)
      .catch(() => toast.error("파일 정보를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [open, attachmentId]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>파일 상세</DialogTitle>
      <DialogContent>
        {loading ? (
          <CircularProgress size={24} />
        ) : file ? (
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField
              label="파일명"
              value={file.originalFileName ?? file.name ?? ""}
              InputProps={{ readOnly: true }}
              size="small"
              fullWidth
            />
            <TextField
              label="Content-Type"
              value={file.contentType ?? ""}
              InputProps={{ readOnly: true }}
              size="small"
              fullWidth
            />
            <TextField
              label="크기"
              value={
                file.size != null ? `${(file.size / 1024).toFixed(1)} KB` : ""
              }
              InputProps={{ readOnly: true }}
              size="small"
              fullWidth
            />
            <TextField
              label="생성일시"
              value={file.createdAt ?? ""}
              InputProps={{ readOnly: true }}
              size="small"
              fullWidth
            />
          </Stack>
        ) : (
          <Typography color="text.secondary">데이터 없음</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
}
