import { useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import { useToast } from "@/react/feedback";
import { reactAclApi } from "./api";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateSidDialog({ open, onClose, onCreated }: Props) {
  const toast = useToast();
  const [sid, setSid] = useState("");
  const [principal, setPrincipal] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!sid.trim()) return;

    setLoading(true);
    try {
      await reactAclApi.createSid({ sid: sid.trim(), principal });
      toast.success("SID가 생성되었습니다.");
      setSid("");
      setPrincipal(true);
      onCreated();
      onClose();
    } catch {
      toast.error("SID 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>ACL SID 생성</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">
            권한을 부여할 대상(사용자 또는 롤)을 정의합니다. 롤은 ROLE_ 접두어를 제외하고 입력합니다.
          </Alert>
          <TextField
            label="SID"
            size="small"
            fullWidth
            value={sid}
            onChange={(event) => setSid(event.target.value)}
            required
          />
          <FormControlLabel
            control={
              <Switch
                checked={principal}
                onChange={(event) => setPrincipal(event.target.checked)}
              />
            }
            label={principal ? "사용자 Principal" : "GrantedAuthority"}
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
          disabled={loading || !sid.trim()}
        >
          {loading ? <CircularProgress size={20} /> : "생성"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
