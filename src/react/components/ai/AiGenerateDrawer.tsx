import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AutoFixHigh,
  Close,
  ContentCopy,
  Done,
  EditNote,
} from "@mui/icons-material";
import { AiProviderSelect } from "@/react/components/ai/AiProviderSelect";
import { reactAiApi } from "@/react/pages/ai/api";
import { resolveAxiosError } from "@/utils/helpers";

type Mode = "generate" | "improve";

interface Context {
  subject?: string;
  language?: string;
  description?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  context?: Context;
  currentBody?: string;
  onApply: (content: string) => void;
}

const PLACEHOLDER: Record<Mode, string> = {
  generate:
    "예) 주문 완료 알림 이메일을 FreeMarker로 작성해줘. 변수로 userName, orderDate, totalAmount를 사용해.",
  improve:
    "예) 내용을 더 친근한 말투로 바꾸고, 마무리 문구를 추가해줘.",
};

function buildSystemPrompt(mode: Mode, context: Context): string {
  const lang = context.language || "html";
  const parts = [
    `당신은 ${lang.toUpperCase()} 템플릿 전문 작성자입니다.`,
    `코드 블록(\`\`\`)이나 설명 없이 템플릿 내용만 반환하세요.`,
  ];
  if (context.subject) parts.push(`제목(subject): ${context.subject}`);
  if (context.description) parts.push(`설명: ${context.description}`);
  if (mode === "improve") parts.push("아래에 기존 본문을 제공합니다. 이를 개선해주세요.");
  return parts.join("\n");
}

function buildUserMessage(mode: Mode, prompt: string, currentBody: string): string {
  if (mode === "improve" && currentBody.trim()) {
    return `[기존 본문]\n${currentBody}\n\n[개선 요청]\n${prompt}`;
  }
  return prompt;
}

export function AiGenerateDrawer({ open, onClose, context = {}, currentBody = "", onApply }: Props) {
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [mode, setMode] = useState<Mode>("generate");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setResult("");
    try {
      const systemPrompt = buildSystemPrompt(mode, context);
      const userContent = buildUserMessage(mode, prompt, currentBody);
      const response = await reactAiApi.sendChat({
        provider: provider || undefined,
        model: model || undefined,
        messages: [{ role: "user", content: userContent }],
        systemPrompt,
      });
      const assistant = [...response.messages]
        .reverse()
        .find((m) => m.role === "assistant");
      setResult(assistant?.content ?? "");
    } catch (e) {
      setError(resolveAxiosError(e));
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    onApply(result);
    onClose();
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose() {
    setResult("");
    setError("");
    setPrompt("");
    onClose();
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 480 }, display: "flex", flexDirection: "column" } }}
    >
      {/* 헤더 */}
      <Toolbar variant="dense" sx={{ bgcolor: "primary.main", color: "primary.contrastText", flexShrink: 0 }}>
        <AutoFixHigh sx={{ mr: 1 }} />
        <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 600 }}>
          AI 본문 생성
        </Typography>
        <IconButton color="inherit" edge="end" onClick={handleClose}>
          <Close />
        </IconButton>
      </Toolbar>

      <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
        <Stack spacing={2}>
          {/* 프로바이더 선택 */}
          <AiProviderSelect
            provider={provider}
            model={model}
            onChange={(p, m) => { setProvider(p); setModel(m); }}
          />

          <Divider />

          {/* 모드 선택 */}
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_, v) => { if (v) setMode(v); }}
            size="small"
            fullWidth
          >
            <ToggleButton value="generate">
              <AutoFixHigh fontSize="small" sx={{ mr: 0.5 }} />
              새로 생성
            </ToggleButton>
            <ToggleButton value="improve" disabled={!currentBody.trim()}>
              <EditNote fontSize="small" sx={{ mr: 0.5 }} />
              현재 내용 개선
            </ToggleButton>
          </ToggleButtonGroup>

          {/* 컨텍스트 정보 표시 */}
          {(context.subject || context.description) && (
            <Box sx={{ bgcolor: "grey.50", borderRadius: 1, p: 1.5, border: "1px solid", borderColor: "divider" }}>
              {context.subject && (
                <Typography variant="caption" display="block" color="text.secondary">
                  제목: <strong>{context.subject}</strong>
                </Typography>
              )}
              {context.description && (
                <Typography variant="caption" display="block" color="text.secondary">
                  설명: <strong>{context.description}</strong>
                </Typography>
              )}
            </Box>
          )}

          {/* 프롬프트 입력 */}
          <TextField
            label="프롬프트"
            multiline
            minRows={4}
            maxRows={8}
            fullWidth
            size="small"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={PLACEHOLDER[mode]}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void handleGenerate();
            }}
          />

          <Button
            variant="contained"
            onClick={() => void handleGenerate()}
            disabled={loading || !prompt.trim()}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AutoFixHigh />}
          >
            {loading ? "생성 중..." : "생성 (Ctrl+Enter)"}
          </Button>

          {/* 오류 */}
          {error && <Alert severity="error">{error}</Alert>}

          {/* 결과 */}
          {result && (
            <>
              <Divider />
              <Stack spacing={1}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="subtitle2">생성 결과</Typography>
                  <Tooltip title={copied ? "복사됨" : "클립보드 복사"}>
                    <IconButton size="small" onClick={() => void handleCopy()}>
                      {copied ? <Done fontSize="small" color="success" /> : <ContentCopy fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </Stack>
                <TextField
                  multiline
                  minRows={6}
                  maxRows={20}
                  fullWidth
                  size="small"
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  sx={{ fontFamily: "monospace", "& textarea": { fontFamily: "monospace", fontSize: 12 } }}
                />
                <Button variant="contained" color="success" onClick={handleApply}>
                  본문에 적용
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </Box>
    </Drawer>
  );
}
