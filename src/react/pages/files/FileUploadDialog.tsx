import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { reactFilesApi } from "@/react/pages/files/api";

interface Props {
  open: boolean;
  initialObjectType?: number | null;
  initialObjectId?: number | null;
  onClose: () => void;
  onUploaded: () => Promise<void> | void;
}

export function FileUploadDialog({
  open,
  initialObjectType = null,
  initialObjectId = null,
  onClose,
  onUploaded,
}: Props) {
  const [objectType, setObjectType] = useState<string>(
    initialObjectType == null ? "" : String(initialObjectType)
  );
  const [objectId, setObjectId] = useState<string>(
    initialObjectId == null ? "" : String(initialObjectId)
  );
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = (nextObjectType = initialObjectType, nextObjectId = initialObjectId) => {
    setObjectType(nextObjectType == null ? "" : String(nextObjectType));
    setObjectId(nextObjectId == null ? "" : String(nextObjectId));
    setSelectedFiles([]);
    setError(null);
    setIsUploading(false);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    reset(initialObjectType, initialObjectId);
  }, [open, initialObjectId, initialObjectType]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError("업로드할 파일을 선택하세요.");
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      for (const file of selectedFiles) {
        await reactFilesApi.upload(
          file,
          objectType === "" ? null : Number(objectType),
          objectId === "" ? null : Number(objectId)
        );
      }
      await onUploaded();
      handleClose();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "파일 업로드에 실패했습니다.");
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>파일 업로드</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            객체 유형과 객체 식별자를 입력하면 특정 도메인 객체에 파일을 연결할 수 있습니다.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="객체 유형"
              type="number"
              value={objectType}
              onChange={(event) => setObjectType(event.target.value)}
              fullWidth
            />
            <TextField
              label="객체 식별자"
              type="number"
              value={objectId}
              onChange={(event) => setObjectId(event.target.value)}
              fullWidth
            />
          </Stack>
          <Button component="label" variant="outlined">
            파일 선택
            <input
              hidden
              multiple
              type="file"
              onChange={(event) => {
                setSelectedFiles(Array.from(event.target.files ?? []));
                setError(null);
              }}
            />
          </Button>
          <Typography variant="body2" color="text.secondary">
            선택된 파일: {selectedFiles.length === 0 ? "없음" : selectedFiles.map((file) => file.name).join(", ")}
          </Typography>
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>취소</Button>
        <Button onClick={() => void handleUpload()} variant="contained" disabled={isUploading}>
          업로드
        </Button>
      </DialogActions>
    </Dialog>
  );
}
