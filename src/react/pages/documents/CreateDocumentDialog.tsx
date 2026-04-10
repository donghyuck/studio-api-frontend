import { useState } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { useToast } from "@/react/feedback";
import { apiRequest } from "@/react/query/fetcher";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
}

export function CreateDocumentDialog({ open, onClose, onCreated }: Props) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!title.trim()) return;

    setLoading(true);
    try {
      const document = await apiRequest<{ documentId: number }>("post", "/api/mgmt/documents", {
        data: { title: title.trim() },
      });
      toast.success("문서가 생성되었습니다.");
      setTitle("");
      onCreated(document.documentId);
    } catch {
      toast.error("문서 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle>문서 생성</DialogTitle>
      <DialogContent>
        <TextField
          label="제목"
          size="small"
          fullWidth
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && void handleCreate()}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={loading}>
          취소
        </Button>
        <Button
          variant="outlined"
          onClick={() => void handleCreate()}
          disabled={loading || !title.trim()}
        >
          {loading ? <CircularProgress size={20} /> : "생성"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
