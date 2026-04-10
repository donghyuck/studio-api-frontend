import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, CircularProgress,
} from "@mui/material";
import { useToast } from "@/react/feedback";
import { reactRolesApi } from "./api";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function RoleDialog({ open, onClose, onCreated }: Props) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await reactRolesApi.createRole({ name: name.trim(), description: description.trim() || undefined });
      toast.success("역할이 생성되었습니다.");
      setName(""); setDescription("");
      onCreated(); onClose();
    } catch {
      toast.error("역할 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle>역할 생성</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="역할명" size="small" fullWidth value={name} onChange={e => setName(e.target.value)} />
          <TextField label="설명" size="small" fullWidth multiline rows={2} value={description} onChange={e => setDescription(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={loading}>취소</Button>
        <Button variant="outlined" onClick={handleCreate} disabled={loading || !name.trim()}>
          {loading ? <CircularProgress size={20} /> : "생성"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
