import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Stack,
  Button,
  Container,
  Grid,
  TextField,
  CircularProgress,
  Alert,
} from "@mui/material";
import { ExpandMoreOutlined, SaveOutlined } from "@mui/icons-material";
import { useConfirm, useToast } from "@/react/feedback";
import { reactObjectTypeApi } from "./api";
import type { ObjectTypeDto, ObjectTypePolicyDto } from "@/types/studio/objecttype";
import { useAuthStore } from "@/react/auth/store";
import { PageToolbar } from "@/react/components/page/PageToolbar";

export function ObjectTypeDetailPage() {
  const { objectTypeId } = useParams<{ objectTypeId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuthStore();
  const [objectType, setObjectType] = useState<ObjectTypeDto | null>(null);
  const [policy, setPolicy] = useState<ObjectTypePolicyDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", status: "" });
  const [policyForm, setPolicyForm] = useState({
    maxFileMb: "",
    allowedExt: "",
    allowedMime: "",
  });

  const loadObjectType = useCallback(() => {
    if (!objectTypeId) return;
    setLoading(true);
    Promise.all([
      reactObjectTypeApi.get(Number(objectTypeId)),
      reactObjectTypeApi.getPolicy(Number(objectTypeId)).catch(() => null),
    ])
      .then(([ot, pol]) => {
        setObjectType(ot);
        setForm({
          name: ot.name,
          description: ot.description ?? "",
          status: ot.status,
        });
        if (pol) {
          setPolicy(pol);
          setPolicyForm({
            maxFileMb: pol.maxFileMb?.toString() ?? "",
            allowedExt: pol.allowedExt ?? "",
            allowedMime: pol.allowedMime ?? "",
          });
        }
        setError(null);
      })
      .catch(() => setError("오브젝트 타입을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [objectTypeId]);

  useEffect(() => {
    loadObjectType();
  }, [loadObjectType]);

  async function handleSave() {
    if (!objectTypeId || !user) return;
    setSaving(true);
    try {
      await reactObjectTypeApi.patch(Number(objectTypeId), {
        name: form.name,
        description: form.description || null,
        status: form.status,
        updatedBy: user.username,
        updatedById: user.userId,
      });
      toast.success("저장되었습니다.");
    } catch {
      toast.error("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePolicy() {
    if (!objectTypeId || !user) return;
    setSaving(true);
    try {
      const nextPolicy = await reactObjectTypeApi.upsertPolicy(Number(objectTypeId), {
        maxFileMb: policyForm.maxFileMb === "" ? null : Number(policyForm.maxFileMb),
        allowedExt: policyForm.allowedExt || null,
        allowedMime: policyForm.allowedMime || null,
        updatedBy: user.username,
        updatedById: user.userId,
        createdBy: policy?.createdBy ?? user.username,
        createdById: policy?.createdById ?? user.userId,
      });
      setPolicy(nextPolicy);
      toast.success("파일 정책이 저장되었습니다.");
    } catch {
      toast.error("파일 정책 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!objectTypeId || !objectType) return;

    const ok = await confirm({
      title: "오브젝트 타입 삭제",
      message: `${objectType.code} 오브젝트 타입을 삭제하시겠습니까?`,
      okText: "삭제",
      cancelText: "취소",
    });
    if (!ok) return;

    setSaving(true);
    try {
      await reactObjectTypeApi.delete(Number(objectTypeId));
      toast.success("오브젝트 타입이 삭제되었습니다.");
      navigate("/policy/object-types");
    } catch {
      toast.error("삭제에 실패했습니다.");
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
  if (!objectType) return null;

  return (
    <Stack spacing={2}>
      <PageToolbar
        divider
        breadcrumbs={["정책", "오브젝트 타입", objectType.code]}
        label="오브젝트 타입 기본 정보와 파일 정책을 관리합니다."
        previous
        onPrevious={() => navigate("/policy/object-types")}
        onRefresh={loadObjectType}
      />
      <Container maxWidth="md" disableGutters>
        <Grid container spacing={1} alignItems="center">
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="코드"
              value={objectType.code}
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
              label="도메인"
              value={objectType.domain}
              InputProps={{ readOnly: true }}
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="상태"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField
              label="설명"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              size="small"
              multiline
              rows={2}
              fullWidth
            />
          </Grid>
          <Grid size={12} sx={{ mt: 2 }}>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                variant="outlined"
                startIcon={<SaveOutlined />}
                color="error"
                onClick={() => void handleDelete()}
                disabled={saving}
              >
                삭제
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
            파일 정책
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={1} alignItems="center">
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="최대 파일 크기 (MB)"
                  value={policyForm.maxFileMb}
                  onChange={(e) => setPolicyForm((f) => ({ ...f, maxFileMb: e.target.value }))}
                  size="small"
                  type="number"
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="허용 확장자"
                  value={policyForm.allowedExt}
                  onChange={(e) => setPolicyForm((f) => ({ ...f, allowedExt: e.target.value }))}
                  size="small"
                  helperText="예: jpg,png,pdf"
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="허용 MIME 타입"
                  value={policyForm.allowedMime}
                  onChange={(e) => setPolicyForm((f) => ({ ...f, allowedMime: e.target.value }))}
                  size="small"
                  fullWidth
                />
              </Grid>
              <Grid size={12} sx={{ mt: 2 }}>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button
                    variant="outlined"
                    startIcon={<SaveOutlined />}
                    onClick={handleSavePolicy}
                    disabled={saving}
                  >
                    {saving ? <CircularProgress size={20} /> : "파일 정책 저장"}
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Container>
    </Stack>
  );
}
