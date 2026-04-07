import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Stack, Button, IconButton, TextField,
  FormControlLabel, Switch, CircularProgress, Alert, Tooltip,
} from "@mui/material";
import { KeyOutlined, ManageAccountsOutlined, SaveOutlined } from "@mui/icons-material";
import { useToast } from "@/react/feedback";
import { reactUsersApi } from "./api";
import { UserRolesDialog } from "./UserRolesDialog";
import { PasswordResetDialog } from "./PasswordResetDialog";
import type { UserDto } from "@/types/studio/user";
import { PageToolbar } from "@/react/components/page/PageToolbar";

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", emailVisble: true, nameVisible: true, enabled: true });

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    reactUsersApi.getUser(Number(userId))
      .then(u => { setUser(u); setForm({ name: u.name, email: u.email ?? "", emailVisble: u.emailVisble, nameVisible: u.nameVisible, enabled: u.enabled }); setError(null); })
      .catch(() => setError("사용자를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [userId]);

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    try {
      await reactUsersApi.updateUser(Number(userId), form);
      toast.success("저장되었습니다.");
    } catch {
      toast.error("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!user) return null;

  return (
    <Stack spacing={2}>
      <PageToolbar
        divider={true}
        breadcrumbs={["시스템관리", "보안관리", "회원", user.username]}
        label="회원 정보를 조회하고 계정 상태를 관리합니다."
        previous
        onPrevious={() => navigate("/admin/users")}
        actions={
          <>
            <Tooltip title="역할 관리">
              <IconButton size="small" onClick={() => setRolesOpen(true)}>
                <ManageAccountsOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="비밀번호 재설정">
              <IconButton size="small" onClick={() => setResetOpen(true)}>
                <KeyOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="저장">
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? <CircularProgress size={18} /> : <SaveOutlined fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          </>
        }
      />
      <Stack spacing={2} sx={{ maxWidth: 600 }}>
        <TextField label="아이디" value={user.username} InputProps={{ readOnly: true }} size="small" />
        <TextField label="이름" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} size="small" />
        <TextField label="이메일" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} size="small" />
        <FormControlLabel control={<Switch checked={form.emailVisble} onChange={e => setForm(f => ({ ...f, emailVisble: e.target.checked }))} />} label="이메일 공개" />
        <FormControlLabel control={<Switch checked={form.nameVisible} onChange={e => setForm(f => ({ ...f, nameVisible: e.target.checked }))} />} label="이름 공개" />
        <FormControlLabel control={<Switch checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} />} label="계정 활성화" />
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button
            variant="outlined"
            startIcon={<ManageAccountsOutlined />}
            onClick={() => setRolesOpen(true)}
          >
            역할 관리
          </Button>
          <Button
            variant="outlined"
            startIcon={<KeyOutlined />}
            onClick={() => setResetOpen(true)}
          >
            비밀번호 재설정
          </Button>
          <Button
            variant="outlined"
            startIcon={<SaveOutlined />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <CircularProgress size={20} /> : "저장"}
          </Button>
        </Stack>
      </Stack>
      <UserRolesDialog open={rolesOpen} onClose={() => setRolesOpen(false)} userId={user.userId} username={user.username} />
      <PasswordResetDialog open={resetOpen} onClose={() => setResetOpen(false)} userId={user.userId} username={user.username} />
    </Stack>
  );
}
