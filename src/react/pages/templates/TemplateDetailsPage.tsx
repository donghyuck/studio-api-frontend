import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Stack,
  Breadcrumbs,
  Typography,
  Button,
  TextField,
  Divider,
  CircularProgress,
  Alert,
} from "@mui/material";
import { ArrowBackOutlined, SaveOutlined, PreviewOutlined } from "@mui/icons-material";
import { useToast } from "@/react/feedback";
import { PreviewTemplateDialog } from "@/react/pages/templates/PreviewTemplateDialog";
import { reactTemplatesApi } from "./api";
import type { TemplateDto } from "@/types/studio/template";

export function TemplateDetailsPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [template, setTemplate] = useState<TemplateDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    displayName: "",
    description: "",
    subject: "",
    body: "",
  });

  useEffect(() => {
    if (!templateId) return;
    setLoading(true);
    reactTemplatesApi
      .get(Number(templateId))
      .then((t) => {
        setTemplate(t);
        setForm({
          name: t.name,
          displayName: t.displayName ?? "",
          description: t.description ?? "",
          subject: t.subject ?? "",
          body: t.body ?? "",
        });
        setError(null);
      })
      .catch(() => setError("템플릿을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [templateId]);

  async function handleSave() {
    if (!templateId || !template) return;
    setSaving(true);
    try {
      await reactTemplatesApi.update(Number(templateId), {
        objectType: template.objectType,
        objectId: template.objectId,
        name: form.name,
        displayName: form.displayName || null,
        description: form.description || null,
        subject: form.subject || null,
        body: form.body || null,
        properties: template.properties,
      });
      toast.success("저장되었습니다.");
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
      <Breadcrumbs separator="›">
        <Typography color="text.secondary">애플리케이션</Typography>
        <Typography
          color="text.secondary"
          sx={{ cursor: "pointer" }}
          onClick={() => navigate("/application/templates")}
        >
          템플릿
        </Typography>
        <Typography color="text.primary">{template.name}</Typography>
      </Breadcrumbs>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h5">템플릿 상세</Typography>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<PreviewOutlined />} onClick={() => setPreviewOpen(true)}>
            미리보기
          </Button>
          <Button
            variant="outlined"
            startIcon={<ArrowBackOutlined />}
            onClick={() => navigate("/application/templates")}
          >
            목록
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveOutlined />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <CircularProgress size={20} /> : "저장"}
          </Button>
        </Stack>
      </Box>
      <Divider />
      <Stack spacing={2} sx={{ maxWidth: 700 }}>
        <TextField
          label="이름"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          size="small"
        />
        <TextField
          label="표시 이름"
          value={form.displayName}
          onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
          size="small"
        />
        <TextField
          label="설명"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          size="small"
          multiline
          rows={2}
        />
        <TextField
          label="제목 (subject)"
          value={form.subject}
          onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          size="small"
        />
        <TextField
          label="본문 (body)"
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          size="small"
          multiline
          rows={10}
        />
      </Stack>
      <PreviewTemplateDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        templateId={template.templateId}
      />
    </Stack>
  );
}
