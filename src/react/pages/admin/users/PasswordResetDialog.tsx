import { useState, useEffect } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, Typography, List, ListItem, ListItemIcon, ListItemText,
  CircularProgress,
} from "@mui/material";
import { CheckCircleOutline, RadioButtonUnchecked } from "@mui/icons-material";
import { useToast } from "@/react/feedback";
import { reactUsersApi } from "./api";
import type { PasswordPolicyDto } from "@/types/studio/user";

interface Props {
  open: boolean;
  onClose: () => void;
  userId: number;
  username: string;
}

export function PasswordResetDialog({ open, onClose, userId, username }: Props) {
  const toast = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [policy, setPolicy] = useState<PasswordPolicyDto | null>(null);

  useEffect(() => {
    if (open) {
      setNewPassword("");
      setConfirmPassword("");
      reactUsersApi.getPasswordPolicy().then(setPolicy).catch(() => setPolicy(null));
    }
  }, [open]);

  function checkRule(label: string, met: boolean) {
    return (
      <ListItem dense disableGutters key={label}>
        <ListItemIcon sx={{ minWidth: 28 }}>
          {met ? <CheckCircleOutline fontSize="small" color="success" /> : <RadioButtonUnchecked fontSize="small" color="disabled" />}
        </ListItemIcon>
        <ListItemText primary={label} />
      </ListItem>
    );
  }

  function policyRules() {
    if (!policy) return null;
    const pw = newPassword;
    return [
      checkRule(`최소 ${policy.minLength}자 이상`, pw.length >= policy.minLength),
      policy.maxLength ? checkRule(`최대 ${policy.maxLength}자 이하`, pw.length <= policy.maxLength) : null,
      policy.requireUpper ? checkRule("대문자 포함", /[A-Z]/.test(pw)) : null,
      policy.requireLower ? checkRule("소문자 포함", /[a-z]/.test(pw)) : null,
      policy.requireDigit ? checkRule("숫자 포함", /[0-9]/.test(pw)) : null,
      policy.requireSpecial ? checkRule("특수문자 포함", /[^a-zA-Z0-9]/.test(pw)) : null,
    ].filter(Boolean);
  }

  async function handleSubmit() {
    if (newPassword !== confirmPassword) {
      toast.error("비밀번호가 일치하지 않습니다.");
      return;
    }
    setLoading(true);
    try {
      await reactUsersApi.resetPassword(userId, {
        currentPassword: "",
        newPassword,
      });
      toast.success("비밀번호가 재설정되었습니다.");
      onClose();
    } catch {
      toast.error("비밀번호 재설정에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>비밀번호 재설정 — {username}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="새 비밀번호" type="password" fullWidth size="small"
            value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          <TextField label="비밀번호 확인" type="password" fullWidth size="small"
            value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          {policy && (
            <>
              <Typography variant="caption" color="text.secondary">비밀번호 정책</Typography>
              <List dense>{policyRules()}</List>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>취소</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading || !newPassword}>
          {loading ? <CircularProgress size={20} /> : "재설정"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
