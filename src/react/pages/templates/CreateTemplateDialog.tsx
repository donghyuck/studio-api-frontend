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
import { reactTemplatesApi } from "./api";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTemplateDialog({ open, onClose, onCreated }: Props) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [objectType, setObjectType] = useState("");
  const [objectId, setObjectId] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim() || !objectType || !objectId) return;

    setLoading(true);
    try {
      await reactTemplatesApi.create({
        name: name.trim(),
        displayName: displayName || null,
        objectType: Number(objectType),
        objectId: Number(objectId),
      });
      toast.success("템플릿이 생성되었습니다.");
      setName("");
      setDisplayName("");
      setObjectType("");
      setObjectId("");
      onCreated();
      onClose();
    } catch {
      toast.error("템플릿 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle>템플릿 생성</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="이름 (name)"
            size="small"
            fullWidth
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <TextField
            label="표시 이름 (displayName)"
            size="small"
            fullWidth
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <TextField
            label="오브젝트 타입 (objectType)"
            size="small"
            fullWidth
            value={objectType}
            onChange={(event) => setObjectType(event.target.value)}
            required
            type="number"
          />
          <TextField
            label="오브젝트 ID (objectId)"
            size="small"
            fullWidth
            value={objectId}
            onChange={(event) => setObjectId(event.target.value)}
            required
            type="number"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={loading}>
          취소
        </Button>
        <Button
          variant="outlined"
          onClick={() => void handleCreate()}
          disabled={loading || !name.trim()}
        >
          {loading ? <CircularProgress size={20} /> : "생성"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
