import { useState } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import { useToast } from "@/react/feedback";
import { reactAclApi } from "./api";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateClassDialog({ open, onClose, onCreated }: Props) {
  const toast = useToast();
  const [className, setClassName] = useState("");
  const [classIdType, setClassIdType] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!className.trim()) return;

    setLoading(true);
    try {
      await reactAclApi.createClass({
        className: className.trim(),
        classIdType: classIdType.trim() || null,
      });
      toast.success("클래스가 생성되었습니다.");
      setClassName("");
      setClassIdType("");
      onCreated();
      onClose();
    } catch {
      toast.error("클래스 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>ACL 클래스 생성</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="클래스명"
            size="small"
            fullWidth
            value={className}
            onChange={(event) => setClassName(event.target.value)}
            required
          />
          <TextField
            label="ID 타입"
            size="small"
            fullWidth
            value={classIdType}
            onChange={(event) => setClassIdType(event.target.value)}
            helperText="예: Long, UUID"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          취소
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleCreate()}
          disabled={loading || !className.trim()}
        >
          {loading ? <CircularProgress size={20} /> : "생성"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
