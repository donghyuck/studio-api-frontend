import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Chip,
  Stack,
  Button,
  Container,
  Grid,
  IconButton,
  InputAdornment,
  TextField,
  CircularProgress,
  Alert,
} from "@mui/material";
import { AddOutlined, ExpandMoreOutlined, SaveOutlined } from "@mui/icons-material";
import { useConfirm, useToast } from "@/react/feedback";
import { reactObjectTypeApi } from "./api";
import type { ObjectTypeDto, ObjectTypePolicyDto } from "@/types/studio/objecttype";
import { useAuthStore } from "@/react/auth/store";
import { PageToolbar } from "@/react/components/page/PageToolbar";
import { COMMON_MIME_TYPES } from "./commonMimeTypes";

function parseList(value?: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function serializeList(values: string[]) {
  const normalized = Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
  return normalized.length > 0 ? normalized.join(",") : null;
}

export function ObjectTypeDetailPage() {
  const { objectTypeId } = useParams<{ objectTypeId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuthStore();
  const [objectType, setObjectType] = useState<ObjectTypeDto | null>(null);
  const [policy, setPolicy] = useState<ObjectTypePolicyDto | null>(null);
  const [policySource, setPolicySource] = useState<"stored" | "default" | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", status: "" });
  const [policyForm, setPolicyForm] = useState({
    maxFileMb: "",
    allowedExt: [] as string[],
    allowedExtDraft: "",
    allowedMime: [] as string[],
  });

  const loadObjectType = useCallback(() => {
    if (!objectTypeId) return;
    setLoading(true);
    Promise.all([
      reactObjectTypeApi.get(Number(objectTypeId)),
      reactObjectTypeApi.getPolicy(Number(objectTypeId)).catch(() => null),
      reactObjectTypeApi.getEffectivePolicy(Number(objectTypeId)).catch(() => null),
    ])
      .then(([ot, pol, effective]) => {
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
            allowedExt: parseList(pol.allowedExt),
            allowedExtDraft: "",
            allowedMime: parseList(pol.allowedMime),
          });
        }
        setPolicySource(effective?.source ?? (pol === null ? "default" : "stored"));
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
        allowedExt: serializeList(policyForm.allowedExt),
        allowedMime: serializeList(policyForm.allowedMime),
        updatedBy: user.username,
        updatedById: user.userId,
        createdBy: policy?.createdBy ?? user.username,
        createdById: policy?.createdById ?? user.userId,
      });
      setPolicy(nextPolicy);
      setPolicyForm({
        maxFileMb: nextPolicy.maxFileMb?.toString() ?? "",
        allowedExt: parseList(nextPolicy.allowedExt),
        allowedExtDraft: "",
        allowedMime: parseList(nextPolicy.allowedMime),
      });
      setPolicySource("stored");
      toast.success("파일 정책이 저장되었습니다.");
    } catch {
      toast.error("파일 정책 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function handleAddAllowedExt() {
    const nextValue = policyForm.allowedExtDraft.trim().replace(/^\./, "");
    if (!nextValue) return;
    setPolicyForm((current) => ({
      ...current,
      allowedExt: Array.from(new Set([...current.allowedExt, nextValue])),
      allowedExtDraft: "",
    }));
  }

  function handleDeleteAllowedExt(value: string) {
    setPolicyForm((current) => ({
      ...current,
      allowedExt: current.allowedExt.filter((item) => item !== value),
    }));
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
        {policySource === "default" && (
          <Alert severity="info" sx={{ mb: 1 }}>
            저장된 정책이 없습니다. 현재 파일 크기·확장자·MIME 제한이 없는 기본 정책이 적용됩니다.
          </Alert>
        )}
        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
            파일 정책
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={1} alignItems="flex-start">
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="최대 파일 크기 (MB)"
                  value={policyForm.maxFileMb}
                onChange={(e) => setPolicyForm((f) => ({ ...f, maxFileMb: e.target.value }))}
                size="small"
                type="number"
                helperText="예: 10"
                fullWidth
              />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack spacing={0.75}>
                  <TextField
                    label="허용 확장자"
                    value={policyForm.allowedExtDraft}
                    onChange={(e) =>
                      setPolicyForm((f) => ({ ...f, allowedExtDraft: e.target.value }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAddAllowedExt();
                      }
                    }}
                    size="small"
                    helperText="예: jpg"
                    FormHelperTextProps={{
                      sx: {
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      },
                    }}
                    fullWidth
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            edge="end"
                            size="small"
                            aria-label="허용 확장자 추가"
                            onClick={handleAddAllowedExt}
                            disabled={!policyForm.allowedExtDraft.trim()}
                          >
                            <AddOutlined fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Stack
                    direction="row"
                    spacing={0.5}
                    useFlexGap
                    flexWrap="wrap"
                    sx={{ minHeight: 24 }}
                  >
                    {policyForm.allowedExt.map((ext) => (
                      <Chip
                        key={ext}
                        label={ext}
                        size="small"
                        variant="outlined"
                        onDelete={() => handleDeleteAllowedExt(ext)}
                      />
                    ))}
                  </Stack>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Autocomplete
                  multiple
                  freeSolo
                  options={COMMON_MIME_TYPES}
                  value={policyForm.allowedMime}
                  onChange={(_, value) =>
                    setPolicyForm((current) => ({
                      ...current,
                      allowedMime: Array.from(new Set(value.map((item) => item.trim()).filter(Boolean))),
                    }))
                  }
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        label={option}
                        size="small"
                        variant="outlined"
                        {...getTagProps({ index })}
                        key={option}
                      />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="허용 MIME 타입"
                      size="small"
                      helperText="목록 선택 또는 직접 입력. 빈 값은 제한 없음"
                      FormHelperTextProps={{
                        sx: {
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        },
                      }}
                    />
                  )}
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
