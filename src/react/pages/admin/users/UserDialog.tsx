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
import { reactUsersApi } from "./api";

interface UserDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function UserDialog({ open, onClose, onCreated }: UserDialogProps) {
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit =
    username.trim().length > 0 &&
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8;

  function reset() {
    setUsername("");
    setName("");
    setEmail("");
    setPassword("");
  }

  async function handleCreate() {
    if (!canSubmit) {
      return;
    }

    setLoading(true);
    try {
      await reactUsersApi.createUser({
        username: username.trim(),
        password,
        name: name.trim(),
        email: email.trim(),
      });
      toast.success("사용자가 생성되었습니다.");
      reset();
      onCreated();
      onClose();
    } catch {
      toast.error("사용자 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle>사용자 생성</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="아이디"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            size="small"
            fullWidth
            autoFocus
          />
          <TextField
            label="이름"
            value={name}
            onChange={(event) => setName(event.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="이메일"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            size="small"
            type="email"
            fullWidth
          />
          <TextField
            label="초기 비밀번호"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            size="small"
            type="password"
            fullWidth
            helperText="8자 이상 입력하세요."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={loading}>
          취소
        </Button>
        <Button variant="outlined" onClick={() => void handleCreate()} disabled={loading || !canSubmit}>
          {loading ? <CircularProgress size={20} /> : "생성"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
