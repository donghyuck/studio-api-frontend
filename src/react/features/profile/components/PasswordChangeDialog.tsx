import { useEffect, useState } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { CheckCircleOutline, RadioButtonUnchecked } from "@mui/icons-material";
import { useToast } from "@/react/feedback";
import { reactProfileApi } from "@/react/features/profile/api/profileApi";
import type { PasswordPolicyDto } from "@/types/studio/user";
import { resolveAxiosError } from "@/utils/helpers";

interface Props {
  open: boolean;
  onClose: () => void;
}

const defaultPolicy: PasswordPolicyDto = {
  minLength: 8,
  maxLength: 64,
  requireUpper: false,
  requireLower: false,
  requireDigit: false,
  requireSpecial: false,
  allowWhitespace: false,
};

export function PasswordChangeDialog({ open, onClose }: Props) {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [policy, setPolicy] = useState<PasswordPolicyDto>(defaultPolicy);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    reactProfileApi.getPasswordPolicy().then(setPolicy).catch(() => setPolicy(defaultPolicy));
  }, [open]);

  function checkRule(label: string, met: boolean) {
    return (
      <ListItem dense disableGutters key={label}>
        <ListItemIcon sx={{ minWidth: 28 }}>
          {met ? (
            <CheckCircleOutline fontSize="small" color="success" />
          ) : (
            <RadioButtonUnchecked fontSize="small" color="disabled" />
          )}
        </ListItemIcon>
        <ListItemText primary={label} />
      </ListItem>
    );
  }

  const policyRules = [
    checkRule(`최소 ${policy.minLength}자 이상`, newPassword.length >= policy.minLength),
    checkRule(`최대 ${policy.maxLength}자 이하`, newPassword.length <= policy.maxLength),
    policy.allowWhitespace ? null : checkRule("공백 미포함", !/\s/.test(newPassword)),
    policy.requireUpper ? checkRule("대문자 포함", /[A-Z]/.test(newPassword)) : null,
    policy.requireLower ? checkRule("소문자 포함", /[a-z]/.test(newPassword)) : null,
    policy.requireDigit ? checkRule("숫자 포함", /[0-9]/.test(newPassword)) : null,
    policy.requireSpecial ? checkRule("특수문자 포함", /[^a-zA-Z0-9]/.test(newPassword)) : null,
  ].filter(Boolean);

  async function handleSubmit() {
    if (!currentPassword.trim()) {
      toast.error("현재 비밀번호를 입력하세요.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("새 비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    try {
      await reactProfileApi.changePassword(currentPassword, newPassword);
      toast.success("비밀번호가 변경되었습니다.");
      onClose();
    } catch (error) {
      toast.error(resolveAxiosError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>비밀번호 변경</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="현재 비밀번호"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="새 비밀번호"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="새 비밀번호 확인"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            fullWidth
            size="small"
          />
          <Typography variant="caption" color="text.secondary">
            비밀번호 정책
          </Typography>
          <List dense>{policyRules}</List>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          취소
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSubmit()}
          disabled={loading || !newPassword}
        >
          {loading ? <CircularProgress size={20} /> : "변경"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
