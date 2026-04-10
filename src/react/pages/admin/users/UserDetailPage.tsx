import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Container,
  FormControlLabel,
  Grid,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import {
  AddOutlined,
  DeleteOutlined,
  ExpandMoreOutlined,
  KeyOutlined,
  ManageAccountsOutlined,
  SaveOutlined,
  UploadOutlined,
} from "@mui/icons-material";
import { API_BASE_URL } from "@/config/backend";
import NO_AVATAR from "@/assets/images/users/no-avatar.png";
import { getProperties, replaceProperties } from "@/react/api/properties";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import {
  PropertiesEditor,
  type PropertiesEditorHandle,
} from "@/react/components/properties/PropertiesEditor";
import { useConfirm, useToast } from "@/react/feedback";
import { diffProperties, normalizeProperties } from "@/react/utils/propertyKeys";
import type { UserDto } from "@/types/studio/user";
import { PasswordResetDialog } from "./PasswordResetDialog";
import { reactUsersApi } from "./api";
import { UserRolesDialog } from "./UserRolesDialog";

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
  const [propertiesSaving, setPropertiesSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const propertiesEditorRef = useRef<PropertiesEditorHandle | null>(null);
  const [propertiesResetKey, setPropertiesResetKey] = useState(0);
  const [form, setForm] = useState({
    name: "",
    email: "",
    emailVisble: true,
    nameVisible: true,
    enabled: true,
  });
  const [initialProperties, setInitialProperties] = useState<Record<string, string>>({});
  const [draftProperties, setDraftProperties] = useState<Record<string, string>>({});

  const loadUser = useCallback(() => {
    if (!userId) return;
    setLoading(true);

    Promise.allSettled([
      reactUsersApi.getUser(Number(userId)),
      getProperties("users", Number(userId)),
    ])
      .then(async ([userResult, propertiesResult]) => {
        if (userResult.status !== "fulfilled") {
          throw userResult.reason;
        }

        const nextUser = userResult.value;
        setUser(nextUser);
        setForm({
          name: nextUser.name,
          email: nextUser.email ?? "",
          emailVisble: nextUser.emailVisble,
          nameVisible: nextUser.nameVisible,
          enabled: nextUser.enabled,
        });

        const nextProperties =
          propertiesResult.status === "fulfilled"
            ? normalizeProperties(propertiesResult.value)
            : {};
        if (propertiesResult.status !== "fulfilled") {
          toast.error("프로퍼티를 불러오지 못했습니다.");
        }

        setInitialProperties(nextProperties);
        setDraftProperties(nextProperties);
        setPropertiesResetKey((current) => current + 1);

        const presence = await reactUsersApi
          .checkAvatarPresence(Number(userId))
          .catch(() => null);
        setAvatarImageId(presence?.primaryImageId ?? null);
        setAvatarVersion((value) => value + 1);
        setError(null);
      })
      .catch(() => setError("사용자를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [toast, userId]);

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

  async function handleSaveProperties() {
    if (!userId) return;
    if (propertiesEditorRef.current?.hasErrors()) {
      toast.error("프로퍼티 키 오류를 먼저 수정해 주세요.");
      return;
    }

    setPropertiesSaving(true);
    try {
      const nextProperties = propertiesEditorRef.current?.getValue() ?? draftProperties;
      const saved = await replaceProperties("users", Number(userId), nextProperties);
      const normalized = normalizeProperties(saved);
      setInitialProperties(normalized);
      setDraftProperties(normalized);
      setPropertiesResetKey((current) => current + 1);
      toast.success("프로퍼티가 저장되었습니다.");
    } catch {
      toast.error("프로퍼티 저장에 실패했습니다.");
    } finally {
      setPropertiesSaving(false);
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

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!user) return null;

  const avatarUrl = `${API_BASE_URL}/api/profile/${encodeURIComponent(user.username)}/avatar?v=${avatarVersion}`;
  const propertiesDiff = diffProperties(initialProperties, draftProperties);
  const propertiesChanged =
    Object.keys(propertiesDiff.added).length > 0 ||
    Object.keys(propertiesDiff.updated).length > 0 ||
    propertiesDiff.removed.length > 0;
  const propertiesBusy = saving || propertiesSaving;

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
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="이메일"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
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
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      emailVisble: event.target.checked,
                    }))
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
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      nameVisible: event.target.checked,
                    }))
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
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      enabled: event.target.checked,
                    }))
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
      <Container maxWidth="md" disableGutters>
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
            프로퍼티
          </AccordionSummary>
          <AccordionDetails>
            <PageToolbar
              divider={false}
              label="사용자에 대한 추가 속성을 관리합니다."
              actions={
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddOutlined />}
                    onClick={() => propertiesEditorRef.current?.addRow()}
                    disabled={propertiesBusy}
                  >
                    행 추가
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<SaveOutlined />}
                    onClick={() => void handleSaveProperties()}
                    disabled={propertiesBusy || !propertiesChanged}
                  >
                    {propertiesSaving ? <CircularProgress size={16} /> : "저장"}
                  </Button>
                </Stack>
              }
            />
            <PropertiesEditor
              ref={propertiesEditorRef}
              value={draftProperties}
              onChange={setDraftProperties}
              type="users"
              disabled={propertiesBusy}
              resetKey={propertiesResetKey}
            />
          </AccordionDetails>
        </Accordion>
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
