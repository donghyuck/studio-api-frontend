import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import { Add, Close, Delete, PlayArrow } from "@mui/icons-material";
import { useToast } from "@/react/feedback";
import { reactTemplatesApi } from "./api";

interface Props {
  open: boolean;
  onClose: () => void;
  templateId: number;
}

type RenderStatus = "idle" | "rendered" | "skipped" | "error";

interface VarRow {
  name: string;
  value: string;
}

function extractFreemarkerVariables(template: string): string[] {
  if (!template) return [];
  const matches = template.match(/\$\{[^}]+\}/g) ?? [];
  const vars = new Set<string>();
  for (const match of matches) {
    const inner = match.slice(2, -1).trim();
    if (!inner) continue;
    const primary = inner.split(/[!?<>=:+\-*/|,()\s]/)[0];
    if (primary) vars.add(primary);
  }
  return [...vars];
}

function statusColor(
  status: RenderStatus
): "success" | "default" | "error" | "primary" {
  if (status === "rendered") return "success";
  if (status === "skipped") return "default";
  if (status === "error") return "error";
  return "primary";
}

function statusLabel(status: RenderStatus, kind: "Subject" | "Body"): string {
  if (status === "rendered") return `${kind}: rendered`;
  if (status === "skipped") return `${kind}: skipped`;
  if (status === "error") return `${kind}: error`;
  return `${kind}: pending`;
}

export function PreviewTemplateDialog({ open, onClose, templateId }: Props) {
  const toast = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [templateBody, setTemplateBody] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");

  const [vars, setVars] = useState<VarRow[]>([]);
  const [previewSubject, setPreviewSubject] = useState("");
  const [previewBody, setPreviewBody] = useState("");

  const [subjectStatus, setSubjectStatus] = useState<RenderStatus>("idle");
  const [bodyStatus, setBodyStatus] = useState<RenderStatus>("idle");
  const [hasRun, setHasRun] = useState(false);

  // 템플릿 데이터 로드 및 FreeMarker 변수 추출
  useEffect(() => {
    if (!open || templateId <= 0) return;

    setLoading(true);
    setErrorMessage("");
    setPreviewSubject("");
    setPreviewBody("");
    setHasRun(false);

    reactTemplatesApi
      .get(templateId)
      .then((t) => {
        const body = t.body ?? "";
        const subject = t.subject ?? "";
        setTemplateBody(body);
        setTemplateSubject(subject);

        // properties를 기본 변수 행으로 변환
        const existingVars: VarRow[] = Object.entries(t.properties ?? {})
          .filter(([k]) => k !== "editorLanguage")
          .map(([name, value]) => ({ name, value: String(value) }));

        const existingNames = new Set(existingVars.map((v) => v.name));

        // FreeMarker 변수 추출 후 없는 것만 추가
        const extracted = extractFreemarkerVariables(body);
        const missing = extracted
          .filter((name) => !existingNames.has(name))
          .map((name) => ({ name, value: "" }));

        setVars([...existingVars, ...missing]);

        setSubjectStatus(subject.trim() ? "idle" : "skipped");
        setBodyStatus(body.trim() ? "idle" : "skipped");
      })
      .catch(() => setErrorMessage("템플릿을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [open, templateId]);

  function buildModel(): Record<string, string> {
    return Object.fromEntries(
      vars.filter((v) => v.name.trim()).map((v) => [v.name.trim(), v.value])
    );
  }

  async function handleRun() {
    if (templateId <= 0) return;
    setRunning(true);
    setErrorMessage("");
    setHasRun(true);

    const model = buildModel();
    const hasSubject = templateSubject.trim().length > 0;
    const hasBody = templateBody.trim().length > 0;

    try {
      const requests: Promise<{ kind: "subject" | "body"; data: string }>[] = [];

      if (hasSubject) {
        requests.push(
          reactTemplatesApi
            .renderSubject(templateId, model)
            .then((data) => ({ kind: "subject" as const, data: String(data) }))
        );
      } else {
        setPreviewSubject("");
        setSubjectStatus("skipped");
      }

      if (hasBody) {
        requests.push(
          reactTemplatesApi
            .renderBody(templateId, model)
            .then((data) => ({ kind: "body" as const, data: String(data) }))
        );
      } else {
        setPreviewBody("");
        setBodyStatus("skipped");
      }

      const results = await Promise.all(requests);
      for (const result of results) {
        if (result.kind === "subject") {
          setPreviewSubject(result.data);
          setSubjectStatus("rendered");
        } else {
          setPreviewBody(result.data);
          setBodyStatus("rendered");
        }
      }
    } catch {
      setErrorMessage("렌더링에 실패했습니다.");
      setSubjectStatus("error");
      setBodyStatus("error");
      toast.error("렌더링에 실패했습니다.");
    } finally {
      setRunning(false);
    }
  }

  function handleVarChange(index: number, field: "name" | "value", value: string) {
    setVars((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  }

  function handleAddVar() {
    setVars((prev) => [...prev, { name: "", value: "" }]);
  }

  function handleDeleteVar(index: number) {
    setVars((prev) => prev.filter((_, i) => i !== index));
  }

  const requiredVars = extractFreemarkerVariables(templateBody);

  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <Toolbar sx={{ bgcolor: "primary.main", color: "primary.contrastText" }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          Test Run
        </Typography>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={running ? <CircularProgress size={16} color="inherit" /> : <PlayArrow />}
          onClick={() => void handleRun()}
          disabled={running || templateId <= 0}
          sx={{ mr: 1 }}
        >
          Run Preview
        </Button>
        <IconButton color="inherit" onClick={onClose} edge="end">
          <Close />
        </IconButton>
      </Toolbar>

      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" py={6}>
            <CircularProgress />
          </Box>
        ) : (
          <Stack spacing={2}>
            {/* 변수 입력 테이블 */}
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                <Typography variant="subtitle2">테스트 변수</Typography>
                <Typography variant="caption" color="text.secondary">
                  템플릿 테스트를 위해 필요한 변수 값을 입력하세요.
                </Typography>
                <Box flex={1} />
                <Button size="small" startIcon={<Add />} onClick={handleAddVar}>
                  추가
                </Button>
              </Stack>
              <Table size="small" sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>변수명</TableCell>
                    <TableCell>값</TableCell>
                    <TableCell width={48} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vars.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <Typography variant="caption" color="text.secondary">
                          변수가 없습니다.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    vars.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ py: 0.5 }}>
                          <TextField
                            size="small"
                            variant="standard"
                            value={row.name}
                            onChange={(e) => handleVarChange(i, "name", e.target.value)}
                            placeholder="name"
                            fullWidth
                          />
                        </TableCell>
                        <TableCell sx={{ py: 0.5 }}>
                          <TextField
                            size="small"
                            variant="standard"
                            value={row.value}
                            onChange={(e) => handleVarChange(i, "value", e.target.value)}
                            placeholder="value"
                            fullWidth
                          />
                        </TableCell>
                        <TableCell sx={{ py: 0.5 }}>
                          <IconButton size="small" onClick={() => handleDeleteVar(i)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Box>

            <Divider />

            {/* 오류 및 필요 변수 안내 */}
            {errorMessage ? (
              <Alert severity="error">{errorMessage}</Alert>
            ) : requiredVars.length > 0 ? (
              <Alert severity="info">필요 변수: {requiredVars.join(", ")}</Alert>
            ) : null}

            {/* 렌더 상태 칩 — Run 이후에만 표시 */}
            {hasRun && (
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  size="small"
                  label={statusLabel(subjectStatus, "Subject")}
                  color={statusColor(subjectStatus)}
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={statusLabel(bodyStatus, "Body")}
                  color={statusColor(bodyStatus)}
                  variant="outlined"
                />
              </Stack>
            )}

            {/* 렌더링된 제목 */}
            {previewSubject ? (
              <TextField
                label="Rendered Subject"
                value={previewSubject}
                size="small"
                fullWidth
                InputProps={{ readOnly: true }}
              />
            ) : null}

            {/* 렌더링된 본문 (iframe) */}
            <Box
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                overflow: "hidden",
                minHeight: 240,
                position: "relative",
              }}
            >
              {!previewBody && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                  }}
                >
                  <Typography variant="body2" color="text.disabled">
                    렌더링 결과가 여기에 표시됩니다.
                  </Typography>
                </Box>
              )}
              <iframe
                ref={iframeRef}
                title="Rendered Preview"
                srcDoc={previewBody || "<html><body style='margin:0'></body></html>"}
                sandbox="allow-same-origin"
                style={{
                  border: 0,
                  width: "100%",
                  height: 400,
                  display: "block",
                  background: "#fff",
                }}
              />
            </Box>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
