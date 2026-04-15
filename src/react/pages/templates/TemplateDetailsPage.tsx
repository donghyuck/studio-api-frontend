import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Grid,
  TextField,
  Stack,
} from "@mui/material";
import {
  TemplateCodeEditor,
  type EditorLanguage,
} from "@/react/components/code-editor/TemplateCodeEditor";
import { AutoFixHigh, PreviewOutlined, SaveOutlined } from "@mui/icons-material";
import { useToast, useConfirm } from "@/react/feedback";
import { PreviewTemplateDialog } from "@/react/pages/templates/PreviewTemplateDialog";
import { AiGenerateDrawer } from "@/react/components/ai/AiGenerateDrawer";
import { reactTemplatesApi } from "./api";
import type { TemplateDto } from "@/types/studio/template";
import { PageToolbar } from "@/react/components/page/PageToolbar";

interface FormState {
  name: string;
  displayName: string;
  description: string;
  subject: string;
  body: string;
  objectType: number;
  objectId: number;
}

function toForm(t: TemplateDto): FormState {
  return {
    name: t.name,
    displayName: t.displayName ?? "",
    description: t.description ?? "",
    subject: t.subject ?? "",
    body: t.body ?? "",
    objectType: t.objectType ?? 0,
    objectId: t.objectId ?? 0,
  };
}

export function TemplateDetailsPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const [template, setTemplate] = useState<TemplateDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [language, setLanguage] = useState<EditorLanguage>("html");
  const [savedLanguage, setSavedLanguage] = useState<EditorLanguage>("html");

  const [savedForm, setSavedForm] = useState<FormState>({
    name: "",
    displayName: "",
    description: "",
    subject: "",
    body: "",
    objectType: 0,
    objectId: 0,
  });
  const [form, setForm] = useState<FormState>(savedForm);

  const isDirty = useMemo(
    () =>
      JSON.stringify(form) !== JSON.stringify(savedForm) || language !== savedLanguage,
    [form, savedForm, language, savedLanguage]
  );

  const loadTemplate = useCallback(() => {
    if (!templateId) return;
    setLoading(true);
    reactTemplatesApi
      .get(Number(templateId))
      .then((t) => {
        setTemplate(t);
        const f = toForm(t);
        setSavedForm(f);
        setForm(f);
        const lang = (t.properties?.editorLanguage ?? "html") as EditorLanguage;
        setLanguage(lang);
        setSavedLanguage(lang);
        setError(null);
      })
      .catch(() => setError("템플릿을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [templateId]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  async function handleSave() {
    if (!templateId || !template) return;
    const ok = await confirm({
      title: "저장 확인",
      message: "현재 내용을 저장하시겠습니까?",
      okText: "저장",
      cancelText: "취소",
    });
    if (!ok) return;

    setSaving(true);
    try {
      await reactTemplatesApi.update(Number(templateId), {
        objectType: form.objectType,
        objectId: form.objectId,
        name: form.name,
        displayName: form.displayName || null,
        description: form.description || null,
        subject: form.subject || null,
        body: form.body || null,
        properties: { ...template.properties, editorLanguage: language },
      });
      toast.success("저장되었습니다.");
      await loadTemplate();
    } catch {
      toast.error("저장에 실패했습니다.");
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
  if (!template) return null;

  return (
    <Stack spacing={2}>
      <PageToolbar
        divider
        breadcrumbs={["애플리케이션", "템플릿", template.name]}
        label="템플릿 메타데이터와 본문을 관리합니다."
        previous
        onPrevious={() => navigate("/application/templates")}
        onRefresh={loadTemplate}
      />
      <Container maxWidth="md" disableGutters>
        <Grid container spacing={2} alignItems="flex-start">
          {/* 이름 (read-only) */}
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="이름"
              value={form.name}
              size="small"
              fullWidth
              disabled
              helperText="이름은 변경할 수 없습니다."
            />
          </Grid>
          {/* 표시 이름 */}
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label="표시 이름"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              size="small"
              fullWidth
            />
          </Grid>
          {/* 객체 유형 / 식별자 */}
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              label="객체 유형"
              value={form.objectType}
              onChange={(e) =>
                setForm((f) => ({ ...f, objectType: Number(e.target.value) || 0 }))
              }
              size="small"
              fullWidth
              type="number"
              inputProps={{ min: 0 }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              label="객체 식별자"
              value={form.objectId}
              onChange={(e) =>
                setForm((f) => ({ ...f, objectId: Number(e.target.value) || 0 }))
              }
              size="small"
              fullWidth
              type="number"
              inputProps={{ min: 0 }}
            />
          </Grid>
          {/* 설명 — 별도 행 */}
          <Grid size={12}>
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
          {/* 제목 */}
          <Grid size={12}>
            <TextField
              label="제목 (subject)"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              size="small"
              fullWidth
            />
          </Grid>
          {/* 본문 에디터 */}
          <Grid size={12}>
            <TemplateCodeEditor
              value={form.body}
              onChange={(v) => setForm((f) => ({ ...f, body: v }))}
              language={language}
              onLanguageChange={setLanguage}
            />
          </Grid>
          {/* 액션 버튼 */}
          <Grid size={12}>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                variant="outlined"
                startIcon={<AutoFixHigh />}
                onClick={() => setAiDrawerOpen(true)}
              >
                AI 생성
              </Button>
              <Button
                variant="outlined"
                startIcon={<PreviewOutlined />}
                onClick={() => setPreviewOpen(true)}
              >
                미리보기
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveOutlined />}
                onClick={() => void handleSave()}
                disabled={saving || !isDirty}
              >
                {saving ? <CircularProgress size={20} color="inherit" /> : "저장"}
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Container>
      <PreviewTemplateDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        templateId={template.templateId}
      />
      <AiGenerateDrawer
        open={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        context={{
          subject: form.subject,
          description: form.description,
          language,
        }}
        currentBody={form.body}
        onApply={(v) => setForm((f) => ({ ...f, body: v }))}
      />
    </Stack>
  );
}
