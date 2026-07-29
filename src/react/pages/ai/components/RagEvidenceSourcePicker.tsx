import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Link,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { CancelOutlined, DeleteOutline, RefreshOutlined } from "@mui/icons-material";
import { reactAiApi } from "@/react/pages/ai/api";
import type {
  IndexedWebSourceRefDto,
  WebKnowledgeSourceDto,
} from "@/types/studio/ai";
import { resolveAxiosError } from "@/utils/helpers";

type Props = {
  workspaceId?: number | null;
  embeddingDeploymentId?: string | null;
  value: IndexedWebSourceRefDto[];
  maxSelectedSources?: number;
  disabled?: boolean;
  onChange: (value: IndexedWebSourceRefDto[]) => void;
};

const ACTIVE = new Set(["PENDING", "FETCHING", "NORMALIZING", "INDEXING"]);

function statusLabel(status: string) {
  switch (status) {
    case "PENDING": return "대기 중";
    case "FETCHING": return "수집 중";
    case "NORMALIZING": return "정규화 중";
    case "INDEXING": return "색인 중";
    case "COMPLETED": return "사용 가능";
    case "UNCHANGED": return "변경 없음";
    case "FAILED": return "실패";
    case "CANCELLED": return "취소됨";
    default: return status;
  }
}

function isForbiddenError(err: unknown) {
  if (!err) return false;
  if (typeof err === "object" && "status" in err && (err as { status?: number }).status === 403) return true;
  if (typeof err === "object" && "response" in err && (err as { response?: { status?: number } }).response?.status === 403) return true;
  const msg = resolveAxiosError(err);
  return msg.includes("403") || msg.toLowerCase().includes("forbidden") || msg.includes("권한");
}

export function RagEvidenceSourcePicker({
  workspaceId,
  embeddingDeploymentId,
  value,
  maxSelectedSources = 10,
  disabled = false,
  onChange,
}: Props) {
  const [sources, setSources] = useState<WebKnowledgeSourceDto[]>([]);
  const [url, setUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [writeDisabled, setWriteDisabled] = useState(false);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  }, [value, onChange]);

  const effectiveDeploymentId = embeddingDeploymentId || "embedding-default";

  const load = useCallback(async () => {
    if (!workspaceId) {
      setSources([]);
      return;
    }
    try {
      setLoading(true);
      const result = await reactAiApi.listWebKnowledgeSources(
        workspaceId,
        effectiveDeploymentId
      );
      setSources(result);
      setReadError(null);
      const usable = new Set(
        result
          .filter((item) => item.currentRevisionId)
          .map((item) => `${item.sourceId}:${item.currentRevisionId}`)
      );
      const retained = valueRef.current.filter((item) =>
        usable.has(`${item.sourceId}:${item.revisionId}`)
      );
      if (retained.length !== valueRef.current.length) onChangeRef.current(retained);
    } catch (loadError) {
      if (isForbiddenError(loadError)) {
        setReadError("이 workspace의 URL 자료를 조회할 수 없습니다.");
      } else {
        setReadError(resolveAxiosError(loadError));
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId, effectiveDeploymentId]);

  useEffect(() => {
    setWriteError(null);
    setWriteDisabled(false);
    void load();
  }, [workspaceId, effectiveDeploymentId, load]);

  useEffect(() => {
    if (!sources.some((source) => ACTIVE.has(source.status))) return;
    const timer = window.setInterval(() => void load(), 2000);
    return () => window.clearInterval(timer);
  }, [sources, load]);

  const selectedKeys = useMemo(
    () => new Set(value.map((item) => `${item.sourceId}:${item.revisionId}`)),
    [value]
  );

  async function createSource() {
    if (!workspaceId || !url.trim() || writeDisabled) return;
    try {
      setSubmitting(true);
      setWriteError(null);
      await reactAiApi.createWebKnowledgeSource(workspaceId, {
        url: url.trim(),
        displayName: displayName.trim() || undefined,
        embeddingDeploymentId: effectiveDeploymentId,
      });
      setUrl("");
      setDisplayName("");
      await load();
    } catch (createErr) {
      if (isForbiddenError(createErr)) {
        setWriteDisabled(true);
        setWriteError("기존 자료만 사용할 수 있으며 새 URL을 등록할 수 없습니다.");
      } else {
        setWriteError(resolveAxiosError(createErr));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function toggle(source: WebKnowledgeSourceDto) {
    if (!source.currentRevisionId) return;
    const key = `${source.sourceId}:${source.currentRevisionId}`;
    if (selectedKeys.has(key)) {
      onChange(value.filter((item) => `${item.sourceId}:${item.revisionId}` !== key));
      return;
    }
    if (value.length >= maxSelectedSources) return;
    onChange([
      ...value,
      { sourceId: source.sourceId, revisionId: source.currentRevisionId },
    ]);
  }

  async function refreshSource(sourceId: string) {
    if (!workspaceId || writeDisabled) return;
    try {
      setWriteError(null);
      await reactAiApi.refreshWebKnowledgeSource(workspaceId, sourceId);
      await load();
    } catch (refreshErr) {
      if (isForbiddenError(refreshErr)) {
        setWriteDisabled(true);
        setWriteError("기존 자료만 사용할 수 있으며 새 URL을 등록할 수 없습니다.");
      } else {
        setWriteError(resolveAxiosError(refreshErr));
      }
    }
  }

  async function cancelSource(sourceId: string) {
    if (!workspaceId || writeDisabled) return;
    try {
      setWriteError(null);
      await reactAiApi.cancelWebKnowledgeSource(workspaceId, sourceId);
      await load();
    } catch (cancelErr) {
      if (isForbiddenError(cancelErr)) {
        setWriteDisabled(true);
        setWriteError("기존 자료만 사용할 수 있으며 새 URL을 등록할 수 없습니다.");
      } else {
        setWriteError(resolveAxiosError(cancelErr));
      }
    }
  }

  async function archiveSource(sourceId: string) {
    if (!workspaceId || writeDisabled) return;
    try {
      setWriteError(null);
      await reactAiApi.archiveWebKnowledgeSource(workspaceId, sourceId);
      onChange(value.filter((item) => item.sourceId !== sourceId));
      await load();
    } catch (archiveErr) {
      if (isForbiddenError(archiveErr)) {
        setWriteDisabled(true);
        setWriteError("기존 자료만 사용할 수 있으며 새 URL을 등록할 수 없습니다.");
      } else {
        setWriteError(resolveAxiosError(archiveErr));
      }
    }
  }

  if (!workspaceId) {
    return (
      <Alert severity="info">
        자료를 저장할 workspace를 선택하세요.
      </Alert>
    );
  }

  return (
    <Stack spacing={1.25}>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          수집한 웹 자료
        </Typography>
        <Typography variant="caption" color="text.secondary">
          공개 HTTPS 페이지를 수집·색인한 뒤 문서와 함께 근거로 사용합니다.
        </Typography>
      </Box>

      {writeError ? <Alert severity="warning">{writeError}</Alert> : null}
      {readError ? <Alert severity="error">{readError}</Alert> : null}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField
          size="small"
          type="url"
          label="공개 HTTPS URL"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          disabled={disabled || submitting || writeDisabled}
          fullWidth
        />
        <TextField
          size="small"
          label="표시 이름 (선택)"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          disabled={disabled || submitting || writeDisabled}
          sx={{ minWidth: 180 }}
        />
        <Button
          variant="outlined"
          onClick={() => void createSource()}
          disabled={disabled || submitting || writeDisabled || !url.trim()}
          sx={{ whiteSpace: "nowrap" }}
        >
          {submitting ? <CircularProgress size={18} /> : "수집 시작"}
        </Button>
      </Stack>

      {loading && sources.length === 0 ? <CircularProgress size={20} /> : null}

      <Stack spacing={0.75}>
        {sources.map((source) => {
          const selectable = Boolean(source.currentRevisionId)
            && (source.status === "COMPLETED" || source.status === "UNCHANGED");
          const key = source.currentRevisionId
            ? `${source.sourceId}:${source.currentRevisionId}`
            : source.sourceId;
          return (
            <Box
              key={source.sourceId}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1.5,
                px: 1.25,
                py: 0.75,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <FormControlLabel
                  sx={{ m: 0, flex: 1, alignItems: "flex-start" }}
                  control={
                    <Checkbox
                      size="small"
                      checked={selectedKeys.has(key)}
                      onChange={() => toggle(source)}
                      disabled={disabled || !selectable}
                    />
                  }
                  label={
                    <Box sx={{ pt: 0.3 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {source.displayName || source.title || source.host}
                        </Typography>
                        <Chip size="small" label={statusLabel(source.status)} />
                      </Stack>
                      <Link
                        href={source.canonicalUrl || source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="caption"
                        sx={{ overflowWrap: "anywhere" }}
                      >
                        {source.host}
                      </Link>
                      {source.contentPreview ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block", mt: 0.35 }}
                        >
                          {source.contentPreview}
                        </Typography>
                      ) : null}
                      {source.errorCode ? (
                        <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.25 }}>
                          오류 ({source.errorCode})
                        </Typography>
                      ) : null}
                    </Box>
                  }
                />
                {ACTIVE.has(source.status) ? (
                  <Tooltip title="수집 취소">
                    <span>
                      <IconButton
                        size="small"
                        disabled={disabled || writeDisabled}
                        onClick={() => void cancelSource(source.sourceId)}
                      >
                        <CancelOutlined fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                ) : (
                  <Tooltip title="새로 수집">
                    <span>
                      <IconButton
                        size="small"
                        disabled={disabled || writeDisabled}
                        onClick={() => void refreshSource(source.sourceId)}
                      >
                        <RefreshOutlined fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
                <Tooltip title="보관">
                  <span>
                    <IconButton
                      size="small"
                      disabled={disabled || writeDisabled || ACTIVE.has(source.status)}
                      onClick={() => void archiveSource(source.sourceId)}
                    >
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Box>
          );
        })}
      </Stack>

      <Typography variant="caption" color="text.secondary">
        {value.length}/{maxSelectedSources}개 선택 · 답변 범위는 검색 결과가 아니라 답변 허용 수준만 변경합니다.
      </Typography>
    </Stack>
  );
}
