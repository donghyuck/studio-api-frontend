import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Avatar,
  Box,
  Stack,
  Button,
  Grid,
  TextField,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
  Container,
} from "@mui/material";
import {
  DeleteOutlined,
  KeyOutlined,
  ManageAccountsOutlined,
  SaveOutlined,
  UploadOutlined,
} from "@mui/icons-material";
import { useConfirm, useToast } from "@/react/feedback";
import { reactUsersApi } from "./api";
import { UserRolesDialog } from "./UserRolesDialog";
import { PasswordResetDialog } from "./PasswordResetDialog";
import type { UserDto } from "@/types/studio/user";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { API_BASE_URL } from "@/config/backend";
import NO_AVATAR from "@/assets/images/users/no-avatar.png";

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [user, setUser] = useState<UserDto | null>(null);
  const [avatarImageId, setAvatarImageId] = useState<number | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    emailVisble: true,
    nameVisible: true,
    enabled: true,
  });

  const loadUser = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    reactUsersApi
      .getUser(Number(userId))
      .then(async (u) => {
        setUser(u);
        setForm({
          name: u.name,
          email: u.email ?? "",
          emailVisble: u.emailVisble,
          nameVisible: u.nameVisible,
          enabled: u.enabled,
        });
        const presence = await reactUsersApi
          .checkAvatarPresence(Number(userId))
          .catch(() => null);
        setAvatarImageId(presence?.primaryImageId ?? null);
        setAvatarVersion((value) => value + 1);
        setError(null);
      })
      .catch(() => setError("사용자를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

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

  async function handleAvatarUpload(file?: File) {
    if (!userId || !file) return;
    setSaving(true);
    try {
      const uploaded = await reactUsersApi.uploadAvatar(Number(userId), file);
      setAvatarImageId(uploaded.id ?? uploaded.imageId ?? null);
      setAvatarVersion((value) => value + 1);
      toast.success("아바타 이미지가 업로드되었습니다.");
    } catch {
      toast.error("아바타 업로드에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarDelete() {
    if (!userId || !avatarImageId) return;
    const ok = await confirm({
      title: "아바타 삭제",
      message: "아바타 이미지를 삭제하시겠습니까?",
      okText: "삭제",
      cancelText: "취소",
    });
    if (!ok) return;

    setSaving(true);
    try {
      await reactUsersApi.deleteAvatar(Number(userId), avatarImageId);
      setAvatarImageId(null);
      setAvatarVersion((value) => value + 1);
      toast.success("아바타 이미지가 삭제되었습니다.");
    } catch {
      toast.error("아바타 삭제에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!user) return null;

  const avatarUrl = `${API_BASE_URL}/api/profile/${encodeURIComponent(user.username)}/avatar?v=${avatarVersion}`;

  return (
    <Stack spacing={2}>
      <PageToolbar
        divider={true}
        breadcrumbs={["시스템관리", "보안관리", "회원", user.username]}
        label="회원 정보를 조회하고 계정 상태를 관리합니다."
        previous
        onPrevious={() => navigate("/admin/users")}
        onRefresh={loadUser}
      />
      <Container maxWidth="md" disableGutters>
        <Grid container spacing={1} alignItems="center">
          <Grid size={12} sx={{ mb: 5 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar
                alt={user.username}
                src={avatarImageId ? avatarUrl : NO_AVATAR}
                imgProps={{
                  onError: (event) => {
                    event.currentTarget.src = NO_AVATAR;
                  },
                }}
                sx={{ width: 120, height: 120, bgcolor: "grey.200" }}
              />
              <Stack direction="row" spacing={1}>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<UploadOutlined />}
                  disabled={saving}
                >
                  아바타 업로드
                  <input
                    hidden
                    accept="image/*"
                    type="file"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      void handleAvatarUpload(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteOutlined />}
                  disabled={saving || !avatarImageId}
                  onClick={() => void handleAvatarDelete()}
                >
                  아바타 삭제
                </Button>
              </Stack>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="아이디"
              value={user.username}
              InputProps={{ readOnly: true }}
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="이름"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="이메일"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.emailVisble}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, emailVisble: e.target.checked }))
                  }
                />
              }
              label="이메일 공개"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.nameVisible}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nameVisible: e.target.checked }))
                  }
                />
              }
              label="이름 공개"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.enabled}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, enabled: e.target.checked }))
                  }
                />
              }
              label="계정 활성화"
            />
          </Grid>
          <Grid size={12} sx={{ mt: 10 }}>
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
          </Grid>
        </Grid>
      </Container>
      <UserRolesDialog
        open={rolesOpen}
        onClose={() => setRolesOpen(false)}
        userId={user.userId}
        username={user.username}
      />
      <PasswordResetDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        userId={user.userId}
        username={user.username}
      />
    </Stack>
  );
}
