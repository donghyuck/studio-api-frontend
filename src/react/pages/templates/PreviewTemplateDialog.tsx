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
import { reactTemplatesApi } from "./api";

interface Props {
  open: boolean;
  onClose: () => void;
  templateId: number;
}

export function PreviewTemplateDialog({ open, onClose, templateId }: Props) {
  const toast = useToast();
  const [model, setModel] = useState("{}");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRender() {
    let parsedModel: Record<string, unknown> = {};
    try {
      parsedModel = JSON.parse(model);
    } catch {
      toast.error("모델 JSON 형식 오류");
      return;
    }

    setLoading(true);
    try {
      const [renderedBody, renderedSubject] = await Promise.all([
        reactTemplatesApi.renderBody(templateId, parsedModel),
        reactTemplatesApi.renderSubject(templateId, parsedModel),
      ]);
      setBody(typeof renderedBody === "string" ? renderedBody : JSON.stringify(renderedBody));
      setSubject(
        typeof renderedSubject === "string" ? renderedSubject : JSON.stringify(renderedSubject)
      );
    } catch {
      toast.error("렌더링에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>템플릿 미리보기</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="모델 (JSON)"
            multiline
            rows={4}
            fullWidth
            size="small"
            value={model}
            onChange={(event) => setModel(event.target.value)}
          />
          <Button variant="outlined" onClick={() => void handleRender()} disabled={loading}>
            {loading ? <CircularProgress size={20} /> : "렌더링"}
          </Button>
          {subject ? (
            <TextField
              label="제목"
              value={subject}
              InputProps={{ readOnly: true }}
              size="small"
              fullWidth
            />
          ) : null}
          {body ? (
            <TextField
              label="본문"
              value={body}
              multiline
              rows={6}
              InputProps={{ readOnly: true }}
              size="small"
              fullWidth
            />
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
}
